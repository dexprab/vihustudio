-- ---------------------------------------------------------------
-- THE ETHER IS A SHARED SPACE — run this once in the Supabase SQL Editor.
--
-- Everything here is idempotent: safe to run twice, safe to run on a
-- project that already has some of it. It changes no data, only what is
-- readable.
--
-- Until this runs, EtherFeed.listShared() returns nothing and the Ether
-- behaves exactly as before — Canon plus your own stories, never an
-- error. After it runs, every shared story shows in everybody's Ether.
--
-- Source of truth: supabase/schema.sql. This file is that migration cut
-- down to the statements a live project needs.
-- ---------------------------------------------------------------

begin;

-- 1. THE PUBLIC BOUNDARY, AS A COLUMN.
--
-- Generated from the story itself, so it can never disagree with it:
-- `publishedAt` is stamped only by the Share ceremony, which is where
-- Lumo asks whether the story is ready. A client cannot set this
-- independently of actually sharing, because a client cannot set it at
-- all.
alter table public.creator_projects
  add column if not exists is_shared boolean
  generated always as ((data->>'publishedAt') is not null) stored;

create index if not exists creator_projects_is_shared_idx
  on public.creator_projects (is_shared)
  where is_shared;

-- 2. SHARED STORIES BECOME READABLE BY EVERYONE.
--
-- The two existing conditions are preserved exactly — owner, and a
-- proven Magic Card recall — and `or is_shared` is added. INSERT,
-- UPDATE and DELETE policies are untouched: still owner-only, so a
-- shared story can be READ by anybody and written by nobody but its
-- author.
--
-- An unshared project stays exactly as private as it was.
drop policy if exists creator_projects_select on public.creator_projects;
create policy creator_projects_select
  on public.creator_projects for select
  using (
    owner_id = auth.uid()::text
    or public.has_magic_recall_grant(owner_id)
    -- A shared story is readable by everyone. This is the Ether.
    or is_shared
  );

-- 3. SKY PROTECTION's column, in case it was never applied.
--
-- Harmless if it already exists. The parent email is not an account and
-- nothing signs in with it; it is where a Magic Card is kept.
alter table public.magic_card_identities
  add column if not exists parent_email text;

create index if not exists magic_card_identities_parent_email_idx
  on public.magic_card_identities (parent_email)
  where parent_email is not null;

commit;

-- ---------------------------------------------------------------
-- CHECK IT WORKED. Run these after committing.
-- ---------------------------------------------------------------

-- Expect one row: is_shared, boolean, generated ALWAYS.
select column_name, data_type, is_generated, generation_expression
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'creator_projects'
  and column_name  = 'is_shared';

-- Expect the policy's USING clause to mention is_shared.
select polname, pg_get_expr(polqual, polrelid) as using_clause
from pg_policy
where polrelid = 'public.creator_projects'::regclass
  and polname  = 'creator_projects_select';

-- How many stories are actually in the Ether right now, and whose.
-- This is the answer to "why is Vihaan's story not showing": if his
-- row is not here, it was never SHARED — finishing a story does not
-- share it — and no policy change will make it appear.
select id,
       data->>'name'        as story,
       data->>'creatorName' as maker,
       data->>'publishedAt' as shared_at,
       is_shared
from public.creator_projects
order by is_shared desc, updated_at desc;
