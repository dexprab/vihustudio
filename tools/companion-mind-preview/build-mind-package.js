#!/usr/bin/env node
/* THE MIND PACKAGE — what a future Companion Mind would be handed.
 *
 * Sprint 1C. This assembles and prints the STATIC half of that package
 * and nothing else:
 *
 *     { canon, personality }
 *
 * The full shape a Companion Mind will one day consume is
 * { canon, personality, memories, currentContext, conversation }.
 * The last three are deliberately absent and this file has no way to
 * produce them: it reads two files off disk and stops. There is no
 * memory here, no Creator, no story, no conversation — not filtered
 * out, but never reachable.
 *
 * IT IS A DEVELOPER TOOL AND IT IS OFFLINE. It opens no socket, calls
 * no model, and touches nothing the Studio loads at runtime. Reading
 * two files is the whole of what it does, which is why "makes no
 * external network call" is a property of the program rather than a
 * promise about it.
 *
 * Usage:
 *   node tools/companion-mind-preview/build-mind-package.js            # JSON to stdout
 *   node tools/companion-mind-preview/build-mind-package.js --text     # readable
 *   node tools/companion-mind-preview/build-mind-package.js --write    # regenerate the committed preview
 *   node tools/companion-mind-preview/build-mind-package.js --check    # has the committed preview drifted?
 *   node tools/companion-mind-preview/build-mind-package.js --companion=leafy
 *
 * The generated files are committed so the package is reviewable in a
 * pull request without anybody running anything — and --check is what
 * stops them drifting from the sources, the same discipline
 * tools/edge-auth-test/sync-shared.js already holds.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CANON = path.join(ROOT, 'assets', 'canon', 'vihuplanet.canon.json');
const OUT_JSON = path.join(__dirname, 'leafy.mind.json');
const OUT_TEXT = path.join(__dirname, 'leafy.mind.txt');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * The package. Canon and personality are loaded INDEPENDENTLY and
 * neither is merged into the other — a Companion's personality never
 * restates the canon, and the canon never describes a particular
 * Companion. Keeping them as two values rather than one flattened
 * object is what keeps that true by construction.
 */
function build(companionId) {
  const id = companionId || 'leafy';
  const personalityFile = path.join(ROOT, 'assets', id, 'personality.json');
  const canon = readJSON(CANON);
  const personality = readJSON(personalityFile);
  return {
    package: 'companion-mind',
    packageVersion: '1.0',
    companionId: id,
    contains: ['canon', 'personality'],
    // Named so a reader can see what is NOT here without having to
    // notice an absence. A future sprint moves entries out of this
    // list into `contains`; nothing here is filtered at assembly time,
    // because nothing here is reachable from this program at all.
    notYetIncluded: ['memories', 'currentContext', 'conversation'],
    canon: canon,
    personality: personality,
  };
}

// A readable rendering, for the person who wants to read what Leafy
// believes rather than parse it.
function toText(pkg) {
  const out = [];
  const rule = (c) => c.repeat(66);
  out.push(rule('='));
  out.push('MIND PACKAGE — ' + pkg.personality.name + ' (' + pkg.companionId + ')');
  out.push('contains: ' + pkg.contains.join(' + '));
  out.push('not yet included: ' + pkg.notYetIncluded.join(', '));
  out.push(rule('='));

  out.push('');
  out.push('PART ONE — CANON: what ' + pkg.personality.name + ' understands the world to be');
  out.push(rule('-'));
  out.push(pkg.canon.title + '  (v' + pkg.canon.canonVersion + ')');
  out.push('');
  out.push(pkg.canon.purpose);
  pkg.canon.sections.forEach((s) => {
    out.push('');
    out.push(s.id + ' — ' + s.title.toUpperCase() + '   [' + s.establishedIn + ']');
    (s.truths || []).forEach((t) => out.push('   · ' + t));
    (s.may || []).forEach((t) => out.push('   MAY      ' + t));
    (s.mayNot || []).forEach((t) => out.push('   MAY NOT  ' + t));
    if (s.opinionTest) {
      out.push('   TEST     ' + s.opinionTest.rule);
      s.opinionTest.allowed.forEach((l) => out.push('      allowed:     "' + l + '"'));
      s.opinionTest.notAllowed.forEach((l) => out.push('      not allowed: "' + l + '"'));
    }
    (s.futureScope || []).forEach((t) => out.push('   FUTURE   ' + t));
  });
  if (pkg.canon.openQuestions) {
    out.push('');
    out.push('OPEN QUESTIONS');
    pkg.canon.openQuestions.forEach((q) => out.push('   ? ' + q));
  }

  out.push('');
  out.push(rule('='));
  out.push('PART TWO — PERSONALITY: how ' + pkg.personality.name + ' behaves as a Companion');
  out.push(rule('-'));
  const p = pkg.personality;
  Object.keys(p).forEach((k) => {
    const v = p[k];
    if (typeof v === 'string') {
      out.push('');
      out.push(k.toUpperCase());
      out.push('   ' + v);
    } else if (Array.isArray(v)) {
      out.push('');
      out.push(k.toUpperCase() + ': ' + v.join(' · '));
    } else if (v && typeof v === 'object') {
      out.push('');
      out.push(k.toUpperCase());
      Object.keys(v).forEach((k2) => {
        const v2 = v[k2];
        if (Array.isArray(v2)) {
          out.push('   ' + k2 + ':');
          v2.forEach((x) => out.push('      · ' + x));
        } else if (v2 && typeof v2 === 'object') {
          out.push('   ' + k2 + ':');
          Object.keys(v2).forEach((k3) => out.push('      ' + k3 + ' — ' + v2[k3]));
        } else {
          out.push('   ' + k2 + ': ' + v2);
        }
      });
    }
  });
  out.push('');
  out.push(rule('='));
  return out.join('\n') + '\n';
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.indexOf('--companion=') === 0);
  const pkg = build(idArg ? idArg.split('=')[1] : 'leafy');
  const json = JSON.stringify(pkg, null, 2) + '\n';
  const text = toText(pkg);

  if (args.includes('--write')) {
    fs.writeFileSync(OUT_JSON, json);
    fs.writeFileSync(OUT_TEXT, text);
    console.log('wrote ' + path.relative(ROOT, OUT_JSON) + ' and ' + path.relative(ROOT, OUT_TEXT));
  } else if (args.includes('--check')) {
    const drifted = [];
    if (!fs.existsSync(OUT_JSON) || fs.readFileSync(OUT_JSON, 'utf8') !== json) drifted.push('leafy.mind.json');
    if (!fs.existsSync(OUT_TEXT) || fs.readFileSync(OUT_TEXT, 'utf8') !== text) drifted.push('leafy.mind.txt');
    if (drifted.length) {
      console.error('DRIFTED: ' + drifted.join(', ') + ' — run with --write');
      process.exit(1);
    }
    console.log('up to date');
  } else if (args.includes('--text')) {
    process.stdout.write(text);
  } else {
    process.stdout.write(json);
  }
}

module.exports = { build: build, toText: toText, CANON: CANON, OUT_JSON: OUT_JSON, OUT_TEXT: OUT_TEXT };
