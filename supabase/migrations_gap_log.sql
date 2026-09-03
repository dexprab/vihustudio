-- ---------------------------------------------------------------
-- SPRINT R6 — THE CONVERSATION GAP LOG.
--
-- Product-learning instrumentation, NOT Companion memory: every time
-- a Companion cannot adequately answer — "I don't know", missing
-- knowledge, missing context, a technical failure, a boundary — the
-- interaction is recorded so recurring gaps can be reviewed and the
-- knowledge, context or instructions improved. Nothing here is ever
-- read back by a Companion, converted into a memory, or shown to a
-- child.
--
-- THE story_cheers DISCIPLINE (Decision 20): RLS on with NO policies
-- at all, so no client can read the table whatever key it holds.
-- Exactly two doors — gap_log_insert (any verified session may report
-- its own gap, rate-capped) and gap_log_review (administrators only,
-- via the existing is_platform_admin()).
--
-- PRIVACY: a row holds the question, the reply, a few surrounding
-- turns, the surface and screen, and the classification. It holds NO
-- card id, NO nickname, NO username and NO email — owner_id is the
-- anonymous session, kept only so the rate cap has something to count
-- and so a deletion request can find its rows. Text is capped at the
-- door, not trusted from the client.
--
-- Depends on: migrations_admin_console.sql (is_platform_admin).
-- Re-runnable.
-- ---------------------------------------------------------------

set client_min_messages = warning;

create table if not exists public.conversation_gaps (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null,
  at             timestamptz not null default now(),
  surface        text,
  screen         text,
  companion      text,
  said           text,
  reply          text,
  context        jsonb,
  classification text not null default 'other',
  resolution     text not null default 'open'
);

alter table public.conversation_gaps enable row level security;

create index if not exists conversation_gaps_at_idx
  on public.conversation_gaps (at desc);
create index if not exists conversation_gaps_owner_hour_idx
  on public.conversation_gaps (owner_id, at desc);

-- ---------------------------------------------------------------
-- INSERT — any verified session may report a gap of its own.
-- The caller is derived from the session, never from the payload
-- (Sprint 1A's rule); every text field is capped here rather than
-- trusted; the classification must be one of the named categories or
-- it is stored as 'other'. Rate-capped per session per hour so the
-- log can never become anybody's free storage.
-- ---------------------------------------------------------------
create or replace function public.gap_log_insert(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_recent int;
  v_class text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select count(*) into v_recent from public.conversation_gaps
   where owner_id = v_uid and at > now() - interval '1 hour';
  if v_recent >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'rate');
  end if;

  v_class := coalesce(p->>'classification', 'other');
  if v_class not in ('vihuplanet_knowledge_missing', 'studio_knowledge_missing',
                     'live_context_missing', 'story_context_missing',
                     'ambiguity_or_misunderstanding', 'model_capability',
                     'safety_restriction', 'technical_failure', 'other') then
    v_class := 'other';
  end if;

  insert into public.conversation_gaps
    (owner_id, surface, screen, companion, said, reply, context,
     classification, resolution)
  values
    (v_uid,
     left(coalesce(p->>'surface', ''), 40),
     left(coalesce(p->>'screen', ''), 60),
     left(coalesce(p->>'companion', ''), 40),
     left(coalesce(p->>'said', ''), 500),
     left(coalesce(p->>'reply', ''), 500),
     case when jsonb_typeof(p->'context') = 'array'
          then p->'context' else null end,
     v_class,
     case when coalesce(p->>'resolution', '') = 'by-design'
          then 'by-design' else 'open' end);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.gap_log_insert(jsonb) from public;
grant execute on function public.gap_log_insert(jsonb) to authenticated, anon;

-- ---------------------------------------------------------------
-- REVIEW — administrators only. Newest first; optionally filtered by
-- resolution status. This is where "review recurring gaps" happens.
-- ---------------------------------------------------------------
create or replace function public.gap_log_review(p_limit int default 200,
                                                 p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;
  select coalesce(jsonb_agg(row_to_json(g)::jsonb order by g.at desc), '[]'::jsonb)
    into v_rows
    from (
      select id, at, surface, screen, companion, said, reply, context,
             classification, resolution
        from public.conversation_gaps
       where (p_status is null or resolution = p_status)
       order by at desc
       limit greatest(1, least(coalesce(p_limit, 200), 500))
    ) g;
  return jsonb_build_object('ok', true, 'gaps', v_rows);
end;
$$;

revoke all on function public.gap_log_review(int, text) from public;
grant execute on function public.gap_log_review(int, text) to authenticated;

-- ---------------------------------------------------------------
-- RESOLVE — administrators only: mark a reviewed gap.
-- ---------------------------------------------------------------
create or replace function public.gap_log_resolve(p_id bigint, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'reason', 'not_yours');
  end if;
  if p_status not in ('open', 'reviewed', 'addressed', 'by-design', 'wont-fix') then
    return jsonb_build_object('ok', false, 'reason', 'bad_status');
  end if;
  update public.conversation_gaps set resolution = p_status where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.gap_log_resolve(bigint, text) from public;
grant execute on function public.gap_log_resolve(bigint, text) to authenticated;
