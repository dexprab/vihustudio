-- ---------------------------------------------------------------
-- DID SPRINT SOCIAL SKY R1 LAND? — one word per check.
-- ---------------------------------------------------------------
-- Run AFTER supabase/migrations_social_sky.sql (which itself needs
-- migrations_social_identity.sql and migrations_social_orbit.sql).
-- Structural only — ownership, eligibility, mutuality and the
-- historical rule are proved as real sessions in
-- tools/social-sky-test/run-social-sky-tests.js.
-- Read-only; leaves nothing behind.
-- ---------------------------------------------------------------

set client_min_messages = warning;

drop table if exists _verify_social_sky;
create temp table _verify_social_sky (
  ord int, check_ text, expected text, got text
);

do $$
declare
  v_rls boolean;
  v_pol int;
  v_sky text;
  v_send text;
  v_list text;
  v_get text;
  v_mark text;
  v_mut text;
begin
  select relrowsecurity into v_rls from pg_class
   where oid = 'public.creator_shows'::regclass;
  insert into _verify_social_sky values
    (1, 'creator_shows exists with RLS ON', 'true', coalesce(v_rls::text,'missing'));

  select count(*) into v_pol from pg_policies
   where schemaname='public' and tablename='creator_shows';
  insert into _verify_social_sky values
    (2, 'and NO policies — functions are the only door', '0', v_pol::text);

  select pg_get_functiondef(p.oid) into v_sky
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creator_sky_list' and p.prokind='f';
  insert into _verify_social_sky values
    (3, 'creator_sky_list exists', 'true', (v_sky is not null)::text),
    (4, 'sky list is owner-verified', 'true',
        coalesce((v_sky ~* 'owner_id is distinct from v_caller')::text,'false')),
    (5, 'new stars are choosers I have NOT chosen back', 'true',
        coalesce((v_sky ~* 'not exists')::text,'false')),
    (6, 'a chooser with no public username never surfaces', 'true',
        coalesce((v_sky ~* 'i\.username is not null')::text,'false'));

  select pg_get_functiondef(p.oid) into v_send
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creation_show_send' and p.prokind='f';
  insert into _verify_social_sky values
    (7, 'creation_show_send exists', 'true', (v_send is not null)::text),
    (8, 'send is owner-verified', 'true',
        coalesce((v_send ~* 'owner_id is distinct from v_caller')::text,'false')),
    (9, 'send requires the SENDER to have chosen the recipient', 'true',
        coalesce((v_send ~* 'orbiter_id = v_me\.id and orbited_id = v_them\.id')::text,'false')),
    (10, 'the payload is capped', 'true',
        coalesce((v_send ~* 'too_big')::text,'false')),
    (22, 'R2: the Creator''s note travels on the show, verbatim', 'true',
        coalesce((v_send ~* 'p_note')::text,'false')),
    (23, 'R2: the Companion''s given name travels with it', 'true',
        coalesce((v_send ~* 'p_companion_name')::text,'false'));

  select pg_get_functiondef(p.oid) into v_list
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creation_show_list' and p.prokind='f';
  insert into _verify_social_sky values
    (11, 'creation_show_list exists (recipient-only, metadata only)', 'true',
        (v_list is not null)::text),
    (12, 'gifts list is owner-verified', 'true',
        coalesce((v_list ~* 'owner_id is distinct from v_caller')::text,'false')),
    (13, 'a sender can never list what they sent', 'true',
        coalesce((v_list ~* 'to_id = p_identity_id')::text,'false')),
    (21, 'gift rows carry the CARRIER — the sender''s Companion', 'true',
        coalesce((v_list ~* 'companion_id')::text,'false'));

  select pg_get_functiondef(p.oid) into v_get
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creation_show_get' and p.prokind='f';
  insert into _verify_social_sky values
    (14, 'creation_show_get exists and is recipient-only', 'true',
        coalesce((v_get ~* 'to_id = v_me\.id')::text,'false')),
    (24, 'R2: the note is returned by GET (the reveal), and by get alone', 'true',
        coalesce((v_get ~* 'v_show\.note')::text,'false'));

  select pg_get_functiondef(p.oid) into v_mark
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creation_show_mark' and p.prokind='f';
  insert into _verify_social_sky values
    (15, 'creation_show_mark exists', 'true', (v_mark is not null)::text),
    (16, 'mark never re-checks eligibility (historical rule)', 'true',
        coalesce((not v_mark ~* 'not_chosen')::text,'false'));

  select pg_get_functiondef(p.oid) into v_mut
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='creator_mutual_projects' and p.prokind='f';
  insert into _verify_social_sky values
    (17, 'creator_mutual_projects exists', 'true', (v_mut is not null)::text),
    (18, 'mutuality is checked LIVE, both directions', 'true',
        coalesce((v_mut ~* 'orbiter_id = v_them\.id and orbited_id = v_me\.id')::text,'false')),
    (19, 'only non-Ether work is returned', 'true',
        coalesce((v_mut ~* 'is_shared is not true')::text,'false')),
    (20, 'held rite stories are never returned', 'true',
        coalesce((v_mut ~* 'riteInProgress')::text,'false'));
end $$;

select
  case when ord = 0 then '' else lpad(ord::text, 2, '0') end as step,
  check_ as check, expected, got,
  case when got = expected then 'PASS' else 'FAIL' end as verdict
from _verify_social_sky
union all
select '', 'OVERALL', '', '',
  case when exists (select 1 from _verify_social_sky where got <> expected)
       then 'FAIL' else 'PASS' end
order by 1;
