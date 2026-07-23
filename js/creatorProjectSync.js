// js/creatorProjectSync.js — Creator's first-ever cloud project backup.
//
// Magic Card Identity Evolution, Phase 2. Mirrors
// tools/world-builder-v2/js/services/projectSync.js almost verbatim —
// the exact same "local-primary, cloud backup, never a second source
// of truth" discipline, applied to root Creator's own project data for
// the first time. js/creatorProjectStore.js's localStorage write is
// still what Creator reads from and renders immediately; this module's
// job is only to make sure that write isn't the only copy anywhere,
// once a Magic Card has been claimed (a Traveller never reaches this
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
  //
  // Cloud-Primary Project Storage, Phase 4 — a real, confirmed gap this
  // module carried since it was first built: this push() was a PLAIN,
  // unconditional upsert with no optimistic-concurrency check at all —
  // the exact class of blind-overwrite bug that caused the real
  // "Story-Forest Adventure" data-loss incident for World Builder,
  // before that surface's own Versioned Cloud Sync closed it (see
  // tools/world-builder-v2/js/services/projectSync.js's own push(),
  // mirrored here almost verbatim, not reinvented). `opts.
  // expectedUpdatedAt`, when passed, turns this into a genuine
  // optimistic-concurrency write: the update only takes effect if the
  // cloud row's own `updated_at` still matches what the caller last saw
  // — otherwise this returns {ok:false, conflict:true, cloudUpdatedAt}
  // instead of silently overwriting whatever another tab/session/device
  // already saved for this same Story. Omitting opts (or opts.
  // expectedUpdatedAt) keeps the exact original unconditional-upsert
  // behaviour, so any caller that hasn't opted in yet is unaffected.
  function push(record, opts) {
    opts = opts || {};
    if (!window.ThemeRepositoryClient) {
      return Promise.resolve({ ok: false, error: new Error('ThemeRepositoryClient did not load') });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        const nowIso = new Date().toISOString();
        if (!opts.expectedUpdatedAt) {
          return client.from(TABLE).upsert({
            id: record.id,
            owner_id: session.user.id,
            data: record,
            updated_at: nowIso
          }, { onConflict: 'id' }).then(function (res) {
            if (res.error) throw res.error;
            return { ok: true, updatedAt: nowIso };
          });
        }
        // Chaining .select() after .update() makes PostgREST return the
        // rows it actually touched (Prefer: return=representation) —
        // the one reliable way to tell "the row's updated_at had
        // already moved, so nothing was written" apart from "the write
        // silently didn't happen," mirroring the reference module's own
        // discipline exactly.
        return client.from(TABLE).update({ data: record, updated_at: nowIso })
          .eq('id', record.id).eq('owner_id', session.user.id).eq('updated_at', opts.expectedUpdatedAt)
          .select('id').then(function (res) {
            if (res.error) throw res.error;
            if ((res.data || []).length > 0) return { ok: true, updatedAt: nowIso };
            // Nothing matched — a real conflict (a row exists with a
            // different updated_at, meaning someone else's save already
            // moved it) or simply no row yet at all (a brand-new Story
            // this device has never pushed before) — only the first
            // case is a genuine conflict a caller should ever show.
            return client.from(TABLE).select('updated_at').eq('id', record.id).eq('owner_id', session.user.id).maybeSingle().then(function (checkRes) {
              if (checkRes.error) throw checkRes.error;
              if (!checkRes.data) {
                return client.from(TABLE).insert({
                  id: record.id, owner_id: session.user.id, data: record, updated_at: nowIso
                }).then(function (insertRes) {
                  if (insertRes.error) throw insertRes.error;
                  return { ok: true, updatedAt: nowIso };
                });
              }
              return { ok: false, conflict: true, cloudUpdatedAt: checkRes.data.updated_at };
            });
          });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  // Cloud-Primary Project Storage, Phase 5 — fetches the current cloud
  // row for one Story id, mirroring tools/world-builder-v2/js/services/
  // projectSync.js's own get() exactly. Used for the "is the cloud ahead
  // of what I have locally?" freshness checks js/app.js's restore-modal
  // flow and js/creationFlow.js's "My Projects" open path both run.
  // Resolves null (never throws) when unconfigured, unreachable, or
  // genuinely no row exists yet — the caller already treats that as
  // "nothing to compare, proceed as normal."
  function get(projectId) {
    if (!window.ThemeRepositoryClient) return Promise.resolve(null);
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from(TABLE).select('id,data,updated_at').eq('id', projectId).eq('owner_id', session.user.id).maybeSingle().then(function (res) {
          if (res.error) throw res.error;
          return res.data || null;
        });
      });
    }).catch(function () {
      return null;
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

  const api = { isAvailable: isAvailable, push: push, get: get, list: list, listByOwner: listByOwner, remove: remove };
  try { window.CreatorProjectSync = api; } catch (e) {}
  return api;
})();
