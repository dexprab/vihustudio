# Theme Repository Architecture

**Sprint:** Platform Hardening Sprint — Repository Architecture Transition
(Phase 1 — Repository Foundation).
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

| Column | Type | Meaning |
|---|---|---|
| `id` | `uuid`, PK | Surrogate key — a repository row's own identity, never exposed to Studio. |
| `repository` | `text` | `'official'` \| `'personal'` — which repository this row belongs to. |
| `owner_id` | `text`, not null | `''` (empty-string sentinel) for Official; the authenticated anonymous user's id (§4) for Personal. A real `NULL` is deliberately avoided here — Postgres treats every `NULL` as distinct from every other `NULL` for uniqueness purposes, which would silently defeat the `(repository, owner_id, theme_id)` uniqueness constraint below for every Official row. |
| `theme_id` | `text` | The Theme's own `manifest.id` (kebab-case, per `docs/THEME_PROJECT_SPEC.md` §10). |
| `name` | `text` | Denormalized from `manifest.name`, for listing without decoding `manifest`. |
| `version` | `text` | Denormalized from `manifest.version`. |
| `manifest` | `jsonb` | The complete manifest object, exactly as `docs/VTHEME_PACKAGE_SPEC.md` §Manifest defines it. |
| `theme` | `jsonb` | The complete theme object (`layouts`/`frameVariations`/`layerPack`/`representations`/`supportedCreationTypes`/etc.) — **without** embedded asset data; see §2.2. |
| `created_at` / `updated_at` | `timestamptz` | Standard provenance. |

A unique constraint on `(repository, owner_id, theme_id)` is the real
identity key — the same Theme id may exist once in Official and, quite
separately, once in one author's own Personal repository; there is no
global-uniqueness requirement across repositories, since Studio always
resolves a Theme through one specific repository, never by bare id
alone (this is the concrete meaning of "the source becomes irrelevant"
in §4 below — irrelevant to *how Studio renders it*, not to *how it's
addressed*).

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

## 5. What Builder does in this phase (foundation only)

Nothing yet. Per the sprint's own Phase 1 scope ("Do not redesign
Builder or Studio"), this phase does not change `publishToOfficialThemes()`
or any other World Builder call site. `js/themeRepositoryClient.js`
(§6) is added as new, standalone, uncalled code — proven correct on its
own terms (a small manual verification script, not a Playwright
end-to-end pass, since nothing in the product calls it yet) — so Phase
2 has a real, working repository client to wire Publish into, rather
than building the wiring and the backend in the same step.

---

## 6. Implementation notes (this phase's actual deliverable)

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
  two Supabase tables/bucket conventions from §2. Not yet imported by
  `index.html` or any World Builder screen.
- **Not implemented this phase:** the actual Supabase project (needs
  real credentials only a human can create), the SQL migration that
  creates the `themes` table + RLS policies + Storage bucket (drafted
  in `supabase/schema.sql` for a human to run once a project exists),
  and any Builder/Studio call site.

---

## 7. Explicitly deferred (per the sprint's Out of Scope list)

- Publish replacement (Phase 2), `ThemeRegistry` refactor (Phase 3),
  Studio consumption changes (Phase 4), full happy-flow validation
  (Phase 5).
- The `.vtheme` ZIP transport/export format (a separate, later sprint,
  per the sprint's own instruction — this document's §2.2 Storage
  design is a repository concept, deliberately not conflated with the
  file-transport question).
- Marketplace, Community, Collaboration, Theme versioning beyond
  `manifest.version`'s existing informational field.
