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

  // =================================================================
  section('L. THE LOCATOR — the id the browser actually sends');
  // =================================================================
  // THE BUG THIS EXISTS FOR. js/etherFeed.js builds an entity as
  // `id: 'story-' + record.id` with the real project id on `source`.
  // travellerTalk read `story.projectId || story.id`, so it sent the
  // PREFIXED runtime id and the server answered 403 no-such-story on
  // every Ether turn, for every Companion.
  //
  // NO SUITE CAUGHT IT, and the reason is worth writing down: the
  // ether-encounter fixture story has no top-level `id` AT ALL, only
  // `source.projectId`, so the derivation came out null, the remote
  // path was never entered, and every check passed. A fixture that does
  // not match the real shape cannot see a bug about the real shape —
  // the fourth time in this sprint sequence.
  //
  // So this reads the entity shape OUT OF js/etherFeed.js rather than
  // restating it, and drives the real derivation against it.
  const feedSrc = fs.readFileSync(path.join(ROOT, 'js', 'etherFeed.js'), 'utf8');
  ck(/id:\s*'story-'\s*\+\s*record\.id/.test(feedSrc),
     'L1  the feed still prefixes the entity id — the fact this guards');
  ck(/projectId:\s*record\.id/.test(feedSrc),
     'L1b and still keeps the real project id on `source`');
  const talkSrc2 = fs.readFileSync(path.join(ROOT, 'js', 'travellerTalk.js'), 'utf8');
  const line = (talkSrc2.match(/_storyId = [^;]+;/) || [''])[0];
  ck(/source && story\.source\.projectId/.test(line),
     'L2  THE LOCATOR IS `source.projectId`', line.slice(0, 80));
  ck(!/\|\|\s*story\.id\b/.test(line),
     'L2b AND THERE IS NO FALLBACK TO `story.id` — the wrong id must not be sent',
     /story\.id/.test(line) ? 'STILL FALLS BACK' : 'no fallback');
  // Driven, not read: the real derivation against the real entity.
  const entity = { id: 'story-proj_abc123', title: 'A Story',
                   source: { projectId: 'proj_abc123', origin: 'creator',
                             companion: { id: 'leafy', name: 'Leafy' } } };
  const derive = new Function('story', 'let _storyId; ' + line + ' return _storyId;');
  ck(derive(entity) === 'proj_abc123',
     'L3  and it derives the id the server can actually find',
     JSON.stringify(derive(entity)));
  ck(derive({ id: 'story-x' }) === null,
     'L3b while an entity with no project id yields NOTHING rather than a wrong guess',
     JSON.stringify(derive({ id: 'story-x' })));

  // =================================================================
  section('T. THE SESSION — a token that expires is refreshed, not reused');
  // =================================================================
  // THE OTHER BUG THIS EXISTS FOR, and it was upstream of everything:
  // js/themeRepositoryClient.js cached a SESSION OBJECT for the life of
  // the page, so once the access token expired (about an hour) every
  // one of eleven callers was handed a dead one. Measured in production:
  // auth/v1/user 403, the function 401 UNAUTHORIZED_ASYMMETRIC_JWT.
  const trc = fs.readFileSync(path.join(ROOT, 'js', 'themeRepositoryClient.js'), 'utf8');
  ck(/refreshSession\s*\(/.test(trc),
     'T1  THE CLIENT CAN REFRESH — the call that was missing entirely');
  ck(/function _stale\(/.test(trc) && /expires_at/.test(trc),
     'T2  and it looks at `expires_at` before handing a token out');
  ck(/if \(_session && !_stale\(_session\)\) return Promise\.resolve\(_session\)/.test(trc),
     'T3  a LIVE token is returned straight away — the common case costs nothing');
  ck(/if \(_authPromise\) return _authPromise;/.test(trc),
     'T4  and eleven callers arriving at once make ONE refresh, not eleven');
  const refreshIdx = trc.indexOf('refreshSession');
  const anonIdx = trc.indexOf('signInAnonymously', refreshIdx);
  ck(refreshIdx > 0 && anonIdx > refreshIdx,
     'T5  REFRESH COMES FIRST, a new anonymous session second — the identity is `auth.uid()`, '
     + 'and a fresh one is a different person to every RLS policy');
  ck(/_authPromise = null;\s*\n\s*_session = null;\s*\n\s*throw error;/.test(trc),
     'T6  and a failed refresh is NOT remembered — one blink must not cost the visit');

  // =================================================================
  section('T7. THE SESSION, MEASURED — not read off the source');
  // =================================================================
  // The checks above read the file. This one RUNS it: a real browser, the
  // real js/themeRepositoryClient.js, and a stubbed supabase-js served in
  // place of the esm.sh module it imports. An expired session goes in;
  // what comes out is what eleven callers would actually be handed.
  {
    const { chromium } = require('playwright');
    const http = require('http');
    const PORT = Number(process.env.UNI_PORT || 8811);
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
    await page.route('**/supabase-config.json', (r) => r.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ url: 'https://db.example', anonKey: 'anon' }) }));
    // THE STUB IS THE PROVIDER, NOT THE PRODUCT. It records which auth
    // calls were made and hands back an EXPIRED session first.
    await page.route('**/esm.sh/**', (r) => r.fulfill({ status: 200,
      contentType: 'application/javascript', body: `
        globalThis.__calls = [];
        export function createClient() {
          let n = 0;
          return { auth: {
            getSession() {
              globalThis.__calls.push('getSession');
              // Already stored, and DEAD — the production state.
              return Promise.resolve({ data: { session: {
                access_token: 'expired.token', expires_at: Math.floor(Date.now()/1000) - 60 } } });
            },
            refreshSession() {
              globalThis.__calls.push('refreshSession');
              n++;
              return Promise.resolve({ data: { session: {
                access_token: 'fresh.token.' + n, expires_at: Math.floor(Date.now()/1000) + 3600 } } });
            },
            signInAnonymously() {
              globalThis.__calls.push('signInAnonymously');
              return Promise.resolve({ data: { session: {
                access_token: 'brand.new', expires_at: Math.floor(Date.now()/1000) + 3600 } } });
            },
          } };
        }` }));
    await page.goto('http://127.0.0.1:' + PORT + '/index.html');
    await page.waitForFunction(() => typeof ThemeRepositoryClient !== 'undefined', null, { timeout: 20000 });
    const out = await page.evaluate(async () => {
      const first = await ThemeRepositoryClient.getSession();
      // Eleven callers at once — how many refreshes does that make?
      globalThis.__calls.length = 0;
      const many = await Promise.all(Array.from({ length: 11 },
        () => ThemeRepositoryClient.getSession()));
      return { token: first && first.access_token,
               calls: globalThis.__calls.slice(),
               same: many.every((s) => s && s.access_token === many[0].access_token),
               reused: many[0].access_token };
    });
    await browser.close(); srv.close();
    ck(out.token === 'fresh.token.1',
       'T7  AN EXPIRED STORED SESSION IS REFRESHED, and the fresh token is what callers get',
       JSON.stringify(out.token));
    ck(out.calls.length === 0,
       'T7b and a LIVE token afterwards costs no auth call at all — 11 callers, ' +
       out.calls.length + ' calls', out.calls.join(',') || 'none');
    ck(out.same === true, 'T7c all eleven got the same live token', out.reused);
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log('\n' + (failed ? 'FAILURES' : 'ALL GREEN') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  failures.forEach((f) => console.log('   · ' + f));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
