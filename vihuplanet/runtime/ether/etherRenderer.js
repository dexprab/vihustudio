// etherRenderer.js — the Ether Renderer.
//
// Responsible only for rendering the universe. It draws the space; it
// never draws a story, never moves anything, and never asks what a
// story is. It draws `ether.lights` without knowing that a light
// happens to be a story. Hand it a different Ether and it paints that
// instead.
//
// ---------------------------------------------------------------
// THE LAYER STACK
//
// Every layer has a PARALLAX (ether.depth) and moves by a different
// amount when the Universe Camera drifts. That disagreement is the
// depth — nothing here is drawn larger or hazier to fake distance.
//
//   BEHIND the stories · .vp-ether-canvas
//     0.18  deep gradient + the far star field      (baked)
//     0.18  living stars · star-blooms              (live)
//     0.10  far nebula, each bloom on its own pulse (soft buffer)
//     0.30  mist banks · the ambient glow           (soft buffer)
//     0.34  far dust
//     0.46  light currents — the rivers made visible
//     0.66  mid dust
//     0.20  shooting stars
//     1.00  the light field around every story
//     ----  the focus veil
//
//   IN FRONT of the stories · .vp-ether-foreground
//     1.12  near glowing dust
//     1.58  foreground atmosphere
//
// Two canvases, because a foreground layer drawn on the same canvas
// as the background is not a foreground layer — it is a background
// layer with a higher z-index inside the wrong stacking context. The
// stories are DOM, they sit between the two, and the depth reads
// correctly for it.
// ---------------------------------------------------------------
//
// Not one pixel of any of it is an image file. There is no background
// PNG to download, to art-direct, to keep in sync across breakpoints,
// or to scale badly on a phone.
//
// The techniques that keep it cheap enough to leave running:
//
//   · The gradient and the star field are baked ONCE into an offscreen
//     canvas and blitted as a single drawImage per frame, with a bleed
//     margin so the camera can slide them without exposing an edge.
//   · One pre-rendered radial sprite per colour, scaled at draw time.
//     Every soft thing in the universe is that sprite.
//     createRadialGradient is expensive; drawImage is not.
//   · Nebula, mist and ambient glow share a QUARTER-SIZE buffer
//     refreshed every third frame. They are blurs — there is nothing
//     in them a full-resolution pass can express. Their different
//     parallaxes are applied as offsets INSIDE that buffer, so three
//     depths still cost one blit.
//   · Nothing allocates inside the frame loop.

(function (global) {
  'use strict';

  var VihuPlanet = global.VihuPlanet;
  if (!VihuPlanet) return;

  var Util = VihuPlanet.Util;
  var Env = VihuPlanet.Env;
  var Rng = VihuPlanet.Rng;
  var EtherNS = VihuPlanet.ns('Ether');

  // Star budget per million square pixels of view.
  var STAR_DENSITY = 210;
  var STAR_DENSITY_LOW = 140;
  // A floor, not a target. Below roughly this many the sky stops
  // reading as a sky and starts reading as an empty box, however small
  // the screen is — density alone does not survive a phone.
  var STAR_FLOOR = 110;
  var TWINKLERS = 46;          // how many of them are alive to the eye
  var TWINKLERS_LOW = 22;

  // How far past the view the baked layers extend, so the camera can
  // slide them without an edge appearing. Comfortably more than the
  // camera's reach (~2.5% of the shorter edge) times any parallax a
  // baked layer uses.
  // Sized against the deepest vertical look the camera allows: pitch
  // reaches 0.35 of the viewport, and this layer moves at 0.18 of that.
  var BLEED = 72;

  // The soft buffer gets a much larger bleed than the sky, because it
  // is a quarter-resolution blur: 120 view-pixels of margin costs 30
  // buffer-pixels a side. It needs the room because looking up and
  // down moves it further than the sky (parallax 0.30 against 0.18),
  // and a layer that stops before the edge of the screen shows as a
  // dark frame around the universe.
  var SOFT_BLEED = 120;

  // Turning the universe is unbounded — a full turn of yaw is one
  // field width, and a child can keep turning. So every layer drawn as
  // a whole image tiles horizontally: the offset is reduced into one
  // tile and the image is blitted twice when the seam is on screen,
  // once when it is not. Vertically nothing tiles, because pitch is
  // clamped (camera.js) to less than the bleed can cover.
  function blitTiled(ctx, img, ox, oy, w, h) {
    var start = ox % w;
    if (start > 0) start -= w;
    ctx.drawImage(img, start, oy, w, h);
    if (start + w < ctx.canvas.width) ctx.drawImage(img, start + w, oy, w, h);
  }

  // The same reduction for layers made of individual points (dust,
  // flux lines) that live in view space rather than field space.
  function wrapOffset(v, span) {
    if (!(span > 0)) return v;
    var r = v % span;
    return r > 0 ? r - span : r;
  }

  // The soft layers render into a buffer this many times smaller on
  // each axis, and refresh this rarely. Both are visual no-ops and
  // together they were the difference between the Ether costing half a
  // frame and costing a fraction of one on a machine without a GPU.
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

  // Blend two palette colours. Used so the Ether can have tones
  // BETWEEN its named roles without inventing a colour that is not in
  // Art Direction v1.0 — a mix of ink and shadow-teal is still ink and
  // shadow-teal.
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    return 'rgb(' + Math.round(a.r + (b.r - a.r) * t) + ',' +
                    Math.round(a.g + (b.g - a.g) * t) + ',' +
                    Math.round(a.b + (b.b - a.b) * t) + ')';
  }

  // One soft radial sprite per colour, cached forever.
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
    if (alpha <= 0.002 || radius <= 0.5) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(blob(color), x - radius, y - radius, radius * 2, radius * 2);
  }

  // The same blob, drawn so that the buffer it lands in TILES.
  //
  // A tiled blit repeats an image side by side, which only works if the
  // image's left edge continues its right edge. A blob that runs off
  // one side and does not reappear on the other breaks that: the dark
  // edge of one copy butts against the bright middle of the next and
  // the universe gets a hard vertical line down it. Anything large
  // enough to cross an edge has to be drawn on both sides.
  function drawBlobWrapped(ctx, color, x, y, radius, alpha, span) {
    drawBlob(ctx, color, x, y, radius, alpha);
    if (x - radius < 0) drawBlob(ctx, color, x + span, y, radius, alpha);
    else if (x + radius > span) drawBlob(ctx, color, x - span, y, radius, alpha);
  }

  EtherNS.createRenderer = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var mount = opts.mount;
    if (!ether || !mount) return null;

    var camera = opts.camera || null;
    var lowPower = Env.lowPower();
    var reduced = Env.reducedMotion();
    var seed = (typeof opts.seed === 'number') ? opts.seed : Rng.sessionSeed();
    var D = ether.depth;

    function makeCanvas(cls) {
      var c = global.document.createElement('canvas');
      c.className = cls;
      c.setAttribute('aria-hidden', 'true');
      mount.appendChild(c);
      return c;
    }

    // The back canvas is created here; the front one is appended later
    // by the Universe, after the story layer, so it lands above it in
    // DOM order.
    var canvas = makeCanvas('vp-ether-canvas');
    var ctx = canvas.getContext('2d');
    var front = null, frontCtx = null;

    var baked = global.document.createElement('canvas');
    var bakedCtx = baked.getContext('2d');
    var soft = global.document.createElement('canvas');
    var softCtx = soft.getContext('2d');

    // Everything soft in the universe ends up here, and this is the
    // only buffer that ever reaches the screen. Each frame it takes a
    // copy of `soft` (the slow layers, refreshed every third frame)
    // and adds the story light field (which moves with the stories and
    // cannot be allowed to lag), then goes out in ONE full-screen
    // composite.
    //
    // Both halves of that are measured. Drawn at full resolution the
    // light field alone took the universe from 60fps to 17 on a
    // machine without a GPU — a glow reaching 240px around each of two
    // dozen stories is eight million composited pixels a frame. And
    // blitting the two buffers separately cost a second full-screen
    // 'lighter' pass for nothing: merging them at a quarter scale
    // costs sixty thousand pixels.
    var lit = global.document.createElement('canvas');
    var litCtx = lit.getContext('2d');

    // Two persistent vectors for the two camera offsets the frame
    // holds simultaneously — see the note on camera.offsetFor().
    // Everything else reads its offset and immediately keeps the
    // numbers, which is safe with the shared one.
    var camMistV = { x: 0, y: 0 };
    var camStoryV = { x: 0, y: 0 };

    var stars = [];
    var twinklers = [];
    var nebula = [];       // {color, x, y, r, alpha} — pulsed live
    var dpr = 1;
    var frames = 0;

    // ---------- bake: gradient + the far star field ----------
    function bake() {
      var w = ether.viewWidth + BLEED * 2;
      var h = ether.viewHeight + BLEED * 2;
      var rng = Rng.create(seed);
      var p = ether.palette;

      baked.width = Math.max(1, Math.round(w * dpr));
      baked.height = Math.max(1, Math.round(h * dpr));
      bakedCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bakedCtx.clearRect(0, 0, w, h);

      // Deep ink high, cooler shadow-teal low — the same vertical
      // logic as the Hero's sky, inverted for night.
      //
      // The low stop is a MIX of the two rather than the shadow-teal
      // itself. At full strength that colour turns the bottom of the
      // frame into a pale band that reads as fog on a horizon, and
      // there is no horizon in the Ether — with the nebula and mist
      // now brighter, the darks have to stay genuinely dark or the
      // whole field goes milky and the stars stop registering.
      var bg = bakedCtx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, mix(p.deep, '#070B16', 0.45));
      bg.addColorStop(0.55, mix(p.deep, '#070B16', 0.12));
      bg.addColorStop(1, mix(p.deep, p.near, 0.26));
      bakedCtx.fillStyle = bg;
      bakedCtx.fillRect(0, 0, w, h);

      // Stars are paper-cream, never white — the Hero's palette has no
      // white in it, and a white star field is the single fastest way
      // to make this read as a screensaver instead of a page.
      var area = (w * h) / 1000000;
      var count = Util.clamp(
        Math.round(area * (lowPower ? STAR_DENSITY_LOW : STAR_DENSITY)),
        STAR_FLOOR, 620);

      stars.length = 0;
      for (var s = 0; s < count; s++) {
        var star = {
          x: rng.next() * w,
          y: rng.next() * h,
          // Mostly pinpricks, some with presence, and a rare few that
          // are genuinely bright. A sky where every star is the same
          // magnitude is a texture; a sky with a handful of standouts
          // is somewhere you start finding shapes.
          r: rng.next() < 0.84 ? rng.between(0.5, 1.0)
             : (rng.next() < 0.78 ? rng.between(1.1, 1.9) : rng.between(2.1, 2.9)),
          a: rng.between(0.26, 0.92),
          phase: rng.between(0, Math.PI * 2),
          speed: rng.between(0.22, 0.66)
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

      // The subset drawn live on top, so the sky breathes without
      // repainting six hundred stars.
      twinklers.length = 0;
      var want = Math.min(lowPower ? TWINKLERS_LOW : TWINKLERS, stars.length);
      for (var t = 0; t < want; t++) {
        twinklers.push(stars[Math.floor(rng.next() * stars.length)]);
      }

      // Nebula blooms are described here and drawn live, so each one
      // can carry its own slow pulse — a baked nebula is a painted
      // backdrop, and the universe is not supposed to have one.
      // Blooms are SMALLER than they were, and that was the fix for
      // the field reading as haze. At 0.30–0.68 of the frame every
      // bloom overlapped every other one and the result was a uniform
      // wash — the opposite of structure. Kept tighter, with a
      // brighter core inside each, they read as regions with dark
      // space between them, which is what gives the Ether
      // somewhere-ness rather than atmosphere-ness.
      nebula.length = 0;
      var blooms = lowPower ? 6 : 8;
      for (var i = 0; i < blooms; i++) {
        // Each bloom is three overlapping lobes plus a core, not one
        // sprite. A single radial sprite is a perfect circle however
        // faint it is, and a perfect circle in the sky reads as a lens
        // flare rather than as a cloud. Four quarter-scale sprites per
        // bloom, in a buffer that only repaints every third frame, is
        // what irregularity costs.
        var lobes = [];
        var lobeCount = 2 + rng.int(2);
        for (var q = 0; q < lobeCount; q++) {
          lobes.push({
            dx: rng.spread(0.52),
            dy: rng.spread(0.44),
            rs: rng.between(0.48, 0.92),
            as: rng.between(0.42, 0.85)
          });
        }
        nebula.push({
          color: p.nebula[i % p.nebula.length],
          x: rng.between(-0.10, 1.10),
          y: rng.between(-0.06, 1.02),
          r: rng.between(0.15, 0.40),
          alpha: rng.between(0.13, 0.30),
          lobes: lobes
        });
      }
      ether.ambient.nebulaPulse.length = 0;
      for (var n = 0; n < nebula.length; n++) ether.ambient.nebulaPulse.push(1);
    }

    // ---------- the soft buffer: nebula · mist · ambient glow ----------
    //
    // Three different depths in one buffer. The buffer itself is
    // blitted at the mist's parallax; the other two are offset INSIDE
    // it by the difference, so three layers still cost one blit. The
    // offsets refresh with the buffer rather than every frame, which
    // at this drift rate is a lag of about a pixel and a half on a
    // blur.
    function drawSoft(camOffset) {
      var w = soft.width, h = soft.height;
      var p = ether.palette;
      var amb = ether.ambient;
      var k = 1 / SOFT_SCALE;
      var breath = amb.breath;

      softCtx.setTransform(1, 0, 0, 1, 0, 0);
      softCtx.clearRect(0, 0, w, h);
      softCtx.globalCompositeOperation = 'lighter';

      // Nebula — further away than the buffer's own plane.
      var nx = camOffset ? (camOffset.x * (D.farNebula - D.mist) * k) : 0;
      var ny = camOffset ? (camOffset.y * (D.farNebula - D.mist) * k) : 0;
      var span = Math.max(w, h);
      for (var i = 0; i < nebula.length; i++) {
        var b = nebula[i];
        var pulse = amb.nebulaPulse[i] || 1;
        var bx = b.x * w + nx, by = b.y * h + ny;
        var br = b.r * span;
        for (var q = 0; q < b.lobes.length; q++) {
          var lobe = b.lobes[q];
          drawBlobWrapped(softCtx, b.color,
            bx + lobe.dx * br, by + lobe.dy * br,
            br * lobe.rs, b.alpha * lobe.as * pulse * breath, w);
        }
        // A brighter heart. The difference between a cloud of colour
        // and a cloud of colour that has somewhere it is coming from.
        drawBlobWrapped(softCtx, b.color, bx, by, br * 0.30,
          b.alpha * 0.58 * pulse * breath, w);
      }

      // Mist — the buffer's own plane, so no internal offset.
      var mistR = span * 0.55;
      for (var m = 0; m < amb.mistPhase.length; m++) {
        var ph = amb.mistPhase[m];
        var mx = w * (0.5 + 0.36 * Math.sin(ph * 0.61 + m * 2.0));
        var my = h * (0.5 + 0.28 * Math.cos(ph * 0.43 + m * 1.3));
        drawBlobWrapped(softCtx, p.mist, mx, my,
          mistR * (0.8 + m * 0.16), 0.030 * breath, w);
      }

      // The warmth at the heart of the field.
      //
      // The mist and this glow are both broad and near-uniform, which
      // means they do not add structure — they add HAZE. Measured, the
      // sky was coming out at more than twice the luminance of the ink
      // it is built on, and a washed field is one where the stars stop
      // registering and the nebula stops reading as a shape. Keeping
      // these two quiet is what lets the nebula, which is localised, be
      // the thing that gives the space somewhere-ness.
      drawBlobWrapped(softCtx, p.glow, w * 0.5, h * 0.54, span * 0.62,
        (0.024 + amb.glow * 0.034) * breath, w);

      softCtx.globalAlpha = 1;
      softCtx.globalCompositeOperation = 'source-over';
    }

    // ---------- everything soft, assembled ----------
    //
    // `soft` (mist · nebula · ambient glow) plus the story light
    // field, into one buffer that goes out in one composite. The two
    // sets sit at different depths, so the lights are offset INSIDE
    // the buffer by the difference between their parallax and the
    // buffer's — the same trick the nebula uses in drawSoft().
    function assembleLit(breath) {
      var k = 1 / SOFT_SCALE;
      var p = ether.palette;
      var any = false;

      litCtx.setTransform(1, 0, 0, 1, 0, 0);
      litCtx.globalAlpha = 1;
      litCtx.globalCompositeOperation = 'source-over';
      litCtx.clearRect(0, 0, lit.width, lit.height);
      litCtx.globalCompositeOperation = 'lighter';

      // NOT merged into the soft buffer any more, and not tiled.
      //
      // Merging them saved a full-screen composite and was wrong the
      // moment the universe could be turned: the soft buffer tiles, and
      // a Spirit's aura is in VIEW space — tiling it drew every Spirit's
      // light a second time, a screen-width away from the Spirit it
      // belongs to. Correctness costs one more composite here.
      var ox = 0, oy = 0;

      for (var i = 0; i < ether.lights.length; i++) {
        var l = ether.lights[i];
        if (!l.alive || l.intensity <= 0.004) continue;
        // + SOFT_BLEED, because the buffer's origin is that far
        // outside the view's — see the bleed note in resize().
        var x = (l.x + SOFT_BLEED) * k + ox;
        var y = (l.y + SOFT_BLEED) * k + oy;
        var reach = 128 * l.scale * k;
        // Two blobs: a close warm core, and a much wider, fainter wash
        // that is what actually keeps a lone story from looking
        // abandoned — the near glow belongs to the card, the far one
        // belongs to the Ether around it.
        // "Different stories may have slightly different glow
        // colours" — the Spirit's own hue, chosen from the Ether's
        // palette roles and seeded from its id (storySpirit.js).
        var hue = p[l.hue] || p.glow;
        drawBlob(litCtx, l.warm ? p.spark : hue, x, y, reach, l.intensity * 0.17 * breath);
        drawBlob(litCtx, p.mist, x, y, reach * 1.9, l.intensity * 0.07 * breath);
        any = true;
      }

      litCtx.globalAlpha = 1;
      litCtx.globalCompositeOperation = 'source-over';
      return any;
    }

    // ---------- dust ----------
    function drawDust(target, store, breath, veilFade) {
      var p = ether.palette;
      var cam = camera ? camera.offsetFor(store.parallax) : null;
      // Dust lives in view space and wraps there, so the camera offset
      // is reduced into one span — otherwise turning the universe far
      // enough would carry every mote off the screen and leave the
      // foreground empty.
      var ox = wrapOffset(cam ? cam.x : 0, ether.viewWidth + 140);
      var oy = wrapOffset(cam ? cam.y : 0, ether.viewHeight + 140);

      for (var i = 0; i < store.motes.length; i++) {
        var m = store.motes[i];
        if (!m.alive) continue;
        // Every mote carries its own faint pulse, so no layer is ever
        // perfectly still even when the currents are slack.
        var pulse = 0.72 + 0.28 * Math.sin(m.phase);
        var a = m.alpha * pulse * breath * veilFade;
        var color = m.warm ? p.glow : p.star;
        if (store.soft) {
          drawBlob(target, color, m.x + ox, m.y + oy, m.size, a);
        } else {
          target.globalAlpha = a;
          target.fillStyle = color;
          target.fillRect(m.x + ox, m.y + oy, m.size, m.size);
        }
      }
    }

    // ---------- the frame ----------
    function render(dt, time) {
      var w = ether.viewWidth, h = ether.viewHeight;
      var p = ether.palette;
      var amb = ether.ambient;
      var breath = amb.breath;
      var i, cam;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // --- the baked sky. No clearRect first: it is opaque and, with
      // its bleed, covers every pixel at any camera offset.
      cam = camera ? camera.offsetFor(D.farStars) : null;
      var skyTile = w + BLEED * 2;
      var skyX = wrapOffset((cam ? cam.x : 0) - BLEED, skyTile);
      var skyY = (cam ? cam.y : 0) - BLEED;
      blitTiled(ctx, baked, skyX, skyY, skyTile, h + BLEED * 2);

      // Everything above the sky is added light, never paint over it —
      // 'lighter' is what makes mist read as luminous haze rather than
      // as grey laid on top of stars.
      ctx.globalCompositeOperation = 'lighter';

      // The live star layers ride the same tiles as the baked sky, so
      // they repeat with it rather than sliding across it.
      var skyPass = (skyX + skyTile < w) ? 2 : 1;

      // --- living stars, at the sky's own parallax.
      if (!reduced) {
        ctx.fillStyle = p.star;
        for (var pass = 0; pass < skyPass; pass++) {
          var tx = skyX + pass * skyTile;
          for (i = 0; i < twinklers.length; i++) {
            var star = twinklers[i];
            // Never fully out, and never much brighter than its baked
            // self: a twinkle is a breath, not a blink.
            var pulse = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase);
            ctx.globalAlpha = star.a * (0.32 + pulse * 0.80) * breath;
            ctx.fillRect(star.x + tx, star.y + skyY,
              Math.max(1, star.r * 2), Math.max(1, star.r * 2));
          }
        }
      }

      // --- star-blooms: one star somewhere quietly swelling and
      // fading. Small, frequent, and almost never actually caught.
      for (i = 0; i < amb.starBlooms.length; i++) {
        var bloom = amb.starBlooms[i];
        if (!bloom.alive) continue;
        var swell = Math.sin(bloom.life * Math.PI);   // in and back out
        drawBlob(ctx, bloom.warm ? p.glow : p.star,
          bloom.x + skyX, bloom.y + skyY,
          bloom.radius * (0.6 + swell * 0.7), swell * 0.30 * breath);
      }

      // --- far dust.
      drawDust(ctx, amb.dust[0], breath, 1);

      // --- light currents. The only layer that shows the rivers
      // themselves: a faint mark trailing along the flow it is riding.
      cam = camera ? camera.offsetFor(D.currents) : null;
      var cx = wrapOffset(cam ? cam.x : 0, w + 240);
      var cy = wrapOffset(cam ? cam.y : 0, h + 240);
      ctx.lineCap = 'round';
      for (i = 0; i < amb.streaks.length; i++) {
        var s = amb.streaks[i];
        if (!s.alive || s.filled < 2) continue;
        ctx.lineWidth = s.width || 1;
        // Fades in and out across its whole life, so a streak is never
        // seen to appear or to stop.
        var fade = Math.sin(s.life * Math.PI);
        ctx.strokeStyle = s.warm ? p.glow : p.star;
        // Segment by segment down the remembered path, each fainter
        // than the last. A wisp that follows the curve the river took,
        // tapering into nothing — not a straight line, which at any
        // visible alpha reads as a scratch on a lens.
        for (var q = 1; q < s.filled; q++) {
          var head = s.pts[q - 1], tail = s.pts[q];
          ctx.globalAlpha = s.alpha * fade * breath * (1 - (q - 1) / s.pts.length);
          ctx.beginPath();
          ctx.moveTo(head.x + cx, head.y + cy);
          ctx.lineTo(tail.x + cx, tail.y + cy);
          ctx.stroke();
        }
        // A soft head on the line, so it reads as light travelling
        // along the river rather than as a drawn stroke.
        drawBlob(ctx, s.warm ? p.glow : p.star,
          s.pts[0].x + cx, s.pts[0].y + cy, 7 + (s.width || 1) * 5,
          s.alpha * fade * 1.4 * breath);
      }

      // --- mid dust.
      drawDust(ctx, amb.dust[1], breath, 1);

      // --- shooting stars, out among the stars.
      cam = camera ? camera.offsetFor(0.2) : null;
      var sx = cam ? cam.x : 0, sy = cam ? cam.y : 0;
      for (i = 0; i < amb.shootingStars.length; i++) {
        var shot = amb.shootingStars[i];
        if (!shot.alive) continue;
        var f = shot.life < 0.2 ? shot.life / 0.2
              : (shot.life > 0.75 ? (1 - shot.life) / 0.25 : 1);
        f = Util.clamp(f, 0, 1);
        ctx.globalAlpha = f * 0.85;
        ctx.strokeStyle = p.spark;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(shot.x + sx, shot.y + sy);
        ctx.lineTo(shot.x - shot.dx * shot.tail + sx, shot.y - shot.dy * shot.tail + sy);
        ctx.stroke();
        drawBlob(ctx, p.spark, shot.x + sx, shot.y + sy, 9, f * 0.5);
      }

      // --- nebula · mist · ambient glow · the light field, in one
      // full-screen composite.
      //
      // It is drawn here, after the dust, rather than under it — and
      // that is not a compromise. Every layer above the baked sky is
      // composited with 'lighter', and addition is commutative: the
      // result is identical whichever order these go in. The only
      // layer whose position in the sequence matters is the veil,
      // which is paint rather than light, and it is still last.
      //
      // One story alone should never look abandoned. This is the layer
      // where the space around it answers.
      var mistCam = camera ? camera.offsetFor(D.mist, camMistV) : null;
      var storyCam = camera ? camera.offsetFor(D.stories, camStoryV) : null;
      if (frames % SOFT_INTERVAL === 0) drawSoft(mistCam);
      frames++;
      ctx.globalAlpha = 1;
      var softTile = w + SOFT_BLEED * 2;
      blitTiled(ctx, soft,
        wrapOffset((mistCam ? mistCam.x : 0) - SOFT_BLEED, softTile),
        (mistCam ? mistCam.y : 0) - SOFT_BLEED,
        softTile, h + SOFT_BLEED * 2);

      // The auras, in view space, once.
      if (assembleLit(breath)) {
        ctx.globalAlpha = 1;
        ctx.drawImage(lit, -SOFT_BLEED, -SOFT_BLEED, softTile, h + SOFT_BLEED * 2);
      }

      // --- the Spirit's core.
      //
      // The halo above is a quarter-resolution blur, which is right for
      // a glow and wrong for a soul: blurred across four pixels there
      // is nothing at the middle of it to see, and a Story Spirit seen
      // from across the universe was reading as a faint card rather
      // than as a light. So each one also gets a small, bright, crisp
      // core at full resolution. Small is what makes it affordable —
      // thirty cores at eighteen pixels is forty thousand pixels, next
      // to nothing, and it is the difference between a gallery of
      // floating cards and a universe with souls in it.
      for (i = 0; i < ether.lights.length; i++) {
        var core = ether.lights[i];
        if (!core.alive || core.intensity <= 0.004) continue;
        var ck = 9 + core.scale * 9;
        drawBlob(ctx, core.warm ? p.spark : (p[core.hue] || p.glow),
          core.x + (storyCam ? storyCam.x : 0), core.y + (storyCam ? storyCam.y : 0),
          ck, Util.clamp(core.intensity * 0.62, 0, 0.85) * breath);
      }

      // --- the veil. Back to normal compositing: this one IS paint on
      // top. It never reaches opaque — the universe stays visible and
      // in motion behind a story a child has opened.
      ctx.globalCompositeOperation = 'source-over';
      if (ether.veil > 0.001) {
        ctx.globalAlpha = ether.veil * 0.62;
        ctx.fillStyle = p.veil;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;

      // ---------- in front of the stories ----------
      if (frontCtx) {
        frontCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        frontCtx.clearRect(0, 0, w, h);
        frontCtx.globalCompositeOperation = 'lighter';
        // The foreground recedes with the veil too, or a focused story
        // would be read through dust that had not dimmed with the rest
        // of the universe.
        var veilFade = 1 - ether.veil * 0.72;
        drawDust(frontCtx, amb.dust[2], breath, veilFade);
        drawDust(frontCtx, amb.dust[3], breath, veilFade);
        frontCtx.globalAlpha = 1;
      }
    }

    // ---------- resize ----------
    function sizeCanvas(c, cx, w, h) {
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resize() {
      var w = ether.viewWidth, h = ether.viewHeight;
      dpr = Env.dpr();
      sizeCanvas(canvas, ctx, w, h);
      if (front) sizeCanvas(front, frontCtx, w, h);

      // The soft buffer is deliberately NOT dpr-scaled. It is a blur;
      // giving it device pixels would be paying full price for the one
      // layer that cannot show the difference.
      // The soft buffers carry the same bleed as the baked sky, and
      // for the same reason: they are drawn at a camera offset, and a
      // buffer exactly the size of the view leaves an uncovered band
      // along whichever edges the camera has moved away from. That
      // band shows as a dark frame around the whole universe — the
      // mist and nebula simply stop before the edge of the screen.
      soft.width = Math.max(1, Math.ceil((w + SOFT_BLEED * 2) / SOFT_SCALE));
      soft.height = Math.max(1, Math.ceil((h + SOFT_BLEED * 2) / SOFT_SCALE));
      lit.width = soft.width;
      lit.height = soft.height;
      frames = 0;    // force a soft refresh on the very next frame

      bake();
    }

    resize();

    return {
      canvas: canvas,
      render: render,
      resize: resize,

      // Called by the Universe after the story layer exists, so the
      // foreground canvas lands above it in DOM order. Depth is
      // stacking as much as it is parallax.
      attachForeground: function () {
        if (front) return front;
        front = makeCanvas('vp-ether-foreground');
        frontCtx = front.getContext('2d');
        sizeCanvas(front, frontCtx, ether.viewWidth, ether.viewHeight);
        return front;
      },

      stats: function () {
        return { stars: stars.length, twinklers: twinklers.length, nebula: nebula.length, dpr: dpr };
      },

      destroy: function () {
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        if (front && front.parentNode) front.parentNode.removeChild(front);
        stars.length = 0;
        twinklers.length = 0;
        nebula.length = 0;
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
