import { describe, expect, it, vi } from "vitest";
import {
  allBracesInstancesAreDevOnly,
  applySuppressedAdvisoryException,
  CANARY_PACKAGE,
  CANARY_VERSION,
  evaluateDependencyAudit,
  hasHighOrCriticalVulnerability,
  runNpmAudit,
  SUPPRESSED_ADVISORY_GHSA,
  unusableReportReason,
  vulnerabilityCounts,
} from "./check-dependency-audit.mjs";

// A minimal, realistic shape of `npm audit --json`'s `vulnerabilities`
// object for the braces chain this exception targets: braces carries the
// advisory itself, and each dependent is "high" purely because it depends
// on the one below it, with no advisory of its own.
function bracesAdvisoryEntry(fixAvailable) {
  return {
    name: "braces",
    severity: "high",
    via: [
      {
        source: 1240992,
        name: "braces",
        dependency: "braces",
        title:
          "braces vulnerable to stack-exhaustion denial of service through deeply nested patterns",
        url: `https://github.com/advisories/${SUPPRESSED_ADVISORY_GHSA}`,
        severity: "high",
        range: "<=3.0.3",
      },
    ],
    fixAvailable,
  };
}

function bracesChainVulnerabilities(fixAvailable = false) {
  return {
    braces: bracesAdvisoryEntry(fixAvailable),
    micromatch: { name: "micromatch", severity: "high", via: ["braces"] },
    "fast-glob": {
      name: "fast-glob",
      severity: "high",
      via: ["micromatch"],
    },
    "@next/eslint-plugin-next": {
      name: "@next/eslint-plugin-next",
      severity: "high",
      via: ["fast-glob"],
    },
    "eslint-config-next": {
      name: "eslint-config-next",
      severity: "high",
      via: ["@next/eslint-plugin-next"],
    },
  };
}

function devOnlyBracesLock() {
  return {
    packages: { "node_modules/braces": { version: "3.0.3", dev: true } },
  };
}

// What `npm audit --json` writes to stdout when the audit itself fails: an
// error object in place of a report, with no `metadata` at all.
function errorJson(code = "ENOAUDIT", summary = "registry did not answer") {
  return { error: { code, summary, detail: "" } };
}

function auditJson(overrides = {}) {
  return {
    metadata: {
      vulnerabilities: {
        info: 0,
        low: 0,
        moderate: 0,
        high: 0,
        critical: 0,
        ...overrides,
      },
    },
  };
}

describe("vulnerabilityCounts", () => {
  it("reads high and critical counts from a well-formed report", () => {
    expect(vulnerabilityCounts(auditJson({ high: 1, critical: 2 }))).toEqual({
      high: 1,
      critical: 2,
    });
  });

  it("defaults to zero when metadata is missing", () => {
    expect(vulnerabilityCounts({})).toEqual({ high: 0, critical: 0 });
  });
});

describe("hasHighOrCriticalVulnerability", () => {
  it("is false for a clean report", () => {
    expect(hasHighOrCriticalVulnerability(auditJson())).toBe(false);
  });

  it("is true when high is non-zero", () => {
    expect(hasHighOrCriticalVulnerability(auditJson({ high: 1 }))).toBe(true);
  });

  it("is true when critical is non-zero", () => {
    expect(hasHighOrCriticalVulnerability(auditJson({ critical: 1 }))).toBe(
      true,
    );
  });

  it("is true for a moderate-only report at the threshold that used to pass", () => {
    // This is exactly the shape the real incident's second run reported for
    // dompurify (moderate only) — it must NOT be treated as high/critical,
    // it must simply not gate on its own. Verified separately below.
    expect(hasHighOrCriticalVulnerability(auditJson({ moderate: 1 }))).toBe(
      false,
    );
  });
});

describe("unusableReportReason", () => {
  it("is null for a well-formed report", () => {
    expect(unusableReportReason(auditJson())).toBeNull();
  });

  it("names the error code when npm audit errored instead of reporting", () => {
    expect(unusableReportReason(errorJson("ENOLOCK"))).toContain("ENOLOCK");
  });

  it("flags a report with no vulnerability counts", () => {
    expect(unusableReportReason({})).toContain("no vulnerability counts");
    expect(unusableReportReason({ metadata: {} })).toContain(
      "no vulnerability counts",
    );
  });
});

describe("evaluateDependencyAudit", () => {
  it("fails immediately on a genuine high-severity advisory, without consulting the canary", () => {
    const getCanaryAuditJson = vi.fn(() => auditJson({ high: 1 }));

    const result = evaluateDependencyAudit(
      auditJson({ high: 1 }),
      getCanaryAuditJson,
    );

    expect(result.pass).toBe(false);
    expect(getCanaryAuditJson).not.toHaveBeenCalled();
  });

  it("fails immediately on a genuine critical-severity advisory", () => {
    const getCanaryAuditJson = vi.fn(() => auditJson({ high: 1 }));

    const result = evaluateDependencyAudit(
      auditJson({ critical: 1 }),
      getCanaryAuditJson,
    );

    expect(result.pass).toBe(false);
    expect(getCanaryAuditJson).not.toHaveBeenCalled();
  });

  it("fails a clean report when the canary audit is also empty (the untrustworthy-endpoint case)", () => {
    const getCanaryAuditJson = vi.fn(() => auditJson());

    const result = evaluateDependencyAudit(auditJson(), getCanaryAuditJson);

    expect(result.pass).toBe(false);
    expect(getCanaryAuditJson).toHaveBeenCalledOnce();
    expect(result.message).toContain(CANARY_PACKAGE);
    expect(result.message).toContain(CANARY_VERSION);
  });

  it("passes a clean report when the canary audit correctly reports its own advisory", () => {
    const getCanaryAuditJson = vi.fn(() => auditJson({ high: 1 }));

    const result = evaluateDependencyAudit(auditJson(), getCanaryAuditJson);

    expect(result.pass).toBe(true);
    expect(getCanaryAuditJson).toHaveBeenCalledOnce();
  });

  it("fails when npm audit errored instead of producing a report, however healthy the canary", () => {
    // An errored audit has no `metadata`, so counting advisories in it yields
    // zero and looks exactly like a clean tree — the gate must not pass on a
    // tree it never actually audited.
    const getCanaryAuditJson = vi.fn(() => auditJson({ high: 1 }));

    const result = evaluateDependencyAudit(
      errorJson("ENOAUDIT"),
      getCanaryAuditJson,
    );

    expect(result.pass).toBe(false);
    expect(result.message).toContain("ENOAUDIT");
    expect(getCanaryAuditJson).not.toHaveBeenCalled();
  });

  it("fails a clean report when the canary audit errored rather than answering", () => {
    const getCanaryAuditJson = vi.fn(() => errorJson("ENOAUDIT"));

    const result = evaluateDependencyAudit(auditJson(), getCanaryAuditJson);

    expect(result.pass).toBe(false);
    expect(result.message).toContain("ENOAUDIT");
  });

  it("passes a report containing only lower-severity advisories, confirmed by the canary", () => {
    const getCanaryAuditJson = vi.fn(() => auditJson({ high: 1 }));

    const result = evaluateDependencyAudit(
      auditJson({ moderate: 1 }),
      getCanaryAuditJson,
    );

    expect(result.pass).toBe(true);
    expect(getCanaryAuditJson).toHaveBeenCalledOnce();
  });
});

describe("runNpmAudit", () => {
  it("parses the JSON npm audit wrote to stdout on a clean run", () => {
    const execFile = vi.fn(() => JSON.stringify(auditJson()));

    expect(runNpmAudit("/some/project", execFile)).toEqual(auditJson());
    expect(execFile).toHaveBeenCalledWith(
      "npm",
      ["audit", "--json"],
      expect.objectContaining({ cwd: "/some/project" }),
    );
  });

  it("reads the report off the thrown error's stdout when npm audit exits non-zero for finding advisories", () => {
    // This is the behaviour the whole script depends on: npm audit's exit
    // code alone can't be trusted, since it's non-zero for the routine case
    // of "found an advisory" too.
    const report = auditJson({ high: 1 });
    const execFile = vi.fn(() => {
      const err = new Error("Command failed");
      err.stdout = JSON.stringify(report);
      throw err;
    });

    expect(runNpmAudit("/some/project", execFile)).toEqual(report);
  });

  it("throws when npm audit fails with no stdout at all", () => {
    const execFile = vi.fn(() => {
      const err = new Error("npm not found");
      err.stdout = "";
      throw err;
    });

    expect(() => runNpmAudit("/some/project", execFile)).toThrow(
      /npm audit produced no output/,
    );
  });
});

describe("allBracesInstancesAreDevOnly", () => {
  it("is true when the only braces entry is a dev dependency", () => {
    expect(allBracesInstancesAreDevOnly(devOnlyBracesLock())).toBe(true);
  });

  it("is false when braces is a production dependency", () => {
    expect(
      allBracesInstancesAreDevOnly({
        packages: { "node_modules/braces": { version: "3.0.3" } },
      }),
    ).toBe(false);
  });

  it("is false when any nested braces instance is not dev-only", () => {
    expect(
      allBracesInstancesAreDevOnly({
        packages: {
          "node_modules/braces": { version: "3.0.3", dev: true },
          "node_modules/some-prod-tool/node_modules/braces": {
            version: "2.3.2",
          },
        },
      }),
    ).toBe(false);
  });

  it("is false when package-lock.json carries no braces entry at all", () => {
    expect(allBracesInstancesAreDevOnly({ packages: {} })).toBe(false);
  });
});

describe("applySuppressedAdvisoryException", () => {
  it("suppresses the whole braces chain when no non-breaking fix exists and braces is dev-only", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities(false),
    };

    const { auditJson: adjusted, suppressed } =
      applySuppressedAdvisoryException(auditJson, devOnlyBracesLock());

    expect(suppressed.sort()).toEqual(
      [
        "braces",
        "micromatch",
        "fast-glob",
        "@next/eslint-plugin-next",
        "eslint-config-next",
      ].sort(),
    );
    expect(vulnerabilityCounts(adjusted)).toEqual({ high: 0, critical: 0 });
  });

  it("suppresses the chain when the only fix is a semver-major bump of a different package", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities({
        name: "eslint-config-next",
        version: "14.2.35",
        isSemVerMajor: true,
      }),
    };

    const { suppressed } = applySuppressedAdvisoryException(
      auditJson,
      devOnlyBracesLock(),
    );

    expect(suppressed).not.toEqual([]);
  });

  it("does not suppress anything once a non-breaking braces fix is available (fixAvailable: true)", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities(true),
    };

    const { auditJson: adjusted, suppressed } =
      applySuppressedAdvisoryException(auditJson, devOnlyBracesLock());

    expect(suppressed).toEqual([]);
    expect(adjusted).toBe(auditJson);
  });

  it("does not suppress anything once a non-breaking fix exists via another package (isSemVerMajor: false)", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities({
        name: "micromatch",
        version: "5.0.0",
        isSemVerMajor: false,
      }),
    };

    const { suppressed } = applySuppressedAdvisoryException(
      auditJson,
      devOnlyBracesLock(),
    );

    expect(suppressed).toEqual([]);
  });

  it("does not suppress anything when braces has reached a production dependency", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities(false),
    };

    const { suppressed } = applySuppressedAdvisoryException(auditJson, {
      packages: { "node_modules/braces": { version: "3.0.3" } },
    });

    expect(suppressed).toEqual([]);
  });

  it("does not suppress braces if it also carries an unrelated advisory", () => {
    const vulnerabilities = bracesChainVulnerabilities(false);
    vulnerabilities.braces.via.push({
      source: 9999999,
      name: "braces",
      url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
      severity: "high",
      range: "<=3.0.3",
    });
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities,
    };

    const { suppressed } = applySuppressedAdvisoryException(
      auditJson,
      devOnlyBracesLock(),
    );

    expect(suppressed).toEqual([]);
  });

  it("does not suppress a package that carries both the inherited chain and an advisory of its own", () => {
    const vulnerabilities = bracesChainVulnerabilities(false);
    vulnerabilities["fast-glob"] = {
      name: "fast-glob",
      severity: "high",
      via: [
        "micromatch",
        {
          source: 1234567,
          name: "fast-glob",
          url: "https://github.com/advisories/GHSA-zzzz-yyyy-xxxx",
          severity: "high",
          range: "<3.0.0",
        },
      ],
    };
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities,
    };

    const { suppressed } = applySuppressedAdvisoryException(
      auditJson,
      devOnlyBracesLock(),
    );

    expect(suppressed).not.toContain("fast-glob");
    // fast-glob's own advisory also blocks anything depending on it from
    // being suppressed, since it is no longer "high" purely by inheritance.
    expect(suppressed).not.toContain("@next/eslint-plugin-next");
    expect(suppressed).not.toContain("eslint-config-next");
  });

  it("does nothing when braces does not appear in the report at all", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 0, critical: 0 } },
      vulnerabilities: {},
    };

    const { auditJson: adjusted, suppressed } =
      applySuppressedAdvisoryException(auditJson, devOnlyBracesLock());

    expect(suppressed).toEqual([]);
    expect(adjusted).toBe(auditJson);
  });

  it("lets a suppressed-clean report pass evaluateDependencyAudit via the canary path", () => {
    const auditJson = {
      metadata: { vulnerabilities: { high: 5, critical: 0 } },
      vulnerabilities: bracesChainVulnerabilities(false),
    };

    const { auditJson: adjusted } = applySuppressedAdvisoryException(
      auditJson,
      devOnlyBracesLock(),
    );

    const getCanaryAuditJson = vi.fn(() => ({
      metadata: { vulnerabilities: { high: 1, critical: 0 } },
    }));
    const result = evaluateDependencyAudit(adjusted, getCanaryAuditJson);

    expect(result.pass).toBe(true);
  });
});
