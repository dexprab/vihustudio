# Vihu Voice

The characters of VihuPlanet can speak.

Lumo already could — fifty recorded lines in `assets/lumo/voice/`, performed
and measured, played by `js/lumoVoice.js`. The five Companions never could.
This is the foundation that gives them a voice, without taking Lumo's away.

---

## The one rule

**Recordings win.** Always, and without a decision to make.

A recorded performance is a real thing a person did. Generating over it
would replace an original with a copy of one, which is the opposite of
this product's stated vision (`CLAUDE.md` → Product Vision: *beautify
originals rather than replacing them*). So if a line names a recording and
that recording exists, it is played and nothing is generated — no request,
no cost, no difference in the calling code.

Generation is for the lines that have no recording. That is every line
the Companions have.

---

## What a caller writes

```js
VihuVoice.speak({ characterId: 'lumo', text: 'Something wonderful is waiting.' });
```

That is the whole contract. There is no second thing to learn.

…and when the line has a feeling in it:

```js
VihuVoice.speak({ characterId: 'leafy', text: 'You made it!', emotion: 'celebrate' });
```

| | |
|---|---|
| `VihuVoice.speak({characterId, text, emotion?, recorded?})` | Say it. Resolves `true` if the words were heard, `false` if not. Never rejects. |
| `VihuVoice.prepare({characterId, text, emotion?})` | Generate and cache it without saying it. Call a beat early so the line arrives instantly. |
| `VihuVoice.stop()` | Stop whatever is speaking. |
| `VihuVoice.canSpeak(who)` | Does this character have a voice yet? |
| `VihuVoice.voiceOf(who)` | The resolved voice, or `null`. For tools; story code does not need it. |
| `VihuVoice.emotions()` | Every feeling that can be asked for. |
| `VihuVoice.resolve({characterId, text, emotion})` | What would actually be sent. **Tools only** — see *When a feeling is not audible*. |
| `VihuVoice.audition({characterId, text, emotion, modelId})` | Speak through a different model. **Audition room only** — see *The two model families*. |
| `VihuVoice.clearCache()` | Forget this browser's cached audio. For the audition page. |

`who` may be an **id** (`'lumo'`), a **name** (`'Lumo'`) or a **role**
(`'guardian'`) — the same three ways every other caller in this codebase
already names a character. Resolving by role is what lets a Canon Story's
host be found without an `if (id === 'lumo')` anywhere.

`recorded` names a line in `js/lumoVoice.js`. If it exists, it wins.

### What a caller must never know

Not the provider. Not a voice id. Not a model, a request shape, a URL or
a key. Swapping the provider, retuning a voice or switching speech off
entirely is a change to `js/vihuVoice.js` and `assets/registry.json` —
never to a line of story code.

### Silence is a correct answer

Nothing in this path ever shows a child anything. No voice chosen yet, no
network, no platform configured, a provider having a bad day, a browser
refusing to start audio without a gesture — every one of them ends the
same way: the line is not spoken, the screen carries on exactly as it
would have, and the reason goes to the console where a grown-up can find
it and a child never looks.

A child must never meet the words *TTS*, *ElevenLabs*, *API* or *failed*.

---

## Emotion

**The emotion vocabulary is the Companion's own state vocabulary.** Not a
second, parallel list of feeling-words that somebody has to keep in step
with the art — the same word, drawn and spoken.

```
happy   sad   curious   celebrate   surprised   sleep   wave
```

Every one of those is a state a Companion Package already declares. A
Companion pulling a delighted face while speaking in a flat monotone is
the exact thing giving it a voice must not produce, so the word on the
face and the word in the voice are one word.

Four more exist for characters that have **no face** — a narrator, a line
in a book, anything with no package and therefore no state. They are
registers rather than feelings, which is why they are in no package:

```
neutral (the default)   warm   gentle   whisper
```

### A feeling moves a voice; it never replaces one

Each entry is a **delta** on the character's own settings, never an
absolute. A voice tuned breathy and slow stays breathy and slow when it
is happy — it becomes a happier version of *itself* rather than being
swapped for a generic happy voice. That is the whole reason these are
offsets: **the character survives the mood.**

Verified: the same feeling applied to two characters produces two
different requests, and `similarity_boost` — the setting that carries who
somebody *is* — is never touched by any feeling.

Deltas are clamped to the ranges the settings actually mean anything in,
and those ranges are narrower than the provider's own: **stability
0.20–0.95, style 0–0.65, speed 0.7–1.2.** Below about 0.2 stability stops
being expressive and starts being erratic; much over 0.65 style distorts.
So it is the clamps that keep a voice safe, not timid numbers.

**The first set of deltas was too small to hear**, and the product owner
said so on listening to the first real voice: *"emotions does not seem to
be affecting the voice quality."* They were right — a `style` nudge of
+0.15 on a base of 0.1 sits inside the range where this provider barely
moves. Restraint that cannot be heard is not restraint, it is a no-op.
The deltas roughly doubled.

### Pace

Every character's base `speed` is well below the provider's default,
because this is read aloud to children and the default pace is written
for adults. Lumo is slowest at **0.84** — unhurried is his whole manner —
and Leo quickest at **0.88**, which is still slow. `0.7` is the provider's
own floor, so these sit near the slow end while leaving the `sad` and
`sleep` deltas somewhere to go.

Pace is a **base setting, not a feeling**: how fast somebody talks is part
of who they are, and only then something a mood bends.

### When a feeling is not audible

There are two completely different reasons, with two different fixes, and
from the outside they look identical. `VihuVoice.resolve()` tells them
apart — the audition page shows it live under **What is actually sent**:

- **The numbers do not change with the feeling** → the feeling is not
  reaching the request. A bug.
- **The numbers change but the voice does not** → the model is ignoring
  them. Not a bug, a model limit. See below.

`resolve()` is **for tools, not for story code.** Nothing in the product
calls it and nothing should — a caller that reads settings is a caller
that has learned a provider exists.

---

## The two model families

They carry a feeling in **opposite ways**, and sending one the other's
dials is not a soft failure — the provider refuses the whole request and
the line is never spoken.

| | `eleven_turbo_v2_5` | `eleven_v3` |
|---|---|---|
| Built for | speed | expression |
| Audio tags | cannot read them | **this is its vocabulary** |
| `stability` | continuous slider | **Creative 0 · Natural 0.5 · Robust 1** |
| `style` | yes | not its vocabulary |
| `speed` | yes | via audio tags instead |
| A feeling arrives as | numbers | the tag |

`js/vihuVoice.js` sends each family only what that family understands. For
v3 that is deliberately **minimal — one dial and the tag** — because a
refused request costs a child their line, while an omitted dial costs a
little nuance the tag was going to carry anyway.

### The v3 stability is its own axis, and this was a real bug

The provider is blunt: stability is *"the most important setting in v3"*,
and **Robust is "less responsive to directional prompts"** — which is to
say it partly ignores the tag.

The first attempt took the turbo stability and **snapped it to the
nearest of v3's three**. Measured against the real numbers, that
collapsed almost the whole range onto Natural — neutral 0.55, happy 0.35,
curious 0.43, warm 0.63, gentle 0.73 all round to 0.5. Two feelings out
of thirteen landed anywhere else, and one of those was Robust. **Every
feeling was arriving on v3 as very nearly the same request**, which is
what *"i dont see much difference"* actually was.

So each feeling now names its **own** v3 stability, and **nothing is ever
Robust**. It has to be a separate field rather than a clever derivation,
because the two families want *opposite* numbers for the same feeling: on
turbo, `sad` is steadier than neutral; on v3 that same move would switch
the expression off, so `sad` there is Creative.

### The tags come from the provider's published list

Not from memory — that is how the first set went wrong. `[whispers]`
`[excited]` `[surprised]` `[curious]` `[sad]` `[sighs]` are from the
audio-tag list proper; `[happy]` and `[thoughtful]` from its
emotional-direction set. The suite holds that list and fails on any tag
that is not in it.

Feelings with no honest tag — `warm`, `gentle`, `neutral` — carry none.
Inventing a word for them is precisely the mistake being guarded against.

### The voice matters more than any of this

The provider's own first line on v3: *"The most important parameter for
Eleven v3 is the voice you choose."* Tag effectiveness depends on the
voice and its training samples — *"don't expect a whispering voice to
suddenly shout"* — and library voices "may produce more variable results"
than on v2, which is why there is a **curated collection for v3**.

**A tag doing nothing is therefore a real and expected outcome, and its
fix is a different voice rather than a different number.** Professional
Voice Clones are documented as not yet optimised for v3; an Instant Voice
Clone or a designed voice is the recommendation.

### The trade-off, stated plainly

**Moving a character to v3 also gives up LATENCY, and that half was not
written down here until Sprint 3A.1.** `eleven_v3` is the expressive
model; `eleven_turbo_v2_5` (the function's own default, and what a
registry entry gets if it names no model) and `eleven_flash_v2_5` are the
low-latency ones. The whole cast is on v3, so every generated line pays
the expressive model's generation time — and since Sprint 3A.1 holds a
Companion's words until its voice is ready, that time is now time a child
spends looking at a "getting ready" indicator rather than time they spend
reading an answer they already have.

Nothing has been changed on that basis. It was **chosen by ear** and it is
a product decision, not an engineering one; this is only the fact that
belongs beside it. The knobs, in the order they cost something:

| lever | costs | how |
|---|---|---|
| `ELEVENLABS_OUTPUT_FORMAT` | a little fidelity | one env var, e.g. `mp3_22050_32`; unset changes nothing |
| `modelId` per character | expression, and audio tags | a registry edit, no code, no redeploy |

Judge both by ear. Neither can be measured from a build environment,
because neither the provider nor a pair of ears is reachable from one.

**Moving a character to v3 gives up `speed`.** The base pace above is a
turbo setting; v3 has no equivalent, so a v3 character speaks at whatever
pace the voice itself has. If slowness matters more than expression for a
particular character, turbo is the right choice for them — this is
per-character, not per-product.

**The whole cast is on `eleven_v3` as shipped**, chosen by ear after
hearing both. So the base `speed` values in the registry are currently
**inert** — they are kept, not deleted, because they are the right
numbers the moment a character moves back, and deleting a setting to
record that it is unused loses the tuning. The suite prints how many
characters are on v3 so this never becomes invisible.

Pace on v3 comes back through what v3 *does* read: `[short pause]`,
ellipses (which "add pauses and weight") and capitalisation for emphasis.
That is a change to the LINES rather than to a number, so it belongs with
whoever writes them.

### Hearing them side by side

`VihuVoice.audition({characterId, text, emotion, modelId})` speaks a line
through a **different** model than the character's own. The audition page
exposes it as the model row.

**For the audition room only**, and named so nobody mistakes it for the
story contract. `speak()` takes no model and ignores one if given — that
is asserted in the suite, along with a sweep proving no module in `js/`
except `vihuVoice.js` mentions a model at all. Choosing a model is the
same kind of decision as choosing a voice: a listening one, and the
alternative is editing the registry, pushing, waiting for a deploy and
guessing again. Whatever wins gets written into the registry and this is
never called again.

### When the provider refuses

`voice-speak` returns `{ok: false, reason: 'provider', status, detail}` —
the provider's own error, truncated. `js/vihuVoice.js` writes it to the
console and nothing in the product ever renders it.

It exists because a refused request was otherwise **indistinguishable
from every other kind of quiet**, which made moving between model
families pure guesswork: the families take different settings, and
"silence" was the only symptom of getting that wrong. It cannot leak the
key — it is the provider's error body, and a provider does not echo
credentials back.

### Anything unrecognised is neutral

An emotion nobody has defined, a state that is a pose rather than a
feeling (`idle`, `talk`, `hero`, `hatching`), a package inventing a state
this table has never heard of — all resolve to neutral. The line is still
said, in the character's own voice. It is never an error and never a
refusal to speak.

`thinking` and `think` are the same feeling; `magic` reads as `excited`.
Aliases, not special cases, so **any** state a package declares can be
handed over unchanged.

### Retuning one feeling for one character

Optional, and only where the shared table is wrong for somebody.
Leosaurus can be a louder kind of excited than Leafy:

```json
"voice": {
  "voiceId": "…",
  "settings": { "stability": 0.5, "style": 0.15 },
  "emotions": {
    "excited": { "stability": -0.30, "style": 0.35, "speed": 0.08 }
  }
}
```

An override **replaces** the shared entry for that feeling rather than
stacking on it — stacking would mean a registry edit could only ever push
a value further in the direction the shared table already chose, which is
not tuning, it is nudging. Feelings not listed still come from the shared
table.

### Audio tags, and the failure that would land on a child

Some feelings carry an inline tag (`[whispers]`, `[excited]`). **Only the
v3 model family can read one.** Every other model hands the brackets
straight to the reader — a child would hear the word *"whispers"* spoken
out loud.

So tags are gated on a positive check of the character's own model, and
anything unrecognised is assumed **not** to support them. Today every
character is on `eleven_turbo_v2_5`, so **no tag is ever sent** and
emotion is carried entirely by the settings. Move a character to
`eleven_v3` and its tags switch on with no other change. Verified in both
directions, including that no bracket of any kind survives on a turbo
model.

### Recordings keep their own feeling

A recorded line was performed with a feeling already in it. Asking for a
different one does **not** re-generate it — the recording still wins and
nothing is sent. Overriding a real performance is precisely what this
module exists not to do.

---

## Where the voices live

`assets/registry.json`. The same file that already says who exists, what
they are and where their art is.

```json
{
  "id": "nimbus",
  "name": "Nimbus",
  "species": "Dream Sprite",
  "path": "nimbus/",
  "role": "companion",
  "voice": {
    "provider": "elevenlabs",
    "voiceId": "",
    "modelId": "eleven_turbo_v2_5",
    "settings": { "stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "speed": 1.0 }
  }
}
```

**A voice id is content, not a secret.** It names a voice; it authorises
nothing. Keeping it here rather than in the Edge Function is what lets a
voice be changed, retuned or replaced without redeploying anything.

**An empty `voiceId` is a normal state, not a fault.** Every character
starts that way. That character stays silent and everything around them
carries on — which is why the whole product works with no voices
configured at all.

### Giving a Companion a voice

1. Pick or create the voice in the provider's console.
2. Copy its voice id into that character's `voice.voiceId` in
   `assets/registry.json`.
3. Listen to it — `tools/voice-audition/index.html`.

There is no code change. There has never needed to be.

### Changing Lumo's voice

Same three steps, on the `lumo` entry.

But note what it will and will not affect: Lumo's **recorded** lines are
unaffected, because recordings win. Changing `lumo.voice` changes only
the lines Lumo speaks that have no recording. To change a recorded line,
re-record it and update `js/lumoVoice.js` — that file's own header
explains how, including that `ms` is a measured duration and must be
re-measured.

### Tuning a voice

`settings` is passed through untouched to the provider, so whatever it
accepts, this accepts — today `stability`, `similarity_boost`, `style`
and `speed`. Changing any of them changes the cache key, so a retuned
voice correctly regenerates rather than serving yesterday's take.

---

## The credentials

**The key never reaches a browser.** It lives in
`supabase/functions/voice-speak` and nowhere else. That function is the
only place in VihuPlanet that knows a speech provider exists.

Deploy:

```
supabase functions deploy voice-speak
```

Secrets (Edge Functions → `voice-speak` → Secrets):

| | |
|---|---|
| `ELEVENLABS_API_KEY` | required |
| `VOICE_CACHE_BUCKET` | optional, defaults to `voice-cache` |

Create that Storage bucket (private is fine — the function reads it with
the service role). Without it, everything still works; every line is just
generated fresh each time.

**Leave JWT verification ON.** This function spends money per call, so an
unauthenticated one is somebody else's bill. A browser GET returning
`UNAUTHORIZED_NO_AUTH_HEADER` is the gateway working, not a fault; test
with the anon key, which is public by design:

```
curl -i <url> -H "Authorization: Bearer <anon key>"
```

A `GET` answers with a small status object — build, whether a key is
configured, which bucket — for the same reason `sky-protection` and
`creator-born` do: a deployment running an old copy is otherwise
invisible.

### Not configured is a handled state

No key, no function deployed, no platform at all: `speak()` returns
`false` and the product behaves exactly as it did before it could speak.
Verified, not assumed.

---

## The cache

Dialogue in VihuPlanet is mostly the same words every time, so generating
them twice is paying twice for one sound. Two layers:

- **In the function**, into Supabase Storage. This is the one that
  matters: the *second child ever* to hear a line costs nothing.
- **In the browser**, via the Cache API, so a line heard twice in a
  session — or on a later visit — does not even make the request.

Both key on the **whole request**: voice, model, settings and text. Change
any of them and it is a different sound, which correctly misses.

**Emotion caches for free**, and deliberately so: the feeling is resolved
into the settings and the text *before* the key is taken, so a happy line
and a sad line are different keys and neither can ever be served in place
of the other. There is no separate emotion field in the key to keep in
step. `neutral` and no feeling at all are the same entry, correctly.

The browser layer is treated as a bonus at every step: the Cache API is
absent in an insecure context and can be evicted at any moment, so nothing
depends on it being there.

---

## How the runtime invokes speech

Today, through the Companion widget, and through one method:

`CompanionEngine.prototype.speak(text)` shows the speech bubble it always
has, and now also says it in that Companion's own voice. Its own header
predicted this in the first sprint — *"speak() could grow a typewriter
effect or TTS"* — and the prediction held: **the signature is unchanged
and no caller was edited.** Every existing line the Companion Director
already speaks in the Studio gained a voice for free.

**And the feeling comes for free too**, because the Companion is already
wearing one: `speak()` passes **the state it is currently in** as the
emotion. That is the whole reason no caller had to learn about moods — a
Companion that has just been set to `celebrate` speaks in celebration
without anybody remembering to say so.

- Pass `{silent: true}` for the bubble without the voice.
- Pass `{emotion: '…'}` for the rare line whose words carry a different
  feeling from the pose.
- `speak('')` hides the bubble and stops the voice together.
- A page that does not load `js/vihuVoice.js` is completely unchanged.

### Disclosed: the autoplay policy

A browser will not start audio that no gesture asked for. Several of the
Director's lines fire on load or on a timer, and those will be blocked and
stay silent — the bubble still appears, so nothing looks broken, and the
reason is in the console.

This is not worked around, and deliberately so. The way to fix it is to
make speech follow a real interaction, which is also the way to make it
feel like somebody answering rather than a page talking at you. The
Traveller Gateway already solved this exact problem the same way
(`js/gatewayAudio.js`).

### The Studio Rite

**Rite I is recorded. Rite II is spoken, and never will be recorded** —
*"for story rite 2 plug the eleven labs lumo voice. we wont be recording
it."*

Both go through the same dispatch in `js/studioRite.js`, and the order
*is* the policy:

1. a screen with `audio:{id,cues}` → the recording, via `LumoVoice`
2. otherwise, if Lumo has a voice → **generated, via `VihuVoice`**
3. otherwise → reading speed, in silence

Rite I never reaches step 2; Rite II never reaches step 1. Nothing in
either rite had to know which one it is in.

**The spoken path needs no cues, and that is the real gain.** A recorded
screen carries a hand-measured offset per line, re-measured whenever a
line is re-recorded. Generated speech reports when it ended, so each line
waits for its own voice and the next follows. **Rewording a Rite II line
is a one-line edit with nothing to keep in step** — which matters for a
script that may still move.

**The feeling is the pose Lumo is already in.** `entry.lumo` was already
`talk`, `curious`, `celebrate` — the same vocabulary — so no rite content
needed annotating. Same trick as the Companion widget.

Generation is primed a screen ahead, so only the very first line of a
rite can ever wait on a round trip. If speech is unavailable for any
reason the screens fall back to reading speed exactly as before —
walkable in silence, as they always were.

### Where it deliberately does not go

The Ether's World Host does not speak. `CLAUDE.md` → Decision 24 is
explicit that the host is not a control, has no bubble, and must be
ignorable in full: *a Traveller must be able to experience the complete
Story without interacting with, understanding, or paying any attention to
the Companion.* A voice over somebody's story is the loudest thing on the
page. Giving it one is a canon change, not a feature.

---

## Auditioning

`tools/voice-audition/index.html` — a development page. Nothing links to
it and no child reaches it.

It lists every character, shows whether they have a voice, speaks one line
in any of them **in any feeling**, and can play the same line through the
whole cast back to back. **Hear every feeling** runs one character through
all fourteen, naming each as it goes. That is the only way to tell whether
Nimbus sounds like a Dream Sprite, or whether a delta is doing anything at
all; a stability number tells you nothing.

**It holds no key**, builds no provider request and knows no provider URL.
That is the point: if the audition room can be written without the key,
so can everything else.

---

## Files

| | |
|---|---|
| `js/vihuVoice.js` | The one abstraction story code calls. |
| `assets/registry.json` | Who has which voice. |
| `supabase/functions/voice-speak/index.ts` | The only place the key exists. |
| `js/companionEngine.js` → `speak()` | The one surface wired up so far. |
| `js/lumoVoice.js` | Lumo's recordings. Unchanged, and they still win. |
| `tools/voice-audition/index.html` | Listening room. |

Verified 84/84 with zero page errors: voice resolution by id, name and
role; an empty `voiceId`; what is and is not sent to the function; the
cache across a reload, across voices, across feelings and under
simultaneous asks; all three failure modes; that recordings win and
generate nothing even when a feeling is asked for; that a feeling moves a
voice without replacing it and cannot walk it off its own scale; that an
unrecognised feeling is neutral rather than an error; that **no audio tag
ever reaches a model that would read it aloud**; that a character can
retune one feeling for itself without affecting anyone else; and that the
widget's public API was not widened.
