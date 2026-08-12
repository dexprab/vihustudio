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
      // How many pages it has. A count, not the pages — reading
      // `.length` copies nothing, and it is the one honest thing the
      // Preview can say about a Story without opening it.
      pages: _pageCount(record),
      source: { projectId: record.id }
    };
  }

  function _pageCount(record) {
    try {
      var slides = record && record.data && record.data.slides;
      return (slides && slides.length) || 0;
    } catch (e) { return 0; }
  }

  // The Story's pages, for reading inside the portal.
  //
  // Every slide carries its own `thumbnail` as a plain data URI —
  // js/projectManager.js keeps it that way deliberately (a disclosed
  // scope decision recorded there), which is what makes page-by-page
  // reading possible here without loading SlideRenderer and the six
  // thousand lines and half the Studio that come with it.
  //
  // The honest limit: these are page THUMBNAILS, so a story read in the
  // Ether is lower resolution than the same story read in the Studio.
  // Wiring SlideRenderer into this page would fix that and is its own
  // piece of work; a real read at thumbnail quality is a great deal
  // better than a portal that opens onto nothing.
  //
  // Local only, on purpose: a cloud round-trip per page turn is not a
  // reading experience.
  function pagesOf(projectId) {
    try {
      var record = CreatorProjectStore.get(projectId);
      var slides = (record && record.data && record.data.slides) || [];
      var out = [];
      for (var i = 0; i < slides.length; i++) {
        if (slides[i] && slides[i].thumbnail) out.push(slides[i].thumbnail);
      }
      return out;
    } catch (e) { return []; }
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

      // A Story can be deliberately held back from the opening seed —
      // one that joined the Ether seconds ago, so the universe can
      // bring it in with the Story Birth sequence instead of having it
      // simply be there. `exclude` is the only thing that knows about
      // that, and it is a set of project ids because that is what the
      // caller has.
      var skip = {};
      (opts.exclude || []).forEach(function (id) { if (id) skip[id] = true; });

      local.forEach(function (record) {
        seen[record.id] = true;
        if (skip[record.id]) return;
        out.push(toStory(record, creator));
      });

      if (opts.localOnly) return out;

      return _cloud().then(function (rows) {
        rows.forEach(function (record) {
          if (!record || seen[record.id] || skip[record.id]) return;
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

      // Nobody recognised on this device means nothing of theirs in the
      // cloud to fetch, so do not go and look.
      //
      // This is not an optimisation. CreatorProjectSync.list() selects
      // rows owned by the CURRENT session's user, and reaching a
      // session at all mints an anonymous Supabase identity if there
      // is not one. A visitor with no Magic Card owns no rows by
      // definition, so the round trip is guaranteed to come back empty
      // — and would leave behind a brand-new anonymous auth user for
      // every single person who so much as opens VihuPlanet. That was
      // tolerable when this file only ran inside the Studio; VihuPlanet
      // is the front door now, and everybody comes through it.
      //
      // A Creator arriving on a NEW device loses nothing here: they own
      // no rows under this browser's fresh session either, and the
      // Stories that ARE theirs arrive by a different route entirely —
      // MagicCard.adopt() pulls them by the recalled identity's own
      // owner id the moment their sky is recognised.
      if (typeof MagicCard === 'undefined' || !MagicCard.list().length) {
        return Promise.resolve([]);
      }
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

  // A Story visibly JOINING a universe that is already on screen,
  // rather than being seeded into one that is still being built.
  //
  // The Studio and VihuPlanet are different documents, so the Studio
  // cannot call this directly — it hands over with `?born=<projectId>`
  // and VihuPlanet Home calls it here, once the child has crossed the
  // threshold and can actually see the universe it arrives into. When
  // the two ever do share a page, this is still the whole integration
  // and it is still one function.
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
    pagesOf: pagesOf,
    publishInto: publishInto,
    toStory: toStory
  };
  try { window.EtherFeed = api; } catch (e) {}
  return api;
})();
