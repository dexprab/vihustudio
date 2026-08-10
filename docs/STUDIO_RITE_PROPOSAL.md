# Studio Rite — Architecture & Implementation Plan

**Status: architecture aligned to locked product decisions. No implementation
code has been written.**

Studio Rite is approved product direction (Studio Rite Product Decision,
Decisions 1–10). This document realises it within the existing architecture,
preserves VihuPlanet canon, and keeps implementation impact minimal. The canon
itself is `docs/COMPANION_CANON.md` → **Canon 6**.

An earlier revision of this file recorded three open questions against frozen
canon. **All three are now answered** — Decision 5 (Lumo guides), Decision 7
(the Rite ends before Publish), and Decision 4's own word list (Traveller, not
Visitor). Part I records how each decision lands; Part II is the architecture.

---

## Part I — Canon alignment

Every decision checked against frozen canon. **No decision is technically
impossible, and none contradicts frozen canon.** One carries a constraint
worth stating precisely (D6).

| Decision | Canon status |
|---|---|
| **D1** Studio Rite exists, mandatory, once | New capability. Recorded as Canon 6. No conflict |
| **D2** Answers *Where am I? · Who am I? · What do I do here?* | No conflict. Becomes the Rite's three-act structure (§2) |
| **D3** Teach through creation, never explain tools | No conflict. Constrains the step design (§5) |
| **D4** Establishes Traveller · Creator · Story · Companion | Resolves the vocabulary split — the platform says **Traveller**. `COMPANION_CANON.md` and `KID_JOURNEY.md` updated to match the product, the Gateway, the registry and the code |
| **D5** Lumo guides; Story Egg unchanged | **Canon 1 untouched.** Canon 2 gains one widened clause: Lumo appears at *the two thresholds* rather than only the Creator Ceremony |
| **D6** The Egg accompanies and reacts through animation | No conflict, with one real constraint — see below |
| **D7** Rite ends before Publish; never triggers the Ceremony | **Canon 4 preserved exactly.** One clarifying sentence added: "first" means first *real* Publish |
| **D8** Rite extends the Gateway, one continuous journey | No conflict, and it removes a change the earlier revision had proposed — see below |
| **D9** Existing Creators grandfathered by existing mechanisms | No conflict. `MagicCard.list().length > 0` already answers this |
| **D10** Companion assumes the Rite is complete | No conflict. Narrows `docs/COMPANION_V1_PROPOSAL.md` §3.2 scope only |

### D6 — the Egg's reaction vocabulary is exactly five poses

Decision 6 asks the Egg to react emotionally through animation. Canon 1 says
it *"never receives emotional poses such as `happy`/`sad`."* Both hold
simultaneously, and the resulting set is small and worth naming so the Rite is
authored against it rather than discovering it late:

| Canonical Traveller pose | Available to the Rite? |
|---|---|
| `idle` · `curious` · `thinking` · `excited` · `sleep` | **Yes** — real art shipped, all five |
| `hatching` | **No** — Creator Ceremony only (D7 forbids it outright) |
| `magic` | **No** — Ceremony's Glow beat; also no art yet |
| `hero` | No art yet (disclosed under Asset Registration) |

**Five real poses**, verified against `assets/story-egg/` on disk. That is
enough for a warm, reactive presence — `curious` when Lumo asks something,
`thinking` while the child works, `excited` when something lands, `idle`
between, `sleep` if they pause — and it needs no new art and no canon change.

### D8 — the Gateway needs no change at all

The earlier revision recommended editing the Gateway's opening line, because
`'Welcome, Traveller.'` names the child a Traveller without explaining it —
very likely the direct cause of the user-test finding.

**Decision 8 resolves this better, and without touching the Gateway.** The
Gateway's existing Lumo script (`js/gatewaySequence.js:163-166`) already runs:

```
'Welcome, Traveller.'           / "You've found the Gateway."
'I am Lumo.'                    / "It's wonderful to meet you."
'Guardian of Story Companions.' / 'I help stories come to life.'
'Every Creator begins here.'    / 'And every story begins with a spark of imagination.'
```

The word is not unexplained — it was merely *unfinished*, because the Gateway
handed straight off to Studio Home. With the Rite continuing immediately, in
the same voice, from the same guide, "Welcome, Traveller" becomes the moment
the word is **introduced** and the Rite becomes the moment it is **answered**.
One continuous journey, exactly as Decision 8 specifies.

**`js/gatewaySequence.js` is not modified.** Nor is the Gateway redesigned.

---

## Part II — Architecture

### 1. The smallest implementation

One new module and two changed lines.

| Item | File | Note |
|---|---|---|
| The Rite | `js/studioRite.js` *(new)* | Classic IIFE on `window`, one `<script>` tag in `index.html`'s existing block. No build step, no framework, no dependency |
| The gate | `js/app.js` | Two call sites wrapped |
| Canon | `docs/COMPANION_CANON.md` | Canon 6; done |

Reused rather than rebuilt:

| Need | Existing mechanism |
|---|---|
| Staging Lumo on a centred stage | `js/magicCardUI.js`'s Creator Ceremony stage — same pattern, already proven |
| Beat sequencing | `CompanionDirector.getCeremonySequence()`'s data-driven beat shape |
| Mounting Lumo / the Egg | `CompanionEngine` + `loadRegistry()` + `_resolveEntityIdByRole(list,'guardian')` |
| The Rite's project | `CreationFlow` / `ProjectManager`, normal path, fixed theme |
| Page and object work | `PageOps`, `SceneEngine`, `PageRuntime` — untouched |
| Creator detection | `MagicCard.list()` / `MagicCard.getActive()` |
| Traveller vs Creator guide | `CompanionDirector.detectMode()` — **already implements "the guide depends on lifecycle"** |

### 2. The Rite's structure — Decision 2's three questions

Decision 2 gives the Rite its acts, and Decision 3 gives each act its method:
the answer is never told, it is produced by making something.

| Act | Question | Answered by | Vocabulary introduced |
|---|---|---|---|
| I | **Where am I?** | Lumo continues straight out of the Gateway; the child sees the place they have arrived in | Traveller, Story |
| II | **Who am I?** | The child makes their first page and puts a character on it — they are the one who makes things here | Creator |
| III | **What do I do here?** | Move it, size it, name it, finish it — the rhythm of creation, performed | Companion (via the Egg's presence) |

The Rite ends when the tiny story is finished (D7): celebrated, kept, **not
published.**

### 3. Entry flow

**Today**

```
preload gate → Traveller Gateway → _beginBoot() → restore-session? → Studio Home
```

**Proposed** — one insertion, marked `←`

```
preload gate
   → Traveller Gateway              (unchanged — D8)
   → StudioRite.gate()              ←  NEW
        ├── complete → straight through, zero delay
        └── incomplete → Lumo continues → real canvas → tiny story → unlock
   → _beginBoot()
   → Studio Home
```

For every existing Creator and every returning user, this adds **one
synchronous flag check** to boot and nothing else.

### 4. Routing changes

Two call sites in `js/app.js`, in `_runBootstrap()` and `_afterGateway()`:

```js
// today
GatewaySequence.begin(_beginBoot);

// proposed
GatewaySequence.begin(function(){ StudioRite.gate(_beginBoot); });
```

`StudioRite.gate(next)` — if complete, call `next()` immediately; otherwise run
the Rite and call `next()` when it finishes.

Three properties:

- **`HOME_RETURN_FLAG` already works.** A Home-button reload skips the Gateway
  today and will skip the Rite the same way — correct, since a mid-session
  return is not a first arrival.
- **Fail-open, per platform convention.** A missing or broken
  `js/studioRite.js` falls straight through to `_beginBoot()`, guarded with
  the codebase's standard `try{ if(typeof StudioRite!=='undefined') }`, exactly
  as `GatewaySequence` already is.
- **The Rite is not skippable.** The Gateway wires `onSkipClick()` so a tap
  advances; the Rite deliberately does not, because D1 makes it mandatory.
  A disclosed, intentional difference between two adjacent boot slots — not an
  oversight.

### 5. Lifecycle changes

**None to any existing lifecycle.** That is the design's whole point.

| Lifecycle | Change |
|---|---|
| Authentication / identity | None. Gateway Scene 3 and `MagicCardUI.beginCreatorSignature()` untouched |
| Story Egg | None. Silent, Traveller-only, still vanishes at the Ceremony (D5) |
| Creator | None. `MagicCard.claim()` still happens at the Awakening |
| First publish | None. `shouldOfferAwakening()` still fires on the first real publish (D7) |
| Companion init | None to `CompanionDirector.init()`. The Rite stages Lumo transiently and tears him down before `_beginBoot()` runs, so Studio still mounts the right persistent companion through the existing `detectMode()` path |
| Gateway | None (D8) |

One **additive** state: Rite completion (§7).

### 6. Guide responsibilities during the Rite

| User | Guide | Story Egg |
|---|---|---|
| First-time Traveller | **Lumo**, continuing from the Gateway | Present, accompanying, animation only — five poses (§D6) |
| Returning Creator | Never sees the Rite (D9) | — |

**Lumo is torn down when the Rite ends.** Canon 2 keeps him out of the ongoing
widget; after the Rite, `_beginBoot()`'s existing `CompanionDirector.init()`
mounts the Story Egg exactly as it does today.

Decision 6 is a real design requirement, not decoration: the Rite must
*strengthen* the child's bond with the Egg. The Egg is the constant presence
across the whole Rite, reacting to the child's own actions — Lumo speaks, but
the Egg is the one who is *with them*.

### 7. Unlock mechanism

```js
localStorage['vihu.studioRite.v1'] = '1'
```

`StudioRite.isComplete()` returns true if **either**:

1. the flag is set, **or**
2. `MagicCard.list().length > 0` — the grandfather clause.

Written only when the Rite genuinely finishes. There is no skip, so there is
no path that writes it otherwise.

### 8. Migration for existing Creators (D9)

**No migration system. No backfill. No schema change.** Decision 9 asks for
existing mechanisms, and one already answers the question exactly:
`MagicCard.list().length > 0` is already true for every existing Creator and
already false for every Traveller, and it is already loaded at boot.

| Existing user | Experience |
|---|---|
| Creator with a claimed card | Unchanged. Never sees the Rite |
| Traveller with local projects, never published | Sees the Rite once; **their projects are untouched** |
| New user | Gateway → Rite → Studio |

The middle row is the only behaviour change, and it is intended: someone who
has not published has not been through the Ceremony and does not yet hold the
vocabulary.

**The Rite's project is kept, not discarded** — a normal project, named by the
child in Act III, appearing in My Projects like any other. D3 says the child
should finish having successfully created something; keeping it is what makes
that true.

### 9. Implementation roadmap

**R1 — The gate and the unlock.**
`js/studioRite.js` with `gate()` / `isComplete()` / `markComplete()`, the two
`js/app.js` call sites, the grandfather clause. The Rite itself is a stub that
completes immediately.
*Ships:* nothing visible — deliberately. Proves every existing user's boot is
unchanged before any experience is built on it.
*Risk:* low, fully reversible.

**R2 — Act I: Where am I?**
Lumo staged on the ceremony-pattern stage, continuing straight out of the
Gateway, with the Egg present and reacting. Ends by handing off to Studio.
*Ships:* a continuous, coherent arrival. Addresses the user-test finding on
its own, before any creation step exists.
*Risk:* low — additive, no editor involvement.

**R3 — Acts II & III: Who am I? / What do I do here?**
The Rite creates a real project on a fixed theme; the child makes a page, adds
a character, moves it, sizes it, names it. Uses `PageOps`, `SceneEngine` and
`PageRuntime` as-is. No menu tours, no tool explanations (D3) — Lumo asks for
something and the making teaches it.
*Ships:* teach-through-creation for real.
*Risk:* medium — the only milestone touching the editor. The step gating must
not fight existing selection or Context Panel behaviour.

**R4 — Completion and unlock.**
The tiny story is finished and celebrated, **not published** (D7); the flag is
written; Studio Home unlocks; the project is kept.
*Ships:* the full Rite.
*Risk:* low.

### 10. Risks

| Risk | Mitigation |
|---|---|
| **Time to first creation.** Gateway + Rite back to back could be long for a child | Acts are short and creation starts in Act II; R2 ships separately so the length is measurable before R3 lands |
| **Mandatory + unskippable** is a strong constraint if any step can wedge | Every step needs a guaranteed-completable path; the gate must fail open on any error rather than trap a child before Studio |
| **The Rite's project polluting My Projects** | It is a real project the child made and named — treat it as one, not as a special-cased artifact |
| **Clearing storage repeats the Rite for a Traveller** | Accepted; identical to how local projects already behave. Creators are protected by the Magic Card |
| **Lumo leaking into Studio** | Explicit teardown before `_beginBoot()`; Canon 2 forbids the standing widget |
| **Drift from Companion v1** | D10 narrows `docs/COMPANION_V1_PROPOSAL.md` §3.2 only; ship the Rite first if both are queued |

---

## Effects on adjacent initiatives

**Companion v1** — scope reduction, not an architecture change.
`docs/COMPANION_V1_PROPOSAL.md` stands as written; only `vocabulary.json` gets
smaller, since the Rite establishes Traveller, Creator, Story and Companion
(D10).

**Motion Publishing** — no effect, confirmed rather than assumed. The Rite
touches boot routing and the editor, and never reaches `js/publishStudio.js`,
Magic Publish, or any Publish stage. That is not incidental; it is D7.

**Story Journey** — nothing here builds toward it. No recording, no timeline,
no replay, no storage model, no event model.

---

## Canon updates applied

| Document | Change |
|---|---|
| `docs/COMPANION_CANON.md` → Canon 6 | Studio Rite recorded, with the three questions answered |
| `docs/COMPANION_CANON.md` → Canon 2 | Lumo appears at **the two thresholds**; set closed at two |
| `docs/COMPANION_CANON.md` → Canon 4 | "First" means first *real* Publish; the Rite can never consume it |
| `docs/COMPANION_CANON.md`, `docs/KID_JOURNEY.md` | "Visitor" → "Traveller"; `role:"visitor"` corrected to `role:"traveller"` to match the registry |
| `docs/KID_JOURNEY.md` | New Stage 0 — Studio Rite, marked not-yet-implemented |
| `CLAUDE.md` | Locked Product Decision 8 |

**Canon 1 (Story Egg) and Canon 3 (Story Companions) were not touched.**

---

*No implementation has begun. This document is the approved product direction
realised as architecture, awaiting build sign-off under `CLAUDE.md`'s standing
rule.*
