// traveller.js — the Traveller, and how the universe turns around them.
//
// The Traveller is always at the centre and never moves. There is no
// avatar, no marker and no object in this file representing them —
// the Traveller IS the centre of the screen, and everything else is
// arranged around it. What this system owns is the one thing the
// Traveller can do: look.
//
//   Mouse   · moving toward the edges of the screen turns the universe
//             in that direction. The nearer the edge, the faster.
//   Keyboard· the arrow keys turn it.
//   Touch   · dragging turns it directly, one finger, one to one.
//
// The distinction the sprint draws, and the one this file is built to
// hold: **looking around the night sky, not moving through a map.**
// Nothing here translates a position. Every input feeds the camera's
// yaw and pitch — an angle and a tilt — and the camera converts those
// into how far the world has swung past. Turn far enough and the
// universe closes on itself, because a full turn of yaw is exactly one
// field width and the Ether already wraps there.
//
// The dead zone in the middle is most of the screen, on purpose. A
// child moving the mouse to reach a story should not be steering the
// universe by accident; only a deliberate move toward an edge turns
// anything.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Traveller = VihuPlanet.ns('Traveller');

  // Everything past this fraction from the centre steers. Below it,
  // nothing happens at all.
  var DEAD_ZONE = 0.55;

  // Radians per second at the very edge of the screen. A full turn of
  // the universe takes about twenty seconds held hard over — slow
  // enough that it reads as the sky moving rather than a camera
  // whipping round.
  var EDGE_YAW = 0.31;
  var EDGE_PITCH = 0.30;      // in pitch units (-1..1) per second

  // Arrow keys are a little more decisive than the mouse: pressing a
  // key is a deliberate act, hovering near an edge is often not.
  var KEY_YAW = 0.42;
  var KEY_PITCH = 0.42;

  Traveller.create = function (opts) {
    opts = opts || {};
    var camera = opts.camera;
    var root = opts.root;
    var ether = opts.ether;
    if (!camera || !root) return null;

    // Reduced motion does not disable looking around — that is the
    // Traveller's own deliberate action, and taking it away would be
    // taking away the universe. It only removes the ambient drift,
    // which the camera already handles.
    var enabled = true;
    var pointer = { x: 0, y: 0, inside: false };
    var keys = { left: false, right: false, up: false, down: false };
    var drag = null;

    function onPointerMove(ev) {
      pointer.inside = true;
      var rect = root.getBoundingClientRect();
      // -1..1 from the centre on each axis.
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((ev.clientY - rect.top) / rect.height) * 2 - 1;
    }
    function onPointerLeave() { pointer.inside = false; }

    // Past the dead zone, ramped rather than switched — the universe
    // never starts turning at a speed, it starts turning from nothing.
    function steer(v) {
      var a = Math.abs(v);
      if (a <= DEAD_ZONE) return 0;
      var t = (a - DEAD_ZONE) / (1 - DEAD_ZONE);
      return Math.sign(v) * Util.smooth(Util.clamp(t, 0, 1));
    }

    var KEY_MAP = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      a: 'left', d: 'right', w: 'up', s: 'down',
      A: 'left', D: 'right', W: 'up', S: 'down'
    };

    // Only ever yield the arrow keys to something that actually USES
    // them: a text field, a select, editable content. Not buttons and
    // not links — arrow keys mean nothing to either.
    //
    // This list started as `button, a, input, textarea, [contenteditable]`
    // and that was a real bug, not an over-cautious guard. Every path
    // through VihuPlanet Home leaves focus on a button — Tap to Begin
    // is one, and so are both permanent actions — and focus stays there
    // after a click. So arrows worked until the child's very first tap
    // and then never again for the rest of the visit. Measured: 0.53
    // radians of turn before the first click, 0.0000 after it.
    var TYPING = 'input, textarea, select, [contenteditable]';

    function onKeyDown(ev) {
      var k = KEY_MAP[ev.key];
      if (!k) return;
      var el = global.document.activeElement;
      if (el && el !== global.document.body && el.closest && el.closest(TYPING)) return;
      keys[k] = true;
      ev.preventDefault();
    }
    function onKeyUp(ev) {
      var k = KEY_MAP[ev.key];
      if (k) keys[k] = false;
    }
    function onBlur() { keys.left = keys.right = keys.up = keys.down = false; }

    // Touch: one to one with the finger, which is the only model that
    // feels right on a phone — the sky follows the hand exactly.
    function onTouchStart(ev) {
      if (!ev.touches || ev.touches.length !== 1) return;
      drag = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, moved: 0 };
    }
    function onTouchMove(ev) {
      if (!drag || !ev.touches || ev.touches.length !== 1) return;
      var t = ev.touches[0];
      var dx = t.clientX - drag.x;
      var dy = t.clientY - drag.y;
      drag.x = t.clientX;
      drag.y = t.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      // Dragging right pulls the universe right, which means looking
      // left — the sky moves with the finger, not against it.
      camera.look(-(dx / Math.max(1, ether.viewWidth)) * Math.PI * 2 * 0.5,
                  -(dy / Math.max(1, ether.viewHeight)) * 0.9);
      if (drag.moved > 12) ev.preventDefault();
    }
    function onTouchEnd() { drag = null; }

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('blur', onBlur);

    function update(dt) {
      if (!enabled) return;

      var yaw = 0, pitch = 0;

      if (pointer.inside) {
        yaw += steer(pointer.x) * EDGE_YAW;
        pitch += steer(pointer.y) * EDGE_PITCH;
      }
      if (keys.left)  yaw -= KEY_YAW;
      if (keys.right) yaw += KEY_YAW;
      if (keys.up)    pitch -= KEY_PITCH;
      if (keys.down)  pitch += KEY_PITCH;

      if (yaw || pitch) camera.look(yaw * dt, pitch * dt);
    }

    return {
      update: update,
      // Turning is suspended while a story is being met or read — the
      // universe holding still is part of what makes that moment feel
      // like a moment.
      setEnabled: function (v) { enabled = !!v; if (!v) onBlur(); },
      isEnabled: function () { return enabled; },
      destroy: function () {
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerleave', onPointerLeave);
        root.removeEventListener('touchstart', onTouchStart);
        root.removeEventListener('touchmove', onTouchMove);
        root.removeEventListener('touchend', onTouchEnd);
        global.removeEventListener('keydown', onKeyDown);
        global.removeEventListener('keyup', onKeyUp);
        global.removeEventListener('blur', onBlur);
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
