// etherDiscovery.js — discovery composition for the Ether.
//
// SPRINT — Ether Traveller Experience: First 20 Seconds.
//
// The Ether must never feel directionless, and it must never dump
// everything it holds onto the screen at once. Between those two
// failures sits this layer: a lightweight composer that decides what a
// Traveller is likely to encounter next, from what is actually here.
//
//     available Ether content  +  environment state
//   + creature encounters      +  recent discovery state
//   ────────────────────────────────────────────────
//     one staged discovery at a time
//
// It decides WHAT; js/etherLife.js shows it. When the whale is noticed
// and asks where its breath should lead, this is what answers — a
// Story Spirit drifting somewhere the child has not looked, or, when
// the Ether holds no eligible Story right now, a small wonder of the
// sky's own. Discovery therefore never depends on Stories being
// present, and a universe with three hundred of them still offers ONE
// thing at a time. Curiosity is staged, not dumped.
//
// THE ACTIVITY FRAMEWORK. An Ether activity is a row in a registry: a
// creature, a kind of guidance, and what finding it means. One is
// built end-to-end in this sprint — Follow the Whale — and the shape
// is what future activities (a story hunt, a star trail, a wandering
// character) are added into, without rewriting the Ether. Every
// activity leads back toward creations and Stories: explore →
// discover → "someone made this" → "I could make something too."
// None of them earns anything countable. There is nothing here to
// win, collect, rank or repeat for — and nothing is stored, because a
// Traveller is stateless (Decision 19): what was discovered this
// visit dies with the page.
//
// WHAT IT READS, AND WHAT IT MAY NEVER DO. It reads the Story
// entities the universe already holds — the same read-only view every
// renderer has — and writes nothing to any of them. It never opens
// anything by itself, never moves the camera, never interrupts: a
// discovery is an invitation lying in the sky, and the child does all
// of the finding.

(function (global) {
  'use strict';

  // The activities the Ether currently knows how to offer. A row, not
  // a branch: adding "Star Trail" or "Find the Missing Character"
  // later is a new entry plus whatever guidance it needs, never an
  // edit to the composition below.
  var ACTIVITIES = [
    {
      id: 'follow-the-whale',
      creature: 'whale',
      guidance: 'trail',
      // What the trail may point at, in order of preference.
      leadsTo: ['story', 'wonder']
    },
    {
      // The Star Trail. Not a reskin of the whale: the whale stays
      // where it is and points, the starbird flies to the discovery
      // itself and the trail is the flight it actually flew. Same
      // composition, different guidance — which is the whole point of
      // guidance being a field.
      id: 'star-trail',
      creature: 'starbird',
      guidance: 'feathers',
      leadsTo: ['story', 'wonder']
    }
  ];

  // How long after a found discovery before another may be offered.
  // Staging: one wonder at a time, with air between them.
  var REST_AFTER_FOUND_S = 40;

  function attach(universe, life, opts) {
    opts = opts || {};
    if (!universe || !life || life.quiet || !life.setComposer) return null;

    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function emit(evt, payload) {
      var l = listeners[evt];
      if (!l) return;
      for (var i = 0; i < l.length; i++) {
        try { l[i](payload); } catch (e) {}
      }
    }

    // Session memory only — module state, never storage. A Traveller
    // arrives new every time (Decision 19), and so does their sky.
    var recent = [];          // entity ids already led to, this visit
    var activityLive = null;  // the activity currently underway
    var lastFoundAt = 0;
    var now = function () { return Date.now() / 1000; };

    // ---------- choosing what the Ether offers next ----------
    //
    // Preference order, and every rule is about giving the child a
    // reason to TURN:
    //   · a Story they have not been led to this visit,
    //   · that is currently far from where they are looking (low prox
    //     — something already in front of them is not a discovery),
    //   · fresher first when several qualify.
    // No eligible Story → a wonder: a point far enough from the centre
    // that following the trail genuinely turns the universe.
    function chooseStory() {
      var entities = [];
      try { entities = universe.stories.all() || []; } catch (e) { return null; }
      var best = null, bestFit = -1;
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        if (!e || e.focusT > 0) continue;
        if (recent.indexOf(e.id) !== -1) continue;
        var prox = e.prox || 0;
        if (prox > 0.45) continue;         // already found, effectively
        var fresh = 0;
        try {
          var t = e.publishedAt ? new Date(e.publishedAt).getTime() : 0;
          fresh = t > 0 ? Math.min(1, Math.max(0, 1 - (Date.now() - t) / (1000 * 3600 * 24 * 90))) : 0;
        } catch (err) {}
        // How well this Story fits being the next discovery. Internal
        // arithmetic for one choice, never a quantity anything shows.
        var fit = (1 - prox) + fresh * 0.5 + Math.random() * 0.2;
        if (fit > bestFit) { bestFit = fit; best = e; }
      }
      if (!best) return null;
      return {
        kind: 'story',
        id: best.id,
        entity: best,
        x: best.position.x,
        y: best.position.y
      };
    }

    function chooseWonder() {
      var ether = universe.ether;
      var reach = Math.max(ether.viewWidth, ether.viewHeight) * 0.85;
      var angle = Math.random() * Math.PI * 2;
      // In field coordinates on the story plane, offset from wherever
      // the child is looking right now — far enough to require a real
      // turn, never so far that the trail cannot say which way.
      var cam = universe.camera.offsetFor(ether.depth.stories);
      var cx = ether.viewWidth * 0.5 - cam.x;
      var cy = ether.viewHeight * 0.5 - cam.y;
      return {
        kind: 'wonder',
        id: null,
        x: cx + Math.cos(angle) * reach,
        y: cy + Math.sin(angle) * reach * 0.6
      };
    }

    // The composer js/etherLife.js calls when a guiding creature has
    // been noticed and needs somewhere to lead.
    function compose(info) {
      // One discovery at a time, with rest after the last one found —
      // the staging rule that keeps wonder from becoming noise.
      if (activityLive) return null;
      if (now() - lastFoundAt < REST_AFTER_FOUND_S && lastFoundAt > 0) return null;

      var activity = null;
      for (var i = 0; i < ACTIVITIES.length; i++) {
        if (ACTIVITIES[i].creature === (info && info.creature)) {
          activity = ACTIVITIES[i];
          break;
        }
      }
      if (!activity) return null;

      var target = null;
      for (var k = 0; k < activity.leadsTo.length && !target; k++) {
        if (activity.leadsTo[k] === 'story') target = chooseStory();
        else if (activity.leadsTo[k] === 'wonder') target = chooseWonder();
      }
      if (!target) return null;

      activityLive = { id: activity.id, target: target, begun: now() };
      if (target.kind === 'story' && target.id) recent.push(target.id);
      emit('activity:begun', { id: activity.id, target: { kind: target.kind, id: target.id } });
      return target;
    }

    life.setComposer(compose);

    // The scout: "is there something far away worth looking toward?"
    // It feeds the beckon — the soft edge-light the sky offers a
    // Traveller who has been still — so that light points at a REAL
    // Spirit nobody has looked at whenever one exists, and only at
    // plain sky when the universe is genuinely empty. A pointer to the
    // world, never an effect. It chooses nothing and begins nothing:
    // the answer is a place, not a discovery.
    if (life.setScout) {
      life.setScout(function () {
        var entities = [];
        try { entities = universe.stories.all() || []; } catch (e) { return null; }
        var far = null, farthest = 1;
        for (var i = 0; i < entities.length; i++) {
          var e = entities[i];
          if (!e || e.focusT > 0) continue;
          var prox = e.prox || 0;
          if (prox < farthest && prox < 0.15) { farthest = prox; far = e; }
        }
        return far ? { x: far.position.x, y: far.position.y } : null;
      });
    }

    life.on('trail:found', function () {
      if (!activityLive) return;
      lastFoundAt = now();
      emit('activity:found', { id: activityLive.id, target: {
        kind: activityLive.target.kind, id: activityLive.target.id
      } });
      activityLive = null;
    });
    life.on('trail:faded', function () {
      // Nothing was found and nothing is owed: the trail withdrew, the
      // sky rests, and something else will pass in its own time.
      activityLive = null;
    });

    return {
      activities: function () { return ACTIVITIES.slice(); },
      current: function () {
        return activityLive
          ? { id: activityLive.id, target: { kind: activityLive.target.kind, id: activityLive.target.id } }
          : null;
      },
      recent: function () { return recent.slice(); },
      on: on,
      compose: compose   // exposed so a future activity, or a suite,
                         // can ask exactly what the Ether would offer
    };
  }

  global.EtherDiscovery = {
    ACTIVITIES: ACTIVITIES,
    attach: attach
  };
})(typeof window !== 'undefined' ? window : this);
