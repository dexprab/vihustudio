-- ===================================================================
-- VERIFY THE IDENTITY HARDENING LANDED
--
-- Paste this whole file into the Supabase SQL editor and read the four
-- rows it returns. It changes nothing.
--
-- Every row should say OK. Anything else is worth telling me about.
-- ===================================================================

select
  '1. constellation CHECK' as check,
  case when position('TRIANGULUM' in pg_get_constraintdef(oid)) > 0
       then 'OK — all 18 families accepted'
       else 'NOT APPLIED — new families still rejected'
  end as result,
  null::bigint as count
from pg_constraint
where conname = 'magic_card_identities_constellation_check'

union all

select
  '2. canonical unique index',
  case when count(*) = 1
       then 'OK — one canonical pattern, one Creator'
       else 'MISSING — duplicates can still be created'
  end,
  count(*)
from pg_indexes
where schemaname = 'public'
  and indexname = 'magic_card_identities_canonical_pattern_key'

union all

select
  '3. recall has no LIMIT 1',
  case when position('identity_conflict' in prosrc) > 0
            and position('limit 1' in lower(prosrc)) = 0
       then 'OK — conflicts refuse, no Sky opens'
       else 'NOT APPLIED — recall can still pick one of two'
  end,
  null::bigint
from pg_proc
where proname = 'recall_magic_card'

union all

select
  '4. mint_magic_card exists',
  case when count(*) > 0
       then 'OK — minting is race-safe'
       else 'MISSING — minting cannot reserve'
  end,
  count(*)
from pg_proc
where proname = 'mint_magic_card';


-- -------------------------------------------------------------------
-- And the number the Identity Foundation Report is still missing:
-- how many Creators exist, and whether any two share a pattern.
--
-- `duplicate_patterns` MUST be 0 — the unique index would not have
-- installed otherwise — so this is a confirmation rather than a
-- question. `creators` is simply how many skies are out there.
-- -------------------------------------------------------------------
select
  count(*)                                                       as creators,
  count(distinct public._card_platform_sort_pattern(pattern))    as distinct_patterns,
  count(*) - count(distinct public._card_platform_sort_pattern(pattern))
                                                                 as duplicate_patterns,
  count(*) filter (where constellation not in
    ('ORION','CASSIOPEIA','URSA_MAJOR','CYGNUS','LYRA'))          as on_new_families
from public.magic_card_identities;
