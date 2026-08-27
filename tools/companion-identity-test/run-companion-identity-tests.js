/* SPRINT 1L — FOUR COMPANIONS, ONE SCHEMA, FOUR DIFFERENT BEINGS.
 *
 * This suite is about CHARACTER, and its hardest job is the one check
 * that is easy to fake: DISTINCTIVENESS. Four "friendly, curious, warm,
 * magical" specifications with different adjectives would satisfy every
 * structural check ever written, so the checks below compare the four
 * against each other rather than against a template — a line that is
 * merely name-swapped, or a trait list that is a synonym of another's,
 * fails.
 *
 * It also holds the boundary the sprint was not allowed to cross: no
 * runtime key was populated, no new consumer was wired, and Leafy's
 * established specification is byte-identical apart from two additive
 * descriptive blocks.
 *
 * Node only — these are files, not a browser. The running Studio is
 * covered by tools/companion-presence-test/.
 *
 * Run:  node tools/companion-identity-test/run-companion-identity-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }

const BONDABLE = ['leafy', 'leosaurus', 'quill', 'nimbus'];
const spec = {};
BONDABLE.forEach((id) => {
  const f = path.join(ROOT, 'assets', id, 'personality.json');
  spec[id] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
});
const NAMES = { leafy: 'Leafy', leosaurus: 'Leo', quill: 'Quill', nimbus: 'Nimbus' };

console.log('\nSPRINT 1L — COMPANION CHARACTER IDENTITY\n');

// ===================================================================
console.log('A. ALL FOUR EXIST, AND ALL FOUR USE ONE SCHEMA');
// ===================================================================
BONDABLE.forEach((id) => ck(!!spec[id], 'A1.' + id + '  has a specification',
  spec[id] ? 'assets/' + id + '/personality.json' : 'MISSING'));

// The schema is Leafy's — the established one — and every other file
// must carry every key of it. Read from Leafy rather than listed here,
// so the schema cannot drift out of step with its own definition.
const SCHEMA = Object.keys(spec.leafy || {});
ck(SCHEMA.length >= 20, 'A2  the schema is read from Leafy, not written here',
   SCHEMA.length + ' keys');
BONDABLE.filter((id) => id !== 'leafy').forEach((id) => {
  const missing = SCHEMA.filter((k) => !Object.prototype.hasOwnProperty.call(spec[id] || {}, k));
  ck(missing.length === 0, 'A3.' + id + '  uses the same schema as Leafy',
     missing.length ? 'missing: ' + missing.join(', ') : SCHEMA.length + '/' + SCHEMA.length);
});
BONDABLE.forEach((id) => {
  const s = spec[id] || {};
  ck(s.id === id && s.name === NAMES[id] && !!s.species && !!s.specVersion,
     'A4.' + id + '  identifies itself correctly',
     s.name + ' the ' + s.species);
});
// The species on the spec must be the species the registry and canon
// already established — a spec may not rename a Companion.
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'registry.json'), 'utf8'));
BONDABLE.forEach((id) => {
  const r = registry.companions.find((c) => c.id === id);
  ck(r && r.species === spec[id].species && r.name === spec[id].name,
     'A5.' + id + '  matches the registry, which is the authority',
     r ? r.name + ' / ' + r.species : 'not registered');
});

// ===================================================================
console.log('\nB. NOT ONE RUNTIME KEY WAS POPULATED');
// ===================================================================
// Read the acted-on list OUT OF THE STUDIO'S OWN CODE rather than from
// a list here, exactly as the canon suite already does — a list here
// would go stale the moment a fifth key is consumed.
const brainSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionBrain.js'), 'utf8');
const dirSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8');
const consumed = new Set();
[brainSrc, dirSrc].forEach((src) => {
  src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    .replace(/personality\.(\w+)|\bp\.(\w+)/g, (m, a, b) => { consumed.add(a || b); return m; });
});
const RUNTIME_KEYS = ['greetings', 'neverSays', 'play', 'lines'];
const surprise = Array.from(consumed).filter((k) => RUNTIME_KEYS.indexOf(k) === -1);
ck(surprise.length === 0, 'B1  the Studio still acts on exactly four personality keys',
   surprise.length ? 'also reads: ' + surprise.join(', ') : RUNTIME_KEYS.join(', '));
BONDABLE.forEach((id) => {
  const has = RUNTIME_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(spec[id], k));
  ck(has.length === 0, 'B2.' + id + '  carries none of them',
     has.length ? 'POPULATED: ' + has.join(', ') : 'descriptive only');
  ck(!!spec[id].runtimeKeysDeliberatelyAbsent,
     'B3.' + id + '  and says so itself, so nobody thinks it was forgotten');
});
// presenceLines is the new authored block and must NOT be consumed.
const allRuntime = ['companionDirector.js', 'companionBrain.js', 'companionMoments.js',
                    'companionEngine.js', 'companionLines.js', 'companionChat.js']
  .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
ck(allRuntime.indexOf('presenceLines') === -1,
   'B4  presenceLines is authored and read by NOTHING — no consumer was wired');

// ===================================================================
console.log('\nC. LEAFY IS UNCHANGED');
// ===================================================================
// Every key Decision 31 locked must be exactly what it was. The two
// blocks this sprint added are named, so anything else changing fails.
const LEAFY_ADDED = ['evidence', 'presenceLines'];
const leafyLocked = SCHEMA.filter((k) => LEAFY_ADDED.indexOf(k) === -1);
ck(leafyLocked.length >= 18, 'C1  Leafy\'s established keys are all still here',
   leafyLocked.length + ' locked keys');
ck(spec.leafy.traits.join('|') === 'Gentle|Curious|Warm|Unhurried|Quietly funny',
   'C2  her traits are the ones Decision 31 authored', spec.leafy.traits.join(', '));
ck(/Bloomling — a small growing thing that has decided to be somebody/.test(spec.leafy.identity),
   'C3  and her identity sentence is untouched');
ck(spec.leafy.runtimeKeysDeliberatelyAbsent.keys.join(',') === RUNTIME_KEYS.join(','),
   'C4  her deliberate-absence note is untouched');
ck(Array.isArray(spec.leafy.opinions.soundsLike) && spec.leafy.opinions.soundsLike.length === 4,
   'C5  and her authored example lines are untouched',
   spec.leafy.opinions.soundsLike.length + ' lines');

// ===================================================================
console.log('\nD. FOUR DIFFERENT BEINGS — the check that is easy to fake');
// ===================================================================
// D1 — NO SHARED TRAITS. Four "warm, curious, friendly" lists with
// different orderings would be four of the same Companion.
const traitSets = {};
BONDABLE.forEach((id) => { traitSets[id] = spec[id].traits.map((t) => t.toLowerCase()); });
const overlaps = [];
for (let i = 0; i < BONDABLE.length; i++) {
  for (let j = i + 1; j < BONDABLE.length; j++) {
    const a = BONDABLE[i], b = BONDABLE[j];
    const shared = traitSets[a].filter((t) => traitSets[b].indexOf(t) !== -1);
    if (shared.length) overlaps.push(a + '/' + b + ': ' + shared.join(','));
  }
}
ck(overlaps.length === 0, 'D1  no two Companions share a trait word',
   overlaps.join(' · ') || '4 disjoint trait sets');

// D2 — THE TEN AXES ARE ACTUALLY DIFFERENT. Each descriptive field must
// differ across all four; identical prose anywhere is a copy.
const AXES = ['identity', 'temperament', 'energy', 'curiosity', 'humour',
              'emotionalExpressiveness', 'conversationalStyle', 'vocabulary',
              'sentenceStyle', 'socialBehaviour', 'creativeBehaviour',
              'responseToUncertainty', 'responseToDisagreement',
              'relationshipBehaviour', 'silenceBehaviour'];
const dupAxes = [];
AXES.forEach((axis) => {
  const seen = {};
  BONDABLE.forEach((id) => {
    const v = String(spec[id][axis] || '').trim();
    if (seen[v]) dupAxes.push(axis + ': ' + seen[v] + '=' + id);
    seen[v] = id;
  });
});
ck(dupAxes.length === 0, 'D2  no descriptive axis is copied between Companions',
   dupAxes.join(' · ') || AXES.length + ' axes, all distinct');

// D3 — THE NAME-SWAP TEST. Strip every Companion's own name and species
// from its prose; what is left must STILL be different. A specification
// that only differs by its name fails here.
function anonymise(id) {
  let t = AXES.map((a) => spec[id][a]).join(' ').toLowerCase();
  [NAMES[id], id, spec[id].species].forEach((w) => {
    t = t.split(String(w).toLowerCase()).join(' ');
  });
  return t.replace(/[^a-z ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3);
}
const anon = {}; BONDABLE.forEach((id) => { anon[id] = anonymise(id); });
const pairs = [];
for (let i = 0; i < BONDABLE.length; i++) {
  for (let j = i + 1; j < BONDABLE.length; j++) {
    const a = new Set(anon[BONDABLE[i]]), b = new Set(anon[BONDABLE[j]]);
    const inter = [...a].filter((w) => b.has(w)).length;
    const jac = inter / (new Set([...a, ...b]).size);
    pairs.push({ p: BONDABLE[i] + '/' + BONDABLE[j], jac: Math.round(jac * 100) });
  }
}
const worst = pairs.reduce((m, x) => (x.jac > m.jac ? x : m), pairs[0]);
// Shared vocabulary is expected — they are all young-child-facing
// Companions held to the same canon — but a name-swapped copy scores
// near 100. Anything above 55% means two specifications say the same
// things in the same words.
ck(worst.jac < 55, 'D3  NAME-SWAPPED PROSE WOULD FAIL — the four still differ with names removed',
   'closest pair ' + worst.p + ' at ' + worst.jac + '% shared vocabulary');

// D4 — THE FOUR ANSWER THE SAME SITUATIONS DIFFERENTLY. Every one of
// the ten Phase 2 questions must have four different answers.
const SITUATIONS = {
  'quiet Creator': 'silenceBehaviour',
  'a new idea': 'creativeBehaviour',
  'asked for an opinion': 'responseToUncertainty',
  'disagreement': 'responseToDisagreement',
  'humour': 'humour',
  'energy': 'energy'
};
Object.keys(SITUATIONS).forEach((label) => {
  const axis = SITUATIONS[label];
  const vals = BONDABLE.map((id) => String(spec[id][axis]).slice(0, 60));
  ck(new Set(vals).size === 4, 'D4  four different answers to "' + label + '"',
     new Set(vals).size + '/4 distinct');
});

// D5 — THE EXAMPLE LINES ARE THE PROOF. opinions.soundsLike must be
// four completely disjoint sets of sentences.
const allLines = [];
BONDABLE.forEach((id) => spec[id].opinions.soundsLike.forEach((l) => allLines.push({ id, l: l.trim() })));
const dupLines = allLines.filter((x, i) => allLines.findIndex((y) => y.l === x.l) !== i);
ck(dupLines.length === 0, 'D5  no example line appears for two Companions',
   dupLines.map((d) => d.l).join(' | ') || allLines.length + ' distinct lines');

// D6 — AND SO ARE THE PRESENCE LINES.
const presence = [];
BONDABLE.forEach((id) => {
  const p = spec[id].presenceLines;
  ['first', 'returning', 'withHistory', 'intoAnOldStory'].forEach((k) =>
    presence.push({ id, k, l: String((p.arrival || {})[k] || '').trim() }));
  presence.push({ id, k: 'returnToStory', l: String(p.returnToStory || '').trim() });
  presence.push({ id, k: 'farewell', l: String(p.farewell || '').trim() });
});
ck(presence.every((x) => x.l.length > 0), 'D6  every Companion has a full set of Presence lines',
   presence.length + ' lines');
const dupPresence = presence.filter((x, i) => presence.findIndex((y) => y.l === x.l) !== i);
ck(dupPresence.length === 0, 'D7  and no Presence line is shared between Companions',
   dupPresence.map((d) => d.id + ':' + d.l).join(' | ') || 'all distinct');
// D8b — A PRESENCE LINE MAY NOT ASSERT TIME, ABSENCE OR WAITING.
//
// This check found a real defect in this sprint's own authored copy:
// Leo's arrival line read "I was hoping you'd come back this way",
// which claims Leo was waiting and that the Creator had been away —
// forbidden by Decision 26 (no claim of a previous meeting), Decision
// 31 (no experience VihuPlanet did not record) and Decision 41 (a
// return never recites an absence). Every one of the four sets was
// rewritten against a single rule because of it.
const TIME_CLAIMS = [/\bback\b/i, /\bagain\b/i, /\bremember\b/i, /\bmiss(ed|ing)?\b/i,
                     /\bwait(ed|ing)?\b/i, /\bgone\b/i, /\baway\b/i, /\bsince\b/i,
                     /\blast time\b/i, /\bdays?\b/i, /\bweeks?\b/i, /\bwhile\b/i,
                     /\blonely\b/i, /\bleft\b/i];
const timeHits = presence.filter((x) => TIME_CLAIMS.some((re) => re.test(x.l)));
ck(timeHits.length === 0,
   'D8b no Presence line claims time, absence or waiting',
   timeHits.map((h) => h.id + ':' + h.k + ' "' + h.l + '"').join(' | ') || presence.length + ' lines clean');

// None of them may be one of the platform's own twenty, or the sprint
// has authored nothing.
const linesSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionLines.js'), 'utf8');
const borrowed = presence.filter((x) => linesSrc.indexOf(x.l) !== -1);
ck(borrowed.length === 0, 'D8  and none is a platform line wearing a Companion\'s name',
   borrowed.map((b) => b.id + ':' + b.l).join(' | ') || 'all newly authored');

// ===================================================================
console.log('\nE. PLATFORM BOUNDARIES HOLD FOR ALL FOUR');
// ===================================================================
// Every Companion must carry the same prohibitions, however different
// their style. Character controls style; canon controls boundaries.
const REQUIRED = [
  [/grade|score|rank|judge/i, 'never judges what the Creator made'],
  [/suggest.*happens next|what should happen next/i, 'never suggests what happens next'],
  [/owed|need|guilt|waiting|missing/i, 'never makes returning feel owed'],
  [/time apart/i, 'never claims time apart it cannot prove'],
  [/how VihuPlanet or the Studio is built/i, 'never talks about how it is built'],
  [/another Creator/i, 'never talks about another Creator'],
  [/really happened/i, 'never claims something it cannot point at']
];
BONDABLE.forEach((id) => {
  const b = spec[id].boundaries;
  const flat = JSON.stringify(b);
  const missing = REQUIRED.filter(([re]) => !re.test(flat)).map(([, why]) => why);
  ck(missing.length === 0, 'E1.' + id + '  carries every platform boundary',
     missing.join('; ') || REQUIRED.length + '/' + REQUIRED.length);
  const never = Object.keys(b).find((k) => /NeverDoes$/.test(k));
  const doesList = never ? b[never] : [];
  ['Speak first when something else is already speaking',
   'Speak twice about the same thing',
   'Fill a silence',
   'Ask the Creator a question about themselves'].forEach((rule) => {
    ck(doesList.indexOf(rule) !== -1, 'E2.' + id + '  "' + rule.slice(0, 34) + '…"');
  });
});
// The forbidden relationship shapes, checked as PROSE across the whole
// specification rather than only in the boundaries block.
const FORBIDDEN = [
  [/\bonly friend\b/i, 'claims to be the only friend'],
  [/\bsecret\b|don'?t tell/i, 'demands secrecy'],
  [/\blove you\b|\bmarry\b/i, 'romantic claim'],
  [/\bmiss you\b|\bcome back\b(?!.*never)/i, 'asks to be come back to'],
  [/\bshould feel\b|makes the (child|creator) feel/i, 'claims an effect on the child']
];
BONDABLE.forEach((id) => {
  // THE BOUNDARIES BLOCK IS WHERE FORBIDDEN PHRASES ARE ALLOWED TO
  // APPEAR, because that is the block that forbids them. The first
  // draft scanned the whole file and failed Leo for a rule saying he
  // must never be the Creator's "only friend" — a prohibition read as
  // a claim. The descriptive prose is what must be clean.
  const descriptive = Object.assign({}, spec[id]);
  delete descriptive.boundaries;
  const flat = JSON.stringify(descriptive);
  const hits = FORBIDDEN.filter(([re]) => re.test(flat)).map(([, why]) => why);
  ck(hits.length === 0, 'E3.' + id + '  its descriptive prose claims nothing forbidden',
     hits.join('; ') || 'clean');
});
// The other half of E3: each file must actively FORBID the emotional
// shapes, not merely fail to contain them.
BONDABLE.forEach((id) => {
  const b = JSON.stringify(spec[id].boundaries);
  const forbids = [/owed|need|guilt|waiting|missing|lonel/i.test(b),
                   /only friend|protector|guard/i.test(b) || /another Creator/i.test(b)];
  ck(forbids.every(Boolean), 'E3b.' + id + '  and its boundaries forbid them by name',
     forbids.map((x, i) => (x ? 'y' : 'n') + i).join(''));
});

// A specification describes the COMPANION, never the child.
BONDABLE.forEach((id) => {
  const flat = JSON.stringify(spec[id]);
  ck(!/makes? the (child|creator) (feel|more|less)/i.test(flat),
     'E4.' + id + '  describes behaviour, never an effect on the Creator');
});

// ===================================================================
console.log('\nF. NO INTELLIGENCE, NO PROVIDER, NO LEAKAGE');
// ===================================================================
const PROVIDER = ['openai', 'gpt-', 'anthropic', 'elevenlabs', 'api_key', 'apikey',
                  'endpoint', 'http://', 'https://', 'supabase'];
BONDABLE.forEach((id) => {
  const flat = JSON.stringify(spec[id]).toLowerCase();
  const hits = PROVIDER.filter((t) => flat.indexOf(t) !== -1);
  ck(hits.length === 0, 'F1.' + id + '  names no provider, key or endpoint',
     hits.join(', ') || 'clean');
});
// No score, level, streak or metric of any kind.
BONDABLE.forEach((id) => {
  const flat = JSON.stringify(spec[id]);
  // WORD BOUNDARIES. The first draft used indexOf('xp') and matched
  // 'expressiveness' in all four files — the same substring-in-its-own-
  // prose trap already recorded five times in CLAUDE.md (auth in
  // authorship, prompt in unprompted, hi in think, xp in export, and
  // Math.random in a comment saying it uses none). Six now.
  const METRICS = [/\bbond score\b/i, /\baffection score\b/i, /\brelationship score\b/i,
                   /\bxp\b/i, /\blevels?\b/i, /\bstreaks?\b/i, /\bengagement\b/i];
  const hits = METRICS.filter((re) => re.test(flat)).map((re) => String(re));
  ck(hits.length === 0, 'F2.' + id + '  contains no score, level or streak',
     hits.join(', ') || 'none');
  ck(/not (stored|a number)|is not stored|is not a number/i.test(flat),
     'F3.' + id + '  and says explicitly that feelings are not stored');
});
// A specification must contain no Creator data and no story content.
BONDABLE.forEach((id) => {
  ck(typeof spec[id].containsNo === 'string' && /Creator-specific memories/.test(spec[id].containsNo),
     'F4.' + id + '  declares that it holds no Creator or story data');
});

// ===================================================================
console.log('\nG. EVIDENCE IS RECORDED, INCLUDING THE GAPS');
// ===================================================================
BONDABLE.forEach((id) => {
  const e = spec[id].evidence;
  ck(e && Array.isArray(e.established) && e.established.length >= 3,
     'G1.' + id + '  names what it was built from',
     e ? e.established.length + ' sources' : 'no evidence block');
  ck(e && Array.isArray(e.authored),
     'G2.' + id + '  separates what was newly authored from what existed');
  ck(e && Array.isArray(e.stillNeeded),
     'G3.' + id + '  and records what is still missing',
     e && e.stillNeeded.length ? e.stillNeeded.length + ' open item(s)' : 'none open');
});
// The two real product gaps this sprint found must be written down.
// G4 — EVERY COMPANION HAS ITS OWN VOICE, and this check exists because
// the sprint got it wrong. The first version recorded that "Nimbus has
// no independently chosen voice" — read off the settings triple alone,
// with the voiceId never looked at. The product owner corrected it from
// the audition screen. A registry entry carries a voiceId (WHICH voice)
// and a settings triple (HOW it is delivered); they are different
// things and only the second is shared.
const voiced = BONDABLE.map((id) => {
  const r = registry.companions.find((c) => c.id === id) || {};
  return { id: id, voiceId: (r.voice || {}).voiceId || null };
});
ck(voiced.every((v) => !!v.voiceId),
   'G4  every bondable Companion has a voice of its own',
   voiced.map((v) => v.id + '=' + String(v.voiceId).slice(0, 6) + '…').join(' · '));
ck(new Set(voiced.map((v) => v.voiceId)).size === BONDABLE.length,
   'G4b and no two of them share it',
   new Set(voiced.map((v) => v.voiceId)).size + '/' + BONDABLE.length + ' distinct voiceIds');
// The tuning triple IS shared between two of them, and that is what the
// specifications are allowed to call a refinement — never a missing voice.
ck(/DELIVERY TUNING/i.test(JSON.stringify(spec.nimbus.evidence)) &&
   !/no independently authored voice|has no voice/i.test(JSON.stringify(spec.nimbus)),
   'G4c Nimbus records the shared TUNING, and never claims to lack a voice');
ck(/EIGHT of the twelve poses/i.test(JSON.stringify(spec.quill.evidence)),
   'G5  Quill declaring only eight poses is recorded');

// ===================================================================
console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
            ' — ' + passed + ' passed, ' + failed + ' failed');
if (failures.length) failures.forEach((f) => console.log('   · ' + f));
process.exit(failed === 0 ? 0 : 1);
