-- Tests for the keep-alive heartbeat (§6.5, W16). Run with `npm run test:db`;
-- the same suite gates every pull request in CI.
--
-- Design under test: supabase/migrations/20260926225141_heartbeat.sql.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select is(
  (select count(*)::int from public.heartbeat),
  1,
  'the heartbeat table starts with exactly one row'
);

set local role anon;

select lives_ok(
  $$select public.bump_heartbeat()$$,
  'anon can call bump_heartbeat()'
);

select throws_ok(
  $$update public.heartbeat set pinged_at = now() where id = 1$$,
  '42501',
  null,
  'anon cannot update the heartbeat row directly'
);

select throws_ok(
  $$insert into public.heartbeat (id, pinged_at) values (2, now())$$,
  '42501',
  null,
  'anon cannot insert a second heartbeat row directly'
);

reset role;

select is(
  (select count(*)::int from public.heartbeat),
  1,
  'bump_heartbeat() still leaves exactly one row'
);

select throws_ok(
  $$insert into public.heartbeat (id, pinged_at) values (2, now())$$,
  '23514',
  null,
  'a second row is rejected by the single-row check constraint even bypassing RLS'
);

select * from finish();

rollback;
