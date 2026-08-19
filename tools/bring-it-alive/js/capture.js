/* CAPTURE — one decode, one truth.
 *
 * Everything downstream — segmentation decisions, the refine preview, the
 * exported asset and the byte-identity check — reads from the single
 * ImageData produced here. That is not a convenience: a JPEG has no
 * canonical RGB until it is decoded, so if two parts of the pipeline
 * decoded the photograph independently they could legitimately disagree
 * by a bit and the preservation guarantee would be unfalsifiable. One
 * getImageData call defines "the source pixels" for the whole tool.
 *
 * Perspective is NOT corrected in v0.1, deliberately. A warp resamples
 * every pixel, which would make "the corrected original" the source and
 * the child's photograph something the tool replaced. Until the product
 * needs flat pages more than it needs untouched pixels, the skewed
 * photograph IS the artwork. (If correction ever lands, the brief's rule
 * applies: the corrected image becomes the declared source, and it is
 * said out loud.) Lighting is handled downstream in segment.js on a
 * throwaway decision copy that is never exported.
 */
(function () {
  'use strict';

  /**
   * capture(image) -> Promise<photo>
   * `image` may be a File/Blob (the child's photograph) or a URL string
   * (the test page). The photo object is the source-of-truth handle the
   * rest of the pipeline passes around.
   */
  async function capture(image) {
    let bitmap, filename;
    if (typeof image === 'string') {
      const res = await fetch(image);
      if (!res.ok) throw new Error('capture: could not fetch ' + image);
      bitmap = await createImageBitmap(await res.blob());
      filename = image.split('/').pop();
    } else {
      // Default EXIF handling ('from-image') on purpose: the pixels the
      // child sees in every photo viewer are the pixels we preserve.
      bitmap = await createImageBitmap(image);
      filename = image.name || 'photograph';
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close && bitmap.close();

    // THE one read. 3472×4624 phone photos make this a 64MB buffer; it is
    // the only full-resolution RGBA copy the tool ever holds.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    return {
      filename: filename,
      width: canvas.width,
      height: canvas.height,
      imageData: imageData,
      canvas: canvas // kept for cheap scaled drawing; same pixels
    };
  }

  window.BIACapture = { capture };
})();
