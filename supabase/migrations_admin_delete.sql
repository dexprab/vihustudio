-- ===================================================================
-- ADMIN CONSOLE 2 — @username on the roll, and account deletion.
--
-- Run AFTER migrations_admin_console.sql (platform_admins and
-- is_platform_admin live there). Safe to re-run.
--
-- Asked for by the product owner: "in the admin panel add @username,
-- last accessed and also provide delete option to remove an account
-- and all storage used by it." Last-accessed was already on the roll
-- (last_seen = last_active_at); this adds the public name and the
-- delete.
--
-- WHAT "AN ACCOUNT" MEANS HERE — the Magic Card. The card IS the
-- Creator (Decision 11), and every store is either keyed on the card
-- (companion memory), carries the card inside its record
-- (creator_projects / creator_library / creator_handwriting stamp
-- cardId in data), or references the identity row with ON DELETE
-- CASCADE (orbits, shows, recalls, family album links).
--
-- SIBLINGS ARE SACRED. One browser session (owner_id) can hold
-- several cards — siblings on a shared machine — and a recalled
-- Creator's records can sit under an owner session that is not their
-- own. So deletion is by CARD, never by owner: rows stamped with a
-- DIFFERENT card are never touched, whoever's session they sit under.
-- Owner-keyed things that belong to no card (unowned leftovers,
-- family_albums) go only when the deleted card was the LAST card on
-- that session — otherwise they stay with the sibling.
--
-- STORAGE. Assets live in the draft-assets bucket under
-- <surface>/<owner>/<projectId>/<assetId> (js/assetStore.js), so the
-- objects belonging to the deleted projects are NAMEABLE precisely.
-- The platform PROTECTS storage.objects from direct SQL — a delete
-- from inside this function was refused live with "Direct deletion
-- from storage tables is not allowed. Use the Storage API instead",
-- which aborted the whole transaction (correctly: nothing partial
-- happened). And the platform is right on the merits too: a row
-- deleted by SQL leaves the physical blob orphaned, while the
-- Storage API deletes the file properly. So the function only
-- COLLECTS the paths (a SELECT, which nothing forbids) and returns
-- them on the receipt as storagePaths; the admin console then
-- removes them through the Storage API under the admin-only storage
-- policies this migration also creates.
-- ===================================================================

-- -------------------------------------------------------------------
-- The roll, with the Creator's public VihuPlanet name.
-- (Return-type change, so the old function is dropped first.)
-- -------------------------------------------------------------------
drop function if exists public.admin_creators_roll();

create or replace function public.admin_creators_roll()
returns table (
  creator          text,
  username         text,
  card             text,
  became_creator   timestamptz,
  last_seen        timestamptz,
  companion        text,
  species          text,
  parent_email     text,
  stories          bigint,
  shared_to_ether  bigint,
  cards_on_device  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(m.nickname, ''), '(unnamed)'),
    nullif(m.username, ''),
    m.code,
    m.claimed_at,
    m.last_active_at,
    coalesce(nullif(m.companion_name, ''), m.companion_id),
    nullif(m.companion_species, ''),
    nullif(m.parent_email, ''),
    (select count(*) from public.creator_projects p where p.owner_id = m.owner_id),
    (select count(*) from public.creator_projects p where p.owner_id = m.owner_id and p.is_shared),
    (select count(*) from public.magic_card_identities s where s.owner_id = m.owner_id)
  from public.magic_card_identities m
  where public.is_platform_admin()
  order by m.claimed_at desc;
$$;

revoke all on function public.admin_creators_roll() from public;
grant execute on function public.admin_creators_roll() to authenticated;

-- -------------------------------------------------------------------
-- Delete an account — the card, and everything it owns.
--
--   * administrators only; anybody else is refused by name and
--     nothing is touched
--   * the card code must be TYPED BACK (p_confirm) — a deletion this
--     final never rides a single click
--   * removed: the identity row (cascading its orbits in both
--     directions, its shows sent and received, its recalls and its
--     family album link) · its projects and their cheers · its garden
--     drawings and kept letters · its companion memories — and the
--     storage paths behind its projects are RETURNED for the console
--     to remove through the Storage API (never deleted by SQL)
--   * removed only when this was the session's LAST card: the
--     session's unowned leftover records and its family_albums —
--     with a sibling's card still standing, those stay
--   * a row stamped with ANOTHER card is never touched, whoever's
--     session it sits under
--
-- Optional tables (library, handwriting, memory, cheers, storage) are
-- reached through to_regclass + EXECUTE, so the function deploys and
-- runs whatever set of migrations a project has.
-- -------------------------------------------------------------------
create or replace function public.admin_delete_creator(p_card_code text, p_confirm text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id public.magic_card_identities;
  v_last boolean;
  v_pids text[];
  v_paths text[] := '{}';
  n_projects int := 0;
  n_cheers int := 0;
  n_library int := 0;
  n_hand int := 0;
  n_memory int := 0;
  n_albums int := 0;
  n_storage int := 0;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;

  if coalesce(trim(p_confirm), '') = ''
     or trim(p_confirm) is distinct from trim(p_card_code) then
    return jsonb_build_object('ok', false, 'reason', 'confirm');
  end if;

  select * into v_id from public.magic_card_identities
   where code = trim(p_card_code);
  if v_id.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  -- Is this the session's last card? (Siblings share owner_id.)
  select not exists (
    select 1 from public.magic_card_identities
     where owner_id = v_id.owner_id and id <> v_id.id
  ) into v_last;

  -- The project rows that die with the card: its own, plus — only on
  -- the session's last card — the session's unowned leftovers.
  select coalesce(array_agg(id), '{}') into v_pids
    from public.creator_projects
   where data->>'cardId' = v_id.id
      or (v_last and owner_id = v_id.owner_id
          and coalesce(data->>'cardId', '') = '');

  -- Storage behind those projects: <surface>/<owner>/<projectId>/…
  -- COLLECTED, never deleted — the platform refuses SQL deletes on
  -- storage.objects ("Use the Storage API instead"), and the Storage
  -- API is also what deletes the physical files properly. The paths
  -- ride the receipt; the admin console removes them.
  if to_regclass('storage.objects') is not null
     and coalesce(array_length(v_pids, 1), 0) > 0 then
    execute
      'select coalesce(array_agg(o.name), ''{}'')
         from storage.objects o
        where o.bucket_id = ''draft-assets''
          and exists (select 1 from unnest($1::text[]) pid
                       where o.name like ''%/'' || $2 || ''/'' || pid || ''/%'')'
      into v_paths
      using v_pids, v_id.owner_id;
    n_storage := coalesce(array_length(v_paths, 1), 0);
  end if;

  if to_regclass('public.story_cheers') is not null
     and coalesce(array_length(v_pids, 1), 0) > 0 then
    execute 'delete from public.story_cheers where story_id = any($1::text[])'
      using v_pids;
    get diagnostics n_cheers = row_count;
  end if;

  delete from public.creator_projects where id = any(v_pids);
  get diagnostics n_projects = row_count;

  if to_regclass('public.creator_library') is not null then
    execute
      'delete from public.creator_library
        where data->>''cardId'' = $1
           or ($2 and owner_id = $3 and coalesce(data->>''cardId'', '''') = '''')'
      using v_id.id, v_last, v_id.owner_id;
    get diagnostics n_library = row_count;
  end if;

  if to_regclass('public.creator_handwriting') is not null then
    execute
      'delete from public.creator_handwriting
        where data->>''cardId'' = $1
           or ($2 and owner_id = $3 and coalesce(data->>''cardId'', '''') = '''')'
      using v_id.id, v_last, v_id.owner_id;
    get diagnostics n_hand = row_count;
  end if;

  if to_regclass('public.creator_companion_memory') is not null then
    execute 'delete from public.creator_companion_memory where card_id = $1'
      using v_id.id;
    get diagnostics n_memory = row_count;
  end if;

  if v_last and to_regclass('public.family_albums') is not null then
    execute 'delete from public.family_albums where owner_id = $1'
      using v_id.owner_id;
    get diagnostics n_albums = row_count;
  end if;

  -- The identity itself. Cascades: creator_orbits (both directions),
  -- creator_shows (sent and received), magic_card_recalls,
  -- family_album_links.
  delete from public.magic_card_identities where id = v_id.id;

  return jsonb_build_object('ok', true,
    'card', v_id.code,
    'creator', coalesce(nullif(v_id.nickname, ''), '(unnamed)'),
    'lastCardOnDevice', v_last,
    'deleted', jsonb_build_object(
      'projects', n_projects,
      'cheersOnThem', n_cheers,
      'garden', n_library,
      'letters', n_hand,
      'memories', n_memory,
      'familyAlbums', n_albums,
      'storageObjects', n_storage),
    'storagePaths', to_jsonb(coalesce(v_paths, '{}'::text[])));
end;
$$;

revoke all on function public.admin_delete_creator(text, text) from public;
grant execute on function public.admin_delete_creator(text, text) to authenticated;

-- -------------------------------------------------------------------
-- The Storage API path the console uses needs storage POLICIES: the
-- Storage service applies RLS as the signed-in caller, and nothing so
-- far lets anybody delete from draft-assets. These widen the bucket
-- for PLATFORM ADMINISTRATORS ONLY — the same is_platform_admin()
-- gate every admin function already stands behind — and for nobody
-- else: a child's session passes neither. SELECT rides along because
-- the Storage API reads what it removes on the way out.
--
-- Guarded, so the migration still applies on a project whose storage
-- schema is absent (a bare test cluster), and re-runnable.
-- -------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "platform admins may read draft assets" on storage.objects';
    execute 'create policy "platform admins may read draft assets" on storage.objects
               for select to authenticated
               using (bucket_id = ''draft-assets'' and public.is_platform_admin())';
    execute 'drop policy if exists "platform admins may delete draft assets" on storage.objects';
    execute 'create policy "platform admins may delete draft assets" on storage.objects
               for delete to authenticated
               using (bucket_id = ''draft-assets'' and public.is_platform_admin())';
  end if;
end $$;
