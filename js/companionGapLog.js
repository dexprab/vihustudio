// js/companionGapLog.js — the Conversation Gap Log (Sprint R6).
//
// PRODUCT-LEARNING INSTRUMENTATION, NOT COMPANION MEMORY. Every time a
// Companion cannot adequately answer — it says it does not know, it is
// missing knowledge or context, the round trip failed, or a boundary
// held — the interaction is recorded so recurring gaps can be reviewed
// and the knowledge, the context or the instructions improved. The
// learning loop the product owner asked for:
//
//   Creator asks → Companion responds → answer inadequate →
//   Gap Log → review recurring gaps → improve knowledge → better
//   Companion.
//
// WHAT THIS FILE MUST NEVER DO, structurally rather than by intent:
//   · become memory. CompanionMemory is not referenced anywhere below;
//     nothing here can propose, write or touch a memory, and nothing a
//     Companion says is ever read back FROM this log.
//   · pretend to know. The Companion's answers are exactly what they
//     were; this only watches what was already said.
//   · flood. Deliberate silence (an empty turn) is not a gap; a
//     boundary refusal is logged once as by-design rather than as a
//     defect; the local buffer is capped and the platform door is
//     rate-capped server-side.
//
// PRIVACY: an entry holds the question, the reply, a few surrounding
// turns, the surface, the screen and the classification. It holds NO
// card id, NO nickname, NO username. The platform push is best-effort
// and bounded (Decision 49); with no platform the log is local only.
//
// NOT EVERY UNKNOWN IS A MISSING CANON (the owner's own example):
// "what is a volcano?" is general knowledge and classifies as
// model_capability; "what happens when I Keep a Gift?" names the
// product's own vocabulary and classifies as knowledge the product
// should hold. The classifier reads the QUESTION's vocabulary, so the
// two land in different buckets for the review to weigh.
const CompanionGapLog = (function () {
  'use strict';

  const KEY = 'vihu.gapLog';
  const CAP = 200;          // local ring buffer — newest kept
  const PUSH_TIMEOUT_MS = 6000;

  // The product's own vocabulary — a question using these words is
  // asking about VihuPlanet, so an unknown here is OUR gap, not the
  // model's. Kept as words a child actually uses on screen.
  const VIHU_RE = /\b(sky|gift|gifts|show|shown|keep|kept|garden|ether|vihuplanet|traveller|creator|companion|magic\s*card|story\s*card|foldable|cheer|spirit|constellation)\b/i;
  // The Studio's procedural vocabulary — where is, how do I, a control.
  const STUDIO_RE = /\b(button|page|pages|add|print|save|finish|play|open|panel|tile|voice|record|letter|draw|sticker|studio|where\s+is|how\s+do|how\s+to)\b/i;
  const STORY_RE = /\b(this|my|the)\s+(story|page)\b|\bending\b|\bchapter\b/i;
  // What an inadequate answer sounds like, in this product's own
  // authored lines and a model's ordinary hedges.
  const UNSURE_RE = /i don.?t know|i.?m not sure|only be guessing|didn.?t catch|don.?t have that one|don.?t understand|not sure what you/i;

  function _read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function _write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(-CAP))); } catch (e) {}
  }

  function _screen() {
    try {
      if (typeof CompanionLive !== 'undefined' && CompanionLive.surface) {
        return String(CompanionLive.surface() || '');
      }
    } catch (e) {}
    return '';
  }

  /** Is this exchange a gap at all? Deliberate silence is not. */
  function isGap(o) {
    if (!o) return false;
    if (!String(o.said || '').trim()) return false;
    if (o.reason === 'unavailable' || o.reason === 'technical') return true;
    if (o.certainty === 'refused' || o.certainty === 'private') return true;
    if (o.intent === 'no-context') return true;
    // ---- `unknown` IS ONLY A GAP WHEN THE SHRUG IS THE ANSWER ----
    //
    // Reported by the product owner on the first live review: "whats up
    // mate", answered warmly by Leo's model, sat in the log as a gap.
    // The browser's classifier had called it `unknown` — which for a
    // model-listed Companion means only "routed to the model" (Step 3B),
    // not "unanswered". So a server-answered turn is judged by what CAME
    // BACK: an adequate model reply records nothing, and a model that
    // itself says "I don't know who Alpha is" is still caught by the
    // hedge scan below. A LOCAL `unknown` stays a gap — there the honest
    // shrug is the whole answer.
    if (o.intent === 'unknown' && !o.fromServer) return true;
    return UNSURE_RE.test(String(o.reply || ''));
  }

  /** Why did it fail — the review's first sort key. */
  function classify(o) {
    if (o.reason === 'unavailable' || o.reason === 'technical') return 'technical_failure';
    if (o.certainty === 'refused' || o.certainty === 'private') return 'safety_restriction';
    if (o.intent === 'no-context') return 'live_context_missing';
    const q = String(o.said || '');
    if (STORY_RE.test(q)) return 'story_context_missing';
    if (VIHU_RE.test(q)) return 'vihuplanet_knowledge_missing';
    if (STUDIO_RE.test(q)) return 'studio_knowledge_missing';
    if (/which one|do you mean/i.test(String(o.reply || ''))) return 'ambiguity_or_misunderstanding';
    return 'model_capability';
  }

  function _push(entry) {
    try {
      if (typeof ThemeRepositoryClient === 'undefined') return;
      ThemeRepositoryClient.isConfigured().then(function (ok) {
        if (!ok) return;
        return ThemeRepositoryClient.getClient().then(function (client) {
          // Bounded (Decision 49): a hung platform costs nothing a
          // child can feel, and a failure is not remembered — the
          // local copy already has the entry either way.
          return Promise.race([
            client.rpc('gap_log_insert', { p: entry }),
            new Promise(function (resolve) { setTimeout(resolve, PUSH_TIMEOUT_MS); })
          ]);
        });
      }).catch(function () {});
    } catch (e) {}
  }

  /**
   * The one door. Called by the conversation surfaces beside their
   * existing observe step, with what was already said — this decides
   * whether it was a gap, classifies it, and records it. Returns the
   * entry (for the suites) or null when the exchange was adequate.
   */
  function consider(o) {
    try {
      if (!isGap(o)) return null;
      const cls = classify(o);
      const entry = {
        at: new Date().toISOString(),
        surface: String(o.surface || 'studio'),
        screen: _screen(),
        companion: String(o.companion || ''),
        said: String(o.said || '').slice(0, 400),
        reply: String(o.reply || '').slice(0, 400),
        context: Array.isArray(o.turns)
          ? o.turns.slice(-4).map(function (t) {
              return { s: t.speaker, t: String(t.text || '').slice(0, 160) };
            })
          : null,
        classification: cls,
        // A boundary holding is the product WORKING — logged so the
        // review can see how often children run into it, but never as
        // an open defect.
        resolution: cls === 'safety_restriction' ? 'by-design' : 'open'
      };
      const list = _read();
      list.push(entry);
      _write(list);
      _push(entry);
      return entry;
    } catch (e) { return null; }
  }

  function list() { return _read(); }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  const api = {
    consider: consider,
    isGap: isGap,
    classify: classify,
    list: list,
    clear: clear
  };
  try { window.CompanionGapLog = api; } catch (e) {}
  return api;
})();
