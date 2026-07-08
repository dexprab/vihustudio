# Builder V2 — Experience Canon

**Status:** Draft — pending product review and sign-off. Not frozen.
This document supersedes nothing until approved, and no Builder
implementation may begin against it until then (per this document's own
commissioning instruction). It sits alongside `docs/ENGINE_V2_CANON.md`
and `docs/BUILDER_V2_VISION.md` as a peer canon, not a replacement for
either.
**Scope:** A Builder-only authoring concept — the **Experience** — that
lets a Theme Author compose a Scene, or a single Host within it, from
more than one independent visual contribution. This document defines
philosophy, terminology, ownership, and constraints. It does not define
a serialized data shape, a rendering pipeline, or any implementation
detail — those are named as required follow-on work (§5, §7) and are
explicitly out of this document's scope.

---

## 0. Why this document exists

A prior, informal investigation (conducted during Museum Theme
validation, not itself a canonical document) asked whether Builder V2
should evolve around an "Experience" model instead of continuing to grow
Scene- and Holder-specific parameters one field at a time. That
investigation concluded the idea was architecturally compatible with
Engine V2 — an evolution of the existing Element/Layer model, not a
competing one — but found no concrete authoring need blocking Museum
Theme at the time, and recommended deferring it as a documented future
backlog item, the same way `docs/ENGINE_V2_SCENE_MODEL.md` §7 already
leaves Holder Layers open until "a real authoring need... surfaces it."

That authoring need has now surfaced. This document is the canon the
prior investigation recommended writing once it did.

---

## 1. Background

**New evidence.** Continued Museum Theme authoring reached a point where
a Theme Author needs to compose a single page — or a single photo's
presentation — from more than one independent visual contribution at
once, and Builder has no authoring path for that today. This is no
longer a theoretical concern; it is blocking real authoring.

**What this is not.** It is important to separate this from work already
done and already resolved:

- **AV-003** found and fixed real implementation bugs in Frame
  rendering — a resolver argument mismatch, missing redraw calls, and
  six of Frame's eight fields never reaching the paint routine at all.
  Every one of those was a defect in code that was *trying* to do the
  right thing and failing to. All eight fields render correctly today,
  verified pixel-by-pixel. **This is resolved. It is not evidence for
  Experience.**
- **AV-007** found and fixed a similarly concrete bug in how Fit/Fill
  rendered against placeholder artwork. Also resolved. Also not
  evidence for Experience.

**What this is.** The actual limitation is structural, not a bug:

- A **Holder** can host exactly one Frame — a single flat bag of named
  fields (`matWidth`, `frameThickness`, `borderColor`, `wallTone`,
  `cornerRadius`, `shadow`, `inset`, `defaultMargin`) — and nothing else.
  There is no way to add a second, independent decorative treatment to
  the same photo (an ornamental flourish, a texture overlay, a separate
  caption chip) without either overloading Frame's own field list with
  another unrelated concern, or inventing an entirely new Holder-level
  field for every such idea.
- A **Scene** can already host any number of Decorations and Text
  elements, but only from a closed, three-value shape
  (`fill` / `decoration` / `text`), each with its own fixed field set.
  Every genuinely new kind of visual contribution — not a new instance
  of an existing kind, but a new *kind* — requires extending that
  enumeration and teaching the renderer a new branch.

Both are the same shape of ceiling: **composition is currently achieved
by adding named fields or named kinds, never by combining independent,
freely-addable contributions.** Museum Theme authoring has now reached
that ceiling directly, on the Holder side specifically (needing more
than one visual contribution on the same photo), which is why this
canon exists now rather than remaining a deferred backlog note.

---

## 2. Product Philosophy

**An Experience is the smallest meaningful visual contribution a Theme
Author can make to a composition.** A frame. A texture. An ornamental
flourish. A caption. Each one, on its own, is a complete creative
thought — "I am adding this to the page" — independent of whatever else
is already there.

An Experience represents **creative intent**, not a technical shape:

- It is **not a graphics layer.** A Theme Author never thinks in layers,
  and this canon does not ask them to start.
- It is **not a rendering primitive.** How an Experience is eventually
  painted is entirely the Engine's concern (§5) — irrelevant to what the
  word means to a Theme Author.
- It is **not an Engine concept.** `docs/ENGINE_V2_CANON.md` is untouched
  by this document and does not gain a new object called "Experience."
  Experience is Builder's word for the *authoring act* of adding one
  Engine Element to one Engine Layer — the Theme Author's-eye view of
  something the Engine already models, never a new thing the Engine
  itself needs to know about.

The test for whether something is "an Experience": does adding it feel,
to the Theme Author, like one complete creative decision — "I added a
frame," "I added a flourish" — rather than "I filled in a new field on
something that was already there"? If yes, it is an Experience.

---

## 3. Scope

**The Experience model applies only to Builder.** It is a Theme-Author
authoring concept, full stop.

**Story Studio must remain completely unaware of Experiences.** No
Story-Author-facing screen, copy, code path, or data contract may ever
name "Experience," "Host," or any vocabulary introduced by this
document. This is not a new rule invented here — it is the same
standing discipline that already keeps "Element" and "Layer" out of
Builder's own copy (`docs/BUILDER_V2_MENTAL_MODEL.md` §1,
`docs/BUILDER_V2_BLUEPRINT.md` §15) extended one layer further down the
stack: Story Studio's vocabulary stays exactly what it already is.

**Story Authors continue working only with the existing, frozen
Base Object questions** — *can they move it, can they change it, is it
visible* (`docs/BUILDER_V2_BLUEPRINT.md` §6.2's three surfaced
questions, themselves derived from `docs/ENGINE_V2_CANON.md` §8's
`moveable`/`editable`/`visible`; `clickable` stays derived, never an
independently surfaced fourth toggle, exactly as already decided).
Experience introduces no new Story-Author-facing vocabulary, no new
permission concept, and no fourth question. Whatever an Experience is,
by the time a Story Author encounters it, it is simply an object they
can move, change, or see — indistinguishable from anything else they
already work with.

---

## 4. Ownership

**Every Experience has exactly one owner.** Owners may be:

- **Scene** — an Experience placed directly on the page: a background,
  a scattered decoration, a caption. This is already how Decorations and
  Text work today; nothing changes about Scene's role as an owner.
- **Host** — an Experience placed inside a Holder. "Host" is this
  canon's name for the ownership role Holder already plays (Engine
  Canon §6; Builder-facing "Place," Vision §5) — not a new object, and
  not a mandate to rename Holder or "Place" anywhere in Builder's UI
  copy. Whether "Host" itself ever becomes user-facing vocabulary is
  undecided and left to a future Builder Behaviour pass; this canon only
  needs the ownership *role* named once, clearly, so this section can
  state its rule.

**Hosts remain responsible only for spatial behaviour** — Position,
Size, Shape, Padding, Fit. This is exactly Holder's existing, frozen
property set (Engine Canon §6) and nothing here adds to or changes it.

**Experiences remain responsible for visual expression** — what
currently lives as Frame's flat field bag, or as a Scene Layer's
`color`/`glyph`/`text`/`font` fields, is what an Experience carries.

**An owner may host zero, one, or many Experiences.** This is the actual
capability this canon exists to unlock: today a Host may carry at most
one Frame-shaped Experience and nothing else. Once approved, a Host —
like a Scene already can — hosts as many independent Experiences as a
Theme Author chooses to add.

**Ordering** follows the same already-proven Builder verb Decorations
uses today — bring forward, send backward — never a new Layer Stack
panel (`docs/BUILDER_V2_BLUEPRINT.md` §9; `docs/BUILDER_V2_MENTAL_MODEL.md`
§1, point 4). This canon extends that verb to Hosts; it does not invent
a second ordering mechanism.

---

## 5. Relationship with Engine V2

**This is an evolution, not a competing architecture.** Engine Canon's
tree — `Theme → Scene → Canvas/Holder/Layer → Element` — is unchanged
and unchallenged by this canon. Nothing here proposes a new Engine
object, a new ownership rule, or a new rendering pipeline.

Concretely, mapped onto what Engine Canon already specifies:

- **A Scene-owned Experience realizes as a Scene Layer** (Engine Canon
  §3). This is already true today for Decorations and Text — this canon
  only removes the closed, three-value ceiling on *which kinds* of Scene
  Layer exist, not the ownership rule itself.
- **A Host-owned Experience realizes as a Holder Layer** (Engine Canon
  §3, §6). This is the part not yet built: a Holder today has no
  independently-authored Holder Layer stack at all, only a single
  reserved Frame slot. This canon requires that gap close, which is
  exactly the still-open question `docs/ENGINE_V2_SCENE_MODEL.md` §7
  (item 1) already named and left pending "a real authoring need."

**Frame does not disappear.** It becomes the first, most mature
Experience type — carrying precisely the fields it carries today,
unchanged in meaning, unchanged in rendered output. Every Frame Variation
Museum Gallery already authored remains valid without alteration.

**The Scene Model has real implications, deliberately not decided
here.** This document is product philosophy, not a schema. Before any
implementation begins, `docs/ENGINE_V2_SCENE_MODEL.md` requires its own,
separately-versioned amendment — resolving what a generalized Holder
Layer stack and an open (rather than closed-enum) Scene Layer shape
actually look like as serialized data. That amendment is named here as
required follow-on work; it is not performed by this document.

**Runtime stays a single, native implementation.** The existing Engine
V2 Runtime (`js/services/engineRuntime.js`, LOCK V2-04) remains the only
thing that ever paints anything, Experience included. This canon forbids
a second, parallel rendering path — every Experience type's paint
behaviour must be an extension of Runtime's existing rendering, never a
Builder-owned reimplementation of it, mirroring the discipline already
established for Working View (`docs/BUILDER_V2_BLUEPRINT.md` §6: "never
a second, Builder-owned rendering implementation").

---

## 6. Builder Behaviour

Described here in author-first terms only — no data structures, no
rendering pipeline, no code.

A Theme Author composing a Host (a photo's presentation) or a Scene (the
page's atmosphere) works the same way regardless of which they're
composing — the same three verbs Decorations already teaches today
(`docs/BUILDER_V2_BLUEPRINT.md` §9), now available wherever composition
happens, not confined to the Scene:

- **Add** — choose a kind of visual contribution — a frame, a texture,
  a flourish, a caption — and place it on whichever Host or Scene is
  currently open.
- **Arrange** — reposition it, resize it where that makes sense, bring
  it forward or send it backward relative to whatever else is already
  there.
- **Refine** — the existing shared Story-Author-permission block
  (`docs/BUILDER_V2_BLUEPRINT.md` §6.2), attached to whichever Experience
  is selected, asking the same three questions it already asks today,
  unchanged.

**The three existing Creative Activities are not replaced.** Place,
Decorations, and Text (`docs/BUILDER_V2_VISION.md` §3) stay exactly as
frozen — this canon does not propose a fourth activity, and does not
propose merging them into one generic picker (which would violate
`docs/BUILDER_V2_BLUEPRINT.md` §15's own standing rule against generic
inspectors). What changes is only that Place gains the same "add more
than one" capability Decorations already has, so composing a photo's
presentation is no longer limited to a single Frame slot.

**Builder copy never says "Experience" as jargon.** This canon's
vocabulary is for architecture discussion and cross-referencing — the
same way "Element" is reserved for Engine Canon and this family of
documents (`docs/BUILDER_V2_MENTAL_MODEL.md` §1) and never appears in
product copy. A Theme Author sees "Add a Frame" or "Add a Flourish,"
never "Add an Experience."

---

## 7. Migration Strategy

Incremental and reversible at every step:

1. **Every existing Frame stays exactly as authored.** It becomes the
   first Experience type with zero data change — its eight fields,
   unchanged in name, meaning, or value.
2. **Every existing Scene Layer stays exactly as authored.** `fill`,
   `decoration`, and `text` become three more Experience types, zero
   data change.
3. **New Experience types are added one at a time, only once a real
   authoring need names them** — the same discipline this whole
   authoring-validation effort has followed throughout (root cause
   before assumption, evidence before generalization). No big-bang
   rewrite of Frame/Decoration/Text into a single generic shape on day
   one.
4. **A Holder gains the ability to host more than one Experience only
   after the Scene Model amendment (§5) is itself reviewed and
   approved.** This canon does not authorize skipping that sign-off; it
   names the requirement, it does not satisfy it.
5. **At every step: Engine architecture, Runtime rendering output, every
   existing Theme, and every existing Builder workflow must remain
   provably unchanged** — the same byte-identical-render discipline
   already proven out across AV-001 through AV-011.

Reversible by construction: because every existing Frame, Decoration,
and Text is preserved as its own Experience type with unchanged fields,
no migration step requires a one-way data transform. A World authored
before this canon and a World authored after it are both valid,
permanently, with no forced upgrade.

---

## 8. Acceptance Criteria

Outcome-focused — what the Builder must ultimately let a Theme Author
do, not how it is built:

> **A Theme Author can compose a Scene — or a single Host within it —
> using multiple independent Experiences, without Builder requiring a
> new Scene-specific or Holder-specific capability for every new visual
> requirement.**

Broken into testable sub-outcomes:

1. A Holder can host more than one visual contribution at once (for
   example, a Frame and a separate ornamental Experience), each
   independently added, arranged, and removed.
2. Adding a genuinely new kind of visual contribution — one not
   anticipated by this document — does not require a Scene Model field
   explosion; it is expressible as one more Experience type, never a new
   named property bolted onto Scene or Holder.
3. Every Experience, regardless of owner, is refined through the same
   three-question permission block already frozen (Blueprint §6.2) — no
   new permission vocabulary introduced per Experience type.
4. Story Studio's code, copy, and data contracts show zero trace of
   "Experience," "Host," or any vocabulary from this document ever
   having existed.
5. Every World authored before this canon renders byte-identical after
   it is adopted.

---

## Change History

- v1.0 — Initial canon. Drafted after continued Museum Theme authoring
  reached a real compositional ceiling — a Holder unable to host more
  than one independent visual contribution — escalating the Experience
  concept from a documented future backlog idea to a canonical product
  direction. Status: Draft, pending review and sign-off. Supersedes
  nothing until approved; no implementation may begin against it until
  then.

---

## Cross-references

- `docs/ENGINE_V2_CANON.md` — the object model every Experience
  ultimately realizes against (Container → Layer → Element); untouched
  by this document.
- `docs/ENGINE_V2_SCENE_MODEL.md` — §7's Open Decision item 1 (Holder
  Layers / Content Layer authoring) is the exact gap this canon commits
  to closing; a future, separately-versioned amendment to that document
  is required before implementation, not performed here.
- `docs/BUILDER_V2_VISION.md` / `docs/BUILDER_V2_BLUEPRINT.md` /
  `docs/BUILDER_V2_MENTAL_MODEL.md` — the frozen Builder V2 IA (three
  Creative Activities, the shared permission block, "never a Layer
  Stack" rule) this canon extends, never replaces.
- `docs/BUILDER_V2_ENGINE_GAP.md` — precedent for disclosing a genuine
  architectural gap and naming required follow-on work rather than
  silently bridging it mid-implementation.
- `docs/AUTHORING_FINDINGS.md` — where the Museum Theme authoring
  evidence motivating this canon (AV-003's resolved implementation bugs,
  correctly distinguished from this document's own architectural
  finding) is recorded in full.
