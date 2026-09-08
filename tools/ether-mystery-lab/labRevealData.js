// tools/ether-mystery-lab/labRevealData.js — THE FIRST REVEAL RESEARCH SET.
//
// SPRINT — Shape Lab: Reveal-Only Creature Features (Decision 58).
//
// Six creatures, hand-authored as Shape Lab FIXTURES (the same record
// shape `ShapeLab.importJSON` takes), each with a small set of
// reveal-only features. They exist to answer one question — does a
// temporary reveal-only feature make the completed creature feel
// significantly more magical? — and to find out which of the seven
// generic primitives are sufficient.
//
// THIS IS RESEARCH DATA, NOT A CREATURE LIBRARY. The creature name is
// researcher metadata (`name`), never in a candidate and never read by
// any renderer. Every reveal feature below is one of the SAME seven
// primitives with different numbers: a lion's mane and a mermaid's hair
// are both `contour`, a dragon's horns and an elephant's tusks are both
// `spike`. Nothing here is loaded by the product, nothing here enters
// the production pool, and the Lab page loads this file without doing
// anything with it until *Load research set* is pressed.
//
// Every figure is authored at the PRODUCTION budget of eight so that
// each can also be played in the real Ether preview.

(function (global) {
  'use strict';

  var V = 'shape-lab-1';

  function fx(o) {
    return {
      id: o.id, labVersion: V, name: o.name, budget: 8,
      points: o.points, joins: o.joins, missing: o.missing,
      hint: o.hint || '', notes: o.notes || '', judgement: null, tease: false,
      authoring: { subject: o.name, referenceUsed: false, source: 'fixture' },
      roles: o.roles,
      reveal: { durationS: o.durationS || 4, features: o.features },
      approved: null,
      createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z'
    };
  }

  var FIXTURES = [
    // ---- LION — side on, facing left. Mane around the head (away from
    // the shoulder), a tuft at the tail tip (away from the rump).
    fx({ id: 'shape-reveal-lion', name: 'Lion (reveal set)',
      hint: 'A king of the grasslands is waiting…',
      notes: 'Reveal research: mane (contour around the head) and tail tuft (contour radial at the tail tip).',
      points: [[-1.0, -0.35], [-0.45, -0.5], [0.55, -0.45], [1.2, -0.05], [-0.55, 0.65], [0.55, 0.65], [0.0, 0.05], [-1.3, -0.12]],
      roles: ['HEAD', 'SHOULDER', 'RUMP', 'TAIL TIP', 'FRONT FOOT', 'BACK FOOT', 'BELLY', 'MUZZLE'],
      joins: ['0-1', '1-2', '2-3', '1-4', '2-5', '4-6', '5-6', '0-7'],
      missing: [0, 4],
      features: [
        { id: 'rf-1', name: 'MANE', type: 'contour', anchor: { a: 0, b: 1 }, offset: [0.1, 0], size: 1, angle: 0,
          params: { strands: 11, radius: 0.62, sweep: 310, wave: 0.35, spread: 0.7, mode: 'around' } },
        { id: 'rf-2', name: 'TAIL TUFT', type: 'contour', anchor: { a: 3, b: 2 }, offset: [0, 0], size: 1, angle: 0,
          params: { strands: 6, radius: 0.32, sweep: 130, wave: 0.7, spread: 0.3, mode: 'radial' } }
      ] }),

    // ---- TIGER — side on, tail up. Stripes across the body (between
    // shoulder and rump), markings across the face.
    fx({ id: 'shape-reveal-tiger', name: 'Tiger (reveal set)',
      hint: 'Something striped moves through the tall grass…',
      notes: 'Reveal research: body stripes (lines across shoulder→rump) and facial markings (lines across head→shoulder).',
      points: [[-1.0, -0.25], [-0.5, -0.5], [0.6, -0.45], [1.25, -0.9], [-0.6, 0.7], [0.7, 0.7], [0.05, 0.1], [-1.05, -0.6]],
      roles: ['HEAD', 'SHOULDER', 'RUMP', 'TAIL TIP', 'FRONT FOOT', 'BACK FOOT', 'BELLY', 'EAR'],
      joins: ['0-1', '1-2', '2-3', '1-4', '2-5', '4-6', '5-6', '0-7'],
      missing: [3, 2],
      features: [
        { id: 'rf-1', name: 'BODY STRIPES', type: 'lines', anchor: { a: 1, b: 2 }, offset: [0, 0.18], size: 1, angle: 0,
          params: { count: 9, length: 0.42, tilt: 78, curve: 0.4, taper: 0.75 } },
        { id: 'rf-2', name: 'FACE MARKINGS', type: 'lines', anchor: { a: 0, b: 1 }, offset: [0.05, 0.05], size: 0.75, angle: 0,
          params: { count: 4, length: 0.36, tilt: 60, curve: 0.5, taper: 0.4 } }
      ] }),

    // ---- DRAGON — side on, one wing up. Membranes filling the wing,
    // horns sweeping back from the head, ridges along the spine.
    fx({ id: 'shape-reveal-dragon', name: 'Dragon (reveal set)',
      hint: 'Something old and winged has been sleeping…',
      notes: 'Reveal research: wing membranes (fill membrane, two), horns (spike fanned at the head), spine ridges (spike along neck→rump).',
      points: [[-1.1, -0.5], [-0.6, -0.2], [-0.2, 0.15], [0.45, 0.05], [1.25, 0.5], [0.25, -1.15], [0.95, -0.6], [-0.3, 0.7]],
      roles: ['HEAD', 'NECK', 'CHEST', 'RUMP', 'TAIL TIP', 'WING TIP', 'WING BACK', 'FRONT LEG'],
      joins: ['0-1', '1-2', '2-3', '3-4', '2-5', '5-6', '3-6', '2-7'],
      missing: [4, 0],
      features: [
        { id: 'rf-1', name: 'WING MEMBRANE', type: 'fill', anchor: { a: 5, b: 3 }, offset: [0, 0], size: 1, angle: 0,
          params: { shape: 'membrane', bulge: 0.32, width: 0.8 } },
        { id: 'rf-2', name: 'WING MEMBRANE FRONT', type: 'fill', anchor: { a: 2, b: 5 }, offset: [0, 0], size: 1, angle: 0,
          params: { shape: 'membrane', bulge: 0.28, width: 0.8 } },
        { id: 'rf-3', name: 'HORNS', type: 'spike', anchor: { a: 0, b: 1 }, offset: [-0.05, -0.12], size: 1, angle: -35,
          params: { count: 2, length: 0.62, width: 0.14, curve: 0.45, spread: 26, along: false } },
        { id: 'rf-4', name: 'SPINE RIDGES', type: 'spike', anchor: { a: 1, b: 3 }, offset: [0, -0.06], size: 1, angle: 0,
          params: { count: 6, length: 0.17, width: 0.09, curve: 0.2, spread: 0, along: true } }
      ], durationS: 4.5 }),

    // ---- MERMAID — upright, tail curling away. Hair flowing from the
    // head, a fan of a tail fin, scales along the tail.
    fx({ id: 'shape-reveal-mermaid', name: 'Mermaid (reveal set)',
      hint: 'Someone who sings under the water is waiting…',
      notes: 'Reveal research: flowing hair (contour radial from the head), tail fin (fill fan from the tail bend), scales (texture along waist→tail).',
      points: [[-0.05, -1.1], [0.0, -0.72], [-0.6, -0.35], [0.08, -0.1], [0.0, 0.35], [0.4, 0.8], [0.95, 1.05], [0.3, 1.25]],
      roles: ['HEAD', 'SHOULDERS', 'HAND', 'WAIST', 'HIP', 'TAIL BEND', 'FIN TOP', 'FIN BOTTOM'],
      joins: ['0-1', '1-2', '1-3', '3-4', '4-5', '5-6', '5-7', '6-7'],
      missing: [1, 4],
      features: [
        { id: 'rf-1', name: 'FLOWING HAIR', type: 'contour', anchor: { a: 0, b: 1 }, offset: [0.05, 0.05], size: 1, angle: 150,
          params: { strands: 9, radius: 1.7, sweep: 75, wave: 0.7, spread: 0.4, mode: 'radial' } },
        { id: 'rf-2', name: 'TAIL FIN', type: 'fill', anchor: { a: 5, b: 6 }, offset: [0, 0], size: 1.05, angle: 20,
          params: { shape: 'fan', bulge: 0.55, width: 0.8 } },
        { id: 'rf-3', name: 'SCALES', type: 'texture', anchor: { a: 3, b: 5 }, offset: [0, 0], size: 1, angle: 0,
          params: { rows: 6, cols: 5, dot: 0.04, width: 0.9, height: 0.36 } }
      ] }),

    // ---- ELEPHANT — side on, facing left. Tusks forward from the head,
    // an ear contour, rings along the trunk.
    fx({ id: 'shape-reveal-elephant', name: 'Elephant (reveal set)',
      hint: 'The biggest walker of them all is waiting…',
      notes: 'Reveal research: tusks (spike fanned at the head, forward), ear contour (contour around the ear light), trunk detail (lines across head→trunk tip).',
      points: [[-0.75, -0.45], [-1.15, 0.6], [0.1, -0.7], [0.85, -0.35], [-0.45, 0.8], [0.65, 0.8], [0.1, 0.15], [-0.5, -0.75]],
      roles: ['HEAD', 'TRUNK TIP', 'BACK', 'RUMP', 'FRONT FOOT', 'BACK FOOT', 'BELLY', 'EAR'],
      joins: ['0-1', '0-2', '2-3', '0-4', '3-5', '4-6', '5-6', '0-7'],
      missing: [0, 4],
      features: [
        { id: 'rf-1', name: 'TUSKS', type: 'spike', anchor: { a: 0, b: 2 }, offset: [-0.08, 0.22], size: 1, angle: 165,
          params: { count: 2, length: 0.55, width: 0.06, curve: -0.5, spread: 10, along: false } },
        { id: 'rf-2', name: 'EAR CONTOUR', type: 'contour', anchor: { a: 7, b: 0 }, offset: [0.05, 0], size: 1, angle: 0,
          params: { strands: 3, radius: 0.7, sweep: 250, wave: 0.25, spread: 0.3, mode: 'around' } },
        { id: 'rf-3', name: 'TRUNK DETAIL', type: 'lines', anchor: { a: 0, b: 1 }, offset: [0, 0], size: 1, angle: 0,
          params: { count: 8, length: 0.12, tilt: 90, curve: 0.2, taper: 0.3 } }
      ] }),

    // ---- FALCON — seen from above, wings swept (the Creature Mystery's
    // own figure). Feather texture along each wing, a bright eye.
    fx({ id: 'shape-reveal-falcon', name: 'Falcon (reveal set)',
      hint: 'A hunter of the open sky is waiting…',
      notes: 'Reveal research: feather texture (lines along each wing) and eye detail (glow at the head).',
      points: [[0, -0.7], [0, -0.22], [0, 0.46], [0, 0.95], [-0.52, -0.06], [-1.1, 0.34], [0.52, -0.06], [1.1, 0.34]],
      roles: ['HEAD', 'BODY', 'BELLY', 'TAIL', 'LEFT WING ROOT', 'LEFT WING TIP', 'RIGHT WING ROOT', 'RIGHT WING TIP'],
      joins: ['0-1', '1-2', '2-3', '1-4', '4-5', '1-6', '6-7'],
      missing: [3, 5],
      features: [
        { id: 'rf-1', name: 'LEFT FEATHERS', type: 'lines', anchor: { a: 4, b: 5 }, offset: [0, 0.12], size: 1, angle: 0,
          params: { count: 7, length: 0.42, tilt: 55, curve: 0.3, taper: 0.4 } },
        { id: 'rf-2', name: 'RIGHT FEATHERS', type: 'lines', anchor: { a: 6, b: 7 }, offset: [0, -0.12], size: 1, angle: 0,
          params: { count: 7, length: 0.42, tilt: -55, curve: -0.3, taper: 0.4 } },
        { id: 'rf-3', name: 'EYE', type: 'glow', anchor: { a: 0, b: 1 }, offset: [-0.1, 0.16], size: 1, angle: 0,
          params: { radius: 0.16, intensity: 0.9, pulse: 0.35 } },
        { id: 'rf-4', name: 'OTHER EYE', type: 'glow', anchor: { a: 0, b: 1 }, offset: [-0.1, -0.16], size: 1, angle: 0,
          params: { radius: 0.16, intensity: 0.9, pulse: 0.35 } }
      ] })
  ];

  global.LabRevealData = { fixtures: FIXTURES };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.LabRevealData;
})(typeof window !== 'undefined' ? window : this);
