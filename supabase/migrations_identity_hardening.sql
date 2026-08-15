-- ===================================================================
-- MAGIC CARD IDENTITY FOUNDATION HARDENING
--
-- Run this whole file in the Supabase SQL editor. It is idempotent and
-- safe to run more than once.
--
-- It makes the database the final authority on Creator identity:
--
--   one canonical star pattern  ->  one Creator
--
-- The canonical form is the EXISTING _card_platform_sort_pattern() —
-- the same one redeem_card() and recall_magic_card() already use, and
-- the same set-comparison the device does in canonical(). No second,
-- competing representation is introduced anywhere.
-- ===================================================================


-- -------------------------------------------------------------------
-- STEP 0 — A LIVE BREAK, FIXED FIRST.
--
-- magic_card_identities.constellation carries a CHECK naming only the
-- original five families. The constellation library was expanded to
-- seventeen, so every card minted with one of the twelve new families
-- is REJECTED by this constraint on its way to the platform — and the
-- client's push swallows errors, so the failure is silent: the card
-- works on its own device and cannot be recalled anywhere else.
--
-- The list is widened to the full library. It stays a CHECK rather than
-- becoming free text because a typo in a family name should still be
-- refused, and it deliberately keeps URSA_MAJOR, which is no longer
-- minted but is carried by real cards.
-- -------------------------------------------------------------------
alter table public.magic_card_identities
  drop constraint if exists magic_card_identities_constellation_check;

alter table public.magic_card_identities
  add constraint magic_card_identities_constellation_check
  check (constellation in (
    'ORION','CASSIOPEIA','URSA_MAJOR','CYGNUS','LYRA',
    'CRUX','SCORPIUS','LEO','TAURUS','GEMINI','CANIS_MAJOR','AQUARIUS',
    'PEGASUS','ARIES','TRIANGULUM','DELPHINUS','SAGITTA','CORONA_BOREALIS'
  ));


-- -------------------------------------------------------------------
-- STEP 1 — THE AUDIT, BEFORE ANYTHING IS ENFORCED.
--
-- Run this on its own first and read the result. It reports every
-- canonical pattern held by more than one Creator. Nothing is deleted,
-- merged, reassigned or reminted — existing Creator identity is not
-- something a migration gets to decide about.
--
-- An empty result means there are no duplicates and STEP 2 will apply
-- cleanly.
-- -------------------------------------------------------------------
select
  public._card_platform_sort_pattern(pattern) as canonical_pattern,
  count(*)                                    as creators,
  array_agg(id order by claimed_at)           as creator_ids,
  array_agg(distinct constellation)           as families,
  array_agg(nickname order by claimed_at)     as nicknames,
  min(claimed_at)                             as first_claimed,
  max(last_active_at)                         as last_seen
from public.magic_card_identities
group by 1
having count(*) > 1
order by count(*) desc;


-- -------------------------------------------------------------------
-- STEP 2 — UNIQUENESS, ENFORCED BY THE DATABASE.
--
-- A unique index on the canonical form, which is what makes two
-- simultaneous mints of the same pattern impossible: the second one
-- fails with a unique violation no matter how the two requests
-- interleave. A JavaScript check cannot do that, and is not relied on.
--
-- The guard below refuses to create the index while duplicates exist,
-- with a message naming how many — because silently failing to add a
-- uniqueness constraint is far worse than stopping. If it raises, run
-- STEP 1, decide what to do about those Creators, and run this again.
--
-- Note recall_magic_card() is hardened in STEP 3 regardless, so even a
-- database that still contains a historical duplicate can never open
-- the wrong Sky.
-- -------------------------------------------------------------------
do $$
declare
  v_dupes int;
begin
  select count(*) into v_dupes from (
    select 1
    from public.magic_card_identities
    group by public._card_platform_sort_pattern(pattern)
    having count(*) > 1
  ) d;

  if v_dupes > 0 then
    raise exception
      'IDENTITY CONFLICT: % canonical pattern(s) are held by more than one Creator. Run STEP 1 and decide before enforcing uniqueness. Nothing has been changed.',
      v_dupes;
  end if;
end $$;

create unique index if not exists magic_card_identities_canonical_pattern_key
  on public.magic_card_identities ((public._card_platform_sort_pattern(pattern)));


-- -------------------------------------------------------------------
-- STEP 3 — RECALL CAN NEVER PICK ONE OF TWO.
--
-- The old body ended both lookups with `limit 1`, which turns an
-- ambiguous identity into a confident answer: with two matching rows a
-- child would be let into whichever the planner happened to return.
-- `limit 1` is not a safety mechanism; it is the absence of one.
--
--   0 matches  -> no_match
--   1 match    -> success
--   >1 matches -> identity_conflict, and no Sky opens
--
-- The conflict branch reveals nothing about either Creator — no id, no
-- nickname, no constellation — because the caller is by definition not
-- established as either of them.
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
begin
  if v_recaller is null or v_recaller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if p_pattern is not null then
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
    -- Dash/space-insensitive, same normalization as redeem_card's own
    -- typed-fallback path: "ORION-00125"/"orion 00125"/"ORION00125"
    -- all resolve identically. Deliberately the CONSTELLATION+serial
    -- compound, not the "MC-00125" `code` column, matching
    -- redeem_card's own reasoning for the exact same distinction.
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
    'companion_id', v_identity.companion_id,
    'companion_name', v_identity.companion_name,
    'companion_species', v_identity.companion_species
  );
end;
$$;

grant execute on function public.recall_magic_card(jsonb, text) to anon, authenticated;


-- -------------------------------------------------------------------
-- STEP 4 — RESERVING A PATTERN, RACE-SAFELY.
--
-- The client cannot ask whether a pattern is free: magic_card_identities
-- is owner-only SELECT by design, so a Creator can never read another
-- Creator's row — which is correct, and which is exactly why the check
-- has to happen inside a function that can see the whole table.
--
-- So the client does not ask, it ATTEMPTS. This inserts, and lets the
-- unique index be the arbiter: whichever of two simultaneous callers
-- reaches the index first wins, and the loser is told `pattern_taken`
-- and generates another candidate. No lock, no read-then-write, no
-- window between the two.
--
-- It returns `pattern_taken` rather than raising, so a caller can retry
-- quietly. The child never sees any of this.
-- -------------------------------------------------------------------
create or replace function public.mint_magic_card(
  p_id            text,
  p_nickname      text,
  p_constellation text,
  p_pattern       jsonb,
  p_claimed_at    timestamptz default now(),
  p_companion_id       text default null,
  p_companion_name     text default null,
  p_companion_species  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text := auth.uid()::text;
  v_row   public.magic_card_identities;
begin
  if v_owner is null or v_owner = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if p_pattern is null or jsonb_array_length(p_pattern) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_pattern');
  end if;

  -- Re-minting the SAME id with the SAME pattern is not a conflict; it
  -- is the ordinary re-push of a card this device already owns.
  select * into v_row from public.magic_card_identities where id = p_id;
  if v_row.id is not null then
    if v_row.owner_id <> v_owner then
      return jsonb_build_object('ok', false, 'reason', 'not_yours');
    end if;
    update public.magic_card_identities
       set nickname = p_nickname,
           last_active_at = now(),
           companion_id = coalesce(p_companion_id, companion_id),
           companion_name = coalesce(p_companion_name, companion_name),
           companion_species = coalesce(p_companion_species, companion_species)
     where id = p_id
     returning * into v_row;
    return jsonb_build_object('ok', true, 'reason', 'already_mine',
      'serial_no', v_row.serial_no, 'code', v_row.code,
      'constellation', v_row.constellation);
  end if;

  begin
    insert into public.magic_card_identities
      (id, owner_id, nickname, constellation, pattern, claimed_at, last_active_at,
       companion_id, companion_name, companion_species)
    values
      (p_id, v_owner, coalesce(p_nickname,''), p_constellation, p_pattern,
       coalesce(p_claimed_at, now()), now(),
       p_companion_id, p_companion_name, p_companion_species)
    returning * into v_row;
  exception
    when unique_violation then
      -- Either this canonical pattern already belongs to somebody, or
      -- two mints raced and this one lost. Both mean the same thing to
      -- the caller: pick another sky.
      return jsonb_build_object('ok', false, 'reason', 'pattern_taken');
    when check_violation then
      return jsonb_build_object('ok', false, 'reason', 'unknown_constellation');
  end;

  return jsonb_build_object('ok', true,
    'serial_no', v_row.serial_no, 'code', v_row.code,
    'constellation', v_row.constellation);
end;
$$;

grant execute on function public.mint_magic_card(text, text, text, jsonb, timestamptz, text, text, text)
  to anon, authenticated;
