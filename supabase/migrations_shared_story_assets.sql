-- ===================================================================
-- A SHARED STORY'S VOICE IS PART OF THE SHARED STORY
--
-- Run this after migrations_ether_shared.sql. It is idempotent.
--
-- THE GAP THIS CLOSES.
--
-- Sprint VP-Ether made a shared Story public by widening ONE policy:
-- creator_projects' SELECT gained `or is_shared`, so anybody can read
-- the record of a Story its maker chose to share.
--
-- Nothing widened Storage, and until now nothing had to. A Story's
-- PICTURES live inside that record as data: URIs, so they travelled
-- with it — every page of a shared Story has always been visible to
-- everybody. Its VOICE does not: narration is the one part of a Story
-- kept outside the record, as a `vihu-asset:` reference pointing at an
-- object in the draft-assets bucket (js/assetStore.js).
--
-- So a shared Story could be read but never heard by anyone except the
-- device that recorded it — which reads, from the outside, as "the
-- story has voice but the Ether doesn't play it". Reported exactly
-- that way, and the browser said so precisely once it was allowed to
-- try: POST .../storage/v1/object/sign/... → 400, which is what
-- Storage returns for an object it will not show you.
--
-- WHAT THIS GRANTS, AND WHAT IT DOES NOT.
--
-- Read access to an object in `creator/{owner}/{projectId}/{assetId}`
-- when a creator_projects row with THAT project id, owned by THAT
-- owner, has is_shared = true. Both halves matter: the project must be
-- the one the asset belongs to, and it must belong to the owner whose
-- folder the asset sits in — so an asset can never be reached by
-- naming somebody else's shared project alongside a private owner's
-- folder.
--
-- is_shared is a generated column (`(data->>'publishedAt') is not
-- null`), which is what makes this safe to hang a policy on: a client
-- cannot set it independently of actually sharing the Story.
--
-- Nothing about WRITING changes. Insert, update and delete stay
-- owner-only, exactly as they were. A shared Story's assets become
-- readable; they never become editable.
--
-- Unshared work is untouched: a draft's assets remain visible to their
-- owner and to a Magic Card recall grant, and to nobody else.
-- ===================================================================

drop policy if exists draft_assets_owner_read on storage.objects;
create policy draft_assets_owner_read
  on storage.objects for select
  using (
    bucket_id = 'draft-assets'
    and (storage.foldername(name))[1] in ('builder', 'creator')
    and (
      -- The owner, always.
      (storage.foldername(name))[2] = auth.uid()::text

      -- A Magic Card recall: the same grant this policy already
      -- carried, unchanged — a Creator recalling their identity on a
      -- new device has to be able to see their own Story's pictures.
      or (
        (storage.foldername(name))[1] = 'creator'
        and public.has_magic_recall_grant((storage.foldername(name))[2])
      )

      -- NEW: an asset belonging to a Story its maker shared with
      -- VihuPlanet. The Ether is a shared space (Decision 15) and this
      -- is the part of a shared Story that was not in it.
      or (
        (storage.foldername(name))[1] = 'creator'
        and exists (
          select 1
          from public.creator_projects cp
          where cp.id = (storage.foldername(name))[3]
            and cp.owner_id::text = (storage.foldername(name))[2]
            and cp.is_shared
        )
      )
    )
  );

-- The subquery above looks up creator_projects by id and owner on
-- every signed-URL call for a creator asset. `id` is the primary key,
-- so this is an index lookup rather than a scan — but the owner check
-- rides along with it, and the same pairing is what the shared feed
-- already filters on.
create index if not exists creator_projects_owner_shared_idx
  on public.creator_projects (owner_id)
  where is_shared;

-- ===================================================================
-- VERIFY — expect one row, with `qual` mentioning is_shared.
-- ===================================================================
select policyname,
       (qual like '%is_shared%') as grants_shared_stories
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'draft_assets_owner_read';
