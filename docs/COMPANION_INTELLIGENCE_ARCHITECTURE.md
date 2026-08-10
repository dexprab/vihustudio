# Companion Intelligence — Discovery & Architecture Proposal

**Status: proposal only. No code was written for this document.**

> **Superseded in scope for the near term, not in content.** The product
> owner has since made *platform guidance* the Companion priority
> (`docs/COMPANION_CANON.md` → Canon 5, added in Canon V3).
> `docs/COMPANION_V1_PROPOSAL.md` is the executable slice of this
> document — it maps onto Phases 0–2 below, adds the one thing this
> document lacks (a way for a child to *ask* something), and defers
> Phases 3–4 behind the gates this document already named. Read this
> document for the long-range architecture, knowledge tiers, action
> gates and AI boundary; read that one for what is being built now.
> The two must not diverge: if a recommendation here changes, change it
> here and let the v1 proposal cite it.

This follows the precedent of `docs/ENGINE_V2_PROMOTION_STRATEGY.md` and
`docs/SCENE_ADAPTER_ARCHITECTURE_ANALYSIS.md` — investigation-and-design
documents produced *before* any implementation, gated behind this project's
standing rule that architecture changes require explicit approval
(`CLAUDE.md` → Core Principles).

Every recommendation below cites the real module, service, or document it
extends. Where the codebase already solves part of the problem, that is
stated and reused rather than replaced.

---

## 0. Two corrections to the brief's stated premises

Both are stated up front because they materially change the recommendation.

**0.1 — The platform is not React.** The brief says *"The current platform is
React/HTML/CSS/JavaScript."* Verified: there is no `package.json`, no
`node_modules`, no ES modules (`grep -c 'type="module"' index.html` → `0`),
no build step, and zero React references anywhere. `index.html` loads **55
classic `<script>` tags** in dependency order, each file an IIFE that attaches
one global to `window` (`js/pageRuntime.js:147`, `js/sceneEngine.js`,
`js/companionEngine.js` — all the same shape). Cache-busting is a manual
`?v=NNNN` bump across every tag.

This is *good news* for the request. "Naturally extends the existing stack"
means: **new IIFE modules, `window`-attached, loaded by `<script>` tags, no
build tooling introduced.** A proposal that assumed React would have
introduced a toolchain the platform has deliberately never had.

**0.2 — The codebase already anticipated this exact request.**
`js/companionEngine.js`'s own header, and `docs/COMPANION_ENGINE.md`'s
"Future Ready" section, both already describe `personality.json`'s
`neverSays` list as *"authored policy data for a **future** AI-driven speech
feature to respect, disclosed as currently inert since every message this
sprint speaks is static, curated, human-authored text."* The same header
states `speak()` was written so *"a later version can grow real capability
behind the exact same signature."*

The extension point is not hypothetical. It was reserved.

---

## 1. Current architecture assessment

### 1.1 What the Companion is today

A **two-layer, package-driven visual presence** with a deliberately frozen
runtime API.

| Layer | File | Knows about |
|---|---|---|
| Runtime | `js/companionEngine.js` (927 lines) | Nothing specific. Loads a package, swaps images, shows a bubble. |
| Director | `js/companionDirector.js` (581 lines) | Studio moments. The **one file allowed** to map events → poses/speech. |
| Content | `assets/<id>/` + `assets/registry.json` | Everything about who a companion *is*. |

The Engine's frozen public API:
`load / unload / show / hide / setState / getState / speak / wake / sleep /
destroy`, plus additive `setRichness / boostGlow / setSyncBadge /
getSyncBadge / getPersonality / getAnimations / isVisible`, and the static
`loadRegistry(assetsBase)`.

**Adding a companion requires zero code**: one asset folder
(`companion.json` + optional `personality.json` + optional `animations.json`
+ one PNG per declared state) and one `assets/registry.json` entry. Proven
four times over — `lumo` (guardian), `story-egg` (traveller), `nimbus`,
`quill` (companions).

### 1.2 What the Companion knows today

Almost nothing, and deliberately so. `js/companionDirector.js` holds a static
`MODES` table:

```js
const MODES={
  traveller:{ role:'traveller', speaks:false, bootPose:'idle',
    poses:{ typing:'curious', creating:'thinking', artwork:'excited',
            publish:'hatching', newPage:'excited' } },
  creator:{ speaks:true, bootPose:'wave',
    poses:{ typing:'curious', creating:'think', artwork:'celebrate',
            publish:'celebrate' } }
};
```

`notify(event)` accepts exactly seven strings: `story-started`,
`artwork-added`, `published`, `creator-born`, `ceremony-closed`,
`page-added`, `project-sync-pending`. Speech is a random pick from
`personality.json`'s `greetings` array. There is no situational reasoning of
any kind.

The one exception is genuinely dynamic: `currentRichness()` reads
`AppState.slides.length` and maps it to a 0/1/2 visual richness level. That
is the only place the Companion currently *looks at the project at all* —
and it is the proof that a richer reading is architecturally possible from
the same seat.

### 1.3 What the platform already knows (and the Companion doesn't ask)

This is the most important finding in the whole investigation. **Most of the
"intelligence" a Companion would need already exists as structured data.**
It is simply never routed to the Companion.

| Existing capability | Module | What it already answers |
|---|---|---|
| Uniform object model | `renderer/slideRenderer.js`'s `_sceneObject(raw,owner)` (line 3596) | *"What is on this page?"* — every object normalized to `{id,type,label,owner,moveable,editable,visible,locked,visual,bbox}` regardless of origin |
| Runtime state | `js/pageRuntime.js` | *"What page is active, what's rendered, what's selected?"* |
| Permission truth | `SlideRenderer.getPlacePermissions()`, `getPlaceV2LayerPermission()` | *"Is the child allowed to touch this?"* |
| Story health | `js/publishValidator.js` | *"What is this story missing?"* — already returns friendly, ordered, non-blocking nudges with a `fixHint` routing key |
| Control map | `docs/THEME_TO_CREATOR_MAP.md` | *"Where does a Theme field surface in Creator?"* — with a repeatable 4-question method |
| Screen guidance | `tools/world-builder-v2/js/worldBuilderApp.js`'s `STATE_GUIDANCE` (line 2719) | What / Why / Do / Next per Builder screen |
| Friendly naming | `js/objectStrip.js`'s `FRIENDLY_TYPE` (line 86) | Kid-facing names for object kinds |
| Guardrail explanation | `js/contextPanel.js`'s `_renderWorldObjectDisclosure` (line 1566) | Already answers *"why can't I move this?"* in child-safe language |

`js/publishValidator.js` deserves special note. It is, in miniature, exactly
the kind of engine this proposal argues for: **pure rules over project
state, returning structured intents, never blocking, always kind.** Its own
header states the design rules — *"Friendly language only. Never 'error',
never 'warning'. Never blocks publishing."* Any Companion knowledge layer
should be built in its image, not beside it.

### 1.4 The one structural gap

**There is no global undo/redo.** Verified across the codebase: undo exists
only as local per-tool stacks — doodle strokes (`js/cardDesigner.js`),
Picture Studio brush strokes and `_preCropSnapshot` (`js/pictureStudio.js`).
There is no project-level history, no command pattern, no inverse-operation
registry.

This is the single hardest constraint on any Companion *action* capability
and it is treated as load-bearing throughout §7.

### 1.5 Backend precedent

Exactly one Edge Function exists: `supabase/functions/family-album/index.ts`.
Its conventions are already the right ones for a model gateway:

- Restricted, non-open proxy (host allowlist).
- *"Expected failures come back as 200 `{ ok:false, error:'<reason>' }` so
  the client always gets a readable, non-throwing answer; only malformed
  requests get 4xx."*
- Client-side counterpart pattern established by `js/themeRepositoryClient.js`:
  config from `supabase-config.json` resolved against
  `document.currentScript.src`, dynamic ESM import of the Supabase SDK from
  CDN, anonymous sign-in, **never throws**.

`supabase/schema.sql` holds 8 tables with RLS keyed on `auth.uid()::text`
and 5 `SECURITY DEFINER` RPCs. Adding a Companion table would follow an
established, well-understood pattern.

### 1.6 The canon boundary

`docs/COMPANION_CANON.md:17` is unambiguous:

> *"A companion is not an assistant, a chatbot, a teacher, or an AI tutor."*

Every recommendation below is constrained by this. The Companion becomes
**more aware**, not more talkative. Where a capability risks crossing into
assistant behaviour, it is flagged in §9.

---

## 2. Companion architecture proposal

### 2.1 Shape

Four additive modules, each extending a seam that already exists. Nothing
below replaces an existing system.

```
                 ┌──────────────────────────────────────────┐
                 │  assets/<id>/*  +  companions/knowledge/* │  ← authored data
                 └──────────────────────────────────────────┘
                                     │
  ┌──────────────┐   situation   ┌───▼────────────┐   intent   ┌───────────────┐
  │ CompanionCtx │──────────────▶│ CompanionBrain │───────────▶│ CompanionDir  │
  │  (read-only) │               │ (rules first)  │            │  (existing)   │
  └──────┬───────┘               └───┬────────────┘            └───────┬───────┘
         │ reads                     │ optional escalation             │ calls
         ▼                           ▼                                 ▼
  PageRuntime                 ModelGateway                     CompanionEngine
  SlideRenderer               (Edge Function)                    (frozen API)
  PublishValidator                  │
  ThemeRegistry                     ▼
  AppState                    provider adapter
                                                        ┌──────────────────┐
                                    intent.action ──────▶│ CompanionActions │
                                                        │ (whitelist+gate) │
                                                        └────────┬─────────┘
                                                                 ▼
                                                   SceneEngine / PageOps /
                                                   ContextPanel (existing)
```

| New module | File (proposed) | Role | Depends on |
|---|---|---|---|
| Context Reader | `js/companionContext.js` | Builds one read-only *situation snapshot*. Owns no state. | PageRuntime, SlideRenderer, PublishValidator, ThemeRegistry, AppState |
| Brain | `js/companionBrain.js` | Situation + event → **intent**. Deterministic rules first; model call is an opt-in escalation. | CompanionContext, knowledge corpus, (optional) ModelGateway |
| Action Broker | `js/companionActions.js` | Named, whitelisted, guardrail-checked, reversible Studio actions. | SceneEngine, PageOps, ContextPanel, PageRuntime |
| Model Gateway | `supabase/functions/companion-chat/index.ts` + `js/companionModel.js` | The **only** place a model provider is named. | family-album precedent |

### 2.2 Why not a fifth "Companion Service"

Because `js/companionDirector.js` already *is* that service. Its own header
declares it the one file permitted to know Studio-specific moments. Adding a
parallel orchestrator would create exactly the duplicate-brain problem the
brief warns against. The Director's `MODES` table becomes one input to the
Brain rather than the whole decision.

### 2.3 Why the Engine must not change

`js/companionEngine.js` is the platform's proof that a companion is content,
not code. Every capability below is expressed through its *existing frozen
API* — `setState()`, `speak()`, `setRichness()`, `boostGlow()`. If a future
capability genuinely cannot be expressed that way (e.g. a speech bubble that
needs a *choice affordance*), that is a deliberate, disclosed, additive
extension — never a redesign.

### 2.4 The intent object

The single contract between Brain and Director:

```js
{
  pose:    'curious',                     // optional — an existing declared state
  say:     'Your cover has no name yet!', // optional — final text, already policy-checked
  offer:   { label:'Name it', actionId:'focus.book-title' },  // optional — child must tap
  action:  null,                          // reserved; see §7 — null until undo exists
  source:  'rule:no-title',               // provenance, for logging and debugging
  confidence: 1.0
}
```

Every field optional. A Brain that returns `{}` means *"say nothing, do
nothing"* — the correct and most common answer.

---

## 3. Integration strategy

### 3.1 The three seams, and why exactly these

**Seam 1 — awareness: `js/pageRuntime.js`.** It already owns *"what page is
active, what objects are rendered, what's selected"* and already has one
`notify()` dispatch called by every mutation path. `CompanionContext` reads
through it; the Director subscribes to a new observer on it. No polling, no
second source of truth.

**Seam 2 — meaning: `js/companionDirector.js`.** Already the sanctioned home
for Studio-specific knowledge. Its `notify(event)` vocabulary grows; its
`MODES` table stays as the *baseline* mapping the Brain can always fall back
to.

**Seam 3 — action: `js/sceneEngine.js` + `js/pageOps.js`.** These are already
the complete mutation surfaces (`setVisibility/setPosition/setSize/
setRotation/setOpacity/setLocked/adjustZIndex/setContentOverride/addSticker/
updateSticker/removeSticker/...` and `duplicatePage/deletePage/
insertBlankPage/reorderPage/...`). The Action Broker calls *these* — it never
manipulates state directly.

### 3.2 Fail-open is structural, not a feature

The brief requires the platform to work fully if the Companion or any AI
service is unavailable. This falls out of the design rather than needing
enforcement:

- `CompanionContext` is read-only. Removing it changes nothing.
- The Brain's rules run locally. With no gateway configured, it simply never
  escalates.
- Every existing call site already uses the codebase's defensive pattern:
  `try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify(...) }catch(e){}`.
  Deleting `js/companionDirector.js` outright leaves Studio fully functional
  today, and must continue to.
- The Action Broker is *only ever* invoked by a child tapping an offer.

### 3.3 What is deliberately not touched

`renderer/slideRenderer.js`, `js/sceneEngine.js`, `js/pageOps.js`,
`js/publishValidator.js`, `js/companionEngine.js`, the Theme Contract, the
Engine V2 Scene Model, `tools/world-builder/`, `tools/world-builder-v2/`.
All are *read from* or *called into*, never modified.

---

## 4. Capability map

Ordered by risk, lowest first. Each row names the seam that provides it.

| # | Capability | Example | Needs a model? | Risk |
|---|---|---|---|---|
| C1 | **Situational reaction** | Notices the child has added five stickers and reacts with delight | No | None — pose only |
| C2 | **Noticing absence** | *"Your story doesn't have a name yet"* | No — `PublishValidator` already computes this | Low |
| C3 | **Guardrail explanation** | *"That one belongs to the World — you can move it but not change its words"* | No — permissions are already in the render tree | Low |
| C4 | **Capability discovery** | *"You can tap that picture to give it a frame"* | No — a knowledge corpus lookup | Low |
| C5 | **Pointing** | Highlights an object or panel; changes nothing | No | Low |
| C6 | **Wayfinding** | *"The place to do that is over here"* → selects the object | No | Low — selection is trivially reversible |
| C7 | **Contextual encouragement** | Voice-specific, page-specific, world-specific praise | Optional | Medium — tone drift |
| C8 | **Free-form question answering** | *"How do I make the letters curvy?"* | Yes | Medium |
| C9 | **Creative suggestion** | *"What if the dragon had a friend?"* | Yes | High — authorship |
| C10 | **Performing an action** | Actually adds the page / moves the object | No, but **needs undo** | High |

**C1–C6 require no AI at all.** That is the direct answer to *"Do not assume
every interaction requires an LLM."* They are also the capabilities that most
change how the Companion *feels*, because they make it visibly aware of the
child's actual work.

C9 is flagged as the sharpest canon risk: a companion that suggests story
content is edging toward co-author. `docs/COMPANION_CANON.md` frames the
companion as a *friend*, not a collaborator. Recommendation: ship C9 last,
if at all, and only as a wondering ("I wonder who lives in that castle") —
never a proposal the child is expected to accept.

---

## 5. Knowledge map

Three tiers, three lifetimes, three owners. Keeping them separate is what
lets a Companion be swapped without touching the platform, and a platform
capability to change without re-authoring every companion.

### Tier 1 — Package knowledge (authored, per-companion, already exists)

`assets/<id>/personality.json`. Today only Lumo has one:

```json
{ "name":"Lumo", "role":"Guardian of Story Companions",
  "traits":["Kind","Curious","Playful","Encouraging","Gentle"],
  "neverSays":["Wrong","You can't","That's bad"],
  "greetings":["Let's imagine!","Ready to create?","I love new ideas!"] }
```

**Extend, don't replace.** Proposed additive optional fields:
`voice` (register/sentence-length hints), `topics` (what this companion
notices — a Quill might care about words, a Nimbus about colour), and
`lines` (a keyed map of pre-authored responses for known rule outcomes, so
common situations never need a model at all).

`neverSays` is already the policy hook. It becomes a hard filter applied to
*every* line, rule-generated or model-generated, in `js/companionBrain.js` —
never in the Engine, and never as a prompt instruction alone.

### Tier 2 — Platform knowledge (authored once, shared by all companions)

Proposed: `assets/companions/knowledge/*.json` — a static, versioned,
human-authored corpus describing **what Studio can do and how**. Not
generated, not scraped, not inferred from code at runtime.

Derived from sources that already exist:

| Corpus file | Derived from |
|---|---|
| `capabilities.json` | `docs/THEME_TO_CREATOR_MAP.md`, `js/contextPanel.js`'s Add Something items |
| `guardrails.json` | Creator Governing Rules #1–#5 (`CLAUDE.md`), `_renderWorldObjectDisclosure` copy |
| `vocabulary.json` | `js/objectStrip.js`'s `FRIENDLY_TYPE`, `js/creationFlow.js`'s `CREATION_TYPES` |
| `howto.json` | `STATE_GUIDANCE`'s What/Why/Do/Next shape (`worldBuilderApp.js:2719`) |

Each entry carries a stable `id`, kid-facing text, and a `surface` pointer
(which panel/control it refers to) so C5/C6 can point at something real.
**This corpus is the grounding set for any model call** (§8.3) — the model is
never asked to recall how Studio works.

### Tier 3 — Situation knowledge (runtime, ephemeral, never persisted)

Produced by `js/companionContext.js` on demand. Nothing new is stored; it is
a *projection* of existing state:

```js
{
  mode:'creator', companion:'nimbus',
  project:{ pageCount, hasTitle, hasCover, worldName, worldId },
  page:{ index, role, aspect, objectCount,
         objects:[{id,type,label,owner,editable,moveable,visible}],
         hasArtwork, hasNarration, voiceNoteCount },
  selection:{ id, type, owner, editable, moveable },
  nudges:[ ...PublishValidator.run(slides, project) ],
  session:{ idleMs, lastEvent, publishedThisSession }
}
```

Every field traces to an existing read: `PageRuntime.getActivePage()` /
`.getRenderedObjects()` / `.getSelection()`, `SlideRenderer.getPlacePermissions()`,
`PublishValidator.run()`, `ThemeRegistry.get()`, `AppState`.

**Privacy note:** this snapshot contains a child's actual creative content —
page text, object labels, the story title. §9.1 treats that as the single
most serious risk in the whole proposal.

---

## 6. Runtime model

### 6.1 Signal sources

| Signal | Source | Cost |
|---|---|---|
| Page changed / object added / selection changed | new observer on `PageRuntime.notify()` | free — one dispatch already fires |
| Named lifecycle moments | existing `CompanionDirector.notify(event)` | free |
| Idle | existing `IDLE_SLEEP_MS` timer in the Director | free |
| Typing | existing delegated capture-phase `input` listener with 4s cooldown | free |
| Story health | `PublishValidator.run()` — O(slides), no rendering | cheap, on demand |
| Cloud sync state | existing `CreatorProjectCache.onSyncStateChange` | free |

**No polling is introduced.** `PageRuntime.notify()` already fires on every
meaningful mutation; the Companion becomes one more subscriber alongside
CardDesigner, ContextPanel, ObjectStrip, TravellerSaveNotice, and
SelectionActionStrip (`js/pageRuntime.js:125-132`).

### 6.2 The tick

1. A signal arrives.
2. Director asks `CompanionContext.snapshot()` (cheap, synchronous, cached
   per notify-cycle).
3. Director asks `CompanionBrain.decide(snapshot, event)`.
4. Brain runs deterministic rules. Almost always returns `{}` or a pose-only
   intent.
5. Only if a rule explicitly marks the situation *escalatable*, and only if a
   gateway is configured, and only under the budget in §8.4, does it call the
   model — **asynchronously, never blocking the tick**.
6. Director applies the intent through the frozen Engine API.

### 6.3 Restraint is a first-class requirement

The most likely failure mode is not a wrong answer — it is a Companion that
won't stop talking. Proposed hard limits, enforced in the Brain:

- **Cooldown**: no speech within N seconds of the last (the Director already
  has this shape in `TYPING_COOLDOWN_MS`).
- **Novelty**: never repeat the same `source` id twice in a session.
- **Silence bias**: rules default to `{}`; a rule must *earn* speech.
- **Traveller silence is absolute**: `MODES.traveller.speaks:false` is canon
  (`docs/COMPANION_CANON.md` — the Story Egg never speaks). The Brain must
  short-circuit before any model call in traveller mode. Not a filter at the
  end — a gate at the top.

---

## 7. Action model

### 7.1 Three tiers

| Tier | Definition | Undo needed? | Example |
|---|---|---|---|
| **Point** | Changes nothing. Highlight, pose, speak. | No | *"That one's over there"* + a glow |
| **Offer** | Proposes; the child taps to accept. Nothing happens otherwise. | No | *"Want me to open the frame picker?"* |
| **Perform** | Mutates the project. | **Yes** | Adds a page, moves an object |

### 7.2 Point and Offer are safe today

Both are expressible with existing calls: `PageRuntime.selectSceneObject()`,
`PageRuntime.openPage()`, `ContextPanel.refresh()`, and the Engine's
`setState()`/`speak()`. A selection change is trivially reversible by the
child and violates nothing.

**Recommendation: ship Point and Offer. Do not ship Perform until §7.4 is
resolved.**

### 7.3 Every action passes three gates

Proposed `js/companionActions.js` contract — an action is only executable if:

1. **Whitelisted.** A named entry in a static registry mapping `actionId` →
   a specific `SceneEngine`/`PageOps`/`PageRuntime` call. The Brain can never
   name an arbitrary function; a model can never emit executable code. It
   emits an `actionId` string that either matches an entry or is discarded.
2. **Guardrail-legal.** Re-checked against the *live* render tree at
   execution time — `moveable`, `editable`, `visible`, `getPlacePermissions()`.
   This is Creator Governing Rule #2 and must be enforced at the broker, not
   trusted from the snapshot (which may be stale by a tick).
3. **Child-initiated.** Every Perform originates from a tap on an offer.

### 7.4 The undo problem, stated plainly

There is no global undo. A Companion that performs mutations without one is
asking a child to accept changes they cannot take back — which is a worse
product than a Companion that only points.

Two honest options:

- **(a) Build global undo first.** A command/inverse registry over
  `SceneEngine` + `PageOps`. Substantial, valuable independently of the
  Companion, and the clean answer.
- **(b) Restrict Perform to a hand-picked set with hand-written inverses**
  (`addSticker` ↔ `removeSticker`, `insertBlankPage` ↔ `deletePage`,
  `setPosition` ↔ previous value). Smaller, but every new action needs its
  inverse hand-authored and verified.

**Recommendation: (a), but not as a Companion prerequisite.** Treat global
undo as its own product item with its own value; let the Companion's Perform
tier land after it, whenever it lands.

---

## 8. AI strategy

### 8.1 Rules first, and mostly rules forever

Capabilities C1–C6 — the ones that most change how the Companion feels —
need no model. They are deterministic, testable, free, instant, offline, and
private. **The default answer to "should this be an LLM call?" is no.**

A model is warranted for exactly one thing today: **C8, answering an
unanticipated question in the companion's own voice.** Everything else is a
lookup or a rule.

### 8.2 Provider replaceability

The brief requires providers be swappable without affecting the platform.
Achieved by allowing exactly one place in the entire codebase to know a
provider's name: **the Edge Function.**

```
js/companionBrain.js
   └─▶ js/companionModel.js        // knows: a URL and a JSON contract
          └─▶ POST /functions/v1/companion-chat
                 └─▶ provider adapter   // knows: Anthropic / OpenAI / etc.
```

`js/companionModel.js` sends `{ persona, knowledge, situation, question }`
and receives `{ ok:true, say }` or `{ ok:false, error }` — following the
`family-album` convention exactly. It contains no provider name, no model
name, no API key. Swapping providers is an Edge Function redeploy with zero
client change and no `?v=` bump.

The client **never holds a key.** This is non-negotiable: the source is
public on GitHub.

### 8.3 Grounding, not recall

The model is never asked to remember how VihuStudio works. Every call
carries:

- the companion's `personality.json` (voice, traits, `neverSays`),
- the *relevant slice* of the Tier-2 knowledge corpus (§5),
- a minimal situation summary (§8.5),
- the child's question.

And is constrained to produce **one short line of speech** — never markup,
never an action, never a list. Actions come from `actionId` matching (§7.3),
not from generated code.

### 8.4 Cost and latency posture

- Escalation is opt-in per rule, not per event.
- Hard per-session call budget, enforced client-side in the Brain.
- Debounced; never on the render path; always async.
- On timeout or failure: fall back to the rule's own authored line, or say
  nothing. **A model failure must never surface as an error to a child.**

### 8.5 Data minimisation

Do not send the situation snapshot wholesale. Send derived facts:
`"page 3 of 5, has a picture, no words yet, one voice note"` — not the
child's story text, not their title, not their names, unless the question
itself is about that text.

---

## 9. Risks

### 9.1 Children's creative content leaving the device — **highest**

Any model call risks transmitting a child's story. Mitigations: §8.5
minimisation; escalation off by default; an explicit, parent-facing setting;
zero retention at the gateway; never send image bytes. **Recommendation: do
not ship any model escalation without an explicit product decision on this,
documented in `CLAUDE.md` under Locked Product Decisions.**

### 9.2 Canon drift — the Companion becomes an assistant

`docs/COMPANION_CANON.md:17` forbids it. The pressure will be gradual: one
helpful answer, then a tip, then a suggestion, then a to-do list. Mitigation:
the silence bias and cooldowns in §6.3 are architecture, not tuning; and C9
(creative suggestion) is deferred by default.

### 9.3 Guidance contradicting Guardrails

A model that says *"just drag it over there"* about a `moveable:false` object
teaches a child the app is broken. Mitigation: guardrail facts are injected
into grounding, and C3-class answers are rules-only, never escalated.

### 9.4 Two brains

If the Brain grows Studio knowledge that duplicates `PublishValidator` or
`STATE_GUIDANCE`, they will drift. Mitigation: the Brain *calls*
`PublishValidator`; it does not reimplement it. The knowledge corpus is
authored once and referenced, never inlined.

### 9.5 Traveller silence broken

A Traveller has no companion in the speaking sense. A misplaced escalation
would break the Story Egg's canon. Mitigation: the mode gate is at the top of
`decide()`, before any rule evaluation.

### 9.6 Performance

`getRenderedObjects()` is cheap but not free, and `notify()` fires often.
Mitigation: snapshot cached per notify-cycle; rules are O(objects); nothing
runs during a drag tick (the codebase already treats drag ticks as sacred —
`js/contextPanel.js`'s debounced `ObjectStrip.refresh()` exists for exactly
this reason).

### 9.7 Package/platform coupling

If platform knowledge leaks into `personality.json`, adding a companion stops
being zero-code. Mitigation: the Tier-1/Tier-2 split in §5 is the whole
defence, and should be stated as a rule.

### 9.8 The undo gap

Covered in §7.4. Restated here because it is the reason Perform is not in the
recommended near-term scope.

---

## 10. Recommended roadmap

Five phases. **Each is independently shippable and independently valuable.**
Phases 0–2 involve no AI, no backend, no new dependency, and no privacy
question at all.

### Phase 0 — Awareness (no AI, no backend)

`js/companionContext.js` only. Read-only snapshot, plus a `PageRuntime`
observer. The Companion begins reacting to *what is actually on the page* —
richness already proves the pattern (`currentRichness()`), this generalises
it. Nothing is said that isn't already said today.

*Ships:* C1. *Risk:* none. *Verifies:* snapshot correctness against a real
authored page.

### Phase 1 — Noticing (no AI, no backend)

`js/companionBrain.js` with deterministic rules only, consuming
`PublishValidator.run()` and the render tree. Speech comes from a new
authored `lines` map in `personality.json`. Cooldown/novelty/silence-bias
enforced from day one.

*Ships:* C2, C3, C7. *Risk:* low. **This is the phase that most changes how
the Companion feels, and it needs no AI whatsoever.**

### Phase 2 — Pointing & Offering

`js/companionActions.js` with the Point and Offer tiers only. Whitelist,
guardrail re-check, child-initiated. The knowledge corpus (§5 Tier 2) is
authored here.

*Ships:* C4, C5, C6. *Risk:* low.

### Phase 3 — The Gateway (first AI, opt-in, gated on §9.1)

`supabase/functions/companion-chat/` + `js/companionModel.js`. Rules-first
escalation only, grounded, budgeted, fail-silent. **Gated on an explicit
product decision about children's content leaving the device.**

*Ships:* C8. *Risk:* medium-high — privacy, cost, tone.

### Phase 4 — Performing (gated on global undo)

The Perform tier. **Explicitly gated on global undo existing**, whether via
§7.4(a) or (b).

*Ships:* C10. *Risk:* high.

### Explicitly out of scope for this roadmap

C9 (creative suggestion), any multi-turn chat UI, any persistent Companion
memory across sessions, voice input, and any capability that would make the
Companion the primary way to do something a panel already does.

---

## 11. Summary of recommendations

1. **Extend, don't parallel.** Four additive modules; the Engine stays frozen,
   the Director stays the one Studio-aware file.
2. **`PageRuntime` is the awareness seam.** It already owns the answers.
3. **`PublishValidator` is the model for the Brain** — pure rules, structured
   friendly output, never blocking. Call it; don't reimplement it.
4. **Most intelligence needs no AI.** C1–C6 are rules and lookups.
5. **Knowledge splits three ways** — package / platform / situation — and that
   split is what keeps adding a companion a zero-code act.
6. **One place knows the provider**: the Edge Function. The client never holds
   a key.
7. **Actions get three gates** — whitelist, live guardrail re-check,
   child-initiated.
8. **Perform waits for undo.** Point and Offer do not.
9. **Silence is the default.** Restraint is architecture, not tuning.
10. **Children's content leaving the device needs an explicit, recorded
    product decision** before Phase 3.

---

*No implementation has begun. This document is a proposal awaiting approval
under `CLAUDE.md`'s standing rule that architecture changes require explicit
sign-off.*
