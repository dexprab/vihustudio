# Builder V3 — Experience Studio (UX Package & Paper Validation)

**Status:** Draft — paper stage only, pending review. No implementation
accompanies this document. It extends, and in one place supersedes,
`docs/BUILDER_V3_WIREFRAMES.md`: the Lifecycle model below
(Nurturing → Personal → Public) replaces that document's earlier
Visibility axis (Public/Private) as the primary maturity concept.
Attachment (Attached/Free) is unchanged in meaning from that document.
**Both Canon Conflicts flagged in `docs/BUILDER_V3_WIREFRAMES.md` §0
carry forward here, unresolved** — this document does not decide
either; see §0 below.
**Scope:** The complete Experience Studio — navigation, the Experience
Lifecycle, Experience Home as a creative gallery, the Experience Card,
the Inspector-vs-dedicated-workspace question, the Promotion workflow,
Public reuse, contextual authoring, the Usage Explorer — validated
against a full paper walkthrough of Museum Theme authoring, with every
friction point the walkthrough actually surfaced recorded, not
speculated. No code, no components, no data structures.

---

## 0. Carried forward, unresolved

Two Canon Conflicts from `docs/BUILDER_V3_WIREFRAMES.md` §0 are neither
resolved nor reopened by this document:

1. **"Place" as a new Foundation tier vs. the existing Place=Holder
   rename** (Vision §5). This document's own Experience Organization
   brief (§3) lists **Scene Foundations / Holder Foundations / Free
   Experiences** — notably, no "Place Foundations" category — which is
   mild corroborating evidence for the conservative reading already
   adopted (Place as a Builder-only grouping label, not a new
   attachment point), but it is evidence, not a decision. Still pending
   explicit sign-off.
2. **"Artwork" as an attached Experience vs. Engine Invariant 10/11.**
   Not mentioned in this task's brief at all; the conservative reading
   (representative/preview artwork only, never permanent Story-Author
   content) is carried forward unchanged.

One new scope question this document's own brief raises, addressed
directly in §12: **"Builder should stop using the word Draft… replace
it throughout Builder"** — read narrowly here, as scoped to Experience
terminology only. Builder V1's existing World Project "draft" status
label (Sprint B2.0.5, "My World Projects," "draft · edited Xh ago") is
a different, unrelated concept (a World's publication readiness, not an
Experience's creative maturity) and is not touched by this document. A
Theme-Author-facing global rename sweep, if wanted, is a separate,
disclosed decision — not silently assumed here.

---

## Part 1 — Updated Builder Navigation

```
World │ Scenes │ Experiences │ Validation │ Build │ Publish    [Save●]
```

Unchanged from `docs/BUILDER_V3_WIREFRAMES.md` §1.1, with one
confirmation: this task's own navigation list includes **Build**
between Validation and Publish, resolving that document's Friction item
7 (Build's earlier absence was a probable omission, not a decision).

---

## Part 2 — Experience Lifecycle

Three creative states, replacing the earlier Visibility axis entirely
— not an addition alongside it:

| State | Meaning | Can attach? | Visible in Theme? | Reusable? |
|---|---|---|---|---|
| 🌱 **Nurturing** | Still evolving, protected | No | No — exists only in Experience Studio | N/A |
| 👤 **Personal** | Matured, scoped to one Scene | Yes | Yes, within its one Scene | No |
| 🌍 **Public** | Part of the Theme | Yes | Yes, everywhere | Yes, across any compatible Host |

**Attachment (Attached/Free) is orthogonal, not a fourth Lifecycle
state.** A Frame is naturally Attached; a Floating Butterfly is
naturally Free; either can independently be Nurturing, Personal, or
Public. The two axes combine, they don't collapse into one.

**A Nurturing Experience has an intended Type and an intended
Attachment kind from the moment it's created** (chosen once, in the
Creation Flow — "this will be a Frame, meant to Attach" or "this will
be a Butterfly, meant to roam Free") — but zero actual placements. This
is what makes it invisible in the Theme: there is nothing anywhere for
it to be visible *as*, yet.

**Promotion is one-directional in intent, but not irreversible in
practice** — see Part 6 for the concrete workflow and the one real
open question the walkthrough surfaced about demotion.

---

## Part 3 — Experience Organization & Experience Home

**Two zones, not one list**, discovered necessary during paper-walking
Part 10 rather than assumed up front: **The Gallery** (Personal and
Public Experiences — the Theme's real, placeable material) and **The
Nursery** (Nurturing Experiences — protected, still-forming ideas).

### Why the Nursery must be separate — validated, not assumed

Paper-testing a single, unified list (Part 10, step 6) surfaced a
concrete problem: a half-finished Wax Seal sketch (Nurturing, no
attachment yet, no usage) sitting in the same "Free Experiences ›
Personal" shelf as a fully-placed Floating Butterfly (Personal, Free,
attached and roaming a real Scene) reads as visually indistinguishable
— both are "Free, unattached-looking, low usage." A Theme Author
scanning the Gallery for reusable material has no fast way to tell
"this is ready" from "this is still an idea." Isolating Nurturing into
its own zone — **The Nursery** — resolves this directly: nothing in The
Gallery is ever less than Personal, so everything a Theme Author
browses there is, by construction, already real and usable.

### The Gallery — organized by Foundation first, per the brief

```
Experiences
──────────────────────────────────────────────────────
[ The Gallery ]   [ The Nursery (3) ]
──────────────────────────────────────────────────────
Scene Foundations │ Holder Foundations │ Free Experiences
──────────────────────────────────────────────────────
  Personal  │  Public
──────────────────────────────────────────────────────
  🎨 Paper Texture              Public   Used by 4 Scenes
  📝 Museum Label — Gallery Portrait   Personal   1 Scene
  ...
```

Foundation (Scene/Holder/Free) is the outer grouping because it answers
"where would this even go" — the question a Theme Author asks before
"is it mine alone or shared." Personal/Public is the inner tab because
it's a finer-grained filter *within* an already-meaningful group,
matching exactly how `docs/BUILDER_V3_WIREFRAMES.md`'s two-axis filter
row already established Attachment and Visibility as independent,
combinable narrowings — this document simply renames the second axis
from Visibility to Lifecycle-stage-within-The-Gallery.

### The Nursery — a distinct shelf, not a filtered view

```
The Nursery — Still Growing
──────────────────────────────────────────────────────
🌱 Wax Seal            (intends: Free, Decoration)
🌱 Gold Accent v2       (intends: Attached, Frame)
🌱 New caption idea     (intends: Attached, Text)
──────────────────────────────────────────────────────
+ New Idea
```

No Personal/Public tabs here — meaningless before promotion. Loosely
grouped by intended Type only, since intended Attachment/Foundation
fit isn't settled until the Theme Author starts really placing it. The
tone is deliberately different: "Still Growing," "+ New Idea" — plain,
warm language, never "Draft," matching the brief's own instruction.

---

## Part 4 — Experience Card

**A miniature composition, not a database row.** The preview renders a
tiny version of the Experience *in context* — a small Scene or Host
shape with the Experience painted inside it, using the same Runtime
rendering `docs/BUILDER_V2_EXPERIENCE_CANON.md` §5 already requires
(never a second implementation) — because for a Nurturing Experience,
this miniature *is the only place it can be seen at all* (§2 — it's
invisible everywhere else). This single fact is what makes "preview
first, metadata second" a genuine requirement, not a stylistic
preference: without a rendered preview, a Nurturing Idea has no visual
existence anywhere in Builder.

```
┌───────────────────────────┐
│  ┌─────────────────────┐  │
│  │  [miniature render]  │  │  ← tiny Host/Scene, Experience painted in
│  │   🖼  (framed photo)  │  │
│  └─────────────────────┘  │
│  Classic White Frame       │
│  "A clean museum mat and   │
│   thin white border."      │
│  Frame · Attached · 🌍     │
│  Used by 7 Hosts            │
│  #museum #classic #white   │
└───────────────────────────┘
```

Every required field present, in one deliberate order: **see it, name
it, understand it, place it, gauge its reach, find it again** — render
→ name → description → type/attachment/lifecycle → usage → tags. The
lifecycle badge (🌱/👤/🌍) is the single glanceable signal that answers
"can I even use this yet," matching Part 2's table exactly.

---

## Part 5 — Experience Inspector (and the dedicated-workspace question)

**Validated via paper authoring: Inspector-based, not a dedicated
Experience Workspace — with one bridge affordance for Free
Experiences specifically.**

### Why Inspector-only is sufficient for Attached Experiences

An Attached Experience "inherits bounds, coordinate space, clipping,
movement from its Host" and "cannot redefine those properties" (Canon
§4) — meaning it has **no spatial fields at all** to edit. Its
Inspector is purely identity + type-specific properties:

```
Experience
──────────────────────────────
Name         Classic White Frame
Type         Frame
Attachment   Attached
State        🌍 Public
Host         7 Hosts →
──────────────────────────────
Properties
  Mat Width         [24]
  Frame Thickness   [2]
  Border Colour     [■ #FFFFFF]
  Wall Tone         [■ #FFFFFF]
  Shadow            (soft ▾)
```

No canvas is missing here because none was ever needed — this
paper-confirms a dedicated Workspace would have added a whole region
for nothing to draw in it.

### Why Free Experiences need one bridge, not a dedicated Workspace

A Free Experience *owns* position/size/rotation/scale (Canon §4).
Builder V2 already has precedent for editing spatial fields as plain
numbers without a live canvas — Holder's own Position X/Y and Size W/H
fields work this way in today's Context Inspector — so **numeric
fields alone are sufficient to make a Free Experience's Inspector
functionally complete**:

```
Experience
──────────────────────────────
Name         Floating Butterfly
Type         Decoration
Attachment   Free
State        👤 Personal — Gallery Portrait
──────────────────────────────
Position     X [0.82]   Y [0.10]
Rotation     [12°]
Scale        [0.8]
──────────────────────────────
Properties
  Glyph      🦋
──────────────────────────────
[ Adjust in Scene → ]
```

But paper-walking real placement (Part 10, step 5) confirmed what
`docs/AUTHORING_FINDINGS.md`'s entire authoring history already
predicts: fine spatial placement is always more natural by drag than by
typing four numbers, the same lesson AV-006/AV-010 already spent real
effort proving for text. Rather than build a second rendering surface
to support dragging inside Experience Home, **"Adjust in Scene"** jumps
directly to that Experience's own attached Scene, opens Working View
there with the Experience already selected — reusing the existing
selection-driven Context Inspector pattern (Blueprint §6.1) in reverse,
the same "shortcut, not a duplicate editor" principle this whole
overhaul already commits to. Numeric fields stay in Experience Home's
Inspector for quick nudges and for Nurturing Experiences with nowhere
to jump to yet; drag remains available the moment there's a real Scene
to drag inside.

**Conclusion: one Inspector, contextual to Attachment kind, plus one
jump-to-context bridge for Free Experiences. No second Workspace.**

---

## Part 6 — Experience Promotion Workflow

```
🌱 Nurturing
   │  "This is ready — where does it belong?"
   ▼
👤 Personal            (choose: which Scene does this belong to)
   │  "This works well here — should it be part of the Theme?"
   ▼
🌍 Public               (no further input needed — becomes
                         discoverable/reusable from any Scene or
                         compatible Host)
```

**Promoting Nurturing → Personal asks one question: which Scene.**
This is the moment "belongs to one Scene only" becomes concrete — not
a specific Holder yet (that's attachment, a separate, later action),
just which Scene's Gallery this Experience now lives in.

**Promoting Personal → Public asks nothing** — its existing single
attachment (if any) is untouched; it simply becomes visible and
reusable from every other Scene/Holder's "Reuse Existing" picker from
this point forward.

### The one open question the walkthrough surfaced: demotion

Paper-walking Part 10 (step 7) hit a real scenario: a Theme Author
promotes a Frame to Public, reuses it in three Scenes, then realizes it
was premature — they wanted to keep iterating on it privately a while
longer. **Nothing in the brief defines what happens to those three
existing attachments if a Public Experience is demoted back to
Personal**, which by definition belongs to only one Scene. Two honest
options, neither decided here: (a) demotion is blocked while more than
one Host uses it — Usage itself becomes the gate; or (b) demotion is
allowed, and every attachment beyond the one chosen Scene is silently
detached, which is a real, potentially surprising data change disguised
as a lifecycle label change. **Recommend (a)** — treat multi-Host usage
as a hard block on demotion, the same way this document already treats
Usage as a hard governance concept elsewhere (Part 9) — but this is
this document's own recommendation, not yet a confirmed decision.

---

## Part 7 — Public Experience Reuse Workflow

```
Holder 2 › + Add Experience
   ↓
[ Create New ]     [ Reuse Existing ]  ← chosen
   ↓
Browse Public Experiences (Frame · Text · Image · Decoration filters)
   ↓
🖼 Classic White Frame  🌍 Public · Used by 7 Hosts
   ↓
Attach to Holder 2 — done, appears immediately
```

Unchanged in shape from `docs/BUILDER_V3_WIREFRAMES.md` §1.7's "Reuse
Existing" short-circuit, now explicit that only **Public** Experiences
appear in this picker — Personal Experiences belong to one Scene and
are never offered to a different Scene's Holder, which is exactly what
"not reusable elsewhere" (Part 2) means in practice, made concrete here
for the first time.

---

## Part 8 — Contextual Authoring Workflow

```
Holder 1                              Scene (Quick Actions)
──────────────────────                ──────────────────────
Attached Experiences                  + Add Experience
  Frame — Classic White                Reuse Existing Experience
  Museum Label
──────────────────────
+ Add Experience
Reuse Existing Experience
```

Unchanged in mechanism from `docs/BUILDER_V3_WIREFRAMES.md` §1.2/§1.4 —
every shortcut opens the same Creation Flow or the same Reuse picker
(Part 7), pre-attached to whichever Host it was opened from, and
returns focus there on completion. **Experience Home remains the single
source of truth** (every shortcut is a door into the same room, never a
copy of it) — this is the one principle every contextual entry point in
this document is checked against.

---

## Part 9 — Usage Explorer

```
Classic White Frame — Used By 7 Hosts
──────────────────────────────────────
✓ Museum Entrance      Holder 1
✓ Museum Entrance      Holder 2
✓ Dinosaur Gallery     Holder 3
✓ Space Gallery        Holder 1
✓ Gallery Portrait     Holder 2
✓ Gallery Portrait     Holder 3
✓ Reading Wall         Holder 1
```

Unchanged from `docs/BUILDER_V3_WIREFRAMES.md` §1.6, now explicitly
framed as **governance**, not merely information: per Part 6's
recommendation, Usage is the gate that decides whether an edit or a
demotion is safe to make silently or needs to be stopped and confirmed.
"Used by 1 Host" / "5 Hosts" / "12 Hosts" is the glanceable number every
Card (Part 4) and every Inspector (Part 5) already surfaces before a
Theme Author ever opens this detail view.

---

## Part 10 — Museum Theme Paper Walkthrough

Grounded in Museum Gallery's real content — its seven Frame Variations
(Classic White, Warm Ivory, Natural Linen, Dark Gallery, Floating
Frame, Black Matte, Gold Accent) and its Museum Caption fields
(Title/Artist/Age/Date).

1. **Creating a Foundation.** The Theme Author already has "Gallery
   Portrait" (a Scene) with a "Gallery Wall" Place grouping Holder 1–3
   (per the conservative Place reading, §0). No friction — Foundation
   authoring is genuinely unchanged from Builder V2/`BUILDER_V3_WIREFRAMES.md`.

2. **Creating an Experience — starting Nurturing.** From The Nursery,
   "+ New Idea" → Type: Frame → authors a rough mat/border/wall-tone
   combination, sees it only as its own Card's miniature render (no
   Scene shows it yet, since Nurturing is invisible in the Theme, §2).
   No friction — this is exactly the "protected space to iterate" the
   brief asks for, and the Card preview (Part 4) is what makes it
   possible to judge the idea at all before it touches anything real.

3. **Promoting Nurturing → Personal.** Satisfied with the mat/border
   combination (it will become "Classic White"), the Theme Author
   promotes it, choosing Scene: Gallery Portrait (Part 6). It now
   belongs to Gallery Portrait alone — attaching it to Holder 1 is a
   separate, immediate next step (Part 8's Holder shortcut). No
   friction.

4. **Promoting Personal → Public.** Wanting the same Frame on Holder 2
   and Holder 3 too — and eventually reused for "Museum Entrance" and
   "Dinosaur Gallery," different Worlds' Scenes entirely — the Theme
   Author promotes Classic White to Public. No further input required
   (Part 6). It is now discoverable via "Reuse Existing" (Part 7) from
   any Holder anywhere in the World.

5. **Reusing across the Gallery Wall, and a real spatial case for
   Free.** Holder 2 and Holder 3 each "Reuse Existing" → Classic White.
   Separately, the Theme Author adds a Floating Butterfly (Free,
   Decoration) directly on Gallery Portrait, typing rough X/Y into the
   Inspector's numeric fields (Part 5) from Experience Home, then
   clicking **"Adjust in Scene"** to actually drag it into the exact
   corner they want against the real rendered page. This is the
   concrete moment that validated Part 5's hybrid conclusion — typing
   alone felt approximate; the drag, once available, felt right
   immediately. No friction once the bridge exists; **would have been
   real friction (imprecise placement, repeated guess-and-check typing)
   without it.**

6. **Editing a shared, widely-used Experience.** The Theme Author opens
   Classic White from The Gallery, sees "Used by 7 Hosts" on the Card
   before even opening it, opens Usage (Part 9), confirms which seven,
   and only then adjusts its mat width slightly — an informed edit, not
   a blind one. **This validates the whole reason Usage exists as a
   first-class concept** — the Theme Author genuinely paused because of
   what they saw, not because a dialog stopped them.

7. **A real friction point: demotion.** Having reused Classic White
   across three Scenes, the Theme Author has second thoughts about one
   specific detail and wants to "pull it back" to Personal to iterate
   more freely, without affecting the other Scenes yet. **Nothing in
   the brief or in this document's Part 6 fully resolves what demotion
   does to the other six attachments** — recorded as Friction item 1
   below, not invented for the sake of finding something to report; it
   is the one genuine gap this walkthrough actually hit.

8. **Managing a Nursery item that never graduates.** Wax Seal, sketched
   early, never gets promoted — it simply sits in The Nursery
   indefinitely. Confirmed: this is fine, not an error state, and
   critically **different from "Unused."** "Unused" (a Gallery concept,
   Part 3/§1.5 of the prior wireframes) means a Personal/Public
   Experience with zero current attachments — something that graduated
   and then stopped being used. A Nursery item that never graduated was
   never attached in the first place; conflating the two would
   incorrectly imply something is broken when nothing is. No friction —
   this distinction simply needed to be stated explicitly (now recorded
   in Part 11 as a design confirmation, not a gap).

9. **Validation.** Running Validation reports Experiences grouped
   alongside existing categories (Blueprint §12's unchanged shape) — no
   friction; Nurturing Experiences are correctly excluded from
   Validation entirely, since they aren't part of the Theme yet (§2).

---

## Part 11 — UX Friction Log

Ranked by what the walkthrough actually hit, not by theoretical concern:

1. **Demotion's effect on existing multi-Host attachments is
   undefined** (walkthrough step 7). This is the single most consequential
   open item — an under-specified demotion path risks silently breaking
   a Theme's other Scenes the first time a real Theme Author uses it.
   Part 6 records a recommendation (block demotion above one attachment)
   but it is not yet a confirmed decision.
2. **Canon Conflicts carried forward, still open** (§0) — Place-as-new-tier
   and Artwork-as-Experience. Neither newly surfaced by this pass, but
   neither resolved by it either; both still block a fully confident
   Foundation/Experience boundary.
3. **"Draft" removal scope is ambiguous** (§0) — read narrowly here
   (Experience terminology only); a broader Builder-wide sweep, if
   wanted, needs its own explicit instruction rather than inference
   from this brief.
4. **No friction found in:** Nurturing→Personal→Public promotion itself
   (steps 2–4); Public reuse across multiple Holders (step 5's Frame
   half); Usage-informed editing (step 6); the Nursery/Gallery split
   (step 2, validated directly against the Wax Seal case in step 8);
   Validation absorbing Experiences without a category redesign (step
   9). These all transferred cleanly from the brief with no design gap
   left unanswered.
5. **Confirmed by the walkthrough, not merely asserted:** typed numeric
   position fields alone are workably sufficient for a Free
   Experience's *first* placement, but real fine-tuning wants a live
   canvas — validating Part 5's Inspector-plus-bridge conclusion with
   an actual scenario (step 5) rather than reasoning about it in the
   abstract.

---

## Part 12 — Final UX Recommendation

**Adopt this design as drawn, with two items requiring explicit
decision before implementation, and one requiring only confirmation:**

- **Requires decision:** demotion's effect on existing attachments
  (Friction 1) — recommend blocking demotion above one attachment,
  per Part 6, but this needs sign-off, not inference.
- **Requires decision:** both carried-forward Canon Conflicts (Friction
  2) — Place-as-new-tier and Artwork-as-Experience — neither should be
  allowed to reach implementation undecided, since Foundation stability
  is this whole overhaul's own stated non-negotiable.
- **Requires confirmation only:** "Draft" removal's scope (Friction 3)
  — this document's narrow reading (Experience terminology only) is
  reasonable but should be confirmed, not assumed, before any existing
  World Project copy is touched.

**Everything else validates cleanly:** Inspector-based authoring (no
dedicated Experience Workspace) with one jump-to-Scene bridge for Free
Experiences; the Gallery/Nursery split as the mechanism that keeps
Nurturing ideas from cluttering real, placeable material; Foundation-
first organization inside the Gallery; Usage as a governance concept
that actually changed behavior during the walkthrough, not just an
information panel. Museum Theme authoring, walked through in full,
never once needed Builder to expose a Layer, a Z-Order, a render pass,
or any technical vocabulary — every decision was phrased as "what is
this," "where does it belong," "who else is using it," matching the
success criteria's own framing exactly. **Experience Studio, as
designed here, is ready for review — implementation should wait on the
three items above, not on anything else in this document.**

---

## Cross-references

- `docs/BUILDER_V3_WIREFRAMES.md` — the prior paper pass this document
  extends; its two Canon Conflicts (§0) carry forward unresolved; its
  Visibility (Public/Private) axis is superseded by this document's
  Lifecycle model.
- `docs/BUILDER_V2_EXPERIENCE_CANON.md` — the ownership/philosophy model
  (Attachment, Ownership belongs to the Theme) this document assumes
  unchanged throughout.
- `docs/ENGINE_V2_CANON.md` / `docs/ENGINE_V2_SCENE_MODEL.md` — untouched;
  no Engine or Scene Model implication introduced by the Lifecycle model,
  which is Builder-only bookkeeping (a state label on an Experience, not
  a new Engine concept).
- `docs/BUILDER_V2_BLUEPRINT.md` §6.1 — the selection-driven Context
  Inspector pattern "Adjust in Scene" (Part 5) reuses in reverse.
- `docs/AUTHORING_FINDINGS.md` / AV-006 / AV-010 — the prior, real
  evidence that spatial authoring wants direct manipulation over typed
  numbers, which this document's Part 5/step 5 finding is consistent
  with rather than independently rediscovering from nothing.

---

## Change History

- v1.0 — Initial Experience Studio UX package: the Lifecycle model
  (Nurturing/Personal/Public) replacing Visibility, the Gallery/Nursery
  split, the Experience Card, the Inspector-plus-bridge conclusion for
  Free Experiences, the Promotion workflow, and a full Museum Theme
  paper walkthrough with its friction log. One new open item (demotion)
  and two carried-forward Canon Conflicts flagged as blocking; not
  implemented pending review and approval.
