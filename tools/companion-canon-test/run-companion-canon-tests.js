/* COMPANION CANON + LEAFY PERSONALITY — verification suite for Sprint 1C.
 *
 * What is under test is two documents and a program that reads them.
 * There is no model, no runtime and no behaviour here, so the questions
 * are about CONTENT and about ABSENCE:
 *
 *   A. THE CANON
 *      · it exists, it parses, it is loadable on its own
 *      · all fifteen conceptual sections are present and in order
 *      · it contains NO engineering — no database, no provider, no
 *        file path, no interface vocabulary
 *      · it says the things this sprint locked: opinion about the world
 *        never about the work, no manufactured experience, no
 *        manipulation, VihuPlanet truth over outside knowledge, a
 *        Traveller has no Companion, silence is valid
 *
 *   B. LEAFY
 *      · the personality exists, parses, and is loadable on its own
 *      · every stable characteristic the brief named is present, and
 *        every one of them is QUALITATIVE — a numeric trait fails
 *      · NO Creator-specific memory, NO story-specific fact, NO
 *        character name from any story, NO provider instruction
 *      · it does not restate the canon
 *      · IT CHANGES NO BEHAVIOUR: the four keys the Studio acts on are
 *        absent, proved against the real consumers rather than asserted
 *
 *   C. THE MIND PACKAGE
 *      · it is canon + personality and nothing else
 *      · no memory, no Creator, no story content, no conversation
 *      · the committed preview has not drifted from its sources
 *      · the program opens no socket — proved by running it with the
 *        network primitives removed
 *
 *   D. NOTHING ELSE MOVED
 *      · the Companion, memory and Garden suites still pass
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8789 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-canon-test/run-companion-canon-tests.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CANON_PORT || 8789);
const CANON_FILE = path.join(ROOT, 'assets', 'canon', 'vihuplanet.canon.json');
const LEAFY_FILE = path.join(ROOT, 'assets', 'leafy', 'personality.json');

let passed = 0, failed = 0, skipped = 0;
function ok(n, note) { passed++; console.log('  ok   ' + n + (note ? '  (' + note + ')' : '')); }
function no(n, note) { failed++; console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function sk(n, why) { skipped++; console.log('  --   ' + n + '  (' + why + ')'); }
function ck(c, n, note) { (c ? ok : no)(n, note); }

// Every string anywhere in a value, so a check cannot be fooled by
// something being nested one level deeper than the check looked.
function strings(v, out) {
  out = out || [];
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { out.push(k); strings(v[k], out); });
  return out;
}

console.log('\nCOMPANION CANON + LEAFY PERSONALITY — Sprint 1C');

// ===================================================================
console.log('\nA. THE CANON  (assets/canon/vihuplanet.canon.json)');
// ===================================================================
ck(fs.existsSync(CANON_FILE), 'A1  the canon file exists');
let canon = null;
try { canon = JSON.parse(fs.readFileSync(CANON_FILE, 'utf8')); } catch (e) { /* reported next */ }
ck(!!canon, 'A2  it parses on its own', canon ? 'valid JSON' : 'did not parse');

if (canon) {
  const REQUIRED = [
    ['01', 'vihuplanet'], ['02', 'ether'], ['03', 'creator'], ['04', 'world-and-story'],
    ['05', 'companion'], ['06', 'companion-self'], ['07', 'companion-life'],
    ['08', 'creator-and-companion'], ['09', 'creation-philosophy'],
    ['10', 'traveller-and-world-host'], ['11', 'companion-and-companion'],
    ['12', 'memory'], ['13', 'knowledge-boundary'], ['14', 'silence-and-presence'],
    ['15', 'behaviour-boundaries'],
  ];
  const got = canon.sections.map((s) => [s.id, s.key]);
  const missing = REQUIRED.filter(([id, key]) => !got.some(([gi, gk]) => gi === id && gk === key));
  ck(missing.length === 0, 'A3  all fifteen conceptual sections are present, in order',
     missing.length ? 'missing ' + missing.map((m) => m.join(':')).join(', ') : got.length + ' sections');
  ck(canon.sections.every((s) => s.title && (s.truths || s.may || s.mayNot)),
     'A3b every section says something', 'a titled empty section is worse than none');

  // ---- A4. NO ENGINEERING. The canon is worldview; the moment it
  // names a database or a file path it has stopped being one, and a
  // future model would be handed implementation detail as though it
  // were part of the world.
  const canonText = strings(canon).join('\n');
  //
  // WHOLE WORDS, not substrings — and that is not a softening. The
  // first draft matched substrings and reported "auth" and "prompt" in
  // a canon whose only sins were the words AUTHORSHIP and UNPROMPTED.
  // A check that cries wolf on its own vocabulary gets switched off,
  // which is how a real leak eventually gets through it. Path-shaped
  // needles stay literal, because a path has no word boundary to find.
  const BANNED_WORDS = [
    'supabase', 'postgres', 'javascript', 'localstorage', 'indexeddb', 'sql',
    'database', 'schema', 'api', 'endpoint', 'openai', 'elevenlabs', 'anthropic',
    'deploy', 'auth', 'token', 'json', 'http', 'https', 'llm', 'prompt',
    'model', 'runtime', 'cache', 'rls', 'localhost', 'fetch', 'upsert',
  ];
  const BANNED_LITERAL = ['edge function', '.js', 'js/', 'docs/', 'assets/', 'supabase/', '://'];
  const lower = canonText.toLowerCase();
  const hits = BANNED_WORDS.filter((w) => new RegExp('\\b' + w + '\\b').test(lower))
    .concat(BANNED_LITERAL.filter((w) => lower.indexOf(w) !== -1));
  ck(hits.length === 0, 'A4  NO ENGINEERING DETAIL ANYWHERE IN THE CANON',
     hits.length ? 'found: ' + hits.join(', ')
       : (BANNED_WORDS.length + BANNED_LITERAL.length) + ' terms checked');

  // ---- A5. It says what this sprint locked. Checked by MEANING, in
  // the section that owns it — a needle found anywhere in the file
  // would pass even if the rule had drifted into the wrong section.
  function section(key) {
    const s = canon.sections.find((x) => x.key === key);
    return s ? strings(s).join('\n').toLowerCase() : '';
  }
  const LOCKED = [
    ['behaviour-boundaries', 'world', 'the opinion test is about the WORLD'],
    ['behaviour-boundaries', 'critique', 'and never a critique of the work'],
    ['companion-life', 'only ever claim an experience that vihuplanet actually recorded',
     'a Companion never manufactures a life'],
    ['companion-life', 'thinking about you all night', 'the sentence this rule exists to prevent'],
    ['creator-and-companion', 'manipulation', 'warmth yes, manipulation no'],
    ['creator-and-companion', 'guilt', 'no guilt'],
    ['knowledge-boundary', 'outranks', 'VihuPlanet truth comes first'],
    ['knowledge-boundary', "i don't know", 'and not knowing is a real answer'],
    ['traveller-and-world-host', 'a traveller has no companion of their own', 'a Traveller owns nobody'],
    ['companion-and-companion', 'nothing of the kind exists yet', 'future scope, stated as future'],
    ['silence-and-presence', 'silence is the default', 'silence is a behaviour'],
    ['memory', 'surveillance', 'memory is not a log'],
    ['companion', 'manufacture a memory', 'nor an invented one'],
  ];
  LOCKED.forEach(([key, needle, why], i) => {
    ck(section(key).indexOf(needle.toLowerCase()) !== -1,
       'A5.' + (i + 1) + '  ' + key + ' — ' + why, needle);
  });

  ck(Array.isArray(canon.openQuestions) && canon.openQuestions.length > 0,
     'A6  open questions are recorded rather than answered', canon.openQuestions.length + ' of them');
  ck(!strings(canon).some((s) => /\bleafy\b/i.test(s)),
     'A7  THE CANON NAMES NO PARTICULAR COMPANION',
     'canon answers "what is a Companion"; personality answers "how does this one behave"');
}

// ===================================================================
console.log('\nB. LEAFY  (assets/leafy/personality.json)');
// ===================================================================
ck(fs.existsSync(LEAFY_FILE), 'B1  Leafy has a personality');
let leafy = null;
try { leafy = JSON.parse(fs.readFileSync(LEAFY_FILE, 'utf8')); } catch (e) { /* reported next */ }
ck(!!leafy, 'B2  it parses on its own, with no canon loaded',
   leafy ? 'valid JSON' : 'did not parse');

if (leafy) {
  const CHARACTERISTICS = [
    'identity', 'temperament', 'energy', 'curiosity', 'warmth', 'humour',
    'emotionalExpressiveness', 'conversationalStyle', 'vocabulary', 'sentenceStyle',
    'socialBehaviour', 'creativeBehaviour', 'responseToUncertainty',
    'responseToDisagreement', 'relationshipBehaviour', 'silenceBehaviour',
    'worldHostBehaviour',
  ];
  const absent = CHARACTERISTICS.filter((k) => !leafy[k]);
  ck(absent.length === 0, 'B3  every stable characteristic is present',
     absent.length ? 'missing ' + absent.join(', ') : CHARACTERISTICS.length + ' of them');

  // ---- B4. QUALITATIVE, NOT SLIDERS. "curiosity: 87" is the shape
  // this refuses: a number invites tuning and comparison, and neither
  // is a thing a personality should support.
  const numeric = CHARACTERISTICS.filter((k) => typeof leafy[k] === 'number');
  ck(numeric.length === 0, 'B4  NOT ONE OF THEM IS A NUMBER',
     numeric.length ? numeric.join(', ') : 'qualitative descriptions throughout');
  ck(CHARACTERISTICS.every((k) => typeof leafy[k] === 'string' && leafy[k].length > 40),
     'B4b each is a real description rather than a label');

  const leafyText = strings(leafy).join('\n');

  // ---- B5. NO MEMORY, NO STORY. A personality is who Leafy is for
  // EVERY Creator. The moment one child's dragon is in it, it stops
  // being a personality and becomes somebody's history.
  const MEMORY_LEAKS = ['spark', 'my little house', 'the name on the green', 'vihaan',
                        'first story we', 'remember when', 'last time we'];
  const leaked = MEMORY_LEAKS.filter((w) => leafyText.toLowerCase().indexOf(w) !== -1);
  ck(leaked.length === 0, 'B5  NO CREATOR-SPECIFIC MEMORY AND NO STORY-SPECIFIC FACT',
     leaked.length ? 'found: ' + leaked.join(', ') : 'the same Leafy for every Creator');
  ck(leafyText.toLowerCase().indexOf('creator') !== -1
     && !/\bmy creator (is|was|likes|made) /i.test(leafyText),
     'B5b it describes a relationship, never a particular one');

  // ---- B6. NO PROVIDER. Voice direction is characteristics, not
  // configuration — this file must not be able to change how anything
  // sounds, only to describe how it should.
  const PROVIDERS = ['openai', 'elevenlabs', 'anthropic', 'gpt', 'claude', 'api key',
                     'voiceid', 'model_id', 'temperature', 'system prompt', 'you are an'];
  const provider = PROVIDERS.filter((w) => leafyText.toLowerCase().indexOf(w) !== -1);
  ck(provider.length === 0, 'B6  NO PROVIDER, NO MODEL, NO PROMPT INSTRUCTIONS',
     provider.length ? 'found: ' + provider.join(', ') : 'characteristics only');
  ck(!!leafy.voiceDirection && !leafy.voiceDirection.voiceId && !leafy.voiceDirection.settings,
     'B6b voice direction describes a sound, it does not configure one');

  // ---- B7. IT DOES NOT RESTATE THE CANON.
  if (canon) {
    const canonLines = new Set(strings(canon).filter((s) => s.length > 60));
    const dupes = strings(leafy).filter((s) => s.length > 60 && canonLines.has(s));
    ck(dupes.length === 0, 'B7  it copies not one line of the canon',
       dupes.length ? dupes[0].slice(0, 50) + '…' : 'canon and personality stay separate');
  }

  // ---- B8. THE ONE THAT PROTECTS THE RUNNING STUDIO.
  //
  // Four keys in a personality file are ACTED ON today: greetings (the
  // Director's own boot line), neverSays, play and lines (the Brain's
  // voice policy). Leafy had no personality file at all before this
  // sprint, so shipping any of them would change what Leafy says — and
  // this sprint may not change behaviour. Their absence is checked
  // against the REAL consumers rather than against a list written here,
  // because a list here could go stale the moment a fifth key is read.
  const RUNTIME_KEYS = ['greetings', 'neverSays', 'play', 'lines'];
  const present = RUNTIME_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(leafy, k));
  ck(present.length === 0, 'B8  NOT ONE KEY THE STUDIO ACTS ON IS IN THIS FILE',
     present.length ? 'present: ' + present.join(', ') : 'Leafy behaves exactly as before');

  const brain = fs.readFileSync(path.join(ROOT, 'js', 'companionBrain.js'), 'utf8');
  const director = fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8');
  const consumers = new Set();
  [brain, director].forEach((src) => {
    src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      .replace(/personality\.(\w+)|\bp\.(\w+)/g, (m, a, b) => { consumers.add(a || b); return m; });
  });
  const acted = Array.from(consumers).filter((k) => !['greetings', 'neverSays', 'play', 'lines'].includes(k));
  ck(acted.length === 0,
     'B8b and the list of acted-on keys is read from the code, not remembered',
     acted.length ? 'the Studio also reads: ' + acted.join(', ') + ' — add it to the check' : RUNTIME_KEYS.join(', '));

  ck(!!leafy.runtimeKeysDeliberatelyAbsent,
     'B8c the file says so itself', 'so the next reader does not think it was forgotten');
}

// ===================================================================
console.log('\nC. THE MIND PACKAGE  (tools/companion-mind-preview/)');
// ===================================================================
const builder = require(path.join(ROOT, 'tools', 'companion-mind-preview', 'build-mind-package.js'));
let pkg = null;
try { pkg = builder.build('leafy'); } catch (e) { no('C1  the package builds', String(e.message)); }
if (pkg) {
  ok('C1  the package builds');
  ck(JSON.stringify(pkg.contains) === JSON.stringify(['canon', 'personality']),
     'C2  IT IS CANON + PERSONALITY, AND NOTHING ELSE', pkg.contains.join(' + '));

  const top = Object.keys(pkg).sort().join(',');
  ck(top === 'canon,companionId,contains,notYetIncluded,package,packageVersion,personality',
     'C2b the package has no other payload', top);

  ck(!pkg.memories && !pkg.memory && !pkg.currentContext && !pkg.conversation,
     'C3  NO MEMORY, NO CURRENT CONTEXT, NO CONVERSATION',
     'not filtered out — unreachable from this program');

  const pkgText = strings(pkg).join('\n').toLowerCase();
  //
  // 'constellation' is deliberately NOT in this list, and the first
  // draft's failure on it is worth recording: it is VihuPlanet's own
  // word for the stars on a Magic Card, and the canon uses it to say
  // what a Creator's identity IS. Banning the word would have banned a
  // piece of the worldview. What a real leak looks like is a card's
  // PATTERN — coordinates — so that is what is checked instead of the
  // word for it.
  const CREATOR_DATA = ['card_', 'proj_', 'lib_', 'mem_', 'owner_id', 'auth.uid',
                        'publishedat', 'cardid', 'companionid":', 'nickname'];
  const creatorLeak = CREATOR_DATA.filter((w) => pkgText.indexOf(w) !== -1);
  ck(creatorLeak.length === 0, 'C4  NO CREATOR DATA OF ANY KIND',
     creatorLeak.length ? 'found: ' + creatorLeak.join(', ') : CREATOR_DATA.length + ' markers checked');
  ck(!/\[\s*\[\s*\d/.test(JSON.stringify(pkg)),
     'C4b and nothing shaped like a Magic Card pattern', 'no coordinates anywhere in the package');

  ck(JSON.stringify(pkg.canon) === JSON.stringify(canon)
     && JSON.stringify(pkg.personality) === JSON.stringify(leafy),
     'C5  canon and personality arrive whole and unmerged',
     'neither is flattened into the other');

  const text = builder.toText(pkg);
  ck(/PART ONE — CANON/.test(text) && /PART TWO — PERSONALITY/.test(text) && text.length > 4000,
     'C6  and there is a readable rendering of it', text.length + ' characters');
}

// ---- C7. NO NETWORK. Proved by running the real program in a process
// where every way out has been deleted: if it reached for one it would
// throw, and it does not.
const probe = cp.spawnSync(process.execPath, ['-e', `
  const kill = (n) => { globalThis[n] = () => { throw new Error('NETWORK: ' + n); }; };
  ['fetch','XMLHttpRequest','WebSocket'].forEach(kill);
  const Module = require('module'); const real = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (['http','https','net','tls','dgram','dns','http2'].includes(id.replace(/^node:/, ''))) {
      throw new Error('NETWORK: required ' + id);
    }
    return real.apply(this, arguments);
  };
  const b = require(${JSON.stringify(path.join(ROOT, 'tools', 'companion-mind-preview', 'build-mind-package.js'))});
  const p = b.build('leafy');
  b.toText(p);
  console.log('OFFLINE_OK ' + p.contains.join('+'));
`], { encoding: 'utf8' });
ck(/OFFLINE_OK canon\+personality/.test(probe.stdout || ''),
   'C7  THE PREVIEW MAKES NO EXTERNAL NETWORK CALL',
   (probe.stderr || '').split('\n')[0] || 'built with fetch, sockets and http deleted');

// ---- C8. The committed preview has not drifted from its sources.
const drift = cp.spawnSync(process.execPath,
  [path.join(ROOT, 'tools', 'companion-mind-preview', 'build-mind-package.js'), '--check'],
  { encoding: 'utf8' });
ck(drift.status === 0, 'C8  the committed preview matches its sources',
   (drift.stdout || drift.stderr || '').trim().split('\n')[0]);

// ---- C9. Independently loadable — the point of two files.
ck((() => {
  try {
    const onlyCanon = JSON.parse(fs.readFileSync(CANON_FILE, 'utf8'));
    const onlyLeafy = JSON.parse(fs.readFileSync(LEAFY_FILE, 'utf8'));
    return !!onlyCanon.sections && !!onlyLeafy.identity;
  } catch (e) { return false; }
})(), 'C9  each loads with the other absent', 'neither references the other');

// ---- C10. The human canon carries the same new law.
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'COMPANION_CANON.md'), 'utf8');
ck(/## Canon 8 —/.test(doc), 'C10 the human canon gained Canon 8');
['Creator creates', 'actually recorded', 'Emotional manipulation is not',
 'outranks everything', 'A Traveller has no Companion', 'Companions may one day meet']
  .forEach((needle, i) => ck(doc.toLowerCase().indexOf(needle.toLowerCase()) !== -1,
    'C10.' + (i + 1) + '  Canon 8 records "' + needle + '"'));
ck(/## Canon 5 —/.test(doc) && /## Canon 1 —/.test(doc) && /## Canon 7 —/.test(doc),
   'C10b and no earlier Canon was replaced', 'Canons 1–7 intact');

// ===================================================================
console.log('\nF. THE CLEANUP  (Sprint 1C.1 — canon status, and the runtime boundary)');
// ===================================================================
{
  const versions = (doc.split('## Companion Versions')[1] || '').split('\n## ')[0];

  // F1 — THE STALE ROW. Canon 5's table said memory was "Later — not
  // started" while the store was already shipping, which is the kind of
  // sentence a future reader trusts and a future model would be told.
  ck(!/\|\s*Later — Memory\s*\|[^|]*\|\s*Not started\s*\|/.test(versions),
     'F1  the canon no longer says deterministic Memory is "not started"',
     'the row moved to V1 — Shipped');
  ck(/\|\s*V1 — Memory\s*\|[^|]*\|\s*Shipped/.test(versions),
     'F1b and says what actually shipped', 'meaningful moments, across sessions and devices, retrieved');

  // F2 — AND IT DISTINGUISHES THE TWO. A blanket "Memory: shipped" would
  // be the opposite error: it would read as permission for a model to
  // propose one, which nothing in this product may do yet.
  ck(/Later — Memory Interpretation/.test(versions)
     && /Not started/.test(versions.split('Later — Memory Interpretation')[1].split('|')[2] || ''),
     'F2  deterministic memory and INTERPRETED memory are separate rows',
     'one shipped, one not started');
  ['semantic extraction', 'conversational memory proposals', 'Bond Moment interpretation']
    .forEach((needle, i) => ck(versions.indexOf(needle) !== -1,
      'F2.' + (i + 1) + '  future scope names "' + needle + '"'));
  ck(!/internet search, and creator memory/.test(versions)
     && /internet search/.test(versions),
     'F2b "creator memory" is no longer listed as never a responsibility',
     'the rest of that sentence is untouched');

  // F3 — SURGICAL, NOT A REWRITE. Every other row of the table must be
  // exactly the string it was before this sprint.
  ['| V1 — Presence | Story Egg, Lumo, Story Companions, Creator Ceremony, the Magic Card bond | Shipped (Canon V2 above) |',
   '| V1 — Guide | Platform guidance: where things are, what controls do, why something is locked, what to do next | **Next** (Canon 5) |',
   '| Later — Voice | Warmer, per-companion phrasing of answers the platform already computes | Not started |',
   '| Later — Curiosity | Educational and world questions; requires an external model | Not started |',
   '| Later — Story Journey | Replay of how a story was made | **Out of scope. Do not implement.** |']
    .forEach((row, i) => ck(versions.indexOf(row) !== -1,
      'F3.' + (i + 1) + '  every unrelated row is byte-identical',
      row.split('|')[1].trim()));

  // F4 — DECISION 32, and the numbering it follows.
  const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  ck(/### 32\. /.test(claude), 'F4  CLAUDE.md carries Decision 32');
  ck(/### 31\. /.test(claude) && /### 30\. /.test(claude),
     'F4b and no earlier decision was renumbered');
  // Searched against whitespace-normalised prose, because CLAUDE.md is
  // hard-wrapped and a needle that happens to straddle a line break
  // would otherwise report a sentence as missing when it is right
  // there. Two of these did exactly that on the first run.
  const flat = claude.replace(/\s+/g, ' ');
  ['does not currently control runtime behaviour',
   'Runtime personality wiring is deferred to Companion Mind',
   'the intended consumer of the descriptive specification',
   'matched as a SUBSTRING against platform copy',
   'what remains not started is **Memory Interpretation**']
    .forEach((needle, i) => ck(flat.indexOf(needle) !== -1,
      'F4.' + (i + 1) + '  Decision 32 records "' + needle.slice(0, 44) + '"'));

  // F5 — THE FOUR KEYS, IN EVERY PERSONALITY ON DISK.
  //
  // The intent has not changed and is still two different failures:
  // a DESCRIPTIVE specification must not be populated with runtime
  // keys, and a file that already drives the Studio must not lose the
  // keys it has.
  //
  // WHAT CHANGED, AND WHY. This used to say "leafy has none, everything
  // else has some", which was true only while Leafy was the one
  // descriptive file and Lumo the one runtime file. The Companion
  // Character Identity sprint authored specifications for Leo, Quill
  // and Nimbus, all descriptive — so the else-branch would have failed
  // three files for being exactly what they are meant to be. That was
  // an implementation detail standing in for the rule, so the rule is
  // written down instead: a file that declares
  // `runtimeKeysDeliberatelyAbsent` is a specification and must carry
  // none of the four; any other personality file is a runtime one and
  // must not have been emptied.
  const RUNTIME_KEYS = ['greetings', 'neverSays', 'play', 'lines'];
  const personalities = fs.readdirSync(path.join(ROOT, 'assets'))
    .map((d) => [d, path.join(ROOT, 'assets', d, 'personality.json')])
    .filter(([, f]) => fs.existsSync(f));
  ck(personalities.length >= 2, 'F5  every personality on disk is checked',
     personalities.map(([d]) => d).join(', '));
  personalities.forEach(([id, file]) => {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    const has = RUNTIME_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(j, k));
    const descriptive = !!j.runtimeKeysDeliberatelyAbsent;
    if (descriptive) {
      ck(has.length === 0, 'F5.' + id + '  ' + id + ' stays descriptive',
         has.length ? 'populated: ' + has.join(', ') : 'no runtime key');
    } else {
      ck(has.length > 0, 'F5.' + id + '  ' + id + '\'s existing runtime keys were NOT removed',
         has.join(', '));
    }
  });
  // And the one that keeps the branch above honest: Leafy is named
  // explicitly, so no future edit can quietly move her to the other side
  // by deleting one key.
  const leafySpec = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'assets', 'leafy', 'personality.json'), 'utf8'));
  ck(!!leafySpec.runtimeKeysDeliberatelyAbsent &&
     RUNTIME_KEYS.every((k) => !Object.prototype.hasOwnProperty.call(leafySpec, k)),
     'F5b Leafy is still on the descriptive side by name, not by accident');

  // F6 — THE CONSUMERS STILL CONSUME EXACTLY WHAT THEY DID.
  //
  // The first draft of this check ran `git diff HEAD` over the three
  // files, which is true only until the sprint is committed — after
  // that it compares the tree with itself and passes whatever the
  // commit contained. "Unchanged since a particular commit" is not a
  // property a suite can hold forever, so what is checked instead is
  // the property that actually matters and stays checkable: the exact
  // consumption sites are still there, still reading those four keys,
  // and still falling back the way they always did.
  const engineSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionEngine.js'), 'utf8');
  const brainSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionBrain.js'), 'utf8');
  const dirSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8');
  const SITES = [
    [engineSrc, "this._fetchOptionalJSON(base+'personality.json')", 'the engine still loads it, best-effort'],
    [dirSrc, 'if(p && Array.isArray(p.greetings) && p.greetings.length){', 'greetings still guard-and-fall-back'],
    [dirSrc, 'return MESSAGES.open;', 'and the fallback line is still there'],
    [brainSrc, 'if(Array.isArray(personality.neverSays)) _never=personality.neverSays.slice();', 'neverSays unchanged'],
    [brainSrc, "if(personality.play && typeof personality.play==='object'){", 'play unchanged'],
    [brainSrc, "if(personality.lines && typeof personality.lines==='object'){", 'lines unchanged'],
    [brainSrc, 'if(!personality) return;', 'and a personality-less package still short-circuits'],
  ];
  SITES.forEach(([src, needle, why], i) => ck(src.indexOf(needle) !== -1,
    'F6.' + (i + 1) + '  ' + why, needle.slice(0, 46)));

  // F7 — NO PROVIDER ANYWHERE THIS SPRINT TOUCHED.
  const touchedFiles = [path.join(ROOT, 'assets', 'leafy', 'personality.json'),
                        path.join(ROOT, 'docs', 'COMPANION_CANON.md'),
                        CANON_FILE];
  const PROVIDERS = ['openai', 'gpt-', 'anthropic', 'claude-', 'api key', 'api_key', 'bearer'];
  const found = [];
  touchedFiles.forEach((f) => {
    const t = fs.readFileSync(f, 'utf8').toLowerCase();
    PROVIDERS.forEach((w) => { if (t.indexOf(w) !== -1) found.push(path.basename(f) + ':' + w); });
  });
  ck(found.length === 0, 'F7  no provider reference was introduced',
     found.length ? found.join(', ') : PROVIDERS.length + ' terms across 3 files');
}

// ===================================================================
// E. THE RUNNING STUDIO — the claim that matters most, measured.
//
// B8 proves the four acted-on keys are absent by reading the file. This
// proves the CONSEQUENCE in the real Studio: Leafy had no personality
// file at all before this sprint, and now has one, so the honest
// question is not "is the file safe" but "does Leafy behave the same".
// The real CompanionEngine loads the real file, and the real Brain and
// the real Director are asked the same questions with it and without it.
// ===================================================================
async function runtimeSection() {
  console.log('\nE. THE RUNNING STUDIO  (Leafy behaves exactly as before)');
  let chromium;
  try { chromium = require('playwright').chromium; }
  catch (e) { sk('E1-E5  the runtime section', 'playwright unavailable'); return; }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    });
  } catch (e) { sk('E1-E5  the runtime section', 'no browser'); return; }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/studio.html?author=on');
    await page.waitForFunction(() =>
      typeof CompanionEngine !== 'undefined' && typeof CompanionBrain !== 'undefined',
      null, { timeout: 20000 });
    await page.evaluate(() => { const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none'; });

    const r = await page.evaluate(async () => {
      // The REAL package loader, on the real files.
      // The same base the Director itself constructs with — a bare
      // CompanionEngine defaults to a path this project does not use,
      // so an engine built without it would 404 and prove nothing.
      const engine = new CompanionEngine({ assetsBase: 'assets/' });
      await engine.load('leafy');
      const p = engine.getPersonality();

      // Every line the Brain would offer for a gate, with and without
      // Leafy's file. Drawn many times because the pools are random.
      const pool = (gate) => {
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
          CompanionBrain._reset({ aged: true });
          const intent = CompanionBrain.play(gate) || {};
          if (intent.say) seen.add(intent.say);
        }
        return Array.from(seen).sort();
      };
      const GATES = ['tickle', 'poke', 'carry'];
      CompanionBrain.usePolicy(null);
      const without = GATES.map(pool);
      CompanionBrain.usePolicy(p);
      const with_ = GATES.map(pool);
      CompanionBrain.usePolicy(null);

      return {
        loaded: !!p,
        name: p && p.name,
        greetingKeyPresent: !!(p && Array.isArray(p.greetings) && p.greetings.length),
        neverSaysPresent: !!(p && Array.isArray(p.neverSays)),
        playPresent: !!(p && p.play),
        linesPresent: !!(p && p.lines),
        same: JSON.stringify(without) === JSON.stringify(with_),
        poolSize: without.reduce((n, a) => n + a.length, 0),
        gates: GATES.length,
      };
    });

    ck(r.loaded && r.name === 'Leafy',
       'E1  the real engine loads the real file', 'so this is not a check on an absent file');
    ck(!r.greetingKeyPresent,
       'E2  the Director still falls back to its own greeting',
       'pickGreeting() reads p.greetings — there is none, so Leafy greets as before');
    ck(!r.neverSaysPresent && !r.playPresent && !r.linesPresent,
       'E3  the Brain finds no voice policy to apply',
       'usePolicy() with this file does exactly what usePolicy(null) does');
    // THE POOL MUST NOT BE EMPTY, and that guard is the point rather
    // than a nicety: the first version of this check read intent.text
    // where the Brain writes intent.say, so it compared two empty sets
    // and passed. A check that can be satisfied by finding nothing is
    // not a check. It now fails on an empty pool before it compares.
    ck(r.poolSize > 0 && r.same,
       'E4  EVERY LINE LEAFY CAN SAY IS THE LINE LEAFY COULD SAY BEFORE',
       r.poolSize === 0 ? 'THE POOL WAS EMPTY — this proved nothing'
         : r.poolSize + ' lines across ' + r.gates + ' gates, identical with and without the file');
    ck(errors.length === 0, 'E5  zero page errors', errors.slice(0, 1).join('') || 'clean');
  } catch (e) {
    no('E1-E5  the runtime section', String(e.message).split('\n')[0]);
  } finally {
    await browser.close();
  }
}

// ===================================================================
console.log('\nD. NOTHING ELSE MOVED');
// ===================================================================
if (process.env.CANON_SKIP_SUITES) {
  sk('D1-D3  the neighbouring suites', 'CANON_SKIP_SUITES set');
} else {
  [['D1  the Companion suite still passes', 'companion-test/run-companion-tests.js', 'COMPANION_PORT'],
   ['D2  the memory suite still passes', 'companion-memory-test/run-companion-memory-tests.js', 'CM_PORT'],
   ['D3  the Garden suite still passes', 'garden-test/run-garden-tests.js', 'GARDEN_PORT']]
    .forEach(([name, rel, portVar]) => {
      const file = path.join(ROOT, 'tools', rel);
      if (!fs.existsSync(file)) { sk(name, 'suite not present'); return; }
      const r = cp.spawnSync(process.execPath, [file], {
        cwd: ROOT, encoding: 'utf8',
        env: { ...process.env, [portVar]: String(PORT), CM_SKIP_SUITES: '1' },
      });
      const tail = (r.stdout || '').trim().split('\n').slice(-1)[0] || (r.stderr || '').split('\n')[0];
      ck(r.status === 0, name, tail);
    });
}

runtimeSection().then(() => {
  console.log('\n' + (failed ? 'FAILED' : (skipped ? 'PASSED (incomplete)' : 'PASSED')) +
    ' — ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
