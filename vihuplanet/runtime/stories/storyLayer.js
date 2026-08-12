// storyLayer.js — the Story Spirit's body.
//
// The Spirit's SOUL is light, and it is drawn on canvas by the Ether
// Renderer from what storySpirit.js computes. This file draws the rest:
// the cover, the name, the maker — everything that only exists once a
// child has turned toward it.
//
// ---------------------------------------------------------------
// A FAR SPIRIT HAS NO BODY AT ALL
//
// Nodes are created only for Spirits the Traveller is anywhere near
// (`prox` — see storySpirit.js). At the far end of the universe a
// Spirit is purely a light in the canvas: no element, no image, no
// text, nothing to lay out or composite.
//
// That is the design and the performance story at once. The sprint
// asks for discovery — "from far away, Story Spirits appear only as
// glowing souls" — and the cheapest possible way to render a glowing
// soul is to not make a DOM node for it. A universe of six hundred
// Spirits creates elements only for the handful being looked at.
//
// Nodes are still POOLED and CAPPED on top of that, so the cost is
// bounded even if every Spirit in the Ether crowds the centre at once.
// ---------------------------------------------------------------
//
// The reveal itself is one number handed to CSS as `--vp-prox`, and
// runtime.css does the rest — cover opacity, cover scale, and the
// name appearing later than the picture. Keeping it declarative means
// the reveal curve is one place, readable, and adjustable without
// touching this file.
//
// Everything animates through `transform` and `opacity` only: the two
// properties a browser can composite without laying the page out again.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Stories = VihuPlanet.ns('Stories');
  var STATES = Stories.STATES;

  // A hard ceiling on bodies. Rarely reached now that nearness decides
  // who gets one, but it is the promise about cost that holds no
  // matter how many Spirits crowd the centre.
  var DEFAULT_MAX_NODES = 48;

  // Below this nearness a Spirit is soul only — no element, no image,
  // no text. Sits just under where runtime.css starts fading the cover
  // in (0.34), so a body always exists before it is visible and a cover
  // is never seen to pop into being.
  var BODY_THRESHOLD = 0.28;

  Stories.createLayer = function (opts) {
    opts = opts || {};
    var mount = opts.mount;
    var ether = opts.ether;
    var manager = opts.manager;
    var signal = opts.signal;
    if (!mount || !ether || !manager) return null;

    var maxNodes = opts.maxNodes || DEFAULT_MAX_NODES;
    var margin = opts.margin || 140;

    var root = global.document.createElement('div');
    root.className = 'vp-story-layer';
    mount.appendChild(root);

    var pool = [];        // every node ever created
    var free = [];        // nodes not currently assigned
    var assigned = {};    // entity id → node
    var visible = [];     // scratch: spirits to draw this frame

    // ---------- node construction ----------
    //
    // Three nested elements, each owning exactly one transform
    // concern. This is the structure planets.js arrived at in the Hero,
    // for the same reason: transforms written by different systems at
    // different rates must not share an element, or the last writer
    // each frame silently wins.
    //
    //   .vp-story        placement in the Ether (written every frame)
    //   .vp-story-focus  the come-forward transform (Focus System)
    //   .vp-story-card   the card's own tilt, hover lift, and the
    //                    nearness reveal (CSS, from --vp-prox)
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
      var creator = global.document.createElement('div');
      creator.className = 'vp-story-creator';
      caption.appendChild(title);
      caption.appendChild(creator);

      card.appendChild(cover);
      card.appendChild(caption);
      focusEl.appendChild(card);
      el.appendChild(focusEl);

      var node = {
        el: el, focusEl: focusEl, card: card,
        cover: cover, img: img, title: title, creator: creator,
        entityId: null, coverSrc: null, birthing: false, prox: -1
      };

      // The only thing this layer decides is that a Spirit was
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
      node.creator.textContent = e.creator || '';

      var label = e.title || 'A story';
      if (e.creator) label += ', by ' + e.creator;
      node.el.setAttribute('aria-label', label);

      // Only touch src when it actually changed — reassigning the same
      // URL restarts a decode for nothing, and node reuse makes that an
      // easy accident to have every single frame.
      if (node.coverSrc !== e.cover) {
        node.coverSrc = e.cover;
        if (e.cover) {
          node.img.src = e.cover;
          node.cover.classList.remove('is-blank');
        } else {
          node.img.removeAttribute('src');
          // A Spirit with no cover art is not an error state. It gets
          // the Ether's own light instead — a luminous blank, which is
          // what a story looks like before anyone has seen inside it.
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
      node.prox = -1;
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

      // 1 · a body only for Spirits the Traveller is near. `prox`,
      // `screenX` and `screenY` were computed once this frame by
      // storySpirit.js, wrap and camera already resolved.
      visible.length = 0;
      for (i = 0; i < entities.length; i++) {
        e = entities[i];
        if (e.state === STATES.DORMANT) continue;
        var body = (e.prox || 0) > BODY_THRESHOLD ||
                   e.focusT > 0.001 ||
                   e.state === STATES.BIRTHING;
        if (!body) continue;
        // Off the edge of the screen entirely: nothing to draw even if
        // the maths says it is near.
        if (e.screenX < -margin || e.screenX > ether.viewWidth + margin) continue;
        if (e.screenY < -margin || e.screenY > ether.viewHeight + margin) continue;
        visible.push(e);
      }

      // 2 · if more crowd in than the cap allows, the nearest win.
      if (visible.length > maxNodes) {
        visible.sort(function (a, b) {
          if (b.focusT !== a.focusT) return b.focusT - a.focusT;
          return (b.prox || 0) - (a.prox || 0);
        });
        visible.length = maxNodes;
      }

      // 3 · release nodes whose Spirit is no longer being drawn.
      var still = {};
      for (i = 0; i < visible.length; i++) still[visible[i].id] = true;
      for (var id in assigned) {
        if (!assigned.hasOwnProperty(id)) continue;
        if (!still[id]) { release(assigned[id]); delete assigned[id]; }
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

        // Focus composition. The Spirit's place in the Ether and the
        // place a met Spirit occupies are BLENDED, not swapped — which
        // is the whole of "the Traveller returns to the exact same
        // position". There is no return animation to get wrong: at
        // focusT 0 the Spirit is exactly where the Ether left it,
        // because that is the same expression that drew it a moment
        // ago.
        var t = Util.smooth(e.focusT);
        var x = Util.lerp(e.screenX, centre.x, t);
        var y = Util.lerp(e.screenY, centre.y, t);
        var rot = Util.lerp(e.rotation, 0, t);

        // Birth. The Spirit starts as a point of light and grows into
        // itself as it rises. birthT is written by storyBirth.js.
        var birthing = (e.state === STATES.BIRTHING);
        var born = birthing ? Util.smooth(e.birthT) : 1;
        var base = birthing ? Util.lerp(0.16, e.scale, Util.easeOut(e.birthT)) : e.scale;
        var scale = Util.lerp(base, focusScale(), t);

        var alpha = Util.lerp(e.opacity * born, 1, t);

        var el = node.el;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        el.style.opacity = alpha.toFixed(3);
        el.style.zIndex = String(t > 0.001 ? 3000 : Math.round((e.prox || 0) * 900));

        // ONE number for the whole reveal. runtime.css turns it into
        // the cover fading up, the cover growing, and the name
        // arriving after the picture.
        var prox = birthing ? 1 : (e.prox || 0);
        if (node.prox !== prox) {
          node.prox = prox;
          el.style.setProperty('--vp-prox', prox.toFixed(3));
        }

        node.focusEl.style.transform =
          'rotate(' + rot.toFixed(2) + 'deg) scale(' + scale.toFixed(3) + ')';

        if (birthing) {
          el.classList.add('is-birthing');
          el.style.setProperty('--vp-birth-t', e.birthT.toFixed(3));
        } else if (node.birthing) {
          el.classList.remove('is-birthing');
          el.style.removeProperty('--vp-birth-t');
        }
        node.birthing = birthing;

        if (t > 0.5) el.classList.add('is-focused');
        else el.classList.remove('is-focused');
      }
    }

    // How large a met Spirit becomes. Derived from the field so the
    // same Spirit fills a phone and a laptop equally — a fixed scale
    // would be a postage stamp on one and off the edge on the other.
    function focusScale() {
      var shortest = Math.min(ether.viewWidth, ether.viewHeight);
      return Util.clamp(shortest / 460, 1.25, 2.3);
    }

    // A Spirit removed from the Ether must not leave a live node
    // behind holding its title and its click handler.
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
      // The node belonging to a Spirit, if it currently has one. The
      // Focus System uses this to move keyboard focus onto a met
      // Spirit; nothing else needs it.
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
