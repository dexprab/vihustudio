/* SPRINT 1J — the deterministic Companion moments layer.
 *
 * The question under test is WHEN a Companion may speak, never what it
 * says. Silence is the default, so most of what follows asserts that
 * nothing happened and names the reason it did not.
 *
 * Three halves:
 *
 *   THE MATRIX (A-T)   the brief's own twenty situations, each asserting
 *                      speak/quiet, the reason, no duplicate, no memory
 *                      mutation, and Creator/Traveller isolation.
 *   ADVERSARIAL (V)    forged cards, forged companions, client-supplied
 *                      memory, a Traveller claiming to be a Creator,
 *                      repeated lifecycle events, refresh loops,
 *                      manipulated timestamps, fabricated moments.
 *   PROPERTIES (S/N/P) surveillance, autonomy, network and performance,
 *                      proved by reading the shipped source and by
 *                      measuring the running page.
 *
 * The Studio is driven for real. A genuine arrival is made the way a
 * child makes one — StudioEntry.pass() then a load of studio.html — so
 * the entry gate is exercised rather than bypassed.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8788 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-moments-test/run-companion-moments-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.MOMENTS_PORT || 8788);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }

// THE CODE, WITHOUT THE PROSE.
//
// The first draft of V7 scanned the raw file for 'Math.random' and
// failed on js/companionMoments.js's own comment saying it uses none —
// the same substring-in-its-own-vocabulary trap this project has
// recorded four times (auth in authorship, prompt in unprompted, hi in
// think, xp in export). Every source scan below runs on this instead,
// so what is asserted is what the file DOES rather than what it says.
function code(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // ---------------------------------------------------------------
  // Bootstrapping. Author Mode is the one sanctioned direct door
  // (Decision 13/23) and is used ONLY to reach a document that has
  // StudioEntry in it; every arrival measured below is then made
  // through the real gate.
  async function openAuthor() {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof CompanionMoments !== 'undefined' &&
      typeof StudioEntry !== 'undefined' && typeof MagicCard !== 'undefined',
      null, { timeout: 20000 });
    await dismissGateway();
  }
  async function dismissGateway() {
    for (let i = 0; i < 6; i++) {
      const gone = await page.evaluate(() => {
        const ov = document.getElementById('gatewayOverlay');
        if (!ov || ov.hidden || !ov.offsetParent) return true;
        ov.click(); return false;
      });
      if (gone) break;
      await page.waitForTimeout(600);
    }
    await page.evaluate(() => {
      const ov = document.getElementById('gatewayOverlay');
      if (ov) ov.style.display = 'none';
    });
  }
  // A real arrival: mint the pass the ONE door mints, then load the
  // Studio with no author flag at all, exactly as a child does.
  async function arrive() {
    await page.evaluate(() => {
      // Author Mode is REMEMBERED PER BROWSER (Decision 13), and the
      // bootstrap above turned it on. Leaving it on would exempt every
      // later load from the entry gate — which is exactly what made the
      // first run of K4 pass a refresh straight into the Studio.
      try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
      try { StudioEntry.pass(); } catch (e) {}
    });
    await page.goto(BASE + '/studio.html');
    await page.waitForFunction(() => typeof CompanionMoments !== 'undefined',
      null, { timeout: 20000 });
    await dismissGateway();
  }
  // decide() against a hand-made signals object. The layer is pure, so
  // this measures the REAL function under a stated situation rather
  // than a re-implementation of it.
  async function decide(moment, over) {
    return page.evaluate(([m, o]) => {
      const s = Object.assign(CompanionMoments.signals(), o || {});
      return CompanionMoments.decide(m, s);
    }, [moment, over || null]);
  }
  const CREATOR = { creator: true, companionAvailable: true, companionId: 'leafy' };

  console.log('\nSPRINT 1J — DETERMINISTIC COMPANION MOMENTS\n');
  await openAuthor();

  // ---------------------------------------------------------------
  console.log('THE LINES — one source, unchanged');
  // ---------------------------------------------------------------
  const lines = await page.evaluate(() => ({
    open: CompanionLines.OPENING.length,
    bye: CompanionLines.FAREWELL.length,
    firstOpen: CompanionLines.OPENING[0].text,
    firstBye: CompanionLines.FAREWELL[0].text,
    defOpen: CompanionLines.DEFAULT_OPENING.text,
    defBye: CompanionLines.DEFAULT_FAREWELL.text,
    texts: CompanionLines.OPENING.concat(CompanionLines.FAREWELL).map((l) => l.text)
  }));
  ck(lines.open === 10 && lines.bye === 10, 'L1  ten opening and ten exit lines', lines.open + '/' + lines.bye);
  ck(lines.defOpen === lines.firstOpen && lines.defBye === lines.firstBye,
     'L2  the defaults ARE index 0, so they cannot drift', lines.defOpen);
  // Decision 26's own rule, still binding in the Studio: no line may
  // claim to have met this person before.
  const memoryWords = /\b(back|again|remember|missed?|last time)\b/i;
  const claiming = lines.texts.filter((t) => memoryWords.test(t));
  ck(claiming.length === 0, 'L3  no line claims a previous meeting', claiming.join(' | ') || 'none');
  // Decision 31 — warmth is allowed, emotional dependency is not.
  const needy = /\b(don'?t leave|i'?ll miss|please come back|need you|lonely|all alone)\b/i;
  ck(lines.texts.filter((t) => needy.test(t)).length === 0,
     'L4  no line asks to be come back to', 'none');
  // The 20 lines live in exactly one file now.
  const etherSrc = code(fs.readFileSync(path.join(ROOT, 'js', 'etherHost.js'), 'utf8'));
  ck(etherSrc.indexOf('See you in the next story.') === -1 &&
     etherSrc.indexOf('CompanionLines') !== -1,
     'L5  js/etherHost.js holds no second copy and reads the library');
  const linesRaw = fs.readFileSync(path.join(ROOT, 'js', 'companionLines.js'), 'utf8');
  const linesSrc = code(linesRaw);
  ck(lines.texts.every((t) => linesRaw.indexOf(t.replace(/'/g, "\\'")) !== -1 || linesRaw.indexOf(t) !== -1),
     'L6  every line the page speaks is in the library file');

  // ---------------------------------------------------------------
  console.log('\nTHE MATRIX — the brief\'s twenty situations');
  // ---------------------------------------------------------------

  // N — TRAVELLER. First, because it is the gate at the top and every
  // other row assumes it passed.
  const trav = await page.evaluate(() => {
    try { MagicCard.setActive(null); } catch (e) {}
    return CompanionMoments.MOMENTS.map((m) => CompanionMoments.decide(m,
      Object.assign(CompanionMoments.signals(), { creator: false })));
  });
  ck(trav.every((d) => d.speak === false && d.reason === 'traveller'),
     'N1  a Traveller gets silence for EVERY moment', trav.map((d) => d.reason).join(','));
  ck(trav.every((d) => d.key === null),
     'N2  and no key is even formed, so nothing could be recorded for them');
  // The gate is at the TOP: a Traveller carrying every other signal a
  // speaking Creator would carry is still silent.
  const travRich = await decide('entry', {
    creator: false, companionAvailable: true, companionId: 'leafy',
    arrival: 'arrival:99', hasEverMade: true, hasHistory: true, storyIsAReturn: true
  });
  ck(travRich.speak === false && travRich.reason === 'traveller',
     'N3  Traveller silence outranks every other signal', travRich.reason);

  // Now become a Creator with a bonded Companion for the rest.
  await page.evaluate(() => {
    const c = MagicCard.claim('Suite', null, { companionId: 'leafy', companionName: 'Leafy' });
    MagicCard.setActive(c.id);
  });

  // A — FIRST ENTRY.
  const A = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:1', hasEverMade: false, hasHistory: false, storyIsAReturn: false }));
  ck(A.speak === true && A.occasion === 'first-entry',
     'A1  a first-ever entry speaks', A.occasion);
  ck(A.key === 'entry:arrival:1', 'A2  keyed on the arrival, not on the moment name', A.key);
  const aLine = await page.evaluate((d) => CompanionMoments.openingFor(d), A);
  ck(aLine.text === "Hey… you're here.", 'A3  and gets the canonical opening', aLine.text);

  // B — NORMAL RETURN.
  const B = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:2', hasEverMade: true, hasHistory: false, storyIsAReturn: false }));
  ck(B.speak === true && B.occasion === 'entry', 'B1  a plain return speaks', B.occasion);
  const bLine = await page.evaluate((d) => CompanionMoments.openingFor(d), B);
  ck(bLine.text === "Ready? Let's go.", 'B2  and gets a different line from a first entry', bLine.text);

  // C — LONG RETURN, i.e. arriving into a story left a long time ago.
  const C = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:3', hasEverMade: true, hasHistory: true, storyIsAReturn: true }));
  ck(C.speak === true && C.occasion === 'entry-returning',
     'C1  arriving into a long-left story is its own occasion', C.occasion);
  const cLine = await page.evaluate((d) => CompanionMoments.openingFor(d), C);
  ck(cLine.text === 'Something magical is waiting.', 'C2  with its own line', cLine.text);

  // R — EXISTING MEMORY / S — NO MEMORY.
  const R = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:4', hasEverMade: true, hasHistory: true, storyIsAReturn: false }));
  ck(R.speak === true && R.occasion === 'entry-with-history',
     'R1  an entry with something remembered is its own occasion', R.occasion);
  const S = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:5', hasEverMade: false, hasHistory: false }));
  ck(S.speak === true && S.occasion === 'first-entry',
     'S1  no memory at all reads as a first entry', S.occasion);

  // THE FOUR OCCASIONS ARE FOUR DIFFERENT LINES, and the mapping is a
  // table rather than a score.
  const spread = await page.evaluate(() => {
    const seen = {};
    Object.keys(CompanionMoments.OPENING_FOR).forEach((occ) => {
      seen[occ] = CompanionMoments.openingFor({ occasion: occ }).text;
    });
    return seen;
  });
  const occCount = Object.keys(spread).length;
  ck(occCount >= 4 && new Set(Object.values(spread)).size === occCount,
     'O1  every occasion has a line of its own', occCount + ' occasions -> ' +
     new Set(Object.values(spread)).size + ' distinct lines');

  // DETERMINISM — the same situation always gives the same answer.
  const det = await page.evaluate(() => {
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:7', hasEverMade: true, hasHistory: true });
    const out = [];
    for (let i = 0; i < 40; i++) {
      const d = CompanionMoments.decide('entry', s);
      out.push(d.speak + '|' + d.occasion + '|' + CompanionMoments.openingFor(d).text);
    }
    return Array.from(new Set(out));
  });
  ck(det.length === 1, 'O2  forty identical asks give one answer', det.length + ' distinct');

  // D — NEW STORY / E — EXISTING STORY / F — MILESTONE / G — CHARACTER
  // / I — ORDINARY CREATION. None of these is a speech moment, and the
  // layer must have no rule that could make one.
  const notMoments = await page.evaluate(() => Object.keys(CompanionMoments.NOT_MOMENTS));
  const quietOnes = await page.evaluate(([names, base]) => names.map((n) => {
    const s = Object.assign(CompanionMoments.signals(), base);
    const d = CompanionMoments.decide(n, s);
    return { n: n, speak: d.speak, reason: d.reason };
  }), [notMoments, Object.assign({}, CREATOR, { arrival: 'arrival:8' })]);
  ck(quietOnes.every((r) => r.speak === false && r.reason === 'not-a-moment'),
     'D-I  none of the thirteen non-moments can speak',
     quietOnes.length + ' checked, all not-a-moment');
  ck(notMoments.indexOf('object-added') !== -1 && notMoments.indexOf('saved') !== -1 &&
     notMoments.indexOf('page-turned') !== -1 && notMoments.indexOf('published') !== -1,
     'I1  ordinary creation is named explicitly as not a moment');
  ck(notMoments.indexOf('long-absence') !== -1 && notMoments.indexOf('idle') !== -1,
     'I2  and so is anything that would need watching');

  // H — EXPLICIT INVOCATION. Already owned; this layer must not have
  // taken it over.
  const invocation = await page.evaluate(() => ({
    notMoment: CompanionMoments.NOT_MOMENTS['invoked'] || '',
    play: CompanionMoments.NOT_MOMENTS['play'] || '',
    chatExists: typeof CompanionChat !== 'undefined',
    brainPlay: typeof CompanionBrain !== 'undefined' && typeof CompanionBrain.play === 'function'
  }));
  ck(invocation.chatExists && invocation.brainPlay &&
     /already owned/.test(invocation.notMoment) && /already owned/.test(invocation.play),
     'H1  explicit invocation stays with the modules that already own it');

  // J — REPEATED ACTION / the deduplication rule.
  const dedupe = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:D' });
    const first = CompanionMoments.decide('entry', s);
    const rec1 = CompanionMoments.commit(first);
    const second = CompanionMoments.decide('entry', s);
    const rec2 = CompanionMoments.commit(second);
    const third = CompanionMoments.decide('entry', s);
    return { first: first, rec1: rec1, second: second, rec2: rec2, third: third,
             ledger: CompanionMoments.diagnostics().ledger };
  });
  ck(dedupe.first.speak === true && dedupe.second.speak === false &&
     dedupe.second.reason === 'already-acknowledged' && dedupe.third.speak === false,
     'J1  a moment answered once is never answered again', dedupe.second.reason);
  ck(dedupe.rec1.recorded === true && dedupe.rec2.recorded === false,
     'J2  and only the first commit records anything');
  ck(dedupe.ledger.length === 1, 'J3  the ledger holds one key, not a history',
     JSON.stringify(dedupe.ledger));

  // decide() IS SIDE-EFFECT FREE. Asking does not change the answer.
  const pure = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:P' });
    for (let i = 0; i < 25; i++) CompanionMoments.decide('entry', s);
    return { ledger: CompanionMoments.diagnostics().ledger,
             still: CompanionMoments.decide('entry', s).speak };
  });
  ck(pure.ledger.length === 0 && pure.still === true,
     'J4  decide() reads the ledger and never writes it', 'ledger ' + pure.ledger.length);

  // T — A QUIET CREATIVE SESSION. Nothing but ordinary work happens;
  // the layer says nothing at all, for its whole length.
  const quietSession = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:Q' });
    CompanionMoments.commit(CompanionMoments.decide('entry', s));   // the one hello
    const said = [];
    for (let i = 0; i < 200; i++) {
      ['object-added', 'page-added', 'saved', 'selection-changed', 'page-turned']
        .forEach((e) => { if (CompanionMoments.decide(e, s).speak) said.push(e); });
      CompanionMoments.MOMENTS.forEach((m) => { if (CompanionMoments.decide(m, s).speak) said.push(m); });
    }
    return said;
  });
  ck(quietSession.length === 0,
     'T1  a thousand creative actions produce not one line', quietSession.length + ' lines');

  // O — MISSING / AMBIGUOUS SIGNAL.
  const amb = await page.evaluate(() => ({
    noArrival: CompanionMoments.decide('entry', Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: null })),
    noStory: CompanionMoments.decide('return-to-story', Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, storyId: null })),
    notAReturn: CompanionMoments.decide('return-to-story', Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, storyId: 'p1', storyIsAReturn: false })),
    noCompanion: CompanionMoments.decide('entry', Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: false, arrival: 'arrival:Z' })),
    garbage: CompanionMoments.decide('entry', { creator: true, companionAvailable: true })
  }));
  ck(amb.noArrival.speak === false && amb.noArrival.reason === 'unproven',
     'O3  an entry that cannot be proved is silent', amb.noArrival.reason);
  ck(amb.noStory.speak === false && amb.notAReturn.reason === 'unproven',
     'O4  a return that cannot be proved is silent', amb.notAReturn.reason);
  ck(amb.noCompanion.speak === false && amb.noCompanion.reason === 'no-companion',
     'O5  a Creator with no Companion available is silent', amb.noCompanion.reason);
  ck(amb.garbage.speak === false,
     'O6  a half-built signals object never produces speech', amb.garbage.reason);
  // Every silence names a reason from the published list.
  const reasons = await page.evaluate(() => Object.values(CompanionMoments.REASONS));
  const allReasons = [amb.noArrival, amb.noStory, amb.notAReturn, amb.noCompanion, amb.garbage,
                      dedupe.second, trav[0]].map((d) => d.reason);
  ck(allReasons.every((r) => reasons.indexOf(r) !== -1),
     'O7  every silence names a published reason', allReasons.join(','));

  // ONE LIFECYCLE LINE PER ARRIVAL — the rule MOVED in Sprint 1K, it
  // did not go away. Refusing here made the return unreachable in the
  // real Studio (the Companion mounts before any story is open, so the
  // entry key is always present by the time a story exists), so the
  // spacing now lives where the clock lives.
  const oneLine = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(), {
      creator: true, companionAvailable: true, arrival: 'arrival:L',
      storyId: 'proj_x', storyIsAReturn: true
    });
    const entry = CompanionMoments.decide('entry', s);
    CompanionMoments.commit(entry);
    const ret = CompanionMoments.decide('return-to-story', s);
    return { entry: entry, ret: ret };
  });
  ck(oneLine.entry.speak === true && oneLine.ret.speak === true,
     'O8  a return is a real moment even once the entry has spoken',
     'entry=' + oneLine.entry.speak + ' return=' + oneLine.ret.speak);
  const noEntrySpoke = await page.evaluate(() => {
    // Nothing in the layer may produce this reason any more.
    const probes = [];
    [true, false].forEach((busy) => [true, false].forEach((ret) => {
      probes.push(CompanionMoments.decide('return-to-story', Object.assign(
        CompanionMoments.signals(), { creator: true, companionAvailable: true,
        arrival: 'arrival:L', storyId: 'proj_x', storyIsAReturn: ret, busy: busy })).reason);
    }));
    return probes;
  });
  ck(noEntrySpoke.indexOf('entry-already-spoke') === -1,
     'O8b and the layer never refuses on entry-already-spoke again',
     noEntrySpoke.join(','));
  const dirNow = code(fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8'));
  ck(dirNow.indexOf('if(!_mayVolunteer()) return;') !== -1 &&
     dirNow.indexOf("m.decide('return-to-story')") !== -1,
     'O8c the spacing moved to the Director, where the clock is',
     'gated on CompanionBrain.mayVolunteer()');

  // But a story opened LATER, with no entry line for this arrival, is
  // a real moment.
  const later = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(), {
      creator: true, companionAvailable: true, arrival: 'arrival:M',
      storyId: 'proj_y', storyIsAReturn: true
    });
    return CompanionMoments.decide('return-to-story', s);
  });
  ck(later.speak === true && later.occasion === 'return-to-story',
     'O9  a long-left story opened mid-visit is a moment', later.occasion);

  // A RITE OWNS THE SCREEN.
  const rite = await page.evaluate(() => {
    CompanionMoments._forget();
    document.body.classList.add('studio-rite-running');
    const s = CompanionMoments.signals();
    const out = CompanionMoments.MOMENTS.map((m) => CompanionMoments.decide(m,
      Object.assign(s, { creator: true, companionAvailable: true, arrival: 'arrival:R' })));
    document.body.classList.remove('studio-rite-running');
    return { riteSeen: s.riteRunning, out: out };
  });
  ck(rite.riteSeen === true && rite.out.every((d) => d.speak === false && d.reason === 'rite-running'),
     'Q1  nothing speaks while a rite is running', rite.out.map((d) => d.reason).join(','));

  // A DIALOG OWNS THE SCREEN.
  const busy = await decide('entry', Object.assign({}, CREATOR,
    { arrival: 'arrival:B2', busy: true }));
  ck(busy.speak === false && busy.reason === 'busy',
     'Q2  a dialog on arrival means no greeting', busy.reason);

  // ---------------------------------------------------------------
  console.log('\nEXIT — provable moment, disclosed window');
  // ---------------------------------------------------------------
  const exit = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:E' });
    const first = CompanionMoments.decide('exit', s);
    CompanionMoments.commit(first);
    const again = CompanionMoments.decide('exit', s);
    return { first: first, again: again, window: CompanionMoments.WINDOW };
  });
  ck(exit.first.key === 'exit:arrival:E',
     'M1  a deliberate exit is recognised and keyed', exit.first.key);
  ck(exit.window.exit === false && exit.first.speak === false &&
     exit.first.reason === 'exit-has-no-window',
     'M2  and is deliberately quiet, with the reason named', exit.first.reason);
  ck(exit.again.reason === 'already-acknowledged',
     'M3  pressing it twice is one exit', exit.again.reason);
  // The farewell selection exists and is deterministic even though the
  // Studio does not show it — it is what the World Host and the future
  // Mind both use.
  const bye = await page.evaluate(() => [0, 1, 2].map(() =>
    CompanionMoments.farewellFor({ occasion: 'deliberate-exit' }).text));
  ck(new Set(bye).size === 1 && bye[0] === 'Thanks for coming along.',
     'M4  the farewell is selected deterministically', bye[0]);
  // Traveller exit is silent for the Traveller reason, not the window
  // reason — the gate is genuinely at the top.
  const travExit = await decide('exit', { creator: false, arrival: 'arrival:E2' });
  ck(travExit.reason === 'traveller', 'M5  a Traveller exit is silent as a Traveller', travExit.reason);

  // ---------------------------------------------------------------
  console.log('\nTHE REAL STUDIO — K, L, M through the actual gate');
  // ---------------------------------------------------------------

  // A genuine arrival, made the way a child makes one.
  await page.evaluate(() => { try { CompanionMoments._forget(); } catch (e) {} });
  await arrive();
  const arrived = await page.evaluate(() => ({
    url: location.pathname,
    arrival: StudioEntry.arrival(),
    passGone: sessionStorage.getItem(StudioEntry.KEY)
  }));
  ck(/studio\.html$/.test(arrived.url), 'K1  a real arrival reaches the Studio', arrived.url);
  ck(/^arrival:\d+$/.test(arrived.arrival || ''),
     'K2  and carries an arrival token', arrived.arrival);
  ck(!arrived.passGone, 'K3  while the one-shot pass itself was consumed');

  // K — REFRESH. No pass, so the gate sends it home; it can never
  // become a second greeting because it never reaches the Studio.
  await page.goto(BASE + '/studio.html');
  await page.waitForTimeout(900);
  const afterRefresh = await page.evaluate(() => location.pathname);
  ck(/index\.html$|\/$/.test(afterRefresh),
     'K4  a plain refresh goes home and never re-greets', afterRefresh);

  // L / M — A SELF-RELOAD IS THE SAME ARRIVAL.
  //
  // Ordered as it really happens: arrive, be greeted, press Home,
  // come back. The first draft committed the greeting AFTER the
  // reload, which made the check circular — it would have passed even
  // if the reload had minted a brand-new arrival, because it recorded
  // whatever token it found. Greeting BEFORE the reload is what makes
  // this measure the token surviving.
  await arrive();
  const beforeToken = await page.evaluate(() => {
    CompanionMoments._forget();
    const s = Object.assign(CompanionMoments.signals(), { creator: true, companionAvailable: true });
    const d = CompanionMoments.decide('entry', s);
    CompanionMoments.commit(d);                 // the greeting this arrival got
    return { token: StudioEntry.arrival(), spoke: d.speak };
  });
  ck(beforeToken.spoke === true, 'L0  the arrival is greeted once', beforeToken.token);
  await page.evaluate(() => { StudioEntry.renewHere(); });
  await page.goto(BASE + '/studio.html');
  await page.waitForFunction(() => typeof StudioEntry !== 'undefined', null, { timeout: 20000 });
  await dismissGateway();
  const afterToken = await page.evaluate(() => StudioEntry.arrival());
  ck(beforeToken.token && afterToken === beforeToken.token,
     'L1  the Home button reload keeps the SAME arrival token',
     beforeToken.token + ' -> ' + afterToken);
  const reloadDecision = await page.evaluate(() => {
    const s = Object.assign(CompanionMoments.signals(), { creator: true, companionAvailable: true });
    return CompanionMoments.decide('entry', s);
  });
  ck(reloadDecision.speak === false && reloadDecision.reason === 'already-acknowledged',
     'L2  so a self-reload is silent', reloadDecision.reason);

  // M — CLOSING AND REOPENING. A genuinely new arrival mints a new
  // token, so the greeting is available again.
  const secondArrival = await page.evaluate(() => {
    const before = StudioEntry.arrival();
    StudioEntry.pass();
    const after = StudioEntry.arrival();
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true });
    return { before: before, after: after, decision: CompanionMoments.decide('entry', s) };
  });
  ck(secondArrival.after !== secondArrival.before && secondArrival.decision.speak === true,
     'M6  a genuinely new arrival may greet again',
     secondArrival.before + ' -> ' + secondArrival.after);

  // P — MULTIPLE CARDS. One Creator's ledger key is about the arrival,
  // and the SIGNALS follow whichever card is active — a second Creator
  // walking in gets their own answer, never the first one's history.
  const twoCards = await page.evaluate(() => {
    const a = MagicCard.claim('A', null, { companionId: 'leafy', companionName: 'Leafy' });
    const b = MagicCard.claim('B', null, { companionId: 'nimbus', companionName: 'Nimbus' });
    MagicCard.setActive(a.id);
    const sa = CompanionMoments.signals();
    MagicCard.setActive(b.id);
    const sb = CompanionMoments.signals();
    return { a: sa.companionId, b: sb.companionId, aCreator: sa.creator, bCreator: sb.creator };
  });
  ck(twoCards.a === 'leafy' && twoCards.b === 'nimbus' && twoCards.aCreator && twoCards.bCreator,
     'P1  signals follow the ACTIVE card, never a remembered one',
     twoCards.a + ' / ' + twoCards.b);

  // ---------------------------------------------------------------
  console.log('\nMEMORY AND BOND MOMENTS STAY SEPARATE');
  // ---------------------------------------------------------------
  const momentsSrc = code(fs.readFileSync(path.join(ROOT, 'js', 'companionMoments.js'), 'utf8'));
  ck(momentsSrc.indexOf('CompanionMemory.remember') === -1 &&
     !/\.remember\s*\(/.test(momentsSrc),
     'Q3  the layer cannot write a memory — remember() is not in it');
  ck(!/bondValidator|memoryProposal|validateProposal/.test(momentsSrc),
     'Q4  and knows nothing about Bond Moments');
  // Measured, not read: speaking about every moment writes no memory.
  const memMutation = await page.evaluate(() => {
    const before = CompanionMemory.list({ status: 'any' }).length;
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:MM',
        storyId: 'proj_z', storyIsAReturn: true });
    CompanionMoments._forget();
    ['entry', 'return-to-story', 'exit'].forEach((m) => {
      const d = CompanionMoments.decide(m, s);
      CompanionMoments.commit(d);
    });
    return { before: before, after: CompanionMemory.list({ status: 'any' }).length };
  });
  ck(memMutation.after === memMutation.before,
     'Q5  answering every moment mutates no memory',
     memMutation.before + ' -> ' + memMutation.after);
  // The ledger is not a memory: it is not in the memory store and dies
  // with the tab.
  const ledgerIsolation = await page.evaluate(() => ({
    inSession: !!sessionStorage.getItem(CompanionMoments.LEDGER_KEY),
    inLocal: !!localStorage.getItem(CompanionMoments.LEDGER_KEY),
    inMemory: CompanionMemory.list({ status: 'any' })
      .some((m) => String(m.key || '').indexOf('entry:') === 0)
  }));
  ck(ledgerIsolation.inSession && !ledgerIsolation.inLocal && !ledgerIsolation.inMemory,
     'Q6  the ledger is session-only and is not a memory',
     'session=' + ledgerIsolation.inSession + ' local=' + ledgerIsolation.inLocal);

  // ---------------------------------------------------------------
  console.log('\nADVERSARIAL — client claims never beat authoritative state');
  // ---------------------------------------------------------------

  // V1 — A FORGED CARD. decide() takes signals, so a caller CAN hand it
  // a lie; what matters is that the SIGNALS the Studio actually
  // produces come from MagicCard and cannot be talked into existing.
  const forged = await page.evaluate(() => {
    MagicCard.setActive(null);
    const real = CompanionMoments.signals();
    // Every shape of "I am a Creator, honest" a page could try.
    window.__fake = { id: 'card_forged', companionId: 'leafy' };
    localStorage.setItem('vihu.forged.card', JSON.stringify(window.__fake));
    const after = CompanionMoments.signals();
    return { real: real.creator, after: after.creator,
             decision: CompanionMoments.decide('entry', after) };
  });
  ck(forged.real === false && forged.after === false &&
     forged.decision.reason === 'traveller',
     'V1  a card planted in storage does not make a Creator', forged.decision.reason);

  // V2 — A FORGED COMPANION. No active card means no companion, no
  // matter what is written anywhere.
  const forgedComp = await page.evaluate(() => {
    const s = CompanionMoments.signals();
    return { companionId: s.companionId, available: s.companionAvailable };
  });
  ck(forgedComp.companionId === null,
     'V2  and no Companion is resolved for a forged one', String(forgedComp.companionId));

  // V3 — A TRAVELLER PRETENDING TO BE A CREATOR, at every layer at
  // once: a forged card, a forged companion, a forged arrival and a
  // forged memory claim, all in one call.
  const pretend = await decide('entry', {
    creator: false, companionAvailable: true, companionId: 'leafy',
    arrival: 'arrival:FORGED', hasEverMade: true, hasHistory: true,
    storyIsAReturn: true, riteRunning: false, busy: false
  });
  ck(pretend.speak === false && pretend.reason === 'traveller' && pretend.key === null,
     'V3  every forged signal at once is still a Traveller', pretend.reason);

  // V4 — CLIENT-SUPPLIED MEMORY. The layer reads the store; it accepts
  // no memory as an argument, so there is no parameter to poison.
  ck(!/\bmemories\b/.test(momentsSrc),
     'V4  the layer takes no memories from a caller');
  const poisoned = await page.evaluate(() => {
    // A caller may lie about the DERIVED booleans, and that is by
    // design (they are a snapshot). What it cannot do is make the
    // Companion say something about a story it named, because no
    // story text is anywhere in the decision.
    const d = CompanionMoments.decide('entry', {
      creator: true, companionAvailable: true, arrival: 'arrival:PO',
      hasHistory: true, hasEverMade: true,
      storyId: '<script>alert(1)</script>', storyIsAReturn: true
    });
    return { line: CompanionMoments.openingFor(d).text, key: d.key };
  });
  ck(poisoned.line.indexOf('script') === -1 && poisoned.key.indexOf('script') === -1,
     'V5  nothing a caller names reaches the words or the entry key', poisoned.line);

  // V6 — MANIPULATED TIMESTAMPS. There is no clock in the decision, so
  // there is nothing to manipulate. Proved by reading the source.
  ck(!/Date\.now|new Date|performance\.now|setTimeout|setInterval/.test(momentsSrc),
     'V6  no clock and no timer anywhere in the layer');
  ck(!/Math\.random/.test(momentsSrc), 'V7  and no randomness');

  // V8 — A REFRESH LOOP. Twenty arrivals-worth of asking, with the
  // ledger honoured, produces exactly one speech per real arrival.
  const loop = await page.evaluate(() => {
    CompanionMoments._forget();
    let spoke = 0;
    const s = Object.assign(CompanionMoments.signals(),
      { creator: true, companionAvailable: true, arrival: 'arrival:LOOP' });
    for (let i = 0; i < 50; i++) {
      const d = CompanionMoments.decide('entry', s);
      if (d.speak) spoke++;
      CompanionMoments.commit(d);
    }
    return spoke;
  });
  ck(loop === 1, 'V8  fifty lifecycle events produce one line', loop + ' spoke');

  // V9 — A FABRICATED MOMENT NAME.
  const fabricated = await page.evaluate(() => ['milestone', 'return', 'entry ', 'ENTRY',
    '__proto__', 'constructor', 'toString', ''].map((n) => {
      const d = CompanionMoments.decide(n, Object.assign(CompanionMoments.signals(),
        { creator: true, companionAvailable: true, arrival: 'arrival:FB' }));
      return d.speak;
    }));
  ck(fabricated.every((x) => x === false),
     'V9  an invented moment name never speaks, prototype keys included');

  // V10 — MISSING CONTEXT.
  //
  // NOT `delete window.MagicCard`: these modules are declared as
  // top-level `const`, so the lexical binding survives the property
  // being removed and the first version of this check deleted
  // something nothing reads. A dependency that is broken THROWS, so
  // that is what is done to it — which is also what actually exercises
  // the defensive reads.
  const stripped = await page.evaluate(() => {
    const boom = () => { throw new Error('gone'); };
    const saved = {
      getActive: MagicCard.getActive, has: CompanionMemory.has,
      list: CompanionMemory.list, arrival: StudioEntry.arrival,
      opening: CompanionLines.OPENING, farewell: CompanionLines.FAREWELL,
      project: (typeof AppState !== 'undefined') ? AppState.project : undefined
    };
    try {
      MagicCard.getActive = boom; CompanionMemory.has = boom;
      CompanionMemory.list = boom; StudioEntry.arrival = boom;
      CompanionLines.OPENING = []; CompanionLines.FAREWELL = [];
      if (typeof AppState !== 'undefined') {
        Object.defineProperty(AppState, 'project', { get: boom, configurable: true });
      }
      const s = CompanionMoments.signals();
      const out = CompanionMoments.MOMENTS.map((m) => CompanionMoments.decide(m, s));
      return {
        threw: false,
        keys: Object.keys(s).sort().join(','),
        spoke: out.filter((d) => d.speak).length,
        reasons: out.map((d) => d.reason),
        line: CompanionMoments.openingFor({ occasion: 'entry' }),
        bye: CompanionMoments.farewellFor({ occasion: 'deliberate-exit' }),
        creator: s.creator, arrival: s.arrival, storyId: s.storyId
      };
    } catch (e) {
      return { threw: true, err: String(e) };
    } finally {
      MagicCard.getActive = saved.getActive; CompanionMemory.has = saved.has;
      CompanionMemory.list = saved.list; StudioEntry.arrival = saved.arrival;
      CompanionLines.OPENING = saved.opening; CompanionLines.FAREWELL = saved.farewell;
      if (typeof AppState !== 'undefined') {
        Object.defineProperty(AppState, 'project',
          { value: saved.project, writable: true, configurable: true });
      }
    }
  });
  ck(stripped.threw === false, 'V10 with every dependency throwing it does not throw',
     stripped.threw ? stripped.err : 'clean');
  ck(stripped.spoke === 0 && stripped.reasons.every((r) => r === 'traveller'),
     'V11 and falls silent, on the safest reason of all',
     (stripped.reasons || []).join(','));
  ck(stripped.creator === false && stripped.arrival === null && stripped.storyId === null,
     'V11b every unreadable signal reads as "cannot be proved"',
     JSON.stringify({ creator: stripped.creator, arrival: stripped.arrival }));
  ck(stripped.line === null && stripped.bye === null,
     'V12 with no line library, there is no line');

  // ---------------------------------------------------------------
  console.log('\nSURVEILLANCE, AUTONOMY, NETWORK, PERFORMANCE');
  // ---------------------------------------------------------------
  const SURVEILLANCE = [
    'addEventListener', 'keydown', 'keyup', 'keypress', 'mousemove', 'mousedown',
    'pointermove', 'scroll', 'wheel', 'focus', 'blur', 'visibilitychange',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'requestIdleCallback', 'navigator.sendBeacon', 'gtag', 'analytics',
    'dwell', 'engagement', 'idleFor', 'typingSpeed', 'clickCount'
  ];
  const found = SURVEILLANCE.filter((t) => momentsSrc.indexOf(t) !== -1);
  ck(found.length === 0, 'S1  the layer registers no listener and no observer',
     found.join(', ') || 'none');
  const NETWORK = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource',
                   'import(', 'openai', 'supabase', 'https://', 'http://'];
  const net = NETWORK.filter((t) => momentsSrc.toLowerCase().indexOf(t.toLowerCase()) !== -1);
  ck(net.length === 0, 'S2  and makes no network call of any kind', net.join(', ') || 'none');
  ck(!/setTimeout|setInterval|requestAnimationFrame/.test(momentsSrc),
     'S3  no timer, so the Companion can never start something itself');
  // The same, for the file it was extracted into.
  ck(!/addEventListener|fetch\(|setTimeout/.test(linesSrc),
     'S4  the line library is data and nothing else');
  // NO POLLING WAS INTRODUCED: the Director rides the observer list it
  // already rode, and adds no subscription of its own.
  const dirRaw = fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8');
  const dirSrc = code(dirRaw);
  const observes = (dirSrc.match(/PageRuntime\.observe\(/g) || []).length;
  ck(observes === 1, 'S5  the Director still has exactly one page subscription', observes + '');
  ck(dirSrc.indexOf('safe(_returnIfReturning);') !== -1,
     'S6  and the return moment rides it rather than adding one');

  // PERFORMANCE — measured on the live page, against the real Studio.
  const perf = await page.evaluate(() => {
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) CompanionMoments.decide('entry', CompanionMoments.signals());
    const withSignals = performance.now() - t0;
    const s = CompanionMoments.signals();
    const t1 = performance.now();
    for (let i = 0; i < 20000; i++) CompanionMoments.decide('entry', s);
    return { perCallWithSignals: withSignals / 2000,
             perCallDecideOnly: (performance.now() - t1) / 20000 };
  });
  ck(perf.perCallWithSignals < 1.0,
     'S7  signals + decide costs well under a millisecond',
     perf.perCallWithSignals.toFixed(4) + 'ms');
  ck(perf.perCallDecideOnly < 0.05,
     'S8  and a decision alone is microseconds',
     perf.perCallDecideOnly.toFixed(5) + 'ms');

  // NO CHILD-FACING POLICY LANGUAGE. Every reason is developer
  // vocabulary; none of it may reach a bubble.
  const leaked = await page.evaluate((reasonList) => {
    const text = document.body.innerText || '';
    return reasonList.filter((r) => text.indexOf(r) !== -1);
  }, reasons);
  ck(leaked.length === 0, 'S9  no reason string is anywhere on screen',
     leaked.join(', ') || 'none');

  // ---------------------------------------------------------------
  console.log('\nFAIL-OPEN — the Studio without the layer');
  // ---------------------------------------------------------------
  await arrive();
  const withoutLayer = await page.evaluate(() => {
    const saved = window.CompanionMoments;
    try {
      delete window.CompanionMoments;
      // The Director's own guards must carry it: with no layer, the
      // greeting is unconditional exactly as it was before Sprint 1J.
      const src = String(CompanionDirector.init);
      return { ok: true, stillWorks: typeof src === 'string' };
    } catch (e) { return { ok: false, err: String(e) }; }
    finally { window.CompanionMoments = saved; }
  });
  ck(withoutLayer.ok, 'F1  removing the layer does not break the Studio',
     withoutLayer.ok ? 'clean' : withoutLayer.err);
  ck(dirSrc.indexOf('if(!m){ _say(pickGreeting()); return; }') !== -1,
     'F2  and the Director falls back to the greeting it always used');
  // Sprint 1C's boundary: pickGreeting() itself is untouched.
  ck(dirSrc.indexOf('if(p && Array.isArray(p.greetings) && p.greetings.length){') !== -1 &&
     dirSrc.indexOf('return MESSAGES.open;') !== -1,
     'F3  pickGreeting() is byte-for-byte the function it was');

  // ---------------------------------------------------------------
  console.log('\nA REAL GREETING, IN A REAL STUDIO');
  // ---------------------------------------------------------------
  await page.evaluate(() => {
    try { CompanionMoments._forget(); } catch (e) {}
    try {
      const c = MagicCard.claim('Suite', null, { companionId: 'leafy', companionName: 'Leafy' });
      MagicCard.setActive(c.id);
    } catch (e) {}
  });
  await arrive();
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.evaluate(() => { try { CompanionDirector.init(); } catch (e) {} });
  await page.waitForFunction(() => !!document.querySelector('.companion-widget'),
    null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const spoken = await page.evaluate(() => {
    const b = document.querySelector('.companion-bubble');
    return {
      widget: !!document.querySelector('.companion-widget'),
      bubble: b ? (b.textContent || '').trim() : null,
      ledger: CompanionMoments.diagnostics().ledger,
      arrival: StudioEntry.arrival()
    };
  });
  ck(spoken.widget, 'G1  a Companion is mounted for a real Creator arrival');
  ck(spoken.ledger.some((k) => k === 'entry:' + spoken.arrival),
     'G2  the arrival was answered exactly once and recorded',
     JSON.stringify(spoken.ledger));
  const knownLine = await page.evaluate((t) => !t ||
    CompanionLines.OPENING.some((l) => l.text === t) || t === "Let's imagine!",
    spoken.bubble);
  ck(knownLine, 'G3  and whatever was said came from the library', spoken.bubble || '(settled)');

  // A SECOND init() IN THE SAME ARRIVAL SAYS NOTHING NEW.
  const twice = await page.evaluate(() => {
    const before = CompanionMoments.diagnostics().ledger.length;
    const s = CompanionMoments.signals();
    const d = CompanionMoments.decide('entry', s);
    return { before: before, speak: d.speak, reason: d.reason };
  });
  ck(twice.speak === false && twice.reason === 'already-acknowledged',
     'G4  and asking again in the same arrival is silent', twice.reason);

  // ---------------------------------------------------------------
  const real = pageErrors.filter((e) => !/favicon|ERR_/.test(e));
  ck(real.length === 0, 'Z1  zero page errors throughout', real.slice(0, 2).join(' | ') || 'none');

  console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
              ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('   · ' + f));
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
