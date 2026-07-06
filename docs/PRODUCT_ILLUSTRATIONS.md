# Product Illustrations

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Documents the permanent Creation Type illustration family —
where each one lives, what it means, and the reuse rule that governs it.
This document does not create any artwork; it reserves the family's
identity and file locations so that when the artwork is produced, every
future screen reuses the same six illustrations rather than each
re-inventing or regenerating its own. See `docs/ASSET_GUIDELINES.md` for
the illustration style these must be produced in, and
`assets/illustrations/README.md` for the folder's own placeholder note.

---

## These are not icons

A Product Illustration is not a small functional glyph (that's what
`assets/icons/` is for — see `docs/PRODUCT_ASSETS.md`). A Product
Illustration is a full narrative scene: it tells the child what the
Creation Type feels like, not just what it's called. Each one is large,
warm, hand-painted, and emotionally specific to its Creation Type —
never a generic icon standing in for a category.

---

## Initial Illustration Set

Six illustrations, one per Creation Type shown on Screen 1 of the
Studio Arrival Experience (`js/creationFlow.js`'s `CREATION_TYPES`):

| Illustration | Creation Type id | Current placeholder | Exported file |
|---|---|---|---|
| Tell a Story | `story` | 📖 | `assets/illustrations/creation/creation-story.webp` |
| Showcase My Artwork | `artwork` | 🖼️ | `assets/illustrations/creation/creation-artwork.webp` |
| Create Quotes | `quote` | 💬 | `assets/illustrations/creation/creation-quote.webp` |
| Write a Poem | `poem` | 🖋️ | `assets/illustrations/creation/creation-poem.webp` |
| Greeting Cards | `card` | ❤️ | `assets/illustrations/creation/creation-card.webp` |
| More Coming Soon | `more` | ✨ | `assets/illustrations/creation/creation-more.webp` |

The "current placeholder" column is exactly what `js/creationFlow.js`
renders today (a single emoji per card, per Sprint 11.0) — that emoji is
the seam where each illustration's exported file will slot in once
produced, no other code change required.

---

## Reuse Rule

Future screens must reuse these illustrations. Never regenerate them.

If a later screen needs a "Tell a Story" visual anywhere else in the
product — a confirmation screen, a share card, a different arrival
variant — it uses `creation-story.webp` from this same folder. It does
not commission a second illustration of the same idea. One illustration,
one meaning, referenced everywhere that meaning is needed.

This is exactly why the illustrations live under `assets/illustrations/`
(a Product Asset location, per `docs/PRODUCT_ASSETS.md`) rather than
being generated or stored per-screen: a Product Illustration belongs to
the *concept* ("Tell a Story"), not to any one screen that happens to
display it.

---

## Change History

- v1.0 — Initial canonical document, written for the Foundation —
  Product Asset System sprint. Reserves the six-illustration family and
  its file locations; creates no artwork.
