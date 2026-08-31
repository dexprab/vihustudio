/*
 * LOOK WHAT I MADE — the sprint's end-to-end suite.
 *
 * Two halves, one file:
 *
 *   PART 1 (no browser) drives the DEPLOYED creation-share Edge
 *   Function artifact — supabase/functions/creation-share/index.ts,
 *   imported directly with injected env/fetch, the companion-chat
 *   idiom — through real Request objects: authorization, the payload
 *   sweep, minting, the letter, recipients, the cover image, rate
 *   limiting, and the privacy contract (nothing private in any
 *   answer or any letter).
 *
 *   PART 2 (Playwright) drives the real Studio: the third story
 *   action waking, the hub's four doors, the child-language sweep,
 *   preview-before-print for the foldable AND the card, the QR on
 *   the printed card DECODED BY A REAL DECODER (the vendored zxing —
 *   the test scans the card the way a phone would, so "scan works
 *   without knowing the project" is measured, not asserted), the
 *   fold model re-derived independently of the composer's table, and
 *   look.html resolving a token into the exact creation — read,
 *   watch, and refused-unknown — with the landing page's whole
 *   network activity measured.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/look-share-test/run-look-share-tests.js
 * (it starts its own static server on an unshared port)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SHOTS = path.join(__dirname, 'shots');
const PORT = 8797;
const BASE = 'http://127.0.0.1:' + PORT;

let passed = 0, failed = 0;
function ck(cond, name, detail) {
  if (cond) { passed++; console.log('  ok      ' + name); }
  else { failed++; console.log('  FAILED  ' + name + (detail ? '  — ' + detail : '')); }
}

/* A tiny real JPEG (1×1, white) so image fields are honest data URIs
 * that also survive atob() in the cover route. */
const JPEG_1PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==';
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function goodPayload(over) {
  return Object.assign({
    v: 1,
    type: 'moment',
    title: 'The Moon Dragon',
    creatorName: 'Sam',
    pages: [{ image: JPEG_1PX }],
    watch: [{ image: JPEG_1PX, holdMs: 900 }],
    madeIn: 'vihuplanet',
  }, over || {});
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });

  /* ============================================================
   * PART 1 — the deployed Edge Function artifact
   * ============================================================ */
  console.log('\nPART 1 — creation-share, the deployed artifact\n');

  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const FN = path.join(ROOT, 'supabase', 'functions', 'creation-share', 'index.ts');
  const tmp = path.join(os.tmpdir(), 'vihu-creation-share-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  const M = await import('file://' + tmp);

  const USER_TOKEN = 'look.suite.session.token';
  const OTHER_TOKEN = 'look.suite.other.token';
  const ENV = {
    SUPABASE_URL: 'http://supa.local',
    SUPABASE_ANON_KEY: 'anon.key.value',
    SUPABASE_SERVICE_ROLE_KEY: 'service.key.value',
    RESEND_API_KEY: 're_test_key',
    SKY_FROM_EMAIL: 'Lumo from VihuPlanet <lumo@vihuplanet.com>',
    SKY_BASE_URL: 'https://vihuplanet.com',
  };
  function envFrom(over) {
    const table = Object.assign({}, ENV, over || {});
    return (n) => table[n] || '';
  }

  const CARDS = {
    'card-1': { id: 'card-1', owner_id: 'user-1', nickname: 'Sam', parent_email: 'mum@example.com' },
    'card-2': { id: 'card-2', owner_id: 'user-2', nickname: 'Other', parent_email: 'their@example.com' },
    'card-3': { id: 'card-3', owner_id: 'user-1', nickname: 'Sam', parent_email: null },
  };

  const netLog = { mints: [], patches: [], letters: [], limitHits: [] };
  function resetNet() { netLog.mints.length = 0; netLog.patches.length = 0; netLog.letters.length = 0; netLog.limitHits.length = 0; }

  const fetchStub = async (url, opts) => {
    const u = String(url);
    const o = opts || {};
    const body = o.body ? JSON.parse(o.body) : null;
    const jr = (data, status) => new Response(JSON.stringify(data), {
      status: status || 200, headers: { 'Content-Type': 'application/json' } });

    if (u.indexOf('/auth/v1/user') !== -1) {
      const auth = (o.headers && (o.headers.Authorization || o.headers.authorization)) || '';
      if (auth === 'Bearer ' + USER_TOKEN) return jr({ id: 'user-1' });
      if (auth === 'Bearer ' + OTHER_TOKEN) return jr({ id: 'user-2' });
      return jr({}, 401);
    }
    if (u.indexOf('/rest/v1/rpc/edge_rate_limit_hit') !== -1) {
      netLog.limitHits.push(body);
      if (body && body.p_limit === 0) return jr({ allowed: false, remaining: 0, retry_after: 120 });
      return jr({ allowed: true, remaining: 5, retry_after: 0 });
    }
    if (u.indexOf('/rest/v1/rpc/creation_share_mint') !== -1) {
      netLog.mints.push(body);
      return jr('tokabc123def456ghi789jkl');
    }
    if (u.indexOf('/rest/v1/rpc/creation_share_resolve') !== -1) {
      if (body && body.p_token === 'tokabc123def456ghi789jkl') {
        return jr({ ok: true, creation: goodPayload() });
      }
      return jr({ ok: false, reason: 'unknown' });
    }
    if (u.indexOf('/rest/v1/magic_card_identities') !== -1) {
      if ((o.method || 'GET') === 'PATCH') { netLog.patches.push({ url: u, body: body }); return new Response('', { status: 204 }); }
      const m = /id=eq\.([^&]+)/.exec(u);
      const row = m ? CARDS[decodeURIComponent(m[1])] : null;
      return jr(row ? [row] : []);
    }
    if (u.indexOf('/rest/v1/magic_card_recalls') !== -1) return jr([]);
    if (u.indexOf('/rest/v1/creation_shares') !== -1) return jr([]);
    if (u.indexOf('api.resend.com/emails') !== -1) { netLog.letters.push(body); return jr({ id: 'em_1' }); }
    return jr({ error: 'unexpected ' + u }, 500);
  };

  function handlerWith(envOver) {
    return M.makeHandler({ env: envFrom(envOver), fetchImpl: fetchStub });
  }
  function post(handler, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return handler(new Request('http://local/creation-share', { method: 'POST', headers: headers, body: JSON.stringify(body) }));
  }
  async function asJson(res) { return { status: res.status, body: await res.json() }; }

  const H = handlerWith();

  // ---- A. the gate holds
  console.log('-- A: authorization');
  let r = await asJson(await post(H, { action: 'mint', projectId: 'proj_a', payload: goodPayload() }));
  ck(r.status === 401, 'A1 no session is refused 401', 'got ' + r.status);
  r = await asJson(await post(H, { action: 'mint', projectId: 'proj_a', payload: goodPayload() }, 'anon.key.value'));
  ck(r.status === 401, 'A2 the public anon key alone is refused 401', 'got ' + r.status);
  const drift = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'edge-auth-test', 'sync-shared.js'), '--check']);
  ck(drift.status === 0, 'A3 the generated gate has not drifted from the canon', String(drift.stdout));

  // ---- B. the sweep is a whitelist
  console.log('-- B: the payload sweep');
  resetNet();
  r = await asJson(await post(H, { action: 'mint', projectId: 'proj_a', payload: goodPayload() }, USER_TOKEN));
  ck(r.status === 200 && r.body.ok === true && r.body.token === 'tokabc123def456ghi789jkl',
    'B1 a contract payload mints', JSON.stringify(r.body));
  ck(/look\.html\?t=tokabc123def456ghi789jkl$/.test(r.body.url || ''), 'B2 the share URL is look.html?t=<token>', r.body.url);
  ck((r.body.watchUrl || '').indexOf(r.body.url + '&watch=1') === 0, 'B3 the watch URL is the same door, asked to play', r.body.watchUrl);
  ck(netLog.mints.length === 1 && netLog.mints[0].p_project_id === 'proj_a' && netLog.mints[0].p_owner_id === 'user-1',
    'B4 the mint names the VERIFIED caller, never a client-claimed one', JSON.stringify(netLog.mints[0]));

  async function refusedKey(payload, key, name) {
    const res = await asJson(await post(H, { action: 'mint', projectId: 'proj_a', payload: payload }, USER_TOKEN));
    ck(res.body.ok === false && res.body.reason === 'not-shareable' && res.body.key === key,
      name, JSON.stringify(res.body));
  }
  await refusedKey(goodPayload({ memories: [{ content: 'private' }] }), 'memories', 'B5 an unknown top-level key (memories) refuses the WHOLE payload, naming the key');
  await refusedKey(goodPayload({ pages: [{ image: JPEG_1PX, cardId: 'card-1' }] }), 'cardId', 'B6 an unknown page key (cardId) refuses too — depth does not launder a field');
  await refusedKey(goodPayload({ pages: [{ image: 'https://evil.example/x.jpg' }] }), 'image', 'B7 a page image must be a data URI, never a URL');
  await refusedKey(goodPayload({ pages: [{ image: 'vihu-asset:abc' }] }), 'image', 'B8 an asset reference is refused — images never leave as references');
  await refusedKey(goodPayload({ madeIn: 'elsewhere' }), 'madeIn', 'B9 the provenance field is fixed');
  await refusedKey(goodPayload({ ether: '../../../etc' }), 'ether', 'B10 a malformed ether id is refused');
  await refusedKey(goodPayload({ pages: [{ image: 'data:image/jpeg;base64,' + 'A'.repeat(1000001) }] }), 'image', 'B11 an oversize page image is refused');
  r = await asJson(await post(H, { action: 'mint', projectId: 'proj_a', payload: goodPayload({ ether: 'proj_a' }) }, USER_TOKEN));
  ck(r.body.ok === true, 'B12 a well-formed ether id survives the sweep');
  r = await asJson(await post(H, { action: 'mint', projectId: '../evil', payload: goodPayload() }, USER_TOKEN));
  ck(r.status === 400, 'B13 a malformed projectId is refused', 'got ' + r.status);

  // ---- C. the letter
  console.log('-- C: share with parent');
  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-1' }, USER_TOKEN));
  ck(r.body.ok === true && r.body.sent === true && r.body.parentKnown === true,
    'C1 an address on file sends with nothing asked', JSON.stringify(r.body));
  const letter = netLog.letters[0] || {};
  ck(String(letter.to) === 'mum@example.com', 'C2 to the card\'s own parent_email', String(letter.to));
  ck(letter.subject === 'Sam made something!', 'C3 the subject is the child, not the product', letter.subject);
  const wantLinks = ['look.html?t=tokabc123def456ghi789jkl', 'watch=1', 'wa.me', 'share=1'];
  wantLinks.forEach((frag, i) => {
    ck((letter.text || '').indexOf(frag) !== -1 && (letter.html || '').indexOf(frag) !== -1,
      'C4.' + (i + 1) + ' both halves carry ' + frag);
  });
  ck((letter.html || '').indexOf('functions/v1/creation-share?cover=tokabc123def456ghi789jkl') !== -1,
    'C5 the letter shows the creation via the cover route (Gmail strips data: images)');
  ck((letter.text || '').indexOf('The Moon Dragon') !== -1 && (letter.text || '').indexOf('Sam') !== -1,
    'C6 the letter is about the creation — name and title, not marketing');
  const answered = JSON.stringify(r.body);
  ck(answered.indexOf('mum@example.com') === -1 && answered.indexOf('user-1') === -1 && answered.indexOf('card-1') === -1,
    'C7 the reply carries no address, no user id, no card id', answered);
  const letterAll = JSON.stringify(letter);
  ck(letterAll.indexOf('user-1') === -1 && letterAll.indexOf('card-1') === -1 && letterAll.indexOf('proj_a') === -1,
    'C8 the letter itself carries no identifier — only the token travels');
  ck(netLog.patches.length === 0, 'C9 an address on file is never re-written');

  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-3' }, USER_TOKEN));
  ck(r.body.ok === false && r.body.reason === 'no-recipient' && !!r.body.token,
    'C10 no address anywhere → no-recipient (the hub asks the child), and the mint still stands', JSON.stringify(r.body));
  ck(netLog.letters.length === 0, 'C11 and nothing was sent');

  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-3', email: 'dad@example.com' }, USER_TOKEN));
  ck(r.body.ok === true && r.body.parentKnown === false, 'C12 a given address sends', JSON.stringify(r.body));
  ck(netLog.patches.length === 1 && /parent_email=is\.null/.test(netLog.patches[0].url) &&
     netLog.patches[0].body.parent_email === 'dad@example.com',
    'C13 a FIRST address is kept on the card, guarded so it can only ever fill, never overwrite',
    JSON.stringify(netLog.patches[0]));

  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), email: 'dad@example.com' }, USER_TOKEN));
  ck(r.body.ok === true && netLog.patches.length === 0,
    'C14 no card, given address: sends, stores nothing (a Traveller leaves no record)');

  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-2' }, USER_TOKEN));
  ck(r.status === 403, 'C15 somebody else\'s card is a 403 — a selector, never an assertion', 'got ' + r.status);

  // Sprint 1.1 — "Send this to…" is a one-time destination choice.
  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-1', email: 'grandma@example.com', once: true }, USER_TOKEN));
  ck(r.body.ok === true && String((netLog.letters[0] || {}).to) === 'grandma@example.com',
    'C16 an edited destination wins for THIS delivery', String((netLog.letters[0] || {}).to));
  ck(netLog.patches.length === 0, 'C16b and the saved address is untouched');

  resetNet();
  r = await asJson(await post(H, { action: 'send', projectId: 'proj_a', payload: goodPayload(), identityId: 'card-3', email: 'aunt@example.com', once: true }, USER_TOKEN));
  ck(r.body.ok === true && netLog.patches.length === 0,
    'C17 a ONCE destination is never kept — even on a card with no address at all',
    JSON.stringify ? JSON.stringify({ patches: netLog.patches.length }) : '');

  // ---- D. the cover and the probe
  console.log('-- D: cover image and probe');
  let cover = await H(new Request('http://local/creation-share?cover=tokabc123def456ghi789jkl', { method: 'GET' }));
  ck(cover.status === 200 && /image\/jpeg/.test(cover.headers.get('Content-Type') || ''),
    'D1 the cover answers image bytes with no session — the token is the capability',
    cover.status + ' ' + cover.headers.get('Content-Type'));
  cover = await H(new Request('http://local/creation-share?cover=no-such-token', { method: 'GET' }));
  ck(cover.status === 404, 'D2 an unknown token\'s cover is 404, nothing more', 'got ' + cover.status);
  r = await asJson(await H(new Request('http://local/creation-share', { method: 'GET', headers: { Authorization: 'Bearer ' + USER_TOKEN } })));
  ck(r.body.ok === true && r.body.build === M.BUILD, 'D3 the probe reports its build', JSON.stringify(r.body));

  // ---- E. the allowance
  console.log('-- E: rate limiting');
  resetNet();
  await post(H, { action: 'mint', projectId: 'proj_a', payload: goodPayload() }, USER_TOKEN);
  ck(netLog.limitHits.length === 1 && netLog.limitHits[0].p_bucket === 'creation-share',
    'E1 a POST is counted against the creation-share bucket', JSON.stringify(netLog.limitHits[0]));
  const closed = handlerWith({ EDGE_LIMIT_CREATION_SHARE_MAX: '0' });
  r = await asJson(await post(closed, { action: 'mint', projectId: 'proj_a', payload: goodPayload() }, USER_TOKEN));
  ck(r.status === 429, 'E2 the per-deployment kill switch (limit 0) closes it', 'got ' + r.status);

  fs.unlinkSync(tmp);

  /* ============================================================
   * PART 2 — the child's own surfaces, in a real browser
   * ============================================================ */
  console.log('\nPART 2 — the hub, the prints, and the landing\n');

  const server = cp.spawn(process.execPath, [path.join(ROOT, 'tools', 'bring-it-alive', 'test', 'serve.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 700));

  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  // The atmosphere suite's own idiom: spy the Audio constructor,
  // because every element the player builds is `new Audio(src)` and
  // never enters the document — there is nothing to query for.
  await page.addInitScript(() => {
    window.__audios = [];
    const A = window.Audio;
    window.Audio = function (src) { const a = new A(src); window.__audios.push(a); return a; };
    window.Audio.prototype = A.prototype;
  });

  // The function is faked at the network edge, programmable per check.
  let fnPlan = { mode: 'ok' };
  const fnCalls = [];
  await page.route('**/functions/v1/creation-share**', (route) => {
    const req = route.request();
    let body = null;
    try { body = JSON.parse(req.postData() || 'null'); } catch (e) {}
    fnCalls.push({ method: req.method(), body: body });
    const token = 'tokbrowser0123456789abcd';
    const url = BASE + '/look.html?t=' + token;
    if (fnPlan.mode === 'no-recipient') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'no-recipient', token: token, url: url, watchUrl: url + '&watch=1' }) });
    }
    if (fnPlan.mode === 'down') {
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'unreachable' }) });
    }
    const ok = { ok: true, token: token, url: url, watchUrl: url + '&watch=1' };
    if (body && body.action === 'send') { ok.sent = true; ok.parentKnown = fnPlan.parentKnown !== false; }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ok) });
  });

  async function bootEditor() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CreationFlow !== 'undefined' && typeof StudioRite !== 'undefined' &&
      typeof MagicCard !== 'undefined' && typeof LookWhatIMade !== 'undefined', null, { timeout: 20000 });
    await page.evaluate(() => {
      localStorage.clear(); sessionStorage.clear();
      StudioRite.markComplete();
      const c = MagicCard.claim('Sam', null, { companionId: 'leafy', companionName: 'Leafy', companionSpecies: 'Bloomling' });
      MagicCard.setActive(c.id);
      const gw = document.getElementById('gatewayOverlay');
      if (gw) gw.style.display = 'none';
      document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await page.waitForFunction(() => typeof AppState !== 'undefined' && Array.isArray(AppState.slides) && AppState.slides.length > 0, null, { timeout: 20000 });
    // The platform client asks ThemeRepositoryClient for a LIVE session
    // token; this suite has no platform, so the session is stubbed IN
    // PLACE (mutated, never replaced through window — the const-binding
    // trap Decision 40 records).
    await page.evaluate(() => {
      try {
        ThemeRepositoryClient.getSession = function () {
          return Promise.resolve({ access_token: 'look.suite.session.token' });
        };
      } catch (e) {}
    });
    await page.waitForTimeout(600);
  }

  await bootEditor();

  // ---- F. the contract knows what a creation is
  console.log('-- F: the type is inferred, never asked');
  const types = await page.evaluate((png) => {
    const page1 = { image: png, metadata: {} };
    const page2 = { image: png, metadata: {} };
    const busy = { image: png, metadata: { stickers: [{ id: 's1' }, { id: 's2' }] } };
    return {
      story: CreationShare.typeOf([page1, page2]),
      sequence: CreationShare.typeOf([busy]),
      moment: CreationShare.typeOf([page1]),
      says: [CreationShare.says('moment'), CreationShare.says('sequence'), CreationShare.says('story')],
    };
  }, PNG_1PX);
  ck(types.story === 'story', 'F1 many pages → story', types.story);
  ck(types.sequence === 'sequence', 'F2 one page, many makings → sequence', types.sequence);
  ck(types.moment === 'moment', 'F3 one page, one making → moment', types.moment);
  ck(types.says.join('|') === 'Look what I made|Look what happened|Read my story',
    'F4 and each speaks its own sentence', types.says.join('|'));

  // ---- G. the third story action
  console.log('-- G: the story action wakes');
  let btn = await page.evaluate(() => {
    const b = document.getElementById('lookBtn');
    return b ? { asleep: b.classList.contains('is-asleep'), text: b.textContent.trim() } : null;
  });
  ck(btn && /Look What I Made/.test(btn.text), 'G1 ✨ Look What I Made stands beside Play and Finish', JSON.stringify(btn));
  ck(btn && btn.asleep, 'G2 asleep while the page is empty', JSON.stringify(btn));
  await page.evaluate((png) => {
    AppState.slides[0].image = png;
    AppState.slides[0]._imageDataURL = png;
    // Words too — the reveal tells them word by word, which is what
    // gives the Watch experience several stages to be continuous
    // ACROSS (a one-frame making cannot flicker or not flicker).
    // Written into the REAL story field, not poked onto the slide:
    // draw() syncs slide.storyBeat FROM #storyBeat on every redraw,
    // so a bare property write is wiped by the first render — the
    // trap this suite itself fell into on its first 1.1 run.
    const beat = document.getElementById('storyBeat');
    if (beat) beat.value = 'The moon dragon flew all the way home.';
    AppState.slides[0].storyBeat = 'The moon dragon flew all the way home.';
    // A dark authored page background — what ☀️ Plain paper exists to
    // lift off the printed sheet.
    AppState.slides[0].metadata = AppState.slides[0].metadata || {};
    AppState.slides[0].metadata.cardOverrides = Object.assign(
      {}, AppState.slides[0].metadata.cardOverrides, { background: '#1a2244' });
    const t = document.getElementById('bookTitle');
    if (t) t.value = 'The Moon Dragon';
    window.refreshStoryActions();
    ProjectManager.markDirty();
    ProjectManager.saveToLocalStorage();
  }, PNG_1PX);
  await page.waitForTimeout(300);
  btn = await page.evaluate(() => {
    const b = document.getElementById('lookBtn');
    return { asleep: b.classList.contains('is-asleep') };
  });
  ck(!btn.asleep, 'G3 and wakes the moment there is something to look at');

  // ---- H. the hub
  console.log('-- H: the hub shows the creation first');
  await page.evaluate(() => document.getElementById('lookBtn').click());
  await page.waitForTimeout(400);
  const home = await page.evaluate(() => {
    const card = document.querySelector('.lwim-card');
    const buttons = Array.from(card.querySelectorAll('.lwim-actions .lwim-btn')).map((b) => b.textContent.trim());
    const img = card.querySelector('.lwim-preview-img');
    return { open: LookWhatIMade.isOpen(), text: card.innerText, buttons: buttons, hasPreview: !!img };
  });
  await page.screenshot({ path: path.join(SHOTS, 'H-hub.png') });
  ck(home.open && home.hasPreview, 'H1 the creation is the first thing shown', JSON.stringify({ hasPreview: home.hasPreview }));
  ck(home.buttons.length === 4 &&
     /Share with Parent/.test(home.buttons[0]) && /Print Foldable/.test(home.buttons[1]) &&
     /Print Story Card/.test(home.buttons[2]) && /Watch/.test(home.buttons[3]),
    'H2 exactly the four doors, in the sprint\'s own words', home.buttons.join(' | '));
  ck(!/email|URL|http|PDF|QR|scan\b|link|settings/i.test(home.text),
    'H3 no adult vocabulary anywhere on the hub', home.text.replace(/\n/g, ' · '));
  // 1.1 gave the fixture words as well as a picture — two authored
  // marks on one page IS a sequence, so the hub's sentence changed
  // with the creation. The check follows the truth, not the old
  // fixture.
  ck(/Look what happened/.test(home.text), 'H4 the type speaks its own sentence (a sequence)', home.text.split('\n')[1] || '');

  // ---- I. share with parent
  console.log('-- I: share with parent');
  fnPlan = { mode: 'ok' };
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Share with Parent/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  const shareView = await page.evaluate(() => document.querySelector('.lwim-card').innerText);
  ck(/Send this to my parent/.test(shareView), 'I1 the child\'s sentence, then one button', shareView.replace(/\n/g, ' · '));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /^Send/.test(b.textContent.trim())).click();
  });
  await page.waitForFunction(() => /on its way/.test(document.querySelector('.lwim-card').innerText), null, { timeout: 30000 });
  ck(true, 'I2 a known parent: pressed once, on its way — nothing else asked');
  const sent = fnCalls.filter((c) => c.body && c.body.action === 'send');
  ck(sent.length === 1 && sent[0].body.projectId && sent[0].body.payload &&
     sent[0].body.payload.pages.length >= 1,
    'I3 one send, carrying the snapshot', JSON.stringify({ n: sent.length, pages: sent.length && sent[0].body.payload.pages.length }));
  const payloadKeys = sent.length ? Object.keys(sent[0].body.payload).sort().join(',') : '';
  ck(payloadKeys === 'creatorName,madeIn,pages,title,type,v' || payloadKeys === 'creatorName,ether,madeIn,pages,title,type,v' || payloadKeys === 'creatorName,madeIn,pages,title,type,v,watch' || payloadKeys === 'creatorName,ether,madeIn,pages,title,type,v,watch',
    'I4 the snapshot is ONLY the contract — no card, no session, no memory, no project internals', payloadKeys);

  // the ask, when nobody is on file
  fnPlan = { mode: 'no-recipient' };
  await page.evaluate(() => { LookWhatIMade.close(); document.getElementById('lookBtn').click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Share with Parent/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /^Send/.test(b.textContent.trim())).click();
  });
  await page.waitForFunction(() => /Who should I send it to/.test(document.querySelector('.lwim-card').innerText), null, { timeout: 30000 });
  ck(true, 'I5 nobody on file → "Who should I send it to?"');
  fnPlan = { mode: 'ok' };
  await page.evaluate(() => {
    const input = document.querySelector('.lwim-input');
    input.value = 'dad@example.com';
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /^Send/.test(b.textContent.trim())).click();
  });
  await page.waitForFunction(() => /on its way/.test(document.querySelector('.lwim-card').innerText), null, { timeout: 30000 });
  ck(true, 'I6 the answered address sends');

  // ---- S. the share shows its destination (Sprint 1.1 §6)
  console.log('-- S: send this to…');
  fnPlan = { mode: 'ok' };
  await page.evaluate(() => {
    localStorage.setItem('vihu-sky-parent-email', 'mum@example.com');
    LookWhatIMade.close();
    document.getElementById('lookBtn').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Share with Parent/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  const destView = await page.evaluate(() => ({
    text: document.querySelector('.lwim-card').innerText,
    value: (document.querySelector('.lwim-dest .lwim-input') || {}).value || '',
    editBtn: Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Edit/.test(b.textContent)),
  }));
  ck(/Send this to:/.test(destView.text) && destView.value === 'mum@example.com',
    'S1 the saved grown-up address is VISIBLE before anything is sent', destView.value);
  // 1.1.1, from real use: the field itself is editable — no Edit
  // button standing between the child and the address.
  ck(!destView.editBtn, 'S2 the field is DIRECTLY editable — no Edit button in the way');

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /^Send/.test(b.textContent.trim())).click();
  });
  await page.waitForFunction(() => /on its way/.test(document.querySelector('.lwim-card').innerText), null, { timeout: 30000 });
  let lastSend = fnCalls.filter((c) => c.body && c.body.action === 'send').pop();
  ck(!('email' in lastSend.body) && !('once' in lastSend.body),
    'S3 an unedited send carries NO address — the card\'s own is the default', JSON.stringify(Object.keys(lastSend.body)));

  await page.evaluate(() => { LookWhatIMade.close(); document.getElementById('lookBtn').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Share with Parent/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  const prefilled = await page.evaluate(() => (document.querySelector('.lwim-dest .lwim-input') || {}).value);
  ck(prefilled === 'mum@example.com', 'S4 the field starts from the saved address, prefilled', prefilled);
  await page.evaluate(() => {
    const input = document.querySelector('.lwim-dest .lwim-input');
    input.value = 'grandma@example.com';
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /^Send/.test(b.textContent.trim())).click();
  });
  await page.waitForFunction(() => /on its way/.test(document.querySelector('.lwim-card').innerText), null, { timeout: 30000 });
  lastSend = fnCalls.filter((c) => c.body && c.body.action === 'send').pop();
  ck(lastSend.body.email === 'grandma@example.com' && lastSend.body.once === true,
    'S5 the edited address travels marked ONCE — a destination, never an address to keep',
    JSON.stringify({ email: lastSend.body.email, once: lastSend.body.once }));

  const savedAfter = await page.evaluate(() => localStorage.getItem('vihu-sky-parent-email'));
  await page.evaluate(() => { LookWhatIMade.close(); document.getElementById('lookBtn').click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Share with Parent/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  const nextTime = await page.evaluate(() => (document.querySelector('.lwim-dest .lwim-input') || {}).value || '');
  ck(savedAfter === 'mum@example.com' && nextTime === 'mum@example.com',
    'S6 the saved address is untouched and is still the NEXT share\'s default', nextTime);
  await page.evaluate(() => { localStorage.removeItem('vihu-sky-parent-email'); LookWhatIMade.close(); });

  // ---- J. the foldable
  console.log('-- J: the foldable — preview before print');
  let printed = await page.evaluate(() => {
    window.__prints = [];
    window.print = function () {
      const sheet = document.querySelector('.lwim-print-sheet');
      window.__prints.push({
        kind: sheet ? sheet.className : null,
        images: sheet ? sheet.querySelectorAll('img').length : 0,
        srcSample: sheet ? (sheet.querySelector('img') || {}).src || '' : '',
      });
      window.dispatchEvent(new Event('afterprint'));
    };
    LookWhatIMade.close();
    document.getElementById('lookBtn').click();
    return true;
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print Foldable/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => !!document.querySelector('.lwim-sheet-img'), null, { timeout: 60000 });
  await page.screenshot({ path: path.join(SHOTS, 'J-foldable.png') });
  const foldableView = await page.evaluate(() => ({
    text: document.querySelector('.lwim-card').innerText,
    sheetSrc: (document.querySelector('.lwim-sheet-img') || {}).src || '',
    printedYet: window.__prints.length,
  }));
  ck(foldableView.sheetSrc.indexOf('data:image/jpeg') === 0 && foldableView.printedYet === 0,
    'J1 the physical sheet is SHOWN before anything prints');
  // 1.1 turned the written explanation into the experience itself:
  // the open sheet offers Fold it ✨, and the finished book is SHOWN
  // rather than described.
  ck(/Fold it/.test(foldableView.text) && /whole story/.test(foldableView.text),
    'J2 the open sheet offers Fold it ✨ and says what the sheet IS', foldableView.text.replace(/\n/g, ' · '));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print My Foldable/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => window.__prints.length === 1, null, { timeout: 20000 });
  const printedFold = await page.evaluate(() => window.__prints[0]);
  ck(/lwim-print-foldable/.test(printedFold.kind) && printedFold.images === 2,
    'J3 printing prints the sheet AND its how-to-fold page (1.1.3)', JSON.stringify(printedFold));
  const sameSheet = await page.evaluate(() => window.__prints[0].srcSample === (document.querySelector('.lwim-sheet-img') || {}).src);
  ck(sameSheet, 'J4 the printed bitmap IS the previewed bitmap — match by construction');

  // the fold model, re-derived independently of the composer's table
  const fold = await page.evaluate(() => {
    const C = FoldableComposer;
    // The physical model, built from the sheet itself rather than from
    // the composer's table: horizontal neighbours always stay joined;
    // top and bottom stay joined only where the slit did NOT sever
    // them. The composer's IMPOSITION is then held to two facts of
    // paper: (1) the cut sheet is ONE cycle of eight panels — that is
    // what lets it close into a book at all — and (2) every
    // consecutive reading pair (P1→P2 … P7→P8, and P8 wrapping to P1)
    // sits on physically joined panels, because a book's next page is
    // always across a fold, never across a cut or a gap.
    const edges = {};
    const join = (a, b) => { (edges[a] = edges[a] || []).push(b); (edges[b] = edges[b] || []).push(a); };
    for (let c = 0; c < C.COLS - 1; c++) { join('T' + c, 'T' + (c + 1)); join('B' + c, 'B' + (c + 1)); }
    for (let c = 0; c < C.COLS; c++) { if (C.SLIT_COLS.indexOf(c) === -1) join('T' + c, 'B' + c); }
    const isCycle = Object.keys(edges).length === 8 && Object.values(edges).every((n) => n.length === 2);

    const cellOfPanel = {};
    C.IMPOSITION.forEach((s) => { cellOfPanel[s.panel] = (s.row === 0 ? 'T' : 'B') + s.col; });
    let consecutiveJoins = 0;
    for (let p = 1; p <= 8; p++) {
      const here = cellOfPanel[p];
      const next = cellOfPanel[(p % 8) + 1];
      if (edges[here] && edges[here].indexOf(next) !== -1) consecutiveJoins++;
    }
    const topPanels = C.IMPOSITION.filter((s) => s.row === 0).map((s) => s.panel).sort().join(',');
    return { isCycle: isCycle, consecutiveJoins: consecutiveJoins, topPanels: topPanels };
  });
  ck(fold.isCycle, 'J5 the slit turns the sheet into one cycle of eight panels (it can close into a book)');
  ck(fold.consecutiveJoins === 8,
    'J6 every consecutive reading pair is physically joined — fold order is correct', fold.consecutiveJoins + '/8 joined');
  ck(fold.topPanels === '2,3,4,5', 'J7 exactly the head-hanging panels print rotated', fold.topPanels);

  // Sprint 1.1 — the Story Card rides the sheet, and the fold is
  // EXPERIENCED: open sheet → Fold it ✨ → the finished little book.
  const composed = await page.evaluate(async () => {
    const payload = await CreationShare.snapshot(CreatorProjectStore.get(AppState.project.id), AppState.slides);
    const made = await FoldableComposer.compose(payload, { cardUrl: 'http://doors.example/look.html?t=tokstrip' });
    return {
      card: made.card,
      zineW: made.zineW,
      stripOk: made.zineW === FoldableComposer.SHEET_W - FoldableComposer.CARD_STRIP_W,
      front: made.cardCells && made.cardCells.front,
      back: made.cardCells && made.cardCells.back,
      panels: (made.panels || []).map((pn) => pn.n).join(','),
      guide: !!(made.guide && made.guide.indexOf('data:image') === 0),
      stepsWithCard: FoldableComposer.FOLD_STEPS(true).length,
      stepsWithout: FoldableComposer.FOLD_STEPS(false).length,
    };
  });
  ck(composed.card && composed.stripOk,
    'J8 with a door, the sheet gives its edge to the tear-off Story Card strip',
    JSON.stringify({ card: composed.card, zineW: composed.zineW }));
  ck(!!composed.front && composed.front.w === 750 && composed.front.h === 1050 &&
     !!composed.back && composed.back.w === 750 && composed.back.h === 1050,
    'J9 the card rides at its EXACT printed size — 2.5in × 3.5in at 300dpi', JSON.stringify(composed.front));
  ck(composed.panels === '1,2,3,4,5,6,7,8',
    'J10 and the upright panels come back in reading order for the folded book', composed.panels);
  // 1.1.3: the paper teaches the fold. The composer produces a
  // how-to-fold GUIDE PAGE beside the sheet, drawn from the same
  // FOLD_STEPS the on-screen guide renders — one set of drawings,
  // two surfaces.
  ck(composed.guide, 'J10b the composer makes the how-to-fold guide page');
  ck(composed.stepsWithCard === 5 && composed.stepsWithout === 4,
    'J10c FOLD_STEPS is the one source — five steps with a card, four without',
    composed.stepsWithCard + '/' + composed.stepsWithout);

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Fold it/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => !!document.querySelector('.lwim-book-page'), null, { timeout: 20000 });
  const folded = await page.evaluate(() => ({
    text: document.querySelector('.lwim-card').innerText,
    cardShown: !!document.querySelector('.lwim-book-card'),
    printBtn: Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Print My Foldable/.test(b.textContent)),
  }));
  ck(/little book/i.test(folded.text), 'J11 the FINISHED folded book is shown, as the child would hold it');
  ck(folded.cardShown && /cut it off and give it/i.test(folded.text),
    'J12 with the Story Card presented as part of it');
  const turn1 = await page.evaluate(() => (document.querySelector('.lwim-book-page') || {}).src);
  await page.evaluate(() => document.querySelector('.lwim-book').click());
  const turn2 = await page.evaluate(() => (document.querySelector('.lwim-book-page') || {}).src);
  ck(!!turn1 && !!turn2 && turn1 !== turn2, 'J13 tapping the book turns its pages');
  ck(folded.printBtn, 'J14 and Print still waits at the end, after the child has SEEN the result');

  // 1.1.1, from real use: "kid might want to see how to fold."
  const guide = await page.evaluate(() => ({
    title: /How to fold it/.test(document.querySelector('.lwim-card').innerText),
    steps: document.querySelectorAll('.lwim-howfold-step').length,
    pics: document.querySelectorAll('.lwim-howfold-pic svg').length,
    cutCard: /Cut your Story Card off the edge/.test(document.querySelector('.lwim-card').innerText),
  }));
  ck(guide.title && guide.steps === 5 && guide.pics === 5,
    'J15 the folded view SHOWS how to fold — five little pictures, few words', JSON.stringify(guide));
  ck(guide.cutCard, 'J16 and the first step is cutting the Story Card off the edge');

  // 1.1.3: "add kind printing on the screen post fold it button" —
  // the ☀️ paper choice stands beside the folded view's own Print.
  const foldedToggle = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Plain paper/.test(b.textContent)));
  ck(foldedToggle, 'J17 the paper choice is offered AFTER folding too');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Plain paper/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => !!document.querySelector('.lwim-book-page'), null, { timeout: 120000 });
  const plainFolded = await page.evaluate(() => ({
    book: !!document.querySelector('.lwim-book-page'),
    back: Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Bring the colours back/.test(b.textContent)),
  }));
  ck(plainFolded.book && plainFolded.back,
    'J18 choosing it post-fold recomposes and returns to the FOLDED book, plain');
  // Back to colour so the P section starts where it expects to.
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Bring the colours back/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => !!document.querySelector('.lwim-book-page'), null, { timeout: 120000 });

  // ---- P. plain paper (1.1.1) — "if its black and white print can
  // we remove the bg color of slides?"
  console.log('-- P: plain paper');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /← Back/.test(b.textContent)).click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print Foldable/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => !!document.querySelector('.lwim-sheet-img'), null, { timeout: 90000 });
  const colorSheet = await page.evaluate(() => ({
    src: document.querySelector('.lwim-sheet-img').src,
    toggle: Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Plain paper/.test(b.textContent)),
  }));
  ck(colorSheet.toggle, 'P1 ☀️ Plain paper is offered beside the sheet');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Plain paper/.test(b.textContent)).click();
  });
  await page.waitForFunction((prev) => {
    const img = document.querySelector('.lwim-sheet-img');
    return img && img.src && img.src !== prev;
  }, colorSheet.src, { timeout: 120000 });
  const plain = await page.evaluate(async (colorSrc) => {
    const plainSrc = document.querySelector('.lwim-sheet-img').src;
    async function lum(src) {
      const img = new Image(); img.src = src;
      await (img.decode ? img.decode() : new Promise((res) => { img.onload = res; }));
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 64) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return sum / n / 255;
    }
    return {
      colorLum: await lum(colorSrc),
      plainLum: await lum(plainSrc),
      back: Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Bring the colours back/.test(b.textContent)),
    };
  }, colorSheet.src);
  ck(plain.plainLum > plain.colorLum + 0.02,
    'P2 the plain sheet is MEASURABLY lighter — the page background lifts off the paper',
    JSON.stringify({ color: plain.colorLum.toFixed(3), plain: plain.plainLum.toFixed(3) }));
  ck(plain.back, 'P3 and the colours are one press away again');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print My Foldable/.test(b.textContent)).click();
  });
  await page.waitForFunction((n) => window.__prints.length === n, 2, { timeout: 20000 });
  const printedPlain = await page.evaluate(() =>
    window.__prints[1].srcSample === (document.querySelector('.lwim-sheet-img') || {}).src);
  ck(printedPlain, 'P4 printing prints the plain sheet the child was just shown — the preview holds through the toggle');
  await page.evaluate(() => { LookWhatIMade.close(); });

  // ---- K. the story card
  console.log('-- K: the story card — and a real scan');
  await page.evaluate(() => {
    LookWhatIMade.close();
    document.getElementById('lookBtn').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print Story Card/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => document.querySelectorAll('.lwim-card-img').length === 2, null, { timeout: 90000 });
  await page.screenshot({ path: path.join(SHOTS, 'K-card.png') });
  const cardView = await page.evaluate(() => ({
    text: document.querySelector('.lwim-card').innerText,
    printedYet: window.__prints.length,
  }));
  ck(cardView.printedYet === 2, 'K1 front and back are SHOWN before anything prints (two earlier prints were the foldable\'s own)');
  ck(/point a phone|comes alive|opens for them/i.test(cardView.text),
    'K2 the child is told what the card DOES, in magic rather than mechanism', cardView.text.replace(/\n/g, ' · '));
  ck(!/QR|scan\b|code|link|URL/i.test(cardView.text),
    'K3 and never the words QR, scan, code or link', cardView.text.replace(/\n/g, ' · '));
  ck(/Give this to someone/.test(cardView.text), 'K7 the card\'s purpose is one sentence: Give this to someone!');
  const demoSteps = await page.evaluate(() => document.querySelectorAll('.lwim-demo-step').length);
  ck(demoSteps === 3, 'K8 and its life is three little beats: give → a phone → the creation opens', String(demoSteps));

  await page.addScriptTag({ url: BASE + '/tools/datamatrix-lab/vendor/zxing.min.js' });
  const scanned = await page.evaluate(() => {
    const img = document.querySelectorAll('.lwim-card-img')[1];
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.MultiFormatReader();
      reader.setHints(hints);
      const lum = new ZXing.HTMLCanvasElementLuminanceSource(cv);
      const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
      return { ok: true, text: reader.decode(bmp).getText() };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  ck(scanned.ok, 'K4 a real decoder reads the printed card back', scanned.err);
  ck(scanned.ok && scanned.text === BASE + '/look.html?t=tokbrowser0123456789abcd',
    'K5 and it resolves to the creation\'s own share door — the opaque token, never a project id', scanned.text);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Print My Card/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => window.__prints.length === 3, null, { timeout: 20000 });
  const printedCard = await page.evaluate(() => window.__prints[2]);
  ck(/lwim-print-card/.test(printedCard.kind) && printedCard.images === 2,
    'K6 the printed card is front and back, the pair just previewed', JSON.stringify(printedCard.kind));
  // 1.1.3: "same add kind printing on story card." The plain card is
  // measurably lighter, and — the part that must never regress — its
  // door still SCANS: the QR stays black-on-white in both palettes.
  const colorFront = await page.evaluate(() => document.querySelectorAll('.lwim-card-img')[0].src);
  const cardToggle = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Plain paper/.test(b.textContent)));
  ck(cardToggle, 'K9 the paper choice is offered on the Story Card too');
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Plain paper/.test(b.textContent)).click();
  });
  await page.waitForFunction((prev) => {
    const imgs = document.querySelectorAll('.lwim-card-img');
    return imgs.length === 2 && imgs[0].src && imgs[0].src !== prev;
  }, colorFront, { timeout: 120000 });
  const plainCard = await page.evaluate(async (prevFront) => {
    async function lum(src) {
      const img = new Image(); img.src = src;
      await (img.decode ? img.decode() : new Promise((res) => { img.onload = res; }));
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 64) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return sum / n / 255;
    }
    const imgs = document.querySelectorAll('.lwim-card-img');
    return { colorLum: await lum(prevFront), plainLum: await lum(imgs[0].src) };
  }, colorFront);
  ck(plainCard.plainLum > plainCard.colorLum + 0.1,
    'K10 the plain card is measurably lighter — night ink on white paper',
    JSON.stringify({ color: plainCard.colorLum.toFixed(3), plain: plainCard.plainLum.toFixed(3) }));
  const scannedPlain = await page.evaluate(() => {
    const img = document.querySelectorAll('.lwim-card-img')[1];
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.MultiFormatReader();
      reader.setHints(hints);
      const lum = new ZXing.HTMLCanvasElementLuminanceSource(cv);
      const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
      return { ok: true, text: reader.decode(bmp).getText() };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  ck(scannedPlain.ok && scannedPlain.text === BASE + '/look.html?t=tokbrowser0123456789abcd',
    'K11 and the plain card\'s door still scans to the same creation', scannedPlain.text || scannedPlain.err);


  // ---- L. watch — one continuous magical making (Sprint 1.1)
  console.log('-- L: watch — continuity and music');
  await page.evaluate(() => {
    LookWhatIMade.close();
    document.getElementById('lookBtn').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Watch/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => {
    const st = document.querySelector('.cp-stage');
    const layer = st && st.querySelector('.cp-layer');
    return layer && layer.src && layer.src.indexOf('data:image') === 0;
  }, null, { timeout: 60000 });
  ck(true, 'L1 the making plays through the ONE shared player (.cp-stage)');

  // Music first, while the playback is certainly still running — a
  // finished playback has already taken its bow, and measuring the
  // bow as "music broken" would be measuring the wrong moment. The
  // filter is the player's own marked element: AudioManager plays
  // the SAME World tracks in its own rotation, and a filter by
  // filename hears the wrong sound (the atmosphere suite's own
  // recorded lesson).
  const music = await page.evaluate(async () => {
    const list = (window.__audios || []).filter((a) => a.__cpBed);
    const a = list[list.length - 1];
    if (!a) return { found: false };
    const t1 = a.currentTime; const paused1 = a.paused;
    await new Promise((res) => setTimeout(res, 700));
    return { found: true, count: list.length, playing: !paused1 && !a.paused,
             monotonic: a.currentTime >= t1, loop: a.loop,
             bed: (a.src || '').indexOf('worlds/a.mp3') !== -1 };
  });
  // 1.1.2: the Watch is scored by the product's own MUSIC (a World
  // track the owner supplied), never a Foundation drone — harmony
  // solo was reported, correctly, as horror-movie music.
  ck(music.found && music.playing && music.bed,
    'L5 the music is a World track — the product\'s own music, not a drone', JSON.stringify(music));
  ck(music.count === 1 && music.monotonic && music.loop,
    'L6 ONE continuous track — never restarted between frames', JSON.stringify(music));

  // Continuity is MEASURED: mark the surface, then sample it while
  // frames advance — the same element the whole way, two layers,
  // and a whole frame visible at every instant. If the making has
  // already finished, it is replayed so the sampling watches a LIVE
  // run rather than a still.
  const continuity = await page.evaluate(async () => {
    const stg = document.querySelector('.cp-stage');
    stg.__sameSurface = true;
    const again = Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Watch again/.test(b.textContent));
    if (again){ again.click(); await new Promise((res) => setTimeout(res, 200)); }
    const firstSrcs = Array.from(stg.querySelectorAll('.cp-layer')).map((l) => l.src);
    let blankSeen = false, advanced = false;
    for (let i = 0; i < 55; i++) {
      await new Promise((res) => setTimeout(res, 90));
      const now = document.querySelector('.cp-stage');
      if (!now || now.__sameSurface !== true) return { torn: true };
      const ls = Array.from(now.querySelectorAll('.cp-layer'));
      const whole = ls.some((l) => l.src && parseFloat(getComputedStyle(l).opacity) > 0.95);
      if (!whole) blankSeen = true;
      if (ls.some((l, j) => l.src !== firstSrcs[j])) advanced = true;
    }
    return { torn: false, blankSeen: blankSeen, advanced: advanced,
             layers: document.querySelectorAll('.cp-stage .cp-layer').length };
  });
  ck(!continuity.torn && continuity.layers === 2,
    'L2 ONE stable surface for the whole replay — never torn down between stages', JSON.stringify(continuity));
  ck(continuity.advanced, 'L3 and the frames really advance on it', JSON.stringify(continuity));
  ck(!continuity.blankSeen,
    'L4 a whole frame is on screen at every sampled instant — no blank flashes', JSON.stringify(continuity));

  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.lwim-btn')).some((b) => /Watch again/.test(b.textContent)),
    null, { timeout: 90000 });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Watch again/.test(b.textContent)).click();
  });
  await page.waitForTimeout(600);
  const replayed = await page.evaluate(() => {
    const stg = document.querySelector('.cp-stage');
    const list = (window.__audios || []).filter((a) => a.__cpBed);
    const a = list[list.length - 1];
    return { sameSurface: !!(stg && stg.__sameSurface), audios: list.length, playing: !!(a && !a.paused) };
  });
  ck(replayed.sameSurface && replayed.audios === 1 && replayed.playing,
    'L7 replay reuses the same surface and the same track, cleanly', JSON.stringify(replayed));

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /← Back/.test(b.textContent)).click();
  });
  await page.waitForTimeout(300);
  const afterClose = await page.evaluate(() => {
    const list = (window.__audios || []).filter((a) => a.__cpBed);
    return list.every((a) => a.paused);
  });
  ck(afterClose, 'L8 leaving the experience stops the music — it never runs underneath anything else');

  await page.evaluate(() => {
    AudioManager.setMuted(true);
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Watch/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => {
    const st = document.querySelector('.cp-stage');
    const layer = st && st.querySelector('.cp-layer');
    return layer && layer.src;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const mutedRun = await page.evaluate(() => {
    const list = (window.__audios || []).filter((a) => a.__cpBed);
    return { anyPlaying: list.some((a) => !a.paused),
             frames: !!document.querySelector('.cp-stage .cp-layer[src]') };
  });
  ck(!mutedRun.anyPlaying && mutedRun.frames,
    'L9 the child\'s own global mute silences the music and the making still plays', JSON.stringify(mutedRun));
  await page.evaluate(() => { AudioManager.setMuted(false); LookWhatIMade.close(); });
  ck(pageErrors.length === 0, 'L10 zero page errors across the whole Studio run', pageErrors.join(' | '));

  // 1.1.1, from real use: "the speaker button on the link shared
  // with parent does not work." The parent's page starts the making
  // with no gesture, autoplay is refused, and the old button then
  // 'muted' music that had never played. Simulated here by refusing
  // play() outright, then pressing the speaker.
  await page.evaluate(() => {
    window.__origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { return Promise.reject(new Error('no-gesture')); };
    document.getElementById('lookBtn').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.lwim-btn')).find((b) => /Watch/.test(b.textContent)).click();
  });
  await page.waitForFunction(() => {
    const st = document.querySelector('.cp-stage');
    const layer = st && st.querySelector('.cp-layer');
    return layer && layer.src;
  }, null, { timeout: 60000 });
  await page.waitForTimeout(400);
  const refused = await page.evaluate(() => ({
    icon: (document.querySelector('.cp-mute') || {}).textContent,
    playing: (window.__audios || []).filter((a) => a.__cpBed).some((a) => !a.paused),
  }));
  ck(refused.icon === '🔇' && !refused.playing,
    'L11 when the room stays silent the speaker says so — 🔇, honestly', JSON.stringify(refused));
  await page.evaluate(() => {
    HTMLMediaElement.prototype.play = window.__origPlay;
    document.querySelector('.cp-mute').click();
  });
  await page.waitForTimeout(500);
  const pressed = await page.evaluate(() => ({
    icon: (document.querySelector('.cp-mute') || {}).textContent,
    playing: (window.__audios || []).filter((a) => a.__cpBed).some((a) => !a.paused),
  }));
  ck(pressed.icon === '🔊' && pressed.playing,
    'L12 and pressing it STARTS the music — the parent-link fix', JSON.stringify(pressed));
  await page.evaluate(() => { document.querySelector('.cp-mute').click(); });
  await page.waitForTimeout(300);
  const repressed = await page.evaluate(() => ({
    icon: (document.querySelector('.cp-mute') || {}).textContent,
    playing: (window.__audios || []).filter((a) => a.__cpBed).some((a) => !a.paused),
  }));
  ck(repressed.icon === '🔇' && !repressed.playing,
    'L13 pressing again stops it — the icon always tells the truth', JSON.stringify(repressed));
  await page.evaluate(() => { LookWhatIMade.close(); });

  // ---- M. the landing — deep entry
  console.log('-- M: look.html opens the EXACT creation');
  const landingRequests = [];
  const landingPage = await browser.newPage({ viewport: { width: 900, height: 900 } });
  landingPage.on('request', (r) => landingRequests.push(r.url()));
  await landingPage.addInitScript(() => {
    window.__audios = [];
    const A = window.Audio;
    window.Audio = function (src) { const a = new A(src); window.__audios.push(a); return a; };
    window.Audio.prototype = A.prototype;
  });
  const landingErrors = [];
  landingPage.on('pageerror', (e) => landingErrors.push(String(e)));

  const storyCreation = {
    v: 1, type: 'story', title: 'The Dragon Who Found the Moon', creatorName: 'Sam',
    pages: [{ image: JPEG_1PX }, { image: PNG_1PX }, { image: JPEG_1PX }],
    watch: [{ image: PNG_1PX, holdMs: 400 }, { image: JPEG_1PX, holdMs: 400 }],
    madeIn: 'vihuplanet', ether: 'proj_pub1',
  };
  await landingPage.route('**/rest/v1/rpc/creation_share_resolve', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.p_token === 'goodtoken') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, creation: storyCreation }) });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'unknown' }) });
  });
  await landingPage.route('**/supabase-config.json', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ url: 'http://supa.local.test', anonKey: 'anon.key' }) }));
  // The landing's own REST call goes to the configured platform host —
  // route it there too.
  await landingPage.route('http://supa.local.test/**', (route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    if (route.request().url().indexOf('creation_share_resolve') !== -1 && body.p_token === 'goodtoken') {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, creation: storyCreation }) });
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'unknown' }) });
  });

  await landingPage.goto(BASE + '/look.html?t=goodtoken');
  await landingPage.waitForFunction(() => !document.getElementById('creation').classList.contains('hidden'), null, { timeout: 15000 });
  await landingPage.screenshot({ path: path.join(SHOTS, 'M-landing.png') });
  const landing = await landingPage.evaluate(() => ({
    headline: document.getElementById('headline').textContent,
    title: document.getElementById('ctitle').textContent,
    count: document.getElementById('count').textContent,
    pagerShown: !document.getElementById('pager').classList.contains('hidden'),
    watchShown: !document.getElementById('watchBtn').classList.contains('hidden'),
    etherShown: !document.getElementById('ether').classList.contains('hidden'),
    etherHref: document.getElementById('ether').getAttribute('href'),
    body: document.body.innerText,
  }));
  ck(landing.headline === 'Look what Sam made', 'M1 "Look what Sam made" — never "Welcome to VihuPlanet"', landing.headline);
  ck(/The Dragon Who Found the Moon/.test(landing.title), 'M2 the exact creation, by name', landing.title);
  ck(landing.pagerShown && landing.count === '1 / 3', 'M3 a story reads page by page', landing.count);
  ck(landing.watchShown, 'M4 the making is offered beside the finished creation');
  ck(landing.etherShown && landing.etherHref === './?story=proj_pub1',
    'M5 a creation already public in the Ether offers its Ether door', landing.etherHref);
  ck(/Come see VihuPlanet/.test(landing.body), 'M6 VihuPlanet is discovered THROUGH the creation — a doorway at the end');

  // page turning
  await landingPage.evaluate(() => document.getElementById('next').click());
  const turned = await landingPage.evaluate(() => document.getElementById('count').textContent);
  ck(turned === '2 / 3', 'M7 the pager turns pages', turned);

  // ?watch=1 plays the making first — through the SAME player the
  // Studio's own 🎬 uses (Sprint 1.1: one creation moment, one
  // treatment), with the same music bed.
  await landingPage.goto(BASE + '/look.html?t=goodtoken&watch=1');
  await landingPage.waitForFunction(() => !document.getElementById('creation').classList.contains('hidden'), null, { timeout: 15000 });
  await landingPage.waitForFunction(() => {
    const l = document.querySelector('#watchStage .cp-layer');
    return l && l.src && l.src.indexOf('data:image') === 0;
  }, null, { timeout: 15000 });
  const watching = await landingPage.evaluate(() => ({
    pagerHidden: document.getElementById('pager').classList.contains('hidden'),
    layers: document.querySelectorAll('#watchStage .cp-layer').length,
  }));
  ck(watching.pagerHidden && watching.layers === 2,
    'M8 the WATCH door plays the making before the pages — through the one shared player', JSON.stringify(watching));
  const landingMusic = await landingPage.evaluate(() => {
    const list = (window.__audios || []).filter((a) => a.__cpBed);
    return { n: list.length, playing: list.some((a) => !a.paused),
             bed: list.every((a) => (a.src || '').indexOf('worlds/a.mp3') !== -1) };
  });
  ck(landingMusic.n === 1 && landingMusic.playing && landingMusic.bed,
    'M8b and the same music bed plays there too', JSON.stringify(landingMusic));

  // an unknown token refuses gently
  await landingPage.goto(BASE + '/look.html?t=neverminted');
  await landingPage.waitForFunction(() => !document.getElementById('lost').classList.contains('hidden'), null, { timeout: 15000 });
  const lostText = await landingPage.evaluate(() => document.getElementById('lost').innerText);
  ck(/didn’t open|didn't open/.test(lostText) && !/error|invalid|failed|404/i.test(lostText),
    'M9 an unknown token is a gentle sentence, never an error code', lostText.replace(/\n/g, ' · '));

  // the landing page talks ONLY to the platform it was configured for
  const offHost = landingRequests.filter((u) =>
    u.indexOf(BASE) !== 0 && u.indexOf('http://supa.local.test') !== 0);
  ck(offHost.length === 0, 'M10 the landing reaches its own host and the platform, nothing else', offHost.join(' | '));
  ck(landingErrors.length === 0, 'M11 zero page errors on the landing', landingErrors.join(' | '));

  await browser.close();
  server.kill();

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
