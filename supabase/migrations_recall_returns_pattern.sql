-- ===================================================================
-- RECALL RETURNS THE DRAWING ORDER — ON ONE BRANCH ONLY
--
-- Run this after migrations_identity_hardening.sql. It is idempotent.
--
-- WHY THIS IS SAFE ON THE PATTERN BRANCH.
--
-- A card's pattern is its credential, which is why this RPC has never
-- returned one on any branch. That discipline is kept — but it is worth
-- being exact about WHO is being protected from WHAT.
--
-- On the PATTERN branch the caller has just submitted the exact
-- canonical cell set and had it matched. They already hold every cell.
-- Returning the stored pattern tells them the one thing they could not
-- have known — the ORDER those cells are joined in — and the order is
-- not a credential: matching is a SET comparison on this device
-- (canonical()) and on the platform (_card_platform_sort_pattern), so
-- no order opens anything that the cells alone did not already open.
--
-- On the TYPED-CODE branch it would be a genuine leak. A child
-- recalling with "CYGNUS00042" has proved nothing about the sky, and
-- handing them the pattern would hand them the credential itself. That
-- branch returns no pattern, exactly as before.
--
-- WHAT IT BUYS. A Creator recalling on a brand-new device currently
-- stores whatever order the camera happened to read the stars in, so
-- their Magic Card there draws the right stars joined the wrong way —
-- a different picture from the card in their pocket. With the order
-- travelling alongside the identity, the two are the same object again.
-- ===================================================================

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
    v_by_pattern := true;

    select count(*) into v_matches from public.magic_card_identities
      where public._card_platform_sort_pattern(pattern)
          = public._card_platform_sort_pattern(p_pattern);

    if v_matches = 0 then
      return jsonb_build_object('ok', false, 'reason', 'no_match');
    elsif v_matches > 1 then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;

    select * into v_identity from public.magic_card_identities
      where public._card_platform_sort_pattern(pattern)
          = public._card_platform_sort_pattern(p_pattern);

  elsif p_typed_code is not null and length(trim(p_typed_code)) > 0 then
    v_normalized := upper(regexp_replace(p_typed_code, '[\s-]+', '', 'g'));

    select count(*) into v_matches from public.magic_card_identities
      where upper(constellation || lpad(serial_no::text, 5, '0')) = v_normalized;

    if v_matches = 0 then
      return jsonb_build_object('ok', false, 'reason', 'no_match');
    elsif v_matches > 1 then
      return jsonb_build_object('ok', false, 'reason', 'identity_conflict');
    end if;

    select * into v_identity from public.magic_card_identities
      where upper(constellation || lpad(serial_no::text, 5, '0')) = v_normalized;
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
    'companion_species', v_identity.companion_species
  );
end;
$$;

grant execute on function public.recall_magic_card(jsonb, text) to anon, authenticated;
