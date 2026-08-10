# Studio Rite — Architecture Proposal & Canon Review

**Status: proposal only. No implementation code has been written.**

The product owner asked for two things: an architecture for inserting Studio
Rite before Studio Home, and a genuine challenge of the vision against
existing VihuPlanet canon — *"Do not silently change behaviour."*

The challenge comes first, because **three of its findings change what should
be built**, and one of them cannot be resolved without a product decision.

---

## Part I — Canon Review (the challenge)

### C1. The Story Egg cannot guide the Rite — canon forbids it three ways

**This is the central conflict, and it is head-on.**

The brief states: *"First-time user — Guide: Story Egg / Lumo. The Story Egg
introduces the child to VihuStudio and guides them through the Rite. The Egg
should feel alive and encouraging."*

`docs/COMPANION_CANON.md` → **Canon 1 — Story Egg** (frozen):

> - Has no face.
> - Has no limbs.
> - **Never speaks.**
> - Expresses itself only through pose, glow, and magical effects.

And **Visitor Behaviour** (frozen):

> During Visitor mode, quiet accompaniment only — **no speech bubbles, no
> onboarding dialogue, no tutorial.**

A guide that introduces, explains and encourages is speech, dialogue and
tutorial — the three things the Story Egg is specifically defined *not* to do.
This is not a technicality. The Story Egg's silence is load-bearing: it is
what makes it "potential waiting for a Creator" rather than a character. An
Egg that talks is just a companion the child hasn't bonded with, and the
Creator Ceremony's hatching beat loses its meaning.

**Recommendation: Lumo guides the Rite. The Story Egg accompanies it,
silently.**

This costs almost nothing in canon, because Lumo is *already* the right
character:

| Canon 2 — Lumo (frozen) | Fit for the Rite |
|---|---|
| "Guardian of Story Companions — **keeper of Creator Ceremonies**" | The Rite is a ceremony |
| "Introduces the concept of Story Companions" | Exactly the Rite's vocabulary job |
| Speaks; has `wave`, `talk`, `celebrate`, `curious`, `think` poses | Can actually guide |
| Owned by VihuPlanet, never bonded, never on a Magic Card | Correctly impersonal for a threshold |

Lumo **already introduces himself in the Gateway today** (`js/gatewaySequence.js:163-166`):

```
'Welcome, Traveller.'          / "You've found the Gateway."
'I am Lumo.'                   / "It's wonderful to meet you."
'Guardian of Story Companions.'/ 'I help stories come to life.'
'Every Creator begins here.'   / 'And every story begins with a spark of imagination.'
```

The only canon change needed is one clause in Canon 2: Lumo's appearances
widen from *"only during Creator Ceremonies"* to **the two thresholds — the
Studio Rite and the Creator Ceremony.** That is one sentence, and it is
consistent with everything else Lumo already is.

The brief's own phrasing — *"Story Egg / Lumo"*, with a slash — suggests this
may already be the intent. It needs to be said explicitly, because building it
the other way would require deleting three frozen Canon 1 properties.

### C2. The Rite must not publish — or it consumes the Creator Ceremony

The suggested progression ends *"9. Complete a tiny story. 10. Unlock the
Studio."*

If "complete" means publish, this fires:

```
js/publishStudio.js:1031  MagicCard.shouldOfferAwakening()  →  MagicCardUI.showAwakening()
```

which is the **Creator Ceremony** — `docs/COMPANION_CANON.md` Canon 4, the
single most important moment in the entire product: the Magic Card awakens,
Lumo blesses the Story Egg, it hatches, and a Story Companion chooses the
child forever. It fires **at most once per browser, ever**
(`shouldOfferAwakening`'s own gate).

Spending it on a tutorial story would be an unrecoverable product mistake. The
child's first bonded companion would arrive attached to a throwaway exercise
rather than to the first story they actually meant to make.

**Recommendation: the Rite ends before Publish.** "Complete a tiny story"
means the child finishes making it and sees it — not that they publish it.
The first *real* publish stays the Creator Ceremony. Canon 4 is untouched.

This also keeps the Rite short, which matters (§R3).

### C3. "Traveller" and "Visitor" are two words for the same person

The user test asked *"Who is a Traveller?"*. The word appears in the product's
literal first line — `'Welcome, Traveller.'` — and the platform never defines
it. But it is worse than undefined; **it is inconsistent**:

| Source | Word used |
|---|---|
| `js/gatewaySequence.js` (first line the child ever sees) | **Traveller** |
| `assets/registry.json` — Story Egg's role | `"traveller"` |
| `js/companionDirector.js` — `MODES` | `traveller` |
| Code throughout (`TravellerSaveNotice`, Traveller gate) | **Traveller** |
| `docs/COMPANION_CANON.md` | **Visitor** ×8, Traveller ×1 |
| `docs/KID_JOURNEY.md` | **Visitor** ×14, Traveller ×0 |

The canon documents and the running product disagree on what to call the
child. A Rite whose stated job is *"introduce terms naturally"* cannot proceed
until the platform decides which term it is introducing.

**Recommendation: standardise on "Traveller."** It is what the product, the
Gateway, the registry and the code all already say; "Visitor" survives only in
two docs. Changing the docs is a find-and-replace; changing the product is a
migration. Then update `docs/COMPANION_CANON.md` and `docs/KID_JOURNEY.md` to
match.

*(If the product owner prefers "Visitor", that is fine — but it is then a code
change across the Gateway, the registry role, `MODES`, and
`TravellerSaveNotice`, and should be scoped as such rather than assumed.)*

### C4. The Gateway already violates the Rite's own language rule

The brief states terms *"should not appear unexplained elsewhere in the
product before the Rite is complete."*

The Gateway says **"Welcome, Traveller."** as its opening line, on every
launch, before anything else. Under the new rule, the product breaks its own
constraint in its first four words — and that line is very likely the direct
cause of the user-test finding.

This forces a real ordering decision, and there are only two coherent answers:

- **(a) Rite after the Gateway** *(recommended)* — the Gateway stays the
  arrival, and the Rite is the first chapter *inside*. Scene 1's copy changes
  from `'Welcome, Traveller.'` to something that assumes nothing
  (`'Welcome.'` / `"You've found the Gateway."`), and the word "Traveller" is
  then introduced properly during the Rite. **One copy line changes.**
- **(b) Rite before the Gateway** — the child meets the Rite cold, with no
  arrival, and the Gateway becomes a mid-flow interlude. This inverts an
  entire frozen experience for no gain.

### C5. The premise "Studio Home is the first experience" is not quite right

Studio Home is not first today. The boot order is:

```
bootWithPreloadGate()  →  _runBootstrap()  →  GatewaySequence.begin()  →  _beginBoot()  →  _startCreationFlow()
```

The **Traveller Gateway** is first, on every launch, and it already does part
of the Rite's job — Lumo introduces himself and the concept of Story
Companions. The Rite is therefore not filling an empty slot; it is *extending
an entry experience that already exists*. That makes it smaller than the brief
assumes, and it means the Rite should be designed as the Gateway's second
half, not as a competing front door.

### C6. "The Studio remains locked" needs a precise reading

Steps 4–9 (*create a page, add a character, move it, resize it, add a title*)
**require the real editor**. So "locked" cannot mean the editor is
unreachable.

**Recommendation: "locked" means Studio Home — the creation flow and My
Projects — is unreachable until the Rite completes.** The Rite itself runs
*inside* the real canvas on a real project. This is the reading that makes
"teaches through creation" literally true, and it is the only one that is
buildable.

### C7. Forcing existing Creators through the Rite contradicts their Ceremony

*"Every user must complete Studio Rite exactly once"* would send a Creator who
already has a bonded Companion, a claimed Magic Card and published stories
back through *"create your first page."*

Someone who completed a Creator Ceremony has, by definition, published a story
and been chosen by a Companion. They demonstrably hold the vocabulary. The
brief's own *"if required"* leaves room for this.

**Recommendation: grandfather every existing Creator.** A claimed Magic Card
is proof of completion. Zero migration work, zero insult (§7).

### Summary of the challenge

| # | Conflict | Severity | Recommendation |
|---|---|---|---|
| C1 | Story Egg cannot speak/guide (Canon 1, Visitor Behaviour) | **Blocking** | Lumo guides; Egg accompanies silently |
| C2 | Rite ending in publish consumes the Creator Ceremony (Canon 4) | **Blocking** | Rite ends before Publish |
| C3 | "Traveller" vs "Visitor" — canon and product disagree | **Blocking** | Standardise on "Traveller" |
| C4 | Gateway says "Welcome, Traveller" unexplained | High | Rite after Gateway; change one copy line |
| C5 | Studio Home isn't first today — the Gateway is | Medium | Design the Rite as the Gateway's second half |
| C6 | "Locked" must mean Studio Home, not the editor | Medium | Gate Studio Home; run the Rite in the real canvas |
| C7 | Existing Creators forced to re-onboard | High | Grandfather anyone with a claimed Magic Card |

**C1, C2 and C3 should be resolved before implementation begins.** The rest
are recommendations that can be adjusted during build.

---

## Part II — Architecture Proposal

Everything below assumes the recommended resolutions above.

### 1. Studio Rite architecture

One new module, following the platform's existing shape exactly — a classic
IIFE attached to `window`, loaded by a `<script>` tag in `index.html`'s single
57-script block. No build step, no framework, no new dependency.

| Module | File | Role | Owns |
|---|---|---|---|
| Rite | `js/studioRite.js` | The gate, the step script, the completion flag | A step index and a localStorage flag |

It reuses, and does not reimplement:

| Need | Existing mechanism reused |
|---|---|
| Staging Lumo on a big centred stage | `js/magicCardUI.js`'s Creator Ceremony stage — the exact same pattern, already proven |
| Beat sequencing | `CompanionDirector.getCeremonySequence()`'s data-driven beat shape |
| Companion mounting | `CompanionEngine` + `loadRegistry()`; `_resolveEntityIdByRole(list,'guardian')` |
| Creating the Rite's project | `CreationFlow` / `ProjectManager` — the normal path, with a fixed theme |
| Page/object operations for steps 4–8 | `PageOps`, `SceneEngine`, `PageRuntime` — untouched |
| Knowing whether the user is a Creator | `MagicCard.getActive()` / `MagicCard.list()` |

**The guide-selection logic the brief asks for already exists.**
`js/companionDirector.js:299`:

```js
function detectMode(){
  if(MagicCard.getActive()) return 'creator';
  return 'traveller';
}
```

That is precisely *"the guide depends on the user's lifecycle."* No new
lifecycle model is needed — only a call.

### 2. Updated user entry flow

**Today**

```
preload gate → Traveller Gateway → _beginBoot() → restore-session? → Studio Home
```

**Proposed** — one insertion, marked `←`

```
preload gate
   → Traveller Gateway            (Scene 1 copy loses the unexplained "Traveller")
   → StudioRite.gate()            ←  NEW: complete? pass through : run the Rite
        ├── complete → straight through, zero delay
        └── incomplete → Lumo stages the Rite → real canvas, steps 4–9 → unlock
   → _beginBoot()
   → Studio Home
```

For every existing Creator and every returning user, this adds **one
synchronous flag check** to boot and nothing else.

### 3. Required lifecycle changes

**None to any existing lifecycle.** That is the point of the design.

| Lifecycle | Change |
|---|---|
| Authentication / identity | None. The Gateway's Scene 3 and `MagicCardUI.beginCreatorSignature()` are untouched |
| Story Egg | None. Still silent, still Visitor-only, still vanishes at the Ceremony |
| Creator | None. `MagicCard.claim()` still happens at the Awakening |
| First publish | None. `shouldOfferAwakening()` still fires on the first *real* publish (C2) |
| Companion initialization | None to `CompanionDirector.init()`. The Rite stages Lumo on its own transient stage and tears it down before `_beginBoot()` runs, so Studio still mounts the correct persistent companion via the existing `detectMode()` path |

One **additive** state: Rite completion (§6).

### 4. Required routing changes

The entire routing change is **two call sites in `js/app.js`**, both in
`_runBootstrap()` / `_afterGateway()`:

```js
// today
GatewaySequence.begin(_beginBoot);

// proposed
GatewaySequence.begin(function(){ StudioRite.gate(_beginBoot); });
```

and the same wrap on `_afterGateway()`'s fallback, so a broken
`GatewaySequence` still reaches the Rite.

`StudioRite.gate(next)` is: *if complete, call `next()` immediately; otherwise
run the Rite and call `next()` when it finishes.*

Three properties worth noting:

- **`HOME_RETURN_FLAG` is already handled.** A Home-button reload skips the
  Gateway today and would skip the Rite the same way — correct, since a
  mid-session return is not a first arrival.
- **Fail-open, per platform convention.** A missing or broken
  `js/studioRite.js` must fall straight through to `_beginBoot()` — guarded
  with the codebase's standard `try{ if(typeof StudioRite!=='undefined') }`
  pattern, exactly as `GatewaySequence` already is.
- **The Rite is not skippable.** The Gateway's `wireSkip()` /
  `onSkipClick()` lets a tap skip ahead; the Rite deliberately does not wire
  it, since the decision is that the Rite is mandatory. This is a *different*
  interaction contract living in an adjacent boot slot, and should be an
  explicit, disclosed difference rather than an accident.

### 5. Story Egg and Companion responsibilities during the Rite

| User | Guide | Story Egg | Companion |
|---|---|---|---|
| First-time Traveller | **Lumo**, on a ceremony-style stage (C1) | Present, silent, reacting by pose only — exactly its frozen Visitor Behaviour | Does not exist yet |
| Returning Creator (not grandfathered) | **Their bonded Story Companion** | Gone forever (Canon: never reappears post-Ceremony) | Guides, per the brief |

**Lumo is torn down when the Rite ends.** He must not persist into Studio —
Canon 2 keeps him out of the ongoing widget. After the Rite, `_beginBoot()`'s
existing `CompanionDirector.init()` mounts the Story Egg (Traveller) or the
bonded Companion (Creator) exactly as it does today.

The Story Egg's role during the Rite is unchanged from canon: it accompanies,
poses, glows, and never says a word. The Rite's script may direct its poses —
`idle`, `curious`, `excited` — through the existing `setState()`, which is
pose data, not speech.

### 6. Unlock mechanism

Deliberately the smallest thing that works.

```js
// device-scoped, one key
localStorage['vihu.studioRite.v1'] = '1'
```

`StudioRite.isComplete()` returns true if **either**:

1. the flag is set, **or**
2. `MagicCard.list().length > 0` — the grandfather clause (§7).

Written only when the Rite genuinely finishes. Never written on skip, because
there is no skip.

**Why not cloud-persist it?** Because the only users for whom a device change
matters are Creators, and Creators are grandfathered by their Magic Card,
which already survives device changes through the existing identity flow. A
Traveller who clears storage repeats the Rite — acceptable, and the same thing
already happens to their local projects (`js/projectManager.js`'s "100% local
forever" guarantee). Adding a Supabase column for this would be new
infrastructure for a case that cannot occur.

### 7. Migration strategy for existing creators

**Grandfather everyone with a claimed Magic Card. No data migration, no
backfill, no schema change.**

`MagicCard.list().length > 0` is already true for every existing Creator and
already false for every Traveller. It is checked at boot, synchronously, from
data that is already loaded.

| Existing user | Experience after this ships |
|---|---|
| Creator with a claimed card | Unchanged. Never sees the Rite |
| Traveller with local projects, never published | Sees the Rite once, then continues; **their projects are untouched** |
| Brand-new user | Gateway → Rite → Studio |

The middle row is the only behaviour change for an existing user, and it is
the one the brief actually intends: someone who has not published has not been
through the Ceremony and does not yet hold the vocabulary.

**The Rite's own project is kept, not discarded.** The design principle is
*"Users should finish having successfully created something."* Keeping their
tiny story in My Projects is the literal fulfilment of that. It should be a
normal project with a normal name the child chose during step 8 — not a
special-cased tutorial artifact.

### 8. Implementation roadmap

**R0 — Canon resolution (docs only). Gate.**
Resolve C1 (who guides), C2 (does the Rite publish), C3 (Traveller vs
Visitor). Nothing else starts until these three are answered.
*Ships:* a settled canon. *Risk:* none.

**R1 — The gate and the unlock.**
`js/studioRite.js` with `gate()` / `isComplete()` / `markComplete()` only, the
two `js/app.js` call sites, and the grandfather clause. The Rite itself is a
stub that completes immediately.
*Ships:* nothing visible — and that is the point. Verifies that every existing
user's boot is byte-for-byte unchanged before any experience is built on top.
*Risk:* low, and fully reversible.

**R2 — The Rite shell: steps 1–3.**
Lumo staged on the ceremony-pattern stage, the welcome beats, and the natural
introduction of Traveller and Creator. Ends by handing off to Studio.
*Ships:* a complete, coherent entry narrative, even before the creation steps
exist. Already fixes the user-test finding.
*Risk:* low — additive, no editor involvement.

**R3 — The creation steps 4–8.**
The Rite creates a real project on a fixed theme and step-gates through: first
page → add a character → move it → resize it → add a title. Uses `PageOps`,
`SceneEngine` and `PageRuntime` as-is.
*Ships:* "teaches through creation" for real.
*Risk:* medium — this is the only milestone that touches the editor, and it
needs the step gating not to fight the existing selection and Context Panel
behaviour.

**R4 — Completion and unlock.**
Step 9 (the tiny story is finished and celebrated, **not published** — C2),
step 10 (flag written, Studio Home unlocked, project kept).
*Ships:* the full Rite.
*Risk:* low.

**Deferred, with gates named**

| Deferred | Gate |
|---|---|
| Gateway Scene 1 copy change (C4) | Bundle with R2 — one line, but it is frozen-experience copy |
| Vocabulary standardisation across docs (C3) | R0 |
| Any Story Journey capability | **Out of scope. Do not implement.** |

---

## Part III — Effects on adjacent initiatives

### Companion v1

The brief is right that this simplifies Companion, and it is worth being
precise about how much: it is a **scope reduction, not an architecture
change.** `docs/COMPANION_V1_PROPOSAL.md` stands as written. The only effect
is on §3.2's `vocabulary.json`, which no longer needs to define Traveller,
Creator, World or Companion from nothing — the Rite establishes them, and the
corpus can assume them.

Companion v1's G-milestones and the Rite's R-milestones are independent and
can proceed in either order. **The Rite should ship first** if both are
queued, since Companion v1 explicitly assumes the shared vocabulary exists.

### Motion Publishing

**No effect, confirmed rather than assumed.** The Rite touches boot routing
and the editor; it does not touch `js/publishStudio.js`, Magic Publish, the
reel/strip modules, or any Publish stage — with one exception that is a
*non*-change: the Rite must not reach Publish at all (C2).

### Story Journey

Nothing here builds toward it. No recording, no timeline, no replay, no
storage model, no event model.

---

## Required canon updates (smallest set)

| Document | Change | Why |
|---|---|---|
| `docs/COMPANION_CANON.md` — Canon 2 | Widen Lumo's appearances from *"only during Creator Ceremonies"* to **the two thresholds: the Studio Rite and the Creator Ceremony** | C1 |
| `docs/COMPANION_CANON.md` — new Canon 6 | Record Studio Rite as a platform entity, and state explicitly that the Story Egg's silence is unchanged | C1, and the locked decision |
| `docs/COMPANION_CANON.md` — Canon 4 | One clarifying sentence: the Creator Ceremony is the first **real** publish; the Rite never publishes | C2 |
| `docs/COMPANION_CANON.md`, `docs/KID_JOURNEY.md` | "Visitor" → "Traveller" throughout | C3 |
| `docs/KID_JOURNEY.md` | New Stage 0 — Studio Rite | Keeps the journey doc true |
| `CLAUDE.md` | Locked Product Decision 8 | Standing rule: record approved product decisions |

**Nothing in Canon 1 (Story Egg) or Canon 3 (Story Companions) changes**, and
Canon 4's ceremony sequence is untouched.

---

*No implementation has begun. This document is a proposal awaiting approval
under `CLAUDE.md`'s standing rule that architecture changes require explicit
sign-off. C1, C2 and C3 are open product questions, deliberately left
unresolved here rather than answered silently.*
