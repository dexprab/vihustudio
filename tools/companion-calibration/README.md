# Companion Calibration

Sprint 1H. A reusable corpus and a harness for asking one question:
**does Leafy actually feel like Leafy?**

```
node tools/companion-calibration/run-calibration.js            # print the report
node tools/companion-calibration/run-calibration.js --write    # regenerate CALIBRATION.md
node tools/companion-calibration/run-calibration.js --provider=openai --repeats=10
```

`CALIBRATION.md` is committed so the numbers are reviewable in a pull
request without running anything.

## Two halves, and one of them needs a key

**The validator half** is deterministic: which turns become memories,
how many, whether repetition collapses to one, whether ordinary chat
stays quiet. That is Sprint 1G's policy, and it can be calibrated with
no model at all. It runs, and the committed report holds its numbers.

**The model half** is Leafy's voice: tone, length, silence, curiosity,
hallucination resistance, consistency across repeats. That needs the
real provider. With no `OPENAI_API_KEY`, or with `api.openai.com`
unreachable, the harness says so and skips it rather than inventing an
answer. Re-run with `--provider=openai` to fill it in; nothing else
about the harness changes.

## Synthetic only

Both production gates stay closed, so the endpoint builds from its own
fixtures and there is no real Creator data anywhere in this program to
send anywhere. The Creator, card, Companion, story, page, memory and
conversation are all invented.

## The corpus

`corpus.js` — 73 prompts across fifteen categories (greeting, story
creation and continuation, world and Companion questions, memory,
explicit memory requests, ordinary chat, emotional boundary, secrecy,
outside-world knowledge, prompt injection, Creator-work evaluation,
ambiguity, silence), plus five sessions of fifteen turns.

Each prompt carries a **tendency** — what a Companion should lean
toward — and a **bond expectation** — what the validator should do.
The tendency is deliberately not an expected answer and must never be
turned into one: this is behavioural evaluation, and a Companion that
gave the same words every time would have failed a different way. The
bond expectation *is* checkable without a model, and four prompts are
marked `maybe` because their meaningfulness is genuinely ambiguous;
those are excluded from the agreement count rather than guessed at.

## What the sessions measure

Not how many memories come out. Whether the ones that do are genuinely
distinct meaningful moments — which is why S2 offers fifteen proposals
about the same forest and should produce exactly one.
