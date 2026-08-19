/* EXTRACT — the asset is the original pixels times the mask. Nothing else.
 *
 * The one rule that outranks segmentation quality: every opaque pixel of
 * the asset is byte-identical to the photograph. The mask decides WHICH
 * pixels come along; it never decides what they look like. The flattened
 * decision copy from segment.js does not exist here — this module reads
 * only photo.imageData.
 *
 * Two allowed normalisations, both about the mask's SHAPE, not the
 * pixels' values:
 *   · dilate by 2px — pencil strokes have anti-aliased skirts the ink
 *     threshold rightly rejects as "not clearly ink" but the asset
 *     rightly needs, or every stroke gets a shaved edge;
 *   · feather 1px — the outermost ring of the dilated mask ramps its
 *     ALPHA so the cutout doesn't end in a staircase. RGB under the
 *     feather is still the original pixel; only alpha is partial, and
 *     only on that ring. Fully-opaque pixels are untouched by
 *     construction, which is what the suite's zero-tolerance walk checks.
 *
 * THE PAPER HALO, and its v0.2 fix. Unconditional dilation grows every
 * stroke into whatever is next to it — which on paper is paper, so every
 * stroke shipped wearing a 2px rim of fully-opaque paper. The sprint
 * reclassified that rim as a capture artefact, so dilation is now GATED:
 * when the caller supplies a `support` plane (pixels that are at least
 * faintly darker than their local paper — a stroke's anti-aliased skirt),
 * a pixel may join by dilation only if the plane vouches for it. Flat
 * paper never qualifies, so the mask hugs real ink. This changes only
 * WHICH pixels are opaque, never any pixel's value — the preservation
 * rule is untouched. Without `support` the v0.1 behaviour is preserved
 * exactly, which is also how the suite measures the halo drop honestly
 * (both extractions of the same claim, same run).
 *
 * The crop is a bounding box at source resolution — never a rescale.
 */
(function () {
  'use strict';

  /**
   * extract(image, mask, support?) -> asset | null
   * `image` is the photo object from capture(); `mask` a Uint8Array over
   * its pixels; `support` an optional Uint8Array over the same pixels
   * marking which pixels dilation is allowed to add (see header). Returns
   * null when the mask holds too little ink to be a drawing — the caller
   * must treat that as "we found nothing" and say so, never as a tiny
   * successful asset.
   */
  function extract(photo, mask, support) {
    const w = photo.width, h = photo.height;

    let count = 0, minX = w, minY = h, maxX = -1, maxY = -1;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      count++;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    // Fewer than ~30 marked pixels is noise, not a drawing.
    if (count < 30) return null;

    // Pad the crop by 3: room for 2px dilation + 1px feather ring.
    const pad = 3;
    const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
    const cw = Math.min(w - 1, maxX + pad) - cx + 1;
    const ch = Math.min(h - 1, maxY + pad) - cy + 1;

    // Local binary mask in crop space — and a snapshot of it, because the
    // raw (pre-dilation) segmentation mask is part of the layered creation
    // document and must travel with the pixels it selected.
    let local = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) {
      const row = (cy + y) * w + cx;
      for (let x = 0; x < cw; x++) local[y * cw + x] = mask[row + x];
    }
    const rawLocal = new Uint8Array(local);

    // Dilate twice with the 8-neighbourhood (Chebyshev radius 2 ≈ "~2px").
    // With a support plane, only vouched-for pixels may join (the halo fix).
    for (let pass = 0; pass < 2; pass++) {
      const out = new Uint8Array(local);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        if (local[y * cw + x]) continue;
        if (support && !support[(cy + y) * w + (cx + x)]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= ch) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= cw) continue;
            if (local[yy * cw + xx]) { hit = true; break; }
          }
        }
        if (hit) out[y * cw + x] = 1;
      }
      local = out;
    }

    // Alpha: interior of the dilated mask is 255; its 1px boundary ring
    // takes the 3×3 binary mean, giving the soft edge. Nothing outside
    // the dilated mask gets alpha, so the feather never grows the shape.
    const alpha = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      if (!local[i]) continue;
      let sum = 0, n = 0, interior = true;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const inb = yy >= 0 && yy < ch && xx >= 0 && xx < cw;
          const v = inb ? local[yy * cw + xx] : 0;
          if (!v) interior = false;
          sum += v; n++;
        }
      }
      alpha[i] = interior ? 255 : Math.round((sum / n) * 255);
    }

    // Assemble: original RGB under every pixel that carries any alpha.
    const src = photo.imageData.data;
    const out = new ImageData(cw, ch);
    const dst = out.data;
    let opaque = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const li = y * cw + x, a = alpha[li];
        if (!a) continue;
        const si = ((cy + y) * w + (cx + x)) * 4, di = li * 4;
        dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2];
        dst[di + 3] = a;
        if (a === 255) opaque++;
      }
    }

    return {
      imageData: out,
      crop: { x: cx, y: cy, w: cw, h: ch },
      maskPixels: count,
      maskLocal: rawLocal,   // the raw crop-local segmentation mask, for the creation document
      opaquePixels: opaque,
      photo: photo
    };
  }

  window.BIAExtract = { extract };
})();
