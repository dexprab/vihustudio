// storyLayer.js — the presentation layer for Story Entities.
//
// A renderer, in the same sense the Ether Renderer is one: it reads
// the Story Entity contract and draws it. It never moves a story,
// never changes a story's state, and never decides what a story is.
// Delete this file and the universe still runs — it simply becomes
// invisible.
//
// Why DOM and not canvas, when the brief says to avoid hundreds of DOM
// nodes: a story is the one thing in the Ether a child touches. Real
// elements give real hit-testing, real focus rings, real keyboard
// order and real screen-reader names for free, and losing all four to
// save a paint is a bad trade for the one object that matters.
//
// The brief's warning is respected by never creating hundreds of them:
//
//   · POOLING. Nodes are created once and reassigned. A story that
//     drifts off the field releases its node to the next story that
//     drifts on. Adding the five-hundredth story to the Ether creates
//     no DOM at all.
//   · CULLING. Only stories inside the field (plus a margin) are
//     given a node. The Ether wraps, so at any moment most of a large
//     universe is off-field.
//   · A HARD CAP. If more stories are on-field than the cap allows,
//     the nearest win — depth decides, which is also what the eye
//     would decide. The cap is a promise about cost that holds no
//     matter how large the universe gets.
//
// Everything animates through `transform` and `opacity` only: the two
// properties a browser can composite without laying the page out
// again.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Stories = VihuPlanet.ns('Stories');
  var STATES = Stories.STATES;

  // Beyond this many simultaneous on-field stories the far ones stop
  // being given nodes.
  //
  // 64 is measured, not guessed. Profiling found that the cost of a
  // drifting field is almost entirely "how many cards are being
  // composited", and essentially nothing to do with how many stories
  // exist: 275 stories and 600 stories run at the same frame rate,
  // because both are drawing this many cards. The cap is therefore the
  // one number that decides what the Ether costs, and it holds that
  // promise no matter how large VihuPlanet gets.
  //
  // 64 simultaneously visible stories is also already a busier field
  // than a calm universe should show. If a surface ever wants more, it
  // passes maxNodes and accepts the cost knowingly.
  var DEFAULT_MAX_NODES = 64;

  Stories.createLayer = function (opts) {
    opts = opts || {};
    var mount = opts.mount;
    var ether = opts.ether;
    var manager = opts.manager;
    var signal = opts.signal;
    if (!mount || !ether || !manager) return null;

    var camera = opts.camera || null;
    var maxNodes = opts.maxNodes || DEFAULT_MAX_NODES;

    // How far outside the view a story still gets a node, so one that
    // is half on screen is drawn half on screen rather than popping in
    // at the edge. It only needs to cover half a card — 160px was
    // measured drawing 63 cards on a phone where 33 were actually in
    // view, because a fixed margin is enormous relative to a small
    // screen and reasonable relative to a large one.
    var margin = opts.margin || 120;

    var root = global.document.createElement('div');
    root.className = 'vp-story-layer';
    mount.appendChild(root);

    var pool = [];        // every node ever created
    var free = [];        // nodes not currently assigned
    var assigned = {};    // entity id → node
    var visible = [];     // scratch: entities to draw this frame

    // ---------- node construction ----------
    //
    // Three nested elements, each owning exactly one transform
    // concern. This is the same structure planets.js arrived at in the
    // Hero, for the same reason: transforms that are written by
    // different systems at different rates must not share an element,
    // or the last writer each frame silently wins.
    //
    //   .vp-story        placement in the Ether (written every frame)
    //   .vp-story-focus  the come-forward transform (Focus System)
    //   .vp-story-card   the card's own resting tilt + hover lift (CSS)
    function createNode() {
      var el = global.document.createElement('div');
      el.className = 'vp-story';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      var focusEl = global.document.createElement('div');
      focusEl.className = 'vp-story-focus';

      var card = global.document.createElement('div');
      card.className = 'vp-story-card';

      var cover = global.document.createElement('div');
      cover.className = 'vp-story-cover';

      var img = global.document.createElement('img');
      img.className = 'vp-story-image';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      cover.appendChild(img);

      var caption = global.document.createElement('div');
      caption.className = 'vp-story-caption';

      var title = global.document.createElement('div');
      title.className = 'vp-story-title';
      caption.appendChild(title);

      card.appendChild(cover);
      card.appendChild(caption);
      focusEl.appendChild(card);
      el.appendChild(focusEl);

      var node = {
        el: el, focusEl: focusEl, card: card,
        cover: cover, img: img, title: title,
        entityId: null, coverSrc: null, birthing: false
      };

      // The only thing this layer decides is that a story was
      // touched. What happens next belongs to the Focus System, which
      // is listening — not to the element that was clicked.
      function activate(ev) {
        if (ev) ev.preventDefault();
        if (!node.entityId || !signal) return;
        signal.emit('story:activate', { id: node.entityId });
      }
      el.addEventListener('click', activate);
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') activate(ev);
      });

      pool.push(node);
      root.appendChild(el);
      return node;
    }

    function takeNode() {
      if (free.length) return free.pop();
      if (pool.length >= maxNodes) return null;
      return createNode();
    }

    function bind(node, e) {
      node.entityId = e.id;
      node.title.textContent = e.title || '';

      var label = e.title || 'A story';
      if (e.creator) label += ', by ' + e.creator;
      node.el.setAttribute('aria-label', label);

      // Only touch src when it actually changed — reassigning the same
      // URL restarts a decode for nothing, and node reuse makes that
      // an easy accident to have every single frame.
      if (node.coverSrc !== e.cover) {
        node.coverSrc = e.cover;
        if (e.cover) {
          node.img.src = e.cover;
          node.cover.classList.remove('is-blank');
        } else {
          node.img.removeAttribute('src');
          // A story with no cover art is not an error state. It gets
          // the Ether's own light instead — a luminous blank card,
          // which is what a story looks like before anyone has seen
          // inside it.
          node.cover.classList.add('is-blank');
        }
      }

      node.el.style.setProperty('--vp-story-tilt', (e.tilt || 0).toFixed(2) + 'deg');
      node.el.classList.add('is-live');
    }

    function release(node) {
      if (!node.entityId) return;
      node.entityId = null;
      node.birthing = false;
      node.el.classList.remove('is-live', 'is-focused', 'is-birthing');
      node.el.style.removeProperty('--vp-birth-t');
      node.el.setAttribute('aria-hidden', 'true');
      node.el.removeAttribute('aria-label');
      free.push(node);
    }

    // ---------- the frame ----------
    function render() {
      var entities = manager.all();
      var centre = ether.centre();
      var i, e;

      // The Universe Camera, at the stories' own plane. It is a
      // viewpoint, not a position: it shifts where a story is DRAWN
      // and never touches where it IS, which is why focus still
      // returns a story to the exact place it occupied.
      var cam = camera ? camera.offsetFor(ether.depth.stories) : null;
      var camX = cam ? cam.x : 0;
      var camY = cam ? cam.y : 0;

      // 1 · cull to the field plus a margin.
      visible.length = 0;
      for (i = 0; i < entities.length; i++) {
        e = entities[i];
        if (e.state === STATES.DORMANT) continue;
        // A focused story is always kept, wherever its held place is —
        // it is the one thing the child is actually looking at.
        var focused = e.focusT > 0.001;
        // Culled against the VIEW, not the field. The Ether is far
        // larger than the screen (see ether.js), so most of a grown
        // universe is elsewhere at any moment — which is what keeps
        // the cost flat as VihuPlanet fills up, and what leaves
        // stories to be discovered rather than displayed.
        if (!focused) {
          var vx = e.position.x + camX, vy = e.position.y + camY;
          if (vx < -margin || vx > ether.viewWidth + margin) continue;
          if (vy < -margin || vy > ether.viewHeight + margin) continue;
        }
        visible.push(e);
      }

      // 2 · if the field is over-full, the nearest stories win. Sorting
      // only happens in the rare frames where it matters.
      if (visible.length > maxNodes) {
        visible.sort(function (a, b) {
          if (b.focusT !== a.focusT) return b.focusT - a.focusT;
          return b.depth - a.depth;
        });
        visible.length = maxNodes;
      }

      // 3 · release nodes whose story is no longer being drawn.
      var stillVisible = {};
      for (i = 0; i < visible.length; i++) stillVisible[visible[i].id] = true;
      for (var id in assigned) {
        if (!assigned.hasOwnProperty(id)) continue;
        if (!stillVisible[id]) {
          release(assigned[id]);
          delete assigned[id];
        }
      }

      // 4 · draw.
      for (i = 0; i < visible.length; i++) {
        e = visible[i];
        var node = assigned[e.id];
        if (!node) {
          node = takeNode();
          if (!node) continue;          // pool exhausted this frame
          assigned[e.id] = node;
          node.el.removeAttribute('aria-hidden');
          bind(node, e);
        } else if (node.entityId !== e.id) {
          bind(node, e);
        }

        // Focus composition. The story's place in the Ether and the
        // place a focused story occupies are BLENDED, not swapped —
        // which is the whole of "stories always return to the exact
        // place they occupied". There is no return animation to get
        // wrong: at focusT 0 the story is exactly where physics left
        // it, because that is the same expression that drew it a
        // moment ago.
        // The camera is applied to the drifting position BEFORE the
        // focus blend, so a focused story lands on the centre of the
        // screen exactly and stays there while the universe keeps
        // drifting behind it.
        var t = Util.smooth(e.focusT);
        var x = Util.lerp(e.position.x + e.bobX + camX, centre.x, t);
        var y = Util.lerp(e.position.y + e.bobY + camY, centre.y, t);
        var rot = Util.lerp(e.rotation, 0, t);

        // Birth. The story starts as a point of light and grows into
        // itself as it rises. birthT is written by storyBirth.js; all
        // this layer does is read it — including handing it to CSS as
        // `--vp-birth-t`, which is what drives the bloom in
        // runtime.css. The luminance is styling, so it lives in the
        // stylesheet; the journey is motion, so it lives in physics
        // and birth. Neither one duplicates the other.
        var birthing = (e.state === STATES.BIRTHING);
        var born = birthing ? Util.smooth(e.birthT) : 1;
        var base = birthing ? Util.lerp(0.16, e.scale, Util.easeOut(e.birthT)) : e.scale;
        var scale = Util.lerp(base, focusScale(), t);

        var alpha = Util.lerp(e.opacity * born, 1, t);

        if (birthing) {
          node.el.classList.add('is-birthing');
          node.el.style.setProperty('--vp-birth-t', e.birthT.toFixed(3));
        } else if (node.birthing) {
          node.el.classList.remove('is-birthing');
          node.el.style.removeProperty('--vp-birth-t');
        }
        node.birthing = birthing;

        var el = node.el;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        el.style.opacity = alpha.toFixed(3);
        // Depth decides stacking; a focused story leaves the ramp
        // entirely and sits above everything.
        el.style.zIndex = String(t > 0.001 ? 3000 : Math.round(e.depth * 900));

        node.focusEl.style.transform =
          'rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';

        if (t > 0.5) el.classList.add('is-focused');
        else el.classList.remove('is-focused');
      }
    }

    // How large a focused story becomes. Derived from the field so the
    // same story fills a phone and a laptop equally — a fixed scale
    // would be a postage stamp on one and off the edge on the other.
    function focusScale() {
      var shortest = Math.min(ether.viewWidth, ether.viewHeight);
      return Util.clamp(shortest / 420, 1.35, 2.6);
    }

    // A story removed from the Ether must not leave a live node behind
    // holding its title and its click handler.
    if (signal) {
      signal.on('story:removed', function (payload) {
        var node = assigned[payload.entity.id];
        if (!node) return;
        release(node);
        delete assigned[payload.entity.id];
      });
    }

    return {
      root: root,
      render: render,
      // The node belonging to a story, if it currently has one. The
      // Focus System uses this to move keyboard focus onto an opened
      // story; nothing else needs it.
      nodeFor: function (id) { return assigned[id] || null; },
      stats: function () {
        return { nodes: pool.length, free: free.length, drawn: visible.length };
      },
      destroy: function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        pool.length = 0;
        free.length = 0;
        assigned = {};
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
