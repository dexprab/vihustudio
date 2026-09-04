// assets/ether/experience-pool.js — the approved experience pool.
//
// SPRINT — Generative Mystery & Challenge Engine.
//
// VALIDATED EXPERIENCE DATA, NEVER CODE. Each entry is a candidate in
// the strict schema js/etherGrammar.js defines, plus pool metadata:
// its lifecycle status (active | retired | rejected — only 'active'
// entries are ever selectable, and js/etherMystery.js re-validates
// every entry at load anyway), where it came from, and when it was
// approved. The file ships with the application, the canon-repository
// pattern (Decision 13): entering or leaving this pool is a reviewed
// commit, never a runtime act, and the runtime carries no generator.
//
// SOURCE LABELLING IS HONEST. 'fixture' means a hand-written seed
// candidate proving the grammar's expressiveness; 'generated' is
// reserved for candidates a real model produced through the offline
// lab (tools/ether-mystery-lab/) — none has, because no model is
// reachable from the build environment, and nothing here pretends
// otherwise.
//
// TO ADD AN EXPERIENCE: run the lab, review the candidate, and commit
// it here with status 'active'. TO RETIRE ONE: flip its status and
// say why — it stays for the record, and stops being selectable on
// the next load.

(function (global) {
  'use strict';

  global.EtherExperiencePool = {
    version: 1,
    experiences: [
      {
        status: 'active',
        source: 'fixture',
        approved: '2026-09-04',
        candidate: {
          id: 'a-cover-come-apart',
          grammar: 'reconstruct',
          title: 'pieces of a cover, adrift near where the child looks',
          complexity: 'moderate',
          ingredients: { creation: true, creationKind: 'story' },
          elements: [
            { role: 'piece', show: 'shard', of: 'cover', place: 'scattered', count: 4 }
          ],
          engage: [
            { action: 'tap', on: 'piece' },
            { action: 'approach', on: 'piece' }
          ],
          behaviour: { onEngage: 'gather', pace: 'slow' },
          outcome: { possible: ['discovery'], discovery: 'creation-revealed' },
          constraints: { rarity: 'uncommon', notBefore: 70, lifeS: 110,
                         phases: ['exploration', 'deep', 'reignition'] }
        }
      },
      {
        status: 'active',
        source: 'fixture',
        approved: '2026-09-04',
        candidate: {
          id: 'behind-a-veil-of-light',
          grammar: 'uncover',
          title: 'a soft light with something waiting behind it',
          complexity: 'simple',
          ingredients: { creation: true, creationKind: 'story' },
          elements: [
            { role: 'veil', show: 'veil', place: 'far' },
            { role: 'behind', show: 'shard', of: 'cover', place: 'far' }
          ],
          engage: [
            { action: 'dwell', on: 'veil', seconds: 3 }
          ],
          behaviour: { onEngage: 'reveal', pace: 'still' },
          outcome: { possible: ['discovery', 'unresolved'],
                     discovery: 'creation-revealed',
                     residue: { show: 'mark', when: 'dissolved' } },
          constraints: { rarity: 'uncommon', notBefore: 40, lifeS: 90,
                         phases: ['curiosity', 'exploration', 'deep'] }
        }
      },
      {
        status: 'active',
        source: 'fixture',
        approved: '2026-09-04',
        candidate: {
          id: 'what-slips-away',
          grammar: 'trace',
          title: 'a fragment that leaves when approached, and what it leaves behind',
          complexity: 'deeper',
          ingredients: { creation: true, creationKind: 'story' },
          elements: [
            { role: 'fragment', show: 'shard', of: 'cover', place: 'near-look' },
            { role: 'passage', show: 'glint', place: 'toward-creation', count: 3 }
          ],
          engage: [
            { action: 'approach', on: 'fragment' },
            { action: 'approach', on: 'passage' }
          ],
          behaviour: { onEngage: 'drift-away', pace: 'drifting' },
          outcome: { possible: ['discovery', 'unresolved'],
                     discovery: 'creation-revealed',
                     residue: { show: 'mark', when: 'either' } },
          constraints: { rarity: 'rare', notBefore: 100, lifeS: 120,
                         phases: ['exploration', 'deep'] }
        }
      },
      {
        status: 'active',
        source: 'fixture',
        approved: '2026-09-04',
        candidate: {
          id: 'stars-that-answer',
          grammar: 'connect',
          title: 'a few stars that seem aware of one another',
          complexity: 'moderate',
          elements: [
            { role: 'star', show: 'glint', place: 'ring', count: 3 }
          ],
          engage: [
            { action: 'tap', on: 'star' },
            { action: 'approach', on: 'star' }
          ],
          behaviour: { onEngage: 'link', pace: 'still' },
          outcome: { possible: ['discovery', 'unresolved'],
                     discovery: 'wonder',
                     residue: { show: 'mark', when: 'resolved' } },
          constraints: { rarity: 'uncommon', notBefore: 50, lifeS: 100,
                         phases: ['exploration', 'deep', 'reignition'] }
        }
      },
      {
        status: 'active',
        source: 'fixture',
        approved: '2026-09-04',
        candidate: {
          id: 'a-quiet-change',
          grammar: 'notice',
          title: 'a far corner of the sky, slightly different than it was',
          complexity: 'simple',
          elements: [
            { role: 'shimmer', show: 'mark', place: 'far', count: 2 }
          ],
          engage: [
            { action: 'dwell', on: 'shimmer', seconds: 3 }
          ],
          behaviour: { onEngage: 'dissolve', pace: 'still' },
          outcome: { possible: ['unresolved'] },
          constraints: { rarity: 'common', notBefore: 35, lifeS: 75,
                         phases: ['curiosity', 'exploration', 'deep', 'quietish'] }
        }
      },
      {
        status: 'retired',
        source: 'fixture',
        approved: '2026-09-04',
        retired: '2026-09-04',
        retiredBecause: 'the ripple already owns this question — a second asking place repeated it',
        candidate: {
          id: 'an-asking-place',
          grammar: 'experiment',
          title: 'a place that sometimes answers being touched',
          complexity: 'simple',
          elements: [
            { role: 'spot', show: 'glint', place: 'near-look' }
          ],
          engage: [
            { action: 'tap', on: 'spot' }
          ],
          behaviour: { onEngage: 'brighten', pace: 'still' },
          outcome: { possible: ['unresolved', 'dissolve'] },
          constraints: { rarity: 'rare', phases: ['exploration', 'deep'] }
        }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
