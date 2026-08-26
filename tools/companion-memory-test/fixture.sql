-- Fixture for run-companion-memory-tests.js — the smallest slice of the
-- real database that supabase/migrations_companion_memory.sql needs.
--
-- Same convention as tools/family-photos-test/fixture.sql: the pieces
-- copied from supabase/schema.sql are copied VERBATIM, so the migration
-- under test meets the real shapes and the real recall grant rather than
-- a simplified stand-in.
--
-- `auth.uid()` and the Supabase roles do not exist in a bare PostgreSQL.
-- auth.uid() reads a settable session variable, which is what lets this
-- suite BE a given browser session — and therefore prove that Creator B
-- genuinely cannot read Creator A's memories, rather than assert it.

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
create table if not exists public.magic_card_identities (
  id             text primary key,
  owner_id       text not null,
  nickname       text not null default '',
  constellation  text not null,
  pattern        jsonb not null,
  claimed_at     timestamptz not null default now()
);

create table if not exists public.magic_card_recalls (
  id           text primary key,
  identity_id  text not null,
  recaller_id  text not null,
  created_at   timestamptz not null default now()
);

create or replace function public.has_magic_recall_grant(p_owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.magic_card_recalls r
    join public.magic_card_identities i on i.id = r.identity_id
    where i.owner_id = p_owner
      and r.recaller_id = auth.uid()::text
  );
$$;

grant execute on function public.has_magic_recall_grant(text) to anon, authenticated;
