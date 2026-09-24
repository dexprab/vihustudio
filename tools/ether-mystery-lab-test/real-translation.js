#!/usr/bin/env node
/* tools/ether-mystery-lab-test/real-translation.js — THE REAL-MODEL PASS
 * for IMAGE → UNDERSTANDING → ETHER TRANSLATION PLAN → composed figure.
 *
 * SPRINT — Ether creature translation, image → Ether, proof V1.
 *
 * For every picture in the artwork manifest: take the REAL understanding
 * already committed by real-understanding.js (gpt-4.1-mini read it),
 * build the plan request through the SAME contract the Lab uses
 * (LabTranslate.planMessages, the picture attached exactly as
 * LabConnection attaches it), send it to the real model, validate the
 * plan (LabTranslate.parsePlan), compose the figure deterministically
 * (LabEtherComposer.compose), and write everything down — the raw
 * reply, the accepted plan, the repairs, the figure and its
 * diagnostics — so the result can be rendered, looked at, rated and
 * argued with. Nothing here is judged; render-translation.js draws it
 * and a person rates it.
 *
 * Network as in real-understanding.js: curl through the agent proxy,
 * which injects the key. Never runs inside the suite.
 *
 *   node tools/ether-mystery-lab-test/real-translation.js            all pictures
 *   node tools/ether-mystery-lab-test/real-translation.js leo lumo   a subset
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'translate');
fs.mkdirSync(OUT, { recursive: true });

const Translate = require(path.join(LAB, 'labTranslate.js'));
const Composer = require(path.join(LAB, 'labEtherComposer.js'));
const Art = require(path.join(LAB, 'labArtworkData.js'));
const understood = JSON.parse(fs.readFileSync(path.join(__dirname, 'shots', 'imagine', 'real-understanding.json'), 'utf8'));

const MODEL = process.env.LAB_MODEL || 'gpt-4.1-mini';
const KEY = process.env.OPENAI_API_KEY || 'placeholder-the-proxy-injects-the-key';

function curlJson(url, body) {
  const tmp = path.join(OUT, '.req.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  const r = spawnSync('curl', ['-sS', '--max-time', '180', url, '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer ' + KEY, '-d', '@' + tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { fs.unlinkSync(tmp); } catch (e) { /* held */ }
  if (r.status !== 0) return { ok: false, reason: 'curl-failed', detail: (r.stderr || '').split('\n')[0] };
  try { return { ok: true, body: JSON.parse(r.stdout) }; } catch (e) { return { ok: false, reason: 'not-json', detail: r.stdout.slice(0, 200) }; }
}
function mimeFor(file) { return /\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png'; }

function planOne(entry) {
  const u = understood.results.filter((r) => r.id === entry.id && r.ok)[0];
  if (!u) return { id: entry.id, ok: false, reason: 'no-understanding' };
  const m = Translate.planMessages(u.analysis);
  const file = path.resolve(LAB, entry.file);
  const b64 = fs.readFileSync(file).toString('base64');
  const mime = mimeFor(file);
  const messages = m.messages.map((msg, i) => i !== m.messages.length - 1 ? msg : {
    role: 'user',
    content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64, detail: 'high' } }]
  });
  const t0 = Date.now();
  const r = curlJson('https://api.openai.com/v1/chat/completions', { model: MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 1800 });
  const out = { id: entry.id, title: entry.title, file: entry.file, prompt: u.prompt, visible: entry.visible, model: MODEL, ms: Date.now() - t0 };
  if (!r.ok) return Object.assign(out, { ok: false, reason: r.reason, detail: r.detail });
  if (r.body.error) return Object.assign(out, { ok: false, reason: String(r.body.error.code || r.body.error.type || 'error') });
  const text = r.body.choices && r.body.choices[0] && r.body.choices[0].message && r.body.choices[0].message.content;
  out.usage = r.body.usage ? { prompt: r.body.usage.prompt_tokens, completion: r.body.usage.completion_tokens } : null;
  out.raw = text || '';
  const v = Translate.parsePlan(text || '');
  out.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
  if (!v.ok) return Object.assign(out, { ok: false, reason: 'invalid-plan' });
  out.plan = v.plan;
  const fig = Composer.compose(v.plan);
  out.compose = fig.ok ? { ok: true } : { ok: false, reason: fig.reason };
  if (fig.ok) out.figure = { points: fig.points, roles: fig.roles, joins: fig.joins, budget: fig.budget, masses: fig.masses, diagnostics: fig.diagnostics };
  out.ok = fig.ok;
  return out;
}

// --recompose: no model call — the saved plans are run through the
// composer as it stands now, so a composer change can be judged on the
// same real plans without spending a request.
function recompose() {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'real-translation.json'), 'utf8'));
  prev.results.forEach((r) => {
    if (!r.plan) return;
    const fig = Composer.compose(r.plan);
    r.compose = fig.ok ? { ok: true } : { ok: false, reason: fig.reason };
    r.figure = fig.ok ? { points: fig.points, roles: fig.roles, joins: fig.joins, budget: fig.budget, masses: fig.masses, diagnostics: fig.diagnostics } : null;
    r.ok = fig.ok;
    console.log('recomposed ' + r.id + ' · ' + (fig.ok ? fig.points.length + ' lights, ' + fig.joins.length + ' joins, ' + fig.diagnostics.components + ' piece(s), ' + fig.diagnostics.crossings + ' crossing(s)' + (fig.diagnostics.dropped.length ? ' · dropped ' + fig.diagnostics.dropped.join(',') : '') : fig.reason));
  });
  prev.recomposed = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, 'real-translation.json'), JSON.stringify(prev, null, 1));
}

(function main() {
  if (process.argv[2] === '--recompose') return recompose();
  const only = process.argv.slice(2);
  const entries = Art.entries.filter((e) => !only.length || only.indexOf(e.id) !== -1);
  const results = [];
  entries.forEach((e) => {
    process.stdout.write('planning ' + e.id + ' … ');
    const r = planOne(e);
    console.log(r.ok ? ('ok · ' + r.plan.gesture.kind + '/' + r.plan.gesture.curve + ' · flow ' + r.plan.gesture.flow.join('→') + ' · ' + r.plan.masses.length + ' masses · ' + r.plan.relationships.length + ' rels · ' + r.plan.complexity + ' → ' + r.figure.points.length + ' lights, ' + r.figure.joins.length + ' joins, ' + r.figure.diagnostics.components + ' piece(s), ' + r.figure.diagnostics.crossings + ' crossing(s)' + (r.validator.repairs.length ? ' · tidied ' + r.validator.repairs.length : '') + (r.figure.diagnostics.dropped.length ? ' · dropped ' + r.figure.diagnostics.dropped.join(',') : ''))
      : ('FAILED ' + r.reason + (r.validator ? ' ' + r.validator.reasons.join(',') : '')));
    results.push(r);
  });
  const report = { run: new Date().toISOString(), model: MODEL, results };
  fs.writeFileSync(path.join(OUT, 'real-translation.json'), JSON.stringify(report, null, 1));
  console.log('\nwrote ' + path.join(OUT, 'real-translation.json') + ' · ' + results.filter((r) => r.ok).length + '/' + results.length + ' composed');
})();
