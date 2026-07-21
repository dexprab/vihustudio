// js/cardPlatform.js — World Card Platform v1.
//
// A shareable "World Card" that unlocks one Personal-repository World
// in Creator for a limited number of tries/duration, redeemed by
// matching a real constellation's shape on a 10x10 star grid. This
// module is the platform boundary the design session settled on:
// World Builder and Creator each get only a thin UI hook into the
// functions below — neither owns card logic itself, and neither
// should grow card-specific business logic beyond calling these
// functions and rendering their results. See
// docs/WORLD_CARD_PLATFORM.md for the full design and
// supabase/schema.sql's own "World Card Platform v1" section for the
// backing tables/RPC this module talks to.
//
// Structural mirror of js/themeRepositoryClient.js (IIFE, 'use
// strict', ES5 function style, single window.CardPlatform export in a
// try/catch) — reuses ThemeRepositoryClient.getClient()/.getSession()
// throughout, never a second config fetch or a second sign-in, the
// same reuse convention js/services/projectSync.js already
// established for a different Supabase-backed feature.
//
// Card type family (the approved design's reserved vocabulary):
// Builder / Creator / Unlock / Event / Achievement / Classroom. v1
// implements ONLY Builder Cards (theme-preview) — generate()/redeem()
// both short-circuit to an honest {ok:false,reason:'unsupported_type'}
// for anything else, so the other five types stay inert without a
// schema change once a future sprint is ready to build them.
//
// Uniqueness model (a real design bug found and fixed during the
// wireframe pass, not assumed correct from the start): `constellation`
// is a reusable flavor label, never unique — many cards can be
// "Orion." What's actually unique per card is its own randomly placed
// `pattern` (matched directly on the tap-to-redeem path, no name
// involved) and its DB-generated serial/`code` (paired with
// `constellation` for the secondary typed-fallback path). Neither
// `pattern` nor `code` is ever returned by generate()'s own success
// response beyond what the card's OWNER needs to see it (their own
// minted card); redeem()'s response never includes either at all —
// see supabase/schema.sql's redeem_card() RPC for why.
const CardPlatform = (function () {
  'use strict';

  // Real, hand-placed relative shapes for five widely recognizable
  // constellations — [row,col] pairs on a notional 10x10 field, before
  // _placeConstellation() below randomizes each card's own rotation/
  // mirror/translation. Not astronomically precise; recognizable and
  // pleasant to trace is the actual bar (a rotated Big Dipper still
  // reads as a dipper).
  // "the star marker grid needs rework. it cannot mark any constellation
  // which has crossing lines" -- every connecting-line drawer in this
  // codebase (js/magicCardArt.js's drawBack, js/magicCardUI.js's
  // _renderConstellation) draws a straight line between each consecutive
  // pair of points in THIS array's own order, so that order alone
  // decides whether the shape reads as a clean constellation or an
  // overlapping tangle. CYGNUS's original order (Top, Center, Bottom,
  // Left, Right) drew its last segment (Left-to-Right) straight through
  // the Center point a second time -- exactly the "number 4"-looking
  // defect reported on a real claimed card -- confirmed and reproduced
  // with a real segment-intersection check before being fixed; the
  // other four shapes were checked the same way and were already clean.
  // Reordered to Top, Center, Left, Bottom, Right, which traces the same
  // five points with zero self-crossing or vertex pass-through, verified
  // (not just reasoned) to stay crossing-free across every one of
  // _placeConstellation()'s 4 rotations x mirror-on/off combinations
  // too, since a rotation/reflection/translation never changes whether
  // two line segments cross.
  const CONSTELLATIONS = {
    ORION: [[1, 2], [1, 7], [4, 4], [4, 5], [4, 6], [8, 2], [8, 7]],
    CASSIOPEIA: [[2, 1], [4, 3], [2, 5], [4, 7], [2, 9]],
    URSA_MAJOR: [[1, 1], [1, 4], [3, 4], [3, 2], [4, 5], [6, 7], [8, 8]],
    CYGNUS: [[1, 5], [4, 5], [4, 2], [7, 5], [4, 8]],
    LYRA: [[2, 5], [5, 3], [5, 7], [7, 3], [7, 7]]
  };
  const GRID_SIZE = 10;

  // Rarity is always derived, never chosen directly by the author —
  // ported verbatim from the wireframe's own validated thresholds.
  function computeRarity(tries, hours) {
    if (tries === Infinity && hours === Infinity) return 'legendary';
    if (tries >= 10 || hours >= 168) return 'epic';
    if (tries >= 5 || hours >= 24) return 'rare';
    if (tries >= 2 || hours >= 4) return 'uncommon';
    return 'common';
  }

  function _minOf(points, idx) {
    return points.reduce(function (m, p) { return Math.min(m, p[idx]); }, Infinity);
  }
  function _maxOf(points, idx) {
    return points.reduce(function (m, p) { return Math.max(m, p[idx]); }, -Infinity);
  }
  function _shiftToOrigin(points) {
    const minR = _minOf(points, 0), minC = _minOf(points, 1);
    return points.map(function (p) { return [p[0] - minR, p[1] - minC]; });
  }
  // One 90-degree rotation, applied `turns` times — rotates around the
  // shape's own current bounding box, not a fixed grid, so it composes
  // correctly regardless of how many turns came before it.
  function _rotate(points, turns) {
    let pts = points;
    for (let i = 0; i < turns; i++) {
      const maxR = _maxOf(pts, 0);
      pts = pts.map(function (p) { return [p[1], maxR - p[0]]; });
    }
    return pts;
  }
  function _mirrorHorizontal(points) {
    const maxC = _maxOf(points, 1);
    return points.map(function (p) { return [p[0], maxC - p[1]]; });
  }

  // Picks a random rotation (0/90/180/270) and an optional horizontal
  // mirror, then a random translation so the whole shape fits inside
  // the 10x10 field — this randomized placement, not the constellation
  // name, is what makes every minted card's own `pattern` effectively
  // unique even when many cards share the same named shape. Bounded
  // retry (these 5 curated shapes always fit on a 10x10 field in any
  // orientation, so this should succeed on the first attempt in
  // practice) with a translate-only fallback that's always
  // satisfiable, so this function can never fail to return a pattern.
  function _placeConstellation(name) {
    const base = CONSTELLATIONS[name];
    if (!base) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      let pts = _shiftToOrigin(base);
      pts = _rotate(pts, Math.floor(Math.random() * 4));
      if (Math.random() < 0.5) pts = _mirrorHorizontal(pts);
      pts = _shiftToOrigin(pts);
      const maxR = _maxOf(pts, 0), maxC = _maxOf(pts, 1);
      if (maxR >= GRID_SIZE || maxC >= GRID_SIZE) continue;
      const offR = Math.floor(Math.random() * (GRID_SIZE - maxR));
      const offC = Math.floor(Math.random() * (GRID_SIZE - maxC));
      return { constellation: name, pattern: pts.map(function (p) { return [p[0] + offR, p[1] + offC]; }) };
    }
    const pts = _shiftToOrigin(base);
    return { constellation: name, pattern: pts };
  }

  function _pickConstellationName() {
    const names = Object.keys(CONSTELLATIONS);
    return names[Math.floor(Math.random() * names.length)];
  }

  function _mapCardRow(row) {
    return {
      id: row.id,
      code: row.code,
      constellation: row.constellation,
      pattern: row.pattern,
      label: row.label,
      rarity: row.rarity,
      maxTries: row.max_tries,
      triesUsed: row.tries_used,
      durationSeconds: row.duration_seconds,
      targetThemeId: row.target_theme_id,
      createdAt: row.created_at,
      revokedAt: row.revoked_at
    };
  }

  // Mints one Builder Card for `target.themeId` (must already be a
  // Personal-published Theme this session owns — the DB's own
  // cards_owner_insert policy re-verifies that server-side, so this
  // function doesn't independently re-check it). `opts.maxTries`/
  // `.durationHours` may be null/Infinity for unlimited/forever.
  // Never throws — resolves {ok:false,...} on any failure, matching
  // every other client convention in this codebase.
  function generate(type, target, opts) {
    opts = opts || {};
    if (type !== 'builder') {
      return Promise.resolve({ ok: false, reason: 'unsupported_type' });
    }
    if (typeof window.ThemeRepositoryClient === 'undefined') {
      return Promise.resolve({ ok: false, reason: 'repository_client_unavailable' });
    }
    const placed = _placeConstellation(_pickConstellationName());
    const tries = (opts.maxTries === undefined || opts.maxTries === null || opts.maxTries === Infinity) ? null : opts.maxTries;
    const hours = (opts.durationHours === undefined || opts.durationHours === null || opts.durationHours === Infinity) ? null : opts.durationHours;
    const durationSeconds = hours === null ? null : Math.round(hours * 3600);
    const rarity = computeRarity(tries === null ? Infinity : tries, hours === null ? Infinity : hours);

    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from('cards').insert({
          owner_id: session.user.id,
          card_type: 'builder',
          target_repository: target.repositoryId,
          target_theme_id: target.themeId,
          constellation: placed.constellation,
          pattern: placed.pattern,
          label: opts.label || '',
          rarity: rarity,
          max_tries: tries,
          duration_seconds: durationSeconds
        }).select().single().then(function (res) {
          if (res.error) throw res.error;
          return { ok: true, card: _mapCardRow(res.data) };
        });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  // Lists every card this session owns, optionally scoped to one
  // World (`target.themeId`). Never throws — resolves [] on failure,
  // matching js/themeRegistry.js's own "never block a render on a
  // network hiccup" discipline for read paths.
  function listMine(target) {
    if (typeof window.ThemeRepositoryClient === 'undefined') return Promise.resolve([]);
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        let q = client.from('cards').select('*').eq('owner_id', session.user.id);
        if (target && target.themeId) q = q.eq('target_theme_id', target.themeId);
        return q.order('created_at', { ascending: false }).then(function (res) {
          if (res.error) throw res.error;
          return (res.data || []).map(_mapCardRow);
        });
      });
    }).catch(function () {
      return [];
    });
  }

  // Soft-revoke only (revoked_at, never a hard delete) — blocks *new*
  // redemptions (redeem_card()'s own `revoked_at is null` check) but
  // deliberately does not retroactively pull back an already-live
  // card_redemptions grant. Matches the design's own "revoke makes the
  // card unredeemable" wording (about the card, not about a session
  // that already redeemed it) without a much larger real-time-session-
  // invalidation feature nobody asked for.
  function revoke(id) {
    if (typeof window.ThemeRepositoryClient === 'undefined') {
      return Promise.resolve({ ok: false, reason: 'repository_client_unavailable' });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function (session) {
        return client.from('cards').update({ revoked_at: new Date().toISOString() })
          .eq('id', id).eq('owner_id', session.user.id).then(function (res) {
            if (res.error) throw res.error;
            return { ok: true };
          });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  // Redeems a card by tapped `pattern` ([[row,col],...]) or a typed
  // `{typed:'CONSTELLATION-serial'}` fallback — calls the redeem_card
  // RPC (supabase/schema.sql), which is the ONLY thing ever allowed to
  // compare against a card's real pattern/code. On success, this is
  // where the "what does a theme-preview redemption actually DO"
  // dispatch logic lives — per the architecture boundary, Creator's
  // own code never touches ThemeRepositoryClient/ThemeRegistry
  // directly for this, it only calls redeem() and renders the result.
  // The RPC's own response never includes pattern/code/serial_no/
  // constellation, so neither does this function's — a redeemer's own
  // client never ends up holding the secret it just consumed.
  function redeem(input) {
    input = input || {};
    if (typeof window.ThemeRepositoryClient === 'undefined') {
      return Promise.resolve({ ok: false, reason: 'repository_client_unavailable' });
    }
    return window.ThemeRepositoryClient.getClient().then(function (client) {
      return window.ThemeRepositoryClient.getSession().then(function () {
        return client.rpc('redeem_card', {
          p_pattern: input.pattern || null,
          p_typed_code: input.typed || null
        }).then(function (res) {
          if (res.error) throw res.error;
          const result = res.data;
          if (!result || !result.ok) {
            return { ok: false, reason: (result && result.reason) || 'unknown' };
          }
          if (result.card_type !== 'builder') {
            // Reserved card types have no dispatcher yet in v1 — the
            // RPC itself has no opinion on type, so this is where that
            // stays inert until a future sprint is ready to build one.
            return { ok: false, reason: 'unsupported_type' };
          }
          if (typeof window.ThemeRegistry === 'undefined' || !window.ThemeRegistry.registerRedeemedTheme) {
            return { ok: false, reason: 'registry_unavailable' };
          }
          return window.ThemeRepositoryClient.loadPersonalByOwner(result.target_owner_id, result.target_theme_id)
            .then(function (pkg) {
              // ownerId must ride along here — registerRedeemedTheme's
              // own persisted grant (js/themeRegistry.js) needs it to
              // re-fetch this theme via loadPersonalByOwner() again on
              // a future boot; without it, _rehydrateRedeemed()'s own
              // truthy-ownerId filter would silently drop every
              // redeemed grant the moment the page reloads.
              const reg = window.ThemeRegistry.registerRedeemedTheme(pkg, { expiresAt: result.expires_at, ownerId: result.target_owner_id });
              if (!reg || !reg.ok) return { ok: false, reason: 'grant_failed' };
              return {
                ok: true,
                themeId: result.target_theme_id,
                label: result.label,
                rarity: result.rarity,
                expiresAt: result.expires_at,
                triesRemaining: result.tries_remaining
              };
            }).catch(function () {
              // The try was already spent server-side at this point —
              // a real, disclosed edge case (post-success client-fetch
              // failure), same class as any other network hiccup after
              // a write elsewhere in this codebase, not a false "wrong
              // pattern" the redeemer should be told.
              return { ok: false, reason: 'grant_failed' };
            });
        });
      });
    }).catch(function (error) {
      return { ok: false, error: error };
    });
  }

  const api = {
    CONSTELLATIONS: CONSTELLATIONS,
    computeRarity: computeRarity,
    generate: generate,
    listMine: listMine,
    revoke: revoke,
    redeem: redeem
  };
  try { window.CardPlatform = api; } catch (e) {}
  return api;
})();
