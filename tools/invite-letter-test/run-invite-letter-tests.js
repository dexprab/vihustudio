/* THE INVITATION — a letter, not a campaign.
 *
 * Reported by the product owner: the invitation was landing in Gmail's
 * Promotions tab. Gmail was not being unfair. Read as markup this was a
 * campaign, and the loudest signals were the ones the design asked for:
 * a two-column layout with an image grid of two covers and captions, a
 * masthead with a brand name and a tagline, a pill CTA with a background
 * colour, a full-bleed dark wrapper, remote images from our own domain,
 * four links three of which went to one place, and nested ESP tables
 * with a media query.
 *
 * No header outweighs that, so the chrome went and the words stayed.
 * This suite holds BOTH halves: every promotional signal is measured and
 * must be absent, and every sentence, name and link must still be there
 * — a letter that reaches the inbox having lost the invitation is not a
 * fix.
 *
 * THE REAL FUNCTION IS WHAT IS TESTED. The deployed index.ts is
 * transpiled and its own htmlFor/textFor are called — a second copy of
 * the letter in a test could pass while the letter that ships does not.
 *
 * Run:
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/invite-letter-test/run-invite-letter-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'supabase', 'functions', 'invite-send', 'index.ts');

let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  console.log('\nTHE INVITATION\n');

  // Transpile only — the file is checked for types nowhere else either,
  // and a type error is not what this suite is about.
  const js = ts.transpileModule(fs.readFileSync(SRC, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText
    // The handler registers itself at import. Nothing here calls it, and
    // a no-op keeps the rest of the module exactly as it deploys.
    // Anchored: the phrase also appears in a comment further up, and an
    // unanchored replace rewrote THAT and left the real call standing.
    .replace(/^Deno\.serve\(/m, 'const __unused = (')
    + '\nexport { htmlFor, textFor, subjectFor, BOOKS };\n';

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'invite-'));
  const file = path.join(dir, 'letter.mjs');
  // Deno is not here; the letter only ever asks it for INVITE_BASE_URL.
  fs.writeFileSync(file, 'globalThis.Deno = { env: { get: () => "" } };\n' + js);
  const mod = await import('file://' + file);

  const LINK = 'https://vihuplanet.com/?invite=abc123def';
  const NOTE = 'Amay — this one made me think of you.';
  const html = mod.htmlFor(LINK, NOTE);
  const text = mod.textFor(LINK, NOTE);
  const subject = mod.subjectFor();

  // ---- what Gmail reads as a campaign --------------------------------
  console.log('-- the campaign signals');
  const signals = [
    ['an image', /<img\b/i],
    ['a table', /<table\b/i],
    ['a CTA with a background colour', /bgcolor=|background(-color)?\s*:/i],
    ['a document wrapper', /<!doctype|<html\b|<body\b/i],
    ['a media query', /@media/i],
    ['a stylesheet block', /<style\b/i],
    ['a rounded pill', /border-radius/i],
    ['a masthead tagline', /a quiet place where children/i],
  ];
  signals.forEach(([what, re]) => {
    check(!re.test(html), 'L1 the letter carries no ' + what);
  });

  const hrefs = (html.match(/href="([^"]*)"/g) || []).map((h) => h.slice(6, -1));
  check(hrefs.length <= 3, 'L2 three links at most — the door and the two stories',
    hrefs.length + ': ' + hrefs.join(' | '));
  check(hrefs.every((h) => h.indexOf('invite=abc123def') >= 0),
    'L3 every link carries the invitation, so the journey is recorded whichever they take');
  // A promotional button says "Open the Door"; a letter shows you where
  // it is sending you. Matching text to href is also the opposite of
  // what a phishing filter is looking for.
  check(html.indexOf('>' + LINK.replace(/&/g, '&amp;') + '</a>') > 0,
    'L4 the main link shows its own destination');
  check(!/unsubscribe/i.test(html) && !/unsubscribe/i.test(text),
    'L5 no unsubscribe line — it is a bulk signal, and this is one letter to one person');

  // ---- and what must NOT have been lost -------------------------------
  console.log('\n-- and the invitation itself');
  const KEPT = [
    'I found a little door in VihuPlanet',
    'It had a beginning',
    'What if you finished it?',
    'leave something of your own behind',
    'So I left the door open',
    'Just come in',
    'Lumo',
    'Keeper of VihuPlanet',
    'For parents',
    'Best on a laptop',
  ];
  KEPT.forEach((phrase) => {
    check(html.replace(/&#8217;/g, "'").replace(/&#8230;/g, '…').indexOf(phrase) >= 0,
      'L6 the letter still says "' + phrase + '"');
  });
  check(html.indexOf(NOTE) > 0, 'L7 the sender\'s own note is still carried');
  mod.BOOKS.forEach((b) => {
    check(html.indexOf(b.name.replace(/&/g, '&amp;')) > 0 || html.indexOf(b.name) > 0,
      'L8 "' + b.name + '" is still named');
    check(hrefs.some((h) => h.indexOf('story=' + encodeURIComponent(b.id)) >= 0),
      'L9 …and is still its own door');
  });

  // The plain part is not a fallback; plenty of people read mail with
  // images off, and after this change the two now say the same thing.
  console.log('\n-- the two halves agree');
  check(/vihuplanet\.com\/\?invite=abc123def/.test(text), 'L10 the plain letter carries the door');
  check(mod.BOOKS.every((b) => text.indexOf('story=' + b.id) >= 0),
    'L11 …and both stories');
  check(text.indexOf(NOTE) > 0, 'L12 …and the note');
  // The same words in the same order. They used to differ by a
  // paragraph, which nobody chose and nobody could see.
  const order = (s, a, b2) => s.indexOf(a) < s.indexOf(b2);
  check(order(html, 'Just come in', NOTE) === order(text, 'Just come in', NOTE) &&
        order(html, NOTE, 'Two stories') === order(text, NOTE, 'Two stories'),
    'L12b the note sits in the same place in both halves');
  check(!/subject|^\s*$/i.test(subject) === false || subject.length > 5,
    'L13 the subject is a sentence a person would write', subject);
  check(!/[!]|free|offer|sale|discount|click here|limited/i.test(subject),
    'L14 …with no marketing words in it', subject);

  // What actually ships, so it can be looked at rather than imagined.
  const out = path.join(__dirname, 'letter.html');
  fs.writeFileSync(out, html);
  console.log('\n  wrote ' + path.relative(ROOT, out) + '  (' + html.length + ' bytes of markup)');

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
