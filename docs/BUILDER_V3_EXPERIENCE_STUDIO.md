# Builder V3 — Experience Studio (UX Package & Paper Validation)

**Status:** Draft — paper stage only, pending review; amended in v1.1
(see Change History) against a set of frozen Canon Decisions. No
implementation accompanies this document. It extends, and in one place
supersedes, `docs/BUILDER_V3_WIREFRAMES.md`: the Lifecycle model below
(Nurturing → Personal/Public, a fork not a ladder as of v1.1) replaces
that document's earlier Visibility axis (Public/Private) as the primary
maturity concept. Attachment (Attached/Free) is unchanged in meaning
from that document. **Of the two Canon Conflicts flagged in
`docs/BUILDER_V3_WIREFRAMES.md` §0, one (Artwork-as-Experience) is now
resolved by omission; one ("Place" as a new Foundation tier) remains
genuinely open** — see §0 below.
**Scope:** The complete Experience Studio — navigation, the Experience
Lifecycle, Experience Home as a creative gallery, the Experience Card,
the Inspector-vs-dedicated-workspace question, the Graduation workflow,
Public reuse, contextual authoring, the Usage Explorer — validated
against a full paper walkthrough of Museum Theme authoring, with every
friction point the walkthrough actually surfaced recorded, not
speculated. No code, no components, no data structures.

---

## 0. Carried forward — one resolved, one still open, two confirmed by the continuation pass

`docs/BUILDER_V3_WIREFRAMES.md` §0 flagged two Canon Conflicts and this
document's own v1.0 flagged a third open item (demotion). The
continuation brief ("Builder V3 — Experience Studio (Paper Design
Continuation)") resolves or corroborates three of these directly:

1. **"Place" as a new Foundation tier vs. the existing Place=Holder
   rename — still genuinely open.** The continuation brief restates
   the Foundation diagram unchanged and declares "Foundation is now
   considered stable." That freezes the *diagram*, but does not by
   itself answer the specific technical question this document keeps
   flagging: is Place a new persisted Engine ownership tier, or a
   Builder-only grouping label over Holders that still belong directly
   to their Scene? Stability of the drawing and resolution of what it
   means underneath are two different things. Recorded once more here,
   briefly, rather than re-argued at length — this is the one item this
   document still cannot close on its own.
2. **"Artwork" as an attached Experience — resolved by omission,
   confirmed.** The continuation brief's own Experience examples
   ("Frames, Decorations, Atmosphere, Lighting, Text Styles, Effects,
   Future enrichments") no longer include Artwork at all. This
   corroborates the conservative reading already adopted (Artwork,
   wherever it's discussed, means the existing representative/preview
   mechanism, never permanent Holder content) strongly enough to
   consider it settled rather than merely carried forward.
3. **Demotion — resolved by Canon Decision #8, "Theme Experiences are
   permanent."** v1.0's Friction item 1 (what happens to a Public
   Experience's other attachments if it's pulled back to Personal) is
   now moot: there is no demotion path at all. A Theme Experience
   (Personal or Public) may evolve, be hidden, or eventually be
   archived — it is never deleted and never returned to the Nursery.
   Delete exists only inside the Nursery. See Part 6's rewritten
   Promotion (now Graduation) workflow.
4. **"Draft" removal scope — confirmed exactly as this document's v1.0
   already read it.** The continuation brief states directly: "This
   rename applies only to Experience terminology… Do not rename
   unrelated Builder concepts such as Project Drafts or publication
   status." No further action needed — v1.0's narrow reading stands,
   confirmed rather than merely assumed.

One small new open question the continuation brief's own wording
introduces, not yet significant enough to block anything: **is
"Archived" a distinct state from "Hidden," or a further description of
the same thing?** ("It may become hidden. It may eventually become
archived.") Recorded in Part 11, not resolved here — low-stakes, since
neither changes Delete's Nursery-only rule either way.

### Frozen Canon Decisions

Adopted verbatim from the continuation brief, governing every Part
below:

1. Foundation remains unchanged.
2. Experiences enrich Foundation.
3. Experience Home owns every Experience.
4. Nursery contains Nurturing ideas.
5. Gallery contains Theme Experiences.
6. Personal and Public are ownership scopes.
7. Attachment is independent.
8. Theme Experiences are permanent.
9. Delete exists only for Nurturing Experiences.
10. Builder remains a storytelling studio, never a graphics editor.

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

Not software inheritance — creative work. Two domains, not a three-step
ladder: the **Nursery** (Nurturing ideas) and the **Theme** (Personal or
Public Experiences, once graduated):

| Domain | State | Meaning | Can attach? | Visible in Theme? | Deletable? |
|---|---|---|---|---|---|
| Nursery | 🌱 **Nurturing** | Still evolving, protected | No | No — visible only inside the Nursery | Yes — the only place Delete exists |
| Theme | 👤 **Personal** | Belongs to one Scene | Yes | Yes, within its one Scene | No — permanent |
| Theme | 🌍 **Public** | Belongs to the Theme | Yes | Yes, everywhere | No — permanent |

```
                Nursery
             🌱 Nurturing
              /         \
             /           \
    👤 Personal       🌍 Public
        Theme Experiences (permanent)
```

**There is no promotion ladder.** Graduation is one decision, not a
forced sequence — an idea may graduate straight to Public, or straight
to Personal, whichever fits. "How should this idea live inside the
Theme?" is the whole question (Part 6). A Personal Experience may
*later* choose to become Public as a separate, additional step — but
nothing ever requires passing through Personal first.

**Attachment (Attached/Free) is orthogonal, independent of ownership.**
A Frame is naturally Attached; a Floating Butterfly is naturally Free;
either can independently be Nurturing, Personal, or Public. The two
axes combine, they don't collapse into one.

**A Nurturing Experience has an intended Type and an intended
Attachment kind from the moment it's created** (chosen once, in the
Creation Flow — "this will be a Frame, meant to Attach" or "this will
be a Butterfly, meant to roam Free") — but zero actual placements. This
is what makes it invisible in the Theme: there is nothing anywhere for
it to be visible *as*, yet.

**Once graduated, an Experience gains permanent identity (Canon
Decision #8).** It may evolve forever, stop being used, become hidden,
or eventually become archived — it is never deleted, and it never
returns to the Nursery. Delete exists only inside the Nursery, where
ideas are still sketches, not yet part of the Theme. See Part 6 for the
graduation workflow this replaces the old promotion ladder with.

---

## Part 2.1 — Canon Alignment Addendum: Hosted By supersedes Attachment

Added by the Builder V3 Canon Alignment Sprint (Change History v1.2).
Implementation work on Milestone 3 exposed a real product-model gap: the
paper design's binary **Attachment** axis (Attached/Free) only had a
name for "lives inside a Place" and "roams a Scene independently" — it
had no way to say "fills the whole Scene" (a full-bleed background, for
instance), even though that is a third, equally real way an Experience
can live in the world. The frozen Canon Alignment product model
resolves this with a three-way **Hosted By** axis: **Place**, **Scene**,
or **Free**. This is a strict superset, not a redefinition — every
Experience that was "Attached" under the old model is "Hosted by
Place" under this one; every Experience that was "Free" stays "Free."
Nothing that could be expressed before stops being expressible.

**Read every other Part of this document's "Attachment"/"Attached"/
"Free" language as this table:**

| This document says (v1.0/v1.1) | Read it as (v1.2+) |
|---|---|
| Attachment (Attached/Free) | Hosted By (Place/Scene/Free) |
| "Attached" | "Hosted by Place" |
| "Free" | "Hosted by Free" (unchanged in meaning) |
| (no equivalent existed) | "Hosted by Scene" (new) |
| "Attach" (the verb/action) | "Host" |
| Attach/Reuse picker, "Attach Here" | Host/Reuse picker, "Host Here" |

This is a terminology and vocabulary change only — the Lifecycle model
(Part 2), the Card (Part 4), the Inspector (Part 5), Graduation (Part
6), Reuse (Part 7), Contextual Authoring (Part 8), and Usage (Part 9)
are otherwise unchanged in shape and behavior; only the word
"Attachment" in each of those Parts should be read through this table
rather than taken as the current, canonical name. See
`docs/BUILDER_V3_CANON_ALIGNMENT_REPORT.md` for the full audit this
addendum summarizes, including which Experience Types can actually
render under each Hosted-By mode today (an Engine Adapter capability
question, not a product-model one — see that report's Engine Adapter
Concepts section).

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
🌱 Wax Seal            (intends: Free, Decoration)     [ Delete ]
🌱 Gold Accent v2       (intends: Attached, Frame)      [ Delete ]
🌱 New caption idea     (intends: Attached, Text)       [ Delete ]
──────────────────────────────────────────────────────
+ New Idea
```

No Personal/Public tabs here — meaningless before graduation. Loosely
grouped by intended Type only, since intended Attachment/Foundation
fit isn't settled until the Theme Author starts really placing it. The
tone is deliberately different: "Still Growing," "+ New Idea" — plain,
warm language, never "Draft," matching the brief's own instruction.
**Delete is visible here and only here** — a sketch on the desk can be
thrown away freely; nothing in the Theme ever shows this action (Part
5, Part 6).

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
│  Frame · Attached · 🌍 Public│
│  Used by 7 Hosts            │
│  #museum #classic #white   │
└───────────────────────────┘
```

Every required field present, in one deliberate order: **see it, name
it, understand it, place it, gauge its reach, find it again** — render
→ name → description → type/attachment/ownership → usage → tags. No
IDs, no technical labels, anywhere on the card — authors recognize
Experiences by what they look like, never by what they're called
internally.

**The card is domain-sensitive, not one fixed template.** A Gallery
card (above) shows ownership (👤/🌍) and Usage, because both are real
and meaningful for a graduated Experience. **A Nursery card drops
both:**

```
┌───────────────────────────┐
│  ┌─────────────────────┐  │
│  │  [miniature render]  │  │
│  │   🕯                 │  │
│  └─────────────────────┘  │
│  Wax Seal                  │
│  "A small wax seal for      │
│   the corner of a page."    │
│  Decoration · Free · 🌱     │
└───────────────────────────┘
```

No ownership field (nothing has been chosen yet), no Usage (nothing
is attached anywhere yet) — showing either would imply a fact that
isn't true yet. This distinction was confirmed, not assumed, during the
walkthrough (Part 10, step 8).

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
Ownership    🌍 Public
Used by      7 Hosts →
──────────────────────────────
Properties
  Mat Width         [24]
  Frame Thickness   [2]
  Border Colour     [■ #FFFFFF]
  Wall Tone         [■ #FFFFFF]
  Shadow            (soft ▾)
──────────────────────────────
[ Hide ]                        ← no Delete — permanent, per Canon #8
```

No canvas is missing here because none was ever needed — this
paper-confirms a dedicated Workspace would have added a whole region
for nothing to draw in it. **The only lifecycle action available on a
Theme Experience is Hide** (and, later, Archive — §0's one remaining
small open question) — never Delete. A Nurturing Experience's
Inspector, by contrast, always shows Delete, never Hide/Archive, since
those are Theme-only concepts for something that isn't in the Theme
yet.

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
Ownership    👤 Personal — Gallery Portrait
──────────────────────────────
Position     X [0.82]   Y [0.10]
Rotation     [12°]
Scale        [0.8]
──────────────────────────────
Properties
  Glyph      🦋
──────────────────────────────
[ Adjust in Scene → ]           [ Hide ]
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

## Part 6 — Experience Graduation Workflow

**Not a ladder — one fork, asked once.** Superseding v1.0's staged
Nurturing→Personal→Public promotion entirely, per Canon: there is no
forced middle step.

```
🌱 Nurturing
   │
   │  "How should this idea live inside the Theme?"
   │
   ├───────────────────────┬───────────────────────┐
   ▼                       ▼
👤 Personal            🌍 Public
(choose: which Scene    (no further input needed —
 does this belong to)    discoverable/reusable from
                          any Scene or compatible Host
                          immediately)
```

**Graduating to Personal asks one question: which Scene.** This is the
moment "belongs to one Scene only" becomes concrete — not a specific
Holder yet (that's attachment, a separate, later action), just which
Scene's Gallery this Experience now lives in.

**Graduating straight to Public asks nothing beyond the choice
itself** — an idea confident enough to be Theme-wide from day one
never has to pass through a Personal stage it doesn't need.

**A Personal Experience may later choose to become Public** — a
one-directional, additional step, not a reversal of anything:

```
👤 Personal  ──"make this available Theme-wide"──▶  🌍 Public
```

**There is no path back.** Once graduated — to Personal or to Public —
an Experience is permanent (Canon #8): it may evolve, be hidden, or
eventually be archived, but it never demotes and never returns to the
Nursery. This closes v1.0's open demotion question outright, rather
than choosing between the two options that document weighed: **neither
applies, because demotion isn't a real workflow at all.** Editing a
widely-used Public Experience still needs Usage-informed care (Part 9)
— that risk doesn't disappear — but it's a risk managed by looking
before editing, never by an undo-the-lifecycle escape hatch.

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
framed as **governance**, not merely information: since graduation is
permanent and irreversible (Part 6), Usage is the *only* safeguard a
widely-used Experience has — there is no demotion escape hatch to fall
back on if an edit turns out to be wrong for one of several
attachments. "Used by 1 Host" / "5 Hosts" / "12 Hosts" is the glanceable
number every Card (Part 4) and every Inspector (Part 5) already
surfaces before a Theme Author ever opens this detail view.

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

3. **Graduating to Personal first.** Satisfied with the mat/border
   combination (it will become "Classic White"), but not yet sure it'll
   be needed anywhere else, the Theme Author graduates it choosing
   Scene: Gallery Portrait (Part 6). It now belongs to Gallery Portrait
   alone — attaching it to Holder 1 is a separate, immediate next step
   (Part 8's Holder shortcut). No friction.

4. **Later choosing Public.** Wanting the same Frame on Holder 2 and
   Holder 3 too — and eventually reused for "Museum Entrance" and
   "Dinosaur Gallery," different Worlds' Scenes entirely — the Theme
   Author makes Classic White Public. No further input required (Part
   6). It is now discoverable via "Reuse Existing" (Part 7) from any
   Holder anywhere in the World. **Confirms the fork model concretely:**
   nothing forced a return trip through Nurturing, and nothing about
   graduating straight to Public (had the Theme Author known from the
   start they wanted Theme-wide reuse) would have looked any different
   in kind — only in timing.

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

7. **Second thoughts about a Public Experience — no demotion, and that
   turns out fine.** Having reused Classic White across three Scenes,
   the Theme Author has second thoughts about one specific detail and,
   from habit, reaches for something like "pull it back to Personal to
   iterate more freely." There is no such action (Canon #8) — Public is
   permanent. Re-walking this with that constraint in mind: the actual
   available path is editing Classic White directly, informed by Usage
   (step 6, Part 9), or graduating a **new**, separate Nurturing idea
   (a variant, not the same Experience) if the change is experimental
   enough to want isolation first. **No friction, once re-walked against
   the corrected model** — v1.0's demotion concern was real evidence at
   the time, and Canon #8 is a genuine, direct answer to it, not a
   sidestep.

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

Ranked by what the walkthrough actually hit, not by theoretical concern.
Superseded items from v1.0 are marked resolved rather than deleted, so
the record of what changed and why stays visible.

1. **RESOLVED (was: demotion undefined).** Canon Decision #8 (Theme
   Experiences are permanent, Delete exists only in the Nursery) directly
   answers v1.0's top open item. Re-walked in step 7: the corrected
   model doesn't just avoid the question, it gives a real, workable
   alternative (edit directly, informed by Usage; or graduate a separate
   variant idea if isolation is wanted). No further decision needed.
2. **Still open — "Place" as a new Foundation tier vs. the existing
   Place=Holder rename** (§0). Declaring Foundation "stable" freezes the
   diagram, not this specific question. The only genuinely open item
   left in this whole document.
3. **RESOLVED (was: Artwork-as-Experience risking Engine Invariant
   10/11).** The continuation brief's own Experience examples list no
   longer includes Artwork at all (§0) — settled by omission.
4. **RESOLVED (was: "Draft" removal scope ambiguous).** The continuation
   brief confirms the narrow reading directly and explicitly (§0) — no
   further action needed.
5. **New, low-stakes — "Archived" vs. "Hidden" distinction unstated**
   (§0). Doesn't block anything (Delete's Nursery-only rule holds
   regardless of how many post-graduation states exist), but should be
   defined before either action is built.
6. **No friction found in:** the fork-not-ladder graduation model itself
   (steps 3–4); Public reuse across multiple Holders (step 5's Frame
   half); Usage-informed editing (step 6); the Nursery/Gallery split,
   including the domain-sensitive Card (step 2, validated directly
   against the Wax Seal case in step 8); Validation absorbing
   Experiences without a category redesign (step 9). These all
   transferred cleanly with no design gap left unanswered.
7. **Confirmed by the walkthrough, not merely asserted:** typed numeric
   position fields alone are workably sufficient for a Free
   Experience's *first* placement, but real fine-tuning wants a live
   canvas — validating Part 5's Inspector-plus-bridge conclusion with
   an actual scenario (step 5) rather than reasoning about it in the
   abstract.

---

## Part 12 — Final UX Recommendation

**Adopt this design as drawn. Exactly one item still requires explicit
decision before implementation; one more is low-stakes and can be
settled alongside it:**

- **Requires decision:** "Place" as a new Foundation tier vs. the
  existing Place=Holder rename (Friction 2) — the only remaining item
  that could still touch Foundation itself, which this whole overhaul
  treats as non-negotiable. Everything else in this document is either
  resolved or safely Builder-only.
- **Low-stakes, settle alongside it:** whether "Hidden" and "Archived"
  are one state or two (Friction 5) — doesn't block Inspector or Card
  design either way, but should have one answer before either action
  ships.

**Everything else now validates cleanly, including what v1.0 flagged as
blocking:** the fork-shaped Graduation workflow (no ladder, no
demotion, permanent Theme Experiences); Inspector-based authoring (no
dedicated Experience Workspace) with one jump-to-Scene bridge for Free
Experiences; the Gallery/Nursery split as the mechanism that keeps
Nurturing ideas from cluttering real, placeable material, including a
Card that changes shape by domain rather than hiding fields that don't
apply yet; Foundation-first organization inside the Gallery; Usage as
the sole, real governance mechanism now that there is no demotion
escape hatch to fall back on. Museum Theme authoring, walked through in
full, never once needed Builder to expose a Layer, a Z-Order, a render
pass, or any technical vocabulary — every decision was phrased as "what
is this," "where does it belong," "who else is using it," matching the
success criteria's own framing exactly. **Experience Studio, as
designed here, is ready for review — implementation should wait only on
the Place question, not on anything else in this document.**

---

## Cross-references

- `docs/BUILDER_V3_WIREFRAMES.md` — the prior paper pass this document
  extends; its Artwork-as-Experience Canon Conflict is now resolved by
  omission (§0); its Place-as-new-tier conflict is the one item this
  document still cannot close on its own; its Visibility (Public/Private)
  axis is superseded outright by this document's Lifecycle model.
- `docs/BUILDER_V2_EXPERIENCE_CANON.md` — the ownership/philosophy model
  (Hosting, Ownership belongs to the Theme) this document assumes
  unchanged throughout; see Part 2.1 for the Attachment→Hosted By
  terminology supersession.
- `docs/BUILDER_V3_CANON_ALIGNMENT_REPORT.md` — the Canon Alignment
  Sprint's full audit (confirmed product concepts, isolated Engine
  Adapter concepts, resolved inconsistencies, open questions) that
  produced Part 2.1 and the Hosted By rename.
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
  Free Experiences, a staged Promotion workflow, and a full Museum Theme
  paper walkthrough with its friction log. One new open item (demotion)
  and two carried-forward Canon Conflicts flagged as blocking; not
  implemented pending review and approval.
- v1.1 — Amended per the "Builder V3 — Experience Studio (Paper Design
  Continuation)" brief and its ten frozen Canon Decisions. The staged
  Promotion ladder (Nurturing→Personal→Public as a forced sequence) is
  replaced outright by a one-time fork (Graduation, Part 6): an idea
  graduates directly to Personal *or* Public, with Personal→Public
  available as a separate, later, one-directional step, and no path
  back to the Nursery ever. This resolves v1.0's top friction item
  (demotion) by removing the concept entirely rather than defining it —
  Theme Experiences are permanent (Canon #8); Delete exists only in the
  Nursery. The Card (Part 4) is now explicitly domain-sensitive
  (Gallery cards show ownership + Usage; Nursery cards show neither).
  The Artwork-as-Experience Canon Conflict is resolved by omission (the
  continuation brief's own Experience examples no longer list it). The
  Place-as-new-tier Canon Conflict remains the one open item. "Draft"
  removal's scope is confirmed exactly as v1.0 already read it
  (Experience terminology only). One new, low-stakes open question
  (Hidden vs. Archived) recorded, not resolved. Not implemented; pending
  review and approval before any development work begins.
- v1.2 — Amended per the Builder V3 Canon Alignment Sprint (Product
  Model Purification). Implementation of Milestone 3 exposed that the
  binary Attachment axis (Attached/Free) couldn't express "fills the
  whole Scene" (e.g. a full-bleed background), only "lives inside a
  Place" and "roams a Scene independently" — a real product-model gap,
  not a Builder bug. Resolved by the frozen three-way **Hosted By**
  axis (Place/Scene/Free), added as Part 2.1 rather than by silently
  rewriting Parts 2/4/5/7/8/9's existing "Attachment" language in place
  (Part 2.1 is the authoritative translation table). Implemented:
  `js/services/experienceSchema.js`'s `EXPERIENCE_ATTACHMENTS` →
  `EXPERIENCE_HOSTS` (place/scene/free) and `rendersWhenAttached` →
  `rendersWhenHosted`; `js/projectModel.js`'s `exp.attachment` →
  `exp.hostedBy` (lossless migration: old `'attached'` → `'place'`,
  old `'free'` → `'free'`); "Hosted by Scene" for a Decoration Type
  projects onto the pre-existing full-bleed background fill mechanism
  (`setSceneBackground`), not a new Engine capability. Two confirmed
  author-facing "Engine V2" wording leaks in the Inspector's disclosure
  notes were rewritten in plain product language. See
  `docs/BUILDER_V3_CANON_ALIGNMENT_REPORT.md` for the full audit,
  including the Experience Type field's documented purpose split
  (product vs. Engine Adapter) and the Engine Adapter boundary
  identification (`_syncExperienceAttachments`). No new capability
  added; no Experience feature work resumed — this sprint was
  conceptual clarity only, per its own explicit "pause feature
  development" instruction.
- v1.3 — Builder V3 MEP, "Experience Builder Foundation" milestone:
  Host-aware Bounds and Decoration Image support, both explicitly
  additive (no persistence redesign, no Parts array, no migration, no
  Type field removal, no new Builder concepts — a scoped-down
  implementation approved after two rounds of plan revision). **Host-
  aware Bounds** (new Builder Canon rule): the Experience Inspector's
  new "Bounds" section reads a read-only "Inherited from Scene"/
  "Inherited from Place" note for those two Hosted-By values (nothing
  stored, nothing editable — the Host already determines the bounds
  completely), and for Hosted by Free shows real, editable X/Y/Width/
  Height sliders that read and write the *same* mirrored Scene Layer's
  existing `position`/`size` Working View already drags (AV-006/
  AV-010) — a second, synced entry point onto data that already
  existed, not a new store (`js/projectModel.js` gained one small,
  additive export, `findMirroredSceneLayer`, exposing an existing
  private lookup rather than duplicating it). **Decoration Image**: an
  optional `image` property (a data URI) sits alongside Decoration's
  existing `glyph`/`color` in the same flat `properties` bag — Image
  and Glyph are deliberately *not* mutually exclusive in the model
  (both are simply optional, per explicit instruction, "permissive for
  future evolution"), only in which one the Runtime prefers when
  painting. The Experience Properties panel's Decoration branch gained
  one field reusing the existing `_assetUploadRow`/`_fileInputUpload`
  pair verbatim (the same controls Overview's Thumbnail/Hero Image
  already use) — no new upload infrastructure. `js/services/
  engineRuntime.js`'s `_paintLayer` decoration branch is extended, not
  rewritten: it now checks for a loaded Image first (via a new,
  optional `resolveLayerImage` callback on `load()`, mirroring the
  existing `resolveFrame`/`representativeImage` "caller resolves, this
  module only draws" pattern exactly) and falls back to the pre-
  existing glyph `fillText` when none is available — a 3-branch
  addition, no Engine/Scene Model redesign. `worldBuilderApp.js` gained
  a small, generic image cache (`_resolveLayerImage`/
  `_layerImageCache`), the same async-decode-then-redraw shape EV-002's
  `_representativeArtworkImage` already established, generalized from
  one Holder-level artwork slot to any Scene Layer's `image` field.
  Type is deliberately unchanged and unremoved throughout — every
  Experience still has a `type`, still used internally by the Engine
  Adapter for dispatch, exactly as before this milestone. Verified via
  Playwright: Place-hosted and Scene-hosted Experiences show the
  correct read-only Bounds note with no editable fields; a Free-hosted
  Text Experience shows all four editable bounds fields and a Width %
  drag correctly writes the real mirrored Layer's `size.w`; a
  Decoration Experience's Image field uploads correctly, sets
  `properties.image` without clearing `properties.glyph`, and the
  Runtime visibly prefers the uploaded Image over the glyph in both
  Working View and Runtime Preview (pixel-sampled); full regression
  across `goldenBuild.js` (30/30) and every prior Milestone/Canon-
  Alignment/AV/AP/runtime/validation/build/reorder/place-rename suite
  passes unchanged. No Engine V2/Scene Model redesign; no Parts array;
  no migration; no Type removal; no new Builder concepts.
- v1.4 — Builder V3 MEP, "Museum Authoring Complete" milestone: a
  hands-on authoring pass (build the actual Museum Theme through the
  Builder, exactly as a Theme Author would) rather than a feature
  review, per the milestone's own "does this help an author build the
  Museum Theme?" test. Six real friction points were found and fixed,
  every one additive/corrective — no new Builder concepts, no
  architecture change. **(1) Starter Scene name/shape mismatch**: the
  Artwork Gallery template's seeded Scene was literally named
  "Showcase" ("big and bold, the classic gallery look") but defaulted
  to Portrait, since its underlying Engine Scene Template
  (`single-holder`) always does — `TEMPLATE_STARTER_SCENE` gained an
  optional `aspect` override, applied once via the already-existing
  `setSceneAspect` right after seeding. **(2) Legacy Frame picker/
  Usage desync — a real correctness bug, not just confusion**: the
  Place panel's pre-Experience "FRAME" picker (kept fully functional
  since Milestone 3's own "both paths side by side" decision) wrote
  `holder.frame` directly via `updateHolder`, bypassing
  `attachExperience`/`detachExperience` entirely — switching or
  clearing a Place's Frame through that picker left a hosting
  Experience's own `attachments` record stale, so Usage/Gallery
  bookkeeping silently lied about where an Experience was really
  hosted. Fixed by making `_setHolderFrame` Experience-aware: it now
  detaches any currently-hosting Frame Experience properly before
  applying a new selection, and attaches through the real mechanism
  when the newly-picked Frame is itself Experience-backed — both UI
  entry points stay functional, but data can no longer drift between
  them. **(3) Decorations list leaked Text layers**: `_renderDecorationsPanel`'s
  existing-items list filtered `kind !== 'fill'` instead of
  `kind === 'decoration'`, so a Scene's Text layers appeared misfiled
  inside the Decorations activity too — a one-line filter fix, plus the
  card's icon now shows an uploaded Image (Prompt 1's own Decoration
  Image support) instead of only ever reading `.glyph`. **(4) New
  Decorations/Text spawned dead-center**: `addSceneLayer`'s default
  `position` was `{0.4, 0.4}` — directly on top of a Scene's usual
  Place — so a freshly-created Free Experience (e.g. a Wax Seal) was
  often invisible or accidentally selected instead of the artwork right
  after creation; moved to `{0.38, 0.82}` (clear of a typical Place,
  still exactly as draggable as before), fixed at both call sites
  (`addSceneLayer`'s own default and the standalone "Add a Decoration"
  glyph-picker's hardcoded duplicate). This also serendipitously
  improved the Experience-based Text creation path's default position
  to match a real Museum Caption's actual placement (below the photo)
  better than the pre-existing, differently-purposed "Add Text"
  button's own top-of-canvas default, which was left untouched since it
  never had the collision problem. **(5) Inspector field grouping**:
  the Experience Properties panel was the one Inspector still stacking
  every field full-width; paired via the same `_fieldRow`/
  `_buildFieldGroup` convention Frames/Layouts/Overview already use
  (Mat Width|Frame Thickness, Border Colour|Wall Tone for Frame;
  Glyph|Colour for Decoration; Font|Alignment, Font Size|Colour for
  Text/Text Style). **(6) Usage completeness — "what will be affected
  by edits"**: nothing anywhere told an author that editing a reused
  Public Experience's Properties silently changes every place it's
  hosted; `_renderExperienceProperties` now shows one line — "Editing
  this updates everywhere it's hosted — N places right now" — whenever
  real usage exceeds one, reading the same `usageOf` data "Used In"
  already lists, just surfaced before editing starts rather than only
  after. A seventh item, **Gallery card previews**, closed the same
  "preview-first, not a database row" gap Part 4 always intended but
  never fully delivered: every card showed the same generic Type icon
  regardless of content, so several Frame variations or Decorations
  were indistinguishable at a glance; a Frame card now shows its real
  border-colour swatch (the same style the legacy Frame picker already
  uses) and a Decoration card shows its real Image or Glyph. **Considered
  and deliberately declined**: fast-pathing "Hosted by Scene" creation
  from the Decorations panel's contextual "+ Add Experience" — the
  Decorations panel's own pre-existing, dedicated Background colour
  field already fully covers the real Museum Theme need (per-Scene wall
  colour) with zero ceremony, and `hostedBy:'scene'` Experiences remain
  fully reachable via the Nursery's full creation form plus Reuse for
  the rarer "keep this exact colour consistent across Scenes" case;
  adding a Hosted-By selector to the fast quick-create form would cut
  against the milestone's own "smooth creation flow" goal for no
  Museum-Theme-blocking gain. Verified via a new consolidated Playwright
  regression covering all six fixes plus a full end-to-end Museum Theme
  authoring pass (Scene → Place → Frame Experience → Text Experience →
  Decoration Experience → cross-scene reuse → Usage Explorer → Gallery →
  Validation → Build → Publish, with a 900-sample pixel-parity check
  confirming zero difference between Working View and Runtime Preview);
  full regression across `goldenBuild.js` (30/30) and every prior
  Milestone/Canon-Alignment/MEP/AV/AP/runtime/validation/build/reorder/
  place-rename suite passes unchanged (one test's own hardcoded pixel-
  sample coordinates needed updating for the intentional decoration
  spawn-position fix — not a product regression; one pre-existing
  timing-flaky test, `wb_av009_full_verify.js`, was confirmed flaky on
  the unmodified baseline too via `git stash`, unrelated to this
  milestone). No Engine V2/Scene Model/Runtime redesign; no new Builder
  concepts; every fix reuses existing mechanisms
  (`attachExperience`/`detachExperience`, `_fieldRow`/`_buildFieldGroup`,
  `usageOf`, `setSceneAspect`).
- v1.5 — Builder V3 MEP Freeze audit (the Release Candidate pass —
  "treat Builder V3 as if it is shipping tomorrow"). A genuinely fresh
  authoring pass, not a feature review, surfaced the milestone's most
  significant finding: **a systemic data-loss bug class affecting all
  three Experience-backed legacy editing surfaces**. Every one of the
  pre-Experience per-object editors kept intentionally functional
  alongside Experience-first authoring since Milestone 3 ("both paths
  side by side") — the Text Layer panel, the Decoration Layer panel's
  Name field, and the "Manage Frames" screen — wrote directly to the
  mirrored Layer/Frame record via `updateSceneLayer`/`setFrameField`/
  `setFrameFieldValue`, completely bypassing the owning Experience's own
  `properties`. Since `_mirrorSceneLayer`/`_mirrorFrame` (the Engine
  Adapter) unconditionally re-derive the mirror from the Experience's
  `properties` on every sync, the *very next* unrelated edit made from
  the Experience's own Inspector silently discarded whatever had just
  been typed or changed through the legacy surface — confirmed to
  reproduce with real data (typed Museum Caption words vanishing after
  an unrelated Colour edit; a Manage-Frames Wall Tone change reverting
  after an unrelated Shadow edit). Fixed identically in all three
  places, mirroring the exact pattern already established for the
  legacy Frame picker in the previous milestone: when the Layer/Frame
  record is Experience-backed (`sourceExperienceId` set, or the Frame's
  own `id` resolves to a live Frame-type Experience), field writes route
  through `updateExperience`/`updateExperienceProperty` instead of
  writing the mirror directly, so every editing surface converges on
  the same one source of truth. A related, smaller bug in the same
  investigation: `_mirrorSceneLayer`'s `text`-branch sync omitted
  `color` entirely, so a Text Experience's Colour field persisted
  correctly but silently never affected the actual rendered Layer at
  all — fixed by adding it to the synced field set. **Consistency
  audit**: a full terminology sweep found the Canon Alignment Sprint's
  Attachment→Hosted-By rename had missed one button
  ("📎 Create & Attach" → "📎 Create & Host"), and normalized the
  Experience Inspector's delete button to "Delete this Experience"
  (matching Place/Decoration/Text's own "Remove this X" panel-button
  convention, while keeping the deliberately stronger "Delete" verb —
  Canon Decision #9's one real, permanent deletion, distinct from
  "detach"). Confirmed clean: no "Engine V1"/"Engine V2"/"Scene Layer"
  in any literal UI string; the one remaining "Holder" occurrence
  (`_renderLayoutsPanel`'s "Holder Area" diagram) is unreachable from
  any UI control in Builder V3 (the legacy Layouts screen has had no
  Global Navigation entry or bridge link since Slice 1), so it can
  never actually surface to an author — left as the pre-existing,
  already-documented dead code it is, not touched. **Pixel-level Working
  View vs. Runtime Preview review**: a full-canvas (not sampled) diff
  found 12,240 differing pixels out of 1,458,000 on a fully-authored
  Scene with nothing selected — traced to a thin, border-shaped pattern
  spanning 976 of 1,080 rows at ~12.5 px/row, matching exactly the
  known, always-on Safe Area guide (Blueprint §7, Working-View-only by
  design) rather than any accidental content difference; confirmed
  intentional, left unchanged. **End-to-end proof**: authored a complete
  3-Scene Museum Theme (Showcase/Portrait/Quote, matching the real
  Museum Gallery board) — a Public Frame Experience reused across two
  Scenes, a Text Experience for the Museum Caption, a Decoration
  Experience for a Wax Seal, a Scene-hosted background colour on the
  Quote Scene — reaching a clean Validation (0 errors, 0 warnings across
  every category), a successful Scene Package Build, a successful World
  Package Build, and a fully functional Publish screen. Full regression
  across `goldenBuild.js` (30/30) and every prior Milestone/Canon-
  Alignment/MEP/AV/AP/runtime/validation/build/reorder/place-rename
  suite passes unchanged. No Engine V2/Scene Model/Runtime redesign; no
  new Builder concepts; every fix reuses the exact adapter-routing
  pattern already established for the legacy Frame picker.
- v1.6 — **Builder V3.1, "Universal Experience Authoring."** Real Museum
  Theme authoring across the MEP milestones kept surfacing the same
  friction point: the Type picker. Choosing Frame/Decoration/Text/
  Atmosphere/Lighting/Text Style before an idea even existed forced an
  author to think in implementation terms before creative ones — exactly
  the thing "an Experience is a reusable creative idea" (this document's
  own Builder Philosophy) argues against. This milestone removes it.
  **Type selector removed**: the Nursery's "+ New Experience" form
  (`_renderExperienceCreateForm`) no longer shows a Type field at all;
  every new Experience is internally the existing Decoration
  implementation (`js/services/experienceSchema.js`'s new
  `DEFAULT_EXPERIENCE_TYPE`), an Engine Adapter detail the author never
  sees — `type` still exists on the record (Frame's own dedicated
  rendering path and Place-hosting's disclosure both still key off it),
  it is simply never author-chosen again. Both the Experience Card and
  the Inspector header dropped their Type label to match (an author
  never picks or sees one, so showing "Decoration" on every single card
  would only read as noise). **Universal content**: every Experience —
  new or pre-existing — now exposes the same four content sections in
  its Inspector, each with its own Properties and Transform (Move/
  Resize): 📝 Text (Content/Font/Size/Weight/Alignment/Colour/Opacity),
  🖼 Image (Upload/Replace/Remove/Preview/Fit/Opacity), 🎭 Graphics (a
  reusable SVG/PNG visual asset — Upload/Replace/Remove/Preview/
  Opacity, no Fit control since it has no "cover vs. contain" role the
  way a photo does), and 🎨 Colour (Colour Picker/Opacity/a Transparent
  checkbox so an Experience can be pure Text/Image/Graphics with no
  fill at all). Implemented additively per this milestone's own
  "reuse existing implementation wherever possible" instruction rather
  than a persistence redesign: `js/services/experienceSchema.js` gained
  `defaultUniversalContent()`, a set of entirely new, namespaced
  property keys (`textContent`/`textFont`/`textSize`/`textWeight`/
  `textAlign`/`textColor`/`textOpacity`/`textX`/`textY`/`textW`/`textH`,
  the equivalent `image*`/`graphic*` sets, and `colorValue`/
  `colorOpacity`/`colorTransparent`) merged into every type's
  `defaultProperties()` — deliberately distinct from every legacy field
  name (`text`/`font`/`fontSize`/`align`/`color`/`image`/`glyph`/
  `matWidth`/...) so this is purely additive: a pre-existing Frame's
  mat/border/wallTone/shadow fields, and a pre-existing Decoration's or
  Text's legacy fields, are never touched, reinterpreted, or deleted.
  `js/projectModel.js`'s `_ensureExperienceDefaults` gained
  `_ensureUniversalContentDefaults`, a read-time reconciliation
  (matching the file's own established `_ensureHolderDefaults`/
  `_ensureStack` pattern) that seeds the new fields and, once per
  Experience (`_universalMigrated`), copies a legacy Decoration's
  `image`→`imageSrc` and a legacy Text's `text`/`font`/`fontSize`/
  `align`/`color`→`textContent`/`textFont`/`textSize`/`textAlign`/
  `textColor` — a legacy Decoration's own `color` is copied to
  `colorValue` but `colorTransparent` deliberately stays at its fresh
  default (`true`) rather than being flipped to `false`, since
  `color` was already inert on a Decoration Layer (`_paintLayer` never
  read it) and flipping it live would have been a real, undisclosed
  visual regression for every pre-existing Decoration Experience, not a
  migration. **The Engine Adapter, extended not replaced**: Scene- and
  Free-hosted Experiences now sync through a new `_syncUniversalContent`
  (Place-hosting is unchanged — still Frame-only, a disclosed gap, see
  below) that mirrors up to four tagged Scene Layers per Experience —
  one each for a populated Text/Image/Graphics/Colour section — reusing
  the exact, unmodified Layer kinds Engine V2 already renders (`fill`
  for Colour, `text` for Text, `decoration` with `.image` set for both
  Image and Graphics, the same mechanism Builder V3 MEP's Decoration
  Image support already proved out). An empty section mirrors nothing —
  no invisible Layers cluttering the Scene Stack. Colour has no
  Transform of its own (per the spec's own field list); its rect is the
  live bounding box of whichever Text/Image/Graphics is currently
  populated (`_universalContentFootprint`, recomputed on every sync, not
  just at creation, since nothing else ever owns this rect the way a
  Transform would), reading as "a backdrop behind what's here" even as
  content is added, moved, or removed later. A pre-existing (pre-V3.1)
  Experience's single untagged mirrored Layer is *claimed* in place the
  first time its owning Experience is touched under the new model
  (`_claimLegacyMirrorLayer`) — its exact existing position/size is
  copied back into the matching Transform fields and it is simply
  re-tagged, rather than being orphaned while a fresh duplicate Layer is
  created at a default rect; verified directly (a hand-constructed
  legacy Decoration Experience with an author-positioned mirrored Layer
  keeps that exact position after an Image upload, with exactly one
  Layer remaining, not two). The Free-hosted "Bounds" editor Builder V3
  MEP added (one single editable X/Y/Width/Height rect) is superseded —
  each content section's own Transform now owns Move/Resize instead, a
  finer-grained equivalent living with the content it actually
  positions rather than a separate, redundant control surface; the
  Inspector's Bounds section is now purely informational for all three
  Hosted-By values. **Opacity and Graphics rendering**:
  `js/services/engineRuntime.js`'s `_paintLayer` gained a small, generic
  `layer.opacity` read (0..1, defaulting to 1 so every pre-existing
  Layer renders byte-identically) applied via `ctx.globalAlpha` for
  every Layer kind alike — not a per-content-type special case — plus
  an `imageFit`-aware `layer.fit` read (defaulting to 'fit', matching
  the prior hardcoded behaviour exactly) so the Image section's own Fit
  control has a visible effect; a Graphics Layer simply never sets
  `.fit`, always containing. **The P0 image upload bug, root-caused,
  not patched**: instrumented the real pipeline end to end (upload →
  Asset → Experience property → Engine Adapter mirror → Working View →
  Runtime Preview) and found every one of those six links already
  worked correctly — the Experience's `properties.imageSrc` set
  correctly, the mirrored Layer's `.image` set correctly, both canvases
  painting the uploaded pixels correctly, surviving a full reload. The
  actual defect was one step earlier and entirely different: the
  Inspector's own Image/Graphics upload row (`_assetUploadRow`) never
  re-rendered after a successful upload — `onProp`'s persist-and-redraw
  never called back into the panel, so the row visibly stayed on
  "Upload" with no thumbnail, even though the upload had already fully
  succeeded everywhere else — exactly what an author watching the one
  place they're looking would reasonably read as "the button doesn't
  work." Fixed with a second, narrowly-scoped `onUploadProp(key)` used
  only by the Image/Graphics upload rows (not every Properties field,
  which don't need it — a colour swatch or slider already shows its own
  new value inherently) that re-renders the panel after persisting, so
  the row immediately shows the new thumbnail and "Replace"/"Remove."
  `_assetUploadRow` itself also gained a Remove action (clearing the
  asset via `onUpload(null)`), matching the Image/Graphics section's own
  listed Properties (`Upload/Replace/Remove/Preview`) — a side effect
  also reaching Overview's pre-existing Thumbnail/Hero Image rows, which
  gained the same ability to clear an asset for the first time. **Card
  previews**: the Gallery/Nursery card thumbnail now prefers whichever
  universal section is actually populated (Image, then Graphics, then a
  non-transparent Colour) over the old Type-icon fallback, so a card
  previews real authored content rather than an implementation detail —
  a pre-existing Frame's border swatch and an unmigrated Decoration's
  own glyph remain as fallbacks so nothing already authored loses its
  preview. **Disclosed, not silently bridged**: Place-hosting still only
  renders a Frame — there is still only one Frame slot per Place and no
  Holder Layer stack for anything else to project onto (Scene Model §7,
  still open) — the Inspector says so plainly ("Text/Image/Graphics/
  Colour don't render when hosted by a Place yet — try Scene or Free
  instead") rather than pretending otherwise. Verified via Playwright
  end to end: the Nursery form shows no Type field and creates a
  `type: 'decoration'` Experience with the full universal-content shape
  already seeded; the Inspector shows all four sections with working
  Transform sliders for every Experience regardless of legacy type
  (including a legacy Frame Experience, which additionally keeps its
  own dedicated mat/border/shadow fields, unchanged); an Image upload's
  row updates immediately without navigating away, and the uploaded
  pixels render identically in Working View and Runtime Preview; a
  Colour fill with Transparent unchecked renders at the live footprint
  of populated Text/Image/Graphics content, confirmed by direct pixel
  sampling once positioned clear of the Place; a Graphics upload at 50%
  Opacity renders a visibly blended (not full-strength, not fully
  transparent) pixel; a hand-constructed pre-V3.1 legacy Decoration
  Experience migrates its Colour/Image fields correctly on read without
  flipping Transparent, keeps rendering from its original untouched
  mirrored Layer until first touched under the new model, and is then
  claimed in place (same position, same single Layer, now tagged) with
  no duplication; a full Museum Theme authoring pass (Place → Frame
  Experience, Text → Museum Caption via the universal Text section,
  Decorations → Wax Seal) reaches a clean Validation, a successful
  Scene Package Build, a successful World Package Build, and a
  functional Publish screen. Full regression across `goldenBuild.js`
  (30/30) passes unchanged; zero console errors throughout. No Engine
  V2/Scene Model/Runtime redesign beyond the two small, generic
  `_paintLayer` additions (opacity, fit) described above; no
  persistence redesign; the Engine Adapter boundary
  (`_syncExperienceAttachments`/the Frame and Universal Content sync
  functions) remains the one place a Builder-facing Experience is
  projected onto Engine V2's own, otherwise-unmodified rendering
  mechanisms.
