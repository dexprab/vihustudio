// etherCreationLens.js — the one projector from a Story entity to the
// public creative structure a generated experience may use.
//
// SPRINT — Generative Mystery & Challenge Engine.
//
// A CREATION IS AN INGREDIENT; A CREATOR IS NOT. The Ether's shared
// feed already draws the public boundary (Decision 15 — `is_shared`
// by construction, canon shipped with the application), so every
// entity this lens is handed is already public. What the lens adds is
// the second half of Decision 33's discipline: the experience system
// receives a CONSTRUCTED projection, never the record — a whitelist
// of creative structure, built field by field, so nothing private can
// arrive by being adjacent to something public. There is no trimming
// step to keep complete forever; a field this file does not name does
// not exist downstream.
//
// WHAT IS PUBLIC CREATIVE STRUCTURE: the creation's kind, its title
// (already printed under every Spirit), its cover art (already drawn
// on every Spirit), how many pages it has (the one honest count the
// Preview already says), and where its Spirit currently rests. WHAT
// NEVER PASSES: everything else — no maker identity of any kind, no
// ids beyond the entity's own, no record, no `source`, no companion,
// no audio, nothing a privacy rule anywhere else already forbids
// (js/travellerContext.js names the same family).
//
// Pure functions, no DOM, no storage, no network. Loads in Node for
// the offline generation lab and the suite.

(function (global) {
  'use strict';

  // Named so a suite can prove the projection never grows one of
  // these keys — the same family js/travellerContext.js forbids.
  var NEVER = [
    'creator', 'creatorUsername', 'forUsername', 'source', 'companion',
    'publishedAt', 'hasAudio', 'cheers', 'grown', 'growth', 'origin',
    'stars', 'constellation', 'cardId', 'ownerId', 'email', 'memories',
    'orbit', 'circle'
  ];

  // project(entity) → the public creative structure, or null when the
  // entity cannot honestly be an ingredient (no cover to show, mid-
  // focus, not an entity at all). The output is BUILT, never copied.
  function project(entity) {
    if (!entity || typeof entity !== 'object') return null;
    if (typeof entity.id !== 'string' || !entity.id) return null;
    if (!entity.cover || typeof entity.cover !== 'string') return null;
    if (entity.focusT > 0) return null;
    var pages = (typeof entity.pages === 'number' && entity.pages >= 0)
      ? Math.floor(entity.pages) : 0;
    var title = (typeof entity.title === 'string')
      ? entity.title.slice(0, 80) : '';
    var out = {
      kind: 'story',
      id: entity.id,
      title: title,
      pages: pages,
      cover: entity.cover
    };
    if (entity.position &&
        typeof entity.position.x === 'number' &&
        typeof entity.position.y === 'number') {
      out.at = { x: entity.position.x, y: entity.position.y };
    }
    return out;
  }

  // structure(entity) → what an asynchronous GENERATOR may see: the
  // projection minus the cover bytes and minus the place. A generator
  // reasons about creative shape ("a story of five pages with a
  // cover"); it never receives an image and never receives a
  // position, because it composes for a KIND of creation, not for one
  // moment of one visit.
  function structure(entity) {
    var p = project(entity);
    if (!p) return null;
    return { kind: p.kind, pages: p.pages, hasCover: true };
  }

  global.EtherCreationLens = {
    NEVER: NEVER,
    project: project,
    structure: structure
  };
})(typeof window !== 'undefined' ? window : this);
