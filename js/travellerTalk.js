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
      const a = CompanionMind.answer(said, approved);
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

    form.appendChild(input); form.appendChild(send); form.appendChild(close);
    bar.appendChild(starters);
    bar.appendChild(said); bar.appendChild(form);
    host.appendChild(opener); host.appendChild(bar);

    opener.addEventListener('click', function () { open(); });
    close.addEventListener('click', function () { hide(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); _send(); });
    // Escape closes, and only while the surface is open — no global
    // key handling, and the portal's own Escape still works when it is
    // not.
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
    });

    _els = { opener: opener, bar: bar, said: said, form: form, input: input,
             send: send, close: close, starters: starters };
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

  function _send() {
    const els = _els;
    if (!els || !_ctx) return;
    const said = els.input.value.trim();
    if (!said) return;
    els.input.value = '';
    const answer = reply(said, _ctx);
    // Bounded, and kept only while the surface is open. Nothing here is
    // written anywhere, sent anywhere, or read by anything else.
    _turns.push({ said: said, answer: answer.text });
    if (_turns.length > MAX_TURNS) _turns.shift();
    els.said.textContent = answer.text;
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
    // The character table lives in the Mind now. Re-exported so this
    // file's public surface is exactly what it was.
    get VOICE() { return (typeof CompanionMind !== 'undefined') ? CompanionMind.VOICE : {}; }
  };
  try { window.TravellerTalk = api; } catch (e) {}
  return api;
})();
