-- Core data model for Poetic Fiddle: poets' profiles and their poems.
-- Design and rationale: docs/IMPLEMENTATION-PLAN.md §6.2.

create type public.poem_status as enum ('draft', 'unlisted', 'published');

-- One row per account. Created by a trigger on auth.users so a profile always
-- exists before anything reads remix_default.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  remix_default boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.poems (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  -- Derived app-side from the .poem header at save time, and cached here. Never
  -- separately editable: a generated column is impossible because the header
  -- only yields a title by running the JS parser.
  title       text not null default '',
  -- The canonical source of truth. Rendered HTML is never stored as truth.
  source_text text not null,
  status      public.poem_status not null default 'draft',
  -- Opaque, minted by trigger when a poem first leaves 'draft'. Never client-set.
  share_id    text unique,
  -- Nullable per-poem override of profiles.remix_default; null means "inherit".
  allow_remix boolean,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Makes "a shared poem always has a share_id" unbreakable from the client, and
  -- pairs with the minting trigger below.
  constraint poems_shared_has_share_id
    check (status = 'draft' or share_id is not null)
);

-- The dashboard's only query shape: a poet's poems, most recently touched first.
create index poems_owner_recent_idx on public.poems (owner_id, updated_at desc);

-- Mint share_id on the transition out of 'draft', and keep updated_at honest.
-- Both happen in the database so a client can neither forget to mint an id nor
-- supply its own, and cannot backdate updated_at.
create function public.poems_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- A share_id is permanent once minted: an existing link must never be
    -- silently repointed or revoked by a client-supplied value.
    new.share_id := old.share_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  else
    new.share_id := null;
  end if;

  if new.status <> 'draft' and new.share_id is null then
    -- 32 hex chars: 122 bits of entropy, URL-safe, no pgcrypto dependency.
    new.share_id := replace(gen_random_uuid()::text, '-', '');
  end if;

  return new;
end;
$$;

create trigger poems_before_write
before insert or update on public.poems
for each row execute function public.poems_before_write();

create function public.profiles_before_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
before update on public.profiles
for each row execute function public.profiles_before_update();

-- Every account gets a profile row. security definer because the role inserting
-- into auth.users during sign-up is not the new user and has no policy on
-- public.profiles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS: both tables are default-deny. Every policy is scoped `to authenticated`
-- and matches on ownership, so anonymous users get no table access at all --
-- their only read path is the get_shared_poem RPC, and their only write path is
-- localStorage. `(select auth.uid())` rather than bare auth.uid() so Postgres
-- caches it as an initplan instead of re-evaluating it per row.

alter table public.profiles enable row level security;
alter table public.poems enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy poems_select_own on public.poems
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy poems_insert_own on public.poems
for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy poems_update_own on public.poems
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy poems_delete_own on public.poems
for delete to authenticated
using ((select auth.uid()) = owner_id);
