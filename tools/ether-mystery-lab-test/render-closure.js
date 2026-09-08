#!/usr/bin/env node
/* tools/ether-mystery-lab-test/render-closure.js — draws every result of
 * real-closure.json in the REAL Shape Lab and walks the REAL Ether
 * preview, one folder per creature under shots/closure/<id>/:
 *
 *   base.png        JUDGE — composed with the base vocabulary, auto budget
 *   extended.png    JUDGE — composed with the extensions, auto budget
 *   unfinished.png  the unfinished creature at 8 (what the Ether performs)
 *   ether-1-unfinished.jpg · ether-2-complete.jpg · ether-3-reveal.jpg ·
 *   ether-4-alive.jpg · ether-5-roam.jpg — the loop in the real sky,
 *   through js/etherMystery.js unmodified, with the accepted reveal
 *   features drawn by the Lab over it
 *   noreveal-complete.jpg  the completed structure WITHOUT reveal (A/B)
 *
 * It drives the real page the way the Lab does: the picture through the
 * front door's own file input, the figure through ShapeLab.loadGenerated
 * (the translate button's own seam), the gaps and the hint through
 * ShapeLab's own toggleGap/setHint, the reveals through addReveal, and
 * the preview through the ▶ Play in Ether button. Nothing is
 * re-composed here and nothing is judged; a person rates the pictures.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/ether-mystery-lab-test/render-closure.js [ids…]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'closure');
const PORT = Number(process.env.ETHER_LAB_PORT || 8918);
const report = JSON.parse(fs.readFileSync(path.join(OUT, 'real-closure.json'), 'utf8'));

async function loadFigure(page, fig, subject) {
  await page.evaluate(([f, s]) => {
    window.ShapeLab.reset();
    window.ShapeLab.loadGenerated({ budget: f.budget, points: f.points, roles: f.roles, joins: f.joins, source: 'translation', subject: s });
    window.LabTranslate.setUnderlay(false);
  }, [fig, subject]);
  await page.waitForTimeout(250);
}
async function shotJudge(page, file) {
  const c = await page.$('[data-canvas-unfinished]');
  await c.screenshot({ path: file });
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
    await page.waitForFunction(() => !!window.LabClosure && !!window.ShapeLab && !!window.LabTranslate);
    const walks = {};
    for (const r of report.results) {
      if (!r.ok || (only.length && only.indexOf(r.id) === -1)) continue;
      const dir = path.join(OUT, r.id); fs.mkdirSync(dir, { recursive: true });
      if (r.file) {
        await page.setInputFiles('[data-imagine-file]', path.resolve(LAB, r.file));
        await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 20000 });
      }
      const c = r.compositions;
      await loadFigure(page, c.base, r.id); await shotJudge(page, path.join(dir, 'base.png'));
      await loadFigure(page, c.extended, r.id); await shotJudge(page, path.join(dir, 'extended.png'));
      // the unfinished creature at 8, with its gaps and hint, and the
      // accepted reveals — every SUPPORTED suggestion is accepted here so
      // the A/B can be seen; the researcher would choose
      const f8 = c.extended8.ok ? c.extended8 : c.base8;
      await loadFigure(page, f8, r.id);
      const placed = await page.evaluate(([fig, u, hint, reveals]) => {
        const st = window.ShapeLab.state();
        let placed = 0;
        (u.missing || []).forEach((gi) => {
          const cj = fig.joins[gi];
          st.joins.forEach((j, i) => { const ab = String(j).split('-').map(Number); if ((ab[0] === cj.a && ab[1] === cj.b) || (ab[0] === cj.b && ab[1] === cj.a)) { const t = window.ShapeLab.toggleGap(i); if (t.ok && t.gap) placed++; } });
        });
        window.ShapeLab.setHint(hint || 'Something is waiting…');
        const added = [];
        reveals.forEach((rv) => {
          const idx = []; fig.masses.forEach((m, i) => { if (m === rv.near) idx.push(i); });
          if (!idx.length || !rv.kind) return;
          // the same frame the page's Accept chooses: B is the nearest light of the mass
          let b = null, best = Infinity; idx.slice(1).forEach((i) => { const d = Math.hypot(fig.points[i][0] - fig.points[idx[0]][0], fig.points[i][1] - fig.points[idx[0]][1]); if (d < best) { best = d; b = i; } });
          const a = window.ShapeLab.addReveal(rv.kind, idx[0], b, rv.name);
          if (a.ok) added.push(rv.name);
        });
        return { placed, added, playable: window.ShapeLab.playable() };
      }, [f8, f8.unfinished, r.hint, r.decision.revealCandidates.filter((x) => x.support === 'SUPPORTED_REVEAL')]);
      await page.waitForTimeout(200);
      await shotJudge(page, path.join(dir, 'unfinished.png'));
      walks[r.id] = { placed: placed.placed, reveals: placed.added, playable: placed.playable };
      if (!placed.playable) { console.log(r.id + ' · not playable at 8 (' + JSON.stringify(placed) + ')'); continue; }
      // the loop in the real Ether
      const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-play]')]);
      await pop.setViewportSize({ width: 1440, height: 900 });
      await pop.waitForFunction(() => !!window.LabPreview && !!window.LabPreview.mystery && window.LabPreview.mystery(), null, { timeout: 20000 });
      await pop.waitForTimeout(1800);
      await pop.screenshot({ path: path.join(dir, 'ether-1-unfinished.jpg'), type: 'jpeg', quality: 82 });
      const walk = await pop.evaluate(async () => {
        const my = window.LabPreview.mystery(); let i = my.instrument();
        const out = { hint: document.querySelector('[data-hint]').textContent, hintOn: document.querySelector('[data-hint]').classList.contains('on'), missing: i.arrangement.missingLeft, steps: [] };
        let g = 30;
        while (g-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
          const gap = i.arrangement.links.filter((L) => !L.present)[0];
          my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y); my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
          i = my.instrument(); out.steps.push(i ? i.arrangement.missingLeft : 'gone');
        }
        return out;
      });
      await pop.waitForTimeout(600);
      await pop.screenshot({ path: path.join(dir, 'ether-2-complete.jpg'), type: 'jpeg', quality: 82 });
      await pop.waitForTimeout(1700);
      await pop.screenshot({ path: path.join(dir, 'ether-3-reveal.jpg'), type: 'jpeg', quality: 82 });
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
      walks[r.id].walk = walk; walks[r.id].roam = roam;
      // A/B: the completed structure with NO reveal, in the same sky
      await page.evaluate(() => { window.ShapeLab.resetReveal(); });
      const [pop2] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-play]')]);
      await pop2.setViewportSize({ width: 1440, height: 900 });
      await pop2.waitForFunction(() => !!window.LabPreview && !!window.LabPreview.mystery && window.LabPreview.mystery(), null, { timeout: 20000 });
      await pop2.waitForTimeout(1800);
      await pop2.evaluate(async () => {
        const my = window.LabPreview.mystery(); let i = my.instrument(); let g = 30;
        while (g-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) { const gap = i.arrangement.links.filter((L) => !L.present)[0]; my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y); my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y); i = my.instrument(); }
      });
      await pop2.waitForTimeout(2300);
      await pop2.screenshot({ path: path.join(dir, 'noreveal-complete.jpg'), type: 'jpeg', quality: 82 });
      await pop2.close();
      console.log('drew ' + r.id + ' · ' + JSON.stringify(walks[r.id]));
    }
    fs.writeFileSync(path.join(OUT, 'walks.json'), JSON.stringify({ run: new Date().toISOString(), walks }, null, 1));
  } finally { await browser.close(); server.kill(); }
})();
