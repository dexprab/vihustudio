#!/usr/bin/env node
/* tools/ether-mystery-lab-test/render-translation.js — draws every
 * composed figure of real-translation.json in the REAL Shape Lab and
 * screenshots SOURCE · AUTHOR (over the source) · JUDGE (alone), one
 * picture per creature, into shots/translate/<id>.png — the thing a
 * person rates.
 *
 * It drives the real page the way the Lab does: the source picture is
 * brought in through the front door's own file input (so the SOURCE
 * pane and the underlay are the product's, not a mock), then the
 * composed figure is loaded through ShapeLab.loadGenerated — the same
 * seam the translate button uses. Nothing is re-composed here.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/ether-mystery-lab-test/render-translation.js [ids…]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'translate');
const PORT = Number(process.env.ETHER_LAB_PORT || 8917);
const report = JSON.parse(fs.readFileSync(path.join(OUT, 'real-translation.json'), 'utf8'));

(async () => {
  const only = process.argv.slice(2);
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto('http://127.0.0.1:' + PORT + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabTranslate && !!window.LabImagine && !!window.ShapeLab);
    for (const r of report.results) {
      if (!r.ok || (only.length && only.indexOf(r.id) === -1)) continue;
      await page.setInputFiles('[data-imagine-file]', path.resolve(LAB, r.file));
      await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 20000 });
      await page.evaluate((fig) => {
        window.ShapeLab.reset();
        window.ShapeLab.loadGenerated({ budget: fig.budget, points: fig.points, roles: fig.roles, joins: fig.joins, source: 'translation', subject: fig.subject });
        window.LabTranslate.setUnderlay(true);
      }, Object.assign({}, r.figure, { subject: r.plan.masses.length ? r.id : r.id }));
      await page.waitForTimeout(400);
      const stage = await page.$('[data-stage]');
      await stage.screenshot({ path: path.join(OUT, r.id + '.png') });
      console.log('drew ' + r.id + ' · ' + r.figure.points.length + ' lights');
    }
  } finally { await browser.close(); server.kill(); }
})();
