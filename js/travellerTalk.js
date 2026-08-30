// js/travellerTalk.js — a Traveller deliberately speaks to a Companion.
//
// Sprint 1M. The Ether is the public meeting place, and this is the one
// thing a Traveller can do there beyond reading: choose to say hello to
// whoever lives in the Story they opened.
//
// ---------------------------------------------------------------
// IT IS NOT INTELLIGENCE AND DOES NOT PRETEND TO BE
//
// There is no model here, no provider, no network call and nothing that
// could become one. What this recognises is a small closed set of
// interaction classes, and anything outside that set gets a gentle,
// honest "I'm not sure what you mean" — never a guess dressed as an
// answer. A Companion that improvises around a question it did not
// understand is the exact failure this layer exists to avoid before
// Step 3 arrives.
//
// The provider boundary is kept clean on purpose: reply() takes an
// approved public context and a sentence and returns text. A later
// model-backed version replaces the body of one function and changes
// nothing about the privacy boundary, the Traveller isolation, the
// public-context authority, the memory rules or the UI intent.
//
// ---------------------------------------------------------------
// WHAT IT MAY NEVER DO
//
//   · write a memory. CompanionMemory is not reachable from this file
//     and `remember` does not appear in it.
//   · create a Bond Moment. Those belong to Creator ↔ Companion, and
//     the validator is not called, imported or mentioned.
//   · persist anything. The turns live in a variable while the surface
//     is open and go when it closes.
//   · say anything about the Creator. Every Companion's own
//     specification already says a host "never says anything about its
//     own Creator", so refusing is character-correct as well as safe.
const TravellerTalk = (function () {
  'use strict';

  const MAX_CHARS = 200;
  const MAX_TURNS = 12;   // a bound, not a feature — nothing is stored

  // ---------------------------------------------------------------
  // ONE MIND, TWO RELATIONSHIPS
  //
  // Sprint 1N. The interaction classes, the character table and the
  // answers all used to live here, and a second copy of them arrived
  // the moment the Studio needed the same thing for a Creator. Two
  // classifiers is two things that can disagree about what a sentence
  // means, so there is one: js/companionMind.js, which takes a mode.
  //
  // EVERY SENTENCE THE OLD IMPLEMENTATION HAD A RULE FOR IS UNCHANGED.
  // Measured against a vendored copy of this file as it stood before
  // (tools/companion-mind-test/travellerTalk.pre-1N.js): 744
  // comparisons — six Companions × two story shapes × two voice states
  // × thirty-one sentences — and zero differences.
  //
  // A WIDER CORPUS FINDS THREE PLACES IT NOW ANSWERS DIFFERENTLY, and
  // in all three the OLD one was wrong: "what are you doing?" was
  // answered "I'm a Bloomling" because the species pattern did not stop
  // at the verb; "how long have we been friends?" was answered with the
  // Story's page count because a bare `how long` sat in the story
  // rules; and a request to leave VihuPlanet got "I don't know",
  // because there was no rule for one at all.
  //
  // WHAT DID NOT MOVE IS THE AUTHORITY. approve() below is still
  // js/travellerContext.js's own whitelist, and it still runs here,
  // first, before the Mind sees anything. The Mind is handed an
  // APPROVED public context or it is handed nothing — it never reads a
  // Story record, and this file never hands it one.
  //
  // Creator memory is not reachable from either file, and the Mind
  // cannot write a memory from any mode.

  /**
   * Which of the closed set of classes this sentence belongs to.
   * 'unknown' is a real answer and the common one.
   * @returns {string}
   */
  function classify(said) {
    if (typeof CompanionMind === 'undefined') return 'unknown';
    return CompanionMind.classify(said, 'traveller');
  }

  /**
   * The Companion's answer.
   *
   * @param {string} said what the Traveller typed
   * @param {object} ctx an APPROVED public context from
   *   js/travellerContext.js. Anything else is refused — this function
   *   never reads a raw Story record, so no caller can hand it one it
   *   assembled itself.
   * @returns {{text:string, intent:string}}
   */
  function reply(said, ctx) {
    try {
      const approved = (typeof TravellerContext !== 'undefined')
        ? TravellerContext.approve(ctx) : null;
      // NO CONTEXT, NO CONVERSATION. Failing closed: with the gate
      // missing or the context unapproved the Companion is simply
      // quiet, which is always safe. The same is true of the Mind
      // itself being absent — a Traveller meets silence, never an
      // improvisation.
      if (!approved) return { text: '', intent: 'no-context' };
      if (typeof CompanionMind === 'undefined') return { text: '', intent: 'no-context' };
      // THE SAME CONVERSATION A CREATOR GETS — the product owner's
      // rule: "the intelligence level in ether and studio is same. the
      // only difference is personal identifiers which are limited till
      // studio only."
      //
      // So the Ether runs the identical layer the Studio does, with the
      // identical order: the Mind gets first refusal (its own
      // TRAVELLER taxonomy, which refuses more than the Creator one),
      // and only a turn it called `unknown` reaches the conversation.
      // The knowledge boundary is untouched — it lives in the approved
      // context above, and this layer never reads a record, a card, a
      // memory or a name.
      if (typeof CompanionConversation !== 'undefined' && CompanionConversation.consider) {
        try {
          const conv = CompanionConversation.consider(said, approved);
          if (conv && conv.reply) {
            CompanionConversation.observe(said, conv.reply);
            return { text: conv.reply, intent: 'conversation', strategy: conv.strategy };
          }
        } catch (e) {}
      }
      const a = CompanionMind.answer(said, approved);
      try {
        if (typeof CompanionConversation !== 'undefined') {
          // THE MIND'S OWN DIAGNOSTICS TRAVEL WITH THE TURN. `certainty`
          // is what says a refusal happened, so the conversation layer
          // can hold the line through a bare follow-up without keeping a
          // second list of which answers were refusals.
          CompanionConversation.observe(said, a.reply,
            { intent: a.intent, certainty: a.certainty });
        }
      } catch (e) {}
      return { text: a.reply, intent: a.intent };
    } catch (e) {
      return { text: '', intent: 'no-context' };
    }
  }

  // ---------------------------------------------------------------
  // THE ENCOUNTER SURFACE
  //
  // NOT the Studio's chat pill. A Traveller is meeting somebody, not
  // opening an application: one small button beside the host that says
  // who it is, and a single line to speak into. It lives in the
  // portal's own foot band, which the attention hierarchy already
  // reserves — so it cannot overlap the page, the arrows, the close
  // control, the title or the count, because they are different rows of
  // the same flex column.
  //
  // Nothing here listens globally, nothing polls, nothing has a timer,
  // and there is no microphone. The Traveller opens it deliberately or
  // it does not exist.
  let _els = null, _open = false, _ctx = null;
  let _turns = [];        // in memory, while open, and nowhere else

  function _root() {
    try { return document.querySelector('.ether-portal-foot'); } catch (e) { return null; }
  }

  function _build() {
    if (_els) return _els;
    const host = _root();
    if (!host) return null;

    const opener = document.createElement('button');
    opener.type = 'button';
    opener.className = 'ether-talk-open';
    opener.hidden = true;

    const bar = document.createElement('div');
    bar.className = 'ether-talk';
    bar.hidden = true;

    const said = document.createElement('p');
    said.className = 'ether-talk-said';
    // The Companion's answer is the one part of this that is content.
    // Polite, never assertive: a Companion does not interrupt.
    said.setAttribute('role', 'status');
    said.setAttribute('aria-live', 'polite');

    // THINGS A TRAVELLER COULD SAY — Sprint 1N.3.
    //
    // The same shape the Studio's own conversation uses, and the same
    // rule: every one of them has a real answer here, and NOT ONE of
    // them is a private question. There is no suggestion about
    // memories, about stars, about an address, or about what somebody
    // told their Companion — a suggestion is an invitation, and this
    // product does not invite a stranger to ask those.
    const starters = document.createElement('div');
    starters.className = 'ether-talk-starters';
    starters.hidden = true;

    const form = document.createElement('form');
    form.className = 'ether-talk-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ether-talk-input';
    input.maxLength = MAX_CHARS;
    input.autocomplete = 'off';

    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'ether-talk-send';
    send.textContent = 'Say it';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ether-talk-close';
    close.setAttribute('aria-label', 'Close');
    close.title = 'Close';
    close.textContent = '✕';

    // ---------------------------------------------------------------
    // HEARD AND SPOKEN TO, IN THE ETHER TOO — Sprint 1N.5.
    //
    // Reported by the product owner: the Ether encounter had a field
    // and a Say it and nothing else, while the Studio had a microphone
    // and a mute. Voice in and voice out are SURFACE-INDEPENDENT — a
    // child who talks to their own Companion and a Traveller who meets
    // somebody else's are doing the same thing, and only what may be
    // SEEN differs between them (Decision 48).
    //
    // The same two modules the Studio uses, unchanged and unwrapped:
    // js/companionListen.js for the microphone and js/companionSpeak.js
    // for the answer. Nothing is duplicated and no second voice
    // architecture exists.
    const mic = document.createElement('button');
    mic.type = 'button';
    mic.className = 'ether-talk-mic';
    mic.textContent = '🎤';
    // A MICROPHONE THAT IS NOT THERE IS NOT AN ERROR. Where the browser
    // has no speech recognition the button simply never appears, and
    // typing is the whole of it.
    mic.hidden = !(typeof CompanionListen !== 'undefined' && CompanionListen.supported());

    const speak = document.createElement('button');
    speak.type = 'button';
    speak.className = 'ether-talk-speak';
    speak.hidden = !(typeof CompanionSpeak !== 'undefined' && CompanionSpeak.supported());

    // THE COMPANION IS THINKING — Sprint 1N.6. Three dots, and they
    // appear only when the answer is genuinely slow enough to need
    // them; js/companionTurn.js owns that decision and the Studio shows
    // exactly the same thing at exactly the same moment.
    //
    // NOT ANNOUNCED. `aria-hidden` because a screen reader must not
    // read out an animation — the ANSWER is announced, on the line
    // below, which already carries role=status.
    const dots = document.createElement('p');
    dots.className = 'ether-talk-dots';
    dots.setAttribute('aria-hidden', 'true');
    dots.hidden = true;
    // AND A WORD FOR IT — Sprint 3A.1. Thinking and getting ready to
    // speak are different things to be told, and the dots cannot say
    // which. Still aria-hidden: it is a state indicator, not the answer.
    const wait = document.createElement('em');
    wait.className = 'ether-talk-wait';
    dots.appendChild(wait);
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));

    // What was heard, and what could not be. Its own line, polite, and
    // empty when there is nothing to say.
    const heard = document.createElement('p');
    heard.className = 'ether-talk-heard';
    heard.setAttribute('role', 'status');
    heard.setAttribute('aria-live', 'polite');
    heard.hidden = true;

    form.appendChild(input); form.appendChild(send);
    form.appendChild(mic); form.appendChild(speak); form.appendChild(close);
    bar.appendChild(starters);
    bar.appendChild(dots);
    bar.appendChild(said); bar.appendChild(heard); bar.appendChild(form);
    host.appendChild(opener); host.appendChild(bar);

    opener.addEventListener('click', function () { open(); });
    close.addEventListener('click', function () { hide(); });
    mic.addEventListener('click', function () { _mic(); });
    speak.addEventListener('click', function () {
      const on = !_voiceOn();
      _setVoiceOn(on);
      // MUTING STOPS WHAT IS BEING SAID. "Stop talking" and "be quiet"
      // are the same thought to whoever pressed it.
      if (!on) _aloudStop();
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); _send(); });
    // Escape closes, and only while the surface is open — no global
    // key handling, and the portal's own Escape still works when it is
    // not.
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
    });

    _els = { opener: opener, bar: bar, said: said, form: form, input: input,
             send: send, close: close, starters: starters,
             mic: mic, speak: speak, heard: heard, dots: dots, wait: wait };
    _paintVoiceButton();
    _micState('stopped');
    return _els;
  }

  /**
   * A Story has been opened and its host resolved. Offers the way in —
   * it does not open anything.
   * @param {object} story the record js/etherFeed.js produced
   * @param {object} host  {id,name,species} from js/storyHost.js
   */
  function offer(story, host) {
    const els = _build();
    if (!els) return;
    _ctx = (typeof TravellerContext !== 'undefined')
      ? TravellerContext.build(story, host) : null;
    _turns = [];
    if (!_ctx || !_ctx.companionName) { withdraw(); return; }
    els.opener.textContent = 'Talk to ' + _ctx.companionName;
    els.opener.hidden = false;
    els.bar.hidden = true;
    _open = false;
  }

  /** The Story closed. Everything goes. */
  function withdraw() {
    // THE PORTAL CLOSED. A voice must never outlive the Story it lives
    // in, and a microphone must never outlive the moment somebody
    // opened it.
    _aloudStop();
    try { if (typeof CompanionListen !== 'undefined') CompanionListen.stop(); } catch (e) {}
    // NO BELL FROM AN ABANDONED TURN.
    if (_turn) { _turn.cancel(); _turn = null; }
    _busy = false;
    // A TRAVELLER KEEPS NOTHING. The conversation goes when the
    // encounter does, exactly as the turns do.
    try {
      if (typeof CompanionConversation !== 'undefined') CompanionConversation.reset();
    } catch (e) {}
    const els = _els;
    _ctx = null;
    _turns = [];
    _open = false;
    if (!els) return;
    els.opener.hidden = true;
    els.bar.hidden = true;
    els.said.textContent = '';
    els.input.value = '';
  }

  // Four, and every one of them answerable from the public context this
  // encounter actually has. A suggestion the Companion would meet with
  // "that's not mine to tell" would be teaching a child to ask.
  function _starters() {
    const list = ['Who are you?', 'What is this place?'];
    if (_ctx && _ctx.creatorName) list.push('Whose story is this?');
    if (_ctx && _ctx.storyTitle) list.push('What is this story?');
    return list.slice(0, 4);
  }

  function _renderStarters() {
    if (!_els || !_els.starters) return;
    const show = _turns.length === 0;
    _els.starters.hidden = !show;
    _els.starters.innerHTML = '';
    if (!show) return;
    const lead = document.createElement('p');
    lead.className = 'ether-talk-starters-lead';
    lead.textContent = 'Try asking ' + ((_ctx && _ctx.companionName) || 'them') + '…';
    _els.starters.appendChild(lead);
    const row = document.createElement('div');
    row.className = 'ether-talk-starter-row';
    _starters().forEach(function (text) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ether-talk-starter';
      b.textContent = text;
      // FILLS THE FIELD; NEVER SENDS. The Traveller still chooses.
      b.addEventListener('click', function () {
        _els.input.value = text;
        try { _els.input.focus(); } catch (e) {}
      });
      row.appendChild(b);
    });
    _els.starters.appendChild(row);
  }

  // ---------------------------------------------------------------
  // THE MICROPHONE
  //
  // Exactly the Studio's rules, because they are the Companion's rather
  // than the Studio's: no wake word, no background listening, no page
  // listener, no timer, and it exists only while somebody is holding it
  // open. Raw audio is never touched — js/companionListen.js has no
  // recorder, no blob and no store, and this file cannot reach one.
  //
  // AND WHAT IS HEARD LANDS IN THE FIELD, NEVER IN A SEND. A microphone
  // that speaks for somebody without showing them what it heard will
  // occasionally say something they did not say.
  function _micState(state) {
    if (!_els) return;
    const on = (state === 'listening');
    _els.bar.setAttribute('data-mic', on ? 'on' : 'off');
    if (_els.mic) {
      _els.mic.setAttribute('aria-pressed', on ? 'true' : 'false');
      _els.mic.textContent = on ? '⏹' : '🎤';
      _els.mic.title = on ? 'Stop listening' : 'Talk out loud';
      _els.mic.setAttribute('aria-label', on ? 'Stop listening' : 'Talk out loud');
    }
    const heard = _els.heard;
    if (!heard) return;
    if (state === 'listening') { heard.textContent = 'Listening…'; heard.hidden = false; return; }
    if (state === 'nothing') {
      heard.textContent = "I didn't hear that. Try again?";
      heard.hidden = false; return;
    }
    if (state === 'blocked') {
      // ASKED ONCE, REFUSED ONCE, NEVER ASKED AGAIN. No browser error
      // text, and the encounter carries on exactly as it was.
      heard.textContent = "I can't hear you right now. You can type instead.";
      heard.hidden = false;
      if (_els.mic) _els.mic.hidden = true;
      return;
    }
    heard.textContent = '';
    heard.hidden = true;
  }

  function _mic() {
    if (typeof CompanionListen === 'undefined') return;
    if (CompanionListen.isListening()) { CompanionListen.stop(); _micState('stopped'); return; }
    // A TRAVELLER'S OWN VOICE STOPS THE COMPANION'S. Two of them at
    // once is the one thing this must not do.
    _aloudStop();
    CompanionListen.start({
      onText: function (words) {
        if (!_els) return;
        _els.input.value = words;
        try { _els.input.focus(); } catch (e) {}
        try { _els.input.setSelectionRange(words.length, words.length); } catch (e) {}
      },
      onState: function (state) { _micState(state); }
    });
  }

  // ---------------------------------------------------------------
  // SAID OUT LOUD
  //
  // ONE SETTING, BOTH SURFACES. The same localStorage key the Studio
  // writes, because it is about the room somebody is sitting in rather
  // than about who they are — a Traveller who muted their Companion in
  // the Studio has not asked to be shouted at in the Ether.
  const VOICE_KEY = 'vihu.companion.voice';

  function _voiceOn() {
    try { return localStorage.getItem(VOICE_KEY) !== 'off'; }
    catch (e) { return true; }
  }
  function _setVoiceOn(on) {
    try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch (e) {}
    _paintVoiceButton();
  }
  function _paintVoiceButton() {
    if (!_els || !_els.speak) return;
    const on = _voiceOn();
    _els.speak.textContent = on ? '🔊' : '🔇';
    _els.speak.title = on ? 'Mute' : 'Let me be heard';
    _els.speak.setAttribute('aria-label', on ? 'Mute the Companion' : 'Unmute the Companion');
    _els.speak.setAttribute('aria-pressed', on ? 'false' : 'true');
  }

  /**
   * Say the answer that is already on screen — in the HOST Companion's
   * own voice, which is the whole point: a Traveller is meeting
   * somebody who lives here, and `companionId` travels with the Story
   * (Decision 24). Never anything but the string the screen shows, so
   * there is no second copy that could differ from what the public
   * context approved.
   */
  function _aloud(turn) {
    if (typeof CompanionSpeak === 'undefined' || !_els) return;
    if (!_voiceOn()) return;
    const shown = (_els.said.textContent || '').trim();
    if (!shown) return;
    const who = _ctx ? _ctx.companionId : null;
    if (_els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    // FETCHING A LINE AND SAYING IT ARE DIFFERENT THINGS, and a child
    // who has read the answer is only waiting for the second.
    const mine = (turn && turn === _turn) ? turn : null;
    if (mine) mine.preparingVoice();
    CompanionSpeak.say(shown, who, {
      onSpeaking: function () { if (mine && mine === _turn) mine.speakingNow(); }
    }).then(function () {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      if (mine && mine === _turn) { mine.done(); _phase('ready'); }
    });
  }

  function _aloudStop() {
    try { if (typeof CompanionSpeak !== 'undefined') CompanionSpeak.stop(); } catch (e) {}
    if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
  }

  function open() {
    const els = _build();
    if (!els || !_ctx) return;
    els.opener.hidden = true;
    els.bar.hidden = false;
    els.said.textContent = '';
    els.input.placeholder = 'Say something to ' + _ctx.companionName;
    _renderStarters();
    _open = true;
    try { els.input.focus(); } catch (e) {}
  }

  /** Close the conversation and DISCARD it. */
  function hide() {
    // A VOICE NEVER OUTLIVES ITS ENCOUNTER, and neither does a
    // microphone — the same rule js/etherHost.js already follows for the
    // World Host's own line.
    _aloudStop();
    try { if (typeof CompanionListen !== 'undefined') CompanionListen.stop(); } catch (e) {}
    _micState('stopped');
    // NO BELL FROM AN ABANDONED TURN.
    if (_turn) { _turn.cancel(); _turn = null; }
    _busy = false;
    // A TRAVELLER KEEPS NOTHING. The conversation goes when the
    // encounter does, exactly as the turns do.
    try {
      if (typeof CompanionConversation !== 'undefined') CompanionConversation.reset();
    } catch (e) {}
    const els = _els;
    _open = false;
    _turns = [];
    if (!els) return;
    els.bar.hidden = true;
    els.said.textContent = '';
    els.input.value = '';
    if (_ctx) els.opener.hidden = false;
    try { els.opener.focus(); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // THE RHYTHM — Sprint 1N.6, and it is the SAME machine the Studio
  // drives. Decision 48: what differs between the two relationships is
  // what may be SEEN, never the quality of the conversation, so a
  // Traveller must not get a lesser version of being answered.
  //
  // The Ether's own answer is deterministic and arrives in under a
  // millisecond, so in practice the dots are never seen here — which is
  // correct, and is why the threshold is measured rather than chosen. A
  // future answer that takes longer gets the indication for free.
  let _turn = null;
  let _busy = false;

  // SPRINT 3A.1 — THE SAME LISTS AS THE STUDIO'S, for the same reason.
  // `voice-preparing` now happens BEFORE the words are shown, so it is
  // part of the wait rather than something that follows it. Decision 48:
  // what differs between the two surfaces is what may be SEEN, never the
  // mechanics of a conversation.
  const THINKS = ['sending', 'thinking', 'voice-preparing'];
  const HOLDS = ['sending', 'received', 'thinking', 'voice-preparing'];
  const WAIT_WORDS = { thinking: 'is thinking', 'voice-preparing': 'is getting ready' };

  function _phase(name) {
    const els = _els;
    if (!els) return;
    els.bar.setAttribute('data-state', name);
    els.dots.hidden = (THINKS.indexOf(name) === -1);
    if (els.wait) {
      els.wait.textContent = WAIT_WORDS[name] ? (_hostName() + ' ' + WAIT_WORDS[name]) : '';
    }
    const hold = HOLDS.indexOf(name) !== -1;
    try { els.said.setAttribute('aria-busy', hold ? 'true' : 'false'); } catch (e) {}
    els.send.disabled = hold;
    els.input.disabled = hold;
  }

  /**
   * The words are held behind their own voice and released the instant
   * it is in hand — or when the hold rings, or when there was never
   * going to be one. Every way out puts the answer on screen.
   */
  function _present(turn, els, words) {
    const who = _hostId();
    let out = false;
    const go = function (play, stillComing) {
      if (out || (turn && turn !== _turn)) return;
      out = true;
      _pendingReveal = null;
      _reveal(turn, els, words, play, stillComing);
    };
    if (!turn || !_canSpeakText(words)) { go(null); return; }
    // The words go up, but a voice is still coming — so the turn is not
    // declared over yet.
    _pendingReveal = function () { go(null, true); };
    turn.preparingVoice(_pendingReveal);
    CompanionSpeak.ready(words, who, {
      onSpeaking: function () { if (turn === _turn) turn.speakingNow(); }
    }).then(function (play) {
      if (turn !== _turn) return;
      turn.voiceReady();
      if (out) {
        if (play) _sayLate(turn, play);
        else if (turn === _turn) { turn.done(); _phase('ready'); }
        return;
      }
      go(play);
    }, function () { go(null); });
  }

  /** Who is standing here — the STORY's host, never the reader's own. */
  function _hostId() { return _ctx ? _ctx.companionId : null; }
  function _hostName() { return (_ctx && _ctx.companionName) || 'They'; }

  function _canSpeakText(words) {
    try {
      if (typeof CompanionSpeak === 'undefined') return false;
      if (!_voiceOn()) return false;
      if (!String(words || '').trim()) return false;
      return CompanionSpeak.supported();
    } catch (e) { return false; }
  }

  function _reveal(turn, els, words, play, stillComing) {
    _busy = false;
    _pendingReveal = null;
    els.said.textContent = words;
    if (turn) turn.shown();
    _phase('response-ready');
    if (!play) {
      if (stillComing) return;
      if (_els && _els.bar.getAttribute('data-state') === 'response-ready') _phase('ready');
      if (turn) turn.done();
      return;
    }
    if (_els && _els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    play().then(function () {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      if (turn === _turn) { turn.done(); _phase('ready'); }
    });
  }

  function _sayLate(turn, play) {
    if (_els && _els.speak) _els.speak.setAttribute('data-speaking', 'yes');
    play().then(function () {
      if (_els && _els.speak) _els.speak.removeAttribute('data-speaking');
      if (turn === _turn) turn.done();
    });
  }

  let _pendingReveal = null;

  function _newTurn() {
    if (typeof CompanionTurn === 'undefined') return null;
    return CompanionTurn.create({
      // ONLY THE STATES A CHILD CAN SEE, which is what the Studio's own
      // hook has always done. `idle` is the machine being finished, not
      // a phase to paint — and since Sprint 3A.1 calls done() on the
      // no-voice path (so a turn cannot be left open), painting it here
      // flipped the bar straight past `ready` into `idle`.
      onState: function (name) {
        if (['sending', 'received', 'thinking', 'response-ready',
             'voice-preparing', 'speaking'].indexOf(name) !== -1) _phase(name);
      },
      onGiveUp: function (kind) {
        // NEITHER STATE LASTS FOR EVER. A voice that never arrived costs
        // a Traveller nothing — the answer is already read.
        // A VOICE THAT NEVER ARRIVED REVEALS THE ANSWER — the words may
        // still be held behind it. The hold's own bell rings first in
        // every ordinary case; this is the floor under it.
        if (kind !== 'answer') {
          if (_pendingReveal) { const r = _pendingReveal; _pendingReveal = null; try { r(); } catch (e) {} }
          _aloudStop();
        }
        _busy = false;
        _phase('ready');
      }
    });
  }

  function _send() {
    const els = _els;
    if (!els || !_ctx) return;
    // ONE PRESS, ONE TURN.
    if (_busy) return;
    const said = els.input.value.trim();
    if (!said) return;
    els.input.value = '';
    _busy = true;
    // NEITHER OUTLIVES A TURN — a microphone still open would be
    // listening to nobody, a voice still speaking would talk over the
    // next answer.
    try { if (typeof CompanionListen !== 'undefined') CompanionListen.stop(); } catch (e) {}
    _micState('stopped');
    _aloudStop();
    if (_turn) _turn.cancel();
    _pendingReveal = null;
    const turn = _turn = _newTurn();
    if (turn) turn.send();
    const answer = reply(said, _ctx);
    // Bounded, and kept only while the surface is open. Nothing here is
    // written anywhere, sent anywhere, or read by anything else.
    _turns.push({ said: said, answer: answer.text });
    if (_turns.length > MAX_TURNS) _turns.shift();
    // ONE CONVERSATIONAL EVENT — Sprint 3A.1 §30. The same presentation
    // the Studio uses, through the same two modules, because a second
    // implementation of "text and voice arrive together" is a second
    // thing that can be fixed on one surface and left broken on the
    // other. What differs is the CONTEXT a host may see, never this.
    const held = turn ? turn.answered() : 0;
    const show = function () {
      if (turn && turn !== _turn) return;
      _present(turn, els, answer.text);
    };
    if (held > 0) setTimeout(show, held); else show();
    // The suggestions were for a Traveller who did not know what to
    // say. Somebody has now said something.
    _renderStarters();
    try { els.input.focus(); } catch (e) {}
  }

  const api = {
    offer: offer, withdraw: withdraw, open: open, close: hide,
    reply: reply, classify: classify,
    isOpen: function () { return _open; },
    turns: function () { return _turns.slice(); },
    context: function () { return _ctx ? JSON.parse(JSON.stringify(_ctx)) : null; },
    MAX_CHARS: MAX_CHARS, MAX_TURNS: MAX_TURNS,
    mic: _mic, aloud: _aloud, voiceOn: _voiceOn, setVoiceOn: _setVoiceOn,
    // The character table lives in the Mind now. Re-exported so this
    // file's public surface is exactly what it was.
    get VOICE() { return (typeof CompanionMind !== 'undefined') ? CompanionMind.VOICE : {}; }
  };
  try { window.TravellerTalk = api; } catch (e) {}
  return api;
})();
