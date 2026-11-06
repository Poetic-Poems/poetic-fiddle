#!/usr/bin/env node
// check-dependency-audit.mjs
//
// `npm audit --audit-level=high` on its own is not a trustworthy gate: it
// exits 0 both when the tree is genuinely clean and when npm's advisory
// endpoint answers with an empty (or partial) result for reasons that have
// nothing to do with the tree's actual state. That happened for real —
// commit a6647036c23d794946f27c429e6399e791290746 carried two live,
// unwithdrawn advisories (nanoid GHSA-2v37-7h3g-55p8, high; dompurify
// GHSA-55q2-fjhq-7xh7, moderate) that a run 4h40m later reported as
// `found 0 vulnerabilities` against the identical commit, with no network
// error in the log — and it let a vulnerable dependency through.
//
// So this script never trusts a clean result on its own. Only on the
// otherwise-clean path, it also audits a throwaway project depending on
// lodash@4.17.11 — a package with a long-standing, still-unfixed-at-that-
// version high-severity advisory (GHSA-p6mc-m468-83gw, prototype
// pollution) — as a canary. If the canary tree *also* comes back clean, the
// advisory endpoint returned no data for this run, and this run's own clean
// result is untrustworthy: fail loudly rather than pass on data that isn't
// there. If the canary correctly reports its advisory, the endpoint is
// answering, and this project's own clean result stands.
//
// A genuine high-or-critical advisory in this project's own tree still
// fails outright, without needing the canary at all.
//
// One advisory is exempted from that gate: GHSA-vfj7-8cjw-p6xm, a
// stack-exhaustion DoS in `braces` reached only through this repo's lint
// toolchain (braces<=3.0.3 — every version ever published — via
// micromatch -> fast-glob -> @next/eslint-plugin-next -> eslint-config-next,
// a devDependency). No patched `braces` exists upstream; the owner
// authorised a scoped exception for this one advisory in #491, reproduced
// in #489. The exception (`applySuppressedAdvisoryException` below):
//
//   1. Only ever suppresses GHSA-vfj7-8cjw-p6xm against `braces`, and only
//      propagates to packages whose own "high" rating is purely inherited
//      from depending on the suppressed `braces` entry (no package with an
//      advisory of its own is ever suppressed).
//   2. Lapses automatically — causing the gate to fail again with no code
//      change needed — the moment npm audit's own report on `braces` says a
//      fix is available that does not require a semver-major bump (i.e.
//      `fixAvailable` is `true`, or an object with `isSemVerMajor: false`):
//      that is what it looks like once a patched `braces` exists, whether
//      published directly or via a `micromatch`/`fast-glob` release that
//      drops the vulnerable range.
//   3. Only applies while every `braces` entry in `package-lock.json` is
//      `dev: true`; if the advisory ever reaches a production dependency,
//      the gate fails as before.
//   4. Logs a visible line naming the advisory and why it was allowed,
//      whenever it actually suppresses something.
//
// Without a baseline, a single new high/critical advisory anywhere in the
// tree fails every open pull request at once, with no landing order that
// clears it (#542) — so a PR or merge-group run additionally takes
// `--baseline-ref=<ref>`, `<ref>` being a commit this script's own `cwd`
// has fetched: `ci.yml` resolves it to the base commit the pull
// request/merge group names (`pull_request.base.sha` /
// `merge_group.base_sha`) and `git fetch`es just that commit first, rather
// than relying on a branch name resolving locally. In that mode, a
// high/critical advisory only fails the run if its GHSA id is *not* already
// present in a second audit run against `<ref>`'s own
// `package.json`/`package-lock.json` — an advisory already on `main` logs
// as pre-existing and passes; one this branch introduces still fails. With
// no `--baseline-ref` (the weekly `dependency-audit.yml` schedule, and
// `ci.yml`'s own `push`/`workflow_dispatch` runs, which have no PR base to
// diff against), the gate stays tree-wide exactly as before: the weekly job
// is not a required check, and is what keeps a pre-existing advisory
// visible and tracked rather than silently waved through forever.
//
// Usage: node scripts/check-dependency-audit.mjs [cwd] [--baseline-ref=<ref>]
// `<ref>` must already be fetched into `cwd`'s git history (`git show
// <ref>:package.json` has to resolve) before this script runs.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANARY_PACKAGE = "lodash";
export const CANARY_VERSION = "4.17.11";

export const SUPPRESSED_ADVISORY_GHSA = "GHSA-vfj7-8cjw-p6xm";
export const SUPPRESSED_ADVISORY_PACKAGE = "braces";

// npm audit exits non-zero the moment any advisory is found, but still
// writes the full report to stdout — so the JSON has to be read off the
// thrown error's captured stdout in that case, not just the happy path's.
// `execFile` is injectable, same as `getCanaryAuditJson` below, so tests can
// exercise both the happy path and this catch branch without shelling out.
export function runNpmAudit(cwd, execFile = execFileSync) {
  let stdout;
  try {
    stdout = execFile("npm", ["audit", "--json"], {
      cwd,
      encoding: "utf8",
    });
  } catch (err) {
    stdout = err.stdout;
    if (typeof stdout !== "string" || stdout.trim() === "") {
      throw new Error(
        `npm audit produced no output in ${cwd} (${err.message})`,
      );
    }
  }
  return JSON.parse(stdout);
}

function runCanaryNpmAudit() {
  const dir = mkdtempSync(path.join(tmpdir(), "dependency-audit-canary-"));
  try {
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: "dependency-audit-canary",
          private: true,
          dependencies: { [CANARY_PACKAGE]: CANARY_VERSION },
        },
        null,
        2,
      ),
    );
    execFileSync(
      "npm",
      ["install", "--package-lock-only", "--no-audit", "--no-fund"],
      { cwd: dir, encoding: "utf8" },
    );
    return runNpmAudit(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Audits `ref`'s own dependency tree (not the working tree's) by checking
// out just its `package.json`/`package-lock.json` into a throwaway
// directory and running `npm audit` there — `npm audit` reads the lockfile
// directly and needs no `node_modules`, so there is no install step (and
// nothing runs this project's own `postinstall`, which assumes the full
// checkout it would not have in the throwaway directory). `cwd` must be a
// git checkout that already has `ref` available locally (`ci.yml` fetches
// the PR/merge-group base commit before invoking this script in baseline
// mode).
function runBaselineNpmAudit(cwd, ref) {
  const basePackageJson = execFileSync("git", ["show", `${ref}:package.json`], {
    cwd,
    encoding: "utf8",
  });
  const basePackageLockRaw = execFileSync(
    "git",
    ["show", `${ref}:package-lock.json`],
    { cwd, encoding: "utf8" },
  );

  const dir = mkdtempSync(path.join(tmpdir(), "dependency-audit-baseline-"));
  try {
    writeFileSync(path.join(dir, "package.json"), basePackageJson);
    writeFileSync(path.join(dir, "package-lock.json"), basePackageLockRaw);
    return {
      auditJson: runNpmAudit(dir),
      packageLockJson: JSON.parse(basePackageLockRaw),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function vulnerabilityCounts(auditJson) {
  const counts = auditJson?.metadata?.vulnerabilities ?? {};
  return { high: counts.high ?? 0, critical: counts.critical ?? 0 };
}

// An `npm audit` that fails outright still writes JSON to stdout — but an
// error object rather than a report: `{"error":{"code":"ENOAUDIT",…}}` for a
// registry that would not answer the audit request, `ENOLOCK` for a missing
// lockfile, and so on. That JSON carries no `metadata.vulnerabilities`, so
// counting advisories in it yields zero and reads exactly like a clean tree.
// Passing on it would be the same green-audit-that-never-audited failure this
// script exists to prevent, so a report that isn't a report is a failure in
// its own right.
export function unusableReportReason(auditJson) {
  const error = auditJson?.error;
  if (error) {
    const code = error.code ?? "unknown error";
    const summary = error.summary ? `: ${error.summary}` : "";
    return `npm audit reported an error (${code}${summary}) instead of a report`;
  }

  const counts = auditJson?.metadata?.vulnerabilities;
  if (!counts || typeof counts !== "object") {
    return "npm audit produced no vulnerability counts (no `metadata.vulnerabilities` in its JSON output)";
  }

  return null;
}

export function hasHighOrCriticalVulnerability(auditJson) {
  const { high, critical } = vulnerabilityCounts(auditJson);
  return high > 0 || critical > 0;
}

// True for the one `via` entry this exception ever matches: the advisory
// object (not a bare package-name string) for GHSA-vfj7-8cjw-p6xm itself.
function isSuppressedAdvisoryEntry(viaEntry) {
  return (
    typeof viaEntry === "object" &&
    viaEntry !== null &&
    typeof viaEntry.url === "string" &&
    viaEntry.url.endsWith(`/${SUPPRESSED_ADVISORY_GHSA}`)
  );
}

// `fixAvailable` is `false` when npm audit can offer no fix at all, `true`
// when the vulnerable package itself can be bumped without a semver-major
// change, or an object naming which top-level package a breaking fix would
// require. The exception only holds while none of those says a non-breaking
// fix now exists — that's the "a patched braces was published" signal.
function nonBreakingFixIsAvailable(fixAvailable) {
  if (fixAvailable === true) return true;
  if (fixAvailable && typeof fixAvailable === "object") {
    return fixAvailable.isSemVerMajor === false;
  }
  return false;
}

// Requirement 3 of the #491 authorisation: the exception only applies while
// every `braces` entry in package-lock.json is a dev dependency.
export function allBracesInstancesAreDevOnly(packageLockJson) {
  const packages = packageLockJson?.packages ?? {};
  const bracesEntries = Object.entries(packages).filter(
    ([key]) =>
      key === `node_modules/${SUPPRESSED_ADVISORY_PACKAGE}` ||
      key.endsWith(`/node_modules/${SUPPRESSED_ADVISORY_PACKAGE}`),
  );
  return (
    bracesEntries.length > 0 &&
    bracesEntries.every(([, pkg]) => pkg.dev === true)
  );
}

// Packages whose "high" rating is suppressed alongside `braces`: `braces`
// itself, plus any package whose *entire* `via` array is other packages
// already in the suppressed set (i.e. it carries no advisory of its own —
// it is only "high" because it depends on the suppressed chain).
function suppressedPackageChain(vulnerabilities) {
  const suppressed = new Set([SUPPRESSED_ADVISORY_PACKAGE]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, entry] of Object.entries(vulnerabilities)) {
      if (suppressed.has(name)) continue;
      const via = entry.via ?? [];
      if (
        via.length > 0 &&
        via.every((entry) => typeof entry === "string" && suppressed.has(entry))
      ) {
        suppressed.add(name);
        changed = true;
      }
    }
  }
  return suppressed;
}

// Applies the #491-authorised GHSA-vfj7-8cjw-p6xm/braces exception (see the
// header comment) to a real `npm audit --json` report, returning an
// adjusted report with the suppressed packages' counts removed from
// `metadata.vulnerabilities`, plus the set of package names actually
// suppressed (empty when the exception doesn't apply).
export function applySuppressedAdvisoryException(auditJson, packageLockJson) {
  const vulnerabilities = auditJson?.vulnerabilities;
  const bracesEntry = vulnerabilities?.[SUPPRESSED_ADVISORY_PACKAGE];
  const bracesHasOnlyTheSuppressedAdvisory =
    Array.isArray(bracesEntry?.via) &&
    bracesEntry.via.length > 0 &&
    bracesEntry.via.every(isSuppressedAdvisoryEntry);

  if (
    !bracesHasOnlyTheSuppressedAdvisory ||
    nonBreakingFixIsAvailable(bracesEntry.fixAvailable) ||
    !allBracesInstancesAreDevOnly(packageLockJson)
  ) {
    return { auditJson, suppressed: [] };
  }

  const suppressed = suppressedPackageChain(vulnerabilities);
  let { high, critical } = vulnerabilityCounts(auditJson);
  for (const name of suppressed) {
    const severity = vulnerabilities[name]?.severity;
    if (severity === "high") high -= 1;
    else if (severity === "critical") critical -= 1;
  }

  return {
    auditJson: {
      ...auditJson,
      metadata: {
        ...auditJson.metadata,
        vulnerabilities: {
          ...auditJson.metadata.vulnerabilities,
          high: Math.max(0, high),
          critical: Math.max(0, critical),
        },
      },
    },
    suppressed: [...suppressed],
  };
}

// The GHSA id of every high/critical advisory in a report, skipping any
// package name in `suppressedPackages` (the #491 braces-chain exception) —
// that set is excluded here rather than in the caller so both the head and
// the baseline side of a comparison apply it the same way, each against its
// own report's suppression result. Only a `via` entry that is itself an
// advisory object (not a bare package-name string naming another package
// in the chain) names a real GHSA id, same distinction as
// `isSuppressedAdvisoryEntry` above.
export function highOrCriticalAdvisoryIds(
  auditJson,
  suppressedPackages = new Set(),
) {
  const vulnerabilities = auditJson?.vulnerabilities ?? {};
  const ids = new Set();
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (suppressedPackages.has(name)) continue;
    if (entry.severity !== "high" && entry.severity !== "critical") continue;
    for (const viaEntry of entry.via ?? []) {
      if (typeof viaEntry !== "object" || viaEntry === null) continue;
      const match =
        typeof viaEntry.url === "string" &&
        viaEntry.url.match(/(GHSA-[A-Za-z0-9-]+)$/);
      if (match) ids.add(match[1]);
    }
  }
  return ids;
}

// `getCanaryAuditJson` is a thunk rather than a value so the canary audit
// (a real npm install + audit round trip) only runs on the otherwise-clean
// path, exactly as the design requires — a real advisory in `realAuditJson`
// short-circuits before it's ever called. `getBaselineAuditJson` is the same
// kind of thunk for the `--baseline-ref` comparison (#542): omit it (or pass
// `null`) to keep the tree-wide, no-baseline behaviour the weekly schedule
// still wants. `headSuppressedPackages` is the braces-chain exception set
// already computed for `realAuditJson`, needed here only to key the
// baseline comparison the same way the caller already adjusted the report's
// `metadata` counts.
export function evaluateDependencyAudit(
  realAuditJson,
  getCanaryAuditJson,
  getBaselineAuditJson = null,
  headSuppressedPackages = new Set(),
) {
  const realProblem = unusableReportReason(realAuditJson);
  if (realProblem) {
    return {
      pass: false,
      message: `${realProblem}, so this project's dependency tree was never actually audited. Treating that as a failure rather than a pass.`,
    };
  }

  if (hasHighOrCriticalVulnerability(realAuditJson)) {
    if (!getBaselineAuditJson) {
      return {
        pass: false,
        message:
          "npm audit found a high or critical severity advisory in this " +
          "project's dependency tree. Run `npm audit` locally for details.",
      };
    }

    const baseline = getBaselineAuditJson();
    const baseProblem = unusableReportReason(baseline.auditJson);
    if (baseProblem) {
      return {
        pass: false,
        message:
          "npm audit found a high or critical severity advisory in this " +
          `project's dependency tree, and the ${baseline.ref} baseline ` +
          `could not be established to check whether it's new (${baseProblem}). ` +
          "Treating that as a failure rather than a pass.",
      };
    }

    const headIds = highOrCriticalAdvisoryIds(
      realAuditJson,
      headSuppressedPackages,
    );
    const baseIds = highOrCriticalAdvisoryIds(
      baseline.auditJson,
      baseline.suppressedPackages,
    );
    const newIds = [...headIds].filter((id) => !baseIds.has(id));

    if (newIds.length > 0) {
      return {
        pass: false,
        message:
          "npm audit found a high or critical severity advisory not " +
          `present on ${baseline.ref}: ${newIds.join(", ")}. Run ` +
          "`npm audit` locally for details.",
      };
    }

    return {
      pass: true,
      message:
        "npm audit found only advisories already present on " +
        `${baseline.ref} (${[...headIds].join(", ") || "none"}); not ` +
        "failing this pull request for a pre-existing advisory.",
    };
  }

  const canaryAuditJson = getCanaryAuditJson();
  const canaryProblem = unusableReportReason(canaryAuditJson);
  if (canaryProblem) {
    return {
      pass: false,
      message: `npm audit reported no high or critical severity advisories, but the canary audit of ${CANARY_PACKAGE}@${CANARY_VERSION} could not confirm that: ${canaryProblem}. This project's clean result is therefore unconfirmed — treating it as a failure rather than a pass.`,
    };
  }

  if (!hasHighOrCriticalVulnerability(canaryAuditJson)) {
    return {
      pass: false,
      message:
        "npm audit reported no high or critical severity advisories, but " +
        `a canary audit of ${CANARY_PACKAGE}@${CANARY_VERSION} (a package ` +
        "with a known, still-unfixed-at-that-version high severity " +
        "advisory) also reported none. The advisory endpoint returned no " +
        "data for this run, so this project's clean result is " +
        "untrustworthy — treating it as a failure rather than a pass.",
    };
  }

  return {
    pass: true,
    message:
      "npm audit found no high or critical severity advisories, and the " +
      "canary audit confirms the advisory endpoint is responding with " +
      "real data.",
  };
}

function readPackageLockJson(cwd) {
  return JSON.parse(readFileSync(path.join(cwd, "package-lock.json"), "utf8"));
}

const BASELINE_REF_PREFIX = "--baseline-ref=";

function parseArgs(argv) {
  let cwd;
  let baselineRef;
  for (const arg of argv) {
    if (arg.startsWith(BASELINE_REF_PREFIX)) {
      baselineRef = arg.slice(BASELINE_REF_PREFIX.length);
    } else if (cwd === undefined) {
      cwd = arg;
    }
  }
  return { cwd: cwd ?? process.cwd(), baselineRef };
}

function main() {
  const { cwd, baselineRef } = parseArgs(process.argv.slice(2));
  const realAuditJson = runNpmAudit(cwd);
  const packageLockJson = readPackageLockJson(cwd);
  const { auditJson: adjustedAuditJson, suppressed } =
    applySuppressedAdvisoryException(realAuditJson, packageLockJson);

  if (suppressed.length > 0) {
    console.log(
      `check-dependency-audit: owner-authorised exception (#489, decided in #491) ` +
        `suppresses ${SUPPRESSED_ADVISORY_GHSA} for ${suppressed.join(", ")} — ` +
        "braces has no patched release yet and reaches this repo only via a dev " +
        "dependency; this lapses automatically once a non-breaking braces fix " +
        "is published.",
    );
  }

  const getBaselineAuditJson = baselineRef
    ? () => {
        const { auditJson: baseRealAuditJson, packageLockJson: baseLockJson } =
          runBaselineNpmAudit(cwd, baselineRef);
        const { auditJson: adjustedBaseAuditJson, suppressed: baseSuppressed } =
          applySuppressedAdvisoryException(baseRealAuditJson, baseLockJson);
        return {
          ref: baselineRef,
          auditJson: adjustedBaseAuditJson,
          suppressedPackages: new Set(baseSuppressed),
        };
      }
    : null;

  const result = evaluateDependencyAudit(
    adjustedAuditJson,
    runCanaryNpmAudit,
    getBaselineAuditJson,
    new Set(suppressed),
  );
  console.log(result.message);
  if (!result.pass) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
