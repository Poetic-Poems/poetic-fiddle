import { describe, expect, it, vi } from "vitest";
import {
  CANARY_PACKAGE,
  CANARY_VERSION,
  evaluateDependencyAudit,
  hasHighOrCriticalVulnerability,
  vulnerabilityCounts,
} from "./check-dependency-audit.mjs";

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
