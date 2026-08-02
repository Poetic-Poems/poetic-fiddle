#!/usr/bin/env node
// Admin-run export for a single poet's data-subject request (Privacy Policy
// "Your rights" — export). Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS, so
// it is a manual, maintainer-run tool, never a poet-facing route: nothing
// under src/ imports it, and it must never be deployed. See
// docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md for how and when to run it.

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// supabase-js's admin API has no "find user by email" call (only
// getUserById/listUsers), so an email identifier is resolved by paging
// through every account and matching case-insensitively.
const LIST_USERS_PAGE_SIZE = 200;

export function looksLikeUserId(identifier) {
  return UUID_RE.test(identifier);
}

export async function findUserIdByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });
    if (error) {
      throw new Error(
        `Couldn't list users while searching for ${email}: ${error.message}`,
        { cause: error },
      );
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
  }
  throw new Error(`No account found for email ${email}.`);
}

export async function resolveUserId(admin, identifier) {
  return looksLikeUserId(identifier)
    ? identifier
    : findUserIdByEmail(admin, identifier);
}

/**
 * The full export payload for one poet: their auth account, profile row, and
 * every poem row they own (drafts included — this is the maintainer-run
 * export, not the public share view).
 */
export async function exportPoetData(admin, identifier) {
  const userId = await resolveUserId(admin, identifier);

  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user) {
    throw new Error(`No account found for id ${userId}.`, {
      cause: userError,
    });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    throw new Error(
      `Couldn't read the profile row for ${userId}: ${profileError.message}`,
      { cause: profileError },
    );
  }

  const { data: poems, error: poemsError } = await admin
    .from("poems")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (poemsError) {
    throw new Error(
      `Couldn't read poems for ${userId}: ${poemsError.message}`,
      { cause: poemsError },
    );
  }

  return {
    exported_at: new Date().toISOString(),
    account: userData.user,
    profile: profile ?? null,
    poems: poems ?? [],
  };
}

function buildAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with " +
        "`node --env-file=.env.local scripts/export-poet-data.mjs <email-or-user-id>`, " +
        "with both set in .env.local (see .env.example) — never pass the " +
        "service-role key on the command line, where it would land in shell history.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function defaultOutputPath(userId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `poet-export-${userId}-${stamp}.json`;
}

async function main() {
  const [identifier, outArg] = process.argv.slice(2);
  if (!identifier) {
    console.error(
      "Usage: node --env-file=.env.local scripts/export-poet-data.mjs <email-or-user-id> [output-file.json]",
    );
    process.exitCode = 1;
    return;
  }

  const admin = buildAdminClient();
  const payload = await exportPoetData(admin, identifier);
  const outPath = outArg ?? defaultOutputPath(payload.account.id);
  // Owner-only: the file is a complete copy of one poet's personal data, and
  // the default 0644 would expose it to every other account on the machine.
  // (`mode` only applies when the file is created, not when overwriting.)
  writeFileSync(outPath, JSON.stringify(payload, null, 2), { mode: 0o600 });

  console.log(
    `Exported account ${payload.account.id} (${payload.account.email ?? "no email on file"}): ` +
      `${payload.poems.length} poem(s) -> ${outPath}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
