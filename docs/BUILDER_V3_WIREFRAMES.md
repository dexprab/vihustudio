# Builder V3 — Experience Architecture: Paper Wireframes

**Status:** Draft — paper stage only, pending review. Nothing in this
document is implemented; no code changes accompany it. **Two items
below are flagged as unresolved Canon Conflicts** (§0) requiring
explicit product discussion before implementation may begin, per this
overhaul's own escalation rule ("Canon conflict → Stop and discuss").
Read `docs/BUILDER_V2_EXPERIENCE_CANON.md` first — everything below is
that canon's wireframes, not a re-derivation of its philosophy. Also
assumes `docs/ENGINE_V2_CANON.md`, `docs/ENGINE_V2_SCENE_MODEL.md`,
`docs/BUILDER_V2_VISION.md`, `docs/BUILDER_V2_BLUEPRINT.md`,
`docs/BUILDER_V2_MENTAL_MODEL.md`, `docs/BUILDER_V2_STORYBOARD.md`, and
`docs/BUILDER_V2_UX_PACKAGE.md` as already-read prerequisites — the same
reading order every prior Builder V2 document has required.
**Scope:** Box-and-arrow paper wireframes for Builder Navigation, the
Scene Workspace, the Place Workspace, the Holder Workspace, Experience
Home, the Experience Inspector, and the Experience Creation Flow — then
a walkthrough of real Museum Theme authoring against those wireframes,
and the friction that walkthrough surfaced. No visual design, no
components, no data structures, no code — exactly the discipline every
prior Builder V2 wireframe document already held itself to.

---

## 0. Two Canon Conflicts, flagged before anything else

Per this overhaul's own validation rule, these are surfaced now, loudly,
rather than quietly resolved one way inside the wireframes below. Both
are treated in full in Part 3; both are also design decisions the
wireframes had to pick *some* answer for in order to be drawable at all
— the choice made in each case is stated here and is the conservative
one, not necessarily the intended one.

**Conflict 1 — "Place" is new Foundation structure, not a rename.**
`docs/BUILDER_V2_VISION.md` §5 already froze **Place = Holder** (a
one-to-one rename, Engine noun → Builder noun). This overhaul's own
Foundation diagram (`World → Scenes → Places → Holders`) and its Place
Workspace wireframe (a Place named "Gallery Wall" *containing* Holder 1,
Holder 2, Holder 3) describe something structurally different: a new
grouping tier *above* Holder, one Place owning many Holders. That is not
in `docs/ENGINE_V2_CANON.md`'s frozen object tree (Scene owns Canvas
exactly one, Holder 0..N, Layer 0..N — nothing sits between Scene and
Holder) and it is not what Vision §5 already named "Place." Introducing
it as a real, persisted ownership tier would be a Foundation redesign —
squarely the thing this overhaul says not to do ("Foundation remains
stable. Do not redesign it.").

**The wireframes below resolve this the conservative way**, consistent
with "Foundation remains stable": **a Place is a Builder-only
organizational grouping (a label/tag) over Holders that already belong
directly to their Scene — never a new Engine object, never a new
persistence tier.** "Gallery Wall" is a name a Theme Author gives to a
set of Holders they think of together; the Engine still sees Scene
owning those Holders directly, exactly as it does today. This reading
requires **zero Scene Model change**. If the intended meaning is
instead a true new ownership tier, that is a Foundation-level decision
this document cannot make on its own and must be discussed before any
wireframe below is treated as final.

**Conflict 2 — "Artwork" as an attached Experience risks contradicting
"the Holder is sacred."** The Holder Workspace wireframe lists "Artwork"
alongside "Frame" and "Museum Label" as an Attached Experience. Read
literally, that would mean a Theme Author places permanent artwork into
a Holder — directly contradicting Engine Invariant 10/11 ("every Holder
presents exactly one Primary Element," "the Content Layer's only
legitimate occupant is something the Story Author actually chose or
uploaded," never Theme-Author-supplied).

**The wireframes below resolve this the conservative way, too:**
"Artwork," wherever it appears as an Experience, means the existing,
already-approved **representative/preview artwork** mechanism
(AV-007/EV-002 — a Theme's own Hero Image, reused as a Fit/Fill
demonstration stand-in during authoring, never real Story Author
content and never shipped as if it were). It is a Builder-authoring
convenience, exactly as it is today, not a new kind of permanent Holder
content. If "Artwork" is intended to mean something else, that is also a
Canon Conflict requiring discussion, not a wireframe detail.

Both readings are carried consistently through every wireframe and the
walkthrough below. Nothing here should be read as this document
deciding either question on the product's behalf — only as the
narrowest interpretation that keeps Foundation and Engine Invariants
intact, so the rest of the exercise (paper-testing Experience Home
itself) can proceed.

---

## Part 1 — Paper Wireframes

### 1.1 Builder Navigation

```
World │ Scenes │ Experiences │ Validation │ Publish        [Save●]
```

One observation, not a silent edit: the overhaul's own navigation list
drops **Build** (present in `docs/BUILDER_V2_VISION.md` §1 as its own
destination, between Validation and Publish). Nothing about Experience
Architecture implies removing Build — it is a distinct, single-purpose
stage (`docs/BUILDER_V2_BLUEPRINT.md` §13) that Validation and Publish
each depend on existing separately. The wireframes below **keep Build**
between Validation and Publish, flagged here as a probable omission
rather than a decision, pending confirmation (see Part 3).

```
World │ Scenes │ Experiences │ Validation │ Build │ Publish   [Save●]
```

Everything else about Global Navigation (top bar, structurally outside
the workspace, save-state indicator) is unchanged from Vision §1.
**Experiences** is a genuinely new destination, sitting where a Theme
Author would expect it — after Scenes (the structural collection),
before Validation (the readiness check) — matching this overhaul's own
"first-class Builder workspace" instruction.

### 1.2 Scene Workspace

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Experiences │ Validation │ Build │ Publish│
├──────────────────────────────────────────────────────────┤
│ Museum Gallery › Gallery Portrait                          │  Scene Header
│ 📄 Portrait   📐 Instagram Safe Area   📦 1080 × 1350      │  (unchanged)
├───────────────────────┬───────────────────┬───────────────┤
│  Places                │                   │               │
│ ┌───────────────────┐ │                   │               │
│ │                   │ │    Properties      │  Runtime      │
│ │   Working View    │ │  (context-aware   │  Preview      │
│ │                   │ │   to selection)   │  (unchanged)  │
│ │                   │ │                   │               │
│ │  Quick Actions:    │ │                   │               │
│ │  + Add Experience  │ │                   │               │
│ │  Reuse Existing    │ │                   │               │
│ └───────────────────┘ │                   │               │
└───────────────────────┴───────────────────┴───────────────┘
```

**No Decoration section. No Text section.** Both retire from the Scene
Workspace exactly as instructed — those responsibilities are now
Experience concerns, reachable via Quick Actions (below) or Experiences
(Global Navigation), never via a slice switcher inside Scene. Only
**Places** remains as the Scene's own structural slice switcher; Working
View, Properties, and Runtime Preview keep their existing three-pane
arrangement and existing rules (Runtime Preview never interactive,
Properties context-aware to selection) unchanged from Vision §4.

**Quick Actions** (contextual authoring, per the overhaul's own
requirement that authors "never feel forced to keep navigating back to
Experience Home") sit inside Working View's own frame, not as a fourth
slice — clicking either opens the Experience Creation Flow (§1.7) or a
lightweight Reuse picker, pre-attached to this Scene, then returns focus
here exactly the way the Theme Asset overlay already returns focus
today (UX Package Part 4, "Returning from Theme Assets").

### 1.3 Place Workspace

**Places list** (per Conflict 1's resolution: a Builder-only grouping
label over this Scene's own Holders):

```
Places
──────────────────────────────
Gallery Wall
Reading Wall
──────────────────────────────
+
```

**Selecting a Place** exposes the Holders grouped under it:

```
Gallery Wall
──────────────────────────────
Holder 1
Holder 2
Holder 3
──────────────────────────────
+
```

This workflow is deliberately unchanged in feel from today's Place
activity (`docs/BUILDER_V2_VISION.md` §3, "Place" as Engine Holder) —
selecting a Holder still opens its own workspace (§1.4); adding a Holder
here still works the same way Blueprint §8's "Add or remove a Holder"
already specifies. The only new thing is the grouping label itself
("Gallery Wall," "Reading Wall") sitting one level above the Holder
list purely for the Theme Author's own organization — three Holders on
one museum wall, one Holder on a reading nook — never a change to how
those Holders are owned or rendered.

### 1.4 Holder Workspace

```
Holder 1
──────────────────────────────
Attached Experiences

 🖼  Frame — Classic White
 🎨  Artwork — representative preview
 📝  Museum Label — Title · Artist · Age · Date
──────────────────────────────
+ Add Experience
Reuse Existing Experience
```

Selecting any row (Frame, Artwork, Museum Label) opens the Experience
Inspector (§1.6) for that Experience, pre-scrolled/pre-focused as if
arrived at directly from Experience Home — these are shortcuts into the
same single source of truth, never a second, Holder-owned copy of an
Experience's properties. Holder's own spatial properties (Position,
Size, Shape, Padding, Fit) are unchanged from Blueprint §8 and are not
shown here — they remain Holder's own concern, distinct from whatever
Experiences are attached to it, per Ownership (Experience Canon §4).

### 1.5 Experience Home

```
┌──────────────────────────────────────────────────────────┐
│ World │ Scenes │ Experiences │ Validation │ Build │ Publish│
├──────────────────────────────────────────────────────────┤
│ Experiences                                                │
│ [+ New Experience]  [Reuse Existing]  [Duplicate]  [Search]│
├──────────────────────────────────────────────────────────┤
│ Filters:  All │ Attached │ Free │ Public │ Private │ Unused│
├──────────────────────────────────────────────────────────┤
│ 🖼  Classic White Frame        Frame       Public  Attached│
│                                 Used in 7 Hosts             │
│──────────────────────────────────────────────────────────│
│ 📝  Museum Label                Text        Private Attached│
│                                 Scene: Gallery Portrait     │
│──────────────────────────────────────────────────────────│
│ 🎨  Paper Texture               Image       Public  Attached│
│                                 Used in 4 Scenes            │
│──────────────────────────────────────────────────────────│
│ 🦋  Floating Butterfly          Decoration  Private Free    │
│                                 Scene: Gallery Portrait     │
│──────────────────────────────────────────────────────────│
│ 🕯  Wax Seal                    Decoration  Private Unused  │
└──────────────────────────────────────────────────────────┘
```

Deliberately **not** a simple list, per the overhaul's own instruction:

- **Toolbar first** — New/Reuse/Duplicate/Search read left to right as
  the four things a Theme Author actually starts a session wanting to
  do, before any filtering or browsing.
- **Filters are two independent axes, shown as one flat row, not two
  separate rows** — Attached/Free is Attachment; Public/Private is
  Visibility; All and Unused are convenience shortcuts, not a third
  axis. A Theme Author never needs to understand the two-axis model
  explicitly to use the row — "Free" and "Private" simply both narrow
  the same list, combinably.
- **Every row answers the same four questions in the same order** —
  what is this (icon, name, type), is it Public or Private, is it
  Attached or Free, and where/how much is it used — because those are
  exactly the four things the Experience Inspector (§1.6) opens with,
  so the list and the Inspector never disagree about what matters first.
- **Usage is load-bearing, not a footnote** — "Used in 7 Hosts" sits
  directly under Classic White Frame's name, not buried in a detail
  view, because deciding whether an Experience is safe to edit starts
  the moment a Theme Author sees it in this list, not after opening it.

### 1.6 Experience Inspector

```
Experience
──────────────────────────────
Name         Classic White Frame
Type         Frame
Attachment   Attached
Visibility   Public
Usage        Used in 7 Hosts →
──────────────────────────────
Properties
  Mat Width         [24]
  Frame Thickness   [2]
  Border Colour     [■ #FFFFFF]
  Wall Tone         [■ #FFFFFF]
  Shadow            (soft ▾)
```

**Usage expands into its own detail view** on click — never buried, per
the overhaul's own "authors must understand the impact before editing
shared Experiences":

```
Classic White Frame — Used In
──────────────────────────────
✓ Museum Entrance     Holder 1
✓ Museum Entrance     Holder 2
✓ Dinosaur Gallery    Holder 3
✓ Space Gallery       Holder 1
✓ Gallery Portrait    Holder 2
✓ Gallery Portrait    Holder 3
✓ Reading Wall        Holder 1
```

Properties below the identity block are exactly the Experience's own
type-specific fields — for a Frame Experience, precisely the eight
fields Museum Gallery's own Frame Variations already use
(`matWidth`/`frameThickness`/`borderColor`/`wallTone`/`cornerRadius`/
`shadow`/`inset`/`defaultMargin`), unchanged in name or meaning. This is
the one part of the Inspector that varies by Experience Type; the
identity block above it (Name/Type/Attachment/Visibility/Usage) is the
same shape for every Experience, regardless of type.

### 1.7 Experience Creation Flow

The overhaul's own instruction — "Builder should infer attachment
whenever context makes it obvious… only ask when context is
ambiguous" — means this is not one flow but three, sharing the same
shape, differing only in which step is skipped:

**From Holder Workspace ("+ Add Experience" on Holder 1):**

```
New Experience
   ↓
Choose Type           (Frame · Text · Image · Decoration · …)
   ↓
[Attachment inferred — Holder 1 — not asked]
   ↓
Visibility            (Private · Public)
   ↓
Author                (the Experience's own Properties)
   ↓
Done — attached to Holder 1, appears there immediately
```

**From Scene Workspace ("+ Add Experience," Quick Actions):**

```
New Experience
   ↓
Choose Type
   ↓
[Attachment inferred — this Scene — not asked]
   ↓
Visibility
   ↓
Author
   ↓
Done — attached to Scene, appears immediately
```

**From Experience Home ("+ New Experience," no context):**

```
New Experience
   ↓
Choose Type
   ↓
Choose Attachment     (Scene · Holder · Free — asked, since nothing
                       implies one)
   ↓
Visibility
   ↓
Author
   ↓
Done — appears in Experience Home; if attached, also appears at its
       Host; if Free, appears roaming its chosen Scene
```

**Reuse Existing**, from any of the three entry points, is a short-
circuit of the same flow: pick an existing Public Experience instead of
authoring a new one, confirm attachment (inferred or asked, same rule),
skip Visibility and Author entirely, Done.

---

## Part 2 — Museum Theme Walkthrough

Grounded in Museum Gallery's own real, currently-authored content — the
seven Frame Variations (Classic White, Warm Ivory, Natural Linen, Dark
Gallery, Floating Frame, Black Matte, Gold Accent) and its Museum
Caption fields (Title/Artist/Age/Date) — not invented examples.

**Starting point:** Museum Gallery has three Scenes seeded from its
Showcase/Portrait/Quote Representations. The Theme Author opens
**Gallery Portrait**, a Scene with one Place ("Gallery Wall") grouping
three Holders, each meant to show a different piece of art with the
same frame treatment.

1. **Reusing Classic White across three Holders.** Today (Builder V2),
   each Holder picks "Classic White" independently from `frames/*.json`
   — three separate picks that happen to reference the same Frame
   object already (Builder V2's existing Frame model is already
   reference-based, one `frames/classic-white.json` file). Under
   Experience Architecture: the Theme Author opens Holder 1, "+ Add
   Experience," chooses Type: Frame, Visibility: **Public** (so it can
   be found again from Holder 2 and Holder 3), authors its eight
   fields. For Holder 2 and Holder 3, they instead choose **"Reuse
   Existing Experience"** and pick Classic White Frame directly —
   **no re-authoring the same eight fields three times.** This is a
   genuine improvement over today only if Public reuse is
   materially faster than "pick from a list of Frame files," which it
   already effectively is today — the real gain here is Experience
   Home's Usage view (next), not the reuse mechanic itself, which
   Builder V2 already had in a narrower form.

2. **Auditing before editing a shared Experience.** The Theme Author
   later wants Classic White's mat slightly wider for a different
   World entirely ("Museum Entrance"). Opening Classic White Frame from
   Experience Home shows **"Used in 7 Hosts"** — expanding Usage lists
   every Scene/Holder pair (§1.6). Seeing "Gallery Portrait, Holder 2"
   and "Gallery Portrait, Holder 3" in that list is exactly the
   safeguard the overhaul asks for: **the Theme Author now knows editing
   this Frame changes six other places too**, not just the one they had
   in mind. This is the walkthrough's clearest, most concrete win — it
   solves a real problem Builder V2 has no answer for today (Frame
   reuse exists, but nothing today shows "where else is this used"
   before you touch it).

3. **A friction point, surfaced by the walkthrough itself, not
   speculated in advance:** the Usage view *shows* the impact but does
   not *gate* the edit — nothing in §1.6's wireframe stops the Theme
   Author from changing Classic White's mat width immediately after
   viewing Usage, silently reshaping all seven Hosts. Compare this to
   Museum Theme's own real need here: they wanted a wider mat for
   Museum Entrance *only*, not for Gallery Portrait too. Under this
   design, satisfying that need means "Duplicate," not "edit in place"
   — but the wireframes don't yet say what Duplicate does to
   Visibility (does the new copy start Private, so it can't
   accidentally spread the same way? Or Public, matching its source?)
   or Attachment (does it start attached to nothing, one Host, or
   copy every attachment the original had?). **This is a real, concrete
   open question the walkthrough surfaced, not an invented one** — see
   Part 3.

4. **Adding the Museum Label.** From Holder 1, "+ Add Experience" →
   Type: Text → Visibility: Private (this Scene's own caption, not
   meant for reuse) → Author: Title "Sunlit Orchard," Artist "Priya M.,
   Age 8," Date "March 2026" — the same four fields Museum Gallery's
   existing Museum Caption (Sprint 9.7) already composes. No friction
   here: Text-as-an-Experience-type maps cleanly onto what already
   exists; nothing about this needed inventing.

5. **A Public Scene-level Experience — Paper Texture.** The Theme
   Author wants the same warm paper texture behind every Scene in this
   World. From Scene Workspace's Quick Actions: "+ Add Experience" →
   Type: Image → Visibility: **Public** → authored once on Gallery
   Portrait, then **Reuse Existing** from the other two Scenes. Clean —
   this is exactly the composability the overhaul's acceptance
   criterion asks for: a new Scene-level visual idea, added without
   touching Scene's own structure at all.

6. **A Free Experience — Floating Butterfly.** The Theme Author adds a
   decorative butterfly that should drift near the top-right corner of
   Gallery Portrait specifically, independent of any Holder. From Scene
   Quick Actions: Type: Decoration → Attachment: **Free** (asked, since
   Quick Actions only infers Scene-vs-Holder, not Free-vs-Attached — see
   Part 3) → Visibility: Private → positioned by dragging directly in
   Working View, per Experience Canon §4's "Free Experiences own
   position, size, rotation, scale."

7. **A second friction point, surfaced here directly:** the Theme
   Author later wonders whether this same butterfly could roam Space
   Gallery too, without re-authoring it — the natural next thought
   after having just done exactly that for Paper Texture (step 5). But
   Paper Texture is **Attached** (to a Scene, inheriting that Scene's
   bounds) while Floating Butterfly is **Free** (owning its own
   position). Marking Floating Butterfly Public and reusing it in Space
   Gallery raises a question the wireframes don't yet answer: **whose
   position wins** — does the reused copy start at the same fractional
   position it roams in Gallery Portrait, independently draggable
   per-Scene from then on, or does one shared position apply
   everywhere the Public Free Experience is used, so dragging it in one
   Scene moves it in all of them? Both are defensible; neither is
   decided by anything written so far. See Part 3.

8. **Validation, unchanged in kind.** Running Validation still reports
   pass/fail grouped by category (Blueprint §12) — Experiences add one
   more group ("Experiences: 7 Public, 4 Private, 1 Unused") without
   changing the screen's own shape. "Unused" (Wax Seal, authored once,
   never attached anywhere) reads naturally as a Validation warning
   candidate — not decided here, but a natural, low-risk extension
   Validation's existing category-grouped model already supports
   without redesign.

---

## Part 3 — Friction Log

Ranked by what actually blocked or slowed the walkthrough, not by
theoretical concern:

1. **Canon Conflict — "Place" as new Foundation structure vs. the
   existing Place=Holder rename** (§0, Conflict 1). Blocking: the Place
   Workspace wireframe cannot be finalized until this is resolved either
   way. Needs an explicit product decision before implementation.
2. **Canon Conflict — "Artwork" as an attached Experience risks
   contradicting Engine Invariant 10/11** (§0, Conflict 2). Blocking for
   the same reason. Needs confirmation that "Artwork" always means the
   existing representative/preview mechanism, never new permanent
   Holder content.
3. **Open design question — editing a Public, widely-used Experience
   has no confirmation or safeguard beyond the Usage readout itself**
   (walkthrough step 3). Not a Canon Conflict — an acceptance-quality
   gap the walkthrough exposed directly. Needs a decision: does editing
   a Public Experience always ripple silently to every attachment (by
   design — that's what "Public" means), with Usage serving only as
   an informational check the Theme Author can choose to consult first?
   Or does Builder need a lightweight confirmation step ("this changes
   7 Hosts — continue?") before committing the edit? Recommend treating
   this as the single most important open item to settle before
   implementation, since it directly protects against real, silent,
   hard-to-notice damage to a Theme.
4. **Open design question — Duplicate's effect on Visibility and
   Attachment is undefined** (walkthrough step 3). Does a duplicated
   Experience start Private and unattached regardless of its source, or
   copy the source's Visibility/Attachment? Needs a decided rule before
   Experience Home's toolbar (§1.5) can be considered final.
5. **Open design question — a Public Free Experience's position is
   ambiguous** (walkthrough step 7): shared across every reuse, or
   independent per attachment? This is new — Attached Experiences never
   raise it, since their position is always Host-derived (Experience
   Canon §4, "Attached Experiences… cannot redefine those properties").
   It is specifically the combination of Free (owns its own transform)
   and Public (reusable) that has no answer yet.
6. **Open design question — Free Experience roaming bounds.** Carried
   forward, not newly discovered: `docs/BUILDER_V2_UX_PACKAGE.md`'s own
   Open Question 2 ("should dragging past Safe Area be a hard
   constraint or a soft guide") was already unresolved for a Place; a
   Free Experience roaming a Scene raises the identical question with
   higher stakes, since "roam freely within a Scene" (Experience Canon
   §4) is Free's whole reason for existing. Recommend resolving both
   together, not separately.
7. **Probable omission — Build missing from Global Navigation** (§1.1).
   Low-risk, easily confirmed either way; flagged so it isn't silently
   dropped or silently restored without someone actually deciding it.
8. **No friction found in:** Frame's existing eight fields mapping onto
   Experience Inspector Properties (walkthrough step 1); Text-as-an-
   Experience-type onto the existing Museum Caption (step 4); a
   Scene-level Public Image Experience for shared backgrounds (step 5);
   Validation's category-grouped model absorbing an "Experiences" group
   (step 8). These transfer cleanly and needed no design decision beyond
   what this document and the Experience Canon already state.

---

## Cross-references

- `docs/BUILDER_V2_EXPERIENCE_CANON.md` — the philosophy and ownership
  model these wireframes make concrete; untouched by this document.
- `docs/ENGINE_V2_CANON.md` — Engine Invariants 10/11 (Conflict 2) and
  the frozen object tree (Conflict 1) this document's conservative
  readings are chosen to preserve.
- `docs/ENGINE_V2_SCENE_MODEL.md` §7 — the still-open Holder Layer/
  Content Layer authoring question this overhaul's Holder Workspace
  (§1.4) will eventually need resolved, not resolved here.
- `docs/BUILDER_V2_VISION.md` §5 — the existing Place=Holder vocabulary
  rename that Conflict 1 (§0) must be reconciled against.
- `docs/BUILDER_V2_UX_PACKAGE.md` Part 7, Open Question 2 — the Safe
  Area hard-vs-soft-constraint question this document's Friction item 6
  carries forward rather than reopens independently.
- `docs/AUTHORING_FINDINGS.md` — where the Museum Theme evidence this
  walkthrough is grounded in (Frame Variations, Museum Caption) is
  recorded in full.

---

## Change History

- v1.0 — Initial paper wireframes for Builder V3's Experience
  Architecture: Navigation, Scene Workspace, Place Workspace, Holder
  Workspace, Experience Home, Experience Inspector, Experience Creation
  Flow, a Museum Theme walkthrough, and a friction log. Two Canon
  Conflicts flagged, unresolved. Not implemented; pending review and
  approval before any development work begins.
