# World Project Contract

**Status:** Canonical. Permanent project documentation — not sprint notes.
**Scope:** Defines an editable **World Project** — the thing World
Builder creates, owns, and edits. This document does not describe the
compiled runtime format (`docs/VTHEME_PACKAGE_SPEC.md`) or the
authoring-folder format Theme Builder's services validate against
today (`docs/THEME_PROJECT_SPEC.md`); it describes the Builder-owned
object those two documents sit downstream of. See
`docs/WORLD_BUILDER_ARCHITECTURE.md` for how a World Project moves
through Validation, Build, and Publish once those stages exist.

---

## What a World Project is

A World Project is a complete, editable representation of a World,
owned by World Builder and persisted locally (`js/projectStore.js`,
`localStorage` — see that file's own documentation). It is **not** a
folder on the creator's filesystem. The creator never sees its files
directly, never edits JSON, and never manages folders — the Builder
generates, holds, and (in a future sprint) edits every piece of it
through visual controls.

This matters because it inverts the old Theme Builder model: previously,
a Theme Project was authored by hand as real files and *loaded* into a
tool. A World Project is the reverse — it is *born* inside the tool
(LOCK 03) and, only at Build time (a future sprint), gets flattened into
the same shape `docs/THEME_PROJECT_SPEC.md` already defines, so the
existing, unmodified Build services
(`tools/world-builder/js/services/{validator,builder}.js`) can validate
and compile it with no redesign. The World Project Contract and the
Theme Project Contract describe the same information; this one
describes it as Builder-owned, in-memory/persisted data, not
hand-authored files.

---

## Contents

Every World Project contains:

```
WorldProject
├── README.md
├── manifest.json
├── metadata.json
├── theme.json
├── layouts/
├── representations/
├── frames/
├── layer-packs/
├── assets/
└── docs/
    ├── WORLD_SPEC.md
    └── WORLD_ASSET_SPEC.md
```

| Entry | Purpose | Relates to |
|---|---|---|
| `README.md` | Human-readable summary of this World, generated from the template's own description | Author's own notes; never read by Validate/Build |
| `manifest.json` | Identity + compatibility | `docs/THEME_PROJECT_SPEC.md` §2 |
| `metadata.json` | Library card presentation (purpose/mood/bestFor/themeIcon/etc.) | `docs/THEME_PROJECT_SPEC.md` §3 |
| `theme.json` | Theme-wide presentation defaults | `docs/THEME_PROJECT_SPEC.md` §4 |
| `layouts/` | Slide layout presets | `docs/THEME_PROJECT_SPEC.md` §5 |
| `representations/` | Page styles Studio's Creation Flow Preview carousel offers | `docs/THEME_PROJECT_SPEC.md` §8 |
| `frames/` | Frame Variation presets | `docs/THEME_PROJECT_SPEC.md` §6 |
| `layer-packs/` | Layer declarations | `docs/THEME_PROJECT_SPEC.md` §7 |
| `assets/` | Images/textures the above reference | `docs/THEME_PROJECT_SPEC.md` §9 |
| `docs/WORLD_SPEC.md` | This World's own creative brief — new, World-Project-only | See below |
| `docs/WORLD_ASSET_SPEC.md` | This World's own asset inventory — new, World-Project-only | See below |

The first nine entries mirror `docs/THEME_PROJECT_SPEC.md`'s Theme
Project structure exactly (same names, same purpose), because a World
Project's whole reason for existing is to compile into that same
contract without translation. The last two — a per-project `docs/`
folder — are new to the World Project Contract and do not exist in a
hand-authored Theme Project.

### Why a per-project `docs/` folder

`docs/WORLD_SPEC.md` and `docs/WORLD_ASSET_SPEC.md` are not the
repository's own `docs/` folder (this document lives there; a World
Project's `docs/` is a different, per-project folder, generated fresh
for every World). They exist so a World's own creative and asset intent
travels *with the Project itself*, readable by a human without opening
every JSON file:

- **`WORLD_SPEC.md`** — the World's creative brief in plain language:
  what it's for, its mood, who it's best for, and the same shape as
  `metadata.json`'s `purpose`/`mood`/`bestFor`/`notRecommendedFor`
  fields, but as prose a human reads first.
- **`WORLD_ASSET_SPEC.md`** — an inventory of what this World's own
  assets are and where they came from (template-provided placeholders
  vs. creator-replaced originals) — the World-owned counterpart to
  `docs/WORLD_ASSET_CONTRACT.md`'s product-wide packaging convention,
  scoped to just this one World.

---

## LOCK 03 — Born valid

A New World is born valid. The moment a creator picks a template
(Screen 2), World Builder generates every entry above with sensible
starter content already satisfying this contract — a real `manifest.json`
with a real generated `id`, a `theme.json` with the template's own
presentation defaults, at least one Layout, at least one Representation,
at least one Frame Variation, and a starter `layer-packs/` entry. There
is no empty-folder state a creator ever sees, and no "finish setting up
your project" step before it's considered real.

---

## Automatic World Project creation

Generation is a two-step, synchronous pipeline the creator never
watches happen — there is no loading state, no progress bar, and no
intermediate "empty project" the creator could see between the steps:

```
Screen 2 (template card clicked)
   ↓
WorldTemplates.generate(templateId)   — tools/world-builder/js/templates.js
   returns { name, tagline, description, icon, files }
   `files` already contains every entry this contract requires
   (README.md, manifest.json, metadata.json, theme.json, layouts/*.json,
   frames/*.json, layer-packs/basic.json, representations/all.json
   when the template has any, docs/WORLD_SPEC.md, docs/WORLD_ASSET_SPEC.md)
   ↓
ProjectStore.create(templateId, generated)   — tools/world-builder/js/projectStore.js
   wraps it with the fields the Builder itself owns (id, status:'draft',
   createdAt/updatedAt) and persists it to localStorage
   ↓
Builder Workspace opens on the new Project immediately (Sprint B1.1)
```

The creator only ever sees the last step. Per the Template Rule
(Sprint B1.1): the instant a template card is clicked, the template
grid is gone — the Builder opens the Workspace on a real, already-valid
World Project, not on the template that produced it. There is no
"return to Welcome and find your new draft" intermediate step; that
only happens later, when the creator deliberately leaves the Workspace
(the Header's home button).

Every field the Workspace lets a creator edit — World Name, Tagline,
Description, Publisher, Version, Representations, Layouts, and so on —
is read and written through `tools/world-builder/js/projectModel.js`,
the single accessor/mutator layer over a Project's file map. This is
what keeps LOCK 03 true for the entire life of a Project, not just the
instant it's created: every edit is applied directly to the same
already-valid structure `WorldTemplates.generate` produced, so the
Project is never briefly invalid while being edited.

---

## Change History

- v1.0 — Initial canonical document, written for Sprint B1.0 (World
  Builder Foundation — Product Reset). Defines the World Project
  Contract as the Builder-owned counterpart to
  `docs/THEME_PROJECT_SPEC.md`'s hand-authored Theme Project, and
  reserves the per-project `docs/WORLD_SPEC.md` /
  `docs/WORLD_ASSET_SPEC.md` convention.
- v1.1 — Sprint B1.1 (World Builder Workspace Foundation). Adds the
  "Automatic World Project creation" section documenting the
  `WorldTemplates.generate` → `ProjectStore.create` → Builder Workspace
  pipeline, and records the Template Rule: selecting a template opens
  the Workspace immediately rather than returning to Screen 1. Notes
  that `tools/world-builder/js/projectModel.js` is the single
  accessor/mutator layer the Workspace edits a Project's file map
  through, keeping LOCK 03 true across the Project's whole editable
  lifetime, not just at creation.
