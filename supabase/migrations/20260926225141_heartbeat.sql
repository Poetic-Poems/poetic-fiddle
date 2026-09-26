-- Keep-alive heartbeat (§6.5, W16). A single-row table that a daily Vercel
-- cron writes to via GET /api/heartbeat, so a Supabase project on the free
-- tier never crosses the 7-day-without-activity pause threshold. Deliberately
-- a write, not a read, because the pause timer tracks database activity.
--
-- The row is bumped through a security-definer RPC rather than an anon UPDATE
-- policy, for the same reason get_shared_poem.sql is an RPC rather than a
-- policy: a policy that let the anon key update this table would be a
-- permission grant broader than "advance this one row's timestamp", even
-- though today it would only ever be used for that. RLS stays enabled with no
-- policies at all, so every direct path is closed and `bump_heartbeat()` is
-- the only door.

create table public.heartbeat (
  -- Single-row by construction: the check constraint only ever admits the
  -- value `1`, and the primary key makes a second row with that same value
  -- impossible.
  id int primary key default 1 check (id = 1),
  pinged_at timestamptz not null default now()
);

insert into public.heartbeat (id, pinged_at) values (1, now());

-- Table privileges, stated explicitly rather than inherited from the
-- project's default privileges, matching poems_and_profiles.sql's own
-- rationale: RLS governs which rows a role may touch, not whether it may
-- touch the table at all, so both are needed. Nobody gets a grant here —
-- the only door is the security-definer RPC below.
revoke all on public.heartbeat from anon, authenticated;

alter table public.heartbeat enable row level security;

create function public.bump_heartbeat()
returns void
language sql
volatile
security definer
-- Mandatory on a security definer function: without it the definer's privileges
-- can be turned against a caller-controlled search path.
set search_path = ''
as $$
  update public.heartbeat set pinged_at = now() where id = 1;
$$;

revoke all on function public.bump_heartbeat() from public;
grant execute on function public.bump_heartbeat() to anon;
