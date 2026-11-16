#!/usr/bin/env node
// seed-e2e.mjs
//
// Issue #551: e2e/a11y.spec.ts's signed-in and /share/<id> coverage needs a
// confirmed test user and a shared poem to sign in as and scan — neither of
// which can depend on a live/production Supabase project. This brings up the
// same local instance `npm run test:db` already uses (`supabase start`),
// then seeds that one fixture through `@supabase/supabase-js` rather than raw
// SQL: `auth.admin.createUser({ email_confirm: true })` sidesteps the
// inbox-confirmation round trip local auth would otherwise require
// (supabase/config.toml's `[auth.email] enable_confirmations = true`).
//
// The poem itself is inserted by the fixture poet's own signed-in client, not
// the service-role one: supabase/migrations/20260716104021_poems_and_profiles.sql
// states public.poems' privileges explicitly and grants them to `authenticated`
// alone, so a service-role write through PostgREST is refused outright
// (`42501: permission denied for table poems`) — the poet's own session is the
// write path the app itself uses, and it mints a real `share_id` via the same
// `poems_before_write` trigger a save through the app would.
//
// Writes e2e/.env.e2e (git-ignored by the repo-wide `.env.*` rule) with the
// local instance's own connection details and the fixture's identifiers.
// playwright.config.ts loads it to point the app under test at this
// instance instead of the placeholder project; the specs read the same
// values from `process.env` to sign in and to build the `/share/<id>` URL.
//
// Usage: node scripts/seed-e2e.mjs
// Never run against a live/production project: the service-role key this
// reads comes only from `supabase status`'s own local-stack output.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TEST_USER_EMAIL = "e2e-fixture@example.com";
const TEST_USER_PASSWORD = "e2e-fixture-password-26";
const TEST_POEM_TITLE = "E2E fixture poem";
const TEST_POEM_SOURCE = `E2E fixture poem
A Test Poet
2026-01-01

{Verse 1}
A line seeded for Playwright's a11y coverage.
Another line here, for good measure.
`;

const REQUIRED_STATUS_KEYS = ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"];

/**
 * Parses `supabase status -o env` / `supabase start -o env`'s output —
 * `KEY="value"` lines, one per status variable — into a plain object. Used
 * directly, no dependency: the CLI's own `-o env` format is already exactly
 * what's needed here.
 */
export function parseEnvOutput(text) {
  const vars = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) vars[match[1]] = match[2];
  }
  return vars;
}

function runSupabase(args) {
  return execFileSync("supabase", args, { encoding: "utf8" });
}

/** Brings up (or reuses) the local Supabase instance and returns its status vars. */
export function ensureLocalSupabase({ run = runSupabase } = {}) {
  let output;
  try {
    output = run(["status", "-o", "env"]);
  } catch {
    output = run(["start", "-o", "env"]);
  }
  const vars = parseEnvOutput(output);
  const missing = REQUIRED_STATUS_KEYS.filter((key) => !vars[key]);
  if (missing.length > 0) {
    throw new Error(
      `\`supabase status\` is missing ${missing.join(", ")} — is the local instance healthy?`,
    );
  }
  return vars;
}

/**
 * Creates the fixture poet if needed, confirmed (no inbox round trip), and
 * leaves `anon` holding their session — every poems write below goes through
 * it, since `authenticated` is the only role public.poems grants anything to.
 */
async function ensureSignedInTestUser(admin, anon) {
  const signIn = () =>
    anon.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

  const { data: signedIn } = await signIn();
  if (signedIn?.user) return signedIn.user.id;

  const { error } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const { data, error: signInError } = await signIn();
  if (signInError) throw signInError;
  return data.user.id;
}

/** Creates the fixture's shared poem if needed, and returns its title/share_id. */
async function ensureTestPoem(poet, ownerId) {
  const { data: existing, error: selectError } = await poet
    .from("poems")
    .select("title, share_id")
    .eq("owner_id", ownerId)
    .eq("title", TEST_POEM_TITLE)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing?.share_id) {
    return { title: existing.title, shareId: existing.share_id };
  }

  const { data: inserted, error: insertError } = await poet
    .from("poems")
    .insert({
      owner_id: ownerId,
      title: TEST_POEM_TITLE,
      source_text: TEST_POEM_SOURCE,
      status: "unlisted",
    })
    .select("title, share_id")
    .single();
  if (insertError) throw insertError;
  return { title: inserted.title, shareId: inserted.share_id };
}

export async function seedE2eFixtures({
  run = runSupabase,
  writeFile = writeFileSync,
  fixturePath,
} = {}) {
  const status = ensureLocalSupabase({ run });
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await ensureSignedInTestUser(admin, anon);
  const poem = await ensureTestPoem(anon, userId);

  const lines = [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
    `E2E_USER_EMAIL=${TEST_USER_EMAIL}`,
    `E2E_USER_PASSWORD=${TEST_USER_PASSWORD}`,
    `E2E_POEM_TITLE=${poem.title}`,
    `E2E_SHARE_ID=${poem.shareId}`,
    "",
  ];
  writeFile(fixturePath, lines.join("\n"));

  return { ...status, userId, poem };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fixturePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "e2e",
    ".env.e2e",
  );
  seedE2eFixtures({ fixturePath })
    .then(({ poem }) => {
      console.log(`Seeded e2e fixtures: shareId=${poem.shareId}`);
    })
    .catch((error) => {
      console.error("Failed to seed e2e fixtures:", error);
      process.exitCode = 1;
    });
}
