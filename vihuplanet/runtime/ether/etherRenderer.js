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
//     0.40  the aurora — the currents themselves, made visible
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
  // How many of them are alive to the eye. Raised with the rate, and
  // for the same reason: forty-six live stars in a field of six
  // hundred is one in thirteen, which is a sky that has a few moving
  // parts rather than a sky that is moving.
  var TWINKLERS = 96;
  var TWINKLERS_LOW = 48;

  // How far past the view the baked layers extend, so the camera can
  // slide them without an edge appearing. Comfortably more than the
  // camera's reach (~2.5% of the shorter edge) times any parallax a
  // baked layer uses. It is no longer sized against a vertical limit,
  // because there is not one — see blitTiled().
  var BLEED = 72;

  // The soft buffer gets a much larger bleed than the sky, because it
  // is a quarter-resolution blur: 120 view-pixels of margin costs 30
  // buffer-pixels a side. It needs the room because looking up and
  // down moves it further than the sky (parallax 0.30 against 0.18),
  // and a layer that stops before the edge of the screen shows as a
  // dark frame around the universe.
  var SOFT_BLEED = 120;

  // Turning the universe is unbounded on BOTH axes — a full turn of
  // yaw is one field width, a full turn of pitch is one field height,
  // and a child can keep going in either. So every layer drawn as a
  // whole image tiles in x and in y: the offset is reduced into one
  // tile, and the tile is repeated only as far as the view actually
  // reaches. Because a tile is always larger than the view (it carries
  // a bleed on every side) that is one blit in the common case, two
  // when a seam is on screen, and four only in the corner case where
  // both seams are.
  //
  // This used to tile horizontally only, which was correct exactly as
  // long as pitch was clamped. It is not any more: the Ether wraps
  // vertically too (physics.js always did), so the camera does now,
  // and a layer that did not would slide its own edge into view as a
  // hard band across the universe.
  function blitTiled(ctx, img, ox, oy, tw, th, viewW, viewH) {
    var x0 = ox % tw; if (x0 > 0) x0 -= tw;
    var y0 = oy % th; if (y0 > 0) y0 -= th;
    for (var x = x0; x < viewW; x += tw) {
      for (var y = y0; y < viewH; y += th) {
        ctx.drawImage(img, x, y, tw, th);
      }
    }
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
  // Returns HEX, not 'rgb(...)'. It used to return the latter, which
  // was fine for the one thing it did — feed a gradient stop — and
  // silently wrong the moment a mix was nested inside another one:
  // hexToRgb('rgb(43,61,81)') strips a '#' that is not there, parses
  // the rest as base 16, and hands back NaN. The result is not an
  // error, it is a colour, and the only symptom was the field getting
  // DARKER when a stop was made brighter. Hex composes with itself.
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB), out = '#';
    var ch = ['r', 'g', 'b'];
    for (var i = 0; i < 3; i++) {
      var v = Util.clamp(Math.round(a[ch[i]] + (b[ch[i]] - a[ch[i]]) * t), 0, 255);
      out += (v < 16 ? '0' : '') + v.toString(16);
    }
    return out;
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
  // A tiled blit repeats an image edge to edge, which only works if the
  // image's left edge continues its right edge and its top continues
  // its bottom. A blob that runs off one side and does not reappear on
  // the other breaks that: the dark edge of one copy butts against the
  // bright middle of the next and the universe gets a hard line across
  // it. Anything large enough to cross an edge has to be drawn on the
  // opposite side as well — and since the buffer now tiles in both
  // directions, that means the eight neighbours, not the two.
  //
  // Only the copies that would actually land inside the buffer are
  // drawn. A small bloom well inside it still costs exactly one blob,
  // which is nearly all of them; the broad ambient glow, which is wider
  // than the buffer, costs nine and is drawn once every third frame at
  // a quarter of the resolution.
  function drawBlobWrapped(ctx, color, x, y, radius, alpha, spanX, spanY) {
    for (var ix = -1; ix <= 1; ix++) {
      var px = x + ix * spanX;
      if (px + radius < 0 || px - radius > spanX) continue;
      for (var iy = -1; iy <= 1; iy++) {
        var py = y + iy * spanY;
        if (py + radius < 0 || py - radius > spanY) continue;
        drawBlob(ctx, color, px, py, radius, alpha);
      }
    }
  }

  EtherNS.createRenderer = function (opts) {
    opts = opts || {};
    var ether = opts.ether;
    var mount = opts.mount;
    if (!ether || !mount) return null;

    var camera = opts.camera || null;
    var aurora = opts.aurora || null;
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
      //
      // It RETURNS to the top tone at the bottom, and that is not a
      // decoration: this image now tiles vertically, so its last row
      // sits directly above its first. A gradient that ended pale
      // against a dark start is a hard horizontal line drawn across
      // the universe every time a child looks far enough up. Ending
      // where it began costs nothing visually — the tonal range is
      // unchanged, it is simply a band of cooler light that the sky
      // passes through rather than one it stops at — and it makes
      // looking up forever mean something.
      // The deep tone is TWILIGHT VIOLET, not near-black.
      //
      // It used to run toward #070B16, which is very nearly black, and
      // that single choice was most of why the Ether read as outer
      // space rather than as evening. A field whose darkest value has
      // no hue in it cannot feel warm however much light is added on
      // top — the warmth reads as something floating in front of a void
      // rather than as the colour of the place.
      //
      // The luminance is deliberately close to what it replaced. This
      // is a change of HUE, not of brightness: the darks have to stay
      // genuinely dark or the stars stop registering and the nebula
      // stops reading as a shape, which is the failure the previous
      // pass recorded at length below. Warmth is not brightness.
      //
      // It still returns to the top tone at the bottom, because this
      // image tiles vertically — see the note that follows.
      var bg = bakedCtx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, p.twilight);
      bg.addColorStop(0.30, mix(p.deep, p.twilight, 0.34));
      // The cooler band the sky passes through, pulled back toward
      // violet. Shadow-teal at full 0.26 was the single greenest thing
      // in the field and it sat across the middle of every frame; kept
      // as a hint of turquoise inside a violet sky, it does the job it
      // was there for — one band that is not the same temperature as
      // the rest — without setting the temperature of the whole Ether.
      bg.addColorStop(0.62, mix(mix(p.deep, p.near, 0.22), p.twilight, 0.20));
      bg.addColorStop(1, p.twilight);
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
          // Faster than they were, and deliberately so. The previous
          // pass tuned every rate for motion a child notices only
          // after a while; this one is asked for the opposite — the
          // Ether has to say "alive" inside five to ten seconds, and
          // a twinkle whose half-cycle was fourteen seconds said
          // nothing at all in that window. Four to twelve seconds now,
          // which is a breath rather than a blink.
          speed: rng.between(0.52, 1.40)
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
          // Down from 0.13–0.30 for the same reason the mist and glow
          // came down: the buffer wraps on both axes now, so the part
          // of a bloom that used to hang off the top or bottom and be
          // discarded comes back in at the other edge. That is right —
          // it is the same cloud, and it is what makes the sky
          // continuous when a child keeps looking up — but it packs
          // more nebula into a buffer whose alphas were set when a
          // bloom near an edge only counted once.
          alpha: rng.between(0.078, 0.180),
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
      var region = amb.region;
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
            br * lobe.rs, b.alpha * lobe.as * pulse * breath, w, h);
        }
        // A brighter heart. The difference between a cloud of colour
        // and a cloud of colour that has somewhere it is coming from.
        drawBlobWrapped(softCtx, b.color, bx, by, br * 0.30,
          b.alpha * 0.58 * pulse * breath, w, h);
      }

      // Mist — the buffer's own plane, so no internal offset. Scaled by
      // the region, so somewhere in the Ether is softer than here.
      var mistR = span * 0.55;
      for (var m = 0; m < amb.mistPhase.length; m++) {
        var ph = amb.mistPhase[m];
        var mx = w * (0.5 + 0.36 * Math.sin(ph * 0.61 + m * 2.0));
        var my = h * (0.5 + 0.28 * Math.cos(ph * 0.43 + m * 1.3));
        drawBlobWrapped(softCtx, p.mist, mx, my,
          mistR * (0.8 + m * 0.16), 0.0155 * breath * region.mist, w, h);
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
      //
      // Both alphas came down by nearly half when the buffer started
      // wrapping vertically, and that is a correction rather than a
      // retune. These two are the widest things in the buffer — wider
      // than the buffer itself — so most of each one used to hang off
      // the top and bottom and simply be thrown away. Folding it back
      // in is what wrapping means, and it is right; it also meant the
      // field arrived brighter than the numbers were ever tuned for.
      // Measured on the same seed and viewport, the wash took the
      // sky's median luminance from 56 to 70, which is exactly the
      // milky field the paragraph above is a record of. Halved, the
      // darks are back where they belong and nothing about the look
      // changed — there is simply no longer a second helping of haze
      // arriving from off-buffer.
      // The region's warmth scales it, so one part of the Ether is
      // genuinely warmer than another rather than merely differently
      // lit — and stillness gathers it, which is the largest part of
      // how the universe answers a child who has stopped.
      var warmK = region.warmth * (1 + amb.stillness * 0.30);
      drawBlobWrapped(softCtx, p.glow, w * 0.5, h * 0.54, span * 0.62,
        (0.0125 + amb.glow * 0.018) * breath * warmK, w, h);

      // A SECOND warmth, off-centre and on its own slow wander.
      //
      // "There should always be subtle atmospheric glow somewhere in
      // the visible area" — with one glow at the middle of a buffer
      // that tiles, turning far enough put its dark half on screen and
      // the field went cold exactly when a child had gone exploring.
      // Two, at different places and different periods, means the
      // answer is always yes without either of them being bright.
      //
      // Peach rather than gold, so the two do not read as one lamp with
      // a soft edge. It costs one blob in a quarter-resolution buffer
      // that repaints every third frame.
      var wx = w * (0.5 + 0.30 * Math.sin(amb.mistPhase[0] * 0.37 + 1.1));
      var wy = h * (0.5 + 0.26 * Math.cos(amb.mistPhase[2] * 0.29 - 0.4));
      // Deliberately fainter than the gold one it accompanies. Two
      // glows at equal strength is twice the haze, and haze is what
      // stops a star registering — this one exists so that warmth is
      // never entirely off screen, not so that the field is brighter.
      drawBlobWrapped(softCtx, p.warm, wx, wy, span * 0.44,
        (0.0046 + (1 - amb.glow) * 0.0055) * breath * warmK, w, h);

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
    // ---------- the aurora ----------
    //
    // Three strokes per ribbon: a wide faint halo, a middle, and a
    // thin bright heart. That stack is what gives a flat canvas stroke
    // the soft translucent edge an aurora has, and it costs three
    // lines rather than a blur filter — which on a full-screen layer
    // is the single most expensive thing a browser can be asked for.
    //
    // Drawn at FULL resolution, on the main canvas.
    //
    // It went into the quarter-resolution light buffer first, on the
    // reasoning that the four-times upscale would be a free blur and
    // an aurora is nothing but soft edges. That was wrong, and
    // measurably so: the ribbons were provably being drawn — turning
    // their alpha to 0.9 moved the frame's mean brightness by eleven
    // — and still could not be SEEN, because a seven-pixel bright
    // heart smeared across twenty-eight pixels has no edge left, and
    // an aurora with no edge is indistinguishable from the mist it is
    // lying on. Softness is not the same as having no shape.
    //
    // Full resolution costs about three hundred short strokes a frame,
    // which is far less than the full-screen composites either side of
    // it, and it buys the one thing the layer exists for: a curve a
    // child can point at.
    //
    // ONE PATH PER PASS, faded by a gradient along its own length.
    //
    // The fade was first done by stroking each segment separately at
    // its own alpha, and it produced a string of beads: a round cap at
    // both ends of every short segment, each one blended over its
    // neighbour, so a ribbon read as a chain rather than as a curve.
    // Visible immediately once the alpha was turned up to look at it,
    // and invisible at the intended alpha — which is the argument for
    // turning a thing up before believing it is right.
    //
    // A gradient strokeStyle running start-to-end gives the same
    // arrive-and-leave with one stroke, no joins to bead, and a
    // twentieth of the calls.
    function drawAurora(target, time, breath) {
      if (!aurora || !aurora.ribbons.length) return false;
      var p = ether.palette;
      var amb = ether.ambient;
      var cam = camera ? camera.offsetFor(D.aurora) : null;
      // View space, wrapped exactly as the dust is — the ribbons carry
      // themselves across the field and this only has to keep them
      // from sliding away when the universe is turned.
      var ox = wrapOffset(cam ? cam.x : 0, ether.viewWidth + 520);
      var oy = wrapOffset(cam ? cam.y : 0, ether.viewHeight + 520);

      // Stronger where the currents run stronger, and gathering while
      // the Traveller is still — "a distant ribbon becomes more
      // visible" is what the sprint asks stillness to do, and the
      // aurora is now the layer best placed to do it.
      var gain = amb.region.flux * (1 + amb.stillness * 0.55) * breath;

      var n = aurora.points;
      target.lineCap = 'round';
      target.lineJoin = 'round';

      for (var i = 0; i < aurora.ribbons.length; i++) {
        var r = aurora.ribbons[i];
        if (!r.alive) continue;
        // Fades in over its first moments and out over its last, and
        // holds at full strength in between — see aurora.presence().
        var born = aurora.presence(r);
        if (born <= 0.01) continue;
        var colour = p[r.hue] || p.mist;

        var x0 = r.x + ox;
        var x1 = r.x + r.len + ox;

        // Halo · middle · heart.
        for (var pass = 0; pass < 3; pass++) {
          // Wide and faint, then narrower, then a thin bright heart.
          // The heart is what a child actually SEES — the two below it
          // are the glow it sits in — so it carries more than its own
          // alpha and is kept genuinely thin.
          // The "heart" is no longer a bright thread. A thin, high-alpha
          // core is what read as neon — a drawn line rather than light —
          // so it is wider and much dimmer, and the ribbon is now three
          // soft bands rather than a glowing wire in a haze.
          var width = r.thickness * (pass === 0 ? 2.0 : (pass === 1 ? 1.0 : 0.38));
          var strength = (pass === 0 ? 0.30 : (pass === 1 ? 0.50 : 0.78)) * r.alpha * born * gain;
          if (strength <= 0.002) continue;

          // Arrives and leaves. Four stops rather than three so the
          // ribbon is at full strength across its middle instead of
          // peaking at one point, which reads as a ribbon lit along
          // its length rather than as a lamp with a falloff.
          var grad = target.createLinearGradient(x0, 0, x1, 0);
          grad.addColorStop(0.00, rgba(colour, 0));
          grad.addColorStop(0.22, rgba(colour, strength));
          grad.addColorStop(0.74, rgba(colour, strength));
          grad.addColorStop(1.00, rgba(colour, 0));

          target.lineWidth = Math.max(0.6, width);
          target.strokeStyle = grad;
          target.globalAlpha = 1;
          target.beginPath();
          for (var s = 0; s <= n; s++) {
            var u = s / n;
            var x = r.x + u * r.len + ox;
            var y = aurora.heightAt(r, u, time) + oy;
            if (s === 0) target.moveTo(x, y);
            else target.lineTo(x, y);
          }
          target.stroke();
        }
      }
      target.globalAlpha = 1;
      return true;
    }

    function assembleLit(time, breath) {
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
    // `near` lifts the layer's brightness while the Traveller is still.
    // "A few particles drift closer" — they do not actually move
    // toward anybody, which would be the universe reaching for a child;
    // the nearest dust simply becomes a little more present, which
    // reads as the same thing and is honest about what it is.
    function drawDust(target, store, breath, veilFade, near) {
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
        var a = m.alpha * pulse * breath * veilFade * (near || 1);
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
      var region = amb.region;
      var breath = amb.breath;
      var i, cam;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // --- the baked sky. No clearRect first: it is opaque and, with
      // its bleed, covers every pixel at any camera offset.
      cam = camera ? camera.offsetFor(D.farStars) : null;
      var skyTileW = w + BLEED * 2;
      var skyTileH = h + BLEED * 2;
      var skyX = wrapOffset((cam ? cam.x : 0) - BLEED, skyTileW);
      var skyY = wrapOffset((cam ? cam.y : 0) - BLEED, skyTileH);
      blitTiled(ctx, baked, skyX, skyY, skyTileW, skyTileH, w, h);

      // Everything above the sky is added light, never paint over it —
      // 'lighter' is what makes mist read as luminous haze rather than
      // as grey laid on top of stars.
      ctx.globalCompositeOperation = 'lighter';

      // The live star layers ride the same tiles as the baked sky, so
      // they repeat with it rather than sliding across it. Two passes
      // per axis at most, and only when that axis' seam is on screen.
      var skyPassX = (skyX + skyTileW < w) ? 2 : 1;
      var skyPassY = (skyY + skyTileH < h) ? 2 : 1;

      // --- living stars, at the sky's own parallax.
      if (!reduced) {
        ctx.fillStyle = p.star;
        for (var px = 0; px < skyPassX; px++) {
          var tx = skyX + px * skyTileW;
          for (var py = 0; py < skyPassY; py++) {
            var ty = skyY + py * skyTileH;
            for (i = 0; i < twinklers.length; i++) {
              var star = twinklers[i];
              // Never fully out, and never much brighter than its baked
              // self: a twinkle is a breath, not a blink.
              var pulse = 0.5 + 0.5 * Math.sin(time * star.speed + star.phase);
              ctx.globalAlpha = star.a * (0.32 + pulse * 0.80) * breath * region.sparkle;
              ctx.fillRect(star.x + tx, star.y + ty,
                Math.max(1, star.r * 2), Math.max(1, star.r * 2));
            }
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

      // --- the aurora. The Ether Currents, made visible.
      //
      // Above the far dust and below the streaks, at its own depth, so
      // turning the universe moves it by a different amount than
      // either — which is the only thing that makes a flat layer read
      // as being somewhere rather than on the glass.
      drawAurora(ctx, time, breath);

      // --- light currents. The only layer that shows the rivers
      // themselves: a faint mark trailing along the flow it is riding.
      cam = camera ? camera.offsetFor(D.currents) : null;
      var cx = wrapOffset(cam ? cam.x : 0, w + 240);
      var cy = wrapOffset(cam ? cam.y : 0, h + 240);
      ctx.lineCap = 'round';
      // A current in a stronger part of the Ether is more visible, and
      // stillness brings one nearer — "a distant current becomes
      // visible" is the first thing the brief asks the universe to do
      // when a child stops, and this is it.
      var fluxK = region.flux * (1 + amb.stillness * 0.45);
      for (i = 0; i < amb.streaks.length; i++) {
        var s = amb.streaks[i];
        if (!s.alive || s.filled < 2) continue;
        // Fades in and out across its whole life, so a streak is never
        // seen to appear or to stop.
        var fade = Math.sin(s.life * Math.PI);
        var hue = s.hue ? (p[s.hue] || p.star) : (s.warm ? p.glow : p.star);
        ctx.strokeStyle = hue;
        // Segment by segment down the remembered path, each fainter
        // than the last. A wisp that follows the curve the river took,
        // tapering into nothing — not a straight line, which at any
        // visible alpha reads as a scratch on a lens.
        //
        // The WIDTH tapers too, and that is what stops it reading as a
        // drawn stroke: a line of constant thickness fading out is a
        // stroke with an opacity ramp, while one that narrows as it
        // fades is something dispersing. Organic rather than geometric,
        // which is the whole difference between a current and a beam.
        for (var q = 1; q < s.filled; q++) {
          var head = s.pts[q - 1], tail = s.pts[q];
          var along = 1 - (q - 1) / s.pts.length;
          ctx.lineWidth = Math.max(0.4, (s.width || 1) * (0.35 + along * 0.85));
          ctx.globalAlpha = s.alpha * fade * breath * along * fluxK;
          ctx.beginPath();
          ctx.moveTo(head.x + cx, head.y + cy);
          ctx.lineTo(tail.x + cx, tail.y + cy);
          ctx.stroke();
        }
        // A soft head on the line, so it reads as light travelling
        // along the river rather than as a drawn stroke.
        drawBlob(ctx, hue,
          s.pts[0].x + cx, s.pts[0].y + cy, 7 + (s.width || 1) * 5,
          s.alpha * fade * 1.4 * breath * fluxK);
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
      var softTileW = w + SOFT_BLEED * 2;
      var softTileH = h + SOFT_BLEED * 2;
      blitTiled(ctx, soft,
        wrapOffset((mistCam ? mistCam.x : 0) - SOFT_BLEED, softTileW),
        wrapOffset((mistCam ? mistCam.y : 0) - SOFT_BLEED, softTileH),
        softTileW, softTileH, w, h);

      // The aurora and the auras, in view space, once.
      if (assembleLit(time, breath)) {
        ctx.globalAlpha = 1;
        ctx.drawImage(lit, -SOFT_BLEED, -SOFT_BLEED, softTileW, softTileH);
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
        var near = 1 + amb.stillness * 0.38;
        drawDust(frontCtx, amb.dust[2], breath, veilFade, near);
        drawDust(frontCtx, amb.dust[3], breath, veilFade, near);
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
