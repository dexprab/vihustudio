-- ---------------------------------------------------------------
-- MY HANDWRITING — run this once in the Supabase SQL Editor.
--
-- "it needs to be stored also correct. it needs to go on cloud" — the
-- product owner, on the My Handwriting letter grid (tools/
-- bring-it-alive). Today the grid's letters live in in-memory Maps:
-- reload the page and every kept letter is gone. This table is where
-- they live instead — the letters a child has kept, and the font built
-- from them — so the grid a child part-filled at home greets them
-- part-filled at grandma's.
--
-- THE LETTER IS THE UNIT OF KEEPING, so the letter is the unit of
-- storage: one row per kept letter, upserted the moment Keep is
-- pressed, plus one row for the built font. Per-letter rows are what
-- make the grid mergeable across devices — five letters kept on one
-- machine and three on another union naturally, where a single
-- all-letters row would have the second device overwrite the first's
-- work. The font row is a build product (hwFont rebuilds from letters
-- in milliseconds), kept so the Studio can offer "My Handwriting" in
-- its font lists without fetching every letter first.
--
-- The row is SELF-CONTAINED, exactly as creator_library's rows are
-- (migrations_creator_library.sql): `data` carries the record whole —
-- for a letter row the glyph's own bytes, for the font row the TTF —
-- because handwriting belongs to no project, and AssetStore refs,
-- Storage paths and migrations_shared_story_assets.sql's policy all
-- join on a projectId. Self-contained rows need no bucket changes and
-- no new storage policy. Disclosed cost: the font row is roughly the
-- TTF's own size (tens of KB), a letter row a few KB.
--
-- `data` shapes (informative, owned by the client — js reads/writes
-- these; SQL never looks inside beyond the verify queries below):
--   letter row:  { kind:'letter', ch:'a', cardId, glyph:{...}, keptAt }
--   font row:    { kind:'font', cardId, ttf:'<base64>', letters:'ab…',
--                  builtAt }
-- Handwriting belongs to the CARD that made it (Decision 19's
-- standard: a child's work is scoped to their Magic Card, as a filter,
-- never a delete) — cardId rides in `data`, stamped client-side from
-- the active card exactly as creator_projects records carry it.
--
-- HANDWRITING IS PRIVATE. No is_shared, no public read — nothing like
-- the Ether applies here: a child's own hand is their own material.
-- The one widening mirrors creator_projects and creator_library
-- exactly: a proven Magic Card recall (has_magic_recall_grant) may
-- READ the original device's rows, SELECT-only — prove your stars,
-- receive your writing. A typed-code recall holds no grant and
-- receives nothing, the same standard recall_magic_card() already
-- applies to the pattern itself (Decision 18: the pattern is the
-- credential). A recalled letter set is adopted as a local copy on the
-- new device, never written back.
--
-- It is idempotent.
--
-- Source of truth for the sibling tables this mirrors:
-- supabase/schema.sql → creator_projects · has_magic_recall_grant,
-- and migrations_creator_library.sql → creator_library.
-- ---------------------------------------------------------------

begin;

create table if not exists public.creator_handwriting (
  id          text primary key,
  owner_id    text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists creator_handwriting_owner_idx
  on public.creator_handwriting (owner_id);

alter table public.creator_handwriting enable row level security;

-- Owner-scoped CRUD, the exact creator_library shape: the owner is
-- the browser's own anonymous session (auth.uid()), never a
-- client-supplied id.

drop policy if exists creator_handwriting_insert on public.creator_handwriting;
create policy creator_handwriting_insert
  on public.creator_handwriting for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_handwriting_update on public.creator_handwriting;
create policy creator_handwriting_update
  on public.creator_handwriting for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_handwriting_delete on public.creator_handwriting;
create policy creator_handwriting_delete
  on public.creator_handwriting for delete
  using (owner_id = auth.uid()::text);

-- SELECT widens for a proven Magic Card recall only — the same clause
-- creator_projects and creator_library both carry, reusing the
-- existing has_magic_recall_grant() (supabase/schema.sql). Nothing new
-- is proved and nothing new can leak: the grant exists only after
-- recall_magic_card() accepted a drawn pattern from this very session.
drop policy if exists creator_handwriting_select on public.creator_handwriting;
create policy creator_handwriting_select
  on public.creator_handwriting for select
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
  and tablename  = 'creator_handwriting'
order by cmd;

-- Expect rowsecurity = true.
select relname, relrowsecurity
from pg_class
where oid = 'public.creator_handwriting'::regclass;

-- What the table holds right now: every creator's kept letters and
-- fonts, smallest summary that names no glyph bytes.
select owner_id,
       count(*) filter (where data->>'kind' = 'letter') as letters,
       count(*) filter (where data->>'kind' = 'font')   as fonts,
       sum(octet_length(data::text))                    as approx_bytes,
       max(updated_at)                                  as last_kept
from public.creator_handwriting
group by owner_id
order by last_kept desc;
