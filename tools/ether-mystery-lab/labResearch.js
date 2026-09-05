// tools/ether-mystery-lab/labResearch.js — INVALID DOES NOT MEAN
// INVISIBLE.
//
// SPRINT — Ether Mystery Lab: Rejected Candidate Research (Decision 58).
//
// THE LAB ANSWERS TWO SEPARATE QUESTIONS. "Is this candidate
// technically expressible by the Ether?" is the validator's, and it
// already had an answer. "Is the underlying idea worth expressing?" is
// the reviewer's, and until this file existed a refused candidate gave
// them nothing to answer it with: a reason code, and no way to see,
// try or learn from what the model was reaching for. A candidate can
// be VALID + BAD IDEA, INVALID + GOOD IDEA, VALID + GOOD IDEA or
// INVALID + BAD IDEA, and those are four different outcomes.
//
// FOUR THINGS THIS FILE DOES, ALL PURE:
//   intent()   — one plain sentence about what the model was trying to
//                make, DERIVED from what the candidate actually
//                carries and never invented, never asked of a model.
//   plainWhy() — the validator's reason codes in a reviewer's words.
//   project()  — a NARROW, WRITTEN-DOWN, mechanical repair, so an idea
//                refused for its ENCODING can still be experienced.
//   study()    — which of the four §3 cases a candidate is in.
//
// THE PROJECTION NEVER GUESSES, AND THAT IS THE WHOLE DISCIPLINE. Each
// rule below is a named, obvious, reportable edit — move a key the
// schema has exactly one home for, drop a key the schema has no home
// for, clamp a number to the bound the schema already states, set
// aside a title the sky never renders. Nothing infers what a model
// "meant". After the rules run, the REAL validator decides whether the
// result stands: this file never declares anything valid. If a
// mechanical repair cannot get there, the answer is that it cannot be
// previewed, and saying so is the research result. A projection that
// guessed would be a parallel interpretation of candidate semantics,
// which the sprint forbids by name.
//
// RESEARCH_WAIVED IS THE ONE DELIBERATE BYPASS, AND IT IS FOUR NAMED
// REASONS. The validator holds two kinds of rule: statements about
// what the runtime can PERFORM (capabilities, shapes, bounds, the
// privacy boundary) and the product's own DESIGN judgement (a mystery
// must stay a question; the sky already holds one shaped like this).
// The first kind can never be waived — a preview that faked a
// capability would be a lie about the runtime. The second kind is
// exactly what a research instrument exists to argue with, so on the
// TRY IDEA path only, the Lab hands the interpreter a grammar that
// delegates to the REAL validator and waives those four reasons and
// nothing else. It is never installed on the PLAY path and the
// production pool is never loaded where it lives.
//
// No DOM, no storage, no network, no clock, no model. Loads identically
// in a browser and in Node, so the Lab page, the preview document and
// the suite consult the one copy.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // The four cases (§3), written down.
  // ---------------------------------------------------------------
  var CASES = {
    playable: 'valid, and the existing interpreter can perform it',
    'try-idea': 'not production-valid, but the underlying idea can be ' +
      'experienced through the existing Ether',
    unsupported: 'the idea needs a capability the Ether does not have yet',
    uninterpretable: 'there is not enough here — or it is not allowed here — ' +
      'to show anything honestly'
  };

  // Reasons that end the conversation. A candidate carrying one is
  // never repaired and never previewed: the first three are the
  // privacy and safety boundaries, and the rest mean there is no
  // experience in the record to look at.
  var HARD_STOP = [
    /^forbidden-key:/, /^generated-code-or-reference/, /^frightening-content/,
    /^stars-boundary/, /^not-a-candidate/, /^not-an-object/,
    /^no-elements$/, /^unknown-grammar:/, /^bad-role:/, /^bad-engage$/,
    /^no-outcome$/, /^no-possible-outcome$/
  ];

  // The product's DESIGN judgements — the only reasons a research run
  // may stand over. Every one of them is the Ether having an opinion
  // about what makes a good mystery; not one of them says the runtime
  // cannot perform the thing.
  var RESEARCH_WAIVED = [
    'outcome-obvious-no-question',
    'tap-for-sure-outcome',
    'experiment-must-stay-uncertain',
    'reskin-of-existing'
  ];

  function G(opts) { return (opts && opts.grammar) || global.EtherGrammar; }
  function S(opts) { return (opts && opts.support) || global.LabPreviewSupport; }
  function isPlain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lowerFirst(s) { return String(s || '').replace(/^./, function (m) { return m.toLowerCase(); }); }

  // ---------------------------------------------------------------
  // Paths. The validator names where it refused — `candidate.figure`,
  // `ingredients.skyFigure`, `elements[2].colour`, `engage[0]` — and
  // the rules need to reach exactly that container and no other.
  // ---------------------------------------------------------------
  function container(work, where) {
    if (where === 'candidate') return work;
    if (where === 'ingredients') return work.ingredients;
    if (where === 'behaviour') return work.behaviour;
    if (where === 'outcome') return work.outcome;
    if (where === 'outcome.residue') return work.outcome && work.outcome.residue;
    if (where === 'constraints') return work.constraints;
    var m = /^(elements|engage)\[(\d+)\]$/.exec(where);
    if (m) {
      var arr = work[m[1]];
      return Array.isArray(arr) ? arr[Number(m[2])] : null;
    }
    return null;
  }
  // 'unknown-key:elements[2].colour' → { where:'elements[2]', key:'colour' }
  function splitPath(p) {
    var at = String(p).lastIndexOf('.');
    if (at === -1) return null;
    return { where: p.slice(0, at), key: p.slice(at + 1) };
  }
  function clamp(v, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }
  function slug(s) {
    var t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 60);
    return /^[a-z0-9][a-z0-9-]{2,60}$/.test(t) ? t : '';
  }

  // ---------------------------------------------------------------
  // THE PROJECTION RULES. Every one is mechanical, obvious and
  // reported. Adding a rule that needs a judgement about what the
  // model meant is the thing this table exists to prevent.
  // ---------------------------------------------------------------
  var RULES = [
    {
      id: 'relocate-known-key',
      why: 'the schema has exactly one home for this field, and the model put it one level up',
      run: function (work, reasons, log) {
        var moved = false;
        [['residue', 'residue'], ['discovery', 'discovery']].forEach(function (pair) {
          if (reasons.indexOf('unknown-key:candidate.' + pair[0]) === -1) return;
          if (work[pair[0]] === undefined) return;
          work.outcome = isPlain(work.outcome) ? work.outcome : {};
          if (work.outcome[pair[1]] === undefined) {
            work.outcome[pair[1]] = work[pair[0]];
            log('relocate-known-key', pair[0] + ' moved into outcome.' + pair[1],
              'it wanted “' + pair[0] + '”, and the schema keeps that inside the outcome');
          } else {
            log('relocate-known-key', pair[0] + ' dropped — outcome.' + pair[1] + ' already says one',
              'it said “' + pair[0] + '” twice; the one already in the right place was kept');
          }
          delete work[pair[0]];
          moved = true;
        });
        return moved;
      }
    },
    {
      id: 'drop-unknown-key',
      why: 'the schema has no place for this field at all, so nothing can carry it',
      run: function (work, reasons, log) {
        var did = false;
        reasons.forEach(function (r) {
          if (r.indexOf('unknown-key:') !== 0) return;
          var sp = splitPath(r.slice('unknown-key:'.length));
          if (!sp) return;
          var box = container(work, sp.where);
          if (!isPlain(box) || box[sp.key] === undefined) return;
          delete box[sp.key];
          log('drop-unknown-key', sp.where + '.' + sp.key,
            'it invents “' + sp.key + '”, which the sky has nowhere to put — ' +
            'the rest of the idea is shown without it');
          did = true;
        });
        return did;
      }
    },
    {
      id: 'supply-id',
      why: 'an id is bookkeeping — it names the record and never appears on the sky',
      run: function (work, reasons, log, opts) {
        if (reasons.indexOf('bad-id') === -1) return false;
        var id = slug(work.title) || slug(opts && opts.fallbackId) || 'lab-research-idea';
        work.id = id;
        log('supply-id', id, 'its name was not in the form ids take here, so one was made from its own words');
        return true;
      }
    },
    {
      id: 'imply-creation',
      why: 'the candidate already names something only a creation can give',
      run: function (work, reasons, log) {
        var wants = reasons.some(function (r) {
          return r.indexOf('grammar-needs-creation') === 0 ||
            r === 'shard-needs-creation' || r === 'toward-creation-needs-creation' ||
            r === 'discovery-needs-creation';
        });
        if (!wants) return false;
        work.ingredients = isPlain(work.ingredients) ? work.ingredients : {};
        if (work.ingredients.creation === true) return false;
        work.ingredients.creation = true;
        log('imply-creation', 'ingredients.creation = true',
          'it is already about a creation — a piece of one, a line toward one, ' +
          'or one being found — so it is shown with one');
        return true;
      }
    },
    {
      id: 'drop-deadline',
      why: 'nothing in the Ether is timed; the action stays and the time limit goes',
      run: function (work, reasons, log) {
        var did = false;
        reasons.forEach(function (r) {
          if (r.indexOf('no-deadlines:') !== 0) return;
          var box = container(work, r.slice('no-deadlines:'.length));
          if (!isPlain(box) || box.seconds === undefined) return;
          delete box.seconds;
          log('drop-deadline', 'the time limit on “' + box.action + '”',
            'it put a countdown on a touch; the touch stays, the countdown does not exist here');
          did = true;
        });
        return did;
      }
    },
    {
      id: 'clamp-to-bounds',
      why: 'the schema states these bounds, so a number outside one has an obvious nearest allowed value',
      run: function (work, reasons, log) {
        var did = false;
        var NUM = [
          ['bad-count:', 'count', 1, 6, 'how many of them there are'],
          ['bad-seconds:', 'seconds', 1, 60, 'how long it waits']
        ];
        reasons.forEach(function (r) {
          NUM.forEach(function (spec) {
            if (r.indexOf(spec[0]) !== 0) return;
            var box = container(work, r.slice(spec[0].length));
            if (!isPlain(box)) return;
            var was = box[spec[1]];
            box[spec[1]] = clamp(was, spec[2], spec[3]);
            log('clamp-to-bounds', spec[1] + ' ' + JSON.stringify(was) + ' → ' + box[spec[1]],
              spec[4] + ' was outside what the sky allows, and was brought to the nearest it does');
            did = true;
          });
        });
        var C = { 'bad-not-before': ['notBefore', 0, 900], 'bad-life': ['lifeS', 20, 150],
                  'bad-min-pages': ['minPages', 0, 40] };
        Object.keys(C).forEach(function (code) {
          if (reasons.indexOf(code) === -1) return;
          var spec = C[code];
          var box = code === 'bad-min-pages' ? work.ingredients : work.constraints;
          if (!isPlain(box) || box[spec[0]] === undefined) return;
          var was = box[spec[0]];
          box[spec[0]] = clamp(was, spec[1], spec[2]);
          log('clamp-to-bounds', spec[0] + ' ' + JSON.stringify(was) + ' → ' + box[spec[0]],
            'it was outside what the sky allows, and was brought to the nearest it does');
          did = true;
        });
        return did;
      }
    },
    {
      id: 'set-aside-title',
      why: 'a title is developer-facing and the sky never renders one, so it can be set aside without touching the experience',
      run: function (work, reasons, log) {
        var hit = reasons.some(function (r) {
          return /^(text-too-long|gamification-language|instruction-language):candidate\.title$/.test(r);
        });
        if (!hit || work.title === undefined) return false;
        log('set-aside-title', '“' + work.title + '”',
          'the words in its own name are not allowed here — the sky never shows a title, ' +
          'so the idea is shown without it and its words are kept in this record');
        delete work.title;
        return true;
      }
    },
    {
      id: 'drop-unusable-label',
      why: 'these fields label a candidate for the Composer and are never performed',
      run: function (work, reasons, log) {
        var did = false;
        function drop(box, key, what) {
          if (!isPlain(box) || box[key] === undefined) return;
          delete box[key];
          log('drop-unusable-label', key, what);
          did = true;
        }
        reasons.forEach(function (r) {
          if (r.indexOf('unknown-complexity:') === 0) {
            drop(work, 'complexity', 'it names a depth the Ether does not have a word for; ' +
              'nothing on the sky depends on it');
          }
          if (r.indexOf('unknown-rarity:') === 0) {
            drop(work.constraints, 'rarity', 'it names a rarity the Composer does not have; ' +
              'a preview chooses its own moment anyway');
          }
          if (r.indexOf('unknown-phase:') === 0 || r === 'bad-phases') {
            drop(work.constraints, 'phases', 'it names a part of a visit the Composer does not have');
          }
          if (r.indexOf('unknown-creation-kind:') === 0) {
            drop(work.ingredients, 'creationKind', 'the Ether holds shared stories and nothing else yet');
          }
          if (r === 'bad-requires' || r.indexOf('unavailable-capability:requires:') === 0) {
            drop(work, 'requires', 'this field only restates what the candidate already asks for, ' +
              'and the interpreter never reads it');
          }
        });
        return did;
      }
    }
  ];

  // ---------------------------------------------------------------
  // project(candidate, opts) → { ok, candidate, applied[], remaining[],
  //                              waived[], passes }
  //
  // The validator returns early on an unknown top-level key, so a
  // refused candidate reports only its FIRST family of problems — the
  // rules therefore run in passes until nothing more changes. `ok` is
  // the REAL validator's answer about the repaired candidate, with
  // only the four design reasons stood over.
  // ---------------------------------------------------------------
  function project(candidate, opts) {
    opts = opts || {};
    var grammar = G(opts);
    if (!isPlain(candidate) || !grammar) {
      return { ok: false, candidate: null, applied: [], remaining: ['not-a-candidate'],
               waived: [], passes: 0 };
    }
    var work = clone(candidate);
    var applied = [];
    function log(rule, what, plain) { applied.push({ rule: rule, what: what, plain: plain }); }

    var v = grammar.validate(work, {});
    var passes = 0;
    while (!v.ok && passes < 8) {
      var changed = false;
      for (var i = 0; i < RULES.length; i++) {
        if (RULES[i].run(work, v.reasons, log, opts)) changed = true;
      }
      passes++;
      if (!changed) break;
      v = grammar.validate(work, {});
    }
    var waived = v.reasons.filter(function (r) { return RESEARCH_WAIVED.indexOf(r) !== -1; });
    var remaining = v.reasons.filter(function (r) { return RESEARCH_WAIVED.indexOf(r) === -1; });
    return {
      ok: remaining.length === 0,
      candidate: work,
      applied: applied,
      remaining: remaining,
      waived: waived,
      passes: passes
    };
  }

  // ---------------------------------------------------------------
  // THE RESEARCH GRAMMAR. Delegates every rule to the real validator
  // and stands over exactly RESEARCH_WAIVED. Handed to
  // EtherMystery.mount({grammar}) on the TRY IDEA path ONLY, so the
  // interpreter performs the idea as written rather than the Lab
  // performing an approximation of it.
  // ---------------------------------------------------------------
  function researchGrammar(base) {
    base = base || global.EtherGrammar;
    if (!base) return null;
    var g = {};
    Object.keys(base).forEach(function (k) { g[k] = base[k]; });
    g.researchMode = true;
    g.validate = function (cand, o) {
      var v = base.validate(cand, o);
      if (v.ok) return v;
      var left = v.reasons.filter(function (r) { return RESEARCH_WAIVED.indexOf(r) === -1; });
      return { ok: left.length === 0, reasons: left,
               waived: v.reasons.filter(function (r) { return RESEARCH_WAIVED.indexOf(r) !== -1; }) };
    };
    return g;
  }

  // ---------------------------------------------------------------
  // PLAIN WHY — the validator's codes in a reviewer's language. No
  // schema word survives unless it is the model's own invented field
  // name, which is exactly the thing worth reading.
  // ---------------------------------------------------------------
  var KIND = {
    show: 'way for something to look', place: 'place to put something',
    action: 'thing a child can do', onEngage: 'way for the sky to answer',
    pace: 'way of moving', outcome: 'way to end', discovery: 'thing to find',
    residue: 'mark to leave behind', of: 'thing a piece can be part of',
    requires: 'capability'
  };
  function shortKey(p) { return String(p).split('.').pop(); }

  var WHY = [
    [/^unknown-key:(.+)$/, function (m) {
      return 'it invents a field the schema has no place for: “' + shortKey(m[1]) + '”';
    }],
    [/^forbidden-key:(.+)$/, function (m) {
      return 'it names something that may never travel: “' + shortKey(m[1]) + '”';
    }],
    [/^unavailable-capability:([a-zA-Z]+):(.*)$/, function (m) {
      return 'it asks for “' + m[2] + '”, which is not a ' + (KIND[m[1]] || 'capability') +
        ' the Ether has';
    }],
    [/^unknown-grammar:(.*)$/, function (m) {
      return 'it is written in a shape of experience the Ether does not know: “' + m[1] + '”';
    }],
    [/^bad-id$/, function () { return 'its name is not in the form names take here'; }],
    [/^no-elements$/, function () { return 'there is nothing on the sky in it'; }],
    [/^no-outcome$|^no-possible-outcome$/, function () { return 'it never says how it could end'; }],
    [/^no-deadlines:/, function () { return 'it puts a time limit on a touch, and nothing here is timed'; }],
    [/^tap-for-sure-outcome$/, function () {
      return 'one touch leads straight to a certain discovery — the Ether asks a mystery to stay a question';
    }],
    [/^outcome-obvious-no-question$/, function () {
      return 'it always ends the same way with nothing for a child to do, so nothing is wondered at';
    }],
    [/^experiment-must-stay-uncertain$/, function () {
      return 'it is the kind of experience that must be allowed not to answer, and this one always answers';
    }],
    [/^reskin-of-existing$/, function () {
      return 'the sky already holds an experience shaped exactly like this one';
    }],
    [/^gamification-language:(.+)$/, function (m) {
      return 'the words in its ' + shortKey(m[1]) + ' are the language of scores and prizes';
    }],
    [/^instruction-language:(.+)$/, function (m) {
      return 'the words in its ' + shortKey(m[1]) + ' tell a child what to do, and nothing here is announced';
    }],
    [/^frightening-content:(.+)$/, function (m) {
      return 'the words in its ' + shortKey(m[1]) + ' are not for this place';
    }],
    [/^text-too-long:(.+)$/, function (m) { return 'its ' + shortKey(m[1]) + ' runs on too long'; }],
    [/^generated-code-or-reference:(.+)$/, function () {
      return 'it carries something that is not a description — code, markup or a link';
    }],
    [/^(shard|toward-creation|discovery)-needs-creation$/, function () {
      return 'it is about a creation without ever saying it needs one';
    }],
    [/^grammar-needs-creation:/, function () {
      return 'the shape of experience it chose is always about a creation, and it names none';
    }],
    [/^grammar-takes-no-creation:/, function () {
      return 'the shape of experience it chose is never about a creation, and it names one';
    }],
    [/^too-many-(elements|pieces|engagements|outcomes)/, function (m) {
      return 'there is more in it than the sky will hold at once (' + m[1] + ')';
    }],
    [/^bad-count:/, function () { return 'it asks for a number of things the sky does not allow'; }],
    [/^bad-seconds:/, function () { return 'it asks for a length of time the sky does not allow'; }],
    [/^engage-on-unknown-role:(.*)$/, function (m) {
      return 'a child is invited to touch “' + m[1] + '”, and there is no such thing in it';
    }]
  ];

  // A key on the grammar's own FORBIDDEN list, at ANY depth. The
  // validator returns early on an unknown TOP-LEVEL key, so its own
  // privacy sweep never runs for a candidate that also invented one —
  // and `constellation` at the top level therefore comes back merely
  // as "unknown". A privacy boundary is not something to repair around,
  // so this is asked before any rule runs and the answer is case D.
  function namesForbidden(node, path, grammar, hits) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) namesForbidden(node[i], path + '[' + i + ']', grammar, hits);
      return hits;
    }
    if (isPlain(node)) {
      Object.keys(node).forEach(function (k) {
        if (grammar.FORBIDDEN_KEYS.indexOf(String(k).toLowerCase()) !== -1) {
          hits.push('forbidden-key:' + path + '.' + k);
          return;
        }
        namesForbidden(node[k], path + '.' + k, grammar, hits);
      });
    }
    return hits;
  }

  function plainWhy(reasons) {
    var seen = {};
    return (reasons || []).map(function (r) {
      for (var i = 0; i < WHY.length; i++) {
        var m = WHY[i][0].exec(r);
        if (m) return WHY[i][1](m);
      }
      return 'the sky refuses it, for a reason with no plain wording yet (' + r + ')';
    }).filter(function (s) {
      if (seen[s]) return false;
      seen[s] = true;
      return true;
    });
  }

  // Capability names a candidate asked for that do not exist at all —
  // §3's case C, in the reviewer's words.
  function missingCapabilities(reasons) {
    var out = [];
    (reasons || []).forEach(function (r) {
      var m = /^unavailable-capability:([a-zA-Z]+):(.*)$/.exec(r);
      if (m) out.push(m[2] + ' (a ' + (KIND[m[1]] || 'capability') + ')');
    });
    return out;
  }

  // ---------------------------------------------------------------
  // INTENT — derived, never invented, never asked of a model.
  //
  // Everything in the sentence comes off the candidate itself: its own
  // title (the model's own words), the shape of experience it chose,
  // what it places, what a child could do, and how it hoped to end.
  // The vocabulary is labPreviewSupport's — one set of plain words for
  // the whole Lab, rather than a second one that could drift.
  // ---------------------------------------------------------------
  function intent(candidate, opts) {
    var c = isPlain(candidate) ? candidate : {};
    var Sup = S(opts);
    var grammar = G(opts);
    var from = [];
    var els = Array.isArray(c.elements) ? c.elements : [];
    var out = isPlain(c.outcome) ? c.outcome : {};

    var placed = '';
    if (Sup && els.length) {
      var m = Sup.plain({ elements: els }).mystery;
      if (m && m !== 'Nothing is placed.') { placed = lowerFirst(m).replace(/\.$/, ''); from.push('elements'); }
    }
    var poses = '';
    var g = grammar && grammar.GRAMMARS ? grammar.GRAMMARS[c.grammar] : null;
    if (g) { poses = g.poses; from.push('grammar'); }

    var ending = '';
    if (Sup) {
      var p = Sup.plain(c);
      if (out.residue) { ending = 'and something faint stays behind afterwards'; from.push('residue'); }
      else if (Array.isArray(out.possible) && out.possible.indexOf('discovery') !== -1) {
        ending = 'and ' + lowerFirst(p.discovery.split(' Or it may stay')[0].replace(/\.\s*$/, ''));
        from.push('outcome');
      } else if (Array.isArray(out.possible) && out.possible.length) {
        ending = 'and it is allowed to stay a question';
        from.push('outcome');
      }
    }

    // What it reached for that this world has no room for — the names
    // it invented, and the capabilities it asked for by name.
    var reaching = [];
    if (grammar && grammar.SCHEMA) {
      Object.keys(c).forEach(function (k) {
        if (grammar.SCHEMA.top.indexOf(k) === -1) reaching.push(k);
      });
      if (isPlain(c.ingredients)) {
        Object.keys(c.ingredients).forEach(function (k) {
          if (grammar.SCHEMA.ingredients.indexOf(k) === -1) reaching.push(k);
        });
      }
    }
    if (reaching.length) from.push('invented fields');

    var core = placed || poses;
    if (!core && !c.title) {
      return { ok: false, sentence: null, title: null, derivedFrom: [], reaching: reaching,
               note: 'nothing in this record says what it was for' };
    }
    var sentence = 'The model was trying to make ' +
      (c.title ? '“' + c.title + '”' + (core ? ' — ' : '') : '') +
      core + (ending ? ', ' + ending : '') + '.';
    if (c.title) from.push('title');

    return {
      ok: true,
      sentence: sentence,
      title: c.title || null,
      derivedFrom: from,
      reaching: reaching,
      note: 'derived from what the candidate carries — nothing was inferred and no model was asked'
    };
  }

  // ---------------------------------------------------------------
  // study(candidate, opts) → the whole research view of one candidate.
  // ---------------------------------------------------------------
  function study(candidate, opts) {
    opts = opts || {};
    var grammar = G(opts);
    var Sup = S(opts);
    var res = {
      valid: false, reasons: [], plainReasons: [], intent: intent(candidate, opts),
      'case': 'uninterpretable', caseNote: '', support: null, projection: null,
      missing: [], previewCandidate: null, previewMode: null
    };
    if (!grammar || !isPlain(candidate)) {
      res.reasons = ['not-a-candidate'];
      res.plainReasons = plainWhy(res.reasons);
      res.caseNote = CASES.uninterpretable;
      return res;
    }

    var v = opts.validation || grammar.validate(candidate, { existing: opts.poolSignatures || [] });
    res.valid = !!v.ok;
    res.reasons = (v.reasons || []).slice();
    res.plainReasons = plainWhy(res.reasons);

    if (v.ok) {
      var s = Sup ? Sup.support(candidate) : { ok: false, reasons: ['no-support-table'], notes: [] };
      res.support = s;
      if (s.ok) {
        res['case'] = 'playable';
        res.previewCandidate = candidate;
        res.previewMode = 'play';
      } else {
        res['case'] = 'unsupported';
        res.missing = Sup ? Sup.whyUnavailable(s.reasons) : s.reasons;
      }
      res.caseNote = CASES[res['case']];
      return res;
    }

    // Refused. Is it refused because of what it IS, or because of how
    // it was written down?
    var stopped = res.reasons.filter(function (r) {
      return HARD_STOP.some(function (re) { return re.test(r); });
    }).concat(namesForbidden(candidate, 'candidate', grammar, []));
    if (stopped.length) {
      res['case'] = 'uninterpretable';
      res.caseNote = CASES.uninterpretable;
      res.stopped = stopped;
      res.missing = plainWhy(stopped);
      return res;
    }

    var p = project(candidate, { grammar: grammar, fallbackId: opts.fallbackId });
    res.projection = p;
    if (!p.ok) {
      var caps = missingCapabilities(p.remaining);
      res['case'] = caps.length ? 'unsupported' : 'uninterpretable';
      res.missing = caps.length ? caps : plainWhy(p.remaining);
      res.caseNote = CASES[res['case']];
      return res;
    }

    var s2 = Sup ? Sup.support(p.candidate) : { ok: false, reasons: ['no-support-table'], notes: [] };
    res.support = s2;
    if (!s2.ok) {
      res['case'] = 'unsupported';
      res.missing = Sup ? Sup.whyUnavailable(s2.reasons) : s2.reasons;
      res.caseNote = CASES.unsupported;
      return res;
    }
    res['case'] = 'try-idea';
    res.caseNote = CASES['try-idea'];
    res.previewCandidate = p.candidate;
    res.previewMode = 'try';
    return res;
  }

  var API = {
    CASES: CASES,
    RULES: RULES.map(function (r) { return { id: r.id, why: r.why }; }),
    RESEARCH_WAIVED: RESEARCH_WAIVED,
    HARD_STOP: HARD_STOP,
    intent: intent,
    plainWhy: plainWhy,
    missingCapabilities: missingCapabilities,
    project: project,
    researchGrammar: researchGrammar,
    study: study
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.LabResearch = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
