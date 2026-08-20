/* HW APP — the MY HANDWRITING journey's UI wiring on the standalone page.
 *
 * Four marks: WRITING SHEET → PHOTOGRAPH → YOUR LETTERS → TRY YOUR FONT.
 *
 * The photograph arrives through the EXISTING capture entry — the picker,
 * the drop zone and the camera, all unchanged (app.js owns them). This
 * module only ARMS the journey: after "I've written it", the next
 * photograph that lands is taken for the handwriting sheet. app.js's own
 * loadPhoto runs untouched and steps to the claim as it always does; the
 * observer here notices, takes the decoded photo (one decode, one truth —
 * capture.js's rule), and walks into the handwriting reading instead.
 * Nothing in app.js, flow.js, capture.js or camera.js changed.
 *
 * The alphabet is SHOWN before anything is built (Decision 18's move:
 * show what was recognised and let the child say "that's not right"
 * before the door opens). Missing letters are quiet empty slots — never
 * an error, never a blank glyph later; recovery is per line, never
 * start-over.
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

  // Child-facing words for a card whose letters held hands (touching-
  // refusals dominated — hwRead's `joined`). Never blame words; the
  // generic retake stays for cards that are merely messy.
  const JOINED_LINE_MSG = 'these letters are holding hands — write this ' +
    'card once more with a little space between each letter, and I’ll ' +
    'meet them all';
  const JOINED_SHEET_MSG = 'Your letters like to hold hands! I can only ' +
    'meet letters written on their own — try the cards again, giving ' +
    'each letter a little space of its own.';

  // Child-facing words for a photo taken too far away (hwRead's capture
  // facts said the letters landed under the coarse floor). Everything
  // readable is still kept — this is an invitation, never a refusal.
  const COARSE_MSG = 'This photo is a little far away, so your letters ' +
    'look tiny to me — I kept every one I could read. Come a bit closer, ' +
    'or use a photo from a phone, and I’ll see every curve.';

  const state = {
    stage: 'idle',      // idle · sheet · armed · reading · alphabet · test
    armed: false,
    retakeLine: null,
    lines: null,        // the kept per-line read results (merged across retakes)
    samples: null,      // Map ch → best sample
    capture: null,      // hwRead's capture facts (anchors, tilts, x-height)
    font: null,         // {buffer, report}
    builds: 0,
    sheetDrawn: null
  };
  window.__hw = state;

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

  // ---- the sheet -------------------------------------------------------------
  function showSheet() {
    state.sheetDrawn = HWSheet.draw($('hwSheetCanvas'), 640);
    HWSheet.draw($('hwPrintCanvas'), 1600); // the printable copy, crisp
    $('hwQuietSheet').style.display = 'none';
    state.stage = 'sheet';
    go('stepHwSheet');
  }
  $('hwEntryBtn').addEventListener('click', showSheet);
  $('hwPrintBtn').addEventListener('click', () => window.print());
  $('hwSheetBack').addEventListener('click', () => { state.stage = 'idle'; go('stepCapture'); });

  // ONE camera, TWO framings (field finding: "currently am getting
  // confused wether am generating font or art"). The shared capture
  // machinery wears each journey's own words: while the handwriting
  // journey is armed, the title, the drop words and the camera line all
  // say LETTERS; disarmed, they say DRAWING again, byte for byte — the
  // defaults are read from the page itself so the two cannot drift.
  const FRAMING = {
    title: $('captureTitle').textContent,
    drop: $('dropWords').textContent,
    camera: $('cameraNote').textContent
  };
  const HW_FRAMING = {
    title: '✍️ My Handwriting — show me your cards',
    drop: 'Drop a photo of your written page here',
    camera: 'Show me one card at a time — any order. The whole page works too.'
  };
  function setFraming(hw) {
    const f = hw ? HW_FRAMING : FRAMING;
    $('captureTitle').textContent = f.title;
    $('dropWords').textContent = f.drop;
    $('cameraNote').textContent = f.camera;
    document.body.classList.toggle('hw-armed', hw);
  }

  function arm(retakeLine) {
    state.armed = true;
    state.retakeLine = (retakeLine == null ? null : retakeLine);
    state.stage = 'armed';
    HWLive.reset();   // each arming is a fresh sweep — nothing stale ticks
    const banner = $('hwArmed');
    $('hwArmedText').textContent = state.retakeLine == null
      ? 'Your next photo becomes your handwriting — or open the camera and show me your cards, one at a time.'
      : 'Show me card ' + (state.retakeLine + 1) + ' once more — up close with the camera, or a fresh photo of the whole page.';
    banner.style.display = 'block';
    setFraming(true);
    go('stepCapture');
  }
  function disarm() {
    state.armed = false;
    stopLive();
    $('hwArmed').style.display = 'none';
    setFraming(false);
  }
  $('hwWroteBtn').addEventListener('click', () => arm(null));
  $('hwDisarmBtn').addEventListener('click', () => {
    const hadLines = !!state.lines;
    disarm();
    if (state.retakeLine != null && hadLines) { state.stage = 'alphabet'; go('stepHwLetters'); }
    else showSheet();
  });

  // The existing capture entry, unchanged, is the way in: when a photo
  // lands while armed, app.js steps to the claim as it always does and
  // this observer takes over from there.
  new MutationObserver(() => {
    if (!state.armed) return;
    if (!$('stepClaim').classList.contains('here')) return;
    disarm();
    const photo = window.__bia && window.__bia.photo;
    if (photo) readSheet(photo);
  }).observe($('stepClaim'), { attributes: true, attributeFilter: ['class'] });

  // ---- free-motion camera collection (js/hwLive.js) --------------------------
  // While the journey is armed and the camera preview runs, lines are
  // collected one at a time, in any order — the child sweeps the camera
  // over the sheet. The UPLOAD path never comes near this: the loop
  // starts only when the camera panel opens while armed, and a picked or
  // dropped photo goes through readSheet exactly as it always did.
  state.live = HWLive.state;   // the developer seam sees the sweep

  function liveSlots() {
    const box = $('hwLiveSlots');
    if (box.childElementCount) return;
    for (let i = 0; i < HWSheet.LINES.length; i++) {
      const s = document.createElement('div');
      s.className = 'hw-live-slot';
      s.dataset.line = String(i);
      s.textContent = String(i + 1);
      box.appendChild(s);
    }
  }

  // A line counts as met if this sweep collected it OR an earlier read
  // already holds it — a retake sweep must not present four read lines
  // as missing.
  function lineMet(i) {
    if (HWLive.state.collected.has(i)) return true;
    return !!(state.lines && state.lines[i] && state.lines[i].found);
  }

  function updateLiveUI(justMet) {
    liveSlots();
    let met = 0;
    for (const s of $('hwLiveSlots').children) {
      const i = Number(s.dataset.line);
      const on = lineMet(i);
      if (on) met++;
      s.classList.toggle('met', on);
      s.textContent = on ? '★' : String(i + 1);
      if (justMet === i) {
        s.classList.remove('just-met');
        void s.offsetWidth;            // restart the little glow
        s.classList.add('just-met');
      }
    }
    $('hwLiveCount').textContent = met + ' of ' + HWSheet.LINES.length;
    $('hwLiveDoneBtn').style.display = met > 0 ? '' : 'none';
  }

  function startLive() {
    $('hwLiveRow').style.display = 'block';
    updateLiveUI();
    HWLive.start($('cameraLive'), {
      log,
      want: state.retakeLine,
      onCollect: (i, isNew) => {
        log('hw live: line ' + (i + 1) + (isNew ? ' met' : ' seen again — the newer one is kept'));
        updateLiveUI(isNew ? i : undefined);
      },
      onComplete: finishSweep
    });
    log('hw live: watching for lines (' +
        (state.retakeLine == null ? 'any order, all five'
                                  : 'line ' + (state.retakeLine + 1)) + ')');
  }
  function stopLive() {
    HWLive.stop();
    $('hwLiveRow').style.display = 'none';
  }

  // The sweep is done — every line met, the wanted retake met, or the
  // child pressed the done button with some lines still to come (an
  // unmet line is a quiet empty slot, exactly as it already is).
  function finishSweep() {
    const collected = new Map(HWLive.state.collected);
    stopLive();
    BIACamera.closePanel();
    disarm();
    if (!collected.size) return;
    const lines = [];
    const xhs = [], tilts = [];
    for (let i = 0; i < HWSheet.LINES.length; i++) {
      if (collected.has(i)) {
        const c = collected.get(i);
        lines.push(c.line);
        if (c.capture && c.capture.xHeightPx) xhs.push(c.capture.xHeightPx);
        if (c.capture && c.capture.tilt != null) tilts.push(c.capture.tilt);
      } else if (state.lines && state.lines[i]) {
        lines.push(state.lines[i]);
      } else {
        lines.push({ index: i, text: HWSheet.LINES[i].text, found: false, letters: [] });
      }
    }
    state.lines = lines;
    xhs.sort((a, b) => a - b);
    const xh = xhs.length ? xhs[(xhs.length / 2) | 0] : 0;
    state.capture = { viaLive: true, viaAnchors: false, anchors: 0, tilts,
                      xHeightPx: xh, xHeightMeasured: xhs.length > 0,
                      coarse: xh > 0 && xh < HWRead.PARAMS.COARSE_XH,
                      anis: 1, flipped: false };
    log('hw live: sweep finished — ' + collected.size + ' line(s) from the camera' +
        (xh ? ', x-height ~' + Math.round(xh) + 'px' : ''));
    HWLive.reset();
    rebuildAlphabet();
    renderLetters();
    state.stage = 'alphabet';
    go('stepHwLetters');
  }
  $('hwLiveDoneBtn').addEventListener('click', finishSweep);

  // The loop lives exactly as long as the camera panel is open while the
  // journey is armed. camera.js already closes the panel when the step
  // is left or the page hides, so the light discipline is one rule.
  new MutationObserver(() => {
    const open = $('cameraPanel').style.display === 'block';
    if (open && state.armed) startLive();
    else if (!open) stopLive();
  }).observe($('cameraPanel'), { attributes: true, attributeFilter: ['style'] });

  // ---- reading ---------------------------------------------------------------
  function readSheet(photo) {
    state.stage = 'reading';
    go('stepHwReading');
    const retake = state.retakeLine;
    state.retakeLine = null;
    setTimeout(() => {
      let res;
      try {
        res = HWRead.read(photo, { log, onlyLine: retake });
      } catch (e) {
        console.error('[hw]', e);
        log('hw: reading threw — ' + (e && e.message ? e.message : e));
        res = { ok: false, reason: 'lines' };
      }
      if (!res.ok) {
        // Child-safe: the sheet is never "invalid", the picture just
        // didn't show the lines yet.
        const q = $('hwQuietSheet');
        q.textContent = 'I couldn’t find the writing lines in that picture yet — ' +
          'lay the sheet flat, get the whole page in, and take it again.';
        q.style.display = 'block';
        state.stage = 'sheet';
        go('stepHwSheet');
        return;
      }
      state.capture = res.capture || null;
      if (retake != null && state.lines) {
        if (res.lines[retake] && res.lines[retake].found) {
          state.lines[retake] = res.lines[retake];
          log('hw: line ' + (retake + 1) + ' replaced from the new photograph');
        }
      } else {
        state.lines = res.lines;
      }
      rebuildAlphabet();
      renderLetters();
      state.stage = 'alphabet';
      go('stepHwLetters');
    }, 40);
  }

  // ---- the alphabet ----------------------------------------------------------
  function rebuildAlphabet() {
    const best = new Map();
    for (const ln of state.lines) {
      if (!ln.found) continue;
      for (const letter of ln.letters) {
        if (!letter.accepted || !letter.sample) continue;
        const prev = best.get(letter.ch);
        if (!prev || letter.cost < prev.cost ||
            (letter.cost === prev.cost && letter.sample.w > prev.sample.w)) {
          best.set(letter.ch, { cost: letter.cost, sample: letter.sample, line: ln.index });
        }
      }
    }
    const samples = new Map();
    for (const [ch, e] of best) samples.set(ch, e.sample);
    state.samples = samples;
  }

  function drawSample(canvas, sample) {
    const box = 56;
    canvas.width = box; canvas.height = box;
    const ctx = canvas.getContext('2d');
    const s = Math.min((box - 8) / sample.w, (box - 8) / sample.h);
    const ox = (box - sample.w * s) / 2, oy = (box - sample.h * s) / 2;
    const img = ctx.createImageData(box, box);
    for (let y = 0; y < box; y++) {
      for (let x = 0; x < box; x++) {
        const sx = Math.floor((x - ox) / s), sy = Math.floor((y - oy) / s);
        if (sx >= 0 && sx < sample.w && sy >= 0 && sy < sample.h &&
            sample.mask[sy * sample.w + sx]) {
          const d = (y * box + x) * 4;
          img.data[d] = 231; img.data[d + 1] = 234; img.data[d + 2] = 243;
          img.data[d + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function renderLetters() {
    const grid = $('hwGrid');
    grid.innerHTML = '';
    let have = 0;
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
        const label = document.createElement('div');
        label.className = 'hw-slot-label';
        label.textContent = ch;
        slot.appendChild(label);
        const sample = state.samples.get(ch);
        if (sample) {
          have++;
          const c = document.createElement('canvas');
          drawSample(c, sample);
          slot.appendChild(c);
        } else {
          slot.classList.add('empty');
          const e = document.createElement('div');
          e.className = 'hw-slot-empty';
          slot.appendChild(e);
        }
        grid.appendChild(slot);
      }
    }
    $('hwGridNote').textContent = have === ALPHABET.length
      ? 'Every letter is here — these are all yours.'
      : 'An empty box is a letter I haven’t met yet. You can write its card once more, or build the font without it — words will borrow a plain letter there.';

    // Sheet-level joined-up: when MOST read lines look joined the child
    // writes joined-up throughout, so say it ONCE, gently, up front —
    // and keep the per-line rows generic rather than four copies of the
    // same sentence.
    const found = state.lines.filter((ln) => ln.found);
    const joinedLines = found.filter((ln) => ln.joined);
    const sheetJoined = found.length > 0 &&
      joinedLines.length >= Math.max(2, Math.ceil(found.length * 0.6));
    const joinedNote = $('hwJoinedNote');
    joinedNote.textContent = JOINED_SHEET_MSG;
    joinedNote.style.display = sheetJoined ? 'block' : 'none';

    // Coarse photo: the letters read, but honestly small on the camera.
    const coarseNote = $('hwCoarseNote');
    coarseNote.textContent = COARSE_MSG;
    coarseNote.style.display = state.capture && state.capture.coarse ? 'block' : 'none';

    const list = $('hwLineList');
    list.innerHTML = '';
    for (const ln of state.lines) {
      const row = document.createElement('div');
      row.className = 'hw-linerow';
      const txt = document.createElement('span');
      if (ln.found && ln.joined && !sheetJoined) {
        row.classList.add('joined');
        txt.textContent = 'Card ' + (ln.index + 1) + ' · “' + ln.text + '” · ' +
          JOINED_LINE_MSG;
      } else if (ln.found) {
        txt.textContent = 'Card ' + (ln.index + 1) + ' · “' + ln.text + '” · ' +
          ln.accepted + ' of ' + ln.expected + ' letters';
      } else {
        txt.textContent = 'Card ' + (ln.index + 1) + ' · “' + ln.text + '” · not read yet';
      }
      row.appendChild(txt);
      const btn = document.createElement('button');
      btn.className = 'ghost';
      // One wording for both ways back: write it again and photograph
      // it, or hold the same card up to the camera once more.
      btn.textContent = 'Show me this card once more';
      btn.dataset.line = String(ln.index);
      btn.addEventListener('click', () => arm(ln.index));
      row.appendChild(btn);
      list.appendChild(row);
    }
    $('hwBuildBtn').disabled = state.samples.size === 0;
  }

  $('hwNewSheetBtn').addEventListener('click', () => {
    state.lines = null; state.samples = null; state.capture = null;
    state.font = null; state.builds = 0;
    if (previewFace) { document.fonts.delete(previewFace); previewFace = null; }
    showSheet();
  });

  // ---- the font ---------------------------------------------------------------
  let previewFace = null;

  $('hwBuildBtn').addEventListener('click', async () => {
    try {
      state.font = HWFont.build(state.samples, state.lines, { log });
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

  $('hwBackToLetters').addEventListener('click', () => { state.stage = 'alphabet'; go('stepHwLetters'); });
  $('hwTestNewSheet').addEventListener('click', () => $('hwNewSheetBtn').click());

  log('my handwriting ready (sheet · capture · letters · font)');
})();
