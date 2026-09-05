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
| 1 | **A sky figure cannot be expressed at all.** `directives.skyFigures` reaches the model as an ingredient, and `SCHEMA.top` / `SCHEMA.ingredients` have NO field for one. A candidate can only ever be about a `creation` or an `anchor`. | prompt ↔ schema | **critical** — and it is the constellations preset's own subject |
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
