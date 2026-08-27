/* tools/edge-auth-test/sync-shared.js — one source of truth, five copies.
 *
 * INLINES supabase/functions/_shared/edgeAuth.js into each Edge
 * Function's own index.ts, between markers, so every function is ONE
 * FILE and the deploy needs nothing beside it.
 *
 * WHY ONE FILE, after two attempts at fewer copies:
 *
 *   1. `../_shared/edgeAuth.js` — `_shared/` is a CLI-only bundling
 *      convention and is not carried by a Dashboard deploy. Measured:
 *      Module not found "file:///tmp/user_fn_<ref>_<uuid>_4/_shared/
 *      edgeAuth.js" at .../source/index.ts:60:31
 *
 *   2. `./edgeAuth.js` beside index.ts — worked for three functions and
 *      not the other two, where the second file "just keeps vanishing"
 *      from the editor. AN EMPTY FILE VANISHES TOO, so it is not size
 *      and not content: those functions simply will not take a second
 *      file. That killed the payload theory this script previously
 *      carried, and it is written down here because it was measured
 *      rather than reasoned about.
 *
 * One file cannot half-arrive. It is also what every function in this
 * repository was before this sprint touched them.
 *
 * NOTHING IS MAINTAINED BY HAND. Run this after any edit to the
 * canonical file. run-edge-auth-tests.js asserts each index.ts matches
 * what this script produces AND runs the gate's real assertions against
 * the inlined block, so drift is a failing test rather than one function
 * quietly enforcing something different from its neighbours — which, for
 * an authorization module, is the failure that matters.
 *
 * Run:
 *   node tools/edge-auth-test/sync-shared.js          inline, and report
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
const FUNCTIONS = ['voice-speak', 'sky-protection', 'family-album', 'invite-send', 'creator-born', 'companion-chat'];

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

  // No banner here — the caller owns the header, so the block carries
  // exactly one rather than two stacked on top of each other.
  return kept.join('\n').replace(/^\n+/, '').replace(/\n+$/, '\n');
}

if (!fs.existsSync(CANON)) {
  console.error('canonical module missing: ' + path.relative(ROOT, CANON));
  process.exit(1);
}

const BEGIN = '// ===== BEGIN GENERATED edgeAuth — do not edit below this line =====';
const END   = '// ===== END GENERATED edgeAuth =====';

// `export` is dropped: inlined at the top level of the function module
// these are ordinary declarations, and re-exporting them from an Edge
// Function would put the gate's internals on that module's public
// surface for no reason.
const BLOCK = [
  BEGIN,
  '// Generated from supabase/functions/_shared/edgeAuth.js, which is the',
  '// readable original with every decision explained. Regenerate with:',
  '//   node tools/edge-auth-test/sync-shared.js',
  strip(fs.readFileSync(CANON, 'utf8')).replace(/^export /gm, ''),
  END,
].join('\n');

// Where the block goes: replacing an existing block if one is there,
// otherwise replacing the import line that used to pull the module in.
const IMPORT_RE = /^import \{[^}]*\} from '\.\/edgeAuth\.js';$/m;
const BLOCK_RE = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm');

function inlined(src) {
  if (BLOCK_RE.test(src)) return src.replace(BLOCK_RE, BLOCK);
  if (IMPORT_RE.test(src)) return src.replace(IMPORT_RE, BLOCK);
  throw new Error('no marker block and no ./edgeAuth.js import to replace');
}

// ---------------------------------------------------------------
// AND THE PRIVACY GATE, INTO THE ONE FUNCTION THAT TALKS TO A MODEL
//
// Sprint 1D's gate is a browser module; Sprint 1E's companion-chat has
// to run the IDENTICAL rules server-side, because the client is never
// authoritative for privacy approval. Two copies of a privacy boundary
// that could disagree is exactly the failure the edgeAuth note above
// was written about, so it is generated from the one source in the same
// way and by the same script.
//
// The module is an IIFE assigned to `const CompanionPrivacyGate`, which
// is an ordinary declaration once inlined; its `window` assignment is
// already inside a try/catch and is simply a no-op in Deno.
const GATE_CANON = path.join(ROOT, 'js', 'companionPrivacyGate.js');
const GATE_FUNCTIONS = ['companion-chat'];
const GATE_BEGIN = '// ===== BEGIN GENERATED privacyGate — do not edit below this line =====';
const GATE_END   = '// ===== END GENERATED privacyGate =====';

const GATE_BLOCK = [
  GATE_BEGIN,
  '// Generated from js/companionPrivacyGate.js, which is the readable',
  '// original with every decision explained. Regenerate with:',
  '//   node tools/edge-auth-test/sync-shared.js',
  strip(fs.readFileSync(GATE_CANON, 'utf8')),
  GATE_END,
].join('\n');

const GATE_BLOCK_RE = new RegExp(GATE_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '[\\s\\S]*?' + GATE_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm');

// ---------------------------------------------------------------
// AND THE RETRIEVAL RULES (Sprint 1E.1)
//
// companion-chat retrieves Companion Memory server-side, and must rank
// it by exactly the rules the browser's own store ranks by. Two
// implementations of "which memories answer this question" is two
// things that can disagree about what a Companion knows, so it is
// generated from the one source like everything else here.
const RANK_CANON = path.join(ROOT, 'js', 'companionMemoryRank.js');
const RANK_BEGIN = '// ===== BEGIN GENERATED memoryRank — do not edit below this line =====';
const RANK_END   = '// ===== END GENERATED memoryRank =====';

const RANK_BLOCK = [
  RANK_BEGIN,
  '// Generated from js/companionMemoryRank.js, which is the readable',
  '// original with every decision explained. Regenerate with:',
  '//   node tools/edge-auth-test/sync-shared.js',
  strip(fs.readFileSync(RANK_CANON, 'utf8')),
  RANK_END,
].join('\n');

const RANK_BLOCK_RE = new RegExp(RANK_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '[\\s\\S]*?' + RANK_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm');

// ---------------------------------------------------------------
// AND THE BOND VALIDATOR (Sprint 1G)
//
// The model may propose a memory; this is what decides. Server-only —
// the browser never validates a proposal — so it lives in _shared/ like
// the auth gate, and is generated into the one function that talks to a
// model.
const BOND_CANON = path.join(ROOT, 'supabase', 'functions', '_shared', 'bondValidator.js');
const BOND_BEGIN = '// ===== BEGIN GENERATED bondValidator — do not edit below this line =====';
const BOND_END   = '// ===== END GENERATED bondValidator =====';

const BOND_BLOCK = [
  BOND_BEGIN,
  '// Generated from supabase/functions/_shared/bondValidator.js, which is',
  '// the readable original with every decision explained. Regenerate with:',
  '//   node tools/edge-auth-test/sync-shared.js',
  strip(fs.readFileSync(BOND_CANON, 'utf8')).replace(/^export /gm, ''),
  BOND_END,
].join('\n');

const BOND_BLOCK_RE = new RegExp(BOND_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
  '[\\s\\S]*?' + BOND_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'm');

function withBond(src) {
  if (!BOND_BLOCK_RE.test(src)) throw new Error('no bondValidator marker block to replace');
  return src.replace(BOND_BLOCK_RE, BOND_BLOCK);
}

function withRank(src) {
  if (!RANK_BLOCK_RE.test(src)) throw new Error('no memoryRank marker block to replace');
  return src.replace(RANK_BLOCK_RE, RANK_BLOCK);
}

function withGate(src) {
  if (!GATE_BLOCK_RE.test(src)) throw new Error('no privacyGate marker block to replace');
  return src.replace(GATE_BLOCK_RE, GATE_BLOCK);
}

let drifted = 0, written = 0;
FUNCTIONS.forEach((name) => {
  const dest = path.join(ROOT, 'supabase', 'functions', name, 'index.ts');
  const rel = path.relative(ROOT, dest);
  const before = fs.readFileSync(dest, 'utf8');
  let after;
  try {
    after = inlined(before);
    if (GATE_FUNCTIONS.indexOf(name) !== -1) after = withBond(withRank(withGate(after)));
  } catch (e) { console.log('  ERROR   ' + rel + ' — ' + e.message); drifted++; return; }

  if (after === before) { console.log('  ok      ' + rel); return; }
  drifted++;
  if (checkOnly) { console.log('  DRIFTED ' + rel); return; }
  fs.writeFileSync(dest, after);
  written++;
  console.log('  written ' + rel);
});

// The separate copies this script used to write are gone; a stale one
// left on disk would be dead code that still looks authoritative.
FUNCTIONS.forEach((name) => {
  const stale = path.join(ROOT, 'supabase', 'functions', name, 'edgeAuth.js');
  if (!fs.existsSync(stale)) return;
  if (checkOnly) { console.log('  STALE   ' + path.relative(ROOT, stale)); drifted++; return; }
  fs.unlinkSync(stale);
  console.log('  removed ' + path.relative(ROOT, stale));
});

// ---------------------------------------------------------------
// THE SINGLE-FILE PASTE VARIANT
//
// This repository already solved Dashboard deployment before this sprint
// existed, and the answer was sitting in family-album's own folder:
// dashboard-paste.ts, "index.ts + parse.js merged into ONE file, for
// deploying via the Supabase Dashboard's in-browser editor (no CLI
// needed)". That is how this project deploys. Finding it three attempts
// late is the whole reason those attempts happened.
//
// Its own note said to "keep in lockstep ... by hand", and by the time
// this sprint hardened index.ts it had drifted: it carried no gate at
// all, so pasting it would have deployed an UNHARDENED family-album —
// worse than a failed deploy, because it looks like success.
//
// So it is generated now. A hand-mirrored copy of a security boundary is
// a promise nobody can keep.
const PASTE_HEADER = (name) => [
  '// ============================================================================',
  '// ' + name + ' — DASHBOARD-PASTE VARIANT (single file)',
  '// ============================================================================',
  '// GENERATED — do not edit. This is index.ts with every local import',
  '// inlined, for deploying via the Supabase Dashboard\'s in-browser editor',
  '// (no CLI needed):',
  '//',
  '//   Dashboard → Edge Functions → Deploy a new function → Via Editor',
  '//   → name it exactly:  ' + name,
  '//   → replace the template with this entire file → Deploy',
  '//   (leave "Verify JWT" at its default ON — the function does its own',
  '//    caller check on top of it; see CLAUDE.md → Decision 30)',
  '//',
  '// Regenerate: node tools/edge-auth-test/sync-shared.js',
  '// ============================================================================',
  '',
].join('\n');

// Any remaining `import {...} from './something.js'` is a local file the
// Dashboard would have to carry separately — exactly what does not
// reliably arrive. Inlined here instead.
const LOCAL_IMPORT_RE = /^import \{[^}]*\} from '\.\/([A-Za-z0-9_.-]+\.js)';$/gm;

FUNCTIONS.forEach((name) => {
  const dir = path.join(ROOT, 'supabase', 'functions', name);
  const src = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');
  const locals = [...src.matchAll(LOCAL_IMPORT_RE)];
  const dest = path.join(dir, 'dashboard-paste.ts');
  const rel = path.relative(ROOT, dest);

  // Nothing left to inline: index.ts IS the paste. A variant that merely
  // duplicated it would be a second thing to keep in step, which is the
  // failure this whole section exists to remove.
  if (!locals.length) {
    if (fs.existsSync(dest)) {
      if (checkOnly) { console.log('  STALE   ' + rel + ' (index.ts needs no variant)'); drifted++; return; }
      fs.unlinkSync(dest); console.log('  removed ' + rel);
    }
    return;
  }

  let merged = src;
  locals.forEach((m) => {
    const file = fs.readFileSync(path.join(dir, m[1]), 'utf8').replace(/^export /gm, '');
    merged = merged.replace(m[0], [
      '// ===== BEGIN INLINED ' + m[1] + ' =====',
      file.replace(/\n+$/, ''),
      '// ===== END INLINED ' + m[1] + ' =====',
    ].join('\n'));
  });
  merged = PASTE_HEADER(name) + merged;

  const same = fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === merged;
  if (same) { console.log('  ok      ' + rel); return; }
  drifted++;
  if (checkOnly) { console.log('  DRIFTED ' + rel); return; }
  fs.writeFileSync(dest, merged);
  written++;
  console.log('  written ' + rel);
});

if (checkOnly && drifted) {
  console.log('\n' + drifted + ' file(s) differ from what this script produces.');
  console.log('Run: node tools/edge-auth-test/sync-shared.js');
  process.exit(1);
}
console.log('\n' + (written ? written + ' rewritten' : 'every function already matches') +
  ' — canonical: ' + path.relative(ROOT, CANON));
