// registry.js — Chapter 1 World Object registry.
//
// One entry per object that lives in the world today. Each entry
// declares WHERE the object sits, HOW it moves, and WHETHER it
// responds to input. The scene bootstrap (js/scene.js) walks the
// list and mounts each object without any HTML changes. Adding a
// landmark in a future chapter is one more descriptor here.
//
// Motion categories map 1:1 with animations/motion.css:
//   Living      → twinkle / drift / float / breathe / sway /
//                 shadow-breathe / shimmer / wander
//   Greeting    → drawn-in / warm-in / settle
//   Journey     → sail / drift-long
//   Celebration → (empty in Chapter 1)

(function () {
  'use strict';
  if (typeof WorldObject === 'undefined') return;

  // === Ground shape ==================================================
  // Rolling hills span the entire ground layer.
  WorldObject.register({
    id: 'hills',
    label: 'Rolling hills',
    assetHref: 'assets/objects/hills.svg',
    layer: 'ground',
    placement: {
      left: '0', right: '0', top: '0', bottom: '0',
      width: '100%', height: '100%'
    }
    // No motion — the hills are the world's stillness.
  });

  // === Sky landmarks ==================================================
  //
  // Sprint · Story World Identity removed the large sun/moon disc
  // that used to sit top-left: it had no defined role in the
  // universe, competed with the Dreaming Planet, and made the first
  // Story World (which sat right in front of it) read as more
  // important than the others. Not replaced with anything — the sky
  // breathes on its own here now.

  // Stars — hand-authored positions so the constellation feels
  // intentional. Warm amber four-point sparkles per the Contract.
  var stars = [
    { id: 'star-1', top:  '6vh', left: '32vw', size: '28px', duration: '4.6s', delay: '0.0s' },
    { id: 'star-2', top: '15vh', left: '40vw', size: '22px', duration: '5.0s', delay: '1.1s' },
    { id: 'star-3', top:  '8vh', left: '48vw', size: '24px', duration: '4.3s', delay: '2.0s' },
    { id: 'star-4', top: '20vh', left: '58vw', size: '26px', duration: '5.4s', delay: '0.4s' },
    { id: 'star-5', top:  '4vh', left: '64vw', size: '22px', duration: '4.8s', delay: '2.4s' },
    { id: 'star-6', top: '10vh', left: '76vw', size: '26px', duration: '5.1s', delay: '1.4s' },
    { id: 'star-7', top: '28vh', left: '44vw', size: '20px', duration: '5.7s', delay: '2.7s' },
    { id: 'star-8', top: '34vh', left: '20vw', size: '24px', duration: '4.4s', delay: '0.6s' },
    { id: 'star-9', top: '30vh', left: '87vw', size: '22px', duration: '5.3s', delay: '1.9s' }
  ];
  stars.forEach(function (s) {
    WorldObject.register({
      id: s.id,
      label: 'Star',
      assetHref: 'assets/objects/star.svg',
      layer: 'sky',
      placement: { top: s.top, left: s.left, width: s.size, height: s.size },
      motion: { category: 'Living', name: 'twinkle', duration: s.duration, delay: s.delay }
    });
  });

  // Clouds — four cottony puffs across the sky at different heights.
  // Hero MEP Final Polish: drift narrowed to a horizontal-only sway
  // (driftX, a px amplitude within the sprint's 10-20px range) with
  // much slower, per-cloud-distinct durations (40-70s) so no two
  // clouds ever move in step — "almost imperceptible", not four
  // clouds on one rail.
  // width uses CSS min() for cloud-2/cloud-3 only — QA (Playwright,
  // 390/834px viewports) found their fixed px width plus vw-based
  // left position pushed them past the right edge on tablet/mobile.
  // min(Npx, Xvw) is a no-op at desktop/laptop widths (the vw side
  // never wins there) and shrinks gracefully below ~900px — no media
  // query needed, no change to today's desktop appearance.
  // Sprint H4-H6 Part 6 — every width (and the matching vw cap, so
  // the tablet/mobile ceiling shrinks proportionally too) cut ~17%
  // so clouds frame the composition rather than dominating it; top/
  // left placement and the drift motion above are untouched.
  var clouds = [
    { id: 'cloud-1', top:  '9vh', left: '15vw', width: '125px',            duration: '52s', delay:   '0s', driftX: '14px' },
    { id: 'cloud-2', top: '22vh', left: '54vw', width: 'min(158px, 28vw)', duration: '68s', delay: '-19s', driftX: '11px' },
    { id: 'cloud-3', top: '12vh', left: '82vw', width: 'min(116px, 10vw)', duration: '44s', delay: '-31s', driftX: '18px' },
    { id: 'cloud-4', top: '32vh', left: '30vw', width: '133px',            duration: '61s', delay:  '-8s', driftX: '16px' }
  ];
  clouds.forEach(function (c) {
    WorldObject.register({
      id: c.id,
      label: 'Cloud',
      assetHref: 'assets/objects/cloud.svg',
      libraryType: 'cloud',
      layer: 'sky',
      placement: { top: c.top, left: c.left, width: c.width },
      motion: {
        category: 'Living', name: 'drift', duration: c.duration, delay: c.delay,
        params: { '--vp-drift-x': c.driftX }
      }
    });
  });

  // Story Path — Sprint 3 · Story Path & Hero Personality. Replaces
  // the rocket + paper plane's Journey traversal with an ambient,
  // ever-present trail. Never a route between two objects — it fades
  // to nothing at both ends, so it reads as something that's always
  // wandered through the sky rather than a path that goes somewhere.
  // libraryType wires it to World Library's `trails/`; falls back to
  // the hand-drawn SVG trail if empty.
  //
  // The World Library art is a square (2048x2048) canvas with the
  // painted trail sitting in a horizontal band roughly centered
  // vertically (content ~y:564-1483) — not a wide banner image. The
  // wrapper's width:height ratio (78vw : 35vw ≈ 2048:919, the art's
  // own width-to-content-band ratio) plus the `object-fit: cover`
  // override in scene.css crops exactly to that band instead of
  // squashing the whole square (with all its transparent padding)
  // into a small centered patch. `object-fit` doesn't apply to the
  // inline SVG fallback, so that path is unaffected.
  //
  // Sprint · Atmosphere & World Identity turns its visual weight
  // down — smaller footprint (was 90vw x 40vw) and a much lower
  // .shimmer opacity range (motion.css) so it reads as a faint trace
  // wandering stories left behind, never competing with the Story
  // Worlds for attention.
  WorldObject.register({
    id: 'story-path',
    label: 'Story Path',
    assetHref: 'assets/objects/story-path.svg',
    libraryType: 'trail',
    layer: 'sky',
    placement: { top: '8vh', left: '9vw', width: '78vw', height: '35vw' },
    motion: { category: 'Living', name: 'shimmer', duration: '9.5s', delay: '0.5s' }
  });

  // Story Seed — the one seed of imagination wandering the Story
  // Path. A single long, irregular loop (~2.4 min) with two brief
  // holds baked into the keyframe stops, rather than a mechanical
  // back-and-forth, so it never reads as scripted. Negative delay
  // starts it already mid-wander instead of at its literal 0%.
  // libraryType wires it to World Library's `seeds/`; falls back to
  // the hand-drawn SVG seed if empty. Unlike the Story Path, the art
  // here is a compact portrait teardrop already centered in its
  // square canvas — the default object-fit: contain frames it
  // correctly with no override needed.
  WorldObject.register({
    id: 'story-seed',
    label: 'Story Seed',
    assetHref: 'assets/objects/story-seed.svg',
    libraryType: 'seed',
    layer: 'sky',
    placement: { top: '30vh', left: '38vw', width: '30px' },
    motion: { category: 'Living', name: 'wander', duration: '145s', delay: '-40s' }
  });

  // === Ground landmarks ===============================================

  // Flowers — a scatter of daisies along the hills. Living sway so
  // they gently bend as if in a breeze (Sprint 2 · Living World).
  // Hero MEP Final Polish: regrouped from a mechanical every-10vw row
  // into three loose, irregular clusters (a patch a meadow actually
  // grows in) — same six flowers, same rough left-of-hills footprint,
  // only the spacing changed.
  var flowers = [
    { id: 'flower-1', bottom:  '4vh',   left:  '6vw', width: '46px', duration: '5.6s', delay: '0.4s' },
    { id: 'flower-2', bottom:  '6.5vh', left: '12vw', width: '38px', duration: '5.0s', delay: '1.2s' },
    { id: 'flower-3', bottom:  '3vh',   left: '24vw', width: '42px', duration: '5.8s', delay: '0.8s' },
    { id: 'flower-4', bottom:  '5.5vh', left: '30vw', width: '40px', duration: '5.4s', delay: '2.0s' },
    { id: 'flower-5', bottom:  '3.5vh', left: '44vw', width: '36px', duration: '5.2s', delay: '2.6s' },
    { id: 'flower-6', bottom:  '5vh',   left: '49vw', width: '42px', duration: '5.9s', delay: '1.7s' }
  ];
  flowers.forEach(function (f) {
    WorldObject.register({
      id: f.id,
      label: 'Flower',
      assetHref: 'assets/objects/flower.svg',
      libraryType: 'flower',
      layer: 'ground',
      placement: { bottom: f.bottom, left: f.left, width: f.width },
      motion: { category: 'Living', name: 'sway', duration: f.duration, delay: f.delay }
    });
  });

  // Telescope — a visible landmark. Positioned on the right of the
  // hills per the Visual Contract. Shadow-breathe (Sprint 2 · Living
  // World) gives it presence without swaying — it should feel real,
  // not float. libraryType wires it to World Library's `telescope/`
  // folder (Sprint H4-H6 Part 4 — session-varied, same manifest/
  // resolve architecture as every other collection; a Hero Variant
  // Audit found the folder briefly renamed to `telescopes/`, but the
  // automated sync mirrors the source repo's own `telescope/` naming
  // destructively on every run — pointing at a renamed destination
  // folder doesn't survive the next sync, so this stays singular);
  // falls back to the SVG if empty.
  //
  // Sprint H4-H6 Part 3 — now `interactive:true` for hover/click
  // tactile + audio acknowledgment only (see css/scene.css's hover
  // rules and onActivate below) — peering through it at the stars
  // remains a genuinely future feature (`HERO_CANON.md` §8), not
  // implemented by this sprint. onActivate never navigates anywhere.
  WorldObject.register({
    id: 'telescope',
    label: 'Telescope',
    assetHref: 'assets/objects/telescope.svg',
    libraryType: 'telescope',
    layer: 'ground',
    placement: { bottom: '8vh', right: '10vw', width: '130px', height: '162px' },
    motion: { category: 'Living', name: 'shadow-breathe', duration: '7.5s', delay: '0.8s' },
    interactive: true,
    onActivate: function () {
      var el = document.querySelector('.world-object[data-object-id="telescope"]');
      if (el) {
        el.classList.add('is-pressed');
        window.setTimeout(function () { el.classList.remove('is-pressed'); }, 150);
      }
      if (typeof HeroAudio !== 'undefined' && HeroAudio.telescopeClick) HeroAudio.telescopeClick();
    }
  });

  // Story Meadow — Sprint · Atmosphere & World Identity. A foreground
  // ground-level layer with deliberately no local SVG: an empty
  // World Library `nature/story-meadows/` folder means this object
  // resolves to nothing and simply doesn't mount, so today's
  // foreground (Story Worlds + Dreaming Planet) stands exactly as it
  // is until real meadow art exists. Session-varied
  // (shared/worldLibrary.js) once more than one meadow is available,
  // alongside sky and cloud. z-index kept low in scene.css so it can
  // never sit in front of the Story Worlds or Dreaming Planet.
  //
  // Real art landed mid-sprint: a square (2048x2048) canvas with a
  // full-width hills/meadow panorama sitting in a horizontal band
  // centered vertically (content ~y:405-1644) — the same "square
  // canvas, centered content band" shape as the Story Path's trail
  // art. `object-fit: cover` (scene.css) crops in on that band.
  //
  // Height is deliberately capped at 7vh, well under the telescope's
  // `bottom: 8vh` (registered below): .foreground (z-index: 5) always
  // paints above .ground regardless of an object's z-index *within*
  // foreground, so any taller meadow band would visually slice
  // across the telescope's silhouette — not a stacking bug to fix,
  // just a footprint this object needs to stay clear of, since moving
  // it into .ground isn't an option (it would then sit behind Story
  // Worlds too, contradicting "foreground" in the sprint spec).
  WorldObject.register({
    id: 'story-meadow',
    label: 'Story Meadow',
    libraryType: 'story-meadow',
    layer: 'foreground',
    placement: { bottom: '0', left: '0', width: '100vw', height: '7vh' },
    interactive: false
  });
})();
