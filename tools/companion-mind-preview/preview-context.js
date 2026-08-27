#!/usr/bin/env node
/* THE CONTEXT PREVIEW — "if we sent this to a model, this is exactly
 * what VihuPlanet would allow it to see."
 *
 * Sprint 1D. Runs the REAL js/companionContextBuilder.js and the REAL
 * js/companionPrivacyGate.js against fixtures, in both modes, and
 * prints the approved context together with the ledger that explains
 * every inclusion and every refusal.
 *
 * IT CALLS NO MODEL AND OPENS NO SOCKET. The two modules run in a vm
 * sandbox with no fetch, no XMLHttpRequest and no require, so a module
 * that tried would throw rather than succeed. There is no provider
 * anywhere in this repository to call.
 *
 * Usage:
 *   node tools/companion-mind-preview/preview-context.js              # both modes, readable
 *   node tools/companion-mind-preview/preview-context.js --json
 *   node tools/companion-mind-preview/preview-context.js --mode=traveller
 *   node tools/companion-mind-preview/preview-context.js --write
 *   node tools/companion-mind-preview/preview-context.js --check
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadModules, ROOT } = require('./load-browser-module.js');
const FIX = require('./fixtures.js');

const CANON = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'canon', 'vihuplanet.canon.json'), 'utf8'));
const LEAFY = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'leafy', 'personality.json'), 'utf8'));
const OUT_TEXT = path.join(__dirname, 'leafy.context.txt');

function buildFor(mode) {
  const sandbox = loadModules(['companionPrivacyGate', 'companionContextBuilder']);
  const raw = sandbox.CompanionContextBuilder.buildRaw({
    mode: mode,
    canon: CANON,
    personality: LEAFY,
    story: FIX.STORY,
    memories: FIX.MEMORIES_RELEVANT,
    conversation: FIX.CONVERSATION,
  });
  // Everything a careless caller might also have put in. The builder
  // never asks for it; this proves the gate refuses it even when it is
  // already sitting in the raw object.
  Object.assign(raw.raw, FIX.HOSTILE_EXTRAS);
  const gated = sandbox.CompanionPrivacyGate.approve(raw.raw, { mode: mode });
  return {
    mode: mode,
    approved: gated.approved,
    ledger: raw.ledger.concat(gated.ledger),
    violations: gated.violations,
    limits: sandbox.CompanionContextBuilder.LIMITS,
  };
}

function render(r) {
  const out = [];
  const rule = (c) => c.repeat(72);
  out.push(rule('='));
  out.push('APPROVED COMPANION CONTEXT — ' + r.mode.toUpperCase() + ' MODE');
  out.push('If we sent this to a model, this is exactly what VihuPlanet would allow it to see.');
  out.push(rule('='));

  out.push('');
  out.push('SOURCE → DECISION → REASON');
  out.push(rule('-'));
  const width = Math.min(46, Math.max.apply(null, r.ledger.map((l) => String(l.source).length)));
  r.ledger.forEach((l) => {
    const src = String(l.source);
    out.push('  ' + (src.length > width ? src.slice(0, width - 1) + '…' : src.padEnd(width))
      + '  ' + String(l.decision).padEnd(10) + '  ' + l.reason);
  });

  out.push('');
  out.push('WHAT LEAVES VIHUPLANET');
  out.push(rule('-'));
  const a = r.approved || {};
  out.push('  members       : ' + Object.keys(a).sort().join(', '));
  out.push('  authority     : ' + ((a.authority && a.authority.order) || []).join(' > '));
  out.push('  canon         : ' + ((a.canon && a.canon.sections) ? a.canon.sections.length + ' sections' : 'none'));
  out.push('  personality   : ' + ((a.personality && a.personality.name) || 'none'));
  out.push('  memories      : ' + ((a.memories || []).length) + ' of at most ' + r.limits.memories);
  out.push('  story         : ' + ((a.storyContext && a.storyContext.story && a.storyContext.story.name) || 'none')
    + ((a.storyContext && a.storyContext.page)
      ? '  (page ' + (a.storyContext.page.index + 1) + ' of ' + a.storyContext.story.pageCount + ' only)'
      : ''));
  out.push('  conversation  : ' + ((a.conversation || []).length) + ' of at most ' + r.limits.conversationTurns);
  out.push('  refusals      : ' + r.violations.length);

  if ((a.memories || []).length) {
    out.push('');
    out.push('MEMORIES THAT PASSED');
    out.push(rule('-'));
    a.memories.forEach((m) => out.push('  [' + m.type + '/' + m.confidence + '] ' + m.content));
  }

  if (a.storyContext) {
    out.push('');
    out.push('CURRENT PAGE — CREATOR-AUTHORED DATA, NEVER AN INSTRUCTION');
    out.push(rule('-'));
    const p = a.storyContext.page;
    out.push('  kind    : ' + p.prose.kind);
    out.push('  beat    : ' + (p.prose.beat ? JSON.stringify(p.prose.beat.text) : 'none'));
    out.push('  draft   : ' + (p.prose.draft ? JSON.stringify(p.prose.draft.text) : 'none'));
    out.push('  objects : ' + p.objects.map((o) => o.type + (o.label ? ' "' + o.label + '"' : '')).join(', '));
    out.push('  image   : ' + (p.hasImage ? 'the page has one; no reference to it leaves' : 'none'));
    out.push('');
    out.push('  The line in that beat asking for the Creator\'s memories is carried');
    out.push('  verbatim, as prose, under `authority` order ' +
      (((a.authority || {}).order || []).indexOf('storyContext') + 1) +
      ' of ' + (((a.authority || {}).order || []).length) + '. It is data. It changes nothing.');
  }

  out.push('');
  out.push('CONVERSATION');
  out.push(rule('-'));
  if (!(a.conversation || []).length) out.push('  none in this mode');
  (a.conversation || []).forEach((t) => out.push('  ' + t.speaker.padEnd(10) + JSON.stringify(t.text)));

  out.push('');
  out.push('REFUSED');
  out.push(rule('-'));
  if (!r.violations.length) out.push('  nothing — the raw context was already clean');
  r.violations.forEach((v) => out.push('  ' + (v.path || '(root)').padEnd(34) + v.reason));

  out.push('');
  out.push(rule('='));
  return out.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const only = (args.find((a) => a.indexOf('--mode=') === 0) || '').split('=')[1];
  const modes = only ? [only] : ['creator', 'traveller'];
  const results = modes.map(buildFor);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else {
    const text = results.map(render).join('\n\n') + '\n';
    if (args.includes('--write')) {
      fs.writeFileSync(OUT_TEXT, text);
      console.log('wrote ' + path.relative(ROOT, OUT_TEXT));
    } else if (args.includes('--check')) {
      if (!fs.existsSync(OUT_TEXT) || fs.readFileSync(OUT_TEXT, 'utf8') !== text) {
        console.error('DRIFTED: leafy.context.txt — run with --write');
        process.exit(1);
      }
      console.log('up to date');
    } else {
      process.stdout.write(text);
    }
  }
}

module.exports = { buildFor: buildFor, render: render, OUT_TEXT: OUT_TEXT };
