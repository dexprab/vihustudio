// tools/ether-mystery-lab/labConstellations.js — the Lab's projection
// of the project's REAL constellation vocabulary.
//
// SPRINT — Ether Mystery Lab (Decision 58).
//
// GROUND TRUTH, NOT THE BRIEF'S PREMISE. The brief said "88
// constellations"; the project holds EIGHTEEN constellation FAMILIES
// (js/magicCard.js → CONSTELLATIONS + CONSTELLATION_META — seventeen
// mintable plus Ursa Major, kept for the cards that already carry it).
// This module exposes what exists and invents nothing; the 88-vs-18
// discrepancy is reported to the product owner as an open content
// decision, never papered over with a fake list.
//
// READ FROM THE ONE SOURCE, NEVER HAND-MIRRORED. The library lives
// inside js/magicCard.js's closure, and LOADING that file runs its
// per-device repairs against localStorage — which a Lab page must
// never do (loading the Lab must not alter Traveller state). So the
// SOURCE TEXT is fetched and the two object literals are extracted and
// evaluated in isolation: the data is magicCard.js's own, byte for
// byte, and none of that file's behaviour runs. The suite proves the
// extraction matches MagicCard.library() exactly.
//
// THE PRIVACY LINE (Decision 48 — the Stars are the absolute
// exception). The family SHAPE LIBRARY is public vocabulary —
// magicCard.js's own comment says "A FAMILY IS NOT AN IDENTITY" — but
// a child's exact placed CELLS are their credential. What this module
// hands the Lab therefore carries NO CELL COORDINATES AT ALL: a
// generator reasons about a figure's name, star count and resemblance,
// and never receives a pattern it could echo. There is no field for
// one, which is stronger than a filter.
//
// RESEMBLANCE IS SUGGESTIVE, NEVER LITERAL. A whale-like figure must
// not automatically become a whale creature — the ambiguity is part of
// the Mystery — so every row says `suggestive: true` and the
// classification is marked authored-by-the-Lab: the source data has no
// resemblance field, and inventing one silently would be inventing
// metadata that does not exist.
//
// Dual-environment: browser (fetch) and Node (fs), one extraction.

(function (global) {
  'use strict';

  // Authored by the Lab, from each family's own name and `about` line —
  // the one piece of metadata the source does not carry. Marked as
  // authored wherever it travels.
  var RESEMBLANCE = {
    orion: 'human', cassiopeia: 'human', gemini: 'human', aquarius: 'human',
    ursa_major: 'creature', scorpius: 'creature', leo: 'creature',
    taurus: 'creature', canis_major: 'creature', delphinus: 'creature',
    cygnus: 'creature', aries: 'creature',
    pegasus: 'mythical',
    lyra: 'object', crux: 'object', triangulum: 'object',
    sagitta: 'object', corona_borealis: 'object'
  };

  // Extract one `const NAME={ ... };` object literal from the source by
  // balanced-brace scan, and evaluate ONLY that literal. The literals
  // are plain data (arrays, numbers, strings), so `new Function` over
  // them executes no module behaviour.
  function extractLiteral(src, name) {
    var marker = 'const ' + name + '=';
    var at = src.indexOf(marker);
    if (at === -1) return null;
    var i = src.indexOf('{', at);
    if (i === -1) return null;
    var depth = 0, inStr = null;
    for (var j = i; j < src.length; j++) {
      var ch = src[j];
      if (inStr) {
        if (ch === '\\') { j++; continue; }
        if (ch === inStr) inStr = null;
        continue;
      }
      // Comments inside the literal (the source annotates each shape,
      // and an apostrophe in one would otherwise read as a string
      // opening) — skip them whole.
      if (ch === '/' && src[j + 1] === '/') {
        j = src.indexOf('\n', j);
        if (j === -1) return null;
        continue;
      }
      if (ch === '/' && src[j + 1] === '*') {
        j = src.indexOf('*/', j);
        if (j === -1) return null;
        j += 1;
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          var literal = src.slice(i, j + 1);
          try {
            /* eslint-disable no-new-func */
            return (new Function('return (' + literal + ');'))();
          } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  // Build the projection rows from the two extracted literals. The
  // whitelist is the whole of what leaves: id, name, family group,
  // star count, hemisphere, the atlas line, mintable — and the Lab's
  // own authored resemblance. NO pattern, NO cells, NO trace order.
  function projectRows(shapes, meta) {
    if (!shapes) return [];
    return Object.keys(shapes).map(function (key) {
      var m = (meta && meta[key]) || {};
      return {
        figure: m.id || key.toLowerCase(),
        name: m.name || key,
        familyGroup: m.family || '',
        starCount: shapes[key].length,
        hemisphere: m.hemisphere || '',
        about: m.about || '',
        mintable: m.mintable !== false,
        looksLike: RESEMBLANCE[m.id || key.toLowerCase()] || 'unclassified',
        // The classification above is the Lab's, not the product's —
        // and a figure's resemblance must remain SUGGESTIVE: the
        // generator may be inspired by it and may never treat it as
        // the literal thing.
        resemblanceAuthoredBy: 'lab',
        suggestive: true
      };
    });
  }

  var _cache = null;

  // load() → Promise<{ ok, families, sourceCount, note }>. Browser:
  // fetches js/magicCard.js relative to the Lab page. Node: reads it.
  function load(opts) {
    opts = opts || {};
    if (_cache) return Promise.resolve(_cache);
    var getText;
    if (typeof window !== 'undefined' && typeof fetch === 'function' && !opts.sourceText) {
      getText = fetch(opts.url || '../../js/magicCard.js')
        .then(function (r) { return r.ok ? r.text() : null; })
        .catch(function () { return null; });
    } else if (opts.sourceText) {
      getText = Promise.resolve(opts.sourceText);
    } else {
      getText = Promise.resolve(null);
    }
    return getText.then(function (src) {
      if (!src) {
        return { ok: false, families: [], sourceCount: 0,
                 note: 'constellation source unavailable — nothing invented in its place' };
      }
      var shapes = extractLiteral(src, 'CONSTELLATIONS');
      var meta = extractLiteral(src, 'CONSTELLATION_META');
      var rows = projectRows(shapes, meta);
      var out = {
        ok: rows.length > 0,
        families: rows,
        sourceCount: rows.length,
        note: rows.length + ' constellation families exist in this project ' +
              '(js/magicCard.js). The brief\'s "88" does not match the ' +
              'repository; authoring more is a content decision for the ' +
              'product owner.'
      };
      _cache = out;
      return out;
    });
  }

  var api = { load: load, extractLiteral: extractLiteral, projectRows: projectRows, RESEMBLANCE: RESEMBLANCE };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabConstellations = api;
  else global.LabConstellations = api;
})(typeof window !== 'undefined' ? window : this);
