-- ---------------------------------------------------------------
-- DID THE COMPANION MEMORY TABLE LAND? — one answer, one word per check.
-- ---------------------------------------------------------------
-- Run this AFTER supabase/migrations_companion_memory.sql. Paste the
-- whole file into the Supabase SQL Editor and press Run; the last
-- statement is the only one that returns anything, and every row of it
-- says PASS or FAIL.
--
-- Same shape, and for the same reason, as
-- supabase/verify_edge_rate_limit.sql: the editor surfaces ONE result
-- panel, so a file that ends in several similar-looking probes cannot be
-- told apart from a failure at a glance. Nothing here asks a human to
-- compare anything — the verdict is the top row.
--
-- IT LEAVES NOTHING BEHIND. The behavioural probes write against a
-- reserved card id that no child can hold, and the block deletes those
-- rows before the verdict is printed. Safe to run on a live project, as
-- often as you like.
--
-- WHAT IT DOES NOT DO: it does not prove RLS by becoming another
-- Creator. The SQL Editor runs as the table's owner, for whom RLS is
-- bypassed, so a policy probe here would pass whatever the policies
-- said — the worst kind of green. Policy TEXT is checked here; policy
-- BEHAVIOUR is proved against a real PostgreSQL, as another session,
-- in tools/companion-memory-test/run-companion-memory-tests.js.
-- ---------------------------------------------------------------

set client_min_messages = warning;

drop table if exists _verify_companion_memory;
create temp table _verify_companion_memory (
  ord      int,
  check_   text,
  expected text,
  got      text
);

do $$
declare
  v_card constant text := '__verify__';
  v_rls  boolean;
  v_cols text;
  v_pol  int;
  v_ins  text;
  v_upd  text;
  v_del  text;
  v_sel  text;
  v_uniq int;
  v_idx  int;
  v_null boolean;
  v_hit  int;
  v_left int;
begin
  -- ---- structure --------------------------------------------------
  select relrowsecurity into v_rls
    from pg_class where oid = 'public.creator_companion_memory'::regclass;
  insert into _verify_companion_memory values
    (10, 'table exists, RLS enabled', 'true', coalesce(v_rls::text, 'missing'));

  select string_agg(column_name, ',' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'creator_companion_memory';
  insert into _verify_companion_memory values
    (11, 'stores a moment, never a log',
     'id,owner_id,card_id,companion_id,kind,content,importance,confidence,source,entities,dedupe_key,protected,status,created_at,last_referenced_at',
     coalesce(v_cols, 'missing'));

  -- A Traveller must have no row here at all, and that is what NOT NULL
  -- on card_id enforces. Decision 19: a Traveller is stateless.
  select is_nullable = 'NO' into v_null
    from information_schema.columns
   where table_schema = 'public' and table_name = 'creator_companion_memory'
     and column_name = 'card_id';
  insert into _verify_companion_memory values
    (12, 'a memory cannot exist without a Creator', 'true',
     coalesce(v_null::text, 'missing'));

  select count(*) into v_uniq from pg_constraint
   where conrelid = 'public.creator_companion_memory'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) ilike '%(card_id, dedupe_key)%';
  insert into _verify_companion_memory values
    (13, 'deduplication is a CONSTRAINT, not a habit', '1', v_uniq::text);

  select count(*) into v_idx from pg_indexes
   where schemaname = 'public' and tablename = 'creator_companion_memory'
     and indexname in ('creator_companion_memory_card_idx',
                       'creator_companion_memory_owner_idx',
                       'creator_companion_memory_entities_idx');
  insert into _verify_companion_memory values
    (14, 'retrieval has its indexes', '3', v_idx::text);

  -- ---- who can read it --------------------------------------------
  select count(*) into v_pol from pg_policies
   where schemaname = 'public' and tablename = 'creator_companion_memory';
  insert into _verify_companion_memory values
    (20, 'four policies, one per command', '4', v_pol::text);

  select with_check into v_ins from pg_policies
   where schemaname = 'public' and tablename = 'creator_companion_memory'
     and policyname = 'creator_companion_memory_insert';
  insert into _verify_companion_memory values
    (21, 'INSERT is the verified session, never a claimed one', 'auth.uid()',
     case when coalesce(v_ins, '') like '%auth.uid()%' then 'auth.uid()'
          else coalesce(nullif(v_ins, ''), 'missing') end);

  select qual into v_upd from pg_policies
   where schemaname = 'public' and tablename = 'creator_companion_memory'
     and policyname = 'creator_companion_memory_update';
  insert into _verify_companion_memory values
    (22, 'UPDATE is owner-scoped', 'auth.uid()',
     case when coalesce(v_upd, '') like '%auth.uid()%' then 'auth.uid()'
          else coalesce(nullif(v_upd, ''), 'missing') end);

  select qual into v_del from pg_policies
   where schemaname = 'public' and tablename = 'creator_companion_memory'
     and policyname = 'creator_companion_memory_delete';
  insert into _verify_companion_memory values
    (23, 'DELETE is owner-scoped', 'auth.uid()',
     case when coalesce(v_del, '') like '%auth.uid()%' then 'auth.uid()'
          else coalesce(nullif(v_del, ''), 'missing') end);

  select qual into v_sel from pg_policies
   where schemaname = 'public' and tablename = 'creator_companion_memory'
     and policyname = 'creator_companion_memory_select';
  insert into _verify_companion_memory values
    (24, 'SELECT is the owner, or a PROVEN recall', 'owner + recall grant',
     case when coalesce(v_sel, '') like '%auth.uid()%'
               and coalesce(v_sel, '') like '%has_magic_recall_grant%'
          then 'owner + recall grant'
          else coalesce(nullif(v_sel, ''), 'missing') end);

  -- A memory is never public. creator_projects widens for `is_shared`
  -- because a shared Story is meant to be seen; this is the opposite.
  insert into _verify_companion_memory values
    (25, 'NOTHING here is public', 'no public branch',
     case when coalesce(v_sel, '') ilike '%is_shared%'
               or coalesce(v_sel, '') ~ '(^|[^_a-z])true([^_a-z]|$)'
          then 'A PUBLIC BRANCH EXISTS'
          else 'no public branch' end);

  -- ---- behaviour ---------------------------------------------------
  delete from public.creator_companion_memory where card_id like v_card || '%';

  insert into public.creator_companion_memory
    (id, owner_id, card_id, kind, content, dedupe_key)
  values ('__verify_a__', '__verify_owner__', v_card, 'shared',
          'A verification memory.', 'first-story');

  -- The whole feature: asking twice is not two memories.
  begin
    insert into public.creator_companion_memory
      (id, owner_id, card_id, kind, content, dedupe_key)
    values ('__verify_b__', '__verify_owner__', v_card, 'shared',
            'The same moment, recorded again.', 'first-story');
    insert into _verify_companion_memory values
      (30, 'the same moment twice is ONE memory', 'refused', 'A SECOND ROW WAS MADE');
  exception when unique_violation then
    insert into _verify_companion_memory values
      (30, 'the same moment twice is ONE memory', 'refused', 'refused');
  end;

  -- ...but two Creators each get their own past.
  insert into public.creator_companion_memory
    (id, owner_id, card_id, kind, content, dedupe_key)
  values ('__verify_c__', '__verify_owner__', v_card || '-2', 'shared',
          'Another Creator, the same milestone.', 'first-story');
  select count(*) into v_hit from public.creator_companion_memory
   where card_id like v_card || '%' and dedupe_key = 'first-story';
  insert into _verify_companion_memory values
    (31, 'two Creators keep separate pasts', '2', v_hit::text);

  -- A transcript is not a memory, and the column says so.
  begin
    insert into public.creator_companion_memory
      (id, owner_id, card_id, kind, content, dedupe_key)
    values ('__verify_d__', '__verify_owner__', v_card, 'shared',
            repeat('x', 401), 'too-long');
    insert into _verify_companion_memory values
      (32, 'a transcript will not fit', 'refused', 'A TRANSCRIPT WAS STORED');
  exception when check_violation then
    insert into _verify_companion_memory values
      (32, 'a transcript will not fit', 'refused', 'refused');
  end;

  -- Four memory types, and no fifth invented by a caller.
  begin
    insert into public.creator_companion_memory
      (id, owner_id, card_id, kind, content, dedupe_key)
    values ('__verify_e__', '__verify_owner__', v_card, 'everything',
            'A kind nobody agreed to.', 'bad-kind');
    insert into _verify_companion_memory values
      (33, 'only the four agreed kinds', 'refused', 'A FIFTH KIND WAS STORED');
  exception when check_violation then
    insert into _verify_companion_memory values
      (33, 'only the four agreed kinds', 'refused', 'refused');
  end;

  -- ---- leave nothing behind ----------------------------------------
  delete from public.creator_companion_memory where card_id like v_card || '%';
  select count(*) into v_left from public.creator_companion_memory
   where card_id like v_card || '%';
  insert into _verify_companion_memory values
    (40, 'the probes left nothing behind', '0', v_left::text);
exception when undefined_table or undefined_function then
  insert into _verify_companion_memory values
    (1, 'MIGRATION NOT APPLIED', 'run migrations_companion_memory.sql first', 'missing');
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
    from _verify_companion_memory
  union all
  select ord, check_, expected, got from _verify_companion_memory
) rows
order by ord;
