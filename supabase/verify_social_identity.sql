-- ---------------------------------------------------------------
-- DID SPRINT SOCIAL 1 LAND? — one answer, one word per check.
-- ---------------------------------------------------------------
-- Run this AFTER supabase/migrations_social_identity.sql. Paste the
-- whole file into the Supabase SQL Editor and press Run; the last
-- statement is the only one that returns anything, and every row of
-- it says PASS or FAIL. The verdict is the top row.
--
-- IT LEAVES NOTHING BEHIND. Every probe here is structural — the
-- column, the uniqueness, the two functions, and what recall now
-- returns — read from the catalogs, never written to a table.
--
-- WHAT IT DOES NOT DO: it does not prove ownership or uniqueness by
-- BEHAVING as two different sessions. The SQL Editor runs as the
-- owner, for whom auth.uid() is null and RLS is bypassed, so a
-- behavioural probe here would prove the wrong thing convincingly.
-- Behaviour — claim ok / taken / reserved / invalid / not_yours /
-- already_named, and recall carrying the username — is proved
-- against a real PostgreSQL, as real sessions, in
-- tools/social-identity-test/run-social-identity-tests.js.
-- ---------------------------------------------------------------

set client_min_messages = warning;

drop table if exists _verify_social_identity;
create temp table _verify_social_identity (
  ord      int,
  check_   text,
  expected text,
  got      text
);

do $$
declare
  v_col   int;
  v_idx   record;
  v_claim text;
  v_recall text;
begin
  -- 1. the username column exists on the identity table
  select count(*) into v_col
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'magic_card_identities'
     and column_name = 'username';
  insert into _verify_social_identity values
    (1, 'username column on magic_card_identities', '1', v_col::text);

  -- 2. the case-insensitive partial unique index
  select indexdef is not null as present,
         indexdef ~* 'unique' as is_unique,
         indexdef ~* 'lower\(username\)' as case_insensitive,
         indexdef ~* 'where.*username is not null' as partial
    into v_idx
    from pg_indexes
   where schemaname = 'public'
     and tablename = 'magic_card_identities'
     and indexname = 'magic_card_identities_username_key';
  insert into _verify_social_identity values
    (2, 'unique index present', 'true', coalesce(v_idx.present::text, 'false')),
    (3, 'index is UNIQUE', 'true', coalesce(v_idx.is_unique::text, 'false')),
    (4, 'index is on lower(username)', 'true', coalesce(v_idx.case_insensitive::text, 'false')),
    (5, 'index is partial (nulls free)', 'true', coalesce(v_idx.partial::text, 'false'));

  -- 3. the claim function: exists, SECURITY DEFINER, owner-checked,
  --    validating, reserved-listed, race-guarded
  select pg_get_functiondef(p.oid) into v_claim
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'creator_username_claim';
  insert into _verify_social_identity values
    (6, 'creator_username_claim exists', 'true', (v_claim is not null)::text),
    (7, 'claim is SECURITY DEFINER', 'true',
        coalesce((v_claim ~* 'security definer')::text, 'false')),
    (8, 'claim checks owner_id against auth.uid()', 'true',
        coalesce((v_claim ~* 'owner_id is distinct from v_caller')::text, 'false')),
    (9, 'claim validates shape server-side', 'true',
        coalesce((v_claim like '%[a-z0-9_]{3,20}%')::text, 'false')),
    (10, 'claim refuses reserved names', 'true',
        coalesce((v_claim ~* '''reserved''')::text, 'false')),
    (18, 'one shared reserved list (_creator_username_reserved)', 'true',
        coalesce((v_claim ~* '_creator_username_reserved')::text, 'false')),
    (11, 'claim guards the unique race (taken)', 'true',
        coalesce((v_claim ~* 'unique_violation')::text, 'false')),
    (12, 'claim writes only a null username (stable v1)', 'true',
        coalesce((v_claim ~* 'and username is null')::text, 'false'));

  -- 4. recall returns the username with the card
  select pg_get_functiondef(p.oid) into v_recall
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'recall_magic_card';
  insert into _verify_social_identity values
    (13, 'recall_magic_card exists', 'true', (v_recall is not null)::text),
    (14, 'recall returns username', 'true',
        coalesce((v_recall ~* '''username'', v_identity.username')::text, 'false')),
    -- the fields earlier sprints added must have survived the
    -- redefinition — a recall that lost `taught` would silently
    -- re-gate every Creator (Decision 22's own grandfathering).
    (15, 'recall still returns taught', 'true',
        coalesce((v_recall ~* '''taught''')::text, 'false')),
    (16, 'recall still returns companion_id', 'true',
        coalesce((v_recall ~* '''companion_id''')::text, 'false')),
    (17, 'recall still returns the pattern branch', 'true',
        coalesce((v_recall ~* 'when v_by_pattern then v_identity.pattern')::text, 'false'));
end $$;

select
  case when ord = 0 then '' else lpad(ord::text, 2, '0') end as step,
  check_    as check,
  expected  as expected,
  got       as got,
  case when got = expected then 'PASS' else 'FAIL' end as verdict
from (
  select 0 as ord,
         '── OVERALL ──' as check_,
         'all checks pass' as expected,
         case when count(*) filter (where got is distinct from expected) = 0
              then 'all checks pass'
              else count(*) filter (where got is distinct from expected)::text || ' FAILED'
         end as got
    from _verify_social_identity
  union all
  select ord, check_, expected, got from _verify_social_identity
) rows
order by ord;
