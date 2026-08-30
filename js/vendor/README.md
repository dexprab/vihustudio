# js/vendor — third-party code that ships with the product

The shipped app is hand-written with no build step; anything here is
the deliberate exception, vendored whole so it works offline-of-CDN
and cannot change under us.

| file | what | why it is here |
|---|---|---|
| `bwip-js-min.js` | bwip-js 4.5.1 (MIT, © Mark Warren) — barcode/QR encoder | The Story Card's QR code (Sprint LOOK WHAT I MADE). Loaded LAZILY by `js/storyCardComposer.js` only when a card preview opens — it is ~1 MB and no other screen pays for it. Same file `tools/datamatrix-lab/vendor/` already vendored for the Data Matrix experiment; that experiment's "do not integrate" verdict was about camouflaging a Data Matrix into the Magic Card's art, not about a plain printed QR on a card back, which is exactly what this is. |

License: bwip-js is MIT; the license text is embedded at the top of
the file itself.
