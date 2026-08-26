/* tools/edge-auth-test/sync-shared.js — one source of truth, five copies.
 *
 * Copies supabase/functions/_shared/edgeAuth.js into each Edge Function's
 * own folder as edgeAuth.js, byte for byte.
 *
 * WHY THERE ARE COPIES AT ALL. `_shared/` is a CLI-only bundling
 * convention and is not carried by a deploy made from the Supabase
 * Dashboard — measured, on this project:
 *
 *   Module not found "file:///tmp/user_fn_<ref>_<uuid>_4/_shared/
 *   edgeAuth.js" at .../source/index.ts:60:31
 *
 * Every other function in this repository has always been self-contained.
 * A security fix that only lands if you happen to deploy with one
 * particular tool is not a fix, so the functions import `./edgeAuth.js`
 * and the deploy stops caring which tool you used.
 *
 * THE COPIES ARE NOT MAINTAINED BY HAND. Run this after any edit to the
 * canonical file. run-edge-auth-tests.js asserts every copy is
 * byte-identical, so forgetting is a failing test rather than one
 * function quietly enforcing something different from its neighbours —
 * which, for an authorization module, is the failure that matters.
 *
 * Run:
 *   node tools/edge-auth-test/sync-shared.js          copy, and report
 *   node tools/edge-auth-test/sync-shared.js --check  report only, exit 1 on drift
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANON = path.join(ROOT, 'supabase', 'functions', '_shared', 'edgeAuth.js');

// Every function that imports it. A function added later belongs here in
// the same commit that adds it — the same rule Decision 22 states for a
// new Add tile and the Rite's own reduction list.
const FUNCTIONS = ['voice-speak', 'sky-protection', 'family-album', 'invite-send', 'creator-born'];

const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(CANON)) {
  console.error('canonical module missing: ' + path.relative(ROOT, CANON));
  process.exit(1);
}
const source = fs.readFileSync(CANON);

let drifted = 0, written = 0;
FUNCTIONS.forEach((name) => {
  const dest = path.join(ROOT, 'supabase', 'functions', name, 'edgeAuth.js');
  const rel = path.relative(ROOT, dest);
  const same = fs.existsSync(dest) && fs.readFileSync(dest).equals(source);
  if (same) { console.log('  ok      ' + rel); return; }
  drifted++;
  if (checkOnly) { console.log('  DRIFTED ' + rel); return; }
  fs.writeFileSync(dest, source);
  written++;
  console.log('  written ' + rel);
});

if (checkOnly && drifted) {
  console.log('\n' + drifted + ' copy/copies differ from the canonical module.');
  console.log('Run: node tools/edge-auth-test/sync-shared.js');
  process.exit(1);
}
console.log('\n' + (written ? written + ' copied' : 'all copies already match') +
  ' — canonical: ' + path.relative(ROOT, CANON));
