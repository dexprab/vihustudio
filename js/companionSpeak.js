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

  let _state = 'idle';      // 'idle' | 'speaking'
  let _onState = null;
  let _token = 0;

  function _set(s) {
    _state = s;
    if (typeof _onState === 'function') { try { _onState(s); } catch (e) {} }
  }

  function state() { return _state; }
  function isSpeaking() { return _state === 'speaking'; }
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

  function _platform(text, mine) {
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
        u.onstart = function () { done(true); };
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
   * @returns {Promise<boolean>} whether anything was actually said.
   *   False is a normal outcome and never an error a child meets.
   */
  function say(text, companionId) {
    const words = String(text == null ? '' : text).trim();
    // NOTHING TO SAY IS NOT A FAILURE. Silence and an empty reply are
    // both correct answers, and neither is spoken.
    if (!words) return Promise.resolve(false);
    stop();
    const mine = ++_token;
    _set('speaking');

    // THE COMPANION'S OWN VOICE, through the existing architecture. It
    // resolves the voice from assets/registry.json and answers silently
    // when there is none — which is a normal state, not a fault.
    let viaVoice = null;
    try {
      if (companionId && typeof VihuVoice !== 'undefined' && VihuVoice.speak) {
        viaVoice = VihuVoice.speak({ characterId: companionId, text: words });
      }
    } catch (e) { viaVoice = null; }

    const fallback = function () {
      return _platform(words, mine).then(function (spoke) {
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
    say: say,
    stop: stop,
    state: state,
    isSpeaking: isSpeaking,
    onState: onState
  };
  try { window.CompanionSpeak = api; } catch (e) {}
  return api;
})();
