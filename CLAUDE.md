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
  once**, gently, about a fifth of the turn a child gets from holding
  the pointer at the edge. That turn is the teaching — nothing on the
  screen says the universe can be looked around, so the first thing it
  does is the exact thing they can do to it. Both use seams the runtime
  already exposes (`ambient.shootNow()`, `camera.look()`), so no file
  under `vihuplanet/runtime/` changed, which is Decision 9's own test.
  Suppressed under `prefers-reduced-motion`.
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
- Out of scope and not implemented: parent accounts, email/password
  login, OTP verification, family dashboards, child management, cloud
  profile management and Creator accounts.

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
- **A phone is told from a computer by TWO signals, both of which must
  agree** (`js/deviceGate.js`): the primary pointer is coarse, AND the
  SCREEN's short edge is under `MIN_SHORT_EDGE` (768). Never the user
  agent — a string anybody can set, which lies by default on iPad.
  Never window width alone: a laptop with a narrow window is still a
  laptop and must not be locked out of its own Studio. A 1280×720
  laptop fails the size test and passes on its pointer, which is the
  whole reason there are two. **Tablets are allowed** — an iPad's short
  edge is 834.
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
