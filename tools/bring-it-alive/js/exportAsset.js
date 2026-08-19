/* EXPORT — a transparent PNG at source resolution, verified before it is
 * offered.
 *
 * "Failure must be loud to the developer, never a silently different
 * drawing" — so the export does not trust its own pipeline. After
 * canvas.toBlob produces the PNG, the blob is decoded BACK and every
 * fully-opaque pixel is compared byte-for-byte against the source
 * photograph. A canvas quietly premultiplying alpha, a colour-managed
 * decode, any future "improvement" that touches pixel values — all of
 * them would trip this walk, and the export throws instead of handing
 * over a changed drawing. (Semi-transparent feather pixels are exempt:
 * premultiplied storage legitimately rounds their RGB, which is why the
 * preservation rule confines alpha variation to the 1px feathered edge.)
 *
 * No tEXt chunk: canvas.toBlob offers no way to add one, and re-encoding
 * the PNG by hand just to embed metadata would replace the browser's
 * encoder with ours for zero pixel benefit. The sidecar JSON carries the
 * metadata instead.
 */
(function () {
  'use strict';

  /**
   * exportAsset(asset, meta) -> Promise<{blob, sidecar, verified}>
   * `asset` from extract(); `meta` = {filename, testCaseId, claimPoints}.
   * Throws (loudly) if the encoded PNG does not preserve the source.
   */
  async function exportAsset(asset, meta) {
    const { imageData, crop, photo } = asset;

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;   // source resolution — never scaled
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);

    const blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('exportAsset: toBlob returned null'))),
        'image/png'));

    // THE VERIFICATION WALK. Decode what will actually be downloaded and
    // compare its opaque pixels to the untouched source photograph.
    const bmp = await createImageBitmap(blob);
    const vc = document.createElement('canvas');
    vc.width = bmp.width; vc.height = bmp.height;
    const vctx = vc.getContext('2d', { willReadFrequently: true });
    vctx.drawImage(bmp, 0, 0);
    bmp.close && bmp.close();
    const dec = vctx.getImageData(0, 0, vc.width, vc.height).data;
    const src = photo.imageData.data;

    if (vc.width !== crop.w || vc.height !== crop.h) {
      throw new Error('exportAsset: PNG dimensions ' + vc.width + 'x' + vc.height +
        ' do not match crop ' + crop.w + 'x' + crop.h);
    }
    let walked = 0;
    for (let y = 0; y < crop.h; y++) {
      for (let x = 0; x < crop.w; x++) {
        const di = (y * crop.w + x) * 4;
        if (dec[di + 3] !== 255) continue; // feather ring / transparent
        const si = ((crop.y + y) * photo.width + (crop.x + x)) * 4;
        if (dec[di] !== src[si] || dec[di + 1] !== src[si + 1] || dec[di + 2] !== src[si + 2]) {
          throw new Error('exportAsset: PRESERVATION FAILED at asset(' + x + ',' + y +
            ') source(' + (crop.x + x) + ',' + (crop.y + y) + '): got rgb(' +
            dec[di] + ',' + dec[di + 1] + ',' + dec[di + 2] + ') expected rgb(' +
            src[si] + ',' + src[si + 1] + ',' + src[si + 2] + ')');
        }
        walked++;
      }
    }
    if (!walked) throw new Error('exportAsset: no opaque pixels to verify — refusing to export');

    const sidecar = {
      tool: 'bring-it-alive v0.1',
      exportedAt: new Date().toISOString(),
      source: { filename: meta.filename, width: photo.width, height: photo.height },
      testCaseId: meta.testCaseId || null,
      claim: meta.claimPoints || null,
      crop: crop,
      maskPixels: asset.maskPixels,
      opaquePixelsVerified: walked,
      preservation: 'every fully-opaque pixel byte-identical to source; alpha varies only on the 1px feathered edge'
    };

    return { blob, sidecar, verified: walked };
  }

  window.BIAExportAsset = { exportAsset };
})();
