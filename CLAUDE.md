# CLAUDE.md

Canonical project context for VihuStudio. Read this first before making any change.

## Product Vision

- Preserve what is real.
- Beautify originals rather than replacing them.
- VihuStudio is a non-destructive visual storytelling studio.

## Core Principles

- Visual controls for visual properties.
- Text controls for textual properties.
- Reusable components over one-off implementations.
- Editor UI should only contain controls that improve the active workflow.
- Metadata should not occupy permanent workspace.
- Architecture changes require explicit approval.
- Repository is the source of truth.

## Current Status

### Frozen (Version 1.0)

These subsystems are shipped and frozen. Do not redesign them without explicit approval — extend them instead.

**Studio (Creator)** — Workspace · Project Management · Persistence · Page Management · Page Runtime · Context Panel (Personalize ⇄ Refine) · Object Strip · Selection Action Strip · Card Designer · Page Designer · Sticker Studio · Image Studio · Publish Studio

**Theme system** — Theme Engine · Theme Registry · Theme Library · Artwork Themes · Dynamic Theme Workspace · Theme Language v2 · Theme Designer · the compiled `.vtheme` contract

**Rendering** — `renderer/slideRenderer.js` · Layer Engine · WYSIWYE parity · Place · Frame · Paper · Art Model V2

**World Builder v2** — Scenes · Places · Experiences · Collection · Frames · Layer Packs · Validation · Build · Publish / Promote / Export. (`tools/world-builder/` is legacy v1 — retained, not developed.)

**Engine V2** — Scene Model · Runtime · Validator · Builder

**Platform** — Theme Repository (Official + Personal) · Draft Asset Architecture · Cloud-Primary Project Storage

**Identity** — Magic Card · World Card Platform · Traveller Gateway

**Companion** — Companion Engine · Companion Canon V2 (Lumo the Guardian, Story Egg, bonded Story Companions)

**Audio** — Atmosphere Engine · Lumo Voice · per-page narration · voice notes

**Publish** — Story Book · Story Carousel · Story Reel · Magic Publish (M1–M9) · Magic Strip

**Tools** — Sheet Extractor · Audio Mixer · Platform Status

### Sprint history

The full sprint-by-sprint record of how each of these was built — every root cause, rejected alternative, disclosed limitation and verification pass — lives in `docs/SPRINT_HISTORY.md`.

**Grep it; do not read it whole.** It is ~2 MB, and reading it will exhaust the context window. Check it before redesigning anything, before re-investigating a bug, and before assuming a limitation is an oversight rather than a recorded decision.

New sprint entries append there, not here.

## Locked Product Decisions

### 1. Workspace Simplification

- Hide Project Title and Author from the editor.
- Preserve metadata in the project model.
- **Amended** (see the "Four Studio Bugs, Shipped Together" entry above): the Book Name is no longer hidden. The product owner asked directly to "allow creator to name their project," so `#bookTitle` — the same element this decision originally hid — now lives visibly in the header as the project's own name. It is deliberately ONE field, not a second one: it is what My Projects labels a card with, and it is also the book title a World may choose to show on the page. Project Title and Author remain hidden exactly as this decision set them.

### 2. Asset Pack System

- Decorations use installable packs.
- Local import first.
- Cloud repository later.
- Design for reusable pack architecture.

### 3. Card Designer

Reusable component supporting:

- Image scale
- Image position
- Fit modes
- Typography
- Card styling
- Theme defaults with per-card overrides

### 4. Audio Studio

- Per-card narration
- Record/import audio
- Audio linked to cards
- Foundation for narrated exports

### 5. Social-First Export

Priority:

1. Instagram Carousel
2. Instagram Reel

### 6. Creator Governing Rules

Five permanent rules for Creator, stated by the product owner and binding on every future Creator change. When something looks wrong in Creator, check it against these first — every real bug found and fixed since they were stated has mapped to a violation of one of them.

1. **Fidelity** — "When Scene shows up in Creator it is exactly as it was in Builder." Nothing about a Scene's geometry, layout, or content is silently discarded or substituted on the way into Creator.
2. **Guardrails** — "Every object on Scene honors the guardrails." Whatever the Theme Author marked moveable/editable/visible for an object is respected in Creator, with no exceptions.
3. **Refinement** — "Creator can further refine the objects through options available in the right panel." Whatever an object's guardrails do allow a Story Author to touch must have a real, reachable control in the Context Panel, not just a theoretical capability.
4. **Personalization** — "Creator provide options to personalize the scene." Beyond fixing what's broken, Creator's job is to give the Story Author genuine ways to make each Scene their own, within whatever room the guardrails leave.
5. **Publish Fidelity** — "Publish should honour the runtime view of center pane of Creator." Whatever the center pane (the live editing canvas) shows while a Story Author is working — every object, every edit, every guardrail-respecting placement — is exactly what Publish must produce. Publish is never allowed to reconstruct, reinterpret, or fall back to a different rendering path than the one the center pane already proved correct.

### 7. Publishing & Companion Roadmap

Locked by the product owner in the Companion v1 Foundation brief.

- **Publish** remains the creator's publishing destination, eventually containing Reading · Social · **Motion Publishing**. Reading and Social largely exist.
- **Motion Publishing** is the motion generation capability within Publish, eventually containing **Magic Publish** and **Story Journey**. Magic Publish remains the current implementation — do not redesign it.
- **Story Journey is intentionally postponed.** It is scoped conceptually only. Do not implement it: no recording systems, no timeline infrastructure, no replay engines, no storage models, no event models. It will later get its own `STORY_JOURNEY_CANON.md`.
- **Companion v1 (Guide) is the next major capability**, and proceeds independently of Motion Publishing — neither blocks the other. Its product decision is `docs/COMPANION_CANON.md` → Canon 5; its implementation proposal is `docs/COMPANION_V1_PROPOSAL.md`.

### 8. Studio Rite

Locked by the product owner in the Studio Rite Vision Update, after user testing found children's first question was *"Who is a Traveller?"* rather than any usability question.

- A mandatory **Studio Rite** precedes Studio Home. Every user completes it exactly once; the Studio stays locked until they do. Permanent.
- It is **not** a tutorial or walkthrough — it is the creator's first chapter, and it **teaches through creation, not explanation.**
- **It may show where a control is; it may never explain what it does.** Lumo never names a control — the interface lights the real one. A nudge must bring its target into view first, or not point at all.
- It answers four questions before the Studio unlocks: *Where am I? · Who am I? · What do I do here? · Why do stories matter?*
- The vocabulary it establishes is **Traveller · Creator · Story · Companion**, introduced by being used, never defined. The canonical term is **Traveller**, not Visitor.
- Companion v1 assumes the Rite is complete, which narrows its scope but does not change its architecture.
- **Lumo guides the Rite.** The Story Egg is unchanged — it never speaks, teaches or guides, and accompanies through animation only. Lumo now appears at *two* thresholds: the Rite and the Creator Ceremony.
- **The Rite ends by sharing the first story with VihuPlanet** (Decision 7, rewritten). The child's own choice to let their story become part of VihuPlanet is what opens the Creator Ceremony — the Ceremony is the consequence of sharing a story, never a reward for finishing onboarding. Declining is allowed: the story stays theirs, the Studio still unlocks, and the Ceremony waits for whichever story they do share.
- **Child-facing language never says "Publish" inside the Rite** (`docs/COMPANION_CANON.md` → Canon 7). Internally the existing Publish capability is used unchanged — no service, module or API is renamed.
- **The Rite extends the Traveller Gateway** as one continuous journey; the Gateway is not redesigned or modified.
- **Existing Creators are grandfathered** by their claimed Magic Card — no migration system.
- The platform says **Traveller**, not Visitor. `COMPANION_CANON.md` and `KID_JOURNEY.md` were corrected to match the product, Gateway, registry and code.
- **Scope is closed** (Decision 10): introduce the world, teach creation through experience, unlock the Studio. Adding anything to the Rite is a canon change, not a feature.
- Product decision: `docs/COMPANION_CANON.md` → Canon 6. Architecture and phase plan: `docs/STUDIO_RITE_PROPOSAL.md`. Screenplay: `docs/STUDIO_RITE_SCRIPT.md`.

### 9. The Ether, and the VihuPlanet Runtime

Locked by the product owner in the VihuPlanet Ether Runtime brief.

- **Published stories belong to the Ether, not to a Story World.**
  Until VihuPlanet has enough Story Worlds and Storytellers, a
  published story becomes part of the Ether — the living space of
  VihuPlanet — where it drifts, waiting to be discovered.
- **There is no "Create Story World" feature, and there will not be
  one.** Story Worlds are an emergent property of a universe that
  already has stories in it. Adding a way to make one is a canon
  change, not a feature.
- **The runtime is the foundation of VihuPlanet, not a screen.** It
  lives under a top-level `VihuPlanet` namespace (`vihuplanet/runtime/`
  — Core · Universe · Ether · Stories · Physics · Ambient · Focus ·
  Birth · Worlds), so the Ether is its first tenant rather than a
  special case. Story Worlds, the Dreaming Realm, the Telescope and
  the Companion arrive as siblings.
- **Future systems plug into the runtime rather than modify it.** The
  Story Entity contract is the seam: physics moves entities and knows
  nothing else about them, renderers draw them and know nothing else
  about them, the Story Manager owns them and knows nothing about
  rendering. If a future phase has to edit `physics.js`,
  `storyManager.js` or `etherRenderer.js` to add Story Worlds, the
  architecture failed — those files do not need editing.
- **The universe must feel alive through behaviour, not illustration.**
  Procedural gradients, particles and lightweight assets only; no large
  background images, no heavy animation libraries, no hundreds of DOM
  nodes.
- **The Universe must be alive before the first story arrives**
  (Sprint U1). The test any change to it is held to: *if there were
  zero stories here, would this still feel like a magical living
  universe?* Three systems answer that and none of them needs a story:
  the **Ether Currents** (the Ether moves and carries what floats in
  it — stories never drift randomly), the **Universe Camera** (the
  viewpoint drifts imperceptibly, and is what makes the depth layers
  real), and the **story light field** (the space answers every story,
  so one is never alone). Calm before spectacle: no flashing, no
  fireworks, no game effects. The emotional goal is *"I want to stay
  here"*, not *"wow"*.
- **Development instrumentation is not part of the experience.** Any
  runtime panel or counter stays closed by default and out of the
  universe's way.
- Phase 1 is complete and explicitly excludes Story Worlds, clustering,
  world emergence, Telescope integration, Companion integration, the
  reading experience, reactions, search, filters and ranking. Those
  belong to later phases.
- **A Story is in the Ether when its own record carries
  `publishedAt`**, stamped by Publish Studio on completion.
  `MagicCard.hasEverPublished` records *that* a child has published and
  can never say *which* Story — it is not a substitute. Stories
  published before this existed have no arrival date and correctly do
  not appear: inventing one would put Stories in VihuPlanet that a
  child never chose to share.
- **Every published Story has a deep link** —
  `vihuplanet/ether/?story=<projectId>`. The project id, not any
  runtime-internal id, so a shared link survives anything the runtime
  renames. It resolves for anyone whose Ether contains that Story;
  today that is the creator across their own devices, since there is no
  public cross-creator feed yet. When one exists it becomes another
  source inside `EtherFeed.load()` and nothing downstream changes.
- **A published Story is a Story Spirit, never a card** (Sprint U2). A
  soul (light) first, an identity (its cover) only once approached, its
  own glow, and movement it does not choose — the currents carry it.
  Nearness is distance from the centre of the screen, and the cover, the
  name and the maker each arrive later than the last. *If it feels like
  a gallery of floating cards, it is wrong.*
- **The Traveller is the centre and never moves.** The universe rotates
  around them — looking around a night sky, not moving through a map.
  Mouse to the edges, arrow keys, or drag. A full turn is exactly one
  field width, so the universe closes on itself.
- **Meeting and reading never leave VihuPlanet.** The portal is an
  overlay; the universe is never torn down, reset or reloaded, so
  returning is exact because nothing was lost rather than because
  something was restored.
- Architecture and rationale: `vihuplanet/runtime/README.md`.
  Integration: `js/etherFeed.js` and `vihuplanet/ether/`.

### 10. VihuPlanet is the Universal Home

Locked by the product owner in the Sprint VP1 brief. This is an entry
*architecture* decision, not UI polish.

- **There is exactly one entrance, and everyone uses it.**
  `Tap to Begin → VihuPlanet`. A first-time Traveller, a Returning
  Traveller, a first-time Creator and a Returning Creator all land on
  the same screen. Nobody bypasses it and nobody gets a different one.
- **VihuPlanet is Home. VihuStudio is the Hall of Creation.** Children
  visit the Studio; they live in VihuPlanet. The Studio is no longer
  the application home — it moved from `index.html` to `studio.html`
  so the root could become VihuPlanet.
- **The home screen has exactly two permanent actions, forever:**
  📚 My Stories · ✨ Create Story. They never change — not per user
  type, not as a child grows. Do **not** add "Continue Story",
  "Resume", "Create New Story", "Traveller Mode" or "Creator Mode".
  No new button may appear as a child progresses. The behaviour behind
  the two evolves; the interface does not.
- **Studio is never opened directly** — only through intent, and intent
  is one of exactly two things: *I want to see my stories* or *I want
  to create a story*.
- **There is exactly ONE "Tap to Begin", and it is VihuPlanet's.** The
  Traveller Gateway's own `✨ Tap to Begin ✨` screen was removed: one
  journey, one threshold. That gate existed to satisfy the browser's
  autoplay policy (a real gesture in the Studio's own document, which a
  tap on VihuPlanet cannot provide), so removing it carries a disclosed
  cost — sound now starts immediately where the browser allows it, and
  otherwise joins at the child's first touch in the Studio. A child who
  watches the whole cinematic without touching anything sees it
  silently. The product owner chose one threshold over guaranteed audio
  on that path.
- **My Stories** verifies Creator first. A Creator gets Studio Home —
  never the last story reopened, because Studio Home already owns story
  management. A non-Creator gets a warm invitation, never an empty
  state, never a dead end, never software language.
- **Create Story** also verifies. A non-Creator goes to the Studio and
  the Starter Story Rite runs on the way in — the Rite is the path to
  becoming a Creator, not a Studio tutorial. A Creator gets Studio
  Home and uses the existing creation workflow; there is no separate
  "create new story" flow.
- **A Creator is someone holding a claimed Magic Card.** One
  definition, already used by `js/studioRite.js` and already the basis
  for grandfathering in Decision 8.
- **`JourneyResolver` is the only thing that decides what a tap
  means** (`js/journeyResolver.js` → Traveller · Explorer · Creator).
  No `isCreator` check belongs at a call site. Future milestones
  (Companion, Story Worlds, the Telescope) teach the resolver — they
  never add a button to the home screen.

## Roadmap

1. Theme Designer Polish
2. Card Designer
3. Story Designer
4. Cover Designer
5. CTA Designer
6. Audio Studio
7. Asset Pack System
8. Export Studio
9. VihuPipe

## Development Rules

- Keep prompts minimal.
- Never refactor architecture without approval.
- Prefer extending reusable components.
- Preserve backward compatibility.
- Keep commits focused and atomic.
- Update CLAUDE.md whenever a major architectural or product decision is approved.
- After every push to the working branch, also push to `main` (`git push origin <branch>:main`) — standing instruction from the product owner ("push to main always"), so main always tracks the latest verified ship.
- Append new sprint entries to `docs/SPRINT_HISTORY.md`, not to this file. Keep them short — roughly a paragraph — with the detail in the relevant `docs/*.md`.
