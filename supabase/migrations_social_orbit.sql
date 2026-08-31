-- ===================================================================
-- SPRINT SOCIAL 2 — MY ORBIT & MY CIRCLE.
--
-- Two relationships, one table:
--
--   🌌 ORBIT — Creators I choose to see. One-way, deliberately: I add
--      somebody to my Orbit and THEY ARE NOT TOLD. No request, no
--      acceptance, no obligation. A row here is my choice about my
--      own attention, nothing about theirs.
--
--   ✨ CIRCLE — Creators who chose me too. NOT another button and NOT
--      another table: a Circle IS two Orbit rows facing each other,
--      derived at read time. There is no circle state to drift out of
--      step with the choices that define it — the Cheer discipline
--      (Decision 20: the count IS the rows), applied to a
--      relationship.
--
-- WHO CAN ASK WHAT — this is the whole design:
--
--   * RLS is ON and there are NO POLICIES. Nothing reads or writes
--     this table but the two SECURITY DEFINER functions below — the
--     story_cheers / family_album_links discipline.
--   * I can read MY OWN orbit (the names I chose), and for each of
--     them exactly ONE fact about the other direction: whether we are
--     in each other's Circle. That mutual bit is the point of Circle
--     and the ONLY thing ever revealed about who orbits whom.
--   * NOBODY can ask "who orbits me", "who orbits X", or "how many".
--     There is no count, no list of admirers, no way to feel watched.
--     A child learns somebody chose them only in the moment the
--     choice becomes mutual — which is the product (Decision 54).
--
-- The parties are MAGIC CARD IDENTITIES (Decision 11 — the card IS
-- the Creator), so an orbit follows its Creator across devices the
-- way their name and their Companion already do. The caller proves
-- ownership of the orbiting card (owner_id = auth.uid() — the
-- sky-protection rule); the orbited party is named by their PUBLIC
-- username, because that is the only handle one child ever has on
-- another.
-- ===================================================================

create table if not exists public.creator_orbits (
  orbiter_id  text not null references public.magic_card_identities(id) on delete cascade,
  orbited_id  text not null references public.magic_card_identities(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (orbiter_id, orbited_id),
  -- an orbit around yourself is not a relationship
  check (orbiter_id <> orbited_id)
);

alter table public.creator_orbits enable row level security;
-- Deliberately NO policies: SECURITY DEFINER functions only.

-- -------------------------------------------------------------------
-- Add to / leave My Orbit.
--   * caller must OWN the orbiting identity; a stranger's identity
--     answers exactly like a nonexistent one (never an oracle)
--   * the orbited Creator is named by public username; an unknown
--     name answers `unknown` (usernames are public on the stories
--     themselves, so this reveals nothing new)
--   * adding twice is a success, not a duplicate (primary key)
--   * removing is silent and idempotent; if the choice was mutual,
--     the Circle simply ends — no notification, no drama
--   * the answer carries `circle`: whether the other Creator has
--     chosen you too — the one honest moment that fact may travel
-- -------------------------------------------------------------------
create or replace function public.creator_orbit_set(p_identity_id text, p_username text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_them public.magic_card_identities;
  v_circle boolean;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or v_me.owner_id is distinct from v_caller then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select * into v_them from public.magic_card_identities
   where lower(username) = lower(trim(coalesce(p_username, '')));
  if v_them.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  if v_them.id = v_me.id then
    return jsonb_build_object('ok', false, 'reason', 'own');
  end if;

  if p_on then
    insert into public.creator_orbits(orbiter_id, orbited_id)
    values (v_me.id, v_them.id)
    on conflict do nothing;
  else
    delete from public.creator_orbits
     where orbiter_id = v_me.id and orbited_id = v_them.id;
  end if;

  select exists (
    select 1 from public.creator_orbits
     where orbiter_id = v_them.id and orbited_id = v_me.id
  ) into v_circle;

  return jsonb_build_object('ok', true,
    'username', v_them.username,
    'orbited', p_on,
    -- Circle needs BOTH rows: leaving my half leaves them merely
    -- orbiting me, which they are never told about.
    'circle', p_on and v_circle);
end;
$$;

grant execute on function public.creator_orbit_set(text, text, boolean) to anon, authenticated;

-- -------------------------------------------------------------------
-- My Orbit, as I chose it — with the one mutual fact per entry.
-- Never anybody who orbits me and does not appear in MY list; never
-- a count of anything.
-- -------------------------------------------------------------------
create or replace function public.creator_orbit_list(p_identity_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_list jsonb;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or v_me.owner_id is distinct from v_caller then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'username', i.username,
           'circle', exists (
             select 1 from public.creator_orbits back
              where back.orbiter_id = o.orbited_id
                and back.orbited_id = o.orbiter_id
           )
         ) order by o.created_at), '[]'::jsonb)
    into v_list
    from public.creator_orbits o
    join public.magic_card_identities i on i.id = o.orbited_id
   where o.orbiter_id = v_me.id
     and i.username is not null;

  return jsonb_build_object('ok', true, 'orbit', v_list);
end;
$$;

grant execute on function public.creator_orbit_list(text) to anon, authenticated;
