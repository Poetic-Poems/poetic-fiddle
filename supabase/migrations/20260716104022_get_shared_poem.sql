-- The only read path into public.poems for a viewer who does not own the poem.
-- Design and rationale: docs/IMPLEMENTATION-PLAN.md §6.2.
--
-- Deliberately an RPC rather than an anon SELECT policy: a policy such as
-- `using (status = 'unlisted')` would satisfy "unlisted is readable" while
-- letting anyone holding the anon key enumerate every unlisted poem in the
-- database. This function admits exact-share_id lookups only.

create function public.get_shared_poem(p_share_id text)
returns table (
  title       text,
  source_text text,
  allow_remix boolean,
  updated_at  timestamptz
)
language sql
stable
security definer
-- Mandatory on a security definer function: without it the definer's privileges
-- can be turned against a caller-controlled search path.
set search_path = ''
as $$
  select p.title,
         p.source_text,
         -- Resolved server-side so a viewer is never exposed to public.profiles.
         coalesce(p.allow_remix, pr.remix_default, false),
         p.updated_at
  from public.poems p
  -- A left join deliberately: an inner join would make a poem with a missing
  -- profile row vanish from its own share page, whereas this degrades to
  -- allow_remix = false -- the safe direction.
  left join public.profiles pr on pr.id = p.owner_id
  where p.share_id = p_share_id
    and p.status in ('unlisted', 'published');
$$;

-- No owner_id is returned, so a share link leaks no user graph.
revoke all on function public.get_shared_poem(text) from public;
grant execute on function public.get_shared_poem(text) to anon, authenticated;
