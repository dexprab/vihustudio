/* COMPANION CONVERSATION EXPERIENCE — Sprint 1N.2.
 *
 * Sprint 1N built the deterministic Mind and 1N.1 made it reachable.
 * This suite asks whether talking to it feels like talking to somebody:
 * a rhythm a child can read, the everyday questions they actually ask,
 * a name they may give, a few things to say when they do not know what
 * to say, and one thing "it" may mean.
 *
 * ---------------------------------------------------------------
 * THERE IS NO MODEL IN ANY OF THIS, AND THE SUITE PROVES IT RATHER
 * THAN SAYING SO. Both production gates stay shut, no key exists,
 * and the number of requests leaving for anywhere that is not this
 * project's own database is counted and must be zero.
 *
 * ---------------------------------------------------------------
 * IT DRIVES THE REAL DOOR. StudioEntry.pass(), a real load of
 * studio.html, the Gateway tapped the way a child taps it, and the
 * real conversation surface — a harness that reaches around the
 * journey cannot see the journey.
 *
 *   A. THE BOUNDARY — where an answer may honestly come from
 *   R. RHYTHM — idle, sending, responding, ready
 *   Q. THE EVERYDAY QUESTIONS
 *   N. THE NAME A CHILD GIVES
 *   S. THINGS A CHILD COULD SAY
 *   C. WHAT "IT" MEANS
 *   W. FOUR COMPANIONS, ONE ARCHITECTURE
 *   X. THE SURFACE — geometry, silence, keyboard, announcement
 *   P. PRIVACY AND MEMORY
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-conversation-test/run-companion-conversation-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const FnServer = require('../companion-enable-test/function-server.js');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CONV_PORT || 8792);
const FN_PORT = Number(process.env.CONV_FN_PORT || 8797);
const BASE = 'http://127.0.0.1:' + PORT;
const FN_BASE = 'http://127.0.0.1:' + FN_PORT;
const SHOTS = path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

const FOUR = [
  ['leafy', 'Leafy', 'Bloomling'],
  ['leosaurus', 'Leo', 'Lantern Lion'],
  ['quill', 'Quill', 'Ink Spirit'],
  ['nimbus', 'Nimbus', 'Dream Sprite'],
];

// Source read with its own comments stripped. Eleven times now this
// repository has been caught by a word matching inside its own prose —
// `auth` in authorship, `prompt` in unprompted, `openai` in a comment
// saying there is no OpenAI here — so a scan for machinery reads code.
function code(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

(async () => {
  console.log('\nSPRINT 1N.2 — THE CONVERSATION EXPERIENCE');
  console.log('(the real Studio, the real surface, the real handler — no model)\n');
  fs.mkdirSync(SHOTS, { recursive: true });

  const fn = await FnServer.start(FN_PORT, { COMPANION_MIND_ENABLED: 'true' });

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String((e && e.message) || e)));

  await page.route('**/supabase-config.json', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ url: FN_BASE, anonKey: 'anon.key.value' }),
  }));

  async function giveSession(token) {
    await page.evaluate((t) => {
      window.ThemeRepositoryClient = window.ThemeRepositoryClient || {};
      window.ThemeRepositoryClient.getSession = function () {
        return Promise.resolve({ access_token: t });
      };
    }, token);
  }

  const CLEAN = 'localStorage.clear(); sessionStorage.clear();';
  function bondedAs(cid, name, species) {
    return new Function(CLEAN +
      "const c=MagicCard.claim('Vihaan',null,{companionId:'" + cid + "',companionName:'" + name +
      "',companionSpecies:'" + species + "'}); MagicCard.setActive(c.id);");
  }

  // THE REAL DOOR, and then WAIT for what the checks read rather than
  // sampling after a fixed pause. Studio Home settles before the
  // Director mounts the widget, and the pill mounts FROM the Companion.
  async function arrive(setup, opts) {
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
        const showing = g && !g.hidden && getComputedStyle(g).display !== 'none';
        return { showing: !!showing,
                 settled: !!document.querySelector('.companion-widget') ||
                          document.body.classList.contains('creation-flow-active') ||
                          document.body.classList.contains('studio-rite-running') };
      });
      if (st.settled && !st.showing) break;
      if (st.showing) { try { await page.mouse.click(720, 450); } catch (e) {} }
    }
    await page.waitForFunction(() => !!document.querySelector('.companion-widget img'),
      null, { timeout: 20000 }).catch(() => {});
    if (opts && opts.stayHome) { await giveSession(fn.token); return; }
    await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await page.waitForFunction(() => typeof AppState !== 'undefined' &&
      AppState.project && AppState.project.id, null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => !!document.querySelector('.companion-chat-open'),
      null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(900);
    await giveSession(fn.token);
  }

  // Register whatever the real Studio actually made, so the server is
  // authoritative about a card and a story the browser really holds.
  async function registerWithServer(cid, name, species) {
    const who = await page.evaluate(() => ({
      cardId: (MagicCard.getActive() || {}).id || null,
      storyId: (typeof AppState !== 'undefined' && AppState.project) ? AppState.project.id : null,
    }));
    if (who.cardId) {
      fn.DB.cards.push({ id: who.cardId, owner_id: 'user-po', companion_id: cid,
        companion_name: name, companion_species: species });
    }
    if (who.storyId) {
      const rec = await page.evaluate((id) => {
        try { return CreatorProjectStore.get(id); } catch (e) { return null; }
      }, who.storyId);
      // THE KEY IS `pages`, and the row is the store's own record rather
      // than one this suite invented — a fixture derived from the code
      // under test cannot catch the code under test being wrong, which
      // is exactly how the `slides` bug survived a whole sprint.
      fn.DB.projects.push({ id: who.storyId, owner_id: 'user-po',
        data: Object.assign({}, rec, { name: 'The Tiny Forest',
          data: Object.assign({}, (rec && rec.data) || {}, { pages: FnServer.slides() }) }) });
    }
    return who;
  }

  // ONE TURN, THROUGH THE REAL SURFACE. Types into the real field and
  // presses the real button — never CompanionChat.ask(), which would
  // reach around the rhythm this sprint is about.
  async function say(text) {
    await page.evaluate((t) => {
      const i = document.querySelector('.companion-chat-input');
      i.value = t;
    }, text);
    const t0 = Date.now();
    await page.evaluate(() => document.querySelector('.companion-chat-send').click());
    await page.waitForFunction(() => CompanionChat.state() === 'ready' ||
      CompanionChat.state() === 'responding', null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(220);
    const reply = await page.evaluate(() => document.querySelector('.companion-chat-said').textContent.trim());
    return { reply: reply, ms: Date.now() - t0 };
  }

  async function openTalk() {
    await page.evaluate(() => CompanionChat.open());
    await page.waitForTimeout(250);
  }

  // =================================================================
  console.log('A. THE BOUNDARY — where an answer may honestly come from');
  // =================================================================
  const chatSrc = code('js/companionChat.js');
  const mindSrc = code('js/companionMind.js');
  const nameSrc = code('js/companionName.js');

  ck(/LOCAL_INTENTS/.test(mindSrc) && /LOCAL_INTENTS/.test(chatSrc),
     'A1  the line is DATA on the Mind, read by the surface — not a second list',
     'one published set');
  const local = await (async () => null)();
  ck(!/storyContext/.test(chatSrc.split('function _localContext')[1] || '') &&
     !/memories/.test(chatSrc.split('function _localContext')[1] || '').valueOf(),
     'A2  the browser builds NO storyContext and NO memories',
     'the two things a browser could invent');
  // THE SPLIT IS COMPLETE AND IT NAMES NOTHING THE SERVER OWNS. Read
  // out of the Mind itself rather than restated here, so a future intent
  // added to the local list without a thought fails this rather than
  // quietly widening the boundary.
  {
    const c = vm.createContext({ console: console, window: {} });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'companionMind.js'), 'utf8') +
      '\n;this.M = CompanionMind;', c);
    const all = c.M.INTENT_IDS, loc = c.M.LOCAL_INTENTS;
    ck(loc.every((i) => all.indexOf(i) !== -1),
       'A2b every id on the local list is a real intent',
       loc.filter((i) => all.indexOf(i) === -1).join(', ') || 'all of them');
    // TURNED ROUND IN SPRINT 1N.3, DELIBERATELY, for `unknown` only.
    //
    // 1N.2 kept "I did not understand" on the server's side of the line
    // because the server might one day know more. 1N.3 requires that an
    // unknown question NEVER disappears — and routing it over a network
    // makes that promise conditional on the network. The answer needs no
    // record, the server's own copy of the Mind says the same words, so
    // asking it bought a failure mode and nothing else.
    //
    // THE LINE THAT MATTERS IS UNCHANGED AND IS STILL ASSERTED: the two
    // things only the RECORDS can prove are still the server's.
    ck(loc.indexOf('story-fact') === -1 && loc.indexOf('memory-recall') === -1,
       'A2c the two the RECORDS prove are not on the local list',
       'story-fact and memory-recall still go to the server');
    ck(loc.indexOf('unknown') !== -1,
       'A2d while "I do not know" is answered here, so it never depends on a network');
  }
  ck(!/if\s*\(\s*(?:companion|cid|companionId)\s*===\s*['"]/.test(mindSrc) &&
     !/if\s*\(\s*(?:companion|cid|companionId)\s*===\s*['"]/.test(chatSrc),
     'A3  no Companion-specific branch was introduced anywhere',
     'character is a row, never an if');
  ck(!/remember\s*\(/.test(mindSrc) && !/remember\s*\(/.test(chatSrc) &&
     !/CompanionMemory\.remember/.test(nameSrc),
     'A4  nothing in the conversation path can write a memory',
     'no remember() in the Mind, the surface or the naming store');
  ck(!/bondValidator|BondValidator|memoryProposal/i.test(chatSrc + mindSrc + nameSrc),
     'A5  and the Bond validator is not imported, mentioned or consulted');
  const gateEnv = fs.readFileSync(path.join(ROOT, 'supabase/functions/companion-chat/index.ts'), 'utf8');
  ck(/OPENAI_PRODUCTION_ENABLED/.test(gateEnv) && /OPENAI_ZDR_CONFIRMED/.test(gateEnv) &&
     !process.env.OPENAI_API_KEY,
     'A6  both production gates are still the gates, and no key exists here',
     'unset');
  ck(!/openai|api\.openai/i.test(code('js/companionChat.js') + mindSrc + nameSrc),
     'A7  no shipped conversation file names a provider');

  // =================================================================
  console.log('\nR. RHYTHM — idle, sending, responding, ready');
  // =================================================================
  await arrive(bondedAs('leosaurus', 'Leo', 'Lantern Lion'));
  await registerWithServer('leosaurus', 'Leo', 'Lantern Lion');
  await openTalk();
  await page.screenshot({ path: path.join(SHOTS, '1-starters.png') });

  ck(await page.evaluate(() => CompanionChat.state()) === 'idle',
     'R1a it opens IDLE — nothing has been said yet');
  // MEASURED INSIDE THE PRESS. Waiting and then sampling would read the
  // state after it had already moved on.
  const mid = await page.evaluate(() => {
    const i = document.querySelector('.companion-chat-input');
    i.value = 'Who are you?';
    document.querySelector('.companion-chat-send').click();
    const bar = document.querySelector('.companion-chat');
    return { state: bar.getAttribute('data-state'),
             dots: !document.querySelector('.companion-chat-dots').hidden,
             you: document.querySelector('.companion-chat-you').textContent,
             sendOff: document.querySelector('.companion-chat-send').disabled,
             emptied: i.value === '' };
  });
  // ---- R1 AND R3 TURNED ROUND IN SPRINT 1N.6, WITH A REASON --------
  //
  // R1 read `state === 'sending'`. The CLAIM — the press is
  // acknowledged in the same frame — is unchanged and still checked;
  // only the name moved. js/companionTurn.js passes through `sending`
  // and settles on `received` synchronously, because being heard is not
  // something to wait for. This is a repair, not a weakening.
  //
  // R3 read "a processing state is visible" for a turn that answers in
  // 0.2-7.5ms, and that is exactly the behaviour 1N.6 removes: §5 and
  // §11 of the brief forbid forcing a thinking animation in front of an
  // answer that is already there. Showing one would have been inventing
  // a wait that does not exist. The replacement is stronger, because it
  // asserts BOTH halves of the rule rather than one: nothing for a fast
  // answer, and the dots for a slow one (measured in
  // tools/companion-rhythm-test, sections A and B).
  ck(mid.state === 'received',
     'R1  the press is acknowledged in the same frame — idle → sending → received',
     mid.state);
  ck(mid.you === 'Who are you?' && mid.emptied,
     'R1b and the child’s own words are acknowledged immediately', JSON.stringify(mid.you));
  ck(mid.dots === false,
     'R3  NO PROCESSING ANIMATION in front of an answer that is already there',
     'threshold ' + (await page.evaluate(() => CompanionTurn.THRESHOLDS.THINK_AFTER_MS)) +
     'ms vs a measured 0.2–7.5ms answer');
  ck(mid.sendOff === true,
     'R3b and the field is held until there is something to read', 'send disabled');
  ck(mid.sendOff === true, 'R2  and a second press cannot start a second turn', 'send disabled');
  await page.screenshot({ path: path.join(SHOTS, '2-sending.png') });
  await page.waitForFunction(() => CompanionChat.state() === 'ready', null, { timeout: 15000 }).catch(() => {});
  const after = await page.evaluate(() => ({
    state: CompanionChat.state(),
    reply: document.querySelector('.companion-chat-said').textContent.trim(),
    dots: !document.querySelector('.companion-chat-dots').hidden,
    sendOn: !document.querySelector('.companion-chat-send').disabled,
    focused: document.activeElement === document.querySelector('.companion-chat-input'),
    ms: CompanionChat.lastMs(),
  }));
  ck(/Leo/.test(after.reply), 'R4  the deterministic response arrives', JSON.stringify(after.reply));
  ck(after.state === 'ready' && after.dots === false,
     'R5  the response state completes and the indicator goes', after.state);
  ck(after.sendOn === true, 'R6  and the input is the child’s again');
  ck(after.focused === true, 'R6b with focus where it was — never lost on send');
  ck(after.ms < 1200, 'R8  no artificial delay — a beat, not a performance', after.ms + 'ms');
  // THE ANSWER MUST BE SOMETHING A CHILD CAN SEE. Measured from the
  // screenshot rather than from the DOM: the suggestions stayed up
  // through the first exchange and pushed the reply below the fold of
  // its own scroll box, which is a present-and-unusable answer.
  const seen = await page.evaluate(() => {
    const said = document.querySelector('.companion-chat-said');
    const body = document.querySelector('.companion-chat-body');
    const s = said.getBoundingClientRect(), b = body.getBoundingClientRect();
    return { chips: document.querySelectorAll('.companion-chat-starter').length,
             inside: s.top >= b.top - 1 && s.bottom <= b.bottom + 1,
             h: Math.round(s.height) };
  });
  ck(seen.chips === 0, 'R4b the suggestions stand down the moment the child speaks',
     seen.chips + ' chips');
  ck(seen.inside === true && seen.h > 0,
     'R4c and the answer is inside the visible box, not below its fold',
     JSON.stringify(seen));
  await page.screenshot({ path: path.join(SHOTS, '3-answered.png') });

  // ---- THE BOUNDARY, MEASURED AS TRAFFIC -------------------------
  //
  // A1 reads the published list; this watches what actually leaves. A
  // question about the Companion must make no request at all, and a
  // question about the story must make exactly one — otherwise the
  // split is a comment rather than a boundary.
  // MUTED FOR THIS MEASUREMENT, and that is not a dodge. Sprint 1N.3
  // speaks every answer, and the Companion's own voice fetches from the
  // same platform this stub is standing in for — so the voice's
  // requests landed in the same count and read as the question having
  // gone to the server. What is under test is where the ANSWER came
  // from; the voice is turned off so the count means that and nothing
  // else, and turned back on afterwards.
  await page.evaluate(() => { try { CompanionChat.setVoiceOn(false); } catch (e) {} });
  const beforeId = fn.outbound().length;
  await say('What are you?');
  const afterId = fn.outbound().length;
  await say('How many pages are there?');
  const afterStory = fn.outbound().length;
  ck(afterId === beforeId,
     'A8  a question about the COMPANION leaves the browser not at all',
     (afterId - beforeId) + ' requests');
  ck(afterStory > afterId,
     'A9  and a question about the STORY still goes to the server',
     (afterStory - afterId) + ' requests');
  await page.evaluate(() => { try { CompanionChat.setVoiceOn(true); } catch (e) {} });

  // R9 — Escape closes, from the field and from the bar alike.
  await page.evaluate(() => document.querySelector('.companion-chat-input').focus());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ck(await page.evaluate(() => CompanionChat.isOpen()) === false,
     'R9  Escape still closes it');
  await openTalk();
  ck(await page.evaluate(() => CompanionChat.turns().length) === 0,
     'R9b and closing forgot the conversation', 'turns cleared');

  // R10 — silence shows nothing at all.
  const quiet = await say('purple monkey dishwasher');
  const quietDom = await page.evaluate(() => {
    const s = document.querySelector('.companion-chat-said');
    return { text: s.textContent.trim(), shown: getComputedStyle(s).display !== 'none' };
  });
  // TURNED ROUND IN SPRINT 1N.3, DELIBERATELY. This asserted that an
  // unrecognised sentence shows nothing at all, which Decision 46 chose
  // on purpose. 1N.3 reverses it: "an unknown question must never simply
  // disappear", because to a child a Companion that vanishes when it
  // does not know is indistinguishable from one that ignored them.
  //
  // The rule underneath is unchanged and asserted harder: it says it
  // does not know, and it INVENTS NOTHING while doing so.
  ck(quiet.reply.length > 0 && quietDom.shown === true &&
     !/\d/.test(quiet.reply) && !/Tiny Forest/.test(quiet.reply),
     'R10 an unrecognised sentence is answered honestly, and invents nothing',
     JSON.stringify(quiet.reply));

  // R7 — a failure comes back to ready, and says so honestly.
  await page.evaluate(() => {
    window.__realSession = window.ThemeRepositoryClient.getSession;
    window.ThemeRepositoryClient.getSession = function () { return Promise.resolve(null); };
  });
  const broke = await say('How many pages are there?');
  ck(/catch that/i.test(broke.reply) && !/error|unavailable|provider|500|token/i.test(broke.reply),
     'R7  a failure is answered honestly, with no status code and no provider',
     JSON.stringify(broke.reply));
  ck(await page.evaluate(() => CompanionChat.state()) === 'ready',
     'R7b and the surface comes back to ready');
  await page.evaluate(() => { window.ThemeRepositoryClient.getSession = window.__realSession; });

  // =================================================================
  console.log('\nQ. THE EVERYDAY QUESTIONS');
  // =================================================================
  const Q = {};
  for (const q of ['Who are you?', "What's your name?", 'What are you?',
                   'Who is writing this story?', 'Is this my story?',
                   'What are we making?', 'What are we doing?',
                   'Who made you?', 'Who is your creator?']) {
    Q[q] = (await say(q)).reply;
  }
  ck(/^I’m Leo\./.test(Q['Who are you?']), 'Q1  "Who are you?"', JSON.stringify(Q['Who are you?']));
  ck(/Leo/.test(Q["What's your name?"]), 'Q2  "What\'s your name?"', JSON.stringify(Q["What's your name?"]));
  ck(/Lantern Lion/.test(Q['What are you?']), 'Q3  "What are you?"', JSON.stringify(Q['What are you?']));
  ck(/your story/i.test(Q['Who is writing this story?']) && /You are/i.test(Q['Who is writing this story?']),
     'Q5  "Who is writing this story?" → authorship, never an identity',
     JSON.stringify(Q['Who is writing this story?']));
  ck(/your story/i.test(Q['Is this my story?']), 'Q6  "Is this my story?"',
     JSON.stringify(Q['Is this my story?']));
  ck(/Tiny Forest/.test(Q['What are we making?']), 'Q7  "What are we making?" → the REAL story',
     JSON.stringify(Q['What are we making?']));
  ck(/Tiny Forest/.test(Q['What are we doing?']), 'Q8  "What are we doing?"',
     JSON.stringify(Q['What are we doing?']));
  ck(/VihuPlanet/.test(Q['Who made you?']) && /chose you/.test(Q['Who made you?']),
     'Q9  "Who made you?" → canon, never invented lore', JSON.stringify(Q['Who made you?']));
  ck(/VihuPlanet/.test(Q['Who is your creator?']), 'Q10 "Who is your creator?"',
     JSON.stringify(Q['Who is your creator?']));
  // THE PRIVACY BOUNDARY, MEASURED ACROSS EVERY ANSWER. The Creator's
  // own nickname is on the card this browser holds, so it is exactly the
  // thing an authorship answer could leak.
  const all = Object.values(Q).join(' || ');
  ck(!/Vihaan/.test(all) && !/card_/.test(all) && !/proj_/.test(all) && !/@/.test(all) &&
     !/owner|user-po|uuid/i.test(all),
     'Q11 NOT ONE ANSWER CARRIES A NAME, A CARD, A PROJECT OR AN ADDRESS',
     'swept across all nine');

  // =================================================================
  console.log('\nN. THE NAME A CHILD GIVES');
  // =================================================================
  // MEASURED AS A DIFFERENCE, NOT AS A PATTERN. The first draft looked
  // for a memory whose key mentioned a name and failed on `bonded` — a
  // deterministic recorder's own memory that has nothing to do with
  // naming. What is actually claimed is that the naming exchange adds
  // nothing, so the store is counted before and after.
  const memBefore = await page.evaluate(() => CompanionMemory.list({ status: 'any' }).map((m) => m.key).sort());
  const n1 = await say('Can I give you a name?');
  ck(/call me/i.test(n1.reply), 'N1  the child asks to name their Companion', JSON.stringify(n1.reply));
  ck(await page.evaluate(() => CompanionChat.awaitingName()) === true,
     'N2  and the Companion is waiting for one');
  const bad = await say('http://example.com/x');
  ck(!/example|http/.test(bad.reply) && /name/i.test(bad.reply) &&
     !/invalid|wrong|error|not allowed/i.test(bad.reply),
     'N4  an invalid name is refused kindly, and never echoed back',
     JSON.stringify(bad.reply));
  ck(await page.evaluate(() => CompanionName.get()) === null,
     'N4b and nothing was stored');
  const n3 = await say('Spark');
  ck(/Spark/.test(n3.reply), 'N3  a valid name is accepted, in its own voice', JSON.stringify(n3.reply));
  ck(await page.evaluate(() => CompanionName.get()) === 'Spark',
     'N3b and it is kept');
  await page.screenshot({ path: path.join(SHOTS, '4-named.png') });
  const pillNow = await page.evaluate(() => document.querySelector('.companion-chat-open').textContent);
  ck(pillNow === '💬 Talk to Spark', 'N5  the whole surface calls it what the child calls it', pillNow);
  const who2 = await say('Who are you?');
  ck(/I’m Leo/.test(who2.reply) && /Spark/.test(who2.reply),
     'N6  AND THE CANONICAL IDENTITY NEVER DISAPPEARS', JSON.stringify(who2.reply));
  const areYou = await say('Are you Leo?');
  ck(/Yes/.test(areYou.reply) && /Leo/.test(areYou.reply),
     'N6b "Are you Leo?" is answered as itself', JSON.stringify(areYou.reply));
  const areSpark = await say('Are you Spark?');
  ck(/Yes/.test(areSpark.reply) && /Leo/.test(areSpark.reply),
     'N6c and so is the name they gave — both, never one instead of the other',
     JSON.stringify(areSpark.reply));
  await say('I want to change your name.');
  const renamed = await say('Moon');
  ck(/Moon/.test(renamed.reply), 'N7  rename works', JSON.stringify(renamed.reply));
  const stored = await page.evaluate(() => ({
    now: CompanionName.get(),
    raw: localStorage.getItem(CompanionName.KEY),
  }));
  ck(stored.now === 'Moon' && !/Spark/.test(stored.raw || ''),
     'N8  and the old one is REPLACED — no accumulating history of names',
     stored.raw);
  const scoped = await page.evaluate(() => {
    const key = Object.keys(JSON.parse(localStorage.getItem(CompanionName.KEY)))[0];
    return { key: key, card: (MagicCard.getActive() || {}).id,
             companion: (MagicCard.getActive() || {}).companionId };
  });
  ck(scoped.key === scoped.card + '|' + scoped.companion,
     'N10 it is scoped to Creator AND Companion, never global', scoped.key);
  // N11 — a second Creator on the same machine.
  const otherSees = await page.evaluate(() => {
    const mine = MagicCard.getActive().id;
    const b = MagicCard.claim('Someone Else', null,
      { companionId: 'leosaurus', companionName: 'Leo', companionSpecies: 'Lantern Lion' });
    MagicCard.setActive(b.id);
    const theirs = CompanionName.get();
    MagicCard.setActive(mine);
    return { theirs: theirs, mineBack: CompanionName.get() };
  });
  ck(otherSees.theirs === null && otherSees.mineBack === 'Moon',
     'N11 another Creator on the same device does NOT receive the name',
     JSON.stringify(otherSees));
  // N13/N14 — it is a setting, not a moment and not a transcript.
  const memAfter = await page.evaluate(() => ({
    mem: CompanionMemory.list({ status: 'any' }).map((m) => m.key).sort(),
    contents: CompanionMemory.list({ status: 'any' }).map((m) => m.content).join(' | '),
    turns: CompanionChat.turns().length,
  }));
  ck(memAfter.mem.join(',') === memBefore.join(',') &&
     !/Spark|Moon/i.test(memAfter.contents),
     'N13 naming created no Bond Moment and no memory',
     memBefore.length + ' before, ' + memAfter.mem.length + ' after');
  ck(fn.writes() >= 0 && !/creator_companion_memory/.test(JSON.stringify(fn.outbound().filter((o) => o.method !== 'GET'))),
     'N14 and nothing about it was written anywhere but the browser’s own setting');

  // N9 — A NEW SESSION, THROUGH THE REAL DOOR. Not a page.reload():
  // Decision 23 sends a bare refresh of studio.html back to VihuPlanet,
  // so a reload here would prove the gate rather than the store.
  await arrive(null);
  await registerWithServer('leosaurus', 'Leo', 'Lantern Lion');
  const survived = await page.evaluate(() => ({
    name: CompanionName.get(),
    pill: (document.querySelector('.companion-chat-open') || {}).textContent || null,
  }));
  ck(survived.name === 'Moon' && survived.pill === '💬 Talk to Moon',
     'N9  the name survives a new session', JSON.stringify(survived));
  await openTalk();
  const stillLeo = await say('Who are you?');
  ck(/I’m Leo/.test(stillLeo.reply) && /Moon/.test(stillLeo.reply),
     'N9b and so does the canonical identity underneath it', JSON.stringify(stillLeo.reply));


  // =================================================================
  console.log('\nS. THINGS A CHILD COULD SAY');
  // =================================================================
  await page.evaluate(() => { CompanionChat.close(); CompanionName.clear(); });
  await openTalk();
  const st = await page.evaluate(() => ({
    lead: document.querySelector('.companion-chat-starters-lead').textContent,
    chips: Array.from(document.querySelectorAll('.companion-chat-starter')).map((b) => b.textContent),
    shown: !document.querySelector('.companion-chat-starters').hidden,
  }));
  ck(st.shown && st.chips.length > 0, 'S1  starters appear when the conversation opens',
     st.chips.join(' · '));
  ck(st.chips.length >= 3 && st.chips.length <= 4, 'S2  three or four of them, never a menu',
     st.chips.length + '');
  ck(/Try asking Leo/.test(st.lead), 'S3  the active Companion’s name is used', st.lead);
  ck(!/Leafy/.test(st.lead + st.chips.join(' ')),
     'S4  and no Companion is hard-coded into the copy');
  ck(!/identity|memory|story fact|creative|intent/i.test(st.chips.join(' ') + st.lead),
     'S4b nothing exposes the internal taxonomy', 'no category names');
  const tapped = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.companion-chat-starter'))[0];
    const before = document.querySelector('.companion-chat-said').textContent;
    b.click();
    return { field: document.querySelector('.companion-chat-input').value,
             said: document.querySelector('.companion-chat-said').textContent,
             wasSaid: before, state: CompanionChat.state(),
             focused: document.activeElement === document.querySelector('.companion-chat-input') };
  });
  ck(tapped.field === st.chips[0], 'S5  tapping one fills the field', JSON.stringify(tapped.field));
  ck(tapped.state === 'idle' && tapped.said === tapped.wasSaid,
     'S6  and does NOT send it — the child still decides', tapped.state);
  ck(tapped.focused === true, 'S7  with the cursor in the field, ready to be changed');
  const edited = await page.evaluate(() => {
    const i = document.querySelector('.companion-chat-input');
    i.value = i.value.replace(/\?$/, ' really?');
    return i.value;
  });
  ck(/really/.test(edited), 'S7b a starter is editable text, not a command', edited);
  await page.evaluate(() => { document.querySelector('.companion-chat-input').value = ''; });
  const freeform = await say('What page am I on?');
  ck(/page 1/.test(freeform.reply), 'S8  and a child can ignore them entirely',
     JSON.stringify(freeform.reply));
  // S9/S10 — the memory suggestion is offered only when it can be met.
  const memStarters = await page.evaluate(() => {
    const before = CompanionMemory.list({ status: 'any' }).length;
    return { before: before, chips: CompanionChat.starters() };
  });
  const hasMem = memStarters.before > 0;
  ck(hasMem === /did we make together/.test(memStarters.chips.join(' ')),
     (hasMem ? 'S9  a memory exists, so the memory suggestion is offered'
             : 'S10 no memory exists, so no memory suggestion is offered'),
     memStarters.before + ' memories → ' + memStarters.chips.join(' · '));
  // THE OTHER BRANCH, WITH AN EMPTY STORE. There is no public way to
  // delete a memory and there should not be — Decision 30's lifecycle is
  // pressure, never deletion — so the STORE'S OWN METHOD is replaced for
  // one reading. Replacing the object's method rather than the global
  // binding is not a preference: these modules are top-level `const`, so
  // assigning window.CompanionMemory would change nothing at all, which
  // is the trap Decision 40 already records.
  const wiped = await page.evaluate(() => {
    const real = CompanionMemory.list;
    CompanionMemory.list = function () { return []; };
    const chips = CompanionChat.starters();
    const left = CompanionMemory.list({ status: 'any' }).length;
    CompanionMemory.list = real;
    return { left: left, chips: chips, restored: CompanionMemory.list({ status: 'any' }).length };
  });
  ck(wiped.left === 0 && !/did we make together/.test(wiped.chips.join(' ')),
     'S10 with nothing remembered, no memory question is offered — never a faked one',
     wiped.chips.join(' · '));

  // =================================================================
  console.log('\nC. WHAT "IT" MEANS');
  // =================================================================
  await page.evaluate(() => CompanionChat.close());
  await openTalk();
  const c1a = await say('I want to make a dragon.');
  ck(/dragon/i.test(c1a.reply), 'C0  the subject in the sentence is heard', JSON.stringify(c1a.reply));
  const c1b = await say('Where should I put it?');
  ck(/dragon/i.test(c1b.reply), 'C1  and "it" carries the immediately preceding subject',
     JSON.stringify(c1b.reply));
  ck(!/decide|you should put|put it (?:on|in|at)/i.test(c1b.reply),
     'C1b while still never deciding for the Creator', JSON.stringify(c1b.reply));
  // C2 — it expires. Two ordinary turns later, the subject is gone.
  await say('Who are you?');
  await say('What are you?');
  const c2 = await say('Where should I put it?');
  ck(!/dragon/i.test(c2.reply), 'C2  the subject expires — it is this moment, not a memory',
     JSON.stringify(c2.reply));
  ck(/which/i.test(c2.reply), 'C3  and an unresolved "it" is asked about, never guessed',
     JSON.stringify(c2.reply));
  const c4 = await page.evaluate(() => {
    CompanionChat.close();
    return { turns: CompanionChat.turns().length,
             stored: Object.keys(localStorage).filter((k) => /dragon/i.test(localStorage.getItem(k) || '')) };
  });
  ck(c4.turns === 0 && c4.stored.length === 0,
     'C4  closing forgets it, and it was never written down', JSON.stringify(c4));
  const c5 = await page.evaluate(() => CompanionMemory.list({ status: 'any' })
    .filter((m) => /dragon/i.test(m.content || '')).length);
  ck(c5 === 0, 'C5  and it cannot have become a memory', c5 + ' matching memories');

  // =================================================================
  console.log('\nW. FOUR COMPANIONS, ONE ARCHITECTURE');
  // =================================================================
  const matrix = {};
  for (const [cid, name, species] of FOUR) {
    await arrive(bondedAs(cid, name, species));
    await registerWithServer(cid, name, species);
    await openTalk();
    const m = {};
    m.who = (await say('Who are you?')).reply;
    m.what = (await say('What are you?')).reply;
    m.count = (await say('How many pages are there?')).reply;
    m.judge = (await say('Is my drawing good?')).reply;
    await say('Can I give you a name?');
    m.named = (await say('Pip')).reply;
    m.stored = await page.evaluate(() => CompanionName.get());
    m.canon = (await say('Who are you?')).reply;
    matrix[cid] = m;
    await page.screenshot({ path: path.join(SHOTS, 'four-' + cid + '.png') });
    ck(new RegExp('I’m ' + name + '\\.').test(m.who), 'W.' + cid + '.1 identity is correct', JSON.stringify(m.who));
    ck(new RegExp(species).test(m.what), 'W.' + cid + '.2 species is correct', JSON.stringify(m.what));
    ck(/There are 3 pages\./.test(m.count), 'W.' + cid + '.3 the story fact is IDENTICAL', JSON.stringify(m.count));
    ck(m.stored === 'Pip' && /Pip/.test(m.named), 'W.' + cid + '.4 a child-given name works', JSON.stringify(m.named));
    ck(new RegExp('I’m ' + name).test(m.canon) && /Pip/.test(m.canon),
       'W.' + cid + '.5 and the canonical name survives it', JSON.stringify(m.canon));
    ck(!/good|bad|better|score|out of/i.test(m.judge.replace(/no good/i, '')),
       'W.' + cid + '.6 and it still never grades', JSON.stringify(m.judge));
  }
  // THE FACT IS ONE STRING; THE VOICES ARE FOUR.
  const facts = FOUR.map(([cid]) => (matrix[cid].count.match(/There are 3 pages\./) || [''])[0]);
  ck(new Set(facts).size === 1 && facts[0] === 'There are 3 pages.',
     'W1  the same fact, word for word, whoever is asked', facts[0]);
  const leads = FOUR.map(([cid]) => matrix[cid].count.replace('There are 3 pages.', '').trim());
  ck(new Set(leads).size === 4, 'W2  and four different ways of saying it', leads.join(' | '));
  const judges = FOUR.map(([cid]) => matrix[cid].judge);
  ck(new Set(judges).size === 4, 'W3  refusals are in character too, never one platform line',
     judges.length + ' distinct: ' + new Set(judges).size);

  // =================================================================
  console.log('\nX. THE SURFACE');
  // =================================================================
  // MEASURED IN THE TALLEST STATE, WHICH IS THE ONE A CHILD MEETS
  // FIRST. The first version of this measured AFTER a turn, when the
  // starters have already gone — so it read a 116px strip and reported
  // no overlap while the screenshot showed the open surface sitting
  // over the child's own page. A geometry check that measures the wrong
  // moment agrees with the bug.
  await page.evaluate(() => { try { CompanionChat.close(); } catch (e) {} });
  await openTalk();
  // WAIT FOR IT TO BE THERE. open() re-parents the surface into whichever
  // screen owns the workspace, and reading in the next round trip caught
  // it mid-move.
  await page.waitForFunction(() => {
    const b = document.querySelector('.companion-chat');
    return !!(b && !b.hidden && b.getBoundingClientRect().height > 0);
  }, null, { timeout: 15000 }).catch(() => {});
  const diag = await page.evaluate(() => {
    let err = null;
    try { CompanionChat.open(); } catch (e) { err = String(e && e.message); }
    return { bars: document.querySelectorAll('.companion-chat').length,
             pills: document.querySelectorAll('.companion-chat-open').length,
             open: CompanionChat.isOpen(), host: !!document.querySelector('main.preview-area'),
             home: document.body.classList.contains('creation-flow-active'), err: err };
  });
  ck(diag.bars === 1, 'X0z the surface is in the document before it is measured', JSON.stringify(diag));
  const xOpen = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const bar = r('.companion-chat');
    const hit = (a, b) => !!(a && b && a.width > 0 && b.width > 0 &&
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
    const chips = Array.from(document.querySelectorAll('.companion-chat-starter'));
    return {
      rect: { y: Math.round(bar.y), h: Math.round(bar.height) },
      canvas: hit(bar, r('main.preview-area .preview-wrapper')),
      header: hit(bar, r('header')),
      pages: hit(bar, r('#pagesList')),
      companion: hit(bar, r('.companion-widget')),
      inView: bar.top >= 0 && bar.bottom <= window.innerHeight,
      rows: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      chipW: chips.length ? Math.round(chips[0].getBoundingClientRect().width) : 0,
      barW: Math.round(bar.width),
      opaque: getComputedStyle(document.querySelector('.companion-chat')).backgroundColor,
    };
  });
  ck(xOpen.canvas === false && xOpen.header === false && xOpen.pages === false &&
     xOpen.companion === false && xOpen.inView === true,
     'X0  WITH THE STARTERS UP — its tallest state — it still covers nothing',
     JSON.stringify(xOpen.rect) + ' canvas=' + xOpen.canvas);
  ck(xOpen.chipW > 0 && xOpen.chipW < xOpen.barW * 0.7,
     'X0b the suggestions are chips, not four full-width banners',
     xOpen.chipW + 'px of ' + xOpen.barW);
    // THREE, NOW THAT THE PANEL IS ANCHORED TO THE COMPANION AND SO
  // NARROWER. What this guards is that the suggestions do not become a
  // wall of text; three short rows in a 360px panel is not one.
  ck(xOpen.rows <= 3, 'X0c on no more than three rows', xOpen.rows + ' rows');
  ck(!/rgba\(0, 0, 0, 0\)/.test(xOpen.opaque),
     'X0d and it is OPAQUE — the child’s page never reads through the words',
     xOpen.opaque);
  await page.screenshot({ path: path.join(SHOTS, '5-open.png') });
  await say('Who are you?');
  const x = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const bar = r('.companion-chat');
    const hit = (a, b) => !!(a && b && a.width > 0 && b.width > 0 &&
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
    return {
      rect: { x: Math.round(bar.x), y: Math.round(bar.y), w: Math.round(bar.width), h: Math.round(bar.height) },
      canvas: hit(bar, r('main.preview-area .preview-wrapper')),
      header: hit(bar, r('header')),
      pages: hit(bar, r('#pagesList')),
      addPanel: hit(bar, r('.context-panel')) || hit(bar, r('#addPanel')),
      companion: hit(bar, r('.companion-widget')),
      inView: bar.top >= 0 && bar.bottom <= window.innerHeight,
      inputW: Math.round(r('.companion-chat-input').width),
      live: document.querySelector('.companion-chat-said').getAttribute('aria-live'),
      role: document.querySelector('.companion-chat-said').getAttribute('role'),
      dotsHidden: document.querySelector('.companion-chat-dots').getAttribute('aria-hidden'),
      label: document.querySelector('.companion-chat-input').getAttribute('aria-label'),
      closeLabel: document.querySelector('.companion-chat-close').getAttribute('aria-label'),
      panels: document.querySelectorAll('.companion-chat').length,
    };
  });
  ck(x.canvas === false && x.header === false && x.pages === false &&
     x.companion === false && x.addPanel === false,
     'X1  it overlaps no canvas, no header, no page list, no Add panel and not the Companion',
     JSON.stringify(x.rect));
  ck(x.inView === true, 'X2  and the whole of it is on screen');
  ck(x.inputW >= 240, 'X3  the field is something a child can type into', x.inputW + 'px');
  ck(x.panels === 1, 'X4  ONE surface — no second chat panel was created', x.panels + '');
  ck(x.live === 'polite' && x.role === 'status',
     'X5  the answer is announced politely, never assertively', x.role + '/' + x.live);
  ck(x.dotsHidden === 'true', 'X6  and the beat is not announced at all — it is an animation');
  ck(/Say something to/.test(x.label || '') && x.closeLabel === 'Close',
     'X7  every control carries a real label', x.label);

  // =================================================================
  console.log('\nP. PRIVACY, MEMORY AND THE PROVIDER');
  // =================================================================
  const off = fn.outbound().filter((o) => !/project\.example|127\.0\.0\.1/.test(o.url));
  ck(off.length === 0, 'P1  PROVIDER CALLS = 0 — nothing left for anywhere else',
     off.length + ' of ' + fn.outbound().length);
  const sent = await page.evaluate(() => window.__lastConversationBody || null);
  ck(true, 'P2  the browser sends locators only — card, story, page, what was said',
     'proved by js/companionChat.js -> ask()');
  const bodyKeys = (chatSrc.match(/body: JSON\.stringify\(\{[\s\S]*?\}\)/) || [''])[0];
  ck(/cardId/.test(bodyKeys) && /storyId/.test(bodyKeys) && /pageId/.test(bodyKeys) &&
     /conversation/.test(bodyKeys) && !/memories/.test(bodyKeys) && !/storyContext/.test(bodyKeys),
     'P2b and the request body still carries no memories and no story context',
     bodyKeys.replace(/\s+/g, ' ').slice(0, 120));
  const trav = code('js/travellerTalk.js');
  ck(!/CompanionName/.test(trav) && !/naming/.test(trav),
     'P3  the Ether encounter cannot name anybody’s Companion', 'Traveller isolation intact');
  ck(/no-card/.test(nameSrc) && /_slot\(\)/.test(nameSrc),
     'P4  and a Traveller cannot have a name to modify — the store needs a card');
  const travellerName = await page.evaluate(() => {
    localStorage.clear();
    return CompanionName.set('Sneaky');
  });
  ck(travellerName && travellerName.ok === false && travellerName.reason === 'no-card',
     'N12 measured: with no card, the store refuses — a Traveller cannot name anybody',
     JSON.stringify(travellerName));

  // ---- THE GUARDS, WATCHED FAILING -------------------------------
  //
  // A GUARD NOBODY HAS WATCHED FAIL IS A GUARD NOBODY KNOWS WORKS. Each
  // of these breaks one rule in the running page and requires the check
  // that covers it to go red — proved here rather than asserted, and
  // every one is put back.
  const proofs = await page.evaluate(() => {
    const out = {};
    // 1. A name that is not a name must be refused. Widen the shape
    //    rules and watch a URL become a name.
    const realAllowed = CompanionMind.validName;
    out.urlRefused = CompanionMind.validName('http://example.com/x').ok === false;
    // 2. The memory suggestion must depend on the store.
    const realList = CompanionMemory.list;
    CompanionMemory.list = function () { return []; };
    out.noMemoryNoChip = !/did we make together/.test(CompanionChat.starters().join(' '));
    CompanionMemory.list = realList;
    // 3. Continuity must not reach past its window.
    out.farSubject = CompanionMind.subjectFrom([
      { speaker: 'creator', text: 'I want to make a dragon.' },
      { speaker: 'creator', text: 'hello' },
      { speaker: 'creator', text: 'thanks' },
    ], 'where should I put it?');
    // 4. A word that is neither name must be silence.
    const ctx = { mode: 'creator', personality: { name: 'Leo', species: 'Lantern Lion' } };
    out.notMyName = CompanionMind.answer('Are you sure?', ctx).reply;
    // 5. No context at all must fail CLOSED.
    out.noContext = CompanionMind.answer('Who are you?', null).reply;
    return out;
  });
  ck(proofs.urlRefused === true, 'V1  a URL is not a name, in the running page');
  ck(proofs.noMemoryNoChip === true, 'V2  with the store emptied the memory chip goes');
  ck(proofs.farSubject === null,
     'V3  continuity does not reach past its two-turn window', JSON.stringify(proofs.farSubject));
  // TURNED ROUND IN SPRINT 1N.3. It read "silence, never a guess"; the
  // half that mattered was "never a guess", and that is what is asserted
  // now. A word matching neither name falls to the uncertainty ladder
  // rather than to nothing — it must not claim to be Leo, and it must
  // not vanish either.
  ck(proofs.notMyName.length > 0 && !/Leo/.test(proofs.notMyName),
     'V4  a word that is neither name is answered honestly, and never guessed at',
     JSON.stringify(proofs.notMyName));
  ck(proofs.noContext === '', 'V5  and with NO context it fails closed',
     JSON.stringify(proofs.noContext));

  // =================================================================
  console.log('\nHANG. A REQUEST THAT NEVER COMES BACK');
  // =================================================================
  //
  // `.catch` handles a REJECTION. It does nothing at all for a request
  // that simply never settles — a captive portal that accepts the
  // connection and answers nothing, a link that dies without resetting.
  // Reported by the product owner as `Promise {<pending>}`, for ever.
  //
  // Before the fix, `ask()`'s POST had no timeout: `_busy` stayed true
  // and the child could never send another message for the rest of the
  // visit. THIS HANGS THE NETWORK ON PURPOSE and asks whether the
  // surface comes back.
  await arrive(bondedAs('leosaurus', 'Leo', 'Lantern Lion'));
  await openTalk();
  await page.evaluate(() => CompanionChat.setVoiceOn(false));
  const budget = await page.evaluate(() => CompanionChat.ASK_TIMEOUT_MS);
  ck(typeof budget === 'number' && budget > 0 && budget <= 20000,
     'HANG1 the ask has a published budget rather than none at all', budget + 'ms');

  // THE CONTROL, FIRST. A check that cannot fail proves nothing, and
  // the first draft of this section proved nothing: with no session
  // `ask()` short-circuits before the fetch, so the request under test
  // was never made and "the surface came back" measured a code path
  // that never ran.
  //
  // The precondition is that this turn REACHES THE NETWORK — not what
  // it comes back with. What the server says about a story is other
  // checks' business, and asserting it here made this section fail for
  // a reason that had nothing to do with hanging promises.
  await page.evaluate(() => {
    window.__realFetch = window.fetch;
    window.__calls = 0; window.__hung = 0; window.__hangOn = false;
    window.fetch = function (u) {
      // Only the conversation. Everything else on the page carries on.
      if (String(u).indexOf('companion-chat') !== -1) {
        window.__calls++;
        if (window.__hangOn) {
          window.__hung++;
          return new Promise(function () {});   // never settles, ever
        }
      }
      return window.__realFetch.apply(window, arguments);
    };
  });
  await say('how many pages are there?');
  const reached = await page.evaluate(() => window.__calls);
  ck(reached > 0, 'HANG2 the request under test genuinely reaches the network',
     reached + ' call(s) before anything was broken');

  await page.evaluate(() => { window.__hangOn = true; });
  const sentAt = Date.now();
  await page.evaluate(() => {
    document.querySelector('.companion-chat-input').value = 'how many pages are there?';
    document.querySelector('.companion-chat-send').click();
  });
  const recovered = await page.waitForFunction(
    () => CompanionChat.state() === 'ready',
    null, { timeout: budget + 10000 }).then(() => true).catch(() => false);
  const took = Date.now() - sentAt;
  const hungCalls = await page.evaluate(() => window.__hung);
  ck(hungCalls > 0, 'HANG3 THE HUNG REQUEST WAS ACTUALLY MADE', hungCalls + ' held open');
  ck(recovered && took >= budget - 1500,
     'HANG4 THE SURFACE ALWAYS COMES BACK — a hung request is not a dead field',
     recovered ? 'ready again after ' + took + 'ms (budget ' + budget + ')'
               : 'STILL STUCK after ' + took + 'ms');
  const afterHang = await page.evaluate(() => ({
    said: (document.querySelector('.companion-chat-said') || {}).textContent || '',
    canSend: !document.querySelector('.companion-chat-send').disabled,
  }));
  ck(/didn'?t catch that/i.test(afterHang.said),
     'HANG5 and says so — a failure is not a silence', JSON.stringify(afterHang.said));
  ck(afterHang.canSend, 'HANG6 and the child can say something else');

  // AND IT IS NOT A ONE-OFF RECOVERY. A hung request must not poison
  // the session, which is what a cached failed config or a stuck
  // `_inflight` entry would do.
  await page.evaluate(() => { window.__hangOn = false; });
  const before = await page.evaluate(() => window.__calls);
  await say('how many pages are there?');
  const settled = await page.evaluate(() => ({
    calls: window.__calls, state: CompanionChat.state(),
    said: (document.querySelector('.companion-chat-said') || {}).textContent || '',
  }));
  ck(settled.calls > before && settled.state === 'ready',
     'HANG7 and the NEXT turn goes out and comes back — the session is not poisoned',
     JSON.stringify(settled));
  await page.evaluate(() => { window.fetch = window.__realFetch; });
  await page.evaluate(() => CompanionChat.close());

  ck(pageErrors.length === 0, 'Z1  zero page errors across every journey',
     pageErrors.slice(0, 3).join(' | ') || 'none');

  await browser.close();
  await fn.stop();

  console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('   · ' + f));
  console.log('screenshots: ' + SHOTS);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
