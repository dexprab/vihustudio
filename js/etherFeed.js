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
// EVERYBODY'S. The Ether is a shared space: at any moment it is the
// Canon Stories plus every story anybody has shared with VihuPlanet.
//
// Four sources, in this order, first one wins on a repeated id:
//
//   local   this device's own shared stories
//   canon   the stories VihuPlanet owns, shipped with the application
//   cloud   this creator's own, from wherever their Magic Card has been
//   shared  every story anybody has shared  <-- the public Ether
//
// The last one is what makes it shared rather than per-creator, and it
// arrived exactly as Decision 9 said it would: another source inside
// load(), with nothing downstream changed. The runtime still takes a
// list of Story Entities and still never asks where they came from.
//
// A draft is unreachable through it. `is_shared` on creator_projects is
// a GENERATED column (supabase/schema.sql) and the SELECT policy widens
// only for rows where it is true, so no client can mark a draft shared
// without actually sharing it. Every unshared project stays as private
// as it ever was.
//
// A story's maker travels WITH the story (`creatorName` on the record).
// Reading the Magic Card on the device doing the looking would label
// every story in the Ether with the name of whoever is reading it.

const EtherFeed = (function () {
  'use strict';

  // A cover is optional in the Story Entity contract — the Ether draws
  // a luminous blank card for a Story that has none, which is what a
  // Story looks like before anyone has seen inside it. So a missing
  // thumbnail is a normal state, never an error.
  function _cover(record) {
    if (!record) return null;
    // The FIRST PAGE AT READING SIZE, when the Story carries one.
    //
    // `record.thumbnail` is the 110px image the page strip uses, and a
    // Spirit shows its cover at a couple of hundred pixels and larger
    // still as a child approaches — so the strip thumbnail arrives
    // already softer than the thing it is drawn into. A Story that has
    // been rendered for reading has a far better picture of its own
    // first page sitting right there.
    var pages = _pagesIn(record);
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] && pages[i].readImage) return pages[i].readImage;
    }
    return record.thumbnail || null;
  }

  // Shared Stories that came from other people, kept by project id as
  // load() reads them.
  //
  // Necessary, not an optimisation: a Story somebody else shared is in
  // neither the local project store nor the Canon repository, so
  // without this the Ether would show a Spirit that opens to nothing —
  // a child could approach a story, press Read, and be told it was
  // elsewhere. The records are already fetched in full to build the
  // feed; this simply stops throwing away the part the reader needs.
  var _sharedRecords = {};

  // A Story's record, wherever it lives: this device's own projects
  // first, then Canon, then whatever the shared Ether handed us. One
  // lookup so no caller has to know which kind of Story it is holding.
  function _recordFor(projectId) {
    var record = null;
    try { record = CreatorProjectStore.get(projectId); } catch (e) {}
    if (!record && typeof CanonRepository !== 'undefined') {
      try { record = CanonRepository.get(projectId); } catch (e) {}
    }
    if (!record) record = _sharedRecords[projectId] || null;
    return record;
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
    // Story Origin (Sprint VP3). A CANON story is a product asset owned
    // by nobody, so it carries no creator — not "VihuPlanet", not
    // "Admin", not the name of whoever on the team authored it. There
    // is nowhere on this object to put one, which is the point: in the
    // Ether it is simply a story that is there, and it belongs to the
    // universe.
    //
    // The Story Entity contract already allows a null creator and the
    // story layer already renders that as nothing, so canon needed no
    // change anywhere downstream of this line.
    //
    // `origin` is set here and the runtime DROPS it — storyEntity.js
    // has a fixed field list and copies only what it declares. That is
    // the correct outcome and it is worth stating rather than leaving
    // as an accident: once a story is in the Ether the universe cannot
    // tell a Canon Story from a Creator Story, because there is no
    // difference to tell. They drift the same way, are met the same
    // way and are read the same way. `origin` exists for the surfaces
    // ABOVE the runtime — this function, and anything that later needs
    // to know where a story came from — and deliberately not for
    // physics, the renderer or the story layer, none of which should
    // ever have a reason to ask.
    var canon = record.origin === 'canon';
    return {
      id: 'story-' + record.id,
      title: record.name || 'A story',
      cover: _cover(record),
      // The story's OWN maker, and only then the local card.
      //
      // The Ether is a shared space, so `creator` (read from the Magic
      // Card on THIS device) is the viewer, not necessarily the author.
      // Preferring the record's own creatorName is what stops every
      // story in the Ether being labelled with the name of whoever is
      // looking at it. A record saved before creatorName existed has
      // none, and falls back to the old behaviour — right for the
      // common case, since a device's own stories are the ones it has.
      creator: canon ? null : (record.creatorName || creator || null),
      origin: canon ? 'canon' : 'creator',
      publishedAt: record.publishedAt || record.updatedAt || null,
      // How many pages it has. A count, not the pages — reading
      // `.length` copies nothing, and it is the one honest thing the
      // Preview can say about a Story without opening it.
      pages: _pageCount(record),
      // Does this Story have a voice? Computed from the record here,
      // where project data is understood, rather than by handing the
      // runtime something it would have to look inside.
      hasAudio: _hasAudio(record),
      // `source` is the surface's own back-reference — the runtime
      // copies it wholesale and never reads inside it (physics, the
      // renderer and the story layer have no reason to, and must not
      // start). So it is the right place for origin: a surface that
      // legitimately needs to know where a Story came from can ask,
      // and the universe still cannot tell the two apart.
      source: { projectId: record.id, origin: canon ? 'canon' : 'creator' }
    };
  }

  // A saved project serialises its pages as `data.pages`
  // (js/projectManager.js). This read asked for `data.slides` — the
  // name they have in AppState while the Studio is running, and a name
  // that is nowhere in the stored record. It therefore found nothing,
  // for every Story, from the day the Ether shipped: every Spirit
  // reported zero pages and every portal offered "Story is elsewhere".
  //
  // Both names are accepted rather than one corrected, because the
  // canon publish path builds its record straight from the live slides
  // and genuinely does write `slides`. Two honest shapes, one reader.
  function _pagesIn(record) {
    var data = record && record.data;
    if (!data) return [];
    var list = data.pages || data.slides;
    return Array.isArray(list) ? list : [];
  }

  // True when any page carries narration. Deliberately just a boolean —
  // the Ether shows that a Story can be heard, and nothing more.
  function _hasAudio(record) {
    try {
      var pages = _pagesIn(record);
      for (var i = 0; i < pages.length; i++) {
        var n = pages[i] && pages[i].metadata && pages[i].metadata.narration;
        if (n && n.ref) return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function _pageCount(record) {
    try { return _pagesIn(record).length; } catch (e) { return 0; }
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
  // A Story's narration, page by page, aligned index-for-index with
  // pagesOf() so the reader can turn a page and reach for the same
  // slot in both.
  //
  // Returns whatever the page carries: a `data:` URI on a Canon Story
  // (embedded when it was published, so a browser that never met the
  // author can play it), or a `vihu-asset:` reference on a child's own
  // Story, which only resolves on the device that recorded it. Both are
  // handed over as-is — resolving is the reader's job, and it already
  // knows how, because AssetStore.resolve() passes a data: URI straight
  // through.
  //
  // A page with no narration is `null`, never a gap: a story where only
  // the third page was recorded still lines up.
  function audioOf(projectId) {
    try {
      return _readablePages(_recordFor(projectId)).map(function (p) {
        var n = p && p.metadata && p.metadata.narration;
        return (n && n.ref) || null;
      });
    } catch (e) { return []; }
  }

  // The owner of a Story that came from the shared feed, or null for
  // one of this device's own (where the recording is in this browser's
  // IndexedDB and no owner is needed to find it). Only ever used to
  // resolve assets — see the portal's playVoice().
  function ownerOf(projectId) {
    try {
      var record = _recordFor(projectId);
      return (record && record.__ownerId) || null;
    } catch (e) { return null; }
  }

  // THE PAGES THE PORTAL CAN ACTUALLY SHOW — one definition, used by
  // both the pictures and the voices.
  //
  // They used to be built twice, and differently: pagesOf() skipped any
  // page with no picture while audioOf() kept a slot for every page in
  // the record. Their own comment claimed they were "aligned
  // index-for-index", and for most stories they were — but one page
  // without a thumbnail is enough to shift every voice after it onto
  // the wrong picture, or off the end into silence. A comment is not a
  // guarantee; deriving both from the same list is.
  function _readablePages(record) {
    var slides = _pagesIn(record);
    var out = [];
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (!s) continue;
      // `readImage` is the page rendered at reading size; `thumbnail`
      // is the 110px one the page strip uses. Preferring the first and
      // falling back to the second means a Story published before
      // reading images existed still opens — softly, but it opens,
      // and that is the same trade this portal has always made.
      if (s.readImage || s.thumbnail) out.push(s);
    }
    return out;
  }

  function pagesOf(projectId) {
    try {
      // A Canon Story is read exactly like any other — "they can be
      // read" is one of the four things canon is for — and it does not
      // live in the project store, because it is not anybody's project.
      // Same record shape, so one lookup falls through to the other and
      // nothing below this line knows the difference.
      return _readablePages(_recordFor(projectId)).map(function (s) {
        return s.readImage || s.thumbnail;
      });
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

      // ---------- Canon ----------
      //
      // The official stories of VihuPlanet, shipped with the
      // application. They join the Ether on exactly the same terms as
      // everything else and are indistinguishable from a Creator Story
      // once they are in it — they drift, they can be met, they can be
      // read. The one difference is upstream of here and is the whole
      // distinction: they carry no creator, because they are owned by
      // nobody.
      //
      // Merged BEFORE the cloud pass and after the local one, so a
      // child's own stories always win an id collision. Canon ids are
      // `canon_*` and project ids are `proj_*`, so a collision is not
      // actually reachable — the ordering is belt and braces for a
      // future that renames one of them.
      return _canon().then(function (canonRows) {
        canonRows.forEach(function (record) {
          if (!record || seen[record.id] || skip[record.id]) return;
          seen[record.id] = true;
          out.push(toStory(record, null));
        });

        if (opts.localOnly) return out;

        return _cloud().then(function (rows) {
          rows.forEach(function (record) {
            if (!record || seen[record.id] || skip[record.id]) return;
            if (!opts.includeUnpublished && !record.publishedAt) return;
            seen[record.id] = true;
            out.push(toStory(record, creator));
          });

          // ---------- everybody else's shared Stories ----------
          //
          // "Anybody who pushes a story to VihuPlanet shows in the
          // Ether." This is that source, and it is the last one for a
          // reason: a Story this device already has — its own, or a
          // Canon Story — wins, so nothing appears twice and a child's
          // own story is always the local copy.
          //
          // Failure here is a quieter universe, never a broken one:
          // no network, no configured platform and a database without
          // the is_shared column all resolve to an empty list, and the
          // child still sees Canon plus their own.
          return _shared().then(function (sharedRows) {
            sharedRows.forEach(function (record) {
              if (!record || seen[record.id] || skip[record.id]) return;
              if (!record.publishedAt) return;
              seen[record.id] = true;
              // No local creator passed: this Story is somebody else's,
              // so its name must come from the Story itself or be
              // absent. Never from the card on this device.
              out.push(toStory(record, null));
            });
            return out;
          }).catch(function () { return out; });
        }).catch(function () { return out; });
      });
    });
  }

  // Canon is optional in every sense: the module may not be loaded on a
  // given surface, the manifest may be missing, and it ships empty. All
  // three resolve to "no Canon Stories", which is a young universe
  // rather than a broken one.
  function _canon() {
    try {
      if (typeof CanonRepository === 'undefined') return Promise.resolve([]);
      return CanonRepository.all().catch(function () { return []; });
    } catch (e) { return Promise.resolve([]); }
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
  // Every Story anybody has shared. Unwraps the same {id, data,
  // updated_at} row shape _cloud() does — `data` is the whole
  // CreatorProjectStore record.
  //
  // Deliberately does NOT require a Magic Card on this device. A
  // Traveller with no card of their own should still arrive in a
  // universe that has other people's stories in it; that is the
  // difference between a shared Ether and a private one.
  function _shared() {
    try {
      if (typeof CreatorProjectSync === 'undefined' || !CreatorProjectSync.listShared) {
        return Promise.resolve([]);
      }
      return CreatorProjectSync.listShared().then(function (rows) {
        var records = (rows || []).map(function (row) {
          if (!row || !row.data) return null;
          // WHO RECORDED THIS STORY'S VOICE.
          //
          // Carried on the record in memory only, never persisted: a
          // page's narration is a `vihu-asset:` reference, and the
          // Storage path it resolves through is built from the owner
          // who put it there. Reading a shared Story without it finds
          // nothing and the page reads in silence — which is exactly
          // what happened, and the first thing anybody notices about a
          // story somebody recorded their voice into.
          try{ row.data.__ownerId = row.owner_id || null; }catch(e){}
          return row.data;
        }).filter(Boolean);
        // Kept so the portal can actually open them — see _sharedRecords.
        records.forEach(function (r) { if (r && r.id) _sharedRecords[r.id] = r; });
        return records;
      }).catch(function () { return []; });
    } catch (e) { return Promise.resolve([]); }
  }

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
    var record = _recordFor(projectId);
    if (!record) return null;
    return universe.publish(toStory(record, _creator()), options);
  }

  const api = {
    load: load,
    attach: attach,
    pagesOf: pagesOf,
    audioOf: audioOf,
    ownerOf: ownerOf,
    publishInto: publishInto,
    toStory: toStory
  };
  try { window.EtherFeed = api; } catch (e) {}
  return api;
})();
