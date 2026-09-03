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
// TEXT AND VOICE ARE ONE EVENT — Sprint 3A.1.
//
// This machine originally let the surface paint the answer the moment it
// existed and fetch its voice afterwards, and Decision 50 recorded that
// as a virtue: "a voice that fails never erases an answer". The first
// real model turn showed what it costs in practice — the words appeared,
// then two to three seconds of nothing, then Leo spoke. A child does not
// read that as a fast answer with a slow voice; they read it as their
// Companion writing something and refusing to say it.
//
// So the answer is now HELD behind its own voice, and the hold is
// bounded. `voice-preparing` moved to BEFORE the reveal, and it carries
// its own bell — HOLD_MS — after which the text is shown whatever the
// audio is doing. The accessibility half of Decision 50 is unchanged and
// is now the fallback rather than the rule: no voice, muted, unsupported,
// failed or simply slow, and the words go up.
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
  // HOLD_MS      How long the words may be held waiting for their own
  //              voice. It is the ONE number in this sprint that trades
  //              synchronisation against silence, so it is written down
  //              rather than spread across the surfaces: under it, text
  //              and sound arrive together; over it, the child gets
  //              their answer and the voice joins late. 2500 is chosen
  //              to sit above a healthy generated line and below the
  //              point at which a blank panel stops reading as a
  //              Companion drawing breath. It is deliberately NOT
  //              VOICE_PREPARE_MS: that one is when to give up on the
  //              sound, this one is when to stop making the child wait
  //              for it, and conflating them would mean either
  //              revealing too early or holding for six seconds.
  const T = {
    THINK_AFTER_MS: 180,
    MIN_THINK_MS: 420,
    ANSWER_MS: 12000,
    HOLD_MS: 2500,
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
    // ---- TIMING, AND ONLY TIMING — Sprint 3A.1 §8.
    //
    // Seven moments in one turn, so where the wait actually goes is
    // measured rather than guessed at. NOT ONE OF THEM HOLDS A WORD OF
    // WHAT WAS SAID: no question, no answer, no reply length, no
    // Companion, no card. A marks() object is numbers and nothing else,
    // it is never persisted, never sent anywhere and dies with the turn.
    const marks = {};
    function mark(name, at) {
      if (marks[name] == null) marks[name] = (at == null ? Date.now() : at);
    }

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
       * The seven moments, as milliseconds since this turn began, plus
       * the segments the brief asks to be reported. Numbers only.
       * @returns {object}
       */
      marks: function () {
        const t0 = marks.t0 || 0;
        const rel = {};
        Object.keys(marks).forEach(function (k) { rel[k] = marks[k] - t0; });
        const seg = {};
        if (marks.answer)     seg.toAnswer = marks.answer - t0;
        if (marks.voiceReady && marks.answer) seg.answerToVoice = marks.voiceReady - marks.answer;
        if (marks.speaking && marks.voiceReady) seg.voiceToSound = marks.speaking - marks.voiceReady;
        if (marks.speaking && marks.shown)     seg.textToSound = marks.speaking - marks.shown;
        if (marks.speaking)   seg.total = marks.speaking - t0;
        else if (marks.shown) seg.total = marks.shown - t0;
        return { at: rel, segments: seg };
      },

      /**
       * The child pressed. THEIR WORDS GO UP IN THE SAME FRAME — being
       * heard is not something to wait for — and only then does the
       * machine start deciding whether this is going to take a moment.
       */
      send: function () {
        if (!alive) return;
        clearAll();
        mark('t0');
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
        mark('answer');
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
        mark('shown');
        to('response-ready');
      },

      /**
       * The answer is on screen and its voice is being fetched. A
       * SEPARATE STATE ON PURPOSE: a child who has read the answer is
       * not waiting to find out what it is, and calling that "thinking"
       * would tell them their Companion had not decided yet.
       */
      /**
       * The answer EXISTS and its voice is being fetched — and as of
       * Sprint 3A.1 the child has not read it yet, because text and
       * voice are one event.
       *
       * A SEPARATE STATE ON PURPOSE, and now for a second reason. It was
       * always wrong to call a finished thought "thinking"; it is also
       * the state the child spends the whole synchronising wait in, so
       * it is what the docker has to be able to describe.
       *
       * @param {function} [onHold] rings at HOLD_MS — "show the words
       *   now, whatever the sound is doing". The accessibility exception
       *   with teeth: without it, a slow voice would hold an answer the
       *   child already has a right to.
       */
      preparingVoice: function (onHold) {
        if (!alive) return;
        mark('voiceStart');
        clear('voice');
        clear('hold');
        to('voice-preparing');
        if (typeof onHold === 'function') {
          timers.hold = setTimeout(function () {
            clear('hold');
            try { onHold(); } catch (e) {}
          }, T.HOLD_MS);
        }
        timers.voice = setTimeout(function () { giveUp('voice'); }, T.VOICE_PREPARE_MS);
      },

      /**
       * The audio is in hand and has not been played yet. The surface
       * reveals the words and starts the sound off the back of this, so
       * the two are the same task rather than two decisions that could
       * drift apart.
       */
      voiceReady: function () {
        if (!alive) return;
        mark('voiceReady');
        clear('hold');
        // R5 — THE PREPARE BELL'S JOB IS DONE. The audio is in hand;
        // leaving this timer running meant it could ring during the
        // reveal beat — between ready and the first actual sound — and
        // the surface's give-up handler would stop a voice that was a
        // frame away from playing. Measured as one of the ways a
        // Companion "stopped speaking unexpectedly".
        clear('voice');
      },

      /** A sound is actually being made. */
      speakingNow: function () {
        if (!alive) return;
        mark('speaking');
        clear('voice');
        clear('hold');
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
