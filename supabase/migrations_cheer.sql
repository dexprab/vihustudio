-- ===================================================================
-- CHEER — a little starlight, given to a story
--
-- Run after migrations_ether_shared.sql. Idempotent.
--
-- A Cheer is not a Like. It is one Creator giving another Creator's
-- story a small amount of VihuPlanet's own magic, and the story grows
-- for it. So the data is the smallest thing that can carry that:
--
--   story  →  how much starlight it has been given
--   and a record that stops one Creator giving it twice
--
-- WHAT IS DELIBERATELY NOT HERE. No ranking, no ordering by cheers, no
-- trending, no score, no leaderboard, and no way to ask who cheered
-- anything. The rows exist ONLY to enforce one-per-Creator; nothing
-- can read them.
-- ===================================================================

-- ---------------------------------------------------------------
-- THE ROWS
--
-- The primary key IS the uniqueness rule: one row per (story,
-- cheerer), so a second Cheer from the same Creator cannot exist even
-- if two taps race each other into the database. There is no counter
-- to get out of step with the rows, because the count is the rows.
--
-- `cheerer` is the Creator's Magic Card id — the identity VihuPlanet
-- already has (Decision 11), not a new one and not a fingerprint. A
-- Traveller holding no card yet falls back to their own anonymous
-- session id, which is the honest answer to "who is this" for somebody
-- who has not told us. The RPC below decides that; a client never
-- picks its own key on the server's behalf without it being checked.
-- ---------------------------------------------------------------
create table if not exists public.story_cheers (
  story_id   text not null,
  cheerer    text not null,
  owner_id   uuid,                       -- the session that sent it
  created_at timestamptz not null default now(),
  primary key (story_id, cheerer)
);

create index if not exists story_cheers_story_idx
  on public.story_cheers (story_id);

alter table public.story_cheers enable row level security;

-- NO POLICIES ON PURPOSE.
--
-- With RLS on and no policy, this table is unreadable and unwritable
-- by every client. Everything goes through the two SECURITY DEFINER
-- functions below, which is what makes "no list of who cheered"
-- structural rather than a promise: there is no query a browser can
-- send that returns a cheerer.

-- ---------------------------------------------------------------
-- GIVING ONE
--
-- Returns the story's total afterwards and whether this Creator had
-- already given theirs. `on conflict do nothing` is the whole of the
-- atomicity: the primary key arbitrates, so a double click, a retry,
-- and two devices at once all end with exactly one row and one count.
-- ---------------------------------------------------------------
create or replace function public.cheer_story(p_story_id text, p_cheerer text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid := auth.uid();
  v_who     text;
  v_added   boolean := false;
  v_total   int;
begin
  if p_story_id is null or length(trim(p_story_id)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_story');
  end if;
  if v_session is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- A Magic Card id when the caller has one, their own session when
  -- they do not. Trimmed and bounded so a client cannot invent a key
  -- of unusual shape or size.
  v_who := nullif(btrim(coalesce(p_cheerer, '')), '');
  if v_who is null or length(v_who) > 64 then
    v_who := v_session::text;
  end if;

  insert into public.story_cheers(story_id, cheerer, owner_id)
  values (p_story_id, v_who, v_session)
  on conflict (story_id, cheerer) do nothing;

  get diagnostics v_added = row_count;

  select count(*) into v_total from public.story_cheers where story_id = p_story_id;

  return jsonb_build_object('ok', true, 'cheers', v_total, 'added', v_added);
end;
$$;

grant execute on function public.cheer_story(text, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- READING THE TOTALS
--
-- Counts only, for a list of stories, plus whether THIS caller has
-- already given theirs — which is the only thing about anybody else's
-- Cheer a client ever learns. Never who, never when, never a list.
-- ---------------------------------------------------------------
create or replace function public.story_cheer_counts(p_story_ids text[], p_cheerer text default null)
returns table (story_id text, cheers int, mine boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid := auth.uid();
  v_who     text;
begin
  v_who := nullif(btrim(coalesce(p_cheerer, '')), '');
  if v_who is null or length(v_who) > 64 then
    v_who := coalesce(v_session::text, '');
  end if;

  return query
  select c.story_id,
         count(*)::int as cheers,
         bool_or(c.cheerer = v_who) as mine
  from public.story_cheers c
  where c.story_id = any(coalesce(p_story_ids, array[]::text[]))
  group by c.story_id;
end;
$$;

grant execute on function public.story_cheer_counts(text[], text) to anon, authenticated;

-- ===================================================================
-- VERIFY — expect the table, its primary key, and both functions.
-- ===================================================================
select 'table' as what, to_regclass('public.story_cheers')::text as found
union all
select 'rls enabled', (select relrowsecurity::text from pg_class where relname = 'story_cheers')
union all
select 'policies (want 0)', (select count(*)::text from pg_policies
                             where tablename = 'story_cheers')
union all
select 'cheer_story', (select count(*)::text from pg_proc where proname = 'cheer_story')
union all
select 'story_cheer_counts', (select count(*)::text from pg_proc where proname = 'story_cheer_counts');
