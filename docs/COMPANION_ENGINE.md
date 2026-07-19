# Companion Engine (Sprint C1 — Foundation, Lumo v1)

## Purpose

A generic runtime for **Companion Packages** — a portrait companion
(mascot) that lives beside a Story Author in VihuStudio, expressing
itself through named states and short static speech bubbles. Lumo the
Story Dragon, VihuPlanet's official companion (`docs/hero/06-CONTRACT-Companion.md`),
is the first Companion Package and the reference implementation
proving the contract. Every future companion (Nimbus, Moss, Nova, ...)
is just another folder under `assets/companions/` with the same shape —
adding one never requires a Companion Engine code change.

This sprint's own explicit goal was **not** animation — it was
establishing the Companion Package Contract, the generic runtime, and
the state engine. Image swapping only, today; see "Future Ready" below
for how later capability grows behind the exact same public API.

## Architecture — three layers, each knowing only what it needs to

1. **Companion Package** (`assets/companions/<id>/`) — pure data. A
   `companion.json` manifest plus one PNG per declared state. Knows
   nothing about code.
2. **Companion Engine** (`js/companionEngine.js`, `window.CompanionEngine`) —
   a generic runtime class. Knows the Companion Package Contract and
   nothing else — it has **zero** knowledge of any specific companion
   id. There is no `if (id === 'lumo')` anywhere in this file, and
   there never should be.
3. **Companion Director** (`js/companionDirector.js`, `window.CompanionDirector`) —
   the one place in the codebase allowed to know Studio-specific
   moments (boot, typing, artwork inserted, published, idle/sleep) and
   translate each into a generic `CompanionEngine.setState()`/`.speak()`
   call. `companionId` is a plain configuration value here (default
   `'lumo'`), never a hardcoded behavioural branch.

```
assets/companions/lumo/companion.json  →  js/companionEngine.js  →  js/companionDirector.js  →  Studio
        (data)                              (generic runtime)          (Studio-specific)
```

## The Companion Package Contract

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
  hardcoded requirement enforced anywhere in the engine.
- `hero.png` (a fuller portrait, not part of the state cycle) is a
  package convention, not part of the contract the engine itself reads.
- Every file a package's `companion.json` names must exist as a real
  PNG at `assets/companions/<id>/<file>` — the engine preloads every
  declared state's image before `load()` resolves; one broken/missing
  image degrades gracefully (falls back to a broken-image glyph for
  that one state) rather than failing the whole package.

## CompanionEngine — public API

```js
const lumo = new CompanionEngine();       // opts: {assetsBase, speakDurationMs}
await lumo.load('lumo');                  // fetches + validates + preloads
lumo.show();                              // mounts (once) and reveals the widget
lumo.setState('wave');                    // swaps the displayed image
lumo.getState();                          // 'wave'
lumo.speak("Let's imagine!");             // shows a speech bubble, auto-hides
lumo.hide();                              // hides without discarding state
lumo.destroy();                           // full teardown
```

`setState()` on an unknown state name never throws — it falls back to
the package's own `defaultState` with a console warning. `load()` of a
missing/invalid package rejects cleanly (a real `Promise` rejection,
never a synchronous throw or a hang).

## CompanionDirector — Studio integration

`js/companionDirector.js` owns the choreography this sprint's brief
specifies, exactly:

| Studio moment | Trigger | Companion reaction |
|---|---|---|
| Studio opens | `CompanionDirector.init()` (called once from `js/app.js`'s boot sequence) | `wave` + "Let's imagine!" → `idle` after 3s |
| User starts creating | `notify('story-started')` (`js/creationFlow.js`'s `_finish()`) | `think` + "I can't wait to see your story!" |
| User types | a document-level delegated `input` listener (capture phase), scoped to real Workspace text fields, 4s cooldown | `curious` |
| User inserts artwork | `notify('artwork-added')` (`js/contextPanel.js`'s `_applyImageResult`) | `celebrate` + "That's wonderful!" → `idle` after 2s |
| Story published | `notify('published')` (`js/publishStudio.js`'s `_finalizePublish`) | `celebrate` + "Your story is ready!" → `idle` after 2s |
| No interaction for 2 minutes | a global activity listener's own idle timer | `sleep` |
| User interacts again | the same activity listener, from `sleep` | `wave` → `idle` after 2s |

Every hook site elsewhere in the app is a single, defensive,
try/catch-guarded line — `CompanionDirector.notify('artwork-added')` —
the same "thin hook into a dedicated module" pattern already
established for `PageRuntime`/`ObjectStrip`/`ContextPanel`/`MagicCard`
throughout this codebase. A missing companion.json, a broken image, or
`CompanionEngine`/`CompanionDirector` failing to load at all leaves
Studio's boot sequence and every one of these call sites completely
unaffected — every call is guarded.

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
- `show()`/`hide()` could add entrance/exit motion.
- A future package could declare particle effects, blinking, or
  breathing as additional per-state data `companion.json` carries —
  the engine's `load()`/`_validatePackage()` already treat unknown
  extra fields as inert, so this needs no contract-breaking change.
- AI conversation is a plausible future evolution of `speak()`'s own
  text source (static string today) — again, no public signature
  change required.

## Adding a Second Companion

Reachable today with zero engine changes — verified directly during
this sprint's own testing with a hand-authored `nimbus` package (never
mentioned anywhere in `js/companionEngine.js`/`js/companionDirector.js`):

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

Switching which companion Studio boots with is a one-line default
change in `js/companionDirector.js`'s `init()` (`opts.companionId||'lumo'`),
never a change inside `companionEngine.js`.

## Critical Files

- `assets/companions/lumo/companion.json` + 8 PNGs — the Companion
  Package Contract's first implementation.
- `assets/companions/README.md` — the package folder's own asset-folder
  README, matching this repo's established convention.
- `js/companionEngine.js` — the generic runtime.
- `js/companionDirector.js` — Studio's own choreography/integration
  layer.
- `css/style.css`'s `.companion-*` rules — the widget's visual shell
  (bottom-right, `pointer-events:none`, `z-index:1200` — above Creation
  Flow/Publish Studio, below the Magic Card ceremony and the
  restore-session modal, both deliberately not companioned).
- Hook sites: `js/app.js` (boot), `js/creationFlow.js`'s `_finish()`,
  `js/contextPanel.js`'s `_applyImageResult()`, `js/publishStudio.js`'s
  `_finalizePublish()`.
