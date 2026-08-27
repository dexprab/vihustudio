-- ---------------------------------------------------------------
-- WHAT IS MISSING FROM THIS PROJECT? — one answer, read-only.
-- ---------------------------------------------------------------
-- Paste the whole file into the Supabase SQL Editor and press Run.
-- It writes NOTHING, changes NOTHING and is safe on a live project at
-- any time. Every row says APPLIED or MISSING and names the file to run.
--
-- Run the MISSING ones in the order they are listed: schema.sql first
-- if it is missing, because everything else builds on it.
-- ---------------------------------------------------------------
with checks(ord, thing, present, file) as (
  values
    (1,  'base schema · magic_card_identities',
         (to_regclass('public.magic_card_identities') is not null), 'supabase/schema.sql'),
    (2,  'base schema · creator_projects',
         (to_regclass('public.creator_projects') is not null), 'supabase/schema.sql'),
    (3,  'base schema · has_magic_recall_grant()',
         (to_regprocedure('public.has_magic_recall_grant(text)') is not null), 'supabase/schema.sql'),
    (4,  'creator_library',
         (to_regclass('public.creator_library') is not null), 'supabase/migrations_creator_library.sql'),
    (5,  'creator_handwriting',
         (to_regclass('public.creator_handwriting') is not null), 'supabase/migrations_handwriting.sql'),
    (6,  'story_cheers',
         (to_regclass('public.story_cheers') is not null), 'supabase/migrations_cheer.sql'),
    (7,  'creator_projects.is_shared (the Ether''s public boundary)',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='creator_projects'
                    and column_name='is_shared'), 'supabase/migrations_ether_shared.sql'),
    (8,  'magic_card_identities.companion_id (Companion on the card)',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='magic_card_identities'
                    and column_name='companion_id'), 'supabase/migrations_identity_hardening.sql'),
    (9,  'magic_card_identities.parent_email (Sky Protection)',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='magic_card_identities'
                    and column_name='parent_email'), 'supabase/migrations_family_album_link.sql'),
    -- TWO HALVES, AND THEY CAN DISAGREE. migrations_taught.sql only
    -- REPLACES recall_magic_card() so it returns v_identity.taught; no
    -- file in this repository creates the column itself. Measured on a
    -- real PostgreSQL 16: the function is created without complaint and
    -- then fails at RUNTIME with `record "v" has no field "taught"` —
    -- so the broken state looks healthy until a Creator tries to be
    -- recognised on a new device.
    (10, 'magic_card_identities.taught (column)',
         exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='magic_card_identities'
                    and column_name='taught'),
         'add the column: alter table public.magic_card_identities add column if not exists taught jsonb;'),
    (11, 'recall_magic_card() and the taught column AGREE',
         (to_regprocedure('public.recall_magic_card(jsonb,text)') is null)
         or (position('taught' in coalesce(
                pg_get_functiondef(to_regprocedure('public.recall_magic_card(jsonb,text)')::oid), '')) = 0)
         or exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='magic_card_identities'
                       and column_name='taught'),
         'BROKEN: the function returns taught but the column is absent — every recall throws. Add the column.'),
    (12, 'family_album_links',
         (to_regclass('public.family_album_links') is not null), 'supabase/migrations_family_album_link.sql'),
    (13, 'invites',
         (to_regclass('public.invites') is not null), 'supabase/migrations_invites.sql'),
    (14, 'platform_admins / platform_settings',
         (to_regclass('public.platform_admins') is not null), 'supabase/migrations_admin_console.sql'),
    (15, 'edge_rate_limits (Edge Function rate limiting)',
         (to_regclass('public.edge_rate_limits') is not null), 'supabase/migrations_edge_rate_limit.sql'),
    (16, 'creator_companion_memory (Companion Memory)',
         (to_regclass('public.creator_companion_memory') is not null), 'supabase/migrations_companion_memory.sql')
)
select
  lpad(ord::text, 2, '0')                        as step,
  thing,
  case when present then (case when ord = 11 then 'OK'     else 'APPLIED' end)
       else            (case when ord = 11 then 'BROKEN' else 'MISSING' end) end as state,
  case when present then '' else file end        as run_this
from checks
union all
select '', '── OVERALL ──',
       case when (select count(*) from checks where not present) = 0
            then 'nothing missing'
            else (select count(*) from checks where not present)::text || ' MISSING' end,
       ''
order by step;
