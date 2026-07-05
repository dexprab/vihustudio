# Studio Design Canon

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** The permanent visual and emotional identity of VihuStudio. Every
future screen, component, and interaction in Studio is designed against
this document. It does not describe any single sprint's implementation;
it describes what Studio must always feel like, regardless of which
screen is being built.

---

## 1. Vision

VihuStudio is not a graphic editor.

It is a creative world for children.

A child opening Studio should feel they have entered VihuPlanet — the
same universe as the Hero experience (see `docs/hero/00-HERO-BIBLE.md`),
not a separate piece of software bolted alongside it.

Never software. Always a story.

---

## 2. Emotional Goals

The Studio should feel:

- Calm
- Beautiful
- Welcoming
- Safe
- Magical
- Spacious

The Studio must never feel:

- Technical
- Complicated
- Enterprise
- Like a dashboard

Every screen is judged against this list before it is judged against
any functional checklist. A screen that works perfectly but feels like
a dashboard has failed this canon.

---

## 3. Colour Palette

**Primary**

- Vihu Navy — `#1D3457`

**Supporting**

- Warm Cream
- Paper White
- Soft Sky
- Sage Green
- Warm Sand
- Lavender

The palette is a soft watercolor palette. Colours are muted and warm,
never saturated or corporate. Gold (`#FFCB45`, the existing brand
accent) is used sparingly, for the single most important action or
selection state on a screen — not decoratively.

---

## 4. Illustration Style

Studio's illustrated surfaces (backgrounds, decorative scenes, empty
states) are:

- Hand-painted in feeling
- Watercolor
- Textured with visible paper grain
- Gently imperfect

They are never:

- Flat vector icon sets
- Stock illustration packs
- Corporate gradients

A decoration that looks like it came from an icon library rather than
a storybook does not belong in Studio.

---

## 5. Lighting

Morning light. Soft shadows. Natural warmth.

No dramatic lighting, no hard drop shadows, no neon glow. Shadows exist
to give gentle lift to a card or panel, not to dramatize it.

---

## 6. Spacing Philosophy

Large breathing spaces. Cards never touch. Nothing crowded.

Every screen should feel relaxing to look at before the child has read
a single word on it. When in doubt, add space rather than remove it.

---

## 7. Interaction Philosophy

Objects drive the UI. Never tools.

A child edits:

- Artwork
- Title
- Frame
- Background
- Page

A child never edits a "property panel," a "layer," or a "properties
inspector." Every control in Studio is reached by touching the thing
it changes, not by opening a tool that then asks which thing to apply
itself to. This is the same principle already governing the Workspace
(Universal Object Selection, Context Panel) — this canon makes it a
permanent rule for every future screen, not just the ones that already
follow it.

---

## 8. Motion Philosophy

Very gentle. Clouds drifting, leaves swaying, butterflies fluttering —
motion that a child would find in a quiet meadow, not motion that asks
for attention.

Nothing distracting. Nothing that loops fast, flashes, or competes with
the content the child is trying to read or choose. Motion is decoration
for the illustrated environment only — it never carries information a
child needs to notice to proceed.

---

## 9. Things VihuStudio Should Never Look Like

- Canva
- PowerPoint
- Figma
- Photoshop
- Adobe Express
- Admin dashboards
- Enterprise software

If a screen reminds a reviewer of any product on this list, it does not
meet canon, regardless of how functionally complete it is.

---

## Change History

- v1.0 — Initial canon, written for Sprint 11.0 (Studio Arrival
  Experience) but scoped as permanent identity documentation for all of
  Studio, not just the arrival screens.
