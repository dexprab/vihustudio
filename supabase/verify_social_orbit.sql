-- ---------------------------------------------------------------
-- DID SPRINT SOCIAL 2 (ORBIT & CIRCLE) LAND? — one word per check.
-- ---------------------------------------------------------------
-- Run AFTER supabase/migrations_social_orbit.sql. Structural only —
-- ownership, mutuality and no-enumeration are proved as real
-- sessions in tools/social-orbit-test/run-social-orbit-tests.js.
-- Read-only; leaves nothing behind.
-- ---------------------------------------------------------------

set client_min_messages = warning;

drop table if exists _verify_social_orbit;
create temp table _verify_social_orbit (
  ord int, check_ text, expected text, got text
);

do $$
declare
  v_rls boolean;
  v_pol int;
  v_set text;
  v_list text;
begin
  select relrowsecurity into v_rls from pg_class
   where oid = 'public.creator_orbits'::regclass;
  insert into _verify_social_orbit values
    (1, 'creator_orbits exists with RLS ON', 'true', coalesce(v_rls::text,'missing'));

  select count(*) into v_pol from pg_policies
   where schemaname='public' and tablename='creator_orbits';
  insert into _verify_social_orbit values
    (2, 'and NO policies — functions are the only door', '0', v_pol::text);

  select pg_get_functiondef(p.oid) into v_set
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creator_orbit_set';
  insert into _verify_social_orbit values
    (3, 'creator_orbit_set exists', 'true', (v_set is not null)::text),
    (4, 'set is SECURITY DEFINER', 'true',
        coalesce((v_set ~* 'security definer')::text,'false')),
    (5, 'set verifies the caller owns the orbiter', 'true',
        coalesce((v_set ~* 'owner_id is distinct from v_caller')::text,'false')),
    (6, 'adding twice is a success (on conflict do nothing)', 'true',
        coalesce((v_set ~* 'on conflict do nothing')::text,'false'));

  select pg_get_functiondef(p.oid) into v_list
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creator_orbit_list';
  insert into _verify_social_orbit values
    (7, 'creator_orbit_list exists', 'true', (v_list is not null)::text),
    (8, 'list is owner-verified too', 'true',
        coalesce((v_list ~* 'owner_id is distinct from v_caller')::text,'false')),
    (9, 'the ONLY reverse fact is the mutual circle bit', 'true',
        coalesce((v_list ~* 'back\.orbiter_id = o\.orbited_id')::text,'false'));
end $$;

select
  case when ord = 0 then '' else lpad(ord::text, 2, '0') end as step,
  check_ as check, expected, got,
  case when got = expected then 'PASS' else 'FAIL' end as verdict
from (
  select 0 as ord, '── OVERALL ──' as check_, 'all checks pass' as expected,
         case when count(*) filter (where got is distinct from expected) = 0
              then 'all checks pass'
              else count(*) filter (where got is distinct from expected)::text || ' FAILED' end as got
    from _verify_social_orbit
  union all
  select ord, check_, expected, got from _verify_social_orbit
) rows
order by ord;
