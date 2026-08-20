/* HW LIGHT — the readiness light on the handwriting camera picture.
 *
 * The product owner, verbatim: "can we get red and green marker on
 * camera itself to understand when is it reading the data correctly
 * and should be clicked ?"
 *
 * One small soft light drawn ON the live camera picture — the same
 * technique the self-timer countdown already uses (a fixed-position
 * overlay re-measured against the video's own box every frame, so it
 * stays on the picture whatever the layout does). GREEN when the most
 * recent analysed frame ACTUALLY read at the full standard — exactly
 * one card stands, surely named, letters collectable, the same verdict
 * that decides whether a frame collects — and RED when it did not.
 * Green is never a guess: the signal is the live worker's own per-frame
 * verdict (js/hwLive.js → onVerdict), which runs the very hwRead that a
 * pressed Take would run, so "the light is green" and "taking the
 * picture now would read" are one fact, not two opinions.
 *
 * WHERE IT SITS — the top-right corner of the picture, and that corner
 * is chosen by measurement, not taste. In the wide frame a held card is
 * fitted by width and centred: across every one-card fixture the card's
 * top edge lands at y ≥ 190px of the 960-high frame (card-1: 250px,
 * attached: 190px, and a far-away card sits lower still), so the top
 * band is always open desk. The light's lowest pixel sits ~52px down —
 * ≥138px (≥14% of the frame) clear of any card a child can show. The
 * bottom corners are ruled out twice over: the one-card note floats
 * bottom-centre, and hands enter the picture from the bottom.
 *
 * WHAT IT LOOKS LIKE — a light, never an instrument. No corner
 * brackets, no reticle, no sweeping line, no percentage, no text on or
 * near it (Decision 16's spirit, and camera.js's own house rule). And
 * red/green alone is a colour-blindness trap, so the two states differ
 * by SHAPE as well: green is a FILLED round glow, red a soft HOLLOW
 * ring — a lamp that is on, and a lamp that is waiting. Never an X,
 * never a warning triangle, never blame-iconography. States cross-fade
 * gently; under prefers-reduced-motion they simply switch.
 *
 * THE DEBOUNCE — measured, not guessed. Verdicts land every
 * ~600ms (INTERVAL 500ms floor + ~70–100ms analysis; the heaviest
 * honest frame ~350ms pushes one cycle to ~1050ms). A child glancing
 * between the card and the screen must see a stable answer, so a
 * single refused frame between two read frames — a hand wobble, one
 * blurred frame — never blinks the light: green yields only after TWO
 * consecutive non-reading verdicts (~1.2s after the view stops
 * reading), or after HOLD_MS with no reading verdict at all (the
 * backstop for a stalled loop — a wedged worker sends no verdicts, and
 * the light must not claim green into the silence). HOLD_MS = 1200ms
 * covers the worst honest verdict cycle (~1050ms) with margin, so the
 * hold can never expire between two genuine reads. Green needs no
 * debounce: a reading verdict is definitive (refuse-rather-than-guess
 * means the reader has no false yes), and it is the direction where a
 * slow answer would cost a child the moment.
 *
 * This module is DOM only — it owns no camera, no stream, no reading.
 * hwApp.js shows it while the handwriting sweep runs and hides it when
 * the sweep stops; camera.js is untouched and stays flow-agnostic (the
 * drawing capture has no reader, so it gets no light — a light there
 * would be an invented claim).
 */
(function () {
  'use strict';

  const HOLD_MS = 1200;  // green survives at most this long unre-proved
  const REDS = 2;        // …or two consecutive non-reading verdicts
  const INSET = 12;      // px in from the picture's corner

  const state = {
    on: false,
    colour: null,        // 'green' | 'red' | null (hidden)
    verdicts: 0,         // verdicts seen this showing (dev seam)
    reds: 0,             // consecutive non-reading verdicts while green
    lastReadAt: 0,       // when the last reading verdict landed
    history: []          // [{to, why, at, sinceRead}] — the suite's seam
  };

  let video = null;
  let wrap = null, glow = null, ring = null;
  let holdTimer = null;
  let raf = 0;

  function reduced() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function ensure() {
    if (wrap) return;
    wrap = document.createElement('div');
    wrap.id = 'hwReadyLight';
    wrap.setAttribute('aria-hidden', 'true');
    Object.assign(wrap.style, {
      position: 'fixed', display: 'none', pointerEvents: 'none',
      zIndex: '9998'
    });
    // Green: a filled round glow — a small lamp that is on.
    glow = document.createElement('div');
    Object.assign(glow.style, {
      position: 'absolute', inset: '0', borderRadius: '50%',
      background: 'radial-gradient(circle at 42% 38%, ' +
        'rgba(214,244,214,.95), rgba(126,214,148,.9) 55%, rgba(96,180,120,.75))',
      boxShadow: '0 0 14px 4px rgba(126,214,148,.45)',
      opacity: '0'
    });
    // Red: a soft hollow ring — the same lamp, waiting.
    ring = document.createElement('div');
    Object.assign(ring.style, {
      position: 'absolute', inset: '0', borderRadius: '50%',
      border: '3px solid rgba(235,158,140,.9)',
      boxShadow: '0 0 10px 2px rgba(235,158,140,.3), ' +
                 'inset 0 0 6px 1px rgba(235,158,140,.25)',
      background: 'transparent',
      opacity: '0',
      boxSizing: 'border-box'
    });
    wrap.appendChild(glow);
    wrap.appendChild(ring);
    document.body.appendChild(wrap);
  }

  function applyMotion() {
    const t = reduced() ? 'none' : 'opacity .45s ease';
    glow.style.transition = t;
    ring.style.transition = t;
  }

  function clearHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  function setColour(colour, why) {
    if (state.colour === colour) return;
    state.colour = colour;
    const at = performance.now();
    state.history.push({ to: colour, why, at,
      sinceRead: state.lastReadAt ? Math.round(at - state.lastReadAt) : null });
    if (state.history.length > 400) state.history.shift();
    if (glow) glow.style.opacity = colour === 'green' ? '1' : '0';
    if (ring) ring.style.opacity = colour === 'red' ? '1' : '0';
  }

  // Is the live preview actually rendering? (A taken picture stops the
  // tracks and hides the video while the child decides — a light over a
  // still would be a claim about nothing, so it hides with the picture
  // and comes back red when the preview does: a fresh view has proved
  // nothing yet.)
  function rendering() {
    if (!video || !video.videoWidth || video.style.display === 'none') return false;
    if (!video.srcObject) return false;
    const tracks = video.srcObject.getTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
  }

  function place() {
    const r = video.getBoundingClientRect();
    if (!(r.width > 60 && r.height > 60)) return false;
    const d = Math.max(18, Math.min(34, Math.round(0.05 * Math.min(r.width, r.height))));
    wrap.style.width = d + 'px';
    wrap.style.height = d + 'px';
    wrap.style.left = Math.round(r.right - INSET - d) + 'px';
    wrap.style.top = Math.round(r.top + INSET) + 'px';
    return true;
  }

  function track() {
    if (!state.on) return;
    if (rendering() && place()) {
      if (wrap.style.display === 'none') {
        wrap.style.display = 'block';
        state.reds = 0;
        clearHold();
        setColour('red', 'shown');   // nothing has read on THIS view yet
      }
    } else {
      wrap.style.display = 'none';
    }
    raf = requestAnimationFrame(track);
  }

  // One verdict from the live loop: did the analysed frame read at the
  // full standard? (hwApp maps the worker's verdict kind — 'line' or
  // 'sheet' collects, everything else does not.)
  function verdict(reading) {
    if (!state.on) return;
    state.verdicts++;
    if (reading) {
      state.reds = 0;
      state.lastReadAt = performance.now();
      clearHold();
      setColour('green', 'read');
      return;
    }
    if (state.colour !== 'green') {
      state.reds = 0;
      setColour('red', 'refused');
      return;
    }
    state.reds++;
    if (state.reds >= REDS) {
      clearHold();
      setColour('red', 'refused');
      return;
    }
    if (!holdTimer) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (state.on && state.colour === 'green') setColour('red', 'held');
      }, HOLD_MS);
    }
  }

  function show(v) {
    ensure();
    applyMotion();
    video = v;
    state.on = true;
    state.verdicts = 0;
    state.reds = 0;
    cancelAnimationFrame(raf);
    track();
  }

  function hide() {
    if (!state.on) return;
    state.on = false;
    clearHold();
    cancelAnimationFrame(raf);
    raf = 0;
    if (wrap) wrap.style.display = 'none';
    if (state.colour !== null) {
      state.colour = null;
      state.history.push({ to: 'off', why: 'hidden',
        at: performance.now(), sinceRead: null });
    }
    video = null;
  }

  window.HWLight = { show, hide, verdict, state, HOLD_MS, REDS, INSET };
})();
