-- ---------------------------------------------------------------
-- THE CREATORS ROLL — every Creator on the platform, and what they
-- have made.
--
-- Asked for by the product owner: "a page showing all creators with
-- their name, date they became creator, number of stories, companion,
-- parent email id."
--
-- ---------------------------------------------------------------
-- READ THIS BEFORE PUTTING IT ON A PAGE.
--
-- Every column below is a child's personal data, and one of them is a
-- parent's email address. CLAUDE.md -> Decision 14 is explicit that the
-- parent email is NOT an account and is "never revealed to the
-- browser" — the whole Sky Protection design turns on the address only
-- ever being written to, never read back out.
--
-- VihuPlanet also has no accounts and no login by design (Decisions 11
-- and 14), so there is no such thing as an authenticated administrator
-- in the app. That means there is nowhere in vihuplanet.com this can
-- safely be rendered: an unlisted URL is not access control, and
-- anything the browser can fetch, anyone can fetch.
--
-- So this is a QUERY, not a page. It runs in the Supabase SQL editor,
-- which is already behind the project's own authentication — the one
-- place on the platform where an administrator genuinely exists.
-- ---------------------------------------------------------------

-- One row per Creator, newest first.
select
  coalesce(nullif(m.nickname, ''), '(unnamed)')      as creator,
  m.code                                             as card,
  m.claimed_at::date                                 as became_creator,
  m.last_active_at::date                             as last_seen,
  coalesce(m.companion_name, m.companion_id, '—')    as companion,
  coalesce(nullif(m.companion_species, ''), '—')     as species,
  coalesce(nullif(m.parent_email, ''), 'not protected') as parent_email,
  -- Stories are keyed by owner_id, the browser session that made them —
  -- NOT by card. A session holding several cards (siblings on one
  -- machine) cannot have its stories split between them, so this counts
  -- what the session made and the sibling case is called out below
  -- rather than silently divided.
  (select count(*) from public.creator_projects p
     where p.owner_id = m.owner_id)                  as stories,
  (select count(*) from public.creator_projects p
     where p.owner_id = m.owner_id and p.is_shared)  as shared_to_ether,
  (select count(*) from public.magic_card_identities s
     where s.owner_id = m.owner_id)                  as cards_on_this_device
from public.magic_card_identities m
order by m.claimed_at desc;

-- ---------------------------------------------------------------
-- WHERE THE STORY COUNTS ARE AMBIGUOUS.
--
-- Any row above with cards_on_this_device > 1 is siblings sharing one
-- browser, and its `stories` count is the DEVICE's total rather than
-- that child's own. There is no way to attribute a story to one of
-- several cards on the same session — the same reason
-- backfill_creator_names.sql and backfill_companions.sql both skip
-- these rows rather than guess.
-- ---------------------------------------------------------------
select m.owner_id,
       count(*)                                       as cards,
       string_agg(coalesce(nullif(m.nickname, ''), '(unnamed)'), ', ') as children,
       (select count(*) from public.creator_projects p
          where p.owner_id = m.owner_id)              as stories_between_them
from public.magic_card_identities m
group by m.owner_id
having count(*) > 1;

-- ---------------------------------------------------------------
-- A COUNT, for a glance rather than a list.
-- ---------------------------------------------------------------
select count(*)                                                  as creators,
       count(*) filter (where coalesce(parent_email,'') <> '')    as skies_protected,
       count(*) filter (where coalesce(companion_id,'')  <> '')   as with_a_companion,
       count(*) filter (where claimed_at > now() - interval '7 days') as new_this_week
from public.magic_card_identities;
