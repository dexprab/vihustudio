# World Card Platform v1

**Sprint:** World Card Platform v1 — Implementation Sprint.
**Status:** Canonical for the v1 shipped scope (Builder Cards only).
Maintain going forward the same way `docs/THEME_REPOSITORY_ARCHITECTURE.md`
is maintained for the repository layer this feature sits on top of.
**Scope:** This document does not restate `docs/THEME_REPOSITORY_ARCHITECTURE.md`
(the Personal/Official Theme Repository model a redeemed Card grants
access into) or `docs/THEME_CONTRACT.md`/`docs/THEME_PROJECT_SPEC.md`
(the compiled Theme shape a Card ultimately unlocks). This document is
authoritative for the Card mechanic itself: what a Card is, how it's
minted, how it's redeemed, and where each piece of that lives.

---

## 1. What a Card is

A Card is a shareable, time-boxed unlock. A Theme Author mints one
against a Theme they've already Published to their **Personal**
Repository (see `docs/THEME_REPOSITORY_ARCHITECTURE.md` §13's
Personal/Official model — a Card never targets the Official Repository,
since that content is already open to everyone). Whoever redeems the
Card gets that Theme discoverable in Creator's Screen 2 World Library
for the exact number of tries and/or duration the Author set — never a
permanent copy, never a Publish/Promote of the Author's own Theme.

Redemption is a **Pattern Match** puzzle: every Card is minted with a
randomized placement of a real, named constellation shape on a 10×10
star grid. The redeemer taps the same shape they see on the physical/
shared card (a screenshot, a print, a spoken description — external to
the app; Creator's own redeem widget deliberately shows no local
reference, see §4). A typed fallback ("ORION-00125") exists for anyone
who can't tap accurately or is redeeming from a written note.

### 1.1 Card type family (reserved vocabulary)

The approved design names six card types: **Builder** (theme-preview —
the only one implemented in v1), Creator, Unlock, Event, Achievement,
Classroom. `supabase/schema.sql`'s `cards.card_type` CHECK constraint
already lists all six so no future sprint needs a schema migration to
add one — but `js/cardPlatform.js`'s `generate()`/`redeem()` both
short-circuit to `{ok:false, reason:'unsupported_type'}` for anything
but `'builder'`. Building out a second type is future work with no
schema change required, only new dispatch logic in `redeem()`.

### 1.2 Uniqueness model — a real design correction, not an afterthought

A naive schema might make the constellation's *name* the redemption
secret. That was tried and rejected during design: it would cap the
whole platform at 5 cards (one per curated constellation) before names
had to repeat, and a repeated name is indistinguishable between two
different Cards.

The actual model:

- `constellation` (e.g. `'ORION'`) is a **reusable flavor label**. Many
  Cards can be "Orion." It exists for the typed-fallback path and for
  display, never for redemption uniqueness.
- `pattern` — the Card's own **randomly placed** coordinates (rotation +
  optional mirror + translation applied to the constellation's base
  shape, `js/cardPlatform.js`'s `_placeConstellation()`) — is what's
  actually unique per Card, and what the tap-to-redeem path matches
  directly, with no name involved at all.
- `code` (DB-generated, `'BC-' || lpad(serial_no,5,'0')`) paired with
  `constellation` is what the typed-fallback path matches, since a bare
  name alone can't disambiguate between two different Orion cards.

### 1.3 Rarity — always derived, never authored directly

`js/cardPlatform.js`'s `computeRarity(tries, hours)` is a pure function
of the Author's own chosen `maxTries`/`durationHours` (`Infinity` for
unlimited/forever), ported verbatim from the validated wireframe:

| tries / duration                    | rarity      |
|--------------------------------------|-------------|
| unlimited tries **and** forever      | 🟡 legendary |
| ≥10 tries or ≥168h (7 days)          | 🟣 epic      |
| ≥5 tries or ≥24h (1 day)             | 🔵 rare      |
| ≥2 tries or ≥4h                      | 🟢 uncommon  |
| everything else                      | ⚪ common    |

An Author never picks a rarity tile directly — the Generate a Card
panel shows a live preview computed from the tries/duration fields as
they're edited.

---

## 2. Architecture boundary

Per the design session's own explicit decision, card logic lives in
exactly one shared module, `js/cardPlatform.js` (repo root, sibling to
`js/themeRepositoryClient.js`) — **neither** World Builder nor Creator
owns any card-specific business logic. Both are thin UI hooks: they
call `CardPlatform.generate()`/`.listMine()`/`.revoke()`/`.redeem()` and
render the results. `js/cardPlatform.js` itself never touches the DOM.

```
World Builder (Welcome screen)      Creator (Screen 2)
        |                                   |
        |  generate/listMine/revoke         |  redeem
        v                                   v
              js/cardPlatform.js
                      |
        ThemeRepositoryClient.getClient()/.getSession()
        (reused, never a second config fetch or sign-in —
         the same convention js/services/projectSync.js
         already established)
                      |
                 Supabase: cards / card_redemptions / redeem_card() RPC
```

`js/cardPlatform.js` mirrors `js/themeRepositoryClient.js`'s own
structural conventions exactly: an IIFE, `'use strict'`, ES5 function
style (no arrow functions/classes), a single `window.CardPlatform = api`
export in a `try/catch`, and the same "never throw — resolve
`{ok:false,...}` on any failure" discipline every function in this
codebase's Supabase-touching modules already follows.

---

## 3. Where card generation lives — World Builder's Welcome screen

Card generation is **not** a Publish-screen step. It's a `🎴 Generate a
Card` icon action on a project card in "My World Projects" — the
approved design's own placement: a Card is a shareable object built
from an *already-published* World, not a step in publishing it.

- Disabled by default (`.wb-project-card-btn-card:disabled`) — there is
  no synchronous "is this Personal-published" signal available at
  render time. `_annotateProjectBadges()` (`tools/world-builder-v2/js/worldBuilderApp.js`)
  already does the async Personal/Official Repository check for the
  card's status pill; it enables the same button once it confirms
  `personalIds.has(worldId)` — one added line, no new async call.
- Clicking it opens `_showCardPanel(project)`, a standalone modal
  reusing the exact `_showInfoModal()` shell already proven (by the
  Sign In form, before this sprint) to host a real, live form rather
  than only read-only content — deliberately not a second modal
  mechanism.
- The panel: Label (optional), Max Tries (or Unlimited), Duration in
  hours (or Forever), a live rarity preview, a Generate button, and a
  re-fetched (never optimistically-appended, matching this codebase's
  own "refetch after mutation" discipline) list of every Card minted
  for this World with a per-row Revoke.
- Revoke is soft — `cards.revoked_at`, never a hard delete — and blocks
  *new* redemptions only. It does not retroactively pull back access
  someone already redeemed (see §5.3).

---

## 4. Where redemption lives — Creator Screen 2

Redemption is **not** a separate app or screen. It's a collapsed-by-
default widget appended to Screen 2's sources panel, directly beneath
the existing World Library row (`js/creationFlow.js`'s
`_buildCardRedeemWidget()`, inserted right after the World Library
`_sourceGroup()` call).

- `🔮 Have a World Card? Redeem it here` toggles open a real, numbered 10×10
  tap grid (ported near-verbatim from the validated wireframe's own
  `buildLabeledGrid`/`centerOfCell` mechanics): tap a star to place it,
  tap it again to undo, a live connecting line redraws after every
  single tap.
- The wireframe's own demo-only "reference" card-back column
  (showing the pattern being redeemed, for the demo's own benefit) is
  **deliberately dropped** in the real widget. In production there is
  no local copy of a Card's pattern to show a reference for — the
  physical/shared card itself (a screenshot, a print, a spoken word) is
  the real-world reference, external to this app.
- Redeem calls `CardPlatform.redeem({pattern:[[r,c],...]})`. A typed
  fallback (`Prefer to type the magic word instead?`) calls
  `CardPlatform.redeem({typed:'ORION-00125'})` — normalized dash/space/
  case-insensitively server-side (see §5.2).
- A wrong pattern shows a plain error and clears the board — no
  lockout, no attempt counter shown to the redeemer beyond what the
  Card's own `tries_remaining` communicates on success.
- A successful redemption calls `CreationFlow.refreshWorldScreen()` — a
  new exported function that re-invokes Screen 2 for whichever Creation
  Type is currently active (`_currentScreenType`, hoisted from
  `_renderWorldScreen(type)`'s own closure-local param). This is the
  actual mechanism that makes the newly-unlocked World appear in the
  World Library row with no page reload and no caller-side bookkeeping
  — it mirrors `onImported()`'s own pre-existing "just call
  `_renderWorldScreen(type)` again" pattern, generalized into a stable,
  externally-callable name.

---

## 5. The redeem_card() RPC — the platform's first

### 5.1 Why an RPC at all

No RLS SELECT policy can express "let a client compare against
`pattern`/`code` without ever reading the stored value" — any policy
permissive enough to compare is permissive enough to leak. `cards` has
**deliberately zero anon/public SELECT policy at all** — that absence
is the actual security mechanism. `SECURITY DEFINER` is the only
mechanism that lets server-side code read the secret columns for a
comparison; `redeem_card(p_pattern jsonb, p_typed_code text)` is that
function, and — as of this sprint — the first `SECURITY DEFINER`/RPC
function anywhere in this codebase.

### 5.2 What it does

1. Requires an authenticated caller (`auth.uid()`, including an
   anonymous Supabase session — the same identity model
   `docs/THEME_REPOSITORY_ARCHITECTURE.md` already establishes for
   Personal Repository access).
2. Given `p_pattern`, canonicalizes it via a small immutable
   `_card_platform_sort_pattern()` helper (a `jsonb_agg(... order by
   ...)` sort) and matches it as a **set** against every non-revoked
   Card's own canonicalized `pattern` — order-independent, since the
   redeemer's own tap order need not match the Card's original mint
   order.
3. Given `p_typed_code`, normalizes it (`upper(regexp_replace(v,
   '[\s-]+', '', 'g'))`) and matches `upper(constellation ||
   lpad(serial_no::text,5,'0'))` — so `"ORION-00125"`, `"orion 00125"`,
   and `"Orion00125"` all resolve to the same Card.
4. On a match: checks `revoked_at is null` and `tries_used <
   max_tries` (when `max_tries` isn't null), atomically increments
   `tries_used`, inserts one `card_redemptions` row (`expires_at`
   computed from `duration_seconds`, or null for "forever"), and
   returns `{ok:true, card_type, target_repository, target_theme_id,
   target_owner_id, label, rarity, expires_at, tries_remaining}`.
5. On any failure: `{ok:false, reason}`, where `reason` is one of
   `not_authenticated` / `no_input` / `no_match` / `exhausted` — never
   any of the tables' real contents.

**The response never includes `pattern`, `code`, `serial_no`, or
`constellation`** on any branch — verified mechanically (parsing the
function body's own `jsonb_build_object(...)` calls) in this sprint's
verification script, not merely asserted. A redeemer's own client never
ends up holding the secret it just consumed.

### 5.3 The cross-owner grant this RPC's own success depends on

A redeemer is never the Personal Theme's owner. Without extending
access, `redeem_card()` could succeed while RLS still returned zero
rows for the actual Theme content — redemption would be theater. Two
existing, previously owner-only policies (`themes_personal_select`,
`theme_assets_personal_read`, both established in
`docs/THEME_REPOSITORY_ARCHITECTURE.md`) gained additive `or exists
(...)` clauses: a caller may also read a Personal Theme row/asset when
a live, unexpired `card_redemptions` row (joined through `cards`)
proves they redeemed a Card for it. Default behavior for every
non-redeemed row is completely unchanged. There is no corresponding
grant *revocation* — Revoke (§3) blocks new redemptions but does not
retroactively narrow an already-granted `card_redemptions` row's own
access, matching the design's own "revoke makes the card unredeemable"
wording (about the Card, not about a session that already redeemed
it).

---

## 6. Expiry — lazy, read-time pruning, no timer

`js/themeRegistry.js` had no "registered but time-limited" theme
concept before this sprint. Resolved without adding a timer/interval
anywhere:

- A successful redemption calls the new exported
  `ThemeRegistry.registerRedeemedTheme(pkg, opts)`, which validates via
  the existing `validatePackage()` and registers through the same
  private `_setImported()` every other registration path already uses
  — a redeemed theme is indistinguishable from a locally-imported one
  to `list()`/`getCatalog()`/`get()`, except it's additionally stamped
  `redeemed:true` / `redeemedExpiresAt` / `redeemedOwnerId`.
- A new private `_pruneExpiredRedeemed()` scans only entries marked
  `redeemed:true` (O(redeemed-count), never O(registry-size)) and is
  called at the top of every function that reads `_registry` directly
  (`list`, `getCatalog`, `hasTheme`, `getRecord`) — matching this
  module's own pre-existing "always recompute on read, no caching to
  invalidate" convention exactly.
- **Deliberately not persisted via `_persistImported()`** — a redeemed
  theme's actual content is never shadow-cached into
  `vihu.themeRegistry.imported.v1`, the same "Supabase (here: the
  owner's own Personal Repository) is the source of truth" discipline
  `refreshFromRepository()` already documents. Instead, a small,
  separate key — `vihu.themeRegistry.redeemedGrants.v1` — persists
  only `{themeId, ownerId, expiresAt}` per redeemed grant, never theme
  content.
- Boot-time rehydration (`_rehydrateRedeemed()`, called right after the
  existing `_loadImported()`) reads that small key, drops anything
  already expired, and re-fetches survivors fresh via
  `ThemeRepositoryClient.loadPersonalByOwner(ownerId, themeId)` before
  re-registering them — mirroring `_loadImported()`'s own tolerant,
  swallow-one-failure-never-block-boot pattern.

`ThemeRepositoryClient.loadPersonalByOwner(ownerId, themeId)` is one
new function (`js/themeRepositoryClient.js`), added beside the
existing `load()` rather than changing it — `load()`'s own hardcoded
"always the caller's own uid" scoping stays correct for its existing
callers; a redeemer loading *someone else's* Personal Theme is a
genuinely different call shape, reusing the same private
`_resolveAssets()` helper as-is.

---

## 6.1 Card Art — front/back visual, download, print

Turning a minted Card's `constellation`/`pattern`/`code`/`rarity`/
`label`/`createdAt` — plus the World's own `name`/`icon`/Hero-Image —
into a real, downloadable, printable card artifact. A 🎴 **View Card**
button on each minted-card row (`tools/world-builder-v2/js/worldBuilderApp.js`)
draws a front and a back onto two `<canvas>` elements at print-usable
resolution (700×980, poker-card ratio) using only Canvas 2D primitives
— no illustration-generation dependency, no fabricated "Creator"
credit, since neither exists as real data anywhere in this codebase.
Front: the World's own Hero Image (or a rarity-tinted gradient +
its icon glyph when none exists), a Builder-Card type pill, the
World's name and the Card's label, a bottom bar pairing a rarity-
coloured pill with the real code. Back: the Card's own actual
`pattern` plotted as connected glowing stars (not a generic
placeholder — verified via a real pixel sample at one of the card's
own seeded coordinates), the constellation name, the human-readable
code, and a tagline. Download reuses the existing `_downloadDataURL()`
helper against each canvas's `toDataURL('image/png')`; Print builds a
temporary off-screen sheet sized to the card's real physical
dimensions (2.5in × 3.5in) via a `@media print` block, torn down after
printing. No schema/RPC/`js/cardPlatform.js` change — purely additive
World Builder UI reading data the platform already had.

---

## 6.2 Not a World Card — Magic Card identities are a separate system

A Magic Card (`js/magicCard.js`/`js/magicCardUI.js`, root Creator, see
CLAUDE.md's own "Magic Card Identity Evolution" sprint entries) is
**not** an instance of `card_type='creator'` — the reserved-but-unused
enum slot §1.1 names above. It is a deliberately different, parallel
system with its own tables (`magic_card_identities`,
`magic_card_recalls`) and its own RPC (`recall_magic_card`), not a
seventh redemption context bolted onto `cards`/`redeem_card()`.

The two share a *technique* (constellation-pattern placement, tap-to-
match redemption UI, a `SECURITY DEFINER` RPC that never echoes the
secret back) but solve genuinely different problems:

- A **World Card** is *shareable and disposable* — many people can hold
  a copy of the same physical/printed card, it has tries and an
  expiry, and redeeming it grants time-boxed access to *someone else's*
  published Theme. The Card itself has no owner-facing identity beyond
  the Theme it unlocks.
- A **Magic Card identity** is *personal and permanent* — it belongs to
  exactly one child, is minted once (at their first Publish, via the
  Magic Card Identity Evolution "Awakening" ceremony), and *is* that
  child's own recognition mechanism across devices — a signinless
  sign-in, not an unlock. Redeeming ("recalling") it doesn't grant
  access to someone else's content; it re-establishes "this device
  recognizes you" and pulls *the recaller's own* previously-claimed
  projects (`creator_projects`, mirroring `builder_projects`) onto the
  new device as fresh, independent local copies.

Practical consequence: `magic_card_identities`/`magic_card_recalls`/
`recall_magic_card()` are their own tables/RPC in
`supabase/schema.sql`, not rows inside `cards`/`card_redemptions`
carrying `card_type='creator'`. If a future sprint ever does build out
the real Creator card type, it would be a *third*, still-separate
thing — "share a temporary invite into your world" — not a rename of
either of the two systems above.

**Companion Canon V2** (`docs/COMPANION_CANON.md`) extends the Magic
Card identity with a third dimension beyond nickname/pattern: the
**Creator-Companion Bond** — `companion_id`/`companion_name`/
`companion_species`, set once at claim (or inherited verbatim by a
cross-device recall, never re-rolled) and returned by
`recall_magic_card()`'s own success response. This is a Magic-Card-only
concept with no World Card equivalent — a World Card unlocks a Theme,
it has no notion of a bonded companion at all.

## 7. What's intentionally deferred

- **The other five card types** (Creator/Unlock/Event/Achievement/
  Classroom) — reserved vocabulary in the schema's CHECK constraints
  only; `generate()`/`redeem()` both stay inert for them until a future
  sprint builds real dispatch logic.
- **Retroactive grant revocation** — Revoke narrows future redemptions
  only (§5.3); pulling back an already-live `card_redemptions` grant in
  real time is a materially larger feature (session invalidation) that
  wasn't requested and isn't built here.
- **A live end-to-end RPC verification against a real Postgres
  instance** — this sandbox has no network path to Supabase, the same
  standing limitation every earlier Supabase-touching sprint in this
  codebase has disclosed. `supabase/schema.sql`'s additions are a
  disclosed, unexecuted draft; this sprint's own verification script
  covers UI wiring and the RPC's static return-shape (leak-proofing)
  against real code, not a live call.

---

## 8. Critical files

- `supabase/schema.sql` — `cards`, `card_redemptions`,
  `redeem_card()` RPC, the cross-owner grant extension (draft, not
  executed).
- `js/cardPlatform.js` — the shared card platform module (new).
- `js/themeRepositoryClient.js` — `+loadPersonalByOwner()`.
- `js/themeRegistry.js` — `+registerRedeemedTheme()`,
  `+_pruneExpiredRedeemed()`, `+_rehydrateRedeemed()`.
- `tools/world-builder-v2/js/worldBuilderApp.js` +
  `tools/world-builder-v2/index.html` +
  `tools/world-builder-v2/css/world-builder.css` — Generate a Card.
- `js/creationFlow.js` + `index.html` + `css/style.css` — the Redeem
  widget.
