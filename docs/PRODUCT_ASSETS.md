# Product Assets

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Defines the Product Asset System — the permanent split between
assets VihuStudio itself owns and assets an individual World owns. This
document does not create any asset, and does not change Studio, Theme
Engine, Theme Builder, or runtime code; it establishes where every future
asset belongs so that question never needs re-deciding per sprint. See
`docs/ASSET_GUIDELINES.md` for illustration style, `docs/PRODUCT_ILLUSTRATIONS.md`
and `docs/ENVIRONMENTS.md` for the two specific Product Asset families
documented in their own detail, and `docs/WORLD_ASSET_CONTRACT.md` for the
World side of this split.

---

## Purpose

VihuStudio is a product platform. Every visual asset in the repository
belongs to exactly one of two categories, and the category never changes
depending on which sprint touches it:

1. **Product Assets** — owned by VihuStudio, reusable across the entire
   product, versioned in `assets/` at the repository root.
2. **World Assets** — owned by an individual World, packaged inside that
   World's own `.vtheme`, and never stored anywhere else.

These two concepts must remain permanently separated. An asset either
belongs to the product, or it belongs to a World — never both, and never
ambiguously.

---

## Product Assets

Everything below lives under `assets/` and is reusable throughout the
Studio. None of it ever travels inside a World's `.vtheme` package.

| Category | Folder |
|---|---|
| Logo | `assets/brand/` |
| Brand Colours | `assets/brand/` |
| Creation Illustrations | `assets/illustrations/` (see `docs/PRODUCT_ILLUSTRATIONS.md`) |
| Story Meadow | `assets/environments/story-meadow/` (see `docs/ENVIRONMENTS.md`) |
| Open Sky | `assets/environments/open-sky/` (see `docs/ENVIRONMENTS.md`) |
| Background Decorations | `assets/environments/{clouds,butterflies,flowers,paper-boats}/` |
| Buttons | `assets/ui/buttons/` |
| Cards | `assets/ui/cards/` |
| Textures | `assets/ui/textures/` |
| Frames | `assets/ui/frames/` |
| Icons | `assets/icons/{navigation,actions,status}/` |
| UI Decorations | `assets/ui/shadows/` and the environment folders above |
| Stickers | `assets/stickers/` |

Product Assets reach every screen the same way — a Creation Type
illustration, a button texture, or a navigation icon is referenced by
path exactly like any other static asset already in this repository
(see `assets/icons/logo.png`'s existing usage for precedent). They are
never bundled per-World, never duplicated per-project, and never
regenerated for a specific screen.

---

## World Assets

Everything below is owned by an individual World, always packaged
inside that World's own `.vtheme`, and never stored under `assets/`:

- World Hero
- World Thumbnail
- World Card
- Representation Previews
- Frame Artwork
- Decorations
- Textures
- Backgrounds

A World Asset is meaningless outside the World it belongs to — Museum
Gallery's hero image describes Museum Gallery, not VihuStudio itself.
See `docs/WORLD_ASSET_CONTRACT.md` for exactly how a World packages
these, and `docs/THEME_PROJECT_SPEC.md` / `docs/VTHEME_PACKAGE_SPEC.md`
for the existing authoring/compiled package contract these assets
travel inside (unchanged by this document).

---

## Rules

1. **Never duplicate Product Assets inside a World.** If every World
   would otherwise need its own copy of the same brand mark, button
   texture, or navigation icon, it is a Product Asset — reference
   `assets/`, don't copy it into the World's package.
2. **Never store World Assets inside Product Assets.** If an asset only
   makes sense in the context of one specific World (its hero art, its
   frame artwork, its own background), it belongs inside that World's
   `.vtheme`, never in this repository's `assets/` tree.

When it's unclear which side of the line a new asset falls on, ask: "if
every World disappeared tomorrow, would this asset still make sense?"
If yes, it's a Product Asset. If the asset only makes sense alongside
one particular World, it's a World Asset.

---

## Change History

- v1.0 — Initial canonical document, written for the Foundation —
  Product Asset System sprint. Establishes the `assets/` folder
  structure and the Product/World ownership split; creates no artwork.
