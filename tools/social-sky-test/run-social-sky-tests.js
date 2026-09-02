/* SPRINT SOCIAL SKY R1 — the Sky, Show, Gifts, and gravity.
 *
 * Three relationship states, drawn as a sky of Companions; a new
 * star that glows until it has been seen; a mutual pair with its own
 * distinct glow and the ONE extra capability (seeing each other's
 * non-Ether work); Show — creation-first, snapshot, never a message;
 * Gifts with Keep making an exact-location copy; and gravity in the
 * Ether that changes likelihood, never the world.
 *
 *   A. THE DATABASE, EXECUTED (supabase/migrations_social_sky.sql)
 *      · the sky is OWNER-ONLY: incoming choosers visible to me and
 *        to nobody else, no count anywhere
 *      · Show requires the SENDER to have chosen the recipient;
 *        being chosen grants nothing
 *      · gifts are recipient-only; a sender can never ask seen/kept
 *      · a Show survives the relationship ending (units of the past)
 *      · Show changes NOTHING else — no project row, no orbit row
 *      · mutual visibility is LIVE, both directions, non-Ether only
 *
 *   B. THE STUDIO, WALKED (js/socialSky.js · js/creationShow.js)
 *      · Studio Home offers 🌌 My Sky · 🎁 Gifts to a card-holder
 *        and nothing to a Traveller
 *      · the sky renders COMPANIONS in three distinguishable layers;
 *        the new-star and mutual glows are TEMPORARY (seen settles
 *        them); the 🎁 indicator rides the right star
 *      · "✨ New stars are interested in your creations" — never a
 *        name in that line, never "followed you", never a count
 *      · Show from every creation type; Keep copies to the
 *        corresponding place; the original is untouched; nothing is
 *        published and no relationship changes
 *
 *   C. THE ETHER, WALKED (js/creatorPresence.js · js/etherFeed.js)
 *      · the shelf speaks sky language (⭐ Put them in my Sky) and
 *        the retired make-for entry is gone
 *      · a mutual shelf shows "✨ Not in the Ether yet"
 *      · gravity: mutual > chosen ordering, freshness first,
 *        experienced/cheered never boosted, traveller untouched
 *
 *   D. NO SOCIAL PRESSURE, ENFORCED — vocabulary and digit scans
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/social-sky-test/run-social-sky-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SKY_PORT || 8794);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');

const PGDIR = '/tmp/vihu-social-sky-pg';
const PGPORT = 55443;

let passed = 0, failed = 0, skipped = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function sk(n, why) { skipped++; console.log('  --   ' + n + '  (' + why + ')'); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

const A_UID = '11111111-1111-1111-1111-111111111111';
const B_UID = '22222222-2222-2222-2222-222222222222';
const C_UID = '33333333-3333-3333-3333-333333333333';

// ===================================================================
// A. THE DATABASE, EXECUTED
// ===================================================================
function sqlSection() {
  console.log('\nA. THE DATABASE, EXECUTED  (supabase/migrations_social_sky.sql)');
  const pg = startPg();
  if (!pg) { sk('A1-A12  the whole database section', 'no PostgreSQL'); return; }
  try {
    const fix = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (fix) { no('A0  the fixture loads', fix.split('\n')[0]); return; }
    // The real deployment order: identity, then orbit, then sky.
    for (const m of ['migrations_social_identity.sql', 'migrations_social_orbit.sql']) {
      const err = loadFile(pg, path.join(ROOT, 'supabase', m));
      if (err) { no('A0  ' + m + ' underneath', err.split('\n')[0]); return; }
    }
    const m1 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_sky.sql'));
    const m2 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_sky.sql'));
    ck(!m1 && !m2, 'A0  the migration applies, and applies twice', m1 || m2 || 'clean');
    if (m1 || m2) return;

    // Supabase grants table privileges broadly by default; a bare
    // cluster does not. Granting them is what makes the RLS check a
    // proof that no-policies does the hiding, not a missing grant.
    psql(pg, 'grant select, insert, update, delete on public.creator_orbits, public.creator_shows, public.creator_projects to anon, authenticated;');

    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern,username,companion_id)
              values ('card_a','${A_UID}','Vihaan','ORION','[[1,2]]','moonmaker','leafy'),
                     ('card_b','${B_UID}','Meera','LYRA','[[3,4]]','stargirl','quill'),
                     ('card_c','${C_UID}','Quiet','CYGNUS','[[5,6]]',null,'nimbus');`);
    // B's work: one in the Ether, one private, one held by a rite.
    psql(pg, `insert into public.creator_projects(id,owner_id,data) values
      ('proj_pub','${B_UID}','{"id":"proj_pub","name":"In the Ether","cardId":"card_b","publishedAt":"2026-01-01T00:00:00Z","pages":[]}'),
      ('proj_prv','${B_UID}','{"id":"proj_prv","name":"Still Making","cardId":"card_b","pages":[]}'),
      ('proj_rit','${B_UID}','{"id":"proj_rit","name":"Held Rite","cardId":"card_b","riteInProgress":"my-garden","pages":[]}');`);

    const call = (uid, fn, args) => {
      const r = asSession(pg, uid, `select public.${fn}(${args});`);
      try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); }
      catch (e) { return {}; }
    };

    // ---- the sky, owner-only ---------------------------------------
    let r = call(B_UID, 'creator_sky_list', `'card_a'`);
    const ghost = call(A_UID, 'creator_sky_list', `'card_ghost'`);
    ck(r.reason === 'not_yours' && ghost.reason === 'not_yours',
       'A1  THE SKY IS OWNER-ONLY — a stranger\'s card answers like a missing one');

    call(B_UID, 'creator_orbit_set', `'card_b','moonmaker',true`);   // B chooses A
    r = call(A_UID, 'creator_sky_list', `'card_a'`);
    ck(r.ok === true && r.sky.length === 0 && r.choseMe.length === 1
       && r.choseMe[0].username === 'stargirl' && r.choseMe[0].companion === 'quill',
       'A2  A NEW STAR — somebody chose me, visible to ME with their Companion, chosen by nobody\'s count',
       JSON.stringify(r.choseMe));
    const bSide = call(B_UID, 'creator_sky_list', `'card_b'`);
    ck(bSide.ok === true && bSide.choseMe.length === 0 && bSide.sky.length === 1
       && bSide.sky[0].circle === false,
       'A2b and B is NOT told what A knows — B\'s own sky just says "I chose moonmaker"');

    call(A_UID, 'creator_orbit_set', `'card_a','stargirl',true`);    // A chooses back
    r = call(A_UID, 'creator_sky_list', `'card_a'`);
    ck(r.ok === true && r.choseMe.length === 0 && r.sky.length === 1
       && r.sky[0].circle === true && r.sky[0].companion === 'quill',
       'A3  CHOOSING BACK MOVES THE STAR — out of choseMe, into the sky as a mutual', JSON.stringify(r.sky));

    // A chooser with no public username can never surface.
    asSession(pg, C_UID, `select public.creator_orbit_set('card_c','moonmaker',true);`);
    // (orbit_set requires nothing of the CHOOSER's own name, only the
    // target's — so a pre-username chooser is a real state, not a
    // contrived one.)
    r = call(A_UID, 'creator_sky_list', `'card_a'`);
    ck(r.ok === true && r.choseMe.length === 0,
       'A4  A CHOOSER WITH NO PUBLIC NAME NEVER SURFACES — there is no honest way to show them',
       JSON.stringify(r.choseMe));

    // ---- Show: eligibility is MY choice ----------------------------
    const pay = `'{"name":"A drawing","png":"data:image/png;base64,AA=="}'::jsonb`;
    r = call(B_UID, 'creation_show_send', `'card_a','stargirl','drawing','A drawing','{}'::jsonb,${pay}`);
    ck(r.reason === 'not_yours',
       'A5  SHOW IS OWNER-VERIFIED — a stranger cannot send from somebody else\'s card');
    r = call(A_UID, 'creation_show_send', `'card_a','nobodyatall','drawing','x','{}'::jsonb,${pay}`);
    ck(r.reason === 'unknown', 'A5b an unknown recipient is its own kind answer');

    // C chose A — but A never chose C, so A cannot Show to C, and C
    // choosing A grants C nothing either (C -> A has no username to
    // even resolve; test the pure direction with a fresh card).
    psql(pg, `update public.magic_card_identities set username='quietone' where id='card_c';`);
    r = call(A_UID, 'creation_show_send', `'card_a','quietone','drawing','x','{}'::jsonb,${pay}`);
    ck(r.reason === 'not_chosen',
       'A6  THEY CHOSE ME GRANTS NO SHOW — the sender must have chosen the recipient themselves');

    const beforeOrbits = psql(pg, 'select count(*) from public.creator_orbits;');
    const beforeProjects = psql(pg, 'select count(*)||md5(string_agg(data::text,\'\' order by id)) from public.creator_projects;');
    r = call(A_UID, 'creation_show_send', `'card_a','stargirl','drawing','My Dragon','{"store":"garden","room":"drawings"}'::jsonb,${pay}`);
    ck(r.ok === true && /^show_/.test(r.id || ''),
       'A7  A CHOSEN CREATOR CAN BE SHOWN — the snapshot lands', r.id);
    const afterOrbits = psql(pg, 'select count(*) from public.creator_orbits;');
    const afterProjects = psql(pg, 'select count(*)||md5(string_agg(data::text,\'\' order by id)) from public.creator_projects;');
    ck(beforeOrbits === afterOrbits && beforeProjects === afterProjects,
       'A7b and NOTHING ELSE MOVED — no orbit row, no project row, nothing published');

    const big = call(A_UID, 'creation_show_send',
      `'card_a','stargirl','drawing','x','{}'::jsonb,('{"png":"' || repeat('A', 4100000) || '"}')::jsonb`);
    ck(big.reason === 'too_big', 'A7c an over-large payload is refused by name');

    // ---- gifts: recipient-only -------------------------------------
    let g = call(B_UID, 'creation_show_list', `'card_b'`);
    ck(g.ok === true && g.gifts.length === 1 && g.gifts[0].from === 'moonmaker'
       && g.gifts[0].companion === 'leafy'
       && g.gifts[0].seen === false && !('payload' in g.gifts[0]),
       'A8  THE RECIPIENT LISTS THEIR GIFTS — metadata only, unseen, and the row names the CARRIER (the sender\'s Companion)',
       JSON.stringify(g.gifts));
    const senderList = call(A_UID, 'creation_show_list', `'card_a'`);
    ck(senderList.ok === true && senderList.gifts.length === 0,
       'A8b A SENDER CANNOT LIST WHAT THEY SENT — no read receipts, ever');
    const showId = g.gifts[0].id;
    const got = call(B_UID, 'creation_show_get', `'card_b','${showId}'`);
    ck(got.ok === true && got.gift.payload && got.gift.payload.png,
       'A8c the creation itself opens for the recipient');
    const stolen = call(A_UID, 'creation_show_get', `'card_a','${showId}'`);
    ck(stolen.reason === 'unknown',
       'A8d and for NOBODY else — not even the sender');

    r = call(B_UID, 'creation_show_mark', `'card_b','${showId}','seen'`);
    const g2 = call(B_UID, 'creation_show_list', `'card_b'`);
    ck(r.ok === true && g2.gifts[0].seen === true && g2.gifts[0].kept === false,
       'A9  seen is the recipient\'s own mark');

    // ---- the historical rule ---------------------------------------
    call(A_UID, 'creator_orbit_set', `'card_a','stargirl',false`);   // A leaves; mutuality ends
    const gAfter = call(B_UID, 'creation_show_list', `'card_b'`);
    const keptAfter = call(B_UID, 'creation_show_mark', `'card_b','${showId}','kept'`);
    ck(gAfter.ok === true && gAfter.gifts.length === 1 && keptAfter.ok === true,
       'A10 A SHOW SURVIVES THE RELATIONSHIP ENDING — listed, openable, still keepable (units of the past)');

    // ---- mutual visibility, live -----------------------------------
    r = call(A_UID, 'creator_mutual_projects', `'card_a','stargirl'`);
    ck(r.reason === 'not_mutual',
       'A11 NON-MUTUAL SEES NO NON-ETHER WORK — and an unknown name answers identically',
       JSON.stringify([r.reason, call(A_UID, 'creator_mutual_projects', `'card_a','nobodyatall'`).reason]));
    call(A_UID, 'creator_orbit_set', `'card_a','stargirl',true`);    // mutual again
    r = call(A_UID, 'creator_mutual_projects', `'card_a','stargirl'`);
    ck(r.ok === true && r.projects.length === 1 && r.projects[0].record.name === 'Still Making',
       'A11b MUTUAL SEES EXACTLY THE NON-ETHER WORK — never the shared one, never the held rite',
       JSON.stringify((r.projects || []).map((p) => p.record.name)));
    call(B_UID, 'creator_orbit_set', `'card_b','moonmaker',false`);  // B leaves this time
    r = call(A_UID, 'creator_mutual_projects', `'card_a','stargirl'`);
    ck(r.reason === 'not_mutual',
       'A11c and the visibility ENDS the moment the mutuality does — checked live');

    // ---- RLS: a session's own eyes see nothing ---------------------
    const direct = asSession(pg, B_UID, 'select count(*) from public.creator_shows;');
    ck(lines(direct).includes('0'),
       'A12 A SESSION\'S DIRECT SELECT ON creator_shows SEES NOTHING — RLS on, no policies');
    const fns = psql(pg,
      `select string_agg(p.proname, ',') from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.prokind = 'f'
         and pg_get_functiondef(p.oid) ~* 'creator_shows';`);
    ck(fns.split(',').sort().join(',') === 'creation_show_get,creation_show_list,creation_show_mark,creation_show_send',
       'A12b and exactly FOUR functions touch the table', fns);

    const verdict = psqlOut(pg, path.join(ROOT, 'supabase', 'verify_social_sky.sql'));
    ck(/PASS/.test(verdict) && !/FAIL/.test(verdict),
       'A13 supabase/verify_social_sky.sql answers all-PASS',
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
  // No platform by default: every rpc path resolves quietly to null.
  await page.route('**/supabase-config.json', (route) => route.fulfill({ status: 404, body: '' }));

  // ---- seed: two Creators, their work, and A's local sky ------------
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
    typeof CreatorProjectStore !== 'undefined' && typeof HandwritingStore !== 'undefined',
    null, { timeout: 20000 });
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
    const mk = (name, when) => {
      const id = CreatorProjectStore.newId();
      CreatorProjectStore.upsert(id, { name: name, thumbnail: px('#888') },
        { version: 1, pages: [{ id: 'p1', readImage: px('#aa5533') }] });
      CreatorProjectStore.markPublished(id, when);
      return id;
    };
    const sNew = mk('Fresh From Meera', '2026-02-02T00:00:00Z');
    const sOld = mk('Older From Meera', '2026-01-01T00:00:00Z');
    const sExp = mk('Seen Already', '2026-02-01T00:00:00Z');
    const sChe = mk('Cheered Already', '2026-02-01T12:00:00Z');

    const a = MagicCard.claim('Vihaan', null, { companionId: 'leafy' });
    MagicCard.setActive(a.id);
    MagicCard._setLocalUsername(a.id, 'moonmaker');
    const mine = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(mine, { name: 'The Moon Dragon', thumbnail: px('#3355aa') },
      { version: 1, pages: [{ id: 'p1', readImage: px('#3355aa') }] });
    CreatorProjectStore.markPublished(mine, '2026-02-03T00:00:00Z');
    await new Promise((r) => setTimeout(r, 1200));
    return { aCard: a.id, bCard: b.id, sNew, sOld, sExp, sChe, mine, px: px('#227722') };
  });

  // ===================================================================
  console.log('\nB. THE STUDIO, WALKED  (🌌 My Sky · 🎁 Gifts · Show · Keep)');
  // ===================================================================
  // The sky's platform cache and the choices, seeded as the platform
  // would leave them: A chose stargirl (mutual) and one incoming new
  // star has arrived from a third Creator.
  await page.evaluate((s) => {
    localStorage.setItem('vihu.orbit.' + s.aCard, JSON.stringify({ stargirl: { circle: true } }));
    localStorage.setItem('vihu.sky.' + s.aCard, JSON.stringify({
      sky: [{ username: 'stargirl', companion: 'quill', circle: true }],
      choseMe: [{ username: 'newfriend', companion: 'nimbus', since: '2026-02-01T00:00:00Z' }]
    }));
  }, seeded);

  // The REAL return: a genuine page load, the Gateway tapped the way
  // a child taps it, landing on Studio Home.
  await page.evaluate(() => {
    try { CreatorRecognition.markRecognised(MagicCard.getActive().id); } catch (e) {}
  });
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  for (let i = 0; i < 14; i++) {
    const done = await page.evaluate(() => {
      const gw = document.getElementById('gatewayOverlay');
      if (!gw || gw.classList.contains('hidden') ||
          getComputedStyle(gw).display === 'none') return true;
      gw.click();
      return false;
    });
    if (done) break;
    await page.waitForTimeout(700);
  }
  await page.waitForFunction(() =>
    document.body.classList.contains('creation-flow-active'), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(900);

  const band = await page.evaluate(() => {
    const t = (document.querySelector('.creation-flow-social') || {}).innerText || '';
    return {
      sky: /🌌 My Sky/.test(t),
      gifts: /🎁 Gifts/.test(t),
      oldRow: /My Orbit · /.test(t),
      newStars: /New stars are interested in your creations/.test(t),
      found: /You and @stargirl found each other/.test(t),
      named: /newfriend/.test(t),
    };
  });
  ck(band.sky && band.gifts && !band.oldRow,
     'B1  STUDIO HOME OFFERS 🌌 My Sky · 🎁 Gifts — the sky replaced the list row', JSON.stringify(band));
  ck(band.newStars && !band.named,
     'B2  "✨ New stars are interested in your creations" — and NEVER the chooser\'s name at the door',
     JSON.stringify({ newStars: band.newStars, named: band.named }));
  ck(band.found,
     'B2b the mutual creative event says you FOUND EACH OTHER — never "request accepted"');
  await page.screenshot({ path: path.join(SHOTS, 'B1-studio-home.png') });

  // ---- the sky itself ----------------------------------------------
  // SOCIAL SKY R1.1 turned these checks around: the sky is SPATIAL now
  // — the child's Companion at the centre, mutual stars nearest (with
  // constellation lines), incoming stars far and faint — and the three
  // states are told apart by distance, scale and light, never by three
  // list sections with graph labels.
  const sky = await page.evaluate(() => {
    document.querySelectorAll('.creation-flow-socialdoor-btn').forEach((b) => {
      if (/My Sky/.test(b.textContent)) b.click();
    });
    return new Promise((resolve) => setTimeout(() => {
      const panel = document.querySelector('.social-sky-panel');
      const field = document.querySelector('.social-sky-field');
      const fr = field ? field.getBoundingClientRect() : null;
      const cx = fr ? fr.left + fr.width / 2 : 0, cy = fr ? fr.top + fr.height / 2 : 0;
      const stars = Array.from(document.querySelectorAll('.social-sky-star')).map((s) => {
        const r = s.getBoundingClientRect();
        const img = s.querySelector('.social-sky-companion');
        return {
          cls: s.className,
          name: (s.querySelector('.social-sky-name') || {}).textContent,
          companion: img ? img.getAttribute('src') : null,
          glow: s.classList.contains('is-new'),
          dist: Math.round(Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)),
        };
      });
      const me = document.querySelector('.social-sky-me');
      const meR = me ? me.getBoundingClientRect() : null;
      resolve({
        open: !!panel,
        fieldW: fr ? Math.round(fr.width) : 0,
        stars,
        meCentered: meR ? Math.round(Math.hypot(meR.left + meR.width / 2 - cx,
                                                meR.top + meR.height / 2 - cy)) : null,
        lines: document.querySelectorAll('.social-sky-lines line').length,
        bands: document.querySelectorAll('.social-sky-band').length,
        text: panel ? panel.innerText : '',
      });
    }, 700));
  });
  const mStar = (sky.stars || []).find((s) => /is-mutual/.test(s.cls));
  const fStar = (sky.stars || []).find((s) => /is-far/.test(s.cls));
  ck(sky.open && !!mStar && !!fStar && sky.bands === 0
     && !/They chose me|I chose them|We chose each other/.test(sky.text),
     'B3  THE SKY IS SPATIAL — no list sections, no graph labels, the states are places',
     JSON.stringify({ bands: sky.bands, stars: sky.stars.length }));
  ck(sky.meCentered !== null && sky.meCentered < 40 && mStar.dist < fStar.dist,
     'B3b MY COMPANION IS THE CENTRE, the mutual star nearest, the new chooser furthest',
     JSON.stringify({ me: sky.meCentered, mutual: mStar.dist, far: fStar.dist }));
  ck(sky.lines === 1,
     'B3c a faint constellation line joins the mutual pair — "we chose each other", drawn, not said');
  ck(sky.fieldW >= 900,
     'B3d and the sky has room to breathe — a spacious canvas, not a small modal', sky.fieldW + 'px wide');
  ck(!!mStar && /quill\/idle\.png/.test(mStar.companion || '')
     && mStar.name === '@stargirl',
     'B4  A CREATOR APPEARS THROUGH THEIR COMPANION — Quill stands for @stargirl, the name a small label',
     JSON.stringify({ companion: mStar.companion, name: mStar.name }));
  ck(fStar.glow === true && mStar.glow === true,
     'B5  THE NEW STAR GLOWS, AND THE NEW MUTUAL GLOWS ITS OWN WAY — both unseen right now');
  ck(!/\d/.test(sky.text.replace(/🌌|✨|🎁/g, '')),
     'B5b and NOT ONE NUMBER anywhere in the sky', sky.text.replace(/\n/g, ' · '));
  await page.screenshot({ path: path.join(SHOTS, 'B4-sky.png') });

  // Seen settles the glow; the stars stay.
  const settled = await page.evaluate(() => {
    document.querySelector('.social-sky-quiet').click();
    return new Promise((resolve) => setTimeout(() => {
      SocialSky.open();
      setTimeout(() => {
        const glows = document.querySelectorAll('.social-sky-star.is-new').length;
        const stars = document.querySelectorAll('.social-sky-star').length;
        const lines = SocialSky.eventLines();
        document.querySelector('.social-sky-quiet').click();
        resolve({ glows, stars, lines });
      }, 400);
    }, 300));
  });
  ck(settled.glows === 0 && settled.stars === 2,
     'B6  SEEN SETTLES THE GLOW — the stars themselves stay', JSON.stringify(settled));
  ck(settled.lines.length === 0,
     'B6b and the creative events go quiet with it — an invitation, never a nag');

  // ---- Show, from every creation type ------------------------------
  const showables = await page.evaluate(async (s) => {
    await CreatorLibrary.save({ name: 'My Dragon Drawing', png: s.px });
    await HandwritingStore.save({ ch: 'A', png: s.px, w: 8, h: 8 });
    await new Promise((r) => setTimeout(r, 400));
    const m = CreationShow.myShowables();
    return { stories: m.stories.length, drawings: m.drawings.length, letters: m.letters.length };
  }, seeded);
  ck(showables.stories >= 1 && showables.drawings === 1 && showables.letters === 1,
     'B7  IF I CREATED IT I CAN SHOW IT — stories, drawings and letters all offered', JSON.stringify(showables));

  const showSent = await page.evaluate(async () => {
    // The platform answers, in place (const-binding rule: mutate the
    // api object, never swap window.X).
    const sent = [];
    ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn, args) => {
        if (fn === 'creation_show_send') { sent.push(args); return Promise.resolve({ data: { ok: true, id: 'show_x' + sent.length }, error: null }); }
        return Promise.resolve({ data: { ok: false, reason: 'unsupported' }, error: null });
      }
    });
    const m = CreationShow.myShowables();
    const out = [];
    for (const it of [m.stories[0], m.drawings[0], m.letters[0]]) {
      out.push(await CreationShow.send(it, 'stargirl'));
    }
    window.__sent = sent;
    return { results: out, kinds: sent.map((a) => a.p_kind), places: sent.map((a) => JSON.stringify(a.p_place)) };
  });
  ck(showSent.results.every((r) => r.ok) && showSent.kinds.join(',') === 'story,drawing,letter',
     'B8  EVERY KIND SENDS — a snapshot each, with its place riding along', JSON.stringify(showSent.places));

  // THE CORE WORLD RULE, now walked as the PORTAL JOURNEY (R2): after
  // the recipient comes the optional note, then the departure — the
  // Companion takes the creation, a portal opens, it crosses, the
  // portal closes, and the words say the original stayed. (This check
  // used to assert the R1 static confirmation; the journey replaced
  // it, and the deep proof lives in tools/show-journey-test.)
  const crossing = await page.evaluate(async () => {
    const m = CreationShow.myShowables();
    CreationShow.openShowDialog(m.stories[0]);
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('.creation-show-who-btn').click();
    await new Promise((r) => setTimeout(r, 200));
    const noteField = document.querySelector('.creation-show-notefield');
    const hadNote = !!noteField;
    Array.from(document.querySelectorAll('.creation-show-btns button'))
      .find((b) => /Show it/.test(b.textContent)).click();
    await new Promise((r) => setTimeout(r, 500));
    const panel = document.querySelector('.creation-show-panel');
    const out = {
      hadNote,
      text: panel ? panel.innerText : '',
      figure: !!document.querySelector('.show-journey-traveller .creation-gift-carrier-figure, .show-journey-companion'),
      portal: !!document.querySelector('.show-portal'),
      // R3 staged the pickup: the carried shimmer travels while the
      // ORIGINAL stands in the stage — both are the proof now.
      held: !!(document.querySelector('.show-journey-carried') &&
               document.querySelector('.show-journey-original')),
    };
    document.querySelector('.creation-show-overlay').remove();
    return out;
  });
  ck(crossing.hadNote && /is taking it/.test(crossing.text) && crossing.figure &&
     crossing.portal && crossing.held,
     'B8c THE COMPANION IS THE CARRIER — a note is offered, then the Companion sets off through a portal with the creation held, and the original stays home',
     crossing.text.replace(/\n/g, ' · ').slice(0, 80));

  const nothingMoved = await page.evaluate((s) => ({
    published: CreatorProjectStore.listPublished().length,
    orbit: JSON.parse(localStorage.getItem('vihu.orbit.' + s.aCard)),
  }), seeded);
  ck(nothingMoved.published === 5 && nothingMoved.orbit.stargirl.circle === true,
     'B8b SHOW PUBLISHED NOTHING AND CHANGED NO RELATIONSHIP — the Ether and the sky are exactly as they were');

  // ---- gifts, viewing and keeping ----------------------------------
  const kept = await page.evaluate(async (s) => {
    // B (the recipient) at the machine now — their own card, their own
    // stores, a fresh gift list from the (stubbed) platform.
    MagicCard.setActive(s.bCard);
    const gifts = [
      { id: 'g1', from: 'moonmaker', kind: 'story', name: 'The Moon Dragon', place: { store: 'projects' }, at: '2026-02-03T00:00:00Z', seen: false, kept: false },
      { id: 'g2', from: 'moonmaker', kind: 'drawing', name: 'My Dragon Drawing', place: { store: 'garden', room: 'drawings' }, at: '2026-02-03T00:00:00Z', seen: false, kept: false },
      { id: 'g3', from: 'moonmaker', kind: 'letter', name: 'My letter A', place: { store: 'letters', ch: 'A' }, at: '2026-02-03T00:00:00Z', seen: false, kept: false },
      { id: 'g4', from: 'moonmaker', kind: 'letter', name: 'My letter Z', place: { store: 'letters', ch: 'Z' }, at: '2026-02-03T00:00:00Z', seen: false, kept: false },
    ];
    const payloads = {
      g1: { name: 'The Moon Dragon', thumbnail: s.px, data: { version: 1, pages: [{ id: 'p1', readImage: s.px }] } },
      g2: { name: 'My Dragon Drawing', png: s.px, thumbnail: s.px },
      g3: { ch: 'A', png: s.px, w: 8, h: 8 },
      g4: { ch: 'Z', png: s.px, w: 8, h: 8 },
    };
    ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn, args) => {
        if (fn === 'creation_show_list') return Promise.resolve({ data: { ok: true, gifts: gifts }, error: null });
        if (fn === 'creation_show_get') {
          const g = gifts.find((x) => x.id === args.p_id);
          return Promise.resolve({ data: { ok: true, gift: Object.assign({ payload: payloads[args.p_id] }, g) }, error: null });
        }
        if (fn === 'creation_show_mark') return Promise.resolve({ data: { ok: true }, error: null });
        return Promise.resolve({ data: null, error: null });
      }
    });
    localStorage.setItem('vihu.gifts.' + s.bCard, JSON.stringify(gifts));
    // B already has their OWN letter A — kept letters never overwrite.
    await HandwritingStore.save({ ch: 'A', png: s.px, w: 8, h: 8 });
    await new Promise((r) => setTimeout(r, 300));

    const beforeProjects = CreatorProjectStore.list().length;
    const beforeShared = CreatorProjectStore.listPublished().length;
    const rStory = await CreationShow.keep(Object.assign({ payload: payloads.g1 }, gifts[0]));
    const rDraw = await CreationShow.keep(Object.assign({ payload: payloads.g2 }, gifts[1]));
    const rLetterA = await CreationShow.keep(Object.assign({ payload: payloads.g3 }, gifts[2]));
    const rLetterZ = await CreationShow.keep(Object.assign({ payload: payloads.g4 }, gifts[3]));
    await new Promise((r) => setTimeout(r, 500));

    const myProjects = CreatorProjectStore.list();
    const copy = myProjects.find((p) => p.name === 'The Moon Dragon');
    const drawings = CreatorLibrary.list().filter((d) => d.name === 'My Dragon Drawing');
    return {
      rStory, rDraw, rLetterA, rLetterZ,
      beforeProjects, afterProjects: myProjects.length,
      copy: copy ? { id: copy.id, cardId: copy.cardId, publishedAt: copy.publishedAt || null } : null,
      originalUntouched: (function () {
        const orig = CreatorProjectStore.listAll().find((p) => p.id === s.mine);
        return !!orig && orig.cardId === s.aCard && !!orig.publishedAt;
      })(),
      sharedAfter: CreatorProjectStore.listPublished().length,
      beforeShared,
      drawings: drawings.length,
      letterZ: !!HandwritingStore.get('Z'),
    };
  }, seeded);
  ck(kept.rStory.ok && kept.copy && kept.copy.id !== seeded.mine
     && kept.copy.cardId === seeded.bCard && kept.copy.publishedAt === null,
     'B9  KEEP COPIES A STORY INTO MY PROJECTS — a fresh, PRIVATE record of my own, never the original',
     JSON.stringify(kept.copy));
  ck(kept.originalUntouched,
     'B9b THE ORIGINAL REMAINS THE SENDER\'S — untouched, still theirs, still in the Ether');
  ck(kept.sharedAfter === kept.beforeShared,
     'B9c and keeping PUBLISHED NOTHING — the copy is not in the Ether');
  ck(kept.rDraw.ok && kept.drawings === 1,
     'B10 KEEP PUTS A DRAWING IN MY GARDEN — the corresponding place');
  ck(kept.rLetterZ.ok && kept.letterZ === true && kept.rLetterA.ok === false
     && kept.rLetterA.reason === 'have_own',
     'B10b A LETTER LANDS IN ITS OWN SLOT — and NEVER over the child\'s own letter', JSON.stringify(kept.rLetterA));

  // ---- the gift indicator feeds the sky ----------------------------
  const indicator = await page.evaluate((s) => {
    localStorage.setItem('vihu.sky.' + s.bCard, JSON.stringify({
      sky: [{ username: 'moonmaker', companion: 'leafy', circle: true }], choseMe: []
    }));
    const map = CreationShow.unseenBySender();
    SocialSky.open();
    return new Promise((resolve) => setTimeout(() => {
      const badge = !!document.querySelector('.social-sky-gift');
      document.querySelector('.social-sky-quiet').click();
      resolve({ map, badge });
    }, 500));
  }, seeded);
  ck(indicator.map.moonmaker === true && indicator.badge,
     'B11 🎁 RIDES THE RIGHT STAR — "moonmaker has something to show me", never a feed', JSON.stringify(indicator.map));

  // ---- the gift is revealed by the Companion that carried it -------
  const revealed = await page.evaluate(async (s) => {
    const g5 = { id: 'g5', from: 'moonmaker', companion: 'leafy', kind: 'letter',
                 name: 'My letter Q', place: { store: 'letters', ch: 'Q' },
                 at: '2026-02-04T00:00:00Z', seen: false, kept: false };
    ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn, args) => {
        if (fn === 'creation_show_list') return Promise.resolve({ data: { ok: true, gifts: [g5] }, error: null });
        if (fn === 'creation_show_get') return Promise.resolve({ data: { ok: true,
          gift: Object.assign({ payload: { ch: 'Q', png: s.px, w: 8, h: 8 } }, g5) }, error: null });
        if (fn === 'creation_show_mark') return Promise.resolve({ data: { ok: true }, error: null });
        return Promise.resolve({ data: null, error: null });
      }
    });
    localStorage.setItem('vihu.gifts.' + s.bCard, JSON.stringify([g5]));
    // The sky's 🎁 path: straight to that Creator's gift. R2 made the
    // first viewing an ARRIVAL — portal, the carrier stepping out,
    // introduction, then the reveal — so the Keep button exists only
    // once the journey has revealed the creation; this waits it out.
    // (The journey's own deep checks live in tools/show-journey-test.)
    CreationShow.openGifts({ from: 'moonmaker' });
    const panel = document.querySelector('.creation-show-panel');
    let keepBtn = null;
    for (let i = 0; i < 40 && !keepBtn; i++) {
      await new Promise((r) => setTimeout(r, 250));
      keepBtn = panel ? panel.querySelector('.creation-gift-keep') : null;
    }
    const trav = panel ? panel.querySelector('.show-journey-traveller img') : null;
    const line = (panel && panel.querySelector('.show-journey-line') || {}).textContent || '';
    let keepNote = '';
    if (keepBtn) {
      keepBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      keepNote = (panel.querySelector('.creation-show-note') || {}).textContent || '';
    }
    document.querySelector('.creation-show-overlay').remove();
    return { line, img: trav ? trav.getAttribute('src') : null, keepNote,
             haveQ: !!HandwritingStore.get('Q') };
  }, seeded);
  ck(/Hi! I’m @moonmaker’s Companion\. @moonmaker wanted me to show you something\./.test(revealed.line)
     && /leafy\/idle\.png/.test(revealed.img || ''),
     'B13 A GIFT ARRIVES WITH THE COMPANION THAT CARRIED IT — @moonmaker\'s own steps out of the portal and introduces itself',
     revealed.line);
  ck(/carried a copy/.test(revealed.keepNote) && revealed.haveQ,
     'B13b AND KEEP IS MY OWN COMPANION BRINGING THE COPY IN — into its own slot, in those words',
     revealed.keepNote);

  // ---- a Traveller has none of this --------------------------------
  const traveller = await page.evaluate(async () => {
    MagicCard.setActive(null);
    const send = await CreationShow.send({ kind: 'story', name: 'x', payload: () => ({}) }, 'stargirl');
    SocialSky.markExperienced('proj_x');
    return {
      sky: SocialSky.open(),
      layers: SocialSky.layers(),
      gifts: CreationShow.openGifts(),
      send: send,
      wrote: Object.keys(localStorage).filter((k) => /vihu\.(sky|gifts|etherSeen)\.(null|undefined)/.test(k)).length,
    };
  });
  ck(traveller.sky === false && traveller.layers === null && traveller.gifts === false
     && traveller.send.reason === 'no_card' && traveller.wrote === 0,
     'B12 A TRAVELLER HAS NO SKY AND NO GIFTS — every door refuses, and NOTHING is faked from browser state',
     JSON.stringify(traveller.send));
  await page.evaluate((id) => MagicCard.setActive(id), seeded.aCard);

  // ===================================================================
  console.log('\nC. THE ETHER, WALKED  (the shelf · mutual visibility · gravity)');
  // ===================================================================
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
    return { text: document.querySelector('.creator-presence-panel').innerText };
  }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  ck(!!shelf && /You chose each other|In your Sky ✓|Put them in my Sky/.test(shelf.text),
     'C1  THE SHELF SPEAKS SKY LANGUAGE — never orbit, never follow',
     shelf && shelf.text.replace(/\n/g, ' · '));
  ck(!!shelf && !/Make something for them/.test(shelf.text),
     'C1b THE RETIRED MAKE-FOR ENTRY IS GONE — Show starts from a creation, in the Studio');

  // ---- the mutual shelf: what is not in the Ether yet --------------
  const mutualShelf = await page.evaluate((s) => {
    // The platform confirms the mutuality and hands over the private
    // work — stubbed in place, the shape the real function returns.
    ThemeRepositoryClient.isConfigured = () => Promise.resolve(true);
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn) => Promise.resolve(fn === 'creator_mutual_projects'
        ? { data: { ok: true, projects: [{ id: 'proj_prv', record: { id: 'proj_prv', name: 'Still Making', thumbnail: s.px, data: { pages: [{ id: 'p1', readImage: s.px }] } } }] }, error: null }
        : { data: null, error: null })
    });
    document.querySelector('.creator-presence-quiet').click();
    CreatorPresence.open('stargirl', {});
    return new Promise((resolve) => setTimeout(() => {
      const sec = document.querySelector('.creator-presence-mutual');
      const rows = sec ? Array.from(sec.querySelectorAll('.creator-presence-row')).map((r) => r.innerText.trim()) : [];
      if (rows.length) sec.querySelector('.creator-presence-row').click();
      setTimeout(() => {
        const peek = document.querySelector('.creator-presence-peek');
        const img = peek ? !!peek.querySelector('.creator-presence-peek-page') : false;
        if (peek) peek.querySelector('.creator-presence-quiet').click();
        resolve({ text: sec ? sec.innerText : '', rows, peek: !!peek, img });
      }, 500);
    }, 700));
  }, seeded);
  ck(/Not in the Ether yet/.test(mutualShelf.text) && mutualShelf.rows.length === 1
     && /Still Making/.test(mutualShelf.rows[0]),
     'C2  A MUTUAL SHELF SHOWS ✨ Not in the Ether yet — because you chose each other',
     JSON.stringify(mutualShelf.rows));
  ck(mutualShelf.peek && mutualShelf.img,
     'C2b and a story with baked pages opens as a quiet peek — never the Studio, never the portal');
  await page.screenshot({ path: path.join(SHOTS, 'C2-mutual-shelf.png') });

  // A non-mutual shelf never asks and never shows.
  const nonMutual = await page.evaluate(() => {
    const calls = [];
    ThemeRepositoryClient.getClient = () => Promise.resolve({
      rpc: (fn) => { calls.push(fn); return Promise.resolve({ data: { ok: false, reason: 'not_mutual' }, error: null }); }
    });
    localStorage.setItem('vihu.orbit.' + MagicCard.getActive().id,
      JSON.stringify({ stargirl: { circle: false } }));
    document.querySelector('.creator-presence-quiet').click();
    CreatorPresence.open('stargirl', {});
    return new Promise((resolve) => setTimeout(() => {
      resolve({ calls, section: !!document.querySelector('.creator-presence-mutual .creator-presence-row') });
    }, 600));
  });
  ck(nonMutual.calls.length === 0 && !nonMutual.section,
     'C3  A NON-MUTUAL SHELF NEVER EVEN ASKS — the section is absent, not locked', JSON.stringify(nonMutual.calls));

  // ---- gravity: likelihood, never a different world ----------------
  const gravity = await page.evaluate(async (s) => {
    localStorage.setItem('vihu.orbit.' + s.aCard, JSON.stringify({ stargirl: { circle: true } }));
    localStorage.setItem('vihu.sky.' + s.aCard, JSON.stringify({
      sky: [{ username: 'stargirl', companion: 'quill', circle: true }], choseMe: []
    }));
    SocialSky.markExperienced(s.sExp);
    await Cheer.give(s.sChe);
    const fake = {
      ether: { width: 1000, height: 600 },
      seed: function (list) { this.seeded = list; },
      stories: { get: () => null },
    };
    const stories = await EtherFeed.attach(fake, { localOnly: true });
    const at = {};
    stories.forEach(function (st) {
      const pid = st.source && st.source.projectId;
      at[pid] = (typeof st.x === 'number')
        ? Math.hypot(st.x - 500, st.y - 300) : null;
    });
    return { count: stories.length, at };
  }, seeded);
  // Every seeded story must be present — Canon Stories ride along too
  // (the repository is no longer empty), which is exactly the point:
  // gravity filters NOTHING out of the shared world.
  ck([seeded.sNew, seeded.sOld, seeded.sExp, seeded.sChe, seeded.mine]
       .every((id) => id in gravity.at),
     'C4  THE ETHER IS STILL ONE SHARED WORLD — every story present, nothing filtered', gravity.count + ' stories');
  ck(gravity.at[seeded.sNew] !== null && gravity.at[seeded.sOld] !== null,
     'C4b a chosen Creator\'s fresh creations start nearer the child\'s path');
  ck(gravity.at[seeded.sNew] < gravity.at[seeded.sOld],
     'C4c FRESHNESS DECIDES WHICH FINDS ME FIRST — the newer one starts nearer',
     JSON.stringify({ fresh: Math.round(gravity.at[seeded.sNew] || -1), old: Math.round(gravity.at[seeded.sOld] || -1) }));
  ck(gravity.at[seeded.sExp] === null && gravity.at[seeded.sChe] === null,
     'C5  EXPERIENCED AND CHEERED NEVER COME FORWARD AGAIN — a Cheer means "already acknowledged"');
  ck(gravity.at[seeded.mine] === null,
     'C5b and my own story needs no gravity toward me');

  const travellerGravity = await page.evaluate(async () => {
    MagicCard.setActive(null);
    const fake = { ether: { width: 1000, height: 600 }, seed: function () {}, stories: { get: () => null } };
    const stories = await EtherFeed.attach(fake, { localOnly: true });
    const placed = stories.filter((st) => typeof st.x === 'number').length;
    return { placed };
  });
  ck(travellerGravity.placed === 0,
     'C6  A TRAVELLER\'S ETHER IS UNTOUCHED — no card, no sky, no gravity, the placement everybody always had');
  await page.evaluate((id) => MagicCard.setActive(id), seeded.aCard);

  // ---- the portal is what "experienced" means ----------------------
  {
    const src = fs.readFileSync(path.join(ROOT, 'js', 'vihuplanetHome.js'), 'utf8');
    ck(/openPortal\(\)\s*{[\s\S]{0,900}markExperienced/.test(src),
       'C7  STEPPING INTO A STORY IS WHAT "EXPERIENCED" MEANS — the portal stamps it, nothing else guesses');
  }

  // ===================================================================
  console.log('\nD. NO SOCIAL PRESSURE, ENFORCED');
  // ===================================================================
  const layer = ['js/socialSky.js', 'js/creationShow.js', 'js/creatorPresence.js']
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .map((s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')).join('\n');
  ck(!/\bfollow(er|ing)?s?\b|\bfriend\b|\bstreak\b|\brank(ing)?\b|\bscore\b|\bpopular/i.test(layer),
     'D1  NO FOLLOWER, FRIEND, STREAK, RANK, SCORE OR POPULARITY — the vocabulary does not exist in the layer');
  ck(!/notification centre|\bbadge\b|\bfeed\b/i.test(layer),
     'D2  and no badge, feed or notification-centre vocabulary either');
  ck(!/chat|message|reply|thread/i.test(
       layer.replace(/never a message|not messages|creations, not messages|never a message was/gi, '')),
     'D3  A GIFT IS A CREATION, NOT A MESSAGE — no chat, reply or thread anywhere in the layer');
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
  if (process.env.SKY_TEST_PG) return { conn: process.env.SKY_TEST_PG, own: false };
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
