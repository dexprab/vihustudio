-- ---------------------------------------------------------------
-- HOW MUCH IS TOO MUCH
-- ---------------------------------------------------------------
-- CLAUDE.md -> Decision 30: "Rate limiting exists before the endpoint
-- that needs it, in Postgres, with one configuration point. No Redis,
-- no external service, no second database."
--
-- Every cost-bearing Edge Function calls edge_rate_limit_hit() once,
-- with the caller id it derived from the VERIFIED session — never one
-- the client sent, or a caller could reset their own count by inventing
-- a new subject. The limits themselves live in
-- supabase/functions/_shared/edgeAuth.js -> LIMITS, which is the one
-- configuration point; this file only counts.
--
-- A FIXED WINDOW, not a sliding one. A fixed window is one row and one
-- atomic upsert; a sliding window needs a timestamp log per caller,
-- which is a bigger thing to store and reason about than this product
-- needs. The standard cost is stated rather than hidden: a caller can
-- spend the whole allowance at the very end of one window and the whole
-- allowance again at the start of the next. The limits in edgeAuth.js
-- are conservative enough that a doubled burst is still harmless.
--
-- ATOMIC BY CONSTRUCTION. The insert-on-conflict-returning below is one
-- statement, so two simultaneous requests cannot both read "none so far"
-- and both be allowed. There is no read-then-write race here because
-- there is no read.
--
-- A DENIED CALL STILL COUNTS. Deliberate: a client hammering a limit
-- stays held off for the rest of the window instead of being handed a
-- fresh allowance the moment it stops. It also makes the function a
-- single statement rather than a conditional one.
--
-- WHO CAN READ THIS. Nobody. RLS on with no policies at all, everything
-- through one SECURITY DEFINER function — the same discipline
-- story_cheers already holds (supabase/migrations_cheer.sql), and for
-- the same reason: a table of "which session called what, how often" is
-- a behavioural log, and the only thing that ever needs to see it is the
-- counter itself. It is not a social graph withheld; there is no way to
-- ask for one.
--
-- WHAT IT STORES, AND WHAT IT MUST NEVER STORE. A bucket name, an opaque
-- auth.uid(), a window start and a count. Never a card, never an email,
-- never a story, never a prompt, never a request body. This table can
-- answer "how many" and nothing else.
--
-- It is idempotent. A human runs it once via the Supabase SQL Editor
-- (or `supabase db push`), exactly as supabase/schema.sql says of
-- itself — this environment cannot reach Supabase.
--
-- Source of truth for the shape this mirrors: supabase/schema.sql.
-- ---------------------------------------------------------------

begin;

create table if not exists public.edge_rate_limits (
  bucket       text        not null,
  -- The VERIFIED caller. auth.uid() as an Edge Function resolved it
  -- from the session, or the literal 'service' for a server-to-server
  -- caller. Opaque either way — this table never learns whose it is.
  subject      text        not null,
  -- The start of the fixed window, floored to the window size. Part of
  -- the key rather than a column that gets rewritten, so an old window
  -- is simply a row that stops being written to.
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (bucket, subject, window_start)
);

-- For the sweep at the foot of the function, and for any later
-- scheduled cleanup.
create index if not exists edge_rate_limits_window_idx
  on public.edge_rate_limits (window_start);

alter table public.edge_rate_limits enable row level security;

-- No policies. Not an oversight — see the header. RLS enabled with zero
-- policies means the ONLY reader and writer is the SECURITY DEFINER
-- function below, which executes as the function owner and bypasses RLS
-- by Postgres's own semantics.

-- ---------------------------------------------------------------
-- Function: edge_rate_limit_hit
-- ---------------------------------------------------------------
-- Counts one call and says whether it may proceed.
--
--   p_bucket          which allowance ('voice-speak', 'companion-chat')
--   p_subject         the verified caller id
--   p_limit           calls permitted per window
--   p_window_seconds  the window length
--
-- Returns jsonb:
--   { allowed, remaining, retry_after, limit }
--
-- `retry_after` is seconds until the current window ends — the only
-- number a refused caller needs, and it reveals nothing about anybody
-- else's usage.
--
-- The limits are PARAMETERS rather than values stored here, because
-- edgeAuth.js is the one configuration point and a second copy in the
-- database would be a second thing to keep in step. This function
-- enforces whatever it is told; it does not decide policy.
create or replace function public.edge_rate_limit_hit(
  p_bucket         text,
  p_subject        text,
  p_limit          integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window  timestamptz;
  v_hits    integer;
  v_limit   integer := greatest(coalesce(p_limit, 0), 0);
  v_seconds integer := greatest(coalesce(p_window_seconds, 0), 1);
begin
  if p_bucket is null or p_bucket = '' or p_subject is null or p_subject = '' then
    -- Nothing identifiable to count against. Refused rather than
    -- allowed: an unattributable call is exactly what this exists to
    -- stop, and every real caller has a verified subject.
    return jsonb_build_object('allowed', false, 'remaining', 0,
                              'retry_after', v_seconds, 'limit', v_limit);
  end if;

  -- A limit of zero means "closed", not "unlimited". Reading it the
  -- other way would turn a typo into an open door.
  if v_limit = 0 then
    return jsonb_build_object('allowed', false, 'remaining', 0,
                              'retry_after', v_seconds, 'limit', 0);
  end if;

  -- Floor now() to the window. to_timestamp(floor(epoch/N)*N) rather
  -- than date_trunc, because the window is an arbitrary number of
  -- seconds and date_trunc only knows calendar units.
  v_window := to_timestamp(floor(extract(epoch from now()) / v_seconds) * v_seconds);

  insert into public.edge_rate_limits as e (bucket, subject, window_start, hits)
  values (p_bucket, p_subject, v_window, 1)
  on conflict (bucket, subject, window_start)
    do update set hits = e.hits + 1
  returning e.hits into v_hits;

  -- This caller's own expired windows, and only this caller's. Bounded
  -- by how many windows one subject has used, so it stays cheap and
  -- never turns a rate-limit check into a table scan. Global cleanup of
  -- subjects that never return is a scheduled job's business, not this
  -- function's — see the note under VERIFY below.
  delete from public.edge_rate_limits
   where bucket = p_bucket
     and subject = p_subject
     and window_start < v_window;

  return jsonb_build_object(
    'allowed',     v_hits <= v_limit,
    'remaining',   greatest(v_limit - v_hits, 0),
    'retry_after', greatest(
                     ceil(extract(epoch from (v_window + make_interval(secs => v_seconds)) - now()))::integer,
                     0),
    'limit',       v_limit
  );
end;
$$;

-- Callable by an Edge Function holding the service role. Deliberately
-- NOT granted to anon or authenticated: a browser has no reason to
-- count itself, and one that could would be able to burn its own
-- allowance or probe somebody else's.
revoke all on function public.edge_rate_limit_hit(text, text, integer, integer) from public;
grant execute on function public.edge_rate_limit_hit(text, text, integer, integer) to service_role;

commit;

-- ---------------------------------------------------------------
-- VERIFY — run these after committing.
-- ---------------------------------------------------------------

-- Expect rowsecurity = true and zero policies.
select relname, relrowsecurity from pg_class
 where oid = 'public.edge_rate_limits'::regclass;
select count(*) as policy_count from pg_policies
 where schemaname = 'public' and tablename = 'edge_rate_limits';

-- Expect allowed=true twice, then allowed=false, with remaining
-- counting down and retry_after inside the window.
select public.edge_rate_limit_hit('verify', 'subject-a', 2, 60);
select public.edge_rate_limit_hit('verify', 'subject-a', 2, 60);
select public.edge_rate_limit_hit('verify', 'subject-a', 2, 60);

-- Expect allowed=true — a different subject has its own allowance.
select public.edge_rate_limit_hit('verify', 'subject-b', 2, 60);

delete from public.edge_rate_limits where bucket = 'verify';

-- OPTIONAL HOUSEKEEPING. Rows for subjects that never come back are
-- left behind by the per-subject sweep above. They are tiny and
-- harmless, but if pg_cron is available on this project:
--
--   select cron.schedule('edge-rate-limit-sweep', '17 4 * * *',
--     $$delete from public.edge_rate_limits
--        where window_start < now() - interval '2 days'$$);
