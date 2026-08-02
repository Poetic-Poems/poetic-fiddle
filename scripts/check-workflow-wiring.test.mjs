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
});
