// ETHER CREATURE TRANSLATION — the constructed research set. LAB ONLY.
//
// Five hand-written blueprints, each carrying an `etherInterpretation`,
// for judging the translation layer (labBlueprint.js) where no model can
// be reached. Every one is labelled CONSTRUCTED wherever it shows — on
// the panel, in the trace, in the source line — and is never called a
// fixture (the fixture is ONE generic body plan) and never called
// generated (nothing here came from a model). They go through the real
// validator on the way in: a constructed blueprint that would not
// validate is refused exactly like a model's.
//
// What they are for: the four-way comparison the sprint asks for, per
// creature — A the literal blueprint (features, importance, budgets),
// B the literal outline the composer draws from it, C the Ether
// interpretation (art direction in words), D the suggested structure the
// ranking produces WITH the interpretation against the literal one.
//
// What they are not: a species library, a taxonomy, a creature engine.
// There are five entries because the brief named five subjects; a sixth
// is a sixth entry, and nothing in the Lab reads the entries by name.
// Nothing here is geometry the runtime performs: anchors are where a
// feature sits on the REFERENCE, in the editor's own unit space, and the
// interpretation holds not one number by construction.
(function (global) {
  'use strict';

  var creatures = [
    {
      id: 'tr-lion', subject: 'Lion',
      blueprint: {
        subject: 'Lion',
        silhouette: 'Side view, standing; a heavy forequarter under a round mass of mane, a long level back, a tail carried low with a tuft at its end.',
        features: [
          { name: 'MANE', importance: 3, why: 'The one mass nothing else has; the head disappears into it.', anchor: [-0.75, -0.45] },
          { name: 'HEAD', importance: 3, why: 'Broad and square, set low in the mane, looking forward.', anchor: [-0.95, -0.35] },
          { name: 'BODY', importance: 3, why: 'A long level back from the mane to the haunch.', anchor: [0.15, -0.05] },
          { name: 'FRONT LEGS', importance: 2, why: 'Thick, straight, planted under the mane.', anchor: [-0.5, 0.75] },
          { name: 'HIND LEGS', importance: 2, why: 'Angled, under a lower haunch.', anchor: [0.65, 0.75] },
          { name: 'TAIL', importance: 2, why: 'Long, hanging, with a tuft that names it.', anchor: [1.1, 0.25] },
          { name: 'TAIL TUFT', importance: 1, why: 'A dark brush at the very end of the tail.', anchor: [1.2, 0.7] },
          { name: 'MUZZLE', importance: 1, why: 'A short square muzzle at the front of the head.', anchor: [-1.15, -0.25] }
        ],
        budgets: {
          '8': ['MANE', 'HEAD', 'BODY', 'FRONT LEGS', 'HIND LEGS', 'TAIL'],
          '12': ['MANE', 'HEAD', 'BODY', 'FRONT LEGS', 'HIND LEGS', 'TAIL', 'TAIL TUFT', 'MUZZLE'],
          '16': ['MANE', 'HEAD', 'BODY', 'FRONT LEGS', 'HIND LEGS', 'TAIL', 'TAIL TUFT', 'MUZZLE'],
          '20': ['MANE', 'HEAD', 'BODY', 'FRONT LEGS', 'HIND LEGS', 'TAIL', 'TAIL TUFT', 'MUZZLE']
        },
        reveal: [
          { name: 'MANE', kind: 'contour', near: 'HEAD' },
          { name: 'TAIL TUFT', kind: 'spike', near: 'TAIL' },
          { name: 'EYES', kind: 'glow', near: 'HEAD' }
        ],
        etherInterpretation: {
          character: ['heavy', 'proud', 'watchful', 'ancient'],
          gesture: 'Standing still and looking straight ahead, the whole weight carried in the front, as if it has not decided whether to move.',
          architecture: [
            'The mane is the largest mass and the head is inside it, not in front of it.',
            'The back is one long line running level from the top of the mane to the haunch, and it is the longest single line in the figure.',
            'The legs are short drops under a long body; the front pair stands straighter than the hind pair.',
            'The tail leaves the haunch low and falls, then turns up a little at the tuft.'
          ],
          proportion: [
            { feature: 'MANE', treat: 'exaggerate', note: 'Make it wider than seems right; in a few lights it is what says lion.' },
            { feature: 'HEAD', treat: 'compress', note: 'The head can almost vanish into the mane.' },
            { feature: 'BODY', treat: 'keep', note: 'The long back is the calm in the figure.' },
            { feature: 'MUZZLE', treat: 'compress', note: 'A single light is enough, or none.' }
          ],
          diagnostic: ['MANE', 'BODY', 'TAIL', 'HEAD'],
          abstraction: {
            stance: 'do-not-draw-literally',
            doNot: ['the mane as hair or texture', 'a face', 'claws or paws', 'the muscle of the shoulders'],
            instead: ['the mane as one wide round mass of lights standing off the line of the back', 'the head as the point where the back meets the mane', 'one long level back line as the calm of the figure']
          },
          rhythm: 'Dense and round at the front, then one long open line, then a small fall at the tail; the empty space under the belly is as much the lion as the mane is.',
          movement: 'Would move slowly and heavily, the head level, the mane shifting a little with each step, the tail swinging late behind.',
          structural: ['MANE', 'HEAD', 'BODY', 'FRONT LEGS', 'HIND LEGS', 'TAIL'],
          revealOnly: ['TAIL TUFT', 'MUZZLE', 'EYES']
        }
      }
    },
    {
      id: 'tr-tiger', subject: 'Tiger',
      blueprint: {
        subject: 'Tiger',
        silhouette: 'Side view, low and long, walking; a level back with the head carried slightly below the shoulder line, a long tail held straight out behind.',
        features: [
          { name: 'BODY', importance: 3, why: 'Long, low and level; the tiger is a line more than a mass.', anchor: [0.1, -0.05] },
          { name: 'HEAD', importance: 3, why: 'Round, carried low and forward, on a thick short neck.', anchor: [-1.0, -0.2] },
          { name: 'TAIL', importance: 3, why: 'Very long, held straight out or in a low curve.', anchor: [1.15, -0.15] },
          { name: 'FRONT LEGS', importance: 2, why: 'Reaching forward in the walk.', anchor: [-0.55, 0.75] },
          { name: 'HIND LEGS', importance: 2, why: 'Pushing, angled back.', anchor: [0.6, 0.75] },
          { name: 'ROUND EARS', importance: 2, why: 'Two small round ears on top of the head.', anchor: [-1.0, -0.5] },
          { name: 'STRIPES', importance: 2, why: 'What every child names first, and what no line can draw.', anchor: [0.1, -0.2] },
          { name: 'MUZZLE', importance: 1, why: 'Short and square.', anchor: [-1.2, -0.1] }
        ],
        budgets: {
          '8': ['BODY', 'HEAD', 'TAIL', 'FRONT LEGS', 'HIND LEGS', 'ROUND EARS'],
          '12': ['BODY', 'HEAD', 'TAIL', 'FRONT LEGS', 'HIND LEGS', 'ROUND EARS', 'MUZZLE'],
          '16': ['BODY', 'HEAD', 'TAIL', 'FRONT LEGS', 'HIND LEGS', 'ROUND EARS', 'MUZZLE', 'STRIPES'],
          '20': ['BODY', 'HEAD', 'TAIL', 'FRONT LEGS', 'HIND LEGS', 'ROUND EARS', 'MUZZLE', 'STRIPES']
        },
        reveal: [
          { name: 'STRIPES', kind: 'lines', near: 'BODY' },
          { name: 'EYES', kind: 'glow', near: 'HEAD' },
          { name: 'WHISKERS', kind: 'spike', near: 'MUZZLE' }
        ],
        etherInterpretation: {
          character: ['coiled', 'watchful', 'swift', 'wild'],
          gesture: 'Mid-stride and low, the head down and forward, the tail straight out behind as a counterweight — a line moving from left to right.',
          architecture: [
            'The whole figure is one long horizontal: head, back and tail read as a single line with a slight dip in the middle.',
            'The head sits BELOW the line of the back, not above it — this is what separates a stalking cat from a standing dog.',
            'The legs are the only verticals, and they are angled, not planted: front reaching, hind pushing.'
          ],
          proportion: [
            { feature: 'TAIL', treat: 'exaggerate', note: 'Longer than the body seems to allow; the tail is half the tiger.' },
            { feature: 'BODY', treat: 'exaggerate', note: 'Longer and lower than a real one.' },
            { feature: 'HEAD', treat: 'compress', note: 'Small and low.' },
            { feature: 'ROUND EARS', treat: 'keep', note: 'Two small round ears are cheap and say cat.' }
          ],
          diagnostic: ['BODY', 'TAIL', 'HEAD', 'ROUND EARS'],
          abstraction: {
            stance: 'do-not-draw-literally',
            doNot: ['stripes as lines across the body', 'a face', 'paws', 'the pattern of the coat'],
            instead: ['the stripes as a payoff after the figure is whole, never as structure', 'the tiger as a long low line with a small head at one end and a longer tail at the other', 'the stalk carried by the angle of the legs alone']
          },
          rhythm: 'One long horizontal with a low dip, dense only at the small head; the tail leaves a long empty run of sky above and below it.',
          movement: 'Would move in a low silent glide, the back level, the head steady, the tail trailing the turn of the body.',
          structural: ['BODY', 'HEAD', 'TAIL', 'FRONT LEGS', 'HIND LEGS', 'ROUND EARS'],
          revealOnly: ['STRIPES', 'EYES', 'WHISKERS', 'MUZZLE']
        }
      }
    },
    {
      id: 'tr-dragon', subject: 'Dragon',
      blueprint: {
        subject: 'Dragon',
        silhouette: 'Side view, rearing; a long serpentine neck rising from a deep chest, two wings spread up and back, a long tail curling away below.',
        features: [
          { name: 'WINGS', importance: 3, why: 'The largest shape and the one that says dragon rather than lizard.', anchor: [0.15, -0.9] },
          { name: 'LONG NECK', importance: 3, why: 'An S-curve rising to the head; the dragon is its neck.', anchor: [-0.7, -0.6] },
          { name: 'HEAD', importance: 3, why: 'Narrow, horned, at the top of the neck, looking out.', anchor: [-1.0, -1.05] },
          { name: 'HORNS', importance: 2, why: 'Two swept horns off the back of the head.', anchor: [-0.85, -1.2] },
          { name: 'BODY', importance: 2, why: 'A deep chest, small against the wings.', anchor: [0.1, 0.05] },
          { name: 'TAIL', importance: 3, why: 'Long, tapering, curling away below.', anchor: [0.95, 0.65] },
          { name: 'HIND LEGS', importance: 1, why: 'Crouched under the chest.', anchor: [0.1, 0.75] },
          { name: 'JAWS', importance: 1, why: 'Open, at the front of the head.', anchor: [-1.2, -0.95] }
        ],
        budgets: {
          '8': ['WINGS', 'LONG NECK', 'HEAD', 'BODY', 'TAIL'],
          '12': ['WINGS', 'LONG NECK', 'HEAD', 'HORNS', 'BODY', 'TAIL', 'HIND LEGS'],
          '16': ['WINGS', 'LONG NECK', 'HEAD', 'HORNS', 'BODY', 'TAIL', 'HIND LEGS', 'JAWS'],
          '20': ['WINGS', 'LONG NECK', 'HEAD', 'HORNS', 'BODY', 'TAIL', 'HIND LEGS', 'JAWS']
        },
        reveal: [
          { name: 'WING MEMBRANE', kind: 'fill', near: 'WINGS' },
          { name: 'HORNS', kind: 'spike', near: 'HEAD' },
          { name: 'BREATH', kind: 'motes', near: 'JAWS' },
          { name: 'SPINES', kind: 'spike', near: 'TAIL' }
        ],
        etherInterpretation: {
          character: ['looming', 'ancient', 'fierce', 'coiled'],
          gesture: 'Rearing up and back with the wings thrown open, the neck curving forward over the chest, the tail curling away beneath — one great S from head to tail.',
          architecture: [
            'The neck and the tail are one continuous S-curve with the small chest at its middle; the dragon is a line, and the wings hang from the middle of that line.',
            'The wings are the widest thing by far — wider than the neck is tall — and they rise from the shoulder, not from the back.',
            'The head is the small end of the neck, turned outward, and its horns sweep back along the line of the neck rather than up.'
          ],
          proportion: [
            { feature: 'WINGS', treat: 'exaggerate', note: 'Larger than any real wing; in a few lights the wingspan is the dragon.' },
            { feature: 'LONG NECK', treat: 'exaggerate', note: 'Longer and more curved than seems sensible.' },
            { feature: 'BODY', treat: 'compress', note: 'The chest is only the knot where neck, wings and tail meet.' },
            { feature: 'HIND LEGS', treat: 'compress', note: 'Hints, or nothing.' }
          ],
          diagnostic: ['WINGS', 'LONG NECK', 'TAIL', 'HEAD'],
          abstraction: {
            stance: 'do-not-draw-literally',
            doNot: ['the wing membrane as a filled shape', 'scales', 'the face or the jaws', 'the legs'],
            instead: ['each wing as two lines from the shoulder — a leading edge and a tip falling back — with the sky between them', 'the neck and the tail as one long curve broken by the chest', 'the horns as the reveal, not as lights']
          },
          rhythm: 'Open and tall above, where the wings spread; tight at the small chest; then a long loosening curve down and away in the tail. Most of the figure is empty sky held between the wings.',
          movement: 'Would move in slow heavy beats of the wings, the neck swaying against them, the tail following a beat behind.',
          structural: ['WINGS', 'LONG NECK', 'HEAD', 'BODY', 'TAIL'],
          revealOnly: ['WING MEMBRANE', 'HORNS', 'BREATH', 'SPINES', 'JAWS', 'HIND LEGS']
        }
      }
    },
    {
      id: 'tr-mermaid', subject: 'Mermaid',
      blueprint: {
        subject: 'Mermaid',
        silhouette: 'Three-quarter view, swimming upward; an upright torso and head above a long tail that curves back and down, ending in a wide fluke.',
        features: [
          { name: 'TAIL', importance: 3, why: 'The long curve from the hips down; without it this is a person.', anchor: [0.35, 0.45] },
          { name: 'TAIL FIN', importance: 3, why: 'A wide horizontal fluke at the very end — what says fish rather than snake.', anchor: [0.95, 1.05] },
          { name: 'TORSO', importance: 3, why: 'Upright and human, the shoulders square above the tail.', anchor: [-0.25, -0.35] },
          { name: 'HEAD', importance: 3, why: 'Small and round on the shoulders, tilted up.', anchor: [-0.4, -0.95] },
          { name: 'HAIR', importance: 2, why: 'Long, flowing back and up as if underwater.', anchor: [-0.05, -1.1] },
          { name: 'REACHING HAND', importance: 2, why: 'One arm reaching up and out gives the swim its direction.', anchor: [-1.0, -0.85] },
          { name: 'HIP', importance: 1, why: 'Where the human half becomes the fish half.', anchor: [0.0, 0.05] },
          { name: 'SIDE FIN', importance: 1, why: 'A small fin at the hip.', anchor: [0.2, 0.2] }
        ],
        budgets: {
          '8': ['TAIL', 'TAIL FIN', 'TORSO', 'HEAD', 'REACHING HAND'],
          '12': ['TAIL', 'TAIL FIN', 'TORSO', 'HEAD', 'REACHING HAND', 'HAIR', 'HIP'],
          '16': ['TAIL', 'TAIL FIN', 'TORSO', 'HEAD', 'REACHING HAND', 'HAIR', 'HIP', 'SIDE FIN'],
          '20': ['TAIL', 'TAIL FIN', 'TORSO', 'HEAD', 'REACHING HAND', 'HAIR', 'HIP', 'SIDE FIN']
        },
        reveal: [
          { name: 'HAIR', kind: 'contour', near: 'HEAD' },
          { name: 'SCALES', kind: 'texture', near: 'TAIL' },
          { name: 'BUBBLES', kind: 'motes', near: 'HEAD' }
        ],
        etherInterpretation: {
          character: ['light', 'serene', 'open', 'nimble'],
          gesture: 'Rising through water — the torso lifted, one hand reaching up, the tail trailing in a long lazy curve that ends in a wide flick of the fluke.',
          architecture: [
            'Two halves meeting at the hip: a short upright human half above, a long curving fish half below, and the curve of the tail is longer than the torso is tall.',
            'The reaching arm leaves the shoulder and goes up and away from the tail, so the figure opens like a diagonal from fluke to fingertips.',
            'The fluke is a wide horizontal at the very bottom, at right angles to the tail — the only wide thing in the figure.'
          ],
          proportion: [
            { feature: 'TAIL', treat: 'exaggerate', note: 'Longer and more curved than a body would allow.' },
            { feature: 'TAIL FIN', treat: 'exaggerate', note: 'Wide; a small fluke reads as a foot.' },
            { feature: 'TORSO', treat: 'compress', note: 'Short; the human half is the smaller half.' },
            { feature: 'HEAD', treat: 'compress', note: 'One light.' }
          ],
          diagnostic: ['TAIL', 'TAIL FIN', 'TORSO', 'REACHING HAND'],
          abstraction: {
            stance: 'do-not-draw-literally',
            doNot: ['a face', 'the hair as strands', 'scales', 'fingers', 'the second arm'],
            instead: ['the hair as the reveal, flowing back from a single head light', 'the diagonal from fluke to fingertips as the whole gesture', 'the human half as three lights — head, shoulder, hip — and no more']
          },
          rhythm: 'Open along the long diagonal, dense only at the shoulders where head, arm and torso meet, then one wide stop at the fluke; the water between arm and tail is left empty.',
          movement: 'Would move in one slow undulation from hip to fluke, the torso still, the hair trailing a moment behind.',
          structural: ['TAIL', 'TAIL FIN', 'TORSO', 'HEAD', 'REACHING HAND', 'HIP'],
          revealOnly: ['HAIR', 'SCALES', 'BUBBLES', 'SIDE FIN']
        }
      }
    },
    {
      id: 'tr-falcon', subject: 'Falcon',
      blueprint: {
        subject: 'Falcon',
        silhouette: 'Seen from below in a stoop; a compact body with the wings swept back into a narrow point and a short fanned tail.',
        features: [
          { name: 'WINGS', importance: 3, why: 'Long, narrow and swept back to a point — the shape of speed.', anchor: [0.0, -0.25] },
          { name: 'BODY', importance: 3, why: 'Compact and streamlined, a teardrop.', anchor: [0.0, 0.1] },
          { name: 'HEAD', importance: 3, why: 'Small and round, tucked into the shoulders.', anchor: [0.0, -0.75] },
          { name: 'HOOKED BEAK', importance: 2, why: 'Short and hooked; the hunter.', anchor: [0.0, -0.95] },
          { name: 'TAIL', importance: 2, why: 'Short and fanned, a brake and a rudder.', anchor: [0.0, 0.85] },
          { name: 'TALONS', importance: 1, why: 'Tucked up under the body in the dive.', anchor: [0.05, 0.45] },
          { name: 'EYES', importance: 1, why: 'Large and dark; not drawable in lights.', anchor: [0.08, -0.8] }
        ],
        budgets: {
          '8': ['WINGS', 'BODY', 'HEAD', 'TAIL', 'HOOKED BEAK'],
          '12': ['WINGS', 'BODY', 'HEAD', 'TAIL', 'HOOKED BEAK', 'TALONS'],
          '16': ['WINGS', 'BODY', 'HEAD', 'TAIL', 'HOOKED BEAK', 'TALONS'],
          '20': ['WINGS', 'BODY', 'HEAD', 'TAIL', 'HOOKED BEAK', 'TALONS', 'EYES']
        },
        reveal: [
          { name: 'FEATHERS', kind: 'lines', near: 'WINGS' },
          { name: 'EYES', kind: 'glow', near: 'HEAD' },
          { name: 'TALONS', kind: 'spike', near: 'TAIL' }
        ],
        etherInterpretation: {
          character: ['swift', 'poised', 'fierce', 'light'],
          gesture: 'Falling — the wings folded back into a single narrow arrowhead, the head down, the whole bird one point aimed at the ground.',
          architecture: [
            'The figure is an arrowhead: two long swept lines from the shoulders back to the wing tips, meeting the body in a narrow V behind.',
            'The head is the point of the arrow and the tail is its notch; everything else is the two wing edges.',
            'The body is only the short spine the wings hang from, hardly wider than the head.'
          ],
          proportion: [
            { feature: 'WINGS', treat: 'exaggerate', note: 'Longer and narrower than a real wing; the sweep is the falcon.' },
            { feature: 'BODY', treat: 'compress', note: 'A short line, not a mass.' },
            { feature: 'HEAD', treat: 'keep', note: 'Small and pointed; one light at the tip.' },
            { feature: 'TAIL', treat: 'compress', note: 'A short notch.' }
          ],
          diagnostic: ['WINGS', 'HEAD', 'TAIL'],
          abstraction: {
            stance: 'simplify',
            doNot: ['feathers', 'the eyes', 'talons as fingers', 'a wing as a filled shape'],
            instead: ['each wing as one long swept line with the sky inside the V', 'the beak as the single sharpest angle in the figure', 'the stoop carried by symmetry and the downward point']
          },
          rhythm: 'Symmetrical about a single vertical; dense at the small head, then two long empty sweeps opening back to the wing tips and closing at the tail.',
          movement: 'Would not flap at all — would fall, tilt as one piece, and fold tighter as it went.',
          structural: ['WINGS', 'BODY', 'HEAD', 'TAIL', 'HOOKED BEAK'],
          revealOnly: ['FEATHERS', 'EYES', 'TALONS']
        }
      }
    }
  ];

  global.LabTranslationData = {
    note: 'CONSTRUCTED research blueprints for the Ether Creature Translation study — hand-written, not model output; validated by LabBlueprint.validate on the way in.',
    creatures: creatures,
    byId: function (id) { return creatures.filter(function (c) { return c.id === id; })[0] || null; }
  };
})(typeof window !== 'undefined' ? window : this);
