-- supabase/schema.sql
-- Platform Hardening Sprint — Repository Architecture Transition, Phase 1.
-- See docs/THEME_REPOSITORY_ARCHITECTURE.md for the design this
-- implements. This is a DRAFT for a human to review and run once a real
-- Supabase project exists (via the SQL editor, or `supabase db push`) —
-- it has not been executed or tested against a live project, since this
-- phase has no real project to test against. Re-read the RLS policies
-- before running this against anything real; they are a starting point,
-- not a security audit.

-- ---------------------------------------------------------------
-- Table: themes
-- ---------------------------------------------------------------
create table if not exists public.themes (
  id          uuid primary key default gen_random_uuid(),
  repository  text not null check (repository in ('official', 'personal')),
  -- '' (empty string) for official rows, never NULL — see
  -- docs/THEME_REPOSITORY_ARCHITECTURE.md §2.1 for why NULL would
  -- silently defeat the uniqueness constraint below.
  owner_id    text not null default '',
  theme_id    text not null,
  name        text not null,
  version     text not null,
  manifest    jsonb not null,
  theme       jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (repository, owner_id, theme_id)
);

create index if not exists themes_repository_idx on public.themes (repository);
create index if not exists themes_owner_idx on public.themes (owner_id);

create or replace function public._themes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists themes_set_updated_at on public.themes;
create trigger themes_set_updated_at
  before update on public.themes
  for each row execute function public._themes_set_updated_at();

alter table public.themes enable row level security;

-- Anyone (anonymous or authenticated) can read Official Themes.
create policy if not exists themes_official_select
  on public.themes for select
  using (repository = 'official');

-- A Personal Theme is only visible to the anonymous/authenticated user
-- that owns it (auth.uid(), not a client-supplied id — see §4).
create policy if not exists themes_personal_select
  on public.themes for select
  using (repository = 'personal' and owner_id = auth.uid()::text);

create policy if not exists themes_personal_write
  on public.themes for insert
  with check (repository = 'personal' and owner_id = auth.uid()::text);

create policy if not exists themes_personal_update
  on public.themes for update
  using (repository = 'personal' and owner_id = auth.uid()::text)
  with check (repository = 'personal' and owner_id = auth.uid()::text);

create policy if not exists themes_personal_delete
  on public.themes for delete
  using (repository = 'personal' and owner_id = auth.uid()::text);

-- Deliberately no insert/update/delete policy for repository='official'.
-- Publishing an Official Theme through the anon client has no
-- authorization model yet — this is an open question for Phase 2
-- (replacing Publish), not something to invent here. Until then, an
-- Official Theme row can only be written by a project maintainer via
-- the Supabase dashboard/SQL editor or a service_role script, never
-- from the browser client this sprint's phase produces.

-- ---------------------------------------------------------------
-- Storage bucket: theme-assets
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('theme-assets', 'theme-assets', false)
on conflict (id) do nothing;

-- Public read for anything under the official/ prefix (path convention:
-- theme-assets/official/_official/<theme_id>/<relativePath>).
create policy if not exists theme_assets_official_read
  on storage.objects for select
  using (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official');

-- A Personal asset's direct-object access (independent of the signed
-- URLs js/themeRepositoryClient.js actually uses for reads) is scoped
-- to its owner, matching the table's own RLS split.
create policy if not exists theme_assets_personal_read
  on storage.objects for select
  using (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy if not exists theme_assets_personal_write
  on storage.objects for insert
  with check (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- No insert policy for the official/ prefix, matching the table's own
-- "no anon writes to Official" stance above.
