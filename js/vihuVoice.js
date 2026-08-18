// js/vihuVoice.js — Vihu Voice. The one thing story code calls to make a
// character speak.
//
// ---------------------------------------------------------------
// WHAT A CALLER KNOWS, AND WHAT IT MUST NEVER KNOW
//
//   VihuVoice.speak({ characterId: 'lumo', text: 'Something wonderful is waiting.' });
//
// That is the whole contract. A caller never learns that a speech
// provider exists, never holds a voice id, never builds a request and
// never sees a key. Swapping the provider, retuning a voice or turning
// speech off entirely is a change to this file and to
// assets/registry.json — never to a single line of story code.
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
  var CACHE_NAME = 'vihu-voice-v1';

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
        settings: v.settings || {}
      };
    });
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

  function _generate(v, text) {
    var key = _key(v, text);
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
            settings: v.settings,
            text: text
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
        resolve(ok);
      };
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
   *   VihuVoice.speak({ characterId: 'lumo', text: '…', recorded: 'riteScreen1' })
   *
   * `recorded` names a line in js/lumoVoice.js. If that recording
   * exists it is played and nothing is generated — a real performance
   * always beats a synthesised one, and it costs nothing.
   *
   * Resolves to true if the words were actually heard, false if they
   * were not. Never rejects, never throws, never shows anything.
   *
   * @param {{characterId:string, text:string, recorded?:string}|string} opts
   * @param {string} [text] when called as speak('lumo', 'hello')
   * @returns {Promise<boolean>}
   */
  function speak(opts, text) {
    var o = (typeof opts === 'string') ? { characterId: opts, text: text } : (opts || {});
    var who = o.characterId || o.character || o.id;
    var words = String(o.text || '').trim();

    if (!who || !words) return Promise.resolve(false);

    // Recordings win.
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
      return _generate(v, words).then(function (src) {
        if (!src) return false;
        return _play(src);
      });
    }).catch(function () { return false; });
  }

  /**
   * Prepare a line without speaking it — generate it, cache it, say
   * nothing. Use it a beat before a line is due so the words arrive the
   * instant they are wanted rather than after a round trip.
   * @returns {Promise<boolean>} true when the line is ready to play
   */
  function prepare(opts, text) {
    var o = (typeof opts === 'string') ? { characterId: opts, text: text } : (opts || {});
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
      return _generate(v, words).then(function (src) { return !!src; });
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
    clearCache: clearCache
  };
  try { window.VihuVoice = VihuVoice; } catch (e) {}
})();
