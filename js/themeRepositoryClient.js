// js/themeRepositoryClient.js — Platform Hardening Sprint, Repository
// Architecture Transition, Phase 1 (Repository Foundation).
//
// New, standalone module. Not yet imported by index.html, tools/
// world-builder, or any Builder/Studio call site — see
// docs/THEME_REPOSITORY_ARCHITECTURE.md for the full design and why
// this phase deliberately stops here ("Do not redesign Builder or
// Studio"). Phase 2/3 wire this into Publish and js/themeRegistry.js.
//
// Implements docs/THEME_REPOSITORY_ARCHITECTURE.md §3's four-function
// Repository interface against Supabase:
//   discover()                       -> [{id, kind, label}]
//   list(repositoryId)                -> [{theme_id, name, version, manifest}]
//   load(repositoryId, themeId)       -> {manifest, theme, assets}
//   publish(repositoryId, {manifest, theme, assetsRaw})
//                                      -> {ok, theme_id}
//
// Config comes from supabase-config.json at the project root (fetched
// at runtime, never hardcoded) — the same resilient
// fetch-with-graceful-fallback shape js/buildInfo.js already uses for
// build-info.json. Missing/empty config is a normal, handled state
// (isConfigured() resolves false), never a thrown error at load time.
// The Supabase JS client itself loads lazily from its official ESM CDN
// build — no package.json, no bundler, matching every other module in
// this repo.
const ThemeRepositoryClient = (function () {
  'use strict';

  const SUPABASE_ESM_URL = 'https://esm.sh/@supabase/supabase-js@2';
  // Resolved relative to this script's own file (js/themeRepositoryClient.js
  // sits one folder below the project root, where supabase-config.json
  // lives) rather than the page that loaded it — a bare relative path
  // would otherwise resolve differently for index.html (project root)
  // vs. tools/world-builder/index.html (two folders deeper), silently
  // 404ing for the Builder and making it look "not configured" even with
  // a real config file in place.
  const CONFIG_URL = (function () {
    const scriptEl = document.currentScript;
    return scriptEl ? new URL('../supabase-config.json', scriptEl.src).href : 'supabase-config.json';
  })();
  const ASSET_BUCKET = 'theme-assets';
  const OFFICIAL_OWNER_SEGMENT = '_official';
  // Postgres treats every NULL as distinct for uniqueness purposes, so
  // an empty-string sentinel — not NULL — is what makes the
  // (repository, owner_id, theme_id) constraint actually unique for
  // every Official row (see docs/THEME_REPOSITORY_ARCHITECTURE.md §2.1).
  const OFFICIAL_OWNER_ID = '';

  let _client = null;
  let _clientPromise = null;
  let _configPromise = null;
  let _authPromise = null;

  function _loadConfig() {
    if (_configPromise) return _configPromise;
    _configPromise = fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no supabase-config.json'); return r.json(); })
      .catch(function () { return { url: '', anonKey: '' }; });
    return _configPromise;
  }

  function isConfigured() {
    return _loadConfig().then(function (cfg) { return !!(cfg && cfg.url && cfg.anonKey); });
  }

  function _getClient() {
    if (_client) return Promise.resolve(_client);
    if (_clientPromise) return _clientPromise;
    _clientPromise = _loadConfig().then(function (cfg) {
      if (!cfg.url || !cfg.anonKey) {
        throw new Error('Supabase is not configured — fill in supabase-config.json (see supabase-config.example.json).');
      }
      return import(SUPABASE_ESM_URL).then(function (mod) {
        _client = mod.createClient(cfg.url, cfg.anonKey);
        return _client;
      });
    });
    return _clientPromise;
  }

  // Real, invisible-to-the-author anonymous session — no email, no
  // password, no UI — so Postgres Row Level Security can enforce
  // ownership against a server-verified auth.uid() instead of trusting
  // a client-supplied id (docs/THEME_REPOSITORY_ARCHITECTURE.md §4).
  function _ensureAuth() {
    if (_authPromise) return _authPromise;
    _authPromise = _getClient().then(function (client) {
      return client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) return res.data.session;
        return client.auth.signInAnonymously().then(function (res2) {
          if (res2.error) throw res2.error;
          return res2.data.session;
        });
      });
    });
    return _authPromise;
  }

  function _ownerSegmentFor(repositoryId, session) {
    return repositoryId === 'personal' ? session.user.id : OFFICIAL_OWNER_SEGMENT;
  }
  function _ownerIdFor(repositoryId, session) {
    return repositoryId === 'personal' ? session.user.id : OFFICIAL_OWNER_ID;
  }

  function discover() {
    return isConfigured().then(function (ok) {
      const repos = [{ id: 'official', kind: 'official', label: 'Official Themes' }];
      if (ok) repos.push({ id: 'personal', kind: 'personal', label: 'Personal Themes' });
      return repos;
    });
  }

  function _authIfPersonal(repositoryId) {
    return repositoryId === 'personal' ? _ensureAuth() : Promise.resolve(null);
  }

  function list(repositoryId) {
    return _getClient().then(function (client) {
      return _authIfPersonal(repositoryId).then(function (session) {
        // Selecting the full manifest (rather than denormalized name/
        // version columns the simplified schema deliberately doesn't
        // have — see supabase/schema.sql's own header note) keeps this
        // a listing, not a load: theme/assets are still left out.
        let q = client.from('themes').select('theme_id,manifest').eq('repository', repositoryId);
        if (repositoryId === 'personal') q = q.eq('owner_id', session.user.id);
        return q.then(function (res) {
          if (res.error) throw res.error;
          return (res.data || []).map(function (row) {
            return { theme_id: row.theme_id, name: row.manifest && row.manifest.name, version: row.manifest && row.manifest.version, manifest: row.manifest };
          });
        });
      });
    });
  }

  // Supabase Storage's list(path) returns only that folder's immediate
  // children — a real file has a real `id`; a "folder" is a synthetic
  // grouping entry with `id: null`, not a real object. Recurses into
  // every folder so a nested asset (e.g. docs/THEME_PROJECT_SPEC.md §9's
  // own example, "textures/linen.png") is actually found — a flat,
  // one-level list silently missed anything not sitting directly under
  // the theme's own root, which is exactly what the golden fixture's
  // own assets/textures/linen.png exercises. Returns full object paths;
  // callers strip their own starting prefix to get a relativePath.
  function _listAllObjectPaths(client, prefix) {
    return client.storage.from(ASSET_BUCKET).list(prefix, { limit: 1000 }).then(function (res) {
      if (res.error) throw res.error;
      const entries = (res.data || []).filter(function (e) { return e && e.name; });
      return Promise.all(entries.map(function (entry) {
        const childPath = prefix + '/' + entry.name;
        if (entry.id === null || entry.id === undefined) {
          return _listAllObjectPaths(client, childPath);
        }
        return Promise.resolve([childPath]);
      })).then(function (groups) {
        return groups.reduce(function (acc, g) { return acc.concat(g); }, []);
      });
    });
  }

  // Assets are resolved by actually listing what's in Storage under
  // this Theme's own prefix — the same "trust what's really there,
  // don't require a separate manifest of it" approach
  // js/themeEngine.js's existing zip-import path already takes for a
  // zip's own assets/ folder (_buildPackageFromZipFiles scans
  // _relatives('assets/') wholesale rather than cross-referencing a
  // declared list).
  function _resolveAssets(client, repositoryId, ownerSegment, themeId) {
    const prefix = repositoryId + '/' + ownerSegment + '/' + themeId;
    return _listAllObjectPaths(client, prefix).then(function (paths) {
      return Promise.all(paths.map(function (objectPath) {
        const relativePath = objectPath.slice(prefix.length + 1);
        // The bucket is created private (supabase/schema.sql) so both
        // repositories' assets stay governed by the same RLS policies
        // as the rest of the schema — a single public bucket would let
        // anyone fetch a Personal asset by guessing its path, bypassing
        // RLS entirely (Supabase's public-bucket endpoint skips RLS by
        // design). A signed URL still requires the signer to hold real
        // SELECT permission under RLS at signing time, so Official
        // assets (readable by anon per themes_official_select's
        // storage-policy twin) and Personal assets (owner-only) both
        // resolve correctly through the one, uniform call.
        return client.storage.from(ASSET_BUCKET).createSignedUrl(objectPath, 3600).then(function (signed) {
          if (signed.error) throw signed.error;
          return [relativePath, signed.data.signedUrl];
        });
      })).then(function (pairs) {
        const assets = {};
        pairs.forEach(function (pair) { if (pair[1]) assets[pair[0]] = pair[1]; });
        return assets;
      });
    });
  }

  function load(repositoryId, themeId) {
    return _getClient().then(function (client) {
      return _authIfPersonal(repositoryId).then(function (session) {
        const ownerSegment = _ownerSegmentFor(repositoryId, session);
        let q = client.from('themes').select('manifest,theme').eq('repository', repositoryId).eq('theme_id', themeId);
        if (repositoryId === 'personal') q = q.eq('owner_id', session.user.id);
        return q.single().then(function (res) {
          if (res.error) throw res.error;
          const row = res.data;
          return _resolveAssets(client, repositoryId, ownerSegment, themeId).then(function (assets) {
            return { manifest: row.manifest, theme: row.theme, assets: assets };
          });
        });
      });
    });
  }

  function _toBlob(value) {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
    const str = String(value);
    const comma = str.indexOf(',');
    const header = str.slice(0, comma);
    const mimeMatch = /data:(.*?);base64/.exec(header);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(str.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // assetsRaw: {relativePath: dataURI|Blob} — the exact shape a
  // Builder-side caller already has on hand today (Project assets are
  // already stored as data URIs — see tools/world-builder/js/
  // projectModel.js's setAsset/getAsset), so no new conversion step is
  // asked of the (not-yet-written) Phase 2 Publish call site beyond
  // what it already holds.
  function publish(repositoryId, payload) {
    const manifest = payload.manifest, theme = payload.theme, assetsRaw = payload.assetsRaw || {};
    const themeId = manifest.id;
    return _getClient().then(function (client) {
      return _authIfPersonal(repositoryId).then(function (session) {
        const ownerSegment = _ownerSegmentFor(repositoryId, session);
        const ownerId = _ownerIdFor(repositoryId, session);
        const uploads = Object.keys(assetsRaw).map(function (relativePath) {
          const objectPath = repositoryId + '/' + ownerSegment + '/' + themeId + '/' + relativePath;
          const blob = _toBlob(assetsRaw[relativePath]);
          return client.storage.from(ASSET_BUCKET).upload(objectPath, blob, { upsert: true });
        });
        return Promise.all(uploads).then(function (results) {
          const failed = results.find(function (r) { return r && r.error; });
          if (failed) throw failed.error;
          return client.from('themes').upsert({
            repository: repositoryId,
            owner_id: ownerId,
            theme_id: themeId,
            manifest: manifest,
            theme: theme
          }, { onConflict: 'repository,owner_id,theme_id' }).then(function (res) {
            if (res.error) throw res.error;
            return { ok: true, theme_id: themeId };
          });
        });
      });
    });
  }

  // Platform Status page (Platform Hardening — Platform Status &
  // Repository Reset). Read-only introspection: how many Theme rows and
  // how many Storage objects a repository actually holds right now —
  // "what exists" without opening Supabase's own dashboard. themeCount
  // is a real row count (this repository/owner scope only — a Personal
  // count is always just the current anonymous session's own rows,
  // since there is no admin/service-role credential in this client-side
  // app to see across users); assetCount walks every one of those
  // themes' asset prefixes via _listAllObjectPaths, the same recursive
  // lister _resolveAssets uses, so the count always matches what would
  // actually resolve.
  function getStats(repositoryId) {
    return _getClient().then(function (client) {
      return _authIfPersonal(repositoryId).then(function (session) {
        const ownerId = _ownerIdFor(repositoryId, session);
        const ownerSegment = _ownerSegmentFor(repositoryId, session);
        return client.from('themes').select('theme_id').eq('repository', repositoryId).eq('owner_id', ownerId).then(function (res) {
          if (res.error) throw res.error;
          const themeIds = (res.data || []).map(function (r) { return r.theme_id; });
          return Promise.all(themeIds.map(function (themeId) {
            const prefix = repositoryId + '/' + ownerSegment + '/' + themeId;
            return _listAllObjectPaths(client, prefix).then(function (paths) { return paths.length; });
          })).then(function (counts) {
            const assetCount = counts.reduce(function (a, b) { return a + b; }, 0);
            return { themeCount: themeIds.length, assetCount: assetCount };
          });
        });
      });
    });
  }

  // Repository Reset (Platform Hardening — Platform Status & Repository
  // Reset). Returns a repository to a clean post-install state: every
  // published Theme row AND every uploaded asset object for this
  // repository/owner scope, nothing else — never Builder Projects
  // (an entirely separate persistence layer, ProjectStore's own
  // localStorage key, never touched by this module at all), never
  // Supabase configuration/auth/schema/buckets themselves. Deletes
  // Storage objects before the theme rows (so a Storage failure never
  // leaves a theme row pointing at now-orphaned-but-still-real assets
  // partway through), then deletes every matching themes row in one
  // statement. Requires the themes_official_delete/themes_personal_delete
  // and matching theme_assets_*_delete Storage policies (supabase/
  // schema.sql) — this sprint's own necessary addition, since deleting
  // was never part of the Publish -> Discover happy flow before now.
  function reset(repositoryId) {
    return _getClient().then(function (client) {
      return _authIfPersonal(repositoryId).then(function (session) {
        const ownerId = _ownerIdFor(repositoryId, session);
        const ownerSegment = _ownerSegmentFor(repositoryId, session);
        return client.from('themes').select('theme_id').eq('repository', repositoryId).eq('owner_id', ownerId).then(function (res) {
          if (res.error) throw res.error;
          const themeIds = (res.data || []).map(function (r) { return r.theme_id; });
          return Promise.all(themeIds.map(function (themeId) {
            const prefix = repositoryId + '/' + ownerSegment + '/' + themeId;
            return _listAllObjectPaths(client, prefix).then(function (paths) {
              if (!paths.length) return null;
              return client.storage.from(ASSET_BUCKET).remove(paths).then(function (removeRes) {
                if (removeRes.error) throw removeRes.error;
              });
            });
          })).then(function () {
            // Chaining .select() after .delete() makes PostgREST return
            // the rows it actually deleted (Prefer: return=representation)
            // instead of the default empty response — this is the ONLY
            // reliable way to know the delete really happened. Without
            // it, a DELETE silently blocked by a missing RLS policy
            // still comes back with no client-side error and an empty
            // response, indistinguishable from "nothing matched" —
            // reporting themeIds.length (the pre-delete SELECT's count)
            // here would lie about success in exactly that case.
            return client.from('themes').delete().eq('repository', repositoryId).eq('owner_id', ownerId).select('theme_id').then(function (res2) {
              if (res2.error) throw res2.error;
              const actuallyDeleted = (res2.data || []).length;
              return { ok: true, deletedThemes: actuallyDeleted, attemptedThemes: themeIds.length };
            });
          });
        });
      });
    });
  }

  const api = {
    isConfigured: isConfigured,
    discover: discover,
    list: list,
    load: load,
    publish: publish,
    getStats: getStats,
    reset: reset
  };
  try { window.ThemeRepositoryClient = api; } catch (e) {}
  return api;
})();
