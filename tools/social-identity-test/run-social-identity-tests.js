/* SPRINT SOCIAL 1 — CREATOR IDENTITY & DISCOVERY.
 *
 * A username is identity for CREATIONS, never a directory of
 * children. So the questions are: is the name unique and owned, does
 * it travel with the card and the story, can a creation lead to its
 * maker's OTHER public creations — and can nothing private leak
 * through any of it.
 *
 *   A. THE DATABASE, EXECUTED  (supabase/migrations_social_identity.sql)
 *      · the migration applies, and applies twice
 *      · a Creator claims their name; it is stored lowercase
 *      · the SAME name in a different case is TAKEN — uniqueness is
 *        case-insensitive, proved by the real unique index
 *      · reserved names refused · invalid shapes refused (short,
 *        spaces, symbols, no letter)
 *      · A STRANGER CANNOT NAME SOMEBODY ELSE'S IDENTITY — as a real
 *        second session, and a stranger's id answers exactly like a
 *        nonexistent one
 *      · already named stays named (v1 names are stable)
 *      · recall_magic_card() returns the username, and every field
 *        earlier sprints added survived the redefinition
 *      · a snapshot-style update of other columns never touches it
 *      · the JS reserved list and the SQL reserved list are ONE list
 *      · supabase/verify_social_identity.sql answers all-PASS
 *
 *   B. THE RULES, IN THE BROWSER  (js/creatorHandle.js)
 *      · normalize strips @ and case; validate refuses what the
 *        server refuses; NOTHING is ever generated for the child
 *
 *   C. THE STUDIO  (js/creatorSocial.js · js/magicCard.js ·
 *      js/creatorProjectStore.js)
 *      · the invitation appears only when it is earned (card + a
 *        public creation + no name) — absent rather than empty
 *      · the dialog's wrong answers are the brief's own words, and
 *        the input is NEVER pre-filled or auto-generated
 *      · a claimed name lands on the card, the sweep stamps it onto
 *        already-shared stories (and ONLY own, ONLY shared ones),
 *        and every new save carries it
 *      · the activity line: new cheers → one line, no number, no
 *        cheerer, and quiet once seen
 *
 *   D. THE ETHER  (js/creatorPresence.js · js/etherFeed.js ·
 *      js/vihuplanetHome.js)
 *      · the Spirit's Preview shows @name; tapping it opens the
 *        maker's shelf of PUBLIC creations — the private one is
 *        absent by construction
 *      · 🔎 Find a Creator: exact name (any case) finds; unknown is
 *        told gently; nothing is listed unasked
 *      · ?creator= is a one-shot intent, consumed like ?story=
 *      · no email, card id, account id, or contact vocabulary
 *        anywhere in the new surfaces
 *
 *   E. THE SHARE  (supabase/functions/creation-share/index.ts ·
 *      js/creationShare.js · look.html · js/storyCardComposer.js)
 *      · the payload carries creatorUsername; the sweep admits a
 *        well-formed one and refuses a malformed one by name
 *      · the landing says "Made by @name" and offers "See more" as
 *        a ?creator= door — the share's ACCESS stays the token
 *      · the Story Card back carries @name
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/social-identity-test/run-social-identity-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SOCIAL_PORT || 8799);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');

// Declared beside the top for the same reason companion-memory-test
// records: section A reads these before anything else runs.
const PGDIR = '/tmp/vihu-social-identity-pg';
const PGPORT = 55439;

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
  console.log('\nA. THE DATABASE, EXECUTED  (supabase/migrations_social_identity.sql)');
  const pg = startPg();
  if (!pg) { sk('A1-A15  the whole database section', 'no PostgreSQL — install postgresql or set SOCIAL_TEST_PG'); return; }
  try {
    const fix = loadFile(pg, path.join(__dirname, 'fixture.sql'));
    if (fix) { no('A0  the fixture loads', fix.split('\n')[0]); return; }

    const m1 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_identity.sql'));
    const m2 = loadFile(pg, path.join(ROOT, 'supabase', 'migrations_social_identity.sql'));
    ck(!m1 && !m2, 'A0  the migration applies, and applies twice', m1 || m2 || 'safe to re-run');
    if (m1 || m2) return;

    psql(pg, `insert into public.magic_card_identities(id,owner_id,nickname,constellation,pattern)
              values ('card_a','${A_UID}','Vihaan','ORION','[[1,2],[3,4],[5,6]]'),
                     ('card_b','${B_UID}','Meera','LYRA','[[2,2],[4,4],[6,6]]');`);

    // ---- claiming a name ------------------------------------------
    const claim = (uid, id, name) => asSession(pg, uid,
      `select public.creator_username_claim('${id}','${name}');`);
    const j = (r) => { try { return JSON.parse(lines(r).find((l) => l.startsWith('{')) || '{}'); } catch (e) { return {}; } };

    // ---- validation, server-side, BEFORE anything is named --------
    // (an already-named identity answers already_named to everything,
    // so the shape checks must come while card_b is still nameless)
    let r = j(claim(B_UID, 'card_b', 'ab'));
    ck(r.ok === false && r.reason === 'invalid', 'A3  too short is invalid', JSON.stringify(r));
    r = j(claim(B_UID, 'card_b', 'moon maker'));
    ck(r.ok === false && r.reason === 'invalid', 'A3b a space is invalid', JSON.stringify(r));
    r = j(claim(B_UID, 'card_b', 'moon-maker!'));
    ck(r.ok === false && r.reason === 'invalid', 'A3c symbols are invalid', JSON.stringify(r));
    r = j(claim(B_UID, 'card_b', '12345'));
    ck(r.ok === false && r.reason === 'invalid', 'A3d a number alone is not a name', JSON.stringify(r));
    r = j(claim(B_UID, 'card_b', '@moonmaker'));
    ck(r.ok === false && r.reason === 'invalid',
       'A3e a raw @ is invalid AT THE SERVER — the client strips it, the server never guesses', JSON.stringify(r));
    r = j(claim(B_UID, 'card_b', 'lumo'));
    ck(r.ok === false && r.reason === 'reserved', 'A4  a platform name is reserved', JSON.stringify(r));

    r = j(claim(A_UID, 'card_a', ' MoonMaker '));
    ck(r.ok === true && r.username === 'moonmaker',
       'A1  a Creator claims their name — trimmed, stored lowercase', JSON.stringify(r));

    const stored = psql(pg, "select username from public.magic_card_identities where id='card_a';");
    ck(stored === 'moonmaker', 'A1b and the row holds exactly that', stored);

    // ---- THE ONE THAT MATTERS: global, case-insensitive ------------
    r = j(claim(B_UID, 'card_b', 'MOONMAKER'));
    ck(r.ok === false && r.reason === 'taken',
       'A2  THE SAME NAME IN ANY CASE IS TAKEN — the unique index, not a habit', JSON.stringify(r));

    // ---- ownership ------------------------------------------------
    const rB = j(claim(B_UID, 'card_a', 'stargirl'));
    const rGhost = j(claim(B_UID, 'card_ghost', 'stargirl'));
    ck(rB.ok === false && rB.reason === 'not_yours',
       'A5  A STRANGER CANNOT NAME SOMEBODY ELSE\'S IDENTITY', JSON.stringify(rB));
    ck(rGhost.ok === false && rGhost.reason === 'not_yours',
       'A5b and a stranger\'s id answers exactly like a nonexistent one — no oracle', JSON.stringify(rGhost));
    const aStill = psql(pg, "select username from public.magic_card_identities where id='card_a';");
    ck(aStill === 'moonmaker', 'A5c nothing moved', aStill);

    const noAuth = j(psql2(pg, ["begin;", "set local role anon;",
      "select public.creator_username_claim('card_a','anything1');", "commit;"].join('\n')));
    ck(noAuth.ok === false && noAuth.reason === 'not_authenticated',
       'A6  no session, no claim', JSON.stringify(noAuth));

    // ---- stable ---------------------------------------------------
    r = j(claim(A_UID, 'card_a', 'newname'));
    ck(r.ok === false && r.reason === 'already_named' && r.username === 'moonmaker',
       'A7  a named identity stays named — v1 names are stable', JSON.stringify(r));

    r = j(claim(B_UID, 'card_b', 'stargirl'));
    ck(r.ok === true && r.username === 'stargirl',
       'A8  a different name is free for a different Creator', JSON.stringify(r));

    // ---- the name travels with the card ---------------------------
    const recall = j(asSession(pg, B_UID,
      `select public.recall_magic_card('[[1,2],[3,4],[5,6]]'::jsonb, null);`));
    ck(recall.ok === true && recall.username === 'moonmaker',
       'A9  RECALL CARRIES THE NAME — a brand-new device is still @moonmaker', JSON.stringify({ ok: recall.ok, username: recall.username }));
    ck(recall.taught === null && 'taught' in recall && recall.companion_id === null && 'companion_id' in recall
       && recall.nickname === 'Vihaan' && Array.isArray(recall.pattern),
       'A9b and every field earlier sprints added survived the redefinition',
       Object.keys(recall).join(','));

    // ---- a snapshot upsert cannot lose it -------------------------
    // js/magicCard.js's _pushIdentitySnapshot updates only the columns
    // it names; username is not one of them, so an ordinary snapshot
    // must leave the name exactly where the claim put it.
    asSession(pg, A_UID,
      "update public.magic_card_identities set nickname='Vihaan R', last_active_at=now() where id='card_a';");
    const afterSnap = psql(pg, "select username from public.magic_card_identities where id='card_a';");
    ck(afterSnap === 'moonmaker', 'A10 a snapshot-style update never touches the name', afterSnap);

    // ---- ONE reserved list ----------------------------------------
    const sqlText = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations_social_identity.sql'), 'utf8');
    const jsText = fs.readFileSync(path.join(ROOT, 'js', 'creatorHandle.js'), 'utf8');
    const pull = (txt) => {
      const m = /RESERVED\s*=\s*\[([\s\S]*?)\]/.exec(txt) || /array\s*\[([\s\S]*?)\]/i.exec(txt);
      return (m ? m[1] : '').match(/'([a-z0-9_]+)'/g) || [];
    };
    const jsList = pull(jsText).map((s) => s.replace(/'/g, '')).sort();
    const sqlList = pull(sqlText).map((s) => s.replace(/'/g, '')).sort();
    ck(jsList.length > 20 && JSON.stringify(jsList) === JSON.stringify(sqlList),
       'A11 THE JS AND SQL RESERVED LISTS ARE ONE LIST — they cannot drift',
       jsList.length + ' names in both');

    // ---- the verifier ---------------------------------------------
    const verdict = psqlOut(pg, path.join(ROOT, 'supabase', 'verify_social_identity.sql'));
    ck(/all checks pass/.test(verdict) && !/FAIL/.test(verdict),
       'A12 supabase/verify_social_identity.sql answers all-PASS',
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

  // The platform, stubbed quiet — no Supabase in this environment.
  await page.route('**/supabase-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'anon.key' }),
  }));
  await page.route('http://supa.local.test/**', (route) => route.fulfill({
    contentType: 'application/json', body: route.request().url().indexOf('/rest/v1/') !== -1 ? '[]' : '{}',
  }));

  // ---------------------------------------------------------------
  console.log('\nB. THE RULES, IN THE BROWSER  (js/creatorHandle.js)');
  // ---------------------------------------------------------------
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreatorHandle !== 'undefined' &&
    typeof MagicCard !== 'undefined' && typeof CreatorSocial !== 'undefined' &&
    typeof CreatorProjectStore !== 'undefined', null, { timeout: 20000 });

  const rules = await page.evaluate(() => ({
    strip: CreatorHandle.validate(' @MoonMaker '),
    short: CreatorHandle.validate('ab'),
    space: CreatorHandle.validate('moon maker'),
    symbol: CreatorHandle.validate('moon-maker'),
    digits: CreatorHandle.validate('12345'),
    long: CreatorHandle.validate('a'.repeat(21)),
    reserved: CreatorHandle.validate('Lumo'),
    display: CreatorHandle.display('MoonMaker'),
    same: CreatorHandle.same('@MoonMaker', 'moonmaker'),
  }));
  ck(rules.strip.ok === true && rules.strip.username === 'moonmaker',
     'B1  @ and case are cosmetic — the name underneath is the name');
  ck(!rules.short.ok && !rules.space.ok && !rules.symbol.ok && !rules.digits.ok && !rules.long.ok
     && [rules.short, rules.space, rules.symbol, rules.digits, rules.long].every((x) => x.reason === 'invalid'),
     'B2  short, spaces, symbols, digits-only and over-long are all invalid');
  ck(rules.reserved.reason === 'reserved' && rules.display === '@moonmaker' && rules.same === true,
     'B3  reserved is its own answer; display and same() agree about case');

  // NOTHING IS EVER GENERATED. The brief's own line: never
  // moonmaker8472. No name-generation exists anywhere in the layer.
  const genSrc = ['js/creatorHandle.js', 'js/creatorSocial.js']
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .map((s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')).join('\n');
  ck(!/Math\.random|Date\.now\(\)\s*%|suggest/i.test(genSrc),
     'B4  NO NAME IS EVER GENERATED FOR A CHILD — nothing random, nothing suggested');

  // ---------------------------------------------------------------
  console.log('\nC. THE STUDIO  (invitation · dialog · stamping · activity)');
  // ---------------------------------------------------------------
  const seeded = await page.evaluate(() => {
    localStorage.clear(); sessionStorage.clear();
    try { CreatorProjectStore.clearAll({ all: true }); } catch (e) { try { CreatorProjectStore.clearAll(); } catch (e2) {} }
    const c = MagicCard.claim('Vihaan', null,
      { companionId: 'leafy', companionName: 'Leafy', companionSpecies: 'Bloomling' });
    MagicCard.setActive(c.id);
    return { cardId: c.id, needBefore: CreatorSocial.inviteNeeded() };
  });
  ck(seeded.needBefore === false,
     'C1  no public creation yet → no invitation (absent rather than empty)');

  const withStory = await page.evaluate(() => {
    const shared = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(shared, { name: 'The Moon Dragon' }, { version: 1, pages: [{ id: 'p1' }] });
    CreatorProjectStore.markPublished(shared);
    const priv = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(priv, { name: 'Secret Draft' }, { version: 1, pages: [{ id: 'p1' }] });
    return { shared: shared, priv: priv, need: CreatorSocial.inviteNeeded() };
  });
  ck(withStory.need === true,
     'C2  a card, a shared story and no name → the invitation is earned');

  // ---- the dialog, with the platform answering each way -----------
  async function dialogSays(typed, rpcAnswer) {
    return page.evaluate(async (args) => {
      const orig = MagicCard.claimUsername;
      if (args.rpc) MagicCard.claimUsername = () => Promise.resolve(args.rpc);
      try {
        return await new Promise((resolve) => {
          CreatorSocial.openNameDialog(() => {});
          const overlay = document.querySelector('.creator-name-overlay');
          const input = overlay.querySelector('.creator-name-input');
          const empty = input.value === '';
          input.value = args.typed;
          overlay.querySelector('.creator-name-go').click();
          setTimeout(() => {
            const note = overlay.querySelector('.creator-name-note').textContent;
            overlay.querySelector('.creator-name-quiet') && overlay.remove();
            resolve({ note: note, emptyStart: empty, stillTyped: input.value });
          }, 120);
        });
      } finally { MagicCard.claimUsername = orig; }
    }, { typed: typed, rpc: rpcAnswer });
  }

  let d = await dialogSays('moon maker', null);
  ck(/Names use 3 to 20 letters, numbers or _/.test(d.note) && d.emptyStart,
     'C3  an invalid name is told kindly, and the field started EMPTY — never pre-filled', d.note);
  ck(d.stillTyped === 'moon maker',
     'C3b and the child\'s own words are left alone — nothing is generated in their place');
  d = await dialogSays('lumo', null);
  ck(/That name belongs to VihuPlanet\. Try another one\./.test(d.note),
     'C4  a reserved name, in the product\'s words', d.note);
  d = await dialogSays('moonmaker', { ok: false, reason: 'taken' });
  ck(/That name is already being used\. Try another one\./.test(d.note),
     'C5  TAKEN is the brief\'s own sentence, word for word', d.note);
  d = await dialogSays('moonmaker', { ok: false, reason: 'not_configured' });
  ck(/Names can’t be chosen just now\. Your stories are safe/.test(d.note),
     'C6  a platform that is away never blames and never breaks', d.note);

  // ---- a real claim lands everywhere ------------------------------
  const claimed = await page.evaluate(async (cardId) => {
    const orig = MagicCard.claimUsername;
    MagicCard.claimUsername = (raw) => {
      const checked = CreatorHandle.validate(raw);
      if (!checked.ok) return Promise.resolve(checked);
      MagicCard._setLocalUsername(cardId, checked.username);
      return Promise.resolve({ ok: true, username: checked.username });
    };
    try {
      const res = await MagicCard.claimUsername('MoonMaker');
      CreatorProjectStore.list(); // the sweep rides the next read
      const card = MagicCard.getActive();
      return { res: res, cardName: card.username, social: CreatorSocial.username(),
               need: CreatorSocial.inviteNeeded() };
    } finally { MagicCard.claimUsername = orig; }
  }, seeded.cardId);
  ck(claimed.res.ok && claimed.cardName === 'moonmaker' && claimed.social === 'moonmaker',
     'C7  the claimed name lands on the card', JSON.stringify(claimed.res));
  ck(claimed.need === false, 'C7b and the invitation stands down — the question is answered');

  const stamped = await page.evaluate((ids) => {
    const shared = CreatorProjectStore.get(ids.shared);
    const priv = CreatorProjectStore.get(ids.priv);
    const fresh = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(fresh, { name: 'Made After Naming' }, { version: 1, pages: [] });
    return { shared: shared.creatorUsername, priv: priv.creatorUsername,
             fresh: CreatorProjectStore.get(fresh).creatorUsername };
  }, withStory);
  ck(stamped.shared === 'moonmaker',
     'C8  THE SWEEP STAMPS THE NAME ONTO ALREADY-SHARED STORIES', stamped.shared);
  ck(stamped.priv == null,
     'C8b and NEVER onto a private draft — attribution is for public creations');
  ck(stamped.fresh === 'moonmaker',
     'C8c every save after naming carries it, the creatorName pattern exactly');

  // ---- the activity line ------------------------------------------
  const activity = await page.evaluate(async (ids) => {
    // Cheer is a top-level const — mutated IN PLACE (Decision 40's
    // recorded trap: swapping window.Cheer is invisible to the code).
    const counts = {};
    Cheer.refresh = () => Promise.resolve(true);
    Cheer.count = (id) => counts[id] || 0;

    const first = await CreatorSocial.activityLines();      // nothing yet
    counts[ids.shared] = 3;
    const risen = await CreatorSocial.activityLines();      // new starlight
    risen.markSeen();
    const seen = await CreatorSocial.activityLines();       // already seen
    counts[ids.shared] = 5;
    const again = await CreatorSocial.activityLines();      // more arrived
    return { first: first.lines, risen: risen.lines, seen: seen.lines, again: again.lines };
  }, withStory);
  ck(activity.first.length === 0, 'C9  no cheers, no line — never an empty state narrated');
  ck(activity.risen.length === 1 && activity.risen[0] === '✨ Your The Moon Dragon is getting cheers!',
     'C10 NEW STARLIGHT IS ONE WARM LINE ABOUT THE CREATION', activity.risen[0]);
  ck(!/\d/.test(activity.risen[0]) && !/by |from /.test(activity.risen[0]),
     'C10b and it carries NO NUMBER and NO CHEERER — Decision 20 held, nobody named');
  ck(activity.seen.length === 0, 'C11 once seen, quiet', 'markSeen spent it');
  ck(activity.again.length === 1, 'C11b until more starlight actually arrives');

  await page.screenshot({ path: path.join(SHOTS, 'C-studio.png') });

  // ---------------------------------------------------------------
  console.log('\nD. THE ETHER  (the shelf · Find a Creator · ?creator=)');
  // ---------------------------------------------------------------
  // A second Creator on the same device (the Decision 19 shape), so
  // find has more than one name to be exact about. Give every shared
  // story a readable cover.
  await page.evaluate((ids) => {
    function px(color) {
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 8, 8);
      return c.toDataURL('image/png');
    }
    const RED = px('#c0272d');
    [ids.shared].forEach((id) => {
      const r = CreatorProjectStore.get(id);
      r.data.pages.forEach((p) => { p.readImage = RED; });
      r.thumbnail = RED;
      CreatorProjectCache.putLocal(r);
    });
    const second = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(second, { name: 'The Quiet Comet' }, { version: 1, pages: [{ id: 'p1', readImage: RED }] });
    CreatorProjectStore.markPublished(second);

    const b = MagicCard.claim('Meera', null, { companionId: 'quill', companionName: 'Quill', companionSpecies: 'Ink Spirit' });
    MagicCard.setActive(b.id);
    MagicCard._setLocalUsername(b.id, 'stargirl');
    const other = CreatorProjectStore.newId();
    CreatorProjectStore.upsert(other, { name: 'The Star Garden' }, { version: 1, pages: [{ id: 'p1', readImage: RED }] });
    CreatorProjectStore.markPublished(other);
    MagicCard.setActive(null); // into the Ether as a Traveller
  }, withStory);

  await page.goto(BASE + '/index.html?story=' + encodeURIComponent(withStory.shared));
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
  let reached = true;
  await page.waitForFunction((want) => {
    const p = document.querySelector('[data-preview]');
    const t = (document.querySelector('[data-preview-title]') || {}).textContent || '';
    if (p && !p.hidden && t === want) return true;
    const all = Array.prototype.slice.call(document.querySelectorAll('.vp-story'));
    if (all.length) {
      window.__vpTap = ((window.__vpTap || 0) + 1) % all.length;
      all[window.__vpTap].click();
    }
    return false;
  }, 'The Moon Dragon', { timeout: 45000, polling: 800 }).catch(() => { reached = false; });
  if (!reached) no('D0  the seeded Story\'s own Preview opened', 'every check below would be about a different Story');

  const chip = await page.evaluate(() => {
    const h = document.querySelector('[data-preview-handle]');
    return { there: !!h, hidden: h ? h.hidden : null, text: h ? h.textContent : null };
  });
  ck(chip.there && chip.hidden === false && chip.text === '@moonmaker',
     'D1  THE PREVIEW SAYS WHO MADE IT — @moonmaker, tappable', JSON.stringify(chip));

  // ---- the shelf: public only -------------------------------------
  await page.evaluate(() => document.querySelector('[data-preview-handle]').click());
  await page.waitForFunction(() => {
    const o = document.querySelector('.creator-presence');
    return o && !o.hidden;
  }, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, 'D-shelf.png') });
  const shelf = await page.evaluate(() => ({
    title: document.querySelector('.creator-presence-title').textContent,
    rows: Array.from(document.querySelectorAll('.creator-presence-name')).map((r) => r.textContent),
    text: document.querySelector('.creator-presence-panel').innerText,
  }));
  ck(shelf.title === '@moonmaker' && shelf.rows.indexOf('The Moon Dragon') !== -1
     && shelf.rows.indexOf('The Quiet Comet') !== -1,
     'D2  the shelf holds the maker\'s SHARED creations', shelf.rows.join(' · '));
  ck(shelf.rows.indexOf('Secret Draft') === -1 && shelf.rows.indexOf('Made After Naming') === -1
     && shelf.rows.indexOf('The Star Garden') === -1,
     'D3  A PRIVATE DRAFT CANNOT APPEAR — it never entered the feed; nor can anybody else\'s work');

  // ---- privacy: what the surface says -----------------------------
  const privacy = await page.evaluate((cardId) => {
    const text = document.querySelector('.creator-presence-panel').innerText;
    return { hasCard: text.indexOf(cardId) !== -1, hasAt: /@[\w.]+@|\bemail\b|example\.com/i.test(text),
             contact: /\b(follow|friend|message|chat|contact|DM)\b/i.test(text), text: text };
  }, seeded.cardId);
  ck(!privacy.hasCard && !privacy.hasAt,
     'D4  NO CARD ID, NO EMAIL, NO ACCOUNT ID anywhere on the shelf');
  ck(!privacy.contact,
     'D4b and NO CONTACT OF ANY KIND — no follow, friend, message, chat or DM', privacy.text.replace(/\n/g, ' · '));

  // ---- meeting a story from the shelf -----------------------------
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.creator-presence-row'))
      .find((r) => /The Quiet Comet/.test(r.textContent)).click();
  });
  const met = await page.waitForFunction(() => {
    const t = (document.querySelector('[data-preview-title]') || {}).textContent || '';
    const p = document.querySelector('[data-preview]');
    return (p && !p.hidden && t === 'The Quiet Comet') ? t : false;
  }, null, { timeout: 15000 }).then(() => true).catch(() => false);
  ck(met, 'D5  a shelf row MEETS the story — the universe was never torn down');

  // ---- 🔎 Find a Creator ------------------------------------------
  const findBtn = await page.evaluate(() => {
    const b = document.querySelector('[data-find]');
    return { there: !!b, hidden: b ? b.hidden : null, label: b ? b.textContent.trim() : '' };
  });
  ck(findBtn.there && findBtn.hidden === false && /Find a Creator/.test(findBtn.label),
     'D6  🔎 Find a Creator stands as a quiet corner affordance — the two permanent actions untouched', findBtn.label);

  await page.evaluate(() => {
    const back = document.querySelector('[data-preview] [data-act="back"]');
    if (back) back.click();
    document.querySelector('[data-find]').click();
  });
  await page.waitForFunction(() => {
    const o = document.querySelector('.creator-presence');
    return o && !o.hidden && /Find a Creator/.test(document.querySelector('.creator-presence-title').textContent);
  }, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(SHOTS, 'D-find.png') });

  const unknown = await page.evaluate(() => {
    document.querySelector('.creator-presence-input').value = 'nobodyatall';
    document.querySelector('.creator-presence-go').click();
    return document.querySelector('.creator-presence-note').textContent;
  });
  ck(unknown === 'No Creator by that name is in the Ether yet.',
     'D7  an unknown name is told gently — never "not found", never an error', unknown);

  const found = await page.evaluate(() => {
    document.querySelector('.creator-presence-input').value = ' @StarGirl ';
    document.querySelector('.creator-presence-go').click();
    return {
      title: document.querySelector('.creator-presence-title').textContent,
      rows: Array.from(document.querySelectorAll('.creator-presence-name')).map((r) => r.textContent),
    };
  });
  ck(found.title === '@stargirl' && found.rows.length === 1 && found.rows[0] === 'The Star Garden',
     'D8  EXACT NAME, ANY CASE, FINDS THE SHELF — and only theirs', JSON.stringify(found));

  // ---- ?creator= is a one-shot intent -----------------------------
  await page.goto(BASE + '/index.html?creator=moonmaker');
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
  const intent = await page.waitForFunction(() => {
    const o = document.querySelector('.creator-presence');
    if (!(o && !o.hidden)) return false;
    return { title: document.querySelector('.creator-presence-title').textContent,
             url: window.location.search };
  }, null, { timeout: 30000 }).then((h) => h.jsonValue()).catch(() => null);
  ck(!!intent && intent.title === '@moonmaker',
     'D9  ?creator= OPENS THE SHELF once the child is looking — the landing\'s "See more" door works',
     intent && intent.title);
  ck(!!intent && intent.url.indexOf('creator=') === -1,
     'D9b and the parameter is CONSUMED — intent may cross; state may not (Decision 23)',
     intent && intent.url);

  // ---------------------------------------------------------------
  console.log('\nE. THE SHARE  (sweep · landing · Story Card)');
  // ---------------------------------------------------------------
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const FN = path.join(ROOT, 'supabase', 'functions', 'creation-share', 'index.ts');
  const tmp = path.join(os.tmpdir(), 'vihu-social-share-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);

  const base = { v: 1, type: 'moment', title: 'The Moon Dragon', creatorName: 'Vihaan',
    pages: [{ image: 'data:image/png;base64,AAA=' }], watch: [], madeIn: 'vihuplanet' };
  let sw = M.sweepPayload(Object.assign({}, base, { creatorUsername: 'moonmaker' }));
  ck(sw.ok === true && sw.clean.creatorUsername === 'moonmaker',
     'E1  a well-formed creatorUsername survives the sweep');
  sw = M.sweepPayload(Object.assign({}, base, { creatorUsername: 'Bad Name!' }));
  ck(sw.ok === false && sw.key === 'creatorUsername',
     'E2  a malformed one is refused BY NAME — the deploy-window retry can strip exactly it');
  sw = M.sweepPayload(base);
  ck(sw.ok === true && !('creatorUsername' in sw.clean),
     'E3  a share with no name carries no name — absent, not empty');
  ck(M.BUILD === 'LW4', 'E4  the function declares BUILD LW4 — the deploy runbook can tell fresh from stale', M.BUILD);

  // ---- the snapshot carries it ------------------------------------
  const snap = await (async () => {
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p2.route('**/supabase-config.json', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'k' }) }));
    await p2.route('http://supa.local.test/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await p2.goto(BASE + '/studio.html?author=on');
    await p2.waitForFunction(() => typeof CreationShare !== 'undefined', null, { timeout: 20000 });
    const out = await p2.evaluate(async () => {
      const rec = { id: 'proj_snap', name: 'The Moon Dragon', creatorName: 'Vihaan',
        creatorUsername: 'moonmaker', publishedAt: new Date().toISOString(),
        data: { pages: [{ id: 'p1', image: 'x' }] } };
      const share = CreationShare.fromRecord(rec);
      const payload = await CreationShare.snapshot(rec, [{ id: 'p1', image: null,
        metadata: { stickers: [{ id: 's1' }] }, storyBeat: 'Once' }], { watch: false });
      const bare = await CreationShare.snapshot({ id: 'p', name: 'X', data: { pages: [] } }, [], { watch: false });
      return { fromRecord: share.creatorUsername, payload: payload.creatorUsername,
               bare: 'creatorUsername' in bare };
    });
    await p2.close();
    return out;
  })();
  ck(snap.fromRecord === 'moonmaker' && snap.payload === 'moonmaker',
     'E5  the contract and the payload both carry the maker\'s public name');
  ck(snap.bare === false, 'E5b and a nameless record sends nothing');

  // ---- the landing ------------------------------------------------
  const p3 = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await p3.route('**/supabase-config.json', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'k' }) }));
  await p3.route('http://supa.local.test/**', (route) => {
    const u = route.request().url();
    if (u.indexOf('creation_share_resolve') !== -1) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        ok: true, creation: { v: 1, type: 'story', title: 'The Moon Dragon', creatorName: 'Vihaan',
          creatorUsername: 'moonmaker',
          pages: [{ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGFtFEIAKDvAx/tGYD4AAAAAElFTkSuQmCC' }],
          watch: [], madeIn: 'vihuplanet' } }) });
    }
    return route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await p3.goto(BASE + '/look.html?t=tok123abc456def789');
  await p3.waitForFunction(() => {
    const m = document.getElementById('madeBy');
    return m && !m.classList.contains('hidden');
  }, null, { timeout: 20000 }).catch(() => {});
  const landing = await p3.evaluate(() => {
    const m = document.getElementById('madeBy');
    const s = document.getElementById('seeMore');
    return { made: m ? m.textContent : null, madeShown: m && !m.classList.contains('hidden'),
             see: s ? s.textContent : null, seeShown: s && !s.classList.contains('hidden'),
             href: s ? s.getAttribute('href') : null };
  });
  ck(landing.madeShown && landing.made === 'Made by @moonmaker',
     'E6  THE LANDING SAYS WHO MADE IT — Made by @moonmaker', landing.made);
  ck(landing.seeShown && landing.see === 'See more from @moonmaker'
     && landing.href === './?creator=moonmaker',
     'E7  and "See more" is the ?creator= door into VihuPlanet', landing.href);
  ck(landing.href.indexOf('t=') === -1,
     'E7b THE DOOR IS NEVER THE KEY — the username routes to a public shelf, the token stays the only access');
  await p3.screenshot({ path: path.join(SHOTS, 'E-landing.png') });
  await p3.close();

  // ---- the Story Card ---------------------------------------------
  const card = await (async () => {
    const p4 = await browser.newPage();
    await p4.addInitScript(() => {
      window.__texts = [];
      const orig = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t) {
        window.__texts.push(String(t)); return orig.apply(this, arguments);
      };
    });
    await p4.route('**/supabase-config.json', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'k' }) }));
    await p4.route('http://supa.local.test/**', (route) => route.fulfill({ contentType: 'application/json', body: '[]' }));
    await p4.goto(BASE + '/studio.html?author=on');
    await p4.waitForFunction(() => typeof StoryCardComposer !== 'undefined', null, { timeout: 20000 });
    const out = await p4.evaluate(async () => {
      const withName = await StoryCardComposer.compose(
        { type: 'moment', title: 'The Moon Dragon', creatorName: 'Vihaan', creatorUsername: 'moonmaker', pages: [] },
        'https://vihuplanet.com/look.html?t=tok123');
      const withTexts = window.__texts.slice();
      window.__texts.length = 0;
      const without = await StoryCardComposer.compose(
        { type: 'moment', title: 'The Moon Dragon', creatorName: 'Vihaan', pages: [] },
        'https://vihuplanet.com/look.html?t=tok123');
      return { okA: withName.ok, okB: without.ok, withTexts: withTexts, withoutTexts: window.__texts.slice() };
    });
    await p4.close();
    return out;
  })();
  ck(card.okA && card.withTexts.indexOf('@moonmaker') !== -1,
     'E8  THE STORY CARD BACK CARRIES @moonmaker');
  ck(card.okB && card.withoutTexts.indexOf('@moonmaker') === -1
     && !card.withoutTexts.some((t) => /^@/.test(t)),
     'E8b and a nameless maker\'s card carries no @ line at all — never a placeholder');

  // ---------------------------------------------------------------
  console.log('\nF. NOTHING PRIVATE, NOTHING SOCIAL-NETWORK');
  // ---------------------------------------------------------------
  const newSrc = ['js/creatorHandle.js', 'js/creatorSocial.js', 'js/creatorPresence.js']
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const code = newSrc.map((s) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')).join('\n');
  ck(!/\bfollow(er)?s?\b|\bfriend\b|\bmessage\b|\bDM\b|\bchat\b|\binbox\b/i.test(code),
     'F1  NO SOCIAL NETWORK IN THE LAYER — no follow, friend, message, chat, DM, inbox');
  ck(!/owner_id|auth\.uid|access_token|@.*\.com/.test(code),
     'F2  no account id, session token or address is ever touched by the discovery layer');
  ck(!/\bemail\b/i.test(code),
     'F2b not even the word');
  const feedSrc = fs.readFileSync(path.join(ROOT, 'js', 'etherFeed.js'), 'utf8');
  ck(/byUsername/.test(feedSrc) && !/creator_username_search|rpc\(\s*'creator_username/.test(feedSrc),
     'F3  DISCOVERY HAS NO SERVER ENDPOINT — the shelf filters the feed the Ether already shows, so there is nothing to enumerate');

  ck(pageErrors.length === 0, 'F4  zero page errors throughout',
     pageErrors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  try { server.kill(); } catch (e) {}

  console.log('\n' + (failed ? 'FAILED' : (skipped ? 'PASSED (incomplete)' : 'PASSED')) +
    ' — ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// ===================================================================
// A throwaway PostgreSQL — the companion-memory-test shape, root-
// wrapped on both start and stop.
// ===================================================================
function sh(cmd) { return cp.execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }

function startPg() {
  if (process.env.SOCIAL_TEST_PG) return { conn: process.env.SOCIAL_TEST_PG, own: false };
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

// A block that runs as somebody's BROWSER SESSION: the `anon` role
// with an auth.uid() that is theirs.
function asSession(pg, uid, sql) {
  return psql2(pg, ['begin;', 'set local role anon;',
    `set local "test.uid" = '${uid}';`, sql, 'commit;'].join('\n'));
}
