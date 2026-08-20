/* HW CAMERA FEED FIXTURES — the y4m files Chromium serves as the fake
 * camera (--use-file-for-fake-video-capture) so the FREE-MOTION card
 * collection can be verified end to end against the real live loop.
 *
 * All frames are cut from THE SAME deterministic synthetic filled pages
 * the handwriting suite asserts against (test/hw-fixture.js, seed 7,
 * width 2000, rendered by the page's own HWSheet.draw — so the fixtures
 * and the suite cannot drift). A landscape 1280×960 sensor, matching
 * test/make-camera-feed.js's precedent:
 *
 *   hw-card-<1..5>.y4m   ONE CUT CARD filling the wide frame with desk
 *                        margin on every side — the close-up a child
 *                        holding a snipped-out card actually produces,
 *                        cut along the card's own cut lines (the new
 *                        print gives every card its own pair, with a
 *                        gutter between neighbours). Cards 1–3 come
 *                        from page 1, cards 4–5 from page 2.
 *   hw-card-attached.y4m card 2 STILL ATTACHED: the uncut page held
 *                        close on that card — gutters, neighbour cut
 *                        lines and border slivers in frame — must read
 *                        exactly like the cut card.
 *   hw-many.y4m          the WHOLE page 1 in frame: three cards at
 *                        once. The product rule is strictly one card
 *                        at a time, so this must raise the gentle
 *                        one-card overlay and collect NOTHING.
 *   hw-many-then-one.y4m page 1 whole (four frames), then cut card 1
 *                        (four frames), 2s a frame: the overlay must
 *                        show, then clear by itself when the view
 *                        returns to one card, and the card collects.
 *   hw-legacy.y4m        the FROZEN one-page five-card sheet, filled,
 *                        fitted by height — the legacy ladder registers
 *                        and all five lines land at once, exactly as
 *                        old printouts always did.
 *   hw-card-blank.y4m    card 3, cut, from a page the child never
 *                        wrote on — anchors and model print, no ink:
 *                        must collect NOTHING.
 *   hw-sweep.y4m         cut cards 1→2→3, four frames each at F2:1 —
 *                        showing the cards one after another in one
 *                        file, driving multi-card accumulation in a
 *                        single launch.
 *   hw-noisy.y4m         a NOISY ROOM SCENE, no page anywhere — the
 *                        scene shape of the field freeze. The
 *                        responsiveness checks sweep it and assert the
 *                        page never blocks and nothing is collected.
 *   hw-card-far.y4m      cut card 1 held FAR AWAY: drawn 420px wide in
 *                        the 1280 frame — measured, the reader refuses
 *                        a clean one-card desk frame up to 560px drawn
 *                        width and reads from 620px, so 420 refuses
 *                        with a 140px margin. The readiness light must
 *                        stay RED on it: too far to read is not ready.
 *   hw-then-gone.y4m     cut card 1 (eight frames), then the bare desk
 *                        (eight frames), at 2fps — the view reads,
 *                        then stops reading. Drives the light's
 *                        green→red hand-off so its latency can be
 *                        measured against the real loop.
 *
 * hw-feeds.json carries each fixture's sheet→frame mapping, the pages'
 * ground truth (GLOBAL line indices), and a VERSION stamp: the fixtures
 * are regenerated whenever this generator (or the page geometry it
 * renders through) changes shape — allPresent() refuses a stale set.
 *
 * Generated on demand, gitignored, never committed. Standalone (server
 * already running):
 *   BIA_PORT=9171 NODE_PATH=/opt/node22/lib/node_modules node test/make-hw-feeds.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { COMPOSE } = require(path.join(__dirname, 'hw-fixture.js'));

const W = 1280, H = 960;
// Bumped whenever the frames' shape changes: 3 = the two-page card
// printable (per-card cut lines, grip margins, strictly-one-card rule);
// 4 = the readiness-light fixtures (hw-card-far, hw-then-gone).
const VERSION = 4;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const META = path.join(__dirname, 'hw-feeds.json');

const FILE = {
  card: (i) => path.join(__dirname, 'hw-card-' + (i + 1) + '.y4m'),
  attached: path.join(__dirname, 'hw-card-attached.y4m'),
  many: path.join(__dirname, 'hw-many.y4m'),
  manyThenOne: path.join(__dirname, 'hw-many-then-one.y4m'),
  legacy: path.join(__dirname, 'hw-legacy.y4m'),
  blank: path.join(__dirname, 'hw-card-blank.y4m'),
  sweep: path.join(__dirname, 'hw-sweep.y4m'),
  noisy: path.join(__dirname, 'hw-noisy.y4m'),
  far: path.join(__dirname, 'hw-card-far.y4m'),
  thenGone: path.join(__dirname, 'hw-then-gone.y4m')
};

function allPresent() {
  const files = [FILE.attached, FILE.many, FILE.manyThenOne, FILE.legacy,
                 FILE.blank, FILE.sweep, FILE.noisy, FILE.far,
                 FILE.thenGone, META];
  for (let i = 0; i < 5; i++) files.push(FILE.card(i));
  if (!files.every((f) => fs.existsSync(f))) return false;
  try { return JSON.parse(fs.readFileSync(META, 'utf8')).version === VERSION; }
  catch (e) { return false; }
}

// RGB → YUV, BT.601 limited range, 4:2:0 — the same arithmetic as
// test/make-camera-feed.js, generalised to many frames and a chosen
// frame rate (the sweep files play slowly on purpose).
function y4mOf(frames, fps) {
  const yPlane = () => Buffer.alloc(W * H);
  const cPlane = () => Buffer.alloc((W / 2) * (H / 2));
  const parts = [Buffer.from('YUV4MPEG2 W' + W + ' H' + H + ' F' + fps + ':1 Ip A1:1 C420\n', 'ascii')];
  const mark = Buffer.from('FRAME\n', 'ascii');
  for (const rgba of frames) {
    const Y = yPlane(), U = cPlane(), V = cPlane();
    const uf = new Float64Array(U.length), vf = new Float64Array(V.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
        Y[y * W + x] = Math.max(16, Math.min(235,
          Math.round(16 + (65.738 * r + 129.057 * g + 25.064 * b) / 256)));
        const ci = (y >> 1) * (W / 2) + (x >> 1);
        uf[ci] += (-37.945 * r - 74.494 * g + 112.439 * b) / 256;
        vf[ci] += (112.439 * r - 94.154 * g - 18.285 * b) / 256;
      }
    }
    for (let i = 0; i < U.length; i++) {
      U[i] = Math.max(16, Math.min(240, Math.round(128 + uf[i] / 4)));
      V[i] = Math.max(16, Math.min(240, Math.round(128 + vf[i] / 4)));
    }
    parts.push(mark, Y, U, V);
  }
  return Buffer.concat(parts);
}

/* Page-side: compose the right page (or the blank/legacy variant) and
 * render ONE frame — a CUT card on the desk (args.card + cut:true, cut
 * along the card's own cut lines), the uncut page held close on one
 * card (args.card, cut:false — gutters and neighbour slivers in
 * frame), or a whole page fitted by height ({} → page 1 of the card
 * print; {legacy:true} → the frozen one-page sheet) — returning raw
 * RGBA (base64) plus the sheet→frame mapping. A cut card keeps the
 * page's full width (the cuts are horizontal), drawn at 94% of the
 * frame width so the desk shows around all four paper edges. */
const FRAME = `async (args) => {
  const opts = { seed: 7, width: 2000 };
  if (args.blank) opts.blankLines = [0, 1, 2, 3, 4];
  if (args.legacy) opts.legacy = true;
  else opts.page = args.card != null ? HWSheet.pageOf(args.card).page : 0;
  const made = (${COMPOSE})(opts);
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.src = made.dataURL; });
  const SW = img.width, SH = img.height;
  const fw = ${W}, fh = ${H};
  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#5f6673';              // the desk behind the paper
  x.fillRect(0, 0, fw, fh);
  x.imageSmoothingQuality = 'high';
  let map;
  if (args.card != null && args.cut) {
    // A cut card: its own cut boundary's rows, full page width, with
    // desk margin on every side of the wide frame. args.cardW draws it
    // smaller — a card held too far away to read.
    const card = made.cards.find((k) => k.index === args.card);
    const cardTop = card.cutTop, cardH = card.cutBottom - card.cutTop;
    const dw = args.cardW ? Math.round(args.cardW) : Math.round(0.94 * fw);
    const scale = dw / SW;
    const dh = cardH * scale;
    const ox = (fw - dw) / 2, oy = (fh - dh) / 2;
    x.drawImage(img, 0, cardTop, SW, cardH, ox, oy, dw, dh);
    map = { scale, ox, oy, bandTop: cardTop };
  } else if (args.card != null) {
    // The same card STILL ATTACHED: the uncut page held close — the
    // band spills through the gutters into the neighbours, so their
    // cut lines and border slivers are in frame, as they really would
    // be.
    const card = made.cards.find((k) => k.index === args.card);
    const bandTop = card.cutTop - 0.025 * SH;
    const bandH = (card.cutBottom - card.cutTop) + 0.05 * SH;
    const scale = fw / SW;
    const dh = bandH * scale;
    const oy = (fh - dh) / 2;
    x.drawImage(img, 0, bandTop, SW, bandH, 0, oy, fw, dh);
    map = { scale, ox: 0, oy, bandTop };
  } else {
    const scale = fh / SH;
    const dw = SW * scale;
    const ox = (fw - dw) / 2;
    x.drawImage(img, 0, 0, SW, SH, ox, 0, dw, fh);
    map = { scale, ox, oy: 0, bandTop: 0 };
  }
  const d = x.getImageData(0, 0, fw, fh).data;
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < d.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
  }
  return { b64: btoa(s), map, gt: made.gt, ruleYs: made.ruleYs, W: made.W, H: made.H };
}`;

/* Page-side: the noisy room scene — SEEDED (mulberry32-style, no
 * Math.random — the suite's hygiene check applies to fixtures), no
 * page anywhere. Its shape is what made the field frame expensive:
 * hundreds of dark compact candidate marks, long dark edges, gradients. */
const NOISY_FRAME = `() => {
  const W = ${W}, H = ${H};
  let s = 11;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#b9b2a6'); g.addColorStop(0.5, '#8f8a80'); g.addColorStop(1, '#5d5952');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {              // furniture blocks
    const v = 30 + rnd() * 90 | 0;
    x.fillStyle = 'rgb(' + v + ',' + (v - 6) + ',' + (v - 10) + ')';
    x.fillRect(rnd() * W, rnd() * H, 60 + rnd() * 400, 40 + rnd() * 300);
  }
  x.strokeStyle = '#2b2620'; x.lineWidth = 3;  // shelf / frame edges
  for (let i = 0; i < 20; i++) {
    x.beginPath();
    const x0 = rnd() * W, y0 = rnd() * H;
    x.moveTo(x0, y0); x.lineTo(x0 + (rnd() - 0.5) * 700, y0 + (rnd() - 0.5) * 200);
    x.stroke();
  }
  for (let i = 0; i < 900; i++) {              // dark compact specks
    const v = rnd() * 40 | 0;
    x.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    const r = 1.5 + rnd() * 6;
    x.beginPath(); x.arc(rnd() * W, rnd() * H, r, 0, 7); x.fill();
  }
  x.fillStyle = '#c9a98c';                     // a face-ish blob
  x.beginPath(); x.arc(950, 300, 130, 0, 7); x.fill();
  x.fillStyle = '#241d18';
  x.beginPath(); x.arc(905, 270, 12, 0, 7); x.fill();
  x.beginPath(); x.arc(990, 270, 12, 0, 7); x.fill();
  x.fillRect(915, 340, 75, 10);
  const d = x.getImageData(0, 0, W, H).data;
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < d.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, d.subarray(i, Math.min(i + CHUNK, d.length)));
  }
  return { b64: btoa(out) };
}`;

async function generate(base) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(base);
  await page.waitForFunction(() => window.__hw && window.__bia);

  const meta = { version: VERSION, fixtures: {}, gt: [], ruleYs: [],
                 sheetW: 0, sheetH: 0 };
  const cardFrames = [];
  for (let i = 0; i < 5; i++) {
    const r = await page.evaluate(`(${FRAME})({ card: ${i}, cut: true })`);
    const rgba = Buffer.from(r.b64, 'base64');
    cardFrames.push(rgba);
    fs.writeFileSync(FILE.card(i), y4mOf([rgba, rgba], 30));
    meta.fixtures['card-' + (i + 1)] = { file: path.basename(FILE.card(i)), map: r.map };
    // ground truth accumulates across the two pages (global indices)
    for (const g of r.gt) {
      if (!meta.gt.some((h) => h.line === g.line && h.x0 === g.x0 && h.ch === g.ch)) {
        meta.gt.push(g);
      }
    }
    for (let k = 0; k < 5; k++) {
      if (r.ruleYs[k] != null) meta.ruleYs[k] = r.ruleYs[k];
    }
    meta.sheetW = r.W; meta.sheetH = r.H;
  }
  {
    const r = await page.evaluate(`(${FRAME})({ card: 1 })`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.attached, y4mOf([rgba, rgba], 30));
    meta.fixtures.attached = { file: path.basename(FILE.attached), card: 1, map: r.map };
  }
  let page1Whole;
  {
    const r = await page.evaluate(`(${FRAME})({})`);
    page1Whole = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.many, y4mOf([page1Whole, page1Whole], 30));
    meta.fixtures.many = { file: path.basename(FILE.many), map: r.map };
  }
  {
    // the overlay's own story: three cards at once, then one card —
    // the message must show, then clear, and the card must collect
    const frames = [];
    for (let k = 0; k < 4; k++) frames.push(page1Whole);
    for (let k = 0; k < 4; k++) frames.push(cardFrames[0]);
    fs.writeFileSync(FILE.manyThenOne, y4mOf(frames, 2));
    meta.fixtures.manyThenOne = { file: path.basename(FILE.manyThenOne),
                                  map: meta.fixtures['card-1'].map };
  }
  {
    const r = await page.evaluate(`(${FRAME})({ legacy: true })`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.legacy, y4mOf([rgba, rgba], 30));
    meta.fixtures.legacy = { file: path.basename(FILE.legacy), map: r.map,
                             gt: r.gt, ruleYs: r.ruleYs };
  }
  {
    const r = await page.evaluate(`(${FRAME})({ card: 2, cut: true, blank: true })`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.blank, y4mOf([rgba, rgba], 30));
    meta.fixtures.blank = { file: path.basename(FILE.blank), map: r.map };
  }
  {
    // the sweep: cut cards 1 → 2 → 3, four frames each, 2s per frame
    const frames = [];
    for (const i of [0, 1, 2]) {
      for (let k = 0; k < 4; k++) frames.push(cardFrames[i]);
    }
    fs.writeFileSync(FILE.sweep, y4mOf(frames, 2));
    meta.fixtures.sweep = { file: path.basename(FILE.sweep),
                            lines: [0, 1, 2],
                            map: meta.fixtures['card-1'].map };
  }
  {
    const r = await page.evaluate(`(${NOISY_FRAME})()`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.noisy, y4mOf([rgba, rgba], 30));
    meta.fixtures.noisy = { file: path.basename(FILE.noisy) };
  }
  {
    // The far card: 420px drawn width — measured against the reader,
    // which refuses a clean one-card frame up to 560px and reads from
    // 620px. Too far to read must show the readiness light RED.
    const r = await page.evaluate(`(${FRAME})({ card: 0, cut: true, cardW: 420 })`);
    const rgba = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(FILE.far, y4mOf([rgba, rgba], 30));
    meta.fixtures.far = { file: path.basename(FILE.far), map: r.map };
  }
  {
    // The view reads, then stops reading: card 1 for four seconds,
    // then the bare desk for four — the light's green→red hand-off,
    // measurable against the real loop. The desk frame is the same
    // uniform desk grey every fixture stands its paper on.
    const desk = Buffer.alloc(W * H * 4);
    for (let i = 0; i < desk.length; i += 4) {
      desk[i] = 0x5f; desk[i + 1] = 0x66; desk[i + 2] = 0x73; desk[i + 3] = 255;
    }
    const frames = [];
    for (let k = 0; k < 8; k++) frames.push(cardFrames[0]);
    for (let k = 0; k < 8; k++) frames.push(desk);
    fs.writeFileSync(FILE.thenGone, y4mOf(frames, 2));
    meta.fixtures.thenGone = { file: path.basename(FILE.thenGone),
                               map: meta.fixtures['card-1'].map };
  }
  fs.writeFileSync(META, JSON.stringify(meta));
  await browser.close();
  return meta;
}

function readMeta() { return JSON.parse(fs.readFileSync(META, 'utf8')); }

/** Map a sheet-space x (at the ground truth's own rule y) into frame x. */
function frameX(map, x) { return map.ox + x * map.scale; }

module.exports = { generate, allPresent, readMeta, frameX, FILE, META, W, H, VERSION };

if (require.main === module) {
  const port = process.env.BIA_PORT || 8765;
  generate('http://127.0.0.1:' + port + '/tools/bring-it-alive/').then((m) => {
    console.log('wrote ' + Object.keys(m.fixtures).length + ' fixtures beside ' + META);
  }).catch((e) => { console.error(e); process.exit(1); });
}
