# Theme Repository Architecture

**Sprint:** Platform Hardening Sprint — Repository Architecture Transition
(Phase 1 — Repository Foundation; Phases 2–4 — Publish, Registry
refresh, and Studio boot wiring — completed in the same continued
sprint, see §8).
**Status:** Canonical. This document defines the repository-first
architecture the platform is transitioning to; maintain it going forward
the same way `docs/THEME_CONTRACT.md` is maintained for the compiled
package contract.
**Scope:** This document does not restate `docs/THEME_CONTRACT.md` (the
Builder ⇄ Studio field-parity ledger for the compiled Theme shape) or
`docs/THEME_PROJECT_SPEC.md`/`docs/VTHEME_PACKAGE_SPEC.md` (the authoring
folder and file-transport package specs). Those remain authoritative for
the *shape* of a Theme's data. This document is authoritative for *where
a Theme lives* and *how it's discovered* — the repository layer that sits
underneath the shape those documents already define.

---

## 1. The architectural decision this document implements

Per the sprint's own directive:

1. **Builder produces a Theme, not a package.** The canonical runtime
   representation is a complete, in-memory Theme — manifest, theme
   definition, layouts, frames, experiences, assets, metadata, and future
   supported resources — everything required to render it. This is the
   same `{manifest, theme, assets}` shape `docs/THEME_CONTRACT.md` already
   documents; nothing about the *shape* changes here, only what happens
   to it after Build.
2. **Publish and Export are different operations.** Publish installs a
   Theme into a repository — no package, no ZIP, an internal platform
   operation. Export produces a portable `.vtheme` file for transport
   outside the platform — explicitly **out of scope for this sprint**
   (deferred to a future sprint per the sprint's own Out of Scope list).
3. **Official Themes become repository-native.** They are no longer
   in-code entries or files sitting in `themes/`/`official-worlds/` that
   Studio special-cases — they live in the Official Theme Repository and
   Studio reads them the same way it reads any other repository.
4. **Supabase is the first persistent repository backend.** Scoped
   narrowly: it is the Official Theme Repository (and, in this phase,
   the Personal Theme Repository) — not a Builder backend, not a Studio
   backend, not a session store. `tools/world-builder`'s own Project
   data (`js/projectStore.js`, `localStorage`) is completely unaffected;
   Builder still edits Projects locally exactly as it does today. Only
   *Publish*'s destination changes.
5. **A Personal Theme Repository** gives each author a small, real
   place their published Themes live, instead of trying to emulate
   filesystem storage inside the browser.
6. **Theme Registry becomes a repository abstraction** — discover
   repositories, enumerate themes, load themes, resolve assets — not a
   `localStorage` wrapper.
7. **Studio consumes repositories, not packages** — no per-source
   branching (official vs. personal vs. imported); every Theme reaches
   Studio through the same interface.
8. **`localStorage` is no longer the long-term direction** for published
   Themes. No further architecture investment goes there.

This document covers Phase 1 only: the repository foundation. Phases
2–5 (replacing Publish, refactoring `ThemeRegistry`, updating Studio,
and full happy-flow validation) are separate, later passes that build on
this foundation — per the sprint's own "Do not redesign Builder or
Studio" instruction for this phase, **nothing in `js/themeRegistry.js`,
`js/themeEngine.js`, `renderer/slideRenderer.js`, or any World Builder
file is changed by this phase.** Everything below is new, additive code
with no existing call site yet.

---

## 2. Canonical repository layout for a Theme

A repository (Official or Personal) stores each Theme as **two parts**,
mirroring the existing `{manifest, theme, assets}` split so nothing about
the shape Studio already understands needs to change:

### 2.1 The Theme record (Postgres table `themes`)

Trimmed to the minimum this sprint actually needs — see §9 for exactly
what was cut from the original Phase 1 draft and why.

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid`, PK | Surrogate key — a repository row's own identity, never exposed to Studio. |
| `repository` | `text` | `'official'` \| `'personal'` — which repository this row belongs to. |
| `owner_id` | `text`, not null, default `''` | `''` (empty-string sentinel) for Official; the authenticated anonymous user's id (§4) for Personal. A real `NULL` is deliberately avoided here — Postgres treats every `NULL` as distinct from every other `NULL` for uniqueness purposes, which would silently defeat the `(repository, owner_id, theme_id)` uniqueness constraint below for every Official row. |
| `theme_id` | `text` | The Theme's own `manifest.id` (kebab-case, per `docs/THEME_PROJECT_SPEC.md` §10). |
| `manifest` | `jsonb` | The complete manifest object, exactly as `docs/VTHEME_PACKAGE_SPEC.md` §Manifest defines it. Name/version are read from here directly (see §9 — no denormalized columns). |
| `theme` | `jsonb` | The complete theme object (`layouts`/`frameVariations`/`layerPack`/`representations`/`supportedCreationTypes`/etc.) — **without** embedded asset data; see §2.2. |
| `created_at` | `timestamptz` | Standard provenance. No `updated_at`/trigger — see §9. |

A unique constraint on `(repository, owner_id, theme_id)` is the real
identity key — the same Theme id may exist once in Official and, quite
separately, once in one author's own Personal repository; there is no
global-uniqueness requirement across repositories, since Studio always
resolves a Theme through one specific repository, never by bare id
alone (this is the concrete meaning of "the source becomes irrelevant"
in §4 below — irrelevant to *how Studio renders it*, not to *how it's
addressed*). Publishing again with the same `(repository, owner_id,
theme_id)` is an **upsert** (replace-in-place), not a new row — matching
the existing local-import "Replace" behaviour Studio's Theme Library
already has for a duplicate id.

### 2.2 Assets (Supabase Storage, not embedded base64)

This is the one real, deliberate shape change from today's contract,
and it directly answers the "base64 makes the file heavy" question this
sprint grew out of. Assets are **not** embedded as data URIs inside the
`theme` JSONB column. They live as raw binary objects in a Supabase
Storage bucket, addressed by the exact same relative-path convention
`docs/THEME_PROJECT_SPEC.md` §9 already defines:

```
theme-assets/{repository}/{owner_id-or-'_official'}/{theme_id}/{relativePath}
```

e.g. `theme-assets/official/_official/museum-gallery/textures/linen.png`.

A loaded Theme's `assets` map (the same `{relativePath: value}` shape
`docs/THEME_CONTRACT.md` §7 already establishes) is populated with a
**signed URL** for every asset, Official and Personal alike, rather than
a data URI. The `theme-assets` bucket is created **private**
(`public: false`) so a single bucket can safely hold both repositories'
assets under the same RLS-governed model the rest of this schema uses —
a public bucket's unauthenticated endpoint bypasses Row Level Security
entirely by design, which would let anyone fetch a Personal asset by
guessing its path even though its `themes` row stays protected. Signing
still requires real `SELECT` permission under RLS at signing time, so
Official assets (readable by anyone, per `themes_official_select`'s
Storage-policy twin) and Personal assets (owner-only) both resolve
correctly through one uniform code path. This is the reason this isn't a
breaking change to the consumption
contract: every existing consumer (`<img src>`, `canvas.drawImage`,
`ThemeRegistry.getAsset()`'s callers in `js/creationFlow.js`) already
just uses whatever string is in that map directly — a browser treats a
`data:` URI and an `https:` URL identically as an image source. Nothing
downstream needs to know which kind of value it received.

**Why this is the correct fix for the original complaint, not a
speculative one:** raw PNG/JPEG bytes in Storage never pay the ~33%
base64 inflation tax at rest, and Storage is exactly what a repository
(as opposed to a single portable file) is for — this is the natural
repository-native analogue of the zip-transport idea explored earlier in
this sprint, except server-hosted instead of file-based, which is
strictly better for a *repository* (no download/re-upload round trip
needed at all).

---

## 3. The Repository abstraction interface

A single, small interface every repository implementation honors —
this is what `js/themeRegistry.js` will be refactored to depend on in a
later phase (Phase 3), not what it depends on yet:

```
Repository.discover()               → [{id, kind: 'official'|'personal', label}]
Repository.list(repositoryId)       → [{theme_id, name, version, manifest}]  (no theme/assets — a listing, not a load)
Repository.load(repositoryId, id)   → {manifest, theme, assets}              (assets already resolved to usable src strings)
Repository.publish(repositoryId, {manifest, theme, assetsRaw})
                                     → {ok, theme_id}                        (assetsRaw: {relativePath: Blob|dataURI})
```

`Repository.load()` is the one function that performs the
Storage-URL-vs-data-URI resolution described in §2.2 — every caller
downstream (a future `ThemeRegistry.get()`) receives the exact same
`{manifest, theme, assets}` shape regardless of which repository, or
which asset-storage mechanism, produced it. This is what "Studio should
never know where a theme originated" (directive #7) means concretely:
one function signature, one return shape, per repository kind.

Two repository kinds are implemented this phase:

- **Official** (`repository: 'official'`) — read-heavy, publicly
  readable (public Storage bucket, an RLS policy allowing anonymous
  `SELECT` on rows where `repository = 'official'`), writes gated to
  Builder's own Publish action (§5).
- **Personal** (`repository: 'personal'`) — scoped to one author (§4),
  a modest storage quota (a Postgres check constraint / a Storage bucket
  size policy — enforced server-side, never trusted to the client),
  enough for "a few themes," matching the sprint's own "modest storage
  limit sufficient for a few themes" framing.

---

## 4. Author identity for the Personal Theme Repository

VihuStudio has no accounts, no login, and no session concept anywhere
today. Rather than hand-roll a random id in `localStorage` (which a
client could trivially spoof when talking to Supabase directly, making
any Row Level Security policy keyed on it unenforceable), this phase
uses **Supabase's own Anonymous Sign-In** feature
(`supabase.auth.signInAnonymously()`): a real, invisible-to-the-author
session — no email, no password, no UI of any kind — that nonetheless
gives Postgres a real, server-verified `auth.uid()` to write Row Level
Security policies against (`owner_id = auth.uid()`). This satisfies "no
new login system" from the author's point of view (nothing appears in
the UI; it happens once, silently, on first Builder use) while giving
*real* enforcement instead of security-by-obscurity.

**Required one-time project setting, easy to miss**: Supabase projects
ship with Anonymous Sign-Ins **disabled** by default. Until it's turned
on (Dashboard → Authentication → Sign In / Providers → **Anonymous** →
enable "Allow anonymous sign-ins"), `signInAnonymously()` fails with a
`422` on `/auth/v1/signup` — visible as a console error on every page
load, since Studio's boot sequence always attempts to discover the
Personal repository. This is harmless to Studio itself (the failure is
caught per-repository in `refreshFromRepository()`, so boot proceeds
with Official only), but it means **Publish to Personal Themes** will
fail with a real, disclosed error message until this toggle is switched on.

The session persists via Supabase's own client-side session storage
(itself `localStorage`-backed, invisible to the rest of this app) —
clearing the browser's storage loses that identity and its Personal
repository, exactly as clearing `localStorage` loses a World Builder
Project today. This is a disclosed, accepted limitation of "no accounts
yet," not silently glossed over: a future sprint that wants a Personal
repository to survive a new device would upgrade this same anonymous
session to a real one (Supabase supports exactly that upgrade path
natively — "convert anonymous user to permanent" — without a data
migration, since the `auth.uid()` stays the same).

---

## 5. What Builder does now (Phase 2, completed)

`tools/world-builder/js/worldBuilderApp.js`'s `_renderPublishPanel()`
gained a shared `_publishToRepository(repositoryId, label)` helper.
Both **Publish to Official Themes** and **Publish to Personal Themes**
call it with `'official'`/`'personal'` respectively. (The Publish Contract
Alignment Closure Sprint — §11 — later reorganized this screen into a
clearly separated Publish/Export layout and removed the Community World
placeholder entirely, rather than leaving it inert; renamed "My Themes"
to "Personal Themes" throughout.) It:

1. Checks `ThemeRepositoryClient.isConfigured()` — if no
   `supabase-config.json` is present, shows a plain, disclosed
   "Supabase is not configured" message; never a crash.
2. Reads `project.lastBuild` (the exact `.vtheme` payload Build already
   produced — Publish still never reads `project.files` directly,
   preserving the Builder-owns-Projects/Runtime-owns-Packages split
   every earlier Publish sprint established).
3. Calls `ThemeRepositoryClient.publish(repositoryId, {manifest, theme,
   assetsRaw})`.
4. Shows "✓ Published … — VihuStudio will discover it automatically the
   next time it loads." on success, or a graceful failure message
   otherwise (network failure, not-configured, or a thrown error's own
   message).

The pre-existing `publishToOfficialThemes()`/`publishToMyThemes()`
names are kept as one-line wrappers around the shared helper — no
Builder screen, nav item, or UI copy changed beyond the one new card
and the two result messages. This is the whole of "replace only the
storage layer": the Publish screen's shape, the Build-then-Publish
mental model, and every other Publish option are unchanged.

## 6. What Studio does now (Phase 3/4, completed)

`js/themeRegistry.js` gained `refreshFromRepository()` — discovers
every repository (`ThemeRepositoryClient.discover()`), lists each
repository's themes, loads and validates each one
(`validatePackage()`, the same check a local `.vtheme` import already
runs), and registers anything valid via the existing
`_setImported(manifest, theme, assets)` — the identical code path a
drag-and-drop local-file import already uses. **Deliberately not**
persisted to `localStorage` (`_persistImported()` is skipped for
repository-sourced themes): Supabase is the source of truth and is
refetched on every boot, so the old file-import `localStorage` path
and the new repository path stay cleanly separate and never fight over
which one "wins." A theme that fails to load or fails validation is
silently skipped — one broken repository row never blocks discovery of
the rest, matching `_setImported`'s own existing per-theme error
isolation.

Both Official- and Personal-repository themes register with
`source: 'imported'` — the same tag a local file import already uses —
so they appear in Studio's existing "World Library" row with **zero new
UI**, per directive #7 ("no per-source branching"). This is a
deliberate, disclosed trade-off: a Supabase-sourced Official Theme is
not visually distinguished from a Supabase-sourced Personal Theme or a
locally-imported file in today's Theme Library. Building that
distinction is new Studio UI and out of this phase's "replace only the
storage layer" scope.

`js/app.js`'s `_startCreationFlow()` now awaits
`ThemeRegistry.refreshFromRepository()` (via a small
`_refreshRepositoryWithTimeout()` wrapper) racing a 4-second timeout
before calling `CreationFlow.start()` — the only boot-sequence change.
No new reactive re-render machinery was added to `CreationFlow` itself;
this one `await` point is sufficient because discovery always finishes
(or times out) before Screen 2 is ever painted.

---

## 7. Implementation notes

- **`supabase-config.example.json`** (committed) — a template with empty
  `url`/`anonKey` fields, kept alongside the real file as documentation
  of the expected shape. **`supabase-config.json`** is also committed,
  with this project's real values. A Supabase **anon/public key is
  designed to be public** — the project's Row Level Security policies,
  not the key's secrecy, are what actually protect data — so this is
  not a secrets leak the way a `service_role` key would be. It was
  briefly gitignored during Phase 1/2 development; committed once the
  static GitHub Pages deployment needed the file to actually be present
  at the served URL (a gitignored file never reaches a static host with
  no build step to inject it at deploy time) — the simplest correct
  choice for this single-deployment project. A future multi-deployment
  setup (e.g. a staging Supabase project) would revisit this in favor
  of an injected-at-deploy-time file, per the alternative this decision
  weighed against.
- **`js/themeRepositoryClient.js`** — loads `supabase-config.json` at
  runtime (the exact resilient fetch-with-fallback shape
  `js/buildInfo.js` already uses for `build-info.json` — "no config
  file present" is a normal, handled state, never a crash), lazily
  loads the Supabase JS client via its official ESM CDN build (matching
  this repo's zero-build-step convention — no `package.json`, no
  bundler), and implements the four-function interface from §3 against
  the Supabase tables/bucket conventions from §2. Loaded by both
  `index.html` (Studio) and `tools/world-builder/index.html` (Builder).
  **Real bug found and fixed while wiring Builder's Publish screen**:
  the config path was a bare relative string (`'supabase-config.json'`),
  which resolves against the *page's* URL — correct for Studio's root
  `index.html`, but silently 404ing for Builder (two folders deeper),
  making a correctly-configured project look "not configured" from
  Builder alone. Fixed by resolving the path relative to this script's
  own `<script src>` location (`document.currentScript.src` + a `../`
  hop), which is stable regardless of which HTML page loads it.
- **`supabase/schema.sql`** — see §9 for what changed from the Phase 1
  draft.

---

## 8. Explicitly deferred (per the sprint's Out of Scope list)

- Phase 5 (full happy-flow validation with a real Supabase project) —
  this environment cannot reach `supabase.co` (outbound egress policy),
  so live verification is performed by the project owner locally; see
  the sprint's own manual verification checklist for the exact steps.
- The `.vtheme` ZIP transport/export format (a separate, later sprint,
  per the sprint's own instruction — this document's §2.2 Storage
  design is a repository concept, deliberately not conflated with the
  file-transport question).
- Marketplace, Community, Collaboration, Theme versioning beyond
  `manifest.version`'s existing informational field.
- Distinguishing repository-sourced themes from locally-imported ones
  in Studio's Theme Library UI (§6's disclosed trade-off).
- Who may publish an Official Theme (§9's disclosed security gap) — no
  authorization model exists yet; today, anyone holding the anon key
  can write/overwrite any Official Theme row.

---

## 9. Schema simplification (this continued sprint)

The Phase 1 draft's `themes` table carried denormalized `name`/`version`
columns, an `updated_at` column with a trigger to maintain it, and extra
indexes — all premature for "a few themes," per this sprint's explicit
"keep the schema as small as possible" instruction. Removed:

- `name`/`version` columns — every real reader already has the full
  `manifest` JSONB in hand (`list()` selects `theme_id, manifest` and
  derives name/version from it in application code); a denormalized
  copy is one more place for the two to drift out of sync for no
  actual query-performance need at this scale.
- `updated_at` + trigger — publishing again is a plain upsert; `created_at`
  alone is enough provenance for now, and a trigger is one more moving
  part with nothing yet reading it.
- Extra indexes beyond the primary key and the uniqueness constraint —
  not required until table size or query patterns justify them.

One thing was **added** beyond the Phase 1 draft, not removed: **Official
rows are now writable by the anon role** (`themes_official_write`/
`themes_official_update`, and the matching `theme_assets_official_write`/
`_update` Storage policies). Phase 1's original draft gave Official rows
select-only RLS, deferring "who may publish Official" as an open
question. But this sprint's own explicit happy-flow requirement is
"Builder → Publish Official Theme → Supabase → Studio discovers Official
Themes" — which is not possible with a select-only policy. This is a
**disclosed, deliberate gap**, not an oversight: with no accounts and no
authorization model, *anyone* holding the public anon key (which, per
§7, is meant to be public) can currently publish, replace, or overwrite
any Official Theme. Resolving real Official-publish authorization (an
allowlist, a service-role-gated Edge Function, a review step) is
necessary future work, out of this sprint's own scope to invent.

---

## 10. Asset Externalization (Sprint 2 — completes the repository
transition this document started)

§2.2 already established that a Theme's `assets` map is uploaded to
Storage rather than embedded — but one real gap remained: `manifest.
thumbnail` and `manifest.previewImage` were *not* part of that map at
all. `builder.js`/`js/themeEngine.js`'s zip-import producer both
overwrote these two fields with a literal embedded data URI at Build/
Import time, so — regardless of what Publish itself did — the `themes`
table's `manifest` JSONB column always carried embedded image bytes for
these two fields. Traced to its root (per this sprint's own explicit
instruction to find every embedding site before writing any fix):

- **Everything else in the compiled package was already reference-based
  and needed no change**: `assets/*` files were already a map, not
  embedded fields; every Layout/Frame/Layer/Representation field
  `validator.js`'s `findAssetPaths()` recognizes was already a bare
  relative path; `supabase/schema.sql`'s `themes` table has no `assets`
  column, so `assetsRaw` already never reached a repository row.
- **The only two embedding sites** were `builder.js`'s `buildManifest()`
  (via a `thumbnailDataURL`/`previewDataURL` pair `packageTheme()` built
  separately from the `assets` map) and `js/themeEngine.js`'s
  `_buildPackageFromZipFiles()` (the "Local Repository" producer this
  document's §1 always intended to give the same shape as Cloud). Both
  fixed identically: the real bytes now join the *same* `assets` map
  every other asset already uses (keyed by the file's own relative
  name), and the manifest field is left as the plain reference it always
  was meant to be (`"thumbnail.png"`/`"preview.png"`, matching the
  placeholder convention `manifest.json`/`metadata.json` already
  default to).
- **Publish and `load()` needed zero code changes** — `ThemeRepositoryClient.
  publish()` already uploads every key in the built package's `assets`
  map, and `load()`/`_resolveAssets()` already resolves the whole map to
  signed URLs; once `thumbnail.png`/`preview.png` joined that map, they
  started flowing through the exact same path automatically.
- **The one real consumer-side addition**: `ThemeRegistry.
  resolveAssetRef(id, value)` — a data:/http(s) value (a legacy embedded
  package, or a repository's already-resolved signed URL) passes
  through unchanged; a bare relative-path reference resolves via
  `getAsset()`. Factored out of `js/creationFlow.js`'s pre-existing
  `_repThumbnail`, which had already discovered this exact rule
  independently for Representation thumbnails — now the one shared
  place every manifest-level image reference (`_renderThemeCard()`,
  `_themePreview()`) goes through, per directive #7's "Studio should
  never know where a theme originated."
- **Local/Cloud parity, proven, not just asserted**: a Playwright pass
  registered a theme with its `assets` map holding **signed-URL-shaped
  strings** (the literal shape a real Supabase `load()` produces, not a
  data URI) and confirmed the World Library card's actual `<img src>` in
  the live DOM resolved to that signed URL — with zero changes to any
  card-rendering code. The identical mechanism handles a local import's
  data URI and a repository's signed URL; Studio genuinely does not know
  which one it received.
- See `docs/THEME_CONTRACT.md` §8.4 for the full root-cause/fix/verify
  writeup and `tools/world-builder/verify/goldenBuild.js`'s updated
  assertions (still 30/30, now also proving no embedded base64 survives
  on either manifest field and that `resolveAssetRef()` round-trips a
  freshly-imported reference back to real bytes).

---

## 11. Publish Contract Alignment & MEP Finalization (Closure Sprint)

This sprint added no new capability — it locked the terminology, UI, and
documentation of everything Phases 1–2 (§1–§10) already built into one
canonical contract, and verified nothing in the implementation actually
contradicted it. The following are now **locked MEP decisions**:

### 11.1 Canonical models — three, not two, never merged

```
Builder Project
   ↓
Published Theme
   ↓
Studio
```

**Builder Project** — Builder-owned, mutable, meaningless to Studio.
**Published Theme** — the Theme definition (`manifest`/`theme`) plus its
assets, as it exists once it has left the Builder — either installed
into a Repository (Publish) or written to a portable file (Export).
**Studio** — consumes only Published Themes, never a Builder Project;
Builder edits never affect Studio until Publish (or a fresh Export/
import) actually runs. These three models are kept deliberately
distinct — no attempt was made, or should be made, to converge them
into one shared representation. See `docs/WORLD_BUILDER_ARCHITECTURE.md`
LOCK 02 for the same diagram in the Builder's own architecture doc.

### 11.2 Publish vs. Export — the distinction, made explicit everywhere

**Publish** installs a Theme into a Repository (Official or Personal).
Publish never creates a package — it reads exactly what Build already
produced (`project.lastBuild`, decoded back into `{manifest, theme,
assets}`) and sends it directly to `ThemeRepositoryClient.publish()`.

**Export** creates a portable `.vtheme` file. Export never installs into
a Repository — it only ever downloads.

Before this sprint, both operations lived in one flat list under a
single "World Package" heading, with no structural distinction between
them. `tools/world-builder/js/worldBuilderApp.js`'s `_renderPublishPanel()`
now renders two separately-headed sections — **Publish** (Official
Repository card, Personal Repository card) and **Export** (one card,
retitled "Export .vtheme Package") — so the two operations can never be
mistaken for variants of one another. "World Package" as a compound
term is removed from the Build screen and Publish screen alike (the
Build button is now "🎁 Build Theme", its success state "✓ Theme
Built", and the divider separating the Engine V2 Scene section from the
main Theme section now reads "Theme" instead of "World Package") — the
word "package" is used only where something genuinely is one (Export's
`.vtheme` file, the Engine V2 "Scene Package").

### 11.3 Publish Behavior — atomic replace, no history

Publishing installs exactly one row per `(repository, owner_id,
theme_id)` — `ThemeRepositoryClient.publish()`'s `upsert(...,
{onConflict:'repository,owner_id,theme_id'})` already implemented this
correctly before this sprint; nothing needed to change in code.
Publishing again **replaces** the previously published Theme atomically.
There is no repository version history and no internal version
management — `manifest.version` remains a purely informational field
the author sets, never a repository-tracked history.

**Verified, not just asserted**: two consecutive Builds of the same
unmodified Builder Project were compared byte-for-byte and found
identical — the compiled `{manifest, theme, assets}` JSON a Publish
would send is deterministic. Since the DB row is a single upsert (never
an append), publishing the same unmodified Project twice produces an
identical published Theme, identical asset layout, and identical
repository representation, exactly as the MEP requires.

### 11.4 Asset Ownership — self-contained, no cross-theme sharing

Each Theme owns all assets required to render itself — decorations,
layouts, frames, images, thumbnails, preview images, fonts, and any
future asset type — with **no cross-theme sharing, no deduplication, no
hashing, no reference counting, and no garbage collection**. This is a
locked, deliberate simplicity choice, not an oversight: `Storage.upload
(..., {upsert:true})` writes are scoped to `{repository}/{owner_id-or-
'_official'}/{theme_id}/{relativePath}`, so one Theme's assets can never
collide with another's, and a Theme's assets are never pruned or rewritten
when unrelated data changes elsewhere. A Theme that stops referencing an
asset it once used leaves that object orphaned in Storage rather than
deleting it — an explicit, accepted consequence of "no garbage
collection," not a bug to fix in a future MEP sprint.

### 11.5 Signed URLs never persisted

The stored Theme (`themes.manifest`/`themes.theme`, the Postgres JSONB
columns) never contains a signed URL — confirmed unchanged since Sprint
2 (`docs/THEME_CONTRACT.md` §8.4): `manifest.thumbnail`/`.previewImage`
are plain relative-path references, and no code path anywhere writes a
resolved value back into a stored record. Repositories generate signed
URLs only transiently, while `ThemeRepositoryClient.load()` resolves
assets for a caller — the canonical stored Theme remains fully portable
between repositories (a Personal Theme promoted to Official, or a
Theme exported and later Published from a different repository, would
carry no stale, repository-specific URLs).

### 11.6 Repository Independence

Official Repository, Personal Repository, and any future Local
Repository must expose exactly the same published Theme representation
— `{manifest, theme, assets}`, assets resolved to real `src` values by
`load()`. Repositories differ only in *where bytes are stored*, never in
the shape of what they hand back; `js/themeRegistry.js`'s
`refreshFromRepository()` and `ThemeRegistry.resolveAssetRef()` already
treat every repository identically, with no per-source branching
anywhere in Studio. A future Local Repository implements the same
4-function interface (§3) — no special Theme format, no Local-specific
representation.

### 11.7 UI terminology — locked

| Use | Not |
|---|---|
| Builder Project | Project (ambiguous with a repository "project") |
| Published Theme | "World Package" as a catch-all |
| Official Repository / Official Themes | — |
| Personal Repository / Personal Themes | "My Themes" |
| Export Package / Export .vtheme Package | "World Package" (Export's own artifact is correctly still called a package — it *is* one) |

The Community World card is removed from the Publish screen entirely —
not left as a disabled placeholder — since Community is out of MEP
scope and this screen only exposes completed workflows. (The unrelated,
pre-existing "Community Worlds — Coming soon" card on the Welcome
screen's Explore section is a different, long-standing Builder feature
area and is untouched by this sprint.)

### 11.8 Happy Flow, re-verified end to end

```
Builder Project → Build → Publish → Official Repository → Theme Registry → Studio
```

and the same flow substituting Personal Repository, were both
re-verified after this sprint's changes (Playwright, against the real
Builder UI and a signed-URL-shaped simulated repository response, per
this sandbox's standing network restriction — see §8): the Publish
screen renders exactly 3 cards (Official, Personal, Export — no
Community), contains no "World Package" or "My Themes" text anywhere,
and both repository buttons still produce a real, graceful — not
crashed — result. Only repository persistence differs between Official
and Personal; the Theme representation, Studio's discovery mechanism,
and rendering are otherwise identical, per §11.6.

---

## 12. Platform Status & Repository Reset

A standalone developer/QA diagnostic — deliberately **not** a Builder or
Studio feature, no product styling, reached only by opening
`tools/platform-status/index.html` directly. Answers the four questions
this document's own Philosophy names: is everything connected? what
exists? what is published? can I safely start over? — without opening
Supabase's own dashboard.

### 12.1 What the page shows

- **Platform Health** — 🟢/🟡/🔴 for Builder, Build Pipeline, Repository
  Connection, Official Repository, Personal Repository, Theme Registry,
  and Studio Discovery. Red means a real problem (repository configured
  but a query failed); yellow means "nothing to judge yet" (no Builder
  Project open, or not configured at all), never a false alarm for a
  normal, unconfigured local dev environment.
- **Builder** — this tool's own version (`tools/world-builder/
  build-info.json`, fetched read-only) and, if this browser has any
  World Builder Project in `localStorage` (the same `vihu-world-builder-
  projects` key `tools/world-builder/js/projectStore.js` already owns —
  read-only, never written to by this page), the most recently edited
  one's name, build status, and last Build timestamp.
- **Repository** — Official and Personal Theme + Storage-object counts,
  via a new `ThemeRepositoryClient.getStats(repositoryId)`.
- **Theme Registry** — how many of the repository's own Themes would
  actually register cleanly if `ThemeRegistry.refreshFromRepository()`
  ran right now, computed by mirroring that function's own list → load →
  `validatePackage()` steps directly (see §12.3 for why this page never
  calls `refreshFromRepository()`/`.list()`/`.getCatalog()` itself).
- **Studio** — whether `ThemeRegistry` is present at all, and whether
  the discovery pass above completed without a systemic failure (a
  per-theme validation failure is normal and doesn't count as one).
- **Platform Summary** — a compact plain-text readout of all of the
  above, in the exact shape this sprint's own prompt specified.

### 12.2 `ThemeRepositoryClient.getStats(repositoryId)`

`{themeCount, assetCount}` — `themeCount` is a real row count scoped to
this repository (and, for Personal, this browser's own anonymous
session — there is no admin/service-role credential anywhere in this
client-side app to see across users, so a "Personal Repository" count
is always just "mine," never "everyone's"). `assetCount` walks every one
of those Themes' Storage prefixes with a new recursive lister,
`_listAllObjectPaths` (§12.4), so the count always matches what would
actually resolve — never an undercount from a shallow, one-level listing.

### 12.3 Why this page never calls `ThemeRegistry.refreshFromRepository()`

`js/themeRegistry.js` self-registers its own hardcoded built-in Official
Story/Artwork themes (`storybook-classic`, `adventure`, `sketchbook`, …)
and reloads any locally-imported Theme sitting in this same origin's
`localStorage` the instant the script loads — both completely unrelated
to what's actually published in a Supabase repository. Calling
`refreshFromRepository()`/`.list()`/`.getCatalog()` on this page would
silently inflate its counts with that unrelated data. Instead, this page
reuses only the one genuinely pure, side-effect-free export,
`ThemeRegistry.validatePackage(pkg)`, applied directly to what
`ThemeRepositoryClient.list()`/`.load()` return — mirroring
`refreshFromRepository()`'s own internal logic exactly, without ever
touching the live registry it mutates.

### 12.4 `ThemeRepositoryClient.reset(repositoryId)` — the Repository Reset contract

Implements the repository abstraction's newest member — the UI never
touches Supabase directly, only this one function, so a future
`LocalRepository` implements the identical contract with no UI change.
For the given `repositoryId` (called once for `'official'`, once for
`'personal'` — "Reset Repositories" resets both):

1. Lists every Theme row this repository/owner scope actually owns.
2. For each one, recursively lists every Storage object under its
   `{repository}/{owner_id-or-'_official'}/{theme_id}/` prefix (the new
   `_listAllObjectPaths` — also what fixed a real, pre-existing bug in
   `_resolveAssets`, which only ever listed one folder level and would
   have silently missed a nested asset like `assets/textures/linen.png`)
   and deletes them via one batched `storage.remove()` call.
3. Deletes every matching `themes` row in one statement.

Assets are deleted **before** their Theme row, specifically so a
mid-failure never leaves a Theme row pointing at already-deleted-but-
still-referenced assets, or a row deleted while its assets survive
orphaned with no coordinating row at all — the ordering that most
cleanly fails.

**Reset scope — explicit, per this sprint's own requirement:**

| Deleted | Never touched |
|---|---|
| Published Theme rows (both repositories) | Builder Projects (a completely separate persistence layer — `ProjectStore`'s own `localStorage` key, never read or written by `ThemeRepositoryClient` at all) |
| Uploaded Storage assets (both repositories) | Current Builder state / open Project |
| — | Settings / Preferences |
| — | `supabase-config.json` |
| — | Authentication (the anonymous session itself survives a reset — only the Theme *rows* that session owned are gone) |
| — | Database schema (tables, policies) |
| — | Storage buckets (the bucket itself; only objects inside it) |
| — | Application code |

**New RLS policies required** (`supabase/schema.sql`) — the one
capability every earlier draft of this schema deliberately left out
("not part of the Publish → Discover happy flow"): `themes_official_delete`
/`themes_personal_delete` on `public.themes`, and
`theme_assets_official_delete`/`theme_assets_personal_delete` on
`storage.objects` — the same disclosed Official-authorization gap
`themes_official_write`/`_update` already carry (anyone holding the anon
key can reset the Official Repository; real authorization is necessary
future work, not invented here).

### 12.5 Confirmation

Reset requires an explicit confirmation modal (Cancel / Reset
Repositories) before it fires — the exact copy this sprint's own prompt
specified, verbatim.

### 12.6 Verified

- **Schema**: the new delete policies were verified against a real local
  PostgreSQL 16 instance (the same stand-in-Supabase-schema method used
  for every earlier `schema.sql` change) — a fresh run and a second,
  idempotent re-run both succeed with zero errors; functionally, as a
  non-superuser role: an Official row/asset deletes for any caller, a
  Personal row/asset deletes only for its own owner, and — the critical
  negative case — a Personal row/asset belonging to a *different*
  `auth.uid()` is correctly left untouched (confirmed by querying as
  superuser afterward, not merely by the delete reporting zero rows,
  since RLS would also hide that row from a `SELECT` for an unrelated
  reason).
- **UI**: verified via Playwright against this sandbox's real (but
  network-blocked) `supabase-config.json` — Platform Health renders all
  7 indicators, the Builder section reads real `build-info.json` data,
  the Reset confirmation modal opens/closes correctly on Cancel, and
  confirming Reset produces a graceful, disclosed failure message
  (`Failed to fetch dynamically imported module...`) rather than a
  crash — the same class of network-blocked failure every other
  Supabase-touching feature in this app already handles the same way.
  Full live verification against a real, reachable Supabase project is
  the project owner's own local browser's to do, per this sprint's
  standing environment limitation (§8).
- **Regression**: `goldenBuild.js` still passes unchanged — it exercises
  only the local-import path, never `ThemeRepositoryClient`, so this
  sprint's changes (including the `_resolveAssets` recursive-listing
  fix) had zero surface area to regress there; re-run anyway per the
  Working Method's own verification discipline.

---

## 13. WEP Scope Freeze — Import Deferred, Personal-first Repository Model

**A deliberate product decision, not a technical limitation.** The WEP
(Working Enablement Path) proves exactly one complete authoring workflow
before any additional entry point is introduced:

```
Builder Project
      |
      v
Build Theme
      |
      v
Publish to Personal Repository
      |
      v
Author / Test / Iterate
      |
      v
Promote to Official Repository
      |
      v
Studio Consumption
```

### The two WEP repositories

- **Personal Repository** — the author's own working environment. Every
  Theme authored in Builder is published here first. **This is not an
  offline mode or a staging area separate from "real" authoring — it is
  the normal, primary authoring workflow.** A Theme Author builds, tests,
  and iterates against their Personal Repository the same way they'd use
  any other working directory.
- **Official Repository** — the curated, released environment. Only
  Themes that have been authored, published to Personal, tested in
  Studio, and judged ready for public use are **promoted** here.

Builder Projects are editable source, owned by the Builder
(`docs/WORLD_BUILDER_ARCHITECTURE.md`'s LOCK 02, unchanged); Studio
consumes published Themes only, never a Builder Project directly
(unchanged).

### Publish vs. Promote — two different operations, not two labels for one

Per explicit product refinement, the Official-repository action is named
**Promote**, not "Publish to Official" — because it is not the same kind
of operation as Publish, and the rename reflects a real mechanical
difference, not just friendlier wording:

- **Publish** (`ThemeRepositoryClient.publish()`) reads whatever Build
  just produced (`project.lastBuild`) and installs it into a Repository
  — this is how a Theme reaches the *Personal* Repository, and it is the
  only way any new Build output ever reaches either repository.
- **Promote** (`ThemeRepositoryClient.promote(themeId)`, new this
  sprint) creates nothing new. It reads whatever is *already* published
  to the Personal Repository — the Theme row and every one of its
  Storage assets, copied directly via Supabase Storage's own `copy()`
  (no client-side download/re-upload round trip) — and installs that
  exact, already-tested content into the Official Repository. Promoting
  a Theme with no Personal-repository row yet fails with a clear,
  distinguishable reason (`{ok:false, reason:'not_published_to_personal'}`)
  rather than silently building one on the spot, which would defeat the
  entire point of "test in Personal first." A second Promote replaces
  the previously promoted Official copy atomically (assets cleared and
  re-copied, then the row upserted), matching Publish's own established
  "publishing again replaces, no version history" convention.

`tools/world-builder/js/worldBuilderApp.js`'s Publish screen reflects
this ordering directly: a **Publish** section (Personal Repository only
— the primary, first step) followed by a **Promote** section (Official
Repository — a later, dependent step), followed by **Export** (see
below). Nothing about the Repository abstraction itself (§3's four/now
five-function interface), the schema, or Studio's consumption path
changed — `promote()` is implemented entirely in terms of the existing
`ASSET_BUCKET`/RLS policies already granting the anon role read access to
its own Personal-owned objects and write access to the Official prefix
(§9/§11's existing storage policies already cover the source-read +
destination-write `copy()` needs; no schema change was required).

### Import — deferred, not removed

Import (`js/themeEngine.js`'s `importThemeFile`, `js/themeRegistry.js`'s
`importPackage`, `js/creationFlow.js`'s `_wireImportButton`/`_importInput`)
is completely unmodified and fully functional in code. It is hidden from
every active WEP UI surface:

- Studio's Creation Flow Screen 2 no longer renders its header-level
  "⊕ Add New World" button or the World Library row's own "Add New
  World" card — gated behind `js/creationFlow.js`'s `IMPORT_ENABLED`
  constant (`false` for the WEP). An empty World Library row shows an
  honest "No worlds published yet — publish one from World Builder to
  see it here" message instead of a dead-end blank row.
- The original Theme Library modal's own "+ Import Theme" button
  (`index.html`'s `#importThemeBtn`) is hidden via `style="display:none"`
  — not deleted — so `js/themeEngine.js`'s `_wireImportButton()` still
  finds and wires it correctly the instant it's ever un-hidden again.
- World Builder has no Import UI of its own to hide (it has never
  imported Theme packages — only Publish/Promote/Export exist there).

**Future Phase.** Import returns in a later milestone, expected to cover:
`.vtheme` package import, Theme sharing, Marketplace distribution,
Community exchange, local repository synchronization, and backup/restore.
None of these are WEP scope; re-enabling Import when that milestone
begins is a one-line flip of `IMPORT_ENABLED` plus un-hiding
`#importThemeBtn` — no code needs to be rewritten, since nothing was
removed.

### Export — available, not primary

Export (`_downloadDataURL(project.lastBuild.dataURL, ...)`) remains
fully available in World Builder's Publish screen, rendered as its own
section below Publish/Promote. Its stated purpose is portability, backup,
and future interoperability — it is explicitly not part of the primary
WEP authoring workflow (Publish to Personal -> Promote to Official), and
its own card copy says so directly.

### Success criteria (verified)

- The Builder -> Personal Repository -> Studio workflow is reliable —
  unchanged from the Happy Flow Completion Sprint's own verification.
- Promotion from Personal to Official is reliable — verified via a new
  Playwright suite confirming `ThemeRepositoryClient.promote` is exposed,
  the Publish screen's copy/wiring match the WEP flow exactly, and the
  "not published to Personal yet" failure path is distinguishable from a
  generic error.
- Studio consumes published Themes only — unchanged; Import's removal
  from the UI doesn't touch `ThemeRegistry.refreshFromRepository()`,
  which is how Studio discovers Personal/Official Themes regardless of
  this sprint.
- Import is documented but excluded from the active workflow — this
  section, plus inline comments at every hidden entry point.
- `goldenBuild.js`'s full 30-assertion regression suite and the Happy
  Flow Completion Sprint's own 15-assertion suite both pass unchanged —
  this sprint touched UI visibility, one new repository-to-repository
  copy function, and documentation only; no rendering, Build, or
  Validation behavior changed.

## 14. Builder Project Cloud Backup — a deliberate extension beyond "Repositories only"

Every earlier section of this document scoped Supabase to "the Official +
Personal Theme *Repositories* only — not a Builder backend, not a Studio
backend, not a session store." That boundary held until now: `themes`
only ever stored a *compiled* Theme (Build output); the editable World
Builder Project itself (Scenes/Places/Experiences/Frames, everything
authored before a Build ever runs) lived only in this browser's own
`localStorage` (`js/projectStore.js`), with no backup anywhere. A cleared
browser, a different device, or a `localStorage` quota failure could
silently lose in-progress authoring — explicitly disclosed and accepted
as a real gap when it was raised.

**The decision, made explicitly rather than assumed**: extend Supabase's
role to also hold a background copy of the raw, editable Project — a
second, deliberate boundary crossing, not a silent one. Two product
choices were confirmed before building this:

- **Local-primary, cloud backup** — `localStorage` remains the only
  source of truth the Workspace actually reads from and renders
  immediately; the Supabase copy is a best-effort backup pushed in the
  background, never a second read path. If Supabase is unreachable,
  authoring works exactly as it always has.
- **The identity caveat is disclosed, not hidden.** The anonymous
  session (`ThemeRepositoryClient.getSession()`, the same
  `signInAnonymously()` mechanism the Personal Theme Repository already
  uses) is itself a token stored in *this browser's* `localStorage` —
  clearing all browser data loses that identity too, so this does not
  fully solve "my work survives anything." It solves real, narrower
  problems today: `localStorage` quota failures, accidental local-only
  data loss, and resuming on the same browser later. A real account
  system would close the remaining gap; none exists yet. Shipped anyway,
  with the caveat surfaced in the cloud badge's own tooltip, per explicit
  product direction (single-user product today).

### 14.1 `builder_projects` — a new, separate table

Deliberately not folded into `themes`, which has no shape for
pre-compilation authoring data and no reason to grow one — a Builder
Project isn't a portable, shared, referenced-file bundle the way a
compiled Theme is (no `assets` Storage folder, no manifest/theme split);
it's one creator's own private working copy, so `builder_projects` is
one row per Project holding the *exact* JSON shape `ProjectStore`
already persists to `localStorage`, verbatim, in a single `jsonb data`
column. Owner-scoped via `auth.uid()`, the same RLS pattern
`themes_personal_*` already established — no "official" or "shared"
concept exists for a Builder Project at all. See `supabase/schema.sql`'s
own header comment on the table for the exact columns/policies.

### 14.2 `js/services/projectSync.js` — reuses the Repository's client, never a second sign-in

A new, small, standalone module — `ProjectSync.isAvailable()` /
`ProjectSync.push(project)` — deliberately built on top of
`ThemeRepositoryClient.getClient()`/`.getSession()` (two small additions
to that module's own exported API) rather than duplicating the
config-fetch/Supabase-client-init/anonymous-sign-in sequence a second
time: both features are, underneath, the same one Supabase project and
the same one anonymous session. `push()` never throws — every failure
(not configured, network, RLS) resolves `{ok:false, error}`, matching
every other `ThemeRepositoryClient` method's own "missing config is a
normal, handled state" discipline.

### 14.3 The cloud badge — a second, honest indicator, not a replacement for the local one

`worldBuilderApp.js`'s pre-existing 🟢/🟠/🔴 "All Changes Saved" badge
already told the truth about the *local* write (Sprint B2.0.6, hardened
by AV-009) — that indicator is unchanged. A second badge,
`#wb-cloud-sync`, reports the background Supabase copy specifically:
hidden until the Repository's configured state is actually known, then
one of unavailable (Supabase not configured at all) / pending (push in
flight) / synced (confirmed) / error (configured, but the push failed —
disclosed, not silently swallowed). Debounced 2 seconds off the trailing
edge of edits (separately from the local save's own 600ms display
debounce), since a network push on every keystroke would just queue
redundant requests.

### 14.4 The Save button — removed, not just demoted

`_persist()` already saved to `localStorage` synchronously on every
edit; the header's own "💾 Save" button re-ran the identical write and
existed only "as an explicit, user-visible confirmation that nothing is
pending" (its own pre-existing code comment). With the local badge
already reporting that truth immediately and the new cloud badge now
reporting the *additional* truth this ticket asked for, no click-driven
action added anything real — removed outright rather than left as
inert reassurance. `index.html`, `worldBuilderApp.js`, and
`world-builder.css` all had their Save-button-specific code/markup/rules
removed together; the local-save badge's CSS was generalized from
id-scoped selectors to a shared `.wb-save-dot-glyph`/`.wb-save-text`
class pair so the new cloud badge could reuse the exact same dirty/
saved/error styling without duplicating it.

### 14.5 Verified

`node --check` on all three touched JS files; a Playwright pass
confirming the Save button no longer exists in the DOM, the local save
badge continues to work completely independently of the cloud one, and
— against this sandbox's own real (but network-blocked)
`supabase-config.json` — the cloud badge correctly distinguishes
"configured but unreachable" (a real attempted push that fails,
reported honestly as "Cloud backup failed") from what "not configured
at all" would show, never silently lying about success either way;
`goldenBuild.js`'s full 30-assertion suite passes unchanged. Live
end-to-end verification against a real, reachable Supabase project
(confirming a pushed row actually lands in `builder_projects` and
round-trips) is explicitly deferred to the project owner's own local
browser, matching every other Supabase-touching feature's own disclosed
verification limits in this sandboxed environment.

## 15. Studio Reads Official Only

Studio's `ThemeRegistry.refreshFromRepository()` (`js/themeRegistry.js`)
originally discovered and registered themes from *every* repository
`ThemeRepositoryClient.discover()` returned — Official and Personal
alike — per §11's original "Studio should never know where a theme
originated" framing. In practice this meant Personal Repository themes
(an author's own working/testing drafts, published there as the normal
first step of the WEP workflow before Promote) appeared in Studio's
World Library indistinguishably from finished, curated Official
content — confusing for a reader-facing app, and not what the
Personal/Official split was for.

Fixed by filtering `refreshFromRepository()`'s repository list to
`repo.kind === 'official'` before listing/loading. Studio now only ever
discovers Official Repository themes; Personal Repository themes never
reach it, regardless of how many exist or what they're named. World
Builder (`ThemeRepositoryClient.discover()`/`.list()` called directly)
and Platform Status (`getStats()`) are unaffected — both still see
Personal, since authoring/status tooling is a different audience than
the reader-facing app `refreshFromRepository()` serves.

Verified via Playwright: a stubbed `ThemeRepositoryClient` returning one
Official theme and two Personal themes registers only the Official one
after `refreshFromRepository()` runs; both `goldenBuild.js` suites
(30/30 each) pass unchanged.
