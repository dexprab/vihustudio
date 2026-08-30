# Step 3A — putting a real Mind behind Leo

> **PRODUCTION IS CLOSED AND THIS RUNBOOK DOES NOT OPEN IT.**
> Every step below is reversible, and the last one is a decision rather
> than a command.

## What this session could NOT do, and why

This environment cannot reach OpenAI. Measured, not assumed:

```
curl https://api.openai.com/v1/models
curl: (56) CONNECT tunnel failed, response 403
```

and there is no `OPENAI_API_KEY` here. So four things the brief asks for
are **yours to run**, not mine to report:

| § | what | why it needs you |
|---|---|---|
| §5 | inspect the models the account actually has | needs the key |
| §6 | the controlled first call | needs the key |
| §42/§43 | the real Studio and Ether journeys | needs the key |
| §44 | text → voice latency with a real model | needs the key |

Everything else — the routing, the gating, the fallback, the character,
and every privacy boundary — is built and measured here, and the
commands below are the exact ones that close the gap.

---

## Step 0 — where am I?

Paste **`supabase/verify_step3a_state.js`** into the Studio console
(signed in). One GET, read-only, and it prints exactly what is still
missing. Run it again after every change below.

`BUILD` is **`'3A.1'`**. If the probe reports anything else, the
function on the server is not this code and nothing below has taken
effect yet.

**`'3A'` is a real build and it does not work.** It carries the whole of
the routing — it reports `modelCompanions` exactly like a fixed one — and
its controlled first call is answered by the deterministic Mind, because
the fixture's Companion was overwritten before the model gate read its
id. It looks like a healthy deployment from every angle except the
answer. If you deployed before build `3A.1`, redeploy.

---

## Step 1 — choose the model (§5)

`MODEL_DEFAULTS.name` is `gpt-4.1-mini` and has been since Sprint 1E.
**Do not take that on trust** — Decision 34 already records why (
*"verify the model name against the account's own model list before
enabling production — `voice-speak` learned that the hard way, where a
wrong id, an unavailable model and wrong settings all present
identically"*).

From a machine that has the key:

```
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
| python3 -c "import sys,json;[print(m['id']) for m in sorted(json.load(sys.stdin)['data'],key=lambda x:x['id'])]"
```

What to look for, against §5's own criteria (child-safe conversation,
low latency, good reasoning, natural dialogue, reasonable cost):

- a **small, fast chat model** — Leo says one or two short sentences and
  a child is waiting; reasoning-heavy models buy nothing here and cost
  latency the 1N.6 rhythm will have to show as `thinking`.
- it must support **`response_format: { type: 'json_schema', strict: true }`**,
  which is what makes the reply a contract rather than a paragraph.

**A COMPATIBILITY TRAP WORTH KNOWING BEFORE YOU PICK.** The request
sends `temperature` and `max_tokens`. Some newer OpenAI families reject
both — they want `max_completion_tokens` and refuse a non-default
temperature. If the model you choose is one of those, the call fails
with a 400 and the child sees the deterministic fallback, which looks
like nothing happened. Prefer a model that takes the classic chat
parameters, or tell me and I will make them adaptive.

Set it without touching code:

```
Dashboard → Edge Functions → companion-chat → Secrets
    COMPANION_MODEL = <the id you chose>
```

---

## Step 2 — deploy the function

The artifact is `supabase/functions/companion-chat/index.ts`, one file,
no local imports. Check the six generated blocks are in step first:

```
node tools/edge-auth-test/sync-shared.js --check
```

`edgeAuth` · `privacyGate` · `memoryRank` · `companionMind` ·
`bondValidator` · **`companionCharacters`** (new — Decision 44's four
personality files, projected).

---

## Step 3 — the controlled first call (§6), still with production CLOSED

Set the key and let synthetic traffic reach the provider. **This is the
only mode in which the model sees anything, and what it sees is
invented**: "The Dragon and the Forest" is not a real Story, the card is
a fixture, there is no Creator and no memory.

```
    OPENAI_API_KEY              = <your key>
    COMPANION_MODEL_PROVIDER    = openai
    COMPANION_SYNTHETIC_ENABLED = true
    COMPANION_MODEL_COMPANIONS  = leosaurus
```

Leave `OPENAI_PRODUCTION_ENABLED` and `OPENAI_ZDR_CONFIRMED` **unset**.

Then, from the Studio console (signed in):

```js
const cfg = await fetch('supabase-config.json').then(r => r.json());
const s   = await ThemeRepositoryClient.getSession();
const r   = await fetch(cfg.url + '/functions/v1/companion-chat', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + s.access_token, apikey: cfg.anonKey,
             'Content-Type': 'application/json' },
  body: JSON.stringify({ fixture: 'first-call' }),
}).then(r => r.json());
console.log(r);
```

**What a pass looks like.** `ok: true`, and a `reply` that answers
*"Where are we?"* from the page — the forest — in one or two short
sentences, sounding like Leo rather than like a chatbot. `meta.synthetic`
is `true` and `meta.modelFellBack` is absent.

**What a fail looks like, and what each means:**

| what you see | what it is |
|---|---|
| `meta.modelFellBack: true` | the model was tried and failed; the deterministic Leo answered instead. Check the model id and Step 1's parameter trap. |
| `reason: 'not-configured'` | the key is not set on the function. |
| a reply about a *fox* and a *Tiny Forest* | you got a different fixture — check `fixture: 'first-call'` is really in the body. |

---

## Step 4 — Leo, for real (§42)

Only after Step 3 reads right:

```
    OPENAI_PRODUCTION_ENABLED = true
    OPENAI_ZDR_CONFIRMED      = true
    COMPANION_SYNTHETIC_ENABLED = (unset)
```

`OPENAI_ZDR_CONFIRMED` is **you asserting**, for this organisation and
this model, that Zero Data Retention is in force. *"API data isn't used
for training by default"* is not ZDR — Decision 34 records that they are
different properties of an account and only one of them is a default.
Nothing in this repository can check it for you.

Then walk §42 in the real Studio with a card bonded to Leo:

> Where are we? · I'm making a dragon. · It's red. · It can fly. · What
> do you think it should do? · I don't like that. · What else could it
> do? · My name is Vihaan. · What's my name? · Can I give you a name? ·
> I'm calling you Spark. · What's your name?

Watching for: does he follow the thread, does he stay Leo, does he say
"I don't know" rather than inventing, does the 1N.6 rhythm read right,
and does he sound like Leo through his own ElevenLabs voice.

**To stop, at any point:** clear `COMPANION_MODEL_COMPANIONS`. Every
child is back on the deterministic Mind on the next request, with no
deploy and no code change.

---

## What is deliberately NOT in this sprint

- **The other three Companions.** §46. Leafy, Quill and Nimbus keep the
  deterministic Mind and are the control group. Adding one later is one
  environment variable.
- **The Ether.** §10 and §43 ask for the same model there, and it is not
  built. `js/travellerTalk.js` makes no server call at all — a Traveller
  conversation is entirely client-side — so giving the Ether a real Mind
  means a NEW authenticated-but-cardless path into a metered function,
  with its own rate limit, its own public-context construction and its
  own verification. Building a second unverifiable path in a session
  that cannot reach the model would double the risk with nothing able to
  check it. **This is a stated limitation, not a defect**, and the
  Ether's deterministic conversation is unchanged.

---

## Step 5 — the other three, and the Ether (Step 3C/3D)

Step 3C proves ONE implementation serves all four Companions on both
surfaces. It does **not** turn any of them on: the gate is unchanged and
is still `COMPANION_MODEL_COMPANIONS`.

**The staged rollout, and it is yours to walk:**

```
    COMPANION_MODEL_COMPANIONS = leosaurus                     ← where you are
    COMPANION_MODEL_COMPANIONS = leosaurus,leafy
    COMPANION_MODEL_COMPANIONS = leosaurus,leafy,quill
    COMPANION_MODEL_COMPANIONS = leosaurus,leafy,quill,nimbus
```

Each step is one environment variable and no deploy. **To stop, at any
point, remove a name** — that Companion is back on the deterministic
Mind on the next request.

**The Ether needs nothing extra.** It uses the same gate and the same
list: a shared Story hosted by a listed Companion gets a real Mind, and
one hosted by an unlisted Companion keeps the deterministic host. There
is no separate Ether flag, because there is no separate Ether
intelligence.

**What a Traveller can and cannot reach**, so it is written down rather
than assumed:

| | Studio | Ether |
|---|---|---|
| VihuPlanet canon | yes | **yes — the same file** |
| Companion character | yes | yes |
| Story name and length | yes | yes |
| Story PAGES | yes | **no** — Decision 45: a count travels, a word never does |
| Maker's public name | n/a | yes — the portal already prints it |
| Memories | yes | **no** — the field does not exist in that shape |
| Creator's private name, nickname, card | yes | **no** |
| Stars | never | never |

**A redeploy is required** for Step 3C — the traveller path, the shared-
story authorization and the character fix are all server-side.

