# Builder V2 Blueprint

**Status:** Authoritative specification for Builder V2 — the contract
paper wireframes and implementation follow, pending the small number of
items in §12 that are genuinely Engine-level, not Builder-level, and so
cannot be resolved by this document. Everything else here is decided.
Read, in order: `docs/ENGINE_V2_CANON.md`, `docs/BUILDER_V2_MENTAL_MODEL.md`,
`docs/BUILDER_V2_STORYBOARD.md`. Their conclusions are treated as
frozen; nothing in this document revisits them except where explicitly
marked as a newly-surfaced contradiction (there is exactly one, §2).
**Scope:** For every Builder V2 screen — what it's for, what question
it answers, what it shows, what it never shows, what the Property
Editor does on it, and how it connects to every other screen. This is
architecture, not visual design: no widgets, no components, no data
structures, no wireframes. Paper wireframes are the next document, not
this one.

---

## 1. How to read this document

Two families of screen fall out of the prior three documents, and each
gets a different treatment below:

- **World-level screens** — Arrival, Overview, Scenes, Theme Assets,
  Validation, Build, Publish. Each gets one full entry (§3–§5, §11–§14).
- **The Scene Editor** — not four separate screens in the technical
  sense (one shell, one Header, one Runtime Preview, one Property
  Editor region), but four distinct *screens* in every sense that
  matters to a Theme Author: different purpose, different primary
  question, different information, different actions. §6 defines the
  shell once; §7–§10 give each slice (Canvas, Holders, Decorations,
  Text) its own full entry against that shared shell, exactly as the
  storyboard treated them as four distinct stages.

Every entry answers the same ten questions, in the same order, so nothing
is answered twice and nothing is missed: Purpose, Primary Question,
Information Displayed, Primary Actions, Secondary Actions, Property
Editing, Runtime Preview, Entry Points, Exit Points, Never Show.

---

## 2. One newly-surfaced contradiction, resolved here

Writing every screen's entry against the mental model and storyboard
surfaced exactly one place where "frozen" needs a one-line amendment,
not a redesign — flagged per this phase's own instruction to challenge
only genuine contradictions, not invent new ones.

**Text is not a Theme Asset, and that changes what "Secondary Actions"
means for it.** Frames, Decorations, Textures, Fonts, Icons, and
Patterns are all Theme Assets — a Theme Author *browses a shelf* for
them (Engine Canon §9). Text is not in that category list at all; a
Text Element is placed directly, with no shelf to browse. The
storyboard's Stage 7 already treated "Write the Words" as its own
activity without naming this distinction, but didn't need to until now:
**a Theme Author may freely add a new Text Element to a Scene, with no
Theme Asset constraining what's available, while a new Decoration must
always come from the shelf.** This is not a contradiction of anything
already written — it was simply never made explicit — and it directly
answers one question a screen-by-screen spec cannot leave unanswered:
whether "add a new one" is available at all in the Text slice (§10) and
the Holders slice (§8, for adding a Holder — same reasoning, argued
there on its own terms since Holders aren't Theme Assets either).

---

## 3. Arrival — My Worlds

**Purpose**

The entry point to Builder V2 itself — resume what already exists, or
start something new, before any World-specific concept is relevant.

**Primary Question**

"What am I already building, or what am I starting?"

**Information Displayed**

Every existing World, recognizable by name and identity (an icon or
thumbnail, if one exists) — never by an internal id, creation
timestamp format, or file path.

**Primary Actions**

- Open an existing World (→ its last-visited screen, or Overview if
  this is the first time it's been reopened).
- Create a new World (→ Overview, immediately, for the new World).

**Secondary Actions**

Rename, duplicate, delete a World — direct, no-controversy carryover
from Builder V1's own proven Draft Management (Sprint B2.0.5); nothing
about Engine V2 changes why a Theme Author needs these.

**Property Editing**

None. This screen has no selection model and no object to edit — it is
a launcher, not an editor.

**Runtime Preview**

Not present. There is no active Scene yet; nothing to preview.

**Entry Points**

Opening Builder V2.

**Exit Points**

→ Overview (new World) or → wherever the Theme Author left off in an
existing World.

**Never Show**

Any World's internal Scenes, Theme Assets, or Canvas detail. Any Engine
vocabulary at all — this screen exists before "World" has acquired any
further structure in the Theme Author's mind.

---

## 4. Overview

**Purpose**

Establish and maintain the World's own identity — the thing named in
Stage 2 of the storyboard, revisited rarely afterward.

**Primary Question**

"What is this World called, and what's it about?"

**Information Displayed**

Name and Description, certainly. Beyond that, Overview's exact field
list depends on Engine Canon §12 item 4 (Theme Settings' scope), which
remains genuinely open at the Engine level — this document does not
pre-empt it (§12 below). Whatever Theme Settings turns out to define,
Overview is its home; no other screen is a candidate.

For a brand-new World with zero Scenes, Overview also shows an
inviting, unmissable prompt toward Scenes — never a dead, empty screen
with nothing to do next.

**Primary Actions**

Edit the World's identity fields directly, in place.

**Secondary Actions**

None of consequence — Overview is deliberately light, matching its
"visited once, rarely again" frequency (mental model doc §1, point 1;
storyboard Stage 2).

**Property Editing**

There is no separate "Property Editor" region here distinct from the
screen itself — Overview *is* the editor for the one thing it's
responsible for (the World's identity). Nothing is ever "selected" on
this screen the way an object is selected in the Scene Editor.

**Runtime Preview**

Not applicable. There is no single active Scene to preview from
Overview — Scenes owns that.

**Entry Points**

World-level navigation, directly; automatically, right after creating
a new World.

**Exit Points**

→ Scenes — the natural next step for any World, especially a new one.

**Never Show**

Any Scene-level detail (Canvas, Holders, Decorations, Text) — Overview
is scoped strictly to the World as a whole.

---

## 5. Scenes — The Library

**Purpose**

Manage the collection itself — the literal, felt expression of "a
Theme is a curated library of Scenes" (Engine Canon §0).

**Primary Question**

"What kinds of pages does this World offer, and is that collection
complete?"

**Information Displayed**

Every Scene in the World, each recognizable at a glance by name and a
live-updating thumbnail of its actual composition — never an internal
id, never a raw list of Engine Scene Template names once a Scene has
been curated past its starting point.

**Primary Actions**

- Add a Scene: opens the Engine Scene Template picker (Single Holder,
  Dual Holder, Quote, Cover, Timeline, Comic, Gallery — Engine Canon
  §10) — never a blank Canvas (Engine Invariant 4). Choosing a Template
  creates the Scene and opens it directly into its editor (§6),
  starting on the Canvas slice (§7).
- Select an existing Scene → opens its editor, resuming on whichever
  slice it was last left on.

**Secondary Actions**

Rename, duplicate, delete, reorder a Scene. Renaming here is the *only*
place a Scene's name is ever set (mental model doc §2 — Scene identity
was deliberately moved out of the Scene editor itself).

**Property Editing**

None beyond the inline rename above — a Scene's real properties
(Canvas, Holders, Decorations, Text) only exist once inside its editor.
The Library manages membership in the collection, not any one member's
content.

**Runtime Preview**

Not applicable at the Library level. A thumbnail per Scene card is
sufficient for "recognizable at a glance" (the actual requirement);
Runtime Preview as an interactive, always-current surface belongs to
the Scene Editor, once a specific Scene is open.

**Entry Points**

World-level navigation; the natural post-Overview destination for a
new World; "back to Scenes," always one click away from inside any
Scene's editor.

**Exit Points**

→ Scene Editor, Canvas slice (§7), for a newly created Scene, or
whichever slice an existing Scene was last on.

**Never Show**

Any Engine Scene Template's internal mechanics (that it pre-fills a
default Canvas and Holder arrangement) — the Theme Author sees only the
resulting Scene, already sitting in front of them.

---

## 6. The Scene Editor — Shared Shell

Everything in this section is common to all four slices (§7–§10 below
— Canvas, Holders, Decorations, and Text are each called out on their
own to keep one slice per section, matching how the storyboard treated
them as four distinct stages). Each slice's own entry answers "Runtime
Preview" by referring back here rather than repeating it.

**Persistent regions, present regardless of active slice:**

- **Header** — World name › Scene name, with a save-state indicator
  (Builder V1's dirty/saved pattern, Sprint B2.0.6, is worth keeping
  verbatim — nothing about Engine V2 changes why a Theme Author needs
  to know whether their last edit is safe).
- **World-level navigation** — stays visible and reachable the entire
  time a Scene is open, so "back to Scenes" is always one click away.
  This was true in Builder V1 and nothing here argues for removing it.
- **The slice switcher** — Canvas, Holders, Decorations, Text, in that
  fixed order, always visible, freely revisited in any order (storyboard:
  "Stages 4–8 have no forced order"). The fixed *display* order is not a
  workflow requirement — it exists only so each slice has one stable,
  memorable place to find it.
- **Working View** — the one interactive rendering surface. Shows the
  Scene exactly as it will render, with Builder-only guide overlays
  scoped to whichever slice is active (Holder bounding boxes and a
  resize handle in Holders; a decoration's selection outline in
  Decorations; nothing beyond a selected caption's own handles in
  Text). Never a second, Builder-owned rendering implementation — the
  same render Runtime Preview uses, with a guide layer drawn on top,
  exactly as Builder V1 already proved out.
- **Runtime Preview** — always the clean, complete, current Scene, no
  guides, identical regardless of which slice is active. This is the
  one surface that must never change when the slice switcher changes —
  it exists specifically so switching slices never causes anxiety about
  what got hidden. **Runtime Preview is never interactive.** It is not
  a second place to select or edit anything; clicking inside it does
  nothing. This is a firm rule, not a soft default — two clickable
  renderings of the same Scene on one screen would be a genuine source
  of confusion this Blueprint is responsible for ruling out.
- **Property Editor** — contextual to the active slice and current
  selection (§6.1 below defines exactly how selection and slice
  interact). Empty (or showing lightweight slice-level guidance) when
  nothing is selected; populated with the selected object's
  type-specific properties, ending in the shared permission block
  (§6.2), whenever something is.

### 6.1 Selection drives the slice, not the other way around

Clicking any selectable object in Working View — a Holder, a
decoration, a piece of text — selects it, populates the Property
Editor with its properties, **and switches the active slice indicator
to match that object's natural home** (clicking a Holder activates
Holders; clicking a sticker activates Decorations; clicking a caption
activates Text), regardless of which slice was active a moment before.
This is not a new idea invented for Builder V2 — it is Builder V1's own
proven Universal Object Selection (Sprint 8.4.1: "any object click
switches to the Card Designer, expands the matching section") kept
because nothing about Engine V2 argues against it. The slice switcher
is a way to *navigate toward* an activity; a click in Working View is a
faster way to arrive at the same place from the object itself.

### 6.2 The shared Story-Author-permission block

Appears at the bottom of the Property Editor, in every slice, whenever
something is selected — one mechanism, never a screen of its own
(mental model doc §2). It is intentionally three questions, not four:

- **"Can a Story Author move this?"** (`moveable`)
- **"Can a Story Author change this?"** (`editable` — gates that
  object's own type-specific properties for the Story Author, exactly
  as it does for the Theme Author now)
- **"Should a Story Author see this at all?"** (`visible`)

`clickable` is deliberately not a fourth visible toggle in this first
version of the block: nothing in this Blueprint's scope yet needs a
Story-Author interaction that isn't already implied by `moveable` or
`editable` being on (Engine Canon §8 notes richer bindings — tap-to-flip,
tap-to-play — as a future extension of the same flag, not a present
requirement). Builder V2 sets `clickable` to true whenever either of
the other two is true, false otherwise, and does not surface it as its
own question until a real feature needs that independence.

Two objects get a variant of this block, not the standard one:

- **A Holder's Primary-Element slot** does not ask "can the Story
  Author populate this" — that's not a permission, it's the Holder's
  entire reason for existing (Engine Invariant 10, "every Holder
  presents exactly one Primary Element," always Story-Author-supplied).
  The block for a Holder is only ever about what happens *after* it's
  populated — can they move/resize the photo within the fixed frame,
  replace it later.
- **A decoration placed in the Decorations slice** gains one additional
  line beyond the standard three: **"Let the Story Author add their own
  decorations here too."** Saying yes to this is the entire mechanism
  by which a Scene Layer becomes a Decoration Slot (Engine Canon §7) —
  the Theme Author never sees or names "a Slot"; they answer one plain
  question about one spot on the page, and Builder V2 does the rest.
  This resolves mental model doc §8 item 3 definitively: the marking
  mechanism *is* the shared permission block, not a separate control.

### 6.3 Browsing Theme Assets without leaving the Scene

Resolves mental model doc §8 item 4. Both of the following are true,
and they are not in tension because they serve different moments:

- **A "Browse Theme Assets" action, reachable from Holders** (scoped to
  Frames only) **and from Decorations** (scoped to decorations,
  textures, patterns), opens the shelf as an overlay on top of the
  current Scene Editor — never a navigation away from it. Picking
  something places it and returns focus to the Scene, exactly where the
  Theme Author was. This is a *picking* moment.
- **The full Theme Assets screen** (§11), reached from World-level
  navigation, is a *stocking and organizing* moment — uploading new
  material, renaming, removing, seeing what's used where. The inline
  overlay is a lightweight view onto the same underlying shelf, not a
  separate library; a link from inside the overlay to "manage the full
  shelf" is the one bridge between the two moments.

---

## 7. Scene Editor — Canvas Slice

**Purpose**

Settle the Scene's basic shape — almost always a quick confirmation of
whatever the Engine Scene Template already chose.

**Primary Question**

"Is this page tall, wide, square — and is that actually right?"

**Information Displayed**

The Scene's current Aspect Ratio, shown as the page itself in Working
View (never as a labeled numeric field first). Safe Area is shown as a
felt guide in Working View — a boundary things should stay inside —
never as a labeled Engine field anywhere in the Property Editor.

**Primary Actions**

Change Aspect Ratio, from the same small vocabulary the Template
offered (portrait, landscape, square, wide, full-bleed, quote —
continuous with Engine V1's own proven set). **Size is not an
independent lever in this Blueprint's scope**: it is derived from one
fixed base resolution the whole product already standardizes on, the
same way Engine V1 never asked a Theme Author to type pixel dimensions
by hand. This is a deliberate simplification, stated here as decided,
not left open — "Size" as its own editable number would ask a Theme
Author a question they have no intuition for.

**Secondary Actions**

None. Canvas is deliberately the lightest slice — Aspect Ratio is close
to the entire activity.

**Property Editing**

A short panel: Aspect Ratio choice, nothing else meaningful once Size
is derived rather than typed.

**Runtime Preview**

Unchanged — see §6.

**Entry Points**

Automatically, first, the moment a Scene is created from a Template;
manually, later, from the slice switcher.

**Exit Points**

Naturally toward Holders next (placing a photo depends on already
knowing the page's shape) — never forced; the switcher allows any
order.

**Never Show**

Scene Stack, Layer Stack, or any paint-order concept. Canvas has
nothing to do with what's on the page or in what order (Engine Canon
§4, §8) — this slice is purely "what shape is the page."

---

## 8. Scene Editor — Holders Slice

**Purpose**

Design where the real photo goes — position, size, shape, breathing
room — and how that specific spot presents whatever eventually fills
it.

**Primary Question**

"Where does the photo go, how big, what shape, and how is it framed?"

**Information Displayed**

Every Holder in the Scene, each shown live in Working View holding a
generic placeholder image — **never a real upload**, since the Theme
Author never supplies the Primary Element themselves (Engine Canon §6,
§10; Engine Invariant 10). For the selected Holder: its Position, Size,
Shape, Padding, Fit, and its current Frame (if one has been chosen).

**Primary Actions**

- Select a Holder (when a Scene has more than one — Dual Holder,
  Gallery).
- Reposition, resize, reshape it; set its Padding and Fit.
- Choose or change its Frame — Border, Mat, Shadow — via the "Browse
  Theme Assets" overlay scoped to Frames (§6.3). **Frame editing lives
  here, not in Decorations** — confirmed, not merely asserted, by
  Engine Canon §9's own rule that a Frame Element is placed inside a
  Holder's own Holder Layer. "Choose this photo's frame" and "choose
  this photo's size" are one activity for the person doing them, and
  Builder V2 treats them as one.

**Secondary Actions**

**Add or remove a Holder.** The Engine places no upper bound on a
Scene's Holder count (Engine Canon §2: "Holder (0..N)"), and locking a
Scene forever to whatever count its starting Template happened to
choose would quietly contradict "the Theme Author curates it" (Engine
Canon §10) — a Gallery Scene that can never grow past its Template's
starting arrangement isn't really curated, just fixed. This Blueprint
decides it plainly: Holders may be added and removed here, the same
pattern Scenes already uses for itself (§5).

**Property Editing**

Position/Size/Shape/Padding/Fit for the selected Holder, plus its
Frame's own Border/Shadow/Mat once one is chosen, ending in the shared
permission block (§6.2) — for a Holder, the variant that skips asking
about population and asks only about what happens after.

**Runtime Preview**

Unchanged — see §6. Critically, Runtime Preview shows the *same*
placeholder image Working View does, so switching between the
guide-annotated Holder in Working View and the clean one in Runtime
Preview never appears to swap the photo, only the chrome around it.

**Entry Points**

Slice switcher; automatically, right after Canvas, on a freshly
created Scene.

**Exit Points**

Naturally toward Decorations once placement feels settled, or Text —
never forced.

**Never Show**

Holder Stack, Content Layer. A Theme Author sees "the Holder" as one
thing with a Frame — never its internal Layer structure (Engine Canon
§3).

---

## 9. Scene Editor — Decorations Slice

**Purpose**

Build the Scene's atmosphere — background, texture, scattered
ornamentation — the activity most Theme Authors will call "the fun
part."

**Primary Question**

"What does this page feel like — what's behind the photo, and what's
scattered around it?"

**Information Displayed**

The Scene's background (simply whatever sits at the bottom of the
Scene, per Engine Canon §4 — there is no separate "background setting"
anywhere to look for), and every decoration currently placed, shown in
place on the page.

**Primary Actions**

- Set the background.
- Browse and place decorations, textures, patterns from Theme Assets
  (the "Browse Theme Assets" overlay, §6.3, scoped to these categories
  this time — never Frames, which belong to Holders, §8).
- Reposition a placed decoration; **bring it forward or send it
  backward** relative to other decorations and the Holder it may
  overlap — the one Builder verb that covers everything a Layer Stack
  would otherwise require (mental model doc §1, point 4). Never a Layer
  Stack panel.
- Remove a placed decoration.

**Secondary Actions**

Mark a placed decoration as open for the Story Author to add their own
alongside it — via the shared permission block's Decoration-specific
line (§6.2). This is the entire Decoration Slot mechanism; there is no
separate control anywhere for "designating a slot."

**Property Editing**

Whichever decoration is selected: its own type-specific properties (a
Shape's fill, an Image decoration's crop), ending in the shared
permission block, Decoration Slot line included.

**Runtime Preview**

Unchanged — see §6.

**Entry Points**

Slice switcher; naturally, from Holders, once photo placement is
settled.

**Exit Points**

Naturally toward Text, or back to Holders if a decoration turns out to
change how much room a Holder actually needs (the storyboard's own
noted loop between these two slices).

**Never Show**

Which Scene Layer any decoration lives in, or that placing it "became
an Element" — both pure Engine bookkeeping the Theme Author never
needs (Engine Canon §7, §9).

---

## 10. Scene Editor — Text Slice

**Purpose**

Write and style whatever words this Scene needs — a title, a caption,
a quote's own text — as its own activity, distinct from arranging
photos or scattering decoration.

**Primary Question**

"What does this page say, and what should the words look like?"

**Information Displayed**

Every text element currently on the Scene, shown in place, on the page
— never as a separate form list disconnected from where the words
actually appear.

**Primary Actions**

- Write or edit the words, directly in place.
- Style them — typography, colour, alignment.
- **Add a new text element.** Unlike a decoration, text is not sourced
  from a Theme Asset shelf (§2 — the contradiction resolved above) —
  wording is always bespoke to its Scene, so nothing constrains adding
  more of it the way the shelf constrains decorations.

**Secondary Actions**

Remove a text element.

**Property Editing**

The selected text's typography, colour, alignment, ending in the
shared permission block — for text specifically, `editable` governs
whether a Story Author may change the *wording itself*, distinct from
whether they may restyle it, both expressible through the same three
questions.

**Runtime Preview**

Unchanged — see §6.

**Entry Points**

Slice switcher, from anywhere in the Scene Editor.

**Exit Points**

Back to Scenes (§5), to add another Scene, once this one feels done —
or to any other slice, freely.

**Never Show**

Which Layer a given text element lives in — whether it reads as a
Scene-level title or a Holder-level caption structurally is an
invisible distinction; both are edited identically, in place, in this
slice (mental model doc §2).

---

## 11. Theme Assets

**Purpose**

Stock and organize the World's shared shelf — the material every
Holder's Frame and every Scene's Decorations draw from.

**Primary Question**

"What do I have to decorate and frame with, and what's missing?"

**Information Displayed**

The shelf, organized by category (Frames, Decorations, Textures, Fonts,
Icons, Patterns — Engine Canon §9). For each asset: where it's
currently used, across which Scenes — direct, proven continuity from
Builder V1's own Layout "Used By" feature.

**Primary Actions**

Add a new asset (upload or create); organize it into its category.

**Secondary Actions**

Rename or remove an asset.

**Property Editing**

An asset's own metadata (name, category) only — **not** the Base
Object contract, since an unplaced Theme Asset carries none of it
(Engine Canon §8) — there is no permission block on this screen at
all. Permissions are decided at placement time (§8, §9's own slices),
never on the shelf itself.

**Runtime Preview**

Not applicable. No single Scene is active on this screen.

**Entry Points**

World-level navigation, directly; the "manage the full shelf" bridge
from inside the inline Browse overlay (§6.3).

**Exit Points**

Back to whichever Scene prompted the visit, if arrived via the inline
overlay; otherwise, World-level navigation generally.

**Never Show**

**Personal Decoration Packs.** Builder V2 manages Theme Decoration
Packs only (Engine Canon §9) — Personal Decoration Packs are a
Runtime/Story-Author-side concern this screen never surfaces, and this
holds regardless of how Engine Canon §12 item 1 (what "personal" means)
is eventually resolved. This is a confident, standing Builder-level
decision, not contingent on that Engine question.

---

## 12. Validation

**Purpose**

Check the World's readiness against the same rules Runtime itself will
enforce, before anything is packaged.

**Primary Question**

"Is anything actually missing or broken?"

**Information Displayed**

Pass/fail, grouped by what's being checked (Scenes, Holders,
Decorations, Text, Theme Assets, References) — continuity from Builder
V1's own proven category-grouped result view.

**Primary Actions**

Run validation.

**Secondary Actions**

From any failure, jump directly to the offending Scene and slice —
Builder V1's own proven "Fix Now" pattern, carried forward unchanged.

**Property Editing**

None — this screen is a report, not an editor.

**Runtime Preview**

Not applicable.

**Entry Points**

World-level navigation; a "ready to check?" prompt surfaced from Scenes
once the library feels complete (storyboard's own Stage 10 → 11
transition).

**Exit Points**

→ Build, once passing; back into whichever Scene/slice needs fixing,
otherwise.

**Never Show**

Raw Engine error internals — no message ever names a Layer, a Scene
Stack position, or any Engine-internal identifier. Every message names
the Scene, Holder, decoration, or text item at fault, in the Theme
Author's own vocabulary.

---

## 13. Build

**Purpose**

Package the validated World into the real, installable format.

**Primary Question**

"Turn this into the real thing."

**Information Displayed**

Build result: package name, size, timestamp — Builder V1's own proven
compact stat-card presentation.

**Primary Actions**

Run the build.

**Secondary Actions**

None.

**Property Editing**

None.

**Runtime Preview**

Not applicable.

**Entry Points**

From Validation, once passing; World-level navigation directly
(strongly encouraged to validate first, not hard-gated).

**Exit Points**

→ Publish.

**Never Show**

Package format internals.

---

## 14. Publish

**Purpose**

Place the built package where Runtime will discover it, or export it to
share another way.

**Primary Question**

"Ship it — where does this go?"

**Information Displayed**

The built package's identity; available destinations — Builder V1's
own proven three-option pattern (Export, Publish to Official, Community
— Coming Soon).

**Primary Actions**

Choose a destination and publish or export.

**Secondary Actions**

None of consequence.

**Property Editing**

None.

**Runtime Preview**

Not applicable.

**Entry Points**

From Build, once complete.

**Exit Points**

Back to Overview or Scenes, to keep iterating on the same World; back
to Arrival, if leaving the World entirely.

**Never Show**

Raw package internals.

---

## 15. Cross-cutting rules, stated once

Rather than repeat these in every entry above, they apply everywhere,
without exception:

1. **The generic noun "Element" never appears in Builder V2 copy.**
   Every surface names the specific type — photo, sticker, caption,
   frame, background (mental model doc §1).
2. **No screen ever shows `editable`/`moveable`/`visible`/`clickable`
   as property names.** They are always phrased as plain questions
   about what a Story Author may do (§6.2).
3. **No screen ever shows a Layer, a Layer Stack, a Scene Stack, a
   Holder Stack, or a Content Layer**, by any name, in any form —
   their effects are always reachable through direct manipulation
   (drag, bring-forward/send-backward, the shared permission block)
   instead.
4. **Runtime Preview is never interactive**, on the one screen where it
   exists (§6) — a firm rule, not a default.
5. **Permissions are never a destination.** The shared block (§6.2)
   only ever appears attached to an already-selected object, on
   whichever slice that object lives in — never its own screen, never
   its own navigation entry.

---

## 16. What remains open

Everything in §3–§15 is decided. What's left is genuinely Engine-level,
not something a Builder architecture document can resolve on its own —
carried forward from Engine Canon §12, unchanged by this pass:

1. **Theme Settings' exact scope** (Engine Canon §12 item 4) directly
   blocks Overview's (§4) complete field list. Name and Description are
   certain; anything beyond them waits on that Engine decision.
2. **A Holder's empty-state placeholder branding** (Engine Canon §12
   item 3) is a Runtime question, not a Builder one — Builder's own
   Working View / Runtime Preview placeholder (§8) is a separate,
   Builder-only convenience for authoring, and does not depend on how
   that Engine question resolves.
3. **Whether a Scene remembers its originating Engine Scene Template**
   (Engine Canon §12 item 2) affects only a possible future "reset to
   template" feature — no screen defined in this Blueprint needs that
   answer to function.
4. **Per-slot Decoration constraint vocabulary** (Engine Canon §12 item
   5 — e.g. "stickers only," "at most 3") is not required for the
   Decorations slice (§9) to work at its simplest: the shared permission
   block's yes/no question is sufficient for a first version. Finer
   per-slot constraints, if product wants them later, extend that same
   block rather than requiring a new mechanism.

Explicitly and deliberately **out of scope**, not "open" (a scope
decision, stated plainly rather than left to drift): **Video and Audio
authoring.** Neither fits any of the four slices as specified, and
inventing a slice for a capability with no defined authoring story
would be exactly the kind of speculative design this whole derivation
has been trying to avoid. Revisit when either becomes a real
requirement.
