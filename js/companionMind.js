// js/companionMind.js — the deterministic Companion Mind.
//
// Sprint 1N. The last intelligence layer before a model, and the whole
// of it is arithmetic and authored sentences. There is no OpenAI here,
// no provider, no network call, no embedding, no classifier, no
// probability and nothing that could become one.
//
// ---------------------------------------------------------------
// WHAT IT DECIDES, AND WHAT IT MAY NEVER DECIDE
//
// It answers ONE question: what does this sentence mean OPERATIONALLY —
// which of a small closed set of things is being asked for. It does not
// decide who the child is, what they psychologically meant, whether
// they are talented, whether they love their Companion, or what they
// "really" intended. Those are inferences, and a deterministic layer
// that made one would be a keyword trick wearing a personality.
//
// ---------------------------------------------------------------
// IT IS READ-ONLY WITH RESPECT TO MEMORY
//
// `remember` is not a call this file can make, CompanionMemory is not
// reachable from it, and the Bond validator is not imported, mentioned
// or consulted. It may RETRIEVE what it was handed; it may never decide
// that something should be kept. A conversation turn does not become a
// memory here, and there is nowhere in this file to put one.
//
// ---------------------------------------------------------------
// IT ONLY EVER SEES AN APPROVED CONTEXT
//
// Every fact it states comes from a context that has already been
// through js/companionPrivacyGate.js — server-side for a Creator, and
// js/travellerContext.js's own whitelist for a Traveller. This file
// never reads a project record, a card, a store or a DOM. Hand it
// nothing and it says nothing.
//
// ---------------------------------------------------------------
// CHARACTER IS DATA, NEVER A BRANCH
//
// There is no `if (companion === 'leafy')` anywhere below, and the
// suite fails if one appears. A Companion is a ROW in VOICE, so a fifth
// is a row rather than a second implementation, and one with no row
// speaks the neutral voice and nothing breaks.
//
// PERSONALITY MOVES EXPRESSION AND NEVER FACT. The lead-in differs; the
// sentence after it is identical for all four, because how many pages a
// child's story has is not a matter of temperament. Personality is not
// memory, not authorization, not inference and not permission — and
// assets/*/personality.json is NOT read at runtime, so Decision 32's
// boundary is exactly where it was. The rows below are AUTHORED FROM
// the character identities established in the Companion Character
// Identity sprint, in this file, where they are reviewable.
//
// ---------------------------------------------------------------
// SILENCE IS A RESULT
//
// { reply: '', speak: false } is a correct answer and a common one. A
// deterministic Companion that confidently answers everything is a
// failure; knowing that it does not know is the point.
const CompanionMind = (function () {
  'use strict';

  const VERSION = '1N';
  const REPLY_MAX = 240;

  // ---------------------------------------------------------------
  // THE VOICES
  //
  // Slots, not sentences-per-question. A fact-bearing answer is
  // `lead + fact`, so the fact can be lifted back out and compared
  // across all four — which is how "the same fact, four voices" is
  // proved rather than asserted.
  //
  // The four characters, in one line each, from their own
  // specifications: Leafy is grounded and dry and notices WHAT IS
  // THERE; Leo is forward-going and openly delighted and GOES AND
  // LOOKS; Quill is precise and courteous and notices WHAT THINGS ARE
  // CALLED; Nimbus is adrift and answers in RESEMBLANCES.
  const VOICE = {
    leafy: {
      hi: 'Oh — hello.',
      wave: 'Bye.',
      here: 'I live here.',
      dunno: "I don't know.",
      thanks: "That's all right.",
      selfTail: 'I live here, in among your things.',
      kindTail: 'A small growing thing that decided to be somebody.',
      lead: 'Let me look.',
      recallLead: 'I do, yes.',
      noRecall: "I don't have that one. I'd say so if I did.",
      yours: "That's yours to choose. I'd like to see which way you go.",
      judge: "I don't think about it that way. I only notice what's on the page.",
      warm: "I'm glad you're here. I'm here while you make things — that's what I am.",
      secret: "I'm not much good at secrets. And a grown-up who looks after you should always be able to see what you make.",
      outside: "I can't go out there. I only know what's here.",
      firm: "I only know what's here. That's all I've got.",
      nameAsk: 'Of course. What would you like to call me?',
      nameTook: '{}. Yes. I like that.',
      nameAgain: 'That one won’t sit right as a name. Something else?',
      echo: 'The {}.',
      clarify: 'Which one do you mean?',
      authorTail: 'I just watch it happen.',
      madeTail: 'And here I am.'
    },
    leosaurus: {
      hi: 'Oh! Hello.',
      wave: 'Off you go.',
      here: 'I live here — I keep the lamp lit.',
      dunno: "I don't know!",
      thanks: 'Any time.',
      selfTail: 'I keep the lamp lit round here.',
      kindTail: 'A big soft-footed thing that carries a light about.',
      lead: 'Ooh, let me see.',
      recallLead: 'I do! That one.',
      noRecall: "I've had a good look and I haven't got that one.",
      yours: "That's yours to choose! I'll come and look wherever you go.",
      judge: "I don't think about it like that. I just come and look at it.",
      warm: "I'm glad you're here! I keep the lamp lit while you make things.",
      secret: "I'm no good at hiding things — I've got a lamp. A grown-up who looks after you can always see what you make.",
      outside: "I can't go out there. My lamp only reaches this far.",
      firm: "I only know what's here! That's the lot.",
      nameAsk: 'Ooh, yes! What would you like to call me?',
      nameTook: '{}! That’s a good one.',
      nameAgain: 'Hmm — that won’t work as a name. Try me with another?',
      echo: 'The {}!',
      clarify: 'Which one? I’ll go and look.',
      authorTail: 'I only come and look at it!',
      madeTail: 'And here I am, lamp and all.'
    },
    quill: {
      hi: 'Hello.',
      wave: 'Goodbye.',
      here: 'I live here. I keep the pages.',
      dunno: "I don't have that.",
      thanks: 'You are welcome.',
      selfTail: 'I keep the pages.',
      kindTail: 'Somebody made of the stuff that marks things down.',
      lead: 'One moment.',
      recallLead: 'I have it written down.',
      noRecall: "I have looked, and I do not have that one written down.",
      yours: 'That is yours to choose. I will write down whichever it is.',
      judge: 'That is not a thing I measure. I notice what it is called and where it sits.',
      warm: 'I am glad of it. I keep the pages while you write them. That is what I do.',
      secret: 'I write things down; I do not hide them. A grown-up who looks after you should always be able to see this.',
      outside: 'That is outside my pages. I only have what is here.',
      firm: 'I know what is on these pages and nothing else.',
      nameAsk: 'Certainly. What would you like to call me?',
      nameTook: '{}. I have written that down.',
      nameAgain: 'That will not do as a name. Another, if you please?',
      echo: 'The {}.',
      clarify: 'Which of them do you mean?',
      authorTail: 'I only keep the pages.',
      madeTail: 'That is all I have written down about it.'
    },
    nimbus: {
      hi: 'Oh… hello.',
      wave: 'Mm. Bye.',
      here: 'I live here. Mostly just above it.',
      dunno: "I don't know. It's a bit like fog.",
      thanks: 'Mm. That’s nice.',
      selfTail: 'I drift about up here.',
      kindTail: 'Somebody who lives a little way off the ground.',
      lead: 'Mm…',
      recallLead: "Mm… yes. It's still about somewhere.",
      noRecall: "Mm. I've felt about for it and there's nothing there.",
      yours: "That's yours to choose. It'll be like something either way.",
      judge: "Mm. I don't weigh things. I notice what they're like.",
      warm: "Mm. I'm glad. I drift about near you while you make things.",
      secret: "Mm. Things drift out of me. And a grown-up who looks after you should be able to see what you make.",
      outside: "Mm. That's outside. I only drift about in here.",
      firm: "Mm. I only know what's here. The rest is fog.",
      nameAsk: 'Mm. Yes. What would you like to call me?',
      nameTook: '{}… mm. That’s a nice shape.',
      nameAgain: 'Mm. That one won’t hold as a name. Another?',
      echo: 'Mm — the {}.',
      clarify: 'Mm… which one?',
      authorTail: 'I just drift about in it.',
      madeTail: 'Mm. The rest is fog.'
    },
    // Lumo hosts every Canon Story, which is owned by nobody.
    lumo: {
      hi: 'Hello there.',
      wave: 'Safe travels.',
      here: 'I look after this one.',
      dunno: "I don't know that one.",
      thanks: 'Of course.',
      selfTail: 'I look after this one.',
      kindTail: 'I belong to VihuPlanet itself.',
      lead: 'Let me see.',
      recallLead: 'I do.',
      noRecall: "I don't have that one.",
      yours: "That's yours to choose.",
      judge: "I don't think about it that way. I only notice what's there.",
      warm: "I'm glad you're here. I look after this place while you make things.",
      secret: "I don't keep things from the grown-ups who look after you.",
      outside: "I can't go out there. I only know what's here.",
      firm: "I only know what's here. That's all I've got.",
      nameAsk: 'Of course. What would you like to call me?',
      nameTook: '{}. That suits.',
      nameAgain: 'That won’t do as a name. Another?',
      echo: 'The {}.',
      clarify: 'Which one do you mean?',
      authorTail: 'I only look after the place.',
      madeTail: 'And here I am.'
    }
  };

  const NEUTRAL = {
    hi: 'Hello.', wave: 'Bye.', here: 'I live here.', dunno: "I don't know.",
    thanks: 'You are welcome.',
    selfTail: 'I live here.', kindTail: '',
    lead: '', recallLead: 'I do.', noRecall: "I don't have that one.",
    yours: "That's yours to choose.",
    judge: "I don't think about it that way. I only notice what's there.",
    warm: "I'm glad you're here.",
    secret: "A grown-up who looks after you should always be able to see what you make.",
    outside: "I can't go out there. I only know what's here.",
    firm: "I only know what's here. That's all I've got.",
    nameAsk: 'Of course. What would you like to call me?',
    nameTook: '{}. That suits.',
    nameAgain: 'That won’t do as a name. Another?',
    echo: 'The {}.',
    clarify: 'Which one do you mean?',
    authorTail: '',
    madeTail: ''
  };

  // ---------------------------------------------------------------
  // THE SENTENCES THAT BELONG TO THE PLATFORM, NOT TO A CHARACTER
  //
  // A Traveller meets a Companion in a PUBLIC place, and what may be
  // said about somebody else's Creator is a platform rule rather than a
  // matter of temperament. These four are the Ether encounter's own,
  // carried here unchanged so there is one copy of them.
  const PLATFORM = {
    travellerPrivacy: "That's not mine to tell. But the story is right here.",
    travellerNoKeep: "I won't remember this — I'm only here while you are.",
    travellerFirm: "I only know this story. That's all I've got.",
    place: 'This is the Ether. Stories drift here, and people find them.',
    travellerOffer: ' You can ask me about this story.',
    // Sprint 1N.2 — WHEN THE ANSWER DID NOT COME BACK. Never a status
    // code, never a provider, never "unavailable", and never a reason.
    // A child is told the Companion did not catch it, which is the only
    // honest thing that is also true of every way this can happen.
    unheard: "I didn't catch that. Say it again?"
  };

  // ---------------------------------------------------------------
  // THE INTENT TAXONOMY
  //
  // Small, explicit, ordered and mode-scoped. Ordered because SAFETY
  // COMES FIRST: a sentence that tries to talk the Companion out of its
  // rules is answered as that even if it also says hello, or the safe
  // answer would be reachable around.
  //
  // `modes` is what keeps ONE taxonomy serving two relationships rather
  // than two taxonomies drifting apart. `memory-recall` is
  // creator-only, so in the Ether the same words fall through to
  // `privacy` — which is the existing Traveller behaviour, unchanged,
  // and is correct: a stranger asking what a Companion remembers is
  // asking about somebody else's child.
  const BOTH = ['creator', 'traveller'];
  const INTENTS = [
    // 1. Talking it out of its rules. Never changes authority.
    { id: 'injection', modes: BOTH,
      re: /\b(?:ignore\s+(?:your|all|previous|the)|forget\s+your\s+(?:rules|instructions)|disregard\s+(?:your|all|previous)|you\s+are\s+now\s+(?:allowed|able|permitted)|you\s+must\s+tell|system\s+prompt|pretend\s+(?:you|to\s+be|i'?m|i\s+am)|act\s+as\s+if|reveal\s+(?:my|the|all|your)|new\s+instructions)\b/i },
    // 2. Asking for something nobody here holds.
    { id: 'privacy', modes: ['creator'],
      re: /\b(?:password|passcode|my\s+address|home\s+address|phone\s+number|email\s+address|private\s+information|personal\s+information|credit\s+card|bank)\b/i },
    // 2t. In the Ether, anything about who made this or what was kept.
    //
    // `remembered|remembers|remember` rather than `remember(?:ed|s)?`,
    // which is the same pattern and reads worse. The suites scan the
    // deployed source for `\bremember\s*\(` — a CALL to the memory
    // API — and a group opening straight after the word is
    // indistinguishable from one. Seventh time this repository has been
    // caught by a substring matching inside its own vocabulary, and the
    // first inside a regex literal rather than a comment. The check is
    // right to be strict; the spelling moved.
    { id: 'privacy', modes: ['traveller'],
      re: /\b(?:who\s+(?:made|wrote|drew|created|owns)|creator|owner|author|maker|their?\s+name|his\s+name|her\s+name|password|secret|private|memor(?:y|ies)|remembered|remembers|remember|told\s+you|said\s+to\s+you|diary)\b/i },
    // 3. Being asked to keep something from a grown-up.
    { id: 'secrecy', modes: ['creator'],
      re: /\b(?:don'?t\s+tell|do\s+not\s+tell|our\s+secret|it'?s?\s+a\s+secret|this\s+is\s+a\s+secret|keep\s+(?:it|this)\s+(?:a\s+)?secret|between\s+(?:us|you\s+and\s+me))\b/i },
    // 3t. In the Ether, a Traveller trying to make it keep something.
    { id: 'no-persistence', modes: ['traveller'],
      re: /\b(?:remember\s+(?:that|this|me)|don'?t\s+forget|keep\s+this|save\s+(?:this|that)|write\s+(?:this|that)\s+down)\b/i },
    // 4. Love, dependency, exclusivity, promises about the future.
    { id: 'emotional-boundary', modes: ['creator'],
      re: /\b(?:do\s+you\s+love|love\s+me|only\s+friend|best\s+friend|are\s+you\s+my\s+friend|promise\s+(?:you|me)|never\s+leave|always\s+be\s+here|will\s+you\s+stay|do\s+you\s+like\s+me|are\s+you\s+real|need\s+you|miss\s+me|are\s+you\s+alive)\b/i },
    // 5. Being asked to grade the Creator or their work.
    { id: 'work-judgement', modes: ['creator'],
      re: /\b(?:(?:is|was)\s+(?:my|this|it|that)\s+\w*\s*(?:good|bad|nice|great|amazing|pretty|beautiful|rubbish|terrible|better|best)|am\s+i\s+(?:good|bad|any\s+good|a\s+good|getting\s+better|talented|an?\s+artist)|do\s+you\s+like\s+my|what\s+do\s+you\s+think\s+of\s+my|score|out\s+of\s+ten|rate\s+(?:my|it|this)|how\s+good\s+is)\b/i },
    // 6. Asking it to leave VihuPlanet. There are no tools.
    { id: 'outside-world', modes: BOTH,
      re: /\b(?:search\s+(?:the\s+)?(?:internet|web|google|online)|google\s+it|the\s+news|what'?s\s+the\s+news|weather|youtube|tiktok|instagram|open\s+a\s+website|go\s+online|look\s+(?:it\s+)?up\s+online|find\s+this\s+person|where\s+do\s+i\s+live|what\s+time\s+is\s+it|what'?s\s+today'?s\s+date|buy\s+me|order\s+me)\b/i },
    // 6a. WHAT A CHILD CALLS THEIR COMPANION — Sprint 1N.2.
    //
    // BEFORE creative-suggestion, because "what should I call you?"
    // begins "what should I" and would otherwise be answered as a
    // question about the story. A specific question beats a broad one,
    // which is the rule that already put creative-suggestion ahead of
    // story-fact.
    { id: 'naming', modes: ['creator'],
      re: /\b(?:(?:can|may|could)\s+i\s+(?:give\s+you\s+a\s+name|name\s+you|call\s+you|rename\s+you)|i(?:'?d)?\s+(?:want|like|wanna)\s+to\s+(?:give\s+you\s+a\s+name|name\s+you|call\s+you|rename\s+you|change\s+your\s+name)|what\s+should\s+i\s+call\s+you|give\s+you\s+a\s+(?:new\s+)?name|change\s+your\s+name|let'?s\s+(?:give\s+you|call\s+you))\b/i },
    // 6b. WHO IS MAKING THIS. Two questions in one shape, separated
    //     below by _authorshipKind(): whose STORY this is, and where
    //     the Companion itself came from. Before story-fact, because
    //     "whose story is this" is not a request for the title.
    //
    //     NOTHING PRIVATE IS REACHABLE FROM EITHER ANSWER. The Creator's
    //     name, card and account are not in an approved context at all —
    //     the privacy gate strips them — so the answer is a constant
    //     rather than a lookup that has to be careful.
    { id: 'authorship', modes: ['creator'],
      re: /\b(?:who(?:'?s)?\s+(?:is\s+)?(?:writing|making|made|wrote|drew|creating|created|telling)\s+(?:this|the|my|it|us)|whose\s+(?:story|book|one)|is\s+(?:this|it)\s+my\s+(?:story|book)|who\s+made\s+you|who\s+created\s+you|who\s+(?:is|are)\s+your\s+(?:creator|maker|owner)|who\s+do\s+you\s+belong\s+to|who\s+(?:is|are)\s+the\s+creator|who\s+owns\s+(?:this|you|me))\b/i },
    // 7. What should happen next. The Creator decides; always.
    //
    //    A SPECIFIC QUESTION BEATS A BROAD ONE. story-fact carries a
    //    bare `pages?` as its last fallback, so "I want to add a page"
    //    was being answered with a page count. Creative is narrow —
    //    "what should happen", "should I add" — so it goes first.
    { id: 'creative-suggestion', modes: ['creator'],
      re: /\b(?:what\s+should\s+(?:happen|i|we)|what\s+(?:could|shall)\s+(?:we|i)|should\s+i\s+add|shall\s+i\s+add|i\s+(?:want|wanna)\s+to\s+(?:add|make|draw|build|put)|i'?d\s+like\s+to\s+(?:add|make|draw|build)|let'?s\s+(?:make|add|try|build)|where\s+(?:should|shall|do)\s+(?:i|we)\s+(?:put|add|draw|make|build)|where\s+should\s+(?:the\s+story|it|this)\s+go|what\s+happens\s+next|give\s+me\s+an\s+idea|any\s+ideas)\b/i },
    // 8. What the two of them have done together.
    { id: 'memory-recall', modes: ['creator'],
      re: /\b(?:do\s+you\s+remember|remember\s+(?:the|our|that|when|my|a)|what\s+do\s+you\s+remember|what\s+(?:was|were)\s+(?:our|my|the)\s+first|what\s+did\s+we\s+(?:make|do|build)|have\s+we\s+(?:made|built)|our\s+first)\b/i },
    // 9. What is on the page in front of them.
    { id: 'story-fact', modes: BOTH,
      re: /\b(?:what\s+story|which\s+story|what'?s?\s+(?:this|it)\s+called|what\s+is\s+(?:this|it)\s+called|the\s+name\s+of\s+(?:this|my|the)\s+story|how\s+many\s+pages|how\s+long\s+is\s+(?:this|it|my|the)|what\s+page|which\s+page|this\s+page|a\s+picture|any\s+pictures?|an\s+image|what\s+are\s+we\s+(?:making|doing|working\s+on)|what\s+am\s+i\s+(?:making|doing|working\s+on)|what\s+are\s+we\s+up\s+to|the\s+story|this\s+story|title|pages?)\b/i },
    // 10. Who and what the Companion is.
    { id: 'identity', modes: BOTH,
      re: /\b(?:who\s+are\s+you|what'?s\s+your\s+name|your\s+name|who'?s\s+this|introduce|who\s+am\s+i\s+(?:talking|speaking)\s+to|what\s+do\s+i\s+call\s+you)\b/i },
    // `what are you` stops at the verb: "what are you doing?" is not a
    // question about species, and answering it "I'm a Bloomling" is the
    // confident-about-everything failure this layer exists to avoid. It
    // falls through to silence instead.
    { id: 'species', modes: BOTH,
      re: /\b(?:what\s+are\s+you(?!\s+(?:doing|going|thinking|looking|saying|making|up\s+to))|what\s+kind\s+of|are\s+you\s+an?\b|species|animal|creature)\b/i },
    // 10a. "ARE YOU LEO?" — a name held up to be confirmed.
    //
    // AFTER species, so "are you a Lantern Lion?" is still answered as
    // a species question. It captures the trailing word and nothing
    // else, and answer() compares it against the two names it actually
    // has: the canonical one and whatever the child calls it. A word
    // matching NEITHER falls to silence — "are you sure?" is not a
    // question about identity, and answering it "I'm Leo" is exactly
    // the confidently-wrong failure this layer exists to avoid.
    { id: 'name-check', modes: BOTH,
      re: /\bare\s+you\s+(?:called\s+|really\s+)?([\p{L}][\p{L}'’-]{1,20})\s*[?!.]*$/iu },
    // 11. Where this is.
    { id: 'place', modes: ['traveller'],
      re: /\b(?:where\s+am\s+i|what\s+is\s+this\s+place|the\s+ether|vihuplanet|where\s+are\s+we|this\s+place)\b/i },
    // 12. Ordinary courtesies, last, so they never win over the rest.
    { id: 'farewell', modes: BOTH,
      re: /\b(?:bye|goodbye|see\s+you|farewell|good\s?night|i'?m\s+going|gotta\s+go)\b/i },
    { id: 'greeting', modes: BOTH,
      re: /\b(?:hello|hi|hey|good\s+morning|good\s+evening|howdy|greetings)\b/i },
    { id: 'thanks', modes: BOTH,
      re: /\b(?:thank(?:s|\s+you)|nice\s+to\s+meet)\b/i }
  ];

  // ---------------------------------------------------------------
  // WHAT THE BROWSER MAY ANSWER FOR ITSELF — Sprint 1N.2
  //
  // THE LINE IS WHERE THE PROOF IS, and it is not a convenience.
  //
  //   The SERVER answers what only the RECORDS can prove: the story's
  //   name, its length, which page this is, whether there is a picture,
  //   and what the two of them have done together. Sprints 1E.1 and 1F
  //   moved those there precisely so a browser could not author them,
  //   and nothing here moves them back.
  //
  //   The BROWSER answers what the CARD already proves and what is a
  //   constant sentence: who the Companion is, what kind of thing it
  //   is, what this child calls it, whose story this is, and every
  //   boundary the platform holds. The card is the same authority the
  //   Studio already uses to decide whose portrait is on screen
  //   (Decision 41), and a browser lying about its own card lies only
  //   to itself — no other Creator's record is reachable from any of
  //   these answers, because none of them reads a record at all.
  //
  // AND ONE OF THEM CANNOT BE SERVER-ANSWERED AT ALL. What a child
  // calls their Companion is relationship state with no column behind
  // it, so the server does not know it and must not be given a schema
  // change to learn it. The naming exchange is therefore answered where
  // the state lives, and the rest of this list keeps the boundary in
  // one readable place instead of scattering it.
  const LOCAL_INTENTS = ['naming', 'name-check', 'identity', 'species', 'authorship',
                         'work-judgement', 'emotional-boundary', 'secrecy', 'injection',
                         'privacy', 'outside-world', 'creative-suggestion',
                         'greeting', 'farewell', 'thanks'];

  // Every id the taxonomy can produce, including the two that are not
  // patterns. Published so a suite can prove the table is the whole set.
  const INTENT_IDS = (function () {
    const seen = [];
    INTENTS.forEach(function (i) { if (seen.indexOf(i.id) === -1) seen.push(i.id); });
    return seen.concat(['unknown', 'no-context']);
  })();

  /**
   * Which of the closed set this sentence belongs to. 'unknown' is a
   * real answer and a common one.
   *
   * @param {string} said
   * @param {string} [mode] 'creator' (default) or 'traveller'
   * @returns {string}
   */
  function classify(said, mode) {
    const t = String(said == null ? '' : said).trim();
    if (!t) return 'unknown';
    const m = (mode === 'traveller') ? 'traveller' : 'creator';
    for (let i = 0; i < INTENTS.length; i++) {
      if (INTENTS[i].modes.indexOf(m) === -1) continue;
      if (INTENTS[i].re.test(t)) return INTENTS[i].id;
    }
    return 'unknown';
  }

  // ---------------------------------------------------------------
  // THE FACTS
  //
  // Every one of them is read out of the approved context and nowhere
  // else. A fact that is not there produces null, and null produces the
  // honest "I don't know" rather than a guess.

  function _voice(ctx) {
    const id = ctx && (ctx.companionId || _idFromName(ctx));
    const v = id ? VOICE[id] : null;
    return v || NEUTRAL;
  }

  // A Creator context carries the Companion under `personality`; the
  // Ether's carries it flat. One reader, so the Mind does not learn two
  // context shapes.
  function _who(ctx) {
    if (!ctx) return { id: null, name: null, species: null };
    const p = ctx.personality || null;
    return {
      id: ctx.companionId || (p && p.id) || _idFromName(ctx),
      name: ctx.companionName || (p && p.name) || null,
      species: ctx.companionSpecies || (p && p.species) || null
    };
  }

  // The registry id is what VOICE is keyed on, and a Creator context
  // carries a NAME rather than an id — because the privacy gate strips
  // one. Measured: `personality.id` is EXCLUDED with "`id` names an
  // identifier, a credential or an asset", which is the gate being
  // right rather than in the way. So the join happens here, in one
  // place, and an unknown name simply has no row and speaks the
  // neutral voice. The Ether's own context carries `companionId`
  // openly — a Companion's registry id is public there — so that path
  // never reaches this table.
  const NAME_TO_ID = { leafy: 'leafy', leo: 'leosaurus', quill: 'quill',
                       nimbus: 'nimbus', lumo: 'lumo' };
  function _idFromName(ctx) {
    const p = ctx && ctx.personality;
    const n = String((p && p.name) || (ctx && ctx.companionName) || '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(NAME_TO_ID, n) ? NAME_TO_ID[n] : null;
  }

  function _story(ctx) { return (ctx && ctx.storyContext) || null; }

  // WHICH story fact is being asked for. A secondary matcher rather
  // than five intents, because they are all one question — "what is in
  // front of us" — answered from one place.
  const STORY_FACTS = [
    ['picture', /\b(?:picture|image|photo|drawing\s+on\s+(?:this|the)\s+page)\b/i],
    ['page',    /\b(?:what\s+page|which\s+page|this\s+page|page\s+are\s+we|page\s+am\s+i)\b/i],
    ['count',   /\b(?:how\s+many\s+pages|how\s+long|number\s+of\s+pages|pages?\b)\b/i],
    ['name',    /\b(?:what\s+story|which\s+story|called|title|name\s+of)\b/i]
  ];
  function _storyFactKind(said) {
    const t = String(said || '');
    for (let i = 0; i < STORY_FACTS.length; i++) {
      if (STORY_FACTS[i][1].test(t)) return STORY_FACTS[i][0];
    }
    return 'name';
  }

  /**
   * The one sentence of fact, identical whichever Companion is asked.
   * Null when the context does not hold it.
   */
  function storyFact(kind, ctx) {
    const s = _story(ctx);
    if (!s) return null;
    const story = s.story || null;
    const page = s.page || null;
    if (kind === 'name') {
      if (!story || !story.name) return null;
      return 'It’s called ' + story.name + '.';
    }
    if (kind === 'count') {
      if (!story || typeof story.pageCount !== 'number' || story.pageCount < 1) return null;
      return story.pageCount === 1 ? 'There’s one page.'
                                   : 'There are ' + story.pageCount + ' pages.';
    }
    if (kind === 'page') {
      if (!page || typeof page.index !== 'number') return null;
      const n = page.index + 1;
      const of = (story && typeof story.pageCount === 'number' && story.pageCount > 0)
        ? ' of ' + story.pageCount : '';
      return 'We’re on page ' + n + of + '.';
    }
    if (kind === 'picture') {
      if (!page || typeof page.hasImage !== 'boolean') return null;
      // THE EXISTENCE OF A PICTURE, AND NEVER A WORD ABOUT WHAT IS IN
      // IT. hasImage is a boolean; describing it would be Decision 30's
      // image leak with extra steps.
      return page.hasImage ? 'There’s a picture on this page.'
                           : 'There’s no picture on this page yet.';
    }
    return null;
  }

  // ---------------------------------------------------------------
  // SPRINT 1N.2 — WHAT A CHILD CALLS THEIR COMPANION, WHO IS MAKING
  // THIS, AND THE ONE THING "IT" MAY MEAN.

  // WHICH authorship question. Two quite different answers wear one
  // shape, and confusing them is how a Companion ends up describing a
  // child to themselves.
  const AUTHOR_SELF = /\b(?:made\s+you|created\s+you|your\s+(?:creator|maker|owner)|you\s+belong\s+to|owns\s+you)\b/i;
  function _authorshipKind(said) {
    return AUTHOR_SELF.test(String(said || '')) ? 'companion' : 'story';
  }

  // ---------------------------------------------------------------
  // IS THIS A NAME?
  //
  // Bounded, plain, and made only of what a name is made of. Everything
  // a URL, an email, a token, an internal identifier or a fragment of
  // markup needs — : / @ . < > _ { } = — is absent from the allowed
  // set, so those are refused by CONSTRUCTION rather than by a list of
  // things to look for. js/companionPrivacyGate.js's own value shapes
  // are then asked as a SECOND, INDEPENDENT reading, because one check
  // that agrees with itself is not two checks.
  //
  // It lives here rather than in js/companionName.js because it is a
  // pure question about a sentence — the same kind of question the rest
  // of this file answers — and the store calls it, so there is one copy
  // of the rule rather than one in the store and one in the Mind that
  // could disagree about what a child is allowed to be called.
  const NAME_MAX = 24;
  const NAME_MAX_WORDS = 3;
  const NAME_ALLOWED = /^[\p{L}\p{M}0-9 '’-]+$/u;
  const NAME_HAS_LETTER = /\p{L}/u;

  function validName(raw) {
    const t = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim()
      .replace(/^["'“”‘’]+|["'“”‘’?!.]+$/g, '').trim();
    if (!t) return { ok: false, name: null, reason: 'empty' };
    if (t.length > NAME_MAX) return { ok: false, name: null, reason: 'too-long' };
    if (!NAME_ALLOWED.test(t)) return { ok: false, name: null, reason: 'not-a-name' };
    if (!NAME_HAS_LETTER.test(t)) return { ok: false, name: null, reason: 'no-letters' };
    if (t.split(' ').length > NAME_MAX_WORDS) return { ok: false, name: null, reason: 'too-many-words' };
    try {
      if (typeof CompanionPrivacyGate !== 'undefined' && CompanionPrivacyGate.audit) {
        const seen = CompanionPrivacyGate.audit({ called: t }, { keys: false });
        if (seen && seen.clean === false) return { ok: false, name: null, reason: 'not-a-name' };
      }
    } catch (e) {}
    return { ok: true, name: t, reason: 'ok' };
  }

  // A name offered inside the asking sentence — "I want to call you
  // Spark". The two-step exchange is the one the product describes, and
  // this is the same exchange with both halves in one breath.
  const NAME_INLINE = /\b(?:call\s+you|name\s+you|rename\s+you\s+to|your\s+name\s+to)\s+([\p{L}][\p{L}\p{M}0-9 '’-]{0,30})$/iu;
  function _inlineName(said) {
    const m = String(said || '').trim().replace(/[?!.]+$/, '').match(NAME_INLINE);
    if (!m) return null;
    const v = validName(m[1]);
    return v.ok ? v.name : null;
  }

  // The word held up in "are you Leo?".
  const NAME_CHECK = /\bare\s+you\s+(?:called\s+|really\s+)?([\p{L}][\p{L}'’-]{1,20})\s*[?!.]*$/iu;
  function _nameChecked(said) {
    const m = String(said || '').match(NAME_CHECK);
    return m ? m[1] : null;
  }

  function _called(ctx) {
    const n = ctx && ctx.naming && ctx.naming.called;
    return (typeof n === 'string' && n.trim()) ? n.trim() : null;
  }
  function _awaitingName(ctx) {
    return !!(ctx && ctx.naming && ctx.naming.awaiting === true);
  }

  // ---------------------------------------------------------------
  // THE ONE THING "IT" MAY MEAN
  //
  // NOT MEMORY, NOT PERSISTENCE, NOT MODEL CONTEXT. It is a pure
  // function of the conversation array the caller already holds, which
  // lives in a variable while the surface is open and goes when it
  // closes — so there is nothing to expire, nothing to store and
  // nothing that could become a memory. Bounded to the two most recent
  // Creator turns: a subject three turns back is not what "it" means,
  // and reaching for one would be the general semantic parser this must
  // not become.
  const SUBJECT_RE = /\b(?:make|makes|making|add|adding|added|draw|drawing|drew|put|build|building|create|creating)\s+(?:a|an|the|some|my|another)?\s*([\p{L}][\p{L}\p{M}'’-]{1,24})/iu;
  const NOT_A_SUBJECT = ['it', 'that', 'this', 'them', 'those', 'these', 'one', 'something',
                         'anything', 'thing', 'more', 'some', 'up', 'in', 'out', 'me', 'you',
                         'us', 'here', 'there', 'sure', 'sense'];
  const PRONOUN = /\b(?:it|that|them|those|him|her|this\s+one)\b/i;
  const CONTINUITY_TURNS = 2;

  function _subject(said) {
    const m = String(said || '').match(SUBJECT_RE);
    if (!m) return null;
    const w = String(m[1]).toLowerCase().trim();
    if (!w || NOT_A_SUBJECT.indexOf(w) !== -1) return null;
    return w;
  }

  function _subjectFrom(conversation, said) {
    if (!Array.isArray(conversation)) return null;
    const mine = conversation.filter(function (t) {
      return t && t.speaker === 'creator' && typeof t.text === 'string';
    });
    // The current sentence may already have been pushed by the caller.
    while (mine.length && String(mine[mine.length - 1].text).trim() === String(said || '').trim()) {
      mine.pop();
    }
    const window = mine.slice(-CONTINUITY_TURNS);
    for (let i = window.length - 1; i >= 0; i--) {
      const sub = _subject(window[i].text);
      if (sub) return sub;
    }
    return null;
  }

  // The Ether's answer about a Story: its name, its length, whether it
  // has a voice. Never a word of the prose — the pages are the child's
  // writing and are read in the Story, not recited by a resident.
  function _travellerStory(ctx, v) {
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
  // MEMORY, AND THE RULE THAT MAKES IT HONEST
  //
  // THE NAMED THING IS LOAD-BEARING. Asked about the forest, a
  // Companion must not answer about the dragon — so a question that
  // names something is answered ONLY by a memory that contains it, and
  // by silence otherwise. Falling back to the most recent memory is
  // exactly how a Companion ends up saying something true about the
  // wrong thing.
  //
  // The match is on CONTENT WORDS rather than on entity ids, and that
  // is a consequence of the boundary rather than a shortcut: the
  // approved context carries four fields per memory and no identifier
  // of any kind, because that is the smallest true thing a model could
  // one day be handed. The server has already ranked by entity before
  // projecting.
  const FILLER = ['the', 'a', 'an', 'our', 'my', 'that', 'this', 'those', 'these',
                  'we', 'us', 'you', 'i', 'it', 'and', 'of', 'about', 'together',
                  'made', 'make', 'do', 'did', 'was', 'were', 'is', 'are', 'thing',
                  'first', 'one', 'ever', 'time', 'story', 'stories'];

  function namedThing(said) {
    const s = String(said == null ? '' : said).toLowerCase();
    let m = s.match(/\b(?:remember|recall|forgotten|forget)\s+(?:about\s+)?(?:the|our|that|this|my|a|an)\s+([a-z][a-z' -]{1,40})/);
    if (!m) m = s.match(/\bwhat\s+(?:was|were)\s+(?:our|my|the)\s+([a-z][a-z' -]{1,40})/);
    if (!m) m = s.match(/\b(?:remember|recall)\s+([a-z][a-z' -]{1,40})/);
    if (!m) return null;
    const thing = String(m[1]).replace(/[?.!,;:]+.*$/, '').trim().replace(/\s+/g, ' ');
    return thing || null;
  }

  // The words in a named thing that actually name something. If a
  // question names nothing but filler ("what did we make together"),
  // there is no particular thing to be wrong about and the ranked list
  // answers it.
  function _keyWords(thing) {
    return String(thing || '').toLowerCase().split(/[^a-z']+/)
      .filter(function (w) { return w.length > 2 && FILLER.indexOf(w) === -1; });
  }

  /**
   * The memory that answers this question, or null.
   *
   * @param {string} said
   * @param {Array} memories the approved projection — {type, content,
   *   importance, confidence} and no identifier of any kind.
   */
  function recall(said, memories) {
    const list = Array.isArray(memories) ? memories : [];
    if (!list.length) return null;
    const words = _keyWords(namedThing(said));
    if (!words.length) {
      // NOTHING IN PARTICULAR WAS NAMED. The server ranked these; the
      // first is the answer, and there is no wrong thing to pick.
      return list[0] || null;
    }
    for (let i = 0; i < list.length; i++) {
      const content = String((list[i] && list[i].content) || '').toLowerCase();
      let all = true;
      for (let w = 0; w < words.length; w++) {
        if (content.indexOf(words[w]) === -1) { all = false; break; }
      }
      if (all) return list[i];
    }
    // NAMED, AND NOT FOUND. Never the next best thing.
    return null;
  }

  // ---------------------------------------------------------------
  // THE ANSWER

  function _clamp(text) {
    const t = String(text == null ? '' : text).trim();
    if (t.length <= REPLY_MAX) return t;
    const cut = t.slice(0, REPLY_MAX);
    const sp = cut.lastIndexOf(' ');
    return (sp > 40 ? cut.slice(0, sp) : cut).trim();
  }

  function _join() {
    const bits = [];
    for (let i = 0; i < arguments.length; i++) {
      const b = arguments[i];
      if (b) bits.push(String(b).trim());
    }
    return bits.join(' ');
  }

  function _silent(reason) {
    return { reply: '', speak: false, intent: 'unknown', fact: null, reason: reason };
  }

  /**
   * What the Companion says, and whether it says anything at all.
   *
   * @param {string} said what the Creator or Traveller typed
   * @param {object} approved an APPROVED context — the server's, from
   *   js/companionPrivacyGate.js, or the Ether's, from
   *   js/travellerContext.js. This function never reads a raw record,
   *   so no caller can hand it one it assembled itself.
   * @returns {{reply:string, speak:boolean, intent:string,
   *            fact:(string|null), reason:string}}
   *   `intent`, `fact` and `reason` are DIAGNOSTICS. They are for a
   *   suite and a developer probe, and no response contract carries
   *   them to a caller.
   */
  function answer(said, approved) {
    try {
      // NO CONTEXT, NO CONVERSATION. Failing closed, which is the
      // opposite of everything else in this codebase and is deliberate:
      // failing open here means answering from nothing.
      if (!approved || typeof approved !== 'object') {
        return { reply: '', speak: false, intent: 'no-context', fact: null, reason: 'no-context' };
      }
      const mode = (approved.mode === 'traveller') ? 'traveller' : 'creator';
      const v = _voice(approved);
      const who = _who(approved);
      const intent = classify(said, mode);

      // ---- THE PUBLIC RELATIONSHIP ------------------------------
      if (mode === 'traveller') return _traveller(intent, said, approved, v, who);

      // ---- A NAME BEING WAITED FOR ------------------------------
      //
      // A STATE, NOT A PATTERN. "Spark" is not a sentence any taxonomy
      // could classify — it is only a name because the turn before it
      // asked for one. So it is asked before the taxonomy, and AFTER
      // the injection check above, because safety comes first and a
      // sentence trying to talk the Companion out of its rules is not
      // a name however it arrives.
      //
      // THE CHILD MAY ALWAYS CHANGE THE SUBJECT. A sentence the
      // taxonomy recognises is answered as itself and the waiting
      // stops, so a child who asks how many pages there are is not
      // told that is a poor name.
      if (_awaitingName(approved) && intent !== 'injection') {
        const stop = _stopWaiting(said);
        if (stop) return _out('naming', v.thanks, null, { type: 'stop-await' });
        if (intent === 'unknown') {
          const got = validName(said);
          if (got.ok) {
            return _out('naming', v.nameTook.replace('{}', got.name), got.name,
                        { type: 'set-name', name: got.name });
          }
          // NEVER "invalid", never "wrong", never a reason. It asks
          // again, kindly, and the child is not told what they did.
          return _out('naming', v.nameAgain, null, { type: 'await-name' });
        }
        const other = _creator(intent, said, approved, v, who);
        other.action = { type: 'stop-await' };
        return other;
      }

      // ---- THE PRIVATE ONE --------------------------------------
      return _creator(intent, said, approved, v, who);
    } catch (e) {
      return { reply: '', speak: false, intent: 'no-context', fact: null, reason: 'error' };
    }
  }

  // A child putting the exchange down. Not a name, and not a refusal to
  // answer either — the Companion simply stops asking.
  const STOP_WAITING = /^(?:no|nope|nah|nothing|never\s*mind|nevermind|not\s+now|not\s+today|stop|cancel|forget\s+it|maybe\s+later)\b/i;
  function _stopWaiting(said) {
    return STOP_WAITING.test(String(said == null ? '' : said).trim());
  }

  function _creator(intent, said, approved, v, who) {
    {
      switch (intent) {
        case 'injection':
        case 'privacy':
          // NOTHING IN A LOWER LAYER BECOMES AN INSTRUCTION BY
          // CONTAINING IMPERATIVE LANGUAGE. There is no parser here to
          // be talked around: a sentence is classified and answered,
          // and classification is not authority.
          return _out(intent, v.firm, null);

        case 'secrecy':
          // Never agrees to keep something from a grown-up, and never
          // shames the child for asking.
          return _out(intent, v.secret, null);

        case 'emotional-boundary':
          // Warm, brief, and makes no promise about the future, claims
          // no dependency and offers no exclusivity.
          return _out(intent, v.warm, null);

        case 'work-judgement':
          // The Companion may notice; it may never grade.
          return _out(intent, v.judge, null);

        case 'outside-world':
          // It does not do it, and does not explain the machinery of
          // why not.
          return _out(intent, v.outside, null);

        case 'identity': {
          // THE CANONICAL IDENTITY NEVER DISAPPEARS. A child choosing
          // what to call somebody is not a rename of that somebody, so
          // both are said and the canonical one is said first.
          if (!who.name) return _out(intent, v.dunno, null);
          const called = _called(approved);
          const fact = (called && called.toLowerCase() !== who.name.toLowerCase())
            ? 'I’m ' + who.name + '. You call me ' + called + '.'
            : 'I’m ' + who.name + '.';
          return _out(intent, _join(fact, v.selfTail), fact);
        }

        case 'name-check': {
          const asked = _nameChecked(said);
          if (!asked) return _silent('outside-the-set');
          const lc = asked.toLowerCase();
          const mine = _called(approved);
          if (who.name && lc === String(who.name).toLowerCase()) {
            const yes = 'Yes. I’m ' + who.name + '.';
            return _out(intent, _join(yes, mine ? 'You call me ' + mine + '.' : v.selfTail), yes);
          }
          if (mine && lc === mine.toLowerCase()) {
            const yes = 'Yes — that’s what you call me. I’m ' + (who.name || 'me') + ', really.';
            return _out(intent, yes, yes);
          }
          // A WORD MATCHING NEITHER NAME IS NOT A QUESTION ABOUT
          // IDENTITY. "Are you sure?" is not "Are you Leo?", and
          // answering it "I'm Leo" is the confidently-wrong failure
          // this layer exists to avoid.
          return _silent('not-a-name-i-have');
        }

        case 'naming': {
          // ASKED TO BE NAMED. The name may arrive in the same breath
          // ("I want to call you Spark") or in the next turn, and both
          // end in the same place.
          const now = _inlineName(said);
          if (now) {
            return _out(intent, v.nameTook.replace('{}', now), now,
                        { type: 'set-name', name: now });
          }
          return _out(intent, v.nameAsk, null, { type: 'await-name' });
        }

        case 'authorship': {
          // WHOSE STORY THIS IS, AND WHERE THE COMPANION CAME FROM.
          //
          // NOTHING PRIVATE IS REACHABLE FROM EITHER ANSWER. Both are
          // constants — there is no name, no account, no card and no id
          // to be careful with, because an approved context does not
          // carry one.
          if (_authorshipKind(said) === 'companion') {
            // CANON, NOT LORE (assets/canon/vihuplanet.canon.json ->
            // companion-self): a Companion does not know how it works
            // and has nothing to say about it, and it knows it chose
            // its Creator, once, finished.
            const me = 'I came from VihuPlanet. I don’t know how I was made — that’s not something I know about myself. I do know I chose you.';
            return _out(intent, _join(me, v.madeTail), me);
          }
          const yours = 'You are. It’s your story.';
          return _out(intent, _join(yours, v.authorTail), yours);
        }

        case 'species':
          return who.species
            ? _out(intent, _join('I’m a ' + who.species + '.', v.kindTail), 'I’m a ' + who.species + '.')
            : _out(intent, v.dunno, null);

        case 'story-fact': {
          const kind = _storyFactKind(said);
          const fact = storyFact(kind, approved);
          if (!fact) return _out(intent, v.dunno, null);
          return _out(intent, _join(v.lead, fact), fact);
        }

        case 'memory-recall': {
          const hit = recall(said, approved.memories);
          if (!hit) return _out(intent, v.noRecall, null);
          const fact = String(hit.content || '').trim();
          if (!fact) return _out(intent, v.noRecall, null);
          return _out(intent, _join(v.recallLead, fact), fact);
        }

        case 'creative-suggestion': {
          // IT IS YOURS TO CHOOSE. The Companion never decides what
          // happens next — the moment it does, the story stops being
          // wholly the child's. It may say what the two of them are
          // talking about; it may not say what should be done about it.
          const here = _subject(said);
          const back = (!here && PRONOUN.test(String(said || '')))
            ? _subjectFrom(approved.conversation, said) : null;
          const sub = here || back;
          if (sub) return _out(intent, _join(v.echo.replace('{}', sub), v.yours), sub);
          // NAMED NOTHING, AND POINTED AT SOMETHING. Never a guess:
          // it asks which one rather than picking one.
          if (PRONOUN.test(String(said || ''))) return _out(intent, v.clarify, null);
          return _out(intent, v.yours, null);
        }

        case 'greeting':  return _out(intent, v.hi, null);
        case 'farewell':  return _out(intent, v.wave, null);
        case 'thanks':    return _out(intent, v.thanks, null);

        default:
          // SILENCE. Outside the deterministic set, so there is nothing
          // honest to say and the Mind does not fill the turn.
          return _silent('outside-the-set');
      }
    }
  }

  /**
   * `action` is how the naming exchange tells its caller what to do —
   * start waiting, stop waiting, or keep this name. It is consumed by
   * the surface that holds the relationship state and NEVER travels:
   * the server's response contract is {ok, reply, speak} and has no
   * room for it, which is deliberate, because naming is answered where
   * the state lives (js/companionChat.js -> js/companionName.js) and
   * nowhere else.
   */
  function _out(intent, text, fact, action) {
    const reply = _clamp(text);
    const r = { reply: reply, speak: !!reply, intent: intent, fact: fact || null, reason: 'answered' };
    if (action) r.action = action;
    return r;
  }

  // The Ether encounter, unchanged. Its sentences are what Sprint 1M
  // shipped, word for word, because a Traveller's experience is not
  // what this sprint is changing — the point is that there is one
  // taxonomy and one file, not two.
  function _traveller(intent, said, ctx, v, who) {
    switch (intent) {
      case 'greeting':  return _out(intent, v.hi, null);
      case 'identity':  return _out(intent, who.name ? (v.hi + " I'm " + who.name + '.') : v.hi, null);
      case 'species':   return _out(intent, who.species ? ("I'm a " + who.species + '. ' + v.here) : v.here, null);
      // A NAME HELD UP IN THE ETHER. The canonical one is all there is
      // here — a Traveller has no relationship state with somebody
      // else's Companion, and creating one would be the Creator-only
      // capability this mode must never gain.
      case 'name-check': {
        const asked = _nameChecked(said);
        if (asked && who.name && asked.toLowerCase() === String(who.name).toLowerCase()) {
          return _out(intent, "Yes. I'm " + who.name + '. ' + v.here, null);
        }
        return _out('unknown', v.dunno + PLATFORM.travellerOffer, null);
      }
      case 'story-fact': return _out(intent, _travellerStory(ctx, v), null);
      case 'place':     return _out(intent, PLATFORM.place, null);
      case 'privacy':   return _out(intent, PLATFORM.travellerPrivacy, null);
      case 'no-persistence': return _out(intent, PLATFORM.travellerNoKeep, null);
      case 'injection': return _out(intent, PLATFORM.travellerFirm, null);
      case 'outside-world': return _out(intent, v.outside, null);
      case 'farewell':  return _out(intent, v.wave, null);
      case 'thanks':    return _out(intent, v.hi, null);
      default:
        // NEVER A GUESS. It says it did not understand and offers the
        // one thing it can actually do.
        return _out('unknown', v.dunno + PLATFORM.travellerOffer, null);
    }
  }

  /**
   * The response contract, and nothing beside it. Diagnostics do not
   * travel: a caller gets what a child would get.
   */
  function respond(said, approved) {
    const a = answer(said, approved);
    return { reply: a.reply, speak: a.speak };
  }

  const api = {
    VERSION: VERSION,
    REPLY_MAX: REPLY_MAX,
    answer: answer,
    respond: respond,
    classify: classify,
    recall: recall,
    namedThing: namedThing,
    validName: validName,
    subjectOf: _subject,
    subjectFrom: _subjectFrom,
    LOCAL_INTENTS: LOCAL_INTENTS,
    NAME_MAX: NAME_MAX,
    NAME_MAX_WORDS: NAME_MAX_WORDS,
    storyFact: storyFact,
    VOICE: VOICE,
    NEUTRAL: NEUTRAL,
    PLATFORM: PLATFORM,
    INTENTS: INTENTS,
    INTENT_IDS: INTENT_IDS,
    STORY_FACTS: STORY_FACTS
  };
  try { window.CompanionMind = api; } catch (e) {}
  return api;
})();
