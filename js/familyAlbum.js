// Family Album — client module for the Family Photos feature.
//
// A parent shares one or more PUBLIC Google Photos albums; the kid picks
// photos from them in Studio alongside the ordinary local file picker.
// Three responsibilities live here, and nothing else:
//
//   1. Album CRUD — the shared links are stored per-kid in Supabase
//      (`family_albums`, see supabase/schema.sql), modifiable any time.
//   2. Photo listing — the album page itself is scraped server-side by
//      the `family-album` Edge Function (supabase/functions/family-album/);
//      this module calls it and caches the resulting photo list in
//      localStorage (~1h TTL) so browsing doesn't re-scrape on every open.
//      Thumbnails are plain lh3.googleusercontent URLs loaded directly by
//      <img> tags — zero Supabase egress at browse time.
//   3. Photo pick — the go/no-go test (tools/family-album-test/) verdict
//      was GO (proxy): direct lh3 loads carry no CORS headers and would
//      taint the canvas, so the one moment a kid actually PICKS a photo,
//      the bytes route through the Edge Function's ?img= proxy — one
//      proxied image per pick, never a browsing-time cost.
//
// Creator-only by product decision ("functionality not needed for
//   traveller. infact we can show you need to have companion to guide you
//   in external world") — but that gate is UI-side (js/contextPanel.js
//   shows the companion-framed message); this module itself is identity-
//   agnostic plumbing, mirroring js/creatorProjectSync.js's own shape:
//   defensive functions that never throw (they resolve {ok:false}/[]),
//   reusing window.ThemeRepositoryClient's client + anonymous session.
(function () {
  'use strict';

  var TABLE = 'family_albums';
  var FN_NAME = 'family-album';
  var CACHE_KEY = 'vihu.familyAlbum.photos.v1';
  var CACHE_TTL_MS = 60 * 60 * 1000; // ~1h — album edits show up on the next hour or a forced refresh
  var THUMB_SUFFIX = '=w300-h300';   // browsing grid (direct lh3, free)
  var PICK_SUFFIX = '=w2048-h2048';  // full pick (proxied bytes)

  // Only real Google Photos share links are ever stored or scraped —
  // same allow-list the Edge Function itself enforces server-side.
  var ALBUM_HOSTS = ['photos.app.goo.gl', 'photos.google.com'];

  // Resolve supabase-config.json relative to THIS script's own src, not
  // the page URL — the exact lesson js/themeRepositoryClient.js already
  // learned (a bare relative path silently 404s from any page that isn't
  // at the site root).
  var CONFIG_URL = (function () {
    try {
      if (document.currentScript && document.currentScript.src) {
        return new URL('../supabase-config.json', document.currentScript.src).toString();
      }
    } catch (e) { /* fall through */ }
    return 'supabase-config.json';
  })();

  var _cfgPromise = null;
  // Synchronous mirror of whether the config resolved with real
  // credentials — null until the (fast, same-origin, module-load-time)
  // fetch below settles, then a plain boolean. isAvailable() needs a
  // SYNC answer (js/contextPanel.js decides whether to even render the
  // Family Photos row with it), and the repository client's own
  // isConfigured() is a Promise — a truthy-check on that would be
  // always-true, silently defeating the "unconfigured deployments hide
  // the row" gate (a real bug caught by the Phase 3 verification suite).
  var _configOk = null;
  function _loadConfig() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { return (cfg && cfg.url && cfg.anonKey) ? cfg : null; })
      .catch(function () { return null; })
      .then(function (cfg) { _configOk = !!cfg; return cfg; });
    return _cfgPromise;
  }

  function _fnBase(cfg) {
    return cfg.url.replace(/\/+$/, '') + '/functions/v1/' + FN_NAME;
  }
  // THE SESSION, NOT THE ANON KEY (Sprint 1A, CLAUDE.md -> Decision 30).
  //
  // This function fetches a third-party page and proxies image bytes on
  // VihuPlanet's own name. Reached with the public anon key that made it
  // a fetcher anybody could point at Google on our behalf. The browser
  // already holds a real anonymous Supabase session, so it is sent.
  //
  // `apikey` stays the anon key: Supabase's gateway uses it to route to
  // this project and it authorises nothing on its own.
  function _fnHeaders(cfg, token) {
    return { 'Authorization': 'Bearer ' + token, 'apikey': cfg.anonKey };
  }

  // Resolves { cfg, token } when this browser can actually make the
  // call, and null when it cannot — an unconfigured deployment or a
  // session that could not be established. Both already had a handled
  // 'not_configured' path at every call site, so the stricter gate adds
  // no new failure shape.
  function _ready() {
    var repo = _repo();
    var token = (repo && repo.getSession)
      ? repo.getSession().then(function (s) { return (s && s.access_token) || null; })
                         .catch(function () { return null; })
      : Promise.resolve(null);
    return Promise.all([_loadConfig(), token]).then(function (both) {
      if (!both[0] || !both[1]) return null;
      return { cfg: both[0], token: both[1] };
    });
  }

  function _repo() {
    return (typeof window !== 'undefined' && window.ThemeRepositoryClient) || null;
  }

  // True when the repository layer + this module's own config are both
  // usable. Cheap/synchronous — session establishment happens lazily.
  // Reads the sync _configOk mirror (never repo.isConfigured(), which
  // returns a Promise — always truthy, see _loadConfig's own comment);
  // both read the same supabase-config.json, so they can't disagree.
  function isAvailable() {
    var repo = _repo();
    return !!(repo && _configOk === true &&
      typeof repo.getClient === 'function' && typeof repo.getSession === 'function');
  }

  function isValidAlbumUrl(raw) {
    try {
      var u = new URL(String(raw || '').trim());
      return u.protocol === 'https:' && ALBUM_HOSTS.indexOf(u.hostname) !== -1;
    } catch (e) {
      return false;
    }
  }

  function _clientAndUid() {
    var repo = _repo();
    if (!repo) return Promise.resolve(null);
    return Promise.all([repo.getClient(), repo.getSession()])
      .then(function (pair) {
        var client = pair[0], session = pair[1];
        if (!client || !session || !session.user || !session.user.id) return null;
        return { client: client, uid: session.user.id };
      })
      .catch(function () { return null; });
  }

  function _mapRow(row) {
    return {
      id: row.id,
      ownerId: row.owner_id,
      albumUrl: row.album_url,
      label: row.label || '',
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
      updatedAt: row.updated_at || null,
    };
  }

  function _newId() {
    return 'fam_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------
  // Album CRUD (Supabase table — RLS enforces ownership; the recall
  // grant lets a recalled Creator read the original device's albums
  // by passing opts.ownerId, mirroring CreatorProjectSync.listByOwner)
  // ---------------------------------------------------------------

  function listAlbums(opts) {
    return _clientAndUid().then(function (cu) {
      if (!cu) return [];
      var q = cu.client
        .from(TABLE)
        .select('id, owner_id, album_url, label, sort_order, updated_at');
      // AN EXPLICIT OWNER IS STILL AN EXPLICIT OWNER — the recall path
      // (contextPanel's slide.recallOwnerId, mirroring
      // CreatorProjectSync.listByOwner) names one and gets exactly that
      // list, unchanged.
      //
      // WITH NO OWNER NAMED, THE FILTER IS DROPPED AND THE POLICY
      // DEFINES THE SET. family_albums_select is
      //   owner_id = auth.uid() or has_magic_recall_grant(owner_id)
      // so an unfiltered read returns this session's own albums PLUS the
      // albums of any identity this session has proved a recall for, and
      // nothing else — there is no row it could return that this browser
      // has not already earned.
      //
      // Until now the client filtered to auth.uid() and threw that
      // widening away, which had a real cost once a parent could attach
      // an album by email: the letter's link writes against the
      // identity's own owner_id — the device that CLAIMED the card
      // (supabase/migrations_family_album_link.sql) — so on the claiming
      // device the two are the same value and nothing changes, while the
      // same child on a second device could not see an album the policy
      // was already willing to hand over.
      if (opts && opts.ownerId) q = q.eq('owner_id', opts.ownerId);
      return q
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: true })
        .then(function (res) {
          if (res.error || !Array.isArray(res.data)) return [];
          return res.data.map(_mapRow);
        });
    }).catch(function () { return []; });
  }

  function addAlbum(albumUrl, label) {
    if (!isValidAlbumUrl(albumUrl)) {
      return Promise.resolve({ ok: false, error: 'bad_album_url' });
    }
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false, error: 'unavailable' };
      var row = {
        id: _newId(),
        owner_id: cu.uid,
        album_url: String(albumUrl).trim(),
        label: (label == null ? '' : String(label)),
        sort_order: 0,
        updated_at: new Date().toISOString(),
      };
      return cu.client.from(TABLE).insert(row).select('id').then(function (res) {
        if (res.error) return { ok: false, error: res.error.message || 'insert_failed' };
        return { ok: true, album: _mapRow(row) };
      });
    }).catch(function (e) { return { ok: false, error: (e && e.message) || 'unexpected' }; });
  }

  // fields: any of { albumUrl, label, sortOrder } — partial update.
  function updateAlbum(id, fields) {
    if (!id || !fields) return Promise.resolve({ ok: false, error: 'bad_input' });
    if (fields.albumUrl != null && !isValidAlbumUrl(fields.albumUrl)) {
      return Promise.resolve({ ok: false, error: 'bad_album_url' });
    }
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false, error: 'unavailable' };
      var patch = { updated_at: new Date().toISOString() };
      if (fields.albumUrl != null) patch.album_url = String(fields.albumUrl).trim();
      if (fields.label != null) patch.label = String(fields.label);
      if (fields.sortOrder != null) patch.sort_order = fields.sortOrder | 0;
      // .select() after .update() so a silently-RLS-blocked write reads as
      // a real failure, never a fabricated success (the established
      // ThemeRepositoryClient.reset()/deleteTheme() discipline).
      return cu.client.from(TABLE).update(patch).eq('id', id).eq('owner_id', cu.uid).select('id')
        .then(function (res) {
          if (res.error) return { ok: false, error: res.error.message || 'update_failed' };
          if (!res.data || !res.data.length) return { ok: false, error: 'not_found' };
          return { ok: true };
        });
    }).catch(function (e) { return { ok: false, error: (e && e.message) || 'unexpected' }; });
  }

  function removeAlbum(id) {
    if (!id) return Promise.resolve({ ok: false, error: 'bad_input' });
    return _clientAndUid().then(function (cu) {
      if (!cu) return { ok: false, error: 'unavailable' };
      return cu.client.from(TABLE).delete().eq('id', id).eq('owner_id', cu.uid).select('id')
        .then(function (res) {
          if (res.error) return { ok: false, error: res.error.message || 'delete_failed' };
          if (!res.data || !res.data.length) return { ok: false, error: 'not_found' };
          return { ok: true };
        });
    }).catch(function (e) { return { ok: false, error: (e && e.message) || 'unexpected' }; });
  }

  // ---------------------------------------------------------------
  // Photo listing (Edge Function scrape + localStorage TTL cache)
  // ---------------------------------------------------------------

  function _readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      var map = raw ? JSON.parse(raw) : null;
      return (map && typeof map === 'object') ? map : {};
    } catch (e) { return {}; }
  }
  function _writeCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) { /* cache only */ }
  }

  // Resolves { ok, photos, count, fromCache: false|'fresh'|'stale' } —
  // never rejects. opts.force bypasses a fresh cache; a network/scrape
  // failure falls back to a STALE cached list when one exists (better a
  // slightly old family album than an error screen for a kid).
  function getPhotos(albumUrl, opts) {
    if (!isValidAlbumUrl(albumUrl)) {
      return Promise.resolve({ ok: false, error: 'bad_album_url' });
    }
    var force = !!(opts && opts.force);
    var cacheMap = _readCache();
    var hit = cacheMap[albumUrl];
    if (!force && hit && Array.isArray(hit.photos) && (Date.now() - hit.at) < CACHE_TTL_MS) {
      return Promise.resolve({ ok: true, photos: hit.photos, count: hit.photos.length, fromCache: 'fresh' });
    }
    return _ready().then(function (ready) {
      if (!ready) {
        if (hit && Array.isArray(hit.photos)) return { ok: true, photos: hit.photos, count: hit.photos.length, fromCache: 'stale' };
        return { ok: false, error: 'not_configured' };
      }
      var cfg = ready.cfg;
      return fetch(_fnBase(cfg) + '?url=' + encodeURIComponent(albumUrl), { headers: _fnHeaders(cfg, ready.token) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok || !Array.isArray(j.photos)) {
            var reason = (j && j.error) || 'scrape_failed';
            if (hit && Array.isArray(hit.photos)) return { ok: true, photos: hit.photos, count: hit.photos.length, fromCache: 'stale', staleReason: reason };
            return { ok: false, error: reason };
          }
          var map = _readCache();
          map[albumUrl] = { at: Date.now(), photos: j.photos };
          _writeCache(map);
          return { ok: true, photos: j.photos, count: j.photos.length, fromCache: false };
        })
        .catch(function (e) {
          if (hit && Array.isArray(hit.photos)) return { ok: true, photos: hit.photos, count: hit.photos.length, fromCache: 'stale', staleReason: (e && e.message) || 'network' };
          return { ok: false, error: (e && e.message) || 'network' };
        });
    });
  }

  function clearPhotoCache(albumUrl) {
    var map = _readCache();
    if (albumUrl) delete map[albumUrl];
    else map = {};
    _writeCache(map);
  }

  // Browsing thumbnail URL — direct lh3, loaded by plain <img> (no
  // crossOrigin, no canvas involvement), so tainting never matters here.
  function thumbUrl(photoOrUrl) {
    var base = (photoOrUrl && photoOrUrl.url) || photoOrUrl || '';
    return base ? (base + THUMB_SUFFIX) : '';
  }

  // ---------------------------------------------------------------
  // Photo pick — proxied bytes (GO-proxy verdict), canvas-safe
  // ---------------------------------------------------------------

  // Resolves { ok, dataURL, bytes } — never rejects. The data URL then
  // flows into the exact same pipeline a local file pick uses
  // (Picture Studio -> AssetStore.put), so downstream code never knows
  // the picture came from Google Photos at all.
  function fetchPhotoAsDataURL(photoOrUrl, opts) {
    var base = (photoOrUrl && photoOrUrl.url) || photoOrUrl || '';
    if (!base) return Promise.resolve({ ok: false, error: 'bad_input' });
    var suffix = (opts && opts.sizeSuffix) || PICK_SUFFIX;
    return _ready().then(function (ready) {
      if (!ready) return { ok: false, error: 'not_configured' };
      var proxied = _fnBase(ready.cfg) + '?img=' + encodeURIComponent(base + suffix);
      return fetch(proxied, { headers: _fnHeaders(ready.cfg, ready.token) })
        .then(function (r) {
          var ct = r.headers.get('Content-Type') || '';
          if (ct.indexOf('application/json') !== -1) {
            return r.json().then(function (j) { throw new Error((j && j.error) || ('proxy HTTP ' + r.status)); });
          }
          if (!r.ok) throw new Error('proxy HTTP ' + r.status);
          return r.blob();
        })
        .then(function (blob) {
          return new Promise(function (resolve, reject) {
            var fr = new FileReader();
            fr.onload = function () { resolve({ ok: true, dataURL: fr.result, bytes: blob.size }); };
            fr.onerror = function () { reject(new Error('read_failed')); };
            fr.readAsDataURL(blob);
          });
        })
        .catch(function (e) { return { ok: false, error: (e && e.message) || 'fetch_failed' }; });
    });
  }

  var api = {
    isAvailable: isAvailable,
    isValidAlbumUrl: isValidAlbumUrl,
    listAlbums: listAlbums,
    addAlbum: addAlbum,
    updateAlbum: updateAlbum,
    removeAlbum: removeAlbum,
    getPhotos: getPhotos,
    clearPhotoCache: clearPhotoCache,
    thumbUrl: thumbUrl,
    fetchPhotoAsDataURL: fetchPhotoAsDataURL,
    THUMB_SUFFIX: THUMB_SUFFIX,
    PICK_SUFFIX: PICK_SUFFIX,
  };

  try { window.FamilyAlbum = api; } catch (e) { /* non-browser context */ }

  // Kick the config fetch off at module load so isAvailable()'s sync
  // _configOk mirror is settled long before any UI ever asks (the
  // Context Panel first reads it when the Workspace opens, well after
  // boot). Memoized — every later _loadConfig() call reuses this.
  try { _loadConfig(); } catch (e) { /* never blocks load */ }
})();
