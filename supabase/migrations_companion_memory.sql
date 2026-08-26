-- ---------------------------------------------------------------
-- WHAT A COMPANION REMEMBERS
-- ---------------------------------------------------------------
-- Sprint 1B. CLAUDE.md -> Decision 30: "A Companion may remember
-- meaningful experiences, conversations and creations shared with its
-- Creator, across sessions and across devices... Memory is of meaningful
-- moments, never a log of everything the Creator does."
--
-- ONE TABLE, and it mirrors creator_library column for column in every
-- respect that matters — owner-scoped CRUD, a SELECT that widens only
-- for a proven Magic Card recall, and nothing else. The shape is not
-- invented here; the source of truth for it is
-- supabase/migrations_creator_library.sql, which is itself
-- creator_projects' shape.
--
-- WHY A TABLE AT ALL, when localStorage already holds this. Decision 22
-- settled it for the taught record and the reasoning is identical: a
-- browser-local memory would leave a Creator with no past at their
-- grandmother's house, and being forgotten by your own Companion on a
-- strange machine is precisely the failure a bond must not have.
-- js/companionMemory.js is local-first; this is what lets a memory
-- travel.
--
-- ---------------------------------------------------------------
-- DEDUPLICATION IS A CONSTRAINT, NOT A HABIT
--
--   unique (card_id, dedupe_key)
--
-- A `dedupe_key` is a deterministic name for a moment — 'first-story',
-- 'returned:proj_x'. One row per (card, key) means opening a first story
-- twenty times cannot make twenty memories, and it means so at the
-- level where it cannot be got wrong by a caller. Same discipline
-- Decision 20 states for Cheer: "The database's primary key IS the
-- rule... There is no counter to drift out of step with the rows."
--
-- The client enforces the identical rule locally, so the two agree; the
-- constraint is what makes agreement structural rather than fortunate.
--
-- ---------------------------------------------------------------
-- WHAT IT STORES, AND WHAT IT MUST NEVER STORE
--
-- A short sentence, four small labels, and a list of ids pointing at
-- things this product already holds. Never a conversation, never a
-- Studio event, never a click, never a page visit, never story text,
-- never an image, never audio. If a future recorder wants to store
-- something that is not a meaningful moment, this table is the wrong
-- place and the answer is no.
--
-- `entities` are ids and nothing else — 'project:<id>', 'library:<id>',
-- 'companion:leafy'. They are how retrieval works without embeddings,
-- and they carry no content of their own.
--
-- ---------------------------------------------------------------
-- WHO CAN READ IT
--
-- RLS separates BROWSERS: owner_id is auth.uid(), the anonymous session,
-- exactly as creator_projects and creator_library already are.
--
-- `card_id` separates CREATORS WITHIN a browser, and that is a filter
-- rather than a policy — the same disclosed boundary a child's own
-- STORIES already live with (Decision 19: "it is a filter and never a
-- delete"), because a Magic Card is not an authenticated principal and
-- RLS has nothing to check it against. schema.sql says so of
-- magic_card_identities in as many words: "one browser's shared
-- anonymous session can legitimately own several identities."
--
-- A TRAVELLER HAS NO ROW HERE AT ALL. card_id is NOT NULL, and
-- js/companionMemory.js refuses to write without an active card, so
-- there is no such thing as a Traveller memory to be exposed.
--
-- It is idempotent. A human runs it once via the Supabase SQL Editor
-- (or `supabase db push`) — this environment cannot reach Supabase.
--
-- Verify with supabase/verify_companion_memory.sql.
-- ---------------------------------------------------------------

begin;

create table if not exists public.creator_companion_memory (
  id           text        primary key,
  -- The VERIFIED session that wrote it (Sprint 1A: never a
  -- client-supplied owner). What RLS checks.
  owner_id     text        not null,
  -- WHICH CREATOR. Decision 19's scoping, carried on the row so a
  -- shared machine keeps two children's pasts apart.
  card_id      text        not null,
  -- Whose Companion was bonded at the time. Nullable: a card claimed
  -- before the bond existed honestly has none, and inventing one would
  -- put a stranger in the child's history.
  companion_id text,
  kind         text        not null check (kind in ('self', 'creator', 'shared', 'world')),
  -- One short sentence, in the Companion's own words. Never a
  -- transcript, never story text.
  content      text        not null check (length(content) between 1 and 400),
  importance   text        not null default 'medium' check (importance in ('low', 'medium', 'high')),
  -- Sprint 1B writes only 'confirmed'. 'inferred' exists in the
  -- vocabulary because Decision 30 names it, and is deliberately
  -- unreachable until a model exists and its proposals are validated.
  confidence   text        not null default 'confirmed' check (confidence in ('confirmed', 'observed', 'inferred')),
  -- Which recorder proved it, e.g. 'state:published-at'. For a person
  -- auditing where a memory came from; never shown to a child.
  source       text        not null default 'unknown',
  -- Ids only. This is what makes retrieval exact without embeddings.
  entities     jsonb       not null default '[]'::jsonb,
  -- The deterministic name of the moment. See the header.
  dedupe_key   text        not null,
  -- A milestone ordinary cleanup may never take.
  protected    boolean     not null default false,
  status       text        not null default 'active' check (status in ('active', 'dormant', 'archived')),
  created_at   timestamptz not null default now(),
  last_referenced_at timestamptz,
  unique (card_id, dedupe_key)
);

-- Retrieval is per-card and usually per-kind; the partial index serves
-- the common read, which is "this Creator's active memories".
create index if not exists creator_companion_memory_card_idx
  on public.creator_companion_memory (card_id, status);
create index if not exists creator_companion_memory_owner_idx
  on public.creator_companion_memory (owner_id);
-- Entity lookup ('project:<id>') is a containment test on a small jsonb
-- array, which is what GIN is for.
create index if not exists creator_companion_memory_entities_idx
  on public.creator_companion_memory using gin (entities);

alter table public.creator_companion_memory enable row level security;

-- Owner-scoped CRUD, the exact creator_library shape: the owner is the
-- browser's own anonymous session (auth.uid()), never a client-supplied
-- id. A client that sends somebody else's owner_id is refused by the
-- policy rather than trusted.

drop policy if exists creator_companion_memory_insert on public.creator_companion_memory;
create policy creator_companion_memory_insert
  on public.creator_companion_memory for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_companion_memory_update on public.creator_companion_memory;
create policy creator_companion_memory_update
  on public.creator_companion_memory for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists creator_companion_memory_delete on public.creator_companion_memory;
create policy creator_companion_memory_delete
  on public.creator_companion_memory for delete
  using (owner_id = auth.uid()::text);

-- SELECT widens for a proven Magic Card recall only, reusing the
-- existing has_magic_recall_grant() (supabase/schema.sql) exactly as
-- creator_library does. SELECT-only: a recalled memory is read on the
-- new device, never written back to the original owner's row.
--
-- THERE IS NO PUBLIC BRANCH HERE. creator_projects has one — `is_shared`
-- — because a shared Story is meant to be seen by everybody (Decision
-- 15). A memory is the opposite: it is the private history between one
-- child and their Companion, and nothing about it is ever public.
drop policy if exists creator_companion_memory_select on public.creator_companion_memory;
create policy creator_companion_memory_select
  on public.creator_companion_memory for select
  using (
    owner_id = auth.uid()::text
    or public.has_magic_recall_grant(owner_id)
  );

commit;
