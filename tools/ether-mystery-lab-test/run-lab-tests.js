/* SPRINT — ETHER MYSTERY LAB (Decision 58's browser utility).
 *
 * The Lab is the research instrument; the Ether runtime remains the
 * product. This suite proves the instrument four ways:
 *
 *   S. statics — no key material committed, one prompt owner, one
 *      validator, the endpoint carries the gate and the bucket, the
 *      Lab page loads nothing that mounts the Ether
 *   F. the kit in Node — the real labKit over the real grammar, lens
 *      and pool: the privacy sweep (Stars refused BEFORE prompt
 *      assembly), the lens never bypassed, the lifecycle order
 *      (VALID ≠ APPROVED), honest source labels, real statistics,
 *      the export scan, and every experiment preset dry-run in
 *      fixture mode
 *   E. the endpoint — supabase/functions/lab-generate transpiled and
 *      driven with real Requests: unauthorized, non-admin, ping,
 *      no-key, a mocked provider (valid / error / malformed /
 *      unreachable), and never a word of provider error text out
 *   B. the browser — the real page on a real server: loading does
 *      nothing, fixture mode walks GENERATE → VALIDATE → QUALITY →
 *      HUMAN REVIEW → APPROVE → EXPORT, a typed key never lands in
 *      storage or an export, a smuggled constellation pattern is
 *      refused whole, LLM mode is proved against a stubbed provider
 *      and never silently falls back to fixtures
 *
 * Load-bearing checks proved by temporary reversion during the
 * sprint (each run red, then restored): the Stars boundary removed →
 * F3/F3b/B6/B6b red; the source label forged AT THE CONNECTION (the
 * label authority — forging it in the fixture generator is inert,
 * measured) → B4/B4c/B8/B10b red; the export approved-only filter
 * removed → F7 + B8 red.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/ether-mystery-lab-test/run-lab-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.ETHER_LAB_PORT || 8907);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}

let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// ===================================================================
// S. STATICS
// ===================================================================
function sectionS() {
  console.log('\n== S. statics ==');

  const labFiles = ['tools/ether-mystery-lab/index.html',
    'tools/ether-mystery-lab/labKit.js', 'tools/ether-mystery-lab/labConnection.js',
    'tools/ether-mystery-lab/labUi.js', 'tools/ether-mystery-lab/labConstellations.js',
    'tools/ether-mystery-lab/fixtures.js', 'tools/ether-mystery-lab/run-lab.js',
    'supabase/functions/lab-generate/index.ts'];

  // S1 — no key material anywhere committed. A real OpenAI key is
  // sk- followed by 20+ chars; nothing shaped like one may exist in
  // any Lab or function source.
  let keyHits = [];
  labFiles.forEach((f) => {
    const m = read(f).match(/sk-[A-Za-z0-9_]{20,}/g);
    if (m) keyHits.push(f + ':' + m.join(','));
  });
  ck(keyHits.length === 0, 'S1 no key material in committed sources', keyHits.join(' '));

  // S2 — the page is noindex (Decision 28's habit on top of robots).
  ck(/name="robots" content="noindex/.test(read('tools/ether-mystery-lab/index.html')),
    'S2 lab page carries noindex');

  // S3 — the Lab loads NOTHING that mounts the Ether. The script list
  // is read off the page and checked against the runtime files.
  const html = read('tools/ether-mystery-lab/index.html');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const forbidden = ['etherExperience', 'etherLife', 'etherRipple', 'etherDiscovery',
    'etherFeed', 'etherMystery', 'vihuplanetHome', 'magicCard.js', 'app.js',
    'etherHost', 'travellerTalk', 'companion'];
  const loaded = srcs.filter((s) => forbidden.some((f) => s.indexOf(f) !== -1));
  ck(loaded.length === 0, 'S3 no runtime-mounting Ether file is loaded', loaded.join(','));
  ck(srcs.some((s) => s.indexOf('etherGrammar') !== -1) &&
     srcs.some((s) => s.indexOf('etherCreationLens') !== -1) &&
     srcs.some((s) => s.indexOf('experience-pool') !== -1),
    'S3b the 0766 grammar, lens and pool ARE loaded (reused, not duplicated)');

  // S4 — one validator, one prompt owner. labKit calls the grammar's
  // validate and defines no second schema; the prompt text exists in
  // labKit alone.
  const kit = read('tools/ether-mystery-lab/labKit.js');
  ck(!/var\s+SCHEMA\s*=|var\s+GRAMMARS\s*=|function\s+validate\s*\(/.test(stripComments(kit)),
    'S4 labKit defines no second validator or schema');
  const promptMarker = 'You help design Ether experiences';
  const owners = labFiles.filter((f) => read(f).indexOf(promptMarker) !== -1);
  ck(owners.length === 1 && owners[0].indexOf('labKit') !== -1,
    'S4b one prompt owner (labKit.js)', owners.join(','));

  // S5 — the endpoint follows the repo's own security convention:
  // generated gate present and undrifted, the bucket in LIMITS in the
  // same commit, admin check, and the sync script knows the function.
  const fn = read('supabase/functions/lab-generate/index.ts');
  ck(fn.indexOf('BEGIN GENERATED edgeAuth') !== -1 && fn.indexOf('END GENERATED edgeAuth') !== -1,
    'S5 lab-generate carries the generated auth gate');
  ck(/['"]lab-generate['"]:\s*\{\s*max:/.test(read('supabase/functions/_shared/edgeAuth.js')),
    'S5b the lab-generate rate bucket is in the shared LIMITS canon');
  ck(fn.indexOf("bucket: 'lab-generate'") !== -1 && fn.indexOf('isPlatformAdmin') !== -1,
    'S5c the endpoint uses its bucket and the administrators-only gate');
  ck(read('tools/edge-auth-test/sync-shared.js').indexOf("'lab-generate'") !== -1,
    'S5d sync-shared.js lists lab-generate');
  const check = require('child_process').spawnSync('node',
    ['tools/edge-auth-test/sync-shared.js', '--check'], { cwd: ROOT, encoding: 'utf8' });
  ck(check.status === 0, 'S5e sync-shared --check is green (no drift)',
    (check.stdout || '').split('\n').filter((l) => l.indexOf('DRIFT') !== -1).join(','));

  // S6 — the endpoint never echoes provider output on a failure: the
  // only failure bodies are fixed one-word reasons.
  const bodyCalls = [...stripComments(fn).matchAll(/json\(\{\s*ok:\s*false[^}]*\}/g)].map((m) => m[0]);
  const leaky = bodyCalls.filter((b) => /detail|error:|body\.|\.text\(|\$\{/.test(b));
  ck(bodyCalls.length > 0 && leaky.length === 0,
    'S6 every failure body is a fixed reason, never provider text', leaky.join(' | '));

  // S7 — fixtures stay dual-environment: the Node consumers still
  // require() them.
  const fx = require(path.join(ROOT, 'tools/ether-mystery-lab/fixtures.js'));
  ck(Array.isArray(fx.valid) && Array.isArray(fx.adversarial),
    'S7 fixtures.js still serves the Node consumers');

  // S8 — the offline lab entry point still works.
  const lab = require('child_process').spawnSync('node',
    ['tools/ether-mystery-lab/run-lab.js', 'validate'], { cwd: ROOT, encoding: 'utf8' });
  ck(lab.status === 0, 'S8 the Node lab (run-lab.js) still exits green');

  // S9 — the shipped pool remains honestly labelled: no entry claims
  // 'generated' while no model has ever produced one through review.
  ck(!/source:\s*'generated'/.test(read('assets/ether/experience-pool.js')),
    'S9 the shipped pool holds no entry claiming a model made it');

  // S10 — the Lab's constellation projection is the REAL library:
  // extraction matches MagicCard.library() row for row, and carries
  // no pattern anywhere.
  const sb = { console };
  sb.window = sb;
  sb.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  sb.document = undefined;
  vm.runInNewContext(read('js/magicCard.js'), sb, { filename: 'magicCard.js' });
  const realLib = sb.MagicCard.library();
  const LC = require(path.join(ROOT, 'tools/ether-mystery-lab/labConstellations.js'));
  return LC.load({ sourceText: read('js/magicCard.js') }).then((res) => {
    ck(res.ok && res.sourceCount === realLib.length,
      'S10 extraction finds every family the product holds',
      res.sourceCount + ' vs ' + realLib.length);
    const byId = {};
    realLib.forEach((r) => { byId[r.id] = r; });
    const mismatch = res.families.filter((f) =>
      !byId[f.figure] || byId[f.figure].stars !== f.starCount ||
      byId[f.figure].name !== f.name);
    ck(mismatch.length === 0, 'S10b names and star counts match MagicCard.library() exactly',
      mismatch.map((m) => m.figure).join(','));
    const serial = JSON.stringify(res.families);
    ck(serial.toLowerCase().indexOf('"pattern"') === -1 &&
       !/\[\s*\d+\s*,\s*\d+\s*\]/.test(serial),
      'S10c the projection carries no cells and no pattern — families only, never an identity');
    ck(res.families.every((f) => f.suggestive === true && f.resemblanceAuthoredBy === 'lab'),
      'S10d resemblance is marked suggestive and lab-authored, never source metadata');
    ck(res.note.indexOf('88') !== -1,
      'S10e the 88-vs-reality discrepancy is stated, not papered over');
  });
}

// ===================================================================
// F. THE KIT IN NODE — real grammar, real lens, real pool.
// ===================================================================
function kitSandbox() {
  const sb = { console };
  sb.window = undefined;
  sb.global = sb;
  ['js/etherGrammar.js', 'js/etherCreationLens.js', 'assets/ether/experience-pool.js',
   'tools/ether-mystery-lab/labKit.js'].forEach((rel) => {
    vm.runInNewContext(read(rel), sb, { filename: rel });
  });
  return sb;
}

function sectionF() {
  console.log('\n== F. the kit in Node ==');
  const sb = kitSandbox();
  const K = sb.EtherMysteryLabKit;
  const G = sb.EtherGrammar;
  const pool = sb.EtherExperiencePool;
  const poolSigs = pool.experiences.filter((e) => e.status === 'active')
    .map((e) => G.signature(e.candidate));

  // F1 — the fixture bank: one candidate per grammar, all valid, and
  // none a reskin of the shipped pool.
  const bank = Object.keys(K.FIXTURE_BANK);
  ck(bank.length === Object.keys(G.GRAMMARS).length,
    'F1 the fixture bank covers every grammar', bank.length + '/' + Object.keys(G.GRAMMARS).length);
  const invalid = bank.filter((g) => !G.validate(K.FIXTURE_BANK[g], { existing: poolSigs }).ok);
  ck(invalid.length === 0, 'F1b every bank fixture validates against the real validator', invalid.join(','));

  // F2 — the lens is never bypassed: a full entity in, only creative
  // structure out.
  const entity = { id: 'e1', title: 'The Moon Dragon', cover: 'data-x', pages: 5, focusT: 0,
    source: { creatorName: 'vihaan', creatorUsername: 'moonmaker', cardId: 'card_123',
              companion: { id: 'leafy' }, publishedAt: '2026-01-01' } };
  const b = K.buildInput({ entities: [entity], grammar: 'compose', count: 5, pool });
  ck(b.ok, 'F2 a real entity builds through the lens');
  const serial = b.ok ? JSON.stringify(b.input) : '';
  ck(b.ok && ['vihaan', 'moonmaker', 'card_123', 'leafy', 'publishedAt', 'data-x', 'The Moon Dragon']
      .every((s) => serial.indexOf(s) === -1),
    'F2b nothing of the maker — name, username, card, companion, cover bytes, even the title — reaches the input');
  ck(b.ok && serial.indexOf('"hasCover":true') !== -1 && serial.indexOf('"pages":5') !== -1,
    'F2c what DOES travel is the lens structure: kind, page count, that a cover exists');

  // F3 — THE STARS BOUNDARY: a smuggled placed sky refuses the whole
  // build BEFORE any prompt assembly. Proved by reversion during the
  // sprint (starsSweep removed → red).
  const smuggled = K.buildInput({ entities: [{ id: 'e2', cover: 'x', pages: 1, focusT: 0,
    pattern: [[1, 2], [3, 4], [5, 6], [7, 8], [2, 9]] }] });
  ck(smuggled.ok === false && smuggled.refused &&
     smuggled.reasons.some((r) => r.indexOf('stars') === 0) && !smuggled.messages,
    'F3 a card-shaped pattern is refused whole, and no messages exist to send',
    (smuggled.reasons || []).join(','));
  const cellsOnly = K.buildInput({ entities: [{ id: 'e3', cover: 'x', pages: 1, focusT: 0,
    marks: [[0, 1], [2, 3], [4, 5]] }] });
  ck(cellsOnly.ok === false && cellsOnly.reasons.indexOf('stars-shaped-data:entities') !== -1,
    'F3b even an unnamed field carrying cell pairs is refused by shape');

  // F4 — the non-entity channels must arrive clean: a forbidden key
  // in one refuses the build.
  const dirty = K.buildInput({ constellations: [{ figure: 'leo', name: 'Leo',
    starCount: 7, email: 'kid@example.com' }] });
  ck(dirty.ok === false && dirty.reasons.some((r) => r.indexOf('forbidden-key') === 0),
    'F4 a forbidden key in an ingredient channel refuses the build whole');

  // F5 — the model's answer is untrusted data.
  ck(!K.parseCandidates('not json at all').ok, 'F5 malformed JSON is rejected, never repaired');
  const mixed = K.parseCandidates(JSON.stringify({ candidates: [{ id: 'a', grammar: 'notice' }, 'a string', 7] }));
  ck(mixed.candidates.length === 1 && mixed.dropped === 2,
    'F5b non-object entries are dropped and counted');

  // F6 — VALID ≠ APPROVED, and the order is enforced.
  const S = K.createSession({ pool });
  const gen = K.parseCandidates(K.fixtureGenerate({ count: 3 }).text);
  const items = gen.candidates.map((c) => S.add(c, { source: 'fixture' }));
  items.forEach((i) => { S.validate(i); S.quality(i); });
  ck(S.approve(items[0].labId).reason === 'not-human-reviewed',
    'F6 a valid candidate cannot be approved without a human review');
  S.review(items[0].labId, 'valid-but-boring', ['boring'], '');
  ck(S.approve(items[0].labId).reason === 'classification-not-approvable',
    'F6b "valid but boring" is a review, not an approval');
  S.review(items[1].labId, 'exceptional', [], 'lovely');
  ck(S.approve(items[1].labId).ok === true, 'F6c an exceptional review approves');
  const invalidItem = S.add({ id: 'bad!', grammar: 'nope' }, { source: 'fixture' });
  S.validate(invalidItem);
  S.review(invalidItem.labId, 'good', [], '');
  ck(S.approve(invalidItem.labId).reason !== undefined && !S.approve(invalidItem.labId).ok,
    'F6d an INVALID candidate can be reviewed (to learn from) and never approved');

  // F7 — the export: approved only, metadata preserved, and the scan
  // refuses key material. Proved by reversion (filter removed → red).
  const ex = S.exportApproved();
  ck(ex.ok && ex.count === 1 &&
     ex.artifact.entries[0].candidate.id === items[1].candidate.id &&
     ex.artifact.entries[0].source === 'fixture' &&
     ex.artifact.entries[0].generation.promptVersion === K.PROMPT_VERSION,
    'F7 export holds ONLY the approved candidate, with source and generation metadata');
  const S2 = K.createSession({ pool });
  const poisoned = JSON.parse(JSON.stringify(K.FIXTURE_BANK.notice));
  poisoned.id = 'poisoned-fixture';
  poisoned.title = 'a light that hums quietly near sk-ABCDEF1234567890';
  const pItem = S2.add(poisoned, { source: 'fixture' });
  S2.validate(pItem); S2.quality(pItem);
  S2.review(pItem.labId, 'good', [], '');
  S2.approve(pItem.labId);
  const pEx = S2.exportApproved();
  ck(pEx.ok === false && pEx.refused,
    'F7b an export carrying key-shaped material is refused, never written', (pEx.reasons || []).join(','));

  // F8 — statistics are real percentages over actually reviewed
  // candidates, never invented.
  const st = S.stats();
  ck(st.reviewed === 3 && st.rejectionReasons.boring &&
     st.rejectionReasons.boring.pctOfReviewed === Math.round(100 / 3),
    'F8 rejection percentages are computed from the reviewed set', JSON.stringify(st.rejectionReasons));

  // F9 — reskin detection (§13's measure).
  const twin = JSON.parse(JSON.stringify(K.FIXTURE_BANK.connect));
  twin.id = 'same-thing-new-words';
  twin.title = 'utterly different adjectives';
  const rr = K.reskinReport([K.FIXTURE_BANK.connect, twin, K.FIXTURE_BANK.trace]);
  ck(!rr.materiallyDifferent && rr.reskinGroups.length === 1,
    'F9 same-activity-different-adjectives is caught as a reskin');

  // F10 — every experiment preset (§13–18) exists and dry-runs in
  // fixture mode through the identical pipeline.
  const presets = Object.keys(K.EXPERIMENTS);
  ck(presets.length === 6, 'F10 six critical experiments exist', presets.join(','));
  let presetTrouble = [];
  presets.forEach((id) => {
    const e = K.EXPERIMENTS[id];
    const built = K.buildInput({
      structures: e.needsCreation ? [{ kind: 'story', pages: 5, hasCover: true }] : [],
      constellations: e.constellations === 'all'
        ? [{ figure: 'leo', name: 'Leo', starCount: 7, looksLike: 'creature', about: 'The Lion.' }] : [],
      grammar: 'compose', count: e.count, emphasis: e.emphasis, pool
    });
    if (!built.ok) { presetTrouble.push(id + ':build'); return; }
    const fx2 = K.fixtureGenerate({ count: e.count, grammars: e.grammars });
    const parsed = K.parseCandidates(fx2.text);
    if (!parsed.ok) { presetTrouble.push(id + ':parse'); return; }
    const bad = parsed.candidates.filter((c) => !G.validate(c, { existing: poolSigs }).ok);
    if (bad.length) presetTrouble.push(id + ':' + bad.length + '-invalid');
  });
  ck(presetTrouble.length === 0, 'F10b every preset dry-runs green in fixture mode', presetTrouble.join(' '));

  // F10c — §13's own measure on the same-creation preset: four
  // grammars, four materially different experiences, no bespoke code.
  const sc = K.EXPERIMENTS['same-creation'];
  const scGen = K.parseCandidates(K.fixtureGenerate({ count: 4, grammars: sc.grammars }).text);
  const scRR = K.reskinReport(scGen.candidates);
  const scGrammars = new Set(scGen.candidates.map((c) => c.grammar));
  ck(scRR.materiallyDifferent && scGrammars.size === 4,
    'F10c same creation × four grammars → four materially different experiences');

  // F11 — the quality layer: eleven dimensions, honestly labelled a
  // heuristic, and the mystery dimension reads structure.
  const q = K.evaluate(K.FIXTURE_BANK.notice, { poolSignatures: poolSigs });
  ck(Object.keys(q.scores).length === 11 && q.heuristic === true,
    'F11 eleven creative dimensions, labelled heuristic');
  ck(q.scores.mystery.score >= 2,
    'F11b an unresolved-only candidate scores as carrying real mystery');

  // F12 — generation is demand-aware: the contract carries the live
  // pool's own signatures and grammar spread.
  ck(b.input.contract.pool.signatures.length === poolSigs.length,
    'F12 the contract carries the approved pool state');
}

// ===================================================================
// E. THE ENDPOINT — transpiled, driven with real Requests.
// ===================================================================
async function sectionE() {
  console.log('\n== E. the endpoint ==');
  const ts = require('typescript');
  const js = ts.transpileModule(read('supabase/functions/lab-generate/index.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', 'Deno', 'fetch', js);
  fn(mod.exports, require, mod, undefined, undefined);
  const makeHandler = mod.exports.makeHandler;
  ck(typeof makeHandler === 'function', 'E0 the deployed artifact exports its handler');

  const ENV = {
    SUPABASE_URL: 'https://x.local',
    SUPABASE_SERVICE_ROLE_KEY: 'svc-key',
    SUPABASE_ANON_KEY: 'anon-key'
  };
  function envWith(extra) {
    const table = Object.assign({}, ENV, extra || {});
    return (n) => table[n] || '';
  }
  let providerCalls = [];
  function mockFetch(behaviour) {
    providerCalls = [];
    return async (url, init) => {
      const u = String(url);
      if (u.indexOf('/auth/v1/user') !== -1) {
        const tok = (init.headers.Authorization || '').replace('Bearer ', '');
        if (tok === 'admin-token') return jsonRes({ id: 'u-admin', email: 'admin@x' });
        if (tok === 'user-token') return jsonRes({ id: 'u-plain', email: 'plain@x' });
        return jsonRes({}, 401);
      }
      if (u.indexOf('/rest/v1/rpc/edge_rate_limit_hit') !== -1) {
        return jsonRes({ allowed: true, remaining: 5, retry_after: 0 });
      }
      if (u.indexOf('/rest/v1/platform_admins') !== -1) {
        return jsonRes([{ email: 'admin@x' }]);
      }
      if (u.indexOf('api.openai.com') !== -1) {
        providerCalls.push({ url: u, init });
        if (behaviour === 'ok') {
          return jsonRes({ choices: [{ message: { content: JSON.stringify({ candidates: [] }) } }] });
        }
        if (behaviour === 'error') {
          return jsonRes({ error: { message: 'SECRET-PROVIDER-DETAIL org_abc quota' } }, 500);
        }
        if (behaviour === 'malformed') {
          return new Response('<<<not json>>>', { status: 200 });
        }
        throw new Error('unreachable');
      }
      throw new Error('unexpected fetch ' + u);
    };
  }
  function jsonRes(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  function reqFor(token, payload) {
    return new Request('https://fn.local/lab-generate', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(payload || {})
    });
  }
  const MSGS = [{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }];

  async function drive(token, payload, extraEnv, behaviour) {
    const h = makeHandler({ env: envWith(extraEnv), fetchImpl: mockFetch(behaviour || 'ok') });
    const res = await h(reqFor(token, payload));
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  // E1 — no session → 401; the anon key alone → 401.
  let r = await drive(null, { action: 'ping' });
  ck(r.status === 401, 'E1 no session is refused 401');
  r = await drive('anon-key', { action: 'ping' });
  ck(r.status === 401, 'E1b the public anon key alone is refused 401');

  // E2 — a real session that is not an administrator → 403.
  r = await drive('user-token', { action: 'ping' });
  ck(r.status === 403 && r.body.reason === 'forbidden',
    'E2 a non-admin session is 403 — this can never be a public LLM');

  // E3 — admin ping: build, and whether a key is configured.
  r = await drive('admin-token', { action: 'ping' });
  ck(r.status === 200 && r.body.ok && r.body.build === 'LAB1' && r.body.provider === 'none',
    'E3 admin ping reports the build and an unconfigured provider');
  r = await drive('admin-token', { action: 'ping' }, { OPENAI_API_KEY: 'sk-test' });
  ck(r.body.provider === 'configured' && JSON.stringify(r.body).indexOf('sk-test') === -1,
    'E3b a configured key is reported as a word, never echoed');

  // E4 — generate without a key is a handled state.
  r = await drive('admin-token', { action: 'generate', messages: MSGS });
  ck(r.status === 200 && r.body.reason === 'not-configured',
    'E4 no key → 200 {ok:false, not-configured}');

  // E5 — a valid provider answer passes the text through.
  r = await drive('admin-token', { action: 'generate', messages: MSGS },
    { OPENAI_API_KEY: 'sk-test' }, 'ok');
  ck(r.body.ok === true && typeof r.body.text === 'string' && providerCalls.length === 1,
    'E5 a valid provider answer returns its structured text (one call, no retry)');
  const sent = JSON.parse(providerCalls[0].init.body);
  ck(sent.response_format && sent.response_format.type === 'json_object',
    'E5b structured output is demanded of the provider');

  // E6 — provider failure: one word out, not one provider word.
  r = await drive('admin-token', { action: 'generate', messages: MSGS },
    { OPENAI_API_KEY: 'sk-test' }, 'error');
  ck(r.body.ok === false && r.body.reason === 'unavailable' &&
     JSON.stringify(r.body).indexOf('SECRET-PROVIDER-DETAIL') === -1 &&
     JSON.stringify(r.body).indexOf('sk-test') === -1,
    'E6 a provider error leaves as "unavailable" — no provider text, no key');
  r = await drive('admin-token', { action: 'generate', messages: MSGS },
    { OPENAI_API_KEY: 'sk-test' }, 'malformed');
  ck(r.body.reason === 'malformed', 'E6b malformed provider output is refused');
  r = await drive('admin-token', { action: 'generate', messages: MSGS },
    { OPENAI_API_KEY: 'sk-test' }, 'throw');
  ck(r.body.reason === 'unavailable', 'E6c an unreachable provider is "unavailable"');

  // E7 — shape bounds.
  r = await drive('admin-token', { action: 'generate', messages: [] }, { OPENAI_API_KEY: 'sk-test' });
  ck(r.body.reason === 'bad-messages', 'E7 an empty message list is refused');
  r = await drive('admin-token', {
    action: 'generate',
    messages: [{ role: 'tool', content: 'x' }]
  }, { OPENAI_API_KEY: 'sk-test' });
  ck(r.body.reason === 'bad-messages', 'E7b an unknown role is refused');
  r = await drive('admin-token', { action: 'whatever' }, { OPENAI_API_KEY: 'sk-test' });
  ck(r.body.reason === 'unknown-action', 'E7c an unknown action is refused');
}

// ===================================================================
// B. THE BROWSER — the real page on a real server.
// ===================================================================
async function sectionB() {
  console.log('\n== B. the browser ==');
  const { chromium } = require('playwright');

  // The suite OWNS its port and verifies the served tree is this tree
  // (the concurrent-worktree lesson, recorded twice in CLAUDE.md).
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  try {
    const served = await (await fetch(BASE + '/version.txt')).text();
    const local = read('version.txt');
    ck(served.trim() === local.trim(), 'B0 the served tree IS this tree', served.trim() + ' vs ' + local.trim());
  } catch (e) { fail('B0 the served tree IS this tree', String(e)); }

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  const requests = [];
  page.on('request', (r) => requests.push({ method: r.method(), url: r.url() }));

  // Stub the provider host BEFORE anything could reach it — nothing
  // should on load, and B2 measures that.
  let providerHits = 0;
  let providerBehaviour = 'ok';
  await page.route('https://api.openai.com/**', (route) => {
    providerHits++;
    if (providerBehaviour === 'never') return; // hang — for the cancel test
    if (providerBehaviour === 'error') {
      // The shape of a REAL refusal, taken from the one that was
      // reported: a status, a structured code that names the fault, and
      // free-text prose carrying a project identifier. One response
      // proves both halves — the code must reach the page, the prose
      // must not.
      return route.fulfill({ status: 403, contentType: 'application/json',
        body: JSON.stringify({ error: {
          message: 'Project `proj_SECRET-DETAIL` does not have access to model `x`',
          code: 'model_not_found', type: 'invalid_request_error' } }) });
    }
    if (providerBehaviour === 'malformed') {
      // A well-formed provider envelope whose MODEL TEXT is not JSON —
      // the parse layer's problem, not the transport's.
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'once upon a time, no JSON' } }] }) });
    }
    if (route.request().url().indexOf('/models') !== -1) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' });
    }
    const kit = fs.readFileSync(path.join(ROOT, 'tools/ether-mystery-lab/labKit.js'), 'utf8');
    // A plausible model answer: one schema-valid candidate. Built here
    // by hand (not from the bank) so 'generated' provably means "came
    // over the wire", never "a fixture relabelled".
    const cand = {
      id: 'model-made-notice', grammar: 'notice',
      title: 'a corner of the sky, breathing differently',
      elements: [{ role: 'shimmer', show: 'mark', place: 'far' }],
      engage: [{ action: 'dwell', on: 'shimmer', seconds: 4 }],
      behaviour: { onEngage: 'dissolve', pace: 'still' },
      outcome: { possible: ['unresolved'] }
    };
    void kit;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: [cand] }) } }] })
    });
  });

  await page.goto(BASE + '/tools/ether-mystery-lab/index.html');
  await page.waitForTimeout(1400);

  // B1 — the page loads clean and says what it is.
  ck(pageErrors.length === 0, 'B1 zero page errors', pageErrors.join(' | '));
  const status0 = await page.textContent('#labStatus');
  ck(status0.indexOf('FIXTURE MODE') === 0 && status0.indexOf('REAL LLM NOT CONNECTED') !== -1,
    'B1b the status says FIXTURE MODE — REAL LLM NOT CONNECTED');

  // B2 — loading the Lab does NOTHING: no provider call, no POST, no
  // request off this host, no storage write, no Ether.
  const offHost = requests.filter((r) => r.url.indexOf('127.0.0.1') === -1);
  const posts = requests.filter((r) => r.method === 'POST');
  ck(offHost.length === 0 && posts.length === 0 && providerHits === 0,
    'B2 load makes no off-host request, no POST, no model call',
    offHost.map((r) => r.url).join(','));
  const idle = await page.evaluate(() => ({
    ls: localStorage.length, ss: sessionStorage.length,
    ether: typeof window.EtherLife !== 'undefined' || typeof window.EtherExperience !== 'undefined' ||
           typeof window.VihuPlanet !== 'undefined' || typeof window.EtherMystery !== 'undefined',
    canvases: document.querySelectorAll('canvas').length
  }));
  ck(idle.ls === 0 && idle.ss === 0, 'B2b loading writes no browser storage');
  ck(!idle.ether && idle.canvases === 0, 'B2c no Ether runtime exists on this page — nothing mounted, nothing animated');

  // B3 — the real vocabulary arrived: 18 families, the beings, and
  // not one coordinate pair anywhere on the page.
  const figures = await page.locator('#figureChips label').count();
  ck(figures === 18, 'B3 the project\'s real 18 constellation families are offered', String(figures));
  const creatures = await page.locator('#creatureChips label').count();
  ck(creatures === 3, 'B3b the three Ether beings are offered from their own registry');
  const bodyText = await page.evaluate(() => document.body.innerText);
  ck(!/\[\s*\d+\s*,\s*\d+\s*\]/.test(bodyText), 'B3c no cell coordinates anywhere a developer could copy');

  // B4 — FIXTURE MODE walks the whole pipeline.
  await page.selectOption('#creationSelect', 'fixture-0');
  await page.click('#generateBtn');
  await page.waitForTimeout(600);
  const genState = await page.textContent('#genState');
  ck(genState.indexOf('source: fixture') !== -1, 'B4 fixture generation says its source out loud');
  const cands = await page.locator('.cand').count();
  ck(cands === 5, 'B4b five candidates arrived', String(cands));
  const fixtureBadges = await page.locator('.cand .badge.fixture').count();
  ck(fixtureBadges === 5, 'B4c every candidate is badged FIXTURE — never mislabelled');
  ck(providerHits === 0, 'B4d fixture mode reached no provider');

  // B5 — the §7 diagnostic shows the privacy boundary working.
  const diag = await page.textContent('#diagnostic');
  ck(diag.indexOf('"hasCover": true') !== -1 || diag.indexOf('"hasCover":true') !== -1,
    'B5 the diagnostic shows the lens projection travelling');
  ck(diag.indexOf('boundaries') !== -1 && diag.indexOf('grammars') !== -1,
    'B5b the contract (grammars + boundaries) travels with it');

  // B6 — a pasted entity smuggling a placed sky is REFUSED WHOLE,
  // before any prompt assembly, with nothing sent anywhere.
  const before = await page.locator('.cand').count();
  const reqCountBefore = requests.length;
  await page.click('#ingredientsPanel details summary');
  await page.fill('#creationPaste', JSON.stringify({
    id: 'x', cover: 'c', pages: 2, focusT: 0,
    pattern: [[1, 2], [3, 4], [5, 6], [7, 8], [9, 1]]
  }));
  await page.click('#creationPasteBtn');
  await page.click('#generateBtn');
  await page.waitForTimeout(400);
  const refusedDiag = await page.textContent('#diagnostic');
  ck(refusedDiag.indexOf('REFUSED') === 0 && refusedDiag.indexOf('stars') !== -1,
    'B6 the smuggled sky is refused whole and the diagnostic names the boundary');
  ck((await page.locator('.cand').count()) === before,
    'B6b no candidate was added from a refused build');
  ck(requests.length === reqCountBefore && providerHits === 0,
    'B6c and NOTHING was sent — refused before any prompt assembly');
  await page.fill('#creationPaste', '');
  await page.click('#creationPasteBtn');

  // B7 — human review: classify, approve, real statistics.
  await page.locator('.cand').first().locator('button[data-classify="exceptional"]').click();
  await page.waitForTimeout(150);
  ck((await page.locator('.cand').first().getAttribute('data-state')) === 'approved',
    'B7 an exceptional review approves');
  const second = page.locator('.cand').nth(1);
  await second.locator('input[data-reason="too-game-like"]').check();
  await second.locator('input[data-reason="boring"]').check();
  await second.locator('button[data-classify="reject"]').click();
  await page.waitForTimeout(150);
  const stats = JSON.parse(await page.textContent('#stats'));
  ck(stats.reviewed === 2 && stats.rejectionReasons['too-game-like'] &&
     stats.rejectionReasons['too-game-like'].pctOfReviewed === 50,
    'B7b the rejection percentages are real, from the reviewed set');

  // B8 — export: approved only, honestly sourced, nothing private.
  const dlPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.click('#exportBtn');
  await dlPromise;
  const artifact = await page.evaluate(() => window.__lastLabExport || null);
  ck(artifact && artifact.entries.length === 1 && artifact.entries[0].source === 'fixture' &&
     artifact.format === 'ether-experience-pool-entries',
    'B8 the export holds only the approved candidate, source preserved');
  const artSerial = JSON.stringify(artifact || {});
  ck(!/sk-[A-Za-z0-9]{8,}/.test(artSerial) && artSerial.indexOf('directKey') === -1,
    'B8b no key material in the export');

  // B9 — DIRECT MODE: the typed key lives in memory only.
  await page.check('#modeDirect');
  const warn = await page.textContent('#directFields .warn');
  ck(warn.indexOf('DEVELOPMENT ONLY') !== -1, 'B9 the direct mode warning is explicit and red');
  const TESTKEY = 'sk-LABTESTKEY12345678901234';
  await page.fill('#directKey', TESTKEY);
  await page.waitForTimeout(100);
  const status1 = await page.textContent('#labStatus');
  ck(status1.indexOf('NOT TESTED') !== -1, 'B9b configured-but-untested says so — never "connected" untried');
  await page.click('#testBtn');
  await page.waitForTimeout(600);
  ck((await page.textContent('#labStatus')).indexOf('LLM CONNECTED') === 0,
    'B9c a probe that answers turns the status to LLM CONNECTED');
  const keyLeak = await page.evaluate((k) => {
    const stores = [];
    for (let i = 0; i < localStorage.length; i++) stores.push(localStorage.getItem(localStorage.key(i)));
    for (let i = 0; i < sessionStorage.length; i++) stores.push(sessionStorage.getItem(sessionStorage.key(i)));
    return stores.join('|').indexOf(k) !== -1 || document.cookie.indexOf(k) !== -1;
  }, TESTKEY);
  ck(!keyLeak, 'B9d the typed key is in NO storage and NO cookie');

  // B10 — LLM MODE with a stubbed provider: the same pipeline, the
  // honest 'generated' label, and no silent fixture fallback.
  providerBehaviour = 'ok';
  const candsBefore = await page.locator('.cand').count();
  await page.click('#generateBtn');
  await page.waitForTimeout(800);
  ck(providerHits > 0, 'B10 generate in direct mode actually asked the (stubbed) provider');
  const genBadges = await page.locator('.cand .badge.generated').count();
  ck(genBadges === 1, 'B10b the model candidate is badged GENERATED — the label follows the transport');
  const gen2 = await page.textContent('#genState');
  ck(gen2.indexOf('source: generated') !== -1, 'B10c and the state line says so');

  // B11 — provider failure NEVER silently becomes fixtures.
  providerBehaviour = 'error';
  const beforeFail = await page.locator('.cand').count();
  await page.click('#generateBtn');
  await page.waitForTimeout(700);
  const failState = await page.textContent('#genState');
  ck(failState.indexOf('failed') === 0 && failState.indexOf('nothing substituted') !== -1,
    'B11 a failed real generation FAILS on screen and substitutes nothing');
  ck((await page.locator('.cand').count()) === beforeFail,
    'B11b no candidate appeared from the failure');
  ck(failState.indexOf('SECRET-DETAIL') === -1, 'B11c no provider error text reaches the page');
  ck(failState.indexOf('model_not_found') !== -1,
    'B11e the provider\'s structured error code IS surfaced — a bare status number is not a diagnosis',
    failState);
  providerBehaviour = 'malformed';
  await page.click('#generateBtn');
  await page.waitForTimeout(700);
  ck((await page.textContent('#genState')).indexOf('rejected: malformed-json') !== -1,
    'B11d malformed model output is rejected, not repaired');

  // B12 — cancellation: a hung provider is the developer's to cancel.
  providerBehaviour = 'never';
  await page.click('#generateBtn');
  await page.waitForTimeout(300);
  ck(!(await page.locator('#cancelBtn').isDisabled()), 'B12 a running generation offers Cancel');
  await page.click('#cancelBtn');
  await page.waitForTimeout(300);
  ck((await page.textContent('#genState')) === 'cancelled' &&
     !(await page.locator('#generateBtn').isDisabled()),
    'B12b cancel returns the Lab to the developer');
  providerBehaviour = 'ok';

  // B13 — disconnect clears everything and returns to fixture mode.
  await page.click('#disconnectBtn');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    holds: window.LabConnection._holdsDirectKey(),
    field: document.getElementById('directKey').value,
    status: document.getElementById('labStatus').textContent
  }));
  ck(!after.holds && after.field === '' && after.status.indexOf('FIXTURE MODE') === 0,
    'B13 disconnect clears the key, the field, and the mode');

  // B14 — ENDPOINT MODE against a stubbed lab-generate.
  let endpointHits = 0;
  await page.route('https://fn.local/lab-generate', (route) => {
    endpointHits++;
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.action === 'ping') {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, build: 'LAB1', provider: 'configured', model: 'gpt-4o-mini' }) });
    }
    const cand = {
      id: 'endpoint-made-echo', grammar: 'echo',
      title: 'a stir where a story once rested',
      ingredients: { anchor: true },
      elements: [{ role: 'stir', show: 'mark', place: 'at-anchor' }],
      engage: [{ action: 'dwell', on: 'stir', seconds: 3 }],
      behaviour: { onEngage: 'dissolve', pace: 'still' },
      outcome: { possible: ['unresolved'] }
    };
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, model: 'gpt-4o-mini', build: 'LAB1',
        text: JSON.stringify({ candidates: [cand] }) }) });
  });
  await page.check('#modeEndpoint');
  await page.fill('#endpointUrl', 'https://fn.local/lab-generate');
  await page.fill('#endpointToken', 'admin-session-token');
  await page.click('#testBtn');
  await page.waitForTimeout(500);
  ck((await page.textContent('#labStatus')).indexOf('LLM CONNECTED (endpoint)') === 0,
    'B14 the endpoint ping connects the status line');
  await page.click('#generateBtn');
  await page.waitForTimeout(600);
  ck(endpointHits >= 2 && (await page.textContent('#genState')).indexOf('source: generated') !== -1,
    'B14b endpoint generation lands as generated through the same pipeline');

  // B15 — the presets are one click, and the same-creation experiment
  // reads out its own measure.
  await page.check('#modeFixture');
  await page.selectOption('#creationSelect', 'fixture-0');
  await page.click('.lab-preset[data-preset="same-creation"]');
  await page.click('#generateBtn');
  await page.waitForTimeout(600);
  const rr = await page.textContent('#reskinReport');
  ck(rr.indexOf('materially different') !== -1 || rr.indexOf('RESKINS PRESENT') !== -1,
    'B15 the reskin measure is on screen after a preset run', rr.slice(0, 60));

  await browser.close();
  server.kill();
}

// ===================================================================
// P. THE PREVIEW — ▶ PLAY IN ETHER.
//
// The creative review surface. A reviewer must be able to decide
// whether a Mystery is magical without reading its JSON, and the
// preview must be the REAL Ether — the real universe, the real
// providers, the real interpreter — rather than a picture of one.
//
// P1  statics: no second engine, no second renderer, no network
// P2  the support matrix, in Node, over the shipped pool and the
//     Lab's own fixtures — valid is not the same as previewable
// P3  loading the Lab still does nothing
// P4  PLAY opens the real Ether and the candidate is POSED
// P5  determinism: same candidate + same seed → the same sky
// P6  the candidate enters through the existing interpreter/provider
//     path, and a real tap engages through the existing touch chain
// P7  exit is clean, and the demonstration comes home
// P8  an unsupported capability can never become a fake experience
// P9  the preview writes no production state and calls no model
// ===================================================================
async function sectionP() {
  console.log('\n== P. the preview ==');
  const { chromium } = require('playwright');
  const Support = require('../ether-mystery-lab/labPreviewSupport.js');

  // ---------- P1: statics ----------
  const prev = stripComments(read('tools/ether-mystery-lab/labPreview.js'));
  const host = stripComments(read('tools/ether-mystery-lab/labPreviewHost.js'));
  const sup = stripComments(read('tools/ether-mystery-lab/labPreviewSupport.js'));
  const previewHtml = read('tools/ether-mystery-lab/preview.html');

  // NOT A SECOND ENGINE. The preview may not interpret a candidate, so
  // it must not read the fields only the interpreter reads.
  ck(!/\belements\s*\.\s*forEach|\bplacePoints|\bcoverRegions|drawImage|getContext/.test(prev),
    'P1  the preview draws nothing and places nothing — no second renderer');
  ck(prev.indexOf('EtherMystery.mount') !== -1 && prev.indexOf('.begin(') !== -1 &&
     prev.indexOf('.candidates()') !== -1,
    'P1b the candidate enters through the REAL interpreter seam');
  ck(!/fetch\s*\(|XMLHttpRequest|WebSocket|api\.openai|navigator\.sendBeacon/.test(prev + host + sup),
    'P1c no network call of any kind exists in the preview layer');
  ck(!/localStorage|indexedDB/.test(prev + host + sup),
    'P1d no persistent storage in the preview layer');
  // The one storage key it DOES touch is the runtime's own session
  // seed, set deliberately so a replay is a replay. Named, so nobody
  // can add a second one quietly.
  const ss = prev.match(/sessionStorage\.[a-zA-Z]+\(([^)]*)\)/g) || [];
  ck(ss.length > 0 && ss.every((c) => c.indexOf('vp-runtime-seed') !== -1),
    'P1e every storage call names ONE key — the runtime\'s own seed', ss.join(' '));
  // Decision 9: the protected runtime files never learn the Lab exists.
  const PROTECTED = ['vihuplanet/runtime/physics/physics.js',
    'vihuplanet/runtime/stories/storyManager.js',
    'vihuplanet/runtime/ether/etherRenderer.js',
    'vihuplanet/runtime/core/universe.js',
    'vihuplanet/runtime/ambient/ambientSystem.js'];
  const leaked = PROTECTED.filter((f) => /LabPreview|ether-mystery-lab|tools\//.test(read(f)));
  ck(leaked.length === 0, 'P1f the protected runtime files name nothing of the Lab', leaked.join(','));
  // The production pool is not merely left alone — it is out of reach.
  ck(previewHtml.indexOf('experience-pool.js') === -1,
    'P1g the preview document never loads the production pool');
  ck(previewHtml.indexOf('js/etherMystery.js') !== -1 &&
     previewHtml.indexOf('js/etherLife.js') !== -1 &&
     previewHtml.indexOf('js/etherRipple.js') !== -1 &&
     previewHtml.indexOf('runtime/core/universe.js') !== -1,
    'P1h it loads the REAL runtime and the REAL providers');
  ck(previewHtml.indexOf('noindex') !== -1, 'P1i the preview page is noindex');
  // No instruction over the sky: the whole point is whether the
  // Mystery explains itself.
  ck(!/STEP\s*1|Click this|click here|COMPLETE THE|objective|CHALLENGE:/i.test(previewHtml),
    'P1j nothing on the sky instructs the reviewer');

  // ---------- P2: the honest support matrix ----------
  const poolSrc = read('assets/ether/experience-pool.js');
  const poolSandbox = { window: {} };
  require('vm').createContext(poolSandbox);
  require('vm').runInContext(poolSrc, poolSandbox);
  const entries = poolSandbox.window.EtherExperiencePool.experiences;
  const activeUnsupported = entries.filter((e) => e.status === 'active' &&
    !Support.support(e.candidate).ok);
  ck(activeUnsupported.length === 0,
    'P2  every ACTIVE shipped experience can be previewed',
    activeUnsupported.map((e) => e.candidate.id).join(','));
  // And the retired one cannot — which is the rule catching the very
  // entry the runtime has no branch for.
  const retired = entries.filter((e) => e.status !== 'active')[0];
  ck(retired && !Support.support(retired.candidate).ok &&
     Support.support(retired.candidate).reasons.indexOf('onEngage:brighten') !== -1,
    'P2b the retired entry is refused by name, for the capability it names');
  // REPRESENTED is written down; it must never claim something the
  // interpreter has no branch for.
  const interp = stripComments(read('js/etherMystery.js'));
  const missing = Support.REPRESENTED.responses.filter((r) => interp.indexOf("'" + r + "'") === -1);
  ck(missing.length === 0,
    'P2c every response the table claims has a branch in the interpreter', missing.join(','));
  ck(interp.indexOf("'brighten'") === -1,
    'P2d and the one it does NOT claim is genuinely absent there');
  // A capability outside the table refuses, whatever else is right.
  const fx = require('../ether-mystery-lab/fixtures.js');
  const brighten = fx.valid.filter((f) => (f.candidate.behaviour || {}).onEngage === 'brighten')[0];
  ck(brighten && !Support.support(brighten.candidate).ok,
    'P2e a valid candidate naming an unperformable response is not previewable');
  const glintResidue = fx.valid.filter((f) =>
    ((f.candidate.outcome || {}).residue || {}).show === 'glint')[0];
  ck(glintResidue && Support.support(glintResidue.candidate).reasons.indexOf('residue:glint') !== -1,
    'P2f a residue the runtime always draws as a mark is named, not approximated');
  // Plain language: no schema word, no grammar id, no capability name.
  const plain = Support.plain(entries[0].candidate);
  const words = [plain.mystery, plain.action, plain.discovery, plain.next].join(' ');
  ck(!/grammar|reconstruct|shard|glint|onEngage|ingredient|candidate|schema|residue|near-look|creation-revealed/i
      .test(words),
    'P2g the plain description carries no schema, grammar or capability word', words.slice(0, 90));
  ck(plain.mystery && plain.action && plain.discovery && plain.next,
    'P2h all four facets are said in plain language');
  // A MYSTERY WITH NOTHING TO DO ENDS ON ITS FIRST FRAME — the
  // runtime's own resolveDone(), measured in the preview. It is
  // performable, so it is not refused; the reviewer is warned, because
  // a preview that appears and goes reads as a broken preview.
  const nothingToDo = {
    id: 'only-to-be-noticed', grammar: 'notice',
    title: 'a small light nobody has to do anything about',
    elements: [{ role: 'light', show: 'glint', place: 'near-look' }],
    behaviour: { pace: 'still' },
    outcome: { possible: ['unresolved'] },
    constraints: { rarity: 'common', lifeS: 60, phases: ['exploration'] }
  };
  const ntd = Support.support(nothingToDo);
  ck(ntd.ok && ntd.notes.some((n) => /nothing here for a child to do/.test(n)),
    'P2i a mystery with nothing to do is previewable, and the reviewer is warned',
    ntd.notes.join(' ').slice(0, 60));

  // ---------- the browser ----------
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  try {
    const served = await (await fetch(BASE + '/tools/ether-mystery-lab/labPreview.js')).text();
    ck(served === read('tools/ether-mystery-lab/labPreview.js'),
      'P3  the served tree IS this tree');
  } catch (e) { fail('P3  the served tree IS this tree', String(e)); }

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  let modelHits = 0;
  await page.route('https://api.openai.com/**', (r) => { modelHits++; r.abort(); });
  const reqs = [];
  page.on('request', (r) => reqs.push({ method: r.method(), url: r.url() }));

  await page.goto(BASE + '/tools/ether-mystery-lab/index.html');
  await page.waitForTimeout(1200);
  const idle = await page.evaluate(() => ({
    frames: document.querySelectorAll('[data-lab-preview]').length,
    universes: document.querySelectorAll('.vp-universe').length,
    ether: typeof window.VihuPlanet !== 'undefined' || typeof window.EtherMystery !== 'undefined',
    ss: sessionStorage.length, ls: localStorage.length
  }));
  ck(idle.frames === 0 && idle.universes === 0 && !idle.ether &&
     idle.ss === 0 && idle.ls === 0,
    'P3b loading the Lab still does nothing — no frame, no Ether, no storage');

  await page.selectOption('#creationSelect', 'fixture-0');
  await page.click('#generateBtn');
  await page.waitForTimeout(700);

  // ---------- P4: PLAY opens the real Ether ----------
  const cards = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('.cand'), (c) => ({
      play: !!c.querySelector('button[data-play]'),
      unavail: !!c.querySelector('.unavail'),
      plain: !!c.querySelector('.plain'),
      techFolded: !!c.querySelector('details.tech') && !c.querySelector('details.tech').open
    })));
  ck(cards.length > 0 && cards.every((c) => c.plain && c.techFolded),
    'P4  every card leads with plain language and folds its technical details away');
  ck(cards.some((c) => c.play), 'P4b at least one candidate offers PLAY IN ETHER');

  const playIdx = cards.findIndex((c) => c.play);
  await page.locator('.cand').nth(playIdx).locator('button[data-play]').click();
  await page.waitForTimeout(2600);
  const frame = page.frames().find((f) => f.url().indexOf('preview.html') !== -1);
  ck(!!frame, 'P4c PLAY opens the preview in its own document');
  const world = frame ? await frame.evaluate(() => {
    const inst = window.LabPreview.instrument();
    return {
      universe: document.querySelectorAll('.vp-universe').length,
      stage: document.querySelectorAll('canvas.vp-ether-mystery').length,
      spirits: window.LabPreview.stories().length,
      posed: !!inst, elements: inst ? inst.elements.length : 0,
      chrome: !document.querySelector('[data-chrome]').hidden,
      unavailable: document.querySelector('[data-unavailable]').classList.contains('on')
    };
  }) : {};
  ck(world.universe === 1 && world.spirits === 3,
    'P4d the real universe is built, with real creations in it',
    JSON.stringify(world));
  ck(world.posed && world.elements >= 1 && world.stage === 1,
    'P4e the candidate is POSED on the interpreter\'s own stage');
  ck(world.chrome && !world.unavailable,
    'P4f Replay and Exit are the only chrome over the sky');
  await page.screenshot({ path: path.join(SHOTS, 'p4-preview-reconstruct.png') });

  // ---------- P5: determinism ----------
  //
  // The interesting comparison is a FIRST play against a REPLAY, not
  // two replays. vihuplanet/runtime/core/rng.js mints its session seed
  // on its first call and reads it back afterwards, so a fresh
  // document and a replay consumed a different number of draws and the
  // second sky came out different — measured, then fixed by setting
  // that key from the preview seed. Two replays would have agreed
  // either way, which is why this opens its own page.
  const candNow = await frame.evaluate(() => window.LabPreview.candidate());
  const detPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await detPage.goto(BASE + '/tools/ether-mystery-lab/preview.html');
  await detPage.waitForFunction(() => !!window.LabPreview, null, { timeout: 15000 });
  const det = await detPage.evaluate((c) => {
    function shot() {
      var i = window.LabPreview.instrument();
      return i ? i.elements.map((e) => Math.round(e.x) + ',' + Math.round(e.y)).join(' ') : 'none';
    }
    window.LabPreview.play(c, 'seed-X');   // the FIRST play in this document
    const first = shot();
    window.LabPreview.play(c, 'seed-X');   // a replay of the same thing
    const replay = shot();
    window.LabPreview.play(c, 'seed-Y');
    const other = shot();
    return { first: first, replay: replay, other: other };
  }, candNow);
  await detPage.close();
  ck(det.first !== 'none' && det.first === det.replay,
    'P5  a replay of the same candidate and seed is the same sky as the first play',
    det.first + '  vs  ' + det.replay);
  ck(det.other !== det.first, 'P5b a different seed is a different sky', det.other);

  // ---------- P6: the existing chain, driven for real ----------
  const chain = frame ? await frame.evaluate(async () => {
    const cand = window.LabPreview.candidate();
    window.LabPreview.play(cand, 'seed-X');
    await new Promise((r) => setTimeout(r, 1400));   // let the elements arrive
    const inst = window.LabPreview.instrument();
    const before = inst.elements.filter((e) => e.engaged).length;
    // The ripple is the real touch layer; the posed mystery is asked
    // FIRST about where the tap landed — the production ownership rule.
    const el = inst.elements.filter((e) => !e.engaged)[0] || inst.elements[0];
    const u = window.LabPreview.universe();
    const cam = u.camera.offsetFor(u.ether.depth.stories, { x: 0, y: 0 });
    // drive through the ripple's own public touch(), in screen space
    const rip = window.LabPreview.ripple();
    if (rip) rip.touch(el.x + cam.x, el.y + cam.y);
    await new Promise((r) => setTimeout(r, 200));
    const after = window.LabPreview.instrument();
    return {
      before: before,
      after: after ? after.elements.filter((e) => e.engaged).length : -1,
      viaRipple: !!rip
    };
  }).catch((e) => ({ err: String(e) })) : null;
  ck(chain && chain.viaRipple && chain.after > chain.before,
    'P6  a real touch reaches the posed mystery through the existing chain',
    JSON.stringify(chain));

  // ---------- P7: exit is clean, the demonstration comes home ----------
  await frame.click('button[data-act="exit"]');
  await page.waitForTimeout(700);
  const afterExit = await page.evaluate(() => ({
    frames: document.querySelectorAll('[data-lab-preview]').length,
    universes: document.querySelectorAll('.vp-universe').length,
    ether: typeof window.VihuPlanet !== 'undefined',
    demo: (document.querySelector('.cand .demo-title') || {}).textContent || null,
    demoText: (document.querySelector('.cand .demo') || {}).innerText || ''
  }));
  ck(afterExit.frames === 0 && afterExit.universes === 0 && !afterExit.ether,
    'P7  exit disposes the whole preview — no frame, no universe, nothing left');
  ck(afterExit.demo === 'What the preview demonstrated',
    'P7b what the preview demonstrated comes home, after the fact');
  ck(/MYSTERY/.test(afterExit.demoText) && /CHILD ACTION/.test(afterExit.demoText) &&
     /DISCOVERY/.test(afterExit.demoText) && /NEXT MYSTERY/.test(afterExit.demoText),
    'P7c and it names Mystery · Child action · Discovery · Next Mystery');

  // ---------- P8: unsupported can never become a fake experience ----------
  const unIdx = cards.findIndex((c) => c.unavail);
  if (unIdx >= 0) {
    const un = await page.evaluate((i) => {
      const c = document.querySelectorAll('.cand')[i];
      return {
        text: (c.querySelector('.unavail') || {}).textContent || '',
        why: (c.querySelector('.play-row .hint') || {}).textContent || '',
        play: !!c.querySelector('button[data-play]'),
        exceptional: c.querySelector('button[data-classify="exceptional"]').disabled,
        good: c.querySelector('button[data-classify="good"]').disabled,
        reject: c.querySelector('button[data-classify="reject"]').disabled
      };
    }, unIdx);
    ck(!un.play && un.text.indexOf('Preview unavailable — unsupported runtime capability') === 0,
      'P8  an unperformable candidate says so and offers no PLAY', un.text);
    ck(un.why.length > 0, 'P8b and it says which capability, in plain words', un.why);
    ck(un.exceptional && un.good && !un.reject,
      'P8c it is kept out of the creative approval path, and still reviewable');
    await page.screenshot({ path: path.join(SHOTS, 'p8-unavailable.png') });
  } else {
    fail('P8  no unsupported candidate in the batch to check');
  }

  // ---------- P9: nothing production moved, nothing was asked ----------
  const off = reqs.filter((r) => r.url.indexOf('127.0.0.1') === -1);
  ck(modelHits === 0 && off.length === 0,
    'P9  the whole preview called no model and made no off-host request',
    off.map((r) => r.url).join(','));
  ck(reqs.filter((r) => r.method === 'POST').length === 0,
    'P9b and no POST of any kind');
  const store = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length }));
  // sessionStorage is per ORIGIN, so the frame's one deliberate write
  // is visible here — which this check found by going red. The preview
  // puts it back on exit, so the document that opened it is left
  // exactly as it was.
  ck(store.ls === 0 && store.ss === 0,
    'P9b2 the Lab document is left exactly as it was — the preview put its one key back',
    JSON.stringify(store));
  const poolAfter = await (await fetch(BASE + '/assets/ether/experience-pool.js')).text();
  ck(poolAfter === poolSrc, 'P9c the production experience pool is byte-identical');
  ck(errs.length === 0, 'P9d zero page errors across the whole preview journey', errs[0]);

  // ---------- three different candidates, for the record ----------
  const SHOWCASE = ['a-cover-come-apart', 'behind-a-veil-of-light', 'stars-that-answer'];
  const shots = [];
  for (const id of SHOWCASE) {
    const cand = entries.filter((e) => e.candidate.id === id)[0];
    if (!cand) continue;
    const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await p2.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await p2.waitForFunction(() => !!window.LabPreview, null, { timeout: 15000 });
    const posed = await p2.evaluate((c) => {
      window.LabPreview.play(c, 'shot');
      const i = window.LabPreview.instrument();
      return i ? i.elements.length : 0;
    }, cand.candidate);
    await p2.waitForTimeout(2600);
    await p2.screenshot({ path: path.join(SHOTS, 'preview-' + id + '.png') });
    shots.push(id + ':' + posed);
    await p2.close();
  }
  ck(shots.length === 3 && shots.every((s) => Number(s.split(':')[1]) > 0),
    'P10 three different candidates were each posed and captured', shots.join(' '));

  await browser.close();
  server.kill();
}

// ===================================================================
(async () => {
  try {
    await sectionS();
    sectionF();
    await sectionE();
    await sectionB();
    await sectionP();
  } catch (e) {
    fail('suite crashed', (e && e.stack || String(e)).split('\n')[0]);
  }
  console.log('\n==================================================');
  console.log('passed ' + passed + ' · failed ' + failed);
  failures.forEach((f) => console.log('  FAILED: ' + f));
  process.exit(failed ? 1 : 0);
})();
