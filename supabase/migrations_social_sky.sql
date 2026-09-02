-- ===================================================================
-- SPRINT SOCIAL SKY R1 — the Sky, Show, Gifts, and mutual visibility.
--
-- Builds ON TOP of migrations_social_identity.sql and
-- migrations_social_orbit.sql (run those first). Nothing in either is
-- replaced; creator_orbits, orbit_set and orbit_list are untouched.
--
-- WHAT CHANGES ABOUT "WHO ORBITS ME" — an amendment, on the product
-- owner's frozen R1 canon. Decision 54 said the mutual bit was the
-- ONLY fact ever revealed about the other direction. R1 freezes the
-- new-star experience: when another Creator chooses me, a new star
-- appears in MY OWN Sky, and its identity is discoverable there. So
-- the OWNER of a card may now see who chose them — and nobody else
-- may, there is still no count anywhere, no public list, and the
-- other party is still never told what I know. creator_sky_list is
-- owner-verified exactly like orbit_list, and it is the only reader.
--
-- SHOW / GIFTS — "I made this. I want you to see it."
--   * A Show is a SNAPSHOT of the creation, copied at send time, so a
--     later relationship change rewrites nothing (the historical
--     rule: every action is a unit).
--   * Eligibility is the sender's own choice: I can Show to a Creator
--     I have CHOSEN (my own orbit row). Somebody merely choosing me
--     grants them nothing and grants me nothing toward them.
--   * The recipient reads their own gifts and nothing else. A sender
--     can never ask whether a gift was seen or kept — that would be a
--     read receipt, which is messaging furniture.
--   * RLS is ON with NO policies: SECURITY DEFINER functions only
--     (the story_cheers / creator_orbits discipline).
--
-- MUTUAL VISIBILITY — the one R1 capability beyond mutuality itself:
-- a mutual Creator can see the other's work that has NOT been pushed
-- to Ether. Checked LIVE at call time, so relationship state controls
-- future access (ending the mutuality ends the visibility, while
-- anything already Shown or Kept stays — units of the past).
-- ===================================================================

-- -------------------------------------------------------------------
-- The Sky, as its owner may see it.
--   sky      — the Creators I chose (my orbit), each with the ONE
--              mutual fact and their companion (for the Sky's visual
--              representation — Creators appear through Companions).
--   choseMe  — Creators who chose me and whom I have not chosen:
--              the new stars. Owner-only, never a count on any other
--              surface, and the other party is never told I know.
-- -------------------------------------------------------------------
-- R3.7 — A CARD PROVEN ON THIS DEVICE MAY ACT AS ITSELF.
-- Reported by the product owner: vihupapa stood in vihu01's sky, but
-- vihu01 never appeared in vihupapa's — because every social function
-- here demanded owner_id = auth.uid(), the SESSION THAT CLAIMED the
-- card. A Creator recognised on any other device (stars, camera, or
-- code — Decision 11's whole point) is a different session, so every
-- orbit write answered not_yours, silently, while the local echo
-- painted "In your Sky" on the chooser's own screen. The platform
-- already has the evidence standard for exactly this: recall_magic_card
-- records a magic_card_recalls row on every PROVEN recall, and every
-- SELECT-widening trusts it (has_magic_recall_grant). Acting AS a card
-- now accepts the same proof, scoped to THAT card: the claiming
-- session, or a session that proved this exact card on this device.
-- A typed guess proves nothing and still cannot act.
-- -------------------------------------------------------------------
create or replace function public.card_acted_for(p_card_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.magic_card_identities i
     where i.id = p_card_id
       and (i.owner_id = auth.uid()::text
         or exists (
              select 1 from public.magic_card_recalls r
               where r.identity_id = i.id
                 and r.recaller_id = auth.uid()::text))
  );
$$;

grant execute on function public.card_acted_for(text) to anon, authenticated;

-- -------------------------------------------------------------------
create or replace function public.creator_sky_list(p_identity_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_sky jsonb;
  v_chose_me jsonb;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'username', i.username,
           'companion', i.companion_id,
           'circle', exists (
             select 1 from public.creator_orbits back
              where back.orbiter_id = o.orbited_id
                and back.orbited_id = o.orbiter_id
           )
         ) order by o.created_at), '[]'::jsonb)
    into v_sky
    from public.creator_orbits o
    join public.magic_card_identities i on i.id = o.orbited_id
   where o.orbiter_id = v_me.id
     and i.username is not null;

  -- The new stars: choosers I have not chosen back. A chooser with no
  -- public username cannot appear (there is no honest way to show
  -- them), which also means only Creators discoverable through their
  -- own public creations ever surface here.
  select coalesce(jsonb_agg(jsonb_build_object(
           'username', i.username,
           'companion', i.companion_id,
           'since', o.created_at
         ) order by o.created_at desc), '[]'::jsonb)
    into v_chose_me
    from public.creator_orbits o
    join public.magic_card_identities i on i.id = o.orbiter_id
   where o.orbited_id = v_me.id
     and i.username is not null
     and not exists (
       select 1 from public.creator_orbits fwd
        where fwd.orbiter_id = v_me.id
          and fwd.orbited_id = o.orbiter_id
     );

  return jsonb_build_object('ok', true, 'sky', v_sky, 'choseMe', v_chose_me);
end;
$$;

grant execute on function public.creator_sky_list(text) to anon, authenticated;

-- -------------------------------------------------------------------
-- Shows — snapshots of creations, from one Creator to another.
-- -------------------------------------------------------------------
create table if not exists public.creator_shows (
  id          text primary key
              default ('show_' || replace(gen_random_uuid()::text, '-', '')),
  from_id     text not null references public.magic_card_identities(id) on delete cascade,
  to_id       text not null references public.magic_card_identities(id) on delete cascade,
  kind        text not null,
  name        text not null default '',
  -- Where the original lived in the sender's world — so KEEP can put
  -- the copy in the corresponding place ({store:'projects'} ·
  -- {store:'garden', room:'drawings'} · {store:'letters', ch:'A'}).
  place       jsonb not null default '{}'::jsonb,
  -- The creation itself, copied at send time. A snapshot, so the gift
  -- survives anything that later happens to the original or to the
  -- relationship (every action is a unit).
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  seen_at     timestamptz,
  kept_at     timestamptz,
  check (from_id <> to_id)
);

-- R2 — THE COMPANION CARRIES WORDS AS WELL AS THE CREATION.
-- `note` is the Creator's own optional message, stored VERBATIM (the
-- Companion speaks the child's actual words — never rewritten,
-- summarized or embellished by anything). `companion_name` is what
-- the SENDER calls their Companion at send time — a child-given name
-- has no column on the identity (Decision 47: it is relationship
-- state), but the sender choosing to Show is the sender choosing to
-- introduce their Companion by the name they gave it, so it travels
-- as a snapshot ON THE SHOW, like creatorName travels with a story.
alter table public.creator_shows add column if not exists note text not null default '';
alter table public.creator_shows add column if not exists companion_name text not null default '';

create index if not exists creator_shows_to_idx
  on public.creator_shows (to_id, created_at desc);

alter table public.creator_shows enable row level security;
-- Deliberately NO policies: SECURITY DEFINER functions only.

-- -------------------------------------------------------------------
-- Show a creation to a Creator I have chosen.
--   * caller must OWN the sending identity (sky-protection rule)
--   * the recipient is named by public username
--   * ELIGIBILITY IS MY OWN CHOICE: an orbit row from me to them must
--     exist. "They chose me" alone grants no Show in either direction.
--   * the payload is capped, and a sender is capped per day, so the
--     gift store can never become anybody's free hosting
--   * showing NEVER touches creator_projects, never publishes, and
--     never changes creator_orbits — verified by the suite
-- -------------------------------------------------------------------
drop function if exists public.creation_show_send(text, text, text, text, jsonb, jsonb);

create or replace function public.creation_show_send(
  p_identity_id text,
  p_username    text,
  p_kind        text,
  p_name        text,
  p_place       jsonb,
  p_payload     jsonb,
  p_note        text default null,
  p_companion_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_them public.magic_card_identities;
  v_id text;
  v_recent int;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
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

  -- The sender must have CHOSEN the recipient. Being chosen BY them
  -- is not enough (frozen §9), and the check is live: what the
  -- relationship is NOW decides what may happen now.
  if not exists (
    select 1 from public.creator_orbits
     where orbiter_id = v_me.id and orbited_id = v_them.id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_chosen');
  end if;

  if p_kind is null or p_kind not in ('story', 'drawing', 'letter') then
    return jsonb_build_object('ok', false, 'reason', 'unsupported');
  end if;

  if p_payload is null
     or length(p_payload::text) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;

  -- A quiet ceiling, not a quota anybody sees: forty shows a day is
  -- far past any child's real use and stops a runaway client.
  select count(*) into v_recent
    from public.creator_shows
   where from_id = v_me.id
     and created_at > now() - interval '24 hours';
  if v_recent >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'later');
  end if;

  insert into public.creator_shows (from_id, to_id, kind, name, place, payload,
                                    note, companion_name)
  values (v_me.id, v_them.id, p_kind,
          left(coalesce(p_name, ''), 120),
          coalesce(p_place, '{}'::jsonb),
          p_payload,
          -- The child's own words, verbatim. left() is a technical
          -- cap on runaway input, never an edit.
          left(trim(coalesce(p_note, '')), 200),
          left(trim(coalesce(p_companion_name, '')), 40))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.creation_show_send(text, text, text, text, jsonb, jsonb, text, text)
  to anon, authenticated;

-- -------------------------------------------------------------------
-- My gifts — metadata only, newest first. The payload travels
-- separately (creation_show_get) so the Sky's quiet 🎁 indicator does
-- not pull every creation ever shown. Recipient-only: a sender can
-- never list what they sent, and never learns seen/kept.
-- -------------------------------------------------------------------
create or replace function public.creation_show_list(p_identity_id text)
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
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  -- `companion` is the CARRIER: the sender's own Companion, which is
  -- the thing that crossed between worlds (a Creator and their
  -- creation never do — the core world rule). The client draws it
  -- revealing the gift; no identifier beyond the public username
  -- travels with it.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'from', i.username,
           'companion', i.companion_id,
           'companionName', s.companion_name,
           'kind', s.kind,
           'name', s.name,
           'place', s.place,
           'at', s.created_at,
           'seen', s.seen_at is not null,
           'kept', s.kept_at is not null
         ) order by s.created_at desc), '[]'::jsonb)
    into v_list
    from (select * from public.creator_shows
           where to_id = p_identity_id
           order by created_at desc
           limit 100) s
    join public.magic_card_identities i on i.id = s.from_id;

  return jsonb_build_object('ok', true, 'gifts', v_list);
end;
$$;

grant execute on function public.creation_show_list(text) to anon, authenticated;

-- -------------------------------------------------------------------
-- One gift, with its creation. Recipient-only.
-- -------------------------------------------------------------------
create or replace function public.creation_show_get(p_identity_id text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_show public.creator_shows;
  v_from text;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select * into v_show from public.creator_shows
   where id = p_id and to_id = v_me.id;
  if v_show.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select username into v_from from public.magic_card_identities where id = v_show.from_id;

  return jsonb_build_object('ok', true, 'gift', jsonb_build_object(
    'id', v_show.id,
    'from', v_from,
    'companion', (select companion_id from public.magic_card_identities where id = v_show.from_id),
    'companionName', v_show.companion_name,
    'note', v_show.note,
    'kind', v_show.kind,
    'name', v_show.name,
    'place', v_show.place,
    'at', v_show.created_at,
    'seen', v_show.seen_at is not null,
    'kept', v_show.kept_at is not null,
    'payload', v_show.payload));
end;
$$;

grant execute on function public.creation_show_get(text, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- Mark a gift seen or kept. Recipient-only, idempotent, and NO
-- eligibility re-check on purpose: the Show already happened, and a
-- relationship ending later does not rewrite it (the historical
-- rule). The KEEP copy itself is made in the recipient's own stores
-- by the client — this only records that they chose to keep it.
-- -------------------------------------------------------------------
create or replace function public.creation_show_mark(
  p_identity_id text, p_id text, p_what text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_n int;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  if p_what = 'seen' then
    update public.creator_shows
       set seen_at = coalesce(seen_at, now())
     where id = p_id and to_id = v_me.id;
  elsif p_what = 'kept' then
    update public.creator_shows
       set kept_at = coalesce(kept_at, now()),
           seen_at = coalesce(seen_at, now())
     where id = p_id and to_id = v_me.id;
  else
    return jsonb_build_object('ok', false, 'reason', 'unsupported');
  end if;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.creation_show_mark(text, text, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- A mutual Creator's work that has NOT been pushed to Ether.
--   * caller must OWN the asking identity
--   * BOTH orbit rows must exist RIGHT NOW — mutuality is checked
--     live, so ending it ends this visibility with it
--   * eligible work = that Creator's own project records
--     (data->>'cardId' names them) that carry no publishedAt and are
--     not a held rite story — i.e. exactly what would stand in their
--     own My Projects minus what is already in the Ether
--   * an unknown username and a non-mutual Creator answer identically
--     — this is never an oracle for anything
-- -------------------------------------------------------------------
create or replace function public.creator_mutual_projects(
  p_identity_id text, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_them public.magic_card_identities;
  v_list jsonb;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select * into v_them from public.magic_card_identities
   where lower(username) = lower(trim(coalesce(p_username, '')));

  if v_them.id is null
     or not exists (
       select 1 from public.creator_orbits
        where orbiter_id = v_me.id and orbited_id = v_them.id)
     or not exists (
       select 1 from public.creator_orbits
        where orbiter_id = v_them.id and orbited_id = v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_mutual');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'record', p.data
         ) order by p.updated_at desc), '[]'::jsonb)
    into v_list
    from (select * from public.creator_projects
           where data->>'cardId' = v_them.id
             and is_shared is not true
             and data->>'riteInProgress' is null
           order by updated_at desc
           limit 40) p;

  return jsonb_build_object('ok', true, 'projects', v_list);
end;
$$;

grant execute on function public.creator_mutual_projects(text, text) to anon, authenticated;

-- -------------------------------------------------------------------
-- R2.1 — ANY CREATOR IS FINDABLE BY THEIR EXACT @NAME.
-- Decided by the product owner ("i dont think there is any rule which
-- says only creator who have shared on ether can only be searchable"),
-- overturning Social 1's creation-first discoverability. What that
-- rule actually protected is KEPT: this is an exact-match lookup, so
-- there is still nothing to browse and nothing to enumerate — no
-- prefix search, no listing, and the Find suggestions still come only
-- from names already standing on public Spirits. What it answers is
-- public by construction: the @name itself (globally unique, and its
-- existence already answerable through the claim flow) and the
-- Companion — the being a child would meet. No nickname, no ids, no
-- session, no email, no counts.
-- -------------------------------------------------------------------
create or replace function public.creator_find(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('ok', true,
             'username', i.username,
             'companion', nullif(i.companion_id, ''),
             'species', nullif(i.companion_species, ''))
      from public.magic_card_identities i
     where i.username is not null and i.username <> ''
       and lower(i.username) = lower(trim(coalesce(p_username, '')))
     limit 1),
    jsonb_build_object('ok', false));
$$;

grant execute on function public.creator_find(text) to anon, authenticated;

-- -------------------------------------------------------------------
-- R2.2 — SUGGESTIONS REACH THE WHOLE PLATFORM. Reported by the
-- product owner: "to search vihu01 i have to type it full and than
-- click on find button" — typing "vihu" offered only the names
-- already standing on loaded Spirits. creator_suggest answers a
-- PREFIX of three or more characters with up to eight public @names,
-- names alone. Still bounded on purpose: a shorter ask answers
-- nothing (so an empty field still offers no directory), the prefix
-- must be the username alphabet itself (which also makes LIKE
-- injection impossible — no escaping to get wrong), and eight is a
-- handful to tap, not a roster to scroll.
-- -------------------------------------------------------------------
create or replace function public.creator_suggest(p_prefix text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(trim(coalesce(p_prefix, ''))) !~ '^[a-z0-9_]{3,20}$'
      then jsonb_build_object('ok', false)
    else jsonb_build_object('ok', true, 'names', coalesce((
      select jsonb_agg(t.u order by t.u)
        from (select lower(i.username) as u
                from public.magic_card_identities i
               where i.username is not null and i.username <> ''
                 -- '_' is a legal username character AND a LIKE
                 -- wildcard: escaped, so my_name matches literally.
                 and lower(i.username) like replace(lower(trim(p_prefix)), '_', '\_') || '%'
               order by lower(i.username)
               limit 8) t),
      '[]'::jsonb))
  end;
$$;

grant execute on function public.creator_suggest(text) to anon, authenticated;


-- -------------------------------------------------------------------
-- R3.7 — the ORBIT functions (migrations_social_orbit.sql) widened to
-- the same standard, redefined here so ONE re-run of this file carries
-- the whole correction. Bodies identical to the originals; only the
-- acting-as-a-card check changed.
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
  if v_me.id is null or not public.card_acted_for(v_me.id) then
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
  if v_me.id is null or not public.card_acted_for(v_me.id) then
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

-- -------------------------------------------------------------------
-- R3.8 — WHAT HAVE I SHOWN THEM SO FAR? Asked for by the product
-- owner: "for people in my sky, i should be able to see what i have
-- shown them so far, this will allow me not to reshare same thing
-- again and again. you can show kept/not kept status also if needed."
-- A sender's own send history is their own past — units of their own
-- actions, not a window into the recipient. The owner's words AMEND
-- the R1 canon's read-receipt line for KEPT alone: kept answers the
-- exact question this exists for ("should I share it again?"), so it
-- travels. SEEN stays the recipient's own forever — whether a gift
-- has merely been looked at is never the sender's to know, and
-- seen_at is deliberately not read here.
-- -------------------------------------------------------------------
create or replace function public.creation_show_sent(p_identity_id text, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller text := auth.uid()::text;
  v_me public.magic_card_identities;
  v_them public.magic_card_identities;
  v_list jsonb;
begin
  if v_caller is null or v_caller = '' then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select * into v_me from public.magic_card_identities where id = p_identity_id;
  if v_me.id is null or not public.card_acted_for(v_me.id) then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;

  select * into v_them from public.magic_card_identities
   where lower(username) = lower(trim(coalesce(p_username, '')));
  if v_them.id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'kind', s.kind,
           'name', s.name,
           'at', s.created_at,
           'kept', s.kept_at is not null,
           -- the snapshot's own small image, so the list can show
           -- what was shown without re-shipping story payloads
           'cover', coalesce(s.payload->>'thumbnail', s.payload->>'png')
         ) order by s.created_at desc), '[]'::jsonb)
    into v_list
    from (select * from public.creator_shows
           where from_id = v_me.id and to_id = v_them.id
           order by created_at desc
           limit 60) s;

  return jsonb_build_object('ok', true, 'sent', v_list);
end;
$$;

grant execute on function public.creation_show_sent(text, text) to anon, authenticated;
