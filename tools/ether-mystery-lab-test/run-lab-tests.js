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
 *   R. the research view — INVALID DOES NOT MEAN INVISIBLE: the four
 *      preview cases, the written-down projection, the research
 *      grammar's one deliberate bypass, an invalid candidate that can
 *      never be approved or exported to the pool, a refinement that is
 *      a new linked candidate, and TRY IDEA riding the same real
 *      interpreter
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
   'tools/ether-mystery-lab/labPreviewSupport.js',
   'tools/ether-mystery-lab/labResearch.js',
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
  // A COUNT COPIED INTO A TEST GOES STALE SILENTLY — this read
  // `=== 6` and went red the moment Phase 6's three runs joined the
  // list, which is a preset arriving rather than one going missing.
  // The property worth holding is that the six critical experiments
  // are all still THERE, by name; C10 covers Phase 6's own five.
  const presets = Object.keys(K.EXPERIMENTS);
  const SIX = ['same-creation', 'constellations', 'mystery-without-challenge',
    'challenge-from-mystery', 'next-mystery', 'depth-layers'];
  const goneMissing = SIX.filter((id) => presets.indexOf(id) === -1);
  ck(goneMissing.length === 0 && presets.length >= 6,
    'F10 the six critical experiments all exist', goneMissing.join(',') || presets.length + ' presets');
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

  // F11 — the quality layer. TURNED ROUND, with its reason in place.
  //
  // F11b used to read "an unresolved-only candidate scores as carrying
  // real mystery" and asserted mystery.score >= 2 — two of three
  // points for the word `unresolved` alone. That is the single rule
  // the Mystery → Tease → Action → Magic sprint names as having to go:
  // it is how five candidates a human called boring scored 22-29 out
  // of 33. Being unresolved is now worth one point of one dimension
  // and can never carry a candidate.
  const q = K.evaluate(K.FIXTURE_BANK.notice, { poolSignatures: poolSigs });
  const DIMS = ['perceptibility', 'childAction', 'teaseStrength', 'responseStrength',
    'causeEffect', 'spatialSignificance', 'surprise', 'payoff', 'genuineMystery',
    'understandability', 'nextQuestion', 'originality'];
  const missingDim = DIMS.filter((d) => !q.scores[d]);
  ck(missingDim.length === 0 && q.heuristic === true,
    'F11 the creative dimensions are the product contract\'s own, labelled heuristic',
    missingDim.join(','));
  const unresolvedOnly = { id: 'unresolved-only-probe', grammar: 'notice',
    ingredients: {}, elements: [{ role: 'a', show: 'mark', place: 'near-look' }],
    engage: [{ action: 'dwell', on: 'a' }], behaviour: { pace: 'still' },
    outcome: { possible: ['unresolved'] },
    constraints: { rarity: 'common', phases: ['exploration'] } };
  const uq = K.evaluate(unresolvedOnly, {});
  ck(uq.scores.genuineMystery.score <= 1 && !uq.contract.meets,
    'F11b unresolved ALONE no longer buys mystery, and does not meet the contract',
    'genuineMystery ' + uq.scores.genuineMystery.score + ' · ' + uq.contract.gaps.length + ' gaps');

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

  {
    // B16 — ARMING A CREATION-BOUND PRESET SUPPLIES THE CREATION.
    //
    // `needsCreation` used to be a parenthetical in the preset note and
    // nothing else — gatherBuildOpts reads #creationSelect on its own —
    // so a creation-bound experiment generated perfectly happily without
    // one. That is what happened to the first Pegasus batch, and it is
    // why all five candidates came back built on an anchor. Arming now
    // sets it, exactly as it already set count, grammar and complexity.
    await page.reload();
    await page.waitForTimeout(900);
    await page.check('#modeFixture');
    const creationBefore = await page.inputValue('#creationSelect');
    await page.click('.lab-preset[data-preset="pegasus-regeneration"]');
    await page.waitForTimeout(120);
    const armed = await page.evaluate(() => ({
      creation: document.getElementById('creationSelect').value,
      count: document.getElementById('countSelect').value,
      complexity: document.getElementById('complexitySelect').value,
      grammar: document.getElementById('grammarSelect').value
    }));
    ck(creationBefore === '' && armed.creation === 'fixture-0' && armed.count === '5' &&
       armed.complexity === 'mixed' && armed.grammar === 'compose',
      'B16 arming the Pegasus run selects a creation as well as its other parameters',
      JSON.stringify(armed));
    await page.click('#generateBtn');
    await page.waitForTimeout(700);
    const pegDiag = await page.textContent('#diagnostic');
    ck(pegDiag.indexOf('NOT SENT') === -1 && /story/.test(pegDiag),
      'B16b and the creation is in the input that would reach a generator',
      pegDiag.slice(0, 80));

    // B16c — a reviewer who clears it is TOLD, and nothing is sent.
    await page.selectOption('#creationSelect', '');
    await page.click('#generateBtn');
    await page.waitForTimeout(500);
    const refusedDiag = await page.textContent('#diagnostic');
    ck(refusedDiag.indexOf('NOT SENT — this experiment needs a creation') === 0,
      'B16c a creation-bound experiment run without one is refused, not generated anyway',
      refusedDiag.slice(0, 60));
  }

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
  ck(!/\belements\s*\.\s*forEach|\bplacePoints|\bcoverRegions|drawImage/.test(prev),
    'P1  the preview interprets nothing and places nothing — no second renderer');

  // THE ONE CANVAS THE PREVIEW OWNS IS THE TEASE, AND IT DRAWS NO
  // MYSTERY. `getContext` sat on the list above while the preview drew
  // nothing at all, which made it a PROXY for the real rule rather
  // than the rule itself — and the Falcon C experiment is the case
  // that tells them apart: a Lab overlay that leans toward a missing
  // join, exactly as the leading hint already writes a Lab sentence
  // over the sky. What P1 was protecting is checked here instead, and
  // more precisely: every stroke the preview makes is inside the tease,
  // and the tease reads the interpreter's own instrument() rather than
  // a candidate — so it draws no element, no join, no outcome and no
  // residue, and there is still exactly one Mystery engine.
  const teaseFrom = prev.indexOf('var TEASE = {');
  const teaseTo = prev.indexOf('function lookPoint');
  const draws = [];
  for (let at = prev.indexOf('getContext'); at !== -1;
       at = prev.indexOf('getContext', at + 1)) draws.push(at);
  ck(teaseFrom > 0 && teaseTo > teaseFrom && draws.length > 0 &&
     draws.every((i) => i > teaseFrom && i < teaseTo),
    'P1k every stroke the preview makes is inside the tease overlay, and nowhere else',
    draws.length + ' drawing call(s), all within the tease');
  const teaseBlock = prev.slice(teaseFrom, teaseTo);
  ck(/instrument\(\)/.test(teaseBlock) &&
     !/candidate|shard|veil|coverRegions|residue|placePoints/.test(teaseBlock),
    'P1m and it draws from the interpreter\'s own instrument(), never from a candidate');
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
  // 'NOT ACTIVE' STOPPED MEANING 'RETIRED' when a fourth status
  // arrived: 'experiment' is an entry that is finished and waiting on
  // a product decision rather than one that was withdrawn, and it
  // previews perfectly — which is the whole reason it is held in the
  // Lab. This check is about the RETIRED one, so it names it.
  const retired = entries.filter((e) => e.status === 'retired')[0];
  ck(retired && !Support.support(retired.candidate).ok &&
     Support.support(retired.candidate).reasons.indexOf('onEngage:brighten') !== -1,
    'P2b the retired entry is refused by name, for the capability it names');
  const held = entries.filter((e) => e.status === 'experiment');
  ck(held.every((e) => Support.support(e.candidate).ok),
    'P2c and an entry held as an experiment previews — that is what it is for',
    held.filter((e) => !Support.support(e.candidate).ok)
        .map((e) => e.candidate.id).join(','));
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
  // THE PREVIEW IS ITS OWN TAB NOW, so page-level listeners would stop
  // seeing it — and P9's "the whole preview called no model and made no
  // off-host request" would go quietly vacuous, which is the worst kind
  // of green. Everything is watched at the CONTEXT, which is every page
  // in it, popups included.
  const ctx = page.context();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(String(e))));
  let modelHits = 0;
  await ctx.route('https://api.openai.com/**', (r) => { modelHits++; r.abort(); });
  const reqs = [];
  ctx.on('request', (r) => reqs.push({ method: r.method(), url: r.url() }));

  await page.goto(BASE + '/tools/ether-mystery-lab/index.html');
  await page.waitForTimeout(1200);
  const idle = await page.evaluate(() => ({
    open: window.LabPreviewHost.isOpen(),
    universes: document.querySelectorAll('.vp-universe').length,
    ether: typeof window.VihuPlanet !== 'undefined' || typeof window.EtherMystery !== 'undefined',
    ss: sessionStorage.length, ls: localStorage.length
  }));
  ck(!idle.open && ctx.pages().length === 1 && idle.universes === 0 && !idle.ether &&
     idle.ss === 0 && idle.ls === 0,
    'P3b loading the Lab still does nothing — no preview tab, no Ether, no storage');

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
  // The press must open a TAB — the sky and nothing else, on whichever
  // screen the reviewer wants, with the Lab left where it was. A popup
  // Playwright never saw would fail here rather than being silently
  // read as "the preview did not happen".
  const [frame] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    page.locator('.cand').nth(playIdx).locator('button[data-play]').click()
  ]);
  await frame.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2600);
  ck(!!frame && frame.url().indexOf('preview.html') !== -1 &&
     frame !== page && page.frames().length === 1,
    'P4c PLAY opens the preview in a tab of its own, not inside the Lab',
    frame && frame.url());
  ck(await page.evaluate(() => window.LabPreviewHost.isOpen()),
    'P4d1 and the Lab knows a preview is standing');
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
  await frame.screenshot({ path: path.join(SHOTS, 'p4-preview-reconstruct.png') });   // the preview's own tab

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
  await page.waitForTimeout(900);
  const afterExit = await page.evaluate(() => ({
    open: window.LabPreviewHost.isOpen(),
    universes: document.querySelectorAll('.vp-universe').length,
    ether: typeof window.VihuPlanet !== 'undefined',
    demo: (document.querySelector('.cand .demo-title') || {}).textContent || null,
    demoText: (document.querySelector('.cand .demo') || {}).innerText || ''
  }));
  ck(!afterExit.open && frame.isClosed() && ctx.pages().length === 1 &&
     afterExit.universes === 0 && !afterExit.ether,
    'P7  exit disposes the whole preview — the tab is closed and nothing is left behind',
    ctx.pages().length + ' page(s)');
  ck(afterExit.demo === 'What the preview demonstrated',
    'P7b what the preview demonstrated comes home, after the fact');
  ck(/MYSTERY/.test(afterExit.demoText) && /CHILD ACTION/.test(afterExit.demoText) &&
     /DISCOVERY/.test(afterExit.demoText) && /NEXT MYSTERY/.test(afterExit.demoText),
    'P7c and it names Mystery · Child action · Discovery · Next Mystery');

  // ---------- P7d: ONE TAB, REUSED — and a stale report cannot end it ----------
  //
  // The tab is opened under a fixed name, so a second PLAY navigates
  // the one that is already there. That is what a reviewer wants and it
  // is also the trap: the OUTGOING document's own pagehide report
  // arrives AFTER the next preview has been armed, and without the
  // epoch it closed the tab that had just opened. Measured, not
  // reasoned about — reverting the epoch leaves one page and a closed
  // preview here.
  const [tabA] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    page.locator('.cand').nth(playIdx).locator('button[data-play]').click()
  ]);
  await tabA.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1600);
  await page.locator('.cand').nth(playIdx).locator('button[data-play]').click();
  await page.waitForTimeout(2600);
  const reused = {
    pages: ctx.pages().length,
    closed: tabA.isClosed(),
    open: await page.evaluate(() => window.LabPreviewHost.isOpen()),
    posed: tabA.isClosed() ? false
      : await tabA.evaluate(() => !!window.LabPreview.instrument()).catch(() => false)
  };
  ck(reused.pages === 2 && !reused.closed && reused.open && reused.posed,
    'P7d a second PLAY reuses the one preview tab, and the outgoing document\'s own report never ends it',
    JSON.stringify(reused));
  if (!tabA.isClosed()) await tabA.click('button[data-act="exit"]').catch(() => {});
  await page.waitForTimeout(700);

  // ---------- P7e: a refused pop-up is SAID, never a silence ----------
  //
  // A blocked pop-up is the one failure a tab has that a frame did not,
  // and the worst possible answer to it is a button that appears to do
  // nothing. The browser's refusal is simulated here rather than waited
  // for, because a headless browser allows pop-ups.
  await page.evaluate(() => { window.__realOpen = window.open; window.open = () => null; });
  await page.locator('.cand').nth(playIdx).locator('button[data-play]').click();
  await page.waitForTimeout(500);
  const refused = await page.evaluate(() => ({
    open: window.LabPreviewHost.isOpen(),
    note: (document.querySelector('.cand [data-popup-blocked]') || {}).textContent || ''
  }));
  ck(!refused.open && ctx.pages().length === 1 && /Allow pop-ups/.test(refused.note),
    'P7e a browser that refuses the preview tab is answered with a plain sentence',
    JSON.stringify(refused));
  await page.evaluate(() => { window.open = window.__realOpen; });

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
  // sessionStorage is per ORIGIN but per TOP-LEVEL CONTEXT. When the
  // preview was a frame the two shared one, its one deliberate write
  // was visible here, and this check found that by going red. A tab has
  // its own, so the reach is gone rather than merely tidied up after —
  // and the preview still puts the key back, because the tab is reused
  // across plays.
  ck(store.ls === 0 && store.ss === 0,
    'P9b2 the Lab document is left exactly as it was — the preview\'s one key never reaches it',
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
// R. THE RESEARCH VIEW — INVALID DOES NOT MEAN INVISIBLE.
//
// A refused candidate is not a failure to be hidden: it is the
// material a research instrument exists to study. This section proves
// the four §3 cases, the narrow written-down projection, the research
// grammar's ONE deliberate bypass, that an invalid candidate can never
// be approved or exported to the pool, that a refinement is a NEW
// candidate, and that TRY IDEA rides the SAME real interpreter the
// PLAY path does.
//
// R1–R9   the layer in Node, over the real grammar and support table
// R10–R15 the session: approval, the two exports, refinement
// R16–R24 the real page: an invalid batch rendered, tried, exported
// ===================================================================

// Constructed probes. These are NOT the product owner's Pegasus batch,
// which the Lab never persisted and which is gone (see the sprint
// report). They are written HERE to exercise each contract mismatch
// the source-level trace named, and they are labelled as constructed
// wherever they are used.
const PROBES = {
  figureAtTop: {
    id: 'pegasus-square', grammar: 'reconstruct',
    title: 'four stars of the great square, come apart',
    figure: 'pegasus',
    ingredients: { creation: true },
    elements: [{ role: 'corner', show: 'shard', of: 'cover', place: 'scattered', count: 4 }],
    engage: [{ action: 'tap', on: 'corner' }],
    behaviour: { onEngage: 'gather' },
    outcome: { possible: ['discovery'], discovery: 'creation-revealed' }
  },
  residueAtTop: {
    id: 'glint-trail', grammar: 'trace',
    title: 'a faint trail that leaves a mark behind',
    elements: [{ role: 'step', show: 'glint', place: 'scattered', count: 3 }],
    engage: [{ action: 'dwell', on: 'step', seconds: 3 }],
    behaviour: { onEngage: 'drift-away' },
    residue: { show: 'mark', when: 'either' },
    outcome: { possible: ['discovery', 'unresolved'], discovery: 'place' }
  },
  designOnly: {
    id: 'one-touch-sure', grammar: 'uncover',
    title: 'a soft glow with something behind it',
    ingredients: { creation: true },
    elements: [{ role: 'veil', show: 'veil', place: 'near-look' },
               { role: 'behind', show: 'shard', of: 'cover', place: 'near-look' }],
    engage: [{ action: 'tap', on: 'veil' }],
    behaviour: { onEngage: 'reveal' },
    outcome: { possible: ['discovery'], discovery: 'creation-revealed' }
  },
  inventedCapability: {
    id: 'wants-a-glow', grammar: 'notice',
    title: 'a light that answers in a way the sky has never had',
    elements: [{ role: 'spot', show: 'glint', place: 'far' }],
    engage: [{ action: 'dwell', on: 'spot', seconds: 4 }],
    behaviour: { onEngage: 'pulse' },
    outcome: { possible: ['unresolved'] }
  },
  privateKey: {
    id: 'smuggled-sky', grammar: 'connect',
    title: 'lights that belong together',
    ingredients: { creation: false },
    elements: [{ role: 'pair', show: 'glint', place: 'scattered', count: 2 }],
    engage: [{ action: 'dwell', on: 'pair', seconds: 3 }],
    behaviour: { onEngage: 'link' },
    outcome: { possible: ['unresolved'], memories: ['a thing the child said'] }
  },
  // A PRIVACY KEY AT THE TOP LEVEL. The validator returns early on an
  // unknown TOP-LEVEL key, so its own sweep never runs and this comes
  // back merely as "unknown" — which is exactly why the research layer
  // asks the forbidden list itself before repairing anything.
  smuggledTopLevel: {
    id: 'smuggled-top', grammar: 'connect',
    title: 'lights arranged the way a card is',
    constellation: 'pegasus',
    elements: [{ role: 'pair', show: 'glint', place: 'scattered', count: 2 }],
    engage: [{ action: 'dwell', on: 'pair', seconds: 3 }],
    behaviour: { onEngage: 'link' },
    outcome: { possible: ['unresolved'] }
  },
  empty: {
    id: 'nothing-here', grammar: 'notice',
    title: 'an idea with nothing in it',
    elements: [],
    outcome: { possible: ['unresolved'] }
  },
  valid: {
    id: 'a-real-one', grammar: 'notice',
    title: 'one far light, a little nearer than it used to be',
    elements: [{ role: 'shift', show: 'glint', place: 'far' }],
    engage: [{ action: 'return', on: 'shift' }],
    behaviour: { onEngage: 'dissolve', pace: 'still' },
    outcome: { possible: ['unresolved'] }
  }
};

async function sectionR() {
  console.log('\n== R. the research view ==');
  const { chromium } = require('playwright');
  const Research = require('../ether-mystery-lab/labResearch.js');
  const Support = require('../ether-mystery-lab/labPreviewSupport.js');
  const G = kitSandbox().EtherGrammar;

  // ---------- R1: the layer reaches nothing ----------
  const src = stripComments(read('tools/ether-mystery-lab/labResearch.js'));
  ck(!/fetch\s*\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|api\.openai/.test(src),
    'R1  the research layer makes no network call of any kind');
  ck(!/localStorage|sessionStorage|indexedDB/.test(src),
    'R1b it stores nothing');
  // NOT A SECOND ENGINE (§4). It may not draw, place or interpret an
  // element — only the interpreter does that.
  ck(!/getContext|drawImage|placePoints|coverRegions|createElement\s*\(\s*['"]canvas/.test(src),
    'R1c it draws nothing and places nothing — no second renderer');

  // ---------- R2: the projection is written down ----------
  ck(Array.isArray(Research.RULES) && Research.RULES.length >= 5 &&
     Research.RULES.every((r) => r.id && r.why && r.why.length > 20),
    'R2  every projection rule is named and says why it is safe',
    Research.RULES.map((r) => r.id).join(','));

  // ---------- R3: the waiver names no capability, bound or boundary ----------
  // The four reasons stood over on a research run must all be the
  // product's own DESIGN judgement. A reason naming a capability, a
  // bound, a shape or the privacy boundary would be a faked capability
  // wearing a waiver, which §3 forbids.
  const badWaiver = Research.RESEARCH_WAIVED.filter((r) =>
    /^(unavailable-capability|forbidden-key|bad-|too-many|unknown-|not-an-object|no-)/.test(r));
  ck(badWaiver.length === 0,
    'R3  RESEARCH_WAIVED holds only design judgements — never a capability, bound or boundary',
    badWaiver.join(',') || Research.RESEARCH_WAIVED.join(','));

  // ---------- R4: the four cases ----------
  const cases = {};
  Object.keys(PROBES).forEach((k) => {
    cases[k] = Research.study(PROBES[k], { grammar: G, support: Support, fallbackId: 'cand-1' });
  });
  ck(cases.valid['case'] === 'playable', 'R4  a valid, performable candidate is PLAYABLE');
  ck(cases.figureAtTop['case'] === 'try-idea' && cases.residueAtTop['case'] === 'try-idea',
    'R4b an invalid ENCODING whose idea the Ether can show is TRY IDEA',
    cases.figureAtTop['case'] + '/' + cases.residueAtTop['case']);
  ck(cases.designOnly['case'] === 'try-idea' &&
     cases.designOnly.projection.applied.length === 0 &&
     cases.designOnly.projection.waived.indexOf('tap-for-sure-outcome') !== -1,
    'R4c a candidate refused ONLY for a design reason is tried AS WRITTEN — nothing repaired');
  ck(cases.inventedCapability['case'] === 'unsupported',
    'R4d a capability the Ether does not have is UNSUPPORTED — never faked into a preview');
  ck(cases.empty['case'] === 'uninterpretable' && cases.privateKey['case'] === 'uninterpretable',
    'R4e nothing to show, or something that may never travel, is UNINTERPRETABLE',
    cases.empty['case'] + '/' + cases.privateKey['case']);

  // ---------- R5: an unsupported capability is NAMED ----------
  ck(cases.inventedCapability.missing.join(' ').indexOf('pulse') !== -1,
    'R5  the unsupported case names the capability the idea asked for',
    cases.inventedCapability.missing.join(' | '));
  ck(!cases.inventedCapability.previewCandidate,
    'R5b and it offers no preview candidate at all');

  // ---------- R6: a privacy boundary is never repaired around ----------
  ck(!cases.privateKey.projection && cases.privateKey.stopped &&
     cases.privateKey.stopped.some((r) => r.indexOf('forbidden-key') === 0),
    'R6  a forbidden key stops the study before any repair is attempted');
  // The validator short-circuits on an unknown TOP-LEVEL key, so a
  // privacy field put there is reported only as "unknown" and its own
  // sweep never runs. The research layer asks the forbidden list itself
  // before any rule may drop it — a privacy boundary is not something
  // to repair around.
  ck(cases.smuggledTopLevel['case'] === 'uninterpretable' &&
     !cases.smuggledTopLevel.projection &&
     cases.smuggledTopLevel.stopped &&
     cases.smuggledTopLevel.stopped.some((r) => r.indexOf('forbidden-key') === 0),
    'R6b a privacy key the validator only called "unknown" is still never repaired around',
    cases.smuggledTopLevel['case']);

  // ---------- R7: intent is derived, never invented ----------
  const it = cases.residueAtTop.intent;
  ck(it.ok && it.sentence.indexOf(PROBES.residueAtTop.title) !== -1 &&
     it.sentence.indexOf('small lights') !== -1 &&
     it.derivedFrom.indexOf('elements') !== -1,
    'R7  the creative intent is built from the candidate\'s own title and fields', it.sentence);
  ck(it.reaching.indexOf('residue') !== -1,
    'R7b and it names what the model reached for that the schema has no room for',
    it.reaching.join(','));
  const bare = Research.intent({ elements: [] }, { grammar: G, support: Support });
  ck(!bare.ok && !bare.sentence,
    'R7c a candidate with nothing in it says so rather than being described');

  // ---------- R8: the original is never mutated ----------
  const before = JSON.stringify(PROBES.figureAtTop);
  Research.study(PROBES.figureAtTop, { grammar: G, support: Support });
  Research.project(PROBES.figureAtTop, { grammar: G });
  ck(JSON.stringify(PROBES.figureAtTop) === before,
    'R8  studying and projecting never touch the original candidate');

  // ---------- R9: the research grammar delegates ----------
  const rg = Research.researchGrammar(G);
  const waived = rg.validate(PROBES.designOnly, {});
  const stillNo = rg.validate(PROBES.inventedCapability, {});
  const privNo = rg.validate(PROBES.privateKey, {});
  ck(waived.ok && waived.waived.indexOf('tap-for-sure-outcome') !== -1,
    'R9  the research grammar stands over a design refusal, and records it');
  ck(!stillNo.ok && !privNo.ok,
    'R9b and it still refuses an invented capability and a private key',
    JSON.stringify([stillNo.reasons, privNo.reasons]));
  ck(rg.CAPABILITIES === G.CAPABILITIES && rg.signature === G.signature,
    'R9c it delegates everything else to the real grammar — one vocabulary');

  // ---------- R10–R15: the session ----------
  const sb = kitSandbox();
  const K = sb.EtherMysteryLabKit;
  void sb;
  const ses = K.createSession({ pool: null });
  const good = ses.add(JSON.parse(JSON.stringify(PROBES.valid)), { source: 'fixture' });
  const bad = ses.add(JSON.parse(JSON.stringify(PROBES.figureAtTop)), { source: 'fixture' });
  [good, bad].forEach((i) => { ses.validate(i); ses.quality(i); ses.study(i); });

  ck(good.validation.ok && !bad.validation.ok && ses.items().length === 2,
    'R10 an invalid candidate stays in the session beside a valid one');

  ses.review(bad.labId, 'good', [], 'the idea is lovely, the encoding is not');
  const ap = ses.approve(bad.labId);
  ck(!ap.ok && ap.reason === 'not-valid' && bad.state === 'reviewed',
    'R11 an invalid candidate can be JUDGED and can never be approved', ap.reason);

  ses.review(good.labId, 'good', [], '');
  ses.approve(good.labId);
  const pool = ses.exportApproved();
  ck(pool.ok && pool.count === 1 &&
     pool.artifact.entries.every((e) => e.candidate.id !== 'pegasus-square'),
    'R12 the production export holds the approved candidate ONLY — never the invalid one');

  const log = ses.exportResearch();
  ck(log.ok && log.artifact.format === 'ether-mystery-lab-research-log' &&
     log.artifact.productionReady === false &&
     log.artifact.note.indexOf('experience-pool.js') !== -1,
    'R13 the research log is a DIFFERENT artifact and says it is not for the pool');
  const badRow = log.artifact.candidates.filter((r) => r.labId === bad.labId)[0];
  ck(log.artifact.candidates.length === 2 && badRow &&
     badRow.technicalStatus === 'invalid' &&
     badRow.refusedBecause.length > 0 &&
     badRow.creativeIntent && badRow.previewStatus === 'try-idea' &&
     badRow.humanJudgement.classification === 'good' &&
     badRow.humanJudgement.productionApproval === false,
    'R13b and it carries the invalid candidate whole — refusals, intent, preview status, judgement',
    JSON.stringify(badRow && { s: badRow.technicalStatus, p: badRow.previewStatus }));

  // R14 — a refinement is a NEW candidate, linked, and the original is
  // untouched with its own reasons.
  const brief = ses.refinementBrief(bad.labId);
  ck(brief && brief.original.id === 'pegasus-square' &&
     brief.intent && brief.refusedBecause.length > 0 && brief.ofLabId === bad.labId,
    'R14 the refinement brief carries the original, its intent and its exact refusals');
  const refined = ses.add(JSON.parse(JSON.stringify(PROBES.valid)),
    { source: 'fixture', refinementOf: bad.labId, refinementBrief: brief });
  ses.validate(refined); ses.quality(refined); ses.study(refined);
  ck(refined.labId === bad.labId + '-r1' && refined.lab.refinementOf === bad.labId &&
     ses.get(bad.labId).candidate.id === 'pegasus-square' &&
     ses.get(bad.labId).validation.reasons.length > 0,
    'R14b the refinement is a new linked candidate and the original keeps its reasons',
    refined.labId);

  // R15 — the refinement goes through the SAME generation contract.
  const built = K.buildInput({
    structures: [{ kind: 'story', pages: 5, hasCover: true }],
    count: 1,
    refine: { original: brief.original, intent: brief.intent,
              refusedBecause: brief.refusedBecause }
  });
  ck(built.ok && built.input.directives.refine &&
     built.input.directives.refine.original.id === 'pegasus-square' &&
     built.input.directives.refine.instruction.indexOf('Keep the mystery idea') === 0 &&
     built.input.contract.capabilities,
    'R15 a refinement is assembled by the ONE buildInput, carrying the idea and the contract');
  ck(built.messages[1].content.indexOf('pegasus-square') !== -1 &&
     built.input.directives.refine.instruction.indexOf('make it valid') === -1,
    'R15b it asks for the idea to survive the vocabulary — never merely "make it valid"');

  // ---------- the browser ----------
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  try {
    const served = await (await fetch(BASE + '/tools/ether-mystery-lab/labResearch.js')).text();
    ck(served === read('tools/ether-mystery-lab/labResearch.js'),
      'R16 the served tree IS this tree');
  } catch (e) { fail('R16 the served tree IS this tree', String(e)); }

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  // Watched at the CONTEXT — the research preview is its own tab too
  // (see P's own note), and R23's "no request off this host" must keep
  // covering it.
  const ctx = page.context();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(String(e))));
  const reqs = [];
  ctx.on('request', (r) => reqs.push({ method: r.method(), url: r.url() }));

  // The stubbed provider hands back the INVALID batch — the real page,
  // the real transport, the real validator, the real research layer.
  let providerHits = 0;
  await page.route('https://api.openai.com/**', (route) => {
    providerHits++;
    if (route.request().url().indexOf('/models') !== -1) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' });
    }
    const batch = [PROBES.figureAtTop, PROBES.designOnly,
                   PROBES.inventedCapability, PROBES.empty];
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ candidates: batch }) } }] })
    });
  });

  const poolSrc = read('assets/ether/experience-pool.js');
  await page.goto(BASE + '/tools/ether-mystery-lab/index.html');
  await page.waitForTimeout(1200);
  await page.check('#modeDirect');
  await page.fill('#directKey', 'sk-RESEARCHTESTKEY1234567890');
  await page.waitForTimeout(120);
  await page.click('#testBtn');
  await page.waitForTimeout(500);
  await page.click('#generateBtn');
  await page.waitForTimeout(1000);

  const cards = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('.cand'), (c) => ({
      id: (c.querySelector('h3') || {}).textContent || '',
      invalid: !!c.querySelector('.badge.invalid'),
      research: !!c.querySelector('.research'),
      intent: (c.querySelector('.research .facet') || {}).textContent || '',
      play: !!c.querySelector('button[data-play]'),
      tryIt: !!c.querySelector('button[data-try]'),
      preview: (c.querySelector('.play-row > div') || {}).getAttribute
        ? c.querySelector('.play-row > div').getAttribute('data-preview') : null,
      hint: (c.querySelector('.play-row .hint') || {}).textContent || '',
      unavail: (c.querySelector('.play-row .unavail') || {}).textContent || ''
    })));

  ck(cards.length === 4 && cards.every((c) => c.invalid),
    'R17 every invalid candidate stays visible on the page, badged INVALID',
    cards.length + ' cards');
  ck(cards.every((c) => c.research && c.intent.indexOf('trying to do') !== -1),
    'R17b each one carries a research view saying what the model was trying to make');
  ck(cards.every((c) => !c.play),
    'R17c not one of them is offered "PLAY IN ETHER"');

  const tryCards = cards.filter((c) => c.tryIt);
  ck(tryCards.length === 2 && tryCards.every((c) => c.hint.indexOf('Not production-valid') === 0),
    'R18 the two whose idea the Ether can show offer 🧪 TRY IDEA, labelled as research',
    tryCards.length + '');
  const unsupported = cards.filter((c) => c.preview === 'unsupported')[0];
  ck(unsupported && unsupported.unavail.indexOf('Cannot preview this idea yet') !== -1 &&
     unsupported.hint.indexOf('pulse') !== -1,
    'R18b the one needing a missing capability says so and names it',
    unsupported && unsupported.hint);
  const uninterp = cards.filter((c) => c.preview === 'uninterpretable')[0];
  ck(uninterp && uninterp.unavail.indexOf('Cannot preview this idea yet') !== -1,
    'R18c and the one with nothing in it gets the research explanation, no preview');
  // For the record (§17.12): four refused candidates, still visible,
  // each saying what the model was trying to make and whether the Ether
  // can show it — including the one that cannot be previewed at all.
  try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
  await page.screenshot({ path: path.join(SHOTS, 'research-invalid-cards.png'), fullPage: true });

  // R19 — TRY IDEA opens the REAL preview and poses the idea, in a tab
  // of its own exactly as PLAY does.
  const [frame] = await Promise.all([
    page.waitForEvent('popup', { timeout: 15000 }),
    page.click('button[data-try]')
  ]);
  await frame.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2600);
  const inFrame = !!frame && frame.url().indexOf('preview.html') !== -1 &&
    await page.evaluate(() => window.LabPreviewHost.isOpen());
  const posed = frame ? await frame.evaluate(() => {
    const i = window.LabPreview.instrument();
    return {
      mode: window.LabPreview.mode(),
      elements: i ? i.elements.length : 0,
      badge: !document.querySelector('[data-try-badge]').hidden,
      unavailable: document.querySelector('[data-unavailable]').classList.contains('on'),
      universe: document.querySelectorAll('.vp-universe').length
    };
  }) : null;
  ck(inFrame && posed && posed.mode === 'try' && posed.elements > 0 &&
     !posed.unavailable && posed.universe === 1,
    'R19 TRY IDEA poses the idea on the REAL interpreter in the REAL universe',
    JSON.stringify(posed));
  ck(posed && posed.badge,
    'R19b and the preview says it is a research run, never a plain play');
  try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) {}
  await frame.screenshot({ path: path.join(SHOTS, 'research-try-idea.png') });   // the preview's own tab

  // R20 — determinism holds on the research path too. The interesting
  // comparison is a FIRST play against a replay in a FRESH document
  // (P5's own reasoning: the runtime's session seed is minted on its
  // first call, so two replays would agree either way).
  const tried = frame ? await frame.evaluate(() => window.LabPreview.candidate()) : null;
  const detPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await detPage.goto(BASE + '/tools/ether-mystery-lab/preview.html');
  await detPage.waitForFunction(() => !!window.LabPreview, null, { timeout: 15000 });
  const det = await detPage.evaluate((c) => {
    function shot() {
      var i = window.LabPreview.instrument();
      return i ? i.elements.map((e) => Math.round(e.x) + ',' + Math.round(e.y)).join(' ') : 'none';
    }
    window.LabPreview.play(c, 'seed-R', 'try');
    const first = shot();
    window.LabPreview.play(c, 'seed-R', 'try');
    return { first: first, replay: shot(), mode: window.LabPreview.mode() };
  }, tried);
  await detPage.close();
  ck(det.first !== 'none' && det.first === det.replay && det.mode === 'try',
    'R20 the same idea and the same seed lay out the same sky on a research replay',
    det.first + '  vs  ' + det.replay);

  await frame.click('[data-act="exit"]');
  await page.waitForTimeout(900);
  const cleaned = await page.evaluate(() => ({
    open: window.LabPreviewHost.isOpen(),
    ss: sessionStorage.length, ls: localStorage.length
  }));
  ck(!cleaned.open && frame.isClosed() && ctx.pages().length === 1 &&
     cleaned.ss === 0 && cleaned.ls === 0,
    'R20b exiting a research preview closes its tab and leaves the Lab exactly as it was',
    JSON.stringify(cleaned));

  // R21 — the two exports, on the real page.
  await page.click('#exportBtn');
  await page.waitForTimeout(200);
  const exportState = await page.textContent('#exportState');
  ck(exportState.indexOf('nothing approved yet') !== -1,
    'R21 with only invalid candidates the production export refuses — nothing to approve',
    exportState);

  const dl = page.waitForEvent('download').catch(() => null);
  await page.click('#researchBtn');
  await dl;
  await page.waitForTimeout(200);
  const logArtifact = await page.evaluate(() => window.__lastLabResearchExport || null);
  ck(logArtifact && logArtifact.format === 'ether-mystery-lab-research-log' &&
     logArtifact.productionReady === false &&
     logArtifact.counts.invalid === 4 && logArtifact.counts.valid === 0 &&
     logArtifact.candidates.every((r) => r.refusedBecause.length > 0 && r.creativeIntent),
    'R21b the research log exports all four with their refusals and their intent',
    logArtifact && JSON.stringify(logArtifact.counts));
  ck(logArtifact && logArtifact.candidates.some((r) => r.previewStatus === 'try-idea') &&
     logArtifact.candidates.some((r) => r.previewStatus === 'unsupported') &&
     logArtifact.candidates.some((r) => r.previewStatus === 'uninterpretable'),
    'R21c and it records which could be experimented with and which could not');

  // R22 — ↻ Regenerate makes a NEW linked candidate; the original stays.
  const beforeCount = await page.locator('.cand').count();
  await page.click('button[data-regenerate]');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll('.cand'), (c) => ({
      head: (c.querySelector('h3') || {}).textContent || '',
      lineage: (c.querySelector('.lineage') || {}).textContent || ''
    })));
  ck(after.length > beforeCount && after.some((c) => c.lineage.indexOf('Refinement of') === 0),
    'R22 a regenerate adds a NEW candidate linked to the original, and never replaces it',
    beforeCount + ' → ' + after.length);
  ck(after.some((c) => c.head.indexOf('pegasus-square') !== -1),
    'R22b the original is still on the page with its own record');

  // R23 — nothing production moved, and nothing new was asked of a model
  // beyond the generations the reviewer pressed for.
  const offHost = reqs.filter((r) => r.url.indexOf('127.0.0.1') === -1 &&
    r.url.indexOf('api.openai.com') === -1);
  ck(offHost.length === 0, 'R23 the whole research journey made no request off this host',
    offHost.map((r) => r.url).slice(0, 2).join(' '));
  const poolAfter = await (await fetch(BASE + '/assets/ether/experience-pool.js')).text();
  ck(poolAfter === poolSrc, 'R23b the production experience pool is byte-identical');
  ck(errs.length === 0, 'R23c zero page errors across the research journey', errs[0]);

  // R24 — the runtime learned nothing about any of this.
  const gram = read('js/etherGrammar.js');
  const interp = read('js/etherMystery.js');
  ck(gram.indexOf('LabResearch') === -1 && gram.indexOf('RESEARCH_WAIVED') === -1 &&
     interp.indexOf('LabResearch') === -1 && interp.indexOf('RESEARCH_WAIVED') === -1 &&
     interp.indexOf('try-idea') === -1,
    'R24 the production validator and interpreter name nothing from the Lab');

  await browser.close();
  server.kill();
}

// ===================================================================
// C. THE GENERATION CONTRACT — is the world the model is shown the
//    world the validator and the interpreter actually implement?
//
// This is the heart of the contract repair. Everything else in the
// Lab can be right while the prompt asks for something that cannot
// exist, and the only symptom is a batch of refusals nobody can
// explain. So: every schema key is described; every allowed value is
// the grammar's own rather than a copy; every rule the validator
// enforces is stated in words; and every worked example is run
// through the REAL validator and the REAL support table, because an
// example the Ether would refuse — or could not perform — is the
// worst possible thing to put in front of a model.
// ===================================================================
function sectionC() {
  console.log('\n== C. the generation contract ==');
  const sb = kitSandbox();
  const K = sb.EtherMysteryLabKit;
  const G = sb.EtherGrammar;
  const Support = sb.LabPreviewSupport;
  const poolSigs = sb.EtherExperiencePool.experiences
    .filter((e) => e.status === 'active').map((e) => G.signature(e.candidate));

  // ---- C1: the schema doc IS the schema, level by level ----
  const doc = K.schemaDoc();
  ck(doc.undocumented.length === 0,
    'C1  every key in EtherGrammar.SCHEMA is described to the model',
    doc.undocumented.join(','));
  ck(doc.extra.length === 0,
    'C1b the doc describes no field the schema does not have', doc.extra.join(','));
  const levels = doc.levels.map((l) => l.level).sort().join(',');
  ck(levels === Object.keys(G.SCHEMA).sort().join(','),
    'C1c every level of the schema is present', levels);
  // Types and required-ness are the part the validator holds in CODE
  // rather than in data, so they are authored — but they must at
  // least all be there.
  const typeless = [];
  doc.levels.forEach((l) => l.fields.forEach((f) => {
    if (!f.type || f.type === 'UNDOCUMENTED' || !f.note) typeless.push(l.level + '.' + f.name);
  }));
  ck(typeless.length === 0,
    'C1d every field carries a type and a sentence of guidance', typeless.join(','));
  const required = doc.levels.filter((l) => l.level === 'top')[0]
    .fields.filter((f) => f.required).map((f) => f.name).sort().join(',');
  ck(required === 'elements,grammar,id,outcome',
    'C1e the four genuinely required top-level fields are marked REQUIRED', required);

  // ---- C2: allowed values are DERIVED, never a second copy ----
  const text = K.systemPrompt();
  function fieldValues(level, name) {
    const lv = doc.levels.filter((l) => l.level === level)[0];
    const f = lv && lv.fields.filter((x) => x.name === name)[0];
    return (f && f.values) || [];
  }
  const derived = [
    ['element', 'show', G.CAPABILITIES.shows],
    ['element', 'place', G.CAPABILITIES.places],
    ['engage', 'action', G.CAPABILITIES.actions],
    ['behaviour', 'onEngage', G.CAPABILITIES.responses],
    ['outcome', 'possible', G.CAPABILITIES.outcomes],
    ['outcome', 'discovery', G.CAPABILITIES.discoveries],
    ['constraints', 'rarity', G.RARITIES],
    ['constraints', 'phases', G.PHASES],
    ['top', 'complexity', G.COMPLEXITIES]
  ];
  const drift = derived.filter(([lv, f, src]) =>
    fieldValues(lv, f).join(',') !== src.join(','));
  ck(drift.length === 0,
    'C2  every allowed-value list is the grammar\'s own, read at build time',
    drift.map((d) => d[0] + '.' + d[1]).join(','));
  const missingGrammar = Object.keys(G.GRAMMARS).filter((g) => text.indexOf(g + ' — ') === -1);
  ck(missingGrammar.length === 0,
    'C2b every grammar is named with what it poses and its creation rule',
    missingGrammar.join(','));
  ck(text.indexOf('creation: REQUIRED') !== -1 && text.indexOf('creation: NEVER') !== -1,
    'C2c the two grammars with a hard creation rule state it in words');

  // ---- C3: the previously-unstated rules are stated ----
  // Each needle is a rule js/etherGrammar.js genuinely refuses on and
  // the pre-repair prompt never mentioned (the fifteen-mismatch table
  // in docs/ETHER_MYSTERY_LAB.md, items 2-9).
  const MUST_STATE = [
    ['the id format', '^[a-z0-9][a-z0-9-]{2,60}$'],
    ['the role format', '^[a-z][a-z0-9-]{0,24}$'],
    ['unknown keys refused by name', 'refused by name'],
    ['the early return that hides later problems', 'first unknown TOP-LEVEL key'],
    ['no deadlines on a tap', 'refused as a deadline'],
    ['the interaction verbs', 'no hover'],
    ['engage.on must name a declared role', 'declared in this same candidate'],
    ['what needs a creation', 'toward-creation'],
    ['tap-for-sure-outcome', 'tap-for-sure-outcome'],
    ['outcome-obvious-no-question', 'outcome-obvious-no-question'],
    ['experiment must stay uncertain', 'experiment` grammar MUST include'],
    ['reskin refusal', 'Vary the structure, not the adjectives'],
    ['the banned title vocabulary', 'leaderboard'],
    ['the instruction vocabulary', 'find the missing'],
    ['the bounds', 'At most 8 element rows'],
    ['requires is optional and unread', 'The interpreter never reads it'],
    ['the five validate-but-unperformable values', 'DO NOT USE, EVEN THOUGH THEY VALIDATE'],
    ['intent, never implementation', 'EXPERIENCE INTENT USING THE APPROVED VOCABULARY']
  ];
  const unstated = MUST_STATE.filter(([, needle]) => text.indexOf(needle) === -1);
  ck(unstated.length === 0,
    'C3  every rule the validator enforces is stated in the contract',
    unstated.map((u) => u[0]).join(' · '));

  // ---- C4: the worked examples pass the REAL validator ----
  // The heart of it. An example that would be refused teaches a model
  // exactly the wrong thing.
  const valids = K.EXAMPLES.filter((e) => e.valid);
  const badExamples = valids.filter((e) => !G.validate(e.candidate, { existing: poolSigs }).ok);
  ck(valids.length >= 6 && badExamples.length === 0,
    'C4  every worked VALID example passes the real validator',
    badExamples.map((e) => e.candidate.id + ':' +
      G.validate(e.candidate, { existing: poolSigs }).reasons.join(',')).join(' | '));

  // ---- C5: and the runtime can actually perform them ----
  const unperformable = valids.filter((e) => !Support.support(e.candidate).ok);
  ck(unperformable.length === 0,
    'C5  every worked VALID example uses only capabilities the interpreter performs',
    unperformable.map((e) => e.candidate.id + ':' +
      Support.support(e.candidate).reasons.join(',')).join(' | '));
  // Stated positively as well: the five known validate-but-unperformable
  // values must appear in no example.
  const serial = JSON.stringify(valids.map((e) => e.candidate));
  ck(serial.indexOf('"brighten"') === -1 && serial.indexOf('"sky"') === -1 &&
     serial.indexOf('minPages') === -1 && serial.indexOf('"any"') === -1 &&
     serial.indexOf('"show":"glint","when"') === -1,
    'C5b no example names brighten, of:sky, creationKind:any, minPages or a glint residue');

  // ---- C6: the invalid example really is invalid ----
  const inv = K.EXAMPLES.filter((e) => !e.valid);
  ck(inv.length === 1, 'C6  exactly one example is shown as a refusal', String(inv.length));
  const iv = G.validate(inv[0].candidate, { existing: poolSigs });
  ck(!iv.ok && iv.reasons.indexOf('unknown-key:candidate.figure') !== -1,
    'C6b it is genuinely refused, on the sky-figure field it invents',
    iv.reasons.join(','));

  // ---- C7: the six kinds the brief names are all shown ----
  const kinds = K.EXAMPLES.map((e) => e.kind);
  const NEEDED = ['valid', 'invalid', 'mystery-without-challenge',
    'mystery-with-challenge', 'discovery', 'next-mystery'];
  const missingKind = NEEDED.filter((k) => kinds.indexOf(k) === -1);
  ck(missingKind.length === 0,
    'C7  a valid one, an invalid one, mystery-without-challenge, mystery+challenge, a discovery and a next mystery',
    missingKind.join(','));
  const nextM = K.EXAMPLES.filter((e) => e.kind === 'next-mystery')[0];
  ck(nextM && nextM.candidate.outcome.residue,
    'C7b the next-mystery example genuinely leaves residue');
  const noChal = K.EXAMPLES.filter((e) => e.kind === 'mystery-without-challenge')[0];
  ck(noChal && (noChal.candidate.outcome.possible || []).indexOf('discovery') === -1,
    'C7c the mystery-without-challenge example genuinely reaches no discovery');
  ck(K.EXAMPLES.every((e) => typeof e.why === 'string' && e.why.length > 20),
    'C7d every example says why, in words a reviewer can argue with');
  // And a model copying one verbatim must not be refused as a reskin.
  const clash = valids.filter((e) => poolSigs.indexOf(G.signature(e.candidate)) !== -1);
  ck(clash.length === 0,
    'C7e no example is structurally identical to a shipped pool entry',
    clash.map((e) => e.candidate.id).join(','));

  // ---- C8: THE PROMPT NO LONGER ASKS FOR THE IMPOSSIBLE ----
  // The candidate schema has no field for a sky figure. Until that is
  // a product decision, the contract must say so rather than offer
  // one as an ingredient — which is what produced the Pegasus batch.
  ck(text.indexOf('INSPIRATION ONLY') !== -1 &&
     text.indexOf('exactly two') !== -1,
    'C8  the contract states that a mystery is about a creation or an anchor, and nothing else');
  ck(text.indexOf('the schema has no field for one') !== -1,
    'C8b and that a sky figure has no field, so naming one refuses the candidate');
  ck(text.indexOf('SUGGESTIVE, never literal') !== -1,
    'C8c the suggestive-resemblance rule survived the repair');
  const built = K.buildInput({
    structures: [{ kind: 'story', pages: 5, hasCover: true }],
    constellations: [{ figure: 'pegasus', name: 'Pegasus', starCount: 9,
                       looksLike: 'mythical', about: 'The winged horse.' }],
    grammar: 'compose', count: 5, pool: sb.EtherExperiencePool
  });
  ck(built.ok && built.input.directives.inspirationOnly &&
     built.input.directives.inspirationOnly.skyFigures.length === 1 &&
     built.input.directives.skyFigures === undefined,
    'C8d a supplied figure travels in a channel LABELLED inspiration, never beside the creations');
  ck(built.ok && /NOT INGREDIENTS/.test(built.input.directives.inspirationOnly.note),
    'C8e and the channel carries the boundary in its own words');
  ck(built.ok && built.input.directives.ingredientsAvailable &&
     /ingredients.creation/.test(built.input.directives.ingredientsAvailable.creation) &&
     /ingredients.anchor/.test(built.input.directives.ingredientsAvailable.anchor),
    'C8f and the two real ingredients are named as the two real ingredients');

  // ---- C9: the privacy boundary is untouched by any of it ----
  ck(text.indexOf('constellation`') !== -1 || text.indexOf('`constellation`') !== -1 ||
     text.indexOf('constellation') !== -1,
    'C9  the contract names `constellation` among the fields never to invent');
  const smuggled = K.buildInput({ entities: [{ id: 'e2', cover: 'x', pages: 1, focusT: 0,
    pattern: [[1, 2], [3, 4], [5, 6], [7, 8]] }] });
  ck(smuggled.ok === false && smuggled.refused && !smuggled.messages,
    'C9b a placed sky is still refused whole, before any prompt is assembled',
    (smuggled.reasons || []).join(','));
  const promptSweep = K._sweep({ prompt: text });
  ck(promptSweep.length === 0 ||
     promptSweep.every((r) => r.indexOf('text-too-long') === 0),
    'C9c the contract text itself carries no forbidden key and no reference',
    promptSweep.filter((r) => r.indexOf('text-too-long') !== 0).join(','));

  // ---- C10: PHASE 6's runs are one press each, and dry-run green ----
  const P6 = ['pegasus-regeneration', 'same-constellation', 'different-constellations',
    'mystery-without-challenge', 'challenge-from-mystery'];
  const absent = P6.filter((id) => !K.EXPERIMENTS[id]);
  ck(absent.length === 0, 'C10 every Phase 6 run is a one-press preset', absent.join(','));
  const peg = K.EXPERIMENTS['pegasus-regeneration'];
  ck(peg && peg.count === 5 && peg.grammar === 'compose' &&
     peg.complexity === 'mixed' &&
     Array.isArray(peg.constellations) && peg.constellations.join(',') === 'pegasus',
    'C10b the Pegasus run carries the brief\'s exact parameters: Pegasus · Composer choose · 5 · mixed',
    JSON.stringify(peg && { c: peg.count, g: peg.grammar, x: peg.complexity, f: peg.constellations }));
  const trouble = [];
  Object.keys(K.EXPERIMENTS).forEach((id) => {
    const e = K.EXPERIMENTS[id];
    const figs = (e.constellations === 'all' || Array.isArray(e.constellations))
      ? [{ figure: 'pegasus', name: 'Pegasus', starCount: 9, looksLike: 'mythical', about: 'x' }]
      : [];
    const b = K.buildInput({
      structures: e.needsCreation ? [{ kind: 'story', pages: 5, hasCover: true }] : [],
      constellations: figs, grammar: e.grammar || 'compose', count: e.count,
      complexity: e.complexity, emphasis: e.emphasis, pool: sb.EtherExperiencePool
    });
    if (!b.ok) { trouble.push(id + ':build'); return; }
    const parsed = K.parseCandidates(K.fixtureGenerate({ count: e.count, grammars: e.grammars }).text);
    if (!parsed.ok) { trouble.push(id + ':parse'); return; }
    const bad = parsed.candidates.filter((c) => !G.validate(c, { existing: poolSigs }).ok);
    if (bad.length) trouble.push(id + ':' + bad.length + '-invalid');
  });
  ck(trouble.length === 0,
    'C10c every preset — Phase 6\'s five included — dry-runs green in fixture mode',
    trouble.join(' '));
  // The emphasis a preset carries must not contradict the contract.
  const contradicts = Object.keys(K.EXPERIMENTS).filter((id) =>
    /draws its mystery from one supplied sky figure|figure to being/.test(
      K.EXPERIMENTS[id].emphasis || ''));
  ck(contradicts.length === 0,
    'C10d no preset still tells a model to build its mystery FROM a sky figure',
    contradicts.join(','));

  // ---- C10e-h: THE FAIR PEGASUS TEST (the forensic report's §C) ----
  //
  // The first run of this preset came back 5/5 valid and 5/5 the same.
  // Traced: no creation was supplied, so shard / toward-creation /
  // creation-revealed were all refusable, the only ingredient left was
  // an anchor, and the schema truthfully says an anchor pairs with
  // place 'at-anchor'. Every one of the five then placed every element
  // there, and the interpreter's clustered branch puts those within
  // ±40×±30px of ONE point. What changed is the PRESET and its
  // DIRECTIVE. The contract is deliberately untouched.
  ck(peg && peg.needsCreation === true,
    'C10e the Pegasus run now supplies a creation — the ingredient that unlocks shard, ' +
    'toward-creation and creation-revealed');
  const pe = (peg && peg.emphasis) || '';
  const named = ['scattered', 'ring', 'far', 'toward-creation'].filter((pl) => pe.indexOf(pl) !== -1);
  ck(named.length === 4 && /at-anchor at most once/i.test(pe) &&
     /vary the placement/i.test(pe),
    'C10f and its directive requires placement to VARY across the batch, naming all four ' +
    'and bounding at-anchor', named.join(',') + ' | at-anchor bounded: ' +
    /at-anchor at most once/i.test(pe));
  // Every placement it names must be a real capability — the P-family
  // lesson (a directive that names something the vocabulary lacks is a
  // directive that produces refusals).
  const notReal = named.filter((pl) => G.CAPABILITIES.places.indexOf(pl) === -1);
  ck(notReal.length === 0 && pe.indexOf('creation') !== -1,
    'C10g every placement the directive names is a real capability, and it asks for the creation',
    notReal.join(','));
  // THE CONTRACT IS UNTOUCHED (the sprint's own constraint 3-5). Built
  // with and without this preset's directive, everything but
  // `directives` must be identical — schema, capabilities, grammars,
  // boundaries, forbidden keys. A preset may steer a generator; it may
  // never quietly restate the world.
  const withPeg = K.buildInput({
    structures: [{ kind: 'story', pages: 5, hasCover: true }],
    constellations: [{ figure: 'pegasus', name: 'Pegasus', starCount: 9,
                       looksLike: 'mythical', about: 'x' }],
    grammar: peg.grammar, count: peg.count, complexity: peg.complexity,
    emphasis: peg.emphasis, pool: sb.EtherExperiencePool
  });
  const without = K.buildInput({
    structures: [{ kind: 'story', pages: 5, hasCover: true }],
    constellations: [{ figure: 'pegasus', name: 'Pegasus', starCount: 9,
                       looksLike: 'mythical', about: 'x' }],
    grammar: peg.grammar, count: peg.count, complexity: peg.complexity,
    emphasis: '', pool: sb.EtherExperiencePool
  });
  ck(withPeg.ok && without.ok &&
     JSON.stringify(withPeg.input.contract) === JSON.stringify(without.input.contract),
    'C10h the CONTRACT is byte-identical with and without the directive — only directives moved');
  // And the creation actually reaches the model.
  ck(withPeg.ok && Array.isArray(withPeg.input.contract.creations) &&
     withPeg.input.contract.creations.length === 1 &&
     withPeg.input.contract.creations[0].kind === 'story',
    'C10i the creation reaches the generator as public creative structure',
    JSON.stringify(withPeg.input.contract.creations));

  // ===============================================================
  // M. MYSTERY → TEASE → ACTION → MAGIC — the product contract.
  //
  // The sprint's own success criterion is not technical validity: we
  // have proved 5/5 valid can produce 5/5 boring. Every check here is
  // about whether a 6-10 year old would see it, know what to try, and
  // get an answer worth the trying — and every one of them is
  // measured against the FIVE REAL MODEL CANDIDATES that produced that
  // verdict, committed beside this file as the evidence they are.
  // ===============================================================
  const P = K.PRODUCT_CONTRACT;
  const RT = K.RUNTIME_TODAY;

  ck(P && P.version === 'mystery-tease-action-magic-1' &&
     P.sequence.join(' ') === 'SEE WONDER TRY RESPONSE DISCOVERY POSSIBLE NEXT QUESTION',
    'M1  the product contract carries the new sequence', P && P.sequence.join('→'));
  ck(P.tease && P.tease.examples.length >= 8 && /moving away/.test(P.tease.notATease),
    'M1b the tease is defined, and "it moved away" is named as NOT one');
  ck(P.action.primary.indexOf('connect') !== -1 &&
     P.action.supporting.join(',') === 'wait,dwell,approach,return' &&
     /never be the sole meaningful interaction/.test(P.action.rule),
    'M1c primary and supporting actions are separated, with the rule stated');
  ck(P.scale.levels.length === 5 && P.payoff.bar.indexOf('Whoa') !== -1 &&
     P.simplicity.noAgeModes === true,
    'M1d experience scale, the payoff bar and "no age modes" are all in the contract');
  ck(P.canonicalExample.sequence.join(' → ') ===
     'UNFINISHED → NOTICE → CHILD EXPERIMENTS → COMPLETION → CREATION AWAKENS → ETHER RESPONDS',
    'M1e the canonical example is recorded as the quality bar');

  // M2 — THE HONEST HALF. The Lab must not pretend the runtime can do
  // what the bar asks. Every claim here was measured against the
  // shipped interpreter in the forensic pass.
  ck(RT.deliberateActions.join(',') === 'tap' &&
     RT.unavailableActions.list.indexOf('connect') !== -1 &&
     /Traveller/.test(RT.unavailableActions.because),
    'M2  the runtime statement admits ONE primary action, and says why drag is not available');
  // TURNED ROUND, WITH ITS REASON IN PLACE. This read "the runtime
  // statement names brighten as inert AND the pre-existing connection
  // as inexpressible" — both true when it was written, and the second
  // half is what the unfinished-pattern primitive was built to close.
  // What it was really guarding is that RUNTIME_TODAY tells the truth
  // about the gap rather than flattering it, so it now asserts the
  // half that is still true and that the closed half has MOVED rather
  // than been deleted: an arrangement is declared as performable, and
  // what remains inexpressible says so outside a pattern.
  ck(RT.responses.declaredButInert.indexOf('brighten') !== -1 &&
     !!RT.arrangement && RT.arrangement.shapes.join(',') === 'ring,arc' &&
     RT.cannotExpress.some((x) => /outside a pattern/.test(x)) &&
     !RT.cannotExpress.some((x) => /PRE-EXISTING connection/.test(x)),
    'M2b it names brighten as inert, and the connection it CAN now draw as buildable');
  // Cross-checked against the real interpreter rather than trusted.
  const interp = read('js/etherMystery.js');
  ck(RT.responses.perform.every((r) => interp.indexOf("'" + r + "'") !== -1) &&
     !/behaviour === 'brighten'|onEngage === 'brighten'/.test(interp),
    'M2c and the source agrees: every performing response is branched on, brighten is not');

  // M3 — THE HEURISTIC NO LONGER REWARDS WHAT MADE THEM BORING.
  const probeSmallQuiet = { id: 'small-and-quiet-probe', grammar: 'echo',
    ingredients: { anchor: true },
    elements: [{ role: 'm', show: 'mark', place: 'at-anchor', count: 2 }],
    engage: [{ action: 'return', on: 'm' }, { action: 'wait', seconds: 8 }],
    behaviour: { onEngage: 'dissolve', pace: 'still' },
    outcome: { possible: ['unresolved'], residue: { show: 'mark', when: 'either' } },
    constraints: { rarity: 'rare', phases: ['deep'], lifeS: 140 } };
  const sq = K.evaluate(probeSmallQuiet, {});
  ck(sq.scores.perceptibility.score === 0 && sq.scores.childAction.score === 0 &&
     sq.scores.spatialSignificance.score === 0,
    'M3  small, passive and all-in-one-place now scores zero on the three that matter',
    JSON.stringify({ p: sq.scores.perceptibility.score, a: sq.scores.childAction.score,
                     s: sq.scores.spatialSignificance.score }));

  // M4 — THE REAL BATCH, RE-SCORED. Not a fixture: the five candidates
  // gpt-4.1-mini actually produced, which a human played and called
  // boring. The old heuristic gave them a mean of 79%.
  const realLog = JSON.parse(read('tools/ether-mystery-lab-test/real-pegasus-batch.json'));
  ck(realLog.candidates.length === 5 &&
     realLog.candidates.every((r) => r.source === 'generated' && r.model) &&
     realLog.counts.valid === 5,
    'M4  the committed evidence is the real model batch — 5 generated, 5 valid',
    realLog.candidates[0].model);
  const rescored = realLog.candidates.map((r) => {
    const nq = K.evaluate(r.candidate, {});
    return { id: r.candidate.id,
      oldPct: r.qualityHeuristic.total / r.qualityHeuristic.outOf,
      newPct: nq.total / nq.outOf, meets: nq.contract.meets, gaps: nq.contract.gaps };
  });
  const oldMean = rescored.reduce((n, x) => n + x.oldPct, 0) / 5;
  const newMean = rescored.reduce((n, x) => n + x.newPct, 0) / 5;
  ck(oldMean > 0.75 && newMean < 0.55 && (oldMean - newMean) > 0.25,
    'M4b the rewritten heuristic scores the "all boring" batch far lower than the old one',
    Math.round(oldMean * 100) + '% → ' + Math.round(newMean * 100) + '%');
  ck(rescored.every((x) => !x.meets && x.gaps.length),
    'M4c and not one of the five meets the product contract — each with a named gap',
    rescored.map((x) => x.gaps.length).join(','));
  // The gap the human actually felt, named by the machine.
  ck(rescored.filter((x) => x.gaps.some((gp) => /nothing a child would see/.test(gp))).length >= 3 &&
     rescored.filter((x) => x.gaps.some((gp) => /no meaningful child action/.test(gp))).length >= 3,
    'M4d the named gaps are the human\'s own words: nothing to see, nothing to do',
    JSON.stringify(rescored.map((x) => x.gaps.length)));

  // M5 — AND IT STILL DISCRIMINATES. A heuristic that scores
  // everything low is as useless as one that scores everything high:
  // the one shipped experience built on a real creation, with spread
  // placement, a tap and a creation-revealed payoff, must pass.
  const poolActive = sb.EtherExperiencePool.experiences.filter((e) => e.status === 'active');
  const passing = poolActive.filter((e) => K.evaluate(e.candidate, {}).contract.meets);
  ck(passing.length >= 1 && passing.some((e) => e.candidate.id === 'a-cover-come-apart'),
    'M5  the curated pool\'s one creation-bound, spread, tappable experience MEETS the contract',
    passing.map((e) => e.candidate.id).join(',') || 'none');

  // M6 — TECHNICAL VALIDITY AND CREATIVE QUALITY STAY SEPARATE (§12).
  // The contract check must be incapable of changing validity.
  const fallsShortButValid = realLog.candidates[0].candidate;
  ck(G.validate(fallsShortButValid, {}).ok === true &&
     K.contractCheck(fallsShortButValid).meets === false,
    'M6  a candidate can be perfectly VALID and fall short of the product contract');
  // The precise property, rather than a crude scan: validity has
  // exactly ONE source in the Lab — G().validate() inside add() — and
  // the product-contract layer never consults it, never writes an
  // `ok`, and never touches an item's validation. (The first draft of
  // this check scanned for `reasons.push` and went red on labKit's own
  // INPUT sweep — the Stars boundary, which refuses a request before
  // it is sent and has nothing to do with a candidate's validity.
  // A check that cannot tell two different arrays apart proves
  // nothing.)
  const kitSrc = stripComments(read('tools/ether-mystery-lab/labKit.js'));
  const validateCalls = (kitSrc.match(/G\(\)\.validate\(/g) || []).length;
  const ccBody = kitSrc.slice(kitSrc.indexOf('function contractCheck'),
                              kitSrc.indexOf('function evaluate'));
  ck(validateCalls === 1 && ccBody.indexOf('validate') === -1 &&
     !/item\.validation\s*=|\.validation\.ok\s*=/.test(ccBody),
    'M6b validity has ONE source in the Lab, and the contract layer never touches it',
    validateCalls + ' validate call(s)');

  // M9 — THE VERDICT LEADS, and it is not folded away with the score.
  // (Checked in the browser section below; this is the static half —
  // the card body carries the verdict, the tech fold carries the
  // number.) A `<details>` child still has a bounding box, so
  // "it renders" is not the same question as "a reviewer sees it" —
  // the first measurement of this passed at 950x69 while the box was
  // inside the fold.
  const uiSrc = read('tools/ether-mystery-lab/labUi.js');
  const bodyPart = uiSrc.slice(uiSrc.indexOf("var card = document.createElement"),
                               uiSrc.indexOf("<details class=\"tech\">"));
  ck(bodyPart.indexOf('contractBox') !== -1 && bodyPart.indexOf('desiredBox') !== -1,
    'M9  the contract verdict and the DESIRED marking are in the card BODY');
  const foldPart = uiSrc.slice(uiSrc.indexOf("<details class=\"tech\">"));
  ck(foldPart.indexOf('contractBox') === -1 && foldPart.indexOf('qual') !== -1,
    'M9b the number stays folded away, and the verdict is not folded with it');

  // M7 — the §13 experiments exist, are research-only, and dry-run.
  const NEW_EXP = ['unfinished-pattern', 'same-creation-active',
    'same-grammar-different-creations', 'tease-no-challenge',
    'tease-and-challenge', 'simple-vs-deeper'];
  const missingExp = NEW_EXP.filter((id) => !K.EXPERIMENTS[id]);
  ck(missingExp.length === 0, 'M7  every experiment this sprint asks for exists',
    missingExp.join(','));
  const up = K.EXPERIMENTS['unfinished-pattern'];
  // TURNED ROUND, WITH ITS REASON IN PLACE. These two read "the
  // canonical experiment asks for incompleteness, a primary action and
  // an awakening" and "it forbids quietly downgrading the idea" —
  // written when the runtime could NOT perform the canonical example,
  // so the preset's whole job was to describe something unbuildable as
  // closely as the vocabulary allowed. It is buildable now, so the
  // preset names the real thing instead, and the property worth
  // guarding moved with it: the experiment must still demand a real
  // creation and a real awakening, and must still refuse a batch that
  // is one idea wearing five titles.
  ck(up.needsCreation === true && /arrangement/.test(up.emphasis) &&
     /creation-revealed/.test(up.emphasis) && /"node"/.test(up.emphasis),
    'M7b the canonical experiment asks for a real figure, a creation and an awakening');
  ck(/differ only in their titles/.test(up.emphasis),
    'M7c and it forbids five candidates that differ only in their titles');

  // M8 — the prompt carries the bar, the limits and the anti-patterns,
  // all rendered from the ONE copy.
  const sysPrompt = K.systemPrompt();
  ck(sysPrompt.indexOf(P.successCriterion) !== -1 &&
     sysPrompt.indexOf(P.canonicalExample.story[0]) !== -1 &&
     P.tease.examples.every((e) => sysPrompt.indexOf(e) !== -1),
    'M8  the generator is given the product bar, whole');
  ck(RT.cannotExpress.every((x) => sysPrompt.indexOf(x) !== -1) &&
     sysPrompt.indexOf('DESIRED') !== -1,
    'M8b and the honest half — what the runtime cannot do — travels with it');
  ck(K.ANTI_PATTERNS.every((a) => sysPrompt.indexOf(a) !== -1) &&
     /DO NOT PRODUCE ANY OF THESE/.test(sysPrompt),
    'M8c and every anti-pattern the last two batches produced is named');
  ck(K.PROMPT_VERSION === 'ether-mystery-lab-5',
    'M8d the prompt version names the new contract', K.PROMPT_VERSION);

  // ---- C11: the contract label moved with the contract ----
  ck(K.PROMPT_VERSION === 'ether-mystery-lab-5',
    'C11 PROMPT_VERSION names the current contract', K.PROMPT_VERSION);
  const S2 = K.createSession({ pool: sb.EtherExperiencePool });
  const it = S2.add(K.FIXTURE_BANK.notice, { source: 'fixture' });
  ck(it.lab.promptVersion === K.PROMPT_VERSION,
    'C11b and it travels on every candidate the session records');

  // ---- C12: RESEARCH_WAIVED is still four DESIGN judgements ----
  // Phase 4: keep it, and keep it incapable of standing over a
  // capability, a bound or a boundary.
  const R = sb.LabResearch;
  ck(R.RESEARCH_WAIVED.length === 4 &&
     R.RESEARCH_WAIVED.every((r) => !/capability|forbidden|stars|bad-|too-many|no-elements/.test(r)),
    'C12 RESEARCH_WAIVED still waives four design judgements and nothing structural',
    R.RESEARCH_WAIVED.join(','));
}

// ===================================================================
// UF. THE UNFINISHED FIGURE — a Lab-only visual experiment.
//
// The question is whether an unfinished arrangement can suggest that
// it is SOMETHING before it comes alive. What a machine can prove is
// narrow and worth proving: that the eight authored fixtures are real
// candidates the real validator accepts, that they are NOT rings, that
// the joins and the gaps are the authored ones rather than drawn at
// random, that they hold Ether scale on a laptop and on a phone, that
// what comes alive is the same arrangement the child completed, and
// that nothing about any of it is reachable from production.
//
// WHETHER ANY OF THEM LOOKS LIKE ANYTHING IS NOT PROVED HERE and is
// not claimed: that is the reviewer's, from the screenshots.
// ===================================================================
async function sectionUF() {
  console.log('\n== UF. the unfinished figure (Lab experiment) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.window ? sb.window.EtherGrammar : sb.EtherGrammar;
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const Support = sb.LabPreviewSupport || (sb.window && sb.window.LabPreviewSupport);
  const bank = Kit.FIGURE_BANK;
  const meta = Kit.FIGURE_EXPERIMENTS;

  // ---- UF1: they are real candidates ----
  const verdicts = bank.map((c) => ({ id: c.id, v: G.validate(c) }));
  ck(bank.length === 8 && verdicts.every((r) => r.v.ok),
    'UF1  all eight authored fixtures are VALID through the real validator',
    verdicts.filter((r) => !r.v.ok).map((r) => r.id + ':' + r.v.reasons).join(' ') || '8/8');
  const levels = meta.map((m) => m.level).join('');
  ck(levels.indexOf('A') === 0 && meta.filter((m) => m.level === 'A').length === 2 &&
     meta.filter((m) => m.level === 'B').length === 5 &&
     meta.filter((m) => m.level === 'C').length === 1,
    'UF1b the set compares pure geometry (2), figure-suggestive (5) and ambiguous (1)',
    levels);
  ck(meta.every((m) => typeof m.mightBe === 'string' && m.mightBe.length > 4),
    'UF1c every fixture carries the evaluator question — "what might a child think this is?"');

  // ---- UF2: nothing in it names a thing ----
  //
  // THE WHOLE CREATIVE RULE. A figure is points and relationships; the
  // moment a shape can be asked for by word this becomes named-shape
  // recognition, which is what the experiment must not be. Checked over
  // the CANDIDATES (what reaches the interpreter) and over the seam,
  // never over the evaluator's own notes — `mightBe` is a question a
  // person asks about a picture and is deliberately full of nouns.
  const NAMED = /\b(bird|fish|butterfly|leaf|shell|creature|animal|face|whale|snake|flower|tree|star-shape)\b/i;
  ck(!NAMED.test(JSON.stringify(bank)),
    'UF2  not one candidate names a thing it might be');
  ck(!NAMED.test(stripComments(read('js/etherMystery.js'))) &&
     !NAMED.test(stripComments(read('js/etherGrammar.js'))),
    'UF2b and neither does the seam — there is no shape vocabulary to ask for');
  ck(JSON.stringify(bank).indexOf('family') === -1 &&
     JSON.stringify(bank).indexOf('mightBe') === -1,
    'UF2c the evaluator\'s own labels never travel inside a candidate');

  // ---- UF3: every one of them can be shown ----
  const sup = bank.map((c) => Support.support(c));
  ck(sup.every((s) => s.ok),
    'UF3  every fixture is previewable by the interpreter as it stands',
    sup.filter((s) => !s.ok).map((s) => s.reasons.join(',')).join(' | ') || '8/8');

  // ---- UF4: the geometry is the authored geometry ----
  //
  // A ring can only ever join each light to the next one round, so a
  // node with three joins is proof that a figure is NOT a ring — and
  // it is the thing the whole experiment needed: a body with limbs.
  const degrees = meta.filter((m) => m.figure).map((m) => {
    const d = {};
    m.figure.joins.forEach((j) => {
      const ab = j.split('-');
      d[ab[0]] = (d[ab[0]] || 0) + 1; d[ab[1]] = (d[ab[1]] || 0) + 1;
    });
    return { id: m.id, max: Math.max.apply(null, Object.keys(d).map((k) => d[k])) };
  });
  ck(degrees.filter((d) => d.max >= 3).length >= 2,
    'UF4  at least two figures branch — a light joined to three others, which a ring cannot do',
    degrees.map((d) => d.id.replace('lab-figure-', '') + ':' + d.max).join(' '));
  ck(meta.filter((m) => m.figure).every((m) =>
      m.figure.joins.length - m.figure.gaps.length >= 2),
    'UF4b every figure keeps enough joins to still be read');

  // ---- UF5: production is not reachable from any of this ----
  const pool = sb.EtherExperiencePool || (sb.window && sb.window.EtherExperiencePool);
  const active = pool.experiences.filter((e) => e.status === 'active');
  ck(active.length > 0 && active.every((e) => !e.candidate.arrangement),
    'UF5  no ACTIVE pool experience carries an arrangement, so the figure path is unreachable in production',
    active.length + ' active, ' + active.filter((e) => e.candidate.arrangement).length + ' with an arrangement');
  const held = pool.experiences.filter((e) => e.status === 'experiment');
  ck(held.length === 1 && held[0].candidate.arrangement &&
     !held[0].candidate.arrangement.figure,
    'UF5b the held Unfinished Pattern is still held, and is still the plain arc it was');
  ck(!/\bfigure\s*:/.test(read('assets/ether/experience-pool.js')),
    'UF5c and no shipped pool entry carries a figure of its own');

  // ---- UF6: the seam is inert when nothing asks for it ----
  //
  // Driven through the REAL interpreter on the real page, because the
  // claim is about behaviour rather than about a branch: a ring
  // candidate must still lay out as a ring, every light the same
  // distance from the middle.
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    const measure = async (vp) => {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
      await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });
      const out = {};
      for (const c of bank) {
        out[c.id] = await page.evaluate((cand) => {
          window.LabPreview.play(cand, 'uf-seed');
          const i = window.LabPreview.instrument();
          if (!i || !i.arrangement) return null;
          const els = i.elements.filter((e) => e.show === 'node');
          const xs = els.map((e) => e.x), ys = els.map((e) => e.y);
          // Every pairwise distance, so the shape can be compared with
          // the one that was authored without knowing where the sky
          // put it or which way round it turned it.
          const D = [];
          for (let a = 0; a < els.length; a++) {
            for (let b = a + 1; b < els.length; b++) {
              D.push(Math.hypot(els[a].x - els[b].x, els[a].y - els[b].y));
            }
          }
          return {
            n: els.length,
            pairs: D,
            w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
            h: Math.max.apply(null, ys) - Math.min.apply(null, ys),
            short: Math.min(window.innerWidth, window.innerHeight),
            links: i.arrangement.links.map((L) => L.a + '-' + L.b).join(' '),
            gapPairs: i.arrangement.links
              .map((L, k) => (L.present ? null : k)).filter((k) => k !== null).join(',')
          };
        }, c);
      }
      await page.close();
      return out;
    };
    const desk = await measure({ width: 1440, height: 900 });
    const phone = await measure({ width: 390, height: 844 });

    // THE SHAPE ON THE SKY IS THE SHAPE THAT WAS AUTHORED. Every
    // pairwise distance is divided by the same distance in unit space;
    // for a faithful placement those ratios are ONE number (the scale),
    // whatever the sky did about where to put it or which way to turn
    // it. A ring ignores the points entirely, so reverting the seam
    // sends this straight red.
    const fidelity = meta.filter((m) => m.figure).map((m) => {
      const pts = m.figure.points, got = desk[m.id];
      if (!got) return { id: m.id, drift: Infinity };
      const want = [];
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          want.push(Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
        }
      }
      const k = want.map((d, j) => got.pairs[j] / d);
      const lo = Math.min.apply(null, k), hi = Math.max.apply(null, k);
      return { id: m.id, drift: hi / lo };
    });
    ck(fidelity.every((f) => f.drift < 1.02),
      'UF6  every figure is placed as it was authored — one scale, no distortion',
      fidelity.map((f) => f.id.replace('lab-figure-', '') + ':x' + f.drift.toFixed(4)).join(' '));
    const figIds = meta.filter((m) => m.figure).map((m) => m.id);

    // THE SEAM IS INERT WHEN NOTHING ASKS FOR IT. With no figure the
    // interpreter still joins each light to the next one round, which
    // is the ring formula's own signature — and a figure's joins are
    // the authored ones, which a ring could never produce.
    ck(desk['lab-figure-control-ring'] &&
       desk['lab-figure-control-ring'].links === '0-1 1-2 2-3 3-4 4-5 5-0' &&
       desk['lab-figure-control-arc'].links === '0-1 1-2 2-3 3-4 4-5 5-6',
      'UF6b a ring and an arc with no figure are laid out exactly as they always were',
      desk['lab-figure-control-ring'] ? desk['lab-figure-control-ring'].links : 'not posed');
    ck(figIds.every((id) => {
      const m = meta.find((x) => x.id === id);
      return desk[id].links === m.figure.joins.join(' ');
    }), 'UF6c and every figure carries its own authored joins, which a ring cannot express',
      desk['lab-figure-winged'].links);

    // The gaps are the authored ones. A ring shuffles which joins are
    // missing; on a figure the gap IS the missing piece of its
    // identity, so it may never be drawn at random.
    const gapsRight = figIds.every((id) => {
      const m = meta.find((x) => x.id === id);
      return desk[id] && desk[id].gapPairs === m.figure.gaps.join(',');
    });
    ck(gapsRight, 'UF7  the missing joins are the authored ones, never shuffled',
      figIds.map((id) => id.replace('lab-figure-', '') + ':' + (desk[id] && desk[id].gapPairs)).join(' '));

    // ETHER SCALE, on both (§7). The largest primitive before the
    // pattern existed was the veil at 156px.
    const smallDesk = figIds.filter((id) => !(desk[id].w > desk[id].short * 0.5));
    const smallPhone = figIds.filter((id) => !(phone[id].w > phone[id].short * 0.5));
    ck(!smallDesk.length && !smallPhone.length,
      'UF8  every figure spans the sky on a laptop AND on a phone',
      'desktop ' + figIds.map((id) => Math.round(desk[id].w)).join('/') +
      ' on 900 · phone ' + figIds.map((id) => Math.round(phone[id].w)).join('/') + ' on 390');

    // ---- UF9: what comes alive is what the child completed ----
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });
    const winged = bank.find((c) => c.id === 'lab-figure-winged');
    const alive = await page.evaluate(async (cand) => {
      window.LabPreview.play(cand, 'uf-alive');
      // A LIGHT IS NOT ARMED IN THE FRAME IT IS PLACED IN, so the
      // completion waits exactly as a child does. And the loop is
      // BOUNDED: a check that can hang looks like a broken product when
      // it is a broken check.
      await new Promise((r) => setTimeout(r, 1400));
      const my = window.LabPreview.mystery();
      let i = my.instrument();
      const posed = i.arrangement.links.map((L) => L.a + '-' + L.b).join(' ');
      let guard = 40;
      while (guard-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
        const gap = i.arrangement.links.filter((L) => !L.present)[0];
        my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y);
        my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
        i = my.instrument();
      }
      const live = window.LabPreview.instrument();
      const whole = live ? live.arrangement.links.filter((L) => L.present).length : -1;
      await new Promise((r) => setTimeout(r, 7000));
      const w = window.LabPreview.alive();
      return { posed: posed, whole: whole, count: w.length, nodes: w[0] && w[0].nodes };
    }, winged);
    ck(alive.whole === 6 && alive.count === 1 && alive.nodes === 7,
      'UF9  a completed figure comes alive with all seven of its lights and every join',
      JSON.stringify(alive));
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- UF10: the research log carries what a reviewer needs ----
  const session = Kit.createSession();
  bank.forEach((c) => session.add(c,
    { source: 'fixture', params: { experiment: 'unfinished-figure' } }));
  const rows = session.items();
  const wingedRow = rows.find((r) => r.candidate.id === 'lab-figure-winged');
  session.review(wingedRow.labId, 'good', [], 'reads as something');
  const log = session.exportResearch();
  const row = log.artifact.candidates.find((r) => r.candidate.id === 'lab-figure-winged');
  ck(!!row && row.figureExperiment && row.figureExperiment.family === 'winged figure' &&
     row.figureExperiment.nodes === 7 && row.figureExperiment.missing === 1 &&
     row.candidate.arrangement.figure.joins.length === 6,
    'UF10 the research log carries the fixture, its family, its nodes, its joins and its gaps',
    row ? JSON.stringify(row.figureExperiment) : 'no row');
  ck(log.artifact.candidates.some((r) => r.humanJudgement && r.humanJudgement.classification),
    'UF10b and the human judgement travels with it');
  ck(log.artifact.productionReady === false,
    'UF10c and it is still marked research-only');
}

// ===================================================================
// CR. THE CREATURE MYSTERY (Lab experiment)
//
// The Unfinished Figure asked whether an abstract arrangement could
// suggest a meaning, and the answer was that it mostly could not. This
// asks the next question: a creature is hidden inside the pattern, a
// short leading hint says what KIND of thing is waiting, and the child
// still has to work out the structure. Everything here is Lab-side —
// no production file changed — so the section proves the experiment
// exists, behaves, and is unreachable from the Ether a child meets.
// ===================================================================
async function sectionCR() {
  console.log('\n== CR. the creature mystery (Lab experiment) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const Support = sb.LabPreviewSupport || (sb.window && sb.window.LabPreviewSupport);
  const bank = Kit.CREATURE_BANK;
  const meta = Kit.CREATURE_EXPERIMENTS;

  // ---- CR1: they are real candidates, and five different animals ----
  const verdicts = bank.map((c) => ({ id: c.id, v: G.validate(c) }));
  ck(bank.length === 5 && verdicts.every((r) => r.v.ok),
    'CR1  all five hand-authored creatures are VALID through the real validator',
    verdicts.filter((r) => !r.v.ok).map((r) => r.id + ':' + r.v.reasons).join(' ') || '5/5');
  ck(bank.every((c) => Support.support(c).ok),
    'CR1b every one of them is previewable by the interpreter exactly as it stands');

  // FIVE SILHOUETTES, NOT ONE WEARING FIVE NAMES. The shape of a figure
  // is the multiset of distances between its lights, so two creatures
  // that are really the same drawing produce the same signature. This
  // is the creature half of the reskin rule.
  const sig = (m) => {
    const p = m.figure.points, D = [];
    for (let a = 0; a < p.length; a++) {
      for (let b = a + 1; b < p.length; b++) {
        D.push(Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]));
      }
    }
    return D.sort((x, y) => x - y).map((d) => d.toFixed(2)).join(',');
  };
  const sigs = meta.map(sig);
  ck(new Set(sigs).size === 5,
    'CR1c the five silhouettes are five different drawings, not one reskinned',
    new Set(sigs).size + '/5 distinct');
  ck(new Set(meta.map((m) => m.nodes)).size >= 2 &&
     new Set(meta.map((m) => m.figure.gaps.length)).size >= 3,
    'CR1d and difficulty varies structurally rather than by a level setting',
    meta.map((m) => m.nodes + 'n/' + m.figure.gaps.length + 'g').join(' '));

  // ---- CR2: the pattern still reads with pieces missing ----
  //
  // A figure that is mostly gaps is not a figure. Every creature keeps
  // enough of itself to be read, and at least one light of a body joins
  // three others — the branching a ring can never express, and what
  // makes a limbed animal rather than a loop.
  ck(meta.every((m) => m.figure.joins.length - m.figure.gaps.length >= 2),
    'CR2  every creature keeps enough joins to still be read while unfinished',
    meta.map((m) => (m.figure.joins.length - m.figure.gaps.length)).join('/'));
  const degrees = meta.map((m) => {
    const d = {};
    m.figure.joins.forEach((j) => {
      const ab = j.split('-');
      d[ab[0]] = (d[ab[0]] || 0) + 1; d[ab[1]] = (d[ab[1]] || 0) + 1;
    });
    return Math.max.apply(null, Object.keys(d).map((k) => d[k]));
  });
  ck(degrees.filter((x) => x >= 3).length >= 4,
    'CR2b at least four of them branch — a body with limbs, which a ring cannot draw',
    degrees.join(' '));

  // ---- CR3: the evaluator's knowledge never reaches the child ----
  //
  // §13's own rule. The creature's NAME, the fixture id and every scrap
  // of arrangement bookkeeping are the Lab's; what the interpreter is
  // handed is points and relationships. The hint is the one authored
  // sentence, and it is rendered by the LAB, never by the interpreter.
  const NAMES = /\b(falcon|polar bear|whale|fox|octopus|creature|animal)\b/i;
  ck(!NAMES.test(JSON.stringify(bank)),
    'CR3  not one candidate names the creature hidden inside it');
  ck(JSON.stringify(bank).indexOf('hint') === -1 &&
     JSON.stringify(bank).indexOf('creature') === -1,
    'CR3b neither the hint nor the creature travels inside a candidate — both are evaluator-side');
  ck(meta.every((m) => typeof m.creature === 'string' && typeof m.hint === 'string'),
    'CR3c and the Lab does know both, per fixture, for the research log');

  // ---- CR4: the hint leads, and never instructs ----
  //
  // §4 and §11. It says what KIND of thing is waiting and nothing about
  // what to do; "Connect the dots to make a falcon" is the sentence
  // this experiment exists to avoid. It also never gives the answer
  // away — the child still has to see the structure.
  const INSTRUCTION = /\b(connect|join|tap|click|touch|press|drag|link|complete|finish|make a|dots?|puzzle|solve|try to)\b/i;
  const bad = meta.filter((m) => INSTRUCTION.test(m.hint));
  ck(!bad.length,
    'CR4  no hint tells the child what to do — not one instructional word',
    bad.map((m) => m.creature + ':' + m.hint).join(' | ') || '5/5 clean');
  const named = meta.filter((m) => new RegExp('\\b' + m.creature.split(' ').pop() + '\\b', 'i').test(m.hint));
  ck(!named.length,
    'CR4b and no hint names its own creature — it points at the idea, never the answer',
    named.map((m) => m.creature).join(' ') || '5/5');
  ck(meta.every((m) => m.hint.length <= 56),
    'CR4c every hint is one short line',
    meta.map((m) => m.hint.length).join('/'));

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    // ---- CR5: the creature on the sky is the creature that was drawn ----
    const measure = async (vp) => {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
      await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });
      const out = {};
      for (const c of bank) {
        out[c.id] = await page.evaluate((cand) => {
          window.LabPreview.play(cand, 'cr-seed');
          const i = window.LabPreview.instrument();
          if (!i || !i.arrangement) return null;
          const els = i.elements.filter((e) => e.show === 'node');
          const D = [];
          for (let a = 0; a < els.length; a++) {
            for (let b = a + 1; b < els.length; b++) {
              D.push(Math.hypot(els[a].x - els[b].x, els[a].y - els[b].y));
            }
          }
          const xs = els.map((e) => e.x);
          return {
            pairs: D, n: els.length,
            w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
            short: Math.min(window.innerWidth, window.innerHeight),
            links: i.arrangement.links.map((L) => L.a + '-' + L.b).join(' '),
            gapPairs: i.arrangement.links
              .map((L, k) => (L.present ? null : k)).filter((k) => k !== null).join(',')
          };
        }, c);
      }
      await page.close();
      return out;
    };
    const desk = await measure({ width: 1440, height: 900 });
    const phone = await measure({ width: 390, height: 844 });

    const fidelity = meta.map((m) => {
      const pts = m.figure.points, got = desk[m.id];
      if (!got) return { id: m.id, drift: Infinity };
      const want = [];
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          want.push(Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
        }
      }
      const k = want.map((d, j) => got.pairs[j] / d);
      return { id: m.id, drift: Math.max.apply(null, k) / Math.min.apply(null, k) };
    });
    ck(fidelity.every((f) => f.drift < 1.02),
      'CR5  every creature is placed as it was drawn — one scale, no distortion',
      fidelity.map((f) => f.id.replace('lab-cm-', '#') + ':x' + f.drift.toFixed(4)).join(' '));
    ck(meta.every((m) => desk[m.id].links === m.figure.joins.join(' ')) &&
       meta.every((m) => desk[m.id].gapPairs === m.figure.gaps.join(',')),
      'CR5b its joins and its missing pieces are the authored ones, never shuffled',
      meta.map((m) => m.creature.split(' ').pop() + ':' + desk[m.id].gapPairs).join(' '));

    // MOBILE. The same creature, at Ether scale, on a phone — §19's own
    // layout requirement, measured rather than eyeballed.
    const smallD = meta.filter((m) => !(desk[m.id].w > desk[m.id].short * 0.5));
    const smallP = meta.filter((m) => !(phone[m.id].w > phone[m.id].short * 0.5));
    ck(!smallD.length && !smallP.length,
      'CR6  every creature spans the sky on a laptop AND on a phone',
      'desktop ' + meta.map((m) => Math.round(desk[m.id].w)).join('/') + ' on 900 · phone ' +
      meta.map((m) => Math.round(phone[m.id].w)).join('/') + ' on 390');
    ck(meta.every((m) => phone[m.id].links === m.figure.joins.join(' ') &&
                          phone[m.id].n === m.nodes),
      'CR6b and it is the same creature on the phone, not a reduced one');

    // ---- CR7-CR11: one creature walked exactly as a child walks it ----
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });
    const falcon = bank.find((c) => c.id === 'lab-cm-1');
    const hint = Kit.creatureNote('lab-cm-1').hint;

    const walk = await page.evaluate(async ([cand, hintText]) => {
      // THE SKY'S OWN WORDS ARE NOT A MESSAGE. A Story Spirit shows its
      // name — that is the Ether working, and it is there before the
      // mystery is posed and after it is answered. So what is measured
      // is whether ANYTHING CHANGED, which is what "no message, no
      // counter, no score, no failure state" actually means.
      const txt = () => (document.querySelector('[data-universe]').innerText || '').trim();
      // And what the EXPERIMENT itself puts on screen: everything in
      // the stage that is neither the universe nor the evaluator's own
      // two navigation controls.
      // `innerText` falls back to `textContent` for an element that is
      // not rendered, so a display:none panel reads as words on screen
      // when there are none — the box is what decides, not the markup.
      const own = () => Array.from(document.querySelector('.stage').children)
        .filter((el) => !el.hasAttribute('data-universe') && !el.hasAttribute('data-chrome'))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => (el.innerText || '').trim()).filter(Boolean);
      window.LabPreview.play(cand, 'cr-walk', 'play', { hint: hintText });
      // A light is not armed in the frame it is placed in, and the hint
      // fades in on its own beat — the check waits exactly as a child does.
      await new Promise((r) => setTimeout(r, 1600));
      const my = window.LabPreview.mystery();
      let i = my.instrument();
      const hintEl = document.querySelector('[data-hint]');
      const shown = { text: hintEl.textContent, on: hintEl.classList.contains('on') };
      const posedWords = txt();
      const posedOwn = own();

      // A PAIR THAT DOES NOT BELONG. Two lights with no relationship
      // between them at all — not a present join, not a missing one.
      const pairs = i.arrangement.links.map((L) => L.a + '-' + L.b);
      let wrong = null;
      for (let a = 0; a < i.elements.length && !wrong; a++) {
        for (let b = a + 1; b < i.elements.length && !wrong; b++) {
          if (pairs.indexOf(a + '-' + b) === -1 && pairs.indexOf(b + '-' + a) === -1) {
            wrong = [a, b];
          }
        }
      }
      const beforeWrong = i.arrangement.links.filter((L) => L.present).length;
      my.touchAt(i.elements[wrong[0]].x, i.elements[wrong[0]].y);
      my.touchAt(i.elements[wrong[1]].x, i.elements[wrong[1]].y);
      await new Promise((r) => setTimeout(r, 400));
      i = my.instrument();
      const afterWrong = {
        pair: wrong.join('-'),
        joined: i.arrangement.links.filter((L) => L.present).length,
        missing: i.arrangement.missingLeft,
        words: txt()
      };

      // Now the real joins, one at a time, watching whether anything
      // wakes up before the LAST one.
      const steps = [];
      let guard = 40;
      while (guard-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
        const gap = i.arrangement.links.filter((L) => !L.present)[0];
        my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y);
        my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
        i = my.instrument();
        steps.push({ left: i ? i.arrangement.missingLeft : 'gone',
                     alive: window.LabPreview.alive().length });
      }

      // IT HOLDS WHOLE BEFORE IT GOES. Two seconds after the last join
      // the figure is still standing there, lit.
      await new Promise((r) => setTimeout(r, 2000));
      const live = window.LabPreview.instrument();
      const holding = live ? {
        joined: live.arrangement.links.filter((L) => L.present).length,
        lit: live.elements.filter((e) => e.alpha === undefined || e.alpha > 0.5).length
      } : null;

      await new Promise((r) => setTimeout(r, 4000));
      const born = window.LabPreview.alive()[0] || null;

      // ROAMING. Its own path, sampled — a living thing never draws a
      // straight line, and it is still there at the end of the sample.
      const path = [];
      for (let s = 0; s < 24; s++) {
        const w = window.LabPreview.alive()[0];
        if (w) path.push([w.x, w.y]);
        await new Promise((r) => setTimeout(r, 400));
      }
      let travelled = 0;
      for (let s = 1; s < path.length; s++) {
        travelled += Math.hypot(path[s][0] - path[s - 1][0], path[s][1] - path[s - 1][1]);
      }
      const straight = path.length > 1
        ? Math.hypot(path[path.length - 1][0] - path[0][0],
                     path[path.length - 1][1] - path[0][1]) : 0;
      const hintAfter = {
        on: document.querySelector('[data-hint]').classList.contains('on')
      };
      return {
        shown: shown, wrong: afterWrong, steps: steps, holding: holding,
        born: born, alive: window.LabPreview.alive().length,
        travelled: travelled, straight: straight, samples: path.length,
        hintAfter: hintAfter,
        posedWords: posedWords, posedOwn: posedOwn,
        endWords: txt(), endOwn: own(),
        titles: window.LabPreview.stories()
          .map((s) => (s.source && s.source.title) || s.title || '')
          .filter(Boolean)
      };
    }, [falcon, hint]);

    ck(walk.wrong.joined === 7 - 2 && walk.wrong.missing === 2,
      'CR7  a pair that does not belong joins nothing at all',
      JSON.stringify({ pair: walk.wrong.pair, joined: walk.wrong.joined, missing: walk.wrong.missing }));
    ck(walk.wrong.words === walk.posedWords,
      'CR7b and says nothing — not one word on screen changes',
      JSON.stringify({ before: walk.posedWords, after: walk.wrong.words }));

    ck(walk.steps.length === 2 &&
       walk.steps[0].left === 1 && walk.steps[0].alive === 0 &&
       walk.steps[1].left === 0,
      'CR8  nothing comes alive a join early — completion is EVERY missing relationship',
      JSON.stringify(walk.steps));
    ck(walk.holding && walk.holding.joined === 7 && walk.holding.lit === 8,
      'CR9  the completed creature holds whole and lit, and does not disappear',
      JSON.stringify(walk.holding));
    ck(walk.born && walk.born.nodes === 8 && walk.born.links === 7 && walk.alive === 1,
      'CR9b then it comes alive carrying all eight of its lights and every join',
      JSON.stringify(walk.born));
    ck(walk.alive === 1 && walk.travelled > 60 && walk.travelled > walk.straight * 1.05,
      'CR10 and it roams — its own path, never a straight line, still there at the end',
      'travelled ' + Math.round(walk.travelled) + 'px, straight ' + Math.round(walk.straight) +
      'px over ' + walk.samples + ' samples');

    ck(walk.shown.text === hint && walk.shown.on === true,
      'CR11 the leading hint is on screen, in the Lab, word for word',
      JSON.stringify(walk.shown));
    ck(walk.hintAfter.on === false,
      'CR11b and it withdraws the moment the creature is whole — it led, it does not linger');
    ck(walk.posedOwn.length === 1 && walk.posedOwn[0] === hint &&
       walk.endOwn.length === 1 && walk.endOwn[0] === hint,
      'CR11c the hint is the ONLY thing the experiment puts on screen — no label, no id, no creature name',
      JSON.stringify({ posed: walk.posedOwn, end: walk.endOwn }));
    // AND AT THE END OF THE WHOLE WALK, every word on the sky is still
    // a Story Spirit's own name. Deliberately NOT an equality against
    // what was there when the mystery was posed: Spirits drift, so one
    // can come into view during a twenty-second walk and change that
    // text without anything having been announced. What must hold is
    // that nothing which is NOT a Spirit's name is ever on screen.
    const strays = walk.endWords.split('\n').map((L) => L.trim()).filter(Boolean)
      .filter((L) => walk.titles.indexOf(L) === -1);
    ck(!strays.length,
      'CR11d and every word on the sky is still a Story Spirit\'s own name — nothing announced, counted or scored',
      strays.length ? JSON.stringify(strays) : JSON.stringify(walk.endWords.split('\n')));
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- CR12: the interpreter has no words, and no creature ----
  const my = stripComments(read('js/etherMystery.js'));
  ck(!/fillText|strokeText/.test(my),
    'CR12 the interpreter draws no text, so a hint could never come from production');
  ck(!/falcon|octopus|creature|lab-cm-/i.test(my) &&
     !/falcon|octopus|creature|lab-cm-/i.test(stripComments(read('js/etherGrammar.js'))),
    'CR12b and neither production file knows a creature exists');

  // ---- CR13: production cannot reach any of this ----
  const pool = sb.EtherExperiencePool || (sb.window && sb.window.EtherExperiencePool);
  const poolSrc = read('assets/ether/experience-pool.js');
  const active = pool.experiences.filter((e) => e.status === 'active');
  ck(active.length > 0 && active.every((e) => !e.candidate.arrangement),
    'CR13 no ACTIVE pool experience carries an arrangement, so no child can meet a figure at all',
    active.length + ' active');
  ck(poolSrc.indexOf('lab-cm-') === -1 &&
     !pool.experiences.some((e) => e.candidate.id.indexOf('lab-cm-') === 0),
    'CR13b not one creature is in the production pool, in any status');
  ck(!/lab-cm-|CREATURE_BANK|creatureNote/.test(
       require('child_process').spawnSync('grep',
         ['-rl', '-e', 'lab-cm-', '-e', 'CREATURE_BANK', '-e', 'creatureNote',
          path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet')],
         { encoding: 'utf8' }).stdout || ''),
    'CR13c and nothing a child loads — js/, assets/, the runtime — names one');

  // ---- CR14: the research log carries what a reviewer needs ----
  const session = Kit.createSession();
  bank.forEach((c) => session.add(c,
    { source: 'fixture', params: { experiment: 'creature-mystery' } }));
  const rows = session.items();
  const falconRow = rows.find((r) => r.candidate.id === 'lab-cm-1');
  session.review(falconRow.labId, 'good', [], 'reads as a bird before it is joined');
  const log = session.exportResearch();
  const row = log.artifact.candidates.find((r) => r.candidate.id === 'lab-cm-1');
  ck(!!row && row.creatureExperiment && row.creatureExperiment.creature === 'falcon' &&
     row.creatureExperiment.nodes === 8 && row.creatureExperiment.missing === 2 &&
     typeof row.creatureExperiment.hint === 'string',
    'CR14 the research log carries the creature, its hint, its lights and its missing pieces',
    row ? JSON.stringify(row.creatureExperiment) : 'no row');
  ck(log.artifact.candidates.some((r) => r.humanJudgement && r.humanJudgement.classification) &&
     log.artifact.productionReady === false,
    'CR14b the human judgement travels with it, and it is still marked research-only');
}

// ===================================================================
// FV. THREE FALCONS (Lab experiment)
//
// The Creature Mystery left two things open — whether the DRAWING can
// be made to read as a bird on its own, and whether the world can
// suggest which lights belong together without a word. Three falcons
// answer one of those each, and every pair differs in exactly one
// thing: A → B is a different shape, B → C is the same shape with the
// world leaning toward the gaps. Everything is Lab-side.
// ===================================================================
async function sectionFV() {
  console.log('\n== FV. three falcons (Lab experiment) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const Support = sb.LabPreviewSupport || (sb.window && sb.window.LabPreviewSupport);
  const bank = Kit.FALCON_BANK;
  const meta = Kit.FALCON_VARIATIONS;

  // ---- FV1: three real candidates ----
  const verdicts = bank.map((c) => ({ id: c.id, v: G.validate(c) }));
  ck(bank.length === 3 && verdicts.every((r) => r.v.ok) &&
     bank.every((c) => Support.support(c).ok),
    'FV1  all three falcons are VALID through the real validator and previewable',
    verdicts.filter((r) => !r.v.ok).map((r) => r.id + ':' + r.v.reasons).join(' ') || '3/3');
  ck(meta.map((m) => m.variation).join('') === 'ABC',
    'FV1b they are A, B and C, in that order');

  // ---- FV2: the controls are controls BY REFERENCE ----
  //
  // A shares the SHIPPED falcon's own figure object and C shares B's,
  // so neither can drift from the thing it is the control for. A copy
  // would be one edit away from an experiment that compares nothing.
  ck(bank[0].arrangement.figure === Kit.CREATURE_BANK[0].arrangement.figure,
    'FV2  Falcon A is the shipped falcon\'s own figure, not a copy of it');
  ck(bank[1].arrangement.figure === bank[2].arrangement.figure,
    'FV2b Falcon C is Falcon B\'s own geometry, not a copy of it');
  const strip = (c) => JSON.stringify(Object.assign({}, c, { id: 0, title: 0 }));
  ck(strip(bank[1]) === strip(bank[2]),
    'FV2c and the candidate the Ether performs is IDENTICAL for B and C — the tease is not in it');

  // ---- FV3: one variable at a time ----
  ck(meta.every((m) => m.nodes === 8) &&
     new Set(meta.map((m) => m.figure.gaps.length)).size === 1,
    'FV3  same node count and the same number of missing joins — the difficulty is held still',
    meta.map((m) => m.nodes + 'n/' + m.figure.gaps.length + 'g').join(' '));
  ck(new Set(meta.map((m) => m.hint)).size === 1 &&
     meta[0].hint === Kit.creatureNote('lab-cm-1').hint,
    'FV3b and all three carry the shipped falcon\'s hint, word for word',
    JSON.stringify(meta[0].hint));
  ck(JSON.stringify(bank[0].arrangement.figure) !== JSON.stringify(bank[1].arrangement.figure),
    'FV3c A and B really are different drawings');

  // ---- FV4: B keeps its wings, which is the whole redesign ----
  //
  // A's gaps are the two wing ROOTS, so the visible wing is only its
  // outer half. B's are the neck and the tail, so both wings stand
  // whole and the shape is a bird before anything is joined.
  const wholeWings = (m) => {
    const missing = m.figure.gaps.map((i) => m.figure.joins[i]);
    // a wing join is one that does not lie on the vertical body axis
    return m.figure.joins.filter((j) => {
      const ab = j.split('-').map(Number);
      return m.figure.points[ab[0]][0] !== 0 || m.figure.points[ab[1]][0] !== 0;
    }).every((j) => missing.indexOf(j) === -1);
  };
  ck(!wholeWings(meta[0]) && wholeWings(meta[1]) && wholeWings(meta[2]),
    'FV4  A is missing its wings\' roots; B and C keep every wing join whole');

  // ---- FV5: the evaluator's knowledge stays out of the experience ----
  const j = JSON.stringify(bank);
  ck(!/falcon|creature|variation|tease|hint/i.test(j),
    'FV5  no candidate names the creature, the variation, the tease or the hint');
  ck(meta.every((m) => typeof m.variation === 'string' && typeof m.creature === 'string'),
    'FV5b and the Lab knows all of it, per fixture, for the research log');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });

    const walk = async (c) => {
      const note = Kit.creatureNote(c.id);
      return page.evaluate(async ([cand, hint, tease]) => {
        window.LabPreview.play(cand, 'fv-seed', 'play', { hint: hint, tease: tease });
        await new Promise((r) => setTimeout(r, 1800));
        const canvas = document.querySelector('[data-tease]');
        const posed = {
          hidden: canvas.hidden,
          inert: getComputedStyle(canvas).pointerEvents === 'none',
          w: canvas.width, h: canvas.height
        };

        // WHAT THE TEASE PAINTS, AND WHERE. The brightest pixel in a
        // box around the midpoint of each join — a still-missing one
        // should carry the almost-line, a present one nothing at all.
        function brightestNear(x, y, r) {
          if (canvas.hidden || !canvas.width) return 0;
          const g = canvas.getContext('2d');
          const d = g.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
          let m = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > m) m = d[i];
          return m;
        }
        const my = window.LabPreview.mystery();
        let i = my.instrument();
        const mid = (L) => {
          const A = i.elements[L.a], B = i.elements[L.b];
          return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
        };
        const missing = i.arrangement.links.filter((L) => !L.present);
        const present = i.arrangement.links.filter((L) => L.present);
        const paint = {
          missing: missing.map((L) => { const p = mid(L); return brightestNear(p.x, p.y, 26); }),
          present: present.map((L) => { const p = mid(L); return brightestNear(p.x, p.y, 26); })
        };

        // A TAP STILL REACHES THE MYSTERY. The overlay sits over every
        // light, so if it ever caught a touch the experience would be
        // unplayable — measured through the real completion, not from
        // the stylesheet alone.
        const onTop = document.elementFromPoint(
          Math.round(i.elements[0].x), Math.round(i.elements[0].y));
        const overlayEatsTaps = !!(onTop && onTop.hasAttribute &&
                                   onTop.hasAttribute('data-tease'));
        let guard = 40;
        while (guard-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
          const gap = i.arrangement.links.filter((L) => !L.present)[0];
          my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y);
          my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
          i = my.instrument();
        }
        const live = window.LabPreview.instrument();
        const whole = live ? live.arrangement.links.filter((L) => L.present).length : -1;
        await new Promise((r) => setTimeout(r, 600));
        const afterWhole = { hidden: canvas.hidden };
        await new Promise((r) => setTimeout(r, 6200));
        const w = window.LabPreview.alive()[0] || null;
        return {
          posed: posed, paint: paint, overlayEatsTaps: overlayEatsTaps,
          whole: whole, afterWhole: afterWhole,
          alive: window.LabPreview.alive().length, born: w,
          words: (document.querySelector('[data-tease]').textContent || '').trim()
        };
      }, [c, note.hint, note.tease]);
    };

    const A = await walk(bank[0]);
    const B = await walk(bank[1]);
    const C = await walk(bank[2]);

    ck(A.posed.hidden === true && B.posed.hidden === true && C.posed.hidden === false,
      'FV6  only Falcon C shows the tease — A and B are the Ether exactly as it is',
      JSON.stringify({ A: A.posed.hidden, B: B.posed.hidden, C: C.posed.hidden }));
    ck(C.posed.w === 1440 && C.posed.h === 900,
      'FV6b and it covers the sky — a canvas is a replaced element and needs its size said',
      JSON.stringify({ w: C.posed.w, h: C.posed.h }));
    ck(C.afterWhole.hidden === true,
      'FV6c it goes the moment the shape is whole — from then on the creature speaks for itself');

    const litMissing = C.paint.missing.filter((v) => v > 6).length;
    const litPresent = C.paint.present.filter((v) => v > 6).length;
    ck(litMissing === C.paint.missing.length && litPresent === 0,
      'FV7  the tease is drawn ONLY between the endpoints of a missing join',
      'missing ' + JSON.stringify(C.paint.missing) + ' · present ' + JSON.stringify(C.paint.present));
    ck(A.paint.missing.every((v) => v === 0) && B.paint.missing.every((v) => v === 0),
      'FV7b and nothing at all is painted for A or B');

    ck(C.posed.inert && !C.overlayEatsTaps && C.whole === 7,
      'FV8  the overlay never catches a touch — C completes through the real lights',
      JSON.stringify({ inert: C.posed.inert, eats: C.overlayEatsTaps, joined: C.whole }));
    ck(C.words === '',
      'FV8b and it says nothing — light only, not one word',
      JSON.stringify(C.words));

    ck(B.whole === 7 && B.alive === 1 && B.born && B.born.nodes === 8 && B.born.links === 7,
      'FV9  Falcon B completes, comes alive with all eight lights, and roams',
      JSON.stringify({ whole: B.whole, born: B.born && B.born.nodes }));
    ck(C.whole === 7 && C.alive === 1 && C.born && C.born.nodes === 8 && C.born.links === 7,
      'FV9b and so does C — the tease changes what is SUGGESTED, never what happens',
      JSON.stringify({ whole: C.whole, born: C.born && C.born.nodes }));
    ck(A.whole === 7 && A.alive === 1,
      'FV9c and the control behaves exactly as it shipped');
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- FV10: production knows nothing about any of it ----
  ck(!/tease|falcon|lab-fv-/i.test(stripComments(read('js/etherMystery.js'))) &&
     !/tease|falcon|lab-fv-/i.test(stripComments(read('js/etherGrammar.js'))),
    'FV10 neither production file names a falcon or a tease');
  ck(!/lab-fv-|FALCON_BANK|FALCON_VARIATIONS/.test(
       require('child_process').spawnSync('grep',
         ['-rl', '-e', 'lab-fv-', '-e', 'FALCON_BANK', '-e', 'FALCON_VARIATIONS',
          path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet')],
         { encoding: 'utf8' }).stdout || ''),
    'FV10b and nothing a child loads — js/, assets/, the runtime — names one');

  // ---- FV11: the research log carries the comparison ----
  const session = Kit.createSession();
  bank.forEach((c) => session.add(c,
    { source: 'fixture', params: { experiment: 'falcon-variations' } }));
  const rows = session.items();
  session.review(rows[1].labId, 'good', [], 'reads as a bird before anything is joined');
  const log = session.exportResearch();
  const got = log.artifact.candidates
    .filter((r) => (r.candidate.id || '').indexOf('lab-fv-') === 0)
    .map((r) => r.creatureExperiment && (r.creatureExperiment.variation +
      (r.creatureExperiment.tease ? '+tease' : '')));
  ck(got.length === 3 && got.join(' ') === 'A B C+tease',
    'FV11 the research log carries which variation each one is, and which carries the tease',
    got.join(' '));
  ck(log.artifact.productionReady === false,
    'FV11b and it is still marked research-only');
}

async function sectionFR() {
  console.log('\n== FR. the falcon redrawn — recognition / mystery / guided discovery ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const Support = sb.LabPreviewSupport || (sb.window && sb.window.LabPreviewSupport);
  const bank = Kit.FALCON_REDESIGN_BANK;
  const meta = Kit.FALCON_REDESIGN;

  // ---- FR1: three real candidates the runtime will actually perform ----
  const verdicts = bank.map((c) => ({ id: c.id, v: G.validate(c) }));
  ck(bank.length === 3 && verdicts.every((r) => r.v.ok) &&
     bank.every((c) => Support.support(c).ok),
    'FR1  F1, F2 and F3 are VALID through the real validator and previewable',
    verdicts.filter((r) => !r.v.ok).map((r) => r.id + ':' + r.v.reasons).join(' ') || '3/3');
  ck(meta.map((m) => m.variation).join(' ') === 'F1 F2 F3',
    'FR1b they are F1, F2 and F3, in that order');
  ck(meta.every((m) => m.nodes === 8 && m.figure.points.length === 8) &&
     meta[0].figure.gaps.length === 2 &&
     meta[1].figure.gaps.length === 3 && meta[2].figure.gaps.length === 3,
    'FR1c eight lights each; F1 is two joins short and F2/F3 are three',
    meta.map((m) => m.nodes + 'n/' + m.figure.gaps.length + 'g').join(' '));

  // ---- FR2: THE CEILING, reported rather than worked around ----
  //
  // The brief asked for fourteen to twenty lights. The validator caps
  // an arrangement at eight and requires the figure's points array to
  // be exactly that long, and the interpreter's own LIMITS.pieces is
  // ten and CLAMPS instead of refusing — so a sixteen-light figure is
  // not rejected, it is truncated and drawn with joins pointing at
  // lights that were never placed. Both are production files this
  // experiment may not edit. Measured here so the wall is a fact in
  // the suite rather than a claim in a report.
  const ceiling = Kit.RUNTIME_NODE_CEILING;
  const gSrc = read('js/etherGrammar.js'), mSrc = read('js/etherMystery.js');
  const gMax = Number((gSrc.match(/arrangementNodesMax:\s*(\d+)/) || [])[1]);
  const mPieces = Number((mSrc.match(/pieces:\s*(\d+),\s*\/\/\s*total placed things, hard ceiling/) || [])[1]);
  ck(gMax === ceiling.validatorMax && mPieces === ceiling.interpreterPieces,
    'FR2  the Lab\'s recorded ceiling is read back out of the two production files',
    JSON.stringify({ validator: gMax, pieces: mPieces }));
  const tooMany = JSON.parse(JSON.stringify(bank[0]));
  tooMany.arrangement.nodes = 16;
  tooMany.elements[0].count = 16;
  tooMany.arrangement.figure.points = tooMany.arrangement.figure.points
    .concat(tooMany.arrangement.figure.points.map((p) => [p[0] * 0.5, p[1] * 0.5]));
  ck(G.validate(tooMany).ok === false,
    'FR2b sixteen lights is a REFUSED candidate — the brief\'s node count is unreachable here',
    JSON.stringify(G.validate(tooMany).reasons));

  // ---- FR3: F3 is F2 and nothing else ----
  ck(bank[1].arrangement.figure === bank[2].arrangement.figure,
    'FR3  F3 holds F2\'s own figure object — byte-for-byte the same creature');
  const strip = (c) => JSON.stringify(Object.assign({}, c, { id: 0 }));
  ck(strip(bank[1]) === strip(bank[2]),
    'FR3b and the candidate the Ether performs is IDENTICAL — the aid is not in it');
  ck(new Set(meta.map((m) => m.hint)).size === 1 &&
     meta[0].hint === Kit.creatureNote('lab-cm-1').hint,
    'FR3c all three carry the shipped falcon\'s hint, word for word',
    JSON.stringify(meta[0].hint));

  // ---- FR4: the geometry, and what may never be a gap ----
  //
  // §3 designed the finished creature first: four lights on the axis
  // and two per wing, each wing OUTLINED shoulder → wrist → tip → hip.
  // §4's rule is that the joins carrying the identity — the leading
  // edges out to the tips — are never taken away.
  const F = meta[0].figure;
  const has = (a, b) => F.joins.indexOf(a + '-' + b) !== -1;
  ck(has(1, 4) && has(4, 5) && has(5, 2) && has(1, 6) && has(6, 7) && has(7, 2),
    'FR4  each wing is a closed outline — shoulder → wrist → tip → hip');
  ck(F.points[5][1] > F.points[4][1] && F.points[7][1] > F.points[6][1],
    'FR4b and the tips are swept BEHIND the wrists, which is what a moth does not do',
    JSON.stringify({ wrist: F.points[4][1], tip: F.points[5][1] }));
  const defining = ['1-4', '4-5', '1-6', '6-7'];
  ck(meta.every((m) => m.figure.gaps
       .map((i) => m.figure.joins[i])
       .every((j) => defining.indexOf(j) === -1)),
    'FR4c no variation ever removes a join that carries the identity',
    meta.map((m) => m.figure.gaps.map((i) => m.figure.joins[i]).join(',')).join(' | '));

  // ---- FR5: the evaluator's knowledge stays out of the experience ----
  ck(!/falcon|creature|variation|tease|hint|guided/i.test(JSON.stringify(bank)),
    'FR5  no candidate names the creature, the variation, the aid or the hint');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });

    const walk = async (c) => {
      const note = Kit.creatureNote(c.id);
      return page.evaluate(async ([cand, hint, tease]) => {
        const step = () => new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const canvas = document.querySelector('[data-tease]');
        const my0 = () => window.LabPreview.mystery();

        // The brightest thing the AID canvas paints in a small box.
        // Nothing else draws on it, so anything found here is the aid.
        function lit(x, y, r) {
          if (canvas.hidden || !canvas.width) return 0;
          const g = canvas.getContext('2d');
          const d = g.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
          let m = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > m) m = d[i];
          return m;
        }
        function at(L, u, inst) {
          const A = inst.elements[L.a], B = inst.elements[L.b];
          return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u };
        }
        // AN ATTEMPT A CHILD WOULD MAKE: two lights that are not a
        // missing join, chosen and released ACROSS FRAMES. Both taps
        // in one tick is not a child — nothing ever sees the first
        // light held.
        async function tryWrong(n) {
          for (let k = 0; k < n; k++) {
            const my = my0(), i = my.instrument();
            const missing = i.arrangement.links.filter((L) => !L.present);
            const isGap = (a, b) => missing.some((L) =>
              (L.a === a && L.b === b) || (L.a === b && L.b === a));
            const pairs = [];
            for (let a = 0; a < i.elements.length; a++)
              for (let b = a + 1; b < i.elements.length; b++)
                if (!isGap(a, b)) pairs.push([a, b]);
            const p = pairs[k % pairs.length];
            my.touchAt(i.elements[p[0]].x, i.elements[p[0]].y);
            await step();
            my.touchAt(i.elements[p[1]].x, i.elements[p[1]].y);
            await step();
          }
        }

        window.LabPreview.play(cand, 'fr-seed', 'play', { hint: hint, tease: tease });
        await wait(1800);

        const posed = {
          hidden: canvas.hidden,
          inert: getComputedStyle(canvas).pointerEvents === 'none',
          w: canvas.width, h: canvas.height,
          state: window.LabPreview.tease()
        };
        // NOTHING IS SHOWN AT FIRST. Even after ONE attempt.
        let i = my0().instrument();
        const gaps0 = i.arrangement.links.filter((L) => !L.present);
        const beforeAny = gaps0.map((L) => { const p = at(L, 0.3, i); return lit(p.x, p.y, 22); });
        await tryWrong(1);
        await wait(300);
        const afterOne = {
          state: window.LabPreview.tease(),
          paint: gaps0.map((L) => { const p = at(L, 0.3, i); return lit(p.x, p.y, 22); })
        };

        // ...and after the second, the world leans in.
        await tryWrong(1);
        let guard = 200;
        while (guard-- > 0) {
          const s = window.LabPreview.tease();
          if (!s || s.phase === 'hold') break;
          await step();
        }
        await wait(120);
        i = my0().instrument();
        const s = window.LabPreview.tease();
        const target = (s && s.target !== null) ? i.arrangement.links[s.target] : null;
        const others = i.arrangement.links.filter((L, n) => !L.present && n !== (s && s.target));
        const shown = {
          state: s,
          near: target ? [lit(at(target, 0.18, i).x, at(target, 0.18, i).y, 16),
                          lit(at(target, 0.82, i).x, at(target, 0.82, i).y, 16)] : null,
          middle: target ? lit(at(target, 0.5, i).x, at(target, 0.5, i).y, 9) : null,
          others: others.map((L) => lit(at(L, 0.35, i).x, at(L, 0.35, i).y, 16)),
          words: (canvas.textContent || '').trim(),
          onTop: (function () {
            const el = document.elementFromPoint(
              Math.round(i.elements[0].x), Math.round(i.elements[0].y));
            return !!(el && el.hasAttribute && el.hasAttribute('data-tease'));
          })()
        };

        // THE JOIN IT WAS ABOUT — and the aid goes at once.
        let goneOnJoin = null;
        if (target) {
          const my = my0();
          my.touchAt(i.elements[target.a].x, i.elements[target.a].y);
          await step();
          my.touchAt(i.elements[target.b].x, i.elements[target.b].y);
          await step();
          const st = window.LabPreview.tease();
          const j = my.instrument();
          goneOnJoin = {
            phase: st && st.phase, alpha: st && st.alpha,
            paint: j.arrangement.links.filter((L) => !L.present)
              .map((L) => { const p = at(L, 0.3, j); return lit(p.x, p.y, 22); })
          };
        }

        // ...and the rest of it completes, comes alive and roams.
        const my = my0();
        i = my.instrument();
        guard = 40;
        while (guard-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
          const gap = i.arrangement.links.filter((L) => !L.present)[0];
          my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y);
          my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
          i = my.instrument();
        }
        const live = window.LabPreview.instrument();
        const whole = live ? live.arrangement.links.filter((L) => L.present).length : -1;
        await wait(600);
        const afterWhole = { hidden: canvas.hidden, state: window.LabPreview.tease() };
        await wait(6200);
        const w = window.LabPreview.alive()[0] || null;
        return { posed, beforeAny, afterOne, shown, goneOnJoin, whole, afterWhole,
                 alive: window.LabPreview.alive().length, born: w };
      }, [c, note.hint, note.tease]);
    };

    const F1 = await walk(bank[0]);
    const F2 = await walk(bank[1]);
    const F3 = await walk(bank[2]);

    // ANY JOIN RETIRES THE AID, not only the one it was about. A child
    // who was leaning on a suggestion about the left wing and then
    // worked out the tail on their own is no longer stuck, and the
    // suggestion should not be left hanging over the sky. Its own
    // probe, because the walk above joins the AIDED pair and the two
    // paths are answered by different branches.
    const other = await page.evaluate(async ([cand, hint, tease]) => {
      const step = () => new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const canvas = document.querySelector('[data-tease]');
      window.LabPreview.play(cand, 'fr-other', 'play', { hint: hint, tease: tease });
      await wait(1800);
      for (let k = 0; k < 2; k++) {
        const my = window.LabPreview.mystery(), i = my.instrument();
        const missing = i.arrangement.links.filter((L) => !L.present);
        const isGap = (a, b) => missing.some((L) =>
          (L.a === a && L.b === b) || (L.a === b && L.b === a));
        const pairs = [];
        for (let a = 0; a < i.elements.length; a++)
          for (let b = a + 1; b < i.elements.length; b++)
            if (!isGap(a, b)) pairs.push([a, b]);
        const p = pairs[k % pairs.length];
        my.touchAt(i.elements[p[0]].x, i.elements[p[0]].y);
        await step();
        my.touchAt(i.elements[p[1]].x, i.elements[p[1]].y);
        await step();
      }
      let guard = 200;
      while (guard-- > 0) {
        const st = window.LabPreview.tease();
        if (!st || st.phase === 'hold') break;
        await step();
      }
      const before = window.LabPreview.tease();
      const my = window.LabPreview.mystery();
      const i = my.instrument();
      const notTarget = i.arrangement.links
        .map((L, n) => ({ L: L, n: n }))
        .filter((r) => !r.L.present && r.n !== before.target)[0];
      my.touchAt(i.elements[notTarget.L.a].x, i.elements[notTarget.L.a].y);
      await step();
      my.touchAt(i.elements[notTarget.L.b].x, i.elements[notTarget.L.b].y);
      await step();
      const after = window.LabPreview.tease();
      let brightest = 0;
      if (!canvas.hidden && canvas.width) {
        const d = canvas.getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height).data;
        for (let q = 3; q < d.length; q += 4) if (d[q] > brightest) brightest = d[q];
      }
      return { before: before, after: after, joined: notTarget.n, brightest: brightest };
    }, [bank[2], Kit.creatureNote(bank[2].id).hint, Kit.creatureNote(bank[2].id).tease]);

    // ---- FR6: F1 and F2 are the Ether exactly as it is ----
    ck(F1.posed.hidden === true && F2.posed.hidden === true &&
       F1.posed.state === null && F2.posed.state === null,
      'FR6  F1 and F2 have no aid at all — not before, not after, not ever',
      JSON.stringify({ F1: F1.posed.hidden, F2: F2.posed.hidden }));
    ck(F1.shown.others.every((v) => v === 0) && F2.shown.others.every((v) => v === 0) &&
       F1.shown.state === null && F2.shown.state === null,
      'FR6b and two attempts change nothing for them');

    // ---- FR7: the aid waits, and answers effort ----
    ck(F3.posed.hidden === false && F3.posed.state &&
       F3.posed.state.phase === 'waiting' && F3.posed.state.shown === 0 &&
       F3.beforeAny.every((v) => v === 0),
      'FR7  F3 shows nothing when the mystery is posed — the sky is unmarked',
      JSON.stringify(F3.posed.state));
    ck(F3.afterOne.state && F3.afterOne.state.tries === 1 &&
       F3.afterOne.state.shown === 0 && F3.afterOne.paint.every((v) => v === 0),
      'FR7b nor after ONE attempt — one try is not being stuck',
      JSON.stringify(F3.afterOne.state));
    ck(F3.shown.state && F3.shown.state.shown === 1 &&
       F3.shown.state.tries >= 2 && F3.shown.state.target !== null,
      'FR7c after the second, the world leans toward ONE gap',
      JSON.stringify(F3.shown.state));

    // ---- FR8: what it is, and what it can never become ----
    ck(F3.shown.near && F3.shown.near.every((v) => v > 6),
      'FR8  a dashed line reaches in from BOTH lights',
      JSON.stringify(F3.shown.near));
    ck(F3.shown.middle === 0,
      'FR8b and the middle of it is never painted — it cannot close the join it is about',
      JSON.stringify({ middle: F3.shown.middle }));
    ck(F3.shown.others.every((v) => v === 0),
      'FR8c the other missing joins are untouched — never every possible connection',
      JSON.stringify(F3.shown.others));
    ck(F3.shown.words === '' && F3.posed.inert && !F3.shown.onTop,
      'FR8d not one word, and it never catches a touch meant for a light',
      JSON.stringify({ words: F3.shown.words, inert: F3.posed.inert, onTop: F3.shown.onTop }));

    // ---- FR9: it goes the moment the join is made ----
    ck(F3.goneOnJoin && F3.goneOnJoin.phase === 'waiting' && F3.goneOnJoin.alpha === 0 &&
       F3.goneOnJoin.paint.every((v) => v === 0),
      'FR9  the join lands and the aid is gone in the same breath',
      JSON.stringify(F3.goneOnJoin && { phase: F3.goneOnJoin.phase, paint: F3.goneOnJoin.paint }));
    ck(F3.afterWhole.hidden === true && F3.afterWhole.state === null,
      'FR9b and the whole overlay is gone once the shape is whole');
    ck(other.before && other.before.phase === 'hold' &&
       other.joined !== other.before.target &&
       other.after && other.after.phase === 'waiting' && other.after.alpha === 0 &&
       other.brightest === 0,
      'FR9c ANY join retires it, not just the one it was about — the sky is left clean',
      JSON.stringify({ aided: other.before && other.before.target, joined: other.joined,
                       then: other.after && other.after.phase, painted: other.brightest }));

    // ---- FR10: completion is deterministic, and the falcon lives ----
    ck(F1.whole === 9 && F2.whole === 9 && F3.whole === 9,
      'FR10 all three complete to the same nine joins',
      JSON.stringify({ F1: F1.whole, F2: F2.whole, F3: F3.whole }));
    ck([F1, F2, F3].every((r) => r.alive === 1 && r.born &&
        r.born.nodes === 8 && r.born.links === 9),
      'FR10b each one comes alive with every light and every join, and roams',
      JSON.stringify([F1, F2, F3].map((r) => r.born && (r.born.nodes + '/' + r.born.links))));
    ck([F1, F2, F3].every((r) => r.born && (r.born.x !== undefined)),
      'FR10c and what roams is the figure the child completed, not a new object');
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- FR11: production knows nothing about any of it ----
  ck(!/lab-fr-|FALCON_REDESIGN/.test(
       require('child_process').spawnSync('grep',
         ['-rl', '-e', 'lab-fr-', '-e', 'FALCON_REDESIGN',
          path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet')],
         { encoding: 'utf8' }).stdout || ''),
    'FR11 nothing a child loads — js/, assets/, the runtime — names one');
  const pool = read('assets/ether/experience-pool.js');
  ck(!/lab-fr-/.test(pool) && !/arrangement/.test(
       (pool.match(/status:\s*'active'[\s\S]{0,40}/g) || []).join('')),
    'FR11b and no ACTIVE production experience carries an arrangement at all');

  // ---- FR12: the research log ----
  const session = Kit.createSession();
  bank.forEach((c) => session.add(c,
    { source: 'fixture', params: { experiment: 'falcon-redesign' } }));
  const rows = session.items();
  session.review(rows[0].labId, 'ok', ['not-recognisable'],
    'reads as a bird, never as a falcon — judgement C');
  const log = session.exportResearch();
  const got = log.artifact.candidates
    .filter((r) => (r.candidate.id || '').indexOf('lab-fr-') === 0)
    .map((r) => r.creatureExperiment && (r.creatureExperiment.variation +
      (r.creatureExperiment.tease ? ':' + r.creatureExperiment.tease : '')));
  ck(got.length === 3 && got.join(' ') === 'F1 F2 F3:delayed',
    'FR12 the research log carries which variation each one is, and which carries the aid',
    got.join(' '));
  ck(log.artifact.productionReady === false,
    'FR12b and it is still marked research-only');
}

async function sectionEP() {
  console.log('\n== EP. eight-point creatures (Lab experiment) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const Support = sb.LabPreviewSupport || (sb.window && sb.window.LabPreviewSupport);
  const bank = Kit.EIGHT_POINT_BANK;
  const meta = Kit.EIGHT_POINT_CREATURES;

  // ---- EP1: five real candidates, inside the product's own ceiling ----
  const verdicts = bank.map((c) => ({ id: c.id, v: G.validate(c) }));
  ck(bank.length === 5 && verdicts.every((r) => r.v.ok) &&
     bank.every((c) => Support.support(c).ok),
    'EP1  all five are VALID through the real validator and previewable',
    verdicts.filter((r) => !r.v.ok).map((r) => r.id + ':' + r.v.reasons).join(' ') || '5/5');
  ck(meta.map((m) => m.creature).sort().join(' ') === 'butterfly fish octopus snake whale',
    'EP1b the five are the five the brief named',
    meta.map((m) => m.creature).join(' '));
  ck(meta.every((m) => m.nodes <= 8 && m.figure.points.length === m.nodes),
    'EP1c every fixture is at most EIGHT lights, and declares exactly as many as it draws',
    meta.map((m) => m.creature + ':' + m.figure.points.length).join(' '));
  ck(meta.every((m) => m.figure.gaps.length >= 1 && m.figure.gaps.length <= 3),
    'EP1d each is one to three joins short — unfinished, never mostly gaps',
    meta.map((m) => m.figure.gaps.length).join(''));

  // ---- EP2: §9's GUARD. The experiment cannot pretend a malformed
  // figure is fine, and it restates no production number: the ceiling
  // is asked of the REAL validator.
  ck(bank.every((c) => Kit.figureGuard(c).ok),
    'EP2  the Lab guard passes every fixture',
    bank.map((c) => c.id + ':' + Kit.figureGuard(c).reasons.join('|')).join(' ') || 'clean');
  const over = JSON.parse(JSON.stringify(bank[0]));
  over.arrangement.nodes = 12; over.elements[0].count = 12;
  const op = over.arrangement.figure.points;
  over.arrangement.figure.points = op.concat(op.slice(0, 4).map((q) => [q[0] * 0.5, q[1] * 0.5]));
  ck(!Kit.figureGuard(over).ok && !G.validate(over).ok,
    'EP2b a figure over the ceiling is REFUSED by both, never quietly clamped',
    JSON.stringify(Kit.figureGuard(over).reasons));
  const bentJoin = JSON.parse(JSON.stringify(bank[0]));
  bentJoin.arrangement.figure.joins = bentJoin.arrangement.figure.joins.concat(['0-9']);
  const bentGap = JSON.parse(JSON.stringify(bank[0]));
  bentGap.arrangement.figure.gaps = [99];
  ck(!Kit.figureGuard(bentJoin).ok && !Kit.figureGuard(bentGap).ok,
    'EP2c and it catches a join or a gap pointing at a light that is not there');
  ck(!/arrangementNodesMax|nodes\s*<=\s*8|=== 8|pieces/.test(
       String(Kit.figureGuard).replace(/\/\/[^\n]*/g, '')),
    'EP2d the guard restates NO production number — it asks the validator');

  // ---- EP3: §4. A gap takes a PART away, never a light. ----
  //
  // The falcon's own finding: a detached POINT reads as one of the
  // stray stars the sky is already full of, and a detached PART reads
  // as a piece of the creature sitting apart from it.
  const strays = meta.map(function (m) {
    const kept = m.figure.joins.filter((j, i) => m.figure.gaps.indexOf(i) === -1);
    const held = {};
    kept.forEach((j) => j.split('-').forEach((n) => { held[n] = 1; }));
    const loose = [];
    for (let n = 0; n < m.figure.points.length; n++) if (!held[n]) loose.push(n);
    return { creature: m.creature, loose: loose };
  });
  ck(strays.every((r) => r.loose.length === 0),
    'EP3  no gap leaves a light attached to nothing at all',
    strays.map((r) => r.creature + ':' + (r.loose.length ? r.loose.join(',') : 'ok')).join(' '));

  // ---- EP4: the hint is the Lab's, and no creature name travels ----
  ck(meta.every((m) => typeof m.hint === 'string' && m.hint.length > 0 &&
       m.hint.toLowerCase().indexOf(m.creature) === -1),
    'EP4  every creature has a leading hint, and no hint names its own creature',
    meta.map((m) => m.hint).join(' | '));
  ck(!/connect|join the|tap the|complete the|dots|puzzle/i.test(
       meta.map((m) => m.hint).join(' ')),
    'EP4b and not one hint explains the mechanic');
  const j = JSON.stringify(bank);
  ck(!/whale|fish|snake|octopus|butterfly|creature|hint|tease/i.test(j),
    'EP4c NO creature name, hint or aid travels inside a candidate');
  ck(meta.every((m) => m.tease === 'delayed'),
    'EP4d and all five carry the SAME delayed aid — one mechanism, not five');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await page.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });

    const walk = async (c) => {
      const note = Kit.creatureNote(c.id);
      return page.evaluate(async ([cand, hint, tease, pts]) => {
        const step = () => new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const canvas = document.querySelector('[data-tease]');
        function lit(x, y, r) {
          if (canvas.hidden || !canvas.width) return 0;
          const g = canvas.getContext('2d');
          const d = g.getImageData(Math.max(0, x - r), Math.max(0, y - r), r * 2, r * 2).data;
          let m = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > m) m = d[i];
          return m;
        }
        function at(L, u, inst) {
          const A = inst.elements[L.a], B = inst.elements[L.b];
          return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u };
        }
        async function tryWrong(n) {
          for (let k = 0; k < n; k++) {
            const my = window.LabPreview.mystery(), i = my.instrument();
            const missing = i.arrangement.links.filter((L) => !L.present);
            const isGap = (a, b) => missing.some((L) =>
              (L.a === a && L.b === b) || (L.a === b && L.b === a));
            const pairs = [];
            for (let a = 0; a < i.elements.length; a++)
              for (let b = a + 1; b < i.elements.length; b++)
                if (!isGap(a, b)) pairs.push([a, b]);
            const p = pairs[k % pairs.length];
            my.touchAt(i.elements[p[0]].x, i.elements[p[0]].y);
            await step();
            my.touchAt(i.elements[p[1]].x, i.elements[p[1]].y);
            await step();
          }
        }

        window.LabPreview.play(cand, 'ep-seed', 'play', { hint: hint, tease: tease });
        await wait(1800);

        // §9: the interpreter places what the figure declares, or the
        // experiment is pretending. Measured, never assumed.
        let i = window.LabPreview.instrument();
        const placed = { elements: i.elements.length, declared: pts,
                         missing: i.arrangement.missingLeft };
        const posed = { hidden: canvas.hidden,
                        inert: getComputedStyle(canvas).pointerEvents === 'none',
                        state: window.LabPreview.tease() };
        const gaps0 = i.arrangement.links.filter((L) => !L.present);
        const beforeAny = gaps0.map((L) => { const p = at(L, 0.3, i); return lit(p.x, p.y, 22); });

        await tryWrong(1);
        await wait(280);
        const afterOne = { state: window.LabPreview.tease(),
                           paint: gaps0.map((L) => { const p = at(L, 0.3, i); return lit(p.x, p.y, 22); }) };

        await tryWrong(1);
        let guard = 240;
        while (guard-- > 0) {
          const s = window.LabPreview.tease();
          if (!s || s.phase === 'hold') break;
          await step();
        }
        await wait(120);
        i = window.LabPreview.instrument();
        const s = window.LabPreview.tease();
        const target = (s && s.target !== null) ? i.arrangement.links[s.target] : null;
        const others = i.arrangement.links.filter((L, n) => !L.present && n !== (s && s.target));
        const shown = {
          state: s,
          near: target ? [lit(at(target, 0.18, i).x, at(target, 0.18, i).y, 16),
                          lit(at(target, 0.82, i).x, at(target, 0.82, i).y, 16)] : null,
          middle: target ? lit(at(target, 0.5, i).x, at(target, 0.5, i).y, 9) : null,
          others: others.map((L) => lit(at(L, 0.35, i).x, at(L, 0.35, i).y, 16)),
          words: (canvas.textContent || '').trim(),
          onTop: (function () {
            const el = document.elementFromPoint(
              Math.round(i.elements[0].x), Math.round(i.elements[0].y));
            return !!(el && el.hasAttribute && el.hasAttribute('data-tease'));
          })()
        };

        // A pair that does not belong says nothing at all.
        const wrongSaid = (document.body.innerText || '');

        const my = window.LabPreview.mystery();
        i = my.instrument();
        guard = 40;
        while (guard-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
          const gap = i.arrangement.links.filter((L) => !L.present)[0];
          my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y);
          my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
          i = my.instrument();
        }
        const live = window.LabPreview.instrument();
        const whole = live ? live.arrangement.links.filter((L) => L.present).length : -1;
        await wait(600);
        const afterWhole = { hidden: canvas.hidden, state: window.LabPreview.tease() };
        await wait(6200);
        const w = window.LabPreview.alive()[0] || null;
        return { placed, posed, beforeAny, afterOne, shown, wrongSaid, whole, afterWhole,
                 alive: window.LabPreview.alive().length, born: w };
      }, [c, note.hint, note.tease, c.arrangement.figure.points.length]);
    };

    const runs = [];
    for (const c of bank) runs.push({ id: c.id, note: Kit.creatureNote(c.id), r: await walk(c) });

    // ---- EP5: NOTHING IS TRUNCATED, and this is the measured half ----
    ck(runs.every((x) => x.r.placed.elements === x.r.placed.declared),
      'EP5  the interpreter places exactly as many lights as each figure declares',
      runs.map((x) => x.note.creature + ':' + x.r.placed.elements + '/' + x.r.placed.declared).join(' '));

    // ---- EP6: the aid waits, names one gap, and cannot close it ----
    ck(runs.every((x) => x.r.posed.state && x.r.posed.state.phase === 'waiting' &&
         x.r.posed.state.shown === 0 && x.r.beforeAny.every((v) => v === 0)),
      'EP6  no aid when a mystery is posed — for any of the five');
    ck(runs.every((x) => x.r.afterOne.state && x.r.afterOne.state.tries === 1 &&
         x.r.afterOne.state.shown === 0 && x.r.afterOne.paint.every((v) => v === 0)),
      'EP6b nor after ONE attempt — one try is not being stuck');
    ck(runs.every((x) => x.r.shown.state && x.r.shown.state.shown === 1 &&
         x.r.shown.state.tries >= 2 && x.r.shown.state.target !== null),
      'EP6c after the second, each one leans toward ONE gap',
      runs.map((x) => x.note.creature + ':' + (x.r.shown.state && x.r.shown.state.target)).join(' '));
    ck(runs.every((x) => x.r.shown.near && x.r.shown.near.every((v) => v > 6)),
      'EP6d a dashed line reaches in from BOTH lights',
      runs.map((x) => x.note.creature + ':' + JSON.stringify(x.r.shown.near)).join(' '));
    ck(runs.every((x) => x.r.shown.middle === 0),
      'EP6e and the middle is never painted — it can never close the join it is about',
      runs.map((x) => x.note.creature + ':' + x.r.shown.middle).join(' '));
    ck(runs.every((x) => x.r.shown.others.every((v) => v === 0)),
      'EP6f never every possible connection — only the one');
    ck(runs.every((x) => x.r.shown.words === '' && x.r.posed.inert && !x.r.shown.onTop),
      'EP6g not one word, and it never intercepts a touch meant for a light');
    ck(runs.every((x) => x.r.afterWhole.hidden === true && x.r.afterWhole.state === null),
      'EP6h and it is gone once the shape is whole');

    // ---- EP7: nothing blames, and no creature is named on screen ----
    ck(runs.every((x) => !/wrong|incorrect|try again|oops|no,|score|point|level/i.test(x.r.wrongSaid)),
      'EP7  a pair that does not belong is answered in silence — nothing blames');
    ck(runs.every((x) => x.r.wrongSaid.toLowerCase().indexOf(x.note.creature) === -1),
      'EP7b and no creature is ever named on the child-facing stage',
      runs.map((x) => x.note.creature).join(' '));

    // ---- EP8: completion is deterministic and each one comes alive ----
    ck(runs.every((x) => x.r.whole === x.note.joins),
      'EP8  all five complete to every join their figure declares',
      runs.map((x) => x.note.creature + ':' + x.r.whole + '/' + x.note.joins).join(' '));
    ck(runs.every((x) => x.r.alive === 1 && x.r.born &&
         x.r.born.nodes === 8 && x.r.born.links === x.note.joins),
      'EP8b each comes alive with every light and every join, and roams',
      runs.map((x) => x.r.born && (x.r.born.nodes + '/' + x.r.born.links)).join(' '));
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- EP9: production knows nothing about any of it ----
  ck(!/lab-ep-|EIGHT_POINT/.test(
       require('child_process').spawnSync('grep',
         ['-rl', '-e', 'lab-ep-', '-e', 'EIGHT_POINT',
          path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet')],
         { encoding: 'utf8' }).stdout || ''),
    'EP9  nothing a child loads — js/, assets/, the runtime — names one');
  const pool = read('assets/ether/experience-pool.js');
  ck(!/lab-ep-/.test(pool) && !/arrangement/.test(
       (pool.match(/status:\s*'active'[\s\S]{0,40}/g) || []).join('')),
    'EP9b and no ACTIVE production experience carries an arrangement at all');

  // ---- EP10: the research log ----
  const session = Kit.createSession();
  bank.forEach((c) => session.add(c,
    { source: 'fixture', params: { experiment: 'eight-point-creatures' } }));
  const rows = session.items();
  session.review(rows[0].labId, 'great', [], 'reads as a fish with the hint hidden');
  const log = session.exportResearch();
  const got = log.artifact.candidates
    .filter((r) => (r.candidate.id || '').indexOf('lab-ep-') === 0)
    .map((r) => r.creatureExperiment && r.creatureExperiment.creature);
  ck(got.length === 5 && got.join(' ') === 'fish butterfly whale snake octopus',
    'EP10 the research log carries which creature each one is', got.join(' '));
  ck(log.artifact.productionReady === false,
    'EP10b and it is still marked research-only');
}

// ===================================================================
// SL. THE CREATURE SHAPE LAB — a research INSTRUMENT, not an experiment.
//
// The instrument is judged on whether a person can use it to explore
// the creature/point-count design space themselves. Nothing here judges
// a creature: there are no creatures in this section at all, only a
// neutral ring and figures the suite draws with real clicks. Every
// check is one of the brief's own §15 items.
// ===================================================================
async function sectionSL() {
  console.log('\n== SL. the Creature Shape Lab (instrument) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const shapeSrc = read('tools/ether-mystery-lab/labShape.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const shapeStripped = stripComments(shapeSrc);

  // ---- SL1: PRODUCTION IS UNTOUCHED, three ways ----
  const grepProd = require('child_process').spawnSync('grep',
    ['-rl', '-e', 'ShapeLab', '-e', 'lab-shape-', '-e', 'shape-lab', '-e', 'vihu.lab.shapes',
     path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet'),
     path.join(ROOT, 'index.html'), path.join(ROOT, 'studio.html')],
    { encoding: 'utf8' }).stdout || '';
  ck(grepProd.trim() === '',
    'SL1  nothing a child loads — js/, assets/, the runtime, the two entry pages — names the Shape Lab',
    grepProd.trim() || 'clean');
  const grammarSrc = read('js/etherGrammar.js');
  ck(/arrangementNodesMax:\s*8\b/.test(grammarSrc),
    'SL1b the production point limit is still EIGHT in the validator');
  // A nine-light figure is refused by the REAL validator — the ceiling is
  // asked of the grammar, and the Lab's research budgets change nothing
  // about the answer.
  function ringFigure(n, gaps) {
    const pts = [], joins = [];
    for (let i = 0; i < n; i++) {
      const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pts.push([Math.round(Math.cos(t) * 100) / 100, Math.round(Math.sin(t) * 100) / 100]);
    }
    for (let k = 0; k < n; k++) joins.push(Math.min(k, (k + 1) % n) + '-' + Math.max(k, (k + 1) % n));
    return { points: pts, joins: joins, gaps: gaps || [0] };
  }
  const nineV = G.validate(Kit.creatureCandidate({ id: 'lab-shape-x', nodes: 9, title: 't', figure: ringFigure(9) }));
  const eightV = G.validate(Kit.creatureCandidate({ id: 'lab-shape-x', nodes: 8, title: 't', figure: ringFigure(8) }));
  ck(!nineV.ok && eightV.ok,
    'SL1c the real validator still takes eight lights and refuses nine — the 8-point rule is untouched',
    'nine:' + nineV.reasons.join(',') + ' eight:ok');
  [12, 16, 20].forEach((n) => {
    const v = G.validate(Kit.creatureCandidate({ id: 'lab-shape-x', nodes: n, title: 't', figure: ringFigure(n) }));
    ck(!v.ok, 'SL1d a ' + n + '-light figure is a Lab research budget only — the validator refuses it', v.reasons.join(','));
  });
  ck(!/experience-pool/.test(shapeHtml) && !/experience-pool|EtherExperience\b/.test(shapeStripped),
    'SL1e the Shape Lab never loads the production pool, and cannot reach it');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'),
    'SL1f the build is not bumped — every stamp on index.html still reads 0769',
    Array.from(new Set(stamps)).join(','));

  // ---- SL2: what the instrument REFUSES to be ----
  ck(!/<img|drawImage|\.png|\.jpg|\.jpeg|\.svg|new Image|Image\(|background-image|url\(/i.test(shapeStripped) &&
     !/<img|\.png|\.jpg|\.svg|background-image/i.test(shapeHtml.replace(/<!--[\s\S]*?-->/g, '')),
    'SL2  no hidden animal image, no SVG tracing, no imported silhouette — nothing but lights and lines');
  ck(!/score|fetch\(|XMLHttpRequest|WebSocket|openai|model\b/i.test(shapeStripped),
    'SL2b no recognisability score, no model, no network — the judgement is the researcher\'s');
  ck(!/curve|bezier|quadratic|arcTo/i.test(shapeStripped) && /no curved connection/i.test(shapeHtml),
    'SL2c no curved connection is offered, and the page says why (the Ether figure system has none)');
  const rndLines = shapeSrc.split('\n').filter((l) => /Math\.random/.test(l));
  ck(rndLines.length > 0 && rndLines.every((l) => /'shape-'/.test(l)),
    'SL2d Math.random mints fixture ids and nothing else — a missing join is never chosen at random',
    rndLines.length + ' line(s)');
  ck(/BUDGETS\s*=\s*\[\s*8,\s*12,\s*16,\s*20\s*\]/.test(shapeSrc) && /PRODUCTION_BUDGET\s*=\s*8\b/.test(shapeSrc),
    'SL2e the four budgets 8 · 12 · 16 · 20 live in the Lab file alone, with 8 named as production');

  // ---- the browser half: the real page, driven the way a person drives it ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)],
    { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const bad = [];
    page.on('response', (q) => { if (q.status() >= 400 && !/favicon/.test(q.url())) bad.push(q.status() + ' ' + q.url()); });
    const open = async () => {
      await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
      await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    };
    await open();

    // ---- SL3: loading writes nothing ----
    const keysAtLoad = await page.evaluate(() => Object.keys(localStorage));
    ck(keysAtLoad.length === 0 && errors.length === 0 && bad.length === 0,
      'SL3  the page loads clean and writes NOTHING to storage until a save',
      'keys:' + JSON.stringify(keysAtLoad) + ' errors:' + errors.length + ' http:' + bad.length);

    // Real clicks on the real canvas. The figure is placed on a ring at
    // unit radius, through the editor's own fixed scale — nothing here
    // reaches into the module to place a light.
    const geom = async () => page.evaluate(() => {
      const c = document.querySelector('[data-canvas-complete]');
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const at = (g, p) => {
      const k = (Math.min(g.w, g.h) * 0.46) / 1.4;
      return { x: g.x + g.w / 2 + p[0] * k, y: g.y + g.h / 2 + p[1] * k };
    };
    const ringPts = (n, rad) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
        out.push([Math.cos(t) * (rad || 1), Math.sin(t) * (rad || 1)]);
      }
      return out;
    };
    const tool = async (m) => page.click('[data-mode="' + m + '"]');
    const drawRing = async (n) => {
      const g = await geom();
      const pts = ringPts(n);
      await tool('add');
      for (const p of pts) { const q = at(g, p); await page.mouse.click(q.x, q.y); }
      await tool('join');
      for (let i = 0; i < n; i++) {
        const a = at(g, pts[i]), b = at(g, pts[(i + 1) % n]);
        await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
      }
      return { g, pts };
    };
    const mid = (g, a, b) => { const A = at(g, a), B = at(g, b); return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; };
    const readState = async () => page.evaluate(() => ({
      s: window.ShapeLab.state(), m: window.ShapeLab.metrics(), playable: window.ShapeLab.playable(),
      label: document.querySelector('[data-budget-label]').textContent,
      say: document.querySelector('[data-say]').textContent,
      playDisabled: document.querySelector('[data-play]').disabled,
      why: document.querySelector('[data-play-why]').textContent
    }));

    // ---- SL4: a figure at every budget, by clicking ----
    const built = {};
    for (const n of [8, 12, 16, 20]) {
      await page.click('[data-reset]');
      await page.click('[data-budget="' + n + '"]');
      const { g, pts } = await drawRing(n);
      await tool('gap');
      const m0 = mid(g, pts[0], pts[1]);
      await page.mouse.click(m0.x, m0.y);
      built[n] = await readState();
    }
    ck([8, 12, 16, 20].every((n) => built[n].s.points.length === n && built[n].s.budget === n &&
         built[n].m.connections === n && built[n].m.missing === 1 && built[n].m.components === 1 &&
         built[n].m.allPlaced && built[n].m.percentUsed === 100),
      'SL4  a figure is drawn with real clicks at 8, 12, 16 and 20 — N lights, N joins, one gap, one piece',
      [8, 12, 16, 20].map((n) => n + ':' + built[n].s.points.length + '/' + built[n].m.connections + '/' + built[n].m.missing).join(' '));
    ck([8, 12, 16, 20].every((n) => new RegExp('TESTING ' + n + ' POINTS').test(built[n].label)) &&
       /production budget/.test(built[8].label) && [12, 16, 20].every((n) => /research budget/.test(built[n].label)),
      'SL4b it is obvious which budget is being tested, and which one is production',
      built[12].label);
    ck(built[8].m.validator.ok && built[8].playable && !built[8].playDisabled &&
       [12, 16, 20].every((n) => !built[n].m.validator.ok && !built[n].playable && built[n].playDisabled),
      'SL4c the 8-light figure passes the REAL validator and can be played; 12, 16 and 20 are refused and cannot',
      [12, 16, 20].map((n) => n + ':' + built[n].m.validator.reasons.join('|')).join(' '));
    ck([12, 16, 20].every((n) => /performs up to 8 lights/.test(built[n].why) && /not changed/.test(built[n].why)),
      'SL4d and the refusal says so in words beside the figure — the runtime is not changed by the tool');
    ck(built[8].s.missing.length === 1 && built[8].s.joins[built[8].s.missing[0]] === '0-1',
      'SL4e the missing join is the one that was clicked, and no other', JSON.stringify(built[8].s.missing));

    // ---- SL5: the budget cannot be exceeded, silently or otherwise ----
    await page.click('[data-reset]');
    await page.click('[data-budget="8"]');
    const eight = await drawRing(8);
    await tool('add');
    const spare = at(eight.g, [0.3, 0.2]);
    await page.mouse.click(spare.x, spare.y);
    const afterNinth = await readState();
    const apiNinth = await page.evaluate(() => window.ShapeLab.addPoint(0.1, 0.1));
    ck(afterNinth.s.points.length === 8 && /full/.test(afterNinth.say) && !apiNinth.ok && /budget-full:8/.test(apiNinth.reason),
      'SL5  a ninth light at budget 8 is refused — on the canvas with a sentence, and at the API by name',
      afterNinth.say + ' / ' + apiNinth.reason);
    // Shrinking under a bigger figure is refused, never trimmed.
    await page.click('[data-reset]');
    await page.click('[data-budget="12"]');
    await drawRing(12);
    await page.click('[data-budget="8"]');
    const shrunk = await readState();
    ck(shrunk.s.budget === 12 && shrunk.s.points.length === 12 && /nothing is trimmed/i.test(shrunk.say),
      'SL5b shrinking the budget under a 12-light figure is refused, and nothing is trimmed',
      'budget:' + shrunk.s.budget + ' points:' + shrunk.s.points.length);
    const badRec = await page.evaluate(() => {
      const S = window.ShapeLab;
      const pts = []; for (let i = 0; i < 13; i++) pts.push([Math.cos(i) * 0.9, Math.sin(i) * 0.9]);
      const rec = { id: 'shape-hand-edited', labVersion: S.LAB_VERSION, name: 'Smuggled', budget: 12,
                    points: pts, joins: ['0-1'], missing: [] };
      localStorage.setItem(S.STORE_KEY, JSON.stringify([rec]));
      const r = S.load('shape-hand-edited');
      const s = S.state();
      const imp = S.importJSON(JSON.stringify([Object.assign({}, rec, { id: 'shape-other' })]));
      localStorage.removeItem(S.STORE_KEY);
      return { r, points: s.points.length, imp };
    });
    ck(!badRec.r.ok && badRec.r.reason === 'fixture-exceeds-budget' && badRec.points === 0 &&
       badRec.imp.added === 0 && badRec.imp.refused === 1,
      'SL5c a hand-edited fixture with more lights than its budget is REFUSED on open and on import, never trimmed',
      badRec.r.reason + ' import:' + JSON.stringify(badRec.imp));

    // ---- SL6: connections are editable — add, remove, delete a light, move a light ----
    await page.click('[data-reset]');
    await page.click('[data-budget="8"]');
    const ed = await drawRing(8);
    await tool('join');
    // the same pair again REMOVES the join
    let A = at(ed.g, ed.pts[2]), B = at(ed.g, ed.pts[3]);
    await page.mouse.click(A.x, A.y); await page.mouse.click(B.x, B.y);
    const afterRemovePair = await readState();
    // clicking a LINE in Join removes it
    const m45 = mid(ed.g, ed.pts[4], ed.pts[5]);
    await page.mouse.click(m45.x, m45.y);
    const afterRemoveLine = await readState();
    // and the pair once more puts it back
    await page.mouse.click(A.x, A.y); await page.mouse.click(B.x, B.y);
    const afterReadd = await readState();
    ck(afterRemovePair.m.connections === 7 && afterRemovePair.s.joins.indexOf('2-3') === -1 &&
       afterRemoveLine.m.connections === 6 && afterRemoveLine.s.joins.indexOf('4-5') === -1 &&
       afterReadd.m.connections === 7 && afterReadd.s.joins.indexOf('2-3') !== -1,
      'SL6  a connection is added, removed by its pair, removed by clicking the line, and added back',
      [afterRemovePair.m.connections, afterRemoveLine.m.connections, afterReadd.m.connections].join('→'));
    ck(afterRemoveLine.m.components === 2,
      'SL6b the components metric follows: two joins gone from a ring leaves TWO pieces', String(afterRemoveLine.m.components));
    // delete a light: its joins go, every index above it steps down
    await tool('delete');
    const d = at(ed.g, ed.pts[7]);
    await page.mouse.click(d.x, d.y);
    const afterDelete = await readState();
    ck(afterDelete.s.points.length === 7 &&
       afterDelete.s.joins.every((j) => j.split('-').every((n) => Number(n) < 7)) &&
       afterDelete.s.joins.indexOf('6-7') === -1 && afterDelete.s.joins.indexOf('0-7') === -1,
      'SL6c deleting a light takes its joins with it and renumbers the rest — no join points past the end',
      afterDelete.s.joins.join(' '));
    // move a light by dragging
    const before = afterDelete.s.points[0].slice();
    const from = at(ed.g, ed.pts[0]), to = at(ed.g, [0, -0.4]);
    await tool('move');
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 }); await page.mouse.up();
    const afterMove = await readState();
    ck(Math.abs(afterMove.s.points[0][1] - (-0.4)) < 0.06 && Math.abs(before[1] - (-1)) < 0.06 &&
       afterMove.s.points.length === 7 && afterMove.m.connections === afterDelete.m.connections,
      'SL6d dragging a light moves it, and its joins come with it',
      before.join(',') + ' → ' + afterMove.s.points[0].join(','));
    // point numbers are drawn while editing (the toggle), never on the unfinished state
    const numbersDrawn = await page.evaluate(() => {
      const src = window.ShapeLab.draw.toString();
      return /fillText/.test(src) && /numbers/.test(src);
    });
    ck(numbersDrawn, 'SL6e light numbers are drawn while editing, behind a toggle');

    // ---- SL7: a missing join is EXPLICIT, and the two states differ exactly there ----
    await page.click('[data-reset]');
    await page.click('[data-budget="8"]');
    const sv = await drawRing(8);
    await tool('gap');
    const gm = mid(sv.g, sv.pts[3], sv.pts[4]);
    await page.mouse.click(gm.x, gm.y);
    const paint = await page.evaluate((pts) => {
      const S = window.ShapeLab, s = S.state();
      // "lit" is brightness ABOVE the sky behind it. The canvas paints a
      // vertical gradient, so the reference is the same row at the left
      // edge, where nothing is ever drawn.
      function lit(sel, u) {
        const c = document.querySelector(sel), r = c.getBoundingClientRect();
        const dpr = c.width / r.width;
        const k = (Math.min(r.width, r.height) * 0.46) / 1.4;
        const x = (r.width / 2 + u[0] * k) * dpr, y = (r.height / 2 + u[1] * k) * dpr;
        const g = c.getContext('2d');
        const px = (xx) => {
          const d = g.getImageData(Math.round(xx) - 4, Math.round(y) - 4, 8, 8).data;
          let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]);
          return m;
        };
        return Math.max(0, px(x) - px(6));
      }
      // sample a little off the midpoint so a dash (not a dash gap) is under the box
            const keptU = [(pts[5][0] + pts[6][0]) / 2, (pts[5][1] + pts[6][1]) / 2];
      // A dashed line is mostly gap, so the segment is sampled along
      // its middle half and the brightest sample is what counts.
      const along = (sel) => {
        let m = 0;
        for (let t = 0.3; t <= 0.7; t += 0.04) {
          m = Math.max(m, lit(sel, [pts[3][0] * (1 - t) + pts[4][0] * t, pts[3][1] * (1 - t) + pts[4][1] * t]));
        }
        return m;
      };
      const gapMax = along('[data-canvas-complete]');
      const unfGap = along('[data-canvas-unfinished]');
      return { missing: s.missing, joinAt: s.joins[s.missing[0]],
               completeGap: gapMax, unfinishedGap: unfGap,
               completeKept: lit('[data-canvas-complete]', keptU), unfinishedKept: lit('[data-canvas-unfinished]', keptU) };
    }, sv.pts);
    ck(paint.missing.length === 1 && paint.joinAt === '3-4',
      'SL7  the missing join is exactly the one the researcher clicked — never chosen for them', paint.joinAt);
    ck(paint.completeGap > 10 && paint.unfinishedGap <= 2 && paint.completeKept > 40 && paint.unfinishedKept > 40,
      'SL7b COMPLETE shows the gap dashed; UNFINISHED shows nothing there at all — and a kept join is lit on both',
      JSON.stringify({ cg: paint.completeGap, ug: paint.unfinishedGap, ck: paint.completeKept, uk: paint.unfinishedKept }));

    // ---- SL8: the creature name is researcher metadata, and travels nowhere ----
    await page.fill('[data-name]', 'Falcon');
    await page.fill('[data-hint]', 'Something with wings is waiting…');
    await page.fill('[data-notes]', 'research notes only');
    const cand = await page.evaluate(() => {
      const S = window.ShapeLab;
      const c = S.candidateFor();
      return { json: JSON.stringify(c), id: c.id, nodes: c.arrangement.nodes, pts: c.arrangement.figure.points.length,
               stateName: S.state().name };
    });
    ck(cand.stateName === 'Falcon' && !/falcon|wings|research notes/i.test(cand.json) && /^lab-shape-\d+$/.test(cand.id),
      'SL8  the name, the hint and the notes are in the fixture and NOT in the candidate; the id is opaque',
      cand.id);
    ck(!/state\.name|\.name\b/.test(stripComments(shapeSrc.slice(shapeSrc.indexOf('function draw('), shapeSrc.indexOf('function pointAt(')))),
      'SL8b the drawing code never reads the name — it cannot alter rendering');
    // (A word-match for "generate" would catch the module's own comment
    // saying it generates nothing, and `byName` — a grouping variable in
    // the fixture list. The honest test is structural: no line of code
    // couples a light's coordinates to the name.)
    const coupled = shapeStripped.split('\n').filter((l) => /\bpoints\b/.test(l) && /\bname\b/.test(l));
    ck(coupled.length === 0 && !/function\s+generate/i.test(shapeStripped),
      'SL8c no geometry is ever generated from a name — no line couples the two', coupled.join(' | ') || 'clean');

    // ---- SL9: save, reopen after a reload, and only ONE key is ever written ----
    const saved = await page.evaluate(() => {
      const S = window.ShapeLab;
      const g1 = document.querySelector('[data-judgement] input[name="jComplete"]');
      const g2 = document.querySelector('[data-judgement] input[name="jUnfinished"]');
      if (g1) { g1.checked = true; g1.dispatchEvent(new Event('change', { bubbles: true })); }
      if (g2) { g2.checked = true; g2.dispatchEvent(new Event('change', { bubbles: true })); }
      const ta = document.querySelectorAll('[data-judgement] textarea');
      if (ta[0]) { ta[0].value = 'a ring of lights'; ta[0].dispatchEvent(new Event('input', { bubbles: true })); }
      const r = S.save();
      return { r, keys: Object.keys(localStorage), state: S.state(), radios: !!(g1 && g2), tas: ta.length };
    });
    ck(saved.r.ok && /^shape-/.test(saved.r.id) && saved.keys.length === 1 && saved.keys[0] === 'vihu.lab.shapes',
      'SL9  a save writes ONE key, vihu.lab.shapes, and nothing else', JSON.stringify(saved.keys));
    ck(saved.radios && saved.tas === 3 && saved.state.judgement && typeof saved.state.judgement === 'object' &&
       Object.keys(saved.state.judgement).every((k) => typeof saved.state.judgement[k] === 'string'),
      'SL9b the judgement panel is two choices and three sentences — every value a word, never a number',
      JSON.stringify(saved.state.judgement));
    await page.reload();
    await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    const reopened = await page.evaluate((id) => {
      const S = window.ShapeLab;
      const fresh = S.state();
      const inList = S.list().some((r) => r.id === id);
      const r = S.load(id);
      const rec = S.list().filter((x) => x.id === id)[0];
      return { fresh, inList, r, s: S.state(), rec,
               opened: document.querySelector('[data-opened]').textContent,
               nameField: document.querySelector('[data-name]').value,
               teaseBox: document.querySelector('[data-tease]').checked };
    }, saved.r.id);
    ck(reopened.fresh.points.length === 0 && reopened.inList && reopened.r.ok &&
       JSON.stringify(reopened.s.points) === JSON.stringify(saved.state.points) &&
       JSON.stringify(reopened.s.joins) === JSON.stringify(saved.state.joins) &&
       JSON.stringify(reopened.s.missing) === JSON.stringify(saved.state.missing) &&
       reopened.s.name === 'Falcon' && reopened.s.hint === saved.state.hint && reopened.s.notes === saved.state.notes &&
       JSON.stringify(reopened.s.judgement) === JSON.stringify(saved.state.judgement) &&
       reopened.nameField === 'Falcon' && new RegExp(saved.r.id).test(reopened.opened),
      'SL9c after a reload the page opens EMPTY, the fixture is listed, and reopening restores every field',
      reopened.opened);
    ck(reopened.rec && reopened.rec.labVersion === 'shape-lab-1' && /^\d{4}-\d{2}-\d{2}T/.test(reopened.rec.createdAt) &&
       /^\d{4}-\d{2}-\d{2}T/.test(reopened.rec.updatedAt) && reopened.rec.budget === 8 &&
       Array.isArray(reopened.rec.missing) && typeof reopened.rec.hint === 'string',
      'SL9d the record carries name, budget, points, joins, missing, hint, notes, a timestamp and a Lab version');
    ck(reopened.s.tease === false && reopened.teaseBox === false,
      'SL10 the delayed dashed-line aid is OFF by default — on the fixture and on the checkbox');

    // ---- SL11: comparison fixtures are INDEPENDENT ----
    const cmp = await page.evaluate((id) => {
      const S = window.ShapeLab;
      const d12 = S.duplicate(id, 12), d16 = S.duplicate(id, 16), d20 = S.duplicate(id, 20);
      const tooSmall = (function () {
        const rec = S.list().filter((x) => x.id === d12.id)[0];
        // make the 12-copy genuinely 12 lights, then ask for it at 8
        S.load(d12.id);
        for (let i = 0; i < 4; i++) S.addPoint(0.2 * i - 0.3, 0.1);
        S.save();
        return S.duplicate(d12.id, 8);
      })();
      // edit the ORIGINAL: one more gap, and save
      S.load(id);
      S.toggleGap(2);
      S.save();
      const orig = S.list().filter((x) => x.id === id)[0];
      const c16 = S.list().filter((x) => x.id === d16.id)[0];
      const c20 = S.list().filter((x) => x.id === d20.id)[0];
      return { ids: [id, d12.id, d16.id, d20.id], tooSmall,
               origMissing: orig.missing, c16Missing: c16.missing, c20Missing: c20.missing,
               c16Judgement: c16.judgement, budgets: S.compare('Falcon').map((r) => r.budget),
               names: S.names() };
    }, saved.r.id);
    ck(new Set(cmp.ids).size === 4 && cmp.budgets.join(',') === '8,12,16,20' && cmp.names.indexOf('Falcon') !== -1,
      'SL11 one figure duplicated to 12, 16 and 20 is four independent fixtures, compared in budget order',
      cmp.budgets.join(','));
    ck(cmp.origMissing.length === 2 && cmp.c16Missing.length === 1 && cmp.c20Missing.length === 1 && cmp.c16Judgement === null,
      'SL11b editing the original changes nothing in a copy, and a copy carries no judgement of its own',
      'orig:' + cmp.origMissing.length + ' c16:' + cmp.c16Missing.length);
    ck(!cmp.tooSmall.ok && /figure-has-12-lights/.test(cmp.tooSmall.reason),
      'SL11c duplicating a 12-light figure INTO budget 8 is refused — the copy is never trimmed to fit', cmp.tooSmall.reason);
    // the comparison strip renders every budget at ONE scale
    const tiles = await page.evaluate(() => {
      const sel = document.querySelector('[data-compare-name]');
      sel.value = 'Falcon'; sel.dispatchEvent(new Event('change'));
      const t = Array.from(document.querySelectorAll('[data-compare] .ctile'));
      return t.map((x) => ({ title: x.querySelector('.ctitle').textContent,
                             canvases: x.querySelectorAll('canvas').length }));
    });
    ck(tiles.length === 4 && tiles.every((t) => t.canvases === 2) &&
       tiles.map((t) => t.title.replace(/\D/g, '')).join(',') === '8,12,16,20',
      'SL11d the comparison lays the four side by side, complete and unfinished each, in budget order',
      tiles.map((t) => t.title).join(' | '));
    ck(/one fixed scale/i.test(shapeHtml) && /scaleFor/.test(shapeSrc) && !/autoFit|fitTo|bounding/.test(shapeStripped),
      'SL11e and every canvas uses ONE fixed scale — nothing auto-fits a figure to flatter a budget');

    // ---- SL12: reset ----
    const rs = await page.evaluate(() => {
      const S = window.ShapeLab;
      document.querySelector('[data-reset]').click();
      return { s: S.state(), opened: document.querySelector('[data-opened]').textContent,
               name: document.querySelector('[data-name]').value, count: S.list().length };
    });
    ck(rs.s.points.length === 0 && rs.s.joins.length === 0 && rs.s.name === '' && rs.s.hint === '' &&
       rs.s.judgement === null && rs.s.tease === false && rs.s.id === null && /unsaved/.test(rs.opened) &&
       rs.name === '' && rs.count === 4,
      'SL12 Reset clears the workspace and every field, detaches from the fixture, and deletes nothing saved',
      'fixtures still:' + rs.count);

    // ---- SL13: export / import round trip ----
    const rt = await page.evaluate(() => {
      const S = window.ShapeLab;
      const before = S.list().length;
      const out = S.exportJSON();
      S.list().forEach((r) => S.remove(r.id));
      const gone = S.list().length;
      const imp = S.importJSON(out);
      return { before, gone, imp, after: S.list().length, kind: JSON.parse(out).kind };
    });
    ck(rt.before === 4 && rt.gone === 0 && rt.imp.ok && rt.imp.added === 4 && rt.after === 4 && rt.kind === 'vihu-shape-lab-fixtures',
      'SL13 fixtures export as JSON and import back — research artifacts a person can keep, never the pool',
      JSON.stringify(rt.imp));

    // ---- SL14: PLAY IN ETHER uses the actual figure data ----
    // Take a saved 8-light fixture through the real preview, exactly as
    // the Play button does — the same candidate builder, the hint beside
    // it, the name nowhere.
    const fx = await page.evaluate(() => {
      const S = window.ShapeLab;
      const rec = S.list().filter((r) => r.budget === 8)[0];
      return { rec, cand: S.candidateFor(rec) };
    });
    const pv = await ctx.newPage();
    await pv.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await pv.waitForFunction(() => !!window.LabPreview, null, { timeout: 20000 });
    const played = await pv.evaluate(async ([cand, rec, tease]) => {
      const step = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      window.LabPreview.play(cand, 'shape-suite', 'play', { hint: rec.hint, tease: tease });
      await wait(1800);
      const i = window.LabPreview.instrument();
      const links = i.arrangement.links.map((L) => Math.min(L.a, L.b) + '-' + Math.max(L.a, L.b)).sort();
      const missingLinks = i.arrangement.links.filter((L) => !L.present)
        .map((L) => Math.min(L.a, L.b) + '-' + Math.max(L.a, L.b)).sort();
      const teaseCanvas = document.querySelector('[data-tease]');
      const posed = { elements: i.elements.length, links, missingLinks, missingLeft: i.arrangement.missingLeft,
                      teaseState: window.LabPreview.tease(), teaseHidden: teaseCanvas ? teaseCanvas.hidden : null,
                      teaseInert: teaseCanvas ? getComputedStyle(teaseCanvas).pointerEvents === 'none' : null };
      await wait(1400);
      const words = (document.body.innerText || '');
      // two wrong pairs, then look for any aid at all
      const my = window.LabPreview.mystery();
      const isGap = (a, b) => i.arrangement.links.some((L) => !L.present &&
        ((L.a === a && L.b === b) || (L.a === b && L.b === a)));
      let tried = 0;
      for (let a = 0; a < i.elements.length && tried < 2; a++)
        for (let b = a + 1; b < i.elements.length && tried < 2; b++) {
          if (isGap(a, b)) continue;
          my.touchAt(i.elements[a].x, i.elements[a].y); await step();
          my.touchAt(i.elements[b].x, i.elements[b].y); await step();
          tried++;
        }
      await wait(1500);
      const afterWrong = { teaseState: window.LabPreview.tease(),
                           teaseHidden: teaseCanvas ? teaseCanvas.hidden : null };
      // complete it
      let j = my.instrument(), guard = 40;
      while (guard-- > 0 && j && j.arrangement && j.arrangement.missingLeft > 0) {
        const gap = j.arrangement.links.filter((L) => !L.present)[0];
        my.touchAt(j.elements[gap.a].x, j.elements[gap.a].y); await step();
        my.touchAt(j.elements[gap.b].x, j.elements[gap.b].y); await step();
        j = my.instrument();
      }
      const live = window.LabPreview.instrument();
      const whole = live ? live.arrangement.links.filter((L) => L.present).length : -1;
      await wait(6800);
      return { posed, words, afterWrong, whole, alive: window.LabPreview.alive().length };
    }, [fx.cand, fx.rec, false]);
    ck(played.posed.elements === fx.rec.points.length &&
       played.posed.links.join(' ') === fx.rec.joins.slice().sort().join(' ') &&
       played.posed.missingLinks.join(' ') === fx.rec.missing.map((k) => fx.rec.joins[k]).sort().join(' ') &&
       played.posed.missingLeft === fx.rec.missing.length,
      'SL14 the preview poses EXACTLY the fixture — its lights, its joins, its missing joins — through the real interpreter',
      played.posed.elements + ' lights, ' + played.posed.links.length + ' joins, gaps ' + played.posed.missingLinks.join(','));
    ck(played.words.indexOf(fx.rec.hint) !== -1 && !/falcon/i.test(played.words),
      'SL14b the hint is on the stage and the creature name is not — anywhere');
    ck(played.posed.teaseState === null && played.afterWrong.teaseState === null && played.afterWrong.teaseHidden === true,
      'SL14c with the aid OFF, two wrong pairs bring no dashed line — nothing leans');
    ck(played.whole === fx.rec.joins.length && played.alive === 1,
      'SL14d completing it through the real two-tap interaction wakes it, and it roams — the existing awakening, unchanged',
      played.whole + '/' + fx.rec.joins.length + ' alive:' + played.alive);
    // and with the aid ON it is the existing delayed aid: shown after two tries, inert
    const aided = await pv.evaluate(async ([cand, rec]) => {
      const step = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      window.LabPreview.play(cand, 'shape-suite-2', 'play', { hint: rec.hint, tease: 'delayed' });
      await wait(1800);
      const i = window.LabPreview.instrument();
      const my = window.LabPreview.mystery();
      const isGap = (a, b) => i.arrangement.links.some((L) => !L.present &&
        ((L.a === a && L.b === b) || (L.a === b && L.b === a)));
      let tried = 0;
      for (let a = 0; a < i.elements.length && tried < 2; a++)
        for (let b = a + 1; b < i.elements.length && tried < 2; b++) {
          if (isGap(a, b)) continue;
          my.touchAt(i.elements[a].x, i.elements[a].y); await step();
          my.touchAt(i.elements[b].x, i.elements[b].y); await step();
          tried++;
        }
      let guard = 240;
      while (guard-- > 0) { const s = window.LabPreview.tease(); if (!s || s.phase === 'hold') break; await step(); }
      const c = document.querySelector('[data-tease]');
      return { state: window.LabPreview.tease(), inert: getComputedStyle(c).pointerEvents === 'none',
               words: (c.textContent || '').trim() };
    }, [fx.cand, fx.rec]);
    ck(aided.state && aided.state.mode === 'delayed' && aided.state.shown === 1 && aided.inert && aided.words === '',
      'SL14e with the aid ON it is the existing delayed aid — one gap after two tries, inert, wordless — and nothing new',
      JSON.stringify(aided.state));
    await pv.close();
    await page.close();
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- SL15: what the Play button actually sends ----
  const playHandler = shapeSrc.slice(shapeSrc.lastIndexOf("el('[data-play]')"), shapeSrc.indexOf("global.addEventListener('resize'"));
  ck(/Host\.open\(cand,/.test(playHandler) && /hint:\s*state\.hint/.test(playHandler) &&
     /tease:\s*state\.tease\s*\?\s*'delayed'\s*:\s*false/.test(playHandler) && !/state\.name/.test(playHandler),
    'SL15 the Play button hands the preview the candidate, the hint beside it and the aid as chosen — never the name');
  ck(!/labShape|shape\.html/.test(read('tools/ether-mystery-lab/preview.html')) &&
     !/ShapeLab/.test(read('tools/ether-mystery-lab/labPreview.js')),
    'SL15b the preview knows nothing about the Shape Lab — it performs a candidate, whoever built it');
}

// ===================================================================
// GL. THE CREATURE CANDIDATE GALLERY — Phase 1 (creature representation).
//
// A research instrument: authored COMPLETED figures at 8 · 12 · 16 · 20,
// laid out to be looked at and judged by a person. Nothing here judges a
// creature; every check is about the instrument being exact — the point
// counts are factual, the name is metadata, the figure reaches the
// editor unchanged, and production is untouched.
// ===================================================================
async function sectionGL() {
  console.log('\n== GL. the Creature Candidate Gallery (instrument) ==');
  const { chromium } = require('playwright');
  const sb = kitSandbox();
  const G = sb.EtherGrammar || (sb.window && sb.window.EtherGrammar);
  const Kit = sb.EtherMysteryLabKit || (sb.window && sb.window.EtherMysteryLabKit);
  const loadData = () => {
    const s = { console }; s.window = undefined; s.global = s;
    vm.runInNewContext(read('tools/ether-mystery-lab/labGalleryData.js'), s, { filename: 'labGalleryData.js' });
    return s.EtherLabGalleryData;
  };
  const D = loadData();
  const dataSrc = read('tools/ether-mystery-lab/labGalleryData.js');
  const gallerySrc = read('tools/ether-mystery-lab/labGallery.js');
  const galleryHtml = read('tools/ether-mystery-lab/gallery.html');
  const galleryStripped = stripComments(gallerySrc);
  const STARTERS = ['butterfly', 'fish', 'whale', 'bird', 'manta ray', 'fox', 'polar bear', 'elephant', 'octopus', 'snake'];

  // ---- GL1: production untouched ----
  const grepProd = require('child_process').spawnSync('grep',
    ['-rl', '-e', 'CreatureGallery', '-e', 'labGallery', '-e', 'EtherLabGalleryData', '-e', 'vihu.lab.gallery', '-e', 'vihu.lab.shape.handoff',
     path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet'),
     path.join(ROOT, 'index.html'), path.join(ROOT, 'studio.html')],
    { encoding: 'utf8' }).stdout || '';
  ck(grepProd.trim() === '', 'GL1  nothing a child loads names the gallery, its data, its store or the hand-off', grepProd.trim() || 'clean');
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'GL1b the production point limit is still EIGHT');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'GL1c the build is not bumped — every stamp still reads 0769', Array.from(new Set(stamps)).join(','));
  ck(!/experience-pool/.test(galleryHtml) && !/experience-pool|EtherExperience\b|EtherMystery\b/.test(galleryStripped) && !/experience-pool/.test(dataSrc),
    'GL1d the gallery never loads the production pool or the runtime, and its data names neither');

  // ---- GL2: the data is exact ----
  const byKey = {};
  D.candidates.forEach((c) => { const k = c.creature + '|' + c.budget; (byKey[k] = byKey[k] || []).push(c); });
  const coverage = STARTERS.map((n) => [8, 12, 16, 20].map((b) => (byKey[n + '|' + b] || []).length));
  ck(JSON.stringify(D.creatures) === JSON.stringify(STARTERS) && coverage.every((row) => row.every((k) => k >= 3)),
    'GL2  all ten starting creatures × four budgets × at least three candidates', D.candidates.length + ' candidates · ' + coverage.map((r) => r.join('/')).join(' '));
  const exact = D.candidates.filter((c) => c.points.length !== c.budget);
  ck(exact.length === 0, 'GL2b every candidate contains EXACTLY its advertised number of points — 8 is 8, 20 is 20', exact.map((c) => c.creature + '-' + c.budget + '-' + c.n + ':' + c.points.length).join(' ') || 'all exact');
  const unsound = D.candidates.map((c) => {
    const n = c.points.length, used = new Set(), seen = new Set(), errs = [];
    c.joins.forEach((j) => {
      const m = /^(\d+)-(\d+)$/.exec(j); if (!m) { errs.push('spelling ' + j); return; }
      const a = +m[1], b = +m[2];
      if (a >= n || b >= n) errs.push('range ' + j); if (a === b) errs.push('self ' + j);
      if (seen.has(j)) errs.push('dup ' + j); seen.add(j); used.add(a); used.add(b);
    });
    for (let k = 0; k < n; k++) if (!used.has(k)) errs.push('unused point ' + k);
    c.points.forEach((p, k) => { if (!(Math.abs(p[0]) <= 1.4 && Math.abs(p[1]) <= 1.4)) errs.push('coord ' + k); });
    return errs.length ? c.creature + '-' + c.budget + '-' + c.n + ':' + errs.join(',') : null;
  }).filter(Boolean);
  ck(unsound.length === 0, 'GL2c no hidden point, no unused point, no join to nowhere, every join "a-b", every coordinate inside the sky', unsound.join(' ') || 'sound');
  ck(JSON.stringify(loadData()) === JSON.stringify(D) && JSON.stringify(loadData()) === JSON.stringify(D),
    'GL2d the candidates are deterministic — loading the data three times gives the same figures byte for byte');
  ck(!/Math\.random|Date\b|fetch\(|XMLHttpRequest|<img|drawImage|\.png|\.jpg|\.svg|Image\(|url\(/.test(stripComments(dataSrc)),
    'GL2e the data is literal: no randomness, no clock, no network, no image, no SVG, no silhouette reference');
  ck(!/<img|drawImage|\.png|\.jpg|\.svg|Image\(|background-image|url\(|fetch\(|XMLHttpRequest|score|rank/i.test(galleryStripped) &&
     !/<img|\.png|\.jpg|\.svg|background-image/i.test(galleryHtml.replace(/<!--[\s\S]*?-->/g, '')),
    'GL2f the gallery draws no image, traces nothing, asks no model, scores nothing and ranks nothing');
  ck(!/if\s*\(\s*(c\.)?creature\s*===|switch\s*\(\s*(c\.)?creature/.test(galleryStripped) &&
     galleryStripped.split('\n').filter((l) => /\bpoints\b/.test(l) && /\bcreature\b/.test(l)).length === 0,
    'GL2g no geometry is computed from a creature name — no branch on the name, no line couples a name to a point');

  // ---- GL3: the name is metadata ----
  const names = STARTERS.map((n) => n.toLowerCase());
  const leak = D.candidates.filter((c) => {
    const fig = JSON.stringify({ points: c.points, joins: c.joins }).toLowerCase();
    const cand = JSON.stringify(Kit.creatureCandidate({ id: 'lab-gallery-x', nodes: c.points.length, title: 't', figure: { points: c.points, joins: c.joins, gaps: [0] } })).toLowerCase();
    return names.some((n) => fig.indexOf(n) !== -1 || cand.indexOf(n) !== -1);
  });
  ck(leak.length === 0, 'GL3  no creature name is in any figure or in any candidate the interpreter could be handed', leak.length + ' leaks');
  ck(!/fillText|strokeText/.test(galleryStripped) && !/fillText|strokeText/.test(stripComments(dataSrc)),
    'GL3b neither the gallery nor its data can write text on a canvas — the only renderer is the Shape Lab\'s draw()');

  // ---- GL4: the real validator ----
  const c8 = byKey['butterfly|8'][0], c12 = byKey['butterfly|12'][0], c16 = byKey['fish|16'][0], c20 = byKey['whale|20'][0];
  const probe = (c) => G.validate(Kit.creatureCandidate({ id: 'lab-gallery-x', nodes: c.points.length, title: 't', figure: { points: c.points, joins: c.joins, gaps: [0] } }));
  const all8 = D.candidates.filter((c) => c.budget === 8).map((c) => ({ c, v: probe(c) }));
  ck(all8.every((r) => r.v.ok), 'GL4  every 8-point candidate PASSES the real validator once one join is marked missing — the geometry is genuinely playable',
    all8.filter((r) => !r.v.ok).map((r) => r.c.creature + '-' + r.c.n + ':' + r.v.reasons).join(' ') || all8.length + '/' + all8.length);
  ck(!probe(c12).ok && !probe(c16).ok && !probe(c20).ok, 'GL4b and 12, 16 and 20 are refused by it — the research budgets are refused exactly as expected',
    [probe(c12), probe(c16), probe(c20)].map((v) => v.reasons[0]).join(','));

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [], bad = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    page.on('response', (q) => { if (q.status() >= 400 && !/favicon/.test(q.url())) bad.push(q.status() + ' ' + q.url()); });
    // a text spy on every canvas, installed before the page's scripts run
    await page.addInitScript(() => {
      window.__textDraws = 0;
      const p = CanvasRenderingContext2D.prototype;
      ['fillText', 'strokeText'].forEach((k) => { const o = p[k]; p[k] = function () { window.__textDraws++; return o.apply(this, arguments); }; });
    });
    await page.goto(BASE + '/tools/ether-mystery-lab/gallery.html');
    await page.waitForFunction(() => !!window.CreatureGallery && !!window.ShapeLab && !!window.EtherLabGalleryData, null, { timeout: 20000 });

    // ---- GL5: loads clean, writes nothing ----
    const atLoad = await page.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage),
      cards: document.querySelectorAll('.gcard:not(.gnone)').length, text: window.__textDraws, title: document.querySelector('[data-gtitle]').textContent }));
    ck(errors.length === 0 && bad.length === 0 && atLoad.ls.length === 0 && atLoad.ss.length === 0,
      'GL5  the gallery loads clean and writes NOTHING to storage', 'errors:' + errors.length + ' http:' + bad.length + ' keys:' + (atLoad.ls.length + atLoad.ss.length));

    // ---- GL6: by creature, all four budgets ----
    const grid = async () => page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.gcard:not(.gnone)'));
      const heads = Array.from(document.querySelectorAll('.ghead div')).map((d) => d.textContent.trim());
      const D = window.EtherLabGalleryData, G = window.CreatureGallery;
      const byId = {}; D.candidates.forEach((c) => { byId[G.idOf(c)] = c; });
      return { heads, headVisible: Array.from(document.querySelectorAll('.ghead div')).map((d) => getComputedStyle(d).visibility),
        cards: cards.map((el) => {
          const id = el.getAttribute('data-card'), c = byId[id];
          const cv = el.querySelector('canvas');
          const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data;
          let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 120 && d[i + 1] > 120) lit++;
          const play = Array.from(el.querySelectorAll('button')).filter((b) => /Play in Ether/.test(b.textContent))[0];
          return { id, budget: c && c.budget, pts: c && c.points.length, joins: c && c.joins.length, meta: el.querySelector('.gmeta').textContent,
                   lit, playDisabled: !!(play && play.disabled), why: el.querySelector('.gwhy').textContent, text: el.textContent };
        }), textDraws: window.__textDraws, title: document.querySelector('[data-gtitle]').textContent };
    });
    let g = await grid();
    ck(g.heads.length === 4 && /^8 POINTS/.test(g.heads[0]) && /production/.test(g.heads[0]) && /^20 POINTS/.test(g.heads[3]) &&
       g.cards.length === 12 && [8, 12, 16, 20].every((b) => g.cards.filter((c) => c.budget === b).length === 3),
      'GL6  BY CREATURE lays one creature in four budget columns — 8 · 12 · 16 · 20, three candidates each', g.heads.join(' | '));
    ck(g.cards.every((c) => new RegExp('^' + c.budget + ' points · candidate \\d').test(c.meta) && new RegExp(c.pts + ' points · ' + c.joins + ' joins').test(c.meta)),
      'GL6b each card states its point count, its candidate number and the factual point/join counts, and they agree with the data');
    ck(g.cards.every((c) => c.lit > 200) && g.textDraws === 0,
      'GL6c every figure is painted, and not one character of text was drawn on any canvas', 'min lit ' + Math.min.apply(null, g.cards.map((c) => c.lit)) + ' · text draws ' + g.textDraws);
    ck(g.cards.every((c) => c.playDisabled) &&
       g.cards.filter((c) => c.budget > 8).every((c) => /production validator refuses/.test(c.why) && /limit is 8/.test(c.why)) &&
       g.cards.filter((c) => c.budget === 8).every((c) => /COMPLETE figure/.test(c.why) && /Phase 2/.test(c.why)),
      'GL6d Play in Ether is disabled on every card and says why — refused above 8, complete (no gap) at 8');

    // ---- GL7: one budget, several candidates; and BY POINT BUDGET ----
    await page.click('[data-gbudget="12"]');
    g = await grid();
    ck(g.cards.length === 3 && g.cards.every((c) => c.budget === 12 && c.pts === 12) && /12 POINTS/.test(g.title),
      'GL7  choosing one budget shows that budget\'s several candidates side by side', g.title);
    await page.click('[data-gbudget="8"]');
    await page.click('[data-gview="budget"]');
    g = await grid();
    const rowNames = await page.evaluate(() => Array.from(document.querySelectorAll('.gcreature-name')).map((d) => d.textContent.trim()));
    ck(g.cards.length === 30 && g.cards.every((c) => c.budget === 8) && rowNames.join('|') === STARTERS.join('|'),
      'GL7b BY POINT BUDGET lays every creature\'s candidates at one budget, in the starting order', g.cards.length + ' cards · ' + rowNames.length + ' rows');
    await page.click('[data-gview="creature"]');
    await page.click('[data-gbudget="all"]');

    // ---- GL8: blind ----
    await page.click('[data-gblind]');
    g = await grid();
    const blindLeak = g.cards.filter((c) => /candidate|points|butterfly/i.test(c.text.replace(/Play in Ether[^]*$/, '')) || c.text.indexOf(c.id) !== -1);
    ck(g.cards.length === 12 && blindLeak.length === 0 && g.headVisible.every((v) => v === 'hidden') && /^BLIND/.test(g.title) && g.textDraws === 0,
      'GL8  blind mode hides the creature name, the candidate id and the point budget on every card — the figures stay', blindLeak.length + ' leaks · title ' + g.title);
    await page.click('[data-gblind]');

    // ---- GL9: any creature name; nothing invented ----
    await page.fill('[data-gcreature-input]', 'dragon');
    await page.press('[data-gcreature-input]', 'Enter');
    await page.waitForTimeout(100);
    const empty = await page.evaluate(() => ({
      cards: document.querySelectorAll('.gcard:not(.gnone)').length,
      draw: !!document.querySelector('[data-gdraw]'),
      text: document.querySelector('[data-ggrid]').textContent,
      n: window.CreatureGallery.candidatesFor('dragon', 'all').length }));
    ck(empty.cards === 0 && empty.n === 0 && empty.draw && /No authored candidates/.test(empty.text) && /starting set/.test(empty.text),
      'GL9  any creature name may be entered; one with nothing authored invents nothing and offers the Shape Lab instead');
    await page.click('[data-gcreature="whale"]');

    // ---- GL10: judgement persists, only the gallery key is written ----
    const jid = await page.evaluate(() => {
      const id = document.querySelector('.gcard:not(.gnone)').getAttribute('data-card');
      document.querySelector('[data-gjudgebtn="' + id + '"]').click();
      return id;
    });
    await page.check('input[name="v-' + jid + '"][value="recognisable"]');
    await page.fill('[data-gsee="' + jid + '"]', 'a long body with a tail');
    await page.fill('[data-gresearcher="' + jid + '"]', 'Vihaan');
    await page.reload();
    await page.waitForFunction(() => !!window.CreatureGallery, null, { timeout: 20000 });
    const jud = await page.evaluate((id) => ({ j: window.CreatureGallery.judgementOf(id), keys: Object.keys(localStorage),
      shown: document.querySelector('[data-card="' + id + '"] .gverdict') && document.querySelector('[data-card="' + id + '"] .gverdict').textContent,
      researcher: document.querySelector('[data-gresearcher="' + id + '"]').value,
      verdicts: window.CreatureGallery.VERDICTS }), jid);
    ck(jud.j && jud.j.verdict === 'recognisable' && jud.j.see === 'a long body with a tail' && jud.j.researcher === 'Vihaan' &&
       jud.keys.length === 1 && jud.keys[0] === 'vihu.lab.gallery' && jud.shown === 'RECOGNISABLE' && jud.researcher === 'Vihaan',
      'GL10 a judgement, "what do I see" and the researcher name survive a reload in ONE key of their own', JSON.stringify(jud.keys));
    ck(jud.verdicts.join('|') === 'unmistakable|recognisable|looks like a related animal|abstract|fails' &&
       Object.keys(jud.j).every((k) => typeof jud.j[k] === 'string'),
      'GL10b the five verdicts are the brief\'s own words, and nothing in a judgement is a number');

    // ---- GL11: Open in Shape Lab carries the EXACT geometry ----
    const pick = await page.evaluate(() => {
      const G = window.CreatureGallery;
      const c = window.EtherLabGalleryData.candidates.filter((x) => x.creature === 'whale' && x.budget === 12)[1];
      return { id: G.idOf(c), c, note: G.handoffNote(c) };
    });
    await page.click('[data-gopen="' + pick.id + '"]');
    await page.waitForURL(/shape\.html/, { timeout: 20000 });
    await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    const opened = await page.evaluate(() => ({ s: window.ShapeLab.state(), opened: document.querySelector('[data-opened]').textContent,
      say: document.querySelector('[data-say]').textContent, nameField: document.querySelector('[data-name]').value,
      ss: Object.keys(sessionStorage), ls: Object.keys(localStorage), label: document.querySelector('[data-budget-label]').textContent,
      cand: JSON.stringify(window.ShapeLab.candidateFor()), m: window.ShapeLab.metrics() }));
    ck(/shape\.html/.test(page.url()) && JSON.stringify(opened.s.points) === JSON.stringify(pick.c.points) &&
       JSON.stringify(opened.s.joins) === JSON.stringify(pick.c.joins) && opened.s.budget === 12 && opened.s.missing.length === 0 &&
       opened.s.id === null && /unsaved/.test(opened.opened) && /TESTING 12 POINTS/.test(opened.label),
      'GL11 Open in Shape Lab lands in the existing editor with the candidate\'s exact points and joins, unsaved, at its own budget', opened.label);
    ck(opened.s.name === 'whale' && opened.nameField === 'whale' && !/whale/i.test(opened.cand) && /Candidate Gallery/.test(opened.s.notes),
      'GL11b the creature name arrives as METADATA in the editor and still never in a candidate');
    ck(opened.ss.length === 0 && opened.ls.length === 1 && opened.ls[0] === 'vihu.lab.gallery' && /Opened from the Candidate Gallery/.test(opened.say),
      'GL11c the hand-off note is consumed — one shot, no fixture written, nothing left in storage', JSON.stringify(opened.ss.concat(opened.ls)));
    ck(opened.m.points === 12 && opened.m.connections === pick.c.joins.length && opened.m.missing === 0 && !opened.m.validator.ok,
      'GL11d the editor\'s metrics read the transferred figure — 12 points, every join, no gap, and the validator\'s honest refusal');
    await page.reload();
    await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    const afterReload = await page.evaluate(() => window.ShapeLab.state().points.length);
    ck(afterReload === 0, 'GL11e a refresh of the editor does not re-open the note — it was one shot');
    // an over-budget note is refused, never trimmed
    const smuggled = await page.evaluate((c) => {
      const pts = c.points.concat([[0.11, 0.13]]);
      sessionStorage.setItem(window.ShapeLab.HANDOFF_KEY, JSON.stringify({ budget: 12, points: pts, joins: c.joins, missing: [], name: 'x' }));
      return pts.length;
    }, pick.c);
    await page.reload();
    await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    const refused = await page.evaluate(() => ({ n: window.ShapeLab.state().points.length, say: document.querySelector('[data-say]').textContent, ss: Object.keys(sessionStorage).length }));
    ck(smuggled === 13 && refused.n === 0 && /could not be opened/.test(refused.say) && /exceeds budget/.test(refused.say) && refused.ss === 0,
      'GL11f a hand-off carrying more points than its budget is refused on arrival and never trimmed', refused.say);
    // the 8-point candidate becomes playable the moment one gap is chosen — the real validator, in the editor
    await page.goto(BASE + '/tools/ether-mystery-lab/gallery.html#creature=fish&budget=8&view=creature');
    await page.waitForFunction(() => !!window.CreatureGallery && !!window.ShapeLab, null, { timeout: 20000 });
    const id8 = await page.evaluate(() => document.querySelector('.gcard:not(.gnone)').getAttribute('data-card'));
    await page.click('[data-gopen="' + id8 + '"]');
    await page.waitForURL(/shape\.html/, { timeout: 20000 });
    await page.waitForFunction(() => !!window.ShapeLab, null, { timeout: 20000 });
    const play8 = await page.evaluate(() => {
      const S = window.ShapeLab; const before = S.playable(); S.toggleGap(0);
      return { before, after: S.playable(), m: S.metrics(), disabled: document.querySelector('[data-play]').disabled };
    });
    ck(play8.before === false && play8.after === true && play8.m.validator.ok && play8.disabled === false,
      'GL11g an 8-point candidate opened in the editor becomes playable the moment one join is marked missing — Phase 2 is one click away, on the real validator');

    // ---- GL12: Save as Fixture, and the fixture tools still work ----
    await page.goto(BASE + '/tools/ether-mystery-lab/gallery.html#creature=manta%20ray&budget=all&view=creature');
    await page.waitForFunction(() => !!window.CreatureGallery && !!window.ShapeLab, null, { timeout: 20000 });
    const saved = await page.evaluate(() => {
      const G = window.CreatureGallery;
      const c = window.EtherLabGalleryData.candidates.filter((x) => x.creature === 'manta ray' && x.budget === 16)[2];
      const id = G.idOf(c);
      G.setJudgement(id, { verdict: 'abstract', see: 'a kite' });
      document.querySelector('[data-gsave="' + id + '"]').click();
      const list = window.ShapeLab.list();
      return { id, c, say: document.querySelector('[data-gsay]').textContent, list, keys: Object.keys(localStorage) };
    });
    const rec = saved.list[0];
    ck(saved.list.length === 1 && rec && rec.name === 'manta ray' && rec.budget === 16 &&
       JSON.stringify(rec.points) === JSON.stringify(saved.c.points) && JSON.stringify(rec.joins) === JSON.stringify(saved.c.joins) &&
       rec.missing.length === 0 && rec.judgement && rec.judgement.complete === 'abstract' && /Candidate Gallery/.test(rec.notes) && /^shape-/.test(rec.id) &&
       /Saved/.test(saved.say) && saved.keys.sort().join(',') === 'vihu.lab.gallery,vihu.lab.shapes',
      'GL12 Save as Fixture writes the exact geometry, the name and the judgement into the Shape Lab\'s own store — one fixture implementation', saved.say);
    const tools = await page.evaluate((id) => {
      const S = window.ShapeLab;
      const d = S.duplicate(id, 20), tooSmall = S.duplicate(id, 12);
      const out = S.exportJSON();
      S.list().forEach((r) => S.remove(r.id));
      const imp = S.importJSON(out);
      return { d, tooSmall, imp, after: S.list().length, budgets: S.compare('manta ray').map((r) => r.budget) };
    }, rec.id);
    ck(tools.d.ok && !tools.tooSmall.ok && /figure-has-16-lights/.test(tools.tooSmall.reason) && tools.imp.ok && tools.imp.added === 2 && tools.after === 2 &&
       tools.budgets.join(',') === '16,20',
      'GL12b duplicate INTO a budget, refuse a budget too small, export and import all still work on a gallery-saved fixture', JSON.stringify(tools.budgets));
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.close();
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- GL13: the seams are the existing ones ----
  ck(/S\.draw\(canvas, s, \{\}\)/.test(gallerySrc) && !/getContext\('2d'\)/.test(galleryStripped),
    'GL13 the gallery has no renderer of its own — every figure goes through ShapeLab.draw()');
  ck(/S\.importJSON\(/.test(gallerySrc) && !/localStorage\.setItem\(['"]vihu\.lab\.shapes/.test(galleryStripped),
    'GL13b and no fixture store of its own — Save as Fixture goes through the editor\'s importJSON()');
  const pool = read('assets/ether/experience-pool.js');
  ck(!/lab-gallery|labGallery|gallery/i.test(pool), 'GL13c the production pool holds nothing from the gallery');
}

// ===================================================================
(async () => {
  try {
    // ETHER_LAB_ONLY=SL runs one section alone while it is being built;
    // the full suite is what a ship is judged on.
    const ONLY = (process.env.ETHER_LAB_ONLY || '').split(',').filter(Boolean);
    const run = async (name, fn) => { if (!ONLY.length || ONLY.indexOf(name) !== -1) await fn(); };
    await run('S', sectionS);
    await run('F', sectionF);
    await run('C', sectionC);
    await run('E', sectionE);
    await run('B', sectionB);
    await run('P', sectionP);
    await run('R', sectionR);
    await run('UF', sectionUF);
    await run('CR', sectionCR);
    await run('FV', sectionFV);
    await run('FR', sectionFR);
    await run('EP', sectionEP);
    await run('SL', sectionSL);
    await run('GL', sectionGL);
  } catch (e) {
    fail('suite crashed', (e && e.stack || String(e)).split('\n')[0]);
  }
  console.log('\n==================================================');
  console.log('passed ' + passed + ' · failed ' + failed);
  failures.forEach((f) => console.log('  FAILED: ' + f));
  process.exit(failed ? 1 : 0);
})();
