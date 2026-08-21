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
 *     any time. A FILLED one asks first (the product owner: "a tile
 *     which already has a letter, if i tap it again it should give me
 *     the option of redo, edit, never mind"): a small card by the tile
 *     offers Make it again · Fix it up · Never mind. No percent, no
 *     pressure; the grid filling up IS the progress.
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
    choice: null,       // {ch} while the kept-tile choice card is up
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
        slot.addEventListener('click', () => tap(ch, slot));
        slot.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(ch, slot); }
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
        ? 'Every letter is here — all yours. Tap any of them to make it again or fix it up.'
        : have + ' of ' + ALPHABET.length + ' letters are yours so far. ' +
          'Tap an empty letter to add it — or one of yours to make it again or fix it up.';
    $('hwBuildBtn').disabled = have === 0;
  }

  function showGrid() {
    closeChoice();
    renderGrid();
    $('hwLetterQuiet').style.display = 'none';
    state.stage = 'grid';
    state.letter = null;
    go('stepHwGrid');
  }
  $('hwEntryBtn').addEventListener('click', showGrid);
  $('hwGridBack').addEventListener('click', () => {
    closeChoice(); state.stage = 'idle'; go('stepCapture');
  });

  // ---- a kept letter asks first ----------------------------------------------
  // (the product owner: "a tile which already has a letter, if i tap it
  // again it should give me the option of redo, edit, never mind").
  // A tap used to mean MAKE IT AGAIN unconditionally — the one thing a
  // child reaching for a finished letter might want least. Now a KEPT
  // tile answers with a small card beside it, three ways on and none
  // louder than the others:
  //   · Make it again — the capture, exactly as a tap always meant;
  //   · Fix it up — the same check screen every fresh capture lands
  //     on (pencil · eraser · Move), holding the KEPT ink, so a wonky
  //     stroke is repaired without the camera coming out at all;
  //   · Never mind — the card closes and nothing has happened.
  // An EMPTY tile still arms instantly: there is nothing to protect,
  // and a question with one honest answer is a form.
  function closeChoice() {
    const card = document.getElementById('hwChoice');
    if (card) card.remove();
    state.choice = null;
  }
  function openChoice(ch, slot) {
    closeChoice();
    const card = document.createElement('div');
    card.className = 'hw-choice';
    card.id = 'hwChoice';
    const words = document.createElement('p');
    words.className = 'hw-choice-words';
    words.textContent = 'Your ' + ch + ' is already here — what would you like?';
    card.appendChild(words);
    const row = document.createElement('div');
    row.className = 'row';
    const again = document.createElement('button');
    again.id = 'hwChoiceAgain';
    again.textContent = '📷 Make it again';
    again.addEventListener('click', () => { closeChoice(); arm(ch); });
    const fix = document.createElement('button');
    fix.id = 'hwChoiceFix';
    fix.textContent = '✏️ Fix it up';
    fix.addEventListener('click', () => {
      closeChoice();
      // The kept native-res glyph goes back through the SAME door a
      // fresh capture uses — enterCheck pads a working copy, so the
      // kept ink is never touched until the child presses Keep.
      enterCheck(ch, state.glyphs.get(ch) || state.samples.get(ch));
    });
    const never = document.createElement('button');
    never.className = 'ghost';
    never.id = 'hwChoiceNever';
    never.textContent = 'Never mind';
    never.addEventListener('click', closeChoice);
    row.appendChild(again); row.appendChild(fix); row.appendChild(never);
    card.appendChild(row);
    const grid = $('hwGrid');
    grid.appendChild(card);
    // Beside its tile, kept on the paper: below the tapped slot, pulled
    // back from the grid's right edge if the tile sits near it.
    card.style.left = Math.max(0,
      Math.min(slot.offsetLeft, grid.clientWidth - card.offsetWidth)) + 'px';
    card.style.top = (slot.offsetTop + slot.offsetHeight + 6) + 'px';
    state.choice = { ch };
  }
  function tap(ch, slot) {
    if (state.choice && state.choice.ch === ch) { closeChoice(); return; }
    if (state.samples.has(ch)) { openChoice(ch, slot); return; }
    closeChoice();
    arm(ch);
  }
  // A tap anywhere that is not the card and not a tile answers Never
  // mind — walking away is allowed to be the whole of the answer.
  document.addEventListener('pointerdown', (e) => {
    if (!state.choice) return;
    const card = document.getElementById('hwChoice');
    if (card && card.contains(e.target)) return;
    if (e.target.closest && e.target.closest('.hw-slot')) return;
    closeChoice();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.choice) closeChoice();
  });

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
    // Any paper, any pen — the governing principle: it is the reader's
    // job to figure the colours out, never the child's job to own a
    // dark pen and white paper.
    $('hwArmedText').textContent = 'Write a big ' + ch +
      ' anywhere you like — any paper, any pen — and hold it up to the ' +
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
      ch: state.letter,                    // the tapped identity, for the
                                           //   reader's sliver class rule
      rect: () => BIACamera.analysisRect($('cameraLive')),
                                           // the small letter window: the
                                           //   loop reads exactly the crop
                                           //   the child sees
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
        : why === 'faint'
          ? 'I can only just see your ' + ch + ' on this paper — a ' +
            'darker pen would help, then show me again.'
          : 'I couldn’t find your ' + ch + ' in that picture yet — write it ' +
            'big and clear, and show me again.';
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
        // The tapped identity rides along: the reader still recognises
        // nothing, but the sliver rule may use the letter's CLASS.
        res = HWLetter.read(photo, { log, ch });
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
    // THE PENCIL DRAWS AT THE LETTER'S OWN STROKE WIDTH (field report:
    // "pencil stroke needs to be thin" — the old dim/45 dab sat far
    // fatter than the child's own pen). The width is MEASURED from the
    // captured ink (HWLetter.strokeWidthOf — median min-run through
    // the mask), and the pencil's radius is half of it, so a repaired
    // stroke lands at the thickness the child actually writes.
    // Clamped [2, 40]: below radius 2 a touch leaves near-nothing;
    // above 40 nothing honest remains (an 80px stroke at capture
    // resolution is wider than any letter fixture measures).
    // THE ERASER stays LARGER than the pencil — erasing a smudge wants
    // area, not calligraphy: its radius is the letter-proportional size
    // it always had (≈3.6% of the letter's dimension) or 1.6× the
    // pencil, whichever is more, so what the pencil can draw the eraser
    // can always take back. It cannot gouge more than intended: it only
    // acts where it is dragged, and the suite proves a stray blob comes
    // off while the letter's own ink stays untouched.
    const strokeW = HWLetter.strokeWidthOf(mask, w, h);
    const brush = Math.max(2, Math.min(40, Math.round(strokeW / 2)));
    state.check = { ch, mask, w, h, tool: 'pencil', brush,
                    wipe: Math.max(
                      Math.round(Math.max(3, Math.round(
                        Math.max(glyph.w, glyph.h) / 45)) * 1.6),
                      Math.round(1.6 * brush)),
                    sel: null, edits: 0 };
    state.letter = ch;
    $('hwCheckRef').textContent = ch;
    $('hwCheckWords').textContent = 'Here’s your ' + ch +
      ' — does it look right? Pencil draws a missing bit back in, the ' +
      'eraser cleans a smudge away, and Move slides a piece to a ' +
      'better spot.';
    $('hwCheckQuiet').style.display = 'none';
    setTool('pencil');
    paintCheck();
    paintPreview();
    state.stage = 'check';
    go('stepHwCheck');
  }

  // The working ink WITH a held Move selection stamped at its current
  // offset — what the child is looking at, and what the preview draws
  // while a piece floats. With no selection it IS the mask.
  function effectiveMask() {
    const k = state.check;
    if (!k.sel) return k.mask;
    const m = k.mask.slice();
    const s = k.sel;
    for (let y = s.y0; y <= s.y1; y++) {
      for (let x = s.x0; x <= s.x1; x++) {
        if (!s.mask[y * k.w + x]) continue;
        const yy = y + s.dy, xx = x + s.dx;
        if (yy >= 0 && yy < k.h && xx >= 0 && xx < k.w) m[yy * k.w + xx] = 1;
      }
    }
    return m;
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
    // A held selection floats over the base ink in a warm blue, so the
    // child can see WHAT is in their hand while they slide it.
    if (k.sel) {
      const s = k.sel;
      for (let y = s.y0; y <= s.y1; y++) {
        for (let x = s.x0; x <= s.x1; x++) {
          if (!s.mask[y * k.w + x]) continue;
          const yy = y + s.dy, xx = x + s.dx;
          if (yy < 0 || yy >= k.h || xx < 0 || xx >= k.w) continue;
          const d = (yy * k.w + xx) * 4;
          img.data[d] = 43; img.data[d + 1] = 86; img.data[d + 2] = 176;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#4b6fbf';
    ctx.lineWidth = 2;
    if (k.sel) {
      const s = k.sel;
      ctx.strokeRect(s.x0 + s.dx - 3.5, s.y0 + s.dy - 3.5,
                     (s.x1 - s.x0 + 1) + 7, (s.y1 - s.y0 + 1) + 7);
    } else if (k.band) {
      const b = k.band;
      ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1),
                     Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
    ctx.setLineDash([]);
  }

  function trimmed() {
    const k = state.check;
    const em = effectiveMask();
    let x0 = k.w, x1 = -1, y0 = k.h, y1 = -1;
    for (let y = 0; y < k.h; y++) {
      for (let x = 0; x < k.w; x++) {
        if (em[y * k.w + x]) {
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
        mask[y * w + x] = em[(y + y0) * k.w + (x + x0)];
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

  // ---- MOVE: one drag picks a piece up, the next drag slides it -------------
  // (field report: "allow selecting and moving so that i can center the
  // tile"). Child-simple on mouse and touch alike: with Move on, the
  // first drag draws a soft box around some ink — that ink is now in
  // your hand — and the next drag slides it; letting go puts it down.
  // Move only: no handles, no turning, no stretching.
  function makeSelection(b) {
    const k = state.check;
    const x0 = Math.max(0, Math.round(Math.min(b.x0, b.x1)));
    const x1 = Math.min(k.w - 1, Math.round(Math.max(b.x0, b.x1)));
    const y0 = Math.max(0, Math.round(Math.min(b.y0, b.y1)));
    const y1 = Math.min(k.h - 1, Math.round(Math.max(b.y0, b.y1)));
    const mask = new Uint8Array(k.w * k.h);
    let sx0 = k.w, sx1 = -1, sy0 = k.h, sy1 = -1, got = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!k.mask[y * k.w + x]) continue;
        mask[y * k.w + x] = 1;
        got++;
        if (x < sx0) sx0 = x; if (x > sx1) sx1 = x;
        if (y < sy0) sy0 = y; if (y > sy1) sy1 = y;
      }
    }
    if (!got) return;                       // an empty box holds nothing
    for (let i = 0; i < mask.length; i++) if (mask[i]) k.mask[i] = 0;
    k.sel = { mask, x0: sx0, x1: sx1, y0: sy0, y1: sy1, dx: 0, dy: 0 };
  }
  function commitSel() {
    const k = state.check;
    if (!k || !k.sel) return;
    k.mask = effectiveMask();               // the piece is put down here
    k.sel = null;
    k.edits++;
  }

  function setTool(tool) {
    if (!state.check) return;
    if (state.check.tool === 'move' && tool !== 'move') commitSel();
    state.check.tool = tool;
    state.check.band = null;
    $('hwFixPencil').classList.toggle('on', tool === 'pencil');
    $('hwFixEraser').classList.toggle('on', tool === 'eraser');
    $('hwFixMove').classList.toggle('on', tool === 'move');
    $('hwCheckCanvas').style.cursor = tool === 'move' ? 'move' : 'crosshair';
    paintCheck();
  }
  $('hwFixPencil').addEventListener('click', () => setTool('pencil'));
  $('hwFixEraser').addEventListener('click', () => setTool('eraser'));
  $('hwFixMove').addEventListener('click', () => setTool('move'));

  function checkPoint(ev) {
    const c = $('hwCheckCanvas');
    const r = c.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (c.width / r.width),
             y: (ev.clientY - r.top) * (c.height / r.height) };
  }
  function daub(x, y) {
    const k = state.check;
    const on = k.tool === 'pencil' ? 1 : 0;
    // The pencil draws at the letter's own measured stroke width; the
    // eraser keeps its larger disc — cleaning a smudge wants area.
    const r = k.tool === 'pencil' ? k.brush : k.wipe;
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
  let moving = null;      // a Move drag in flight: pointer start + start offset
  let banding = null;     // a select drag in flight: the rubber-band box
  let previewSoon = false;
  function schedulePreview() {
    if (previewSoon) return;
    previewSoon = true;
    requestAnimationFrame(() => {
      previewSoon = false;
      if (state.check) paintPreview();
    });
  }
  $('hwCheckCanvas').addEventListener('pointerdown', (ev) => {
    if (state.stage !== 'check') return;
    const k = state.check;
    const p = checkPoint(ev);
    $('hwCheckCanvas').setPointerCapture(ev.pointerId);
    if (k.tool === 'move') {
      if (k.sel) {
        moving = { x: p.x, y: p.y, dx0: k.sel.dx, dy0: k.sel.dy };
      } else {
        banding = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        k.band = banding;
        paintCheck();
      }
      return;
    }
    fixing = true;
    k.edits++;
    lastPt = p;
    daub(lastPt.x, lastPt.y);
    paintCheck();
  });
  $('hwCheckCanvas').addEventListener('pointermove', (ev) => {
    const k = state.check;
    const p = k ? checkPoint(ev) : null;
    if (moving && k && k.sel) {
      const s = k.sel;
      // the piece stays on the paper: the slide is clamped to the canvas
      s.dx = Math.max(-s.x0, Math.min(k.w - 1 - s.x1,
        Math.round(moving.dx0 + p.x - moving.x)));
      s.dy = Math.max(-s.y0, Math.min(k.h - 1 - s.y1,
        Math.round(moving.dy0 + p.y - moving.y)));
      paintCheck();
      schedulePreview();     // the tile preview follows the ink live
      return;
    }
    if (banding && k) {
      banding.x1 = p.x; banding.y1 = p.y;
      paintCheck();
      return;
    }
    if (!fixing) return;
    // walk the segment so a fast stroke leaves no gaps
    const r = k.tool === 'pencil' ? k.brush : k.wipe;
    const steps = Math.max(1, Math.ceil(Math.hypot(p.x - lastPt.x, p.y - lastPt.y) /
                                        Math.max(1, r / 2)));
    for (let i = 1; i <= steps; i++) {
      daub(lastPt.x + (p.x - lastPt.x) * i / steps,
           lastPt.y + (p.y - lastPt.y) * i / steps);
    }
    lastPt = p;
    paintCheck();
  });
  const endFix = () => {
    if (moving) {
      moving = null;
      commitSel();           // the piece is put down where it was left
      paintCheck();
      paintPreview();
      return;
    }
    if (banding) {
      const k = state.check;
      if (k) { k.band = null; makeSelection(banding); }
      banding = null;
      paintCheck();
      return;
    }
    if (!fixing) return;
    fixing = false;
    lastPt = null;
    paintPreview();
  };
  $('hwCheckCanvas').addEventListener('pointerup', endFix);
  $('hwCheckCanvas').addEventListener('pointercancel', endFix);

  $('hwKeepBtn').addEventListener('click', () => {
    const k = state.check;
    commitSel();             // a piece still in hand is put down first
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
    // MY HANDWRITING GOES TO THE CLOUD — the letter is the unit of
    // keeping, so Keep is the moment it is stored (HandwritingStore:
    // local-first, creator_handwriting after, silently). The PNG is the
    // glyph's own ink, alpha-exact, so hydrate can rebuild the mask
    // from it without a second stored shape.
    try {
      if (typeof HandwritingStore !== 'undefined') {
        HandwritingStore.save({ ch: k.ch, png: _glyphToPng(glyph), w: glyph.w, h: glyph.h });
      }
    } catch (e) {}
    // MY GARDEN — a kept letter is a capture like any other, and the kind
    // of creation never matters (Decision 27). The id is unique per KEEP,
    // not per letter: making a letter again is a new creative act and
    // grows the garden again; the guard only stops one keep double-firing.
    try {
      document.dispatchEvent(new CustomEvent('vihu:creation-captured',
        { detail: { id: 'hw-' + k.ch + '-' + Date.now() } }));
    } catch (e) {}
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

  // ---- kept letters come back (HandwritingStore) -----------------------------
  // The grid used to forget everything on reload — the letters lived in
  // the two Maps above and nowhere else. Now Keep stores each letter
  // (see the Keep handler) and this block is the other half: on load,
  // every stored letter is rebuilt into the exact {mask,w,h,parts}
  // glyph Keep produced, alpha from the stored PNG, parts and samples
  // recomputed by the same HWLetter calls Keep itself uses. If the grid
  // is already on screen when hydration lands, it repaints.
  function _glyphToPng(glyph) {
    const c = document.createElement('canvas');
    c.width = glyph.w; c.height = glyph.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(glyph.w, glyph.h);
    for (let i = 0; i < glyph.mask.length; i++) {
      if (glyph.mask[i]) {
        img.data[i * 4] = 26; img.data[i * 4 + 1] = 26; img.data[i * 4 + 2] = 26; img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }
  function _pngToGlyph(png, w, h) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(im, 0, 0);
        const data = ctx.getImageData(0, 0, w, h).data;
        const mask = new Uint8Array(w * h);
        for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        resolve({ mask, w, h, parts: HWLetter.partsOf(mask, w, h) });
      };
      im.onerror = () => reject(new Error('letter png failed to decode'));
      im.src = png;
    });
  }
  if (typeof HandwritingStore !== 'undefined') {
    HandwritingStore.whenReady().then(() => {
      const kept = HandwritingStore.list();
      return Promise.all(kept.map((r) =>
        _pngToGlyph(r.glyph.png, r.glyph.w, r.glyph.h).then((glyph) => {
          if (state.glyphs.has(r.ch)) return;   // this session's own keep wins
          state.glyphs.set(r.ch, glyph);
          state.samples.set(r.ch, HWLetter.normalize(glyph, r.ch));
        }).catch(() => {})
      )).then(() => {
        if (kept.length) {
          log('hw: ' + state.glyphs.size + ' kept letter(s) came back from the store');
          if (state.stage === 'grid') renderGrid();
        }
      });
    });
  }

  log('my handwriting ready (grid · show me · check it · try your letters)');
})();
