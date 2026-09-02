#!/usr/bin/env node
// =============================================================
// LUMO VOICE — one Lumo, one voice.
// -------------------------------------------------------------
// Reported by the product owner on the stars screen: "if i choose
// my stars very quickly the lines spoken by lumo overlaps." Every
// line lives in its own cached Audio element and play() never
// stopped the one already talking — so a fast child had Lumo
// speaking over himself. The rule now lives in js/lumoVoice.js
// itself (not in each caller): a new line silences the previous
// one and cancels any pending sequence chain; a LOOPING clip (the
// Gate's flight ambience) is exempt both ways.
//
// Driven against the REAL module in the real Studio page, with the
// Audio constructor stubbed (the atmosphere suite's own trick —
// LumoVoice looks Audio up at call time, so a stub installed after
// load is what it builds with). Run:
//   node tools/bring-it-alive/test/serve.js 8799 &
//   node tools/lumo-voice-test/run-lumo-voice-tests.js
// =============================================================
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const PORT = process.env.PORT || 8799;
const BASE = 'http://127.0.0.1:' + PORT;

let passed = 0, failed = 0;
function ck(ok, label, detail) {
  if (ok) { passed++; console.log('  ok   ' + label + (detail ? '  (' + detail + ')' : '')); }
  else { failed++; console.log('  FAIL ' + label + (detail ? '  (' + detail + ')' : '')); }
}

(async () => {
  const server = spawn('node',
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.route('**/supabase-config.json', (route) => route.fulfill({ status: 404, body: '' }));

    console.log('\nL. ONE LUMO, ONE VOICE');
    // The stub goes in BEFORE any Studio script runs: js/app.js
    // preloads the whole clip set at boot, so a stub installed after
    // load would miss every cached element (measured — the first draft
    // did exactly that). Real EventTarget underneath, so 'ended'
    // listeners behave exactly as on a real element; __playing filters
    // to Lumo's own voice files because AudioManager builds Audio
    // elements of its own at boot.
    await page.addInitScript(() => {
      window.__made = [];
      window.Audio = class extends EventTarget {
        constructor(src) {
          super();
          this.src = String(src || ''); this.volume = 1; this.loop = false;
          this.paused = true; this.currentTime = 0; this.readyState = 4;
          this.preload = '';
          window.__made.push(this);
        }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        load() {}
      };
      window.__playing = () => window.__made
        .filter((a) => !a.paused && a.src.indexOf('lumo/voice/') !== -1)
        .map((a) => a.src.split('/').pop());
      window.__find = (name) => window.__made.find((a) => a.src.indexOf(name) !== -1);
    });
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof LumoVoice !== 'undefined', null, { timeout: 20000 });

    // ---- L1: the reported overlap, dead ----------------------------
    const l1 = await page.evaluate(() => {
      LumoVoice.play('tapgrid');
      const before = window.__playing().length;
      LumoVoice.play('skyPrompt');
      const tg = window.__find('lumo-01-tapgrid');
      return { before, playing: window.__playing(), tgPaused: tg.paused, tgReset: tg.currentTime === 0 };
    });
    ck(l1.before === 1 && l1.playing.length === 1 && /skyprompt/.test(l1.playing[0]) &&
       l1.tgPaused && l1.tgReset,
       'L1  A NEW LINE SILENCES THE OLD ONE — the previous clip is paused and reset, never layered under',
       l1.playing.join(','));

    // ---- L2: however fast the child goes ---------------------------
    const l2 = await page.evaluate(() => {
      LumoVoice.play('skyWrong');
      LumoVoice.play('skyFresh');
      LumoVoice.play('skySuccess');
      LumoVoice.play('returning1');
      return window.__playing();
    });
    ck(l2.length === 1 && /returning1/.test(l2[0]),
       'L2  FOUR LINES FIRED IN ONE BREATH LEAVE EXACTLY ONE VOICE — the last thing Lumo was asked to say',
       l2.join(','));

    // ---- L3: a sequence hands the floor over and STAYS quiet -------
    const l3 = await page.evaluate(async () => {
      LumoVoice.playSequence(['greeting1', 'greeting1b']);
      const g1 = window.__find('lumo-02-greeting1.mp3');
      LumoVoice.play('skyWrong');
      // The interrupted first clip ends late (as a real clip would if
      // pause raced the tail) — the dead chain must NOT start
      // greeting1b over skyWrong.
      g1.dispatchEvent(new Event('ended'));
      await new Promise((r) => setTimeout(r, 50));
      return window.__playing();
    });
    ck(l3.length === 1 && /skywrong/.test(l3[0]),
       'L3  A CANCELLED SEQUENCE CANNOT CHAIN ITS NEXT CLIP OVER THE NEW LINE — the generation token kills the dead chain',
       l3.join(','));

    // ---- L4: and a sequence is itself one voice --------------------
    const l4 = await page.evaluate(async () => {
      LumoVoice.playSequence(['greeting2', 'greeting2b']);
      const first = window.__playing();
      const g2 = window.__find('lumo-04-greeting2.mp3');
      g2.paused = true; g2.dispatchEvent(new Event('ended'));
      await new Promise((r) => setTimeout(r, 50));
      return { first, second: window.__playing() };
    });
    ck(l4.first.length === 1 && /greeting2\.mp3/.test(l4.first[0]) &&
       l4.second.length === 1 && /greeting2b/.test(l4.second[0]),
       'L4  AN UNINTERRUPTED SEQUENCE STILL CHAINS — clip after clip, never two at once',
       l4.first.join(',') + ' -> ' + l4.second.join(','));

    // ---- L5: the flight loop is ambience, exempt both ways ---------
    const l5 = await page.evaluate(() => {
      LumoVoice.play('lumoFlying', { loop: true });
      LumoVoice.play('arrivalReturning1');
      const playing = window.__playing();
      LumoVoice.stop('lumoFlying');
      return { playing, after: window.__playing() };
    });
    ck(l5.playing.length === 2 &&
       l5.playing.some((s) => /flying/.test(s)) && l5.playing.some((s) => /arrivalreturning1/.test(s)) &&
       l5.after.length === 1 && /arrivalreturning1/.test(l5.after[0]),
       'L5  THE FLIGHT LOOP IS STAGED AMBIENCE — a spoken line plays over it, never silences it, and its own stop() still lands',
       l5.playing.join(','));

    ck(pageErrors.length === 0, 'L6  zero page errors', pageErrors.slice(0, 2).join(' | ') || 'clean');
  } finally {
    try { await browser.close(); } catch (e) {}
    try { server.kill(); } catch (e) {}
  }
  console.log('\n' + (failed ? 'FAILED — ' : 'PASSED — ') + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
