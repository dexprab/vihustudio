# Ether Experience Architecture (EXPERIMENTAL BRANCH)

Branch: `claude/ether-experience-architecture`. Production Ether
(main) is the baseline and the fallback; nothing here is merged.

The governing quality is **mystery**. The Ether is a sea of
mysteries — not a container for Stories, not a creature showcase,
not a collection of activities, and never a Story browser. Stories,
Creatures and Creations are things discoverable INSIDE it. The child
should never feel the Ether rotates through a finite set of
animations, and should never be able to state its rules.

---

## 1. CURRENT ETHER ARCHITECTURE (baseline, build 0761)

Two layers plug into the runtime through public seams (Decision 9's
test: `physics.js`, `storyManager.js`, `etherRenderer.js`,
`universe.js`, `ambientSystem.js` contain no reference to them):

- **`js/etherLife.js`** — the creature layer. Owns a registry of
  three constellation beings (whale = points/guide-trail, starbird =
  carries/feather-flight, jellyfish = reveals/pulse), a wonders
  registry (bird · skyfish · starflower), the guide-trail machinery,
  and the beckon. **It also owns scheduling**: a `TIMES` table
  (first arrival 6.5–10 s, then 95–220 s between crossings), an
  internal `nextAt` clock, `LATER_PICKS` weights for which creature
  crosses next, and the beckon's own idle rules (16 s of stillness,
  spacing 22 s, at most 2, stop-forever on a turn). Creatures use
  UNWRAPPED screen coordinates (one crossing then gone — V2.1) and
  the notice grammar requires the Traveller to have ACTED
  (`stillSeconds() < 3`, or a touch) before nearness counts.
- **`js/etherDiscovery.js`** — discovery composition. An
  `ACTIVITIES` registry (follow-the-whale, star-trail), a `compose()`
  that answers "where should this trail lead" (a far unmet Story
  first, a wonder otherwise), one-discovery-at-a-time with a 40 s
  rest after a find, and a `scout()` feeding the beckon a real far
  Spirit. Session memory is module state only (Traveller stateless,
  Decision 19).
- **`js/vihuplanetHome.js`** mounts both at the threshold crossing
  and exposes `window.vihuEtherLife` / `window.vihuEtherDiscovery`.

What the baseline cannot do: it has no memory of experience shape
(only "which Story ids were led to"), no notion of discovery depth,
no variation in a creature's manner (the second whale behaves
exactly like the first), no unresolved mysteries (every noticed
guide-creature leads somewhere), no cross-experience connections, no
spatial model of what the child has explored, and a scheduler that
is a plain interval draw — over a long session it IS a rotation:
crossing every 95–220 s, uniform in structure, forever.

## 2. EXPERIMENTAL ETHER ARCHITECTURE

One new module — **`js/etherExperience.js`** — becomes the central
orchestration layer. The existing modules become **experience
providers**: they keep every drawing, movement, notice-grammar and
trail behaviour they have, and give up the WHEN/WHY decisions.

```
            ETHER (runtime seams, untouched)
                      │ read-only
              ┌───────▼────────┐
              │  WORLD STATE   │  environment · session · discovery ledger
              └───────┬────────┘
              ┌───────▼────────┐
              │   EXPERIENCE   │  candidates → eligibility → novelty ×
              │    COMPOSER    │  rarity × phase → one choice (often: quiet)
              └───┬───────┬────┘
        conducts  │       │ consults
   ┌──────────────▼─┐   ┌─▼──────────────────┐
   │ js/etherLife.js│   │ js/etherDiscovery.js│
   │ (how a being   │   │ (which Story/wonder │
   │  behaves)      │   │  a trail leads to)  │
   └────────────────┘   └────────────────────┘
```

- **World State** (all session-only module state, dies with the page)
  - *Environment*: current view sector (the field's width divided
    into 8 sectors at the story depth), per-sector dwell seconds,
    universe density (`stories.count()`), what is live right now
    (creature, trail, beckon, portal).
  - *Session*: elapsed conducted time, the phase (below), recent
    experience ring, quiet clock, discovery chain length, whether
    the Traveller has ever turned.
  - *Discovery ledger*: per Story entity and per creature family, a
    depth that only rises — UNKNOWN → GLIMPSED → NOTICED →
    APPROACHED → INTERACTED → DISCOVERED → UNDERSTOOD. Derived from
    prox history, life events, and `focus:opened`. Internal only;
    nothing on screen ever names it.
- **Experience history**: a bounded ring of
  `{id, family, pattern, manner, trigger, sector, interaction,
  outcome, depth, t, novelty}` — enough to distinguish "has seen a
  whale" from "has already experienced this exact whale behaviour
  and outcome".
- **Novelty**: a score against the history that penalises repeating
  the same PATTERN (heavily), the same family (recently), the same
  sector (recently) and the same outcome twice running — so the
  preferred sequence is `whale → quiet → tiny anomaly → follow
  something → unrelated discovery → creature behaves unexpectedly →
  quiet → distant creation`, never `whale → starbird → jellyfish →
  whale`.
- **Rarity**: architectural tiers (common / uncommon / rare /
  very_rare / exceptional) implemented as weights PLUS a per-visit
  disposition drawn once at mount — some visits simply never contain
  the exceptional thing, so a rare event cannot become "every N
  minutes". `Math.random`, deliberately not the seeded Rng: one
  visitor's own encounters have no business being reproducible
  (Decision 10's own reasoning for the arrival turn).
- **Rhythm**: conceptual phases ARRIVAL → ORIENTATION → CURIOSITY →
  EXPLORATION → DISCOVERY → DEEP-EXPLORATION → QUIET → RE-IGNITION,
  with transitions driven by behaviour (turning, travelling between
  sectors, finding, going still) and never by a fixed timetable.
  QUIET is a scheduled experience in its own right: after a find the
  sky rests, and an idle child is NOT answered with content.
- **Depth & the unresolved**: a composed experience declares its
  outcome verb — Reveal · Lead · React · Transform · Vanish · Echo ·
  Return · Remain-unresolved. A noticed creature may be told (at
  summon time) to only acknowledge, or to shy away; odd-stars are
  never explained; an echo blooms where something already happened.
  Incomplete knowledge is the point.
- **Connections**: the composer keeps `anchors` — field positions of
  notable past events (where a trail ended, where the whale was
  noticed, where odd-stars glinted). Later experiences may target an
  anchor (a starbird's flight crossing the odd-stars spot; a bloom
  where a trail faded). No popup, no explanation — the child makes
  the connection.
- **Decision log** (dev only): every `decide()` records phase,
  candidates, rejected-because, selected-because, expected child
  action and expected outcome, in a bounded ring. Reachable through
  `window.vihuEtherComposer.diagnostics()`, and printed live only
  under `?etherdebug=1` (consumed like a dev switch, never
  persisted, Decision 13's pattern). Never in the DOM, never shown
  to a child.

## 3. SHARED SYSTEMS THAT MUST NOT BREAK

- The runtime under `vihuplanet/runtime/` — zero edits, checked by
  suite (S1 pattern, extended to the new module).
- The Companion system in every part (no Companion in the Ether
  before a Story opens; the portal host, encounter talk, voice — all
  untouched).
- Deep-link intents `?story=` / `?born=` / `?creator=`, the
  threshold, the arrival turn and the glance (Decision 10), the
  preview/portal, Cheer, the social sky, the share overlay.
- Traveller statelessness: no storage API anywhere in the layer.
- Reduced motion: everything mounts inert.
- The canon suites and derived mind copies (regenerated on this
  branch after the canon edit).

## 4. EXISTING BEHAVIOURS TO PRESERVE

Pinned by `tools/ether-life-test/` (72) and its walkthrough (14),
and preserved observably in conducted mode:

- The first crossing: the whale, 6.5–10 s after the threshold, with
  the guide response armed — the first encounter is the one that can
  lead somewhere.
- Notice grammar (nearness lags, requires a recent ACT; a touch is
  an act; a touch on a Spirit belongs to the Spirit).
- One crossing then gone; departure real; rarity between crossings.
- Trail behaviour: motes, pulse toward the target, 50 s patience,
  bloom on wonder, nothing added to a found Story.
- The beckon's OBSERVABLE policy: ~16 s of untouched stillness →
  one soft edge light, aimed at a real far Spirit when one exists;
  at most two; **stops forever the moment the Traveller turns**
  (Decision 58 — the composer schedules it, the policy is identical).
- One discovery at a time; rest after a find; a far unmet Story
  preferred; wonder fallback in an empty universe.
- Reduced motion inert; zero page errors; nothing stored.

## 5. EXISTING BEHAVIOURS REPLACED / ORCHESTRATED (supersessions)

- `etherLife`'s internal `nextAt` scheduler and `LATER_PICKS` are
  **not used in conducted mode** — the Composer decides when a
  creature crosses, which one, where, and with what manner. (The
  autonomous path remains intact and is what a bare
  `EtherLife.mount()` still does, so existing suites that remount
  through the public API are untouched.)
- The beckon's idle clock moves into the Composer (same observable
  policy; the WHEN is now composed — §17 of the brief).
- `etherDiscovery.attach()` gains an optional conductor; its
  40 s rest and target preference can be steered by the Composer
  (rest becomes the QUIET phase, 40–90 s, behaviour-dependent).
- A noticed guide-creature no longer ALWAYS leads: the Composer may
  summon it with `manner.respond = 'acknowledge'` (react, remain
  unresolved) or `'shy'` (vanish). The second whale is deliberately
  not the first whale (§13).

## 6. THE EXPERIENCE PATTERN LIBRARY (finite systems, many experiences)

| pattern | provider mechanics | rarity | outcome verbs |
|---|---|---|---|
| first-crossing | whale, guide armed | once, scripted | Lead/React |
| guided-way | whale crossing, guide | common | Lead → Reveal |
| carried-way | starbird flight | uncommon | Lead → Reveal |
| reveal | jellyfish pulse | uncommon | Reveal (no path) |
| silent-crossing | any being, acknowledge-only | common | React, unresolved |
| shy-passage | being flees when noticed | uncommon | Vanish |
| distant-passage | small, dim, high band, no notice | uncommon | Remain-unresolved |
| deep-crossing | vast slow whale, far parallax | exceptional | Remain-unresolved |
| beckon | edge light (policy unchanged) | common, bounded | Lead (wordless) |
| odd-stars | faint anomaly mark, unexplained | uncommon | Remain-unresolved → anchor |
| sky-bloom | wonder blooms unprompted, far | rare | Transform |
| echo-bloom | wonder blooms at an anchor | rare | Echo |
| convergence | crossing routed through an anchor | rare | Echo/Return |
| quiet | nothing | the default | — |

Recurrence (§13): each family's next manner is chosen against its
own history, so a whale means something without ever meaning the
same thing. Activities (§19) are the discovery structures the
guided patterns produce — they emerge from world state; there is no
menu and no quest.

## 7. WHAT WAS NOT BUILT, DELIBERATELY

No LLM anywhere in orchestration (§29). No gamification of any kind
(§20). No per-Traveller persistence (§30). No new Companion
behaviour (§33). No new world-boundary behaviour (§31). No
Story-domination: a Story is one possible discovery outcome among
several, and the quiet phase outranks content.
