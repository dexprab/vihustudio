# Companion Platform v1 (Sprint C1, Lumo v1)

> Frozen as of this sprint. The Companion Package Contract (§ below)
> and the CompanionEngine public API (§ below) are the canonical
> foundation for every future VihuPlanet companion. Extending real
> capability later (sprite animation, sound, AI conversation, ...)
> must happen *behind* this contract and this API, never by widening
> either — see "Future Ready."

## Product Philosophy

A companion is **not** an assistant, a chatbot, a teacher, or an AI
tutor. A companion is a **creative friend**. Its purpose is to
encourage imagination, celebrate creativity, and make the Studio feel
alive. A companion never critiques or scores a child's work — nothing
in this engine generates speech on its own that could do so (every
message this sprint speaks is static, curated, human-authored text),
so there is nothing here to police; a package's own `personality.json`
`neverSays` list is authored policy data for a **future** AI-driven
speech feature to respect, disclosed as currently inert.

## Architecture — three layers, each knowing only what it needs to

1. **Companion Package** (`assets/companions/<id>/`) — pure data. A
   `companion.json` manifest (required), an optional `personality.json`
   (traits/role/greetings/neverSays), an optional `animations.json`
   (state-transition/duration table), plus one PNG per declared state.
   Knows nothing about code.
2. **Companion Engine** (`js/companionEngine.js`, `window.CompanionEngine`) —
   a generic runtime class. Knows the Companion Package Contract and
   nothing else — it has **zero** knowledge of any specific companion
   id. There is no `if (id === 'lumo')` anywhere in this file, and
   there never should be (verified via a comment-stripped static scan
   as part of this sprint's own test suite).
3. **Companion Director** (`js/companionDirector.js`, `window.CompanionDirector`) —
   the one place in the codebase allowed to know Studio-specific
   moments (boot, typing, artwork inserted, published, idle/sleep, a
   Studio dialog being open) and translate each into a generic
   `CompanionEngine` call. The default companion id is read from
   `assets/companions/registry.json`'s first entry, with `'lumo'` as
   the one, final, disclosed literal fallback if the registry can't be
   reached — a configuration default, never a hardcoded behavioural
   branch (companionDirector.js's own test asserts exactly one quoted
   `'lumo'` occurrence in its real code).

```
assets/companions/registry.json  ─┐
assets/companions/lumo/           ├─►  js/companionEngine.js  ─►  js/companionDirector.js  ─►  Studio
  companion.json (required)       │        (generic runtime)         (Studio-specific)
  personality.json (optional)     │
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
  "version": "1.0",
  "defaultState": "idle",
  "states": {
    "idle": "idle.png",
    "wave": "wave.png",
    "think": "think.png",
    "talk": "talk.png",
    "celebrate": "celebrate.png",
    "sleep": "sleep.png",
    "curious": "curious.png"
  }
}
```

- `id`/`name`/`species`/`version`/`defaultState`/`states` are all
  required; `load()` rejects a package missing any of them, or whose
  `defaultState` has no matching entry in `states`.
- `states` may name any state vocabulary the package wants — the
  7-state set above is today's convention (matching Lumo), not a
  hardcoded requirement enforced anywhere in the engine. A package may
  also declare a `"blink"` state (see "Micro polish" below) — inert
  unless present.
- `hero.png` (a fuller portrait, not part of the state cycle) is a
  package convention, not part of the contract the engine itself reads.
- Every file `companion.json` names must exist as a real PNG at
  `assets/companions/<id>/<file>` — the engine preloads every declared
  state's image before `load()` resolves; one broken/missing image
  degrades gracefully (falls back to a broken-image glyph for that one
  state) rather than failing the whole package.

### `personality.json` (optional)

```json
{
  "name": "Lumo",
  "role": "Creative Friend",
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
`engine.getPersonality()`, not consulted by any code path this sprint.

### `animations.json` (optional)

```json
{
  "transitions": { "wave": "idle", "celebrate": "idle", "talk": "idle", "sleep": "idle" },
  "durations": { "wave": 3000, "celebrate": 2000 }
}
```

This is what makes state timing **package-driven instead of
hardcoded**: `setState(state)` checks `durations[state]`; if present,
it schedules an automatic `setState(transitions[state])` after that
many milliseconds (cancelled/rescheduled by any later `setState()`
call). A state with a `transitions` entry but no `durations` entry
(`talk`, `sleep`) never times out on its own — `talk` instead settles
via `speak()`'s own bubble-dismiss timer (see below), and `sleep` only
ever ends via an explicit `wake()` call. A package with no
`animations.json` at all behaves exactly as a bare `companion.json`
package always has — every state just persists until the next explicit
`setState()` call. `js/companionDirector.js` has **zero** hardcoded
timing constants for wave/celebrate/wake — all of that timing lives in
this file, read at runtime.

## CompanionEngine — public API (frozen)

```js
const lumo = new CompanionEngine();       // opts: {assetsBase, speakDurationMs}
await lumo.load('lumo');                  // fetches + validates + preloads companion.json/personality.json/animations.json
lumo.show();                              // mounts (once) and reveals the widget, fading in
lumo.setState('wave');                    // swaps the displayed image; auto-reverts per animations.json if declared
lumo.getState();                          // 'wave'
lumo.speak("Let's imagine!");             // shows a speech bubble, auto-dismisses
lumo.wake();                              // semantic setState('wave') — "the user came back"
lumo.sleep();                             // semantic setState('sleep') — "nothing has happened in a while"
lumo.hide();                              // hides (fades out) without discarding state
lumo.unload();                            // discards the loaded package + hides; DOM widget stays mounted for reuse
lumo.destroy();                           // full teardown, DOM removed
```

`setState()` on an unknown state name never throws — it falls back to
the package's own `defaultState` with a console warning. `load()` of a
missing/invalid package rejects cleanly (a real `Promise` rejection,
never a synchronous throw or a hang). `unload()` then a fresh `load()`
reuses the same mounted widget rather than rebuilding it — useful for
a future "switch companion" UI with zero flicker.

`CompanionEngine.loadRegistry(assetsBase?)` (a **static** method) reads
`assets/companions/registry.json` and resolves the `companions` array
(`[]` on any failure, never rejects) — used by `CompanionDirector` to
pick a default companion with no hardcoded id, and available to any
future "choose your companion" UI.

## CompanionDirector — Studio integration

`js/companionDirector.js` owns the choreography this sprint's brief
specifies, exactly:

| Studio moment | Trigger | Companion reaction |
|---|---|---|
| Studio opens | `CompanionDirector.init()` (called once from `js/app.js`'s boot sequence) | `wave` + one of Lumo's own `personality.json` greetings → `idle` after 3s (animations.json-driven) |
| User starts creating | `notify('story-started')` (`js/creationFlow.js`'s `_finish()`) | `think` + "I can't wait to see your story!" |
| User types | a document-level delegated `input` listener (capture phase), scoped to real Workspace text fields, 4s cooldown | `curious` |
| User inserts artwork | `notify('artwork-added')` (`js/contextPanel.js`'s `_applyImageResult`) | `celebrate` + "That looks magical!" → `idle` after 2s (animations.json-driven) |
| Story published | `notify('published')` (`js/publishStudio.js`'s `_finalizePublish`) | `celebrate` + "Your story is ready!" → `idle` after 2s |
| No interaction for 2 minutes | a global activity listener's own idle timer (Studio-owned policy, `IDLE_SLEEP_MS`) | `sleep()` |
| User interacts again | the same activity listener, from `sleep` | `wake()` (→ `wave` + "Welcome back!") → `idle` after 3s |
| A Studio dialog opens (restore/theme-picker/Publish/Magic Card) | a `MutationObserver` watching a small, disclosed set of known overlay containers | `hide()` (restored via `show()` once the dialog closes, only if it was visible before) |

Every hook site elsewhere in the app is a single, defensive,
try/catch-guarded line — `CompanionDirector.notify('artwork-added')` —
the same "thin hook into a dedicated module" pattern already
established for `PageRuntime`/`ObjectStrip`/`ContextPanel`/`MagicCard`
throughout this codebase. A missing `companion.json`, a broken image,
or `CompanionEngine`/`CompanionDirector` failing to load at all leaves
Studio's boot sequence and every one of these call sites completely
unaffected — every call is guarded.

## Companion UI

- **Floats above Studio UI, never blocks controls**: the whole widget
  is `pointer-events:none` except the small portrait circle itself
  (the one draggable/hoverable surface) — nothing else on the widget
  can intercept a click meant for the real UI beneath or around it.
- **Draggable, remembers position per session**: dragging the portrait
  switches the widget from its default CSS-anchored bottom-right
  corner to explicit `left`/`top` pixel positioning (clamped to the
  viewport, re-clamped on window resize), persisted to
  `sessionStorage` (`vihu-companion-widget-position`) and restored on
  the next mount **within the same browser tab** — a genuinely
  different tab/session correctly starts fresh at the default corner,
  matching how `sessionStorage` itself is scoped by browsers.
- **Automatically avoids overlapping dialogs or menus**: see the
  "A Studio dialog opens" row above — `CompanionDirector` (the one file
  allowed to know Studio's own dialog system) hides the companion
  outright whenever a real Studio modal is open, the lowest-risk way
  to guarantee no overlap without needing to know any future dialog's
  exact geometry in advance.
- **show()/hide()**: a real CSS opacity/transform/visibility fade
  (`.companion-widget.companion-hidden`), not an instant `display:none`
  — sequenced entirely in CSS via a delayed `visibility` transition, no
  JS-side timing needed.

## Micro polish

All CSS- or Canvas-based, none of it sprite animation:

- **Fade in/out** — `show()`/`hide()`, see above.
- **Tiny breathing effect** — a continuous, subtle `companion-breathe`
  keyframe animation on the portrait, paused while dragging.
- **Hover micro-interaction** — a slightly larger, gently rotated
  portrait on `:hover`, distinct from the constant idle breathing.
- **Soft scale pulse while talking** — `[data-companion-state="talk"]`
  drives a `companion-talk-pulse` keyframe on the portrait.
- **Small bounce during celebrate** — `[data-companion-state="celebrate"]`
  drives `companion-celebrate-bounce`.
- **Sleep "Zzz" indicator** — a small `.companion-zzz` element (a
  sibling of the portrait, not a pseudo-element inside it, so it can
  float outside the portrait's own circular `overflow:hidden` clip),
  shown and animated only while `data-companion-state="sleep"`.
- **Random blink (future-ready)** — if, and only if, a package
  declares a `"blink"` state in `companion.json`, the engine schedules
  a randomized (3–7s) brief flash to that image while resting (`idle`)
  and back, bypassing `setState()`/its auto-transition machinery
  entirely (a blink is a visual flourish, never a real state change).
  Lumo declares no `blink` state today — this stays completely inert
  for it, proven inert via this sprint's own test suite, and ready the
  instant a future package (or a future Lumo art pass) adds one.
- Every animation respects `prefers-reduced-motion`.

## Placeholder art, disclosed

Lumo's 8 PNGs (`assets/companions/lumo/`) are **placeholder production
art** — simple Canvas-drawn illustrations (a chibi dragon built from
Canvas 2D primitives, matching this codebase's own established "reach
for Canvas over hand-authoring assets" convention) standing in for
real hand-painted art. Swapping them for final production art requires
**zero engine or integration code changes** — the Companion Package
Contract only cares that a real PNG exists at each path `companion.json`
declares.

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
- Multiple simultaneous companions, seasonal costumes, emotes, and
  unlockable companions are all expressible as additional Companion
  Packages / additional `registry.json` entries — no engine change.

## Adding a Second Companion

Reachable today with zero engine changes — verified directly during
this sprint's own testing with two hand-authored throwaway test
packages (never mentioned anywhere in `js/companionEngine.js`/
`js/companionDirector.js`), one proving a wholly different state
vocabulary and one proving the optional `blink` state:

```
assets/companions/nimbus/
  companion.json   -- {id:"nimbus", name:"Nimbus", species:"Cloud Spirit", ...}
  idle.png
  happy.png         -- a state Lumo doesn't even have
```

```js
const nimbus = new CompanionEngine();
await nimbus.load('nimbus');
nimbus.setState('happy');   // works — the engine only reads companion.json's own states map
```

Making Nimbus (or Moss, or Nova) Studio's actual companion is a
one-line edit to `assets/companions/registry.json` (add its entry,
optionally reorder so it's first) — no change inside
`js/companionEngine.js` or `js/companionDirector.js` is ever required.

## Critical Files

- `assets/companions/registry.json` — the installed-companions listing.
- `assets/companions/lumo/companion.json` + `personality.json` +
  `animations.json` + 8 PNGs — the Companion Package Contract's first
  full implementation.
- `assets/companions/README.md` — the package folder's own asset-folder
  README, matching this repo's established convention.
- `js/companionEngine.js` — the generic runtime (frozen public API).
- `js/companionDirector.js` — Studio's own choreography/integration
  layer, including the dialog-occlusion watcher.
- `css/style.css`'s `.companion-*` rules — the widget's visual shell
  (bottom-right by default, draggable, `pointer-events:none` except
  the portrait, `z-index:1200` — above Creation Flow/Publish Studio,
  below the Magic Card ceremony and the restore-session modal, both
  deliberately not companioned; hidden outright by `CompanionDirector`
  whenever a real Studio dialog is open).
- Hook sites: `js/app.js` (boot), `js/creationFlow.js`'s `_finish()`,
  `js/contextPanel.js`'s `_applyImageResult()`, `js/publishStudio.js`'s
  `_finalizePublish()`.
