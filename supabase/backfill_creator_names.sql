-- ---------------------------------------------------------------
-- BACKFILL: put each Story's maker onto the Story.
--
-- A Story shared before `creatorName` existed carries no maker, so it
-- drifts in the Ether unattributed. Every device stamps the name from
-- now on (js/creatorProjectStore.js), but that only fixes a Story the
-- next time somebody opens and saves it — which for a finished story
-- may be never.
--
-- The platform can answer it directly and authoritatively: a project
-- and a Magic Card are both keyed by owner_id, so the database already
-- knows which card owns which story. This is that join, applied once.
--
-- ONLY WHERE THE ANSWER IS CERTAIN.
--
-- One browser's anonymous session can legitimately own several Magic
-- Cards — siblings on a shared device is the normal case, and
-- supabase/schema.sql says so explicitly. Where an owner has more than
-- one card there is no way to tell WHICH sibling wrote a given story,
-- so those are deliberately left alone. An unattributed story is
-- honest; a story wearing the wrong child's name is not, and it is the
-- exact failure this whole field exists to prevent.
--
-- Idempotent: only touches rows that have no creatorName yet. Safe to
-- run twice. `is_shared` is generated from publishedAt, which this does
-- not touch, so nothing changes about what is public.
-- ---------------------------------------------------------------

begin;

with sole_owner as (
  -- Owners holding exactly one Magic Card, and that card's nickname.
  select owner_id, min(nickname) as nickname
  from public.magic_card_identities
  where coalesce(nickname, '') <> ''
  group by owner_id
  having count(*) = 1
)
update public.creator_projects p
set data = jsonb_set(p.data, '{creatorName}', to_jsonb(s.nickname), true)
from sole_owner s
where p.owner_id = s.owner_id
  and coalesce(p.data->>'creatorName', '') = '';

commit;

-- ---------------------------------------------------------------
-- WHAT HAPPENED. Run after committing.
-- ---------------------------------------------------------------

-- Every shared Story and who it is now attributed to. A blank maker
-- here means that owner holds more than one Magic Card (so it was left
-- alone on purpose) or has none on the platform yet.
select data->>'name'        as story,
       data->>'creatorName' as maker,
       data->>'publishedAt' as shared_at
from public.creator_projects
where is_shared
order by data->>'publishedAt' desc;

-- Owners with several cards — the ones deliberately skipped above.
-- Nothing needs doing here; it is only so the blanks are explainable.
select owner_id, count(*) as cards,
       string_agg(coalesce(nullif(nickname, ''), '(unnamed)'), ', ') as names
from public.magic_card_identities
group by owner_id
having count(*) > 1;
