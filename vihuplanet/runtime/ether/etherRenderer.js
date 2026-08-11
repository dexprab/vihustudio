// etherRenderer.js — the Ether Renderer.
//
// Responsible only for rendering the universe. It draws the space; it
// never draws a story, never moves anything, and never asks what a
// story is. Hand it a different Ether and it paints that instead.
//
// Six procedural layers, back to front:
//
//   1. Background   a vertical wash, deep at the top, cooler below
//   2. Nebula       a handful of huge soft blooms, seeded
//   3. Stars        a paper-cream field; a small subset twinkles
//   4. Mist         three slow banks drifting across each other
//   5. Particles    pooled motes, the dust the universe carries
//   6. Ambient glow one warm swell at the heart of the field
//
//   (+ shooting stars, and the focus veil, drawn last of all)
//
// Not one pixel of it is an image file. There is no background PNG to
// download, to art-direct, to keep in sync across breakpoints, or to
// scale badly on a phone — HERO_CANON.md §9 asks for instant
// appearance and minimal rendering cost, and a procedural universe is
// how a universe meets that.
//
// The four techniques that make this cheap enough to leave running:
//
//   · Layers 1–3 are baked ONCE into an offscreen canvas and blitted
//     as a single drawImage per frame. They only repaint on resize.
//   · Everything soft — nebula, mist, glow, particles, star haloes —
//     is one pre-rendered radial sprite per colour, scaled at draw
//     time. createRadialGradient is expensive; drawImage is not.
//   · The mist and the ambient glow are drawn into a QUARTER-SIZE
//     buffer and scaled up. They are, definitionally, blurs — there
//     is nothing in them a full-resolution pass can express that a
//     sixteenth-resolution one cannot — and they were measured to be
//     the single most expensive thing in the frame before this. That
//     buffer is also only refreshed every third frame, because the
//     banks drift at ~0.03 rad/s and cannot visibly change faster.
//   · Nothing allocates inside the frame loop.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var EtherNS = VihuPlanet.ns('Ether');

  // Star budget per million square pixels of field. Tuned so a laptop
  // sees a generous sky and a phone sees the same sky at the same
  // apparent density, rather than the same COUNT crammed smaller.
  var STAR_DENSITY = 190;
  var STAR_DENSITY_LOW = 130;
  // A floor, not a target. Below roughly this many the field stops
  // reading as a sky and starts reading as an empty box, however small
  // the screen is — density alone does not survive a phone.
  var STAR_FLOOR = 90;
  var TWINKLERS = 34;          // how many of them are alive to the eye
  var TWINKLERS_LOW = 16;

  // The soft layers (mist + ambient glow) render into a buffer this
  // many times smaller on each axis, and refresh this rarely. Both
  // numbers are visual no-ops and together they were the difference
  // between the Ether costing half a frame and costing a fraction of
  // one on a machine without a GPU.
  var SOFT_SCALE = 4;
  var SOFT_INTERVAL = 3;

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  // One soft radial sprite per colour, cached forever. Every soft
  // thing in the Ether is this sprite at a different size and alpha.
  var _blobs = {};
  function blob(color) {
    if (_blobs[color]) return _blobs[color];
    var size = 128;
    var c = global.document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0.00, rgba(color, 1));
    grad.addColorStop(0.42, rgba(color, 0.34));
    grad.addColorStop(1.00, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    _blobs[color] = c;
    return c;
  }

  function drawBlob(ctx, color, x, y, radius, alpha) {
    if (alpha <= 0.002) return;
    var sprite = blob(color);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  }

  EtherNS.createRenderer = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var mount = opts.mount;
    if (!ether || !mount) return null;

    var lowPower = Env.lowPower();
    var reduced = Env.reducedMotion();
    var seed = (typeof opts.seed === 'number') ? opts.seed : Rng.sessionSeed();

    var canvas = global.document.createElement('canvas');
    canvas.className = 'vp-ether-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // The baked layers 1–3.
    var baked = global.document.createElement('canvas');
    var bakedCtx = baked.getContext('2d');

    // The quarter-size buffer that mist and ambient glow live in.
    var soft = global.document.createElement('canvas');
    var softCtx = soft.getContext('2d');

    var stars = [];       // every star, baked
    var twinklers = [];   // the few drawn live on top
    var dpr = 1;
    var frames = 0;

    // ---------- Layer 1–3: bake ----------
    //
    // Called on create and on every resize. Everything here is
    // seeded: the same session regenerates the same sky, so a resized
    // window is the same universe at a different size, not a new one.
    function bake() {
      var w = ether.viewWidth, h = ether.viewHeight;
      var rng = Rng.create(seed);
      var p = ether.palette;

      baked.width = Math.max(1, Math.round(w * dpr));
      baked.height = Math.max(1, Math.round(h * dpr));
      bakedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bakedCtx.clearRect(0, 0, w, h);

      // 1 · Background. Two stops only. Deep ink at the top of the
      // field falling to the cooler shadow-teal below — the same
      // vertical logic as the Hero's sky, inverted for night.
      var bg = bakedCtx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, p.deep);
      bg.addColorStop(0.62, rgba(p.deep, 0.92));
      bg.addColorStop(1, p.near);
      fillField(bg, w, h);

      // 2 · Nebula. Five or six blooms, large, low-alpha, drawn in the
      // Art Direction dusk/cerulean/shadow trio. They are the only
      // thing giving the field a sense of somewhere-ness, so they are
      // biased toward the upper two thirds where the eye lands first.
      // Composited as ADDED LIGHT, not as paint. Drawn with the
      // default source-over these read as flat washes laid on top of
      // the background — the difference between a nebula and a smudge
      // is that a nebula is luminous.
      bakedCtx.globalCompositeOperation = 'lighter';
      var blooms = lowPower ? 4 : 6;
      for (var i = 0; i < blooms; i++) {
        var color = p.nebula[i % p.nebula.length];
        var bx = rng.between(-0.1, 1.1) * w;
        var by = rng.between(-0.05, 0.85) * h;
        var br = rng.between(0.28, 0.62) * Math.max(w, h);
        drawBlob(bakedCtx, color, bx, by, br, rng.between(0.09, 0.20));
      }
      bakedCtx.globalCompositeOperation = 'source-over';
      bakedCtx.globalAlpha = 1;

      // 3 · Stars. Paper-cream, never white — the Hero's palette has
      // no white in it, and a white star field is the single fastest
      // way to make this read as a screensaver instead of a page.
      var area = (w * h) / 1000000;
      var count = Math.round(area * (lowPower ? STAR_DENSITY_LOW : STAR_DENSITY));
      count = Util.clamp(count, STAR_FLOOR, 480);

      stars.length = 0;
      for (var s = 0; s < count; s++) {
        var star = {
          x: rng.next() * w,
          y: rng.next() * h,
          // Mostly pinpricks, occasionally something with presence.
          r: rng.next() < 0.86 ? rng.between(0.5, 1.0) : rng.between(1.1, 1.9),
          a: rng.between(0.22, 0.78),
          phase: rng.between(0, Math.PI * 2),
          speed: rng.between(0.28, 0.72)
        };
        stars.push(star);
        bakedCtx.globalAlpha = star.a;
        bakedCtx.fillStyle = p.star;
        // fillRect for the pinpricks: an arc() + fill() per star is
        // the difference between a free layer and a measurable one,
        // and at one pixel across nobody can tell a disc from a dot.
        if (star.r <= 1) {
          bakedCtx.fillRect(star.x, star.y, star.r * 2, star.r * 2);
        } else {
          bakedCtx.beginPath();
          bakedCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
          bakedCtx.fill();
        }
      }
      bakedCtx.globalAlpha = 1;

      // The live subset. Drawn over the baked field each frame so the
      // sky breathes without repainting four hundred stars.
      twinklers.length = 0;
      var want = Math.min(lowPower ? TWINKLERS_LOW : TWINKLERS, stars.length);
      for (var t = 0; t < want; t++) {
        twinklers.push(stars[Math.floor(rng.next() * stars.length)]);
      }
    }

    // Small helper kept separate so `bake` reads as a list of layers.
    function fillField(style, w, h) {
      bakedCtx.fillStyle = style;
      bakedCtx.fillRect(0, 0, w, h);
    }

    // ---------- Resize ----------
    function resize() {
      var w = ether.viewWidth, h = ether.viewHeight;
      dpr = Env.dpr();
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // The soft buffer is deliberately NOT dpr-scaled. It is a blur;
      // giving it device pixels would be paying full price for the one
      // layer that cannot show the difference.
      soft.width = Math.max(1, Math.ceil(w / SOFT_SCALE));
      soft.height = Math.max(1, Math.ceil(h / SOFT_SCALE));
      frames = 0;    // force a soft refresh on the very next frame

      bake();
    }

    // Mist and ambient glow, at a quarter scale. Cleared and redrawn
    // whole each time: at ~64k pixels that is cheaper than tracking
    // what changed.
    function drawSoft() {
      var w = soft.width, h = soft.height;
      var p = ether.palette;
      var amb = ether.ambient;

      softCtx.setTransform(1, 0, 0, 1, 0, 0);
      softCtx.clearRect(0, 0, w, h);
      softCtx.globalCompositeOperation = 'lighter';

      // 4 · Mist. Three banks on three unrelated phases, each drifting
      // on a lissajous path so no bank ever retraces the last one.
      var mistR = Math.max(w, h) * 0.55;
      for (var m = 0; m < amb.mistPhase.length; m++) {
        var ph = amb.mistPhase[m];
        var mx = w * (0.5 + 0.36 * Math.sin(ph * 0.61 + m * 2.0));
        var my = h * (0.5 + 0.28 * Math.cos(ph * 0.43 + m * 1.3));
        drawBlob(softCtx, p.mist, mx, my, mistR * (0.8 + m * 0.16), 0.045);
      }

      // 6 · Ambient glow — the warmth at the heart of the field. One
      // sprite. It swells over roughly two minutes, which is slow
      // enough that it is felt and never watched.
      drawBlob(softCtx, p.glow, w * 0.5, h * 0.54, Math.max(w, h) * 0.62, 0.05 + amb.glow * 0.06);

      softCtx.globalAlpha = 1;
      softCtx.globalCompositeOperation = 'source-over';
    }

    // ---------- The frame ----------
    function render(dt, time) {
      var w = ether.viewWidth, h = ether.viewHeight;
      var p = ether.palette;
      var amb = ether.ambient;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // 1–3 · one blit. No clearRect first: the baked field is opaque
      // and covers every pixel, so clearing would be a second
      // full-screen pass to prepare for a full-screen overwrite.
      ctx.drawImage(baked, 0, 0, w, h);

      // Everything above the baked field is added light, never
      // painted over it — 'lighter' is what makes mist read as
      // luminous haze rather than as grey paint on top of stars.
      ctx.globalCompositeOperation = 'lighter';

      // 3b · the living stars.
      if (!reduced) {
        ctx.fillStyle = p.star;
        for (var t = 0; t < twinklers.length; t++) {
          var star = twinklers[t];
          // Never fully out and never brighter than its baked self by
          // much: a twinkle is a breath, not a blink.
          var pulse = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase);
          ctx.globalAlpha = star.a * (0.35 + pulse * 0.75);
          ctx.fillRect(star.x, star.y, Math.max(1, star.r * 2), Math.max(1, star.r * 2));
        }
      }

      // 4 + 6 · Mist and ambient glow, in one upscaled blit off the
      // soft buffer. Refreshed every SOFT_INTERVAL frames; drawn every
      // frame, because the buffer persists between refreshes.
      if (frames % SOFT_INTERVAL === 0) drawSoft();
      frames++;
      ctx.globalAlpha = 1;
      ctx.drawImage(soft, 0, 0, w, h);

      // 5 · Particles. Owned and moved by the Ambient System; this
      // only paints them.
      for (var i = 0; i < amb.particles.length; i++) {
        var pt = amb.particles[i];
        if (!pt.alive) continue;
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.warm ? p.glow : p.star;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      }

      // Shooting stars. Rare, distant, and gone before a child can
      // point at them — which is exactly what makes someone keep
      // looking at a sky.
      for (var s = 0; s < amb.shootingStars.length; s++) {
        var sh = amb.shootingStars[s];
        if (!sh.alive) continue;
        var fade = sh.life < 0.2 ? sh.life / 0.2
                 : (sh.life > 0.75 ? (1 - sh.life) / 0.25 : 1);
        ctx.globalAlpha = Util.clamp(fade, 0, 1) * 0.85;
        ctx.strokeStyle = p.spark;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.dx * sh.tail, sh.y - sh.dy * sh.tail);
        ctx.stroke();
        drawBlob(ctx, p.spark, sh.x, sh.y, 9, Util.clamp(fade, 0, 1) * 0.5);
      }

      // The veil. Back to normal compositing: this one IS paint over
      // the top. It never reaches opaque — the universe stays visible
      // and in motion behind a story a child has opened.
      ctx.globalCompositeOperation = 'source-over';
      if (ether.veil > 0.001) {
        ctx.globalAlpha = ether.veil * 0.62;
        ctx.fillStyle = ether.palette.veil;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
    }

    resize();

    return {
      canvas: canvas,
      render: render,
      resize: resize,
      // Exposed for the sandbox's counters; nothing in the runtime
      // reads it.
      stats: function () {
        return { stars: stars.length, twinklers: twinklers.length, dpr: dpr };
      },
      destroy: function () {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        stars.length = 0;
        twinklers.length = 0;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
