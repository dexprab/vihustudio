/* SPRINT 1.2 — A STORY MET IN THE ETHER CAN BE SENT ONWARDS.
 *
 * A journey suite in the ether-encounter mould: seed a genuinely
 * SHARED Story (with readable page images), become a Traveller, load
 * VihuPlanet for real, cross the threshold, meet the Spirit — and then
 * do what this sprint adds: Share. Three doors — send it to someone,
 * print a little book, print a little card — through the SAME
 * creation-share client and the SAME composers the Studio hub and the
 * landing already use.
 *
 * What must ALSO be true: the send stores nothing on anybody's card
 * (once:true, no identityId), the printed QR is the story's own public
 * Ether deep link (never a token minted from a stranger's browser and
 * never a private id — ?story= is public by construction, Decision 9),
 * ☀️ Plain paper stands beside every print button, and the paper
 * carries the written address vihuplanet.com.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-share-test/run-ether-share-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_SHARE_PORT || 8798);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }

const JPEG_1PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn('node', [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // The print stub and the fillText spy ride every navigation.
  await page.addInitScript(() => {
    window.__prints = [];
    window.print = function () {
      const sheet = document.querySelector('.ether-print-sheet');
      window.__prints.push({
        images: sheet ? sheet.querySelectorAll('img').length : 0,
        landscape: !!Array.from(document.querySelectorAll('style'))
          .find((s) => /size:\s*landscape/.test(s.textContent || '')),
      });
    };
    window.__texts = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t) {
      window.__texts.push(String(t));
      return orig.apply(this, arguments);
    };
  });

  // The platform, stubbed: config points at a local host; the one call
  // that matters (creation-share) is captured; everything else answers
  // emptily and gracefully.
  const sent = [];
  await page.route('**/supabase-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'anon.key' }),
  }));
  await page.route('http://supa.local.test/**', (route) => {
    const url = route.request().url();
    if (url.indexOf('/functions/v1/creation-share') !== -1 && route.request().method() === 'POST') {
      sent.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, sent: true, token: 'tokX', parentKnown: false }) });
    }
    if (url.indexOf('/rest/v1/') !== -1) {
      return route.fulfill({ contentType: 'application/json', body: '[]' });
    }
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });

  // ---- seed a SHARED story with readable pages, then put the card away
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
    typeof CreatorProjectStore !== 'undefined', null, { timeout: 20000 });
  // The colour pages are RED and the ☀️ plain renders (stamped by the
  // share ceremony — readImagePlain, 1.2.1) are WHITE, so which set a
  // surface used is readable off a pixel rather than inferred.
  const seeded = await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    try { CreatorProjectStore.clearAll({ all: true }); } catch (e) {
      try { CreatorProjectStore.clearAll(); } catch (e2) {}
    }
    function px(color) {
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 8, 8);
      return c.toDataURL('image/png');
    }
    const RED = px('#c0272d'), WHITE = px('#ffffff');
    const c = MagicCard.claim('Vihaan', null,
      { companionId: 'leafy', companionName: 'Leafy', companionSpecies: 'Bloomling' });
    MagicCard.setActive(c.id);
    const id = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(id, { name: 'The Lantern Meadow' }, {
      version: 1,
      pages: [
        { id: 'p1', background: '#fff', objects: [], readImage: RED, readImagePlain: WHITE },
        { id: 'p2', background: '#fff', objects: [], readImage: RED, readImagePlain: WHITE },
        { id: 'p3', background: '#fff', objects: [], readImage: RED, readImagePlain: WHITE },
      ],
    });
    CreatorProjectStore.markPublished(id);
    MagicCard.setActive(null);
    return { id: id };
  });
  const landed = await page.waitForFunction((id) => {
    try { const r = CreatorProjectStore.get(id); return !!(r && r.publishedAt); } catch (e) { return false; }
  }, seeded.id, { timeout: 20000 }).then(() => true).catch(() => false);
  ck(landed, 'S0 the shared Story is seeded and its share landed');

  // ---- into the Ether, to the Spirit's own Preview
  await page.goto(BASE + '/index.html?story=' + encodeURIComponent(seeded.id));
  await page.waitForFunction(() => typeof EtherFeed !== 'undefined', null, { timeout: 20000 });
  for (let i = 0; i < 14; i++) {
    const crossed = await page.evaluate(() => {
      const b = document.querySelector('[data-begin]');
      if (b && b.getBoundingClientRect().width > 0) { b.click(); return false; }
      return true;
    });
    if (crossed) break;
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => !!document.querySelector('.vp-story'), null, { timeout: 25000 }).catch(() => {});
  let reached = true;
  await page.waitForFunction((want) => {
    const p = document.querySelector('[data-preview]');
    const t = (document.querySelector('[data-preview-title]') || {}).textContent || '';
    if (p && !p.hidden && t === want) return true;
    const all = Array.prototype.slice.call(document.querySelectorAll('.vp-story'));
    if (all.length) {
      window.__vpTap = ((window.__vpTap || 0) + 1) % all.length;
      all[window.__vpTap].click();
    }
    return false;
  }, 'The Lantern Meadow', { timeout: 45000, polling: 800 }).catch(() => { reached = false; });
  if (!reached) {
    fail('S0x the seeded Story\'s own Preview opened', 'every check below would be about a different Story');
  }

  // A live session for the send path — mutated in place (top-level
  // const bindings survive window swaps; Decision 51's own lesson).
  await page.evaluate(() => {
    if (typeof ThemeRepositoryClient !== 'undefined') {
      ThemeRepositoryClient.getSession = () => Promise.resolve({ access_token: 'tok.tok' });
    }
  });

  // ---- S1: the Share door stands on the Preview
  const shareBtn = await page.evaluate(() => {
    const b = document.querySelector('[data-act="share"]');
    return { there: !!b, hidden: b ? b.hidden : null, label: b ? b.textContent : null };
  });
  ck(shareBtn.there && shareBtn.hidden === false && shareBtn.label === 'Share',
    'S1 Share stands beside Read · Cheer · Back when the Ether holds pages', JSON.stringify(shareBtn));

  // ---- S2: three doors, in the product's own words
  await page.evaluate(() => document.querySelector('[data-act="share"]').click());
  await page.waitForFunction(() => {
    const o = document.querySelector('.ether-share');
    return o && !o.hidden;
  }, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, 'S2-share-panel.png') });
  const panel = await page.evaluate(() => ({
    doors: Array.from(document.querySelectorAll('.ether-share-door')).map((b) => b.textContent),
    text: document.querySelector('.ether-share-panel').innerText,
  }));
  ck(panel.doors.length === 3
    && /Send it to someone/.test(panel.doors[0])
    && /Print a little book/.test(panel.doors[1])
    && /Print a little card/.test(panel.doors[2]),
    'S2 three doors: send · little book · little card', JSON.stringify(panel.doors));
  ck(!/QR|scan\b|code|URL|token|email/i.test(panel.text),
    'S2b and no technical word on any of them', panel.text.replace(/\n/g, ' · '));

  // ---- S3: the send door — once, and nothing stored
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-door')).find((b) => /Send it/.test(b.textContent)).click();
  });
  const ask = await page.evaluate(() => document.querySelector('.ether-share-ask').textContent);
  ck(ask === 'Who should I send it to?', 'S3 the one established ask, word for word', ask);
  await page.evaluate(() => {
    document.querySelector('.ether-share-input').value = 'not-an-address';
    Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Send/.test(b.textContent)).click();
  });
  const gentle = await page.evaluate(() => document.querySelector('.ether-share-note').textContent);
  ck(/doesn’t look finished/.test(gentle) && sent.length === 0,
    'S3b an unfinished address is told gently, and nothing is sent', gentle);
  await page.evaluate(() => {
    document.querySelector('.ether-share-input').value = 'friend@example.com';
    Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Send/.test(b.textContent)).click();
  });
  // "It’s on its way!" is the SUCCESS view; the interim note says
  // "Sending it on its way…" and matching that is a race.
  await page.waitForFunction(() => /It’s on its way!/.test(document.querySelector('.ether-share-body').innerText), null, { timeout: 15000 });
  const body = sent[0] || {};
  ck(body.action === 'send' && body.once === true && !('identityId' in body),
    'S4 the letter goes once:true with NO identity — sharing onwards stores nothing on anybody\'s card',
    JSON.stringify({ action: body.action, once: body.once, identityId: body.identityId }));
  const pl = body.payload || {};
  ck(pl.ether === seeded.id && (pl.pages || []).length === 3
    && pl.pages.every((p) => /^data:image\//.test(p.image))
    && pl.madeIn === 'vihuplanet' && pl.title === 'The Lantern Meadow',
    'S4b the payload is the public story the Ether already shows — pages, name, its own Ether door',
    JSON.stringify({ ether: pl.ether, pages: (pl.pages || []).length, title: pl.title }));
  ck((pl.pagesPlain || []).length === 3 && pl.pagesPlain.every((p) => /^data:image\//.test(p.image)),
    'S4c and the ☀️ plain renders travel with it, so the letter\'s landing can kind-print too',
    JSON.stringify({ plain: (pl.pagesPlain || []).length }));

  // ---- S5/S6: the printed card, its address, and its door
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-quiet')).find((b) => /^Back$/.test(b.textContent)).click();
  });
  await page.evaluate(() => { window.__texts = []; });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-door')).find((b) => /little card/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => document.querySelectorAll('.ether-share-imgs img').length === 2
    && !Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).disabled,
    null, { timeout: 60000 }).catch(async () => {
      const state = await page.evaluate(() => document.querySelector('.ether-share-body').innerText);
      await page.screenshot({ path: path.join(SHOTS, 'S5-timeout.png') });
      fail('S5x the card preview composed', state.replace(/\n/g, ' · '));
    });
  await page.screenshot({ path: path.join(SHOTS, 'S5-card-preview.png') });
  const cardTexts = await page.evaluate(() => window.__texts);
  ck(cardTexts.indexOf('vihuplanet.com') !== -1,
    'S5 the card carries the written address — vihuplanet.com, for hands with no phone');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => window.__prints.length === 1, null, { timeout: 15000 });
  const cardPrint = await page.evaluate(() => window.__prints[0]);
  ck(cardPrint.images === 2 && cardPrint.landscape === false,
    'S5b the card prints front and back, upright', JSON.stringify(cardPrint));

  await page.addScriptTag({ url: BASE + '/tools/datamatrix-lab/vendor/zxing.min.js' });
  async function scanBack() {
    return page.evaluate(() => {
      const img = document.querySelectorAll('.ether-share-imgs img')[1];
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth; cv.height = img.naturalHeight;
      cv.getContext('2d').drawImage(img, 0, 0);
      try {
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        const reader = new ZXing.MultiFormatReader();
        reader.setHints(hints);
        const lum = new ZXing.HTMLCanvasElementLuminanceSource(cv);
        const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
        return { ok: true, text: reader.decode(bmp).getText() };
      } catch (e) { return { ok: false, err: String(e) }; }
    });
  }
  const scanned = await scanBack();
  ck(scanned.ok && scanned.text === 'https://vihuplanet.com/?story=' + seeded.id,
    'S6 the QR is the story\'s own public Ether deep link — never a token minted by a stranger\'s browser',
    scanned.text || scanned.err);

  // ---- S7: ☀️ plain paper on the card, and the door still scans
  const colorFront = await page.evaluate(() => document.querySelectorAll('.ether-share-imgs img')[0].src);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-quiet')).find((b) => /Plain paper/.test(b.textContent)).click();
  });
  await page.waitForFunction((prev) => {
    const imgs = document.querySelectorAll('.ether-share-imgs img');
    return imgs.length === 2 && imgs[0].src && imgs[0].src !== prev
      && !Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).disabled;
  }, colorFront, { timeout: 60000 });
  const plainState = await page.evaluate(async (prevFront) => {
    async function lum(src) {
      const img = new Image(); img.src = src;
      await (img.decode ? img.decode() : new Promise((res) => { img.onload = res; }));
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 64) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return sum / n / 255;
    }
    const imgs = document.querySelectorAll('.ether-share-imgs img');
    return {
      colorLum: await lum(prevFront),
      plainLum: await lum(imgs[0].src),
      label: !!Array.from(document.querySelectorAll('.ether-share-quiet')).find((b) => /colours back/.test(b.textContent)),
    };
  }, colorFront);
  ck(plainState.plainLum > plainState.colorLum + 0.1 && plainState.label,
    'S7 ☀️ Plain paper stands here too, and the plain card is measurably lighter',
    JSON.stringify({ color: plainState.colorLum.toFixed(3), plain: plainState.plainLum.toFixed(3) }));
  // The PAGES themselves went plain, not only the chrome (1.2.1):
  // the plain card's cover must be drawn from readImagePlain (white),
  // where the colour card's was the red readImage. Read off a pixel
  // in the cover box, not inferred from overall luminance.
  const coverPixels = await page.evaluate(async (prevFront) => {
    async function pick(src) {
      const img = new Image(); img.src = src;
      await (img.decode ? img.decode() : new Promise((res) => { img.onload = res; }));
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(375, 370, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    }
    return {
      color: await pick(prevFront),
      plain: await pick(document.querySelectorAll('.ether-share-imgs img')[0].src),
    };
  }, colorFront);
  ck(coverPixels.color.r > 150 && coverPixels.color.g < 90
    && coverPixels.plain.r > 230 && coverPixels.plain.g > 230 && coverPixels.plain.b > 230,
    'S7c the plain card\'s PAGES are the plain renders — white where the colour card was red',
    JSON.stringify(coverPixels));
  const scannedPlain = await scanBack();
  ck(scannedPlain.ok && scannedPlain.text === 'https://vihuplanet.com/?story=' + seeded.id,
    'S7b and the plain card\'s door still scans', scannedPlain.text || scannedPlain.err);

  // ---- S8: the little book
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-quiet')).find((b) => /^Back$/.test(b.textContent)).click();
  });
  await page.evaluate(() => { window.__texts = []; });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-door')).find((b) => /little book/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => document.querySelectorAll('.ether-share-imgs img').length === 2
    && !Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).disabled,
    null, { timeout: 120000 });
  await page.screenshot({ path: path.join(SHOTS, 'S8-foldable-preview.png') });
  const foldTexts = await page.evaluate(() => window.__texts);
  ck(foldTexts.indexOf('vihuplanet.com') !== -1,
    'S8 the foldable carries the written address too (its back panel)');
  // The paper choice PERSISTS across doors within one opening — S7
  // left it plain, so the toggle here reads "colours back". Either
  // face is the choice standing beside the print button.
  const foldToggle = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('.ether-share-quiet')).find((b) => /Plain paper|colours back/.test(b.textContent)));
  ck(foldToggle, 'S8b ☀️ the paper choice stands beside the book\'s print button too');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => window.__prints.length === 2, null, { timeout: 15000 });
  const foldPrint = await page.evaluate(() => window.__prints[1]);
  ck(foldPrint.images === 2 && foldPrint.landscape === true,
    'S8c the book prints its sheet and the how-to-fold page, the wide way', JSON.stringify(foldPrint));
  // 1.2.3 — the A4 fit, proved by a real print render through the
  // REAL EtherShare print path (on a light fixture page: the living
  // universe renders a pdf slower than the print sheet's 5s lifetime,
  // and a measure that races a timer proves nothing either way).
  const etherCssPage = await browser.newPage();
  await etherCssPage.goto(BASE + '/look.html');
  await etherCssPage.addStyleTag({ url: BASE + '/css/vihuplanet-home.css' });
  await etherCssPage.addScriptTag({ url: BASE + '/js/creationShare.js' });
  await etherCssPage.addScriptTag({ url: BASE + '/js/storyCardComposer.js' });
  await etherCssPage.addScriptTag({ url: BASE + '/js/foldableComposer.js' });
  await etherCssPage.addScriptTag({ url: BASE + '/js/etherShare.js' });
  await etherCssPage.evaluate(() => {
    window.print = function () {};
    function px(w, h, c) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, w, h); return cv.toDataURL('image/png'); }
    const IMG = px(320, 200, '#2d6bc0');
    EtherShare.open('proj_fit', { title: 'F', creator: 'V', pages: [IMG, IMG, IMG] });
    Array.from(document.querySelectorAll('.ether-share-door')).find((b) => /little book/.test(b.textContent)).click();
  });
  await etherCssPage.waitForFunction(() =>
    !Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).disabled,
    null, { timeout: 60000 });
  await etherCssPage.evaluate(() => {
    Array.from(document.querySelectorAll('.ether-share-go')).find((b) => /Print/.test(b.textContent)).click();
  });
  await etherCssPage.waitForFunction(() =>
    document.querySelectorAll('.ether-print-sheet img').length === 2, null, { timeout: 30000 });
  const etherPdf = await etherCssPage.pdf({ format: 'A4', landscape: true, printBackground: true,
    margin: { top: '0.25in', bottom: '0.25in', left: '0.25in', right: '0.25in' } });
  const etherPages = (etherPdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ck(etherPages === 2, 'S8d on A4, the Ether\'s foldable is two pages — nothing spills', etherPages + ' pages');
  await etherCssPage.close();

  // ---- S9: leaving costs nothing — the universe was never touched
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => ({
    panelHidden: document.querySelector('.ether-share').hidden,
    previewOpen: !document.querySelector('[data-preview]').hidden,
    universe: !!document.querySelector('.vp-home'),
  }));
  ck(closed.panelHidden && closed.previewOpen && closed.universe,
    'S9 Escape closes the panel; the Preview and the universe are exactly where they were', JSON.stringify(closed));

  ck(pageErrors.length === 0, 'S10 zero page errors across the journey', pageErrors.join(' | '));

  await browser.close();
  server.kill();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
