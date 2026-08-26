# The Mind Package

What a future Companion Mind would be handed, assembled from the two
files that hold it, and printed so a person can read it before anything
is connected to a model.

```
node tools/companion-mind-preview/build-mind-package.js          # JSON
node tools/companion-mind-preview/build-mind-package.js --text   # readable
node tools/companion-mind-preview/build-mind-package.js --write  # regenerate the committed preview
node tools/companion-mind-preview/build-mind-package.js --check  # has it drifted?
node tools/companion-mind-preview/build-mind-package.js --companion=leafy
```

`leafy.mind.json` and `leafy.mind.txt` are committed so the package is
reviewable in a pull request without anybody running anything. They are
generated, never hand-edited — `--check` is what keeps them honest, and
the suite runs it.

## What is in it, and what is not

```
{ canon, personality }
```

The full shape a Companion Mind will one day consume is
`{ canon, personality, memories, currentContext, conversation }`. The
last three are absent, and this program has no way to produce them: it
reads two files off disk and stops. There is no memory here, no Creator,
no story and no conversation — **not filtered out, but unreachable**,
which is a stronger property than a filter and is why "makes no external
network call" can be proved rather than promised. The suite proves it by
running this program with `fetch`, `XMLHttpRequest`, `WebSocket` and
every socket module deleted, and watching it build the package anyway.

## The two halves

| | Answers | Lives in |
|---|---|---|
| **Canon** | *What is a Companion?* | `assets/canon/vihuplanet.canon.json` |
| **Personality** | *How does this one behave?* | `assets/<id>/personality.json` |

They are loaded independently and neither is merged into the other. A
personality never restates the canon; the canon never describes a
particular Companion. Keeping them as two values rather than one
flattened object is what keeps that true by construction.

## A note on `personality.json`

Four keys in a personality file are **acted on by the running Studio**
today — `greetings`, `neverSays`, `play` and `lines`. Leafy's file
deliberately carries none of them, so the file is a specification of who
Leafy is rather than a change to what Leafy does. Wiring any of them is a
separate, deliberate decision.
