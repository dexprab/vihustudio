/* COMPANION MEMORY — verification suite for Sprint 1B.
 *
 * What is under test is a store with NO INTELLIGENCE IN IT. So the
 * questions are not "did it understand" — they are "did it record
 * exactly what happened, exactly once, and can nobody else read it".
 *
 *   A. THE DATABASE, EXECUTED  (supabase/migrations_companion_memory.sql)
 *      · the migration applies, and applies twice
 *      · CREATOR A CANNOT READ CREATOR B'S MEMORIES — as a real second
 *        session, against the real policies, on a real PostgreSQL
 *      · nor write one, nor change one, nor delete one
 *      · A TRAVELLER HAS NO ROW TO READ: card_id is NOT NULL, and a
 *        session holding no card and no grant sees nothing at all
 *      · a proven Magic Card recall widens SELECT and NOTHING else
 *      · deduplication is the constraint, not a habit
 *      · supabase/verify_companion_memory.sql returns all-PASS and
 *        leaves nothing behind
 *
 *   B. THE STORE, IN THE REAL STUDIO  (js/companionMemory.js)
 *      · a memory is made, and asking twice does not make two
 *      · it survives a reload
 *      · a Traveller's write is REFUSED — not written and swept
 *      · a second Creator on the same machine sees none of the first's
 *      · status moves, and the cleanup can never take a protected one
 *      · retrieval is exact: an entity match beats recency, and a
 *        question about one thing is never answered with another
 *      · what a future model would receive carries no identifier
 *
 *   C. THE RECORDERS, IN THE REAL STUDIO  (js/companionMemoryEvents.js)
 *      · a first story makes exactly one memory
 *      · opening it again makes none
 *      · a first character, a first share
 *      · coming back to an old story is remembered; carrying on with a
 *        fresh one is not
 *      · NOTHING IS INFERRED — every memory names something the
 *        application can prove
 *
 *   D. IT NEVER LEAVES VIHUPLANET
 *      · no request goes anywhere but this origin, measured
 *      · and no third-party host appears in either file's source
 *
 *   E. NOTHING ELSE MOVED
 *      · the Companion suite and the Garden suite still pass
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8788 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-memory-test/run-companion-memory-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CM_PORT || 8788);
const BASE = 'http://127.0.0.1:' + PORT;

// Declared HERE rather than beside the cluster helpers at the foot of
// the file: section A is the first thing the async block below does, so
// a `const` further down is still in its temporal dead zone when
// startPg() reads it. The first draft put these at the bottom, every
// cluster command threw a ReferenceError into a catch, and the suite
// reported "no PostgreSQL available" — a green-looking skip caused
// entirely by where a declaration sat.
const PGDIR = '/tmp/vihu-companion-memory-pg';
const PGPORT = 55437;

let passed = 0, failed = 0, skipped = 0;
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function sk(n, why) { skipped++; console.log('  --   ' + n + '  (' + why + ')'); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

// ===================================================================
// A. THE DATABASE
// ===================================================================
const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';
const T_UID = '33333333-3333-3333-3333-333333333333';   // a Traveller

function sqlSection() {
  console.log('\nA. THE DATABASE, EXECUTED  (supabase/migrations_companion_memory.sql)');
  const pg = startPg();
  if (!pg) { sk('A1-A16  the whole database section', 'no PostgreSQL — set CM_TEST_PG or install postgresql'); return; }
  try {
    const fix = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (fix) { no('A0  the fixture loads', fix.split('\n')[0]); return; }

    // A0 — it applies, and applies TWICE. Every migration in this repo
    // is written to be re-runnable, so that is tested rather than hoped.
    const m1 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_companion_memory.sql'));
    const m2 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_companion_memory.sql'));
    ck(!m1 && !m2, 'A0  the migration applies, and applies twice', 'safe to re-run');
    if (m1 || m2) return;

    // Supabase grants these by default privilege; a bare cluster does not.
    psql(pg, 'grant select, insert, update, delete on public.creator_companion_memory to anon, authenticated;');
    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern)
              values ('card_a','${A_UID}','Vihaan','ORION','[[1,2]]'),
                     ('card_b','${B_UID}','Meera','LYRA','[[3,4]]');`);

    // ---- Creator A remembers something -----------------------------
    const mine = asSession(pg, A_UID, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key,protected)
      values ('mem_a','${A_UID}','card_a','shared','We made your first story together.','first-story',true);`);
    ck(mine.code === 0, 'A1  a Creator can remember something of their own',
       mine.err.split('\n')[0] || 'inserted');

    const mineBack = asSession(pg, A_UID,
      "select count(*) from public.creator_companion_memory where id='mem_a';");
    ck(lines(mineBack).includes('1'), 'A1b and can read it back');

    // ---- THE ONE THAT MATTERS --------------------------------------
    const bSees = asSession(pg, B_UID, 'select count(*) from public.creator_companion_memory;');
    ck(lines(bSees).includes('0'),
       'A2  CREATOR B CANNOT READ CREATOR A\'S MEMORIES', 'creator_companion_memory_select');

    const bWrites = asSession(pg, B_UID, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_forge','${A_UID}','card_a','shared','A memory somebody else invented.','forged');`);
    ck(/row-level security/i.test(bWrites.err),
       'A3  nor write one INTO Creator A\'s past', 'a claimed owner_id is refused, not trusted');

    asSession(pg, B_UID, "update public.creator_companion_memory set content='rewritten' where id='mem_a';");
    ck(psql(pg, "select content from public.creator_companion_memory where id='mem_a';").trim()
         === 'We made your first story together.',
       'A4  nor change one');

    asSession(pg, B_UID, "delete from public.creator_companion_memory where id='mem_a';");
    ck(psql(pg, "select count(*) from public.creator_companion_memory where id='mem_a';").trim() === '1',
       'A5  nor delete one');

    // ---- A TRAVELLER ------------------------------------------------
    const noCard = psql2(pg, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_t','${T_UID}',null,'shared','A Traveller memory.','t');`);
    ck(/not-null|null value/i.test(noCard.err),
       'A6  A TRAVELLER HAS NO ROW HERE AT ALL', 'card_id is NOT NULL — Decision 19');

    const tSees = asSession(pg, T_UID, 'select count(*) from public.creator_companion_memory;');
    ck(lines(tSees).includes('0'),
       'A7  and a session holding no card reads nothing', 'no public branch, unlike a shared Story');

    // ---- A PROVEN RECALL, and only SELECT ---------------------------
    psql(pg, `insert into public.magic_card_recalls(id,identity_id,recaller_id)
              values ('rec_1','card_a','${B_UID}');`);
    const recalled = asSession(pg, B_UID, "select count(*) from public.creator_companion_memory where id='mem_a';");
    ck(lines(recalled).includes('1'),
       'A8  a PROVEN Magic Card recall carries the past to a new device',
       'has_magic_recall_grant — the same widening creator_library has');
    asSession(pg, B_UID, "delete from public.creator_companion_memory where id='mem_a';");
    ck(psql(pg, "select count(*) from public.creator_companion_memory where id='mem_a';").trim() === '1',
       'A8b and it widens SELECT ONLY — a recalled memory is read, never rewritten');
    psql(pg, "delete from public.magic_card_recalls;");

    // ---- deduplication ----------------------------------------------
    const dup = asSession(pg, A_UID, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_a2','${A_UID}','card_a','shared','The same moment, again.','first-story');`);
    ck(/duplicate key|unique/i.test(dup.err),
       'A9  the same moment twice is ONE memory', 'unique (card_id, dedupe_key)');

    const other = asSession(pg, A_UID, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_a3','${A_UID}','card_a2','shared','Another Creator, same milestone.','first-story');`);
    ck(other.code === 0, 'A9b but two Creators each keep their own',
       'the key is scoped to the card, never global');

    // ---- a transcript will not fit -----------------------------------
    const long = psql2(pg, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_long','${A_UID}','card_a','shared','${'x'.repeat(401)}','long');`);
    ck(/check constraint|violates check/i.test(long.err),
       'A10 a conversation will not fit in a memory', 'content is capped at 400 characters');

    const badKind = psql2(pg, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,dedupe_key)
      values ('mem_k','${A_UID}','card_a','everything','x','k');`);
    ck(/check constraint|violates check/i.test(badKind.err),
       'A11 only the four agreed kinds', 'self · creator · shared · world');

    const inferred = psql2(pg, `insert into public.creator_companion_memory
      (id,owner_id,card_id,kind,content,confidence,dedupe_key)
      values ('mem_i','${A_UID}','card_a','creator','x','guessed','i');`);
    ck(/check constraint|violates check/i.test(inferred.err),
       'A11b and only the three agreed confidences');

    // ---- the verifier ------------------------------------------------
    const before = psql(pg, 'select count(*) from public.creator_companion_memory;').trim();
    const ver = psqlOut(pg, path.join(ROOT, 'supabase', 'verify_companion_memory.sql'));
    ck(!/FAIL/.test(ver) && /all checks pass/.test(ver),
       'A12 verify_companion_memory.sql returns all-PASS',
       (ver.match(/(\d+) FAILED/) || [])[0] || 'every row PASS');
    ck(psql(pg, 'select count(*) from public.creator_companion_memory;').trim() === before,
       'A12b and leaves nothing behind', 'safe to run on a live project');
  } finally { stopPg(pg); }
}

// ===================================================================
// B + C + D. THE REAL STUDIO
// ===================================================================
(async () => {
  console.log('\nCOMPANION MEMORY — Sprint 1B');
  sqlSection();

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  const offOrigin = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) offOrigin.push(u);
  });

  async function boot() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CompanionMemory !== 'undefined' && typeof CompanionMemoryEvents !== 'undefined' &&
      typeof MagicCard !== 'undefined' && typeof CreationFlow !== 'undefined',
      null, { timeout: 20000 });
    for (let i = 0; i < 6; i++) {
      const gone = await page.evaluate(() => {
        const ov = document.getElementById('gatewayOverlay');
        if (!ov || ov.hidden || !ov.offsetParent) return true;
        ov.click();
        return false;
      });
      if (gone) break;
      await page.waitForTimeout(700);
    }
    await page.evaluate(() => {
      const ov = document.getElementById('gatewayOverlay');
      if (ov) ov.style.display = 'none';
    });
  }

  await boot();

  // ---------------------------------------------------------------
  console.log('\nB. THE STORE  (js/companionMemory.js)');
  // ---------------------------------------------------------------

  // B0 — A TRAVELLER'S WRITE IS REFUSED. First, because after this the
  // suite holds a card and can never be a Traveller again.
  const traveller = await page.evaluate(() => {
    try { MagicCard.setActive(null); } catch (e) {}
    CompanionMemory._reset();
    const r = CompanionMemory.remember({ key: 'k', kind: 'shared', content: 'A Traveller memory.' });
    return { ok: r.ok, reason: r.reason, count: CompanionMemory.list({ status: 'any' }).length,
             card: !!MagicCard.getActive() };
  });
  ck(!traveller.card && !traveller.ok && traveller.reason === 'no-card' && traveller.count === 0,
     'B0  A TRAVELLER IS NOT REMEMBERED', 'refused at the door, not written and swept');
  ck(await page.evaluate(() => {
       const before = Object.keys(localStorage).filter((k) => k.indexOf('vihu-companion-memory') === 0);
       return before.length === 0;
     }), 'B0b and nothing was written to disk for them');

  // B1 — a card, and a memory.
  const made = await page.evaluate(() => {
    const c = MagicCard.claim('Creator A');
    MagicCard.setActive(c.id);
    CompanionMemory._reset();
    const one = CompanionMemory.remember({
      key: 'first-story', kind: 'shared', content: 'We made your first story together.',
      importance: 'high', entities: ['project:p1'], protected: true, source: 'suite'
    });
    const two = CompanionMemory.remember({
      key: 'first-story', kind: 'shared', content: 'Written a second time, on purpose.'
    });
    return { cardA: c.id, created1: one.created, created2: two.created,
             total: CompanionMemory.list().length,
             content: CompanionMemory.list()[0].content };
  });
  ck(made.created1 && !made.created2 && made.total === 1,
     'B1  a memory is made, and asking twice does not make two', 'one row per (card, key)');
  ck(made.content === 'We made your first story together.',
     'B1b and the FIRST telling is the one kept', 'a repeat never overwrites');

  // B2 — it survives a reload.
  await page.reload();
  await page.waitForFunction(() => typeof CompanionMemory !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => { const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none'; });
  const survived = await page.evaluate(() => ({
    n: CompanionMemory.list().length,
    key: (CompanionMemory.list()[0] || {}).key,
    card: (MagicCard.getActive() || {}).id
  }));
  ck(survived.n === 1 && survived.key === 'first-story',
     'B2  a memory survives a reload', 'localStorage, keyed on the card');

  // B3 — a SECOND Creator on the same machine.
  const scoped = await page.evaluate((cardA) => {
    const b = MagicCard.claim('Creator B');
    MagicCard.setActive(b.id);
    CompanionMemory._reset();
    const bSees = CompanionMemory.list({ status: 'any' }).length;
    CompanionMemory.remember({ key: 'first-story', kind: 'shared', content: 'B made one too.' });
    const bHas = CompanionMemory.list().length;
    MagicCard.setActive(cardA);
    CompanionMemory._reset();
    const aStill = CompanionMemory.list();
    return { bSees: bSees, bHas: bHas, aStill: aStill.length, aContent: (aStill[0] || {}).content };
  }, made.cardA);
  ck(scoped.bSees === 0, 'B3  a second Creator on the same machine sees NONE of the first\'s',
     'Decision 19 — scoped to the card that made it');
  ck(scoped.bHas === 1 && scoped.aStill === 1 &&
     scoped.aContent === 'We made your first story together.',
     'B3b and neither overwrites the other', 'the same key, two separate pasts');

  // B4 — status, and the cleanup that can never take a milestone.
  const life = await page.evaluate(() => {
    const id = CompanionMemory.list()[0].id;
    const moved = CompanionMemory.setStatus(id, 'dormant');
    const activeNow = CompanionMemory.list().length;
    const anyNow = CompanionMemory.list({ status: 'any' }).length;
    CompanionMemory.setStatus(id, 'active');
    const bad = CompanionMemory.setStatus(id, 'forgotten');
    return { moved: moved.ok, activeNow: activeNow, anyNow: anyNow, bad: bad.ok, back: CompanionMemory.list().length };
  });
  ck(life.moved && life.activeNow === 0 && life.anyNow === 1 && life.back === 1,
     'B4  a memory moves active → dormant → active', 'and dormant is not deleted');
  ck(!life.bad, 'B4b a status nobody agreed to is refused');

  // B5 — THE CEILING. Protected memories survive the cleanup; that is
  // the whole reason `protected` exists.
  const pruned = await page.evaluate(() => {
    const max = CompanionMemory.LIMITS.activeMax;
    for (let i = 0; i < max + 5; i++) {
      CompanionMemory.remember({ key: 'filler-' + i, kind: 'world', content: 'Filler ' + i + '.' });
    }
    const all = CompanionMemory.list({ status: 'any' });
    const active = CompanionMemory.list();
    const first = all.find((m) => m.key === 'first-story');
    return { total: all.length, active: active.length, max: max,
             firstStatus: first && first.status, firstProtected: first && first.protected,
             dormant: all.filter((m) => m.status === 'dormant').length };
  });
  ck(pruned.active <= pruned.max && pruned.dormant > 0,
     'B5  over the ceiling, the oldest step back to dormant',
     pruned.active + ' active of ' + pruned.total);
  ck(pruned.firstProtected && pruned.firstStatus === 'active',
     'B5b A PROTECTED MEMORY SURVIVES THE CLEANUP', 'a first story is never the thing that goes');

  // B6 — RETRIEVAL IS EXACT.
  const recall = await page.evaluate(() => {
    CompanionMemory.remember({ key: 'about-spark', kind: 'shared',
      content: 'We brought Spark to life together.', entities: ['library:lib_spark'] });
    const aboutSpark = CompanionMemory.relevant({ entities: ['library:lib_spark'] });
    const aboutNobody = CompanionMemory.relevant({ entities: ['library:lib_nobody'] });
    const byKind = CompanionMemory.relevant({ kinds: ['shared'], limit: 50 })
      .every((m) => m.kind === 'shared');
    return {
      first: (aboutSpark[0] || {}).content,
      onlyMatches: aboutSpark.every((m) => m.entities.indexOf('library:lib_spark') !== -1),
      nobody: aboutNobody.length,
      byKind: byKind,
      defaultLimit: CompanionMemory.relevant({}).length
    };
  });
  ck(recall.first === 'We brought Spark to life together.' && recall.onlyMatches,
     'B6  an exact entity match beats everything else', 'ids, not embeddings');
  ck(recall.nobody === 0,
     'B6b A QUESTION ABOUT ONE THING IS NEVER ANSWERED WITH ANOTHER',
     'no recency fallback — that is how a Companion says something true about the wrong thing');
  ck(recall.byKind && recall.defaultLimit === 6,
     'B6c kinds filter, and a retrieval is bounded', recall.defaultLimit + ' by default');

  // B7 — what a future model would receive.
  const ctx = await page.evaluate(() => {
    const c = CompanionMemory.context({ entities: ['library:lib_spark'] });
    const keys = c.memories.length ? Object.keys(c.memories[0]).sort() : [];
    return { keys: keys, raw: JSON.stringify(c) };
  });
  ck(ctx.keys.join(',') === 'confidence,content,importance,type',
     'B7  what leaves the store is four fields', ctx.keys.join(','));
  ck(!/card|mem_|owner|"id"|"at"|"key"/.test(ctx.raw),
     'B7b and carries NO identifier', 'no id, no cardId, no key, no timestamp');

  // ---------------------------------------------------------------
  console.log('\nC. THE RECORDERS  (js/companionMemoryEvents.js)');
  // ---------------------------------------------------------------

  // A clean card, so the recorders are met by a Creator with nothing.
  const c1 = await page.evaluate(async () => {
    const c = MagicCard.claim('Recorder Creator', null,
      { companionId: 'leafy', companionName: 'Leafy', companionSpecies: 'sprout' });
    MagicCard.setActive(c.id);
    CompanionMemory._reset();
    try { if (typeof CreatorProjectCache !== 'undefined') await CreatorProjectCache.hydrate(); } catch (e) {}
    const first = CompanionMemoryEvents.sync();
    const again = CompanionMemoryEvents.sync();
    return { card: c.id, first: first.created, again: again.created,
             stored: CompanionMemory.list({ status: 'any' }).map((m) => m.key) };
  });
  ck(c1.first.indexOf('bonded') !== -1 && c1.stored.indexOf('bonded') !== -1,
     'C0  the bond itself is the Companion\'s first memory', 'SELF — Canon 3, set once');
  ck(c1.again.length === 0,
     'C0b asking again makes nothing', 'sync() is idempotent by construction');

  // C1 — A FIRST STORY.
  const story = await page.evaluate(async () => {
    const id = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(id, { name: 'The Dragon Who Lost His Shoes' }, { pages: [] });
    const a = CompanionMemoryEvents.sync();
    const b = CompanionMemoryEvents.sync();
    const m = CompanionMemory.list({ status: 'any' }).find((x) => x.key === 'first-story');
    return { id: id, a: a.created, b: b.created, content: m && m.content,
             entities: m && m.entities, protectedFlag: m && m.protected,
             confidence: m && m.confidence, kind: m && m.kind };
  });
  ck(story.a.filter((k) => k === 'first-story').length === 1,
     'C1  A FIRST STORY MAKES EXACTLY ONE MEMORY');
  ck(story.b.length === 0, 'C2  REOPENING IT MAKES NONE', 'the key already exists');
  ck(story.content === 'We made your first story together — The Dragon Who Lost His Shoes.',
     'C1b and it names the story the child named', story.content);
  ck(story.entities && story.entities[0] === 'project:' + story.id,
     'C1c it points at a real record', 'entities are ids, and they resolve');
  ck(story.protectedFlag && story.kind === 'shared' && story.confidence === 'confirmed',
     'C1d protected, shared, confirmed', 'never inferred — there is no model in this build');

  // C3 — A FIRST CHARACTER.
  const character = await page.evaluate(async () => {
    if (typeof CreatorLibrary === 'undefined' || !CreatorLibrary.save) return { skip: true };
    try { await CreatorLibrary.whenReady(); } catch (e) {}
    const r = await CreatorLibrary.save({
      name: 'Spark',
      png: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    });
    const before = CompanionMemory.list({ status: 'any' }).length;
    const made = CompanionMemoryEvents.sync();
    const m = CompanionMemory.list({ status: 'any' }).find((x) => x.key === 'first-character');
    return { saved: !!(r && (r.ok || r.id || r.record)), before: before,
             made: made.created, content: m && m.content, entities: m && m.entities };
  });
  if (character.skip) sk('C3  a first character', 'CreatorLibrary.save unavailable');
  else {
    ck(character.made.filter((k) => k === 'first-character').length === 1,
       'C3  A FIRST CHARACTER MAKES EXACTLY ONE MEMORY');
    ck(/Spark/.test(character.content || ''),
       'C3b and it uses the child\'s own word for them', character.content);
  }

  // C4 — A FIRST SHARE. publishedAt is the Ether's own definition of
  // membership, stamped by the ceremony and nowhere else.
  const share = await page.evaluate((projId) => {
    const before = CompanionMemory.has('first-share');
    CreatorProjectStore.markPublished(projId);
    const made = CompanionMemoryEvents.sync();
    const m = CompanionMemory.list({ status: 'any' }).find((x) => x.key === 'first-share');
    return { before: before, made: made.created, content: m && m.content, source: m && m.source };
  }, story.id);
  ck(!share.before && share.made.filter((k) => k === 'first-share').length === 1,
     'C4  A FIRST SHARE IS REMEMBERED — and only once it happened',
     'nothing was said while the story was unshared');
  ck(share.source === 'state:published-at',
     'C4b from the record that decides it', share.source);

  // C5 — COMING BACK. A fresh story is being carried on with; only one
  // left alone for a fortnight is a return. Both halves go through a
  // REAL PAGE LOAD, because the snapshot the recorder reads is taken
  // once at load and never updated — which is the whole reason it can
  // be trusted, and therefore the whole thing worth testing.
  const ids = await page.evaluate(() => {
    const fresh = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(fresh, { name: 'Made Today' }, { pages: [] });
    const old = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(old, { name: 'The Old One' }, { pages: [] });
    // Age the stored record itself, the way forty real days would.
    const rec = CreatorProjectStore.get(old);
    rec.updatedAt = new Date(Date.now() - 40 * 86400000).toISOString();
    CreatorProjectCache.putLocal(rec);
    return { fresh: fresh, old: old };
  });

  async function afterReloadOpen(projectId) {
    await page.reload();
    await page.waitForFunction(() => typeof CompanionMemoryEvents !== 'undefined' &&
      typeof CreatorProjectCache !== 'undefined', null, { timeout: 20000 });
    await page.evaluate(() => { const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none'; });
    return page.evaluate(async (id) => {
      try { await CreatorProjectCache.hydrate(); } catch (e) {}
      CompanionMemoryEvents._snapshot();
      AppState.project = AppState.project || {};
      AppState.project.id = id;
      return CompanionMemoryEvents.sync().created.filter((k) => k.indexOf('returned:') === 0);
    }, projectId);
  }

  const freshMade = await afterReloadOpen(ids.fresh);
  ck(freshMade.length === 0,
     'C5  carrying on with a story made today is NOT "coming back to it"',
     'nothing old to find, so nothing is claimed');

  const oldMade = await afterReloadOpen(ids.old);
  ck(oldMade.length === 1 && oldMade[0] === 'returned:' + ids.old,
     'C5b RETURNING TO A STORY LEFT FOR A FORTNIGHT IS REMEMBERED',
     oldMade.join(',') || 'nothing made');

  const oldAgain = await afterReloadOpen(ids.old);
  ck(oldAgain.length === 0, 'C5c and only ever once per story',
     'the key names the story');

  // C6 — NOTHING IS INFERRED.
  const honesty = await page.evaluate(() => {
    const all = CompanionMemory.list({ status: 'any' });
    return {
      confidences: Array.from(new Set(all.map((m) => m.confidence))),
      kinds: Array.from(new Set(all.map((m) => m.kind))),
      creatorType: all.filter((m) => m.kind === 'creator').length,
      sources: Array.from(new Set(all.filter((m) => m.source !== 'unknown').map((m) => m.source)))
    };
  });
  ck(honesty.confidences.length === 1 && honesty.confidences[0] === 'confirmed',
     'C6  every memory in the store is CONFIRMED', 'nothing guessed, nothing inferred');
  ck(honesty.creatorType === 0,
     'C6b the CREATOR type has no producer, and that is correct',
     '"they prefer…" is an inference — a later sprint\'s job, under a gate');
  ck(honesty.sources.every((s) => s.indexOf('state:') === 0 || s === 'suite'),
     'C6c and every memory names the record that proves it', honesty.sources.join(' · '));

  // ---------------------------------------------------------------
  console.log('\nD. IT NEVER LEAVES VIHUPLANET');
  // ---------------------------------------------------------------
  // The Studio itself loads the Supabase client as a module, on every
  // page, and has since long before this sprint. So the assertion is
  // not "no request left the origin" — it is that EVERY request that
  // did is that one module, measured across the whole run. Anything the
  // memory layer reached for would show up here as a third host.
  const strays = Array.from(new Set(offOrigin))
    .filter((u) => !/^https:\/\/esm\.sh\/@supabase\/supabase-js/.test(u));
  ck(strays.length === 0,
     'D1  NOTHING BUT THE STUDIO\'S OWN SUPABASE MODULE LEFT THIS ORIGIN',
     strays.slice(0, 2).join(' ') || Array.from(new Set(offOrigin)).length + ' distinct host(s), all of them that module');

  const src = ['companionMemory.js', 'companionMemoryEvents.js']
    .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'));
  const code = src.map((s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'));
  ck(!/https?:\/\//.test(code.join('\n')),
     'D2  neither file contains a URL of any kind');
  ck(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(code.join('\n')),
     'D3  and neither opens a connection itself',
     'the only network call is ThemeRepositoryClient — this project\'s own database');
  ck(/openai|anthropic|analytics|telemetry/i.test(code.join('\n')) === false,
     'D4  no provider, no analytics, no third party');

  ck(pageErrors.length === 0, 'D5  zero page errors throughout',
     pageErrors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();

  // ---------------------------------------------------------------
  console.log('\nE. NOTHING ELSE MOVED');
  // ---------------------------------------------------------------
  if (process.env.CM_SKIP_SUITES) {
    sk('E1-E2  the neighbouring suites', 'CM_SKIP_SUITES set');
  } else {
    [['E1  the Companion suite still passes', 'companion-test/run-companion-tests.js', 'COMPANION_PORT'],
     ['E2  the Garden suite still passes', 'garden-test/run-garden-tests.js', 'GARDEN_PORT']]
      .forEach(([name, rel, portVar]) => {
        const file = path.join(ROOT, 'tools', rel);
        if (!fs.existsSync(file)) { sk(name, 'suite not present'); return; }
        const r = cp.spawnSync(process.execPath, [file], {
          cwd: ROOT, encoding: 'utf8',
          env: { ...process.env, [portVar]: String(PORT) }
        });
        const tail = (r.stdout || '').trim().split('\n').slice(-1)[0] || (r.stderr || '').split('\n')[0];
        ck(r.status === 0, name, tail);
      });
  }

  console.log('\n' + (failed ? 'FAILED' : (skipped ? 'PASSED (incomplete)' : 'PASSED')) +
    ' — ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// ===================================================================
// A throwaway PostgreSQL — the same shape tools/edge-auth-test uses,
// including the root wrapping on BOTH start and stop (an unwrapped stop
// leaves an orphaned postmaster holding the port, and the next run then
// reports a green-looking skip).
// ===================================================================
function sh(cmd) { return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

function startPg() {
  if (process.env.CM_TEST_PG) return { conn: process.env.CM_TEST_PG, own: false };
  let bin = null;
  for (const c of ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin']) {
    if (fs.existsSync(path.join(c, 'initdb'))) { bin = c; break; }
  }
  if (!bin) { try { bin = path.dirname(sh('which initdb').trim()); } catch (e) { return null; } }
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) { /* not running */ }
  try { fs.rmSync(PGDIR, { recursive: true, force: true }); } catch (e) {}
  try {
    fs.mkdirSync(PGDIR, { recursive: true });
    if (asRoot) sh(`chown postgres "${PGDIR}"`);
    sh(wrap(`"${bin}/initdb" -D "${PGDIR}" -A trust -U postgres`));
    sh(wrap(`"${bin}/pg_ctl" -D "${PGDIR}" -o "-p ${PGPORT} -k /tmp" -l "${PGDIR}/log" start`));
    return { conn: `-h /tmp -p ${PGPORT} -U postgres`, own: true, bin };
  } catch (e) { return null; }
}

function stopPg(pg) {
  if (!pg || !pg.own) return;
  const asRoot = (typeof process.getuid === 'function') && process.getuid() === 0;
  const wrap = (c) => (asRoot ? `su postgres -c '${c.replace(/'/g, "'\\''")}'` : c);
  try { sh(wrap(`"${pg.bin}/pg_ctl" -D "${PGDIR}" stop -m immediate`)); } catch (e) {}
}

function run(pg, args) {
  const r = cp.spawnSync('psql', [...pg.conn.split(' ').filter(Boolean), '-X', '-v', 'ON_ERROR_STOP=1', ...args],
    { encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), code: r.status };
}
function psql(pg, sql) { return run(pg, ['-q', '-t', '-A', '-c', sql]).out; }
function psql2(pg, sql) { return run(pg, ['-q', '-t', '-A', '-c', sql]); }
function psqlOut(pg, file) { return run(pg, ['-f', file]).out; }
function loadFile(pg, file) { const r = run(pg, ['-q', '-f', file]); return r.code === 0 ? '' : (r.err || 'failed'); }
function lines(r) { return r.out.split('\n').map((l) => l.trim()); }

// A block that runs as somebody's BROWSER SESSION: the `anon` role with
// an auth.uid() that is theirs. This is what makes section A a proof
// rather than an assertion — every cross-Creator attempt below is
// performed BY that other Creator, against the real policies.
function asSession(pg, uid, sql) {
  return psql2(pg, ['begin;', 'set local role anon;',
    `set local "test.uid" = '${uid}';`, sql, 'commit;'].join('\n'));
}
