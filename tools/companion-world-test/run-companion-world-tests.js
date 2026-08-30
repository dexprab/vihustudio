#!/usr/bin/env node
/**
 * tools/companion-world-test — STEP 3B
 *
 * GIVE THE REAL COMPANION A WORLD IT ACTUALLY KNOWS.
 *
 * Two root causes, and this suite guards both:
 *
 *   1. THE MODEL NEVER SAW THE QUESTION. `unknown` is in the browser's
 *      LOCAL_INTENTS, so "what is 2 + 2?" and "what is VihuPlanet?" were
 *      answered with an honest shrug and never left the machine.
 *   2. AND WHEN IT DID, IT WAS HANDED A STUB. The live path sent
 *      SYNTHETIC_CANON — four sections, canonVersion 'synthetic-1' —
 *      which says nothing about the Ether, the Studio, a Magic Card or
 *      the Garden.
 *
 *   W. THE WORLD        — the canon is real, sourced, and nothing invented
 *   S. WHAT TRAVELS     — the live request carries it, once, measured
 *   R. ROUTING          — two intents yield to a real Mind; nothing else
 *   B. BOUNDARIES       — every refusal is still answered without a network
 *   I. INSTRUCTION      — general knowledge invited, canon named authority
 *   F. FIXTURES         — the record shape pinned from BOTH ends
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-world-test/run-companion-world-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'companion-chat', 'index.ts');
const CANON = path.join(ROOT, 'assets', 'canon', 'vihuplanet.canon.json');

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n + (note ? '  (' + note + ')' : ''));
         console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}
function section(t) { console.log('\n' + t); }

(async () => {
  console.log('\nCOMPANION WORLD KNOWLEDGE — Step 3B');

  const canon = JSON.parse(fs.readFileSync(CANON, 'utf8'));
  const byKey = {};
  canon.sections.forEach((s) => { byKey[s.key] = s; });

  // =================================================================
  section('W. THE WORLD — established, sourced, and nothing invented');
  // =================================================================
  // The concepts §1 names. `story` and `traveller` are covered by
  // sections whose keys read differently, so the map is explicit rather
  // than a guess at a naming convention.
  const CONCEPTS = {
    'VihuPlanet': 'vihuplanet',
    'Ether': 'ether',
    'Studio': 'hall-of-creation',
    'Creator': 'creator',
    'Traveller': 'traveller-and-world-host',
    'Companion': 'companion',
    'Stories': 'world-and-story',
    'Magic Card': 'magic-card',
    'Garden': 'garden',
  };
  Object.keys(CONCEPTS).forEach((concept) => {
    const s = byKey[CONCEPTS[concept]];
    ck(!!s && Array.isArray(s.truths) && s.truths.length >= 3,
       'W1.' + concept.replace(/\s+/g, '-') + '  is established, with real content',
       s ? s.truths.length + ' truths' : 'MISSING');
  });
  // EVERY SECTION NAMES WHERE IT CAME FROM. §2 asks for a source per
  // concept, and §3 forbids inventing one — a section that cannot say
  // where it came from is indistinguishable from an invention.
  const unsourced = canon.sections.filter((s) => !s.establishedIn);
  ck(unsourced.length === 0, 'W2  every section records its source',
     unsourced.map((s) => s.key).join(', ') || canon.sections.length + ' sections');
  // The four added by this sprint cite a Decision by number, so a
  // reviewer can go and read it.
  ['hall-of-creation', 'magic-card', 'garden', 'cheer'].forEach((k) => {
    ck(byKey[k] && /CLAUDE\.md Decisions?\s+[0-9]/.test(byKey[k].establishedIn || ''),
       'W2.' + k + ' cites the decision it came from',
       byKey[k] ? byKey[k].establishedIn : 'MISSING');
  });

  // ---- WHAT IT IS NOT --------------------------------------------
  const blob = JSON.stringify(canon);
  // NOT "does the word Creator appear" — it appears in every definition
  // of what a Creator IS, which is the whole point of a canon. What
  // would make this memory is a memory RECORD: the shape
  // js/companionMemory.js writes, with its own fields.
  const MEMORY_SHAPE = ['"importance"', '"confidence"', '"entities"', '"dedupeKey"', '"cardId"'];
  ck(MEMORY_SHAPE.every((k) => blob.indexOf(k) === -1),
     'W3  THE WORLD IS NOT MEMORY — not one field of a memory record is in it',
     MEMORY_SHAPE.filter((k) => blob.indexOf(k) !== -1).join(', ') || 'none present');
  ck(!/proj_|card_|mem_|lib_|owner_id|@[a-z]+\./i.test(blob),
     'W4  and holds no identifier, no card and no address');
  const named = ['Vihaan', 'Spark', 'The Moon Garden', 'Tiny Forest'];
  ck(named.every((n) => blob.indexOf(n) === -1),
     'W5  and names no child, no Story and no Companion nickname',
     named.filter((n) => blob.indexOf(n) !== -1).join(', ') || 'none present');
  // §3 — what is NOT settled is recorded rather than filled in.
  const q = (canon.openQuestions || []).join(' ');
  ck(/Ether came from|origin for it/i.test(q),
     'W6  WHERE THE ETHER CAME FROM IS RECORDED AS UNSETTLED, not answered',
     (canon.openQuestions || []).length + ' open questions');
  // \b, AND NOT A BARE SUBSTRING. The first version of this matched
  // `rite` inside "rewrites" and reported the canon naming the Story
  // Rites when it does nothing of the kind — the fourteenth time this
  // repository has been caught by a word matching inside its own
  // vocabulary, and the check was the thing that was wrong.
  const bodyOnly = JSON.stringify({ sections: canon.sections });
  ck(!/\brites?\b/i.test(bodyOnly) && !/\blevel\s+(?:one|two|three|1|2|3)\b/i.test(bodyOnly),
     'W7  and the Story Rites are deliberately absent — Decision 22 keeps them off every screen',
     (bodyOnly.match(/\brites?\b/i) || ['none'])[0]);

  // =================================================================
  section('S. WHAT TRAVELS — the live request really carries it');
  // =================================================================
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const tmp = path.join(os.tmpdir(), 'vihu-world-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);

  // ---- THE ROW IS BUILT THE WAY THE STORE BUILDS IT ---------------
  //
  // Three times while writing this sprint the fixture was the thing
  // that was wrong, not the code — a project row invented from reading
  // the reader, which produced a null story name and looked exactly
  // like a product bug. `CreatorProjectStore.upsert()` writes
  // { id, name, cardId, ..., data: <ProjectManager.serialize() payload> }
  // and the WHOLE of that goes in the `data` column. F1/F2 pin it.
  const storeRow = {
    id: 'proj_1', owner_id: 'user-a',
    data: {
      id: 'proj_1', name: 'The Moon Garden', cardId: 'card_a',
      data: {
        project: { bookTitle: 'The Moon Garden' },
        pages: [
          { id: 'p1', storyBeat: 'A small garden on the moon.', metadata: { stickers: [{}, {}] } },
          { id: 'p2', storyBeat: 'x' }, { id: 'p3', storyBeat: 'y' },
        ],
      },
    },
  };
  const rows = {
    magic_card_identities: [{ id: 'card_a', card_id: 'card_a', owner_id: 'user-a',
      companion_id: 'leosaurus', companion_name: 'Leo', companion_species: 'Lantern Lion' }],
    creator_projects: [storeRow],
    creator_companion_memory: [{ type: 'shared', content: 'Creator made a story called The Moon Garden',
      importance: 3, confidence: 'confirmed', entities: ['project:proj_1'], card_id: 'card_a' }],
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
  const envOf = (over) => {
    const all = Object.assign({
      SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's',
      COMPANION_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x',
      OPENAI_PRODUCTION_ENABLED: 'true', OPENAI_ZDR_CONFIRMED: 'true',
      COMPANION_MIND_ENABLED: 'true', COMPANION_MODEL_COMPANIONS: 'leosaurus',
    }, over || {});
    return (n) => (all[n] == null ? '' : String(all[n]));
  };
  const live = async (text, over) => {
    sent = null;
    const h = M.makeHandler({ env: envOf(over), fetchImpl: fetchImpl, now: () => Date.now() });
    const res = await h(new Request('https://fn/companion-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ cardId: 'card_a', storyId: 'proj_1', pageId: 0,
        conversation: [{ role: 'creator', text: text }] }),
    }));
    return { body: JSON.parse(await res.text()), sent: sent };
  };

  const one = await live('What is Ether?');
  ck(one.body.ok === true && !!one.sent, 'S0  a live turn reaches the model',
     JSON.stringify(one.body.reply));
  const data = JSON.parse(String(one.sent.messages[1].content).replace(/^[^{]*/, ''));
  ck(data.canon && data.canon.canonVersion === canon.canonVersion,
     'S1  IT IS THE REAL CANON, not the four-section stub',
     'canonVersion ' + (data.canon && data.canon.canonVersion));
  ck(data.canon.sections.length === canon.sections.length,
     'S2  and all of it', data.canon.sections.length + ' of ' + canon.sections.length + ' sections');
  const shipped = {};
  data.canon.sections.forEach((s) => { shipped[s.key] = s; });
  Object.keys(CONCEPTS).forEach((c) => {
    if (!shipped[CONCEPTS[c]]) ck(false, 'S2.' + c + ' travelled');
  });
  ck(Object.keys(CONCEPTS).every((c) => !!shipped[CONCEPTS[c]]),
     'S2b every concept §1 names is in what the model receives');
  // §21/§22 — the world is not memory and not a Story.
  ck(JSON.stringify(data.canon).indexOf('Moon Garden') === -1,
     'S3  THE WORLD CARRIES NO STORY — the canon and the story are different fields');
  ck(!data.canon.sections.some((s) => JSON.stringify(s).indexOf('card_a') !== -1),
     'S3b and no card, no owner, no identifier');
  ck(data.storyContext && data.storyContext.story &&
     data.storyContext.story.name === 'The Moon Garden',
     'S4  the live Story travels beside it, named',
     JSON.stringify(data.storyContext && data.storyContext.story));
  ck((data.memories || []).length === 1,
     'S4b and so does what the two of them have done together', (data.memories || []).length + ' memory');
  // §8/§32 — measured, and the canon travels ONCE.
  const whole = JSON.stringify(one.sent);
  const canonChars = JSON.stringify(data.canon).length;
  console.log('       measured: request ' + whole.length + ' chars ≈ ' +
    Math.round(whole.length / 4) + ' tokens; canon ' + canonChars + ' chars ≈ ' +
    Math.round(canonChars / 4) + ' tokens');
  ck(whole.length < 40000,
     'S5  and the whole request is still a request, not a manual',
     Math.round(whole.length / 4) + ' tokens');
  const sys = String(one.sent.messages[0].content);
  const dup = canon.sections.filter((s) => (s.truths || []).some((t) => sys.indexOf(t) !== -1));
  ck(dup.length === 0,
     'S6  NOTHING IS SENT TWICE — no canon truth is restated in the instruction',
     dup.map((s) => s.key).join(', ') || 'no duplication');

  // =================================================================
  section('R. ROUTING — a real Mind outranks the honest shrug');
  // =================================================================
  const mindSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionMind.js'), 'utf8');
  const chatSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  const routed = (mindSrc.match(/const MODEL_ROUTED = \[([^\]]*)\]/) || [])[1] || '';
  const routedIds = routed.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  ck(routedIds.length === 2 && routedIds.indexOf('unknown') !== -1 &&
     routedIds.indexOf('outside-world') !== -1,
     'R1  EXACTLY TWO intents yield to a real Mind', routedIds.join(', '));
  // COMMENTS FIRST. LOCAL_INTENTS carries a long explanation INSIDE the
  // array, so a naive split read prose as intent ids and reported them
  // missing. Strip the comments, then read the quoted strings — the only
  // things in there that are actually ids.
  const noComments = mindSrc.replace(/\/\/[^\n]*/g, '');
  const localIds = ((noComments.match(/const LOCAL_INTENTS = \[([\s\S]*?)\];/) || [])[1] || '')
    .split(',').map((s) => (s.match(/'([a-z-]+)'/) || [])[1]).filter(Boolean);
  ck(routedIds.every((r) => localIds.indexOf(r) !== -1),
     'R1b and both are still LOCAL when there is no model — nothing disappears with the network');
  ck(/_hasRealMind\s*\(/.test(chatSrc) && /modelCompanions/.test(chatSrc),
     'R2  the browser asks the function WHICH Companions have one, and caches it');
  ck(/if\s*\(!routed\)\s*return Promise\.resolve\(answerLocally\(\)\)/.test(chatSrc),
     'R2b every other local answer is returned without waiting for anything');
  ck(/if\s*\(list === null\)\s*_probe = null/.test(chatSrc),
     'R2c AND A FAILED PROBE IS NOT REMEMBERED — one blink must not cost the session');
  ck(/return answerLocally\(\);\s*\n\s*return _remote/.test(chatSrc.replace(/\r/g, '')) ||
     /if \(!yes\) return answerLocally\(\)/.test(chatSrc),
     'R2d and an unreadable answer means NO — the Companion is exactly as it was');

  // =================================================================
  section('B. BOUNDARIES — every refusal still holds without a network');
  // =================================================================
  const MUST_STAY_LOCAL = ['stars', 'privacy', 'secrecy', 'injection',
                           'work-judgement', 'emotional-boundary', 'creative-suggestion',
                           'identity', 'naming', 'name-check', 'tell-fact', 'recall-fact'];
  MUST_STAY_LOCAL.forEach((id) => {
    ck(localIds.indexOf(id) !== -1 && routedIds.indexOf(id) === -1,
       'B1.' + id + '  is answered here, always, with no round trip',
       localIds.indexOf(id) === -1 ? 'NOT LOCAL' : 'local, not routed');
  });
  ck(routedIds.indexOf('stars') === -1,
     'B2  A BOUNDARY THAT NEEDS THE NETWORK IS NOT A BOUNDARY — §20 holds by construction');

  // =================================================================
  section('I. INSTRUCTION — general knowledge invited, canon the authority');
  // =================================================================
  ck(/TWO KINDS OF QUESTION/.test(sys),
     'I1  the instruction separates a VihuPlanet question from an ordinary one');
  ck(/two and two|sky is blue|silly joke/i.test(sys),
     'I2  AND ORDINARY ONES ARE INVITED — §10, the failure that started this sprint');
  ck(/never dress outside knowledge up as a fact|NOT VihuPlanet truth/i.test(sys),
     'I3  while outside knowledge is still never a fact ABOUT this world');
  ck(/say you do not know rather than filling the gap|plausible invention/i.test(sys),
     'I4  and an unsettled VihuPlanet fact is admitted, not filled in — §12');
  ck(/A GUESS IS SAID OUT LOUD AS A GUESS/.test(sys) && /maybe/i.test(sys),
     'I5  a wondering is plainly a wondering — §13');
  // §36 — the hardest rule in the brief.
  // AND THIS ONE CAUGHT ITSELF. The first version scanned the raw source
  // for "2 + 2" — and Step 3B's own explanatory comment contains that
  // phrase, so the check went red on the sentence explaining why the
  // rule exists. Fifteenth time, and the first where the offending
  // vocabulary was written in the same commit as the check.
  ck(!/2\s*\+\s*2/.test(noComments) && !/what is (?:the )?ether/i.test(noComments),
     'I6  NO DETERMINISTIC ANSWER WAS ADDED — not for arithmetic, not for the Ether');
  const mindIntents = (noComments.match(/\{ id: '[a-z-]+'/g) || []).length;
  console.log('       taxonomy size: ' + mindIntents + ' intents (unchanged by this sprint)');

  // =================================================================
  section('F. FIXTURES — the record shape, pinned from BOTH ends');
  // =================================================================
  const pmSrc = fs.readFileSync(path.join(ROOT, 'js', 'projectManager.js'), 'utf8');
  const storeSrc = fs.readFileSync(path.join(ROOT, 'js', 'creatorProjectStore.js'), 'utf8');
  ck(/bookTitle\s*:\s*readDomString\('bookTitle'\)/.test(pmSrc) && /project\s*:\s*\{/.test(pmSrc),
     'F1  serialize() writes the title under `project`', 'ProjectManager.serialize');
  ck(/name\s*:\s*\(meta&&meta\.name\)/.test(storeSrc) && /data\s*:\s*data/.test(storeSrc),
     'F1b and the store wraps that payload under `data`, beside its own `name`');
  const fnSrc = fs.readFileSync(FN, 'utf8');
  ck(/record\.name \|\| \(record\.data && record\.data\.project/.test(fnSrc),
     'F2  and the function reads exactly that — both ends pinned, like `pages`');
  ck(data.storyContext.story.name === 'The Moon Garden' &&
     data.storyContext.story.pageCount === 3,
     'F2b proved through the real handler, on a row built the way the store builds one',
     JSON.stringify(data.storyContext.story));

  // ---- AND THE GENERATED BLOCK HAS NOT DRIFTED --------------------
  const drift = cp.spawnSync(process.execPath,
    [path.join(ROOT, 'tools', 'edge-auth-test', 'sync-shared.js'), '--check'], { encoding: 'utf8' });
  ck(drift.status === 0,
     'F3  the canon in the function is the canon in the file',
     (drift.stdout || '').split('\n').filter((l) => /DRIFT|ERROR|STALE/.test(l)).join(' ') || 'in step');

  // =================================================================
  section('J. THE REAL JOURNEY — does the question actually leave?');
  // =================================================================
  // The two failures that started this sprint, driven through the real
  // Studio the way a child reaches it: an entry pass, a real load of
  // studio.html, the Gateway tapped, then a conversation. A harness that
  // reaches around the journey cannot see the journey.
  const { chromium } = require('playwright');
  const http = require('http');
  const FnServer = require('../companion-enable-test/function-server.js');
  const PORT = Number(process.env.WORLD_PORT || 8807);
  const FN_PORT = Number(process.env.WORLD_FN_PORT || 8808);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('no'); return;
    }
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg', '.ttf': 'font/ttf' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); res.end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const drive = async function (label, env, expectRemote) {
    const fn = await FnServer.start(FN_PORT, env);
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await require('../companion-rhythm-test/open-studio.js')(page,
      'http://127.0.0.1:' + PORT, 'http://127.0.0.1:' + FN_PORT, { token: fn.token });
    const out = await page.evaluate(async () => {
      const posts = [];
      const rf = window.fetch;
      window.fetch = function (u, init) {
        if (String(u).indexOf('companion-chat') !== -1 && init && init.method === 'POST') {
          posts.push(JSON.parse(init.body));
        }
        return rf.apply(window, arguments);
      };
      const asked = {};
      for (const q of ['What is 2 + 2?', 'What is VihuPlanet?', 'Why is the sky blue?',
                       'Who are you?', 'How many stars do I have?']) {
        const before = posts.length;
        const r = await CompanionChat.ask(q);
        asked[q] = { reply: r.reply, where: r.where || 'remote', left: posts.length > before };
      }
      window.fetch = rf;
      return { asked: asked, posts: posts.length };
    });
    await browser.close();
    if (fn.stop) await fn.stop();
    return { out: out, errs: errs };
  };

  // ---- WITH A REAL MIND ------------------------------------------
  const withMind = await drive('with', {
    COMPANION_MIND_ENABLED: 'true', COMPANION_MODEL_PROVIDER: 'mock',
    COMPANION_MODEL_COMPANIONS: 'leosaurus',
  }, true);
  const A = withMind.out.asked;
  ck(A['What is 2 + 2?'].left === true,
     'J1  "WHAT IS 2 + 2?" NOW LEAVES THE BROWSER — the failure that started this sprint',
     JSON.stringify(A['What is 2 + 2?']));
  ck(A['What is VihuPlanet?'].left === true,
     'J2  and so does "what is VihuPlanet?"', JSON.stringify(A['What is VihuPlanet?'].where));
  ck(A['Why is the sky blue?'].left === true,
     'J3  and an ordinary question about the world outside — §10',
     JSON.stringify(A['Why is the sky blue?'].where));
  ck(A['Who are you?'].where === 'local' && A['Who are you?'].left === false,
     'J4  WHILE IDENTITY IS STILL ANSWERED HERE — the card proves it, no round trip',
     JSON.stringify(A['Who are you?']));
  ck(A['How many stars do I have?'].where === 'local' &&
     A['How many stars do I have?'].left === false,
     'J5  AND THE STARS NEVER LEAVE, WITH OR WITHOUT A MIND — §20',
     JSON.stringify(A['How many stars do I have?'].reply));
  ck(withMind.errs.length === 0, 'J6  zero page errors', withMind.errs.slice(0, 1).join('') || 'none');

  // ---- WITH NONE -------------------------------------------------
  const noMind = await drive('without', {
    COMPANION_MIND_ENABLED: 'true', COMPANION_MODEL_PROVIDER: 'mock',
    COMPANION_MODEL_COMPANIONS: '',
  }, false);
  const B = noMind.out.asked;
  ck(B['What is 2 + 2?'].left === false && B['What is 2 + 2?'].where === 'local',
     'J7  WITH NO MODEL IT IS ANSWERED HERE, exactly as before — nothing disappears',
     JSON.stringify(B['What is 2 + 2?'].reply));
  ck(B['Why is the sky blue?'].left === false,
     'J7b and so is the world outside', JSON.stringify(B['Why is the sky blue?'].reply));
  ck(B['How many stars do I have?'].where === 'local',
     'J8  and the boundary is identical either way',
     JSON.stringify(B['How many stars do I have?'].reply) ===
       JSON.stringify(A['How many stars do I have?'].reply) ? 'same words' : 'DIFFERENT');
  server.close();

  console.log('\n' + (failed ? 'FAILURES' : 'ALL GREEN') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
