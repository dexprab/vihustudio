// cheer.js — a little starlight, given to a story.
//
// A Cheer is NOT a Like. It is one Creator giving another Creator's
// story a small piece of VihuPlanet's own magic, and the story grows
// for it:
//
//     Story → Cheer → Growth → the story is a little more alive
//
// So there is no score here, no ranking, no ordering, no trending and
// no way to ask who cheered anything. This module can answer exactly
// two questions about a story — how much starlight it has, and whether
// I have already given mine — and it can give one.
//
// ---------------------------------------------------------------
// LOCAL FIRST, THE SAME AS EVERYTHING ELSE IN THIS UNIVERSE
//
// The platform is where a Cheer becomes real for other people, but it
// is never on the critical path of a child tapping something. A tap
// lands locally and instantly; the platform is told afterwards, and
// its answer replaces the local guess when it arrives. With no
// Supabase configured at all this still works exactly as VihuPlanet
// worked before there was a platform: your own Cheers, on your own
// device, and stories that grow because of them.
//
// ---------------------------------------------------------------
// WHO A CHEERER IS
//
// The Magic Card — the identity VihuPlanet already has (Decision 11).
// Not a new identity system, not a fingerprint, and nothing here
// touches the Magic Card itself. A Traveller with no card yet still
// gets to cheer; the platform keys them by their own anonymous
// session, which is the honest answer for somebody who has not said
// who they are.
const Cheer = (function () {
  'use strict';

  var KEY = 'vp-ether-cheers';

  // THE ONE THRESHOLD.
  //
  // Deliberately a constant and deliberately small, so the loop can be
  // felt in testing rather than theorised about. Growth is derived
  // from the count, so moving this number changes when stories grow
  // and needs no migration, no backfill and no stored stage.
  //
  // There is ONE stage. Not ten, not a progression, not an economy —
  // the question this sprint asks is only whether Cheer → Growth is a
  // good loop at all.
  var GROWTH_THRESHOLD = 3;

  // { storyId: { n: <cheers>, mine: true|false } }
  var _mem = null;

  function _read() {
    if (_mem) return _mem;
    _mem = {};
    try {
      var raw = localStorage.getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        Object.keys(parsed).forEach(function (id) {
          var v = parsed[id];
          // The shape this key held BEFORE cheers had a count: a plain
          // `true` meaning "I cheered this". Read forward rather than
          // thrown away — a child's earlier cheers are real.
          if (v === true) _mem[id] = { n: 1, mine: true };
          else if (v && typeof v === 'object') {
            _mem[id] = { n: Math.max(0, v.n | 0), mine: !!v.mine };
          }
        });
      }
    } catch (e) { _mem = {}; }
    return _mem;
  }

  function _write() {
    try { localStorage.setItem(KEY, JSON.stringify(_read())); } catch (e) {}
  }

  function _entry(storyId) {
    var all = _read();
    if (!all[storyId]) all[storyId] = { n: 0, mine: false };
    return all[storyId];
  }

  // The Creator giving the Cheer, or null for a Traveller who has not
  // claimed a card. Read fresh every time: whoever is at the machine
  // now is who is cheering now.
  function _me() {
    try {
      return (typeof MagicCard !== 'undefined' && MagicCard.getActiveId)
        ? (MagicCard.getActiveId() || null) : null;
    } catch (e) { return null; }
  }

  function _client() {
    if (typeof window.ThemeRepositoryClient === 'undefined') return Promise.resolve(null);
    return window.ThemeRepositoryClient.isConfigured().then(function (ok) {
      if (!ok) return null;
      return window.ThemeRepositoryClient.getClient();
    }).catch(function () { return null; });
  }

  // ---------------------------------------------------------------
  // WHAT A STORY HAS
  // ---------------------------------------------------------------
  function count(storyId) {
    var e = _read()[storyId];
    return e ? e.n : 0;
  }

  function mine(storyId) {
    var e = _read()[storyId];
    return !!(e && e.mine);
  }

  // Growth is DERIVED, and that is what makes it persistent for free:
  // it is a fact about the count, and the count is stored. There is no
  // second piece of state to keep in step, nothing to backfill, and no
  // way for a story to be grown while its cheers say otherwise.
  //
  // It also cannot go backwards on its own, because nothing in this
  // sprint ever takes a Cheer away.
  function grown(storyId) {
    return count(storyId) >= GROWTH_THRESHOLD;
  }

  // ---------------------------------------------------------------
  // GIVING ONE
  //
  // Resolves { ok, cheers, added } — `added:false` for a Creator who
  // has already given theirs, which is not a failure and is not worth
  // an error. Repeated taps land here and stop.
  // ---------------------------------------------------------------
  function give(storyId) {
    if (!storyId) return Promise.resolve({ ok: false, added: false, cheers: 0 });
    var e = _entry(storyId);
    if (e.mine) return Promise.resolve({ ok: true, added: false, cheers: e.n });

    // Locally true immediately: the child sees their starlight arrive
    // now, not after a round trip, and it survives a reload even if
    // the network never comes back.
    e.mine = true;
    e.n = e.n + 1;
    _write();
    var optimistic = e.n;

    return _client().then(function (client) {
      if (!client) return { ok: true, added: true, cheers: optimistic, local: true };
      return client.rpc('cheer_story', { p_story_id: storyId, p_cheerer: _me() })
        .then(function (res) {
          if (res.error || !res.data || res.data.ok !== true) {
            return { ok: true, added: true, cheers: optimistic, local: true };
          }
          // The platform's total is the real one — it knows about
          // everybody else's starlight and this device does not.
          var t = _entry(storyId);
          t.n = Math.max(t.n, res.data.cheers | 0);
          t.mine = true;
          _write();
          return { ok: true, added: !!res.data.added, cheers: t.n };
        });
    }).catch(function () {
      return { ok: true, added: true, cheers: optimistic, local: true };
    });
  }

  // ---------------------------------------------------------------
  // CATCHING UP WITH THE UNIVERSE
  //
  // One call for the whole Ether, not one per story. Server totals win
  // where they are larger — a device that cheered offline keeps its
  // own contribution until the platform has it — and a story nobody
  // has cheered anywhere simply is not in the answer.
  // ---------------------------------------------------------------
  function refresh(storyIds) {
    var ids = (storyIds || []).filter(Boolean);
    if (!ids.length) return Promise.resolve(false);
    return _client().then(function (client) {
      if (!client) return false;
      return client.rpc('story_cheer_counts', { p_story_ids: ids, p_cheerer: _me() })
        .then(function (res) {
          if (res.error || !Array.isArray(res.data)) return false;
          var changed = false;
          res.data.forEach(function (row) {
            if (!row || !row.story_id) return;
            var e = _entry(row.story_id);
            var n = row.cheers | 0;
            if (n > e.n) { e.n = n; changed = true; }
            if (row.mine && !e.mine) { e.mine = true; changed = true; }
          });
          if (changed) _write();
          return changed;
        });
    }).catch(function () { return false; });
  }

  var api = {
    GROWTH_THRESHOLD: GROWTH_THRESHOLD,
    count: count,
    mine: mine,
    grown: grown,
    give: give,
    refresh: refresh
  };
  try { window.Cheer = api; } catch (e) {}
  return api;
})();
