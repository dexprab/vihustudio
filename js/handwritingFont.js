// js/handwritingFont.js — the child's own TTF, worn by the Studio.
//
// "my letters are pictures, where is my ttf font" — the product owner.
// The letters were placeable ink; this module makes them a FONT. The
// builder is the tool page's own, shared (tools/bring-it-alive/js/
// hwFont.js + vendor/opentype.min.js — deterministic, milliseconds,
// family name already "My Handwriting"): kept letters come out of
// HandwritingStore, each PNG's alpha is rebuilt into the exact glyph
// Keep stored, normalized by the same HWLetter.normalize the tool
// uses, and HWFont.build hands back the TTF. The buffer is registered
// as a real FontFace, so 'My Handwriting' is a working family for DOM
// text, canvas text, and — because Publish Studio already preloads
// every real family the moment it opens (Rule 5's race, closed in
// Sprint 8.1.1) — for every export, with no new rendering path.
//
// THE FONT FOLLOWS THE LETTERS. Every letter keep dispatches
// vihu:creation-captured with an 'hw-…' id; this module hears it and
// rebuilds (debounced), so making a letter IS updating the font —
// nothing to press, nothing to know. The built TTF is stored through
// HandwritingStore.saveFont (the migration's own font row: base64 ttf,
// the letters it was built from, builtAt — cloud after, silently), and
// a fresh session wears the STORED font immediately, before rebuilding
// from letters at its leisure.
//
// THE FONT LISTS stay honest: HandwritingFont.withOption(list) hands a
// font <select> the same list plus one more entry — label 'My
// Handwriting', a stack that falls back to Kalam — and only once a
// font actually exists. A child with no letters sees exactly the lists
// they always saw. Letters not yet made simply fall through to the
// fallback family at render time: a story never waits for the
// alphabet to be finished.
(function () {
  'use strict';

  // The font carries its maker's name — "keep the font name as username
  // handwriting" (the product owner). The family is the active card's
  // own nickname ("Vihaan's Handwriting"), so on a shared machine two
  // Creators' fonts are two names, never one ambiguous "mine"; a
  // Traveller holding no card gets the plain 'My Handwriting' until
  // they claim one. The TTF's internal name stays whatever hwFont
  // wrote — a FontFace registers under any family it is given.
  function _creatorName() {
    try {
      const id = (typeof MagicCard !== 'undefined' && MagicCard.activeId) ? MagicCard.activeId()
        : localStorage.getItem('vihu-magic-card-active-id');
      if (!id) return null;
      const cards = (typeof MagicCard !== 'undefined' && MagicCard.list) ? (MagicCard.list() || [])
        : JSON.parse(localStorage.getItem('vihu-magic-cards') || '[]');
      const card = cards.filter(function (c) { return c && c.id === id; })[0];
      return (card && card.nickname) ? String(card.nickname).trim() : null;
    } catch (e) { return null; }
  }
  function _familyName() {
    const name = _creatorName();
    return name ? (name + "'s Handwriting") : 'My Handwriting';
  }
  function _stackFor(family) { return '"' + family + '", "Kalam", "Comic Sans MS", cursive'; }

  let _face = null;          // the registered FontFace, null until one lands
  let _builtFrom = '';       // signature of the letters the face was built from
  let _rebuildTimer = 0;

  function available() { return !!_face; }

  // The seam every font <select> uses: the list, plus the child's own
  // font when it exists. Never mutates the caller's array.
  function withOption(list) {
    if (!_face) return list;
    const fam = api.family;
    if (list.some(function (o) { return o && o.label === fam; })) return list;
    return list.concat([{ value: api.stack, label: fam }]);
  }

  function _b64FromBuffer(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }
  function _bufferFromB64(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  function _register(buffer) {
    const family = _familyName();
    const face = new FontFace(family, buffer);
    return face.load().then(function () {
      if (_face) { try { document.fonts.delete(_face); } catch (e) {} }
      document.fonts.add(face);
      _face = face;
      api.family = family;
      api.stack = _stackFor(family);
      return true;
    });
  }

  function _pngToGlyph(png, w, h) {
    return new Promise(function (resolve, reject) {
      const im = new Image();
      im.onload = function () {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0);
        const data = x.getImageData(0, 0, w, h).data;
        const mask = new Uint8Array(w * h);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        resolve({ mask: mask, w: w, h: h, parts: HWLetter.partsOf(mask, w, h) });
      };
      im.onerror = function () { reject(new Error('letter png failed to decode')); };
      im.src = png;
    });
  }

  // Rebuild from the letters — a no-op when nothing changed. Silence is
  // a correct answer throughout (no letters, no modules, a bad decode):
  // the Studio simply keeps the font it had, or none.
  function rebuild() {
    if (typeof HandwritingStore === 'undefined' || typeof HWFont === 'undefined'
        || typeof HWLetter === 'undefined') return Promise.resolve(false);
    return HandwritingStore.whenReady().then(function () {
      const letters = HandwritingStore.list();
      if (!letters.length) return false;
      const sig = letters.map(function (r) { return r.ch + ':' + r.updatedAt; }).sort().join('|');
      if (sig === _builtFrom) return false;
      return Promise.all(letters.map(function (r) {
        return _pngToGlyph(r.glyph.png, r.glyph.w, r.glyph.h)
          .then(function (glyph) { return { ch: r.ch, sample: HWLetter.normalize(glyph, r.ch) }; })
          .catch(function () { return null; });
      })).then(function (pairs) {
        const samples = new Map();
        pairs.forEach(function (p) { if (p) samples.set(p.ch, p.sample); });
        if (!samples.size) return false;
        const built = HWFont.build(samples, null, {});
        return _register(built.buffer).then(function () {
          _builtFrom = sig;
          const chars = Array.from(samples.keys()).sort().join('');
          try { HandwritingStore.saveFont({ ttf: _b64FromBuffer(built.buffer), letters: chars }); } catch (e) {}
          return true;
        });
      });
    }).catch(function () { return false; });
  }

  function _scheduleRebuild() {
    clearTimeout(_rebuildTimer);
    _rebuildTimer = setTimeout(function () { rebuild(); }, 900);
  }

  function init() {
    if (typeof HandwritingStore === 'undefined') return;
    HandwritingStore.whenReady().then(function () {
      // Wear the stored font first — a fresh device is dressed before a
      // single letter is re-read — then rebuild if the letters moved on.
      const row = HandwritingStore.getFont();
      const wear = (row && row.ttf)
        ? _register(_bufferFromB64(row.ttf)).catch(function () { return false; })
        : Promise.resolve(false);
      wear.then(function () { rebuild(); });
    });
    // Every letter keep updates the font — making letters IS making the
    // font, nothing to press. Non-letter captures are cheap no-ops
    // (rebuild exits on an unchanged signature).
    try {
      document.addEventListener('vihu:creation-captured', function (ev) {
        const id = ev && ev.detail && ev.detail.id;
        if (typeof id === 'string' && id.indexOf('hw-') === 0) _scheduleRebuild();
      });
    } catch (e) {}
  }

  const api = { available: available, withOption: withOption, rebuild: rebuild,
                family: _familyName(), stack: _stackFor(_familyName()) };
  try { window.HandwritingFont = api; } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
