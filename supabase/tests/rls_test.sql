-- RLS and share-path tests for the poems/profiles model.
--
-- RLS is security-critical and fails open silently when misconfigured, so the
-- cases that must FAIL here matter as much as the ones that must pass. Run with
-- `npm run test:db`; the same suite gates every pull request in CI.
--
-- Design under test: docs/IMPLEMENTATION-PLAN.md §6.2.
--
-- Acting as a poet is `set local role authenticated` plus a JWT claim carrying
-- their id, which is what auth.uid() reads. The two accounts therefore have
-- fixed ids, so the claims below can be literals.

begin;

create extension if not exists pgtap with schema extensions;

select plan(34);

-- Fixtures are created as the superuser, which bypasses RLS. That is the point:
-- the tests below re-enter through a role, never through this connection.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'poet-a@example.test', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'poet-b@example.test', '', now(), now(), now());

-- A share_id is minted by the database and is readable only by the poem's owner,
-- so tests that act as a visitor cannot look one up themselves -- doing so would
-- silently yield NULL under RLS and make a test pass for the wrong reason. The
-- superuser stashes each minted id here as it appears, and every role may read
-- it back.
create temporary table refs (name text primary key, share_id text);
grant select on refs to public;

-- === The auth.users -> profiles trigger ===

select is(
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'a profile row is created for a new account'
);

select is(
  (select remix_default from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  false,
  'remix_default is off by default'
);

-- === Poet A, acting on their own rows ===

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$insert into public.poems (id, owner_id, title, source_text)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111',
            'Ode to a Fiddle', 'title: Ode to a Fiddle')$$,
  'a poet can insert their own poem'
);

select is(
  (select count(*)::int from public.poems),
  1,
  'a poet can read their own poem'
);

select is(
  (select status from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'draft'::public.poem_status,
  'a saved poem defaults to draft'
);

select is(
  (select share_id from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  null,
  'a draft has no share_id at all, so it is unreachable by construction'
);

select lives_ok(
  $$update public.poems set title = 'Ode to a Better Fiddle'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a poet can update their own poem'
);

select throws_ok(
  $$insert into public.poems (owner_id, source_text)
    values ('22222222-2222-2222-2222-222222222222', 'not mine')$$,
  '42501',
  null,
  'a poet cannot insert a poem owned by someone else'
);

-- === Poet B, acting on poet A's rows ===

set local request.jwt.claims to
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from public.poems),
  0,
  'a second poet cannot read another poet''s poem'
);

select is(
  (with updated as (
     update public.poems set title = 'hijacked'
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'
      returning 1)
   select count(*)::int from updated),
  0,
  'a second poet cannot update another poet''s poem'
);

select is(
  (with deleted as (
     delete from public.poems
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'
      returning 1)
   select count(*)::int from deleted),
  0,
  'a second poet cannot delete another poet''s poem'
);

select is(
  (select count(*)::int from public.profiles),
  1,
  'a poet sees only their own profile row'
);

select is(
  (with updated as (
     update public.profiles set remix_default = true
      where id = '11111111-1111-1111-1111-111111111111'
      returning 1)
   select count(*)::int from updated),
  0,
  'a poet cannot update another poet''s profile'
);

-- === Anonymous visitors have no table access whatsoever ===

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select count(*)::int from public.poems),
  0,
  'an anonymous visitor cannot read poems'
);

select is(
  (select count(*)::int from public.profiles),
  0,
  'an anonymous visitor cannot read profiles'
);

select throws_ok(
  $$insert into public.poems (owner_id, source_text)
    values ('11111111-1111-1111-1111-111111111111', 'anon write')$$,
  '42501',
  null,
  'an anonymous visitor cannot write a poem'
);

-- === share_id minting ===

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.poems set status = 'unlisted'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select matches(
  (select share_id from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '^[0-9a-f]{32}$',
  'leaving draft mints a 32-hex-character share_id'
);

reset role;
insert into refs
select 'poem1', share_id from public.poems
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role authenticated;

update public.poems set title = 'Ode, revised'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select share_id from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select share_id from refs where name = 'poem1'),
  'a minted share_id is permanent across later updates'
);

select is(
  (with updated as (
     update public.poems set share_id = 'client-chosen-value'
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'
      returning share_id)
   select share_id from updated),
  (select share_id from refs where name = 'poem1'),
  'a client cannot repoint a share_id to a value of its own choosing'
);

insert into public.poems (id, owner_id, source_text, status, share_id)
values ('aaaaaaaa-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'title: Second', 'unlisted', 'client-chosen-value');

select matches(
  (select share_id from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  '^[0-9a-f]{32}$',
  'a client-supplied share_id on insert is replaced by a minted one'
);

reset role;
insert into refs
select 'poem2', share_id from public.poems
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role authenticated;

-- === updated_at is maintained by the database ===

select ok(
  (select updated_at from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001') >
  (select created_at from public.poems
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'an update bumps updated_at'
);

select ok(
  (with updated as (
     update public.poems set updated_at = '2000-01-01'::timestamptz
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'
      returning updated_at)
   select updated_at from updated) > '2020-01-01'::timestamptz,
  'a client cannot backdate updated_at'
);

-- === get_shared_poem: the only non-owner read path ===

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select count(*)::int from public.get_shared_poem(
     (select share_id from refs where name = 'poem1'))),
  1,
  'an anonymous visitor can read an unlisted poem by its share_id'
);

select is(
  (select title from public.get_shared_poem(
     (select share_id from refs where name = 'poem1'))),
  'Ode, revised',
  'the share path reflects the current source, not a snapshot'
);

select is(
  (select count(*)::int from public.get_shared_poem('no-such-share-id')),
  0,
  'an unknown share_id returns nothing'
);

select is(
  (select allow_remix from public.get_shared_poem(
     (select share_id from refs where name = 'poem1'))),
  false,
  'allow_remix defaults to false when neither override nor remix_default is set'
);

-- A poem returned to draft falls out of the share path even though it keeps its
-- share_id -- this is what makes un-sharing work.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.poems set status = 'draft'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select count(*)::int from public.get_shared_poem(
     (select share_id from refs where name = 'poem1'))),
  0,
  'get_shared_poem refuses a draft, so un-sharing takes effect immediately'
);

-- === allow_remix resolution ===

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.poems set allow_remix = true
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select allow_remix from public.get_shared_poem(
     (select share_id from refs where name = 'poem2'))),
  true,
  'a per-poem allow_remix override is honoured'
);

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.profiles set remix_default = true
 where id = '11111111-1111-1111-1111-111111111111';
update public.poems set allow_remix = false
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select allow_remix from public.get_shared_poem(
     (select share_id from refs where name = 'poem2'))),
  false,
  'a per-poem override of false beats a remix_default of true'
);

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

update public.poems set allow_remix = null
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select is(
  (select allow_remix from public.get_shared_poem(
     (select share_id from refs where name = 'poem2'))),
  true,
  'a null override inherits the poet''s remix_default'
);

-- === The share payload leaks no user graph ===

select is(
  pg_get_function_result('public.get_shared_poem(text)'::regprocedure),
  'TABLE(title text, source_text text, allow_remix boolean, updated_at timestamp with time zone)',
  'get_shared_poem returns no owner_id, so a share link leaks no user graph'
);

-- === The check constraint is the backstop if the trigger is ever bypassed ===

reset role;
select set_config('request.jwt.claims', null, true);

alter table public.poems disable trigger poems_before_write;

select throws_ok(
  $$insert into public.poems (owner_id, source_text, status)
    values ('11111111-1111-1111-1111-111111111111', 'title: Third', 'unlisted')$$,
  '23514',
  null,
  'a non-draft poem without a share_id violates poems_shared_has_share_id'
);

alter table public.poems enable trigger poems_before_write;

-- === Account deletion cascades ===

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.poems
    where owner_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting an account cascades to its poems'
);

select is(
  (select count(*)::int from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting an account cascades to its profile'
);

select * from finish();

rollback;
