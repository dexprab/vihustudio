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
`docs/THEME_CONTRACT.md` §7 already establishes) is populated with the
Storage object's **public URL** (Official — public-read bucket) or a
**signed URL** (Personal — access-controlled, see §4) rather than a data
URI. This is the reason this isn't a breaking change to the consumption
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
Both **Publish to Official Themes** and **Publish to My Themes** (a new
4th Publish card, alongside the pre-existing Export Package and the
still-inert Community World) call it with `'official'`/`'personal'`
respectively. It:

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
  `url`/`anonKey` fields. **`supabase-config.json`** (gitignored) is
  where real values go. A Supabase **anon/public key is designed to be
  public** — the project's Row Level Security policies, not the key's
  secrecy, are what actually protect data — so committing a *filled-in*
  config is not a secrets leak the way a `service_role` key would be;
  it is gitignored anyway so each deployment can point at its own
  project without merge noise, and so a fork or PR never accidentally
  ships a specific project's URL.
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
