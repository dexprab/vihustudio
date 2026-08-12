// etherFeed.js — real published Stories, as Story Entities.
//
// The one place where VihuStudio's project data meets the VihuPlanet
// Runtime, and the direction of that dependency is the whole point:
// this module knows about both, the runtime knows about neither. The
// Ether Renderer, the Story Manager and Ether Physics never learn what
// a VihuStudio project is — they receive the Story Entity contract and
// nothing else (see vihuplanet/runtime/stories/storyEntity.js).
//
// Delete this file and the runtime still runs, with no stories in it.
// That is the correct blast radius for an integration.
//
// ---------------------------------------------------------------
// WHAT COUNTS AS PUBLISHED
//
// A Story is in the Ether when its own record carries `publishedAt` —
// stamped by Publish Studio's completion path via
// CreatorProjectStore.markPublished().
//
// This is worth stating plainly because it is new. Before it, nothing
// anywhere recorded which Story had been shared: MagicCard's
// `hasEverPublished` is a single global boolean per browser, and it
// cannot be attributed to a project. So Stories published BEFORE this
// shipped have no arrival date and do not appear — there is no honest
// way to invent one, and guessing would put Stories in VihuPlanet that
// a child never chose to share. Every publish from now on is recorded.
//
// ---------------------------------------------------------------
// WHOSE STORIES
//
// This creator's own, from their own device, plus whatever their Magic
// Card has synced to the cloud. There is no public cross-creator feed
// to read, because there is no public VihuPlanet yet — `creator_projects`
// is a private, card-gated backup, not a shared space. When a real
// shared feed exists, it becomes another source inside `load()` and
// nothing downstream changes: the Ether has always taken a list of
// Story Entities and never asked where they came from.

const EtherFeed = (function () {
  'use strict';

  // A cover is optional in the Story Entity contract — the Ether draws
  // a luminous blank card for a Story that has none, which is what a
  // Story looks like before anyone has seen inside it. So a missing
  // thumbnail is a normal state, never an error.
  function _cover(record) {
    return (record && record.thumbnail) || null;
  }

  function _creator() {
    try {
      if (typeof MagicCard === 'undefined') return null;
      const card = MagicCard.getActive();
      return (card && card.nickname) || null;
    } catch (e) { return null; }
  }

  // A record → the Story Entity contract. This function IS the seam;
  // everything above and below it is plumbing.
  //
  // Note what is NOT copied: the project's `data` payload — every
  // slide, every asset reference, the whole story. The Ether shows a
  // drifting cover and a name, and holding hundreds of full project
  // payloads in memory to do that would be the single most expensive
  // mistake available here. `source` keeps the id, so opening a Story
  // for real (a later phase) can fetch it then.
  function toStory(record, creator) {
    return {
      id: 'story-' + record.id,
      title: record.name || 'A story',
      cover: _cover(record),
      creator: creator || null,
      publishedAt: record.publishedAt || record.updatedAt || null,
      source: { projectId: record.id }
    };
  }

  // Local first, and local is usually all of it: CreatorProjectStore
  // reads through an in-memory mirror hydrated from IndexedDB, so this
  // is synchronous once the cache is ready. The cloud is a second
  // source for Stories written on another device, merged by id with
  // local winning — the same local-primary discipline
  // js/creatorProjectSync.js already holds.
  function load(opts) {
    opts = opts || {};
    const creator = _creator();

    return _hydrated().then(function () {
      const seen = {};
      const out = [];

      let local = [];
      try {
        local = opts.includeUnpublished
          ? CreatorProjectStore.list()
          : CreatorProjectStore.listPublished();
      } catch (e) { local = []; }

      local.forEach(function (record) {
        seen[record.id] = true;
        out.push(toStory(record, creator));
      });

      if (opts.localOnly) return out;

      return _cloud().then(function (rows) {
        rows.forEach(function (record) {
          if (!record || seen[record.id]) return;
          if (!opts.includeUnpublished && !record.publishedAt) return;
          out.push(toStory(record, creator));
        });
        return out;
      }).catch(function () { return out; });
    });
  }

  function _hydrated() {
    try {
      if (typeof CreatorProjectCache === 'undefined') return Promise.resolve();
      if (CreatorProjectCache.isReady()) return Promise.resolve();
      return CreatorProjectCache.hydrate().catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }

  // Unconfigured Supabase, no Magic Card, or no network are all normal
  // handled states here, exactly as they are everywhere else in the
  // Studio — an unreachable cloud means fewer Stories in the Ether,
  // never a broken universe.
  // CreatorProjectSync.list() returns raw table rows shaped
  // {id, data, updated_at}, where `data` is the WHOLE
  // CreatorProjectStore record — name, thumbnail, publishedAt and all —
  // which is exactly why that module stores the whole record rather
  // than the inner payload. Unwrapping it is the only translation this
  // needs.
  function _cloud() {
    try {
      if (typeof CreatorProjectSync === 'undefined') return Promise.resolve([]);
      return Promise.resolve(CreatorProjectSync.list()).then(function (rows) {
        if (!Array.isArray(rows)) return [];
        return rows.map(function (row) {
          return (row && row.data) ? row.data : null;
        }).filter(Boolean);
      });
    } catch (e) { return Promise.resolve([]); }
  }

  // Seed a universe from the real feed, and keep it in step afterwards.
  //
  // `seed` versus `publish` is the distinction the runtime draws and it
  // matters here: Stories already in the Ether when a child opens it
  // did not arrive, they were already there, so they do not animate in.
  // Only a Story published while somebody is watching is born.
  function attach(universe, opts) {
    if (!universe) return Promise.resolve([]);
    opts = opts || {};

    return load(opts).then(function (stories) {
      universe.seed(stories);
      return stories;
    });
  }

  // Called by a live Studio the moment a publish completes, so a Story
  // visibly joins a universe that is already on screen. Nothing calls
  // this yet — the Ether and the Studio are not on the same page today
  // — but this is the entire integration when they are, and it is one
  // function.
  function publishInto(universe, projectId, options) {
    if (!universe || !projectId) return null;
    let record = null;
    try { record = CreatorProjectStore.get(projectId); } catch (e) {}
    if (!record) return null;
    return universe.publish(toStory(record, _creator()), options);
  }

  const api = {
    load: load,
    attach: attach,
    publishInto: publishInto,
    toStory: toStory
  };
  try { window.EtherFeed = api; } catch (e) {}
  return api;
})();
