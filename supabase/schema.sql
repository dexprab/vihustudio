-- supabase/schema.sql
-- Platform Hardening Sprint — Repository Architecture Transition
-- (Supabase MEP). See docs/THEME_REPOSITORY_ARCHITECTURE.md for the
-- full design. This is the MINIMAL schema this sprint actually needs:
-- Official Themes + Personal Themes, nothing else. A human runs this
-- once via the Supabase SQL Editor (or `supabase db push`) — it has
-- not been executed against a live project, since this environment
-- cannot reach Supabase (see docs/THEME_REPOSITORY_ARCHITECTURE.md §8).
--
-- Trimmed from the Phase 1 draft: no updated_at trigger, no
-- denormalized name/version columns (both were premature for "a few
-- themes"; the full manifest is already selected wherever those
-- values are needed), no extra indexes (not required at this scale).
-- One thing was ADDED beyond Phase 1's draft: Official rows are now
-- writable by the anon role, because "Builder -> Publish Official
-- Theme -> Supabase" is this sprint's own explicit requirement — see
-- the disclosure comment above those policies below.
--
-- Platform Status & Repository Reset sprint added delete policies for
-- both repositories/both tables (themes + storage.objects) — the one
-- capability deliberately left out of every earlier draft, now required
-- so ThemeRepositoryClient.reset() can actually remove published Themes
-- and their assets, restoring a clean post-install state on demand.
--
-- Idempotency note: PostgreSQL's CREATE POLICY has no IF NOT EXISTS
-- clause (unlike CREATE TABLE/INDEX/SCHEMA) — an earlier draft of this
-- file used that syntax and would have failed with a syntax error on
-- the very first policy statement against a real project. Every policy
-- below is instead made re-runnable with `drop policy if exists ...`
-- immediately before `create policy ...` (DROP POLICY does support IF
-- EXISTS), so this whole script can be run more than once against the
-- same project with no error, matching CREATE TABLE IF NOT EXISTS's
-- and INSERT ... ON CONFLICT's own idempotency below.

-- ---------------------------------------------------------------
-- Table: themes
-- ---------------------------------------------------------------
create table if not exists public.themes (
  id          uuid primary key default gen_random_uuid(),
  repository  text not null check (repository in ('official', 'personal')),
  -- '' (empty string) for official rows, never NULL — Postgres treats
  -- every NULL as distinct from every other NULL for uniqueness
  -- purposes, which would silently defeat the constraint below for
  -- every official row.
  owner_id    text not null default '',
  theme_id    text not null,
  manifest    jsonb not null,
  theme       jsonb not null,
  created_at  timestamptz not null default now(),
  unique (repository, owner_id, theme_id)
);

alter table public.themes enable row level security;

-- Anyone (anonymous or authenticated) can read Official Themes.
drop policy if exists themes_official_select on public.themes;
create policy themes_official_select
  on public.themes for select
  using (repository = 'official');

-- Anyone can publish/replace an Official Theme. DISCLOSED, DELIBERATE
-- GAP: there is no admin/authorization concept anywhere in this app
-- yet (see docs/THEME_REPOSITORY_ARCHITECTURE.md §5's original
-- "no anon-writable policy" stance) — but this sprint's own stated
-- happy flow is literally "Builder -> Publish Official Theme ->
-- Supabase," which cannot work without this. Anyone holding the anon
-- key can currently overwrite any Official Theme. Resolving "who may
-- publish Official" is real, necessary future work (a small allowlist
-- or a real authenticated admin role), not something to invent here.
drop policy if exists themes_official_write on public.themes;
create policy themes_official_write
  on public.themes for insert
  with check (repository = 'official');

drop policy if exists themes_official_update on public.themes;
create policy themes_official_update
  on public.themes for update
  using (repository = 'official')
  with check (repository = 'official');

-- A Personal Theme is only visible to and writable by the anonymous/
-- authenticated user that owns it (auth.uid(), not a client-supplied
-- id — see docs/THEME_REPOSITORY_ARCHITECTURE.md §4).
drop policy if exists themes_personal_select on public.themes;
create policy themes_personal_select
  on public.themes for select
  using (repository = 'personal' and owner_id = auth.uid()::text);

drop policy if exists themes_personal_write on public.themes;
create policy themes_personal_write
  on public.themes for insert
  with check (repository = 'personal' and owner_id = auth.uid()::text);

drop policy if exists themes_personal_update on public.themes;
create policy themes_personal_update
  on public.themes for update
  using (repository = 'personal' and owner_id = auth.uid()::text)
  with check (repository = 'personal' and owner_id = auth.uid()::text);

-- Delete policies (Platform Status & Repository Reset sprint) — the one
-- capability the original schema deliberately left out ("not part of
-- the Publish -> Discover happy flow"), now required by
-- ThemeRepositoryClient.reset(). Official delete carries the same
-- disclosed, deliberate authorization gap as themes_official_write/
-- _update above — anyone holding the anon key can reset the Official
-- Repository; real Official-authorization is the same necessary future
-- work already named for write/update.
drop policy if exists themes_official_delete on public.themes;
create policy themes_official_delete
  on public.themes for delete
  using (repository = 'official');

drop policy if exists themes_personal_delete on public.themes;
create policy themes_personal_delete
  on public.themes for delete
  using (repository = 'personal' and owner_id = auth.uid()::text);

-- ---------------------------------------------------------------
-- Storage bucket: theme-assets
-- Path convention: {repository}/{owner_id-or-'_official'}/{theme_id}/{relativePath}
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('theme-assets', 'theme-assets', false)
on conflict (id) do nothing;

drop policy if exists theme_assets_official_read on storage.objects;
create policy theme_assets_official_read
  on storage.objects for select
  using (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official');

drop policy if exists theme_assets_official_write on storage.objects;
create policy theme_assets_official_write
  on storage.objects for insert
  with check (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official');

drop policy if exists theme_assets_official_update on storage.objects;
create policy theme_assets_official_update
  on storage.objects for update
  using (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official')
  with check (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official');

-- A Personal asset is scoped to its owner (js/themeRepositoryClient.js
-- reads every asset via createSignedUrl(), which itself checks this
-- select policy at signing time — not a public URL; see
-- docs/THEME_REPOSITORY_ARCHITECTURE.md §2.2).
drop policy if exists theme_assets_personal_read on storage.objects;
create policy theme_assets_personal_read
  on storage.objects for select
  using (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists theme_assets_personal_write on storage.objects;
create policy theme_assets_personal_write
  on storage.objects for insert
  with check (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists theme_assets_personal_update on storage.objects;
create policy theme_assets_personal_update
  on storage.objects for update
  using (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Delete policies (Platform Status & Repository Reset sprint) — required
-- by ThemeRepositoryClient.reset() to actually remove uploaded assets,
-- not just the themes row that referenced them.
drop policy if exists theme_assets_official_delete on storage.objects;
create policy theme_assets_official_delete
  on storage.objects for delete
  using (bucket_id = 'theme-assets' and (storage.foldername(name))[1] = 'official');

drop policy if exists theme_assets_personal_delete on storage.objects;
create policy theme_assets_personal_delete
  on storage.objects for delete
  using (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
