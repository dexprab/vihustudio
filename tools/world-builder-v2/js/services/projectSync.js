// js/services/projectSync.js — Builder Project cloud backup.
//
// A deliberate, disclosed extension of what Supabase is used for in
// this app (docs/THEME_REPOSITORY_ARCHITECTURE.md previously scoped it
// to "the Official + Personal Theme Repositories only"). Until now, an
// in-progress World Builder Project lived only in this browser's own
// localStorage (js/projectStore.js) — a cleared browser, a different
// device, or a localStorage quota failure could lose in-progress
// authoring with no backup anywhere. This module pushes a background
// copy of the current Project to a new `builder_projects` Supabase
// table (supabase/schema.sql), owner-scoped via the exact same
// anonymous-session auth.uid() the Personal Theme Repository already
// establishes — reused via ThemeRepositoryClient.getClient()/
// getSession() rather than a second sign-in or a second config fetch.
//
// "Local-primary, cloud backup" — never a second source of truth.
// js/projectStore.js's localStorage write is still what the Workspace
// reads from and renders immediately; this module's job is only to
// make sure that write isn't the only copy of a Project that exists
// anywhere. Missing/unconfigured Supabase is a normal, handled state
// (push() resolves {ok:false}, never throws) — authoring keeps working
// exactly as before if the cloud backup can't reach Supabase.
const ProjectSync = (function () {
  'use strict';

  const TABLE = 'builder_projects';

  function isAvailable() {
    return window.ThemeRepositoryClient ? window.ThemeRepositoryClient.isConfigured() : Promise.resolve(false);
  }

  // Upserts the full Project (the same JSON shape ProjectStore already
  // persists to localStorage) as one row keyed by the Project's own id.
  // Never throws — every failure (not configured, network, RLS) comes
  // back as {ok:false, error}, so a caller can show a real, disclosed
  // "backup failed" state instead of a silent no-op or a crash.
  function push(project) {
    if (!window.ThemeRepositoryClient) {
      return Promise.resolve({ ok: false, error: new Error('ThemeRepositoryClient did not load') });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from(TABLE).upsert({
          id: project.id,
          owner_id: session.user.id,
          data: project,
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

  // Lists every backup row this browser's own anonymous session owns —
  // "My World Projects should list all my Personal/Official/Growing
  // projects, without any local storage" needs this to reconstruct a
  // fully editable Project when a Personal Theme's own local draft was
  // deleted, cleared, or never existed on this device but was pushed
  // from one where the same anonymous identity was already signed in
  // (a fresh incognito/anonymous session gets its own new auth.uid()
  // and — correctly, since RLS scopes every row by owner_id — will not
  // see another session's rows; this only restores what the *current*
  // session's own identity already backed up). Never throws — the same
  // "missing/unconfigured is a normal, handled state" discipline push()
  // already established; an empty array reads identically to "nothing
  // backed up yet."
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

  // Deletes exactly one backup row by its own Builder Project id
  // (matches the primary key push() writes: `id: project.id`) —
  // owner-scoped so a delete can never touch another session's row
  // even if it somehow guessed the id. Part of the real fix for "I
  // deleted it twice but it keeps coming back": deleting a Personal
  // Theme's local draft alone left this backup row and the Personal
  // Repository row both still real, so the very next "My World
  // Projects" render restored the identical card.
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

  const api = { isAvailable: isAvailable, push: push, list: list, remove: remove };
  try { window.ProjectSync = api; } catch (e) {}
  return api;
})();
