// js/creatorProjectSync.js — Creator's first-ever cloud project backup.
//
// Magic Card Identity Evolution, Phase 2. Mirrors
// tools/world-builder-v2/js/services/projectSync.js almost verbatim —
// the exact same "local-primary, cloud backup, never a second source
// of truth" discipline, applied to root Creator's own project data for
// the first time. js/creatorProjectStore.js's localStorage write is
// still what Creator reads from and renders immediately; this module's
// job is only to make sure that write isn't the only copy anywhere,
// once a Magic Card has been claimed (a Visitor never reaches this
// module at all — see js/projectManager.js's own guard).
//
// Reuses ThemeRepositoryClient.getClient()/.getSession() exactly like
// js/cardPlatform.js and the reference module already do — never a
// second sign-in, never a second config fetch. Missing/unconfigured
// Supabase is a normal, handled state: every function here resolves
// {ok:false}/[] rather than throwing, so authoring keeps working
// exactly as before if the cloud can't be reached.
const CreatorProjectSync = (function () {
  'use strict';

  const TABLE = 'creator_projects';

  function isAvailable() {
    return window.ThemeRepositoryClient ? window.ThemeRepositoryClient.isConfigured() : Promise.resolve(false);
  }

  // Upserts the WHOLE CreatorProjectStore record ({id,name,thumbnail,
  // createdAt,updatedAt,data}) as one row's `data` — not just the inner
  // ProjectManager.serialize() payload — so a fetched remote row can
  // render a card (name/thumbnail) with zero re-derivation, exactly
  // matching the reasoning already established for the sibling Builder
  // Project Cloud Backup module.
  function push(record) {
    if (!window.ThemeRepositoryClient) {
      return Promise.resolve({ ok: false, error: new Error('ThemeRepositoryClient did not load') });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from(TABLE).upsert({
          id: record.id,
          owner_id: session.user.id,
          data: record,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).then(function (res) {
          if (res.error) throw res.error;
          return { ok: true };
        });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  // My own projects (self auth.uid()) — a convenience wrapper, unused
  // by the recall flow itself (see listByOwner below) but kept for
  // parity with the reference module and any future "what's already
  // backed up" surface.
  function list() {
    if (!window.ThemeRepositoryClient) return Promise.resolve([]);
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from(TABLE).select('id,data,updated_at').eq('owner_id', session.user.id).then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
      });
    }).catch(function () {
      return [];
    });
  }

  // What a successful Magic Card recall calls to pull the ORIGINAL
  // device's projects onto a new one — mirrors
  // ThemeRepositoryClient.loadPersonalByOwner's own naming precedent
  // exactly (a distinct, explicitly-named function rather than an
  // optional param on list(), so "whose data this reads" is never
  // ambiguous at the call site). Relies entirely on creator_projects'
  // own cross-owner SELECT policy (supabase/schema.sql) — this
  // function issues a completely ordinary owner-agnostic SELECT; the
  // database is what decides whether the caller is actually allowed to
  // see another owner's rows (only true once a real magic_card_recalls
  // grant exists for this session).
  function listByOwner(ownerId) {
    if (!window.ThemeRepositoryClient) return Promise.resolve([]);
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function () {
        return client.from(TABLE).select('id,data,updated_at').eq('owner_id', ownerId).then(function (res) {
          if (res.error) throw res.error;
          return res.data || [];
        });
      });
    }).catch(function () {
      return [];
    });
  }

  // Deletes exactly one backup row by its own CreatorProjectStore id —
  // owner-scoped so a delete can never touch another session's row.
  function remove(projectId) {
    if (!window.ThemeRepositoryClient) {
      return Promise.resolve({ ok: false, error: new Error('ThemeRepositoryClient did not load') });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from(TABLE).delete().eq('id', projectId).eq('owner_id', session.user.id).then(function (res) {
          if (res.error) throw res.error;
          return { ok: true };
        });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  const api = { isAvailable: isAvailable, push: push, list: list, listByOwner: listByOwner, remove: remove };
  try { window.CreatorProjectSync = api; } catch (e) {}
  return api;
})();
