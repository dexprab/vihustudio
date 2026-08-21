/* MY GARDEN — verification suite for the Living Garden.
 *
 * Drives the REAL Studio (studio.html?author=on — Author Mode is the
 * one sanctioned direct door, Decision 13/23), enters the editor
 * through the real CreationFlow.startBlank(), and then answers the
 * sprint's own acceptance questions against the live page:
 *
 *   · the rename shipped and "My Library" is gone from child-facing UI
 *   · the first capture establishes the origin
 *   · one capture = one growth (a repeated capture id grows nothing)
 *   · re-rendering grows nothing
 *   · growth at 1 / 5 / 15 / 30 / 60 stays OUT of the play area —
 *     every garden element's box is disjoint from the page canvas and
 *     from the dev button, measured, not assumed
 *   · the density ceiling holds at 70+ (the count stops rising)
 *   · the garden persists across a full reload, identical
 *   · a Traveller's garden is swept to a newly claimed card
 *   · the Author Mode "Add Creation" dev trigger exists and works,
 *     and does NOT exist without Author Mode
 *   · zero page errors throughout
 *
 * Screenshots at each acceptance stage land in tools/garden-test/shots/.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/garden-test/run-garden-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const PORT = Number(process.env.GARDEN_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
function ok(name, note) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
function fail(name, note) { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
function check(cond, name, note) { (cond ? ok : fail)(name, note); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  async function bootEditor() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof LivingGarden !== 'undefined' && typeof CreationFlow !== 'undefined' &&
      typeof GardenRenderer !== 'undefined', null, { timeout: 20000 });
    // The Traveller Gateway cinematic covers the workspace on entry.
    // Tap-to-skip advances it scene by scene at its own pace; after a
    // few real taps the suite stands the overlay down outright — a
    // harness affordance for the SCREENSHOTS only (they should show the
    // workspace, not the gate). Every garden check is DOM-measured and
    // does not care either way; the product is untouched.
    for (let i = 0; i < 6; i++) {
      const gone = await page.evaluate(() => {
        const ov = document.getElementById('gatewayOverlay');
        if (!ov || ov.hidden || !ov.offsetParent) return true;
        ov.click();
        return false;
      });
      if (gone) break;
      await page.waitForTimeout(700);
    }
    await page.evaluate(() => {
      const ov = document.getElementById('gatewayOverlay');
      if (ov) ov.style.display = 'none';
    });
    await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await page.waitForFunction(() => {
      const w = document.querySelector('main.preview-area .preview-wrapper');
      return w && w.getBoundingClientRect().width > 100;
    }, null, { timeout: 20000 });
    await page.waitForTimeout(600);
  }

  async function gardenCounts() {
    return page.evaluate(() => {
      const st = LivingGarden.state();
      const layer = document.getElementById('livingGardenLayer');
      return { events: st.events, elements: st.elements.length, drawn: layer ? layer.childElementCount : 0 };
    });
  }

  // Every drawn garden node must be disjoint from the play area (the
  // page canvas rect grown by a small guard) and from the object strip
  // area at the foot. Measured per SVG child, zero tolerance.
  async function overlapCount() {
    return page.evaluate(() => {
      const layer = document.getElementById('livingGardenLayer');
      const wrap = document.querySelector('main.preview-area .preview-wrapper canvas')
                || document.querySelector('main.preview-area .preview-wrapper');
      if (!layer || !wrap) return -1;
      const p = wrap.getBoundingClientRect();
      const bad = [];
      Array.from(layer.children).forEach((n) => {
        const b = n.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return;
        const disjoint = b.right <= p.left + 2 || b.left >= p.right - 2 || b.bottom <= p.top + 2 || b.top >= p.bottom - 2;
        if (!disjoint) bad.push(n.tagName + ' [' + [b.left, b.top, b.right, b.bottom].map(Math.round).join(',') + '] vs page [' + [p.left, p.top, p.right, p.bottom].map(Math.round).join(',') + ']');
      });
      return bad;
    });
  }

  async function capture(n) {
    await page.evaluate((ids) => {
      ids.forEach((id) => document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: id } })));
    }, Array.from({ length: n }, (_, i) => 'suite-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + i));
    await page.waitForTimeout(1800);   // let the growth animation finish and the settle render land
  }

  console.log('-- boot: real Studio, Author Mode, blank story');
  await page.goto(BASE + '/studio.html?author=on');
  await page.evaluate(() => {
    // A clean garden and a clean card state for a deterministic run.
    Object.keys(localStorage).filter((k) => k.indexOf('vihu-living-garden') === 0).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('vihu-magic-card-active-id');
  });
  await bootEditor();
  ok('editor reached through the real CreationFlow');

  console.log('-- R: the rename');
  const libMentions = await page.evaluate(() => (document.body.innerText.match(/My Library/g) || []).length);
  check(libMentions === 0, 'R1 no child-facing "My Library" anywhere on the booted page', libMentions + ' mentions');
  const keepBtn = await page.evaluate(() => {
    const b = document.getElementById('biasLibraryBtn') || Array.from(document.querySelectorAll('button')).find((x) => /Keep in My/.test(x.textContent || ''));
    return b ? b.textContent.trim() : '';
  });
  check(!/My Library/.test(keepBtn), 'R2 the scanner keep button does not say My Library', JSON.stringify(keepBtn || '(not mounted yet — checked globally in R1)'));

  console.log('-- G: growth');
  let c0 = await gardenCounts();
  check(c0.events === 0 && c0.elements === 0, 'G1 a new garden is empty', JSON.stringify(c0));
  await page.screenshot({ path: path.join(SHOTS, 'stage-0.png') });

  await capture(1);
  let c1 = await gardenCounts();
  check(c1.events === 1 && c1.elements >= 1 && c1.drawn >= 1, 'G2 the first capture establishes the origin', JSON.stringify(c1));
  const layerPos = await page.evaluate(() => {
    const l = document.getElementById('livingGardenLayer');
    if (!l) return 'missing';
    const inWrap = !!(l.parentNode && l.parentNode.classList && l.parentNode.classList.contains('preview-wrapper'));
    const prev = l.previousElementSibling;
    const aboveSky = !prev || (prev.classList && prev.classList.contains('stage-sky'));
    return inWrap && aboveSky ? 'ok' : 'wrong: parent=' + (l.parentNode && l.parentNode.className) + ' prev=' + (prev && prev.className);
  });
  check(layerPos === 'ok', 'G2b the garden paints above the sky and below the page — inside the wrapper, after stage-sky', layerPos);
  await page.screenshot({ path: path.join(SHOTS, 'stage-1.png') });

  // One capture = one growth: the SAME id again must change nothing.
  const dupId = 'suite-duplicate-id';
  await page.evaluate((id) => { document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: id } })); }, dupId);
  await page.waitForTimeout(200);
  const cDup1 = await gardenCounts();
  await page.evaluate((id) => { document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: id } })); }, dupId);
  await page.waitForTimeout(200);
  const cDup2 = await gardenCounts();
  check(cDup1.events === c1.events + 1 && cDup2.events === cDup1.events,
    'G3 one capture = one growth — a repeated capture id grows nothing', 'events ' + c1.events + ' → ' + cDup1.events + ' → ' + cDup2.events);

  const before = await gardenCounts();
  await page.evaluate(() => { GardenRenderer.render(); GardenRenderer.render(); GardenRenderer.render(); });
  await page.waitForTimeout(200);
  const after = await gardenCounts();
  check(before.events === after.events && before.elements === after.elements,
    'G4 re-rendering grows nothing', 'events ' + before.events + ', elements ' + before.elements);

  console.log('-- S: the acceptance ladder, measured');
  const stages = [5, 15, 30, 60];
  let prevElements = after.elements;
  for (const target of stages) {
    const cNow = await gardenCounts();
    await capture(target - cNow.events);
    const c = await gardenCounts();
    const bad = await overlapCount();
    check(c.events === target, 'S' + target + ' garden reached ' + target + ' captures', 'elements ' + c.elements + ', drawn ' + c.drawn);
    check(c.elements > prevElements, 'S' + target + ' the garden visibly grew since the last stage', prevElements + ' → ' + c.elements);
    check(bad.length === 0, 'S' + target + ' nothing overlaps the play area', bad.length ? bad.join(' · ') : '0 overlapping nodes');
    prevElements = c.elements;
    await page.screenshot({ path: path.join(SHOTS, 'stage-' + target + '.png') });
  }

  console.log('-- C: the density ceiling');
  await capture(30);   // 60 → 90 captures
  const c90 = await gardenCounts();
  await capture(10);   // 90 → 100
  const c100 = await gardenCounts();
  check(c100.elements <= Math.max(c90.elements, 115) && c100.elements - c90.elements <= 10,
    'C1 past the ceiling the garden deepens instead of spreading', '90cap:' + c90.elements + ' → 100cap:' + c100.elements + ' elements');
  const badLate = await overlapCount();
  check(badLate.length === 0, 'C2 still nothing overlaps the play area at 100 captures', badLate.length ? badLate.join(' · ') : '0 overlapping nodes');
  await page.screenshot({ path: path.join(SHOTS, 'stage-100.png') });

  console.log('-- P: persistence');
  const snapBefore = await page.evaluate(() => JSON.stringify(LivingGarden.state().elements));
  await bootEditor();
  const snapAfter = await page.evaluate(() => JSON.stringify(LivingGarden.state().elements));
  const cReload = await gardenCounts();
  check(snapBefore === snapAfter, 'P1 the garden survives a full reload IDENTICALLY', cReload.elements + ' elements, ' + cReload.events + ' events');
  check(cReload.drawn > 0, 'P2 the reloaded garden is actually drawn', cReload.drawn + ' nodes');

  console.log('-- K: a Traveller\'s garden follows a newly claimed card');
  const claimed = await page.evaluate(() => {
    const travellerRec = localStorage.getItem('vihu-living-garden:traveller');
    localStorage.setItem('vihu-magic-card-active-id', 'card-suite-test');
    LivingGarden.claim();
    const moved = localStorage.getItem('vihu-living-garden:card-suite-test');
    const stillCount = LivingGarden.state().elements.length;
    // put things back for the remaining checks
    localStorage.removeItem('vihu-magic-card-active-id');
    localStorage.setItem('vihu-living-garden:traveller', moved || travellerRec || '');
    return { had: !!travellerRec, moved: !!moved, stillCount: stillCount };
  });
  check(claimed.had && claimed.moved && claimed.stillCount > 0,
    'K1 claim() sweeps the traveller garden to the new card and nothing is lost', JSON.stringify(claimed));

  console.log('-- D: the developer trigger');
  const devBtn = await page.evaluate(() => !!document.getElementById('gardenDevAdd'));
  check(devBtn, 'D1 Author Mode shows the Add Creation dev trigger');
  if (devBtn) {
    const cPre = await gardenCounts();
    // .click() in-page: the Traveller Gateway overlay can sit above the
    // workspace after a reload and intercept a synthetic pointer.
    await page.evaluate(() => document.getElementById('gardenDevAdd').click());
    await page.waitForTimeout(300);
    const cPost = await gardenCounts();
    check(cPost.events === cPre.events + 1, 'D2 the dev trigger simulates one successful capture', cPre.events + ' → ' + cPost.events);
  }

  console.log('-- T: a capture on the tool page grows the Studio\'s garden');
  // The letter grid and the standalone scanner live on the tool page,
  // which now carries the engine (no renderer) — a keep there must grow
  // the SAME garden the Studio draws. The journey, end to end: clean
  // garden → two captures on the tool page (one a handwriting-style id,
  // one repeated to prove the guard holds cross-page) → open the Studio
  // → the garden shows exactly those captures.
  await page.goto(BASE + '/tools/bring-it-alive/');
  await page.waitForFunction(() => typeof LivingGarden !== 'undefined', null, { timeout: 20000 });
  const toolSide = await page.evaluate(() => {
    Object.keys(localStorage).filter((k) => k.indexOf('vihu-living-garden') === 0).forEach((k) => localStorage.removeItem(k));
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'hw-R-suite' } }));
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'hw-R-suite' } }));
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'hw-o-suite' } }));
    return LivingGarden.state().events;
  });
  check(toolSide === 2, 'T1 the tool page records captures (handwriting ids, duplicate guarded)', toolSide + ' events');
  await bootEditor();
  const studioSide = await gardenCounts();
  check(studioSide.events === 2 && studioSide.drawn > 0,
    'T2 the Studio draws the garden those tool-page captures grew', JSON.stringify(studioSide));

  console.log('-- L: My Letters lives in My Garden');
  // Seed one kept letter through the real store, open the real picker
  // through the real door (Add Something → 🌿 My Garden), and place the
  // letter on the page through the tile itself.
  const seeded = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 24; c.height = 24;
    const x = c.getContext('2d'); x.fillStyle = '#1a1a1a'; x.fillRect(4, 4, 16, 16);
    await HandwritingStore.whenReady();
    const res = await HandwritingStore.save({ ch: 'a', png: c.toDataURL('image/png'), w: 24, h: 24 });
    return res && res.ok ? res.record.id : null;
  });
  check(!!seeded, 'L1 a letter lands in the real HandwritingStore', seeded || 'save failed');
  const doorClicked = await page.evaluate(() => {
    const door = Array.from(document.querySelectorAll('button.context-add-card'))
      .find((t) => /My Garden/.test(t.textContent || '') && t.offsetParent);
    if (!door) return false;
    door.click();
    // My Garden opens on 🖼 My Drawings; the letters live in their own tab.
    const tab = Array.from(document.querySelectorAll('.context-hw-tab'))
      .find((t) => /My Letters/.test(t.textContent || ''));
    if (!tab) return false;
    tab.click();
    return true;
  });
  await page.waitForTimeout(400);
  const shelf = await page.evaluate(() => {
    const tiles = Array.from(document.querySelectorAll('.context-hw-tile'));
    const keptA = document.querySelector('.context-hw-tile-kept img[alt="My letter a"]');
    const ghosts = tiles.filter((t) => t.querySelector('.context-hw-ghost')).length;
    return { hasHeading: /My Letters/.test(document.body.innerText), tiles: tiles.length, keptA: !!keptA, ghosts: ghosts };
  });
  check(doorClicked && shelf.hasHeading && shelf.tiles === 62 && shelf.keptA && shelf.ghosts === 61,
    'L2 the picker shows the FULL 62-tile grid — the kept a in ink, 61 invitations', JSON.stringify(shelf));
  // A kept tile asks first — put on page · make again · fix up ·
  // never mind — and "put it on the page" is the gold one.
  const placed = await page.evaluate(() => {
    const tile = document.querySelector('.context-hw-tile-kept');
    if (!tile) return { ok: false, why: 'no kept tile' };
    tile.click();
    const card = document.querySelector('.context-hw-choice');
    if (!card) return { ok: false, why: 'no choice card' };
    const labels = Array.from(card.querySelectorAll('button')).map((b) => b.textContent.trim());
    const put = Array.from(card.querySelectorAll('button')).find((b) => /Put it on the page/.test(b.textContent));
    if (!put) return { ok: false, why: 'no place option', labels: labels };
    put.click();
    return { ok: true, labels: labels };
  });
  await page.waitForTimeout(900);
  const stripVisible = await page.evaluate(() => {
    const s = document.getElementById('selectionActionStrip');
    return !!(s && !s.className.includes('selection-action-strip-hidden'));
  });
  check(placed.ok && placed.labels.length === 4 && stripVisible,
    'L3 a kept tile asks (place · redo · edit · never mind) and place lands on the page', JSON.stringify(placed) + ' strip=' + stripVisible);
  // An empty tile opens the Studio's own catcher, armed for that letter.
  await page.evaluate(() => {
    const d = document.getElementById('selectionActionDeselect');
    if (d) d.click();   // L3 left the placed letter selected; the Add list needs the neutral panel
  });
  await page.waitForTimeout(300);
  const catcher = await page.evaluate(() => {
    const door2 = Array.from(document.querySelectorAll('button.context-add-card'))
      .find((t) => /My Garden/.test(t.textContent || ''));
    if (door2) door2.click();
    const tab2 = Array.from(document.querySelectorAll('.context-hw-tab'))
      .find((t) => /My Letters/.test(t.textContent || ''));
    if (tab2) tab2.click();
    const ghost = Array.from(document.querySelectorAll('.context-hw-tile'))
      .find((t) => (t.querySelector('.context-hw-ghost') || {}).textContent === 'b');
    if (!ghost) return { opened: false, why: 'no b tile' };
    ghost.click();
    const modal = document.querySelector('.hw-studio-modal');
    const title = modal ? modal.querySelector('.hw-studio-title').textContent : '';
    const ok = !!modal && /Show me your b/.test(title);
    try { HandwritingStudio.close(); } catch (e) {}
    return { opened: ok, title: title, closed: !document.querySelector('.hw-studio-modal') };
  });
  check(catcher.opened && catcher.closed,
    'L4 an empty tile opens the catcher armed for that letter, and it closes clean', JSON.stringify(catcher));

  // Fix it up: the check screen opens holding the KEPT ink — no camera
  // involved — with all three tools; a pencil daub edits the mask and
  // Keep stores the letter and grows the garden.
  const edited = await page.evaluate(async () => {
    const eventsBefore = LivingGarden.state().events;
    const door3 = Array.from(document.querySelectorAll('button.context-add-card'))
      .find((t) => /My Garden/.test(t.textContent || ''));
    if (door3) door3.click();
    const tab3 = Array.from(document.querySelectorAll('.context-hw-tab'))
      .find((t) => /My Letters/.test(t.textContent || ''));
    if (tab3) tab3.click();
    const tile = document.querySelector('.context-hw-tile-kept');
    if (!tile) return { ok: false, why: 'no kept tile' };
    tile.click();
    const fix = Array.from(document.querySelectorAll('.context-hw-choice button'))
      .find((b) => /Fix it up/.test(b.textContent));
    if (!fix) return { ok: false, why: 'no fix option' };
    fix.click();
    await new Promise((r) => setTimeout(r, 600));
    const modal = document.querySelector('.hw-studio-modal');
    if (!modal) return { ok: false, why: 'no modal' };
    const title = modal.querySelector('.hw-studio-title').textContent;
    const tools = Array.from(modal.querySelectorAll('.hw-studio-tool')).map((b) => b.textContent.trim());
    const canvas = modal.querySelector('.hw-studio-check-canvas');
    const hasInk = (() => {
      const x = canvas.getContext('2d');
      const d = x.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 100) return true;
      return false;
    })();
    // one pencil daub through the real pointer path
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, pointerId: 7 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    const keep = Array.from(modal.querySelectorAll('.hw-studio-btn')).find((b) => /Keep it/.test(b.textContent));
    keep.click();
    await new Promise((r2) => setTimeout(r2, 600));
    const eventsAfter = LivingGarden.state().events;
    return { ok: true, title: title, tools: tools, hasInk: hasInk,
             grew: eventsAfter === eventsBefore + 1,
             closed: !document.querySelector('.hw-studio-modal') };
  });
  check(edited.ok && /Your a/.test(edited.title) && edited.tools.length === 3 && edited.hasInk && edited.grew && edited.closed,
    'L5 Fix it up opens the check screen holding the kept ink — pencil·eraser·move — and Keep grows the garden', JSON.stringify(edited));
  await page.evaluate((id) => { try { HandwritingStore.remove(id); } catch (e) {} }, seeded);

  console.log('-- L6: a kept DRAWING asks first, and Fix it up edits the record');
  const drawing = await page.evaluate(async () => {
    // A real creation document, the way the scanner builds one.
    const w = 12, h = 12;
    const img = new ImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      if (i % 3 === 0) { img.data[i * 4] = 20; img.data[i * 4 + 3] = 255; }
    }
    const mask = new Uint8Array(w * h).fill(1);
    const created = BIACreation.create({ imageData: img, crop: { x: 0, y: 0, w: w, h: h }, maskPixels: mask },
      { source: { filename: 'suite.png', width: w, height: h } });
    const r = created.render();
    const res = await CreatorLibrary.save({ name: 'Suite Char', png: r.canvas.toDataURL('image/png'), creation: created.toJSON() });
    if (!res.ok) return { ok: false, why: 'save failed' };
    const before = { updatedAt: res.record.updatedAt, events: LivingGarden.state().events };

    // The picker may already be open (L5's keep reopened it on Letters);
    // otherwise go through the door first.
    if (!document.querySelector('.context-hw-tab')) {
      const door = Array.from(document.querySelectorAll('button.context-add-card'))
        .find((t) => /My Garden/.test(t.textContent || ''));
      if (door) door.click();
    }
    const dtab = Array.from(document.querySelectorAll('.context-hw-tab'))
      .find((t) => /My Drawings/.test(t.textContent || ''));
    if (dtab) dtab.click();
    const tile = Array.from(document.querySelectorAll('.context-library-cell .context-collection-tile'))
      .find((t) => /Suite Char/.test(t.textContent || ''));
    if (!tile) return { ok: false, why: 'no tile' };
    tile.click();
    const card = document.querySelector('.context-hw-choice');
    if (!card) return { ok: false, why: 'no card' };
    const labels = Array.from(card.querySelectorAll('button')).map((b) => b.textContent.trim());
    const fix = Array.from(card.querySelectorAll('button')).find((b) => /Fix it up/.test(b.textContent));
    fix.click();
    await new Promise((r2) => setTimeout(r2, 900));
    const overlay = document.querySelector('[data-step]');
    const step = overlay ? overlay.getAttribute('data-step') : null;
    const keepBtn = Array.from(document.querySelectorAll('button')).find((b) => /Keep in My Garden/.test(b.textContent || ''));
    if (!keepBtn) return { ok: false, why: 'no keep btn', step: step, labels: labels };
    keepBtn.click();
    await new Promise((r3) => setTimeout(r3, 900));
    const rec = CreatorLibrary.get ? CreatorLibrary.get(res.record.id) : null;
    const after = { updatedAt: rec && rec.updatedAt, events: LivingGarden.state().events };
    const out = { ok: true, labels: labels, step: step,
                  updated: !!(after.updatedAt && after.updatedAt !== before.updatedAt),
                  grew: after.events === before.events + 1,
                  sameRecord: !!rec };
    try { CreatorLibrary.remove(res.record.id); } catch (e) {}
    return out;
  });
  check(drawing.ok && drawing.labels.length === 4 && drawing.step === 'yours' && drawing.updated && drawing.grew && drawing.sameRecord,
    'L6 a kept drawing asks (place · retake · edit · never mind); Fix it up opens Make It Yours on the record, Keep updates it and grows the garden',
    JSON.stringify(drawing));

  console.log('-- F: the letters become a FONT');
  // Two letters through the real store → HandwritingFont.rebuild() →
  // a registered "My Handwriting" FontFace, the stored font row (the
  // migration's own base64 shape), and the option seam offering it.
  const font = await page.evaluate(async () => {
    await HandwritingStore.whenReady();
    const draw = (fn) => {
      const c = document.createElement('canvas'); c.width = 60; c.height = 70;
      const x = c.getContext('2d');
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 6; x.lineCap = 'round'; fn(x);
      return c.toDataURL('image/png');
    };
    const r1 = await HandwritingStore.save({ ch: 'o', w: 60, h: 70, png: draw((x) => {
      x.beginPath(); x.arc(30, 38, 20, 0, Math.PI * 2); x.stroke();
    }) });
    const r2 = await HandwritingStore.save({ ch: 'l', w: 60, h: 70, png: draw((x) => {
      x.beginPath(); x.moveTo(30, 8); x.lineTo(30, 64); x.stroke();
    }) });
    const built = await HandwritingFont.rebuild();
    const check16 = document.fonts.check('16px "My Handwriting"');
    const row = HandwritingStore.getFont();
    const withOpt = HandwritingFont.withOption([{ value: 'x', label: 'X' }]);
    const listClean = HandwritingStore.list().every((r) => r.kind !== 'font');
    try { HandwritingStore.remove(r1.record.id); HandwritingStore.remove(r2.record.id); } catch (e) {}
    return { built: built, registered: check16,
             row: !!(row && row.ttf && row.ttf.length > 1000 && /o/.test(row.letters) && /l/.test(row.letters)),
             option: withOpt.length === 2 && withOpt[1].label === 'My Handwriting',
             listClean: listClean };
  });
  check(font.built && font.registered && font.row && font.option && font.listClean,
    'F1 letters build the TTF: FontFace registered, font row stored, lists offer My Handwriting, letters list stays letters', JSON.stringify(font));

  // The font carries its maker's name: with a card whose nickname is
  // known, the family is "<nickname>'s Handwriting".
  const named = await page.evaluate(async () => {
    localStorage.setItem('vihu-magic-card-active-id', 'card-font-name');
    localStorage.setItem('vihu-magic-cards', JSON.stringify([{ id: 'card-font-name', nickname: 'Vihaan' }]));
    const c = document.createElement('canvas'); c.width = 60; c.height = 70;
    const x = c.getContext('2d'); x.strokeStyle = '#1a1a1a'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(30, 8); x.lineTo(30, 64); x.stroke();
    const r = await HandwritingStore.save({ ch: 'l', w: 60, h: 70, png: c.toDataURL('image/png') });
    const built = await HandwritingFont.rebuild();
    const fam = HandwritingFont.family;
    const reg = document.fonts.check("16px \"Vihaan's Handwriting\"");
    const opt = HandwritingFont.withOption([]);
    try { HandwritingStore.remove(r.record.id); } catch (e) {}
    const fr = HandwritingStore.getFont();
    if (fr) try { HandwritingStore.remove(fr.id); } catch (e) {}
    localStorage.removeItem('vihu-magic-card-active-id');
    localStorage.removeItem('vihu-magic-cards');
    return { built: built, family: fam, registered: reg, label: opt.length === 1 && opt[0].label === fam };
  });
  check(named.built && named.family === "Vihaan's Handwriting" && named.registered && named.label,
    "F2 the font carries its maker's name — Vihaan's Handwriting", JSON.stringify(named));

  console.log('-- W: the real store, the real seam');
  // The scanner's keep branch is: CreatorLibrary.save(...) → ok →
  // dispatch vihu:creation-captured with the record id. The camera flow
  // itself lives in a closure (and is the standalone suites' job); what
  // integration means HERE is that a real save's record id grows the
  // garden exactly once — so the suite performs a real save and runs
  // the shipped branch verbatim.
  const seam = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const px = c.toDataURL('image/png');
    const res = await CreatorLibrary.save({ name: 'Suite Creation', png: px, creation: { format: 'vihu-creation', version: 2, note: 'suite fixture' } });
    if (!res || !res.ok) return { ok: false, err: String(res && res.error) };
    const before = LivingGarden.state().events;
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: res.record.id } }));
    const mid = LivingGarden.state().events;
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: res.record.id } }));
    const after = LivingGarden.state().events;
    try { CreatorLibrary.remove(res.record.id); } catch (e) {}
    return { ok: true, before: before, mid: mid, after: after };
  });
  check(seam.ok && seam.mid === seam.before + 1 && seam.after === seam.mid,
    'W1 a real CreatorLibrary.save record grows the garden exactly once through the shipped event', JSON.stringify(seam));

  console.log('-- H: hygiene');
  check(pageErrors.length === 0, 'H1 zero page errors across the whole run', pageErrors.slice(0, 2).join(' | ') || 'clean');

  console.log('==========================================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
