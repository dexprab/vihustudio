#!/usr/bin/env node
/* tools/ether-mystery-lab-test/real-understanding.js — THE REAL-MODEL PASS.
 *
 * SPRINT — Shape Lab: prompt → artistic creature → image understanding,
 * proof V1. This is the half of the sprint a suite cannot fake: real
 * pictures go to the real model through the SAME contract the Lab uses
 * (LabImagine.understandMessages → the picture attached the way
 * LabConnection attaches it → LabImagine.parseAnalysis), and what comes
 * back is written down beside the ground truth a person wrote by
 * looking at each picture (labArtworkData.js `visible`).
 *
 * It also records, ONCE, the image-generation refusal — the exact word
 * the provider answers when the project has no image model — so the
 * report can say IMAGE GENERATION: UNAVAILABLE from a measurement and
 * not from a belief. It does not try a second model or a second route:
 * the product owner ruled image generation an unavailable capability
 * for this sprint, not a thing to work around.
 *
 * Network: this container reaches api.openai.com only through the
 * agent proxy, which injects the key; curl honours that proxy and
 * Node's fetch does not, so the request goes out through curl. A key
 * in OPENAI_API_KEY is used when present; otherwise the header is a
 * placeholder the proxy replaces. Nothing here logs a key.
 *
 *   node tools/ether-mystery-lab-test/real-understanding.js            all seventeen pictures
 *   node tools/ether-mystery-lab-test/real-understanding.js leo lumo   a subset, by artwork id
 *
 * Writes tools/ether-mystery-lab-test/shots/imagine/real-understanding.json
 * and real-understanding.md. Never runs inside the suite: it costs money
 * and needs the network, and a suite that needs a provider proves the
 * provider rather than the product.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'imagine');
fs.mkdirSync(OUT, { recursive: true });

const Imagine = require(path.join(LAB, 'labImagine.js'));
const Art = require(path.join(LAB, 'labArtworkData.js'));

const MODEL = process.env.LAB_MODEL || 'gpt-4.1-mini';
const IMAGE_MODEL = process.env.LAB_IMAGE_MODEL || 'gpt-image-1';
const KEY = process.env.OPENAI_API_KEY || 'placeholder-the-proxy-injects-the-key';

// The creative prompt each picture is read AGAINST — the researcher's
// words, as they would have been typed. The picture is the source of
// truth; the prompt is context, and promptFidelity says how they agree.
const PROMPTS = {
  'lumo': 'a smiling dragon with enormous wings',
  'leo': 'a lion with wings',
  'leafy': 'a tiny plant creature living in a pot',
  'quill': 'a little spirit made of ink holding a quill pen',
  'nimbus': 'a sleepy cloud sprite carrying a little moon',
  'twemoji-mermaid': 'a graceful mermaid with flowing hair',
  'openmoji-mermaid': 'a graceful mermaid with flowing hair',
  'gameicons-mermaid': 'a graceful mermaid with flowing hair',
  'openmoji-elephant': 'a tiny elephant with huge ears',
  'twemoji-elephant': 'a tiny elephant with huge ears',
  'gameicons-elephant': 'an elephant',
  'gameicons-falcon': 'a falcon',
  'openmoji-eagle': 'a falcon',
  'gameicons-centaur': 'a centaur',
  'twemoji-dragon': 'a smiling dragon with enormous wings',
  'openmoji-dragon': 'a dragon',
  'gameicons-sea-dragon': 'a playful sea creature with butterfly wings'
};

function curlJson(url, body) {
  const tmp = path.join(OUT, '.req.json');
  fs.writeFileSync(tmp, JSON.stringify(body));
  const r = spawnSync('curl', ['-sS', '--max-time', '180', url, '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer ' + KEY, '-d', '@' + tmp], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { fs.unlinkSync(tmp); } catch (e) { /* held */ }
  if (r.status !== 0) return { ok: false, reason: 'curl-failed', detail: (r.stderr || '').split('\n')[0] };
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch (e) { return { ok: false, reason: 'not-json', detail: r.stdout.slice(0, 200) }; }
  return { ok: true, body: parsed };
}

function fileFor(entry) { return path.resolve(LAB, entry.file); }
function mimeFor(file) { return /\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png'; }

// Image generation, ONCE, recorded as measured.
function probeImageGeneration() {
  const r = curlJson('https://api.openai.com/v1/images/generations', { model: IMAGE_MODEL, prompt: 'a small red circle on white', n: 1, size: '1024x1024' });
  if (!r.ok) return { available: false, reason: r.reason, detail: r.detail };
  const err = r.body && r.body.error;
  if (err) return { available: false, reason: String(err.code || err.type || 'error'), model: IMAGE_MODEL };
  const data = Array.isArray(r.body.data) ? r.body.data : [];
  return { available: data.length > 0, reason: data.length ? null : 'no-data', model: IMAGE_MODEL };
}

function understandOne(entry) {
  const prompt = PROMPTS[entry.id] || entry.title;
  const m = Imagine.understandMessages(prompt, []);
  const file = fileFor(entry);
  const b64 = fs.readFileSync(file).toString('base64');
  const mime = mimeFor(file);
  // the picture attached exactly the way LabConnection.understand attaches it
  const messages = m.messages.map((msg, i) => i !== m.messages.length - 1 ? msg : {
    role: 'user',
    content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64, detail: 'high' } }]
  });
  const t0 = Date.now();
  const r = curlJson('https://api.openai.com/v1/chat/completions', { model: MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 1400 });
  const ms = Date.now() - t0;
  const out = { id: entry.id, title: entry.title, file: entry.file, bytes: fs.statSync(file).size, prompt, model: MODEL, ms, visible: entry.visible };
  if (!r.ok) return Object.assign(out, { ok: false, reason: r.reason, detail: r.detail });
  const body = r.body;
  if (body.error) return Object.assign(out, { ok: false, reason: String(body.error.code || body.error.type || 'error') });
  const text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  out.usage = body.usage ? { prompt: body.usage.prompt_tokens, completion: body.usage.completion_tokens } : null;
  out.servedModel = body.model || null;
  const v = Imagine.parseAnalysis(text || '');
  out.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
  out.raw = text || '';
  if (v.ok) out.analysis = v.analysis;
  out.ok = v.ok;
  return out;
}

function md(results, gen) {
  const lines = [];
  lines.push('# Real-model pass — image understanding');
  lines.push('');
  lines.push('IMAGE GENERATION: ' + (gen.available ? 'AVAILABLE (' + gen.model + ')' : 'UNAVAILABLE — API access limitation (' + gen.model + ' answered `' + gen.reason + '`)'));
  lines.push('IMAGE UNDERSTANDING: REAL (' + MODEL + ')');
  lines.push('MODEL: ' + MODEL);
  lines.push('Run: ' + new Date().toISOString());
  lines.push('');
  results.forEach((r) => {
    lines.push('## ' + r.title + ' (`' + r.id + '`)');
    lines.push('');
    lines.push('Prompt read against: _' + r.prompt + '_ · ' + r.bytes + ' bytes · ' + r.ms + ' ms' + (r.usage ? ' · tokens ' + r.usage.prompt + '+' + r.usage.completion : ''));
    lines.push('');
    lines.push('**A. What is actually visible** (written by a person): ' + r.visible);
    lines.push('');
    if (!r.ok) { lines.push('**B. The model:** FAILED — ' + r.reason + (r.validator ? ' · validator: ' + r.validator.reasons.join(', ') : '')); lines.push(''); return; }
    const a = r.analysis;
    lines.push('**B. What the model says is visible:**');
    lines.push('');
    lines.push('- Subject: ' + a.subject);
    lines.push('- Character: ' + a.character.join(', '));
    lines.push('- Composition: ' + a.composition);
    lines.push('- Masses: ' + a.architecture.join(' / '));
    lines.push('- Diagnostic features: ' + a.diagnosticFeatures.join(', '));
    lines.push('- Modifiers: ' + (a.modifiers.join(', ') || '—'));
    lines.push('- Proportion: ' + a.proportion);
    lines.push('- Gesture: ' + a.gesture);
    lines.push('- Survives abstraction: ' + a.abstraction.survives.join(', ') + (a.abstraction.doNotDrawLiterally.length ? ' · do not draw literally: ' + a.abstraction.doNotDrawLiterally.join(', ') : '') + (a.abstraction.note ? ' · ' + a.abstraction.note : ''));
    lines.push('- Reveal candidates: ' + (a.revealCandidates.join(', ') || '—'));
    lines.push('- Against the prompt: ' + (a.promptFidelity ? a.promptFidelity.agreement + (a.promptFidelity.differences.length ? ' — ' + a.promptFidelity.differences.join('; ') : '') : 'not stated'));
    if (r.validator.repairs.length) lines.push('- Validator tidied: ' + r.validator.repairs.join(' · '));
    lines.push('');
  });
  return lines.join('\n');
}

(function main() {
  const only = process.argv.slice(2);
  const entries = Art.entries.filter((e) => !only.length || only.indexOf(e.id) !== -1);
  console.log('image generation probe (' + IMAGE_MODEL + ')…');
  const gen = probeImageGeneration();
  console.log('  → ' + (gen.available ? 'AVAILABLE' : 'UNAVAILABLE — ' + gen.reason));
  const results = [];
  entries.forEach((e) => {
    process.stdout.write('understanding ' + e.id + ' … ');
    const r = understandOne(e);
    console.log(r.ok ? 'ok (' + r.ms + ' ms, ' + (r.usage ? r.usage.prompt + '+' + r.usage.completion + ' tokens' : '') + ')' : 'FAILED ' + r.reason + ' ' + (r.validator ? r.validator.reasons.join(',') : ''));
    results.push(r);
  });
  const report = { run: new Date().toISOString(), model: MODEL, imageGeneration: gen, results };
  fs.writeFileSync(path.join(OUT, 'real-understanding.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(OUT, 'real-understanding.md'), md(results, gen));
  console.log('\nwrote ' + path.join(OUT, 'real-understanding.json') + ' · ' + results.filter((r) => r.ok).length + '/' + results.length + ' accepted by the validator');
})();
