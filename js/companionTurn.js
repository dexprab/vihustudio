// js/companionTurn.js — the rhythm of one turn.
//
// Sprint 1N.6. What a child sees between saying something and hearing
// an answer. It adds no intelligence, reads no context and composes no
// sentence: it decides only WHICH OF SIX THINGS IS TRUE right now.
//
// ---------------------------------------------------------------
// ONE MACHINE, EVERY SURFACE.
//
// The Studio had four states of its own and the Ether had none, so a
// Traveller's conversation had no rhythm at all — and Decision 48 is
// explicit that the difference between the two relationships is what
// may be SEEN, never the quality of the conversation. Both surfaces
// drive this, so a rhythm cannot be fixed on one and left broken on the
// other.
//
// ---------------------------------------------------------------
// IT NEVER ADDS LATENCY, AND IT NEVER SHOWS A FLASH.
//
// Two opposite failures, and the thresholds between them are MEASURED
// rather than chosen:
//
//   · a deterministic answer arrives in 0.2-7.5ms in the real Studio,
//     and a round trip to the stub server in 17.5ms. Putting a
//     "thinking" animation in front of any of those would be inventing
//     a wait that does not exist, so nothing is shown until
//     THINK_AFTER_MS.
//   · and once it IS shown, it stays for MIN_THINK_MS, because an
//     indicator that appears and vanishes inside two frames reads as a
//     glitch rather than as thought.
//
// ---------------------------------------------------------------
// AND NO STATE LASTS FOR EVER.
//
// Every waiting state carries its own bell. "Thinking" that never ends
// is the failure this sprint exists to remove, and "preparing to speak"
// that never ends is the same failure wearing a different word.
const CompanionTurn = (function () {
  'use strict';

  // The six a child can be in, plus the two ends.
  const STATES = ['idle', 'sending', 'received', 'thinking', 'response-ready',
                  'voice-preparing', 'speaking', 'recovery'];

  // ---------------------------------------------------------------
  // THE THRESHOLDS, AND WHERE EACH NUMBER CAME FROM.
  //
  // THINK_AFTER_MS  Measured in the running Studio at build 0695: local
  //                 answers 0.2ms, 1ms, 4.5ms, 7.5ms; a stub-server
  //                 round trip 17.5ms. 180 clears the slowest of those
  //                 by an order of magnitude, so an answer this product
  //                 can give instantly is never dressed as deliberation.
  //                 A real network turn (100-400ms) crosses it and is
  //                 shown, which is the case the indicator is for.
  // MIN_THINK_MS    Only ever applied to something already on screen —
  //                 it delays no answer, it only stops the dots from
  //                 flashing. The text is rendered the moment it exists.
  // ANSWER_MS       The same budget js/companionChat.js gives the ask,
  //                 so the machine and the request cannot disagree about
  //                 when to give up.
  // VOICE_PREPARE_MS  A generated line is a fetch and a decode. Not
  //                 measurable from this environment — the network
  //                 policy refuses the provider — so it is stated as a
  //                 choice rather than a measurement, and it is
  //                 deliberately shorter than the answer budget because
  //                 the child ALREADY HAS THEIR ANSWER by then. Missing
  //                 the sound of it costs nothing; waiting for it does.
  // SPEAK_MS        A ceiling on the sound itself, so a stalled audio
  //                 element cannot hold the turn open.
  const T = {
    THINK_AFTER_MS: 180,
    MIN_THINK_MS: 420,
    ANSWER_MS: 12000,
    VOICE_PREPARE_MS: 6000,
    SPEAK_MS: 30000
  };

  /**
   * One turn.
   *
   * @param {object} hooks
   *   onState(state, meta)  every transition, for the surface to paint.
   *   onGiveUp(kind)        'answer' | 'voice' | 'speech' — the bell rang.
   * @returns {object} a controller
   */
  function create(hooks) {
    const h = hooks || {};
    let state = 'idle';
    let alive = true;
    let thinkingShownAt = 0;
    const timers = {};

    function clear(name) {
      if (timers[name]) { clearTimeout(timers[name]); timers[name] = null; }
    }
    function clearAll() { Object.keys(timers).forEach(clear); }

    function to(next, meta) {
      if (!alive) return state;
      if (STATES.indexOf(next) === -1) return state;
      if (next === state) return state;
      state = next;
      if (next === 'thinking') thinkingShownAt = Date.now();
      try { if (typeof h.onState === 'function') h.onState(next, meta || null); } catch (e) {}
      return state;
    }

    function giveUp(kind) {
      clearAll();
      try { if (typeof h.onGiveUp === 'function') h.onGiveUp(kind); } catch (e) {}
    }

    return {
      state: function () { return state; },
      thresholds: function () { return Object.assign({}, T); },

      /**
       * The child pressed. THEIR WORDS GO UP IN THE SAME FRAME — being
       * heard is not something to wait for — and only then does the
       * machine start deciding whether this is going to take a moment.
       */
      send: function () {
        if (!alive) return;
        clearAll();
        to('sending');
        to('received');
        // NOTHING IS SHOWN YET. If the answer beats this, the child
        // never sees a thinking state at all, which for a deterministic
        // answer is the truth.
        timers.think = setTimeout(function () { to('thinking'); }, T.THINK_AFTER_MS);
        timers.answer = setTimeout(function () { giveUp('answer'); }, T.ANSWER_MS);
      },

      /**
       * The words EXIST. Stop the clocks, and say how long the dots
       * should still be held for.
       *
       * IT DOES NOT MOVE TO `response-ready`, and that distinction was
       * a real bug. The state name has to mean what it says: the words
       * existing and the words being ON SCREEN are up to 320ms apart
       * (Decision 47's acknowledgement beat), and transitioning here
       * meant the field re-enabled while the panel was still blank —
       * measured at 40ms in, with the answer arriving at 320. A caller
       * that reads "response-ready" and then reads the answer would get
       * an empty string, which is exactly what happened to
       * tools/companion-enable-test.
       *
       * The surface calls shown() when it actually paints.
       *
       * @returns {number} ms the thinking indicator should still be
       *   held for. Zero unless it was actually on screen.
       */
      answered: function () {
        if (!alive) return 0;
        clear('think');
        clear('answer');
        let hold = 0;
        if (state === 'thinking') {
          const shown = Date.now() - thinkingShownAt;
          hold = Math.max(0, T.MIN_THINK_MS - shown);
        }
        return hold;
      },

      /** The words are on screen. NOW it is response-ready. */
      shown: function () {
        if (!alive) return;
        to('response-ready');
      },

      /**
       * The answer is on screen and its voice is being fetched. A
       * SEPARATE STATE ON PURPOSE: a child who has read the answer is
       * not waiting to find out what it is, and calling that "thinking"
       * would tell them their Companion had not decided yet.
       */
      preparingVoice: function () {
        if (!alive) return;
        clear('voice');
        to('voice-preparing');
        timers.voice = setTimeout(function () { giveUp('voice'); }, T.VOICE_PREPARE_MS);
      },

      /** A sound is actually being made. */
      speakingNow: function () {
        if (!alive) return;
        clear('voice');
        to('speaking');
        timers.speech = setTimeout(function () { giveUp('speech'); }, T.SPEAK_MS);
      },

      /** The turn is over, however it ended. */
      done: function (meta) {
        if (!alive) return;
        clearAll();
        to('idle', meta || null);
      },

      /** Something went wrong and the child is being told so. */
      failed: function () {
        if (!alive) return;
        clearAll();
        to('recovery');
      },

      /**
       * The surface closed, or a new turn replaced this one. Nothing
       * fires afterwards — a bell from an abandoned turn arriving in the
       * middle of the next one is the duplicate this must not have.
       */
      cancel: function () {
        clearAll();
        alive = false;
        state = 'idle';
      }
    };
  }

  const api = { STATES: STATES, THRESHOLDS: T, create: create };
  try { window.CompanionTurn = api; } catch (e) {}
  return api;
})();
