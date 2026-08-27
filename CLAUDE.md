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
- **The complete system is online.** We are not building an offline
  product. Stated by the product owner. Nothing needs to be designed
  around a first launch with no network, and any argument of the form
  "this would hard-fail offline" is no longer a reason to choose one
  design over another. Graceful degradation when the network drops
  mid-session is still ordinary good behaviour; designing *for* offline
  is not a goal.

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

**Publish** — Story Book · Story Carousel · Story Reel · Magic Publish (M1–M9). (The **Magic Strip** was withdrawn by the product owner and is no longer offered or built. `js/magicStrip.js` stays loaded: Magic Creation reads its brand line and font stack.)

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
- **The Rite ends by sharing the first story with VihuPlanet** (Decision 7, rewritten), and declining is allowed: the story stays theirs and the Studio still unlocks.
- **AMENDED — becoming a Creator is FINISHING the first story, not sharing it.** Decided by the product owner after asking why sharing had become the mandate. The Ceremony used to be "the consequence of sharing a story, never a reward for finishing onboarding", which reads well until you notice that a Magic Card is not a badge: it is identity, and identity is the only thing that makes a child's work survive — an unclaimed Traveller's projects are wiped on the next genuinely new session, and a card is what backs them up and recognises them on another device (Decision 19). The single thing protecting a child's work was gated behind a **public act**, and it fell hardest on the shy child. The Ceremony now fires when Rite I completes; **sharing keeps everything else** — it is still the only thing that puts a story in the Ether, still what stamps `publishedAt`, still what plays the Story Birth. At most once ever, so a child who does share on the rite's last beat has their Ceremony there and meets nothing extra afterwards.
- **Rite complete MEANS Creator — not "completed just now".** The offer is made on any Studio entry where the rite is complete and no card exists, so it is a property of the state rather than of an event. Offering only at the moment of completion would have left every child who finished the Rite before this rule permanently without one, which is the exact population the change protects. Nothing is backfilled and no migration exists.
- **Nobody is left without a way to a card.** `_finishAwakening()` marks the ceremony offered whatever the outcome — Claimed, Maybe Later or Just Exploring — and the header badge is hidden while no card is active, so a child who said *Maybe Later* had no badge, no second offer and no route at all. The Traveller notice is now that route: it opens the Ceremony directly, deliberately bypassing `shouldOfferAwakening()`, because that guard exists to stop the product **asking** twice and this is the child asking. Its copy changed with it — *"Your stories live only on this computer for now"* and **✨ Make My Magic Card** — because it used to say Finish Story, which grants this child nothing.
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
  `Tap to Explore → VihuPlanet`. A first-time Traveller, a Returning
  Traveller, a first-time Creator and a Returning Creator all land on
  the same screen. Nobody bypasses it and nobody gets a different one.
- **VihuPlanet is Home. VihuStudio is the Hall of Creation.** Children
  visit the Studio; they live in VihuPlanet. The Studio is no longer
  the application home — it moved from `index.html` to `studio.html`
  so the root could become VihuPlanet.
- **The home screen has exactly two permanent actions, forever:**
  ⭐ Show Me Your Stars · ✨ Create Story. They never change — not per
  user type, not as a child grows. Do **not** add "Continue Story",
  "Resume", "Create New Story", "Traveller Mode" or "Creator Mode".
  No new button may appear as a child progresses. The behaviour behind
  the two evolves; the interface does not.
  (Amended by Decision 11. The first action was 📚 My Stories when
  this decision was written; the pair is otherwise unchanged.)
- **Studio is never opened directly** — only through intent, and intent
  is one of exactly two things: *I want to see my stories* or *I want
  to create a story*.
- **There is exactly ONE threshold, and it is VihuPlanet's.** The
  button reads **Tap to Explore** — renamed from "Tap to Begin" because
  beginning is what a form asks you to do and exploring is what this
  place is for. Crossing it is answered by the universe rather than by
  a transition: a starlight crosses the Ether, and the Ether **turns
  once** — between a fifth and a third of a full revolution, which
  camera.js defines as that fraction of one field width. Every depth
  layer moves at its own rate (measured: far stars 57px, mist 95,
  currents 145, stories 315, near dust 353), and that parallax is what
  makes it read as the whole universe turning rather than an animation
  played over a still picture. A first attempt at a twentieth of a turn
  moved the stories 75px and read as nothing at all.
  **The turn is different on every arrival** — a little further, the
  other way round, a touch more lift — because a fixed one is a title
  sequence played AT a child, and watching it twice would say so. What
  is held steady is the PACE, not the distance, so a longer turn takes
  proportionally longer instead of moving faster and every arrival is
  equally unhurried (4.2–6.5 seconds). It uses `Math.random`, not the
  runtime's seeded Rng: the seeded generator exists so every viewer
  sees the SAME Ether, and one visitor's own arrival has no business
  being shared or reproducible. That turn is the teaching — nothing
  on the screen says the universe can be looked around, so the first
  thing it does is the exact thing they can do to it. Both use seams the runtime
  already exposes (`ambient.shootNow()`, `camera.look()`), so no file
  under `vihuplanet/runtime/` changed, which is Decision 9's own test.
  Suppressed under `prefers-reduced-motion`.
- **And if nobody answers, the universe glances.** A Traveller who has
  not turned it after about eleven seconds sees it lean a little one
  way and come back — the movement a person makes when something
  catches their eye, which is the one gesture that means *look over
  there* without saying it. Wordless on purpose: there is not one
  instruction anywhere in VihuPlanet, this would be the first, and it
  would have to be read. Three rules keep it an invitation rather than
  a nag — it waits, so a child already exploring is never interrupted;
  it **stops forever** the moment they turn the universe themselves,
  because the question has been answered; and it gives up after three.
  Built on `traveller.stillSeconds()`, which already existed and means
  exactly this. Also suppressed under `prefers-reduced-motion`.
  The Traveller Gateway's own `✨ Tap to Begin ✨` screen was removed: one
  journey, one threshold. That gate existed to satisfy the browser's
  autoplay policy (a real gesture in the Studio's own document, which a
  tap on VihuPlanet cannot provide), so removing it carries a disclosed
  cost — sound now starts immediately where the browser allows it, and
  otherwise joins at the child's first touch in the Studio. A child who
  watches the whole cinematic without touching anything sees it
  silently. The product owner chose one threshold over guaranteed audio
  on that path.
- ~~**My Stories** verifies Creator first.~~ **Superseded by
  Decision 11.** This action is now ⭐ Show Me Your Stars and it
  verifies nothing before opening — it asks for the child's
  constellation first, of everybody. A recognised Creator still gets
  Studio Home, never the last story reopened, for the reason this
  clause originally gave: Studio Home already owns story management.
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

### 11. The Magic Card is the Creator's Identity

Locked by the product owner in the Sprint VP1.5 brief. It amends
Decision 10's first action and promotes the Magic Card's role; it
changes nothing about the Magic Card itself.

- **VihuPlanet recognises its Creators. It does not authenticate
  users.** There are no accounts, no logins, no passwords, no email
  verification, no parent verification and no Creator dashboards. Do
  not add any of them.
- **The first permanent action is ⭐ Show Me Your Stars.** Pressing it
  opens the Magic Card constellation screen **immediately** — no Lumo
  dialogue, no Creator check, no account screen, no login screen.
- **One flow serves all three arrivals.** A first-time Traveller, a
  Returning Creator on the same device and a Returning Creator on a
  brand-new device all get the same screen and the same gesture. That
  is deliberate: a Creator on a new device is indistinguishable from a
  Traveller by anything the browser can see, so the only honest thing
  to ask is the one thing that *can* tell them apart, and to ask it of
  everyone the same way.
- **The screen is *Mark Your Stars* — "Draw the constellation from
  your Magic Card" — with exactly two buttons: `Continue` and `I Don't
  Have One Yet`. Nothing more.** After several unrecognised attempts
  those two are *replaced* by `Try Again` and `Create Story`; the
  screen changes what it offers, it never grows a third button.
- ~~**Recognition is instant and silent.** No confirmation screen, no
  success dialog — VihuStudio Home simply opens.~~ **Amended by
  Decision 18** for the camera only: the drawing board still opens the
  Studio instantly, because the child drew the sky and pressed Continue
  themselves. A camera claims to know somebody without being asked, so
  that path now shows them the sky it recognised for ten seconds first.
- **The Studio's own gate can now hand recognition back** (build 0638).
  Reported by the product owner: pressing ✨ Create Story from the Ether
  with a card already on the device lands on the Gateway's sky challenge,
  and that grid can only offer the skies it finds on THIS device — so a
  Creator arriving on a machine that has never met them has literally
  nothing to tap, and three wrong tries later they are a Traveller by
  default. It now offers **⭐ Show me your stars**, and **the camera
  opens in place** — stated by the product owner after seeing the first
  version hand off to VihuPlanet instead. No policy lives in that
  screen: what a sky means is still `CreatorRecognition`'s and what a
  card looks like is still `MagicCardVision`'s, so it is a camera, a
  countdown and three lines of copy over both, and recognition still
  changes in one place.
  **`← Back` on that screen now leaves for the Ether**, and the small
  "Not able to show your stars right now?" screen it used to open is
  retired — its Try Again was a slower way to do nothing (a wrong tap
  already retries in place) and its Continue as a Traveller moved onto
  the challenge itself, one tap instead of two.
- **Recognition happens ONCE per arrival.** The Traveller Gateway's
  Scene 3 asked a Returning Creator to find their sky again on the way
  into the Studio, which was right while the Studio was the front door
  and is a second proof of the same identity now that it is not. A
  one-shot note written at VihuPlanet and consumed on arrival tells
  Scene 3 it already has its answer. The Gateway is **not** redesigned
  — it takes the same branch a successful signature always took. A
  Creator who opens the Studio directly, with no recognition before
  it, still gets Scene 3 exactly as before.
- **The language never blames.** Never "incorrect", "invalid", "wrong
  password" or "authentication failed". A Creator's stars are never
  wrong; they are only, sometimes, unrecognised.
- **"I Don't Have One Yet" launches the existing Starter Story Rite**,
  with no further questions, no registration and no profile creation.
  It is the same door ✨ Create Story opens.
- **The Magic Card is now the permanent identity of every Creator
  inside VihuPlanet**, not only a recovery mechanism. The Magic Card
  itself is unchanged and is not redesigned — only its role in the
  product architecture.
- Recognition looks on the device first and the platform second
  (`js/creatorRecognition.js`), so a returning Creator is recognised
  with the network off. A constellation is matched as a **set**, not a
  sequence — the same canonicalisation the platform already does
  server-side — because it is a shape in the sky, not an order of
  taps.
- Out of scope and not implemented: accounts, login, passwords, email
  or parent verification, Creator dashboards, story-retrieval redesign
  and story-sharing redesign.

### 12. Finishing a Story and Sharing a Story are Separate Acts

Locked by the product owner in the Sprint VP2 brief. It changes the
end of the story lifecycle; it changes nothing about the artifact
pipeline.

- **Every child can always finish their story, and always receives
  every artifact.** Finishing cannot fail and cannot be judged. There
  is no readiness check, no validation and no nudge list on the way to
  it — `PublishValidator` still exists and is still exported, but the
  finish path no longer shows a child what is wrong with their story
  before letting them have it.
- **"Publish" is gone from child-facing language. The control is
  Finish Story.** A child is finishing their story, not publishing
  software. Internally nothing is renamed — no service, module, API or
  storage key — exactly as Decision 8 already required for the Rite.
- **Finishing ends in a celebration with exactly two equal choices:**
  📦 Take My Story · 🌌 Share with VihuPlanet. Neither is mandatory and
  neither is styled as the primary one; the moment one takes the gold
  the other becomes the thing you skip.
- **Sharing is a ceremony, not a dialog** (`js/shareCeremony.js`).
  Lumo welcomes the story, asks whether it is ready — one question at a
  time, never a checklist, never a score, never a percentage — and the
  child chooses. The four questions are: does it have a name; does it
  feel finished; would another Traveller understand it; would you be
  happy if another Traveller discovered it.
- **Lumo mentors the story and never judges the Creator.** Never "this
  story isn't good enough", "you failed" or "you cannot publish". "Not
  yet" is a real answer with the same weight as its neighbour, and it
  returns the child to their story with every artifact they already
  have.
- **The only blocking validation allowed is technical** — an empty
  story, zero pages, a corrupted story. Those are implementation
  facts and are worded as such, never as creative judgement.
- **`publishedAt` is stamped by the ceremony and nowhere else.** It is
  the Ether's definition of membership (Decision 9), so stamping it on
  finishing put every finished story in front of other Travellers
  without anybody choosing to. `MagicCard.hasEverPublished`, the
  Companion's `published` event and the **Creator Ceremony** moved with
  it — Canon 6 is explicit that the Ceremony is the consequence of
  sharing a story, never a reward for finishing one.
- **A completed share plays the existing Story Birth sequence.** The
  Studio hands over with `index.html?born=<projectId>`; VihuPlanet
  holds that Story out of the opening seed and lets the runtime bring
  it in, so the child watches it arrive rather than finding it already
  there. The Spirit is not auto-opened — Story Birth already aims it
  into view, and a preview panel over the universe at that moment
  would turn a story joining a place into a dialog about a file.
- **A share made during the Studio Rite does not leave the Studio.**
  The Rite's last beat waits on exactly that moment and still has a
  closing chapter to play and a Studio to unlock. The share completes
  in every other way.
- Out of scope and not implemented: AI story scoring, story ratings,
  moderation, community voting, Story World assignment, popularity
  systems, likes and quality metrics.

### 13. Publishing Targets, and the Canon Repository

Locked by the product owner in the Sprint VP3 brief, including its own
architectural recommendation: **think in publishing targets, not
modes.**

- **There is ONE editor, ONE story format and ONE authoring
  experience.** The VihuPlanet team makes official stories in exactly
  the editor children use, with the same controls. The only thing that
  ever differs is where the finished story goes. Do not add a
  "Creator Mode" and an "Author Mode" threaded through the editor —
  that is two products sharing a codebase, and the sprint rejected it
  by name.
- **`js/publishTarget.js` is the seam, and only the last screen asks
  it.** Nothing in the editor knows a target exists. If a future change
  has to touch the editor to add a third target, the seam is in the
  wrong place.
- **Two kinds of story, and they are different things.** A **Creator
  Story** is made by a child, owned by that child, carries their name,
  and joins the Ether because they chose to share it. A **Canon
  Story** is made by the team, is part of the product, is owned by
  nobody, and ships with the application.
- **Story Origin.** Every story record carries `origin: "creator"` or
  `origin: "canon"`. Creator stories keep `creatorId` / `creatorName`;
  Canon Stories have neither and there is nowhere to put one.
- **Canon Stories are never attributed.** Never "Created by
  VihuPlanet", never "by Admin", never by the person who authored
  them. In the Ether they appear, drift, can be discovered and can be
  read exactly like any other Spirit — they simply belong to the
  universe. A child never learns the distinction exists.
- **The runtime cannot tell them apart, by construction.** `origin`
  lives on the entity's `source`, which physics, the renderer and the
  story layer never read. There is no difference for them to act on.
- **The Canon Repository is a folder in the repository** —
  `vihuplanet/canon/`, a manifest plus one file per story — because
  "shipped with the application" is what canon means. It is not put in
  `creator_projects`: that is a private, card-gated backup of a
  *child's* work, and putting product content there would make canon
  somebody's possession. Publishing to canon produces the file; the
  team commits it. That gives canon the properties product content
  should have — reviewed in a pull request, versioned in git,
  identical for every child.
- **The repository ships empty.** Adding the first Canon Story is a
  content decision, and it is two steps: commit the story file, add
  its id to `canon.json`.
- **The author flow is Create → Review → Freeze → Publish to Canon.**
  Freezing is what makes a story canon: it ships identically to every
  child, so publishing it is the act of declaring it final. There is
  no draft state in the repository.
- **Canon has no Magic Card, no Story Readiness ceremony, no creator
  attribution and no Story Birth.** All four exist to serve a child
  giving something away, and none of them applies to a product asset.
- **Author Mode is a development configuration, not a role.**
  `studio.html?author=on`, remembered per browser, stripped from the
  address bar the moment it is read. Explicitly out of scope and not
  implemented: role management UI, user administration, permission
  editors, team collaboration, version history, approval workflows and
  multi-author editing.
- Architecture and how to add a story: `vihuplanet/canon/README.md`.

### 14. Sky Protection

Locked by the product owner in the Sprint VP4 brief. It adds a recovery
mechanism; it changes nothing about the Magic Card or the magical
experience.

- **Children recognise themselves through their Magic Card. Parents
  protect the Magic Card.** The parent email is **not** the child's
  account: nothing signs in with it, it is never an identity, never a
  password and never a profile. It is the safe place the card is kept.
- **The Magic Card remains the primary identity inside VihuPlanet.**
  Decision 11 is unchanged.
- **It is asked for at exactly one moment: before a story joins
  VihuPlanet.** Making a story needs no email. Finishing one needs no
  email. Every artifact — book, PDF, Magic Creation, images — is
  produced and handed over with nothing asked, because none of them
  can be lost by losing a card. A story in the Ether is reachable
  through the Magic Card and nothing else, which is why that is the
  honest moment.
- **Protect Your Sky · 🌟 Keep My Sky Safe · Skip For Now.** The
  child's words are about their sky; posting a Magic Card to a grown-up
  is how VihuPlanet does it.
- **Skipping never blocks anything.** It shows one gentle line — "Your
  Magic Card is the only way VihuPlanet can recognise your sky" — once,
  and never becomes a nag.
- **An address already on file is never asked for again.** The card is
  resent silently and the child is told, with no interaction required.
- **One address may protect several children.** Siblings on one
  parent's email is the normal case; every message names its Creator
  and a recovery email lists each sky separately.
- **Recovery is `I Don't Have My Magic Card`** on the Mark Your Stars
  screen. If this device remembers a grown-up, the card is resent and
  the child is told to ask them — no typing. If it remembers nothing (a
  new device) the child can give the grown-up's address, and the only
  thing that happens is an email to it. Nothing is ever revealed to the
  browser, so controlling the inbox is the whole of the check — which
  is exactly right for something that is not an account, and is why the
  answer is identical whether or not that address protects anything.
- **No support request and no manual recovery**, because there is no
  account to recover.
- **The email is sent by `supabase/functions/sky-protection`**, and
  `parent_email` is a plain column on `magic_card_identities`. An
  unconfigured or unreachable deployment is a handled state everywhere:
  the child still shares their story, and VihuPlanet never claims a sky
  is safe when it is not.
- **A first share happens before a Magic Card exists** (Canon 6 puts
  the Creator Ceremony after sharing). The address is remembered and
  the card is posted the moment there is one; the wording for that case
  says so rather than pretending it has already gone.
- **The family photo album is asked for in THAT letter, and in no other.**
  Decided by the product owner (*"add it in first email"*). A grown-up is
  reachable at exactly one moment — when the Magic Card arrives — so the
  album ask rides along with it rather than becoming a second,
  unsolicited message. This matters beyond convenience: the parent email
  is STORAGE, not a channel, and the moment a second kind of message is
  sent to it, it becomes a mailing list and everything that follows
  (frequency, unsubscribe, what else we might send) starts existing.
  One letter keeps that line uncrossed.
  **It is still not an account.** Family Photos already needs no login —
  a parent shares a public Google Photos link and VihuStudio remembers
  the link, never the photos. What the letter adds is a way to hand that
  link over without being sat at the child's laptop.
  **The obstacle was measured, and it was real:** `family_albums` is
  keyed on `owner_id = auth.uid()` — the child's browser SESSION, not
  their Magic Card. A parent following a link on their own phone is a
  different session, so a row they insert would be owned by them and
  invisible to the child forever. SELECT already widens for a recall
  grant; INSERT does not, and should not. Proved rather than reasoned
  about: the suite runs the real `family_albums_insert` policy against a
  real PostgreSQL and watches a parent's own session be refused.
- **The child's `owner_id` IS resolvable at send time, and the join
  holds.** `magic_card_identities` carries its own `owner_id`, stamped
  from `session.user.id` when the card was claimed
  (`js/magicCard.js` → `_pushIdentitySnapshot`) — literally the same
  `auth.uid()` value `family_albums.owner_id` holds for that child. So
  the letter's sender, which already has the identity in hand, can name
  the child's album list exactly. This is **not** the mistake recorded
  above `has_magic_recall_grant`: that join failed because it was
  written inline in a POLICY and died under the recaller's own RLS.
  This one runs inside SECURITY DEFINER — the fix that comment
  prescribes — and resolves the owner LIVE at attach time rather than
  copying it, so there is one source of truth and nothing to drift.
- **The link is REUSABLE and never expires**, which corrects this
  decision's own earlier note that it would be one-shot. A parent adds
  the holiday album in March and the school-play album in June, and the
  second one must not need a second email — that is the very line the
  clause above draws. An expiry is the right instinct for a credential
  and this is not one: it appends a URL to one album list, reveals
  nothing, and grants nothing else. What an expiry would reliably
  achieve is a link that dies precisely when a parent finally gets round
  to it. **A ceiling replaces it** — two dozen albums through one link,
  then nothing — so a link that escaped runs out rather than running
  forever, and everything it could do is removable from the Studio.
- **One link per child, stable across letters.** The `protect` letter
  and a later `recover` letter carry the SAME link, so a filed letter
  or a bookmark keeps working and nobody has to work out which of two is
  current. Minted server-side (`family_album_link_mint`, `invite_create`'s
  rule that a client never chooses a token) and reachable only by the
  letter's sender: a browser cannot mint a link for a card it names, or
  it could attach albums to a stranger's child.
- **The link names an album list. It is never an identity.** It carries
  no name, no constellation, no card and no session; `family_album_attach`
  answers only whether it worked, so a refusal names no child either.
  Nobody can list links or turn one back into a child — RLS on, no
  policies at all, everything through two SECURITY DEFINER functions,
  the `story_cheers` discipline.
- **The same album twice is a success, not a duplicate.** A parent who
  presses twice, or pastes the same album next month having forgotten,
  is told the photos are there — which is true — and no second row is
  made and nothing is spent against the ceiling.
- **The page is one field and one button**, `family-photos.html`,
  `noindex`. **The two facts sit ABOVE the field**, not in small print
  underneath: nothing is uploaded (VihuPlanet keeps the link, the photos
  stay in the parent's own Google account), and a shared album is shared
  BY LINK — anyone holding that link can see those photos. Both are in
  the letter's plain text as much as its HTML, because the plain part is
  not a fallback, it is the message.
- **The allow-list is enforced where a page cannot be bypassed.** The
  same two hosts `js/familyAlbum.js` and the `family-album` function
  already use, checked again inside `family_album_attach`, so
  `family_albums` can never come to hold a URL pointing anywhere else.
  A look-alike host hidden behind userinfo
  (`https://photos.app.goo.gl@somewhere.else/x`) resolves the way a
  browser resolves it and is refused.
- **A deployment without the migration still posts the card.** The mint
  fails, the token is empty, and the letter goes out as the letter it
  has always been — no passage, no broken link, nothing claimed. Losing
  skies is the one thing this feature exists to prevent, and an album
  offer must never cost one.
- **`listAlbums()` now lets the policy define the set.** The letter
  writes against the identity's own `owner_id` — the device that
  CLAIMED the card — so on that device nothing changes at all. On a
  second device the client used to filter to `auth.uid()` and throw away
  the widening `family_albums_select` already grants for a proven
  recall, hiding an album the policy was willing to hand over. An
  explicit owner is still honoured exactly as before.
- Out of scope and not implemented: parent accounts, email/password
  login, OTP verification, family dashboards, child management, cloud
  profile management and Creator accounts.
- `supabase/migrations_family_album_link.sql` · `family-photos.html` ·
  `tools/family-photos-test/run-family-photos-tests.js`.

### 15. The Ether is a Shared Space

Locked by the product owner: *"the idea of ether is anybody who pushes
story to VihuPlanet shows in ether. the cannon stories are the stories
owned by VihuPlanet and not by any account. so at any given moment the
ether should always show cannon stories + pushed to VihuPlanet
stories."*

- **At any moment the Ether is Canon Stories + every Story anybody has
  shared.** It is not per-creator. A Traveller with no Magic Card of
  their own still arrives in a universe that has other people's Stories
  in it.
- **Canon Stories are owned by VihuPlanet and by no account.** Decision
  13 is unchanged: they ship with the application, are never
  attributed, and a child never learns the distinction exists.
- **This replaces the Phase 1 boundary**, which read "there is no
  public cross-creator feed to read." Decision 9 said a real shared
  feed "becomes another source inside `EtherFeed.load()` and nothing
  downstream changes", and that is exactly how it arrived — a fourth
  source, with the runtime untouched.
- **`is_shared` is the public boundary, and it is a column rather than
  a guess.** A `generated always` column on `creator_projects`
  (`(data->>'publishedAt') is not null`), so it can never disagree with
  the Story and cannot be set by a client independently of actually
  sharing. `creator_projects`' SELECT policy widens only for rows where
  it is true. **Every unshared project stays exactly as private as it
  was** — a draft is unreachable through the shared feed by
  construction, not by a caller being careful.
- **A Story's maker travels with the Story** (`creatorName` on the
  record, stamped from the authoring device's own Magic Card). Reading
  the Magic Card on the device doing the LOOKING would label every
  Story in the Ether with the name of whoever is reading it.
- **A shared Story can be read, not only seen.** The records the feed
  fetches are kept by project id so the portal can open a Story that is
  in neither the local project store nor the Canon repository.
  Otherwise the Ether shows a Spirit that opens to nothing.
- Still out of scope and not implemented: moderation, ratings, scoring,
  popularity, likes, search, filters and ranking (Decision 12).

### 16. Show Me Your Stars Means the Magic Card

Locked by the product owner after real use: shown ⭐ Show Me Your Stars,
a child raised his physical Magic Card to the camera. Nobody taught him
that. The product agrees with him rather than correcting him.

- **⭐ Show Me Your Stars opens the camera**, not an identity screen.
  One short line — *"Show me your Magic Card"* — and a soft place to
  hold it. No QR codes, no account ids, no passwords, no tutorial and
  no technical word anywhere a child can see.
- **It must never look like scanning.** Not document capture, not
  banking, not face recognition, not an authenticator. No corner
  brackets, no reticle, no sweeping line, no percentage. It is
  VihuPlanet looking at the child's stars.
- **The Ether stays behind it, softened.** A child is never taken out
  of the universe to be recognised.
- **No new identity system.** The pattern the camera reads goes to
  `CreatorRecognition.recognise()` — the same call the drawing board
  makes, device first and platform second, matched as a SET. That is
  what makes a brand-new machine work: the card is the bridge, not the
  browser.
- **✏️ Draw Your Stars remains, and is first-class.** It is the way in
  whenever the camera cannot be used — permission refused, no camera,
  card not to hand, or the child simply preferring it — and it is never
  styled as an error state.
- **The language never blames.** Never "failed", "invalid", "not
  found", "verification". *"I couldn't see your stars yet."* ·
  *"I can't see your Magic Card."* Then Try Again · Draw Your Stars,
  and the child stays in the Ether.
- **A Traveller cannot fall into somebody else's sky.** Recognition
  succeeds only on an exact constellation belonging to a real Creator.
- **The card is read, not decoded** (`js/magicCardVision.js`): bright
  marks are found, registered against the card's own grid, and turned
  into cells. It shares `MagicCardArt.backGridGeometry()` with the art
  that draws the card, so the two cannot drift apart.
- **Disclosed limit.** The reader resolves the grid's left edge and
  width exactly, and the vertical phase only approximately, so it
  offers every reading the frame is consistent with (typically 3–8)
  and lets the recogniser choose. Only a real card's exact pattern
  belongs to a Creator, so a wrong reading matches nobody — the
  candidate list cannot invent an identity. **It has been verified
  against rendered cards, not yet against printed ones under real
  lighting.**
- Scope is closed: this sprint is only the interaction. The Ether,
  Story Spirits, Canon Stories, Create Story and Creator Home are
  unchanged.

### 17. The Card is Drawn to Be Read

Locked by the product owner after the camera failed on real cards
through five rounds of reader fixes. It **amends Decisions 11 and 16**,
which said the Magic Card itself is not redesigned. It changes the
card's back only; the Magic Card's role, meaning and identity are
untouched.

- **The card carries four guide stars, one at each corner of the star
  chart.** They are drawn with the same five-point path as every other
  star on the card, at 1.9× the radius, and a child sees four bright
  stars holding the corners of their sky. **They are not the old corner
  squares** — those were removed for looking like hardware bolted to a
  keepsake, and nothing about this announces a machine.
- **They exist because absolute position is part of the identity.** A
  pattern sits at a random offset on the grid, so a lattice shifted by
  one cell fits exactly as well as the true one. Every reader before
  this inferred the grid's origin from the stars themselves and
  sometimes inferred it wrong — which is precisely what *"all seven
  stars recognised but the pattern is off"* was. Four points at known
  coordinates give the projective transform outright; everything after
  is arithmetic rather than search.
- **The chart's ruled frame opens at the corners**, so each guide star
  is its own shape. A continuous border runs through all four and the
  detector swallows them whole — measured, the four guide stars were
  absent from the mark list entirely.
- **The chart sits on its own field of sky**, a shade lighter than the
  card. A thin stroke on near-black gives a camera nothing; a boundary
  between two regions is what edge detection is good at.
- **Old printed cards still work.** The reader tries guide stars first,
  then the chart's frame, then the card's own border, and falls through
  cleanly. Nobody has to reprint anything to keep using what they have —
  and **Draw Your Stars remains first-class**, exactly as Decision 16
  requires.
- **The reader and the art share one geometry function**, and a real
  bug proved why that is not enough on its own: the camera's
  no-argument default put the grid 40 card pixels — three quarters of a
  cell — below where the art drew it. A shared function still needs its
  default to be *measured* rather than asserted.
- **Disclosed limit.** Verified against rendered cards under a true
  projective warp: recognition 20/20 across square-on, tipped, turned,
  dim and steep. Reading the exact cells — the path a brand-new device
  needs — is exact square-on and under moderate tip, and still fails
  under strong turn, where it refuses rather than guesses. **A card
  held facing the camera reads; a card turned well away does not yet.**

### 18. A Creator Is Shown Their Sky Before the Door Opens

Locked by the product owner: *"before sending vihaan in studio in both
conditions whether he is at his home or at his grandma the pattern
needs to be shown on screen with a 10 second timer for him to get
assured he is correctly recognized with an option to say hey thats not
me."* It **amends Decision 11's** "recognition is instant and silent"
for the camera path only.

- **The camera never opens the Studio silently.** When a card is
  recognised, the sky that was recognised is drawn back to the child,
  with their name, and the Studio opens ten seconds later.
- **It is a countdown, not a question.** Nothing has to be pressed to
  continue — the door is already opening and the child is simply able
  to stop it. A prompt requiring an answer would turn every arrival
  into a form.
- **`That's not me` is the whole of the opt-out.** It puts the camera
  back and blames nobody.
- **Nothing is committed until the countdown elapses.** `setActive()`
  and `markRecognised()` used to run the instant a match was found;
  saying "that's not me" afterwards would have left the browser
  believing it, and the Studio's own Gateway would then have skipped
  its own question (Decision 11) on the strength of a recognition the
  child had rejected.
- **Both arrivals go through it** — the card already on this device,
  and a strange device that had to ask VihuPlanet. They are the two
  cases the product owner named, and they now share one path.
- **The drawing board is unchanged and stays instant.** There the child
  drew the sky and pressed Continue; they have already said it is
  theirs, and asking twice would be the form this decision avoids.
- **A strange device asks VihuPlanet before it asks the child.**
  `CreatorRecognition.recogniseAny()` existed for exactly this and was
  called from nowhere; the camera's still path now offers it every
  candidate reading in one parallel round. The drawing board is still
  there and is reached only when nobody recognises the sky at all —
  which is the only time it has a real question to ask.
- **The drawing order travels with the identity.**
  `recall_magic_card()` returns the stored pattern on the pattern
  branch only (`supabase/migrations_recall_returns_pattern.sql`), and
  `MagicCard.adopt()` prefers it — but only after checking it is the
  same SET the caller just proved. Without it, a Creator recognised on
  a brand-new device kept whatever order the camera happened to read
  the stars in, so their Magic Card there drew the right stars joined
  the wrong way. A typed-code recall still gets no pattern: that caller
  has proved nothing about the sky, and the pattern is the credential.

### 19. A Story Belongs to the Creator Who Made It

Locked by the product owner after a real report: *"i was logged in as
vihupapa. and then i went back and logged in as the god. my project
from vihupapa was still available in the god."*

- **Projects are scoped to the Magic Card that made them.** Every
  project record carries `cardId`, stamped from the active card and
  carried forward on every autosave like `publishedAt` and
  `creatorName`. `CreatorProjectStore.list()` returns what the active
  card owns, and nothing else.
- **The store was never Creator-scoped, and that was the whole bug.**
  It is per-DEVICE — one list, one IndexedDB, and a cloud row keyed on
  the browser's own anonymous session, which is the device rather than
  the card. Two Magic Cards on one machine shared all of it. The only
  wipe that existed fires for a first-time **Traveller** and never for
  a Returning Creator, which is exactly the case reported.
- **It is a filter and never a delete.** A second Creator borrowing a
  machine cannot destroy the first one's work by walking in, and the
  owner sees everything again the moment their own sky is recognised.
- **My Projects is scoped; the Ether is not.** A Story shared with
  VihuPlanet is public (Decision 15), so `listPublished()` reads every
  shared Story on the device whoever made it. Hiding one because a
  different card is active would take a Story out of the universe that
  its maker put there.
- **The session slot is the second door into the same room.**
  `ProjectManager.getSessionStatus()` refuses to offer a session whose
  project belongs to a different card — otherwise a Creator recognised
  after somebody else is offered that person's work by name before ever
  reaching a list. Refused only on positive evidence; an unowned or
  unmatched session restores exactly as before.
- **Work that predates this is placed by evidence, not by guessing.**
  A record's own `creatorName` was stamped from the card that was
  active, so a card on the device with that nickname IS its owner;
  failing that, a device with exactly one card has no ambiguity.
  Anything still unplaceable stays unowned, is shown to a Traveller
  holding no card, and is never deleted.
- **A Traveller's work becomes theirs when they claim a card.** The
  Rite has a child make a Story before they have one, so `claim()`
  sweeps unowned records to the new card — only unowned ones, never
  another Creator's.
- **A TRAVELLER IS STATELESS** (build 0634). Stated by the product
  owner: *"i would like to keep travellers stateless. once they are out
  of vihuplanet once the vihuplanet is reloaded, anything not attached
  with a card lets remove that."* If it is not attached to a Magic Card
  it does not survive — Stories, drawings, letters, the garden, the
  record that the Rite was completed, and the record of what it taught.
  A Traveller who does not claim a card arrives new every time and
  **walks all 23 beats again.** `js/travellerReset.js`.
- **VihuPlanet's load is the boundary, and it needs no marker.** It is
  the one entrance (Decision 10) and is never resumed, only entered
  (Decision 23), so arriving there is already the product's own
  definition of a fresh start — nothing has to guess what counts as a
  new session. The Studio sweeps too, for the stores that only exist
  there; every Studio arrival is preceded by a VihuPlanet load, so that
  is the same boundary finishing its work where those modules are
  loaded.
- **A Creator loses nothing by it, and that is what makes it safe rather
  than merely obedient.** `StudioRite.isComplete()` is
  `_flagSet() || _isCreator()` and the taught record is read from the
  active card before the device is consulted, so for anybody holding a
  card those keys were already dead weight. **Work belonging to ANY card
  — the active one, a sibling's, a stranger's — is never touched.**
- **The only exemption is the CURRENT NAVIGATION, never state.** The
  Story a child is making right now survives an in-Studio reload (the
  Home button, Publish's clean slate, the build stamp's refetch); and
  the Story a page was opened to show — `?born=` and `?story=` —
  survives that one load, because deleting the thing the navigation is
  about is incoherence rather than statelessness. Nothing is remembered:
  the next load carries no parameter and takes it.
- **A shared Story with no card behind it goes too.** It lives in the
  Ether through the platform's own shared feed (Decision 15's
  `is_shared`), so the local record is not what keeps it in the
  universe.
- **The wipe that already existed could never fire.**
  `js/gatewaySequence.js` cleared the WHOLE list, so it could only be
  allowed to run for a session that owned nothing (`!isReturning`) — and
  the moment a child held a Magic Card every leftover on the device
  became permanent. Decision 8's amendment made that nearly every
  session, since a card is minted the instant Rite I completes. Now
  ownership exists, the sweep no longer has to choose between everything
  and nothing, so that block is retired and the "Not Me" path takes
  unowned records only.
- **Legacy placement is a MIGRATION, and now runs once per device.**
  `_claimLegacy()`'s "a device with exactly ONE card has no ambiguity"
  branch was guarded by a module variable, so it re-ran on every page
  load and adopted *every* orphan that ever appeared on that device.
  Two consequences, both wrong: nothing an unclaimed session made could
  ever be swept, and a second child's story on a one-card device was
  handed to the first child's card — this decision's own promise broken
  in the other direction. It places work that predates ownership, which
  happens once and is finished.

### 22. The Studio a Child Meets Is the One They Completed a Rite In

Locked by the product owner: *"the studio the child meet is the one on
which he completed the rite. i would suggest levels of rites. 3 levels
for full progression"* — and then: *"level 1 is mandatory to become a
creator. level 2 and level 3 are the progressions in the studio. they
should be purely opt ins."*

Amends Decision 8 on two points: the Rite is no longer completed exactly
once, and its scope is no longer closed.

- **The Rite's reduction outlives the Rite.**
  `body.studio-rite-running` hides the controls the Starter Story never
  asks for, and it is scoped to the Rite *running* — so all of them
  reappear the instant it ends. A child made their first story in a
  Studio of five controls and was handed one of forty at the moment they
  were least equipped to read it. The reduction was right; its lifetime
  was wrong.
- **Each level's unlocks are what the previous level's story had no use
  for.** *Make a story → make it yours → make it live somewhere.* Level
  I is the existing Starter Story. **Level II is My Garden**, assigned
  by the product owner (*"lets assign my garden to level 2 and current
  level 2 becomes level 3"*) — its story is not written yet. Level III
  is the former Level II: Shapes, Doodle, Photo, Add Page and Card
  Designer, the existing *My Little House*. The World Designer, Page
  Style, Page Shape, From This World, Family Photos, Voice and the
  remaining publish formats become **Level IV**, locked by the product
  owner (*"lets keep it 4 levels, world tools become level 4"*). Four is
  today's count, not the design — the registry still holds the order and
  nothing downstream counts.
- **The order is a line in the registry, and nothing downstream holds an
  ordinal.** `RITE_NEXT` in `js/creationFlow.js` was a hard-coded
  `'my-little-house'`, which this decision forbids in as many words;
  moving My Garden to second would have needed a code change in a file
  that has nothing to do with rites. Studio Home now asks the registry
  for the first opt-in rite that has a story written.
- **A rite with no screens is a place in the order, not a door.** My
  Garden holds second place with `screens:null`, so it refuses to start,
  the offer skips it, and it contributes nothing to what a later rite
  reveals. Writing its story is the only thing that makes it real.
- **A rite never takes away what an earlier rite taught.** `reveals`
  accumulates in registry order, so the third rite shows the second
  rite's controls without either entry naming the other — and **only
  runnable rites contribute**, or placing My Garden second would put its
  tile into the third rite in front of a child who was never taught it.
- **Each level has its own starter story — ONE each, for now.** Not a
  feature tour with a narrative wrapper: a real story that happens to
  need the things that level teaches, because the Rite may show where a
  control is and may never explain what it does (Decision 8). Every
  capability a level introduces is used at least twice, once to discover
  it and once to own it, which is the Starter Story's own success metric.
- **The starter-story PACK is deferred, not cancelled.** One story per
  level for now, by the product owner's decision — which leaves the
  content for Levels II and III at two stories rather than fifteen. The
  pack was proposed to stop the Ether filling with the same first story,
  and that concern stands but is weaker than it looks: what the Ether
  actually shows for a Story is its cover, its name and its maker, and
  all three are the child's own. Two children who both made the Starter
  Story produce two Spirits that look nothing alike. Revisit when there
  are enough real shared stories to see whether sameness is visible in
  practice.
- **Level I stays on a blank page with no World, but for a new reason.**
  The recorded reason was offline safety — Studio ships with zero
  built-in Worlds and a Rite that needed one would hard-fail on a first
  launch with no network. That argument is void now the system is
  online-only (Core Principles). The decision survives on better
  grounds: a World brings Places, Frames and Experiences, which a child
  making their first story has no use for — and Level III is *about*
  Worlds, so giving one to Level I would take Level III's subject away.
- **Level I is mandatory; II and III are purely opt-in.** Completing
  Level I is what makes a child a Creator. Nothing else is ever required
  of anybody.
- **The offer lives in ONE slot on Studio Home, and shows ONE story —
  never two.** Locked by the product owner after seeing it rendered into
  the running Studio. It sits between the creation-type grid and the
  existing `Already have something?` band, reusing that band's own rule,
  width and card treatment, and reads *A new story is waiting* followed by
  the story's own name and one line about it. A child who has done Rite I
  sees *My Little House*; one who has done that sees whatever is next; one
  who has done them all sees nothing, and the band is **absent rather than
  empty**. Because there is never more than one, there is no ladder on
  screen to count or compare — which is how this stays inside "hidden,
  never locked".
- **Four of the five candidate surfaces were already closed**, and the
  elimination is the reasoning rather than a preference: VihuPlanet home
  (Decision 10 — no new button may appear as a child progresses), the
  Finish Story celebration (Decision 12 — exactly two equal choices),
  inside the editor (never mid-story, and in the Add panel it would read
  as *more tools*), and My Projects (*Continue a Project* has one job).
  Studio Home is what is left, and it is right: between stories, already
  a screen about what to make.
- **Not a pill, not a badge, not a seventh type card.** The two pills are
  *things of mine*; a story nobody has made yet is not one. The type grid
  holds *kinds* of story and a Rite is *one specific* story, so a seventh
  card would give it equal permanent weight. Nothing is added to the
  Magic Card's face.
- **It names a story, never a capability.** *My Little House* says what a
  child would be making; *Learn shapes and drawing* would say what they
  are being taught, which is the sentence this product does not write.
  Nothing on it says level, rite, two, three, next, progress, unlock, or
  the name of any control.
- **There is no decline and no dismiss**, which amends this decision's own
  earlier wording ("the offer is made once, and never returns after being
  declined"). Both halves assumed a prompt, and a prompt is the wrong
  form: *a prompt that must be answered is a nag; a card on a shelf can be
  walked past forever*. It never interrupts, covers anything or asks
  anything, so it does not need answering in order to stop. A decline
  would also build the wall this decision forbids — one tap of "No thanks"
  by a five-year-old and progression is closed permanently, making "a
  child who never takes Rite II loses nothing" false by accident.
- **A child who never takes Rite II loses nothing.** They keep making,
  finishing and sharing stories with the Level I set for as long as they
  like. Progression is an invitation and must never become a wall, a
  prompt that returns, or a reason anything is refused.
- **Hidden, never locked.** No padlocks, no greyed-out controls with a
  "Level 2" tooltip, no progress bar, no badge. A control not yet taught
  is simply not there; when it is taught, it appears. The moment a level
  has a name on screen a child can compare theirs with a sibling's,
  which is exactly the reasoning Decision 20 used to refuse growth
  stages for Cheer.
- **Rites are how the product introduces new capability — permanently.**
  Stated by the product owner: *"the rites is our way of introducing new
  features, options in the product."* So the Rite is not onboarding that
  happens three times; it is the delivery mechanism for everything the
  Studio will ever gain. Two consequences bind every future change:
  build a **rite registry**, never a hard-coded Level I/II/III — three
  is today's count, not the design; and **every new capability ships
  with a story that teaches it**, which means writing and a recording
  session are part of the cost of any feature, not an extra.
- **What is stored is which CAPABILITIES a child has been taught**, not
  which rite they finished. Rites will be added, split and reordered
  over the product's life, so a rite index is a moving reference while a
  capability is stable. It also settles what happens when a child
  abandons a rite half way: they keep whatever they actually reached,
  and there is no partly-finished rite to model.
- **It travels on the Magic Card, and is never shown.** A browser-local
  flag would drop a Creator to Level I on a grandparent's laptop with
  their own Level III stories in front of them — the failure Decision 19
  already had to fix for projects. Note that `hasEverPublished` is NOT
  the model to copy: it lives in `FLAGS_KEY` in localStorage, so it is
  per-device and would reproduce exactly that bug. The record belongs on
  `magic_card_identities` as a column and must be returned by
  `recall_magic_card()`, the way `companion_id` and `parent_email` were
  both added in later sprints.
- **Never a level, rank or score, and nothing new on the card's face.**
  The card has a stated *"no counters, no levels"* discipline
  (`js/magicCard.js` → `growthSignals()`), which this respects: a set of
  things learned is not a rank. A child's larger Studio is the only
  thing they ever see, and that reads as *I know how to do more*, not
  *I am a higher level*.
- **Existing Creators are grandfathered** by their claimed Magic Card
  and treated as having completed all three: they have been using the
  whole Studio and must not lose controls they have had for weeks.
- **Levels II and III are in Release 1**, by the product owner's
  decision. The writing and the recordings are therefore R1 work, and
  they are the largest item in it.
- **The persistence must not ship on its own.** Making the Level I
  reduction survive the end of the Rite before Rites II and III exist
  would leave every new child permanently at Level I with no way
  forward — the wall this decision forbids, and worse than the cliff it
  replaces. Order: Rite II, Rite III, the card record and the opt-in,
  and only then the persistence.
- Out of scope: level names shown to a child, badges, progress bars,
  percentages, locked controls, anything comparable between children,
  and required progression of any kind.
- **The reduction only hides what it NAMES, and that is a standing
  hazard.** Reported by the product owner looking at Rite I running:
  *"for a traveller why do we have garden and add creation button?"* My
  Garden was never in the list — the rules were written before the tile
  existed under that id — so the one control nobody thought to name
  stayed on screen through a story that never asks for it. Rite I
  reveals nothing, and it was offering Emojis · Text · **My Garden**.
  The same shape of leak as the Background `Picture` one already
  recorded here, and it will happen again: **every new control in the
  Add panel must be added to the reduction in the same commit that adds
  the control.** A tile is visible during a rite by default, which is
  the wrong default and is not worth redesigning — but it does mean the
  list is part of the cost of any new capability.
- **A rite is instrumentation-free even for the people building it.**
  The Garden's `Add Creation` trigger is Author Mode only (Decision 27)
  so a real Traveller never meets it — but Author Mode is remembered per
  browser (Decision 13), so anyone who has ever switched it on walks
  every later rite with a dev control sitting in a child's first story.
  It is hidden under `body.studio-rite-running` alongside `#devFooter`.
  A rite is the one place we watch a child use the product, so it is the
  one place instrumentation must be invisible to us too.
- **THE REDUCTION NOW OUTLIVES THE RITE** (build 0632), which is this
  decision's own opening sentence finally shipping. Reported by the
  product owner the moment he finished Rite I: *"the right pane is
  wrong. it should not have options from rites which are yet to come"* —
  nine Add tiles from a story that teaches two. **What is stored is a
  set of capability ids** (`teaches` ∪ `reveals`), granted when a rite
  completes, kept on `magic_card_identities.taught` and returned by
  `recall_magic_card()` (`supabase/migrations_taught.sql`), with a
  device fallback that `MagicCard.claim()` sweeps onto the card — Rite I
  finishes *before* the Ceremony mints one, so that window is the normal
  case rather than an edge.
- **A SECOND FAMILY OF CLASSES, never a widening of the first.** During
  a rite the visible set is the rite's own (`studio-rite-shows-*`,
  accumulated in registry order); `studio-gated` + `studio-taught-*` are
  written only while no rite is running, so not one shipped in-rite rule
  changes meaning. And **only the "quiet the Studio" rules are left
  behind** — Open, Save As, Home, the theme toggle, the autosave
  readout, the card badge, the build footer and the strip's legend all
  return the instant the rite ends, because none of them is a capability:
  they are the room, not what a child can make in it.
- **Voice belongs to My Garden; Page Shape belongs to My Little House**
  (build 0646). Moved by the product owner, and both sit better than
  they did: My Garden is the rite about bringing something of the
  child's OWN into a story — their handwriting, their drawing — and
  their voice is the third thing of theirs a story can carry; My Little
  House is about building something out of parts, so the shape of the
  thing being built belongs with it. The World tools are left holding
  only the World, which is what they are named for.
  **Both stories now teach them** (build 0647). *The Name on the Green*
  gains a thirteenth beat — *"They have not made a single sound since
  they arrived."* — placed after the arrival has been sized, moved and
  given something to find, because by then there is somebody on the page
  worth speaking for. *My Little House* gains a second beat, before the
  house exists: *"Some places are tall. Some are wide. This one has not
  decided yet."* — the first choice a builder makes is how much room
  there is to build in, and it stops being free once a house is standing
  on it. **`N6` in `tools/rite-test/` is what keeps this true**: for
  every capability a runnable rite reveals, some beat of that rite must
  gate on it, or the run fails.
- **THE WORLD TOOLS ARE PAUSED, and the registry entry stays.** Stated
  by the product owner: *"we will put the world tools on pause. that
  rite is not needed."* Paused is not deleted, and the difference is
  load-bearing: removing the entry would leave `world` named by no rite,
  and `_allCapabilities()` walks the registry — so a grandfathered
  Creator would lose the From This World tile they have always had, and
  a gated child would have it hidden with nothing able to hand it back.
  It is also the honest state of the capability: From This World needs a
  World with collection assets, and every rite runs on a blank page with
  none, so there is nothing for a story to teach yet.
- **A capability id is a design artifact, not machinery** (build 0645).
  Decision 27 renamed My Library to **My Garden** child-facing and froze
  every internal id — `creatorLibrary.js`, `creator_library`,
  `data-add-id='library'` — which is right, because those are plumbing.
  A capability id is not: it is what a person reads while deciding what a
  rite teaches, and the product owner read `library` and asked what a
  library was. Rite II carried **three** ids for one tile — `garden` and
  `handwriting` for its two rooms, `library` for the tile — one of them
  named after a word the product had stopped using. Collapsed to
  `garden` on his decision; `handwriting` stays, because a later rite may
  want to hand over letters without drawings. The tile's own
  `data-add-id` is untouched, so Decision 27 holds exactly where it was
  meant to. `MagicCard._renameLibraryToGarden()` rewrites any stored
  record once per device.
- **THE WORLD TOOLS ARE NAMED, so they are gated too** (build 0643).
  They were the last controls left visible, on the reasoning that no
  rite could teach them and hiding them would be the wall this decision
  forbids rather than the shelf it asks for. The product owner read the
  same screen the other way — *"remove page shape, from this world,
  voice from here they were not part of rite 1"* — and he is right:
  three controls a child's story never mentions are not a shelf either.
  `the-world-tools` is now a **place in the order with no story**, the
  same shape My Garden held before its own was written: it refuses to
  start, Studio Home never offers it, and it reveals nothing to any
  earlier rite. Being in the registry is what keeps it honest —
  `_allCapabilities()` walks every entry, runnable or not, so a
  grandfathered Creator still keeps all three, and the commit that
  writes the story opens the door in the same breath. **Story Title
  stays**: `story-name` is Rite I's own naming beat. Page Style rides
  with the World rather than being named, because it only appears once a
  World is chosen and a Level I child has none.
- **Grandfathering is by the ABSENCE of a record, not by holding a
  card** — and this corrects this decision's own earlier wording.
  *"Existing Creators are grandfathered by their claimed Magic Card"*
  died when Decision 8 was amended: a card is now minted the moment Rite
  I completes, so *holds a card* is true of every brand-new child and
  would have grandfathered the entire population the feature is for. The
  honest signal is the record itself — after this ships, finishing any
  rite writes one, so a Studio already used with no record anywhere is
  by construction somebody who was here before it existed. Every
  unreadable state (no browser storage, a platform that never returned
  the column, a card recalled onto a deployment predating the migration)
  reads the same way, so nobody is ever quietly stripped of a control.
- **"Was this Studio here before the record?" is asked of the CARD, not
  of `isComplete()`.** The grant's legacy branch asked `isComplete()`,
  which is `_flagSet() || _isCreator()` — and Decision 19's Traveller
  reset wipes that flag on every arrival, so at the moment the grant
  runs it means precisely *is a Magic Card in hand*, which is the test
  this decision already records as dead. A card left active from an
  earlier run therefore stamped every brand-new record `legacy-studio`
  and reopened the whole Studio. It now asks whether the ACTIVE CARD has
  no record of its own — and since `claim()` always stamps an array,
  even an empty one, a card with none cannot have been minted since this
  shipped. **A card minted now can never be grandfathered either**: the
  sweep drops `legacy-studio`, so a new card cannot inherit an older
  one's legacy through the device record.
- **A card already stamped is REPAIRED, once per device.** Build 0639's
  mark could not be undone by build 0640's fix, so a card that inherited
  it kept the whole Studio for ever. The migration
  (`MagicCard._repairInheritedLegacy`) drops `legacy-studio` from every
  card's record at load. **The product owner supplied the fact that made
  it safe** — *"as of now there is no card which has started story rite
  2"* — which answers the objection that a correctly-marked card and a
  wrongly inherited one are indistinguishable: with nobody past Rite I,
  the worst it can do to a correctly-marked card is hand it the Studio
  Rite I teaches, which is the one that card has earned. A card with **no
  `taught` array is untouched**, because absence is what grandfathering
  means; a card left with nothing has the property deleted rather than
  set to `[]`, so it returns to "no record" instead of being gated down
  to nothing.
- **And a card that never had a record at all is BACKFILLED, once.**
  Decided by the product owner after his own identity stayed on the full
  Studio through the repair above: it predates the record, absence means
  grandfathered, and nothing was going to change that. Every card
  standing on the device when the backfill runs is stamped with what the
  mandatory rite teaches — the Studio those cards have actually earned —
  on the same fact that makes the repair safe.
  **Absence-grandfathering survives as the LIVE rule**, and that is the
  whole reason this is one-shot rather than a change to
  `isGrandfathered()`: a card recalled tomorrow onto a deployment whose
  column is missing, or met on a browser that refuses storage, arrives
  with no record after the backfill has run and keeps every control. The
  fail-open path is intact; only the population standing there at the
  time was migrated. `StudioRite` says WHAT (the rite's own capability
  list), `MagicCard.stampMissingTaught()` says WHERE.
- **Controls and doors are DIFFERENT QUESTIONS, and one value answering
  both was a real bug.** A grandfathered Creator keeps every control —
  but they have never *walked* Rite II, so the next door is still
  waiting for them. Widening both hid the whole progression from
  everybody who used the product before today. `legacy-studio` is
  therefore recorded alongside the real capabilities: `taught()` reads
  it and hands back everything, `nextOptIn()` ignores it and sees only
  the rites actually taken. It rides in the same list through the card,
  the sweep, `adopt()` and the column, which is why it is a reserved
  capability rather than a second field in four places that could
  disagree.
- **`RITE_NEXT` is gone from the last place it could hide.** Studio
  Home's door asks `StudioRite.nextOptIn()`, so a rite already walked
  stops being offered without anybody storing a rite id — closing the
  limitation disclosed at build 0609.
- **Step 1 is built** (build 0569): the **rite registry** (`RITES` in
  `js/studioRite.js` — id, mission, screens, `teaches`, `reveals`,
  `unlocksStudio`, found by id and never by ordinal), Rite II's
  nineteen beats, its four new gates, and the Background `Picture`
  leak closed with `.context-bg-picture-section`. **What a rite makes
  reachable is data on the rite**: each entry in `reveals` becomes a
  `studio-rite-shows-<capability>` class, and the reduction's rules
  stand down for exactly those — so the first Rite, which reveals
  nothing, meets the Studio it always did. `StudioRite.start(id)` is
  the seam the Studio Home offer will call. **Still not built, in this
  order:** Rite III, the capability record on the Magic Card, the
  opt-in, and only then the persistence.
- **Rite II needs no recordings, and this amends the order above.**
  *"for story rite 2 plug the eleven labs lumo voice. we wont be
  recording it."* — the product owner, at build 0581. Rite II's
  recordings were listed here as the next thing to build and are
  **cancelled rather than pending**: every one of its nineteen beats
  deliberately carries no `audio` field, so each falls through to the
  generated-voice path and Lumo speaks it in his own configured voice.
  The real gain is that the spoken path **needs no cues** — a recorded
  screen carries a hand-measured offset per line, re-measured whenever
  a line is re-recorded, so rewording a Rite II line is now a one-line
  edit with nothing to keep in step.
- **A rite with no recordings is walkable, and always was.** A screen
  with no `audio:{id,cues}` reveals its lines at reading speed and
  plays nothing; the guard that refuses to run is about Lumo's *art*
  package, not his voice. So a new rite ships silent and a recording
  session adds one field per screen. Never invent placeholder audio ids.
- **Studio Home is now the child's journey, in two states, and this
  amends the offer clause above** (build 0609, the Story Rite
  Progression brief). The screen that was a menu of six creation types
  under *Step 1 of 2* is gone as a first screen. **`StudioRite.isComplete()`
  alone decides which state a child meets** — never a Magic Card, because
  a child who made their first story and chose not to share it holds no
  card (Canon 6), and sending them back to the beginning would tell them
  their story did not count. The product owner reviewed exactly that case
  and kept it.
  **State A**, before the first story: no menu at all. *Your journey
  begins · A Story Is Waiting · Follow a little story. Make some
  choices. Change something. Make it yours. ·* **Begin**, which runs the
  first rite. **State B**, after it: *You made something. ✨ · Now Look
  What You Can Make · Try something new with what you discovered.*, then
  three named starting points — **My Little Story · Character Card ·
  Little Message** — each a real entry into the existing editor made only
  of what the first story already taught, and under them the next door.
  **The invitation's words changed and it no longer names the story.**
  It reads *A new door is waiting · Ready to discover what you can do
  next? ·* **Discover**, in place of *A new story is waiting* followed by
  the story's own name. Everything the offer clause was protecting still
  holds — one slot, one thing, never two, no decline, no dismiss, no
  badge, no count, absent rather than empty when there is no next one,
  and it still never names a capability. What it lost is the story's
  name, and what it gained is that it is plainly about the child rather
  than about a title they have not met.
  **"Step 1 of 2" is deleted.** It counted a form, and this screen
  stopped being one.
  **Disclosed, and unchanged by this:** nothing yet records which rite a
  child has taken, so the door still stands there after Rite II has been
  walked through. That is the persistence §6 forbids shipping early, not
  an oversight. **Also disclosed:** the six-tile menu survives whole
  (`_renderCreationTypeScreen`) and is what a child gets if the guide
  cannot be reached at all — so nobody is ever stranded on a door that
  will not open — but it is no longer a route a child takes by choice,
  which means Screen 2's World picker is now reached from inside the
  editor (the header's own World readout) rather than before it. No
  control was removed from anybody.
  `tools/creation-home-test/run-creation-home-tests.js`.
- **THE DOOR IS IN THE STUDIO TOO, AND THE RESTORE MODAL IS GONE**
  (build 0648). Reported by the product owner: *"whenever i return to
  vihuplanet, it always takes me in to studio where i get discard and
  restore prompt. so i have no way to know there is something called
  door. and actually the door is a good concept can we not get it in
  the studio too?"* Both halves were true and the first was the worse
  one — measured, `_beginBoot()`'s Restore called `restoreSession()` and
  went straight into the editor, and `_startCreationFlow()` was reached
  only from its CATCH. So Studio Home, and the invitation on it, was
  skipped on every return a child actually makes, since a returning
  child always has a saved session. **Discard was the only route to the
  door**, which is to say the only way to meet the next rite was to
  throw away the last story.
- **Resuming belongs WITH the other ways in, not as a modal in front of
  them.** The child lands on Studio Home every time, their own story is
  the first thing on it — *You were making something · <its name> ·*
  **Carry on** — and the door is simply also there. This removes a
  modal from a five-year-old's path rather than adding a surface, which
  is why it was preferred to keeping the modal and bolting a third
  button onto it.
- **DISCARD NEEDS NO BUTTON.** The session slot is a POINTER, never the
  story: the story itself lives in `CreatorProjectStore` and is listed
  in My Projects either way. A child who picks anything else on Studio
  Home starts a project, which overwrites the slot — so discarding now
  happens by choosing, which is what a child was doing anyway.
- **The World refresh Restore used to await still runs, and gets more
  time than it did.** A hard refresh wipes `ThemeRegistry`, and an
  Artwork Theme not re-registered before `deserialize()` drops a project
  to a default viewport — the landscape-came-back-portrait bug. It is
  fired in the background at the same point, and now has the whole time
  a child spends on Studio Home rather than the time they take to press
  a button. Corrupt and unreadable sessions keep their own modals: those
  are technical facts with nothing to carry on to.
- **The Studio's own door lives in the LEFT RAIL, and never in the
  header.** Placed there on the product owner's instruction. The rail is
  the one column nothing else claims. (Build 0648 justified it here by
  saying the Rite's own band docks in this rail; measured, it does not —
  the band is a separate overlay and the rail collapses to zero width
  while a rite runs. The placement is the product owner's instruction,
  which needs no second reason.) **Never in the Add panel** —
  this decision closed that surface by name, since a tile there reads as
  *more tools*. Everything required of Studio Home's door holds here
  unchanged: one slot, one thing, never two, no decline, no dismiss, no
  badge, no count, nothing that says level or rite or progress, and
  **absent rather than empty** when there is no next rite. It is hidden
  while a rite is running, in `refreshStudioDoor()` and again in CSS: a
  chapter owns the screen, and offering the next one mid-story is the
  interruption this must never be.
- **It rides `refreshStoryActions`, so nothing new polls.** That pulse
  already fires on every page mutation and when a rite starts or ends,
  which is exactly when whether there IS a next door can change.
- **`rites()` now projects `reveals` beside `teaches`.** A caller
  deciding what a child has been through needs the whole set, and
  reading it off the registry is the only way to do that without
  hard-coding an ordinal — which is this decision's own rule.
- **A DOOR SHOULD LOOK LIKE SOMEWHERE WARM IS BEHIND IT** (build 0649).
  Reported by the product owner: *"need sizing fix. also the door needs
  to be more inviting."* The door was a dashed rule, a drawn door and a
  grey outline button — every part of that treatment says *end of the
  page*. It is now a lit alcove: the glow is centred on the DOORWAY
  rather than washed across the top edge, because a wash reads as a
  tinted card and a pool of light reads as light coming through an
  opening. Its button is warm, and deliberately a shade LIGHTER than
  Carry on's solid gold — this is an invitation sharing a screen with
  the child's own unfinished story, and it must never be the louder of
  the two. **Nothing about it moves on its own**: still a card on a
  shelf, never a prompt. The rail's door gets the same treatment at rail
  size, so there is one door in the product and not two.
- **The resume pill is ONE ROW, and that was a real fit bug.** Stacked,
  it stood ~130px and pushed *Now Look What You Can Make* past the fold
  — the opposite of what putting the story on this screen was for. It is
  now the height of its own button, with a long story name shortening
  rather than wrapping the pill into a box.
- **A SHORT WINDOW SEES THE WHOLE SCREEN, NOT A LESSER ONE.** Measured
  at 1359×600 — a 1366×768 laptop once the browser's chrome is off — the
  screen stood 746px tall and Discover sat below the fold, which for an
  invitation nobody is told about is the same as not being there. The
  trim is **decoration first and content last**: under 760px tall the
  wordmark's tagline and divider go, every band's breathing room
  tightens and the drawn door shrinks, but not one word, tile or control
  is removed. 746 → 600, zero overflow. Guarded by `F13`–`F15`, proved
  by disabling the media query and watching Discover fall 44px below the
  fold.
- **Decision 21 sets a minimum WIDTH and says nothing about height, and
  that stays true.** This is a layout that fits its window, not a second
  gate: a short window is never refused, told to resize, or shown a
  reduced Studio.
- **THE DOOR IS DOCKED, NEVER PUSHED** (build 0650). Reported by the
  product owner: *"is there no better location in studio. now with every
  page add the door will slide down."* Exactly right, and it was a
  defect in the placement rather than a preference: the rail was one
  block box that scrolled as a whole, so the door sat after the page
  list and every new page moved it further out of reach. Measured at
  1359×900 — one page put it at 274, four at 538, twelve at 1242 and
  thirty at **2826, over two thousand pixels below the fold**. A door
  you have to scroll to find is the same failure as a door behind a
  modal, one build later.
- **The rail is a flex column now, and the PAGE LIST owns the scroll.**
  The list takes the free height and scrolls inside itself, so PAGES and
  + Add Page stay put as well, and the door is pinned to the foot of the
  column. Its top margin is `auto` rather than a fixed value, so it sits
  in the same corner from the FIRST page instead of drifting down and
  then stopping once the column happens to fill — **a control a
  five-year-old has to look for is one they do not use.** Measured at 1,
  4, 12 and 30 pages: one position, on screen at every one of them, and
  the rail itself never scrolls.
- **The location did not change, only its anchoring.** The rail is still
  the product owner's placement and the Add panel is still closed by
  name; nothing was moved to a new surface to fix this.
- `F5a`–`F5c` guard it, proved by reverting the rail to a scrolling
  block and watching the door reach 2826px at thirty pages.
- `tools/creation-home-test/` (84) covers both halves, through a real
  page load with the Gateway skipped the way a child skips it: the door
  in the rail, absent once every rite is taught, gone while a rite runs;
  and coming back landing on Studio Home with the story named, one tap
  away, no modal in front of it.
- **BOTH OPT-IN RITES WERE UNWALKABLE, AND NOTHING CAUGHT IT** (build
  0651). Reported by the product owner walking Rite II: *"story 2. beat
  2. how would i show?"* — beat 2 says *your letters live on the right,
  with the things you can add*, and My Garden was not there. Measured,
  two independent causes, and the second was worse than the first.
- **`studio-gated` survived into the running rite.** The body carried
  BOTH families at once — `studio-rite-shows-garden` saying show it, and
  `studio-gated` with no `studio-taught-garden` saying hide it. Both are
  `display:none !important` and neither knows about the other, so the
  gate simply won and a rite could not hand over its own subject. Rite
  III was in the same state with **every one of its five controls
  hidden**. This is the exact hazard this decision already records for
  the two families, arriving from the direction nobody watched: not a
  rule naming the wrong capability, but two correct rules left switched
  on together.
- **It broke for precisely the population the rites exist for.** A
  grandfathered Creator has no record, so `studio-gated` is never
  written and they saw nothing wrong; a child who has actually finished
  Rite I is the one who gets gated, and they are the only one the door
  is ever offered to.
- **`applyTaught()` already encoded the right answer** — it strips
  `studio-gated` and every `studio-taught-*`, then returns early while a
  rite is running — so `run()` calls it rather than growing a second
  rule that could disagree. One source of truth for what shape the
  Studio is in.
- **Voice and Page Shape were still hidden UNCONDITIONALLY in every
  rite**, on a comment written before build 0646 moved them into Rites
  II and III. Every gateable control now stands down on its own
  `studio-rite-shows-<capability>` class, so moving a capability between
  rites is a registry edit and never a CSS edit — which was the whole
  point of `reveals` being data. From This World still appears in no
  rite, and that is now the same rule rather than an exception: nothing
  reveals `world` while that rite is paused, and writing its story opens
  the door with no change to the stylesheet.
- **N6 proves a beat exists; it cannot prove a child can SEE what the
  beat is about.** `V0`–`V6` close that: every runnable rite is walked
  for real as a gated child, and every capability it reveals must
  resolve to a control that is not `display:none`. Proved by reverting
  each fix separately.
- **A check that reads its expectations from the thing it is checking
  proves nothing.** The first version of `V` derived the capability →
  selector map from the stylesheet's own `:not(.studio-rite-shows-X)`
  rules — elegant, and blind in exactly the direction that shipped: a
  control hidden unconditionally has no such rule, so it fell out of the
  map and was never looked at. The map is written down now, a revealed
  capability missing from it fails, and the stylesheet is cross-checked
  against it instead of trusted.
- **MY GARDEN HAS TWO ROOMS, AND THE STORY IS IN ONE OF THEM** (build
  0652). Reported by the product owner walking Rite II: *"second beat is
  about letters. but the highlighted part is drawings."* He tapped My
  Garden because Lumo had just said his letters lived there, and landed
  among his drawings — the room the picker happened to have opened on
  last.
- **The picker's own rule already covered this; it had no way to know.**
  *Each keep flow reopens onto its own room so a child lands where their
  new thing is* — a story sending a child for a letter is exactly that
  situation. `StudioRite.wantsRoom()` answers it, so **which gate is
  about letters and which about drawings stays in the rite** rather than
  becoming a second copy of the script inside the Context Panel. It is
  one optional question with a null answer, so the Studio behaves
  exactly as before with the module absent, and it is asked only when a
  room was not named explicitly — every existing keep flow is untouched.
- **A rite never locks a room.** Both tabs stay live and a child can
  wander into the other one whenever they like; the story only decides
  where the door opens. *Hidden, never locked* applies inside a control
  as much as to the control itself.
- **The nudge has three steps now, not two.** The way in while My Garden
  is shut, **the ROOM when it is open and standing in the other one**,
  and the catcher once it is up. The middle step was missing, and
  without it the nudge pointed at the tile the child had already tapped
  — which is the same dead end as pointing at nothing. It reads the
  tabs' `data-room` rather than their words, because those are copy and
  `studioRite.js` is not the file that owns them.
- `W1`–`W7` walk Rite II for real to the letter beat and open My Garden
  the way a child does, proved by reverting each half separately.
- **A RITE STANDS BEHIND A CATCHER, NEVER OVER IT** (build 0653).
  Reported by the product owner mid-Rite II: the band was sitting
  straight over the letter catcher, covering the camera and its buttons.
  `.hw-studio-modal` opens at z-index 1000 and the Rite's dock sits at
  1400 — the identical stacking `_watchForModal` was written for when
  Publish hit it, arriving from a screen nobody had listed. It is worse
  here than for Publish: the beat says *hold your letter up so I can see
  it* while Lumo covers the very camera it is asking them to hold it up
  to. Both catchers join the same list, so there is one definition of *a
  modal the Rite must stand behind* rather than a second rule.
- **The catcher is its own chapter**, with its own instruction, its own
  camera and its own button, so the Rite stands all the way down and
  comes back the moment it closes — the same *two guides at once* rule,
  not a new one. **A future full-screen step belongs in that list, in
  the commit that adds the step**, exactly as a new Add tile belongs in
  the reduction.
- **A NAME ARRIVES ONE LETTER AT A TIME, AND THE CHILD SAYS WHEN**
  (build 0654). Reported by the product owner walking Rite II's naming
  beat: *"if we write all the letters on single paper it will not work.
  the beat should be fill the garden with your name letters one at a
  time. once done click i did it."* The line read *Write the rest of
  your name*, which describes something the catcher cannot do — it is
  armed for ONE letter, reads that letter, and reopens the letters room
  so the next tile is one tap away. **A beat may never ask for something
  the tool cannot take.**
- **The beat cannot count, because only the child knows when their name
  is finished.** The gate still passes on one more letter and then the
  Rite's own **I did it!** waits for them, dropping and re-offering
  itself each time they go back for another — which is exactly the shape
  asked for and needed no new machinery. The subtitle invites that press
  without naming it: the button already says what it is, and Lumo does
  not read out the interface (Decision 8).
- **LUMO STEPS ASIDE WHILE THE GARDEN GROWS.** Asked for by the product
  owner: *"the lumo should disappear or get to a side so that child can
  see the garden grow in front of himself."* Measured at 1359×800,
  `.preview-wrapper` starts at x=296 and the band sits at x=296, 231px
  wide — it covers the **whole** of the left growth band Decision 27
  puts the garden in, so a child told their letter is being kept in
  their garden could not watch it happen.
- **THE LEFT PANE, FOR THE WHOLE OF A GARDEN BEAT** (build 0655).
  Reported by the product owner after the step-aside shipped: *"lumo
  screen is still there. you can collapse it and just keep i did it
  button, or move lumo and idid it button to left pane as there is only
  single page there."* He is right: the 2.2s step-aside is correct for
  the growth itself and does nothing for the rest of the beat, which is
  where a child spends most of it — going back for the next letter,
  looking at the garden in between.
- **Beside-the-page is his own earlier preference and stays the
  default.** This overrides it only where the two collide: the beats
  whose whole subject is a garden growing in the very gutter Lumo is
  standing in. `_prefersRail()` reads `wantsRoom()`, so it follows the
  story rather than a list of gate ids kept in step by hand, and the
  dock is re-placed when the beat changes rather than only on a resize.
  Measured at 1359×800: beside-the-page x=296 (the wrapper's own left
  edge), the left pane x=16 width 248 — the whole workspace clear,
  growth bands included. The **I did it!** button travels with him,
  because it lives in the same panel.
- **A rite runs on a blank page with one thumbnail in it**, which is the
  observation that makes the pane free — and it is exactly the one the
  product owner made.
- **A moment, never a relocation** — this is the other half, and it
  still applies where the band IS beside the page (My Garden is revealed
  for the whole rite, so a child may keep something on any beat).
  Growth answers in about 1.5s, so the band recedes for a little longer
  than that and comes straight back. It never uses `display:none`: a
  Lumo who vanishes and reappears is a glitch, one who leans out of the
  way is being polite. **It stands down in the pane**, where he is
  already out of the way — fading a guide for no reason a child can see
  is worse than not fading one.
- **It rides `vihu:creation-captured`** — the same single event the
  Garden itself grows on (Decision 27: one event, a capture id,
  deliberately no type field) — so it learns nothing about letters,
  drawings or cameras, and a future capture source gets the behaviour
  for free. Suppressed under reduced motion, where the growth animation
  is suppressed too and there is nothing to step aside for.
- **AN OPT-IN RITE CAN BE PUT DOWN AND PICKED BACK UP** (build 0656).
  Proposed by the product owner: *"why dont we allow resume from studio
  home for rite 2 & 3 this way it will never enter projects or show in
  projects till completely done, child does not have any work lost on
  account of not able to complete in single seating."* It amends this
  decision's assumption that a rite is walked in one sitting, and it
  fixed a measured defect: a rite opens a blank story the instant it
  starts, so every abandoned attempt left one in My Projects — three
  starts, three empty stories.
- **HELD, NEVER DELETED.** The alternative considered first was to keep
  a blank project out of My Projects until something was in it, and it
  only solved the litter. This solves both: the story is kept, offered
  back, and resumed. A child who spent a quarter of an hour on Rite II
  and had to stop loses nothing — which is the half that matters, since
  Decision 19's rule is *a filter and never a delete*.
- **The flag lives on the STORY, not the Magic Card.**
  `riteInProgress` is a field on the project record, carried forward on
  every autosave exactly as `publishedAt`, `creatorName` and `cardId`
  are — a field not carried forward is wiped the moment editing
  continues. It buys four things at once: `CreatorProjectStore.list()`
  filters those records out, it already syncs to the cloud so a resume
  works on another device with no new column and no migration, it is
  inherently one-per-story, and pressing the door again reuses the held
  story rather than making a second one.
- **WHERE THE CHILD HAD GOT TO IS DERIVED, NEVER STORED.** This
  decision's own rule is that rites will be added, split and reordered
  over the product's life — which is exactly why capabilities are
  stored and not a rite index. A saved beat number would rot on the
  first reorder, and Rite II has gained or reworded beats twice. So the
  rite replays from beat one and auto-advances past every beat the
  story itself can account for. The gates were already the truth about
  what a child has done.
- **A COUNT, never a yes.** Gates repeat — Rite III has four
  `shape-added` beats and four `doodle-added` ones — so a boolean
  reading would replay a child who drew one shape past all four,
  landing them in a story about a house they never built. And the count
  is kept **per pool, not per gate**: `letter-kept` and `letters-grown`
  both read the letters a child has made, and counted separately one
  letter satisfied both and walked them a beat too far (measured).
- **RETOLD, not replayed.** A beat already lived through shows its
  lines at once and moves on — no voice, no cues, no waiting. Speaking
  it again would take as long as the first sitting, which is the
  opposite of picking up where you left off. Ten beats is about five
  seconds.
- **Disclosed limit.** `sticker-moved`, `sticker-resized` and
  `sticker-rotated` cannot be read back from a saved story: it records
  where the star IS, which is equally consistent with never having been
  touched. They are treated as done when there is anything on the page,
  because sending a child back to redo work they already did is the
  worse of the two failures. Each appears at most once per rite today;
  a second occurrence would be indistinguishable from the first.
- **The mandatory rite is deliberately NOT held.** Its story is the
  child's first — the thing they finish, share and get a Magic Card for
  (Decision 8) — and a Traveller walking it holds no card and is
  stateless anyway (Decision 19), so there is nothing to resume onto.
- **The offer is the same one slot, worded for what it is.** *You left
  a door open · Your story is still there, waiting for you. · Carry on*
  in place of *A new door is waiting · Discover*. Everything the door
  already had holds: one thing, never two, no decline, no dismiss, no
  badge, no count, absent rather than empty, and it still names no
  rite, level or capability. Both doors — Studio Home's and the rail's
  — read it, because there is one door in the product and not two.
- **Never two offers for one story.** A held rite story is also what
  the session slot names, so Studio Home would have offered it once as
  a story to carry on with and again as a door left open — and the two
  are not interchangeable: opening it as a plain project drops the
  child into the editor with no Lumo and no beats, which is not what
  they left. The resume pill stands down; the door is the one that
  knows how to give it back.
- `Z0`–`Z10` walk Rite II for real: two beats, leave, come back twice,
  resume at the beat they stopped on with the work intact, then finish
  and watch the story enter My Projects — and only then. Proved by
  removing the filter and the replay separately.
- **A BEAT MAY NEVER ASK FOR A CONTROL THAT IS ASLEEP** (build 0657).
  Reported by the product owner on Rite II's last beat: *"play story is
  greyed out in its beat."* The Rite holds Play My Story and Finish
  Story shut for its whole run — *the story is not finished until Lumo
  says so* — and only a screen carrying `unlock:true` wakes them.
  **Rite II's play beat did not carry it**, so its final beat asked a
  child to press a greyed-out button: a rite that could not be finished.
  Rite I's and Rite III's play beats both carry it; this one was simply
  missed.
- **The suite could not see it because the suite reached around it.**
  The walker built one build earlier fell back to `StoryPlayer.open()`
  when the button was disabled, so it finished a rite no child could.
  **A walker that reaches around a dead control cannot see a dead
  control** — it uses the real button and nothing else now, and stalls
  exactly where a child would.
- **`U1` is static, and covers the rite this suite does not walk.** For
  every runnable rite, a beat gating on an action the Rite holds shut
  must come at or after the beat that wakes it. `_beats(riteId)` joins
  the harness reads because nothing could previously read the gate and
  the unlock flag together — which is why two facts that were each
  visible made an invisible bug.
- **"TELL ME WHEN" MEANS THE CHILD DECIDES, NOT A COUNTER** (build
  0658). Asked by the product owner: *"tell me rescanning same letter
  does it or does it not clears the beat."* Measured — it does not.
  `HandwritingStore.save({ch})` reuses the existing record's id, so a
  re-scan **replaces** a letter rather than adding one and the count
  never moves. Every letter beat compares a count against the count
  when the beat began.
- **Which made the naming beat a wall.** Its gate is *more letters than
  before*, so a child whose name is one letter — or who simply redoes
  the letter they already made — could never reach **I did it!**, and
  the nudge would just repeat itself. That is the wall this decision
  forbids, and it broke the beat's own promise: *Tell me when it is all
  there* says the child decides, and a counter was deciding.
- **A beat may declare itself child-ended** (`end:{await:…,
  declared:true}`). The gate stays — it is what the nudge points at and
  what the replay reads — and only the CONFIRMATION stops waiting on
  it. A declared beat also never finishes itself: being asked to say
  when you are done and then having it decided for you is worse than
  either alone.
- **The beat before it is untouched.** `letter-kept` still waits for a
  real letter, because something has to arrive before there is anything
  to declare.
- **Disclosed.** A child who declares done and later resumes lands back
  on that beat — the declaration is not recorded on the story, and the
  replay reads counts. It costs one press to declare again, and the
  alternative (replaying past a beat on a smaller count) would push a
  child who was mid-name past the beat that asks for it.
- **A check that asserts the defect is worse than no check.** `X3` read
  *"nothing to press yet"* — true, and exactly the wall. It now asserts
  the opposite. When behaviour is corrected, the test that encoded the
  old behaviour is part of the fix.
- **A VOICE IS REPLACED, NOT ADDED — AND THE COUNT NEVER MOVED** (build
  0660). Reported by the product owner on Rite II's voice beat: *"added
  the voice but still i did it button did not came."* Reproduced: a page
  holds ONE narration clip, so recording again REPLACES it, and the gate
  counted PAGES carrying a voice. Voice is revealed for the whole of
  Rite II, so a child who recorded on any earlier beat reached this one
  with the count already at 1 and **Record Again could never move it**.
- **The same shape as the letters, one beat along.** Both are gates on a
  pool where the child's natural action replaces rather than adds. The
  letters beat was answered by letting the child declare it done; this
  one is answered by reading what the beat is actually about — the
  baseline now keeps a SIGNATURE of which page holds which clip instead
  of a tally, so a new recording counts whoever it replaced.
- **Removing the only voice is not saying something.** A signature alone
  would call that a change, so one narrated page must still be there.
- **`page-shaped` had the identical bug, latent.** A page holds one
  shape, so changing it moves no count either, and Page Shape is
  revealed for the whole of Rite III. Fixed the same way rather than
  waiting for it to be reported.
- **The lesson worth keeping: a count is the wrong reading whenever the
  control it watches REPLACES.** `bg-set` already knew this and carried
  its own `bg!==baseline.__bg` comparison; voice and shape were written
  as tallies and both were wrong for it.
- **A BEAT NAMES ONLY WHAT THE CHILD WILL FIND** (build 0661). Reported
  by the product owner on Rite III: *"we are asking kid to add square,
  there is no square in the shapes."* The catalogue has Circle,
  Rectangle, Rounded Rectangle, Triangle and a dozen more, and no
  Square. Measured before choosing a fix: a shape is added at 240×240,
  so the tile labelled **Rectangle already gives a perfect square** — the
  shape was never missing, only the word.
- **A Square tile was considered and rejected.** Shapes are drawn to
  whatever box they are given, so it would behave identically to
  Rectangle and be a second tile doing one job — and a child resizing it
  would make its name a lie. Beat 4 already says *Add a triangle*, so
  naming the tile is the form this story already used.
- **The fourth bug of one family, so the guard is general.** `P1`/`P2`
  check that every shape noun a shapes-teaching rite uses is a real entry
  in `StickerLibrary.SHAPE_KINDS` — not a test for the word "square".
  It joins `N6` (every revealed capability has a beat), `V` (every
  revealed capability resolves to a visible control) and `U` (no beat
  asks for a control the Rite holds shut).
- **HOME STAYS, EXCEPT IN THE ONE RITE THERE IS NO WAY OUT OF.** Asked
  for by the product owner: *"story rites except story rite 1 should
  have home button."* The mandatory rite holds the Studio shut until it
  is finished (Decision 8), so a way out would be a way to skip becoming
  a Creator — and there is nowhere to go, since Studio Home is what it
  unlocks. An opt-in rite is the opposite: a door the child chose, whose
  story is now held and offered back (build 0656), so leaving costs them
  nothing and hiding the way out only traps them. A
  `studio-rite-mandatory` body class tells the reduction which kind is
  running; everything else the Rite quiets stays quiet in all three.
- Design and sequencing: `docs/STUDIO_RITE_LEVELS.md`. Rite II's script
  and its engineering notes: `docs/STUDIO_RITE_LEVEL_II_STORY.md`.

### 21. VihuPlanet Is For Everybody; the Studio Needs a Laptop

Locked by the product owner: *"vihuplanet is meant for laptop screens
and not mobile screens. mobile should not be allowed to move past sky
detection."*

- **Everything up to and including being recognised works on a phone.**
  The Ether, Story Spirits, reading, Cheer, ⭐ Show Me Your Stars, the
  camera, ✏️ Draw Your Stars and recognition itself are unchanged on
  every device. A child can visit VihuPlanet on a phone and be known by
  their stars.
- **Only the Studio door is closed.** Making a story means a Card
  Designer, a Page Designer, an Object Strip, a Context Panel and a
  page canvas at once; there is no phone layout of that which would be
  honest. What a phone would get is not a smaller Studio, it is a worse
  one.
- **The check happens AFTER recognition, never before.** Checking first
  would refuse to look at a child's stars at all, which is a colder
  product than telling them where the making happens. They are still
  recognised, still committed, still known.
- **`goStudio()` is the only door, so it is the only gate.** All four
  ways in — the two permanent actions and both recognition paths — pass
  through it, so a phone is turned back once rather than by four checks
  that could disagree.
- **A phone is told from a computer by TWO signals** (`js/deviceGate.js`):
  the primary pointer is coarse, AND the width available *right now* is
  under `MIN_WIDTH` (1024). Never the user agent — a string anybody can
  set, which lies by default on iPad. Never width alone: a laptop with a
  narrow window is still a laptop and must not be locked out of its own
  Studio, so a mouse means yes whatever the window is doing. **Tablets
  are allowed**, and in landscape an iPad Pro 12.9 gives a child *more*
  canvas than a 1280 laptop.
- **It measures WIDTH NOW, not the device** (amended after measuring).
  The first rule asked whether the SCREEN's short edge was ≥ 768 — a
  device-fixed number, so it answered the same in either orientation,
  and it was wrong in both directions at once. An **iPad Pro 11 held
  upright** (834 wide) was let in, and the three columns became
  260 | 254 | 320 — a canvas *narrower than either sidebar*, 222×278,
  with the header controls overlapping. An **iPad mini held sideways**
  (1133 wide) was turned away for a 744 short edge, when it would have
  had a 553px middle column, more room than the iPad 9.7 landscape the
  same rule admitted. `MIN_WIDTH` is a measurement, not a taste:
  1024 → 444px centre, 1080 → 500, 1194 → 614, and 834 → 254.
- **A tablet held upright is not a refusal — it is asked to turn.**
  *"Turn your screen around · Stories are made the wide way. Turn it,
  and everything will be right here."* It is the same device that works
  perfectly one gesture later, so "stories are made on a bigger screen"
  would be a lie about the iPad in the child's hands. There are three
  answers, not two: yes, rotate, and not on this screen. A device
  already sideways in a narrow window is **not** told to rotate — that
  is a window problem, not an orientation one.
- **Turning it opens the door, with nothing pressed again.** The panel
  asked them to rotate, so asking for the button a second time would be
  asking twice for one answer. Watched only while the rotate wording is
  up, and dropped the moment a child chooses Back to the Ether — so
  turning the tablet minutes later never opens the Studio out of
  nowhere.
- **Unreadable signals mean yes.** A Creator wrongly turned away from
  their own stories is a far worse failure than a phone getting a
  Studio it cannot use well.
- **The language never blames**, and never says "unsupported",
  "incompatible" or "device". *"Stories are made on a bigger screen"* ·
  *"Open VihuPlanet on a laptop and everything will be waiting for
  you."* A recognised child is told *"I know your stars"* first, so
  being turned back never reads as not being known.
- **It is an overlay on the living Ether**, never a page and never a
  wall: the universe carries on behind it and Back to the Ether costs
  nothing. Whatever asked the question is closed first, so no answered
  question is left offering its buttons underneath.
- Decision 10 is intact: the two permanent actions are unchanged and no
  button was added or removed. Only what happens behind them differs,
  which is what that decision already allows.

### 20. Cheer — Stories Grow When Somebody Believes in Them

Locked by the product owner in the Cheer sprint brief.

- **A Cheer is not a Like.** It is a small act of magic from one
  Creator that gives another Creator's story a little energy, and the
  story grows for it: *Story → Cheer → Growth → the story is a little
  more alive in the Ether.* The words Like, Rating, Vote, Upvote and
  Score are not used anywhere a child can see, and neither is the
  thinking behind them.
- **Cheer belongs to a Story in the Ether**, on the Preview that
  appears when a Spirit is met. There is no feed, no comments, no
  followers, no rankings, no leaderboards and no popularity badges,
  and adding one is a canon change rather than a feature.
- **One Creator, one Cheer, per Story.** The database's primary key IS
  the rule — one row per (story, cheerer) — so a double tap, a retry
  and two devices at once all end with one row and one count. There is
  no counter to drift out of step with the rows, because the count is
  the rows.
- **Cheer is Magic Card agnostic.** A Traveller who has never claimed
  a card, and may never claim one, can give starlight to a story
  exactly like anybody else — being able to say "I love this" must not
  require having become a Creator first. The cheerer is the visitor's
  own anonymous session, derived server-side from `auth.uid()`, so
  nothing is sent and no client can claim to be somebody else. The
  stated cost: a cheer belongs to a browser rather than to a person, so
  the same child on a second device can cheer the same story again.
  That is the right way round — one extra cheer is a far smaller wrong
  than a child being told to claim an identity before they may be kind
  about somebody's story.
- **Growth is CONTINUOUS, and it is derived.** `GROWTH_THRESHOLD` in
  `js/cheer.js` is where a Story first visibly grows; `GROWTH_FULL` is
  where growing stops. Between them there is no stage, no step and no
  threshold: `Cheer.growth()` returns 0 → 1 on a front-loaded curve, and
  every cheer moves the Story a little. Deriving it from the stored
  count is what makes growth persistent for free — there is no second
  piece of state to keep in step, and no way for a Story to be grown
  while its cheers say otherwise.
  (Amends the original "ONE stage", which was written to keep a level
  system out. The reason stands and the mechanism changed: with one
  stage the fourth cheer and the four-hundredth looked identical, so a
  Story stopped answering the kindness it was given. A continuous
  curve answers every cheer without there ever being a rung to be on.)
- **A stage is a level, a level has a name, and a name can be
  compared.** That is why there are none. The product owner's growth
  ladder is a specification for the curve and **a child never sees
  it** — no bands, no band names, no numbers, no progress, and nothing
  announced when a Story passes anything.
- **The drawing code is never given a count.** `Cheer.growth()` hands
  the runtime one 0 → 1 number and the renderer reads only that, so
  there is no quantity anywhere in the drawing path that could be
  turned into something displayed. Companions interpolate 3 → 7 with
  the fractional part fading in, so no cheer ever makes one appear.
- **Growth stays company, never brightness, at every point on the
  curve.** The warm field deepens by a little and stops. Brightness
  already means NEARNESS in this universe, so a much-loved Story that
  kept getting brighter would be lying about where it is — and a sky
  where the well-cheered Stories are the loud ones is a ranking drawn
  in light, which Decision 9's "calm before spectacle" rules out.
- **Growth belongs to the Story, never to the Creator.** Not their
  other Stories, not a profile, not the Ether. Verified against three
  Stories by one maker.
- **Any Story can be cheered and grown — Creator or Canon, it does not
  matter.** A Canon Story met in the Ether offers the same Cheer, takes
  it the same way and grows the same way. That is Decision 13 holding
  rather than a second rule: `origin` lives on the entity's `source`,
  which the story layer, physics and the renderer never read, so there
  is no branch in which they could differ. A child never learns the
  distinction exists, and would find one the moment a Story they liked
  refused their starlight. Verified through the real button on a Canon
  Story: cheered → grown → survives a reload → the renderer's light
  carries it.
- **The effect is company, not brightness.** A grown Spirit carries
  **three small warm lights that circle it**, outside its own card, and
  rests in a soft warm field a little larger than the card. Deliberately
  not "brighter": brightness already means NEARNESS in this universe,
  and a grown Story that merely looked closer would be saying the wrong
  thing. This is a different colour in a different place — starlight
  somebody else gave, sitting around the story.
- **A Cheer arriving is starlight travelling to the Story** and
  settling on it — never a burst, never confetti, never a reward
  popup. No hearts, no thumbs, no social-media iconography.
- **No number is shown anywhere.** The button says `Cheer`, then
  `Cheered`, and that is all. The sprint allowed a small quiet count
  and it was briefly on the button; the product owner took it off, and
  the screen is better for it — a figure on a button is a score however
  small it is set, and it invites a child to compare their story
  against somebody else's rather than to look at either. The count is
  still kept and is what decides growth; growth is the part a child
  sees.
- **Nobody can ask who cheered.** `story_cheers` has RLS on and no
  policies at all: everything goes through two SECURITY DEFINER
  functions that return counts and "have I cheered this", so no social
  graph exists to leak rather than one being withheld.
- **Local first.** A tap lands instantly and survives a reload with no
  platform configured at all; the platform is told afterwards and its
  total replaces the local guess when it arrives.
- Out of scope and not implemented: growth levels, ranking, trending,
  leaderboards, comments, followers, likes, reactions, badges, rewards,
  points, currencies, notifications, social profiles and moderation
  changes. ("Multiple growth levels" is still out — continuous growth
  is the opposite of levels, not a set of them.)
- `supabase/migrations_cheer.sql` · `js/cheer.js`.

### 23. VihuPlanet Is Never Resumed — It Is Always Entered

Locked by the product owner: *"the vihuplanet is never resumed from
studio. it should always be resumed from home screen. this will get rid
of discard and restore state also."*

- **Leaving the Studio always lands on VihuPlanet's home screen** — the
  threshold, then the two permanent actions. Never a mid-session Ether,
  never the Spirit a child was looking at, never the yaw they had turned
  the sky to.
- **So there is no universe state to save, discard or restore, and there
  never will be.** No camera yaw, no focus target, no "where was I", no
  snapshot taken on the way out. This is the point of the rule rather
  than a consequence of it: the cheapest way to never have a
  save/discard/restore problem is to have nothing to save.
- **This is already how the product behaves**, verified rather than
  assumed: `#etherBtn` in `js/app.js` does
  `window.location.href='index.html'` — a full page load — and the
  threshold is up on every load of the root. The rule makes that
  permanent and forbids the optimisation that would look like an
  improvement.
- **Decision 9's "nothing was lost rather than something restored" still
  holds, and this is its other half.** That clause governs *inside*
  VihuPlanet, where the portal is an overlay and the universe is never
  torn down. Crossing to the Studio leaves the document entirely, and
  there the honest answer is not a restored universe but a fresh
  arrival. A restored universe is a picture of a place; an entered one
  is the place.
- **The threshold earns its keep on every arrival.** Decision 10's
  turn is deliberately different every time, and it is the teaching. A
  resumed Ether would skip it, so a child coming back from making
  something would get *less* of the universe than one who opened a new
  tab — which is exactly backwards.
- **What this forbids**, so nobody adds it later believing it is a
  courtesy: persisting camera state, a "return to where you were"
  parameter, skipping the threshold for a returning session, and any
  back-button special case that rebuilds the previous view.
- **Intent may cross; state may not.** `index.html?born=<projectId>` and
  `?story=<projectId>` are one-shot intents — consumed, then stripped
  from the address bar. Never a snapshot of a session.
- **The Story Birth hand-off already obeys this.** A shared Story does
  not play its arrival behind the threshold: `js/vihuplanetHome.js` holds
  it in `onThreshold` and brings it in once the child is actually looking.
  The intent survived the trip; no state did.
- **Stated cost, accepted.** A child looking at one Spirit who goes to
  the Studio and comes back has to find it again. The Ether is a place to
  wander, not a document with a cursor in it — and a Story they want
  again has a deep link.
- `Back to the Ether` keeps its name. The Ether *is* what they come back
  to; it is alive behind the threshold, one tap away, as it always is.
- **The Studio is never opened directly, and it is now ENFORCED** —
  reported by the product owner: *"if i am working on a story and than
  refresh the page or simply close the page and reopen vihuplanet it goes
  directly to studio."* There was never a resume feature; the browser was
  doing it. The moment a child taps ✨ Create Story the address bar reads
  `studio.html`, so a refresh, a reopened tab, a restored session, the
  back button and a bookmark all landed in the Studio and never on
  VihuPlanet. Decision 10 has always said this must not happen; nothing
  checked.
- **Authority is minted per navigation and consumed on arrival**
  (`js/studioEntry.js`). `goStudio()` — the single door, Decision 21 —
  leaves a one-shot pass; the first line of `studio.html` consumes it, so
  it authorises exactly ONE load. A **flag** would not do: "this browser
  has been through VihuPlanet" is true forever after the first visit, and
  a session flag would survive a refresh, which is one of the two cases
  named.
- **A page reloading ITSELF keeps its own authority.**
  `StudioEntry.renewHere()` is called by the Studio's Home button, Publish
  Studio's clean-slate reload and the build stamp's cache-busting
  refetch — all three are deliberate in-Studio navigations, and without it
  the gate would read them as arrivals from nowhere. It is a no-op
  anywhere that is not the Studio, so the build stamp cannot mint a Studio
  pass while running on VihuPlanet.
- **Author Mode is the one exemption** (Decision 13): a development
  configuration, so `studio.html?author=on` and a browser already carrying
  the flag still open the Studio directly.
- **Stated cost, accepted, and it is what was asked for:** a refresh
  mid-story goes home. Nothing is lost — the story is autosaved and the
  session slot offers it back — and re-entry is two taps (Tap to Explore ·
  ✨ Create Story). An unreadable browser opens the Studio rather than
  stranding a child, the same call `DeviceGate` makes.
- Verified end to end at build 0563, zero page errors: a typed
  `studio.html` goes home · the real journey opens the Studio · a plain
  refresh goes home · the back button does not bounce back in · the Home
  button stays in the Studio · `renewHere()` mints nothing on VihuPlanet ·
  Back to the Ether still leaves · and one tap gets back in.

### 24. A Story Is Somebody's World, and Its Companion Lives There

Locked by the product owner in the Companion as World Host brief:
*"When a Traveller opens a published story, the story owner's Companion
should appear naturally within the story experience and accompany the
Traveller as a quiet, living presence. The story owns the attention.
The Companion enriches the experience."*

- **The host is the OWNER's Companion. Never the Traveller's own, never
  a generic one, never one made up for the visit.** If it cannot be
  resolved, **no host is shown at all** — a host that is not the
  owner's would be a stranger in the child's world claiming to live
  there. That is a disclosed state, and it is now rare rather than
  permanent — see the backfill below.
- **Stories shared before this existed are stamped where ownership is
  provable, not left empty.** Reported by the product owner: *"can we
  update the preexisting stories too. there is no way to reshare
  them."* Both halves were true, and the second was worse than it
  sounded — `markPublished()` returns `already` on its first line,
  before the block that puts a Companion aboard, so even re-sharing
  would not have fixed one. A one-shot sweep
  (`CreatorProjectStore._sweepCompanions`, run lazily from `list()` and
  `listPublished()` exactly as `_claimLegacy()` already is) fills a
  MISSING Companion on a Story this device can prove is its own.
  Nothing is invented: it is the same stamp the same device would have
  applied at share time, from the same card, applied late.
  **Ownership is judged by Decision 19's own standard** — refuse only
  on positive evidence that a record belongs to somebody else — so a
  Story owned by another card is left alone and a shared machine can
  never put one child's Companion into another child's Story. A Story
  that already carries one is never rewritten. A Story made by another
  child and living here through the shared feed heals when its own
  maker next opens VihuPlanet, and their sweep syncs it up.
- **If the Traveller notices it, it should read as *"there is someone
  living in this world"*, never *"an AI assistant has appeared"*.** The
  test: a Traveller must be able to experience the complete Story
  without interacting with, understanding, or paying any attention to
  the Companion.
- **The Companion travels WITH the Story**, stamped from the authoring
  device's own Magic Card and carried forward on every save, exactly as
  `creatorName` and `cardId` already are (Decision 15). Nothing else
  could work: `cardId` is the owner's Magic Card and a Magic Card lives
  on the owner's own device, so resolving it any other way would mean a
  new identity lookup across children, which VihuPlanet does not do.
- **What travels is a structured Companion Record, not an id string**
  (`js/companionRecord.js`), because the product owner asked for it to
  stay expandable "when companion is given more growth and maturity".
  Every layer between the store and the renderer passes it through
  **opaquely** — reading only the fields it needs and preserving the
  ones it does not understand. The test any change is held to: adding a
  growth or maturity field later must require **no change** to the
  store, the feed or the host resolver. Same discipline Decision 9
  already states for the Story Entity.
- **Room for maturity is not room for a ladder.** `js/magicCard.js` →
  `growthSignals()`'s stated *"no counters, no levels"* and Decision
  20's refusal of growth **stages** both apply here without a word
  changed: a stage is a level, a level has a name, and a name can be
  compared between children. Whatever arrives on the record later must
  be a quality a Companion has, never a rank a child could hold up
  against a sibling's.
- **A Canon Story is hosted by Lumo.** Canon is owned by nobody
  (Decision 13) so there is no Creator's Companion to be its host — and
  Decision 13 also requires that a child can never tell a Canon Story
  from a Creator Story, so a Canon Story that alone had no host would
  be exactly that tell. Lumo belongs to VihuPlanet itself and
  attributes nobody (Canon 2). Resolved by ROLE from the registry,
  never by the id.
- **`js/storyHost.js` is the only thing that answers "who hosts this
  Story"**, and the Companion rides on the entity's `source` — which
  the runtime copies wholesale and never reads inside, exactly as
  `origin` does. Physics, the renderer and the story layer cannot tell
  one Story's host from another's, because there is no difference for
  them to act on.
- **The attention hierarchy is *story → story content → interactive
  elements → Companion → UI*, and it is enforced as GEOMETRY.** The
  host lives in its own reserved row at the foot of the portal, so it
  cannot overlap the page, either arrow, the close control, the title
  or the count — those are in other rows of the same flex column. A
  z-index and some judgement would have looked identical and broken on
  the first oddly-shaped page. **Stated cost, measured:** a hosted page
  is 5.2% shorter at 1280×800 and 2.3% shorter at 390×844. A Story with
  no host reserves nothing and gets the layout it always had.
- **It is not a control.** `pointer-events: none`, `aria-hidden`. No
  Companion panel, no click target, no dismiss, no configuration, no
  tutorial, no chat bubble, no onboarding — and quieter when there is
  less room.
- **Four behaviours and only four:** welcome (wave → idle), idle
  presence, one quiet reaction on a page turn, a brief celebrate on the
  last page. The reaction fires **after** the turn animation finishes —
  a Companion moving while the paper moves is two things competing for
  one glance — and is rate-limited.
- **look/observe, react-to-story-events and scene transition are CUT,
  and this is a fact about the runtime rather than a deferral.**
  `EtherFeed.pagesOf()` returns a flat list of page images; there is no
  `SceneEngine` anywhere in this path, no scenes and no story events.
  The page turn is the only real event. **Do not invent an event model
  to react to.**
- **Poses are preferences, never requirements.** The packs are unevenly
  complete (quill ships no `celebrate`, `happy`, `surprised` or
  `sleep`; nimbus and leosaurus no `think`), so every behaviour
  degrades down a chain that ends where every pack has art. A child
  bonded to Quill never sees a broken or missing image.
- **No second companion system, and `js/companionEngine.js` is
  untouched.** The Studio's mounted widget is draggable, clickable,
  position-remembering and carries a speech bubble — right in the
  Studio, wrong over a story being read, not least because a draggable
  portrait a child can park on the page is the one thing the hierarchy
  forbids. The host uses the same seams the three existing in-place
  companion surfaces already use: `loadRegistry()` and the package's
  own `companion.json` states map.
- Out of scope and not implemented: augmentations, creator scripting,
  AI dialogue, conversation, memory, personality systems, autonomous
  reasoning, companion-generated content, companion-controlled
  progression, social features, new Companion UI, marketplace,
  community, version management, and any Builder or Studio redesign.
- `js/companionRecord.js` · `js/storyHost.js` · `js/etherHost.js`.

### 25. Characters Speak, and Recordings Win

Locked by the product owner in the Vihu Voice Foundation brief.

- **A recorded performance always beats a generated one.** Lumo has
  fifty recorded lines and they are never synthesised over. A line that
  names a recording plays the recording and generates nothing —
  "beautify originals rather than replacing them" (Product Vision)
  applies to a voice as much as to a picture. Generation exists for the
  lines with no recording, which is every line the five Companions have.
- **`js/vihuVoice.js` is the one thing story code calls.**
  `VihuVoice.speak({ characterId, text })` and nothing else to learn. A
  caller never learns a provider exists, never holds a voice id, never
  builds a request and never sees a key. If a future change has to touch
  story code to swap the provider, the seam is in the wrong place.
- **The key lives in `supabase/functions/voice-speak` and nowhere
  else** — never in the browser, never in a bundle, never in a
  client-side environment variable, never committed. Non-negotiable.
- **A voice id is content, not a secret.** It names a voice and
  authorises nothing, so it lives in `assets/registry.json` beside the
  art and the role. Changing, retuning or replacing a voice is a JSON
  edit with **no code change and no redeploy**.
- **Silence is a correct answer.** No voice chosen yet, no key, no
  platform, no network, a provider having a bad day, or a browser
  refusing audio without a gesture — each ends with the line unspoken,
  the screen exactly as it was, and the reason in the console. **An empty
  `voiceId` is a normal state, not a fault**: every character starts that
  way and the whole product works with none configured.
- **No provider terminology and no technical error ever reaches a
  child.** Never "TTS", "ElevenLabs", "API", "unavailable" or "failed".
  The function answers **HTTP 200 with a `reason`** for every failure so
  a caller that treats "not audio" as silence needs no error handling at
  all.
- **Emotion is the word that is already on the face.** Asked for by the
  product owner: *"in the speak function we need to insert emotions
  also."* The vocabulary is the **Companion's own states** — happy, sad,
  curious, celebrate, surprised, sleep, wave — and not a second,
  parallel list of feeling-words somebody has to keep in step with the
  art. A Companion pulling a delighted face while speaking in a flat
  monotone is the exact thing a voice must not produce, so the word
  drawn and the word spoken are one word. Four registers exist for
  characters with no face and therefore no state (neutral · warm ·
  gentle · whisper).
- **A feeling moves a voice; it never replaces one.** Every entry is a
  delta on the character's own settings, so a happy Quill is a happier
  version of Quill rather than a generic happy voice — **the character
  survives the mood**. Verified: the setting that carries who somebody
  *is* is never touched by any feeling.
- **`CompanionEngine.speak()` passes the state it is already in**, which
  is why no caller had to learn about moods and none was changed.
- **Anything unrecognised is neutral, never an error and never a refusal
  to speak** — an undefined feeling, a pose that is not a feeling, or a
  future package inventing a state this table has never heard of.
- **An audio tag is never sent to a model that would read it aloud.**
  Only the v3 family understands them; every other model hands the
  brackets to the reader and a child hears the word "whispers" spoken.
  So the check is positive and anything unrecognised is assumed not to
  support tags. Today no tag is sent at all.
- ~~**The Ether's World Host does not speak**~~ — **amended by Decision
  26.** The canon change that clause named was made deliberately, in the
  Sprint 1.1 brief. The host now speaks exactly twice, and Decision 24's
  test still binds every line of it.
- **Disclosed:** lines that fire on load or on a timer are blocked by the
  browser's autoplay policy and stay silent, with the bubble still shown.
  Not worked around — speech should follow a real interaction, which is
  also what makes it feel like somebody answering.
- Where voices live, how to add one, and how to configure credentials:
  `docs/VIHU_VOICE.md`. Listening room:
  `tools/voice-audition/index.html`.

### 26. The World Host Welcomes a Traveller In, and Sees Them Out

Locked by the product owner in the Sprint 1.1 brief. It is the canon
change Decision 25 said would be required, and it changes nothing about
Decision 24's hierarchy.

- **The Companion speaks exactly twice: once on arrival, once at the
  end.** Nothing in between. *"Someone from this world welcomed me in"*
  and later *"someone from this world saw me off"* — and the whole middle
  of a Story is the Companion being present and ignorable.
- **It is not a narrator, not a chatbot and not commentary.** No line
  describes the Story, explains it, or refers to what is on the page.
  Decision 24's test is unchanged and still binds: a Traveller must be
  able to experience the complete Story without paying the Companion any
  attention.
- **The welcome comes first, and the arrival page waits for it**
  (amended by the product owner: *"go with A and B as fallback"*). The
  portal holds the first page's own narration until the greeting has
  landed — spoken to the end, suppressed, or impossible — because a
  welcome that arrives after the page has already been read aloud is not
  a welcome. The hold is bounded (8s cap), released instantly when there
  is no host, and dropped by a page turn: a child who turns the page has
  answered the welcome, and a pending or mid-sentence greeting is cut,
  never queued. The brief's §2 ordering (companion greets → story plays)
  is what this implements; nothing advances by itself while held, so the
  story is never paused for the Companion.
- **Story narration still ALWAYS wins everywhere else.** If a page's
  voice is already playing when the host wants to speak — a child who
  turned pages before the welcome fired, or the farewell landing on a
  narrated last page — the host waits for quiet (2.5 seconds at the
  opening, twelve at the ending) and then **gives up rather than talking
  over it**. The opening's wait shrank from six seconds to 2.5 when the
  hold arrived: six meant whether a child was greeted depended on how
  long the first recording happened to run, which nobody chose. Never
  two voices at once.
- **The host is handed a predicate, never a reference.** Narration lives
  in the portal's own closure, so `EtherHost.open(story, {isBusy})` asks
  a question and the host knows nothing about narration, AssetStore or
  how a page gets its voice.
- **Twenty system-owned lines, ten each way**, chosen at random with the
  one rule that never repeats the line before — a child who opens two
  Stories and hears the same greeting twice has learned it is a
  recording. `"Hey… you're here."` and `"That was a lovely story."` are
  the canonical defaults and are index 0 of each library, so the default
  and the first entry cannot drift apart.
- **No Traveller memory, and it is unwriteable rather than merely
  avoided.** The Ether knows a Story, its owner and that owner's
  Companion — nothing else. "Welcome back", "good to see you again" and
  "I remember you" would all be lies, so no line contains *back*,
  *again* or *remember*, and the suite fails on any that does.
- **Ambience ducks under the voice; the Story does not.** A duck is a
  separate multiplier in `AudioManager` that **nothing persists** —
  `setVolume()` writes the child's own setting, and ducking through it
  would leave a universe permanently quieter than they left it if
  anything failed in between.
- **A voice never outlives its Story.** Closing the portal stops the
  host mid-sentence and releases the duck, the same rule the page's own
  narration already followed.
- **Still no UI of any kind** — no bubble, no panel, no nameplate, no
  prompt. The host stays `pointer-events: none` and `aria-hidden`.
- **The creator cannot author any of this yet.** Companion Augmentations
  — notice this, react here, stay quiet here — are a later sprint. For
  now the library is system-controlled.
- Out of scope and not implemented: AI-generated dialogue, per-scene
  lines, Traveller identity, Traveller preferences, previous-visit
  awareness, and conversation of any kind.

### 27. My Garden — Where the Things a Child Creates Live

Locked by the product owner in the MY GARDEN sprint brief, with two
corrections given during design: growth happens in the CENTER pane
around the play area, and My Garden holds both scanned creations and
handwriting.

- **My Library's meaning changed; its machinery did not.** Child-facing
  it is **My Garden** (🪴 — a potted plant, the thing actually inside); internally the feature is the **Living
  Garden** and nothing is renamed — `creatorLibrary.js`,
  `creator_library`, every API. Same rule as Publish/Finish Story.
- **The Garden is an environment, not a screen.** The center pane stays
  the child's play area. Growth — vines, sprigs, leaves, buds, the
  occasional flower — lives in the workspace margins AROUND the page,
  never over the page, the strip, or any control; the reserve is
  enforced by measured geometry, and the layer sits above the stage sky
  and below everything real by document order alone.
- **Every capture grows the Garden; the kind of creation never
  matters.** One event — `vihu:creation-captured` with a capture id and
  deliberately no type field — is the whole integration. The scanner
  dispatches it on a successful keep; handwriting and future sources
  use the same event; the Garden learns nothing about cameras,
  segmentation or OCR. **One capture = one growth**, held by a
  recent-ids guard; re-rendering grows nothing, by construction.
- **Growth is state-driven and replayed, never scan-numbered.** What
  persists is `{seed, events}` (plus the id guard), scoped to the Magic
  Card with a Traveller fallback swept on claim (Decision 19's
  pattern). Each step consults the garden built so far through six
  zones — origin, nearby, edge travel, branching, connections,
  blossoming — and past a hard density ceiling the garden deepens (buds
  open, leaves fill) while the element count never rises again.
- **No gamification, ever:** no counts, scores, levels, badges,
  progress bars, percentages, rewards, unlocks or comparisons — and no
  instruction: nothing tells a child that scanning grows the Garden;
  the behaviour is the teaching. A growth response is ~1.5s, then
  still; no bursts, no confetti; reduced-motion suppresses it.
- **The developer trigger is Author Mode only** ("Add Creation", one
  simulated capture per click) — a development configuration, never a
  child-facing control, per Decision 13.
- Out of scope and not implemented: a separate Garden world, scenes,
  quests, characters in the Garden, AI regeneration of child artwork,
  runtime/story/page-model changes, and any Studio redesign.
- **The Garden holds the letters too — the WHOLE grid.** The picker's
  ✍️ My Letters section is the full a–z · A–Z · 0–9 grid a child fills
  click by click: a kept tile is their real ink and places on the page
  through the same tail a scanned character uses (↻ make-again and ✕
  take-out as quiet corner affordances); an empty tile opens the
  catcher — `js/handwritingStudio.js`, the handwriting flow's second
  host, same rule as the drawing flow's — armed for exactly that
  letter. Backed by `js/handwritingStore.js` (the library's plumbing,
  letter-sized, writing `creator_handwriting`); the tool's grid
  hydrates from the same store so kept letters survive a reload.
- **The letters are also a FONT.** `js/handwritingFont.js` builds the
  child's real TTF from their kept letters with the tool's own builder
  (shared, deterministic), registers it as a FontFace, stores it in
  the migration's font row, and rebuilds on every keep — making a
  letter IS updating the font. "My Handwriting" joins the font lists
  through one seam (`withOption`) only once a font exists, with a
  Kalam fallback so unmade letters borrow a plain one. Publish needed
  nothing new — the renderer resolves families and Publish already
  preloads them (Rule 5).
- **New growth carries light, and gives it back.** Asked for by the
  product owner: *"anything which new grows should have a glow."* The
  vine's growing tip, the stem that reaches out and the leaf at the end
  of it all arrive lit in the Studio's own gold, and the light goes out
  as they settle. **It never stays**, and that half is as deliberate as
  the first: a permanent glow on the newest elements is a *these are the
  latest ones* marker a child could count backwards from, which is the
  quiet kind of counter this decision already rules out. The established
  garden is never lit — only what just grew — and a plain re-render
  lights nothing at all. Reduced motion suppresses it for free, because
  nothing is ever marked as new there.
- **A growth event is not always an element appearing.** The renderer was
  told `after.length - before.length`, so a bud opening into a flower, a
  flower ripening into fruit and a leaf filling out were all read as *no
  growth* — measured, 172 of 600 captures across five seeds animated
  nothing, and every capture past the ceiling was among them. A growth
  step now reports **what changed** (`{type, added, transformed, was}`),
  the renderer animates the elements it names, and where the KIND changed
  the old shape is drawn giving way to the new one. Nothing of it is
  persisted — it is derived on replay like the garden itself.
- **Variety is a form, never another object.** Each kind has a small
  seeded set — a leaf is single, curled or paired; a sprig forks; a bud
  pairs; a flower opens wider or clusters; fruit hangs in twos. A paired
  leaf is ONE leaf drawn as two blades, so the element count, the density
  ceiling and the replay are exactly what they were. **Do not make the
  Garden grow more; make the growth more interesting.**
- **Past the ceiling the garden MATURES, and scale is the fallback rather
  than the behaviour.** The pool is state transformations — a bud opens, a
  flower ripens, a leaf fills out, a flower opens wider, fruit pairs, a
  sprig forks — and a leaf's scale is reached only when nothing is left to
  transform. "The same leaves are getting slightly bigger" is what this
  exists to prevent. No path out of that branch reports no change.
- **A growth response outranks a re-render.** Captures and re-renders share
  one rAF and the last caller used to win, so a resize could swallow a
  child's answer. The growth report stays live for as long as its
  animation does, and a plain render inside that window redraws *with* it.
- **The top arc folds into the sides, and it is a PRESENTATION
  decision.** This workspace has no top band and structurally cannot
  have one: the garden layer lives inside `.preview-wrapper`, and that
  box is exactly as tall as the page canvas — above and below both
  measure 0 at 1280, 1440 and 1920. The side bands exist only because
  the wrapper is *wider* than the canvas, by 113px each side. So growth
  committed to `top` was decided correctly and drawn nowhere: 12% of all
  life-cycle events, the connections phase's own arc among them.
  Resolved by the product owner (*"fold top into side"*): where a top
  band cannot draw, its left half goes to the top of the left band and
  its right half to the top of the right band, outermost highest, so the
  two vines thicken toward each other instead of joining over the page.
  **The engine still commits to `top` and replay is untouched** — the
  same seed and history still produce exactly the same garden. Only
  where an undrawable band is *put* changes, and where a workspace does
  have a top margin nothing folds and the arc is still an arc.
  **The tempting alternative was refused on the record:** letting the
  engine ask which bands are drawable would make one child's garden a
  different shape on a different screen, and change shape when a window
  resized. Seed + history → the same garden is the foundation, not a
  convenience.
- **The Garden has a LIFE CYCLE, and the ceiling became pressure.**
  Elements grow, mature, age, wither, fall, rest on the garden floor and
  go, and the room that leaves behind is grown into by ordinary growth.
  **Growth is caused by capture; aging is caused by maturity** — so
  aging runs BESIDE a growth step and never in place of one, which is
  *structure outranks season* taken to its conclusion and is why the
  growth decision tree and every measured season pacing are untouched.
  **Age is counted in captures, never in wall-clock time**: a child who
  does not visit for a week comes back to the garden they left. Nothing
  new is persisted — an element's birth step is derived on replay, so
  the record is still exactly `{ seed, events, recentIds }`.
- **Every threshold lives in ONE object**, `LIFECYCLE` in
  `js/gardenEngine.js`, exposed as `LivingGarden.lifecycle`. Do not
  scatter timing constants. **Each kind leaves its own way**: a leaf
  pales, detaches, drifts down and rests before going; a flower fades,
  drops its petals and **leaves its stem standing**; a fruit never
  yellows, it ripens and drops; a sprig dries slowly. **A vine never
  ages** — every element is placed on one and drawn attached to one, so
  aging the skeleton would not be a season, it would be demolition.
- **Density is pressure, not a wall.** Below 70 elements the garden ages
  at its own pace; the pressure ramps to 132 and shortens every span
  toward half; past 110 a step increasingly deepens instead of adding.
  Measured over five seeds at 340 captures each the count runs
  18 · 50 · 69 · 82 · 83 · 79 · 82 and then **sits at 77–85 forever**
  while new growth still arrives on two captures in three. The old 110
  cap is never reached by a healthy garden; 132 survives only as a
  safety valve.
- **Aging is natural, never punishing.** Autumnal, gentle, renewal — no
  brown, no decay, no disease, no sad faces, no warning states, no
  message of any kind. *"This has had its time"*, not *"something bad
  happened"*. An aging leaf is a pale yellow-**green**, deliberately not
  gold: gold was the same hue as the flowers and the fruit, and a
  seventy-capture plant read as one yellow mass.
- **The life cycle never glows.** The light means NEW GROWTH and goes
  out as it settles; lighting an ending would dilute what the glow says
  and make it look like a reward. Aging is shown by colour and by
  movement, and by nothing else.
- **Falling is a real event**, not `visible:false` — detach, drift,
  rock, land, rest, fade. It animates the INNER group, because the outer
  carries the positioning attribute transform and a CSS transform there
  tears every blade off its vine. Disclosed: *a garden's very first fall
  is a short drop* (the oldest growth is the lowest, since the vine
  grows upward from the floor); the median fall crosses 41% of its band.
- **The step reports removals too** — `{ aged, fell, withered, removed }`
  beside `added` and `transformed`. Same extension `transformed` already
  was: the renderer must know which elements changed STATE, not only
  which appeared. Rendering stays pure — the phase palette is passed
  INTO the drawing vocabulary rather than painted on afterwards, so a
  settled garden carries no inline styles and two renders are still
  byte-identical.
- Disclosed: the growth record is local-first per device; a cloud row
  (the `creator_handwriting` pattern) is the follow-up when one garden
  should span devices. Handwriting cloud sync is push-only like the
  library's.

- `js/gardenEngine.js` · `js/gardenRenderer.js` ·
  `js/handwritingStore.js` · `js/handwritingStudio.js` ·
  `js/handwritingFont.js` · `tools/garden-test/run-garden-tests.js`.

### 28. The Public Identity Is Canon, and the Application Is Not a Document

Locked in the Discoverability & Entity Foundation sprint. It gives
VihuPlanet a machine-readable public identity; it changes nothing a
child sees.

- **`docs/VIHUPLANET_ENTITY_CANON.md` is the single source of every
  public description** — page copy, meta descriptions, Open Graph,
  JSON-LD, `llms.txt`. When public copy and it disagree, it wins; when
  it and this file disagree, this file wins and it gets corrected.
- **VihuPlanet is the brand and the parent of everything public.
  VihuStudio must never read as the parent brand** — it is the Hall of
  Creation inside VihuPlanet, and no public sentence may invert that.
- **The entity model**: VihuPlanet (parent) → the Ether · VihuStudio
  (→ Stories · Books · Characters · Story Worlds) · My Garden (→ My
  Drawings · My Letters). Stories are *made* in VihuStudio and *live*
  in VihuPlanet — a shared Story joins the Ether.
- **One public knowledge page, `/about`, anchored per entity** — not
  seven thin routes. An entity is promoted to its own page only when it
  has enough real public content to deserve one, recorded in
  `docs/INDEXING_POLICY.md`.
- **Machine discoverability is additive and invisible.** index.html
  gained head metadata only; its visible experience is bit-identical
  (verified by JS-disabled pixel comparison). No SEO UI, no keyword
  blocks, no visible change to the home experience, ever.
- **Public knowledge is indexed; the application is not.** `/` and
  `/about` are the index surface (the home is never noindexed, under
  any future change); `studio.html`, the legacy Hero at `/vihuplanet/`
  and the ether shim carry `noindex`; `/admin/`, `/tools/` and
  `/supabase/` are robots-disallowed. Every future application page
  gets `noindex` from its first commit.
- **Facts only, and canon's own language rules apply in public**: no
  invented founders, addresses, social accounts, ratings or claims;
  never "publish" child-facing; the language never blames; no
  counters, levels or comparisons in any public description.
- **JSON-LD is accuracy over amount** — stable `@id`s
  (`#vihuplanet` Brand, `#website` WebSite, `#vihustudio`
  WebApplication, `#my-garden` Thing), every reference defined
  in-graph, nothing marked up that is not on the page.
- **robots.txt welcomes OAI-SearchBot explicitly and never names
  Googlebot. GPTBot is blocked** — decided by the product owner after
  the sprint shipped (the sprint itself deliberately left it unset).
  Model-training crawls are refused; search and ChatGPT-search
  visibility are unaffected because OAI-SearchBot stays allowed.
- **Canonical URLs say `https://vihuplanet.com/`** — never the GitHub
  Pages hostname.
- ~~Disclosed: no og:image is set~~ — **closed.** The product owner
  supplied the real brand image (the living night universe with the
  VihuPlanet wordmark); it lives at `assets/brand/og-image.jpg`
  (1200×630) and is wired as og:image/twitter:image on `/` and
  `/about` and as the Brand node's `image` in both JSON-LD graphs.
  No twitter:site is set — still no real social account exists, and
  inventing one remains forbidden.
- Out of scope and not implemented: SEO content farming, blogs,
  keyword pages, analytics, search-ranking promises, and any change
  to the experience itself.
- `docs/VIHUPLANET_ENTITY_CANON.md` · `docs/DISCOVERABILITY_AUDIT.md` ·
  `docs/INDEXING_POLICY.md` · `docs/DISCOVERABILITY_TEST.md` ·
  `about.html` · `robots.txt` · `sitemap.xml` · `llms.txt`.

### 29. The Companion Notices, and Silence Is the Default

Locked by the product owner: *"lets start building it. i think companion
intelligence will need to be part of R1. we have already started giving
voices to companion. lets see how it looks."*

- **Companion Intelligence is in Release 1.** It joins Rites II and III
  (Decision 22) as R1 scope. `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md`
  is no longer a proposal awaiting approval; its Phases 0 and 1 are
  built, and its remaining phases keep the gates that document already
  put on them.
- **The Companion had a face and no eyes, and that was the whole
  problem.** Almost everything it needs already exists as structured
  data and was simply never routed to it. `js/companionContext.js`
  computes almost nothing — it projects what `PageRuntime`,
  `SlideRenderer`'s `_sceneObject()` normaliser and `PublishValidator`
  already own. **The validator is called, never reimplemented.**
- **Silence is the default and speech must be earned.** A Companion
  that comments on everything stops being company and becomes a
  notification system, which `docs/COMPANION_CANON.md` already forbids
  (*"not an assistant, a chatbot, a teacher, or an AI tutor"*). Four
  hard limits sit above every rule: **Traveller silence is absolute**
  and is a GATE AT THE TOP rather than a filter at the end; a settling
  window on arrival; a cooldown; and **novelty — a rule speaks at most
  once per session**, which is what bounds a session rather than a line
  counter.
- **One clock, never two.** Every line the Director speaks is reported
  to the Brain, and the Brain also starts its own cooldown when it
  decides to speak — *a Brain whose restraint depends on somebody else
  remembering to tell it the time is not restrained, it is lucky.*
- **Six of the ten capabilities need no AI at all**, and they are the
  ones a child feels most. Phase 0 and Phase 1 introduce no model, no
  backend, no new dependency and no privacy question.
- **`personality.json`'s `neverSays` is no longer inert.** Every line is
  checked against the loaded package's list and a forbidden line is
  **dropped rather than softened** — rewriting somebody's authored
  policy line is how a voice drifts. A package's own `lines` map
  overrides platform copy, so adding a companion stays a zero-code act.
- **The Engine is untouched and stays frozen.** Every capability goes
  through its existing API. `js/companionDirector.js` remains the ONE
  Studio-aware file; its `MODES` table became the Brain's baseline
  rather than the whole decision. No second companion system.
- **Fail-open is structural, not a setting.** `CompanionContext` owns no
  state, and `PageRuntime.observe()` is a dispatch that already fired on
  every mutation — **no polling was introduced**. With both modules
  removed at runtime the Studio still works; verified, not asserted.
- **A scripted pose is protected briefly from ambient reaction.**
  Otherwise the mutation that triggers a celebration immediately
  overwrites it and nobody ever sees it.
- **Still gated, and the gates are not formalities.** Phase 3 (the Model
  Gateway) requires its own explicit, recorded product decision about
  children's creative content leaving the device — the architecture's
  highest-rated risk. Phase 4 (the Companion performing an action) is
  gated on **global undo existing**, which nothing in this codebase has.
- **Creative suggestion is out of scope permanently**, not deferred:
  the moment a Companion suggests what happens next, the story stops
  being wholly the child's.
- Out of scope and not implemented: multi-turn chat UI, persistent
  cross-session memory, voice input, companion-generated story content,
  and any Companion configuration surface.
- `js/companionContext.js` · `js/companionBrain.js` ·
  `tools/companion-test/run-companion-tests.js` ·
  `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md`

### 30. A Companion Remembers What Was Shared, and Nothing Else

Locked by the product owner in the Companion Intelligence Foundation
brief, after three discovery sprints mapped the target against the real
codebase. It **amends Decision 29**, whose out-of-scope list named
"persistent cross-session memory", and it amends
`docs/COMPANION_CANON.md` → Canon 5 in three places. Nothing in it is
built yet beyond the canon and the security foundation; the rest is
the standard this product will be held to when it is.

- **A Companion may remember meaningful experiences, conversations and
  creations shared with its Creator, across sessions and across
  devices.** That is what makes a bond rather than a greeting, and it
  is the whole reason this decision exists. Canon 5's own "may not"
  column said the opposite in as many words — *"Remember the child
  across sessions"* — so that row was replaced rather than reinterpreted,
  the way Decision 26 amended Decision 25 deliberately and said so.
- **Memory is of meaningful moments, never a log of everything the
  Creator does.** The replacement row reads *"Keep a general record of
  everything the Creator does"*, because the thing being forbidden was
  never memory — it was surveillance, and a Companion that recorded
  every action would be surveillance wearing a friendly face. What is
  kept is a small set of moments a person would actually recount;
  what is not meaningful is not remembered.
- **A Companion may hold an opinion about the WORLD; never about the
  WORK.** *"I think Spark would have run"* is a friend having a view
  about a character, and a child is free to disagree with it. *"Your
  ending is weak"* is a judgement of the child's making, and it sits in
  the same column as score, grade, rank and critique — where Canon 5
  already put those. The test is which one the sentence is about: the
  story's world, or the child's making of it. Decided because the target
  experience walks straight up to that line — the child says *"I don't
  like this ending"* and the Companion is meant to answer with an
  opinion — and without the distinction the next sentence written would
  have been a review of a five-year-old's story.
- **The Studio never depends on an external model, and the canon
  sentence that guaranteed it was narrowed rather than weakened.** Canon
  5's *"must work with no network and no AI"* was written about the
  GUIDE responsibility, and it still binds there completely. Conversation
  is a separate capability that may use a model; when the model is
  unreachable the Companion is simply quiet and everything else — the
  Guide, the poses, the voice, the whole Studio — carries on exactly as
  it did. Silence is a correct answer here for the same reason it
  already is in `js/vihuVoice.js`.
- **Option B is the LLM context boundary, and it is a COMPONENT rather
  than a discipline.** A request carries the current conversation, the
  Companion's personality, the relevant slice of VihuPlanet Canon, the
  relevant memories and the relevant current world/story context — and
  it is assembled and filtered by a **Privacy / Relevance Gate** that is
  the only thing permitted to call the model. Not a rule somebody
  remembers to follow: the transport module is reachable from the gate
  and from nowhere else, the same way `EtherHost`'s reserved row is
  geometry rather than a z-index and some judgement (Decision 24).
- **Stored memory is not automatically shareable memory.** Every memory
  passes the relevance filter before it can travel. A Companion that
  posted its whole memory of a child to a third party on every sentence
  would be the surveillance this decision just forbade, arriving through
  the back door.
- **The initial content depth is TIER 3: the prose of the CURRENT PAGE
  only.** `slide.storyBeat` / `slide.storyDraft` for the page the child
  is looking at, plus names and structure (story names, character names
  from `CreatorLibrary`, page counts, object labels). Not every page,
  not every story, not the library wholesale. Chosen because Tier 2 —
  names alone — cannot answer *"I don't like this ending"* with anything
  true, and Tier 4 sends a child's entire body of work to answer one
  question about one page. **The ceiling is ONE constant in the gate**,
  so raising or lowering it is a one-line, reviewable change and never a
  drift.
- **Images never leave VihuPlanet.** No image bytes, no data URLs, no
  `vihu-asset:` references, no signed Storage URLs — not to a model, not
  to any third party, permanently. A child's drawing of their own house
  is the most identifying thing in this product and the least necessary:
  *"there is a picture on this page"* costs the model nothing and gives
  away nothing.
- **OpenAI is an intelligence service, never the Companion's memory
  store.** VihuPlanet remains the source of truth for what happened,
  what exists, who owns it and what may be said. The model may interpret
  reality; it may not manufacture it. A memory it proposes is a
  proposal — the application validates it against real local records
  before anything is stored, and a memory naming a story or a character
  that does not exist is refused rather than softened, the same way
  `personality.json`'s `neverSays` drops a line rather than rewriting it.
- **Security hardening comes BEFORE any paid model endpoint, and it is
  not a formality.** The audit found that no Edge Function in the
  product derived its caller from the session: they were reached with
  the PUBLIC anon key (served from `supabase-config.json` on a public
  site, from a public repository), and `sky-protection` trusted a
  client-supplied `identityId` well enough to write a parent's address
  onto a stranger's Magic Card and post that card to them. A
  conversation endpoint copying that pattern would have been a free,
  world-callable, metered LLM. The pattern is now one shared module:
  **the caller is derived from the verified session and client-supplied
  identity is never trusted for ownership.**
- **VERIFIED IN PRODUCTION, not just in a suite.** The migration was
  applied and all five functions deployed, and the public anon key —
  the exact credential every client used to send — was run against the
  four browser-facing ones. All four answered
  `401 {"ok":false,"reason":"unauthorized"}`; all four answered 200 to
  that same key the day before. `creator-born` is not in that list
  because it carries no CORS headers at all: nothing in a browser may
  reach it, which is a stronger result than a 401.
- **Rate limiting exists before the endpoint that needs it**, in
  Postgres, with one configuration point. No Redis, no external service,
  no second database — the same posture every other decision here takes
  toward infrastructure that has not proved it is needed.
- Out of scope and not implemented by this decision: the memory store
  itself, Bond Moment detection, the Companion Mind, `companion-chat`,
  any OpenAI call, any Companion input surface, Companion autonomy,
  Companion ↔ Companion, and any change to Companion behaviour.
- **Companion-initiated actions remain blocked on global undo**, which
  this codebase does not have (verified: undo is per-tool only; even
  page deletion warns that it *"cannot be undone"*). That gate is
  `docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §7.4's and it is
  unchanged.
- **The gate is ONE module, INLINED into each function — one file, no
  imports.** Two attempts at fewer copies both failed on the real
  deploy, and both are recorded because both were measured. `_shared/`
  is a CLI-only bundling convention and is not carried by a Dashboard
  deploy: *Module not found "file:///tmp/user_fn_…/_shared/edgeAuth.js"*.
  A sibling `./edgeAuth.js` then worked for three functions and not the
  other two, where the second file *"just keeps vanishing"* from the
  editor — **and an EMPTY file vanishes too**, so it is neither size nor
  content: those functions simply will not take a second file. A file
  that cannot be added cannot be depended on, and one file cannot
  half-arrive. It is also what every function in this repository was
  before this sprint touched them.
- **This project deploys single-file from the Dashboard, and it already
  had a convention for it.** `family-album/dashboard-paste.ts` —
  *"index.ts + parse.js merged into ONE file, for deploying via the
  Supabase Dashboard's in-browser editor (no CLI needed)"* — was sitting
  in that folder the whole time. Finding it three attempts late is why
  there were three attempts; the deploy path is a property of the project
  and should have been read before `_shared/` was introduced.
- **A hand-mirrored copy of a security boundary is a promise nobody can
  keep.** That file's own note said to keep it in lockstep BY HAND, and by
  the time this sprint hardened `index.ts` it carried no gate at all — so
  pasting it would have deployed an UNHARDENED function, which is worse
  than a failed deploy because it looks like success. It is generated now:
  `index.ts` with every local import inlined, and a function with nothing
  local to inline gets no variant at all, because a duplicate of
  `index.ts` would be one more thing to keep in step.
- **The inlined block is generated, and the deployed code is what is
  tested.** `_shared/edgeAuth.js` stays the readable original with every
  decision explained; `node tools/edge-auth-test/sync-shared.js` writes
  it into each `index.ts` between markers, with full-line comments
  removed and `export` dropped. The suite asks the REAL generator whether
  anything drifted — a second copy of the rule in the test could disagree
  with the thing that writes the files — and then EXTRACTS the block from
  a real `index.ts`, imports it, and re-runs the gate's own assertions
  against it. What is proved is the code that actually deploys.
- **Two things can fail SILENTLY once this is live, so a file looks for
  them.** Everything else about the hardening fails loudly — a browser
  that cannot authenticate gets a 401 it can see, and a child hears
  silence instead of a voice. Not these: `creator-born` is service-only
  now, and its only caller sends whatever key sits in
  `platform_settings.creator_born_key` — the ANON key worked there before
  and does not now, and the symptom is no email when a child becomes a
  Creator. `invite-send` is administrators-only, so an empty
  `platform_admins` refuses everybody. `supabase/verify_edge_auth_deployed.sql`
  answers both in one word each, and decodes only the `role` claim out of
  the stored JWT — the key itself never reaches the result, because
  reading a secret out of the database and putting it on screen would be
  a worse habit than the one this sprint fixed.
- **A migration is inert; its verification is a separate file.** Reported
  by the product owner running the migration and reading its own first
  probe — `{"allowed": true, "remaining": 1}` — as an error. It was the
  check passing. The Supabase SQL Editor shows ONE result panel, so a
  script ending in four similar JSON blobs cannot be told from a failure
  at a glance, and those probes wrote rows into the live table to produce
  them. `supabase/verify_edge_rate_limit.sql` now answers in one word per
  check with an overall verdict on top, writes to a reserved bucket no
  Edge Function uses, and deletes what it wrote — so it is safe to run on
  a live project at any time. The migration returns nothing at all.
- `docs/COMPANION_CANON.md` → Canon 5 ·
  `supabase/functions/_shared/edgeAuth.js` ·
  `supabase/migrations_edge_rate_limit.sql` ·
  `supabase/verify_edge_rate_limit.sql` ·
  `tools/edge-auth-test/run-edge-auth-tests.js`

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
