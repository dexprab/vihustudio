# The Ether Mystery Lab — the browser research instrument

Sprint: build 0767, on the 0766 Generative Mystery & Challenge Engine.
Product decision: CLAUDE.md → Decision 58 (the Ether Mystery Lab
clauses). The Lab is the research instrument; the Ether runtime remains
the product.

## What it is

A standalone, developer-facing browser page —
`tools/ether-mystery-lab/index.html` — that answers one research
question: **can an LLM actually generate delightful Ether Mysteries and
Challenges for children roughly 6–10?** It is not child-facing, not
part of the Ether runtime, and loading it initializes nothing: no
Ether, no Composer, no Traveller state, no storage write, no network
call beyond two same-origin static text reads (the constellation and
creature vocabulary, extracted from the product's own source without
executing it).

The pipeline it operates, end to end:

    SELECT INGREDIENTS (creation via the Lens · sky figures · beings ·
    phenomena) → SELECT GRAMMAR → GENERATE (real LLM or fixtures) →
    STRUCTURED CANDIDATES → THE ONE VALIDATOR (js/etherGrammar.js) →
    CREATIVE QUALITY SCREEN → HUMAN REVIEW → APPROVE → EXPORT

Nothing the Lab does can reach a child: an export is a JSON artifact a
person reviews and commits into `assets/ether/experience-pool.js` by
hand, the canon-repository pattern. The Lab never writes the pool.

## Running it

    node tools/bring-it-alive/test/serve.js 8907 &
    # open http://127.0.0.1:8907/tools/ether-mystery-lab/index.html

The Node entry points survive unchanged:

    node tools/ether-mystery-lab/run-lab.js            # demand + contract + validate
    NODE_PATH=/opt/node22/lib/node_modules \
      node tools/ether-mystery-lab-test/run-lab-tests.js   # the suite (226)

## The three connection modes

The status line top-right never lies: `FIXTURE MODE — REAL LLM NOT
CONNECTED` · `LLM CONFIGURED — NOT TESTED` · `LLM CONNECTED` ·
`LLM UNAVAILABLE`. "Connected" is claimed only after a probe actually
answered. A failed real generation FAILS on screen and never quietly
becomes a fixture batch. Every candidate carries `source: 'fixture'`
or `source: 'generated'`, stamped by the transport that produced it.

### 1. Fixture mode (default)

No network. A deterministic bank of ten hand-written, schema-valid
candidates — one per grammar, signatures distinct from the shipped
pool — walks the identical pipeline so the instrument itself can be
tested and demonstrated. Everything it produces is labelled fixture,
everywhere, including exports.

### 2. Endpoint mode — the secure path (preferred)

`supabase/functions/lab-generate` is the deployable relay: the
provider key lives in the function's own environment and nowhere else
(Decision 25's rule), the caller is derived from the verified session,
the function is **administrators only** (the invite-send precedent —
`platform_admins` asked with the email the auth server returned), and
the `lab-generate` bucket (30/hour) is in the shared `LIMITS` canon.
Failures are one word; no provider error text and no key ever leaves.
Deploy and configure: `supabase/DEPLOY_lab_generate.md`.

In the Lab: choose Endpoint, paste the function URL and an
administrator session's access token, press **Test connection**, then
Generate.

### 3. Direct mode — development only

For the first experiment before anything is deployed: the developer
types their own provider key at runtime. It is held in a closure
variable for the life of the page — never localStorage, never
sessionStorage, never a cookie, never an export, never logged — and
**Disconnect / clear** removes it. The page warns in red. Do not use a
production key here; prefer the endpoint. (The suite proves a typed
key lands in no storage and no export.)

## The privacy boundary, visible

- **Creations only ever travel through the Creation Lens**
  (`js/etherCreationLens.js`) — a generator sees `{kind, pages,
  hasCover}` and nothing else. No maker name, no username, no card, no
  companion, no cover bytes, not even the title. The **"Data sent to
  generator"** panel shows the exact assembled input so the boundary
  can be seen working rather than trusted.
- **The Stars are the absolute exception** (Decision 48). The Lab's
  constellation vocabulary is the FAMILY library only — never any
  identity's cells. `labKit.buildInput()` refuses the whole build,
  before any prompt assembly, if anything supplied carries a
  `pattern`/`cells`/`constellation`/`stars` key or anything shaped
  like serialized cell pairs. Refused means refused: nothing is
  trimmed, nothing is sent, and the diagnostic names the boundary.
- The export artifact is scanned again before it is produced: key
  material or a forbidden shape refuses the export.

## The constellation ground truth

The brief said "88 constellations". **The project holds 18
constellation families** (`js/magicCard.js` → `CONSTELLATIONS` +
`CONSTELLATION_META`; 17 mintable plus Ursa Major, kept for existing
cards). The Lab exposes exactly those — extracted from the source
text so the data cannot drift from the product, verified against
`MagicCard.library()` by the suite — with the metadata that actually
exists (name, family group, star count, hemisphere, the atlas line)
plus one field the Lab authors itself and marks as its own: a
`looksLike` resemblance class (human / creature / mythical / object),
always `suggestive: true`. A whale-like figure must never
automatically become a whale — the ambiguity is part of the Mystery.
Authoring the remaining 70 families is a content decision for the
product owner, recorded as open rather than papered over with a fake
list. **No cell coordinates ever reach the Lab, the page, a prompt or
an export.**

## ▶ PLAY IN ETHER — the visual experience preview

The Lab's primary creative review surface. A candidate card leads with
**MYSTERY**, a plain-language description, and one button; the reviewer
presses it and experiences the candidate inside a real Ether, then
judges it. Nothing on that path requires reading JSON, a grammar id, a
capability name or a schema field — the technical facets are folded
into a `technical details` disclosure beneath the judgement controls.

**It is the real Ether, not a picture of one.** `preview.html` loads
the whole of `vihuplanet/runtime/`, `js/etherLife.js`,
`js/etherRipple.js` and `js/etherMystery.js` — unmodified — builds a
controlled universe with three fixture creations, and hands the
candidate to the **real interpreter** through the **same seam the
Experience Composer uses**: `candidates()` for availability, then
`begin(key, ctx)`. Every element, every drawing, every outcome and
every residue is the interpreter's own. There is no second Mystery
engine and no second renderer, and the suite fails if the preview ever
grows one.

**What is deliberately NOT mounted is the Composer.** The Composer owns
WHEN a mystery may be offered — phase, rarity, novelty, quiet, the
visit's temperament — and a review has none of those questions. The
reviewer's press IS the "when", exactly as `perform()` is in the live
sky. The creature layer mounts CONDUCTED, so nothing crosses the sky
unasked and the preview is about the candidate rather than about
whatever else happened to pass; its `bloomAt()` and `markAt()` are
live, because the interpreter reaches for them on a discovery and a
residue.

**The touch chain is production's.** A tap reaches the ripple layer,
and the posed mystery is asked FIRST about where it landed — the same
order `js/etherExperience.js` uses. Suite-proved by removing the wiring
and watching the check go red.

**No instruction, ever.** Two navigation controls in a corner —
`⟲ Replay` and `✕ Exit Preview` — and nothing else over the sky. No
step list, no caption, no "click this": whether the Mystery
communicates itself is the whole thing being judged.

**Deterministic.** A seeded generator replaces `Math.random` for the
whole run before anything is created, so the same candidate and seed
lay the sky out identically — the star field, the creations' places and
every placement the interpreter draws. The preview also SETS
`vp-runtime-seed` itself: `vihuplanet/runtime/core/rng.js` mints its
session seed on the first call and reads it back afterwards, so a first
play and a replay consumed a different number of draws and produced
different skies (measured: a ring at 509,516 first and 779,544 on every
replay). That key is put back on exit, because the preview tab is
reused across plays and the key must be left as it was found. (When
the preview was a frame the Lab shared its top-level context and
therefore its `sessionStorage`, and the write WAS visible there —
measured, by that sprint's own check going red. A tab has its own, so
the reach is gone rather than merely tidied up after.) What is NOT
claimed is
frame-for-frame identity: breathing, drifting and twinkling run on the
wall clock, so two runs are the same composition rather than the same
film.

**Isolated and disposable.** The preview opens in a **tab of its own**,
which the Lab closes on exit — a separate top-level document with its
own globals, its own universe, its own copy of the providers and its
own `sessionStorage`. A tab rather than a frame because the reviewer is
judging what a sky would feel like to a child, and a child meets it
full-screen with nothing else on the glass: a frame inside the Lab is
the right size and the wrong context, with the batch, the buttons and
the browser's own idea of the page still around it. The Lab stays where
it was, so the review does not lose its place. One tab, opened under a
fixed name and reused, so a second PLAY navigates the one already there
rather than piling previews up — and every play carries an epoch,
because the outgoing document's own farewell report arrives *after* the
next preview has been armed and would otherwise close the tab that had
just opened. A browser that refuses the pop-up is answered with a plain
sentence on the card, never with a preview that silently did not
happen. It never loads
`assets/ether/experience-pool.js`, so the production pool is out of
reach rather than merely left alone; it makes no network call of any
kind, calls no model, and cannot touch a Creator, a card, a memory, a
social record or the live Ether, because none of those modules is
loaded in it.

### Preview unavailable — unsupported runtime capability

`labPreviewSupport.js` holds `REPRESENTED`: a **written-down** table of
everything `js/etherMystery.js` has a real branch for. It is written
down rather than derived, because a check that reads its expectations
from the thing it is checking proves nothing — and the suite holds the
table against the interpreter rather than the other way round.

`js/etherGrammar.js` approves a slightly wider vocabulary than
`js/etherMystery.js` performs, and the gap is not a bug in either. What
matters is that it is never papered over. A candidate naming something
unperformable gets **Preview unavailable — unsupported runtime
capability**, one plain sentence saying which, no PLAY button, and its
🌟/✨ approvals disabled — kept out of the creative approval path,
still reviewable as 🟡 or 🔴.

| Capability | Represented? |
|---|---|
| shows: shard · mark · glint · veil · link | all five |
| places: near-look · far · scattered · ring · at-anchor · toward-creation | all six |
| actions: tap · approach · dwell · return · wait | all five |
| responses: gather · link · reveal · drift-away · dissolve | five of six |
| responses: **brighten** | **no branch — unpreviewable** |
| outcomes: discovery · unresolved · dissolve | all three |
| discoveries: creation-revealed · wonder · place | all three |
| residue show: mark | yes |
| residue show: **glint** | **always drawn as a mark — unpreviewable** |
| `of: 'cover'` on a shard | yes |
| `of: 'sky'`, or `of` on a non-shard | **unpreviewable** |
| `creationKind: 'story'` | yes (the only kind the Ether holds) |
| `creationKind:` anything else | **unpreviewable** |
| `ingredients.minPages` above 0 | **unpreviewable** — see below |
| `ingredients.anchor` | yes, with an earlier place STAGED and disclosed |

All ten grammars are previewable in principle: the interpreter is
grammar-agnostic, and `grammar` is used only for novelty identity and
diagnostics. What decides a preview is the CAPABILITIES a candidate
names, not its grammar. Measured over the shipped pool: all five active
experiences preview; the one retired entry does not, for `brighten` —
which is the rule catching precisely the entry the runtime cannot
perform.

**A finding worth acting on.** The Lab's own fixture bank uses
`brighten` four times and a glint residue twice, so a third of a
fixture batch is unpreviewable. A generator will do the same. The
choice is a product one: teach `js/etherMystery.js` those two
capabilities, or narrow `js/etherGrammar.js` to what the runtime
performs. Nothing was decided here.

**`minPages` is fidelity, not laziness.** The runtime's own story
entity (`storyEntity.js`) carries no page count, so
`js/etherCreationLens.js` reports 0 pages for every real Spirit in the
live Ether too. A candidate asking for a minimum page count would find
no creation in production either, and the preview must not be kinder
than the sky. No entry in the shipped pool uses it.

**A mystery with nothing to do ends on its first frame.** Measured in
the preview, which is what a preview is for: with no element armed and
no wait pending, the interpreter's own `resolveDone()` is satisfied
immediately and the whole experience resolves before a child could look
at it. That is the runtime's behaviour and this sprint did not change
it. The candidate is performable, so it is not refused — the reviewer
is warned instead, because a preview that appears and goes reads as a
broken preview. A second thing for a product decision to settle: the
`notice` grammar's whole point is something sitting there to be
noticed, and today an observation-only candidate cannot.

**Staged, not faked.** An anchored candidate is ABOUT a place met
earlier in the visit, and a preview has no earlier — so one is staged
with the sky's own faint mark, through the same `life.markAt()` call a
residue uses, and the reviewer is told it was staged rather than left
to think the sky remembered something.

### After the preview

Exiting shows **What the preview demonstrated** — Mystery · Child
action · Discovery · Next Mystery, in the same plain language, plus
what actually happened (found / stayed a question / still open). It is
secondary information, shown after the fact, and nothing of it appears
over the sky.

## 🧪 INVALID DOES NOT MEAN INVISIBLE — the research view

A refused candidate is not a failure to be hidden. It is the material a
research instrument exists to study, and the Lab now keeps every one of
them on screen with a research view a person can read without knowing a
schema.

**Two separate questions, never one score.** *Is this candidate
technically expressible by the Ether?* is the validator's. *Is the
underlying idea worth expressing?* is the reviewer's. A candidate can
be VALID + BAD IDEA, INVALID + GOOD IDEA, VALID + GOOD IDEA or INVALID
+ BAD IDEA, and the Lab must let you see the difference.

Every refused card carries:

- **WHAT THE MODEL WAS TRYING TO DO** — one plain sentence, DERIVED
  from the candidate itself (its own title, the shape of experience it
  chose, what it places, how it hoped to end) and never invented, never
  asked of a model. A candidate too broken to say anything about says
  so.
- **WHY IT IS NOT PRODUCTION-READY** — the validator's reason codes in
  a reviewer's words (*"it invents a field the schema has no place for:
  figure"*), with the raw codes still in `technical details`.
- **CAN THE ETHER SHOW THIS?** — and what is missing when it cannot.
- **WHAT WAS REPAIRED FOR THE EXPERIMENT**, when anything was.

### The three preview answers

| Card | Button | Meaning |
|---|---|---|
| VALID + performable | **▶ PLAY IN ETHER** | the sky exactly as it would be |
| INVALID, idea expressible today | **🧪 TRY IDEA** | not production-valid; here is whether the idea underneath can be experienced |
| INVALID, needs a missing capability | **⚠ Cannot preview this idea yet** | *"This idea needs a capability Ether does not currently have: &lt;capability&gt;."* |
| INVALID, nothing to show or not allowed | **⚠ Cannot preview this idea yet** | the research explanation, and no preview |

An invalid candidate is **never** called "Play in Ether", and a
capability that does not exist is **never** faked to make a card
playable. `js/etherMystery.js` was not touched.

### `labResearch.js` — the projection, and the one bypass

`tools/ether-mystery-lab/labResearch.js` is pure: no DOM, no storage,
no network, no clock, no model, and it draws and places nothing. It
does four things — `intent()`, `plainWhy()`, `project()`, `study()`.

**The projection never guesses.** It is a table of named, mechanical,
reportable edits, and each says why it is safe:

| Rule | What it does |
|---|---|
| `relocate-known-key` | a key the schema has exactly ONE home for, put one level up (top-level `residue` → `outcome.residue`) |
| `drop-unknown-key` | a field the schema has nowhere to put (`figure`, `skyFigure`) — dropped and reported |
| `supply-id` | a malformed id → a slug of the candidate's own title; ids never reach the sky |
| `imply-creation` | the candidate already names a shard, a line toward a creation, or a creation being found |
| `drop-deadline` | `seconds` on a tap or approach — the action stays, the deadline does not exist here |
| `clamp-to-bounds` | a number outside a bound the schema already states |
| `set-aside-title` | a title whose words are refused; the sky never renders one |
| `drop-unusable-label` | a complexity, rarity, phase, creationKind or `requires` the Composer/interpreter never performs |

After the rules run, **the REAL validator decides.** `labResearch.js`
never declares anything valid; if a mechanical repair cannot get there,
the answer is that it cannot be previewed, and saying so is the
research result. Anything needing more than an obvious mapping is not
case A — a projection that guessed would be a parallel interpretation
of candidate semantics, which is forbidden.

**RESEARCH_WAIVED is the one deliberate bypass, and it is four named
reasons.** The validator holds two kinds of rule: statements about what
the runtime can PERFORM (capabilities, shapes, bounds, the privacy
boundary) and the product's own DESIGN judgement. On the TRY IDEA path
only, the interpreter is handed a grammar that delegates to the REAL
`EtherGrammar.validate()` and stands over exactly:

    outcome-obvious-no-question · tap-for-sure-outcome ·
    experiment-must-stay-uncertain · reskin-of-existing

Nothing else. It is never installed on the PLAY path, the production
pool is never loaded where it lives, and a candidate refused for a
capability, a bound or a forbidden key is refused there too. The suite
checks that no waived reason names a capability, bound or boundary.

**A privacy boundary is never repaired around.** The validator returns
early on an unknown TOP-LEVEL key, so its own sweep never runs and a
privacy field put there comes back merely as "unknown" — so the
research layer asks `FORBIDDEN_KEYS` itself, at any depth, before any
rule may drop anything. That candidate is `uninterpretable`, full stop.

### An invalid candidate can be judged. It can never ship.

The four judgements are the same four, and on a refused candidate they
are **research judgements**: ✨ Good there means *the idea is
creatively promising*, not *this is production-ready*. The card says
so. `approve()` refuses on `not-valid`, only an approved item reaches
the pool export, and the suite proves both.

### Two exports, and they are different artifacts

| Button | Format | For |
|---|---|---|
| ⬇ Export approved candidates | `ether-experience-pool-entries` | a person to review and commit into `assets/ether/experience-pool.js` |
| 📓 Export research log | `ether-mystery-lab-research-log`, `productionReady: false` | reading and learning from — **never** committed into the pool |

The research log carries EVERY candidate of a session, valid and
invalid, with its refusals (raw and in plain words), its derived
creative intent, its preview status, what the projection repaired, what
was waived, and the human judgement. Before it existed the Lab threw
away exactly the material it is for — which is why the first Pegasus
batch cannot be analysed today (see below).

### ↻ Regenerate — refinement, through the same contract

Pressing it on any candidate sends that candidate's OWN intent and its
OWN refusals back through `buildInput()` — the same generation
contract, the same privacy sweep, the same transport. `directives.refine`
carries `{ keepThisIdea, refusedBecause, original, instruction }`, and
the instruction is deliberately **not** "make it valid": that invites
meaningless schema compliance, and the point is that the creative
intent survives.

The answer is a **NEW candidate linked to the original** (`cand-3` →
`cand-3-r1`). The original is never mutated, keeps its own validation
reasons and its own judgement, and both stay visible.

## THE 10/10 INVALID PEGASUS BATCH — what could and could not be traced

**The batch itself was not available.** The Lab persists nothing: no
`localStorage`, no server write, and the only egress was the approved
export — which invalid candidates could not enter. That batch lived in
one browser session and is gone. **Nothing here reconstructs it, and no
JSON below is presented as the model's actual output.**

Of §8's five comparisons, four could be made from source and one could
not:

| # | Comparison | Made? |
|---|---|---|
| 1 | the generation prompt | ✅ `labKit.js` → `systemPrompt()` / `userPrompt()` |
| 2 | the candidate schema shown to the model | ✅ `EtherGrammar.contract()` |
| 3 | the actual model output | ❌ **not available — the batch was never persisted** |
| 4 | the validator schema | ✅ `js/etherGrammar.js` → `validate()` |
| 5 | the interpreter's expectations | ✅ `js/etherMystery.js` via `REPRESENTED` |

What IS evidence about the batch is the product owner's own reading of
it (§7): the ideas were *something separated from Pegasus · something
hidden around Pegasus · a glint/trail leading somewhere · a
relationship involving Pegasus · something subtly changing around
Pegasus.* Every one of those is a shape the grammars already express —
`reconstruct`, `uncover`, `trace`, `connect`, `notice` — so the failure
was almost certainly in the ENCODING rather than in the ideas.

### The contract mismatches, by name

| # | Mismatch | Where | Severity |
|---|---|---|---|
| 1 | **A sky figure cannot be expressed at all.** *(Still true at build 0768 — `arrangement` is a ring or an arc of lights, never a named figure; see the constellation decision.)* `directives.skyFigures` reaches the model as an ingredient, and `SCHEMA.top` / `SCHEMA.ingredients` have NO field for one. A candidate can only ever be about a `creation` or an `anchor`. | prompt ↔ schema | **critical** — and it is the constellations preset's own subject |
| 2 | `constellation` is on `FORBIDDEN_KEYS` (a privacy rule about a Magic Card's sky) while the Lab simultaneously offers "sky figures" as ingredients — so the most natural key name for that ingredient is refused as a privacy violation. | prompt ↔ validator | high |
| 3 | Ether beings and phenomena are offered as ingredients too, and have no schema field either. | prompt ↔ schema | high |
| 4 | The id format `^[a-z0-9][a-z0-9-]{2,60}$` is **never stated in the prompt**. `pegasus_hidden` and `Pegasus Trail` both fail `bad-id`. | prompt | high |
| 5 | `seconds` on a `tap` or `approach` is refused (`no-deadlines`) and the prompt never says so. | prompt ↔ validator | medium |
| 6 | `tap-for-sure-outcome` / `outcome-obvious-no-question` refuse the single most natural mystery shape (one touch → a discovery), and the prompt states the principle loosely ("not every mystery resolves") without saying it is enforced. | prompt ↔ validator | high |
| 7 | The schema is shown as **lists of key names only** — no types, no required/optional marking, no nesting, no worked example. Nothing says `elements` is an array, that `element.show` draws from `capabilities.shows`, or that `outcome.possible` is an array of outcome ids. | prompt | high |
| 8 | Titles are scanned for gamification and instruction language. *"find the missing corner"* trips `instruction-language`; the banned vocabulary is never shown to the model. | prompt ↔ validator | medium |
| 9 | `requires` accepts capability ids or `creation`/`anchor`, and the prompt never explains the field. | prompt | low |
| 10 | The validator **returns early on an unknown top-level key**, so a refused candidate reports only its first family of problems. A reviewer (and a refinement) sees one reason where there may be four. | validator ergonomics | medium |
| 11 | `onEngage: 'brighten'` — validator accepts, interpreter has no branch. | validator ↔ interpreter | known |
| 12 | `outcome.residue.show: 'glint'` — validator accepts, interpreter always draws a mark. | validator ↔ interpreter | known |
| 13 | `of: 'sky'` — validator accepts, interpreter performs only `of: 'cover'` on a shard. | validator ↔ interpreter | known |
| 14 | `creationKind: 'any'` — validator accepts, only `story` exists. | validator ↔ interpreter | known |
| 15 | `ingredients.minPages` is validated 0–40, and the Lab's own fixture creations advertise `pages: 5/1/12` — while the live lens reports **0 pages for every real Spirit**. The contract actively invites a field that makes a candidate permanently unofferable in production. | contract ↔ runtime | medium |

**Constructed probes, run through the real validator** (labelled as
constructed; they are in the suite, not passed off as the batch):

    figure at top level              → unknown-key:candidate.figure
    figure inside ingredients        → unknown-key:ingredients.skyFigure
    residue at top level             → unknown-key:candidate.residue
    underscored id + a timed tap     → bad-id · no-deadlines · tap-for-sure-outcome
    the natural tap-for-a-discovery  → tap-for-sure-outcome
    constellation named directly     → unknown-key (and a privacy field)
    a title reading as an instruction→ instruction-language:candidate.title
    of: 'sky'                        → VALID, and unperformable

**Recommendation (not a change).** In order: (a) state the id format,
the no-deadlines rule, the mystery-must-stay-a-question rule and the
banned title vocabulary IN THE PROMPT, and show ONE worked example
candidate; (b) decide the sky-figure question as a product matter — the
runtime cannot draw a literal constellation, so either the ingredient
stops being offered or a `figure` show capability is built, and a
schema field without a renderer would validate what cannot be
performed; (c) resolve the four validator ↔ interpreter gaps in the
direction the product wants. **Nothing was changed here**: the whole
point of §8 was to diagnose before touching either side.

## THE CONTRACT REPAIR — what changed, mismatch by mismatch

The recommendation above was taken for (a), deferred to the product
owner for (b), and audited rather than acted on for (c). **The repair
is entirely in the Lab**: `js/etherGrammar.js` and `js/etherMystery.js`
are byte-identical, because a truthful contract turned out to need only
that the model be told the truth about them.

| # | Mismatch | Repaired how |
|---|---|---|
| 1 | A sky figure cannot be expressed at all | **The prompt stops asking for one.** `directives.inspirationOnly` replaces `directives.skyFigures`, carrying figures, beings and phenomena together under one sentence: *these are not ingredients, they have no field, naming one refuses the candidate whole.* `directives.ingredientsAvailable` names the two that exist. The contract states it again in prose. **Not a schema change** — see the constellation decision below. |
| 2 | `constellation` is a forbidden privacy key while figures were offered as ingredients | The contradiction is gone with #1: nothing now invites a candidate to name a figure in any field, and the RULES list names `figure`, `skyFigure`, `constellation` and `being` among the fields never to invent. The forbidden-key list is **untouched** — Decision 48 is not negotiable. |
| 3 | Beings and phenomena had no schema field either | Same channel, same sentence. |
| 4 | The id format was never stated | Stated twice — in the field description and in the RULES list, as the literal regex. The role format is stated with it (it was equally unstated and equally fatal). |
| 5 | `seconds` on a tap/approach is refused and the prompt never said so | Stated on the field and in the RULES list, with *why* (nothing here counts down). |
| 6 | The mystery-must-stay-a-question rules were principles rather than rules | All three named by their refusal codes: `tap-for-sure-outcome`, `outcome-obvious-no-question`, and `experiment` must include `unresolved`. |
| 7 | The schema was bare key-name lists | Replaced by a structured, complete schema: **every field, its type, required/optional, its nesting, its allowed values and one sentence of guidance**, ordered by `EtherGrammar.SCHEMA` itself and populated from `CAPABILITIES` / `GRAMMARS` / `PHASES` / `RARITIES` at build time. A schema key with no description is reported as UNDOCUMENTED and fails the suite. |
| 8 | Title vocabulary was scanned and never disclosed | The whole banned list — gamification and instruction language both — is in the RULES. |
| 9 | `requires` was never explained | Described, and marked *the interpreter never reads it; leaving it out is safest.* |
| 10 | The validator returns early on an unknown top-level key | Cannot be fixed from the Lab (it is validator behaviour), so it is **disclosed to the model**: *reading STOPS at the first unknown TOP-LEVEL key, so one invented field can hide every other problem.* The invalid worked example is exactly that case and its `why` says so. |
| 11–14 | `brighten` · glint residue · `of:'sky'` · `creationKind:'any'` | Named in one RULES line — *DO NOT USE, EVEN THOUGH THEY VALIDATE* — with the reason: the runtime cannot perform them, so the experience would never be seen. Also on each field's own description. **Neither side was changed**; see the capability matrix. |
| 15 | `minPages` invites a permanently unofferable candidate | Same line, plus its own field description: *DO NOT USE — the live projection reports 0 pages for every creation.* |

**Six worked examples ship with the contract**, and the suite runs
every one of them through the REAL `EtherGrammar.validate()` and the
REAL `LabPreviewSupport.support()`: a valid one, an invalid one (with
the seven rules it breaks named), a mystery without a challenge, a
challenge emerging from a mystery, one reaching a discovery, and one
leaving the next question behind. **An example the Ether would refuse —
or could not perform — is the worst possible thing to show a model**,
so `C4` and `C5` are the heart of the repair, and no example may name
any of the five validate-but-unperformable values. None of the six is
structurally identical to a shipped pool entry either, so a model
copying one verbatim is not instantly refused as a reskin.

`PROMPT_VERSION` moved to `ether-mystery-lab-3`. The contract is
~19.7 KB of system message (roughly 5 K tokens), of which the schema
and the examples are most; it is sent once per generation, not per
candidate.

## PHASE 2 — SHOULD A CONSTELLATION BE A PLAYABLE ETHER INGREDIENT?

**This is a product decision and it is NOT taken here.** What follows
is the recommendation with its reasoning, and the minimal primitive if
the answer is yes. Nothing was implemented.

### Option A — INSPIRATION ONLY

A constellation influences creative generation and is not an
interactive runtime entity. It shapes what a candidate places, how many,
where, and how the title reads; it never appears in the data.

- **Cost: nothing.** It is what the runtime already supports, and as of
  this sprint it is what the contract truthfully describes.
- **Weakness:** what the figure contributes is invisible to everybody
  except the model. A reviewer cannot tell a Pegasus-inspired candidate
  from any other except by reading its title, and a child certainly
  cannot. If figures under Option A turn out to produce structurally
  identical candidates with different words, the figure is decoration
  in the prompt rather than an ingredient in the world.

### Option B — A PLAYABLE ETHER INGREDIENT

A constellation is represented as a real Ether visual entity, and
approved grammars may interact with it through explicitly supported
capabilities.

- **It is not far-fetched, and the Ether's own direction points at
  it.** `js/etherLife.js` already draws constellation BEINGS — stars in
  the palette's paper-cream joined by faint lines, breathing — and the
  wonders registry already draws small star figures (bird · skyfish ·
  starflower). *A figure of stars joined by faint lines* is a shape this
  runtime knows how to draw; it is simply not something
  `js/etherMystery.js` has a branch for.
- **The real cost is GEOMETRY, and it lands on the privacy boundary.**
  The 18 families' shapes live in `js/magicCard.js` as CELL COORDINATES
  on the card's own grid — the same lattice a child's pattern occupies.
  The family shape is public (`magicCard.js`: *A FAMILY IS NOT AN
  IDENTITY*), but hauling card cells into a generated experience is
  precisely the shape the Lab's own `CELLS_SHAPE` sweep refuses, and it
  would put the card's lattice one step from a generator. **So Option B
  needs an authored skeleton per family — points and links in the
  creature registry's own form — not a projection of the card.** That is
  content authorship, the same class of product-owner act as the
  Companion species names (Decision 44), and it is the largest item in
  Option B by far.
- **The field must not be called `constellation`.** That name is on
  `FORBIDDEN_KEYS` for a reason that does not change. `figure` is free
  and means the public family, never a child's sky.

**THE MINIMAL PRIMITIVE, if Option B is taken.** One new show
capability and one new element field, and nothing else:

| Piece | What it is |
|---|---|
| `element.show: 'figure'` | draws one sky figure — faint stars joined by faint lines, in the Ether's own palette, breathing like a creature. One placement point and one scale, unlike the multi-point shows. |
| `element.figure: '<family id>'` | which family. Required on `show:'figure'`, refused anywhere else. Validated against the family list; never a free string. |
| a figure skeleton registry | `{points, links}` per family, authored, in `js/etherLife.js`'s own form. **Not derived from the Magic Card's cells.** |
| one `draw()` branch | in `js/etherMystery.js`, reusing the creature layer's own star-and-link drawing. |
| `REPRESENTED.shows` gains `figure` | in `labPreviewSupport.js`, so a preview stops refusing it. |

What a figure could then legitimately DO, using only capabilities that
already exist: **be observed** (`dwell`), **be approached**, **be
touched**, **be completed** (the `complete` grammar over a figure with
one star missing), **be joined** (`onEngage: 'link'`), **be revealed**
(`onEngage: 'reveal'` under a `veil`) and **dissolve**. No new
interaction verb, no new response, no new outcome. Anything beyond that
list is a second decision, not this one.

**RECOMMENDED: stay on Option A now, and let one experiment decide
whether to build Option B.** The repaired contract makes that
experiment cheap and it is one press: run **Constellations as
Inspiration** and **Different Constellations, Same Grammar** against a
real model, then read the on-screen reskin measure.

- If the same grammar across six different figures produces
  **materially different** structures, the figure is already earning
  its keep as inspiration, and Option B buys presentation rather than
  substance — defer it.
- If it produces **the same structure with different adjectives**, that
  is the evidence FOR Option B: the figure cannot matter until it is on
  the sky, and the skeleton authorship is worth paying for.

Either way the answer comes from a measurement rather than from an
argument, which is the only reason to prefer one of these over the
other.

## PHASE 3 — THE CAPABILITY MATRIX

Audited, not changed. **Validator** = `js/etherGrammar.js` accepts it ·
**Interpreter** = `js/etherMystery.js` has a real branch for it ·
**Preview** = `labPreviewSupport.js`'s written-down `REPRESENTED` claims
it.

| Capability | Validator | Interpreter | Preview | Product decision |
|---|---|---|---|---|
| `show`: shard · mark · glint · veil · link | ✅ | ✅ each has its own drawing branch | ✅ | — |
| **`show: 'node'`** *(new at build 0768)* | ✅ | ✅ a sized bright core inside a wide halo — deliberately **not** the ambient star sprite, which is what makes `mark` and `glint` camouflaged | ✅ | — |
| **`arrangement`** *(new at build 0768)* | ✅ | ✅ `layoutPattern()` places 4–8 nodes as a ring or an arc, joins consecutive pairs, leaves 1–3 joins out; two taps join a missing pair; `resolveDone()` returns whole-ness | ✅ | **THE UNFINISHED PATTERN.** Requires a real creation and a `creation-revealed` discovery, and `behaviour.onEngage` of `link` if given. The field is spelled `arrangement` and not `pattern` because `pattern` is a Magic Card constellation everywhere else in this product and is a guarded key (Decision 48) — the spelling moved, the guard did not. |
| `place`: all six | ✅ | ✅ `placePoints()` places every one | ✅ | — |
| `action`: tap · approach · dwell · return · wait | ✅ | ✅ all armed | ✅ | — |
| `onEngage`: gather · link · reveal · drift-away · dissolve | ✅ | ✅ | ✅ | — |
| **`onEngage: 'brighten'`** | ✅ | ❌ **no branch.** Engaging sets `el.engaged`, and no line of the update or draw path reads the response — measured: nothing visible happens at all | ❌ named | **NEEDED: build it or withdraw it.** Recommended: **build it.** It is the cheapest real capability in the list (an engaged element holds a raised alpha for a beat), the fixture corpus and a generator both reach for it naturally, and it is the one response with no substitute — `dissolve` removes, `gather` moves, `reveal` uncovers, and none of them says *it answered you and stayed*. |
| `outcome`: discovery · unresolved · dissolve | ✅ | ✅ | ✅ | — |
| `discovery`: creation-revealed · wonder · place | ✅ | ✅ | ✅ | — |
| `residue.show: 'mark'` | ✅ | ✅ `residueAt()` → `life.markAt()` | ✅ | — |
| **`residue.show: 'glint'`** | ✅ | ❌ `residueAt()` always draws a mark; the value is read and ignored | ❌ named | **ACCIDENTAL SCHEMA DRIFT. Recommended: withdraw it** from the validator, leaving `residue.show` a one-value field (or drop the field and always leave a mark). A residue is *a long faint trace of something that happened*; a small light is what a live element looks like, so the distinction was never a design intention — it was a list copied from `shows`. |
| **`element.of: 'cover'`** | ✅ | ⚠️ **never read.** A `shard` always uses the creation's cover; `el.of` is not referenced anywhere in the interpreter | ✅ (harmless — it agrees with what happens) | **Vestigial but honest.** Keep, or fold away with `of` below. |
| **`element.of: 'sky'`** | ✅ | ❌ silently ignored — it draws a cover shard | ❌ named | **ACCIDENTAL DRIFT. Recommended: withdraw it.** There is no such thing as a piece of the sky; the value describes nothing the Ether has. With it gone, `of` has one legal value and can be dropped from the schema entirely. |
| **`ingredients.creationKind: 'story'`** | ✅ | ✅ the only kind the Ether holds | ✅ | — |
| **`ingredients.creationKind: 'any'`** | ✅ | ⚠️ **means the same as `story` today** — there is nothing else to match | ❌ named | **INTENTIONAL FUTURE CAPABILITY.** Decision 58 already names bringing non-Story creations into the feed as a real future seam (`kind` exists on a composer target). Recommended: **keep, and leave it named in the contract as *use "story"***. It costs nothing and it is the honest state of the world. |
| **`ingredients.minPages`** | ✅ 0..40 | ⚠️ **read and always false.** `findCreation()` compares against `lens.project().pages`, which is 0 for every real Spirit because the runtime's story entity carries no page count | ❌ blocks a preview | **NEITHER a capability gap NOR drift — a dead parameter.** Recommended: **withdraw it** unless the entity gains a page count. A field that can only ever make a candidate unofferable is a trap, and the contract currently has to spend a line warning a model away from it. |
| **`requires`** | ✅ validated | ⚠️ never read | n/a | **Vestigial.** Recommended: keep (it is free and it documents intent) or drop; either is defensible. It is stated as unread in the contract. |

**The rule this matrix exists to enforce:** the production candidate
vocabulary must never claim a capability the interpreter cannot execute.
Today it claims five. Two should be built or withdrawn (`brighten`,
glint residue), two should be withdrawn (`of:'sky'`, `minPages`), one
is an honest future (`creationKind:'any'`) — and **until any of that is
decided, the contract names all five and tells a model not to use
them**, which is the only thing the Lab may do about it on its own.

## PHASE 4 — RESEARCH-WAIVED, AND WHAT IT MAY NEVER BE

`RESEARCH_WAIVED` is kept exactly as Sprint R built it: four DESIGN
judgements (`outcome-obvious-no-question` · `tap-for-sure-outcome` ·
`experiment-must-stay-uncertain` · `reskin-of-existing`) and nothing
structural. `C12` fails if a capability, a bound or a boundary ever
joins the list.

The button now reads **🧪 TRY IDEA — RESEARCH ONLY** and the preview's
own badge says the same, because *invisibly research* is not research
labelling. Everything the mechanism could never do, it still cannot:
enter production approval (`approve()` refuses `not-valid`), export to
the production pool (the approved export takes approved items only),
modify the production Ether (the preview never loads
`assets/ether/experience-pool.js` and makes no request), bypass
production validation (the research grammar DELEGATES to the real
`EtherGrammar.validate()`), or be represented as a valid candidate (the
card carries the INVALID badge throughout). An idea needing a capability
the Ether does not have still gets **⚠ Cannot preview this idea yet** and
the sentence naming what is missing; nothing is faked.

## PHASE 6 — THE REPAIRED CONTRACT, TESTED

**NOT RUN. REAL-MODEL PENDING.** No model is reachable from the build
environment — the network policy refuses `api.openai.com` at the CONNECT
tunnel and there is no key — so the regeneration and every creative
finding are the product owner's to run. Nothing below is filled with
fixture output pretending to be a batch.

What shipped instead is the harness, one press per run, each dry-run
green in FIXTURE MODE by the suite:

| Preset | Parameters |
|---|---|
| ⭐ **Pegasus — Regeneration** | Pegasus · Composer choose · 5 · mixed — the brief's exact experiment |
| Same Constellation, Different Grammars | Pegasus × reconstruct / connect / trace / notice · 4 · mixed |
| Different Constellations, Same Grammar | six figures × `connect` · 6 · mixed |
| Mystery Without Challenge | unchanged from Sprint 0767 |
| Challenge Emerging From Mystery | unchanged from Sprint 0767 |

Arming a preset now sets the grammar, the complexity and the figures as
well as the count, so the run is defined by pressing it rather than by
matching five controls by hand.

**How to run it:** open `tools/ether-mystery-lab/index.html`, connect
(ENDPOINT or DIRECT), press **⭐ Pegasus — Regeneration**, press
GENERATE. Then read, in order: the valid/invalid count on the cards, the
reskin measure, and — for every candidate that offers it — **▶ PLAY IN
ETHER**. Export the research log at the end; it carries the invalid ones
with their refusals and their derived intent, which is the material the
next repair would be made from.

**The success criterion is not 5/5 brilliant.** It is that the model can
now produce candidates that conform to the actual schema, use only
supported capabilities, correctly distinguish a constellation from a
Creation, pass validation when genuinely valid, and be previewed when
the runtime supports them. **Creative quality is a separate question and
must not be claimed until the previews have actually been watched.**

## KNOWN RUNTIME LIMITATION — NOTICE with no armed interaction

`js/etherMystery.js`'s `resolveDone()` is satisfied on the first frame
when no element is armed and no wait is pending, so an observation-only
candidate **resolves before a child could look at it**. That defeats
the `notice` grammar, whose whole point is something sitting there to
be noticed.

This is recorded, not patched. The Lab warns the reviewer
(`labPreviewSupport.js` → `support().notes`) because a preview that
appears and goes reads as a broken preview; `js/etherMystery.js` is
untouched and `tools/ether-mystery-test/` was not weakened. Fixing it
is a product decision with its own sprint.

## The candidate lifecycle — VALID ≠ APPROVED

    generated → validated | invalid → quality-reviewed → reviewed
              → approved → exported

- **Validated**: `EtherGrammar.validate()` — the one validator, with
  the shipped pool's signatures so a reskin of an approved experience
  is refused.
- **Quality-reviewed**: eleven creative dimensions (curiosity ·
  engagement · understandability · depth · magic · surprise ·
  discovery · mystery · restraint · originality · next-question),
  scored 0–3 by deterministic structural heuristics. Honestly
  labelled: a screening aid for the reviewer, never a judgement and
  never a gate.
- **Reviewed**: the human classifies — 🌟 Exceptional · ✨ Good ·
  🟡 Valid but boring · 🔴 Reject — with rejection reasons
  (too-obvious, boring, too-game-like, too-instructional, confusing,
  too-difficult, too-childish, too-complex, insufficient-mystery,
  weak-challenge, weak-discovery, repetitive, visually-noisy,
  emotionally-flat) and free notes. An INVALID candidate can be
  reviewed (that is how the feedback loop learns) and can never be
  approved.
- **Approved**: only exceptional/good classifications approve, and
  only after validation AND quality AND human review.
- **Exported**: `⬇ Export approved candidates` downloads a JSON
  artifact — pool-entry-shaped, each entry carrying `source`,
  generator/model, timestamp, params and prompt version (§19's
  reproducibility) — for a person to review and commit. Session
  statistics (classification spread, rejection-reason percentages
  computed over the actually-reviewed set) sit beside it.

## The six critical experiments (one click each)

Presets in the Generation panel, each pre-filling grammar/count and an
emphasis directive; every one dry-runs green in fixture mode (the
suite proves it) and is MEANT for a real model:

1. **Same Creation, Different Grammars** (§13) — one creation ×
   reconstruct/connect/trace/echo. The on-screen reskin measure says
   whether the four are materially different; repeated reskins are a
   generator quality problem to record.
2. **Constellations as Ingredients** (§14) — a batch across obvious,
   ambiguous, human, mythical, creature and object figures.
3. **Mystery Without Challenge** (§15) — observation only, unresolved,
   still worth meeting.
4. **Challenge Emerging From Mystery** (§16) — never announced.
5. **The Next Mystery** (§17) — residue that becomes the next
   question.
6. **Different Child Depth** (§18) — the same experience, deeper for
   an older child, no age gating.

## Cost and rate control

Nothing on load; only the explicit Generate/Test buttons reach a
network; one attempt per press with no retry loop anywhere (a failure
is a sentence, and the developer deliberately requests another
batch); every request bounded with abort-and-race (Decision 49);
Cancel works mid-flight; the endpoint adds the `lab-generate` rate
bucket on top.

## What the runtime never learned

`js/etherGrammar.js`, `js/etherCreationLens.js`, `js/etherMystery.js`,
`js/etherExperience.js`, `js/etherLife.js`, `js/etherDiscovery.js`,
`js/etherRipple.js` and `assets/ether/experience-pool.js` are all
**byte-identical to 0766** — the preview sprint changed no production
file either, and mounts them exactly as `index.html` does. The Composer stays deterministic, the
child's tap reaches only local code, and the full Ether suite wall
runs unchanged. The candidate schema was deliberately NOT extended for
constellations: a constellation informs the creative content and rides
in Lab metadata, because the runtime has no capability to render a
literal figure yet — a `figure` show capability is the honest
"recommended next primitive", not a schema field that would validate
what cannot be performed.

## Files

`tools/ether-mystery-lab/index.html` · `labUi.js` · `labKit.js` ·
`labConnection.js` · `labConstellations.js` · `fixtures.js` ·
`run-lab.js` · **`preview.html` · `labPreview.js` ·
`labPreviewHost.js` · `labPreviewSupport.js`** ·
**`labResearch.js`** ·
`supabase/functions/lab-generate/index.ts` ·
`supabase/DEPLOY_lab_generate.md` ·
`tools/ether-mystery-lab-test/run-lab-tests.js` (226) ·
`tools/ether-mystery-lab-test/shots/`

---

## THE UNFINISHED FIGURE — can unfinished geometry become unfinished *something*?

**A LAB EXPERIMENT. Nothing here is in the production Ether, and the
Unfinished Pattern is still held at `status: 'experiment'`.**

The Unfinished Pattern works as an interaction. What it lacked was
meaning: a ring is a ring and an arc is an arc, so the lights
communicate *geometry* and never *identity*. The child reaction the
interaction earns is "these dots need connecting"; the one worth having
is **"what IS that?"**

So this experiment changes only where the lights stand and what is
joined to what, and asks whether an arrangement can suggest that it
might be **something** before it comes alive.

### The three levels being compared

| | | |
|---|---|---|
| **A** | pure geometry | the ring and the arc the runtime already drew |
| **B** | figure-suggestive | points and joins that suggest a body, a pair of reaches, a taper, a curl |
| **C** | ambiguous figure | plainly *something*, resolving into nothing nameable |

### How to run it

Open the Lab in FIXTURE MODE, arm **Unfinished Figure — does it suggest
a meaning?**, choose a creation, press GENERATE. Eight cards appear.
Press **▶ PLAY IN ETHER** on each and answer one question:

> *What might a child think this is?*

If the answer is "nothing", "some dots", "a circle" or "an abstract
shape", that fixture failed. If it is "maybe a bird?", "something
swimming?", "I don't know, but it looks like something" — it is
interesting. **Everyone seeing the same object is not the goal;
ambiguity is.**

### What is NOT here, deliberately

There is **no named-shape vocabulary**. No `shape: 'bird'`, no
`shape: 'fish'`, no shape library, no creature system, no procedural
figure generator, and no semantic recognition of any kind. A figure is
`points` and `joins` — visual relationships and nothing else — and what
a child sees in it is the child's. The evaluator-facing family labels
(`family`, `mightBe`) live in the Lab's own metadata and are stripped
before a candidate reaches the interpreter; the suite fails if either
ever travels inside one.

Nothing was asked of a model. Every fixture is hand-authored, labelled
`fixture` everywhere it travels, and the model path is untouched — the
schema documentation for `arrangement.figure` says **LAB EXPERIMENT —
DO NOT USE** in as many words, because the contract must be truthful
about every key the schema holds (`C1`) and this is not a key a
generator may reach for.

### The findings

**A DETACHED PART READS; A DETACHED POINT DOES NOT.** This is the one
finding worth carrying forward. Where a gap leaves a light joined to
*something* — `winged`'s loose wing is still two lights joined to each
other — it reads as a piece of the thing, sitting apart from the thing.
Where a gap leaves a light joined to *nothing*, it reads as a stray
star, and the sky is already full of those. `branching` has two such
orphans and is the weakest figure in the set for exactly that reason;
`curled` has one and survives it because the rest of the coil is
unmistakably a coil.

**SYMMETRY IS THE STRONGEST TEASE THERE IS.** `winged` and `cupped` are
the two that most reliably say *"something is missing"* without a word,
because a thing that is plainly symmetrical and plainly is not asks its
own question. `swimming` gets the same effect from taper: a body that
narrows to a fork is going somewhere, and the break in the middle is
obviously a break rather than a design.

**THE CONTROLS ARE THE PROOF THE EFFECT IS REAL.** The ring is a
deliberate, incomplete, entirely meaningless shape — it answers "what is
that?" with "a circle of dots". The arc is worse: with two gaps it stops
being one thing at all and reads as unrelated fragments — two short strokes and a lone light. Put beside
the winged figure they make the difference obvious in a way no argument
would.

**COMPLETION RESOLVES THE IDENTITY, WHICH IS THE WHOLE POINT.** Joining
the last light of `winged` does not reveal a different object — the same
arrangement simply becomes symmetrical, and *that* is the "oh". The
figure then blazes, gathers, wakes and roams exactly as build 0769 left
it, and the thing that roams is recognisably the thing the child
completed.

**A JOIN IS WRITTEN `"0-1"`, AND THE STARS BOUNDARY IS WHY.** The first
draft wrote joins as `[[0,1],[1,2]]` — the obvious shape — and the
research log's export refused the whole artifact as `stars-shaped-data`.
The scan was right: in this product a list of integer pairs is exactly
what a Magic Card's constellation looks like, and the guard cannot tell
a figure's relationships from a child's credential by looking. **The
guard is not weakened and the spelling moves**, which is the same answer
this repository has now reached twenty-one times for a word matching
inside its own vocabulary — and the eleventh time the thing being
protected was the Stars.

### Judgement, fixture by fixture

Every judgement below is from looking at the rendered sky, not from
reading the data.

| fixture | level | what might a child think this is? | verdict |
|---|---|---|---|
| `control-ring` | A | *"a circle of dots"* | **geometric.** Deliberate, incomplete, meaningless. The control working. |
| `control-arc` | A | *"three little lines"* | **geometric, and worse.** Two gaps break an open curve into unrelated fragments. |
| `curled` | B | *"a hook? something curled up?"* | **suggestive, modest.** Six lights only turn the coil about one and a half times, so it reads more like a hook than a curl. The loose outer light is a stray. |
| `winged` | B | *"a bird? a moth? something with wings?"* | **the strongest in the set.** Symmetrical body, two reaches, one of them plainly detached. The gap is unmistakably the missing piece of its identity. |
| `swimming` | B | *"a fish? a tadpole? something swimming?"* | **strong.** Taper plus a forked tail; the severed middle reads as a break rather than as a design. |
| `branching` | B | *"a plant? — and two loose stars"* | **the weakest figure.** The trunk and its one limb read fine; two orphaned lights do not join the picture. Kept because it is what taught the detached-point finding. |
| `cupped` | B | *"hands? a nest? a boat? something holding something?"* | **strong, and the most emotionally suggestive.** It is open at the one place that would let it hold anything. |
| `adrift` | C | *"I don't know — a seed? a bud? something drifting?"* | **the ambiguity works.** Plainly something, nameable as nothing, and two children would answer differently. |

Against §10's questions: all six figures look **intentional**; five of
six **suggest something before completion**; the missing relationship
feels **meaningful rather than arbitrary** in `winged`, `swimming`,
`cupped` and `adrift`, and arbitrary in `branching`; completion creates
an **"oh"** most clearly in `winged` and `cupped`; and it still reads as
the Ether rather than as a puzzle game, because nothing is announced,
counted, timed or scored.

### Mobile

Measured on a 390×844 phone profile against a 1440×900 laptop: every
figure spans more than half the short edge on both, because the figure
is normalised to the ring's own radius and that radius has always been
a fraction of the short edge. The winged figure covers ~72% of a
phone's width and is still plainly a winged figure. No figure collapses
toward ambient-star scale on either.

### Open, and not decided here

- **Six lights is not many for a curl.** `curled` would read better at
  eight, which is the schema's own ceiling. Whether the ceiling should
  move is a product question, not this experiment's.
- **The two controls and the six figures share one signature**, because
  `EtherGrammar.signature()` does not read the arrangement at all — so
  the pool's `reskin-of-existing` rule cannot tell two arrangements
  apart however different their figures. It costs nothing today (no
  figure is in the pool) and would matter the moment two were.
- **Whether a real child sees any of this** is untested and untestable
  here.

### Files

`tools/ether-mystery-lab/labKit.js` — `FIGURE_EXPERIMENTS`,
`FIGURE_BANK`, the `unfinished-figure` preset, the `figure` schema
documentation. Screenshots:
`tools/ether-mystery-lab-test/shots/figures/`. Suite section: `UF`.

## THE CREATURE MYSTERY — can you bring it to life?

**A LAB EXPERIMENT. Nothing here is in the production Ether, no
production file changed, and the Unfinished Pattern is still held at
`status: 'experiment'`.**

The Unfinished Figure asked whether an abstract arrangement could
suggest a meaning, and answered *mostly not*: the strongest fixtures got
as far as *"a bird? a moth?"* and the controls got as far as *"a circle
of dots"*. **Abstract geometric arrangements are not sufficiently
meaningful.** So this experiment stops asking the lights to carry the
idea on their own and gives the child one short sentence before they
look — *a creature is hidden inside this pattern* — and then asks
whether the emotional progression the product wants actually happens:

> *"What's that?"* → hint → *"Oh, maybe it's a bird…"* → experiment →
> *"These stars go together."* → completion → **"OH! IT'S ALIVE!"** →
> roaming → *"Where did it go?"*

### The five creatures

Hand-authored, one at a time, points and joins only. The creature's name
and its hint are **Lab metadata** — the candidate that reaches the
interpreter contains neither, and `CR3`/`CR3b` fail if either ever
travels inside one.

| fixture | lights | joins | missing | the hint the child sees |
|---|---|---|---|---|
| falcon | 8 | 7 | 2 | *A hunter of the open sky is waiting…* |
| polar bear | 8 | 7 | 2 | *Something huge walks the frozen north…* |
| whale | 7 | 6 | 1 | *A giant of the deep is waiting…* |
| fox | 8 | 7 | 2 | *A quiet traveller of the forest is waiting…* |
| octopus | 8 | 7 | 3 | *Something with many arms is waiting…* |

**The hint names the CATEGORY, never the answer.** No hint contains its
own creature's name, and none contains an instructional word — no
*connect*, *join*, *tap*, *dots*, *complete*, *puzzle*. It says what
kind of thing is waiting and leaves the whole structure to be
discovered; `CR4`, `CR4b` and `CR4c` enforce all three properties.

**The hint is rendered by the LAB, not by the interpreter.**
`js/etherMystery.js` draws no text at all (`CR12`), and this experiment
did not change that — the sentence lives in `preview.html`'s own `.hint`
element, fades in on its own beat and **withdraws the moment the
creature is whole**. So the production Ether still contains not one
instruction, and adopting a leading hint would be its own product
decision rather than something this sprint quietly shipped.

### The findings

**THE HINT DOES THE WORK THE GEOMETRY COULD NOT.** This is the result.
The same eight lights that read as *"an abstract shape"* in the previous
experiment read as *a bird with a loose wing* the moment the sentence
above them says a hunter of the open sky is waiting. What changed is not
the drawing; it is that the child now has a hypothesis to test, and the
gaps become *the bit that is missing from the bird* rather than *the bit
that is missing from the shape*. **"Connect the dots" became "make the
bird whole."**

**A DETACHED PART READS; A DETACHED POINT DOES NOT — and the fox proves
it in one picture.** The previous experiment's finding, now demonstrated
inside a single fixture rather than across two. The fox is deliberately
authored with one gap of each kind: its loose TAIL is two lights still
joined to each other and reads unmistakably as a piece of the animal
sitting apart from it; its loose EAR is a single light joined to nothing
and reads as a stray star, indistinguishable from the ambient field.
The octopus is the extreme case — three detached arm-points — and its
unfinished state is the weakest of the five for exactly that reason,
while its completed state is one of the strongest.

**COMPLETION MUST NEVER BE A COIN TOSS, AND IT WAS ONE.** The
interpreter's `resolve()` draws the ending at random from the
candidate's `possible` list, and it does so whether the child COMPLETED
the figure or the mystery simply ran out of time — there is no notion of
*ended because it was finished*. A creature carrying the ordinary
`['discovery','unresolved']` therefore came alive about half the times a
child finished it, and the other half it faded. That is the one outcome
this progression cannot have. **Fixed Lab-side** by authoring the
creatures with `possible: ['discovery']`, which a pattern candidate is
already exempted from `tap-for-sure-outcome` for — a legal candidate,
not a loosened rule. **Recorded as a product finding**, because if the
Creature Mystery is ever wanted in production the honest fix is in the
interpreter: `resolve()` should know that a completed arrangement has
earned its discovery.

**THE PRODUCT PROGRESSION WORKS AT ITS TWO ENDS AND IS THIN IN THE
MIDDLE.** Seeing (hint + unfinished figure) and awakening/roaming both
land. What no fixture can supply is the middle: *"These stars go
together"* still depends on the child discovering, unaided, that tapping
one light and then another joins them. Nothing in the experience
suggests that, and the leading hint is forbidden from saying so. **This
is the single biggest open question the experiment produced**, and it is
an interaction-affordance question rather than a creature question.

**THE LIVING CREATURE IS THE SAME THING, AND IT MOVES LIKE EVERY OTHER
ONE.** The wanderer that leaves carries every light and every join of
the figure the child completed (measured: 8/8 and 7/7 for the falcon),
so *H — does the living creature look like the same thing that was
completed?* is a clear yes. But *I — does the roaming feel
independent/living?* is only a partial yes: it drifts, wanders, rests
and wraps, and it does so **identically for a whale and for a falcon**.
A bird that flew differently from a whale would be the beginning of a
creature framework, which §17 forbids by name, so **per-creature
movement character was deliberately not built** and is disclosed rather
than approximated.

**EIGHT LIGHTS IS NOT ENOUGH FOR A FOUR-LEGGED ANIMAL.** The bear is the
weakest fixture and the reason is arithmetic: a back, a head, a tail and
four legs do not fit in eight points, so what gets drawn is a back, a
head and two legs — which reads as a bent line with two sticks hanging
off it, whatever the hint says. Flying and swimming animals are
silhouettes; walking animals are volumes. The schema's ceiling
(`arrangementNodesMax: 8`) is what decides this, and whether it should
move is a product question this experiment does not answer.

### Judgement, creature by creature

From looking at the rendered sky, not from reading the data. The ten
dimensions are §15's own.

| | falcon | polar bear | whale | fox | octopus |
|---|---|---|---|---|---|
| hint effectiveness | EXCEPTIONAL | GOOD | GOOD | GOOD | GOOD |
| creature recognisability | EXCEPTIONAL | REJECT | GOOD | VALID BUT BORING | GOOD |
| unfinished-state recognisability | EXCEPTIONAL | VALID BUT BORING | GOOD | GOOD | REJECT |
| action discoverability | VALID BUT BORING | VALID BUT BORING | VALID BUT BORING | VALID BUT BORING | VALID BUT BORING |
| completion satisfaction | EXCEPTIONAL | VALID BUT BORING | GOOD | GOOD | EXCEPTIONAL |
| awakening quality | GOOD | GOOD | GOOD | GOOD | GOOD |
| life / agency | GOOD | GOOD | GOOD | GOOD | GOOD |
| roaming curiosity | GOOD | VALID BUT BORING | GOOD | GOOD | GOOD |
| Ether-ness | EXCEPTIONAL | GOOD | EXCEPTIONAL | GOOD | GOOD |
| **overall** | **EXCEPTIONAL** | **REJECT** | **GOOD** | **GOOD** | **GOOD** |

**Notes.** *Falcon* — the symmetrical body with both wings detached as
PAIRS is the clearest "something is missing from something" in either
experiment; completion turns it symmetrical and that is the "oh".
*Polar bear* — the hint is evocative and the figure cannot pay it off;
eight lights give a back and two legs, and no amount of authoring fixes
that at this ceiling. *Whale* — modest and honest: a tapering body and a
forked tail read as a swimming thing, and a single gap makes it the
simplest of the five. *Fox* — the completed animal is generic
(four-legged, tail up) rather than specifically a fox, but it is the
most valuable fixture in the set because of the ear/tail contrast.
*Octopus* — the worst unfinished state and one of the best completed
ones: radial symmetry with a head is unmistakable once whole, and three
orphan points before that.

### Against §14's research questions

**A — does the hint create curiosity?** Yes, on all five. *"Something
with many arms is waiting"* is the best of them because it describes a
structure rather than a species.
**B — does the unfinished pattern look like the creature the hint
describes?** Falcon yes, whale yes, fox partly, bear no, octopus no.
**C — does the child understand the pattern is incomplete?** Where the
gap leaves a joined PART, yes, obviously. Where it leaves an orphan
point, no.
**D — does the child discover that two lights can be connected?**
**Unanswered, and it is the gap.** Nothing teaches it and the hint may
not.
**E — which lights belong together?** Where the figure is symmetrical or
tapering, yes; on the bear it is guesswork.
**F — does completion feel like revealing something already there?**
Yes — the arrangement never changes, it only becomes whole, which is
exactly the intended feeling.
**G — does it feel alive?** Yes: it blazes, holds whole for a beat,
gathers, breathes and leaves.
**H — is the living thing the same thing?** Yes, every light and every
join.
**I — does the roaming feel independent?** Partly — it is independent,
and it is the same movement for every creature.
**J — does the child wonder where it went?** Probably: it leaves, wraps
with the sky and can be found again. Untestable here.

### §16's product test

The experience does **not** produce only *"Connect the dots"* — the hint
demonstrably changes what the lights are about. It produces *"I know
what this is, and I want to make it come alive"* for the falcon and the
octopus, gets close for the whale and the fox, and fails for the bear.
**The idea works; the authoring ceiling and the missing interaction
affordance are what limit it.**

### Mobile

Measured on a 390×844 phone profile against a 1440×900 laptop: every
creature spans more than half the short edge on both, carries the same
lights and the same joins, and completes and awakens identically (all
ten runs produced a wanderer with the right node count). The hint sits
at 15px on one line at the top of the sky and never touches the figure.

### What was deliberately NOT built

No creature taxonomy, no procedural anatomy, no creature categories,
rarity, collection, inventory, catalogue, progression, levels, rewards,
ownership or persistence; no production creature framework; no new
Challenge infrastructure; no per-creature roaming character; no
additional Mystery type; no constellation functionality; and no change
to Traveller navigation — the two-tap interaction is unchanged and drag
still turns the sky.

### The checks that were wrong before the product was

Five of the `CR` checks failed on their first run and every one of them
was the check. Two asserted that no candidate names its creature — false
while the fixture ids read `lab-creature-falcon`, so **the ids were made
opaque**, which is the stronger property. Two asserted the sky carries
no words at all and were reading the **Story Spirits' own titles**: a
Spirit showing its name is the Ether working, so both now measure
whether anything CHANGED (nothing does) and whether the experiment puts
anything on screen but the hint (it does not). One of those then read a
`display:none` panel as words on screen, because `innerText` falls back
to `textContent` for an element that is not rendered — **the box
decides, not the markup**. And the last compared the sky's own text
across a twenty-second walk, which a Spirit drifting into view changes
without anything having been announced; it now requires every word on
the sky to be a Spirit's own name.

Four are proved by temporary reversion: a readable id put back (`CR3`,
`CR3b` red), the figure removed from a creature so it lays out as a ring
(`CR5`, `CR5b`, `CR6b`, `CR9b` red), the hint's withdrawal removed
(`CR11b` red), and a creature label put on the child-facing stage
(`CR11c` red).

### Files

`tools/ether-mystery-lab/labKit.js` — `CREATURE_EXPERIMENTS`,
`CREATURE_BANK`, `creatureNote()`, the `creature-mystery` preset.
`tools/ether-mystery-lab/preview.html` · `labPreview.js` ·
`labPreviewHost.js` · `labUi.js` — the leading hint. Screenshots:
`tools/ether-mystery-lab-test/shots/creatures/`. Suite section: `CR`.

## THREE FALCONS — can the drawing carry it, and can the world lean?

**A LAB EXPERIMENT INSIDE A LAB EXPERIMENT. Nothing here is in the
production Ether and no production file changed.**

The Creature Mystery's answer was that a leading hint does the work
abstract geometry could not, and it left two things open. Can the
DRAWING be made to read as a bird on its own? And can the world suggest
which lights belong together without a word? Three falcons, and each
pair differs in exactly one thing:

| | | the one thing that changed |
|---|---|---|
| **A** | `lab-fv-a` | the shipped falcon — the control |
| **B** | `lab-fv-b` | the same hint, the same eight lights, a different SHAPE |
| **C** | `lab-fv-c` | B's shape exactly, plus the world leaning toward the gaps |

**Same hint for all three**, word for word — *A hunter of the open sky
is waiting…* — same node count, same number of missing joins. The only
variable in each comparison is the one being tested.

### The controls are controls BY REFERENCE

Falcon A shares the **shipped falcon's own figure object**, and C shares
B's. Not a copy: a copy is one edit away from an experiment that
compares nothing. `FV2` and `FV2b` check identity, not equality, and
`FV2c` checks that the candidate the interpreter is handed is
**byte-identical for B and C** — the tease is not in it.

### What actually made A weak, and it was the GAPS

The redesign started as a shape problem and turned out to be a gap
problem. Five geometries were rendered and looked at, which is what the
Lab is for:

| tried | what it looked like |
|---|---|
| raised bent wings, roots missing | a stick with two dashes — same as A |
| head + shoulder + forked tail | a person with their arms out |
| gull wings, roots missing | two horizontal dashes, worse |
| **raised bent wings, NECK and TAIL missing** | **a bird, missing its head and its tail** |
| wingtips missing | stubby wings and two far-off strays |

**A's gaps are the two wing ROOTS — and a missing root hides the rising
inner half of the wing**, so all a child sees is the outer segment
sloping away. The bird-defining relationship is exactly the one removed.
Move the gaps to the neck and the tail and both wings stand whole: the
visible shape is unmistakably a bird before anything is joined, and the
two loose lights are read in its company as *the head it is missing* and
*the tail it is missing*.

**This turns the Unfinished Figure's own finding round.** That
experiment concluded *a detached PART reads; a detached POINT does not*
— and the correction is that **a detached point reads perfectly well
once the thing it is detached FROM is recognisable.** The rule that
survives both is the general one: **put the gap where the creature
stays recognisable without it.**

`FV4` holds it: A is missing its wings' roots, B and C keep every wing
join whole.

### The tease is the Lab's, exactly as the hint already is

`js/etherMystery.js` draws no text and this did not change that; it now
also draws no tease. The suggestion lives in the Lab's own overlay
(`preview.html`'s `.tease` canvas, driven from `labPreview.js`), which
reads the interpreter's own `instrument()` and adds one thing over the
top. Two rules keep it a suggestion rather than an answer:

- **the two endpoints of a still-missing join breathe TOGETHER**, which
  is the only thing in the sky that does, so the pair reads as a pair;
- **the almost-line is drawn from both ends inward and is faintest in
  the middle**, so it never closes — the world leans toward the gap
  without filling it.

Not one word, no arrow, no marker, nothing to press, and it goes the
moment the shape is whole. `FV7` measures it where it counts: the
brightest pixel around the midpoint of each **missing** join is lit and
around every **present** join is exactly zero. `FV8` proves the overlay
never catches a touch — C is completed through the real lights.

**Whether a production Mystery may ever lean like this is a product
decision, not something this experiment shipped.** It is one option on
the preview, off for A and B, and the candidate is unchanged either way.

### Judgement

| | A | B | C |
|---|---|---|---|
| reads as a bird unfinished | REJECT | **EXCEPTIONAL** | **EXCEPTIONAL** |
| reads as a bird completed | GOOD | **EXCEPTIONAL** | **EXCEPTIONAL** |
| the gap feels meaningful | VALID BUT BORING | **EXCEPTIONAL** | **EXCEPTIONAL** |
| knows what to try | VALID BUT BORING | VALID BUT BORING | **GOOD** |
| **overall** | **VALID BUT BORING** | **GOOD** | **EXCEPTIONAL** |

**B is the recognisability answer and C is the interaction answer, and
they are independent.** B fixes what a child SEES; it does nothing at
all about the Creature Mystery's biggest open finding — that nothing
teaches a child that tapping one light and then another joins them. C is
the first thing that has ever addressed it, and it addresses it the way
this product is allowed to: by having the world behave, rather than by
saying anything.

**C is recommended, and the recommendation is C's tease ON B's
geometry** — which is what C is. A is kept as the control and is not
recommended for anything.

### Disclosed

**No child has played any of them.** What is measured is the geometry,
the gap placement, what the tease paints and where, that it catches no
touch and says no word, that all three complete, awaken and roam
identically, and that none of it is reachable from production. Whether a
six-year-old sees a bird in B, and whether C's breathing pair is what
finally says *these two go together*, is the product owner's to judge
from the Lab.

### Files

`tools/ether-mystery-lab/labKit.js` — `FALCON_VARIATIONS`,
`FALCON_BANK`, the `falcon-variations` preset.
`tools/ether-mystery-lab/preview.html` · `labPreview.js` (`TEASE`,
`startTease`) · `labPreviewHost.js` · `labUi.js`. Screenshots:
`tools/ether-mystery-lab-test/shots/falcons/`. Suite section: `FV`.

---

## THE FALCON REDRAWN — recognition · mystery · guided discovery

**A LAB EXPERIMENT. Nothing here is in the production Ether, no
production file changed, no pool entry was activated, and the build was
not bumped.**

Three Falcons answered its own question honestly: A, B and C all read as
constellation stick figures rather than as a falcon. This experiment was
asked to stop trimming that topology, design the FINISHED creature
first, and then take joins out of it — and to reject the geometry if the
completed figure does not read as a falcon, however good the interaction
is.

### THE FIRST RESULT IS A WALL, AND IT IS IN PRODUCTION CODE

The brief asked for **14–20 lights**, explicitly removing the eight-light
constraint. That constraint is not a Lab habit. It is the product's:

| | | |
|---|---|---|
| `js/etherGrammar.js` | `arrangementNodesMax: 8` | *"more than eight is a chore, not a mystery"* — and a figure's `points` array must be **exactly** `arrangement.nodes` long, so nine lights is a **refused candidate** |
| `js/etherMystery.js` | `LIMITS.pieces = 10` | a hard ceiling applied by **clamping, not refusing** — `if (total + n > LIMITS.pieces) n = LIMITS.pieces - total` |

The second is the worse of the two. A sixteen-light figure is not
rejected by the interpreter; it is **silently truncated to ten**, and
`layoutFigure` then iterates the ten lights that exist while the figure's
joins still refer to sixteen — so what would render is a broken drawing,
not a large one.

Both files are production and this experiment may not edit either.
**So the experiment was run at eight**, and `FR2`/`FR2b` read the two
numbers back out of the real files and prove that sixteen is refused, so
the wall is a measured fact in the suite rather than a claim here.
Raising it is a product decision with a suite and a canon entry behind
it — see *What it would take* below.

### THE GEOMETRY, DESIGNED FORWARDS

Nine rounds of **completed silhouettes** were drawn and looked at before
a single gap was placed. Two findings carried the redesign, and both are
transferable to any creature:

**OUTLINE THE WING.** Every earlier falcon drew each wing as an *arm* —
one line out from the shoulder with a bend in it — and an arm is a
skeleton. Give the wing a leading edge **and** a trailing edge that
closes back onto the body and it stops being a line and becomes a shape.
This is the single biggest improvement of the whole study.
(`shots/falcon-redesign/study-outlined-wing.png` — the shipped Falcon B
beside three outlined ones.)

**SWEEP THE TIPS BEHIND THE SHOULDER.** Outlined but level, the wings
close into a trapezoid and the thing reads as a **moth**. Put the tips
lower than the wing roots so the trailing edge rises back inward — that
is the one line a falcon has and a moth does not.
(`shots/falcon-redesign/study-swept-tips.png`.)

Two earlier findings held and are worth keeping: **a two-pronged tail
under a vertical body reads as legs**, which killed six designs across
rounds 3–5; and **a perched side profile fails completely** as a line
constellation — it reads as an abstract curved blob.

The eight lights are spent four on the axis and two per wing:

```
0 head      1 shoulder    2 hip     3 tail
4 L wrist   5 L tip       6 R wrist 7 R tip

body   0-1  1-2  2-3
wings  1-4  4-5  5-2      1-6  6-7  7-2
```

Using the **hip** as the trailing root is what buys an outlined wing
without a ninth light.

### THE THREE VARIATIONS

| | | gaps | the one thing that changed |
|---|---|---|---|
| **F1 recognition** | `lab-fr-1` | neck, tail | the fewest gaps — most readable while unfinished |
| **F2 mystery** | `lab-fr-2` | neck, tail, one trailing edge | one more gap, same creature |
| **F3 guided discovery** | `lab-fr-3` | *(F2's own figure object)* | F2 exactly, plus a delayed aid |

**§4's rule is enforced rather than intended:** the four joins that carry
the identity — the two leading edges out to the tips — are never a gap in
any variation (`FR4c`). What is taken instead is the neck, the tail spike
and one trailing edge: three things a person can see are absent from a
shape that is already plainly a bird.

**F3 holds F2's own figure object**, so the two cannot drift; `FR3`
checks identity rather than equality and `FR3b` checks that the candidate
the interpreter is handed is **identical apart from the id** — the aid is
not in it. Same hint for all three, word for word.

### THE DELAYED AID

Drawn by the **Lab** over the real interpreter, exactly as the leading
hint already is. `js/etherMystery.js` still renders no text and no aid,
and still says nothing at all when a pair does not belong.

Five rules, each a refusal as much as a behaviour:

- **It is not there at first**, so nothing is explained in advance.
- **It waits for two genuine attempts that did not land** — it answers
  effort, never arrival. One try is not being stuck (`FR7b`).
- **It names ONE missing join**, never every possible connection
  (`FR8c`) — and it picks the **widest** gap, because two lights a
  finger's width apart already look like a pair and two on opposite
  sides of the shape do not.
- **The dashes stop short of the middle**, so the middle of the segment
  is never painted at any alpha (`FR8b`, measured as 0). It is an
  unfinished line about an unfinished join; it says *these two*, never
  *do this*.
- **It goes the instant the join is made** (`FR9`), and fades on its own
  if it is not — then waits for two more tries before returning. **Any**
  join retires it, not only the one it was about (`FR9c`): a child who
  was leaning on a suggestion about the left wing and then worked the
  tail out on their own is no longer stuck.

**A check that could not fail for one of those branches**, and the
reversion pass is what found it. `FR9` joins the AIDED pair — and that
is also caught by the *target became present* branch, so removing the
*any join landed* branch left `FR9` green. `FR9c` joins a **different**
missing pair, which only the removed branch answers, and it goes red on
the reversion (`then: hold, painted: 83`). Six load-bearing checks are
proved by temporary reversion in all: the two-attempt gate, the
one-gap-only rule, the untouched middle, the any-join retirement, and
F3 holding F2's own figure object.

Not a word, not an arrow, not a marker, nothing to press, no count of
tries anywhere on screen, and it never catches a touch meant for a light
(`FR8d`).

**An attempt is a selection that ended without a join**, read from the
interpreter's own `instrument()` rather than from an event — because the
interpreter deliberately emits nothing when a pair does not belong
("NOTHING BLAMES"). A child who chooses one light and lets it go again
counts, which is right: they tried. *A harness that fires both taps in
one tick is not a child* — nothing ever sees the first light held — so
the suite taps across frames.

### JUDGEMENT

**C — does the completed creature read as a falcon? NO. The geometry is
rejected.**

That is this experiment's most important judgement and it is the one it
fails. At eight lights the best achievable figure reads as **a bird** —
head up, swept wings, tail down — and never as a falcon. Nine rounds of
redesign moved it from *a stick figure* to *a bird*, which is a real
gain, and stopped there.

Two independent reasons, and they should not be run together:

1. **Eight lights cannot carry a species.** Everything that read as more
   than a bird in the study needed 12–16 (`study-sixteen-vs-ten.png` —
   the 16-light stoop beside five 10-light attempts; every 10-light
   variant degrades toward a stick). And even ten is unreachable: the
   validator stops at eight.
2. **"Falcon" may not be a shape at all.** A falcon is distinguished from
   a hawk by proportion, plumage and behaviour, not by a silhouette a
   six-year-old separates from *bird*. The honest ceiling for this visual
   language is **"OH! IT'S A BIRD!"**, and the brief's bar is *"OH! IT'S
   A FALCON!"*. Raising the node count would buy a better bird; it is not
   established that it buys a falcon.

Per §14 the response was to redesign the topology and not to compensate:
nothing was brightened, no glow was added, no animation was leaned on and
the hint was not strengthened.

The remaining judgements, for completeness:

- **A** — a clear something is waiting, in all three. F1 reads best
  unfinished: the bird stands whole with only the head and the tail
  loose, which is *obviously incomplete and still recognisable*.
- **B** — the unfinished figure is obviously incomplete in all three.
- **D** — F1 vs F2 is a real difficulty difference and neither is a wall.
- **E** — the aid reads as the world leaning in, not as an instruction:
  it is late, faint, single, and cannot close the join.
- **F** — no, it does not give the answer away. It says which two, never
  what to do.
- **G** — the completion is deterministic and identical across all three
  (`FR10`): nine joins, alive with eight lights, roaming.
- **H** — the awakening is at Ether scale and the figure stays whole and
  visible.
- **I** — **not delivered.** See below.
- **J** — the experiment should not be promoted. The interaction is
  sound; the geometry is not.

### §9 IS NOT DELIVERED, AND THAT IS THE SECOND WALL

Falcon-specific movement — wing-like motion, gliding, resting — would
live in the **wanderer**, and the wanderer is inside
`js/etherMystery.js`. There is no Lab-side seam for how a completed
figure moves, so a "Lab-only" version of §9 does not exist: it would be
an edit to a production file, which §1 forbids. What roams is the
generic wanderer: it drifts, rests and wraps, identically for a falcon
and for a whale. Reported rather than approximated.

### WHAT IT WOULD TAKE

If a larger figure is wanted, it is three changes and they are a product
decision, not this experiment's:

1. `js/etherGrammar.js` — raise `arrangementNodesMax` (and with it the
   `jns.length <= max * 2` join bound). The comment there records a real
   design judgement — *"more than eight is a chore, not a mystery"* —
   which is about how many taps a child is asked for, not about how many
   lights they look at. **A figure completed by three joins can hold
   sixteen lights**, so the two are separable, and separating them is
   the actual proposal.
2. `js/etherMystery.js` — raise `LIMITS.pieces`, and make it **refuse
   rather than clamp**: silently truncating a figure is a bug waiting
   for the first candidate that asks for it, whatever the ceiling is.
3. A canon entry, since it changes what a child can meet.

### Disclosed

**No child has played it.** What is measured is the geometry, the gap
placement, what the aid paints and where, that it waits, that it names
one gap, that it cannot close, that it goes when the join lands, that all
three complete, awaken and roam identically, and that none of it is
reachable from production. **Whether the completed figure says "falcon"
is the judgement above, made by looking**, and the product owner's to
confirm — the study sheets are committed so it can be argued with.

Desktop 1440×900 and phone 390×844 both shot; the figure holds Ether
scale on both.

### Files

`tools/ether-mystery-lab/labKit.js` — `FALCON_REDESIGN`,
`FALCON_REDESIGN_BANK`, `RUNTIME_NODE_CEILING`, the `falcon-redesign`
preset. `tools/ether-mystery-lab/labPreview.js` — `DELAY`, the delayed
branch of `startTease`, `LabPreview.tease()`. Screenshots and study
sheets: `tools/ether-mystery-lab-test/shots/falcon-redesign/`. Suite
section: `FR`.

---

## EIGHT-POINT CREATURES — how many can the language carry?

**A LAB EXPERIMENT. Nothing here is in the production Ether, no
production file changed, no pool entry was activated, and the build was
not bumped.**

The falcon experiment ended in a rejection and a wall: a figure may
declare at most eight lights, and one creature could not be made
unmistakable inside that. This asks the more useful question — not
*can eight points do every animal*, but **which creatures the
eight-point language can carry.** Five deliberately different
silhouettes: fish, butterfly, whale, snake, octopus.

### THE RESULT: TWO OF FIVE

| | verdict | why |
|---|---|---|
| 🦋 **Butterfly** | **EXCEPTIONAL** | bilateral symmetry does the work; two closed wings and a body |
| 🐟 **Fish** | **GOOD** | a closed body, a narrow waist, a forked tail *and* a dorsal fin |
| 🐋 Whale | **REJECT** | eight straight segments draw a big fish, not a whale |
| 🐍 Snake | **REJECT** | a line is not a creature |
| 🐙 Octopus | **REJECT** | radial limbs read as a stick figure |

Six rounds of completed silhouettes were drawn and **looked at** before
a single gap was placed — the falcon's own §14 discipline. The
hint-free comparison is committed as
`shots/eight-point/comparison-no-hint.png`, rendered **from the
fixtures themselves** so it can never drift from what the Ether
performs.

### THE RULE THAT SEPARATES THEM

**A CLOSED OUTLINE PLUS ONE OR TWO DIAGNOSTIC APPENDAGES READS.**
Eight straight segments can enclose a body and still leave two or three
over for the part that names the animal. That is the whole of what
succeeded, and it predicts the successes exactly: the fish spends five
joins on a closed body and five on a forked tail and a dorsal fin; the
butterfly spends one on a body and four on each closed wing.

Everything that failed, failed for a nameable reason, and each was
tried in **four different framings** before being rejected:

- **BULK DOES NOT READ.** A body made wide enough to be a whale becomes
  a polygon. Measured across side, blunt-and-deep, diving-with-fluke-up
  and from-above: a dart, a box, a wavy line, an aeroplane. Straight
  lines between few points cannot say *rounded and heavy*, and the
  features that separate a whale from a fish — the horizontal fluke,
  the blunt head, the bulk itself — are exactly the ones that need
  curvature. **A whale and a fish compete for one silhouette here, and
  the fish wins** because a forked tail and a dorsal fin are cheaper to
  draw than mass.
- **A LINE IS NOT A CREATURE.** A snake spends every light on its own
  length, so nothing is left over to make a body. Outlining the front
  half to give it one — the falcon's own winning trick — turned it into
  a tadpole. The best version has a head that genuinely reads and a
  body that is a polyline, which is all a polyline can be.
- **RADIAL LIMBS READ AS A STICK FIGURE.** Five arms need five lights
  and a mantle needs three, so every arm is a single straight spike off
  a triangle. Measured across four framings: a tent, a bat, a person
  doing a star jump, and a lamp.

### THE UNFINISHED STATE, AND ONE FIXED DEFECT

Each creature is **two joins short**, chosen from §4's own list — a
missing tail section, a missing fin relationship, a missing wing
connection, a missing body connection — and never from the joins that
carry the identity.

The first draft of the octopus and the snake left a light **attached to
nothing at all**, which the falcon experiment already recorded as the
failure mode: *a detached PART reads as a piece of the creature sitting
apart from it; a detached POINT reads as one of the stray stars the sky
is already full of.* `EP3` now enforces it for every fixture.

The octopus is the interesting case: every one of its arms is a
single-point spike, so **no arm gap can leave a part** — its gaps had
to move to the mantle's own edges. That is not a workaround, it is the
same finding arriving from a third direction.

### THE DELAYED AID, UNCHANGED AND SHARED

The falcon's aid mechanism is reused verbatim across all five —
`tease: 'delayed'`, one mechanism, not five (`EP4d`). Measured for
every creature: absent when the mystery is posed, absent after one
attempt, and after the second it leans toward **one** gap with a dashed
line whose middle is **never painted at any alpha** (`EP6e`, measured 0
for all five), so it can never close the join it is about. Not a word,
never intercepts a touch, gone when the shape is whole.

### §9 — THE CEILING WAS NOT TOUCHED, AND A GUARD PROVES IT

`arrangementNodesMax` is 8, `points.length` must equal `nodes`, and
`js/etherMystery.js`'s `LIMITS.pieces = 10` **clamps rather than
refuses**. None of that was changed and no production seam was needed.

`LabKit.figureGuard()` is the guard §9 asks for, and it **restates no
production number** (`EP2d`): the ceiling is asked of the *real
validator*, and everything else it checks is internal consistency the
validator does not owe us. The other half — that nothing is silently
truncated — is **measured rather than asserted**: the suite poses each
figure in the real interpreter and requires the placed element count to
equal the declared point count (`EP5`, 8/8 for all five). An over-limit
figure is refused by both (`EP2b`).

### Judgement, creature by creature

|   | A completed | B unfinished | C hint fits | D curiosity | E reason to try | F aid helps | G satisfying | H alive | I feels like Ether | J reusable |
|---|---|---|---|---|---|---|---|---|---|---|
| Butterfly | ✅ strong | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fish | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Whale | ❌ reads as a fish | ~ | ❌ hint would carry it | ~ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Snake | ❌ a polyline | ❌ reads as a kink | ❌ "curled up" is not shown | ~ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Octopus | ❌ a stick figure | ❌ | ~ arms half-read | ~ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

Columns E–I are the *interaction*, and they pass for all five —
including the three rejects. That separation is the useful part: **the
Creature Mystery mechanic works; the geometry is what decides whether
there is a creature in it.**

### Disclosed

**No child has played any of them.** What is measured is the geometry,
the gap placement, non-truncation, the aid's timing and its inability
to close a join, that nothing blames, that all five complete
deterministically and reach the existing awakening and roaming path,
and that none of it is reachable from production. **Whether a
six-year-old says "OH! IT'S A BUTTERFLY!" is the judgement above, made
by looking**, and the hint-free sheet is committed so it can be argued
with. Desktop 1440×900 and phone 390×844 both shot.

Roaming is the existing generic wanderer for all five, per §8 — no
species-specific movement was built.

### Files

`tools/ether-mystery-lab/labKit.js` — `EIGHT_POINT_CREATURES`,
`EIGHT_POINT_BANK`, `figureGuard`, the `eight-point-creatures` preset.
Screenshots and the comparison sheet:
`tools/ether-mystery-lab-test/shots/eight-point/`. Suite section: `EP`.

## THE CREATURE SHAPE LAB — an instrument, not an experiment

`tools/ether-mystery-lab/shape.html` (linked from the Lab's header).
Every Lab experiment before this one handed the product owner a set of
creatures somebody else had already drawn and asked him to judge them.
This changes the research method: the Shape Lab is a tool a person uses
to explore the creature / point-count design space **themselves** — draw
a figure in the Ether's own language, mark which joins are missing,
compare it across point budgets, play it in the real Ether, and write
down what they see. It answers no question about creatures and ships no
creatures. **The only shape it can put on the canvas by itself is a
neutral ring**, so the tool can be shown working without anybody having
chosen an animal for the researcher.

### What it can do

- **Six point budgets — 8 · 10 · 12 · 16 · 18 · 20 — switchable, and it
  is always obvious which is being tested.** (Four when the Lab shipped;
  10 and 18 joined in the Adaptive Suggested Points sprint, below.) The
  header reads *TESTING 16 POINTS — Lab authoring / research budget ·
  production currently supports 8*. 8 is the production budget and the
  only one the real Ether performs; the rest exist so a person can find
  out what a creature needs, and the real validator's refusal is shown
  beside any figure above 8. **The production limit is not changed by
  the tool** — `js/etherGrammar.js` still refuses a ninth light, and the
  suite asks it (`SL1c`). A budget is an authoring target, never a
  destructive operation: shrinking it under a bigger figure keeps every
  light and says the figure exceeds it.
- **An editor in the Ether's visual language**: Add (click empty sky),
  Move (drag a light), Delete, Join (one light, then another; the same
  pair again removes; clicking a line removes it), Gap (click a line to
  mark it missing, again to restore). Light numbers while editing,
  behind a toggle. Reset. Joins are straight — the Ether figure system
  has no curved connection, so none is offered and the page says why.
  **No hidden animal image, no SVG tracing, no imported silhouette**;
  the suite scans for every way one could arrive.
- **Two states side by side, always**: COMPLETE as drawn (a missing join
  shows dashed) and UNFINISHED (the missing joins simply absent — what a
  child would meet). Both at ONE fixed scale for every budget, so
  figures stay comparable and nothing auto-fits a figure to flatter a
  budget.
- **Missing joins are explicit.** The researcher names each one; nothing
  is ever chosen at random. `Math.random` appears in the file for
  minting fixture ids and nothing else (`SL2d`).
- **Live metrics, facts only**: point count, connection count, missing
  count, connected components of the unfinished figure, % of the budget
  used, all-points-placed, and whether the REAL validator accepts the
  figure at this budget. **There is no recognisability score and no
  model is asked** — the judgement is the person's, in the panel below.
- **The judgement panel** — COMPLETED (unmistakable · recognisable ·
  looks like a related animal · abstract · fails), UNFINISHED
  (recognisable and incomplete · recognisable but weak · abstract ·
  fails), and three sentences: *What do I see? · What's missing? · Would
  I use this as a Creature Mystery?* Every value is a word; the record
  holds no number.
- **The creature name is researcher metadata.** It is saved with the
  fixture, shown in the fixture list, and **never rendered, never in a
  candidate, never in the preview**, and never used to alter rendering
  or to generate geometry. The drawing code does not read it (`SL8b`).
- **Fixtures**: save, save-as-new, open, duplicate INTO another budget,
  delete, export all as JSON, import. One `localStorage` key
  (`vihu.lab.shapes`); loading the page writes nothing. A record carries
  name, budget, points, joins, missing, hint, notes, judgement, tease,
  `createdAt`/`updatedAt` and `labVersion: 'shape-lab-1'`. Fixtures are
  research artifacts — they are not in the production pool, carry no
  production ids and imply no taxonomy.
- **Compare across budgets**: every fixture carrying one name, laid side
  by side in budget order, complete and unfinished each, at the same
  fixed scale. Comparison fixtures are independent: editing the 8-light
  one changes nothing in the 12-light copy.
- **▶ Play in Ether** opens the existing Lab preview with the figure's
  EXACT points, joins and gaps — unfinished figure, optional leading
  hint, the two-tap interaction, completion, and the existing awakening
  and roaming. Available only where the real Ether can perform the
  figure (the validator passes AND at least one join is missing) — a
  16-light figure can be judged here and cannot be played there, and
  the panel says so in words. No species-specific movement, no new
  production behaviour.
- **The delayed dashed-line aid** from the falcon experiments is an
  optional toggle, **OFF by default**, on the fixture and on the
  checkbox. When on, it is the existing aid unchanged — one gap after
  two tries, inert, wordless.

### How to create and compare a figure

1. Open `tools/ether-mystery-lab/shape.html` (any static server that
   serves the repository root; `node tools/bring-it-alive/test/serve.js
   <port>` is what the suites use). Loading it does nothing.
2. Choose a budget. Press **Add** and click the sky to place lights;
   **Join** and click pairs; **Gap** and click the joins that should be
   missing when a child meets it. Watch the UNFINISHED pane — that is
   the test.
3. Type the creature name (metadata), an optional leading hint for the
   preview (never the creature's name), and notes. Fill in the judgement.
   **Save fixture.**
4. To compare across budgets: in the fixture list, **Duplicate to…** a
   larger budget, open the copy, add what the extra lights buy, save;
   then choose the name under **Compare across budgets**. Keep two
   questions apart while judging — *does the point count make it
   recognisable?* and *do these missing joins make a good mystery?* —
   they are different dimensions and the tool never merges them.
5. **▶ Play in Ether** on any 8-light figure with a gap, to see it posed
   for real; tick the aid only when that is what is being studied.

### What it refuses, by construction

A ninth light at budget 8 is refused on the canvas with a sentence and
at the API by name; shrinking a budget under a bigger figure keeps every
light and shows the figure exceeds it (it was refused outright before the
Adaptive Suggested Points sprint — nothing is trimmed either way, and an
over-budget figure cannot be added to, saved or approved until the
researcher deletes by hand); a hand-edited fixture with more lights than its
budget is refused on open and on import; duplicating a 12-light figure
INTO budget 8 is refused. The preview knows nothing about the Shape Lab
— it performs a candidate, whoever built it — and the candidate is built
through the same `creatureCandidate()` every creature experiment uses,
with an opaque `lab-shape-<n>` id.

### Disclosed

The Shape Lab was verified as an instrument, not as research: the suite
proves it draws what is clicked, refuses what it must, saves and
reopens, compares independently, and poses the exact figure in the real
Ether. **No creature was drawn in it by this sprint, no verdict was
formed, and no recommendation about the production point limit is made
here** — those are the researcher's to reach with the tool.

### Files

`tools/ether-mystery-lab/shape.html` · `tools/ether-mystery-lab/labShape.js`
(`window.ShapeLab`) · `labKit.js` → `creatureCandidate` exported. Suite
section `SL` (`ETHER_LAB_ONLY=SL` runs it alone). Screenshots:
`tools/ether-mystery-lab-test/shots/shape-lab/` — the editor at 8, 12,
16 and 20, the same ring compared across budgets, unfinished vs complete.

## THE CREATURE CANDIDATE GALLERY — Phase 1, and the four phases

`tools/ether-mystery-lab/gallery.html` (linked from the Lab's header and
from the Shape Lab's). The Shape Lab asked the researcher to draw every
creature by hand, and that is not the research workflow: the space is
explored by LOOKING. The gallery holds authored, COMPLETED candidate
figures for a creature at 8 · 12 · 16 · 20 points — three per creature
per budget, ten starting creatures, 120 figures — laid side by side so a
person can answer *does going from 8 → 12 actually make this creature
more recognisable?* and write the answer down. It judges nothing: no
recognisability score, no model, no ranking, no recommendation.

### The four research phases

| Phase | Question | Instrument |
|---|---|---|
| **1 — Creature representation (NOW)** | Which creatures can be recognised at which point budgets? Completed figures only. | The Candidate Gallery. |
| 2 — Mystery construction | Which joins can be removed without destroying recognition? | The Shape Lab's Gap tool. |
| 3 — Interaction discovery | Does the delayed dashed relationship help the child discover joining? | The Shape Lab's aid toggle, off by default. |
| 4 — Awakening | Does completion genuinely feel like bringing the creature to life? | The existing preview. |

Nothing on the gallery page has a missing join, a hint, an interaction,
an awakening or movement. Do not jump ahead.

### How to browse

- **Creature.** Ten chips — butterfly · fish · whale · bird · manta ray ·
  fox · polar bear · elephant · octopus · snake — and a free text field
  for any other name. The ten are starting subjects, not a taxonomy; a
  name with nothing authored invents nothing and offers ✏️ *Draw it in
  the Shape Lab* instead.
- **BY CREATURE** lays one creature's candidates in four columns, 8 · 12
  · 16 · 20, so one row reads left to right across the budgets. Pick a
  single budget to see that budget's several candidates side by side.
- **BY POINT BUDGET** lays every creature's candidates at one budget, one
  row per creature.
- **Blind** hides the creature name, the candidate id and the point
  budget on every card (and the column headers) while judging. The
  canvas never carries the name in either mode — the suite counts text
  draws and requires zero.

### The candidate card

Figure · `N points · candidate k` · the factual `N points · M joins` and
the opaque id (`whale-12-2`) · an optional researcher name · **Open in
Shape Lab** · **Judge** (UNMISTAKABLE · RECOGNISABLE · LOOKS LIKE
RELATED ANIMAL · ABSTRACT · FAILS, plus *What do I see?*) · **Save as
Fixture** · **▶ Play in Ether**, present and DISABLED with the reason
beside it: above 8 the production validator refuses the figure and this
tool does not change that; at 8 the figure is complete — no join is
missing — so Phase 2 (a gap, in the Shape Lab) comes first. Judgements
and researcher names live in one browser key, `vihu.lab.gallery`;
loading the page writes nothing.

### Opening a candidate in the editor

**Open in Shape Lab** hands the exact points and joins to the existing
editor through a one-shot note (`vihu.lab.shape.handoff`, sessionStorage,
consumed and deleted on arrival — a refresh does not re-open it, and a
note carrying more points than its budget is refused, never trimmed).
The editor opens unsaved, at the candidate's budget, with the creature
name in the metadata field and *From the Candidate Gallery — <id>* in
the notes. From there: move, add or delete (where the budget permits),
join, remove joins, mark missing joins (Phase 2), and Save fixture. An
8-point candidate becomes playable the moment one join is marked
missing — the real validator passes it. **Save as Fixture** on a card
does the same without opening the editor, through the editor's own
store.

### The data

`tools/ether-mystery-lab/labGalleryData.js` — literal `points` and
`"a-b"` `joins` per candidate, authored, deterministic, reproducible.
Every candidate contains exactly its advertised number of points, every
point is joined to something, no image, SVG, silhouette or bitmap is
referenced, no model is called, and no geometry is derived from a name
(the suite fails on a branch on the creature name, and on any line that
couples a name to a point). The creature name is metadata beside the
figure and reaches no candidate, no canvas and no figure data.

### Disclosed

Whether any candidate reads as its creature is **not judged here** —
that is the whole reason the gallery exists. The candidates are what
the Ether figure language can DRAW at each budget, authored to be looked
at, and the first real look is the researcher's.

### Files

`tools/ether-mystery-lab/gallery.html` · `labGallery.js` ·
`labGalleryData.js` · `labShape.js` (the hand-off consumer). Suite
section `GL`. Screenshots: `tools/ether-mystery-lab-test/shots/gallery/`.

## CREATE FROM CREATURE — the AI-assisted reference mode of the Shape Lab

The Shape Lab's manual editor, fixtures, comparison, judgement and
import/export are exactly as they were. This is an ADDITIVE mode on the
same page: a person enters any creature or subject, an assistant gives
SEMANTIC help — what makes it recognisable, where each point budget is
best spent — and a rough visual reference to draw over, and the person
places every light, every join and every gap themselves. The eventual
product is a child doing this; the Lab is where the authoring flow is
worked out first.

**The assistant never draws the final creature.** The blueprint schema
has no field for final points, joins, gaps or a hint — those very keys
are on its forbidden list, so a reply carrying one is refused by name.
The only thing the assistant's output can become is a faint picture
under the editor and a set of suggestions a click may accept.

### What is added

- **`labBlueprint.js`** — the contract: `messagesFor(subject)` builds the
  request (one fixed system contract plus `Subject: <what was typed>`,
  nothing else); `validate()` refuses by shape — an unknown key at any
  depth, a forbidden key (Stars, card, memories, joins, gaps, hint…), a
  URL, a data URI, markup, a wrong bound — and returns a CLEAN copy built
  field by field; `parse()` treats a reply as text until proven a
  blueprint; `fixture(subject)` is one deliberately GENERIC body plan
  (head, body, tail, two legs, ear), the same for "Tiger" and "Wibble",
  which says in its own silhouette line that it is a fixture;
  `suggestions(bp, budget)` returns the anchors of the features the
  blueprint names for that budget.
- **`labReference.js`** — the underlay: a second canvas inserted UNDER
  the editor's "Complete — as drawn" canvas, `pointer-events: none`,
  aria-hidden, aligned to the pixel through the editor's own
  `project()`. It draws the sketch primitives faintly, the feature rings
  and labels, and the suggested points; it holds the current reference
  and the one before it; it writes no storage and makes no request.
- **`labShape.js`, additively** — `draw()` gains a `transparent` option
  (used only while a reference shows); add mode asks
  `LabReference.snap()` before placing a light; `project` / `unproject`
  / `scaleFor` / `observe` are exported; a fixture gains an optional
  `authoring: { subject, referenceUsed, source }` note — three words
  about HOW, never geometry; the header reads *TESTING 12 POINTS — Lab
  authoring / research budget · production currently supports 8*.
- **`shape.html`** — the *Create from creature* section, placed AFTER
  the Point budget and Tool sections so the editor's own controls stay
  where they were (its first placement pushed them below the fold, and
  the existing suite caught it) — (subject,
  Generate reference, REFERENCE ON/OFF, Try another interpretation,
  Bring back the previous one, Discard reference, feature-label and
  suggested-point toggles, the ten-step flow as a note rather than a
  wizard, and a compact *Where the help comes from* panel), and a
  *Reference blueprint* panel on the right.

### How the reference is generated

Through `labConnection.js` — the SAME three transports the Mystery Lab
already has, unchanged: **Fixture** (the default; no network at all, the
generic body plan), **Endpoint** (`supabase/functions/lab-generate`, the
provider key in that function's own environment, administrators only,
rate-limited), and **Direct** (development only; a key typed at runtime
into a closure, never stored, never exported, cleared by Disconnect).
`LabConnection.generate()` gained one additive hook — a caller may bring
its own fixture producer — and nothing else in it changed. No key is in
browser code and no production secret mechanism was invented. The reply
is `source: 'fixture'` or `source: 'generated'` and the status line and
the fixture's authoring note both say which. A failed or malformed reply
changes nothing: the reference in use stays, and the status says so.

### What the blueprint contains

`subject` (as understood) · `silhouette` (one sentence, and the viewing
angle) · `features[]` (name in capitals, `importance` 1–3, `why`, an
`anchor` in the editor's unit space) · `budgets` — for exactly 8, 12,
16 and 20, which feature names are worth spending that budget on ·
`sketch[]` — up to 24 ellipses, polygons and lines. Vector primitives
only: no image, no URL, no markup, and the validator refuses a value
that looks like any of them. It is semantic help and a picture to draw
over; it is not a score, and nothing in it says whether the author's
figure is good.

### How the author places and edits points over it

Exactly as before: Add / Move / Delete / Join / Gap on the editor canvas.
While a reference shows, the editor paints a transparent sky so the
sketch shows through underneath, and the lights and joins are drawn on
top. A click near a suggested point (within 0.12 units) accepts it — the
light snaps to the anchor — and from that instant it is an ordinary
light, movable and deletable; a click anywhere else lands exactly where
pressed; a suggestion is not drawn where a light already stands.
Suggested points can be switched off, feature labels can be switched off
or dismissed one by one, and none of it ever reaches the unfinished pane.

### REFERENCE ON / OFF

One button. OFF hides the underlay and the editor paints its own opaque
sky — byte for byte the render the Shape Lab always had — so what is
judged is the Ether figure alone. The reference is kept for turning back
on; nothing snaps while it is off. Discard clears the current and the
previous reference and leaves every light where it was.

### Arbitrary names

Any subject the pattern `letters, digits, spaces, apostrophes, hyphens,
≤ 40 characters` allows is sent as typed. There is no creature list, no
taxonomy and no branch on a subject anywhere in the blueprint or the
reference code; the suite scans for creature names and for
`subject === …`. In fixture mode every subject gets the same generic body
plan and the status says so.

### Privacy and security

The only input to the assistant is the subject plus the fixed contract
(suite-checked against the request body: no card, no Stars, no
constellation, no memory, no Story, no email, no username, no
Creator/Companion vocabulary, no geometry). Keys never reach browser
code beyond the existing dev-only closure. The reference reaches no
fixture (the suite scans the saved record and the export), no candidate
(the candidate is byte-identical with and without a reference), no
preview (`preview.html` loads neither module) and no Ether.

### The reference source is explicit, and a failure is never a fixture

*Reference source* is one visible three-way control at the top of the
section — **Fixture · LLM — Endpoint · LLM — Direct (dev)** — using
`LabConnection`'s own mode names. Fixture is the default. Choosing an
LLM source shows its fields (the `lab-generate` URL and an administrator
session token, or a dev-only provider key) plus *Test connection* and
*Disconnect / clear*, and the live connection line sits right under the
control. Nothing about the transports changed: the Endpoint mode is the
same relay the Mystery Lab uses, Direct is the same closure-held key,
and there is no third mechanism.

What is new is that the RESULT says where it came from, in three places
that cannot disagree because all three read the transport chosen BEFORE
the call, never the reply:

- the Reference Blueprint panel is badged **FIXTURE — generic authoring
  reference**, or **LLM — Endpoint (model)** / **LLM — Direct (dev)
  (model)**;
- the section carries `data-ref-outcome` — `fixture` · `generated` ·
  `rejected` · `failed` · `not-configured`;
- *What happened on the last generation* is a trace: source, subject,
  whether a request was sent, what came back (labelled `fixture` or
  `generated`, the model, the length), what the validator said and why,
  and the outcome.

**FAILED LLM ≠ Fixture.** A dead transport reads *"LLM request failed —
unavailable (LLM — Endpoint). No fixture was substituted."*; a reply the
validator refuses reads *"LLM result rejected by the blueprint validator
— …"*; an LLM source selected but not configured reads *"LLM — Endpoint
is selected but not configured — enter the lab-generate URL and an
administrator token, or choose Fixture. Nothing was generated."* In every
case the reference in use stays exactly as it was, and its badge still
says what IT came from. Three revert-proofs guard this: a transport
failure quietly substituting the fixture, an LLM result badged FIXTURE,
and the not-configured branch removed each turn their own checks red.

### What the real path needs, exactly

For **LLM — Endpoint**: `supabase/functions/lab-generate` deployed
(`supabase/DEPLOY_lab_generate.md`); `OPENAI_API_KEY` set in that
function's secrets (optionally `LAB_MODEL`, default `gpt-4.1-mini`);
the caller's session email present in `platform_admins`; and, in the
browser, the function URL plus that administrator session's access
token. *Test connection* then reports `LLM CONNECTED (endpoint)` — the
ping answers `build`, `provider: configured` and the model. For
**LLM — Direct (dev)**: a provider key typed at runtime, and a network
that can reach the provider host from the browser.

**Real connectivity was attempted from this build environment and did
not leave it.** With the real function URL entered, the browser's
request to `https://<project>.supabase.co/functions/v1/lab-generate`
failed at the proxy with `net::ERR_TUNNEL_CONNECTION_FAILED` (the
outbound policy answers 403 to the CONNECT tunnel for both the Supabase
host and `api.openai.com`; `curl` reproduces it). The UI reported *LLM
UNAVAILABLE — unreachable* on Test connection, and *LLM request failed —
unavailable (LLM — Endpoint). No fixture was substituted.* on Generate,
with the trace showing `request: sent`, `answer: failed — unavailable`,
`outcome: failed`. So the real path is proved OBSERVABLE here and is NOT
proved to reach a model here; no administrator token exists in this
environment either. The stubbed endpoint in the suite proves parsing,
validation, badging and refusal — it does not count as connectivity.

### The Creature Outline Reference replaces the assistant's sketch

The real LLM connection worked and the semantic half of its reply was
good; the picture was not — an LLM's ellipses and polygons came out as
generic blobs. So the visual reference is no longer the assistant's.
The concept is now:

    LLM → semantic creature blueprint
                 ↓
         Creature Outline Reference   (a visual authoring guide)
                 ↓
         author places Ether points
                 ↓
         final Ether figure

**BLUEPRINT** = semantic help from the assistant · **OUTLINE** = the
visual authoring guide · **ETHER FIGURE** = the author's own creation.
The legend says so on the panel. The outline is never called the
creature.

**What generates the outline.** `tools/ether-mystery-lab/labOutline.js`
— a **Lab-only deterministic composer**, and it says so on every result
(`source: 'lab-parts'`, badged in the panel as *Lab-only deterministic
outline — parts composed from the blueprint's features; not
provider-generated*). It reads the blueprint's FEATURE NAMES through a
parts vocabulary — HEAD, EAR, MUZZLE, BEAK, TRUNK, TUSK, HORN, MANE,
NECK, BODY, WING, LEG, TAIL, FIN, ARM, MANTLE, SHELL, HUMP, CREST — with
the modifiers a name may carry (LARGE EARS, LONG NECK, HOOKED BEAK,
THICK LEGS, EIGHT ARMS), infers a body plan from which parts are named
(legs → quadruped · wings → winged · mantle or arms → cephalopod · fins
without legs → finned · nothing to stand on → limbless), assembles
closed paths in the editor's unit space, and fits the whole to one
frame so 8-, 12-, 16- and 20-point figures over the same creature are
comparable. Texture and detail the blueprint names — STRIPES, SPOTS,
FUR, FEATHERS, EYES, WHISKERS, CLAWS — are recorded as *not drawn*
rather than faked; a word the composer does not know is recorded as
*not understood*. There is no `subject === …` and no creature
catalogue: a tiger and a wibble go through the same table (the suite
scans for creature names and subject branches).

**It is not provider-generated, and nothing pretends it is.** No image
provider exists in this project, none was added, no external image was
fetched or traced, and the environment cannot reach a provider anyway.
`LabOutline.compose(bp, {provider})` is the seam a real outline provider
can occupy later without the Shape Lab changing.

**How it is drawn.** Every part is filled opaque on an offscreen canvas
so overlapping parts merge into one flat silhouette, and the whole is
laid under the editor at low alpha — monochrome, no strokes inside, no
eyes, no texture, no text; a children's silhouette, subordinate to the
lights drawn over it. The underlay is still `pointer-events: none`,
still never on the unfinished pane, and REFERENCE OFF still returns the
editor to its original opaque sky with nothing snapping.

**Suggested points and labels sit on the outline now.** The composer
returns anchors keyed by the blueprint's own feature names (FOUR LEGS →
four feet, WINGS → two wing tips, EIGHT ARMS → eight arm tips), and the
existing suggestion mechanism reads them, so a faint mark is a place ON
the outline. Nothing is auto-traced: no light is placed, no join is
proposed, no gap is decided.

**The assistant's sketch is deprecated.** The validator accepts one when
present (an older prompt or a model that still returns it) and never
requires it; the panel notes it is *deprecated and not shown*. The
prompt was not changed for this — the semantic architecture is what the
real connection verified, and it stays.

**Data boundary.** The outline lives in the reference layer's memory
and nowhere else: not in a fixture (still only
`authoring: {subject, referenceUsed, source}`), not in the export, not
in a candidate (byte-identical with and without it), not in
`preview.html`, not in the pool. *Show blueprint JSON* reveals the
semantic blueprint for the record, and the outline is not in it.

**Recognisability, judged by looking, with the names hidden.** Five
constructed semantic inputs — the feature lists a real reply would
carry — rendered through the real page
(`tools/ether-mystery-lab-test/shots/shape-lab/outlines/`,
`recognisability-sheet-unlabelled.png` is the blind sheet):

| subject | body plan | verdict | why |
|---|---|---|---|
| lion | quadruped | RECOGNISABLE | a big cat with a mane |
| tiger | quadruped | SUGGESTIVE | plainly a cat; nothing says *tiger* — the diagnostic feature is STRIPES, which is texture and is deliberately not drawn |
| falcon | winged | RECOGNISABLE | a spread bird of prey with a hooked beak; not a species |
| elephant | quadruped | UNMISTAKABLE | trunk, tusks, big ears, thick legs |
| octopus | cephalopod | UNMISTAKABLE | a dome and eight arms |

Against the previous LLM sketch (generic ellipses; the owner's own
verdict was that it produced generic shapes) this is a substantially
better authoring aid: an author can see where the head, ears, muzzle,
legs and tail are and put lights there. The honest limit is that a
monochrome silhouette carries a FAMILY (cat, bird of prey) rather than
a species when the species lives in texture or proportion.

**The critical tiger test — with a disclosure.** The exact real
LLM-generated tiger blueprint was never persisted: the Lab held it only
in page memory, and nothing stored it. The tiger input used here is the
feature set that reply was reported to contain — HEAD, EARS, MUZZLE,
BODY, FOUR LEGS, LONG TAIL, STRIPES — not its text. *Show blueprint
JSON* now exists so the next real reply can be kept. On that input the
outline is a recognisable cat with a long tail; an author can place
head, ears, muzzle, shoulder, body, four feet and tail-tip over it,
which the LLM sketch never allowed. Whether it reads as a *tiger*
rather than a cat is the texture limit above, and the Ether figure
language cannot draw stripes either — so the remaining gap is the
geometry language, not the outline.


### Adaptive suggested points, and geometry that stays the author's

The Adaptive Suggested Points sprint changed three things about the Shape
Lab and nothing about production (`arrangementNodesMax` is still 8; the
validator, the pool, the runtime, the Mystery, Composer, Discovery and
Life layers, the canon and the build are untouched).

**Six authoring budgets.** `8 · 10 · 12 · 16 · 18 · 20`. All six are
Lab authoring / research budgets; 8 is still the only one production
performs, and the header, the metrics and the Play reason still say so.
A blueprint reply still needs only the four canonical lists (`8`, `12`,
`16`, `20`); `10` and `18` are accepted when present and otherwise read
the nearest smaller list.

**Suggested points are RANKED, and recomputed on every budget change.**
The outline composer now names, for every part it draws, the places a
light could usefully stand — each with a *level*: 1 the part's defining
point (a head, a foot, a wing tip, a beak tip, a trunk tip), 2 a
structural place (a shoulder, a rump, a wing root, a tail base, a trunk
base), 3 a detail place (a knee, a crown, a leading or trailing edge, the
middle of a tail). `LabOutline.compose()` returns them as `landmarks`,
mapped onto the blueprint's own feature names. `LabBlueprint.suggestions
(bp, budget, outline)` ranks every landmark of the features the
blueprint lists for that budget by

    priority = importance × 10 − (level − 1) × 14 − (nth mark of one feature at one level) × 3

and takes the first *budget* of them (two landmarks closer than 0.07
units are one place). One ranking serves every budget, so 8 → 12 only
adds marks and 12 → 8 only removes them, and what survives the lowest
budget is what the blueprint itself calls diagnostic: for the
constructed test creatures, the tiger's eight are its head, body, feet,
tail tip, rump and shoulder; the elephant's its trunk tip, an ear, body,
head, tusk tip, two feet and the trunk base; the falcon's its beak tip,
head, body, both wing tips, tail tip, breast and a wing root. A larger
budget adds structure and then detail — never filler. Nothing here is
hard-coded per creature: a subject the composer has never met gets the
same treatment from its own features, and a feature the outline cannot
draw keeps the blueprint's anchor as its one defining point.

**They are marked to be seen.** A dashed ring with a soft glow and a
small dot, sized by level, its label beside it when feature labels are
on — and always on the underlay, beneath the author's own solid lights,
so the hierarchy *authored light > suggested point > outline > sky*
holds (the suite measures it in luminance). ~~Nothing is ever placed
automatically~~ (superseded below, on the product owner's instruction:
the budgeted suggestions are now placed as the starting figure, and a
mark is drawn only where no light stands). A click near a mark accepts
it and the light lands there
carrying only the *name* of the feature (a word — `roles` on the fixture,
never a place); a click anywhere else lands exactly where pressed.

**The suggested points are the starting figure.** Two corrections from
the product owner on the first real lion. The UNFINISHED pane stood
empty until a light was placed (it drew only the authored figure, and
the suggestions lived on the reference layer alone), and when faint
marks were then drawn there he said the suggested points *are* part of
the authored figure. Asked which form that should take, he chose
placing them as lights. So on Generate, and whenever the budget grows,
every budgeted suggestion is placed as a real light named for its
feature — `ShapeLab.placeSuggestions()`, the one seam, called from
`LabReference.set()` and from `setBudget()` when the budget rises, and
offered as **Place suggested points** in the panel. This overrides the
earlier "never auto-placed" rule on the product owner's instruction and
nothing else: gaps are never placed for anybody (joins — see the Join
tool below), a smaller budget still deletes nothing, and a placed light
is an ordinary light from the moment it lands.

A place the author moved a light AWAY from stays theirs for the
session. The suite found the hole: a light moved off its landmark freed
that landmark, and the next budget growth placed a new light back on
it. Each light now remembers the suggested place it was accepted at
(`state.origins`, session-only, never serialized — a reopened fixture
starts with none), and `LabReference.occupied()` treats an origin as
taken whether or not a light still stands there. Deleting the light
gives the place back, and it can be placed again under the same name.

The UNFINISHED pane shows the starting figure as solid lights on its
own opaque sky, never the outline, and marks only what is EMPTY — a
suggested place the author deleted a light from, or a budgeted place
beyond a full figure — as a faint dashed ring with a caption. A mark is
never a light, enters no fixture or candidate, and goes with REFERENCE
OFF while the lights stay: the judging state is the authored figure
alone. `AP3`, `AP5`–`AP5f`, `AP10`–`AP10c`; `AR2h`, `AR5d` and `AP1d`
turned round with reasons, and the AR accept-by-click checks empty the
placed figure first so the click path is still walked from nothing.

**The Join tool joins the lights in their order.** Asked for by the
product owner one message later: *"the join button should automatically
join dots as per their order."* Pressing Join makes the consecutive
joins — 1→2, 2→3, … in the order the lights stand, which for a placed
starting figure is the ranking's order — and only the ones that are
missing (`ShapeLab.joinInOrder()`, idempotent: a second press adds
nothing and says so). An existing join is kept, a gap is kept, nothing
is removed, and the chain is left open. The click gestures are
unchanged for what follows: two joined lights clicked again remove
that join, a line clicked removes it, the Gap tool marks a join
missing. So the order is a starting point and never a lock, and a gap
is still never chosen by the system. `AP4e` (which asserted the Join
tool made no join by itself) was turned round with its reason in
place; `AP11`–`AP11e` guard the order, the count in the status line,
the idempotence, the kept gap and the surviving click gesture.

**Every Lab script carries a content stamp, and the stamper is part of
every Lab change.** The product owner pressed the new Join tool and
nothing joined: his screenshot showed the new help text (the page had
arrived fresh) and the old behaviour (`labShape.js` had not — a
versionless script the browser was still holding). Every `<script
src>` on the four Lab pages now carries `?lab=<stamp>`, a hash of the
contents of every file those pages load, written by
`tools/ether-mystery-lab/stamp.js`. **After changing any Lab file, or
any production file a Lab page loads, run**

```
node tools/ether-mystery-lab/stamp.js          # rewrite the four pages
node tools/ether-mystery-lab/stamp.js --check  # report only; exit 1 on drift
```

The suite's `S3c` runs the check and fails on drift or on a bare tag,
so a change that forgot to restamp cannot pass. The product build
stamp (`?v=0769`) is untouched; the Lab ships nothing to a child.

**A feature name is repaired mechanically, and the repair is named.**
The product owner's first real dragon came back refused whole —
`bad-feature-name:5, bad-feature-name:6` — because the rule was
capitals, letters and spaces, at most 24, and a real model writes
"WING-MEMBRANE", "2 HORNS" or "TAIL (TIP)" for a body part.
`LabBlueprint.cleanName()` now turns anything that is not a letter or a
space into a space, collapses runs, and cuts a name over the cap at a
word boundary; the budget lists resolve through the same cleaning, so
"Wing-Membrane" in a list still finds WING MEMBRANE. Every repair is
reported — `repairs` on the validator's result, and a *names tidied*
row in *What happened on the last generation* showing what the model
wrote and what it became — never a silent rewrite. A name with no
letters left in it is still refused, and the status line and the trace
say which name (*refused: "---"*), so a refusal is never a code alone.
The contract tells the model the same rule. `AR11f`–`AR11h`.

**Feature focus.** Choosing a feature in the blueprint panel — or
accepting one of its suggestions — exposes that feature's related
landmarks at every level in gold beside the budgeted ones (a wing: its
tip, its root, its leading and trailing edges). One name, cleared by
choosing it again. Not an inspector.

**A budget is an authoring target, never a destructive operation.**
Changing the budget touches no authored point, join, gap or name. Going
up simply opens more suggestions. Going DOWN under a bigger figure keeps
every light and shows that the figure **exceeds the selected budget** —
in the header (`FIGURE EXCEEDS BUDGET (12 lights)`), in the metrics
(`EXCEEDS the selected budget by 2`), beside Play, and in the Say line
(*nothing is trimmed for you*). While it exceeds the budget the Lab's
existing refusal convention holds: no light can be added, the figure
cannot be saved (a stored fixture stays at or under its budget, so a
hand-edited one over its budget is still refused on open and on import)
and it cannot be approved, and nothing is suggested. The researcher
deletes lights by hand; the moment it fits, the state clears. (Before
this sprint the shrink itself was refused; SL5b and AR9c were turned
round with the reason in place.)

**MOVE, ADD, DELETE, JOIN, GAP stay the author's.** A moved light keeps
its index, its joins and its name and never snaps back to the outline; a
deleted light takes its joins and gaps with it and the rest renumber;
the system never chooses a gap.

**APPROVE FIGURE.** `ShapeLab.approve()` freezes the authored figure as
the research artifact:

    { kind: 'vihu-shape-lab-approved-figure', labVersion, approvedAt,
      name, subject, budget, points, joins, missing,
      roles: [{ light, feature }] }

— the points, the joins, which joins are gaps, the selected budget, and
per accepted light the feature it stands for. No outline, no sketch, no
landmark, no blueprint, nothing private, no key. The page enters a
clear **APPROVED FIGURE** state; *Show approved artifact* prints it; it
is stored on the fixture (`approved`) and travels through the existing
export. Any later edit to the figure clears it — a frozen artifact never
describes a figure it does not match — and a stored approval is honoured
on reopen only while it still matches the stored geometry. Approving
activates nothing and publishes nothing: no hint, no gap, no challenge,
no completion, no awakening, no roaming, no pool entry.

Suite section `AP` (40): statics; the ranking across lion, tiger,
falcon, elephant and octopus through all six budgets in Node
(bounded, monotonic, high-importance features surviving 8, extras
structural, distinct, pure); the real page through the stubbed endpoint
for the same five creatures (screenshots at 8 and 20 under
`shots/shape-lab/adaptive/`); accept · freehand · move · join · gap ·
delete as a person does them; 12 → 16 and 16 → 10 with twelve lights
placed; feature focus; the visual hierarchy measured; REFERENCE OFF;
judge, approve, inspect, save, reload, edit-clears.

### A short research procedure

1. Open `tools/ether-mystery-lab/shape.html`. Under *Reference source*
   choose **LLM — Endpoint**, paste the `lab-generate` URL and an
   administrator session token, press *Test connection* and wait for
   `LLM CONNECTED (endpoint)`. (Fixture walks the pipeline with a
   generic body plan and never understands the creature.)
2. Enter **lion** → Generate reference. Confirm the blueprint panel is
   badged **LLM — Endpoint (…)**, never FIXTURE, and open *What happened
   on the last generation* to see the request, the model, the validator's
   verdict and the outcome.
3. At budget 8, place lights over the reference (accept the ranked
   suggestions or not — choose a feature in the panel to see its
   related points), join them, mark a gap. Toggle REFERENCE OFF. Judge.
   **Approve figure**, then Save.
4. Switch to 10, 12, 16, 18, 20 (Save as new… each time) and compare
   across budgets. Shrinking a budget under a bigger figure keeps every
   light and says the figure exceeds it — delete by hand.
5. Repeat with **tiger**, **falcon**, **elephant**, **octopus**. Each
   should arrive with its own diagnostic features and its own sketch —
   the assistant's semantic reading, never a body plan the Lab knows.
6. Export the fixtures. The judgement is yours; nothing here scores.

### Disclosed

No child has used it and no creature was judged. This environment cannot
reach a provider, so the generated path is proved against a stubbed
endpoint returning a valid blueprint (and four kinds of bad one); a real
model's blueprints are the product owner's to look at. The fixture
reference is a generic body plan by design, not a picture of the subject.
The saved fixture already holds the first stages of the eventual creature
record (creature → complete → unfinished → missing joins → hint →
delayed help); nothing beyond those is activated.

### Files

`tools/ether-mystery-lab/labBlueprint.js` · `labReference.js` ·
`labOutline.js` · `labShape.js` (additive) · `shape.html` ·
`labConnection.js` (one hook). Suite sections `AR` (86 checks) and `AP`
(40). Screenshots:
`tools/ether-mystery-lab-test/shots/shape-lab/reference-on.png`,
`reference-off.png`, `reference-generated.png`, and
`shots/shape-lab/adaptive/*.png`.


## REVEAL-ONLY CREATURE FEATURES — the payoff, authored beside the puzzle

**Lab only. Zero production files changed.** `js/`, `assets/`,
`vihuplanet/`, `supabase/`, `index.html` and `studio.html` have an
empty diff; `arrangementNodesMax` is still 8; every stamp on
`index.html` still reads 0769; the production pool holds no reveal
feature and cannot, because nothing that reads the pool knows what one
is.

### The distinction

```
DOTS + JOINS            = THE CHALLENGE
REVEAL-ONLY FEATURES    = THE PAYOFF
```

A reveal-only feature is a small visual detail — a mane, a wing
membrane, a set of stripes, a pair of horns — that appears ONLY after
the Creature Mystery's figure is completely solved, stays a few seconds,
and fades. It is not a star. It is not connected by the child. It is
not a puzzle piece. It is not part of the completion condition and
cannot affect it. It cannot be tapped, moved, selected or deleted by a
child. It is purely visual, and it exists to give the completed creature
its emotional and visual impact.

```
UNFINISHED CREATURE
    ↓  the child connects the missing lights
ALL REQUIRED JOINS COMPLETE
    ↓  the figure blazes (the interpreter's own awakening, untouched)
REVEAL-ONLY FEATURES EMERGE      ← labReveal.js, drawn by the Lab over the sky
    ↓  hold (the researcher's number, default 4s)
FEATURES FADE
    ↓
the pure Ether figure remains / the creature roams, exactly as before
```

### The data model (`tools/ether-mystery-lab/labReveal.js`)

A reveal block is `{ durationS, features[] }`, kept on the fixture
BESIDE the puzzle geometry and never inside it. A feature is:

```
{ id: 'rf-1',                     // opaque
  name: 'MANE',                   // a label — capitals, letters and spaces, ≤ 24; never shown to a child
  type: 'contour',                // one of SEVEN generic primitives
  lights: { a: 0, b: 1 },         // two of the AUTHOR'S OWN lights, as INDICES (b may be null = the figure's centre) — never `anchor`, which is the blueprint's coordinate
  offset: [0.1, 0],               // in frame units (|AB| = 1), along/across the A→B frame
  size: 1, angle: 0,              // scale and turn of the feature in that frame
  params: { strands: 11, radius: 0.62, sweep: 310, wave: 0.35, spread: 0.7, mode: 'around' } }
```

**Deny by shape.** `LabReveal.sanitize(block, pointCount)` returns a
clean copy built field by field and REFUSES BY NAME: an unknown key at
any depth (`unknown-key:features[0].lights.c`), a name carrying the
product's boundary vocabulary (card, stars, constellation, memory,
email, story, companion, key, token…), an anchor past the figure or
onto itself, an unknown type, a ninth feature, a non-object. Every
number is clamped to a written bound (`LIMITS`, `PARAMS`). Nothing is
ever trimmed into use. `Math.random`, storage, network, timers and
images appear nowhere in the file; a creature name appears nowhere in
it either, and the suite scans for all of that.

### The seven generic primitives

| type | what it draws | tuned by | used in the research set as |
|---|---|---|---|
| `contour` | flowing glowing strokes — `around` the anchor (arcs centred away from B) or `radial` from it | strands · reach · sweep · wave · spread · mode | lion's mane, lion's tail tuft, mermaid's hair, elephant's ear contour |
| `fill` | a soft translucent silhouette — `membrane` (sagging between A and B), `fan` (from A toward B), `lobe` (an ellipse between them) | shape · bulge · width | dragon's wing membranes, mermaid's tail fin |
| `lines` | accent strokes laid along A→B, tilted, curved, tapered toward the ends | count · length · tilt · curve · taper | tiger's stripes and face markings, falcon's feathers, elephant's trunk rings |
| `texture` | a field of small scale-like marks in a box along A→B | rows · columns · mark · width · height | mermaid's scales |
| `spike` | tapered appendages — fanned at A around the A→B direction, or `along` the join standing off it | count · length · base · curve · spread · along | dragon's horns and spine ridges, elephant's tusks |
| `glow` | one soft pulsing light | radius · intensity · pulse | falcon's eyes |
| `motes` | a few drifting twinkling lights around A | count · reach · drift · mark | (authored by hand in the Lab; not in the shipped set) |

All seven are drawn in the Ether's own light — paper-cream and a touch
of the Studio's gold, a wide faint pass under a thin bright one (the
way the currents are drawn), low alpha, slow flow — so they read as
light in the sky rather than as an illustration pasted over it.

### Anchoring — the AUTHORED figure is authoritative

`frameOf(feature, P)` builds a frame from two of the author's own
lights in SCREEN space: origin at A, x-axis toward B (or toward the
centroid when B is null), unit length |AB|. Everything a feature
draws is expressed in that frame. So:

- move the head light and the mane moves with it, exactly (RV3, RV10);
- move the light it points toward and the feature turns and scales
  with the part it belongs to (RV3b);
- delete a light and every feature anchored to it is dropped, every
  later anchor steps down (RV2f, RV10b).

The blueprint outline is never an anchor and is never consulted by the
renderer: it was authoring help, and the suite checks that the reveal
preview's drawing path reads nothing of the reference (RV15e).

### The timeline (`LabReveal.envelope`, `totalMs`)

```
completion → afterMs 380 (the figure's own blaze; nothing drawn)
           → each feature emerges over 900ms, a 140ms beat after the last
           → HOLD for durationS (researcher's number, 1.5–10s, default 4)
           → all fade together over 1300ms
           → gone: alpha 0, nothing left on the canvas
```

A pure function of milliseconds since completion. There is no
countdown, no remaining time, no "hurry" — the hold is simply how long
they stay, and a child is never shown a number.

### Authoring, in the Shape Lab

A **Reveal-only features** section sits between *Play in Ether* and
*Approve figure*. Add a feature (type · at light · toward · name); each
row shows its offset, size, angle and the type's own parameters; a row's
× deletes it; *hold for N seconds* is the duration. The **reveal
preview** canvas underneath shows the COMPLETE figure on its own opaque
sky with the features standing at full light and a small dashed ring at
each one's origin — drag the ring to move it. **▶ Play reveal** runs the
whole sequence on that canvas and then leaves the plain figure standing
until the next edit. *Show features while authoring* off → the plain
complete figure.

The two judging panes never draw a feature — pixel-identical with and
without (RV7d) — and the unfinished figure never can (RV8). REFERENCE
ON / OFF is untouched: the outline lives under the editor canvas and
nowhere near the reveal canvas.

The blueprint contract gained one OPTIONAL, SEMANTIC field: `reveal`,
up to eight `{ name, kind, near }` — names of details that would give
the finished creature its character, a kind from the seven, and which
feature it belongs to. Never points, never shapes. The Lab validates it
(keys refused by name; an unknown kind or `near` is dropped and named as
a repair), lists it in the blueprint panel, and offers each as a
one-press addition anchored to the light whose role matches. The
fixture blueprint carries two generic ones (CREST near HEAD, TAIL TUFT
near TAIL). No model-generated code, HTML or executable instruction of
any kind is possible through that field.

### Approval and the data boundary

`Approve figure` freezes both. The artifact now carries
`sections: { puzzle: ['budget','points','joins','missing','roles'], reveal: ['reveal'] }`
and a `reveal` block with its own `kind`
(`vihu-shape-lab-reveal-only-features`) and a sentence saying what it
is. Editing a feature clears the approval exactly as editing the figure
does; a stored approval is honoured on reopen only while it still
matches the stored reveal (RV14e). The artifact carries no outline,
sketch, blueprint, landmark, silhouette, identity or link (RV14c).

A fixture's reveal block is refused on import AND on open when it is
not what the vocabulary allows (RV13b). The candidate handed to the
interpreter never contains a reveal feature — not the block, not a
name, not a type (RV7b): the features travel BESIDE the candidate to
the Ether preview, exactly as the leading hint and the tease do.

### In the real Ether preview

`labPreviewHost` passes the block beside the candidate; `preview.html`
gained one inert canvas (`data-reveal`, `pointer-events: none`);
`labPreview.js` sanitizes the block AGAIN (the preview trusts nothing it
is handed) and starts the reveal from ONE place — the interpreter's own
`mystery:joined` with `left === 0`. Nothing is drawn while a join is
missing (RV17: not after posing, not after the first join). The
features are drawn at the interpreter's live node positions read off
`instrument()` — so they gather and breathe with the waking figure —
and once the figure has set off (`instrument()` goes null) the layer
keeps its last layout and follows the wanderer's centre, which is all
the runtime exposes and all the tail of a fade needs. After the hold:
no pixels, the canvas hidden, the creature roaming exactly as before
(RV17e, RV17c).

Measured: 20,054 lit pixels at full reveal for the falcon's four
features at 1500×1100; 0 before the last join; 0 after the fade.

### The first research set (`labRevealData.js`, *Load research set*)

Six eight-light figures with reveal features, each importable as a
fixture and playable in the real Ether. Screenshots of the four states
— A unfinished · B complete without reveal · C complete with reveal ·
D after the reveal fades — are under
`tools/ether-mystery-lab-test/shots/reveal/`.

| creature | reveal features | B → C, by looking |
|---|---|---|
| Lion | MANE (contour around head→shoulder, 11 strands), TAIL TUFT (contour radial) | The strongest change of the six: eight lights that read as "a four-legged something" gain a ruff around the head and the animal becomes a lion candidate at once. The mane is a set of glowing arcs, plainly light and not fur; it reads as a mane by placement. |
| Tiger | BODY STRIPES (9 lines across shoulder→rump), FACE MARKINGS (4 short lines) | The stripes say *striped* immediately; the figure underneath is still a generic quadruped, so C reads as "a striped animal" rather than unmistakably a tiger. The first draft (7 longer, untapered lines) read as a rib cage — taper and shorter strokes fixed it. |
| Dragon | WING MEMBRANE ×2 (fill), HORNS (2 spikes swept back), SPINE RIDGES (6 spikes along neck→rump) | The membranes turn a triangle of lights into a wing; the horns are the single most legible mark. At the first alpha the fills were a solid sail and were halved. Still the heaviest of the six and the closest to "pasted". |
| Mermaid | FLOWING HAIR (9 radial strands), TAIL FIN (fill fan), SCALES (6×5 texture) | Scales are the surprise: at the first size they read as the letter C repeated; smaller and more closed they read as scales and carry the identity. Hair reads as a fountain of strands from the head. |
| Elephant | TUSKS (2 thin curved spikes), EAR CONTOUR (3 arcs), TRUNK DETAIL (8 rings) | The weakest of the six. The rings along the trunk read as rungs, the tusks as sticks; the figure's own trunk (one light hanging from the head) carries more of the elephant than the reveal does. |
| Falcon | LEFT/RIGHT FEATHERS (7 lines each along the wings), EYE ×2 (glow) | Clean: parallel strokes along each wing read as feathers and the two glows give the head a face. "Bird" is confirmed; "falcon" is not, and no reveal primitive could say it. |

**What the set answers.** The reveal reliably turns a completed figure
from *a shape of lights* into *a creature of lights* — recognisability,
character and the sense that something is alive all rise, and the
authored geometry stays visible underneath because the features are
light rather than fill. It does NOT make a weak figure into a strong
creature (the elephant), and it can tip into illustration when a fill
is large and dense (the dragon at its first alpha). Six of the seven
primitives were sufficient for the set; `motes` was not needed for any
of these six.

**Whether a six-year-old feels the "OH!"** is not proved here — no
child has played it — and the environment cannot reach a provider, so
the blueprint's `reveal` suggestions are proved against the fixture and
a stubbed reply only.

### Proved by reverting

Each mutation was applied to one Lab file, section `RV` run, and the
file restored from a backup: the reveal started on ANY join rather
than the last → `RV1g`, `RV17`, `RV17b`, `RV17d` red; the unfinished
state drew the features → `RV8` red; the reveal block smuggled inside
the figure the candidate carries → `RV7` (the REAL validator refused
the unknown key on its own) and `RV7b` red; the sanitizer dropping
unknown keys instead of refusing → `RV2c`, `RV13b` red; an approval
ignoring the reveal → `RV14e` red. A first mutation for the candidate
case — a `reveal` key on the INPUT to `creatureCandidate` — went red
nowhere, because the Kit builds a candidate field by field and never
copied it: the guard working, not the check failing, and why the
smuggling had to go inside the figure to prove anything.

A process lesson worth writing down: the first proof runner restored
files with `git checkout --`, which restores to the last COMMIT — and
wiped the uncommitted reveal work it was in the middle of proving. A
runner must restore from a copy it took itself.

### Files

`tools/ether-mystery-lab/labReveal.js` (new) · `labRevealData.js` (new)
· `labShape.js` (additive: the reveal list, canvas, rows, approval)
· `shape.html` · `labPreview.js` · `labPreviewHost.js` · `preview.html`
· `labBlueprint.js` (one optional field) · `labReference.js` (one panel
list). Suite section `RV` (61 checks). Screenshots:
`tools/ether-mystery-lab-test/shots/reveal/<creature>-{unfinished,complete,reveal,after}.png`.

## ETHER CREATURE TRANSLATION V1 — art direction in words, beside the outline

Lab only; zero production files changed; build stays 0769. The
blueprint gains one optional, clearly separated section —
`etherInterpretation` — in which the assistant acts as an **art-direction
translator, not an illustrator**: how the creature should FEEL once it
is abstracted into a few lights. It is validated as words only, shown
beside the outline, and consumed by exactly one thing: the order of the
suggested points.

### The mental model, now in six parts

**BLUEPRINT** = what the creature is · **ETHER INTERPRETATION** = how
it should feel abstracted · **OUTLINE** = visual reference ·
**SUGGESTED POINTS** = landmarks · **ETHER FIGURE** = the researcher's
own creation · **REVEAL** = temporary detail. The Shape Lab's legend
says exactly this.

### The schema (`LabBlueprint.SCHEMA.interpretation`)

Ten parts, every one words:

| key | what it is |
|---|---|
| `character` | 1–4 short words; a suggested vocabulary (`CHARACTER_WORDS`) that is not rigid — a word off it is kept and marked as the assistant's own |
| `gesture` | one sentence: the ONE dominant gesture or pose |
| `architecture` | 1–5 sentences: how the main masses relate |
| `proportion` | 0–4 of `{feature, treat: exaggerate\|compress\|keep, note}` |
| `diagnostic` | 2–4 feature names that must survive the abstraction |
| `abstraction` | `{stance: do-not-draw-literally\|simplify\|literal-is-fine, doNot[], instead[]}` — the assistant may say plainly that the creature should not be drawn literally |
| `rhythm` | one sentence on spatial rhythm and negative space |
| `movement` | one sentence on movement CHARACTER, words only |
| `structural` | 0–8 feature names worth a light and a join |
| `revealOnly` | 0–8 names best kept for the payoff |

**It is NOT geometry, by construction.** The validator
(`interpretationOf`) refuses, at any depth inside the section: a
geometry or code key by name (`INTERPRETATION_GEOMETRY_KEYS` — points,
x, y, coordinates, path, polygon, canvas, code, script, sketch, anchor…),
any non-string leaf (a number, a boolean, null), any DIGIT in any text
("two" is the word), a coordinate-shaped or SVG-shaped string, a
code-shaped string (a function, an arrow, `ctx.`, a template), and
markup, links and data URIs (the blueprint's own `badText`). Animation
vocabulary in `movement` (ms, seconds, frames, animate, easing, loop) is
refused too: movement is character, never an instruction.

**A failing section is SET ASIDE BY NAME, and the literal blueprint
stands.** `validate()` returns `interpretationRefused: [...]` and adds
one repair line (`etherInterpretation set aside — …`); the blueprint
that comes out is byte-identical to one whose interpretation was clean.
A good literal blueprint is never lost because its art direction carried
a digit. The product's own boundary words (constellation, stars, card,
memories, pattern, email…) still refuse the WHOLE reply at any depth,
as they always did — that is a stronger rule and it runs first. Bounded
lists are cut with a named repair; an unknown feature in `diagnostic`,
`proportion` or `structural` is dropped and named; an unknown stance
falls to `simplify`, named; a name in both `structural` and
`revealOnly` stays structural, named.

### The request

`messagesFor(subject, idea)`. The **author idea** is optional, one line,
plain words and punctuation, ≤ 200 characters, scanned like every other
text and refused BY NAME (`bad-idea`) when it cannot be sent — never
trimmed into something else. It travels as its own line under the
subject (`Subject: Lion` / `Author idea: …`) and is never the subject:
with no subject the request is `bad-subject` however good the idea. The
contract is ONE fixed text, identical for every subject with and without
an idea; it asks for the interpretation, allows the assistant to refuse
literal representation, forbids numbers and geometry in it, says the
idea is not the subject — and still says the assistant never draws the
final figure. No private word anywhere in the request (suite-scanned).

### What consumes it — and what deliberately does not

**The suggested-point ranking, and nothing else.** In
`LabBlueprint.candidates()` a feature the direction calls `structural`
or `diagnostic` is lifted ahead of one it does not name at the same
level; in `suggestions()` a feature it calls `revealOnly` is kept OUT of
the budgeted suggestions (still reachable through feature focus). A
suggestion is still a mark on one of the outline's own landmarks — the
interpretation invents no place. `suggestionsWithout()` is the same
ranking with the section set aside, and the panel shows both
(`[data-ref-compare]`): with the direction, and from the literal
blueprint alone, at the budget in force, with what was brought in and
what was left to the reveal named.

**The outline composer does NOT consume it, and that is a judgement,
not an omission.** The composer (`labOutline.js`) is a silhouette of
PARTS — it reads which parts a blueprint names and lays a body plan for
them. The interpretation is direction about FEEL — "rearing", "one long
S from head to tail", "two halves meeting at the hip". Drawing "poised"
is not a thing a parts composer can do honestly, and the two constructed
creatures where the direction most disagrees with the archetype show why
a patch would be wrong: the dragon's interpretation is a rearing side-on
S-curve and the composer draws a **winged** archetype — a bird from
below, wings level; the mermaid's is two halves and the composer draws
a **finned** archetype — a fish, with the head, torso and reaching hand
dropped onto its side. Re-ranking a few landmarks cannot turn a fish
into a mermaid. Where the interpretation and the outline disagree, the
interpretation is shown beside the outline and the RESEARCHER is the
one who reconciles them — which is what the layer is for. Teaching the
composer a gesture is its own decision (see the report's H).

**Not consumed anywhere else, by construction.** `js/` is untouched;
the blueprint module reaches no editor, no network and no store (it
cannot place, join or remember a light); the fixture record holds none
of the direction (only `authoring: {subject, referenceUsed, source}`);
the approved figure carries none of it; the reveal list is untouched
by a generation; nothing about the interpretation or the idea is written
to browser storage. The reveal is NOT executed by the interpretation:
`revealOnly` is a recommendation the researcher reads, and the reveal
features are authored exactly as before.

### The constructed research set (`labTranslationData.js`)

Five hand-written blueprints — Lion, Tiger, Dragon, Mermaid, Falcon —
each carrying a full interpretation, loaded through *Translation
research set → Load constructed blueprint* and labelled **CONSTRUCTED**
on the badge, the source line, the status and the trace: never a
fixture (the fixture is ONE generic body plan) and never called
generated (no model was reachable from this environment). They go
through the real validator on the way in. Four of the five refuse
literal representation (`do-not-draw-literally`); the falcon only
simplifies. Every interpretation changes the suggested structure at 8
or 12 (measured: Lion, Tiger, Dragon and Falcon at both; Mermaid at 12).

The four-way comparison is committed per creature under
`tools/ether-mystery-lab-test/shots/translation/`: **A** the literal
blueprint (the panel's feature and budget rows, with **C** beneath),
**B** the literal outline alone (every light removed, reference on),
**C** the interpretation read back, **D** the suggested structure WITH
the direction (the placed starting figure over the outline).

### Judged by looking — the researcher's own judgement, no model scoring

- **Lion** — the strongest. The direction ("the mane is the largest
  mass and the head is inside it"; exaggerate the mane, compress the
  head, keep the long back) matches what a few lights can do, and the
  with-structure puts a mane light above the head, keeps the long back
  as shoulder → body → rump, and leaves the tuft and the muzzle to the
  reveal. Distinctiveness, proportion and point economy all improve
  against the literal ranking, which spent lights on second leg marks.
- **Tiger** — good. "One long horizontal with the head BELOW the line
  of the back" is exactly the sentence a literal blueprint cannot say,
  and the with-structure keeps the stripes and the muzzle out of the
  lights entirely; the tail is lifted ahead of the legs. What it cannot
  do is lower the head — that is the composer's, and the composer draws
  a standing cat.
- **Dragon** — the direction is the best of the five as WRITING
  ("neck and tail as one S with the small chest at its middle; the
  wings hang from the middle of that line; most of the figure is empty
  sky held between the wings") and the outline is the worst match: a
  winged archetype seen from below, wings level, head up. The
  interpretation re-ranks correctly (wings, neck, head, tail first;
  horns, jaws and hind legs to the reveal) and cannot fix the picture.
  This is the case that answers H.
- **Mermaid** — the same finding, harder. "Two halves meeting at the
  hip, the fish half longer than the torso is tall, one diagonal from
  fluke to fingertips" is right and the composer draws a fish with a
  head, a torso and a hand pinned to its flank. At 8 the direction
  changes nothing, because the eight lights the literal ranking chooses
  are already the ones the direction names; at 12 it leaves the hair to
  the reveal.
- **Falcon** — good and honest. The stance is `simplify`, not
  `do-not-draw-literally`, because a stooping falcon IS an arrowhead
  and an arrowhead is drawable; the direction lifts the wings, the
  head, the tail and the beak and leaves feathers, eyes and talons to
  the reveal. The composer's spread-wing bird is a reasonable literal
  outline for once.

**Across the five:** the interpretation improves the authoring
DECISIONS in every case — what to spend a light on, what to leave to
the reveal, what to exaggerate — and improves the PICTURE in none,
because it does not draw. That is the correct division for V1 and the
reason the composer was left alone.

**Disclosed:** no model produced any of these. The environment cannot
reach a provider; the generated path is proved against a stubbed
endpoint (a valid interpretation, one smuggling points, one carrying
code, one carrying a private key, one with none, and a transport that
dies — each with the reference in use preserved). Whether a real model
writes direction of this quality, and whether it uses the permission to
refuse literal representation, is the product owner's to find with the
real connection.

### Proved by reverting

Section `ET` (55). Five load-bearing checks each proved by temporary
reversion, restored from a copy: the digit rule removed → `ET5`; the
geometry-key sweep removed → `ET5b`, `ET6b`, `ET23`; the reveal-only
exclusion removed → `ET10`; the idea folded into the subject line →
`ET8`, `ET22`; a refused interpretation refusing the whole blueprint →
`ET4f`, `ET5`. `AR3k` was widened by the one new top-level key with its
reason in place.

### Files

`tools/ether-mystery-lab/labBlueprint.js` (schema, validator, contract,
idea, ranking hook) · `labReference.js` (panel, comparison, trace,
idea field, constructed loader) · `labTranslationData.js` (new) ·
`shape.html`. Screenshots:
`tools/ether-mystery-lab-test/shots/translation/<creature>-{A,B,C,D}-….png`.

## THE RESEARCHER WORKFLOW — the Shape Lab cleanup (six stages, explicit resets, undo)

Lab only. **Zero production files changed**, the build stays 0769,
`arrangementNodesMax` stays 8, nothing was activated in the Ether. This
sprint added no creature intelligence and no capability: it took the
instrument every earlier creature experiment had bolted a panel onto and
made it read as one workflow.

### What was confusing

The page had grown by accretion. Budget, Tool, Create-from-creature,
Researcher metadata, the two panes, Play in Ether, Reveal, Approve and
Compare stood in the order they were built, so a researcher met the
point budget before the creature, the name after the reveal, and the
provider's connection fields on the same footing as the creature's own
name. Three things were destructive with no warning and no way back:
*Reset* (one word, everything), a click on a line in Join (deleted the
join — the only way to remove one, and nothing said so), and a budget
change under a bigger figure (kept the points but explained itself only
in the header). Nothing anywhere said what state the creature was in or
what to do next, and the technical vocabulary — candidate, interpreter,
provider, validator, schema, sanitizer — sat in the copy a researcher
read while deciding where a wing tip goes.

### The six stages

`shape.html` is now numbered down the page, in the brief's own order,
one sentence under each heading:

1. **CREATE** — the creature's name, *Generate reference*, an optional
   idea line, and **REFERENCE ON / OFF** as the primary control. The
   reference source (Fixture · LLM — Endpoint · LLM — Direct) is
   secondary, and every connection field (URL, token, key, model), the
   translation research set and the generation trace live in an
   *Advanced* disclosure that opens itself when an LLM source is chosen.
2. **SHAPE** — the point budget (8 · 10 · 12 · 16 · 18 · 20), suggested
   points ON/OFF, the three point tools (Add · Move · Delete), **Undo ·
   Redo · Reset points**.
3. **CONNECT** — the Connect tool (still joins in order on press, the
   product owner's rule), the Missing tool, *Connect in order*, a
   selection readout, and explicit **JOIN · UNJOIN · MARK MISSING ·
   Reset connections**.
4. **REVEAL** — PUZZLE = points + connections; REVEAL = the payoff. The
   feature rows, *+ Add feature*, the hold, **Reset reveal**.
5. **TEST** — **Unfinished · Complete · Come alive · Back to
   authoring**, a readout naming the state, the test canvas, and
   ▶ Play in Ether for the awakening and the roaming.
6. **APPROVE** — a summary (CREATURE · POINTS · CONNECTIONS · MISSING
   CONNECTIONS · REVEAL FEATURES · STATUS), the name, hint and notes,
   **✓ Approve creature**, Save fixture.

Under APPROVE stands **Reset everything**, which asks first — *Start
this creature again? All points, connections and reveal changes will be
removed.* — inline, never a browser dialog.

### The two panes, always in view — at one position

**AUTHOR** (left: the reference underneath, your points on top, a
missing connection dashed) and **JUDGE** (right: what a child meets —
no reference, no outline, a missing connection absent). On a laptop the
centre column holds nothing else and is `position: sticky`, so the
panes stay on screen while the steps scroll on either side. This was
found rather than designed: the first staged layout put the budget
buttons below the fold, and every canvas click in the suite that
followed a budget press landed on nothing, because scrolling the button
into view had scrolled the canvas out.

The second finding was subtler. A sticky pane that sits at one offset
when the page is scrolled and another when it is not is a pane a click
can miss by exactly that difference — and the header's height CHANGED
with the budget label, which wraps the header onto a second line at
some budgets and not others, so `AP4`'s click computed a moment before
a budget press landed 34 px off. Three things close it: the header and
the status strip are one sticky top bar, the centre's sticky top is
that bar's measured height (`--lab-top`, re-measured on every render
and by a `ResizeObserver`), and the budget label moved onto the status
strip — it is status — where it is ellipsised rather than wrapped, so
the top bar's height depends on nothing a researcher does. Measured:
the AUTHOR canvas is at the same viewport `y` at scroll 0, after a
budget press, after Reset everything and after scrolling to APPROVE.
On a phone (≤ 640 px) the panes stack, nothing sticks, the strip
wraps, and nothing scrolls sideways.

### The status strip

One line under the header, read from `ShapeLab.status()`:
`LION · 12 POINTS · 11 CONNECTED · 1 MISSING` · **BUILDING / READY TO
TEST / READY TO APPROVE / APPROVED** · a human next step. The state is
derived, never stored: BUILDING until the creature has points inside
its budget, at least one connection and one missing connection; READY
TO TEST until one of the three TEST states has been looked at; READY TO
APPROVE until approved; and any edit steps it back. The same status
fills the approval summary, so the strip and the summary cannot
disagree.

### Undo and Redo

A snapshot history in `labShape.js` — budget, points, roles, origins,
connections, missing marks and the reveal — bounded at 100 steps.
Every edit records one step: add, move (a drag is one step, not one per
pixel), delete (with the connections and reveal features that went with
the point), join, unjoin, connect-in-order, mark missing, every reveal
edit, and each scoped reset. **Previews record nothing**: UNFINISHED,
COMPLETE, COME ALIVE, ▶ Play in Ether and a selection leave the history
depth exactly where it was, which is measured (`WF19b`). The name,
hint, notes and judgement are labels, not edits, and are outside the
history. `Ctrl/⌘ Z`, `Shift Z` and `Ctrl Y` work outside a text field.
Reset everything and opening a fixture start a fresh history — a new
beginning is not an undoable edit.

### Resets, each named for what it resets

- **Reset points** — every point, and with them every connection and
  every reveal feature standing on one; then the suggested points are
  placed again as the starting figure if a reference is showing. One
  history step; the say line lists what went.
- **Reset connections** — every connection and missing mark; every
  point stays exactly where it is; the reveal stays.
- **Reset reveal** — every reveal feature and the hold; points and
  connections untouched.
- **Reset everything** — asks first; then points, connections, missing
  marks, reveal, name, hint, notes and judgement; the reference stays.

### JOIN / UNJOIN, and the selection

In Connect: click a point → *Selected: point 3*; click another → they
are connected (or, already connected, disconnected), and the pair stays
selected reading *connection 3–7 (connected)*. Click a line → that
connection is selected. The buttons answer the selection: JOIN wakes for
two unconnected points, UNJOIN and MARK MISSING for a connection,
and MARK MISSING reads *Restore connection* on a missing one. The
selected connection is drawn gold and thicker; selected points get a
gold ring. **A click on a line no longer deletes it** — `SL6` was
turned round with its reason in place. "Missing" keeps its one meaning:
a connection the child will make, dashed on AUTHOR, absent on JUDGE.

### The conflict audit

- *Budget change* — grows the starting figure (the suggested points at
  the new budget are placed) or, shrinking under a bigger figure, keeps
  every point and marks the figure as exceeding it; the status says how
  many to delete and that nothing is removed for you. One history step.
- *Regenerate reference / switch source* — places the new suggestions;
  a failed or refused reply leaves the reference in use (unchanged).
- *Reference ON/OFF* — changes the drawing only; the figure is
  byte-identical either way (`WF17`).
- *Move after joins* — connections and anchored reveal features follow.
- *Delete with joins* — the connections and reveal features on the
  point go with it; the say line names them; one Undo restores all.
- *Unjoin* — only the selected connection; its missing mark goes with
  it.
- *Reveal edit* — never touches a point or a connection; recorded.
- *Preview / TEST* — mutates nothing authored (`WF19b`).
- *Edit after approval* — clears the approval and the tested mark, and
  Undo of that edit does not silently re-approve (`WF22b`).
- *Opening a fixture over unsaved work* — refused once with the reason;
  a second press opens it (`WF28`). *Unsaved changes* is shown beside
  the fixture id whenever the figure differs from what is stored.
- *Loading a fixture* — starts a fresh history, clears the selection,
  and honours a stored approval only while the geometry still matches.

### What could NOT safely change

- The Connect tool still joins the points in order on press. That is
  the product owner's own rule (`AP11`) and the way every earlier
  suite draws a figure; the explicit *Connect in order* button sits
  beside it for a researcher who has switched tools.
- The pair-click gesture in Connect still connects AND disconnects
  (`AP4e`, `SL6`): making the second click select-only would have
  turned every "click one, click another" journey into three clicks.
- The `[data-budget-label]` wording (`TESTING N POINTS — Lab authoring /
  research budget · production currently supports 8` and `FIGURE
  EXCEEDS BUDGET (N lights)`) is pinned by earlier checks and kept.
- The reveal-feature rows keep their parameter names (offset, size,
  angle, strands, reach…) — those are the primitives' own knobs.
- The three source names (Fixture · LLM — Endpoint · LLM — Direct
  (dev)) are `LabConnection`'s own mode names and are pinned by `AR13`.

### Proved

Section `WF` (92): the statics (six stages in order, every control
present, the confirmation's exact words, no vague "Reset", the
technical words absent outside Advanced, every mutating path recording
and every preview not), the 31-step researcher journey driven on the
real page, the scoped resets each touching only their own thing, the
phone layout and the sticky laptop layout. Six load-bearing checks
proved by temporary reversion, restored from a copy: the confirmation
removed → the journey stalls at a confirm that never comes; a preview
recording history → `WF4c`, `WF19b`; an edit no longer clearing the
approval → `WF22`, `WF22b`; Undo not restoring → `WF10`; the sticky
centre removed → `WF30b` and eleven canvas clicks land on nothing; a
line click deleting again → `WF4c` and the journey.

`SL6` (line click) and `SL12` (reset asks first) were turned round with
their reasons written in place; a two-press `resetAll()` helper replaced
every direct press of `[data-reset]`.

### Files

`tools/ether-mystery-lab/shape.html` (rewritten as the six stages) ·
`labShape.js` (history, selection, scoped resets, status, workflow
rendering, language) · `labReference.js` (opens the Advanced
disclosure when an LLM source is chosen). Screenshots:
`tools/ether-mystery-lab-test/shots/workflow/`.

---

## PROMPT → ARTISTIC CREATURE → IMAGE UNDERSTANDING — proof V1 (the Shape Lab's front door)

Lab only, zero production files changed, build 0769, nothing activated
in the Ether. The Shape Lab's CREATE stage gains a new entry point in
front of the name → blueprint flow, which stays exactly as it was:
**say what should exist → look at what it could be → choose one →
(refine) → the chosen PICTURE is read by the model into a structured,
semantic description.** It stops there. Nothing in this sprint turns an
image into points, joins, missing joins or reveal geometry; the
analysis contract has no field for any of those and refuses them by
name.

### The headline, as measured

```
IMAGE GENERATION:    UNAVAILABLE — API access limitation
                     (gpt-image-1 answers model_not_found for this project;
                      every gpt-image-* model does; the newer image routes
                      require organisation verification)
IMAGE UNDERSTANDING: REAL
MODEL:               gpt-4.1-mini
```

Seventeen real pictures were read by the real model through the same
contract the Lab uses, and all seventeen replies passed the validator.
The results, beside a person's own description of each picture, are
committed: `tools/ether-mystery-lab-test/shots/imagine/real-understanding.md`
(and `.json`, the raw replies included). They were produced by
`tools/ether-mystery-lab-test/real-understanding.js`, which never runs
inside the suite — it costs money and needs the network — but whose
committed output the suite re-validates on every run (`IM16`).

### The researcher workflow

1. **CREATE — "What should exist?"** Type a creative prompt — *a
   smiling dragon with enormous wings* stays that sentence and is never
   reduced to a noun — and press **Create**.
2. **ARTISTIC SOURCE** is a visible two-way control — **Fixture —
   existing artwork · OpenAI image generation** — and the line under it
   says what each is. The fixture shows the whole gallery of existing
   pictures, ordered so the ones sharing a word with the prompt come
   first, every card tagged FIXTURE with its title; the status line
   reads *ARTISTIC SOURCE: Fixture — chosen by you, not generated*. The
   image-model provider, on a real connection, asks the image model for
   three interpretations; on this account it comes back **UNAVAILABLE**
   — from the transport's own `no-image-model`, never from a flag.
3. **YOUR IDEAS — choose one.** Click a picture to pick it out
   (double-click uses it at once), then **Use this creature**. **Try
   another interpretation** makes a new set from the same words;
   **Refine** keeps the words and adds a line ("make it friendlier and
   more playful, with a longer tail"), up to six times; **Bring back
   previous** / **Forward again** walk through every set made on this
   page. Nothing is ever thrown away, and the selection survives a new
   set.
4. **SELECTED CREATURE** — the chosen picture, large, badged SELECTED,
   with its title, label and credit — and the model reads it at once.
   **Read it again** re-reads; **Choose a different one** unselects.
5. **UNDERSTANDING** (right column) — subject · character · primary
   composition · body and masses · diagnostic features · modifiers ·
   proportion and emphasis · gesture and flow · what should survive the
   abstraction · do not draw literally · could be a reveal payoff ·
   against the prompt. Badged *IMAGE UNDERSTANDING (gpt-4.1-mini) ·
   endpoint · read from a fixture picture*, or *FIXTURE — a placeholder,
   no model looked at the picture* when the connection is Fixture. Raw
   JSON and the trace live under Advanced.
6. **Or bring a picture** — a PNG/JPEG/WebP of the researcher's own is
   used straight away, labelled UPLOADED.

The **connection** (Fixture · LLM — Endpoint · LLM — Direct) is the
existing `LabConnection` control, shared with the reference flow. It
now reads pictures as well: in Fixture the understanding is a
placeholder that says on its face that no model looked; on either LLM
mode the picture goes to the model.

### How OpenAI is connected — one transport, two new calls

`labConnection.js` gains `imagine({prompt, n, fixture})` → `{ok,
images:[{mime,b64}], model, source}` and `understand({messages, image,
fixture})` → `{ok, text, model, source}`, in all three modes: Fixture
answers with the caller's own producer and never touches the network;
Direct (dev-only, closure-held key) posts to `images/generations` and to
`chat/completions` with the picture attached as an `image_url` part on
the last user message (`detail: high`, structured output demanded);
Endpoint sends `action: imagine` / `action: understand` to
`supabase/functions/lab-generate`, which is now build **LAB2** and
carries both actions behind the same administrators-only gate, the
same `lab-generate` bucket and the same bounds (a picture is validated
by type and size before any call; a provider refusal is one word; the
one refusal that is a property of the ACCOUNT — the image model not
existing for the project — is relayed as `no-image-model`). The
provider's free-text error, which carries organisation and project
ids, never leaves either path. `sync-shared.js --check` stays green:
the generated gate block is untouched.

### The provider abstraction, and why UNAVAILABLE is not hard-coded

`LabImagine.PROVIDERS` is a table — `fixture` (kind fixture) and
`openai-image` (kind model) — and CREATE branches on `kind`, never on
an id. No provider carries an availability flag; the suite fails on
one. UNAVAILABLE is reached in exactly one way: the transport answers
`no-image-model`, which is what the provider's `model_not_found` (or an
image model name it says does not exist) becomes. The day the account
has an image model, the same button produces three labelled IMAGE
MODEL pictures with nothing in the Lab changed — `IM12b` drives that
path against a stubbed endpoint and `IM13` against a stubbed provider.

### The fixture is real artwork

`labArtworkData.js` names seventeen pictures: the product's own five
Companions (Lumo — a smiling dragon with enormous wings; Leo — a lion
with wings; Leafy, Quill and Nimbus — three invented beings), read from
`assets/` without copying, and twelve openly-licensed creature pictures
rasterized into `tools/ether-mystery-lab/artwork/` with their licence
texts: three mermaids, three elephants, a falcon and an eagle, a
centaur and three more dragons — Twemoji (CC BY 4.0), OpenMoji (CC
BY-SA 4.0) and game-icons.net (CC BY 3.0). Every entry carries
`visible`: a description written by a person looking at the picture,
which is the ground truth the real run is judged against and which is
NEVER sent to the model (`IM5e` checks every request the contract
builds against every ground-truth sentence). Ordering is word overlap
over the entries' tags — string overlap over data — and there is no
`subject === …`, no species branch and no creature word anywhere in
the front door's code (`IM2`, `IM2b`).

### The analysis contract (`LabImagine.SCHEMA`)

```
subject             string — what is depicted, in a few words
character           1–6 words/phrases — what the visual communicates
composition         1–2 sentences — the dominant visual organisation
architecture        1–8 phrases — the major masses and how they RELATE
diagnosticFeatures  1–10 names — what makes THIS concept recognisable
modifiers           0–8 phrases — the creative modifications actually visible
proportion          1–2 sentences — what is exaggerated, compressed, dominant
gesture             1–2 sentences — how the whole flows; ONE gesture or a
                    collection of parts (the contract asks this in as many words)
abstraction         { survives 1–8, doNotDrawLiterally 0–8, note? }
revealCandidates    0–8 names — a reveal-only payoff later; names, never geometry
promptFidelity      { agreement: matches|partly|differs, differences 0–6 }
```

Every value is words. The validator (`validateAnalysis`) is deny by
shape: an unknown key at any depth is refused by name; a geometry,
runtime, credential or private key (`points`, `joins`, `missing`,
`svg`, `x`, `path`, `pattern`, `constellation`, `stars`, `card`,
`email`, `memories`, `username`, `url`, `image`, `code`, `html`…)
refuses the whole analysis; a coordinate-shaped string, a pixel
measure, SVG, markup, a link, a data URI or code is refused as text; a
number where a word should be is refused; every missing required field
is named; an over-long sentence is cut at a word and RECORDED; an
unknown agreement becomes `unknown` and is recorded. What comes out is
a clean copy built field by field. A reply is text until proven an
analysis (fenced or wrapped JSON is read; prose is refused).

**The image is the source of truth.** The contract tells the model so
in its own instructions, hands it the creative prompt as context only,
and asks for `promptFidelity`. Measured: the serpentine Twemoji dragon
read against *a smiling dragon with enormous wings* came back
`differs — no wings visible`, and the sea-dragon silhouette read
against *a playful sea creature with butterfly wings* came back
`differs — no butterfly wings visible; creature appears more
dragon-like`. Nimbus read against *a sleepy cloud sprite carrying a
little moon* came back `partly — sprite is awake and smiling, not
sleepy; moon is a symbol on the body, not carried separately`, which is
exactly right.

### The real results, judged as compositions

The question is not whether the model names the creature. It is
whether it understands the picture as a composition — masses, where
parts attach, what the whole body is doing, what makes this particular
picture read as what it is.

**Strong (a designer could build from this alone):**

- **Leo, the winged lion** — "a large, rounded lion head with a full
  mane sits atop a sturdy, quadruped body / two large, colorful wings
  emerge symmetrically from the lion's shoulders / the tail curls upward
  and ends in a glowing lantern / the extended front paw reaches toward
  a butterfly"; gesture "one coherent gesture of reaching and
  curiosity, with the wings and extended paw directing attention forward
  and upward"; proportion "the wings are oversized… the head and mane
  are large and expressive relative to the body". Feline body, grounded
  gesture, mane/head relationship, wing placement and wing/body
  relationship, dominant proportions: all present.
- **Lumo, the smiling dragon** — "large membranous wings attached at the
  shoulders", "a compact, upright stance with wings spread wide on
  either side, creating a balanced horizontal extension", modifiers
  `smiling, oversized wings`, and "one coherent, confident gesture with
  an upright posture and wings creating a wide, open frame". Dragon
  identity AND the expression modifier, both kept.
- **The centaur** — "human torso seamlessly attached to the horse body
  at the waist", "the human upper body is proportionally smaller and
  simplified compared to the horse body, which dominates". The
  human/horse structural transition is named, not just the two halves.
- **The mermaid silhouette** — "a flowing, curved body forming an
  S-shape with a clear division between the upper humanoid torso and
  the lower fish tail, creating a smooth vertical gesture"; "one
  coherent flowing gesture… from head to tail". The continuous
  body-to-tail flow, not a list of head/torso/tail.
- **The falcon with the moon** — the crescent recognised as "a graphic
  element that complements the falcon but is not a literal part of the
  bird", the wings "broad and angular, dominating the composition", the
  gesture "a strong diagonal thrust". Two overlapping shapes, told apart.
- **Quill and Nimbus (invented)** — no anatomy forced: "ink-like fluid
  forms extending from head and cape edges", "lower body blends into a
  cloud base that curls around the feet", the pen "held upright in
  right hand", exaggerated head-to-body proportion named in both.

**Weak, and where the contract or the model fell short:**

- **Prompt bias on the subject and the modifiers.** The OpenMoji eagle
  (white head, yellow hooked beak) read against *a falcon* came back
  `subject: stylized falcon` with `matches` softened only to `partly`
  for style; the Twemoji elephant read against *a tiny elephant with
  huge ears* came back `tiny body` and `matches` although the picture
  is one bulky mass. The contract says the picture wins; on
  near-misses the model leans toward the prompt's own words.
- **An expression read wrong, and contradicted within one reply.** The
  Twemoji dragon frowns; the reply listed `smiling` among modifiers and
  `playful, friendly, cheerful` as character, while its own
  `promptFidelity` said "expression is more neutral than smiling".
  Two fields disagreeing in one answer is a contract gap: modifiers
  should be held to what is visible as strictly as fidelity is.
- **One placement error.** Leafy's face is on the pot; the reply put
  "two small plant-like eyes emerge from the soil among the leaves" —
  and then, correctly, "smiling face" in the features. A designer
  following the masses list would place the eyes in the wrong mass.
- **One wing missed.** The OpenMoji eagle raises two wings; the reply
  saw "a large wing".
- **Hedging on a clear thing.** The OpenMoji dragon's red flame was
  "tongue or flame", twice.
- **Architecture is sometimes a parts list.** On the simplest
  pictures (the emoji elephants) the masses are named but their
  relationships are thin; on the richer pictures the relationships are
  there. The contract asks for relationships; a dedicated field would
  make them mandatory.

**Does the same architecture handle real · hybrid · mythical · modified
· invented?** Yes, with the caveats above: real (three elephants, two
birds), hybrid (Leo, the centaur, three mermaids), mythical (four
dragons), modified (the smiling dragon, the tiny elephant, the fixture
mismatches), invented (Leafy, Quill, Nimbus) — one contract, no special
case, 17/17 valid.

**Is the output enough for a later Ether translation?** For the strong
cases, yes: `abstraction.survives` plus `gesture` plus `proportion` say
what to spend lights on, what to keep as a reveal, and what shape the
whole should read as. Three things the next contract should add, found
by this run: a **viewpoint** field (side / front / three-quarter — the
translation needs it and the model volunteers it inconsistently); an
explicit **relationships** list (part → attaches to → part), so the
masses cannot collapse into a list; and a rule that **modifiers name
only what is visible and must agree with `promptFidelity`**. None of
that is built here — this sprint stops at the handoff.

### Privacy and security, verified

- What leaves for a picture read is the fixed contract, the creative
  prompt (and its refinements), and the picture — `IM12e` pins the
  request to exactly `action, image, messages`, checks the messages
  for `card`, `stars`, `constellation`, `memor`, `username`,
  `creator`, `companion`, `email`, `session`, `token`, and checks every
  ground-truth sentence against it.
- What leaves for image generation is `action, n, prompt` (`IM12c`).
- The key stays in `LabConnection`'s closure: `IM13c` proves it reaches
  no storage, no cookie, no export and no message body; `IM12f` the
  same for the endpoint token, the picture and the analysis.
- No image and no analysis is stored anywhere: the front door has no
  storage call (`IM2c`), and loading the page writes nothing (`IM7`).
- The endpoint never echoes provider text (`IM6b`, `IM6f`, `IM6m`,
  `IM6o`).

### Production boundary

`js/`, `assets/`, `vihuplanet/`, `index.html` and `studio.html` are
untouched — `git diff --stat` against the branch base is empty for all
of them, the build stamps still read 0769, `arrangementNodesMax` is
still eight, and the Shape Lab still loads no file that mounts the
Ether. What changed outside the Lab is `supabase/functions/lab-generate`
(the Lab's own endpoint) and its runbook.

### Files

`tools/ether-mystery-lab/labImagine.js` · `labArtworkData.js` ·
`artwork/` · `labConnection.js` (imagine, understand) · `shape.html` ·
`supabase/functions/lab-generate/index.ts` (LAB2) ·
`supabase/DEPLOY_lab_generate.md` ·
`tools/ether-mystery-lab-test/run-lab-tests.js` section `IM` ·
`tools/ether-mystery-lab-test/real-understanding.js` ·
`tools/ether-mystery-lab-test/shots/imagine/`

## Image → Ether creature translation, proof V1

The step after the understanding. The Shape Lab's CREATE stage gains
one button under the selected picture — **Create Ether creature** —
and the answer is a complete Ether figure in the editor, labelled
GENERATED, with the picture it came from standing beside it. Lab
only; `js/`, `assets/`, `vihuplanet/`, `index.html` and `studio.html`
are untouched and the build stays 0769.

### The division of labour

**The model decides MEANING; the composer decides GEOMETRY.** That
line is the whole design, and it is enforced rather than hoped for.

- `LabTranslate.planMessages(analysis)` builds the plan request: one
  fixed contract, then the picture's own understanding as context;
  the transport attaches the picture. The contract asks for GESTURE
  FIRST — the dominant gesture of the whole figure and which masses
  lie along its main body line, rear to head — and then for every
  other mass by its RELATIONSHIP to one already standing: rises from
  the top of, extends from the back of, spans from, surrounds,
  supports from below, hangs from, attaches to, flows into, pairs
  with; which side; whether it is a pair. Plus proportion, what must
  survive, what to simplify, what is reveal-only, complexity and
  movement. Words only, in a controlled vocabulary.
- `LabTranslate.validatePlan(raw)` denies by shape: a geometry,
  runtime, credential or private key at any depth refuses the plan by
  name; a NUMBER anywhere — a value, or a decimal pair in a sentence —
  is a coordinate in disguise and is refused; SVG, markup, a link, a
  data URI and code are refused as text; an unknown key is refused.
  Vocabulary drift ("wing" for span, "huge" for large, "standing" for
  upright) is REPAIRED to the vocabulary and every repair is recorded.
  Structure a composer could only guess at — a flow of one, an id
  nobody declared, a mass related to itself, nothing to survive — is
  refused with its reason. A mass no relationship reaches is allowed
  and named; the composer hangs it off the largest flow mass and says
  so.
- `LabEtherComposer.compose(plan)` lays the SPINE of the gesture
  (upright · seated · grounded · reaching · flowing · coiled ·
  diagonal · spread · rearing · floating, bent by the curve, pointed
  by the facing), gives every flow mass a stretch of it by weight,
  puts a light at each end and at every transition, a width pair on
  the masses that dominate, and then attaches the rest by
  relationship through a small primitive vocabulary — flow · mass ·
  taper · span · branch · terminal · enclosure · transition ·
  attachment. Lights are allocated by priority: the spine's ends and
  transitions, then what must survive, then the dominant volume, then
  the diagnostic structures, then widths, then the secondary ones,
  with every refining light (a tail's mid, a wing's trailing corner)
  after every defining one. The budget FLOORS at the essentials and
  complexity sets the room beyond — a plan that says "simple" and
  names five things that must survive keeps all five. A candidate
  standing where one already stands IS that light. A join to a
  dropped light climbs to what that light hung from, so every figure
  is one piece by construction. The result is fitted to the sky and
  reported: components, crossings, what was dropped, what shares a
  light, and an allocation naming every light.
- No creature word, no branch on a subject, a label or a mass id, no
  `Math.random`. Renaming every mass in a plan moves not one light
  (`TR2e`); numbers smuggled onto a plan move not one light either
  (`TR6`).

### What a figure looks like on the page

SOURCE — the chosen picture, on the left · AUTHOR — the figure, with
the source faintly under it (SOURCE UNDER — ON/OFF; its own inert
canvas beneath the editor, never under JUDGE, never in a fixture) ·
JUDGE — the figure alone. The status strip carries GENERATED; one
edit makes it GENERATED · EDITED; undo gives GENERATED back; Reset
everything is AUTHORED again. The generated figure walks the existing
SHAPE → CONNECT → REVEAL → TEST → APPROVE path with nothing bolted on.
The plan is shown as words a person can argue with; the JSON, the
composition and the trace sit under Advanced.

### The real run, and the first round of generic fixes

`tools/ether-mystery-lab-test/real-translation.js` sends every
picture in the manifest — with the REAL understanding already
committed for it — through the same contract to gpt-4.1-mini (from
Node; the browser here cannot reach the provider), validates, composes,
and writes every raw reply, plan, repair, figure and diagnostic to
`shots/translate/real-translation.json`. `render-translation.js` draws
each one back into the real Shape Lab and screenshots SOURCE · AUTHOR
· JUDGE. **17/17 plans valid on the first attempt.**

The first composed round was rated, and then the composer was
corrected ONLY where the same defect showed on several creatures —
never per creature:

| defect, measured | seen on | fix |
|---|---|---|
| a symmetric span on BOTH sides gave ONE wing reaching back | Lumo, the eagle | a mirrored pair across the spine |
| every span reached up-and-back whatever its side | the falcon (both wings left) | a span honours its side |
| every branch was feet | Lumo's arms under its feet | a branch to a side is a limb |
| a child of a dropped parent was an island | the quill, the elephant (three pieces) | a join climbs to what the dropped light hung from |
| an attachment started at a circle inside a flow mass | horns lost into the head's top light; a crown on the same light | reach to the mass's real edge along the spine |
| a width pair outranked what must survive | the elephant's ear, tusk, legs, tail all dropped | survive over width; budget floored at the essentials |

`real-translation.js --recompose` re-runs the composer on the saved
plans without a request; `TR8c` requires the committed figures to be
what today's composer makes of the committed plans.

### The ratings

`shots/translate/ratings.json` — A unmistakable · B recognisable ·
C generic creature · D wrong, judged on the JUDGE pane first.

Round one: **A 0 · B 1 · C 13 · D 3.** Round two: **A 0 · B 3 · C 11
· D 3.** The centaur (a human torso and head on a four-legged body),
the emoji mermaid (a person shape ending in a forked tail) and Lumo (an
upright creature with two wings, horns and a tail) are recognisable.
The winged lion, the ink spirit and the spread-winged falcon are
tangles. Everything else is a generic creature.

The golden image the brief names — an uploaded baby dragon — is not in
the repository; Lumo stood in for it and for *a smiling dragon*.

### Where it fails, and whose failure it is

**LLM semantic.** FACING is wrong on four of seventeen (a picture
facing left called right — the trunk then hangs at the wrong end).
Surface details are listed as masses (eyes, a smile, a butterfly, a
crescent moon) and spend lights. "Simple" is chosen for creatures with
five must-survive features (fixed on the composer side by the floor).
One eagle was given one wing, not a pair. Everything else the model
said — the gesture kind, the flow order, the relationships — is almost
always what a person would say: `horse-body → human-torso →
human-head`; `tail → torso → head` on an S; wings on both sides,
symmetric; a mane that surrounds the head.

**Deterministic.** The composer draws the SAME KIND OF FIGURE for
everything: a spine, a diamond for every volume, a spike for every
attachment. A span is a triangle, so a wing has no outline; a taper
curls a fixed way, so a tail cannot coil; a mass is a diamond, so a
plant pot has no flat top and an elephant no bulk. Where several
attachments leave one short spine the joins cross (the winged lion,
the ink spirit, the falcon). Rendering is not a failure class here —
the Shape Lab draws what it is given.

### FINAL PRODUCT TEST — can an artistic image become an Ether
version that still feels like the same creature?

**NO — not yet.** It fails at ABSTRACTION in the composer, not at
understanding in the model. What a species lives in — the outline of
a wing, the curl of a tail, the width of an ear, the flatness of a
pot — is exactly what a spine-plus-attachment vocabulary cannot draw.
The next step is not a better prompt; it is silhouette primitives in
the composer: an outlined span (root, leading tip, trailing tip,
corner), a curling taper (a real arc, not a fixed bend), a wide flat
mass, and a way for attachments leaving one mass to take different
angles so they do not cross.

### Privacy, and what leaves

What leaves for a plan is `action, image, messages` — the same picture
the understanding was read from, the fixed contract, and the picture's
own understanding — checked for every private word (`card`, `stars`,
`constellation`, `memor`, `username`, `creator`, `companion`, `email`,
`session`, `token`) and every ground-truth sentence (`TR3d`, `TR12c`).
No plan, picture, token, contract or figure reaches storage or an
export (`TR12d`). Both new modules make no request of their own
(`TR1f`), write to no storage (`TR1e`), and name nothing that mounts
the Ether or reads the pool (`TR1d`). A refused reply — geometry, a
coordinate in a sentence, prose — and a dead transport each leave the
figure in use untouched, substitute no fixture, and hand the button
back (`TR12f`). With the Fixture connection the plan is a generic
stand-in that says so on every light and on the status line.

### Not built, deliberately

IMAGE → MISSING JOINS, MISSING JOINS → HINT, COMPLETION → AWAKENING.
The manual point budget stays; the automatic one is the composer's.
The old outline composer is not used by this path.

### Files

`tools/ether-mystery-lab/labTranslate.js` · `labEtherComposer.js` ·
`labShape.js` (loadGenerated, origin) · `shape.html` ·
`tools/ether-mystery-lab-test/run-lab-tests.js` section `TR` (88) ·
`tools/ether-mystery-lab-test/real-translation.js` ·
`tools/ether-mystery-lab-test/render-translation.js` ·
`tools/ether-mystery-lab-test/shots/translate/` (the real run, the
ratings, seventeen screenshots)

## Ether grammar V2 — close the loop (the open vocabulary, and the verdict)

**Lab only. Zero production files changed. Build stays 0769.**

The closure experiment: could the semantic-compiler route express arbitrary
beings once its vocabulary was allowed to grow? Three things kept apart in
`labVocabulary.js` — a SEMANTIC vocabulary (the composer's nine base terms,
with meanings), EXTENSION PROPOSALS (declarative data: name, meaning, why
needed, what it expresses, what it composes with, what it affects, examples,
and a CONSTRUCTION of one base term plus modifiers), and the compiler's
RENDERER CAPABILITIES (seven, closed, generic: outline · curl · flare · lobe ·
continuous · sweep · mirror). For each picture the model answers SUPPORTED ·
EXTENSION_REQUIRED · NOT_EXPRESSIBLE, proposes extensions, binds terms to the
plan's masses, offers reveal candidates (name · reason · importance · role ·
appearance · kind, classified SUPPORTED_REVEAL / REQUIRES_EXTENSION /
NOT_SUITABLE_FOR_REVEAL) and writes the leading hint. The compiler judges
every construction: a modifier it has no capability for is NOT EXPRESSIBLE by
name, never approximated. `labUnfinished.js` chooses the missing connections
by the creature experiments' own rules (only a relationship between parts,
never a stray light, a detached part preferred, wide, spread, few).
`labClosure.js` runs it on the page: the decision, the extension cards, a
Base / With extensions toggle that recomposes the same plan both ways, the
suggested reveals in step 4 (accept · reject), and *Choose the missing
connections* in step 3. The existing ▶ Play in Ether walks the loop at eight.

**The real run** (`real-closure.js`, `render-closure.js`,
`shots/closure/`): nine creatures — Lumo standing in for the absent baby
dragon, a second dragon, mermaid, falcon, lion with wings, centaur, elephant,
a CONSTRUCTED octopus (no picture exists in the repository), and Quill as the
invented creature. 9/9 decisions valid; 6 SUPPORTED, 3 EXTENSION_REQUIRED;
3 extensions proposed, 2 expressible (both compositions of capabilities the
compiler already had), 1 refused honestly (three capabilities it lacks). The
model bound capabilities directly on 7 of 9 and the extended figure differs
from the base one on all 7. **Every creature completed in the real Ether at
eight lights by real taps, came alive and roamed** (walks.json, 9/9).

**The verdict (ratings.json): open vocabulary does NOT solve the
bottleneck.** Base A0 B2 C4 D3 → extended A0 B2 C4 D3 — the compositions
changed and not one grade moved. The single structural limitation is the
compiler itself: it spends lights on the gesture skeleton and attaches parts
as small spikes and quads, so a species — which lives in the outline — is
never where the lights are. Reveal A/B: B3 C5 D1 — meaningful where a fill
turns a stick wing into a sail, weak where a contour's frame is a whole
figure at eight lights. Two contract faults were the Lab's and were
repaired on record (composing with a capability name was refused as
unknown; hints listed body parts). Not moved toward production; the product
owner's next brief tests the direct image → vision-model extraction instead.
Suite section `CL` (90).

## Image → Ether creature — end-to-end closure (the simplest bridge)

**Lab only. Zero production files changed. Build stays 0769.**

The product owner's instruction after the V2 verdict: stop building
compilers. *Let the image model create. Let the vision model understand. Let
Shape Lab correct. Let the existing Ether runtime make it alive.* So the
bridge is one contract and no geometry engine at all:

    creative prompt
      → gpt-image-2 (the Lab's own presentation instruction: one creature,
        full body, readable silhouette, no text, no interface)
      → gpt-4.1, WITH THE ACTUAL PICTURE, answering one JSON document
      → the Lab's validator
      → Shape Lab (the existing six-stage workflow: SOURCE · AUTHOR · JUDGE)
      → REVEAL stage: suggested reveals as ☐ rows, Accept / Reject / Edit
      → ▶ Play in Ether — the existing preview, js/etherMystery.js unmodified

**The contract** (`labExtract.js` → `extractMessages(budget)`): the model
returns `subject`, `points[{id, x, y, feature}]` in normalized picture
coordinates (0..1 — acceptable for a researcher tool, and the brief says so),
`connections[{a, b}]`, `missingConnections[{a, b, reason}]` chosen for meaning
and never at random, `revealFeatures[{name, reason, type
diagnostic|character|accent|magic, near[ids]}]`, a `hint` that names a nature
and never the answer, and `confidence{overall, identity, structure}`. The
budget the researcher chose travels in the contract (one or two gaps at
eight, two or three above); changing the budget reads the SAME picture again
at the new budget — never a new creature. Models are exactly `gpt-image-2`
and `gpt-4.1`, as defaults in `labConnection.js` and in `lab-generate`
(build `LAB3`, with a bounded `maxTokens` for an extraction's longer answer);
none of the retired image models is named anywhere on the path.

**The validator refuses by shape and repairs on record.** Too many points are
cut to the budget; a coordinate that is not a number or far off the picture
refuses the extraction, one just over the edge is clamped; a duplicate id is
dropped with the connections that named it; a connection to a point that does
not exist, a self-connection and a duplicate are dropped; a missing connection
the model forgot to list as a connection is added and left missing; one that
would strand a point is kept as a connection instead; when none of the model's
gaps can be left out the Lab chooses the widest safe ones and says so, so a
figure always has a mystery; at most three gaps and at least two connections
always remain; a reveal anchored to nothing is dropped and an unknown type
becomes `character`; an instruction or a digit in the hint refuses the HINT
alone and the figure loads with the honest fallback; markup in any string or
a private key at any depth refuses the whole extraction; prose is refused as
not JSON. Every repair is written on the record and shown in the extraction
panel, which is words a researcher can argue with — the points, why each gap,
the reveals, the confidence — labelled with the model that answered.

**Two things the suite found before a person did.** The points landed beside
the picture rather than on it: the editor's unit space and the source
underlay's box are not the same size, so `toEditor()` now maps picture
coordinates through the underlay's own half-extent and the picture's aspect
(the picture's centre at the editor's centre, its edge at the underlay's
edge). And the extraction landed as GENERATED · EDITED before anybody touched
it, because its gaps and hint were applied as edits after the load —
`ShapeLab.loadGenerated()` now takes a gap flag on a join and the hint, so an
extraction is ONE generated figure in ONE history step.

**The real run** (`real-extract.js`, `render-extract.js`, `shots/extract/`):
the brief's seven prompts verbatim — panda, mermaid, baby dragon, falcon, lion
with wings, giant whale, an imaginary fox-like creature — all *made of stars
in a night sky*. Every stage is REAL MODEL and labelled so; a failed stage
would say FAILED and substitute nothing.

- **Pictures: 7/7**, 23–70 s each, all single-subject, full-body, readable
  silhouettes on a night sky (rated A, all seven). Two environment facts,
  measured: the agent proxy closes a connection that is silent for thirty
  seconds, and an image takes longer than that to make — so generation uses
  `stream: true` and reads the completed event; and the proxy answers from
  two projects, one of which has no `gpt-4.1`, so a `model_not_found` is
  retried (12 of 14 extractions on the first attempt, the other two on the
  second) and every retry is on the record.
- **Extractions: 14/14 valid** at eight and at twelve, identity confidence
  0.97–0.99. 13 of 14 were repaired on record for the same thing — the model
  lists its missing connections SEPARATELY from its connections, so each was
  added as a connection and then left missing; one of its gaps would have
  stranded a point and was kept; the falcon's two gaps at eight are the
  Lab's own fallback. The suite re-validates every committed raw reply into
  exactly the committed extraction on every run.
- **The loop: 7/7** at eight lights in the real Ether — posed with the
  model's hint, each gap made by two real taps, every accepted reveal drawn
  once the figure is whole, then alive and roaming (47–88 px in the sample;
  `walks.json`).

**The ratings** (`ratings.json`, by looking): image A7 · recognition B5 C2 ·
unfinished B5 C2 · reveal B1 C6 · alive B7 · **overall B5 C2 D0**. Against
the V2 compiler run's A0 B2 C4 D3, no D anywhere: the extraction's lights sit
ON the creature — a seated panda with its ears, a mermaid with arms and a
forked tail, a whale wedge with a raised fluke, a fox with its tail up, a
spread bird — which is the thing no compiler managed. The two C's are the
baby dragon and the winged lion, where the species lives in a wing's outline
or a mane that eight lights cannot hold (the same ceiling the eight-point
study found by hand); both read at twelve. The reveal is the weak column:
BALEEN LINES on the whale is the one reveal that changes what the figure IS,
and every contour at its default frame size is a ring larger than the head —
a reveal-default problem the earlier sprints already recorded.

**Verdict: good enough to move forward.** Two things are named rather than
fixed here: the production budget of eight against creatures whose identity
is an outline, and the missing-connection half of the contract (state in the
prompt that a missing connection is ALSO a connection, or keep repairing on
record). Nothing reaches production: `js/etherMystery.js` performs what the
Lab hands it, and the Lab hands it nothing but the researcher's approval.

Section `EX` (55): the defaults and the retired models; no creature word and
no branch on a subject in the module; nothing stored, no request of its own,
no production module named; the contract's budget, coordinates, priority
order, reveals, hint and privacy; every malformed-output case above; the
committed run re-validated, walked and rated; the page journey against a
stubbed endpoint — GENERATED figure, the panel, the ☐ rows, what left
(action, picture, answer room, two messages), nothing in storage or export,
Accept/Reject, edit, budget re-read, and each refusal on screen with the
figure in use untouched and no fixture substituted; the real Ether loop; the
copy; the phone; zero page errors; and the production diff against the base
of this line of sprints (empty). `EX6` is the check that caught the
edited-on-load defect.

Files: `tools/ether-mystery-lab/labExtract.js` · `labConnection.js` ·
`labShape.js` (`loadGenerated` gaps + hint) · `shape.html` ·
`supabase/functions/lab-generate/index.ts` (`LAB3`) ·
`tools/ether-mystery-lab-test/real-extract.js` · `render-extract.js` ·
`shots/extract/` (source pictures, author/judge canvases, the sky as JPEG,
`real-extract.json`, `walks.json`, `ratings.json`).

## Two models, two fields (a diagnosed 500, and the guard that names it)

**Lab only. Zero production files changed. Build stays 0769.**

Reported by the product owner from the first live run of the image
pipeline: gpt-image-2 drew the picture, the picture appeared in SOURCE,
and both the understanding and the extraction failed with *"provider
answered 500 (server_error)"*. Traced without touching anything, then
reproduced from Node: the request that failed carried `model:
"gpt-image-2"` on `/chat/completions`. The Direct panel had ONE field,
labelled *Model*, and it fed `setDirectModel()` — the CHAT model — while
the image model had no field at all; so the natural thing to type when
choosing an image source (the image model's name) rerouted every
understanding call to a picture model, and the provider answers that
with a bare 500 and *"The server had an error while processing your
request"* rather than a 400 that names the fault. Reproduced 2/2 with
that one change; 7/7 fine with gpt-4.1. The field also advertised
`gpt-4.1-mini` while the transport sent `gpt-4.1`, a model this project
cannot use anyway.

**What changed.** The Direct panel on both Lab pages now has two fields —
*Understanding model (reads pictures, writes plans — a chat model)*, and
*Image model (draws pictures)* — each wired to its own setter and both
**seeded from the transport on load** (`LabConnection.models()`), so the
page can never show a model the transport is not using. Each Direct path
refuses a name that plainly belongs to the other before anything leaves
the browser: an image model (`gpt-image-*`, `dall-e*`) in the
understanding slot is refused by `understand()` and `generate()`, a chat
model in the image slot by `imagine()`, and `LabConnection.explain()`
turns the two reasons into a sentence that names the field to fix.
Every surface — the front door, the extraction, the blueprint — reports
that sentence in place of the provider's 500. The Endpoint path needs
nothing: `LAB_MODEL` and `LAB_IMAGE_MODEL` were already two values.

Section `MM` (12): both fields present and no `gpt-4.1-mini` default,
the transport's two models and their defaults, the two refusals in Node,
seeding measured against the live transport, the product owner's own
mistake driven on the real page (zero chat requests leave, the sentence
names the field, *Read it again* after correcting sends the same picture
with gpt-4.1), each field feeding only its own path measured on the
requests, and the mirror mistake. Proved by reverting the understand
guard: `MM3` red and `MM5` stalls because the picture DID reach the chat
path.

## Trace the image, don't invent a skeleton (the extraction contract, rewritten)

The product owner's own acceptance test failed on a boat: the unfinished
figure created no wish to complete it, the completed figure did not look
like the source, and Come Alive did not feel alive. This sprint fixes the
EXTRACTION and nothing else — not Reveal, not roaming, not the Shape Lab's
six stages, not the runtime, not the pool. Lab only; production diff zero.

### Why the previous extraction failed

The first extraction contract asked for *"a simplified interpretation, not
a tracing"* and told the model to prioritise points by ANATOMY — *the
overall silhouette · the major gesture · the important transitions (neck,
hips, shoulder) · diagnostic features · meaningful terminals* — with one
feature word per point. Measured on the boat (`shots/extract/boat/
before.json`, the same picture read by that contract): six lights named
*mast top · left prow curl · hull bottom · right prow curl · mast base ·
sail tip*, joined as a triangle on a diamond — a sailboat GLYPH with its
"mast base" in the middle of the sail and its "hull bottom" inside the
hull, not at the keel. At twelve it came back in two pieces. The model had
reasoned *boat = hull + mast + sail* from the subject's name and placed
lights where those parts ought to be. That is a skeleton, and a skeleton
of a generic boat looks like nothing in particular when the picture is
hidden.

### What changed

`labExtract.js`'s contract now OPENS with the brief's critical instruction
verbatim — *You are extracting a simplified visual tracing of the supplied
image. Do not construct a generic anatomical skeleton from the subject's
name…* — and everything after it is written from that: the source image
is the visual truth; the budget is a SAMPLING budget over the visible
shape (eight: the strongest silhouette points; twelve: the major contour
structure; sixteen and above: secondary structure), never a list of parts
to fit in; a point carries one of four PICTURE roles — `silhouette ·
junction · internal · terminal` — and no anatomical name is required for
any point; connections are VISIBLE relationships only, a line drawing of
this picture and not a single outline around it, one connected piece, no
invented geometry; and a missing connection is **an existing visual
connection that we choose to withhold** — never a line that is not in the
complete figure. Reveal is optional and secondary and may be empty; no
confidence is asked for.

The validator changed in three places, each on record. A point with no
role, or a body part where a role should be, is read as `silhouette` and
noted — never refused for a word. A missing connection that is not among
the connections is **dropped**, where the first contract ADDED it as a
connection and then left it missing — which let the model invent a line
through the back door; the Lab's fallback (withhold the widest safe
existing join) still guarantees a gap. And the figure's number of pieces
is counted and written down; a figure in several pieces is never stitched
(that would invent a line) — the researcher joins them where the picture
shows them meeting.

The contract took three wordings, and all three are committed because
each was measured. **v1** (`real-extract.trace-v1.json`, the boat's
`trace-v1-*` figures): the lights landed on the picture, and the joins
were wrong — six of sixteen figures in more than one piece, eight-light
outlines drawn as blobs with nothing inside, the boat's eight spent on the
stays (ropes). **v2** (`-v2`): *a line drawing, not an outline; one piece;
a thin line never earns a point before the masses* — 16/16 one piece, but
the model under-spent the budget (seven lights at twelve) and still traced
ropes. **v3**, shipped: *exactly N, or as close as the shape allows; a thin
line is not structure — no point on it, no line along it; a withheld pair
must also appear in connections* — 15/16 at the full budget, 16/16 one
piece, invented gaps down from 9/16 to 2/16.

### The boat, before and after

| | before (anatomical) | after (tracing v3) |
|---|---|---|
| eight lights | a triangle sail on a diamond hull; a glyph — **B** | prows, keel, mast base, mast top, yard, flag: a mast with a crossbar on a hull — **B** |
| twelve lights | TWO pieces, sail-and-deck above a hull V — **C** | ten lights: the hull's whole curve, the deck, the mast, the sail's triangle, the flag — **A** |
| unfinished | the hull's top line missing — **C** | the sail's foot and forestay withheld: the sail hangs unattached until joined — **A** at twelve, **B** at eight |

### The seven creatures (`ratings.json`)

| | image | complete @8 | unfinished @8 | complete @12 |
|---|---|---|---|---|
| panda | A | B | B | B |
| mermaid | A | B | C | B |
| baby dragon | A | C | C | B |
| falcon | A | B | B | B |
| winged lion | A | C | C | C |
| whale | A | B | B | B |
| star fox | A | B | B | B |

COMPLETE at eight: A0 B6 C2 over the boat and the seven — the SAME five
creatures at B and the SAME two at C as the anatomical run, for the same
reason: eight lights cannot hold a wing's outline and a body, and a
tracing's eight go to the strongest silhouette, which for a winged
creature is its wings. What moved is where the lights are and what happens
above eight: at twelve the boat is A and the dragon B, where the
anatomical boat at twelve was two pieces. UNFINISHED at eight: B5 C3 —
where the MODEL chose the gap it is visible (the sail's foot, the whale's
back, the fox's tail); where the Lab had to choose (the mermaid's figure is
a tree, so any withheld line strands a limb rather than opening a hole) or
the figure is a bare outline (dragon, lion) the gap is not a mystery.

### Judged, and stopped

The boat is recognisable; the creatures are where they were at eight and
better at twelve. Per the brief, no further contract change, no Reveal
work, no roaming work and no architecture proposal. The thing that would
move the eight-light grade is the production budget question, which is a
product decision and not this sprint's.

**Harness note.** `render-extract.js` measures roaming from the moment
the wanderer sets off rather than from a fixed wall-clock offset: a
background popup's frame clock runs slow under load, so the 4.4 s hold
after completion outlasted the renderer's waits and sixteen fixed samples
measured the hold (1–7 px) instead of the roam. It now waits for the
wanderer, then samples until it has plainly travelled or a bound passes.

Suite: section `EX` — `EX2b`–`EX2b4`, `EX2c` pin the contract; `EX3a`,
`EX3a2` the roles and the optional reveal; `EX3h`, `EX3h2` turned round
(an unlisted gap is dropped, never added); `EX4`–`EX4g` the eight-result
run, the boat before beside the after, every point roled, no gap ever
added; `EX6`, `EX6b` the roles landing in the Shape Lab.
