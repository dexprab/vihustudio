-- Fixture for run-companion-gap-tests.js — the smallest slice of the
-- real database that supabase/migrations_gap_log.sql needs.
--
-- auth.uid() and auth.jwt() read settable session variables, which is
-- what lets this suite BE a given browser session (and BE an
-- administrator's signed-in session), so ownership and the admin gate
-- are proved rather than asserted.
--
-- platform_admins and is_platform_admin() are copied from
-- supabase/migrations_admin_console.sql VERBATIM in the parts the gap
-- log consults — the pg_net webhook machinery that migration also
-- carries is not, because a scratch cluster has no pg_net and the gap
-- log never touches it.

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select case when nullif(current_setting('test.email', true), '') is null
    then '{}'::jsonb
    else jsonb_build_object('email', current_setting('test.email', true))
  end;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- ---- from supabase/migrations_admin_console.sql --------------------
create table if not exists public.platform_admins (
  email text primary key,
  note  text
);
alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated, anon;
