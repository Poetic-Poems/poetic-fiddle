#!/usr/bin/env node
// Admin-run export for a single poet's data-subject request (Privacy Policy
// "Your rights" — export). Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS, so
// it is a manual, maintainer-run tool, never a poet-facing route: nothing
// under src/ imports it, and it must never be deployed. See
// docs/PRIVACY-EXPORT-DELETE-RUNBOOK.md for how and when to run it.

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// supabase-js's admin API has no "find user by email" call (only
// getUserById/listUsers), so an email identifier is resolved by paging
// through every account and matching case-insensitively.
const LIST_USERS_PAGE_SIZE = 200;

// PostgREST projects can cap rows per request ("Max rows" in the Supabase
// dashboard); paging unconditionally in a loop until a short page comes back
// makes this export complete regardless of that setting, present or not.
const POEMS_PAGE_SIZE = 1000;

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

async function fetchAllPoems(admin, userId) {
  const poems = [];
  for (let page = 0; ; page++) {
    const start = page * POEMS_PAGE_SIZE;
    const end = start + POEMS_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("poems")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true })
      .range(start, end);
    if (error) {
      throw new Error(`Couldn't read poems for ${userId}: ${error.message}`, {
        cause: error,
      });
    }
    poems.push(...(data ?? []));
    if (!data || data.length < POEMS_PAGE_SIZE) break;
  }
  return poems;
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

  const poems = await fetchAllPoems(admin, userId);

  return {
    exported_at: new Date().toISOString(),
    account: userData.user,
    profile: profile ?? null,
    poems,
  };
}

export function poemFileName(poem, index) {
  const slug = (poem.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  const ordinal = String(index + 1).padStart(3, "0");
  return `poems/${ordinal}${slug ? `-${slug}` : ""}.poem`;
}

// A minimal POSIX-ustar header. Hand-rolled rather than a dependency because
// the inputs are fully under our control (short ASCII names, small files) and
// building the archive in memory means the poet's data never touches disk in
// an intermediate world-readable temp file.
function tarHeader(name, size, mtimeSeconds) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000600 ", 100); // mode — matches the 0600 the outer file gets
  header.write("0000000 ", 108); // uid
  header.write("0000000 ", 116); // gid
  header.write(`${size.toString(8).padStart(11, "0")} `, 124);
  header.write(`${mtimeSeconds.toString(8).padStart(11, "0")} `, 136);
  header.write("        ", 148); // checksum is computed with its field blank
  header.write("0", 156); // typeflag: regular file
  header.write("ustar", 257);
  header.write("00", 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return header;
}

/**
 * The export as a gzipped tar: `export.json` (the whole payload,
 * machine-readable) plus one `poems/NNN-<title-slug>.poem` per poem row,
 * `source_text` verbatim — so the poet can read their poems as poems without
 * parsing JSON out of the payload.
 */
export function buildExportArchive(payload) {
  const mtimeSeconds = Math.floor(Date.parse(payload.exported_at) / 1000);
  const files = [
    { name: "export.json", body: JSON.stringify(payload, null, 2) },
    ...payload.poems.map((poem, index) => ({
      name: poemFileName(poem, index),
      body: poem.source_text ?? "",
    })),
  ];
  const blocks = [];
  for (const { name, body } of files) {
    const data = Buffer.from(body, "utf8");
    blocks.push(tarHeader(name, data.length, mtimeSeconds), data);
    blocks.push(Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024)); // end-of-archive marker
  return gzipSync(Buffer.concat(blocks));
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
  return `poet-export-${userId}-${stamp}.tar.gz`;
}

async function main() {
  const [identifier, outArg] = process.argv.slice(2);
  if (!identifier) {
    console.error(
      "Usage: node --env-file=.env.local scripts/export-poet-data.mjs <email-or-user-id> [output-file.tar.gz]",
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
  writeFileSync(outPath, buildExportArchive(payload), { mode: 0o600 });

  console.log(
    `Exported account ${payload.account.id} (${payload.account.email ?? "no email on file"}): ` +
      `${payload.poems.length} poem(s) -> ${outPath} (export.json + poems/*.poem)`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
