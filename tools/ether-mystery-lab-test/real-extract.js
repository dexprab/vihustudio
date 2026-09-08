#!/usr/bin/env node
/* tools/ether-mystery-lab-test/real-extract.js — THE REAL PIPELINE, end to
 * end: CREATIVE PROMPT → gpt-image-2 → the picture → gpt-4.1 → the Ether
 * extraction (points, connections, missing connections, reveal features,
 * hint) at the production budget (8) and at 12 → validated by the Lab's
 * own validator → written down for render-extract.js to draw and a
 * person to rate.
 *
 * SPRINT — Image → Ether creature, end-to-end closure (Decision 58, Lab
 * only). REAL MODEL ONLY: a failed request is written down as a failure;
 * no fixture is ever substituted and nothing constructed is labelled a
 * model result.
 *
 * The seven prompts are the brief's own, verbatim. The image prompt is
 * the Lab's own (LabImagine.imagePrompt — the request plus the fixed
 * presentation instruction: one creature, full body, readable silhouette,
 * no text, no labels, no borders, no interface). The extraction contract
 * is the Lab's own (LabExtract.extractMessages).
 *
 * Network: curl through the agent proxy, which injects the key. Image
 * generation STREAMS (stream: true) because the proxy closes a connection
 * that is silent for thirty seconds and an image takes longer than that
 * to make — a streamed generation keeps bytes moving. Never runs inside
 * the suite.
 *
 *   node tools/ether-mystery-lab-test/real-extract.js              all seven
 *   node tools/ether-mystery-lab-test/real-extract.js panda        a subset
 *   node tools/ether-mystery-lab-test/real-extract.js --extract    no image call: extract again from the saved pictures
 *   node tools/ether-mystery-lab-test/real-extract.js --revalidate no model call: re-read the saved replies
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB = path.join(ROOT, 'tools/ether-mystery-lab');
const OUT = path.join(__dirname, 'shots', 'extract');
fs.mkdirSync(OUT, { recursive: true });

const Imagine = require(path.join(LAB, 'labImagine.js'));
const Extract = require(path.join(LAB, 'labExtract.js'));

const IMAGE_MODEL = process.env.LAB_IMAGE_MODEL || 'gpt-image-2';
const MODEL = process.env.LAB_MODEL || 'gpt-4.1';
const KEY = process.env.OPENAI_API_KEY || 'placeholder-the-proxy-injects-the-key';
const BUDGETS = [8, 12];

const PROMPTS = [
  { id: 'panda', prompt: 'A panda made of stars in a night sky' },
  { id: 'mermaid', prompt: 'A mermaid made of stars in a night sky' },
  { id: 'baby-dragon', prompt: 'A baby dragon made of stars in a night sky' },
  { id: 'falcon', prompt: 'A falcon made of stars in a night sky' },
  { id: 'winged-lion', prompt: 'A lion with wings made of stars in a night sky' },
  { id: 'whale', prompt: 'A giant whale made of stars in a night sky' },
  { id: 'star-fox', prompt: 'An imaginary creature that looks like a fox, made of stars in a night sky' }
];

function curlRaw(url, bodyObj, extraArgs) {
  const tmp = path.join(OUT, '.req.json');
  fs.writeFileSync(tmp, JSON.stringify(bodyObj));
  const r = spawnSync('curl', ['-sS', '--max-time', '300', '-N', url, '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer ' + KEY, '-d', '@' + tmp].concat(extraArgs || []), { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  try { fs.unlinkSync(tmp); } catch (e) { /* held */ }
  if (r.status !== 0) return { ok: false, reason: 'curl-failed', detail: (r.stderr || '').split('\n')[0] };
  return { ok: true, text: r.stdout };
}

// gpt-image-2, streamed: the last `image_generation.completed` event
// carries the finished picture.
function generateImage(prompt) {
  const p = Imagine.imagePrompt(prompt, []);
  if (!p.ok) return { ok: false, reason: 'bad-prompt' };
  const t0 = Date.now();
  const r = curlRaw('https://api.openai.com/v1/images/generations', { model: IMAGE_MODEL, prompt: p.text, n: 1, size: '1024x1024', stream: true, partial_images: 1 });
  const ms = Date.now() - t0;
  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail, ms };
  const text = r.text || '';
  if (!/^event:|^data:/m.test(text)) {
    let err = null; try { err = JSON.parse(text); } catch (e) { /* not json */ }
    const code = err && err.error ? String(err.error.code || err.error.type || err.error.message || 'error') : ('upstream: ' + text.slice(0, 80));
    return { ok: false, reason: 'provider-error', detail: code, ms };
  }
  let b64 = null, events = 0;
  text.split(/\n\n+/).forEach((chunk) => {
    const m = chunk.match(/^data:\s*(\{[\s\S]*\})\s*$/m);
    if (!m) return;
    events++;
    try { const ev = JSON.parse(m[1]); if (ev.type === 'image_generation.completed' && typeof ev.b64_json === 'string') b64 = ev.b64_json; else if (!b64 && ev.type === 'image_generation.partial_image' && typeof ev.b64_json === 'string') b64 = ev.b64_json; } catch (e) { /* skip */ }
  });
  if (!b64) return { ok: false, reason: 'malformed', detail: 'no completed image in ' + events + ' events', ms };
  return { ok: true, b64, ms, events, prompt: p.text };
}

// THE PROXY ANSWERS FROM TWO PROJECTS, ONE WITHOUT gpt-4.1. Measured
// three times in a row: ok · "Project … does not have access to model
// gpt-4.1" · ok. That is the environment, not the model, so a
// model_not_found is retried a few times and the retries are written
// down; any other failure is not retried.
function extractOne(file, budget) {
  let last = null;
  for (let attempt = 1; attempt <= 6; attempt++) {
    last = extractOnce(file, budget);
    last.attempts = attempt;
    if (last.ok || last.reason !== 'model_not_found') return last;
  }
  return last;
}
function extractOnce(file, budget) {
  const m = Extract.extractMessages(budget);
  const b64 = fs.readFileSync(file).toString('base64');
  const messages = m.messages.map((msg, i) => i !== m.messages.length - 1 ? msg : { role: 'user', content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64, detail: 'high' } }] });
  const t0 = Date.now();
  const r = curlRaw('https://api.openai.com/v1/chat/completions', { model: MODEL, messages, response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: 3000 });
  const out = { budget, model: MODEL, ms: Date.now() - t0 };
  if (!r.ok) return Object.assign(out, { ok: false, reason: r.reason, detail: r.detail });
  let body; try { body = JSON.parse(r.text); } catch (e) { return Object.assign(out, { ok: false, reason: 'not-json', detail: r.text.slice(0, 120) }); }
  if (body.error) return Object.assign(out, { ok: false, reason: String(body.error.code || body.error.type || 'error') });
  const text = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  out.usage = body.usage ? { prompt: body.usage.prompt_tokens, completion: body.usage.completion_tokens } : null;
  out.raw = text || '';
  const v = Extract.parseExtraction(text || '', budget);
  out.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] };
  if (!v.ok) return Object.assign(out, { ok: false, reason: 'invalid-extraction' });
  out.extraction = v.extraction;
  out.ok = true;
  return out;
}

function line(x) {
  if (!x.ok) return 'FAILED ' + x.reason + (x.detail ? ' (' + x.detail + ')' : '') + (x.validator ? ' ' + x.validator.reasons.join(',') : '');
  const e = x.extraction;
  return (x.attempts > 1 ? '(attempt ' + x.attempts + ') ' : '') + e.subject + ' · ' + e.points.length + ' pts · ' + e.joins.length + ' joins · ' + e.missing.length + ' missing · ' + e.revealFeatures.length + ' reveals · hint ' + (e.hint ? '“' + e.hint + '”' : 'none') + ' · identity ' + e.confidence.identity + (x.validator.repairs.length ? ' · tidied ' + x.validator.repairs.length : '');
}

function readPrev() { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'real-extract.json'), 'utf8')); } catch (e) { return null; } }

(function main() {
  const args = process.argv.slice(2);
  const mode = args[0] === '--extract' ? 'extract' : args[0] === '--revalidate' ? 'revalidate' : 'all';
  const only = args.filter((a) => !/^--/.test(a));
  const prev = readPrev();
  if (mode === 'revalidate') {
    prev.results.forEach((r) => {
      Object.keys(r.extractions || {}).forEach((b) => {
        const x = r.extractions[b]; if (!x.raw) return;
        const v = Extract.parseExtraction(x.raw, Number(b));
        x.validator = { ok: v.ok, reasons: v.reasons || [], repairs: v.repairs || [] }; x.ok = v.ok; x.extraction = v.ok ? v.extraction : undefined; if (!v.ok) x.reason = 'invalid-extraction';
        console.log(r.id + ' @' + b + ' · ' + line(x));
      });
    });
    prev.revalidated = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, 'real-extract.json'), JSON.stringify(prev, null, 1));
    return;
  }
  const results = [];
  PROMPTS.forEach((p) => {
    if (only.length && only.indexOf(p.id) === -1) { const old = prev && prev.results.filter((r) => r.id === p.id)[0]; if (old) results.push(old); return; }
    const dir = path.join(OUT, p.id); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'source.png');
    const out = { id: p.id, prompt: p.prompt, labels: {}, image: null, extractions: {} };
    if (mode === 'all' || !fs.existsSync(file)) {
      process.stdout.write('imagining ' + p.id + ' … ');
      const g = generateImage(p.prompt);
      if (!g.ok) { out.image = { ok: false, reason: g.reason, detail: g.detail, ms: g.ms, model: IMAGE_MODEL }; out.labels.image = 'FAILED — REAL MODEL request (' + IMAGE_MODEL + ') did not return a picture; nothing substituted'; console.log('FAILED ' + g.reason + (g.detail ? ' (' + g.detail + ')' : '')); results.push(out); return; }
      fs.writeFileSync(file, Buffer.from(g.b64, 'base64'));
      out.image = { ok: true, file: p.id + '/source.png', model: IMAGE_MODEL, ms: g.ms, events: g.events, imagePrompt: g.prompt, bytes: Buffer.from(g.b64, 'base64').length };
      console.log('ok · ' + Math.round(g.ms / 1000) + 's · ' + out.image.bytes + ' bytes');
    } else {
      const old = prev && prev.results.filter((r) => r.id === p.id)[0];
      out.image = old && old.image ? old.image : { ok: true, file: p.id + '/source.png', model: IMAGE_MODEL, reused: true };
    }
    out.labels.image = 'REAL MODEL (' + IMAGE_MODEL + ', streamed)';
    BUDGETS.forEach((b) => {
      process.stdout.write('  extracting ' + p.id + ' @' + b + ' … ');
      const x = extractOne(file, b);
      out.extractions[b] = x;
      console.log(line(x));
    });
    out.labels.extraction = 'REAL MODEL (' + MODEL + ', with the generated picture)';
    results.push(out);
  });
  const report = { run: new Date().toISOString(), imageModel: IMAGE_MODEL, model: MODEL, note: 'Every stage is REAL MODEL; a failed stage says FAILED and nothing is substituted.', results };
  fs.writeFileSync(path.join(OUT, 'real-extract.json'), JSON.stringify(report, null, 1));
  console.log('\nwrote ' + path.join(OUT, 'real-extract.json'));
})();
