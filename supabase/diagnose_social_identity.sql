-- ---------------------------------------------------------------
-- WHY IS A NAME NOT SHOWING? — one paste, one answer set.
-- ---------------------------------------------------------------
-- Read-only. Run it whole in the SQL editor after the migration.
-- It answers, per account and per shared story, exactly which link
-- in the chain is missing:
--
--   IDENTITY rows: was this account named by the backfill, and if
--   not, which rule skipped it (invalid nickname · reserved ·
--   collision)?
--
--   SHARED STORY rows: does the row carry creatorUsername, and if
--   not, which evidence was missing (no cardId and no owner+name
--   match · maker has no username · ambiguous same-named cards)?
--
-- The browser only ever shows what these rows hold, so if a story
-- reads "stamped" here and still shows nothing on screen, the
-- problem is the device (build < 0720, or a stale cache) — and if
-- it reads unstamped here, the problem is the data and the reason
-- column says which.
-- ---------------------------------------------------------------

select 'IDENTITY' as what,
       i.id,
       i.nickname,
       coalesce(i.username, '∅ (no name)') as username,
       case
         when i.username is not null then 'named'
         when regexp_replace(lower(coalesce(i.nickname,'')), '[^a-z0-9_]', '', 'g')
              !~ '^[a-z0-9_]{3,20}$'
           or regexp_replace(lower(coalesce(i.nickname,'')), '[^a-z0-9_]', '', 'g')
              !~ '[a-z]'
           then 'skipped: nickname cannot be a name'
         when regexp_replace(lower(coalesce(i.nickname,'')), '[^a-z0-9_]', '', 'g')
              = any (public._creator_username_reserved())
           then 'skipped: reserved'
         when exists (select 1 from public.magic_card_identities x
                       where x.username = regexp_replace(lower(coalesce(i.nickname,'')), '[^a-z0-9_]', '', 'g')
                         and x.id <> i.id)
           then 'skipped: that name is taken'
         else 'unnamed — re-run the migration'
       end as reason
  from public.magic_card_identities i

union all

select 'SHARED STORY',
       p.id,
       coalesce(p.data->>'name', '?') || ' (by ' || coalesce(p.data->>'creatorName','?') || ')',
       coalesce(p.data->>'creatorUsername', '∅ (unstamped)'),
       case
         when p.data->>'creatorUsername' is not null then 'stamped'
         when p.data->>'cardId' is not null
              and not exists (select 1 from public.magic_card_identities i
                               where i.id = p.data->>'cardId')
           then 'cardId matches NO identity'
         when p.data->>'cardId' is not null
              and exists (select 1 from public.magic_card_identities i
                           where i.id = p.data->>'cardId' and i.username is null)
           then 'maker has no username yet'
         when p.data->>'cardId' is null
              and not exists (select 1 from public.magic_card_identities i
                               where i.owner_id = p.owner_id
                                 and i.nickname = p.data->>'creatorName')
           then 'legacy: no identity on this session with this creatorName'
         when p.data->>'cardId' is null
              and (select count(*) from public.magic_card_identities i
                    where i.owner_id = p.owner_id
                      and i.nickname = p.data->>'creatorName') > 1
           then 'legacy: AMBIGUOUS — two same-named cards on one session'
         when p.data->>'cardId' is null
              and exists (select 1 from public.magic_card_identities i
                           where i.owner_id = p.owner_id
                             and i.nickname = p.data->>'creatorName'
                             and i.username is null)
           then 'legacy: matched maker has no username'
         else 'unstamped — re-run the migration'
       end
  from public.creator_projects p
 where p.data->>'publishedAt' is not null

order by 1, 2;
