/* SPRINT R5 — THE COMPANION'S VOICE NEVER STOPS UNEXPECTEDLY.
 *
 * The owner's acceptance test, run for real: at least twenty
 * consecutive Companion exchanges across all four Companions, with the
 * REAL audio pipeline — the real chat surface, the real turn machine,
 * the real CompanionSpeak/VihuVoice stack, and a real <audio> element
 * playing real WAV bytes served where the voice function stands. A
 * response must never stop halfway, become silent mid-response, get
 * replaced by the next response, disappear while audio plays, or be
 * cut by a bell, a re-render or an ambient line.
 *
 *   U. THE MACHINERY, UNIT-PROVED (vm — no browser)
 *      · voiceReady() silences the prepare bell (R5)
 *      · a cancelled turn still fires nothing
 *   V. THE ACCEPTANCE RUN (browser, real audio)
 *      · V1  20+ consecutive exchanges — Leafy · Leo · Quill · Nimbus
 *            — every one SPOKEN THROUGH: audio starts, audio ends
 *            naturally, the words never change while it plays, ONE
 *            voice request per turn, zero browser TTS
 *      · V2  a send mid-speech is REFUSED — the input is locked while
 *            the Companion is speaking; nothing is cut, nothing is
 *            replaced
 *      · V3  A BELL NEVER CUTS A PLAYING VOICE — the speaking ceiling
 *            shrunk under the line's own length, and the line still
 *            plays to its natural end
 *      · V4  ONE TRANSIENT PROVIDER FAILURE → the SAME voice retried
 *            and heard — never a different voice
 *      · V5  a failure that persists → the EXPLICIT quiet outcome:
 *            words on screen, no sound, no browser voice, and the
 *            field is the child's again
 *      · V6  an ambient line mid-speech shows its bubble and NEVER
 *            takes the channel — the answer plays through
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-voice-test/run-companion-voice-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FnServer = require('../companion-enable-test/function-server.js');
const PORT = Number(process.env.VOICE_PORT || 8806);
const FN_PORT = Number(process.env.VOICE_FN_PORT || 8807);
const BASE = 'http://127.0.0.1:' + PORT;
const FN_BASE = 'http://127.0.0.1:' + FN_PORT;
const SHOTS = path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : no)(n, note); }
function section(t) { console.log('\n' + t); }

// A real WAV — near-silent, short, but a genuine timeline the element
// has to PLAY through before 'ended' can fire.
function wav(ms) {
  const rate = 8000, n = Math.floor(rate * ms / 1000);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 500), 44 + i * 2);
  return b;
}

// =================================================================
section('U. THE MACHINERY, UNIT-PROVED');
// =================================================================
{
  const src = fs.readFileSync(path.join(ROOT, 'js', 'companionTurn.js'), 'utf8');
  const box = vm.createContext({ console: console, window: {},
    setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date });
  vm.runInContext(src + '\n;this.T = CompanionTurn;', box);
  const T = box.T;
  // R5 — the prepare bell dies the moment the audio is in hand.
  // Without voiceReady() clearing it, this bell rings during the
  // reveal beat and the surface's give-up path stops a voice that is
  // a frame from playing.
  T.THRESHOLDS.VOICE_PREPARE_MS = 60;
  const bells = [];
  const t1 = T.create({ onState: function () {}, onGiveUp: function (k) { bells.push(k); } });
  t1.send(); t1.answered(); t1.preparingVoice(); t1.voiceReady();
  const t2 = T.create({ onState: function () {}, onGiveUp: function (k) { bells.push('un:' + k); } });
  t2.send(); t2.answered(); t2.preparingVoice();
  setTimeout(function () {
    ck(bells.indexOf('voice') === -1 && bells.indexOf('un:voice') !== -1,
       'U1  voiceReady() SILENCES THE PREPARE BELL (R5) — and without it the bell still rings',
       JSON.stringify(bells));
    T.THRESHOLDS.VOICE_PREPARE_MS = 6000;
    browserRun();
  }, 200);
}

// =================================================================
async function browserRun() {
  fs.mkdirSync(SHOTS, { recursive: true });
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
    // Real playback with no gesture requirement: the suite's clicks
    // are synthetic and must still let audio.play() succeed, exactly
    // so what is measured is the LIFECYCLE and not the sandbox.
    args: ['--no-sandbox', '--disable-dev-shm-usage',
           '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));
  await page.route('**/supabase-config.json', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ url: FN_BASE, anonKey: 'anon.key.value' }) }));

  // THE VOICE FUNCTION, SERVED FOR REAL — real bytes, controllable
  // weather. `voiceFails` burns down one refused request at a time so
  // the retry and the persistent-failure cases are both drivable;
  // `voiceMs` sets the line's real length; `voiceCount` is the truth
  // about how many requests a turn cost.
  const voice = { fails: 0, ms: 450, count: 0, delay: 0 };
  await page.route('**/functions/v1/voice-speak', async (r) => {
    voice.count++;
    if (voice.fails > 0) {
      voice.fails--;
      r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' });
      return;
    }
    // `delay` is the provider taking its time — the V7 window, where a
    // generation outlives the voice bell but not the fetch bound.
    if (voice.delay) await new Promise((res) => setTimeout(res, voice.delay));
    r.fulfill({ status: 200, contentType: 'audio/wav', body: wav(voice.ms) });
  });

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
      // ZERO BROWSER TTS is an assertion, so it is counted rather than
      // assumed — and counted from before anything can speak.
      window.__tts = 0;
      try {
        const real = window.speechSynthesis && window.speechSynthesis.speak;
        if (real) {
          window.speechSynthesis.speak = function () {
            window.__tts++;
            return real.apply(window.speechSynthesis, arguments);
          };
        }
      } catch (e) {}
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
    await page.waitForTimeout(700);
    await page.evaluate(() => { CompanionChat.setVoiceOn(true); CompanionChat.open(); });
    await page.waitForTimeout(300);
  }

  /**
   * One spoken exchange, watched end to end: send, then sample the
   * real audio element until the turn ends. Reports whether a sound
   * genuinely started and ended on its own, whether the words ever
   * changed while it played, and what the turn cost in voice requests.
   */
  async function spokenTurn(text, waitMs) {
    const before = voice.count;
    const out = await page.evaluate(async (o) => {
      const said = document.querySelector('.companion-chat-said');
      const bar = document.querySelector('.companion-chat');
      document.querySelector('.companion-chat-input').value = o.text;
      document.querySelector('.companion-chat-send').click();
      const t0 = performance.now();
      let sounded = false, wordsWhilePlaying = null, mutated = false, endedNaturally = false;
      let firstPlay = 0, lastPlay = 0;
      while (performance.now() - t0 < o.wait) {
        const playing = !!(window.VihuVoice && VihuVoice.isPlaying && VihuVoice.isPlaying());
        if (playing) {
          sounded = true;
          if (!firstPlay) firstPlay = performance.now();
          lastPlay = performance.now();
          const w = said.textContent.trim();
          if (wordsWhilePlaying === null) wordsWhilePlaying = w;
          else if (w !== wordsWhilePlaying) mutated = true;
        } else if (sounded && bar.getAttribute('data-state') === 'ready') {
          endedNaturally = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 40));
      }
      return { sounded: sounded, mutated: mutated, ended: endedNaturally,
               playedMs: Math.round(lastPlay - firstPlay),
               said: said.textContent.trim(),
               state: bar.getAttribute('data-state'),
               tts: window.__tts || 0 };
    }, { text: text, wait: waitMs || 12000 });
    out.requests = voice.count - before;
    return out;
  }

  const QUESTIONS = ['who are you?', 'what are you?', 'hello!', 'are you real?',
                     'what should I make?', 'do you like stories?'];

  // =================================================================
  section('V1. TWENTY-FOUR CONSECUTIVE EXCHANGES — all four Companions, every one spoken through');
  // =================================================================
  const COMPANIONS = [
    { id: 'leafy', name: 'Leafy', species: 'Bloomling' },
    { id: 'leosaurus', name: 'Leo', species: 'Lantern Lion' },
    { id: 'quill', name: 'Quill', species: 'Ink Spirit' },
    { id: 'nimbus', name: 'Nimbus', species: 'Dream Sprite' },
  ];
  let total = 0, spoken = 0, endedOK = 0, oneReq = 0, mutations = 0, ttsMax = 0;
  for (const c of COMPANIONS) {
    await arriveAs(c.id, c.name, c.species);
    for (let i = 0; i < 6; i++) {
      const r = await spokenTurn(QUESTIONS[i % QUESTIONS.length]);
      total++;
      if (r.sounded) spoken++;
      if (r.ended && r.said.length > 0) endedOK++;
      if (r.requests === 1) oneReq++;
      if (r.mutated) mutations++;
      if (r.tts > ttsMax) ttsMax = r.tts;
      if (!r.sounded || !r.ended || r.mutated) {
        console.log('   · ' + c.id + ' turn ' + (i + 1) + ' → ' + JSON.stringify(r));
      }
    }
  }
  ck(total === 24 && spoken === 24,
     'V1a EVERY ONE OF 24 EXCHANGES WAS ACTUALLY HEARD — a real audio element made a real sound',
     spoken + '/' + total + ' spoken');
  ck(endedOK === 24,
     'V1b AND EVERY ONE PLAYED THROUGH TO ITS OWN END — never stopped halfway, the answer still on screen',
     endedOK + '/' + total);
  ck(mutations === 0,
     'V1c THE WORDS NEVER CHANGED WHILE THEIR VOICE PLAYED — no re-render, no replacement, no disappearance');
  ck(oneReq === 24,
     'V1d ONE VOICE REQUEST PER TURN — prepare-then-speak is one fetch, never a second while one is active',
     oneReq + '/' + total);
  ck(ttsMax === 0,
     'V1e AND ZERO BROWSER TTS — every line was the Companion\'s own configured voice', ttsMax + ' calls');
  await page.screenshot({ path: path.join(SHOTS, 'V1-speaking.png') });

  // =================================================================
  section('V2. A SEND MID-SPEECH IS REFUSED — the field is locked while the Companion speaks');
  // =================================================================
  voice.ms = 1600;
  const midSend = await (async function () {
    const before = voice.count;
    const out = await page.evaluate(async () => {
      const said = document.querySelector('.companion-chat-said');
      document.querySelector('.companion-chat-input').value = 'hello!';
      document.querySelector('.companion-chat-send').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 10000) {
        if (window.VihuVoice && VihuVoice.isPlaying()) break;
        await new Promise((r) => setTimeout(r, 30));
      }
      const wordsBefore = said.textContent.trim();
      // The child presses again while the Companion is mid-sentence.
      document.querySelector('.companion-chat-input').value = 'and another thing';
      document.querySelector('.companion-chat-send').click();
      await new Promise((r) => setTimeout(r, 120));
      const stillPlaying = VihuVoice.isPlaying();
      const wordsAfter = said.textContent.trim();
      // Let it finish, then prove the field is the child's again.
      const t1 = performance.now();
      while (performance.now() - t1 < 10000) {
        if (!VihuVoice.isPlaying() &&
            document.querySelector('.companion-chat').getAttribute('data-state') === 'ready') break;
        await new Promise((r) => setTimeout(r, 40));
      }
      return { stillPlaying: stillPlaying, uncut: wordsBefore === wordsAfter,
               wordsBefore: wordsBefore };
    });
    out.extraRequests = voice.count - before - 1;
    return out;
  })();
  ck(midSend.stillPlaying && midSend.uncut && midSend.extraRequests === 0,
     'V2  LOCKED WHILE SPEAKING — the second press cut nothing, replaced nothing, requested nothing',
     JSON.stringify(midSend));

  // =================================================================
  section('V3. A BELL NEVER CUTS A PLAYING VOICE');
  // =================================================================
  await page.evaluate(() => { window.__realSpeakMs = CompanionTurn.THRESHOLDS.SPEAK_MS;
    CompanionTurn.THRESHOLDS.SPEAK_MS = 120; });
  voice.ms = 1500;
  const bell = await spokenTurn('who are you?', 14000);
  await page.evaluate(() => { CompanionTurn.THRESHOLDS.SPEAK_MS = window.__realSpeakMs; });
  // "Ended" alone cannot tell a cut from a natural finish (a cut
  // handler also lands on 'ready') — the DURATION can: a 1500ms line
  // cut at the 120ms bell measures ~120ms, played through it measures
  // its own length.
  ck(bell.sounded && bell.ended && !bell.mutated && bell.said.length > 0
     && bell.playedMs >= 1100,
     'V3  THE SPEAKING CEILING RANG MID-SENTENCE AND THE LINE STILL PLAYED ITS FULL LENGTH — the bell frees the surface, never the ears',
     JSON.stringify({ sounded: bell.sounded, ended: bell.ended, playedMs: bell.playedMs }));

  // =================================================================
  section('V4. ONE TRANSIENT FAILURE — the SAME voice, retried and heard');
  // =================================================================
  voice.ms = 450;
  voice.fails = 1;
  const retry = await spokenTurn('what are you?');
  ck(retry.sounded && retry.ended && retry.requests === 2 && retry.tts === 0,
     'V4  ONE 500 FROM THE PROVIDER → ONE RETRY OF THE COMPANION\'S OWN VOICE → HEARD — and never a different voice',
     JSON.stringify({ sounded: retry.sounded, requests: retry.requests, tts: retry.tts }));

  // =================================================================
  section('V5. A FAILURE THAT PERSISTS — the explicit quiet outcome, never a stand-in voice');
  // =================================================================
  voice.fails = 99;
  const quiet = await spokenTurn('are you real?', 9000);
  voice.fails = 0;
  const afterQuiet = await spokenTurn('hello!');
  ck(!quiet.sounded && quiet.said.length > 0 && quiet.state === 'ready' && quiet.tts === 0,
     'V5a WORDS ON SCREEN, NO SOUND, NO BROWSER VOICE, AND THE TURN ENDS READY — silence is explicit, never stuck',
     JSON.stringify({ sounded: quiet.sounded, said: quiet.said.slice(0, 40), state: quiet.state, tts: quiet.tts }));
  ck(afterQuiet.sounded && afterQuiet.ended,
     'V5b AND THE NEXT TURN SPEAKS AGAIN — a failed voice costs one line, never the session');

  // =================================================================
  section('V6. AN AMBIENT LINE MID-SPEECH NEVER TAKES THE CHANNEL');
  // =================================================================
  voice.ms = 1600;
  const ambient = await (async function () {
    const out = await page.evaluate(async () => {
      document.querySelector('.companion-chat-input').value = 'do you like stories?';
      document.querySelector('.companion-chat-send').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 10000) {
        if (window.VihuVoice && VihuVoice.isPlaying()) break;
        await new Promise((r) => setTimeout(r, 30));
      }
      // The Director's one unconditional scripted line, fired while the
      // answer is mid-sentence — the exact collision the channel guard
      // exists for.
      try { CompanionDirector.notify('published'); } catch (e) {}
      await new Promise((r) => setTimeout(r, 250));
      const survived = VihuVoice.isPlaying();
      const t1 = performance.now();
      let ended = false;
      while (performance.now() - t1 < 10000) {
        if (!VihuVoice.isPlaying() &&
            document.querySelector('.companion-chat').getAttribute('data-state') === 'ready') {
          ended = true; break;
        }
        await new Promise((r) => setTimeout(r, 40));
      }
      return { survived: survived, ended: ended };
    });
    return out;
  })();
  ck(ambient.survived && ambient.ended,
     'V6  THE ANSWER PLAYED THROUGH the Director\'s own line landing mid-sentence — bubbles show, the channel holds',
     JSON.stringify(ambient));

  // =================================================================
  section('V7. A GENERATION SLOWER THAN THE VOICE BELL IS STILL HEARD (R5.2)');
  // =================================================================
  // The owner's own case: the first (short) reply spoke and the second
  // (a long paragraph, slow on the provider) went silent with no
  // console note. The voice bell rang at VOICE_PREPARE_MS with the
  // audio still IN FLIGHT — not yet sounding — and the give-up branch
  // cancelled the pending preparation, so the bytes arrived to a moved
  // token and were dropped. Every earlier V-check answered the voice
  // route instantly, which is why thirteen greens never met this
  // window. The route now takes its time on purpose: longer than the
  // bell (6000), shorter than the fetch bound (15000). The words must
  // still go up on the hold, the field must come back, and the voice
  // must JOIN LATE and play through — _sayLate is the mechanism.
  // Proved by reverting the isPreparing guard in the give-up branch:
  // sounded comes back false.
  voice.delay = 7200;
  const late = await spokenTurn('who are you?', 16000);
  voice.delay = 0;
  ck(late.sounded && late.playedMs >= 300 && late.said.length > 0,
     'V7  the words came on the hold, and the voice joined late and was heard',
     JSON.stringify({ sounded: late.sounded, playedMs: late.playedMs }));
  ck(late.requests === 1 && late.tts === 0,
     'V7b one request, the Companion\'s own voice, and never a browser-TTS stand-in',
     late.requests + ' request(s), ' + late.tts + ' tts');

  ck(pageErrors.length === 0, 'V8  zero page errors across the whole run',
     pageErrors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  stopWeb();
  try { fn.stop(); } catch (e) {}

  console.log('\n' + (failed === 0
    ? 'ALL GREEN — ' + passed + ' passed, 0 failed'
    : 'FAILURES — ' + passed + ' passed, ' + failed + ' failed'));
  if (failed) failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
}
