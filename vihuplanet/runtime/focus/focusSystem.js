// focusSystem.js — touch a story, it comes forward; let it go, it
// returns to exactly where it was.
//
//   story → moves forward → background softly fades → story enlarges
//         → story opens → close → returns to the Ether
//
// The whole sequence is one number: `entity.focusT`, from 0 to 1. This
// system is the only thing that writes it, and it writes nothing else.
//
//   · The Story Layer blends between the story's place in the Ether
//     and the centre of the field by focusT, so "comes forward",
//     "enlarges" and "straightens up" are all the same motion.
//   · The Ether Renderer softens the universe by the same number, so
//     the background fade cannot ever drift out of step with the
//     story rising out of it.
//   · Physics stops simulating a story the moment it stops drifting,
//     so its place in the Ether is HELD — not saved and restored, not
//     re-derived, simply never given away.
//
// That last point is the whole of "stories always return to the exact
// place they occupied". There is no return animation to get wrong and
// no restore step that can be missed: at focusT 0 the story is drawn
// by the same expression that drew it before it was ever touched.
// Meanwhile the rest of the universe never paused — everything else
// kept drifting underneath the entire time.
//
// What "story opens" means in Phase 1: the story is held forward,
// enlarged, legible, and `focus:opened` is announced. The reading
// experience is explicitly a later phase. This system is the door;
// what is behind the door gets built later and plugs into the event.
//
// Events:
//   focus:begin   { entity }  a story started coming forward
//   focus:opened  { entity }  it has arrived and is held
//   focus:closing { entity }  it started going back
//   focus:closed  { entity }  it is back in the Ether, drifting

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Focus = VihuPlanet.ns('Focus');
  var STATES = VihuPlanet.Stories.STATES;

  Focus.create = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var manager = opts.manager;
    var layer = opts.layer;
    var signal = opts.signal;
    if (!ether || !manager) return null;

    var reduced = Env.reducedMotion();
    // Slow enough to be a journey, fast enough that a child never
    // waits. Reduced motion keeps the same sequence — it simply
    // happens close to at once, because the alternative is a control
    // that appears not to respond.
    var OPEN_TIME  = reduced ? 0.14 : 0.62;
    var CLOSE_TIME = reduced ? 0.12 : 0.48;

    var current = null;       // the entity coming forward or held
    var returnFocusTo = null; // the DOM element to hand keyboard focus back to

    function open(id) {
      var entity = manager.get(id);
      if (!entity) return false;
      if (current === entity) return false;

      // One story at a time. A second touch while one is open sends
      // the first home first — never two stories forward at once.
      if (current) close();

      if (entity.state === STATES.BIRTHING) return false;   // let it arrive first

      // The held place. Physics has already stopped touching this
      // story by the next frame; `home` is recorded for future systems
      // that may want to know where a focused story belongs, and for
      // storyManager.rescale() to keep correct across a resize.
      entity.home = { x: entity.position.x, y: entity.position.y };
      entity.state = STATES.FOCUSING;

      var node = layer && layer.nodeFor(entity.id);
      returnFocusTo = (node && global.document.activeElement === node.el) ? node.el : null;

      current = entity;
      if (signal) signal.emit('focus:begin', { entity: entity });
      return true;
    }

    function close() {
      if (!current) return false;
      current.state = STATES.RETURNING;
      if (signal) signal.emit('focus:closing', { entity: current });
      return true;
    }

    function update(dt) {
      if (!current) {
        if (ether.veil > 0) ether.setVeil(0);
        return;
      }

      var e = current;

      if (e.state === STATES.FOCUSING) {
        e.focusT = Util.clamp(e.focusT + dt / OPEN_TIME, 0, 1);
        if (e.focusT >= 1) {
          e.state = STATES.FOCUSED;
          if (signal) signal.emit('focus:opened', { entity: e });
          // Keyboard focus follows the story forward, so a child using
          // a keyboard is looking at what their focus ring is on.
          var node = layer && layer.nodeFor(e.id);
          if (node && returnFocusTo) node.el.focus();
        }
      } else if (e.state === STATES.RETURNING) {
        e.focusT = Util.clamp(e.focusT - dt / CLOSE_TIME, 0, 1);
        if (e.focusT <= 0) {
          e.focusT = 0;
          e.home = null;
          // Straight back into the universe's laws. Its position was
          // never altered, so it resumes from precisely the point it
          // was touched at, with the velocity it was carrying.
          e.state = STATES.DRIFTING;
          var closed = e;
          current = null;
          // The veil is cleared BEFORE the event, not after. A
          // listener must never be handed a universe that is still
          // half-dimmed for a story that has already gone home.
          ether.setVeil(0);
          if (returnFocusTo) { try { returnFocusTo.focus(); } catch (err) {} }
          returnFocusTo = null;
          if (signal) signal.emit('focus:closed', { entity: closed });
          return;
        }
      }

      // The universe recedes exactly as far as the story has come
      // forward — one number, so they can never disagree.
      ether.setVeil(current ? Util.smooth(current.focusT) : 0);
    }

    // ---------- ways out ----------
    //
    // Escape, and touching the space around the story. Both are the
    // same gesture: look away, and the universe takes the story back.
    function onKeyDown(ev) {
      if (ev.key === 'Escape' && current) {
        ev.preventDefault();
        close();
      }
    }
    global.document.addEventListener('keydown', onKeyDown);

    var unbindActivate = null;
    if (signal) {
      unbindActivate = signal.on('story:activate', function (payload) {
        // Touching the story that is already open closes it. The same
        // gesture opens and closes — nothing new to learn, and no
        // close button drawn on top of a child's story.
        if (current && current.id === payload.id) close();
        else open(payload.id);
      });

      // A story removed from the Ether while it is open must not leave
      // the universe permanently veiled.
      signal.on('story:removed', function (payload) {
        if (current && current.id === payload.entity.id) {
          current = null;
          returnFocusTo = null;
          ether.setVeil(0);
        }
      });
    }

    return {
      update: update,
      open: open,
      close: close,
      current: function () { return current; },
      isOpen: function () { return !!current; },
      destroy: function () {
        global.document.removeEventListener('keydown', onKeyDown);
        if (unbindActivate) unbindActivate();
        current = null;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
