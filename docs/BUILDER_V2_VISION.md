# Builder V2 Vision — Reset

**Status:** Canonical, frozen. This document records a set of decisions
reached during UX review that supersede specific, named parts of
`docs/BUILDER_V2_BLUEPRINT.md` and `docs/BUILDER_V2_UX_PACKAGE.md` —
never `docs/ENGINE_V2_CANON.md`, which nothing here touches. Everything
in the five prior documents not explicitly named below as superseded
remains authoritative. After this document is committed, implementation
begins from it as the frozen starting point.
**Scope:** Five decisions — Global Navigation, the Scene Header, the
Creative Activities, the three-pane Workspace, and a small vocabulary
correction — plus what they change in the documents that came before,
and one implementation risk worth naming now rather than discovering
during the build.

---

## 0. Why this reset

`docs/BUILDER_V2_UX_PACKAGE.md`'s own critical review (Part 7) proposed
demoting Canvas out of the four-way activity switcher, on the grounds
that it's genuinely the lowest-frequency activity, but deliberately
left it unadopted pending sign-off — the review distinguished
"propose confidently" from "redesign unilaterally," and that decision
crossed into the latter. Sign-off has now happened, alongside four
related decisions reached in the same review pass. This document is
that sign-off, made explicit and permanent rather than left inside a
conversation.

---

## 1. Global Navigation

```
World | Scenes | Validation | Build | Publish
```

Moves to the **top** of the application, horizontally, and is
**no longer part of the editing workspace** — previously (Blueprint §5,
UX Package Part 1) this was a left sidebar, co-located with and always
visible alongside the Scene Editor's own regions. It now sits above the
workspace entirely, structurally separate from it, the same way a
window's own menu bar sits outside whatever document is open inside it.

Two naming notes, both label changes only — neither changes what the
destination does:

- **"World" replaces "Overview.""** Same screen, same purpose
  (Blueprint §4: World identity, name, description) — renamed because
  "Overview" reads as a dashboard, and "World" reads as the thing being
  made.
- **Theme Assets is still absent from this list** — not a new
  decision. UX Package Part 1 already demoted it from a top-level peer
  to a secondary entry (reachable from World, and from the in-Scene
  overlay); this list simply confirms that demotion rather than
  reversing it.

---

## 2. Scene Header

When a Scene is open, a persistent strip appears between Global
Navigation and the workspace:

```
Museum Gallery > Gallery Portrait

📄 Portrait
📐 Instagram Safe Area
📦 1080 × 1350
```

Two things live here, always:

- **The breadcrumb** — World name › Scene name — carried forward from
  the prior "Header" region (Blueprint §6 shared shell), unchanged in
  purpose.
- **The Scene Configuration summary** — a glanceable readout of the
  Scene's shape: page orientation, Safe Area label, pixel dimensions.
  This is the direct replacement for Canvas as a full activity
  (Blueprint §7): the same information, the same underlying Engine
  concept (Engine Canon §4 — Size, Aspect Ratio, Safe Area), no longer
  earning a whole activity-switch and a whole Working View state for
  something visited once per Scene and rarely again.

**The save-state indicator** (🟠 Unsaved Changes / 🟢 All Changes Saved,
UX Package Part 6) is unchanged in behavior and lives in this same
strip — nothing about moving Global Navigation to the top removes the
need to answer "is my last edit safe," it just relocates where that
answer is shown, from the old Header region into the Scene Header.

### How Scene Configuration is actually edited

Clicking the Scene Configuration summary selects it, exactly the way
clicking a Place or a decoration selects *that* — Context Inspector (§4
below) populates with its properties (Aspect Ratio choice, per Blueprint
§7's own "Size is derived, not typed" decision, unchanged). Working
View does **not** switch to a fourth activity state for this, because
Scene Configuration isn't a creative activity the way Place/Decorations/
Text are — it has no object on the page to draw guides around. Working
View simply keeps showing whichever activity was last active
underneath; only Context Inspector responds. This is the same
selection-driven Context Inspector pattern already established
(Blueprint §6.1) for any other selectable thing — Scene Configuration
just isn't a *page* object, so it doesn't get a Working View state of
its own.

---

## 3. Creative Activities

```
Place
Decorations
Text
```

Three, not four. Canvas is removed as a peer activity — this is the
direct adoption of UX Package Part 7's proposed-but-unadopted
simplification. Place, Decorations, and Text are unchanged in every
other respect: same Purpose/Primary Question/Information/Actions
already specified (Blueprint §8–§10, UX Package Parts 1, 3, 4), same
selection-driven switching (Blueprint §6.1), same shared permission
block (Blueprint §6.2, collapsed by default per UX Package Part 6).

---

## 4. Workspace — three permanent regions

```
+------------------+------------------+------------------+
|                  |                  |                  |
|   Working View   | Runtime Preview  | Context Inspector|
|                  |                  |                  |
+------------------+------------------+------------------+
```

Present, unchanged, regardless of which activity is active — this
stability requirement is not new (Mental Model §4, "the Scene must
stay visible regardless of activity"), only the arrangement is.

- **Working View** — shows only the active creative activity, with its
  own Builder-only guides. Unchanged in responsibility from Blueprint
  §6.
- **Runtime Preview** — always the complete, clean Scene exactly as
  Runtime will render it. Never interactive, never shows a guide —
  both firm rules, unchanged from Blueprint §6.
- **Context Inspector** — renamed from "Property Editor." Same
  responsibility: always reflects the current selection, contextual to
  the active activity, ends in the shared permission block. The rename
  is deliberate — "Inspector" names what it's for (inspecting whatever
  is currently selected) without implying a form to fill out, matching
  this whole effort's running argument against "generic inspectors"
  meaning something narrower and better than it used to.

### A layout risk worth naming, not silently avoiding

Builder V1 learned a specific, hard-won lesson (Sprint B2.0.4) that the
Property Editor could not share a *column* with Runtime Preview stacked
vertically inside it — that arrangement starved the Property Editor of
usable height and had to be rebuilt as a full-width row beneath both
Working View and Runtime Preview instead. This vision's three-column
layout is not a repeat of that specific bug: Context Inspector gets its
own dedicated **full-height column**, not a shared column split
vertically with Runtime Preview. That distinction matters and is why
this is not treated as a contradiction of V1's lesson.

It is, however, a related risk this document flags rather than leaves
implicit: **an equal three-way column split would under-serve Context
Inspector** the same way an equal split once under-served the old
Property Editor, just via a different mechanism (width starvation
instead of height starvation). This document does not fix exact column
proportions — that is an implementation decision for the next pass —
but it states plainly that Context Inspector should be sized generously
relative to Working View and Runtime Preview, not as a naive equal
third, so the same lesson isn't re-learned from scratch.

---

## 5. Vocabulary

| Engine | Builder |
|---|---|
| Holder | Place |
| Canvas | Scene Configuration |
| Layer | *(hidden — never named)* |

The first row was already adopted (UX Package, vocabulary note). The
second is new: **"Canvas" no longer appears in Builder-facing copy at
all**, even as a term for something a Theme Author looks at — it is
always "Scene Configuration," or, in the Scene Header's own compact
form, just the glanceable shape/size/safe-area readout with no label
naming the underlying concept at all. The third restates an existing
rule (Engine Canon §7, Mental Model §1) in this table's format — Layers
were already never shown; nothing changes here except stating it
alongside the other two for one complete vocabulary reference.

---

## 6. Design Principles

The Builder answers five questions, in this order, each mapped to
exactly one region — nothing here needs two regions to answer the same
question, and nothing here needs a Theme Author to answer a question
in a region that isn't the one built for it:

| Question | Answered by |
|---|---|
| Where am I? | Global Navigation — World / Scenes / Validation / Build / Publish |
| Which Scene am I editing? | Scene Header — the breadcrumb |
| What kind of page is this? | Scene Header — the Scene Configuration summary |
| What am I working on? | The activity switcher — Place / Decorations / Text |
| What am I editing? | Context Inspector |

This table is this document's own single clearest statement of intent:
if a future feature can't be placed cleanly into one row, it hasn't
been thought through yet — the same discipline `docs/
BUILDER_V2_BLUEPRINT.md` §1 already held every screen to, now held
against these five questions directly.

---

## 7. What this changes in prior documents

Named explicitly, so nothing is silently reinterpreted:

| Document | Section | What changes |
|---|---|---|
| Blueprint | §4 Overview | Nav label becomes "World"; screen's own Purpose/content unchanged |
| Blueprint | §5 Navigation region | Moves from left sidebar to top bar, and out of the editing workspace entirely |
| Blueprint | §6 Shared Shell | "Property Editor" renamed "Context Inspector"; the old Header's breadcrumb + save-state move into the new Scene Header |
| Blueprint | §7 Canvas Slice | No longer a peer activity; becomes the Scene Header's Scene Configuration summary (§2 above) |
| UX Package | Part 1 (IA) | Nav diagram updated to top-bar form; "Canvas" removed from the activity list |
| UX Package | Part 3 (wireframes) | Redrawn for top nav + Scene Header + three-column workspace; the standalone Canvas wireframe replaced by the Scene Header's config summary |
| UX Package | Part 5 (workspace regions) | Rewritten for five regions total (Global Navigation, Scene Header, Working View, Runtime Preview, Context Inspector) |
| UX Package | Part 7, item 1 | Moves from "proposed, not adopted" to resolved-and-adopted, referencing this document |

`docs/BUILDER_V2_STORYBOARD.md` is **not** edited by this reset — its
Stage 4 ("Confirm the Page's Shape (Canvas)") still correctly describes
the *intent* a Theme Author has at that moment; only the mechanism
changes (a Scene Header glance instead of a dedicated activity), which
the storyboard's own intent-first framing survives without needing a
line changed. `docs/ENGINE_V2_CANON.md` is untouched — nothing here is
an Engine decision; Canvas is still exactly what Engine Canon §4 says
it is, only how the Builder surfaces it has changed.

---

## Cross-references

- `docs/ENGINE_V2_CANON.md` — untouched; Canvas remains exactly as
  defined there.
- `docs/BUILDER_V2_MENTAL_MODEL.md` — untouched; its four-slice
  conclusion (§2) is amended by this document, not contradicted — the
  amendment is exactly the "Canvas is real, but lower-frequency"
  observation that section already made, now acted on.
- `docs/BUILDER_V2_STORYBOARD.md` — untouched, per §7 above.
- `docs/BUILDER_V2_BLUEPRINT.md` — amended per §7's table; not
  redesigned.
- `docs/BUILDER_V2_UX_PACKAGE.md` — updated alongside this document to
  match every decision above.
