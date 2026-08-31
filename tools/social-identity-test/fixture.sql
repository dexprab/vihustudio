-- Fixture for run-social-identity-tests.js — the smallest slice of the
-- real database that supabase/migrations_social_identity.sql needs.
--
-- Same convention as tools/companion-memory-test/fixture.sql: the
-- pieces copied from supabase/schema.sql are copied VERBATIM (the
-- identity table with its generated code column, the recalls table,
-- _card_platform_sort_pattern), so the migration under test meets the
-- real shapes rather than a simplified stand-in — recall_magic_card()
-- reads code, taught, the companion bond and the pattern helper, and a
-- fixture without them would prove a function that cannot deploy.
--
-- auth.uid() reads a settable session variable, which is what lets
-- this suite BE a given browser session — and therefore prove that a
-- caller cannot name a stranger's identity, rather than assert it.

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

-- ---- verbatim from supabase/schema.sql -----------------------------
create or replace function public._card_platform_sort_pattern(p_pattern jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(elem order by (elem->>0)::int, (elem->>1)::int),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_pattern) elem;
$$;

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
  taught         jsonb,
  unique (serial_no)
);

create table if not exists public.magic_card_recalls (
  id            uuid primary key default gen_random_uuid(),
  identity_id   text not null references public.magic_card_identities(id) on delete cascade,
  recaller_id   text not null default '',
  recalled_at   timestamptz not null default now()
);

create table if not exists public.creator_projects (
  id          text primary key,
  owner_id    text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  is_shared   boolean generated always as ((data->>'publishedAt') is not null) stored
);

alter table public.magic_card_identities enable row level security;
alter table public.magic_card_recalls enable row level security;

-- Owner-only CRUD, the schema's own policy shape — enough for the
-- snapshot-upsert probe to behave the way a real browser session does.
drop policy if exists magic_card_identities_select on public.magic_card_identities;
create policy magic_card_identities_select on public.magic_card_identities
  for select using (owner_id = auth.uid()::text);
drop policy if exists magic_card_identities_insert on public.magic_card_identities;
create policy magic_card_identities_insert on public.magic_card_identities
  for insert with check (owner_id = auth.uid()::text);
drop policy if exists magic_card_identities_update on public.magic_card_identities;
create policy magic_card_identities_update on public.magic_card_identities
  for update using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

grant select, insert, update on public.magic_card_identities to anon, authenticated;
grant select on public.magic_card_recalls to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
