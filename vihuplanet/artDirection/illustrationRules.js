// illustrationRules.js — VihuPlanet Art Direction v1.0 (permanent).
//
// This file is the single source of truth for the visual identity
// of VihuPlanet. Every chapter after 2.5 must inherit these rules.
// Refinements are welcome; redefinitions require an explicit Art
// Direction Sprint.
//
// The rules are exported as a data structure so future modules can
// read them at runtime (e.g., a future authoring tool that
// validates a new planet against the discipline).
//
// The v1.0 synthesis:
//   Structure  · Concept C — Living Meadow (landmasses, depth,
//                            environmental storytelling)
//   Emotion    · Concept B — Small Prince's Sky (patience, air,
//                            back-turned companions)
//   Technique  · Concept A — Storybook Page (watercolor, pencil
//                            ink, cream paper, muted palette)

(function (global) {
  'use strict';

  var ArtDirection = {
    version: '1.0',

    // ---------- Palette (permanent) ----------
    palette: {
      paper:            '#F1EAD0',
      horizonApricot:   '#EBB47A',
      skyCerulean:      '#7EB1CE',
      ink:              '#1E2842',
      candle:           '#E8B871',
      moss:             '#7C9C6F',
      ember:            '#E4A455',
      dusk:             '#8E7CB0',
      // Rare — use sparingly (< 20 % of any composition).
      ochreFaded:       '#C3AF88',
      shadow:           '#4C6E76',
      rose:             '#C56B67'
    },

    // Colour usage — the "budget" for a well-composed frame.
    paletteBudget: {
      dominant:   ['paper', 'skyCerulean', 'moss'],
      supporting: ['horizonApricot', 'candle', 'dusk'],
      accent:     ['ember', 'shadow'],
      rare:       ['rose', 'ochreFaded']    // one-emotional-beat use
    },

    // ---------- Line quality ----------
    // Ink outlines are pencil, not marker. Line weight never
    // exceeds 2.0 px at native canvas resolution. Line ends use
    // round caps so nothing on the page feels mechanical.
    lineQuality: {
      colour:      '#1E2842',
      thin:        1.2,
      normal:      1.6,
      heavy:       2.0,
      caps:        'round',
      joins:       'round',
      // Slight inconsistency in stroke width is a feature, not a
      // bug. When authoring by hand, prefer a two- or three-value
      // wobble around each nominal weight.
      allowedWobble: 0.3
    },

    // ---------- Planets ----------
    // Planets are places, not spheres. They are floating landmasses
    // with visible geography. Each planet in Chapter 1/2 carries at
    // least ONE — never more than THREE — distinctive features
    // (Concept B's discipline enforcing Concept C's density).
    planets: {
      shape:               'landmass',     // never a smooth sphere
      geographyPerPlanet:  { min: 1, max: 3 },
      undersideVisible:    true,           // roots, cave mouths, rain
      colourWash:          'watercolor',   // 30–50 % desaturated
      inkOutline:          true,           // pencil hand
      surfaceGeography: [
        // Vocabulary — new planets pick from this palette.
        'a-single-tree',
        'a-cottage',
        'a-lantern-post',
        'a-mountain-peak',
        'a-waterfall-off-the-edge',
        'a-piano-bench',
        'an-easel',
        'a-signpost',
        'a-bridge',
        'a-standing-stone',
        'a-carved-door',
        'a-lone-fence-post'
      ]
    },

    // ---------- Companions ----------
    // Companions are inhabitants who lived here before the Explorer
    // arrived and will continue after they leave. They are not
    // mascots. They rarely face the reader.
    companions: {
      pose: {
        preferred: ['back-turned', 'profile', 'looking-elsewhere'],
        avoid:     ['front-facing-smiling', 'waving-at-reader',
                    'looking-at-cursor', 'over-large-eyes',
                    'oversized-heads', 'mascot-poses']
      },
      // Size relative to their planet's longest side.
      sizeRatio: { min: 0.16, max: 0.32 },
      // Every companion has one activity they are ALREADY doing.
      // The reader arrives INTO their day.
      activityRequired: true,
      // Expression is rare and worth waiting for. A companion may
      // turn to look at the reader — but only after several seconds
      // of ambient life have already passed.
      lookAtReader: { allowed: true, minDwellSeconds: 6, maxPerVisit: 1 }
    },

    // ---------- Sky ----------
    // The sky is a painterly page held in eternal magic hour. Not
    // day, not night — timeless. Warm apricot low, cool cerulean
    // high, cream paper always visible at the edges of the wash.
    sky: {
      timeOfDay: 'timeless-magic-hour',
      gradient:  ['skyCerulean top', 'horizonApricot low'],
      // Clouds have volume. They have shadow undersides. They
      // occasionally pass in front of distant planets.
      clouds: {
        volumetric:              true,
        undersideShadow:         'shadow',    // #4C6E76 at low opacity
        maySeekOccludePlanets:   true,
        driftSpeedSecondsPerVw:  { min: 0.35, max: 0.60 }
      }
    },

    // ---------- Composition & depth ----------
    // Foreground / midground / background always present.
    // Whitespace is part of the design.
    composition: {
      layers: ['foreground', 'midground', 'background', 'sky'],
      // Whitespace budget — v1.0 synthesis lands between B's 65 %
      // discipline and C's 35 % density.
      whitespace: { min: 0.50, target: 0.55, max: 0.65 },
      // Depth is felt through scale + atmospheric opacity, not
      // through parallax tricks.
      atmosphericOpacity: {
        foreground: [1.0, 1.0],
        midground:  [0.85, 1.0],
        background: [0.40, 0.65]
      },
      // At least one foreground element (grass, a signpost, a
      // fence corner) frames the composition.
      foregroundAnchorRequired: true
    },

    // ---------- Motion ----------
    // Motion is what you catch out of the corner of your eye. If
    // the world would keep going with the tab closed, we've done
    // this right.
    motion: {
      style:  'peripheral',
      // Long, slow durations. No object animates faster than a
      // shaft of sunlight moving across a room.
      minDurationSeconds: 4,
      idealDurationSeconds: 12,
      // Nothing bounces. Nothing loops with an obvious rhythm.
      forbidden: ['bounce', 'elastic', 'shake', 'jitter',
                  'synchronised-loops', 'wave-hover',
                  'attention-pull-animation']
    },

    // ---------- Dialogue ----------
    // Never a modal. Never a speech bubble with an arrow. Dialogue
    // is illustrated caption + remembered speech.
    dialogue: {
      surface: 'sky-caption',                // handwriting in the sky
      voice:   'past-tense-third-person',    // "the fox tilted her head"
      companionSpeech: {
        style:    'remembered',              // em-dashes, floating
        marker:   '—',
        italic:   true,
        maxLines: 2
      },
      forbidden: ['modal', 'bubble', 'toast', 'popup', 'tooltip']
    },

    // ---------- Hero prompt ----------
    // The hero prompt evolves into environmental storytelling — a
    // small pencilled caption in the sky, in the same hand as
    // narration. No large UI headline.
    hero: {
      surface:  'sky-caption',
      voice:    'illustrated-narration',
      dominance: 'low',
      opacityAtRest: 0.72
    },

    // ---------- The Explorer's inheritance ----------
    // Rules that describe the whole world's stance toward the
    // Explorer. Read these first when in doubt.
    stance: [
      'The universe existed long before the Explorer arrived.',
      'The universe will continue after they leave.',
      'Companions are independent inhabitants. They are not mascots.',
      'Wonder before action. Observation before interaction.',
      'Curiosity is the only navigation.',
      'Nothing on the page should scream for attention.',
      'A frame with 55 % negative space is a well-composed frame.',
      'If a viewer under nine and a viewer over fifteen both look longer, we\'ve done this right.'
    ]
  };

  try { global.ArtDirection = ArtDirection; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = ArtDirection;
})(typeof window !== 'undefined' ? window : this);
