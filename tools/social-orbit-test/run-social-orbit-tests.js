/* SPRINT SOCIAL 2 — MY ORBIT & MY CIRCLE.
 *
 * Orbit is a one-way choice nobody is told about; Circle is two
 * orbits facing each other, derived and never a button; the first
 * social act beyond Cheer is a CREATION made for somebody, never a
 * message. And none of it may ever make a child feel watched or
 * counted.
 *
 *   A. THE DATABASE, EXECUTED (supabase/migrations_social_orbit.sql)
 *      · orbit is owned: a stranger's identity answers like a
 *        nonexistent one
 *      · adding twice is one row; leaving is silent and idempotent
 *      · CIRCLE IS DERIVED: mutual rows → circle on both sides;
 *        either side leaving ends it
 *      · NOBODY CAN ASK "WHO ORBITS ME": no policies, no function
 *        answers it, a session's direct select sees nothing
 *
 *   B. THE ETHER, WALKED (js/creatorPresence.js · js/creatorOrbit.js)
 *      · the shelf offers 🌌 Add to My Orbit to a card-holder and
 *        nothing to a cardless Traveller
 *      · one tap → In My Orbit ✓, quiet Leave, 🎨 Make something
 *      · a mutual choice reads ✨ You're in each other's Circle
 *      · Find's own 🌌 My Orbit chips — the child's list, no counts
 *
 *   C. 🎨 MAKE SOMETHING FOR THEM — the whole journey
 *      · the shelf button leaves through the ONE Studio door with a
 *        one-shot note; Studio Home says where the story is going
 *      · the FIRST new story is dedicated (forUsername) and the note
 *        is consumed — the second new story is NOT
 *      · shared → the Preview and the reader say 🎨 For @name
 *      · the recipient's activity says "made something for you";
 *        seen once, then quiet
 *
 *   D. NO SOCIAL PRESSURE, ENFORCED
 *      · no follower/friend/streak/rank vocabulary in the layer
 *      · no digits anywhere on the orbit surfaces
 *      · the make-for note key is ONE string in both files
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/social-orbit-test/run-social-orbit-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ORBIT_PORT || 8796);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');

const PGDIR = '/tmp/vihu-social-orbit-pg';
const PGPORT = 55441;

let passed = 0, failed = 0, skipped = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function sk(n, why) { skipped++; console.log('  --   ' + n + '  (' + why + ')'); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';

// ===================================================================
// A. THE DATABASE, EXECUTED
// ===================================================================
function sqlSection() {
  console.log('\nA. THE DATABASE, EXECUTED  (supabase/migrations_social_orbit.sql)');
  const pg = startPg();
  if (!pg) { sk('A1-A9  the whole database section', 'no PostgreSQL'); return; }
  try {
    const fix = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (fix) { no('A0  the fixture loads', fix.split('\n')[0]); return; }
    // The real deployment order: identity (the username column) first.
    const mId = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_identity.sql'));
    if (mId) { no('A0  the identity migration underneath', mId.split('\n')[0]); return; }
    const m1 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_orbit.sql'));
    const m2 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_orbit.sql'));
    ck(!m1 && !m2, 'A0  the migration applies, and applies twice', m1 || m2 || 'clean');
    if (m1 || m2) return;

    // Supabase grants table privileges broadly by default; a bare
    // cluster does not. Granting them here is what makes A7 a proof
    // that RLS-with-no-policies does the hiding — not a missing grant.
    psql(pg, 'grant select, insert, update, delete on public.creator_orbits to anon, authenticated;');

    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username)
              values ('card_a','${A_UID}','Vihaan','ORION','[[1,2]]','moonmaker'),
                     ('card_b','${B_UID}','Meera','LYRA','[[3,4]]','stargirl'),
                     ('card_c','${A_UID}','Second','ORION','[[5,6]]',null);`);

    const call = (uid, fn, args) => {
      const r = asSession(pg, uid, `select public.${fn}(${args});`);
      try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); }
      catch (e) { return {}; }
    };

    let r = call(A_UID, 'creator_orbit_set', `'card_a','StarGirl',true`);
    ck(r.ok === true && r.orbited === true && r.circle === false,
       'A1  A CHOOSES TO SEE B — one way, and no circle yet', JSON.stringify(r));
    r = call(A_UID, 'creator_orbit_set', `'card_a','stargirl',true`);
    const rows = psql(pg, 'select count(*) from public.creator_orbits;');
    ck(r.ok === true && rows === '1',
       'A1b choosing twice is ONE choice — a success, not a duplicate', rows + ' row');

    r = call(B_UID, 'creator_orbit_set', `'card_a','moonmaker',true`);
    const ghost = call(B_UID, 'creator_orbit_set', `'card_ghost','moonmaker',true`);
    ck(r.ok === false && r.reason === 'not_yours' && ghost.reason === 'not_yours',
       'A2  A STRANGER CANNOT ORBIT FROM SOMEBODY ELSE\'S CARD — and a stranger\'s id answers like a missing one');

    r = call(A_UID, 'creator_orbit_set', `'card_a','nobodyatall',true`);
    const own = call(A_UID, 'creator_orbit_set', `'card_a','moonmaker',true`);
    ck(r.reason === 'unknown' && own.reason === 'own',
       'A3  an unknown name and your own name are each their own kind answer',
       JSON.stringify([r.reason, own.reason]));

    r = call(A_UID, 'creator_orbit_list', `'card_a'`);
    ck(r.ok === true && r.orbit.length === 1 && r.orbit[0].username === 'stargirl'
       && r.orbit[0].circle === false,
       'A4  MY ORBIT IS MY LIST — the names I chose, nothing else', JSON.stringify(r.orbit));

    // ---- THE MOMENT CIRCLE IS CREATED ------------------------------
    r = call(B_UID, 'creator_orbit_set', `'card_b','moonmaker',true`);
    ck(r.ok === true && r.circle === true,
       'A5  B CHOOSES A TOO → THE CIRCLE EXISTS, in that very answer', JSON.stringify(r));
    const aList = call(A_UID, 'creator_orbit_list', `'card_a'`);
    const bList = call(B_UID, 'creator_orbit_list', `'card_b'`);
    ck(aList.orbit[0].circle === true && bList.orbit[0].circle === true,
       'A5b and BOTH sides see it as Circle — not two independent orbits');

    // ---- either side leaving ends it, silently ---------------------
    r = call(B_UID, 'creator_orbit_set', `'card_b','moonmaker',false`);
    const aAfter = call(A_UID, 'creator_orbit_list', `'card_a'`);
    const bAfter = call(B_UID, 'creator_orbit_list', `'card_b'`);
    ck(r.ok === true && aAfter.orbit.length === 1 && aAfter.orbit[0].circle === false
       && bAfter.orbit.length === 0,
       'A6  EITHER SIDE LEAVING ENDS THE CIRCLE — no drama, and A still simply orbits',
       JSON.stringify({ a: aAfter.orbit, b: bAfter.orbit.length }));

    // ---- NOBODY CAN ASK WHO ORBITS THEM ----------------------------
    // A orbits B right now. B, as a real session, tries everything a
    // browser could try.
    const direct = asSession(pg, B_UID, 'select count(*) from public.creator_orbits;');
    ck(lines(direct).includes('0'),
       'A7  B\'S OWN SESSION SEES NO ROWS AT ALL — RLS on, no policies, no way to feel watched');
    const fns = psql(pg,
      `select string_agg(p.proname, ',') from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.prokind = 'f'
         and pg_get_functiondef(p.oid) ~* 'creator_orbits';`);
    ck(fns.split(',').sort().join(',') === 'creator_orbit_list,creator_orbit_set',
       'A7b and exactly TWO functions touch the table — neither answers "who orbits me"', fns);

    const verdict = psqlOut(pg, path.join(ROOT, 'supabase', 'verify_social_orbit.sql'));
    ck(/all checks pass/.test(verdict) && !/FAIL/.test(verdict),
       'A8  supabase/verify_social_orbit.sql answers all-PASS',
       (verdict.split('\n').find((l) => /OVERALL/.test(l)) || '').trim());
  } finally { stopPg(pg); }
}

// ===================================================================
(async () => {
  sqlSection();

  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn('node', [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.route('**/supabase-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'k' }),
  }));
  await page.route('http://supa.local.test/**', (route) => route.fulfill({
    contentType: 'application/json',
    body: route.request().url().indexOf('/rest/v1/') !== -1 ? '[]' : '{}',
  }));

  // ---- seed: two Creators with names and shared stories; the FIRST
  // stays ACTIVE — an Ether visited by a recognised Creator.
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
    typeof CreatorProjectStore !== 'undefined', null, { timeout: 20000 });
  const seeded = await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    try { CreatorProjectStore.clearAll({ all: true }); } catch (e) { try { CreatorProjectStore.clearAll(); } catch (e2) {} }
    function px(c) {
      const v = document.createElement('canvas'); v.width = 8; v.height = 8;
      const x = v.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 8, 8);
      return v.toDataURL('image/png');
    }
    const b = MagicCard.claim('Meera', null, { companionId: 'quill' });
    MagicCard.setActive(b.id);
    MagicCard._setLocalUsername(b.id, 'stargirl');
    const their = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(their, { name: 'The Star Garden' }, { version: 1, pages: [{ id: 'p1', readImage: px('#aa5533') }] });
    CreatorProjectStore.markPublished(their);

    const a = MagicCard.claim('Vihaan', null, { companionId: 'leafy' });
    MagicCard.setActive(a.id);
    MagicCard._setLocalUsername(a.id, 'moonmaker');
    const mine = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(mine, { name: 'The Moon Dragon' }, { version: 1, pages: [{ id: 'p1', readImage: px('#3355aa') }] });
    CreatorProjectStore.markPublished(mine);
    await new Promise((r) => setTimeout(r, 1200));
    return { aCard: a.id, bCard: b.id, their: their, mine: mine };
  });

  console.log('\nB. THE ETHER, WALKED  (the shelf · Orbit · Circle · My Orbit)');
  async function intoEther(url) {
    await page.goto(BASE + (url || '/index.html'));
    await page.waitForFunction(() => typeof EtherFeed !== 'undefined', null, { timeout: 20000 });
    for (let i = 0; i < 14; i++) {
      const crossed = await page.evaluate(() => {
        const b = document.querySelector('[data-begin]');
        if (b && b.getBoundingClientRect().width > 0) { b.click(); return false; }
        return true;
      });
      if (crossed) break;
      await page.waitForTimeout(500);
    }
  }
  await intoEther('/index.html?creator=stargirl');
  const shelf = await page.waitForFunction(() => {
    const o = document.querySelector('.creator-presence');
    if (!(o && !o.hidden)) return false;
    return { orbitBtn: !!document.querySelector('.creator-presence-orbit-add'),
             text: document.querySelector('.creator-presence-panel').innerText };
  }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  ck(!!shelf && shelf.orbitBtn && /Add to My Orbit/.test(shelf.text),
     'B1  A CARD-HOLDER IS OFFERED 🌌 Add to My Orbit on the shelf', shelf && shelf.text.replace(/\n/g, ' · '));

  const afterAdd = await page.evaluate(() => {
    document.querySelector('.creator-presence-orbit-add').click();
    return {
      state: (document.querySelector('.creator-presence-orbit-state') || {}).textContent,
      leave: !!document.querySelector('.creator-presence-orbit-leave'),
      makeFor: !!document.querySelector('.creator-presence-makefor'),
      addGone: !document.querySelector('.creator-presence-orbit-add'),
      has: CreatorOrbit.has('stargirl'),
    };
  });
  ck(afterAdd.state === 'In My Orbit ✓' && afterAdd.addGone && afterAdd.has,
     'B2  ONE TAP AND THE RELATIONSHIP QUIETLY EXISTS — In My Orbit ✓, no request, no notification',
     JSON.stringify(afterAdd.state));
  ck(afterAdd.leave && afterAdd.makeFor,
     'B2b with a quiet Leave and 🎨 Make something for them beside it');
  await page.screenshot({ path: path.join(SHOTS, 'B2-orbit.png') });

  // ---- Circle appears only because both chose ----------------------
  const circle = await page.evaluate(() => {
    // The platform's answer is what says "they chose you too" —
    // mutate the api object in place (Decision 40's recorded trap).
    const orig = { isConfigured: ThemeRepositoryClient.isConfigured, getClient: ThemeRepositoryClient.getClient };
    ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn) => Promise.resolve(fn === 'creator_orbit_list'
        ? { data: { ok: true, orbit: [{ username: 'stargirl', circle: true }] }, error: null }
        : { data: { ok: true, orbited: true, circle: true }, error: null })
    });
    return CreatorOrbit.add('stargirl').then((res) => {
      ThemeRepositoryClient.isConfigured = orig.isConfigured;
      ThemeRepositoryClient.getClient = orig.getClient;
      // redraw the shelf
      document.querySelector('.creator-presence-quiet').click();
      CreatorPresence.open('stargirl', {});
      return { res: res, state: (document.querySelector('.creator-presence-orbit-state') || {}).textContent };
    });
  });
  ck(circle.res.circle === true && circle.state === '✨ You’re in each other’s Circle',
     'B3  MUTUAL CHOICE READS AS CIRCLE — a fact, never a button', circle.state);

  const findPanel = await page.evaluate(() => {
    document.querySelector('.creator-presence-quiet').click();
    document.querySelector('[data-find]').click();
    return {
      head: !!document.querySelector('.creator-presence-orbit-head'),
      chips: Array.from(document.querySelectorAll('.creator-presence-suggest-btn')).map((b) => b.textContent),
      text: document.querySelector('.creator-presence-panel').innerText,
    };
  });
  ck(findPanel.head && findPanel.chips.indexOf('✨ @stargirl') !== -1,
     'B4  🌌 MY ORBIT stands in Find — the child\'s own list, a ✨ chip for a Circle', JSON.stringify(findPanel.chips));
  ck(!/\d/.test(findPanel.text.replace(/🔎|🌌|✨/g, '')),
     'B4b and NOT ONE NUMBER anywhere on it', findPanel.text.replace(/\n/g, ' · '));

  // ---- a cardless Traveller is offered none of this ----------------
  const traveller = await page.evaluate(() => {
    MagicCard.setActive(null);
    document.querySelector('.creator-presence-quiet').click();
    CreatorPresence.open('stargirl', {});
    const t = {
      orbit: !!document.querySelector('.creator-presence-orbit-add'),
      state: !!document.querySelector('.creator-presence-orbit-state'),
      makeFor: !!document.querySelector('.creator-presence-makefor'),
    };
    document.querySelector('.creator-presence-quiet').click();
    return t;
  });
  ck(!traveller.orbit && !traveller.state && !traveller.makeFor,
     'B5  A CARDLESS TRAVELLER SEES NO RELATIONSHIP CONTROLS — absent, not locked');
  await page.evaluate((id) => MagicCard.setActive(id), seeded.aCard);

  // ---------------------------------------------------------------
  console.log('\nC. 🎨 MAKE SOMETHING FOR THEM — the whole journey');
  // ---------------------------------------------------------------
  const noted = await page.evaluate(() => {
    CreatorPresence.open('stargirl', {});
    document.querySelector('.creator-presence-makefor').click();
    return { note: sessionStorage.getItem('vihu.makeFor.note'),
             pass: !!sessionStorage.getItem('vihu.studioEntry.pass') || window.location.pathname };
  }).catch(() => null);
  // The press NAVIGATES through the one Studio door; by the time we
  // can look, we may already be on studio.html. Either way the note
  // must be down.
  await page.waitForFunction(() => /studio\.html/.test(window.location.pathname), null, { timeout: 20000 }).catch(() => {});
  const arrived = await page.evaluate(() => ({
    where: window.location.pathname,
    note: sessionStorage.getItem('vihu.makeFor.note'),
  }));
  ck(/studio\.html/.test(arrived.where) && arrived.note === 'stargirl',
     'C1  THE PRESS LEAVES THROUGH THE ONE STUDIO DOOR, carrying a one-shot note — never a message',
     JSON.stringify(arrived));

  await page.waitForFunction(() => typeof CreatorProjectStore !== 'undefined' &&
    typeof CreatorOrbit !== 'undefined', null, { timeout: 20000 });
  const stamped = await page.evaluate(async () => {
    const first = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(first, { name: 'A Castle for the Star Garden' }, { version: 1, pages: [{ id: 'p1' }] });
    const second = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(second, { name: 'Something Else' }, { version: 1, pages: [{ id: 'p1' }] });
    CreatorProjectStore.markPublished(first);
    await new Promise((r) => setTimeout(r, 800));
    return {
      first: CreatorProjectStore.get(first).forUsername || null,
      second: CreatorProjectStore.get(second).forUsername || null,
      noteAfter: sessionStorage.getItem('vihu.makeFor.note'),
      firstId: first,
    };
  });
  ck(stamped.first === 'stargirl',
     'C2  THE FIRST NEW STORY IS DEDICATED — forUsername on the record, like creatorName');
  ck(stamped.second === null && stamped.noteAfter === null,
     'C2b and the note is CONSUMED — one journey, one dedication, the second story is the child\'s alone');

  // ---- the dedication where the story is met -----------------------
  await intoEther('/index.html?story=' + encodeURIComponent(stamped.firstId));
  const met = await page.waitForFunction(() => {
    const p = document.querySelector('[data-preview]');
    const t = (document.querySelector('[data-preview-title]') || {}).textContent || '';
    if (p && !p.hidden && /Castle/.test(t)) {
      const f = document.querySelector('[data-preview-for]');
      return { forLine: f ? f.textContent : null, hidden: f ? f.hidden : null };
    }
    const all = Array.prototype.slice.call(document.querySelectorAll('.vp-story'));
    if (all.length) { window.__t = ((window.__t || 0) + 1) % all.length; all[window.__t].click(); }
    return false;
  }, null, { timeout: 45000, polling: 800 }).then((h) => h.jsonValue()).catch(() => null);
  ck(!!met && met.hidden === false && met.forLine === '🎨 For @stargirl',
     'C3  THE PREVIEW SAYS WHO IT WAS MADE FOR — 🎨 For @stargirl', met && met.forLine);
  await page.screenshot({ path: path.join(SHOTS, 'C3-dedication.png') });

  const readerLine = await page.evaluate(() => {
    document.querySelector('[data-act="read"]').click();
    return new Promise((resolve) => setTimeout(() => {
      resolve((document.querySelector('[data-portal-creator]') || {}).textContent);
    }, 1500));
  });
  ck(/🎨 for @stargirl/.test(readerLine || ''),
     'C3b and so does the reader', readerLine);
  await page.evaluate(() => document.querySelector('[data-portal-close]').click());

  // ---- the recipient hears about it, once --------------------------
  const received = await page.evaluate(async (bCard) => {
    MagicCard.setActive(bCard);
    const first = await CreatorOrbit.activityLines();
    first.markSeen();
    const again = await CreatorOrbit.activityLines();
    return { lines: first.lines, again: again.lines };
  }, seeded.bCard);
  ck(received.lines.indexOf('🎨 @moonmaker made something for you') !== -1,
     'C4  THE RECIPIENT\'S ACTIVITY SAYS SOMEBODY MADE SOMETHING FOR THEM', JSON.stringify(received.lines));
  ck(received.again.indexOf('🎨 @moonmaker made something for you') === -1,
     'C4b said once, then quiet — never a nag');

  // ---- and orbit is discovery: new work from a chosen Creator ------
  const orbitNews = await page.evaluate(async (cards) => {
    MagicCard.setActive(cards.bCard);
    await CreatorOrbit.add('moonmaker'); // B chooses A (locally)
    const res = await CreatorOrbit.activityLines();
    return res.lines;
  }, { bCard: seeded.bCard });
  ck(orbitNews.some((l) => /@moonmaker made something new$/.test(l)),
     'C5  AN ORBITED CREATOR\'S NEW PUBLIC WORK IS ONE QUIET LINE — discovery, not a feed', JSON.stringify(orbitNews));
  ck(!orbitNews.some((l) => /\d/.test(l)),
     'C5b with no number in any line');

  // ---------------------------------------------------------------
  console.log('\nD. NO SOCIAL PRESSURE, ENFORCED');
  // ---------------------------------------------------------------
  const layer = ['js/creatorOrbit.js', 'js/creatorPresence.js']
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .map((s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')).join('\n');
  ck(!/\bfollow(er|ing)?s?\b|\bfriend\b|\bstreak\b|\brank(ing)?\b|\bscore\b|\bpopular/i.test(layer),
     'D1  NO FOLLOWER, FRIEND, STREAK, RANK, SCORE OR POPULARITY — the vocabulary does not exist in the layer');
  ck(!/notification|\bbadge\b|\bcount\b/i.test(layer),
     'D2  and no notification, badge or count either');
  const orbitKey = /FOR_NOTE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'js', 'creatorOrbit.js'), 'utf8'));
  const storeKey = /FOR_NOTE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'js', 'creatorProjectStore.js'), 'utf8'));
  ck(!!orbitKey && !!storeKey && orbitKey[1] === storeKey[1],
     'D3  THE MAKE-FOR NOTE IS ONE KEY IN BOTH FILES — the writer and the consumer cannot drift', orbitKey && orbitKey[1]);
  ck(pageErrors.length === 0, 'D4  zero page errors throughout',
     pageErrors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  try { server.kill(); } catch (e) {}

  console.log('\n' + (failed ? 'FAILED' : (skipped ? 'PASSED (incomplete)' : 'PASSED')) +
    ' — ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// ===================================================================
// A throwaway PostgreSQL — the companion-memory-test shape.
// ===================================================================
function sh(cmd) { return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

function startPg() {
  if (process.env.ORBIT_TEST_PG) return { conn: process.env.ORBIT_TEST_PG, own: false };
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
function psqlOut(pg, file) { return run(pg, ['-P', 'format=unaligned', '-f', file]).out; }
function loadFile(pg, file) { const r = run(pg, ['-q', '-f', file]); return r.code === 0 ? '' : (r.err || 'failed'); }
function lines(r) { return (r.out || '').split('\n').map((l) => l.trim()); }

function asSession(pg, uid, sql) {
  return psql2(pg, ['begin;', 'set local role anon;',
    `set local "test.uid" = '${uid}';`, sql, 'commit;'].join('\n'));
}
