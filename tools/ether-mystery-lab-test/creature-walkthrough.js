/* tools/ether-mystery-lab-test/creature-walkthrough.js — the seven
 * prompts of the "AI does the authoring" brief, walked through the REAL
 * Shape Lab page against the REAL models, the way a researcher does it:
 * type, CREATE, choose a picture, wait, review UNFINISHED · COMPLETE ·
 * COME ALIVE, screenshot every beat, write the report.
 *
 * WHAT IT NEEDS. A route to the provider: either a key in
 * CREATURE_LAB_KEY (typed into the Lab's Direct mode exactly as a
 * developer would), or a network that holds the credential itself —
 * the build environment this was first run in injected the provider
 * credential at its egress proxy, so ANY bearer token reached the model;
 * the harness types a placeholder there and SAYS SO in the report
 * (`credential: 'network-held'`). Set HTTPS_PROXY to route the browser
 * through a proxy; the browser is launched with it and with TLS errors
 * ignored ONLY when a proxy is named, because a MITM proxy's certificate
 * is what the container trusts and Chromium does not.
 *
 * WHAT IT WRITES. shots/creature-lab/<slug>-choices.png,
 * -unfinished.png, -complete.png, -alive.png, and
 * creature-walkthrough.json — the summary per prompt (points, missing
 * connections by light name, reveal features, hint, confidence, timing,
 * repairs, the session epoch) with NO image bytes and NO key.
 *
 * WHAT IT NEVER DOES. It does not pass off a fixture as a model result:
 * a run in fixture mode is refused. It does not write the production
 * pool. It does not decide which image is best — it takes the first
 * candidate every time, so the choice is reproducible and plainly not
 * a researcher's taste; the other candidates are saved beside it.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node \
 *     tools/ether-mystery-lab-test/creature-walkthrough.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_LAB_PORT || 8941);
const BASE = 'http://127.0.0.1:' + PORT;
const OUT = path.join(__dirname, 'shots', 'creature-lab');
fs.mkdirSync(OUT, { recursive: true });
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const KEY = process.env.CREATURE_LAB_KEY || '';
const PROMPTS = [
  'A panda made of stars in a night sky',
  'A mermaid made of stars in a night sky',
  'A baby dragon made of stars in a night sky',
  'A falcon made of stars in a night sky',
  'A lion with wings made of stars in a night sky',
  'A giant whale made of stars in a night sky',
  'An imaginary fox-like creature made of stars'
];
const ONLY = process.env.CREATURE_ONLY ? PROMPTS.filter((p, i) => String(i + 1) === process.env.CREATURE_ONLY) : PROMPTS;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// THE PROXY DROPS A REUSED SOCKET. Measured in the build environment: a
// POST that reused a connection left idle by the image batch failed as
// ERR_TOO_MANY_RETRIES about half the time, and a POST body cannot be
// re-sent on a retry. A GET to the same host just before the press opens
// a fresh connection for it. Harness only — the Lab makes no such call.
let freshen = async () => {};

(async () => {
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await wait(800);
  const launch = { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' };
  // The Lab's own server is local and must NOT go through the proxy.
  // Playwright's own `proxy` option forces loopback through it as well
  // (measured: the proxy answered 405 for the Lab page), so the proxy is
  // handed to Chromium as raw arguments with a loopback bypass.
  // HTTP/2 and QUIC are switched off through the proxy: measured, a
  // reused connection through it failed with ERR_TOO_MANY_RETRIES about
  // one request in six with them on, and never with them off.
  if (PROXY) launch.args = ['--proxy-server=' + PROXY, '--proxy-bypass-list=127.0.0.1;localhost', '--disable-http2', '--disable-quic'];
  const browser = await chromium.launch(launch);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, ignoreHTTPSErrors: !!PROXY });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url().replace(/^data:.*$/, '(data url)').slice(0, 120)); });
  page.on('requestfailed', (r) => errors.push('failed ' + (r.failure() && r.failure().errorText) + ' ' + r.url().slice(0, 80)));
  const report = { ranAt: new Date().toISOString(), credential: KEY ? 'typed-key' : 'network-held', proxy: !!PROXY, creatures: [], errors };
  await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
  // Direct mode, the way a developer does it: the mode button, then the
  // key field under Advanced. A placeholder is typed when the network
  // holds the credential, and the report says which.
  // The connection is set through the same module the Advanced panel
  // writes to, and PROBED before anything is asked — CONNECTED is only
  // ever claimed after a probe actually answered (labConnection.js).
  // A researcher who sees UNAVAILABLE presses Test connection again; the
  // Lab itself never retries (its own rule), so the pressing is done here,
  // at most three times, and counted in the report.
  let conn = null, probes = 0;
  while (probes < 3) {
    probes++;
    conn = await page.evaluate(async (key) => {
      window.LabConnection.setMode('direct');
      window.LabConnection.setDirectKey(key);
      window.LabConnection.setDirectModel('gpt-4.1');
      await window.LabConnection.probe();
      return window.LabConnection.status();
    }, KEY || 'sk-placeholder-network-holds-the-credential');
    if (/CONNECTED/.test(conn.line)) break;
    await wait(1500);
  }
  report.probes = probes;
  report.connection = conn;
  if (conn.mode === 'fixture' || !/CONNECTED/.test(conn.line)) {
    console.log('NOT CONNECTED — ' + conn.line + '. Refusing to walk the prompts in fixture mode.');
    await browser.close(); server.kill(); process.exit(2);
  }
  console.log('connected: ' + conn.line);
  freshen = async () => { try { await page.evaluate(() => fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + 'x' } }).then((r) => r.status).catch(() => 0)); } catch (e) { /* held */ } };

  for (const prompt of ONLY) {
    const s = slug(prompt);
    const rec = { prompt, slug: s };
    const t0 = Date.now();
    console.log('\n== ' + prompt);
    await page.fill('[data-cr-prompt]', prompt);
    await page.click('[data-cr-create]');
    try {
      await page.waitForFunction(() => ['choose', 'failed'].indexOf(document.body.getAttribute('data-cr-phase')) !== -1, null, { timeout: 200000 });
    } catch (e) { rec.outcome = 'images-timeout'; report.creatures.push(rec); console.log('  images: timeout'); continue; }
    let sess = await page.evaluate(() => window.LabCreature.session());
    rec.epoch = sess.epoch;
    rec.images = { count: sess.images.length, ms: Date.now() - t0, note: sess.note, last: sess.last.images };
    if (sess.status !== 'choose') {
      // a researcher presses CREATE again once; counted
      console.log('  images failed once: ' + sess.note + ' — pressing again');
      rec.imagesRetried = true;
      await page.click('[data-cr-create]');
      try { await page.waitForFunction(() => ['choose', 'failed'].indexOf(document.body.getAttribute('data-cr-phase')) !== -1, null, { timeout: 200000 }); } catch (e) { /* read below */ }
      sess = await page.evaluate(() => window.LabCreature.session());
      rec.epoch = sess.epoch;
      rec.images = { count: sess.images.length, ms: Date.now() - t0, note: sess.note, last: sess.last.images, retried: true };
      if (sess.status !== 'choose') { rec.outcome = 'images-failed'; report.creatures.push(rec); console.log('  images failed: ' + sess.note); continue; }
    }
    console.log('  images: ' + sess.images.length + ' in ' + rec.images.ms + 'ms');
    await page.evaluate(() => { document.querySelector('[data-cr-section="choose"]').scrollIntoView(); });
    await wait(300);
    await page.screenshot({ path: path.join(OUT, s + '-choices.png'), clip: await page.evaluate(() => { const r = document.querySelector('[data-cr-section="choose"]').getBoundingClientRect(); return { x: r.left, y: r.top + window.scrollY, width: r.width, height: r.height }; }), fullPage: true });
    // every candidate is saved beside the choice
    for (let i = 0; i < sess.images.length; i++) {
      const url = await page.evaluate((k) => window.LabCreature.imageOf(k), i);
      const m = /^data:image\/(\w+);base64,(.+)$/.exec(url || '');
      if (m) fs.writeFileSync(path.join(OUT, s + '-image-' + String.fromCharCode(97 + i) + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1])), Buffer.from(m[2], 'base64'));
    }
    const t1 = Date.now();
    await freshen();
    await page.click('[data-cr-use="0"]');
    rec.chosen = 0;
    try {
      await page.waitForFunction(() => ['ready', 'failed'].indexOf(document.body.getAttribute('data-cr-phase')) !== -1, null, { timeout: 150000 });
    } catch (e) { rec.outcome = 'build-timeout'; report.creatures.push(rec); console.log('  build: timeout'); continue; }
    sess = await page.evaluate(() => window.LabCreature.session());
    rec.build = { ms: Date.now() - t1, note: sess.note, last: sess.last.extraction, retries: 0 };
    if (sess.status !== 'ready') { const raw0 = await page.evaluate(() => window.LabCreature.raw()); rec.build.refusedRaw = [raw0 ? raw0.slice(0, 600) : null]; }
    // a researcher whose build failed presses TRY ANOTHER ETHER
    // INTERPRETATION; at most twice, counted, never silent
    while (sess.status !== 'ready' && rec.build.retries < 3) {
      rec.build.retries++;
      console.log('  build failed: ' + sess.note + ' — reading the picture again');
      await freshen();
      await page.click('[data-cr-retry]');
      try { await page.waitForFunction(() => ['ready', 'failed'].indexOf(document.body.getAttribute('data-cr-phase')) !== -1, null, { timeout: 150000 }); } catch (e) { /* read below */ }
      sess = await page.evaluate(() => window.LabCreature.session());
      rec.build.note = sess.note; rec.build.last = sess.last.extraction; rec.build.ms = Date.now() - t1;
      // the head of a refused reply is kept, so a refusal can be read
      if (sess.status !== 'ready') { const raw = await page.evaluate(() => window.LabCreature.raw()); (rec.build.refusedRaw = rec.build.refusedRaw || []).push(raw ? raw.slice(0, 600) : null); }
    }
    if (sess.status !== 'ready') { rec.outcome = 'build-failed'; report.creatures.push(rec); console.log('  build failed: ' + sess.note); continue; }
    const a = await page.evaluate(() => {
      const au = window.LabCreature.authored(), st = window.ShapeLab.state(), ex = window.LabCreature.extraction();
      return {
        creature: au.creature, seen: au.seen, confidence: au.confidence, budget: au.budget,
        points: au.points.length, joins: au.joins.length,
        missing: au.missing.map((i) => { const ab = au.joins[i].split('-').map(Number); return au.roles[ab[0]] + ' — ' + au.roles[ab[1]]; }),
        missingSource: au.missingSource,
        reveals: (au.revealRoles || []).map((r, i) => ({ name: r.name, role: r.role, kind: au.reveal.features[i] && au.reveal.features[i].type, at: au.roles[au.reveal.features[i].lights.a], toward: au.reveal.features[i].lights.b === null ? null : au.roles[au.reveal.features[i].lights.b], why: r.why })),
        hint: st.hint, hold: au.reveal.durationS, alive: au.alive, playableInEther: au.playableInEther,
        strip: document.querySelector('[data-status-name]').textContent + ' · ' + document.querySelector('[data-status-line]').textContent,
        summary: document.querySelector('[data-cr-summary]').textContent,
        extractionPoints: ex.points.length
      };
    });
    Object.assign(rec, a);
    rec.outcome = 'built';
    console.log('  built: ' + a.creature + ' · ' + a.points + ' points · missing ' + JSON.stringify(a.missing) + ' · reveals ' + a.reveals.map((r) => r.name).join(', ') + ' · confidence ' + a.confidence + ' · ' + rec.build.ms + 'ms');
    console.log('  hint: ' + a.hint);
    const shoot = async (name) => {
      await page.evaluate(() => { document.querySelector('[data-cr-section="result"]').scrollIntoView(); });
      await wait(200);
      const clip = await page.evaluate(() => { const r = document.querySelector('[data-cr-section="result"]').getBoundingClientRect(); return { x: r.left, y: r.top + window.scrollY, width: r.width, height: r.height }; });
      await page.screenshot({ path: path.join(OUT, s + '-' + name + '.png'), clip, fullPage: true });
    };
    await page.click('[data-cr-state="unfinished"]'); await shoot('unfinished');
    await page.click('[data-cr-state="complete"]'); await shoot('complete');
    await page.click('[data-cr-state="alive"]');
    await wait(4600);
    rec.aliveAt4600 = await page.evaluate(() => window.LabCreature.stageStatus());
    await shoot('alive');
    await wait(3000);
    rec.aliveAt7600 = await page.evaluate(() => window.LabCreature.stageStatus());
    rec.comeAliveWorks = !!(rec.aliveAt7600.playing && rec.aliveAt7600.frame > rec.aliveAt4600.frame && rec.aliveAt7600.travelled > 0 && rec.aliveAt4600.painted > 0);
    console.log('  come alive: ' + (rec.comeAliveWorks ? 'yes' : 'NO') + ' · phase ' + rec.aliveAt7600.phase + ' · travelled ' + rec.aliveAt7600.travelled + ' · reveals painted ' + rec.aliveAt4600.painted);
    // nothing of the previous creature survives: the editor holds exactly this one
    rec.leak = await page.evaluate((prev) => {
      const st = window.ShapeLab.state(), ex = window.LabCreature.extraction();
      const names = st.roles.concat(st.reveal.features.map((f) => f.name)).join(' ');
      return { editorName: st.name, sessionCreature: ex.creature, previousNamesPresent: prev.filter((n) => n && names.indexOf(n) !== -1) };
    }, report.creatures.map((c) => c.creature).filter(Boolean));
    report.creatures.push(rec);
    fs.writeFileSync(path.join(OUT, 'creature-walkthrough.json'), JSON.stringify(report, null, 2));
  }
  fs.writeFileSync(path.join(OUT, 'creature-walkthrough.json'), JSON.stringify(report, null, 2));
  console.log('\nbuilt ' + report.creatures.filter((c) => c.outcome === 'built').length + '/' + report.creatures.length + ' · errors ' + errors.length);
  await browser.close(); server.kill();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
