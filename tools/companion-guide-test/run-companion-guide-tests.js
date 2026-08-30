#!/usr/bin/env node
/**
 * tools/companion-guide-test — STEP 3E
 *
 * A COMPANION WHO KNOWS WHERE THE CHILD IS STANDING.
 *
 *   K. STUDIO KNOWLEDGE  — real controls, no invented ones
 *   F. THE SURFACE FILTER — never a control from another screen
 *   N. LIVE CONTEXT      — where, what, and what day it is
 *   H. STUDIO HOME       — the gap §14 names, closed
 *   I. INSTRUCTION       — child audience, depth, guide behaviour
 *   D. DRIFT             — documented controls exist in the product
 *   P. STILL PRIVATE     — nothing this sprint added widened anything
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-guide-test/run-companion-guide-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'companion-chat', 'index.ts');
const KNOW = path.join(ROOT, 'assets', 'canon', 'studio.knowledge.json');

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n + (note ? '  (' + note + ')' : ''));
         console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}
function section(t) { console.log('\n' + t); }

(async () => {
  console.log('\nCOMPANION AS GUIDE — Step 3E');
  const know = JSON.parse(fs.readFileSync(KNOW, 'utf8'));

  // =================================================================
  section('K. STUDIO KNOWLEDGE — procedural, sourced, and not canon');
  // =================================================================
  ck(know.knowledgeVersion && Array.isArray(know.capabilities) && know.capabilities.length >= 8,
     'K1  it exists and covers the Studio', know.capabilities.length + ' capabilities');
  const unsourced = know.capabilities.filter((c) => !c.evidence)
    .concat((know.surfaces || []).filter((s) => !s.evidence));
  ck(unsourced.length === 0, 'K2  EVERY entry names where it was read from',
     unsourced.map((c) => c.id).join(', ') || 'all sourced');
  const missingSteps = know.capabilities.filter((c) => !Array.isArray(c.steps) || !c.steps.length);
  ck(missingSteps.length === 0, 'K2b and every one has real steps',
     missingSteps.map((c) => c.id).join(', ') || 'all have steps');
  // §9 — it must NOT restate the canon.
  const canon = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'assets', 'canon', 'vihuplanet.canon.json'), 'utf8'));
  const canonTruths = canon.sections.reduce((a, s) => a.concat(s.truths || []), []);
  const blob = JSON.stringify(know);
  const dup = canonTruths.filter((t) => blob.indexOf(t) !== -1);
  ck(dup.length === 0, 'K3  AND IT DOES NOT RESTATE THE CANON — two files, two jobs',
     dup.length ? dup[0].slice(0, 50) : 'no truth appears in both');
  // §26/§27 — the two things it forbids.
  ck((know.neverSay || []).length >= 2 &&
     /invent|not listed/i.test(JSON.stringify(know.neverSay)) &&
     /pressed|added|saved/i.test(JSON.stringify(know.neverSay)),
     'K4  it forbids inventing a control and claiming an action');

  // =================================================================
  section('D. DRIFT — a documented control actually exists');
  // =================================================================
  // §51 — not a copy of the UI, just: does the thing we tell a child to
  // tap exist in the product? A Companion whose instructions sound right
  // and do not work is a failure.
  const studioHtml = fs.readFileSync(path.join(ROOT, 'studio.html'), 'utf8');
  const panelSrc = fs.readFileSync(path.join(ROOT, 'js', 'contextPanel.js'), 'utf8');
  const LABELS = ['Play My Story', 'Finish Story', '+ Add Page'];
  LABELS.forEach((l) => {
    ck(studioHtml.indexOf(l) !== -1 && blob.indexOf(l) !== -1,
       'D1.' + l.replace(/\s+/g, '-') + '  is named in both the product and the knowledge');
  });
  const tiles = (know.capabilities.find((c) => c.id === 'add-something') || {}).controls || [];
  ck(tiles.length > 0, 'D2  the Add panel is documented', tiles.length + ' tiles');
  const wrong = tiles.filter((t) => panelSrc.indexOf("label:'" + t.label + "'") === -1);
  ck(wrong.length === 0,
     'D2b AND EVERY TILE IT NAMES IS A REAL TILE — read from js/contextPanel.js',
     wrong.map((t) => t.label).join(', ') || tiles.map((t) => t.label).join(', '));
  const surfIds = (know.surfaces || []).map((s) => s.id);
  const orphan = know.capabilities.filter((c) =>
    (c.where || []).some((w) => surfIds.indexOf(w) === -1));
  ck(orphan.length === 0, 'D3  and every capability lives on a surface that exists',
     orphan.map((c) => c.id).join(', ') || surfIds.join(', '));

  // =================================================================
  section('F/N. THE FILTER AND THE LIVE CONTEXT — driven, not read');
  // =================================================================
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const tmp = path.join(os.tmpdir(), 'vihu-guide-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);
  const rows = {
    magic_card_identities: [{ id: 'card_a', card_id: 'card_a', owner_id: 'user-a',
      companion_id: 'leosaurus', companion_name: 'Leo', companion_species: 'Lantern Lion' }],
    creator_projects: [{ id: 'proj_1', owner_id: 'user-a', data: {
      id: 'proj_1', name: 'The Moon Garden', cardId: 'card_a',
      data: { project: { bookTitle: 'The Moon Garden' },
              pages: [{ storyBeat: 'A garden on the moon.' }, { storyBeat: 'b' }] } } }],
    creator_companion_memory: [],
  };
  let sent = null;
  const fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.includes('api.openai.com')) {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content:
        JSON.stringify({ reply: 'ok', speak: true, memoryProposal: null }) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-a' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const t = (u.match(/\/rest\/v1\/([a-z_]+)/) || [])[1];
    return new Response(JSON.stringify(rows[t] || []), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const env = (n) => ({ SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'a',
    SUPABASE_SERVICE_ROLE_KEY: 's', COMPANION_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x',
    OPENAI_PRODUCTION_ENABLED: 'true', OPENAI_ZDR_CONFIRMED: 'true',
    COMPANION_MIND_ENABLED: 'true', COMPANION_MODEL_COMPANIONS: 'leosaurus' }[n] || '');
  const ask = async (extra) => {
    sent = null;
    const h = M.makeHandler({ env: env, fetchImpl: fetchImpl, now: () => Date.now() });
    const res = await h(new Request('https://fn/companion-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(Object.assign({ cardId: 'card_a', storyId: 'proj_1', pageId: 0,
        conversation: [{ role: 'creator', text: 'where am I?' }] }, extra || {})),
    }));
    await res.text();
    if (!sent) return null;
    return { data: JSON.parse(String(sent.messages[1].content).replace(/^[^{]*/, '')),
             tokens: Math.round(JSON.stringify(sent).length / 4) };
  };

  const editor = await ask({ surface: 'story-editor', utcOffsetMinutes: 330 });
  const home = await ask({ surface: 'studio-home', utcOffsetMinutes: 330 });
  ck(!!editor && !!home, 'N0  both surfaces reach the model');
  ck(editor.data.studio.youAreOn === 'story-editor' && home.data.studio.youAreOn === 'studio-home',
     'N1  THE COMPANION IS TOLD WHICH SCREEN IT IS ON',
     editor.data.studio.youAreOn + ' / ' + home.data.studio.youAreOn);
  const editorNames = editor.data.studio.capabilities.map((c) => c.name);
  const homeNames = home.data.studio.capabilities.map((c) => c.name);
  ck(homeNames.length < editorNames.length,
     'F1  and gets FEWER capabilities on Studio Home — only what is there',
     homeNames.length + ' vs ' + editorNames.length);
  // §22 — THE PROPERTY THAT MATTERS. A control that lives only in the
  // editor must not be sendable to a child standing on Studio Home.
  const editorOnly = know.capabilities
    .filter((c) => (c.where || []).length === 1 && c.where[0] === 'story-editor')
    .map((c) => c.name);
  const leaked = editorOnly.filter((n) => homeNames.indexOf(n) !== -1);
  ck(editorOnly.length > 0 && leaked.length === 0,
     'F2  A STORY-EDITOR CONTROL CANNOT REACH A CHILD ON STUDIO HOME',
     leaked.join(', ') || editorOnly.length + ' editor-only capabilities, none sent home');
  // NOT "the words never appear". The Studio Home entry carries a
  // `notHere` list that names Play My Story and Finish Story ON PURPOSE
  // — telling a child "that one is not on this screen, open your story
  // first" is exactly the behaviour §22 asks for, and it needs the name
  // to say it. What must never happen is a STEP a child could follow to
  // a control that is not there.
  const homeSteps = JSON.stringify(home.data.studio.capabilities);
  ck(homeSteps.indexOf('+ Add Page') === -1 && homeSteps.indexOf('Play My Story') === -1,
     'F2b and no STEP on Studio Home names one either — a child cannot be sent to it',
     homeSteps.length + ' chars of steps swept');
  const homeSurface = (home.data.studio.surfaces || [])[0] || {};
  ck(Array.isArray(homeSurface.notHere) && homeSurface.notHere.indexOf('Play My Story') !== -1,
     'F2c while the screen DOES say what is not on it — that is how a child gets sent',
     JSON.stringify(homeSurface.notHere));
  ck(JSON.stringify(home.data.studio).indexOf('.js') === -1 && editorOnly.length > 0 &&
     JSON.stringify(editor.data.studio).indexOf('.js') === -1,
     'F3  and NO FILE PATH travels — `evidence` is for us, never for a Companion');

  // ---- THE DATE -------------------------------------------------
  ck(editor.data.now && /^[A-Z][a-z]+day, \d{1,2} [A-Z][a-z]+ \d{4}$/.test(editor.data.now.today),
     'N2  IT KNOWS WHAT DAY IT IS, written out rather than an ISO string',
     editor.data.now && editor.data.now.today);
  const server = new Date();
  ck(editor.data.now.today.indexOf(String(server.getUTCFullYear())) !== -1,
     'N2b and it is THIS year — from the server clock, never the caller');
  const lied = await ask({ surface: 'story-editor', utcOffsetMinutes: 330,
    now: { today: 'Tuesday, 1 January 1999' } });
  ck(lied.data.now.today !== 'Tuesday, 1 January 1999',
     'N2c A CLIENT CANNOT SUPPLY THE DATE — a date is a fact, not a locator',
     lied.data.now.today);
  const silly = await ask({ surface: 'story-editor', utcOffsetMinutes: 99999 });
  ck(silly.data.now.dateIsLocal === false,
     'N2d and a nonsense offset falls back to UTC rather than moving the day');
  const noTz = await ask({ surface: 'story-editor' });
  ck(noTz.data.now.dateIsLocal === false && !!noTz.data.now.today,
     'N2e no offset is still a date — honest about being UTC', noTz.data.now.today);

  // =================================================================
  section('H. STUDIO HOME — the gap §14 names');
  // =================================================================
  const live = fs.readFileSync(path.join(ROOT, 'js', 'companionLive.js'), 'utf8');
  ck(/getSessionStatus/.test(live),
     'H1  the session slot is the fallback — the same thing Studio Home already reads');
  ck(/AppState\.project && AppState\.project\.id/.test(live),
     'H1b with the open project preferred when there is one');
  ck(/name === 'Untitled'/.test(live),
     'H2  and "Untitled" is not read back as a name a child chose');
  const chat = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  ck(/CompanionLive[\s\S]{0,200}_storyId/.test(chat) || /CompanionLive\.story\(\)/.test(chat),
     'H3  and the surface asks it for the story id');
  ck(home.data.storyContext && home.data.storyContext.story &&
     home.data.storyContext.story.name === 'The Moon Garden',
     'H4  SO A CHILD ON STUDIO HOME CAN BE TOLD WHAT THEY ARE MAKING',
     JSON.stringify(home.data.storyContext && home.data.storyContext.story));

  // =================================================================
  section('I. INSTRUCTION — the child, the depth, the guide');
  // =================================================================
  const sys = String(sent ? sent.messages[0].content : '');
  ck(/TALKING TO A CHILD/.test(sys) && /about ten years old/.test(sys),
     'I1  it names the audience');
  ck(/no baby talk/i.test(sys) && /Great question/.test(sys) && /Respect them/.test(sys),
     'I2  AND FORBIDS TALKING DOWN — §6, by name');
  ck(/One to four short sentences/.test(sys) && /would you like to know more/i.test(sys),
     'I3  bounds the length and forbids the reflex follow-up — §5, §7');
  ck(/ONE or TWO steps and stop/.test(sys) && /repeating yourself/.test(sys),
     'I4  and helps like a guide rather than a manual — §20, §21');
  ck(/NEVER name a control that is not on the screen/.test(sys),
     'I5  never a control from another screen — §22');
  ck(/inventing a button/.test(sys),
     'I6  and never an invented one — §26');
  ck(/YOU CANNOT PRESS ANYTHING/.test(sys) && /the child does it/.test(sys),
     'I7  it cannot claim an action — §27');
  ck(/2\. LIVE/.test(sys) && /6\. STUDIO/.test(sys),
     'I8  the source hierarchy names both new sources — §41');
  // §40 — one instruction, not one per Companion.
  const fnSrc = fs.readFileSync(FN, 'utf8');
  ck((fnSrc.match(/function systemInstructions\(/g) || []).length === 1,
     'I9  ONE instruction, shared — no per-Companion prompt');
  // §36 — safety, unchanged and still there.
  ck(/SAFETY\./.test(sys) && /Never ask for a name, an age/.test(sys),
     'I10 and the safety rules this sprint did not touch are still in it');

  // =================================================================
  section('P. STILL PRIVATE — nothing here widened anything');
  // =================================================================
  const gate = fs.readFileSync(path.join(ROOT, 'js', 'companionPrivacyGate.js'), 'utf8');
  ck(/'now', 'studio'/.test(gate),
     'P1  the two new members are NAMED in the contract, not smuggled past it');
  const forb = (gate.match(/const FORBIDDEN_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
  ['cardid', 'pattern', 'constellation', 'nickname', 'token'].forEach((k) => {
    ck(forb.indexOf("'" + k + "'") !== -1,
       'P2.' + k + '  is still forbidden — nothing was removed to make room');
  });
  // STAR DATA, NOT THE WORD — nineteenth time this repository has been
  // caught by a word matching inside its own vocabulary. The canon says
  // in as many words that a Creator is recognised by their constellation
  // of stars and that a Companion never says what is on anybody's card;
  // that sentence is what TELLS a model the boundary exists. What must
  // not travel is a pattern, a constellation name, a count, or a key
  // that could hold one.
  const walk = (o, out) => {
    if (!o || typeof o !== 'object') return out;
    Object.keys(o).forEach((k) => {
      if (/^(stars|constellation|pattern|sky)$/i.test(k)) out.push(k);
      walk(o[k], out);
    });
    return out;
  };
  const starKeys = walk(editor.data, []);
  ck(starKeys.length === 0,
     'P3  and NO FIELD that could hold star data is anywhere in a Studio request',
     starKeys.join(', ') || 'no such key at any depth');
  ck(/'now', 'studio', 'conversation'/.test(gate),
     'P3b including in Traveller mode, which names the same two');
  // §32 — live context is not memory.
  ck(!/localStorage|sessionStorage|CompanionMemory|remember\s*\(/.test(live),
     'P4  LIVE CONTEXT IS NOT MEMORY — it stores nothing and cannot');

  // ---- AND THE §14 FIX IS CLIENT-SIDE, so it is proved there -------
  //
  // H4 above drives the SERVER, which was handed a storyId — so it
  // cannot see whether the browser would have found one. The whole of
  // §14 is that on Studio Home there is no open project and the id has
  // to come from the session slot. That is a browser fact and it is
  // measured in a browser.
  {
    const { chromium } = require('playwright');
    const http = require('http');
    const PORT = Number(process.env.GUIDE_PORT || 8813);
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('no'); return;
      }
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }); res.end(fs.readFileSync(file));
    });
    await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/studio.html?author=on');
    await page.waitForFunction(() => typeof CompanionLive !== 'undefined', null, { timeout: 20000 });
    const out = await page.evaluate(() => {
      // STUDIO HOME: no project open, but a session slot with a story —
      // exactly what a child who came back to make something has.
      try { if (typeof AppState !== 'undefined') AppState.project = {}; } catch (e) {}
      window.ProjectManager = window.ProjectManager || {};
      window.ProjectManager.getSessionStatus = () => ({
        state: 'valid', title: 'The Moon Garden', pageCount: 3,
        data: { project: { id: 'proj_home', bookTitle: 'The Moon Garden' } },
      });
      const home = CompanionLive.story();
      // THE EDITOR: a project really is open, and it wins.
      try {
        AppState.project = { id: 'proj_open', bookTitle: 'A Different Story' };
        AppState.slides = [{}, {}];
      } catch (e) {}
      const open = CompanionLive.story();
      // AND A PLACEHOLDER NAME IS NOT READ BACK AS A CHOICE.
      window.ProjectManager.getSessionStatus = () => ({
        state: 'valid', title: 'Untitled', pageCount: 1,
        data: { project: { id: 'proj_untitled' } },
      });
      try { AppState.project = {}; } catch (e) {}
      const untitled = CompanionLive.story();
      // AND NOTHING AT ALL IS NOTHING, not a guess.
      window.ProjectManager.getSessionStatus = () => ({ state: 'none' });
      const none = CompanionLive.story();
      return { home, open, untitled, none,
               offset: CompanionLive.utcOffsetMinutes(),
               surface: CompanionLive.surface() };
    });
    await browser.close(); srv.close();
    ck(out.home && out.home.id === 'proj_home' && out.home.name === 'The Moon Garden'
       && out.home.open === false,
       'H5  ON STUDIO HOME, WITH NO PROJECT OPEN, IT FINDS THE STORY — §14 closed',
       JSON.stringify(out.home));
    ck(out.open && out.open.id === 'proj_open' && out.open.open === true,
       'H5b and an OPEN project wins over the slot', JSON.stringify(out.open));
    ck(out.untitled && out.untitled.name === null,
       'H5c and "Untitled" comes back as no name rather than a name',
       JSON.stringify(out.untitled));
    ck(out.none === null, 'H5d and nothing is nothing — never a guess', JSON.stringify(out.none));
    ck(typeof out.offset === 'number',
       'H6  the browser reports its offset from UTC, and nothing else about where it is',
       out.offset + ' minutes');
    ck(out.surface === 'story-editor' || out.surface === 'studio-home',
       'H6b and which screen it is on, read from the document rather than guessed',
       out.surface);
  }

  console.log('\n       measured: story-editor ' + editor.tokens +
    ' tokens, studio-home ' + home.tokens + ' tokens');
  console.log('\n' + (failed ? 'FAILURES' : 'ALL GREEN') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
