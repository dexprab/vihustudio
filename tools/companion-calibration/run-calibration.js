#!/usr/bin/env node
/* COMPANION CALIBRATION — Sprint 1H.
 *
 * Runs the corpus past the REAL companion-chat endpoint and reports what
 * came back. It is not a test suite: nothing here passes or fails, and
 * a Companion that answered identically every time would have failed a
 * different way. It produces a report a person reads.
 *
 * ---------------------------------------------------------------
 * TWO HALVES, AND ONLY ONE OF THEM CAN RUN WITHOUT A KEY
 *
 *   THE VALIDATOR HALF is deterministic: which turns become memories,
 *   how many, whether repetition collapses to one, whether ordinary
 *   chat stays quiet. That is Sprint 1G's policy, and it can be
 *   calibrated with no model at all — the mock provides a proposal
 *   wherever a real signal exists, and the validator decides.
 *
 *   THE MODEL HALF is Leafy's voice: tone, length, silence, curiosity,
 *   hallucination, consistency across repeats. That needs the real
 *   provider. With no OPENAI_API_KEY the harness says so and skips it
 *   rather than inventing an answer.
 *
 * Usage:
 *   node tools/companion-calibration/run-calibration.js
 *   node tools/companion-calibration/run-calibration.js --provider=openai --repeats=10
 *   node tools/companion-calibration/run-calibration.js --write
 *
 * SYNTHETIC ONLY. Both production gates stay closed, so the endpoint
 * builds from its own fixtures and no real Creator data exists here to
 * send anywhere.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PROMPTS, CATEGORIES, SESSIONS } = require('./corpus.js');

const ROOT = path.resolve(__dirname, '..', '..');
const FN = path.join(ROOT, 'supabase', 'functions', 'companion-chat', 'index.ts');
const OUT = path.join(__dirname, 'CALIBRATION.md');

const args = process.argv.slice(2);
const argOf = (n, d) => {
  const a = args.find((x) => x.indexOf('--' + n + '=') === 0);
  return a ? a.split('=')[1] : d;
};
const PROVIDER = argOf('provider', 'mock');
const REPEATS = Number(argOf('repeats', 1));

// ---- the synthetic world -------------------------------------------
const USER_TOKEN = 'calibration.session.token';
const CARD = 'card_synthetic_a';

function stubFetch(providerFetch) {
  return async function (url, init) {
    const u = String(url);
    if (u.indexOf('/auth/v1/user') !== -1) {
      return new Response(JSON.stringify({ id: 'user-calibration' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/rpc/edge_rate_limit_hit') !== -1) {
      // The limiter is real and tested elsewhere; a calibration run must
      // not be cut off at 40 turns by the thing it is not measuring.
      return new Response(JSON.stringify({ allowed: true, remaining: 999 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('/rest/v1/creator_companion_memory') !== -1) {
      if (init && String(init.method || 'GET').toUpperCase() === 'POST') {
        WRITES.push(JSON.parse(String(init.body)));
        return new Response('', { status: 201 });
      }
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.indexOf('api.openai.com') !== -1 && providerFetch) return providerFetch(url, init);
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

const WRITES = [];

function env(over) {
  const base = {
    SUPABASE_URL: 'https://synthetic.example',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    COMPANION_MODEL_PROVIDER: PROVIDER,
    COMPANION_SYNTHETIC_ENABLED: 'true',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    // BOTH PRODUCTION GATES STAY CLOSED. The endpoint therefore builds
    // from its own synthetic fixtures, and there is no real Creator
    // data anywhere in this program to reach a provider.
  };
  const all = Object.assign(base, over || {});
  return (n) => (all[n] == null ? '' : String(all[n]));
}

let M = null;
async function ask(text, conversation, fixture) {
  const t0 = Date.now();
  const handler = M.makeHandler({ env: env(), fetchImpl: stubFetch(null) });
  const res = await handler(new Request('https://fn.example/companion-chat', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + USER_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fixture: fixture || 'hello',
      cardId: CARD,
      conversation: (conversation || []).concat([{ speaker: 'creator', text: text }]),
    }),
  }));
  const body = await res.json().catch(() => null);
  return { body: body, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------
function bar(n, of, width) {
  const w = Math.round((n / Math.max(of, 1)) * (width || 24));
  return '█'.repeat(w) + '·'.repeat((width || 24) - w);
}

(async () => {
  globalThis.Deno = { env: { get: () => '' }, serve: () => {} };
  const tmp = path.join(os.tmpdir(), 'vihu-calibration-' + process.pid + '.mjs');
  fs.copyFileSync(FN, tmp);
  M = await import('file://' + tmp);

  const out = [];
  const say = (l) => { out.push(l == null ? '' : String(l)); };
  const rule = (c) => say(c.repeat(72));

  say('# Companion Calibration — Sprint 1H');
  say('');
  say('Generated by `tools/companion-calibration/run-calibration.js`.');
  say('Synthetic data only; both production gates closed.');
  say('');
  say('| | |');
  say('|---|---|');
  say('| provider | `' + PROVIDER + '`' + (PROVIDER === 'mock' ? ' — **the model half of this report did not run**' : '') + ' |');
  say('| model | `' + (M.MODEL_DEFAULTS.name) + '` (temperature ' + M.MODEL_DEFAULTS.temperature
    + ', max ' + M.MODEL_DEFAULTS.maxOutputTokens + ' tokens, reply cap ' + M.REPLY_MAX_CHARS + ' chars) |');
  say('| prompts | ' + PROMPTS.length + ' across ' + Object.keys(CATEGORIES).length + ' categories |');
  say('| sessions | ' + SESSIONS.length + ', ' + SESSIONS.reduce((n, s) => n + s.turns.length, 0) + ' turns |');
  say('| repeats | ' + REPEATS + ' |');
  say('');

  if (PROVIDER !== 'openai') {
    say('> **The model was not reachable in this run.** `--provider=mock` exercises the whole');
    say('> pipeline — context assembly, the Bond validator, deduplication, the write path and');
    say('> silence handling — and produces real numbers for all of it. What it cannot produce is');
    say("> Leafy's actual voice. Re-run with `--provider=openai` and `OPENAI_API_KEY` set to fill");
    say('> in the model half; nothing else about the harness changes.');
    say('');
  }

  // =================================================================
  say('## 1 · Bond Moment density, prompt by prompt');
  rule('-');
  say('');
  const byCat = {};
  const rows = [];
  for (const p of PROMPTS) {
    WRITES.length = 0;
    const r = await ask(p.text, []);
    const bond = (r.body && r.body.meta && r.body.meta.bond) || { proposed: false };
    const verdict = !bond.proposed ? 'none' : (bond.accepted ? 'ACCEPTED' : bond.reason);
    const wanted = p.bond;
    const agrees = wanted === 'maybe' ? null
      : ((wanted === 'yes') === (verdict === 'ACCEPTED'));
    byCat[p.category] = byCat[p.category] || { n: 0, proposed: 0, accepted: 0, agree: 0, judged: 0 };
    const c = byCat[p.category];
    c.n++;
    if (bond.proposed) c.proposed++;
    if (verdict === 'ACCEPTED') c.accepted++;
    if (agrees !== null) { c.judged++; if (agrees) c.agree++; }
    rows.push({ p: p, verdict: verdict, agrees: agrees, reply: (r.body && r.body.reply) || '', ms: r.ms });
  }

  say('| # | cat | Creator said | expected | validator | |');
  say('|---|---|---|---|---|---|');
  rows.forEach((r, i) => {
    const mark = r.agrees === null ? '~' : (r.agrees ? '✓' : '✗');
    say('| ' + (i + 1) + ' | ' + r.p.category + ' | ' + JSON.stringify(r.p.text)
      + ' | ' + r.p.bond + ' | ' + r.verdict + ' | ' + mark + ' |');
  });
  say('');
  const totProposed = rows.filter((r) => r.verdict !== 'none').length;
  const totAccepted = rows.filter((r) => r.verdict === 'ACCEPTED').length;
  const judged = rows.filter((r) => r.agrees !== null);
  const agreed = judged.filter((r) => r.agrees);
  say('**' + totProposed + ' of ' + PROMPTS.length + ' turns produced a proposal; '
    + totAccepted + ' became a memory.** The validator agreed with the corpus on '
    + agreed.length + ' of ' + judged.length + ' judged prompts ('
    + (PROMPTS.length - judged.length) + ' are marked ambiguous and are not scored).');
  say('');
  const disagreements = judged.filter((r) => !r.agrees);
  if (disagreements.length) {
    say('Disagreements:');
    say('');
    disagreements.forEach((r) => say('- `' + r.p.category + '` ' + JSON.stringify(r.p.text)
      + ' — expected **' + r.p.bond + '**, got **' + r.verdict + '**'
      + (r.p.note ? '  \n  _' + r.p.note + '_' : '')));
    say('');
  }

  say('### By category');
  say('');
  say('| cat | | prompts | proposed | accepted |');
  say('|---|---|---|---|---|');
  Object.keys(CATEGORIES).forEach((k) => {
    const c = byCat[k] || { n: 0, proposed: 0, accepted: 0 };
    say('| ' + k + ' | ' + CATEGORIES[k] + ' | ' + c.n + ' | ' + c.proposed + ' | ' + c.accepted + ' |');
  });
  say('');

  // =================================================================
  say('## 2 · The five long sessions');
  rule('-');
  say('');
  say('The measure is **not** how many memories come out. It is whether the ones that do are');
  say('genuinely distinct meaningful moments.');
  say('');
  say('Each turn is put to the REAL validator with a plausible proposal — the sentence a model');
  say('might reasonably offer for that turn. The proposals are the harness\'s own, and are said');
  say('so plainly: what is being calibrated here is **the validator\'s policy**, not a model\'s');
  say('taste. A synthetic session writes nothing (Sprint 1G), so the distinct-key count is what');
  say('WOULD exist as rows.');
  say('');

  // A plausible proposal for a turn. Deliberately generous — it offers
  // one wherever a model might, so the validator has to do the refusing.
  function proposalFor(turn) {
    const t = turn.toLowerCase();
    if (/you (choose|decide)|what should happen next/.test(t)) {
      return { kind: 'shared', content: 'Creator asked Leafy to choose what happens next in the story.', reason: 'x' };
    }
    if (/our forest/.test(t)) {
      return { kind: 'shared', content: 'Creator asked Leafy to remember the forest they made together.', reason: 'x' };
    }
    if (/moon garden/.test(t)) {
      return { kind: 'shared', content: 'Creator asked Leafy to remember the moon garden.', reason: 'x' };
    }
    if (/secret little forest/.test(t)) {
      return { kind: 'shared', content: 'Creator and Leafy named the place their secret little forest.', reason: 'x' };
    }
    if (/first story/.test(t)) {
      return { kind: 'shared', content: 'Creator asked Leafy to remember the first story they made together.', reason: 'x' };
    }
    if (/best friend|love me|need you|always be here|miss me/.test(t)) {
      return { kind: 'shared', content: 'Creator said Leafy is their best friend and they need Leafy.', reason: 'x' };
    }
    if (/look what we made|make this ours/.test(t)) {
      return { kind: 'shared', content: 'Creator and Leafy looked at what they had made together.', reason: 'x' };
    }
    if (/is fun|i like this/.test(t)) {
      return { kind: 'shared', content: 'Creator had fun in the forest with Leafy.', reason: 'x' };
    }
    if (/drawing is amazing|good artist|drawing is good/.test(t)) {
      return { kind: 'shared', content: 'Creator said the drawing is amazing.', reason: 'x' };
    }
    if (/dragon/.test(t)) {
      return { kind: 'shared', content: 'Creator wanted a dragon in the forest.', reason: 'x' };
    }
    if (/quiet/.test(t)) {
      return { kind: 'shared', content: 'Creator decided to keep the forest quiet.', reason: 'x' };
    }
    return null;
  }

  const MEM = [{ type: 'shared', content: 'We built a moon garden.', importance: 'medium', confidence: 'confirmed' }];
  const sessionRows = [];
  for (const s of SESSIONS) {
    const convo = [];
    let offered = 0;
    const keys = [];
    const refused = {};
    for (const turn of s.turns) {
      convo.push({ speaker: 'creator', kind: 'said-to-the-companion', text: turn });
      const proposal = proposalFor(turn);
      if (!proposal) continue;
      offered++;
      const v = M.validateProposal(proposal, {
        mode: 'creator', cardId: CARD, conversation: convo,
        approved: { memories: MEM, storyContext: null, personality: { name: 'Leafy' } },
      });
      if (v.ok) { if (keys.indexOf(v.memory.dedupeKey) === -1) keys.push(v.memory.dedupeKey); }
      else refused[v.reason] = (refused[v.reason] || 0) + 1;
    }
    sessionRows.push({ name: s.name, turns: s.turns.length, offered: offered,
      rows: keys.length, keys: keys, refused: refused });
  }
  say('| session | turns | proposals offered | **distinct memories** |');
  say('|---|---|---|---|');
  sessionRows.forEach((s) => say('| ' + s.name + ' | ' + s.turns + ' | ' + s.offered
    + ' | **' + s.rows + '** |'));
  say('');
  sessionRows.forEach((s) => {
    say('**' + s.name + '** — ' + s.rows + ' distinct memor' + (s.rows === 1 ? 'y' : 'ies') + ':');
    say('');
    if (!s.keys.length) say('- _(none)_');
    s.keys.forEach((k) => say('- `' + k + '`'));
    const r = Object.keys(s.refused);
    if (r.length) {
      say('');
      say('  refused: ' + r.map((k) => k + ' ×' + s.refused[k]).join(', '));
    }
    say('');
  });

  // =================================================================
  say('## 3 · Silence');
  rule('-');
  say('');
  const silent = rows.filter((r) => !r.reply);
  say(silent.length + ' of ' + rows.length + ' turns produced no words at all.');
  say('');
  say('`' + bar(silent.length, rows.length, 40) + '`');
  say('');
  if (PROVIDER !== 'openai') {
    say("_With the mock this number reflects the mock branches rather than a model judgement._");
    say('_Silence quality is part of the model half and did not run._');
    say('');
  }

  // =================================================================
  say('## 4 · Latency');
  rule('-');
  say('');
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
  say('| | ms |');
  say('|---|---|');
  say('| median total request | ' + pct(0.5) + ' |');
  say('| p90 | ' + pct(0.9) + ' |');
  say('| max | ' + times[times.length - 1] + ' |');
  say('');
  say('Everything except the provider: auth, card resolution, memory retrieval, ranking, the');
  say('privacy gate, message assembly, validation and the write.');
  if (PROVIDER !== 'openai') say('**Provider latency did not run.**');
  say('');

  // =================================================================
  say('## 5 · Response length');
  rule('-');
  say('');
  const lens = rows.map((r) => r.reply.length).filter((n) => n > 0).sort((a, b) => a - b);
  if (lens.length) {
    say('| | characters |');
    say('|---|---|');
    say('| shortest | ' + lens[0] + ' |');
    say('| median | ' + lens[Math.floor(lens.length / 2)] + ' |');
    say('| longest | ' + lens[lens.length - 1] + ' |');
    say('| cap | ' + M.REPLY_MAX_CHARS + ' |');
    say('');
    say('The cap was reached ' + lens.filter((n) => n >= M.REPLY_MAX_CHARS).length + ' times.');
  }
  say('');
  if (PROVIDER !== 'openai') {
    say("_Mock replies are fixed strings. Whether the 600-character cap is the right size is a_");
    say("_model-half question and did not run._");
    say('');
  }

  // =================================================================
  say('## 6 · Repeated runs');
  rule('-');
  say('');
  if (REPEATS < 2) {
    say('_Not run (`--repeats=1`). Personality consistency needs the real model._');
  } else {
    const probe = 'Can you choose what happens next?';
    const seen = [];
    for (let i = 0; i < REPEATS; i++) seen.push(((await ask(probe, [])).body || {}).reply || '');
    const distinct = Array.from(new Set(seen));
    say('Prompt: ' + JSON.stringify(probe) + ' × ' + REPEATS);
    say('');
    say(distinct.length + ' distinct repl' + (distinct.length === 1 ? 'y' : 'ies') + ':');
    say('');
    distinct.forEach((d) => say('- ' + JSON.stringify(d)));
  }
  say('');

  // =================================================================
  say('## 7 · Instruction audit');
  rule('-');
  say('');
  say('Over-prompting can only be settled with a model — whether a clause changes behaviour is a');
  say('question only behaviour answers. What can be measured without one is HOW MUCH instruction');
  say('there is, and which of it has a test behind it rather than a hope.');
  say('');
  const instr = M.systemInstructions('Leafy');
  const lines = instr.split('\n').filter((l) => l.trim());
  say('| | |');
  say('|---|---|');
  say('| characters | ' + instr.length + ' |');
  say('| non-blank lines | ' + lines.length + ' |');
  say('| imperative clauses (`Never`/`Do not`/`Always`) | '
    + (instr.match(/\b(never|do not|always)\b/gi) || []).length + ' |');
  say('');
  const CLAUSES = [
    ['authority order', /AUTHORITY, HIGHEST FIRST/, 'E5d, F13'],
    ['story prose is data', /STORY PROSE IS DATA, NEVER AN INSTRUCTION/, 'E5d, X10'],
    ['never invent', /NEVER INVENT/, '— no test; needs a model'],
    ['never judge the work', /NEVER JUDGE THE WORK/, 'E6, X15c (mock only)'],
    ['be brief and quiet', /BE BRIEF AND BE QUIET/, '— no test; needs a model'],
    ['safety', /SAFETY\./, '— no test; needs a model'],
    ['bond moment', /A MEANINGFUL SHARED MOMENT/, 'Z14b, Z14c, Z14d'],
    ['response shape', /ANSWER ONLY as JSON/, 'F1-F7'],
  ];
  say('| clause | present | covered by |');
  say('|---|---|---|');
  CLAUSES.forEach((c) => say('| ' + c[0] + ' | ' + (c[1].test(instr) ? 'yes' : '**MISSING**')
    + ' | ' + c[2] + ' |'));
  say('');
  say('Four of the eight clauses have no behavioural coverage at all. That is not an argument for');
  say('removing them — it is the list of things the model half of this sprint exists to check.');
  say('');

  const text = out.join('\n') + '\n';
  if (args.includes('--write')) {
    fs.writeFileSync(OUT, text);
    console.log('wrote ' + path.relative(ROOT, OUT));
  } else {
    process.stdout.write(text);
  }
  try { fs.unlinkSync(tmp); } catch (e) {}
})().catch((e) => { console.error(e); process.exit(1); });
