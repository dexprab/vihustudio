# Reading a Magic Card — where this stands, and what comes next

## The decision

Hand-written computer vision is done. It got a long way and then stopped
converging: every fix revealed the next fault, and each was a heuristic
tuned against synthetic images that turned out not to resemble a real
camera. The remaining work uses **OpenCV.js** for detection and
rectification, and **ArUco-style fiducial markers** on the card.

Scope, exactly:

- The marker is used ONLY to find the card, extract its corners and
  correct perspective.
- **The marker does not identify the Creator.** Once the card is
  rectified, the Creator is recognised from the constellation, exactly
  as now. The card's stars remain the identity.
- The marker must be **visually integrated into the artwork** and must
  never read as a QR code or an authentication token.
- **Draw Your Stars stays** as the fallback, unchanged.

## The hard acceptance criterion — already implemented

> Never open a Creator's Sky on an uncertain match. A false negative is
> acceptable; a false positive is not.

`MagicCardVision.identify()` refuses on any doubt, of three kinds:

- **too loose** — the best match is not close enough to be the same
  constellation, only the nearest one present;
- **too close to call** — the best and second best are nearly as good as
  each other, so the picture does not actually choose between them.
  Siblings on one device is the ordinary case, and "nearly both" must
  never resolve to "the first one";
- anything that cannot be stated positively.

A refusal is never a dead end: the reading still goes to the board,
where the child confirms it and the EXACT match runs. Strictness costs
a tap, not a way in.

Verified, with four cards on one device: each real card opens its own
sky; a sky nobody owns, a card the device does not hold, and random
bright dots are all refused.

## What is needed before the OpenCV work can start

`opencv.js` cannot be fetched from the build environment — the proxy
refuses `docs.opencv.org` with a 403 — so **the file has to be vendored
into the repository** (`vendor/opencv.js`, ~8 MB WASM). Nothing else is
blocked.

## The shape of the work, once it is there

1. **Vendor and load lazily.** 8 MB must not be on the path of a child
   who never opens the camera. Load it when Show Me Your Stars is
   pressed, and fall back to Draw Your Stars if it fails.
2. **Design the marker into the art.** Four corner ornaments carrying a
   known geometry — a flourish, not a black square. It only has to be
   findable, not decodable, since it identifies nothing.
3. **Detect and rectify.** `adaptiveThreshold` → `findContours` →
   `approxPolyDP` for the quads, then `warpPerspective` onto a square.
   This replaces `_frame`, `_quad`, `_homography` and the tilt/lean
   guessing outright.
4. **Read the rectified card.** On a square, undistorted image the grid
   is fixed geometry and a star's cell is arithmetic. Most of
   `magicCardVision.js` disappears at this point.
5. **Keep recognition where it is.** `CreatorRecognition.recognise()`
   and the exact match are untouched.

## Not in this work

Parent-email recovery (Sprint VP4) stays as designed and is not added to
the camera flow. Make `Show Me Your Stars → hold card → recognition →
Sky` solid first, then test it with real children and real cards.
