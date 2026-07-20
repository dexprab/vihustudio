# Gateway Audio

Real click-triggered sound for the Traveller Gateway (`js/gatewaySequence.js` /
`js/gatewayAudio.js`) — VihuPlanet Canon Milestone 1, reworked under the
"Canon Update Sprint — Traveller Gateway Rework V1.1." The Gateway plays on
every launch now, both a first-time Traveller and a Returning Creator
alike — it is not gated on whether a Magic Card is known.

## What's here

Two `.wav` files, both **one-time copies** of already-existing, generically
appropriate sounds from `vihuplanet/assets/audio/` (a separate, disconnected
sibling app/product — see `CLAUDE.md`'s own standing "no cross-product
coupling" decision, unbroken by this copy: there is no live code or asset
*dependency* on that other app, only these two static byte-for-byte file
copies, now owned by this app the same way any other Product Asset is):

- `transition-breeze.wav` — a soft ambient whoosh, used for the Gateway's
  own tap-to-continue affordance.
- `telescope-click.wav` — a gentle chime, reserved for a future click-
  triggered Gateway moment (not yet wired to anything this milestone).

## Discipline

Mirrors `vihuplanet/js/heroAudio.js`'s own proven rule exactly: **no
autoplay, no ambient/looping background music, playback fires only from
inside a real click/keydown handler.** `js/gatewayAudio.js` is the one
module allowed to touch these files.

## A disclosed, standing gap

The Traveller Gateway epic calls for "peaceful music" playing throughout the
whole journey. No real music file can be sourced, composed, or recorded in
this sandbox — so all six scenes play silently except for the one soft
transition sound above. Closing this gap for real needs a human sound
designer; it is not solved by this milestone.
