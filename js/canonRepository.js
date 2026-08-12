// canonRepository.js — the Canon Repository.
//
// There are two kinds of story in VihuPlanet and they are different
// things, not two flavours of the same thing:
//
//   A CREATOR STORY is made by a child, owned by that child, and joins
//     the Ether because they chose to share it. It carries who made it.
//   A CANON STORY is made by the VihuPlanet team and is part of the
//     product. It is owned by nobody, it is shipped with the
//     application, and it carries no creator at all.
//
// A child never learns that this distinction exists. In the Ether a
// Canon Story is simply a story that is there — discoverable, readable,
// and never labelled "by VihuPlanet", "by Admin" or by anybody. It
// belongs to the universe.
//
// ---------------------------------------------------------------
// WHERE CANON ACTUALLY LIVES, AND WHY IT IS A FILE
//
// "Canon Stories are shipped with the application. They are not
// uploaded by a Creator." That sentence decides the architecture. This
// product has no server of its own to POST to — the platform it does
// have (`creator_projects`) is a private, card-gated backup of a
// CHILD's work, and putting product content in it would make canon
// somebody's possession, which is the one thing canon is not.
//
// So the Canon Repository is a folder in the repository:
//
//     vihuplanet/canon/canon.json      the manifest — what ships
//     vihuplanet/canon/<id>.json       one file per Canon Story
//
// and "Publish to Canon" produces the file that goes into it. The
// author publishes, gets a file, and commits it. That is not a
// workaround for a missing backend — it is what "shipped with the
// application" means, and it gives canon exactly the properties
// product content should have: reviewed in a pull request, versioned
// in git, identical for every child, and impossible to change by
// accident from a browser.
//
// Locally the author also gets the story immediately, so they can go
// and look at it in the Ether without a deploy. That copy is a
// development convenience and is clearly separated below: `list()`
// returns what SHIPS, `staged()` returns what this browser is holding.
// ---------------------------------------------------------------

const CanonRepository = (function () {
  'use strict';

  // Resolved from this script's own location rather than the page that
  // loaded it, so the Studio (root) and any future surface deeper in
  // the tree both find it. Same reasoning js/themeRepositoryClient.js
  // already applies to supabase-config.json.
  var MANIFEST_URL = (function () {
    var el = document.currentScript;
    return el ? new URL('../vihuplanet/canon/canon.json', el.src).href
              : 'vihuplanet/canon/canon.json';
  })();

  // What this browser has published but not yet committed. Never mixed
  // with the shipped set in storage, only in the merged view.
  var STAGED_KEY = 'vihu-canon-staged';

  var ORIGIN = 'canon';
  var _shipped = null;      // cache of the manifest, per page load

  function _base() { return MANIFEST_URL.replace(/canon\.json$/, ''); }

  function _readStaged() {
    try {
      var raw = localStorage.getItem(STAGED_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function _writeStaged(list) {
    try { localStorage.setItem(STAGED_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // ---------- what ships ----------
  //
  // A missing or empty manifest is a completely normal state — the
  // repository ships empty until the team puts the first story in it —
  // so it resolves to [] and never throws. An Ether with no Canon
  // Stories in it is not broken; it is a young universe.
  function load() {
    if (_shipped) return Promise.resolve(_shipped);
    return fetch(MANIFEST_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (manifest) {
        var ids = (manifest && Array.isArray(manifest.stories)) ? manifest.stories : [];
        if (!ids.length) { _shipped = []; return _shipped; }
        return Promise.all(ids.map(function (id) {
          return fetch(_base() + id + '.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
        })).then(function (rows) {
          _shipped = rows.filter(Boolean).map(_normalise);
          return _shipped;
        });
      })
      .catch(function () { _shipped = []; return _shipped; });
  }

  // Every Canon Story, shipped and staged, as story records shaped like
  // the ones CreatorProjectStore holds — so everything downstream can
  // treat them identically and only `origin` tells them apart.
  function all() {
    return load().then(function (shipped) {
      var seen = {};
      var out = [];
      shipped.forEach(function (r) { seen[r.id] = true; out.push(r); });
      _readStaged().forEach(function (r) {
        if (!r || seen[r.id]) return;
        out.push(_normalise(r));
      });
      return out;
    });
  }

  // A Canon Story record. The shape is deliberately the SAME shape a
  // creator project has, minus everything about ownership: no
  // creatorId, no creatorName, no author. `origin` is what makes it
  // canon, and it is the only field that has to be read to know.
  function _normalise(record) {
    if (!record) return null;
    return {
      id: record.id,
      origin: ORIGIN,
      name: record.name || 'A story',
      thumbnail: record.thumbnail || null,
      createdAt: record.createdAt || null,
      updatedAt: record.updatedAt || null,
      // When it joined the universe. Canon has no "the child chose to
      // share this" moment, so this is simply when it was published to
      // canon — the Ether needs a date and this is the honest one.
      publishedAt: record.publishedAt || record.updatedAt || null,
      frozen: record.frozen !== false,
      data: record.data || null
    };
  }

  // ---------- publishing ----------
  //
  // Freezing is what makes a story canon. A Canon Story is a product
  // asset: once it ships, every child sees the same one, so the act of
  // publishing it is the act of declaring it final. There is no draft
  // state in the repository and nothing edits a story after it is in
  // there — the author edits the project in the Studio, exactly as
  // before, and publishes again.
  // canon_the_falling_star — not canon_msq9w8rd_qz1e0e.
  //
  // This id is not machine plumbing. It is the FILENAME in
  // vihuplanet/canon/ and the line added to canon.json, and both are
  // read by a person reviewing a pull request. Handing them a project
  // id tells that reviewer nothing about what they are approving, in
  // the one place this product deliberately chose review-by-human over
  // a database.
  //
  // Re-publishing the same story deliberately produces the SAME id, so
  // an edit replaces its file and its manifest line rather than
  // accumulating a second copy — the author flow is "edit in the
  // Studio and publish again". Two DIFFERENT stories sharing a name
  // would collide, and the resolution is to rename one, which is right
  // anyway: the name is what a child sees.
  function _slug(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  function freeze(record, opts) {
    opts = opts || {};
    if (!record) return null;
    var now = new Date().toISOString();
    // A name of nothing but emoji or punctuation slugs to '', and the
    // project id is a better answer than an id of 'canon_'.
    var slug = _slug(record.name) || String(record.id || '').replace(/^proj_/, '') || String(Date.now());
    return {
      // A canon id, distinct from a project id on sight. The project it
      // was authored from stays where it is and is not referenced —
      // canon must not depend on a story sitting in one person's
      // browser.
      id: opts.id || ('canon_' + slug),
      origin: ORIGIN,
      name: record.name || 'A story',
      thumbnail: record.thumbnail || null,
      createdAt: record.createdAt || now,
      updatedAt: now,
      publishedAt: now,
      frozen: true,
      data: record.data || null
    };
  }

  // Hold it in this browser so the author can go and look at it in the
  // Ether immediately, without a deploy. This is NOT the repository —
  // committing the file is — and the two are kept apart everywhere
  // except the merged read in all().
  function stage(canonRecord) {
    if (!canonRecord || !canonRecord.id) return { ok: false };
    var list = _readStaged().filter(function (r) { return r && r.id !== canonRecord.id; });
    list.push(canonRecord);
    _writeStaged(list);
    return { ok: true, record: canonRecord };
  }

  function unstage(id) {
    _writeStaged(_readStaged().filter(function (r) { return r && r.id !== id; }));
    return { ok: true };
  }

  function staged() { return _readStaged().map(_normalise); }

  // Synchronous, for callers that cannot await — reading a Story's
  // pages happens inside a click handler and the whole Ether path is
  // built on the project store being a synchronous in-memory mirror.
  // Safe because by the time any Spirit can be met the manifest has
  // already been fetched by load(); before that this correctly returns
  // only what is staged, which is what this browser genuinely knows.
  function cached() {
    var out = (_shipped || []).slice();
    var seen = {};
    out.forEach(function (r) { seen[r.id] = true; });
    _readStaged().forEach(function (r) {
      if (r && !seen[r.id]) out.push(_normalise(r));
    });
    return out;
  }

  function get(id) {
    var list = cached();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // The file that goes into vihuplanet/canon/. Handing the author a
  // real file is the publish step: they commit it, it ships, and every
  // child has it. Returns the filename so the caller can say what to
  // do with it.
  function exportFile(canonRecord) {
    if (!canonRecord) return null;
    var filename = canonRecord.id + '.json';
    try {
      var blob = new Blob([JSON.stringify(canonRecord, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    } catch (e) { return null; }
    return filename;
  }

  // Freeze, keep locally, and hand over the file. One call, because
  // from the author's side it is one action.
  function publish(record, opts) {
    var canon = freeze(record, opts);
    if (!canon) return { ok: false };
    stage(canon);
    var filename = exportFile(canon);
    return { ok: true, record: canon, filename: filename, manifestEntry: canon.id };
  }

  var api = {
    ORIGIN: ORIGIN,
    MANIFEST_URL: MANIFEST_URL,
    load: load,
    all: all,
    staged: staged,
    cached: cached,
    get: get,
    freeze: freeze,
    stage: stage,
    unstage: unstage,
    exportFile: exportFile,
    publish: publish
  };
  try { window.CanonRepository = api; } catch (e) {}
  return api;
})();
