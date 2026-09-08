// tools/ether-mystery-lab/labArtworkData.js — the FIXTURE ARTISTIC
// SOURCE: existing pictures, chosen rather than generated.
//
// SPRINT — Shape Lab: prompt → artistic creature → image understanding,
// proof V1 (Decision 58, Lab only).
//
// WHY THIS EXISTS. The account's OpenAI key has no image-generation
// access (every gpt-image-* model answers model_not_found for the
// project; the newer image routes need organisation verification), and
// the product owner ruled that IMAGE GENERATION is an unavailable
// provider capability for this sprint — not to be worked around. The
// proof target is therefore FIXTURE ARTISTIC IMAGE → gpt-4.1-mini IMAGE
// UNDERSTANDING → STRUCTURED CREATURE INTERPRETATION, and the fixture
// must be real artwork, never a text description pretending to be one.
//
// WHAT IS HERE. Seventeen real pictures: the product's own five Companions
// (a smiling dragon with enormous wings, a winged lion, and three
// invented beings), and openly-licensed creature art rasterized from
// three sources — Twemoji (CC BY 4.0), OpenMoji (CC BY-SA 4.0) and
// game-icons.net (CC BY 3.0; Delapouite and Lorc) — for the mermaid,
// the elephant, the falcon and eagle, the centaur and more dragons. The
// rasters and the three licence texts live in ./artwork/.
//
// `visible` IS GROUND TRUTH, WRITTEN BY A PERSON LOOKING AT THE PICTURE.
// It is what the real understanding run is judged against ("A. what is
// actually visible" against "B. what the model says is visible"). It is
// NEVER sent to the model — the understanding request carries only the
// fixed contract, the researcher's creative prompt and the picture —
// and the suite checks that no word of it reaches a request.
//
// `tags` order the gallery under a prompt (a word the prompt shares with
// an entry brings it forward). That is string overlap over DATA, not a
// creature catalogue in code: there is no `subject === …` anywhere, a
// prompt no entry matches simply shows the gallery unordered, and the
// researcher chooses by looking.

(function (global) {
  'use strict';

  var entries = [
    // ---- the product's own Companions (assets/<id>/hero.png) ----
    { id: 'lumo', file: '../../assets/lumo/hero.png', title: 'Lumo — the Story Dragon', credit: 'VihuPlanet Companion art', licence: 'product',
      tags: ['dragon', 'smiling', 'wings', 'winged', 'horns', 'tail', 'scales', 'friendly', 'mythical', 'enormous'],
      visible: 'A teal-green cartoon dragon standing upright on two legs, facing three-quarters left, with a small closed-mouth smile and large friendly eyes. Two enormous bat-like wings spread wide behind and above it, edged with claws; two curved cream horns and a fin-like crest on the head; a pale cream plated belly running from chest to tail; small arms held near the chest; a long tail curling to the right with a ridge of spines; a faint teal shadow pool under the feet. Upright, symmetrical, open-armed posture — the wings dominate the silhouette.' },
    { id: 'leo', file: '../../assets/leosaurus/hero.png', title: 'Leo — the Lantern Lion', credit: 'VihuPlanet Companion art', licence: 'product',
      tags: ['lion', 'wings', 'winged', 'mane', 'lantern', 'butterfly', 'hybrid', 'cat', 'feline', 'book', 'tail'],
      visible: 'A cartoon lion cub with a large golden mane, all four paws on the ground in a mid-step, side-on facing left, body low and grounded, one forepaw lifted toward a glowing orange butterfly in front of its nose. Two large feathered wings in purple, blue and teal rise from its shoulders, one spread up behind the head and one behind the back. A small open book hangs on a cord at its chest; a lit golden lantern hangs from the curled tip of its tail at the right. The mane and the wings are the two dominant masses; the pose is a walking cat, not a flying one.' },
    { id: 'leafy', file: '../../assets/leafy/hero.png', title: 'Leafy — the Bloomling', credit: 'VihuPlanet Companion art', licence: 'product',
      tags: ['plant', 'pot', 'flowers', 'leaves', 'invented', 'smiling', 'little', 'tiny'],
      visible: 'An invented being: a yellow ceramic flowerpot with a small smiling face on its front, two short yellow arms (one raised in a wave) and two stubby feet. A tall bunch of green leaves, stems and three flowers (pink, orange, purple) grows out of the top of the pot with dark soil visible at the rim. Upright, front-facing, the plant mass above is taller than the pot body below. No animal anatomy at all.' },
    { id: 'quill', file: '../../assets/quill/hero.png', title: 'Quill — the Ink Spirit', credit: 'VihuPlanet Companion art', licence: 'product',
      tags: ['ink', 'spirit', 'quill', 'pen', 'cloak', 'invented', 'feather', 'drops'],
      visible: 'An invented being made of dark navy ink: a rounded glossy body with large pale violet eyes and a small smile, a swept-back crest of ink shaped like feathers rising from its head, a cape of ink with silver edging flaring out behind, and a puddle of ink under its feet with drops flying around it. It holds a tall silver-nibbed quill pen upright in one hand, taller than itself. Standing, front-facing, the body compact and the crest, cape and pen all reaching upward and outward from it.' },
    { id: 'nimbus', file: '../../assets/nimbus/hero.png', title: 'Nimbus — the Dream Sprite', credit: 'VihuPlanet Companion art', licence: 'product',
      tags: ['cloud', 'sprite', 'moon', 'invented', 'sleepy', 'dream', 'pointed ears', 'little'],
      visible: 'An invented being: a small pale child-like sprite with pointed ears, standing barefoot on a cloud, its hair a mass of white cloud curls with a crescent moon on the forehead; a white and lilac layered dress with a tassel and a small blue gem; another crescent moon hangs from the dress. The cloud body and cloud hair are the dominant soft masses; the face is calm with a slight smile. Upright, front-facing, floating rather than grounded.' },

    // ---- openly-licensed creature art, rasterized in ./artwork ----
    { id: 'twemoji-mermaid', file: 'artwork/twemoji-mermaid.png', title: 'Mermaid (Twemoji)', credit: 'Twemoji — Twitter, Inc. and contributors', licence: 'CC BY 4.0 (artwork/twemoji-LICENSE-GRAPHICS.txt)',
      tags: ['mermaid', 'tail', 'fin', 'hair', 'flowing', 'sea', 'graceful'],
      visible: 'A flat-colour mermaid: a human upper body with long blue hair, a red top and a smiling face, one arm raised open-handed and the other resting on the tail; from the hips a green fish tail curves down and to the right, ending in a two-lobed fin. Seated pose, the tail one continuous S-curve from the hips to the fin. Plain cream background.' },
    { id: 'openmoji-mermaid', file: 'artwork/openmoji-mermaid.png', title: 'Mermaid with a trident (OpenMoji)', credit: 'OpenMoji — HfG Schwäbisch Gmünd', licence: 'CC BY-SA 4.0 (artwork/openmoji-LICENSE.txt)',
      tags: ['mermaid', 'trident', 'tail', 'fin', 'hair', 'sea'],
      visible: 'An outlined mermaid facing left, holding a tall three-pronged trident upright beside her; orange hair, a yellow top, and a pink fish tail that sweeps down and back to the right, ending in a forked fin. Profile view, the trident a vertical line against the tail\'s curve. Plain cream background.' },
    { id: 'gameicons-mermaid', file: 'artwork/gameicons-mermaid.png', title: 'Mermaid silhouette (game-icons.net)', credit: 'Delapouite, game-icons.net', licence: 'CC BY 3.0 (artwork/gameicons-license.txt)',
      tags: ['mermaid', 'silhouette', 'tail', 'fin', 'hair', 'flowing', 'bubbles', 'sea'],
      visible: 'A white silhouette on black: a mermaid seen from the front-left with hair streaming out to the left, arms spread, and a thick tail curling down in an S below the torso to a forked fin at the bottom left. A few bubbles float around her. The whole figure is one flowing curve from the streaming hair through the torso into the tail.' },
    { id: 'openmoji-elephant', file: 'artwork/openmoji-elephant.png', title: 'Elephant (OpenMoji)', credit: 'OpenMoji — HfG Schwäbisch Gmünd', licence: 'CC BY-SA 4.0 (artwork/openmoji-LICENSE.txt)',
      tags: ['elephant', 'trunk', 'ears', 'tusk', 'huge', 'real', 'animal'],
      visible: 'An outlined grey elephant in side view facing left, standing on four straight legs; a large rounded back, a big flat ear over the head, a long trunk curling down and forward to the ground, one short tusk, a thin tail at the right. A compact, grounded, heavy body; the trunk and ear are the recognisable parts. Plain cream background.' },
    { id: 'twemoji-elephant', file: 'artwork/twemoji-elephant.png', title: 'Elephant (Twemoji)', credit: 'Twemoji — Twitter, Inc. and contributors', licence: 'CC BY 4.0 (artwork/twemoji-LICENSE-GRAPHICS.txt)',
      tags: ['elephant', 'trunk', 'ears', 'huge', 'real', 'animal', 'simple'],
      visible: 'A very simplified flat blue-grey elephant in side view facing left: one big rounded body-and-head mass filling the frame, a single dark eye, a large ear drawn as a curved band, a trunk hanging down at the left, four stubby legs and a small tail. Almost no detail — a bulky rounded silhouette. Plain cream background.' },
    { id: 'gameicons-elephant', file: 'artwork/gameicons-elephant.png', title: 'Elephant silhouette (game-icons.net)', credit: 'Delapouite, game-icons.net', licence: 'CC BY 3.0 (artwork/gameicons-license.txt)',
      tags: ['elephant', 'silhouette', 'trunk', 'ears', 'tusk', 'huge', 'animal'],
      visible: 'A white silhouette of an elephant on black, side view facing right: a big humped body on four thick legs, a large ear, a long trunk curling under the head, one tusk, a small eye and a tail at the left. Grounded and heavy; the trunk and tusk read at once.' },
    { id: 'gameicons-falcon', file: 'artwork/gameicons-falcon-moon.png', title: 'Falcon in flight with a crescent moon (game-icons.net)', credit: 'Delapouite, game-icons.net', licence: 'CC BY 3.0 (artwork/gameicons-license.txt)',
      tags: ['falcon', 'bird', 'flight', 'wings', 'moon', 'crescent', 'silhouette', 'hooked beak'],
      visible: 'A white silhouette on black of a falcon in flight, seen from below and slightly behind, body diagonal from lower-left to upper-right, wings swept in a wide X across the frame with a forked tail at the lower left; a large crescent moon arcs behind it at the upper right. Two overlapping shapes — the bird\'s X of wings and the moon\'s arc.' },
    { id: 'openmoji-eagle', file: 'artwork/openmoji-eagle.png', title: 'Eagle, a bird of prey (OpenMoji)', credit: 'OpenMoji — HfG Schwäbisch Gmünd', licence: 'CC BY-SA 4.0 (artwork/openmoji-LICENSE.txt)',
      tags: ['eagle', 'falcon', 'bird', 'prey', 'wings', 'hooked beak', 'talons', 'landing'],
      visible: 'An outlined brown bird of prey with a white head and a yellow hooked beak, seen side-on facing left in a landing or perching pose: body leaning forward, both wings raised up and back behind it, tail feathers down at the right, one leg with talons reaching to the ground. The two raised wings are the biggest shapes. Plain cream background.' },
    { id: 'gameicons-centaur', file: 'artwork/gameicons-centaur.png', title: 'Centaur archer silhouette (game-icons.net)', credit: 'Delapouite, game-icons.net', licence: 'CC BY 3.0 (artwork/gameicons-license.txt)',
      tags: ['centaur', 'horse', 'human', 'archer', 'bow', 'hybrid', 'silhouette', 'mythical'],
      visible: 'A white silhouette on black of a centaur: a horse body in side view facing right, standing on four legs with a tail at the left, and from where the horse\'s neck would be a human torso rises upright with a round head, one arm drawn back and the other holding a bow with an arrow aimed up and to the left. The human half sits on top of the horse half at the front of the horse body; the bow is the largest single shape above.' },
    { id: 'twemoji-dragon', file: 'artwork/twemoji-dragon.png', title: 'Dragon, serpentine (Twemoji)', credit: 'Twemoji — Twitter, Inc. and contributors', licence: 'CC BY 4.0 (artwork/twemoji-LICENSE-GRAPHICS.txt)',
      tags: ['dragon', 'serpent', 'tail', 'spines', 'teeth', 'green', 'grumpy', 'mythical'],
      visible: 'A flat green dragon with a long serpentine body that rises from the head at the upper left, dips in a deep U, and rises again into a tail at the upper right; a ridge of dark spines runs along its whole back; a frowning face with a single eye, a snout and two white fangs; one small clawed hand at the left under the neck; no wings. The body is one thick continuous U-curve. Plain cream background.' },
    { id: 'openmoji-dragon', file: 'artwork/openmoji-dragon.png', title: 'Dragon breathing fire (OpenMoji)', credit: 'OpenMoji — HfG Schwäbisch Gmünd', licence: 'CC BY-SA 4.0 (artwork/openmoji-LICENSE.txt)',
      tags: ['dragon', 'wings', 'fire', 'flame', 'tail', 'horns', 'rearing', 'mythical'],
      visible: 'An outlined lime-green dragon rearing up and facing right, breathing a small red flame from its open mouth; a spiky head with horns, a long neck, one raised wing spread to the left, a small foreleg, and a tail curling down and to the left below the body. Upright rearing pose; the neck, wing and tail all curve away from a small body. Plain cream background.' },
    { id: 'gameicons-sea-dragon', file: 'artwork/gameicons-sea-dragon.png', title: 'Sea dragon silhouette (game-icons.net)', credit: 'Lorc, game-icons.net', licence: 'CC BY 3.0 (artwork/gameicons-license.txt)',
      tags: ['dragon', 'sea', 'serpent', 'silhouette', 'coil', 'crest', 'mythical'],
      visible: 'A white silhouette on black of a serpentine dragon coiled in a thick S: a horned head at the upper right facing right with an open jaw, the body curving down and around to the left and back under itself to a rounded tail at the lower right, a fin-like crest along the upper back. One thick continuous S-curve; no legs, no wings.' }
  ];

  var api = { entries: entries, byId: function (id) { return entries.filter(function (e) { return e.id === id; })[0] || null; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabArtworkData = api;
  else global.LabArtworkData = api;
})(typeof window !== 'undefined' ? window : this);
