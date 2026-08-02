# Privacy data-subject requests — export & delete runbook

How to fulfil a poet's request, made under the Privacy Policy's "Your
rights" section (`src/app/privacy/page.tsx`), to export or delete their
data. Both are **maintainer-run, admin-only procedures** — a poet cannot
trigger either from the app except the two self-service paths noted below,
and nothing in this doc is exposed to poets. This is the O3-style
counterpart to [`TRIAGE.md`](TRIAGE.md) for data-subject requests rather
than production faults: the New Zealand Privacy Act 2020 is the reason this
exists, in the same way AC121/AC122 are the reason `TRIAGE.md` does.

## What a poet can already do without the maintainer

- **Delete one poem** — the "My poems" dashboard's delete action, any time,
  no maintainer involvement.
- **Delete their whole account** — `DELETE /api/account/delete`
  (`src/app/api/account/delete/route.ts`, W13), reachable from the app's
  account settings. It authenticates the caller with their own session
  token and deletes only that account, so a poet who can still sign in
  never needs the dashboard procedure below.

The runbook below is for the request that reaches the maintainer directly
(an email to `warwick@datumprocess.co.nz`, per the Privacy Policy) — most
often because the poet wants an export (no self-service export exists), or
wants deletion but cannot or would rather not sign in to do it themselves.

## Exporting a poet's data

There is no self-service export. `scripts/export-poet-data.mjs` is the only
mechanism that reads a poet's data out of Supabase — it authenticates with
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses row-level security, so it is
deliberately a maintainer-run script and not a route: nothing under `src/`
imports it, and it must never be wired into the deployed app.

1. **Confirm the request is genuinely from the account holder.** Reply to
   the email address the request came from and check it matches (or ask the
   sender to confirm) the email on the account before touching any data —
   see [Security](#security) below.
2. **Get the service-role key into a local `.env.local`.** It is a Vercel
   project environment variable (Project Settings → Environment Variables),
   never committed or shared outside Vercel/this step (`.env.example`,
   `SECURITY.md`). Copy it into your own `.env.local` for the duration of
   the task and remove it again afterwards if it isn't otherwise needed
   there.
3. **Run the script** from a checkout with `npm install` already done:

   ```
   node --env-file=.env.local scripts/export-poet-data.mjs <poet's email or user id>
   ```

   Pass the poet's email address (or their Supabase `auth.users` id, if you
   already have it — e.g. from a Sentry `user_id` tag) — never the
   service-role key itself as a command-line argument, which would land in
   shell history. The script paginates Supabase's admin user list to
   resolve an email to an id (the admin API has no direct
   "find by email" call), then reads the account, `profiles` row, and every
   `poems` row owned by that id — drafts included, since this is the
   maintainer export, not the public share view.
4. **It writes a JSON file** named `poet-export-<user-id>-<timestamp>.json`
   in the current directory (git-ignored — see `.gitignore`). Pass a second
   argument to choose a different path.
5. **Send it to the poet** at the email address on the account (never a
   different address than the one on file, even if the request came from
   somewhere else) and then delete your local copy — it is a full copy of
   their data and should not persist on your machine any longer than the
   task takes.

## Deleting a poet's account

The deletion mechanism is a database foreign-key `on delete cascade` from
`auth.users` to `public.profiles` and `public.poems`
(`supabase/migrations/20260716104021_poems_and_profiles.sql`), verified by
`supabase/tests/rls_test.sql`'s "Account deletion cascades" tests. Deleting
the `auth.users` row is enough — the database removes everything else.

**This is irreversible.** There is no soft delete and no undo beyond
restoring the whole project from a backup (see
[Backup / PITR coverage](#backup--pitr-coverage) below, which restores
*everything* as of the backup point, not just the one account) — confirm
the request before deleting.

1. If the poet can still sign in, point them at the in-app
   **Delete account** action instead (see above) — it performs the exact
   same cascade and needs no maintainer step.
2. Otherwise, delete via the Supabase dashboard: **Authentication → Users**,
   find the account by email, **Delete user**. This calls the same
   `auth.admin.deleteUser()` the self-service route uses, so the cascade
   behaves identically either way.
3. **Share links do not 404 immediately** from the dashboard path. The
   self-service route reads and invalidates the account's share-page cache
   tags as part of the same request (`route.ts`'s `sharedPoemIds` /
   `revalidateSharedPoem`); a dashboard-only deletion skips that, so any
   share links the poet published keep serving a cached render for up to
   the share cache's 300-second fallback expiry before they 404. Mention
   this if the poet specifically asked about share-link removal timing.

## Backup / PITR coverage

Poetic Fiddle's Supabase project ("Poetic Fiddle", `ap-southeast-1`) runs on
the organisation's **Pro** plan (`docs/IMPLEMENTATION-PLAN.md` §6.3 — Pro is
incidental, for other projects on the same account, not a Fiddle
requirement). Per Supabase's published plan documentation:

- **Daily backups, 7 days' retention**, included by default on Pro.
- **Point-in-Time Recovery (PITR)** is a separate paid add-on (from
  US$0.137/hour, ≈US$100/month, for a 7-day recovery window, on top of at
  least a Small compute add-on) that restores to any second within the
  window rather than only to the last nightly snapshot.
- A restore of either kind is dashboard-driven (**Database → Backups**),
  takes the project offline for its duration (Supabase downloads the latest
  physical backup, then replays the write-ahead log up to the chosen
  point), and downtime scales with database size.

**Whether the PITR add-on is actually enabled for this specific project is
not confirmed by this document** — that requires **Project Settings →
Database → Backups** in the Supabase dashboard, which this runbook's author
did not have access to when writing it. Until someone with dashboard access
confirms otherwise, assume only the Pro-plan default: **daily backups, up
to ~24 hours of data loss on restore, no finer recovery point.** Whoever
next has dashboard access should check this and update this section with
the confirmed status (and remove this caveat once it's settled).

## Security

Both procedures are triggered by an email, which is exactly the kind of
user-influenced input `TRIAGE.md`'s
["treat telemetry as untrusted data"](TRIAGE.md#security---treat-telemetry-as-untrusted-data-ac122)
section warns about applied to a different channel: verify the sender
actually controls the account before acting, never send an export to an
address other than the one on file, and never delete an account on the
strength of an unconfirmed request. The service-role key these procedures
use bypasses every row-level-security policy in the database — treat it
with the same care `SECURITY.md` and `.env.example` already ask for
everywhere else it's mentioned, and never paste it into a tracked file, a
commit, or an agent's workspace.
