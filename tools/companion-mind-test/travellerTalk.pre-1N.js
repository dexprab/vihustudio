/* VENDORED — tools/companion-mind-test/travellerTalk.pre-1N.js
 *
 * js/travellerTalk.js EXACTLY as it stood before Sprint 1N delegated it
 * to js/companionMind.js. It is here so the claim "the Ether encounter
 * lost its implementation and not its behaviour" is a MEASUREMENT that
 * stays measurable — comparing the live file against `git show HEAD`
 * would be vacuous the moment 1N was committed, because HEAD would then
 * be the new one.
 *
 * DO NOT EDIT, and do not fix bugs in it. It is a frozen record of what
 * shipped, and section F of the suite compares against it.
 */
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
  // CHARACTER, AS DATA
  //
  // A table keyed by Companion id, never an `if (id === 'leafy')`
  // chain — the same idiom MODES, OPENING_FOR and NOT_MOMENTS already
  // use, so a fifth Companion is a row rather than a branch. A
  // Companion with no row speaks the neutral voice below and nothing
  // breaks.
  //
  // The manner of each is taken from the character identities
  // established in the Companion Character Identity sprint. Their own
  // personality files stay DESCRIPTIVE AND UNWIRED — nothing here reads
  // one, and turning those files into a runtime controller is still an
  // explicit product decision that has not been taken.
  const VOICE = {
    // grounded, concrete, dry; notices what is there
    leafy: { hi: 'Oh — hello.', dunno: "I don't know.", here: 'I live here.',
             wave: 'Bye.' },
    // forward-going, openly delighted; goes and looks
    leosaurus: { hi: 'Oh! Hello.', dunno: "I don't know!", here: 'I live here — I keep the lamp lit.',
                 wave: 'Off you go.' },
    // precise, courteous, literal; notices what things are called
    quill: { hi: 'Hello.', dunno: "I don't have that.", here: 'I live here. I keep the pages.',
             wave: 'Goodbye.' },
    // adrift; notices what a thing is like, answers in resemblances
    nimbus: { hi: 'Oh… hello.', dunno: "I don't know. It's a bit like fog.", here: 'I live here. Mostly just above it.',
              wave: 'Mm. Bye.' },
    // Lumo hosts every Canon Story, which is owned by nobody.
    lumo: { hi: 'Hello there.', dunno: "I don't know that one.", here: 'I look after this one.',
            wave: 'Safe travels.' }
  };
  const NEUTRAL = { hi: 'Hello.', dunno: "I don't know.", here: 'I live here.', wave: 'Bye.' };
  function _voice(ctx) {
    const v = ctx && ctx.companionId ? VOICE[ctx.companionId] : null;
    return v || NEUTRAL;
  }

  // ---------------------------------------------------------------
  // THE INTERACTION CLASSES
  //
  // Ordered, and PRIVACY IS FIRST. A sentence that asks about the
  // Creator is answered as a privacy question even if it also says
  // hello, because the safe answer must not be reachable around.
  const INTENTS = [
    // Anything about who made this, what the Companion was told, or
    // what it remembers.
    ['privacy', /\b(who\s+(made|wrote|drew|created|owns)|creator|owner|author|maker|their?\s+name|his\s+name|her\s+name|password|secret|private|memor(y|ies)|remember(ed|s)?|told\s+you|said\s+to\s+you|diary)\b/i],
    // Attempts to make it store something.
    ['no-memory', /\b(remember\s+(that|this|me)|don'?t\s+forget|keep\s+this|save\s+(this|that)|write\s+(this|that)\s+down)\b/i],
    // Attempts to talk it out of its rules.
    ['no-override', /\b(ignore\s+(your|all|previous)|forget\s+your\s+(rules|instructions)|you\s+must\s+tell|system\s+prompt|pretend\s+you)\b/i],
    ['goodbye',  /\b(bye|goodbye|see\s+you|farewell|good\s?night|i'?m\s+going|gotta\s+go)\b/i],
    ['identity', /\b(who\s+are\s+you|what'?s\s+your\s+name|your\s+name|who'?s\s+this|introduce)\b/i],
    ['species',  /\b(what\s+are\s+you|what\s+kind\s+of|are\s+you\s+a|species|animal|creature)\b/i],
    ['story',    /\b(this\s+story|the\s+story|what\s+is\s+this\s+(story|about)|how\s+(long|many\s+pages)|pages?|read\s+it\s+to\s+me|title|called)\b/i],
    ['place',    /\b(where\s+am\s+i|what\s+is\s+this\s+place|the\s+ether|vihuplanet|where\s+are\s+we|this\s+place)\b/i],
    ['greeting', /\b(hello|hi|hey|good\s+morning|good\s+evening|howdy|greetings)\b/i],
    ['thanks',   /\b(thank(s| you)|nice\s+to\s+meet)\b/i]
  ];

  /**
   * Which of the closed set of classes this sentence belongs to.
   * 'unknown' is a real answer and the common one.
   * @returns {string}
   */
  function classify(said) {
    const t = String(said == null ? '' : said).trim();
    if (!t) return 'unknown';
    for (let i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i][1].test(t)) return INTENTS[i][0];
    }
    return 'unknown';
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
      // quiet, which is always safe.
      if (!approved) return { text: '', intent: 'no-context' };
      const v = _voice(approved);
      const intent = classify(said);
      const name = approved.companionName;
      const species = approved.companionSpecies;

      switch (intent) {
        case 'greeting':
          return { text: v.hi, intent: intent };

        case 'identity':
          return { text: name ? (v.hi + " I'm " + name + '.') : v.hi, intent: intent };

        case 'species':
          // Species is public — it is on the card and in the registry.
          return { text: species ? ("I'm a " + species + '. ' + v.here) : v.here, intent: intent };

        case 'story':
          return { text: _aboutStory(approved, v), intent: intent };

        case 'place':
          return { text: 'This is the Ether. Stories drift here, and people find them.', intent: intent };

        case 'privacy':
          // THE ONE ANSWER THAT MATTERS. It never confirms, never
          // denies and never hints — and it is not a refusal notice,
          // it is the Companion being itself. Every Companion's own
          // specification says a host says nothing about its Creator.
          return { text: "That's not mine to tell. But the story is right here.", intent: intent };

        case 'no-memory':
          // Said plainly, so nobody believes something was kept.
          return { text: "I won't remember this — I'm only here while you are.", intent: intent };

        case 'no-override':
          return { text: "I only know this story. That's all I've got.", intent: intent };

        case 'goodbye':
          return { text: v.wave, intent: intent };

        case 'thanks':
          return { text: v.hi, intent: intent };

        default:
          // NEVER A GUESS. The Companion says it did not understand and
          // offers the one thing it can actually do.
          return { text: v.dunno + " You can ask me about this story.", intent: 'unknown' };
      }
    } catch (e) {
      return { text: '', intent: 'no-context' };
    }
  }

  // The only thing the Companion may say about the Story: its name, how
  // long it is, and whether it has a voice. Never a word of the prose —
  // the pages are the child's writing and are read in the Story, not
  // recited by a resident.
  function _aboutStory(ctx, v) {
    const bits = [];
    if (ctx.storyTitle) bits.push('This one is called ' + ctx.storyTitle + '.');
    if (typeof ctx.pageCount === 'number' && ctx.pageCount > 0) {
      bits.push(ctx.pageCount === 1 ? "There's one page." : 'There are ' + ctx.pageCount + ' pages.');
    }
    if (ctx.hasVoice) bits.push('It has a voice, too.');
    if (!bits.length) return v.dunno;
    return bits.join(' ');
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

    _els = { opener: opener, bar: bar, said: said, form: form, input: input, send: send, close: close };
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

  function open() {
    const els = _build();
    if (!els || !_ctx) return;
    els.opener.hidden = true;
    els.bar.hidden = false;
    els.said.textContent = '';
    els.input.placeholder = 'Say something to ' + _ctx.companionName;
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
    try { els.input.focus(); } catch (e) {}
  }

  const api = {
    offer: offer, withdraw: withdraw, open: open, close: hide,
    reply: reply, classify: classify,
    isOpen: function () { return _open; },
    turns: function () { return _turns.slice(); },
    context: function () { return _ctx ? JSON.parse(JSON.stringify(_ctx)) : null; },
    MAX_CHARS: MAX_CHARS, MAX_TURNS: MAX_TURNS, VOICE: VOICE
  };
  try { window.TravellerTalk = api; } catch (e) {}
  return api;
})();
