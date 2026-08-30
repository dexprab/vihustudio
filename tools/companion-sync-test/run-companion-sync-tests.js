#!/usr/bin/env node
/**
 * tools/companion-sync-test — SPRINT 3A.1
 *
 * TEXT AND VOICE ARE ONE CONVERSATIONAL EVENT.
 *
 * The first real model turn read as: words appear, two or three seconds
 * of nothing, then Leo speaks. This suite is about the two halves of
 * fixing that — SYNCHRONISATION (the words are held for their voice and
 * released with it) and LATENCY (the voice path really is shorter, not
 * merely better dressed).
 *
 *   SY. SYNCHRONISED  — text and sound within a measured window
 *   HD. THE HOLD      — a slow voice never costs a child their answer
 *   IL. INPUT LOCK    — one press, one turn, whatever a child does
 *   LT. LATENCY       — T0-T7 measured, not asserted
 *   EP. EPHEMERAL     — conversation audio is never persisted
 *   VS. THE FUNCTION  — the two storage round trips are really gone
 *   SC. SECURITY      — what reaches the voice provider, and what cannot
 *   ET. THE ETHER     — one implementation, not two
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-sync-test/run-companion-sync-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const FnServer = require('../companion-enable-test/function-server.js');
const PORT = Number(process.env.SYNC_PORT || 8803);
const FN_PORT = Number(process.env.SYNC_FN_PORT || 8804);
const BASE = 'http://127.0.0.1:' + PORT;
const FN_BASE = 'http://127.0.0.1:' + FN_PORT;

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n + (note ? '  (' + note + ')' : ''));
         console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}
function section(t) { console.log('\n' + t); }

// The thresholds are READ OUT OF THE PRODUCT, never restated here, so a
// change to one cannot leave this suite quietly checking the old number.
const turnSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionTurn.js'), 'utf8');
const HOLD_MS = Number((turnSrc.match(/HOLD_MS:\s*(\d+)/) || [])[1]);

(async () => {
  console.log('\nCOMPANION SYNCHRONISATION — Sprint 3A.1');
  console.log('HOLD_MS read from js/companionTurn.js: ' + HOLD_MS);

  // =================================================================
  section('VS. THE FUNCTION — two storage round trips, really gone');
  // =================================================================
  // The DEPLOYED file, transpiled and driven. Its handler is not
  // exported (it goes straight into Deno.serve), so the serve call is
  // what hands it over — which means what runs here is the same
  // callback the platform runs and not a copy of it.
  const SRC = path.join(ROOT, 'supabase', 'functions', 'voice-speak', 'index.ts');
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  let handler = null;
  const ENV = {
    SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'svc', ELEVENLABS_API_KEY: 'el-key',
  };
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.Deno = { env: { get: (n) => ENV[n] || '' }, serve: (fn) => { handler = fn; } };
  globalThis.fetch = async function (url, init) {
    const u = String(url);
    calls.push({ url: u, method: (init && init.method) || 'GET', body: init && init.body });
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-a' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('api.elevenlabs.io')) {
      return new Response(new Blob([new Uint8Array([1, 2, 3, 4])]).stream(),
        { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
    }
    if (u.includes('/storage/v1/')) return new Response('', { status: 404 });
    if (u.includes('/rest/v1/')) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const tmp = path.join(require('os').tmpdir(), 'vihu-voice-' + process.pid + '.mjs');
  fs.writeFileSync(tmp, js);
  await import('file://' + tmp);
  ck(typeof handler === 'function', 'VS0  the deployed function is what is being driven');

  const say = async (extra) => {
    calls.length = 0;
    const res = await handler(new Request('https://fn/voice-speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer user.token' },
      body: JSON.stringify(Object.assign({ characterId: 'leosaurus', voiceId: 'v-leo', text: 'I am here.' }, extra || {})),
    }));
    const bytes = res.headers.get('Content-Type') === 'audio/mpeg'
      ? new Uint8Array(await res.arrayBuffer()) : null;
    return { res, bytes, storage: calls.filter((c) => c.url.includes('/storage/v1/')) };
  };

  const plain = await say();
  ck(plain.storage.some((c) => c.method === 'GET'),
     'VS1  an ordinary line still LOOKS in the cache first', plain.storage.map((c) => c.method).join(','));
  const eph = await say({ ephemeral: true });
  ck(eph.bytes && eph.bytes.length === 4,
     'VS2  an EPHEMERAL line is still audio, and all of it arrives',
     eph.bytes ? eph.bytes.length + ' bytes' : 'no audio');
  ck(eph.storage.length === 0,
     'VS3  AND IT TOUCHES STORAGE NOT ONCE — neither the read nor the write',
     eph.storage.length + ' storage call(s)');
  ck(eph.res.headers.get('X-Vihu-Voice') === 'ephemeral',
     'VS4  and says which path served it', eph.res.headers.get('X-Vihu-Voice'));
  ck(/X-Vihu-Provider-Ms/.test(fs.readFileSync(SRC, 'utf8')) &&
     /Access-Control-Expose-Headers/.test(fs.readFileSync(SRC, 'utf8')),
     'VS5  the timing header exists AND is exposed to the browser that receives it');
  // The write is fire-and-forget on the cached path, so give it a tick.
  await new Promise((r) => setTimeout(r, 40));
  const wrote = calls.filter((c) => c.url.includes('/storage/v1/') && c.method === 'POST');
  ck(wrote.length === 0,
     'VS6  AND NOTHING WAS WRITTEN for the ephemeral one, even late',
     wrote.length + ' write(s) after settling');
  const fnSrc = fs.readFileSync(SRC, 'utf8');
  ck(/res\.body\.tee\(\)/.test(fnSrc) && !/const audio = new Uint8Array\(await res\.arrayBuffer\(\)\);\n  \/\/ Fire/.test(fnSrc),
     'VS7  THE BYTES GO STRAIGHT THROUGH — the two hops are no longer sequential');
  ck(/ELEVENLABS_OUTPUT_FORMAT/.test(fnSrc) && /const q = fmt \? /.test(fnSrc),
     'VS8  the audio format is a knob whose default changes nothing');
  const noFmt = calls.filter((c) => c.url.includes('elevenlabs'));
  ck(noFmt.length > 0 && noFmt.every((c) => c.url.indexOf('output_format') === -1),
     'VS8b and unset really means the query it always sent', noFmt[0] && noFmt[0].url.split('/').pop());

  // =================================================================
  section('SC. SECURITY — what may reach the voice provider');
  // =================================================================
  const elCall = calls.filter((c) => c.url.includes('api.elevenlabs.io')).pop();
  const elBody = elCall ? JSON.parse(elCall.body) : {};
  ck(Object.keys(elBody).sort().join(',') === 'model_id,text,voice_settings',
     'SC1  ONLY the words, the voice and its settings reach the provider',
     Object.keys(elBody).sort().join(','));
  const forbidden = ['memor', 'canon', 'personality', 'creator', 'cardId', 'card_id',
                     'constellation', 'stars', 'storyId', 'pageId', 'ownerId', 'session'];
  const elJson = JSON.stringify(elBody).toLowerCase();
  ck(forbidden.every((w) => elJson.indexOf(w.toLowerCase()) === -1),
     'SC2  no memory, no canon, no Creator, no card and NO STARS',
     forbidden.filter((w) => elJson.indexOf(w.toLowerCase()) !== -1).join(',') || 'none present');
  // Shipped files: the key exists in exactly one place, and it is not one
  // a browser can read.
  const shipped = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'tools' ||
          e.name === 'supabase' || e.name === 'docs') return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(js|html|css|json)$/.test(e.name)) shipped.push(full);
    });
  })(ROOT);
  const leaks = shipped.filter((f) => /ELEVENLABS_API_KEY|OPENAI_API_KEY|api\.openai\.com|xi-api-key/.test(fs.readFileSync(f, 'utf8')));
  ck(leaks.length === 0,
     'SC3  NO SHIPPED FILE NAMES A KEY OR A PROVIDER HOST',
     leaks.map((f) => path.relative(ROOT, f)).join(', ') || shipped.length + ' files swept');
  const speakSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionSpeak.js'), 'utf8');
  ck(!/CompanionMemory|companionPerception|CompanionContextBuilder|remember\s*\(/.test(speakSrc),
     'SC4  the speaking module cannot reach a memory, a perception or a context');

  globalThis.fetch = realFetch;

  // =================================================================
  // THE BROWSER HALF
  // =================================================================
  const fn = await FnServer.start(FN_PORT, { COMPANION_MIND_ENABLED: 'true' });
  const http = require('http');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    const ext = path.extname(file);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                   '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
                   '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await require('../companion-rhythm-test/open-studio.js')(page, BASE, FN_BASE,
    { token: fn.token || FnServer.USER_TOKEN });

  // ---- A CONTROLLED VOICE, so the segments are known rather than luck.
  const armVoice = (prepareMs, speakMs) => page.evaluate(([p, s]) => {
    window.__real = window.__real || { prepare: VihuVoice.prepare, speak: VihuVoice.speak };
    window.__log = { prepared: [], spoke: [] };
    VihuVoice.prepare = function (o) {
      window.__log.prepared.push(o);
      return new Promise((r) => setTimeout(() => r(true), p));
    };
    VihuVoice.speak = function (o) {
      window.__log.spoke.push(o);
      return new Promise((r) => setTimeout(() => r(true), s));
    };
    CompanionChat.setVoiceOn(true);
  }, [prepareMs, speakMs]);

  const ask = (q) => page.evaluate((text) => {
    const bar = document.querySelector('.companion-chat');
    window.__seen = [];
    window.__shownAt = null;
    const mo = new MutationObserver(() => {
      window.__seen.push({ s: bar.getAttribute('data-state'), t: performance.now() });
    });
    mo.observe(bar, { attributes: true, attributeFilter: ['data-state'] });
    const said = document.querySelector('.companion-chat-said');
    const so = new MutationObserver(() => {
      if (window.__shownAt == null && said.textContent.trim()) window.__shownAt = performance.now();
    });
    so.observe(said, { childList: true, characterData: true, subtree: true });
    window.__mo = mo; window.__so = so;
    document.querySelector('.companion-chat-input').value = text;
    document.querySelector('.companion-chat-send').click();
  }, q);

  const readTurn = () => page.evaluate(() => {
    if (window.__mo) window.__mo.disconnect();
    if (window.__so) window.__so.disconnect();
    const speakAt = (window.__seen.find((x) => x.s === 'speaking') || {}).t;
    return {
      seen: window.__seen.map((x) => x.s),
      shownAt: window.__shownAt,
      speakAt: speakAt == null ? null : speakAt,
      said: document.querySelector('.companion-chat-said').textContent.trim(),
      state: document.querySelector('.companion-chat').getAttribute('data-state'),
      prepared: window.__log.prepared.length,
      spoke: window.__log.spoke.length,
      req: window.__log.prepared[0] || null,
    };
  });

  // =================================================================
  section('SY. SYNCHRONISED — text and sound as one event');
  // =================================================================
  await armVoice(700, 1500);
  await ask('who are you?');
  await page.waitForTimeout(2600);
  const sync = await readTurn();
  ck(sync.said.length > 0 && sync.seen.indexOf('speaking') !== -1,
     'SY1  the answer is on screen and it was spoken', JSON.stringify(sync.said));
  const gap = (sync.speakAt != null && sync.shownAt != null)
    ? Math.round(sync.speakAt - sync.shownAt) : null;
  ck(gap != null && Math.abs(gap) < 100,
     'SY2  TEXT AND SOUND WITHIN 100ms — §6, measured rather than claimed',
     gap == null ? 'not measured' : gap + 'ms apart');
  ck(sync.seen.indexOf('voice-preparing') !== -1 &&
     sync.seen.indexOf('voice-preparing') < sync.seen.indexOf('speaking'),
     'SY3  and the child was told which wait they were in', sync.seen.join(' → '));
  ck(sync.prepared === 1 && sync.spoke === 1,
     'SY4  ONE preparation, ONE playback — nothing speculative, nothing twice',
     JSON.stringify({ prepared: sync.prepared, spoke: sync.spoke }));
  ck(sync.req && sync.req.ephemeral === true,
     'SY5  and the line is asked for as EPHEMERAL — §16', JSON.stringify(sync.req && sync.req.ephemeral));

  // =================================================================
  section('HD. THE HOLD — a slow voice never costs a child their answer');
  // =================================================================
  await armVoice(HOLD_MS + 1500, 600);
  await ask('who are you?');
  // WELL INSIDE the hold, so this cannot race the bell it is checking.
  await page.waitForTimeout(Math.round(HOLD_MS * 0.5));
  const during = await page.evaluate(() => ({
    said: document.querySelector('.companion-chat-said').textContent.trim(),
    state: document.querySelector('.companion-chat').getAttribute('data-state'),
    wait: document.querySelector('.companion-chat-wait').textContent,
  }));
  ck(during.said === '' && during.state === 'voice-preparing',
     'HD1  BEFORE the hold rings the words are still held', JSON.stringify(during));
  // AND THE RING IS WAITED FOR, NOT GUESSED AT. The first version of
  // this slept HOLD_MS from the moment the child pressed — but the hold
  // begins when the ANSWER arrives, a few hundred milliseconds later, so
  // it read the screen 20ms early and reported the words missing. A
  // check that races the thing it is checking fails convincingly.
  const revealedAt = await page.evaluate(async (cap) => {
    const said = document.querySelector('.companion-chat-said');
    const t0 = performance.now();
    while (performance.now() - t0 < cap) {
      if (said.textContent.trim()) return Math.round(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  }, HOLD_MS + 2000);
  const after = await page.evaluate(() => ({
    said: document.querySelector('.companion-chat-said').textContent.trim(),
    canSend: !document.querySelector('.companion-chat-send').disabled,
  }));
  ck(after.said.length > 0,
     'HD2  ONCE IT RINGS THE ANSWER IS THE CHILD\'S, whatever the voice is doing',
     JSON.stringify(after.said));
  ck(after.canSend === true, 'HD3  and so is the field — nothing is held hostage');
  ck(revealedAt !== null && revealedAt < HOLD_MS,
     'HD3b  AND IT ARRIVED BEFORE THE VOICE DID — the hold is a ceiling, not a wait',
     revealedAt + 'ms after the half-way check, voice due at ' + (HOLD_MS + 1500) + 'ms');
  await page.waitForTimeout(2600);
  const late = await readTurn();
  ck(late.spoke === 1 && late.state === 'ready',
     'HD4  THE VOICE STILL JOINS — it is the same answer, not a second failure',
     JSON.stringify({ spoke: late.spoke, state: late.state }));
  ck(late.said.length > 0, 'HD5  and the answer never disappeared', JSON.stringify(late.said));

  // =================================================================
  section('IL. INPUT LOCK — one press, one turn, whatever a child does');
  // =================================================================
  await armVoice(600, 800);
  const locked = await page.evaluate(async () => {
    window.__log = { prepared: [], spoke: [] };
    let asks = 0;
    const rf = window.fetch;
    window.fetch = function (u) {
      if (String(u).indexOf('companion-chat') !== -1) asks++;
      return rf.apply(window, arguments);
    };
    const input = document.querySelector('.companion-chat-input');
    const send = document.querySelector('.companion-chat-send');
    // A QUESTION THAT REALLY LEAVES THE BROWSER. §22 counts model
    // requests, and CompanionMind.LOCAL_INTENTS answers who/what/where
    // without one — so asking those would have proved "one request" by
    // making none, which is the vacuous shape this repository keeps
    // catching. A story fact is server-authoritative (Decision 36) and
    // goes out even when the answer that comes back is a failure.
    input.value = 'what is this story?';
    // DOUBLE CLICK, then Enter, then a third click — §22.
    send.click(); send.click();
    document.querySelector('.companion-chat-row')
      .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    send.click();
    const mid = { sendDisabled: send.disabled, inputDisabled: input.disabled };
    await new Promise((r) => setTimeout(r, 2200));
    window.fetch = rf;
    return { asks: asks, mid: mid, spoke: window.__log.spoke.length,
             prepared: window.__log.prepared.length,
             said: document.querySelector('.companion-chat-said').textContent.trim(),
             canSend: !send.disabled };
  });
  ck(locked.asks === 1, 'IL1  FOUR SUBMISSIONS, ONE REQUEST', locked.asks + ' model request(s)');
  ck(locked.prepared === 1 && locked.spoke === 1,
     'IL2  one voice request and one playback', JSON.stringify({ prepared: locked.prepared, spoke: locked.spoke }));
  ck(locked.mid.sendDisabled === true && locked.mid.inputDisabled === true,
     'IL3  AND THE UI SAID SO — Send and the field both unavailable', JSON.stringify(locked.mid));
  ck(locked.canSend === true && locked.said.length > 0,
     'IL4  and both come back with SOMETHING on screen — never a blank panel',
     JSON.stringify(locked.said));

  // =================================================================
  section('LT. LATENCY — the segments, measured');
  // =================================================================
  await armVoice(700, 1200);
  await ask('what are you?');
  await page.waitForTimeout(2600);
  await readTurn();
  const marks = await page.evaluate(() => (CompanionChat.marks ? CompanionChat.marks() : null));
  ck(marks && marks.segments && typeof marks.segments.toAnswer === 'number',
     'LT1  a turn reports where its time went', JSON.stringify(marks && marks.segments));
  ck(marks && typeof marks.segments.answerToVoice === 'number' &&
     typeof marks.segments.textToSound === 'number',
     'LT2  including the two this sprint exists to shorten',
     JSON.stringify(marks && { answerToVoice: marks.segments.answerToVoice,
                               textToSound: marks.segments.textToSound }));
  ck(marks && Math.abs(marks.segments.textToSound) < 100,
     'LT3  AND TEXT-TO-SOUND IS THE ONE THAT MATTERS — §6',
     marks ? marks.segments.textToSound + 'ms' : 'n/a');
  const plainJson = JSON.stringify(marks);
  ck(!/[a-z]{4,}\s[a-z]{4,}/i.test(plainJson.replace(/[A-Za-z]+Ms|answerToVoice|voiceToSound|textToSound|toAnswer|segments|voiceReady|speaking|shown|answer|total|at/g, '')),
     'LT4  and it is NUMBERS ONLY — no question, no answer, no Companion, no card',
     plainJson.slice(0, 120));

  // =================================================================
  section('ET. THE ETHER — one implementation, not two');
  // =================================================================
  const chatSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  const ethSrc = fs.readFileSync(path.join(ROOT, 'js', 'travellerTalk.js'), 'utf8');
  ck(/CompanionSpeak\.ready\(/.test(chatSrc) && /CompanionSpeak\.ready\(/.test(ethSrc),
     'ET1  BOTH surfaces prepare before they reveal — the same call');
  ck(/preparingVoice\(/.test(ethSrc) && /voiceReady\(/.test(ethSrc),
     'ET2  and both drive the same machine, with the same hold');
  ck(/'voice-preparing'/.test(ethSrc) && /is getting ready/.test(ethSrc),
     'ET3  and say the same thing while it happens');
  const bothWords = (chatSrc.match(/is getting ready/g) || []).length +
                    (ethSrc.match(/is getting ready/g) || []).length;
  ck(bothWords === 2, 'ET4  one line each, and no third copy anywhere', bothWords + ' occurrence(s)');

  ck(errors.length === 0, 'Z1  zero page errors', errors.slice(0, 2).join(' | ') || 'none');

  await browser.close();
  server.close();
  if (fn && fn.stop) await fn.stop();

  console.log('\n' + (failed ? 'FAILURES' : 'ALL GREEN') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
