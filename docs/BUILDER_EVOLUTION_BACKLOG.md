# Builder Evolution Backlog

**Status:** Living backlog. Every entry here is a *proposal*, not a plan —
nothing in this document is scheduled, approved for implementation, or
implied as scope for any in-progress sprint (Authoring Validation, Museum
Theme Completion, or otherwise). An entry moves out of "Proposed" only by
an explicit, separate decision to build it, at which point that decision
gets its own sprint/slice documentation the way every other Builder V2 /
Engine V2 change in this repository already does.
**Scope:** Captures product evolutions surfaced while *using* the Builder
for real authoring (Museum Theme and beyond) that are genuine future
capabilities, not immediate bugs — distinct from `docs/AUTHORING_FINDINGS.md`,
which is a retrospective log of usability gaps *fixed or found* during a
specific sprint's authoring pass. This document is forward-looking and
does not get resolved by fixing something; it gets resolved by a future,
separately-scoped implementation decision.
**Not this document:** Engine V2 architecture (`docs/ENGINE_V2_CANON.md`,
`docs/ENGINE_V2_SCENE_MODEL.md`) and Builder V2 product design
(`docs/BUILDER_V2_VISION.md` and its sibling documents) remain frozen and
are not amended by anything proposed here. An entry that would require
changing either is flagged as such in its own "Architecture impact"
field, precisely so it's clear that entry needs an architecture decision
first, not just an implementation slice.

---

## How to read an entry

Each entry carries:

| Field | Meaning |
|---|---|
| **Status** | `Proposed` (default) → `Accepted` (a real decision was made to build it, with its own follow-up documentation) → `Implemented` (done, cross-referenced to the sprint that built it) → `Rejected` (considered and explicitly not pursued, with why) |
| **Priority** | A relative signal for whichever future sprint picks this backlog up — not a commitment to when |
| **Phase** | Which broader effort this belongs to, so entries aren't picked up out of order relative to work already in flight |
| **Architecture impact** | Whether pursuing this would touch Engine V2 Canon, the Scene Model, or frozen Builder V2 documents — if yes, that decision must happen first, separately, the same way every other architecture change in this repository has (see `docs/ENGINE_V2_SCENE_MODEL.md`'s own Change History for the pattern) |

---

## EV-001 — Rich Frame Layer Host

**Status:** Proposed
**Priority:** High
**Phase:** Builder Evolution (Post Museum Theme Validation)
**Architecture impact:** Likely yes — see "Open questions" below. Not
decided here; this entry documents the proposal, not the decision.

### Background

AV-003 validated the current Frame model end to end: every one of its
eight fields (Wall Tone, Border Color, Frame Thickness, Shadow, Corner
Radius, Inset, Mat Width, Default Margin) persists correctly and now
renders correctly in both Working View and Runtime Preview. This is
sufficient for the Museum Theme — a Frame described entirely by styling
properties resolved into drawn canvas bands.

Future themes (Comic, Polaroid, Certificate, Scrapbook, Fantasy, Holiday,
and others not yet named) will need reusable *visual content* that
belongs to the Frame itself — a corner sticker, a certificate seal, a
patterned border texture, a title treatment — rather than to the Holder.
The current Frame model has no way to express this: it is a fixed set of
styling properties, not a container for arbitrary authored content.

### Proposal

Evolve Frame from *properties only* into a **Layer Host**:

```
Frame
  Properties (unchanged — Wall Tone, Border Color, Thickness, Shadow,
              Corner Radius, Inset, Mat Width, Default Margin)
  +
  Holder (unchanged — the Story Author's content, untouched by this)
  +
  Optional Layers (new — Background / Image / Decoration / Text / Overlay)
```

The optional Layers belong to the Frame, not the Holder — they are
Theme-Author-authored visual content that ships *with* a Frame choice
(e.g., picking "Certificate Gold" could bring a corner seal Layer along
with it), never user content and never something a Story Author adds to
directly.

### Design principles

- **Holder remains the sole owner of user content.** Nothing about this
  proposal changes what a Holder is or does.
- **Frame never owns the artwork itself.** A Frame's Layers decorate
  around/behind/above the Holder; they never become or replace the
  Primary Element.
- **Layers are optional.** A Frame with zero Layers behaves exactly as
  today — this is additive, not a new requirement on every Frame.
- **Existing themes remain 100% backward compatible.** The Museum Theme,
  and any Frame authored before this lands, must continue rendering
  identically with no migration step.
- **Reuse the common Layer architecture wherever possible.** Scene Layers
  (`kind: 'fill' | 'decoration' | 'text'`, Scene Model §2/§3) already
  define exactly this vocabulary for Scene-level content; a Frame Layer
  Host should reuse that shape and meaning rather than inventing a
  parallel one.
- **Avoid a Frame-specific rendering model if the existing Layer
  architecture can be extended.** The bar for introducing new rendering
  concepts here is the same bar every Engine V2 decision in this
  repository has already been held to.

### Open questions (not resolved by this entry)

- Does a Frame Layer read from the *same* `SceneLayer` shape Scene
  Layers already use (Scene Model §3's `SceneLayer` interface), or does
  it need its own type? Reusing the existing shape is the design
  principle above's own preference, but Frame Layers are scoped to a
  Theme Asset (reusable across many Holders/Scenes) rather than to one
  Scene — that difference in *ownership*, not shape, is exactly the kind
  of question Scene Model §7's own still-open "Holder Layers and a
  reserved Content Layer" item already flags as unresolved. This entry
  does not resolve either question; it names them so a future decision
  pass has to actually answer them, not rediscover them.
- Where would Frame Layers be authored — a new Frames-screen sub-panel,
  or reuse of the Scenes screen's existing Decorations/Text authoring UI
  pointed at a Frame instead of a Scene?
- How does a Frame Layer composite relative to the Holder's own concentric
  bands (wall margin → border → mat → content, AV-003) — above the mat,
  below the border, or configurable per Layer?

None of these are answered here on purpose — per this entry's own
"Deferred" status, resolving them is exactly the work of a future
Builder Evolution decision pass, not this backlog entry.

### Deferred

This proposal is intentionally deferred. Current priority remains:

```
Authoring Validation
      ↓
Museum Theme Completion
```

This proposal will be revisited after Builder V2 authoring validation is
complete.

---

## EV-003 — Theme Expression System

**Status:** Proposed
**Priority:** Medium
**Phase:** Builder Evolution (Post Museum Theme Validation)
**Architecture impact:** No Engine V2 change — the entry's own framing
is explicit that this does not affect Engine V2 and does not block
Museum Theme acceptance. Any Builder-side change is additive to the
existing insertion mechanism (see "Architecture" below), not a new one.

### Background

AV-011 added inline emoji authoring by reusing `js/emojiPicker.js` — a
small, generic, already-existing module (also used by the main Studio
app's Text Element fields) wrapping a text field with a toggle button
and a fixed 40-emoji grid. It works, and it satisfied AV-011's own
acceptance criteria in full. But validating it against real Museum
Theme authoring surfaced a product gap distinct from a bug: the picker
is a generic Unicode emoji utility, unaware of which Theme is active,
while a Theme in this repository's own architecture already carries a
specific visual identity (Frame Variations, Layer Packs, wall tones,
mood/purpose metadata) that a text-insertion affordance currently has
no way to reflect.

### Proposal

Evolve the existing emoji picker into a **Theme Expression System** — a
unified insertion palette capable of surfacing several content
categories, not just raw emoji:

```
Expression Palette
  Theme Decorations   (the active Theme's own decoration assets)
  Theme Symbols       (a Theme-curated icon/glyph set)
  Theme Icons         (functional glyphs matching the Theme's style)
  Curated Emojis      (a Theme-scoped subset of Unicode emoji, not the
                       full catalogue)
  Recently Used       (author's own recent insertions)
  Story Favorites     (author-starred, reused across a World)
```

The active Theme decides what populates the default view — e.g. a
Museum Theme surfacing gallery/nature/heart symbols, a Space Theme
surfacing rockets/planets/stars, a Fairy Theme surfacing
fairies/magic/creatures (see the ticket's own worked examples). A Theme
with no curated set defined falls back to today's generic emoji grid —
this must remain a strict superset of AV-011's shipped behaviour, never
a regression for a Theme that hasn't opted in.

### Design principles

- **One insertion mechanism, not several.** The existing
  `EmojiPicker.wrap(el)` call site (the Text Layer's "Words" field) is
  the single place this evolves from — a Theme Symbol or Decoration
  insertion must dispatch through the same `input`-event path AV-011
  already established, never a second, parallel insertion API.
- **Themes gain a curated vocabulary, not a new asset system.** "Theme
  Symbols"/"Theme Icons" should be evaluated against the Theme Asset
  categories `docs/THEME_PROJECT_SPEC.md` already defines (Frame
  Variations, Layer Packs, Decoration Packs) before inventing a new
  asset kind — the same "reuse before extending" bar EV-001 was held
  to.
- **Curated, not exhaustive.** The product principle is explicit:
  authors should never have to browse the full Unicode catalogue to
  find a Theme-appropriate symbol. A curated default view is the whole
  point, not an optional filter.
- **Falls back safely.** A Theme that defines no curated set is
  unaffected — the palette must degrade to AV-011's current generic
  grid, never to an empty or broken state.
- **Builder-only UI evolution.** Recently Used / Story Favorites are
  Builder-side authoring conveniences (comparable to `_saveEditingContext`'s
  navigation-memory pattern from AV-008 — real, but never part of the
  Scene Model or Engine V2's own object graph).

### Open questions (not resolved by this entry)

- Where does a Theme's curated vocabulary live — a new field on the
  Theme Project Contract (sibling to `frameVariations`/`layerPacks`),
  or a lighter-weight manifest list that doesn't require full Theme
  Asset tooling?
- Do "Theme Symbols"/"Theme Icons" need to be new authored image assets
  (like Decoration Pack entries already are), or can they stay
  Unicode-emoji-based (a curated *subset*, not new artwork) for a first
  pass — the same "no technical constraint forced a new asset concept"
  question EV-002 already had to answer once for representative
  artwork?
- Should "Story Favorites" persist per-World (Builder-owned, alongside
  `ProjectStore`) or per-author across Worlds? Distinct persistence and
  privacy implications either way.
- How much of "Builder UX Evolution"'s list (hover feedback, auto-close,
  search, spacing polish) is a visual-only change to the existing panel
  versus something that needs the categorised-content model above to
  exist first?

None of these are answered here on purpose — resolving them is the work
of a future decision pass, not this backlog entry.

### Deferred

This proposal is intentionally deferred. It does not block Museum Theme
acceptance and does not affect Engine V2. Current priority remains:

```
Authoring Validation
      ↓
Museum Theme Completion
```

---

## Change History

- v1.0 — Initial document. Adds EV-001 (Rich Frame Layer Host), captured
  after AV-003 validated the current Frame model end to end and
  surfaced the need for Frame-owned reusable visual content for future
  themes beyond Museum Gallery.
- v1.1 — Adds EV-003 (Theme Expression System), captured after AV-011's
  emoji-authoring implementation was validated against real Museum
  Theme authoring and found to work correctly but read as a generic
  utility rather than an integrated part of the Theme system. (EV-002,
  Theme Representative Artwork, was proposed and resolved directly
  within the AV-007 ticket rather than staged through this backlog, so
  it does not appear here as a separate numbered entry.)

---

## Cross-references

- `docs/AUTHORING_FINDINGS.md` — the retrospective sibling of this
  document: what authoring *found broken or awkward* per sprint, fixed
  or documented as a Future Product Insight. This document is forward-
  looking proposals instead, tracked with Status/Priority/Phase rather
  than per-sprint findings.
- `docs/ENGINE_V2_SCENE_MODEL.md` §7 — "Do Holder Layers and a reserved
  Content Layer need separate authoring" is the existing open question
  EV-001's own "Open questions" section connects to directly; neither
  document resolves it.
- `docs/WORLD_BUILDER_ARCHITECTURE.md` — records a related but distinct
  future direction, the "Visual Theme Composer" (interactive page
  anatomy, click-to-edit page layers), noted as explicitly out of scope
  for any B2.x sprint. EV-001 is narrower in scope (Frame-owned Layers
  specifically) and does not supersede or replace that note.
- `docs/THEME_PROJECT_SPEC.md` §6 / §7 — the current Frame Variation and
  Layer Pack specs EV-001 would extend, if accepted, and the Theme
  Asset categories EV-003's own "Design principles" section says must
  be checked before inventing a new asset kind for Theme Symbols/Icons.
- `js/emojiPicker.js` / `js/stickerLibrary.js` — the two existing,
  already-shipped insertion/catalogue mechanisms EV-003 proposes
  evolving from and drawing precedent from, respectively, rather than
  replacing.
