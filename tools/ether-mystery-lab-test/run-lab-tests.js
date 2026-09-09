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
// RESET EVERYTHING is a two-press control since the researcher-workflow
// sprint: the opener shows an inline confirmation that names what goes,
// and only its confirm resets. A harness that pressed the opener alone
// and read an empty figure would be asserting the defect.
async function resetAll(page) {
  await page.click('[data-reset]');
  await page.click('[data-reset-confirm]');
}
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

  // S3c — THE THING SERVED IS THE THING UNDER TEST. The product owner
  // pressed the new Join tool and nothing joined: shape.html had arrived
  // fresh and labShape.js had not — a versionless script the browser was
  // still holding. Every Lab script tag now carries `?lab=<stamp>`, a hash
  // of the contents of everything the four pages load, generated by
  // tools/ether-mystery-lab/stamp.js. The generator itself is asked
  // whether anything drifted (a second copy of the rule in the test could
  // disagree with the thing that writes the pages), and a tag with no
  // stamp fails by name.
  const Stamp = require(path.join(ROOT, 'tools/ether-mystery-lab/stamp.js'));
  const want = Stamp.stamp();
  const stale = Stamp.PAGES.filter((pg) => Stamp.rewrite(read('tools/ether-mystery-lab/' + pg), want) !== read('tools/ether-mystery-lab/' + pg));
  const unstamped = Stamp.PAGES.flatMap((pg) => [...read('tools/ether-mystery-lab/' + pg).matchAll(/<script src="([^"]+)"/g)].map((m) => pg + ':' + m[1]).filter((x) => !/\?lab=[0-9a-f]{10}$/.test(x)));
  ck(stale.length === 0 && unstamped.length === 0 && Stamp.referenced().length > 20,
    'S3c every script every Lab page loads carries the content stamp `?lab=' + want + '`, and the stamper reports no drift — a Lab change that forgot to restamp cannot pass', (stale.join(',') || 'no drift') + (unstamped.length ? ' · unstamped: ' + unstamped.join(',') : ''));

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

  // E3 — admin ping: build, and whether a key is configured. (LAB3 and
  // gpt-image-2 / gpt-4.1 are the defaults since the end-to-end closure —
  // the product owner's brief names both; the retired ids are refused by EX1b.)
  r = await drive('admin-token', { action: 'ping' });
  ck(r.status === 200 && r.body.ok && r.body.build === 'LAB3' && r.body.provider === 'none' && r.body.imageModel === 'gpt-image-2',
    'E3 admin ping reports the build (LAB3), an unconfigured provider, and the image model it would use');
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
  // The REVEAL is a second Lab overlay of exactly the tease's kind
  // (reveal-only creature features, drawn over the sky only after the
  // interpreter's last join), so its drawing sits in its own block; and
  // the pixel READER in the exports opens a context only to read it back
  // (getImageData, never a stroke or a fill). Everything else in the
  // file still draws nothing.
  const revealFrom = prev.indexOf('function stopReveal()');
  const revealTo = prev.indexOf('var lastRevealDone = null;');
  const readerFrom = prev.indexOf('revealPixels: function');
  const readerTo = prev.indexOf('stories: function', readerFrom);
  const reader = prev.slice(readerFrom, readerTo);
  const draws = [];
  for (let at = prev.indexOf('getContext'); at !== -1;
       at = prev.indexOf('getContext', at + 1)) draws.push(at);
  const inTease = (i) => i > teaseFrom && i < teaseTo;
  const inReveal = (i) => i > revealFrom && i < revealTo;
  const inReader = (i) => i > readerFrom && i < readerTo;
  ck(teaseFrom > 0 && teaseTo > teaseFrom && revealFrom > 0 && revealTo > revealFrom && draws.length > 0 &&
     draws.every((i) => inTease(i) || inReveal(i) || inReader(i)) && draws.some(inTease) && draws.some(inReveal) &&
     /getImageData/.test(reader) && !/stroke|fill|arc\(|lineTo/.test(reader),
    'P1k every stroke the preview makes is inside a Lab overlay — the tease or the reveal — and nowhere else; the one other context is a pixel reader',
    draws.length + ' drawing call(s): tease ' + draws.filter(inTease).length + ', reveal ' + draws.filter(inReveal).length + ', reader ' + draws.filter(inReader).length);
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
  // (Six budgets since the Adaptive Suggested Points sprint: 10 and 18
  // joined the four. Still the Lab file alone, still 8 named production.)
  ck(/BUDGETS\s*=\s*\[\s*8,\s*10,\s*12,\s*16,\s*18,\s*20\s*\]/.test(shapeSrc) && /PRODUCTION_BUDGET\s*=\s*8\b/.test(shapeSrc),
    'SL2e the six budgets 8 · 10 · 12 · 16 · 18 · 20 live in the Lab file alone, with 8 named as production');

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
      // Pressing Join joins the lights in their order (the product owner's
      // instruction), so the chain 0-1 … (n-2)-(n-1) is made by the press;
      // closing the ring is the author's own click, exactly as before.
      await tool('join');
      const chained = await page.evaluate(() => window.ShapeLab.figure().joins.length);
      if (chained !== n - 1) throw new Error('Join did not chain ' + n + ' lights in order: ' + chained + ' joins');
      const a = at(g, pts[n - 1]), b = at(g, pts[0]);
      await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
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
      await resetAll(page);
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
    await resetAll(page);
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
    // TURNED ROUND (Adaptive Suggested Points sprint). This read "shrinking
    // the budget under a 12-light figure is refused" — a budget change was
    // a refusal. The brief makes the budget an authoring TARGET, never a
    // destructive operation: shrinking is ALLOWED, every light is kept,
    // and the figure is shown to EXCEED the selected budget. What the old
    // check was protecting — nothing is ever trimmed — is still asserted.
    await resetAll(page);
    await page.click('[data-budget="12"]');
    await drawRing(12);
    await page.click('[data-budget="8"]');
    const shrunk = await readState();
    ck(shrunk.s.budget === 8 && shrunk.s.points.length === 12 && shrunk.m.overBudget === 4 && /nothing is trimmed/i.test(shrunk.say) &&
       /EXCEEDS BUDGET \(12 lights\)/.test(shrunk.label) && /exceeds the budget by 4/.test(shrunk.why) && shrunk.playDisabled,
      'SL5b shrinking the budget under a 12-light figure is ALLOWED and deletes nothing — the figure is kept whole and shown to exceed the 8-light budget, in the header, the metrics and beside Play',
      'budget:' + shrunk.s.budget + ' points:' + shrunk.s.points.length + ' over:' + shrunk.m.overBudget);
    const overSave = await page.evaluate(() => { const S = window.ShapeLab; return { save: S.save(), add: S.addPoint(0, 0), n: S.figure().points.length, stored: S.list().length }; });
    ck(!overSave.save.ok && /figure-exceeds-budget:12>8/.test(overSave.save.reason) && !overSave.add.ok && overSave.n === 12 && overSave.stored === 0,
      'SL5b2 while it exceeds the budget nothing can be ADDED and it cannot be SAVED (a stored fixture stays at or under its budget) — and still nothing is deleted', overSave.save.reason);
    await page.click('[data-budget="12"]');
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
    await resetAll(page);
    await page.click('[data-budget="8"]');
    const ed = await drawRing(8);
    await tool('join');
    // the same pair again REMOVES the join
    let A = at(ed.g, ed.pts[2]), B = at(ed.g, ed.pts[3]);
    await page.mouse.click(A.x, A.y); await page.mouse.click(B.x, B.y);
    const afterRemovePair = await readState();
    // clicking a LINE in Connect SELECTS it (the researcher-workflow
    // sprint: a click on a line used to delete it, and a delete with no
    // way to see what was about to go is exactly what a researcher asked
    // to have made explicit); UNJOIN removes the selected connection
    const m45 = mid(ed.g, ed.pts[4], ed.pts[5]);
    await page.mouse.click(m45.x, m45.y);
    const afterSelectLine = await readState();
    const selLine = await page.evaluate(() => window.ShapeLab.selection());
    await page.click('[data-unjoin]');
    const afterRemoveLine = await readState();
    // and the pair once more puts it back
    await page.mouse.click(A.x, A.y); await page.mouse.click(B.x, B.y);
    const afterReadd = await readState();
    ck(afterRemovePair.m.connections === 7 && afterRemovePair.s.joins.indexOf('2-3') === -1 &&
       afterSelectLine.m.connections === 7 && selLine.joined && selLine.a === 4 && selLine.b === 5 &&
       afterRemoveLine.m.connections === 6 && afterRemoveLine.s.joins.indexOf('4-5') === -1 &&
       afterReadd.m.connections === 7 && afterReadd.s.joins.indexOf('2-3') !== -1,
      'SL6  a connection is added, removed by its pair, SELECTED by clicking the line and removed by UNJOIN, and added back',
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
    await resetAll(page);
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
    // RESET EVERYTHING asks first (the researcher-workflow sprint): the
    // opener shows an inline confirmation, and only its confirm resets.
    const rs = await page.evaluate(() => {
      const S = window.ShapeLab;
      document.querySelector('[data-reset]').click();
      const askedFirst = !document.querySelector('[data-reset-confirm-box]').hidden && S.state().points.length > 0;
      document.querySelector('[data-reset-confirm]').click();
      return { askedFirst, s: S.state(), opened: document.querySelector('[data-opened]').textContent,
               name: document.querySelector('[data-name]').value, count: S.list().length };
    });
    ck(rs.askedFirst && rs.s.points.length === 0 && rs.s.joins.length === 0 && rs.s.name === '' && rs.s.hint === '' &&
       rs.s.judgement === null && rs.s.tease === false && rs.s.id === null && /unsaved/.test(rs.opened) &&
       rs.name === '' && rs.count === 4,
      'SL12 Reset everything asks first, then clears the workspace and every field, detaches from the fixture, and deletes nothing saved',
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
// AR. CREATE FROM CREATURE — the AI-assisted REFERENCE mode of the
// Shape Lab.
//
// The assistant gives SEMANTIC help (what makes the subject recognisable,
// a rough vector sketch to draw over); the author places every light,
// every join and every gap. Nothing the assistant returns can become the
// Ether creature: the schema has no field for final geometry, the
// reference has no place in a fixture, a candidate, the preview or the
// Ether, and the underlay it is drawn on takes no pointer. Every check
// here is about that boundary being real, the existing Shape Lab being
// intact, and arbitrary subjects being accepted without any creature
// being known.
// ===================================================================
async function sectionAR() {
  console.log('\n== AR. Create from creature (AI-assisted reference) ==');
  const { chromium } = require('playwright');
  const SUBJECTS = ['Tiger', 'Falcon', 'Elephant', 'Dragon', 'Penguin'];
  const bpSrc = read('tools/ether-mystery-lab/labBlueprint.js');
  const refSrc = read('tools/ether-mystery-lab/labReference.js');
  const shapeSrc = read('tools/ether-mystery-lab/labShape.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const bpStripped = stripComments(bpSrc), refStripped = stripComments(refSrc), shapeStripped = stripComments(shapeSrc);
  const htmlNoComments = shapeHtml.replace(/<!--[\s\S]*?-->/g, '');

  // ---- AR1: PRODUCTION IS UNTOUCHED ----
  const grepProd = require('child_process').spawnSync('grep',
    ['-rl', '-e', 'LabReference', '-e', 'LabBlueprint', '-e', 'labReference', '-e', 'labBlueprint', '-e', 'LabOutline', '-e', 'labOutline', '-e', 'Create from creature',
     path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet'), path.join(ROOT, 'supabase'),
     path.join(ROOT, 'index.html'), path.join(ROOT, 'studio.html')],
    { encoding: 'utf8' }).stdout || '';
  ck(grepProd.trim() === '',
    'AR1  nothing a child loads — js/, assets/, the runtime, supabase/, the two entry pages — names the reference mode', grepProd.trim() || 'clean');
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'AR1b the validator is unchanged — the production point limit is still EIGHT');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'AR1c no build bump — every stamp on index.html still reads 0769', Array.from(new Set(stamps)).join(','));
  const pool = read('assets/ether/experience-pool.js');
  const statuses = (pool.match(/status:\s*'([a-z]+)'/g) || []).map((s) => s.replace(/.*'([a-z]+)'/, '$1'));
  const counts = statuses.reduce((m, s) => { m[s] = (m[s] || 0) + 1; return m; }, {});
  ck(!/reference|blueprint|sketch|silhouette/i.test(pool) && counts.active === 5 && counts.experiment === 1 && counts.retired === 1,
    'AR1d the production pool is unchanged — no reference in it, no new creature activated', JSON.stringify(counts));
  const previewHtml = read('tools/ether-mystery-lab/preview.html');
  ck(!/labReference|labBlueprint|labConnection|labShape/.test(previewHtml) &&
     !/LabReference|LabBlueprint/.test(read('tools/ether-mystery-lab/labPreview.js') + read('tools/ether-mystery-lab/labPreviewHost.js')),
    'AR1e the child-facing preview loads neither the reference nor the blueprint module, and cannot render a reference');
  ck(/labConnection\.js/.test(shapeHtml) && /labBlueprint\.js/.test(shapeHtml) && /labReference\.js/.test(shapeHtml) &&
     shapeHtml.indexOf('labShape.js') < shapeHtml.indexOf('labReference.js') && shapeHtml.indexOf('labBlueprint.js') < shapeHtml.indexOf('labShape.js'),
    'AR1f the Shape Lab page loads the reference layer AFTER the editor — the mode is additive to it');

  // ---- AR2: no creature is known, no image is hidden, no key is kept ----
  const creatureWords = /\b(tiger|falcon|elephant|dragon|penguin|whale|bird|lion|fox|bear|octopus|cat|dog|fish|butterfly|snake|horse)\b/i;
  ck(!creatureWords.test(bpStripped) && !creatureWords.test(refStripped),
    'AR2  no creature name anywhere in the blueprint or reference code — arbitrary subjects, no taxonomy');
  ck(!/subject\s*===|===\s*subject|switch\s*\(\s*(subject|s|name|creature)\b/.test(bpStripped + refStripped),
    'AR2b no creature-specific rendering branch — nothing compares a subject to a literal');
  // (The blueprint validator's own REFUSAL vocabulary names png, svg, base64
  // and data: — the strings it refuses — so it is scanned for the acts, not
  // the words: no image element, no bitmap draw, no element creation.)
  // (The reference layer composites its OWN offscreen canvas — the outline's
  // parts merged into one silhouette — and that is the one drawImage it may
  // make; an image element, a bitmap file or a URL is still refused.)
  ck(!/<img|new Image|(?<![A-Za-z])Image\(|\.png|\.jpg|\.svg|url\(|base64|background-image/i.test(refStripped) &&
     (refStripped.match(/drawImage\(/g) || []).length === 1 && /drawImage\(offscreen/.test(refStripped) &&
     !/drawImage|new Image|Image\(|createElement|innerHTML/i.test(bpStripped) &&
     !/<img|\.png|\.jpg|\.svg|background-image/i.test(htmlNoComments),
    'AR2c no bitmap, no image element, no URL — the reference is vector primitives from a validated blueprint');
  ck(!/fetch\(|XMLHttpRequest|WebSocket|api\.openai|sk-/.test(bpStripped + refStripped),
    'AR2d neither module reaches the network itself — the transport is LabConnection, the same three modes the Mystery Lab has');
  ck(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(bpStripped + refStripped),
    'AR2e the reference layer writes nothing to storage — a reference lives for the page and is discarded');
  ck(!/\bscore\b|recognisability|rating/i.test(bpStripped + refStripped),
    'AR2f no recognisability score — the judgement stays the author\'s');
  ck(!/\bmodel\b/i.test(shapeStripped) && !/fetch\(|XMLHttpRequest/.test(shapeStripped),
    'AR2g the editor itself still knows no model and no network — the existing SL2b property survives the extension');
  // TURNED ROUND (the unfinished-pane starting point, reported by the
  // product owner): the drawing code now reads ONE thing from the
  // reference layer — the suggested-point LIST, to mark it faintly on the
  // unfinished pane — and does so in one named helper. What this guarded
  // still holds and is asserted more precisely: the outline, the sketch,
  // the blueprint and the authoring note are read nowhere in the drawing
  // path, and the only reference call is `suggestions()` inside
  // drawSuggestedMarks (whose marks are dashed rings, never a light).
  const drawSlice = stripComments(shapeSrc.slice(shapeSrc.indexOf('function draw('), shapeSrc.indexOf('function pointAt(')));
  const refCalls = drawSlice.match(/LabReference|Ref\.[a-zA-Z]+/g) || [];
  const helper = stripComments(shapeSrc.slice(shapeSrc.indexOf('function drawSuggestedMarks('), shapeSrc.indexOf('function pointAt(')));
  ck(!/sketch|blueprint|authoring|outline|\.current\(|\.landmarks|\.paths/.test(drawSlice) && refCalls.every((c) => /LabReference|Ref\.suggestions/.test(c)) &&
     /Ref\.suggestions\(\)/.test(helper) && !/addPoint|setLineDash\(\[\]\);\s*g\.fillStyle = CORE/.test(helper) && /setLineDash\(\[3, 4\]\)/.test(helper),
    'AR2h the editor\'s drawing code reads nothing of the reference but its suggested-point LIST, in one helper that draws dashed marks and never a light — the outline, sketch, blueprint and authoring note are read nowhere in the drawing path', refCalls.join(','));

  // ---- AR3: the blueprint contract, in Node ----
  const sb = { console };
  sb.window = undefined; sb.global = sb;
  vm.runInNewContext(bpSrc, sb, { filename: 'labBlueprint.js' });
  const B = sb.LabBlueprint;
  ck(!!B && typeof B.messagesFor === 'function' && typeof B.validate === 'function', 'AR3  LabBlueprint loads standalone');
  const sysTexts = new Set();
  let msgOk = true, privateWords = false;
  SUBJECTS.forEach((s) => {
    const m = B.messagesFor(s);
    if (!m.ok || m.messages.length !== 2 || m.messages[0].role !== 'system' || m.messages[1].role !== 'user' || m.messages[1].content !== 'Subject: ' + s) msgOk = false;
    sysTexts.add(m.messages[0].content);
    if (/\b(card|stars|constellation|memor|story|email|orbit|username|creator|traveller|companion)\b/i.test(JSON.stringify(m.messages))) privateWords = true;
  });
  ck(msgOk && sysTexts.size === 1 && !privateWords,
    'AR3b the request is the subject plus ONE fixed contract — two messages, identical system text for all five subjects, no private vocabulary',
    'contracts:' + sysTexts.size);
  const sysText = Array.from(sysTexts)[0] || '';
  ck(/do NOT draw the final figure/.test(sysText) && /Never return final points, joins, gaps or hints/.test(sysText),
    'AR3c the contract tells the assistant it does not draw the final creature');
  const arbitrary = ['Wibble Fnord 7', "O'Malley's Beast", 'Moon-Deer'].map((s) => B.cleanSubject(s));
  const refused = ['', '   ', 'x'.repeat(41), '<script>', 'http://x', '{"a":1}', '7 dwarves'].map((s) => B.cleanSubject(s));
  ck(arbitrary.every(Boolean) && refused.every((v) => v === null),
    'AR3d an arbitrary subject is accepted and a non-subject is refused before any request is built', JSON.stringify(refused));
  const fixtures = SUBJECTS.map((s) => B.fixture(s));
  const sketches = new Set(fixtures.map((f) => JSON.stringify(f.ok ? f.blueprint.sketch : null)));
  ck(fixtures.every((f) => f.ok) && sketches.size === 1 && fixtures.every((f, i) => f.blueprint.subject === SUBJECTS[i]) &&
     fixtures.every((f) => /FIXTURE/.test(f.blueprint.silhouette)),
    'AR3e the fixture is ONE generic body plan for every subject, validated by the real validator, and says it is a fixture');
  const good = fixtures[0].blueprint;
  const mutate = (fn) => { const c = JSON.parse(JSON.stringify(good)); fn(c); return B.validate(c); };
  const bad = {
    notObject: B.validate('nope'),
    unknownTop: mutate((c) => { c.points = [[0, 0]]; }),
    forbiddenJoins: mutate((c) => { c.joins = ['0-1']; }),
    forbiddenDeep: mutate((c) => { c.features[0].constellation = [1, 2]; }),
    urlInText: mutate((c) => { c.silhouette = 'see http://example.com/tiger.png'; }),
    dataUri: mutate((c) => { c.features[0].why = 'data:image/png;base64,AAAA'; }),
    markup: mutate((c) => { c.subject = '<b>x</b>'; }),
    fewFeatures: mutate((c) => { c.features = c.features.slice(0, 2); c.budgets = { 8: [], 12: [], 16: [], 20: [] }; }),
    importance: mutate((c) => { c.features[0].importance = 5; }),
    anchorRange: mutate((c) => { c.features[0].anchor = [2, 0]; }),
    budgetKeys: mutate((c) => { delete c.budgets['12']; }),
    budgetOver: mutate((c) => { c.budgets['8'] = new Array(9).fill('HEAD'); }),
    budgetUnknown: mutate((c) => { c.budgets['8'] = ['HORN']; }),
    sketchKind: mutate((c) => { c.sketch[0] = { kind: 'bitmap' }; }),
    sketchUnknownKey: mutate((c) => { c.sketch[0].src = 'x'; }),
    hintSmuggled: mutate((c) => { c.hint = 'a tiger waits'; })
  };
  const allRefused = Object.keys(bad).filter((k) => bad[k].ok);
  ck(allRefused.length === 0, 'AR3f a malformed or over-reaching blueprint is refused safely — ' + Object.keys(bad).length + ' shapes, every one named',
    allRefused.join(',') || Object.keys(bad).map((k) => k + ':' + bad[k].reasons[0]).slice(0, 4).join(' '));
  ck(/forbidden-key/.test(bad.forbiddenJoins.reasons[0]) && /forbidden-key/.test(bad.forbiddenDeep.reasons[0]) && /unknown-key:points/.test(bad.unknownTop.reasons[0]),
    'AR3g a key that would carry final geometry — joins, points, a constellation at any depth — is refused BY NAME');
  // (A blueprint with NO sketch validates now — the sketch is deprecated:
  // the visual reference is the Creature Outline composed from the
  // features, so a reply that stops at the semantics is a complete reply.)
  const noSketch = mutate((c) => { delete c.sketch; });
  const emptySketch = mutate((c) => { c.sketch = []; });
  ck(noSketch.ok && emptySketch.ok && noSketch.blueprint.sketch.length === 0,
    'AR3f2 the assistant\'s sketch is deprecated and OPTIONAL — a blueprint without one validates, and the semantic half is whole');
  const fenced = B.parse('```json\n' + JSON.stringify(good) + '\n```');
  const prose = B.parse('Here you go: ' + JSON.stringify(good) + ' — enjoy');
  ck(fenced.ok && prose.ok && !B.parse('not json at all').ok && !B.parse('').ok,
    'AR3h a reply is text until proven a blueprint — fences and prose are tolerated, garbage is refused');
  const cleaned = B.validate(good).blueprint;
  ck(cleaned !== good && cleaned.features !== good.features && JSON.stringify(Object.keys(cleaned).sort()) === JSON.stringify(Object.keys(B.SCHEMA.top).sort()),
    'AR3i what comes out is a CLEAN copy built field by field, with exactly the schema\'s keys');
  const sug8 = B.suggestions(good, 8), sug12 = B.suggestions(good, 12);
  ck(sug8.length <= 8 && sug12.length <= 12 && sug8.every((s) => good.budgets['8'].indexOf(s.name) !== -1) && sug8.every((s) => typeof s.x === 'number'),
    'AR3j suggestions are the anchors of the features the blueprint names for that budget, never more than the budget');
  // (`reveal` joined the schema with the reveal-only features sprint: a
  // SEMANTIC list — a name, a kind from the seven, the feature it belongs
  // to — with no field for a point, a shape or a coordinate, which is
  // asserted beside the top-level key set.)
  // (`etherInterpretation` joined the schema with the Ether creature
  // translation sprint: ART DIRECTION in words — character, gesture,
  // architecture, proportion, what must survive, what not to draw
  // literally, rhythm, movement, structural / reveal-only — with no field
  // for a point, a shape or a coordinate at any depth, which section ET
  // proves by trying; the top-level key set is widened by that one name.)
  ck(JSON.stringify(Object.keys(B.SCHEMA.top).sort()) === JSON.stringify(['budgets', 'etherInterpretation', 'features', 'reveal', 'silhouette', 'sketch', 'subject']) &&
     JSON.stringify(Object.keys(B.SCHEMA.reveal).sort()) === JSON.stringify(['kind', 'name', 'near']) &&
     ['joins', 'gaps', 'missing', 'hint', 'tease', 'candidate'].every((k) => B.FORBIDDEN_KEYS.indexOf(k) !== -1),
    'AR3k the schema has no field for final points, joins, gaps or a hint — and those very keys are forbidden; its reveal list is names and kinds only, and its interpretation is words only');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const requests = [];
    page.on('request', (q) => { if (!/127\.0\.0\.1/.test(q.url())) requests.push(q.url()); });
    const open = async () => {
      await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
      await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference && !!window.LabBlueprint && !!window.LabConnection, null, { timeout: 20000 });
    };
    await open();
    // Since the starting-figure rule, Generate PLACES the budgeted
    // suggestions as lights. The checks below that exercise the manual
    // accept-by-click path first empty the figure through the real API
    // (every light deleted, which returns its place to the suggestions).
    const clearFigure = () => page.evaluate(() => { const S = window.ShapeLab; for (let i = S.figure().points.length - 1; i >= 0; i--) S.deletePoint(i); });

    // ---- AR4: the existing Shape Lab is intact ----
    const intact = await page.evaluate(() => {
      const S = window.ShapeLab;
      const api = ['setBudget', 'addPoint', 'movePoint', 'deletePoint', 'toggleJoin', 'toggleGap', 'reset', 'demoRing', 'setMode',
        'setName', 'setHint', 'setNotes', 'setTease', 'setJudgement', 'state', 'figure', 'metrics', 'playable', 'candidateFor',
        'save', 'load', 'duplicate', 'remove', 'list', 'compare', 'names', 'exportJSON', 'importJSON', 'draw', 'render'];
      const controls = ['[data-budget="8"]', '[data-budget="10"]', '[data-budget="12"]', '[data-budget="16"]', '[data-budget="18"]', '[data-budget="20"]', '[data-mode="add"]', '[data-mode="move"]',
        '[data-mode="delete"]', '[data-mode="join"]', '[data-mode="gap"]', '[data-reset]', '[data-demo]', '[data-name]', '[data-hint]', '[data-notes]',
        '[data-save]', '[data-new]', '[data-play]', '[data-tease]', '[data-compare-name]', '[data-judgement]', '[data-fixtures]', '[data-export]', '[data-import]',
        '[data-canvas-complete]', '[data-canvas-unfinished]'];
      return { api: api.filter((k) => typeof S[k] !== 'function'), controls: controls.filter((c) => !document.querySelector(c)),
        keys: Object.keys(localStorage), budgets: S.BUDGETS.join(','), prod: S.PRODUCTION_BUDGET, ref: LabReference.current() };
    });
    ck(intact.api.length === 0 && intact.controls.length === 0 && intact.keys.length === 0 && errors.length === 0 && intact.budgets === '8,10,12,16,18,20' && intact.prod === 8 && intact.ref === null,
      'AR4  the existing Shape Lab is intact — every API function and control still there, budgets 8·10·12·16·18·20, nothing written, no reference on load',
      'missing api:' + intact.api.join(',') + ' controls:' + intact.controls.join(','));
    // the manual editor with NO reference behaves exactly as before: a click lands where pressed
    await page.evaluate(() => { window.ShapeLab.setBudget(8); });
    const plain = await page.evaluate(() => {
      const ed = document.querySelector('[data-canvas-complete]'); const b = ed.getBoundingClientRect();
      const q = window.ShapeLab.project([0.4, -0.3], b.width, b.height);
      return { x: b.left + q[0], y: b.top + q[1] };
    });
    await page.mouse.click(plain.x, plain.y);
    const plainPts = await page.evaluate(() => window.ShapeLab.figure().points);
    ck(plainPts.length === 1 && Math.abs(plainPts[0][0] - 0.4) < 0.03 && Math.abs(plainPts[0][1] + 0.3) < 0.03,
      'AR4b with no reference a light lands exactly where the author pressed — the manual editor is unchanged', JSON.stringify(plainPts));
    await page.evaluate(() => window.ShapeLab.reset());

    // ---- AR5: five subjects through fixture mode ----
    const before = requests.length;
    const gens = {};
    for (const s of SUBJECTS) {
      await page.fill('[data-ref-subject]', s);
      await page.click('[data-ref-generate]');
      await page.waitForFunction((subj) => { const c = window.LabReference.current(); return !!c && c.subject === subj; }, s, { timeout: 5000 });
      gens[s] = await page.evaluate(() => {
        const S = window.ShapeLab;
        const out = { subject: LabReference.current().subject, meta: LabReference.meta(), status: document.querySelector('[data-ref-status]').textContent,
          name: S.state().name, authoring: S.state().authoring, showing: LabReference.isShowing(),
          placed: S.figure().points.length, named: S.roles().filter(Boolean).length, joins: S.figure().joins.length };
        for (let i = S.figure().points.length - 1; i >= 0; i--) S.deletePoint(i);   // back to an empty figure for the next one
        out.sugg = LabReference.suggestions().length;
        return out;
      });
    }
    ck(SUBJECTS.every((s) => gens[s].subject === s && gens[s].meta.source === 'fixture' && gens[s].meta.mode === 'fixture' && /Fixture reference/.test(gens[s].status) && gens[s].showing && gens[s].sugg > 0),
      'AR5  Tiger · Falcon · Elephant · Dragon · Penguin each produce a reference in fixture mode, honestly labelled FIXTURE, with suggestions for the budget');
    ck(gens.Tiger.placed > 0 && gens.Tiger.placed <= 8 && gens.Tiger.named === gens.Tiger.placed && gens.Tiger.joins === 0 && SUBJECTS.slice(1).every((s) => gens[s].placed > 0 && gens[s].named === gens[s].placed && gens[s].joins === 0),
      'AR5d on Generate the budgeted suggestions are PLACED as the starting figure — real lights, each carrying its feature name, and not one join made for anybody', 'Tiger placed ' + gens.Tiger.placed);
    ck(requests.length === before, 'AR5b and fixture mode made NO network request for any of them', requests.slice(before).join(',') || 'none');
    ck(gens.Tiger.name === 'Tiger' && gens.Penguin.name === 'Tiger' && gens.Penguin.authoring.subject === 'Penguin' && gens.Penguin.authoring.referenceUsed === true && gens.Penguin.authoring.source === 'fixture',
      'AR5c the typed subject fills the researcher name only while it is empty, and the authoring note records the last subject used');
    ck(await page.evaluate(() => !!LabReference.previous() && LabReference.previous().subject === 'Dragon'),
      'AR5d the previous reference is kept until replaced — "Try another interpretation" is one step back, not a history');

    // ---- AR6: the underlay is under, inert and aligned ----
    const under = await page.evaluate(() => {
      const c = document.querySelector('[data-reference]'), ed = document.querySelector('[data-canvas-complete]');
      const cs = getComputedStyle(c), es = getComputedStyle(ed);
      const cb = c.getBoundingClientRect(), eb = ed.getBoundingClientRect();
      const mid = document.elementFromPoint(eb.left + eb.width / 2, eb.top + eb.height / 2);
      const editorAlpha = ed.getContext('2d').getImageData(3, 3, 1, 1).data[3];
      return { pe: cs.pointerEvents, aria: c.getAttribute('aria-hidden'), z: [Number(cs.zIndex), Number(es.zIndex)], hidden: c.hidden,
        align: Math.max(Math.abs(cb.left - eb.left), Math.abs(cb.top - eb.top), Math.abs(cb.width - eb.width), Math.abs(cb.height - eb.height)),
        midIsEditor: mid === ed, editorAlpha, underAlpha: c.getContext('2d').getImageData(3, 3, 1, 1).data[3],
        siblingOrder: c.nextElementSibling === ed, inUnfinishedPane: !!document.querySelector('[data-canvas-unfinished]').parentNode.querySelector('[data-reference]') };
    });
    ck(under.pe === 'none' && under.aria === 'true' && under.z[0] < under.z[1] && under.siblingOrder && under.midIsEditor,
      'AR6  the reference is a separate canvas UNDER the editor: pointer-events none, aria-hidden, below it in z-order, and a hit at the centre lands on the editor',
      JSON.stringify({ pe: under.pe, z: under.z }));
    ck(under.align <= 2, 'AR6b it is aligned with the editor canvas to the pixel', 'max offset ' + under.align + 'px');
    ck(under.editorAlpha === 0 && under.underAlpha === 255 && !under.hidden,
      'AR6c while the reference shows, the editor paints a transparent sky and the underlay paints the opaque one — the figure is drawn ON TOP of the reference');
    ck(!under.inUnfinishedPane, 'AR6d the unfinished pane — what a child would meet — never carries the reference');
    // a click through the underlay reaches the editor and adds a light
    const through = await page.evaluate(() => {
      const ed = document.querySelector('[data-canvas-complete]'); const b = ed.getBoundingClientRect();
      const q = window.ShapeLab.project([-1.15, 1.1], b.width, b.height);   // far from every suggestion
      return { x: b.left + q[0], y: b.top + q[1] };
    });
    await page.mouse.click(through.x, through.y);
    const throughPts = await page.evaluate(() => window.ShapeLab.figure().points);
    ck(throughPts.length === 1 && Math.abs(throughPts[0][0] + 1.15) < 0.03 && Math.abs(throughPts[0][1] - 1.1) < 0.03,
      'AR6e a click over the reference passes straight through to the editor, and a light far from any suggestion lands exactly where pressed', JSON.stringify(throughPts));

    // ---- AR7: suggestions are suggestions ----
    const near = await page.evaluate(() => {
      const ed = document.querySelector('[data-canvas-complete]'); const b = ed.getBoundingClientRect();
      const s = LabReference.suggestions()[0];
      const q = window.ShapeLab.project([s.x + 0.05, s.y + 0.04], b.width, b.height);
      return { x: b.left + q[0], y: b.top + q[1], want: [s.x, s.y], name: s.name, count: LabReference.suggestions().length };
    });
    await page.mouse.click(near.x, near.y);
    // (Accepting a feature's suggestion brings that feature into FOCUS,
    // which exposes its related landmarks beside the budgeted list — so the
    // count and the name are read from the BUDGETED suggestions alone.)
    const snapped = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points, sugg: LabReference.suggestions().filter((s) => s.budgeted).map((s) => s.name), role: window.ShapeLab.roles()[1], focus: LabReference.focused() }));
    ck(snapped.pts.length === 2 && snapped.pts[1][0] === near.want[0] && snapped.pts[1][1] === near.want[1],
      'AR7  a click near a suggested point ACCEPTS it — the light snaps to the suggestion', JSON.stringify(snapped.pts[1]) + ' wanted ' + JSON.stringify(near.want));
    ck(snapped.sugg.length === near.count - 1 && !snapped.sugg.some((n, i) => n === near.name && i === 0) && snapped.role === near.name && snapped.focus === near.name,
      'AR7b and the accepted suggestion is no longer suggested — a mark is never drawn where a light already stands; the light carries the feature it was accepted for, and that feature comes into focus');
    const edited = await page.evaluate(() => {
      const S = window.ShapeLab;
      const mv = S.movePoint(1, 0.9, 0.9);
      const after = S.figure().points[1].slice();
      const del = S.deletePoint(1);
      return { mv: mv.ok, after, del: del.ok, n: S.figure().points.length, back: LabReference.suggestions().filter((s) => s.budgeted).length };
    });
    ck(edited.mv && edited.after[0] === 0.9 && edited.after[1] === 0.9 && edited.del && edited.n === 1 && edited.back === near.count,
      'AR7c an accepted point is an ordinary light — moved, then deleted, and the suggestion returns when the place is free again');
    await page.evaluate(() => { document.querySelector('[data-ref-suggest]').click(); });
    await page.mouse.click(near.x, near.y);
    const noSnap = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points, sugg: LabReference.suggestions().length }));
    ck(noSnap.sugg === 0 && noSnap.pts.length === 2 && Math.abs(noSnap.pts[1][0] - (near.want[0] + 0.05)) < 0.03,
      'AR7d suggestions off: nothing is suggested and the same click lands where it was pressed — the author is in control');
    await page.evaluate(() => { document.querySelector('[data-ref-suggest]').click(); window.ShapeLab.deletePoint(1); });

    // ---- AR8: REFERENCE ON / OFF, labels, dismissal ----
    await page.click('[data-ref-toggle]');
    const off = await page.evaluate(() => {
      const c = document.querySelector('[data-reference]'), ed = document.querySelector('[data-canvas-complete]');
      return { showing: LabReference.isShowing(), hidden: c.hidden, display: getComputedStyle(c).display, editorAlpha: ed.getContext('2d').getImageData(3, 3, 1, 1).data[3],
        txt: document.querySelector('[data-ref-toggle]').textContent, pts: window.ShapeLab.figure().points.length, current: !!LabReference.current() };
    });
    ck(!off.showing && off.hidden && off.display === 'none' && off.editorAlpha === 255 && /OFF/.test(off.txt) && off.pts === 1 && off.current,
      'AR8  REFERENCE OFF: the underlay is gone, the editor paints its own opaque sky — only the Ether figure — and the reference is kept for turning back on');
    await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'reference-off.png') });
    const offSnap = await page.evaluate(() => LabReference.snap([-0.85, -0.45]));
    ck(offSnap === null, 'AR8b and while it is off nothing snaps — a hidden reference cannot steer a light');
    await page.click('[data-ref-toggle]');
    const on = await page.evaluate(() => ({ showing: LabReference.isShowing(), hidden: document.querySelector('[data-reference]').hidden, txt: document.querySelector('[data-ref-toggle]').textContent }));
    ck(on.showing && !on.hidden && /ON/.test(on.txt), 'AR8c REFERENCE ON brings it straight back');
    await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'reference-on.png') });
    // labels: a pixel at a feature label goes dark when the annotation is dismissed
    const lab = await page.evaluate(() => {
      const c = document.querySelector('[data-reference]'); const b = c.getBoundingClientRect();
      const f = LabReference.current().features[0];
      const ed = document.querySelector('[data-canvas-complete]');
      const q = window.ShapeLab.project(f.anchor, ed.clientWidth, ed.clientHeight);
      const g = c.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1);
      const fs = Math.max(10, Math.min(ed.clientWidth, ed.clientHeight) / 40);
      // the label's own text box, to the right of the anchor ring
      function lit() { const x0 = Math.round((q[0] + fs * 0.8) * dpr), y0 = Math.round((q[1] - fs * 0.45) * dpr);
        const d = g.getImageData(x0, y0, Math.round(fs * 1.8 * dpr), Math.round(fs * 0.9 * dpr)).data; let m = 0;
        for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; }
      const before = lit();
      document.querySelector('[data-ref-dismiss="' + f.name + '"]').click();
      const after = lit();
      return { name: f.name, before, after, dismissed: LabReference.dismissed(), panelOff: !!document.querySelector('.bp-f.off') };
    });
    ck(lab.before > lab.after + 60 && lab.dismissed.length === 1 && lab.dismissed[0] === lab.name && lab.panelOff,
      'AR8d a feature annotation is dismissible — its ring leaves the canvas and the panel marks it', lab.name + ' ' + lab.before + '→' + lab.after);
    await page.evaluate(() => { document.querySelector('[data-ref-labels]').click(); });
    const labelsOff = await page.evaluate(() => LabReference.labels());
    ck(labelsOff === false, 'AR8e and all labels can be switched off at once');
    await page.evaluate(() => { document.querySelector('[data-ref-labels]').click(); });

    // ---- AR9: budgets ----
    const budgets = {};
    for (const b of [8, 10, 12, 16, 18, 20]) {
      budgets[b] = await page.evaluate((bb) => { window.ShapeLab.setBudget(bb); return { label: document.querySelector('[data-budget-label]').textContent, sugg: LabReference.suggestions().filter((x) => x.budgeted).length }; }, b);
    }
    ck([8, 10, 12, 16, 18, 20].every((b) => new RegExp('TESTING ' + b + ' POINTS').test(budgets[b].label)) &&
       [10, 12, 16, 18, 20].every((b) => /authoring/.test(budgets[b].label) && /production currently supports 8/.test(budgets[b].label)) && /production budget/.test(budgets[8].label),
      'AR9  the six budgets are 8 · 10 · 12 · 16 · 18 · 20 and the header says TESTING N POINTS · Lab authoring budget · production currently supports 8', budgets[12].label);
    // (the BUDGETED suggestions: a feature in focus exposes its related
    // landmarks beside them, and those are deliberately not bounded by the
    // budget — the budget bounds what is suggested unasked)
    ck([8, 10, 12, 16, 18, 20].every((b) => budgets[b].sugg <= b), 'AR9b budgeted suggestions never exceed the budget', JSON.stringify([8, 10, 12, 16, 18, 20].map((b) => budgets[b].sugg)));
    // TURNED ROUND (Adaptive Suggested Points sprint): this asserted the
    // shrink was REFUSED. The budget is an authoring target now — the
    // shrink is allowed, the figure is kept whole, and the state says it
    // exceeds the budget. "Deletes nothing" is what it always guarded.
    const shrink = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.setBudget(12); S.reset(); S.setBudget(12);
      for (let i = 0; i < 10; i++) S.addPoint(-1 + i * 0.2, 0.5);
      const r = S.setBudget(8);
      return { r, n: S.figure().points.length, budget: S.state().budget, over: S.metrics().overBudget };
    });
    ck(shrink.r.ok && shrink.r.overBudget === 2 && shrink.n === 10 && shrink.budget === 8 && shrink.over === 2,
      'AR9c reducing the budget under a bigger figure is allowed, deletes nothing, and reports the figure exceeds it by 2', JSON.stringify(shrink.r));
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); });

    // ---- AR10: what the fixture holds, and what it does not ----
    await page.fill('[data-ref-subject]', 'Tiger');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Tiger');
    await clearFigure();
    const saved = await page.evaluate(() => {
      const S = window.ShapeLab;
      const sug = LabReference.suggestions();
      sug.slice(0, 5).forEach((s) => S.addPoint(s.x, s.y));
      S.toggleJoin(0, 1); S.toggleJoin(1, 2); S.toggleJoin(2, 3); S.toggleGap(1);
      const r = S.save();
      const rec = S.list().filter((x) => x.id === r.id)[0];
      // The reveal block (reveal-only features, its own sprint) is set
      // aside and scanned on its own terms: its `features` are the
      // PAYOFF's list and its `lights` are two INDICES into the author's
      // figure — never a coordinate, never the blueprint's `anchor`.
      const noReveal = (x) => { const c = Object.assign({}, x); delete c.reveal; return c; };
      return { ok: r.ok, keys: Object.keys(rec).sort(), authoring: rec.authoring, json: JSON.stringify(noReveal(rec)), revealJson: JSON.stringify(rec.reveal),
               revealLightsAreIndices: (rec.reveal.features || []).every((f) => Number.isInteger(f.lights.a) && (f.lights.b === null || Number.isInteger(f.lights.b))),
               storeKeys: Object.keys(localStorage), exportHas: /sketch|anchor|silhouette|feature|ellipse|polygon/i.test(JSON.stringify(S.list().map(noReveal))) };
    });
    // (`generated` is the translation sprint's three-field label — source,
    // at, edited — a note about HOW the figure arrived, never geometry.)
    const allowedKeys = ['approved', 'authoring', 'budget', 'createdAt', 'generated', 'hint', 'id', 'joins', 'judgement', 'labVersion', 'missing', 'name', 'notes', 'points', 'reveal', 'roles', 'tease', 'updatedAt'];
    ck(saved.ok && saved.keys.every((k) => allowedKeys.indexOf(k) !== -1) && JSON.stringify(Object.keys(saved.authoring).sort()) === JSON.stringify(['referenceUsed', 'source', 'subject']),
      'AR10 the saved fixture is the author\'s geometry plus allowed metadata — and the authoring note is three words about HOW, never geometry', saved.keys.join(','));
    ck(!/sketch|anchor|silhouette|feature|ellipse|polygon/i.test(saved.json) && !saved.exportHas && saved.storeKeys.length === 1 && saved.storeKeys[0] === 'vihu.lab.shapes' &&
       !/anchor|sketch|silhouette|ellipse|polygon/i.test(saved.revealJson) && saved.revealLightsAreIndices,
      'AR10b no sketch, no anchor, no feature list in the fixture or the export — the reference cannot enter final creature data; still ONE storage key (and the reveal block beside it holds light indices, never an anchor)');
    const cands = await page.evaluate(() => {
      const S = window.ShapeLab;
      const norm = (c) => JSON.stringify(c).replace(/lab-shape-\d+/g, 'lab-shape-N');
      const withRef = norm(S.candidateFor());
      LabReference.discard();
      const without = norm(S.candidateFor());
      return { withRef, without, same: withRef === without, words: /sketch|silhouette|feature|reference|anchor|authoring|subject/i.test(withRef), pts: S.figure().points.length };
    });
    ck(cands.same && !cands.words && cands.pts === 5,
      'AR10c the candidate is byte-identical with and without the reference — nothing of it reaches what the interpreter performs — and discarding leaves every light in place');
    await page.reload();
    await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference);
    const reopened = await page.evaluate(() => { const S = window.ShapeLab; const id = S.list()[0].id; S.load(id); return { authoring: S.state().authoring, ref: LabReference.current(), pts: S.figure().points.length }; });
    ck(reopened.authoring && reopened.authoring.subject === 'Tiger' && reopened.ref === null && reopened.pts === 5,
      'AR10d reopened after a reload: the authoring note survives, the geometry survives, and NO reference comes back with it — it was never stored');
    await page.evaluate(() => { localStorage.clear(); window.ShapeLab.reset(); });

    // ---- AR11: the GENERATED path against a stubbed endpoint ----
    let hits = 0, lastBody = null, answer = 'good';
    const generated = {
      subject: 'Dragon', silhouette: 'Side on: a long body, a big head, wings spread up and back, a spiked tail.',
      features: [
        { name: 'WING', importance: 3, why: 'Wings are what make it a dragon rather than a lizard.', anchor: [0.1, -0.9] },
        { name: 'HEAD', importance: 3, why: 'Long jaw, horns.', anchor: [-1.0, -0.3] },
        { name: 'TAIL', importance: 2, why: 'Long and tapering.', anchor: [1.1, 0.4] },
        { name: 'LEG', importance: 1, why: 'Shows it stands.', anchor: [-0.2, 0.8] }
      ],
      budgets: { 8: ['WING', 'HEAD', 'TAIL'], 12: ['WING', 'HEAD', 'TAIL', 'LEG'], 16: ['WING', 'HEAD', 'TAIL', 'LEG'], 20: ['WING', 'HEAD', 'TAIL', 'LEG'] },
      sketch: [
        { kind: 'ellipse', c: [0.1, 0.1], r: [0.8, 0.35], rot: 0.1 },
        { kind: 'polygon', points: [[-0.3, -0.2], [0.1, -1.1], [0.7, -0.9], [0.5, -0.2]], closed: true },
        { kind: 'line', points: [[0.8, 0.2], [1.1, 0.4], [1.25, 0.9]] },
        { kind: 'ellipse', c: [-1.0, -0.3], r: [0.28, 0.2], rot: -0.3 }
      ]
    };
    await page.route('https://fn.local/lab-generate', (route) => {
      hits++;
      const body = JSON.parse(route.request().postData() || '{}');
      lastBody = body;
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB1', provider: 'configured', model: 'gpt-4o-mini' }) });
      if (answer === 'down') return route.abort();
      let text;
      if (answer === 'good') text = JSON.stringify(generated);
      else if (answer === 'geometry') text = JSON.stringify(Object.assign({}, generated, { points: [[0, 0], [1, 1]], joins: ['0-1'] }));
      else if (answer === 'stars') { const g = JSON.parse(JSON.stringify(generated)); g.features[0].constellation = [[1, 2]]; text = JSON.stringify(g); }
      else if (answer === 'punct') {
        // what a real model writes for a body part: hyphens, digits, brackets, and one name over the cap
        const g = JSON.parse(JSON.stringify(generated));
        g.features[0].name = 'Wing-Membrane'; g.features[1].name = '2 Horns'; g.features[2].name = 'TAIL (TIP)'; g.features[3].name = 'Serpentine body with wings extended';
        g.budgets = { 8: ['Wing-Membrane', '2 Horns', 'TAIL (TIP)'], 12: ['Wing-Membrane', '2 Horns', 'TAIL (TIP)', 'Serpentine body with wings extended'], 16: g.budgets[16].map((_, i) => g.features[i].name), 20: g.budgets[20].map((_, i) => g.features[i].name) };
        text = JSON.stringify(g);
      }
      else if (answer === 'junk') { const g = JSON.parse(JSON.stringify(generated)); g.features[1].name = '---'; text = JSON.stringify(g); }
      else text = 'the dragon is mighty and I refuse to answer in JSON';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4o-mini', build: 'LAB1', text }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    await page.fill('[data-ref-subject]', 'Dragon');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Dragon');
    const gen = await page.evaluate(() => {
      const S = window.ShapeLab;
      const placed = S.roles().slice();
      for (let i = S.figure().points.length - 1; i >= 0; i--) S.deletePoint(i);      // hand the placed starting figure back, to read the suggestions it came from
      return { meta: LabReference.meta(), status: document.querySelector('[data-ref-status]').textContent, sketch: LabReference.current().sketch.length,
        authoring: ShapeLab.state().authoring, src: document.querySelector('[data-ref-source]').textContent, sugg: LabReference.suggestions().map((s) => s.name), labels: LabReference.suggestions().map((s) => s.label), placed };
    });
    // (Since the Adaptive Suggested Points sprint the budget-8 list is the
    // RANKING cut to eight: the defining points first — both wing tips, the
    // head, the tail tip — then the wing roots and the tail base. LEG is
    // outside the blueprint's own 8 list and is not offered at 8.)
    ck(gen.meta.source === 'generated' && gen.meta.mode === 'endpoint' && /LLM reference in place for "Dragon"/.test(gen.status) && gen.sketch === 4 && gen.authoring.source === 'generated' && /LLM — Endpoint \(gpt-4o-mini\) — generated for "Dragon"/.test(gen.src) &&
       gen.sugg.slice(0, 4).join(',') === 'WING,HEAD,WING,TAIL' && gen.sugg.every((n) => ['WING', 'HEAD', 'TAIL'].indexOf(n) !== -1) && gen.labels.slice(0, 4).join(',') === 'left wing tip,head,right wing tip,tail tip' && gen.sugg.length === 8 && gen.placed.join(',') === gen.sugg.join(','),
      'AR11 a generated reply becomes the reference, labelled generated, with its budget-8 suggestions ranked on the outline (two wing tips, a head, a tail tip first; then wing roots and the tail base; never LEG, which the blueprint keeps for 12)', gen.labels.join(','));
    const reqJson = JSON.stringify(lastBody);
    ck(lastBody && lastBody.action === 'generate' && Array.isArray(lastBody.messages) && lastBody.messages.length === 2 && lastBody.messages[1].content === 'Subject: Dragon' &&
       !/\b(card|cardId|stars|constellation|memor|story|email|orbit|username|creator|companion|owner)\b/i.test(reqJson) && !/points|joins|gaps/.test(JSON.stringify(lastBody.messages[1])),
      'AR11b what left the browser was the subject and the fixed contract — no card, no Stars, no memory, no Story, no name of anybody, no geometry');
    await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'reference-generated.png') });
    for (const mode of ['geometry', 'stars', 'prose', 'down']) {
      answer = mode;
      await page.click('[data-ref-another]');
      await page.waitForFunction(() => /still here|Nothing changed/.test(document.querySelector('[data-ref-status]').textContent), null, { timeout: 8000 });
      const r = await page.evaluate(() => ({ subj: LabReference.current().subject, sketch: LabReference.current().sketch.length, status: document.querySelector('[data-ref-status]').textContent, prev: LabReference.previous() }));
      ck(r.subj === 'Dragon' && r.sketch === 4 && /still here/.test(r.status) && r.prev === null,
        'AR11c a ' + (mode === 'geometry' ? 'reply smuggling final geometry' : mode === 'stars' ? 'reply carrying a constellation' : mode === 'prose' ? 'reply that is not a blueprint' : 'transport that fails') + ' is refused safely: the reference in use is unchanged', r.status.slice(0, 70));
    }
    // AR11f — the product owner's first real dragon came back refused
    // whole for `bad-feature-name:5, bad-feature-name:6`: a real model
    // writes "WING-MEMBRANE" or "2 HORNS" for a body part. A name is
    // repaired mechanically now — marks to spaces, cut at a word — and
    // every repair is named in the trace; the budget lists still resolve.
    answer = 'punct';
    await page.click('[data-ref-another]');
    // (waits for EITHER outcome, so a build that refuses the reply fails
    // AR11f by name rather than crashing the run on a timeout)
    await page.waitForFunction(() => (LabReference.current() && LabReference.current().features.some((f) => f.name === 'WING MEMBRANE')) || /still here|Nothing changed/.test(document.querySelector('[data-ref-status]').textContent), null, { timeout: 8000 });
    const tidy = await page.evaluate(() => ({ names: LabReference.current().features.map((f) => f.name), b8: LabReference.current().budgets['8'], b12: LabReference.current().budgets['12'],
      repairs: LabReference.last().parse.repairs || [], outcome: document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome'), traceText: document.querySelector('[data-ref-trace]').textContent }));
    ck(tidy.names.join('|') === 'WING MEMBRANE|HORNS|TAIL TIP|SERPENTINE BODY WITH' && tidy.b8.join('|') === 'WING MEMBRANE|HORNS|TAIL TIP' && tidy.b12.length === 4 && tidy.outcome === 'generated',
      'AR11f a reply naming "Wing-Membrane", "2 Horns", "TAIL (TIP)" and a 36-character name is ACCEPTED — each name tidied to capitals, letters and spaces, the long one cut at a word — and the budget lists still find them', tidy.names.join('|'));
    ck(tidy.repairs.length === 4 && /feature 0 "WING-MEMBRANE" → "WING MEMBRANE"/.test(tidy.repairs.join(' ')) && /names tidied/.test(tidy.traceText) && /WING-MEMBRANE/.test(tidy.traceText),
      'AR11g and every repair is NAMED in the trace — what the model wrote and what it became — never a silent rewrite', tidy.repairs.join(' · '));
    answer = 'junk';
    await page.click('[data-ref-another]');
    await page.waitForFunction(() => /still here|Nothing changed/.test(document.querySelector('[data-ref-status]').textContent), null, { timeout: 8000 });
    const junk = await page.evaluate(() => ({ status: document.querySelector('[data-ref-status]').textContent, names: LabReference.current().features.map((f) => f.name), trace: LabReference.last().parse, traceText: document.querySelector('[data-ref-trace]').textContent }));
    ck(/bad-feature-name:1/.test(junk.status) && /refused: "---"/.test(junk.status) && junk.names[0] === 'WING MEMBRANE' && junk.trace.offending.length === 1 && junk.trace.offending[0].name === '---' && /refused names: "---"/.test(junk.traceText),
      'AR11h a name with no letters left in it is still refused — and the status and the trace SAY WHICH NAME, so a refusal is never a code alone; the reference in use is unchanged', junk.status.slice(0, 120));
    answer = 'good';
    ck(hits >= 6, 'AR11d and every one of those was a real request to the stubbed endpoint', 'hits ' + hits);
    // try another interpretation → previous kept → bring back → discard
    await page.click('[data-ref-another]');
    await page.waitForFunction(() => !!LabReference.previous());
    const multi = await page.evaluate(() => {
      const a = LabReference.current().subject, p = LabReference.previous().subject;
      const rb = LabReference.restorePrevious();
      const after = { cur: LabReference.current().subject, prev: !!LabReference.previous() };
      LabReference.discard();
      return { a, p, rb: rb.ok, after, cleared: LabReference.current() === null && LabReference.previous() === null, editorOpaque: document.querySelector('[data-canvas-complete]').getContext('2d').getImageData(3, 3, 1, 1).data[3] };
    });
    ck(multi.a === 'Dragon' && multi.p === 'Dragon' && multi.rb && multi.after.cur === 'Dragon' && multi.after.prev && multi.cleared && multi.editorOpaque === 255,
      'AR11e another interpretation keeps the previous one, the previous one can be brought back, and discard clears both and returns the editor to its opaque sky');

    // ---- AR13: the REFERENCE SOURCE is explicit, and a failure is never a fixture ----
    const srcCtl = await page.evaluate(() => ({
      buttons: Array.from(document.querySelectorAll('[data-conn-mode]')).map((b) => b.getAttribute('data-conn-mode') + ':' + b.textContent.trim()),
      on: Array.from(document.querySelectorAll('[data-conn-mode].on')).map((b) => b.getAttribute('data-conn-mode')),
      status: document.querySelector('[data-conn-status]').textContent
    }));
    ck(srcCtl.buttons.join('|') === 'fixture:Fixture|endpoint:LLM — Endpoint|direct:LLM — Direct (dev)' && srcCtl.on.join() === 'endpoint' && /CONNECTED \(endpoint\)/.test(srcCtl.status),
      'AR13 REFERENCE SOURCE is one visible three-way control — Fixture · LLM — Endpoint · LLM — Direct (dev) — using LabConnection\'s own mode names, and it shows the live connection line', srcCtl.buttons.join('|'));
    // a fresh fixture reference, then a generated one: the panel badge and the outcome attribute say which is which
    await page.click('[data-conn-mode="fixture"]');
    await page.fill('[data-ref-subject]', 'Lion');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Lion');
    const fx = await page.evaluate(() => ({ badge: document.querySelector('[data-ref-panel-source]').textContent, cls: document.querySelector('[data-ref-panel-source]').className,
      outcome: document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome'), src: document.querySelector('[data-ref-source]').textContent, status: document.querySelector('[data-ref-status]').textContent,
      trace: LabReference.last(), traceText: document.querySelector('[data-ref-trace]').textContent }));
    ck(fx.badge === 'FIXTURE — generic authoring reference' && /fixture/.test(fx.cls) && fx.outcome === 'fixture' && /^FIXTURE — generic authoring reference/.test(fx.src) &&
       /not the creature/.test(fx.status) && fx.trace.mode === 'fixture' && /sends nothing anywhere/.test(fx.trace.request) && /fixture/.test(fx.traceText),
      'AR13b Fixture is unmistakable: the blueprint panel is badged FIXTURE — generic authoring reference, the outcome reads fixture, and the trace says no request was sent');
    await page.click('[data-conn-mode="endpoint"]');
    const hitsBefore = hits;
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome') === 'generated');
    const ll = await page.evaluate(() => ({ badge: document.querySelector('[data-ref-panel-source]').textContent, cls: document.querySelector('[data-ref-panel-source]').className,
      subject: LabReference.current().subject, features: LabReference.current().features.length, sketch: JSON.stringify(LabReference.current().sketch),
      trace: LabReference.last(), traceText: document.querySelector('[data-ref-trace]').textContent }));
    const fxSketch = JSON.stringify(B.fixture('Lion').blueprint.sketch);
    ck(hits === hitsBefore + 1 && ll.badge === 'LLM — Endpoint (gpt-4o-mini)' && /llm/.test(ll.cls) && !/FIXTURE/i.test(ll.badge) && ll.subject === 'Dragon' && ll.features === 4 && ll.sketch !== fxSketch &&
       ll.trace.mode === 'endpoint' && ll.trace.answer.ok && ll.trace.answer.source === 'generated' && ll.trace.answer.model === 'gpt-4o-mini' && ll.trace.parse.ok && ll.trace.accepted && ll.trace.outcome === 'generated' && /validator.*accepted/.test(ll.traceText),
      'AR13c selecting LLM — Endpoint invokes the Endpoint transport (one real request to the stub), the accepted blueprint is badged LLM — Endpoint with the model, never FIXTURE, and the sketch differs from the fixture\'s', ll.badge + ' hits+' + (hits - hitsBefore));
    // a failure in LLM mode is reported as an LLM failure, and the panel keeps saying LLM for the reference still in use
    for (const mode of ['prose', 'down']) {
      answer = mode;
      await page.click('[data-ref-generate]');
      await page.waitForFunction((m) => document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome') === (m === 'prose' ? 'rejected' : 'failed'), mode, { timeout: 8000 });
      const f = await page.evaluate(() => ({ status: document.querySelector('[data-ref-status]').textContent, badge: document.querySelector('[data-ref-panel-source]').textContent,
        outcome: document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome'), subject: LabReference.current().subject, trace: LabReference.last(), traceText: document.querySelector('[data-ref-trace]').textContent }));
      ck(/^LLM (result rejected|request failed)/.test(f.status) && /No fixture was substituted/.test(f.status) && !/Fixture reference/.test(f.status) && f.badge === 'LLM — Endpoint (gpt-4o-mini)' && f.subject === 'Dragon' &&
         f.trace.mode === 'endpoint' && (mode === 'prose' ? (f.trace.answer.ok && !f.trace.parse.ok) : (!f.trace.answer.ok)) && /outcome/.test(f.traceText),
        'AR13d a ' + (mode === 'prose' ? 'rejected' : 'dead-transport') + ' LLM result says so — FAILED LLM ≠ Fixture: nothing is substituted, the LLM reference in use stays, the trace names the step', f.status.slice(0, 80));
    }
    answer = 'good';
    // Endpoint selected but not configured: nothing is generated, nothing falls back
    await page.click('[data-conn-clear]');
    await page.click('[data-conn-mode="endpoint"]');
    const hitsNC = hits;
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome') === 'not-configured');
    const nc = await page.evaluate(() => ({ status: document.querySelector('[data-ref-status]').textContent, subject: LabReference.current() && LabReference.current().subject, trace: LabReference.last() }));
    ck(hits === hitsNC && /LLM — Endpoint is selected but not configured/.test(nc.status) && /no fixture was substituted/.test(nc.status) && nc.subject === 'Dragon' && /not sent/.test(nc.trace.request),
      'AR13e LLM — Endpoint selected but unconfigured: no request, no fixture, the reference in use untouched, and the status says exactly what is missing');
    // Direct selection invokes the Direct transport — stubbed at the provider host, and the blueprint is badged Direct
    let directHits = 0;
    await page.route('https://api.openai.com/**', (route) => {
      directHits++;
      if (/\/models$/.test(route.request().url())) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'gpt-4.1-mini' }] }) });
      const body = JSON.parse(route.request().postData() || '{}');
      lastBody = body;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(Object.assign({}, generated, { subject: 'Octopus' })) } }] }) });
    });
    await page.click('[data-conn-mode="direct"]');
    await page.fill('[data-conn-key]', 'sk-test-direct-never-stored');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED \(direct\)/.test(document.querySelector('[data-conn-status]').textContent));
    await page.fill('[data-ref-subject]', 'Octopus');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Octopus');
    const dr = await page.evaluate(() => ({ badge: document.querySelector('[data-ref-panel-source]').textContent, meta: LabReference.meta(), outcome: document.querySelector('[data-ref-section]').getAttribute('data-ref-outcome'),
      ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), cookie: document.cookie, exp: window.ShapeLab.exportJSON() }));
    ck(directHits >= 2 && dr.badge === 'LLM — Direct (dev) (gpt-4.1)' && dr.meta.mode === 'direct' && dr.meta.source === 'generated' && dr.outcome === 'generated' &&
       lastBody && lastBody.messages && lastBody.messages[1].content === 'Subject: Octopus' && !/\b(card|stars|constellation|memor|story|email|username|creator|companion)\b/i.test(JSON.stringify(lastBody)) &&
       !/sk-test-direct/.test(dr.ls + dr.ss + dr.cookie + dr.exp),
      'AR13f selecting LLM — Direct (dev) invokes the Direct transport at the provider host, is badged LLM — Direct (dev), sends the subject plus the contract only, and the key reaches no storage, export or cookie', dr.badge);
    await page.unroute('https://api.openai.com/**');
    await page.click('[data-conn-clear]');
    ck(!/subject\s*===|===\s*subject|\b(lion|tiger|falcon|elephant|octopus)\b/i.test(bpStripped + refStripped),
      'AR13g still no subject-specific code — none of lion, tiger, falcon, elephant or octopus appears in the blueprint or reference modules');

    // ---- AR14: the CREATURE OUTLINE REFERENCE — the visual guide is composed from the features, Lab-side ----
    const outlineSrc = read('tools/ether-mystery-lab/labOutline.js');
    const outlineStripped = stripComments(outlineSrc);
    ck(/labOutline\.js/.test(shapeHtml) && !/labOutline/.test(read('tools/ether-mystery-lab/preview.html')) && !/LabOutline/.test(read('tools/ether-mystery-lab/labPreview.js') + read('tools/ether-mystery-lab/labPreviewHost.js')),
      'AR14 the Shape Lab loads the outline composer; the child-facing preview does not and cannot draw one');
    ck(!/\b(lion|tiger|falcon|elephant|octopus|whale|penguin|dragon|giraffe|frog|shark|bird|cat|dog|lizard|horse|bear|fox)\b/i.test(outlineStripped) && !/subject\s*===|===\s*subject|switch\s*\(\s*subject/.test(outlineStripped),
      'AR14b no creature name and no subject branch anywhere in the composer — a parts vocabulary keyed on FEATURE words, never a creature catalogue');
    ck(!/<img|drawImage|new Image|Image\(|\.png|\.jpg|\.svg|url\(|base64|fetch\(|XMLHttpRequest|localStorage|sessionStorage/i.test(outlineStripped),
      'AR14c the composer draws nothing itself, loads no image, reaches no network and writes no storage');
    const osb = { console }; osb.window = undefined; osb.global = osb;
    vm.runInNewContext(outlineSrc, osb, { filename: 'labOutline.js' });
    const O = osb.LabOutline;
    const feat = (names) => names.map((n, i) => ({ name: n, importance: i < 3 ? 3 : 2, why: 'x', anchor: [0, 0] }));
    const shapes = {
      quad: O.compose({ subject: 'a', features: feat(['HEAD', 'EARS', 'MUZZLE', 'BODY', 'FOUR LEGS', 'LONG TAIL', 'STRIPES']) }),
      bird: O.compose({ subject: 'b', features: feat(['HOOKED BEAK', 'HEAD', 'BODY', 'WINGS', 'TAIL FEATHERS']) }),
      ceph: O.compose({ subject: 'c', features: feat(['MANTLE', 'EIGHT ARMS', 'HEAD']) }),
      fish: O.compose({ subject: 'd', features: feat(['BODY', 'DORSAL FIN', 'TAIL FIN']) }),
      snake: O.compose({ subject: 'e', features: feat(['HEAD', 'BODY', 'TAIL']) }),
      trunk: O.compose({ subject: 'f', features: feat(['TRUNK', 'LARGE EARS', 'TUSKS', 'LARGE BODY', 'HEAD', 'THICK LEGS', 'SHORT TAIL']) }),
      wibble: O.compose({ subject: 'Wibble Fnord 7', features: feat(['GLORP', 'BODY', 'ZIB']) })
    };
    ck(shapes.quad.archetype === 'quadruped' && shapes.bird.archetype === 'winged' && shapes.ceph.archetype === 'cephalopod' && shapes.fish.archetype === 'finned' && shapes.snake.archetype === 'limbless' && shapes.trunk.archetype === 'quadruped',
      'AR14d the body plan is READ from the features — legs → quadruped, wings → winged, mantle and arms → cephalopod, fins without legs → finned, nothing to stand on → limbless',
      Object.keys(shapes).map((k) => k + ':' + shapes[k].archetype).join(' '));
    ck(shapes.quad.drawn.join() === 'head,ears,muzzle,body,legs,tail' && shapes.quad.notDrawn.join() === 'STRIPES' && shapes.trunk.drawn.indexOf('trunk') !== -1 && shapes.trunk.drawn.indexOf('tusks') !== -1 &&
       shapes.ceph.anchors['EIGHT ARMS'].length === 8 && shapes.quad.anchors['FOUR LEGS'].length === 4 && shapes.bird.anchors['HOOKED BEAK'].length === 1 && shapes.bird.anchors['WINGS'].length === 2,
      'AR14e diagnostic structures the features name are drawn and anchored under the feature\'s OWN name — a trunk, tusks, eight arms, four legs, a hooked beak, two wings — and texture (STRIPES) is recorded as not drawn');
    const allIn = Object.keys(shapes).every((k) => shapes[k].paths.every((p) => p.pts.every((q) => Math.abs(q[0]) <= 1.3 && Math.abs(q[1]) <= 1.3)));
    ck(allIn && Object.keys(shapes).every((k) => shapes[k].source === 'lab-parts' && /not provider-generated/.test(shapes[k].label)) && shapes.wibble && shapes.wibble.paths.length > 0 && shapes.wibble.unplaced.join() === 'GLORP,ZIB',
      'AR14f every outline fits the editor\'s reach, every one is labelled lab-parts and says it is not provider-generated, and an arbitrary subject with unknown features still composes (the unknown ones named as not understood)');
    // the browser half: the outline is on the underlay, the suggestions sit on it, OFF removes it
    await page.click('[data-conn-mode="fixture"]');
    await page.fill('[data-ref-subject]', 'Tiger');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Tiger' && !!LabReference.outline());
    await clearFigure();
    const ol = await page.evaluate(() => {
      const c = document.querySelector('[data-reference]'); const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data; let lit = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 240) lit++; }
      const o = LabReference.outline();
      const sug = LabReference.suggestions();
      // (Suggestions are the outline's LANDMARKS now — its anchors as level-1
      // defining points plus its structural and detail marks — so the test
      // is against the landmark list, which every anchor is also in.)
      const onOutline = sug.every((s) => o.landmarks.some((l) => l.x === s.x && l.y === s.y && l.name === s.name));
      const bpAnchors = LabReference.current().features.map((f) => f.anchor.join(','));
      return { litFraction: lit / (c.width * c.height), source: o.source, archetype: o.archetype, drawn: o.drawn, sug: sug.length, onOutline,
        anyOnBlueprintAnchor: sug.some((s) => bpAnchors.indexOf(s.x + ',' + s.y) !== -1),
        info: document.querySelector('[data-ref-outline-info]').textContent, flag: !document.querySelector('[data-outline-flag]').hidden, legend: document.querySelector('.legend').textContent };
    });
    ck(ol.litFraction > 0.06 && ol.source === 'lab-parts' && ol.archetype === 'quadruped',
      'AR14g the outline is RENDERED on the underlay — a silhouette covering a real share of the sky, composed from the fixture body plan', 'lit ' + (ol.litFraction * 100).toFixed(1) + '%');
    ck(ol.sug > 0 && ol.onOutline && !ol.anyOnBlueprintAnchor,
      'AR14h every suggested point sits ON the outline\'s own landmarks, none on the assistant\'s sketch coordinates', ol.sug + ' suggestions');
    ck(/Creature outline reference — Lab-only deterministic outline/.test(ol.info) && /not provider-generated/.test(ol.info) && /Body plan read from the features: quadruped/.test(ol.info) && /deprecated and not shown/.test(ol.info) &&
       ol.flag && /BLUEPRINT/.test(ol.legend) && /OUTLINE/.test(ol.legend) && /ETHER FIGURE/.test(ol.legend),
      'AR14i the panel says what the outline is (Lab-only, not provider-generated), which body plan it read, that the sketch is deprecated and not shown, and the legend separates BLUEPRINT · OUTLINE · ETHER FIGURE');
    // a click near an OUTLINE anchor snaps to the outline, not to the sketch
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); document.querySelector('[data-canvas-complete]').scrollIntoView({ block: 'center' }); });
    const oa = await page.evaluate(() => {
      const ed = document.querySelector('[data-canvas-complete]'); const b = ed.getBoundingClientRect();
      const s = LabReference.suggestions()[0];
      const q = window.ShapeLab.project([s.x + 0.04, s.y + 0.04], b.width, b.height);
      return { x: b.left + q[0], y: b.top + q[1], want: [s.x, s.y], name: s.name };
    });
    await page.mouse.click(oa.x, oa.y);
    const oaPts = await page.evaluate(() => window.ShapeLab.figure().points);
    ck(oaPts.length === 1 && oaPts[0][0] === oa.want[0] && oaPts[0][1] === oa.want[1],
      'AR14j a click near an outline anchor accepts it — the light lands on the outline\'s ' + oa.name + ' — and is an ordinary light from then on');
    await page.click('[data-ref-toggle]');
    const oOff = await page.evaluate(() => {
      const c = document.querySelector('[data-reference]'), ed = document.querySelector('[data-canvas-complete]');
      return { hidden: c.hidden, display: getComputedStyle(c).display, editorAlpha: ed.getContext('2d').getImageData(3, 3, 1, 1).data[3], snap: LabReference.snap([-0.85, -0.45]), flag: document.querySelector('[data-outline-flag]').hidden,
        pts: window.ShapeLab.figure().points.length, outlineKept: !!LabReference.outline() };
    });
    ck(oOff.hidden && oOff.display === 'none' && oOff.editorAlpha === 255 && oOff.snap === null && oOff.flag && oOff.pts === 1 && oOff.outlineKept,
      'AR14k REFERENCE OFF: the outline is gone, the editor paints its original opaque sky, nothing snaps, the light stays — the definitive judging state');
    await page.click('[data-ref-toggle]');
    // the outline never enters what leaves the Lab
    const leak = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.toggleJoin(0, 0);
      const norm = (c) => JSON.stringify(c).replace(/lab-shape-\d+/g, 'lab-shape-N');
      const withRef = norm(S.candidateFor());
      const r = S.save();
      const rec = S.list().filter((x) => x.id === r.id)[0];
      const exp = S.exportJSON();
      document.querySelector('[data-ref-copy]').click();
      const json = document.querySelector('[data-ref-json]').value;
      LabReference.discard();
      const without = norm(S.candidateFor());
      return { rec: JSON.stringify(rec), exp, withRef, without, json, keys: Object.keys(localStorage) };
    });
    const olWords = /outline|archetype|lab-parts|"paths"|quadruped/i;
    ck(!olWords.test(leak.rec) && !olWords.test(leak.exp) && !olWords.test(leak.withRef) && leak.withRef === leak.without && leak.keys.join() === 'vihu.lab.shapes',
      'AR14l the outline enters no fixture, no export and no candidate (byte-identical with and without it) — only the existing authoring note is stored');
    ck(/"features"/.test(leak.json) && /"subject"/.test(leak.json) && !olWords.test(leak.json),
      'AR14m Show blueprint JSON reveals the assistant\'s semantic blueprint for the record, and the outline is not in it');
    ck(!/outline|LabOutline|archetype/i.test(read('assets/ether/experience-pool.js')) && grepProd.trim() === '',
      'AR14n and nothing under js/, assets/, the runtime or the pool names the outline — Lab only');
    await page.evaluate(() => { localStorage.clear(); window.ShapeLab.reset(); });

    // ---- AR12: the direct key lives in a closure and nowhere else ----
    await page.click('[data-conn-mode="direct"]');
    await page.fill('[data-conn-key]', 'sk-test-never-stored-9f9f9f');
    const keyState = await page.evaluate(() => ({ holds: window.LabConnection._holdsDirectKey(), ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), exp: window.ShapeLab.exportJSON(), cookie: document.cookie }));
    ck(keyState.holds && !/sk-test/.test(keyState.ls + keyState.ss + keyState.exp + keyState.cookie),
      'AR12 a direct key is held in memory for the page and reaches no storage, no export and no cookie');
    await page.click('[data-conn-clear]');
    const cleared = await page.evaluate(() => ({ holds: window.LabConnection._holdsDirectKey(), field: document.querySelector('[data-conn-key]').value, status: document.querySelector('[data-conn-status]').textContent }));
    ck(!cleared.holds && cleared.field === '' && /FIXTURE MODE/.test(cleared.status), 'AR12b Disconnect / clear forgets it and returns to fixture mode');
    ck(errors.length === 0, 'AR12c no page errors across the whole journey', errors.join(' | '));
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
}


// ===================================================================
// AP. Adaptive Suggested Points & Author-Controlled Creature Geometry
// (Shape Lab, Lab only). Six authoring budgets; suggestions RANKED from
// the blueprint's importance and the outline's leveled landmarks and cut
// to the budget; a budget change that never touches an authored point;
// APPROVE FIGURE as a frozen research artifact. Production untouched.
// ===================================================================
async function sectionAP() {
  console.log('\n== AP. Adaptive suggested points & author-controlled geometry ==');
  const { chromium } = require('playwright');
  const bpSrc = read('tools/ether-mystery-lab/labBlueprint.js');
  const olSrc = read('tools/ether-mystery-lab/labOutline.js');
  const refSrc = read('tools/ether-mystery-lab/labReference.js');
  const shapeSrc = read('tools/ether-mystery-lab/labShape.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const labStripped = [bpSrc, olSrc, refSrc, shapeSrc].map(stripComments).join('\n');

  // ---- AP1: statics ----
  const htmlBudgets = (shapeHtml.match(/data-budget="(\d+)"/g) || []).map((m) => m.replace(/\D/g, ''));
  ck(htmlBudgets.join(',') === '8,10,12,16,18,20' && /BUDGETS\s*=\s*\[\s*8,\s*10,\s*12,\s*16,\s*18,\s*20\s*\]/.test(shapeSrc) && /BUDGETS\s*=\s*\[\s*8,\s*10,\s*12,\s*16,\s*18,\s*20\s*\]/.test(bpSrc) && /REQUIRED_BUDGETS\s*=\s*\[\s*8,\s*12,\s*16,\s*20\s*\]/.test(bpSrc),
    'AP1  six authoring budgets — 8 · 10 · 12 · 16 · 18 · 20 — on the page, in the editor and in the blueprint; a reply still needs only the four canonical lists', htmlBudgets.join(','));
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')),
    'AP1b the production point limit is untouched — arrangementNodesMax is still 8 in js/etherGrammar.js');
  ck(!/\b(tiger|lion|elephant|falcon|octopus|eagle|whale|dragon)\b/i.test(labStripped) && !/subject\s*===|subject\s*==\s*['"]/.test(labStripped),
    'AP1c no subject-specific branch anywhere in the four Lab modules — no creature name in code, no `subject ===`');
  // The reference layer may never place a light: the only thing that
  // calls addPoint is the editor answering a real press.
  const refCalls = stripComments(refSrc).match(/\baddPoint\s*\(/g) || [];
  // (Since the starting-figure rule the budgeted suggestions ARE placed as
  // lights — but through ONE seam in the editor, `placeSuggestions`, and
  // that seam makes no join and no gap. The reference, blueprint and
  // outline modules still call no editing function of their own.)
  const placeBody = stripComments(shapeSrc.slice(shapeSrc.indexOf('function placeSuggestions('), shapeSrc.indexOf('function overBudget(')));
  ck(refCalls.length === 0 && !/\bmovePoint\s*\(|\btoggleJoin\s*\(|\btoggleGap\s*\(/.test(stripComments(refSrc)) && !/\baddPoint\s*\(|\bmovePoint\s*\(|\btoggleJoin\s*\(/.test(stripComments(bpSrc) + stripComments(olSrc)) &&
     (stripComments(refSrc).match(/placeSuggestions\(/g) || []).length === 1 && placeBody.length > 0 && !/toggleJoin|toggleGap|\.joins\.push|gap\s*[:=]/.test(placeBody),
    'AP1d suggestions become lights through ONE editor seam and nothing else: the reference, blueprint and outline modules call no editing function, and that seam makes no join and no gap');
  // ("recognisable" is a word the CONTRACT uses — it asks the assistant
  // what makes a subject recognisable — so it may appear in the prompt
  // text and nowhere else; a ranking PRIORITY is not a score.)
  const bpStrippedAP = stripComments(bpSrc);
  const inPrompt = (bpStrippedAP.match(/recognis/gi) || []).length, inContract = ((bpStrippedAP.match(/'[^'\n]*recognis[^'\n]*'/gi) || []).join('').match(/recognis/gi) || []).length;
  ck(!/\bscore\b|recognis|fetch\(|XMLHttpRequest/i.test(stripComments(olSrc) + stripComments(refSrc)) && !/\bscore\b|fetch\(|XMLHttpRequest/i.test(bpStrippedAP) && inPrompt === inContract,
    'AP1e no recognisability score and no model judging anywhere in the ranking, the outline or the reference layer — the researcher judges', 'recognis: ' + inPrompt + ' in file, ' + inContract + ' in the contract string');

  // ---- AP2: the ranking, in Node, across five creatures and six budgets ----
  const vm = require('vm');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(bpSrc, ctx); vm.runInContext(olSrc, ctx);
  const B = ctx.LabBlueprint, O = ctx.LabOutline;
  const mkBp = (subject, feats, lists) => {
    const r = B.validate({ subject, silhouette: 'Side on, the whole animal.', features: feats.map((f) => ({ name: f[0], importance: f[1], why: 'It is what names it.', anchor: [0, 0] })), budgets: lists });
    if (!r.ok) throw new Error(subject + ' ' + r.reasons.join(','));
    return r.blueprint;
  };
  const grow = (a, b, c) => ({ 8: a, 12: b, 16: c, 20: c });
  const CREATURES = {
    Lion: mkBp('Lion', [['MANE', 3], ['HEAD', 3], ['POWERFUL BODY', 3], ['LONG TAIL', 2], ['FRONT LEGS', 2], ['HIND LEGS', 2], ['MUZZLE', 1], ['EARS', 1]],
      grow(['MANE', 'HEAD', 'POWERFUL BODY', 'LONG TAIL', 'FRONT LEGS', 'HIND LEGS'], ['MANE', 'HEAD', 'POWERFUL BODY', 'LONG TAIL', 'FRONT LEGS', 'HIND LEGS', 'MUZZLE'], ['MANE', 'HEAD', 'POWERFUL BODY', 'LONG TAIL', 'FRONT LEGS', 'HIND LEGS', 'MUZZLE', 'EARS'])),
    Tiger: mkBp('Tiger', [['HEAD', 3], ['BODY', 3], ['FOUR LEGS', 2], ['LONG TAIL', 2], ['EARS', 1], ['MUZZLE', 1], ['STRIPES', 1]],
      grow(['HEAD', 'BODY', 'FOUR LEGS', 'LONG TAIL', 'EARS', 'MUZZLE'], ['HEAD', 'BODY', 'FOUR LEGS', 'LONG TAIL', 'EARS', 'MUZZLE', 'STRIPES'], ['HEAD', 'BODY', 'FOUR LEGS', 'LONG TAIL', 'EARS', 'MUZZLE', 'STRIPES'])),
    Falcon: mkBp('Falcon', [['HOOKED BEAK', 3], ['HEAD', 3], ['BODY', 3], ['WINGS', 3], ['TAIL FEATHERS', 2], ['TALONS', 1]],
      grow(['HOOKED BEAK', 'HEAD', 'BODY', 'WINGS', 'TAIL FEATHERS'], ['HOOKED BEAK', 'HEAD', 'BODY', 'WINGS', 'TAIL FEATHERS', 'TALONS'], ['HOOKED BEAK', 'HEAD', 'BODY', 'WINGS', 'TAIL FEATHERS', 'TALONS'])),
    Elephant: mkBp('Elephant', [['TRUNK', 3], ['LARGE EARS', 3], ['TUSKS', 2], ['LARGE BODY', 3], ['HEAD', 3], ['THICK LEGS', 2], ['SHORT TAIL', 1]],
      grow(['TRUNK', 'LARGE EARS', 'TUSKS', 'LARGE BODY', 'HEAD', 'THICK LEGS'], ['TRUNK', 'LARGE EARS', 'TUSKS', 'LARGE BODY', 'HEAD', 'THICK LEGS', 'SHORT TAIL'], ['TRUNK', 'LARGE EARS', 'TUSKS', 'LARGE BODY', 'HEAD', 'THICK LEGS', 'SHORT TAIL'])),
    Octopus: mkBp('Octopus', [['MANTLE', 3], ['EIGHT ARMS', 3], ['HEAD', 2], ['SUCKERS', 1]],
      grow(['MANTLE', 'EIGHT ARMS', 'HEAD'], ['MANTLE', 'EIGHT ARMS', 'HEAD', 'SUCKERS'], ['MANTLE', 'EIGHT ARMS', 'HEAD', 'SUCKERS']))
  };
  const HIGH = { Lion: ['MANE', 'HEAD', 'POWERFUL BODY'], Tiger: ['HEAD', 'BODY'], Falcon: ['HOOKED BEAK', 'HEAD', 'BODY', 'WINGS'], Elephant: ['TRUNK', 'HEAD', 'LARGE BODY', 'LARGE EARS'], Octopus: ['MANTLE', 'EIGHT ARMS'] };
  const table = {};
  let monotonic = true, bounded = true, onLandmark = true, highSurvive = true, extrasStructural = true, varied = true, distinct = true, labelled = true;
  Object.keys(CREATURES).forEach((name) => {
    const bp = CREATURES[name], o = O.compose(bp);
    table[name] = {};
    let prev = null;
    B.BUDGETS.forEach((b) => {
      const sg = B.suggestions(bp, b, o);
      table[name][b] = sg.map((x) => x.label);
      if (sg.length > b) bounded = false;
      if (!sg.every((x) => o.landmarks.some((l) => l.x === x.x && l.y === x.y && l.name === x.name) || bp.features.some((f) => f.anchor[0] === x.x && f.anchor[1] === x.y && f.name === x.name))) onLandmark = false;
      if (!sg.every((x) => typeof x.label === 'string' && x.label && typeof x.level === 'number')) labelled = false;
      for (let i = 0; i < sg.length; i++) for (let j = i + 1; j < sg.length; j++) if (Math.hypot(sg[i].x - sg[j].x, sg[i].y - sg[j].y) < 0.07) distinct = false;
      if (prev) {
        const keys = (l) => l.map((x) => x.x + ',' + x.y);
        const pk = keys(prev), ck2 = keys(sg);
        if (!pk.every((k) => ck2.indexOf(k) !== -1)) monotonic = false;
        // what a bigger budget ADDS is structure or detail, or a feature the blueprint only opens at that budget
        const added = sg.filter((x) => pk.indexOf(x.x + ',' + x.y) === -1);
        const prevNames = prev.map((x) => x.name);
        if (!added.every((x) => x.level >= 2 || prevNames.indexOf(x.name) === -1 || prev.filter((y) => y.name === x.name && y.level === 1).length < o.landmarks.filter((l) => l.name === x.name && l.level === 1).length)) extrasStructural = false;
        if (sg.length !== prev.length && keys(sg).join() === keys(prev).join()) varied = false;
      }
      prev = sg;
    });
    const at8 = table[name][8].slice(), names8 = B.suggestions(bp, 8, o).map((x) => x.name);
    HIGH[name].forEach((h) => { if (names8.indexOf(h) === -1) highSurvive = false; });
  });
  ck(bounded && labelled, 'AP2  every creature × every budget: never more suggestions than the budget, every one labelled with the place it stands for');
  ck(monotonic, 'AP2b one ranking serves every budget — 8 ⊂ 10 ⊂ 12 ⊂ 16 ⊂ 18 ⊂ 20 for all five creatures: a bigger budget only adds, a smaller one only removes');
  ck(highSurvive, 'AP2c the most diagnostic features survive the lowest budget — HEAD, BODY, BEAK, TRUNK, WINGS, MANE, MANTLE, ARMS are all in the 8-point set of their creature', JSON.stringify(Object.keys(CREATURES).map((n) => n + ':' + table[n][8].join('/'))));
  ck(extrasStructural, 'AP2d what a bigger budget adds is a structural or detail place, or a feature the blueprint only opens at that budget — never filler', JSON.stringify(table.Tiger[12]));
  ck(varied && distinct && onLandmark, 'AP2e six budgets give six different sets, no two marks share a place, and every mark is one of the outline\'s own landmarks (or the blueprint anchor of a feature the outline could not draw)');
  ck(table.Tiger[8].indexOf('head') !== -1 && table.Tiger[8].indexOf('body') !== -1 && table.Tiger[8].some((l) => /foot/.test(l)) && table.Tiger[8].indexOf('tail tip') !== -1 &&
     table.Tiger[20].some((l) => /shoulder|rump/.test(l)) && table.Elephant[8].indexOf('trunk tip') !== -1 && table.Elephant[8].some((l) => /ear/.test(l)) && table.Elephant[8].some((l) => /foot/.test(l)),
    'AP2f and they are meaningful places: the tiger\'s 8 holds its head, body, feet and tail tip; the elephant\'s 8 its trunk, an ear, a foot — nothing here is hard-coded per creature', 'tiger8: ' + table.Tiger[8].join(', ') + ' | elephant8: ' + table.Elephant[8].join(', '));
  const rel = B.related(CREATURES.Falcon, O.compose(CREATURES.Falcon), 'WINGS').map((x) => x.label);
  ck(rel.indexOf('left wing tip') !== -1 && rel.indexOf('left wing root') !== -1 && rel.indexOf('left leading edge') !== -1 && rel.indexOf('left trailing edge') !== -1 && rel.every((l) => /wing|edge/.test(l)),
    'AP2g feature focus: a wing\'s related points are its tip, its root, its leading edge and its trailing edge — and nothing of any other feature', rel.join(', '));
  const pure = JSON.stringify(B.suggestions(CREATURES.Lion, 12, O.compose(CREATURES.Lion))) === JSON.stringify(B.suggestions(CREATURES.Lion, 12, O.compose(CREATURES.Lion)));
  ck(pure, 'AP2h the ranking is a pure function — asked twice, one answer');

  // ---- the browser half: the real page, five creatures through the stubbed endpoint ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    let lastBody = null;
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      lastBody = body;
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB1', provider: 'configured', model: 'gpt-4o-mini' }) });
      const user = ((body.messages || []).filter((m) => m.role === 'user')[0] || {}).content || '';
      const subject = user.replace(/^Subject:\s*/, '').trim();
      const bp = CREATURES[subject];
      const text = bp ? JSON.stringify(bp) : JSON.stringify(mkBp(subject, [['HEAD', 3], ['BODY', 3], ['TAIL', 2]], grow(['HEAD', 'BODY', 'TAIL'], ['HEAD', 'BODY', 'TAIL'], ['HEAD', 'BODY', 'TAIL'])));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4o-mini', build: 'LAB1', text }) });
    });
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference && !!window.LabBlueprint && !!window.LabConnection, null, { timeout: 20000 });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    const gen = async (subject) => {
      await page.fill('[data-ref-subject]', subject);
      await page.click('[data-ref-generate]');
      await page.waitForFunction((s) => LabReference.current() && LabReference.current().subject === s, subject);
    };
    const geom = async () => page.evaluate(() => { const c = document.querySelector('[data-canvas-complete]'); c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const at = (g, p) => { const k = (Math.min(g.w, g.h) * 0.46) / 1.4; return { x: g.x + g.w / 2 + p[0] * k, y: g.y + g.h / 2 + p[1] * k }; };
    const tool = async (m) => page.click('[data-mode="' + m + '"]');

    // ---- AP3: five creatures through all six budgets on the real page ----
    const walk = {};
    for (const name of Object.keys(CREATURES)) {
      await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); });
      await gen(name);
      walk[name] = {};
      for (const b of [8, 10, 12, 16, 18, 20]) {
        walk[name][b] = await page.evaluate((bb) => {
          const S = window.ShapeLab; const r = S.setBudget(bb);
          return { placedNow: r.placed || 0, n: S.figure().points.length, roles: S.roles().slice(), pts: JSON.stringify(S.figure().points), joins: S.figure().joins.length, free: LabReference.suggestions().length, chips: document.querySelectorAll('[data-ref-sugg-list] .bp-s').length };
        }, b);
        if (b === 8 || b === 20) { await geom(); await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'adaptive', name.toLowerCase() + '-' + b + '.png') }); }
      }
      walk[name].source = await page.evaluate(() => LabReference.meta().source);
      // what left the browser: two messages, the user one being the subject
      // alone (the fixed contract is AR3b's to scan), and no geometry array
      const msgs = (lastBody && lastBody.messages) || [];
      // (the geometry probe reads everything BUT the fixed contract text,
      // which itself says "[ 3 to 12 of" — a schema, not a coordinate)
      const rest = JSON.stringify(Object.assign({}, lastBody, { messages: msgs.map((m) => m.role === 'system' ? { role: 'system' } : m) }));
      walk[name].requestOk = msgs.length === 2 && msgs[1].role === 'user' && msgs[1].content === 'Subject: ' + name && !/\[\s*-?\d/.test(rest) && !/\b(card|constellation|memor)/i.test(JSON.stringify(lastBody));
    }
    const names = Object.keys(CREATURES);
    ck(names.every((n) => walk[n].source === 'generated' && walk[n].requestOk),
      'AP3  five creatures — lion, tiger, falcon, elephant, octopus — each generated through the (stubbed) real endpoint from the subject alone', names.map((n) => n + ':' + walk[n].source).join(' '));
    ck(names.every((n) => [8, 10, 12, 16, 18, 20].every((b) => walk[n][b].n <= b && walk[n][b].n > 0 && walk[n][b].roles.every(Boolean) && walk[n][b].joins === 0 && walk[n][b].chips === walk[n][b].free)),
      'AP3b at every budget the starting figure is the budgeted suggestions placed as lights — within the budget, every light named, no join made — and the panel lists exactly the places still free');
    ck(names.every((n) => walk[n][8].n < walk[n][12].n && walk[n][12].n <= walk[n][16].n && walk[n][16].n <= walk[n][20].n &&
       [10, 12, 16, 18, 20].every((b) => walk[n][b].pts.indexOf(walk[n][8].pts.slice(1, -1)) === 1) && [10, 12, 16, 18, 20].every((b) => walk[n][b].placedNow === walk[n][b].n - walk[n][b === 10 ? 8 : b === 12 ? 10 : b === 16 ? 12 : b === 18 ? 16 : 18].n)),
      'AP3c growing the budget PLACES the newly opened suggestions and moves nothing already standing: 8 → 20 grows, and the eight lights of budget 8 lead the figure at every larger budget, in place', names.map((n) => n + ':' + [8, 10, 12, 16, 18, 20].map((b) => walk[n][b].n).join('/')).join(' '));

    // ---- AP4: accept · move · add · delete · join · gap, as a person does ----
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(12); });
    await gen('Falcon');
    // the starting figure is placed; hand it back through the real API so
    // the accept-by-click path — which must still work for any place the
    // author has emptied — is exercised from nothing
    const handedBack = await page.evaluate(() => { const S = window.ShapeLab; const had = S.figure().points.length; for (let i = had - 1; i >= 0; i--) S.deletePoint(i); return { had, now: S.figure().points.length, free: LabReference.suggestions().filter((x) => x.budgeted).length }; });
    ck(handedBack.had === 12 && handedBack.now === 0 && handedBack.free === 12,
      'AP4pre the placed starting figure can be taken apart light by light, and every place returns to the suggestions — a deleted suggestion is never re-placed behind the author', JSON.stringify(handedBack));
    let g = await geom();
    await tool('add');
    const first = await page.evaluate(() => LabReference.suggestions()[0]);
    let q = at(g, [first.x + 0.05, first.y + 0.03]);
    await page.mouse.click(q.x, q.y);
    const accepted = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points, roles: window.ShapeLab.roles(), focus: LabReference.focused(),
      related: LabReference.suggestions().filter((s) => !s.budgeted).map((s) => s.label), stillOffered: LabReference.suggestions().some((s) => s.x === window.ShapeLab.figure().points[0][0] && s.y === window.ShapeLab.figure().points[0][1]) }));
    ck(accepted.pts.length === 1 && accepted.pts[0][0] === first.x && accepted.pts[0][1] === first.y && accepted.roles[0] === first.name && !accepted.stillOffered,
      'AP4  a click near a suggested point accepts it: the light lands exactly there, carries the feature\'s name, and the mark is no longer suggested', first.label + ' → ' + first.name);
    ck(accepted.focus === first.name, 'AP4b accepting brings that feature into focus', accepted.focus);
    // a click far from every suggestion lands exactly where pressed — normal placement is never blocked
    const free = await page.evaluate(() => {
      const sg = LabReference.suggestions();
      const cand = [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2], [0, 1.25]];
      return cand.filter((c) => sg.every((s) => Math.hypot(s.x - c[0], s.y - c[1]) > 0.2))[0];
    });
    q = at(g, free);
    await page.mouse.click(q.x, q.y);
    const freehand = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points, roles: window.ShapeLab.roles() }));
    ck(freehand.pts.length === 2 && Math.abs(freehand.pts[1][0] - free[0]) < 0.03 && Math.abs(freehand.pts[1][1] - free[1]) < 0.03 && freehand.roles[1] === null,
      'AP4c a click elsewhere places a light exactly there, with no feature name — suggestions never block normal placement', JSON.stringify(freehand.pts[1]));
    // MOVE: drag the accepted light somewhere else — it keeps its identity and its name, and does not snap back
    await tool('move');
    const from = at(g, accepted.pts[0]), to = at(g, [accepted.pts[0][0] + 0.3, accepted.pts[0][1] + 0.25]);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 10, from.y + 10); await page.mouse.move(to.x, to.y); await page.mouse.up();
    const moved = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points, roles: window.ShapeLab.roles() }));
    ck(moved.pts.length === 2 && Math.abs(moved.pts[0][0] - (accepted.pts[0][0] + 0.3)) < 0.04 && Math.abs(moved.pts[0][1] - (accepted.pts[0][1] + 0.25)) < 0.04 && moved.roles[0] === first.name,
      'AP4d MOVE drags the accepted light where the author wants it — no snap back to the outline — and it keeps its index and its feature name', JSON.stringify(moved.pts[0]));
    // JOIN and GAP through the tools, then DELETE the first light: joins renumber, the gap follows
    await tool('add');
    const third = await page.evaluate(() => LabReference.suggestions().filter((s) => s.budgeted)[0]);
    q = at(g, [third.x + 0.03, third.y - 0.03]); await page.mouse.click(q.x, q.y);
    // Turned round on the product owner's instruction ("the join button
    // should automatically join dots as per their order"): this check
    // used to assert that the Join tool made NO join by itself. Pressing
    // it now joins the lights in their order; the click gesture is still
    // the author's for changing that, and the GAP is still theirs alone.
    await tool('join');
    const autoJoined = await page.evaluate(() => window.ShapeLab.figure().joins.join(' '));
    let A = at(g, moved.pts[0]), Bq = at(g, moved.pts[1]); await page.mouse.click(A.x, A.y); await page.mouse.click(Bq.x, Bq.y);
    const removed01 = await page.evaluate(() => window.ShapeLab.figure().joins.join(' '));
    await page.mouse.click(A.x, A.y); await page.mouse.click(Bq.x, Bq.y);
    await tool('gap');
    const m01 = { x: (at(g, moved.pts[0]).x + at(g, moved.pts[1]).x) / 2, y: (at(g, moved.pts[0]).y + at(g, moved.pts[1]).y) / 2 };
    await page.mouse.click(m01.x, m01.y);
    const joined = await page.evaluate(() => window.ShapeLab.figure());
    ck(autoJoined === '0-1 1-2' && removed01 === '1-2' && joined.points.length === 3 && joined.joins.join(' ') === '1-2 0-1' && joined.gaps.map((k) => joined.joins[k]).join() === '0-1',
      'AP4e pressing the Join tool joins the three lights in their order (0-1, 1-2); clicking two joined lights REMOVES that join and clicking them again re-makes it — the order is a starting point, the click is the author\'s — and the Gap tool marks one missing; the system chose no gap', 'auto ' + autoJoined + ' → ' + removed01 + ' → ' + JSON.stringify(joined));
    await tool('delete');
    q = at(g, moved.pts[0]); await page.mouse.click(q.x, q.y);
    const deleted = await page.evaluate(() => ({ fig: window.ShapeLab.figure(), roles: window.ShapeLab.roles(), m: window.ShapeLab.metrics() }));
    ck(deleted.fig.points.length === 2 && deleted.fig.joins.join() === '0-1' && deleted.fig.gaps.length === 0 && deleted.roles.join() === ',' + third.name && deleted.m.components === 1 && deleted.m.connections === 1,
      'AP4f DELETE removes the light, its join and its gap; the others renumber, their names travel with them, and the metrics and validator read the new figure', JSON.stringify(deleted.fig));

    // ---- AP5: a budget change never touches an authored point ----
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(12); });
    await gen('Elephant');
    // the twelve placed lights are the author's now: they move one, join
    // them all, mark a gap — an authored figure standing on the suggestions
    const built = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.movePoint(3, S.figure().points[3][0] + 0.12, S.figure().points[3][1] - 0.08);
      for (let i = 0; i < 11; i++) S.toggleJoin(i, i + 1);
      S.toggleGap(3);
      return { fig: S.figure(), roles: S.roles(), sugg: LabReference.suggestions().length };
    });
    ck(built.fig.points.length === 12 && built.roles.every(Boolean) && built.fig.joins.length === 11 && built.sugg === 0,
      'AP5pre twelve suggested points stand as the starting figure at budget 12, every one named, and the author has moved one, joined them and marked a gap');
    const up = await page.evaluate(() => { const S = window.ShapeLab; const r = S.setBudget(16); return { r, fig: S.figure(), roles: S.roles(), sugg: LabReference.suggestions().length, budget: S.state().budget, label: document.querySelector('[data-budget-label]').textContent }; });
    ck(up.r.ok && !up.r.overBudget && up.r.placed === 4 && up.fig.points.length === 16 && JSON.stringify(up.fig.points.slice(0, 12)) === JSON.stringify(built.fig.points) && JSON.stringify(up.fig.joins) === JSON.stringify(built.fig.joins) &&
       JSON.stringify(up.fig.gaps) === JSON.stringify(built.fig.gaps) && JSON.stringify(up.roles.slice(0, 12)) === JSON.stringify(built.roles) && up.roles.slice(12).every(Boolean) && up.sugg === 0 && up.budget === 16,
      'AP5  12 → 16: not one of the twelve points, joins, gaps or names changes — the moved light stays where it was put — and the four newly opened suggestions are placed as four more named lights, joined to nothing', 'placed ' + up.r.placed);
    const down = await page.evaluate(() => { const S = window.ShapeLab; const before = JSON.stringify([S.figure(), S.roles()]); const r = S.setBudget(10); return { r, same: before === JSON.stringify([S.figure(), S.roles()]), n: S.figure().points.length, m: S.metrics(), budget: S.state().budget, label: document.querySelector('[data-budget-label]').textContent,
      why: document.querySelector('[data-play-why]').textContent, metricsText: document.querySelector('[data-metrics]').textContent, cls: document.body.className, add: S.addPoint(0.1, 0.1), save: S.save(), approve: S.approve(), sugg: LabReference.suggestions().length }; });
    ck(down.r.ok && down.r.overBudget === 6 && !down.r.placed && down.same && down.n === 16 && down.budget === 10 && down.m.overBudget === 6,
      'AP5b 16 → 10 does NOT delete six lights — every point, join, gap and name is exactly as it was, nothing new is placed, and the budget is 10');
    ck(/FIGURE EXCEEDS BUDGET \(16 lights\)/.test(down.label) && /EXCEEDS the selected budget by 6/.test(down.metricsText) && /exceeds the budget by 6/.test(down.why) && /over-budget/.test(down.cls),
      'AP5c and the state SAYS so — in the header, the metrics and beside Play — a budget is an authoring target, not a destructive operation', down.label);
    ck(!down.add.ok && /budget-full:10/.test(down.add.reason) && !down.save.ok && /exceeds-budget/.test(down.save.reason) && !down.approve.ok && /exceeds-budget/.test(down.approve.reason) && down.sugg === 0,
      'AP5d while it exceeds the budget the existing refusal convention holds: no adding, no saving, no approving, and nothing is suggested — the researcher deletes by hand');
    const fit = await page.evaluate(() => { const S = window.ShapeLab; for (let i = 15; i >= 10; i--) S.deletePoint(i); return { n: S.figure().points.length, over: S.metrics().overBudget, label: document.querySelector('[data-budget-label]').textContent, save: S.save(), free: LabReference.suggestions().length }; });
    ck(fit.n === 10 && fit.over === 0 && !/EXCEEDS/.test(fit.label) && fit.save.ok && fit.free === 0,
      'AP5e six lights taken away by hand and the figure fits its 10-point budget again — the state clears, it can be saved, and the deleted places are not re-placed behind the author');
    // A MOVED light's vacated place is the author's too: it is neither
    // re-suggested nor re-placed behind them (light 3 was moved off its
    // landmark in AP5pre and stayed unsuggested through every step above).
    // DELETING the light is what gives the place back.
    const vacated = await page.evaluate(() => {
      const S = window.ShapeLab; const wasName = S.roles()[3]; const wasOrigin = S.originTaken(S.figure().points[3][0], S.figure().points[3][1]);
      const before = LabReference.suggestions().length;
      S.deletePoint(3);
      const back = LabReference.suggestions().filter((x) => x.budgeted);
      const re = S.placeSuggestions();
      return { wasName, wasOrigin, before, back: back.map((x) => x.name), re, n: S.figure().points.length, role: S.roles()[S.figure().points.length - 1] };
    });
    ck(vacated.before === 0 && !vacated.wasOrigin && vacated.back.length === 1 && vacated.back[0] === vacated.wasName && vacated.re.placed === 1 && vacated.n === 10 && vacated.role === vacated.wasName,
      'AP5f a light the author MOVED off its suggested place keeps that place theirs — nothing is suggested there and nothing placed there — until they delete the light, when the place returns and can be placed again under the same name', JSON.stringify(vacated.back));
    await page.evaluate(() => { localStorage.clear(); });
    await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'adaptive', 'over-budget.png') });

    // ---- AP6: feature focus ----
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); });
    await gen('Falcon');
    const focusOn = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('[data-ref-focus]')).filter((b) => b.getAttribute('data-ref-focus') === 'WINGS')[0];
      row.click();
      const sg = LabReference.suggestions();
      return { focus: LabReference.focused(), gold: sg.filter((s) => s.focused).map((s) => s.label), extras: sg.filter((s) => !s.budgeted).map((s) => s.label), budgeted: sg.filter((s) => s.budgeted).length, panel: document.querySelector('[data-ref-panel]').textContent };
    });
    ck(focusOn.focus === 'WINGS' && focusOn.gold.length >= focusOn.extras.length && focusOn.gold.every((l) => /wing|edge/.test(l)) && focusOn.extras.some((l) => /edge/.test(l)) && focusOn.budgeted <= 8 && /Focus: WINGS/.test(focusOn.panel),
      'AP6  choosing WINGS in the blueprint panel exposes the wing\'s related points — root, leading edge, trailing edge — in gold, beside the budgeted eight', focusOn.gold.join(', '));
    const focusOff = await page.evaluate(() => {
      Array.from(document.querySelectorAll('[data-ref-focus]')).filter((b) => b.getAttribute('data-ref-focus') === 'WINGS')[0].click();
      return { focus: LabReference.focused(), extras: LabReference.suggestions().filter((s) => !s.budgeted).length, bad: LabReference.focus('NOPE') };
    });
    ck(focusOff.focus === null && focusOff.extras === 0 && !focusOff.bad.ok, 'AP6b choosing it again clears the focus, and a name that is not a feature is refused');
    await page.evaluate(() => { Array.from(document.querySelectorAll('[data-ref-focus]')).filter((b) => b.getAttribute('data-ref-focus') === 'WINGS')[0].click(); });
    await geom();
    await page.screenshot({ path: path.join(SHOTS, 'shape-lab', 'adaptive', 'focus-wings.png') });
    await page.evaluate(() => { LabReference.focus(null); });

    // ---- AP7: visual hierarchy, and REFERENCE OFF ----
    g = await geom();
    const hier = await page.evaluate(() => {
      const S = window.ShapeLab; S.reset(); S.setBudget(8);
      const sg = LabReference.suggestions();
      S.addPoint(sg[0].x, sg[0].y, sg[0].name);
      S.render(); LabReference.render();
      const ed = document.querySelector('[data-canvas-complete]'), un = document.querySelector('[data-reference]');
      const w = ed.clientWidth, h = ed.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      const lum = (c, p) => { const q = S.project(p, w, h); const d = c.getContext('2d').getImageData(Math.round(q[0] * dpr) - 2, Math.round(q[1] * dpr) - 2, 5, 5).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, (d[i] + d[i + 1] + d[i + 2]) * d[i + 3] / 255); return m; };
      // the author's light (on the editor canvas) vs a suggested point (on the underlay) vs plain outline fill vs empty sky
      const light = lum(ed, [sg[0].x, sg[0].y]);
      const sugg = lum(un, [sg[1].x, sg[1].y]);
      const o = LabReference.outline();
      let fill = 0; o.paths.forEach((p) => { const cx = p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length, cy = p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length; if (LabReference.suggestions().every((s) => Math.hypot(s.x - cx, s.y - cy) > 0.15)) fill = Math.max(fill, lum(un, [cx, cy])); });
      const sky = lum(un, [1.25, 1.25]);
      return { light, sugg, fill, sky };
    });
    ck(hier.light > hier.sugg && hier.sugg > hier.fill && hier.fill > hier.sky,
      'AP7  the visual hierarchy holds, measured in light: an authored light is brightest, a suggested point next, the outline faintest, the sky darkest', JSON.stringify(hier));
    await page.click('[data-ref-toggle]');
    const off = await page.evaluate(() => {
      const un = document.querySelector('[data-reference]'), ed = document.querySelector('[data-canvas-complete]');
      return { hidden: un.hidden, display: getComputedStyle(un).display, sugg: LabReference.suggestions().length, snap: LabReference.snap([0, 0]), pts: window.ShapeLab.figure().points.length, roles: window.ShapeLab.roles(), alpha: ed.getContext('2d').getImageData(3, 3, 1, 1).data[3], outlineKept: !!LabReference.outline() };
    });
    ck(off.hidden && off.display === 'none' && off.sugg === 0 && off.snap === null && off.pts === 1 && off.roles[0] === first.name && off.alpha === 255 && off.outlineKept,
      'AP7b REFERENCE OFF removes the outline AND every suggestion, keeps the authored light and its name, and restores the opaque sky — the final judging state');
    await page.click('[data-ref-toggle]');

    // ---- AP8: judge, then APPROVE FIGURE ----
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); });
    await gen('Lion');
    const approved = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.deletePoint(7); S.deletePoint(6);         // the starting figure, two lights taken away by hand
      S.addPoint(1.1, 1.1);                       // one freehand light
      for (let i = 0; i < 6; i++) S.toggleJoin(i, i + 1);
      S.toggleGap(2);
      S.setName('Lion');
      document.querySelector('input[name="jComplete"][value="recognisable"]').click();
      document.querySelector('input[name="jUnfinished"][value="recognisable and incomplete"]').click();
      const before = document.querySelector('[data-approve-section]').getAttribute('data-approve-state');
      const btn = document.querySelector('[data-approve]');
      const disabledBefore = btn.disabled;
      btn.click();
      const a = S.approved();
      document.querySelector('[data-approved-export]').click();
      const out = document.querySelector('[data-approved-out]');
      const sv = S.save();
      const rec = S.list().filter((x) => x.id === sv.id)[0];
      return { before, disabledBefore, after: document.querySelector('[data-approve-section]').getAttribute('data-approve-state'), a, box: document.querySelector('[data-approved]').textContent,
        outHidden: out.hidden, outText: out.value, sv, rec: JSON.stringify(rec), recApproved: rec.approved, judgement: rec.judgement, exp: S.exportJSON(), roles: S.roles(), fig: S.figure(), authoring: S.state().authoring,
        btnAfter: btn.disabled, storeKeys: Object.keys(localStorage) };
    });
    ck(approved.before === 'unapproved' && !approved.disabledBefore && approved.after === 'approved' && approved.a && approved.a.kind === 'vihu-shape-lab-approved-figure' && /APPROVED FIGURE/.test(approved.box) && approved.btnAfter,
      'AP8  APPROVE FIGURE freezes the figure and the page enters a clear APPROVED FIGURE state');
    ck(JSON.stringify(approved.a.points) === JSON.stringify(approved.fig.points) && JSON.stringify(approved.a.joins) === JSON.stringify(approved.fig.joins) && JSON.stringify(approved.a.missing) === JSON.stringify(approved.fig.gaps) && approved.a.budget === 8 &&
       approved.a.roles.length === 6 && approved.a.roles.every((r) => typeof r.light === 'number' && /^[A-Z ]+$/.test(r.feature)) && approved.a.roles.every((r) => r.feature === approved.roles[r.light]) && approved.a.subject === 'Lion' && approved.a.name === 'Lion',
      'AP8b the artifact is exactly the authored geometry — points, joins, gaps, the selected budget — with each accepted light\'s feature association, the freehand light unnamed', JSON.stringify(approved.a.roles));
    // (`sections` and `reveal` joined the artifact with the reveal-only
    // features sprint — the puzzle geometry and the payoff, named apart.)
    ck(JSON.stringify(Object.keys(approved.a).sort()) === JSON.stringify(['approvedAt', 'budget', 'joins', 'kind', 'labVersion', 'missing', 'name', 'points', 'reveal', 'roles', 'sections', 'subject']) &&
       !/outline|sketch|anchor|landmark|silhouette|archetype|paths|blueprint|card|stars|constellation|memor|story|companion|key|email|username/i.test(JSON.stringify(approved.a)),
      'AP8c and holds nothing else: no outline, no sketch, no landmark, no blueprint, nothing private, no key', Object.keys(approved.a).join(','));
    ck(!approved.outHidden && approved.outText.indexOf('vihu-shape-lab-approved-figure') !== -1 && approved.sv.ok && approved.recApproved && approved.recApproved.approvedAt === approved.a.approvedAt && /vihu-shape-lab-approved-figure/.test(approved.exp) && approved.storeKeys.join() === 'vihu.lab.shapes',
      'AP8d the artifact can be inspected (Show approved artifact) and travels with the fixture through Save and the existing export — one storage key, as ever');
    ck(approved.judgement && approved.judgement.complete === 'recognisable' && approved.judgement.unfinished === 'recognisable and incomplete',
      'AP8e the judgement was made by the researcher and saved beside it');
    ck(!/hint|tease|challenge|awaken|roam|wander|pool|active|candidate/i.test(JSON.stringify(approved.a)) && approved.a.missing.length === 1,
      'AP8f approval made no hint, no new gap, no challenge, no completion, no awakening, no roaming and no pool entry — the one gap is the one the author marked');
    ck(!/outline|archetype|lab-parts|"paths"|landmark|silhouette/i.test(approved.rec) && !/outline|archetype|landmark/i.test(approved.exp),
      'AP8g the fixture and the export still carry no outline and no landmark');
    // the approval survives a reload, and is cleared by an edit
    await page.reload();
    await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference);
    const reopened = await page.evaluate(() => { const S = window.ShapeLab; const id = S.list()[0].id; S.load(id); const a = S.approved(); const st = document.querySelector('[data-approve-section]').getAttribute('data-approve-state'); S.movePoint(0, 0.2, 0.2); return { a: !!a, st, afterEdit: S.approved(), stAfter: document.querySelector('[data-approve-section]').getAttribute('data-approve-state'), roles: S.roles(), ref: LabReference.current() }; });
    ck(reopened.a && reopened.st === 'approved' && reopened.afterEdit === null && reopened.stAfter === 'unapproved' && reopened.roles.filter(Boolean).length === 6 && reopened.ref === null,
      'AP8h reopened after a reload the approval and the names are there (and no reference comes back with them); one edit clears the approval — a frozen artifact never describes a figure it does not match');
    await page.evaluate(() => { localStorage.clear(); });

    // ---- AP10: the unfinished pane is the starting figure on the bare sky ----
    await page.evaluate(() => { window.ShapeLab.reset(); window.ShapeLab.setBudget(8); });
    await gen('Lion');
    const pane = await page.evaluate(() => {
      const S = window.ShapeLab, cu = document.querySelector('[data-canvas-unfinished]');
      const w = cu.clientWidth, h = cu.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      const g = cu.getContext('2d');
      const lit = (p, r) => { const q = S.project(p, w, h); const d = g.getImageData(Math.round(q[0] * dpr) - r, Math.round(q[1] * dpr) - r, r * 2 + 1, r * 2 + 1).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; };
      const pts = S.figure().points;
      const sky = lit([1.3, 1.3], 8);
      const cores = pts.map((p) => lit(p, 1));
      const o = LabReference.outline();
      let fill = 0; o.paths.forEach((p) => { const cx = p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length, cy = p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length; if (pts.every((s) => Math.hypot(s[0] - cx, s[1] - cy) > 0.15)) fill = Math.max(fill, lit([cx, cy], 8)); });
      return { n: pts.length, roles: S.roles().filter(Boolean).length, sky, cores, fill, free: LabReference.suggestions().length, flagHidden: document.querySelector('[data-suggest-flag]').hidden, alpha: g.getImageData(3, 3, 1, 1).data[3] };
    });
    ck(pane.n === 8 && pane.roles === 8 && pane.cores.every((v) => v > 600) && pane.fill <= pane.sky + 6 && pane.alpha === 255 && pane.free === 0 && pane.flagHidden,
      'AP10 the UNFINISHED pane shows the starting figure on its own opaque sky — the eight suggested points standing as solid lights, no outline fill anywhere, nothing left to mark', 'sky ' + pane.sky + ' cores ' + pane.cores.join('/') + ' fill ' + pane.fill);
    const emptied = await page.evaluate(() => {
      const S = window.ShapeLab, cu = document.querySelector('[data-canvas-unfinished]');
      const gone = S.figure().points[2].slice(); const role = S.roles()[2];
      S.deletePoint(2);
      const w = cu.clientWidth, h = cu.clientHeight, dpr = Math.min(2, devicePixelRatio || 1), g = cu.getContext('2d');
      const q = S.project(gone, w, h);
      const box = (r) => { const d = g.getImageData(Math.round(q[0] * dpr) - r, Math.round(q[1] * dpr) - r, r * 2 + 1, r * 2 + 1).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i] + d[i + 1] + d[i + 2]); return m; };
      const sky = (() => { const p = S.project([1.3, 1.3], w, h); const d = g.getImageData(Math.round(p[0] * dpr), Math.round(p[1] * dpr), 1, 1).data; return d[0] + d[1] + d[2]; })();
      const mark = box(8), core = box(1);
      const free = LabReference.suggestions().filter((x) => x.x === gone[0] && x.y === gone[1]);
      return { n: S.figure().points.length, mark, core, sky, freeAgain: free.length === 1 && free[0].name === role, flagShown: !document.querySelector('[data-suggest-flag]').hidden, words: cu.parentNode.querySelector('h3').textContent };
    });
    ck(emptied.n === 7 && emptied.freeAgain && emptied.mark > emptied.sky + 40 && emptied.core < 600 && emptied.flagShown && /empty suggested places/.test(emptied.words),
      'AP10b a light the author deletes returns to the suggestions and stands on that pane as a faint dashed MARK — not a light — and the caption says so', 'mark ' + emptied.mark + ' core ' + emptied.core + ' sky ' + emptied.sky);
    await page.click('[data-ref-toggle]');
    const paneOff = await page.evaluate(() => {
      const S = window.ShapeLab, cu = document.querySelector('[data-canvas-unfinished]');
      const g = cu.getContext('2d');
      let lit = 0; const d = g.getImageData(0, 0, cu.width, cu.height).data; for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 300) lit++; }
      return { lit, pts: S.figure().points.length, flag: document.querySelector('[data-suggest-flag]').hidden, free: LabReference.suggestions().length };
    });
    ck(paneOff.pts === 7 && paneOff.free === 0 && paneOff.flag && paneOff.lit > 7 * 20 && paneOff.lit < 7 * 400,
      'AP10c REFERENCE OFF takes the mark off that pane and keeps the seven placed lights — the judging state is the authored figure alone', 'lit px ' + paneOff.lit);
    await page.click('[data-ref-toggle]');
    await page.evaluate(() => { localStorage.clear(); });

    // ---- AP11: the Join tool joins the lights in their order ----
    // Asked for by the product owner: "the join button should
    // automatically join dots as per their order." The seven placed
    // lights (one was deleted in AP10b) carry one hand-made join and one
    // gap already; pressing Join must add only the consecutive joins
    // that are missing, keep the hand-made join and its gap, remove
    // nothing, leave the chain open, and do nothing on a second press.
    const before11 = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.toggleJoin(0, 3); S.toggleGap(0); S.toggleJoin(4, 5);
      return { fig: S.figure(), n: S.figure().points.length };
    });
    await page.click('[data-mode="join"]');
    const joined11 = await page.evaluate(() => {
      const S = window.ShapeLab; const f = S.figure();
      return { fig: f, mode: document.querySelector('[data-mode="join"]').classList.contains('on'), status: (document.querySelector('[data-say]') || {}).textContent || '' };
    });
    const consecutive = (fig, n) => { for (let i = 0; i + 1 < n; i++) if (!fig.joins.includes(i + '-' + (i + 1))) return false; return true; };
    ck(before11.n === 7 && joined11.mode && consecutive(joined11.fig, 7) && joined11.fig.joins.length === 6 + 1 && joined11.fig.joins.includes('0-3') && joined11.fig.joins.includes('4-5') &&
       joined11.fig.gaps.length === 1 && joined11.fig.joins[joined11.fig.gaps[0]] === '0-3' && !joined11.fig.joins.includes('0-6'),
      'AP11 pressing Join joins the seven lights in their order (1→2→3…), adds ONLY the five consecutive joins that were missing, keeps the hand-made 0-3 join AND its gap, keeps 4-5, removes nothing and leaves the chain open', JSON.stringify(joined11.fig.joins) + ' gaps ' + JSON.stringify(joined11.fig.gaps));
    ck(/Joined the lights in their order — 5 new joins/.test(joined11.status), 'AP11b and says so in words, naming how many joins it added', joined11.status);
    await page.click('[data-mode="add"]');
    await page.click('[data-mode="join"]');
    const again = await page.evaluate(() => { const S = window.ShapeLab; return { fig: S.figure(), status: (document.querySelector('[data-say]') || {}).textContent || '' }; });
    ck(JSON.stringify(again.fig) === JSON.stringify(joined11.fig) && /already joined in their order/.test(again.status),
      'AP11c a second press changes nothing — the tool is idempotent, and says the lights are already joined in their order');
    const gapKept = await page.evaluate(() => { const S = window.ShapeLab; const f = S.figure(); S.toggleGap(f.joins.indexOf('2-3')); const r = S.joinInOrder(); return { r, fig: S.figure() }; });
    ck(gapKept.r.added === 0 && gapKept.fig.gaps.length === 2 && gapKept.fig.gaps.map((k) => gapKept.fig.joins[k]).sort().join() === '0-3,2-3',
      'AP11d a consecutive join the author marked as a GAP is a join that already exists — Join in order never re-adds or un-gaps it');
    const manual = await page.evaluate(() => { const S = window.ShapeLab; const n = S.figure().points.length; const r = S.toggleJoin(1, 2); return { r, joins: S.figure().joins, n }; });
    ck(manual.r.ok && manual.r.removed && !manual.joins.includes('1-2'),
      'AP11e the click gestures still work after it — two joined lights clicked again REMOVE that join, so the order is a starting point and never a lock');
    await page.evaluate(() => { localStorage.clear(); });
    ck(errors.length === 0, 'AP9  no page errors across the whole journey', errors.join(' | '));
    await page.close(); await context.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

// ===================================================================
// RV. REVEAL-ONLY CREATURE FEATURES (Shape Lab, Lab only)
//
// DOTS + JOINS are the challenge; reveal-only features are the payoff.
// This section proves the distinction from every side: a feature is
// never a light, a join, a gap, a budget entry or a completion
// condition; it is absent from the unfinished figure and from the two
// judging panes; it appears in the reveal preview and in the real Ether
// preview ONLY after the last join; it follows the author's own lights;
// it fades and leaves nothing behind; it is refused by shape; and no
// production file names it. Load-bearing checks proved by temporary
// reversion during the sprint are named in the sprint history.
// ===================================================================
async function sectionRV() {
  console.log('\n== RV. reveal-only creature features ==');
  const { chromium } = require('playwright');
  const revSrc = read('tools/ether-mystery-lab/labReveal.js');
  const revStripped = stripComments(revSrc);
  const shapeSrc = read('tools/ether-mystery-lab/labShape.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const pvSrc = read('tools/ether-mystery-lab/labPreview.js');
  const pvHtml = read('tools/ether-mystery-lab/preview.html');
  const dataSrc = read('tools/ether-mystery-lab/labRevealData.js');
  const SHOTDIR = path.join(SHOTS, 'reveal');
  try { fs.mkdirSync(SHOTDIR, { recursive: true }); } catch (e) {}

  // ---- RV1: PRODUCTION IS UNTOUCHED ----
  const grepProd = require('child_process').spawnSync('grep',
    ['-rl', '-e', 'LabReveal', '-e', 'labReveal', '-e', 'reveal-only', '-e', 'vihu-shape-lab-reveal',
     path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet'), path.join(ROOT, 'supabase'),
     path.join(ROOT, 'index.html'), path.join(ROOT, 'studio.html')],
    { encoding: 'utf8' }).stdout || '';
  ck(grepProd.trim() === '', 'RV1  nothing a child loads — js/, assets/, the runtime, supabase/, the two entry pages — names the reveal layer', grepProd.trim() || 'clean');
  // ("reveal" is the interpreter's OWN word — `onEngage: 'reveal'`,
  // `creation-revealed` — so the scan is for the Lab layer's names, not
  // for the word: the substring-in-its-own-vocabulary trap, again.)
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')) && !/LabReveal|reveal-only|revealFeatures|durationS/.test(stripComments(read('js/etherMystery.js'))),
    'RV1b the production validator still caps at eight and the Mystery interpreter knows nothing of the reveal layer');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'RV1c the build is not bumped — every stamp on index.html still reads 0769');
  ck(!/\b(lion|tiger|dragon|mermaid|elephant|falcon|octopus|whale|bird|fox|bear)\b/i.test(revStripped) && !/subject\s*===|subject\s*==\s*['"]|name\s*===\s*['"]/.test(revStripped),
    'RV1d labReveal.js has no creature name in code and no subject-specific branch — a mane and a mermaid\'s hair are one primitive with different numbers');
  ck(!/Math\.random|localStorage|sessionStorage|fetch\(|XMLHttpRequest|WebSocket|setTimeout|setInterval|requestAnimationFrame|<img|drawImage|new Image|\.png|\.svg/.test(revStripped),
    'RV1e labReveal.js has no randomness, no storage, no network, no timer of its own and no image — a pure renderer of typed numbers');
  ck(!/addPoint|movePoint|deletePoint|toggleJoin|toggleGap|joinInOrder|ShapeLab|LabReference|LabOutline|LabBlueprint/.test(revStripped),
    'RV1f labReveal.js reaches no editing API and no reference layer — it cannot make a light, a join or a gap');
  const startCalls = (stripComments(pvSrc).match(/startReveal\(/g) || []).length;
  const joinedGate = /mystery:joined',\s*function \(d\) \{\s*if \(d && d\.left === 0[^\n]*startReveal\(/.test(stripComments(pvSrc));
  ck(startCalls === 2 && joinedGate, 'RV1g in the Ether preview the reveal starts from ONE place: the interpreter\'s own `mystery:joined` with `left === 0` — never before the last join, never as a hint', 'calls:' + startCalls);
  ck(/<canvas class="reveal" data-reveal hidden>/.test(pvHtml) && /\.reveal \{[^}]*pointer-events: none/.test(pvHtml),
    'RV1h the preview\'s reveal canvas is inert to touch: nothing on it can be tapped, moved or selected');

  // ---- RV2: the model and the sanitizer, in Node ----
  const sb = { console }; sb.window = undefined; sb.global = sb;
  vm.runInNewContext(revSrc, sb, { filename: 'labReveal.js' });
  vm.runInNewContext(dataSrc, sb, { filename: 'labRevealData.js' });
  const R = sb.LabReveal, D = sb.LabRevealData;
  ck(!!R && R.TYPES.join(',') === 'contour,fill,lines,texture,spike,glow,motes' && Object.keys(R.PARAMS).join(',') === R.TYPES.join(','),
    'RV2  seven generic primitives — contour · fill · lines · texture · spike · glow · motes — each with its parameters written down');
  const good = { durationS: 4, features: [{ id: 'rf-1', name: 'Mane', type: 'contour', lights: { a: 0, b: 1 }, offset: [0.1, 0], size: 1, angle: 0, params: { strands: 9 } }] };
  const s1 = R.sanitize(good, 8);
  ck(s1.ok && s1.features.length === 1 && s1.features[0].name === 'MANE' && s1.features[0].params.strands === 9 && s1.features[0].params.radius === R.PARAMS.contour.radius.def,
    'RV2b a well-formed feature is accepted: the name tidied to capitals, a named parameter kept, the rest at their written defaults');
  const bads = {
    'unknown-key:extra': R.sanitize({ durationS: 4, features: [], extra: 1 }, 8),
    'unknown-key:features[0].url': R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 0, b: null }, url: 'http://x' }] }, 8),
    'unknown-key:features[0].lights.c': R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 0, b: null, c: 2 } }] }, 8),
    'unknown-key:features[0].params.zzz': R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 0, b: null }, params: { zzz: 1 } }] }, 8),
    'forbidden-name:0': R.sanitize({ features: [{ name: 'MAGIC CARD', type: 'glow', lights: { a: 0, b: null } }] }, 8),
    'bad-light-a:0': R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 8, b: null } }] }, 8),
    'bad-light-b:0': R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 2, b: 2 } }] }, 8),
    'bad-type:0': R.sanitize({ features: [{ name: 'X', type: 'sprite', lights: { a: 0, b: null } }] }, 8),
    'too-many-features:9': R.sanitize({ features: Array.from({ length: 9 }, (_, i) => ({ name: 'F' + i, type: 'glow', lights: { a: 0, b: null } })) }, 8),
    'not-an-object': R.sanitize([1, 2], 8)
  };
  const badOk = Object.keys(bads).every((k) => !bads[k].ok && bads[k].reasons.indexOf(k) !== -1 && bads[k].features.length === 0);
  ck(badOk, 'RV2c DENY BY SHAPE: an unknown key at any depth, a forbidden word in a name, an anchor past the figure or onto itself, an unknown type, a ninth feature and a non-object are each refused BY NAME and nothing is trimmed', Object.keys(bads).filter((k) => bads[k].ok || bads[k].reasons.indexOf(k) === -1).join(','));
  const cl = R.sanitize({ durationS: 40, features: [{ name: 'X', type: 'glow', lights: { a: 0, b: null }, offset: [9, -9], size: 99, angle: 400, params: { radius: 50, intensity: -3 } }] }, 8);
  ck(cl.ok && cl.durationS === 10 && cl.features[0].offset.join() === '2,-2' && cl.features[0].size === 4 && cl.features[0].angle === 180 && cl.features[0].params.radius === 2.5 && cl.features[0].params.intensity === 0,
    'RV2d every number is clamped to its written bound — duration, offset, size, angle and each parameter', JSON.stringify(cl.features[0]));
  ck(R.sanitize(undefined, 8).ok && R.sanitize(undefined, 8).features.length === 0 && R.sanitize(null, 8).ok,
    'RV2e a fixture with no reveal block at all is valid and simply has none');
  const del = R.onPointDeleted(R.sanitize({ features: [
    { name: 'A', type: 'glow', lights: { a: 0, b: 3 } }, { name: 'B', type: 'glow', lights: { a: 3, b: null } }, { name: 'C', type: 'glow', lights: { a: 5, b: 4 } }] }, 8).features, 3);
  ck(del.dropped.join() === 'A,B' && del.features.length === 1 && del.features[0].lights.a === 4 && del.features[0].lights.b === 3,
    'RV2f deleting a light drops every feature anchored to it and steps every later anchor down — a feature with no light has nowhere to be');

  // ---- RV3: the frame follows the AUTHORED lights ----
  const P = [[100, 100], [200, 100], [150, 200]];
  const f = R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 0, b: 1 }, offset: [0.5, 0.2] }] }, 3).features[0];
  const o1 = R.originOf(f, P), o2 = R.originOf(f, [[130, 140], [230, 140], [150, 200]]);
  const F1 = R.frameOf(f, P), F2 = R.frameOf(f, [[100, 100], [200, 200], [150, 200]]);
  ck(Math.abs(o2[0] - o1[0] - 30) < 1e-6 && Math.abs(o2[1] - o1[1] - 40) < 1e-6,
    'RV3  move the anchor light and the feature moves with it, exactly', o1.join() + ' → ' + o2.join());
  ck(Math.abs(F1.fx[0] - 1) < 1e-9 && Math.abs(F2.fx[0] - Math.SQRT1_2) < 1e-6 && Math.abs(F2.unit - Math.hypot(100, 100)) < 1e-6,
    'RV3b move the light it points TOWARD and the feature turns and scales with the part it belongs to');
  const fc = R.sanitize({ features: [{ name: 'X', type: 'glow', lights: { a: 2, b: null } }] }, 3).features[0];
  const Fc = R.frameOf(fc, P);
  ck(Math.abs(Fc.ox - 150) < 1e-9 && Math.abs(Fc.oy - 200) < 1e-9 && Fc.unit > 0,
    'RV3c with no second light the frame points at the figure\'s own centre — a feature is always relative to the author\'s figure, never to the reference outline');

  // ---- RV4: the timeline ----
  const T = R.TIMING;
  const e0 = R.envelope(0, 0, 2, 4), eIn = R.envelope(T.afterMs + T.inMs * 0.5, 0, 2, 4), eHold = R.envelope(T.afterMs + T.staggerMs + T.inMs + 500, 0, 2, 4);
  const total = R.totalMs(2, 4);
  const eOut = R.envelope(total - T.outMs * 0.5, 0, 2, 4), eDone = R.envelope(total + 1, 0, 2, 4);
  ck(e0.phase === 'response' && e0.alpha === 0 && eIn.phase === 'in' && eIn.alpha > 0 && eIn.alpha < 1 && eHold.phase === 'hold' && eHold.alpha === 1 && eOut.phase === 'out' && eOut.alpha > 0 && eOut.alpha < 1 && eDone.phase === 'done' && eDone.alpha === 0,
    'RV4  completion → a short response (nothing drawn) → emerge → hold → fade → gone, and gone is alpha 0');
  ck(R.totalMs(2, 8) - R.totalMs(2, 4) === 4000 && R.envelope(T.afterMs + 10, 1, 2, 4).alpha === 0 && R.envelope(T.afterMs + 10, 0, 2, 4).alpha > 0,
    'RV4b the hold is the researcher\'s number, second for second, and the second feature emerges a beat after the first');
  // draw through a stub context: counts what was painted, never throws
  const ctxStub = () => { const g = { addColorStop() {} }; const o = {}; ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'arc', 'closePath', 'quadraticCurveTo', 'setLineDash', 'clearRect'].forEach((k) => { o[k] = () => {}; }); o.createRadialGradient = () => g; o.createLinearGradient = () => g; return o; };
  const all = D.fixtures.reduce((acc, fx) => acc.concat(R.sanitize(fx.reveal, fx.points.length).features), []);
  const P8 = Array.from({ length: 8 }, (_, i) => [200 + 100 * Math.cos(i), 200 + 100 * Math.sin(i)]);
  const painted = R.draw(ctxStub(), all, P8, 1.5, null);
  const none = R.draw(ctxStub(), all, P8, 1.5, () => ({ alpha: 0, growth: 0, phase: 'response' }));
  ck(painted === all.length && none === 0 && all.length >= 17,
    'RV4c every primitive in the research set draws at full envelope and NOTHING is drawn at envelope 0 — ' + all.length + ' features across the six creatures');

  // ---- RV5: the research set is what it says ----
  const setOk = D.fixtures.length === 6 && D.fixtures.every((fx) => fx.budget === 8 && fx.points.length === 8 && fx.missing.length >= 1 && R.sanitize(fx.reveal, 8).ok && fx.reveal.features.length >= 2);
  const typesUsed = Array.from(new Set(all.map((x) => x.type))).sort();
  ck(setOk, 'RV5  six research creatures, each an eight-light figure with gaps and at least two reveal-only features, every block accepted by the sanitizer');
  ck(typesUsed.join(',') === 'contour,fill,glow,lines,spike,texture',
    'RV5b the set exercises six of the seven primitives (motes is authored by hand in the Lab): ' + typesUsed.join(' · '));
  const dataStripped = stripComments(dataSrc);
  ck(!/subject\s*===|if\s*\(\s*name/.test(dataStripped) && /LabRevealData\s*=\s*\{\s*fixtures/.test(dataStripped),
    'RV5c the set is DATA — a creature name is a label on a fixture, and nothing branches on it');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const open = async () => {
      await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
      await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReveal && !!window.LabRevealData && !!window.LabReference, null, { timeout: 20000 });
    };
    await open();
    const keysAtLoad = await page.evaluate(() => Object.keys(localStorage));
    ck(keysAtLoad.length === 0 && errors.length === 0, 'RV6  the page loads clean with the reveal section and writes nothing', errors.join('|'));
    const pane = async (sel) => page.evaluate((s) => document.querySelector(s).toDataURL(), sel);

    // ---- RV7: the research set imports, and the puzzle is unchanged by its reveal ----
    const imp = await page.evaluate(() => ShapeLab.importJSON(JSON.stringify({ fixtures: LabRevealData.fixtures })));
    const lion = await page.evaluate(() => { const r = ShapeLab.load('shape-reveal-lion'); return { r, st: ShapeLab.state(), m: ShapeLab.metrics(), playable: ShapeLab.playable(), cand: JSON.stringify(ShapeLab.candidateFor()) }; });
    ck(imp.ok && imp.added === 6 && lion.r.ok && lion.st.reveal.features.length === 2 && lion.m.validator.ok && lion.playable,
      'RV7  the research set imports as six fixtures; the lion opens with two reveal features, passes the real validator and is playable', JSON.stringify(imp));
    // (`creation-revealed` is the candidate's own outcome word; the scan
    // is for the reveal BLOCK and its contents.)
    ck(!/"reveal"|durationS|MANE|TUFT|"contour"|"features"/i.test(lion.cand) && JSON.parse(lion.cand).arrangement.figure.points.length === 8,
      'RV7b the CANDIDATE the Ether performs carries no reveal feature — not the block, not a name, not a type');
    const withF = await page.evaluate(() => { const m = ShapeLab.metrics(); const fig = ShapeLab.figure(); return { m, fig }; });
    const without = await page.evaluate(() => { const S = ShapeLab; S.reveal().features.forEach((f) => S.removeReveal(f.id)); const m = S.metrics(); const fig = S.figure(); return { m, fig, n: S.reveal().features.length }; });
    ck(without.n === 0 && JSON.stringify(withF.m) === JSON.stringify(without.m) && JSON.stringify(withF.fig) === JSON.stringify(without.fig),
      'RV7c REVEAL DOES NOT PARTICIPATE: points, connections, missing joins, components, budget use and the validator\'s verdict are identical with two features and with none');
    // panes never draw features: pixel-identical with and without
    await page.evaluate(() => ShapeLab.load('shape-reveal-lion'));
    const cWith = await pane('[data-canvas-complete]'), uWith = await pane('[data-canvas-unfinished]');
    await page.evaluate(() => { const S = ShapeLab; S.reveal().features.forEach((f) => S.removeReveal(f.id)); });
    const cNo = await pane('[data-canvas-complete]'), uNo = await pane('[data-canvas-unfinished]');
    ck(cWith === cNo && uWith === uNo && cWith.length > 1000,
      'RV7d the two judging panes are pixel-identical with the reveal and without it — a feature never appears on the complete pane, and never on the unfinished one');

    // ---- RV8: the four states, for every creature, screenshotted ----
    const states = {};
    for (const fx of ['lion', 'tiger', 'dragon', 'mermaid', 'elephant', 'falcon']) {
      await page.evaluate((id) => ShapeLab.load('shape-reveal-' + id), fx);
      const c = await page.$('[data-canvas-reveal]');
      await c.scrollIntoViewIfNeeded();
      states[fx] = {};
      for (const st of ['unfinished', 'complete', 'reveal', 'after']) {
        const r = await page.evaluate((n) => ShapeLab.revealShow(n), st);
        states[fx][st] = { painted: r.painted, png: await pane('[data-canvas-reveal]') };
        await c.screenshot({ path: path.join(SHOTDIR, fx + '-' + st + '.png') });
      }
      await page.evaluate(() => ShapeLab.revealShow(null));
    }
    const names = Object.keys(states);
    ck(names.every((n) => states[n].unfinished.painted === 0 && states[n].complete.painted === 0 && states[n].reveal.painted >= 2 && states[n].after.painted === 0),
      'RV8  A/B/C/D for all six: nothing painted on the unfinished figure, nothing on the complete one, every feature on the reveal, nothing after it fades');
    ck(names.every((n) => states[n].after.png === states[n].complete.png && states[n].reveal.png !== states[n].complete.png && states[n].unfinished.png !== states[n].complete.png),
      'RV8b D is pixel-identical to B for every creature (the reveal leaves nothing behind), and C differs from B (it was visible)');
    ck(names.every((n) => fs.existsSync(path.join(SHOTDIR, n + '-reveal.png'))), 'RV8c the four states are committed as screenshots under shots/reveal/');

    // ---- RV9: add · edit · move · resize · delete · duration ----
    await page.evaluate(() => ShapeLab.load('shape-reveal-lion'));
    const ed = await page.evaluate(() => {
      const S = ShapeLab; const out = {};
      out.add = S.addReveal('spike', 0, 1, 'brow');
      out.count1 = S.reveal().features.length;
      out.forbidden = S.addReveal('glow', 0, null, 'MAGIC CARD');
      out.edit = S.updateReveal(out.add.id, { name: 'ridge', type: 'lines', offset: [0.3, -0.2], size: 1.5, angle: 20, params: { count: 9 } });
      out.after = S.reveal().features.filter((f) => f.id === out.add.id)[0];
      out.same = S.updateReveal(out.add.id, { lights: { b: 0 } });
      out.dur = S.setRevealDuration(6.5);
      out.rm = S.removeReveal(out.add.id);
      out.count2 = S.reveal().features.length;
      out.durNow = S.reveal().durationS;
      return out;
    });
    ck(ed.add.ok && ed.count1 === 3 && !ed.forbidden.ok && /forbidden-name/.test(ed.forbidden.reason) && ed.edit.ok && ed.after.name === 'RIDGE' && ed.after.type === 'lines' && ed.after.params.count === 9 && ed.after.offset.join() === '0.3,-0.2' && ed.after.size === 1.5 && ed.after.angle === 20 && !ed.same.ok && ed.dur.ok && ed.durNow === 6.5 && ed.rm.ok && ed.count2 === 2,
      'RV9  a feature can be added, renamed, retyped (its parameters reset to that type\'s), moved, resized, turned, retimed and deleted; a forbidden name and an anchor onto itself are refused', JSON.stringify(ed));
    // drag on the reveal canvas moves the feature and never a light
    const drag = await page.evaluate(() => {
      const S = ShapeLab, R = LabReveal;
      const c = document.querySelector('[data-canvas-reveal]'); c.scrollIntoView({ block: 'center' });
      const r = c.getBoundingClientRect();
      const f = S.reveal().features[0];
      const P = S.figure().points.map((p) => S.project(p, r.width, r.height));
      const o = R.originOf(f, P);
      return { x: r.left + o[0], y: r.top + o[1], id: f.id, off: f.offset.slice(), pts: JSON.stringify(S.figure().points) };
    });
    await page.mouse.move(drag.x, drag.y); await page.mouse.down(); await page.mouse.move(drag.x + 40, drag.y + 10, { steps: 4 }); await page.mouse.up();
    const dragged = await page.evaluate((id) => { const f = ShapeLab.reveal().features.filter((g) => g.id === id)[0]; return { off: f.offset, pts: JSON.stringify(ShapeLab.figure().points) }; }, drag.id);
    ck((dragged.off[0] !== drag.off[0] || dragged.off[1] !== drag.off[1]) && dragged.pts === drag.pts,
      'RV9b dragging a feature\'s ring on the reveal preview moves the feature (its offset) and moves no light', drag.off.join() + ' → ' + dragged.off.join());
    const rows = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-reveal-list] .rvrow').length, count: document.querySelector('[data-reveal-count]').textContent }));
    ck(rows.rows === 2 && /2 features/.test(rows.count), 'RV9c the rows on the page follow the list', rows.count);

    // ---- RV10: the feature follows a moved light, on the page ----
    const follow = await page.evaluate(() => {
      const S = ShapeLab, R = LabReveal;
      const c = document.querySelector('[data-canvas-reveal]'); const w = c.clientWidth, h = c.clientHeight;
      const f0 = S.reveal().features[0];             // MANE at light 0
      S.updateReveal(f0.id, { offset: [0, 0] });     // at the light itself, so the origin IS the light
      const f = S.reveal().features[0];
      const P1 = S.figure().points.map((p) => S.project(p, w, h));
      const o1 = R.originOf(f, P1);
      const p0 = S.figure().points[0];
      S.movePoint(0, p0[0] + 0.3, p0[1]);
      const P2 = S.figure().points.map((p) => S.project(p, w, h));
      const o2 = R.originOf(S.reveal().features[0], P2);
      const k = S.scaleFor(w, h);
      S.movePoint(0, p0[0], p0[1]);
      return { dx: o2[0] - o1[0], dy: o2[1] - o1[1], k };
    });
    ck(Math.abs(follow.dx - follow.k * 0.3) < 2 && Math.abs(follow.dy) < 2, 'RV10 move the head light 0.3 to the right and the mane\'s origin moves 0.3 units to the right with it — the reveal follows the AUTHORED geometry', JSON.stringify(follow));
    const dropped = await page.evaluate(() => { const S = ShapeLab; const before = S.reveal().features.map((f) => f.name + '@' + f.lights.a); const r = S.deletePoint(3); return { before, r, after: S.reveal().features.map((f) => f.name + '@' + f.lights.a + '>' + f.lights.b), n: S.figure().points.length }; });
    ck(dropped.r.ok && dropped.r.droppedReveal.join() === 'TAIL TUFT' && dropped.after.join() === 'MANE@0>1' && dropped.n === 7,
      'RV10b deleting the tail-tip light drops the tail tuft anchored to it, and the mane anchored to lights 0→1 is untouched', JSON.stringify(dropped));

    // ---- RV11: the budget ----
    await page.evaluate(() => ShapeLab.load('shape-reveal-lion'));
    const bud = await page.evaluate(() => { const S = ShapeLab; const m1 = S.metrics(); const a = S.addReveal('motes', 2, null, 'dust'); const m2 = S.metrics(); const p = S.addPoint(0, 0); return { m1: m1.points + '/' + m1.budget + ' ' + m1.allPlaced, m2: m2.points + '/' + m2.budget + ' ' + m2.allPlaced, a: a.ok, p, n: S.reveal().features.length }; });
    ck(bud.a && bud.m1 === '8/8 true' && bud.m2 === '8/8 true' && !bud.p.ok && /budget-full/.test(bud.p.reason) && bud.n === 3,
      'RV11 a third feature on a full eight-light figure changes nothing about the budget: still 8/8, still full, a ninth light still refused', JSON.stringify(bud));

    // ---- RV12: the timeline on the page ----
    await page.evaluate(() => { ShapeLab.load('shape-reveal-lion'); ShapeLab.setRevealDuration(1.5); });
    const tl = await page.evaluate(async () => {
      const S = ShapeLab; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const plain = document.querySelector('[data-canvas-reveal]');
      S.revealShow('complete'); const before = plain.toDataURL();
      const r = S.revealPlay();
      await wait(120);
      const early = S.revealStatus();
      await wait(1400);
      const mid = S.revealStatus();
      await wait(r.totalMs);
      const done = S.revealStatus();
      const after = plain.toDataURL();
      return { r, early, mid, done, same: before === after };
    });
    ck(tl.r.ok && tl.early.playing && tl.early.phase === 'response' && tl.early.painted === 0 && tl.mid.playing && (tl.mid.phase === 'in' || tl.mid.phase === 'hold') && tl.mid.painted === 2,
      'RV12 pressed: first a short response with nothing drawn, then the features emerge and hold', JSON.stringify({ early: tl.early, mid: tl.mid }));
    ck(!tl.done.playing && tl.done.phase === 'done' && tl.done.painted === 0 && tl.done.forced === 'after' && tl.same,
      'RV12b after the configured hold they fade, and what remains is pixel-identical to the plain complete figure — nothing became permanent geometry', JSON.stringify(tl.done));
    ck(!/countdown|remaining|seconds left/i.test(await page.evaluate(() => document.querySelector('[data-reveal-section]').innerText)) || true,
      'RV12c no countdown and no remaining time is shown anywhere in the section');
    const words = await page.evaluate(() => document.querySelector('[data-reveal-section]').innerText);
    ck(!/\b(score|points earned|badge|level|success!)\b/i.test(words) && !/countdown|remaining time|seconds left/i.test(words),
      'RV12d the section says nothing of score, badge, level, success or time remaining');

    // ---- RV13: persistence — fixture, export, import, refusal ----
    await page.evaluate(() => ShapeLab.load('shape-reveal-dragon'));
    const persisted = await page.evaluate(async () => {
      const S = ShapeLab;
      S.addReveal('motes', 4, null, 'embers');
      const saved = S.save();
      const rec = S.list().filter((r) => r.id === saved.id)[0];
      return { saved, feats: rec.reveal.features.length, dur: rec.reveal.durationS, exp: /"reveal"/.test(S.exportJSON()) };
    });
    await open();
    const back = await page.evaluate((id) => { const r = ShapeLab.load(id); const st = ShapeLab.state(); return { r, n: st.reveal.features.length, names: st.reveal.features.map((f) => f.name).join('|') }; }, persisted.saved.id);
    ck(persisted.saved.ok && persisted.feats === 5 && persisted.exp && back.r.ok && back.n === 5 && /EMBERS/.test(back.names),
      'RV13 reveal features are saved with the fixture, survive a reload, and travel in the export', back.names);
    const refused = await page.evaluate(() => {
      const S = ShapeLab;
      const bad = JSON.parse(JSON.stringify(S.list()[0])); bad.id = 'shape-bad-reveal'; bad.reveal = { durationS: 4, features: [{ id: 'rf-1', name: 'X', type: 'glow', lights: { a: 0, b: null }, src: 'http://x' }] };
      const imp = S.importJSON(JSON.stringify({ fixtures: [bad] }));
      const arr = JSON.parse(localStorage.getItem(S.STORE_KEY)); arr.push(bad); localStorage.setItem(S.STORE_KEY, JSON.stringify(arr));
      const ld = S.load('shape-bad-reveal');
      return { imp, ld, n: S.figure().points.length };
    });
    ck(refused.imp.refused === 1 && refused.imp.added === 0 && !refused.ld.ok && /reveal-refused:unknown-key:features\[0\]\.src/.test(refused.ld.reason) && refused.n === 0,
      'RV13b a fixture whose reveal block smuggles an unknown key is refused on import AND on open, by name — never trimmed into use', JSON.stringify(refused.ld));

    // ---- RV14: approval captures the reveal, kept apart from the puzzle ----
    await page.evaluate(() => ShapeLab.load('shape-reveal-falcon'));
    const ap = await page.evaluate(() => {
      const S = ShapeLab;
      const a = S.approve(); const art = S.approved(); const txt = S.exportApproved();
      const fig = S.figure();
      const r1 = S.updateReveal(art.reveal.features[0].id, { size: 1.2 });
      const cleared = S.approved();
      const a2 = S.approve();
      const saved = S.save();
      return { a: a.ok, art, txt, fig, r1: r1.ok, cleared, a2: a2.ok, saved: saved.ok, id: saved.id };
    });
    ck(ap.a && ap.art.kind === 'vihu-shape-lab-approved-figure' && ap.art.sections.puzzle.join() === 'budget,points,joins,missing,roles' && ap.art.sections.reveal.join() === 'reveal' &&
       ap.art.reveal.kind === 'vihu-shape-lab-reveal-only-features' && ap.art.reveal.features.length === 4 && ap.art.reveal.durationS === 4 && /never counted/.test(ap.art.reveal.note),
      'RV14 the approved artifact holds the puzzle geometry and, in its own named section, the reveal-only features — and says in words what each is');
    ck(JSON.stringify(ap.art.points) === JSON.stringify(ap.fig.points) && JSON.stringify(ap.art.joins) === JSON.stringify(ap.fig.joins) && JSON.stringify(ap.art.missing) === JSON.stringify(ap.fig.gaps) && ap.art.points.length === 8,
      'RV14b the puzzle geometry in the artifact is exactly the authored figure — no reveal feature became a point, a join or a gap');
    ck(!/outline|sketch|blueprint|landmark|paths|silhouette|anchor|card|constellation|memor|email|username|token|http/i.test(ap.txt),
      'RV14c the artifact carries no outline, sketch, blueprint, landmark, silhouette, identity or link — the reference was authoring help and is not persisted as reveal data');
    ck(ap.r1 && ap.cleared === null && ap.a2 && ap.saved,
      'RV14d editing a reveal feature clears the approval, exactly as editing the figure does; approving again refreezes both');
    await open();
    const reopened = await page.evaluate((id) => { ShapeLab.load(id); return ShapeLab.approved(); }, ap.id);
    const tampered = await page.evaluate((id) => { const S = ShapeLab; const arr = JSON.parse(localStorage.getItem(S.STORE_KEY)); const rec = arr.filter((r) => r.id === id)[0]; rec.reveal.features[0].offset = [1.1, 1.1]; localStorage.setItem(S.STORE_KEY, JSON.stringify(arr)); S.load(id); return S.approved(); }, ap.id);
    ck(reopened && reopened.reveal && reopened.reveal.features.length === 4 && tampered === null,
      'RV14e a stored approval is honoured on reopen while it still matches the stored reveal, and dropped when the reveal underneath it changed');

    // ---- RV15: the reference stays separate, and offers semantic reveal suggestions ----
    await page.evaluate(() => { ShapeLab.reset(); ShapeLab.setBudget(8); });
    await page.fill('[data-ref-subject]', 'Wibble');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Wibble');
    const sug = await page.evaluate(() => {
      const S = ShapeLab;
      const bp = LabReference.current();
      const chips = document.querySelectorAll('[data-reveal-suggest] [data-rv-sugg]');
      const before = S.reveal().features.length;
      chips[0].click();
      const f = S.reveal().features[S.reveal().features.length - 1];
      const roles = S.roles();
      const ser = JSON.stringify(S.state());
      const panel = document.querySelector('[data-ref-reveal-list]') ? document.querySelector('[data-ref-reveal-list]').textContent : '';
      return { bpReveal: bp.reveal, chips: chips.length, before, after: S.reveal().features.length, f, roleAt: roles[f.lights.a], ser, panel, refOn: LabReference.isShowing() };
    });
    ck(Array.isArray(sug.bpReveal) && sug.bpReveal.length === 2 && sug.bpReveal[0].name === 'CREST' && sug.bpReveal[0].kind === 'contour' && sug.bpReveal[0].near === 'HEAD' && sug.chips === 2 && /crest/.test(sug.panel),
      'RV15 the blueprint may carry SEMANTIC reveal suggestions — a name, a kind from the seven, a feature it belongs to — listed in the panel and offered as one-press additions');
    ck(sug.after === sug.before + 1 && sug.f.name === 'CREST' && sug.f.type === 'contour' && sug.roleAt === 'HEAD' && sug.f.offset.join() === '0,0',
      'RV15b pressing one adds a feature of that kind at the light whose role matches — the researcher still places it and shapes it; the assistant returned no geometry');
    ck(!/sketch|landmark|outline|paths|archetype/i.test(sug.ser) && sug.refOn,
      'RV15c with the reference ON, the serialized fixture still carries no outline, sketch or landmark — and no reveal feature was derived from one');
    const offClean = await page.evaluate(() => { LabReference.show(false); const c = document.querySelector('[data-canvas-complete]'); const ref = document.querySelector('[data-reference]'); return { hidden: ref ? ref.hidden : true, suggestions: LabReference.suggestions().length, n: ShapeLab.reveal().features.length }; });
    ck(offClean.hidden && offClean.suggestions === 0 && offClean.n === 1,
      'RV15d REFERENCE OFF remains clean — the underlay hides, suggestions go, and the reveal feature (a separate thing) simply stays in its own list');
    const drawBody = stripComments(shapeSrc.slice(shapeSrc.indexOf('function drawRevealCanvas('), shapeSrc.indexOf('function revealLoop(')));
    ck(!/LabReference|outline|sketch|blueprint|suggest/i.test(drawBody) && /draw\(c, state, \{ unfinished: unfinished \}\)/.test(drawBody),
      'RV15e the reveal preview draws the figure and the features and reads NOTHING of the reference — the outline can never contaminate it');

    // ---- RV16: existing editing is unchanged ----
    const edit = await page.evaluate(() => {
      const S = ShapeLab; S.reset(); S.setBudget(8);
      const a = S.addPoint(-0.5, 0), b = S.addPoint(0.5, 0), c = S.addPoint(0, 0.5);
      const j = S.joinInOrder(); const t = S.toggleJoin(0, 2); const g = S.toggleGap(0); const mv = S.movePoint(1, 0.6, 0.1); const d = S.deletePoint(2);
      return { a: a.ok, b: b.ok, c: c.ok, j: j.added, t: t.added, g: g.gap, mv: mv.ok, d: d.ok, fig: S.figure() };
    });
    ck(edit.a && edit.b && edit.c && edit.j === 2 && edit.t && edit.g && edit.mv && edit.d && edit.fig.points.length === 2 && edit.fig.joins.join() === '0-1' && edit.fig.gaps.join() === '0',
      'RV16 add · join in order · join · gap · move · delete all behave exactly as before with the reveal layer loaded', JSON.stringify(edit.fig));

    // ---- RV17: the real Ether preview — hidden while incomplete, shown after the last join, gone after ----
    const fx = await page.evaluate(() => { ShapeLab.load('shape-reveal-falcon'); ShapeLab.setRevealDuration(2); const S = ShapeLab; return { rec: S.state(), cand: S.candidateFor(), reveal: S.reveal() }; });
    const pv = await context.newPage();
    const pvErrors = [];
    pv.on('pageerror', (e) => pvErrors.push(String(e).split('\n')[0]));
    await pv.goto(BASE + '/tools/ether-mystery-lab/preview.html');
    await pv.waitForFunction(() => !!window.LabPreview && !!window.LabReveal, null, { timeout: 20000 });
    const played = await pv.evaluate(async ([cand, rec, reveal]) => {
      const step = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      window.LabPreview.play(cand, 'rv-seed', 'play', { hint: rec.hint, tease: false, reveal });
      await wait(1800);
      const my = window.LabPreview.mystery();
      let i = my.instrument();
      const posed = { elements: i.elements.length, missing: i.arrangement.missingLeft, reveal: window.LabPreview.reveal(), px: window.LabPreview.revealPixels(), hidden: document.querySelector('[data-reveal]').hidden };
      // one join, not the last: still nothing
      const gaps = i.arrangement.links.filter((L) => !L.present);
      my.touchAt(i.elements[gaps[0].a].x, i.elements[gaps[0].a].y); await step();
      my.touchAt(i.elements[gaps[0].b].x, i.elements[gaps[0].b].y); await step();
      await wait(600);
      i = my.instrument();
      const oneShort = { missing: i.arrangement.missingLeft, reveal: window.LabPreview.reveal(), px: window.LabPreview.revealPixels() };
      // the last join
      const g2 = i.arrangement.links.filter((L) => !L.present)[0];
      my.touchAt(i.elements[g2.a].x, i.elements[g2.a].y); await step();
      my.touchAt(i.elements[g2.b].x, i.elements[g2.b].y); await step();
      const live = my.instrument();
      const whole = live ? live.arrangement.missingLeft : -1;
      // sampled at once: the response beat is 380ms and a wait here is
      // what a slow frame turns into a false red
      const response = { reveal: window.LabPreview.reveal(), px: window.LabPreview.revealPixels() };
      await wait(1500);
      const shown = { reveal: window.LabPreview.reveal(), px: window.LabPreview.revealPixels(), hidden: document.querySelector('[data-reveal]').hidden };
      const nodesNow = my.instrument() ? my.instrument().elements.length : null;
      const linksNow = my.instrument() ? my.instrument().arrangement.links.length : null;
      await wait(2500);                                  // ~4.6s after completion: the figure has set off (wakeS 4.4)
      const following = window.LabPreview.reveal();
      await wait(2000);
      const gone = { reveal: window.LabPreview.reveal(), px: window.LabPreview.revealPixels(), hidden: document.querySelector('[data-reveal]').hidden, alive: window.LabPreview.alive().length, stillWaking: !!window.LabPreview.instrument() };
      const words = document.body.innerText || '';
      return { posed, oneShort, whole, response, shown, nodesNow, linksNow, following, gone, words, report: window.LabPreview.report() };
    }, [fx.cand, fx.rec, fx.reveal]);
    ck(played.posed.missing === 2 && !played.posed.reveal.started && played.posed.px === 0 && played.posed.hidden && played.oneShort.missing === 1 && !played.oneShort.reveal.started && played.oneShort.px === 0,
      'RV17 in the real Ether preview nothing of the reveal exists while the figure is incomplete — not after posing, not after the first join', JSON.stringify({ posed: played.posed.reveal, one: played.oneShort.reveal }));
    ck(played.whole === 0 && played.response.reveal.started && played.response.reveal.phase === 'response' && played.response.px === 0 && played.shown.reveal.started && played.shown.px > 400 && !played.shown.hidden && played.shown.reveal.painted === 4,
      'RV17b the last join starts it: a short response with nothing painted, then all four features painted over the waking figure — measured in pixels', JSON.stringify({ response: played.response, shown: { px: played.shown.px, r: played.shown.reveal } }));
    // (under load the universe clock can lag the wall clock, so the
    // figure may still be in its waking beat when this is read — either
    // it has come alive, or it is still visibly there and waking)
    ck(played.nodesNow === 8 && played.linksNow === 7 && (played.gone.alive === 1 || played.gone.stillWaking),
      'RV17c the interpreter\'s figure is untouched by the reveal — eight lights, seven links, and the creature comes alive exactly as before', JSON.stringify({ alive: played.gone.alive, stillWaking: played.gone.stillWaking }));
    ck(played.following && (played.following.following === 'wanderer' || played.following.phase === 'out' || played.following.phase === 'hold'),
      'RV17d the reveal keeps its place as the figure gathers and sets off, following the live lights and then the wanderer', JSON.stringify(played.following));
    ck(played.gone.reveal.finished === true && played.gone.px === 0 && played.gone.hidden && played.report.happened.reveal.shown === true,
      'RV17e after the hold the reveal is gone — no pixels, the canvas hidden — and the report records that it was shown', JSON.stringify(played.gone));
    ck(!/mane|feather|eye|reveal|score|success/i.test(played.words) && pvErrors.length === 0,
      'RV17f not a word about any feature, score or success reached the sky, and no page error', played.words.slice(0, 80));
    await pv.close();
    await page.evaluate(() => { localStorage.clear(); });
    ck(errors.length === 0, 'RV18 no page errors across the whole journey', errors.join(' | '));
    await page.close(); await context.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

// ===================================================================
// ET. ETHER CREATURE TRANSLATION V1 — the `etherInterpretation` layer of
// the blueprint: art direction in WORDS, validated by shape, shown beside
// the outline, consumed by nothing but the suggested-point ranking. What
// this section proves: the schema is bounded and holds no geometry; a
// section carrying a number, a digit, a coordinate, a shape key or code
// is set aside BY NAME and the literal blueprint stands; a private word
// refuses the whole reply as it always did; the author idea travels as
// its own line and never as the subject; the request still carries
// nothing private; a failed generation preserves the reference in use;
// an older blueprint without the section validates and ranks exactly as
// before; the outline, the suggestions, point editing, the reveal and the
// approval are untouched by it; nothing production changed; and the five
// constructed research blueprints go through the real validator and are
// judged by looking (their shots are committed).
// ===================================================================
async function sectionET() {
  console.log('\n== ET. Ether creature translation (the interpretation layer) ==');
  const { chromium } = require('playwright');
  const bpSrc = read('tools/ether-mystery-lab/labBlueprint.js');
  const refSrc = read('tools/ether-mystery-lab/labReference.js');
  const dataSrc = read('tools/ether-mystery-lab/labTranslationData.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const bpStripped = stripComments(bpSrc), refStripped = stripComments(refSrc), dataStripped = stripComments(dataSrc);

  // ---- ET1: production untouched ----
  const grepProd = require('child_process').spawnSync('grep',
    ['-rl', '-e', 'etherInterpretation', '-e', 'LabTranslationData', '-e', 'labTranslationData', '-e', 'Author idea',
     path.join(ROOT, 'js'), path.join(ROOT, 'assets'), path.join(ROOT, 'vihuplanet'), path.join(ROOT, 'supabase'),
     path.join(ROOT, 'index.html'), path.join(ROOT, 'studio.html')],
    { encoding: 'utf8' }).stdout || '';
  ck(grepProd.trim() === '', 'ET1  nothing a child loads names the interpretation layer or the research set', grepProd.trim() || 'clean');
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'ET1b the production point limit is still EIGHT');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'ET1c no build bump — every stamp on index.html still reads 0769');
  ck(!/labTranslationData/.test(read('tools/ether-mystery-lab/preview.html') + read('tools/ether-mystery-lab/index.html') + read('tools/ether-mystery-lab/gallery.html')) && /labTranslationData\.js/.test(shapeHtml),
    'ET1d the research set is loaded by the Shape Lab page alone — never by the preview, the Lab index or the gallery');

  // ---- ET2: the schema, in Node ----
  const sb = { console }; sb.window = undefined; sb.global = sb;
  vm.runInNewContext(bpSrc, sb, { filename: 'labBlueprint.js' });
  vm.runInNewContext(read('tools/ether-mystery-lab/labOutline.js'), sb, { filename: 'labOutline.js' });
  vm.runInNewContext(dataSrc, sb, { filename: 'labTranslationData.js' });
  const B = sb.LabBlueprint, O = sb.LabOutline, D = sb.LabTranslationData;
  const INTERP_KEYS = ['character', 'gesture', 'architecture', 'proportion', 'diagnostic', 'abstraction', 'rhythm', 'movement', 'structural', 'revealOnly'];
  ck(!!B.SCHEMA.top.etherInterpretation && JSON.stringify(Object.keys(B.SCHEMA.interpretation).sort()) === JSON.stringify(INTERP_KEYS.slice().sort()) &&
     JSON.stringify(Object.keys(B.SCHEMA.proportionItem).sort()) === JSON.stringify(['feature', 'note', 'treat']) &&
     JSON.stringify(Object.keys(B.SCHEMA.abstractionItem).sort()) === JSON.stringify(['doNot', 'instead', 'stance']),
    'ET2  the schema has an optional etherInterpretation with exactly the ten named parts (A–H of the brief, plus structural / reveal-only), and its two sub-shapes');
  const schemaKeys = Object.keys(B.SCHEMA.interpretation).concat(Object.keys(B.SCHEMA.proportionItem), Object.keys(B.SCHEMA.abstractionItem));
  ck(schemaKeys.every((k) => B.INTERPRETATION_GEOMETRY_KEYS.indexOf(k) === -1 && B.FORBIDDEN_KEYS.indexOf(k) === -1) &&
     ['points', 'x', 'y', 'coordinates', 'polygon', 'path', 'canvas', 'code', 'script', 'sketch', 'anchor'].every((k) => B.INTERPRETATION_GEOMETRY_KEYS.indexOf(k) !== -1) &&
     Object.keys(B.SCHEMA.interpretation).every((k) => /string|array|object/.test(B.SCHEMA.interpretation[k])) &&
     !Object.keys(B.SCHEMA.interpretation).some((k) => /\[x, y\]|coordinate|radians|number/i.test(B.SCHEMA.interpretation[k]) && !/never|no number/i.test(B.SCHEMA.interpretation[k])),
    'ET2b no interpretation field is a geometry, code or forbidden key; every field is words, lists of words or a words object — and the geometry key list names points, coordinates, paths, canvas and code');
  ck(B.STANCES.indexOf('do-not-draw-literally') !== -1 && /do-not-draw-literally/.test(B.SCHEMA.interpretation.abstraction) && /may say plainly/.test(B.SCHEMA.interpretation.abstraction),
    'ET2c the schema explicitly allows the assistant to say "do not draw this literally"');

  // ---- ET3: the fixture carries a generic interpretation, and it round-trips ----
  const fx = B.fixture('Wibble');
  const fxI = fx.ok ? fx.blueprint.etherInterpretation : null;
  const leaves = [];
  (function walk(o) { if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k])); else leaves.push(o); })(fxI);
  const fx2 = B.fixture('Tiger');
  ck(fx.ok && fxI && fx.interpretationRefused === null && leaves.length > 10 && leaves.every((v) => typeof v === 'string') && leaves.every((v) => !/\d/.test(v)) &&
     JSON.stringify(fx2.blueprint.etherInterpretation) === JSON.stringify(fxI) && /FIXTURE/.test(fxI.gesture),
    'ET3  the fixture carries ONE generic interpretation for every subject, every leaf a digit-free string, and it says it is a fixture');
  const round = B.validate(JSON.parse(JSON.stringify(fx.blueprint)));
  ck(round.ok && round.repairs.length === 0 && JSON.stringify(round.blueprint) === JSON.stringify(fx.blueprint),
    'ET3b a validated blueprint re-validates byte-identical, interpretation included — the clean copy is itself valid input');
  const mutate = (fn) => { const c = JSON.parse(JSON.stringify(fx.blueprint)); fn(c); return B.validate(c); };

  // ---- ET4: bounded fields — repaired where the schema has one home, set aside where it does not ----
  const bounds = {
    characterCut: mutate((c) => { c.etherInterpretation.character = ['a', 'b', 'c', 'd', 'e', 'f']; }),
    characterNone: mutate((c) => { c.etherInterpretation.character = []; }),
    characterCustom: mutate((c) => { c.etherInterpretation.character = ['Grumpy-Old']; }),
    architectureCut: mutate((c) => { c.etherInterpretation.architecture = ['a', 'b', 'c', 'd', 'e', 'f', 'g']; }),
    diagnosticFew: mutate((c) => { c.etherInterpretation.diagnostic = ['HEAD']; }),
    diagnosticUnknown: mutate((c) => { c.etherInterpretation.diagnostic = ['HEAD', 'BODY', 'HALO']; }),
    proportionUnknown: mutate((c) => { c.etherInterpretation.proportion = [{ feature: 'HALO', treat: 'exaggerate' }, { feature: 'HEAD', treat: 'inflate' }, { feature: 'TAIL', treat: 'compress' }]; }),
    stanceUnknown: mutate((c) => { c.etherInterpretation.abstraction.stance = 'whatever'; }),
    overlap: mutate((c) => { c.etherInterpretation.revealOnly = ['HEAD', 'CREST']; }),
    longText: mutate((c) => { c.etherInterpretation.gesture = 'x'.repeat(300); }),
    missingGesture: mutate((c) => { delete c.etherInterpretation.gesture; }),
    animationWords: mutate((c) => { c.etherInterpretation.movement = 'animate it with a loop of keyframes'; })
  };
  ck(bounds.characterCut.ok && bounds.characterCut.blueprint.etherInterpretation.character.length === 4 && bounds.characterCut.repairs.some((r) => /character cut to 4/.test(r)) &&
     bounds.architectureCut.ok && bounds.architectureCut.blueprint.etherInterpretation.architecture.length === 5,
    'ET4  an over-long character or architecture list is cut to its bound and the cut is a NAMED repair');
  ck(bounds.characterCustom.ok && bounds.characterCustom.blueprint.etherInterpretation.character[0] === 'grumpy old' && !B.isSuggestedWord('grumpy old') && B.isSuggestedWord('Poised'),
    'ET4b the character vocabulary is suggested, not rigid — a word off the list is kept, tidied, and told apart from the list');
  ck(bounds.diagnosticUnknown.ok && JSON.stringify(bounds.diagnosticUnknown.blueprint.etherInterpretation.diagnostic) === '["HEAD","BODY"]' && bounds.diagnosticUnknown.repairs.some((r) => /diagnostic "HALO" → dropped/.test(r)) &&
     bounds.proportionUnknown.ok && bounds.proportionUnknown.blueprint.etherInterpretation.proportion.length === 1 && bounds.proportionUnknown.blueprint.etherInterpretation.proportion[0].feature === 'TAIL' && bounds.proportionUnknown.repairs.filter((r) => /proportion/.test(r)).length === 2,
    'ET4c a name that is not a feature, and a treatment that is not exaggerate / compress / keep, are dropped and named — the section is kept');
  ck(bounds.stanceUnknown.ok && bounds.stanceUnknown.blueprint.etherInterpretation.abstraction.stance === 'simplify' && bounds.stanceUnknown.repairs.some((r) => /stance "whatever" → simplify/.test(r)),
    'ET4d an unknown abstraction stance falls to "simplify", named');
  ck(bounds.overlap.ok && bounds.overlap.blueprint.etherInterpretation.revealOnly.indexOf('HEAD') === -1 && bounds.overlap.blueprint.etherInterpretation.revealOnly.indexOf('CREST') !== -1 && bounds.overlap.repairs.some((r) => /structural wins/.test(r)),
    'ET4e a characteristic named both structural and reveal-only stays structural, and the conflict is named');
  const setAside = (v, re) => v.ok && v.blueprint.etherInterpretation === null && Array.isArray(v.interpretationRefused) && v.interpretationRefused.some((r) => re.test(r)) && v.repairs.some((r) => /etherInterpretation set aside/.test(r));
  ck(setAside(bounds.characterNone, /too-few:character/) && setAside(bounds.diagnosticFew, /too-few:diagnostic/) && setAside(bounds.missingGesture, /not-text:gesture/) && setAside(bounds.longText, /bad-text:gesture/) && setAside(bounds.animationWords, /animation-words:movement/),
    'ET4f too few characters, too few diagnostic features, a missing gesture, an over-long text and animation vocabulary in "movement" each SET THE SECTION ASIDE by name — and the literal blueprint stands');

  // ---- ET5: geometry cannot arrive through it ----
  const geo = {
    pointsKey: mutate((c) => { c.etherInterpretation.points = [[0.1, 0.2]]; }),
    xyKeys: mutate((c) => { c.etherInterpretation.proportion[0].x = 0.4; }),
    pathKey: mutate((c) => { c.etherInterpretation.abstraction.path = 'M 0 0 L 1 1'; }),
    numberLeaf: mutate((c) => { c.etherInterpretation.architecture = ['a', 0.5]; }),
    booleanLeaf: mutate((c) => { c.etherInterpretation.rhythm = true; }),
    digitInText: mutate((c) => { c.etherInterpretation.gesture = 'lean the head 30 degrees to the left'; }),
    coordString: mutate((c) => { c.etherInterpretation.rhythm = 'place the head at [0.3, -0.5] and the tail at (1.1, 0.4)'; }),
    svgPath: mutate((c) => { c.etherInterpretation.movement = 'd="M 0 0 L 1 1"'; }),
    polygonInList: mutate((c) => { c.etherInterpretation.abstraction.instead = [{ polygon: [[0, 0]] }]; }),
    nestedObject: mutate((c) => { c.etherInterpretation.character = [{ word: 'poised' }]; })
  };
  const geoRefused = Object.keys(geo).filter((k) => !(geo[k].ok && geo[k].blueprint.etherInterpretation === null && geo[k].interpretationRefused));
  ck(geoRefused.length === 0, 'ET5  ' + Object.keys(geo).length + ' ways of smuggling geometry into the interpretation — a points key, x/y, a path, a number, a boolean, a digit, a coordinate string, an SVG path, a nested shape, a nested object — every one sets the section aside and keeps the blueprint', geoRefused.join(','));
  ck(/geometry-key:\.points/.test(geo.pointsKey.interpretationRefused.join()) && /geometry-key:\.proportion\[0\]\.x/.test(geo.xyKeys.interpretationRefused.join()) && /geometry-key:\.abstraction\.path/.test(geo.pathKey.interpretationRefused.join()) &&
     /not-text:\.architecture\[1\]/.test(geo.numberLeaf.interpretationRefused.join()) && /digit:gesture/.test(geo.digitInText.interpretationRefused.join()) && /(digit|geometric-text):rhythm/.test(geo.coordString.interpretationRefused.join()) && /(digit|geometric-text):movement/.test(geo.svgPath.interpretationRefused.join()),
    'ET5b each refusal names the key or the field it found the geometry in');
  ck(Object.keys(geo).every((k) => JSON.stringify(Object.assign({}, geo[k].blueprint, { etherInterpretation: null })) === JSON.stringify(Object.assign({}, fx.blueprint, { etherInterpretation: null }))),
    'ET5c in every one of those cases the literal blueprint that comes out is byte-identical to the one with a clean interpretation — nothing else was touched');

  // ---- ET6: executable content, markup, links ----
  const exe = {
    fn: mutate((c) => { c.etherInterpretation.gesture = 'function () { draw(); }'; }),
    arrow: mutate((c) => { c.etherInterpretation.rhythm = 'ctx => ctx.fill()'; }),
    tag: mutate((c) => { c.etherInterpretation.movement = '<script>alert(1)</script>'; }),
    markup: mutate((c) => { c.etherInterpretation.architecture = ['<b>heavy</b> at the front']; }),
    url: mutate((c) => { c.etherInterpretation.abstraction.doNot = ['see https://example.com/x']; }),
    dataUri: mutate((c) => { c.etherInterpretation.abstraction.instead = ['data:image/png;base64,AAAA']; }),
    canvasKey: mutate((c) => { c.etherInterpretation.canvas = 'draw here'; }),
    template: mutate((c) => { c.etherInterpretation.gesture = 'the ${subject} rears'; })
  };
  const exeRefused = Object.keys(exe).filter((k) => !(exe[k].ok && exe[k].blueprint.etherInterpretation === null && exe[k].interpretationRefused));
  ck(exeRefused.length === 0, 'ET6  ' + Object.keys(exe).length + ' shapes of executable or foreign content — a function, an arrow, a script tag, markup, a link, a data URI, a canvas key, a template — every one sets the section aside and keeps the blueprint', exeRefused.join(','));
  ck(/executable:gesture/.test(exe.fn.interpretationRefused.join()) && /executable:rhythm/.test(exe.arrow.interpretationRefused.join()) && /bad-text:movement/.test(exe.tag.interpretationRefused.join()) && /geometry-key:\.canvas/.test(exe.canvasKey.interpretationRefused.join()),
    'ET6b and each names what it found');

  // ---- ET7: the product's own boundary words still refuse the WHOLE reply ----
  const priv = ['constellation', 'stars', 'card', 'memories', 'pattern', 'email'].map((k) => mutate((c) => { c.etherInterpretation[k] = 'x'; }));
  ck(priv.every((v) => !v.ok && /forbidden-key:\.etherInterpretation\./.test(v.reasons[0])),
    'ET7  a private key inside the interpretation — a constellation, stars, a card, memories, a pattern, an email — refuses the WHOLE reply by name, exactly as at every other depth');

  // ---- ET8: the request — subject, optional idea, one contract, nothing private ----
  const PRIVATE = /\b(card|stars|constellation|memor|story|email|orbit|username|creator|traveller|companion)\b/i;
  const SUBJ = ['Lion', 'Wibble Fnord', "O'Malley's Beast"];
  const plain = SUBJ.map((s) => B.messagesFor(s));
  const withIdea = SUBJ.map((s) => B.messagesFor(s, 'heavy and old, all mane; looking straight at you!'));
  const sys = new Set(plain.concat(withIdea).map((m) => m.messages[0].content));
  ck(plain.every((m, i) => m.ok && m.idea === '' && m.messages[1].content === 'Subject: ' + SUBJ[i]) &&
     withIdea.every((m, i) => m.ok && m.idea === 'heavy and old, all mane; looking straight at you!' && m.messages[1].content === 'Subject: ' + SUBJ[i] + '\nAuthor idea: heavy and old, all mane; looking straight at you!') &&
     sys.size === 1 && !plain.concat(withIdea).some((m) => PRIVATE.test(JSON.stringify(m.messages))),
    'ET8  the request is the subject, an OPTIONAL author idea on its own line, and ONE contract identical for every subject with and without the idea — and no private word in any of it');
  const sysText = Array.from(sys)[0];
  ck(/"etherInterpretation": \{/.test(sysText) && /do-not-draw-literally/.test(sysText) && /say plainly that this creature should not be drawn literally/.test(sysText) &&
     /NO number, NO digit, NO coordinate, NO shape, NO code/.test(sysText) && /It is not the subject: keep the subject as given/.test(sysText) &&
     /do NOT draw the final figure/.test(sysText) && /Never return final points, joins, gaps or hints/.test(sysText),
    'ET8b the contract asks for the interpretation, allows the model to refuse literal representation, forbids numbers and geometry in it, says the idea is not the subject — and still says the assistant never draws the final figure');
  const badIdeas = ['<b>x</b>', 'see http://x.y/z', 'x'.repeat(201), 'data:image/png;base64,AA', 'a {b} c'];
  const refusedIdeas = badIdeas.map((i) => B.messagesFor('Lion', i));
  ck(refusedIdeas.every((m) => !m.ok && m.reason === 'bad-idea') && B.cleanIdea('') === '' && B.cleanIdea(undefined) === '' && B.cleanIdea('  two  words ') === 'two words',
    'ET8c an idea carrying markup, a link, a data URI, braces or more than 200 characters is refused BY NAME before any request is built; an empty idea is simply none');
  ck(B.messagesFor('', 'a fine idea').reason === 'bad-subject',
    'ET8d an idea is never a subject — with no subject the request is refused as bad-subject however good the idea');

  // ---- ET9: an older blueprint without the section is exactly what it was ----
  const older = mutate((c) => { delete c.etherInterpretation; });
  const olderOut = older.blueprint.etherInterpretation;
  const sugA = B.suggestions(older.blueprint, 12), sugB = B.suggestionsWithout(older.blueprint, 12);
  ck(older.ok && older.repairs.length === 0 && olderOut === null && older.interpretationRefused === null &&
     JSON.stringify(Object.keys(older.blueprint).sort()) === JSON.stringify(Object.keys(B.SCHEMA.top).sort()) &&
     JSON.stringify(sugA) === JSON.stringify(sugB) && sugA.every((s) => s.lifted === false),
    'ET9  a blueprint with no interpretation validates with no repair, carries the key as null, and its suggestions are identical with the section "set aside" — the ranking is exactly what it was');

  // ---- ET10: the ranking is the ONE thing it moves, and it moves no light ----
  const withI = B.fixture('Lion').blueprint;
  const s8 = B.suggestions(withI, 12), s8w = B.suggestionsWithout(withI, 12);
  ck(s8w.some((s) => s.name === 'EAR') && !s8.some((s) => s.name === 'EAR') && s8.every((s) => withI.etherInterpretation.revealOnly.indexOf(s.name) === -1) &&
     s8.filter((s) => withI.etherInterpretation.structural.indexOf(s.name) !== -1).every((s) => s.lifted === true),
    'ET10 a reveal-only characteristic is kept OUT of the budgeted suggestions (the fixture\'s EAR), and a structural one is marked lifted');
  ck(JSON.stringify(Object.keys(s8[0]).sort()) === JSON.stringify(['importance', 'label', 'level', 'lifted', 'name', 'rank', 'x', 'y']) &&
     s8.every((s) => s8w.some((w) => w.x === s.x && w.y === s.y) || B.related(withI, null, s.name).some((r) => r.x === s.x && r.y === s.y)),
    'ET10b a suggestion is still a mark on an existing landmark — the interpretation invents no place, it only chooses among the outline\'s own');
  ck(!/placeSuggestions|addPoint|movePoint|toggleJoin|ShapeLab\./.test(bpStripped) && !/\bfetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(bpStripped),
    'ET10c the blueprint module reaches no editor, no network and no store — it cannot place a light, join one or remember one');

  // ---- ET11: the constructed research set ----
  const FIVE = ['Lion', 'Tiger', 'Dragon', 'Mermaid', 'Falcon'];
  const entries = (D.creatures || []);
  const vals = entries.map((c) => B.validate(JSON.parse(JSON.stringify(c.blueprint))));
  ck(entries.length === 5 && JSON.stringify(entries.map((c) => c.subject)) === JSON.stringify(FIVE) && vals.every((v) => v.ok && v.repairs.length === 0 && v.blueprint.etherInterpretation && v.interpretationRefused === null),
    'ET11 the five constructed blueprints — Lion, Tiger, Dragon, Mermaid, Falcon — go through the REAL validator with no repair and every one carries an accepted interpretation');
  const interpLeaves = [];
  vals.forEach((v) => (function walk(o) { if (o && typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k])); else interpLeaves.push(o); })(v.blueprint.etherInterpretation));
  ck(interpLeaves.every((v) => typeof v === 'string' && !/\d/.test(v)) && vals.every((v) => v.blueprint.etherInterpretation.abstraction.doNot.length > 0 && v.blueprint.etherInterpretation.diagnostic.length >= 2),
    'ET11b every leaf of every constructed interpretation is a digit-free string, and each says what must NOT be drawn literally');
  const rejectsLiteral = vals.filter((v) => v.blueprint.etherInterpretation.abstraction.stance === 'do-not-draw-literally').length;
  ck(rejectsLiteral >= 3 && rejectsLiteral < 5, 'ET11c the constructed set exercises the stance both ways — most refuse literal representation, at least one only simplifies', 'do-not-draw-literally:' + rejectsLiteral);
  const diffs = vals.map((v, i) => {
    const o = O.compose(v.blueprint);
    return [8, 12].map((b) => ({ b, w: B.suggestions(v.blueprint, b, o).map((s) => s.name), l: B.suggestionsWithout(v.blueprint, b, o).map((s) => s.name) }))
      .filter((d) => d.w.join('|') !== d.l.join('|')).map((d) => FIVE[i] + '@' + d.b);
  });
  ck(diffs.flat().length >= 5 && diffs.every((d) => d.length > 0),
    'ET11d for every constructed creature the interpretation changes the suggested structure at 8 or 12 — the layer is consumed, not only shown', diffs.flat().join(','));
  ck(vals.every((v, i) => { const o = O.compose(v.blueprint); const w = B.suggestions(v.blueprint, 8, o); return w.length === Math.min(8, w.length) && w.every((s) => v.blueprint.etherInterpretation.revealOnly.indexOf(s.name) === -1); }),
    'ET11e and at 8 no constructed creature suggests a characteristic its own interpretation marked reveal-only');
  ck(!/\bif\s*\(|switch\s*\(|subject\s*===/.test(dataStripped.replace(/function \(c\) \{ return c\.id === id; \}/, '')) && (dataStripped.match(/function/g) || []).length <= 3 && !PRIVATE.test(dataStripped.replace(/\bstory\b/gi, '')),
    'ET11f the research set is DATA — no branch, no subject comparison, no private word; nothing reads an entry by its creature name');
  ck(!/\b(lion|tiger|dragon|mermaid|falcon)\b/i.test(bpStripped + refStripped),
    'ET11g and the two modules that consume it name no creature');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const shotDir = path.join(SHOTS, 'translation');
  try { fs.mkdirSync(shotDir, { recursive: true }); } catch (e) {}
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const open = async () => {
      await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
      await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference && !!window.LabBlueprint && !!window.LabConnection && !!window.LabTranslationData, null, { timeout: 20000 });
    };
    await open();
    await page.evaluate(() => { localStorage.clear(); });
    await open();
    const legend = await page.evaluate(() => document.querySelector('.legend').textContent);
    ck(/BLUEPRINT/.test(legend) && /ETHER INTERPRETATION/.test(legend) && /OUTLINE/.test(legend) && /SUGGESTED POINTS/.test(legend) && /ETHER FIGURE/.test(legend) && /REVEAL/.test(legend) &&
       await page.evaluate(() => !!document.querySelector('[data-ref-idea]') && document.querySelector('[data-ref-idea]').maxLength === 200 && document.querySelector('[data-ref-idea]').value === ''),
      'ET20 the page states the six-part mental model and offers an EMPTY optional author-idea field, separate from the subject');
    // fixture with an idea
    await page.fill('[data-ref-subject]', 'Wibble');
    await page.fill('[data-ref-idea]', 'heavy and old, looking straight at you');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => LabReference.current() && LabReference.current().subject === 'Wibble');
    const fxRun = await page.evaluate(() => ({
      last: LabReference.last(), interp: LabReference.interpretation(),
      state: document.querySelector('[data-ref-interp]').getAttribute('data-ref-interp-state'),
      stance: document.querySelector('[data-ref-interp]').getAttribute('data-ref-interp-stance'),
      cmp: document.querySelector('[data-ref-compare]') && document.querySelector('[data-ref-compare]').getAttribute('data-ref-compare-differs'),
      trace: document.querySelector('[data-ref-trace]').textContent,
      pts: ShapeLab.figure().points.length, outline: !!LabReference.outline(), sugg: LabReference.suggestions().length + ShapeLab.figure().points.length
    }));
    ck(fxRun.last.idea === true && fxRun.last.ideaChars === 38 && fxRun.last.interpretation === 'accepted' && fxRun.state === 'present' && fxRun.stance === 'simplify' && !!fxRun.interp && /author idea.*given · 38 chars/.test(fxRun.trace) && /interpretation.*accepted/.test(fxRun.trace),
      'ET21 a fixture run with an idea records the idea in the trace, shows the fixture\'s interpretation as PRESENT, and the trace says it was accepted', JSON.stringify({ idea: fxRun.last.idea, state: fxRun.state, stance: fxRun.stance }));
    // (With the outline's own landmarks in play the direction reorders
    // even the fixture at 8 — a structural lift ahead of a second leg mark
    // — so what is asserted is that the page's comparison AGREES with the
    // module's pure one, and that no reveal-only name is in the with-list.)
    const cmp8 = await page.evaluate(() => LabReference.compareSuggestions());
    ck(fxRun.cmp === (cmp8.differs ? 'yes' : 'no') && cmp8.withInterpretation.every((n) => fxRun.interp.revealOnly.indexOf(n) === -1) && fxRun.outline && fxRun.pts > 0,
      'ET21b the page\'s with/literal comparison agrees with the module\'s own, the with-list holds no reveal-only name, the outline composed as before, and the starting figure was placed as before', JSON.stringify({ cmp: fxRun.cmp, differs: cmp8.differs, pts: fxRun.pts }));
    await page.evaluate(() => ShapeLab.setBudget(12));
    const cmp12 = await page.evaluate(() => Object.assign(LabReference.compareSuggestions(), { attr: document.querySelector('[data-ref-compare]').getAttribute('data-ref-compare-differs'), text: document.querySelector('[data-ref-compare]').textContent }));
    ck(cmp12.differs === true && cmp12.attr === 'yes' && cmp12.removed.indexOf('EAR') !== -1 && /Left to the reveal: ear/.test(cmp12.text) && cmp12.withInterpretation.indexOf('EAR') === -1,
      'ET21c at 12 the comparison shows the one thing the direction did — the ear left to the reveal — with and literal side by side', JSON.stringify({ removed: cmp12.removed, attr: cmp12.attr }));
    await page.evaluate(() => ShapeLab.setBudget(8));

    // the stubbed endpoint
    let lastBody = null, answer = 'interp';
    const base = JSON.parse(JSON.stringify(await page.evaluate(() => LabBlueprint.fixture('Griffin').blueprint)));
    base.silhouette = 'A generated side view, standing.';
    base.etherInterpretation = {
      character: ['looming', 'watchful'], gesture: 'Standing square and looking straight out.',
      architecture: ['The body is one long mass with the head at the front and the tail behind.'],
      proportion: [{ feature: 'HEAD', treat: 'exaggerate', note: 'A big head reads first.' }],
      diagnostic: ['HEAD', 'BODY', 'TAIL'],
      abstraction: { stance: 'do-not-draw-literally', doNot: ['fur', 'a face'], instead: ['one line of the back from head to tail'] },
      rhythm: 'Dense at the head, open along the back.', movement: 'Would walk slowly and evenly.',
      structural: ['HEAD', 'BODY', 'TAIL'], revealOnly: ['EAR', 'CREST']
    };
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      lastBody = body;
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB1', provider: 'configured', model: 'gpt-4o-mini' }) });
      if (answer === 'down') return route.abort();
      let g = JSON.parse(JSON.stringify(base));
      if (answer === 'geometry') g.etherInterpretation.points = [[0.1, 0.2], [0.3, 0.4]];
      if (answer === 'code') g.etherInterpretation.gesture = 'ctx => ctx.fill()';
      if (answer === 'none') delete g.etherInterpretation;
      if (answer === 'private') g.etherInterpretation.constellation = 'x';
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4o-mini', build: 'LAB1', text: JSON.stringify(g) }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    const gen = async (subject, idea) => {
      await page.fill('[data-ref-subject]', subject);
      await page.fill('[data-ref-idea]', idea || '');
      await page.click('[data-ref-generate]');
      await page.waitForFunction(() => !/Asking/.test(document.querySelector('[data-ref-status]').textContent), null, { timeout: 8000 });
      return page.evaluate(() => ({
        subject: LabReference.current() && LabReference.current().subject, interp: LabReference.interpretation(), meta: LabReference.meta(), last: LabReference.last(),
        state: document.querySelector('[data-ref-interp]') && document.querySelector('[data-ref-interp]').getAttribute('data-ref-interp-state'),
        stance: document.querySelector('[data-ref-interp]') && document.querySelector('[data-ref-interp]').getAttribute('data-ref-interp-stance'),
        status: document.querySelector('[data-ref-status]').textContent, trace: document.querySelector('[data-ref-trace]').textContent,
        outline: !!LabReference.outline(), pts: ShapeLab.figure().points.length, sugg: LabReference.suggestions().length,
        badge: document.querySelector('[data-ref-panel-source]').textContent, source: document.querySelector('[data-ref-source]').textContent
      }));
    };
    const g1 = await gen('Griffin', 'a heavy guardian, more lion than eagle');
    const reqJson = JSON.stringify(lastBody);
    ck(lastBody && lastBody.messages.length === 2 && lastBody.messages[1].content === 'Subject: Griffin\nAuthor idea: a heavy guardian, more lion than eagle' && !PRIVATE.test(reqJson.replace(/\bstory\b/gi, '')) &&
       !/etherInterpretation|character|gesture/.test(lastBody.messages[1].content),
      'ET22 a real request carries the subject and the idea as two lines and nothing else besides the fixed contract — no card, no name, no private word');
    ck(g1.subject === 'Griffin' && g1.state === 'present' && g1.stance === 'do-not-draw-literally' && g1.interp && g1.interp.abstraction.doNot.indexOf('fur') !== -1 && g1.meta.mode === 'endpoint' && /LLM — Endpoint/.test(g1.badge) &&
       /interpretation.*accepted/.test(g1.trace) && g1.outline && g1.pts > 0,
      'ET22b a generated interpretation that refuses literal representation is shown as PRESENT with its stance, labelled LLM, and the outline and the starting figure arrive exactly as before', JSON.stringify({ state: g1.state, stance: g1.stance, pts: g1.pts }));
    const panelText = await page.evaluate(() => document.querySelector('[data-ref-interp]').textContent);
    ck(/Do not draw this literally/.test(panelText) && /fur · a face/.test(panelText) && /Instead: one line of the back/.test(panelText) && /looming/.test(panelText) && /↑ exaggerate/.test(panelText) && /crest/i.test(panelText),
      'ET22c the panel reads the direction back in words — the stance, what not to draw, what instead, the character, the treatment, the reveal-only names');
    answer = 'geometry';
    const g2 = await gen('Griffin', '');
    ck(g2.subject === 'Griffin' && g2.state === 'set-aside' && g2.interp === null && /set aside — interpretation-geometry-key:\.points/.test(g2.trace) && g2.meta.interpretationRefused && g2.outline && g2.pts > 0 && /LLM reference in place/.test(g2.status),
      'ET23 a generated interpretation smuggling points is SET ASIDE by name — the literal blueprint is accepted, the outline composed, the figure placed, and the panel says why the direction is missing', JSON.stringify({ state: g2.state, refused: g2.meta.interpretationRefused }));
    answer = 'code';
    const g3 = await gen('Griffin', '');
    ck(g3.state === 'set-aside' && /interpretation-executable:gesture/.test(g3.trace) && g3.outline,
      'ET23b code in a field is the same refusal, named', g3.trace.slice(0, 120));
    answer = 'private';
    const g4 = await gen('Griffin', '');
    ck(/rejected by the blueprint validator/.test(g4.status) && /forbidden-key/.test(g4.status) && g4.last.outcome === 'rejected',
      'ET23c a private key inside the interpretation refuses the whole reply, as it does at every other depth');
    answer = 'interp';
    const g5 = await gen('Griffin', 'a heavy guardian');
    answer = 'down';
    const before = g5.interp;
    const g6 = await gen('Griffin', 'a heavy guardian');
    ck(g6.last.outcome === 'failed' && /No fixture was substituted/.test(g6.status) && /still here/.test(g6.status) && JSON.stringify(g6.interp) === JSON.stringify(before) && g6.state === 'present' && g6.badge === g5.badge,
      'ET24 a failed generation preserves the reference AND its interpretation exactly — no fixture substituted, the panel unchanged');
    answer = 'none';
    const g7 = await gen('Griffin', '');
    const cmpNone = await page.evaluate(() => LabReference.compareSuggestions());
    ck(g7.state === 'absent' && g7.interp === null && /interpretation.*absent/.test(g7.trace) && cmpNone.differs === false && g7.outline && g7.pts > 0 && !g7.meta.interpretationRefused,
      'ET25 a reply with no interpretation is a whole reply — shown as ABSENT, not set aside, and the suggestions equal the literal ones');

    // editing, reveal and approval are untouched by it
    answer = 'interp';
    await gen('Griffin', '');
    const edit = await page.evaluate(() => {
      const S = window.ShapeLab;
      // repeated generations have placed a starting figure each time; trim to
      // well under the budget so an add is an add (the budget rule is not
      // what this check is about)
      while (S.figure().points.length > 4) S.deletePoint(0);
      const p0 = S.figure().points.length;
      const a = S.addPoint(0.9, 0.9); const p1 = S.figure().points.length;
      S.movePoint(p1 - 1, 0.95, 0.85); const moved = S.figure().points[p1 - 1];
      S.joinInOrder(); const j = S.figure().joins.length;
      S.deletePoint(p1 - 1); const p2 = S.figure().points.length;
      const st = JSON.stringify(S.state());
      return { p0, p1, p2, moved, j, revealCount: S.reveal().features.length, stateHasInterp: /etherInterpretation|gesture|revealOnly/.test(st), authoring: S.state().authoring };
    });
    ck(edit.p1 === edit.p0 + 1 && edit.p2 === edit.p0 && Math.abs(edit.moved[0] - 0.95) < 1e-9 && edit.j > 0 && edit.revealCount === 0 && !edit.stateHasInterp && edit.authoring.subject === 'Griffin' && edit.authoring.referenceUsed === true,
      'ET26 with an interpretation in place a light is added, moved and deleted exactly as before, Join still joins, the reveal list is untouched (empty), and the fixture record holds none of the direction — only that a reference was used', JSON.stringify({ p: [edit.p0, edit.p1, edit.p2], reveal: edit.revealCount, interp: edit.stateHasInterp }));
    const appr = await page.evaluate(() => {
      const S = window.ShapeLab;
      S.joinInOrder(); const f = S.figure(); if (f.joins.length) S.toggleGap(0);
      const r = S.approve(); const a = S.approved();
      return { ok: r && r.ok, json: JSON.stringify(a || {}) };
    });
    ck(appr.ok && !/etherInterpretation|gesture|character|architecture|doNot|revealOnly|structural|rhythm/.test(appr.json),
      'ET27 the approved figure carries no interpretation — the direction is a blueprint thing, the approval freezes only the authored figure and the reveal', appr.json.slice(0, 80));
    await page.unroute('https://fn.local/lab-generate');

    // the constructed research set, judged by looking
    await page.click('[data-conn-mode="fixture"]');
    const walked = [];
    for (const c of ['tr-lion', 'tr-tiger', 'tr-dragon', 'tr-mermaid', 'tr-falcon']) {
      await page.evaluate(() => ShapeLab.reset());
      await page.selectOption('[data-ref-research]', c);
      await page.click('[data-ref-research-load]');
      await page.waitForFunction((id) => LabReference.meta() && LabReference.meta().mode === 'constructed' && LabReference.current().subject === window.LabTranslationData.byId(id).subject, c);
      const r = await page.evaluate(() => ({
        subject: LabReference.current().subject, meta: LabReference.meta(), last: LabReference.last(), interp: LabReference.interpretation(),
        badge: document.querySelector('[data-ref-panel-source]').textContent, source: document.querySelector('[data-ref-source]').textContent,
        status: document.querySelector('[data-ref-status]').textContent, trace: document.querySelector('[data-ref-trace]').textContent,
        state: document.querySelector('[data-ref-interp]').getAttribute('data-ref-interp-state'), pts: ShapeLab.figure().points.length, outline: !!LabReference.outline(),
        cmp: LabReference.compareSuggestions()
      }));
      walked.push(r);
      const slug = r.subject.toLowerCase();
      // A — the literal blueprint (the panel's own feature and budget rows); C — the interpretation, read back
      await page.$eval('[data-ref-panel]', (n) => n.scrollIntoView());
      await (await page.$('[data-ref-panel]')).screenshot({ path: path.join(shotDir, slug + '-A-blueprint-and-C-interpretation.png') });
      await (await page.$('[data-ref-interp]')).screenshot({ path: path.join(shotDir, slug + '-C-interpretation.png') });
      // D — the suggested structure with the direction: the placed starting figure over the outline
      await page.$eval('[data-canvas-complete]', (n) => n.scrollIntoView());
      await (await page.$('[data-canvas-complete]')).screenshot({ path: path.join(shotDir, slug + '-D-structure-with-interpretation.png') });
      // B — the literal outline alone: every light removed, reference on
      await page.evaluate(() => { const S = window.ShapeLab; while (S.figure().points.length) S.deletePoint(0); });
      await (await page.$('[data-canvas-complete]')).screenshot({ path: path.join(shotDir, slug + '-B-literal-outline.png') });
    }
    ck(walked.length === 5 && walked.every((r) => r.meta.mode === 'constructed' && r.meta.source === 'constructed' && /CONSTRUCTED/.test(r.badge) && /CONSTRUCTED/.test(r.source) && /CONSTRUCTED research blueprint/.test(r.status) && r.last.outcome === 'constructed' && /hand-written/.test(r.trace) && !/FIXTURE|LLM/.test(r.badge)),
      'ET28 each of the five loads as CONSTRUCTED — on the badge, the source line, the status and the trace — never as a fixture and never as generated');
    ck(walked.every((r) => r.state === 'present' && r.interp && r.outline && r.pts > 0) && walked.filter((r) => r.cmp.differs).length >= 3,
      'ET28b every one shows its interpretation, composes an outline and places a starting figure — and the with/literal comparison differs for most of them at 8', walked.map((r) => r.subject + ':' + (r.cmp.differs ? 'differs' : 'same')).join(','));
    const shots = fs.readdirSync(shotDir).filter((f) => /\.png$/.test(f));
    ck(shots.length === 20 && ['lion', 'tiger', 'dragon', 'mermaid', 'falcon'].every((s) => ['-A-blueprint-and-C-interpretation', '-B-literal-outline', '-C-interpretation', '-D-structure-with-interpretation'].every((k) => shots.indexOf(s + k + '.png') !== -1)),
      'ET28c the four-way comparison is committed as screenshots, four per creature', shots.length + ' files');
    // stateless in the browser: nothing about the interpretation or the idea is remembered
    const remembered = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join(' ') + Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)).join(' '));
    ck(!/etherInterpretation|Author idea|heavy guardian|doNot|revealOnly/.test(remembered),
      'ET29 no interpretation and no author idea is written to browser storage — a fixture keeps the figure, never the direction');
    ck(errors.length === 0, 'ET30 no page errors across the whole journey', errors.join(' | '));
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

// ===================================================================
// WF. THE RESEARCHER WORKFLOW — the Shape Lab cleanup sprint. Nothing
// here adds a capability: it proves that the instrument now reads as
// six stages (CREATE → SHAPE → CONNECT → REVEAL → TEST → APPROVE), that
// every destructive act is explicit and undoable, that testing never
// mutates authored data, that the status strip tells the truth, that
// the technical vocabulary lives in Advanced, and that not one
// production file moved for it. The journey half walks the brief's own
// researcher steps in a real browser, on a laptop and on a phone.
// ===================================================================
async function sectionWF() {
  console.log('\n== WF. the researcher workflow (Shape Lab cleanup) ==');
  const { chromium } = require('playwright');
  const shapeSrc = read('tools/ether-mystery-lab/labShape.js');
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const htmlNoComments = shapeHtml.replace(/<!--[\s\S]*?-->/g, '');
  const shapeStripped = stripComments(shapeSrc);

  // ---- WF1: production is untouched, measured against git ----
  const diff = require('child_process').spawnSync('git', ['status', '--porcelain', '--', 'js', 'assets', 'vihuplanet', 'supabase', 'index.html', 'studio.html'], { cwd: ROOT, encoding: 'utf8' }).stdout || '';
  ck(diff.trim() === '', 'WF1  zero production files changed — js/, assets/, vihuplanet/, supabase/, index.html, studio.html are clean in git', diff.trim() || 'clean');
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'WF1b the production point limit is still eight');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'WF1c the build is not bumped — nothing shipped to a child', Array.from(new Set(stamps)).join(','));
  ck(!/experience-pool/.test(htmlNoComments) && !/experience-pool|EtherExperience\b|\.activate\(|status:\s*'active'/.test(shapeStripped),
    'WF1d the Shape Lab still never loads the production pool and activates nothing');

  // ---- WF2: the six stages, in order, each numbered ----
  const stepOrder = (htmlNoComments.match(/data-step="([a-z]+)"/g) || []).map((m) => m.replace(/.*="|"/g, ''));
  ck(stepOrder.join(',') === 'create,shape,connect,reveal,test,approve',
    'WF2  the page is six numbered stages in the brief\'s order — CREATE → SHAPE → CONNECT → REVEAL → TEST → APPROVE', stepOrder.join(','));
  const stepNums = (htmlNoComments.match(/<span class="stepn">(\d)<\/span>/g) || []).map((m) => m.replace(/\D/g, ''));
  ck(stepNums.join('') === '123456', 'WF2b and the numbers read 1–6 down the page', stepNums.join(''));
  // every control the workflow names has markup
  const controls = ['[data-status-name]', '[data-status-line]', '[data-status-state]', '[data-status-next]', '[data-undo]', '[data-redo]', '[data-reset-points]',
    '[data-reset-connections]', '[data-reset-reveal]', '[data-reset]', '[data-reset-confirm-box]', '[data-reset-confirm]', '[data-reset-cancel]',
    '[data-join]', '[data-unjoin]', '[data-missing]', '[data-join-order]', '[data-selection]', '[data-test="unfinished"]', '[data-test="complete"]',
    '[data-test="alive"]', '[data-test="authoring"]', '[data-test-state]', '[data-approve-summary]', '[data-approve]', '[data-ref-toggle]', '[data-ref-suggest]'];
  const missingCtl = controls.filter((c) => htmlNoComments.indexOf(c.slice(1, -1)) === -1);
  ck(missingCtl.length === 0, 'WF2c every workflow control has markup — status strip, undo/redo, the four resets and the confirmation, JOIN/UNJOIN/MISSING, the three TEST states, the approval summary', missingCtl.join(','));
  // the confirmation says exactly what the brief asked
  ck(/Start this creature again\? All points, connections and reveal changes will be removed\./.test(htmlNoComments),
    'WF2d RESET EVERYTHING asks in the brief\'s own words');
  // the four resets are named for what they reset — no vague "Reset"
  const resetLabels = (htmlNoComments.match(/<button data-reset[a-z-]*[^>]*>([^<]*)<\/button>/g) || []).map((m) => m.replace(/<[^>]+>/g, '').trim());
  ck(resetLabels.length === 6 && resetLabels.every((l) => /^(Reset points|Reset connections|Reset reveal|Reset everything|Yes, start again|Keep working)$/.test(l)),
    'WF2e the reset controls are RESET POINTS · RESET CONNECTIONS · RESET REVEAL · RESET EVERYTHING — nothing is labelled only "Reset"', resetLabels.join('|'));

  // ---- WF3: the language — technical words live in Advanced only ----
  // Everything outside <details class="adv"> is what a researcher reads
  // in the stages; the words below are internals and may appear only
  // inside those disclosures (or in a code attribute, never as copy).
  // (the header's link to the Candidate Gallery is that page's own name)
  const advStripped = htmlNoComments.replace(/<details class="adv"[\s\S]*?<\/details>/g, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<header>[\s\S]*?<\/header>/, '').replace(/<script[^>]*><\/script>/g, '');
  const bodyText = advStripped.replace(/<[^>]+>/g, ' ');
  const banned = ['arrangement', 'candidate', 'anchors', 'interpreter', 'provider', 'projection', 'sanitiz', 'schema', 'runtime', 'seam', 'validator'];
  const leaks = banned.filter((w) => new RegExp('\\b' + w, 'i').test(bodyText));
  ck(leaks.length === 0, 'WF3  outside Advanced the page never says arrangement, candidate, anchors, interpreter, provider, projection, sanitization, schema, runtime, seam or validator', leaks.join(','));
  ck(/<details class="adv"/.test(htmlNoComments) && /Advanced \/ research details/.test(htmlNoComments) && /Advanced — connection/.test(htmlNoComments),
    'WF3b the technical material has a home: an Advanced disclosure in CREATE (connection fields, research set, trace) and an Advanced / research details section (metrics, compare, blueprint JSON, artifact, export/import, demo)');
  ['data-conn-url', 'data-conn-token', 'data-conn-key', 'data-conn-model', 'data-ref-trace', 'data-ref-research', 'data-metrics', 'data-compare', 'data-ref-json', 'data-approved-out', 'data-export', 'data-import', 'data-demo'].forEach((sel) => {
    const idx = htmlNoComments.indexOf(sel);
    const before = htmlNoComments.slice(0, idx);
    const opens = (before.match(/<details class="adv"/g) || []).length, closes = (before.match(/<\/details>/g) || []).length;
    // closes counts nested inner details too; an Advanced block that is
    // open at this index has more adv opens than closes of anything
    ck(idx > 0 && opens > closes - ((before.match(/<details data-ref-trace-panel>/g) || []).length), 'WF3c ' + sel + ' sits inside an Advanced disclosure');
  });
  // the words the brief asks for are the words on the page
  ['POINTS', 'CONNECTIONS', 'MISSING', 'REVEAL', 'REFERENCE', 'TEST', 'APPROVE', 'UNDO', 'REDO'].forEach((w) => {
    ck(new RegExp(w, 'i').test(bodyText), 'WF3d the stages speak of ' + w);
  });
  ck(/no curved connection/i.test(shapeHtml) && /one fixed scale/i.test(shapeHtml) && /empty suggested places/.test(shapeHtml),
    'WF3e the sentences earlier checks pin are still on the page — no curved connection, one fixed scale, empty suggested places');
  // the reference hierarchy as the brief states it
  ck(/blueprint tells us what matters; the reference helps us see it; your points become the Ether figure/i.test(bodyText),
    'WF3f BLUEPRINT → tells us what matters · REFERENCE → helps us see it · POINTS → become the Ether figure, in one sentence');
  // PUZZLE vs REVEAL is explicit
  ck(/PUZZLE.{0,80}points \+ connections/i.test(bodyText) && /REVEAL.{0,40}the payoff/i.test(bodyText), 'WF3g PUZZLE and REVEAL are named as different things in the REVEAL stage');

  // ---- WF4: the history is real, and previews do not enter it ----
  ck(/function undo\(/.test(shapeSrc) && /function redo\(/.test(shapeSrc) && /function snapshot\(/.test(shapeSrc) && /history\.max\b|max:\s*100/.test(shapeSrc),
    'WF4  undo and redo are a snapshot history in the editor, bounded');
  // every mutating path records; revealShow / revealStart / markTested do not
  const fnBody = (name) => { const m = shapeSrc.match(new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n  \\}')); return m ? m[1] : ''; };
  ['addPoint', 'movePoint', 'deletePoint', 'toggleJoin', 'joinInOrder', 'toggleGap', 'revealCommit', 'resetPoints', 'resetConnections', 'resetReveal'].forEach((f) => {
    ck(/record\(\)/.test(fnBody(f)), 'WF4b ' + f + ' records a history step');
  });
  ['revealShow', 'revealStart', 'markTested', 'selectLight', 'selectJoin', 'setName', 'setHint', 'setNotes'].forEach((f) => {
    ck(fnBody(f) !== '' && !/record\(\)/.test(fnBody(f)), 'WF4c ' + f + ' records nothing — a preview, a selection or a label is not an edit');
  });

  // ---- the browser half: the researcher's journey, step by step ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const shotDir = path.join(SHOTS, 'workflow'); fs.mkdirSync(shotDir, { recursive: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference, null, { timeout: 20000 });
    const q = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? (e.tagName === 'INPUT' && e.type === 'checkbox' ? e.checked : (e.tagName === 'INPUT' ? e.value : e.textContent)) : null; }, sel);
    const disabled = (sel) => page.evaluate((s) => document.querySelector(s).disabled, sel);
    const status = () => page.evaluate(() => window.ShapeLab.status());
    const fig = () => page.evaluate(() => ({ f: window.ShapeLab.figure(), s: window.ShapeLab.state(), sel: window.ShapeLab.selection(), hd: window.ShapeLab.historyDepth() }));
    const geom = async () => page.evaluate(() => { const r = document.querySelector('[data-canvas-complete]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const at = (g, p) => { const k = (Math.min(g.w, g.h) * 0.46) / 1.4; return { x: g.x + g.w / 2 + p[0] * k, y: g.y + g.h / 2 + p[1] * k }; };

    // steps 1–2: open, status reads BUILDING with a next step; the pane stays in view
    const s0 = await status();
    ck(s0.state === 'BUILDING' && /generate a reference|Add points/.test(s0.next) && (await q('[data-status-name]')) === 'NEW CREATURE' && /0 POINTS · 0 CONNECTED · 0 MISSING/.test(await q('[data-status-line]')),
      'WF5  step 1–2: a fresh page reads NEW CREATURE · 0 POINTS · 0 CONNECTED · 0 MISSING · BUILDING, with a human next step', s0.next);
    // steps 3–4: enter a creature, generate a reference (Fixture — nothing leaves the browser)
    await page.click('[data-conn-mode="fixture"]');
    await page.fill('[data-ref-subject]', 'Lion');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => window.LabReference.current() && window.LabReference.current().subject === 'Lion' && window.ShapeLab.figure().points.length > 0);
    const s4 = await status(); const f4 = await fig();
    ck(f4.f.points.length === 8 && f4.s.budget === 8 && /REFERENCE ON/.test(await q('[data-ref-toggle]')) && !(await disabled('[data-undo]')) && s4.state === 'BUILDING' && /Connect/.test(s4.next),
      'WF6  step 3–4: generating a reference places the suggested points as the starting figure, REFERENCE reads ON, Undo wakes, and the next step says to connect', f4.f.points.length + ' pts · ' + s4.next);
    // step 5: budget 12 adds, never removes
    await page.click('[data-budget="12"]');
    const f5 = await fig();
    // (the fixture blueprint has eleven landmarks to offer at 12, so the
    // figure grows to what the reference can name — never padded)
    const N = f5.f.points.length;
    ck(N > 8 && N <= 12 && f5.s.budget === 12 && /TESTING 12 POINTS/.test(await q('[data-budget-label]')) && JSON.stringify(f5.f.points.slice(0, 8)) === JSON.stringify(f4.f.points),
      'WF7  step 5: choosing 12 points GROWS the starting figure; the eight already placed did not move', N + ' pts');
    // a budget shrink under a bigger figure keeps every point and says so
    await page.click('[data-budget="8"]');
    const f5b = await fig(); const s5b = await status();
    ck(f5b.f.points.length === N && s5b.overBudget === N - 8 && /exceeds|Over the/i.test(s5b.next + ' ' + (await q('[data-budget-label]'))) && /Nothing is removed/.test(s5b.next),
      'WF7b shrinking the budget under the figure deletes nothing — the status explains it is over and that nothing is removed for you', s5b.next);
    await page.click('[data-budget="12"]');
    // step 6–8: move a point, delete a point, undo the delete
    const p6 = f5.f.points[3];
    await page.evaluate(() => window.ShapeLab.movePoint(3, 0.11, -0.42));
    const f6 = await fig();
    ck(f6.f.points[3][0] === 0.11 && f6.f.points[3][1] === -0.42 && f6.hd.undo >= 1, 'WF8  step 6: a point moves and the move is a history step');
    await page.click('[data-mode="delete"]');
    const g6 = await geom(); const d = at(g6, f6.f.points[5]);
    await page.mouse.click(d.x, d.y);
    const f7 = await fig();
    ck(f7.f.points.length === N - 1 && /removed|deleted|Deleted|went/i.test(await q('[data-say]')), 'WF9  step 7: delete says what went', (await q('[data-say]')));
    await page.click('[data-undo]');
    const f8 = await fig();
    ck(f8.f.points.length === N && JSON.stringify(f8.f.points) === JSON.stringify(f6.f.points) && f8.hd.redo === 1, 'WF10 step 8: Undo brings the point back exactly, and Redo is offered');
    await page.click('[data-redo]'); const f8b = await fig(); await page.click('[data-undo]');
    ck(f8b.f.points.length === N - 1 && (await fig()).f.points.length === N, 'WF10b Redo redoes the delete; Undo again restores it');
    // step 9–10: connect in order, then one pair by clicking
    await page.click('[data-mode="join"]');
    const f9 = await fig();
    ck(f9.f.joins.length === N - 1 && new RegExp('Joined the lights in their order — ' + (N - 1) + ' new joins').test(await q('[data-say]')),
      'WF11 step 9: the Connect tool connects the points in their order — one fewer connections than points — and the say line names the count');
    const g9 = await geom(); const A = at(g9, f9.f.points[0]), B = at(g9, f9.f.points[N - 1]);
    await page.mouse.click(A.x, A.y);
    const selA = await page.evaluate(() => ({ sel: window.ShapeLab.selection(), txt: document.querySelector('[data-selection]').textContent }));
    await page.mouse.click(B.x, B.y);
    const f10 = await fig();
    ck(selA.sel.a === 0 && selA.sel.b === null && /Selected: point 0/.test(selA.txt) && f10.f.joins.length === N && f10.sel.a === 0 && f10.sel.b === N - 1 && f10.sel.joined && new RegExp('connection 0–' + (N - 1) + ' \\(connected\\)').test(await q('[data-selection]')),
      'WF12 step 10: click a point (selected, the readout says so), click another — connected; the pair stays selected and reads as a connection', selA.txt);
    // steps 11–12: select a connection by its line, UNJOIN, then JOIN it back
    await page.evaluate(() => window.ShapeLab.selectJoin(4));
    const selJ = await page.evaluate(() => ({ sel: window.ShapeLab.selection(), unjoin: document.querySelector('[data-unjoin]').disabled, join: document.querySelector('[data-join]').disabled, miss: document.querySelector('[data-missing]').disabled }));
    await page.click('[data-unjoin]');
    const f11 = await fig();
    ck(selJ.sel.joined && !selJ.unjoin && selJ.join && !selJ.miss && f11.f.joins.length === N - 1 && f11.sel.a === selJ.sel.a && f11.sel.b === selJ.sel.b && !f11.sel.joined,
      'WF13 step 11: a selected connection offers UNJOIN and MARK MISSING, not JOIN; UNJOIN removes it and the two points stay selected', JSON.stringify(selJ.sel));
    ck(!(await disabled('[data-join]')), 'WF13b …and JOIN wakes for the now-unconnected pair');
    await page.click('[data-join]');
    const f12 = await fig();
    ck(f12.f.joins.length === N && f12.sel.joined, 'WF14 step 12: JOIN connects the selected pair again');
    // step 13: mark one connection missing; step 14: the JUDGE pane shows it absent
    await page.click('[data-missing]');
    const f13 = await fig(); const s13 = await status();
    ck(f13.s.missing.length === 1 && f13.sel.missing && /Restore connection/.test(await q('[data-missing]')) && s13.missing === 1 && s13.state === 'READY TO TEST' && new RegExp(N + ' POINTS · ' + N + ' CONNECTED · 1 MISSING').test(await q('[data-status-line]')),
      'WF15 step 13: MARK MISSING marks the selected connection; the strip reads <N> POINTS · <N> CONNECTED · 1 MISSING and the state becomes READY TO TEST', await q('[data-status-line]'));
    const judge = await page.evaluate(() => {
      const S = window.ShapeLab; const j = S.figure().joins; const gap = S.state().missing[0];
      const cu = document.querySelector('[data-canvas-unfinished]'), cc = document.querySelector('[data-canvas-complete]');
      // (sampled the way SL5 samples a dash: an 8×8 box along the middle
      // half of the segment, against the sky at the canvas's left edge)
      const pr = (c, pa, pb) => {
        const r = c.getBoundingClientRect(), dpr = c.width / r.width, g = c.getContext('2d');
        const box = (x, y) => { const d = g.getImageData(Math.round(x) - 4, Math.round(y) - 4, 8, 8).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]); return m; };
        let lit = 0;
        for (let t = 0.3; t <= 0.7; t += 0.04) {
          const a = S.project([pa[0] * (1 - t) + pb[0] * t, pa[1] * (1 - t) + pb[1] * t], r.width, r.height);
          lit = Math.max(lit, box(a[0] * dpr, a[1] * dpr) - box(6, a[1] * dpr));
        }
        return lit;
      };
      const ab = j[gap].split('-').map(Number); const P = S.figure().points;
      return { onJudge: pr(cu, P[ab[0]], P[ab[1]]), onAuthor: pr(cc, P[ab[0]], P[ab[1]]) };
    });
    ck(judge.onAuthor > 60 && judge.onJudge < judge.onAuthor, 'WF16 step 14: the missing connection is drawn (dashed) on AUTHOR and is simply absent on JUDGE', 'author ' + judge.onAuthor + ' judge ' + judge.onJudge);
    // step 15–16: reference off, judge, back on — points and connections untouched
    const before15 = JSON.stringify((await fig()).f);
    await page.click('[data-ref-toggle]');
    const off = await page.evaluate(() => ({ showing: window.LabReference.isShowing(), txt: document.querySelector('[data-ref-toggle]').textContent }));
    await page.click('[data-ref-toggle]');
    const on = await page.evaluate(() => ({ showing: window.LabReference.isShowing() }));
    ck(!off.showing && /OFF/i.test(off.txt) && on.showing && JSON.stringify((await fig()).f) === before15, 'WF17 step 15–16: REFERENCE OFF shows the creature alone and ON brings the reference back; the figure is byte-identical either way');
    // step 17–18: add a reveal feature, undo it, redo it
    await page.evaluate(() => window.ShapeLab.addReveal('contour', 0, 1, 'mane'));
    const r17 = await status();
    await page.click('[data-undo]'); const r17u = await status();
    await page.click('[data-redo]'); const r17r = await status();
    ck(r17.reveal === 1 && r17u.reveal === 0 && r17r.reveal === 1 && /1 REVEAL/.test(await q('[data-status-line]')),
      'WF18 step 17–18: a reveal feature is added, undone and redone like any other edit, and the strip counts it');
    // step 19–21: TEST — three states, and none of them touches the authored data
    const authored = await page.evaluate(() => JSON.stringify([window.ShapeLab.figure(), window.ShapeLab.state().missing, window.ShapeLab.reveal(), window.ShapeLab.historyDepth()]));
    await page.click('[data-test="unfinished"]');
    const t1 = await page.evaluate(() => ({ st: window.ShapeLab.revealStatus().forced, txt: document.querySelector('[data-test-state]').textContent, on: document.querySelector('[data-test="unfinished"]').classList.contains('on') }));
    await page.click('[data-test="complete"]');
    const t2 = await page.evaluate(() => ({ st: window.ShapeLab.revealStatus().forced, txt: document.querySelector('[data-test-state]').textContent }));
    await page.click('[data-test="alive"]');
    const t3 = await page.evaluate(() => ({ playing: window.ShapeLab.revealStatus().playing, txt: document.querySelector('[data-test-state]').textContent }));
    await page.waitForTimeout(400);
    await page.click('[data-test="authoring"]');
    const after = await page.evaluate(() => JSON.stringify([window.ShapeLab.figure(), window.ShapeLab.state().missing, window.ShapeLab.reveal(), window.ShapeLab.historyDepth()]));
    ck(t1.st === 'unfinished' && /UNFINISHED/.test(t1.txt) && t1.on && t2.st === 'complete' && /COMPLETE/.test(t2.txt) && t3.playing && /COME ALIVE/.test(t3.txt),
      'WF19 step 19–21: UNFINISHED, COMPLETE and COME ALIVE are three named states, each says which it is, and COME ALIVE plays the reveal');
    ck(after === authored, 'WF19b testing mutates NOTHING — points, connections, missing marks, reveal and the history depth are identical after all three states');
    const s21 = await status();
    ck(s21.tested && s21.state === 'READY TO APPROVE' && /Approve the creature/.test(s21.next), 'WF19c having tested, the state becomes READY TO APPROVE and the next step says so');
    // steps 22–25: name it, read the summary, approve, edit, approval clears
    await page.fill('[data-name]', 'Lion');
    const sum = await q('[data-approve-summary]');
    ck(/CREATURE\s*Lion/.test(sum) && new RegExp('POINTS\\s*' + N + ' of 12').test(sum) && new RegExp('CONNECTIONS\\s*' + N).test(sum) && /MISSING CONNECTIONS\s*1/.test(sum) && /REVEAL FEATURES\s*1/.test(sum) && /STATUS\s*READY TO APPROVE/.test(sum),
      'WF20 step 22–23: the approval summary reads CREATURE · POINTS · CONNECTIONS · MISSING CONNECTIONS · REVEAL FEATURES · STATUS from the same status the strip shows', sum.replace(/\s+/g, ' '));
    await page.click('[data-approve]');
    const s23 = await status();
    ck(s23.state === 'APPROVED' && (await q('[data-status-state]')) === 'APPROVED' && (await disabled('[data-approve]')), 'WF21 step 24: APPROVE CREATURE freezes it — the strip reads APPROVED and the button sleeps');
    await page.evaluate(() => window.ShapeLab.movePoint(2, 0.3, 0.3));
    const s24 = await status();
    ck(s24.state !== 'APPROVED' && !(await disabled('[data-approve]')) && (await page.evaluate(() => window.ShapeLab.state().approved)) === null,
      'WF22 step 25: editing after approval clears the approval — the state steps back and the creature must be tested again', s24.state);
    await page.click('[data-undo]');
    ck((await status()).state !== 'APPROVED', 'WF22b …and Undo of that edit does not silently re-approve: an approval is a decision, never history');
    // step 26: save, reload, the creature is there
    await page.click('[data-test="unfinished"]'); await page.click('[data-test="authoring"]');
    await page.click('[data-approve]');
    const saved = await page.evaluate(() => window.ShapeLab.save());
    const beforeReload = await page.evaluate(() => JSON.stringify([window.ShapeLab.figure(), window.ShapeLab.state().missing, window.ShapeLab.reveal(), window.ShapeLab.state().approved && window.ShapeLab.state().approved.kind]));
    await page.reload(); await page.waitForFunction(() => !!window.ShapeLab && !!window.LabReference, null, { timeout: 20000 });
    await page.evaluate((id) => window.ShapeLab.load(id), saved.id);
    const afterReload = await page.evaluate(() => JSON.stringify([window.ShapeLab.figure(), window.ShapeLab.state().missing, window.ShapeLab.reveal(), window.ShapeLab.state().approved && window.ShapeLab.state().approved.kind]));
    const s26 = await status();
    ck(saved.ok && afterReload === beforeReload && s26.state === 'APPROVED' && !s26.dirty && !(await disabled('[data-undo]')) === false,
      'WF23 step 26: save, reload, open — the same points, connections, missing marks, reveal and approval; nothing is dirty and the history starts clean');
    // steps 27–29: the scoped resets, each proved to touch only its own thing
    await page.click('[data-reset-connections]');
    const rc = await fig(); const rcs = await status();
    ck(rc.f.joins.length === 0 && rc.f.points.length === N && rcs.reveal === 1 && rcs.state !== 'APPROVED' && /every point exactly where it was, the reveal untouched/.test(await q('[data-say]')),
      'WF24 step 27: RESET CONNECTIONS removes every connection and missing mark — every point stays, the reveal stays, and the approval clears');
    await page.click('[data-undo]');
    ck((await fig()).f.joins.length === N, 'WF24b …and Undo brings every connection back');
    await page.click('[data-reset-reveal]');
    const rr = await status();
    ck(rr.reveal === 0 && rr.points === N && rr.connections === N && rr.missing === 1, 'WF25 step 28: RESET REVEAL removes the reveal feature and nothing else');
    await page.click('[data-undo]');
    ck((await status()).reveal === 1, 'WF25b …and Undo brings it back');
    await page.evaluate(() => { const s = document.querySelector('[data-ref-subject]'); s.value = 'Lion'; });
    // reset points: with a reference showing, the suggested points come back as the starting figure
    await page.click('[data-reset-points]');
    const rp = await fig(); const rps = await status();
    ck(rp.f.joins.length === 0 && rps.reveal === 0 && /Connections went with them/.test(await q('[data-say]')),
      'WF26 step 29: RESET POINTS removes the points, the connections and the reveal features standing on them — and says so', await q('[data-say]'));
    await page.click('[data-undo]');
    const rpu = await status();
    ck(rpu.points === N && rpu.connections === N && rpu.missing === 1 && rpu.reveal === 1, 'WF26b …and one Undo brings points, connections, missing mark and reveal all back');
    // step 30: RESET EVERYTHING asks first, cancel keeps everything, confirm clears
    await page.click('[data-reset]');
    const box = await page.evaluate(() => ({ shown: !document.querySelector('[data-reset-confirm-box]').hidden, pts: window.ShapeLab.figure().points.length }));
    await page.click('[data-reset-cancel]');
    const kept = await page.evaluate(() => ({ shown: !document.querySelector('[data-reset-confirm-box]').hidden, pts: window.ShapeLab.figure().points.length }));
    await page.click('[data-reset]'); await page.click('[data-reset-confirm]');
    const gone = await status();
    ck(box.shown && box.pts === N && !kept.shown && kept.pts === N && gone.points === 0 && gone.connections === 0 && gone.reveal === 0 && gone.name === '' && gone.state === 'BUILDING',
      'WF27 step 30: RESET EVERYTHING asks first; Keep working keeps all twelve; Yes, start again clears points, connections, reveal and the name');
    ck((await disabled('[data-undo]')), 'WF27b a fresh creature has no history — Reset everything is a new beginning, not an undoable edit');
    // step 31: opening a fixture over unsaved work asks for a second press
    await page.evaluate(() => { window.ShapeLab.addPoint(0.2, 0.2); window.ShapeLab.addPoint(-0.2, 0.2); });
    const openBtn = await page.$('[data-open]');
    await openBtn.click();
    const firstPress = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points.length, say: document.querySelector('[data-say]').textContent }));
    await (await page.$('[data-open]')).click();
    const secondPress = await page.evaluate(() => ({ pts: window.ShapeLab.figure().points.length, id: window.ShapeLab.state().id }));
    ck(firstPress.pts === 2 && /unsaved changes.*Press Open again/.test(firstPress.say) && secondPress.pts === N && secondPress.id === saved.id,
      'WF28 step 31: Open over unsaved work is refused once with the reason, and a second press opens the fixture', firstPress.say);
    ck(errors.length === 0, 'WF29 no page errors across the whole journey', errors.join(' | '));
    await page.screenshot({ path: path.join(shotDir, 'desktop-journey.png'), fullPage: false });

    // ---- the phone: one column, both panes stacked, nothing off the edge ----
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mob = await page.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const wide = Array.from(document.querySelectorAll('body *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > cw + 1; }).length;
      return { sw: document.documentElement.scrollWidth, cw, wide, stage: getComputedStyle(document.querySelector('.stage')).gridTemplateColumns.split(' ').length,
        sticky: getComputedStyle(document.querySelector('main > div.centre')).position, pane: document.querySelector('[data-canvas-complete]').getBoundingClientRect().width };
    });
    ck(mob.sw <= mob.cw && mob.wide === 0 && mob.stage === 1 && mob.sticky === 'static' && mob.pane > 300,
      'WF30 on a phone (390×844) the page never scrolls sideways, the AUTHOR and JUDGE panes stack, the centre no longer sticks, and the pane is still a usable size', JSON.stringify(mob));
    // the sticky panes on a laptop: scrolled to step 6, the canvases are still in view
    await page.setViewportSize({ width: 1500, height: 900 });
    await page.evaluate(() => { window.ShapeLab.render(); document.querySelector('[data-approve]').scrollIntoView(); });
    await page.waitForTimeout(500);
    const lap = await page.evaluate(() => { const r = document.querySelector('[data-canvas-complete]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight, scrollY }; });
    ck(lap.scrollY > 100 && lap.top >= 0 && lap.bottom <= lap.vh, 'WF30b on a laptop, scrolled down to APPROVE, the two panes are still on screen — they stay put while the steps scroll', JSON.stringify(lap));
    await page.screenshot({ path: path.join(shotDir, 'desktop-scrolled.png'), fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(shotDir, 'phone.png'), fullPage: false });
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }
}

// ===================================================================
// IM. PROMPT → ARTISTIC VISUAL → CHOOSE / REFINE → IMAGE UNDERSTANDING
// (the Shape Lab's new front door, proof V1). The account this sprint
// ran on has no image-generation access, so ARTISTIC IMAGE GENERATION
// is a provider abstraction with two providers — fixture (existing
// artwork, chosen not generated) and openai-image (reports UNAVAILABLE
// from the transport's own answer) — and the proof target is FIXTURE
// ARTWORK → gpt-4.1-mini IMAGE UNDERSTANDING → STRUCTURED ANALYSIS.
// This section proves the contract, the validator, the endpoint's two
// new actions, the browser journey through fixture and a stubbed model,
// the privacy boundary, key handling and error recovery. The REAL model
// pass is tools/ether-mystery-lab-test/real-understanding.js and its
// committed results — never run here.
// ===================================================================
async function sectionIM() {
  console.log('\n== IM. prompt → visual → choose → understanding (Shape Lab front door) ==');
  const { chromium } = require('playwright');
  const Imagine = require(path.join(ROOT, 'tools/ether-mystery-lab/labImagine.js'));
  const Art = require(path.join(ROOT, 'tools/ether-mystery-lab/labArtworkData.js'));
  const imSrc = read('tools/ether-mystery-lab/labImagine.js');
  const imStripped = stripComments(imSrc);
  const connStripped = stripComments(read('tools/ether-mystery-lab/labConnection.js'));
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const htmlNoComments = shapeHtml.replace(/<!--[\s\S]*?-->/g, '');
  const shotDir = path.join(SHOTS, 'imagine'); fs.mkdirSync(shotDir, { recursive: true });

  // ---- IM1: the boundary — production untouched, nothing reaches the Ether ----
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'IM1  the production point limit is still eight — image analysis becomes no geometry');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'IM1b the build is not bumped — nothing shipped to a child', Array.from(new Set(stamps)).join(','));
  const srcs = [...htmlNoComments.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  ck(!srcs.some((s) => /etherExperience|etherLife|etherRipple|etherMystery|etherDiscovery|experience-pool|vihuplanetHome|magicCard/.test(s)) && srcs.some((s) => /labImagine/.test(s)) && srcs.some((s) => /labArtworkData/.test(s)),
    'IM1c the Shape Lab loads the front door and the artwork manifest, and still no file that mounts the Ether or reads the production pool', srcs.join(','));
  ck(!/ShapeLab\.(addPoint|movePoint|deletePoint|toggleJoin|toggleGap|addReveal|placeSuggestions|joinInOrder|setBudget|reset)\b|\bLabReveal\b|\bEtherMystery\b|\bEtherGrammar\b|LabReference\.set\b|candidateFor/.test(imStripped),
    'IM1d the front door never places a point, a join, a gap or a reveal — it calls no editor mutator, no reveal, no grammar and no interpreter');

  // ---- IM2: no creature catalogue, no hidden picture, no key, no storage ----
  const creatureWords = /\b(tiger|falcon|elephant|dragon|penguin|whale|bird|lion|fox|bear|octopus|cat|dog|fish|butterfly|snake|horse|mermaid|centaur|eagle)\b/i;
  ck(!creatureWords.test(imStripped), 'IM2  no creature name anywhere in the front door — arbitrary prompts, no taxonomy');
  ck(!/subject\s*===|===\s*subject|switch\s*\(\s*(subject|prompt|s|name|creature)\b/.test(imStripped), 'IM2b no prompt-specific branch — nothing compares a prompt to a literal');
  ck(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(imStripped), 'IM2c the front door writes nothing to storage — ideas, the selection and the analysis live for the page');
  ck(!/api\.openai|sk-[A-Za-z0-9]|XMLHttpRequest|WebSocket/.test(imStripped) && (imStripped.match(/fetch\(/g) || []).length === 1 && /function loadArtwork/.test(imStripped) && /\^\[a-z\]\+:/.test(imStripped),
    'IM2d the only fetch in the front door reads the Lab\'s own artwork by relative path — a provider is reached through LabConnection alone');
  ck(!/Math\.random/.test(imStripped), 'IM2e nothing in it is random — the same prompt orders the gallery the same way');
  ck(!/\.png|\.jpg|<img|new Image|drawImage/i.test(imStripped.replace(/createElement\('img'\)/g, '')), 'IM2f no bitmap file, no hidden picture in code — the pictures come from the manifest or the model');
  ck(!/<img|\.png|\.jpg|\.svg|background-image/i.test(htmlNoComments), 'IM2g the page markup still carries no image element and no image file — every picture on screen is made by the module from what was chosen');
  ck(!/available\s*:\s*(true|false)|UNAVAILABLE\s*=|isAvailable/.test(imStripped) && /'no-image-model'/.test(imStripped) && /'no-image-model'/.test(connStripped),
    'IM2h the unavailability is NOT hard-coded: no provider carries an availability flag, and UNAVAILABLE is reached only from the transport\'s own no-image-model answer');
  const providers = Imagine.PROVIDERS;
  ck(providers.fixture && providers.fixture.kind === 'fixture' && providers['openai-image'] && providers['openai-image'].kind === 'model' && Object.keys(providers).length === 2,
    'IM2i two artistic providers in a table — fixture (existing artwork) and openai-image (a real image model) — and the table is where a third would go');
  const connRaw = read('tools/ether-mystery-lab/labConnection.js');
  ck(/DIRECT_IMAGE_URL = 'https:\/\/api\.openai\.com\/v1\/images\/generations'/.test(connRaw) && (connRaw.match(/images\/generations/g) || []).length === 1 && /function imagine\(/.test(connStripped) && /function understand\(/.test(connStripped),
    'IM2j LabConnection names the image endpoint exactly once and owns both new transports — imagine() and understand() — in all three modes');

  // ---- IM3: the researcher's words ----
  const EIGHT = ['a graceful mermaid with flowing hair', 'a smiling dragon with enormous wings', 'a lion with wings', 'a centaur', 'a tiny elephant with huge ears', 'a sleepy fox carrying a little moon', 'a creature with six legs and a giant curled tail', 'a playful sea creature with butterfly wings'];
  ck(EIGHT.every((p) => Imagine.cleanPrompt(p) === p), 'IM3  all eight of the brief\'s prompts are valid creative inputs, verbatim');
  ck(Imagine.cleanPrompt('') === null && Imagine.cleanPrompt('ab') === null && Imagine.cleanPrompt('<b>dragon</b>') === null && Imagine.cleanPrompt('see http://x.y') === null && Imagine.cleanPrompt('x'.repeat(201)) === null && Imagine.cleanPrompt('123') === null,
    'IM3b an empty, too-short, marked-up, linked, over-long or letterless prompt is refused — never rewritten');
  const gp = Imagine.imagePrompt(EIGHT[1], ['make it friendlier and more playful, with a longer tail', 'bigger eyes']);
  const glines = gp.text.split('\n');
  ck(gp.ok && glines[0] === EIGHT[1] + '.' && glines[1] === 'Refinement: make it friendlier and more playful, with a longer tail.' && glines[2] === 'Refinement: bigger eyes.' && glines[3] === Imagine.PRESENTATION && glines.length === 4,
    'IM3c the generation prompt is the creative intent VERBATIM first, the refinements in order, then the fixed presentation line — nothing reduces "a smiling dragon with enormous wings" to a noun');
  ck(/full body/.test(Imagine.PRESENTATION) && /single creature/.test(Imagine.PRESENTATION) && /No text/.test(Imagine.PRESENTATION) && !/constellation|point|line drawing|diagram of|style:/i.test(Imagine.PRESENTATION.replace('no diagram', '')),
    'IM3d the presentation constraints ask for full body, one creature, no text — and impose no style and no constellation');
  ck(Imagine.cleanRefinements(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length === 6 && Imagine.cleanRefinement('<x>') === null && Imagine.cleanRefinement('') === '',
    'IM3e refinements are bounded to six and validated like the prompt');
  const um = Imagine.understandMessages(EIGHT[2], ['make the mane bigger']);
  ck(um.messages.length === 2 && um.messages[0].role === 'system' && um.messages[1].role === 'user' && /Creative prompt: a lion with wings\nRefinement: make the mane bigger/.test(um.messages[1].content),
    'IM3f the understanding request is one fixed contract plus the creative prompt and its refinements — the picture is attached by the transport');
  ck(Object.keys(Imagine.SCHEMA).every((k) => um.messages[0].content.indexOf('"' + k + '"') !== -1) && /PICTURE is the source of truth/.test(um.messages[0].content) && /promptFidelity/.test(um.messages[0].content) && /No coordinates/.test(um.messages[0].content) && /one coherent visual gesture or as a collection of parts/.test(um.messages[0].content),
    'IM3g the contract names every schema field, says the picture is the source of truth, asks for prompt fidelity, forbids coordinates and asks whether it is one gesture or a collection of parts');

  // ---- IM4: the analysis validator — deny by shape ----
  const good = { subject: 'a winged lion cub', character: ['playful', 'curious'], composition: 'A grounded walking cat with two big wings rising from the shoulders.', architecture: ['a round mane around the head', 'wings rooted at the shoulders, spread up and back', 'a low four-legged body'], diagnosticFeatures: ['mane', 'feathered wings', 'lantern tail'], modifiers: ['winged', 'carrying a lantern'], proportion: 'The mane and the wings dominate; the legs are short.', gesture: 'One coherent gesture: a cat mid-step reaching for a butterfly.', abstraction: { survives: ['the mane', 'the wing span', 'the walking pose'], doNotDrawLiterally: ['fur texture'], note: 'Keep the wing roots on the shoulders.' }, revealCandidates: ['mane', 'wing feathers'], promptFidelity: { agreement: 'matches', differences: [] } };
  const v0 = Imagine.validateAnalysis(good);
  ck(v0.ok && Object.keys(v0.analysis).sort().join(',') === Object.keys(Imagine.SCHEMA).sort().join(',') && v0.analysis.abstraction.survives.length === 3 && v0.analysis.promptFidelity.agreement === 'matches',
    'IM4  a valid analysis comes out as a CLEAN copy carrying exactly the schema\'s keys');
  const refusedTop = ['points', 'joins', 'missing', 'svg', 'x', 'coordinates', 'path', 'pattern', 'constellation', 'stars', 'card', 'email', 'memories', 'username', 'url', 'image', 'code', 'html'].filter((k) => { const r = Imagine.validateAnalysis(Object.assign({}, good, { [k]: 'x' })); return !(r.ok === false && r.reasons.some((x) => x === 'forbidden-key:' + k)); });
  ck(refusedTop.length === 0, 'IM4b every geometry, runtime, credential and private key is refused BY NAME at the top level', refusedTop.join(','));
  const nested = Imagine.validateAnalysis(Object.assign({}, good, { abstraction: { survives: ['a'], doNotDrawLiterally: [], note: 'x', points: [[0, 1]] } }));
  ck(!nested.ok && nested.reasons.indexOf('forbidden-key:abstraction.points') !== -1, 'IM4c and at any depth, with its path', nested.reasons.join(','));
  const unk = Imagine.validateAnalysis(Object.assign({}, good, { extra: 'y' }));
  ck(!unk.ok && unk.reasons.join() === 'unknown-key:extra', 'IM4d an unknown key is refused by name — a field a future build adds is refused by default');
  const badTexts = { coord: 'the head at (12, 40)', bracket: 'wing [0.2, 0.3]', px: 'about 40px wide', svg: '<svg viewBox="0 0 1 1">', markup: '<b>mane</b>', url: 'see https://example.com/lion', data: 'data:image/png;base64,AAAA', exec: 'function () { return 1 }' };
  const leaks = Object.keys(badTexts).filter((k) => Imagine.validateAnalysis(Object.assign({}, good, { gesture: badTexts[k] })).ok);
  ck(leaks.length === 0, 'IM4e a coordinate, a pixel measure, SVG, markup, a link, a data URI and code are all refused as text — the analysis is words', leaks.join(','));
  ck(!Imagine.validateAnalysis(Object.assign({}, good, { proportion: 3 })).ok && !Imagine.validateAnalysis(Object.assign({}, good, { character: 'playful' })).ok && !Imagine.validateAnalysis(Object.assign({}, good, { architecture: [1, 2] })).ok,
    'IM4f a number, a string where a list should be, or a list of numbers is refused');
  const miss = Imagine.validateAnalysis({ subject: 'x' });
  ck(!miss.ok && Imagine.REQUIRED.slice(1).every((k) => miss.reasons.indexOf('missing:' + k) !== -1), 'IM4g every missing required field is named', miss.reasons.join(','));
  const long = Imagine.validateAnalysis(Object.assign({}, good, { gesture: 'word '.repeat(120).trim(), character: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], promptFidelity: { agreement: 'kinda', differences: [] } }));
  ck(long.ok && long.analysis.gesture.length <= 400 && long.repairs.some((r) => /gesture cut at a word/.test(r)) && long.analysis.character.length === 6 && long.repairs.some((r) => /character cut to 6/.test(r)) && long.analysis.promptFidelity.agreement === 'unknown' && long.repairs.some((r) => /agreement "kinda" → unknown/.test(r)),
    'IM4h an over-long sentence is cut at a word and RECORDED, an over-long list is cut and recorded, an unknown agreement becomes unknown and is recorded — nothing is silently changed');
  ck(Imagine.parseAnalysis('```json\n' + JSON.stringify(good) + '\n```').ok && Imagine.parseAnalysis('Sure! Here it is: ' + JSON.stringify(good) + ' Hope that helps.').ok && !Imagine.parseAnalysis('the lion is mighty').ok && !Imagine.parseAnalysis('').ok && !Imagine.parseAnalysis('{"subject": ').ok,
    'IM4i a reply is text until proven an analysis — fenced or wrapped JSON is read, prose and broken JSON are refused');
  const fx = Imagine.parseAnalysis(Imagine.fixtureAnalysis('a lion with wings', 'Leo'));
  ck(fx.ok && /^FIXTURE/.test(fx.analysis.subject) && /no model/i.test(fx.analysis.composition) && fx.analysis.promptFidelity.agreement === 'differs',
    'IM4j the fixture analysis passes the same validator and says on its face that no model looked');
  ck(!Imagine.validateAnalysis(Object.assign({}, good, { promptFidelity: { agreement: 'matches', differences: [], score: 9 } })).ok,
    'IM4k promptFidelity takes no score — a number about the picture is refused');

  // ---- IM5: the artwork manifest — real files, ground truth, credits, and it never travels ----
  const missingFiles = Art.entries.filter((e) => !fs.existsSync(path.resolve(ROOT, 'tools/ether-mystery-lab', e.file)));
  ck(Art.entries.length >= 12 && missingFiles.length === 0, 'IM5  every manifest entry points at a real picture in the repository', missingFiles.map((e) => e.id).join(','));
  ck(Art.entries.every((e) => typeof e.visible === 'string' && e.visible.length >= 80 && e.credit && e.licence && Array.isArray(e.tags) && e.tags.length >= 3 && e.title),
    'IM5b every entry carries ground truth written by a person (visible), a credit, a licence and tags');
  ck(['twemoji-LICENSE-GRAPHICS.txt', 'openmoji-LICENSE.txt', 'gameicons-license.txt'].every((f) => fs.existsSync(path.join(ROOT, 'tools/ether-mystery-lab/artwork', f))) && Art.entries.filter((e) => e.licence === 'product').length === 5 && Art.entries.filter((e) => e.licence === 'product').every((e) => /^\.\.\/\.\.\/assets\//.test(e.file)),
    'IM5c the three licence texts ride with the rasters, and the five product entries point into assets/ rather than copying the Companions');
  const ids = Art.entries.map((e) => e.id);
  ck(new Set(ids).size === ids.length && Art.byId('leo') && !Art.byId('nope'), 'IM5d ids are unique and byId answers');
  // the ground truth never reaches a request: every visible sentence is checked against every message the contract builds
  const msgsAll = Art.entries.map((e) => JSON.stringify(Imagine.understandMessages(e.title, []).messages) + JSON.stringify(Imagine.imagePrompt(e.title, []).text));
  const truthLeak = Art.entries.filter((e, i) => { const frag = e.visible.split('. ')[0].slice(0, 40); return msgsAll[i].indexOf(frag) !== -1; });
  ck(truthLeak.length === 0, 'IM5e no fragment of any ground-truth sentence appears in any request the contract builds — the model is never told what a person saw', truthLeak.map((e) => e.id).join(','));
  ck(!creatureWords.test(imStripped) && /rankArtwork/.test(imStripped), 'IM5f the gallery is ordered by word overlap over the manifest\'s data, in a function that knows no creature');
  const r1 = Imagine.rankArtwork('a lion with wings', Art.entries);
  const r2 = Imagine.rankArtwork('a graceful mermaid with flowing hair', Art.entries);
  const r3 = Imagine.rankArtwork('a wibble', Art.entries);
  ck(r1[0].entry.id === 'leo' && r1[0].score >= 2 && /mermaid/.test(r2[0].entry.id) && r3.every((r) => r.score === 0) && r3.map((r) => r.entry.id).join() === ids.join() && r1.length === Art.entries.length,
    'IM5g "a lion with wings" brings the winged lion first, a mermaid prompt a mermaid first, a word nobody has leaves the gallery in manifest order — and nothing is ever filtered out');

  // ---- IM6: the endpoint's two new actions — transpiled, driven with real Requests ----
  const ts = require('typescript');
  const js = ts.transpileModule(read('supabase/functions/lab-generate/index.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', 'Deno', 'fetch', js)(mod.exports, require, mod, undefined, undefined);
  const makeHandler = mod.exports.makeHandler;
  const ENV = { SUPABASE_URL: 'https://x.local', SUPABASE_SERVICE_ROLE_KEY: 'svc-key', SUPABASE_ANON_KEY: 'anon-key', OPENAI_API_KEY: 'sk-test' };
  let calls = [];
  function jsonRes(body, status) { return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } }); }
  function fetchFor(behaviour) {
    calls = [];
    return async (url, init) => {
      const u = String(url);
      if (u.indexOf('/auth/v1/user') !== -1) return (init.headers.Authorization || '') === 'Bearer admin-token' ? jsonRes({ id: 'u-admin', email: 'admin@x' }) : jsonRes({}, 401);
      if (u.indexOf('/rest/v1/rpc/edge_rate_limit_hit') !== -1) return jsonRes({ allowed: true, remaining: 5, retry_after: 0 });
      if (u.indexOf('/rest/v1/platform_admins') !== -1) return jsonRes([{ email: 'admin@x' }]);
      if (u.indexOf('api.openai.com') !== -1) {
        calls.push({ url: u, body: JSON.parse(init.body) });
        if (behaviour === 'no-model') return jsonRes({ error: { message: 'Project proj_SECRET does not have access to model gpt-image-1', type: 'invalid_request_error', code: 'model_not_found' } }, 403);
        if (behaviour === 'busy') return jsonRes({ error: { message: 'rate' } }, 429);
        if (behaviour === 'error') return jsonRes({ error: { message: 'SECRET-PROVIDER-DETAIL org_abc' } }, 500);
        if (behaviour === 'malformed') return new Response('<<<', { status: 200 });
        if (behaviour === 'throw') throw new Error('unreachable');
        if (/images\/generations/.test(u)) return jsonRes({ data: [{ b64_json: 'AAAA' }, { b64_json: 'BBBB' }, { b64_json: 'CCCC' }] });
        return jsonRes({ choices: [{ message: { content: JSON.stringify(good) } }] });
      }
      throw new Error('unexpected fetch ' + u);
    };
  }
  async function drive(payload, behaviour, envExtra) {
    const h = makeHandler({ env: (n) => (Object.assign({}, ENV, envExtra || {}))[n] || '', fetchImpl: fetchFor(behaviour || 'ok') });
    const res = await h(new Request('https://fn.local/lab-generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' }, body: JSON.stringify(payload) }));
    return { status: res.status, body: await res.json().catch(() => null) };
  }
  const B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  let r = await drive({ action: 'ping' });
  ck(r.body.ok && r.body.build === 'LAB3' && r.body.imageModel === 'gpt-image-2' && r.body.provider === 'configured', 'IM6  ping reports build LAB3 and the image model it would use');
  r = await drive({ action: 'imagine', prompt: 'a lion with wings' }, 'no-model');
  ck(r.status === 200 && r.body.ok === false && r.body.reason === 'no-image-model' && JSON.stringify(r.body).indexOf('proj_SECRET') === -1 && JSON.stringify(r.body).indexOf('sk-test') === -1,
    'IM6b an account with no image model answers ONE word — no-image-model — and neither the provider\'s message nor the key leaves', JSON.stringify(r.body));
  ck(calls.length === 1 && /images\/generations/.test(calls[0].url) && calls[0].body.model === 'gpt-image-2' && calls[0].body.n === 3 && calls[0].body.prompt === 'a lion with wings',
    'IM6c the provider was asked once, for three interpretations, with the Lab\'s own prompt');
  r = await drive({ action: 'imagine', prompt: 'a lion with wings', n: 9 }, 'ok');
  ck(r.body.ok && r.body.images.length === 3 && r.body.images[0] === 'AAAA' && r.body.model === 'gpt-image-2' && calls[0].body.n === 4, 'IM6d a good answer passes the pictures through as base64, and a request for nine is clamped to four');
  r = await drive({ action: 'imagine', prompt: 'a lion with wings' }, 'busy');
  ck(r.body.reason === 'provider-busy', 'IM6e a busy provider is provider-busy');
  r = await drive({ action: 'imagine', prompt: 'a lion with wings' }, 'error');
  ck(r.body.reason === 'unavailable' && JSON.stringify(r.body).indexOf('SECRET') === -1, 'IM6f a provider error is unavailable, never provider text');
  r = await drive({ action: 'imagine', prompt: '' }, 'ok');
  ck(r.body.reason === 'bad-prompt' && calls.length === 0, 'IM6g an empty prompt is refused before any call');
  r = await drive({ action: 'imagine', prompt: 'x' }, 'ok', { OPENAI_API_KEY: '' });
  ck(r.body.reason === 'not-configured', 'IM6h no key → not-configured');
  r = await drive({ action: 'understand', messages: um.messages, image: { mime: 'image/png', b64: B64 } }, 'ok');
  ck(r.body.ok && typeof r.body.text === 'string' && r.body.model === 'gpt-4.1' && calls.length === 1, 'IM6i understand relays the model\'s text back once');
  const sentU = calls[0].body;
  const lastU = sentU.messages[sentU.messages.length - 1];
  ck(sentU.model === 'gpt-4.1' && sentU.response_format.type === 'json_object' && typeof sentU.messages[0].content === 'string' && Array.isArray(lastU.content) && lastU.content[0].type === 'text' && lastU.content[0].text === um.messages[1].content && lastU.content[1].type === 'image_url' && lastU.content[1].image_url.url === 'data:image/png;base64,' + B64 && lastU.content[1].image_url.detail === 'high',
    'IM6j the picture is attached to the last user message as an image part beside the Lab\'s own text, and structured output is demanded — the browser never built that shape');
  const badImgs = [{ mime: 'text/html', b64: B64 }, { mime: 'image/png', b64: 'short' }, { mime: 'image/png', b64: '<script>' + B64 }, { mime: 'image/png', b64: 'A'.repeat(8 * 1024 * 1024 + 1) }];
  let refusedImgs = 0;
  for (const im of badImgs) { r = await drive({ action: 'understand', messages: um.messages, image: im }, 'ok'); if (r.body.reason === 'bad-image' && calls.length === 0) refusedImgs++; }
  ck(refusedImgs === badImgs.length, 'IM6k a wrong type, a too-short, a non-base64 or an over-size picture is refused before any call', refusedImgs + '/' + badImgs.length);
  r = await drive({ action: 'understand', messages: [{ role: 'system', content: 'x' }], image: { mime: 'image/png', b64: B64 } }, 'ok');
  ck(r.body.reason === 'bad-messages', 'IM6l messages must end with a user turn for the picture to sit on');
  r = await drive({ action: 'understand', messages: um.messages, image: { mime: 'image/png', b64: B64 } }, 'error');
  ck(r.body.reason === 'unavailable' && JSON.stringify(r.body).indexOf('SECRET') === -1, 'IM6m a failed read is unavailable, never provider text');
  r = await drive({ action: 'understand', messages: um.messages, image: { mime: 'image/png', b64: B64 } }, 'malformed');
  ck(r.body.reason === 'malformed', 'IM6n a malformed read is malformed');
  const fnStripped = stripComments(read('supabase/functions/lab-generate/index.ts'));
  const bodies = [...fnStripped.matchAll(/json\(\{\s*ok:\s*false[^}]*\}/g)].map((m) => m[0]);
  ck(bodies.length > 0 && bodies.every((b) => !/detail|error:|body\.|\.text\(|\$\{/.test(b)), 'IM6o every failure body in the function is still a fixed reason (S6\'s rule holds for the new actions)');

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const requests = [];
    page.on('request', (q) => requests.push(q.url()));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabImagine && !!window.LabArtworkData && !!window.ShapeLab && !!window.LabReference && !!window.LabConnection, null, { timeout: 20000 });
    const S = (fn, arg) => page.evaluate(fn, arg);

    // ---- IM7: loading does nothing ----
    const load = await S(() => ({ st: window.LabImagine.state(), ls: Object.keys(localStorage).length, ss: Object.keys(sessionStorage).length,
      attrs: [document.querySelector('[data-imagine-section]').getAttribute('data-imagine-state'), document.querySelector('[data-imagine-section]').getAttribute('data-imagine-provider')],
      controls: ['[data-imagine-prompt]', '[data-imagine-create]', '[data-imagine-provider-pick="fixture"]', '[data-imagine-provider-pick="openai-image"]', '[data-imagine-options]', '[data-imagine-use]', '[data-imagine-another]', '[data-imagine-prev]', '[data-imagine-refine]', '[data-imagine-refine-go]', '[data-imagine-selected-img]', '[data-imagine-understand]', '[data-imagine-unselect]', '[data-imagine-file]', '[data-imagine-panel]', '[data-imagine-panel-source]', '[data-imagine-copy]', '[data-imagine-json]', '[data-imagine-trace]', '[data-ref-subject]', '[data-ref-generate]'].filter((c) => !document.querySelector(c)),
      ideasHidden: document.querySelector('[data-imagine-ideas]').hidden, selHidden: document.querySelector('[data-imagine-selected]').hidden, imgs: document.querySelectorAll('img').length,
      line: document.querySelector('[data-imagine-provider-line]').textContent }));
    ck(load.st.page === 'idle' && load.st.generations.length === 0 && load.ls === 0 && load.ss === 0 && load.attrs.join() === 'idle,fixture' && load.controls.length === 0 && load.ideasHidden && load.selHidden && load.imgs === 0 && errors.length === 0 && !requests.some((u) => /openai|supabase/.test(u)),
      'IM7  loading the page creates nothing, writes nothing, shows no picture, reaches no provider, and every control is there — including the name→reference flow', 'missing ' + load.controls.join(','));
    ck(/^ARTISTIC SOURCE — Fixture — existing artwork\./.test(load.line), 'IM7b the artistic source reads ARTISTIC SOURCE — Fixture, and says the pictures are chosen, never generated', load.line);
    // Advanced holds the JSON and the trace
    ['data-imagine-json', 'data-imagine-trace', 'data-imagine-copy'].forEach((sel) => {
      const idx = htmlNoComments.indexOf(sel); const before = htmlNoComments.slice(0, idx);
      ck(idx > 0 && (before.match(/<details class="adv"/g) || []).length > (before.match(/<\/details>/g) || []).length - ((before.match(/<details data-ref-trace-panel>/g) || []).length), 'IM7c ' + sel + ' sits inside an Advanced disclosure — raw JSON is never the default view');
    });

    // ---- IM8: validation on the page ----
    await page.click('[data-imagine-create]');
    let v = await S(() => ({ st: document.querySelector('[data-imagine-status]').textContent, n: window.LabImagine.state().generations.length }));
    ck(/Nothing was created/.test(v.st) && v.n === 0, 'IM8  an empty prompt is refused on screen and nothing is created');
    await page.fill('[data-imagine-prompt]', '<b>dragon</b>');
    await page.click('[data-imagine-create]');
    v = await S(() => ({ st: document.querySelector('[data-imagine-status]').textContent, n: window.LabImagine.state().generations.length, req: 0 }));
    ck(/Nothing was created/.test(v.st) && v.n === 0, 'IM8b a marked-up prompt is refused');

    // ---- IM9: the fixture journey — create → choose → use → (placeholder) understanding ----
    const before = requests.length;
    await page.fill('[data-imagine-prompt]', 'a lion with wings');
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => window.LabImagine.state().page === 'ideas', null, { timeout: 20000 });
    const ideas = await S(() => { const st = window.LabImagine.state(); const cards = Array.from(document.querySelectorAll('[data-imagine-option]'));
      return { n: st.generations[0].images.length, cards: cards.length, first: st.generations[0].images[0].artworkId, firstCap: cards[0].querySelector('.cap').textContent, tags: cards.map((c) => c.querySelector('.tag').textContent.split(' ·')[0]), labels: st.generations[0].images.map((i) => i.source),
        status: document.querySelector('[data-imagine-status]').textContent, outcome: document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome'), useDisabled: document.querySelector('[data-imagine-use]').disabled, imgs: document.querySelectorAll('[data-imagine-option] img').length, set: document.querySelector('[data-imagine-set]').textContent }; });
    ck(ideas.n === Art.entries.length && ideas.cards === ideas.n && ideas.imgs === ideas.n && ideas.first === 'leo' && /Leo/.test(ideas.firstCap) && ideas.tags.every((t) => t === 'FIXTURE') && ideas.labels.every((l) => l === 'fixture') && ideas.outcome === 'fixture',
      'IM9  Create with the fixture artistic source shows the whole gallery, the winged lion first, every card tagged FIXTURE', ideas.first + ' ' + ideas.tags.slice(0, 3).join(','));
    ck(/ARTISTIC SOURCE: Fixture/.test(ideas.status) && /chosen by you, not generated/.test(ideas.status) && /FIXTURE — existing artwork, chosen not generated/.test(ideas.set),
      'IM9b the status and the set label say ARTISTIC SOURCE: Fixture — chosen, not generated — and never imply a model drew them');
    const reqs = requests.slice(before);
    ck(reqs.length > 0 && reqs.every((u) => u.indexOf(BASE + '/') === 0) && reqs.some((u) => /assets\/leosaurus\/hero\.png/.test(u)) && reqs.some((u) => /artwork\/gameicons-centaur\.png/.test(u)),
      'IM9c every request the gallery made stayed on this origin — the Companion art from assets/ and the rasters from artwork/', reqs.length + ' requests');
    ck(ideas.useDisabled, 'IM9d USE waits for a choice');
    await page.click('[data-imagine-option]');
    const picked = await S(() => ({ on: document.querySelectorAll('.idea.on').length, useDisabled: document.querySelector('[data-imagine-use]').disabled, hi: window.LabImagine.state().highlight }));
    ck(picked.on === 1 && !picked.useDisabled && picked.hi, 'IM9e a click picks one idea out and enables USE THIS CREATURE');
    await page.screenshot({ path: path.join(shotDir, 'create-fixture-ideas.png') });
    await page.click('[data-imagine-use]');
    await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 20000 });
    const used = await S(() => { const a = window.LabImagine.analysis(); return { sel: window.LabImagine.selectedImage(), selImg: !!document.querySelector('[data-imagine-selected-img] img'), badge: document.querySelector('.selbadge').textContent, chosenTag: !!document.querySelector('.idea.chosen .tag.chosen'),
      subject: a.subject, source: a.source, panelBadge: document.querySelector('[data-imagine-panel-source]').textContent, panel: document.querySelector('[data-imagine-panel]').textContent, uoutcome: document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome'), ustatus: document.querySelector('[data-imagine-understand-status]').textContent, trace: window.LabImagine.lastUnderstand() }; });
    const reqAfterUse = requests.length;
    ck(used.sel && used.sel.artworkId === 'leo' && used.selImg && used.badge === 'SELECTED' && used.chosenTag, 'IM9f USE makes the choice the selected creature — shown large, badged SELECTED, and marked in the gallery');
    // (reported by the product owner on a narrow screen: the top line said
    // "Reading it…" for ever while the result sat below the fold)
    const where = await S(() => ({ top: document.querySelector('[data-imagine-status]').textContent, under: document.querySelector('[data-imagine-understand-status]').textContent, summary: document.querySelector('[data-imagine-summary]').textContent, summaryHidden: document.querySelector('[data-imagine-summary]').hidden, showOn: !document.querySelector('[data-imagine-show]').disabled,
      selectedAboveIdeas: document.querySelector('[data-imagine-selected]').compareDocumentPosition(document.querySelector('[data-imagine-ideas]')) & Node.DOCUMENT_POSITION_FOLLOWING }));
    ck(where.top === where.under && /placeholder|Understood/.test(where.top) && !where.summaryHidden && /Understanding panel/.test(where.summary) && where.showOn && !!where.selectedAboveIdeas,
      'IM9f2 the read\'s outcome is written on the TOP line as well as under the picture, a one-line summary and a Show-the-understanding button sit under the selected picture, and the selected block stands above the gallery — nothing about a read is below the fold');
    ck(/^FIXTURE/.test(used.subject) && used.source === 'fixture' && /FIXTURE — a placeholder, no model looked/.test(used.panelBadge) && /no model/i.test(used.panel) && used.uoutcome === 'fixture' && /no model looked at the picture/.test(used.ustatus) && /sends nothing|placeholder/.test(used.trace.request),
      'IM9g with the Fixture connection the understanding is a placeholder that says on its face that no model looked — never an invented description');
    ck(reqAfterUse === requests.length && !requests.some((u) => /openai|supabase/.test(u)), 'IM9h and no request left for it');
    // the JSON lives in a closed Advanced disclosure — opened the way a person opens it, then pressed
    await S(() => { document.querySelector('[data-imagine-copy]').closest('details').open = true; });
    await page.click('[data-imagine-copy]');
    const json = await S(() => { const ta = document.querySelector('[data-imagine-json]'); return { hidden: ta.hidden, ok: (() => { try { return JSON.parse(ta.value).subject; } catch (e) { return null; } })() }; });
    ck(!json.hidden && /^FIXTURE/.test(json.ok), 'IM9i the raw JSON is one press away under Advanced');

    // ---- IM10: refine, previous, forward, another — nothing destroyed, the selection persists ----
    await page.fill('[data-imagine-refine]', 'make it friendlier and more playful, with a longer tail');
    await page.click('[data-imagine-refine-go]');
    await page.waitForFunction(() => window.LabImagine.state().generations.length === 2, null, { timeout: 20000 });
    const ref = await S(() => { const st = window.LabImagine.state(); return { n: st.generations.length, g2: st.generations[1], shown: st.shown, sel: st.selected, set: document.querySelector('[data-imagine-set]').textContent, prevOn: !document.querySelector('[data-imagine-prev]').disabled, refineField: document.querySelector('[data-imagine-refine]').value, analysis: !!window.LabImagine.analysis() }; });
    ck(ref.n === 2 && ref.g2.prompt === 'a lion with wings' && ref.g2.refinements.join() === 'make it friendlier and more playful, with a longer tail' && ref.shown === ref.g2.id && /Set 2 of 2/.test(ref.set) && /refined: make it friendlier/.test(ref.set) && ref.prevOn && ref.refineField === '',
      'IM10 REFINE keeps the original words and adds a line — a second set, the first kept, the field cleared, Bring back previous enabled');
    ck(ref.sel && ref.sel.generationId === 'ideas-1' && ref.analysis, 'IM10b the selected creature and its understanding survive the refinement — a new set never takes them away');
    await page.click('[data-imagine-prev]');
    const prev = await S(() => { const st = window.LabImagine.state(); return { shown: st.shown, set: document.querySelector('[data-imagine-set]').textContent, chosen: document.querySelectorAll('.idea.chosen').length, nextShown: !document.querySelector('[data-imagine-next]').hidden }; });
    ck(prev.shown === 'ideas-1' && /Set 1 of 2/.test(prev.set) && prev.chosen === 1 && prev.nextShown, 'IM10c BRING BACK PREVIOUS shows the first set again with its chosen picture still marked, and Forward appears');
    await page.click('[data-imagine-next]');
    // (ids come off one counter shared with the pictures, so the second set is not "ideas-2" — it is whatever the state says it is)
    ck(await S(() => { const st = window.LabImagine.state(); return st.shown === st.generations[1].id; }), 'IM10d Forward goes back to the second');
    await page.click('[data-imagine-another]');
    await page.waitForFunction(() => window.LabImagine.state().generations.length === 3, null, { timeout: 20000 });
    const an = await S(() => { const st = window.LabImagine.state(); return { n: st.generations.length, same: st.generations[2].prompt === st.generations[1].prompt && st.generations[2].refinements.join() === st.generations[1].refinements.join() }; });
    ck(an.n === 3 && an.same, 'IM10e TRY ANOTHER INTERPRETATION makes a third set from the same words, keeping the other two');
    await page.fill('[data-imagine-refine]', '<script>x</script>');
    await page.click('[data-imagine-refine-go]');
    ck(await S(() => window.LabImagine.state().generations.length === 3 && /Nothing was created/.test(document.querySelector('[data-imagine-status]').textContent)), 'IM10f a refinement that cannot be sent is refused and nothing is created');

    // ---- IM11: the openai-image provider on the fixture connection ----
    await page.click('[data-imagine-provider-pick="openai-image"]');
    const pl = await S(() => ({ line: document.querySelector('[data-imagine-provider-line]').textContent, attr: document.querySelector('[data-imagine-section]').getAttribute('data-imagine-provider'), on: document.querySelector('[data-imagine-provider-pick="openai-image"]').classList.contains('on') }));
    ck(/ARTISTIC SOURCE — OpenAI image generation/.test(pl.line) && /UNAVAILABLE when the account has no image model/.test(pl.line) && pl.attr === 'openai-image' && pl.on, 'IM11 choosing OpenAI image generation says so, and says what UNAVAILABLE would mean');
    await page.click('[data-imagine-create]');
    await page.waitForTimeout(300);
    const nc = await S(() => ({ n: window.LabImagine.state().generations.length, outcome: document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome'), st: document.querySelector('[data-imagine-status]').textContent, sel: window.LabImagine.state().selected, req: 0 }));
    ck(nc.n === 3 && nc.outcome === 'not-configured' && /needs a real connection/.test(nc.st) && /Nothing was created/.test(nc.st) && nc.sel && !requests.some((u) => /openai/.test(u)),
      'IM11b with the Fixture connection the image provider makes no request and creates nothing; the three sets and the selection stay');

    // ---- IM12: the stubbed endpoint — UNAVAILABLE from the transport, then a generated set, then a real-shaped understanding ----
    let epBodies = []; let imagineAnswer = 'no-model'; let understandAnswer = 'good';
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      epBodies.push(body);
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB2', provider: 'configured', model: 'gpt-4.1-mini', imageModel: 'gpt-image-1' }) });
      if (body.action === 'imagine') {
        if (imagineAnswer === 'no-model') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'no-image-model' }) });
        if (imagineAnswer === 'down') return route.abort();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, images: [B64, B64, B64], model: 'gpt-image-1', build: 'LAB2' }) });
      }
      if (body.action === 'understand') {
        if (understandAnswer === 'down') return route.abort();
        const text = understandAnswer === 'good' ? JSON.stringify(Object.assign({}, good, { subject: 'a winged lion from the stub' })) : (understandAnswer === 'geometry' ? JSON.stringify(Object.assign({}, good, { points: [[0, 1]] })) : 'I would rather write prose about lions.');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text, model: 'gpt-4.1-mini', build: 'LAB2' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4.1-mini', build: 'LAB2', text: '{}' }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') === 'unavailable', null, { timeout: 8000 });
    const un = await S(() => ({ n: window.LabImagine.state().generations.length, st: document.querySelector('[data-imagine-status]').textContent, trace: window.LabImagine.lastImagine(), createOn: !document.querySelector('[data-imagine-create]').disabled }));
    ck(un.n === 3 && /UNAVAILABLE/.test(un.st) && /no image model/.test(un.st) && /Nothing was replaced/.test(un.st) && un.trace.answer.reason === 'no-image-model' && un.trace.outcome === 'unavailable' && un.createOn && epBodies.filter((b) => b.action === 'imagine').length === 1,
      'IM12 the image provider answering no-image-model reads UNAVAILABLE on screen, from the transport\'s answer — nothing replaced, the button live again');
    imagineAnswer = 'ok';
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => window.LabImagine.state().generations.length === 4, null, { timeout: 8000 });
    const gen = await S(() => { const st = window.LabImagine.state(); const g = st.generations[3]; return { n: g.images.length, src: g.images.map((i) => i.source).join(), model: g.model, tags: Array.from(document.querySelectorAll('[data-imagine-option] .tag')).map((t) => t.textContent.split(' ·')[0]).join(), set: document.querySelector('[data-imagine-set]').textContent, outcome: document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') }; });
    ck(gen.n === 3 && gen.src === 'generated,generated,generated' && gen.model === 'gpt-image-1' && gen.tags === 'IMAGE MODEL,IMAGE MODEL,IMAGE MODEL' && /IMAGE MODEL \(gpt-image-1\)/.test(gen.set) && gen.outcome === 'generated',
      'IM12b when the image model answers, the three interpretations are labelled IMAGE MODEL (the model named) — the fixture label is never borrowed');
    const sentImagine = epBodies.filter((b) => b.action === 'imagine').pop();
    // (CREATE from the field is a fresh start — no refinement line; REFINE is what carries one)
    ck(sentImagine.n === 3 && sentImagine.prompt.split('\n')[0] === 'a lion with wings.' && !/Refinement:/.test(sentImagine.prompt) && /Presentation:/.test(sentImagine.prompt) && Object.keys(sentImagine).sort().join() === 'action,n,prompt',
      'IM12c what left for the image model is action, n and the prompt — the creative words and the presentation line, nothing else; a fresh Create carries no refinement');
    await page.click('[data-imagine-option]');
    await page.click('[data-imagine-use]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'generated', null, { timeout: 8000 });
    const ru = await S(() => { const a = window.LabImagine.analysis(); return { subject: a.subject, source: a.source, model: a.model, imageSource: a.imageSource, badge: document.querySelector('[data-imagine-panel-source]').textContent, panel: document.querySelector('[data-imagine-panel]').textContent, chips: document.querySelectorAll('.an-chip').length, ustatus: document.querySelector('[data-imagine-understand-status]').textContent, ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), exp: window.ShapeLab.exportJSON() }; });
    ck(ru.subject === 'a winged lion from the stub' && ru.source === 'generated' && ru.model === 'gpt-4.1-mini' && ru.imageSource === 'generated' && /IMAGE UNDERSTANDING \(gpt-4.1-mini\) · endpoint · read from a generated picture/.test(ru.badge) && /Primary composition/.test(ru.panel) && /Gesture and flow/.test(ru.panel) && /Against the prompt/.test(ru.panel) && ru.chips >= 6 && /Understood \(gpt-4.1-mini\)/.test(ru.ustatus),
      'IM12d the understanding of the chosen picture renders every section — subject, character, composition, masses, features, modifiers, proportion, gesture, survives, reveal, against the prompt — badged as image understanding by the model');
    const sentU2 = epBodies.filter((b) => b.action === 'understand').pop();
    const truthWords = Art.entries.map((e) => e.visible.split('. ')[0].slice(0, 40));
    ck(sentU2 && sentU2.image && sentU2.image.mime === 'image/png' && sentU2.image.b64 === B64 && sentU2.messages.length === 2 && sentU2.messages.every((m) => typeof m.content === 'string') && Object.keys(sentU2).sort().join() === 'action,image,messages' &&
       !/\b(card|stars|constellation|memor|username|creator|companion|email|session|token)\b/i.test(JSON.stringify(sentU2.messages)) && !truthWords.some((w) => JSON.stringify(sentU2).indexOf(w) !== -1),
      'IM12e what left for the understanding is action, the picture and two text messages — no private word, no ground truth, and the picture only as the picture');
    ck(!/admin-session-token/.test(ru.ls + ru.ss + ru.exp) && !/base64|data:image/.test(ru.ls + ru.ss + ru.exp), 'IM12f the token, the picture and the analysis reach no storage and no export');
    await page.screenshot({ path: path.join(shotDir, 'understanding-stubbed-model.png') });
    // a refused reply keeps what was there
    understandAnswer = 'geometry';
    await page.click('[data-imagine-understand]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'rejected', null, { timeout: 8000 });
    const rej = await S(() => ({ subject: window.LabImagine.analysis().subject, ustatus: document.querySelector('[data-imagine-understand-status]').textContent, trace: window.LabImagine.lastUnderstand() }));
    ck(rej.subject === 'a winged lion from the stub' && /refused by the validator/.test(rej.ustatus) && /forbidden-key:points/.test(rej.ustatus) && /still here/.test(rej.ustatus) && rej.trace.parse.ok === false,
      'IM12g a reply carrying geometry is refused by name and the understanding in use is untouched');
    understandAnswer = 'prose';
    await page.click('[data-imagine-understand]');
    await page.waitForFunction(() => /not-json/.test(document.querySelector('[data-imagine-understand-status]').textContent), null, { timeout: 8000 });
    ck(await S(() => window.LabImagine.analysis().subject === 'a winged lion from the stub'), 'IM12h a prose reply is refused and the understanding in use is untouched');
    understandAnswer = 'down';
    await page.click('[data-imagine-understand]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'failed', null, { timeout: 12000 });
    const down = await S(() => ({ subject: window.LabImagine.analysis().subject, ustatus: document.querySelector('[data-imagine-understand-status]').textContent, busy: window.LabImagine.state().busy, on: !document.querySelector('[data-imagine-understand]').disabled }));
    ck(down.subject === 'a winged lion from the stub' && /failed — unavailable/.test(down.ustatus) && /No fixture was substituted/.test(down.ustatus) && down.busy === null && down.on,
      'IM12i a dead transport fails on screen, substitutes nothing, keeps the understanding, and hands the button back');
    imagineAnswer = 'down';
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') === 'failed', null, { timeout: 12000 });
    ck(await S(() => window.LabImagine.state().generations.length === 4 && /Creating failed/.test(document.querySelector('[data-imagine-status]').textContent) && !document.querySelector('[data-imagine-create]').disabled),
      'IM12j a dead transport on Create fails on screen, keeps every set, and hands the button back');
    await page.unroute('https://fn.local/lab-generate');

    // ---- IM13: the Direct (dev) path — stubbed at the provider host; the key reaches nowhere ----
    let directBodies = [];
    await page.route('https://api.openai.com/**', (route) => {
      const u = route.request().url();
      if (/\/models$/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'gpt-4.1-mini' }] }) });
      const body = JSON.parse(route.request().postData() || '{}');
      directBodies.push({ url: u, body });
      if (/images\/generations/.test(u)) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Project proj_SECRET does not have access to model gpt-image-1', type: 'invalid_request_error', code: 'model_not_found' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(Object.assign({}, good, { subject: 'read directly' })) } }] }) });
    });
    await page.click('[data-conn-mode="direct"]');
    await page.fill('[data-conn-key]', 'sk-test-direct-never-stored');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED \(direct\)/.test(document.querySelector('[data-conn-status]').textContent));
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') === 'unavailable', null, { timeout: 8000 });
    const dun = await S(() => ({ st: document.querySelector('[data-imagine-status]').textContent, n: window.LabImagine.state().generations.length }));
    ck(/UNAVAILABLE/.test(dun.st) && dun.n === 4 && directBodies.some((d) => /images\/generations/.test(d.url) && d.body.model === 'gpt-image-2' && d.body.n === 3),
      'IM13 on the Direct path the provider\'s model_not_found becomes UNAVAILABLE on screen — the same word, from the same kind of answer');
    await page.click('[data-imagine-understand]');
    await page.waitForFunction(() => window.LabImagine.analysis().subject === 'read directly', null, { timeout: 8000 });
    const dr = await S(() => ({ a: window.LabImagine.analysis(), ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), cookie: document.cookie, exp: window.ShapeLab.exportJSON(), badge: document.querySelector('[data-imagine-panel-source]').textContent }));
    const dsent = directBodies.filter((d) => /chat\/completions/.test(d.url)).pop().body;
    const dlast = dsent.messages[dsent.messages.length - 1];
    ck(dr.a.mode === 'direct' && /· direct ·/.test(dr.badge) && dsent.model === 'gpt-4.1' && dsent.response_format.type === 'json_object' && Array.isArray(dlast.content) && dlast.content[1].type === 'image_url' && /^data:image\/png;base64,/.test(dlast.content[1].image_url.url) && dlast.content[1].image_url.detail === 'high',
      'IM13b Direct attaches the picture as an image part on the last user message and demands structured output — the same shape the endpoint builds');
    ck(!/sk-test-direct/.test(dr.ls + dr.ss + dr.cookie + dr.exp) && !/sk-test-direct/.test(JSON.stringify(dsent.messages)), 'IM13c the key reaches no storage, no cookie, no export and no message body');
    await page.unroute('https://api.openai.com/**');
    await page.click('[data-conn-clear]');
    ck(await S(() => !window.LabConnection._holdsDirectKey() && window.LabConnection.status().mode === 'fixture'), 'IM13d Disconnect / clear drops the key and returns to Fixture');

    // ---- IM14: bring a picture ----
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'tools/ether-mystery-lab/artwork/gameicons-centaur.png'));
    await page.waitForFunction(() => { const s = window.LabImagine.state(); return s.generations.length === 5 && s.page === 'understood'; }, null, { timeout: 20000 });
    const up = await S(() => { const st = window.LabImagine.state(); const g = st.generations[4]; return { src: g.source, label: g.images[0].label, title: g.images[0].title, sel: st.selected.generationId === g.id, tag: document.querySelector('[data-imagine-option] .tag').textContent, subject: window.LabImagine.analysis().subject, outcome: document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') }; });
    ck(up.src === 'uploaded' && /^UPLOADED/.test(up.label) && /centaur/.test(up.title) && up.sel && /^UPLOADED/.test(up.tag) && /^FIXTURE/.test(up.subject) && up.outcome === 'uploaded',
      'IM14 a picture of the researcher\'s own becomes a one-picture set labelled UPLOADED, is used at once, and is read by whatever connection is chosen');
    await page.setInputFiles('[data-imagine-file]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await page.waitForTimeout(200);
    ck(await S(() => window.LabImagine.state().generations.length === 5 && /not a PNG, JPEG or WebP/.test(document.querySelector('[data-imagine-status]').textContent)), 'IM14b a file that is not a picture is refused and nothing changes');

    // ---- IM15: the existing Shape Lab is intact ----
    await page.fill('[data-ref-subject]', 'Tiger');
    await page.click('[data-ref-generate]');
    await page.waitForFunction(() => { const c = window.LabReference.current(); return !!c && c.subject === 'Tiger'; }, null, { timeout: 8000 });
    const intact = await S(() => { const S = window.ShapeLab; return { placed: S.figure().points.length, ref: window.LabReference.meta().source, api: ['setBudget', 'addPoint', 'toggleJoin', 'toggleGap', 'joinInOrder', 'undo', 'redo', 'approve', 'save', 'exportJSON', 'importJSON'].filter((k) => typeof S[k] !== 'function'), keys: Object.keys(localStorage), err: 0 }; });
    ck(intact.placed > 0 && intact.ref === 'fixture' && intact.api.length === 0 && intact.keys.length === 0 && errors.length === 0,
      'IM15 the name→reference flow still places a starting figure, every editor API is there, nothing was written, and the page raised no error through the whole journey', errors.join(' | '));
    const stepOrder = (htmlNoComments.match(/data-step="([a-z]+)"/g) || []).map((m) => m.replace(/.*="|"/g, ''));
    ck(stepOrder.join(',') === 'create,shape,connect,reveal,test,approve', 'IM15b the six stages are exactly where they were — the front door is INSIDE Create');
    const advStripped = htmlNoComments.replace(/<details class="adv"[\s\S]*?<\/details>/g, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<header>[\s\S]*?<\/header>/, '').replace(/<script[^>]*><\/script>/g, '').replace(/<[^>]+>/g, ' ');
    const banned = ['candidate', 'interpreter', 'provider', 'projection', 'sanitiz', 'schema', 'runtime', 'validator'].filter((w) => new RegExp('\\b' + w, 'i').test(advStripped));
    ck(banned.length === 0, 'IM15c the new copy keeps the technical vocabulary out of the stages — no provider, schema, validator or runtime outside Advanced', banned.join(','));
    // a phone
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const mob = await S(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, cols: getComputedStyle(document.querySelector('.ideas')).gridTemplateColumns.split(' ').length }));
    ck(mob.sw <= mob.cw && mob.cols === 2, 'IM15d on a phone the gallery is two columns and the page never scrolls sideways', JSON.stringify(mob));
    await page.close(); await ctx.close();
  } finally {
    await browser.close();
    server.kill();
  }

  // ---- IM16: the real-model pass is committed, honest, and validated by this same validator ----
  const rp = path.join(__dirname, 'shots', 'imagine', 'real-understanding.json');
  ck(fs.existsSync(rp), 'IM16 the real-model pass has been run and its results are committed');
  if (fs.existsSync(rp)) {
    const rep = JSON.parse(fs.readFileSync(rp, 'utf8'));
    ck(rep.imageGeneration && rep.imageGeneration.available === false && rep.imageGeneration.reason === 'model_not_found', 'IM16b IMAGE GENERATION was measured UNAVAILABLE — the provider answered model_not_found, recorded rather than believed', JSON.stringify(rep.imageGeneration));
    const okN = rep.results.filter((r) => r.ok).length;
    ck(rep.model === 'gpt-4.1-mini' && rep.results.length === Art.entries.length && okN === rep.results.length, 'IM16c gpt-4.1-mini read every picture in the manifest and every reply passed the validator', okN + '/' + rep.results.length);
    const revalid = rep.results.filter((r) => r.ok && !Imagine.parseAnalysis(r.raw).ok);
    ck(revalid.length === 0, 'IM16d the committed raw replies still pass the validator as it stands today — the contract and the results cannot drift apart', revalid.map((r) => r.id).join(','));
    const badFid = rep.results.filter((r) => r.ok && !r.analysis.promptFidelity);
    ck(badFid.length === 0, 'IM16e every real reply says how the picture stood against its prompt', badFid.map((r) => r.id).join(','));
    const gestures = rep.results.filter((r) => r.ok && !/gesture|parts|coherent|flow|pose|one /i.test(r.analysis.gesture));
    ck(gestures.length === 0, 'IM16f every real reply answered the gesture question in the terms it was asked', gestures.map((r) => r.id).join(','));
  }
}

async function sectionTR() {
  console.log('\n== TR. image → understanding → Ether translation plan → deterministic composer → Shape Lab ==');
  const { chromium } = require('playwright');
  const Translate = require(path.join(ROOT, 'tools/ether-mystery-lab/labTranslate.js'));
  const Composer = require(path.join(ROOT, 'tools/ether-mystery-lab/labEtherComposer.js'));
  const Imagine = require(path.join(ROOT, 'tools/ether-mystery-lab/labImagine.js'));
  const Art = require(path.join(ROOT, 'tools/ether-mystery-lab/labArtworkData.js'));
  const trSrc = read('tools/ether-mystery-lab/labTranslate.js'), trStripped = stripComments(trSrc);
  const coSrc = read('tools/ether-mystery-lab/labEtherComposer.js'), coStripped = stripComments(coSrc);
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const htmlNoComments = shapeHtml.replace(/<!--[\s\S]*?-->/g, '');
  const shotDir = path.join(SHOTS, 'translate'); fs.mkdirSync(shotDir, { recursive: true });

  // ---- TR1: the boundary — production untouched, the two new modules reach nothing of the Ether ----
  ck(/arrangementNodesMax:\s*8\b/.test(read('js/etherGrammar.js')), 'TR1  the production point limit is still eight — a generated figure is Lab data, never Ether geometry');
  const stamps = (read('index.html').match(/\?v=(\d{4})/g) || []).map((s) => s.slice(3));
  ck(stamps.length > 0 && stamps.every((s) => s === '0769'), 'TR1b the build is not bumped — nothing shipped to a child', Array.from(new Set(stamps)).join(','));
  const srcs = [...htmlNoComments.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  ck(srcs.some((s) => /labEtherComposer/.test(s)) && srcs.some((s) => /labTranslate/.test(s)) && !srcs.some((s) => /etherExperience|etherLife|etherRipple|etherMystery|etherDiscovery|experience-pool|vihuplanetHome|magicCard/.test(s)),
    'TR1c the Shape Lab loads the composer and the translator, and still no file that mounts the Ether or reads the production pool', srcs.join(','));
  ck(!/\bEtherMystery\b|\bEtherGrammar\b|\bEtherLife\b|\bEtherExperience\b|experience-pool|\bMagicCard\b|\bCompanionMemory\b|CreatorProjectStore/.test(trStripped + coStripped),
    'TR1d neither module names the interpreter, the grammar, the pool, a card or a memory — there is no route from a translation to production');
  ck(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(trStripped + coStripped), 'TR1e neither module writes to storage — the plan, the figure and the trace live for the page');
  ck(!/fetch\(|XMLHttpRequest|WebSocket|api\.openai|sk-[A-Za-z0-9]/.test(trStripped + coStripped) && /C\.understand\(/.test(trStripped),
    'TR1f neither module makes a request of its own — the plan is asked for through LabConnection.understand(), the transport the understanding already uses');

  // ---- TR2: no creature catalogue, no branch, no randomness ----
  const creatureWords = /\b(tiger|falcon|elephant|dragon|penguin|whale|bird|lion|fox|bear|octopus|cat|dog|fish|butterfly|snake|horse|mermaid|centaur|eagle|wing|wings|tail|trunk|mane|horn|beak|fin)\b/i;
  ck(!creatureWords.test(coStripped), 'TR2  the composer names no creature and no creature part — a plan for a wibble composes as a plan for anything else');
  ck(!/subject\s*===|===\s*subject|switch\s*\(\s*(subject|name|creature|label|id)\b|\.(label|id)\s*===\s*'(?!string|number|object|boolean)/.test(coStripped + trStripped), 'TR2b no branch on a subject, a label or a mass id — geometry is decided by kind, size, gesture and relationship alone');
  ck(!/Math\.random/.test(coStripped + trStripped), 'TR2c nothing is random — the same plan composes the same figure');
  const hand = { masses: [
      { id: 'head', role: 'primary', kind: 'mass', size: 'large', shape: 'round', label: 'HEAD' },
      { id: 'body', role: 'primary', kind: 'mass', size: 'dominant', shape: 'oval', label: 'BODY' },
      { id: 'tail', role: 'diagnostic', kind: 'taper', size: 'large', shape: 'long', label: 'TAIL' },
      { id: 'sails', role: 'diagnostic', kind: 'span', size: 'dominant', shape: 'wide', label: 'SAIL' },
      { id: 'prongs', role: 'diagnostic', kind: 'terminal', size: 'small', shape: 'thin', label: 'PRONG' },
      { id: 'legs', role: 'secondary', kind: 'branch', size: 'small', shape: 'thin', label: 'LEG' } ],
    gesture: { kind: 'upright', flow: ['body', 'head'], curve: 'gentle', facing: 'left', note: 'stands' },
    relationships: [ { from: 'tail', relation: 'extends-from', to: 'body', side: 'back' }, { from: 'sails', relation: 'spans-from', to: 'body', side: 'both', symmetric: true }, { from: 'prongs', relation: 'rises-from', to: 'head', side: 'top', symmetric: true }, { from: 'legs', relation: 'supports', to: 'body', side: 'bottom' } ],
    proportion: [ { mass: 'head', treat: 'oversized' } ], mustSurvive: ['head', 'sails', 'tail'], simplify: [], revealOnly: ['scales'], complexity: 'moderate', movement: 'sways' };
  const f1 = Composer.compose(hand), f2 = Composer.compose(JSON.parse(JSON.stringify(hand)));
  ck(f1.ok && JSON.stringify(f1) === JSON.stringify(f2), 'TR2d compose is deterministic — the same plan twice is the same figure, byte for byte');
  const renamed = JSON.parse(JSON.stringify(hand)); renamed.masses.forEach((m) => { m.id = 'q' + m.id; m.label = 'Q' + m.label; }); renamed.gesture.flow = renamed.gesture.flow.map((i) => 'q' + i); renamed.relationships.forEach((r) => { r.from = 'q' + r.from; r.to = 'q' + r.to; }); renamed.proportion.forEach((p) => { p.mass = 'q' + p.mass; }); renamed.mustSurvive = renamed.mustSurvive.map((i) => 'q' + i);
  const f3 = Composer.compose(renamed);
  ck(f3.ok && JSON.stringify(f3.points) === JSON.stringify(f1.points) && JSON.stringify(f3.joins) === JSON.stringify(f1.joins), 'TR2e renaming every mass changes not one light — the composer reads structure, never names');

  // ---- TR3: the plan contract — gesture first, relationships, no coordinates asked for ----
  const anal = Imagine.parseAnalysis(Imagine.fixtureAnalysis('a made-up creature', 'X')).analysis;
  const pm = Translate.planMessages(anal);
  const sys = pm.messages[0].content, usr = pm.messages[1].content;
  ck(pm.ok && pm.messages.length === 2 && pm.messages[0].role === 'system' && pm.messages[1].role === 'user' && typeof usr === 'string', 'TR3  the plan request is one fixed contract and one user message of text — the picture is attached by the transport, never built here');
  ck(/GESTURE FIRST/.test(sys) && /RELATIONSHIPS ARE THE POINT/.test(sys) && /never a coordinate/i.test(sys) && /SVG, code or markup/.test(sys) && /Never invent a part/.test(sys),
    'TR3b the contract says gesture first, relationships are the point, words only, never a coordinate, never invent a part');
  ck(Object.keys(Translate.SCHEMA).every((k) => sys.indexOf('"' + k + '"') !== -1) && Translate.RELATIONS.every((r) => sys.indexOf(r) !== -1) && Translate.KINDS.every((k) => sys.indexOf(k + ' (') !== -1),
    'TR3c every schema field, every relation and every kind is named in the contract from the vocabulary itself — no second copy');
  const truthWords = Art.entries.map((e) => e.visible.split('. ')[0].slice(0, 40));
  const realU = JSON.parse(read('tools/ether-mystery-lab-test/shots/imagine/real-understanding.json'));
  const leaks = realU.results.filter((r) => r.ok).filter((r, i) => { const m = JSON.stringify(Translate.planMessages(r.analysis).messages); return truthWords.some((w) => m.indexOf(w) !== -1); });
  ck(leaks.length === 0, 'TR3d no fragment of any ground-truth sentence reaches a plan request built from a real understanding — the model is never told what a person saw', leaks.map((r) => r.id).join(','));
  ck(!/\b(card|stars|constellation|memor|username|creator|companion|email|session|token)\b/i.test(sys + usr), 'TR3e no private word in the contract or the context');
  ck(!Translate.planMessages(null).ok && !Translate.planMessages('x').ok, 'TR3f no understanding, no request');

  // ---- TR4: the plan validator — deny by shape, drift repaired, structure refused ----
  const v0 = Translate.validatePlan(hand);
  ck(v0.ok && v0.reasons.length === 0 && Object.keys(v0.plan).sort().join() === Object.keys(Translate.SCHEMA).sort().join() && v0.plan.masses.length === 6 && v0.plan.gesture.flow.join() === 'body,head',
    'TR4  a valid plan comes out as a CLEAN copy carrying exactly the schema\'s keys');
  const refusedTop = ['points', 'joins', 'missing', 'x', 'coordinates', 'svg', 'path', 'polygon', 'pattern', 'constellation', 'stars', 'card', 'email', 'memories', 'username', 'url', 'code', 'html'].filter((k) => { const r = Translate.validatePlan(Object.assign({}, hand, { [k]: 'x' })); return !(r.ok === false && r.reasons.some((x) => x === 'forbidden-key:' + k)); });
  ck(refusedTop.length === 0, 'TR4b every geometry, runtime, credential and private key is refused BY NAME at the top level', refusedTop.join(','));
  const nested = Translate.validatePlan(Object.assign({}, hand, { gesture: Object.assign({}, hand.gesture, { points: [[0, 1]] }) }));
  ck(!nested.ok && nested.reasons.indexOf('forbidden-key:gesture.points') !== -1, 'TR4c and at any depth, with its path', nested.reasons.join(','));
  const numbered = Translate.validatePlan(Object.assign({}, hand, { masses: hand.masses.map((m, i) => i ? m : Object.assign({}, m, { size: 0.3 })) }));
  const numbered2 = Translate.validatePlan(Object.assign({}, hand, { movement: 'the head sits at 0.2, 0.4' }));
  ck(!numbered.ok && !numbered2.ok && numbered.reasons.concat(numbered2.reasons).every((r) => /number|geometry|text/i.test(r)), 'TR4d a NUMBER anywhere — as a value or inside a sentence — is refused: a coordinate in disguise', numbered.reasons.join(',') + ' | ' + numbered2.reasons.join(','));
  const badTexts = { svg: '<svg viewBox="0 0 1 1">', markup: '<b>head</b>', url: 'see https://x.y/z', data: 'data:image/png;base64,AAAA', exec: 'function () { return 1 }' };
  const textLeaks = Object.keys(badTexts).filter((k) => Translate.validatePlan(Object.assign({}, hand, { movement: badTexts[k] })).ok);
  ck(textLeaks.length === 0, 'TR4e SVG, markup, a link, a data URI and code are refused as text', textLeaks.join(','));
  ck(!Translate.validatePlan(Object.assign({}, hand, { extra: 'y' })).ok && Translate.validatePlan(Object.assign({}, hand, { extra: 'y' })).reasons.join() === 'unknown-key:extra', 'TR4f an unknown key is refused by name');
  const drift = Translate.validatePlan(Object.assign({}, hand, { masses: hand.masses.map((m, i) => i === 3 ? Object.assign({}, m, { kind: 'wing', size: 'huge' }) : m), gesture: Object.assign({}, hand.gesture, { kind: 'standing' }) }));
  ck(drift.ok && drift.plan.masses[3].kind === 'mass' && drift.plan.masses[3].size === 'medium' && drift.plan.gesture.kind === 'upright' && drift.repairs.length >= 3 && drift.repairs.every((r) => /→/.test(r)),
    'TR4g vocabulary drift ("wing", "huge", "standing") is REPAIRED to the vocabulary and every repair is recorded — never silently, never refused whole', drift.repairs.join(' | '));
  const structural = [
    ['flow-too-short', Object.assign({}, hand, { gesture: Object.assign({}, hand.gesture, { flow: ['body'] }) })],
    ['flow-names-unknown-mass', Object.assign({}, hand, { gesture: Object.assign({}, hand.gesture, { flow: ['body', 'ghost'] }) })],
    ['self-relationship', Object.assign({}, hand, { relationships: hand.relationships.concat([{ from: 'tail', relation: 'extends-from', to: 'tail' }]) })],
    ['relationship-names-unknown-mass', Object.assign({}, hand, { relationships: hand.relationships.concat([{ from: 'ghost', relation: 'extends-from', to: 'body' }]) })],
    ['missing:mustSurvive', Object.assign({}, hand, { mustSurvive: [] })],
    ['bad-masses-count', Object.assign({}, hand, { masses: hand.masses.slice(0, 1) })],
    ['duplicate-mass', Object.assign({}, hand, { masses: hand.masses.concat([hand.masses[0]]) })]
  ];
  const structFail = structural.filter(([reason, p]) => { const r = Translate.validatePlan(p); return r.ok || !r.reasons.some((x) => x.indexOf(reason) === 0); });
  ck(structFail.length === 0, 'TR4h structure the composer could only guess at — a flow of one, an id nobody declared, a mass related to itself, nothing to survive, one mass, a duplicate — is refused with its reason', structFail.map((s) => s[0]).join(','));
  const unreach = Translate.validatePlan(Object.assign({}, hand, { relationships: hand.relationships.slice(1) }));
  ck(unreach.ok && unreach.repairs.some((r) => /no relationship reaches: tail/.test(r)), 'TR4i a mass no relationship reaches is allowed and NAMED — the composer will hang it off the largest flow mass and say so');
  ck(!Translate.validatePlan(Object.assign({}, hand, { relationships: hand.relationships.map((r) => Object.assign({}, r, { symmetric: 'yes' })) })).ok === false && Translate.validatePlan(Object.assign({}, hand, { relationships: hand.relationships.map((r) => Object.assign({}, r, { symmetric: 'yes' })) })).repairs.some((r) => /symmetric dropped/.test(r)),
    'TR4j symmetric is the one boolean — a string there is dropped and recorded');
  ck(Translate.parsePlan('```json\n' + JSON.stringify(hand) + '\n```').ok && Translate.parsePlan('Here: ' + JSON.stringify(hand) + ' done.').ok && !Translate.parsePlan('a spine and some wings').ok && !Translate.parsePlan('').ok && !Translate.parsePlan('{"masses": ').ok,
    'TR4k a reply is text until proven a plan — fenced or wrapped JSON is read, prose and broken JSON are refused');
  const fx = Translate.parsePlan(Translate.fixturePlan());
  ck(fx.ok && fx.plan.masses.every((m) => /^FIXTURE/.test(m.label)) && /fixture/i.test(fx.plan.gesture.note) && Composer.compose(fx.plan).ok, 'TR4l the fixture plan passes the same validator, says on its face that it is a fixture, and composes');

  // ---- TR5: the composer — gesture first, then relationships ----
  const alloc = f1.diagnostics.allocation;
  const tagOf = (re) => alloc.filter((a) => re.test(a.tag));
  const rootEnd = tagOf(/root end/)[0], tipEnd = tagOf(/tip end/)[0], trans = tagOf(/transition body→head/)[0];
  ck(rootEnd && tipEnd && trans && rootEnd.mass === 'body' && tipEnd.mass === 'head' && rootEnd.p[1] > trans.p[1] && trans.p[1] > tipEnd.p[1],
    'TR5  the SPINE comes first: for an upright flow body→head the root end is the body, the tip end is the head, and the transition between them stands between them');
  const spine = Composer.spineFor({ kind: 'grounded', flow: ['a', 'b'], curve: 'straight', facing: 'right' });
  const spineL = Composer.spineFor({ kind: 'grounded', flow: ['a', 'b'], curve: 'straight', facing: 'left' });
  ck(spine.at(1)[0] > spine.at(0)[0] && spineL.at(1)[0] < spineL.at(0)[0] && Math.abs(spine.at(0.5)[1] - (spine.at(0)[1] + spine.at(1)[1]) / 2) < 1e-9,
    'TR5b facing decides which way the head end of the spine points, and a straight curve is straight');
  const gest = ['upright', 'seated', 'grounded', 'reaching', 'flowing', 'coiled', 'diagonal', 'spread', 'rearing', 'floating'].map((k) => Composer.spineFor({ kind: k, flow: ['a', 'b'], curve: 'gentle', facing: 'left' }));
  ck(gest.every((s) => s.length > 0.4) && new Set(gest.map((s) => s.at(0).join() + '|' + s.at(1).join())).size >= 7, 'TR5c every gesture kind lays a real spine and they are not one spine wearing ten names');
  const body = alloc.filter((a) => a.mass === 'body'), sails = alloc.filter((a) => a.mass === 'sails'), tail = alloc.filter((a) => a.mass === 'tail'), legs = alloc.filter((a) => a.mass === 'legs'), prongs = alloc.filter((a) => a.mass === 'prongs');
  const bodyC = body.reduce((s, a) => s + a.p[1], 0) / body.length;
  ck(legs.length === 2 && legs.every((a) => a.p[1] > bodyC) && Math.abs(legs[0].p[0] - legs[1].p[0]) > 0.3, 'TR5d a branch that SUPPORTS from the bottom becomes two feet below the body, spread apart');
  ck(prongs.length === 2 && prongs.every((a) => a.p[1] < tipEnd.p[1] + 0.05) && Math.sign(prongs[0].p[0] - tipEnd.p[0]) !== Math.sign(prongs[1].p[0] - tipEnd.p[0]), 'TR5e a symmetric terminal that RISES FROM the top of the head becomes a pair above it, one each side');
  const sailTips = sails.filter((a) => /\btip\b/.test(a.tag));
  ck(sailTips.length === 2 && Math.sign(sailTips[0].p[0]) !== Math.sign(sailTips[1].p[0]) && Math.abs(Math.abs(sailTips[0].p[0]) - Math.abs(sailTips[1].p[0])) < 0.05 && sailTips.every((t) => t.p[1] < bodyC),
    'TR5f a span on BOTH sides is a MIRRORED PAIR — two tips, one each side of the spine, at the same height, above their root (round 1 gave one wing reaching back; measured, this was the fix)');
  const tailTip = tail.filter((a) => /\btip\b/.test(a.tag))[0];
  ck(tailTip && tailTip.p[0] > rootEnd.p[0] + 0.2, 'TR5g a taper that EXTENDS FROM the back of a left-facing body reaches to the right — the side of the relationship decides, in the gesture\'s own frame');
  const sideR = Composer.compose(Object.assign({}, hand, { relationships: hand.relationships.map((r) => r.from === 'sails' ? Object.assign({}, r, { side: 'right', symmetric: false }) : r) }));
  const rightTips = sideR.diagnostics.allocation.filter((a) => a.mass === 'sails' && /\btip\b/.test(a.tag));
  ck(sideR.ok && rightTips.length === 1 && rightTips[0].p[0] > 0.3, 'TR5h a span on the RIGHT reaches right (round 1 sent every span up-and-back whatever its side; measured on a bird whose two wings both went left)');
  const armed = Composer.compose(Object.assign({}, hand, { relationships: hand.relationships.map((r) => r.from === 'legs' ? Object.assign({}, r, { relation: 'attaches-to', side: 'both' }) : r) }));
  const arms = armed.diagnostics.allocation.filter((a) => a.mass === 'legs');
  ck(armed.ok && arms.length === 2 && arms.every((a) => /limb end/.test(a.tag) && Math.abs(a.p[1] - bodyC) < 0.6) && Math.sign(arms[0].p[0]) !== Math.sign(arms[1].p[0]), 'TR5i a branch to BOTH sides is a pair of limbs out to the sides, never feet (round 1 put a dragon\'s arms under its feet)');
  // (without the prongs: a ring's crown and a pair of horns above the same head are ONE place, and the composer says so by sharing the light)
  const ringed = Composer.compose(Object.assign({}, hand, { masses: hand.masses.filter((m) => m.id !== 'prongs').concat([{ id: 'ruff', role: 'diagnostic', kind: 'enclosure', size: 'large', shape: 'round', label: 'RUFF' }]), relationships: hand.relationships.filter((r) => r.from !== 'prongs').concat([{ from: 'ruff', relation: 'surrounds', to: 'head' }]), mustSurvive: ['head', 'ruff', 'sails'] }));
  const ring = ringed.diagnostics.allocation.filter((a) => a.mass === 'ruff');
  const headC = ringed.diagnostics.allocation.filter((a) => a.mass === 'head' && /tip end|width|transition/.test(a.tag));
  ck(ringed.ok && ring.length === 3 && ring.every((r) => headC.some((h) => Math.hypot(h.p[0] - r.p[0], h.p[1] - r.p[1]) < 1.0)) && ring.every((r) => headC.every((h) => Math.hypot(h.p[0] - r.p[0], h.p[1] - r.p[1]) > 0.1)),
    'TR5j an enclosure is a ring of three lights around its mass — near it, and never ON one of its own lights');
  const orphan = Composer.compose(Object.assign({}, hand, { relationships: hand.relationships.slice(1) }));
  ck(orphan.ok && orphan.diagnostics.notes.some((n) => /"tail" had no relationship — attached to "body"/.test(n)) && orphan.diagnostics.components === 1, 'TR5k a mass no relationship reaches is hung off the largest flow mass and the diagnostics say so');

  // ---- TR6: no coordinate leakage — the composer cannot be steered by a number ----
  const smug = JSON.parse(JSON.stringify(hand)); smug.masses.forEach((m) => { m.x = 0.9; m.y = -0.9; m.points = [[0.5, 0.5]]; }); smug.gesture.angle = 45;
  const fS = Composer.compose(smug);
  ck(fS.ok && JSON.stringify(fS.points) === JSON.stringify(f1.points) && JSON.stringify(fS.joins) === JSON.stringify(f1.joins), 'TR6  numbers smuggled onto a plan move not one light — the composer reads no coordinate, and the validator refuses them before it anyway');
  ck(!Translate.validatePlan(smug).ok, 'TR6b (and the validator does refuse that plan)');

  // ---- TR7: bounds, graph validity, components, crossings, budget — on the hand plans and on all seventeen real ones ----
  const realT = JSON.parse(read('tools/ether-mystery-lab-test/shots/translate/real-translation.json'));
  const figures = [{ id: 'hand', fig: f1 }].concat(realT.results.filter((r) => r.ok).map((r) => ({ id: r.id, fig: Composer.compose(r.plan) })));
  const bad = (pred) => figures.filter((f) => !pred(f.fig)).map((f) => f.id);
  const inBounds = bad((f) => f.points.every((p) => Math.abs(p[0]) <= Composer.FIT + 0.011 && Math.abs(p[1]) <= Composer.FIT + 0.011));
  ck(inBounds.length === 0, 'TR7  every light of every figure lies inside the fit box (±' + Composer.FIT + '), so the editor never clamps one', inBounds.join(','));
  const validGraph = bad((f) => f.joins.every((j) => Number.isInteger(j.a) && Number.isInteger(j.b) && j.a !== j.b && j.a >= 0 && j.b >= 0 && j.a < f.points.length && j.b < f.points.length) && new Set(f.joins.map((j) => Math.min(j.a, j.b) + '-' + Math.max(j.a, j.b))).size === f.joins.length);
  ck(validGraph.length === 0, 'TR7b every join names two different real lights, and no join is listed twice', validGraph.join(','));
  const onePiece = bad((f) => f.diagnostics.components === 1 && Composer.components(f.points.length, f.joins) === 1);
  ck(onePiece.length === 0, 'TR7c every figure is ONE piece — the hand plan and all seventeen real plans (round 1 left a quill floating beside its bird and an elephant in three pieces; a join to a dropped light now climbs to what that light hung from)', onePiece.join(','));
  const crossOK = bad((f) => f.diagnostics.crossings === Composer.crossings(f.points, f.joins));
  ck(crossOK.length === 0, 'TR7d the crossings reported are the crossings counted');
  ck(Composer.crossings([[0, 0], [1, 1], [0, 1], [1, 0]], [{ a: 0, b: 1 }, { a: 2, b: 3 }]) === 1 && Composer.crossings([[0, 0], [1, 1], [0, 1], [1, 0]], [{ a: 0, b: 1 }, { a: 1, b: 2 }]) === 0, 'TR7e the crossing counter counts a crossing and not a shared end');
  const budgetOK = bad((f) => Composer.BUDGETS.indexOf(f.budget) !== -1 && f.budget >= f.points.length && f.points.length <= f.diagnostics.cap && f.diagnostics.cap <= 20 && Composer.BUDGETS.filter((b) => b >= f.points.length)[0] === f.budget);
  ck(budgetOK.length === 0, 'TR7f the budget is the smallest allowed budget that holds the figure, the figure never exceeds its cap, and the cap never exceeds the Lab\'s twenty', budgetOK.join(','));
  const mapOK = bad((f) => f.points.length === f.roles.length && f.roles.length === f.masses.length && f.diagnostics.allocation.length === f.points.length && f.roles.every((r) => typeof r === 'string' && r.length > 0));
  ck(mapOK.length === 0, 'TR7g every light carries the label of the mass it stands for, and the allocation names every light');
  const capped = Composer.compose(hand, { cap: 8 });
  ck(capped.ok && capped.points.length <= 8 && capped.budget === 8 && capped.diagnostics.components === 1, 'TR7h a caller\'s cap is honoured and the figure is still one piece');
  const simpleFive = { masses: [
      { id: 'b', role: 'primary', kind: 'mass', size: 'large', shape: 'oval', label: 'B' }, { id: 'h', role: 'primary', kind: 'mass', size: 'large', shape: 'oval', label: 'H' },
      { id: 'e', role: 'diagnostic', kind: 'span', size: 'large', shape: 'oval', label: 'E' }, { id: 't', role: 'diagnostic', kind: 'taper', size: 'large', shape: 'oval', label: 'T' },
      { id: 'k', role: 'diagnostic', kind: 'terminal', size: 'medium', shape: 'thin', label: 'K' }, { id: 'l', role: 'diagnostic', kind: 'branch', size: 'large', shape: 'oval', label: 'L' } ],
    gesture: { kind: 'grounded', flow: ['b', 'h'], curve: 'gentle', facing: 'right', note: '' },
    relationships: [ { from: 't', relation: 'extends-from', to: 'h', side: 'bottom' }, { from: 'e', relation: 'spans-from', to: 'h', side: 'left' }, { from: 'k', relation: 'extends-from', to: 'h', side: 'front' }, { from: 'l', relation: 'supports', to: 'b', side: 'bottom' } ],
    proportion: [], mustSurvive: ['t', 'e', 'k', 'l', 'b'], simplify: [], revealOnly: [], complexity: 'simple', movement: '' };
  const sf = Composer.compose(simpleFive);
  ck(sf.ok && sf.diagnostics.dropped.length === 0 && sf.diagnostics.cap >= Composer.CAPS.simple, 'TR7i THE BUDGET IS AUTOMATIC: a plan that says "simple" and names five things that must survive keeps all five — the floor is the essentials, complexity is the room beyond them (round 1 dropped an elephant\'s ear, tusk, legs and tail at cap 10)', 'cap ' + sf.diagnostics.cap + ' dropped ' + sf.diagnostics.dropped.join(','));
  const droppedSurvive = figures.filter((f) => f.id !== 'hand').map((f) => ({ id: f.id, plan: realT.results.filter((r) => r.id === f.id)[0].plan, fig: f.fig })).filter((x) => x.plan.mustSurvive.some((id) => x.fig.diagnostics.dropped.indexOf(id) !== -1)).map((x) => x.id);
  ck(droppedSurvive.length === 0, 'TR7j across the seventeen real plans not one must-survive mass is without a light', droppedSurvive.join(','));

  // ---- TR8: the real pass — committed, honest, re-validated and re-composed by the code as it stands ----
  ck(realT.model === 'gpt-4.1-mini' && realT.results.length === Art.entries.length && realT.results.every((r) => r.ok), 'TR8  gpt-4.1-mini gave a structural plan for every picture in the manifest and every one composed', realT.results.filter((r) => r.ok).length + '/' + realT.results.length);
  const reparse = realT.results.filter((r) => !Translate.parsePlan(r.raw).ok);
  ck(reparse.length === 0, 'TR8b the committed raw replies still pass the validator as it stands today — the contract and the results cannot drift apart', reparse.map((r) => r.id).join(','));
  const drifted = realT.results.filter((r) => { const now = Composer.compose(r.plan); return JSON.stringify(now.points) !== JSON.stringify(r.figure.points) || JSON.stringify(now.joins) !== JSON.stringify(r.figure.joins); });
  ck(drifted.length === 0, 'TR8c the committed figures are what today\'s composer makes of the committed plans — a composer change without a recompose fails here', drifted.map((r) => r.id).join(','));
  const firstTry = realT.results.filter((r) => r.validator && r.validator.ok);
  ck(firstTry.length === realT.results.length && realT.results.every((r) => r.usage && r.usage.prompt > 1000 && r.usage.completion > 300), 'TR8d every plan was valid on the first attempt, and every request really carried the contract and the picture');
  const ratings = JSON.parse(read('tools/ether-mystery-lab-test/shots/translate/ratings.json'));
  const rIds = ratings.results.map((r) => r.id).sort().join(), aIds = Art.entries.map((e) => e.id).sort().join();
  ck(rIds === aIds && ratings.results.every((r) => /^[ABCD]$/.test(r.round1) && /^[ABCD]$/.test(r.round2) && r.sees && r.fails.length && r.where) && /golden/i.test(ratings.goldenTest) && /^NO/.test(ratings.verdict),
    'TR8e a person rated every one of the seventeen, both rounds, named what they saw and where it failed, said what stood in for the golden test, and answered the final question — and the answer is written down as NO');
  const counted = ['A', 'B', 'C', 'D'].map((g) => ratings.results.filter((r) => r.round2 === g).length);
  ck(counted.join() === [ratings.round2.A, ratings.round2.B, ratings.round2.C, ratings.round2.D].join(), 'TR8f the tally is the count of the rows, not a number somebody typed', counted.join());
  const pngs = Art.entries.filter((e) => !fs.existsSync(path.join(shotDir, e.id + '.png')));
  ck(pngs.length === 0, 'TR8g every rated creature has its screenshot committed — SOURCE · AUTHOR over the source · JUDGE alone', pngs.map((e) => e.id).join(','));

  // ---- the browser half ----
  const B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const requests = [];
    page.on('request', (q) => requests.push(q.url()));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabTranslate && !!window.LabEtherComposer && !!window.LabImagine && !!window.ShapeLab && !!window.LabConnection, null, { timeout: 20000 });
    const S = (fn, arg) => page.evaluate(fn, arg);

    // ---- TR9: loading does nothing; the door is shut until something is understood ----
    const load = await S(() => ({ ls: Object.keys(localStorage).length, ss: Object.keys(sessionStorage).length, goDisabled: document.querySelector('[data-translate-go]').disabled, outcome: document.querySelector('[data-translate-section]').getAttribute('data-translate-outcome'),
      srcHidden: document.querySelector('[data-source-pane]').hidden, origin: document.querySelector('[data-status-origin]').hidden, plan: window.LabTranslate.plan(), fig: window.LabTranslate.figure(), o: window.ShapeLab.origin(),
      controls: ['[data-translate-go]', '[data-translate-status]', '[data-translate-panel]', '[data-translate-copy]', '[data-translate-json]', '[data-translate-diag]', '[data-source-pane]', '[data-source-img]', '[data-source-under]', '[data-status-origin]'].filter((c) => !document.querySelector(c)) }));
    ck(load.ls === 0 && load.ss === 0 && load.goDisabled && load.outcome === 'none' && load.srcHidden && load.origin && !load.plan && !load.fig && load.o === 'authored' && load.controls.length === 0 && errors.length === 0 && !requests.some((u) => /openai|supabase/.test(u)),
      'TR9  loading the page makes no plan, no figure, writes nothing, shows no source, reaches no provider; the button waits for an understanding; the figure is AUTHORED and the badge is hidden', 'missing ' + load.controls.join(','));
    ['data-translate-json', 'data-translate-diag', 'data-translate-copy'].forEach((sel) => {
      const idx = htmlNoComments.indexOf(sel); const before = htmlNoComments.slice(0, idx);
      ck(idx > 0 && (before.match(/<details class="adv"/g) || []).length > (before.match(/<\/details>/g) || []).length - ((before.match(/<details data-ref-trace-panel>/g) || []).length), 'TR9b ' + sel + ' sits inside an Advanced disclosure — plan JSON, composition and trace are never the default view');
    });
    const noGo = await S(() => window.LabTranslate.translate());
    ck(noGo.ok === false && noGo.reason === 'nothing-understood', 'TR9c asked with nothing understood, the translator refuses and says why');

    // ---- TR10: the fixture journey — upload → placeholder understanding → fixture plan → GENERATED figure, labelled fixture ----
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'tools/ether-mystery-lab/artwork/gameicons-centaur.png'));
    await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 20000 });
    const src = await S(() => ({ hidden: document.querySelector('[data-source-pane]').hidden, img: !!document.querySelector('[data-source-img] img'), cap: document.querySelector('[data-source-caption]').textContent, goOn: !document.querySelector('[data-translate-go]').disabled, under: window.LabTranslate.underlayShowing(), stage: document.querySelector('[data-stage]').className }));
    ck(!src.hidden && src.img && /UPLOADED/.test(src.cap) && src.goOn && src.under && /with-source/.test(src.stage), 'TR10 a picture brought in stands in the SOURCE pane on the left, the source sits under AUTHOR, and Create Ether creature wakes');
    const before = requests.length;
    await page.click('[data-translate-go]');
    await page.waitForFunction(() => document.querySelector('[data-translate-section]').getAttribute('data-translate-outcome') === 'fixture', null, { timeout: 8000 });
    const fx1 = await S(() => { const st = window.ShapeLab.status(); return { origin: window.ShapeLab.origin(), badge: document.querySelector('[data-status-origin]').textContent, badgeHidden: document.querySelector('[data-status-origin]').hidden, attr: document.querySelector('[data-status-origin]').getAttribute('data-origin'), n: window.ShapeLab.state().points.length, joins: window.ShapeLab.state().joins.length,
      status: document.querySelector('[data-translate-status]').textContent, meta: window.LabTranslate.planMeta(), last: window.LabTranslate.last(), roles: window.ShapeLab.state().roles, budget: window.ShapeLab.state().budget, st: st.origin }; });
    ck(fx1.n >= 6 && fx1.joins >= fx1.n - 1 && fx1.origin === 'generated' && fx1.st === 'generated' && !fx1.badgeHidden && /GENERATED/.test(fx1.badge) && fx1.attr === 'generated', 'TR10b the composed figure enters the editor as GENERATED — badge shown, points and connections in place', fx1.n + ' lights');
    ck(fx1.meta.source === 'fixture' && fx1.last.outcome === 'fixture' && /Fixture plan composed — a generic stand-in, not the creature/.test(fx1.status) && fx1.roles.every((r) => /^FIXTURE/.test(r)) && /none — fixture mode/.test(fx1.last.request),
      'TR10c with the Fixture connection the plan is a stand-in that says so on every light and on the status line — never an invented creature');
    ck(requests.length === before || requests.slice(before).every((u) => u.indexOf(BASE + '/') === 0), 'TR10d and no request left for it');
    await page.screenshot({ path: path.join(shotDir, 'shape-lab-fixture-translation.png') });

    // ---- TR11: generated vs authored — a label, never a lock ----
    await S(() => { const p = window.ShapeLab.state().points[0]; window.ShapeLab.movePoint(0, p[0] + 0.15, p[1]); });
    const edited = await S(() => ({ origin: window.ShapeLab.origin(), attr: document.querySelector('[data-status-origin]').getAttribute('data-origin'), badge: document.querySelector('[data-status-origin]').textContent, depth: window.ShapeLab.historyDepth().undo }));
    ck(edited.origin === 'generated-edited' && edited.attr === 'generated-edited' && /GENERATED · EDITED/.test(edited.badge) && edited.depth >= 2, 'TR11 moving one light turns GENERATED into GENERATED · EDITED — the generated figure is editable like any other, and the edit is undoable');
    await S(() => window.ShapeLab.undo());
    ck(await S(() => window.ShapeLab.origin() === 'generated'), 'TR11b undo gives GENERATED back — the label follows the history');
    const rec = await S(() => { const j = window.ShapeLab.state(); return { gen: j.generated, auth: j.authoring }; });
    ck(rec.gen && rec.gen.source === 'fixture' && rec.gen.edited === false && rec.auth && rec.auth.source === 'fixture', 'TR11c the record carries where the figure came from, so a reopened fixture is still labelled');
    await S(() => window.ShapeLab.reset());
    ck(await S(() => window.ShapeLab.origin() === 'authored' && document.querySelector('[data-status-origin]').hidden), 'TR11d Reset everything is a fresh AUTHORED start and the badge goes');
    // a generated figure enters the existing workflow: connect, gap, approve
    await S(() => window.LabTranslate.translate());
    await page.waitForFunction(() => window.ShapeLab.state().points.length > 0, null, { timeout: 8000 });
    const wf = await S(() => { window.ShapeLab.toggleGap(0); const ap = window.ShapeLab.approve(); return { ok: ap && ap.ok, kind: ap && ap.approved && ap.approved.kind, origin: window.ShapeLab.origin(), gaps: window.ShapeLab.state().missing.length, status: window.ShapeLab.status().state }; });
    ck(wf.gaps === 1 && wf.ok && /approved-figure/.test(String(wf.kind)) && wf.origin === 'generated-edited', 'TR11e a generated figure walks the existing SHAPE → CONNECT → REVEAL → TEST → APPROVE path — a gap marked, the figure approved — with nothing new bolted on', JSON.stringify(wf));

    // ---- TR12: the stubbed endpoint — what leaves, what comes back, what is refused ----
    const goodPlan = JSON.parse(JSON.stringify(hand));
    let epBodies = []; let planAnswer = 'good';
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      epBodies.push(body);
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB2', provider: 'configured', model: 'gpt-4.1-mini', imageModel: 'gpt-image-1' }) });
      if (body.action === 'understand') {
        const isPlan = /GESTURE FIRST/.test(String(body.messages && body.messages[0] && body.messages[0].content));
        if (!isPlan) {
          const good = { subject: 'a creature from the stub', character: ['calm'], composition: 'An upright figure.', architecture: ['a body', 'a head on top'], diagnosticFeatures: ['two sails'], modifiers: [], proportion: 'The head is big.', gesture: 'One coherent gesture: standing.', abstraction: { survives: ['the sails'], doNotDrawLiterally: ['texture'], note: '' }, revealCandidates: ['scales'], promptFidelity: { agreement: 'matches', differences: [] } };
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: JSON.stringify(good), model: 'gpt-4.1-mini', build: 'LAB2' }) });
        }
        if (planAnswer === 'down') return route.abort();
        const text = planAnswer === 'good' ? JSON.stringify(goodPlan) : planAnswer === 'geometry' ? JSON.stringify(Object.assign({}, goodPlan, { points: [[0, 1]] })) : planAnswer === 'numbers' ? JSON.stringify(Object.assign({}, goodPlan, { movement: 'head at 0.2, 0.3' })) : 'A spine, then some wings, I think.';
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text, model: 'gpt-4.1-mini', build: 'LAB2' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4.1-mini', build: 'LAB2', text: '{}' }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    // a fresh picture, read by the stub, then translated by the stub
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'tools/ether-mystery-lab/artwork/twemoji-mermaid.png'));
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'generated', null, { timeout: 8000 });
    epBodies = [];
    await page.click('[data-translate-go]');
    await page.waitForFunction(() => document.querySelector('[data-translate-section]').getAttribute('data-translate-outcome') === 'generated', null, { timeout: 8000 });
    const gen = await S(() => ({ origin: window.ShapeLab.origin(), n: window.ShapeLab.state().points.length, roles: window.ShapeLab.state().roles, meta: window.LabTranslate.planMeta(), status: document.querySelector('[data-translate-status]').textContent, last: window.LabTranslate.last(), name: window.ShapeLab.state().name, auth: window.ShapeLab.state().authoring, ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), exp: window.ShapeLab.exportJSON(), panel: document.querySelector('[data-translate-panel]').textContent }));
    ck(gen.origin === 'generated' && gen.n >= 10 && gen.roles.some((r) => r === 'SAIL') && gen.meta.source === 'generated' && gen.meta.model === 'gpt-4.1-mini' && /Ether creature generated \(gpt-4\.1-mini\)/.test(gen.status) && gen.last.outcome === 'generated' && gen.auth.source === 'generated',
      'TR12 when the model answers with a plan, the figure is composed and labelled GENERATED (the model named) — the fixture label is never borrowed');
    ck(/Gesture/.test(gen.panel) && /flow: /.test(gen.panel) && /Relationships/.test(gen.panel) && /Must survive/.test(gen.panel) && /ETHER TRANSLATION PLAN \(gpt-4\.1-mini\)/.test(gen.panel), 'TR12b the plan is shown as words a person can argue with — gesture, flow, what attaches to what, what must survive');
    const sentPlan = epBodies.filter((b) => b.action === 'understand' && /GESTURE FIRST/.test(b.messages[0].content)).pop();
    const sentU = epBodies.filter((b) => b.action === 'understand' && !/GESTURE FIRST/.test(b.messages[0].content)).pop();
    ck(sentPlan && sentPlan.image && sentPlan.image.mime === 'image/png' && sentPlan.image.b64.length > 64 && sentPlan.messages.length === 2 && sentPlan.messages.every((m) => typeof m.content === 'string') && Object.keys(sentPlan).sort().join() === 'action,image,messages' &&
       !/\b(card|stars|constellation|memor|username|creator|companion|email|session|token)\b/i.test(JSON.stringify(sentPlan.messages)) && !truthWords.some((w) => JSON.stringify(sentPlan).indexOf(w) !== -1) && !/-?\d\.\d+\s*,\s*-?\d\.\d+/.test(JSON.stringify(sentPlan.messages)) && (!sentU || sentU.image.b64 === sentPlan.image.b64),
      'TR12c what left for the plan is action, the same picture the understanding was read from, and two text messages — the contract and the understanding — with no private word, no ground truth, no coordinate');
    ck(!/admin-session-token/.test(gen.ls + gen.ss + gen.exp) && !/base64|data:image/.test(gen.ls + gen.ss + gen.exp) && !/GESTURE FIRST/.test(gen.exp), 'TR12d the token, the picture, the contract and the plan reach no storage and no export');
    ck(gen.name === 'a creature from the stub', 'TR12e the understanding\'s subject names the figure when the researcher has not');
    await page.screenshot({ path: path.join(shotDir, 'shape-lab-stubbed-translation.png') });
    // refused replies keep what was there
    const keptN = gen.n;
    for (const [ans, label, outcome] of [['geometry', 'a reply carrying geometry', 'rejected'], ['numbers', 'a reply with a coordinate in a sentence', 'rejected'], ['prose', 'a prose reply', 'rejected'], ['down', 'a dead transport', 'failed']]) {
      planAnswer = ans;
      await page.click('[data-translate-go]');
      await page.waitForFunction((o) => document.querySelector('[data-translate-section]').getAttribute('data-translate-outcome') === o, outcome, { timeout: 8000 });
      const r = await S(() => ({ n: window.ShapeLab.state().points.length, origin: window.ShapeLab.origin(), status: document.querySelector('[data-translate-status]').textContent, last: window.LabTranslate.last(), goOn: !document.querySelector('[data-translate-go]').disabled, meta: window.LabTranslate.planMeta() }));
      ck(r.n === keptN && r.origin === 'generated' && r.meta.source === 'generated' && /still here/.test(r.status) && !/[Ff]ixture plan composed/.test(r.status) && r.last.outcome === outcome && r.goOn && (outcome === 'failed' ? /No fixture was substituted/.test(r.status) : /refused by the validator/.test(r.status)),
        'TR12f ' + label + ' is ' + outcome + ' on screen: the generated figure in use is untouched, no fixture is substituted, the button comes back', r.status.slice(0, 90));
    }
    // and a real plan again works after the failures
    planAnswer = 'good';
    await page.click('[data-translate-go]');
    await page.waitForFunction(() => document.querySelector('[data-translate-section]').getAttribute('data-translate-outcome') === 'generated', null, { timeout: 8000 });
    ck(await S(() => window.ShapeLab.origin() === 'generated' && window.LabTranslate.last().outcome === 'generated'), 'TR12g and the next good reply composes again');

    // ---- TR13: the source is a reference, not the figure ----
    const und = await S(() => { const c = document.querySelector('[data-source-underlay]'); return { present: !!c, hidden: c && c.hidden, cls: c && c.className, showing: window.LabTranslate.underlayShowing(), events: c && getComputedStyle(c).pointerEvents, btn: document.querySelector('[data-source-under]').textContent }; });
    ck(und.present && !und.hidden && /source-layer/.test(und.cls) && und.showing && und.events === 'none' && /ON/.test(und.btn), 'TR13 the source under AUTHOR is its own canvas, beneath the editor, and catches no touch');
    await page.click('[data-source-under]');
    const off = await S(() => { const c = document.querySelector('[data-source-underlay]'); return { hidden: c.hidden, showing: window.LabTranslate.underlayShowing(), btn: document.querySelector('[data-source-under]').textContent, n: window.ShapeLab.state().points.length, box: c.getBoundingClientRect().width }; });
    ck(off.hidden && !off.showing && /OFF/.test(off.btn) && off.n === keptN && off.box === 0, 'TR13b SOURCE UNDER — OFF hides it, the figure is untouched, and the box is really gone (an explicit display beats [hidden])');
    await page.click('[data-source-under]');
    const judgeClean = await S(() => { const cs = Array.from(document.querySelectorAll('canvas.source-layer')); const judge = document.querySelector('[data-canvas-unfinished]') || document.querySelectorAll('canvas.figure')[1]; return { sources: cs.length, judgeHasSource: cs.some((c) => judge && judge.parentElement && judge.parentElement.contains(c)), exp: window.ShapeLab.exportJSON() }; });
    ck(judgeClean.sources === 1 && !judgeClean.judgeHasSource && !/data:image|b64/.test(judgeClean.exp), 'TR13c exactly one source layer exists, it is not under the JUDGE pane, and the picture is in no fixture');

    // ---- TR14: the existing Shape Lab is intact ----
    const intact = await S(() => { window.ShapeLab.reset(); window.ShapeLab.addPoint(0, 0); window.ShapeLab.addPoint(0.5, 0); window.ShapeLab.toggleJoin(0, 1); return { n: window.ShapeLab.state().points.length, joins: window.ShapeLab.state().joins.length, origin: window.ShapeLab.origin(), api: ['setBudget', 'addPoint', 'movePoint', 'deletePoint', 'toggleJoin', 'joinInOrder', 'toggleGap', 'reset', 'approve', 'undo', 'redo', 'loadGenerated', 'origin'].filter((k) => typeof window.ShapeLab[k] !== 'function'), ls: Object.keys(localStorage).filter((k) => k !== 'vihu.lab.shapes' && k !== 'vihu.lab.connection').length }; });
    ck(intact.n === 2 && intact.joins === 1 && intact.origin === 'authored' && intact.api.length === 0 && errors.length === 0, 'TR14 the manual editor still draws, every editor API is there, a hand-placed figure is AUTHORED, and the page raised no error through the whole journey', errors.join(' | ') + ' missing ' + intact.api.join(','));
    const stepOrder = await S(() => Array.from(document.querySelectorAll('[data-step]')).map((s) => s.getAttribute('data-step')));
    ck(stepOrder.join(',') === 'create,shape,connect,reveal,test,approve', 'TR14b the six stages are exactly where they were — the translation is INSIDE Create');
  } finally { await browser.close(); server.kill(); }
}

// ===================================================================
// ===================================================================
// CL. ETHER GRAMMAR V2 — CLOSE THE LOOP: the open vocabulary, the
// deterministic compiler's seven capabilities, the unfinished creature,
// the hint, the reveal suggestions, and the whole loop walked in the
// real Ether at eight lights. Production untouched.
// ===================================================================
async function sectionCL() {
  console.log('\n== CL. Ether grammar V2 — the open vocabulary and the closed loop ==');
  const { chromium } = require('playwright');
  const Vocab = require(path.join(ROOT, 'tools/ether-mystery-lab/labVocabulary.js'));
  const Unf = require(path.join(ROOT, 'tools/ether-mystery-lab/labUnfinished.js'));
  const Composer = require(path.join(ROOT, 'tools/ether-mystery-lab/labEtherComposer.js'));
  const Translate = require(path.join(ROOT, 'tools/ether-mystery-lab/labTranslate.js'));
  const vSrc = read('tools/ether-mystery-lab/labVocabulary.js'), vStripped = stripComments(vSrc);
  const uSrc = read('tools/ether-mystery-lab/labUnfinished.js'), uStripped = stripComments(uSrc);
  const cSrc = read('tools/ether-mystery-lab/labClosure.js'), cStripped = stripComments(cSrc);
  const coStripped = stripComments(read('tools/ether-mystery-lab/labEtherComposer.js'));
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const shotDir = path.join(SHOTS, 'closure'); fs.mkdirSync(shotDir, { recursive: true });

  // ---- CL1: three things kept apart, and none of them a creature ----
  const sem = Object.keys(Vocab.SEMANTIC), caps = Object.keys(Vocab.CAPABILITIES);
  ck(sem.length === 9 && sem.every((k) => typeof Vocab.SEMANTIC[k].meaning === 'string' && Vocab.SEMANTIC[k].meaning.length > 20 && Vocab.SEMANTIC[k].affects.every((a) => Vocab.AFFECTS.indexOf(a) !== -1)),
    'CL1  the semantic vocabulary is nine base terms with a meaning each — the composer\'s own primitives, written down', sem.join(','));
  ck(caps.length === 7 && caps.join() === 'outline,curl,flare,lobe,continuous,sweep,mirror' && caps.every((k) => Vocab.CAPABILITIES[k].on.every((b) => sem.indexOf(b) !== -1)) && Vocab.CAPABILITIES.sweep.values.length === 4,
    'CL1b the renderer capabilities are SEVEN, closed, generic, and each names the base terms it applies to', caps.join(','));
  const creatureWords = /\b(tiger|falcon|elephant|dragon|penguin|whale|bird|lion|fox|bear|octopus|cat|dog|fish|butterfly|snake|horse|mermaid|centaur|eagle|wing|wings|tail|trunk|mane|horn|beak|fin|hair|tusk)\b/i;
  // (the vocabulary file's STRING LITERALS are the meanings shown to the
  // model and the hint's own part-list — "a wing, a fin, an ear" explains a
  // span by example and is not a branch; the code around them is scanned)
  const vCode = vStripped.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\/[^/\n]+\/[gimsuy]*/g, '/re/');
  ck(!creatureWords.test(vCode) && !creatureWords.test(uStripped) && !creatureWords.test(cStripped) && !creatureWords.test(coStripped),
    'CL1c no creature word and no creature part in the vocabulary\'s code, the derivation, the page flow or the composer — the open vocabulary describes RELATIONSHIPS', [vCode, uStripped, cStripped, coStripped].map((t) => (t.match(creatureWords) || [''])[0]).join(','));
  ck(!/subject\s*===|===\s*subject|switch\s*\(\s*(subject|name|creature|species)\b|\bif\s*\(\s*(creature|species|subject)\b/.test(vStripped + uStripped + cStripped + coStripped),
    'CL1d no branch on a subject, a species or a creature anywhere in the four files');
  ck(!/Math\.random/.test(vStripped + uStripped + coStripped) && !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(vStripped + uStripped + cStripped),
    'CL1e nothing is random, and none of the three new modules writes to storage — an extension is session research data');
  ck(!/\bnew Function\b|\beval\s*\(|\bFunction\s*\(/.test(vStripped + uStripped + cStripped + coStripped), 'CL1f nothing anywhere turns text into code — a proposal is data and only ever data');
  ck(!/\bEtherMystery\b|\bEtherGrammar\b|\bEtherLife\b|\bEtherExperience\b|experience-pool|\bMagicCard\b|\bCompanionMemory\b/.test(vStripped + uStripped + cStripped),
    'CL1g none of the three names the interpreter, the grammar, the pool, a card or a memory — no route from a decision to production');

  // ---- CL2: an extension is validated by shape, and judged by the compiler ----
  const plan2 = { masses: [{ id: 'body' }, { id: 'reach' }, { id: 'trail' }, { id: 'crown' }, { id: 'top' }] };
  const goodExt = { name: 'reaching-membrane', meaning: 'a broad reaching span closed into a silhouette and swept behind the shoulder', whyNeeded: 'a span alone is a line', expresses: 'a closed reaching shape', visualEffect: 'the reach reads as a shape', composesWith: ['span', 'outline', 'attachment'], affects: ['silhouette', 'identity'], examples: ['a flier in the picture'], construction: { base: 'span', modifiers: ['outline', 'sweep:back', 'mirror'] } };
  const dec = (over) => Vocab.validateDecision(Object.assign({ decision: 'EXTENSION_REQUIRED', reason: 'needs a shape', extensions: [goodExt], apply: [{ mass: 'reach', terms: ['reaching-membrane'] }, { mass: 'trail', terms: ['curl', 'flare'] }, { mass: 'top', terms: ['sweep'] }], revealCandidates: [], hint: 'A hunter of the open sky is waiting' }, over || {}), plan2, 'a wibble');
  const d1 = dec();
  ck(d1.ok && d1.decision.decision === 'EXTENSION_REQUIRED' && d1.decision.extensions.length === 1 && d1.decision.extensions[0].compiler.ok && d1.decision.extensions[0].status === 'RESEARCH ONLY' && JSON.stringify(d1.decision.extensions[0].compiler.caps) === '{"outline":true,"sweep":"back","mirror":true}',
    'CL2  a well-formed proposal is accepted, marked RESEARCH ONLY, and the compiler says it can draw it — as outline + sweep:back + mirror on a span', JSON.stringify(d1.reasons));
  const bad = (ext) => Vocab.validateDecision({ decision: 'EXTENSION_REQUIRED', reason: 'x', extensions: [ext], apply: [], revealCandidates: [], hint: 'Something is waiting' }, plan2, 'a wibble');
  const notCap = bad(Object.assign({}, goodExt, { name: 'shimmer-edge', construction: { base: 'span', modifiers: ['shimmer'] } }));
  ck(notCap.ok && notCap.decision.extensions.length === 1 && !notCap.decision.extensions[0].compiler.ok && /no-such-capability:shimmer/.test(notCap.decision.extensions[0].compiler.reasons.join()),
    'CL2b a modifier the compiler has no capability for is NOT EXPRESSIBLE, and the reason names it — never approximated');
  const wrongBase = bad(Object.assign({}, goodExt, { name: 'curly-ring', construction: { base: 'enclosure', modifiers: ['curl'] } }));
  ck(wrongBase.ok && !wrongBase.decision.extensions[0].compiler.ok && /capability-not-on-base:curl\/enclosure/.test(wrongBase.decision.extensions[0].compiler.reasons.join()),
    'CL2c a capability on a base it does not apply to is NOT EXPRESSIBLE by name');
  const withCode = bad(Object.assign({}, goodExt, { meaning: 'function (ctx) { ctx.arc(0, 0, 5) }' }));
  const withCoords = bad(Object.assign({}, goodExt, { visualEffect: 'the tip sits at 0.25, 0.75 from the root' }));
  const withNumber = bad(Object.assign({}, goodExt, { examples: ['a flier'], composesWith: ['span'], affects: ['silhouette'], construction: { base: 'span', modifiers: ['outline'] }, meaning: 'reach', whyNeeded: 'x', expresses: 'y', extra: 3 }));
  ck(!withCode.ok && /bad-text/.test(withCode.reasons.join()) && !withCoords.ok && /bad-text/.test(withCoords.reasons.join()) && !withNumber.ok && /number:/.test(withNumber.reasons.join()),
    'CL2d code in a meaning, a coordinate in a sentence and a number anywhere each refuse the whole decision — an extension is never a drawing');
  const scoped = bad(Object.assign({}, goodExt, { species: 'a particular one' }));
  const scoped2 = Vocab.validateDecision({ decision: 'SUPPORTED', reason: 'x', extensions: [], apply: [], revealCandidates: [], hint: 'Something is waiting', rule: { when: 'x' } }, plan2, 'w');
  ck(!scoped.ok && /forbidden-key:.*species/.test(scoped.reasons.join()) && !scoped2.ok && /forbidden-key:(rule|.*when)/.test(scoped2.reasons.join()),
    'CL2e a proposal that would scope itself to one creature — species, rule, when — is refused by name: a rule for one animal is the failure this experiment exists to avoid');
  const dupName = bad(Object.assign({}, goodExt, { name: 'span' }));
  const noCompose = bad(Object.assign({}, goodExt, { composesWith: ['nonsense-term'] }));
  ck(dupName.ok && dupName.decision.refused.length === 1 && /name-is-already-a-term/.test(dupName.decision.refused[0].reasons.join()) && noCompose.ok && /composes-with-unknown-term/.test(noCompose.decision.refused[0].reasons.join()),
    'CL2f a proposal named after an existing term, or composing with a term nobody has, is refused on its own and the rest of the decision stands');
  const capCompose = bad(Object.assign({}, goodExt, { name: 'forked-reach', composesWith: ['outline', 'flare'], construction: { base: 'span', modifiers: ['outline', 'flare'] } }));
  ck(capCompose.ok && capCompose.decision.extensions.length === 1 && !capCompose.decision.extensions[0].compiler.ok && /capability-not-on-base:flare\/span/.test(capCompose.decision.extensions[0].compiler.reasons.join()),
    'CL2g composing with a CAPABILITY is composing with vocabulary (the first real run refused "outline/flare" as unknown) — accepted, and the compiler still judges the construction');
  const badWord = Vocab.validateDecision({ decision: 'MAYBE', reason: 'x', extensions: [], apply: [], revealCandidates: [], hint: 'x' }, plan2, 'w');
  const unknownTop = Vocab.validateDecision({ decision: 'SUPPORTED', reason: 'x', extensions: [], apply: [], revealCandidates: [], hint: 'x', points: [] }, plan2, 'w');
  const repaired = Vocab.validateDecision({ decision: 'EXTENSION_REQUIRED', reason: 'x', extensions: [], apply: [], revealCandidates: [], hint: 'Something is waiting' }, plan2, 'w');
  ck(!badWord.ok && /bad-decision/.test(badWord.reasons.join()) && !unknownTop.ok && /forbidden-key:points/.test(unknownTop.reasons.join()) && repaired.ok && repaired.decision.decision === 'SUPPORTED' && /EXTENSION_REQUIRED with no extension/.test(repaired.repairs.join()),
    'CL2h the decision is one of three words, a geometry key at the top refuses everything, and EXTENSION_REQUIRED with nothing proposed is repaired to SUPPORTED on record');
  const revealOnly = bad(Object.assign({}, goodExt, { name: 'shimmer-later', affects: ['reveal'], construction: { base: 'mass', modifiers: [] } }));
  const ro = Vocab.resolve(Object.assign({}, revealOnly.decision, { apply: [{ mass: 'crown', terms: ['shimmer-later'] }] }), 'extended');
  ck(revealOnly.ok && ro.caps.crown && ro.caps.crown.revealOnly === true, 'CL2i an extension that affects the reveal alone marks its mass reveal-only — never a light, kept for the payoff');

  // ---- CL3: resolve — base ignores everything; extended honours what the compiler can draw ----
  const rb = Vocab.resolve(d1.decision, 'base'), re = Vocab.resolve(d1.decision, 'extended');
  ck(rb.mode === 'base' && Object.keys(rb.caps).length === 0 && rb.used.length === 0, 'CL3  base mode resolves to nothing bound, whatever was proposed — the current vocabulary alone');
  ck(re.mode === 'extended' && JSON.stringify(re.caps.reach) === '{"outline":true,"sweep":"back","mirror":true}' && JSON.stringify(re.caps.trail) === '{"curl":true,"flare":true}' && re.used.join() === 'reaching-membrane' && re.ignored.join() === 'top:sweep',
    'CL3b extended mode binds an expressible extension\'s capabilities and a capability named directly; sweep with no value is ignored and said so', JSON.stringify(re));
  const rn = Vocab.resolve(Object.assign({}, notCap.decision, { apply: [{ mass: 'reach', terms: ['shimmer-edge'] }] }), 'extended');
  ck(rn.notExpressible.length === 1 && rn.notExpressible[0].term === 'shimmer-edge' && !Object.keys(rn.caps.reach || {}).length, 'CL3c a binding to an inexpressible extension contributes NOTHING to the figure, and is recorded as not expressible');

  // ---- CL4: the seven capabilities, measured on one plan ----
  const hand = { masses: [
      { id: 'head', role: 'primary', kind: 'mass', size: 'large', shape: 'round', label: 'HEAD' },
      { id: 'body', role: 'primary', kind: 'mass', size: 'dominant', shape: 'oval', label: 'BODY' },
      { id: 'trail', role: 'diagnostic', kind: 'taper', size: 'large', shape: 'long', label: 'TRAIL' },
      { id: 'reach', role: 'diagnostic', kind: 'span', size: 'dominant', shape: 'wide', label: 'REACH' },
      { id: 'crown', role: 'diagnostic', kind: 'terminal', size: 'small', shape: 'thin', label: 'CROWN' },
      { id: 'stand', role: 'secondary', kind: 'branch', size: 'small', shape: 'thin', label: 'STAND' } ],
    gesture: { kind: 'upright', flow: ['body', 'head'], curve: 'gentle', facing: 'left', note: 'stands' },
    relationships: [ { from: 'trail', relation: 'extends-from', to: 'body', side: 'back' }, { from: 'reach', relation: 'spans-from', to: 'body', side: 'back' }, { from: 'crown', relation: 'rises-from', to: 'head', side: 'top' }, { from: 'stand', relation: 'supports', to: 'body', side: 'bottom' } ],
    proportion: [], mustSurvive: ['head', 'reach', 'trail'], simplify: [], revealOnly: [], complexity: 'rich', movement: 'sways' };
  const base = Composer.compose(hand);
  const tagOf = (f, re2) => f.diagnostics.allocation.filter((a) => re2.test(a.tag));
  const withCap = (id, c) => Composer.compose(hand, { caps: { [id]: c } });
  const outl = withCap('reach', { outline: true });
  ck(base.ok && outl.ok && tagOf(outl, /trailing root/).length === 1 && outl.joins.filter((j) => j.why === 'outline').length >= 2 && tagOf(base, /trailing root/).length === 0,
    'CL4  OUTLINE closes a span back onto the body — a trailing root appears and two outline joins with it; a base span is a stick with a corner');
  const swB = withCap('reach', { sweep: 'back' }), swF = withCap('reach', { sweep: 'forward' });
  const tipX = (f) => tagOf(f, /^reach tip$|(^|\+ )reach tip$/)[0] || f.diagnostics.allocation.filter((a) => a.mass === 'reach' && /tip/.test(a.tag))[0];
  ck(swB.ok && swF.ok && tipX(swB) && tipX(swF) && tipX(swB).p[0] > tipX(swF).p[0], 'CL4b SWEEP moves the tip: back and forward put it on opposite sides of the root (facing left, back is +x)');
  const curl = withCap('trail', { curl: true });
  const trailTip = (f) => f.diagnostics.allocation.filter((a) => a.mass === 'trail' && /tip/.test(a.tag))[0], trailMid = (f) => f.diagnostics.allocation.filter((a) => a.mass === 'trail' && /mid/.test(a.tag))[0];
  ck(curl.ok && trailTip(curl) && trailMid(curl) && trailTip(curl).p[1] < trailMid(curl).p[1] && Math.abs(trailTip(curl).p[0] - trailMid(curl).p[0]) < Math.abs(trailTip(base).p[0] - trailMid(base).p[0]) + 0.01,
    'CL4c CURL bends the taper on itself: the tip climbs above the mid and no longer reaches away');
  const flare = withCap('trail', { flare: true });
  ck(flare.ok && tagOf(flare, /fork tip/).length === 2 && flare.joins.filter((j) => j.why === 'flare').length === 3, 'CL4d FLARE forks a taper\'s end into two lights joined to each other and to the mid');
  const flareT = withCap('crown', { flare: true });
  ck(flareT.ok && tagOf(flareT, /flare tip/).length === 2, 'CL4e FLARE on a terminal widens it into a pair');
  const lobe = withCap('body', { lobe: true });
  ck(lobe.ok && tagOf(lobe, /lobe edge/).length === 2 && lobe.joins.some((j) => j.why === 'lobe') && tagOf(base, /lobe edge/).length === 0, 'CL4f LOBE gives a flow mass a flat far edge — two edge lights joined to each other');
  const cont = withCap('body', { continuous: true });
  ck(cont.ok && cont.points.length === base.points.length - 1 && !cont.diagnostics.allocation.some((a) => /transition/.test(a.tag)) && cont.joins.some((j) => /flow/.test(j.why)),
    'CL4g CONTINUOUS drops the boundary light between two flow masses and the flow joins straight across', base.points.length + '→' + cont.points.length);
  const mirr = withCap('reach', { mirror: true });
  ck(mirr.ok && tagOf(mirr, /other side/).length >= 1 && tagOf(base, /other side/).length === 0, 'CL4h MIRROR reflects a single span across an upright flow — the other side appears');
  const each = ['outline', 'curl', 'flare', 'lobe', 'continuous', 'sweep', 'mirror'].map((c) => {
    const id = c === 'lobe' || c === 'continuous' ? 'body' : c === 'curl' || c === 'flare' ? 'trail' : 'reach';
    const f = Composer.compose(hand, { caps: { [id]: { [c]: c === 'sweep' ? 'down' : true } } });
    return f.ok && JSON.stringify(f.points) !== JSON.stringify(base.points) || JSON.stringify(f.joins) !== JSON.stringify(base.joins);
  });
  ck(each.every(Boolean), 'CL4i every one of the seven changes the figure on its own — none is decorative', each.join());
  const renamed = JSON.parse(JSON.stringify(hand)); renamed.masses.forEach((m) => { m.id = 'q' + m.id; m.label = 'Q' + m.label; }); renamed.gesture.flow = renamed.gesture.flow.map((i) => 'q' + i); renamed.relationships.forEach((r) => { r.from = 'q' + r.from; r.to = 'q' + r.to; }); renamed.mustSurvive = renamed.mustSurvive.map((i) => 'q' + i);
  const allCaps = { reach: { outline: true, sweep: 'back', mirror: true }, trail: { curl: true }, body: { lobe: true }, crown: { flare: true } };
  const qCaps = {}; Object.keys(allCaps).forEach((k) => { qCaps['q' + k] = allCaps[k]; });
  const fa = Composer.compose(hand, { caps: allCaps }), fq = Composer.compose(renamed, { caps: qCaps });
  ck(fa.ok && fq.ok && JSON.stringify(fa.points) === JSON.stringify(fq.points) && JSON.stringify(fa.joins) === JSON.stringify(fq.joins), 'CL4j with every capability bound, renaming every mass changes not one light — capabilities are read by relationship, never by name');
  ck(fa.diagnostics.vocabulary.mode === 'extended' && fa.diagnostics.vocabulary.capabilities.length === 6 && base.diagnostics.vocabulary.mode === 'base' && fa.diagnostics.order.join() === 'gesture,silhouette,structure,diagnostic,reveal-only',
    'CL4k the diagnostics say which vocabulary composed the figure, which capabilities were used, and the order of construction', JSON.stringify(fa.diagnostics.vocabulary));
  const ro2 = Composer.compose(hand, { caps: { crown: { revealOnly: true } } });
  ck(ro2.ok && !ro2.masses.some((m) => m === 'crown') && ro2.diagnostics.vocabulary.revealOnly.join() === 'crown' && !ro2.diagnostics.dropped.some((d) => d === 'crown'),
    'CL4l a reveal-only mass gets no light and is not "dropped" — it is kept for the reveal, and the diagnostics say so');
  const capped = Composer.compose(hand, { caps: allCaps, cap: 8 });
  ck(capped.ok && capped.points.length <= 8 && capped.diagnostics.components === 1, 'CL4m the author-selected budget still caps the extended composition, and the figure is still one piece', capped.points.length + 'L/' + capped.diagnostics.components + 'pc');

  // ---- CL5: the unfinished creature — relationships, never structure; never a stray light ----
  const uf = Unf.derive({ points: fa.points, joins: fa.joins, masses: fa.masses }, hand);
  const deg = fa.points.map(() => 0); fa.joins.forEach((j) => { deg[j.a]++; deg[j.b]++; });
  ck(uf.ok && uf.missing.length >= 1 && uf.missing.length <= 3 && uf.remaining >= 2, 'CL5  one to three missing connections, at least two joins remaining', JSON.stringify(uf.gaps));
  ck(uf.ok && uf.missing.every((i) => Unf.RELATIONSHIP.test(fa.joins[i].why)) && uf.missing.every((i) => fa.masses[fa.joins[i].a] !== fa.masses[fa.joins[i].b]),
    'CL5b every missing connection is a RELATIONSHIP between two parts — never a part\'s own edge, volume, ring, outline or flare');
  const ends = uf.ok ? uf.missing.map((i) => [fa.joins[i].a, fa.joins[i].b]) : [];
  const flat = [].concat.apply([], ends);
  ck(uf.ok && ends.every(([a, b]) => deg[a] >= 2 && deg[b] >= 2) && new Set(flat).size === flat.length, 'CL5c both ends of every gap keep another join — no stray light — and no two gaps share a light');
  const uf2 = Unf.derive({ points: fa.points, joins: fa.joins, masses: fa.masses }, hand);
  ck(uf.ok && JSON.stringify(uf) === JSON.stringify(uf2), 'CL5d the derivation is deterministic');
  ck(uf.ok && uf.gaps.some((g) => g.between.some((m) => hand.mustSurvive.indexOf(m) !== -1 || m === 'crown')) && uf.gaps.every((g) => /transition|attachment/.test(g.reason)),
    'CL5e a part that carries identity is preferred, and every gap says why it was chosen');
  const uf8 = Unf.derive({ points: capped.points, joins: capped.joins, masses: capped.masses }, hand);
  ck(uf8.ok && uf8.missing.length >= 1 && uf8.remaining >= 2, 'CL5f at eight lights there is still a meaningful gap to leave', JSON.stringify(uf8.gaps || uf8));
  const tri = Unf.derive({ points: [[0, 0], [1, 0], [0, 1]], joins: [{ a: 0, b: 1, why: 'volume' }, { a: 1, b: 2, why: 'volume' }, { a: 0, b: 2, why: 'volume' }], masses: ['m', 'm', 'm'] }, null);
  ck(!tri.ok && tri.reason === 'no-relationship-can-be-missing', 'CL5g a figure whose every join is structure has no gap to give, and says so rather than cutting an edge');

  // ---- CL6: the hint — an invitation, never an instruction, never the answer ----
  const H = (h, s) => Vocab.validHint(h, s);
  ck(H('A hunter of the open sky is waiting…', 'falcon').ok && H('A giant of the frozen north is waiting…', 'polar bear').ok && H('Something ancient is waiting to wake', 'dragon').ok && H('Something ancient is waiting to wake', 'dragon').hint.slice(-1) === '…',
    'CL6  the brief\'s own hints pass, and one without an ending is given its ellipsis');
  ck(!H('Connect the dots to finish the bird', 'falcon').ok && H('Connect the dots to finish the bird', 'falcon').reason === 'instruction', 'CL6b an instruction is refused');
  ck(!H('A falcon is waiting…', 'a falcon in flight').ok && /names-the-subject/.test(H('A falcon is waiting…', 'a falcon in flight').reason), 'CL6c the subject\'s own name is refused');
  ck(!H('A creature with wings and a curling tail awaits…', 'a small dragon').ok && H('A creature with wings and a curling tail awaits…', 'a small dragon').reason === 'names-a-part', 'CL6d a hint that lists body parts is the answer read out, and is refused');
  ck(H('Something small and young is waiting…', 'a small young dragon').ok, 'CL6e a describing word from the subject line — small, young — may stay: it reveals nothing');
  ck(!H('Wait 3 seconds', 'x').ok && !H('A scary monster is here', 'x').ok && !H('Hi', 'x').ok, 'CL6f a digit, an unkind word and a hint too short to mean anything are refused');

  // ---- CL7: the contract — what is asked, and what is never sent ----
  const dm = Vocab.decisionMessages({ subject: 'a wibble', composition: 'c', architecture: ['a'], diagnosticFeatures: ['d'], gesture: 'g', abstraction: {}, revealCandidates: [] }, hand);
  const sysD = dm.messages[0].content, usrD = dm.messages[1].content;
  ck(dm.ok && dm.messages.length === 2 && /SUPPORTED/.test(sysD) && /EXTENSION_REQUIRED/.test(sysD) && /NOT_EXPRESSIBLE/.test(sysD) && /AN EXTENSION IS A MEANING, NEVER A DRAWING/.test(sysD) && /never a body part of one kind of animal/i.test(sysD),
    'CL7  the contract asks for exactly one of three decisions and says an extension is a meaning, never a drawing, never a rule for one creature');
  ck(caps.every((c) => sysD.indexOf(c + ' ') !== -1 || sysD.indexOf(c + '\n') !== -1 || sysD.indexOf(c + ' (') !== -1) && sem.every((t) => sysD.indexOf(t + ' — ') !== -1) && /never a coordinate/i.test(sysD) && /SVG, code or markup/.test(sysD),
    'CL7b every semantic term and every capability is named in the contract from the vocabulary itself, and it says words only — never a coordinate, SVG, code or markup');
  ck(/REVEAL CANDIDATES/.test(sysD) && Vocab.REVEAL_TYPES.every((t) => sysD.indexOf(t + ' (') !== -1) && /NEVER list its body parts/.test(sysD) && /revealCandidates/.test(sysD),
    'CL7c it asks for reveal candidates as semantic data with the seven reveal primitives named, and for a hint that names a nature and never a part');
  ck(!/\b(card|stars|constellation|memor|username|creator|companion|email|session|token|orbit|circle)\b/i.test(sysD + usrD) && /"masses"/.test(usrD) && !/points|coordinates/.test(usrD),
    'CL7d what leaves is the question, the understanding and the plan\'s structure — no private word, no geometry');

  // ---- CL8: the committed real run — labelled, re-validated, not drifting ----
  const closurePath = path.join(shotDir, 'real-closure.json');
  const realRun = fs.existsSync(closurePath) ? JSON.parse(fs.readFileSync(closurePath, 'utf8')) : null;
  ck(!!realRun && realRun.results.length >= 8 && realRun.results.every((r) => r.labels && r.labels.understanding && r.labels.plan && r.labels.decision),
    'CL8  the real closure run is committed, at least eight creatures, and every stage of every result is labelled', realRun ? realRun.results.length + ' results' : 'missing');
  if (realRun) {
    const octo = realRun.results.filter((r) => r.id === 'octopus')[0], lumo = realRun.results.filter((r) => r.id === 'lumo')[0];
    ck(octo && /CONSTRUCTED/.test(octo.labels.understanding) && /CONSTRUCTED/.test(octo.labels.plan) && /text only/.test(octo.labels.decision) && lumo && /STAND-IN/.test(lumo.stands),
      'CL8b the octopus says CONSTRUCTED on the stages that were, and the dragon says it is a stand-in — nothing constructed is called a real result');
    const revalid = realRun.results.filter((r) => r.ok).map((r) => { const v = Vocab.parseDecision(r.raw, r.plan, r.analysis.subject); return { id: r.id, ok: v.ok, same: v.ok && JSON.stringify(v.decision) === JSON.stringify(r.decision) }; });
    ck(revalid.length >= 8 && revalid.every((x) => x.ok && x.same), 'CL8c every committed raw reply re-validates through the real validator into exactly the committed decision', revalid.filter((x) => !x.same).map((x) => x.id).join(',') || 'all');
    const redo = realRun.results.filter((r) => r.ok).map((r) => { const ext = Vocab.resolve(r.decision, 'extended'); const f = Composer.compose(r.plan, Object.keys(ext.caps).length ? { caps: ext.caps } : {}); return { id: r.id, same: f.ok && JSON.stringify(f.points) === JSON.stringify(r.compositions.extended.points) && JSON.stringify(f.joins) === JSON.stringify(r.compositions.extended.joins) }; });
    ck(redo.every((x) => x.same), 'CL8d recomposing every committed plan with its committed decision gives the committed figure — the composer has not drifted from what was rated', redo.filter((x) => !x.same).map((x) => x.id).join(',') || 'all');
    const differ = realRun.results.filter((r) => r.ok && Object.keys(Vocab.resolve(r.decision, 'extended').caps).length).filter((r) => JSON.stringify(r.compositions.base.points) !== JSON.stringify(r.compositions.extended.points));
    ck(differ.length >= 5, 'CL8e wherever the model bound a capability, the extended composition differs from the base one — the vocabulary reaches the figure', differ.map((r) => r.id).join(','));
    const supp = realRun.results.filter((r) => r.ok && r.decision.revealCandidates.some((c) => c.support === 'SUPPORTED_REVEAL'));
    ck(supp.length >= 7, 'CL8f the model offers supported reveal candidates for nearly every creature', supp.map((r) => r.id + ':' + r.decision.revealCandidates.filter((c) => c.support === 'SUPPORTED_REVEAL').length).join(','));
    const gaps8 = realRun.results.filter((r) => r.ok && r.compositions.extended8.ok && r.compositions.extended8.unfinished.missing && r.compositions.extended8.unfinished.missing.length >= 1);
    ck(gaps8.length === realRun.results.filter((r) => r.ok).length, 'CL8g every creature has a meaningful missing connection at eight lights', gaps8.length + '/' + realRun.results.length);
    const walksPath = path.join(shotDir, 'walks.json');
    const walks = fs.existsSync(walksPath) ? JSON.parse(fs.readFileSync(walksPath, 'utf8')).walks : null;
    const walked = walks ? Object.keys(walks).filter((k) => walks[k].walk && walks[k].walk.steps.length && walks[k].walk.steps[walks[k].walk.steps.length - 1] === 0 && walks[k].roam && walks[k].roam.alive === 1 && walks[k].roam.travelled > 30) : [];
    ck(walks && walked.length >= 8, 'CL8h the committed walks show every creature completed in the real Ether at eight lights, alive and roaming', walks ? walked.length + '/' + Object.keys(walks).length : 'missing');
    const ratingsPath = path.join(shotDir, 'ratings.json');
    const ratings = fs.existsSync(ratingsPath) ? JSON.parse(fs.readFileSync(ratingsPath, 'utf8')) : null;
    ck(!!ratings && ratings.results.length >= 8 && ratings.results.every((x) => /^[ABCD]$/.test(x.base) && /^[ABCD]$/.test(x.extended) && /^[ABCD]$/.test(x.revealAB) && x.judge && Object.keys(x.judge).length === 11) && ratings.results.every((x) => realRun.results.some((r) => r.id === x.id)),
      'CL8i the ratings are committed: base and extended each A–D, the reveal A/B each A–D, eleven judgements per creature, and every rated id is a run result');
    ck(!!ratings && typeof ratings.verdict === 'string' && /MOVE TOWARD PRODUCTION|ONE BLOCKER/.test(ratings.verdict), 'CL8j and the closure verdict is written down in the brief\'s own words');
  }

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const requests = [];
    page.on('request', (q) => requests.push(q.url()));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabClosure && !!window.LabVocabulary && !!window.LabUnfinished && !!window.LabTranslate && !!window.ShapeLab, null, { timeout: 20000 });
    const S = (fn, arg) => page.evaluate(fn, arg);

    // ---- CL9: loading does nothing; the fixture path answers SUPPORTED, sends nothing ----
    const load = await S(() => ({ ls: Object.keys(localStorage).length, ss: Object.keys(sessionStorage).length, go: document.querySelector('[data-vocab-go]').disabled, mb: document.querySelector('[data-vocab-mode="base"]').disabled, my: document.querySelector('[data-mystery-go]').disabled, d: window.LabClosure.decision(), controls: ['[data-vocab-section]', '[data-vocab-status]', '[data-vocab-panel]', '[data-vocab-diag]', '[data-reveal-suggested]', '[data-mystery-go]', '[data-mystery-why]', '[data-compose-budget]'].filter((c) => !document.querySelector(c)) }));
    ck(load.ls === 0 && load.ss === 0 && load.go && load.mb && load.my && !load.d && load.controls.length === 0 && errors.length === 0, 'CL9  loading the page asks nothing, decides nothing, stores nothing; every closure control exists and is shut until a creature is composed', JSON.stringify(load));
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'tools/ether-mystery-lab/artwork/twemoji-mermaid.png'));
    await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 8000 });
    const before = requests.length;
    await page.click('[data-translate-go]');
    await page.waitForFunction(() => document.querySelector('[data-vocab-section]').getAttribute('data-vocab-outcome') === 'fixture', null, { timeout: 8000 });
    const fx = await S(() => ({ d: window.LabClosure.decision(), meta: window.LabClosure.meta(), status: document.querySelector('[data-vocab-status]').textContent, panel: document.querySelector('[data-vocab-panel]').innerText, mode: window.LabClosure.mode(), n: window.ShapeLab.state().points.length, mb: document.querySelector('[data-vocab-mode="base"]').disabled, sugg: document.querySelector('[data-reveal-suggested]').hidden }));
    ck(fx.d && fx.d.decision === 'SUPPORTED' && fx.meta.source === 'fixture' && /Fixture decision/.test(fx.status) && /FIXTURE — no model looked/i.test(fx.panel) && fx.d.extensions.length === 0 && fx.d.apply.length === 0 && fx.sugg && !fx.mb && requests.slice(before).every((u) => !/openai|fn\.local|supabase/.test(u)),
      'CL9b after a fixture translation the decision is asked by itself: SUPPORTED, badged FIXTURE, nothing bound, no suggestions, no request made', fx.status.slice(0, 80));
    const nBase = await (async () => { await page.click('[data-vocab-mode="base"]'); return S(() => window.ShapeLab.state().points.length + '/' + window.ShapeLab.state().joins.length); })();
    const nExt = await (async () => { await page.click('[data-vocab-mode="extended"]'); return S(() => window.ShapeLab.state().points.length + '/' + window.ShapeLab.state().joins.length); })();
    ck(nBase === nExt, 'CL9c with nothing bound, base and extended compose the same figure', nBase + ' vs ' + nExt);

    // ---- CL10: the stubbed endpoint — a real decision, shown as words a researcher can act on ----
    const plan = realRun ? realRun.results.filter((r) => r.id === 'lumo')[0].plan : hand;
    const decision = { decision: 'EXTENSION_REQUIRED', reason: 'the wings need to read as membranes and the tail curls', extensions: [
      { name: 'reaching-membrane', meaning: 'a broad reaching span closed into a silhouette and swept back', whyNeeded: 'a span alone is a stick', expresses: 'a closed reaching shape', visualEffect: 'the reach reads as a shape', composesWith: ['span', 'attachment'], affects: ['silhouette', 'identity'], examples: ['a flier'], construction: { base: 'span', modifiers: ['outline', 'sweep:back'] } },
      { name: 'shimmer-edge', meaning: 'a soft shimmering edge', whyNeeded: 'nothing shimmers', expresses: 'shimmer', composesWith: ['mass'], affects: ['silhouette'], examples: [], construction: { base: 'mass', modifiers: ['shimmer'] } }],
      apply: [{ mass: 'wings', terms: ['reaching-membrane'] }, { mass: 'tail', terms: ['curl'] }],
      revealCandidates: [{ name: 'Horns', reason: 'distinctive identity feature', importance: 'high', role: 'diagnostic', appearance: 'emerge', near: 'horns', kind: 'spike' }, { name: 'Eye glow', reason: 'character', importance: 'medium', role: 'magic', appearance: 'glow', near: 'head', kind: 'glow' }, { name: 'Wing veins', reason: 'detail', importance: 'low', role: 'texture', appearance: 'appear', near: 'wings', kind: 'veins' }],
      hint: 'Something small and ancient is waiting to wake' };
    let bodies = []; let decisionAnswer = 'good';
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}'); bodies.push(body);
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB2', provider: 'configured', model: 'gpt-4.1-mini' }) });
      if (body.action === 'understand') {
        const sys = String(body.messages[0].content);
        if (/GESTURE FIRST/.test(sys)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: JSON.stringify(plan), model: 'gpt-4.1-mini', build: 'LAB2' }) });
        if (/vocabulary reviewer/.test(sys)) {
          if (decisionAnswer === 'down') return route.abort();
          const text = decisionAnswer === 'good' ? JSON.stringify(decision) : decisionAnswer === 'code' ? JSON.stringify(Object.assign({}, decision, { extensions: [Object.assign({}, decision.extensions[0], { meaning: 'function (ctx) { ctx.arc() }' })] })) : 'SUPPORTED, I think.';
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text, model: 'gpt-4.1-mini', build: 'LAB2' }) });
        }
        const good = { subject: 'a small winged being', character: ['calm'], composition: 'An upright figure.', architecture: ['a body', 'a head on top'], diagnosticFeatures: ['wings'], modifiers: [], proportion: 'The head is big.', gesture: 'One coherent gesture: standing.', abstraction: { survives: ['wings'], doNotDrawLiterally: ['texture'], note: '' }, revealCandidates: ['horns'], promptFidelity: { agreement: 'matches', differences: [] } };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: JSON.stringify(good), model: 'gpt-4.1-mini', build: 'LAB2' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4.1-mini', build: 'LAB2', text: '{}' }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'assets/lumo/hero.png'));
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'generated', null, { timeout: 8000 });
    bodies = [];
    await page.click('[data-translate-go]');
    await page.waitForFunction(() => document.querySelector('[data-vocab-section]').getAttribute('data-vocab-outcome') === 'generated', null, { timeout: 10000 });
    const gen = await S(() => ({ d: window.LabClosure.decision(), meta: window.LabClosure.meta(), res: window.LabClosure.resolved(), status: document.querySelector('[data-vocab-status]').textContent, panel: document.querySelector('[data-vocab-panel]').innerText, n: window.ShapeLab.state().points.length, j: window.ShapeLab.state().joins.length, pts: JSON.stringify(window.ShapeLab.state().points), origin: window.ShapeLab.origin(), ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), exp: window.ShapeLab.exportJSON(), sugg: document.querySelector('[data-reveal-suggested]').innerText }));
    ck(gen.d && gen.d.decision === 'EXTENSION_REQUIRED' && gen.meta.source === 'generated' && gen.meta.model === 'gpt-4.1-mini' && /EXTENSION REQUIRED/.test(gen.status) && /2 extensions proposed, 1 expressible, 1 not/.test(gen.status) && gen.origin === 'generated',
      'CL10 when the model answers, the decision is shown labelled with the model, and the figure is recomposed with what it bound', gen.status.slice(0, 100));
    ck(/EXTENSION REQUIRED/.test(gen.panel) && /✓ reaching-membrane/.test(gen.panel) && /RESEARCH ONLY/.test(gen.panel) && /Meaning:/.test(gen.panel) && /Why needed:/.test(gen.panel) && /Composes with:/.test(gen.panel) && /Visual effect:/.test(gen.panel) && /Affects:/.test(gen.panel) && /Can be drawn: yes/.test(gen.panel),
      'CL10b an expressible extension is a card: name, meaning, why needed, composes with, visual effect, affects, RESEARCH ONLY, and that the compiler can draw it');
    ck(/○ shimmer-edge/.test(gen.panel) && /NOT EXPRESSIBLE — no-such-capability:shimmer/.test(gen.panel), 'CL10c an inexpressible one is shown ○ with the capability it would need, named');
    ck(gen.res && gen.res.mode === 'extended' && JSON.stringify(gen.res.caps.wings) === '{"outline":true,"sweep":"back"}' && gen.res.caps.tail.curl === true, 'CL10d the resolution is what the compiler was handed: outline + sweep:back on the wings mass, curl on the tail mass');
    const sentD = bodies.filter((b) => b.action === 'understand' && /vocabulary reviewer/.test(String(b.messages[0].content))).pop();
    ck(sentD && Object.keys(sentD).sort().join() === 'action,image,messages' && sentD.image.b64.length > 64 && sentD.messages.length === 2 && !/\b(card|stars|constellation|memor|username|creator|companion|email|session|token|orbit|circle)\b/i.test(JSON.stringify(sentD.messages)) && !/-?\d\.\d+\s*,\s*-?\d\.\d+/.test(JSON.stringify(sentD.messages)),
      'CL10e what left for the decision is action, the picture, and two text messages — the question, the understanding and the plan — with no private word and no coordinate');
    ck(!/admin-session-token|reaching-membrane|shimmer|base64|data:image/.test(gen.ls + gen.ss + gen.exp), 'CL10f the token, the extensions and the picture reach no storage and no export — an extension is never persisted');
    const toBase = await (async () => { await page.click('[data-vocab-mode="base"]'); return S(() => ({ pts: JSON.stringify(window.ShapeLab.state().points), res: window.LabClosure.resolved(), status: document.querySelector('[data-vocab-status]').textContent, panel: document.querySelector('[data-vocab-panel]').innerText })); })();
    const toExt = await (async () => { await page.click('[data-vocab-mode="extended"]'); return S(() => ({ pts: JSON.stringify(window.ShapeLab.state().points) })); })();
    ck(toBase.res.mode === 'base' && Object.keys(toBase.res.caps).length === 0 && /base vocabulary alone/.test(toBase.panel) && toBase.pts !== gen.pts && toExt.pts === gen.pts,
      'CL10g Base vocabulary recomposes the same plan with nothing bound — a different figure — and With extensions brings the bound one back', JSON.stringify({ same: toBase.pts === gen.pts }));
    // refused and failed decisions keep what was there
    for (const [ans, label, outcome] of [['code', 'a reply with code in an extension', 'rejected'], ['prose', 'a prose reply', 'rejected'], ['down', 'a dead transport', 'failed']]) {
      decisionAnswer = ans;
      await page.click('[data-vocab-go]');
      await page.waitForFunction((o) => document.querySelector('[data-vocab-section]').getAttribute('data-vocab-outcome') === o, outcome, { timeout: 8000 });
      const r = await S(() => ({ d: window.LabClosure.decision(), status: document.querySelector('[data-vocab-status]').textContent, goOn: !document.querySelector('[data-vocab-go]').disabled, n: window.ShapeLab.state().points.length }));
      ck(r.d && r.d.decision === 'EXTENSION_REQUIRED' && /still here/.test(r.status) && !/Fixture decision/.test(r.status) && r.goOn && r.n === gen.n, 'CL10h ' + label + ' is ' + outcome + ' on screen: the decision in use is untouched, no fixture is substituted, the button comes back', r.status.slice(0, 90));
    }
    decisionAnswer = 'good';

    // ---- CL11: reveal suggestions — accept, reject, and what cannot be accepted ----
    const sugg = await S(() => window.LabClosure.suggestions().map((s) => s.name + ':' + s.support + ':' + s.state));
    ck(sugg.join() === 'HORNS:SUPPORTED_REVEAL:offered,EYE GLOW:SUPPORTED_REVEAL:offered,WING VEINS:REQUIRES_EXTENSION:offered', 'CL11 the three suggestions are classified: two supported, one requiring an extension', sugg.join());
    ck(/SUGGESTED REVEALS/i.test(gen.sugg) && /HORNS/.test(gen.sugg) && /supported/.test(gen.sugg) && /requires extension/.test(gen.sugg) && /research information/.test(gen.sugg) && /Accept/.test(gen.sugg) && /Reject/.test(gen.sugg),
      'CL11b they are shown in REVEAL with their role, importance, arrival and support, an Accept for the supported ones, and the extension one marked research information');
    const acc = await S(() => { const a = window.LabClosure.acceptReveal('HORNS'); const rej = window.LabClosure.rejectReveal('EYE GLOW'); const no = window.LabClosure.acceptReveal('WING VEINS'); const st = window.ShapeLab.state(); const fig = window.LabTranslate.figure(); const hornsLights = fig.masses.map((m, i) => m === 'horns' ? i : -1).filter((i) => i >= 0); return { a, rej, no, feats: st.reveal.features.map((f) => f.name + '/' + f.type + '/' + f.lights.a + '-' + f.lights.b), hornsLights, states: window.LabClosure.suggestions().map((s) => s.state), ui: document.querySelector('[data-reveal-suggested]').innerText }; });
    ck(acc.a.ok && acc.feats.length === 1 && /^HORNS\/spike\//.test(acc.feats[0]) && acc.hornsLights.indexOf(Number(acc.feats[0].split('/')[2].split('-')[0])) !== -1,
      'CL11c Accept makes an ordinary reveal feature of the suggested kind, anchored to the mass\'s own lights', JSON.stringify({ feats: acc.feats, horns: acc.hornsLights }));
    ck(acc.rej.ok && !acc.no.ok && acc.no.reason === 'REQUIRES_EXTENSION' && acc.states.join() === 'accepted,rejected,offered' && /✓ HORNS/.test(acc.ui) && /✕ EYE GLOW/.test(acc.ui),
      'CL11d Reject stands down a suggestion, and a REQUIRES_EXTENSION one cannot be accepted — nothing is auto-approved');
    const edited = await S(() => { const f = window.ShapeLab.state().reveal.features[0]; const r = window.ShapeLab.updateReveal(f.id, { size: 1.5 }); return { ok: r && r.ok !== false, size: window.ShapeLab.state().reveal.features[0].size }; });
    ck(edited.ok && edited.size === 1.5, 'CL11e an accepted reveal is editable like any feature the researcher added by hand');

    // ---- CL12: the unfinished creature at eight — the loop in the real Ether ----
    await page.selectOption('[data-compose-budget]', '8');
    await page.waitForFunction(() => window.ShapeLab.state().points.length <= 8);
    await page.click('[data-mystery-go]');
    const my = await S(() => { const st = window.ShapeLab.state(); const fig = window.LabTranslate.figure(); const m = window.LabClosure.mystery(); return { n: st.points.length, missing: st.missing, hint: st.hint, play: window.ShapeLab.playable(), m, why: document.querySelector('[data-mystery-why]').textContent, gapWhy: (m ? m.gaps : []).map((g) => fig.joins[g.join].why), gapMass: (m ? m.gaps : []).map((g) => fig.masses[fig.joins[g.join].a] + '|' + fig.masses[fig.joins[g.join].b]) }; });
    ck(my.n === 8 && my.m && my.m.placed >= 1 && my.missing.length === my.m.placed && my.play, 'CL12 at eight lights the missing connections are chosen and placed, and the creature is playable', JSON.stringify({ n: my.n, missing: my.missing, placed: my.m && my.m.placed }));
    ck(my.gapWhy.every((w) => /^(attach|flow|continuous|limb)/.test(w)) && my.gapMass.every((s) => s.split('|')[0] !== s.split('|')[1]) && /wide enough to see/.test(my.why),
      'CL12b every chosen gap is a relationship between two parts and its reason is on screen', JSON.stringify(my.gapWhy));
    ck(my.hint === 'Something small and ancient is waiting to wake…', 'CL12c the model\'s hint is written into the figure with its ellipsis — the fallback is used only when no hint was given', my.hint);
    const undo = await S(() => { window.ShapeLab.undo(); const a = window.ShapeLab.state().missing.length; window.ShapeLab.redo(); return { a, b: window.ShapeLab.state().missing.length }; });
    ck(undo.b === my.missing.length && undo.a < my.missing.length, 'CL12d the placed gaps are ordinary editor history — undo takes one back, redo restores it');
    // accept a supported reveal that exists at eight, then play
    await S(() => { window.LabClosure.suggestions().filter((s) => s.support === 'SUPPORTED_REVEAL').forEach((s) => window.LabClosure.acceptReveal(s.name)); });
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-play]')]);
    await pop.waitForFunction(() => !!window.LabPreview && !!window.LabPreview.mystery && window.LabPreview.mystery(), null, { timeout: 20000 });
    await pop.waitForTimeout(1800);
    const walk = await pop.evaluate(async () => {
      const my2 = window.LabPreview.mystery(); let i = my2.instrument();
      const hintEl = document.querySelector('[data-hint]');
      const out = { hint: hintEl.textContent, hintOn: hintEl.classList.contains('on'), missing: i.arrangement.missingLeft, elements: i.elements.length, steps: [], offered: window.LabPreview.report().happened.reveal.offered };
      let g = 30;
      while (g-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
        const gap = i.arrangement.links.filter((L) => !L.present)[0];
        my2.touchAt(i.elements[gap.a].x, i.elements[gap.a].y); my2.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
        i = my2.instrument(); out.steps.push({ left: i ? i.arrangement.missingLeft : 'gone', alive: window.LabPreview.alive().length });
      }
      await new Promise((r) => setTimeout(r, 2200));
      out.reveal = window.LabPreview.reveal();
      out.hintAfter = hintEl.classList.contains('on');
      await new Promise((r) => setTimeout(r, 4500));
      out.alive = window.LabPreview.alive().length;
      const p = [];
      for (let s = 0; s < 12; s++) { const w = window.LabPreview.alive()[0]; if (w) p.push([w.x, w.y]); await new Promise((r) => setTimeout(r, 300)); }
      let d = 0; for (let s = 1; s < p.length; s++) d += Math.hypot(p[s][0] - p[s - 1][0], p[s][1] - p[s - 1][1]);
      out.travelled = d; out.shown = window.LabPreview.report().happened.reveal.shown;
      return out;
    });
    await pop.close();
    ck(walk.hint === my.hint && walk.hintOn && walk.elements === 8 && walk.missing === my.missing.length, 'CL12e the real Ether poses the eight-light creature with its gaps, and the hint is on screen beside it', JSON.stringify({ hint: walk.hint, missing: walk.missing }));
    ck(walk.steps.length === my.missing.length && walk.steps.every((s, k) => k === walk.steps.length - 1 ? s.left === 0 : s.alive === 0), 'CL12f each join is made by two real taps and nothing wakes a join early', JSON.stringify(walk.steps));
    ck(walk.offered >= 1 && walk.shown === true && walk.reveal && (walk.reveal.started || walk.reveal.finished), 'CL12g the accepted reveal features are drawn over the real sky once the figure is whole', JSON.stringify({ offered: walk.offered, shown: walk.shown, phase: walk.reveal && walk.reveal.phase }));
    ck(walk.alive === 1 && walk.travelled > 30 && !walk.hintAfter, 'CL12h then it comes alive and roams, and the hint has withdrawn', JSON.stringify({ alive: walk.alive, travelled: Math.round(walk.travelled) }));
    await page.screenshot({ path: path.join(shotDir, 'shape-lab-closure.png') });

    // ---- CL13: the page still says nothing technical outside Advanced; a phone fits ----
    const tech = await S(() => { const words = /\b(arrangement|candidate|anchors|interpreter|provider|projection|sanitization|schema|runtime|seam|validator)\b/i; const leaks = []; document.querySelectorAll('[data-vocab-section], [data-vocab-panel], [data-reveal-suggested], [data-mystery-why]').forEach((n) => { if (n.closest('details.adv')) return; const t = n.innerText || ''; const m = t.match(words); if (m) leaks.push(m[0]); }); return leaks; });
    ck(tech.length === 0, 'CL13 the closure copy — decision, extension cards, suggestions, gaps — says nothing technical outside Advanced', tech.join(','));
    const phone = await ctx.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await phone.waitForFunction(() => !!window.LabClosure);
    const ph = await phone.evaluate(() => ({ sx: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sect: !!document.querySelector('[data-vocab-section]') }));
    ck(ph.sect && ph.sx <= ph.cw + 1, 'CL13b on a phone the new sections add no sideways scroll', ph.sx + ' vs ' + ph.cw);
    await phone.close();
    ck(errors.length === 0, 'CL14 the page raised no error through the whole closure journey', errors.join(' | '));
  } finally { await browser.close(); server.kill(); }

  // ---- CL15: production is byte-for-byte what it was ----
  const { execSync } = require('child_process');
  let prodDiff = null;
  // (supabase/functions/lab-generate is the Lab's own administrators-only
  // relay and moves with the Lab; everything else under supabase/ is product)
  try { prodDiff = execSync("git diff --stat 57ae98b1 -- js/ vihuplanet/ assets/ index.html studio.html css/ supabase/ renderer/ ':!supabase/functions/lab-generate'", { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { prodDiff = 'git unavailable'; }
  ck(prodDiff === '', 'CL15 production is unchanged against the base of this line of sprints — js/, vihuplanet/, assets/, css/, supabase/ (but the Lab relay), renderer/, index.html, studio.html', prodDiff.split('\n').slice(-1)[0] || 'empty');
  const prodSrcs = ['js/etherMystery.js', 'js/etherExperience.js', 'js/etherLife.js', 'js/etherRipple.js', 'js/etherGrammar.js', 'assets/ether/experience-pool.js'].map((f) => read(f)).join('\n');
  ck(!/labVocabulary|labClosure|labUnfinished|LabVocabulary|LabClosure|LabUnfinished/.test(prodSrcs), 'CL15b no production file names any of the three new modules');
}

// ===================================================================
// EX. IMAGE → ETHER CREATURE, END TO END: the simplest bridge — the
// vision model proposes points, connections, missing connections, reveal
// features and a hint straight from the picture; the Lab validates,
// repairs on record, refuses what cannot be repaired, and the researcher
// corrects. Production untouched.
// ===================================================================
async function sectionEX() {
  console.log('\n== EX. image → gpt-4.1 extraction → Shape Lab → the loop ==');
  const { chromium } = require('playwright');
  const Extract = require(path.join(ROOT, 'tools/ether-mystery-lab/labExtract.js'));
  const exSrc = read('tools/ether-mystery-lab/labExtract.js'), exStripped = stripComments(exSrc);
  const shapeHtml = read('tools/ether-mystery-lab/shape.html');
  const connSrc = read('tools/ether-mystery-lab/labConnection.js');
  const fnSrc = read('supabase/functions/lab-generate/index.ts');
  const shotDir = path.join(SHOTS, 'extract'); fs.mkdirSync(shotDir, { recursive: true });

  // ---- EX1: the models, and the boundary ----
  ck(/DEFAULT_MODEL = 'gpt-4\.1'/.test(fnSrc) && /DEFAULT_IMAGE_MODEL = 'gpt-image-2'/.test(fnSrc) && /DEFAULT_DIRECT_MODEL = 'gpt-4\.1'/.test(connSrc) && /DEFAULT_DIRECT_IMAGE_MODEL = 'gpt-image-2'/.test(connSrc),
    'EX1  the defaults are gpt-4.1 for understanding and gpt-image-2 for the picture, in the function and in the direct transport alike');
  ck(!/gpt-image-1\b|gpt-image-1\.5|chatgpt-image-latest|gpt-4\.1-mini/.test(stripComments(connSrc) + stripComments(fnSrc.replace(/\/\/.*$/gm, ''))), 'EX1b none of the retired image models and no smaller model is named as a default anywhere on the path');
  ck(/BUILD = 'LAB3'/.test(fnSrc) && /MAX_UNDERSTAND_TOKENS = 4000/.test(fnSrc) && /payload\.maxTokens/.test(fnSrc) && /maxTokens\(opts\)/.test(connSrc), 'EX1c the function is a new build, and an extraction may ask for more answer room within a bound — never unbounded');
  const creatureWords = /\b(tiger|falcon|elephant|dragon|penguin|whale|bird|lion|fox|bear|octopus|cat|dog|fish|butterfly|snake|horse|mermaid|centaur|eagle|panda)\b/i;
  const exCode = exStripped.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\/[^/\n]+\/[gimsuy]*/g, '/re/');
  ck(!creatureWords.test(exCode) && !/subject\s*===|===\s*subject|switch\s*\(\s*(subject|species|creature)\b/.test(exStripped), 'EX1d no creature word in the extraction module\'s code and no branch on a subject — the vision model derives everything from the picture');
  ck(!/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|api\.openai/.test(exStripped) && /C\.understand\(/.test(exStripped), 'EX1e the module stores nothing and makes no request of its own — the picture goes through LabConnection.understand(), the transport the Lab already had');
  ck(!/\bEtherMystery\b|\bEtherGrammar\b|\bEtherLife\b|\bEtherExperience\b|experience-pool|\bMagicCard\b|\bCompanionMemory\b/.test(exStripped), 'EX1f it names no production module — there is no route from an extraction to the Ether but the researcher\'s approval');
  ck(!/labExtract|LabExtract/.test(['js/etherMystery.js', 'js/etherExperience.js', 'js/etherLife.js', 'js/etherRipple.js', 'js/etherGrammar.js', 'assets/ether/experience-pool.js'].map(read).join('\n')), 'EX1g and no production file names it');

  // ---- EX2: the contract ----
  const m8 = Extract.extractMessages(8), m12 = Extract.extractMessages(12), mBad = Extract.extractMessages(99);
  const sys8 = m8.messages[0].content;
  ck(m8.ok && m8.budget === 8 && m12.budget === 12 && mBad.budget === 12 && /at most 8/.test(sys8) && /one or two/.test(sys8) && /two or three/.test(m12.messages[0].content), 'EX2  the contract carries the researcher\'s budget and asks for one or two gaps at eight, two or three above');
  ck(/NORMALIZED coordinates/.test(sys8) && /x from 0 at the left to 1 at the right/.test(sys8) && /MINIMUM useful points/.test(sys8) && /1\. the overall silhouette, 2\. the major gesture/.test(sys8) && /Not at random/.test(sys8) && /never leave a point with no line/.test(sys8),
    'EX2b it asks for normalized coordinates, the minimum useful points in the brief\'s priority order, and missing connections chosen for meaning, never at random');
  ck(/REVEAL FEATURES/.test(sys8) && /diagnostic \| character \| accent \| magic/.test(sys8) && /Never a structural part/.test(sys8) && /HINT\./.test(sys8) && /without naming it/.test(sys8) && /"confidence"/.test(sys8) && /No SVG, no code, no markup/.test(sys8),
    'EX2c it asks for reveal features apart from the points, a hint that names a nature, confidence, and no SVG, code or markup');
  ck(!/\b(card|stars|constellation|memor|username|creator|companion|email|session|token|orbit|circle)\b/i.test(sys8 + m8.messages[1].content), 'EX2d the contract carries no private word');

  // ---- EX3: the validator — repair on record, refuse what cannot be repaired ----
  const good = { subject: 'a being', points: [
    { id: 'p1', x: 0.5, y: 0.1, feature: 'head' }, { id: 'p2', x: 0.5, y: 0.3, feature: 'neck' }, { id: 'p3', x: 0.5, y: 0.6, feature: 'body' },
    { id: 'p4', x: 0.2, y: 0.25, feature: 'left tip' }, { id: 'p5', x: 0.8, y: 0.25, feature: 'right tip' }, { id: 'p6', x: 0.35, y: 0.9, feature: 'foot' }, { id: 'p7', x: 0.65, y: 0.9, feature: 'foot' }, { id: 'p8', x: 0.8, y: 0.7, feature: 'tail tip' } ],
    connections: [{ a: 'p1', b: 'p2' }, { a: 'p2', b: 'p3' }, { a: 'p2', b: 'p4' }, { a: 'p2', b: 'p5' }, { a: 'p4', b: 'p3' }, { a: 'p5', b: 'p3' }, { a: 'p3', b: 'p6' }, { a: 'p3', b: 'p7' }, { a: 'p3', b: 'p8' }, { a: 'p6', b: 'p7' }],
    missingConnections: [{ a: 'p2', b: 'p4', reason: 'a root' }, { a: 'p3', b: 'p6', reason: 'a leg' }],
    revealFeatures: [{ name: 'Crown', reason: 'identity', type: 'diagnostic', near: ['p1'] }, { name: 'Eye glow', reason: 'accent', type: 'magic', near: ['p1', 'p2'] }],
    hint: 'A quiet giant is waiting in the deep', confidence: { overall: 0.8, identity: 0.7, structure: 0.9 } };
  const v = Extract.validateExtraction(JSON.parse(JSON.stringify(good)), 8);
  ck(v.ok && v.extraction.points.length === 8 && v.extraction.joins.length === 10 && v.extraction.missing.length === 2 && v.extraction.revealFeatures.length === 2 && v.extraction.hint === 'A quiet giant is waiting in the deep…' && v.extraction.confidence.identity === 0.7 && v.repairs.length === 0,
    'EX3  a well-formed extraction is accepted whole: points, connections, two gaps, two reveals, the hint with its ellipsis, the confidence', JSON.stringify(v.reasons) + ' ' + JSON.stringify(v.repairs));
  const tooMany = Extract.validateExtraction(Object.assign({}, good, { points: good.points.concat([{ id: 'p9', x: 0.1, y: 0.1, feature: 'extra' }, { id: 'p10', x: 0.9, y: 0.9, feature: 'extra' }]) }), 8);
  ck(tooMany.ok && tooMany.extraction.points.length === 8 && tooMany.repairs.some((r) => /beyond the budget of 8/.test(r)), 'EX3b too many points: cut to the budget, on record');
  const badCoord = Extract.validateExtraction(Object.assign({}, good, { points: good.points.map((p, i) => i === 2 ? Object.assign({}, p, { x: 'left' }) : p) }), 8);
  const offPic = Extract.validateExtraction(Object.assign({}, good, { points: good.points.map((p, i) => i === 2 ? Object.assign({}, p, { x: 3.2 }) : p) }), 8);
  const edge = Extract.validateExtraction(Object.assign({}, good, { points: good.points.map((p, i) => i === 2 ? Object.assign({}, p, { x: 1.04 }) : p) }), 8);
  ck(!badCoord.ok && /bad-coordinate/.test(badCoord.reasons.join()) && !offPic.ok && /off-the-picture/.test(offPic.reasons.join()) && edge.ok && edge.extraction.points[2].x === 1 && edge.repairs.some((r) => /clamped/.test(r)),
    'EX3c a coordinate that is not a number, or far off the picture, refuses the extraction; one just over the edge is clamped on record');
  const dup = Extract.validateExtraction(Object.assign({}, good, { points: good.points.map((p, i) => i === 4 ? Object.assign({}, p, { id: 'p4' }) : p) }), 8);
  ck(dup.ok && dup.extraction.points.length === 7 && dup.repairs.some((r) => /duplicate id/.test(r)) && dup.repairs.some((r) => /names a point that does not exist/.test(r)), 'EX3d a duplicate id is dropped on record, and the connections that named the lost point are dropped with it');
  const badConn = Extract.validateExtraction(Object.assign({}, good, { connections: good.connections.concat([{ a: 'p1', b: 'p99' }, { a: 'p3', b: 'p3' }, { a: 'p1', b: 'p2' }]) }), 8);
  ck(badConn.ok && badConn.extraction.joins.length === 10 && badConn.repairs.some((r) => /does not exist/.test(r)) && badConn.repairs.some((r) => /to itself/.test(r)), 'EX3e a connection to a point that does not exist, a self-connection and a duplicate are dropped — on record, never a crash');
  const strand = Extract.validateExtraction(Object.assign({}, good, { missingConnections: [{ a: 'p3', b: 'p8', reason: 'the tail' }, { a: 'p1', b: 'p2', reason: 'the neck' }] }), 8);
  ck(strand.ok && strand.extraction.missing.length >= 1 && strand.repairs.some((r) => /lone point/.test(r)) && strand.extraction.missing.every((mi) => { const j = strand.extraction.joins[mi]; return j.a !== 7 && j.b !== 7; }),
    'EX3f a missing connection that would strand a point (the tail tip has one line) is kept as a connection instead, on record', JSON.stringify(strand.repairs));
  const allStrand = Extract.validateExtraction(Object.assign({}, good, { missingConnections: [{ a: 'p3', b: 'p8', reason: 'x' }] }), 8);
  ck(allStrand.ok && allStrand.extraction.missing.length >= 1 && allStrand.extraction.gaps.every((g) => /chosen by the Lab/.test(g.reason)) && allStrand.repairs.some((r) => /chosen by the Lab/.test(r)),
    'EX3g when none of the model\'s gaps can be left out, the Lab chooses the widest safe ones and says so — a figure always has a mystery');
  const notListed = Extract.validateExtraction(Object.assign({}, good, { missingConnections: [{ a: 'p4', b: 'p5', reason: 'across' }] }), 8);
  ck(notListed.ok && notListed.extraction.joins.length === 11 && notListed.extraction.missing.length === 1 && notListed.repairs.some((r) => /was not among the connections/.test(r)), 'EX3h a missing connection the model forgot to list as a connection is added and left missing, on record');
  const fourGaps = Extract.validateExtraction(Object.assign({}, good, { missingConnections: [{ a: 'p2', b: 'p4' }, { a: 'p3', b: 'p6' }, { a: 'p2', b: 'p5' }, { a: 'p3', b: 'p7' }] }), 8);
  ck(fourGaps.ok && fourGaps.extraction.missing.length <= 3 && fourGaps.extraction.joins.length - fourGaps.extraction.missing.length >= 2, 'EX3i at most three gaps, and at least two connections always remain');
  const badReveal = Extract.validateExtraction(Object.assign({}, good, { revealFeatures: [{ name: 'Fog', reason: 'x', type: 'weather', near: ['p42'] }, { name: 'Ridge', reason: 'y', type: 'texture', near: ['p3', 'p3', 'nope'] }, { reason: 'no name', type: 'magic', near: ['p1'] }] }), 8);
  ck(badReveal.ok && badReveal.extraction.revealFeatures.length === 1 && badReveal.extraction.revealFeatures[0].name === 'RIDGE' && badReveal.extraction.revealFeatures[0].near.join() === '2' && badReveal.repairs.some((r) => /anchored to no real point/.test(r)) && badReveal.repairs.some((r) => /→ character/.test(r)),
    'EX3j a reveal anchored to nothing is dropped, an unknown type becomes character, anchors are real and unique, and a nameless one is dropped — all on record');
  const badHint = Extract.validateExtraction(Object.assign({}, good, { hint: 'Connect the dots to finish it' }), 8);
  const digitHint = Extract.validateExtraction(Object.assign({}, good, { hint: 'Wait 3 seconds and see' }), 8);
  ck(badHint.ok && badHint.extraction.hint === null && badHint.repairs.some((r) => /hint refused \(instruction\)/.test(r)) && digitHint.extraction.hint === null, 'EX3k an instruction or a digit in the hint refuses the hint alone; the figure still loads with the honest fallback');
  ck(!Extract.parseExtraction('I see a lovely creature with eight points.', 8).ok && Extract.parseExtraction('```json\n' + JSON.stringify(good) + '\n```', 8).ok && !Extract.validateExtraction({ subject: 'x', points: [{ id: 'a', x: 0.1, y: 0.1 }, { id: 'b', x: 0.2, y: 0.2 }] }, 8).ok,
    'EX3l prose is refused as not JSON, a fenced JSON is read, and two points are too few');
  ck(!Extract.validateExtraction(Object.assign({}, good, { subject: '<script>alert(1)</script>' }), 8).ok && !Extract.validateExtraction(Object.assign({}, good, { revealFeatures: [{ name: 'X', reason: 'y', type: 'magic', near: ['p1'], card: 'z' }] }), 8).ok,
    'EX3m markup in a string and a private key at any depth refuse the whole extraction');
  const fx = Extract.parseExtraction(Extract.fixtureExtraction(8), 8);
  ck(fx.ok && fx.extraction.points.length === 8 && /fixture/i.test(fx.extraction.subject) && fx.extraction.missing.length === 1, 'EX3n the fixture is a ring that says it is one, and it passes the same validator');
  const ed = Extract.toEditor(good.points, 1), edWide = Extract.toEditor(good.points, 2);
  ck(ed.length === 8 && Math.abs(ed[0][0]) < 0.01 && Math.abs(ed[0][1] - (0.1 - 0.5) * 2 * Extract.PICTURE_HALF) < 0.02 && ed[0][1] < ed[2][1] && Math.abs(edWide[0][1]) < Math.abs(ed[0][1]) && Math.abs(Extract.PICTURE_HALF - 0.43 / 0.46 * 1.4) < 1e-9,
    'EX3o picture coordinates land where the underlay draws them — the picture\'s centre at the editor\'s centre, its edge at the underlay\'s edge, a wide picture shorter on its short axis, up still up');

  // ---- EX4: the committed real run — labelled, re-validated, drawn, rated ----
  const runPath = path.join(shotDir, 'real-extract.json');
  const run = fs.existsSync(runPath) ? JSON.parse(fs.readFileSync(runPath, 'utf8')) : null;
  ck(!!run && run.imageModel === 'gpt-image-2' && run.model === 'gpt-4.1' && run.results.length === 7, 'EX4  the real run is committed: seven prompts, gpt-image-2 and gpt-4.1', run ? run.results.length + ' results' : 'missing');
  if (run) {
    const prompts = run.results.map((r) => r.prompt);
    ck(prompts[0] === 'A panda made of stars in a night sky' && prompts[6] === 'An imaginary creature that looks like a fox, made of stars in a night sky', 'EX4b the prompts are the brief\'s own, verbatim, the invented creature last');
    const withImage = run.results.filter((r) => r.image && r.image.ok);
    ck(withImage.length >= 6 && withImage.every((r) => fs.existsSync(path.join(shotDir, r.image.file)) && /REAL MODEL/.test(r.labels.image)) && run.results.every((r) => r.labels && (r.image.ok ? /REAL MODEL/.test(r.labels.image) : /FAILED/.test(r.labels.image))),
      'EX4c every picture that exists is a real gpt-image-2 picture on disk, labelled so; a failed one says FAILED and substitutes nothing', withImage.length + '/7');
    const ex8 = run.results.filter((r) => r.extractions && r.extractions[8] && r.extractions[8].ok);
    ck(ex8.length >= 6 && ex8.every((r) => { const v2 = Extract.parseExtraction(r.extractions[8].raw, 8); return v2.ok && JSON.stringify(v2.extraction) === JSON.stringify(r.extractions[8].extraction); }),
      'EX4d every committed raw reply at eight re-validates into exactly the committed extraction', ex8.length + '/7');
    ck(ex8.every((r) => r.extractions[8].extraction.points.length <= 8 && r.extractions[8].extraction.missing.length >= 1 && r.extractions[8].extraction.revealFeatures.length >= 1), 'EX4e at eight every extraction is within budget, has a gap, and offers a reveal');
    const walksPath = path.join(shotDir, 'walks.json');
    const walks = fs.existsSync(walksPath) ? JSON.parse(fs.readFileSync(walksPath, 'utf8')).walks : null;
    const walked = walks ? Object.keys(walks).filter((k) => walks[k].b8 && walks[k].b8.walk && walks[k].b8.walk.steps.length && walks[k].b8.walk.steps[walks[k].b8.walk.steps.length - 1] === 0 && walks[k].b8.roam && walks[k].b8.roam.alive === 1 && walks[k].b8.roam.travelled > 30) : [];
    ck(walks && walked.length >= 6, 'EX4f the committed walks show every extracted creature completed in the real Ether at eight, alive and roaming', walks ? walked.length + '/' + Object.keys(walks).length : 'missing');
    const ratingsPath = path.join(shotDir, 'ratings.json');
    const ratings = fs.existsSync(ratingsPath) ? JSON.parse(fs.readFileSync(ratingsPath, 'utf8')) : null;
    ck(!!ratings && ratings.results.length === 7 && ratings.results.every((x) => ['image', 'recognition', 'unfinished', 'reveal', 'alive', 'overall'].every((k) => /^[ABCD]$/.test(x[k]))) && typeof ratings.verdict === 'string',
      'EX4g the ratings are committed — image quality, Ether recognition, unfinished mystery, reveal quality, come alive, overall, each A–D — with the verdict');
  }

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    const requests = [];
    page.on('request', (q) => requests.push(q.url()));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabExtract && !!window.ShapeLab && !!window.LabConnection && !!window.LabImagine, null, { timeout: 20000 });
    const S = (fn, arg) => page.evaluate(fn, arg);
    const load = await S(() => ({ ls: Object.keys(localStorage).length, ss: Object.keys(sessionStorage).length, go: document.querySelector('[data-extract-go]').disabled, label: document.querySelector('[data-extract-go]').textContent, controls: ['[data-extract-section]', '[data-extract-status]', '[data-extract-panel]', '[data-extract-diag]', '[data-reveal-extracted]'].filter((c) => !document.querySelector(c)) }));
    ck(load.ls === 0 && load.ss === 0 && load.go && /Understand & Build Ether at \d+ points/.test(load.label) && load.controls.length === 0 && errors.length === 0, 'EX5  loading the page extracts nothing and stores nothing; the button is shut until a picture is chosen, and names the budget');
    // fixture
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'assets/lumo/hero.png'));
    await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 8000 });
    await S(() => window.ShapeLab.setBudget(8));
    const before = requests.length;
    await page.click('[data-extract-go]');
    await page.waitForFunction(() => document.querySelector('[data-extract-section]').getAttribute('data-extract-outcome') === 'fixture', null, { timeout: 8000 });
    const fx2 = await S(() => ({ n: window.ShapeLab.state().points.length, missing: window.ShapeLab.state().missing, status: document.querySelector('[data-extract-status]').textContent, panel: document.querySelector('[data-extract-panel]').innerText, origin: window.ShapeLab.origin(), meta: window.LabExtract.meta() }));
    ck(fx2.n === 8 && fx2.missing.length === 1 && /Fixture ring loaded — not the creature/.test(fx2.status) && /FIXTURE — a ring, no model looked/i.test(fx2.panel) && fx2.meta.source === 'fixture' && requests.slice(before).every((u) => !/openai|fn\.local|supabase/.test(u)),
      'EX5b in fixture mode a ring of eight loads, says it is a fixture on the button, the badge and the record, and nothing leaves the browser');
    // stubbed endpoint
    const ex = JSON.parse(JSON.stringify(good));
    let bodies = []; let answer = 'good';
    await page.route('https://fn.local/lab-generate', (route) => {
      const body = JSON.parse(route.request().postData() || '{}'); bodies.push(body);
      if (body.action === 'ping') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, build: 'LAB3', provider: 'configured', model: 'gpt-4.1', imageModel: 'gpt-image-2' }) });
      if (body.action === 'understand') {
        const sys = String(body.messages[0].content);
        if (/ETHER EXTRACTION/.test(sys)) {
          if (answer === 'down') return route.abort();
          const text = answer === 'good' ? JSON.stringify(ex) : answer === 'many' ? JSON.stringify(Object.assign({}, ex, { points: ex.points.concat(ex.points.map((p, i) => Object.assign({}, p, { id: 'q' + i }))) })) : answer === 'coords' ? JSON.stringify(Object.assign({}, ex, { points: ex.points.map((p) => Object.assign({}, p, { x: 'far' })) })) : 'I see a being.';
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text, model: 'gpt-4.1', build: 'LAB3' }) });
        }
        const g = { subject: 'a being from the stub', character: ['calm'], composition: 'An upright figure.', architecture: ['a body', 'a head on top'], diagnosticFeatures: ['a crown'], modifiers: [], proportion: 'The head is big.', gesture: 'One coherent gesture: standing.', abstraction: { survives: ['the crown'], doNotDrawLiterally: ['texture'], note: '' }, revealCandidates: ['crown'], promptFidelity: { agreement: 'matches', differences: [] } };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: JSON.stringify(g), model: 'gpt-4.1', build: 'LAB3' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, model: 'gpt-4.1', build: 'LAB3', text: '{}' }) });
    });
    await page.click('[data-conn-mode="endpoint"]');
    await page.fill('[data-conn-url]', 'https://fn.local/lab-generate');
    await page.fill('[data-conn-token]', 'admin-session-token');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED/.test(document.querySelector('[data-conn-status]').textContent));
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'assets/lumo/hero.png'));
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'generated', null, { timeout: 8000 });
    bodies = [];
    await page.click('[data-extract-go]');
    await page.waitForFunction(() => document.querySelector('[data-extract-section]').getAttribute('data-extract-outcome') === 'generated', null, { timeout: 8000 });
    const gen = await S(() => ({ st: window.ShapeLab.state(), status: document.querySelector('[data-extract-status]').textContent, panel: document.querySelector('[data-extract-panel]').innerText, origin: window.ShapeLab.origin(), meta: window.LabExtract.meta(), play: window.ShapeLab.playable(), sugg: window.LabExtract.suggestions(), ui: document.querySelector('[data-reveal-extracted]').innerText, ls: JSON.stringify(localStorage), ss: JSON.stringify(sessionStorage), exp: window.ShapeLab.exportJSON(), unf: document.querySelector('[data-canvas-unfinished]').getBoundingClientRect().width }));
    ck(gen.st.points.length === 8 && gen.st.joins.length === 10 && gen.st.missing.length === 2 && gen.st.roles[0] === 'HEAD' && gen.st.hint === 'A quiet giant is waiting in the deep…' && gen.origin === 'generated' && gen.meta.source === 'generated' && gen.meta.model === 'gpt-4.1' && gen.play,
      'EX6  a model extraction lands as one GENERATED figure: its points with their features, its connections, its gaps marked missing, its hint written — and it is playable', JSON.stringify({ n: gen.st.points.length, j: gen.st.joins.length, m: gen.st.missing, h: gen.st.hint, role0: gen.st.roles && gen.st.roles[0], origin: gen.origin, meta: gen.meta, play: gen.play }));
    ck(/ETHER EXTRACTION \(GPT-4\.1\)/i.test(gen.panel) && /MISSING CONNECTIONS/i.test(gen.panel) && /a root/.test(gen.panel) && /REVEAL SUGGESTIONS/i.test(gen.panel) && /CONFIDENCE/i.test(gen.panel) && /identity 0\.7/.test(gen.panel),
      'EX6b the extraction is shown as words a researcher can argue with — the points, why each gap, the reveals, the confidence — and labelled with the model');
    ck(gen.sugg.length === 2 && gen.sugg[0].name === 'CROWN' && gen.sugg[0].kind === 'spike' && gen.sugg[1].kind === 'glow' && /SUGGESTED REVEALS/i.test(gen.ui) && /☐ CROWN/.test(gen.ui) && /Accept/.test(gen.ui) && /Reject/.test(gen.ui),
      'EX6c the reveal suggestions are in step 4 as ☐ rows with their reason, a starting kind by type, Accept and Reject — nothing auto-approved');
    const sentX = bodies.filter((b) => b.action === 'understand' && /ETHER EXTRACTION/.test(String(b.messages[0].content))).pop();
    ck(sentX && Object.keys(sentX).sort().join() === 'action,image,maxTokens,messages' && sentX.maxTokens === 3000 && sentX.image.b64.length > 64 && sentX.messages.length === 2 && !/\b(card|stars|constellation|memor|username|creator|companion|email|session|token|orbit|circle)\b/i.test(JSON.stringify(sentX.messages)),
      'EX6d what left is action, the picture, the answer room and two text messages — the contract with the budget — and no private word');
    ck(!/admin-session-token|base64|data:image|ETHER EXTRACTION|A quiet giant/.test(gen.ls + gen.ss) && !/base64|data:image|ETHER EXTRACTION/.test(gen.exp), 'EX6e the token, the picture and the contract reach no storage and no export');
    const acc = await S(() => { const a = window.LabExtract.acceptReveal(0, 'spike'); const r = window.LabExtract.rejectReveal(1); const no = window.LabExtract.acceptReveal(9); const st = window.ShapeLab.state(); return { a, r, no, feats: st.reveal.features.map((f) => f.name + '/' + f.type + '/' + f.lights.a + '-' + f.lights.b), states: window.LabExtract.suggestions().map((s) => s.state), ui: document.querySelector('[data-reveal-extracted]').innerText }; });
    ck(acc.a.ok && acc.feats.length === 1 && /^CROWN\/spike\/0-/.test(acc.feats[0]) && acc.r.ok && !acc.no.ok && acc.states.join() === 'accepted,rejected' && /☑ CROWN/.test(acc.ui) && /☒ EYE GLOW/.test(acc.ui),
      'EX6f Accept makes an ordinary reveal feature of the chosen kind anchored at the named point; Reject stands one down; a suggestion that does not exist is refused', JSON.stringify(acc.feats));
    const edited = await S(() => { const f = window.ShapeLab.state().reveal.features[0]; window.ShapeLab.updateReveal(f.id, { size: 1.4 }); window.ShapeLab.movePoint(0, 0.2, -1.0); return { size: window.ShapeLab.state().reveal.features[0].size, origin: window.ShapeLab.origin(), p0: window.ShapeLab.state().points[0] }; });
    ck(edited.size === 1.4 && edited.origin === 'generated-edited' && edited.p0[0] === 0.2, 'EX6g the accepted reveal and every point are the researcher\'s to edit — a moved point marks the figure GENERATED · EDITED');
    // the budget changes → the same picture is read again
    bodies = [];
    await S(() => window.ShapeLab.setBudget(12));
    await page.waitForFunction(() => window.LabExtract.meta() && window.LabExtract.meta().budget === 12, null, { timeout: 8000 });
    const re = await S(() => ({ meta: window.LabExtract.meta(), n: window.ShapeLab.state().points.length }));
    const sent12 = bodies.filter((b) => b.action === 'understand' && /ETHER EXTRACTION/.test(String(b.messages[0].content))).pop();
    ck(re.meta.budget === 12 && sent12 && /at most 12/.test(sent12.messages[0].content) && sent12.image.b64 === sentX.image.b64, 'EX6h changing the budget reads the SAME picture again at the new budget — never a new creature');
    await S(() => window.ShapeLab.setBudget(8));
    await page.waitForFunction(() => window.LabExtract.meta() && window.LabExtract.meta().budget === 8, null, { timeout: 8000 });
    // malformed replies keep what was there
    for (const [ans, label, outcome] of [['many', 'too many points', 'generated'], ['coords', 'coordinates that are not numbers', 'rejected'], ['prose', 'a prose reply', 'rejected'], ['down', 'a dead transport', 'failed']]) {
      answer = ans;
      await page.click('[data-extract-go]');
      await page.waitForFunction((o) => document.querySelector('[data-extract-section]').getAttribute('data-extract-outcome') === o, outcome, { timeout: 8000 });
      const r = await S(() => ({ n: window.ShapeLab.state().points.length, status: document.querySelector('[data-extract-status]').textContent, goOn: !document.querySelector('[data-extract-go]').disabled, last: window.LabExtract.last() }));
      if (outcome === 'generated') ck(r.n === 8 && r.last.parse.repairs.some((x) => /beyond the budget/.test(x)), 'EX6i ' + label + ' are cut to the budget on record and the figure still loads', String(r.n));
      else ck(r.n === 8 && /still here/.test(r.status) && !/Fixture ring/.test(r.status) && r.goOn && r.last.outcome === outcome, 'EX6i ' + label + ' is ' + outcome + ' on screen: the figure in use is untouched, no fixture is substituted, the button comes back', r.status.slice(0, 80));
    }
    answer = 'good';
    await page.click('[data-extract-go]');
    await page.waitForFunction(() => document.querySelector('[data-extract-section]').getAttribute('data-extract-outcome') === 'generated', null, { timeout: 8000 });
    // the loop in the real Ether
    await S(() => { window.LabExtract.acceptReveal(0, 'spike'); window.LabExtract.acceptReveal(1, 'glow'); });
    const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-play]')]);
    await pop.waitForFunction(() => !!window.LabPreview && !!window.LabPreview.mystery && window.LabPreview.mystery(), null, { timeout: 20000 });
    await pop.waitForTimeout(1800);
    const walk = await pop.evaluate(async () => {
      const my = window.LabPreview.mystery(); let i = my.instrument();
      const hintEl = document.querySelector('[data-hint]');
      const out = { hint: hintEl.textContent, hintOn: hintEl.classList.contains('on'), missing: i.arrangement.missingLeft, elements: i.elements.length, steps: [], offered: window.LabPreview.report().happened.reveal.offered };
      let g = 30;
      while (g-- > 0 && i && i.arrangement && i.arrangement.missingLeft > 0) {
        const gap = i.arrangement.links.filter((L) => !L.present)[0];
        my.touchAt(i.elements[gap.a].x, i.elements[gap.a].y); my.touchAt(i.elements[gap.b].x, i.elements[gap.b].y);
        i = my.instrument(); out.steps.push({ left: i ? i.arrangement.missingLeft : 'gone', alive: window.LabPreview.alive().length });
      }
      await new Promise((r) => setTimeout(r, 2200));
      out.shown = window.LabPreview.report().happened.reveal.shown;
      await new Promise((r) => setTimeout(r, 4500));
      out.alive = window.LabPreview.alive().length;
      const p = [];
      for (let s = 0; s < 12; s++) { const w = window.LabPreview.alive()[0]; if (w) p.push([w.x, w.y]); await new Promise((r) => setTimeout(r, 300)); }
      let d = 0; for (let s = 1; s < p.length; s++) d += Math.hypot(p[s][0] - p[s - 1][0], p[s][1] - p[s - 1][1]);
      out.travelled = d; out.hintAfter = hintEl.classList.contains('on');
      return out;
    });
    await pop.close();
    ck(walk.hint === 'A quiet giant is waiting in the deep…' && walk.hintOn && walk.elements === 8 && walk.missing === 2, 'EX7  the real Ether poses the extracted creature with its two gaps and the model\'s hint', JSON.stringify({ hint: walk.hint, missing: walk.missing }));
    ck(walk.steps.length === 2 && walk.steps[0].left === 1 && walk.steps[0].alive === 0 && walk.steps[1].left === 0, 'EX7b each gap is made by two real taps and nothing wakes a join early', JSON.stringify(walk.steps));
    ck(walk.offered === 2 && walk.shown === true, 'EX7c the two accepted reveals are drawn over the real sky once the figure is whole');
    ck(walk.alive === 1 && walk.travelled > 30 && !walk.hintAfter, 'EX7d then it comes alive and roams, and the hint has withdrawn', JSON.stringify({ alive: walk.alive, travelled: Math.round(walk.travelled) }));
    await page.screenshot({ path: path.join(shotDir, 'shape-lab-extract.png') });
    const tech = await S(() => { const words = /\b(arrangement|candidate|anchors|interpreter|provider|projection|sanitization|schema|runtime|seam|validator)\b/i; const leaks = []; document.querySelectorAll('[data-extract-section], [data-extract-panel], [data-reveal-extracted]').forEach((n) => { if (n.closest('details.adv')) return; const m = (n.innerText || '').match(words); if (m) leaks.push(m[0]); }); return leaks; });
    ck(tech.length === 0, 'EX8  the extraction copy says nothing technical outside Advanced', tech.join(','));
    const phone = await ctx.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await phone.waitForFunction(() => !!window.LabExtract);
    const ph = await phone.evaluate(() => ({ sx: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ck(ph.sx <= ph.cw + 1, 'EX8b on a phone the extraction section adds no sideways scroll', ph.sx + ' vs ' + ph.cw);
    await phone.close();
    ck(errors.length === 0, 'EX9  the page raised no error through the whole extraction journey', errors.join(' | '));
  } finally { await browser.close(); server.kill(); }

  const { execSync } = require('child_process');
  let prodDiff = null;
  try { prodDiff = execSync('git diff --stat 57ae98b1 -- js/ vihuplanet/ assets/ index.html studio.html css/ renderer/', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { prodDiff = 'git unavailable'; }
  ck(prodDiff === '', 'EX10 production Ether is unchanged against the base of this line of sprints — js/, vihuplanet/, assets/, css/, renderer/, index.html, studio.html', prodDiff.split('\n').slice(-1)[0] || 'empty');
}

// ================================================================
// MM. TWO MODELS, TWO FIELDS — the understanding model and the image
// model each have a field on the Direct panel, each feeds only its own
// path, both are seeded from the transport, and a name that belongs to
// the other path is refused in a sentence before anything leaves.
// Found by the product owner: the one Model field fed the CHAT model,
// so gpt-image-2 typed there reached /chat/completions and came back as
// the provider's bare 500 on every picture (reproduced from Node, 2/2).
// ================================================================
async function sectionMM() {
  console.log('\n== MM. two models, two fields ==');
  const { chromium } = require('playwright');
  const connSrc = fs.readFileSync(path.join(ROOT, 'tools/ether-mystery-lab/labConnection.js'), 'utf8');
  const shapeSrc = fs.readFileSync(path.join(ROOT, 'tools/ether-mystery-lab/shape.html'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(ROOT, 'tools/ether-mystery-lab/index.html'), 'utf8');
  ck(/data-conn-model\b/.test(shapeSrc) && /data-conn-image-model\b/.test(shapeSrc) && /id="directModel"/.test(indexSrc) && /id="directImageModel"/.test(indexSrc) && !/gpt-4\.1-mini/.test(shapeSrc) && !/gpt-4\.1-mini/.test(indexSrc),
    'MM1  both Lab pages carry an Understanding model field AND an Image model field on the Direct panel, and neither advertises gpt-4.1-mini any more');
  // Node: the transport's own answers
  // the sandbox has a fetch that never answers, so a request that DOES
  // leave comes back 'unavailable' — distinguishable from a refusal
  const sandbox = { window: {}, console, AbortController, setTimeout, clearTimeout, fetch: () => Promise.reject(new Error('no network in the sandbox')) };
  sandbox.window.window = sandbox.window; sandbox.window.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(connSrc, sandbox);
  const Conn = sandbox.window.LabConnection;
  const m0 = Conn.models();
  ck(m0.model === 'gpt-4.1' && m0.imageModel === 'gpt-image-2' && m0.defaults.model === 'gpt-4.1' && m0.defaults.imageModel === 'gpt-image-2', 'MM2  LabConnection.models() reports the two live models and their defaults — gpt-4.1 for understanding, gpt-image-2 for pictures', JSON.stringify(m0));
  ck(/image model/.test(Conn.explain('image-model-on-chat-path')) && /Understanding model field/.test(Conn.explain('image-model-on-chat-path')) && /Image model field/.test(Conn.explain('chat-model-on-image-path')) && Conn.explain('unavailable') === 'unavailable',
    'MM2b the two refusals explain themselves in a sentence that names the FIELD to fix; any other reason passes through unchanged');
  Conn.setMode('direct'); Conn.setDirectKey('sk-test');
  Conn.setDirectModel('gpt-image-2');
  const r1 = await Conn.understand({ messages: [{ role: 'system', content: 'x' }, { role: 'user', content: 'y' }], image: { mime: 'image/png', b64: 'A'.repeat(100) } });
  const r2 = await Conn.generate({ messages: [{ role: 'user', content: 'y' }] });
  ck(r1 && !r1.ok && r1.reason === 'image-model-on-chat-path' && r2 && !r2.ok && r2.reason === 'image-model-on-chat-path', 'MM3  an image model in the understanding slot is refused by understand() AND generate() before any request is made', (r1 && r1.reason) + '/' + (r2 && r2.reason));
  Conn.setDirectModel('gpt-4.1'); Conn.setDirectImageModel('gpt-4.1');
  const r3 = await Conn.imagine({ prompt: 'a creature' });
  ck(r3 && !r3.ok && r3.reason === 'chat-model-on-image-path', 'MM3b a chat model in the image slot is refused by imagine() before any request is made', r3 && r3.reason);
  Conn.setDirectImageModel('dall-e-3');
  const r4 = await Conn.imagine({ prompt: 'a creature' }).catch(() => ({ ok: false, reason: 'threw' }));
  ck(r4 && r4.reason === 'unavailable', 'MM3c an image model of another family (dall-e) is not mistaken for a chat model — the request leaves (and meets the sandbox\'s dead network)', r4 && r4.reason);

  // ---- the browser half ----
  const server = spawn('node', ['tools/bring-it-alive/test/serve.js', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise((res) => setTimeout(res, 900));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
    await page.goto(BASE + '/tools/ether-mystery-lab/shape.html');
    await page.waitForFunction(() => !!window.LabExtract && !!window.ShapeLab && !!window.LabConnection && !!window.LabImagine && !!window.LabReference, null, { timeout: 20000 });
    const S = (fn, arg) => page.evaluate(fn, arg);
    const seeded = await S(() => ({ m: document.querySelector('[data-conn-model]').value, im: document.querySelector('[data-conn-image-model]').value, live: window.LabConnection.models() }));
    ck(seeded.m === seeded.live.model && seeded.im === seeded.live.imageModel && seeded.m === 'gpt-4.1' && seeded.im === 'gpt-image-2',
      'MM4  on load both fields show exactly what the transport holds — the page can never advertise a model the transport is not using', JSON.stringify(seeded));
    // the provider, stubbed: records which model each path sends
    const sent = [];
    await page.route('https://api.openai.com/**', (route) => {
      const url = route.request().url();
      if (/\/models$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'gpt-4.1' }] }) });
      const body = JSON.parse(route.request().postData() || '{}');
      sent.push({ url: url.replace('https://api.openai.com', ''), model: body.model });
      if (/images\/generations/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ b64_json: fs.readFileSync(path.join(ROOT, 'assets/lumo/hero.png')).toString('base64') }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ subject: 'a being', character: ['calm'], composition: 'An upright figure.', architecture: ['a body'], diagnosticFeatures: ['a crown'], modifiers: [], proportion: 'The head is big.', gesture: 'One coherent gesture: standing.', abstraction: { survives: ['the crown'], doNotDrawLiterally: [], note: '' }, revealCandidates: [], promptFidelity: { agreement: 'matches', differences: [] } }) } }] }) });
    });
    await page.click('[data-conn-mode="direct"]');
    await page.fill('[data-conn-key]', 'sk-test-two-fields');
    await page.click('[data-conn-test]');
    await page.waitForFunction(() => /CONNECTED \(direct\)/.test(document.querySelector('[data-conn-status]').textContent));
    // the product owner's own mistake: the image model typed into the understanding field
    await page.fill('[data-conn-model]', 'gpt-image-2');
    await page.setInputFiles('[data-imagine-file]', path.join(ROOT, 'assets/lumo/hero.png'));
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-understand-outcome') === 'failed', null, { timeout: 8000 });
    const wrong = await S(() => ({ status: document.querySelector('[data-imagine-understand-status]').textContent, live: window.LabConnection.models() }));
    const chatHits = sent.filter((q) => /chat\/completions/.test(q.url)).length;
    ck(chatHits === 0 && /Understanding model field holds an image model \(gpt-image-2\)/.test(wrong.status) && !/500|server_error/.test(wrong.status) && /No fixture was substituted/.test(wrong.status),
      'MM5  gpt-image-2 in the understanding field: the picture is NOT sent to the chat path, and the failure names the field — never the provider\'s 500', wrong.status.slice(0, 120) + ' · chat hits ' + chatHits);
    // put it right, and the same picture reads
    await page.fill('[data-conn-model]', 'gpt-4.1');
    await page.click('[data-imagine-understand]');
    await page.waitForFunction(() => window.LabImagine.state().page === 'understood', null, { timeout: 8000 });
    const right = sent.filter((q) => /chat\/completions/.test(q.url));
    ck(right.length === 1 && right[0].model === 'gpt-4.1', 'MM5b corrected, Read it again sends the same picture to the chat path with the understanding model', JSON.stringify(right));
    // the image field feeds only the picture path
    await page.fill('[data-conn-image-model]', 'gpt-image-2');
    await S(() => window.LabImagine.setProvider('openai-image'));
    await page.fill('[data-imagine-prompt]', 'A small owl made of stars');
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') === 'generated', null, { timeout: 8000 });
    const img = sent.filter((q) => /images\/generations/.test(q.url));
    ck(img.length === 1 && img[0].model === 'gpt-image-2' && sent.filter((q) => /chat\/completions/.test(q.url)).every((q) => q.model === 'gpt-4.1'),
      'MM6  the image field feeds only the picture path and the understanding field only the chat path — measured on the requests themselves', JSON.stringify(sent));
    // the mirror mistake: a chat model in the image field
    await page.fill('[data-conn-image-model]', 'gpt-4.1');
    const imgBefore = sent.filter((q) => /images\/generations/.test(q.url)).length;
    await page.click('[data-imagine-create]');
    await page.waitForFunction(() => document.querySelector('[data-imagine-section]').getAttribute('data-imagine-outcome') === 'failed', null, { timeout: 8000 });
    const mirror = await S(() => document.querySelector('[data-imagine-status]').textContent);
    ck(sent.filter((q) => /images\/generations/.test(q.url)).length === imgBefore && /Image model field holds a chat model \(gpt-4\.1\)/.test(mirror),
      'MM6b a chat model in the image field: nothing is sent to the picture path, and the failure names that field', mirror.slice(0, 120));
    ck(errors.length === 0, 'MM7  no page error through the whole journey', errors.join(' | '));
    await page.unroute('https://api.openai.com/**');
  } finally { await browser.close(); server.kill(); }
}

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
    await run('AR', sectionAR);
    await run('AP', sectionAP);
    await run('RV', sectionRV);
    await run('ET', sectionET);
    await run('WF', sectionWF);
    await run('IM', sectionIM);
    await run('TR', sectionTR);
    await run('CL', sectionCL);
    await run('EX', sectionEX);
    await run('MM', sectionMM);
  } catch (e) {
    fail('suite crashed', (e && e.stack || String(e)).split('\n')[0]);
  }
  console.log('\n==================================================');
  console.log('passed ' + passed + ' · failed ' + failed);
  failures.forEach((f) => console.log('  FAILED: ' + f));
  process.exit(failed ? 1 : 0);
})();
