-- ===================================================================
-- Reset: All Themes (Official + Personal) + Their Assets + World Cards
-- ===================================================================
-- A DISCLOSED, UNEXECUTED, one-time data-wipe script -- not part of
-- supabase/schema.sql (which only ever defines tables/policies/RPCs,
-- never deletes live data). Run it yourself in the Supabase Dashboard
-- -> SQL Editor, after reading it. This has never been run against
-- your project -- this sandbox has no network path to Supabase.
--
-- WHAT THIS DELETES:
--   1. Every row in public.cards + public.card_redemptions
--      (World Cards -- formerly "Vihu Card" -- both repositories)
--   2. Every row in public.themes (Official AND Personal repositories)
--   3. Every Storage object in the theme-assets bucket (the images
--      belonging to those themes)
--
-- WHAT THIS DOES NOT TOUCH (left completely alone):
--   - public.builder_projects   -- World Builder's own editable Project
--                                  drafts (Scenes/Places/Experiences),
--                                  a person's in-progress, unpublished
--                                  work -- a genuinely different thing
--                                  from a published Theme.
--   - public.creator_projects   -- Studio/Creator's own Story drafts,
--                                  same reasoning.
--   - public.magic_card_identities / public.magic_card_recalls
--                                -- Magic Cards (a Creator's own
--                                  signinless identity) are a DIFFERENT,
--                                  separate system from World Cards --
--                                  see docs/WORLD_CARD_PLATFORM.md
--                                  section 6.2. Not touched here.
--   - The draft-assets Storage bucket (images that belong to the
--     project drafts above, not to a published Theme).
--   - The database schema itself (tables/policies/functions all stay
--     exactly as they are -- only rows/objects are removed).
--
-- If you also want project drafts or Magic Card identities wiped, say
-- so explicitly and a separate script can be written for that -- it
-- was deliberately left out here since your own request named
-- "themes, their data, world cards," not drafts or identities.
--
-- SCOPE: this clears BOTH the Official and Personal repositories. If
-- you only want ONE repository cleared, add a `where repository =
-- 'personal'` (or 'official') to the DELETE FROM public.themes
-- statement near the bottom, and swap the cards deletion's implicit
-- "everything" for a join against only the theme_ids you kept.
-- ===================================================================


-- -------------------------------------------------------------------
-- STEP 0 (safe, non-destructive) -- run this first to see what you're
-- about to delete. Nothing below this point changes any data.
-- -------------------------------------------------------------------
select
  (select count(*) from public.themes)            as themes_total,
  (select count(*) from public.themes where repository = 'official') as themes_official,
  (select count(*) from public.themes where repository = 'personal') as themes_personal,
  (select count(*) from public.cards)              as world_cards_total,
  (select count(*) from public.card_redemptions)   as card_redemptions_total,
  (select count(*) from storage.objects where bucket_id = 'theme-assets') as theme_asset_objects_total;


-- -------------------------------------------------------------------
-- STEP 1 -- DESTRUCTIVE. Uncomment and run everything below once
-- you've reviewed Step 0's counts and are sure. There is no undo.
-- -------------------------------------------------------------------

-- 1a. World Card redemption records first (card_redemptions.card_id
--     already has ON DELETE CASCADE against cards(id), so deleting
--     cards below would remove these automatically anyway -- this is
--     just explicit rather than relying on the cascade silently).
-- delete from public.card_redemptions;

-- 1b. World Cards themselves (both any 'official'/'personal'-targeted
--     cards -- target_repository is always 'personal' today per the
--     schema's own check constraint, but this clears every card
--     regardless of who owns it or which theme it targets).
-- delete from public.cards;

-- 1c. Every Storage object under the theme-assets bucket -- the real
--     image bytes for every Official + Personal theme. Deleting these
--     via SQL against storage.objects works the same way
--     ThemeRepositoryClient.reset() already does it in the app, just
--     for literally everything instead of one repository's prefix.
-- delete from storage.objects where bucket_id = 'theme-assets';

-- 1d. The theme rows themselves -- both repositories. Do this LAST so
--     nothing above needs the themes rows to still exist for a
--     foreign-key check (there are none here, but this keeps the
--     ordering intuitive: assets/cards for a theme go before the
--     theme record itself).
-- delete from public.themes;


-- -------------------------------------------------------------------
-- STEP 2 (safe, non-destructive) -- run again after Step 1 to confirm
-- everything above actually cleared. Every count should read 0.
-- -------------------------------------------------------------------
-- select
--   (select count(*) from public.themes)            as themes_remaining,
--   (select count(*) from public.cards)              as world_cards_remaining,
--   (select count(*) from public.card_redemptions)   as card_redemptions_remaining,
--   (select count(*) from storage.objects where bucket_id = 'theme-assets') as theme_asset_objects_remaining;
