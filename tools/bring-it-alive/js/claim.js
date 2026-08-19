/* CLAIM — one loose loop, never called Trace.
 *
 * The child's loop is a POLYGON in image coordinates, and this module's
 * whole job is to turn it into a region: a bitmap of "inside" pixels plus
 * a bounding box. It knows nothing about ink, strokes or masks — the loop
 * is a statement of intent ("the thing I made is in here"), and
 * segment.js decides what that intent means for actual pixels.
 *
 * Rasterisation goes through a canvas polygon fill rather than a
 * hand-rolled scanline: the browser's even-odd fill is exact, fast, and
 * handles the self-crossing loops a six-year-old actually draws.
 */
(function () {
  'use strict';

  /**
   * claim(region, width, height) -> claim object
   * `region` is an array of [x,y] image-space points (the loop as drawn;
   * it is closed implicitly). Returns null for degenerate loops — fewer
   * than 3 points or an area too small to mean anything — so the caller
   * can ask the child to try again instead of segmenting nonsense.
   */
  function claim(region, width, height) {
    if (!region || region.length < 3) return null;

    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(region[0][0], region[0][1]);
    for (let i = 1; i < region.length; i++) ctx.lineTo(region[i][0], region[i][1]);
    ctx.closePath();
    ctx.fill('evenodd');

    const px = ctx.getImageData(0, 0, width, height).data;
    const inside = new Uint8Array(width * height);
    let area = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let i = 0, p = 0; i < inside.length; i++, p += 4) {
      if (px[p + 3] > 127) {
        inside[i] = 1; area++;
        const x = i % width, y = (i / width) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }

    // A claim smaller than ~24×24 source pixels is a tap, not a loop.
    if (area < 576) return null;

    return {
      points: region.map((p) => [Math.round(p[0]), Math.round(p[1])]),
      inside: inside,
      area: area,
      bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    };
  }

  window.BIAClaim = { claim };
})();
