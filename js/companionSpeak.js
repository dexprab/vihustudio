// js/companionSpeak.js — the Companion's answer, said out loud.
//
// Sprint 1N.3. Text-to-speech, and it is an ADDITION to the answer on
// screen rather than a replacement for it.
//
// ---------------------------------------------------------------
// THE TEXT IS THE ANSWER. SPEECH IS A SECOND COPY OF IT.
//
// A child must always be able to READ what their Companion said — the
// reply stays on screen whether speech works, fails, is unsupported, or
// is switched off. Nothing here can hide, shorten or alter it.
//
// ---------------------------------------------------------------
// IT CANNOT BYPASS THE PRIVACY LAYER, BY CONSTRUCTION
//
// The pipeline is:
//
//     knowledge → the Mind → privacy → the child-facing reply
//                                          ├── on screen
//                                          └── here
//
// This file is handed the SAME STRING that was put on screen, by the
// surface that put it there. It cannot reach a perception, a context, a
// memory, a card or a record — none of them is referenced anywhere
// below — so there is no route by which something unapproved could be
// spoken. A caller that tried would have to have the text already.
//
// ---------------------------------------------------------------
// THE COMPANION'S OWN VOICE FIRST
//
// js/vihuVoice.js is the product's voice architecture and it is used
// unchanged: a Companion with a configured voice is spoken in it. Where
// there is none — no voice id, no key, no platform, no network — the
// browser's own speech is the fallback, and where there is neither, the
// answer is simply read rather than heard. Talk is never blocked by
// speech being unavailable.
const CompanionSpeak = (function () {
  'use strict';

  let _state = 'idle';      // 'idle' | 'preparing' | 'speaking'
  let _onState = null;
  let _token = 0;

  function _set(s) {
    _state = s;
    if (typeof _onState === 'function') { try { _onState(s); } catch (e) {} }
  }

  function state() { return _state; }
  function isSpeaking() { return _state === 'speaking'; }
  function isPreparing() { return _state === 'preparing'; }
  /** Either — for a caller that only wants to know whether to stop. */
  function isBusy() { return _state !== 'idle'; }
  function onState(fn) { _onState = fn; }

  /** Is there any way at all to say something aloud here? */
  function supported() {
    try {
      if (typeof VihuVoice !== 'undefined' && VihuVoice.speak) return true;
    } catch (e) {}
    try { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); }
    catch (e) { return false; }
  }

  // ---------------------------------------------------------------
  // THE PLATFORM VOICE, AND WHY IT NEEDS THIS MUCH CARE
  //
  // `speechSynthesis.speak()` returns nothing and throws nothing. It is
  // perfectly happy to be handed an utterance and do NOTHING with it,
  // and there are two ordinary ways that happens:
  //
  //   1. THE VOICE LIST IS EMPTY. Chrome loads voices lazily and fires
  //      `voiceschanged` when they arrive. Speaking before that is
  //      silence — measured here: getVoices() returned 0 and say()
  //      still reported success.
  //   2. cancel() WAS CALLED IMMEDIATELY BEFORE. A long-standing Chrome
  //      quirk: cancelling an empty queue and then speaking can leave
  //      the utterance stuck. stop() below now only cancels when there
  //      is something to cancel.
  //
  // So this waits for a voice, then resolves on `onstart` — the only
  // event that means a sound is actually being made. ANYTHING ELSE IS
  // REPORTED AS FALSE, because a speak function that says it spoke when
  // it did not is worse than one that cannot speak at all.
  const VOICE_WAIT_MS = 1200;
  const START_WAIT_MS = 1500;
  // AND A CAP ON THE COMPANION'S OWN VOICE. js/vihuVoice.js bounds its
  // own request now, but this is the floor under it: a `speak()` that
  // never settles leaves `data-speaking` on the mute button lit for
  // ever, and a child looking at a lit speaker with nothing coming out
  // of it has been told something untrue. Comfortably longer than that
  // module's own budget, so it only ever fires if something below it
  // has gone wrong in a way nobody predicted.
  const OWN_VOICE_WAIT_MS = 20000;

  function _voices() {
    try { return window.speechSynthesis.getVoices() || []; } catch (e) { return []; }
  }

  function _voicesReady() {
    return new Promise(function (resolve) {
      if (_voices().length) { resolve(true); return; }
      let done = false;
      const finish = function () {
        if (done) return;
        done = true;
        try { window.speechSynthesis.onvoiceschanged = null; } catch (e) {}
        resolve(_voices().length > 0);
      };
      try { window.speechSynthesis.onvoiceschanged = finish; } catch (e) {}
      setTimeout(finish, VOICE_WAIT_MS);
    });
  }

  function _platform(text, mine, onStart) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    return _voicesReady().then(function (haveVoices) {
      if (mine !== _token) return false;
      // NO VOICE, NO SPEECH, AND SAY SO. Reporting success here is what
      // made this feature look broken rather than unavailable.
      if (!haveVoices) return false;
      return new Promise(function (resolve) {
        let settled = false;
        const done = function (started) {
          if (settled) return;
          settled = true;
          resolve(!!started);
        };
        let u;
        try { u = new window.SpeechSynthesisUtterance(text); }
        catch (e) { done(false); return; }
        u.rate = 0.98;
        // An explicit voice rather than the default: on some platforms
        // the default is not one of the loaded ones and speaks nothing.
        try {
          const list = _voices();
          const pick = list.find(function (v) { return /^en[-_]/i.test(v.lang || ''); }) || list[0];
          if (pick) { u.voice = pick; u.lang = pick.lang || 'en-US'; }
        } catch (e) {}
        u.onstart = function () {
          if (mine === _token && typeof onStart === 'function') { try { onStart(); } catch (e) {} }
          done(true);
        };
        u.onerror = function () { if (mine === _token) _set('idle'); done(false); };
        u.onend = function () { if (mine === _token) _set('idle'); done(true); };
        try { window.speechSynthesis.speak(u); } catch (e) { done(false); return; }
        // IT NEVER STARTED. Not an error a child meets — the answer is
        // on screen and always was — but never reported as success.
        setTimeout(function () {
          if (settled) return;
          let live = false;
          try { live = !!(window.speechSynthesis.speaking || window.speechSynthesis.pending); }
          catch (e) {}
          if (!live && mine === _token) _set('idle');
          done(live);
        }, START_WAIT_MS);
      });
    });
  }

  /**
   * Say the reply that is already on screen.
   *
   * @param {string} text the CHILD-FACING reply, exactly as displayed.
   * @param {string} [companionId] whose voice, for js/vihuVoice.js.
   * @param {object} [hooks] Sprint 1N.6 — the two moments a surface
   *   needs in order to show a rhythm rather than a spinner:
   *     onPreparing()  the line is being fetched and decoded
   *     onSpeaking()   a sound is actually being made
   *   Both are optional and neither changes what is said.
   * @returns {Promise<boolean>} whether anything was actually said.
   *   False is a normal outcome and never an error a child meets.
   */
  /**
   * Get a line READY without saying it, and hand back the way to say it.
   *
   * Sprint 3A.1. `say()` used to be the only door, and it prepared and
   * played in one breath — which is why a surface could not present the
   * words and the sound as one event: by the time it knew a voice
   * existed, the voice was already talking. This splits the two.
   *
   *   ready(text, id).then(play => { showTheWords(); play(); })
   *
   * @returns {Promise<function|null>} a play function, or null when
   *   there is no way to say this — muted upstream, no voice, no
   *   session, unsupported, or the provider had nothing for us. NULL IS
   *   A NORMAL ANSWER and the caller shows the words regardless.
   */
  function ready(text, companionId, hooks) {
    const words = String(text == null ? '' : text).trim();
    if (!words) return Promise.resolve(null);
    stop();
    const mine = ++_token;
    const h = hooks || {};
    const tell = function (fn) {
      if (mine !== _token || typeof fn !== 'function') return;
      try { fn(); } catch (e) {}
    };
    _set('preparing');
    tell(h.onPreparing);

    // THE COMPANION'S OWN VOICE FIRST, and its bytes are fetched here
    // rather than at play time — which is the whole point: when the
    // caller says go, the sound is already in the browser.
    //
    // CONVERSATION AUDIO IS EPHEMERAL (§16). A child's own sentence is
    // never said twice, so caching it would fill a store with private
    // one-shot audio for no hit rate at all — and the sprint forbids
    // persisting it in as many words. `ephemeral` is passed through to
    // js/vihuVoice.js, which skips both caches and tells the function to
    // skip its own.
    const req = { characterId: companionId, text: words, ephemeral: true };
    let own = null;
    try {
      if (companionId && typeof VihuVoice !== 'undefined' && VihuVoice.prepare && VihuVoice.speak) {
        own = VihuVoice.prepare(req);
      }
    } catch (e) { own = null; }

    const platform = function () {
      // THE EXISTING PRODUCT FALLBACK, kept (Decision 48) — AND IT IS
      // READY IMMEDIATELY, which is a decision rather than an oversight.
      //
      // The words are held behind a voice because a GENERATED one is a
      // network round trip worth hiding. `speechSynthesis` is local:
      // there is no fetch to wait out, so holding for it buys nothing.
      //
      // Measured, and it was a real regression: the first version
      // gated this on `_voicesReady()`, which waits up to VOICE_WAIT_MS
      // for Chrome's lazily-loaded voice list — so on any browser with
      // no voices at all (a headless one, and any machine with none
      // installed) every answer was held 1.2 seconds for a voice that
      // was never coming. §35 forbids inventing latency, and that is
      // what it would have been.
      //
      // The wait still happens — inside _platform(), where it belongs —
      // so a browser whose voices arrive late still speaks. It just no
      // longer costs the child their answer.
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve(null);
      return Promise.resolve(function () {
        return _platform(words, mine, function () {
          _set('speaking');
          tell(h.onSpeaking);
        }).then(function (spoke) {
          if (mine !== _token) return false;
          if (!spoke) _set('idle');
          return spoke;
        });
      });
    };

    if (own && typeof own.then === 'function') {
      const bounded = Promise.race([
        own,
        new Promise(function (resolve) { setTimeout(function () { resolve(false); }, OWN_VOICE_WAIT_MS); })
      ]);
      return bounded.then(function (got) {
        if (mine !== _token) return null;
        if (!got) return platform();
        return function () {
          _set('speaking');
          tell(h.onSpeaking);
          return VihuVoice.speak(req).then(function (spoke) {
            if (mine !== _token) return false;
            if (!spoke) _set('idle');
            return !!spoke;
          }, function () { if (mine === _token) _set('idle'); return false; });
        };
      }, function () {
        if (mine !== _token) return null;
        return platform();
      });
    }
    return platform().then(function (p) {
      if (mine !== _token) return null;
      if (!p) _set('idle');
      return p;
    });
  }

  function say(text, companionId, hooks) {
    const words = String(text == null ? '' : text).trim();
    // NOTHING TO SAY IS NOT A FAILURE. Silence and an empty reply are
    // both correct answers, and neither is spoken.
    if (!words) return Promise.resolve(false);
    stop();
    const mine = ++_token;
    const h = hooks || {};
    const tell = function (fn) {
      if (mine !== _token || typeof fn !== 'function') return;
      try { fn(); } catch (e) {}
    };
    // PREPARING IS NOT SPEAKING, and calling it so was the bug this
    // sprint exists to fix. `_set('speaking')` fired here — before a
    // single byte of audio had been fetched — so a surface reading the
    // state could only ever show one long undifferentiated wait.
    _set('preparing');
    tell(h.onPreparing);

    // THE COMPANION'S OWN VOICE, through the existing architecture, and
    // now in TWO steps rather than one.
    //
    // js/vihuVoice.js already separates them: prepare() generates the
    // line and caches it, speak() plays it — and speak() on a prepared
    // line is a cache hit, so the gap between "fetching" and "audible"
    // is real rather than simulated. NOTHING SPECULATIVE IS GENERATED:
    // prepare() is called with the final approved text and never before
    // it exists.
    let viaVoice = null;
    try {
      if (companionId && typeof VihuVoice !== 'undefined' && VihuVoice.speak) {
        if (VihuVoice.prepare) {
          viaVoice = VihuVoice.prepare({ characterId: companionId, text: words })
            .then(function (ready) {
              if (mine !== _token) return false;
              if (!ready) return false;
              _set('speaking');
              tell(h.onSpeaking);
              return VihuVoice.speak({ characterId: companionId, text: words });
            });
        } else {
          _set('speaking');
          tell(h.onSpeaking);
          viaVoice = VihuVoice.speak({ characterId: companionId, text: words });
        }
      }
    } catch (e) { viaVoice = null; }

    const fallback = function () {
      // THE EXISTING PRODUCT FALLBACK, kept. Sprint 1N.6's brief forbids
      // introducing a generic browser voice "unless an existing product
      // fallback already exists" — this one does, it shipped in Sprint
      // 1N.3 and Decision 48 records it, and removing it would take the
      // Companion's voice away from every browser with no configured
      // one. It announces `speaking` at the same moment the generated
      // path does: when a sound actually starts.
      return _platform(words, mine, function () {
        _set('speaking');
        tell(h.onSpeaking);
      }).then(function (spoke) {
        if (mine !== _token) return false;
        if (!spoke) _set('idle');
        return spoke;
      });
    };

    if (viaVoice && typeof viaVoice.then === 'function') {
      const bounded = Promise.race([
        viaVoice,
        new Promise(function (resolve) { setTimeout(function () { resolve(false); }, OWN_VOICE_WAIT_MS); })
      ]);
      return bounded.then(function (spoke) {
        if (mine !== _token) return false;
        if (spoke) { return true; }
        // The Companion has no voice configured, or no session to fetch
        // one with. The browser's own is the fallback rather than
        // nothing at all.
        return fallback();
      }).catch(function () {
        if (mine !== _token) return false;
        return fallback();
      });
    }
    return fallback();
  }

  /**
   * Stop, now. Called when a child asks, when a new answer arrives, and
   * when the conversation closes — a voice must never outlive the
   * surface that produced it, which is the rule js/etherHost.js already
   * follows for the World Host.
   */
  function stop() {
    _token++;
    try { if (typeof VihuVoice !== 'undefined' && VihuVoice.stop) VihuVoice.stop(); } catch (e) {}
    // ONLY CANCEL SOMETHING THAT IS HAPPENING. Cancelling an empty queue
    // and then speaking is a long-standing Chrome quirk that leaves the
    // next utterance stuck — and say() calls stop() first, so this was
    // on the path of every single attempt.
    try {
      if (window.speechSynthesis &&
          (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
    if (_state !== 'idle') _set('idle');
    return true;
  }

  const api = {
    supported: supported,
    ready: ready,
    say: say,
    stop: stop,
    state: state,
    isSpeaking: isSpeaking,
    isPreparing: isPreparing,
    isBusy: isBusy,
    onState: onState
  };
  try { window.CompanionSpeak = api; } catch (e) {}
  return api;
})();
