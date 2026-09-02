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
      values ('card_v1','${A_UID}','V1','ORION','[[7,7]]','vihu01','leosaurus'),
             ('card_v2','${A_UID}','V2','LYRA','[[8,8]]','vihupapa','quill'),
             ('card_u1','${A_UID}','U1','CYGNUS','[[6,6]]','my_name','leafy'),
             ('card_u2','${A_UID}','U2','ORION','[[9,9]]','myxname','nimbus');`);
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

    // ---- RECOG-3: the live platform's own broken state, reproduced -
    // The production incident: the taught column never existed (no
    // migration ever created it), migrations_social_identity's recall
    // redefinition read v_identity.taught anyway, and every drawn-star
    // recognition failed at runtime with 42703 — reported as "am not
    // able to login even when magic card pattern is correct". The
    // migration now GUARANTEES every column its recall reads, so
    // re-running it on a database missing the column heals it.
    psql(pg, `alter table public.magic_card_identities drop column taught;`);
    // stargirl's real one-cell sky: the broken state only throws when
    // a sky actually MATCHES (that is the read of v_identity.taught).
    const broken = asSession(pg, B_UID,
      `select public.recall_magic_card('[[3,4]]'::jsonb, null);`);
    ck(/has no field "taught"|no_match/.test(broken.err + broken.out) &&
       !(broken.out || '').includes('"ok": true'),
       'P10 WITH THE COLUMN MISSING, RECALL CANNOT SUCCEED — the exact 42703 the live platform threw',
       (broken.err || broken.out || '').split('\n')[0].slice(0, 70));
    const heal = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_identity.sql'));
    ck(!heal, 'P10b re-running migrations_social_identity HEALS it — the migration now guarantees every column its recall reads', heal ? heal.split('\n')[0] : 'clean');
    // stargirl's real sky, drawn as a set in a different order.
    const healed = JSON.parse(lines(asSession(pg, B_UID,
      `select public.recall_magic_card('[[3,4]]'::jsonb, null);`)).find((l) => l.startsWith('{')) || '{}');
    ck(healed.ok === true && healed.identity_id === 'card_b' && healed.taught === null,
       'P10c and the drawn sky is recognised again — taught comes back null, which adopt() reads as grandfathered',
       JSON.stringify({ ok: healed.ok, id: healed.identity_id }));

    // ---- R3.7: a card proven on this device may act as itself ------
    // The report, verbatim: vihupapa stood in vihu01's sky, but vihu01
    // never appeared in vihupapa's. Every social function demanded
    // owner_id = auth.uid() — the session that CLAIMED the card — so a
    // Creator recognised on any other device was refused not_yours on
    // every orbit write, silently, while the local echo painted the
    // choice on their own screen. card_acted_for() widens acting-as-a-
    // card to the platform's own evidence standard: the claiming
    // session, or a session holding a PROVEN recall of that exact card.
    const C_UID = '33333333-3333-3333-3333-333333333333';
    const orbitAs = (uid) => JSON.parse(lines(asSession(pg, uid,
      `select public.creator_orbit_set('card_v1','stargirl',true);`)).find((l) => l.startsWith('{')) || '{}');
    const guess = orbitAs(C_UID);
    ck(guess.ok === false && guess.reason === 'not_yours',
       'Y1  A SESSION WITH NO PROOF STILL CANNOT ACT AS A CARD — knowing an id is not holding the card', JSON.stringify(guess));
    // The proven recall — the exact row recall_magic_card writes when
    // a sky is drawn or a card is read on a new device.
    psql(pg, `insert into public.magic_card_recalls(identity_id, recaller_id)
      values ('card_v1','${C_UID}');`);
    const proven = orbitAs(C_UID);
    ck(proven.ok === true && proven.username === 'stargirl',
       'Y2  A PROVEN RECALL ACTS AS THE CARD — vihu01 on a second device can finally choose somebody', JSON.stringify(proven));
    const theirSky = JSON.parse(lines(asSession(pg, B_UID,
      `select public.creator_sky_list('card_b');`)).find((l) => l.startsWith('{')) || '{}');
    const chose = (theirSky.choseMe || []).map((e) => e.username);
    ck(theirSky.ok === true && chose.indexOf('vihu01') !== -1,
       'Y3  AND THE CHOSEN CREATOR FINALLY SEES THE NEW STAR — vihu01 stands in stargirl\'s own choseMe, the report closed',
       chose.join(','));
    const mySky = JSON.parse(lines(asSession(pg, C_UID,
      `select public.creator_sky_list('card_v1');`)).find((l) => l.startsWith('{')) || '{}');
    ck(mySky.ok === true && (mySky.sky || []).some((e) => e.username === 'stargirl'),
       'Y4  and the recalled device reads its own sky from the platform too — both halves of the relationship real',
       JSON.stringify((mySky.sky || []).map((e) => e.username)));
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
      return { aCard: a.id, mine, px: px('#227722'), thumb: px('#3355aa') };
    });
    await page.waitForTimeout(1000); // let the IndexedDB write settle before navigating
    // Not reload(): ?author=on is read once and stripped, and the
    // seed's localStorage.clear() wiped the remembered flag — a plain
    // reload is bounced home by Decision 23's gate, correctly.
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof CreationShow !== 'undefined' &&
      typeof CompanionName !== 'undefined', null, { timeout: 20000 });
    // The project store rehydrates from IndexedDB — the dialog opened
    // before that finishes would honestly say "nothing here yet".
    // Hydration can race a navigation that followed the write too
    // closely (measured, intermittent); a re-seed on THIS load is the
    // same story arriving late, not a different fixture.
    try {
      await page.waitForFunction(() => {
        try { return CreatorProjectStore.list().length > 0; } catch (e) { return false; }
      }, null, { timeout: 10000 });
    } catch (e) {
      await page.evaluate((s) => {
        CreatorProjectStore.upsert(s.mine, { name: 'The Moon Dragon', thumbnail: s.thumb },
          { version: 1, pages: [{ id: 'p1', readImage: s.thumb }] });
      }, seeded);
      await page.waitForFunction(() => {
        try { return CreatorProjectStore.list().length > 0; } catch (e2) { return false; }
      }, null, { timeout: 10000 });
    }

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
    // R3 staged the departure as a scene: the line arrives at the
    // PICKUP beat (~1.3s), when the shimmer copy lifts into the
    // Companion's arms — and the ORIGINAL stands in the stage the
    // whole time, which is the world rule drawn rather than asserted.
    await page.waitForFunction(() =>
      /Aslan is taking this to @stargirl\./.test(
        (document.querySelector('.show-journey-line') || {}).textContent || ''),
      null, { timeout: 5000 });
    const dep = await page.evaluate(() => ({
      line: (document.querySelector('.show-journey-line') || {}).textContent || '',
      portal: !!document.querySelector('.show-portal'),
      carried: !!document.querySelector('.show-journey-carried'),
      original: !!document.querySelector('.show-journey-original'),
      picked: !!document.querySelector('.show-journey-depart.is-picked'),
      growthNow: window.__growth.length,
      sent: window.__rpc.filter((c) => c.fn === 'creation_show_send')[0],
    }));
    ck(dep.portal && dep.carried && dep.original && dep.picked,
       'J3  THE COMPANION TAKES RESPONSIBILITY — it walks to the creation and a shimmer copy lifts into its arms, while the ORIGINAL stands in the world beside it', dep.line);
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
    // The un-dim is a 1s transition — measured once it has finished,
    // not mid-fade.
    await page.waitForFunction(() => {
      const o = document.querySelector('.show-journey-original');
      return o && document.querySelector('.show-journey-depart.is-after') &&
        Number(getComputedStyle(o).opacity) > 0.95;
    }, null, { timeout: 4000 });
    ck(true,
       'J7b AND IT IS DRAWN STANDING THERE — dimmed a breath while its shimmer was away, whole again the moment the portal closed');
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
      veiled: !!document.querySelector('.show-journey-carried.is-veiled'),
    }));
    ck(/Hi! I’m Inky, @stargirl’s Companion\. @stargirl wanted me to show you something\./.test(intro.line),
       'J9  THE CARRIER INTRODUCES ITSELF — this child may never have met it: given name, whose Companion, and why it came', intro.line);
    ck(!intro.revealed && intro.veiled,
       'J9b and the creation is NOT yet revealed — carried veiled in its own light, the payoff after the introduction');

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
      revealing: !!document.querySelector('.show-journey-traveller.is-revealing'),
      keepYet: !!document.querySelector('.creation-gift-keep'),
    }));
    ck(rev.note === '@stargirl says: “Look what I made!”',
       'J10 THE CREATOR’S WORDS, QUOTED EXACTLY — never rewritten, never embellished', rev.note);
    ck(rev.spoken.some((t) => t === 'stargirl says: Look what I made!') &&
       rev.voices.every((v) => v === 'quill'),
       'J10b and spoken verbatim, in the CARRIER’S canonical voice');
    ck(rev.revealing && !rev.keepYet,
       'J10c THE ARRIVAL BREATHES — the bundle has given way to the creation, and no button has crowded in yet');
    await page.waitForSelector('.creation-gift-keep.show-breathe, .creation-show-btns.show-breathe .creation-gift-keep',
      { timeout: 5000 });
    ck(true,
       'J10d and only then do Keep and Back arrive, quietly');

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

    // ---- S: the sky NAVIGATES — a star opens the CREATOR -----------
    // R3, reported: "clicking a Creator in Sky opens Sky again" — the
    // old handler navigated to index.html?creator=, which dumped the
    // child at VihuPlanet's threshold. A star now opens that Creator's
    // SPACE in the same overlay, and Back returns to the sky. No
    // navigation, no second sky route.
    await page.evaluate(() => { SocialSky.open(); });
    await page.waitForSelector('.social-sky-field', { timeout: 6000 });
    await page.click('.social-sky-star');
    const space = await page.evaluate(() => ({
      url: location.pathname,
      space: !!document.querySelector('.social-sky-space'),
      skyGone: !document.querySelector('.social-sky-field'),
      name: (document.querySelector('.social-sky-space-name') || {}).textContent || '',
      hero: !!document.querySelector('.social-sky-space-hero img'),
      mutual: /You chose each other/.test((document.querySelector('.social-sky-space') || {}).textContent || ''),
      showBtn: !!document.querySelector('.social-sky-space-show'),
    }));
    ck(/studio\.html/.test(space.url) && space.space && space.skyGone &&
       space.name === '@stargirl' && space.hero,
       'S1  TAP A COMPANION, ENTER THAT CREATOR — their space opens in place, nothing navigates, no second sky', space.name);
    ck(space.mutual && space.showBtn,
       'S2  the space knows the relationship in the sky\'s own words — and offers the one social act: show them something you made');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.social-sky-quiet'))
        .find((b) => /Back to My Sky/.test(b.textContent)).click();
    });
    const backSky = await page.evaluate(() => ({
      field: !!document.querySelector('.social-sky-field'),
      findStar: !!document.querySelector('.social-sky-find-star'),
    }));
    ck(backSky.field && backSky.findStar,
       'S3  BACK RETURNS TO THE SKY — where ＋ Find a Creator now stands as a soft star in the field itself');

    // ---- S4: discovery lives IN the sky ----------------------------
    const foundNew = await page.evaluate(async (s) => {
      ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
      ThemeRepositoryClient.getClient = () => Promise.resolve({
        rpc: (fn, args) => {
          if (fn === 'creator_find' && args.p_username === 'ghostkid') {
            return Promise.resolve({ data: { ok: true, username: 'ghostkid', companion: 'leafy' }, error: null });
          }
          return Promise.resolve({ data: { ok: false }, error: null });
        },
      });
      document.querySelector('.social-sky-find-star').click();
      await new Promise((r) => setTimeout(r, 100));
      const input = document.querySelector('.social-sky-find-input');
      input.value = 'ghostkid';
      Array.from(document.querySelectorAll('.social-sky-space-add'))
        .find((b) => /Find/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 400));
      const name = (document.querySelector('.social-sky-space-name') || {}).textContent || '';
      const add = Array.from(document.querySelectorAll('.social-sky-space-add'))
        .find((b) => /Put them in my Sky/.test(b.textContent));
      if (add) add.click();
      await new Promise((r) => setTimeout(r, 200));
      const orbit = JSON.parse(localStorage.getItem('vihu.orbit.' + s.aCard) || '{}');
      return { name, chosen: !!orbit.ghostkid,
        nowSays: (document.querySelector('.social-sky-space') || {}).textContent || '' };
    }, seeded);
    ck(foundNew.name === '@ghostkid' && foundNew.chosen &&
       /In your Sky|You chose each other/.test(foundNew.nowSays),
       'S4  FIND A CREATOR → their space → ⭐ ONE TAP puts them in the sky — the same one-way choice, no request, no approval', foundNew.name);

    // ---- SK: the sky answers the choice immediately (R3.2) ---------
    // Reported: "adding a creator from sky does not reflect in sky
    // until refreshed" — layers() prefers the platform's CACHED copy
    // of the sky, which only a round trip rewrote, and refresh() runs
    // once per load. noteChoice() is the local echo: the tap lands
    // NOW, the platform's copy replaces the guess when next heard.
    // Proved against the seeded cache (it holds only stargirl), so on
    // the old code ghostkid stays missing here.
    const liveAdd = await page.evaluate(async () => {
      Array.from(document.querySelectorAll('.social-sky-quiet'))
        .find((b) => /Back to My Sky/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 150));
      return {
        field: !!document.querySelector('.social-sky-field'),
        star: Array.from(document.querySelectorAll('.social-sky-star .social-sky-name'))
          .some((n) => n.textContent === '@ghostkid'),
      };
    });
    ck(liveAdd.field && liveAdd.star,
       'SK1 A CREATOR CHOSEN IN THE SKY IS IN THE SKY — the new star stands in the field the moment the child walks back, no page load in between');
    const liveRemove = await page.evaluate(async () => {
      Array.from(document.querySelectorAll('.social-sky-star'))
        .find((s) => /@ghostkid/.test(s.textContent)).click();
      await new Promise((r) => setTimeout(r, 150));
      Array.from(document.querySelectorAll('.social-sky-quiet'))
        .find((b) => /Take out of my Sky/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 150));
      Array.from(document.querySelectorAll('.social-sky-quiet'))
        .find((b) => /Back to My Sky/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 150));
      return !Array.from(document.querySelectorAll('.social-sky-star .social-sky-name'))
        .some((n) => n.textContent === '@ghostkid');
    });
    ck(liveRemove,
       'SK2 and taking them out empties that place at once — the sky never argues with the child\'s own choice');

    // ---- S5: "show them something" pre-answers the chooser ---------
    const preset = await page.evaluate(async () => {
      document.querySelectorAll('.creation-show-overlay, .social-sky-overlay')
        .forEach((o) => o.remove());
      SocialSky.open({ creator: 'stargirl' });
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector('.social-sky-space-show').click();
      await new Promise((r) => setTimeout(r, 250));
      const pick = document.querySelector('.creation-show-thing');
      if (pick) pick.click();
      await new Promise((r) => setTimeout(r, 250));
      const out = {
        note: !!document.querySelector('.creation-show-notefield'),
        forWho: (document.querySelector('.creation-show-sub') || {}).textContent || '',
        noChooser: !document.querySelector('.creation-show-who-btn'),
      };
      document.querySelector('.creation-show-overlay')?.remove();
      return out;
    });
    ck(preset.note && /For @stargirl/.test(preset.forWho) && preset.noChooser,
       'S5  FROM A CREATOR\'S SPACE, SHOW SKIPS THE CHOOSER — the answer was already given; the child just picks the creation and writes the note');

    // ---- PP: one overlay hosts the whole social world (R3.2) -------
    // Reported: "we are having too many popups" — Show and Gifts each
    // opened their own overlay over (or in place of) the Sky's.
    // Launched from inside the Sky they are now VIEWS of the same
    // panel, dressed in its night, and Back lands where the child was.
    const hosted = await page.evaluate(async () => {
      document.querySelectorAll('.social-sky-overlay, .creation-show-overlay')
        .forEach((o) => o.remove());
      SocialSky.open({ creator: 'stargirl' });
      await new Promise((r) => setTimeout(r, 150));
      document.querySelector('.social-sky-space-show').click();
      await new Promise((r) => setTimeout(r, 150));
      const out = {
        overlays: document.querySelectorAll('.social-sky-overlay, .creation-show-overlay').length,
        inSky: !!document.querySelector('.social-sky-overlay .creation-show-panel.is-hosted'),
        picker: !!document.querySelector('.creation-show-thing'),
      };
      Array.from(document.querySelectorAll('.creation-show-quiet'))
        .find((b) => /^Back$/.test(b.textContent)).click();
      await new Promise((r) => setTimeout(r, 150));
      out.backTo = !!document.querySelector('.social-sky-space');
      return out;
    });
    ck(hosted.overlays === 1 && hosted.inSky && hosted.picker,
       'PP1 SHOW FROM THE SKY IS A VIEW OF THE SKY — one overlay for the whole social world, never a popup over a popup',
       'overlays=' + hosted.overlays);
    ck(hosted.backTo,
       'PP2 and Back lands exactly where the child was standing — the Creator\'s space, not the Studio underneath');
    const giftHosted = await page.evaluate(async (s) => {
      document.querySelectorAll('.social-sky-overlay, .creation-show-overlay')
        .forEach((o) => o.remove());
      localStorage.setItem('vihu.gifts.' + s.aCard, JSON.stringify(
        [{ id: 'g1', from: 'stargirl', companion: 'quill', kind: 'drawing', name: 'A drawing', seen: false }]));
      SocialSky.open();
      await new Promise((r) => setTimeout(r, 250));
      const badge = document.querySelector('.social-sky-gift');
      if (!badge) return { badge: false };
      badge.click();
      await new Promise((r) => setTimeout(r, 250));
      const out = {
        badge: true,
        overlays: document.querySelectorAll('.social-sky-overlay, .creation-show-overlay').length,
        inSky: !!document.querySelector('.social-sky-overlay .creation-show-panel.is-hosted'),
      };
      document.querySelectorAll('.social-sky-overlay, .creation-show-overlay')
        .forEach((o) => o.remove());
      return out;
    }, seeded);
    ck(giftHosted.badge && giftHosted.overlays === 1 && giftHosted.inSky,
       'PP3 A STAR\'S 🎁 OPENS THE GIFT INSIDE THE SKY TOO — the arrival plays in the same night, one popup from first tap to last',
       JSON.stringify(giftHosted));

    // ---- K: keeping grows the garden too (R3.4) --------------------
    // Asked for by the product owner: "showing and keeping should grow
    // garden in editor." Show already grew the sender's; bringing a
    // creation into your own world is a creative act of your own, so a
    // Keep now grows the KEEPER's garden — the Garden's one typeless
    // event, deduplicated by its recent-ids guard, persisted by
    // LivingGarden's document-level listener wherever it fires so it
    // is standing in the editor the next time it opens.
    const keepGrow = await page.evaluate(async (s) => {
      document.querySelectorAll('.social-sky-overlay, .creation-show-overlay')
        .forEach((o) => o.remove());
      window.__gift.seen = true; // an already-seen gift opens straight to Keep
      // S4 swapped the rpc stub for a find-only one — restore the
      // gift-aware answers this journey started with.
      ThemeRepositoryClient.getClient = () => Promise.resolve({
        rpc: (fn) => {
          if (fn === 'creation_show_get') return Promise.resolve({ data: { ok: true, gift: window.__gift } });
          return Promise.resolve({ data: { ok: false } });
        },
      });
      localStorage.setItem('vihu.gifts.' + s.aCard, JSON.stringify(
        [{ id: 'g1', from: 'stargirl', companion: 'quill', kind: 'drawing', name: 'A drawing', seen: true }]));
      const before = window.__growth.length;
      CreationShow.openGifts({ from: 'stargirl' });
      await new Promise((r) => setTimeout(r, 500));
      const keepBtn = document.querySelector('.creation-gift-keep');
      if (!keepBtn) return { keepBtn: false };
      keepBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const grew = window.__growth.slice(before).map((g) => g.id);
      document.querySelectorAll('.creation-show-overlay').forEach((o) => o.remove());
      return { keepBtn: true, grew };
    }, seeded);
    ck(keepGrow.keepBtn && keepGrow.grew.length === 1 && keepGrow.grew[0] === 'keep:g1',
       'K1  KEEPING GROWS THE KEEPER\'S GARDEN — one keep, one growth, through the Garden\'s own typeless event',
       JSON.stringify(keepGrow.grew));

    // ---- RC: reconcile, never replace (R3.7b) ----------------------
    // Until card_acted_for, a recalled card's orbit writes were all
    // refused, so real choices lived ONLY in the local store — and
    // refresh() used to replace that store with the platform's copy,
    // which would have DELETED them the moment the server fix
    // deployed. The owner refused the remove-and-re-add remedy, and
    // rightly: a local-only choice is pushed UP on the next refresh,
    // automatically, and nobody redoes anything by hand.
    const heal = await page.evaluate(async (s) => {
      window.__orbitSets = [];
      ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
      ThemeRepositoryClient.getClient = () => Promise.resolve({
        rpc: (fn, args) => {
          if (fn === 'creator_orbit_list') {
            return Promise.resolve({ data: { ok: true, orbit: [{ username: 'ghostkid', circle: false }] }, error: null });
          }
          if (fn === 'creator_orbit_set') {
            window.__orbitSets.push(args.p_username);
            return Promise.resolve({ data: { ok: true, username: args.p_username, orbited: true, circle: true }, error: null });
          }
          return Promise.resolve({ data: { ok: false }, error: null });
        },
      });
      // stargirl was chosen while the platform refused to listen;
      // ghostkid the platform already knows.
      localStorage.setItem('vihu.orbit.' + s.aCard, JSON.stringify({
        stargirl: { circle: false }, ghostkid: {} }));
      const r = await CreatorOrbit.refresh();
      await new Promise((res) => setTimeout(res, 150));
      const map = JSON.parse(localStorage.getItem('vihu.orbit.' + s.aCard) || '{}');
      return { r, pushed: window.__orbitSets.slice().sort(),
        kept: Object.keys(map).sort(), circle: !!(map.stargirl && map.stargirl.circle) };
    }, seeded);
    ck(heal.r === true && heal.pushed.join(',') === 'stargirl' &&
       heal.kept.join(',') === 'ghostkid,stargirl' && heal.circle,
       'RC1 A CHOICE THE PLATFORM NEVER HEARD IS PUSHED UP, NOT LOST — the fresh platform copy keeps it, the platform learns it, and its answered mutuality lands',
       JSON.stringify(heal));

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

    // ---- E: Studio Home reaches the Ether, and shows what lives there
    // (R3.4, asked for by the product owner: "studio home needs a way
    // to go to ether" · "studio home should also show what of my
    // creations are in ether".) The door is a fixed corner pill so the
    // fold never pays for it (creation-home F13 caught the in-flow
    // draft); the shelf is the child's OWN shared stories, card-scoped
    // like My Projects, opening their public deep links — and leaving
    // through either surrenders the tab's inside authority.
    await page.evaluate((s) => {
      MagicCard.setActive(s.aCard);
      CreatorProjectStore.markPublished(s.mine);
      // THE REPORTED VINTAGE (R3.6, "am seeing this here in lot of
      // stories"): a story shared before reading images were baked —
      // its pages carry only their own small thumbnails, under the
      // older `slides` spelling publishStudio also reads, and the
      // record has no cover at all. Perfectly readable in the Ether
      // (the portal falls back to page thumbnails); the peeks read
      // only pages[].readImage and showed "Still being made ✨".
      const old = CreatorProjectStore.newId();
      CreatorProjectStore.upsert(old, { name: 'the falling star', thumbnail: null },
        { version: 1, slides: [{ id: 's1', thumbnail: s.px }, { id: 's2', thumbnail: s.thumb }] });
      CreatorProjectStore.markPublished(old);
      // Scene 3 asks a Returning Creator for their sky; the one-shot
      // recognition note is what a child arriving from VihuPlanet
      // carries (creation-home's own established boot pattern).
      try { CreatorRecognition.markRecognised(s.aCard); } catch (e) {}
    }, seeded);
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
    // Tap through the Gateway cinematic the way a child skips it.
    for (let i = 0; i < 14; i++) {
      const doneGw = await page.evaluate(() => {
        const gw = document.getElementById('gatewayOverlay');
        if (!gw || gw.classList.contains('hidden') ||
            getComputedStyle(gw).display === 'none') return true;
        gw.click();
        return false;
      });
      if (doneGw) break;
      await page.waitForTimeout(700);
    }
    await page.waitForSelector('.creation-flow-ether-door', { timeout: 20000 });
    await page.waitForSelector('.creation-flow-ether-thing', { timeout: 10000 });
    const shelf = await page.evaluate(() => ({
      door: (document.querySelector('.creation-flow-ether-door') || {}).textContent || '',
      fixed: getComputedStyle(document.querySelector('.creation-flow-ether-door')).position === 'fixed',
      things: Array.from(document.querySelectorAll('.creation-flow-ether-name')).map((n) => n.textContent),
    }));
    ck(/Back to the Ether/.test(shelf.door) && shelf.fixed,
       'E1  STUDIO HOME HAS A WAY TO THE ETHER — one quiet corner pill, fixed outside the flow so the fold never pays for it');
    ck(shelf.things.length === 2 && shelf.things.indexOf('The Moon Dragon') !== -1 &&
       shelf.things.indexOf('the falling star') !== -1,
       'E2  AND SHOWS THE CHILD\'S OWN STORIES IN THE ETHER — scoped to their card, absent when nothing is shared',
       shelf.things.join(','));
    // R3.5 — TURNED AROUND, corrected by the product owner: this used
    // to assert the shelf story navigated to the Ether's deep link,
    // and he asked for the opposite — "the creation should load on
    // studio home itself." The Ether stays one press away at the
    // corner door; a creation opens as a quiet pager right here.
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.creation-flow-ether-thing'))
        .find((b) => /The Moon Dragon/.test(b.textContent)).click();
    });
    await page.waitForSelector('.social-sky-overlay .social-sky-peek img', { timeout: 8000 });
    const peek = await page.evaluate(() => ({
      url: location.pathname,
      title: (document.querySelector('.social-sky-overlay .social-sky-space-name') || {}).textContent || '',
    }));
    ck(/studio\.html/.test(peek.url) && peek.title === 'The Moon Dragon',
       'E3  A SHELF STORY OPENS ON STUDIO HOME ITSELF — a quiet pager over the room, nothing navigates, the Studio never lost',
       peek.title);
    // R3.6 — THE REPORT ITSELF: the vintage story must peek to its
    // PAGES, not to "Still being made ✨". Proved against the exact
    // record shape that failed (slides spelling, thumbnails only, no
    // cover); reverting readingPagesOf turns this red.
    await page.evaluate(() => {
      document.querySelectorAll('.social-sky-overlay').forEach((o) => o.remove());
      Array.from(document.querySelectorAll('.creation-flow-ether-thing'))
        .find((b) => /the falling star/.test(b.textContent)).click();
    });
    await page.waitForSelector('.social-sky-overlay .social-sky-peek img', { timeout: 8000 });
    const vintage = await page.evaluate(() => ({
      title: (document.querySelector('.social-sky-overlay .social-sky-space-name') || {}).textContent || '',
      img: !!document.querySelector('.social-sky-overlay .social-sky-peek img'),
      nav: !!document.querySelector('.social-sky-overlay .social-sky-peek-nav'),
      stillBeingMade: /Still being made/.test(
        (document.querySelector('.social-sky-overlay') || {}).textContent || ''),
    }));
    ck(vintage.title === 'the falling star' && vintage.img && vintage.nav && !vintage.stillBeingMade,
       'E4  A STORY SHARED BEFORE READING IMAGES STILL SHOWS ITS PAGES — the portal\'s own thumbnail fallback, both payload spellings, never "Still being made" for a finished story',
       JSON.stringify(vintage));
    // and the same correction in the Sky: a creation in a Creator's
    // space reads right there, in the same overlay.
    await page.evaluate(() => {
      document.querySelectorAll('.social-sky-overlay').forEach((o) => o.remove());
      SocialSky.open({ creator: 'moonmaker' });
    });
    await page.waitForSelector('.social-sky-space-thing', { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.social-sky-space-thing'))
        .find((b) => /The Moon Dragon/.test(b.textContent)).click();
    });
    await page.waitForSelector('.social-sky-overlay .social-sky-peek img', { timeout: 8000 });
    const skyPeek = await page.evaluate(() => ({
      url: location.pathname,
      title: (document.querySelector('.social-sky-space-name') || {}).textContent || '',
      overlays: document.querySelectorAll('.social-sky-overlay').length,
    }));
    ck(/studio\.html/.test(skyPeek.url) && skyPeek.title === 'The Moon Dragon' && skyPeek.overlays === 1,
       'SP1 A CREATION IN THE SKY OPENS RIGHT THERE TOO — the same overlay\'s own pager, never a trip back to the Ether',
       skyPeek.title);

    // ---- G: the Studio survives a refresh --------------------------
    // R3, by the product owner's instruction (amending Decision 23's
    // "a refresh mid-story goes home"): a tab that entered through the
    // door keeps its authority across a refresh; a new tab, a typed
    // URL and a deliberate exit still meet the door. A fresh browser
    // context, so no author-mode flag can quietly exempt everything.
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.route('**/supabase-config.json', (route) => route.fulfill({ status: 404, body: '' }));
    await p2.goto(BASE + '/studio.html', { waitUntil: 'commit' }).catch(() => {});
    await p2.waitForTimeout(1500);
    ck(/index\.html/.test(p2.url()),
       'G1  A TYPED STUDIO URL WITH NO PASS STILL GOES HOME — the door is exactly as strict as it was', p2.url());
    await p2.evaluate(() => { sessionStorage.setItem('vihu.studioEntry.pass', '1'); });
    await p2.goto(BASE + '/studio.html', { waitUntil: 'commit' }).catch(() => {});
    await p2.waitForTimeout(1500);
    const entered = { url: p2.url(), inside: await p2.evaluate(() =>
      sessionStorage.getItem('vihu.studioEntry.inside')).catch(() => null) };
    ck(/studio\.html/.test(entered.url) && entered.inside === '1',
       'G2  A PASS STILL AUTHORISES THE ARRIVAL — and now also marks this tab as legitimately inside');
    await p2.reload({ waitUntil: 'commit' }).catch(() => {});
    await p2.waitForTimeout(1500);
    ck(/studio\.html/.test(p2.url()),
       'G3  AND A REFRESH STAYS IN THE STUDIO — the destination survives, exactly what was asked for', p2.url());
    await p2.evaluate(() => { sessionStorage.removeItem('vihu.studioEntry.inside'); });
    await p2.goto(BASE + '/studio.html', { waitUntil: 'commit' }).catch(() => {});
    await p2.waitForTimeout(1500);
    ck(/index\.html/.test(p2.url()),
       'G4  WITH THE AUTHORITY SURRENDERED (the deliberate exit clears it), the door is shut again — the back button cannot sneak past');
    const exitSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
    ck(/etherBtnEl\.addEventListener[\s\S]{0,400}vihu\.studioEntry\.inside/.test(exitSrc),
       'G5  and Back to the Ether is what surrenders it — leaving on purpose still lands on VihuPlanet, Decision 23\'s own rule');
    await ctx.close();
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
