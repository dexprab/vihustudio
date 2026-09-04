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
(async () => {
  try {
    await sectionS();
    sectionF();
    await sectionE();
    await sectionB();
  } catch (e) {
    fail('suite crashed', (e && e.stack || String(e)).split('\n')[0]);
  }
  console.log('\n==================================================');
  console.log('passed ' + passed + ' · failed ' + failed);
  failures.forEach((f) => console.log('  FAILED: ' + f));
  process.exit(failed ? 1 : 0);
})();
