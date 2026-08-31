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

  // A LOCAL record placed by the cards THIS DEVICE holds (S1.2c). A
  // story that lives only locally — shared before cloud sync, or
  // whose platform copy never landed — has no stamped row for the
  // heal below to merge from, but its maker's own Magic Card is
  // right here. Decision 19's evidence standard, device-side: the
  // record's cardId IS its maker; failing that, a creatorName
  // matching exactly ONE local card with a username. Two same-named
  // cards resolve nothing — the wrong child is worse than no name.
  function _localUsernameFor(record) {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.list) return null;
      const cards = MagicCard.list() || [];
      if (record.cardId) {
        for (let i = 0; i < cards.length; i++) {
          if (cards[i] && cards[i].id === record.cardId) {
            return cards[i].username || null;
          }
        }
        return null;
      }
      const name = String(record.creatorName || '');
      if (!name) return null;
      const matches = cards.filter(function (c) {
        return c && c.nickname === name && c.username;
      });
      return matches.length === 1 ? matches[0].username : null;
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
      // The maker's public VihuPlanet name (SOCIAL 1), travelling on
      // the record exactly as creatorName does and for the same
      // reason. Null for canon (never attributed, Decision 13) and
      // for a story whose maker has not chosen one.
      creatorUsername: canon ? null : (record.creatorUsername || null),
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
      // The starlight this Story has been given, and whether it has
      // grown for it. Read here so a Spirit is already grown the
      // moment it is born into the universe — a story that grew
      // yesterday should not have to be cheered again today to look
      // like it.
      cheers: _cheers(record.id),
      grown: _grown(record.id),
      growth: _growth(record.id),
      // `source` is the surface's own back-reference — the runtime
      // copies it wholesale and never reads inside it (physics, the
      // renderer and the story layer have no reason to, and must not
      // start). So it is the right place for origin: a surface that
      // legitimately needs to know where a Story came from can ask,
      // and the universe still cannot tell the two apart.
      source: {
        projectId: record.id,
        origin: canon ? 'canon' : 'creator',
        // The maker's public name rides HERE as well as top-level:
        // storyEntity.js copies a fixed field list and drops what it
        // does not declare (measured — the top-level copy above never
        // reaches a met entity), while `source` is copied wholesale
        // and never read by the runtime. The top-level copy stays for
        // the feed's own cache (byUsername reads _lastLoaded, which
        // is this object before the runtime touches it).
        creatorUsername: canon ? null : (record.creatorUsername || null),
        // WHO LIVES IN THIS STORY (Sprint 1, Companion as World Host).
        //
        // Rides on `source` for exactly the reason `origin` does: the
        // runtime copies this object wholesale and never reads inside
        // it, so physics, the renderer and the story layer cannot tell
        // one Story's host from another's — there is no difference for
        // them to act on, and there must not be. js/storyHost.js is
        // the only thing that reads it.
        //
        // Copied opaquely: a field a future build puts on a Companion
        // Record travels through here without this line changing.
        // Null for a Canon Story, which is owned by nobody and
        // therefore has no owner's Companion — StoryHost resolves that
        // case to Lumo, who belongs to VihuPlanet itself.
        companion: canon
          ? null
          : ((typeof CompanionRecord !== 'undefined')
              ? CompanionRecord.clone(record.companion)
              : (record.companion || null))
      }
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

  // Starlight, when the Cheer module is loaded. Everything here
  // degrades to "none" without it, which is what an Ether with no
  // cheers in it has always looked like.
  //
  // Keyed on the PROJECT id, never the runtime's own 'story-…' id —
  // the same rule the deep link follows (Decision 9). Starlight given
  // to a story has to survive anything the runtime ever renames.
  function _cheers(projectId) {
    try {
      return (typeof Cheer !== 'undefined' && Cheer.count) ? Cheer.count(projectId) : 0;
    } catch (e) { return 0; }
  }
  function _grown(projectId) {
    try {
      return (typeof Cheer !== 'undefined' && Cheer.grown) ? Cheer.grown(projectId) : false;
    } catch (e) { return false; }
  }
  // How grown, 0 → 1 — the only thing the runtime is told about how
  // much starlight a story has. Never a count, so nothing downstream
  // holds a quantity it could display.
  function _growth(projectId) {
    try {
      return (typeof Cheer !== 'undefined' && Cheer.growth) ? Cheer.growth(projectId) : 0;
    } catch (e) { return 0; }
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

  // EVERY PAGE OF THE STORY — one definition, used by the pictures, the
  // tints and the voices alike.
  //
  // THE ETHER READS A STORY AS IT IS. Stated by the product owner:
  // "there is no need for it to have images. a story without images is
  // good for ether." This function used to keep only pages that had a
  // picture, and the consequence was the worst kind: a six-page Story
  // whose pictures had never been rendered arrived in the universe as a
  // ONE-page Story, silently, with nothing anywhere saying so. Measured
  // on a real shared Story — six pages, one readable.
  //
  // A picture is how a page is usually DRAWN; it was never what makes a
  // page exist. So every page is returned, and the portal shows an
  // empty page where there is nothing to draw rather than dropping it.
  // A page a child made is a page a Traveller turns to.
  //
  // Alignment, still: pictures, tints and voices are all derived from
  // this one list, so they cannot disagree about which page is which.
  // That was the reason this function exists at all, and removing the
  // filter makes it MORE true rather than less — there is no longer any
  // way for a missing picture to shift the voices out from under the
  // pages.
  function _readablePages(record) {
    var slides = _pagesIn(record);
    var out = [];
    for (var i = 0; i < slides.length; i++) {
      if (slides[i]) out.push(slides[i]);
    }
    return out;
  }

  // The child's own background colour for each page, so a page with no
  // picture is still THEIR page rather than a white rectangle in a dark
  // universe. Read from the same place the renderer reads it, and null
  // when the page never set one — the portal's own paper shows through
  // then, which is the honest answer rather than an invented colour.
  function tintsOf(projectId) {
    try {
      return _readablePages(_recordFor(projectId)).map(function (s) {
        var co = s && s.metadata && s.metadata.cardOverrides;
        return (co && co.background) || null;
      });
    } catch (e) { return []; }
  }

  function pagesOf(projectId) {
    try {
      // A Canon Story is read exactly like any other — "they can be
      // read" is one of the four things canon is for — and it does not
      // live in the project store, because it is not anybody's project.
      // Same record shape, so one lookup falls through to the other and
      // nothing below this line knows the difference.
      return _readablePages(_recordFor(projectId)).map(function (s) {
        // null, not undefined and never '' — the portal branches on it
        // to show an empty page instead of a broken picture.
        return s.readImage || s.thumbnail || null;
      });
    } catch (e) { return []; }
  }

  // The ☀️ plain renders, aligned index-for-index with pagesOf()
  // (1.2.1). Stamped by the share ceremony beside readImage, so a
  // story shared since then can be KIND-PRINTED from the Ether with
  // truly plain pages. A page with none is null, never a gap — the
  // share panel decides what a missing one means.
  function pagesPlainOf(projectId) {
    try {
      return _readablePages(_recordFor(projectId)).map(function (s) {
        return s.readImagePlain || null;
      });
    } catch (e) { return []; }
  }

  // Local first, and local is usually all of it: CreatorProjectStore
  // reads through an in-memory mirror hydrated from IndexedDB, so this
  // is synchronous once the cache is ready. The cloud is a second
  // source for Stories written on another device, merged by id with
  // local winning — the same local-primary discipline
  // js/creatorProjectSync.js already holds.
  // WHAT THE LAST LOAD ACTUALLY RETURNED — Sprint 1N.3.
  //
  // The Ether asks for the feed once and draws it; counting a maker's
  // other stories must not ask again. So the list this function already
  // produced is remembered, and `othersBy()` counts it. It is a cache
  // of a page's own render rather than a store: it holds whatever the
  // last load returned, it is not persisted, and it goes with the page.
  let _lastLoaded = [];

  /**
   * How many OTHER stories by this maker are in the Ether right now.
   * Null when nothing has been loaded, because absent is the honest
   * answer and a guess is the one thing that must not happen.
   */
  function othersBy(creatorName, excludeId) {
    if (!creatorName || !_lastLoaded.length) return null;
    let n = 0;
    for (let i = 0; i < _lastLoaded.length; i++) {
      const s = _lastLoaded[i];
      if (!s || s.creator !== creatorName) continue;
      if (excludeId && s.id === excludeId) continue;
      n++;
    }
    return n;
  }

  function _remember(list) { try { _lastLoaded = Array.isArray(list) ? list.slice() : []; } catch (e) {} return list; }

  /**
   * SOCIAL 1 — a Creator's public creations, by their public name.
   *
   * The whole answer comes from what the Ether ALREADY shows: the
   * loaded feed is Canon plus everything anybody shared (Decision 15),
   * so filtering it exposes nothing a Traveller could not already
   * drift past — and a private Studio project is unreachable here by
   * construction, because it never entered the feed at all. There is
   * deliberately NO server search endpoint behind this: a name with no
   * public creation is not discoverable anywhere, which is
   * creation-first identity working rather than a gap.
   *
   * Case-insensitive, because @MoonMaker and @moonmaker are the same
   * name however a child types it.
   */
  function byUsername(username) {
    const want = String(username || '').trim().replace(/^@+/, '').toLowerCase();
    if (!want || !_lastLoaded.length) return [];
    const out = [];
    for (let i = 0; i < _lastLoaded.length; i++) {
      const s = _lastLoaded[i];
      if (!s || !s.creatorUsername) continue;
      if (String(s.creatorUsername).toLowerCase() !== want) continue;
      out.push({
        projectId: (s.source && s.source.projectId) || null,
        title: s.title || 'A story',
        cover: s.cover || null,
        creator: s.creator || null,
        username: s.creatorUsername
      });
    }
    return out;
  }

  /* Name suggestions for 🔎 Find a Creator, offered once a child has
   * typed a few characters (asked for by the product owner). The SAME
   * authority as byUsername and for the same reason: only names
   * already riding on public shared stories in the loaded feed can be
   * suggested, so this reveals nothing the universe is not already
   * showing on the Spirits themselves — a Creator who never shared is
   * not suggestible anywhere, by construction. Still no server
   * endpoint, so there is still nothing to enumerate beyond what is
   * public. Prefix match, case-insensitive, a handful at most. */
  const SUGGEST_MIN = 3;
  const SUGGEST_MAX = 6;
  function suggestUsernames(prefix) {
    const want = String(prefix || '').trim().replace(/^@+/, '').toLowerCase();
    if (want.length < SUGGEST_MIN || !_lastLoaded.length) return [];
    const seen = {};
    const out = [];
    for (let i = 0; i < _lastLoaded.length; i++) {
      const s = _lastLoaded[i];
      if (!s || !s.creatorUsername) continue;
      const u = String(s.creatorUsername).toLowerCase();
      if (u.indexOf(want) !== 0 || seen[u]) continue;
      seen[u] = true;
      out.push(u);
    }
    out.sort();
    return out.slice(0, SUGGEST_MAX);
  }

  // The device's cards learn their platform names before the feed is
  // built, so _localUsernameFor has real names to place records with.
  // BOUNDED (Decision 49): a hung platform costs at most four quiet
  // seconds, never a universe that will not open — and after the
  // first answer the call is a no-op for the rest of the visit.
  function _cardNames() {
    try {
      if (typeof MagicCard === 'undefined' || !MagicCard.refreshUsernames) {
        return Promise.resolve();
      }
      let bell = null;
      const capped = new Promise(function (resolve) {
        bell = setTimeout(resolve, 4000);
      });
      return Promise.race([
        Promise.resolve(MagicCard.refreshUsernames()).catch(function () {}),
        capped
      ]).then(function () { clearTimeout(bell); });
    } catch (e) { return Promise.resolve(); }
  }

  function load(opts) {
    opts = opts || {};
    const creator = _creator();

    return _hydrated().then(_cardNames).then(function () {
      const seen = {};
      const out = [];
      // The entity each project id resolved to, so a LATER source can
      // heal attribution on a kept one (see the shared pass below).
      const kept = {};

      // THE PLATFORM IS THE AUTHORITY ON ATTRIBUTION (S1.2b). A
      // device's own copy of a story rightly wins the id collision
      // for CONTENT — but a record saved before its maker had a
      // public name carries no creatorUsername, while the platform's
      // row was stamped by the migration's backfill. So when a later
      // source turns up the same story WITH a name and the kept
      // entity has none, exactly that one field is merged — entity
      // and source alike, since the runtime reads only source. This
      // is why the maker's own Ether shows their @name without
      // waiting for their local records to be rewritten.
      function healUsername(record) {
        const entity = kept[record.id];
        if (!entity || entity.creatorUsername || !record.creatorUsername) return;
        entity.creatorUsername = record.creatorUsername;
        if (entity.source) entity.source.creatorUsername = record.creatorUsername;
      }

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

      // Local-card evidence applies ONLY to this device's own records
      // — never to a stranger's shared story, where a coinciding
      // creatorName would pin the local card's name on somebody
      // else's work.
      function place(entity, record) {
        if (!entity.creatorUsername) {
          const healedName = _localUsernameFor(record);
          if (healedName) {
            entity.creatorUsername = healedName;
            if (entity.source) entity.source.creatorUsername = healedName;
          }
        }
        return entity;
      }

      local.forEach(function (record) {
        seen[record.id] = true;
        if (skip[record.id]) return;
        const entity = place(toStory(record, creator), record);
        kept[record.id] = entity;
        out.push(entity);
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

        if (opts.localOnly) return _remember(out);

        return _cloud().then(function (rows) {
          rows.forEach(function (record) {
            if (!record || skip[record.id]) return;
            if (seen[record.id]) { healUsername(record); return; }
            if (!opts.includeUnpublished && !record.publishedAt) return;
            seen[record.id] = true;
            kept[record.id] = out[out.push(place(toStory(record, creator), record)) - 1];
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
              if (!record || skip[record.id]) return;
              if (seen[record.id]) { healUsername(record); return; }
              if (!record.publishedAt) return;
              seen[record.id] = true;
              // No local creator passed: this Story is somebody else's,
              // so its name must come from the Story itself or be
              // absent. Never from the card on this device.
              out.push(toStory(record, null));
            });
            return _remember(out);
          }).catch(function () { return _remember(out); });
        }).catch(function () { return _remember(out); });
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

      // CATCHING UP WITH EVERYBODY ELSE'S STARLIGHT.
      //
      // The seed above used what this device already knew, so the
      // universe is on screen immediately and every story a child
      // cheered before is already grown. This asks the platform what
      // the rest of VihuPlanet has given since, in ONE call for the
      // whole Ether, and quietly updates any Spirit whose total
      // changed. It never blocks the universe appearing, and with no
      // platform configured it does nothing at all.
      try {
        if (typeof Cheer !== 'undefined' && Cheer.refresh) {
          Cheer.refresh(stories.map(function (s) {
            return s.source && s.source.projectId;
          }).filter(Boolean)).then(function (changed) {
            if (!changed) return;
            stories.forEach(function (s) {
              var pid = s.source && s.source.projectId;
              if (!pid) return;
              var e = universe.stories && universe.stories.get
                ? universe.stories.get(s.id) : null;
              if (!e) return;
              e.cheers = Cheer.count(pid);
              e.grown = Cheer.grown(pid);
              e.growth = Cheer.growth ? Cheer.growth(pid) : 0;
            });
          });
        }
      } catch (e) {}

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
    othersBy: othersBy,
    byUsername: byUsername,
    suggestUsernames: suggestUsernames,
    attach: attach,
    pagesOf: pagesOf,
    pagesPlainOf: pagesPlainOf,
    tintsOf: tintsOf,
    audioOf: audioOf,
    ownerOf: ownerOf,
    publishInto: publishInto,
    toStory: toStory
  };
  try { window.EtherFeed = api; } catch (e) {}
  return api;
})();
