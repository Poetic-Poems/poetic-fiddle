#!/usr/bin/env node
// check-supabase-auth-drift.mjs
//
// TD-PPpfid-26080301: supabase/config.toml's [auth] block only ever reaches
// the *local* Supabase stack that `supabase start` brings up — the live
// project's equivalents are dashboard settings that no commit here can
// change, and nothing used to notice when the two disagreed. This asserts
// them against each other; it never pushes. The maintainer settled that
// choice in https://github.com/Poetic-Poems/poetic-fiddle/issues/198#issuecomment-5164921286:
// the dashboard stays authoritative, and a red run means a human decides
// which side is right, rather than CI silently overwriting one of them.
// Pushing config.toml as a whole was rejected there too — it carries
// local-stack-only values (site_url, redirect URLs, SMTP, OAuth secrets)
// that must never land on the live project, so only the keys below, each
// individually reviewed against its live-API counterpart, are read or
// compared. Anything else in config.toml's [auth] tree — including every
// key above — is silently ignored, not just unreported: ALLOWLIST is the
// only path any value is read from.
//
// Reads supabase/config.toml with a small hand-rolled parser rather than a
// TOML dependency, in the same spirit as scripts/check-workflow-wiring.mjs's
// YAML subset: the inputs are fully under our control (this repo's own
// config.toml, no inline comments, no arrays in the keys this reads), so a
// general-purpose library buys nothing a dozen lines of regex don't.
//
// Queries the Management API with the existing SUPABASE_ACCESS_TOKEN
// repository secret — Supabase personal access tokens cannot be scoped to a
// single project or to read-only, so a second token would only widen the
// credential surface for no gain. That is also why this must never run from
// a `pull_request`-triggered workflow: a fork's PR could otherwise exfiltrate
// it. .github/workflows/supabase-auth-drift.yml (schedule + workflow_dispatch
// only) and ci.yml's `deploy` job (push-to-main only, and already holds this
// same token to push migrations) are the only callers.
//
// Usage: node scripts/check-supabase-auth-drift.mjs
// Reads SUPABASE_ACCESS_TOKEN from the environment; exits non-zero if it is
// unset, if the Management API call fails, or if any allowlisted key
// disagrees.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_REF = "ixerygypaevxzmiknokg";

// One entry per row of the table in TD-PPpfid-26080301: `path` locates the
// value in the parsed config.toml (dotted section + key), `apiField` is the
// live Management API's name for the same setting. `invert` marks the two
// rows where the two systems record the same concept with opposite polarity
// (config.toml's allow-flag vs. the API's disable-flag). `duration` marks the
// one row where config.toml writes a duration string ("1s") and the API
// returns whole seconds.
export const ALLOWLIST = [
  {
    path: ["auth", "minimum_password_length"],
    apiField: "password_min_length",
  },
  {
    path: ["auth", "password_requirements"],
    apiField: "password_required_characters",
  },
  {
    path: ["auth", "enable_signup"],
    apiField: "disable_signup",
    invert: true,
  },
  {
    path: ["auth", "enable_anonymous_sign_ins"],
    apiField: "external_anonymous_users_enabled",
  },
  { path: ["auth", "jwt_expiry"], apiField: "jwt_exp" },
  {
    path: ["auth", "enable_refresh_token_rotation"],
    apiField: "refresh_token_rotation_enabled",
  },
  {
    path: ["auth", "refresh_token_reuse_interval"],
    apiField: "security_refresh_token_reuse_interval",
  },
  {
    path: ["auth", "email", "enable_signup"],
    apiField: "external_email_enabled",
  },
  {
    path: ["auth", "email", "double_confirm_changes"],
    apiField: "mailer_secure_email_change_enabled",
  },
  {
    path: ["auth", "email", "enable_confirmations"],
    apiField: "mailer_autoconfirm",
    invert: true,
  },
  {
    path: ["auth", "email", "secure_password_change"],
    apiField: "security_update_password_require_reauthentication",
  },
  {
    path: ["auth", "email", "max_frequency"],
    apiField: "smtp_max_frequency",
    duration: true,
  },
  { path: ["auth", "email", "otp_length"], apiField: "mailer_otp_length" },
  { path: ["auth", "email", "otp_expiry"], apiField: "mailer_otp_exp" },
  {
    path: ["auth", "mfa", "max_enrolled_factors"],
    apiField: "mfa_max_enrolled_factors",
  },
  {
    path: ["auth", "mfa", "totp", "enroll_enabled"],
    apiField: "mfa_totp_enroll_enabled",
  },
  {
    path: ["auth", "mfa", "totp", "verify_enabled"],
    apiField: "mfa_totp_verify_enabled",
  },
  {
    path: ["auth", "mfa", "phone", "enroll_enabled"],
    apiField: "mfa_phone_enroll_enabled",
  },
  {
    path: ["auth", "mfa", "phone", "verify_enabled"],
    apiField: "mfa_phone_verify_enabled",
  },
];

function parseTomlValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  if (
    (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) ||
    (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2)
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

// Only what this script's own [auth] keys need: whole-line comments, `[a.b]`
// section headers, and scalar `key = value` lines. No inline comments,
// arrays, or multi-line strings appear among the keys ALLOWLIST reads, so
// this doesn't try to parse them.
export function parseConfigToml(text) {
  const root = {};
  let current = root;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const section = line.match(/^\[([A-Za-z0-9_.]+)\]$/);
    if (section) {
      current = root;
      for (const part of section[1].split(".")) {
        if (typeof current[part] !== "object" || current[part] === null) {
          current[part] = {};
        }
        current = current[part];
      }
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    current[kv[1]] = parseTomlValue(kv[2].trim());
  }
  return root;
}

function getPath(obj, pathParts) {
  let current = obj;
  for (const part of pathParts) {
    if (current == null || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

const DURATION_UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86400 };

export function parseDurationSeconds(raw) {
  if (typeof raw === "number") return raw;
  const match = /^(\d+)(s|m|h|d)$/.exec(String(raw));
  if (!match) {
    throw new Error(`Cannot parse "${raw}" as a Supabase duration string.`);
  }
  return parseInt(match[1], 10) * DURATION_UNIT_SECONDS[match[2]];
}

// Pure comparison: given config.toml's text and the live API's parsed JSON
// body, returns one human-readable line per disagreement among exactly the
// keys in ALLOWLIST. Never reads or reports on any other field either side
// carries.
export function buildAuthDriftReport(configText, liveConfig) {
  const config = parseConfigToml(configText);
  const problems = [];

  for (const entry of ALLOWLIST) {
    const label = entry.path.join(".");
    const rawExpected = getPath(config, entry.path);
    if (rawExpected === undefined) {
      throw new Error(
        `supabase/config.toml has no [${entry.path.slice(0, -1).join(".")}] ` +
          `${entry.path[entry.path.length - 1]} — ALLOWLIST and config.toml have drifted.`,
      );
    }

    let expected = entry.duration
      ? parseDurationSeconds(rawExpected)
      : rawExpected;
    if (entry.invert) expected = !expected;

    if (!(entry.apiField in liveConfig)) {
      problems.push(
        `${label}: live API response has no "${entry.apiField}" field`,
      );
      continue;
    }
    const live = liveConfig[entry.apiField];

    if (live !== expected) {
      problems.push(
        `${label} (config.toml: ${JSON.stringify(rawExpected)}) does not match ` +
          `live ${entry.apiField} (${JSON.stringify(live)}); expected ${JSON.stringify(expected)}`,
      );
    }
  }

  return problems;
}

async function fetchLiveAuthConfig(fetchImpl, token, projectRef) {
  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Supabase Management API request failed: ${response.status} ${response.statusText}` +
        (body ? ` — ${body}` : ""),
    );
  }
  return response.json();
}

// Orchestrates a full check: validates the token is present, fetches the
// live config, and compares it against `configText`. Dependencies
// (`fetchImpl`) are injected so tests never touch the network.
export async function checkSupabaseAuthDrift({
  configText,
  token,
  projectRef,
  fetchImpl,
}) {
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is not set; cannot query the Supabase Management API.",
    );
  }
  const liveConfig = await fetchLiveAuthConfig(fetchImpl, token, projectRef);
  return buildAuthDriftReport(configText, liveConfig);
}

async function main() {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const configText = readFileSync(
    path.join(repoRoot, "supabase/config.toml"),
    "utf8",
  );

  try {
    const problems = await checkSupabaseAuthDrift({
      configText,
      token: process.env.SUPABASE_ACCESS_TOKEN,
      projectRef: PROJECT_REF,
      fetchImpl: fetch,
    });

    if (problems.length > 0) {
      console.error(
        `${problems.length} auth-config disagreement(s) between supabase/config.toml ` +
          "and the live Supabase project:\n",
      );
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }

    console.log(
      `supabase/config.toml's [auth] settings match the live project for all ` +
        `${ALLOWLIST.length} checked keys.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
