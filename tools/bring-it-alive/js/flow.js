/* FLOW — the one flow, host-agnostic. Bring It Alive runs in TWO hosts:
 * the standalone page (index.html + app.js — the engineering surface the
 * suite pins) and the Studio overlay (js/bringItAliveStudio.js — the
 * child-facing surface). This module is the seam between them: every
 * decision the flow makes — the claim/segment/extract call order, the
 * honest-failure thresholds, the child-facing words for those failures,
 * and the pixel truth of what the claim and refine canvases show — lives
 * HERE exactly once, so the two hosts can never drift apart on anything
 * that matters. What stays in each host is only its own chrome: which
 * buttons exist, what the screen around the canvas looks like, and where
 * the finished creation goes.
 *
 * Nothing in this file touches the pipeline's semantics: every function
 * body was MOVED verbatim from app.js (v0.2), never rewritten — and the
 * suite (test/run-tests.js, 163 checks) driving the standalone page
 * through this module is the proof of that.
 *
 * No DOM ids, no document lookups — a host hands in its own canvases and
 * its own log sink. Pure with respect to host state: claimAndSegment and
 * bringAlive return results and never write into a host's state object.
 */
(function () {
  'use strict';

  // The child-facing honest-failure lines. One vocabulary for both hosts:
  // a loop is never "invalid", a miss is never an "error".
  const MESSAGES = {
    degenerate: 'That loop was too small to hold a drawing — try circling the whole thing.',
    nothing: 'We looked inside your loop and couldn’t find a drawing there. ' +
             'Try circling closer around your drawing.',
    notEnough: 'There isn’t enough drawing left in the claim to bring alive.'
  };

  // ---- display geometry ----------------------------------------------------
  // One display scale for the interactive canvases. The photograph is
  // worked on at full resolution; only its picture on screen is scaled.
  function setupCanvas(canvas, photo, maxW, maxH) {
    const s = Math.min(maxW / photo.width, maxH / photo.height, 1);
    canvas.width = Math.round(photo.width * s);
    canvas.height = Math.round(photo.height * s);
    return { ctx: canvas.getContext('2d'), scale: s };
  }
  // Pointer event → image-space coordinates (canvas CSS size ≠ canvas
  // pixels ≠ photograph pixels; this walks all the way back).
  function toImage(canvas, ev, scale) {
    const r = canvas.getBoundingClientRect();
    return [
      (ev.clientX - r.left) * (canvas.width / r.width) / scale,
      (ev.clientY - r.top) * (canvas.height / r.height) / scale
    ];
  }

  // The claim surface: the photograph, with the loop-so-far in the claim's
  // own soft gold. Returns the display scale it sized the canvas to.
  function drawClaimBase(canvas, photo, loop, maxW, maxH) {
    const { ctx, scale } = setupCanvas(canvas, photo, maxW, maxH);
    ctx.drawImage(photo.canvas, 0, 0, canvas.width, canvas.height);
    if (loop && loop.length > 1) {
      ctx.strokeStyle = '#dfb169'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(loop[0][0] * scale, loop[0][1] * scale);
      for (const p of loop) ctx.lineTo(p[0] * scale, p[1] * scale);
      ctx.stroke();
    }
    return scale;
  }

  // The proposal, live: masked pixels in full colour on white; the rest of
  // the photograph ghosted, so "what comes with me" is unmistakable.
  function drawRefine(canvas, photo, seg, maxW, maxH) {
    const { ctx, scale } = setupCanvas(canvas, photo, maxW, maxH);
    const w = canvas.width, h = canvas.height;
    const out = ctx.createImageData(w, h);
    const src = photo.imageData.data;
    const iw = photo.width, ih = photo.height;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(ih - 1, Math.round(y / scale));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(iw - 1, Math.round(x / scale));
        const si = (sy * iw + sx), s4 = si * 4, d4 = (y * w + x) * 4;
        if (seg.mask[si]) {
          out.data[d4] = src[s4]; out.data[d4 + 1] = src[s4 + 1]; out.data[d4 + 2] = src[s4 + 2];
        } else {
          // ghost: darkened, desaturated original
          const g = (src[s4] * 77 + src[s4 + 1] * 150 + src[s4 + 2] * 29) >> 8;
          out.data[d4] = out.data[d4 + 1] = (g * 0.25 + 20) | 0;
          out.data[d4 + 2] = (g * 0.25 + 34) | 0;
        }
        out.data[d4 + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return scale;
  }

  // ~12 on-screen pixels of Keep/Remove brush, expressed in image pixels —
  // a finger-sized correction whatever the photograph's resolution.
  function brushRadius(scale) {
    return Math.max(10, Math.round(12 / scale));
  }

  // ---- the claim, closed -----------------------------------------------------
  // Loop → claim → segmentation, with both honest-failure outcomes.
  // FOUND NOTHING is a first-class honest outcome — never an empty asset
  // dressed as success. Returns {ok:true, claim, seg} or
  // {ok:false, reason:'degenerate'|'nothing', message} and mutates nothing.
  function claimAndSegment(photo, loop, log) {
    log = log || function () {};
    const cl = BIAClaim.claim(loop, photo.width, photo.height);
    if (!cl) {
      log('claim: degenerate loop rejected');
      return { ok: false, reason: 'degenerate', message: MESSAGES.degenerate };
    }
    log('claim: ' + cl.points.length + ' points, area ' + cl.area + ' px');
    const t0 = performance.now();
    const seg = BIASegment.segment(photo, cl);
    log('segment: ' + seg.compCount + ' ink components, mask ' +
        seg.maskCount + ' px (' + Math.round(performance.now() - t0) + 'ms)');
    if (seg.maskCount < 30) {
      log('segment: NOTHING FOUND inside claim — no asset will be produced');
      return { ok: false, reason: 'nothing', message: MESSAGES.nothing };
    }
    return { ok: true, claim: cl, seg };
  }

  // ---- bring it alive ----------------------------------------------------------
  // Extract → verified baseline export → the layered creation document.
  // The baseline export runs here in BOTH hosts — not to be downloaded,
  // but because its verification walk is the loud preservation check, and
  // it must fire BEFORE the child is told the drawing is theirs.
  // Returns {ok:true, asset, exp, creation} or {ok:false, message}.
  async function bringAlive(photo, seg, claim, opts) {
    opts = opts || {};
    const log = opts.log || function () {};
    const asset = BIAExtract.extract(photo, seg.mask, BIASegment.skirt(seg));
    if (!asset) {
      log('extract: NOTHING FOUND — mask too small, no asset produced');
      return { ok: false, reason: 'notEnough', message: MESSAGES.notEnough };
    }
    const exp = await BIAExportAsset.exportAsset(asset, {
      filename: photo.filename,
      testCaseId: opts.testCaseId || null,
      claimPoints: claim.points
    });
    log('alive: asset ' + asset.crop.w + 'x' + asset.crop.h + ' @(' +
        asset.crop.x + ',' + asset.crop.y + '), ' + exp.verified +
        ' opaque px verified byte-identical, PNG ' + exp.blob.size + ' bytes');
    const creation = BIACreation.create(
      { imageData: asset.imageData, crop: asset.crop, maskPixels: asset.maskLocal },
      { source: { filename: photo.filename,
                  width: photo.width, height: photo.height } });
    log('creation: layered document — original ' + asset.crop.w + '×' + asset.crop.h +
        ' + edits + transform');
    return { ok: true, asset, exp, creation };
  }

  window.BIAFlow = {
    MESSAGES, setupCanvas, toImage, drawClaimBase, drawRefine, brushRadius,
    claimAndSegment, bringAlive
  };
})();
