// storyBirth.js — a published story visibly joins VihuPlanet.
//
//   light appears → the story becomes luminous → it floats upward
//   → it joins the Ether → it begins drifting
//
// Publishing must never be an insert. A story appearing in the field
// between two frames is a database write with a picture attached; the
// child has to SEE their story travel out and become part of the
// universe, or nothing about "I shared my story with VihuPlanet" is
// true to them.
//
// The Birth system owns a story's position for exactly as long as its
// arrival lasts. Physics does not simulate a BIRTHING story (see
// isSimulated in physics.js), so there is no handover problem and no
// frame where two systems are writing the same position. At the end of
// the rise the state flips to DRIFTING and the universe's ordinary
// laws take the story from there, mid-flight, carrying the velocity it
// was born with.
//
// Note on what this system is NOT: it does not publish anything. It
// does not know what VihuStudio is, what a project is, or what a
// Publish Studio does. Something else finishes a publish and then
// tells the runtime a story exists — see universe.publish(). That is
// the entire integration surface, and it is one function call.
//
// Events:
//   story:birth  { entity }  the light has appeared
//   story:born   { entity }  it has joined the Ether and is drifting

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Birth = VihuPlanet.ns('Birth');
  var STATES = VihuPlanet.Stories.STATES;

  Birth.create = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var manager = opts.manager;
    var signal = opts.signal;
    if (!ether || !manager) return null;

    var reduced = Env.reducedMotion();
    // Long by interface standards, and it should be. This is the
    // moment the child gave their story to the universe; hurrying it
    // is the one thing that would make it feel like a file upload.
    var DURATION = reduced ? 0.5 : 3.2;

    var arrivals = [];   // entities currently being born

    // Where a story comes FROM. By default the bottom centre of the
    // field, below the edge — the story rises out of the child's own
    // side of the screen. A caller that knows better (the control the
    // child actually pressed) passes `from` in field coordinates, and
    // the story leaves from under their finger.
    function originFor(options) {
      if (options && options.from &&
          typeof options.from.x === 'number' && typeof options.from.y === 'number') {
        return { x: options.from.x, y: options.from.y };
      }
      return { x: ether.viewWidth * 0.5, y: ether.viewHeight + 90 };
    }

    function publish(story, options) {
      options = options || {};
      var entity = manager.add(story, { birthing: true });
      if (!entity) return null;

      // Where it is going. The Story Manager seeds a story anywhere in
      // the Ether, which for an ordinary story is right — but the
      // Ether is much larger than the screen, and a story that joined
      // VihuPlanet somewhere the child cannot see did not visibly join
      // anything. A published story is therefore aimed into the view,
      // and drifts out into the wider universe afterwards in its own
      // time, like everything else.
      var to = ether.pointInView(VihuPlanet.Rng.forId(entity.id + ':arrive'));
      var from = originFor(options);

      entity.position.x = from.x;
      entity.position.y = from.y;
      entity.state = STATES.BIRTHING;
      entity.birthT = 0;

      arrivals.push({
        entity: entity,
        from: from,
        to: to,
        t: 0,
        // Which side the rise bows out to. Seeded from the id, so two
        // stories published one after another do not trace the same
        // line — the second child's story is not a copy of the first's
        // arrival.
        sway: ((VihuPlanet.Rng.hash(entity.id) % 200) - 100) / 100
      });

      if (signal) signal.emit('story:birth', { entity: entity });
      return entity;
    }

    function update(dt) {
      if (!arrivals.length) return;

      for (var i = arrivals.length - 1; i >= 0; i--) {
        var a = arrivals[i];
        var e = a.entity;

        a.t += dt / DURATION;
        var t = Util.clamp(a.t, 0, 1);
        e.birthT = t;

        // The rise. easeOut on the vertical: the story leaves quickly
        // and slows as it arrives, the way something buoyant reaches
        // the surface — never a constant-speed slide, which is the
        // motion of a progress bar.
        var rise = Util.easeOut(t);
        // The horizontal is smoothstepped and bowed, so the path is a
        // curve the whole way rather than a straight line with a wobble.
        var across = Util.smooth(t);
        var bow = Math.sin(t * Math.PI) * a.sway * Math.min(ether.viewWidth * 0.14, 120);

        e.position.x = Util.lerp(a.from.x, a.to.x, across) + bow;
        e.position.y = Util.lerp(a.from.y, a.to.y, rise);

        // It turns as it goes, arriving at the resting tilt it will
        // keep. A story does not snap upright at the end of its own
        // arrival.
        e.rotation = Util.lerp(0, e.tilt, Util.smooth(t));

        if (t >= 1) {
          e.birthT = 1;
          e.position.x = a.to.x;
          e.position.y = a.to.y;
          e.state = STATES.DRIFTING;
          arrivals.splice(i, 1);
          if (signal) signal.emit('story:born', { entity: e });
        }
      }
    }

    // A story removed mid-arrival must not leave an orphan driving a
    // position nobody owns any more.
    if (signal) {
      signal.on('story:removed', function (payload) {
        for (var i = arrivals.length - 1; i >= 0; i--) {
          if (arrivals[i].entity === payload.entity) arrivals.splice(i, 1);
        }
      });
    }

    return {
      publish: publish,
      update: update,
      pending: function () { return arrivals.length; }
    };
  };
})(typeof window !== 'undefined' ? window : this);
