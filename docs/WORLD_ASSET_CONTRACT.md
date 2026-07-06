# World Asset Contract

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Documents how every World packages its own visual assets, as
the World-owned counterpart to `docs/PRODUCT_ASSETS.md`. This document
creates no artwork and changes no Theme Engine, Theme Builder, or
runtime code — it reserves an authoring convention for World-owned
assets, cross-referenced against the already-shipped, frozen contract in
`docs/THEME_PROJECT_SPEC.md` and `docs/VTHEME_PACKAGE_SPEC.md` so the two
never contradict each other. Where this convention isn't fully wired
into today's compiler, that gap is named explicitly below rather than
silently implied to already work.

---

## Every World is completely self-contained

A World's assets travel with it, inside its own `.vtheme` package. A
World never references a Product Asset from the repository's `assets/`
tree, and nothing under `assets/` ever needs a specific World to exist
or render correctly. Delete every other World from a fresh VihuStudio
install and any one World still imports and renders exactly as before —
this was proven end-to-end for Museum Gallery in Sprint 10.2, and it is
the standing acceptance bar for every World going forward.

---

## The target packaging convention

```
MuseumGallery.vtheme
  assets/
    hero.webp
    thumbnail.webp
    showcase.webp
    portrait.webp
    quote.webp
```

| File | What it is | Ownership |
|---|---|---|
| `hero.webp` | A large identity image for this World. Not currently rendered anywhere — Screen 2's Preview dropped its hero-image block in Sprint 11.1's carousel redesign in favour of a compact icon+name heading — but reserved for a future surface (e.g. a World detail view) rather than repurposed for something else in the meantime | This World only |
| `thumbnail.webp` | The small image shown on the World's own card in the Vihu Worlds / World Library row (`.creation-flow-world-thumb`) | This World only |
| `showcase.webp` / `portrait.webp` / `quote.webp` | One preview image per Representation this World offers, named to match the Representation's own id, rendered as each Preview carousel slide's artwork (`.creation-flow-carousel-art`, Sprint 11.1/11.2) | This World only |

Naming convention: one file per role, named for what it is
(`hero`, `thumbnail`) or for the Representation id it previews
(`showcase`, `portrait`, `quote` — matching whatever this World's own
`representations/` entries are actually called, per
`docs/THEME_PROJECT_SPEC.md` §8). A World with different Representations
names its files to match — a Storybook-family World's files would be
named for *its* Representations, not copied from Museum Gallery's.

---

## How this maps onto today's shipped contract

This convention is the direction World asset packaging is heading, not
a redefinition of what's already shipped. Reconciled against
`docs/THEME_PROJECT_SPEC.md` / `docs/VTHEME_PACKAGE_SPEC.md` as they
stand today:

- **`thumbnail` / `hero`** — today, a Theme Project's Library-card image
  and larger preview image are authored as `thumbnail.png` /
  `preview.png` at the Theme Project's root (not inside `assets/`), and
  referenced by `manifest.thumbnail` / `metadata.previewImage`
  respectively (`docs/THEME_PROJECT_SPEC.md` §2–3). This contract's
  `assets/thumbnail.webp` / `assets/hero.webp` describe where these
  belong going forward; teaching the compiler to also resolve them from
  inside `assets/` is a Theme Builder change and is explicitly out of
  this sprint's scope.
- **`showcase` / `portrait` / `quote`** — this part of the convention
  already works with zero schema change: a Representation's own
  `thumbnail` field (`docs/THEME_PROJECT_SPEC.md` §8) already accepts
  either a single emoji placeholder or a relative path / data URI to a
  real image. Authoring a Representation's `thumbnail` as
  `"assets/showcase.webp"` is valid today, exactly as this contract
  recommends.

A future sprint that closes the `hero`/`thumbnail` gap should update
this document's status accordingly rather than leaving the distinction
undocumented.

---

## Rules

- Never store a World Asset under the repository's `assets/` tree
  (`docs/PRODUCT_ASSETS.md`'s Product/World split, enforced in both
  directions).
- Never reference a Product Asset from inside a World's own `.vtheme` —
  if a World needs the VihuStudio logo or a shared UI texture, that's a
  sign the asset in question is actually a Product Asset being
  mis-scoped, not a reason to duplicate it into the World.
- Follow `docs/ASSET_GUIDELINES.md`'s illustration style for every
  World-owned image, the same as any Product Asset — one consistent
  illustration language across both halves of the split.

---

## Import Parity (permanent platform rule)

> An Official World is considered complete only when its compiled
> `.vtheme` package can be imported into a clean installation of
> VihuStudio and provides exactly the same creation experience as when
> shipped with the product.

Importability is part of the World Contract, not a separate concern
checked after the fact. There is no distinction between an "Official
World" and an "Imported World" at runtime — the package is the product.
Studio never knows or cares how a `.vtheme` file arrived; it consumes
the package the same way regardless of whether it shipped inside the
repository or was emailed to a developer and added via **Add New
World**.

This rule is enforced by construction, not by a separate compliance
step: every Official World's source lives in `official-worlds/` (see
`docs/THEME_PROJECT_SPEC.md` §0), is compiled through the same Theme
Builder every third-party World uses, and reaches Studio through the
same import path every third-party World uses (`docs/THEME_PROJECT_SPEC.md`'s
lifecycle: Theme Project → Validate → Compile → `.vtheme` → Import →
Creation Flow → Preview → Workspace → Publish). Studio contains no
World-specific code path of any kind — no `if (world.id === "...")`,
no hardcoded layouts, no hardcoded representations, and no synthetic
data fabricated to paper over a World that doesn't declare something it
needs (see the Preview carousel rule below). Museum Gallery is the
reference implementation this rule was written against — the first
World to be authored, compiled, and validated entirely through this
lifecycle with zero exceptions.

**The Preview carousel renders only what the package declares.** If a
World's compiled `theme.representations` has 3 entries, the Preview
shows 3 slides; if it has 5, it shows 5. If it has 0, that World simply
shows no carousel — Studio does not fabricate a placeholder
representation to make the screen feel complete. A World with 0
Representations has not satisfied the World Contract; the honest gap is
a signal to the World's author, not something for Studio to paper over.

---

## Change History

- v1.1 — Added the permanent Import Parity rule (Sprint 11.2 — Official
  World Platform): an Official World is complete only when its compiled
  package, imported into a clean install, provides exactly the same
  experience as when shipped with the product. Corrected the `hero.webp`
  row now that Screen 2's Preview no longer renders a hero image
  (Sprint 11.1), and pointed `showcase`/`portrait`/`quote.webp` at the
  Preview carousel slides that actually render them today.
- v1.0 — Initial canonical document, written for the Foundation —
  Product Asset System sprint. Reserves the `assets/{hero,thumbnail,
  <representation-id>}.webp` convention and reconciles it against the
  already-shipped Theme Project / `.vtheme` contract; creates no
  artwork and changes no compiler behaviour.
