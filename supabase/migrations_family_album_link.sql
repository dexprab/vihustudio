-- FAMILY ALBUM LINKS — a parent hands over a photo album by email,
-- without an account.
--
-- Asked for by the product owner: "add it in first email." The Magic
-- Card letter that already goes out (supabase/functions/sky-protection)
-- gains a short passage and ONE link. That link opens one page with one
-- field: paste a Google Photos share link. Done.
--
-- WHAT THIS IS, AND WHAT IT IS NOT.
--
-- It is not an account, a login, a password, a one-time code, a
-- verification step, a dashboard or a profile, and CLAUDE.md ->
-- Decisions 11 and 14 forbid every one of those by name. The parent
-- email is STORAGE, not a channel and not an identity; controlling the
-- inbox is the whole of the check, exactly as Sky Protection's own
-- recovery already works.
--
-- A link token is not an identity either. It names ONE THING — "album
-- links attached here belong to this child's album list" — and it
-- authorises exactly one act: appending a Google Photos album URL. It
-- cannot read an album list, cannot remove one, cannot reach a story, a
-- project, a Magic Card or a constellation, and returns nothing about
-- the child who owns it. Holding one tells you nothing and gets you
-- nowhere else.
--
-- ---------------------------------------------------------------
-- THE OBSTACLE THIS EXISTS TO SOLVE, MEASURED.
--
--   create policy family_albums_insert on public.family_albums
--     for insert with check (owner_id = auth.uid()::text);
--
-- `family_albums.owner_id` is `auth.uid()` — the CHILD'S BROWSER
-- SESSION, not their Magic Card. A parent following a link on their own
-- phone is a different anonymous session, so a row they inserted would
-- be owned by them and invisible to the child's Studio forever. SELECT
-- already widens for a proven recall (`has_magic_recall_grant`); INSERT
-- does not, and should not.
--
-- SO THE INSERT IS PERFORMED ON THE CHILD'S BEHALF, by a SECURITY
-- DEFINER function that resolves the owner from the token — the same
-- shape `invite_create` and `invite_reached` already use (the token is
-- minted server-side, never chosen by a client; an unknown token
-- silently does nothing rather than erroring).
--
-- WHICH owner_id, AND HOW IT IS RESOLVED. `magic_card_identities` has
-- its own `owner_id`, stamped from `session.user.id` at claim time
-- (js/magicCard.js -> _pushIdentitySnapshot) — i.e. it is literally the
-- same `auth.uid()` value `family_albums.owner_id` holds for that child.
-- The join is not a guess and it is not the mistake recorded above
-- `has_magic_recall_grant`: that one failed because a join was written
-- INLINE IN A POLICY and died under the recaller's own RLS on
-- magic_card_identities. This one runs inside SECURITY DEFINER, which
-- is the fix that comment prescribes, and it resolves the owner LIVE at
-- attach time rather than copying it — one source of truth, nothing to
-- drift.
--
-- DISCLOSED, and it is a property of the existing table rather than of
-- this migration: `magic_card_identities.owner_id` is the device that
-- CLAIMED the card. A child who later recalls their sky on a second
-- device has a different `auth.uid()` there, so an album attached here
-- is read on that device through `family_albums_select`'s recall grant
-- rather than through ownership. js/familyAlbum.js's listAlbums() now
-- lets that policy define the set when no owner is named, instead of
-- filtering to the current session and hiding what the policy allows.
--
-- ---------------------------------------------------------------
-- Run this once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------
-- 1. The link.
-- ---------------------------------------------------------------
-- ONE LINK PER CHILD, FOREVER — reusable, never expiring, and both
-- halves were argued rather than assumed.
--
-- REUSABLE, not single-use. A parent adds the holiday album in March
-- and the school-play album in June, and the second one must not
-- require a second email: the parent email is storage, not a channel,
-- and a "here is another link" message is the first step to a mailing
-- list. A single-use token would force exactly that message.
--
-- NO EXPIRY. An expiring token is the safer choice for a credential,
-- because a leaked credential eventually dies. This is not a
-- credential — it appends one URL to one album list and reveals
-- nothing — so the only thing an expiry would reliably achieve is a
-- link that stops working precisely when a parent finally gets round to
-- it, six months after filing the letter. That is a broken promise in
-- exchange for almost no safety.
--
-- WHAT REPLACES AN EXPIRY IS A CEILING. `albums_added` is capped, so a
-- link that did somehow escape can add a couple of dozen albums to one
-- child's list and then nothing at all. The child can remove any of
-- them from the Studio, which is the whole of the damage.
--
-- STABLE, not per-letter. The `protect` letter and a later `recover`
-- letter carry the SAME link, so a parent who kept either one — or
-- bookmarked the page — is never holding a dead link and never has to
-- work out which of two is current.
create table if not exists public.family_album_links (
  token        text primary key,
  -- The child this link attaches albums for. The owner is resolved
  -- from here at attach time and is deliberately NOT copied into this
  -- table: one source of truth.
  identity_id  text not null unique
                 references public.magic_card_identities(id) on delete cascade,
  created_at   timestamptz not null default now(),
  -- Bookkeeping, and the ceiling's counter. Four values, none of them
  -- about a child: when the link was made, when it was last used, and
  -- how many albums came in through it.
  last_used_at timestamptz,
  albums_added integer not null default 0
);

alter table public.family_album_links enable row level security;

-- NO POLICIES AT ALL, deliberately — the same discipline `invites` and
-- `story_cheers` already use. Every read and every write goes through
-- the SECURITY DEFINER functions below, so there is no direct table
-- access to get wrong and the anon key grants nothing. In particular
-- nobody can list tokens, and nobody can turn a token back into a
-- child.

-- ---------------------------------------------------------------
-- 2. Minting a link. The letter's sender only.
-- ---------------------------------------------------------------
-- THE TOKEN IS MINTED HERE, not in the browser and not in the Edge
-- Function's own code, for `invite_create`'s reason: a client-chosen
-- token could collide with, or deliberately guess at, somebody else's.
-- A server-side gen_random_uuid() cannot.
--
-- Idempotent by construction — one row per identity, so calling this on
-- every letter returns the link that already exists rather than
-- minting a second one.
--
-- EXECUTE is granted to service_role ONLY. This is reachable from the
-- sky-protection Edge Function, which holds the service key, and from
-- nowhere a browser can get to: the anon key cannot mint a link for a
-- card it names, which would otherwise be a way to attach albums to a
-- stranger's child.
create or replace function public.family_album_link_mint(p_identity_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if coalesce(trim(p_identity_id), '') = '' then
    return null;
  end if;
  -- A card that does not exist gets no link, rather than a link that
  -- points at nothing.
  if not exists (select 1 from public.magic_card_identities where id = p_identity_id) then
    return null;
  end if;

  select token into v_token
    from public.family_album_links
   where identity_id = p_identity_id;
  if v_token is not null then
    return v_token;
  end if;

  -- Long enough that guessing one is pointless, short enough to sit in
  -- a URL a parent may retype from a printed page.
  v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);

  insert into public.family_album_links (token, identity_id)
  values (v_token, p_identity_id)
  on conflict (identity_id) do nothing;

  -- Lost a race with another letter going out at the same instant:
  -- read back whichever token won. Never two links for one child.
  select token into v_token
    from public.family_album_links
   where identity_id = p_identity_id;

  return v_token;
end;
$$;

revoke all on function public.family_album_link_mint(text) from public, anon, authenticated;
grant execute on function public.family_album_link_mint(text) to service_role;

-- ---------------------------------------------------------------
-- 3. Attaching an album. Callable by anybody holding the link.
-- ---------------------------------------------------------------
-- CALLABLE BY ANON, and that is correct: the parent following the link
-- has no account and never will (Decision 11). What stops this being
-- abusable is that it can only ever APPEND one Google Photos URL to one
-- child's album list, there is nothing to gain from doing so, and the
-- ceiling above bounds how often.
--
-- IT ANSWERS, IT NEVER RAISES. Every expected outcome comes back as
-- jsonb {ok, reason} — the same contract the sky-protection and
-- voice-speak Edge Functions use, so the page needs no error handling
-- and can never show a database's words to a parent. An unknown or
-- stale token is `unknown_link`, not an exception.
--
-- IT RETURNS NOTHING ABOUT THE CHILD. No nickname, no constellation, no
-- id, not even a count. The letter that carried the link already names
-- whose photos these are, which is the right place for it: a page
-- reached by a link should not be able to tell a stranger who it
-- belongs to.
--
-- THE ALLOW-LIST IS ENFORCED HERE TOO, not only in the page. It is the
-- same one js/familyAlbum.js and the family-album Edge Function both
-- use — https, and photos.app.goo.gl or photos.google.com. A page can
-- be bypassed; this cannot, so `family_albums` can never come to hold a
-- URL pointing anywhere else.
create or replace function public.family_album_attach(
  p_token text,
  p_album_url text,
  p_label text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Two dozen albums is far past what any family needs and far short of
  -- anything worth doing on purpose. It exists so a link that escaped
  -- runs out rather than running forever.
  c_max_albums constant integer := 24;
  v_link       public.family_album_links;
  v_owner      text;
  v_url        text;
  v_host       text;
  v_id         text;
begin
  v_url := trim(coalesce(p_album_url, ''));

  -- Shape first, so an empty box is answered without a lookup.
  if v_url = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_link');
  end if;
  if position('https://' in lower(v_url)) <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'not_an_album');
  end if;
  -- Host = everything between https:// and the next / ? or #, with any
  -- userinfo stripped. `^.*@` is greedy on purpose, so it cuts to the
  -- LAST '@' — which is what a browser does, and is why
  -- https://photos.app.goo.gl@somewhere.else/x resolves to
  -- somewhere.else here and is refused, rather than sailing through on
  -- a prefix that looks right.
  v_host := regexp_replace(regexp_replace(substr(lower(v_url), 9), '[/?#].*$', ''), '^.*@', '');
  -- A port, or anything else clever, stays attached to the host and so
  -- fails this test: it has to be exactly one of the two, bare.
  if v_host not in ('photos.app.goo.gl', 'photos.google.com') then
    return jsonb_build_object('ok', false, 'reason', 'not_an_album');
  end if;

  select * into v_link
    from public.family_album_links
   where token = coalesce(trim(p_token), '');
  if v_link.token is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_link');
  end if;

  -- THE RESOLUTION THIS WHOLE MIGRATION EXISTS FOR. The child's
  -- `owner_id` is read from their identity row LIVE, under SECURITY
  -- DEFINER, and the insert below is written against it — which is the
  -- one thing a parent's own session could never do for itself.
  select owner_id into v_owner
    from public.magic_card_identities
   where id = v_link.identity_id;
  if coalesce(v_owner, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'unknown_link');
  end if;

  -- ALREADY THERE IS A SUCCESS, not a failure and not a second row. A
  -- parent who presses twice, or pastes the same album next month
  -- having forgotten, should be told the photos are there — which is
  -- true — rather than told off or given a duplicate. It costs no use
  -- against the ceiling, because nothing was added.
  if exists (
    select 1 from public.family_albums
     where owner_id = v_owner and album_url = v_url
  ) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if v_link.albums_added >= c_max_albums then
    return jsonb_build_object('ok', false, 'reason', 'enough_albums');
  end if;

  v_id := 'fam_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  -- `where not exists` rather than a unique index: this table has been
  -- in use since before this migration and may already hold a duplicate
  -- somebody made by hand, and failing a migration on real data is
  -- worse than the race it would close. DISCLOSED — two genuinely
  -- simultaneous attaches of the same URL can both pass this check and
  -- both insert. That is one spare row a child can remove in the
  -- Studio, and the page disables its own button while a press is in
  -- flight.
  insert into public.family_albums (id, owner_id, album_url, label, sort_order, updated_at)
  select v_id, v_owner, v_url, coalesce(trim(p_label), ''), 0, now()
   where not exists (
     select 1 from public.family_albums
      where owner_id = v_owner and album_url = v_url
   );

  update public.family_album_links
     set albums_added = albums_added + 1,
         last_used_at = now()
   where token = v_link.token;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.family_album_attach(text,text,text) from public;
grant execute on function public.family_album_attach(text,text,text) to anon, authenticated;
