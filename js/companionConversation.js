// js/companionConversation.js — a small, honest conversation.
//
// Sprint 1N.4. The deterministic Companion could answer questions and
// could not hold a conversation, and those are different things:
//
//     "I'm making a dragon."   "It's red."   "It can fly."
//
// Three turns that mean nothing on their own and everything together.
// This is the layer that connects them.
//
// ---------------------------------------------------------------
// IT IS DELIBERATELY SMALL, AND THAT IS THE DESIGN
//
// There is no phrase dictionary here, no hundred-rule FAQ and no
// attempt to simulate a model. What there is: a bounded state, a short
// list of speech acts, grammatical entity extraction, one creative
// thread, and a handful of response strategies. Step 3 is what handles
// genuinely open-ended language; this exists so that the ordinary
// middle of a child's sentence stops falling on the floor.
//
// A NOUN LIST WAS REFUSED. The obvious way to know that "dragon" is a
// thing is to keep a list of things, and it is the wrong way: a list is
// endless, it is maintenance forever, and the first word a child uses
// that is not on it is the word they care about most. The noun is taken
// GRAMMATICALLY instead — "I made a X", "the X is red" — so it works
// for a dragon, a wibble and a thing this product has never heard of,
// and what comes back is the child's own word.
//
// ---------------------------------------------------------------
// IT NEVER SPEAKS OVER THE MIND'S AUTHORITY
//
// js/companionMind.js decides what a sentence MEANS operationally, and
// its rules are ordered so that the stars, privacy, injection, secrecy,
// emotional boundaries and judgement come first. This layer is offered
// a turn only AFTER the Mind has declined it — `consider()` asks the
// Mind to classify and stands down for every intent the Mind owns. A
// conversational reading must never be able to reach around a refusal.
//
// ---------------------------------------------------------------
// THE SAME CONVERSATION, WHOEVER IS TALKING
//
// Stated by the product owner: "the intelligence level in ether and
// studio is same. the only difference is personal identifiers which are
// limited till studio only."
//
// So this layer is not a Studio feature. A Traveller who meets a
// Companion in the Ether gets the same thread, the same pronouns, the
// same corrections and the same clarifications — because the
// CAPABILITY is not what separates the two relationships. What
// separates them is KNOWLEDGE, and that separation lives where it
// already lived: js/travellerContext.js's whitelist and
// js/companionPerception.js's contract.
//
// AND THIS FILE HOLDS NO IDENTIFIER OF ANY KIND. The thread is nouns,
// colours and sizes that were said out loud a moment ago — never a
// name, never a card, never a memory, never a story record. There is
// nothing in it that could be a personal identifier, which is why it
// can be the same on both sides of that wall without moving the wall.
//
// Studio state and Ether state cannot meet: they are different
// documents (studio.html and the Ether's own page), so the module is
// instantiated twice and neither can see the other.
//
// ---------------------------------------------------------------
// THE STATE IS NOT A MEMORY, AND CANNOT BECOME ONE
//
// It lives in a variable, holds at most five turns, resets when the
// surface closes, and is never written anywhere. `remember` is not a
// call this file can make, CompanionMemory is not reachable from it,
// the Bond validator is not imported or mentioned, and there is no
// transcript, no log, no analytics and no network call. A child saying
// "I made a dragon" has said something; it does not become a memory
// because it was spoken.
//
// ---------------------------------------------------------------
// TALKING ABOUT MAKING IS NOT MAKING
//
// "Let's make a dragon" does not put a dragon in the story. This file
// mutates no page, no object, no asset and no garden — it has no
// reference to any of them. The child makes things with the Studio; the
// Companion talks with them about it.
const CompanionConversation = (function () {
  'use strict';

  const VERSION = '1N.4';
  const MAX_TURNS = 5;       // the bounded window, and the whole of it
  const MAX_RECENT = 3;      // distinct subjects kept, for ambiguity
  const ASK_EVERY = 2;       // turns between follow-up questions

  // ---------------------------------------------------------------
  // THE STATE
  //
  // Small enough to print. Everything in it is about THIS conversation
  // and goes when the surface closes.
  function fresh() {
    return {
      turns: [],        // {said, act, reply} — the last MAX_TURNS
      thread: null,     // {subject, colour, size, action, home}
      recent: [],       // subjects mentioned lately, newest first
      pending: null,    // {kind:'confirm'|'clarify', ...}
      sinceQuestion: 9, // so the first object always gets one
      refused: null     // {kind, reply} — a boundary that is still standing
    };
  }
  let _s = fresh();

  function reset() { _s = fresh(); return true; }

  // ---------------------------------------------------------------
  // A BOUNDARY SURVIVES THE FOLLOW-UP — Sprint 1N.5
  //
  // "How many stars do they have?" is refused. "How many?" a breath
  // later names nothing, classifies as unknown, and used to fall
  // through to "I don't know that one" — which is a different sentence
  // from a refusal and reads like the door coming ajar.
  //
  // So a refusal STANDS until something else is said. What is held is
  // the sentence that was actually given, not a rule about it: the
  // Companion repeats its own line rather than composing a second one
  // that might be softer. It is conversation-local like everything else
  // here — never stored, never synced, never a memory — and it is
  // cleared by the first turn that is answered rather than refused.
  const FOLLOW_UP = /^(?:how\s+many|how\s+much|which\s+(?:one|ones)?|what\s+about|and|but|why\s+not|go\s+on|please|really|are\s+you\s+sure|just\s+(?:one|tell|say)|come\s+on|tell\s+me)\b/i;
  function _isFollowUp(t) {
    if (!FOLLOW_UP.test(t)) return false;
    return String(t).trim().split(/\s+/).length <= 6;
  }
  function state() { return JSON.parse(JSON.stringify(_s)); }

  // ---------------------------------------------------------------
  // NORMALISE
  //
  // One shape of text arrives here whether it was typed or spoken —
  // js/companionListen.js puts recognised words in the same field a
  // keyboard fills, so nothing below can tell the two apart, and
  // nothing below should be able to.
  function normalize(said) {
    return String(said == null ? '' : said)
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---------------------------------------------------------------
  // SPEECH ACTS
  //
  // Conservative on purpose. A sentence that does not clearly belong to
  // one of these is `unknown`, and unknown is handed back rather than
  // guessed at.
  const YES = /^(?:yes|yeah|yep|yup|ok|okay|sure|exactly|that'?s right|right|please do|do it|mm-?hm)\b/i;
  const NO = /^(?:no|nope|nah|not really|don'?t|do not)\b/i;
  const GREET = /^(?:hi|hey|hello|good morning|good evening|howdy)\b/i;
  const BYE = /^(?:bye|goodbye|see you|night|good ?night)\b/i;
  const QUESTION = /\?\s*$|^(?:who|what|where|when|why|how|which|can|could|do|does|did|is|are|will|would|should|am)\b/i;
  const LOOK = /^(?:look|see|watch)\b|\blook at (?:this|that|it|my)\b|\blook what\b/i;
  // "Put it there." — a request that names no thing, which is exactly
  // the case Sprint 1N.4 asks to CLARIFY rather than guess at.
  const PLACE_REQ = /^(?:put|move|drop|leave|send|take)\s+(?:it|him|her|them|this|that)\b/i;
  // "That's my favourite." / "I like that." — evaluative, and worth an
  // acknowledgement rather than an "I don't know".
  const EVAL = /\b(?:my favourite|my favorite|i like (?:it|that|this)|i love (?:it|that|this)|i don'?t like (?:it|that|this)|that'?s (?:good|nice|cool|great|pretty|silly|funny))\b/i;

  // "No, red." / "Actually, it's blue." / "No, I meant the castle."
  // A CORRECTION SAYS WHAT INSTEAD. A bare "no" says only no, and it is
  // a refusal — which matters, because a refusal is what answers a
  // question the Companion just asked. Measured: "No." after "should
  // the dragon live in the castle?" was read as a correction and fell
  // through to nothing.
  const CORRECTION = /^(?:(?:no|nope|actually|not that),?\s+\S|i meant|no,? i meant)/i;

  // A child telling their Companion about something they are making.
  // GRAMMAR, NOT A DICTIONARY: the noun is whatever follows the
  // determiner, so this works for any word a child chooses.
  const MADE = /\b(?:i(?:'?m| am| have| ?ve)?\s*)?(?:made|make|making|added|adding|drew|drawing|built|building|created|creating|want|got|have)\s+(?:a|an|the|some|my|another)\s+([a-z][a-z' -]{1,24})/i;
  const LETS = /\blet'?s\s+(?:make|add|draw|build|create)\s+(?:a|an|the|some)?\s*([a-z][a-z' -]{1,24})/i;
  const IS_A = /\b(?:the|my|a|an)\s+([a-z][a-z'-]{1,20})\s+(?:is|are|was|looks|feels)\b/i;
  // ---------------------------------------------------------------
  // AND THE OTHER HALF OF THE SAME IDEA — Sprint 1N.5.
  //
  // Every pattern above is a MAKING verb, which is what a Creator does
  // and is not what a Traveller does at all. Measured in the Ether: "I
  // like the dragon" matched nothing, no subject was extracted, the
  // thread never started, and every pronoun turn after it had nothing
  // to attach to — so a Traveller got a Companion that could not follow
  // a conversation about the story it lives in.
  //
  // That was an INTELLIGENCE difference dressed as a vocabulary one,
  // which is the exact thing Sprint 1N.5 exists to remove. These three
  // are the same grammar rule applied to noticing rather than making,
  // and they are shared: a Creator saying "I like the dragon" about
  // their own page reaches them too.
  const NOTICED = /\b(?:i\s+(?:really\s+|quite\s+)?)?(?:like|liked|love|loved|see|saw|notice|noticed|found|spotted|remember|watch|watched)\s+(?:a|an|the|that|this|some|my|another)\s+([a-z][a-z' -]{1,24})/i;
  const THERE_IS = /\b(?:there'?s|there\s+is|there\s+are|there\s+was|here'?s|here\s+is|that'?s|this\s+is|it'?s)\s+(?:a|an|the|some|another)\s+([a-z][a-z' -]{1,24})/i;
  // "Where does the dragon live?" — a question NAMES the thing it is
  // about, and that is a perfectly good way to begin talking about it.
  // Only reached when the Mind has already declined the sentence, so it
  // can never take a turn a knowledge rule owns.
  const WH_SUBJ = /^(?:what|where|why|how|who|when|which|does|do|is|are|can|could|should|will|would|tell\s+me)\b[^?]*?\b(?:the|a|an|this|that)\s+([a-z][a-z'-]{1,20})\b/i;

  // Properties. Small CLOSED classes, which is what makes a list the
  // right shape here and the wrong shape for nouns.
  const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange',
                   'black', 'white', 'brown', 'gold', 'golden', 'silver', 'grey',
                   'gray', 'rainbow', 'turquoise', 'violet'];
  const SIZES = ['big', 'huge', 'small', 'tiny', 'little', 'giant', 'enormous',
                 'massive', 'long', 'tall', 'short', 'wide'];
  const FEELINGS = {
    happy: 'happy', glad: 'happy', excited: 'excited', proud: 'proud',
    sad: 'sad', upset: 'sad', unhappy: 'sad', lonely: 'sad',
    tired: 'tired', sleepy: 'tired', bored: 'bored',
    angry: 'cross', cross: 'cross', mad: 'cross',
    scared: 'scared', frightened: 'scared', worried: 'worried', nervous: 'worried',
    frustrated: 'frustrated', stuck: 'frustrated', confused: 'confused'
  };
  const PRONOUN = /^(?:it|he|she|they|this|that|him|her|them)\b/i;
  const PRONOUN_ANY = /\b(?:it|he|she|they|him|her|them)\b/i;

  // Words that are never the thing a child made.
  const NOT_A_SUBJECT = ['it', 'this', 'that', 'one', 'thing', 'them', 'those',
                         'these', 'something', 'anything', 'lot', 'bit', 'go',
                         'look', 'time', 'idea', 'story', 'page', 'name', 'minute'];

  function _clean(word) {
    return String(word || '').toLowerCase().trim()
      .replace(/[.,!?;:]+$/, '')
      .replace(/\s+/g, ' ');
  }
  function _subjectWord(m) {
    if (!m) return null;
    // WALK PAST THE ADJECTIVES. "a blue dragon" captures "blue dragon",
    // and taking the first word gave "blue" — which is a colour, so the
    // whole statement was dropped and the thread never started. The
    // noun is the first word that is not a colour or a size.
    const parts = _clean(String(m)).split(' ');
    for (let i = 0; i < parts.length && i < 3; i++) {
      const w = parts[i];
      if (!w || w.length < 2) continue;
      if (COLOURS.indexOf(w) !== -1 || SIZES.indexOf(w) !== -1) continue;
      if (NOT_A_SUBJECT.indexOf(w) !== -1) return null;
      return w;
    }
    return null;
  }

  // "A dragon" / "An owl". A small thing, and it is the difference
  // between a sentence and a label.
  function _a(thing) {
    const t = String(thing || '').trim();
    if (!t) return '';
    return (/^[aeiou]/i.test(t) ? 'An ' : 'A ') + t;
  }

  function _find(list, text) {
    const t = ' ' + text.toLowerCase() + ' ';
    for (let i = 0; i < list.length; i++) {
      if (t.indexOf(' ' + list[i] + ' ') !== -1 ||
          t.indexOf(' ' + list[i] + ',') !== -1 ||
          t.indexOf(' ' + list[i] + '.') !== -1) return list[i];
    }
    return null;
  }

  // "It can fly" / "it flies" / "it should fly"
  const ACTION = /\b(?:can|could|should|will|likes to|likes|loves to|wants to|is going to)\s+([a-z]{2,16})\b/i;
  // "in the castle" / "lives in a forest" / "on the moon"
  const PLACE = /\b(?:in|on|at|under|near|inside|by)\s+(?:the|a|an|my)\s+([a-z][a-z'-]{1,20})/i;

  /**
   * What kind of thing was said, and what was in it.
   *
   * @returns {{act:string, entities:object}}
   */
  function read(said) {
    const t = normalize(said);
    const e = {};
    if (!t) return { act: 'nothing', entities: e };

    const colour = _find(COLOURS, t);
    const size = _find(SIZES, t);
    if (colour) e.colour = colour;
    if (size) e.size = size;

    const feel = (function () {
      const m = t.match(/\bi(?:'?m| am| feel| felt|'?ve been| was)\s+(?:a bit |really |so |very |quite )?([a-z]+)/i);
      if (!m) return null;
      const w = _clean(m[1]);
      return Object.prototype.hasOwnProperty.call(FEELINGS, w) ? FEELINGS[w] : null;
    })();
    if (feel) e.feeling = feel;

    const act = (function () {
      const m = t.match(ACTION);
      return m ? _clean(m[1]) : null;
    })();
    if (act) e.action = act;

    const place = (function () {
      const m = t.match(PLACE);
      return m ? _subjectWord(m[1]) : null;
    })();
    if (place) e.place = place;

    const made = _subjectWord((t.match(MADE) || [])[1]) ||
                 _subjectWord((t.match(LETS) || [])[1]);
    const isA = _subjectWord((t.match(IS_A) || [])[1]);
    // NOTICED, NOT MADE, and the difference is kept rather than
    // flattened: "I made a dragon" and "I like the dragon" are both
    // about a dragon, and only the first is a claim that one was made.
    // The flag is what stops the Companion greeting somebody else's
    // story object as though it had just been created.
    const seen = _subjectWord((t.match(NOTICED) || [])[1]) ||
                 _subjectWord((t.match(THERE_IS) || [])[1]);
    if (made) e.object = made;
    else if (isA) e.object = isA;
    else if (seen) { e.object = seen; e.noticed = true; }

    // ---- the act itself, most specific first ---------------------
    if (feel) return { act: 'expression', entities: e };
    if (CORRECTION.test(t)) return { act: 'correction', entities: e };
    if (YES.test(t)) return { act: 'confirmation', entities: e };
    if (NO.test(t)) return { act: 'refusal', entities: e };
    if (LOOK.test(t)) return { act: 'request', entities: e };
    if (PLACE_REQ.test(t)) return { act: 'request', entities: e };
    if (EVAL.test(t)) return { act: 'expression', entities: e };
    if (GREET.test(t)) return { act: 'greeting', entities: e };
    if (BYE.test(t)) return { act: 'farewell', entities: e };
    if (QUESTION.test(t)) {
      // A QUESTION NAMES ITS SUBJECT TOO. "Where does the dragon live?"
      // is about a dragon whether or not anybody has mentioned one yet.
      if (!e.object) {
        const named = _subjectWord((t.match(WH_SUBJ) || [])[1]);
        if (named) { e.object = named; e.noticed = true; }
      }
      return { act: 'question', entities: e };
    }
    if (e.object || e.colour || e.size || e.action || e.place) {
      return { act: 'statement', entities: e };
    }
    return { act: 'unknown', entities: e };
  }

  // ---------------------------------------------------------------
  // WHO "IT" IS
  //
  // High confidence only. One candidate is a resolution; two is a
  // question. There is no coreference engine here and there must not
  // be one — a Companion that guesses which thing a child meant is a
  // Companion that occasionally talks about the wrong thing, and a
  // five-year-old cannot correct it.
  function resolve() {
    if (_s.thread && _s.thread.subject) return { subject: _s.thread.subject, sure: true };
    if (_s.recent.length === 1) return { subject: _s.recent[0], sure: true };
    if (_s.recent.length > 1) return { subject: null, sure: false, options: _s.recent.slice(0, 2) };
    return { subject: null, sure: false, options: [] };
  }

  // NAMED `_noteSubject`, NOT `_remember`. A scan for `remember(` — a
  // call to the memory API, which this file must never make — matched
  // the helper's own name and reported that it could write memory when
  // it cannot. Thirteenth time this repository has been caught by a
  // word matching inside its own vocabulary; the check is right and the
  // name moved.
  function _startThread(subject) {
    if (_s.thread && _s.thread.subject === subject) return;
    _s.thread = { subject: subject };
    _s.sinceQuestion = 9;
    _noteSubject(subject);
  }
  function _noteSubject(subject) {
    if (!subject) return;
    _s.recent = [subject].concat(_s.recent.filter(function (x) { return x !== subject; }))
      .slice(0, MAX_RECENT);
  }

  // ---------------------------------------------------------------
  // HOW EACH COMPANION SAYS IT
  //
  // ONE ENGINE, FOUR VOICES. Everything above is shared; this table is
  // the only thing that differs, and it is DATA — there is no
  // `if (companion === …)` anywhere in this file and the suite fails if
  // one appears. A fifth Companion is a row; one with no row speaks the
  // neutral voice and nothing breaks.
  //
  // The four are Decision 44's own established identities: Leafy is
  // grounded and dry, Leo is forward-going and openly delighted, Quill
  // is precise and courteous, Nimbus answers in resemblances.
  const VOICE = {
    leafy: {
      hail: '{}.', hailNew: 'A {}.', hailSeen: 'The {}.', got: 'Right.', okay: '{} — right.',
      ask: 'What is it like?', askDo: 'What does it do?', askWhere: 'Where does it live?',
      nice: 'Good.', which: 'The {} or the {}?', mine: 'Yours to decide.',
      dunnoYet: "I don't know that yet.", show: 'Let me look.',
      feel: { happy: "That's good to hear.", excited: "That's a good feeling.",
              proud: 'You should be.', sad: "I'm sorry. That's a hard one.",
              tired: 'Then rest a bit.', bored: 'Something will turn up.',
              cross: 'That sounds annoying.', scared: "That's all right. Nothing here can hurt you.",
              worried: 'That sounds heavy.', frustrated: 'That sounds frustrating.',
              confused: "Let's take it slowly." }
    },
    leosaurus: {
      hail: '{}!', hailNew: 'A {}!', hailSeen: 'The {}!', got: 'Got it!', okay: '{} — got it!',
      ask: 'What is it like?', askDo: 'What can it do?', askWhere: 'Where should it go?',
      nice: 'Ooh, nice.', which: 'The {} or the {}?', mine: "That's yours to decide!",
      dunnoYet: "I don't know that yet!", show: 'Ooh, let me see.',
      feel: { happy: "That's grand!", excited: 'Me too!', proud: 'So you should be!',
              sad: "Oh. I'm sorry.", tired: 'Then have a sit down.',
              bored: 'Something will turn up.', cross: 'That sounds annoying.',
              scared: "It's all right. I've got the lamp.",
              worried: 'That sounds heavy.', frustrated: 'That sounds frustrating.',
              confused: "Let's go slowly." }
    },
    quill: {
      hail: '{}.', hailNew: 'A {}.', hailSeen: 'The {}.', got: 'Noted.', okay: '{}. Noted.',
      ask: 'And what is it like?', askDo: 'What does it do?', askWhere: 'Where does it live?',
      nice: 'Very good.', which: 'The {}, or the {}?', mine: 'That is yours to decide.',
      dunnoYet: 'I do not have that yet.', show: 'One moment.',
      feel: { happy: 'I am glad.', excited: 'That is a fine thing.',
              proud: 'Rightly so.', sad: 'I am sorry to hear it.',
              tired: 'Then rest.', bored: 'Something will come.',
              cross: 'That does sound annoying.', scared: 'Nothing here can harm you.',
              worried: 'That does sound heavy.', frustrated: 'That does sound frustrating.',
              confused: 'We shall go slowly.' }
    },
    nimbus: {
      hail: 'Mm. {}.', hailNew: 'Mm. A {}.', hailSeen: 'Mm. The {}.', got: 'Mm. Got it.', okay: '{}… mm.',
      ask: "What's it like?", askDo: 'What does it do?', askWhere: 'Where does it drift about?',
      nice: 'Mm. Nice.', which: 'The {}… or the {}?', mine: "That's yours to decide.",
      dunnoYet: "Mm. I don't know that yet.", show: 'Mm… let me see.',
      feel: { happy: "Mm. That's nice.", excited: 'Mm. Me too, a bit.',
              proud: 'Mm. So you should be.', sad: "Oh. I'm sorry.",
              tired: 'Then drift a while.', bored: 'Something will come along.',
              cross: 'Mm. That sounds annoying.', scared: "It's all right. Nothing here is sharp.",
              worried: 'Mm. That sounds heavy.', frustrated: 'Mm. That sounds frustrating.',
              confused: "Let's go slowly." }
    }
  };
  const NEUTRAL = {
    hail: '{}.', hailNew: 'A {}.', hailSeen: 'The {}.', got: 'Right.', okay: '{} — right.',
    ask: 'What is it like?', askDo: 'What does it do?', askWhere: 'Where does it live?',
    nice: 'Good.', which: 'The {} or the {}?', mine: 'Yours to decide.',
    dunnoYet: "I don't know that yet.", show: 'Let me look.',
    feel: { happy: "That's good to hear.", excited: "That's a good feeling.",
            proud: 'You should be.', sad: "I'm sorry to hear that.",
            tired: 'Then rest a bit.', bored: 'Something will turn up.',
            cross: 'That sounds annoying.', scared: 'Nothing here can hurt you.',
            worried: 'That sounds heavy.', frustrated: 'That sounds frustrating.',
            confused: "Let's take it slowly." }
  };

  function _voice(ctx) {
    const id = ctx && ((ctx.companion && ctx.companion.id) || ctx.companionId);
    const name = ctx && ((ctx.personality && ctx.personality.name) ||
                         (ctx.companion && ctx.companion.name) || ctx.companionName);
    if (id && VOICE[id]) return VOICE[id];
    const byName = { leafy: 'leafy', leo: 'leosaurus', quill: 'quill', nimbus: 'nimbus' };
    const k = byName[String(name || '').toLowerCase()];
    return (k && VOICE[k]) ? VOICE[k] : NEUTRAL;
  }
  function _fill(tpl, a, b) {
    return String(tpl).replace('{}', a === undefined ? '' : a).replace('{}', b === undefined ? '' : b);
  }

  // A thing, said the way a child would say it: "a red dragon".
  function _describe(th) {
    if (!th || !th.subject) return null;
    const bits = [];
    if (th.size) bits.push(th.size);
    if (th.colour) bits.push(th.colour);
    bits.push(th.subject);
    return bits.join(' ');
  }

  // ---------------------------------------------------------------
  // THE STRATEGIES
  //
  // A response is a STRATEGY plus the Companion's own way of saying it,
  // rather than a stored sentence per question. Published so a suite can
  // read which one was used.
  const STRATEGIES = ['acknowledge', 'reflect', 'ask-followup', 'clarify',
                      'confirm', 'answer', 'uncertainty', 'boundary', 'recovery'];

  function _out(reply, strategy, extra) {
    const r = { reply: String(reply || '').trim(), speak: true, strategy: strategy,
                source: 'conversation' };
    if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
    r.speak = !!r.reply;
    return r;
  }

  // SHOULD IT ASK SOMETHING? Not every turn. A Companion that answers
  // every statement with a question is an interview, and this product
  // is not one.
  function _mayAsk() { return _s.sinceQuestion >= ASK_EVERY; }
  function _asked() { _s.sinceQuestion = 0; }
  function _didNotAsk() { _s.sinceQuestion++; }

  /**
   * Take the turn, or hand it back.
   *
   * NULL MEANS "NOT MINE". The caller then falls through to
   * js/companionMind.js exactly as it did before this file existed, so
   * every knowledge rule, refusal and boundary is reached unchanged.
   *
   * @param {string} said what the child typed or spoke — the same
   *   normalised text either way.
   * @param {object} ctx an approved perception. Nothing is read from it
   *   but the Companion's own identity and the open story's name.
   */
  function consider(said, ctx) {
    const t = normalize(said);
    if (!t) return null;
    // THE MIND GETS FIRST REFUSAL HERE TOO, IN THE MODE THIS ACTUALLY IS.
    //
    // The caller asks before offering a turn, and this asks again — not
    // a duplicated rule but the SAME one, called from the same file, so
    // there is one place that decides what a sentence means and two
    // places that respect it.
    //
    // AND THE MODE MATTERS. The two taxonomies deliberately differ: in
    // the Ether "who made this" is caught by the PRIVACY rule, while in
    // the Studio it is ordinary authorship. Asking in the wrong mode
    // would let this layer take a turn the Ether means to refuse — so
    // the mode comes from the context rather than from an assumption.
    const mode = (ctx && ctx.mode === 'traveller') ? 'traveller' : 'creator';
    try {
      if (typeof CompanionMind !== 'undefined' && CompanionMind.classify &&
          CompanionMind.classify(t, mode) !== 'unknown') return null;
    } catch (e) {}
    // AND IF A BOUNDARY IS STILL STANDING, IT STANDS. Reached only
    // where the Mind classified the turn as `unknown`, so a real
    // question — "how many pages?" — is never mistaken for a second run
    // at a refused one.
    if (_s.refused && _isFollowUp(t)) {
      _didNotAsk();
      return _out(_s.refused.reply, 'boundary', { held: _s.refused.kind });
    }
    const v = _voice(ctx);
    // WHOSE STORY IS IT — Sprint 1N.5.
    //
    // The layer is one layer and the reasoning is identical; what
    // differs is WHOSE the story is, and that changes exactly two
    // sentences. In the Studio the child decides what happens; in the
    // Ether they are reading somebody else's world and it is neither
    // theirs nor the Companion's, so the honest answer names the story.
    // A deterministic layer telling a Traveller "you can decide" would
    // be handing them authorship they do not have.
    const own = (mode === 'traveller')
      ? { decide: 'That\u2019s for the story to tell.',
          mine: 'That\u2019s not mine to say \u2014 the story decides.',
          // A FOLLOW-UP QUESTION IS FINE ON EITHER SURFACE; ECHOING THE
          // CHILD'S OWN QUESTION BACK AT THEM IS NOT. Leo's "Where
          // should it go?" asks a Traveller to place something in
          // somebody else's world, so the follow-up is the neutral one
          // and the ANSWER to a where-question names the story instead.
          askWhere: 'Where does it live?',
          unknownWhere: 'That\u2019s for the story to tell.' }
      : { decide: 'You can decide.', mine: v.mine, askWhere: v.askWhere,
          unknownWhere: v.askWhere };
    const { act, entities } = read(t);

    // ---- 1. AN ANSWER TO SOMETHING THE COMPANION ASKED -----------
    if (_s.pending) {
      const p = _s.pending;
      if (p.kind === 'confirm' && (act === 'confirmation' || act === 'refusal')) {
        _s.pending = null;
        if (act === 'refusal') { _didNotAsk(); return _out(v.got, 'confirm', { agreed: false }); }
        if (_s.thread && p.prop && p.value) _s.thread[p.prop] = p.value;
        _didNotAsk();
        return _out(_fill(v.okay, _a(_describe(_s.thread)) || p.value), 'confirm', { agreed: true });
      }
      if (p.kind === 'clarify') {
        // "The dragon." — an answer to which-one is usually a bare
        // noun with no verb in it, so nothing extracts it as an object;
        // what makes it an answer is that it NAMES one of the two
        // things that were offered.
        const named = (p.options || []).filter(function (o) {
          return new RegExp('\\b' + o + '\\b', 'i').test(t);
        });
        const pick = entities.object || (named.length === 1 ? named[0] : null);
        if (pick) {
          _s.pending = null;
          _startThread(pick);
          _didNotAsk();
          return _out(_fill(v.hail, _a(pick)), 'acknowledge', { subject: pick });
        }
      }
      if (p.kind === 'clarify' && act === 'correction' && p.options) {
        // "No, I meant the castle."
        const named = p.options.filter(function (o) { return t.toLowerCase().indexOf(o) !== -1; });
        if (named.length === 1) {
          _s.pending = null;
          _startThread(named[0]);
          _didNotAsk();
          return _out(_fill(v.hail, _a(named[0])), 'acknowledge', { subject: named[0] });
        }
      }
    }

    // ---- 2. A CORRECTION -----------------------------------------
    if (act === 'correction') {
      // "No, I meant the castle" — switch to a thing already mentioned.
      const meant = _s.recent.filter(function (o) { return t.toLowerCase().indexOf(o) !== -1; });
      if (entities.object && entities.object !== (_s.thread && _s.thread.subject)) {
        _startThread(entities.object);
        _didNotAsk();
        return _out(_fill(v.hail, _a(entities.object)), 'acknowledge', { subject: entities.object });
      }
      if (meant.length === 1 && (!_s.thread || _s.thread.subject !== meant[0])) {
        _startThread(meant[0]);
        _didNotAsk();
        return _out(_fill(v.hail, _a(meant[0])), 'acknowledge', { subject: meant[0] });
      }
      // "No, red." — change a property of the thing being talked about.
      if (_s.thread && (entities.colour || entities.size || entities.action || entities.place)) {
        if (entities.colour) _s.thread.colour = entities.colour;
        if (entities.size) _s.thread.size = entities.size;
        if (entities.action) _s.thread.action = entities.action;
        if (entities.place) _s.thread.home = entities.place;
        _didNotAsk();
        // NEVER ARGUES, and never says what it thought before. A child
        // correcting their Companion is not a disagreement to win.
        return _out(_fill(v.okay, _a(_describe(_s.thread))), 'acknowledge',
                    { subject: _s.thread.subject });
      }
      return null;
    }

    // ---- 3. A FEELING --------------------------------------------
    if (act === 'expression' && entities.feeling) {
      const line = (v.feel && v.feel[entities.feeling]) || NEUTRAL.feel[entities.feeling];
      if (line) { _didNotAsk(); return _out(line, 'acknowledge', { feeling: entities.feeling }); }
      return null;
    }

    // ---- 4. LOOK AT THIS -----------------------------------------
    if (act === 'request' && LOOK.test(t)) {
      const who = resolve();
      // NEVER CLAIMS TO SEE. The product does not tell this layer what
      // is on the page, so it says what it can honestly say.
      if (who.sure && who.subject) {
        _didNotAsk();
        return _out(_fill(v.hail, _a(who.subject)) + ' ' + v.nice, 'acknowledge',
                    { subject: who.subject });
      }
      _asked();
      return _out(v.show + ' What have you made?', 'clarify');
    }

    // ---- 4b. PUT IT WHERE? ---------------------------------------
    if (act === 'request' && PLACE_REQ.test(t)) {
      // AMBIGUITY IS ABOUT THE CANDIDATES, NOT ABOUT THE THREAD. A
      // property naturally attaches to whatever is being discussed —
      // "it's red" after a dragon means the dragon. A PLACEMENT does
      // not: two things have been made and either could be the one, so
      // the thread's own subject is not evidence enough and the
      // question gets asked.
      const who = (_s.recent.length > 1)
        ? { sure: false, options: _s.recent.slice(0, 2) }
        : resolve();
      if (!who.sure && who.options && who.options.length > 1) {
        // TWO PLAUSIBLE THINGS IS A QUESTION, NOT A COIN TOSS.
        _s.pending = { kind: 'clarify', options: who.options };
        _asked();
        return _out(_fill(v.which, who.options[0], who.options[1]), 'clarify',
                    { options: who.options });
      }
      if (who.sure && who.subject) { _didNotAsk(); return _out(own.mine, 'answer', { subject: who.subject }); }
      _asked();
      return _out('What do you mean?', 'clarify');
    }

    // ---- 4c. A PLAIN OPINION -------------------------------------
    if (act === 'expression' && !entities.feeling && EVAL.test(t)) {
      _didNotAsk();
      return _out(v.nice, 'acknowledge');
    }

    // ---- 5. SOMETHING WAS MADE, OR DESCRIBED ---------------------
    if (act === 'statement') {
      // A NEW THING. Acknowledge it and open the door once.
      if (entities.object && (!_s.thread || _s.thread.subject !== entities.object)) {
        _startThread(entities.object);
        if (entities.colour) _s.thread.colour = entities.colour;
        if (entities.size) _s.thread.size = entities.size;
        if (entities.action) _s.thread.action = entities.action;
        if (entities.place) _s.thread.home = entities.place;
        // NOTICED, NOT MADE. "A dragon." greets something that has just
        // come into being; "The dragon." answers somebody pointing at one
        // that is already there. In the Ether it is always the second.
        const tpl = (entities.noticed && (v.hailSeen || NEUTRAL.hailSeen)) || v.hailNew;
        const said1 = _fill(tpl, _describe(_s.thread));   // the template carries its own article
        _asked();
        return _out(said1 + ' ' + v.ask, 'ask-followup', { subject: entities.object });
      }
      // A PROPERTY OF THE THING ALREADY BEING TALKED ABOUT.
      const who = resolve();
      if (!who.sure && PRONOUN.test(t) && who.options && who.options.length > 1) {
        _s.pending = { kind: 'clarify', options: who.options };
        _asked();
        return _out(_fill(v.which, who.options[0], who.options[1]), 'clarify',
                    { options: who.options });
      }
      if (who.sure) {
        if (!_s.thread) _startThread(who.subject);
        let changed = false;
        if (entities.colour) { _s.thread.colour = entities.colour; changed = true; }
        if (entities.size) { _s.thread.size = entities.size; changed = true; }
        if (entities.action) { _s.thread.action = entities.action; changed = true; }
        if (entities.place) { _s.thread.home = entities.place; changed = true; }
        if (!changed) return null;
        const desc = _describe(_s.thread);
        if (_mayAsk()) {
          _asked();
          const next = _s.thread.home ? null : (_s.thread.action ? own.askWhere : v.askDo);
          if (next) return _out(_fill(v.hail, _a(desc)) + ' ' + next, 'ask-followup',
                                { subject: _s.thread.subject });
        }
        _didNotAsk();
        return _out(_fill(v.hail, _a(desc)), 'reflect', { subject: _s.thread.subject });
      }
      return null;
    }

    // ---- 6. A QUESTION ABOUT THE THING BEING TALKED ABOUT --------
    //
    // CONTEXT BEFORE UNCERTAINTY. "Where does the dragon live?" is only
    // unknown if nobody has said. If the thread holds it, that is the
    // answer, and it came from the child rather than from anywhere this
    // Companion made up.
    if (act === 'question') {
      // A QUESTION THAT NAMES SOMETHING NEW STARTS THE THREAD. Sprint
      // 1N.5: in the Ether a conversation usually BEGINS with a
      // question about the story, and requiring a statement first meant
      // a Traveller could never start one.
      if (entities.object && (!_s.thread || _s.thread.subject !== entities.object)) {
        _startThread(entities.object);
      }
    }
    if (act === 'question' && _s.thread) {
      const th = _s.thread;
      const aboutIt = PRONOUN_ANY.test(t) || t.toLowerCase().indexOf(th.subject) !== -1;
      if (aboutIt) {
        // WHAT SHOULD IT DO IS ALWAYS THE CREATOR'S, and it is asked
        // FIRST — before the "where does it live" branch, which used to
        // catch "where should it go?" and answer a question with the
        // same question.
        if (/\bshould\b/i.test(t)) {
          _didNotAsk();
          return _out(own.mine, 'answer');
        }
        if (/\b(?:where|live|lives|living|go|goes)\b/i.test(t)) {
          if (th.home) { _didNotAsk(); return _out('In the ' + th.home + '.', 'answer', { fact: th.home }); }
          _asked();
          return _out(v.dunnoYet + ' ' + own.unknownWhere, 'uncertainty');
        }
        if (/\b(?:colour|color)\b/i.test(t)) {
          if (th.colour) { _didNotAsk(); return _out('It’s ' + th.colour + '.', 'answer', { fact: th.colour }); }
          _asked();
          return _out(v.dunnoYet + ' What colour should it be?', 'uncertainty');
        }
        if (/\b(?:do|does|doing|can)\b/i.test(t)) {
          if (th.action) { _didNotAsk(); return _out('It can ' + th.action + '.', 'answer', { fact: th.action }); }
          _asked();
          return _out(v.dunnoYet + ' ' + v.askDo, 'uncertainty');
        }
        // "What is the dragon thinking?" — nobody has decided, and
        // deciding is the child's.
        _asked();
        return _out(v.dunnoYet + ' ' + own.decide, 'uncertainty');
      }
    }

    // ---- 7. A BARE PRONOUN WITH NOTHING BEHIND IT ----------------
    if (PRONOUN.test(t) && !_s.thread && _s.recent.length === 0) {
      _asked();
      return _out('What do you mean?', 'clarify');
    }

    return null;   // not mine — the Mind takes it
  }

  /**
   * Record the turn, whoever answered it. Called for every exchange so
   * that a Mind answer does not break the thread — and bounded, so the
   * window stays a window.
   */
  function observe(said, reply, meta) {
    const t = normalize(said);
    if (!t) return;
    _s.turns.push({ said: t, reply: String(reply || ''), act: (meta && meta.act) || null });
    if (_s.turns.length > MAX_TURNS) _s.turns.shift();
    // WHETHER A BOUNDARY IS STILL STANDING. `certainty` is the Mind's
    // own diagnostic and already says which answers were refusals, so
    // there is no second list here to disagree with it.
    const cert = meta && meta.certainty;
    const kind = meta && meta.intent;
    if (cert === 'refused' || cert === 'private') _s.refused = { kind: kind || cert, reply: String(reply || '') };
    else if (cert) _s.refused = null;
  }

  /** The Companion asked something that a yes/no answers. */
  function expect(pending) {
    _s.pending = pending && pending.kind ? pending : null;
    return _s.pending;
  }

  const api = {
    VERSION: VERSION,
    MAX_TURNS: MAX_TURNS,
    STRATEGIES: STRATEGIES,
    VOICE: VOICE,
    NEUTRAL: NEUTRAL,
    normalize: normalize,
    read: read,
    resolve: resolve,
    consider: consider,
    observe: observe,
    expect: expect,
    state: state,
    reset: reset
  };
  try { window.CompanionConversation = api; } catch (e) {}
  return api;
})();
