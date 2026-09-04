/* tools/ether-mystery-lab/run-lab.js — the offline generation lab.
 *
 * SPRINT — Generative Mystery & Challenge Engine.
 *
 * THE ONE PLACE GENERATION HAPPENS, AND IT IS NOT THE RUNTIME. The
 * Ether's runtime never calls a model, never waits on a network, and
 * never interprets anything but the validated pool it shipped with.
 * This lab is the asynchronous half of the architecture:
 *
 *   vocabulary + creation structure + pool state  →  CONTRACT
 *   CONTRACT → generator → CANDIDATES (data, never code)
 *   CANDIDATES → validator → approved / refused-with-reasons
 *   approved → reviewed by a person → committed to
 *              assets/ether/experience-pool.js (status: active)
 *
 * THE HONEST CONSTRAINT: no model provider is reachable from this
 * environment (the network policy refuses them — Decisions 38 and 51
 * record exactly this), so the generator seam runs on FIXTURES,
 * clearly labelled as fixtures. If/when a real model is connected it
 * belongs HERE — a deploy-time/offline step with a key in the
 * operator's own environment — never in the browser, never in any
 * child-facing path. The contract, the validator, the pool operations
 * and the demand reasoning are all real either way.
 *
 * Run:
 *   node tools/ether-mystery-lab/run-lab.js            # demand + contract + validate
 *   node tools/ether-mystery-lab/run-lab.js contract   # print the generation contract
 *   node tools/ether-mystery-lab/run-lab.js demand     # is generating even useful?
 *   node tools/ether-mystery-lab/run-lab.js validate   # run the fixture battery
 */
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

function loadGlobal(rel) {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox);
  return sandbox;
}

const Grammar = loadGlobal('js/etherGrammar.js').EtherGrammar;
const Lens = loadGlobal('js/etherCreationLens.js').EtherCreationLens;
const pool = loadGlobal('assets/ether/experience-pool.js').EtherExperiencePool;
const fixtures = require('./fixtures.js');

const mode = process.argv[2] || 'all';

function poolSignatures() {
  return (pool.experiences || [])
    .filter((e) => e.status === 'active')
    .map((e) => Grammar.signature(e.candidate));
}

function showDemand() {
  const d = Grammar.demand(pool);
  console.log('\n== DEMAND — should anything be generated? ==');
  console.log('  active experiences :', d.activeCount);
  console.log('  by grammar         :', JSON.stringify(d.byGrammar));
  console.log('  grammars unused    :', d.grammarsUnused.join(', ') || 'none');
  console.log('  suggest generating :', d.suggestGenerate ? 'YES' : 'no');
  d.reasons.forEach((r) => console.log('    because', r));
}

function showContract() {
  // The creation structures a generator may see: the lens projection
  // minus everything but creative shape. Here, representative shapes —
  // a generator composes for KINDS of creation, never for one moment
  // of one visit.
  const sampleEntities = [
    { id: 'sample-a', title: 'A Story', cover: 'x', pages: 5, focusT: 0 },
    { id: 'sample-b', title: 'Another', cover: 'x', pages: 1, focusT: 0 }
  ];
  const contract = Grammar.contract({
    creations: sampleEntities.map((e) => Lens.structure(e)).filter(Boolean),
    pool: {
      active: poolSignatures().length,
      byGrammar: Grammar.demand(pool).byGrammar,
      signatures: poolSignatures()
    }
  });
  console.log('\n== THE GENERATION CONTRACT (what a generator is handed) ==');
  console.log(JSON.stringify(contract, null, 2));
}

function generatorSeam() {
  console.log('\n== GENERATOR ==');
  console.log('  No model provider is reachable from this environment;');
  console.log('  candidates below are hand-written FIXTURES, labelled as such.');
  console.log('  A real generator plugs in here — offline, with its own');
  console.log('  credentials — and its output goes through the identical');
  console.log('  validator before a person reviews and commits it.');
  return fixtures.valid.map((f) => ({ label: f.label, source: 'fixture', candidate: f.candidate }))
    .concat(fixtures.adversarial.map((f) => ({ label: f.label, source: 'fixture', candidate: f.candidate, expect: f.expect })));
}

function validateAll() {
  const existing = poolSignatures();
  const batch = generatorSeam();
  let approved = 0, refused = 0, wrong = 0;
  console.log('\n== VALIDATION ==');
  batch.forEach((b) => {
    const v = Grammar.validate(b.candidate, { existing });
    if (b.expect) {
      const hit = v.reasons.some((r) => r.indexOf(b.expect) !== -1);
      if (!v.ok && hit) {
        refused++;
        console.log('  REFUSED (as it must be)  ' + b.label);
        console.log('           reasons: ' + v.reasons.join(' · '));
      } else {
        wrong++;
        console.log('  !! WRONG VERDICT  ' + b.label +
          '  (wanted "' + b.expect + '", got ' +
          (v.ok ? 'approved' : v.reasons.join(' · ')) + ')');
      }
    } else if (v.ok) {
      approved++;
      console.log('  approved  ' + b.label + '  [' + b.source + ']');
    } else {
      wrong++;
      console.log('  !! REFUSED A VALID FIXTURE  ' + b.label +
        '  (' + v.reasons.join(' · ') + ')');
    }
  });
  console.log('\n  approved ' + approved + ' · refused ' + refused +
              ' · wrong verdicts ' + wrong);
  console.log('  An approved candidate is NOT yet in the pool: a person');
  console.log('  reviews it and commits it to assets/ether/experience-pool.js');
  console.log('  with status "active" — the canon-repository pattern.');
  return wrong === 0;
}

let ok = true;
if (mode === 'demand' || mode === 'all') showDemand();
if (mode === 'contract' || mode === 'all') showContract();
if (mode === 'validate' || mode === 'all') ok = validateAll();
process.exit(ok ? 0 : 1);
