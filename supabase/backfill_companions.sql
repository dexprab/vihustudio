-- ---------------------------------------------------------------
-- BACKFILL: put each Story's Companion onto the Story.
--
-- Sprint 1 (Companion as World Host) makes a Story carry the Companion
-- of the child who made it, so a Traveller opening it meets somebody
-- living in that world. Every device stamps it from now on
-- (js/creatorProjectStore.js), and a one-shot local sweep there repairs
-- the Stories a device still holds — but neither can reach a Story
-- whose authoring device is no longer to hand, and there is no way to
-- re-share a Story that is already shared. Reported exactly that way:
-- "i would like you to repair all stories which are in ether already."
--
-- The platform can answer it directly and authoritatively, because it
-- already knows: a project and a Magic Card are both keyed by
-- `owner_id`, and `magic_card_identities` carries the bonded Companion
-- (companion_id / companion_name / companion_species, added when the
-- Creator Ceremony bonds a card). This is that join, applied once.
--
-- Deliberately the same shape as backfill_creator_names.sql beside it,
-- because it is the same problem with a different column, and a second
-- shape would be a second thing to reason about.
--
-- ONLY WHERE THE ANSWER IS CERTAIN.
--
-- One browser session can legitimately own several Magic Cards —
-- siblings on a shared device is the normal case, and
-- supabase/schema.sql says so explicitly. Where an owner has more than
-- one card there is no way to tell WHICH sibling made a given Story,
-- so those are left alone. A Story with no host is honest; a Story
-- wearing another child's Companion is not, and it is the exact
-- failure CLAUDE.md -> Decision 24 forbids ("never the Traveller's
-- own, never a generic one, never one made up for the visit"). A card
-- with no bonded Companion is skipped for the same reason: there is
-- nothing true to write.
--
-- WHAT IT WRITES. The same structured record the app writes, so both
-- sides agree: { id, name, species }. js/companionRecord.js is the
-- contract, and it is deliberately open — a field added there later
-- travels through the store, the feed and the resolver untouched, so
-- this file never needs to learn about it.
--
-- Idempotent: only touches rows with no companion yet. Safe to run
-- twice. `is_shared` is generated from publishedAt, which this does not
-- touch, so nothing changes about what is public — and jsonb_set edits
-- one key, leaving pages, images and everything else exactly as they
-- are.
-- ---------------------------------------------------------------

begin;

with sole_owner as (
  -- Owners holding exactly one Magic Card, and that card's bonded
  -- Companion. A card whose Ceremony has not happened yet has no
  -- companion_id and is excluded here rather than written as null.
  select owner_id,
         min(companion_id)      as companion_id,
         min(companion_name)    as companion_name,
         min(companion_species) as companion_species
  from public.magic_card_identities
  where coalesce(companion_id, '') <> ''
  group by owner_id
  having count(*) = 1
)
update public.creator_projects p
set data = jsonb_set(
      p.data,
      '{companion}',
      jsonb_strip_nulls(jsonb_build_object(
        'id',      s.companion_id,
        'name',    coalesce(nullif(s.companion_name, ''), s.companion_id),
        'species', nullif(s.companion_species, '')
      )),
      true)
from sole_owner s
where p.owner_id = s.owner_id
  and p.data->'companion' is null;

commit;

-- ---------------------------------------------------------------
-- WHAT HAPPENED. Run after committing.
-- ---------------------------------------------------------------

-- Every shared Story and who now hosts it. A blank host means that
-- owner holds more than one Magic Card, or holds none on the platform,
-- or their card has no bonded Companion yet — all three are deliberate
-- skips, not failures.
select data->>'name'                as story,
       data->>'creatorName'         as maker,
       data->'companion'->>'id'     as host,
       data->>'publishedAt'         as shared_at
from public.creator_projects
where is_shared
order by data->>'publishedAt' desc;

-- The Stories still without a host, and why. Run this before deciding
-- anything is broken.
select p.data->>'name' as story,
       (select count(*) from public.magic_card_identities m
         where m.owner_id = p.owner_id) as cards_this_owner,
       (select count(*) from public.magic_card_identities m
         where m.owner_id = p.owner_id
           and coalesce(m.companion_id, '') <> '') as cards_with_a_companion
from public.creator_projects p
where p.is_shared
  and p.data->'companion' is null;

-- A sanity check that nothing else moved: page counts before and after
-- should be identical, because jsonb_set touched one key.
select data->>'name' as story,
       jsonb_array_length(coalesce(data->'pages', data->'slides', '[]'::jsonb)) as pages
from public.creator_projects
where is_shared
order by 1;
