-- ---------------------------------------------------------------
-- MY LIBRARY — run this once in the Supabase SQL Editor.
--
-- "lets introduce the concept of my library in studio where kid can
-- save their characters of these extractions. the library item goes on
-- cloud. can be edited like any other object when used on scene. can
-- be deleted from library when needed" — the product owner.
--
-- A child brings a paper drawing to life in Bring It Alive and keeps
-- the character in My Library; the Studio's Add panel places it on any
-- page of any story. Until this runs, the library works entirely
-- locally on each device (IndexedDB) and simply never reaches the
-- cloud — a normal, silent state, never an error. After it runs, every
-- saved character is backed up to this table.
--
-- The row is SELF-CONTAINED: `data` carries the record whole —
-- thumbnail, the placement PNG and the still-editable vihu-creation
-- document, bytes included. That is deliberate (see
-- js/creatorLibrary.js's header): AssetStore refs, Storage paths and
-- migrations_shared_story_assets.sql's policy all join on a projectId,
-- and a library item belongs to no project. Self-contained rows need
-- no bucket changes and no new storage policy. Disclosed cost: rows
-- are big (roughly the PNG plus the creation's own pixels).
--
-- THE LIBRARY IS PRIVATE. No is_shared, no public read — nothing like
-- the Ether applies here: a character is a child's own material, not a
-- shared story. The one widening mirrors creator_projects exactly: a
-- proven Magic Card recall (has_magic_recall_grant) may READ the
-- original device's library, SELECT-only, so a future recall path can
-- carry characters to a new device the way it already carries stories.
--
-- It is idempotent.
--
-- Source of truth for the sibling table this mirrors:
-- supabase/schema.sql → creator_projects.
-- ---------------------------------------------------------------

begin;

create table if not exists public.creator_library (
  id          text primary key,
  owner_id    text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists creator_library_owner_idx
  on public.creator_library (owner_id);

alter table public.creator_library enable row level security;

-- Owner-scoped CRUD, the exact creator_projects shape: the owner is
-- the browser's own anonymous session (auth.uid()), never a
-- client-supplied id.

drop policy if exists creator_library_insert on public.creator_library;
create policy creator_library_insert
  on public.creator_library for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_library_update on public.creator_library;
create policy creator_library_update
  on public.creator_library for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_library_delete on public.creator_library;
create policy creator_library_delete
  on public.creator_library for delete
  using (owner_id = auth.uid()::text);

-- SELECT widens for a proven Magic Card recall only — the same clause
-- creator_projects' own select policy already carries, reusing the
-- existing has_magic_recall_grant() (supabase/schema.sql). SELECT-only:
-- a recalled library item would be adopted as a local copy on the new
-- device, never written back.
drop policy if exists creator_library_select on public.creator_library;
create policy creator_library_select
  on public.creator_library for select
  using (
    owner_id = auth.uid()::text
    or public.has_magic_recall_grant(owner_id)
  );

commit;

-- ---------------------------------------------------------------
-- VERIFY — run these after committing.
-- ---------------------------------------------------------------

-- Expect four rows: insert / update / delete / select, all present.
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename  = 'creator_library'
order by cmd;

-- Expect rowsecurity = true.
select relname, relrowsecurity
from pg_class
where oid = 'public.creator_library'::regclass;

-- What the library holds right now, and whose.
select id,
       data->>'name'        as character,
       data->>'creatorName' as maker,
       octet_length(data::text) as approx_bytes,
       updated_at
from public.creator_library
order by updated_at desc;
