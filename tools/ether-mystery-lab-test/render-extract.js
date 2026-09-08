#!/usr/bin/env node
/* tools/ether-mystery-lab-test/render-extract.js — draws every result of
 * real-extract.json in the REAL Shape Lab and walks the REAL Ether
 * preview, into shots/extract/<id>/:
 *
 *   author-8.png · judge-8.png      AUTHOR (over the source) and JUDGE
 *                                   (unfinished) at the production budget
 *   author-12.png · judge-12.png    the same at twelve
 *   ether-1-unfinished.jpg · ether-2-complete.jpg · ether-3-reveal.jpg ·
 *   ether-4-alive.jpg · ether-5-roam.jpg · noreveal-complete.jpg
 *                                   the loop in the real sky at eight,
 *                                   through js/etherMystery.js unmodified,
 *                                   every SUPPORTED reveal accepted
 *
 * It drives the real page the way a researcher does: the picture through
 * the front door's own file input, the extraction through
 * LabExtract.load (the Understand & Build Ether button's own seam), the
 * reveals through the page's own Accept, the preview through ▶ Play in
 * Ether. Nothing is re-extracted here and nothing is judged.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/ether-mystery-lab-test/render-extract.js [ids…]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'shots', 'extract');
const PORT = Number(process.env.ETHER_LAB_PORT || 8919);
const report = JSON.parse(fs.readFileSync(path.join(OUT, 'real-extract.json'), 'utf8'));

async function shot(page, sel, file) { const c = await page.$(sel); await c.screenshot({ path: file }); }

async function walkEther(ctx, page, dir, withReveal) {
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-play]')]);
  await pop.setViewportSize({ width: 1440, height: 900 });
  await pop.waitForFunction(() => !!window.LabPreview && !!window.LabPreview.mystery && window.LabPreview.mystery(), null, { timeout: 20000 });
  await pop.waitForTimeout(1800);
  if (withReveal) await pop.screenshot({ path: path.join(dir, 'ether-1-unfinished.jpg'), type: 'jpeg', quality: 82 });
  const walk = await pop.evaluate(async () => {
    const my = window.LabPreview.mystery(); let i = my.instrument();
    const out = { hint: document.querySelector('[data-hint]').textContent, hintOn: document.querySelector('[data-hint]').classList.contains('on'), missing: i.arrangement.missingLeft, elements: i.elements.length, steps: [] };
    let g = 30;
    while (g-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
      const gap = i.arrangement.links.filter((L) => !L.present)[0];
      my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y); my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
      i = my.instrument(); out.steps.push(i ? i.arrangement.missingLeft : 'gone');
    }
    return out;
  });
  await pop.waitForTimeout(600);
  await pop.screenshot({ path: path.join(dir, withReveal ? 'ether-2-complete.jpg' : 'noreveal-complete.jpg'), type: 'jpeg', quality: 82 });
  if (!withReveal) { await pop.waitForTimeout(1700); await pop.screenshot({ path: path.join(dir, 'noreveal-reveal-beat.jpg'), type: 'jpeg', quality: 82 }); await pop.close(); return { walk }; }
  await pop.waitForTimeout(1700);
  await pop.screenshot({ path: path.join(dir, 'ether-3-reveal.jpg'), type: 'jpeg', quality: 82 });
  const reveal = await pop.evaluate(() => window.LabPreview.report().happened.reveal);
  await pop.waitForTimeout(4200);
  await pop.screenshot({ path: path.join(dir, 'ether-4-alive.jpg'), type: 'jpeg', quality: 82 });
  const roam = await pop.evaluate(async () => {
    const p = [];
    for (let s = 0; s < 16; s++) { const w = window.LabPreview.alive()[0]; if (w) p.push([w.x, w.y]); await new Promise((r) => setTimeout(r, 300)); }
    let d = 0; for (let s = 1; s < p.length; s++) d += Math.hypot(p[s][0] - p[s - 1][0], p[s][1] - p[s - 1][1]);
    return { alive: window.LabPreview.alive().length, travelled: Math.round(d), samples: p.length };
  });
  await pop.screenshot({ path: path.join(dir, 'ether-5-roam.jpg'), type: 'jpeg', quality: 82 });
  await pop.close();
  return { walk, reveal, roam };
}

(async () => {
  const only = process.argv.slice(2);
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabExtract && !!window.ShapeLab && !!window.LabTranslate);
    const walks = {};
    for (const r of report.results) {
      if (!r.image || !r.image.ok || (only.length && only.indexOf(r.id) === -1)) continue;
      const dir = path.join(OUT, r.id);
      await page.setInputFiles('[data-imagine-file]', path.join(OUT, r.image.file));
      await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 20000 });
      walks[r.id] = {};
      for (const b of [12, 8]) {
        const x = r.extractions[b];
        if (!x || !x.ok) { walks[r.id]['b' + b] = { failed: x ? x.reason : 'missing' }; continue; }
        await page.evaluate(([e, budget]) => { window.ShapeLab.reset(); window.ShapeLab.setBudget(budget); window.LabExtract.load(e, 'extraction'); window.LabTranslate.setUnderlay(true); }, [x.extraction, b]);
        await page.waitForTimeout(300);
        await shot(page, '[data-canvas-complete]', path.join(dir, 'author-' + b + '.png'));
        await shot(page, '[data-canvas-unfinished]', path.join(dir, 'judge-' + b + '.png'));
        const st = await page.evaluate(() => ({ n: window.ShapeLab.state().points.length, j: window.ShapeLab.state().joins.length, missing: window.ShapeLab.state().missing, hint: window.ShapeLab.state().hint, playable: window.ShapeLab.playable(), metrics: window.ShapeLab.metrics() }));
        walks[r.id]['b' + b] = { n: st.n, j: st.j, missing: st.missing, hint: st.hint, playable: st.playable, components: st.metrics.components, crossings: st.metrics.crossings };
        if (b !== 8 || !st.playable) continue;
        // A/B: first WITHOUT reveal, then with every supported suggestion accepted
        const ab = await walkEther(ctx, page, dir, false);
        const added = await page.evaluate((e) => {
          const names = [];
          e.revealFeatures.forEach((rv, i) => {
            const st2 = window.ShapeLab.state();
            const a = rv.near[0]; let bb = null, best = Infinity;
            const pool = rv.near.length > 1 ? rv.near.slice(1) : st2.points.map((p, ix) => ix).filter((ix) => ix !== a);
            pool.forEach((ix) => { if (!st2.points[ix]) return; const d = Math.hypot(st2.points[ix][0] - st2.points[a][0], st2.points[ix][1] - st2.points[a][1]); if (d < best) { best = d; bb = ix; } });
            const r2 = window.ShapeLab.addReveal(rv.kind, a, bb, rv.name); if (r2.ok) names.push(rv.name + '/' + rv.kind);
          });
          return names;
        }, x.extraction);
        const w = await walkEther(ctx, page, dir, true);
        walks[r.id].b8.reveals = added; walks[r.id].b8.walk = w.walk; walks[r.id].b8.reveal = w.reveal; walks[r.id].b8.roam = w.roam; walks[r.id].b8.noReveal = ab.walk;
      }
      console.log('drew ' + r.id + ' · ' + JSON.stringify(walks[r.id]));
    }
    fs.writeFileSync(path.join(OUT, 'walks.json'), JSON.stringify({ run: new Date().toISOString(), walks }, null, 1));
  } finally { await browser.close(); server.kill(); }
})();
