// creatorRecognition.js — how VihuPlanet recognises its Creators.
//
// This is not login. There is no account, no password, no email and no
// session to expire. A Creator draws the constellation from their Magic
// Card and the universe either knows that sky or does not. The Magic
// Card is the Creator's permanent identity inside VihuPlanet; this file
// is the one place that asks it "is this you?".
//
// ---------------------------------------------------------------
// ONE FLOW, THREE ARRIVALS
//
// The sprint's requirement is a single flow that handles all three
// cases naturally, and the way that works is that the child does the
// same thing every time — they draw their stars — while this file
// looks in two places for them, nearest first.
//
//   A first-time Traveller has no card anywhere. Nothing matches, and
//     that is not a failure: they say so with "I don't have one yet"
//     and the Rite begins. This file is never even asked.
//   A returning Creator on the same device is recognised LOCALLY, from
//     the card already in this browser. Instant, and it still works
//     with the network off — which matters, because a child who cannot
//     reach their own stories because the wifi is down has been locked
//     out by software, which is the exact experience this whole design
//     exists to avoid.
//   A returning Creator on a NEW device has nothing local to match, so
//     the same drawn sky goes to the Magic Card platform's own recall,
//     which knows every card ever claimed. Recognition there adopts the
//     identity onto this device and pulls their Stories with it —
//     MagicCard.adopt() already does all of that and is untouched here.
//
// Same gesture, same screen, same button. The child never learns that
// there were two places to look.
// ---------------------------------------------------------------
//
// The local pass is a SET comparison, matching what the platform does
// server-side (_card_platform_sort_pattern in supabase/schema.sql
// sorts both sides before comparing). A constellation is a shape in
// the sky, not a sequence of moves — a child who taps the same five
// stars starting from a different one has drawn the same sky, and
// being told otherwise would be the software imposing an order that
// the card itself never showed them.

const CreatorRecognition = (function () {
  'use strict';

  // What a recognition attempt can come back as. Only the first means
  // "come in"; the other two are told apart because they deserve
  // different words. `unknown` is "these stars are new to me", which
  // may well be the child's fault and is safe to invite a retry from.
  // `unreachable` is "I cannot see the whole sky from here" — the
  // network, not the child — and blaming them for it would be both
  // wrong and unkind.
  var KNOWN = 'known';
  var UNKNOWN = 'unknown';
  var UNREACHABLE = 'unreachable';

  function canonical(pattern) {
    if (!Array.isArray(pattern)) return '';
    return pattern
      .filter(function (p) { return Array.isArray(p) && p.length >= 2; })
      .map(function (p) { return [Number(p[0]), Number(p[1])]; })
      .sort(function (a, b) { return (a[0] - b[0]) || (a[1] - b[1]); })
      .map(function (p) { return p[0] + ',' + p[1]; })
      .join(' ');
  }

  function localCards() {
    try {
      return (typeof MagicCard !== 'undefined' && typeof MagicCard.list === 'function')
        ? MagicCard.list() : [];
    } catch (e) { return []; }
  }

  // The card on this device whose sky is the one just drawn, if any.
  // A card recalled by typed code has no pattern stored (the platform
  // deliberately never returns one — see MagicCard.adopt), so it simply
  // cannot be matched this way and falls through to the cloud pass,
  // which can.
  function matchLocally(pattern) {
    var want = canonical(pattern);
    if (!want) return null;
    var cards = localCards();
    for (var i = 0; i < cards.length; i++) {
      if (cards[i] && cards[i].pattern && canonical(cards[i].pattern) === want) return cards[i];
    }
    return null;
  }

  function cloudRecall(pattern) {
    try {
      if (typeof MagicCard === 'undefined' || typeof MagicCard.recall !== 'function') {
        return Promise.resolve({ outcome: UNREACHABLE });
      }
      return MagicCard.recall({ pattern: pattern }).then(function (result) {
        if (result && result.ok && result.card) {
          return { outcome: KNOWN, card: result.card, where: 'platform' };
        }
        // Only `no_match` is genuinely "I don't know that sky". Every
        // other reason the platform can give — an unconfigured client,
        // no session, a thrown error — means the question never got
        // asked, and answering it on the platform's behalf would tell a
        // real Creator their own stars are wrong.
        var reason = result && result.reason;
        // A REFUSAL HAS A REASON, AND THE CONSOLE SAYS WHICH (the
        // invite desk's own lesson, Decision 30). The child's words
        // stay kind and unblaming; the console is for whoever is
        // diagnosing — reported live as "not able to login even when
        // magic card pattern is correct", where the one sentence on
        // screen could not say whether the platform said no_match,
        // refused the session, hit a conflict, or was never reached.
        try {
          console.warn('[recognition] platform recall did not recognise:',
            reason || '(no reason — the call itself failed)',
            result && result.error ? result.error : '');
        } catch (e2) {}
        // AN AMBIGUOUS IDENTITY IS NOT AN INVITATION.
        //
        // The platform reports identity_conflict when more than one
        // Creator holds the pattern that was just drawn. It refuses to
        // choose between them and so does this: no Sky opens, and the
        // child is not told their stars are wrong, because they are not
        // — this is our data being ambiguous, not their card.
        if (reason === 'identity_conflict') {
          return { outcome: UNREACHABLE, reason: reason };
        }
        return { outcome: reason === 'no_match' ? UNKNOWN : UNREACHABLE, reason: reason };
      }).catch(function (err) {
        try { console.warn('[recognition] platform recall failed outright:', err); } catch (e2) {}
        return { outcome: UNREACHABLE };
      });
    } catch (e) {
      return Promise.resolve({ outcome: UNREACHABLE });
    }
  }

  // The whole question, asked once. Always resolves — never rejects —
  // because there is no caller for whom a thrown error is a better
  // answer than "I could not see".
  function recognise(pattern) {
    var here = matchLocally(pattern);
    if (here) {
      // This device already held the card; recognising it is choosing
      // it. setActive() is what makes the rest of VihuStudio — the
      // Studio header, the project store, the Companion — agree about
      // who is here.
      try { MagicCard.setActive(here.id); } catch (e) {}
      return Promise.resolve({ outcome: KNOWN, card: here, where: 'device' });
    }
    return cloudRecall(pattern);
  }

  // Whether a Creator is currently recognised on this device at all.
  // The same definition js/journeyResolver.js and js/studioRite.js
  // already use, not a new one.
  function isRecognised() {
    return localCards().length > 0;
  }

  // ---------------------------------------------------------------
  // "I was recognised on the way in."
  //
  // Recognition happens once per arrival, at VihuPlanet. The Studio is
  // a different document, and its Traveller Gateway has always resolved
  // identity for itself — for a Returning Creator that means Scene 3's
  // sky challenge, which is exactly right when the Studio IS the front
  // door. It is not the front door any more.
  //
  // Without this note a child drew their constellation on VihuPlanet,
  // was recognised, and was met on arrival by "One of these skies is
  // yours. Can you find it?" — a second proof of the same identity,
  // seconds later, which is precisely the "one single flow" this whole
  // design exists to be.
  //
  // sessionStorage, because the semantics wanted are exactly its own:
  // it survives the one navigation from VihuPlanet into the Studio and
  // nothing else. Read once and cleared in the same breath, so it can
  // only ever affect the arrival it was written for — the same
  // discipline js/app.js's own Home-reload flag uses. A new tab, a
  // later visit or a direct link to the Studio all find nothing here
  // and the Gateway behaves exactly as it always has.
  // ---------------------------------------------------------------
  var PASS_KEY = 'vihu-recognised-on-arrival';

  function markRecognised(cardId) {
    try { sessionStorage.setItem(PASS_KEY, cardId || '1'); } catch (e) {}
  }

  function takeRecognition() {
    try {
      var v = sessionStorage.getItem(PASS_KEY);
      sessionStorage.removeItem(PASS_KEY);
      return !!v;
    } catch (e) { return false; }
  }

  var api = {
    KNOWN: KNOWN,
    UNKNOWN: UNKNOWN,
    UNREACHABLE: UNREACHABLE,
    recognise: recognise,
    // ---------------------------------------------------------------
    // EVERY READING AT ONCE — what makes a new machine work like a
    // familiar one.
    //
    // The camera cannot always pin a card's grid down exactly, so it
    // offers a handful of possible readings. On a device that already
    // holds the card that costs nothing: the readings are compared
    // against a pattern sitting in this browser, by SHAPE, and a
    // near-miss still matches.
    //
    // The platform is unforgiving by comparison — recall matches a
    // constellation as an exact set — so the same handful of readings
    // had to be sent one at a time, and the first was almost never the
    // right one. That is the whole reason recognition behaved
    // differently on a new machine: not a weaker reader, a stricter
    // question asked serially.
    //
    // Asking about all of them together removes the difference. The
    // true reading is in the list — that is what the reader is for —
    // and one round trip finds it wherever in the list it sits. A
    // wrong reading matches nobody, so offering many cannot invent an
    // identity; it can only find the one that was always there.
    // ---------------------------------------------------------------
    recogniseAny: function (patterns) {
      var list = (patterns || []).filter(Boolean);
      if (!list.length) return Promise.resolve({ outcome: UNKNOWN });

      // This device first, all of it, before anything goes out.
      for (var i = 0; i < list.length; i++) {
        var here = matchLocally(list[i]);
        if (here) {
          try { MagicCard.setActive(here.id); } catch (e) {}
          return Promise.resolve({ outcome: KNOWN, card: here, where: 'device' });
        }
      }

      // Then the platform, about every reading together rather than in
      // turn. Bounded, because each is a real request.
      var ask = list.slice(0, 40);
      return Promise.all(ask.map(function (p) {
        return cloudRecall(p).catch(function () { return { outcome: UNREACHABLE }; });
      })).then(function (results) {
        for (var j = 0; j < results.length; j++) {
          if (results[j] && results[j].outcome === KNOWN) return results[j];
        }
        // Unreachable only when NOTHING got through — one dropped
        // request among forty is not the network being down, and
        // telling a child their sky is out of reach because of it
        // would be blaming them for somebody else's packet.
        var any = results.some(function (r) { return r && r.outcome === UNKNOWN; });
        return { outcome: any ? UNKNOWN : UNREACHABLE };
      });
    },
    // The device-only half of recognise(), on its own.
    //
    // The camera reads a card as a HANDFUL of possible skies rather
    // than one, and asking the platform about each in turn means a
    // network round trip per guess — a Creator holding their own card
    // waited through all of them while the answer sat in this browser
    // the whole time. Every guess can be checked here first, instantly
    // and offline, and only then does anything go out to the platform.
    // Same matching, same canonical set comparison; no new rules.
    matchLocally: matchLocally,
    isRecognised: isRecognised,
    markRecognised: markRecognised,
    takeRecognition: takeRecognition
  };
  try { window.CreatorRecognition = api; } catch (e) {}
  return api;
})();
