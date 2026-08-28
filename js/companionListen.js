// js/companionListen.js — the child speaks, and the Companion listens
// ONLY when they ask it to.
//
// Sprint 1N.3. Speech-to-text, and the whole of its design is one rule:
//
//     THE MICROPHONE EXISTS ONLY WHILE A CHILD IS HOLDING IT OPEN.
//
// No wake word. No always-listening. No background monitoring. No
// page-level listener. No automatic recording. There is no timer here,
// no observer, and nothing that runs when the surface is closed —
// `start()` is reachable from exactly one place, a button the child
// pressed, and `stop()` is called by the surface closing, by the child
// cancelling, and by recognition ending on its own.
//
// ---------------------------------------------------------------
// NOTHING IS KEPT
//
// This never touches an audio buffer. The platform's own recogniser
// hands back a string; that string goes into the conversation field and
// nowhere else. There is no recording, no upload, no analytics, no log,
// and no store — and there is nothing in this file to put one in.
//
// ---------------------------------------------------------------
// IT DOES NOT SEND
//
// Recognised words land in the input for the child to READ, change, or
// throw away. A microphone that speaks for a child without showing them
// what it heard is a microphone that occasionally says something they
// did not say, and a five-year-old cannot argue with it. The send is
// still the child's own press, down the identical path a typed sentence
// takes — the Mind cannot tell the two apart, and must not be able to.
//
// ---------------------------------------------------------------
// THE PLATFORM'S OWN RECOGNISER, AND NO PROVIDER
//
// `SpeechRecognition` where a browser has it. No OpenAI, no external
// service, no key, no request. Where the browser has none, this reports
// that it is unsupported and the surface simply never offers a
// microphone — text is, and remains, the whole of the product.
const CompanionListen = (function () {
  'use strict';

  const LANG = 'en-US';

  let _rec = null;
  let _live = false;
  let _denied = false;      // asked once, refused once. Never asked again.
  let _onText = null;
  let _onState = null;

  function _Impl() {
    try {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    } catch (e) { return null; }
  }

  /** Can a child speak to their Companion in this browser at all? */
  function supported() { return !!_Impl(); }

  /** Has permission already been refused once? Then it is never asked again. */
  function refused() { return _denied; }

  function isListening() { return _live; }

  function _say(state, detail) {
    if (typeof _onState === 'function') {
      try { _onState(state, detail || null); } catch (e) {}
    }
  }

  /**
   * Open the microphone. ONLY EVER CALLED FROM A CHILD'S OWN PRESS.
   *
   * @param {object} handlers
   *   `onText(words)`  — what was heard, once, as a string. Never sent.
   *   `onState(state)` — 'listening' | 'stopped' | 'nothing' | 'blocked'
   *                      | 'unsupported'.
   */
  function start(handlers) {
    _onText = handlers && handlers.onText;
    _onState = handlers && handlers.onState;
    const Impl = _Impl();
    if (!Impl) { _say('unsupported'); return false; }
    if (_denied) { _say('blocked'); return false; }
    if (_live) return true;
    let rec;
    try { rec = new Impl(); } catch (e) { _say('unsupported'); return false; }
    rec.lang = LANG;
    // ONE SENTENCE, THEN STOP. `continuous` is what an always-listening
    // microphone is made of, and it is off for that reason rather than
    // for a technical one.
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let heard = '';
    rec.onresult = function (e) {
      try {
        const r = e && e.results && e.results[0];
        const alt = r && r[0];
        heard = String((alt && alt.transcript) || '').trim();
      } catch (err) { heard = ''; }
    };
    rec.onerror = function (e) {
      const err = String((e && e.error) || '');
      // ASKED ONCE. A child who said no is not asked again — the button
      // stands down rather than nagging.
      if (err === 'not-allowed' || err === 'service-not-allowed') _denied = true;
      _live = false; _rec = null;
      _say(_denied ? 'blocked' : 'nothing');
    };
    rec.onend = function () {
      if (!_live) return;            // already reported by onerror
      _live = false; _rec = null;
      if (heard) {
        if (typeof _onText === 'function') { try { _onText(heard); } catch (e) {} }
        _say('stopped', heard);
      } else {
        // NOTHING USABLE IS NOT AN ERROR AND IS NEVER AN EMPTY SEND.
        _say('nothing');
      }
    };
    try { rec.start(); } catch (e) { _say('nothing'); return false; }
    _rec = rec;
    _live = true;
    _say('listening');
    return true;
  }

  /**
   * Shut it. Called by the child cancelling, and by the conversation
   * closing — a microphone must never outlive the surface that opened
   * it.
   */
  function stop() {
    const rec = _rec;
    _rec = null;
    if (!_live) return false;
    _live = false;
    try { if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.stop(); } }
    catch (e) {}
    try { if (rec && rec.abort) rec.abort(); } catch (e) {}
    _say('stopped');
    return true;
  }

  const api = {
    LANG: LANG,
    supported: supported,
    refused: refused,
    isListening: isListening,
    start: start,
    stop: stop,
    // For a suite: the same refusal a real denial produces, without a
    // browser prompt. Never called by the product.
    _denyForTest: function () { _denied = true; }
  };
  try { window.CompanionListen = api; } catch (e) {}
  return api;
})();
