-- =============================================================
-- Sprint LOOK WHAT I MADE — the Creation Share.
--
-- A child says "Look what I made." An adult, somewhere else,
-- opens exactly that creation. The bridge between those two
-- sentences is ONE opaque token:
--
--   creation  →  share record  →  opaque token  →  look.html?t=…
--
-- WHY A TOKEN AND NEVER A PROJECT ID. The project id is the key
-- to a private store (creator_projects is owner-scoped, and only
-- rows a child deliberately shared with VihuPlanet widen). A
-- share must be able to carry a creation that was NEVER shared
-- with the Ether — a drawing made this afternoon — so it cannot
-- lean on is_shared, and it must never teach the world a private
-- identifier. The token names a SNAPSHOT the child chose to send,
-- and nothing else: not the project, not the card, not the
-- session, not the device.
--
-- ONE STABLE TOKEN PER CREATION, the family_album_links lesson:
-- a Story Card printed in March must still come alive in June, so
-- re-sharing the same creation returns the SAME token and simply
-- refreshes the snapshot behind it. A link that died on reprint
-- would make the physical card a lie.
--
-- WHAT A SHARE ROW HOLDS is the deliberately shareable payload
-- ONLY — page images at reading size, the making frames, a title,
-- a first name. It is swept by shape in the creation-share Edge
-- Function before it ever reaches this table (whitelisted keys,
-- data-URI images, bounded sizes), so even a hand-crafted caller
-- cannot park private memory, Stars, identifiers or conversation
-- here: the mint refuses anything that is not the contract.
--
-- RLS is ON with NO POLICIES AT ALL, deliberately — the same
-- discipline `story_cheers`, `invites` and `family_album_links`
-- already use. Every read and every write goes through the two
-- SECURITY DEFINER functions below, so there is no path on which
-- a browser can list shares, count them, or turn a token back
-- into an owner.
--
-- Run this whole file once in the Supabase SQL editor. It returns
-- nothing; supabase/verify_creation_share.sql is the check.
-- =============================================================

create extension if not exists pgcrypto;

create table if not exists public.creation_shares (
  token          text primary key,
  -- The verified session that minted it (auth.uid of the child's
  -- browser). Never returned by any function.
  owner_id       text not null,
  -- The Magic Card standing when it was minted, when one was — a
  -- first share can predate a card (Canon 6 puts the Ceremony
  -- after sharing). Never returned by any function.
  identity_id    text,
  -- Which creation this is, so re-sharing refreshes rather than
  -- multiplies. Internal only: the resolve function never returns
  -- it, and the URL never carries it.
  project_id     text not null,
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- How often the door was opened. A count, kept for the product
  -- to reason about delivery problems — never shown to a child
  -- (no counters, no levels) and never returned to a browser.
  opened_count   integer not null default 0,
  last_opened_at timestamptz
);

-- The stability rule, enforced by the database rather than by a
-- careful caller: one share per (owner, creation).
create unique index if not exists creation_shares_owner_project_idx
  on public.creation_shares (owner_id, project_id);

alter table public.creation_shares enable row level security;
-- NO POLICIES, see the header.

-- ---------------------------------------------------------------
-- Mint (or refresh) the share for one creation.
--
-- service_role ONLY. A browser never mints a token directly — the
-- creation-share Edge Function derives the caller from a verified
-- session, sweeps the payload by shape, and only then asks for a
-- token. The same rule invite_create and family_album_link_mint
-- already follow: a client never chooses or mints a token.
-- ---------------------------------------------------------------
create or replace function public.creation_share_mint(
  p_owner_id    text,
  p_identity_id text,
  p_project_id  text,
  p_payload     jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if coalesce(trim(p_owner_id), '') = '' then return null; end if;
  if coalesce(trim(p_project_id), '') = '' then return null; end if;
  if p_payload is null then return null; end if;

  select token into v_token
    from public.creation_shares
   where owner_id = trim(p_owner_id) and project_id = trim(p_project_id);

  if v_token is not null then
    -- The same creation, shared again: the snapshot refreshes and
    -- every letter, card and bookmark ever sent keeps working.
    update public.creation_shares
       set payload     = p_payload,
           identity_id = coalesce(nullif(trim(p_identity_id), ''), identity_id),
           updated_at  = now()
     where token = v_token;
    return v_token;
  end if;

  -- Long enough that guessing one is pointless, short enough to
  -- live in a URL and a QR code (the family_album_links length).
  v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);

  insert into public.creation_shares (token, owner_id, identity_id, project_id, payload)
  values (v_token, trim(p_owner_id), nullif(trim(p_identity_id), ''), trim(p_project_id), p_payload)
  on conflict (owner_id, project_id) do nothing;

  -- Lost a race with the same child pressing twice: read back
  -- whichever token won. Never two tokens for one creation.
  select token into v_token
    from public.creation_shares
   where owner_id = trim(p_owner_id) and project_id = trim(p_project_id);

  return v_token;
end;
$$;

revoke all on function public.creation_share_mint(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.creation_share_mint(text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------
-- Resolve a token into the creation it carries.
--
-- Callable by ANYBODY — a parent clicking a letter, a friend
-- scanning a card, with no account and no session, because there
-- is nothing here to protect FROM them: holding the token IS the
-- invitation, exactly as family-photos.html already works. What
-- comes back is the swept payload and nothing else — no owner, no
-- card, no project id, no dates, no count. An unknown token and a
-- malformed one answer identically, so this can never become an
-- oracle for which tokens exist. Answers, never raises.
-- ---------------------------------------------------------------
create or replace function public.creation_share_resolve(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if coalesce(trim(p_token), '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  select payload into v_payload
    from public.creation_shares
   where token = trim(p_token);

  if v_payload is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown');
  end if;

  update public.creation_shares
     set opened_count = opened_count + 1,
         last_opened_at = now()
   where token = trim(p_token);

  return jsonb_build_object('ok', true, 'creation', v_payload);
end;
$$;

grant execute on function public.creation_share_resolve(text) to anon, authenticated, service_role;
