// companionRecord.js — the Companion that travels WITH a Story.
//
// Sprint 1, Companion as World Host. A Story shared with VihuPlanet is
// read by Travellers who have never met the child who made it, and the
// owner's Companion is meant to be there when they do. Nothing in the
// Ether can look that Companion up: `cardId` on a story record is the
// owner's Magic Card id, and a Magic Card lives on the owner's own
// device. Asking the platform "who is card X bonded to" would be a new
// identity lookup across children, which VihuPlanet does not do.
//
// So the Companion travels with the Story, exactly as `creatorName`
// already does (CLAUDE.md → Decision 15: "a Story's maker travels with
// the Story"). Stamped once by the authoring device from its own Magic
// Card, carried forward on every save, and read by whoever opens the
// Story afterwards.
//
// ---------------------------------------------------------------
// WHY THIS IS A RECORD AND NOT AN ID STRING
//
// "Keep the companion information expandable so that in future when
// companion is given more growth and maturity it can be accommodated"
// — the product owner, stating the requirement that shapes this file.
//
// A bare `companionId` would have been half the code and would have to
// be replaced the first time a Companion carried anything beyond its
// identity. So what travels is a small structured object, and every
// layer between the store and the renderer passes it through
// OPAQUELY — reading only the fields it needs and preserving the ones
// it does not understand. That is the same discipline the runtime
// already holds for the Story Entity (Decision 9): physics moves
// entities and knows nothing else about them.
//
// The practical test, and it is the one to run before changing
// anything here: adding a `maturity` (or any other) field later must
// require no change to js/creatorProjectStore.js, js/etherFeed.js or
// js/storyHost.js. clone() below is what makes that true — it copies
// every own key rather than a declared list, so a field this build has
// never heard of survives a round trip through the store, the cloud,
// the feed and back out to a renderer that does understand it.
//
// ---------------------------------------------------------------
// WHAT GROWTH MAY NOT BECOME
//
// Room for maturity is not room for a ladder. `js/magicCard.js` →
// growthSignals() states the discipline for the card ("no counters, no
// levels"), and CLAUDE.md → Decision 20 refused growth STAGES for
// Cheer with reasoning that applies here without a word changed: a
// stage is a level, a level has a name, and a name can be compared
// between children. Whatever arrives on this record later must be
// describable — a quality a Companion has — never a rank a child could
// hold up against a sibling's.
//
// Fields today:
//   id        the registered Companion package id ('leafy', 'quill'…).
//             The ONLY field anything currently branches on, and it is
//             matched against assets/registry.json, never hardcoded.
//   name      what the child called it, for alt text and nothing else.
//   species   the Canon 3 species, carried because the card has it and
//             throwing it away here would mean asking for it later.
//
// Fields tomorrow: whatever a Companion grows. This file does not need
// to know about them in advance, and that is the point.
const CompanionRecord = (function () {
  'use strict';

  // A claimed Magic Card's own bonded Story Companion (Canon 3). A
  // card with no companion — a Traveller mid-Rite, before the Creator
  // Ceremony — honestly has none, and returns null rather than a
  // placeholder. A Story stamped with nothing simply has no host, which
  // is a real state the portal already handles.
  function fromCard(card) {
    if (!card || !card.companionId) return null;
    return {
      id: card.companionId,
      name: card.companionName || card.companionId,
      species: card.companionSpecies || null
    };
  }

  // The opaque copy. Every own key, known or not — see the note above.
  // Returns null for anything that is not a usable record, so callers
  // can treat "no companion" and "unreadable companion" identically.
  function clone(record) {
    if (!isValid(record)) return null;
    const out = {};
    Object.keys(record).forEach(function (k) { out[k] = record[k]; });
    return out;
  }

  // The one thing every layer is allowed to require: a real id. Nothing
  // else is mandatory, now or later.
  function isValid(record) {
    return !!(record && typeof record === 'object' &&
              typeof record.id === 'string' && record.id);
  }

  const api = { fromCard: fromCard, clone: clone, isValid: isValid };
  try { window.CompanionRecord = api; } catch (e) {}
  return api;
})();
