-- Verify migrations_creation_share.sql on a live project.
-- One word per check, an overall verdict on top, and everything
-- this writes is deleted before it answers — safe to run at any
-- time. (The migration itself returns nothing; this is the check.)
with
mint as (
  select public.creation_share_mint(
    'verify-owner', null, 'verify-project',
    jsonb_build_object('v',1,'type','moment','title','Verify','creatorName','',
                       'pages',jsonb_build_array(),'watch',jsonb_build_array(),
                       'madeIn','vihuplanet')
  ) as token
),
again as (
  -- The same creation minted twice must answer with the SAME token.
  select public.creation_share_mint(
    'verify-owner', null, 'verify-project',
    jsonb_build_object('v',1,'type','moment','title','Verify Two','creatorName','',
                       'pages',jsonb_build_array(),'watch',jsonb_build_array(),
                       'madeIn','vihuplanet')
  ) as token
),
resolved as (
  select public.creation_share_resolve((select token from mint)) as answer
),
unknown_tok as (
  select public.creation_share_resolve('no-such-token-ever') as answer
),
checks as (
  select
    (select token from mint) is not null                                   as minted,
    (select token from mint) = (select token from again)                   as stable,
    ((select answer from resolved) ->> 'ok')::boolean                      as resolves,
    (select answer from resolved) -> 'creation' ->> 'title' = 'Verify Two' as refreshed,
    ((select answer from resolved)::text not like '%verify-owner%')        as owner_hidden,
    ((select answer from resolved)::text not like '%verify-project%')      as project_hidden,
    (((select answer from unknown_tok) ->> 'ok')::boolean = false)         as unknown_refused
),
cleanup as (
  delete from public.creation_shares
   where owner_id = 'verify-owner' and project_id = 'verify-project'
  returning 1
)
select
  case when minted and stable and resolves and refreshed
        and owner_hidden and project_hidden and unknown_refused
       then 'CREATION SHARE: OK' else 'CREATION SHARE: BROKEN' end as verdict,
  case when minted         then 'ok' else 'BROKEN' end as mint,
  case when stable         then 'ok' else 'BROKEN' end as stable_token,
  case when resolves       then 'ok' else 'BROKEN' end as resolve,
  case when refreshed      then 'ok' else 'BROKEN' end as refresh_on_remint,
  case when owner_hidden   then 'ok' else 'BROKEN' end as owner_never_returned,
  case when project_hidden then 'ok' else 'BROKEN' end as project_never_returned,
  case when unknown_refused then 'ok' else 'BROKEN' end as unknown_token_refused,
  (select count(*) from cleanup) as rows_cleaned
from checks;
