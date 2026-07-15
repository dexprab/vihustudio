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
-- Vihu Card Platform v1 sprint added `cards`/`card_redemptions` plus
-- this file's first RPC (`redeem_card`, SECURITY DEFINER) and extended
-- the two Personal-Theme read policies (`themes_personal_select`,
-- `theme_assets_personal_read`) with an additive cross-owner grant for
-- a live redeemer — see the "Vihu Card Platform v1" section below and
-- docs/VIHU_CARD_PLATFORM.md for the full design.
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

-- ---------------------------------------------------------------
-- Table: builder_projects
-- A deliberate, disclosed extension beyond this file's original scope
-- note above ("Official Themes + Personal Themes, nothing else"): the
-- `themes` table only ever holds a *compiled* Theme (Build output).
-- `builder_projects` is the raw, editable World Builder Project itself
-- (Scenes/Places/Experiences/Frames, pre-compilation) — previously
-- localStorage-only (js/projectStore.js), so a cleared browser or a
-- quota failure could silently lose in-progress authoring with no
-- backup anywhere. This table is a background cloud copy of that same
-- data, owner-scoped via the same anonymous-session auth.uid() the
-- Personal Theme Repository already uses — "local-primary, cloud
-- backup," never a second source of truth: js/projectStore.js's
-- localStorage write is still what the Workspace reads from/renders
-- immediately; this table only exists so that write isn't the only
-- copy of a Project that exists anywhere.
--
-- One row per Project, `data` holding the exact same JSON shape
-- ProjectStore already persists to localStorage (id/name/tagline/
-- description/icon/status/createdAt/updatedAt/files/lastBuild) — no
-- separate asset-extraction/Storage-object pipeline the way `themes`
-- has, since a Builder Project isn't meant to be a portable, shared,
-- referenced-file bundle the way a compiled Theme is; it is one
-- creator's own private working copy. A very large authored Project
-- (many uploaded images, each already downscaled client-side per
-- AV-009) fits comfortably in a jsonb column at this scale — revisit
-- only if that stops being true.
-- ---------------------------------------------------------------
create table if not exists public.builder_projects (
  id          text primary key,
  owner_id    text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.builder_projects enable row level security;

-- Owner-only, full stop — a Builder Project has no "official" or
-- "shared" concept the way a Theme does; every row is exactly one
-- anonymous session's own private backup.
drop policy if exists builder_projects_select on public.builder_projects;
create policy builder_projects_select
  on public.builder_projects for select
  using (owner_id = auth.uid()::text);

drop policy if exists builder_projects_insert on public.builder_projects;
create policy builder_projects_insert
  on public.builder_projects for insert
  with check (owner_id = auth.uid()::text);

drop policy if exists builder_projects_update on public.builder_projects;
create policy builder_projects_update
  on public.builder_projects for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

drop policy if exists builder_projects_delete on public.builder_projects;
create policy builder_projects_delete
  on public.builder_projects for delete
  using (owner_id = auth.uid()::text);

-- ---------------------------------------------------------------
-- Vihu Card Platform v1 — Tables: cards, card_redemptions
-- ---------------------------------------------------------------
-- A "magic card" unlocks one Personal Theme in Creator for a limited
-- number of tries/duration, redeemed by matching a real constellation's
-- shape on a 10x10 grid. This is the platform's first genuinely new
-- Supabase capability since the Theme Repository itself — see
-- docs/VIHU_CARD_PLATFORM.md for the full design.
--
-- Uniqueness model, deliberate and load-bearing for the schema below:
-- `constellation` (e.g. 'ORION') is a REUSABLE flavor label, not a
-- unique key — many different cards can be "Orion." What is unique
-- per card is (a) its own randomly-placed `pattern` (the exact grid
-- coordinates), which is what a tap-to-redeem match compares against
-- directly, with no name involved at all, and (b) `code` (a DB-
-- generated serial, e.g. "BC-00125"), which combined with
-- `constellation` is required for the secondary typed-fallback
-- redemption path. A schema that instead made `constellation` unique
-- would cap the whole platform at 5 live cards, ever — this was a
-- real design bug caught and corrected during the wireframe pass.
create table if not exists public.cards (
  id                 uuid primary key default gen_random_uuid(),
  serial_no          bigserial not null,
  -- Generated, not client-supplied — genuinely unique with zero
  -- client-side retry/collision handling. Produces exactly the
  -- "BC-00125" display format already used throughout the product.
  code               text generated always as ('BC-' || lpad(serial_no::text, 5, '0')) stored,
  -- The full reserved-vocabulary list from the approved card-type
  -- family, even though v1's application code (js/cardPlatform.js)
  -- only ever writes 'builder' — keeps the schema forward-compatible
  -- with the other 5 types with no later migration required.
  card_type          text not null default 'builder'
                       check (card_type in ('builder','creator','unlock','event','achievement','classroom')),
  owner_id           text not null,
  target_repository  text not null default 'personal' check (target_repository = 'personal'),
  target_theme_id    text not null,
  constellation      text not null
                       check (constellation in ('ORION','CASSIOPEIA','URSA_MAJOR','CYGNUS','LYRA')),
  -- This card's own randomized placement (translate/rotate/mirror) of
  -- the named constellation's shape — a jsonb array of [row,col]
  -- pairs on the 10x10 field. Matched as a SET on redemption, never by
  -- stored order (see redeem_card() below), so no canonical ordering
  -- is required of the writer.
  pattern            jsonb not null,
  label              text not null default '',
  rarity             text not null
                       check (rarity in ('common','uncommon','rare','epic','legendary')),
  -- NULL = unlimited tries / forever, matching js/cardPlatform.js's
  -- own computeRarity()'s Infinity handling.
  max_tries          integer check (max_tries is null or max_tries >= 1),
  tries_used         integer not null default 0,
  duration_seconds   bigint check (duration_seconds is null or duration_seconds >= 0),
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz,
  unique (serial_no)
);

alter table public.cards enable row level security;

-- Owner-only read/update/delete — a card's own pattern/code/
-- constellation/target must never be readable by anyone but its
-- author via a direct SELECT; redemption goes exclusively through the
-- redeem_card() RPC below, which is the ONLY thing allowed to compare
-- against those columns.
drop policy if exists cards_owner_select on public.cards;
create policy cards_owner_select
  on public.cards for select
  using (owner_id = auth.uid()::text);

-- A card can only be minted for a Personal Theme its own author
-- already owns — the exists() subquery is what actually enforces
-- this, not just the owner_id match on the cards row itself.
drop policy if exists cards_owner_insert on public.cards;
create policy cards_owner_insert
  on public.cards for insert
  with check (
    owner_id = auth.uid()::text
    and exists (
      select 1 from public.themes t
      where t.repository = 'personal'
        and t.owner_id = auth.uid()::text
        and t.theme_id = target_theme_id
    )
  );

drop policy if exists cards_owner_update on public.cards;
create policy cards_owner_update
  on public.cards for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

-- Kept available (js/cardPlatform.js's revoke() uses a soft revoked_at
-- update instead, so card_redemptions rows referencing this card via
-- FK stay valid) but not exercised by any v1 UI path.
drop policy if exists cards_owner_delete on public.cards;
create policy cards_owner_delete
  on public.cards for delete
  using (owner_id = auth.uid()::text);

-- One row per successful redemption — both an audit log and the live
-- grant record the cross-owner Theme-read policies below key off of.
create table if not exists public.card_redemptions (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid not null references public.cards(id) on delete cascade,
  redeemer_id  text not null default '',
  redeemed_at  timestamptz not null default now(),
  expires_at   timestamptz
);

alter table public.card_redemptions enable row level security;

-- A redemption is visible to whoever redeemed it, or to the card's
-- own owner (so a Builder-side "who has redeemed my card" view is
-- possible later with no schema change). No insert/update/delete
-- policy exists for any client role — RLS enabled with zero write
-- policies means the ONLY way a row can ever be created is
-- redeem_card()'s SECURITY DEFINER body below, which executes as the
-- function owner and bypasses RLS by Postgres's own semantics. This
-- is the intended single writer, not an oversight.
drop policy if exists card_redemptions_visible on public.card_redemptions;
create policy card_redemptions_visible
  on public.card_redemptions for select
  using (
    redeemer_id = auth.uid()::text
    or exists (select 1 from public.cards c where c.id = card_id and c.owner_id = auth.uid()::text)
  );

-- ---------------------------------------------------------------
-- Function: redeem_card
-- ---------------------------------------------------------------
-- The first RPC / SECURITY DEFINER function in this codebase. Why an
-- RPC at all, rather than a plain .from('cards').select(): no RLS
-- SELECT policy can express "let a client compare an input against
-- pattern/code without ever reading the stored value" — any policy
-- permissive enough to compare is permissive enough to leak every
-- card's answer via a direct SELECT. SECURITY DEFINER is the only
-- mechanism that lets server-side code read pattern/constellation/
-- code/serial_no for a comparison while cards' own RLS (no anon
-- SELECT policy at all) keeps every column unreadable to a direct
-- client query.
--
-- The response is deliberately minimal: on success, only what Creator
-- needs to load and render the unlocked Theme (target_theme_id/
-- target_owner_id/expires_at/etc) — never pattern, code, serial_no,
-- or constellation. On failure, only a `reason` code, never any of
-- the tables' real contents. This is the exact contract
-- docs/VIHU_CARD_PLATFORM.md documents and the verification suite
-- asserts against at the network level.
create or replace function public._card_platform_sort_pattern(p_pattern jsonb)
returns jsonb
language sql
immutable
as $$
  -- Canonicalizes a jsonb array of [row,col] pairs into a stable
  -- sorted form so pattern matching is a SET comparison — redeeming a
  -- card never depends on the order stars were originally placed in,
  -- nor the order they were tapped in.
  select coalesce(
    jsonb_agg(elem order by (elem->>0)::int, (elem->>1)::int),
    '[]'::jsonb
  )
  from jsonb_array_elements(p_pattern) elem;
$$;

create or replace function public.redeem_card(p_pattern jsonb default null, p_typed_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redeemer text := auth.uid()::text;
  v_card public.cards;
  v_normalized text;
  v_expires timestamptz;
begin
  if v_redeemer is null or v_redeemer = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if p_pattern is not null then
    select * into v_card from public.cards
      where revoked_at is null
        and public._card_platform_sort_pattern(pattern) = public._card_platform_sort_pattern(p_pattern)
      limit 1;
  elsif p_typed_code is not null and length(trim(p_typed_code)) > 0 then
    -- Dash/space-insensitive: "ORION-00125", "orion 00125", and
    -- "ORION00125" all normalize to the same comparable string. This
    -- is deliberately the CONSTELLATION+serial compound, not the
    -- "BC-00125" `code` column — the typed magic word a player uses
    -- is a different, player-facing identifier from the internal
    -- admin-facing serial shown in Builder's own minted-card list.
    v_normalized := upper(regexp_replace(p_typed_code, '[\s-]+', '', 'g'));
    select * into v_card from public.cards
      where revoked_at is null
        and upper(constellation || lpad(serial_no::text, 5, '0')) = v_normalized
      limit 1;
  else
    return jsonb_build_object('ok', false, 'reason', 'no_input');
  end if;

  if v_card.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_match');
  end if;

  if v_card.max_tries is not null and v_card.tries_used >= v_card.max_tries then
    return jsonb_build_object('ok', false, 'reason', 'exhausted');
  end if;

  update public.cards set tries_used = tries_used + 1 where id = v_card.id;

  v_expires := case
    when v_card.duration_seconds is null then null
    else now() + make_interval(secs => v_card.duration_seconds)
  end;

  insert into public.card_redemptions(card_id, redeemer_id, expires_at)
    values (v_card.id, v_redeemer, v_expires);

  return jsonb_build_object(
    'ok', true,
    'card_type', v_card.card_type,
    'target_repository', v_card.target_repository,
    'target_theme_id', v_card.target_theme_id,
    'target_owner_id', v_card.owner_id,
    'label', v_card.label,
    'rarity', v_card.rarity,
    'expires_at', v_expires,
    'tries_remaining', case
      when v_card.max_tries is null then null
      else v_card.max_tries - (v_card.tries_used + 1)
    end
  );
end;
$$;

grant execute on function public.redeem_card(jsonb, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- Cross-owner read grant for redeemed Themes
-- ---------------------------------------------------------------
-- Extends the two existing owner-only Personal-Theme read policies
-- (defined above, before `cards` existed) to also permit a redeemer
-- with a live, unexpired card_redemptions row — without this, a
-- successful redeem_card() call would be theater: RLS would still
-- return zero rows for the actual Theme content the redeemer just
-- unlocked. Re-declared here (drop + create, same idempotent
-- convention as the rest of this file) rather than edited in place
-- above, since these definitions need to reference `cards`/
-- `card_redemptions`, which don't exist until this section runs.
-- Default behaviour for every non-redeemed row is unchanged — the
-- added clause is purely additive (`or exists (...)`).
drop policy if exists themes_personal_select on public.themes;
create policy themes_personal_select
  on public.themes for select
  using (
    repository = 'personal'
    and (
      owner_id = auth.uid()::text
      or exists (
        select 1 from public.card_redemptions r
        join public.cards c on c.id = r.card_id
        where c.target_theme_id = themes.theme_id
          and c.owner_id = themes.owner_id
          and r.redeemer_id = auth.uid()::text
          and (r.expires_at is null or r.expires_at > now())
      )
    )
  );

drop policy if exists theme_assets_personal_read on storage.objects;
create policy theme_assets_personal_read
  on storage.objects for select
  using (
    bucket_id = 'theme-assets'
    and (storage.foldername(name))[1] = 'personal'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.card_redemptions r
        join public.cards c on c.id = r.card_id
        where c.target_theme_id = (storage.foldername(name))[3]
          and c.owner_id = (storage.foldername(name))[2]
          and r.redeemer_id = auth.uid()::text
          and (r.expires_at is null or r.expires_at > now())
      )
    )
  );
