// etherGrammar.js — the experience grammar vocabulary, the candidate
// schema, and the validator that protects the Ether.
//
// SPRINT — Generative Mystery & Challenge Engine.
//
// THE ETHER IS A SEA OF MYSTERIES, and this file is the vocabulary it
// makes them from. Not a catalogue of finished activities: a small,
// structured set of EXPERIENCE GRAMMARS — reusable shapes of "what can
// happen" — plus the strict schema a candidate experience must be
// written in, and the validator nothing may pass around.
//
// FOUR RESPONSIBILITIES, KEPT SEPARATE (the sprint's own principle):
// the child experiences the Ether; the Experience Composer
// (js/etherExperience.js) conducts it; a generator — a model, run
// asynchronously and OFFLINE, never in any child-facing path — may
// expand what the Ether knows how to express; and THIS validator
// protects it. A candidate experience is DATA, never code: the schema
// has no field that could carry behaviour, every string is scanned for
// executable shapes anyway, and the interpreter (js/etherMystery.js)
// performs only what a validated candidate describes, through
// capabilities that already exist.
//
// THE VALIDATOR DENIES BY SHAPE (Decision 33's own instinct): an
// unknown key at any depth is refused by name, so a field a future
// generator invents is refused by default rather than carried by being
// adjacent to something approved. If a desired experience needs a
// capability that is not in the vocabulary, the answer is REJECT —
// never a silent workaround.
//
// This file is pure data and pure functions: no DOM, no storage, no
// network, no clock. It loads identically in a browser and in Node,
// which is what lets the offline generation lab, the runtime and the
// suite all consult the ONE copy of every rule.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // The grammars. A grammar describes a reusable shape of experience
  // — what can happen, what it may use, how a child can engage, what
  // kinds of discovery can result. The actual experience is generated
  // by combining a grammar with ingredients and world state; nothing
  // here is a finished activity, and hardcoding one particular puzzle
  // is exactly what this table exists to prevent.
  // ---------------------------------------------------------------
  var GRAMMARS = {
    reconstruct: {
      id: 'reconstruct',
      poses: 'something belonging to a creation is separated; the pieces belong together',
      creation: 'required',
      leansTo: ['discovery']
    },
    connect: {
      id: 'connect',
      poses: 'things that appear unrelated have a discoverable relationship',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    uncover: {
      id: 'uncover',
      poses: 'something is partly hidden; what lies behind is discoverable',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    transform: {
      id: 'transform',
      poses: 'something changes in answer to the child, and the relationship is theirs to find',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    trace: {
      id: 'trace',
      poses: 'something leaves a meaningful path; the destination may be anything, or nothing',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    complete: {
      id: 'complete',
      poses: 'something is incomplete; what belongs is shown by the world, never asked for',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    experiment: {
      id: 'experiment',
      poses: 'the child does something and the Ether responds — or does not',
      creation: 'never',
      leansTo: ['unresolved']
    },
    notice: {
      id: 'notice',
      poses: 'something subtly changes; everything depends on the child noticing',
      creation: 'optional',
      leansTo: ['unresolved']
    },
    'return': {
      id: 'return',
      poses: 'a place met earlier this visit is different when the child comes back to it',
      creation: 'optional',
      leansTo: ['discovery', 'unresolved']
    },
    echo: {
      id: 'echo',
      poses: 'something met earlier appears to influence something later, unexplained',
      creation: 'optional',
      leansTo: ['unresolved']
    }
  };

  // ---------------------------------------------------------------
  // The capability vocabulary — the whole of what a candidate may ask
  // the runtime to do. A generator that wants anything outside these
  // lists is refused; the runtime interprets nothing beyond them.
  // ---------------------------------------------------------------
  var CAPABILITIES = {
    // What an element may look like on the sky. All are the sky's own
    // language: fragments of a creation's public cover, faint stars,
    // small lights, a soft obscuring glow, a faint joining line.
    shows: ['shard', 'mark', 'glint', 'veil', 'link'],
    // Where an element may be placed, relative to the visit.
    places: ['near-look', 'far', 'scattered', 'ring', 'at-anchor', 'toward-creation'],
    // How a child may engage — the approved interaction vocabulary,
    // touch-first (Decision 58's mobile rule): a tap, turning until
    // near, looking a while, coming back later this visit, or simply
    // time passing. Nothing needs hover, a keyboard, precision or
    // speed.
    actions: ['tap', 'approach', 'dwell', 'return', 'wait'],
    // What engagement may do to the world.
    responses: ['gather', 'brighten', 'reveal', 'link', 'dissolve', 'drift-away'],
    // How an experience may end.
    outcomes: ['discovery', 'unresolved', 'dissolve'],
    // What a discovery may be.
    discoveries: ['creation-revealed', 'wonder', 'place'],
    // Hard performance bounds (the runtime enforces them again).
    bounds: {
      elements: 8,        // distinct element rows
      pieces: 10,         // total placed things, counts summed
      engage: 6,          // engagement rules
      lifeS: 150,         // seconds before an untaken mystery dissolves
      outcomes: 3,        // possible endings
      notBeforeS: 900,
      textChars: 140      // free-text (dev-only) field length
    }
  };

  var COMPLEXITIES = ['simple', 'moderate', 'deeper', 'very-deep'];
  var PHASES = ['curiosity', 'exploration', 'deep', 'reignition', 'quietish'];
  var RARITIES = ['common', 'uncommon', 'rare', 'very_rare', 'exceptional'];

  // ---------------------------------------------------------------
  // The candidate schema — the ONLY keys a candidate may carry, at
  // each level. Anything else is refused by name, whatever it holds.
  // ---------------------------------------------------------------
  var SCHEMA = {
    top: ['id', 'grammar', 'title', 'complexity', 'ingredients', 'elements',
          'engage', 'behaviour', 'outcome', 'constraints', 'requires'],
    ingredients: ['creation', 'creationKind', 'minPages', 'anchor'],
    element: ['role', 'show', 'of', 'place', 'count'],
    engage: ['action', 'on', 'seconds'],
    behaviour: ['onEngage', 'pace'],
    outcome: ['possible', 'discovery', 'residue'],
    residue: ['show', 'when'],
    constraints: ['rarity', 'phases', 'notBefore', 'oncePerVisit', 'lifeS']
  };

  // Keys that may never appear at ANY depth — a candidate that names
  // one is refused whole, not trimmed (Decision 33: a caller doing
  // something it must not is not cleaned up for). This is the privacy
  // boundary: nothing about a Creator's identity, credentials or
  // private world may ride into a generated experience.
  var FORBIDDEN_KEYS = [
    'stars', 'constellation', 'card', 'cardid', 'owner', 'ownerid',
    'creatorid', 'email', 'parentemail', 'memory', 'memories', 'orbit',
    'circle', 'token', 'session', 'secret', 'password', 'address',
    'nickname', 'identity', 'companionid'
  ];

  // String shapes that may never appear in any value: executable
  // code, markup, external references, credentials. A generator
  // produces descriptions, never behaviour and never a link.
  var FORBIDDEN_VALUE = new RegExp(
    'function\\s*\\(|=>|<\\s*script|javascript:|eval\\s*\\(|' +
    '__proto__|constructor\\s*\\(|require\\s*\\(|import\\s|' +
    'https?://|data:|@[a-z0-9._%-]+\\.[a-z]{2,}', 'i');

  // Free-text scans. Titles and notes are developer-facing (nothing
  // in the schema is ever shown to a child), but the vocabulary rules
  // hold even there: no gamification, nothing frightening, no
  // instruction-speak.
  var GAMIFY = new RegExp(
    '\\b(score|scores|points?|xp|badge|badges|level|levels|streak|' +
    'leaderboard|rank|ranking|coin|coins|prize|trophy|achievement|' +
    'quest|mission|timer|countdown|combo|collect\\s+all|win|wins|' +
    'unlock|winner)\\b', 'i');
  var FRIGHTEN = new RegExp(
    '\\b(blood|kill|killed|dead|death|die|dies|scream|terror|horror|' +
    'weapon|gun|knife|monster|demon|nightmare|trapped|drown)\\b', 'i');
  var INSTRUCT = new RegExp(
    '\\b(click here|tap here|instructions?|objective|task|complete the|' +
    'find the missing|you must|read this)\\b', 'i');

  function isPlain(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o);
  }
  function textIssue(s) {
    if (typeof s !== 'string') return null;
    if (s.length > CAPABILITIES.bounds.textChars) return 'text-too-long';
    if (FORBIDDEN_VALUE.test(s)) return 'generated-code-or-reference';
    if (GAMIFY.test(s)) return 'gamification-language';
    if (FRIGHTEN.test(s)) return 'frightening-content';
    if (INSTRUCT.test(s)) return 'instruction-language';
    return null;
  }

  // Walk every key and value at every depth. Keys outside the schema
  // for their level are the caller's to check; this catches the
  // absolute prohibitions wherever they hide.
  function sweep(node, path, reasons) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) sweep(node[i], path + '[' + i + ']', reasons);
      return;
    }
    if (isPlain(node)) {
      Object.keys(node).forEach(function (k) {
        var lk = String(k).toLowerCase();
        if (FORBIDDEN_KEYS.indexOf(lk) !== -1) {
          reasons.push('forbidden-key:' + path + '.' + k);
          return;
        }
        sweep(node[k], path + '.' + k, reasons);
      });
      return;
    }
    var t = textIssue(node);
    if (t) reasons.push(t + ':' + path);
  }

  function keysOutside(obj, allowed, where, reasons) {
    if (!isPlain(obj)) { reasons.push('not-an-object:' + where); return; }
    Object.keys(obj).forEach(function (k) {
      if (allowed.indexOf(k) === -1) reasons.push('unknown-key:' + where + '.' + k);
    });
  }

  // ---------------------------------------------------------------
  // validate(candidate, opts) → { ok, reasons }
  //
  // The one gate. opts.existing may carry the signatures of already
  // approved experiences (from signature() below) so a candidate that
  // merely reskins one is refused; opts is otherwise unused.
  // ---------------------------------------------------------------
  function validate(candidate, opts) {
    opts = opts || {};
    var reasons = [];
    var B = CAPABILITIES.bounds;

    if (!isPlain(candidate)) return { ok: false, reasons: ['not-an-object'] };

    // Shape first: unknown keys refused by name at every level.
    keysOutside(candidate, SCHEMA.top, 'candidate', reasons);
    if (reasons.length) return { ok: false, reasons: reasons };

    // The absolute prohibitions, at any depth.
    sweep(candidate, 'candidate', reasons);

    // Grammar.
    var g = GRAMMARS[candidate.grammar];
    if (!g) reasons.push('unknown-grammar:' + candidate.grammar);

    if (typeof candidate.id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{2,60}$/.test(candidate.id)) {
      reasons.push('bad-id');
    }
    if (candidate.complexity !== undefined &&
        COMPLEXITIES.indexOf(candidate.complexity) === -1) {
      reasons.push('unknown-complexity:' + candidate.complexity);
    }

    // Ingredients.
    var ing = candidate.ingredients || {};
    if (candidate.ingredients !== undefined) {
      keysOutside(ing, SCHEMA.ingredients, 'ingredients', reasons);
    }
    var wantsCreation = ing.creation === true;
    if (g) {
      if (g.creation === 'required' && !wantsCreation) {
        reasons.push('grammar-needs-creation:' + g.id);
      }
      if (g.creation === 'never' && wantsCreation) {
        reasons.push('grammar-takes-no-creation:' + g.id);
      }
    }
    if (ing.creationKind !== undefined &&
        ['story', 'any'].indexOf(ing.creationKind) === -1) {
      reasons.push('unknown-creation-kind:' + ing.creationKind);
    }
    if (ing.minPages !== undefined &&
        !(typeof ing.minPages === 'number' && ing.minPages >= 0 && ing.minPages <= 40)) {
      reasons.push('bad-min-pages');
    }

    // Elements.
    var els = candidate.elements;
    if (!Array.isArray(els) || els.length === 0) {
      reasons.push('no-elements');
      els = [];
    }
    if (els.length > B.elements) reasons.push('too-many-elements:' + els.length);
    var pieceTotal = 0;
    var roles = {};
    els.forEach(function (el, i) {
      if (!isPlain(el)) { reasons.push('not-an-object:elements[' + i + ']'); return; }
      keysOutside(el, SCHEMA.element, 'elements[' + i + ']', reasons);
      if (typeof el.role !== 'string' || !/^[a-z][a-z0-9-]{0,24}$/.test(el.role)) {
        reasons.push('bad-role:elements[' + i + ']');
      } else roles[el.role] = true;
      if (CAPABILITIES.shows.indexOf(el.show) === -1) {
        reasons.push('unavailable-capability:show:' + el.show);
      }
      if (el.show === 'shard' && !wantsCreation) {
        reasons.push('shard-needs-creation');
      }
      if (el.of !== undefined && ['cover', 'sky'].indexOf(el.of) === -1) {
        reasons.push('unavailable-capability:of:' + el.of);
      }
      if (CAPABILITIES.places.indexOf(el.place) === -1) {
        reasons.push('unavailable-capability:place:' + el.place);
      }
      if (el.place === 'toward-creation' && !wantsCreation) {
        reasons.push('toward-creation-needs-creation');
      }
      var n = (el.count === undefined) ? 1 : el.count;
      if (!(typeof n === 'number' && n >= 1 && n <= 6 && n === Math.floor(n))) {
        reasons.push('bad-count:elements[' + i + ']');
        n = 1;
      }
      pieceTotal += n;
    });
    if (pieceTotal > B.pieces) reasons.push('too-many-pieces:' + pieceTotal);

    // Engagement.
    var eng = candidate.engage;
    if (eng !== undefined && !Array.isArray(eng)) { reasons.push('bad-engage'); eng = []; }
    eng = eng || [];
    if (eng.length > B.engage) reasons.push('too-many-engagements:' + eng.length);
    eng.forEach(function (e, i) {
      if (!isPlain(e)) { reasons.push('not-an-object:engage[' + i + ']'); return; }
      keysOutside(e, SCHEMA.engage, 'engage[' + i + ']', reasons);
      if (CAPABILITIES.actions.indexOf(e.action) === -1) {
        reasons.push('unavailable-capability:action:' + e.action);
      }
      if (e.on !== undefined && !roles[e.on]) {
        reasons.push('engage-on-unknown-role:' + e.on);
      }
      if (e.seconds !== undefined) {
        if (!(typeof e.seconds === 'number' && e.seconds >= 1 && e.seconds <= 60)) {
          reasons.push('bad-seconds:engage[' + i + ']');
        }
        // seconds means "this long, gently" (a dwell, a wait) — it is
        // never a deadline, and only the unhurried actions carry it.
        if (e.action === 'tap' || e.action === 'approach') {
          reasons.push('no-deadlines:engage[' + i + ']');
        }
      }
    });

    // Behaviour.
    var beh = candidate.behaviour || {};
    if (candidate.behaviour !== undefined) {
      keysOutside(beh, SCHEMA.behaviour, 'behaviour', reasons);
      if (beh.onEngage !== undefined &&
          CAPABILITIES.responses.indexOf(beh.onEngage) === -1) {
        reasons.push('unavailable-capability:onEngage:' + beh.onEngage);
      }
      if (beh.pace !== undefined &&
          ['slow', 'drifting', 'still'].indexOf(beh.pace) === -1) {
        reasons.push('unavailable-capability:pace:' + beh.pace);
      }
    }

    // Outcome.
    var out = candidate.outcome;
    if (!isPlain(out)) { reasons.push('no-outcome'); out = {}; }
    else keysOutside(out, SCHEMA.outcome, 'outcome', reasons);
    var possible = Array.isArray(out.possible) ? out.possible : [];
    if (!possible.length) reasons.push('no-possible-outcome');
    if (possible.length > B.outcomes) reasons.push('too-many-outcomes');
    possible.forEach(function (o) {
      if (CAPABILITIES.outcomes.indexOf(o) === -1) {
        reasons.push('unavailable-capability:outcome:' + o);
      }
    });
    if (possible.indexOf('discovery') !== -1) {
      if (CAPABILITIES.discoveries.indexOf(out.discovery) === -1) {
        reasons.push('unavailable-capability:discovery:' + out.discovery);
      }
      if (out.discovery === 'creation-revealed' && !wantsCreation) {
        reasons.push('discovery-needs-creation');
      }
    }
    if (out.residue !== undefined) {
      if (!isPlain(out.residue)) reasons.push('bad-residue');
      else {
        keysOutside(out.residue, SCHEMA.residue, 'outcome.residue', reasons);
        if (['mark', 'glint'].indexOf(out.residue.show) === -1) {
          reasons.push('unavailable-capability:residue:' + out.residue.show);
        }
        if (out.residue.when !== undefined &&
            ['resolved', 'dissolved', 'either'].indexOf(out.residue.when) === -1) {
          reasons.push('bad-residue-when');
        }
      }
    }

    // Constraints.
    var con = candidate.constraints || {};
    if (candidate.constraints !== undefined) {
      keysOutside(con, SCHEMA.constraints, 'constraints', reasons);
      if (con.rarity !== undefined && RARITIES.indexOf(con.rarity) === -1) {
        reasons.push('unknown-rarity:' + con.rarity);
      }
      if (con.phases !== undefined) {
        if (!Array.isArray(con.phases) || !con.phases.length) reasons.push('bad-phases');
        else con.phases.forEach(function (p) {
          if (PHASES.indexOf(p) === -1) reasons.push('unknown-phase:' + p);
        });
      }
      if (con.notBefore !== undefined &&
          !(typeof con.notBefore === 'number' && con.notBefore >= 0 &&
            con.notBefore <= B.notBeforeS)) {
        reasons.push('bad-not-before');
      }
      if (con.lifeS !== undefined &&
          !(typeof con.lifeS === 'number' && con.lifeS >= 20 && con.lifeS <= B.lifeS)) {
        reasons.push('bad-life');
      }
    }

    // Declared requirements must all be capabilities that exist.
    if (candidate.requires !== undefined) {
      if (!Array.isArray(candidate.requires)) reasons.push('bad-requires');
      else candidate.requires.forEach(function (r) {
        var known =
          CAPABILITIES.shows.indexOf(r) !== -1 ||
          CAPABILITIES.actions.indexOf(r) !== -1 ||
          CAPABILITIES.responses.indexOf(r) !== -1 ||
          CAPABILITIES.discoveries.indexOf(r) !== -1 ||
          r === 'creation' || r === 'anchor';
        if (!known) reasons.push('unavailable-capability:requires:' + r);
      });
    }

    // ---------- experience quality ----------
    // A mystery must pose a question; a sure thing that simply
    // happens with nothing to wonder at is decoration, and a grammar
    // whose whole answer is "act and be paid" is the lesson the Ether
    // must never teach.
    var actsOnly = eng.map(function (e) { return e.action; });
    var childActs = actsOnly.filter(function (a) { return a !== 'wait'; });
    if (possible.length === 1 && possible[0] === 'discovery' && !childActs.length) {
      reasons.push('outcome-obvious-no-question');
    }
    if (candidate.grammar === 'experiment' && possible.indexOf('unresolved') === -1) {
      reasons.push('experiment-must-stay-uncertain');
    }
    if (childActs.indexOf('tap') !== -1 && childActs.length === 1 &&
        eng.length === 1 && possible.length === 1 && possible[0] === 'discovery') {
      reasons.push('tap-for-sure-outcome');
    }

    // A reskin of something already approved is not a new experience.
    if (opts.existing && opts.existing.indexOf(signature(candidate)) !== -1) {
      reasons.push('reskin-of-existing');
    }

    return { ok: reasons.length === 0, reasons: reasons };
  }

  // The structural identity of a candidate — what it looks like as an
  // EXPERIENCE, ignoring its name and free text. Two candidates with
  // the same signature would feel like the same thing to a child.
  function signature(candidate) {
    try {
      var els = (candidate.elements || []).map(function (e) {
        return e.show + '@' + e.place;
      }).sort().join(',');
      var eng = (candidate.engage || []).map(function (e) {
        return e.action;
      }).sort().join(',');
      var out = ((candidate.outcome || {}).possible || []).slice().sort().join(',');
      return candidate.grammar + '|' + els + '|' + eng + '|' + out +
             '|' + (((candidate.outcome || {}).residue) ? 'residue' : '');
    } catch (e) { return 'invalid'; }
  }

  // ---------------------------------------------------------------
  // The generation contract — everything an asynchronous generator is
  // handed, and the whole of what it is handed: the grammar
  // vocabulary, the capability vocabulary, the schema, the public
  // structure of available creations, a summary of the approved pool
  // (so generation is demand-aware, never for its own sake), and the
  // boundaries in words. Built here so the offline lab, the suite and
  // any future pipeline share ONE copy — a hand-mirrored contract is
  // a promise nobody can keep (Decision 30).
  // ---------------------------------------------------------------
  function contract(input) {
    input = input || {};
    return {
      version: 1,
      grammars: Object.keys(GRAMMARS).map(function (k) {
        var g = GRAMMARS[k];
        return { id: g.id, poses: g.poses, creation: g.creation, leansTo: g.leansTo };
      }),
      capabilities: CAPABILITIES,
      schema: SCHEMA,
      complexities: COMPLEXITIES,
      phases: PHASES,
      rarities: RARITIES,
      // Only the public creative structure of creations — never
      // bytes, never a Creator's private anything (the lens,
      // js/etherCreationLens.js, is the one projector).
      creations: Array.isArray(input.creations) ? input.creations : [],
      pool: input.pool || { active: 0, byGrammar: {}, signatures: [] },
      boundaries: [
        'produce data in the schema only — never code, never markup, never a reference',
        'no new capabilities, mechanics, surfaces, sounds or vocabulary — if it is not in the capability lists, reject the idea',
        'nothing counted, earned, owed, timed or ranked; nothing frightening; no reading required',
        'a mystery is posed by the world and never announced; engagement is always optional',
        'not every mystery resolves — unresolved is a first-class ending',
        'harder means more subtle relationships and more observation, never faster hands or longer words',
        'a creation contributes only its public creative structure; nothing private exists here to use'
      ]
    };
  }

  // ---------------------------------------------------------------
  // Demand — should anything be generated at all? Generation is
  // useful when variety is thin, not because a clock rang. Consulted
  // by the offline lab; the runtime never generates.
  // ---------------------------------------------------------------
  function demand(pool) {
    var entries = (pool && pool.experiences) || [];
    var active = entries.filter(function (e) { return e && e.status === 'active'; });
    var byGrammar = {};
    active.forEach(function (e) {
      var g = e.candidate && e.candidate.grammar;
      if (g) byGrammar[g] = (byGrammar[g] || 0) + 1;
    });
    var unused = Object.keys(GRAMMARS).filter(function (g) { return !byGrammar[g]; });
    var reasons = [];
    if (active.length < 4) reasons.push('pool-thin:' + active.length + '-active');
    if (unused.length > Object.keys(GRAMMARS).length / 2) {
      reasons.push('grammars-unused:' + unused.join(','));
    }
    var most = 0;
    Object.keys(byGrammar).forEach(function (g) { most = Math.max(most, byGrammar[g]); });
    if (active.length >= 4 && most / active.length > 0.5) {
      reasons.push('one-grammar-dominates');
    }
    return {
      activeCount: active.length,
      byGrammar: byGrammar,
      grammarsUnused: unused,
      suggestGenerate: reasons.length > 0,
      reasons: reasons
    };
  }

  global.EtherGrammar = {
    GRAMMARS: GRAMMARS,
    CAPABILITIES: CAPABILITIES,
    SCHEMA: SCHEMA,
    COMPLEXITIES: COMPLEXITIES,
    PHASES: PHASES,
    RARITIES: RARITIES,
    FORBIDDEN_KEYS: FORBIDDEN_KEYS,
    validate: validate,
    signature: signature,
    contract: contract,
    demand: demand
  };
})(typeof window !== 'undefined' ? window : this);
