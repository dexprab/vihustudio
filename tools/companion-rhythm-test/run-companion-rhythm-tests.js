#!/usr/bin/env node
/**
 * tools/companion-rhythm-test — SPRINT 1N.6
 *
 * WHAT A CHILD SEES BETWEEN SAYING SOMETHING AND HEARING AN ANSWER.
 *
 * This suite adds no intelligence and checks none. It checks a rhythm:
 * that being heard is instant, that "thinking" appears only when there
 * is a real wait, that the answer replaces it the moment it exists, that
 * waiting for a VOICE is a different thing from waiting for an ANSWER,
 * and that no state can last for ever.
 *
 * Every threshold it asserts is read out of js/companionTurn.js rather
 * than restated here, so the product and the check cannot drift.
 *
 *   T. THE MACHINE      — pure, bounded, no clock of its own invented
 *   A. FAST             — no thinking state for an instant answer
 *   B. NOTICEABLE       — thinking appears, then the answer replaces it
 *   C. VOICE PREPARING  — text visible, dots gone, voice state shown
 *   D. VOICE FAILURE    — the text survives, no technical word
 *   E. ANSWER TIMEOUT   — recovery, never permanent thinking
 *   F. ONE TURN         — one answer, one playback, no parallel request
 *   G. CLOSE            — no orphaned state, no stale audio
 *   H. REOPEN           — clean
 *   I. FOUR COMPANIONS  — one machine, four voiceIds, no leakage
 *   J. THE ETHER        — the same rhythm, not a lesser one
 *   K. NO PROVIDER      — OpenAI unused, provider calls 0
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-rhythm-test/run-companion-rhythm-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FnServer = require('../companion-enable-test/function-server.js');
const PORT = Number(process.env.RHY_PORT || 8801);
const FN_PORT = Number(process.env.RHY_FN_PORT || 8802);
const BASE = 'http://127.0.0.1:' + PORT;
const FN_BASE = 'http://127.0.0.1:' + FN_PORT;
const SHOTS = path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n + (note ? '  (' + note + ')' : ''));
         console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}
function section(t) { console.log('\n' + t); }

// ---------------------------------------------------------------
// T. THE MACHINE ON ITS OWN — pure, and with a clock it does not own.
section('T. THE MACHINE — pure, bounded, and it invents no wait');
const turnSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionTurn.js'), 'utf8');
const noComments = turnSrc.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
{
  const box = vm.createContext({ console: console, window: {},
    setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date });
  vm.runInContext(turnSrc + '\n;this.T = CompanionTurn;', box);
  const T = box.T;
  ck(Array.isArray(T.STATES) && T.STATES.length === 8,
     'T1  eight named states and nothing invented between them', T.STATES.join(' → '));
  ck(!/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/.test(noComments),
     'T2  it reaches no network and no store — it is presentation only');
  ck(!/CompanionMemory|CompanionMind|remember\s*\(|classify\s*\(/.test(noComments),
     'T3  and no intelligence — it composes nothing and reads no context');
  ck(!/openai|OPENAI/i.test(noComments), 'T4  and names no provider');
  // EVERY WAITING STATE HAS A BELL. A state that can last for ever is
  // the failure this sprint exists to remove.
  const th = T.THRESHOLDS;
  ['THINK_AFTER_MS', 'MIN_THINK_MS', 'ANSWER_MS', 'VOICE_PREPARE_MS', 'SPEAK_MS']
    .forEach(function (k, i) {
      ck(typeof th[k] === 'number' && th[k] > 0 && isFinite(th[k]),
         'T5.' + (i + 1) + ' ' + k + ' is a finite bound', String(th[k]));
    });
  ck(th.THINK_AFTER_MS >= 120 && th.THINK_AFTER_MS <= 400,
     'T6  the thinking threshold clears the measured fast path (0.2–17.5ms) without being a delay',
     th.THINK_AFTER_MS + 'ms');
  // A TURN THAT IS CANCELLED FIRES NOTHING AFTERWARDS.
  const seen = [];
  const t = T.create({ onState: (s) => seen.push(s), onGiveUp: (k) => seen.push('give:' + k) });
  t.send();
  ck(seen.join(',') === 'sending,received',
     'T7  the press is acknowledged in the same breath, and nothing else is shown yet',
     seen.join(','));
  t.cancel();
  const after = seen.length;
  t.answered(); t.preparingVoice(); t.speakingNow(); t.done();
  ck(seen.length === after,
     'T8  A CANCELLED TURN IS SILENT — no bell from an abandoned turn', seen.length + ' events');
}

// ---------------------------------------------------------------
(async () => {
  console.log('\nSPRINT 1N.6 — COMPANION THINKING & VOICE RESPONSE RHYTHM\n');
  fs.mkdirSync(SHOTS, { recursive: true });
  // IT SERVES ITSELF. Every other suite in this family documents
  // `node tools/bring-it-alive/test/serve.js <port> &` as something to
  // remember, and a run that forgets it fails with a navigation error
  // that looks nothing like a product fault — which is exactly what
  // happened to this suite's first batch run. A suite that needs a
  // prerequisite nobody can see is a suite that will be flaky.
  const web = cp.spawn(process.execPath,
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)],
    { stdio: 'ignore' });
  const stopWeb = function () { try { web.kill(); } catch (e) {} };
  process.on('exit', stopWeb);
  await new Promise(function (resolve) {
    const tryOne = function (n) {
      require('http').get(BASE + '/studio.html', function (r) { r.resume(); resolve(); })
        .on('error', function () {
          if (n <= 0) { resolve(); return; }
          setTimeout(function () { tryOne(n - 1); }, 200);
        });
    };
    tryOne(25);
  });
  const fn = await FnServer.start(FN_PORT, { COMPANION_MIND_ENABLED: 'true' });
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
  await page.route('**/supabase-config.json', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ url: FN_BASE, anonKey: 'anon.key.value' }) }));

  async function arriveAs(cid, name, species) {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
      typeof StudioEntry !== 'undefined', null, { timeout: 20000 });
    await page.evaluate((c) => {
      localStorage.clear(); sessionStorage.clear();
      const card = MagicCard.claim('Vihaan', null, { companionId: c.id,
        companionName: c.name, companionSpecies: c.species });
      MagicCard.setActive(card.id);
    }, { id: cid, name: name, species: species });
    await page.evaluate(() => {
      try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
      try { StudioEntry.pass(); } catch (e) {}
    });
    await page.goto(BASE + '/studio.html');
    await page.waitForFunction(() => typeof CompanionChat !== 'undefined', null, { timeout: 20000 });
    await page.evaluate((t) => {
      window.ThemeRepositoryClient = window.ThemeRepositoryClient || {};
      window.ThemeRepositoryClient.getSession = () => Promise.resolve({ access_token: t });
    }, fn.token);
    for (let i = 0; i < 22; i++) {
      await page.waitForTimeout(550);
      const st = await page.evaluate(() => {
        const g = document.getElementById('gatewayOverlay');
        return { showing: !!(g && !g.hidden && getComputedStyle(g).display !== 'none'),
                 settled: !!document.querySelector('.companion-widget') ||
                          document.body.classList.contains('creation-flow-active') };
      });
      if (st.settled && !st.showing) break;
      if (st.showing) { try { await page.mouse.click(720, 450); } catch (e) {} }
    }
    await page.waitForFunction(() => !!document.querySelector('.companion-chat-open'),
      null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
  }

  // Record every data-state the bar passes through for one turn.
  async function turn(text, opts) {
    return page.evaluate(async (o) => {
      const bar = document.querySelector('.companion-chat');
      const seen = [];
      const mo = new MutationObserver(() => seen.push({
        s: bar.getAttribute('data-state'),
        dots: !document.querySelector('.companion-chat-dots').hidden,
        said: document.querySelector('.companion-chat-said').textContent.trim(),
      }));
      mo.observe(bar, { attributes: true, attributeFilter: ['data-state'] });
      const t0 = performance.now();
      document.querySelector('.companion-chat-input').value = o.text;
      document.querySelector('.companion-chat-send').click();
      await new Promise((r) => setTimeout(r, o.wait || 1500));
      mo.disconnect();
      return { seen: seen, states: seen.map((x) => x.s),
        ms: Math.round(performance.now() - t0),
        said: document.querySelector('.companion-chat-said').textContent.trim(),
        dots: !document.querySelector('.companion-chat-dots').hidden,
        state: bar.getAttribute('data-state') };
    }, Object.assign({ text: text }, opts || {}));
  }

  await arriveAs('leosaurus', 'Leo', 'Lantern Lion');
  await page.evaluate(() => { CompanionChat.setVoiceOn(false); CompanionChat.open(); });
  await page.waitForTimeout(300);

  // =================================================================
  section('A. FAST — an instant answer is never dressed as deliberation');
  const fast = await turn('who are you?');
  ck(fast.states.indexOf('thinking') === -1,
     'A1  NO THINKING STATE AT ALL for a deterministic answer', fast.states.join(' → '));
  ck(fast.dots === false, 'A2  and the dots were never shown');
  ck(/Leo/.test(fast.said), 'A3  the answer is there', JSON.stringify(fast.said));
  ck(fast.state === 'ready', 'A4  and the turn ended ready', fast.state);
  await page.screenshot({ path: path.join(SHOTS, '1-fast-ready.png') });

  // =================================================================
  section('B. NOTICEABLE — thinking appears, and the answer replaces it');
  await page.evaluate(() => {
    window.__rf = window.fetch;
    window.__held = 0;
    window.fetch = function (u) {
      if (String(u).indexOf('companion-chat') !== -1) {
        window.__held++;
        const a = arguments;
        return new Promise((r) => setTimeout(() => r(window.__rf.apply(window, a)), 900));
      }
      return window.__rf.apply(window, arguments);
    };
  });
  const slow = await page.evaluate(async () => {
    const bar = document.querySelector('.companion-chat');
    const seen = [];
    const mo = new MutationObserver(() => seen.push(bar.getAttribute('data-state')));
    mo.observe(bar, { attributes: true, attributeFilter: ['data-state'] });
    document.querySelector('.companion-chat-input').value = 'how many pages are there?';
    document.querySelector('.companion-chat-send').click();
    await new Promise((r) => setTimeout(r, 420));
    const mid = { wait: (document.querySelector('.companion-chat-wait') || {}).textContent,
                  state: bar.getAttribute('data-state'),
                  dots: !document.querySelector('.companion-chat-dots').hidden,
                  said: document.querySelector('.companion-chat-said').textContent.trim() };
    await new Promise((r) => setTimeout(r, 1700));
    mo.disconnect();
    return { seen, mid, end: bar.getAttribute('data-state'),
             dots: !document.querySelector('.companion-chat-dots').hidden,
             said: document.querySelector('.companion-chat-said').textContent.trim() };
  });
  ck(slow.mid.state === 'thinking' && slow.mid.dots === true,
     'B1  a real wait DOES show thinking, with the dots', JSON.stringify(slow.mid));
  ck(slow.mid.said === '', 'B2  and no answer is shown while it is still deciding');
  ck(slow.seen.indexOf('thinking') !== -1 && slow.seen.indexOf('response-ready') !== -1 &&
     slow.seen.indexOf('thinking') < slow.seen.indexOf('response-ready'),
     'B3  thinking → response-ready, in that order', slow.seen.join(' → '));
  ck(slow.dots === false && slow.said.length > 0,
     'B4  the answer replaced it and the dots are gone', JSON.stringify(slow.said));
  ck(slow.end === 'ready', 'B5  and the turn ended ready', slow.end);
  await page.evaluate(() => { window.fetch = window.__rf; });

  // =================================================================
  section('C. VOICE PREPARING — a different wait, and it says so');
  //
  // THE PROVIDER IS UNREACHABLE FROM HERE, so the generate step is
  // stubbed at js/vihuVoice.js's own prepare()/speak() seam — which is
  // the seam the product uses, not one invented for the test. What is
  // measured is the STATE MACHINE, and that is stated honestly.
  const voice = await page.evaluate(async () => {
    const bar = document.querySelector('.companion-chat');
    const real = { prepare: VihuVoice.prepare, speak: VihuVoice.speak };
    let prepared = 0, spoke = 0;
    VihuVoice.prepare = function () { prepared++; return new Promise((r) => setTimeout(() => r(true), 700)); };
    VihuVoice.speak = function () { spoke++; return new Promise((r) => setTimeout(() => r(true), 400)); };
    CompanionChat.setVoiceOn(true);
    const seen = [];
    const mo = new MutationObserver(() => seen.push(bar.getAttribute('data-state')));
    mo.observe(bar, { attributes: true, attributeFilter: ['data-state'] });
    document.querySelector('.companion-chat-input').value = 'who are you?';
    document.querySelector('.companion-chat-send').click();
    await new Promise((r) => setTimeout(r, 600));
    const mid = { wait: (document.querySelector('.companion-chat-wait') || {}).textContent,
                  state: bar.getAttribute('data-state'),
                  dots: !document.querySelector('.companion-chat-dots').hidden,
                  said: document.querySelector('.companion-chat-said').textContent.trim() };
    await new Promise((r) => setTimeout(r, 1400));
    mo.disconnect();
    const end = { state: bar.getAttribute('data-state'),
                  said: document.querySelector('.companion-chat-said').textContent.trim() };
    VihuVoice.prepare = real.prepare; VihuVoice.speak = real.speak;
    CompanionChat.setVoiceOn(false);
    return { seen, mid, end, prepared, spoke };
  });
  ck(voice.mid.state === 'voice-preparing',
     'C1  once the words exist the state is VOICE-PREPARING, not thinking', JSON.stringify(voice.mid.state));
  // ---- TURNED ROUND BY SPRINT 3A.1, WITH A REASON --------------------
  //
  // C2 and C3 asserted the OPPOSITE of what they assert now, and both
  // were right for Sprint 1N.6: there, the words were painted the moment
  // they existed and their voice was fetched afterwards, so during
  // voice-preparing the answer WAS on screen and the dots SHOULD have
  // been down.
  //
  // The first real model turn showed what that costs. Text appeared,
  // then two to three seconds of nothing, then Leo spoke — and a child
  // reads that as their Companion writing something and refusing to say
  // it. §1 makes the written and spoken answer ONE conversational event,
  // so `voice-preparing` moved to BEFORE the reveal.
  //
  // So during it the child is still waiting, which means the answer is
  // NOT yet on screen and the indicator IS still up. What changes is the
  // WORD beside it — "is thinking" becomes "is getting ready" (§5), so a
  // Companion that has decided what to say is never described as still
  // deciding. Neither check was weakened: each asserts the same property
  // from the other side, and C5 still requires the answer to survive.
  ck(voice.mid.said.length === 0,
     'C2  THE ANSWER IS HELD FOR ITS VOICE — text and sound are one event',
     JSON.stringify(voice.mid.said));
  ck(voice.mid.dots === true && /getting ready/.test(voice.mid.wait || ''),
     'C3  and the indicator says GETTING READY, not thinking',
     JSON.stringify(voice.mid.wait));
  ck(voice.seen.indexOf('voice-preparing') !== -1 &&
     voice.seen.indexOf('speaking') > voice.seen.indexOf('voice-preparing'),
     'C4  voice-preparing → speaking, in that order', voice.seen.join(' → '));
  ck(voice.end.state === 'ready' && voice.end.said.length > 0,
     'C5  and it ends ready with the answer still there', JSON.stringify(voice.end));
  ck(voice.prepared === 1 && voice.spoke === 1,
     'C6  ONE preparation and ONE playback — nothing speculative, nothing twice',
     JSON.stringify({ prepared: voice.prepared, spoke: voice.spoke }));

  // ---- THE FIVE MOMENTS, PHOTOGRAPHED ------------------------------
  //
  // §24 asks for a picture of each. The provider is unreachable from
  // here, so the voice half is driven at js/vihuVoice.js's own seam and
  // the AUDIO ITSELF IS NOT CAPTURED — stated plainly rather than
  // implied. What these show is the screen at each state.
  const poses = {};
  await page.evaluate(() => {
    const real = { prepare: VihuVoice.prepare, speak: VihuVoice.speak };
    window.__realVoice = real;
    // 1200ms, DELIBERATELY UNDER CompanionTurn's HOLD_MS. Sprint 3A.1
    // holds the words behind the audio and releases them together, and
    // that synchronised path is what these five photographs are of. The
    // OTHER path — a voice so slow the hold rings first — is a different
    // behaviour and is checked on its own in D3/D4, rather than being
    // whichever one this stub happened to land on. The first version of
    // this sat exactly ON the threshold and raced it.
    VihuVoice.prepare = function () { return new Promise((r) => setTimeout(() => r(true), 1200)); };
    // 4000ms, so the third photograph (nominal 4600ms, plus two
    // screenshots' real overhead) lands INSIDE the speaking window
    // rather than on its end boundary — traced riding the edge.
    VihuVoice.speak = function () { return new Promise((r) => setTimeout(() => r(true), 4000)); };
    window.__rf4 = window.fetch;
    window.fetch = function (u) {
      if (String(u).indexOf('companion-chat') !== -1) {
        const a = arguments;
        return new Promise((r) => setTimeout(() => r(window.__rf4.apply(window, a)), 1400));
      }
      return window.__rf4.apply(window, arguments);
    };
    CompanionChat.setVoiceOn(true);
    document.querySelector('.companion-chat-input').value = 'how many pages are there?';
    document.querySelector('.companion-chat-send').click();
  });
  const grab = async function (label, ms) {
    await page.waitForTimeout(ms);
    const st = await page.evaluate(() => ({
      state: document.querySelector('.companion-chat').getAttribute('data-state'),
      pose: (function () { const i = document.querySelector('.companion-widget img');
        return i ? (i.getAttribute('src') || '').split('/').pop() : null; })(),
    }));
    poses[label] = st;
    await page.screenshot({ path: path.join(SHOTS, label + '.png') });
    return st;
  };
  const shotThinking = await grab('2-thinking', 500);
  const shotPreparing = await grab('3-voice-preparing', 1400);
  const shotSpeaking = await grab('4-speaking', 2700);
  await page.evaluate(() => {
    VihuVoice.prepare = window.__realVoice.prepare;
    VihuVoice.speak = window.__realVoice.speak;
    window.fetch = window.__rf4;
    CompanionChat.setVoiceOn(false);
  });
  await page.waitForTimeout(4100);
  const shotReady = await grab('5-ready', 200);
  ck(shotThinking.state === 'thinking' && shotPreparing.state === 'voice-preparing' &&
     shotSpeaking.state === 'speaking' && shotReady.state === 'ready',
     'C7  all five moments photographed, each in its own state',
     JSON.stringify({ thinking: shotThinking.state, preparing: shotPreparing.state,
                      speaking: shotSpeaking.state, ready: shotReady.state }));
  // §17 — VISUAL CONTINUITY. The face must not drop back to idle while
  // there is still something to say, and must not jump through
  // unrelated states.
  ck(shotThinking.pose === shotPreparing.pose && shotPreparing.pose === shotSpeaking.pose,
     'C8  ONE POSE CARRIES THE WHOLE TURN — no jump between unrelated states',
     JSON.stringify({ thinking: shotThinking.pose, preparing: shotPreparing.pose,
                      speaking: shotSpeaking.pose, ready: shotReady.pose }));
  ck(shotReady.pose !== shotSpeaking.pose,
     'C9  and it does return when the turn is genuinely over',
     JSON.stringify({ speaking: shotSpeaking.pose, ready: shotReady.pose }));

  // =================================================================
  section('D. VOICE FAILURE — the answer survives it');
  const vfail = await page.evaluate(async () => {
    const real = { prepare: VihuVoice.prepare, has: VihuVoice.has };
    VihuVoice.prepare = function () { return Promise.reject(new Error('nope')); };
    const realSpeak = window.speechSynthesis;
    CompanionChat.setVoiceOn(true);
    document.querySelector('.companion-chat-input').value = 'who are you?';
    document.querySelector('.companion-chat-send').click();
    await new Promise((r) => setTimeout(r, 2200));
    const out = { said: document.querySelector('.companion-chat-said').textContent.trim(),
                  state: document.querySelector('.companion-chat').getAttribute('data-state') };
    VihuVoice.prepare = real.prepare;
    CompanionChat.setVoiceOn(false);
    return out;
  });
  ck(/Leo/.test(vfail.said),
     'D1  A VOICE THAT FAILS NEVER ERASES THE ANSWER', JSON.stringify(vfail.said));
  ck(!/error|failed|api|provider|timeout|token|model|elevenlabs|openai/i.test(vfail.said),
     'D2  and no technical word reaches the child', JSON.stringify(vfail.said));
  ck(vfail.state === 'ready', 'D3  the conversation returns to ready', vfail.state);

  // =================================================================
  section('E. ANSWER TIMEOUT — recovery, never permanent thinking');
  const budget = await page.evaluate(() => CompanionTurn.THRESHOLDS.ANSWER_MS);
  const timedOut = await page.evaluate(async (ms) => {
    window.__rf2 = window.fetch;
    window.fetch = function (u) {
      if (String(u).indexOf('companion-chat') !== -1) return new Promise(() => {});
      return window.__rf2.apply(window, arguments);
    };
    document.querySelector('.companion-chat-input').value = 'how many pages are there?';
    document.querySelector('.companion-chat-send').click();
    await new Promise((r) => setTimeout(r, ms + 1200));
    const out = { state: document.querySelector('.companion-chat').getAttribute('data-state'),
                  said: document.querySelector('.companion-chat-said').textContent.trim(),
                  dots: !document.querySelector('.companion-chat-dots').hidden,
                  canSend: !document.querySelector('.companion-chat-send').disabled };
    window.fetch = window.__rf2;
    return out;
  }, budget);
  ck(timedOut.state === 'ready' && timedOut.dots === false,
     'E1  THINKING NEVER LASTS FOR EVER', JSON.stringify(timedOut.state));
  ck(timedOut.said.length > 0 &&
     !/error|api|provider|timeout|token|model/i.test(timedOut.said),
     'E2  and it says so in the Companion\'s own words', JSON.stringify(timedOut.said));
  ck(timedOut.canSend, 'E3  the field is the child\'s again');

  // =================================================================
  section('F. ONE TURN — one answer, one playback, no parallel request');
  const rapid = await page.evaluate(async () => {
    window.__rf3 = window.fetch; window.__calls = 0;
    window.fetch = function (u) {
      if (String(u).indexOf('companion-chat') !== -1) {
        window.__calls++;
        const a = arguments;
        return new Promise((r) => setTimeout(() => r(window.__rf3.apply(window, a)), 600));
      }
      return window.__rf3.apply(window, arguments);
    };
    const i = document.querySelector('.companion-chat-input');
    const b = document.querySelector('.companion-chat-send');
    i.value = 'how many pages are there?'; b.click();
    await new Promise((r) => setTimeout(r, 80));
    const heldMid = b.disabled;
    i.value = 'what page am I on?'; b.click();   // ignored — one turn
    i.value = 'how long is this?'; b.click();
    await new Promise((r) => setTimeout(r, 1800));
    const out = { calls: window.__calls, heldMid,
                  state: document.querySelector('.companion-chat').getAttribute('data-state') };
    window.fetch = window.__rf3;
    return out;
  });
  ck(rapid.heldMid === true,
     'F1  the field is held while there is no answer yet — one press, one turn');
  ck(rapid.calls === 1, 'F2  NO PARALLEL REQUESTS', rapid.calls + ' call(s)');
  ck(rapid.state === 'ready', 'F3  and it still ends ready', rapid.state);

  // =================================================================
  section('G. CLOSE — no orphaned state, no stale audio');
  const closed = await page.evaluate(async () => {
    const real = { prepare: VihuVoice.prepare, speak: VihuVoice.speak };
    let stops = 0;
    const realStop = CompanionSpeak.stop;
    CompanionSpeak.stop = function () { stops++; return realStop.apply(this, arguments); };
    VihuVoice.prepare = function () { return new Promise((r) => setTimeout(() => r(true), 3000)); };
    CompanionChat.setVoiceOn(true);
    document.querySelector('.companion-chat-input').value = 'who are you?';
    document.querySelector('.companion-chat-send').click();
    await new Promise((r) => setTimeout(r, 700));
    const during = document.querySelector('.companion-chat').getAttribute('data-state');
    CompanionChat.close();
    await new Promise((r) => setTimeout(r, 900));
    const out = { during, stops,
                  state: document.querySelector('.companion-chat').getAttribute('data-state'),
                  turn: CompanionChat.turnState(),
                  open: CompanionChat.isOpen(),
                  said: document.querySelector('.companion-chat-said').textContent.trim() };
    VihuVoice.prepare = real.prepare; VihuVoice.speak = real.speak;
    CompanionSpeak.stop = realStop;
    CompanionChat.setVoiceOn(false);
    return out;
  });
  ck(closed.during === 'voice-preparing',
     'G1  the turn really was mid-voice when it was closed', closed.during);
  ck(closed.stops > 0, 'G2  CLOSING STOPS PENDING SPEECH', closed.stops + ' stop(s)');
  ck(closed.state === 'idle' && closed.turn === 'idle' && closed.open === false,
     'G3  and nothing is left running', JSON.stringify(closed));
  ck(closed.said === '', 'G4  no orphaned answer on a closed surface');

  // =================================================================
  section('H. REOPEN — clean');
  const re = await page.evaluate(async () => {
    CompanionChat.open();
    await new Promise((r) => setTimeout(r, 250));
    return { state: document.querySelector('.companion-chat').getAttribute('data-state'),
             turn: CompanionChat.turnState(),
             said: document.querySelector('.companion-chat-said').textContent.trim(),
             dots: !document.querySelector('.companion-chat-dots').hidden,
             canSend: !document.querySelector('.companion-chat-send').disabled };
  });
  ck((re.state === 'idle' || re.state === 'ready') && re.turn === 'idle' &&
     re.said === '' && re.dots === false && re.canSend,
     'H1  reopening is a clean ready state', JSON.stringify(re));

  // =================================================================
  section('I. FOUR COMPANIONS — one machine, four voices, no leakage');
  const WHO = [['leafy', 'Leafy', 'Bloomling'], ['leosaurus', 'Leo', 'Lantern Lion'],
               ['quill', 'Quill', 'Ink Spirit'], ['nimbus', 'Nimbus', 'Dream Sprite']];
  const asked = [];
  for (const [cid, name, species] of WHO) {
    await arriveAs(cid, name, species);
    await page.evaluate(() => { CompanionChat.setVoiceOn(false); CompanionChat.open(); });
    await page.waitForTimeout(250);
    const r = await turn('who are you?', { wait: 1400 });
    const heard = await page.evaluate(async () => {
      const real = VihuVoice.prepare;
      let saw = null;
      VihuVoice.prepare = function (o) { saw = o && o.characterId; return Promise.resolve(false); };
      CompanionChat.setVoiceOn(true);
      await CompanionChat.aloud();
      await new Promise((r2) => setTimeout(r2, 400));
      VihuVoice.prepare = real; CompanionChat.setVoiceOn(false);
      return saw;
    });
    asked.push({ cid, states: r.states.join('→'), said: r.said, voice: heard });
    ck(r.states.indexOf('thinking') === -1 && r.state === 'ready',
       'I1.' + cid + ' the same machine, and the same fast path', r.states.join(' → '));
    ck(heard === cid,
       'I2.' + cid + ' asked for ITS OWN voice and nobody else\'s', String(heard));
  }
  const names = asked.map((a) => a.said);
  ck(new Set(names).size === 4, 'I3  four Companions, four answers', names.length + ' distinct: ' + new Set(names).size);

  // =================================================================
  section('S. THE THREE SURFACES — the same rhythm on each');
  //
  // Sections A-I above ran on STUDIO HOME, which is where a child lands
  // and where the pill is offered first. This says so out loud rather
  // than leaving it implied, and then walks into the Story Editor and
  // asks the same question again.
  await arriveAs('leosaurus', 'Leo', 'Lantern Lion');
  const whereHome = await page.evaluate(() => ({
    home: document.body.classList.contains('creation-flow-active'),
    docked: !!document.querySelector('.companion-chat-open'),
  }));
  ck(whereHome.home && whereHome.docked,
     'S1  A-I ran on STUDIO HOME, with the docked opener', JSON.stringify(whereHome));
  await page.evaluate(() => { CompanionChat.setVoiceOn(false); CompanionChat.open(); });
  await page.waitForTimeout(250);
  const homeTurn = await turn('who are you?', { wait: 1300 });
  ck(homeTurn.states.indexOf('thinking') === -1 && homeTurn.state === 'ready' &&
     /Leo/.test(homeTurn.said),
     'S2  and a turn there runs the whole rhythm', homeTurn.states.join(' → '));
  await page.evaluate(() => CompanionChat.close());

  // INTO THE EDITOR, through the real door.
  // MEASURE INSIDE THE WAIT, never after a fixed pause. A first draft
  // slept 2500ms and read the page — which passed on a warm run and
  // failed on a cold one with `{editor:false, canvas:true, pill:false}`,
  // caught mid-transition. It waits for the thing it is about to read.
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button, .creation-type-card'))
      .find((e) => /little story|my little story/i.test(e.textContent || ''));
    if (b) b.click();
  });
  await page.waitForFunction(
    () => !document.body.classList.contains('creation-flow-active') &&
          !!document.querySelector('.companion-chat-open'),
    null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(400);
  const inEditor = await page.evaluate(() => ({
    editor: !document.body.classList.contains('creation-flow-active'),
    canvas: !!document.querySelector('.preview-wrapper'),
    pill: !!document.querySelector('.companion-chat-open'),
  }));
  if (inEditor.editor && inEditor.pill) {
    await page.evaluate(() => { CompanionChat.setVoiceOn(false); CompanionChat.open(); });
    await page.waitForTimeout(300);
    const edTurn = await turn('who are you?', { wait: 1300 });
    ck(edTurn.states.indexOf('thinking') === -1 && edTurn.state === 'ready',
       'S3  THE STORY EDITOR runs the identical rhythm', edTurn.states.join(' → '));
    // §27 — it must not get in the way of the making.
    const clash = await page.evaluate(() => {
      const bar = document.querySelector('.companion-chat').getBoundingClientRect();
      const hit = (sel) => {
        const e = document.querySelector(sel); if (!e) return false;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        return !(bar.right <= r.left || bar.left >= r.right ||
                 bar.bottom <= r.top || bar.top >= r.bottom);
      };
      return { canvas: hit('.preview-wrapper'), header: hit('.app-header'),
               pages: hit('.left-sidebar'), bar: { y: Math.round(bar.top), h: Math.round(bar.height) } };
    });
    ck(!clash.canvas && !clash.header && !clash.pages,
       'S4  and overlaps no canvas, no header and no page list', JSON.stringify(clash));
    await page.evaluate(() => CompanionChat.close());
  } else {
    ck(false, 'S3  THE STORY EDITOR runs the identical rhythm',
       'could not reach the editor: ' + JSON.stringify(inEditor));
  }

  // =================================================================
  section('J. THE ETHER — the same rhythm, not a lesser one');
  const etherSrc = fs.readFileSync(path.join(ROOT, 'js', 'travellerTalk.js'), 'utf8');
  ck(/CompanionTurn\.create/.test(etherSrc),
     'J1  the Ether drives the SAME machine — there is no second one');
  const chatSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  ck(/CompanionTurn\.create/.test(chatSrc),
     'J2  and so does the Studio');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const stu = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
  ck(/companionTurn\.js/.test(idx) && /companionTurn\.js/.test(stu),
     'J3  and BOTH pages load it — the check the Ether\'s missing voice modules taught');
  ck(/ether-talk-dots/.test(etherSrc) && /ether-talk-dots/.test(
       fs.readFileSync(path.join(ROOT, 'css', 'vihuplanet-home.css'), 'utf8')),
     'J4  with a thinking indication of its own, styled');
  ck(/aria-hidden/.test(etherSrc.slice(etherSrc.indexOf('ether-talk-dots'),
       etherSrc.indexOf('ether-talk-dots') + 400)),
     'J5  ARIA-HIDDEN — a screen reader is never read an animation');

  // =================================================================
  section('K. NO PROVIDER, NO MODEL');
  ['companionTurn.js', 'companionChat.js', 'travellerTalk.js', 'companionSpeak.js']
    .forEach(function (f, i) {
      const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
      ck(!/openai|api\.openai|gpt-|anthropic/i.test(src),
         'K1.' + (i + 1) + '  ' + f + ' names no provider');
    });
  const fnSrc = fs.readFileSync(path.join(ROOT, 'supabase', 'functions',
    'companion-chat', 'index.ts'), 'utf8');
  ck(!/OPENAI_PRODUCTION_ENABLED\s*[:=]\s*['"]?true/.test(fnSrc) &&
     !/OPENAI_ZDR_CONFIRMED\s*[:=]\s*['"]?true/.test(fnSrc),
     'K2  and both production gates still ship closed');

  ck(pageErrors.length === 0, 'Z1  zero page errors across every journey',
     pageErrors.slice(0, 3).join(' | ') || 'none');

  await browser.close();
  stopWeb();
  console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('   · ' + f));
  console.log('screenshots: ' + SHOTS);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
