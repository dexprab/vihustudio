# Draft Asset Architecture

**Sprint:** Platform Hardening — Draft Asset Architecture (Phases A–E,
completed across a single continued sprint arc; each phase shipped and
verified independently, see §9).
**Status:** Canonical. This document defines the durable, externalized
storage model every uploaded image in both authoring surfaces now uses;
maintain it going forward the same way `docs/THEME_REPOSITORY_ARCHITECTURE.md`
is maintained for the compiled-Theme repository layer.
**Scope:** This document does not restate `docs/THEME_CONTRACT.md` or
`docs/THEME_PROJECT_SPEC.md`/`docs/VTHEME_PACKAGE_SPEC.md` (the compiled
Theme's own field shape and packaging contract) — those remain
authoritative for what a *published, compiled* Theme looks like. This
document is authoritative for how a Theme/Story's own *editable, in-progress
draft content* stores its images before (and independent of) any Build or
Publish — the layer underneath both `js/projectManager.js` (Creator) and
`tools/world-builder-v2/js/projectStore.js` (World Builder) that neither of
those own data models previously had.

---

## 1. The architectural decision this document implements

A real, confirmed data-loss incident — *"why am not seeing my forest
adventure in builder as am seeing it in studio"* — traced to a genuine
architecture bug, not a one-off glitch: every uploaded image in **both**
authoring surfaces (`tools/world-builder-v2/` "World Builder" and root
`js/` "Creator"/Studio) was embedded as a base64 `data:` URI string
directly inside one JSON object, written wholesale to a single
`localStorage` key with a small, fixed browser quota (~5–10MB).
Build/Publish reads live in-memory state directly, completely bypassing
whatever the local save last successfully persisted — so a Theme/Story
could Publish successfully from memory at the exact moment its own local
save was silently failing on quota, permanently diverging the two with no
way to reconcile (a compiled Theme cannot be reverse-compiled back into
editable authoring data).

The fix, stated by the product owner as the binding constraint for every
phase of this work: **"at no moment under any circumstances there should
be any data loss or jittery sessions."** Concretely:

1. Raw image bytes are never embedded in the JSON blob that gets written
   to `localStorage`/the cloud `data jsonb` column again — a durable
   **reference string** replaces them.
2. A local cache tier (IndexedDB — a large, non-embedded quota, not the
   5–10MB `localStorage` ceiling that caused the bug) is *truth for fast
   reads* — every `put()`/`resolve()` call is IndexedDB-first, so nothing
   in the authoring experience ever waits on the network. This is what
   "never jittery" means concretely: a save, an upload, a page repaint —
   none of them block on Supabase.
3. Supabase Storage's new `draft-assets` bucket is *truth for durability*
   — a durably-queued, retry-forever background upload bridges the local
   cache to it, so a device loss/browser-cache-clear doesn't lose content
   that already reached Storage.
4. Migration is **lazy and format-detection-based, never a proactive
   sweep or a version flag** — every read path checks "is this
   `data:`-prefixed (legacy, resolve verbatim) or a durable reference
   (resolve through the new tiering)?", both permanently valid forever, so
   an untouched old Project keeps working exactly as it always did with
   zero risk of a background sweep corrupting something nobody asked to
   change.

What did **not** change: `js/themeRepositoryClient.js`'s `_ensureAuth()`
anonymous-session behavior; the Magic Card / Card Platform mechanics
beyond one additive cross-owner read policy (§6); the `theme-assets`
bucket or any compiled-Theme repository logic (`docs/THEME_REPOSITORY_ARCHITECTURE.md`
remains completely separate and unaffected — that document governs
*published* Theme storage, this one governs *draft* authoring storage);
`tools/world-builder/` (v1)'s upload pipeline, which received only a
3-call-site read-only mitigation (§7).

---

## 2. The reference format

```
vihu-asset:<surface>:<projectId>:<assetId>
```

e.g. `vihu-asset:builder:wp_lqk3f9x2:ast_9f2k1m4p`

| Segment | Meaning |
|---|---|
| `surface` | `builder` or `creator` — lets one shared bucket/module serve both authoring surfaces without ambiguity. |
| `projectId` | The existing stable id already used as the primary key in `builder_projects`/`creator_projects` (`wp_...`/`proj_...`) — never minted separately for this feature. |
| `assetId` | `'ast_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8)` — mirrors `ProjectStore`'s own `wp_.../proj_...` id convention. |

Deliberately **never embeds `owner_id`** — the Storage object path
(`{surface}/{owner_id}/{projectId}/{assetId}`, mirroring `theme-assets`'
own `{repository}/{owner_id-or-'_official'}/{theme_id}/{relativePath}`
convention exactly) is always derived from the ref plus whatever session
is live right now, so `put()` never has to resolve/await a session before
returning — that would reintroduce exactly the jitter this fix exists to
remove.

A legacy raw `data:` URI is a **permanently valid** input to every
function in `js/assetStore.js` — format-detection, not version-flagging.
Detection is one cheap check (`v.indexOf('vihu-asset:')===0`), parallel to
the pre-existing `v.indexOf('data:')===0` check the two compiled-package
producers already used — an additive branch, never a redesign.

---

## 3. Local cache tier — IndexedDB `vihu-asset-cache`

Shared across both surfaces (same origin, no collision risk — the
`wp_...`/`proj_...` id prefixes never collide).

**`blobs`** store, keyPath `assetId`: `{assetId, surface, projectId, blob,
mime, byteLength, createdAt}`. This is the tier that's "truth for fast
reads" — never deleted by this feature's own code except an explicit
future user-initiated "clear cache" action or the owning Project being
deleted entirely (out of scope for this phase, disclosed rather than
silently handled).

**`pendingUploads`** store, keyPath `assetId`: `{assetId, surface,
projectId, status:'pending'|'uploading'|'done'|'failed', attempts,
nextAttemptAt, lastError, createdAt}`. Written in the **same IndexedDB
transaction** as the `blobs` write, so a blob can never exist locally
with no matching pending-upload record, or vice versa.

**A real, disclosed residual-risk window, not glossed over**: between
"local IndexedDB write confirmed" and "Storage upload confirmed," the
asset briefly exists in exactly one place. If the browser evicts
IndexedDB under real storage pressure (a documented behavior for
"best-effort" storage in Chrome/Firefox) or the user clears site data
*during that window and before the upload ever succeeds*, the asset is
lost — an inherent tradeoff of moving off embedded-base64 at all (keeping
a redundant embedded copy locally until Storage confirms would recreate
the exact quota problem this feature exists to fix). Mitigated, not
eliminated, by calling `navigator.storage.persist()` once at module init
(a real, standard, low-friction API in most browsers with meaningful
engagement) plus retry-forever + immediate background upload + boot-time/
online-event retry triggers, keeping the window realistically small.

---

## 4. Supabase Storage: the `draft-assets` bucket + RLS

Distinct from `theme-assets` (scoped to compiled/Published output keyed
by `theme_id` — it has no concept of an editable, pre-compile draft
Project at all). Path convention: `{surface}/{owner_id}/{project_id}/{asset_id}`.

```sql
insert into storage.buckets (id, name, public)
values ('draft-assets', 'draft-assets', false)
on conflict (id) do nothing;
```

Owner-only read/write/update/delete, **plus one additive cross-owner
read exception** for a proven Magic Card recall (mirroring
`creator_projects_select`'s own `exists(...)` grant exactly — see
`supabase/schema.sql`):

```sql
drop policy if exists draft_assets_owner_read on storage.objects;
create policy draft_assets_owner_read
  on storage.objects for select
  using (
    bucket_id = 'draft-assets'
    and (storage.foldername(name))[1] in ('builder', 'creator')
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[1] = 'creator'
        and exists (
          select 1 from public.magic_card_recalls r
          join public.magic_card_identities i on i.id = r.identity_id
          where i.owner_id = (storage.foldername(name))[2]
            and r.recaller_id = auth.uid()::text
        )
      )
    )
  );
```

Write/update/delete stay owner-only, no cross-owner exception ever — a
recalled Creator project is always adopted as a brand-new local copy
with a fresh `project_id` (`js/magicCard.js`'s `adopt()`), never written
back to the original owner's row. World Builder gets no cross-owner read
exception either — `builder_projects` has none, and a recalled World
Builder Project doesn't exist as a concept at all.

No new Postgres table is needed for the assets themselves — like
`theme-assets`, Storage objects **are** the index; `builder_projects`/
`creator_projects`' own `data jsonb` column shrinks automatically once it
holds `vihu-asset:` references instead of embedded base64, no schema
change to either table. Per this project's own established, disclosed
convention: **this SQL is a disclosed script the project owner runs
themselves** (this sandboxed environment cannot reach a real Supabase
project — the same standing limitation every prior schema change in this
codebase's history has disclosed).

---

## 5. The `js/assetStore.js` public API

Loaded once by all three `index.html` files (root, `tools/world-builder-v2/`,
`tools/world-builder/`), mirroring how `js/themeRepositoryClient.js` is
already shared today — this module never opens its own Supabase client/
session, it calls `ThemeRepositoryClient.getClient()`/`.getSession()`,
the same discipline `js/creatorProjectSync.js`/`tools/world-builder-v2/js/services/projectSync.js`
already established.

| Function | Contract |
|---|---|
| `put(source, {surface, projectId})` → `Promise<string ref>` | `source` is a `Blob` or a `data:` URI string. Writes to IndexedDB (blob + pendingUploads, one transaction), kicks a background upload fire-and-forget, and resolves with the new `vihu-asset:` reference the instant the **local** write completes — never waits on the network. |
| `resolve(ref, opts)` → `Promise<string\|null src>` | A legacy `data:` URI (or anything non-ref, including `null`/`undefined`) resolves verbatim, same-tick. A `vihu-asset:` ref resolves: warm in-memory cache → local IndexedDB blob (an object URL) → a Storage signed URL. Never rejects; total failure resolves `null`. `opts.ownerId` (Phase E, see §6) is a **fallback** owner id, tried only after the current session's own owner id fails. |
| `resolveSync(ref)` → `string\|null` | Warm-cache-only, synchronous — the seam for per-frame canvas painters that resolve once into a host-side cache and redraw on arrival. |
| `hydrateForExport(ref)` → `Promise<string dataURL>` | The inverse of `put()` — resolves a ref back to a real, embedded `data:` URI. Used only by the genuinely-portable-file paths that must stay self-contained outside this app's own Supabase project (§8). |
| `retryPending(surface?, projectId?)` → `Promise<{uploaded,failed}>` | Drains the durable queue with per-record exponential backoff (5s, 20s, 60s, 5min, capped, retried indefinitely — never gives up). Called once on module load, once on the `online` event, and on a slow background interval while any pending record exists. |
| `getPendingCount(surface, projectId)` → `Promise<number>` | For a small, honest "N images still saving to the cloud" indicator (surfaced in a future UI phase, not yet). |
| `migrateFieldsOnSave(surface, projectId, accessors)` → `Promise<void>` | The lazy migration hook (§6.5). `accessors` is a plain array of `{get,set}` pairs the *caller* builds by walking its own known image-bearing fields — this module stays generic with no built-in knowledge of either surface's own data shape. |
| `downscaleImageDataURL(dataURL)` | Phase C addition — the shared canonical downscale/compression algorithm (1600px longest edge, JPEG q0.85 above a 1.5MB threshold, PNG stays PNG) both surfaces' upload paths now use identically. |

---

## 6. Phase-by-phase implementation

### 6.1 Phase A — Foundation

`js/assetStore.js` built in full (IndexedDB schema, the whole public API,
`navigator.storage.persist()` call). Loaded from all 3 `index.html`s.
The `draft-assets` bucket/RLS disclosed (§4). `tools/world-builder/` (v1)
got its **one** change in this entire feature: 3 read call sites
(`worldBuilderApp.js` — a plain project card, an inline preview, and the
Welcome-screen thumbnail) route through `AssetStore.resolve(...)` instead
of assigning a string directly as an `<img src>`, closing a real,
confirmed cross-version risk — v1 and v2 share the byte-identical
`localStorage` key `'vihu-world-builder-projects'`, so a v2-authored
Project (now potentially carrying a `vihu-asset:` reference) is directly
visible to and loadable by v1 if that browser ever opens v1's page. v1's
own upload pipeline, `_toBlob` equivalent, and persistence are completely
untouched — it never produces a `vihu-asset:` reference itself. Nothing
in the app called `put()`/`resolve()` beyond that mitigation — zero
behavior-change risk to any existing user.

### 6.2 Phase B — World Builder v2 rewiring

Every real upload call site (`_fileInputUpload`'s `onFile` callback,
covering Identity Thumbnail/Hero, Experience Image/Graphics, and every
Assets-screen slot) now calls `AssetStore.put()` via a shared
`_storeUploadedAsset` wrapper and hands the resulting reference to the
existing `setIdentityAsset`/`setAsset`/`updateExperienceProperty` setters
— zero setter-signature changes. ~14 read call sites resolve through a
new shared `_resolveAssetRefToSrc()`. `_materializeProjectFromPackage`'s
signed-URL repair (View/Clone) does too.

Two Build-time functions were taught the new format, mirroring the same
"resolve the opaque reference before it reaches a byte-encoding
fallback" pattern:

- `tools/world-builder-v2/js/projectCompiler.js`'s `_toBlob(path,value)`
  gained a `vihu-asset:` branch (checked *before* the existing `data:`
  branch) that resolves the reference via `AssetStore.resolve()` then
  `fetch()`s the real bytes.
- `tools/world-builder-v2/js/services/builder.js`'s `externalizeSceneImage`
  — a genuine, previously-undiscovered silent-data-loss gap, found and
  fixed at its own root — only ever checked `indexOf('data:')===0` before
  deciding whether a Scene Layer's image belonged in the compiled
  `assets` map; a `vihu-asset:` string never matched that check, so it
  would have compiled a real `relPath` reference into the Layer Pack with
  **no backing bytes** at that path. Made `async` and taught the same
  resolution step.

`_syncUniversalContent` (the Experience→Scene-Layer image mirror) needed
zero changes — confirmed via direct code read to already be a pure
`image: src || null` string copy, so it naturally carries the new,
smaller reference string forward without ever re-`put()`-ing the same
bytes twice. `_rasterizeGlyphToDataURL` (the Decorations quick-picker's
~160×160 single-glyph PNG rasterizer) is a disclosed, deliberate
exception — a few KB at most, nowhere near the scale that ever
threatened `localStorage`'s quota.

### 6.3 Phase C — Creator/Studio rewiring

Every real Creator producer (`js/pictureStudio.js`'s File/data URL
lifecycle, `js/app.js`'s two insert paths — the single-file-via-
Picture-Studio path and the bulk multi-file import — `js/contextPanel.js`'s
Place-artwork Replace/Crop-Rotate flow and its Scene-Object image-override
control, `js/pageDesigner.js`'s separate Cover/Hook/End Image Manager
path) now routes through the identical `_storeUploadedAsset(dataURL,onFile)`
shape World Builder v2 already established — duplicated per module (this
codebase's own established "kept in lockstep by hand" precedent for
small per-module adapters), not shared across files.

`ProjectManager.deserialize()`'s image rehydration resolves `vihu-asset:`
refs via a new `_resolveMaybeRef()` before ever handing a value to the
pre-existing `loadImageFromDataURL`. `ProjectManager.ensureProjectId()`
was newly exported so an upload can mint/reuse a stable project id even
on a brand-new project's very first picture, before any save has ever
run. `saveProjectAs()`'s export path hydrates every asset-bearing field
back to a real embedded `data:` URI via a new `_hydratePayloadForExport`
— a portable `.vihu` file must stay self-contained outside this app's
own Supabase project (§8); the ordinary local/cloud save path needed no
change at all, since it already just writes whatever small reference
string a field holds.

Two more read-side gaps, found via the same "opaque reference reaching a
code path that only ever expected a directly-usable string" pattern, were
fixed at their own root: `renderer/slideRenderer.js`'s
`_ensureDecorationImage`/`_layerDrawDecorationImage` (a Story-Author-
replaced World-owned object's own image override, drawn to the live
canvas) and `js/objectStrip.js`'s `_renderThumb` (that same object's own
Object Strip thumbnail). `js/pictureStudio.js`'s `open()` string branch
(Crop/Rotate re-editing an existing Place/Scene-Object picture) got the
matching fix.

### 6.4 Phase D — Migration activation

Wires the already-built `AssetStore.migrateFieldsOnSave` into each
surface's own **existing** debounced save path — the only place
migration is ever triggered, per §1's "lazy, format-detection-based,
never a proactive sweep" principle.

- **World Builder v2** (`tools/world-builder-v2/js/worldBuilderApp.js`):
  a new `_collectMigrationAccessors(project)` walks every known
  image-bearing field (top-level `project.files[path]` non-`.json`/`.md`
  entries — Identity Thumbnail/Hero, Assets-screen slots; every Scene
  Layer's own `.image` field; every Experience's `properties.imageSrc`/
  `.graphicSrc`) and returns `{get,set}` accessor pairs; a new,
  1500ms-debounced `_scheduleAssetMigration()` is called from `_persist()`'s
  own success branch, mirroring `_scheduleCloudSync`'s established shape
  exactly.
- **Creator** (`js/projectManager.js`): the analogous `_collectMigrationAccessors()`/
  `_scheduleAssetMigration()` pair, called from `_writeStorage()`'s
  success branch, walks `slide._imageDataURL`, every extra Place's own
  `placeContent[id].dataURL`, and every World-owned Scene Object
  override's own `elementOverrides[id].image`. **`slide.thumbnail` is
  deliberately NOT migrated** — a disclosed scope decision, not an
  oversight: several of its own read sites (page-strip/thumbnail-grid
  renders, My-Projects/Magic-Card-Home cards) were never rewired in
  Phase C to resolve a reference, and a thumbnail is small, derived,
  regenerable data (`ThumbnailEngine`) nowhere near the scale that
  caused the original quota bug.

A real, deliberate subtlety in both accessor walks: a decoration Scene
Layer *mirrored* from an Experience (`sourceExperienceId`/`contentSlot`
set, Builder V3.1's Universal Experience Authoring) is excluded from its
own accessor entirely — migrating it independently would call `put()` a
second time for byte-identical content ("one upload becomes two," the
exact duplicate the original architecture plan warned against). Instead
the source Experience's own accessor propagates its freshly-migrated
reference directly onto the already-known mirrored Layer object, with
zero second `put()` call.

A genuine, narrow **race condition** was found and closed at its real
root, in the shared `js/assetStore.js` module itself (so both surfaces
benefit): `migrateFieldsOnSave`'s own `put()`-then-`set()` step now does a
**compare-and-swap** — it only rewrites a field if it still holds the
exact bytes just migrated at the moment `put()` resolves. A field
genuinely replaced by a fresh, unrelated upload (Replace Artwork, a new
Experience image) while the migration's own IndexedDB write was still in
flight is left completely untouched rather than silently reverted to a
stale migrated reference.

A real, pre-existing Phase C read-side gap was also found and fixed in
this pass, unrelated to migration itself: `js/pageDesigner.js`'s Cover/
Hook/End Image Manager panel's own preview `<img>` assigned
`s._imageDataURL` directly with no resolve step — fixed by reusing
`s.image.src` (the already-loaded, already-resolved Image object the
same branch's own condition already confirms exists) rather than adding
a second async resolve path.

### 6.5 Phase E — Verification, cross-owner resolution, and this document

Full end-to-end regression across both surfaces (author → save → reload
→ Build → Publish/Studio-render), a genuinely forced network-failure
recovery test, and — the one **real, previously-undiscovered gap** found
while verifying the Magic Card recall scenario specifically — closed at
its root:

**The gap**: `AssetStore.resolve()` always computed the Storage object
path from the *current session's own* owner id, with no way to resolve
an asset that belongs to a **different** owner. This is exactly the
Magic Card recall case: `js/magicCard.js`'s `_pullRecalledProjects`
adopts another device's Creator project as a brand-new local copy, but
any `vihu-asset:` reference it still carries was authored under the
*original* device's own anonymous session, never this one. Every field
resolution on a recalled project's own pre-recall pictures would have
silently failed.

**The fix**: `resolve(ref, opts)` gained an optional `opts.ownerId` — a
**fallback**, tried only as a second attempt after the current session's
own owner id fails, never tried first. This needs no per-reference
bookkeeping (which project/asset ids are "mine" vs. "recalled") —
Storage's own `createSignedUrl` already fails cleanly for a path that
doesn't exist under the tried owner, which is exactly the signal this
fallback needs; a brand-new upload made on the recalling device *after*
the recall (which genuinely does belong to the current session) still
resolves via the fast, correct, current-session-first path and never
even reaches the fallback.

Threaded end to end:

- `js/magicCard.js`'s `_pullRecalledProjects(ownerId)` stamps
  `data.project.recallOwnerId = ownerId` onto the materialized payload
  at adoption time, alongside the existing `data.project.id = newId`
  reassignment.
- `js/projectManager.js`'s `serialize()`/`deserialize()` carry
  `recallOwnerId` on `AppState.project` (round-tripping across a later
  local save/reload) and stamp it onto every constructed `slide` object
  too — `renderer/slideRenderer.js` deliberately takes no dependency on
  `AppState` directly (it operates purely on the slide object passed
  in), so the per-slide field is what lets `_ensureDecorationImage`
  read it off `s.recallOwnerId` for a World-owned Scene Object's own
  image override.
- `_resolveMaybeRef(value, fallbackOwnerId)` (Creator) and the direct
  `AssetStore.resolve(v.src, {ownerId})` calls in `js/objectStrip.js`'s
  `_renderThumb` and `js/pictureStudio.js`'s `open()` (via a new
  `options.fallbackOwnerId`, threaded in by `js/contextPanel.js`'s
  `_cropRotateArtwork`) all pass the recalled project's own
  `recallOwnerId` through unconditionally — safe by construction, since
  it's only ever consulted as a fallback.

A disclosed, permanent characteristic of this design, not a half-fix: a
recalled project's pre-recall pictures stay hosted under the *original*
device's own Storage path forever (migration only ever touches raw
`data:`-prefixed fields, never an already-migrated `vihu-asset:`
reference — §6.4) — durably readable via the cross-owner RLS grant for
as long as the underlying `magic_card_recalls` row exists (which is
never revoked, matching `creator_projects_select`'s own precedent), but
never "taken over" by the recalling device unless a Story Author
replaces that specific picture with a new upload of their own.

---

## 7. `tools/world-builder/` (v1) — deliberately out of scope beyond §6.1

v1 has no Supabase cloud-backup path at all (no `builder_projects`-style
sync exists under `tools/world-builder/js`) — its Projects are already
100% local-only, with no cloud-divergence risk this feature needed to
fix. It gets no upload-path rewiring, no IndexedDB wiring, no
reference-format-writing — matching this codebase's own established
precedent of v2 as the actively-developed surface. Its only change is
the 3-call-site read mitigation described in §6.1.

---

## 8. Portable-file export/import

A portable file (`ProjectManager.saveProjectAs`'s downloadable JSON,
World Builder's `.vtheme` Export) can't carry `vihu-asset:` references
meaningfully outside this app's own Supabase project — the reference is
only ever resolvable given a live session against a specific Supabase
project.

- **Creator's `saveProjectAs()`**: hydrates every asset-bearing field
  back to a real, embedded `data:` URI via `AssetStore.hydrateForExport()`
  before building the downloadable JSON. `openProject(file)` needs no
  change — `deserialize()` already accepts full `data:` URIs, and the
  next save after import runs the same lazy migration as any other
  legacy content (§6.4).
- **World Builder's `.vtheme` Export**: needed **no separate change** —
  `builder.js`'s `packageTheme()` already externalizes `data:`-prefixed
  images at Build time, and `_toBlob` (§6.2) already resolves
  `vihu-asset:` refs to real Blobs before `builder.js` ever runs, so
  Export inherits the fix transitively through the same Build pipeline
  it already used.

---

## 9. Verification summary

Each phase shipped with its own scratch Playwright suite (this sandboxed
environment cannot reach a real Supabase project — the same standing,
disclosed limitation as every prior Supabase-touching sprint in this
codebase's history — every suite mocks `ThemeRepositoryClient`/
`ProjectSync`/`CreatorProjectSync` and uses a real local IndexedDB), plus
full regression across every prior phase's own suite and both
`goldenBuild.js` suites (World Builder v1 and v2) after every single
phase — all passing unchanged at every step, confirming no phase ever
left the app in a broken state mid-rollout.

Phase E's own suite specifically proves, end to end, through the real
UI of both surfaces (not internals):

- A real upload → real reload → real Build produces a compiled package
  whose thumbnail asset is **byte-identical** to the originally uploaded
  file (World Builder v2).
- A real upload → real reload (restoring the session) → real Publish
  Studio Read-screen render genuinely paints the correct picture
  (Creator) — the Rule 5 (Publish Fidelity) guarantee holds for a
  `vihu-asset:` reference specifically, not just a legacy `data:` URI.
- A genuinely forced upload failure (not a killed tab — a real,
  simulated network rejection) leaves the asset durably `pending`
  (never lost, since the local IndexedDB write already succeeded); once
  connectivity returns, `retryPending()` — the real, unmodified recovery
  path, its own real exponential backoff honored, not bypassed —
  drains the queue to zero, for both surfaces independently.
- The Magic Card recall cross-owner fix (§6.5), proven three ways: (a)
  a foreign reference fails with no fallback supplied; (b) the same
  reference resolves correctly with the right fallback owner supplied,
  and the current session's own owner is confirmed tried **first**; (c)
  a genuinely local reference (also carrying a fallback, mirroring how
  `deserialize()` unconditionally threads it) resolves via the current
  session alone and never even attempts the fallback; (d) the full,
  real `_pullRecalledProjects` → `ProjectManager.deserialize()` chain,
  driven end to end, resolves a recalled Story's own picture into a
  real, loaded `Image` with the correct pixel content.

---

## 10. Explicitly out of scope

- No proactive local-cache eviction/size-cap policy — IndexedDB blobs
  are never auto-deleted by this feature's own code; revisit only if
  real usage shows this becomes a problem.
- No retroactive forced migration/rewrite of already-Published Themes
  or already-synced Cloud Backup rows beyond what naturally happens on
  the next local save (§6.4).
- No new Postgres table for asset indexing — Storage objects are the
  index, matching `theme-assets`' own precedent.
- No change to `_ensureAuth()`'s anonymous-session behavior, Magic Card,
  or Card Platform mechanics beyond the one additive cross-owner read
  policy (§4).
- No "taking ownership" of a recalled project's pre-recall assets — they
  stay hosted under the original device's own owner path forever unless
  individually replaced (§6.5).

---

## 11. Critical files

- `js/assetStore.js` — the shared module (§3, §5).
- `supabase/schema.sql` — the `draft-assets` bucket + RLS (§4),
  disclosed/unexecuted.
- `tools/world-builder-v2/js/worldBuilderApp.js` — every upload/read
  call site + migration wiring (§6.2, §6.4).
- `tools/world-builder-v2/js/projectCompiler.js`,
  `tools/world-builder-v2/js/services/builder.js` — `_toBlob`/
  `externalizeSceneImage` teaching (§6.2).
- `tools/world-builder/js/worldBuilderApp.js` — the 3-line v1
  read-only mitigation (§6.1, §7).
- `js/projectManager.js` — `serialize()`/`deserialize()`/
  `_writeStorage()`/migration wiring/export hydration (§6.3, §6.4, §8).
- `js/pictureStudio.js`, `js/app.js`, `js/contextPanel.js`,
  `js/pageDesigner.js` — upload call sites (§6.3).
- `renderer/slideRenderer.js`, `js/objectStrip.js` — render-time/
  Object-Strip read-side resolution, including the recall fallback
  (§6.3, §6.5).
- `js/magicCard.js` — `_pullRecalledProjects`'s `recallOwnerId` stamp
  (§6.5).
- `js/creatorProjectSync.js`, `tools/world-builder-v2/js/services/projectSync.js`
  — unchanged code; their `data jsonb` payloads shrink automatically
  once refs replace embedded base64.
