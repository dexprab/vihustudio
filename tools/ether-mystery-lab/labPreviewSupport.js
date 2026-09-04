// tools/ether-mystery-lab/labPreviewSupport.js — what the Ether can
// actually SHOW of a candidate, and how to say a candidate in plain
// words.
//
// SPRINT — Ether Mystery Lab: Visual Experience Preview (Decision 58).
//
// TWO JOBS, BOTH PURE. Given a validated candidate this file answers
// (1) can the EXISTING interpreter represent it, and (2) what would a
// person who has never read a schema call it. No DOM, no storage, no
// network, no clock; it loads identically in a browser and in Node,
// so the Lab page, the preview document and the suite all consult the
// one copy.
//
// WHY THE TABLE IS WRITTEN DOWN AND NOT DERIVED. The tempting version
// reads js/etherMystery.js and works out which branches exist. That
// is a check that reads its expectations from the thing it is
// checking — the repository has recorded that failure before — and it
// would quietly call a capability "supported" the day somebody
// deleted its branch. REPRESENTED below is a claim a person makes and
// a reviewer can argue with; the suite holds it against the
// interpreter, rather than the other way round.
//
// VALID IS NOT PREVIEWABLE. js/etherGrammar.js approves a slightly
// wider vocabulary than js/etherMystery.js performs, and the gap is
// not a bug in either — the validator protects the runtime and the
// runtime grows into it. What matters is that the gap is never
// papered over: a candidate naming something the interpreter cannot
// perform must be marked "Preview unavailable — unsupported runtime
// capability" and kept out of the creative approval path, never shown
// as an approximation. Inventing a renderer is exactly what this file
// exists to prevent.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // REPRESENTED — everything js/etherMystery.js has a real branch
  // for. Each list is deliberately narrower than or equal to the
  // validator's own CAPABILITIES; the differences are the whole point
  // and are named in NOT_REPRESENTED below.
  // ---------------------------------------------------------------
  var REPRESENTED = {
    // draw(): shard · glint · mark · veil · link each have their own
    // drawing branch.
    shows: ['shard', 'mark', 'glint', 'veil', 'link'],
    // placePoints(): every place in the vocabulary is placed.
    places: ['near-look', 'far', 'scattered', 'ring', 'at-anchor', 'toward-creation'],
    // update()/touchAt(): every action in the vocabulary is armed.
    actions: ['tap', 'approach', 'dwell', 'return', 'wait'],
    // begin()/engageEl()/update()/draw(): five of the validator's six
    // responses have a branch. 'brighten' has none.
    responses: ['gather', 'link', 'reveal', 'drift-away', 'dissolve'],
    paces: ['slow', 'drifting', 'still'],
    outcomes: ['discovery', 'unresolved', 'dissolve'],
    // resolve(): a travelling light to the creation's Spirit, a bloom
    // through the creature layer, a resting halo.
    discoveries: ['creation-revealed', 'wonder', 'place'],
    // residueAt(): always a long faint mark through life.markAt().
    residueShows: ['mark'],
    // The only creation the Ether holds is a shared story.
    creationKinds: ['story']
  };

  // The gap, stated rather than implied — one line each, in the words
  // a reviewer would want.
  var NOT_REPRESENTED = {
    'onEngage:brighten':
      'the runtime has no "brighten" response — it would have to be built',
    'residue:glint':
      'a residue is always left as a faint mark, never as a small light',
    'of:sky':
      'a piece can only ever be a piece of a creation\'s own picture',
    'of:non-shard':
      'only a piece of a picture can be "of" something',
    'creationKind':
      'the Ether holds shared stories and nothing else yet'
  };

  // The world the preview actually builds. Stated here so the Lab can
  // answer "could this be previewed?" before opening anything, and so
  // the answer and the world cannot drift apart.
  //
  // `pages` is 0 for every creation, and that is FIDELITY rather than
  // laziness: the runtime's own story entity (storyEntity.js) carries
  // no page count, so js/etherCreationLens.js reports 0 for every real
  // Spirit in the live Ether too. A candidate asking for a minimum
  // page count would find no creation in production either, and the
  // preview must not be kinder than the sky.
  var PREVIEW_WORLD = {
    creations: 3,
    creationKind: 'story',
    lensPages: 0,
    anchors: true
  };

  function list(v) { return Array.isArray(v) ? v : []; }

  // support(candidate) → { ok, reasons[], notes[] }
  //
  // `reasons` are blocking: the interpreter cannot perform this, so
  // there is nothing honest to show. `notes` are things the reviewer
  // should know about the preview world itself — staged, not faked,
  // and never a substitute for a missing capability.
  function support(candidate) {
    var reasons = [], notes = [];
    if (!candidate || typeof candidate !== 'object') {
      return { ok: false, reasons: ['not-a-candidate'], notes: [] };
    }
    var ing = candidate.ingredients || {};
    var beh = candidate.behaviour || {};
    var out = candidate.outcome || {};

    list(candidate.elements).forEach(function (el) {
      el = el || {};
      if (REPRESENTED.shows.indexOf(el.show) === -1) {
        reasons.push('show:' + el.show);
      }
      if (REPRESENTED.places.indexOf(el.place) === -1) {
        reasons.push('place:' + el.place);
      }
      if (el.of !== undefined) {
        if (el.of !== 'cover') reasons.push('of:sky');
        else if (el.show !== 'shard') reasons.push('of:non-shard');
      }
    });

    list(candidate.engage).forEach(function (e) {
      e = e || {};
      if (REPRESENTED.actions.indexOf(e.action) === -1) {
        reasons.push('action:' + e.action);
      }
    });

    if (beh.onEngage !== undefined &&
        REPRESENTED.responses.indexOf(beh.onEngage) === -1) {
      reasons.push('onEngage:' + beh.onEngage);
    }
    if (beh.pace !== undefined && REPRESENTED.paces.indexOf(beh.pace) === -1) {
      reasons.push('pace:' + beh.pace);
    }

    list(out.possible).forEach(function (o) {
      if (REPRESENTED.outcomes.indexOf(o) === -1) reasons.push('outcome:' + o);
    });
    if (list(out.possible).indexOf('discovery') !== -1 &&
        REPRESENTED.discoveries.indexOf(out.discovery) === -1) {
      reasons.push('discovery:' + out.discovery);
    }
    if (out.residue && REPRESENTED.residueShows.indexOf(out.residue.show) === -1) {
      reasons.push('residue:' + out.residue.show);
    }

    // Ingredients — what the preview world must be able to supply.
    if (ing.creationKind !== undefined &&
        REPRESENTED.creationKinds.indexOf(ing.creationKind) === -1) {
      reasons.push('creationKind:' + ing.creationKind);
    }
    if (ing.creation === true) {
      if (!PREVIEW_WORLD.creations) reasons.push('needs-a-creation');
      if (typeof ing.minPages === 'number' && ing.minPages > PREVIEW_WORLD.lensPages) {
        reasons.push('needs-pages:' + ing.minPages);
      }
    }
    if (ing.anchor === true) {
      notes.push('This one is about a place met earlier in the visit. ' +
        'The preview marks one first, with the sky\'s own faint mark, ' +
        'so there is a real earlier place for it to be about.');
    }
    // A MYSTERY WITH NOTHING TO DO ENDS AS SOON AS IT IS POSED, and
    // that is the runtime's behaviour rather than the preview's:
    // resolveDone() is satisfied on the first frame when no element is
    // armed and no wait is pending, so the whole thing resolves before
    // a child could look at it. Measured in the preview, which is what
    // a preview is for. It is a note rather than a refusal — the
    // experience IS performable, it is simply over at once — and a
    // reviewer who is not told would read a working preview as broken.
    if (!list(candidate.engage).length) {
      notes.push('There is nothing here for a child to do and nothing ' +
        'to wait for, so the Ether ends it the moment it is posed. ' +
        'Expect to see it appear and go.');
    }

    return { ok: reasons.length === 0, reasons: reasons, notes: notes };
  }

  // Why, in the reviewer's language rather than the schema's.
  function whyUnavailable(reasons) {
    return list(reasons).map(function (r) {
      if (NOT_REPRESENTED[r]) return NOT_REPRESENTED[r];
      if (r.indexOf('creationKind:') === 0) return NOT_REPRESENTED.creationKind;
      if (r.indexOf('needs-pages:') === 0) {
        return 'it asks for a creation of at least ' + r.split(':')[1] +
          ' pages, and the Ether does not tell a mystery how long a creation is';
      }
      if (r === 'needs-a-creation') return 'there is no creation for it to be about';
      return 'the runtime cannot perform "' + r.replace(/^[a-z]+:/i, '') + '" yet';
    });
  }

  // ---------------------------------------------------------------
  // PLAIN LANGUAGE. No grammar id, no capability name, no schema
  // word, no id — the reviewer is judging an experience, not a
  // record. The one thing that may travel is the candidate's own
  // title, which is already written for a person.
  // ---------------------------------------------------------------
  var SHOW_WORDS = {
    shard: 'a piece of a creation\'s picture',
    mark: 'a faint star',
    glint: 'a small light',
    veil: 'a soft glow with something behind it',
    link: 'a faint line'
  };
  var SHOW_PLURAL = {
    shard: 'pieces of a creation\'s picture',
    mark: 'faint stars',
    glint: 'small lights',
    veil: 'soft glows with something behind them',
    link: 'faint lines'
  };
  var PLACE_WORDS = {
    'near-look': 'close to where you are looking',
    far: 'a long way off',
    scattered: 'spread around you',
    ring: 'in a circle around you',
    'at-anchor': 'at a place you have already been',
    'toward-creation': 'in a line leading off toward a creation'
  };
  var ACTION_WORDS = {
    tap: 'touch it',
    approach: 'turn towards it',
    dwell: 'look at it for a while',
    'return': 'come back to it later',
    wait: 'wait, and let a little time pass'
  };
  var RESPONSE_WORDS = {
    gather: 'the pieces come together',
    link: 'a line joins what has been touched',
    reveal: 'what was hidden comes out',
    'drift-away': 'the thing you touched drifts off, and leaves a path behind it',
    dissolve: 'it quietly goes',
    brighten: 'it brightens'
  };
  var DISCOVERY_WORDS = {
    'creation-revealed': 'a light leaves and travels to a creation, and rests on it',
    wonder: 'a small figure of stars opens where it was, shines, and goes',
    place: 'the place itself glows warmly for a while'
  };

  function count(n) {
    return ['no', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n);
  }

  function plain(candidate) {
    var c = candidate || {};
    var els = list(c.elements);
    var eng = list(c.engage);
    var out = c.outcome || {};
    var beh = c.behaviour || {};

    // MYSTERY — what is on the sky, and where.
    var parts = els.map(function (el) {
      var n = el.count || 1;
      var thing = n > 1 ? count(n) + ' ' + (SHOW_PLURAL[el.show] || 'things')
                        : (SHOW_WORDS[el.show] || 'something');
      var where = PLACE_WORDS[el.place] || '';
      return thing + (where ? ', ' + where : '');
    });
    var mystery = parts.length
      ? parts.join('; and ') + '.'
      : 'Nothing is placed.';
    if (c.title) mystery = c.title.charAt(0).toUpperCase() + c.title.slice(1) +
      ' — ' + mystery;

    // CHILD ACTION — what a child could try, never an instruction.
    var acts = eng.filter(function (e) { return e && e.action !== 'wait'; })
      .map(function (e) { return ACTION_WORDS[e.action] || ''; })
      .filter(Boolean);
    var waits = eng.filter(function (e) { return e && e.action === 'wait'; });
    var action;
    if (!acts.length && !waits.length) {
      action = 'Nothing to do — it is only there to be noticed.';
    } else {
      var uniq = acts.filter(function (a, i) { return acts.indexOf(a) === i; });
      action = uniq.length
        ? uniq.join(', or ').replace(/^./, function (m) { return m.toUpperCase(); }) + '.'
        : '';
      if (waits.length) {
        action = (action ? action + ' ' : '') +
          'Or wait, and let a little time pass.';
      }
      if (beh.onEngage && RESPONSE_WORDS[beh.onEngage]) {
        action += ' When something answers, ' + RESPONSE_WORDS[beh.onEngage] + '.';
      }
    }

    // DISCOVERY — and honestly, whether there is one at all.
    var possible = list(out.possible);
    var canFind = possible.indexOf('discovery') !== -1;
    var discovery;
    if (canFind) {
      discovery = (DISCOVERY_WORDS[out.discovery] || 'something is found') + '.';
      discovery = discovery.charAt(0).toUpperCase() + discovery.slice(1);
      if (possible.length > 1) {
        discovery += ' Or it may stay a question — that is allowed.';
      }
    } else if (possible.indexOf('dissolve') !== -1 && possible.length === 1) {
      discovery = 'Nothing is found. It simply goes again.';
    } else {
      discovery = 'Nothing is found. It stays a question — that is allowed.';
    }

    // NEXT MYSTERY — what is left behind for the sky to answer later.
    var next;
    if (out.residue) {
      var when = out.residue.when || 'resolved';
      next = 'A faint mark stays behind' +
        (when === 'either' ? ' whichever way it ends'
          : when === 'dissolved' ? ' if it is never taken up' : ' once it is answered') +
        ', and the sky may come back to that place later.';
    } else {
      next = 'Nothing is left behind.';
    }

    return { mystery: mystery, action: action, discovery: discovery, next: next };
  }

  var API = {
    REPRESENTED: REPRESENTED,
    NOT_REPRESENTED: NOT_REPRESENTED,
    PREVIEW_WORLD: PREVIEW_WORLD,
    support: support,
    whyUnavailable: whyUnavailable,
    plain: plain
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.LabPreviewSupport = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
