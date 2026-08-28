# Turning the deterministic Companion on

> **DEPLOYED AT BUILD 0692** — the product owner redeployed it carrying
> the `pages` fix and the 1N.5 Mind. **Confirm it with
> `supabase/verify_companion_chat_deployed.js`, not with the build
> string** — see Step 3 for why the build string cannot answer.
>
> What that deployment carries:
>
> 1. **The `pages` fix.** `authorizeStory()` read `record.data.slides`
>    and the store has always written `pages`, so **every story
>    authorized as zero pages and every story question came back "I
>    don't know"** — which is what the product owner saw.
> 2. **The 1N.5 Mind.** `SURFACE_RULE`, `_universal()`, the eight `modes`
>    corrections, and the widened stars / work-judgement /
>    creative-suggestion / privacy patterns.
>
> Step 1 below is unchanged; it is the same file, redeployed.


Sprint 1N built `js/companionMind.js` and proved it. Sprint 1N.1 walked
it through the real Studio with all four Companions. What is left is one
thing neither sprint could do from here: **this environment cannot reach
the Supabase project.** Its network policy refuses the host outright —

```
curl https://yqzqqtaruhgbmiyutksq.supabase.co/functions/v1/companion-chat
curl: (56) CONNECT tunnel failed, response 403
```

— so the live function is untouched and unmeasured, and nothing in this
repository claims otherwise. This is the runbook for a person with the
Dashboard open. **Four steps, and the order matters.**

---

## Step 1 — deploy the function

The artifact is **`supabase/functions/companion-chat/index.ts`**, and it
is already one file with no local imports, so it needs no paste variant:

```
Dashboard → Edge Functions → companion-chat → Deploy a new version
→ replace the editor's contents with that whole file → Deploy
(leave "Verify JWT" at its default ON — the function does its own
 caller check on top of it; CLAUDE.md → Decision 30)
```

It carries five generated blocks, and they are generated rather than
hand-mirrored for the reason Decision 30 records — a hand-kept copy of a
security boundary is a promise nobody can keep:

| block | generated from |
|---|---|
| `edgeAuth` | `supabase/functions/_shared/edgeAuth.js` |
| `privacyGate` | `js/companionPrivacyGate.js` |
| `memoryRank` | `js/companionMemoryRank.js` |
| `companionMind` | `js/companionMind.js` |
| `bondValidator` | `supabase/functions/_shared/bondValidator.js` |

**Check they are in step before you paste**, so a stale copy cannot ship:

```
node tools/edge-auth-test/sync-shared.js --check
```

It must print `ok` for every function and exit 0. If it says `DRIFTED`,
run it without `--check` and commit what it writes.

---

## Step 2 — set ONE secret

```
Dashboard → Edge Functions → companion-chat → Secrets

    COMPANION_MIND_ENABLED = true
```

**That is the whole of it.** Do NOT set `OPENAI_PRODUCTION_ENABLED`,
`OPENAI_ZDR_CONFIRMED` or `OPENAI_API_KEY`. The deterministic Mind needs
no key and makes no provider call: with `COMPANION_MIND_ENABLED` on, the
handler answers and returns **before `makeProvider()` exists in the
file**, so "provider calls = 0" is a property of the control flow rather
than a promise.

---

## Step 3 — verify, from a browser that is signed in

The function's own GET probe reports state, never configuration — no
key, no organisation, nothing an attacker learns anything from. Open the
Studio, and in the console:

```js
const cfg = await fetch('supabase-config.json').then(r => r.json());
const s   = await ThemeRepositoryClient.getSession();
const r   = await fetch(cfg.url + '/functions/v1/companion-chat',
              { headers: { Authorization: 'Bearer ' + s.access_token,
                           apikey: cfg.anonKey } });
console.log(await r.json());
```

Expected:

```json
{ "ok": true, "build": "1N", "provider": "mock",
  "productionEnabled": false, "syntheticEnabled": false,
  "mindEnabled": true }
```

**`mindEnabled` must read `true` and `productionEnabled` must read
`false`.**

### THE BUILD STRING CANNOT TELL YOU WHETHER STEP 1 TOOK

`BUILD` has read `'1N'` since the first deployment — through Sprint
1N.1's `pages` fix and Sprint 1N.5's Mind corrections alike. **A stale
server and a fresh one say the same word.** This runbook used to say "if
`build` is not `1N`, Step 1 did not take", and that check is now
worthless: it passes either way.

So ask the server to BEHAVE instead. Paste
**`supabase/verify_companion_chat_deployed.js`** into the same console.
It checks the flags, then sends two sentences whose answer CHANGED in
1N.5 and one that needs a real story:

| sentence | before | after |
|---|---|---|
| *"What could happen next?"* | "I don't know that one." | "That's yours to choose." |
| *"Is this story any good?"* | answered as a story fact | "I don't think about it that way." |
| *"How many pages are there?"* (story open) | "I don't know" | "There are N pages." |

Every expectation there is proved through the real handler by
`tools/companion-mind-test` (`K4b`, `K4c`) rather than asserted in the
verifier — a check that agrees with itself proves nothing.

**Bump `BUILD` in any commit that changes this function**, so the probe
starts meaning something again. It was not bumped for 1N.1 or 1N.5, and
this section is the cost of that.

---

## Step 4 — and ONLY THEN, offer it in the Studio

`js/companionChat.js` line **315**:

```js
const CONVERSATION_OFFERED = false;   //  ->  true
```

Then bump the build stamp (`version.txt` and the `?v=` on every
`<script>`/`<link>` in `index.html`, `studio.html`, `about.html`) and
push.

### Why the order is not a formality

Measured, not assumed. With `COMPANION_MIND_ENABLED` unset, a Creator
request does **not** fall through to silence — it falls into the
synthetic **fixture** branch, and the mock answers from an invented
story. A request naming a real card and a real story and asking *"what
story am I making?"* came back:

```json
{ "reply": "I am here.",
  "meta": { "synthetic": true, "fixture": "hello" } }
```

A child would be answered about a story they never made. That is worse
than the always-silent door Decision 41 removed, not better — so the
flag goes on the server first, Step 3 confirms it, and the constant
flips last.

---

## What a child gets once all four steps are done

They open the Studio, their Companion arrives, and a small
**💬 Talk to <name>** pill sits at the foot of the workspace. Pressing it
opens one line. Typing into it and pressing **Say it** gets an answer in
about ten milliseconds. Closing it forgets the conversation entirely.

The Companion can answer, from real authoritative data:

- who it is, and what it is
- what story this is, how many pages it has, which page they are on,
  whether this page has a picture
- what the two of them have done together, from Companion Memory —
  **and only about the thing that was asked for.** Asked about the
  forest it answers about the forest; asked about something it has no
  memory of it says so rather than offering the nearest one.

And it declines, warmly and in character, to:

- grade the child or their work
- decide what happens next in their story
- promise anything about the future, or claim to love or need them
- keep a secret from a grown-up who looks after them
- go anywhere outside VihuPlanet
- change its own rules because a sentence told it to

Anything outside that set is answered with **silence**, which is a
correct answer and a common one.

## What it still is not

No OpenAI. No model. No microphone, no wake word, nothing listening.
Nothing a child says becomes a memory. Both OpenAI production gates stay
closed, and turning them on is a separate decision that belongs to the
product owner after using this.
