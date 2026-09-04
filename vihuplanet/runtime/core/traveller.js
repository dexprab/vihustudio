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
//             Dragging the sky turns it directly, exactly as a finger
//             does — grab the night and pull it past.
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
  var EDGE_PITCH = 0.26;      // radians/s, same units as yaw

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
    // THE HOLD HAS TO HOLD ON TOUCH TOO.
    //
    // update() checks `enabled`, so the mouse and the arrow keys both
    // stop turning the universe the moment something asks it to hold
    // still. Touch never did: it calls camera.look() straight from the
    // handler, so it bypassed the flag completely — measured at 1.45
    // radians of turn while the universe was disabled.
    //
    // That made it a phone-only fault, and it broke the two moments the
    // hold exists for. Meeting a Spirit disables the traveller because
    // "the universe holding still is part of what makes that a moment"
    // (universe.js, focus:begin) — on a phone the sky swung anyway while
    // focus was trying to keep the story centred, and the two writing
    // the camera at once is what a child sees as the Ether glitching.
    // The portal's own keyboard handler already states the assumption
    // this violated: "the universe is stopped anyway."
    // A TAP IS NOT A SWIPE, AND A FINGER IS NEVER PERFECTLY STILL.
    // A child's tap wobbles a few pixels between touchstart and
    // touchend, and every wobble used to steer the camera and reset
    // stillness — measured with the slop removed: a 3px synthetic
    // jitter dropped stillness 9.5 → 0, silencing the nudge, the
    // glance and the beckon for a tap that meant "hello", not "turn".
    // So a touch earns steering only after TOUCH_STARTS_AT px of
    // accumulated travel (the touch twin of DRAG_STARTS_AT, a little
    // wider because fingers are wider than pointers), and until then
    // the camera holds and stillness keeps accruing.
    //
    // Chromium's own gesture recognizer withholds sub-slop touchmove
    // from the page entirely, so there this guard is belt-and-braces;
    // iOS Safari delivers touchmove with no slop of its own, which is
    // the browser this rule is load-bearing for.
    //
    // And a real swipe eats the click that follows it, through the
    // SAME time-bounded swallow the mouse drag uses — one suppression
    // mechanism, two input paths. Chromium suppresses that click
    // itself once a touch travels past its own slop; not every
    // browser promises it, and the ripple reads clicks.
    var TOUCH_STARTS_AT = 8;  // px of travel before a touch is a drag
    function onTouchStart(ev) {
      if (!enabled) { drag = null; return; }
      if (!ev.touches || ev.touches.length !== 1) return;
      // A fresh touch outranks a stale swallow: where the browser
      // already suppressed the swipe's own click, the bound must not
      // linger into the next tap's.
      swallowClickUntil = 0;
      drag = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, moved: 0 };
    }
    function onTouchMove(ev) {
      if (!enabled) { drag = null; return; }
      if (!drag || !ev.touches || ev.touches.length !== 1) return;
      var t = ev.touches[0];
      var dx = t.clientX - drag.x;
      var dy = t.clientY - drag.y;
      drag.x = t.clientX;
      drag.y = t.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved <= TOUCH_STARTS_AT) return;  // still a tap, camera holds
      // Dragging right pulls the universe right, which means looking
      // left — the sky moves with the finger, not against it.
      camera.look(-(dx / Math.max(1, ether.viewWidth)) * Math.PI * 2 * 0.5,
                  -(dy / Math.max(1, ether.viewHeight)) * Math.PI * 2 * 0.5);
      still = 0;
      if (drag.moved > 12) ev.preventDefault();
    }
    function onTouchEnd() {
      if (drag && drag.moved > TOUCH_STARTS_AT) {
        // A swipe is a swipe even where the browser forgets to
        // suppress its trailing click — same bound as the mouse path.
        swallowClickUntil = Date.now() + 300;
      }
      drag = null;
    }

    // ---------- dragging with a mouse ----------
    //
    // The same gesture the touch path has always had, for a hand
    // holding a mouse: press on the sky and pull it. Edge-steering
    // stays — it is how the universe is turned without committing a
    // hand — but a drag is the direct, discoverable form of the same
    // sentence, and a child who tries to grab the night should find
    // that it comes.
    //
    // Three rules keep it from breaking what already works:
    //   · it starts only on the sky, never on a Story, a button or a
    //     field — a press on something is that something's;
    //   · edge-steering is suspended WHILE dragging, or the two would
    //     both feed yaw and the universe would fight the hand;
    //   · a real drag eats the click that follows it. Without that, a
    //     drag that happens to end over a Spirit would open it — the
    //     exact accidental steering the dead zone exists to prevent,
    //     in the other direction.
    //
    // pointerType 'touch' is left to the touch handlers above: modern
    // browsers fire pointer events for fingers too, and two paths
    // turning the camera for one finger would double every drag.
    var mouseDrag = null;
    var swallowClickUntil = 0;
    var DRAG_STARTS_AT = 6;   // px of travel before a press is a drag

    // The press is TRACKED even while turning is suspended (a Spirit
    // being met disables the traveller). The camera never moves then —
    // update() and the move handler both honour `enabled` — but the
    // gesture still has to be recognised as a drag, or the click the
    // browser fires at its end would land on the sky and close the
    // very story the child is looking at. A drag is not a tap, whether
    // or not the universe was free to follow it.
    function onPointerDown(ev) {
      if (ev.pointerType === 'touch') return;
      if (ev.button !== 0) return;
      var t = ev.target;
      if (t && t.closest &&
          t.closest('.vp-story, button, a, ' + TYPING)) return;
      mouseDrag = { x: ev.clientX, y: ev.clientY, moved: 0, id: ev.pointerId };
      // Capture, so a drag that leaves the window keeps its grip and
      // its release is never missed.
      try { root.setPointerCapture(ev.pointerId); } catch (e) {}
    }

    function onPointerDragMove(ev) {
      if (!mouseDrag || ev.pointerId !== mouseDrag.id) return;
      var dx = ev.clientX - mouseDrag.x;
      var dy = ev.clientY - mouseDrag.y;
      mouseDrag.x = ev.clientX;
      mouseDrag.y = ev.clientY;
      mouseDrag.moved += Math.abs(dx) + Math.abs(dy);
      if (mouseDrag.moved <= DRAG_STARTS_AT) return;
      if (!enabled) return;   // recognised as a drag, but the universe holds still
      // Dragging right pulls the universe right — the sky moves with
      // the hand, not against it. Same maths as the touch path.
      camera.look(-(dx / Math.max(1, ether.viewWidth)) * Math.PI * 2 * 0.5,
                  -(dy / Math.max(1, ether.viewHeight)) * Math.PI * 2 * 0.5);
      still = 0;
    }

    function onPointerUp(ev) {
      if (!mouseDrag || ev.pointerId !== mouseDrag.id) return;
      if (mouseDrag.moved > DRAG_STARTS_AT) {
        // Time-bounded rather than a bare flag: if the browser never
        // delivers the click (released off-window), a stale flag must
        // not eat the NEXT tap on a Story.
        swallowClickUntil = Date.now() + 300;
      }
      try { root.releasePointerCapture(ev.pointerId); } catch (e) {}
      mouseDrag = null;
    }

    function onClickCapture(ev) {
      if (Date.now() < swallowClickUntil) {
        swallowClickUntil = 0;
        ev.stopPropagation();
        ev.preventDefault();
      }
    }

    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerDragMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('click', onClickCapture, true);
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onTouchEnd);
    global.addEventListener('keydown', onKeyDown);
    global.addEventListener('keyup', onKeyUp);
    global.addEventListener('blur', onBlur);

    // How long since the Traveller last turned the universe. The
    // universe answers stillness (ambientSystem.js), and this is the
    // only thing that knows when it began — the camera cannot tell a
    // Traveller who has stopped looking from one whose input happens to
    // sum to zero this frame, and a mouse resting inside the dead zone
    // is stillness even though the pointer is moving.
    var still = 0;

    function update(dt) {
      if (!enabled) { still += dt; return; }

      var yaw = 0, pitch = 0;

      // A hand that is dragging the sky is already steering it; the
      // edge zones stand down until it lets go.
      var dragging = mouseDrag && mouseDrag.moved > DRAG_STARTS_AT;

      if (pointer.inside && !dragging) {
        yaw += steer(pointer.x) * EDGE_YAW;
        pitch += steer(pointer.y) * EDGE_PITCH;
      }
      if (keys.left)  yaw -= KEY_YAW;
      if (keys.right) yaw += KEY_YAW;
      if (keys.up)    pitch -= KEY_PITCH;
      if (keys.down)  pitch += KEY_PITCH;

      if (yaw || pitch) { camera.look(yaw * dt, pitch * dt); still = 0; }
      else still += dt;
    }

    return {
      update: update,
      // Seconds since the universe was last turned. Touch counts as
      // turning too — a drag calls camera.look() directly, so it resets
      // this on its way past.
      stillSeconds: function () { return still; },
      // Turning is suspended while a story is being met or read — the
      // universe holding still is part of what makes that moment feel
      // like a moment.
      setEnabled: function (v) { enabled = !!v; if (!v) onBlur(); },
      isEnabled: function () { return enabled; },
      destroy: function () {
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('pointermove', onPointerDragMove);
        root.removeEventListener('pointerup', onPointerUp);
        root.removeEventListener('pointercancel', onPointerUp);
        root.removeEventListener('click', onClickCapture, true);
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
