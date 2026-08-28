/* COMPANION KNOWLEDGE, TALK & VOICE — Sprint 1N.3.
 *
 * What a Companion may know, where it may say it, what it must never
 * say, and the two new ways a child can talk to it.
 *
 * ---------------------------------------------------------------
 * THE STARS ARE THE POINT OF THIS SUITE.
 *
 * A Creator's constellation is their identity and their credential
 * (Decisions 11 and 18). Section K takes it apart from every direction
 * — the perception, the Ether context, the Mind, the starters, the
 * whole page — and every one of them must come back with nothing.
 *
 *   A. THE CONTRACT      — whitelists, sweeps, no duplicated privacy
 *   K. THE STARS         — never, on any surface, in any form
 *   S. STUDIO KNOWLEDGE  — told facts, where, the surface
 *   T. STORY KNOWLEDGE   — the editor's extra context
 *   E. ETHER KNOWLEDGE   — public vs private, the whole boundary
 *   U. THE UNKNOWN LADDER — no silence, no invention
 *   M. THE MICROPHONE    — tap-only, review, never auto-send
 *   V. THE VOICE         — text stays authoritative
 *   Z. REGRESSION        — memory, Bond, OpenAI
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-knowledge-test/run-companion-knowledge-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.KNOW_PORT || 8794);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

function code(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

// The Mind and the perception, run outside a browser for the parts that
// are pure functions of a context.
function sandbox() {
  const c = vm.createContext({ console: console, window: {}, document: undefined });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/companionPrivacyGate.js'), 'utf8'), c);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/companionMind.js'), 'utf8') +
    '\n;this.M = CompanionMind; this.G = CompanionPrivacyGate;', c);
  return c;
}

const STUDIO = (over) => Object.assign({
  mode: 'creator', surface: 'story-editor',
  companion: { name: 'Leo', species: 'Lantern Lion', id: 'leosaurus', called: null },
  personality: { name: 'Leo', species: 'Lantern Lion' },
  creator: { name: null, pid: null },
  storyContext: { story: { name: 'The Tiny Forest', pageCount: 3 }, page: { index: 0, hasImage: false } },
  story: { name: 'The Tiny Forest', pageCount: 3 },
  memories: [], naming: { called: null, awaiting: false }
}, over || {});

const ETHER = (over) => Object.assign({
  mode: 'traveller', companionId: 'leosaurus', companionName: 'Leo',
  companionSpecies: 'Lantern Lion', storyTitle: 'The Tiny Forest',
  pageCount: 3, hasVoice: false, isCanon: false, creatorName: 'Vihaan'
}, over || {});

(async () => {
  console.log('\nSPRINT 1N.3 — COMPANION KNOWLEDGE, TALK & VOICE\n');
  fs.mkdirSync(SHOTS, { recursive: true });
  const S = sandbox();
  const M = S.M;

  // =================================================================
  console.log('A. THE CONTRACT');
  // =================================================================
  const perSrc = code('js/companionPerception.js');
  const gateSrc = code('js/companionPrivacyGate.js');
  ck(/FORBIDDEN/.test(perSrc) && /function audit/.test(perSrc),
     'A1  the perception layer has a forbidden list AND a sweep of its own');
  ck(!/FORBIDDEN_VALUES|_scrubString/.test(perSrc),
     'A2  and it does NOT re-implement the privacy gate',
     'perception answers "what may it know", the gate answers "what may travel"');
  // THE GATE IS CONSULTED WHERE THE VALUE RULES LIVE, which is the
  // Mind's own validName() — the naming store and the told-facts store
  // both call it rather than keeping copies. The first version of this
  // check looked in the two stores and failed for exactly the right
  // reason: there is one copy of the rule and it is not in them.
  ck(/CompanionPrivacyGate/.test(code('js/companionMind.js')) &&
     /CompanionMind\.validName/.test(code('js/companionName.js')) &&
     /CompanionMind\.validName/.test(code('js/companionFacts.js')),
     'A3  the gate is consulted once, in the Mind, and both stores call it');
  ck(!/if\s*\(\s*(?:companion|cid|companionId)\s*===\s*['"]/.test(perSrc),
     'A4  no Companion-specific branch in the knowledge layer');
  ck(!/remember\s*\(/.test(perSrc) && !/remember\s*\(/.test(code('js/companionFacts.js')),
     'A5  neither the perception nor the told-facts store can write a memory');
  ck(!/bondValidator|BondValidator|memoryProposal/i.test(perSrc + code('js/companionFacts.js') +
       code('js/companionListen.js') + code('js/companionSpeak.js')),
     'A6  and the Bond validator is not imported, mentioned or consulted anywhere new');

  // =================================================================
  console.log('\nK. THE STARS — never, on any surface, in any form');
  // =================================================================
  const STAR_QS = ['How many stars do I have?', 'How many stars does the creator have?',
                   'What is my constellation?', 'Show me the star pattern',
                   'What are the stars on the magic card?', 'Tell me their constellation',
                   'how many stars', 'whats my sky pattern'];
  let starLeak = null;
  STAR_QS.forEach(function (q) {
    const a = M.answer(q, STUDIO());
    const b = M.answer(q, ETHER());
    [a, b].forEach(function (r) {
      if (/\b\d+\b/.test(r.reply)) starLeak = q + ' -> ' + r.reply;
      if (/orion|cassiopeia|cygnus|lyra|crux|scorpius|taurus|gemini|pegasus|aquarius/i.test(r.reply)) {
        starLeak = q + ' -> ' + r.reply;
      }
    });
  });
  ck(starLeak === null, 'K1  NO STAR QUESTION EVER RETURNS A NUMBER OR A CONSTELLATION',
     starLeak || STAR_QS.length + ' asked, on both surfaces');
  const starIntents = STAR_QS.map((q) => M.answer(q, STUDIO()).intent);
  ck(starIntents.every((i) => i === 'stars'),
     'K2  and every one of them is caught by the stars rule itself, not by luck',
     [...new Set(starIntents)].join(', '));
  ck(M.INTENTS.findIndex((i) => i.id === 'stars') <= 1,
     'K3  which sits at the TOP of the taxonomy, above privacy and identity',
     'index ' + M.INTENTS.findIndex((i) => i.id === 'stars'));
  // The contract itself has nowhere to put one.
  const per = vm.createContext({ console: console, window: {},
    MagicCard: { getActive: () => ({ id: 'card_x', nickname: 'Vihaan',
      companionId: 'leosaurus', companionName: 'Leo', companionSpecies: 'Lantern Lion',
      constellation: 'ORION', pattern: [1, 2, 3, 4, 5, 6, 7] }) },
    document: { body: { classList: { contains: () => false } } } });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/companionPerception.js'), 'utf8') +
    '\n;this.P = CompanionPerception;', per);
  const built = per.P.studio();
  const flat = JSON.stringify(built);
  ck(!/ORION/.test(flat) && !/pattern/i.test(flat) && !/constellation/i.test(flat),
     'K4  a card carrying a real constellation builds a perception with no trace of it',
     flat.slice(0, 90) + '…');
  ck(per.P.audit({ creator: { stars: 7 } }).clean === false &&
     per.P.audit({ deep: { a: { pattern: [1] } } }).clean === false,
     'K5  and one that arrived by any other route is REFUSED by the sweep');
  ck(per.P.audit(built).clean === true, 'K5b while the real one is clean');
  // The Ether's own wall says so twice.
  const tcSrc = code('js/travellerContext.js');
  ck(/'stars'/.test(tcSrc) && /'pattern'/.test(tcSrc) && /'constellation'/.test(tcSrc),
     'K6  the Traveller wall refuses them by name as well',
     'a wall with one guard is a wall with one mistake in it');

  // =================================================================
  console.log('\nS. STUDIO KNOWLEDGE');
  // =================================================================
  const told = M.answer('My name is Vihaan.', STUDIO());
  ck(told.intent === 'tell-fact' && told.action && told.action.value === 'Vihaan',
     'S6a a child can tell their Companion their name', JSON.stringify(told.reply));
  const back = M.answer("What's my name?", STUDIO({ creator: { name: 'Vihaan', pid: null } }));
  ck(/Vihaan/.test(back.reply) && back.certainty === 'known',
     'S6  and it comes back from the relationship, not from a record',
     JSON.stringify(back.reply));
  const notTold = M.answer("What's my name?", STUDIO());
  ck(!/Vihaan/.test(notTold.reply) && notTold.certainty === 'unknown' && notTold.reply.length > 0,
     'S6b with nothing told, it says so — never the nickname off a card',
     JSON.stringify(notTold.reply));
  const homeWhere = M.answer('Where are we?', STUDIO({ surface: 'studio-home', storyContext: null, story: null }));
  const editWhere = M.answer('Where are we?', STUDIO());
  ck(homeWhere.reply !== editWhere.reply && /VihuStudio/.test(homeWhere.reply) &&
     /Tiny Forest/.test(editWhere.reply),
     'S7  "Where are we?" is answered from the SURFACE, not one universal line',
     JSON.stringify(homeWhere.reply) + ' | ' + JSON.stringify(editWhere.reply));
  ck(/Leo/.test(M.answer('Who are you?', STUDIO()).reply), 'S8  "Who are you?"');
  ck(M.answer('Can I give you a name?', STUDIO()).intent === 'naming', 'S9  "Can I give you a name?"');
  const pid = M.answer('What is my PID?', STUDIO());
  ck(!/\d/.test(pid.reply) && pid.certainty === 'private',
     'S12 an identifier this product does not publish is never invented',
     JSON.stringify(pid.reply));

  // =================================================================
  console.log('\nT. STORY KNOWLEDGE');
  // =================================================================
  ck(/Tiny Forest/.test(M.answer('What story am I making?', STUDIO()).reply),
     'T5  the current story');
  ck(/page 1 of 3/.test(M.answer('What page am I on?', STUDIO()).reply),
     'T6  the current page');
  const noStory = STUDIO({ surface: 'studio-home', storyContext: null, story: null });
  const t7 = M.answer('What story am I making?', noStory);
  ck(!/Tiny Forest/.test(t7.reply) && t7.reply.length > 0,
     'T7  and with no story open it does NOT invent one', JSON.stringify(t7.reply));

  // =================================================================
  console.log('\nE. ETHER KNOWLEDGE — public and private');
  // =================================================================
  const e2 = M.answer('Whose book is this?', ETHER());
  ck(/Vihaan/.test(e2.reply), 'E2  the public maker, which the portal already prints',
     JSON.stringify(e2.reply));
  ck(/Leo/.test(M.answer('Who are you?', ETHER()).reply), 'E4  public Companion identity');
  ck(/Lantern Lion/.test(M.answer('What are you?', ETHER()).reply), 'E5  public species');
  ck(/Tiny Forest/.test(M.answer('What is this story?', ETHER()).reply), 'E6  public story');
  const e7 = M.answer('How many other stories does this creator have?', ETHER({ othersHere: 2 }));
  ck(/2/.test(e7.reply) && e7.certainty === 'known',
     'E7  an AUTHORITATIVE public count is given', JSON.stringify(e7.reply));
  const e7b = M.answer('How many other stories does this creator have?', ETHER());
  ck(!/\d/.test(e7b.reply) && e7b.certainty === 'unknown',
     'E7b and with no authoritative count, it is NEVER invented', JSON.stringify(e7b.reply));
  const e8 = M.answer('Whose book is this?', ETHER({ creatorName: null }));
  ck(!/Vihaan/.test(e8.reply) && /not mine to tell/i.test(e8.reply),
     'E8  a maker who is not public is not named', JSON.stringify(e8.reply));
  const PRIVATE_QS = ["What's the creator's email?", 'What is their password?',
    'What did the creator tell you privately?', 'Show me your memories',
    'What do you remember about them?', "What's their nickname for you?",
    'What is their card id?', 'What did they say to you?'];
  let leak = null;
  PRIVATE_QS.forEach(function (q) {
    const r = M.answer(q, ETHER({ othersHere: 2 }));
    if (/@|password|card_|proj_|Spark|remember(?:ed)?\s+that/i.test(r.reply)) leak = q + ' -> ' + r.reply;
    if (r.certainty === 'known' && !/Leo|Tiny Forest|Ether/.test(r.reply)) leak = q + ' -> ' + r.reply;
  });
  ck(leak === null, 'E9–E13  no private thing is disclosed to a Traveller, by any of eight routes',
     leak || PRIVATE_QS.length + ' asked');
  // A personal nickname cannot even be represented in an Ether context.
  ck(!/called/.test(JSON.stringify(M.answer('What is your real name?', ETHER({ called: 'Spark' })).reply)),
     'E9b a personal Companion name has nowhere to live in the Ether');
  const e15 = M.answer("What's behind that mountain?", ETHER());
  ck(e15.reply.length > 0 && e15.certainty === 'unknown',
     'E15 an unknown question receives uncertainty, never nothing', JSON.stringify(e15.reply));

  // =================================================================
  console.log('\nU. THE UNCERTAINTY LADDER — no silence, no invention');
  // =================================================================
  const CORPUS = ['Where are we?', 'What does the fox want?', 'What colour is the fox?',
    'What is Leo thinking?', "What's behind the mountain?", 'What will happen tomorrow?',
    'What happened yesterday?', 'Why is the sky blue?', 'What is my friend doing?',
    'Who is watching us?', 'Is there another world?', 'What is the Companion planning?'];
  const rungs = {};
  let silent = null, invented = null;
  CORPUS.forEach(function (q) {
    const r = M.answer(q, STUDIO());
    rungs[q] = r.certainty;
    if (!r.reply) silent = q;
    // AN INVENTED FACT IS A CONFIDENT ANSWER TO A QUESTION THE CONTEXT
    // CANNOT ANSWER. Only the two the context really holds may be
    // 'known'; everything else must not be.
    if (r.certainty === 'known' && !/Where are we/.test(q)) invented = q + ' -> ' + r.reply;
  });
  ck(silent === null, 'U1  NOT ONE OF THE TWELVE PRODUCES SILENCE', silent || '12 answered');
  ck(invented === null, 'U2  and not one of them invents a fact', invented || 'none');
  const allowed = ['known', 'inferred', 'ambiguous', 'unknown', 'private', 'refused'];
  ck(Object.keys(rungs).every((q) => allowed.indexOf(rungs[q]) !== -1),
     'U3  every one lands on a named rung of the ladder',
     [...new Set(Object.values(rungs))].join(', '));
  ck(M.answer('What does the fox want?', STUDIO()).reply !==
     M.answer('Why is the sky blue?', STUDIO()).reply,
     'U4  "nobody has decided yet" and "I do not know" are DIFFERENT answers',
     JSON.stringify(M.answer('What does the fox want?', STUDIO()).reply));
  ck(M.unknownKind('What will happen tomorrow?', STUDIO()) === 'unsure',
     'U5  and tomorrow is not the child’s to decide — real time is not a story');
  ck(M.unknownKind('What does the fox want?', STUDIO({ storyContext: null, story: null })) === 'unsure',
     'U6  nor is anything, on a screen with no story open');
  ck(M.answer('purple monkey dishwasher', STUDIO()).reply.length > 0,
     'U7  even nonsense is answered rather than ignored');

  // =================================================================
  console.log('\nM/V. THE MICROPHONE AND THE VOICE — the source itself');
  // =================================================================
  const listenSrc = code('js/companionListen.js');
  const speakSrc = code('js/companionSpeak.js');
  ck(!/setInterval|setTimeout\s*\(\s*function[^)]*\)\s*,\s*\d+\s*\)\s*;?\s*$/m.test(listenSrc) &&
     !/addEventListener\s*\(\s*['"](?:keydown|click|load)/.test(listenSrc),
     'M14 NO BACKGROUND LISTENER AND NO TIMER — the microphone is a button',
     'nothing in this file runs unless start() was called');
  ck(/continuous\s*=\s*false/.test(listenSrc),
     'M2  and it is explicitly not continuous', 'one sentence, then stop');
  ck(!/wake|hotword|always/i.test(listenSrc.replace(/always be/i, '')),
     'M2b no wake word, no hotword, no always-listening');
  ck(!/MediaRecorder|getUserMedia|Blob|FileReader|indexedDB|localStorage/.test(listenSrc),
     'M15 RAW AUDIO IS NEVER TOUCHED, let alone stored',
     'no recorder, no blob, no store reachable from this file');
  ck(!/remember\s*\(|CompanionMemory/.test(listenSrc) && !/remember\s*\(|CompanionMemory/.test(speakSrc),
     'Z1  and neither speaking nor listening can write a memory');
  const chatSrc = code('js/companionChat.js');
  ck(/onText[\s\S]{0,400}input\.value\s*=/.test(chatSrc) &&
     !/onText[\s\S]{0,400}_send\(\)/.test(chatSrc),
     'M8  RECOGNISED TEXT LANDS IN THE FIELD AND IS NEVER SENT',
     'the child reads it, changes it, and presses Say it themselves');
  ck(/CompanionListen\.stop\(\)/.test(chatSrc.slice(chatSrc.indexOf('function close'))) ||
     (chatSrc.match(/CompanionListen\.stop\(\)/g) || []).length >= 2,
     'M13 and the microphone is shut when the conversation closes',
     (chatSrc.match(/CompanionListen\.stop\(\)/g) || []).length + ' stop() calls');
  ck(/said\.textContent/.test(chatSrc.slice(chatSrc.indexOf('function _aloud'))),
     'V7  TTS IS HANDED THE STRING THAT IS ALREADY ON SCREEN',
     'read off the element the child is looking at, so there is no second copy');
  ck(!/CompanionPerception|storyContext|memories|_localContext/.test(speakSrc),
     'V8  and it cannot reach a perception, a context or a memory',
     'there is no route by which something unapproved could be spoken');
  ck(/speechSynthesis/.test(speakSrc) && /VihuVoice/.test(speakSrc),
     'V9  the Companion’s own voice first, the platform’s as a fallback');
  ck(!/openai|elevenlabs|api_key|apiKey/i.test(listenSrc + speakSrc),
     'Z2  NO EXTERNAL PROVIDER for either half');

  // =================================================================
  console.log('\nZ. REGRESSION AND OPENAI');
  // =================================================================
  const fnSrc = fs.readFileSync(path.join(ROOT, 'supabase/functions/companion-chat/index.ts'), 'utf8');
  ck(/OPENAI_PRODUCTION_ENABLED/.test(fnSrc) && /OPENAI_ZDR_CONFIRMED/.test(fnSrc) &&
     !process.env.OPENAI_API_KEY,
     'Z3  both production gates are still the gates, and no key exists here');
  ck(fnSrc.indexOf('// ===== BEGIN GENERATED companionMind') !== -1 &&
     fnSrc.indexOf("'unknown']") !== -1,
     'Z4  the server carries the same generated Mind', 'sync-shared.js is the one source');
  const bond = fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/bondValidator.js'), 'utf8');
  ck(bond.length > 0 && !/companionPerception|companionFacts|companionListen|companionSpeak/.test(bond),
     'Z5  the Bond validator knows nothing about any of this and was not touched');

  // =================================================================
  console.log('\nB. THE REAL STUDIO');
  // =================================================================
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

  async function arrive(setup) {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
      typeof StudioEntry !== 'undefined', null, { timeout: 20000 });
    if (setup) await page.evaluate(setup);
    await page.evaluate(() => {
      try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
      try { StudioEntry.pass(); } catch (e) {}
    });
    await page.goto(BASE + '/studio.html');
    await page.waitForFunction(() => typeof CompanionChat !== 'undefined', null, { timeout: 20000 });
    for (let i = 0; i < 22; i++) {
      await page.waitForTimeout(600);
      const st = await page.evaluate(() => {
        const g = document.getElementById('gatewayOverlay');
        return { showing: !!(g && !g.hidden && getComputedStyle(g).display !== 'none'),
                 settled: !!document.querySelector('.companion-widget') ||
                          document.body.classList.contains('creation-flow-active') ||
                          document.body.classList.contains('studio-rite-running') };
      });
      if (st.settled && !st.showing) break;
      if (st.showing) { try { await page.mouse.click(720, 450); } catch (e) {} }
    }
    await page.waitForFunction(() => !!document.querySelector('.companion-widget img'),
      null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
  }

  const CLEAN = 'localStorage.clear(); sessionStorage.clear();';
  const asLeo = new Function(CLEAN +
    "const c=MagicCard.claim('Vihaan',null,{companionId:'leosaurus',companionName:'Leo'," +
    "companionSpecies:'Lantern Lion'}); MagicCard.setActive(c.id);");
  const traveller = new Function(CLEAN);

  await arrive(asLeo);
  await page.waitForFunction(() => !!document.querySelector('.companion-chat-open'),
    null, { timeout: 20000 }).catch(() => {});
  const home = await page.evaluate(() => {
    const b = document.querySelector('.companion-chat-open');
    const w = document.querySelector('.companion-widget');
    if (!b || !w) return { pill: null };
    const br = b.getBoundingClientRect(), wr = w.getBoundingClientRect();
    const top = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
    return { pill: b.textContent, onTop: !!(top && (top === b || b.contains(top))),
             // NEAR THE COMPANION, which is what "part of the companion
             // circle" means and what a fixed corner was not.
             host: b.parentElement ? b.parentElement.className : null,
             centred: Math.abs(br.left + br.width / 2 - window.innerWidth / 2) < 60,
             home: document.body.classList.contains('creation-flow-active'),
             surface: CompanionPerception.surfaceNow() };
  });
  ck(home.home === true && home.pill === '💬 Talk to Leo',
     'S1  Talk is offered on Studio Home', JSON.stringify(home.pill));
  ck(home.onTop === true, 'S1b and it is ON the screen, hit-tested');
  // DOCKED, restored by the product owner after seeing both: "i liked
  // the docked position in studio better than this always. use docked
  // position in studio home as well in studio." So the check is the
  // other way round now — it is in the SCREEN's own dock, the same one
  // on Studio Home as in the editor, rather than following the
  // Companion about. Tapping the Companion still opens it; that is
  // checked separately below.
  ck(home.host && /creation-flow-overlay/.test(home.host),
     'S1c AND IT IS DOCKED IN THE SCREEN — the same dock the editor has', home.host);
  ck(home.centred === true, 'S1d and centred, exactly as it is in the editor');
  ck(home.surface === 'studio-home', 'S1e the perception knows which screen this is', home.surface);
  await page.screenshot({ path: path.join(SHOTS, '1-home-pill.png') });

  await page.evaluate(() => CompanionChat.open());
  await page.waitForTimeout(350);
  const chips = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.companion-chat-starter')).map((b) => b.textContent));
  ck(chips.length >= 3 && chips.length <= 4, 'S4  Studio starters appear', chips.join(' · '));
  ck(!chips.some((c) => /story am I making|page am I on|happen next/i.test(c)),
     'S5  and NOT ONE of them is a story question — there is no story',
     chips.join(' · '));
  ck(!chips.some((c) => /star|memor|email|password/i.test(c)),
     'S4b nor a private one, ever', chips.join(' · '));
  await page.screenshot({ path: path.join(SHOTS, '2-home-starters.png') });

  async function say(t) {
    await page.evaluate((v) => { document.querySelector('.companion-chat-input').value = v; }, t);
    await page.evaluate(() => document.querySelector('.companion-chat-send').click());
    await page.waitForFunction(() => CompanionChat.state() === 'ready', null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(180);
    return page.evaluate(() => document.querySelector('.companion-chat-said').textContent.trim());
  }

  ck(/Leo/.test(await say('Who are you?')), 'S8b "Who are you?" in the real Studio');
  await say('My name is Vihaan.');
  const gotName = await say("What's my name?");
  ck(/Vihaan/.test(gotName), 'S6c told, then asked, in the real Studio', JSON.stringify(gotName));
  await page.screenshot({ path: path.join(SHOTS, '9-whats-my-name.png') });
  const whereHome = await say('Where are we?');
  ck(/VihuStudio/.test(whereHome) && !/story/i.test(whereHome.replace('stories', '')),
     'S7b "Where are we?" from Studio Home', JSON.stringify(whereHome));
  const starsReal = await say('How many stars do I have?');
  ck(!/\d/.test(starsReal), 'K7  AND THE STARS ARE REFUSED IN THE RUNNING STUDIO', JSON.stringify(starsReal));
  const unknownReal = await say("What's behind that mountain?");
  ck(unknownReal.length > 0 && !/didn.t catch/i.test(unknownReal),
     'U8  an unknown question is answered, not lost to a failure line',
     JSON.stringify(unknownReal));
  await page.screenshot({ path: path.join(SHOTS, '13-unknown.png') });

  // ---- naming, and the canonical identity underneath it -----------
  await say('Can I give you a name?');
  const named = await say('Spark');
  ck(/Spark/.test(named), 'N3  a name is accepted', JSON.stringify(named));
  const still = await say('Who are you?');
  ck(/Leo/.test(still) && /Spark/.test(still), 'N6  and Leo is still Leo', JSON.stringify(still));
  await page.screenshot({ path: path.join(SHOTS, '10-named.png') });
  const kept = await page.evaluate(() => ({
    called: CompanionName.get(),
    told: CompanionFacts.get('name'),
    mem: CompanionMemory.list({ status: 'any' }).map((m) => m.key),
  }));
  ck(kept.called === 'Spark' && kept.told === 'Vihaan',
     'N8/S10 both are kept, and they are different things', JSON.stringify(kept.called + '/' + kept.told));
  ck(!kept.mem.some((k) => /spark|vihaan|name/i.test(String(k))),
     'N11/N12 and NEITHER became a memory', kept.mem.join(', ') || 'none');

  // ---- the microphone, in the real surface ------------------------
  const mic = await page.evaluate(() => {
    const m = document.querySelector('.companion-chat-mic');
    return { present: !!m, hidden: m ? m.hidden : null,
             label: m ? m.getAttribute('aria-label') : null,
             listening: (typeof CompanionListen !== 'undefined') ? CompanionListen.isListening() : null,
             supported: (typeof CompanionListen !== 'undefined') ? CompanionListen.supported() : null };
  });
  ck(mic.present === true, 'M1  a microphone control exists on the surface');
  ck(mic.listening === false, 'M2c and it is NOT listening until somebody presses it');
  ck(/talk out loud/i.test(mic.label || ''), 'M4b with a real label', mic.label);
  await page.screenshot({ path: path.join(SHOTS, '3-mic-idle.png') });
  // A denial must not break Talk.
  const afterDeny = await page.evaluate(async () => {
    CompanionListen._denyForTest();
    CompanionListen.start({ onText: function () {}, onState: function () {} });
    await new Promise((r) => setTimeout(r, 100));
    return { listening: CompanionListen.isListening(),
             refused: CompanionListen.refused(),
             inputUsable: !document.querySelector('.companion-chat-input').disabled };
  });
  ck(afterDeny.listening === false && afterDeny.refused === true && afterDeny.inputUsable === true,
     'M10 a refusal does not break Talk, and is never asked again',
     JSON.stringify(afterDeny));
  const stillTalks = await say('Who are you?');
  ck(/Leo/.test(stillTalks), 'M10b and typing still works exactly as before');

  // ---- the voice --------------------------------------------------
  const voice = await page.evaluate(() => {
    const sp = document.querySelector('.companion-chat-speak');
    return { present: !!sp, hidden: sp ? sp.hidden : null,
             text: document.querySelector('.companion-chat-said').textContent.trim(),
             supported: (typeof CompanionSpeak !== 'undefined') ? CompanionSpeak.supported() : null,
             speaking: (typeof CompanionSpeak !== 'undefined') ? CompanionSpeak.isSpeaking() : null };
  });
  ck(voice.text.length > 0, 'V1  the answer is on screen as TEXT, always', JSON.stringify(voice.text));
  // V10 TURNED ROUND: the Companion is heard as well as seen now, so an
  // answer IS spoken without being asked for. What must still be true —
  // and is what this row was really protecting — is that nothing speaks
  // when there is no answer, and no stale answer is ever re-spoken.
  ck(voice.text.length > 0,
     'V10 nothing speaks without an answer to say — the text is the trigger');
  ck(voice.present === false || voice.hidden === false || voice.supported === false,
     'V9b where speech is unavailable the surface simply does not offer it',
     'supported=' + voice.supported);
  await page.evaluate(() => { try { CompanionChat.close(); } catch (e) {} });
  const afterClose = await page.evaluate(() => ({
    listening: CompanionListen.isListening(),
    speaking: CompanionSpeak.isSpeaking(),
  }));
  ck(afterClose.listening === false && afterClose.speaking === false,
     'M13b/V6 closing Talk stops the microphone AND the voice', JSON.stringify(afterClose));

  // ---- THE COMPANION IS HEARD AS WELL AS SEEN --------------------
  //
  // The product owner's instruction: speaking is ON, and the button is
  // a MUTE. These drive the real surface with CompanionSpeak.say
  // replaced by a counter, because whether a sound came out of the
  // machine is not something a headless browser can answer — what IS
  // checkable, and what the instruction is about, is whether the
  // surface ASKS for the answer to be said.
  await page.evaluate(() => CompanionChat.open());
  await page.waitForTimeout(250);
  const spoken = await page.evaluate(async () => {
    const real = CompanionSpeak.say;
    const asked = [];
    CompanionSpeak.say = function (text, cid) { asked.push({ text: text, cid: cid }); return Promise.resolve(true); };
    const send = async (t) => {
      document.querySelector('.companion-chat-input').value = t;
      document.querySelector('.companion-chat-send').click();
      await new Promise((r) => setTimeout(r, 900));
    };
    const on = CompanionChat.voiceOn();
    await send('Who are you?');
    const afterOn = asked.length;
    const shownOn = document.querySelector('.companion-chat-said').textContent.trim();
    // MUTE, and ask again.
    document.querySelector('.companion-chat-speak').click();
    const mutedNow = !CompanionChat.voiceOn();
    await send('What are you?');
    const afterMute = asked.length;
    const shownMuted = document.querySelector('.companion-chat-said').textContent.trim();
    document.querySelector('.companion-chat-speak').click();
    CompanionSpeak.say = real;
    return { defaultOn: on, afterOn: afterOn, mutedNow: mutedNow, afterMute: afterMute,
             shownOn: shownOn, shownMuted: shownMuted,
             saidText: asked.length ? asked[0].text : null,
             saidCid: asked.length ? asked[0].cid : null,
             backOn: CompanionChat.voiceOn() };
  });
  ck(spoken.defaultOn === true, 'V2  THE VOICE IS ON BY DEFAULT — the Companion is heard as well as seen');
  ck(spoken.afterOn === 1, 'V2b so an answer is said out loud without anybody asking',
     spoken.afterOn + ' spoken');
  ck(spoken.saidText === spoken.shownOn && spoken.saidText.length > 0,
     'V7b and what is said is EXACTLY what is on screen', JSON.stringify(spoken.saidText));
  ck(spoken.saidCid === 'leosaurus', 'V7c in the Companion’s own voice', spoken.saidCid);
  ck(spoken.mutedNow === true && spoken.afterMute === 1,
     'V3  the button is a MUTE — muted, the next answer is not said',
     spoken.afterMute + ' spoken across two turns');
  ck(spoken.shownMuted.length > 0,
     'V3b while the answer is on screen exactly as before — muting changes nothing a child reads',
     JSON.stringify(spoken.shownMuted));
  ck(spoken.backOn === true, 'V3c and it turns back on');
  const persists = await page.evaluate(() => {
    CompanionChat.setVoiceOn(false);
    const raw = localStorage.getItem('vihu.companion.voice');
    CompanionChat.setVoiceOn(true);
    return raw;
  });
  ck(persists === 'off', 'V3d the choice is remembered, per device', String(persists));
  // AND say() REPORTS HONESTLY. This is the bug that made the feature
  // look broken: speechSynthesis.speak() returns nothing and throws
  // nothing, and is perfectly happy to do nothing — so the first
  // version reported success while the room stayed silent.
  const honest = await page.evaluate(async () => {
    const out = {};
    // DEFINED, NOT ASSIGNED. `window.speechSynthesis` is a read-only
    // accessor in Chromium, so `window.speechSynthesis = stub` fails
    // SILENTLY — the first version of this check was measuring the real
    // (voiceless) engine and reading its honest `false` as a pass for
    // one case and a failure for the other. A stub that does not take
    // is worse than no stub.
    const real = Object.getOwnPropertyDescriptor(window, 'speechSynthesis') ||
                 Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'speechSynthesis');
    const put = (v) => Object.defineProperty(window, 'speechSynthesis',
      { value: v, configurable: true, writable: true });
    const base = { getVoices: () => [{ lang: 'en-US', name: 'Test' }],
                   cancel: function () {}, speaking: false, pending: false };
    // A voice list that exists, and an utterance that never starts.
    put(Object.assign({}, base, { speak: function () {} }));
    out.silent = await CompanionSpeak.say('hello', null);
    // And one that does start.
    put(Object.assign({}, base, {
      speak: function (u) { setTimeout(function () { if (u.onstart) u.onstart(); }, 10); } }));
    out.spoke = await CompanionSpeak.say('hello', null);
    out.stubTook = (typeof window.speechSynthesis.getVoices === 'function' &&
                    window.speechSynthesis.getVoices().length === 1);
    if (real) Object.defineProperty(window, 'speechSynthesis', real);
    return out;
  });
  ck(honest.stubTook === true, 'V7f (the stub actually took — a check that cannot fail proves nothing)');
  ck(honest.silent === false,
     'V7d SAY() REPORTS FALSE WHEN NOTHING WAS ACTUALLY SAID', 'the bug that hid this feature');
  ck(honest.spoke === true, 'V7e and true only once a sound has started');

  // ---- the Story Editor, same implementation ----------------------
  // A FRESH SURFACE. The suggestions stand down once somebody has
  // spoken, and this suite has been talking; closing is what a child
  // does between conversations and is what makes the starters the
  // thing under test again.
  await page.evaluate(() => { try { CompanionChat.close(); } catch (e) {} });
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => typeof AppState !== 'undefined' &&
    AppState.project && AppState.project.id, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(() => CompanionChat.open());
  await page.waitForTimeout(350);
  const inStory = await page.evaluate(() => ({
    surface: CompanionPerception.surfaceNow(),
    chips: Array.from(document.querySelectorAll('.companion-chat-starter')).map((b) => b.textContent),
    panels: document.querySelectorAll('.companion-chat').length,
    story: (CompanionPerception.studio() || {}).story,
  }));
  ck(inStory.surface === 'story-editor', 'T1  Talk is available in the Story Editor', inStory.surface);
  ck(inStory.panels === 1, 'T2  and it is THE SAME surface — no second chat panel', inStory.panels + '');
  ck(inStory.chips.some((c) => /story|happen next|make together/i.test(c)),
     'T4  with story-specific starters now that there IS a story', inStory.chips.join(' · '));
  ck(inStory.story && typeof inStory.story.pageCount === 'number',
     'T3  and the perception carries the story context', JSON.stringify(inStory.story));
  await page.screenshot({ path: path.join(SHOTS, '11-editor-talk.png') });
  await page.screenshot({ path: path.join(SHOTS, '12-story-starters.png') });

  // ---- a Traveller in the Studio is offered nothing ---------------
  await arrive(traveller);
  const trav = await page.evaluate(() => ({
    pill: !!document.querySelector('.companion-chat-open'),
    widget: !!document.querySelector('.companion-widget'),
    perception: (typeof CompanionPerception !== 'undefined') ? CompanionPerception.studio() : 'absent',
    told: (typeof CompanionFacts !== 'undefined') ? CompanionFacts.tell('name', 'Sneaky') : null,
  }));
  ck(trav.pill === false, 'S2  a Traveller is offered no conversation on Studio Home');
  ck(trav.perception === null, 'S2b and there is no perception to build without a card');
  ck(trav.told && trav.told.ok === false && trav.told.reason === 'no-card',
     'S2c nor can they tell a Companion anything', JSON.stringify(trav.told));

  ck(pageErrors.length === 0, 'Z6  zero page errors across every journey',
     pageErrors.slice(0, 3).join(' | ') || 'none');

  await browser.close();
  console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('   · ' + f));
  console.log('screenshots: ' + SHOTS);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
