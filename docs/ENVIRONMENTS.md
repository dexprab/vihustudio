# Environments

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Documents the illustrated arrival environments — Story Meadow
and Open Sky — that frame Screens 1 and 2 of the Studio Arrival
Experience. This document does not change the current implementation; it
records the identity Story Meadow's existing CSS/emoji build already
follows, and reserves Open Sky's identity for when it is built. See
`docs/STUDIO_DESIGN_CANON.md` for the product-wide visual identity these
environments express, and `assets/environments/README.md` for where their
assets live once produced.

---

## The environment frames the interface

An environment is not wallpaper. It does not sit behind the interface as
decoration to be ignored — it is the world the child has entered, and
the cards, panels, and buttons are objects that exist *inside* it. This
is why Screen 2's World Sources and Selected World Preview panels are
opaque, warm-cream surfaces floating over the environment (per
`docs/STUDIO_SCREEN_2_INFORMATION_ARCHITECTURE.md`) rather than the
environment being hidden the moment any UI appears — the environment
stays present, just quieter, for as long as the arrival journey lasts.

---

## Story Meadow

**Status:** Implemented (`js/creationFlow.js` + `.creation-scene` in
`index.html` + its CSS in `css/style.css`), currently built from CSS
gradients and emoji rather than hand-painted art. This document records
that implementation's intended identity — see `assets/environments/story-meadow/README.md`
for where a hand-painted replacement would live.

### Purpose

The default arrival environment. A quiet, sunlit meadow the child walks
into before making anything — calm and a little magical, never busy.

### Colour Palette

A soft morning gradient: pale sky blue at the top, softening through
warm cream, to a golden horizon (`#dff1ff` → `#eaf6ff` → `#fdf3e2` →
`#fdeccb` in the current implementation). Hills are muted sage and
soft green (`#cfe6da`, `#a9d9b8`); grass deepens toward a warmer green
at the very bottom (`#bfe3ab` → `#9fd68f`). Gold (`#FFCB45`) appears
only as the sun's glow and as the product's one accent colour for
selection/action — never as a meadow colour itself.

### Lighting

Morning light, low and warm, coming from the upper-left (the sun-glow
radial sits at the top-left corner). Soft, not dramatic — no hard
shadows, no dusk or night lighting. Twinkling stars appear even in this
daylight scene as a magical accent, not a literal time-of-day signal.

### Composition

Sky fills the full frame; hills and grass anchor the bottom edge; trees,
flowers, the signpost, and the castle sit along the edges and corners,
leaving the center visually clean for whatever cards float above the
environment. Decorative elements are deliberately edge-weighted — this
is what keeps the environment from competing with the interface.

### Animation Philosophy

Very gentle, continuous, and never attention-seeking: clouds drift
slowly across the sky, birds fly a lazy path, butterflies flutter in
small loops, flowers sway, stars twinkle, a kite bobs on the breeze.
Every motion is slow enough to read as ambient life, not as something
the child needs to track. `prefers-reduced-motion` disables all of it
without changing the composition.

---

## Open Sky

**Status:** Not yet implemented. Reserved here as the alternative
environment named alongside Story Meadow in the canonical storyboard.
Story Meadow remains the one live environment; Open Sky is documented so
its identity is decided once, in advance, rather than improvised the day
someone builds it.

### Purpose

An alternative arrival environment for a more open, airborne feeling —
sky-forward rather than ground-forward. Where Story Meadow puts the
child on solid ground in a garden, Open Sky puts them among clouds,
looking out.

### Colour Palette

Should share Story Meadow's warm, soft-watercolor family (per
`docs/STUDIO_DESIGN_CANON.md` §3) but lean further into sky tones —
more lavender and soft sky-blue, less green and gold. It must read as
the same VihuPlanet universe as Story Meadow, not a different product.

### Lighting

Same morning-light philosophy as Story Meadow: soft, warm, no drama.
Open Sky may sit slightly higher in altitude/lighter in tone to support
its airborne feeling, but should not shift to a different time of day.

### Composition

Sky-dominant: little or no ground plane, clouds layered at different
depths to suggest height, with kites, birds, or paper airplanes drifting
through rather than meadow flora anchoring the bottom edge. Center stays
visually clean, same rule as Story Meadow.

### Animation Philosophy

Identical philosophy to Story Meadow (very gentle, continuous, never
attention-seeking) — Open Sky should feel like a sibling environment
built from the same motion vocabulary, not a differently-animated
product.

---

## Change History

- v1.0 — Initial canonical document, written for the Foundation —
  Product Asset System sprint. Records Story Meadow's existing
  implementation and reserves Open Sky's identity; creates no artwork
  and changes no code.
