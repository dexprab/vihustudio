// js/vihuVoice.js — Vihu Voice. The one thing story code calls to make a
// character speak.
//
// ---------------------------------------------------------------
// WHAT A CALLER KNOWS, AND WHAT IT MUST NEVER KNOW
//
//   VihuVoice.speak({ characterId: 'lumo', text: 'Something wonderful is waiting.' });
//   VihuVoice.speak({ characterId: 'leafy', text: 'You made it!', emotion: 'celebrate' });
//
// That is the whole contract. A caller never learns that a speech
// provider exists, never holds a voice id, never builds a request and
// never sees a key. Swapping the provider, retuning a voice or turning
// speech off entirely is a change to this file and to
// assets/registry.json — never to a single line of story code.
//
// ---------------------------------------------------------------
// EMOTION IS THE WORD THAT IS ALREADY ON THE FACE
//
// The emotions a character can be asked for are the states their own
// Companion Package already declares — happy, sad, curious, celebrate,
// surprised, sleep, wave. Not a second vocabulary of feeling-words to
// keep in step with the art: the same word, drawn and spoken. See the
// EMOTIONS table below for why that matters and how it degrades.
//
// ---------------------------------------------------------------
// RECORDINGS WIN. ALWAYS.
//
// Lumo already has fifty recorded lines in assets/lumo/voice/, performed
// and measured, and js/lumoVoice.js already plays them. Synthesising
// those would replace a real performance with a generated one, which is
// a downgrade dressed as a feature — and this product's whole stated
// vision is "beautify originals rather than replacing them"
// (CLAUDE.md → Product Vision).
//
// So: if a line names a recording and that recording exists, it is
// played and no speech is generated. Generation is for the lines that
// have no recording — which is every line the five Companions have,
// since none of them has ever had a voice at all. That is where this
// earns its place.
//
// LumoVoice exposes no has(), so the probe is durationMs(id) > 0 — it
// returns 0 for an id it does not know and each clip's own measured
// length for one it does. Reading an existing seam rather than editing
// a frozen module to add one.
//
// ---------------------------------------------------------------
// THE KEY IS NOT HERE, AND CANNOT BE
//
// The provider's API key lives in supabase/functions/voice-speak and
// nowhere else. This file sends { characterId, voiceId, modelId,
// settings, text } to that function and gets audio back. The voice id
// is content, not a secret — it sits in assets/registry.json so a voice
// can be changed without redeploying anything.
//
// ---------------------------------------------------------------
// SILENCE IS A CORRECT ANSWER
//
// Nothing here ever shows a child anything. No voice configured, no
// network, a provider having a bad day, an autoplay policy refusing —
// every one of them ends the same way: the line is not spoken, the
// screen carries on exactly as it would have, and the reason goes to
// the console where a grown-up can find it. A child must never meet the
// words "TTS", "ElevenLabs", "API" or "failed".
(function () {
  'use strict';

  var FN_NAME = 'voice-speak';
  var VOLUME = 0.85;          // the same level Lumo's recordings play at
  var CACHE_NAME = 'vihu-voice-v2';   // v1 held takes with no emotion applied

  // ---------------------------------------------------------------
  // EMOTION
  //
  // A Companion already HAS an emotion when it speaks. Every package
  // declares states — happy, sad, curious, celebrate, surprised, sleep,
  // wave — and one of them is on the Companion's face at the moment the
  // words come out. A Companion pulling a delighted face while speaking
  // in a flat monotone is the exact thing this must not produce.
  //
  // So the emotion vocabulary IS the state vocabulary. Not a second,
  // parallel list of feeling-words that somebody has to keep in step
  // with the art — the same word, drawn and spoken. That is why
  // CompanionEngine.speak() needs no new argument to feel right: it
  // passes the state it is already in.
  //
  // The four extra names below (neutral, warm, gentle, whisper) are for
  // story characters that have no art and therefore no state — a
  // narrator, a line in a book. They are registers rather than feelings,
  // which is why they are not in any package.
  //
  // WHAT AN ENTRY MEANS. Each is a DELTA on the character's own base
  // settings, never an absolute. A voice tuned breathy and slow stays
  // breathy and slow when it is happy; it becomes a happier version of
  // itself rather than being replaced by a generic happy voice. That is
  // the whole reason these are offsets: the character survives the mood.
  //
  //   stability  lower  = freer, more variable delivery
  //   style      higher = more pronounced performance
  //   speed      relative to the character's own pace
  //
  // `tag` is an inline audio tag, and it is DELIBERATELY NOT USED by
  // most models. Only the v3 family understands them; a turbo model
  // hands the brackets to the reader, and a child would hear the word
  // "whispers" spoken aloud. So a tag is dropped unless the character's
  // own model declares it can read one — see _supportsTags(). Never
  // assume; that failure is audible and lands on a child.
  //
  // Every tag below is taken from the provider's own published list
  // rather than from memory. Two are from its emotional-direction set
  // ([thoughtful], [happy]) and the rest from the audio-tag list proper
  // ([whispers], [excited], [surprised], [curious], [sad], [sighs]).
  //
  // Its own warning is worth keeping in view: tag effectiveness depends
  // on the VOICE and its training samples — "don't expect a whispering
  // voice to suddenly shout". A tag doing nothing is therefore a real
  // and expected outcome, and the fix for it is a different voice, not
  // a different number.
  // HOW BIG THE DELTAS ARE, and why they got bigger. The first set was
  // written to be tasteful — style +0.15, stability -0.10 — and the
  // product owner's verdict on hearing it was "emotions does not seem to
  // be affecting the voice quality". They were right: on a base style of
  // 0.1, a +0.15 nudge is well inside the range where this provider's
  // delivery barely moves. Restraint that cannot be heard is not
  // restraint, it is a no-op.
  //
  // These are the ranges the settings actually do something in, while
  // staying clear of where they misbehave: stability below about 0.2
  // gets erratic rather than expressive, and style much above 0.6
  // distorts. So the deltas are large but the CLAMPS are what keep a
  // voice safe, not the timidity of the numbers.
  // `v3` IS THE STABILITY THIS FEELING WANTS ON v3, and it is a separate
  // axis rather than something derived from the delta above. The
  // provider's own guidance is blunt about it: stability is "the most
  // important setting in v3", and its three values are Creative (0),
  // Natural (0.5) and Robust (1) — where Robust is documented as "less
  // responsive to directional prompts", which is to say it partly
  // ignores the audio tag.
  //
  // Nothing here is ever Robust, deliberately. A feeling that reads as
  // "steadier" on turbo — sad, sleep — must NOT become steadier on v3,
  // because there the same move switches the expression off. The two
  // families genuinely want opposite numbers for the same feeling, which
  // is exactly why this is its own field and not a clever derivation.
  var EMOTIONS = {
    // registers — for voices with no face
    neutral:   { v3: 0.5 },
    warm:      { stability:  0.08, style:  0.10, speed: -0.04, v3: 0.5 },
    gentle:    { stability:  0.18, style: -0.08, speed: -0.08, v3: 0.5 },
    whisper:   { stability:  0.22, style: -0.05, speed: -0.10, v3: 0.5, tag: '[whispers]' },

    // the Companion states, spoken
    happy:     { stability: -0.20, style:  0.30, speed:  0.05, v3: 0,   tag: '[happy]' },
    excited:   { stability: -0.30, style:  0.42, speed:  0.09, v3: 0,   tag: '[excited]' },
    celebrate: { stability: -0.26, style:  0.40, speed:  0.07, v3: 0,   tag: '[excited]' },
    surprised: { stability: -0.28, style:  0.34, speed:  0.03, v3: 0,   tag: '[surprised]' },
    curious:   { stability: -0.12, style:  0.20, speed: -0.03, v3: 0,   tag: '[curious]' },
    think:     { stability:  0.16, style: -0.05, speed: -0.11, v3: 0.5, tag: '[thoughtful]' },
    sad:       { stability:  0.18, style:  0.12, speed: -0.15, v3: 0,   tag: '[sad]' },
    sleep:     { stability:  0.26, style: -0.10, speed: -0.18, v3: 0.5, tag: '[sighs]' },
    wave:      { stability: -0.06, style:  0.16, speed:  0.04, v3: 0,   tag: '[happy]' }
  };

  // States that are poses rather than feelings resolve to neutral, and
  // one package spells the same feeling differently. Both are aliases
  // rather than special cases, so a caller can hand over ANY state a
  // package declares and get something sensible back — which is what
  // lets CompanionEngine pass its state through without knowing this
  // table exists.
  var ALIASES = {
    idle: 'neutral', talk: 'neutral', hero: 'neutral',
    hatching: 'neutral', magic: 'excited', thinking: 'think'
  };

  // Deltas would happily walk a voice off the end of its own scale over
  // a few applications; a provider given stability 1.4 is being handed
  // nonsense. These are the ranges the settings actually mean anything
  // in, and speed's floor is deliberately not 0 — a voice at half pace
  // is not sad, it is broken.
  // Not the provider's full 0–1, deliberately. Stability under about 0.2
  // stops being expressive and starts being erratic — words slurred,
  // pitch wandering — and style much over 0.6 distorts and slows
  // generation. These are the ranges where the knobs do something a
  // person would call a mood.
  var RANGE = {
    stability: [0.2, 0.95], similarity_boost: [0, 1], style: [0, 0.65], speed: [0.7, 1.2]
  };

  function _clamp(name, v) {
    var r = RANGE[name];
    if (!r || typeof v !== 'number' || !isFinite(v)) return v;
    return Math.min(r[1], Math.max(r[0], v));
  }

  // ---------------------------------------------------------------
  // configuration
  //
  // Both paths are resolved against THIS SCRIPT rather than against the
  // document, which is what lets the audition page live in a
  // subdirectory and still find the same registry and the same
  // platform. Every other caller of loadRegistry() passes a
  // document-relative 'assets/' and is correct to, because every one of
  // them is a page at the repository root.

  var _here = (function () {
    var el = document.currentScript;
    return el ? el.src : null;
  })();

  var CONFIG_URL = _here ? new URL('../supabase-config.json', _here).href : 'supabase-config.json';
  var ASSETS_BASE = _here ? new URL('../assets/', _here).href : 'assets/';

  var _cfgPromise = null;
  function _config() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { return (cfg && cfg.url && cfg.anonKey) ? cfg : null; })
      .catch(function () { return null; });
    return _cfgPromise;
  }

  function _note() {
    try { console.warn.apply(console, ['[VihuVoice]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // who is speaking
  //
  // The registry is the single source of truth for every character and
  // now for their voice too, exactly as it already is for their art and
  // their role. Adding a voice to a Companion is one JSON block; there
  // is no code change anywhere for it.

  var _registry = null;
  function _registryList() {
    if (_registry) return _registry;
    try {
      if (typeof CompanionEngine === 'undefined' || !CompanionEngine.loadRegistry) {
        _registry = Promise.resolve([]);
      } else {
        _registry = CompanionEngine.loadRegistry(ASSETS_BASE)
          .catch(function () { return []; });
      }
    } catch (e) { _registry = Promise.resolve([]); }
    return _registry;
  }

  // Accepts an id ('lumo'), a name ('Lumo'), or a role ('guardian') —
  // the same three ways every other caller in this codebase already
  // refers to a character. Resolving by role is what lets a Canon
  // Story's host be found without an `if (id === 'lumo')` anywhere
  // (CLAUDE.md → Decision 24).
  function _entryFor(who) {
    var key = String(who || '').trim().toLowerCase();
    if (!key) return Promise.resolve(null);
    return _registryList().then(function (list) {
      var byId = null, byName = null, byRole = null;
      (list || []).forEach(function (e) {
        if (!e) return;
        if (!byId && String(e.id || '').toLowerCase() === key) byId = e;
        if (!byName && String(e.name || '').toLowerCase() === key) byName = e;
        if (!byRole && String(e.role || '').toLowerCase() === key) byRole = e;
      });
      return byId || byName || byRole || null;
    });
  }

  /**
   * The voice a character speaks in, or null when they have none yet.
   * Exposed because the audition page needs it; story code never does.
   * @param {string} who id, name or role
   * @returns {Promise<object|null>}
   */
  function voiceOf(who) {
    return _entryFor(who).then(function (entry) {
      if (!entry || !entry.voice) return null;
      var v = entry.voice;
      // A character with an empty voiceId is a real, expected state —
      // every one of them starts that way, and the voices are chosen by
      // hand. It is not an error and must never read as one.
      if (!v.voiceId) return null;
      return {
        characterId: entry.id,
        name: entry.name || entry.id,
        voiceId: v.voiceId,
        modelId: v.modelId || 'eleven_turbo_v2_5',
        settings: v.settings || {},
        // Per-character emotion overrides, if this character has any.
        // Shape is the shared table's, so a registry entry can retune
        // one feeling for one character without restating the rest —
        // Leosaurus can be a louder kind of excited than Leafy.
        emotions: (v.emotions && typeof v.emotions === 'object') ? v.emotions : null
      };
    });
  }

  // ---------------------------------------------------------------
  // emotion, resolved

  function _emotionName(emotion) {
    var key = String(emotion || '').trim().toLowerCase();
    if (!key) return 'neutral';
    if (ALIASES[key]) key = ALIASES[key];
    // An emotion nobody has defined is neutral, never an error and never
    // a refusal to speak. A future package that declares a state this
    // table has never heard of still gets a line said, in the
    // character's own voice, which is the right failure.
    return EMOTIONS[key] ? key : 'neutral';
  }

  function _emotionFor(v, emotion) {
    var key = _emotionName(emotion);
    var own = v && v.emotions && v.emotions[key];
    // A character's own entry REPLACES the shared one for that feeling
    // rather than stacking on it. Stacking would mean a registry edit
    // could only ever push a value further in the direction the shared
    // table already chose, which is not tuning, it is nudging.
    return own || EMOTIONS[key] || {};
  }

  // Only the v3 family reads inline audio tags. Every other model hands
  // the brackets straight to the reader — a child would hear the word
  // "whispers" spoken out loud, which is a failure that lands on them
  // rather than on us. So this is a positive check, and anything it does
  // not recognise is assumed NOT to support tags.
  function _supportsTags(v) {
    if (v && typeof v.supportsTags === 'boolean') return v.supportsTags;
    return /^eleven_v3/.test(String((v && v.modelId) || ''));
  }

  // v3 DOES NOT TAKE THE SAME DIALS, and sending it the wrong ones is
  // not a soft failure — the provider refuses the whole request and the
  // line is simply never spoken.
  //
  // The two families express emotion in opposite ways. A turbo model has
  // no tags and only continuous sliders, so a feeling has to be carried
  // entirely by numbers. v3 is the reverse: expression is what the audio
  // TAGS are for, its stability is a three-way choice rather than a
  // slider (creative / natural / robust), and style and speed are not
  // its vocabulary at all.
  //
  // So this sends each family only what that family understands. It is
  // deliberately MINIMAL for v3 — one dial and the tag — because a
  // rejected request costs a child their line, while an omitted dial
  // costs a little nuance the tag was going to carry anyway.
  // WHY SNAPPING THE CONTINUOUS VALUE WAS WRONG, and this replaced it.
  //
  // The first attempt took the turbo stability and snapped it to the
  // nearest of v3's three. Measured against the real numbers, that
  // collapsed almost the entire range onto 0.5: neutral 0.55, happy
  // 0.35, curious 0.43, warm 0.63, gentle 0.73 — every one of them
  // rounds to Natural. Two feelings out of thirteen landed anywhere
  // else, and one of those was Robust, which the provider documents as
  // *less* responsive to a tag.
  //
  // So on v3 every feeling was arriving as very nearly the same request,
  // which is precisely what "i dont see much difference" sounded like.
  // The feeling now names its own v3 stability outright.
  var V3_STABILITY = [0, 0.5, 1];

  // The character's own settings, moved by the feeling. Deltas, never
  // absolutes, so the character survives the mood (see EMOTIONS).
  function _settingsFor(v, emotion) {
    var base = v.settings || {};
    var mood = _emotionFor(v, emotion);
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    ['stability', 'similarity_boost', 'style', 'speed'].forEach(function (k) {
      if (typeof mood[k] !== 'number') return;
      var from = (typeof base[k] === 'number') ? base[k] : (k === 'speed' ? 1 : 0.5);
      out[k] = _clamp(k, from + mood[k]);
    });

    if (_supportsTags(v)) {
      // v3 takes one dial and the tag. A character may still override
      // its own value; anything outside v3's three legal choices would
      // be refused, so an override is honoured only if it is one of
      // them.
      var want = mood.v3;
      if (V3_STABILITY.indexOf(want) === -1) want = 0.5;   // Natural
      out = { stability: want };
    }
    return out;
  }

  function _textFor(v, emotion, text) {
    var mood = _emotionFor(v, emotion);
    if (!mood.tag || !_supportsTags(v)) return text;
    return mood.tag + ' ' + text;
  }

  /**
   * Every feeling a character can be asked for. The Companion states are
   * in here by name, which is the point — the word on the face and the
   * word in the voice are the same word.
   * @returns {string[]}
   */
  function emotions() { return Object.keys(EMOTIONS); }

  function _withModel(v, modelId) {
    var out = {};
    Object.keys(v).forEach(function (k) { out[k] = v[k]; });
    out.modelId = modelId;
    return out;
  }

  /**
   * Speak a line through a DIFFERENT model than the character's own.
   *
   * FOR THE AUDITION ROOM ONLY, and named so nobody mistakes it for the
   * story contract. Story code calls speak(), which never takes a model
   * — the model lives in assets/registry.json and the whole point of the
   * seam is that a caller does not know one exists.
   *
   * It exists because choosing a model is the same kind of decision as
   * choosing a voice: a listening one. The two families carry emotion in
   * completely different ways, and the alternative to hearing them side
   * by side is editing the registry, pushing, waiting for a deploy and
   * guessing again. Whatever wins gets written into the registry, and
   * this is never called again.
   * @returns {Promise<boolean>}
   */
  function audition(opts) {
    var o = opts || {};
    var words = String(o.text || '').trim();
    if (!o.characterId || !words) return Promise.resolve(false);
    return voiceOf(o.characterId).then(function (v) {
      if (!v) return false;
      if (o.modelId) v = _withModel(v, o.modelId);
      return _generate(v, words, o.emotion).then(function (src) {
        return src ? _play(src) : false;
      });
    }).catch(function () { return false; });
  }

  /**
   * What would actually be sent for this character in this feeling.
   *
   * FOR TOOLS, NOT FOR STORY CODE. Nothing in the product calls this and
   * nothing should — a caller that reads settings is a caller that has
   * learned a provider exists, which is the one thing the seam is for.
   *
   * It exists because "the emotion is not doing anything" is otherwise
   * unanswerable from the outside: there is no way to tell a feeling
   * that never reached the request from one that reached it and was
   * ignored by the model. Those have completely different fixes, so the
   * audition room shows this on screen rather than guessing.
   *
   * Carries no key and cannot: the key is not in this browser.
   * @returns {Promise<object|null>}
   */
  function resolve(opts, text, emotion) {
    var o = (typeof opts === 'string')
      ? { characterId: opts, text: text, emotion: emotion }
      : (opts || {});
    var who = o.characterId || o.character || o.id;
    return voiceOf(who).then(function (v) {
      if (!v) return null;
      if (o.modelId) v = _withModel(v, o.modelId);
      return {
        characterId: v.characterId,
        voiceId: v.voiceId,
        modelId: v.modelId,
        emotion: _emotionName(o.emotion),
        supportsTags: _supportsTags(v),
        settings: _settingsFor(v, o.emotion),
        text: _textFor(v, o.emotion, String(o.text || ''))
      };
    }).catch(function () { return null; });
  }

  // ---------------------------------------------------------------
  // the cache
  //
  // VihuPlanet's dialogue is mostly the same words every time, so
  // generating them twice is paying twice for one sound. Two layers,
  // and the far one matters most:
  //
  //   voice-speak caches in Supabase Storage, so the SECOND CHILD EVER
  //   to hear a line costs nothing — that is where the saving lives.
  //
  //   This one is the browser's own, so a line heard twice in a session
  //   (or on a second visit) does not even make the request.
  //
  // The key is the whole request — voice, model, settings, text — so a
  // retuned voice is a different key and correctly misses rather than
  // serving yesterday's take.

  var _mem = Object.create(null);   // key -> object URL

  function _key(v, text) {
    var canonical = JSON.stringify({ v: v.voiceId, m: v.modelId, s: v.settings || null, t: text });
    // A short, stable, non-cryptographic hash. This names a cache entry;
    // it guards nothing, so a real digest would buy nothing but an
    // async hop. (The FUNCTION uses SHA-256 for its own key, where the
    // entry is shared between children and collisions would be
    // somebody else's audio.)
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < canonical.length; i++) {
      var c = canonical.charCodeAt(i);
      h1 = (h1 ^ c) * 16777619 >>> 0;
      h2 = (h2 * 31 + c) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }

  // The Cache API keeps a line across reloads. It is absent in an
  // insecure context and can be evicted at any moment, so every path
  // through here treats it as a bonus and never as storage.
  function _cacheOpen() {
    try {
      if (typeof caches === 'undefined' || !caches.open) return Promise.resolve(null);
      return caches.open(CACHE_NAME).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function _cacheUrl(key) { return 'https://vihu.voice/' + key + '.mp3'; }

  function _fromCache(key) {
    if (_mem[key]) return Promise.resolve(_mem[key]);
    return _cacheOpen().then(function (c) {
      if (!c) return null;
      return c.match(_cacheUrl(key)).then(function (res) {
        if (!res) return null;
        return res.blob().then(function (b) {
          _mem[key] = URL.createObjectURL(b);
          return _mem[key];
        });
      }).catch(function () { return null; });
    });
  }

  function _toCache(key, blob) {
    _mem[key] = URL.createObjectURL(blob);
    _cacheOpen().then(function (c) {
      if (!c) return;
      try {
        c.put(_cacheUrl(key), new Response(blob, {
          headers: { 'Content-Type': 'audio/mpeg' }
        }));
      } catch (e) {}
    }).catch(function () {});
    return _mem[key];
  }

  /** Forgets everything cached in this browser. For the audition page. */
  function clearCache() {
    Object.keys(_mem).forEach(function (k) {
      try { URL.revokeObjectURL(_mem[k]); } catch (e) {}
      delete _mem[k];
    });
    try { if (typeof caches !== 'undefined' && caches.delete) caches.delete(CACHE_NAME); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // generating

  var _inflight = Object.create(null);

  function _generate(v, text, emotion) {
    // The feeling is resolved into the request BEFORE the key is taken,
    // which is what makes emotion cache correctly for free: a happy line
    // and a sad line have different settings, so they have different
    // keys, so neither can ever be served in place of the other. There
    // is no separate emotion field in the key to keep in step.
    var settings = _settingsFor(v, emotion);
    var spoken = _textFor(v, emotion, text);
    var key = _key({ voiceId: v.voiceId, modelId: v.modelId, settings: settings }, spoken);
    if (_inflight[key]) return _inflight[key];

    _inflight[key] = _fromCache(key).then(function (hit) {
      if (hit) return hit;
      return _config().then(function (cfg) {
        if (!cfg) { _note('no platform configured — staying silent'); return null; }
        var url = cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN_NAME;
        return fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + cfg.anonKey,
            'apikey': cfg.anonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            characterId: v.characterId,
            voiceId: v.voiceId,
            modelId: v.modelId,
            settings: settings,
            text: spoken
          })
        }).then(function (r) {
          var type = (r.headers.get('Content-Type') || '');
          // The function answers 200 with JSON when it has nothing to
          // say — no voice, no key, the provider unhappy. That is a
          // deliberate shape: a caller that treats "not audio" as
          // silence needs no error handling at all, and a child never
          // meets a status code.
          if (!r.ok || type.indexOf('audio') === -1) {
            return r.text().then(function (t) {
              _note('nothing to play —', String(t).slice(0, 200));
              return null;
            }).catch(function () { return null; });
          }
          return r.blob().then(function (b) { return _toCache(key, b); });
        }).catch(function (e) {
          _note('unreachable —', String(e).slice(0, 200));
          return null;
        });
      });
    }).then(function (out) {
      delete _inflight[key];
      return out;
    }, function () {
      delete _inflight[key];
      return null;
    });

    return _inflight[key];
  }

  // ---------------------------------------------------------------
  // playing
  //
  // ONE voice at a time, always. Two characters talking over each other
  // is the single thing that would make this feel broken rather than
  // alive, so a new line stops whatever is still speaking — the same
  // no-overlap rule js/lumoVoice.js's playSequence() already keeps.

  var _current = null;

  function _stopCurrent() {
    if (!_current) return;
    var a = _current;
    _current = null;
    try { a.pause(); a.currentTime = 0; } catch (e) {}
    // A paused element never fires `ended`, so without this the
    // speak() promise of a stopped line hung until its caller's own
    // timeout — and anything riding on that promise (the host's
    // speaking glow, a narration hold) hung with it. A stopped line
    // resolves NOW, as "not heard".
    try { if (a.__vvSettle) a.__vvSettle(); } catch (e) {}
  }

  /** Stops whatever is speaking, including a recorded line. */
  function stop() {
    _stopCurrent();
    try {
      if (window.LumoVoice && _lastRecorded) window.LumoVoice.stop(_lastRecorded);
    } catch (e) {}
    _lastRecorded = null;
  }

  var _lastRecorded = null;

  function _play(src) {
    return new Promise(function (resolve) {
      _stopCurrent();
      var audio;
      try { audio = new Audio(src); } catch (e) { resolve(false); return; }
      audio.volume = VOLUME;
      _current = audio;
      var done = function (ok) {
        if (_current === audio) _current = null;
        audio.__vvSettle = null;
        resolve(ok);
      };
      // For _stopCurrent: a stopped line settles its promise instead of
      // leaving the caller waiting on an `ended` that cannot come.
      audio.__vvSettle = function () { done(false); };
      audio.addEventListener('ended', function () { done(true); }, { once: true });
      audio.addEventListener('error', function () { done(false); }, { once: true });
      var p;
      try { p = audio.play(); } catch (e) { done(false); return; }
      if (p && typeof p.then === 'function') {
        p.catch(function (e) {
          // Almost always the autoplay policy: speech that was not
          // started by a real gesture. Silence, not an error.
          _note('could not start —', String(e && e.name || e));
          done(false);
        });
      }
    });
  }

  // ---------------------------------------------------------------
  // the contract

  /**
   * Make a character say something.
   *
   *   VihuVoice.speak({ characterId: 'lumo', text: '…' })
   *   VihuVoice.speak({ characterId: 'leafy', text: '…', emotion: 'happy' })
   *   VihuVoice.speak({ characterId: 'lumo', text: '…', recorded: 'riteScreen1' })
   *
   * `emotion` is one of the Companion's own states — happy, sad,
   * curious, celebrate, surprised, sleep, wave — or one of the four
   * registers for characters with no face (neutral, warm, gentle,
   * whisper). It moves the character's own voice rather than replacing
   * it, so a happy Quill still sounds like Quill. Anything unrecognised
   * is neutral, never an error and never a refusal to speak.
   *
   * `recorded` names a line in js/lumoVoice.js. If that recording
   * exists it is played and nothing is generated — a real performance
   * always beats a synthesised one, and it costs nothing. **A recording
   * carries the feeling it was performed with**, so `emotion` is ignored
   * on that path rather than quietly re-generating the line to obtain a
   * different mood; overriding a real performance is exactly what this
   * module exists not to do.
   *
   * Resolves to true if the words were actually heard, false if they
   * were not. Never rejects, never throws, never shows anything.
   *
   * @param {{characterId:string, text:string, emotion?:string, recorded?:string}|string} opts
   * @param {string} [text] when called as speak('lumo', 'hello')
   * @param {string} [emotion] when called as speak('leafy', 'hello', 'happy')
   * @returns {Promise<boolean>}
   */
  function speak(opts, text, emotion) {
    var o = (typeof opts === 'string')
      ? { characterId: opts, text: text, emotion: emotion }
      : (opts || {});
    var who = o.characterId || o.character || o.id;
    var words = String(o.text || '').trim();

    if (!who || !words) return Promise.resolve(false);

    // Recordings win, and they bring their own feeling with them.
    if (o.recorded && window.LumoVoice) {
      try {
        if (window.LumoVoice.durationMs(o.recorded) > 0) {
          _stopCurrent();
          if (_lastRecorded) { try { window.LumoVoice.stop(_lastRecorded); } catch (e) {} }
          _lastRecorded = o.recorded;
          window.LumoVoice.play(o.recorded);
          return Promise.resolve(true);
        }
      } catch (e) {}
    }

    return voiceOf(who).then(function (v) {
      if (!v) return false;                        // no voice chosen yet
      return _generate(v, words, o.emotion).then(function (src) {
        if (!src) return false;
        return _play(src);
      });
    }).catch(function () { return false; });
  }

  /**
   * Prepare a line without speaking it — generate it, cache it, say
   * nothing. Use it a beat before a line is due so the words arrive the
   * instant they are wanted rather than after a round trip. Takes the
   * same `emotion` speak() does, and must be given the SAME one — a
   * line prepared neutral and spoken happy is a different sound, so it
   * is a different cache entry and the preparation buys nothing.
   * @returns {Promise<boolean>} true when the line is ready to play
   */
  function prepare(opts, text, emotion) {
    var o = (typeof opts === 'string')
      ? { characterId: opts, text: text, emotion: emotion }
      : (opts || {});
    var who = o.characterId || o.character || o.id;
    var words = String(o.text || '').trim();
    if (!who || !words) return Promise.resolve(false);
    if (o.recorded && window.LumoVoice) {
      try {
        if (window.LumoVoice.durationMs(o.recorded) > 0) {
          window.LumoVoice.preload(o.recorded);
          return Promise.resolve(true);
        }
      } catch (e) {}
    }
    return voiceOf(who).then(function (v) {
      if (!v) return false;
      return _generate(v, words, o.emotion).then(function (src) { return !!src; });
    }).catch(function () { return false; });
  }

  /**
   * Is there a voice for this character at all? Lets a caller choose a
   * different beat rather than waiting on silence. Story code rarely
   * needs it; the audition page does.
   * @returns {Promise<boolean>}
   */
  function canSpeak(who) {
    return voiceOf(who).then(function (v) { return !!v; }).catch(function () { return false; });
  }

  // Leaving the page mid-sentence should not leave a voice playing over
  // whatever comes next.
  try {
    window.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
    });
  } catch (e) {}

  var VihuVoice = {
    speak: speak,
    prepare: prepare,
    stop: stop,
    canSpeak: canSpeak,
    voiceOf: voiceOf,
    emotions: emotions,
    resolve: resolve,
    audition: audition,
    clearCache: clearCache
  };
  try { window.VihuVoice = VihuVoice; } catch (e) {}
})();
