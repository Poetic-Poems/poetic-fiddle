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
// Usage: node scripts/check-dependency-audit.mjs [cwd]

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CANARY_PACKAGE = "lodash";
export const CANARY_VERSION = "4.17.11";

// npm audit exits non-zero the moment any advisory is found, but still
// writes the full report to stdout — so the JSON has to be read off the
// thrown error's captured stdout in that case, not just the happy path's.
function runNpmAudit(cwd) {
  let stdout;
  try {
    stdout = execFileSync("npm", ["audit", "--json"], {
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

export function vulnerabilityCounts(auditJson) {
  const counts = auditJson?.metadata?.vulnerabilities ?? {};
  return { high: counts.high ?? 0, critical: counts.critical ?? 0 };
}

export function hasHighOrCriticalVulnerability(auditJson) {
  const { high, critical } = vulnerabilityCounts(auditJson);
  return high > 0 || critical > 0;
}

// `getCanaryAuditJson` is a thunk rather than a value so the canary audit
// (a real npm install + audit round trip) only runs on the otherwise-clean
// path, exactly as the design requires — a real advisory in `realAuditJson`
// short-circuits before it's ever called.
export function evaluateDependencyAudit(realAuditJson, getCanaryAuditJson) {
  if (hasHighOrCriticalVulnerability(realAuditJson)) {
    return {
      pass: false,
      message:
        "npm audit found a high or critical severity advisory in this " +
        "project's dependency tree. Run `npm audit` locally for details.",
    };
  }

  const canaryAuditJson = getCanaryAuditJson();
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

function main() {
  const cwd = process.argv[2] ?? process.cwd();
  const realAuditJson = runNpmAudit(cwd);
  const result = evaluateDependencyAudit(realAuditJson, runCanaryNpmAudit);
  console.log(result.message);
  if (!result.pass) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
