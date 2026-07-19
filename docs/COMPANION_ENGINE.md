# Companion Platform (technical reference)

> Frozen foundation: the Companion Package Contract and the
> CompanionEngine public API. Extending real capability later (sprite
> animation, sound, AI conversation, ...) must happen *behind* this
> contract and this API, never by widening either — see "Future Ready."
> For the product-level canon (what a Story Egg / Lumo *are*, and the
> Creator Lifecycle) see `docs/COMPANION_CANON.md` — this document is
> the "how," that one is the "why."
>
> **Companion Canon Freeze & Asset Integration sprint** — this file's
> most recent update — is explicitly a canon-alignment sprint, not a
> runtime sprint: `js/companionEngine.js` was **not touched, not one
> line**. Every change below is either data (a `companion.json`/
> `registry.json` edit, a new Story Egg package) or Studio-integration
> logic in `js/companionDirector.js` (a small, data-driven Visitor/
> Creator `MODES` table — see "CompanionDirector — Studio integration"
> below).

## Product Philosophy

A companion is **not** an assistant, a chatbot, a teacher, or an AI
tutor. A companion is a **creative friend**. Its purpose is to
encourage imagination, celebrate creativity, and make the Studio feel
alive. A companion never critiques or scores a child's work — nothing
in this engine generates speech on its own that could do so (every
message spoken is static, curated, human-authored text), so there is
nothing here to police; a package's own `personality.json` `neverSays`
list is authored policy data for a **future** AI-driven speech feature
to respect, disclosed as currently inert.

A Visitor is not yet a Creator and has no companion — see
`docs/COMPANION_CANON.md`'s Canon 1/3 for the full Story Egg / Creator
Lifecycle account this section only summarizes technically.

## Architecture — three layers, each knowing only what it needs to

1. **Companion Package** (`assets/<id>/`) — pure data. A
   `companion.json` manifest (required), an optional `personality.json`
   (traits/role/greetings/neverSays), an optional `animations.json`
   (state-transition/duration table), plus one PNG per declared state.
   Knows nothing about code.
2. **Companion Engine** (`js/companionEngine.js`, `window.CompanionEngine`) —
   a generic runtime class. Knows the Companion Package Contract and
   nothing else — it has **zero** knowledge of any specific companion
   id, or of the Visitor/Creator distinction at all. There is no
   `if (id === 'lumo')` / `if (id === 'story-egg')` anywhere in this
   file, and there never should be (verified via a comment-stripped
   static scan, part of every Companion sprint's own test suite).
3. **Companion Director** (`js/companionDirector.js`, `window.CompanionDirector`) —
   the one place in the codebase allowed to know Studio-specific
   moments (boot, typing, artwork inserted, published, idle/sleep, a
   Magic Card being claimed, a Studio dialog being open) and translate
   each into a generic `CompanionEngine` call. Which registered entity
   id to actually load is resolved by matching a small `MODES` table's
   own `role` value against `assets/registry.json`'s own
   `role` field — see "Visitor vs. Creator mode" below — never a
   hardcoded id, except for the one, final, disclosed `'lumo'` literal
   used only if the registry is entirely unreachable.

```
assets/registry.json  ─┐
assets/lumo/           ├─►  js/companionEngine.js  ─►  js/companionDirector.js  ─►  Studio
assets/story-egg/      │        (generic runtime)         (Studio-specific:
  companion.json (required)       │                                   Visitor/Creator MODES,
  personality.json (optional)     │                                   registry role lookup)
  animations.json (optional)      │
  *.png                          ─┘
```

## The Companion Package Contract

### `companion.json` (required)

```json
{
  "id": "lumo",
  "name": "Lumo",
  "species": "Story Dragon",
  "version": "1.1",
  "defaultState": "idle",
  "states": {
    "hero": "hero.png",
    "idle": "idle.png",
    "wave": "wave.png",
    "curious": "curious.png",
    "think": "think.png",
    "celebrate": "celebrate.png",
    "sleep": "sleep.png"
  }
}
```

- `id`/`name`/`species`/`version`/`defaultState`/`states` are all
  required; `load()` rejects a package missing any of them, or whose
  `defaultState` has no matching entry in `states`.
- `states` may name any state vocabulary the package wants — each
  entity's own 7-pose canon (Canon 1/Canon 2 in `docs/COMPANION_CANON.md`)
  is product data, not a hardcoded requirement enforced anywhere in the
  engine. A package may also declare a `"blink"` state (see "Micro
  polish" below) — inert unless present.
- `hero` is now a real, addressable pose in `states` (both Lumo's and
  Story Egg's canon lists name it) rather than the pre-canon
  convention of a decorative, off-cycle portrait file — no Studio
  event currently triggers it; it's reserved for a future presentation
  surface (e.g. a "Meet Lumo"/"Meet your Story Egg" moment) that isn't
  built yet.
- Every file `companion.json` names must exist as a real PNG at
  `assets/<id>/<file>` — the engine preloads every declared
  state's image before `load()` resolves; one broken/missing image
  degrades gracefully (falls back to a broken-image glyph for that one
  state) rather than failing the whole package.

### `personality.json` (optional)

```json
{
  "name": "Lumo",
  "role": "Guardian of Story Companions",
  "traits": ["Kind", "Curious", "Playful", "Encouraging", "Gentle"],
  "neverSays": ["Wrong", "You can't", "That's bad"],
  "greetings": ["Let's imagine!", "Ready to create?", "I love new ideas!"]
}
```

`CompanionDirector`'s own boot greeting picks one of `greetings` at
random (falling back to a hardcoded default only for a package with no
`personality.json` at all) — a little authored variety with zero
Director knowledge of what the words actually say. `traits`/`role`/
`neverSays` are pure descriptive/policy data, read via
`engine.getPersonality()`, not consulted by any other code path.
`role` was updated this sprint from "Creative Friend" to "Guardian of
Story Companions," matching Canon 2's frozen role exactly — a plain
data value change, the schema itself is unchanged. Story Egg has no
`personality.json` at all: Canon 1's "never speaks" is enforced
structurally, by `CompanionDirector`'s own `MODES.visitor.speaks:false`
flag — never by the accident of a missing file (see "CompanionDirector
— Studio integration" below).

### `animations.json` (optional)

```json
{
  "transitions": { "wave": "idle", "talk": "idle", "celebrate": "idle", "sleep": "idle" },
  "durations": { "wave": 3000, "celebrate": 2000 }
}
```

This is what makes state timing **package-driven instead of
hardcoded**: `setState(state)` checks `durations[state]`; if present,
it schedules an automatic `setState(transitions[state])` after that
many milliseconds (cancelled/rescheduled by any later `setState()`
call). A state with a `transitions` entry but no `durations` entry
(`sleep`, `talk`) never times out on its own via `setState()`'s own
timer — `talk` instead settles via `speak()`'s own bubble-dismiss
timer, per that method's own doc comment, and `sleep` ends only via an
explicit next state change. A package with no `animations.json` at all
behaves exactly as a bare `companion.json` package always has — every
state just persists until the next explicit `setState()` call.
`js/companionDirector.js` has **zero** hardcoded companion-animation-
timing constants — all of that timing lives in this file, read at
runtime. (`talk` is real, canonical Lumo art — kept, not retired, once
the real asset upload arrived as a superset of Canon 2's own 7-pose
list; Director's own choreography still never sets it directly — see
"Canon Alignment changes" below.)

Story Egg's own `animations.json`:

```json
{
  "transitions": { "excited": "idle", "hatching": "idle" },
  "durations": { "excited": 2000, "hatching": 3000 }
}
```

`excited`'s duration mirrors Lumo's own `celebrate` timing exactly
(2000ms) for parity between the two entities' "something exciting just
happened" pose. `hatching` gets a slightly longer duration (3000ms,
matching Lumo's own `wave`) as a disclosed safety net: the Awakening
ceremony only ever shows on a Visitor's very *first* Publish
(`MagicCard.shouldOfferAwakening()`'s own once-per-browser gate,
unchanged by this sprint) — a Visitor who declined it once and keeps
publishing would otherwise leave the Egg stuck mid-`hatching` forever,
since no ceremony ever reopens to explicitly settle it (see
`notify('ceremony-closed')` below, which also explicitly settles it
for the case where the ceremony genuinely does reopen and closes
without a claim).

## Visitor vs. Creator mode

`js/companionDirector.js` decides which entity to boot by reading
`MagicCard.getActive()` (Studio's own existing Magic Card Identity
Evolution state — unchanged, un-redesigned): a truthy result means
**Creator** mode, anything else means **Visitor** mode, the safe
default. This is the *only* place this file reads Studio-specific
state to make that call.

The whole Canon is then expressed as one small data table,
`MODES` — never as literal id branches:

```js
const MODES = {
  visitor: {
    role: 'visitor', speaks: false, bootPose: 'idle', wakePose: 'idle',
    poses: { typing: 'curious', creating: 'thinking', artwork: 'excited', publish: 'hatching' }
  },
  creator: {
    role: 'guardian', speaks: true, bootPose: 'wave', wakePose: 'wave',
    poses: { typing: 'curious', creating: 'think', artwork: 'celebrate', publish: 'celebrate' }
  }
};
```

`role` is matched against each `registry.json` entry's own `role`
field to resolve which entity id actually loads for the current mode
— `js/companionEngine.js`'s `loadRegistry()` itself is unmodified; only
the two registry entries gained this one new, optional field. A third,
future mode/role (e.g. a personal-companion `role: 'personal'`, Canon
3's own final lifecycle stage) needs only a new `MODES` entry and a new
registry entry — no engine change, no change to how existing modes
resolve.

**The complete choreography, per mode:**

| Studio moment | Trigger | Visitor (Story Egg) | Creator (Lumo, the Guardian) |
|---|---|---|---|
| Studio opens | `CompanionDirector.init()`, called from `js/app.js`'s `_beginBoot()` — deliberately *after* the Magic Card Identity Gate resolves (see "A real, disclosed timing fix" below) | `idle`, no speech | `wave` + a random `personality.json` greeting → `idle` after 3s |
| User starts creating | `notify('story-started')` (`js/creationFlow.js`'s `_finish()`) | `thinking`, no speech | `think` + "I can't wait to see your story!" |
| User types | a document-level delegated `input` listener, 4s cooldown | `curious`, no speech | `curious` + no speech (typing has never spoken, in either mode) |
| Artwork inserted | `notify('artwork-added')` (`js/contextPanel.js`'s `_applyImageResult`) | `excited` → `idle` after 2s, no speech | `celebrate` + "That looks magical!" → `idle` after 2s |
| Story published | `notify('published')` (`js/publishStudio.js`'s `_finalizePublish`) | `hatching` → `idle` after 3s (safety net), no speech | `celebrate` + "Your story is ready!" → `idle` after 2s |
| No interaction for 2 minutes | a global activity listener's own idle timer (Studio policy, `IDLE_SLEEP_MS`, identical for both modes) | `sleep()`, no speech | `sleep()`, no speech |
| User interacts again | the same activity listener, from `sleep` | `idle` (no "just woke" flourish pose exists for a limbless Egg), no speech | `wave` + "Welcome back!" → `idle` after 3s |
| A Magic Card is claimed or recalled | `notify('creator-born')` (`js/magicCard.js`'s `claim()`/`adopt()`) | *(mode transition — see below)* | — |
| The Awakening ceremony closes (any outcome) | `notify('ceremony-closed')` (`js/magicCardUI.js`'s `_finishAwakening()`) | settles a lingering `hatching` back to `idle` if still Visitor | no-op (already handled by `creator-born`) |
| A Studio dialog opens (restore/theme-picker/Publish/Magic Card) | a `MutationObserver` watching a small, disclosed set of overlay containers | `hide()` (both modes — restored via `show()` once the dialog closes, only if it was visible before) | |

**`notify('creator-born')`** is Canon 3's literal "Magic Card → Lumo
Ceremony → Creator" step, made real: it swaps the *active entity*
itself, via the exact `unload()` + `load()` pair
`docs/COMPANION_ENGINE.md`'s own prior-sprint text already named as
ready for "a future switch companion UI with zero flicker" — the Story
Egg is unloaded, Lumo is loaded in its place on the *same* engine
instance/DOM widget, and Lumo's own boot choreography (`wave` + a
greeting) runs immediately. Because this always fires from inside the
Magic Card overlay's own claim/recall flow, the overlay is already open
— the dialog-occlusion watcher (unchanged) already keeps the whole
swap invisible until that overlay itself closes, so no new "reveal"
choreography was needed.

**A real, disclosed timing fix, found doing this sprint's own
work**: `CompanionDirector.init()` previously ran unconditionally, at
the very top level of `js/app.js`'s boot sequence, *before* the Magic
Card Identity Gate (`MagicCardUI.checkIdentityGate`) — an async,
user-gated flow — ever resolved. Since introducing a real Visitor/
Creator *mode* distinction this sprint (the pre-canon Director always
booted Lumo for everyone, so this timing never mattered before), that
ordering became a genuine bug: `MagicCard.getActive()` could still
reflect a *stale* previously-active card at the exact moment `init()`
ran, even on a shared device where the gate is about to let someone
choose "Begin Exploring." Fixed by moving the `CompanionDirector.init()`
call into `_beginBoot()` itself — which only ever runs *after* the
gate has resolved (a specific card pick, or Explore) — so mode
detection always reflects the settled, correct state. A second, real,
disclosed bug surfaced by tracing this exact path: `js/magicCardUI.js`'s
`proceed(cardId)` only ever called `MagicCard.setActive(cardId)` when
`cardId` was truthy, so choosing "Begin Exploring" left whatever card
was *previously* active still marked active in `localStorage` — fixed
to unconditionally call `MagicCard.setActive(cardId||null)`, which
already correctly clears the active pointer when passed `null` (that
capability already existed; only the call was missing).

## CompanionEngine — public API (frozen, unchanged this sprint)

```js
const lumo = new CompanionEngine();       // opts: {assetsBase, speakDurationMs}
await lumo.load('lumo');                  // fetches + validates + preloads companion.json/personality.json/animations.json
lumo.show();                              // mounts (once) and reveals the widget, fading in
lumo.setState('wave');                    // swaps the displayed image; auto-reverts per animations.json if declared
lumo.getState();                          // 'wave'
lumo.speak("Let's imagine!");             // shows a speech bubble, auto-dismisses
lumo.wake();                              // semantic setState('wave') — "the user came back" (Lumo only — see below)
lumo.sleep();                             // semantic setState('sleep') — universal across every entity's canon
lumo.hide();                              // hides (fades out) without discarding state
lumo.unload();                            // discards the loaded package + hides; DOM widget stays mounted for reuse
lumo.destroy();                           // full teardown, DOM removed
```

`setState()` on an unknown state name never throws — it falls back to
the package's own `defaultState` with a console warning. `load()` of a
missing/invalid package rejects cleanly (a real `Promise` rejection,
never a synchronous throw or a hang). `unload()` then a fresh `load()`
reuses the same mounted widget rather than rebuilding it — exactly the
mechanism `notify('creator-born')` above uses to swap Story Egg → Lumo
with zero flicker.

`CompanionDirector` no longer calls `engine.wake()` directly (its
convenience shape is hardcoded to `'wave'`, a pose the Story Egg
doesn't declare) — it calls `engine.setState(cfg.wakePose)` instead,
reading the current mode's own wake pose from `MODES`. `wake()` itself
is completely unchanged and still a valid, documented public method —
Director simply now has finer-grained needs (mode-aware pose + only-
sometimes speech) than that one convenience wrapper alone provides.
`sleep()` stays directly usable from Director since `'sleep'` is
common to both entities' canon.

`CompanionEngine.loadRegistry(assetsBase?)` (a **static** method,
unchanged) reads `assets/registry.json` and resolves the
`companions` array (`[]` on any failure, never rejects).

## Companion UI (unchanged this sprint)

- **Floats above Studio UI, never blocks controls**: the whole widget
  is `pointer-events:none` except the small portrait circle itself
  (the one draggable/hoverable surface).
- **Draggable, remembers position per session**: `sessionStorage`
  (`vihu-companion-widget-position`), restored within the same tab.
- **Automatically avoids overlapping dialogs or menus**: unchanged;
  the same `BUSY_SELECTORS` list now also implicitly covers every
  Magic Card mode (Gate/Awakening/Home all share `#magicCardOverlay`).
- **show()/hide()**: a real CSS opacity/transform/visibility fade.

## Micro polish (unchanged this sprint)

Fade in/out, idle breathing, a hover reaction, a talk pulse, a
celebrate bounce, a sleep "Zzz" indicator, and a future-ready
(currently inert for both Lumo and Story Egg) random blink loop gated
on a package declaring a `"blink"` state. All CSS/Canvas, all respect
`prefers-reduced-motion`. See the prior sprint's own full write-up,
unchanged by this one.

## Asset Status, disclosed

Real canonical art for both entities has been uploaded to the repo
root's `assets/` folder — the location named in the sprint's own
literal "Expected structure" — not nested under `assets/companions/`.
An earlier draft of this integration mistakenly assumed the nested
path (a misreading of the same sprint's own prose describing the
package *shape*, not its *location*); this was corrected the moment
the real upload landed and made the mismatch impossible to miss (see
"Canon Alignment changes" below for the full correction).

**Lumo** (`assets/lumo/`) — 8 real, uploaded PNGs: `hero`/`idle`/
`wave`/`curious`/`think`/`talk`/`celebrate`/`sleep` — a genuine
superset of Canon 2's own 7-pose list (`talk` included). Since this is
real, immutable canonical art, not a placeholder standing in for
something better, `talk` was kept rather than trimmed to match the
Canon list exactly — no engine or Director code sets `talk` directly
today, but the file isn't orphaned either: `companion.json` declares
it, and `speak()`'s own pre-existing settle-after-bubble mechanism
already understands it. The prior sprint's own Canvas-drawn
*placeholder* Lumo art (7 PNGs, no `talk`) has been deleted outright,
fully superseded.

**Story Egg** (`assets/story-egg/`) — 6 of Canon 1's 7 real, uploaded
PNGs: `idle`/`curious`/`thinking`/`excited`/`sleep`/`hatching`.
`hero.png` is the one file from that list not yet uploaded —
`companion.json` still declares it (matching Canon 1's own frozen list
exactly), and the engine's own existing, unmodified behaviour degrades
gracefully for a missing state image (a 404, no crash) exactly as it
already does for any package missing one of its own declared files.
**The moment `hero.png` is uploaded, nothing else needs to change** —
the registry entry, `companion.json`, Director's `MODES.visitor`
choreography, and every test are already wired against it.

## Future Ready

Every public method is written so a later version can grow real
capability without widening the public API:

- `setState()` could ease-crossfade, drive a sprite-sheet animation, or
  play a state-specific sound clip instead of a hard image swap.
- `speak()` could grow a typewriter effect or TTS.
- `show()`/`hide()` already have real CSS motion; a later version could
  add more elaborate entrance/exit choreography with no signature change.
- A future package could declare particle effects or richer per-state
  data — `load()`/`_validatePackage()` already treat unknown extra
  fields as inert, so this needs no contract-breaking change.
- `personality.json`'s `neverSays` is ready for a future AI-conversation
  feature to respect; nothing enforces it today since nothing generates
  unscripted speech.
- A future personal companion (Canon 3's own final lifecycle stage,
  "Future Personal Companion") is expressible as one more Companion
  Package plus one more `registry.json` entry with its own `role` —
  no engine change, and `MODES` in `js/companionDirector.js` would gain
  one more small entry, still no `if (id === ...)` branch anywhere.

## Adding a Second (or Third) Companion

Reachable today with zero engine changes. Story Egg itself is now the
real, non-hypothetical proof (registered, resolved by role, real art
for 6 of its 7 poses) — but genericity was also re-verified this
sprint with
the same hand-authored throwaway `nimbus` test package the prior
sprint used (never mentioned anywhere in `js/companionEngine.js`/
`js/companionDirector.js`):

```
assets/nimbus/
  companion.json   -- {id:"nimbus", name:"Nimbus", species:"Cloud Spirit", ...}
  idle.png
  happy.png         -- a state neither Lumo nor Story Egg even have
```

```js
const nimbus = new CompanionEngine({assetsBase:'assets/'});
await nimbus.load('nimbus');
nimbus.setState('happy');   // works — the engine only reads companion.json's own states map
```

Making a companion serve a given mode is a `registry.json` edit
(`role: 'visitor' | 'guardian' | ...`) plus, for a genuinely new mode,
one small `MODES` entry in `js/companionDirector.js` — never a change
inside `js/companionEngine.js`.

## Canon Alignment changes (this sprint), summarized

- `assets/lumo/companion.json` — `states` updated to add `hero` as a
  real state (matching Canon 2), keeping `talk` (real, uploaded art —
  see "Asset Alignment correction" below); `version` bumped `1.0`→
  `1.1`.
- `assets/lumo/animations.json` — `transitions.talk` kept, settling to
  `idle` (unchanged from before this sprint).
- `assets/lumo/personality.json` — `role` updated to
  "Guardian of Story Companions."
- `assets/story-egg/` — new package: `companion.json` +
  `animations.json` (real, registered); 6 of its 7 pose PNGs are also
  real and uploaded (disclosed above).
- `assets/registry.json` — both entries gained a `role`
  field (`guardian`/`visitor`); Story Egg added as a second entry.
- `js/companionDirector.js` — rewritten around the `MODES` table
  above; zero change to `js/companionEngine.js`.
- `js/magicCard.js` — `claim()` and `adopt()` each gained one
  defensive `CompanionDirector.notify('creator-born')` hook.
- `js/magicCardUI.js` — `_finishAwakening()` gained one defensive
  `CompanionDirector.notify('ceremony-closed')` hook; `proceed()`'s
  "Begin Exploring" bug (above) fixed.
- `js/app.js` — `CompanionDirector.init()`'s call site moved into
  `_beginBoot()` (the timing fix above); zero other boot-sequence
  change.

### Asset Alignment correction (same sprint, immediately following)

The sprint's own instruction described the expected upload as flat,
repo-root folders — `assets/lumo/` and `assets/story-egg/` — but an
earlier draft of this integration read that as shorthand for the
package *shape* used elsewhere in this document and placed everything
under `assets/companions/<id>/` instead, generating placeholder Canvas
art for Lumo in the process (7 poses, `talk` excluded, matching a
first, too-narrow reading of Canon 2's own pose list). Once the real
asset folders were uploaded to their real location (`assets/lumo/`,
`assets/story-egg/`), the mismatch was corrected in the same sprint,
before shipping: `js/companionDirector.js` now constructs
`CompanionEngine` with `{assetsBase:'assets/'}` (the one, disclosed
override point — `js/companionEngine.js` itself keeps its own
`'assets/companions/'` default, untouched, since the engine stays
generic about where any caller's packages happen to live) and calls
`loadRegistry('assets/')` to match; every JSON data file
(`companion.json`/`personality.json`/`animations.json`/`registry.json`)
was moved to sit beside the real uploaded PNGs; the placeholder Lumo
art and the now-empty `assets/companions/` folder were deleted
outright, fully superseded. Lumo's real upload turned out to be a
genuine 8-pose superset of Canon 2's 7-pose list (`talk` included) —
kept, not trimmed, since it's real canonical art, not a placeholder to
be pared down to spec.

## Critical Files

- `assets/registry.json` — the installed-companions
  listing, with a `role` field per entry.
- `assets/lumo/` — `companion.json` + `personality.json` +
  `animations.json` + 8 real PNGs.
- `assets/story-egg/` — `companion.json` +
  `animations.json`; 6 of 7 real PNGs uploaded, `hero.png` pending
  (disclosed above).
- `assets/lumo/README.md`, `assets/story-egg/README.md` — each
  package folder's own asset-folder README, matching this repo's
  established convention.
- `js/companionEngine.js` — the generic runtime (frozen public API,
  **untouched this sprint**).
- `js/companionDirector.js` — Studio's own choreography/integration
  layer: the `MODES` table, mode detection, entity-swap on
  `creator-born`, and the dialog-occlusion watcher.
- `css/style.css`'s `.companion-*` rules — the widget's visual shell
  (unchanged this sprint).
- Hook sites: `js/app.js`'s `_beginBoot()` (boot, moved this sprint),
  `js/creationFlow.js`'s `_finish()`, `js/contextPanel.js`'s
  `_applyImageResult()`, `js/publishStudio.js`'s `_finalizePublish()`,
  `js/magicCard.js`'s `claim()`/`adopt()` (new this sprint),
  `js/magicCardUI.js`'s `_finishAwakening()` (new this sprint).
- `docs/COMPANION_CANON.md` — the frozen product canon this file
  implements.
