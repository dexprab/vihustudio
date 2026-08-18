// storyHost.js — who hosts this Story.
//
// Sprint 1, Companion as World Host. One question, one answer, no DOM:
// given a Story as the Ether hands it over, which Companion belongs to
// it? Everything that draws the answer lives in js/etherHost.js; this
// file is pure resolution, so it can be reasoned about (and tested)
// without a portal being open.
//
// TWO KINDS OF STORY, TWO ANSWERS
//
//   Creator Story  the owner's own bonded Story Companion, carried on
//                  the Story itself (js/companionRecord.js). Never the
//                  Traveller's own Companion — the device doing the
//                  READING has nothing to do with whose world this is,
//                  which is the same trap `creatorName` already avoids
//                  (CLAUDE.md → Decision 15).
//
//   Canon Story    Lumo. Decided by the product owner for this sprint.
//                  A Canon Story is owned by nobody (Decision 13) so
//                  there is no Creator's Companion to be its host, and
//                  Decision 13 also requires that a child can never
//                  tell a Canon Story from a Creator Story — a Canon
//                  Story that alone had no host would be exactly that
//                  tell. Lumo is the one Companion that belongs to
//                  VihuPlanet itself and attributes nobody (Canon 2),
//                  so hosting with Lumo says "this story belongs to the
//                  universe" rather than naming an author.
//
// AND ONE NON-ANSWER, WHICH IS DELIBERATE
//
// A Creator Story shared before this shipped carries no Companion, and
// the honest answer is NONE — no substitute, no generic companion, no
// stand-in Lumo. A host that is not the owner's would be a stranger in
// the child's world claiming to live there. It is a disclosed,
// temporary state that clears as stories are re-shared.
//
// The registry is the only source of ids and paths
// (assets/registry.json, read through CompanionEngine.loadRegistry) —
// the same rule js/companionDirector.js, js/magicCardUI.js,
// js/studioRite.js and js/shareCeremony.js already follow. There is no
// `if (id === 'lumo')` here: the Guardian is found by its ROLE, so a
// registry edit keeps working with no code change.
const StoryHost = (function () {
  'use strict';

  // Real canonical art lives directly under assets/ (top level) — see
  // docs/COMPANION_CANON.md → Asset Registration. Same base every other
  // caller on this page uses.
  const ASSETS_BASE = 'assets/';

  let _registry = null;

  function _registryList() {
    if (_registry) return _registry;
    try {
      if (typeof CompanionEngine === 'undefined' || !CompanionEngine.loadRegistry) {
        _registry = Promise.resolve([]);
      } else {
        _registry = CompanionEngine.loadRegistry(ASSETS_BASE)
          .catch(function () { return []; });
      }
    } catch (e) { _registry = Promise.resolve([]); }
    return _registry;
  }

  function _entryBy(test) {
    return _registryList().then(function (list) {
      let found = null;
      (list || []).forEach(function (e) { if (!found && e && test(e)) found = e; });
      return found;
    });
  }

  // The Guardian, as a Companion Record — so a Canon Story's host and a
  // Creator Story's host are the same shape and everything downstream
  // has one thing to handle.
  function _guardian() {
    return _entryBy(function (e) { return e.role === 'guardian'; })
      .then(function (entry) {
        if (!entry) return null;
        return {
          id: entry.id,
          name: entry.name || entry.id,
          species: entry.species || null
        };
      });
  }

  /**
   * Who hosts this Story. Takes a Story Entity as EtherFeed builds it
   * (the Companion rides on `source`, which the runtime copies whole
   * and never reads inside — the same seam `origin` uses), or a plain
   * story record.
   *
   * Resolves to a Companion Record, or null when there is nobody to
   * show. Never rejects: a Story with no host reads exactly as it did
   * before this sprint.
   *
   * @param {object} story
   * @returns {Promise<object|null>}
   */
  function resolve(story) {
    try {
      const src = (story && story.source) || null;
      const origin = (src && src.origin) || (story && story.origin) || 'creator';
      if (origin === 'canon') return _guardian();
      // Opaque: whatever the Story carries, copied whole. This function
      // reads `id` nowhere — packOf() does, once, against the registry.
      const carried = (src && src.companion) || (story && story.companion) || null;
      return Promise.resolve(
        (typeof CompanionRecord !== 'undefined') ? CompanionRecord.clone(carried) : null
      );
    } catch (e) { return Promise.resolve(null); }
  }

  /**
   * The Companion Package behind a record — {basePath, pkg} in exactly
   * the shape js/studioRite.js and js/shareCeremony.js already use, so
   * a pose is `pkg.states[name]` appended to `basePath` and nothing
   * here invents a second art contract.
   *
   * Resolves null when the id is not in the registry. That is the right
   * answer rather than a guessed path: a Companion this build has no
   * art for shows nothing at all, never a substitute.
   *
   * @param {object} record a Companion Record
   * @returns {Promise<{basePath:string,pkg:object}|null>}
   */
  function packOf(record) {
    try {
      if (typeof CompanionRecord === 'undefined' || !CompanionRecord.isValid(record)) {
        return Promise.resolve(null);
      }
      return _entryBy(function (e) { return e.id === record.id; })
        .then(function (entry) {
          if (!entry) return null;
          const basePath = ASSETS_BASE + (entry.path || (entry.id + '/'));
          return fetch(basePath + 'companion.json').then(function (res) {
            return res.ok ? res.json() : null;
          }).then(function (pkg) {
            return (pkg && pkg.states) ? { basePath: basePath, pkg: pkg } : null;
          }).catch(function () { return null; });
        }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  const api = { resolve: resolve, packOf: packOf, ASSETS_BASE: ASSETS_BASE };
  try { window.StoryHost = api; } catch (e) {}
  return api;
})();
