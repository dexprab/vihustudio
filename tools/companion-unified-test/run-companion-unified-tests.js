#!/usr/bin/env node
/**
 * tools/companion-unified-test — STEP 3C/3D
 *
 * ONE REAL MIND, ACROSS VIHUPLANET, FOR ALL FOUR COMPANIONS.
 *
 * Two axes, kept apart, and this suite is organised by them:
 *
 *   WHERE (Studio | Ether)  decides what may be SEEN — and nothing else.
 *   WHO   (four Companions) decides identity, character and voice — and
 *                           nothing else.
 *
 *   U. ONE IMPLEMENTATION  — no second brain anywhere
 *   E. THE ETHER PATH      — shared-story authority, cardless, bounded
 *   W. WHO IS SPEAKING     — from the row, never the request
 *   C. CHARACTER           — all four reach the model as themselves
 *   P. PRIVACY             — Studio-private never reaches the Ether
 *   S. STARS               — absent, not merely forbidden
 *   M. MEMORY              — server-owned, never in the Ether
 *   V. VOICE               — four voiceIds, no cross-contamination
 *   Z. SIZE                — measured per surface and per Companion
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-unified-test/run-companion-unified-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'companion-chat', 'index.ts');

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n + (note ? '  (' + note + ')' : ''));
         console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}
function section(t) { console.log('\n' + t); }

const COMPANIONS = [
  { id: 'leafy', name: 'Leafy', species: 'Bloomling' },
  { id: 'leosaurus', name: 'Leo', species: 'Lantern Lion' },
  { id: 'quill', name: 'Quill', species: 'Ink Spirit' },
  { id: 'nimbus', name: 'Nimbus', species: 'Dream Sprite' },
];
const PROSE = 'SECRET PROSE THAT MUST NEVER BE RECITED';
const PRIVATE_NAME = 'Vihaan';
const NICKNAME = 'Spark';

(async () => {
  console.log('\nUNIFIED COMPANION MIND — Step 3C/3D');

  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const tmp = path.join(os.tmpdir(), 'vihu-unified-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);
  const src = fs.readFileSync(FN, 'utf8');

  // ---- THE WORLD THESE TESTS RUN IN --------------------------------
  const sharedStory = (companion) => ({
    id: 'proj_pub_' + companion.id, owner_id: 'user-maker', is_shared: true,
    data: {
      id: 'proj_pub_' + companion.id, name: 'The Moon Garden',
      cardId: 'card_maker', creatorName: 'Mira',
      companion: { id: companion.id, name: companion.name, species: companion.species },
      data: { project: { bookTitle: 'The Moon Garden' },
              pages: [{ storyBeat: PROSE }, { storyBeat: 'b' }, { storyBeat: 'c' }] },
    },
  });
  const draft = {
    id: 'proj_draft', owner_id: 'user-maker', is_shared: false,
    data: { id: 'proj_draft', name: 'A Draft', companion: { id: 'leafy', name: 'Leafy' },
            data: { pages: [{ storyBeat: 'private' }] } },
  };
  // ONE PER COMPANION. authorizeStory refuses a record whose `cardId`
  // belongs to a different card — correctly — so a single shared
  // fixture would have been refused for three of the four and looked
  // exactly like a product bug.
  const creatorStory = (c) => ({
    id: 'proj_mine_' + c.id, owner_id: 'user-a', is_shared: false,
    data: { id: 'proj_mine_' + c.id, name: 'My Own Story', cardId: 'card_' + c.id,
            data: { project: { bookTitle: 'My Own Story' },
                    pages: [{ storyBeat: 'A garden on the moon.', metadata: { stickers: [{}] } }] } },
  });
  const cards = COMPANIONS.map((c) => ({
    id: 'card_' + c.id, card_id: 'card_' + c.id, owner_id: 'user-a',
    companion_id: c.id, companion_name: c.name, companion_species: c.species,
    nickname: PRIVATE_NAME,
  }));
  const memories = [{ type: 'shared', content: 'Creator said they like dragons',
    importance: 3, confidence: 'confirmed', entities: [], card_id: 'card_leosaurus' }];

  let sent = null; let calls = [];
  const fetchImpl = async (url, init) => {
    const u = String(url);
    calls.push({ u: u, m: (init && init.method) || 'GET' });
    if (u.includes('api.openai.com')) {
      sent = JSON.parse(init.body);
      return new Response(JSON.stringify({ choices: [{ message: { content:
        JSON.stringify({ reply: 'ok', speak: true, memoryProposal: null }) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-a' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('creator_projects')) {
      const wantShared = /is_shared=eq\.true/.test(u);
      const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || '');
      let rows = COMPANIONS.map(sharedStory).concat(COMPANIONS.map(creatorStory))
        .concat([draft]).filter((r) => r.id === id);
      if (wantShared) rows = rows.filter((r) => r.is_shared);
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('magic_card_identities')) {
      // FILTERED, like the real table. Returning every card regardless
      // of the query would let authorizeCardAccess pick the first one
      // and quietly answer every Creator as Leafy — a fixture proving
      // the opposite of what it was written for.
      const want = decodeURIComponent((u.match(/(?:card_)?id=eq\.([^&]+)/) || [])[1] || '');
      const rows = want ? cards.filter((c) => c.id === want || c.card_id === want) : cards;
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.includes('creator_companion_memory')) {
      return new Response(JSON.stringify(memories), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const envOf = () => {
    const all = {
      SUPABASE_URL: 'https://db.example', SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's',
      COMPANION_MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-x',
      OPENAI_PRODUCTION_ENABLED: 'true', OPENAI_ZDR_CONFIRMED: 'true',
      COMPANION_MIND_ENABLED: 'true',
      COMPANION_MODEL_COMPANIONS: COMPANIONS.map((c) => c.id).join(','),
    };
    return (n) => (all[n] == null ? '' : String(all[n]));
  };
  const post = async (body) => {
    sent = null; calls = [];
    const h = M.makeHandler({ env: envOf(), fetchImpl: fetchImpl, now: () => Date.now() });
    const res = await h(new Request('https://fn/companion-chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    }));
    const parsed = JSON.parse(await res.text());
    let data = null, sys = null;
    if (sent) {
      sys = String(sent.messages[0].content);
      data = JSON.parse(String(sent.messages[1].content).replace(/^[^{]*/, ''));
    }
    return { status: res.status, body: parsed, sent: sent, data: data, sys: sys,
             // THE RATE LIMITER IS NOT A DATA WRITE. It is an RPC that
             // counts an allowance, it is the protection §29 asks for,
             // and counting it here would report every protected turn as
             // a mutation.
             writes: calls.filter((c) => c.m !== 'GET' && !/openai/.test(c.u)
               && !/rpc\/edge_rate_limit_hit/.test(c.u)).length };
  };
  const asTraveller = (companion, text) => post({ mode: 'traveller',
    storyId: 'proj_pub_' + companion.id, conversation: [{ role: 'traveller', text: text }] });
  const asCreator = (companion, text) => post({ cardId: 'card_' + companion.id,
    storyId: 'proj_mine_' + companion.id, pageId: 0,
    conversation: [{ role: 'creator', text: text }] });

  // =================================================================
  section('U. ONE IMPLEMENTATION — there is no second brain');
  // =================================================================
  const FORBIDDEN_BRAINS = ['TravellerBrain', 'CreatorBrain', 'LeafyBrain',
                            'LeoBrain', 'QuillBrain', 'NimbusBrain', 'EtherMind'];
  const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  const allJs = jsFiles.map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
  const brains = FORBIDDEN_BRAINS.filter((b) => (allJs + src).indexOf(b) !== -1);
  ck(brains.length === 0, 'U1  NO SEPARATE BRAIN EXISTS ANYWHERE', brains.join(', ') || 'none');
  const talk = fs.readFileSync(path.join(ROOT, 'js', 'travellerTalk.js'), 'utf8');
  ck(/functions\/v1\/' \+ FN/.test(talk) && /companion-chat/.test(talk),
     'U2  and the Ether asks the SAME function the Studio asks');
  ck((src.match(/function systemInstructions\(/g) || []).length === 1 &&
     (src.match(/function buildMessages\(/g) || []).length === 1,
     'U3  one instruction builder and one message builder, shared by both surfaces');

  // =================================================================
  section('E. THE ETHER PATH — a shared Story is the whole authority');
  // =================================================================
  const eth = await asTraveller(COMPANIONS[2], 'What is Ether?');
  ck(eth.body.ok === true && !!eth.sent,
     'E1  A TRAVELLER WITH NO CARD REACHES THE REAL MIND', JSON.stringify(eth.body.reply));
  const priv = await post({ mode: 'traveller', storyId: 'proj_draft',
    conversation: [{ role: 'traveller', text: 'hello' }] });
  ck(priv.status === 403 && !priv.sent,
     'E2  AN UNSHARED DRAFT IS REFUSED, and the model is never asked',
     JSON.stringify(priv.body));
  const ghost = await post({ mode: 'traveller', storyId: 'proj_does_not_exist',
    conversation: [{ role: 'traveller', text: 'hello' }] });
  ck(ghost.status === priv.status && ghost.body.reason === priv.body.reason,
     'E2b and a Story that does not exist answers IDENTICALLY — no oracle',
     JSON.stringify(ghost.body.reason));
  const noStory = await post({ mode: 'traveller', conversation: [{ role: 'traveller', text: 'hi' }] });
  ck(noStory.status === 403 && !noStory.sent,
     'E3  and a Traveller naming no Story reaches nothing at all', JSON.stringify(noStory.body));
  ck(eth.writes === 0, 'E4  a Traveller turn writes NOTHING', eth.writes + ' writes');
  ck(!/openai/i.test(talk) && !/elevenlabs/i.test(talk),
     'E5  and no provider is reachable from the browser');

  // =================================================================
  section('W. WHO IS SPEAKING — from the row, never the request');
  // =================================================================
  const spoof = await post({ mode: 'traveller', storyId: 'proj_pub_quill',
    companionId: 'leosaurus', personality: { id: 'leosaurus', name: 'Leo' },
    conversation: [{ role: 'traveller', text: 'who are you?' }] });
  ck(spoof.data && spoof.data.personality.name === 'Quill',
     'W1  A REQUEST CLAIMING LEO ON QUILL\'S STORY STILL GETS QUILL',
     JSON.stringify(spoof.data && spoof.data.personality));
  const spoofStudio = await post({ cardId: 'card_leafy', storyId: 'proj_mine_leafy', pageId: 0,
    companionId: 'leosaurus', conversation: [{ role: 'creator', text: 'hi' }] });
  ck(spoofStudio.data && spoofStudio.data.personality.name === 'Leafy',
     'W1b and the same on a card — the row wins on both axes',
     JSON.stringify(spoofStudio.data && spoofStudio.data.personality));

  // =================================================================
  section('C. CHARACTER — all four reach the model as themselves');
  // =================================================================
  const seen = {};
  for (const c of COMPANIONS) {
    const t = await asTraveller(c, 'What is VihuPlanet?');
    const s = await asCreator(c, 'What is VihuPlanet?');
    seen[c.id] = { ether: t, studio: s };
    ck(t.sys && new RegExp(c.name).test(t.sys) && new RegExp(c.species).test(t.sys),
       'C1.' + c.id + '  is named and speciated in the instruction — Ether',
       c.name + ' / ' + c.species);
    ck(s.sys && new RegExp(c.name).test(s.sys) && new RegExp(c.species).test(s.sys),
       'C1b.' + c.id + ' and in the Studio', c.name);
    ck(t.sys && /WHO YOU ARE/.test(t.sys) && /Temperament:/.test(t.sys),
       'C2.' + c.id + '  AND CARRIES ITS AUTHORED CHARACTER — Decision 44',
       (t.sys.match(/Temperament: [^\n]{0,44}/) || ['(absent)'])[0]);
  }
  // NO CROSS-CONTAMINATION. Each instruction names its own Companion and
  // nobody else's — the failure §43 exists to catch.
  COMPANIONS.forEach((c) => {
    const others = COMPANIONS.filter((o) => o.id !== c.id);
    const bleed = others.filter((o) => new RegExp('\\b' + o.name + '\\b').test(seen[c.id].ether.sys));
    ck(bleed.length === 0, 'C3.' + c.id + '  names nobody else',
       bleed.map((o) => o.name).join(', ') || 'clean');
  });
  // AND THEY ARE ACTUALLY DIFFERENT. Four instructions, four characters.
  const temps = COMPANIONS.map((c) => (seen[c.id].ether.sys.match(/Temperament: ([^\n]+)/) || [])[1]);
  ck(new Set(temps).size === 4, 'C4  four distinct temperaments reach the model',
     new Set(temps).size + ' distinct of 4');

  // =================================================================
  section('P. PRIVACY — Studio-private never reaches the Ether');
  // =================================================================
  const ethAll = COMPANIONS.map((c) => JSON.stringify(seen[c.id].ether.sent)).join('\n');
  ck(ethAll.indexOf(PRIVATE_NAME) === -1,
     'P1  THE CREATOR\'S PRIVATE NAME IS ABSENT from every Ether request');
  ck(ethAll.indexOf(NICKNAME) === -1,
     'P2  and so is any Companion nickname');
  ck(ethAll.indexOf('card_') === -1 && ethAll.indexOf('proj_') === -1,
     'P3  and no card, no project id, no owner');
  ck(ethAll.indexOf(PROSE) === -1,
     'P4  AND NOT A WORD OF THE STORY — Decision 45: a count travels, a word never does');
  const ethCtx = seen.quill.ether.data;
  ck(ethCtx.storyContext.story.pageCount === 3 && !ethCtx.storyContext.page,
     'P4b the LENGTH travels and the pages do not',
     JSON.stringify(ethCtx.storyContext.story));
  ck(ethCtx.storyContext.story.creatorName === 'Mira',
     'P5  the maker\'s PUBLIC name travels — the portal already prints it (Decision 48 §6)',
     ethCtx.storyContext.story.creatorName);
  // And the Studio keeps what it always had.
  const stu = seen.leosaurus.studio.data;
  ck(!!stu.storyContext && !!stu.storyContext.page,
     'P6  THE STUDIO IS UNCHANGED — it still gets the page it always did');
  ck((stu.memories || []).length > 0,
     'P6b and the memories it always did', (stu.memories || []).length + ' memory');

  // =================================================================
  section('S. STARS — absent, never merely forbidden');
  // =================================================================
  const poisoned = await post({ mode: 'traveller', storyId: 'proj_pub_quill',
    stars: [1, 2, 3], constellation: 'orion', pattern: [4, 5],
    context: { stars: [9, 9], personality: { stars: 7 } },
    conversation: [{ role: 'traveller', text: 'how many stars do they have?' }] });
  // ---- WHAT "NO STARS" ACTUALLY MEANS -----------------------------
  //
  // NOT "the word never appears". The canon says, in as many words, that
  // a Creator is recognised by their own constellation of stars and that
  // a Companion must never say what is on anybody's card — that sentence
  // is the very thing that TELLS a model the boundary exists, and it is
  // public product knowledge rather than anybody's identity.
  //
  // The first draft of this check scanned for the word and went red on
  // the canon's own prose. Eighteenth time this repository has been
  // caught by a word matching inside its own vocabulary. The property is
  // STAR DATA: a pattern, a constellation name, a count, or a key that
  // could hold one — belonging to a particular Creator.
  const poisonedJson = poisoned.sent ? JSON.stringify(poisoned.sent) : '';
  const POISON = ['orion', '[1,2,3]', '[4,5]', '[9,9]', '"stars":', '"constellation":', '"pattern":'];
  const got = POISON.filter((t) => poisonedJson.toLowerCase().indexOf(t.toLowerCase()) !== -1);
  ck(got.length === 0,
     'S1  A POISONED REQUEST CARRIES NO STAR DATA TO THE MODEL',
     got.join(', ') || 'none of ' + POISON.length + ' probes survived');
  ck(poisoned.sent && !/\bhow many stars\b[^"]*\b(?:are|is|:)\s*\d/i.test(poisonedJson),
     'S1b and no count is answered anywhere in what was sent');
  const ethFields = seen.quill.ether.data;
  const walk = (o, out) => {
    if (!o || typeof o !== 'object') return out;
    Object.keys(o).forEach((k) => {
      if (/^(stars|constellation|pattern|sky)$/i.test(k)) out.push(k);
      walk(o[k], out);
    });
    return out;
  };
  const starKeys = walk(ethFields, []);
  ck(starKeys.length === 0,
     'S2  and the Ether context HAS NO FIELD that could hold one',
     starKeys.join(', ') || 'no such key at any depth');

  // =================================================================
  section('M. MEMORY — server-owned, and never in the Ether');
  // =================================================================
  COMPANIONS.forEach((c) => {
    ck((seen[c.id].ether.data.memories || []).length === 0,
       'M1.' + c.id + '  no memory reaches the Ether',
       (seen[c.id].ether.data.memories || []).length + '');
  });
  const smuggled = await post({ mode: 'traveller', storyId: 'proj_pub_quill',
    memories: [{ type: 'shared', content: 'they like dragons' }],
    conversation: [{ role: 'traveller', text: 'hi' }] });
  ck(smuggled.body.ok === false && !smuggled.sent,
     'M2  A CLIENT-SUPPLIED MEMORY IS REFUSED, not quietly dropped',
     JSON.stringify(smuggled.body.reason));
  ck(JSON.stringify(smuggled.body).indexOf('dragons') === -1,
     'M2b and the refusal never echoes what was supplied');
  ck(seen.quill.ether.writes === 0 && seen.leosaurus.studio.writes === 0,
     'M3  NEITHER SURFACE WRITES ANYTHING on an ordinary turn');

  // =================================================================
  section('Z. SIZE — measured per surface and per Companion');
  // =================================================================
  const sizes = {};
  COMPANIONS.forEach((c) => {
    sizes[c.id] = {
      ether: Math.round(JSON.stringify(seen[c.id].ether.sent).length / 4),
      studio: Math.round(JSON.stringify(seen[c.id].studio.sent).length / 4),
    };
  });
  console.log('       tokens  ' + COMPANIONS.map((c) =>
    c.name + ' E:' + sizes[c.id].ether + ' S:' + sizes[c.id].studio).join('   '));
  const spread = Math.max(...COMPANIONS.map((c) => sizes[c.id].ether)) -
                 Math.min(...COMPANIONS.map((c) => sizes[c.id].ether));
  ck(spread < 900, 'Z1  the four differ only by their own character, not by architecture',
     spread + ' tokens between the largest and smallest');
  ck(COMPANIONS.every((c) => sizes[c.id].ether < sizes[c.id].studio),
     'Z2  and the Ether request is SMALLER — it carries less, by design',
     COMPANIONS.map((c) => sizes[c.id].studio - sizes[c.id].ether).join('/'));
  // ONLY THE ACTIVE COMPANION IS REPRESENTED — §26.
  COMPANIONS.forEach((c) => {
    const others = COMPANIONS.filter((o) => o.id !== c.id)
      .filter((o) => JSON.stringify(seen[c.id].ether.sent).indexOf(o.species) !== -1);
    ck(others.length === 0, 'Z3.' + c.id + '  no other Companion is in the request',
       others.map((o) => o.name).join(', ') || 'only itself');
  });

  // =================================================================
  section('V. VOICE — four voiceIds, and nobody borrows one');
  // =================================================================
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'registry.json'), 'utf8'));
  const entries = Array.isArray(registry) ? registry
    : (registry.companions || registry.characters || []);
  const voice = {};
  entries.forEach((e) => { if (e && e.id) voice[e.id] = (e.voice || {}); });
  COMPANIONS.forEach((c) => {
    ck(voice[c.id] && voice[c.id].voiceId,
       'V1.' + c.id + '  has a configured voice of its own', (voice[c.id] || {}).voiceId || 'NONE');
  });
  const ids = COMPANIONS.map((c) => (voice[c.id] || {}).voiceId);
  ck(new Set(ids).size === 4, 'V2  FOUR DISTINCT voiceIds — no cross-contamination',
     new Set(ids).size + ' distinct of 4');
  // AND THE ROUTE TO ONE IS THE CARD OR THE STORY, never a request.
  const chat = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  ck(/function _companionId\(\)[\s\S]{0,300}MagicCard\.getActive/.test(chat),
     'V3  the Studio takes the voice from the active card');
  ck(/function _hostId\(\)\s*\{\s*return _ctx \? _ctx\.companionId/.test(talk),
     'V3b and the Ether from the Story\'s own host — Decision 24');
  const speak = fs.readFileSync(path.join(ROOT, 'js', 'companionSpeak.js'), 'utf8');
  ck(!/leafy|leosaurus|quill|nimbus/i.test(speak),
     'V4  and the speaking module names no Companion at all');
  // 3A.1's synchronisation is untouched by this sprint.
  ck(/CompanionSpeak\.ready\(/.test(chat) && /CompanionSpeak\.ready\(/.test(talk),
     'V5  BOTH surfaces still hold the words for their voice — 3A.1 intact');

  console.log('\n' + (failed ? 'FAILURES' : 'ALL GREEN') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
