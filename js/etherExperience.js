// etherExperience.js — the Experience Composer. EXPERIMENTAL BRANCH.
//
// SPRINT — Ether Experience Architecture: a sea of mysteries.
//
// The Ether is not a container for Stories, not a creature showcase,
// and not a collection of activities. Stories, creatures and
// creations are things discoverable INSIDE it, and mystery is the
// governing quality: the longer a child explores, the more they
// find — and never enough to believe they have figured the Ether out.
//
// WHAT THIS LAYER IS. The one place that decides WHETHER something
// happens, WHAT KIND, WHEN and WHERE. The existing Ether systems
// become experience providers: js/etherLife.js keeps everything
// about HOW a being behaves (drawing, movement, the notice grammar,
// the trail machinery, departure) and gives up its internal
// scheduler; js/etherDiscovery.js keeps the knowledge of WHICH Story
// or wonder makes a discovery and accepts a conductor's preference.
// Nothing under vihuplanet/runtime/ is edited — this layer reads the
// same public seams every renderer reads, and writes to none of them.
//
// NOT RANDOM SELECTION. Every decision reasons from world state and
// experience history: what has already been experienced (and HOW —
// seen is not followed, followed is not understood), where the child
// has looked, what phase the visit is in, whether the sky needs
// quiet, and whether another of the same thing would be predictable.
// Quiet is a real choice with weight of its own, and an idle child
// is never answered with content for being idle.
//
// FINITE SYSTEMS, MANY EXPERIENCES. A small pattern library over
// three beings, three wonder figures, marks, blooms, the beckon and
// the Story Spirits combines — by manner, by place, by phase, by
// what came before, and by what stays unexplained — into an
// experience space much larger than the content library. Not every
// mystery resolves. That is the point, not a bug.
//
// A TRAVELLER IS STATELESS (Decision 19). Everything here is module
// state and dies with the page. No storage API appears in this file.
// NOTHING IS SHOWN. No phase, no depth, no tier, no history ever
// reaches the screen; the decision log exists for a developer
// console only, printed only under ?etherdebug=1, and is never
// persisted anywhere.
//
// NO GAMIFICATION. Nothing counted for the child, nothing collected,
// nothing owed, nothing earned. The composition vocabulary is
// deliberately free of that language.

(function (global) {
  'use strict';

  // ---------------------------------------------------------------
  // Rarity. Architectural tiers, never a mechanic a child can see.
  // `weight` shapes how often a tier is even considered; `visit` is
  // the chance the pattern exists in a given visit AT ALL — drawn
  // once at mount, so a rare thing cannot settle into "every N
  // minutes": some visits simply never contain it. Math.random on
  // purpose, not the seeded Rng: one visitor's own encounters have
  // no business being reproducible (Decision 10's own reasoning).
  // ---------------------------------------------------------------
  var RARITY = {
    common:      { weight: 1.0,  visit: 1.0 },
    uncommon:    { weight: 0.55, visit: 1.0 },
    rare:        { weight: 0.28, visit: 0.8 },
    very_rare:   { weight: 0.13, visit: 0.5 },
    exceptional: { weight: 0.06, visit: 0.25 }
  };

  // ---------------------------------------------------------------
  // The pattern library. DATA, never a branch: a new kind of
  // experience is a new row (and, if it needs one, a new provider
  // seam), not a rewrite of the composition. Each row says what
  // family it belongs to (novelty compares families as well as
  // patterns), which being it uses (null = chosen at perform time),
  // how rare it is, which phases it suits, its outcome verb(s), and
  // what a child would most likely do with it — the last two feed
  // the decision log, never the screen.
  // ---------------------------------------------------------------
  var PATTERNS = [
    { id: 'guided-way', family: 'creature', creature: 'whale',
      rarity: 'common', outcome: 'lead',
      phases: ['curiosity', 'exploration', 'deep', 'reignition'],
      expects: 'notice the whale, follow its breath',
      manner: function () { return { respond: 'default' }; } },

    { id: 'carried-way', family: 'creature', creature: 'starbird',
      rarity: 'uncommon', outcome: 'lead',
      phases: ['exploration', 'deep', 'reignition'],
      expects: 'catch the swift bird, retrace its flight',
      manner: function () { return { respond: 'default' }; } },

    { id: 'reveal', family: 'creature', creature: 'jellyfish',
      rarity: 'uncommon', outcome: 'reveal',
      phases: ['exploration', 'deep'],
      expects: 'touch the slow light, see where things rest',
      manner: function () { return { respond: 'default' }; } },

    { id: 'silent-crossing', family: 'creature', creature: null,
      rarity: 'common', outcome: 'react',
      phases: ['curiosity', 'exploration', 'deep', 'reignition'],
      expects: 'notice it — and it only acknowledges, and keeps its way',
      manner: function () { return { respond: 'acknowledge' }; } },

    { id: 'shy-passage', family: 'creature', creature: null,
      rarity: 'uncommon', outcome: 'vanish',
      phases: ['exploration', 'deep'],
      expects: 'approach — and it startles and leaves',
      manner: function () { return { respond: 'shy' }; } },

    { id: 'distant-passage', family: 'creature', creature: null,
      rarity: 'uncommon', outcome: 'unresolved',
      phases: ['curiosity', 'exploration', 'deep', 'reignition'],
      expects: 'a small far shape, gone before it can be reached',
      manner: function () {
        return {
          respond: 'none',
          scale: 0.3 + Math.random() * 0.22,
          speed: 0.75,
          yFrac: Math.random() < 0.5 ? 0.1 + Math.random() * 0.14
                                     : 0.76 + Math.random() * 0.14
        };
      } },

    { id: 'deep-crossing', family: 'creature', creature: 'whale',
      rarity: 'exceptional', outcome: 'unresolved',
      phases: ['deep'], oncePerVisit: true, notBefore: 480,
      expects: 'a vast slow passage, witnessed, never explained',
      manner: function () {
        return { respond: 'none', scale: 1.35, speed: 0.4,
                 yFrac: 0.42 + Math.random() * 0.16 };
      } },

    { id: 'convergence', family: 'creature', creature: null,
      rarity: 'rare', outcome: 'echo', needsAnchor: 240,
      phases: ['deep', 'reignition'],
      expects: 'a being whose path happens to cross an old place',
      manner: function () { return { respond: 'acknowledge' }; } },

    // The sky's own patterns — no being involved.
    { id: 'odd-stars', family: 'sky', rarity: 'uncommon',
      outcome: 'unresolved', notBefore: 55,
      phases: ['curiosity', 'exploration', 'deep', 'quietish'],
      expects: 'a few faint stars that were not there before' },

    { id: 'sky-bloom', family: 'sky', rarity: 'rare',
      outcome: 'transform', notBefore: 120,
      phases: ['exploration', 'deep', 'reignition'],
      expects: 'a small figure of stars, blooming far off, unprompted' },

    { id: 'echo-bloom', family: 'sky', rarity: 'rare',
      outcome: 'echo', needsAnchor: 90,
      phases: ['exploration', 'deep', 'reignition'],
      expects: 'a wonder where something else once happened' }
  ];

  // The internal discovery ladder. Never shown, never named on
  // screen; the composer uses it to tell "has seen a whale" from
  // "has already had this exact whale behaviour and outcome".
  var DEPTH = ['unknown', 'glimpsed', 'noticed', 'approached',
               'interacted', 'discovered', 'understood'];

  // Conceptual phases. Transitions are driven by what the child
  // actually does — never a timetable.
  var PHASES = ['arrival', 'orientation', 'curiosity', 'exploration',
                'discovery', 'deep', 'quiet', 'reignition'];

  var SECTORS = 8;   // the field's width, divided for the ledger

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function mount(universe, life, opts) {
    opts = opts || {};
    if (!universe || !life) return null;

    var VihuPlanet = global.VihuPlanet;
    var Util = VihuPlanet && VihuPlanet.Util;

    // Reduced motion: the providers mounted inert, so the composer
    // is inert too — a whole API that never does anything, so no
    // caller branches.
    if (life.quiet) {
      return {
        quiet: true,
        discovery: null,
        phase: function () { return 'arrival'; },
        state: function () { return null; },
        history: function () { return []; },
        anchors: function () { return []; },
        ledger: function () { return {}; },
        patterns: function () { return PATTERNS.map(function (p) { return p.id; }); },
        diagnostics: function () { return { quiet: true, decisions: [] }; },
        decideNow: function () { return null; },
        setTimeScale: function () {},
        destroy: function () {}
      };
    }
    if (!life.conducted || !global.EtherDiscovery) return null;

    // ---------- the visit's own temperament ----------
    //
    // Drawn once per visit: which rare patterns exist at all this
    // time, and a small per-pattern lean. Two visits are different
    // universes of likelihood before anything has happened.
    var visitPatterns = {};
    PATTERNS.forEach(function (p) {
      var tier = RARITY[p.rarity] || RARITY.common;
      visitPatterns[p.id] = {
        present: Math.random() < tier.visit,
        lean: rand(0.75, 1.3),
        performed: 0
      };
    });
    var tempo = rand(0.85, 1.2);   // the visit's overall pace lean

    // ---------- world state (session-only, dies with the page) ----
    var time = 0;               // conducted seconds (universe-paced)
    var timeScale = opts.timeScale || 1;
    var destroyed = false;
    var debug = false;
    try { debug = /[?&]etherdebug=1/.test(global.location.search); } catch (e) {}

    var sectors = {};           // sector -> dwell seconds
    var sectorNow = 0;
    var hasTurned = false;
    var prevStill = 0;

    var storyLedger = {};       // entity id -> depth index
    var creatureLedger = {};    // family -> { seen, noticed, outcomes: {} }

    var history = [];           // experience ring, bounded
    var anchors = [];           // notable places, bounded
    var chain = 0;              // consecutive discoveries this visit
    var found = 0;              // discoveries found this visit
    var restUntil = 0;          // quiet phase end (conducted time)
    var lastExperienceAt = 0;   // when something last happened
    var lastMarkAt = -999;
    var gapTarget = 0;          // seconds of air before the next offer
    var liveExperience = null;  // the pattern currently on the sky
    var decisions = [];         // the dev log ring
    var firstAt = rand(life.times.firstArrival[0], life.times.firstArrival[1]);
    var arrivalDone = false;

    var camScratch = { x: 0, y: 0 };

    function log(entry) {
      entry.t = Math.round(time * 10) / 10;
      decisions.push(entry);
      if (decisions.length > 140) decisions.shift();
      if (debug) { try { console.info('[ether-composer]', entry); } catch (e) {} }
    }

    function remember(exp) {
      exp.t = time;
      history.push(exp);
      if (history.length > 80) history.shift();
      lastExperienceAt = time;
    }

    function addAnchor(x, y, why) {
      anchors.push({ x: x, y: y, why: why, t: time });
      if (anchors.length > 8) anchors.shift();
    }

    // Where is the child looking, on the story plane, in field
    // coordinates — and which sector of the field is that.
    function lookPoint() {
      var ether = universe.ether;
      var cam = universe.camera.offsetFor(ether.depth.stories, camScratch);
      return {
        x: ether.viewWidth * 0.5 - cam.x,
        y: ether.viewHeight * 0.5 - cam.y
      };
    }
    function sectorOf(x) {
      var w = universe.ether.width || 1;
      var s = Math.floor(((x % w) + w) % w / w * SECTORS);
      return Math.max(0, Math.min(SECTORS - 1, s));
    }

    function stillNow() {
      try {
        return (universe.traveller && universe.traveller.stillSeconds)
          ? universe.traveller.stillSeconds() : 0;
      } catch (e) { return 0; }
    }
    function portalOpen() {
      try { return universe.focus && universe.focus.isOpen(); } catch (e) { return false; }
    }

    // ---------- the discovery ledger ----------
    function bumpStory(id, depthName) {
      var want = DEPTH.indexOf(depthName);
      if (want < 0) return;
      var have = storyLedger[id] || 0;
      if (want > have) storyLedger[id] = want;
    }
    function creatureRecord(family) {
      if (!creatureLedger[family]) {
        creatureLedger[family] = { seen: 0, noticed: 0, outcomes: {} };
      }
      return creatureLedger[family];
    }

    function tickLedger(dt) {
      var entities = [];
      try { entities = universe.stories.all() || []; } catch (e) {}
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (!e || typeof e.prox !== 'number') continue;
        if (e.prox > 0.03) bumpStory(e.id, 'glimpsed');
        if (e.prox > 0.32) bumpStory(e.id, 'noticed');
        if (e.prox > 0.58) bumpStory(e.id, 'approached');
      }
    }

    // ---------- the phase, derived ----------
    function phase() {
      if (!arrivalDone) return 'arrival';
      if (time < restUntil) return 'quiet';
      var visited = Object.keys(sectors).length;
      if (!hasTurned && found === 0) return 'orientation';
      if (found === 0 && visited < 3) return 'curiosity';
      if (found >= 1 && time - lastExperienceAt > 75 && stillNow() < 20) {
        // The child is moving again after air — the sky may answer.
        return 'reignition';
      }
      if (found >= 2 || (found >= 1 && visited >= 4)) return 'deep';
      if (found >= 1) return 'discovery';
      return 'exploration';
    }

    // Which phases a pattern's row matches. 'quietish' marks the few
    // things faint enough to exist at the edge of a resting sky.
    function phaseFits(p, ph) {
      if (ph === 'arrival') return false;
      if (ph === 'orientation') return false;      // the beckon owns it
      if (ph === 'quiet') return p.phases.indexOf('quietish') !== -1;
      if (ph === 'discovery') ph = 'exploration';
      return p.phases.indexOf(ph) !== -1 ||
             p.phases.indexOf('quietish') !== -1;
    }

    // ---------- novelty ----------
    //
    // How fresh would this experience be, against what this visit has
    // already held? 1 is completely fresh; near 0 is "they have had
    // exactly this". Pattern repetition is punished hardest, then the
    // same being again, the same outcome twice running, the same
    // sector twice running — different experience PATTERNS are worth
    // more than different assets.
    function novelty(candidate) {
      var n = 1;
      var last = history[history.length - 1];
      var recent = history.slice(-6);
      var i;

      if (last && last.pattern === candidate.id) n *= 0.12;
      var sameRecent = 0;
      for (i = 0; i < recent.length; i++) {
        if (recent[i].pattern === candidate.id) sameRecent++;
      }
      n *= Math.pow(0.5, sameRecent);

      if (candidate.familyId) {
        var lastCreature = null;
        for (i = history.length - 1; i >= 0; i--) {
          if (history[i].familyId) { lastCreature = history[i]; break; }
        }
        if (lastCreature && lastCreature.familyId === candidate.familyId) n *= 0.5;
        // The same being giving the same ANSWER again is the thing a
        // child could learn to predict: a whale must mean something
        // without ever meaning the same thing.
        var rec = creatureLedger[candidate.familyId];
        if (rec && rec.outcomes[candidate.outcome]) {
          n *= Math.pow(0.55, rec.outcomes[candidate.outcome]);
        }
      }
      if (last && last.outcome === candidate.outcome) n *= 0.7;
      if (last && typeof last.sector === 'number' &&
          last.sector === sectorNow) n *= 0.85;
      if (visitPatterns[candidate.id].performed === 0) n *= 1.25;
      return n;
    }

    // ---------- candidates ----------
    function creatureFamilies() { return ['whale', 'jellyfish', 'starbird']; }

    function eligible(p, ph) {
      var vp = visitPatterns[p.id];
      if (!vp.present) return 'not-in-this-visit';
      if (p.oncePerVisit && vp.performed > 0) return 'already-happened';
      if (p.notBefore && time < p.notBefore * (timeScale > 1 ? 1 / timeScale : 1) &&
          time < p.notBefore) return 'too-early';
      if (p.needsAnchor) {
        // Before the phase: a pattern that needs an old place and has
        // none is impossible, not merely ill-timed, and the log
        // should say the harder truth.
        var a = usableAnchor(p.needsAnchor);
        if (!a) return 'no-old-place-yet';
      }
      if (!phaseFits(p, ph)) return 'wrong-phase';
      if (p.family === 'creature' && life.active()) return 'sky-occupied';
      if (p.family === 'creature' && life.trail()) return 'trail-live';
      if (p.id === 'odd-stars' && time - lastMarkAt < 60) return 'mark-too-recent';
      if (p.id === 'reveal') {
        var count = 0;
        try { count = universe.stories.count(); } catch (e) {}
        if (count < 3) return 'nothing-to-reveal';
      }
      return null;
    }

    function usableAnchor(minAge) {
      var out = [];
      for (var i = 0; i < anchors.length; i++) {
        if (time - anchors[i].t >= minAge) out.push(anchors[i]);
      }
      return out.length ? out[Math.floor(Math.random() * out.length)] : null;
    }

    // ---------- the decision ----------
    //
    // Called when the air between experiences has passed (and from a
    // suite through decideNow()). Reasons over the whole library,
    // rejects with names, weighs what is left by rarity × the
    // visit's lean × novelty, and very often chooses quiet: a sky
    // that answers every silence is a sky nobody wonders about.
    function decide() {
      var ph = phase();
      var entry = { phase: ph, candidates: [], rejected: [], chosen: null };

      if (portalOpen() || !universe.isRunning || !universe.isRunning()) {
        entry.chosen = 'quiet'; entry.why = 'a story owns the moment';
        log(entry);
        return null;
      }
      if (ph === 'arrival' || ph === 'orientation' || ph === 'quiet') {
        entry.chosen = 'quiet';
        entry.why = ph === 'quiet' ? 'the sky is resting after a find'
                                   : 'the ' + ph + ' is still speaking';
        log(entry);
        return null;
      }

      var pool = [];
      PATTERNS.forEach(function (p) {
        var no = eligible(p, ph);
        if (no) { entry.rejected.push({ id: p.id, because: no }); return; }
        var families = p.family === 'creature'
          ? (p.creature ? [p.creature] : creatureFamilies())
          : [null];
        families.forEach(function (fam) {
          var tier = RARITY[p.rarity] || RARITY.common;
          var cand = {
            id: p.id, pattern: p, familyId: fam, outcome: p.outcome
          };
          var fresh = novelty(cand);
          cand.appeal = tier.weight * visitPatterns[p.id].lean *
                        fresh * rand(0.85, 1.15);
          cand.fresh = fresh;
          pool.push(cand);
          entry.candidates.push({
            id: p.id + (fam && !p.creature ? ':' + fam : ''),
            appeal: Math.round(cand.appeal * 100) / 100,
            fresh: Math.round(fresh * 100) / 100
          });
        });
      });

      var best = null;
      for (var i = 0; i < pool.length; i++) {
        if (!best || pool[i].appeal > best.appeal) best = pool[i];
      }

      // Quiet holds its own weight. Below the line, nothing happens —
      // and the line breathes with the visit's tempo, so the exact
      // threshold is never learnable either.
      var quietLine = 0.16 * tempo * rand(0.8, 1.25);
      if (!best || best.appeal < quietLine) {
        entry.chosen = 'quiet';
        entry.why = best
          ? 'nothing fresh enough (best ' + best.id + ' at ' +
            best.appeal.toFixed(2) + ' under ' + quietLine.toFixed(2) + ')'
          : 'nothing eligible';
        log(entry);
        return null;
      }

      entry.chosen = best.id + (best.familyId && !best.pattern.creature
        ? ':' + best.familyId : '');
      entry.why = 'freshest fit for ' + ph +
                  ' (appeal ' + best.appeal.toFixed(2) + ')';
      entry.expects = best.pattern.expects;
      entry.outcome = best.outcome;
      log(entry);
      perform(best);
      return best.id;
    }

    // ---------- performing ----------
    function perform(cand) {
      var p = cand.pattern;
      var vp = visitPatterns[p.id];
      var look = lookPoint();
      var exp = {
        pattern: p.id, familyId: cand.familyId || null,
        outcome: p.outcome, sector: sectorNow, interaction: 'none',
        depth: 'offered'
      };

      if (p.family === 'creature') {
        var manner = p.manner ? p.manner() : {};
        if (p.needsAnchor) {
          var a = usableAnchor(p.needsAnchor);
          if (a) { manner.via = { x: a.x, y: a.y }; exp.viaAnchor = a.why; }
        }
        var id = life.summon(cand.familyId || p.creature, manner);
        if (!id) return;
        var rec = creatureRecord(id);
        rec.seen++;
        vp.performed++;
        liveExperience = exp;
        remember(exp);
        return;
      }

      // The sky's own patterns.
      if (p.id === 'odd-stars') {
        // A little way off the centre of the view — present, faint,
        // and easy to doubt.
        var ang = Math.random() * Math.PI * 2;
        var d = Math.min(universe.ether.viewWidth, universe.ether.viewHeight) *
                rand(0.18, 0.34);
        var mx = look.x + Math.cos(ang) * d;
        var my = look.y + Math.sin(ang) * d * 0.7;
        life.markAt(mx, my, { life: rand(22, 45) });
        lastMarkAt = time;
        addAnchor(mx, my, 'odd-stars');
        vp.performed++;
        remember(exp);
        return;
      }
      if (p.id === 'sky-bloom' || p.id === 'echo-bloom') {
        var at = null;
        if (p.id === 'echo-bloom') {
          var anchor = usableAnchor(p.needsAnchor || 90);
          if (!anchor) return;
          at = { x: anchor.x + rand(-40, 40), y: anchor.y + rand(-30, 30) };
          exp.viaAnchor = anchor.why;
        } else {
          var ang2 = Math.random() * Math.PI * 2;
          var reach = Math.max(universe.ether.viewWidth,
                               universe.ether.viewHeight) * rand(0.45, 0.7);
          at = { x: look.x + Math.cos(ang2) * reach,
                 y: look.y + Math.sin(ang2) * reach * 0.6 };
        }
        life.bloomAt(at.x, at.y);
        vp.performed++;
        remember(exp);
        return;
      }
    }

    // ---------- the beckon, conducted ----------
    //
    // The observable policy is Decision 58's, unchanged: a Traveller
    // who has been still ~16 s, has never turned the universe
    // themselves, gets one soft edge light; at most two; and the
    // moment they turn, never again. What moved is WHO says when —
    // the composer offers it as one mechanism among many, and only
    // in the orientation the policy was written for.
    function tickBeckon() {
      var b = life.beckon();
      if (!b || b.stopped || b.active) return;
      var given = b.given || 0;
      var t = life.times;
      if (given >= t.beckons) return;
      if (life.trail() || portalOpen()) return;
      if (stillNow() < t.beckonAfter + given * t.beckonSpacing) return;
      var got = life.beckonNow();
      if (got) {
        remember({ pattern: 'beckon', familyId: null, outcome: 'lead',
                   sector: sectorNow, interaction: 'none', depth: 'offered' });
        log({ phase: phase(), chosen: 'beckon',
              why: 'a long unanswered stillness, before the first turn',
              expects: 'turn toward the light on the edge' });
      }
    }

    // ---------- provider events ----------
    function onLife(evt, fn) { life.on(evt, fn); }

    onLife('creature:noticed', function (p) {
      if (liveExperience) {
        liveExperience.interaction = 'noticed';
        liveExperience.depth = 'noticed';
      }
      var rec = creatureRecord(p.id);
      rec.noticed++;
      // Where it was noticed is a place the sky may come back to.
      var a = life.active();
      if (a) {
        var ether = universe.ether;
        var cam = universe.camera.offsetFor(ether.depth.stories, camScratch);
        addAnchor(a.screen.x - cam.x, a.screen.y - cam.y, 'met-' + p.id);
      }
    });
    onLife('creature:responded', function (p) {
      if (liveExperience) {
        liveExperience.interaction = 'answered';
        liveExperience.depth = 'interacted';
        liveExperience.answer = p.response;
      }
      var rec = creatureRecord(p.id);
      var verb = p.response === 'acknowledge' ? 'react'
               : p.response === 'shy' ? 'vanish'
               : p.response === 'pulse' ? 'reveal' : 'lead';
      rec.outcomes[verb] = (rec.outcomes[verb] || 0) + 1;
    });
    onLife('creature:gone', function () {
      if (liveExperience) { liveExperience = null; }
      // Air after a crossing, whatever became of it: the next offer
      // waits its own drawn-out while.
      drawGap();
    });
    onLife('trail:begun', function () {
      chain = Math.max(chain, 1);
    });
    onLife('trail:found', function (p) {
      found++;
      chain++;
      if (p && p.target && p.target.kind === 'story' && p.target.id) {
        bumpStory(p.target.id, 'discovered');
      }
      // Where a trail ended is a place the sky may come back to.
      try {
        var tr = life.trail();
        if (tr && tr.target && typeof tr.target.x === 'number') {
          addAnchor(tr.target.x, tr.target.y, 'found');
        }
      } catch (e) {}
      // The sky rests after a find — the quiet phase, drawn fresh
      // each time so its length is never learnable.
      restUntil = time + rand(40, 90);
      if (history.length) {
        history[history.length - 1].depth = 'discovered';
      }
    });
    onLife('trail:faded', function () {
      // Followed by nobody. Nothing owed, and the trail's end is
      // still a place — the sky remembers where it pointed.
      chain = 0;
    });
    onLife('destroyed', function () { destroyed = true; });

    universe.on('focus:opened', function (p) {
      if (p && p.entity && p.entity.id) {
        bumpStory(p.entity.id, 'discovered');
        found = Math.max(found, 1);
      }
    });
    universe.on('focus:closed', function (p) {
      if (p && p.entity && p.entity.id) {
        // Stepping in and coming back out is as close to
        // "understood" as the Ether can honestly read.
        bumpStory(p.entity.id, 'understood');
      }
    });

    // ---------- the conductor handed to discovery ----------
    //
    // What a trail should lead to. The pickers stay
    // js/etherDiscovery.js's; this only leans them: toward a Story a
    // child has not met when several remain, toward a wonder when the
    // last find was a Story (two Story deliveries in a row makes the
    // sky a catalogue), and — rarely, deliberately — toward an old
    // place, so a discovery can answer something that happened
    // before it.
    function preferTarget() {
      var lastFound = null;
      for (var i = history.length - 1; i >= 0; i--) {
        if (history[i].depth === 'discovered') { lastFound = history[i]; break; }
      }
      var anchor = usableAnchor(150);
      if (anchor && Math.random() < 0.18) {
        var w = global.EtherDiscovery.pickWonder(universe, anchor);
        if (w) return w;
      }
      if (lastFound && lastFound.targetKind === 'story' && Math.random() < 0.5) {
        return { prefer: ['wonder', 'story'] };
      }
      return undefined;   // the pickers' own order stands
    }
    function restSeconds() {
      return Math.max(0, restUntil - time) > 0 ? (restUntil - time) + 40 : 40;
    }

    var discovery = global.EtherDiscovery.attach(universe, life, {
      conductor: { preferTarget: preferTarget, restSeconds: restSeconds }
    });
    if (discovery && discovery.on) {
      discovery.on('activity:found', function (p) {
        if (history.length && p && p.target) {
          history[history.length - 1].targetKind = p.target.kind;
        }
      });
    }

    // ---------- the clock ----------
    function drawGap() {
      // The air between experiences. Phase leans it, the visit's
      // tempo leans it, and it is re-drawn every time — there is no
      // interval to learn.
      var ph = phase();
      var lo = 45, hi = 210;
      if (ph === 'curiosity') { lo = 30; hi = 130; }
      if (ph === 'deep') { lo = 55; hi = 260; }
      if (ph === 'reignition') { lo = 20; hi = 80; }
      gapTarget = time + rand(lo, hi) * tempo;
    }
    drawGap();

    var lastNow = null;
    function frame(now) {
      if (destroyed) return;
      global.requestAnimationFrame(frame);
      if (lastNow === null) lastNow = now;
      var dt = Math.min(0.05, (now - lastNow) / 1000) * timeScale;
      lastNow = now;
      if (!universe.isRunning || !universe.isRunning()) return;
      if (portalOpen()) dt *= 0.28;   // the sky slows with the universe

      time += dt;

      // Environment: which sector is being looked at, and has the
      // child ever turned the universe themselves.
      var look = lookPoint();
      sectorNow = sectorOf(look.x);
      var still = stillNow();
      // Exploration is what the CHILD does. The arrival turn and the
      // glance move the camera on their own, and a sky that credited
      // them would read its own theatre as a child's travelling —
      // dwell counts only while the child's own hand moved recently.
      if (still < 3) sectors[sectorNow] = (sectors[sectorNow] || 0) + dt;
      if (still < prevStill - 0.4) hasTurned = true;
      prevStill = still;

      tickLedger(dt);
      tickBeckon();

      // The arrival script: the first crossing is the whale, guide
      // armed, inside the first-20-seconds window — the one beat the
      // baseline pinned and the composer keeps.
      if (!arrivalDone && time >= firstAt) {
        arrivalDone = true;
        var id = life.summon('whale', { respond: 'default' });
        if (id) {
          creatureRecord('whale').seen++;
          visitPatterns['guided-way'].performed++;
          liveExperience = { pattern: 'first-crossing', familyId: 'whale',
                             outcome: 'lead', sector: sectorNow,
                             interaction: 'none', depth: 'offered' };
          remember(liveExperience);
          log({ phase: 'arrival', chosen: 'first-crossing',
                why: 'a fresh Traveller\'s first hook, inside the window',
                expects: 'look at it — and learn the sky moves' });
          drawGap();
        }
        return;
      }

      if (arrivalDone && time >= gapTarget && !liveExperience) {
        decide();
        drawGap();
      }
    }
    global.requestAnimationFrame(frame);

    return {
      quiet: false,
      discovery: discovery,
      phase: phase,
      state: function () {
        return {
          time: Math.round(time * 10) / 10,
          phase: phase(),
          sector: sectorNow,
          sectorsVisited: Object.keys(sectors).length,
          hasTurned: hasTurned,
          found: found,
          chain: chain,
          resting: time < restUntil,
          anchors: anchors.length,
          live: liveExperience ? liveExperience.pattern : null
        };
      },
      history: function () {
        return history.map(function (h) {
          return {
            pattern: h.pattern, family: h.familyId, outcome: h.outcome,
            sector: h.sector, interaction: h.interaction, depth: h.depth,
            t: Math.round(h.t * 10) / 10
          };
        });
      },
      anchors: function () { return anchors.slice(); },
      ledger: function () {
        var stories = {};
        Object.keys(storyLedger).forEach(function (k) {
          stories[k] = DEPTH[storyLedger[k]];
        });
        return { stories: stories, creatures: creatureLedger };
      },
      patterns: function () {
        return PATTERNS.map(function (p) {
          return { id: p.id, rarity: p.rarity, outcome: p.outcome,
                   inThisVisit: visitPatterns[p.id].present,
                   performed: visitPatterns[p.id].performed };
        });
      },
      diagnostics: function () {
        return {
          quiet: false,
          state: this.state ? this.state() : null,
          decisions: decisions.slice(),
          nextOfferIn: Math.max(0, Math.round((gapTarget - time) * 10) / 10)
        };
      },
      decideNow: decide,
      setTimeScale: function (k) {
        if (typeof k === 'number' && k > 0 && k <= 600) timeScale = k;
      },
      destroy: function () { destroyed = true; }
    };
  }

  global.EtherExperience = {
    PATTERNS: PATTERNS,
    RARITY: RARITY,
    DEPTH: DEPTH,
    PHASES: PHASES,
    mount: mount
  };
})(typeof window !== 'undefined' ? window : this);
