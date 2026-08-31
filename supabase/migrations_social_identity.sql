-- ===================================================================
-- SPRINT SOCIAL 1 — Creator Identity & Discovery.
--
-- Every Creator can hold ONE public VihuPlanet name (@moonmaker):
-- globally unique, case-insensitively so, human-readable, stable, and
-- never derived from anything private. It exists to answer "who made
-- this?" and "what else have they made?" — identity for CREATIONS,
-- never a directory of children.
--
-- THE IDENTITY TABLE IS REUSED, NOT DUPLICATED. magic_card_identities
-- is already the Creator identity of this product (Decision 11 — the
-- Magic Card IS the Creator), already carries the public-ish fields
-- that travel with stories (nickname), and its `id` is the same
-- cardId every project record is stamped with (Decision 19). A second
-- creator_profiles table would be a second identity system for the
-- same person. The username is a PUBLIC ALIAS on that identity —
-- never the account: auth.uid() stays internal, is never searchable,
-- and never appears beside a username anywhere public.
--
-- WRITES GO THROUGH ONE SECURITY DEFINER FUNCTION and nothing else:
-- the table's RLS is untouched, a browser cannot write the column
-- directly, and the function verifies the caller OWNS the identity
-- (owner_id = auth.uid() — the sky-protection rule: a client-named
-- identity is a selector, never an assertion).
--
-- THERE IS NO SEARCH ENDPOINT IN THIS MIGRATION, DELIBERATELY.
-- Discovery happens over the already-public shared feed (Decision 15:
-- the Ether is Canon + everything anybody shared), where the username
-- travels ON the shared story exactly as creatorName always has. A
-- username with no public creation is not discoverable anywhere —
-- creation-first, by construction — and there is no new queryable
-- surface to rate-limit or to turn into an enumeration tool.
-- ===================================================================

alter table public.magic_card_identities
  add column if not exists username text;

-- Case-insensitive global uniqueness. Partial, so the many identities
-- with no username yet do not collide on null.
create unique index if not exists magic_card_identities_username_key
  on public.magic_card_identities (lower(username))
  where username is not null;

-- -------------------------------------------------------------------
-- Claiming a name. Validation lives HERE, beside the uniqueness that
-- enforces it, so a client that skips its own checks changes nothing.
--
--   * normalized to lower case (stored lower; @Display is cosmetic)
--   * 3–20 characters, letters / digits / underscore only
--   * at least one letter (a name, not a number)
--   * reserved platform names refused
--   * stable: an identity that already holds a name keeps it
--     (v1 usernames are stable — no rename system)
--
-- Answers are one word each, and none of them leaks whether some
-- OTHER identity exists: `taken` says only that the NAME is in use.
-- -------------------------------------------------------------------
-- ONE reserved list, shared by the claim function and the backfill
-- below — a third copy of it would be a third thing to drift. Kept in
-- step with js/creatorHandle.js; the social-identity suite
-- cross-checks the two files.
create or replace function public._creator_username_reserved()
returns text[]
language sql
immutable
as $$
  select array[
    'admin','support','vihuplanet','vihustudio','studio','ether','system',
    'official','vihu','lumo','leafy','quill','nimbus','leo','leosaurus',
    'canon','traveller','creator','moderator','mod','help','about','root',
    'api','www','magic','magiccard','staff','team','planet','home'
  ];
$$;

create or replace function public.creator_username_claim(p_identity_id text, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_name text := lower(trim(coalesce(p_username, '')));
  v_identity public.magic_card_identities;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_identity from public.magic_card_identities where id = p_identity_id;
  -- An identity that is not the caller's answers exactly like one
  -- that does not exist — never an oracle for which ids are real.
  if v_identity.id is null or v_identity.owner_id is distinct from v_caller then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  -- Stable by default: the first name is the name.
  if v_identity.username is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_named',
                              'username', v_identity.username);
  end if;

  if v_name !~ '^[a-z0-9_]{3,20}$' or v_name !~ '[a-z]' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Platform names and routes — the one shared list above.
  if v_name = any (public._creator_username_reserved()) then
    return jsonb_build_object('ok', false, 'reason', 'reserved');
  end if;

  begin
    update public.magic_card_identities
       set username = v_name
     where id = v_identity.id
       and username is null;
    -- Two claims racing for the same identity: whoever lost the race
    -- is told what the name became, exactly like arriving already
    -- named — never a success for a name the row does not hold.
    if not found then
      select username into strict v_identity.username
        from public.magic_card_identities where id = v_identity.id;
      return jsonb_build_object('ok', false, 'reason', 'already_named',
                                'username', v_identity.username);
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'taken');
  end;

  return jsonb_build_object('ok', true, 'username', v_name);
end;
$$;

grant execute on function public.creator_username_claim(text, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- EXISTING ACCOUNTS ARE NAMED FROM THEIR OWN DISPLAY NAME.
-- Decided by the product owner ("for existing accounts create
-- username from their display name"): a Creator who was here before
-- usernames existed should not have to ask for one — their nickname,
-- normalized to the username shape, becomes their public name.
--
--   * DERIVED, NEVER INVENTED: the candidate is the nickname with
--     case folded and everything outside [a-z0-9_] removed — nothing
--     is appended, no digits are made up (the brief's own "never
--     moonmaker8472" rule holds even here).
--   * A nickname that cannot be a name (too short after cleaning, no
--     letter, reserved) is SKIPPED — that Creator keeps the
--     choose-your-name invitation instead of getting a mangled one.
--   * A collision keeps the account WITH SHARED STORIES first, then
--     the earliest (claimed_at). Measured on the live platform: one
--     person's three test cards all derived "vihupapa", first-come
--     handed the name to an idle card, and the card that actually
--     made the shared stories was skipped as taken — leaving its
--     stories unattributable. The name exists to lead to creations,
--     so the card with creations outranks an empty one.
--   * IDEMPOTENT: only rows with no username are touched, so
--     re-running the migration renames nobody.
-- -------------------------------------------------------------------
do $$
declare
  rec record;
  v_cand text;
begin
  for rec in
    select i.id, i.nickname
      from public.magic_card_identities i
     where i.username is null
     order by
       -- creations outrank age: the card that shared stories gets
       -- first claim on a contested name (see the header)
       (exists (select 1 from public.creator_projects p
                 where p.data->>'cardId' = i.id
                   and p.data->>'publishedAt' is not null)) desc,
       i.claimed_at, i.id
  loop
    v_cand := regexp_replace(lower(coalesce(rec.nickname, '')), '[^a-z0-9_]', '', 'g');
    if v_cand !~ '^[a-z0-9_]{3,20}$' or v_cand !~ '[a-z]' then
      continue;
    end if;
    if v_cand = any (public._creator_username_reserved()) then
      continue;
    end if;
    begin
      update public.magic_card_identities
         set username = v_cand
       where id = rec.id and username is null;
    exception when unique_violation then
      null; -- taken by an earlier account — this one keeps the invitation
    end;
  end loop;
end $$;

-- And the name reaches the stories those accounts ALREADY shared,
-- server-side, so every other child's Ether shows it without waiting
-- for each maker's own device to visit and sweep. The same rules the
-- client sweep applies (js/creatorProjectStore.js → _sweepUsernames):
-- only SHARED stories, only records provably owned (the record's own
-- cardId IS the identity id, Decision 19), never rewriting a record
-- that already carries a name. `updated_at` is deliberately left
-- alone: the devices' optimistic pushes compare against it, and a
-- moved clock would make every open story conflict once for nothing.
update public.creator_projects p
   set data = p.data || jsonb_build_object('creatorUsername', i.username)
  from public.magic_card_identities i
 where i.username is not null
   and p.data->>'cardId' = i.id
   and p.data->>'publishedAt' is not null
   and p.data->>'creatorUsername' is null;

-- AND THE STORIES THAT PREDATE cardId, BY DECISION 19'S OWN EVIDENCE
-- STANDARD. A story shared before ownership stamping exists carries no
-- cardId, so the pass above rightly skips it — and those are exactly
-- the oldest shared stories, the ones a live Ether is full of. They
-- are placed the way Decision 19 places legacy work: on evidence,
-- never by guessing. The row's own owner_id is the session that made
-- it, the record's creatorName was stamped from the card that was
-- active, so an identity on the SAME session with the SAME nickname is
-- its maker — and only where that (owner, nickname) pair names exactly
-- ONE identity, so a shared device with two same-named cards stamps
-- nothing rather than the wrong child.
update public.creator_projects p
   set data = p.data || jsonb_build_object('creatorUsername', i.username)
  from public.magic_card_identities i
 where i.username is not null
   and p.data->>'cardId' is null
   and p.owner_id = i.owner_id
   and p.data->>'creatorName' = i.nickname
   and p.data->>'publishedAt' is not null
   and p.data->>'creatorUsername' is null
   and (select count(*) from public.magic_card_identities x
         where x.owner_id = i.owner_id and x.nickname = i.nickname) = 1;

-- -------------------------------------------------------------------
-- The name travels with the identity. recall_magic_card() is
-- redefined from its migrations_taught.sql shape with ONE new field —
-- `username` — so a Creator recognised on a brand-new device carries
-- their public name the way companion_id, parent_email's protection
-- and taught already arrived in earlier sprints.
-- -------------------------------------------------------------------
create or replace function public.recall_magic_card(p_pattern jsonb default null, p_typed_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recaller text := auth.uid()::text;
  v_identity public.magic_card_identities;
  v_normalized text;
  v_matches int;
  v_by_pattern boolean := false;
begin
  if v_recaller is null or v_recaller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if p_pattern is not null then
    select count(*) into v_matches
      from public.magic_card_identities i
     where public._card_platform_sort_pattern(i.pattern) = public._card_platform_sort_pattern(p_pattern);
    if v_matches = 0 then
      return jsonb_build_object('ok', false, 'reason', 'no_match');
    elsif v_matches > 1 then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
    select * into v_identity
      from public.magic_card_identities i
     where public._card_platform_sort_pattern(i.pattern) = public._card_platform_sort_pattern(p_pattern);
    v_by_pattern := true;
  elsif p_typed_code is not null and trim(p_typed_code) <> '' then
    v_normalized := upper(regexp_replace(p_typed_code, '[^A-Za-z0-9]', '', 'g'));
    select count(*) into v_matches
      from public.magic_card_identities i
     where upper(regexp_replace(i.code, '[^A-Za-z0-9]', '', 'g')) = v_normalized;
    if v_matches = 0 then
      return jsonb_build_object('ok', false, 'reason', 'no_match');
    elsif v_matches > 1 then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;
    select * into v_identity
      from public.magic_card_identities i
     where upper(regexp_replace(i.code, '[^A-Za-z0-9]', '', 'g')) = v_normalized;
  else
    return jsonb_build_object('ok', false, 'reason', 'no_input');
  end if;

  if v_identity.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_match');
  end if;

  update public.magic_card_identities set last_active_at = now() where id = v_identity.id;

  insert into public.magic_card_recalls(identity_id, recaller_id) values (v_identity.id, v_recaller);

  return jsonb_build_object(
    'ok', true,
    'identity_id', v_identity.id,
    'owner_id', v_identity.owner_id,
    'nickname', v_identity.nickname,
    'constellation', v_identity.constellation,
    'claimed_at', v_identity.claimed_at,
    -- THE ORDER, and only to someone who arrived by showing the sky.
    -- A typed-code recall gets null here and is left exactly as it was.
    'pattern', case when v_by_pattern then v_identity.pattern else null end,
    'companion_id', v_identity.companion_id,
    'companion_name', v_identity.companion_name,
    'companion_species', v_identity.companion_species,
    -- The taught record. Null for a card claimed before it existed,
    -- which js/studioRite.js reads as grandfathered.
    'taught', v_identity.taught,
    -- SOCIAL 1 — the public VihuPlanet name, so a Creator recognised
    -- on a brand-new device is still @moonmaker there.
    'username', v_identity.username
  );
end;
$$;

grant execute on function public.recall_magic_card(jsonb, text) to anon, authenticated;
