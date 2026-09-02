/* SOCIAL SKY R2 — THE PORTAL JOURNEY.
 *
 * The portal is not an animation added to Show; it is how Show works
 * in VihuPlanet: the Creator stays, the original stays, and ONLY THE
 * COMPANION crosses — carrying the creation, and now also carrying the
 * Creator's own words (the optional note, VERBATIM) and its own given
 * name. This suite proves the words travel untouched, the journey
 * plays on both sides, the voice is the Companion's canonical voice
 * whatever the child renamed it, and the sender's Garden grows on a
 * successful Show — after the portal closes, and never because of
 * anything the recipient does.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/show-journey-test/run-show-journey-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PGDIR = '/tmp/vihu-show-journey-pg';
const PGPORT = 55445;
const PORT = Number(process.env.SHOWJ_PORT || 8798);
const BASE = 'http://127.0.0.1:' + PORT;

let passed = 0, failed = 0;
const failures = [];
function ck(c, n, note) {
  if (c) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
  else { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
}

const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';

// ---- pg: the note and the name travel, verbatim ---------------------
function sqlSection() {
  console.log('\nP. THE ROW  (the Creator’s words, exactly as written)');
  const pg = startPg();
  if (!pg) { ck(false, 'P0  a PostgreSQL to run against'); return; }
  try {
    let err = loadFile(pg, path.join(ROOT, 'tools', 'social-sky-test', 'fixture.sql'));
    if (err) { ck(false, 'P0  fixture', err.split('\n')[0]); return; }
    for (const m of ['migrations_social_identity.sql', 'migrations_social_orbit.sql',
                     'migrations_social_sky.sql']) {
      err = loadFile(pg, path.join(ROOT, 'supabase', m));
      if (err) { ck(false, 'P0  ' + m, err.split('\n')[0]); return; }
    }
    const again = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_sky.sql'));
    ck(!again, 'P0  the migration applies, and applies twice', again || 'clean');

    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username,companion_id)
      values ('card_a','${A_UID}','Vihaan','ORION','[[1,2]]','moonmaker','leosaurus'),
             ('card_b','${B_UID}','Meera','LYRA','[[3,4]]','stargirl','quill');`);
    psql(pg, `insert into public.creator_orbits(orbiter_id,orbited_id) values ('card_a','card_b');`);

    const send = (args) => {
      const r = asSession(pg, A_UID, `select public.creation_show_send(${args});`);
      try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); }
      catch (e) { return {}; }
    };
    // The child's actual words — quotes, an apostrophe, an emoji.
    const NOTE = 'Look what I made! It’s my "best" one ✨';
    let out = send(`'card_a','stargirl','drawing','My dragon','{"store":"garden"}'::jsonb,'{"png":"x"}'::jsonb,'${NOTE.replace(/'/g, "''")}','Aslan'`);
    ck(out.ok === true, 'P1  A SHOW CARRIES A NOTE AND THE COMPANION’S GIVEN NAME', JSON.stringify(out));
    const showId = out.id;

    const got = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creation_show_get('card_b','${showId}');`)).find((l) => l.startsWith('{')) || '{}');
    ck(got.ok === true && got.gift && got.gift.note === NOTE,
       'P2  THE NOTE ARRIVES VERBATIM — quotes, apostrophe and ✨ untouched, never reworded',
       JSON.stringify(got.gift && got.gift.note));
    ck(got.gift && got.gift.companionName === 'Aslan',
       'P2b and the carrier introduces itself by the name its Creator gave it');

    const list = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creation_show_list('card_b');`)).find((l) => l.startsWith('{')) || '{}');
    ck(list.ok === true && list.gifts && list.gifts[0] &&
       list.gifts[0].companionName === 'Aslan' && !('note' in list.gifts[0]),
       'P3  THE LIST CARRIES THE NAME AND NOT THE NOTE — the note belongs to the reveal, not the shelf');

    // A runaway note is CAPPED, never rewritten: what survives is the
    // exact first 200 characters.
    const LONG = 'a'.repeat(150) + 'b'.repeat(150);
    out = send(`'card_a','stargirl','drawing','x','{}'::jsonb,'{"png":"x"}'::jsonb,'${LONG}','Aslan'`);
    const got2 = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creation_show_get('card_b','${out.id}');`)).find((l) => l.startsWith('{')) || '{}');
    ck(got2.gift && got2.gift.note === LONG.slice(0, 200),
       'P4  a runaway note is cut at 200 characters — a cap, never an edit');

    // An OLD client (six base arguments) still sends: the two new
    // parameters default, the show travels without a note.
    out = send(`'card_a','stargirl','drawing','x','{}'::jsonb,'{"png":"x"}'::jsonb`);
    const got3 = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creation_show_get('card_b','${out.id}');`)).find((l) => l.startsWith('{')) || '{}');
    ck(out.ok === true && got3.gift && got3.gift.note === '' && got3.gift.companionName === '',
       'P5  AN OLDER CLIENT STILL SENDS — the new fields default to empty, nothing refuses');

    // Eligibility is exactly what it was: being chosen BY somebody
    // grants nothing, note or no note.
    const ref = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creation_show_send('card_b','moonmaker','drawing','x','{}'::jsonb,'{"png":"x"}'::jsonb,'hi','Q');`))
      .find((l) => l.startsWith('{')) || '{}');
    ck(ref.ok === false && ref.reason === 'not_chosen',
       'P6  "THEY CHOSE ME" STILL CANNOT RECEIVE A SHOW — the note changed no permission');

    // ---- R2.1: any Creator is findable by their EXACT @name --------
    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username,companion_id)
      values ('card_c','${B_UID}','Quiet','CYGNUS','[[5,6]]',null,'leafy');`);
    const find = (name) => JSON.parse(lines(asSession(pg, A_UID,
      `select public.creator_find('${name}');`)).find((l) => l.startsWith('{')) || '{}');
    const f1 = find('StarGirl');
    ck(f1.ok === true && f1.username === 'stargirl' && f1.companion === 'quill',
       'P7  creator_find ANSWERS AN EXACT @NAME, case-insensitively — the name and the Companion, nothing else',
       JSON.stringify(f1));
    ck(Object.keys(f1).sort().join(',') === 'companion,ok,species,username',
       'P7b and ONLY public facts leave — no nickname, no ids, no email, no session, no counts');
    ck(find('nobodyatall').ok === false,
       'P8  an unknown name answers ok:false and nothing more');
    ck(find('stargirl%').ok === false && find('star').ok === false,
       'P8b and there is NOTHING TO ENUMERATE — no prefix, no wildcard, exact or nothing');
    ck(find('').ok === false,
       'P8c an identity holding no username is unreachable — an empty ask matches nobody');

    // ---- R2.2: suggestions reach the whole platform ----------------
    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username,companion_id)
      values ('card_v1','${A_UID}','V1','ORION','[[1,2]]','vihu01','leosaurus'),
             ('card_v2','${A_UID}','V2','LYRA','[[3,4]]','vihupapa','quill'),
             ('card_u1','${A_UID}','U1','CYGNUS','[[5,6]]','my_name','leafy'),
             ('card_u2','${A_UID}','U2','ORION','[[7,8]]','myxname','nimbus');`);
    const sug = (pre) => JSON.parse(lines(asSession(pg, A_UID,
      `select public.creator_suggest('${pre}');`)).find((l) => l.startsWith('{')) || '{}');
    const s1 = sug('vihu');
    ck(s1.ok === true && JSON.stringify(s1.names) === '["vihu01","vihupapa"]',
       'P9  A PREFIX OF THREE FINDS EVERY CREATOR IT NAMES — shared or not, vihu01 beside vihupapa',
       JSON.stringify(s1.names));
    ck(sug('vi').ok === false && sug('').ok === false,
       'P9b under three characters the platform offers NOTHING — an empty field is still no directory');
    ck(sug('vihu%').ok === false && sug('vihu*').ok === false,
       'P9c a prefix outside the username alphabet answers nothing — no wildcard reaches the query');
    const s2 = sug('my_');
    ck(s2.ok === true && JSON.stringify(s2.names) === '["my_name"]',
       'P9d an underscore is a LETTER of the name, never a wildcard — my_ finds my_name and not myxname',
       JSON.stringify(s2.names));
  } finally { stopPg(pg); }
}

// ---- browser: the journey, both sides -------------------------------
(async () => {
  sqlSection();

  const server = spawn('node',
    [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.route('**/supabase-config.json', (route) => route.fulfill({ status: 404, body: '' }));

    console.log('\nJ. THE JOURNEY  (departure · arrival · the garden)');
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
      typeof CreationShow !== 'undefined' && typeof CreatorProjectStore !== 'undefined',
      null, { timeout: 20000 });
    const seeded = await page.evaluate(() => {
      localStorage.clear(); sessionStorage.clear();
      try { CreatorProjectStore.clearAll({ all: true }); } catch (e) { try { CreatorProjectStore.clearAll(); } catch (e2) {} }
      function px(c) {
        const v = document.createElement('canvas'); v.width = 8; v.height = 8;
        const x = v.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 8, 8);
        return v.toDataURL('image/png');
      }
      const a = MagicCard.claim('Vihaan', null, { companionId: 'leosaurus', companionName: 'Leo' });
      MagicCard.setActive(a.id);
      MagicCard._setLocalUsername(a.id, 'moonmaker');
      const mine = CreatorProjectStore.newId();
      CreatorProjectStore.upsert(mine, { name: 'The Moon Dragon', thumbnail: px('#3355aa') },
        { version: 1, pages: [{ id: 'p1', readImage: px('#3355aa') }] });
      localStorage.setItem('vihu.orbit.' + a.id, JSON.stringify({ stargirl: { circle: true } }));
      localStorage.setItem('vihu.sky.' + a.id, JSON.stringify({
        sky: [{ username: 'stargirl', companion: 'quill', circle: true }], choseMe: []
      }));
      return { aCard: a.id, mine, px: px('#227722') };
    });
    // Not reload(): ?author=on is read once and stripped, and the
    // seed's localStorage.clear() wiped the remembered flag — a plain
    // reload is bounced home by Decision 23's gate, correctly.
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof CreationShow !== 'undefined' &&
      typeof CompanionName !== 'undefined', null, { timeout: 20000 });
    // The project store rehydrates from IndexedDB — the dialog opened
    // before that finishes would honestly say "nothing here yet".
    await page.waitForFunction(() => {
      try { return CreatorProjectStore.list().length > 0; } catch (e) { return false; }
    }, null, { timeout: 15000 });

    // The child renamed their Companion: Leo is Aslan to Vihaan.
    // Stubs mutate the modules IN PLACE (top-level consts — swapping
    // window.X is invisible to the code that uses them).
    await page.evaluate(() => {
      window.__rpc = [];
      window.__spoken = [];
      window.__growth = [];
      const r = CompanionName.set('Aslan');
      window.__named = r && r.ok;
      ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
      ThemeRepositoryClient.getClient = () => Promise.resolve({
        rpc: (fn, args) => {
          window.__rpc.push({ fn, args });
          if (fn === 'creation_show_send') return Promise.resolve({ data: { ok: true, id: 'show_j1' } });
          if (fn === 'creation_show_get') return Promise.resolve({ data: { ok: true, gift: window.__gift } });
          // list answers "not now" so refresh() leaves the seeded
          // local cache alone — returning [] would faithfully wipe it.
          return Promise.resolve({ data: { ok: false } });
        },
      });
      VihuVoice.speak = (o) => { window.__spoken.push({ id: o && o.characterId, text: o && o.text }); return Promise.resolve(false); };
      document.addEventListener('vihu:creation-captured', (ev) => {
        window.__growth.push({ id: ev.detail && ev.detail.id, at: Date.now() });
      });
    });

    // ---- J1: the sender's side, walked for real --------------------
    await page.evaluate(() => { CreationShow.openShowDialog(null); });
    await page.waitForSelector('.creation-show-thing', { timeout: 8000 });
    await page.click('.creation-show-thing');
    const who = await page.evaluate(() => {
      const b = document.querySelector('.creation-show-who-btn');
      return {
        fig: !!(b && b.querySelector('.creation-show-who-fig img')),
        name: b ? b.textContent : '',
      };
    });
    ck(who.fig && /@stargirl/.test(who.name),
       'J1  THE RECIPIENT IS SHOWN THROUGH THEIR COMPANION — figure first, @name beside it, no relationship words');

    await page.click('.creation-show-who-btn');
    const noteField = await page.waitForSelector('.creation-show-notefield', { timeout: 5000 });
    const ph = await noteField.getAttribute('placeholder');
    ck(ph === 'Look what I made!',
       'J2  "ADD A LITTLE NOTE" — optional, the child’s own words invited');
    const NOTE = 'Look what I made! It’s my best one.';
    await noteField.fill(NOTE);
    const before = await page.evaluate(() => window.__growth.length);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.creation-show-btns button'))
        .find((b) => /Show it/.test(b.textContent)).click();
    });

    // Departure: the line, the portal, the crossing, the close.
    await page.waitForFunction(() =>
      /Aslan is taking it/.test((document.querySelector('.creation-show-title') || {}).textContent || ''),
      null, { timeout: 6000 });
    const dep = await page.evaluate(() => ({
      line: (document.querySelector('.show-journey-line') || {}).textContent || '',
      portal: !!document.querySelector('.show-portal'),
      held: !!document.querySelector('.show-journey-held'),
      growthNow: window.__growth.length,
      sent: window.__rpc.filter((c) => c.fn === 'creation_show_send')[0],
    }));
    ck(/Aslan is taking this to @stargirl\./.test(dep.line) && dep.portal && dep.held,
       'J3  THE COMPANION TAKES RESPONSIBILITY — named by its Creator, the creation held WITH it, a portal in the room', dep.line);
    ck(dep.sent && dep.sent.args.p_note === NOTE && dep.sent.args.p_companion_name === 'Aslan',
       'J4  THE NOTE TRAVELS VERBATIM AND THE GIVEN NAME TRAVELS WITH IT', JSON.stringify(dep.sent && dep.sent.args.p_note));
    ck(dep.growthNow === before,
       'J5  NO GROWTH YET — the garden answers the portal closing, not the button press');

    await page.waitForFunction(() => document.querySelector('.show-portal.is-open'), null, { timeout: 4000 });
    await page.waitForFunction(() => document.querySelector('.show-journey-stage.is-crossing'), null, { timeout: 4000 });
    await page.waitForFunction(() => document.querySelector('.show-portal.is-closed'), null, { timeout: 4000 });
    await page.waitForFunction(() => window.__growth.length > 0, null, { timeout: 4000 });
    const after = await page.evaluate(() => ({
      growth: window.__growth,
      line: (document.querySelector('.show-journey-line') || {}).textContent || '',
      spokenFirst: window.__spoken[0] || null,
      marks: window.__rpc.filter((c) => c.fn === 'creation_show_mark').length,
    }));
    ck(after.growth.length === 1 && after.growth[0].id === 'show:show_j1',
       'J6  ONE SHOW, ONE GROWTH — vihu:creation-captured fired once, after the portal closed, capture id from the show');
    ck(after.marks === 0,
       'J6b and it depended on NOTHING the recipient did — no view, no keep, no reaction anywhere');
    ck(/stays right here with you/.test(after.line),
       'J7  THE ORIGINAL NEVER LEFT — said in as many words once the Companion has gone');
    ck(after.spokenFirst && after.spokenFirst.id === 'leosaurus' &&
       after.spokenFirst.text === 'I’m taking this to stargirl.',
       'J8  THE DEPARTURE LINE IS SPOKEN IN THE COMPANION’S OWN CANONICAL VOICE — Aslan on screen, leosaurus’ voice underneath, no introduction to its own Creator',
       JSON.stringify(after.spokenFirst));

    // ---- J9: the recipient's side ----------------------------------
    await page.evaluate((s) => {
      document.querySelector('.creation-show-overlay').remove();
      window.__spoken.length = 0;
      window.__gift = {
        id: 'g1', from: 'stargirl', companion: 'quill', companionName: 'Inky',
        note: 'Look what I made!', kind: 'drawing', name: 'A drawing',
        place: { store: 'garden', room: 'drawings' }, payload: { png: s.px },
        seen: false, kept: false,
      };
      localStorage.setItem('vihu.gifts.' + s.aCard, JSON.stringify([
        { id: 'g1', from: 'stargirl', companion: 'quill', kind: 'drawing', name: 'A drawing', seen: false }]));
      CreationShow.openGifts({ from: 'stargirl' });
    }, seeded);

    await page.waitForSelector('.show-journey-arrival .show-portal', { timeout: 6000 });
    await page.waitForFunction(() => document.querySelector('.show-journey-arrival.is-arrived'), null, { timeout: 5000 });
    await page.waitForFunction(() =>
      /Hi! I’m Inky/.test((document.querySelector('.show-journey-line') || {}).textContent || ''),
      null, { timeout: 5000 });
    const intro = await page.evaluate(() => ({
      line: (document.querySelector('.show-journey-line') || {}).textContent || '',
      revealed: !!document.querySelector('.creation-gift-stage img'),
    }));
    ck(/Hi! I’m Inky, @stargirl’s Companion\. @stargirl wanted me to show you something\./.test(intro.line),
       'J9  THE CARRIER INTRODUCES ITSELF — this child may never have met it: given name, whose Companion, and why it came', intro.line);
    ck(!intro.revealed,
       'J9b and the creation is NOT yet revealed — the reveal is the payoff, after the introduction');

    await page.waitForFunction(() => document.querySelector('.creation-gift-stage.is-revealed img'), null, { timeout: 6000 });
    await page.waitForFunction(() =>
      /says:/.test((document.querySelector('.creation-show-note') || {}).textContent || ''),
      null, { timeout: 5000 });
    await page.waitForFunction(() =>
      document.querySelector('.show-journey-arrival .show-portal.is-closed'), null, { timeout: 6000 });
    const rev = await page.evaluate(() => ({
      note: (document.querySelector('.creation-show-note') || {}).textContent || '',
      spoken: window.__spoken.map((s) => s.text),
      voices: window.__spoken.map((s) => s.id),
    }));
    ck(rev.note === '@stargirl says: “Look what I made!”',
       'J10 THE CREATOR’S WORDS, QUOTED EXACTLY — never rewritten, never embellished', rev.note);
    ck(rev.spoken.some((t) => t === 'stargirl says: Look what I made!') &&
       rev.voices.every((v) => v === 'quill'),
       'J10b and spoken verbatim, in the CARRIER’S canonical voice');

    // ---- J11: an already-seen gift skips the theatre ---------------
    await page.evaluate(() => {
      document.querySelector('.creation-show-overlay').remove();
      window.__gift.seen = true;
      const list = JSON.parse(localStorage.getItem('vihu.gifts.' + MagicCard.getActive().id));
      list[0].seen = true;
      localStorage.setItem('vihu.gifts.' + MagicCard.getActive().id, JSON.stringify(list));
      CreationShow.openGifts({ from: 'stargirl' });
    });
    await page.waitForFunction(() => document.querySelector('.creation-gift-stage img'), null, { timeout: 6000 });
    const still = await page.evaluate(() => ({
      still: !!document.querySelector('.show-journey-arrival.is-still'),
      portalDrawn: (() => {
        const p = document.querySelector('.show-journey-arrival .show-portal');
        return p ? getComputedStyle(p).display !== 'none' : false;
      })(),
      note: (document.querySelector('.creation-show-note') || {}).textContent || '',
    }));
    ck(still.still && !still.portalDrawn && /says:/.test(still.note),
       'J11 A GIFT ALREADY SEEN OPENS STRAIGHT TO WHAT IT BROUGHT — no re-run theatre, the note still in the Creator’s words');

    // ---- J12: one implementation, every door -----------------------
    const doors = await page.evaluate(() => {
      const lib = { id: 'd1', name: 'My dragon', png: 'data:image/png;base64,x', thumbnail: null };
      const hw = { id: 'h1', ch: 'A', glyph: { png: 'data:image/png;base64,y', w: 10, h: 12 } };
      const d = CreationShow.itemFor('drawing', lib);
      const l = CreationShow.itemFor('letter', hw);
      const s = CreationShow.itemFor('story', { id: 'p1', name: 'S', thumbnail: null, data: { pages: [] } });
      return {
        d: d && d.kind === 'drawing' && d.place.store === 'garden' && d.payload().png === lib.png,
        l: l && l.kind === 'letter' && l.place.ch === 'A' && l.payload().png === hw.glyph.png,
        s: s && s.kind === 'story' && s.place.store === 'projects',
        can: CreationShow.canShow(),
      };
    });
    ck(doors.d && doors.l && doors.s && doors.can,
       'J12 ONE ITEM SHAPE FOR EVERY DOOR — itemFor builds story, drawing and letter alike; canShow answers every surface');
    const srcCP = fs.readFileSync(path.join(ROOT, 'js', 'contextPanel.js'), 'utf8');
    const srcCF = fs.readFileSync(path.join(ROOT, 'js', 'creationFlow.js'), 'utf8');
    ck((srcCP.match(/Show to your Sky/g) || []).length === 2 &&
       (srcCP.match(/CreationShow\.itemFor\(/g) || []).length === 2 &&
       /CreationShow\.itemFor\('story',record\)/.test(srcCF),
       'J12b and the Garden’s two rooms and My Projects all reach it through CreationShow.itemFor — no surface builds its own');

    // ---- J13: a Traveller has none of this -------------------------
    const trav = await page.evaluate(() => {
      MagicCard.setActive('');
      return {
        can: CreationShow.canShow(),
        dialog: CreationShow.openShowDialog(CreationShow.itemFor('story', { id: 'x', name: 'x' })),
        gifts: CreationShow.openGifts(),
      };
    });
    ck(trav.can === false && trav.dialog === false && trav.gifts === false,
       'J13 A TRAVELLER CAN NEITHER SHOW NOR RECEIVE — every door refuses without a card');

    ck(pageErrors.length === 0, 'J14 zero page errors across the whole journey',
       pageErrors.slice(0, 2).join(' | ') || 'clean');
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('\n' + (failed ? 'FAILED' : 'PASSED') +
    ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
})();

// ---- the throwaway-PostgreSQL harness (the social-sky shape) --------
function sh(cmd) { return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
function startPg() {
  if (process.env.SHOWJ_TEST_PG) return { conn: process.env.SHOWJ_TEST_PG, own: false };
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
function loadFile(pg, file) { const r = run(pg, ['-q', '-f', file]); return r.code === 0 ? '' : (r.err || 'failed'); }
function lines(r) { return (r.out || '').split('\n').map((l) => l.trim()); }
function asSession(pg, uid, sql, email, role) {
  return run(pg, ['-q', '-t', '-A', '-c', ['begin;', 'set local role ' + (role || 'anon') + ';',
    `set local "test.uid" = '${uid}';`,
    email ? `set local "test.email" = '${email}';` : `set local "test.email" = '';`,
    sql, 'commit;'].join('\n')]);
}
