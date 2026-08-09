import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkWorkflowWiring,
  parseRequiredChecks,
  parseWorkflow,
} from "./check-workflow-wiring.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function loadRepoWorkflows() {
  const dir = path.join(repoRoot, ".github/workflows");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((file) => ({
      file,
      doc: parseWorkflow(readFileSync(path.join(dir, file), "utf8")),
    }));
}

function loadRepoRequiredChecks() {
  return parseRequiredChecks(
    readFileSync(path.join(repoRoot, ".github/required-checks.yml"), "utf8"),
  );
}

describe("parseWorkflow", () => {
  it("reads triggers from a mapping-style on:, and needs/name per job", () => {
    const doc = parseWorkflow(
      [
        "name: Example",
        "on:",
        "  push:",
        "    branches: [main]",
        "  pull_request:",
        "jobs:",
        "  a:",
        "    runs-on: ubuntu-latest",
        "  b:",
        "    name: Job B",
        "    needs: a",
        "  c:",
        "    needs: [a, b]",
        "",
      ].join("\n"),
    );

    expect(doc.triggers.sort()).toEqual(["pull_request", "push"]);
    expect(doc.jobs.a).toEqual({ name: null, needs: [] });
    expect(doc.jobs.b).toEqual({ name: "Job B", needs: ["a"] });
    expect(doc.jobs.c).toEqual({ name: null, needs: ["a", "b"] });
  });

  it("reads a block-list needs:", () => {
    const doc = parseWorkflow(
      [
        "on: pull_request",
        "jobs:",
        "  d:",
        "    needs:",
        "      - a",
        "      - b",
        "",
      ].join("\n"),
    );

    expect(doc.jobs.d.needs).toEqual(["a", "b"]);
  });

  it("reads a scalar on: trigger", () => {
    const doc = parseWorkflow(
      ["on: pull_request", "jobs:", "  a: {}", ""].join("\n"),
    );
    expect(doc.triggers).toEqual(["pull_request"]);
  });

  // Each of the three below used to make a pull_request-triggered workflow
  // parse as untriggered or job-less, which this check treats as "nothing to
  // see here" — a silent pass over exactly the ungated workflow it exists to
  // catch. They are false *negatives*, so no failing run would reveal them.
  it('reads the quoted "on": key, which YAML 1.1 linters recommend', () => {
    // Bare `on` is the boolean true in YAML 1.1, so quoting it is a common
    // convention — and Prettier leaves the quotes alone.
    for (const key of ['"on"', "'on'"]) {
      const doc = parseWorkflow(
        [
          `${key}:`,
          "  pull_request:",
          "jobs:",
          "  a:",
          "    runs-on: x",
          "",
        ].join("\n"),
      );
      expect(doc.triggers).toEqual(["pull_request"]);
      expect(Object.keys(doc.jobs)).toEqual(["a"]);
    }
  });

  it("ignores comments when working out a block's indentation", () => {
    const doc = parseWorkflow(
      [
        "on:",
        "    # A comment indented differently to the triggers below.",
        "  pull_request:",
        "jobs:",
        "      # note: a comment is not a job",
        "  a:",
        "    runs-on: x",
        "",
      ].join("\n"),
    );

    expect(doc.triggers).toEqual(["pull_request"]);
    expect(Object.keys(doc.jobs)).toEqual(["a"]);
  });

  it("strips quotes from a quoted job id", () => {
    const doc = parseWorkflow(
      ["on: pull_request", "jobs:", '  "a":', "    runs-on: x", ""].join("\n"),
    );
    expect(Object.keys(doc.jobs)).toEqual(["a"]);
  });
});

describe("checkWorkflowWiring", () => {
  const requiredChecks = { required: ["CI"], exempt: [] };

  it("passes a job reachable via needs from a required job", () => {
    const workflowFiles = [
      {
        file: "ci.yml",
        doc: {
          triggers: ["pull_request"],
          jobs: {
            build: { name: null, needs: [] },
            ci: { name: "CI", needs: ["build"] },
          },
        },
      },
    ];

    expect(checkWorkflowWiring(workflowFiles, requiredChecks)).toEqual([]);
  });

  it("passes an exempted job that is otherwise unreachable", () => {
    const workflowFiles = [
      {
        file: "codeql.yml",
        doc: {
          triggers: ["pull_request"],
          jobs: { analyze: { name: null, needs: [] } },
        },
      },
    ];

    expect(
      checkWorkflowWiring(workflowFiles, {
        required: ["CI"],
        exempt: [{ workflow: "codeql.yml", job: "analyze" }],
      }),
    ).toEqual([]);
  });

  it("flags a pull_request job that is neither reachable nor exempt", () => {
    const workflowFiles = [
      {
        file: "demo-bad.yml",
        doc: {
          triggers: ["pull_request"],
          jobs: { "lint-demo": { name: null, needs: [] } },
        },
      },
    ];

    const problems = checkWorkflowWiring(workflowFiles, requiredChecks);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/demo-bad\.yml:lint-demo/);
  });

  // `pull_request_target` and `merge_group` jobs run against a pull request
  // just as `pull_request` ones do; leaving them unrecognised would let a
  // job on either ship ungated — the exact drift class this check exists to
  // catch, one trigger keyword away.
  it("flags an unwired job on pull_request_target or merge_group too", () => {
    for (const trigger of ["pull_request_target", "merge_group"]) {
      const workflowFiles = [
        {
          file: "queue.yml",
          doc: {
            triggers: [trigger],
            jobs: { gate: { name: null, needs: [] } },
          },
        },
      ];

      const problems = checkWorkflowWiring(workflowFiles, requiredChecks);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(
        new RegExp(`queue\\.yml:gate triggers on ${trigger}`),
      );
    }
  });

  // The required/exempt match is name-based, so without this a new workflow
  // could count itself protected just by naming a job `CI` — while on
  // GitHub's side, which of the two same-named check runs satisfies the
  // requirement is ambiguous.
  it("flags two jobs carrying the same required context, whatever their triggers", () => {
    for (const triggers of [["pull_request"], ["push"]]) {
      const workflowFiles = [
        {
          file: "ci.yml",
          doc: {
            triggers: ["pull_request"],
            jobs: { ci: { name: "CI", needs: [] } },
          },
        },
        {
          file: "sneaky.yml",
          doc: {
            triggers,
            jobs: { impostor: { name: "CI", needs: [] } },
          },
        },
      ];

      const problems = checkWorkflowWiring(workflowFiles, requiredChecks);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/required check "CI" is carried by 2 jobs/);
      expect(problems[0]).toMatch(/ci\.yml:ci/);
      expect(problems[0]).toMatch(/sneaky\.yml:impostor/);
    }
  });

  it("ignores jobs in a workflow that never triggers on pull_request", () => {
    const workflowFiles = [
      {
        file: "release.yml",
        doc: {
          triggers: ["push"],
          jobs: { release: { name: null, needs: [] } },
        },
      },
    ];

    expect(checkWorkflowWiring(workflowFiles, requiredChecks)).toEqual([]);
  });

  it("finds no problems across this repo's actual workflow files", () => {
    const workflowFiles = loadRepoWorkflows();
    const requiredChecksFromFile = loadRepoRequiredChecks();

    expect(checkWorkflowWiring(workflowFiles, requiredChecksFromFile)).toEqual(
      [],
    );
  });
});

describe("parseRequiredChecks", () => {
  it("reads required and exempt lists", () => {
    const parsed = parseRequiredChecks(
      [
        "required:",
        "  - CI",
        "  - commit-format",
        "exempt:",
        "  - workflow: codeql.yml",
        "    job: analyze",
        "    reason: advisory only",
        "",
      ].join("\n"),
    );

    expect(parsed.required).toEqual(["CI", "commit-format"]);
    expect(parsed.exempt).toEqual([
      { workflow: "codeql.yml", job: "analyze", reason: "advisory only" },
    ]);
  });

  // A reason long enough to be worth reading is long enough to need wrapping,
  // so the block-scalar form is the one real entries use. Reading only the
  // `reason:` line stores the ">-" indicator and drops the justification.
  it("reads a folded block-scalar reason", () => {
    const parsed = parseRequiredChecks(
      [
        "required:",
        "  - CI",
        "exempt:",
        "  - workflow: codeql.yml",
        "    job: analyze",
        "    reason: >-",
        "      Advisory by design: findings post to the Security tab",
        "      rather than blocking a merge.",
        "",
      ].join("\n"),
    );

    expect(parsed.exempt).toEqual([
      {
        workflow: "codeql.yml",
        job: "analyze",
        reason:
          "Advisory by design: findings post to the Security tab rather than blocking a merge.",
      },
    ]);
  });

  it("gives every exemption in the checked-in file a readable reason", () => {
    for (const entry of loadRepoRequiredChecks().exempt) {
      expect(entry.workflow).toBeTruthy();
      expect(entry.job).toBeTruthy();
      expect(entry.reason ?? "").toMatch(/[a-z]{4}/);
    }
  });
});

describe("--print-required", () => {
  // required-checks-drift.yml compares this output line-for-line against the
  // live branch rules, so its shape — one context per line, de-duplicated,
  // codepoint-sorted like jq's `unique` — is a contract, not a formatting
  // nicety.
  it("prints the sorted required: list, one context per line", () => {
    const out = execFileSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts/check-workflow-wiring.mjs"),
        "--print-required",
      ],
      { encoding: "utf8" },
    );

    const expected = [...new Set(loadRepoRequiredChecks().required)].sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(out.split("\n").filter(Boolean)).toEqual(expected);
  });
});
