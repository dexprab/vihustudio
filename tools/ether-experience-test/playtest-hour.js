/* HORIZON D — the composed hour, compressed. A pumped-clock stand-in
 * for a Traveller who keeps living in the Ether for sixty minutes:
 * they turn, they meet what passes, trails are followed and found,
 * and the composer answers across the whole visit. Compression is the
 * composer's own public knob (setTimeScale); crossings are simulated
 * as leaving after their real-world duration in composed seconds.
 *
 * WHAT IS REAL HERE: every composition decision, the novelty and
 * rarity arithmetic, the phases, the anchors, the ledger. WHAT IS
 * NOT: pixels and real crossing durations — those are the browser
 * playtest's (playtest.js) and the 20-minute real sitting's.
 *
 * Run:  node tools/ether-experience-test/playtest-hour.js [visits]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const VISITS = Number(process.argv[2] || 3);

function makeWorld() {
  const lifeHandlers = {};
  const handlers = {};
  const world = { stillValue: 999, focusOpen: false, summons: [], becks: 0,
                  marks: [], blooms: [], frames: [], now: 0, camX: 0 };
  world.entities = [];
  for (let i = 0; i < 9; i++) {
    world.entities.push({ id: 'story-' + i, prox: 0.05 + (i % 4) * 0.1,
      focusT: 0, position: { x: i * 420, y: 300 },
      publishedAt: new Date().toISOString() });
  }
  const universe = {
    ether: { width: 4200, height: 1000, viewWidth: 1440, viewHeight: 900,
             depth: { stories: 1 } },
    camera: { offsetFor: (p, out) => { const o = out || {}; o.x = world.camX; o.y = 0; return o; } },
    stories: { all: () => world.entities, count: () => world.entities.length },
    focus: { isOpen: () => world.focusOpen },
    traveller: { stillSeconds: () => world.stillValue },
    isRunning: () => true,
    on: (e, fn) => { (handlers[e] = handlers[e] || []).push(fn); }, off: () => {}
  };
  const life = {
    quiet: false, conducted: true,
    times: { firstArrival: [6.5, 10], beckonAfter: 16, beckonSpacing: 22,
             beckonLife: 7, beckons: 2 },
    active: () => world.enc || null,
    trail: () => world.trailLive || null,
    // A live beckon breathes for ~7 s before the next may be offered —
    // without this the stub collapses the pair into one breath.
    beckon: () => ({ active: world.beckUntil > world.simTime,
                     given: world.becks, stopped: !!world.becksStopped }),
    beckonNow: () => { world.becks++; world.beckUntil = world.simTime + 7;
                       return { given: world.becks }; },
    summon: (id, manner) => {
      if (world.enc) return null;
      world.enc = { id, manner: manner || {}, screen: { x: 700, y: 420 }, up: world.simTime };
      world.summons.push({ id, manner: manner || {}, t: world.simTime });
      emitLife('creature:arrived', { id });
      return id;
    },
    markAt: (x, y) => { world.marks.push({ x, y }); return true; },
    bloomAt: (x, y) => { world.blooms.push({ x, y }); return 'bird'; },
    on: (e, fn) => { (lifeHandlers[e] = lifeHandlers[e] || []).push(fn); },
    setComposer: () => {}, setScout: () => {}
  };
  function emitLife(e, p) { (lifeHandlers[e] || []).forEach((f) => { try { f(p); } catch (err) {} }); }
  const g = {
    location: { search: '' },
    requestAnimationFrame: (fn) => { world.frames.push(fn); },
    VihuPlanet: { Util: { clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
                          smooth: (t) => t * t * (3 - 2 * t) } },
    EtherDiscovery: {
      attach: () => ({ on: () => {} }),
      pickWonder: (u, near) => near ? { kind: 'wonder', id: null, x: near.x, y: near.y }
                                    : { kind: 'wonder', id: null, x: 900, y: 300 }
    },
    console: console
  };
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/etherExperience.js'), 'utf8'))(g);
  return { world, universe, life, g, emitLife };
}

for (let v = 1; v <= VISITS; v++) {
  const h = makeWorld();
  const exp = h.g.EtherExperience.mount(h.universe, h.life);
  const SCALE = 30;
  exp.setTimeScale(SCALE);
  h.world.simTime = 0;

  // The Traveller's hour: bouts of turning, watching, resting. A
  // noticed guide-creature is followed and its trail found a little
  // later; crossings leave after 30–45 composed seconds.
  let noticeQueued = null, findQueued = null;
  const frameSim = 0.04 * SCALE;
  while (h.world.simTime < 3600) {
    h.world.simTime += frameSim;
    h.world.now += 40;
    const t = h.world.simTime;
    // behaviour: alternating attention
    const bout = Math.floor(t / 47) % 4;
    h.world.stillValue = bout === 3 ? 60 : 1 + (t % 7);
    h.world.camX = Math.sin(t / 500) * 2000 + (bout === 1 ? t % 400 : 0);

    // creatures: notice most default-responders; let them leave
    if (h.world.enc) {
      const e = h.world.enc;
      const mode = e.manner.respond || 'default';
      if (mode !== 'none' && noticeQueued === null && Math.random() < 0.7) {
        noticeQueued = t + 4;
      }
      if (noticeQueued !== null && t >= noticeQueued) {
        h.emitLife('creature:noticed', { id: e.id });
        const verb = mode === 'acknowledge' ? 'acknowledge'
          : mode === 'shy' ? 'shy'
          : e.id === 'jellyfish' ? 'pulse'
          : 'guide';
        h.emitLife('creature:responded', { id: e.id, response: verb });
        if (verb === 'guide') {
          h.world.trailLive = { state: 'guiding',
            target: { kind: Math.random() < 0.6 ? 'story' : 'wonder',
                      id: 'story-' + Math.floor(Math.random() * 9),
                      x: 500, y: 300 } };
          h.emitLife('trail:begun', { target: h.world.trailLive.target });
          findQueued = t + 12 + Math.random() * 20;
        }
        noticeQueued = -1;   // spent for this crossing
      }
      if (t - e.up > 30 + (e.id.length % 3) * 8) {
        const id = e.id; h.world.enc = null; noticeQueued = null;
        h.emitLife('creature:gone', { id });
      }
    }
    if (findQueued && t >= findQueued && h.world.trailLive) {
      const tr = h.world.trailLive;
      h.world.trailLive = null; findQueued = null;
      h.emitLife('trail:found', { target: { kind: tr.target.kind, id: tr.target.id } });
    }
    const q = h.world.frames.splice(0);
    q.forEach((fn) => fn(h.world.now));
  }

  const hist = exp.history();
  console.log('\n================ VISIT ' + v + ' — one composed hour ================');
  hist.forEach((x) => console.log(
    '  ' + String(Math.round(x.t)).padStart(5) + 's  ' +
    (x.pattern + (x.family && x.pattern.indexOf(x.family) === -1 ? ':' + x.family : '')).padEnd(28) +
    '→ ' + String(x.outcome).padEnd(11) +
    '[' + x.interaction + ' / ' + x.depth + ']'));
  const pats = {};
  hist.forEach((x) => { pats[x.pattern] = (pats[x.pattern] || 0) + 1; });
  let consec = 0;
  for (let i = 1; i < hist.length; i++) if (hist[i].pattern === hist[i - 1].pattern) consec++;
  const ts = hist.map((x) => x.t);
  const gaps = []; for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
  const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
  const sd = Math.sqrt(gaps.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (gaps.length || 1));
  console.log('  —— ' + hist.length + ' experiences · patterns: ' +
    Object.keys(pats).map((k) => k + '×' + pats[k]).join(', '));
  console.log('  —— consecutive repeats: ' + consec +
    ' · gap mean ' + mean.toFixed(0) + 's · sd ' + sd.toFixed(0) +
    's · cv ' + (mean ? (sd / mean).toFixed(2) : '—'));
  console.log('  —— rare content this visit: ' +
    exp.patterns().filter((p) => p.inThisVisit === false).map((p) => p.id + ' ABSENT').join(', ') || 'all present');
  console.log('  —— anchors kept: ' + exp.anchors().length +
    ' · phase at the end: ' + exp.phase());
}
console.log('\nThree different hours from the same finite library — read them side by side.');
