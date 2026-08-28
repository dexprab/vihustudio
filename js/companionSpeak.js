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

  function _platform(text, mine) {
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
      const u = new window.SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.onend = function () { if (mine === _token) _set('idle'); };
      u.onerror = function () { if (mine === _token) _set('idle'); };
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
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

    if (viaVoice && typeof viaVoice.then === 'function') {
      return viaVoice.then(function (spoke) {
        if (mine !== _token) return false;
        if (spoke) { _set('idle'); return true; }
        // The Companion has no voice configured. The browser's own is
        // the fallback rather than nothing at all.
        if (_platform(words, mine)) return true;
        _set('idle');
        return false;
      }).catch(function () {
        if (mine !== _token) return false;
        if (_platform(words, mine)) return true;
        _set('idle');
        return false;
      });
    }
    if (_platform(words, mine)) return Promise.resolve(true);
    _set('idle');
    return Promise.resolve(false);
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
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
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
