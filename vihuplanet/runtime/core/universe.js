// universe.js — the Universe Engine.
//
// The composition root. Every other system in the runtime is
// independent and knows nothing about its neighbours; this is the one
// file that knows they all exist, wires them into a single heartbeat,
// and runs them in the right order.
//
// That ordering is the only coupling in the runtime, and it is here
// rather than distributed through the systems on purpose:
//
//   1. Camera    the viewpoint drifts. First, because every layer is
//                drawn through it
//   2. Ambient   the universe does its own thing — it is not a
//                reaction to anything
//   3. Birth     arriving stories are moved by Birth, not by Physics
//   4. Focus     focusT and the veil settle before anything is drawn
//   5. Physics   the drifting universe integrates
//   6. Light     where every story ended up becomes a light source
//   7. Ether     the space is painted
//   8. Stories   the stories are placed on top of it
//
// Update and render are not split into two passes. At this scale the
// separation buys nothing real and costs a second walk over every
// entity, and a runtime that has to stay light does not pay for
// symmetry it cannot use.
//
// Public API — the whole surface anything outside the runtime needs:
//
//   var universe = VihuPlanet.Universe.create({ mount: el });
//   universe.start();
//   universe.seed([ story, story, ... ]);   stories already in the Ether
//   universe.publish(story, { from: {x,y} });  a story joining, visibly
//   universe.on('story:born', fn);
//   universe.stop();  ·  universe.destroy();

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Env = VihuPlanet.Env;
  var Universe = VihuPlanet.ns('Universe');

  Universe.create = function (opts) {
    opts = opts || {};
    var mount = opts.mount;
    if (!mount) {
      if (global.console) console.warn('[VihuPlanet] Universe.create needs a mount element');
      return null;
    }

    // The runtime owns one element inside whatever it was given, and
    // never touches the host's own classes or children. A host page
    // can put the universe behind its own interface without the two
    // negotiating anything.
    var root = global.document.createElement('div');
    root.className = 'vp-universe';
    mount.appendChild(root);

    var signal = VihuPlanet.Signal.create();

    var box = root.getBoundingClientRect();
    var ether = VihuPlanet.Ether.create({
      signal: signal,
      width: Math.max(1, Math.round(box.width || mount.clientWidth || global.innerWidth)),
      height: Math.max(1, Math.round(box.height || mount.clientHeight || global.innerHeight))
    });

    // The Ether Currents and the Universe Camera come first: the
    // currents are what everything that floats is carried by, and the
    // camera is what every layer is drawn through.
    var currents = VihuPlanet.Ether.createCurrents({ ether: ether });
    var camera   = VihuPlanet.Camera.create({ ether: ether });
    // The Traveller never moves; this is how the universe turns around
    // them. Created after the camera because it drives nothing else.
    var traveller = VihuPlanet.Traveller.create({ camera: camera, ether: ether, root: root });

    var manager  = VihuPlanet.Stories.createManager({ field: ether, signal: signal });
    var physics  = VihuPlanet.Physics.create({
      config: opts.physics,
      currents: currents,
      // Reduced motion is answered once, here, and every system
      // downstream inherits a still universe rather than each of them
      // deciding separately how still to be.
      motionScale: Env.reducedMotion() ? 0 : 1
    });
    // The camera and the Traveller are handed over so the atmosphere
    // can know two things it cannot work out for itself: WHERE in the
    // Ether the child is looking (which gives that part of the universe
    // its own character) and whether they have stopped (which is what
    // the universe answers). Both are read-only — Ambient still writes
    // nothing but `ether.ambient`, and still has never heard of a story.
    var ambient  = VihuPlanet.Ambient.create({
      ether: ether, currents: currents, signal: signal,
      camera: camera, traveller: traveller
    });
    var renderer = VihuPlanet.Ether.createRenderer({ ether: ether, mount: root, camera: camera });
    var layer    = VihuPlanet.Stories.createLayer({
      mount: root, ether: ether, manager: manager, signal: signal,
      maxNodes: opts.maxNodes
    });
    var spirits = VihuPlanet.Stories.createSpirits({
      ether: ether, manager: manager, camera: camera
    });

    // Appended after the story layer so it sits above it in DOM order.
    // The nearest atmosphere has to be in FRONT of the stories, and a
    // canvas cannot be in front of a sibling it precedes.
    renderer.attachForeground();
    var focus    = VihuPlanet.Focus.create({ ether: ether, manager: manager, layer: layer, signal: signal });
    var birth    = VihuPlanet.Birth.create({ ether: ether, manager: manager, signal: signal });
    var worlds   = VihuPlanet.Worlds.create({ manager: manager, signal: signal });

    var clock = VihuPlanet.Clock.create();

    // "The universe gently slows" when a Spirit is met (Stage 3). One
    // number, eased, multiplying the time that reaches the universe's
    // own systems — NOT the ones responding to the child. Focus and
    // Birth keep real time, because slowing a response to a touch is
    // just latency; slowing the universe around it is the moment.
    var pace = 1;
    var paceTarget = 1;
    var etherTime = 0;

    clock.add(function (dt, time) {
      paceTarget = focus.isOpen() ? 0.28 : 1;
      pace += (paceTarget - pace) * (1 - Math.exp(-2.0 * dt));

      // The universe's own clock, which is not the wall clock once it
      // has slowed. Everything procedural reads this, so slowing is
      // seamless rather than a jump in every sine wave at once.
      var sdt = dt * pace;
      etherTime += sdt;

      traveller.update(dt);
      camera.update(sdt, etherTime);
      ambient.update(sdt, etherTime);
      birth.update(dt);
      focus.update(dt);
      physics.step(manager.all(), sdt, etherTime, ether);
      // After physics, before drawing: the Spirits read where every
      // story ended up this frame, and both the renderer and next
      // frame's currents read the lights they write.
      spirits.update(dt, etherTime);
      renderer.render(sdt, etherTime);
      layer.render();
    });

    // Turning is suspended while a Spirit is being met — the universe
    // holding still is part of what makes that a moment.
    signal.on('focus:begin', function () { traveller.setEnabled(false); });
    signal.on('focus:closed', function () { traveller.setEnabled(true); });

    // ---------- resize ----------
    //
    // The field, the canvas, the baked star sky, the particle budget
    // and every story's position all depend on the size of the space.
    // One handler moves all five together, so there is never a frame
    // where the universe disagrees with itself about how big it is.
    function measure() {
      var rect = root.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var ratio = ether.resize(w, h, manager.count());
      if (!ratio) return;
      manager.rescale(ratio.x, ratio.y);
      renderer.resize();
      ambient.resize();
    }

    // The Ether grows with the number of stories in it, at constant
    // density (see ether.js), and every story already in it is carried
    // out with the growth.
    //
    // That second half matters more than it looks. Without it, stories
    // added while the universe was small stay bunched where the
    // universe used to end — which is exactly where the view is — and
    // the screen stays crowded no matter how large the Ether gets.
    // Measured: 34 stories in view where the density says 16.
    //
    // Carrying them out is imperceptible in the case that actually
    // happens repeatedly. Publishing one story into a universe of
    // three hundred grows the field by 0.2%, which moves a story on
    // the far side of the Ether by a few pixels over three seconds,
    // and moves a story near the view by less than one.
    function fit(count) {
      var ratio = ether.fit(count);
      if (ratio) manager.rescale(ratio.x, ratio.y);
    }

    // The safety net for anything reaching manager.add() directly.
    // seed() and publish() below fit the field up front instead, so
    // stories are placed into a universe that is already the right
    // size rather than being placed and then moved.
    signal.on('story:added', function () { fit(manager.count()); });

    var observer = null;
    if (global.ResizeObserver) {
      observer = new global.ResizeObserver(measure);
      observer.observe(root);
    } else {
      global.addEventListener('resize', measure);
    }

    // Touching the space around a story sends it home. The same
    // gesture as Escape, for a child who has never used one.
    root.addEventListener('click', function (ev) {
      if (ev.target === root || ev.target === renderer.canvas) focus.close();
    });

    // ---------- public surface ----------
    //
    // `seed` puts stories into a universe that was already running
    // before anyone looked at it — no arrival animation, because they
    // did not arrive, they were already here. `publish` is the other
    // one: a story joining, visibly, now.
    function seed(stories) {
      stories = stories || [];
      // Grow the Ether BEFORE the stories are placed in it. The Story
      // Manager seeds a position from the field's current size, so
      // growing afterwards would crowd every story into the bounds the
      // universe used to have and leave the new space empty.
      fit(manager.count() + stories.length);
      return manager.addMany(stories);
    }

    function publish(story, options) {
      fit(manager.count() + 1);
      return birth.publish(story, options);
    }

    function destroy() {
      clock.destroy();
      traveller.destroy();
      focus.destroy();
      layer.destroy();
      renderer.destroy();
      signal.clear();
      if (observer) observer.disconnect();
      else global.removeEventListener('resize', measure);
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    return {
      // systems, exposed because a plug-in system needs to reach them.
      // They are the same objects the engine uses — there is no second,
      // sanitised view of the universe.
      root: root,
      ether: ether,
      stories: manager,
      physics: physics,
      ambient: ambient,
      camera: camera,
      currents: currents,
      traveller: traveller,
      spirits: spirits,
      focus: focus,
      worlds: worlds,
      renderer: renderer,
      layer: layer,

      start: clock.start,
      stop: clock.stop,
      isRunning: clock.isRunning,

      seed: seed,
      publish: publish,
      remove: function (id) { return manager.remove(id); },

      on: signal.on,
      off: signal.off,
      emit: signal.emit,

      resize: measure,
      destroy: destroy,

      // Where the Traveller is looking, small enough to keep and hand
      // back. This is what lets them step into a story and return to
      // the exact same place in the Ether — nothing is reloaded and
      // nothing is reset, so this is only the viewpoint, not the
      // universe. The universe was never anywhere else.
      viewpoint: function () { return camera.state(); },
      restoreViewpoint: function (s) { camera.restore(s); },

      stats: function () {
        var s = layer.stats();
        var a = ambient.stats();
        var r = renderer.stats();
        return {
          stories: manager.count(),
          nodes: s.nodes,
          drawn: s.drawn,
          stars: r.stars,
          nebula: r.nebula,
          particles: a.particles,
          streaks: a.streaks,
          lights: spirits.count(),
          arriving: birth.pending(),
          focused: focus.isOpen(),
          field: { width: Math.round(ether.width), height: Math.round(ether.height) },
          view: { width: ether.viewWidth, height: ether.viewHeight },
          reducedMotion: Env.reducedMotion()
        };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
