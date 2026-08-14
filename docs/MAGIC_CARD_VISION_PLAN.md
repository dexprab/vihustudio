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

## How OpenCV.js arrives — decided

**From a CDN, not the repository.** The product owner's call: VihuPlanet
is a hosted experience and is not intended to work offline, so ten
megabytes does not belong in git history forever.

`js/openCv.js` fetches `https://docs.opencv.org/4.10.0/opencv.js` — a
PINNED version, because `4.x` moves and a pipeline tuned against one
build should not silently be handed another. It is requested the moment
the camera opens and deliberately **not waited on**: everything works
without it today, and a ten megabyte download must never stand between
a child and their sky.

Every failure — offline, blocked, slow, a CDN outage, a script that
loads but never initialises — resolves the same way: the promise
rejects, the caller falls back, and Draw Your Stars is untouched. A
timeout is part of that, because a request that hangs is worse than one
that fails: nothing downstream can tell "slow" from "never".

**Disclosed:** the loader has NOT been observed to succeed. This build
environment blocks `docs.opencv.org`, so what is verified is the failure
path — the whole camera flow behaves identically with the CDN
unreachable. The success path needs one run from a machine with open
network.

The cost, stated plainly: recognition by camera now depends on a third
party being reachable. Draw Your Stars does not, which is exactly why it
stays.

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
