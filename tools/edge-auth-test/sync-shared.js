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

// ---------------------------------------------------------------
// THE COPY IS A BUILD ARTIFACT, AND IT IS SMALL ON PURPOSE
//
// The canonical module is 26KB, and about two thirds of that is prose
// explaining why each decision was made. That prose belongs in the
// repository, where it is read; shipping five copies of it to an edge
// runtime buys nothing and costs real payload — sky-protection's own
// index.ts is already 46KB, and the Supabase Dashboard editor refused to
// keep a second file beside it while it happily kept one beside
// voice-speak's 11KB.
//
// So each copy is the canonical module with its FULL-LINE comments
// removed: same statements, same order, same behaviour, roughly 10KB.
//
// WHY LINE-BASED AND NOT A REAL PARSER. A general JS comment stripper
// has to understand strings, template literals and regex literals, and
// getting that subtly wrong in an authorization module is a far worse
// outcome than a large file. Removing only lines whose first non-space
// characters are `//` cannot misread any of those — with one exception,
// a `//` line inside a multi-line template literal, which is checked for
// below and refuses rather than guesses. Inline trailing comments are
// left exactly where they are.
//
// And it is not trusted on that reasoning alone: run-edge-auth-tests.js
// imports a VENDORED COPY and runs the gate's real assertions against
// it, so what is proved is the artifact that actually deploys.
function strip(text) {
  const lines = text.split('\n');

  // Refuse if any line sits inside a multi-line template literal. A
  // backtick count that goes odd and stays odd means the next lines are
  // template content, where a leading `//` is data rather than a comment.
  let open = false;
  for (let i = 0; i < lines.length; i++) {
    if (open && /^\s*\/\//.test(lines[i])) {
      throw new Error('line ' + (i + 1) + ' looks like a comment inside a template literal — ' +
        'this stripper is deliberately too simple for that. Move the template or stop stripping.');
    }
    if (((lines[i].match(/`/g) || []).length % 2) === 1) open = !open;
  }
  if (open) throw new Error('unbalanced backticks — refusing to strip');

  const kept = [];
  let blank = 0;
  lines.forEach((l) => {
    if (/^\s*\/\//.test(l)) return;                 // a whole line of comment
    if (l.trim() === '') { if (++blank > 1) return; } // collapse the gaps it leaves
    else blank = 0;
    kept.push(l);
  });

  return [
    '// GENERATED — do not edit. The readable original, with every',
    '// decision explained, is supabase/functions/_shared/edgeAuth.js.',
    '// Regenerate: node tools/edge-auth-test/sync-shared.js',
    '',
  ].join('\n') + kept.join('\n').replace(/^\n+/, '');
}

if (!fs.existsSync(CANON)) {
  console.error('canonical module missing: ' + path.relative(ROOT, CANON));
  process.exit(1);
}
const source = Buffer.from(strip(fs.readFileSync(CANON, 'utf8')), 'utf8');

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
