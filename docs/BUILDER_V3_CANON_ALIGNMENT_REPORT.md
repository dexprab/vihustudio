# Builder V3 — Canon Alignment Report

Produced by the Canon Alignment Sprint (Product Model Purification),
run after Milestone 3 (Experience Authoring) and before any further
Experience feature work. Per that sprint's own instruction, this was a
pause on capability, not an addition to it — the objective was
conceptual clarity: does implementation describe the same product the
approved Builder V3 paper design describes? This report is that
sprint's checkpoint, in the four sections it asked for.

---

## 1. Confirmed Product Concepts

Concepts that were already correctly modeled, and needed no change to
match the canon:

- **The Foundation tier (World → Scene → Place)** is untouched and was
  never in question — this sprint's audit confirmed no Experience
  change leaked into Scene/Place/Holder code at all.
- **Experience ownership always belongs to the Theme**, never to a
  Scene or a Place — confirmed unchanged in `addExperience`,
  `graduateToPersonal`/`graduateToPublic`, and every Inspector/Card
  render path.
- **The Nurturing → Personal/Public fork, with no reverse path**
  (Canon Decisions #6/#8) — confirmed unchanged; `graduateToPersonal`/
  `graduateToPublic` still enforce it at the model layer, not just in
  the UI.
- **Delete exists only for Nurturing Experiences** (Canon Decision #9)
  — confirmed unchanged; `deleteExperience` still refuses anything
  else at its one choke point.
- **The Gallery/Nursery split and domain-sensitive Card** (Part 3/4 of
  `docs/BUILDER_V3_EXPERIENCE_STUDIO.md`) — confirmed correctly
  implemented; a Nursery card still omits ownership/usage, a Gallery
  card still shows both.
- **"Frame," "Decoration," and "Text" as author-facing creative
  vocabulary** — these are legitimate product concepts (a Theme Author
  genuinely chooses "what kind of thing am I making"), not
  implementation leakage. Museum Gallery's own real Frame/Decoration/
  Text authoring is the proof: these words describe creative intent,
  not an Engine data shape. They were kept as-is; only the *mechanism*
  behind them (the "renders" disclosure, the mirroring bridge) needed
  clearer isolation — see §2.
- **Growing (World status) and Nurturing (Experience state)** —
  confirmed both already in correct, final form from Milestone 3's own
  terminology pass; no further change needed.

---

## 2. Engine Adapter Concepts

Places where a Builder-facing concept is, in fact, a translation into
Engine V2's specific rendering mechanisms — now explicitly identified
and comment-marked as the adapter boundary, per Canon Alignment
Objective 5's "Experience ↓ Frame ↓ Scene Layer ↓ Runtime" chain:

- **`projectModel.js`'s `_syncExperienceAttachments`** is the single
  function where this chain is realized, and is now documented in-code
  as "The Engine Adapter." It is the only place that knows:
  - A Place-hosted Frame Experience projects onto a Place's single
    `frame` field (Engine Canon §9's Frame Resolution).
  - A Scene-hosted Experience projects onto the Scene's pre-existing
    full-bleed background fill Layer (`setSceneBackground` — chosen
    deliberately because it already existed; this sprint added no new
    Engine capability to satisfy the new "Hosted by Scene" case).
  - A Free-hosted Decoration/Text Experience projects onto an ordinary
    tagged Scene Layer (`_mirrorSceneLayer`, `sourceExperienceId`).
  - No other function anywhere touches this translation; the Inspector,
    the Cards, and the Host/Reuse picker only ever call the public
    `attachExperience`/`detachExperience`/`updateExperienceProperty`
    surface, never `_syncExperienceAttachments` directly.
- **`experienceSchema.js`'s `renders` map** (now `{place, scene, free}`
  per Type) is Engine Adapter *metadata* riding on a product field: it
  answers "can the adapter actually paint this combination today," and
  exists so the Inspector can disclose a real gap honestly rather than
  silently doing nothing. The Hosted By *choice* itself remains a pure
  product concept regardless of what the current adapter can do with
  it — an author can still create and hold a "Hosted by Place" Frame
  Experience even if a future Type has no adapter support yet.
- **Two literal "Engine V2" wording leaks were found and removed** from
  the Inspector's disclosure notes (`worldBuilderApp.js`,
  `_renderExperienceProperties`) — the only two places in the entire
  Experience authoring surface where an author-facing string named the
  Engine by name instead of describing the gap in product language.
  Every other "Engine V2" occurrence found in the codebase (dozens) is
  a code comment, never rendered UI text, and was left as internal
  documentation — a comment isn't Builder UI, and this sprint's mandate
  was about what an author sees.
- **What is *not* yet an adapter, because it doesn't exist yet**: there
  is no Holder Layer mechanism in Engine V2 for anything to attach to a
  Place except its one Frame slot (Scene Model §7, still an open
  question predating this sprint). This means "Hosted by Place" only
  ever has a real adapter for the `frame` Type today — Decoration/Text/
  Atmosphere/Lighting/Text Style hosted by Place record real Usage but
  paint nothing, and the Inspector says so honestly rather than
  pretending. This is a disclosed Engine limitation, not something this
  sprint's Builder-only scope could or should fix.

---

## 3. Resolved Inconsistencies

Concrete changes made this sprint, all terminology/isolation only — no
new capability, per the sprint's own "pause feature development"
instruction:

- **Attachment → Hosted By.** `EXPERIENCE_ATTACHMENTS` (2 values:
  attached/free) replaced by `EXPERIENCE_HOSTS` (3 values: place/scene/
  free) in `experienceSchema.js`; `exp.attachment` replaced by
  `exp.hostedBy` in `projectModel.js`, with a lossless read-time
  migration (`'attached'` → `'place'`, anything else → `'free'`, since
  Milestone 3 never shipped a third value for an old record to lose).
  `rendersWhenAttached(type, attachment)` renamed
  `rendersWhenHosted(type, hostedBy)`, and its `renders` map on every
  Experience Type expanded from `{attached, free}` to `{place, scene,
  free}` — `decoration` is the one Type that gained a real new
  capability marker (`scene: true`), since a Decoration's existing
  `color` property is exactly what a Scene-hosted full-bleed fill
  needs, with zero new fields.
- **Every author-facing UI string updated to match**: the Experience
  Card's meta line ("Attached"/"Free" → "Hosted by Place"/"Hosted by
  Scene"/"Hosted by Free" via a new shared `_hostedByLabel` helper so
  no call site re-derives its own wording), the Inspector's heading,
  the Host/Reuse picker (heading "Attach" → "Host Here"; button "📎
  Attach Here" → "📎 Host Here"; error copy reworded), the contextual
  "Attached: `<name>`" note → "Hosting: `<name>`", and the Nursery
  quick-create form's "Intended Attachment" field → "Hosted By,"
  sourced from `EXPERIENCE_HOSTS` instead of the retired
  `EXPERIENCE_ATTACHMENTS`.
- **The two disclosure notes rewritten** to (a) drop "Engine V2" wording
  entirely in favor of plain product language ("doesn't appear on the
  page yet — that's coming in a future Builder release"), and (b)
  correctly branch on all three Hosted-By values instead of the old
  binary check, so a Scene-hosted Type with no adapter support is
  disclosed just as honestly as a Place-hosted one was before.
- **`_syncExperienceAttachments` explicitly labeled as the Engine
  Adapter** in its own doc comment, and extended (not rewritten) to
  branch on the entry's `placeId` (Place hosting, unchanged) vs. the
  Experience's own `hostedBy` field when `placeId` is absent (Scene vs.
  Free — a distinction the real usage-entry shape alone can't carry,
  since both cases share `{sceneId, placeId: null}`).
- **The internal `exp.attachments` array name was deliberately left
  unchanged.** It is a record of real usage/placement (`{sceneId,
  placeId}` pairs), never shown to an author as a raw field name (only
  ever surfaced through "Used In"/"Usage" UI copy, which already used
  product language before this sprint) — renaming it would have been
  pure internal churn with no author-visible benefit, which the
  sprint's own "remove implementation leakage, don't remove
  capabilities" framing argues against doing for its own sake.

---

## 4. Open Questions

Things this sprint deliberately did not resolve, because resolving them
would have meant adding capability (out of scope) or because they
genuinely need a product decision this sprint's brief didn't make:

1. **Experience → Objects is not yet implemented.** The frozen product
   model describes an Experience containing immutable Objects (Image/
   SVG/Text/Shape/Color/Gradient/Effect/Animation/Audio, explicitly an
   open list). Today, an Experience still has exactly one implicit
   "shape" per Type (a Frame's field set, a Decoration's glyph+color, a
   Text's words+styling) — not a literal `objects[]` array. This is
   *not* a "specialized Experience subclass" in the sense the canon
   warns against (there's no `FrameExperience` class, no per-Type
   inheritance), but it is also not yet the Objects model either.
   Building a real Objects array this sprint would have been new
   capability, explicitly out of scope ("pause feature development").
   **Needs a decision**: should the next feature milestone build
   `experience.objects[]` as a real, generic array (each object one of
   the open kinds), migrating today's flat `properties` bag into it? Or
   is the current flat-properties-per-Type shape an acceptable
   permanent simplification for the Types that exist today?
2. **Atmosphere, Lighting, and Text Style have no adapter and no Museum
   Theme usage.** They were kept (per "do not remove capabilities")
   rather than deleted, but they are, honestly, reserved vocabulary:
   zero render path today (their `renders` map is `{place:false,
   scene:false, free:false}` for all three), and nothing in the actual
   Museum Theme authoring work this sprint verified against uses them.
   **Needs a decision**: keep them visible in the Type picker as
   forward-looking reservations (current state), or hide them from the
   picker until an adapter exists for at least one Hosted-By mode, to
   avoid an author picking a Type that can never render?
3. **The Type field's dual purpose is now documented, not resolved.**
   Per Objective 3's own instruction ("why does this field exist"):
   Type currently serves two distinct purposes at once — (a) a
   creative/content decision (which Properties fields the Inspector
   shows — legitimate, author-facing, keep), and (b) an Engine Adapter
   dispatch key (which mirror routine `_syncExperienceAttachments`
   invokes, and which `renders` capability row applies — adapter
   concern, arguably shouldn't need to live on the same enum an author
   picks from). This sprint did not split these two responsibilities
   into separate fields, since doing so would be a real data-model
   change (new capability/migration), not a terminology fix. **Needs a
   decision**: is a single Type field serving both purposes an
   acceptable permanent design (most software does exactly this — a
   "kind" discriminator both informs UI and dispatches logic), or does
   the Engine Adapter's dispatch need its own separate, Builder-invisible
   mapping so a future Type vocabulary change never implicitly changes
   adapter behavior?
4. **"Hosted by Scene" has exactly one real implementation today**
   (Decoration → full-bleed background color). A Frame or Text
   Experience can be *set* to `hostedBy: 'scene'`, but `renders.scene`
   is `false` for both, so the Inspector discloses the gap rather than
   silently doing nothing — correct behavior, but it means "Scene" as a
   hosting concept is currently much narrower in practice than "Place"
   or "Free." **Needs a decision**: is Background-color-via-Decoration
   the only Scene-hosting use case worth having, or should a future
   milestone give Text/other Types a real Scene-level render path too
   (e.g., a Scene-wide watermark)?
5. **The Place-as-new-tier Canon Conflict, carried forward from
   `docs/BUILDER_V3_WIREFRAMES.md` and still open as of Experience
   Studio v1.1, remains open.** This sprint's audit did not touch it —
   it's a Foundation-tier question, not an Experience-terminology one,
   and was out of this sprint's declared scope.
