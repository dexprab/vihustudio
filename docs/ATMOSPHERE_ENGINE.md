# The Atmosphere Engine — Vision & Long-Term Architecture

Status: **long-term reference only.** For what's actually being built first, see
`docs/ATMOSPHERE_V1_BLUEPRINT.md` (the frozen, MLAS-scoped implementation blueprint) — that
document supersedes this one for V1 scope. This document remains the future-roadmap reference:
what the Atmosphere Engine could grow into over years, once each piece is separately proven and
approved. Nothing beyond `ATMOSPHERE_V1_BLUEPRINT.md`'s own scope should be built without its
own explicit approval, per this repo's standing "architecture changes require explicit
approval" rule.

## Philosophy

VihuPlanet is not a game, not a graphic design tool — it's a creativity platform for children,
and it should feel calm, safe, inspiring and magical without becoming noisy or distracting. The
platform already follows a **Foundation + Experience** philosophy everywhere it matters: the
Theme Engine defines structure, Experiences enrich it; World Builder defines the world,
Experiences decorate it. Audio should follow the identical philosophy.

We are not building background music. We are building an **Atmosphere Engine** — something so
subtle it's barely noticed, and whose absence (on mute) makes the world feel suddenly empty.
That absence being noticeable is success.

**Design goals**: calm, curiosity, imagination, warmth, safety, wonder, creativity, childhood,
handcrafted storybooks, peaceful mornings, timelessness.

**Explicitly avoided**: cinematic music, orchestras, fantasy battle music, dramatic tension,
adventure themes, Disney-style or Harry-Potter-style scoring, obvious melodies, catchy tunes,
percussion, vocals in the ambient layer.

## The core reframing

The originally-proposed model — Foundation → World Atmosphere → Interactive Audio → Character
Voices, as four peer "layers" — is a good starting mental model, but conflates two very
different kinds of sound. In the long-term architecture, there are really only **two
continuous, always-mixing beds** (Foundation, World Atmosphere) and **three event-driven
streams that ride on top of them** (a sparse "aliveness" layer, Interactive stings, and
Character Voice). Beds loop and crossfade; events fire, duck the beds briefly, and release.
Treating them as peers makes mixing, volume, and fatigue harder to reason about than necessary.

The long-term architecture also applies the **Runtime + Director split** this codebase already
uses everywhere else — `CompanionEngine` (generic, dumb, knows nothing about Lumo specifically)
paired with `CompanionDirector` (owns the choreography of which entity/pose plays when); or
`ThemeEngine`/`ThemeRegistry` (generic resolution) paired with individual Theme content. A
future, fuller Atmosphere Engine would get the same split: an `AtmosphereEngine` that only knows
how to load, mix, crossfade, and duck named audio buffers, and an `AtmosphereDirector` that owns
which World's tint is active, when to hush for a Ceremony, when to duck for Lumo. **This split
is explicitly NOT part of V1** — see `ATMOSPHERE_V1_BLUEPRINT.md`.

## Layer types (long-term vision)

Five layer types, in two families:

| Family | Layer | Always on? |
|---|---|---|
| **Beds** | Foundation Bed | Yes, always |
| | World Tint | Only when a World is active |
| **Events** | Living Details | Sparse, auto-scheduled |
| | Interactive Stings | User-triggered |
| | Character Voice | External system (Lumo), coordinated not owned |

- **Foundation Bed** — VihuPlanet's constant "air," present in every session, every World. This
  is the brand's sonic identity. Never silenced by a World.
- **World Tint** — not a second competing bed, but a color-grade on the Foundation: narrower
  frequency presence, quieter, functioning like a filter rather than an equal layer. This is the
  literal mechanism that makes "Worlds enrich, never replace" true architecturally, not just a
  guideline.
- **Living Details** — proof of life: sparse, irregular one-shot sounds (a distant chime, a
  soft page-rustle) at random 20–90s intervals, drawn from a small per-World pool. This is the
  actual mechanism that makes a place feel like it's breathing rather than just quieter.
- **Interactive Stings** — feedback for real actions (tap, page turn, sticker drop, publish).
  Short, textural, never melodic.
- **Character Voice** — Lumo's existing voice system (`js/lumoVoice.js`/`CompanionEngine`).
  Never re-implemented here; the Atmosphere Engine's only future duty is a duck contract.

Concurrency should stay low, deliberately: at any instant, 2 continuous beds + at most one
occasional Detail event + at most one occasional Sting/Voice event.

## Mixing strategy and volume hierarchy (long-term vision)

Relative ladder, referenced to Voice at 0dB (voice must always be legible):

- Character Voice: reference level
- Interactive Stings: −6 to −10dB under Voice
- Foundation Bed: −14 to −18dB — felt, not consciously heard
- World Tint: −20 to −24dB — always quieter than Foundation
- Living Details: −18 to −26dB per event, randomized within range
- Ducking: an additional −3 to −6dB dip on both beds whenever Voice or a Sting fires

Every asset needs loudness normalization at ingestion — a one-time authoring-pipeline rule
(peak or LUFS target applied the moment an asset is added), not a runtime feature, so the ladder
above isn't undermined by inconsistent source loudness across assets generated months apart.

A future full implementation would route beds and events through one shared Web Audio API
`AudioContext` with a `GainNode` per layer, for sample-accurate crossfade/ducking automation.

## Loop sync, starts, and offsets (long-term vision)

There's no beat-grid to lock to (no melody, no percussion) — so "synchronization" means never
letting two loop-seams land at the same wall-clock moment, not beat-matching. The mechanism: any
loop transition (continuation, pool rotation, or a World swap) is a 2–4 second crossfade into
the next repetition or the next asset, never a reliance on a sample-perfect gapless loop. This
one mechanism does triple duty: loop-seam safety, long-session freshness, and World-swap
smoothness.

Per-layer start policy: Foundation starts deterministically on the first unlocking gesture (but
from a randomized offset within its own file); World Tint crossfades in from a randomized
offset whenever a World activates; Living Details are fully randomized in timing and selection.

## Fatigue avoidance over multi-hour sessions (long-term vision)

- **Pool rotation, not single loops** — every layer (Foundation especially) ships as a pool of
  3–6 interchangeable takes, rotated via the same crossfade mechanism above. This is the single
  highest-leverage decision for solving fatigue given a 30-second-max generation constraint.
- Layer restart timers intentionally unsynchronized (independent periods, jittered).
- A long-session cooldown: after ~45–60 minutes, Foundation can recede a further couple dB.
- Mute must be trivially discoverable and remembered.

## How Worlds extend Foundation without replacing it (long-term vision)

The same three-tier resolution ladder Theme Language v2 already uses (Presentation Preset →
Theme Overrides → System Defaults): **System Default Atmosphere** (Foundation, always resolves)
→ **World-Level Overrides** (an optional Tint pool + Details pool, entirely optional, falls back
cleanly if absent) → there is **no mechanism for a World to silence Foundation**, only to add a
tint and details pool on top, enforced structurally rather than by convention.

A genuine open question worth deciding before authoring "dozens of Worlds": should every World
get a fully bespoke atmosphere, or should there be a small library of reusable **Archetype
Tints** (indoor/warm, outdoor/open, underwater/muffled, airy/high) that most Worlds select from,
reserving fully bespoke **Signature Tints** for flagship/Official Worlds? The latter is far more
sustainable for years of content growth and mirrors the Official-vs-Imported distinction the
Theme Registry already makes elsewhere.

## Folder structure and naming (long-term vision)

Following the Product-Asset-vs-World-Asset split already documented in `docs/PRODUCT_ASSETS.md`
/`docs/WORLD_ASSET_CONTRACT.md`:

```
assets/atmosphere/
  foundation/            (Product Asset)
    pool/foundation-bed-01.mp3 ... 06.mp3
  stings/                (Product Asset, universal UI feedback)
  worlds/                (World Assets, per-World, self-contained)
    <world-id>/
      tint/pool/...
      details/pool/...
      manifest.json
```

Naming: `<scope>-<role>-<descriptor>-<index>.mp3`.

## Scalability, weather/time-of-day, performance, preload, crossfade

- Every World's atmosphere is self-contained in its own folder + manifest — adding World #40
  touches zero existing code or assets; the runtime reads a World's manifest generically, zero
  hardcoded World-id branches (the same static-scan-verifiable discipline `CompanionEngine`/
  `CompanionDirector` already hold to).
- **Weather/time-of-day** (optional, future): an optional Modifier tier between World Tint and
  Living Details ("rain," "dusk hush"). A modifier should *substitute*, not add — replacing the
  World's base Details pool rather than stacking a fourth concurrent layer, protecting the
  low-concurrency, low-fatigue promise. At most one modifier active at a time.
- **Performance**: small concurrent audio graph is cheap; the real risk is decoding every
  World's assets into memory at once — solved by lazy per-World loading only.
- **Preload**: Foundation + universal Stings at boot; World Tint/Details load lazily only when
  that World activates.
- **Crossfade**: equal-power curves for bed-to-bed transitions (a naive linear crossfade
  produces a perceptible dip mid-transition); ducking fades fast down, slow release.

## Sonic brand identity

The Foundation Bed is the single most powerful lever for instant recognizability — the one
sound present in every session regardless of World, functioning like a studio ident, except
never a jingle (explicitly forbidden). What makes it recognizable is a specific, describable
timbral fingerprint, concrete enough that future ElevenLabs prompts can chase the same target
rather than "calm ambient" drift — something like *the sound of a handmade page settling in a
warm, sunlit room, with the faintest hint of a music box left slightly ajar.*

A genuine sonic-logo moment is worth reserving for the single most emotionally significant beat
already in the product — the Creator Ceremony's hatching moment — rather than inventing a new
jingle-moment.

The "avoid" list is itself part of the differentiator: Ghibli and Pixar are recognizable partly
by what they *don't* do. Almost every competing kids' creative app leans on cheerful melodic
loops; being the one platform that instead sounds like a real, breathing place rather than a
game is the brand.

A future companion document, `docs/ATMOSPHERE_SONIC_CANON.md`, would play the same role
`docs/STUDIO_DESIGN_CANON.md` already plays for visual identity — a concrete creative brief
(timbral vocabulary, forbidden list, reference adjectives) so Worlds authored by different
people over years still sound like one universe.

## Open questions carried forward (not resolved here)

- Overlap with the separately-locked **Audio Studio** roadmap item (per-card child narration) —
  do the two ever need to duck against each other, and if so, is that a job for a future
  Atmosphere Director?
- Does atmosphere ever run during the Traveller Gateway cinematic, or stay scoped to the Hall/
  Workspace (the Gateway already has its own complete, bespoke sound design)?
- Does World Builder itself (the Theme-Author-facing tool) get atmosphere too?
- Who authors World-level content long-term — hand-supplied files (today's model, matching how
  Lumo's voice and Story Egg's art are supplied), or an eventual World Builder authoring UI?
