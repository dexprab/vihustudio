/* NOTHING IN THE STUDIO IS RITE-LESS.
 *
 * "we need to have each tile, each capability covered under a story
 * rite. if we have to increase the number of story rites we will do
 * that, but do ensure nothing offered in studio either a tile or a
 * capability is rite less." — the product owner.
 *
 * That is an invariant, and an invariant nothing checks is a wish.
 * Decision 22 already records the hazard in as many words — "every new
 * control in the Add panel must be added to the reduction in the same
 * commit that adds the control" — and it has already leaked twice: My
 * Garden's own tile stayed on screen through Rite I, and so did the
 * Background panel's Picture row. Both were found by a person looking
 * at a screenshot.
 *
 * This suite is what replaces that person. It boots a GRANDFATHERED
 * Studio — everything visible, nothing hidden — walks the surfaces a
 * child can reach, and cross-references every control it finds against
 * MANIFEST below. A control that is not in the manifest fails the run;
 * a manifest entry naming a capability no rite teaches fails the run.
 *
 * It deliberately does NOT hide anything. Gating a control whose rite
 * has no story yet takes it away with no way to earn it, so hiding is
 * done rite by rite as the stories are written. What this guarantees is
 * that the list of what is still rite-less is always current, always
 * visible, and can never quietly grow.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/capability-audit/run-capability-audit.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.AUDIT_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;

// ---------------------------------------------------------------
// THE MANIFEST. Every control a child can reach, and the capability it
// belongs to. `null` means "measured, and no rite teaches it yet" —
// those are reported as the standing debt rather than silently passing.
//
// Keys are what the DOM actually exposes: data-add-id, data-set-id, and
// a designer row's own label. A label is scoped by object type where it
// is ambiguous ("Size" is a font size on text and a scale on a sticker).
// ---------------------------------------------------------------
const MANIFEST = {
  add: {
    stickers: 'emoji', text: 'text', shapes: 'shapes', doodle: 'doodle',
    photo: 'photo', family: 'photo', library: 'garden',
    fromWorld: 'world', voice: 'voice'
  },
  set: {
    storyTitle: 'story-name', background: 'background', pageShape: 'page-shape',
    quote: null, caption: null
  },
  section: {
    'context-bg-picture-section': 'photo',
    'context-rep-section': null            // Page Style — needs a World
  },
  // Designer rows, by label. Everything Rite I teaches an object is
  // here; everything else is honest debt.
  row: {
    'Spin': 'rotate',
    'Move': 'move',
    'Words': 'text',
    'Size': null,            // font size on text; scale elsewhere
    'See Through': null,
    'Font': null,
    'Weight': null,
    'Style': null,
    'Fill Style': null,
    'Colour': null,
    'Background Colour': null,
    'Alignment': null,
    'Width': null,
    'Picture': null,
    'Picture Area': null,
    'Shape': null
  }
};

let passed = 0, failed = 0;
function check(c, n, note) {
  if (c) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  console.log('\nIS ANYTHING IN THE STUDIO RITE-LESS?\n');

  // Grandfathered on purpose: this has to see EVERYTHING, including the
  // controls a gated child never meets.
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreationFlow !== 'undefined' && typeof StudioRite !== 'undefined',
    null, { timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    const g = await page.evaluate(() => {
      const o = document.getElementById('gatewayOverlay');
      if (!o || o.hidden || !o.offsetParent) return true; o.click(); return false;
    });
    if (g) break; await page.waitForTimeout(600);
  }
  await page.evaluate(() => {
    const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none';
    try { CreationFlow.startBlank(); } catch (e) {}
  });
  await page.waitForTimeout(1600);

  // ---- what the registry can teach at all ----
  const known = await page.evaluate(() => {
    const caps = [];
    StudioRite.rites().forEach(function () {});
    return { taught: StudioRite.taught().slice().sort(), rites: StudioRite.rites().map((r) => r.id) };
  });
  check(known.taught.length > 0, 'A0 the registry answers', known.rites.join(' > '));

  // ---- walk the page-level panel ----
  const seen = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 3 && r.height > 3; };
    const label = (e) => e.textContent.trim().replace(/[0-9]+\s*(px|%|°).*$/, '').trim();
    return {
      add: Array.from(document.querySelectorAll('.context-add-card')).filter(vis).map((e) => e.getAttribute('data-add-id')),
      set: Array.from(document.querySelectorAll('.context-set-tile')).filter(vis).map((e) => e.getAttribute('data-set-id')),
      row: Array.from(document.querySelectorAll('.designer-row-label')).filter(vis).map(label),
      section: Array.from(document.querySelectorAll('.context-rep-section,.context-bg-picture-section')).filter(vis).map((e) => e.className.split(' ')[0])
    };
  });

  // ---- a Text object, the richest Refine panel a child can open ----
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.context-add-card')).find((e) => e.getAttribute('data-add-id') === 'text');
    if (t) t.click();
  });
  await page.waitForTimeout(1400);
  const textRows = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 3 && r.height > 3; };
    return Array.from(document.querySelectorAll('.designer-row-label')).filter(vis)
      .map((e) => e.textContent.trim().replace(/[0-9]+\s*(px|%|°).*$/, '').trim());
  });

  // ---- THE INVARIANT ----
  const unmapped = [];
  const addUnmapped = (kind, list) => list.forEach((k) => {
    if (k && !(k in MANIFEST[kind])) unmapped.push(kind + ':' + k);
  });
  addUnmapped('add', seen.add);
  addUnmapped('set', seen.set);
  addUnmapped('section', seen.section);
  addUnmapped('row', seen.row.concat(textRows));

  check(unmapped.length === 0,
    'A1 every control on screen is in the manifest — nothing was added without declaring what teaches it',
    unmapped.join(', ') || 'all accounted for');

  // Every capability the manifest names must be taught by some rite.
  const named = [];
  Object.keys(MANIFEST).forEach((kind) => Object.keys(MANIFEST[kind]).forEach((k) => {
    const cap = MANIFEST[kind][k];
    if (cap && named.indexOf(cap) < 0) named.push(cap);
  }));
  const orphanCaps = named.filter((c) => known.taught.indexOf(c) < 0);
  check(orphanCaps.length === 0,
    'A2 every capability the manifest names is taught by a rite', orphanCaps.join(', ') || 'all taught');

  // ---- THE STANDING DEBT, reported rather than asserted away ----
  const debt = [];
  Object.keys(MANIFEST).forEach((kind) => Object.keys(MANIFEST[kind]).forEach((k) => {
    if (MANIFEST[kind][k] === null) debt.push(kind + ':' + k);
  }));
  console.log('\n  RITE-LESS, still: ' + debt.length + ' controls');
  debt.forEach((d) => console.log('    · ' + d));
  console.log('\n  Every one of these is a control a child can reach with no story');
  console.log('  behind it. They are not hidden — hiding a control whose rite has');
  console.log('  no story takes it away with no way to earn it — so each is closed');
  console.log('  by writing the rite that teaches it and mapping it here.\n');

  check(pageErrors.length === 0, 'A3 zero page errors', pageErrors.slice(0, 3).join(' | '));
  console.log(passed + ' passed, ' + failed + ' failed');
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})();
