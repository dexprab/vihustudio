-- ---------------------------------------------------------------
-- WHAT A CREATOR HAS BEEN TAUGHT
-- ---------------------------------------------------------------
-- CLAUDE.md -> Decision 22: "What is stored is which CAPABILITIES a
-- child has been taught, not which rite they finished... It travels on
-- the Magic Card, and is never shown."
--
-- A browser-local flag would drop a Creator to Level I on a
-- grandparent's laptop with their own Level III stories in front of
-- them -- the failure Decision 19 already had to fix for projects. So
-- the record belongs here as a column and must be returned by
-- recall_magic_card(): return it, so a Creator recognised on a
-- brand-new device gets the Studio they earned rather than a Level I
-- one. The body below is migrations_recall_returns_pattern.sql's,
-- VERBATIM apart from the one added key — redefining this function from
-- schema.sql's older body would silently drop the drawing order that
-- Decision 18 depends on, which is exactly the kind of quiet regression
-- a `create or replace` invites. If that migration is ever revised,
-- this file has to be rebuilt on top of it again.

-- THE COLUMN ITSELF. This file originally redefined the function
-- below WITHOUT creating the column it reads — PL/pgSQL does not
-- validate record fields at create time, so the broken state looked
-- healthy until a Creator drew their stars on the live platform and
-- every recall failed with 42703. A migration that reads a column
-- guarantees the column.
alter table public.magic_card_identities add column if not exists taught jsonb;

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
    'companion_species', v_identity.companion_species,
    -- The taught record. Null for a card claimed before it existed,
    -- which js/studioRite.js reads as grandfathered — a Creator
    -- recognised on a brand-new device must never arrive there with
    -- fewer controls than they left home with.
    'taught', v_identity.taught
  );
end;
$$;

grant execute on function public.recall_magic_card(jsonb, text) to anon, authenticated;
