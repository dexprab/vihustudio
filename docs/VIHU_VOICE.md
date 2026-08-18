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

| | |
|---|---|
| `VihuVoice.speak({characterId, text, recorded?})` | Say it. Resolves `true` if the words were heard, `false` if not. Never rejects. |
| `VihuVoice.prepare({characterId, text})` | Generate and cache it without saying it. Call a beat early so the line arrives instantly. |
| `VihuVoice.stop()` | Stop whatever is speaking. |
| `VihuVoice.canSpeak(who)` | Does this character have a voice yet? |
| `VihuVoice.voiceOf(who)` | The resolved voice, or `null`. For tools; story code does not need it. |
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

- Pass `{silent: true}` for the bubble without the voice.
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
in any of them, and can play the same line through the whole cast back to
back. That is the only way to tell whether Nimbus sounds like a Dream
Sprite; a stability number tells you nothing.

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

Verified 51/51 with zero page errors: voice resolution by id, name and
role; an empty `voiceId`; what is and is not sent to the function; the
cache across a reload, across voices and under simultaneous asks; all
three failure modes; that recordings win and generate nothing; and that
the widget's public API was not widened.
