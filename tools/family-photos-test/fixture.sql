-- Fixture for run-family-photos-tests.js — the smallest slice of the
-- real database that migrations_family_album_link.sql actually touches.
--
-- The two tables are COPIED VERBATIM from supabase/schema.sql (column
-- for column, policy for policy) so the migration under test runs
-- against the real shapes and the real INSERT policy — which is the
-- whole obstacle it exists to get past. Nothing here is a simplified
-- stand-in for something the migration reads.
--
-- `auth.uid()` and the three Supabase roles do not exist in a bare
-- Postgres, so they are created here. auth.uid() reads a settable
-- session variable, which lets the suite BE a given browser session and
-- prove that a parent's session genuinely cannot do the insert itself.

create schema if not exists auth;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- ---- verbatim from supabase/schema.sql ----------------------------
create table if not exists public.magic_card_identities (
  id             text primary key,
  serial_no      bigserial not null,
  code           text generated always as ('MC-' || lpad(serial_no::text, 5, '0')) stored,
  owner_id       text not null,
  nickname       text not null default '',
  constellation  text not null
                   check (constellation in ('ORION','CASSIOPEIA','URSA_MAJOR','CYGNUS','LYRA')),
  pattern        jsonb not null,
  claimed_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  companion_id      text,
  companion_name    text,
  companion_species text,
  parent_email   text,
  unique (serial_no)
);

create table if not exists public.family_albums (
  id          text primary key,
  owner_id    text not null,
  album_url   text not null,
  label       text,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.family_albums enable row level security;

drop policy if exists family_albums_insert on public.family_albums;
create policy family_albums_insert
  on public.family_albums for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists family_albums_update on public.family_albums;
create policy family_albums_update
  on public.family_albums for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists family_albums_delete on public.family_albums;
create policy family_albums_delete
  on public.family_albums for delete
  using (owner_id = auth.uid()::text);

drop policy if exists family_albums_select on public.family_albums;
create policy family_albums_select
  on public.family_albums for select
  using (owner_id = auth.uid()::text);

grant select, insert, update, delete on public.family_albums to anon, authenticated;
grant select on public.magic_card_identities to anon, authenticated;
