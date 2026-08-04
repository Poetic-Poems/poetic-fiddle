import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWLIST,
  PASSWORD_REQUIREMENTS_CHAR_CLASSES,
  buildAuthDriftReport,
  checkSupabaseAuthDrift,
  parseConfigToml,
  parseDurationSeconds,
} from "./check-supabase-auth-drift.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// A minimal config.toml covering every path ALLOWLIST reads, with values
// matching the table in TD-PPpfid-26080301.
const MATCHING_CONFIG_TOML = `
[auth]
enabled = true
minimum_password_length = 10
password_requirements = ""
enable_signup = true
enable_anonymous_sign_ins = false
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
secure_password_change = false
max_frequency = "1s"
otp_length = 6
otp_expiry = 3600

[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false
`;

// The live API's shape for the config above — every field ALLOWLIST reads,
// agreeing with MATCHING_CONFIG_TOML once inversion/duration normalisation
// is applied.
const MATCHING_LIVE_CONFIG = {
  password_min_length: 10,
  // The live Management API reads back `null` here rather than `""` for a
  // project whose dashboard field was never explicitly saved, even though it
  // enforces the same "no required character classes" as config.toml's `""`
  // — see ALLOWLIST's `liveNullEquals` comment.
  password_required_characters: null,
  disable_signup: false, // inverted: config's enable_signup = true
  external_anonymous_users_enabled: false,
  jwt_exp: 3600,
  refresh_token_rotation_enabled: true,
  security_refresh_token_reuse_interval: 10,
  external_email_enabled: true,
  mailer_secure_email_change_enabled: true,
  mailer_autoconfirm: true, // inverted: config's enable_confirmations = false
  security_update_password_require_reauthentication: false,
  smtp_max_frequency: 1, // "1s" normalised to seconds
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  mfa_max_enrolled_factors: 10,
  mfa_totp_enroll_enabled: false,
  mfa_totp_verify_enabled: false,
  mfa_phone_enroll_enabled: false,
  mfa_phone_verify_enabled: false,
  // Fields no ALLOWLIST entry names — must never affect the report.
  site_url: "https://example.com",
  smtp_admin_email: "admin@example.com",
};

describe("parseConfigToml", () => {
  it("reads nested sections and scalar types", () => {
    const config = parseConfigToml(MATCHING_CONFIG_TOML);
    expect(config.auth.minimum_password_length).toBe(10);
    expect(config.auth.password_requirements).toBe("");
    expect(config.auth.enable_signup).toBe(true);
    expect(config.auth.email.max_frequency).toBe("1s");
    expect(config.auth.mfa.totp.enroll_enabled).toBe(false);
    expect(config.auth.mfa.phone.verify_enabled).toBe(false);
  });

  it("ignores whole-line comments and blank lines", () => {
    const config = parseConfigToml(
      ["# a comment", "", "[auth]", "# another", "jwt_expiry = 3600", ""].join(
        "\n",
      ),
    );
    expect(config.auth.jwt_expiry).toBe(3600);
  });
});

describe("parseDurationSeconds", () => {
  it("parses second/minute/hour/day suffixes", () => {
    expect(parseDurationSeconds("1s")).toBe(1);
    expect(parseDurationSeconds("5m")).toBe(300);
    expect(parseDurationSeconds("2h")).toBe(7200);
    expect(parseDurationSeconds("1d")).toBe(86400);
  });

  it("passes a bare number through unchanged", () => {
    expect(parseDurationSeconds(42)).toBe(42);
  });

  it("throws on an unparsable value", () => {
    expect(() => parseDurationSeconds("soon")).toThrow(/duration/);
  });
});

describe("buildAuthDriftReport", () => {
  it("reports no problems when every allowlisted key agrees", () => {
    const problems = buildAuthDriftReport(
      MATCHING_CONFIG_TOML,
      MATCHING_LIVE_CONFIG,
    );
    expect(problems).toEqual([]);
  });

  it("reports a plain mismatch", () => {
    const live = { ...MATCHING_LIVE_CONFIG, jwt_exp: 7200 };
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, live);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.jwt_expiry/);
  });

  it("compares an inverted pair correctly, both when it agrees and when it drifts", () => {
    const drifted = { ...MATCHING_LIVE_CONFIG, disable_signup: true };
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, drifted);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.enable_signup/);
  });

  it('treats a null live password_required_characters as matching config.toml\'s ""', () => {
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, {
      ...MATCHING_LIVE_CONFIG,
      password_required_characters: null,
    });
    expect(problems).toEqual([]);
  });

  it("still flags a genuine password_requirements mismatch", () => {
    const drifted = {
      ...MATCHING_LIVE_CONFIG,
      password_required_characters:
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
    };
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, drifted);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.password_requirements/);
  });

  it("compares a duration-string key against the live integer-seconds field", () => {
    const drifted = { ...MATCHING_LIVE_CONFIG, smtp_max_frequency: 5 };
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, drifted);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.email\.max_frequency/);
  });

  it("flags every disagreement across multiple keys, not just the first", () => {
    const drifted = {
      ...MATCHING_LIVE_CONFIG,
      mfa_totp_enroll_enabled: true,
      mailer_otp_length: 4,
    };
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, drifted);
    expect(problems).toHaveLength(2);
  });

  it("never reads or reports fields outside ALLOWLIST", () => {
    const withNoise = {
      ...MATCHING_LIVE_CONFIG,
      site_url: "https://not-the-real-site.example",
      some_unrelated_field: "whatever",
    };
    expect(buildAuthDriftReport(MATCHING_CONFIG_TOML, withNoise)).toEqual([]);
  });

  it("reports a missing live field by name instead of silently passing", () => {
    const withoutOne = { ...MATCHING_LIVE_CONFIG };
    delete withoutOne.password_min_length;
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, withoutOne);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/password_min_length/);
  });

  it("accepts a stringified integer on every numeric-flagged row", () => {
    const numericRows = ALLOWLIST.filter((entry) => entry.numeric);
    // Guards against a future edit dropping `numeric` from a row silently —
    // this test would then just cover fewer rows without failing.
    expect(numericRows.length).toBe(7);

    for (const entry of numericRows) {
      const live = {
        ...MATCHING_LIVE_CONFIG,
        [entry.apiField]: String(MATCHING_LIVE_CONFIG[entry.apiField]),
      };
      const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, live);
      expect(problems).toEqual([]);
    }
  });

  it("rejects a near-miss stringified number on a numeric-flagged row", () => {
    const nearMisses = [
      "3600.0",
      " 3600",
      "3600 ",
      "3600abc",
      "0x3600",
      "+3600",
    ];
    for (const nearMiss of nearMisses) {
      const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, {
        ...MATCHING_LIVE_CONFIG,
        jwt_exp: nearMiss,
      });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/auth\.jwt_expiry/);
    }
  });

  it("rejects a stringified number on a non-numeric-flagged row", () => {
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, {
      ...MATCHING_LIVE_CONFIG,
      // enable_anonymous_sign_ins has no `numeric` flag, and isn't a numeric
      // field to begin with (it's boolean) — a stringified value must not be
      // coerced into matching.
      external_anonymous_users_enabled: "false",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.enable_anonymous_sign_ins/);
  });

  it("still flags a genuine numeric disagreement on a numeric-flagged row", () => {
    const problems = buildAuthDriftReport(MATCHING_CONFIG_TOML, {
      ...MATCHING_LIVE_CONFIG,
      jwt_exp: "7200",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/auth\.jwt_expiry/);
  });

  it("matches every non-empty symbolic password_requirements value against its live character-class literal", () => {
    for (const [symbol, charClass] of Object.entries(
      PASSWORD_REQUIREMENTS_CHAR_CLASSES,
    )) {
      if (symbol === "") continue;
      const configText = MATCHING_CONFIG_TOML.replace(
        'password_requirements = ""',
        `password_requirements = "${symbol}"`,
      );
      const problems = buildAuthDriftReport(configText, {
        ...MATCHING_LIVE_CONFIG,
        password_required_characters: charClass,
      });
      expect(problems).toEqual([]);
    }
  });

  it("throws naming the value when password_requirements holds an unrecognised symbol", () => {
    const configText = MATCHING_CONFIG_TOML.replace(
      'password_requirements = ""',
      'password_requirements = "digits_only"',
    );
    expect(() =>
      buildAuthDriftReport(configText, MATCHING_LIVE_CONFIG),
    ).toThrow(/password_requirements.*digits_only/s);
  });

  it("has an ALLOWLIST entry that resolves in the repo's own config.toml", () => {
    const configText = readFileSync(
      path.join(repoRoot, "supabase/config.toml"),
      "utf8",
    );
    // Comparing against MATCHING_LIVE_CONFIG here would just restate the
    // ALLOWLIST table; this only asserts every path actually resolves against
    // the real file, so a renamed/removed key in config.toml fails a unit
    // test instead of only the live, network-dependent check.
    expect(() =>
      buildAuthDriftReport(configText, MATCHING_LIVE_CONFIG),
    ).not.toThrow();
    expect(ALLOWLIST.length).toBeGreaterThan(0);
  });
});

describe("checkSupabaseAuthDrift", () => {
  it("throws a clear error when the token is unset", async () => {
    await expect(
      checkSupabaseAuthDrift({
        configText: MATCHING_CONFIG_TOML,
        token: undefined,
        projectRef: "ref",
        fetchImpl: () => {
          throw new Error("fetch should never be called without a token");
        },
      }),
    ).rejects.toThrow(/SUPABASE_ACCESS_TOKEN/);
  });

  it("throws a clear error on a non-2xx Management API response", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "invalid token",
    });

    await expect(
      checkSupabaseAuthDrift({
        configText: MATCHING_CONFIG_TOML,
        token: "bad-token",
        projectRef: "ref",
        fetchImpl,
      }),
    ).rejects.toThrow(/401/);
  });

  it("fetches the live config from the given project ref with a bearer token, and returns the report", async () => {
    let requestedUrl;
    let requestedHeaders;
    const fetchImpl = async (url, init) => {
      requestedUrl = url;
      requestedHeaders = init.headers;
      return {
        ok: true,
        json: async () => MATCHING_LIVE_CONFIG,
      };
    };

    const problems = await checkSupabaseAuthDrift({
      configText: MATCHING_CONFIG_TOML,
      token: "test-token",
      projectRef: "my-project-ref",
      fetchImpl,
    });

    expect(problems).toEqual([]);
    expect(requestedUrl).toBe(
      "https://api.supabase.com/v1/projects/my-project-ref/config/auth",
    );
    expect(requestedHeaders).toEqual({ Authorization: "Bearer test-token" });
  });
});
