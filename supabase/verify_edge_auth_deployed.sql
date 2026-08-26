-- ---------------------------------------------------------------
-- AFTER DEPLOYING — the two things that can now fail SILENTLY.
-- ---------------------------------------------------------------
-- Run this in the Supabase SQL Editor once the five Edge Functions are
-- deployed. One result, one word per check, same shape as
-- supabase/verify_edge_rate_limit.sql.
--
-- Everything else about this sprint fails LOUDLY: a browser that cannot
-- authenticate gets a 401 it can see, and a child hears silence instead
-- of a voice. These two do not.
--
--   1. creator-born is now SERVICE-ONLY. Its only caller is the
--      notify_creator_born() trigger, which sends whatever key sits in
--      platform_settings.creator_born_key. Before this sprint the ANON
--      key worked there, because Supabase's gateway accepts it. It does
--      not work now — and the symptom is no email when a child becomes
--      a Creator, which nobody notices until they go looking.
--
--   2. invite-send is now ADMINISTRATORS ONLY, matched against
--      platform_admins by the email the auth server returns. An empty
--      table means the admin console can no longer send an invitation.
--
-- IT NEVER PRINTS A KEY. The check decodes only the `role` claim out of
-- the stored JWT — which names a role and authorises nothing — and the
-- key itself never reaches the result. Reading a secret out of the
-- database and putting it on screen would be a worse habit than the one
-- this sprint fixed.
-- ---------------------------------------------------------------

set client_min_messages = warning;

drop table if exists _verify_edge_auth;
create temp table _verify_edge_auth (ord int, check_ text, expected text, got text);

do $$
declare
  v_key   text;
  v_role  text;
  v_url   text;
  v_admins int;
begin
  -- ---- 1. the trigger's credential --------------------------------
  select value into v_key from public.platform_settings where key = 'creator_born_key';
  select value into v_url from public.platform_settings where key = 'creator_born_url';

  if v_key is null or v_key = '' then
    v_role := 'not configured';
  else
    begin
      -- A JWT's middle segment, base64url-decoded, and only its `role`.
      v_role := coalesce(
        (convert_from(
           decode(
             rpad(translate(split_part(v_key, '.', 2), '-_', '+/'),
                  length(split_part(v_key, '.', 2)) +
                    ((4 - length(split_part(v_key, '.', 2)) % 4) % 4),
                  '='),
             'base64'),
           'utf8')::jsonb ->> 'role'),
        'unreadable');
    exception when others then
      v_role := 'unreadable';
    end;
  end if;

  insert into _verify_edge_auth values
    (10, 'creator_born_key is the SERVICE ROLE key', 'service_role', v_role);
  insert into _verify_edge_auth values
    (11, 'creator_born_url points at the function', 'ends /creator-born',
     case when coalesce(v_url, '') like '%/functions/v1/creator-born'
          then 'ends /creator-born'
          else coalesce(nullif(v_url, ''), 'not configured') end);

  -- ---- 2. somebody can still send an invitation --------------------
  begin
    select count(*) into v_admins from public.platform_admins;
  exception when undefined_table then
    v_admins := -1;
  end;
  insert into _verify_edge_auth values
    (20, 'platform_admins has at least one administrator', 'yes',
     case when v_admins < 0 then 'table missing'
          when v_admins = 0 then 'EMPTY — invite-send will refuse everybody'
          else 'yes' end);

  -- ---- 3. the limiter this sprint depends on -----------------------
  insert into _verify_edge_auth values
    (30, 'the rate limiter is installed', 'yes',
     case when to_regclass('public.edge_rate_limits') is null
          then 'MISSING — run migrations_edge_rate_limit.sql'
          else 'yes' end);
end $$;

select
  lpad(ord::text, 2, '0') as step,
  check_   as check,
  expected as expected,
  got      as got,
  case when got = expected then 'PASS' else 'FAIL' end as verdict
from (
  select 0 as ord, '── OVERALL ──' as check_, 'all checks pass' as expected,
         case when count(*) filter (where got is distinct from expected) = 0
              then 'all checks pass'
              else count(*) filter (where got is distinct from expected)::text || ' FAILED'
         end as got
    from _verify_edge_auth
  union all
  select ord, check_, expected, got from _verify_edge_auth
) rows
order by ord;
