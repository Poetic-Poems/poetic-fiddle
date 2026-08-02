#!/usr/bin/env node
// check-workflow-wiring.mjs
//
// Fails when a job in .github/workflows/*.yml triggers on `pull_request` but
// isn't actually wired into what blocks a merge to main. "Wired in" means
// one of:
//   - it's reachable via `needs` from a job whose own context (its `name:`,
//     or its job id if it has none) is a required status check, per
//     .github/required-checks.yml's `required:` list — this is what lets
//     ci.yml's conditional jobs (build, database, deploy, changes) count as
//     covered purely by feeding the always-run, required `ci` job, exactly
//     as ci.yml's own header comment prescribes; or
//   - it's named in required-checks.yml's `exempt:` list, with a reason —
//     for a job that is deliberately not a merge gate (e.g. CodeQL, which
//     reports to the Security tab rather than blocking).
//
// This is the guard filed as TD-PPpfid-26080105: tech-debt-register.yml
// shipped a whole new workflow (PR #145) without a matching update to the
// branch-protection ruleset's required checks, and nothing caught it. This
// script parses only the small, regular subset of YAML that workflow files
// in this repo actually use (flat `on:`/`jobs:` mappings, scalar/flow-list/
// block-list `needs:`) rather than depending on a full YAML library — see
// scripts/td-check.pl for the same house style of a small, targeted parser
// over a full dependency.
//
// A companion job, `workflow-wiring` in ci.yml, runs this on every pull
// request and feeds into the required `ci` check — so this check protects
// itself the same way it protects everything else. A separate, scheduled
// workflow (.github/workflows/required-checks-drift.yml) keeps
// required-checks.yml's `required:` list itself honest against the live
// ruleset.
//
// Usage: node scripts/check-workflow-wiring.mjs [workflows-dir] [required-checks-file]

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function stripQuotes(s) {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1);
    }
  }
  return s;
}

// Blank lines and whole-line comments carry no structure, and letting either
// count would be a false *pass*: a comment as the first thing in a block sets
// the block's indent to the comment's, so every real key under it is read as
// belonging to something else and the block parses empty. An `on:` block that
// parses empty has no `pull_request` trigger, and a workflow with no
// `pull_request` trigger is skipped entirely — the check would report success
// over exactly the ungated workflow it exists to catch.
function isContent(line) {
  const t = line.trim();
  return t !== "" && !t.startsWith("#");
}

function parseScalarOrFlowList(inline) {
  const s = inline.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => stripQuotes(x.trim()))
      .filter((x) => x.length > 0);
  }
  if (!s) return [];
  return [stripQuotes(s)];
}

// Splits a block of lines into its direct children at `indent`: each child
// is { key, inline, body }, where `body` is the (possibly further-nested)
// lines belonging to that key, exclusive of the key's own line.
function parseFlatMapping(lines, indent) {
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isContent(line)) continue;
    const lineIndent = line.match(/^(\s*)/)[1].length;
    if (lineIndent !== indent) continue;
    const m = line.match(/^\s*([^:\s][^:]*):\s*(.*)$/);
    if (!m) continue;
    // Quoted keys are the same key: `"on":` is the form linters recommend,
    // because YAML 1.1 reads a bare `on` as the boolean true. Without this,
    // `on` is never found and the workflow looks untriggered.
    const key = stripQuotes(m[1].trim());
    const inline = m[2].trim();

    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end];
      if (next.trim() === "") {
        end++;
        continue;
      }
      const nextIndent = next.match(/^(\s*)/)[1].length;
      if (nextIndent <= indent) break;
      end++;
    }

    result.push({ key, inline, body: lines.slice(i + 1, end) });
    i = end - 1;
  }
  return result;
}

function firstContentIndent(lines) {
  for (const l of lines) {
    if (isContent(l)) return l.match(/^(\s*)/)[1].length;
  }
  return null;
}

// `on:` is either a scalar/flow-list on the same line, a block list
// (`- push`), or (the common case here) a mapping (`push:`, `pull_request:`).
function parseTriggers(entry) {
  if (!entry) return [];
  if (entry.inline) return parseScalarOrFlowList(entry.inline);
  const firstLine = entry.body.find(isContent);
  if (!firstLine) return [];
  if (/^\s*-\s/.test(firstLine)) {
    return entry.body
      .filter(isContent)
      .map((l) => l.match(/^\s*-\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => stripQuotes(m[1]));
  }
  const indent = firstContentIndent(entry.body);
  return parseFlatMapping(entry.body, indent).map((e) => e.key);
}

// `needs:` is either a scalar, a flow list (`[a, b]`), or a block list.
function parseNeeds(entry) {
  if (!entry) return [];
  if (entry.inline) return parseScalarOrFlowList(entry.inline);
  return entry.body
    .filter(isContent)
    .map((l) => l.match(/^\s*-\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => stripQuotes(m[1]));
}

export function parseWorkflow(text) {
  const lines = text.split("\n");
  const top = parseFlatMapping(lines, 0);
  const onEntry = top.find((e) => e.key === "on");
  const jobsEntry = top.find((e) => e.key === "jobs");

  const triggers = parseTriggers(onEntry);

  const jobs = {};
  if (jobsEntry) {
    const jobIndent = firstContentIndent(jobsEntry.body);
    if (jobIndent !== null) {
      for (const jobEntry of parseFlatMapping(jobsEntry.body, jobIndent)) {
        const subIndent = firstContentIndent(jobEntry.body);
        const children =
          subIndent === null ? [] : parseFlatMapping(jobEntry.body, subIndent);
        const nameEntry = children.find((c) => c.key === "name");
        const needsEntry = children.find((c) => c.key === "needs");
        jobs[jobEntry.key] = {
          name: nameEntry ? stripQuotes(nameEntry.inline) : null,
          needs: parseNeeds(needsEntry),
        };
      }
    }
  }

  return { triggers, jobs };
}

// A job's required-status-check context is its `name:` if it declares one,
// else its job id — matching what GitHub uses when no explicit name is set.
function contextOf(jobs, id) {
  return jobs[id].name || id;
}

export function checkWorkflowWiring(workflowFiles, requiredChecks) {
  const problems = [];
  const requiredSet = new Set(requiredChecks.required || []);
  const exemptSet = new Set(
    (requiredChecks.exempt || []).map((e) => `${e.workflow}::${e.job}`),
  );

  for (const { file, doc } of workflowFiles) {
    const jobIds = Object.keys(doc.jobs);

    const protectedIds = new Set(
      jobIds.filter((id) => requiredSet.has(contextOf(doc.jobs, id))),
    );
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of jobIds) {
        if (protectedIds.has(id)) continue;
        const neededByProtected = jobIds.some(
          (other) =>
            protectedIds.has(other) && doc.jobs[other].needs.includes(id),
        );
        if (neededByProtected) {
          protectedIds.add(id);
          grew = true;
        }
      }
    }

    if (!doc.triggers.includes("pull_request")) continue;

    for (const id of jobIds) {
      if (protectedIds.has(id)) continue;
      if (exemptSet.has(`${file}::${id}`)) continue;
      problems.push(
        `${file}:${id} triggers on pull_request but is not reachable from a ` +
          `required check (${[...requiredSet].sort().join(", ")}) and has no ` +
          `exemption in .github/required-checks.yml`,
      );
    }
  }

  return problems;
}

// A tiny, purpose-built loader for required-checks.yml's own shape:
//   required:
//     - CI
//     - commit-format
//   exempt:
//     - workflow: codeql.yml
//       job: analyze
//       reason: >-
//         ...
export function parseRequiredChecks(text) {
  const lines = text.split("\n");
  const top = parseFlatMapping(lines, 0);
  const requiredEntry = top.find((e) => e.key === "required");
  const exemptEntry = top.find((e) => e.key === "exempt");

  const required = requiredEntry
    ? requiredEntry.body
        .filter(isContent)
        .map((l) => l.match(/^\s*-\s*(.+?)\s*$/))
        .filter(Boolean)
        .map((m) => stripQuotes(m[1]))
    : [];

  const exempt = [];
  if (exemptEntry) {
    const indent = firstContentIndent(exemptEntry.body);
    if (indent !== null) {
      let current = null;
      // A `reason:` long enough to need wrapping is written as a block scalar
      // (`>-`), so its text lives on the *following* lines. Reading only the
      // `reason:` line would store the "&gt;-" indicator as the reason and drop
      // every word of the justification — and the justification is the entire
      // point of an exemption, since it is what a reviewer weighs when asking
      // whether a job should really be outside the merge gate.
      let block = null;
      const closeBlock = () => {
        if (!block) return;
        // `>` folds line breaks into spaces, `|` keeps them.
        const text = block.fold
          ? block.lines.join(" ").replace(/\s+/g, " ")
          : block.lines.join("\n");
        if (current) current[block.key] = text.trim();
        block = null;
      };

      for (const line of exemptEntry.body) {
        if (block) {
          const bIndent = line.match(/^(\s*)/)[1].length;
          if (line.trim() === "" || bIndent >= block.indent) {
            block.lines.push(line.trim());
            continue;
          }
          closeBlock();
        }
        if (!isContent(line)) continue;
        const lineIndent = line.match(/^(\s*)/)[1].length;

        const record = (key, value, keyIndent) => {
          const v = value.trim();
          if (/^[|>][-+]?\d*$/.test(v)) {
            block = {
              key,
              indent: keyIndent + 1,
              lines: [],
              fold: v[0] === ">",
            };
          } else {
            current[key] = stripQuotes(v);
          }
        };

        if (lineIndent === indent && /^\s*-\s/.test(line)) {
          if (current) exempt.push(current);
          current = {};
          const rest = line.replace(/^\s*-\s*/, "");
          const m = rest.match(/^([^:\s][^:]*):\s*(.*)$/);
          if (m) record(m[1].trim(), m[2], line.indexOf(rest));
          continue;
        }
        const m = line.match(/^\s*([^:\s][^:]*):\s*(.*)$/);
        if (m && current) record(m[1].trim(), m[2], lineIndent);
      }
      closeBlock();
      if (current) exempt.push(current);
    }
  }

  return { required, exempt };
}

function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const workflowsDir = path.resolve(
    repoRoot,
    process.argv[2] || ".github/workflows",
  );
  const requiredChecksFile = path.resolve(
    repoRoot,
    process.argv[3] || ".github/required-checks.yml",
  );

  const workflowFiles = readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort()
    .map((file) => ({
      file,
      doc: parseWorkflow(readFileSync(path.join(workflowsDir, file), "utf8")),
    }));

  const requiredChecks = parseRequiredChecks(
    readFileSync(requiredChecksFile, "utf8"),
  );

  const problems = checkWorkflowWiring(workflowFiles, requiredChecks);
  if (problems.length > 0) {
    console.error(`${problems.length} workflow-wiring problem(s) found:\n`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log(
    `${workflowFiles.length} workflow file(s) checked; every pull_request-triggered ` +
      "job is wired into a required check or explicitly exempt.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
