#!/usr/bin/env node
/* tools/ether-mystery-lab-test/real-closure.js — THE REAL-MODEL PASS for
 * the closure experiment (Ether grammar V2): for every creature of the
 * test set, IMAGE UNDERSTANDING (already real, committed by
 * real-understanding.js) → ETHER TRANSLATION PLAN (already real,
 * committed by real-translation.js — the plan contract is unchanged, so
 * those plans are reused rather than re-bought) → OPEN VOCABULARY
 * DECISION (asked of the real model HERE, with the picture) → BASE and
 * EXTENDED composition at the automatic budget and at 8 (what the Ether
 * performs) → the unfinished creature and its hint → written down, so
 * render-closure.js can draw it and a person can rate it.
 *
 * LABELS. Every result says where each stage came from: REAL MODEL, or
 * CONSTRUCTED (written by hand because no picture exists for it — the
 * octopus: the repository holds no openly-licensed octopus and none may
 * be fetched, so its understanding and plan are constructed and its
 * vocabulary decision is asked of the real model text-only). The golden
 * baby dragon of the brief is not in the repository; lumo — the
 * product's own dragon — stands in, and says so.
 *
 * Network as in real-translation.js: curl through the agent proxy, which
 * injects the key. Never runs inside the suite.
 *
 *   node tools/ether-mystery-lab-test/real-closure.js            the test set
 *   node tools/ether-mystery-lab-test/real-closure.js lumo       a subset
 *   node tools/ether-mystery-lab-test/real-closure.js --recompose   no model call: recompose the saved decisions
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'closure');
fs.mkdirSync(OUT, { recursive: true });

const Vocab = require(path.join(LAB, 'labVocabulary.js'));
const Translate = require(path.join(LAB, 'labTranslate.js'));
const Composer = require(path.join(LAB, 'labEtherComposer.js'));
const Unfinished = require(path.join(LAB, 'labUnfinished.js'));
const Art = require(path.join(LAB, 'labArtworkData.js'));
const understood = JSON.parse(fs.readFileSync(path.join(__dirname, 'shots', 'imagine', 'real-understanding.json'), 'utf8'));
const translated = JSON.parse(fs.readFileSync(path.join(__dirname, 'shots', 'translate', 'real-translation.json'), 'utf8'));

const MODEL = process.env.LAB_MODEL || 'gpt-4.1-mini';
const KEY = process.env.OPENAI_API_KEY || 'placeholder-the-proxy-injects-the-key';

// THE TEST SET (§7 / §20): a baby dragon (stand-in), a mermaid, a falcon,
// a lion with wings, a centaur, an elephant, an octopus, an invented
// creature — plus a second dragon, because the golden one is absent.
const SET = [
  { id: 'lumo', stands: 'baby dragon (STAND-IN: the product\'s own dragon, Lumo — the brief\'s uploaded baby dragon is not in the repository)' },
  { id: 'openmoji-dragon', stands: 'dragon (second)' },
  { id: 'twemoji-mermaid', stands: 'mermaid' },
  { id: 'gameicons-falcon', stands: 'falcon' },
  { id: 'leo', stands: 'lion with wings' },
  { id: 'gameicons-centaur', stands: 'centaur' },
  { id: 'openmoji-elephant', stands: 'elephant' },
  { id: 'octopus', stands: 'octopus (CONSTRUCTED — no picture in the repository)', constructed: true },
  { id: 'quill', stands: 'invented creature (an ink spirit)' }
];

// THE CONSTRUCTED OCTOPUS. Written by hand, labelled so on every line: an
// understanding in the analysis contract's own shape and a plan in the
// plan contract's own shape, run through the REAL validators.
const OCTOPUS = {
  analysis: {
    subject: 'octopus', character: ['curious', 'soft', 'flowing', 'gentle'],
    composition: 'A rounded mantle at the top with large eyes, and eight arms flowing downward and outward from beneath it, each curling at the tip.',
    architecture: ['a rounded mantle (head-body) at the top', 'two large eyes low on the mantle', 'eight arms leaving the underside of the mantle', 'each arm tapering and curling at its tip', 'suckers along the underside of the arms'],
    diagnosticFeatures: ['rounded mantle', 'eight curling arms', 'large eyes', 'suckers'],
    modifiers: ['soft', 'boneless', 'flowing'], proportion: 'The mantle is about a third of the height; the arms are the rest and spread wider than the mantle.',
    gesture: 'One coherent gesture: a soft dome with arms flowing down and out like a fountain.',
    abstraction: { survives: ['rounded mantle', 'many curling arms'], doNotDrawLiterally: ['suckers', 'texture'], note: 'constructed by hand — no picture' },
    revealCandidates: ['eyes', 'suckers'], promptFidelity: { agreement: 'matches', differences: [] }
  },
  plan: {
    masses: [
      { id: 'mantle', label: 'MANTLE', role: 'primary', kind: 'mass', size: 'dominant', shape: 'round' },
      { id: 'underside', label: 'UNDERSIDE', role: 'primary', kind: 'mass', size: 'medium', shape: 'wide' },
      { id: 'arms-front', label: 'FRONT ARMS', role: 'diagnostic', kind: 'taper', size: 'large', shape: 'long' },
      { id: 'arms-side', label: 'SIDE ARMS', role: 'diagnostic', kind: 'taper', size: 'large', shape: 'long' },
      { id: 'arms-back', label: 'BACK ARMS', role: 'secondary', kind: 'taper', size: 'medium', shape: 'long' },
      { id: 'eyes', label: 'EYES', role: 'diagnostic', kind: 'terminal', size: 'small', shape: 'round' }
    ],
    gesture: { kind: 'floating', flow: ['underside', 'mantle'], curve: 'gentle', facing: 'front', note: 'A soft dome with arms flowing down and out beneath it.' },
    relationships: [
      { from: 'arms-front', relation: 'hangs-from', to: 'underside', side: 'bottom', symmetric: true },
      { from: 'arms-side', relation: 'hangs-from', to: 'underside', side: 'both', symmetric: true },
      { from: 'arms-back', relation: 'hangs-from', to: 'underside', side: 'back', symmetric: true },
      { from: 'eyes', relation: 'attaches-to', to: 'mantle', side: 'front', symmetric: true }
    ],
    proportion: [{ mass: 'mantle', treat: 'dominant' }, { mass: 'arms-side', treat: 'elongated' }],
    mustSurvive: ['mantle', 'arms-front', 'arms-side'], simplify: ['suckers', 'texture'], revealOnly: ['eyes', 'suckers'],
    complexity: 'moderate', movement: 'It drifts, arms trailing and curling, pulsing gently as it goes.'
  }
};

function curlJson(url, body) {
  const tmp = path.join(OUT, '.req.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  const r = spawnSync('curl', ['-sS', '--max-time', '180', url, '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer ' + KEY, '-d', '@' + tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { fs.unlinkSync(tmp); } catch (e) { /* held */ }
  if (r.status !== 0) return { ok: false, reason: 'curl-failed', detail: (r.stderr || '').split('\n')[0] };
  try { return { ok: true, body: JSON.parse(r.stdout) }; } catch (e) { return { ok: false, reason: 'not-json', detail: r.stdout.slice(0, 200) }; }
}
function mimeFor(file) { return /\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png'; }

function composeAll(plan, decision) {
  const ext = Vocab.resolve(decision, 'extended');
  const caps = Object.keys(ext.caps).length ? ext.caps : null;
  function one(o) {
    const fig = Composer.compose(plan, o);
    if (!fig.ok) return { ok: false, reason: fig.reason };
    const u = Unfinished.derive({ points: fig.points, joins: fig.joins, masses: fig.masses }, plan);
    return { ok: true, points: fig.points, roles: fig.roles, joins: fig.joins, masses: fig.masses, budget: fig.budget, diagnostics: fig.diagnostics, unfinished: u.ok ? { missing: u.missing, gaps: u.gaps, remaining: u.remaining } : { failed: u.reason } };
  }
  return {
    resolved: ext,
    base: one({}), extended: one(caps ? { caps } : {}),
    base8: one({ cap: 8 }), extended8: one(caps ? { caps, cap: 8 } : { cap: 8 })
  };
}

function decideOne(entry) {
  const out = { id: entry.id, stands: entry.stands, model: MODEL, labels: {} };
  let analysis, plan, file = null, planMeta;
  if (entry.constructed) {
    analysis = OCTOPUS.analysis; plan = OCTOPUS.plan;
    const pv = Translate.validatePlan(JSON.parse(JSON.stringify(plan)));
    if (!pv.ok) return Object.assign(out, { ok: false, reason: 'constructed-plan-invalid', reasons: pv.reasons });
    plan = pv.plan;
    out.labels.understanding = 'CONSTRUCTED'; out.labels.plan = 'CONSTRUCTED (validated by the real plan validator' + (pv.repairs.length ? ', tidied: ' + pv.repairs.join('; ') : '') + ')';
    out.visible = 'no picture — constructed';
  } else {
    const art = Art.entries.filter((e) => e.id === entry.id)[0];
    const u = understood.results.filter((r) => r.id === entry.id && r.ok)[0];
    const t = translated.results.filter((r) => r.id === entry.id && r.ok)[0];
    if (!art || !u || !t) return Object.assign(out, { ok: false, reason: 'no-real-understanding-or-plan' });
    analysis = u.analysis; plan = t.plan; file = path.resolve(LAB, art.file); planMeta = { model: t.model, repairs: t.validator.repairs };
    out.title = art.title; out.file = art.file; out.visible = art.visible; out.prompt = u.prompt;
    out.labels.understanding = 'REAL MODEL (' + u.model + ', committed by real-understanding.js)';
    out.labels.plan = 'REAL MODEL (' + t.model + ', committed by real-translation.js)';
  }
  out.analysis = analysis; out.plan = plan;
  const m = Vocab.decisionMessages(analysis, plan);
  let messages = m.messages;
  if (file) {
    const b64 = fs.readFileSync(file).toString('base64');
    messages = m.messages.map((msg, i) => i !== m.messages.length - 1 ? msg : { role: 'user', content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: 'data:' + mimeFor(file) + ';base64,' + b64, detail: 'high' } }] });
  }
  const t0 = Date.now();
  const r = curlJson('https://api.openai.com/v1/chat/completions', { model: MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 1800 });
  out.ms = Date.now() - t0;
  if (!r.ok) return Object.assign(out, { ok: false, reason: r.reason, detail: r.detail });
  if (r.body.error) return Object.assign(out, { ok: false, reason: String(r.body.error.code || r.body.error.type || 'error') });
  const text = r.body.choices && r.body.choices[0] && r.body.choices[0].message && r.body.choices[0].message.content;
  out.usage = r.body.usage ? { prompt: r.body.usage.prompt_tokens, completion: r.body.usage.completion_tokens } : null;
  out.raw = text || '';
  const v = Vocab.parseDecision(text || '', plan, analysis.subject);
  out.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
  out.labels.decision = 'REAL MODEL (' + MODEL + (file ? ', with the picture' : ', text only — no picture exists') + ')';
  if (!v.ok) return Object.assign(out, { ok: false, reason: 'invalid-decision' });
  out.decision = v.decision;
  out.hint = v.decision.hint || null;
  out.compositions = composeAll(plan, v.decision);
  out.ok = !!(out.compositions.base.ok && out.compositions.extended.ok);
  return out;
}

function recompose() {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'real-closure.json'), 'utf8'));
  prev.results.forEach((r) => {
    if (!r.raw) return;
    // the committed RAW reply is re-read through the validator as it
    // stands now, so a contract repair reaches the record without a
    // second request
    const v = Vocab.parseDecision(r.raw, r.plan, r.analysis.subject);
    r.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
    if (!v.ok) { r.ok = false; r.reason = 'invalid-decision'; return; }
    r.decision = v.decision; r.hint = v.decision.hint || null;
    r.compositions = composeAll(r.plan, r.decision);
    r.ok = !!(r.compositions.base.ok && r.compositions.extended.ok);
    const b = r.compositions.base, e = r.compositions.extended;
    console.log('recomposed ' + r.id + ' · base ' + b.points.length + 'L/' + b.joins.length + 'J/' + b.diagnostics.crossings + 'x · ext ' + e.points.length + 'L/' + e.joins.length + 'J/' + e.diagnostics.crossings + 'x [' + e.diagnostics.vocabulary.capabilities.join(',') + ']');
  });
  prev.recomposed = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'real-closure.json'), JSON.stringify(prev, null, 1));
}

(function main() {
  if (process.argv[2] === '--recompose') return recompose();
  const only = process.argv.slice(2);
  const entries = SET.filter((e) => !only.length || only.indexOf(e.id) !== -1);
  const results = [];
  entries.forEach((e) => {
    process.stdout.write('deciding ' + e.id + ' … ');
    const r = decideOne(e);
    if (r.ok) {
      const d = r.decision, c = r.compositions;
      console.log(d.decision + ' · ' + d.extensions.length + ' ext (' + d.extensions.filter((x) => x.compiler.ok).length + ' expressible) · bound ' + d.apply.length + ' · reveals ' + d.revealCandidates.length + ' (' + d.revealCandidates.filter((x) => x.support === 'SUPPORTED_REVEAL').length + ' supported) · hint ' + (r.hint ? '“' + r.hint + '”' : 'none') +
        ' → base ' + c.base.points.length + 'L/' + c.base.diagnostics.crossings + 'x · ext ' + c.extended.points.length + 'L/' + c.extended.diagnostics.crossings + 'x [' + c.extended.diagnostics.vocabulary.capabilities.join(',') + '] · @8 gaps ' + (c.extended8.unfinished.missing ? c.extended8.unfinished.missing.length : 'none') + (r.validator.repairs.length ? ' · tidied ' + r.validator.repairs.length : ''));
    } else console.log('FAILED ' + r.reason + (r.validator ? ' ' + r.validator.reasons.join(',') : '') + (r.detail ? ' ' + r.detail : ''));
    results.push(r);
  });
  const report = { run: new Date().toISOString(), model: MODEL, note: 'Every stage is labelled REAL MODEL or CONSTRUCTED per result (labels). The plans are the committed real ones; the vocabulary decision is bought here.', results };
  fs.writeFileSync(path.join(OUT, 'real-closure.json'), JSON.stringify(report, null, 1));
  console.log('\nwrote ' + path.join(OUT, 'real-closure.json') + ' · ' + results.filter((r) => r.ok).length + '/' + results.length + ' decided and composed');
})();
