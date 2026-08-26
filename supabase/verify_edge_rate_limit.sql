-- ---------------------------------------------------------------
-- DID THE RATE LIMITER LAND? — one answer, in one word per check.
-- ---------------------------------------------------------------
-- Run this AFTER supabase/migrations_edge_rate_limit.sql. Paste the
-- whole file into the Supabase SQL Editor and press Run; the last
-- statement is the only one that returns anything, and every row of it
-- says PASS or FAIL.
--
-- WHY THIS IS ITS OWN FILE, AND WHY IT ENDS IN A VERDICT
--
-- These checks used to sit at the foot of the migration, and pasting
-- that whole thing into the editor is how the problem showed up: the
-- editor surfaces ONE result panel, so four probes each returning a
-- similar JSON blob left the person running it staring at
-- {"allowed": true, "remaining": 1} with no way to know whether that
-- was the system working or the system broken. It was working. That it
-- could not be told apart at a glance is the defect.
--
-- So nothing here asks a human to compare JSON. Every probe is run, its
-- answer is checked against what it should be, and the output is a
-- table of check / expected / got / verdict with a summary row on top.
--
-- IT LEAVES NOTHING BEHIND. The probes write to a reserved bucket that
-- no Edge Function uses, and the block deletes those rows before the
-- verdict is printed. Nobody's real allowance is touched. Safe to run
-- as often as you like, on a live project, at any time.
--
-- AN HOUR-LONG WINDOW, not a minute. A short window could roll over
-- between two probes, handing a subject a fresh allowance and failing
-- "stays refused" for a reason that has nothing to do with the limiter.
-- ---------------------------------------------------------------

-- Quiet the "table does not exist, skipping" notice from the drop
-- below. The Supabase editor surfaces notices alongside results, and
-- the whole point of this file is that what you see is the answer.
set client_min_messages = warning;

-- 1. Somewhere to put the answers. A temp table, so it exists only for
--    this session and needs no cleanup of its own.
drop table if exists _verify_edge_rate_limit;
create temp table _verify_edge_rate_limit (
  ord      int,
  check_   text,
  expected text,
  got      text
);

-- 2. Run every probe IN ORDER. A DO block rather than CTEs, because
--    independent CTEs have no guaranteed evaluation order and these
--    probes increment a counter — the order is the whole point.
do $$
declare
  -- v_ prefixed, because a plain `bucket` collides with the column of
  -- that name and PL/pgSQL refuses the DELETE as ambiguous. Caught by
  -- running this file rather than by reading it.
  v_bucket constant text := '__verify__';
  v_win    constant int  := 3600;
  a1 jsonb; a2 jsonb; a3 jsonb; b1 jsonb; z jsonb; n jsonb;
  v_rls  boolean;
  v_pol  int;
  v_def  boolean;
  v_pub  boolean;
  v_svc  boolean;
  v_cols text;
begin
  -- ---- structure -------------------------------------------------
  select relrowsecurity into v_rls
    from pg_class where oid = 'public.edge_rate_limits'::regclass;
  insert into _verify_edge_rate_limit values
    (10, 'table exists, RLS enabled', 'true', coalesce(v_rls::text, 'missing'));

  select count(*) into v_pol from pg_policies
   where schemaname = 'public' and tablename = 'edge_rate_limits';
  insert into _verify_edge_rate_limit values
    (11, 'zero policies (only the definer reads it)', '0', v_pol::text);

  select string_agg(column_name, ',' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'edge_rate_limits';
  insert into _verify_edge_rate_limit values
    (12, 'stores only how many, never what', 'bucket,subject,window_start,hits',
     coalesce(v_cols, 'missing'));

  select p.prosecdef into v_def from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'edge_rate_limit_hit';
  insert into _verify_edge_rate_limit values
    (13, 'function is SECURITY DEFINER', 'true', coalesce(v_def::text, 'missing'));

  -- Grants. A browser must not be able to count itself; the Edge
  -- Functions, which hold the service role, must.
  v_pub := has_function_privilege('public',
    'public.edge_rate_limit_hit(text,text,integer,integer)', 'execute');
  insert into _verify_edge_rate_limit values
    (14, 'PUBLIC cannot execute it', 'false', v_pub::text);

  begin
    v_svc := has_function_privilege('service_role',
      'public.edge_rate_limit_hit(text,text,integer,integer)', 'execute');
  exception when others then
    v_svc := null;   -- no service_role on this cluster (a bare Postgres)
  end;
  insert into _verify_edge_rate_limit values
    (15, 'service_role can execute it', 'true', coalesce(v_svc::text, 'no such role'));

  -- ---- behaviour -------------------------------------------------
  -- Two allowed, then refused. This is the whole feature.
  a1 := public.edge_rate_limit_hit(v_bucket, 'subject-a', 2, v_win);
  a2 := public.edge_rate_limit_hit(v_bucket, 'subject-a', 2, v_win);
  a3 := public.edge_rate_limit_hit(v_bucket, 'subject-a', 2, v_win);
  insert into _verify_edge_rate_limit values
    (20, 'first call allowed, one left', 'true/1',
     (a1->>'allowed') || '/' || (a1->>'remaining'));
  insert into _verify_edge_rate_limit values
    (21, 'second call allowed, none left', 'true/0',
     (a2->>'allowed') || '/' || (a2->>'remaining'));
  insert into _verify_edge_rate_limit values
    (22, 'THIRD CALL REFUSED', 'false', a3->>'allowed');
  insert into _verify_edge_rate_limit values
    (23, 'a refusal says when to come back', 'within the window',
     case when (a3->>'retry_after')::int between 1 and v_win
          then 'within the window' else a3->>'retry_after' end);

  -- One caller's exhaustion is not another's.
  b1 := public.edge_rate_limit_hit(v_bucket, 'subject-b', 2, v_win);
  insert into _verify_edge_rate_limit values
    (24, 'a different caller has its own allowance', 'true', b1->>'allowed');

  -- A limit of zero is a kill switch, not an open door.
  z := public.edge_rate_limit_hit(v_bucket, 'subject-c', 0, v_win);
  insert into _verify_edge_rate_limit values
    (25, 'a limit of zero means closed', 'false', z->>'allowed');

  -- An unattributable call is exactly what this exists to stop.
  n := public.edge_rate_limit_hit(v_bucket, '', 5, v_win);
  insert into _verify_edge_rate_limit values
    (26, 'a call with no caller is refused', 'false', n->>'allowed');

  -- ---- leave nothing behind --------------------------------------
  delete from public.edge_rate_limits where bucket = v_bucket;
  insert into _verify_edge_rate_limit values
    (30, 'the probes left nothing behind', '0',
     (select count(*)::text from public.edge_rate_limits where bucket = v_bucket));
exception when undefined_table or undefined_function then
  insert into _verify_edge_rate_limit values
    (1, 'MIGRATION NOT APPLIED', 'run migrations_edge_rate_limit.sql first', 'missing');
end $$;

-- 3. THE ANSWER. The only statement that returns rows, so it is what
--    the Supabase SQL Editor shows.
select
  case when ord = 0 then '' else lpad(ord::text, 2, '0') end as step,
  check_    as check,
  expected  as expected,
  got       as got,
  case when got = expected then 'PASS' else 'FAIL' end as verdict
from (
  -- The summary, first, so the answer is the top line rather than
  -- something to be worked out by reading down a column.
  select 0 as ord,
         '── OVERALL ──' as check_,
         'all checks pass' as expected,
         case when count(*) filter (where got is distinct from expected) = 0
              then 'all checks pass'
              else count(*) filter (where got is distinct from expected)::text || ' FAILED'
         end as got
    from _verify_edge_rate_limit
  union all
  select ord, check_, expected, got from _verify_edge_rate_limit
) rows
order by ord;
