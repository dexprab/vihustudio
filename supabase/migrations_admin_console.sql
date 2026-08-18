-- ---------------------------------------------------------------
-- THE ADMIN CONSOLE — who may see the Creators roll, and how.
--
-- Asked for by the product owner: "i would want a webpage as i am the
-- administrator."
--
-- ---------------------------------------------------------------
-- THIS DOES NOT ADD ACCOUNTS TO THE CHILD PRODUCT.
--
-- CLAUDE.md -> Decisions 11 and 14 forbid accounts, logins and
-- passwords for CHILDREN, and nothing here touches that: no child ever
-- sees a login, the Magic Card remains the only identity inside
-- VihuPlanet, and the Ether still identifies nobody. What this adds is
-- an administrator — one adult, signing in to a separate page, to see
-- data that is already theirs.
--
-- It has to be real authentication rather than an unlisted address.
-- The page lives on a public domain, and the roll lists children's
-- names beside their parents' email addresses; an unguessable URL is
-- not access control, because anything the browser can fetch, anyone
-- who learns the URL can fetch. Decision 14's "never revealed to the
-- browser" is what makes this the line that has to hold.
--
-- HOW IT HOLDS. The admin allowlist is a table, the roll is a
-- SECURITY DEFINER function that checks it, and the table's own RLS
-- lets nobody read it from the client at all. So a signed-in stranger
-- calling the function gets an empty result rather than a hint, and
-- the anon key — which is public by design and sits in the page —
-- grants nothing on its own.
-- ---------------------------------------------------------------

create table if not exists public.platform_admins (
  email      text primary key,
  added_at   timestamptz not null default now(),
  note       text
);

alter table public.platform_admins enable row level security;
-- No policies, deliberately: nothing reads this from a client. Only the
-- SECURITY DEFINER function below consults it, which bypasses RLS by
-- design. Same discipline story_cheers already uses (Decision 20 — "RLS
-- on and no policies at all").

insert into public.platform_admins (email, note)
values ('prabhakarsharma83@gmail.com', 'product owner')
on conflict (email) do nothing;

-- ---------------------------------------------------------------
-- IS THE CALLER AN ADMINISTRATOR?
--
-- Reads the email out of the caller's own verified JWT — not a
-- parameter, so it cannot be claimed. An anonymous session (which every
-- child has) carries no email and therefore never matches.
-- ---------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------
-- THE ROLL ITSELF.
--
-- Exactly the columns the product owner asked for: "their name, date
-- they became creator, number of stories, companion, parent email id."
-- Returns nothing at all to a caller who is not an administrator —
-- an empty set rather than an error, so the function reveals nothing
-- about itself to somebody probing it.
--
-- Story counts are per browser SESSION (owner_id), not per card,
-- because that is how stories are actually keyed. Where one session
-- holds several cards — siblings sharing a machine — the count belongs
-- to the device rather than to one child, and `cards_on_device` says
-- so instead of the number quietly lying.
-- ---------------------------------------------------------------
create or replace function public.admin_creators_roll()
returns table (
  creator          text,
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

-- ---------------------------------------------------------------
-- LUMO WRITES WHEN A CREATOR IS BORN.
--
-- "as soon as a new creator is born i would like to get email from
-- lumo at prabhakarsharma83@gmail.com."
--
-- A trigger on the one event that means it: a row arriving in
-- magic_card_identities IS a child becoming a Creator (CLAUDE.md ->
-- Decision 11: "A Creator is someone holding a claimed Magic Card").
--
-- Fired through pg_net so the insert never waits on an email and can
-- never fail because of one — a child's Ceremony must not depend on a
-- mail server. Everything about delivery lives in the Edge Function
-- (supabase/functions/creator-born), which already has the sending
-- path sky-protection uses.
-- ---------------------------------------------------------------
-- ---------------------------------------------------------------
-- WHERE THE TRIGGER'S SETTINGS LIVE.
--
-- The first draft used `alter database postgres set app.creator_born_url
-- = ...`, which fails on hosted Supabase with "permission denied to set
-- parameter" — the dashboard role cannot set database-level parameters
-- on a managed instance. That is a fact about hosted Postgres, not
-- something to work around with more privilege.
--
-- A private table instead. RLS on with NO policies at all, exactly like
-- platform_admins above and story_cheers before it (Decision 20), so no
-- client can read it whatever key they hold — the service role key lives
-- here and must never be reachable from a browser. Only the SECURITY
-- DEFINER trigger below consults it, which bypasses RLS by design.
-- ---------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

create table if not exists public.platform_settings (
  key   text primary key,
  value text not null
);

alter table public.platform_settings enable row level security;

create or replace function public.notify_creator_born()
returns trigger
language plpgsql
security definer
-- net AND extensions are both on the path deliberately. pg_net's
-- functions are named http_post/http_get, and WHICH schema they land in
-- differs between Supabase projects — older ones get `net`, newer ones
-- `extensions`. Hardcoding either is a guess that fails on half of them,
-- so the name is resolved rather than qualified.
set search_path = public, extensions, net
as $$
declare
  fn_url text;
  fn_key text;
begin
  select value into fn_url from public.platform_settings where key = 'creator_born_url';
  select value into fn_key from public.platform_settings where key = 'creator_born_key';

  -- Unconfigured is a no-op, never an error: the Ceremony completing
  -- matters, the notification does not.
  if coalesce(fn_url, '') = '' then
    return new;
  end if;

  perform http_post(
    url     := fn_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || coalesce(fn_key, '')),
    body    := jsonb_build_object(
                 'nickname',  new.nickname,
                 'code',      new.code,
                 'companion', coalesce(nullif(new.companion_name, ''), new.companion_id),
                 'species',   new.companion_species,
                 'claimedAt', new.claimed_at)
  );
  return new;
exception when others then
  -- Never let a notification break a Creator Ceremony.
  return new;
end;
$$;

drop trigger if exists creator_born on public.magic_card_identities;
create trigger creator_born
  after insert on public.magic_card_identities
  for each row execute function public.notify_creator_born();

-- ---------------------------------------------------------------
-- CONFIGURE (run once, with your own service role key):
--
--   insert into public.platform_settings (key, value) values
--     ('creator_born_url',
--      'https://<project-ref>.supabase.co/functions/v1/creator-born'),
--     ('creator_born_key', '<service role key>')
--   on conflict (key) do update set value = excluded.value;
--
-- No reconnect needed — a table is read on every call, unlike a
-- database parameter.
--
-- WHICH SCHEMA IS pg_net IN? Ask, rather than assume:
--
--   select n.nspname as schema, p.proname as fn
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname = 'http_post';
--
-- TEST IT, using the same path the trigger uses. Replace `net.` with
-- whatever that query returned:
--
--   select net.http_post(
--     url     := (select value from public.platform_settings where key='creator_born_url'),
--     headers := jsonb_build_object('Content-Type','application/json',
--                  'Authorization','Bearer ' ||
--                  (select value from public.platform_settings where key='creator_born_key')),
--     body    := jsonb_build_object('nickname','Test','code','MC-00099',
--                                   'companion','Leafy','species','Bloomling'));
--
-- Then, if no email arrives:
--   select status_code, content from net._http_response order by created desc limit 3;
-- ---------------------------------------------------------------
