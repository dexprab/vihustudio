# Scene Adapter Architecture Analysis — Long-Term Impact Assessment

**Status:** Investigation only. No code written. Companion to
`docs/ENGINE_V2_PROMOTION_STRATEGY.md`, which proposed exactly the
component this document interrogates — a Studio-side, additive
`js/engineV2Adapter.js` translating a published Theme into Engine V2's
Scene Model. That document asked "is this a safe next step"; this one
asks "is it good permanent architecture." The answers differ, and the
difference matters.

**Assumed pipeline** (per the request): `Builder → Publish Theme
(.vtheme) → Standalone Scene Adapter → Canonical Scene → Shared Runtime
→ Creator / Publish / Reader`. Builder's authoring architecture is held
frozen throughout.

---

## Q1 — Creator work that remains after the Scene Adapter exists

| Category | State | Why |
|---|---|---|
| **Rendering** | Requires significant work | The Adapter changes *data shape*, not *drawing capability*. Every gap `docs/ENGINE_V2_PROMOTION_STRATEGY.md` §2 catalogued (Frame ornament presets, page furniture, Quote composition, Artwork Theme layering, the image-adjustment stack, the DPR/WYSIWYE canvas contract) still has to be built into the Shared Runtime regardless of whether a canonical Scene reaches it — the Adapter cannot paint pixels it was never asked to paint. |
| **Object Strip** | Mostly complete | Already restructured this session to be a pure render-tree reader with a uniform object shape (`owner`/`moveable`/`editable`, Creator Reconciliation Sprint Phase 1). With a real canonical Scene, Object Strip's remaining work shrinks to re-pointing at canonical Scene Object ids instead of today's render-tree ids — mechanical, not a redesign. |
| **Context Panel** | Partially complete | Phase 1 made it *capability-first* for the disclosure-vs-generic-section decision, but the actual editing controls are still a hardcoded, closed 5-type table (`TYPE_TO_SECTIONS`) mapping to fixed Card Designer sections. A canonical Scene Object contract doesn't retire this by existing — Context Panel still needs to be rebuilt to render *whatever properties the contract exposes*, generically, rather than "here are Frame's 6 known controls." That rebuild is real, unstarted work. |
| **Selection** | Mostly complete | Already one bidirectional model (canvas click ⇄ Object Strip tap ⇄ `setSelectedSceneElement`), confirmed working today. Needs re-pointing at canonical ids, same as Object Strip — low risk, given the mechanism already exists and already works. |
| **Editing (persistence of Story-Author changes)** | Requires significant work | Confirmed by reading `js/projectManager.js`'s `serialize()`: today's override bags — `slide.metadata.cardOverrides.border`, `.cardOverrides.artwork`, `.elementOverrides` — are keyed by *blueprint element ids* or fixed single-instance keys (`'border'`, `'artwork'`), a Creator-invented key space that has no relationship to a canonical Scene Object's own id. Every one of these bags would need to be redesigned to key against canonical Scene Object ids instead — the exact same class of work Phase 1 already named and deferred as "Phase 2: needs a new override bag mirroring `elementOverrides`, keyed by Scene Object id." |
| **Save / Reload** | Mostly complete, one real gap | The good news, confirmed by reading `serialize()` directly: Creator **already** persists the right *shape* of thing — Story-Author deltas (`pages[].metadata`, `.storyBeat`, `.storyDraft`) plus a bare `theme` id reference, never a resolved/cached Theme snapshot. Reload already re-resolves the Theme fresh every time (`ThemeEngine.applyTheme(AppState.project.theme)`). A canonical-Scene architecture fits this pattern naturally — the Scene is re-derived fresh on load, same as theme resolution is today. The one real gap: the deltas' *key space* has to move to canonical Scene Object ids (same redesign as Editing, above) so a reload's re-derived Scene and the saved deltas still line up. |
| **Publish** | Requires significant work | Same reasoning as Rendering — Publish needs the Shared Runtime to actually paint a page, and every fidelity gap in the Runtime blocks Publish equally. The Adapter existing doesn't shrink this; it's entirely gated on Runtime readiness. |
| **Runtime integration** | Partially complete, but this is a dependency, not Creator's own work | The *wiring* (swap `SlideRenderer.render()` call sites for Shared Runtime calls) is mechanical once the Runtime has fidelity parity — but that parity is the large, unstarted item everything else in this table depends on. Listing it as "Creator work" is slightly misleading: it's Runtime work Creator is blocked on, not Creator work per se. |
| **Remaining Builder-specific assumptions** | Requires significant work | Confirmed by this session's own earlier audit: Creator has essentially zero hardcoded World/Theme *identity* special-casing today. But it has extensive hardcoded assumptions about **Engine V1's own vocabulary** — Frame Variation's 8 named fields, Layer Pack's 5 containership scopes, Presentation Presets' resolution order, page-furniture position enums. None of that is "Builder-specific" in the id sense, but all of it is specific to the *current compiled Theme Contract's shape*, which a canonical Scene Model (Engine V2's own schema) does not share field-for-field. Every one of these assumptions needs re-expressing in the canonical Scene's own vocabulary — this is where most of the "Rendering" and "Context Panel" work above actually lives. |

**Net read on Q1**: the Scene Adapter, by itself, retires almost none of
the *hard* remaining Creator work. What it retires is exactly what
Creator Reconciliation Sprint Phase 1 already retired without it —
object-list reconstruction. The expensive categories (generic
capability-driven editing, full Runtime drawing parity, Story-Author-edit
persistence against canonical ids) are gated on the *Shared Runtime*
reaching parity and on Context Panel/persistence being rebuilt around a
generic contract — neither of which the Adapter does or can do, because
an Adapter only reshapes data, it doesn't paint pixels or invent
generic UI.

---

## Q2 — Long-term maintenance cost: does the Adapter isolate Creator from Builder evolution?

The honest answer is **partially, and the partition is predictable**:
the Adapter isolates Creator from *additive* Builder evolution and does
**not** isolate Creator from *structural* Builder evolution. This
session's own Phase 1 work is direct, already-executed evidence for the
additive case: `layer.permissions.moveable/editable` — a real, brand-new
capability — flowed from Builder through convergence into a working
Creator feature (Object Strip badges, Context Panel routing) by touching
exactly three files (`builder.js`, `renderer/slideRenderer.js`,
`js/objectStrip.js`+`js/contextPanel.js`), with zero changes to Card
Designer's core editing architecture. That is the Adapter pattern
working as advertised — *for one specific, narrow class of change.*

| Builder change | Classification | Why |
|---|---|---|
| New Scene property (an additive field on an existing object kind, e.g. `layer.opacity` — this session's own `_pushLayerObject` extension is a real precedent) | Scene Adapter + Runtime changes only | Adapter passes the field through; Runtime reads and paints it; Creator needs no change if the property has no dedicated UI, or one small read-site if it does (exactly what happened with `moveable`/`editable`). |
| New capability/permission flag | Scene Adapter + Runtime changes only, occasionally one Creator read-site | Same reasoning; proven this session. |
| New named preset within an *existing* closed vocabulary (e.g. an 8th Frame Variation ornament design) | Scene Adapter + Runtime changes only | Confirmed: Creator's Frame Variation picker (`CONTROL_CATALOG.frameVariation`) already reads `theme.frameVariations` generically — a new named entry needs zero Creator changes, only a new Runtime drawing routine for the new preset id. |
| **New object type** (a Scene Layer/Holder *kind* that doesn't exist today) | Requires changes all the way into Creator | Not automatic. `convergeSceneLayer`'s own structure — a `kind`-by-`kind` `if` chain — shows a translation layer inherently needs an explicit branch per kind; the canonical Scene's own schema (`engineSchema.js`'s closed `LAYER_TARGETS`/`SHAPE_KINDS` enums) is equally closed; the Runtime needs new paint code; and Creator needs new Object Strip iconography/Context Panel controls for anything Story-Author-facing. Four layers, not one. |
| **Perspective / Animation / Audio / Lighting** | Requires changes all the way into Creator | The most expensive category, and not hypothetical — Audio Studio is already on this project's own roadmap (CLAUDE.md's Roadmap item 6, unbuilt). None of these have *any* rendering vocabulary today in either engine — a static-canvas Runtime cannot paint animation or play audio without a fundamentally different playback/timing model, and Creator's whole interaction language (Object Strip cards, the Add/Modify/Remove verb set) has no existing concept of "play/pause" or "adjust over time." The Adapter cannot insulate Creator from this — there is no existing shape to translate *into*. |
| **New Frame system** (structurally new, e.g. a frame with its own nested sub-layers) | Requires changes all the way into Creator | Same reasoning as new object types — if it doesn't fit the existing flat-band model, it's a new object type wearing a Frame costume. |

**Net read on Q2**: the Scene Adapter does not "isolate Creator from
Builder evolution" as a blanket property. It correctly absorbs the
*narrow, already-demonstrated* case (new fields on existing shapes) at
low cost, and it does nothing for the *expensive, roadmap-real* case
(new interaction paradigms). Presenting it as general insulation would
overstate its value — stakeholders should expect exactly the same kind
of change this session's Phase 1 handled to stay cheap, and exactly the
kind of change the product roadmap already names (Audio) to stay
expensive, Adapter or not.

---

## Q3 — Architectural value: permanent boundary, temporary layer, or unnecessary?

**Temporary migration layer** — and this is the single most important
finding of this document, because the way the question is posed
(*Builder → Publish → Adapter → Canonical Scene → Runtime*) places the
Adapter **after** Publish, i.e. it runs at consumption time, on an
already-compiled artifact. That is not the only place a translation
step could live, and it is not where the codebase's own existing
precedent puts one.

The codebase already has a translation step from Builder's authoring
Scene Model into a runtime-consumable shape: `builder.js`'s
`convergeSceneLayer`/`convergeScene`. It runs **once, at Build time**,
producing the compiled `.vtheme`. Every "Convergence Sprint" entry in
this project's own history — Builder Convergence Sprint, the Happy Flow
Completion Sprint, the Representation Ordering fix — reinforces one
consistent, explicitly-stated preference: *extend the existing
pipeline, do not stand up a parallel one.* A runtime-time Standalone
Scene Adapter is, structurally, a second translation step sitting
downstream of a first one (`convergeSceneLayer`) that already exists
and already does conceptually the same job (Builder shape → runtime
shape) — just targeting a different destination shape.

The architecturally clean end-state is not "Adapter runs forever
between Publish and Runtime." It's: **retarget Builder's own Build-time
convergence to emit the canonical Scene shape directly**, so Publish
*is* the canonical Scene, and no runtime-time Adapter is needed at all
— matching exactly how `convergeSceneLayer` already works today, just
pointed at a different output schema. Under that end-state, `.vtheme`
stops being "Engine V1's compiled shape" and becomes "the canonical
Scene, packaged" — a Build-time-only change, never touching Builder's
authoring model (satisfying the frozen-Builder premise), never adding a
permanent runtime-time layer.

This is explicitly **not available yet**, because it requires changing
what Build/Publish *emit*, which the current investigation's own premise
("assume Builder is frozen") rules out discussing further. That is
exactly why the Standalone Scene Adapter is the *right next move* — as
scaffolding, matching `docs/ENGINE_V2_PROMOTION_STRATEGY.md`'s Phase
0-3 proposal precisely — but it should be built and governed as
temporary infrastructure with a named retirement condition, not
mistaken for the platform's permanent boundary. Calling it "permanent"
would mean the codebase deliberately settles for a translation step
existing twice (once at Build, once at consumption) forever, which
contradicts this project's own repeatedly-demonstrated convergence
discipline.

---

## Q4 — Risk assessment

**Short-term migration risks** (real, bounded, expected to resolve once migration completes):

- **Fidelity gaps during the transition window** — every gap named in
  `docs/ENGINE_V2_PROMOTION_STRATEGY.md` §2 (ornament presets, page
  furniture, Quote composition) is a real chance of visible regression
  for a real Published Theme (Museum Gallery) while the Runtime is
  still catching up.
- **Dual maintenance** — Engine V1 has to stay alive as the working
  reference/fallback throughout the migration (per that document's own
  Phase 4 gate), meaning two engines are genuinely maintained in
  parallel for the duration, not a permanent cost but a real one.
- **Performance**, specifically interactive-frequency drawing (drag-move
  in the live editor) — flagged as unmeasured in the prior document,
  still unmeasured here; a real risk of the migration stalling at Phase
  3 if Engine V2's per-object band/shape drawing turns out too slow at
  60fps-interaction cadence.
- **Translation drift** *during migration specifically* — while both
  `convergeSceneLayer` (Build-time) and the new runtime-time Adapter
  exist simultaneously, two independent people/sprints touching either
  one without the other risks exactly the "kept in lockstep by hand"
  problem the Decoration Shapes sprint already demonstrated is fragile
  in this codebase, now doubled (two translation steps instead of one).

**Long-term architectural risks** (only real if the Adapter is kept as permanent infrastructure, per Q3):

- **Institutionalized double translation** — if the Adapter is never
  retired, the platform permanently maintains two translation steps
  (Build-time convergence, runtime-time Adapter) doing overlapping
  work, which is strictly more total system complexity than either "one
  Build-time translation, no runtime Adapter" (the clean end-state) or
  "no translation at all" (impossible, some shape mismatch always
  exists) — this directly contradicts the "minimal future duplication"
  goal stated for this investigation.
- **Unbounded Adapter complexity growth** — every structural Builder
  change (Q2's expensive category) adds a new branch to the Adapter's
  own translation logic, the same shape `convergeSceneLayer` already
  shows (a steadily growing kind-by-kind `if` chain). Left running
  forever, the Adapter risks becoming a second, parallel rendering-
  semantics implementation in its own right — needing deep enough
  understanding of geometry/precedence/defaults to be isomorphic to
  what the Runtime will do with its output, which is most of the hard
  part of writing a renderer, done twice.
- **Information loss** — a concrete, checkable risk, not speculative:
  `_resolveArtworkFields` (Engine V1) already discards a chosen Frame
  Variation's *name*, keeping only resolved field values, by the time
  rendering happens; Object Strip's Layer Pack labels rely on Builder
  having authored an explicit `.label` field, falling back to a
  humanized id when absent. Any Adapter that passes through *resolved
  values* rather than *authored identifiers* risks the same silent
  degradation at a new layer — a Story-Author-facing name like "Gold
  Accent" becoming a generic id-derived string, with no code error to
  signal the loss.
- **Runtime evolution risk, cutting the other way** — once Creator,
  Publish, and eventually Reader all depend on one Shared Runtime, a
  Runtime change has a much larger blast radius than an Engine-V1-is-
  Studio-only change does today. This is actually the strongest
  argument *for* convergence (one implementation, one place to fix
  bugs) but it's a real risk in the sense that the Runtime needs real
  compatibility discipline (versioning, regression coverage across
  every consumer) that doesn't exist as a practice anywhere in this
  codebase yet.
- **Builder evolution risk, precisely bounded by Q2** — the risk isn't
  "the Adapter fails to keep up," it's that stakeholders might *believe*
  the Adapter provides general insulation from Builder evolution when
  it only provides it for the additive case. The real risk is
  over-trusting the abstraction for the Audio/Animation/Perspective
  category the roadmap already names as coming.

---

## Q5 — Recommendation

**Option A, conditionally — build the Standalone Scene Adapter, but
govern it explicitly as temporary migration scaffolding with a named
retirement condition, not as the platform's permanent boundary.**

Justification, weighted by the stated goals (long-term maintainability,
architectural convergence, single source of truth, minimal future
duplication, lowest lifetime cost of ownership — not implementation
effort):

- **Not Option B, plain** (stabilize Creator on the existing
  architecture, stop there). Real, measured progress happened this
  session doing exactly this — Object Strip and Selection are genuinely
  more converged and lower-maintenance than before, with zero new
  engine risk. But this path has a hard ceiling: it can only ever
  converge Creator around Engine V1's *own* vocabulary. It never gets
  the platform to one shared Runtime, which blocks Reader from ever
  existing as anything but a third static-export format, and leaves
  Engine V1/Engine V2's existing hand-synced duplication (Decoration
  Shapes) as a permanent, uncorrected tax rather than a temporary one.
  Stopping here optimizes short-term risk at the cost of long-term
  single-source-of-truth — the opposite of what was asked to be
  optimized for.
- **Not Option A, unconditionally** (build the Adapter and leave it as
  a permanent runtime-time layer). Per Q3/Q4, this is the option that
  most directly contradicts "minimal future duplication" — it
  institutionalizes a second translation step alongside one
  (`convergeSceneLayer`) that already exists, forever, when the
  clean end-state is one translation step, at Build time, full stop.
- **Not a fresh Option C from nothing.** The right long-term shape —
  Build-time convergence targets the canonical Scene directly, no
  runtime-time Adapter — is not a *different* architecture from what's
  being proposed; it's the proposed Adapter's own natural retirement
  point, reached by later changing what `convergeSceneLayer` emits
  (a Build-time-only change, never touching Builder's authoring model,
  fully consistent with "Builder frozen" as a *near-term* constraint,
  not a permanent one). Framing this as a separate "Option C" would
  imply throwing away the Adapter's work; the correct framing is that
  the Adapter *is* the path to Option C, if built with that destination
  in mind from day one.

**Concretely, what "build it conditionally" means**: proceed with
`docs/ENGINE_V2_PROMOTION_STRATEGY.md`'s Phase 0-3 exactly as proposed
— the Adapter is real, necessary, low-risk scaffolding for getting the
Shared Runtime to fidelity parity while Builder stays untouched. But
record, alongside it, an explicit Phase 4.5 this document adds to that
plan: **once the Runtime has proven fidelity parity and the canonical
Scene shape has stabilized, retarget Build-time convergence to emit it
directly, and retire the runtime-time Adapter** — at that point it
becomes dead code for every newly-Built theme, kept only as a
read compatibility shim for already-published `.vtheme` packages that
predate the change, if any such compatibility window is needed at all.
This is the version of "proceed with the Adapter" that actually
satisfies single-source-of-truth and lowest lifetime cost, rather than
trading a Creator-side duplication problem for a platform-side one.

---

## Cross-references

- `docs/ENGINE_V2_PROMOTION_STRATEGY.md` — the migration phases this
  document's Q5 recommendation extends with an explicit retirement
  condition (its own Phase 4.5).
- `docs/ENGINE_V2_SCENE_MODEL.md` — the canonical Scene Model schema
  this document assumes as the Adapter's translation target.
- `docs/THEME_CONTRACT.md` / `docs/THEME_TO_CREATOR_MAP.md` — the
  current Theme Contract and Creator-surface mapping this document's Q1
  table cross-references for what Creator hardcodes today.
- CLAUDE.md's "Creator Reconciliation Sprint — Phase 1" entry — the
  concrete, already-shipped precedent this document's Q1/Q2 answers
  are grounded against, not speculation.
