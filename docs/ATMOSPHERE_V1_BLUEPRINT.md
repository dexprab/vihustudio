# Atmosphere V1 — Implementation Blueprint (MLAS)

Status: **design complete, uncommitted** — the implementation-ready specification for the
Minimum Lovable Atmosphere System. This document supersedes `docs/ATMOSPHERE_ENGINE.md` for
V1 scope only — that document remains the long-term vision/future-roadmap reference; nothing
in it beyond what's restated here should be built yet.

Frozen constraints going into this document (do not relitigate):
- No Runtime/Director split. **One module: `AudioManager`.**
- No pool rotation, no Living Details, no procedural/random scheduling, no weather/time-of-day,
  no audio buses, no DSP, no complex ducking, no multiple ambience variations, no state machines.
- Five real, already-generated ElevenLabs assets exist today, no generation pipeline needed:
  **Air, Harmony, Magic, Forest, Wind** (30s each, seamless loop).

---

## 1. Final Architecture

One new file, `js/audioManager.js`, exposing `window.AudioManager` — an IIFE singleton, same
shape as every other audio module already in this codebase (`js/gatewayAudio.js`,
`js/lumoVoice.js`): no build step, no external dependency, plain `HTMLAudioElement`s.

**No coordinating module is introduced.** The existing code that already knows "a World/Theme
just became active" — `js/themeEngine.js`'s `applyTheme()`/`applyArtworkTheme()` — gets one new
line each, exactly the same shape as the existing
`try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify(...) }catch(e){}`
hooks already scattered through this codebase (`js/app.js`, `js/creationFlow.js`,
`js/contextPanel.js`, `js/publishStudio.js`, `js/pageOps.js`). AudioManager never queries
`ThemeRegistry`, never knows what a "World" is, never knows a World ID — it only ever receives
plain data (an array of ambience references) from a caller that already resolved it. This is
the same discipline `CompanionEngine` holds to (zero hardcoded companion-id branches) — here,
zero hardcoded World-id branches.

**Corrected per explicit product direction** (an earlier draft of this document guessed wrong
here — flagging the correction rather than quietly editing it away): Foundation is **not** a
single track. All five generated assets — Air, Harmony, Magic, Forest, Wind — are Foundation
layers, and **all five loop simultaneously, always, at their own fixed relative volumes,
forming one composite always-on sound.** "The simplification was architectural, not
experiential" — V1 has no scheduling, no rotation, no selection logic among them; it's simply
five `<audio>` elements, each `loop=true`, each carrying its own fixed mix level, all started
together and never stopped. This is genuinely *simpler* code than a single-track design would
have needed once World ambience and mute/volume are added, since there's no "which one is
active" state to track at all — only "are all five on or muted."

World ambience (§8) still overlays on top of the full five-layer Foundation stack, unchanged
from the original design — no World-ambience tracks exist yet among the five supplied assets,
so `assets/audio/worlds/` starts empty for V1; the capability is built and ready, simply unused
until World-specific content exists.

---

## 2. Folder Structure

`assets/audio/` already exists (it currently holds `gateway/`, the Traveller Gateway's own two
click-triggered sound effects — untouched by this work, not moved, not renamed).

```
assets/audio/
  gateway/                  (existing, untouched)
    transition-breeze.wav
    telescope-click.wav
  foundation/                (NEW — all five layers, always played together)
    air.mp3
    harmony.mp3
    magic.mp3
    forest.mp3
    wind.mp3
  worlds/                    (NEW — empty for V1, no World-ambience content exists yet)
  ui/                        (NEW, reserved — empty for V1)
  README.md                  (NEW — disclosure, matching every other asset folder's convention)
```

Deliberate departures from your own sketch, justified per your own "only if justified"
instruction:

- **All five supplied assets live in `foundation/`, not split across `foundation/`/`worlds/`.**
  Corrected per explicit direction — see §1.
- **`worlds/` starts empty**, ready for the first real World-specific ambience file whenever one
  exists; a manifest's `ambience` array is just filenames, so nothing about this folder being
  currently empty constrains what it can hold later.
- **No `companions/` folder.** Lumo's voice already lives, shipped and wired, at
  `assets/lumo/voice/`. Adding a second, empty `assets/audio/companions/` would be a redundant,
  confusing second home for the same concept. Nothing moves.
- **`ui/` is reserved but empty.** Interactive Stings are explicitly out of AudioManager's V1
  responsibility list (see §4) — the folder exists so a future sprint has an obvious home, not
  because V1 populates it.

---

## 3. Manifest Contract

An optional `audio` block on a Theme object, sibling to `frame`/`layouts`/`frameVariations` —
the same tier every other optional Theme field already sits at:

```json
{
  "audio": {
    "ambience": ["forest.mp3"]
  }
}
```

- `ambience` is always an array, even though V1 will only ever use one entry per World — stored
  as an array from day one so a future World with more than one candidate needs no contract
  change, matching this codebase's own established "array from day one" discipline (Layer
  Packs, Frame Variations).
- Each entry is either a bare filename (resolved against the fixed `assets/audio/worlds/` pool)
  or an already-fully-qualified path/URL (used as-is). This mirrors, in spirit but not by direct
  call, `ThemeRegistry.resolveAssetRef(id,value)`'s own dual-mode resolution
  (`js/themeRegistry.js:660`) — not reused directly, since that function is scoped to a Theme
  package's own compiled `assets` map (image/font extensions only) and World ambience for V1
  lives in a fixed app-owned folder, not inside a `.vtheme` package.
- **Absent `audio` field is completely valid** — every Theme in this app today (Museum Gallery
  included) has none, and must keep working with zero visible/audible difference: Foundation
  plays alone.
- No World Builder validator change required — this is optional metadata, not a structural
  requirement. Authoring it through World Builder's own UI is a named future extension (§12),
  not built now.

---

## 4. AudioManager Responsibilities (and nothing else)

Restating your own list, made concrete:

| Responsibility | Method |
|---|---|
| Initialize audio | `init()` |
| Load ambience assets | internal, triggered by `init()`/`playWorld()` |
| Play Foundation ambience | `playFoundation()` |
| Play World ambience | `playWorld(ambienceRefs)` |
| Stop World ambience | `stopWorld()` |
| Mute/unmute | `setMuted(bool)` / `isMuted()` |
| Master volume | `setVolume(0..1)` / `getVolume()` |
| Remember user preference | persisted to `localStorage` inside `setMuted`/`setVolume` |
| Clean shutdown | `shutdown()` |

No `duck()`, no `crossfadeTo()` exposed publicly, no per-layer volume, no scheduling — the one
piece of internal smoothing (a short linear fade on World start/stop, see §9) is not a public
capability, it's just "how `playWorld`/`stopWorld` avoid a click," the same way you wouldn't
call a plain `if` statement a state machine.

---

## 5. Public API

```
AudioManager.init()                 // call once, at boot
AudioManager.playFoundation()       // starts the always-on loop; safe to call multiple times (no-op if already playing)
AudioManager.playWorld(ambienceRefs)// ambienceRefs: array of filenames/paths, e.g. ['forest.mp3']
                                     // no-op if the exact same refs are already playing
AudioManager.stopWorld()            // fades out and stops World ambience only; Foundation is untouched
AudioManager.setMuted(bool)
AudioManager.isMuted()              // -> bool
AudioManager.setVolume(n)           // n in [0,1]
AudioManager.getVolume()            // -> number
AudioManager.shutdown()             // stops everything, releases element references
```

`playWorld` takes primitive data (an array of strings), never a Theme object — AudioManager
must never need to know what a "Theme" or "World" is. The extraction of `theme.audio.ambience`
from an actual Theme is the caller's job (see §8).

---

## 6. Runtime Lifecycle

1. `init()`:
   - Reads `vihu-audio-muted` / `vihu-audio-volume` from `localStorage` (sane defaults: not
     muted, volume `0.6`).
   - Creates (but does not play) **five** `<audio>` elements, one per Foundation layer, each
     `loop=true`, `preload='auto'`, each carrying its own fixed relative volume from a small
     constants table (see below) — not five equal volumes, a genuine mix:
     ```
     FOUNDATION_LAYERS = [
       { file:'air.mp3',     volume:0.5 },
       { file:'harmony.mp3', volume:0.4 },
       { file:'magic.mp3',   volume:0.3 },
       { file:'forest.mp3',  volume:0.35 },
       { file:'wind.mp3',    volume:0.3 }
     ]
     ```
     These starting values are a placeholder balance, not a creative judgment I'm able to make —
     they're deliberately just one easily-editable constants table in `js/audioManager.js`, meant
     to be re-tuned by ear once the five real files actually exist and can be heard mixed
     together.
   - Installs one self-removing, document-level `pointerdown`/`keydown` listener (the "unlock"
     listener). It exists purely to satisfy browser autoplay policy — the very first real
     gesture anywhere in the session calls `.play()` on all five Foundation elements together,
     from inside that one real gesture handler, then removes itself. This mirrors the exact
     discipline `js/gatewayAudio.js`/`js/lumoVoice.js` already use ("`.play()` only ever fires
     from inside a real click/keydown handler").
   - Does nothing else — no World element is created until `playWorld()` is first called.

2. **When to call `init()`**: not during the Traveller Gateway cinematic. The Gateway already
   has its own complete, bespoke sound design (the Gate video's own audio track, Lumo's real
   recorded voice, `gatewayAudio.js`'s own click sound) — stacking a third, independent ambient
   system underneath it risks exactly the "noisy, distracting" failure mode the whole philosophy
   exists to prevent. Call `AudioManager.init()` at the same point `CompanionDirector.init()`
   already fires — inside `_beginBoot()` in `js/app.js`, once the Gateway (or its fallback) has
   handed off and the Traveller/Creator has actually reached the Hall. From that point, "Foundation
   ambience always plays" holds for the entire remainder of the session, exactly as specified.

3. `shutdown()` (rarely needed in a single-page app, included because it was asked for): pauses
   every element, clears `src`, drops references. No current call site requires it; a future
   "leave Studio" flow could call it if one is ever built.

---

## 7. Startup Sequence (concrete steps)

1. `index.html` gains one new `<script src='js/audioManager.js'>` tag, placed in the same
   neighborhood as `js/gatewayAudio.js`/`js/companionEngine.js`/`js/companionDirector.js`,
   before `js/app.js`.
2. `js/app.js`'s `_beginBoot()` gains one new defensive hook, same shape as its existing
   `CompanionDirector.init()` call:
   ```
   try{ if(typeof AudioManager!=='undefined') AudioManager.init(); }catch(e){}
   ```
3. `AudioManager.init()` preloads Foundation and arms the one-time unlock listener (§6).
4. The first real tap/keypress anywhere in the Hall starts Foundation. From the user's
   perspective, it's simply "always there" from the moment they arrive.

---

## 8. World Switching Flow

Two call sites gain one hook each, both in `js/themeEngine.js`:

**`applyTheme(themeId,opts)`** (`js/themeEngine.js:608`) — right before `return t;`:
```
try{
  if(typeof AudioManager!=='undefined'){
    if(t.audio && t.audio.ambience && t.audio.ambience.length) AudioManager.playWorld(t.audio.ambience);
    else AudioManager.stopWorld();
  }
}catch(e){}
```

**`applyArtworkTheme(themeId,opts)`** (`js/themeEngine.js:631`) — right before the final
`return resolvedId ? ThemeRegistry.get(resolvedId) : null;`, resolve the theme object once and
apply the identical logic. An Artwork Theme and a Story Theme are two independent slots
(`AppState.project.theme` / `.artworkTheme`) — for V1, whichever `applyX` call fires most
recently simply wins the World-ambience slot, since AudioManager only ever has one "current
World" concept, matching "no audio buses." (If both a Story Theme and an Artwork Theme
someday declare ambience simultaneously, that's a real product question for a later version —
not solved here, and not currently possible today since no shipped Theme declares `audio` yet.)

**Behavior inside `playWorld`**:
- If the exact same `ambienceRefs` are already the active World element's source, it's a no-op
  — re-entering an already-active World, or switching pages within the same Theme, never
  restarts anything.
- Otherwise: fade the currently-playing World element (if any) to 0 over ~2 seconds, swap its
  `src` (or create a fresh element) to the new resolved ambience file, fade it in to the current
  master volume over ~2 seconds. One fixed, simple linear ramp — not equal-power, not
  per-layer, not randomized. This is the one piece of smoothing kept in V1: a hard, instant cut
  between two looping beds is audibly jarring and costs nothing to avoid; anything fancier
  (curves, ducking, offsets) is explicitly out of scope.
- If the resolved file 404s or fails to decode: log a console warning, leave Foundation playing
  uninterrupted, no user-facing error — matches this codebase's own established graceful-
  degradation precedent (Story Egg's missing `hero.png`, Nimbus/Quill's missing poses).
- A Theme with no `audio` field at all (every existing Theme today, Museum Gallery included)
  never calls `playWorld` — `stopWorld()` fires (or nothing does, if no World was ever active),
  Foundation plays alone. This is the default, common case and must be silent/invisible.

---

## 9. Mute / Volume Behavior

- `setMuted(true)`: fades the whole output (Foundation + World together, one multiplier — no
  per-layer control, matching "no audio buses") to 0 over ~300ms, persists immediately.
- `setMuted(false)`: restores to the persisted volume over ~300ms.
- `setVolume(n)`: applied instantly as a multiplier on top of each element's own fixed relative
  volume — every Foundation layer's own mix balance (§6) is preserved, master volume just scales
  the whole composite up or down together with World ambience. There is no separate World-volume
  or per-Foundation-layer control exposed in V1 — one master multiplier only.
- Both preferences persist to `localStorage` under their own keys (`vihu-audio-muted`,
  `vihu-audio-volume`), read back on the very next `init()` — matching how every other
  preference in this codebase already persists (dark/light mode, Workspace layout, etc.).
- **Where the control lives** is a UI decision, not part of this document's scope, but is worth
  naming as a real open item: there is no existing global sound-settings surface anywhere in
  this app today. A small, discoverable header icon (mirroring the Magic Card badge's own
  existing header-icon convention) is the natural minimal home — flagged here as something to
  decide before or during implementation, not solved by this blueprint.

---

## 10. Browser Implementation Recommendation

**Plain `HTMLAudioElement`, not the Web Audio API.** This is a deliberate simplification, not
just the path of least resistance:

- Every other audio module in this codebase (`gatewayAudio.js`, `lumoVoice.js`) already uses
  plain `new Audio()` — staying consistent avoids introducing a second API surface with its own
  separate autoplay-unlock lifecycle (`AudioContext` has its own "suspended until resumed"
  state, layered on top of the `<audio>` element's own autoplay policy — two unlock mechanisms
  to reason about instead of one).
- V1's actual needs — six looping elements at most (five Foundation + one World), a linear
  volume ramp for World-swap fades, a master multiplier applied per-element on top of each
  element's own fixed relative volume — are all achievable with `element.loop = true` and
  `element.volume` interpolated via a small `setInterval`/`requestAnimationFrame` ramp helper.
  No `GainNode`, no `AudioContext`, no equal-power curve math.
- **Accepted trade-off, disclosed rather than hidden**: native `<audio loop>` can introduce a
  small click/gap at the loop boundary on some browser/codec combinations, whereas a real
  Web Audio API `AudioBufferSourceNode` loop is sample-accurate. Since the five assets are
  already authored to loop seamlessly, and since manually rescheduling playback to sidestep this
  (crossfading into a fresh copy before the loop boundary) is exactly the "pool rotation"
  machinery you've explicitly cut for V1, this risk is accepted for now. If seam artifacts prove
  audible in real testing, that's the concrete, disclosed trigger for revisiting with the Web
  Audio API later (§12) — not a reason to build it preemptively today.

---

## 11. Performance Considerations

- At most six elements ever playing concurrently (five Foundation + one World) — still
  negligible CPU/memory cost on any modern browser; six looping 30-second MP3s is a trivial
  decode/playback load compared to, say, a single video element.
- **Preload discipline**: all five Foundation elements load at `init()` time (small, always
  needed, matches the existing Gateway video's own "preload early, mount later" pattern already
  proven in this codebase). World ambience files load lazily, only the first time `playWorld()`
  is actually called with a given filename — never preloaded at boot, since none exist yet.
- File size: 30-second compressed loops; no encoding pipeline is needed since the five assets
  are already final, but worth a one-time sanity check on their actual byte sizes (a rough
  target well under 1MB each keeps this comfortably lazy-loadable on a weak connection, which
  matters for a product used by children on shared/school devices) — with five files loading
  together at boot instead of one, total Foundation payload is worth checking in aggregate too.
- Nothing here requires Page Visibility API handling, tab-backgrounding pause/resume, or any
  other runtime behavior beyond the responsibility list in §4 — those are named only as future
  extension points (§12), not built now.

---

## 12. Future Extension Points (named, not built)

Everything below is deliberately deferred. Naming them here means a future sprint doesn't have
to rediscover them, and means this V1 blueprint doesn't have to pretend they don't exist:

- **A coordinating layer** (an "Audio Director," if one is ever needed) — only once there's a
  real reason to coordinate more than "one Foundation + one World," e.g. ducking against
  Character Voice or against the separately-locked **Audio Studio** roadmap item (per-card
  narration). That overlap is still genuinely unresolved — flagged, not solved, here.
- **Pool rotation / crossfade-into-next-repetition** — for long-session freshness, if a single
  30-second Foundation loop ever proves fatiguing over multi-hour sessions in practice.
- **Living Details** — sparse, randomized one-shot texture events (a chime, a rustle) layered
  on top of the beds.
- **Weather / time-of-day modifiers.**
- **Interactive Stings** — the reserved, currently-empty `assets/audio/ui/` folder is where
  these would live; no method for them exists on `AudioManager` today.
- **World Builder authoring UI** for the `audio.ambience` field — today it's hand-edited on the
  Theme object; a future sprint could add a picker control the way Frame Variations already has
  one.
- **Page Visibility API** pause/resume on tab-backgrounding, for battery/CPU politeness.
- **Migration to the Web Audio API**, specifically if loop-seam artifacts prove audible in real
  testing (§10).
- **Multiple simultaneous World-ambience sources** (e.g. a Story Theme and an Artwork Theme both
  declaring `audio` at once) — today, whichever `applyTheme`/`applyArtworkTheme` call fires last
  simply wins the single World slot; a real multi-source model is not designed here.

None of these should be started without their own explicit approval, matching this codebase's
standing "architecture changes require explicit approval" rule.
