-- INVITES — asked for by the product owner: "creating an invite for
-- vihuplanet which can be mailed by lumo. setup a page from where i can
-- send out the invite on email ids and than track if the invite was
-- accepted. same for whatsapp also."
--
-- WHAT THIS IS, AND WHAT IT IS NOT.
--
-- This is an ADULT-facing outreach record: who was invited, through
-- which channel, and how far that invitation got. It is not analytics on
-- children, and it must never become that. Nothing here records what a
-- child made, read, cheered, or how long they stayed — the whole table
-- holds four timestamps per invitation and nothing else.
--
-- CLAUDE.md -> Decisions 11 and 14 forbid accounts and logins for
-- CHILDREN, and the Magic Card remains the only identity inside the
-- universe. An invite token is not an identity: it names an INVITATION,
-- never a person, it is never asked for, never shown to a child, and
-- carrying one grants nothing at all. A child who arrives through an
-- invite link gets exactly the same VihuPlanet as a child who typed the
-- address.
--
-- WHAT "ACCEPTED" MEANS. Decided by the product owner: an invitation is
-- accepted when the invited child becomes a Creator — that is, finishes
-- their first story. The three earlier timestamps exist so a dead
-- invitation can be told apart from a busy one: sent but never opened is
-- a different problem from opened but never begun.
--
--   sent_at      the letter went out
--   opened_at    somebody followed the link and VihuPlanet loaded
--   explored_at  they crossed the threshold — they are actually in
--   creator_at   they finished their first story. ACCEPTED.
--
-- Run this once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------
create table if not exists public.invites (
  token         text primary key,
  channel       text not null check (channel in ('email','whatsapp')),
  -- The recipient as the sender typed it: an email address, or a phone
  -- number for WhatsApp. An adult's contact detail, given by the adult
  -- who is doing the inviting.
  recipient     text not null,
  -- Optional, purely for the sender's own memory ("Aarav's mum").
  label         text default '',
  invited_by    text not null,          -- the admin's verified email
  created_at    timestamptz not null default now(),
  sent_at       timestamptz,
  opened_at     timestamptz,
  explored_at   timestamptz,
  creator_at    timestamptz,
  -- Set when the send itself failed, so a broken address is visible
  -- rather than looking like an invitation nobody opened.
  send_error    text
);

create index if not exists invites_created_idx on public.invites (created_at desc);
create index if not exists invites_channel_idx on public.invites (channel);

alter table public.invites enable row level security;

-- NO POLICIES AT ALL, deliberately — the same discipline story_cheers
-- already uses (Decision 20). Every read and every write goes through
-- the SECURITY DEFINER functions below, so there is no direct table
-- access to get wrong, and the anon key grants nothing.

-- ---------------------------------------------------------------
-- 2. Creating an invitation. Admins only.
-- ---------------------------------------------------------------
-- The TOKEN IS MINTED HERE, not in the browser. A client-chosen token
-- could collide with, or deliberately guess at, somebody else's
-- invitation; a server-side gen_random_uuid() cannot.
create or replace function public.invite_create(
  p_channel text,
  p_recipient text,
  p_label text default ''
)
returns table (token text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_platform_admin() then
    raise exception 'not permitted';
  end if;
  if p_channel not in ('email','whatsapp') then
    raise exception 'unknown channel';
  end if;
  if coalesce(trim(p_recipient),'') = '' then
    raise exception 'no recipient';
  end if;

  -- Short enough to sit in a WhatsApp message without looking like a
  -- ransom note, long enough that guessing one is pointless. It
  -- authorises nothing anyway.
  v_token := replace(gen_random_uuid()::text, '-', '');
  v_token := substr(v_token, 1, 16);

  insert into public.invites (token, channel, recipient, label, invited_by)
  values (v_token, p_channel, trim(p_recipient), coalesce(trim(p_label),''), auth.jwt() ->> 'email');

  return query
    select v_token, now();
end;
$$;

revoke all on function public.invite_create(text,text,text) from public;
grant execute on function public.invite_create(text,text,text) to authenticated;

-- ---------------------------------------------------------------
-- 3. Marking one as sent (or as failed to send).
-- ---------------------------------------------------------------
create or replace function public.invite_mark_sent(p_token text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not permitted';
  end if;
  update public.invites
     set sent_at    = case when p_error is null then now() else sent_at end,
         send_error = p_error
   where token = p_token;
end;
$$;

revoke all on function public.invite_mark_sent(text,text) from public;
grant execute on function public.invite_mark_sent(text,text) to authenticated;

-- ---------------------------------------------------------------
-- 4. The journey, recorded by the invited child's own browser.
-- ---------------------------------------------------------------
-- CALLABLE BY ANYBODY, and that is correct: the child following the
-- link has no account and never will (Decision 11). What stops this
-- being abusable is that it can only ever move an invitation FORWARD,
-- a stage at a time, and there is nothing to gain from doing so — no
-- reward, no unlock, no content. An unknown token silently does
-- nothing rather than erroring, so a stale or mistyped link is simply
-- a normal visit.
--
-- Each timestamp is written ONCE. A child who opens the link fifty
-- times is one opened invitation, not fifty.
create or replace function public.invite_reached(p_token text, p_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_stage not in ('opened','explored','creator') then
    return;
  end if;
  update public.invites
     set opened_at   = case when p_stage in ('opened','explored','creator')
                            then coalesce(opened_at, now()) else opened_at end,
         explored_at = case when p_stage in ('explored','creator')
                            then coalesce(explored_at, now()) else explored_at end,
         creator_at  = case when p_stage = 'creator'
                            then coalesce(creator_at, now()) else creator_at end
   where token = p_token;
end;
$$;

revoke all on function public.invite_reached(text,text) from public;
grant execute on function public.invite_reached(text,text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 5. The roll, for the admin page.
-- ---------------------------------------------------------------
create or replace function public.invite_roll()
returns table (
  token text,
  channel text,
  recipient text,
  label text,
  created_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  explored_at timestamptz,
  creator_at timestamptz,
  send_error text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.token, i.channel, i.recipient, i.label, i.created_at,
         i.sent_at, i.opened_at, i.explored_at, i.creator_at, i.send_error
    from public.invites i
   where public.is_platform_admin()
   order by i.created_at desc
   limit 500;
$$;

revoke all on function public.invite_roll() from public;
grant execute on function public.invite_roll() to authenticated;
