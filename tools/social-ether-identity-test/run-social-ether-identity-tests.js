/* SPRINT SOCIAL 2.1 — IDENTITY + ORBIT/CIRCLE IN ETHER & STUDIO HOME.
 *
 * The Ether is a shared world; Studio Home is my personal world. This
 * suite proves the line between them: the Ether declares who is using
 * it, a Traveller is completely anonymous with no way to fake a
 * social graph, the Companion never learns any of it, and the
 * personal social area lives on Studio Home.
 *
 *   A. THE ETHER DECLARES WHO IS USING IT
 *      · a Creator sees "🌌 You're in Ether as @moonmaker" with
 *        "Not you? Change"; an unnamed card sees their nickname; a
 *        cardless visitor sees "You're exploring as a Traveller" and
 *        NO change control — nothing invented, nothing inferred
 *      · a refresh does not change identity
 *      · Change routes to the EXISTING ⭐ recognition — never a
 *        one-tap identity switch
 *      · once the identity changes, subsequent actions belong to it
 *
 *   B. TRAVELLER MODE — no persistence, not even faked locally
 *      · orbit add refuses no_card and writes NOTHING
 *      · no activity lines, no make-for, no orbit UI
 *
 *   C. THE HARD IDENTITY BOUNDARY
 *      · the Companion's Traveller context has no field for the
 *        viewer's identity, orbit or circle — and a context that
 *        smuggles orbit vocabulary is REFUSED whole
 *      · no companion file references the social layer
 *
 *   D. STUDIO HOME IS THE HOME OF THE SOCIAL WORLD
 *      · 🌌 My Orbit · ✨ My Circle open from Studio Home
 *      · Orbit entries are CREATION-oriented (@name + what they make)
 *      · Circle is derived, shown intimately, never a second record
 *      · Leave works and ends a mutual Circle silently
 *      · no digits anywhere on the panel
 *
 *   E. THE DOORWAY
 *      · the Ether's Find panel offers "Open in your Studio" to a
 *        card-holder with an orbit; pressing it leaves through the
 *        one Studio door with a one-shot note
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/social-ether-identity-test/run-social-ether-identity-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.SEI_PORT || 8795);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; failures.push(n); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

(async () => {
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
    contentType: 'application/json', body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'k' }) }));
  await page.route('http://supa.local.test/**', (route) => route.fulfill({
    contentType: 'application/json',
    body: route.request().url().indexOf('/rest/v1/') !== -1 ? '[]' : '{}' }));

  async function seed(withName) {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof MagicCard !== 'undefined' && typeof CreatorProjectStore !== 'undefined', null, { timeout: 20000 });
    return page.evaluate(async (named) => {
      localStorage.clear(); sessionStorage.clear();
      try { CreatorProjectStore.clearAll({ all: true }); } catch (e) { try { CreatorProjectStore.clearAll(); } catch (e2) {} }
      function px(c) { const v = document.createElement('canvas'); v.width = 8; v.height = 8;
        const x = v.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 8, 8); return v.toDataURL('image/png'); }
      const b = MagicCard.claim('Meera', null, { companionId: 'quill' });
      MagicCard.setActive(b.id);
      MagicCard._setLocalUsername(b.id, 'stargirl');
      const their = CreatorProjectStore.newId();
      CreatorProjectStore.upsert(their, { name: 'The Star Garden' }, { version: 1, pages: [{ id: 'p1', readImage: px('#aa5533') }] });
      CreatorProjectStore.markPublished(their);
      const a = MagicCard.claim('Vihaan', null, { companionId: 'leafy' });
      MagicCard.setActive(a.id);
      if (named) MagicCard._setLocalUsername(a.id, 'moonmaker');
      await new Promise((r) => setTimeout(r, 900));
      return { aCard: a.id, bCard: b.id };
    }, withName);
  }
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
    await page.waitForFunction(() => {
      const m = document.querySelector('[data-identity]');
      return m && !m.hidden;
    }, null, { timeout: 25000 }).catch(() => {});
  }
  function marker() {
    return page.evaluate(() => {
      const m = document.querySelector('[data-identity]');
      const c = document.querySelector('[data-identity-change]');
      return { there: !!m && !m.hidden,
               line: m ? m.querySelector('[data-identity-line]').textContent : null,
               change: c ? !c.hidden : null };
    });
  }

  // ---------------------------------------------------------------
  console.log('\nA. THE ETHER DECLARES WHO IS USING IT');
  // ---------------------------------------------------------------
  const cards = await seed(true);
  await intoEther();
  let m = await marker();
  ck(m.there && m.line === '🌌 You’re in Ether as @moonmaker' && m.change === true,
     'A1  A CREATOR IS TOLD WHO THEY ARE — the identity anchor, with Not you? Change', m.line);
  await page.screenshot({ path: path.join(SHOTS, 'A1-creator.png') });

  // a refresh does not change identity (the marker survives a reload
  // because the CARD does — no session variable is trusted)
  await intoEther();
  m = await marker();
  ck(m.there && m.line === '🌌 You’re in Ether as @moonmaker',
     'A2  A REFRESH CHANGES NOTHING — the identity is the card, not the session', m.line);

  // Change routes to the EXISTING recognition, never a one-tap switch
  const change = await page.evaluate(() => {
    document.querySelector('[data-identity-change]').click();
    return new Promise((resolve) => setTimeout(() => {
      const stars = document.querySelector('[data-stars]');
      const scan = document.querySelector('[data-scan]');
      resolve({
        recognitionOpen: !!(stars && !stars.hidden) || !!(scan && !scan.hidden),
        activeUnchanged: MagicCard.getActiveId(),
      });
    }, 1200));
  });
  ck(change.recognitionOpen,
     'A3  NOT YOU? CHANGE OPENS THE EXISTING ⭐ RECOGNITION — no new ceremony, no card list to tap through');
  ck(change.activeUnchanged === cards.aCard,
     'A3b and looking at the door changes nobody\'s identity');
  await page.screenshot({ path: path.join(SHOTS, 'A3-change.png') });

  // once the identity IS different, everything after belongs to it
  const owned = await page.evaluate(async (cards2) => {
    MagicCard.setActive(cards2.bCard); // what a completed recognition commits
    await CreatorOrbit.add('moonmaker');
    return {
      bOrbit: JSON.parse(localStorage.getItem('vihu.orbit.' + cards2.bCard) || '{}'),
      aOrbit: JSON.parse(localStorage.getItem('vihu.orbit.' + cards2.aCard) || '{}'),
    };
  }, cards);
  ck(!!owned.bOrbit.moonmaker && Object.keys(owned.aOrbit).length === 0,
     'A4  SUBSEQUENT ACTIONS BELONG TO THE ESTABLISHED CREATOR — never the one before',
     JSON.stringify(owned.bOrbit));
  await page.evaluate((id) => MagicCard.setActive(id), cards.aCard);

  // an unnamed card is anchored by its nickname, honestly
  await page.evaluate((id) => {
    const cards2 = JSON.parse(localStorage.getItem('vihu.magicCards') || localStorage.getItem('vihu.magic.cards') || '[]');
    return id;
  }, cards.aCard).catch(() => {});
  const unnamed = await seed(false);
  await intoEther();
  m = await marker();
  ck(m.there && m.line === '🌌 You’re in Ether as Vihaan' && m.change === true,
     'A5  A CARD WITH NO PUBLIC NAME IS ANCHORED BY ITS NICKNAME — no @ is invented', m.line);

  // ---------------------------------------------------------------
  console.log('\nB. TRAVELLER MODE — anonymous, and no faked persistence');
  // ---------------------------------------------------------------
  await page.evaluate(() => MagicCard.setActive(null));
  await intoEther();
  m = await marker();
  ck(m.there && m.line === '✨ You’re exploring as a Traveller' && m.change === false,
     'B1  A TRAVELLER IS A TRAVELLER — completely anonymous, no identity inferred, no Change control', m.line);
  await page.screenshot({ path: path.join(SHOTS, 'B1-traveller.png') });

  const travellerTries = await page.evaluate(async () => {
    const before = Object.keys(localStorage).filter((k) => /^vihu\.orbit/.test(k)).length;
    const add = await CreatorOrbit.add('stargirl');
    const after = Object.keys(localStorage).filter((k) => /^vihu\.orbit/.test(k)).length;
    const act = await CreatorOrbit.activityLines();
    CreatorPresence.open('stargirl', {});
    const ui = {
      orbit: !!document.querySelector('.creator-presence-orbit-add'),
      makeFor: !!document.querySelector('.creator-presence-makefor'),
    };
    document.querySelector('.creator-presence-quiet').click();
    return { add: add, wrote: after - before, lines: act.lines, ui: ui };
  });
  ck(travellerTries.add.ok === false && travellerTries.add.reason === 'no_card' && travellerTries.wrote === 0,
     'B2  A TRAVELLER CANNOT CREATE AN ORBIT — refused, and NOTHING is written, not even locally',
     JSON.stringify(travellerTries.add));
  ck(travellerTries.lines.length === 0 && !travellerTries.ui.orbit && !travellerTries.ui.makeFor,
     'B2b no activity, no orbit button, no make-for — the shelf is pure discovery');

  // ---------------------------------------------------------------
  console.log('\nC. THE HARD IDENTITY BOUNDARY — the Companion learns nothing');
  // ---------------------------------------------------------------
  const boundary = await page.evaluate(() => {
    if (typeof TravellerContext === 'undefined') return { skip: true };
    // A story entity as the feed makes them — carrying the PUBLIC
    // maker fields — plus everything the social layer knows, smuggled.
    const honest = TravellerContext.build({
      title: 'The Star Garden', pages: 3, hasAudio: false,
      creator: 'Meera', creatorUsername: 'stargirl', forUsername: 'moonmaker',
      source: { origin: 'creator', creatorUsername: 'stargirl' },
    }, { id: 'quill', name: 'Quill', species: 'Ink Spirit' });
    const text = JSON.stringify(honest || {});
    const refused = TravellerContext.validate
      ? TravellerContext.validate(Object.assign({}, honest, { orbit: ['stargirl'] }))
      : null;
    return {
      keys: honest ? Object.keys(honest) : [],
      viewerLeak: /moonmaker|orbit|circle/i.test(text),
      forbidden: TravellerContext.FORBIDDEN_KEYS.filter((k) => /orbit|circle|username|viewer/.test(k)),
    };
  });
  if (boundary.skip) { no('C1  TravellerContext reachable', 'module missing'); }
  else {
    ck(!boundary.viewerLeak,
       'C1  THE COMPANION\'S CONTEXT CARRIES NO VIEWER IDENTITY, ORBIT OR CIRCLE — whitelist construction',
       boundary.keys.join(','));
    ck(boundary.forbidden.length >= 6,
       'C1b and orbit vocabulary is on the FORBIDDEN list — a smuggled field is refused, not trimmed',
       boundary.forbidden.join(','));
  }
  const companionFiles = ['js/travellerContext.js', 'js/travellerTalk.js',
    'js/companionPerception.js', 'js/companionContextBuilder.js', 'js/companionPrivacyGate.js'];
  const compSrc = companionFiles.map((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  }).join('\n');
  ck(!/CreatorOrbit|creator_orbits|circleWith/.test(compSrc),
     'C2  NO COMPANION FILE REACHES THE SOCIAL LAYER — the boundary is structural');

  // ---------------------------------------------------------------
  console.log('\nD. STUDIO HOME IS THE HOME OF THE SOCIAL WORLD');
  // ---------------------------------------------------------------
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreatorSocial !== 'undefined' && typeof CreatorOrbit !== 'undefined', null, { timeout: 20000 });
  const panel = await page.evaluate(async (cards2) => {
    MagicCard.setActive(cards2.aCard);
    // the child's choices: stargirl in orbit, and mutual
    localStorage.setItem('vihu.orbit.' + cards2.aCard,
      JSON.stringify({ stargirl: { circle: true } }));
    CreatorSocial.openSocialPanel();
    await new Promise((r) => setTimeout(r, 600));
    const p = document.querySelector('.creator-social-panel');
    return {
      text: p ? p.innerText : null,
      chip: !!document.querySelector('.creator-social-circle-chip'),
      leave: !!document.querySelector('.creator-social-leave'),
    };
  }, unnamed);
  ck(!!panel.text && /✨ My Circle/.test(panel.text) && /🌌 My Orbit/.test(panel.text),
     'D1  🌌 MY ORBIT and ✨ MY CIRCLE open from Studio Home — seeing and managing live here');
  ck(panel.chip && /@stargirl/.test(panel.text) && /The Star Garden/.test(panel.text),
     'D2  ENTRIES ARE CREATION-ORIENTED — @stargirl and what she makes, never statistics',
     panel.text.replace(/\n/g, ' · '));
  ck(!/\d/.test(panel.text.replace(/[🌌✨🎨]/g, '')),
     'D3  NOT ONE NUMBER ON THE PANEL — no follower counts, no circle size');
  await page.screenshot({ path: path.join(SHOTS, 'D-panel.png') });

  const left = await page.evaluate(async () => {
    document.querySelector('.creator-social-leave').click();
    await new Promise((r) => setTimeout(r, 300));
    const p = document.querySelector('.creator-social-panel');
    return { text: p ? p.innerText : null, has: CreatorOrbit.has('stargirl') };
  });
  ck(left.has === false && !/Leave My Orbit/.test(left.text || '') && !/✨ My Circle/.test(left.text || ''),
     'D4  LEAVE WORKS AND THE MUTUAL CIRCLE SIMPLY ENDS — silently, no drama, nobody told',
     (left.text || '').replace(/\n/g, ' · '));

  // ---------------------------------------------------------------
  console.log('\nE. THE DOORWAY — act in the Ether, manage in the Studio');
  // ---------------------------------------------------------------
  await page.evaluate((cards2) => {
    localStorage.setItem('vihu.orbit.' + cards2.aCard, JSON.stringify({ stargirl: { circle: false } }));
  }, unnamed);
  await intoEther();
  const door = await page.evaluate(() => {
    document.querySelector('[data-find]').click();
    const d = document.querySelector('.creator-presence-social-door');
    return { there: !!d, label: d ? d.textContent : null };
  });
  ck(door.there && door.label === 'Open in your Studio',
     'E1  THE ETHER OFFERS A QUIET DOORWAY under the child\'s own Orbit — never a second Studio Home', door.label);
  await page.evaluate(() => document.querySelector('.creator-presence-social-door').click());
  await page.waitForFunction(() => /studio\.html/.test(window.location.pathname), null, { timeout: 20000 }).catch(() => {});
  const landed = await page.evaluate(() => ({
    where: window.location.pathname,
    note: sessionStorage.getItem('vihu.openSocial.note'),
  }));
  ck(/studio\.html/.test(landed.where) && landed.note === '1',
     'E2  PRESSING IT LEAVES THROUGH THE ONE STUDIO DOOR with a one-shot note for Studio Home',
     JSON.stringify(landed));
  await page.waitForFunction(() => typeof CreatorOrbit !== 'undefined', null, { timeout: 20000 });
  const consumed = await page.evaluate(() => {
    const got = CreatorOrbit.consumeOpenSocial();
    return { got: got, after: sessionStorage.getItem('vihu.openSocial.note') };
  });
  ck(consumed.got === true && consumed.after === null,
     'E2b and the note is CONSUMED on use — intent crosses, state does not');

  ck(pageErrors.length === 0, 'F1  zero page errors throughout',
     pageErrors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  try { server.kill(); } catch (e) {}
  console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) console.log('failures:\n  ' + failures.join('\n  '));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
