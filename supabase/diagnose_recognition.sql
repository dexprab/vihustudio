-- ---------------------------------------------------------------
-- WHY IS THIS SKY NOT RECOGNISED? — one card, every possible cause.
-- ---------------------------------------------------------------
-- Reported for @thegod (MC-00106): "am not able to login into thegod
-- account even when magic card pattern is correct."
--
-- Drawing recognition can fail for exactly THREE data reasons, and
-- they present identically to the child:
--
--   STALE SKY   — the stored pattern is not the one on the physical
--                 card. The known mechanism: at claim time the
--                 platform refuses a sky another Creator already
--                 holds and re-rolls a fresh one (mint_magic_card →
--                 pattern_taken), and that re-roll is ASYNC — a card
--                 displayed or printed in the Ceremony before the
--                 reserve answered shows the PRE-roll sky forever.
--   DUPLICATE   — more than one identity holds this same sky as a
--                 SET. recall_magic_card answers identity_conflict,
--                 which the child sees as "I can't see the whole sky
--                 from here right now" — it reads as network trouble
--                 and no retry can ever succeed. Test accounts are
--                 the likely second holder; deleting the duplicate
--                 from the admin console fixes it.
--   NO SKY      — the row's pattern is null/empty (a typed-code
--                 recall stores none), so drawing can never match.
--
-- EDIT THE CODE on the line marked >>> and run the whole file in the
-- SQL Editor. ONE result set (the editor shows one panel): a verdict,
-- the facts, any duplicate holders by code, and the stored sky drawn
-- as a 10×10 chart — hold the physical card beside it. If the chart
-- and the card DISAGREE, the chart is what the platform will
-- recognise: the card's art is stale (STALE SKY above), and the way
-- back in is recall by card code (tools/test-account → "Bring an
-- account onto this device"), after which a reprint carries the true
-- sky. Read-only; changes nothing.
-- ---------------------------------------------------------------

with target as (
  select * from public.magic_card_identities
   where code = 'MC-00106'                       -- >>> EDIT ME <<<
),
dupes as (
  select i.code, i.nickname, i.username, i.claimed_at
    from public.magic_card_identities i, target t
   where i.id <> t.id
     and i.pattern is not null and t.pattern is not null
     and public._card_platform_sort_pattern(i.pattern)
         = public._card_platform_sort_pattern(t.pattern)
),
grid as (
  select r.r as ord,
         'sky row ' || r.r as what,
         string_agg(
           case when exists (
             select 1 from target t, jsonb_array_elements(t.pattern) e
              where (e->>0)::int = r.r and (e->>1)::int = c.c)
           then '★' else '·' end, ' ' order by c.c) as detail
    from generate_series(0,9) r(r), generate_series(0,9) c(c)
   group by r.r
)
select * from (
  select 0 as ord, 'VERDICT' as what,
         case
           when not exists (select 1 from target)
             then 'NO SUCH CODE — edit the code at the >>> line'
           when (select pattern is null or jsonb_array_length(pattern) = 0 from target)
             then 'NO SKY — the row holds no pattern; drawing can never match. Recall by code, then reprint.'
           when exists (select 1 from dupes)
             then 'DUPLICATE SKY — recall answers identity_conflict for everyone drawing it. Delete the duplicate(s) listed below (admin console), then drawing works again.'
           else 'UNIQUE SKY — compare the chart below with the physical card. Same: the failure is client-side (try recall by code). Different: the card art is stale; the chart is the truth.'
         end as detail
  union all
  select 1, 'card',
         coalesce((select code || ' · ' || coalesce(nullif(nickname,''),'(unnamed)')
                     || ' · @' || coalesce(nullif(username,''),'—')
                     || ' · ' || constellation from target), '(not found)')
  union all
  select 2, 'stars stored',
         coalesce((select jsonb_array_length(pattern)::text from target), '—')
  union all
  select 3, 'duplicate holders of this exact sky',
         coalesce((select string_agg(code || ' (' || coalesce(nullif(nickname,''),'?') || ')', ' · ')
                     from dupes), 'none')
  union all
  select ord + 10, what, detail from grid
) v
order by ord;
