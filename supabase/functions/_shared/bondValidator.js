// bondValidator — VihuPlanet decides what a Companion remembers.
//
// Sprint 1G. The model may PROPOSE a meaningful moment. This file is
// what decides, and it is deterministic: no scoring model, no second
// model call, no judgement that cannot be read off the page.
//
// It lives in _shared/ because it is server-only — the browser never
// validates a proposal, and there is nothing here for it to call. It is
// generated into supabase/functions/companion-chat/index.ts by
// tools/edge-auth-test/sync-shared.js, exactly as the auth gate is, so
// there is one copy to read and one copy to deploy.
//
// ---------------------------------------------------------------
// WHAT A BOND MOMENT IS
//
// Something that meaningfully contributes to the shared history of one
// Creator and one Companion. NOT every conversation, every message,
// every creation, every compliment, every visit.
//
// FIVE MEANINGFUL MEMORIES ARE BETTER THAN FIVE HUNDRED. Everything
// below is written to refuse rather than to accept, and the default
// answer is no.
//
// ---------------------------------------------------------------
// NO SCORE, EVER
//
// There is no bond score, affection score, relationship percentage, XP,
// level, streak or engagement metric here, and none may be added. A
// bond is represented by a small number of real memories and by nothing
// else — the same discipline js/magicCard.js's growthSignals() states
// ("no counters, no levels") and Decision 20 states for Cheer.
//
// Message count, session length, visit frequency and emotional
// intensity are explicitly NOT evidence of anything, and none of them
// is read.

// ---------------------------------------------------------------
// POLICY, IN ONE PLACE

export const BOND = {
  // Which kinds a MODEL may propose. Deliberately two of the four:
  //
  //   shared — the Bond Moment type. A thing the two of them did.
  //   world  — an established fact about the story's world, and only
  //            with authoritative support (see EVIDENCE below).
  //
  // `creator` is REFUSED in this sprint. Everything that would fill it
  // ("they prefer…", "they always…", "they like dragons") is a trait or
  // a preference, and Decision 30 already records that as an inference
  // rather than a memory. A concrete thing that happened belongs in
  // `shared`, where it is an event rather than a characteristic.
  //
  // `self` is REFUSED because js/companionMemoryEvents.js already
  // records it deterministically — the bond, set once at claim. A model
  // proposing it would duplicate a fact the platform already knows for
  // certain, at lower confidence.
  proposableKinds: ['shared', 'world'],

  // What the platform stamps on an accepted proposal. NEVER 'confirmed'
  // — that belongs to the deterministic recorders, which read a record
  // rather than interpret a sentence. NEVER 'inferred', which
  // js/companionMemory.js refuses at the door.
  confidence: 'observed',

  minChars: 20,
  maxChars: 400,

  // The strong signals. A proposal must be able to name at least one,
  // and the signal must be findable in what the CREATOR actually said —
  // never in the model's own opinion that something felt significant.
  signals: ['explicit-request', 'shared-history', 'companion-role', 'grounded-milestone'],
};

// ---------------------------------------------------------------
// THE SIGNALS
//
// Read off the Creator's own turns. Each is a narrow, literal pattern:
// this is deliberately not a classifier, because a classifier is a
// second model and a second model is a second thing to be wrong.

const SIGNAL_PATTERNS = [
  // "Remember this." — a child asking, in as many words.
  ['explicit-request', /\b(remember|don'?t forget|keep)\s+(this|that|it|when|us|our)\b/i],
  // Reaching back to something they made together.
  ['shared-history', /\b(remember when|the .{2,40} we made|we made .{2,40} together|our .{2,30}|continue (the|our))\b/i],
  // Handing the Companion a real part in the story.
  ['companion-role', /\b(you (choose|decide|pick)|what (do you think )?should happen next|you say what|it'?s your turn)\b/i],
];

/**
 * @returns {string[]} every signal the Creator's own words carry.
 *   The Companion's turns are not read: a Companion cannot make a
 *   moment meaningful by saying it was.
 */
export function signalsIn(conversation) {
  const said = (Array.isArray(conversation) ? conversation : [])
    .filter(function (t) { return t && t.speaker !== 'companion'; })
    .map(function (t) { return String(t.text || ''); })
    .join('\n');
  const out = [];
  SIGNAL_PATTERNS.forEach(function (p) {
    if (p[1].test(said)) out.push(p[0]);
  });
  return out;
}

// ---------------------------------------------------------------
// THE EVIDENCE MODEL
//
// THIS IS THE PART THAT MATTERS. A proposal is not accepted because the
// model says it is meaningful — "the model thinks so" is never
// evidence. It is accepted because every substantial word in it can be
// found in material VihuPlanet actually supplied.
//
// Two corpora, deliberately different:
//
//   · CONVERSATION — what the Creator just said. Enough to ground a
//     `shared` moment, which is by definition about the two of them.
//   · AUTHORITATIVE — the story's name, the page's prose, and existing
//     memories. Required on its own for a `world` proposal, because a
//     child SAYING "we made this world" does not make it a fact about
//     the world. A world memory has to be supported by world state.
//
// A model-supplied citation ("evidence: conversation[12]") is not read.
// The validator looks at the real material instead.

// GROUNDING IS ABOUT SUBSTANCE, NOT NARRATION.
//
// What this exists to catch is a model INVENTING a specific — a moon
// garden nobody made, a name nobody said. It is not there to punish a
// model for writing in the third person: a proposal is a sentence
// ABOUT a moment, so it necessarily contains words the child did not
// use ("Creator asked…", "…returned to continue…").
//
// So two vocabularies are set aside. The first is ordinary English.
// The second is the FRAME — the verbs and nouns every bond moment is
// phrased with, which carry no claim of their own. What is left is the
// substance: the things named. Those must be found.
//
// The first draft omitted the frame list, and refused the brief's own
// accepted example ("Creator asked Leafy to choose what happens next in
// the story") because the word "story" was not in the conversation.
// That is a check failing on grammar rather than on truth.
const STOPWORDS = new Set(('a an and are as at be been but by for from had has have her his in into is it its ' +
  'of on or our she that the their them then there they this to was we were what when where which who will with ' +
  'you your creator leafy companion about after again all also any because before being between both did do ' +
  'does doing down each few first also any get give go going here how just know let more most much must new no ' +
  'not now one only other out over own same some still such take than these those through time too under up ' +
  'very way well while would ' +
  // ---- the frame ----
  'together moment story stories page pages place places spot thing things part turn next happen happens ' +
  'happened choose chose ' +
  'choosing choice decide decided remember remembered remembering continue continued continuing made make ' +
  'making said say says asked ask asking told tell telling wanted want returned return returning came come ' +
  'went gone gave give shown showed show brought bring called call named name started start began begin ' +
  'finished finish shared share sharing worked work together').split(' '));

function words(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
}

/** The substantial words a claim rests on — what has to be found. */
export function claimWords(content) {
  const seen = {};
  const out = [];
  words(content).forEach(function (w) {
    if (w.length < 4) return;
    if (STOPWORDS.has(w)) return;
    if (seen[w]) return;
    seen[w] = 1;
    out.push(w);
  });
  return out;
}

function corpusOf(conversation, approved) {
  const convo = (Array.isArray(conversation) ? conversation : [])
    .map(function (t) { return String((t && t.text) || ''); }).join('\n');

  const parts = [];
  try {
    const sc = approved && approved.storyContext;
    if (sc) {
      if (sc.story && sc.story.name) parts.push(sc.story.name);
      const p = sc.page && sc.page.prose;
      if (p && p.beat && p.beat.text) parts.push(p.beat.text);
      if (p && p.draft && p.draft.text) parts.push(p.draft.text);
    }
    (((approved && approved.memories) || [])).forEach(function (m) {
      if (m && m.content) parts.push(String(m.content));
    });
    const personality = approved && approved.personality;
    if (personality && personality.name) parts.push(String(personality.name));
  } catch (e) { /* an unreadable context grounds nothing, which is safe */ }

  return { conversation: convo, authoritative: parts.join('\n') };
}

/**
 * @returns {{grounded:boolean, missing:string[], where:string}}
 *   `where` names the corpus that carried it, so a caller can tell a
 *   world fact taken from world state apart from one a child said.
 */
export function groundedIn(content, conversation, approved, opts) {
  const o = opts || {};
  const corpus = corpusOf(conversation, approved);
  const pool = o.authoritativeOnly
    ? words(corpus.authoritative)
    : words(corpus.conversation + '\n' + corpus.authoritative);
  const have = new Set(pool);
  const missing = claimWords(content).filter(function (w) { return !have.has(w); });
  return {
    grounded: missing.length === 0,
    missing: missing,
    where: o.authoritativeOnly ? 'authoritative' : 'conversation+authoritative',
  };
}

// ---------------------------------------------------------------
// THE QUALITY FILTER
//
// Everything here is a REFUSAL. Each pattern is one of the shapes the
// brief names, and each is written to catch the sentence rather than
// the subject: "Creator had fun" is refused whatever they had fun
// doing.

const REFUSE = [
  // Psychological, diagnostic or characterological — the whole class
  // Decision 30 forbids inferring, and the one that would turn a
  // conversation into a profile.
  ['psychological', /\b(trust(s|ed)?|feels?|felt|emotion(al|s)?|attach(ed|ment)|depend(ent|ency)|anxious|anxiety|confiden(t|ce)|shy|lonely|sad|afraid|scared|brave|clever|smart|intelligent|talented|gifted|creative person|personality|character trait|struggles? with|good at|bad at)\b/i],
  // A preference or a habit rather than a thing that happened.
  ['preference', /\b(likes?|loves?|hates?|prefers?|enjoys?|favourite|favorite|always|never|usually|often|tends? to|is a fan of|interested in)\b/i],
  // Praise, evaluation or a verdict on the work.
  ['evaluative', /\b(amazing|wonderful|beautiful|great|brilliant|excellent|lovely|good|bad|better|worse|best|worst|impressive|proud)\b/i],
  // Ordinary conversational traffic dressed as a milestone.
  ['conversational', /\b(said hello|greeted|chatted|talked (to|with)|had a (chat|conversation)|asked a question|answered)\b/i],
  // Attendance, which is engagement rather than a moment.
  ['engagement', /\b(visited|logged in|came back today|opened the|spent .{0,12}(minutes|hours)|played for)\b/i],
  // A passing state.
  ['temporary', /\b(had fun|was happy|was excited|was tired|is happy|is excited|today felt)\b/i],
  // Anything that would put a credential in a memory.
  ['secret', /\b(password|passcode|pin\b|secret code|api key|token|login|username|email address)\b/i],
];

// Nothing that could identify a person, a device or a file may become
// a memory — the same shapes js/companionPrivacyGate.js refuses on the
// way out, applied here on the way in.
const FORBIDDEN_VALUES = [
  [/\bhttps?:\/\/\S+/i, 'a URL'],
  [/\bdata:[a-z0-9.+-]+\//i, 'inline data'],
  [/\bvihu-asset:/i, 'an asset reference'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/, 'an email address'],
  [/\beyJ[A-Za-z0-9_-]{8,}\./, 'a token'],
  [/\b(?:card|proj|lib|mem|user)_[A-Za-z0-9]{4,}/i, 'an internal identifier'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'an identifier'],
];

// ---------------------------------------------------------------
// THE DEDUPE KEY
//
// Deterministic and readable, so the same moment proposed twice is the
// same row and a person reading the table can see what it was. The
// database's own unique (card_id, dedupe_key) is what actually enforces
// it — a JavaScript check alone would lose a race between two requests.

export function dedupeKeyFor(content) {
  const slug = String(content || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return 'bond:' + slug;
}

// ---------------------------------------------------------------
// THE VALIDATOR

/**
 * @param {object} proposal   {kind, content, reason?} as the model gave it
 * @param {object} ctx        {mode, conversation, approved, cardId}
 * @returns {{ok:boolean, reason?:string, memory?:object}}
 *   On acceptance, `memory` is the record VihuPlanet will write — with
 *   its own confidence, its own dedupe key and its own ownership.
 *   Nothing the model said about any of those is carried.
 */
export function validateProposal(proposal, ctx) {
  const c = ctx || {};

  // ---- 1. A TRAVELLER CREATES NOTHING ---------------------------
  // Before anything else, and not as a filter at the end: a visitor has
  // no Companion of their own (Canon 8), so there is no shared history
  // for them to add to.
  if (c.mode !== 'creator') return { ok: false, reason: 'traveller' };

  // ---- 2. OWNERSHIP IS THE SERVER'S ------------------------------
  // A card was verified before this was ever called. A proposal that
  // names an owner, a card or a companion is refused rather than
  // corrected: the model has no business having an opinion about it.
  if (!c.cardId) return { ok: false, reason: 'no-card' };
  if (!proposal || typeof proposal !== 'object') return { ok: false, reason: 'no-proposal' };
  if (proposal.cardId || proposal.ownerId || proposal.owner_id
      || proposal.creatorId || proposal.companionId || proposal.id
      || proposal.confidence || proposal.dedupeKey || proposal.protected) {
    return { ok: false, reason: 'claims-ownership' };
  }

  // ---- 3. SHAPE ---------------------------------------------------
  const kind = String(proposal.kind || '');
  if (BOND.proposableKinds.indexOf(kind) === -1) return { ok: false, reason: 'kind-not-proposable' };
  if (typeof proposal.content !== 'string') return { ok: false, reason: 'content-not-a-string' };
  const content = proposal.content.trim().replace(/\s+/g, ' ');
  if (content.length < BOND.minChars) return { ok: false, reason: 'too-short' };
  if (content.length > BOND.maxChars) return { ok: false, reason: 'too-long' };

  // ---- 4. NOTHING IDENTIFYING -------------------------------------
  for (let i = 0; i < FORBIDDEN_VALUES.length; i++) {
    if (FORBIDDEN_VALUES[i][0].test(content)) {
      return { ok: false, reason: 'contains-' + FORBIDDEN_VALUES[i][1].replace(/\s+/g, '-') };
    }
  }

  // ---- 5. QUALITY -------------------------------------------------
  for (let i = 0; i < REFUSE.length; i++) {
    if (REFUSE[i][1].test(content)) return { ok: false, reason: 'rejected-' + REFUSE[i][0] };
  }

  // ---- 6. A STRONG SIGNAL, IN THE CREATOR'S OWN WORDS -------------
  const signals = signalsIn(c.conversation);
  const grounded = groundedIn(content, c.conversation, c.approved,
    { authoritativeOnly: kind === 'world' });

  // A `world` fact needs world state behind it, and that IS its signal:
  // a child saying "we made this world" is not a fact about the world.
  if (kind === 'world') {
    if (!grounded.grounded) return { ok: false, reason: 'world-fact-unsupported' };
  } else if (!signals.length) {
    return { ok: false, reason: 'no-strong-signal' };
  } else if (!grounded.grounded) {
    return { ok: false, reason: 'ungrounded' };
  }

  // ---- 7. WHAT VIHUPLANET WILL WRITE ------------------------------
  return {
    ok: true,
    signals: signals,
    memory: {
      kind: kind,
      content: content,
      // The platform's own words for how sure it is. A model-proposed
      // memory is OBSERVED; a record-derived one is CONFIRMED.
      confidence: BOND.confidence,
      importance: 'medium',
      source: 'model:bond-moment',
      dedupeKey: dedupeKeyFor(content),
      // A milestone this sprint cannot verify is not protected. The
      // deterministic recorders own that flag.
      protected: false,
    },
  };
}
