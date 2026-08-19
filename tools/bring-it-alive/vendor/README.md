# Vendored libraries

## opentype.js 2.0.0 — MIT

`opentype.min.js` is the unmodified UMD build of
[opentype.js](https://github.com/opentypejs/opentype.js) v2.0.0
(`dist/opentype.min.js` from the npm package), vendored here so the
Bring It Alive tool stays self-contained — no CDN, no install step.
License: MIT (see `LICENSE-opentype.js.txt`, the package's own LICENSE
file, verbatim).

It is used by ONE thing: `js/hwFont.js`, to assemble the My Handwriting
font from glyph outlines this tool traced itself. Nothing else loads it.

Two facts a maintainer should know, both discovered by measurement:

- opentype.js writes an OpenType font with CFF (PostScript) outlines —
  the sfnt tag is `OTTO`, not `true`/`\0\1\0\0`. Every browser,
  FontFace, and every modern OS font installer reads it; only the
  file-extension purist is offended by the `.ttf` name on the download.
- `makeHeadTable` stamps `head.modified` with the CURRENT time on every
  build, which would break byte-deterministic rebuilds. `js/hwFont.js`
  pins `createdTimestamp` AND shims `Date` around the one
  `toArrayBuffer()` call, so building twice from the same sheet gives
  identical bytes — asserted by the suite.
