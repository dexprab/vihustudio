// tools/ether-mystery-lab/fixtures.js — candidate fixtures for the
// generation pipeline.
//
// HONEST LABELLING: everything in this file is a hand-written FIXTURE.
// No model produced any of it — no model is reachable from this
// environment — and nothing here is presented as generated output.
// The `valid` set exists to prove the grammar vocabulary can express
// experiences beyond the shipped pool (transform, echo, return,
// complete — grammars with no approved instance yet); the
// `adversarial` set is the validator's battery: every way a generator
// could go wrong, each expected to be refused with a named reason.
//
// One copy, consumed by the lab AND the suite — a fixture the test
// keeps privately is a fixture that can drift from the pipeline it
// exercises.

'use strict';

const valid = [
  {
    label: 'transform grammar — the sky answers a returning look',
    candidate: {
      id: 'what-answers-being-watched',
      grammar: 'transform',
      title: 'a small light that is different each time it is looked at',
      complexity: 'deeper',
      elements: [
        { role: 'light', show: 'glint', place: 'far' }
      ],
      engage: [
        { action: 'return', on: 'light' }
      ],
      behaviour: { onEngage: 'brighten', pace: 'still' },
      outcome: { possible: ['discovery', 'unresolved'], discovery: 'wonder' },
      constraints: { rarity: 'rare', notBefore: 140, lifeS: 140,
                     phases: ['deep', 'reignition'] }
    }
  },
  {
    label: 'echo grammar — an old place stirs again',
    candidate: {
      id: 'where-something-happened',
      grammar: 'echo',
      title: 'faint stirring where something else once happened',
      complexity: 'very-deep',
      ingredients: { anchor: true },
      elements: [
        { role: 'stir', show: 'mark', place: 'at-anchor', count: 2 }
      ],
      engage: [
        { action: 'dwell', on: 'stir', seconds: 3 }
      ],
      behaviour: { onEngage: 'dissolve', pace: 'still' },
      outcome: { possible: ['unresolved'],
                 residue: { show: 'glint', when: 'either' } },
      constraints: { rarity: 'rare', notBefore: 180,
                     phases: ['deep', 'reignition'] }
    }
  },
  {
    label: 'complete grammar — a ring with a gap in it',
    candidate: {
      id: 'a-shape-almost-whole',
      grammar: 'complete',
      title: 'a ring of small lights that does not quite close',
      complexity: 'moderate',
      elements: [
        { role: 'rim', show: 'glint', place: 'ring', count: 4 },
        { role: 'gap', show: 'mark', place: 'near-look' }
      ],
      engage: [
        { action: 'tap', on: 'gap' },
        { action: 'approach', on: 'rim' }
      ],
      behaviour: { onEngage: 'link', pace: 'slow' },
      outcome: { possible: ['discovery', 'unresolved'], discovery: 'wonder' },
      constraints: { rarity: 'rare', notBefore: 90,
                     phases: ['exploration', 'deep'] }
    }
  },
  {
    label: 'return grammar — the same creation met differently',
    candidate: {
      id: 'still-there-changed',
      grammar: 'return',
      title: 'a fragment that waits, and is otherwise when come back to',
      complexity: 'deeper',
      ingredients: { creation: true, creationKind: 'story' },
      elements: [
        { role: 'keeper', show: 'shard', of: 'cover', place: 'far' }
      ],
      engage: [
        { action: 'return', on: 'keeper' }
      ],
      behaviour: { onEngage: 'brighten', pace: 'still' },
      outcome: { possible: ['discovery', 'unresolved'],
                 discovery: 'creation-revealed' },
      constraints: { rarity: 'rare', notBefore: 160, lifeS: 150,
                     phases: ['deep', 'reignition'] }
    }
  }
];

// Every entry: what a wayward generator might send, and (a substring
// of) the reason the validator must give for refusing it.
const adversarial = [
  {
    label: 'gamification in free text',
    expect: 'gamification-language',
    candidate: {
      id: 'star-collector', grammar: 'connect',
      title: 'collect all the stars to win a prize',
      elements: [{ role: 'star', show: 'glint', place: 'ring', count: 3 }],
      engage: [{ action: 'tap', on: 'star' }],
      outcome: { possible: ['discovery'], discovery: 'wonder' }
    }
  },
  {
    label: 'executable code in a value',
    expect: 'generated-code-or-reference',
    candidate: {
      id: 'sneaky-payload', grammar: 'notice',
      title: '() => document.body.innerHTML',
      elements: [{ role: 'shimmer', show: 'mark', place: 'far' }],
      engage: [{ action: 'dwell', on: 'shimmer', seconds: 3 }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'privacy — a forbidden key at depth',
    expect: 'forbidden-key',
    candidate: {
      id: 'who-made-this', grammar: 'connect',
      title: 'lights around a maker',
      ingredients: { creation: true },
      elements: [{ role: 'star', show: 'glint', place: 'ring', count: 3,
                   stars: 'their-constellation' }],
      engage: [{ action: 'tap', on: 'star' }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'privacy — an external reference in a value',
    expect: 'generated-code-or-reference',
    candidate: {
      id: 'far-fetcher', grammar: 'notice',
      title: 'see https://somewhere.example/thing',
      elements: [{ role: 'shimmer', show: 'mark', place: 'far' }],
      engage: [{ action: 'dwell', on: 'shimmer', seconds: 3 }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'unsupported interaction — hover',
    expect: 'unavailable-capability:action:hover',
    candidate: {
      id: 'hover-only', grammar: 'uncover',
      title: 'a veil that parts under a resting pointer',
      ingredients: { creation: true },
      elements: [{ role: 'veil', show: 'veil', place: 'far' },
                 { role: 'behind', show: 'shard', of: 'cover', place: 'far' }],
      engage: [{ action: 'hover', on: 'veil' }],
      behaviour: { onEngage: 'reveal' },
      outcome: { possible: ['discovery'], discovery: 'creation-revealed' }
    }
  },
  {
    label: 'a deadline on a tap',
    expect: 'no-deadlines',
    candidate: {
      id: 'quick-fingers', grammar: 'connect',
      title: 'three lights, briefly',
      elements: [{ role: 'star', show: 'glint', place: 'ring', count: 3 }],
      engage: [{ action: 'tap', on: 'star', seconds: 2 },
               { action: 'approach', on: 'star' }],
      outcome: { possible: ['discovery', 'unresolved'], discovery: 'wonder' }
    }
  },
  {
    label: 'performance — unbounded pieces',
    expect: 'too-many-pieces',
    candidate: {
      id: 'a-thousand-lights', grammar: 'connect',
      title: 'very many lights',
      elements: [{ role: 'a', show: 'glint', place: 'scattered', count: 6 },
                 { role: 'b', show: 'glint', place: 'scattered', count: 6 }],
      engage: [{ action: 'tap', on: 'a' }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'a new mechanic smuggled as an unknown key',
    expect: 'unknown-key',
    candidate: {
      id: 'novel-mechanic', grammar: 'experiment',
      title: 'a spinner',
      elements: [{ role: 'spot', show: 'glint', place: 'near-look' }],
      engage: [{ action: 'tap', on: 'spot' }],
      outcome: { possible: ['unresolved'] },
      minigame: { kind: 'wheel' }
    }
  },
  {
    label: 'frightening content',
    expect: 'frightening-content',
    candidate: {
      id: 'the-dark-thing', grammar: 'notice',
      title: 'a monster waits in the dark to scream',
      elements: [{ role: 'shimmer', show: 'mark', place: 'far' }],
      engage: [{ action: 'dwell', on: 'shimmer', seconds: 3 }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'instruction-speak',
    expect: 'instruction-language',
    candidate: {
      id: 'read-me-first', grammar: 'connect',
      title: 'instructions: connect the lights in order',
      elements: [{ role: 'star', show: 'glint', place: 'ring', count: 3 }],
      engage: [{ action: 'tap', on: 'star' }],
      outcome: { possible: ['discovery', 'unresolved'], discovery: 'wonder' }
    }
  },
  {
    label: 'unknown grammar',
    expect: 'unknown-grammar',
    candidate: {
      id: 'collect-a-thing', grammar: 'collect',
      title: 'gathering things',
      elements: [{ role: 'thing', show: 'glint', place: 'scattered', count: 3 }],
      engage: [{ action: 'tap', on: 'thing' }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'experiment that always pays',
    expect: 'experiment-must-stay-uncertain',
    candidate: {
      id: 'sure-thing', grammar: 'experiment',
      title: 'touch it and something always happens',
      elements: [{ role: 'spot', show: 'glint', place: 'near-look' }],
      engage: [{ action: 'tap', on: 'spot' }],
      outcome: { possible: ['discovery'], discovery: 'wonder' }
    }
  },
  {
    label: 'grammar that needs a creation, without one',
    expect: 'grammar-needs-creation',
    candidate: {
      id: 'pieces-of-nothing', grammar: 'reconstruct',
      title: 'pieces with nothing they belong to',
      elements: [{ role: 'piece', show: 'glint', place: 'scattered', count: 4 }],
      engage: [{ action: 'tap', on: 'piece' }],
      outcome: { possible: ['unresolved'] }
    }
  },
  {
    label: 'a sure discovery with no question posed',
    expect: 'outcome-obvious-no-question',
    candidate: {
      id: 'free-gift', grammar: 'notice',
      title: 'something simply appears and pays out',
      elements: [{ role: 'shimmer', show: 'mark', place: 'far' }],
      engage: [{ action: 'wait', seconds: 5 }],
      outcome: { possible: ['discovery'], discovery: 'wonder' }
    }
  },
  {
    label: 'malformed output — not an object',
    expect: 'not-an-object',
    candidate: 'reconstruct the cover please'
  },
  {
    label: 'a reskin of an approved experience',
    expect: 'reskin-of-existing',
    reskinOfPool: true,
    candidate: {
      id: 'a-cover-in-bits',
      grammar: 'reconstruct',
      title: 'bits of a cover drifting about',
      complexity: 'moderate',
      ingredients: { creation: true, creationKind: 'story' },
      elements: [
        { role: 'bit', show: 'shard', of: 'cover', place: 'scattered', count: 4 }
      ],
      engage: [
        { action: 'tap', on: 'bit' },
        { action: 'approach', on: 'bit' }
      ],
      behaviour: { onEngage: 'gather', pace: 'slow' },
      outcome: { possible: ['discovery'], discovery: 'creation-revealed' },
      constraints: { rarity: 'uncommon', notBefore: 70,
                     phases: ['exploration', 'deep'] }
    }
  }
];

// Dual-environment: CommonJS for the Node lab and the suites (their
// existing require() is untouched), a global for the browser Lab page —
// one copy either way, which is this file's own founding rule.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { valid, adversarial };
}
if (typeof window !== 'undefined') {
  window.EtherLabFixtures = { valid: valid, adversarial: adversarial };
}
