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
 *   · V1-V16 — the Living Growth pass, engine-side over five seeds x
 *     120 captures: NO silent captures, the six stages in their own
 *     windows, the seeded form vocabulary, the ceiling, determinism of
 *     both the garden AND the growth decisions, no Math.random in the
 *     growth path, byte-identical re-renders
 *   · X1-X7 — and the same thing proved on the page: a bud opens, a
 *     flower ripens, a leaf swells, a capture that adds no element
 *     still lights and moves, the light still goes out, a re-render
 *     animates nothing, and twenty consecutive real captures are each
 *     answered on screen
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

  // ---------------------------------------------------------------
  // GL: NEW GROWTH CARRIES LIGHT — and gives it back.
  // The product owner: "anything which new grows should have a glow."
  // The two halves are equally load-bearing. A glow that arrives is the
  // request; a glow that STAYS would be a "these are the newest ones"
  // marker a child could read backwards from, which is the quiet kind
  // of counter Decision 27 rules out. So the suite measures both, and
  // it measures them ON THE CLOCK: the first probe has to land while
  // the light is up (the fade starts 4.7s in), which is why this
  // dispatches its own capture instead of using capture()'s 1.8s wait.
  // ---------------------------------------------------------------
  console.log('-- GL: the glow on new growth');
  const glowProbe = () => page.evaluate(() => {
    const layer = document.getElementById('livingGardenLayer');
    if (!layer) return { lit: 0, filtered: 0, total: 0, glowPaths: 0 };
    const kids = Array.from(layer.children);
    let lit = 0, filtered = 0, glowPaths = 0;
    kids.forEach((n) => {
      const f = n.style.filter || '';
      if (f) filtered++;
      // the ON state's own blur radius; the OFF state is 0px 0px 0px
      if (f.indexOf('3px') >= 0) lit++;
      if (n.getAttribute && n.getAttribute('stroke') === '#F5C542') glowPaths++;
    });
    return { lit: lit, filtered: filtered, total: kids.length, glowPaths: glowPaths };
  });
  const growNow = () => page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('vihu:creation-captured',
      { detail: { id: 'glow-' + Date.now() + '-' + Math.random().toString(36).slice(2) } }));
  });

  const gDark = await glowProbe();
  check(gDark.filtered === 0 && gDark.glowPaths === 0,
    'GL1 a settled garden carries no light at all', JSON.stringify(gDark));

  // A capture can add a vine node and no decoration, so give it a few
  // tries to produce a lit LEAF rather than only a lit vine tip.
  let gLit = { lit: 0, filtered: 0, total: 0, glowPaths: 0 };
  for (let tries = 0; tries < 4 && gLit.lit < 1; tries++) {
    await growNow();
    await page.waitForTimeout(900);
    gLit = await glowProbe();
    if (gLit.lit < 1) await page.waitForTimeout(8200);   // let it go dark again
  }
  check(gLit.lit >= 1, 'GL2 new growth arrives lit', JSON.stringify(gLit));
  check(gLit.glowPaths >= 1, 'GL3 the growing vine tip carries the light too', JSON.stringify(gLit));
  check((gLit.lit + gLit.glowPaths) < gLit.total,
    'GL4 the established garden is NOT lit — only what just grew', JSON.stringify(gLit));
  await page.screenshot({ path: path.join(SHOTS, 'glow-lit.png') });
  // and a close crop of the left band, where the light is actually
  // readable at reading distance rather than a dot in a full frame
  await page.screenshot({ path: path.join(SHOTS, 'glow-lit-close.png'),
    clip: { x: 300, y: 380, width: 170, height: 380 } });

  await page.waitForTimeout(8400);          // and the light goes out
  const gOut = await glowProbe();
  check(gOut.filtered === 0 && gOut.glowPaths === 0,
    'GL5 the light goes out and leaves nothing behind', JSON.stringify(gOut));

  await page.evaluate(() => { GardenRenderer.render(); });
  await page.waitForTimeout(300);
  const gRe = await glowProbe();
  check(gRe.filtered === 0 && gRe.glowPaths === 0,
    'GL6 a plain re-render lights nothing — growth is what glows, not the garden', JSON.stringify(gRe));

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
    await page.waitForTimeout(5600);   // slow-motion growth finishes before the stage portrait
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
  // The ink matches the Studio: a letter stored near-black (the seed
  // above) is recolored to the Studio's navy by the legacy sweep, alpha
  // untouched — the child's exact ink, in the house colour.
  const ink = await page.evaluate(async (id) => {
    await HandwritingStore.recolorLegacyInk();
    const rec = HandwritingStore.list().find((r) => r.id === id);
    if (!rec) return { ok: false };
    return await new Promise((resolve) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = rec.glyph.w; c.height = rec.glyph.h;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 0) { resolve({ ok: true, rgb: [d[i], d[i + 1], d[i + 2]] }); return; }
        }
        resolve({ ok: false });
      };
      im.src = rec.glyph.png;
    });
  }, seeded);
  check(ink.ok && ink.rgb.join(',') === '29,52,87',
    'N1 stored ink wears the Studio navy (#1D3457), alpha untouched', JSON.stringify(ink));
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
    const drawCard = Array.from(document.querySelectorAll('.context-hw-drawcard'))
      .find((t) => /Suite Char/.test(t.textContent || ''));
    if (!drawCard) return { ok: false, why: 'no card element' };
    drawCard.querySelector('.context-hw-drawcard-pic').click();
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
  check(drawing.ok && drawing.labels.length === 5 && drawing.step === 'yours' && drawing.updated && drawing.grew && drawing.sameRecord,
    'L6 a kept drawing asks (place · retake · edit · take out · never mind); Fix it up opens Make It Yours on the record, Keep updates it and grows the garden',
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

  // The stroke width of the font is consistent: one letter written BIG
  // (thin after normalize) and one written SMALL (fat after normalize)
  // must come out of the built TTF with near-equal strokes. Measured by
  // parsing the stored ttf back with opentype and rasterizing both
  // glyphs at one size.
  const strokes = await page.evaluate(async () => {
    const pen = (size, penW, fn) => {
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const x = c.getContext('2d');
      x.strokeStyle = '#1a1a1a'; x.lineWidth = penW; x.lineCap = 'round'; fn(x, size);
      return { png: c.toDataURL('image/png'), w: size, h: size };
    };
    // same 6px pen, very different paper distance
    const big = pen(240, 6, (x, s) => { x.beginPath(); x.moveTo(s * .25, s * .8); x.lineTo(s * .25, s * .3);
      x.quadraticCurveTo(s * .5, s * .15, s * .7, s * .3); x.lineTo(s * .7, s * .8); x.stroke(); });
    const small = pen(56, 6, (x, s) => { x.beginPath(); x.arc(s * .5, s * .55, s * .3, 0, Math.PI * 2); x.stroke(); });
    const rn = await HandwritingStore.save({ ch: 'n', w: big.w, h: big.h, png: big.png });
    const ro = await HandwritingStore.save({ ch: 'o', w: small.w, h: small.h, png: small.png });
    await HandwritingFont.rebuild();
    const row = HandwritingStore.getFont();
    const buf = Uint8Array.from(atob(row.ttf), (c) => c.charCodeAt(0)).buffer;
    const font = opentype.parse(buf);
    const strokeOf = (ch) => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200;
      const x = c.getContext('2d');
      font.getPath(ch, 20, 150, 120).draw(x);
      const d = x.getImageData(0, 0, 200, 200).data;
      const runs = [];
      for (let y = 0; y < 200; y++) {
        let run = 0;
        for (let px = 0; px <= 200; px++) {
          const on = px < 200 && d[(y * 200 + px) * 4 + 3] > 100;
          if (on) run++; else if (run) { runs.push(run); run = 0; }
        }
      }
      runs.sort((a, b) => a - b);
      return runs.length ? runs[Math.floor(runs.length / 2)] : 0;
    };
    const sn = strokeOf('n'), so = strokeOf('o');
    try { HandwritingStore.remove(rn.record.id); HandwritingStore.remove(ro.record.id); } catch (e) {}
    const fr = HandwritingStore.getFont(); if (fr) try { HandwritingStore.remove(fr.id); } catch (e) {}
    return { n: sn, o: so, ratio: sn && so ? Math.max(sn, so) / Math.min(sn, so) : 99 };
  });
  check(strokes.n > 0 && strokes.o > 0 && strokes.ratio <= 1.8,
    'F3 mixed-distance captures come out with consistent stroke width (ratio ≤ 1.8)', JSON.stringify(strokes));

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

  // ---------------------------------------------------------------
  // V: THE GROWTH VOCABULARY, and the end of the silent capture.
  //
  // `added = after.length - before.length` was the wrong signal: a bud
  // opening into a flower, a flower ripening into fruit and a leaf
  // filling out all change the garden without changing its size, so a
  // third of the captures past capture forty animated NOTHING. These
  // checks are engine-level and run five seeds through 120 captures
  // each — the sprint's own acceptance matrix (§18) and its regression
  // list (§19).
  // ---------------------------------------------------------------
  console.log('-- V: the growth vocabulary, measured over 5 seeds x 120 captures');
  const SEEDS = [12345, 777, 20250823, 42, 999983];
  async function runSeeds() {
    return page.evaluate((seeds) => {
      const out = [];
      seeds.forEach((seed) => {
        const key = 'vihu-living-garden:vseed-' + seed;
        localStorage.setItem('vihu-magic-card-active-id', 'vseed-' + seed);
        localStorage.setItem(key, JSON.stringify({ v: 1, seed: seed, events: 0, recentIds: [] }));
        LivingGarden.state();      // force the cache onto this key
        const row = { seed: seed, noChange: [], zeroDelta: [], types: [], counts: [], forms: {} };
        let prev = 0;
        for (let i = 0; i < 120; i++) {
          const r = LivingGarden.captured({ id: 'v-' + seed + '-' + i });
          const g = r.growth || { added: [], transformed: [] };
          if ((g.added.length + g.transformed.length) === 0) row.noChange.push(i);
          row.types.push(g.type);
          const els = LivingGarden.state().elements;
          if (els.length === prev) row.zeroDelta.push(i);
          prev = els.length;
          row.counts.push(els.length);
        }
        LivingGarden.state().elements.forEach(function (e) {
          if (e.f && e.f !== 'plain') row.forms[e.k + ':' + e.f] = (row.forms[e.k + ':' + e.f] || 0) + 1;
        });
        out.push(row);
        localStorage.removeItem(key);
        localStorage.removeItem('vihu-magic-card-active-id');
      });
      return out;
    }, seeds);
  }
  const seeds = SEEDS;
  const runs = await runSeeds();
  const noChange = runs.reduce((n, r) => n + r.noChange.length, 0);
  const zeroDelta = runs.reduce((n, r) => n + r.zeroDelta.length, 0);
  check(noChange === 0,
    'V1 no silent captures — every one of 600 captures reports a change',
    noChange + ' silent; ' + zeroDelta + ' of them add no element and are reported as transformations');
  check(zeroDelta > 100,
    'V1b and the element-count-neutral captures are real and numerous — exactly the ones that used to be invisible',
    zeroDelta + ' transformations across 600 captures');

  // §18's ladder, stage by stage, on every seed.
  const ladder = runs.map((r) => {
    const t = r.types;
    const inRange = (a, b, fn) => t.slice(a, b).some(fn);
    return {
      seed: r.seed,
      origin: t[0] === 'origin_created',
      earlyVine: t.slice(1, 5).every((x) => x === 'vine_extended'),
      travelVariety: new Set(t.slice(5, 13)).size >= 2,
      newChapter: t.slice(13, 24).indexOf('vine_born') >= 0,
      connection: inRange(24, 40, (x) => x === 'connection_created'),
      // THE SEASONS, AT THE PACE A REAL GARDEN GETS. These windows used
      // to be 24-39 / 40-59 / 55+, which was the original engine's
      // pacing and is why a twenty-capture garden — the product
      // owner's — was a plain green vine with none of this sprint's
      // vocabulary in it. Halved on his decision. The bounds carry
      // headroom over the measured worst case across seven seeds
      // (13 seeds: bud 9/13/32, flower 24/25/33, fruit 26/31/43 as
      // min/avg/max), so this fails if the pacing quietly slips back
      // rather than only when it breaks outright.
      //
      // The 32 is honest and is the cost of a rule this suite also
      // enforces: STRUCTURE OUTRANKS SEASON (see V5). One seed in
      // thirteen spends its whole branching phase finishing the left
      // vine, birthing the right one and climbing it, so its forced
      // bud has no spare step until the phase after. A garden whose
      // plant is still being built is not the plain-green-vine problem
      // this pacing change exists to fix.
      buds: inRange(0, 34, (x) => x === 'bud_created'),
      flowers: inRange(0, 36, (x) => x === 'bud_opened' || x === 'flower_bloomed'),
      fruit: inRange(0, 48, (x) => x === 'flower_ripened'),
      capped: Math.max.apply(null, r.counts) <= 112,
      lateAlive: new Set(t.slice(110)).size >= 2,
      lateNotAllScale: t.slice(105).filter((x) => x === 'leaf_grew').length < t.slice(105).length * 0.6
    };
  });
  const every = (k) => ladder.every((l) => l[k]);
  check(every('origin'), 'V2 capture 0 is the origin, on every seed');
  check(every('earlyVine'), 'V3 captures 1-4 establish the first vine, on every seed');
  check(every('travelVariety'), 'V4 captures 5-12 are not one repeated move — edge travel varies');
  check(every('newChapter'), 'V5 the right vine is BORN in 13-23 as its own event, not another leaf',
    ladder.map((l) => l.seed + ':' + l.newChapter).join(' '));
  check(every('connection'), 'V6 the top arc closes in 24-39 as its own growth');
  check(every('buds'), 'V7 buds arrive by capture 34 at worst, ~13 typically — was 34 typically');
  check(every('flowers'), 'V8 flowers arrive by capture 36 at worst, ~25 typically — was 41; and bud → flower is a REPORTED growth, not a silent one');
  check(every('fruit'), 'V9 fruit ripens by capture 48 at worst, ~31 typically — was 60');
  check(every('capped'), 'V10 the element count never passes the ceiling',
    runs.map((r) => Math.max.apply(null, r.counts)).join(' '));
  check(every('lateAlive'), 'V11 past 110 captures the garden still changes, and in more than one way',
    runs.map((r) => Array.from(new Set(r.types.slice(110))).join('/')).join(' | '));
  check(every('lateNotAllScale'), 'V12 late growth is not mostly "the same leaves get bigger" — transformations dominate',
    runs.map((r) => r.types.slice(105).filter((x) => x === 'leaf_grew').length + '/' + r.types.slice(105).length).join(' '));

  const allForms = {};
  runs.forEach((r) => Object.keys(r.forms).forEach((k) => { allForms[k] = (allForms[k] || 0) + r.forms[k]; }));
  const wantForms = ['leaf:curl', 'leaf:pair', 'sprig:fork', 'flower:open', 'fruit:pair'];
  const missing = wantForms.filter((k) => !allForms[k]);
  check(missing.length === 0, 'V13 the whole seeded vocabulary actually occurs', JSON.stringify(allForms));

  // §14 — determinism. Same seed, same events, same garden AND the same
  // growth decisions. Run one seed twice from scratch and compare.
  const det = await page.evaluate(() => {
    const run = () => {
      localStorage.setItem('vihu-magic-card-active-id', 'det-' + Math.random());
      localStorage.setItem('vihu-living-garden:' + localStorage.getItem('vihu-magic-card-active-id'),
        JSON.stringify({ v: 1, seed: 24680, events: 0, recentIds: [] }));
      LivingGarden.state();
      const types = [];
      for (let i = 0; i < 90; i++) types.push(LivingGarden.captured({ id: 'd-' + Math.random() }).growth.type);
      const els = JSON.stringify(LivingGarden.state().elements);
      localStorage.removeItem('vihu-living-garden:' + localStorage.getItem('vihu-magic-card-active-id'));
      localStorage.removeItem('vihu-magic-card-active-id');
      return { types: types.join(','), els: els };
    };
    const a = run(), b = run();
    return { sameTypes: a.types === b.types, sameEls: a.els === b.els, len: a.els.length };
  });
  check(det.sameTypes && det.sameEls,
    'V14 same seed + same event count = same garden AND the same growth decisions', JSON.stringify(det));

  // §14's other half: no Math.random anywhere in the growth path. The
  // engine does use it ONCE, to mint a seed for a brand-new garden —
  // which is not growth. Scanned at the source, in the step itself.
  const engineSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'gardenEngine.js'), 'utf8');
  const stepSrc = engineSrc.slice(engineSrc.indexOf('function _step('), engineSrc.indexOf('function _build('));
  check(stepSrc.indexOf('Math.random') < 0 && (engineSrc.match(/Math\.random/g) || []).length === 1,
    'V15 growth never touches Math.random — the one use left is minting a new garden\'s seed',
    (engineSrc.match(/Math\.random/g) || []).length + ' use(s) in the module, 0 in _step');

  // §15 — a re-render must produce byte-identical markup and never grow.
  const rerender = await page.evaluate(() => {
    GardenRenderer.render();
    const a = document.getElementById('livingGardenLayer').innerHTML;
    const e1 = LivingGarden.state().events;
    GardenRenderer.render();
    const b = document.getElementById('livingGardenLayer').innerHTML;
    return { same: a === b, grew: LivingGarden.state().events !== e1, len: a.length };
  });
  check(rerender.same && !rerender.grew,
    'V16 two renders produce byte-identical markup and grow nothing', JSON.stringify(rerender));

  // ---------------------------------------------------------------
  // X: A TRANSFORMATION ANIMATES. The DOM proof that the reporting fix
  // reached the screen — a capture that adds ZERO elements still lights
  // and moves the element it changed.
  // ---------------------------------------------------------------
  console.log('-- X: transformations animate');
  async function setGarden(seed, events) {
    await page.evaluate(({ seed, events }) => {
      localStorage.removeItem('vihu-magic-card-active-id');
      localStorage.setItem('vihu-living-garden:traveller', JSON.stringify({ v: 1, seed: seed, events: events, recentIds: [] }));
      localStorage.setItem('vihu-magic-card-active-id', 'x-bust');   // force a cache miss
      LivingGarden.state();
      localStorage.removeItem('vihu-magic-card-active-id');
      LivingGarden.state();
    }, { seed: seed, events: events });
  }
  // Find the first capture on this seed that produces the wanted growth,
  // by asking the engine rather than by guessing a number.
  // DISCLOSED, MEASURED, AND NOT THIS SPRINT'S TO FIX: this workspace
  // has no TOP margin. The page canvas is flush with the top of
  // .preview-wrapper at every viewport tried (1024/1280/1440/1920 —
  // (p.top - h.top) - PAGE_GAP is -14 in all four), so the top band is
  // always narrower than the renderer's own minimum and draws nothing.
  // Growth the engine commits to that band therefore has no answer on
  // screen: measured, 77 of 600 captures across five seeds change only
  // top-band elements. The engine reports every one of them correctly;
  // there is simply nowhere to draw them. Fixing it means either the
  // engine knowing the workspace's geometry or the band mapping
  // changing, and the sprint locks BOTH. So the probes below pick a
  // case that CAN be drawn, and X7 states the boundary out loud.
  async function findGrowth(seed, wantType, maxN) {
    return page.evaluate(({ seed, wantType, maxN }) => {
      for (let k = 0; k < maxN; k++) {
        localStorage.setItem('vihu-living-garden:probe', JSON.stringify({ v: 1, seed: seed, events: k, recentIds: [] }));
        localStorage.setItem('vihu-magic-card-active-id', 'probe');
        LivingGarden.state();
        const r = LivingGarden.captured({ id: 'p-' + seed + '-' + k });
        const els = LivingGarden.state().elements;
        const affected = (r.growth ? r.growth.added.concat(r.growth.transformed) : []);
        const drawable = affected.some(function (j) { return els[j] && els[j].band !== 'top'; });
        if (r.growth && r.growth.type === wantType && drawable) {
          localStorage.removeItem('vihu-living-garden:probe');
          localStorage.removeItem('vihu-magic-card-active-id');
          return k;
        }
      }
      localStorage.removeItem('vihu-living-garden:probe');
      localStorage.removeItem('vihu-magic-card-active-id');
      return -1;
    }, { seed: seed, wantType: wantType, maxN: maxN });
  }
  const changeProbe = () => page.evaluate(() => {
    const layer = document.getElementById('livingGardenLayer');
    const kids = Array.from(layer.children);
    let opened = 0, swelled = 0, lit = 0, ghosts = 0;
    kids.forEach((n) => {
      const i = n.firstChild;
      const a = (i && i.style && i.style.animation) || '';
      if (a.indexOf('vihuGardenOpen') >= 0) opened++;
      if (a.indexOf('vihuGardenSwell') >= 0) swelled++;
      if ((n.style.filter || '').indexOf('3px') >= 0) lit++;
      if (n.getAttribute && n.getAttribute('data-garden-ghost')) ghosts++;
    });
    return { opened: opened, swelled: swelled, lit: lit, ghosts: ghosts, total: kids.length,
             elements: LivingGarden.state().elements.length };
  });

  const XSEED = 12345;
  const cases = [
    { type: 'bud_opened',     max: 90,  ghost: 'bud',    name: 'X1 a bud OPENS into a flower — the bud is shown giving way' },
    { type: 'flower_ripened', max: 120, ghost: 'flower', name: 'X2 a flower RIPENS into fruit — the flower is shown giving way' },
    { type: 'leaf_grew',      max: 130, ghost: null,     name: 'X3 a leaf filling out swells where it stands' }
  ];
  for (const c of cases) {
    const k = await findGrowth(XSEED, c.type, c.max);
    if (k < 0) { fail(c.name, 'no ' + c.type + ' within ' + c.max + ' captures'); continue; }
    await setGarden(XSEED, k);
    await page.evaluate(() => GardenRenderer.render());
    await page.waitForTimeout(400);
    const before = await changeProbe();
    await page.evaluate((t) => document.dispatchEvent(new CustomEvent('vihu:creation-captured',
      { detail: { id: 'x-' + t + '-' + Date.now() } })), c.type);
    await page.waitForTimeout(1000);
    const after = await changeProbe();
    const moved = c.type === 'leaf_grew' ? (after.swelled >= 1) : (after.opened >= 1);
    check(moved && after.lit >= 1 && after.elements === before.elements &&
          (c.ghost ? after.ghosts >= 1 : true),
      c.name, 'capture ' + (k + 1) + ' · ' + JSON.stringify(after) + ' (was ' + before.elements + ' elements)');
    if (c.type === 'bud_opened') {
      await page.screenshot({ path: path.join(SHOTS, 'transform-bud-opening.png'),
        clip: { x: 300, y: 100, width: 150, height: 640 } });
    }
    await page.waitForTimeout(6200);   // the light goes out before the next case
  }

  // The whole point, stated as one check: a capture that adds NOTHING
  // still has a visible answer on screen.
  const kSilent = await findGrowth(XSEED, 'flower_ripened', 120);
  await setGarden(XSEED, kSilent);
  await page.evaluate(() => GardenRenderer.render());
  await page.waitForTimeout(400);
  const sBefore = await changeProbe();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'silent-' + Date.now() } })));
  await page.waitForTimeout(1000);
  const sAfter = await changeProbe();
  check(sAfter.elements === sBefore.elements && (sAfter.opened + sAfter.swelled) >= 1 && sAfter.lit >= 1,
    'X4 a capture that adds no element is NOT silent — the changed element lights and moves',
    sBefore.elements + ' → ' + sAfter.elements + ' elements, ' + JSON.stringify(sAfter));

  await page.waitForTimeout(8400);
  const sSettled = await changeProbe();
  check(sSettled.lit === 0 && sSettled.ghosts === 0,
    'X5 the light goes out after a transformation too, and the ghost is gone', JSON.stringify(sSettled));
  await page.evaluate(() => GardenRenderer.render());
  await page.waitForTimeout(300);
  const sRe = await changeProbe();
  check(sRe.lit === 0 && sRe.opened === 0 && sRe.swelled === 0 && sRe.ghosts === 0,
    'X6 a plain re-render animates no transformation and lights nothing', JSON.stringify(sRe));
  await page.screenshot({ path: path.join(SHOTS, 'transform-settled.png'),
    clip: { x: 300, y: 100, width: 150, height: 640 } });

  // X7 — the end-to-end claim, run for real: TWENTY consecutive
  // captures through the shipped event, each one checked on the page.
  // A capture is answered if the layer shows an unfold, an opening, a
  // swell or a light. The only ones allowed to go unanswered are those
  // whose whole growth landed in the top band this workspace does not
  // have — counted, not waved away.
  console.log('-- X7: twenty consecutive captures, each answered on screen');
  await setGarden(XSEED, 44);
  await page.evaluate(() => {
    window.__lastGrowth = null;
    LivingGarden.onChange(function (ev) { window.__lastGrowth = ev.growth; });
    GardenRenderer.render();
  });
  await page.waitForTimeout(400);
  let answered = 0, topOnly = 0, unanswered = [];
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'x7-' + Date.now() + '-' + Math.random() } }));
    });
    await page.waitForTimeout(950);
    const probe = await page.evaluate(() => {
      const layer = document.getElementById('livingGardenLayer');
      const kids = Array.from(layer.children);
      let moving = 0, lit = 0;
      kids.forEach((n) => {
        const inr = n.firstChild;
        // A vine tail draws itself on the PATH (no inner group); a leaf,
        // bud, flower or fruit animates its inner group. Both count.
        const a = ((inr && inr.style && inr.style.animation) || '') + ' ' + (n.style.animation || '');
        const t = ((inr && inr.style && inr.style.transition) || '') + ' ' + (n.style.transition || '');
        if (/vihuGardenOpen|vihuGardenSwell/.test(a) || /opacity|stroke-dashoffset|transform/.test(t)) moving++;
        if ((n.style.filter || '').indexOf('3px') >= 0 || t.indexOf('filter') >= 0
            || (n.getAttribute && n.getAttribute('stroke') === '#F5C542')) lit++;
      });
      return { moving: moving, lit: lit };
    });
    const wasTopOnly = await page.evaluate(() => {
      const g = window.__lastGrowth;
      if (!g) return false;
      const els = LivingGarden.state().elements;
      const affected = g.added.concat(g.transformed);
      return affected.length > 0 && affected.every(function (j) { return els[j] && els[j].band === 'top'; });
    });
    if (probe.moving >= 1 || probe.lit >= 1) answered++;
    else if (wasTopOnly) topOnly++;
    else unanswered.push(await page.evaluate((i) => {
      const g = window.__lastGrowth, els = LivingGarden.state().elements;
      const aff = g.added.concat(g.transformed);
      return i + ':' + g.type + ':' + aff.map(function (j) { return els[j] && (els[j].band + '/' + els[j].k); }).join('+');
    }, i));
    await page.waitForTimeout(150);
  }
  check(answered + topOnly === 20 && answered >= 14,
    'X7 every one of twenty consecutive captures is answered on screen (bar those that land in the absent top band)',
    answered + ' answered, ' + topOnly + ' top-band-only, unanswered ' + JSON.stringify(unanswered));

  console.log('-- H: hygiene');
  check(pageErrors.length === 0, 'H1 zero page errors across the whole run', pageErrors.slice(0, 2).join(' | ') || 'clean');

  console.log('==========================================================');
  console.log(passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
