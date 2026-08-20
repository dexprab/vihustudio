/* HW APP — the MY HANDWRITING journey's UI wiring on the standalone page.
 *
 * THE LETTER GRID (the product owner, verbatim: "make a grid of letters
 * and numerals. a kid can tap on any of them and show the letter in his
 * writing. and we capture that letter. makes the job easier. also once
 * the scan is in allow user to check it and adjust if a stroke is
 * missing here and there").
 *
 * Four marks: THE GRID → SHOW ME → CHECK IT → TRY YOUR LETTERS.
 *
 *   · The GRID is the front door and the progress view in one: A–Z,
 *     a–z, 0–9, each tile a faint reference letterform until the
 *     child's own captured letter fills it. Tap any tile, any order,
 *     any time — a filled one to do it again. No percent, no pressure;
 *     the grid filling up IS the progress.
 *   · Tapping a tile ARMS the shared capture entry for that ONE letter
 *     (the picker, the drop zone and the camera, all unchanged —
 *     app.js owns them). The tap declares the letter's identity; the
 *     reader (js/hwLetter.js) only finds the ink.
 *   · GREEN TAKES THE PICTURE: on the live camera, the readiness light
 *     (js/hwLight.js, its verdict seam re-aimed at the one-letter
 *     reader) turns green when one clear letter stands in view, and a
 *     steady beat of green auto-takes the capture from the very frame
 *     that read (js/hwLetterLive.js). Take and the timer stay as
 *     manual fallbacks a child never needs.
 *   · CHECK IT: every capture — auto, Take, or upload — lands on the
 *     check screen: the letter large beside its small reference form,
 *     a pencil to draw a missing stroke, an eraser for smudges, a live
 *     preview of the tile, and Keep · Show me again.
 *   · Build works at ANY point with whatever letters exist — hwFont
 *     omits missing letters from the cmap, so words borrow a plain
 *     letter there.
 *
 * window.__hw is the developer seam, exactly as window.__bia is for the
 * drawing flow: the suite and a human in devtools read the journey's
 * state through it.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  // Three rows: lowercase, capitals, digits — each group starts a fresh
  // grid row so the capitals read as their own row of the alphabet.
  const GROUPS = ['abcdefghijklmnopqrstuvwxyz',
                  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
                  '0123456789'];
  const ALPHABET = GROUPS.join('');

  const state = {
    stage: 'idle',      // idle · grid · armed · reading · check · test
    armed: false,
    letter: null,       // the tapped tile's letter while armed / checking
    samples: new Map(), // ch → hwFont-ready sample (normalized)
    glyphs: new Map(),  // ch → the kept native-res glyph {mask,w,h,parts}
    check: null,        // the check screen's working state
    font: null,         // {buffer, report}
    builds: 0
  };
  window.__hw = state;
  state.live = HWLetterLive.state;   // the developer seam sees the loop

  function log(msg) {
    console.log('[hw] ' + msg);
    const el = $('devLog');
    el.textContent += msg + '\n';
    el.scrollTop = el.scrollHeight;
  }

  function go(step) {
    for (const s of document.querySelectorAll('.step')) s.classList.remove('here');
    $(step).classList.add('here');
  }

  function reduced() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---- the grid --------------------------------------------------------------
  // One drawing for a kept letter everywhere it appears — the tile and
  // the check screen's preview share this, so they cannot disagree.
  function drawInk(canvas, mask, w, h, box) {
    canvas.width = box; canvas.height = box;
    const ctx = canvas.getContext('2d');
    const s = Math.min((box - 8) / w, (box - 8) / h);
    const ox = (box - w * s) / 2, oy = (box - h * s) / 2;
    const img = ctx.createImageData(box, box);
    for (let y = 0; y < box; y++) {
      for (let x = 0; x < box; x++) {
        const sx = Math.floor((x - ox) / s), sy = Math.floor((y - oy) / s);
        if (sx >= 0 && sx < w && sy >= 0 && sy < h && mask[sy * w + sx]) {
          const d = (y * box + x) * 4;
          img.data[d] = 231; img.data[d + 1] = 234; img.data[d + 2] = 243;
          img.data[d + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function renderTile(slot, ch) {
    const old = slot.querySelector('canvas, .hw-slot-ref');
    if (old) old.remove();
    const sample = state.samples.get(ch);
    if (sample) {
      slot.classList.remove('empty');
      slot.classList.add('made');
      const c = document.createElement('canvas');
      drawInk(c, sample.mask, sample.w, sample.h, 56);
      slot.appendChild(c);
    } else {
      slot.classList.add('empty');
      slot.classList.remove('made');
      const r = document.createElement('div');
      r.className = 'hw-slot-ref';
      r.textContent = ch;
      slot.appendChild(r);
    }
  }

  function buildGrid() {
    const grid = $('hwGrid');
    if (grid.childElementCount) return;
    for (const group of GROUPS) {
      if (group !== GROUPS[0]) {
        const br = document.createElement('div');
        br.className = 'hw-grid-break';
        grid.appendChild(br);
      }
      for (const ch of group) {
        const slot = document.createElement('div');
        slot.className = 'hw-slot';
        slot.dataset.ch = ch;
        slot.setAttribute('role', 'button');
        slot.tabIndex = 0;
        const label = document.createElement('div');
        label.className = 'hw-slot-label';
        label.textContent = ch;
        slot.appendChild(label);
        slot.addEventListener('click', () => arm(ch));
        slot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arm(ch); }
        });
        grid.appendChild(slot);
        renderTile(slot, ch);
      }
    }
  }

  function renderGrid() {
    buildGrid();
    for (const slot of document.querySelectorAll('#hwGrid .hw-slot')) {
      renderTile(slot, slot.dataset.ch);
    }
    const have = state.samples.size;
    $('hwGridNote').textContent = have === 0
      ? 'Tap any letter, write it big anywhere you like, and show it to me — I’ll catch it.'
      : have === ALPHABET.length
        ? 'Every letter is here — all yours. Tap any of them to make it again.'
        : have + ' of ' + ALPHABET.length + ' letters are yours so far. ' +
          'Tap an empty letter to add it — or one of yours to make it again.';
    $('hwBuildBtn').disabled = have === 0;
  }

  function showGrid() {
    renderGrid();
    $('hwLetterQuiet').style.display = 'none';
    state.stage = 'grid';
    state.letter = null;
    go('stepHwGrid');
  }
  $('hwEntryBtn').addEventListener('click', showGrid);
  $('hwGridBack').addEventListener('click', () => { state.stage = 'idle'; go('stepCapture'); });

  // ---- arming the shared capture entry ---------------------------------------
  // ONE camera, TWO framings (the field finding that named the two-block
  // entry): while the letter journey is armed, the title, the drop words
  // and the camera line all say THIS LETTER; disarmed, they say DRAWING
  // again, byte for byte — the defaults are read from the page itself so
  // the two cannot drift.
  const FRAMING = {
    title: $('captureTitle').textContent,
    drop: $('dropWords').textContent,
    camera: $('cameraNote').textContent
  };
  function setFraming(letter) {
    if (letter != null) {
      $('captureTitle').textContent = '✍️ My Handwriting — show me your ' + letter;
      $('dropWords').textContent = 'Drop a photo of your ' + letter + ' here';
      $('cameraNote').textContent = 'Hold your ' + letter + ' up, nice and big — ' +
        'when the light shines green, I take the picture myself.';
    } else {
      $('captureTitle').textContent = FRAMING.title;
      $('dropWords').textContent = FRAMING.drop;
      $('cameraNote').textContent = FRAMING.camera;
    }
    document.body.classList.toggle('hw-armed', letter != null);
  }

  function arm(ch) {
    state.armed = true;
    state.letter = ch;
    state.stage = 'armed';
    HWLetterLive.reset();      // each arming is a fresh loop — nothing stale
    const banner = $('hwArmed');
    $('hwArmedRef').textContent = ch;
    $('hwArmedText').textContent = 'Write a big ' + ch +
      ' anywhere you like — dark pen or pencil — and hold it up to the ' +
      'camera, or drop a photo of it. The picture takes itself when your ' +
      'letter is ready.';
    banner.style.display = 'block';
    $('hwLetterQuiet').style.display = 'none';
    setFraming(ch);
    go('stepCapture');
  }
  function disarm() {
    state.armed = false;
    stopLive();
    $('hwArmed').style.display = 'none';
    setFraming(null);
  }
  $('hwDisarmBtn').addEventListener('click', () => { disarm(); showGrid(); });

  // The existing capture entry, unchanged, is the way in: when a photo
  // lands while armed, app.js steps to the claim as it always does and
  // this observer takes over from there.
  new MutationObserver(() => {
    if (!state.armed) return;
    if (!$('stepClaim').classList.contains('here')) return;
    const ch = state.letter;
    disarm();
    const photo = window.__bia && window.__bia.photo;
    if (photo) readPhoto(ch, photo);
  }).observe($('stepClaim'), { attributes: true, attributeFilter: ['class'] });

  // ---- the live camera: green takes the picture ------------------------------
  // The one-letter overlay on the live preview — a gentle floating line;
  // it clears by itself the moment the view holds one letter (or none).
  function showOneLetterNote(on) {
    $('hwOneLetterNote').style.display = on ? 'block' : 'none';
  }

  // A small quiet capture cue: the picture settles — a soft white breath
  // over the video, never a shutter sound, never scanning theatrics.
  function captureCue() {
    if (reduced()) return;
    const v = $('cameraLive');
    const r = v.getBoundingClientRect();
    if (!(r.width > 0)) return;
    const cue = document.createElement('div');
    Object.assign(cue.style, {
      position: 'fixed', left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px',
      background: 'rgba(255,255,255,.55)', borderRadius: '6px',
      pointerEvents: 'none', zIndex: '9999',
      transition: 'opacity .4s ease', opacity: '1'
    });
    cue.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cue);
    requestAnimationFrame(() => { cue.style.opacity = '0'; });
    setTimeout(() => cue.remove(), 500);
  }

  function startLive() {
    // The readiness light rides on the live preview for exactly as long
    // as the loop runs (js/hwLight.js). Green is the worker's own
    // reading verdict — a 'letter' frame is one that would capture,
    // which is also exactly what a pressed Take would read — so the
    // light and the shutter can never disagree. The drawing journey
    // never starts this loop, so it never gets a light: it has no
    // reader, and a light there would be an invented claim.
    HWLight.show($('cameraLive'));
    HWLetterLive.start($('cameraLive'), {
      log,
      onVerdict: (kind) => HWLight.verdict(kind === 'letter'),
      onMany: showOneLetterNote,
      onCapture: autoTaken
    });
    log('hw: watching for your ' + state.letter +
        ' — green takes the picture by itself');
  }
  function stopLive() {
    HWLetterLive.stop();
    HWLight.hide();
    showOneLetterNote(false);
  }

  function autoTaken(glyph) {
    const ch = state.letter;
    captureCue();
    stopLive();
    BIACamera.closePanel();
    disarm();
    log('hw: the light held green — picture taken by itself (' +
        glyph.w + 'x' + glyph.h + 'px of ink, ' + glyph.parts + ' part(s))');
    enterCheck(ch, glyph);
  }

  // The loop lives exactly as long as the camera panel is open while the
  // journey is armed. camera.js already closes the panel when the step
  // is left or the page hides, so the light discipline is one rule.
  new MutationObserver(() => {
    const open = $('cameraPanel').style.display === 'block';
    if (open && state.armed) startLive();
    else if (!open) stopLive();
  }).observe($('cameraPanel'), { attributes: true, attributeFilter: ['style'] });

  // ---- reading an uploaded / taken photo -------------------------------------
  function refuseKindly(ch, why) {
    // Child-safe: the letter is never "wrong" — the picture just didn't
    // show one clear letter yet. The child stays armed for the same
    // letter and simply tries again.
    const q = $('hwLetterQuiet');
    q.textContent = why === 'many'
      ? 'One letter at a time, please — show me just your ' + ch +
        ', on its own, and I’ll catch it.'
      : why === 'small'
        ? 'Your ' + ch + ' looks tiny from here — write it bigger, or ' +
          'bring it closer, and show me again.'
        : 'I couldn’t find your ' + ch + ' in that picture yet — write it ' +
          'big and dark on plain paper, and show me again.';
    arm(ch);
    q.style.display = 'block';
  }

  function readPhoto(ch, photo) {
    state.stage = 'reading';
    $('hwLetterQuiet').style.display = 'none';
    go('stepHwReading');
    setTimeout(() => {
      let res;
      try {
        res = HWLetter.read(photo, { log });
      } catch (e) {
        console.error('[hw]', e);
        log('hw: reading threw — ' + (e && e.message ? e.message : e));
        res = { kind: 'nothing', why: 'blank' };
      }
      if (res.kind !== 'letter') {
        refuseKindly(ch, res.kind === 'many' ? 'many' : res.why);
        return;
      }
      enterCheck(ch, res.glyph);
    }, 40);
  }

  // ---- check it: the pencil, the eraser, the keep ----------------------------
  // The kept ink is edited at CAPTURE resolution with breathing room on
  // every side, so a missing dot can be drawn ABOVE the ink the camera
  // found. On Keep the mask is trimmed back to its ink.
  function enterCheck(ch, glyph) {
    const pad = Math.max(24, Math.round(0.3 * Math.max(glyph.w, glyph.h)));
    const w = glyph.w + 2 * pad, h = glyph.h + 2 * pad;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < glyph.h; y++) {
      for (let x = 0; x < glyph.w; x++) {
        if (glyph.mask[y * glyph.w + x]) mask[(y + pad) * w + (x + pad)] = 1;
      }
    }
    state.check = { ch, mask, w, h, tool: 'pencil',
                    brush: Math.max(3, Math.round(Math.max(glyph.w, glyph.h) / 45)),
                    edits: 0 };
    state.letter = ch;
    $('hwCheckRef').textContent = ch;
    $('hwCheckWords').textContent = 'Here’s your ' + ch +
      ' — does it look right? Pencil draws a missing bit back in, the ' +
      'eraser cleans a smudge away.';
    $('hwCheckQuiet').style.display = 'none';
    setTool('pencil');
    paintCheck();
    paintPreview();
    state.stage = 'check';
    go('stepHwCheck');
  }

  function paintCheck() {
    const c = $('hwCheckCanvas');
    const k = state.check;
    c.width = k.w; c.height = k.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(k.w, k.h);
    for (let i = 0; i < k.mask.length; i++) {
      const d = i * 4;
      if (k.mask[i]) {
        img.data[d] = 29; img.data[d + 1] = 36; img.data[d + 2] = 51;
      } else {
        img.data[d] = 253; img.data[d + 1] = 252; img.data[d + 2] = 248;
      }
      img.data[d + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function trimmed() {
    const k = state.check;
    let x0 = k.w, x1 = -1, y0 = k.h, y1 = -1;
    for (let y = 0; y < k.h; y++) {
      for (let x = 0; x < k.w; x++) {
        if (k.mask[y * k.w + x]) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        mask[y * w + x] = k.mask[(y + y0) * k.w + (x + x0)];
      }
    }
    return { mask, w, h };
  }

  // The preview IS the tile, by construction: it draws the same
  // normalized sample Keep would store, through the same drawInk the
  // grid uses — so what the child sees here is byte-for-byte what the
  // tile will show.
  function paintPreview() {
    const t = trimmed();
    const c = $('hwCheckPreview');
    if (!t) {
      c.width = 56; c.height = 56;
      return;
    }
    const s = HWLetter.normalize(
      { mask: t.mask, w: t.w, h: t.h,
        parts: HWLetter.partsOf(t.mask, t.w, t.h) },
      state.check.ch);
    drawInk(c, s.mask, s.w, s.h, 56);
  }

  function setTool(tool) {
    if (!state.check) return;
    state.check.tool = tool;
    $('hwFixPencil').classList.toggle('on', tool === 'pencil');
    $('hwFixEraser').classList.toggle('on', tool === 'eraser');
  }
  $('hwFixPencil').addEventListener('click', () => setTool('pencil'));
  $('hwFixEraser').addEventListener('click', () => setTool('eraser'));

  function checkPoint(ev) {
    const c = $('hwCheckCanvas');
    const r = c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (c.width / r.width),
             y: (ev.clientY - r.top) * (c.height / r.height) };
  }
  function daub(x, y) {
    const k = state.check;
    const on = k.tool === 'pencil' ? 1 : 0;
    const r = k.tool === 'pencil' ? k.brush : Math.round(k.brush * 1.6);
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const yy = Math.round(y) + dy;
      if (yy < 0 || yy >= k.h) continue;
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const xx = Math.round(x) + dx;
        if (xx < 0 || xx >= k.w) continue;
        k.mask[yy * k.w + xx] = on;
      }
    }
  }
  let fixing = false;
  let lastPt = null;
  $('hwCheckCanvas').addEventListener('pointerdown', (ev) => {
    if (state.stage !== 'check') return;
    fixing = true;
    state.check.edits++;
    $('hwCheckCanvas').setPointerCapture(ev.pointerId);
    lastPt = checkPoint(ev);
    daub(lastPt.x, lastPt.y);
    paintCheck();
  });
  $('hwCheckCanvas').addEventListener('pointermove', (ev) => {
    if (!fixing) return;
    const p = checkPoint(ev);
    // walk the segment so a fast stroke leaves no gaps
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - lastPt.x, p.y - lastPt.y) /
                                        Math.max(1, state.check.brush / 2)));
    for (let i = 1; i <= steps; i++) {
      daub(lastPt.x + (p.x - lastPt.x) * i / steps,
           lastPt.y + (p.y - lastPt.y) * i / steps);
    }
    lastPt = p;
    paintCheck();
  });
  const endFix = () => {
    if (!fixing) return;
    fixing = false;
    lastPt = null;
    paintPreview();
  };
  $('hwCheckCanvas').addEventListener('pointerup', endFix);
  $('hwCheckCanvas').addEventListener('pointercancel', endFix);

  $('hwKeepBtn').addEventListener('click', () => {
    const k = state.check;
    const t = trimmed();
    if (!t) {
      const q = $('hwCheckQuiet');
      q.textContent = 'There’s nothing here yet — draw your ' + k.ch +
        ' back in with the pencil, or show it to me again.';
      q.style.display = 'block';
      return;
    }
    const glyph = { mask: t.mask, w: t.w, h: t.h,
                    parts: HWLetter.partsOf(t.mask, t.w, t.h) };
    state.glyphs.set(k.ch, glyph);
    state.samples.set(k.ch, HWLetter.normalize(glyph, k.ch));
    log('hw: ' + k.ch + ' is yours — kept at ' + t.w + 'x' + t.h + 'px' +
        (k.edits ? ' after ' + k.edits + ' touch-up stroke(s)' : ''));
    state.check = null;
    showGrid();
  });
  $('hwRetryBtn').addEventListener('click', () => {
    const ch = state.check.ch;
    state.check = null;
    arm(ch);
  });
  $('hwCheckBack').addEventListener('click', () => { state.check = null; showGrid(); });

  // ---- the font ---------------------------------------------------------------
  let previewFace = null;

  $('hwBuildBtn').addEventListener('click', async () => {
    try {
      state.font = HWFont.build(state.samples, null, { log });
      state.builds++;
      if (previewFace) { document.fonts.delete(previewFace); previewFace = null; }
      previewFace = new FontFace('My Handwriting Preview', state.font.buffer);
      await previewFace.load();
      document.fonts.add(previewFace);
      log('hw: FontFace registered for the preview (' + state.font.report.bytes + ' bytes)');
      renderPreview();
      state.stage = 'test';
      go('stepHwTest');
    } catch (e) {
      console.error('[hw]', e);
      log('hw: font build threw — ' + (e && e.message ? e.message : e));
    }
  });

  function renderPreview() {
    $('hwPreview').textContent = $('hwTryInput').value || 'the quick brown fox jumps over a lazy dog';
  }
  $('hwTryInput').addEventListener('input', renderPreview);

  $('hwDownloadBtn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([state.font.buffer], { type: 'font/ttf' }));
    a.download = 'My Handwriting.ttf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    log('hw: "My Handwriting.ttf" handed over (' + state.font.report.bytes + ' bytes)');
  });

  $('hwBackToLetters').addEventListener('click', showGrid);

  log('my handwriting ready (grid · show me · check it · try your letters)');
})();
