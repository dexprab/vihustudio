# The Ether Generative Mystery & Challenge Engine

Built in the Generative Mystery & Challenge sprint (build 0766), on the
foundation `docs/ETHER_MYSTERY_CHALLENGE_ARCHITECTURE.md` laid. That
document defines what a Mystery, a Challenge and a Discovery ARE; this
one describes the system that lets the Ether continually create new
ones from a small vocabulary — without a catalogue of hardcoded
activities, and without a model anywhere in any child-facing path.

The governing separation, kept structurally:

```
THE CHILD  experiences the Ether.
THE COMPOSER (js/etherExperience.js)  conducts it — WHETHER/WHEN/WHERE.
THE GENERATOR (offline, tools/ether-mystery-lab/)  expands what it
  knows how to express — asynchronously, never in the hot path.
THE VALIDATOR (js/etherGrammar.js)  protects it — nothing enters the
  approved pool around it.
```

---

## 1. The layers

### js/etherGrammar.js — vocabulary, schema, validator, contract

- **GRAMMARS** — ten reusable experience shapes: reconstruct · connect
  · uncover · transform · trace · complete · experiment · notice ·
  return · echo. A grammar describes what can happen, what ingredients
  it may use, how a child can engage, what kinds of discovery can
  result. It is never a finished activity.
- **CAPABILITIES** — the whole of what a candidate may ask the runtime
  to do: shows (`shard · mark · glint · veil · link`), places
  (`near-look · far · scattered · ring · at-anchor · toward-creation`),
  actions (`tap · approach · dwell · return · wait` — touch-first, no
  hover, no keyboard, no dexterity, no speed), responses (`gather ·
  brighten · reveal · link · dissolve · drift-away`), outcomes
  (`discovery · unresolved · dissolve`), discoveries
  (`creation-revealed · wonder · place`), and hard bounds (≤8 element
  rows, ≤10 placed things, ≤6 engagements, ≤150 s lifetime, ≤3
  possible endings).
- **SCHEMA** — the only keys a candidate may carry, at each level.
  The validator denies by shape (Decision 33's discipline): an unknown
  key at any depth is refused by name, so a field a future generator
  invents is refused by default. Forbidden keys (stars, card, owner,
  email, memories, orbit, circle, token, …) refuse the candidate whole
  at any depth; forbidden value shapes (executable code, markup,
  URLs, addresses) likewise; free text is scanned for gamification,
  frightening content and instruction-speak.
- **Quality rules** — an experience with a guaranteed discovery and no
  question posed is refused; an `experiment` that cannot stay
  uncertain is refused (tap→sure-thing is the one lesson the ripple
  must never teach); a candidate whose structural signature matches an
  approved experience is refused as a reskin.
- **contract()** — everything a generator is handed, built by the one
  module so the lab, the suite and any future pipeline share one copy:
  the grammars, the capabilities, the schema, the public creative
  structure of available creations, a pool summary (for demand-aware
  generation) and the boundaries in words.
- **demand()** — should anything be generated at all? Useful when the
  pool is thin, grammars are unused, or one grammar dominates — never
  because a clock rang.

### js/etherCreationLens.js — the one projector

A creation is an ingredient; a Creator is not. Every entity the lens
is handed comes from the shared feed, already public by construction
(Decision 15). The lens CONSTRUCTS a projection field by field —
kind, title, page count, cover art, current place — so nothing private
can arrive by being adjacent to something public; there is no trimming
step to keep complete forever. `structure()` is the even smaller view
a generator may see: kind, page count, whether a cover exists — no
image bytes, no position, no title. Nothing from `NEVER` (creator,
username, companion, publishedAt, source, cheers, …) survives into
either.

### assets/ether/experience-pool.js — the approved pool

Validated experience DATA, never code, shipped with the application —
the canon-repository pattern (Decision 13): entering or leaving the
pool is a reviewed commit, never a runtime act, so the runtime has no
network dependency and no generator. Entry lifecycle: generate →
validate → approve (a person reviews and commits, status `active`) →
activate (loaded and offered) → retire (status flipped with a written
reason; the entry stays for the record and is never selectable) /
reject (refused at validation, with reasons). Every entry is
re-validated at load by `js/etherMystery.js` — a poisoned file cannot
reach the Composer. Source labelling is honest: `fixture` means
hand-written seed; `generated` is reserved for real model output
through the lab, and none exists yet.

Ships with five active experiences across five grammars (reconstruct ·
uncover · trace · connect · notice — three creation-bound, two
Ether-native) and one retired one, whose `retiredBecause` documents
the retire path: "the ripple already owns this question".

### js/etherMystery.js — the interpreter and stage

A provider, exactly as `js/etherLife.js` and `js/etherRipple.js` are
providers: it owns HOW a generated mystery looks and moves — cover
shards, faint stars, glints, a veil, joining lines, on one canvas
beneath the story plane — and gives up every WHEN/WHETHER decision to
the Composer. **It has no scheduler and begins nothing by itself**; a
`begin()` can only come from the Composer's own `perform()`.

- **Binding** — a creation-bound candidate is instantiated at begin
  time against a real public creation chosen from the live universe
  (far and unmet preferred, the discovery composition's own taste), so
  one pool entry × different creations × different world states =
  materially different experiences with zero bespoke activity code.
- **Engagement** — per-element proximity uses the creatures' own
  notice grammar (nearness lags, and counts only after a recent act);
  taps arrive through the Composer, which asks the mystery FIRST when
  one is posed (the tap-ownership chain gains a link, not a rival);
  dwell, return-within-the-visit and wait are read from the same
  session-scoped state everything else derives from.
- **Resolution** — when every armed element is engaged, the outcome is
  drawn from the candidate's `possible` set: a discovery
  (`creation-revealed` sends a travelling light to the creation's own
  Spirit and rests a halo there — drawn on this canvas, nothing
  written to any entity, the jellyfish's precedent; `wonder` blooms
  through `life.bloomAt`), or `unresolved` — a first-class ending.
  An untaken mystery dissolves on its bounded lifetime: a question is
  never a debt.
- **Residue** — a candidate may declare that its ending leaves
  something behind (a long-lived faint mark through `life.markAt`).
  The Composer records the place as a `residue` anchor, which the
  existing echo patterns (`echo-bloom`, `convergence`) and future
  `at-anchor` mysteries can target — the structural seam for
  Mystery → Discovery → new Mystery.
- **Bounds** — one live instance, ≤10 placed things, ≤4 transient
  effects, a hard lifetime, a closing fade, and an idle stage that
  costs nothing (the canvas is cleared once when the last thing fades,
  never scrubbed per idle frame). Nothing accumulates; nothing is
  stored (Decision 19); reduced motion mounts the whole layer inert.

### js/etherExperience.js — the Composer stays the authority

The seam is `opts.mystery`, and it is optional: with no provider the
composer is byte-for-byte the baseline sky (measured). With one:

- Pool experiences join `decide()`'s one weighing as rows of data —
  same rarity tiers, same per-visit disposition (drawn lazily per
  grammar), same phase rules, same quiet line. Availability refusals
  (`no-suitable-creation`, `mystery-live`) land in the decision log by
  name.
- **The novelty identity of a generated row is its GRAMMAR**
  (`mystery:<grammar>`), so the Ether may reuse an ingredient freely
  and is still punished for repeating a kind of experience — §13 of
  the brief, riding the existing history ring with no second history
  system.
- A resolved mystery is a find: the sky rests after it (40–90 s), the
  place becomes an anchor, the story's ledger depth rises. A dissolved
  one costs nothing. The beckon and all other patterns stand down
  while a mystery is posed — never two invitations at once.
- A touch on a posed mystery belongs to the mystery, asked before the
  composer's own touch answers — logged as `mystery` in the decision
  ring, visible under `?etherdebug=1` like every other decision.

### tools/ether-mystery-lab/ — generation, offline

`run-lab.js` prints the demand verdict, assembles the real generation
contract, runs the candidate battery through the real validator, and
states plainly where a real model plugs in: HERE, offline, with the
operator's own credentials — never the browser, never the runtime.
`fixtures.js` is the one copy of the candidate fixtures — four valid
candidates proving the vocabulary expresses grammars beyond the
shipped pool (transform, echo, complete, return), and sixteen
adversarial candidates the validator must refuse with named reasons
(generated code, gamification, privacy leaks, hover, deadlines,
unbounded pieces, smuggled mechanics, frightening content,
instruction-speak, unknown grammars, sure-thing experiments,
reskins, malformed output).

**The honest constraint:** no model provider is reachable from the
build environment (Decisions 38 and 51 record exactly this), so no
model has ever produced a candidate here and nothing pretends
otherwise. The schema, validator, pool, demand reasoning and
generator seam are real and fully tested; the model's own creative
quality is unverified until one is connected.

---

## 2. What was deliberately not built

No MysteryBrain/ChallengeBrain/EtherBrain, no LLM-driven Composer, no
second scheduler, no runtime generation queue, no per-child persistent
mystery state, no quest system, no puzzle engine, no game framework,
no content-management UI, no child-facing menu of any kind, no
hundreds of experiences (five active ones prove the architecture), and
no runtime network dependency. The mystery/challenge foundation
document's §7 gaps 2–4 (child-first connections, noticed-ness for sky
patterns, behaviour-driven long-session depth) remain open; gap 1 (a
discovery that poses the next question) is now structural through
residue anchors.

## 3. The suite

`tools/ether-mystery-test/run-ether-mystery-tests.js` (63) — statics
(runtime isolation, vocabulary scans with comments stripped, pool
validation at load, lens privacy, the adversarial battery), the
grammar interpreter in Node (same grammar / different worlds →
materially different experiences; reconstruct, uncover, trace,
connect and notice end-to-end; tap ownership; bounded lifetime;
reduced motion), the conducted stack (the composer chooses, one at a
time, novelty by grammar, 72–77 % of a two-hour visit quiet, zero
network requests, refusals by name, a poisoned pool entry refused at
load), and the real browser (the real journey, real taps through the
real ownership chain, a phone-profile finger, reduced motion,
`?etherdebug=1`, nothing left behind across cycles). Five load-bearing
checks proved by temporary reversion. Port: 8905
(`ETHER_MYSTERY_PORT`).
