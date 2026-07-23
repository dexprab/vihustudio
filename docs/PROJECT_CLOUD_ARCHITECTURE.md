# Project Cloud Architecture

**Sprint:** Cloud-Primary Project Storage (Phases 1–6, completed across a
single continued effort; each phase shipped and verified independently,
see §9).
**Status:** Canonical. This document defines the durable, cloud-primary
storage model both authoring surfaces' own *editable Project/Story data*
now uses; maintain it going forward the same way `docs/THEME_REPOSITORY_ARCHITECTURE.md`
is maintained for the compiled-Theme repository layer and
`docs/DRAFT_ASSET_ARCHITECTURE.md` is maintained for draft image storage.
**Scope:** This document does not restate `docs/DRAFT_ASSET_ARCHITECTURE.md`
(how a Project/Story's *images* are stored — that architecture is
completely unchanged by this one; this document's own cache tier stores
JSON that already carries `vihu-asset:` references, never raw image
bytes) or `docs/THEME_REPOSITORY_ARCHITECTURE.md` (the compiled, Published
Theme repository — a genuinely separate concept from an editable
in-progress draft). This document is authoritative for how the *editable
Project/Story JSON itself* — World Builder's Scenes/Places/Experiences/
Frames, Studio's Slides/Metadata — is stored, synced, and reconciled
across sessions and devices, before (and independent of) any Build,
Publish, or export.

---

## 1. The architectural decision this document implements

`docs/DRAFT_ASSET_ARCHITECTURE.md` already externalized every *image* out
of a Project/Story's JSON into Supabase Storage — the JSON itself is small
now (tens of KB, not megabytes) — but investigating a real, confirmed
data-loss incident (*"why am not seeing my forest adventure in builder as
am seeing it in studio"*) surfaced the next layer of the same problem:
**the JSON itself was still local-primary.** `js/projectStore.js` (World
Builder) and `js/creatorProjectStore.js` (Studio) each wrote the *whole
array* of every Project/Story to one `localStorage` key, and Supabase
(`builder_projects`/`creator_projects`) was only ever a best-effort
background backup nobody read from during live editing — a save failing
on quota, a browser wiping storage, or two devices silently diverging
were all still real risks for the JSON itself, exactly the class of
incident that started this whole investigation.

Across several turns the user progressively sharpened the requirement,
each quote binding for this whole effort:

- *"what am saying it the option 1 was to save everything on cloud so why
  the heck local storage is still part of discussion."* — a direct
  correction: Draft Asset Architecture ("Option 1") never touched a
  Project's own data, only its images.
- Rejected a structured multiple-choice question outright and gave their
  own direct, final answer instead: **"everything should be on cloud."**
- Doubled down, unprompted, naming scope and the non-negotiable
  constraint together: **"world & studio both. i dont want any kind of
  trouble later on. no data loss beacause of whatsoever reason."**

That last line is the governing brief this whole plan executes, on top of
the standing, original constraint from before this effort even began: **"at
no moment under any circumstances there should be any data loss or
jittery sessions."**

**Reframing, stated honestly rather than oversold**: the original quota
*emergency* for the JSON itself was already largely behind us by the time
this plan began (Draft Asset Architecture had already removed every
image from it). What this plan actually buys is what the user explicitly
asked for — a real, durable, cross-device, authoritative cloud copy that
doesn't depend on any one browser's storage surviving at all — not "more
headroom."

What did **not** change: `js/themeRepositoryClient.js`'s `_ensureAuth()`
anonymous-session behavior for Studio; the Traveller/Story-Egg/Creator-
Governing-Rules canon; `js/magicCard.js`'s `_pullRecalledProjects` (adopt-
as-new-copy on recall, unaffected); `supabase/schema.sql` (no new table or
RLS policy was needed — `builder_projects`/`creator_projects`' existing
owner-scoped policies already cover everything this plan needs);
`tools/world-builder/` (v1), which has no cloud-backup path of its own to
touch at all.

---

## 2. The one hard technical constraint this plan is built around

`ProjectStore.list()/get()/create()/save()/duplicate()/remove()` and
`CreatorProjectStore.list()/get()/upsert()/remove()/clearAll()` are
**synchronous today** — real call sites across `worldBuilderApp.js` (~150
of them, funneling through `_persist()`) and `js/projectManager.js`
(`_syncProjectStore`/`_ensureProjectId`) read a `{project,ok,error}`/plain
return value in the same tick. IndexedDB has no synchronous write. The
only way to gain IndexedDB's durability without touching a single one of
those call sites: **each cache module keeps an in-memory `Map` mirror,
hydrated from IndexedDB once at boot (before the Welcome screen / restore-
modal ever paints), that every public function reads/writes
synchronously — exactly as it read/wrote a parsed `localStorage` array
before. The actual `IDBObjectStore.put()` is fired in the background from
inside the write function, never awaited by the caller.** This is
`js/assetStore.js`'s own `put()` pattern ("resolves the instant the local
write completes, never waits on the network"), pushed one level further
so even the "local write" being reported on is the in-memory mirror, with
IndexedDB durability trailing a tick behind.

**Disclosed residual risk, not hidden**: there is a small (millisecond-
scale) window where a tab crash between "accepted into the in-memory
mirror" and "the background `IDBObjectStore.put()` transaction actually
commits" could lose the very last edit. This is strictly smaller and
rarer than the localStorage-quota failure mode it replaces, and mirrors
the same class of disclosed risk `docs/DRAFT_ASSET_ARCHITECTURE.md` §3
already accepts for image uploads.

**Ordering guard**: a rapid sequence of writes for the same id (a drag
operation calling `save()`/`upsert()` many times a second) must never let
a background `put()` complete out of order and clobber a fresher write
with a stale one. Each background writer compares the record it captured
at call time against whatever is *currently* in the in-memory `Map` right
before it actually writes to IndexedDB, and silently no-ops if a newer
write has already superseded it — that newer call's own background write
owns persisting the truth.

---

## 3. Two mirrored cache modules, one pattern, no shared code

Matching this codebase's own established precedent of duplicating small
per-surface adapters rather than sharing one module between genuinely
separate systems (`js/projectStore.js`/`js/creatorProjectStore.js`,
`tools/world-builder-v2/js/services/projectSync.js`/`js/creatorProjectSync.js`
are already parallel, never shared):

| | World Builder | Studio (Creator) |
|---|---|---|
| Cache module | `tools/world-builder-v2/js/projectCache.js` | `js/creatorProjectCache.js` |
| IndexedDB database | `vihu-world-project-cache` | `vihu-creator-project-cache` |
| Legacy `localStorage` key (read once at migration, never deleted) | `vihu-world-builder-projects` | `vihustudio-projects` |
| Store facade (public API unchanged) | `tools/world-builder-v2/js/projectStore.js` | `js/creatorProjectStore.js` |
| Cloud push module (reused, hardened) | `tools/world-builder-v2/js/services/projectSync.js` | `js/creatorProjectSync.js` |
| Cloud table | `builder_projects` | `creator_projects` |
| Gated on | always attempts a push (World Builder has no Traveller concept) | `MagicCard.getActive()` — a Traveller never reaches the cloud at all, by design |

Each cache module owns its own IndexedDB database (own version number) so
a schema bump on either can never force an upgrade transaction on the
*other* cache, or on the shared `vihu-asset-cache` image-blob database
`js/assetStore.js` owns.

### 3.1 IndexedDB schema (identical shape in both databases)

**`projects`** store, keyPath `id`: the full Project/Story record exactly
as `ProjectStore`/`CreatorProjectStore` already write it — `{id, name,
thumbnail, createdAt, updatedAt, cloudSyncedAt, data, ...}`.

**`pendingCloudSync`** store, keyPath `id`: `{id, status:'pending'|'failed'|'done',
attempts, nextAttemptAt, lastError, cloudUpdatedAt, createdAt}` — written
in the **same IndexedDB transaction** as the `projects` write (mirrors
`js/assetStore.js`'s own `blobs`+`pendingUploads` one-transaction
discipline exactly), so a local write can never exist without its own
durable cloud-retry bookkeeping riding along.

### 3.2 Graceful degrade, two distinct failure modes

- **IndexedDB itself unavailable** (`indexedDB.open()` fails — old Safari
  private mode, an exotic embedder): `hydrate()`'s own `.catch()` sets
  `_useFallback=true` and every subsequent write goes straight to the
  legacy `localStorage` key instead — the exact same read/write shape the
  app used before this whole cache effort existed. `onPersistError` never
  fires in this mode, since the fallback write genuinely succeeds.
- **A specific write transaction fails even though IndexedDB opened fine**
  (a transient disk/quota hiccup): `_persistOne`'s own `.catch()` falls
  back to the same plain-localStorage write, one write at a time, rather
  than reporting failure with nothing durable saved at all. Only when
  *that* fallback also fails does `onPersistError(id, error)` fire — the
  genuinely rare "this device's storage is broken in some deeper way"
  case, surfaced asynchronously since the write path itself must stay
  synchronous from the caller's point of view.

### 3.3 Retry-forever background sync

`_attemptSync(id)` reads whatever is *currently* in the in-memory `Map`
(never a stale captured reference) and calls the reused
`ProjectSync.push()`/`CreatorProjectSync.push()` with `{expectedUpdatedAt:
record.cloudSyncedAt}` — the exact versioned, conflict-aware call both
sync modules already supported (see §4). Three outcomes:

- **`synced`** — `markCloudSynced(id, updatedAt)` records the real
  `cloudSyncedAt`, the pending record settles to `status:'done'`.
- **`conflict`** — the pending record settles to `status:'conflict'`,
  `getConflictIds()` will report it, **and it is never auto-retried** —
  every conflict is a human decision, matching `js/services/projectSync.js`'s
  own long-standing "no merge logic of any kind" rule.
- **`failed`** (a genuine network/transient failure, not a conflict) —
  `status:'failed'`, `attempts` incremented, `nextAttemptAt` set from a
  shared exponential-backoff ladder (`[5s, 20s, 60s, 5min, 15min]`,
  reused from `js/assetStore.js`'s own `BACKOFF_MS` when that module is
  loaded, with an identical literal fallback so this file never hard-
  depends on load order) — retried indefinitely, never gives up.

`drainPendingSync()` is the retry-forever loop: filters every pending
record to what's genuinely due (`status==='pending'`, or `status==='failed'`
with an elapsed `nextAttemptAt`; a `status==='conflict'` record is
deliberately excluded, since it needs a human, not a retry) and attempts
each in sequence. Triggered on module load, on the browser's `online`
event, and on a slow shared ~60s background interval while anything is
due — the identical trigger set `js/assetStore.js`'s own `retryPending()`
already uses, not a per-project timer (real, avoidable overhead once an
author has dozens of Projects/Stories).

### 3.4 One-time legacy migration — idempotent by construction

`hydrate()` loads the cache's own `projects` store; **only if that store
is found genuinely empty** does it call `_migrateLegacyOnce()`, which
copies every record from the legacy `localStorage` key into the cache and
enqueues a real, unconditional first-touch push for each (no
`expectedUpdatedAt` — `push()`'s own logic already knows how to tell a
brand-new row apart from a real conflict for exactly this case). The
legacy key is **never deleted** — a zero-cost rollback safety net, since
there's no quota pressure left to reclaim now that the JSON itself is
small. Because the trigger is "the cache is empty," not "the legacy key
has content," this is genuinely one-time: a record added to the legacy
key *after* the cache has already been populated once is correctly never
picked up by a later boot, and an already-synced record (`status:'done'`
in `pendingCloudSync`) is never re-pushed on a subsequent boot's own
`drainPendingSync()` call — both properties are directly exercised by
Phase 6's own A1/B1 tests (§9).

---

## 4. Cloud push hardening — a real, confirmed asymmetry closed

`tools/world-builder-v2/js/services/projectSync.js`'s `push(project, opts)`
already supported optimistic concurrency (`opts.expectedUpdatedAt`) from
an earlier "Versioned Cloud Sync" sprint that closed the original "Story-
Forest Adventure" incident for World Builder specifically. **`js/creatorProjectSync.js`'s
own `push(record, opts)` did not** — it was still a plain, unconditional
`upsert()`, the exact class of blind-overwrite bug that caused that
original incident, left unclosed for Studio. Given "no data loss...
world & studio both," Phase 4 hardened it to the identical
conditional-`update()`-then-check-then-`insert()`-or-conflict shape:

- No `expectedUpdatedAt` (or none yet recorded) → a plain unconditional
  upsert — correct for a genuinely new row.
- A matching `expectedUpdatedAt` → the conditional `update()` succeeds
  (confirmed via `.select('id')` after `.update()`, so PostgREST reports
  which rows were actually touched — the only reliable way to tell "the
  row's `updated_at` had already moved" apart from "the write silently
  didn't happen").
- A stale `expectedUpdatedAt` → `{ok:false, conflict:true, cloudUpdatedAt}`.
  The row is **never** silently overwritten.
- `expectedUpdatedAt` set but genuinely no row exists yet (a locally-
  recorded `cloudSyncedAt` with nothing actually pushed) → falls through
  to a real `insert()`, never a fabricated conflict.

Both cache modules' own `forceSync(id)` is the deliberate escape hatch —
an unconditional push bypassing the conditional check entirely, for the
"I know I'm the only one editing this in two tabs" case. World Builder
surfaces this through a real conflict badge in the Workspace header (see
`_forceOverwriteCloud` in `worldBuilderApp.js`); Studio exposes the
identical function for parity and any future conflict-UI surface, though
it has no dedicated conflict badge of its own today (a disclosed,
deliberate scope choice — see `js/creatorProjectCache.js`'s own header
comment).

---

## 5. Cloud-first reconciliation

### 5.1 World Builder — the Welcome screen (Phase 3)

Generalizes, rather than replaces, the existing Linked/Related/Orphan
classifier (`_annotateCloudLink`/`_relatedBackupCard`/`_refreshCloudWorlds`
in `worldBuilderApp.js`, built in an earlier "My Cloud Worlds —
Classification Redesign" sprint):

- **Linked** (the cloud row is the durable backup of an already-rendered
  local card) now branches on whether that Project is the one *currently
  open* in the Workspace. `openWorkspace()`'s own `_checkCloudFreshness`
  real-human-decision modal — the one case where a live, unsaved in-
  memory edit could genuinely exist — is completely unchanged. A Linked
  Project that *isn't* the one currently open has, by construction,
  nothing in memory to lose, so it silently pulls in a newer cloud copy
  and re-renders — a manual "☁️ Newer backup available — Load It" button
  survives unchanged for the one Project that's genuinely still open.
- **Orphan** (no local match at all — the real "restore this on a new
  machine" case) auto-materializes directly into "My World Projects" the
  instant it's discovered, zero manual click required — this can never
  overwrite or discard local data, since there is none for it locally by
  definition, matching "everything should be on cloud" as literally as
  the phrase allows.
- **Related** (same World identity, different Project id — a genuinely
  separate, older save left behind by a past rename/Duplicate) is
  unchanged, its own small diagnostic card, now under the retitled
  "Related Backups" section since Orphan no longer needs a section of
  its own.

**Storage Meter, repurposed per §6 of the original plan, not deleted**:
the quota-percentage bar is retired outright — once IndexedDB (hundreds
of MB–low GB) is the real Project-storage tier, that bar would sit
permanently near-0%, actively teaching authors to ignore a meter that no
longer measures anything meaningful. Replaced with a calmer "N Worlds
cached on this device" readout plus a real, live cloud-sync status line
(`ProjectCache.getPendingSyncCount()`: "☁️ N Worlds still syncing..." or
"☁️ All caught up — last synced Xs/m/h ago"). `ProjectStore.getStorageStats()`'s
own origin-wide `localStorage` walk is kept, unchanged, as a still-useful
diagnostic for Studio's own separate, still-partially-localStorage-based
footprint — it simply no longer feeds this panel.

**Explicitly deferred, disclosed rather than silently dropped**: a
Project deleted from the cloud on another device but still present
locally is not yet flagged with a "removed from your account elsewhere"
affordance — carries no data-loss risk in the meantime, since the
reconciliation loop only ever *adds or refreshes* a local card, never
deletes one just because it's absent from a fresh `ProjectSync.list()`
result. A missing visibility affordance, not a safety hole; named here as
real, not-yet-started follow-up work.

### 5.2 Studio — restore-modal and "My Projects" (Phase 5)

Studio's shape is genuinely different from World Builder's flat Welcome
screen — one active session slot restored via the existing restore-modal
flow, plus a separate "My Projects" catalog navigated into deliberately —
so this is the analogous *hook*, not a copy-paste of World Builder's own
UI.

New `CreatorProjectSync.get(projectId)` mirrors the reference module's
own `get()` exactly — resolves `null` (never throws) for an unreachable/
unconfigured/genuinely-absent row. New `checkStudioCloudFreshness(projectId)`
in `js/app.js` (exposed as `window.checkStudioCloudFreshness`, since this
function lives inside `js/app.js`'s own `DOMContentLoaded` closure and
isn't otherwise reachable from another script) mirrors `_checkCloudFreshness`'s
reasoning precisely:

- No-ops immediately for a Traveller (`MagicCard.getActive()` falsy — a
  Traveller's session has no cloud copy of anything to compare against,
  by design) or when `CreatorProjectSync`/`CreatorProjectStore` aren't
  loaded.
- Otherwise calls `CreatorProjectSync.get(projectId)`, re-checks that
  `AppState.project.id` still matches (the Story may have moved on by the
  time this network round trip resolves — a fresh boot, a different
  Story now open), and compares the cloud row's `updated_at` against the
  local record's own `cloudSyncedAt`.
- When the cloud is genuinely newer, reuses the existing restore-modal
  dialog (`showRestoreModal`/`hideRestoreModal`) rather than building a
  second small-modal component — "☁️ Newer Cloud Version Found," Load
  Cloud Version / Keep What I Have, the primary action calling the real
  `ProjectManager.deserialize(row.data)` + `saveToLocalStorage()`.

**Two real wiring points, both non-blocking background checks that never
delay showing the editor on a network round trip**: `_beginBoot()`'s own
restore-modal `onPrimary` handler (the moment a saved session is offered
for restore is exactly the safe moment — the Project isn't already open/
being edited, by construction, since we're mid-restore) calls it right
after a successful `ProjectManager.restoreSession()`; `js/creationFlow.js`'s
`_openProjectRecord()` (the "My Projects" open path) calls the identical
function right after opening a record. Magic Card recall's own
`_pullRecalledProjects` (adopt-as-new-copy, fresh ids) is completely
unaffected — a recalled project has no matching local record to compare
against in the first place.

---

## 6. `ProjectStore`/`CreatorProjectStore` — internals rewritten, public API 100% unchanged

`list()/get()/create()/save()/duplicate()/remove()` (World Builder) and
`list()/get()/upsert()/remove()/clearAll()` (Studio) keep their exact
current signatures and return shapes. Internally they read/write through
their respective cache module's in-memory mirror instead of a plain
localStorage read/write. This is the *only* place either module's
implementation changed — every real call site across both surfaces is
untouched.

A small, additive `onPersistError(fn)` pub/sub exists on both facades
(`ProjectStore`/`CreatorProjectStore`), mirroring `js/assetStore.js`'s
own established pattern — the seam that surfaces the rare, genuinely both-
broken durable-write failure asynchronously, since the write itself must
stay synchronous.

---

## 7. Phase 6 — the exact regression this final phase exists to catch, and did

While designing this phase's own two-device-conflict verification test
(`B4` in the suite described in §9), a real, previously-undiscovered bug
was found and fixed at its root: **`js/creatorProjectStore.js`'s `upsert()`
constructed a brand-new record object on *every* call, with no
`cloudSyncedAt` field at all — silently discarding whatever
`js/creatorProjectCache.js`'s `markCloudSynced()` had recorded after a
prior successful push.**

Since `js/projectManager.js`'s `_writeStorage()` calls `upsert()` on
*every single debounced autosave*, not just the first one, this meant
`cloudSyncedAt` was wiped the instant editing continued past a Story's
very first save. `js/creatorProjectCache.js`'s `_attemptSync()` (reading
`record.cloudSyncedAt` fresh from the in-memory map at call time) would
then always pass an `undefined` `expectedUpdatedAt` to `CreatorProjectSync.push()`
— which correctly treats that as "no conflict check needed" and falls
through to a plain, unconditional upsert. **The Phase 4 hardening
described in §4 was built correctly, end to end, but never actually
engaged in practice past a Story's first save, for any real editing
session** — a two-device conflict for Studio would have silently been won
by whichever device happened to save last, exactly the class of incident
this whole plan exists to prevent.

World Builder's own `save(project)` never had this bug, because it
*mutates the caller's existing object in place* (`project.updatedAt = new
Date().toISOString()`) rather than constructing a fresh one — since
`ProjectCache`'s `_map` holds object references, not copies, whatever
`markCloudSynced()` had written directly onto that same object survives
automatically. `duplicate(project)` deliberately does the opposite —
`delete copy.cloudSyncedAt` — since a fresh copy under a brand-new id has
genuinely never been synced and must take the unconditional first-touch
path, exactly matching a new project's own behavior.

**Fix**: `upsert()` now carries `cloudSyncedAt` forward from the existing
record exactly like `createdAt` already was:

```js
const record = {
  id: id,
  name: (meta && meta.name) || 'Untitled',
  thumbnail: (meta && meta.thumbnail) || null,
  createdAt: existing ? existing.createdAt : now,
  updatedAt: now,
  cloudSyncedAt: existing ? existing.cloudSyncedAt : undefined,
  data: data
};
```

A genuinely new record (`existing` is `null`) still gets no
`cloudSyncedAt`, correctly taking the unconditional first-touch push
path — the fix changes nothing about a first save, only restores what
every *subsequent* save had been silently discarding.

---

## 8. Explicitly out of scope

- No forced/mandatory sign-in change for Studio — the anonymous Traveller
  model is untouched; cloud sync for Studio stays exactly as gated on
  `MagicCard.getActive()` as it was before, just made durable and
  conflict-safe.
- No change to `tools/world-builder/` (v1) beyond what
  `docs/DRAFT_ASSET_ARCHITECTURE.md` already shipped — v1 has no cloud-
  backup path of its own to touch.
- No `supabase/schema.sql` change — both `builder_projects` and
  `creator_projects`' existing owner-scoped RLS already support
  everything this plan needs.
- No local-cache eviction/size-cap policy — an IndexedDB `projects`/
  `pendingCloudSync` record is never auto-deleted by this feature's own
  code except an explicit `remove()`/`clearAll()` call.
- No proactive re-migration or forced rewrite of already-synced content —
  migration stays lazy and one-time, per §3.4.
- The "deleted-elsewhere" flagged-card affordance named in §5.1 — real,
  disclosed, not-yet-started follow-up work, not a silent gap.

---

## 9. Verification summary

Each phase shipped with its own scratch Playwright suite (this sandboxed
environment cannot reach a real Supabase project — the same standing,
disclosed limitation as every prior Supabase-touching sprint in this
codebase's history — every suite mocks `ThemeRepositoryClient`/
`ProjectSync`/`CreatorProjectSync` and uses a real local IndexedDB), plus
full regression across every prior phase's own suite and both
`goldenBuild.js` suites (World Builder v1 and v2) after every single
phase — all passing unchanged at every step.

Phase 6's own suite specifically closes four genuine gaps no prior
phase's suite covered, cross-referenced against every prior phase's own
assertions before being written to avoid duplicating already-proven
ground:

- **Legacy migration idempotency**, both surfaces (A1/B1): two legacy
  records migrate exactly once on first boot (present in the cache,
  durably in IndexedDB, pushed exactly once); a reload never duplicates
  them, never re-pushes an already-`done` record, and a record spliced
  into the legacy key *after* the one-time migration already ran is
  correctly never picked up.
- **IndexedDB-only-broken degrade**, both surfaces (A2/B2) — distinct
  from the already-covered *both*-broken case (Phase 2/4's own suites):
  `onPersistError` never fires when only `indexedDB.open()` is broken
  and `localStorage` still works; the record survives a reload via the
  plain-localStorage fallback path, transparently.
- **Offline-then-online recovery**, both surfaces (A3/B3): a genuine,
  simulated network failure (not a conflict) correctly lands as
  `status:'failed'` with a real backoff `nextAttemptAt`; directly
  advancing that timestamp into the past (rather than a real multi-
  second wait) plus firing a real `online` event correctly drains the
  queue to `status:'done'` once connectivity is restored.
- **A real two-device conflict via the full pipeline** (B4) —
  `CreatorProjectStore.upsert()` → the cache's own background
  `_attemptSync()` → `CreatorProjectCache.getConflictIds()`, not just the
  isolated `CreatorProjectSync.push()` unit test an earlier phase's suite
  already covered. This is the test that surfaced §7's own regression: a
  second local save after another device's own independent save moved
  the cloud row is correctly detected as a conflict (not silently
  overwritten, and never silently auto-merged either way), and
  `forceSync()` correctly resolves it as the deliberate escape hatch.

---

## 10. Critical files

- `tools/world-builder-v2/js/projectCache.js`, `js/creatorProjectCache.js`
  — the two cache modules (§3).
- `tools/world-builder-v2/js/projectStore.js`, `js/creatorProjectStore.js`
  — the public-API facades (§6), including the Phase 6 `upsert()` fix (§7).
- `tools/world-builder-v2/js/services/projectSync.js`, `js/creatorProjectSync.js`
  — the versioned cloud push (§4).
- `tools/world-builder-v2/js/worldBuilderApp.js` — `_persist`,
  `_scheduleCloudSync`, `_annotateCloudLink`/`_relatedBackupCard`/
  `_refreshCloudWorlds`, `_renderStorageMeter`, `openWorkspace`/
  `_checkCloudFreshness` (§5.1).
- `js/projectManager.js` — `_writeStorage`, `_syncProjectStore`,
  `_scheduleCloudProjectSync`, `_ensureProjectId`, the restore-modal
  freshness hook (§5.2).
- `js/app.js` — `checkStudioCloudFreshness` (§5.2).
- `js/creationFlow.js` — `_openProjectRecord` (§5.2).
- `js/magicCard.js` — `_pullRecalledProjects` (confirmed unaffected, §1).
- `js/assetStore.js` — reused for its `BACKOFF_MS` constant and as the
  proven structural precedent this whole effort builds on top of; not
  modified by this plan.
