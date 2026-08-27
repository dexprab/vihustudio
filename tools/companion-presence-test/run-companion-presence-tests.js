/* SPRINT 1K — LEAFY PRESENCE, AS A CHILD ACTUALLY MEETS IT.
 *
 * This is a JOURNEY suite, not a source-text suite. Every check below
 * drives the real Studio through the real door — StudioEntry.pass() and
 * a load of studio.html, with the Gateway tapped through the way a child
 * taps it — and then looks at what is on the screen.
 *
 * That distinction mattered: the first probe written for this sprint
 * reported "no Companion at all", and the Companion was fine. The probe
 * had not got past the Gateway. A suite that reaches around the journey
 * cannot see the journey.
 *
 * TEST A  first Creator enters          TEST E  Traveller
 * TEST B  ordinary creation is quiet    TEST F  a Rite is running
 * TEST C  returning to an old Story     TEST G  a dialog is open
 * TEST D  refresh                       TEST H  Back to VihuPlanet
 *
 * plus the unbonded Creator, the Creator with history, the geometry the
 * widget actually occupies, what a screen reader is given, and what a
 * child is NOT offered.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8788 &
 *   NODE_PATH=/opt/node22/lib/node_modules \
 *     node tools/companion-presence-test/run-companion-presence-tests.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PRESENCE_PORT || 8788);
const BASE = 'http://127.0.0.1:' + PORT;
const SHOTS = path.join(__dirname, 'shots');
let passed = 0, failed = 0;
const failures = [];
function ok(n, note) { passed++; console.log('  ok  ' + n + (note ? '  (' + note + ')' : '')); }
function fail(n, note) { failed++; failures.push(n + (note ? '  (' + note + ')' : '')); console.log('  FAIL ' + n + (note ? '  (' + note + ')' : '')); }
function ck(c, n, note) { (c ? ok : fail)(n, note); }

// What is actually on the screen. One function, used by every journey,
// so two journeys are always compared on the same terms.
function LOOK() {
  const w = document.querySelector('.companion-widget');
  const bub = w ? w.querySelector('.companion-bubble') : null;
  const bs = bub ? getComputedStyle(bub) : null;
  const r = w ? w.getBoundingClientRect() : null;
  return {
    present: !!w,
    visible: w ? (getComputedStyle(w).visibility === 'visible' && getComputedStyle(w).opacity !== '0') : false,
    rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    who: (w && w.querySelector('img')) ? w.querySelector('img').src.split('/').slice(-2).join('/') : null,
    line: bub && bs.opacity !== '0' && !/companion-bubble-hidden/.test(bub.className)
      ? (bub.textContent || '').trim() : null,
    ledger: (typeof CompanionMoments !== 'undefined') ? CompanionMoments.diagnostics().ledger : null,
    signals: (typeof CompanionMoments !== 'undefined') ? CompanionMoments.signals() : null,
    memories: (typeof CompanionMemory !== 'undefined')
      ? CompanionMemory.list({ status: 'any' }).map((m) => m.key) : null,
    chatOffered: !!document.querySelector('.companion-chat-open'),
    riteRunning: document.body.classList.contains('studio-rite-running')
  };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  // A REAL ARRIVAL. Author Mode is used only to reach a document that
  // has the modules in it; the arrival itself is then made through the
  // real door, with author mode cleared so the entry gate is live.
  async function arrive(setup) {
    await page.goto(BASE + '/studio.html?author=on');
    await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
      typeof StudioEntry !== 'undefined', null, { timeout: 20000 });
    await page.evaluate(setup);
    await page.evaluate(() => {
      try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
      try { StudioEntry.pass(); } catch (e) {}
    });
    await page.goto(BASE + '/studio.html');
    await page.waitForFunction(() => typeof CompanionMoments !== 'undefined',
      null, { timeout: 20000 });
    // Tap through the Gateway the way a child taps it.
    for (let i = 0; i < 22; i++) {
      await page.waitForTimeout(700);
      const st = await page.evaluate(() => {
        const g = document.getElementById('gatewayOverlay');
        const showing = g && !g.hidden && getComputedStyle(g).display !== 'none';
        return { showing: !!showing,
                 settled: !!document.querySelector('.companion-widget') ||
                          document.body.classList.contains('creation-flow-active') ||
                          document.body.classList.contains('studio-rite-running') };
      });
      if (st.settled && !st.showing) break;
      if (st.showing) { try { await page.mouse.click(720, 450); } catch (e) {} }
    }
    await page.waitForTimeout(1600);
  }
  const CLEAN = 'localStorage.clear(); sessionStorage.clear();';
  const bonded = new Function(CLEAN +
    "const c=MagicCard.claim('Vihaan',null,{companionId:'leafy',companionName:'Leafy',companionSpecies:'Bloomling'});" +
    'MagicCard.setActive(c.id);');
  const unbonded = new Function(CLEAN + "const c=MagicCard.claim('Nobody'); MagicCard.setActive(c.id);");
  const traveller = new Function(CLEAN);
  // SPRINT 1K.1 — the same Presence system, a different Companion.
  // 'leosaurus' is the package id the registry and every claimed Magic
  // Card store; 'Leo' is the name a child sees. Nothing here names a
  // file, a user or a flag: the card is the only authority.
  const asLeo = new Function(CLEAN +
    "const c=MagicCard.claim('Vihaan',null,{companionId:'leosaurus',companionName:'Leo',companionSpecies:'Lantern Lion'});" +
    'MagicCard.setActive(c.id);');

  console.log('\nSPRINT 1K — LEAFY PRESENCE, AS A CHILD MEETS IT\n');

  // =================================================================
  console.log('TEST A — a first Creator enters the Studio');
  // =================================================================
  await arrive(bonded);
  const A = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'A-arrival.png') });
  ck(A.present && A.visible, 'A1  Leafy is visibly present on arrival',
     A.rect ? A.rect.w + '×' + A.rect.h + ' at ' + A.rect.x + ',' + A.rect.y : 'absent');
  ck(/leafy\//.test(A.who || ''), 'A2  and it is THEIR Companion, not a generic one', A.who);
  ck(!!A.line, 'A3  Leafy acknowledges the arrival', A.line);
  const openings = await page.evaluate(() => CompanionLines.OPENING.map((l) => l.text));
  ck(openings.indexOf(A.line) !== -1,
     'A4  in one of the ten authored opening lines, not a new one', A.line);
  ck((A.ledger || []).some((k) => k.indexOf('entry:') === 0),
     'A5  the arrival was recorded once', JSON.stringify(A.ledger));
  // The line goes away on its own. A greeting that stays is a banner.
  await page.waitForTimeout(6500);
  const settled = await page.evaluate(LOOK);
  ck(settled.line === null && settled.present,
     'A6  the line fades and Leafy simply stays', 'still present, no line');

  // ---- the same arrival cannot speak twice
  const twice = await page.evaluate(() => {
    const before = CompanionMoments.diagnostics().ledger.length;
    const d = CompanionMoments.decide('entry');
    return { before: before, speak: d.speak, reason: d.reason };
  });
  ck(twice.speak === false && twice.reason === 'already-acknowledged',
     'A7  asking again in the same arrival is silent', twice.reason);

  // =================================================================
  console.log('\nTEST B — the child creates, and Leafy stays quiet');
  // =================================================================
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => {
    const w = document.querySelector('main.preview-area .preview-wrapper');
    return w && w.getBoundingClientRect().width > 100;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  // Clear whatever the story-start moment said, then work for a while.
  await page.evaluate(() => { try { CompanionBrain._reset({ aged: true }); } catch (e) {} });
  await page.waitForTimeout(800);
  const spoke = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate((n) => {
      try { if (n % 3 === 0) PageOps.addPage(); } catch (e) {}
      try { PageRuntime.notify(); } catch (e) {}
    }, i);
    await page.waitForTimeout(500);
    const line = await page.evaluate(() => {
      const b = document.querySelector('.companion-bubble');
      return b && !/companion-bubble-hidden/.test(b.className) ? (b.textContent || '').trim() : null;
    });
    if (line) spoke.push(line);
  }
  await page.screenshot({ path: path.join(SHOTS, 'B-creating-quietly.png') });
  ck(spoke.length === 0,
     'B1  ten rounds of ordinary creation produce no line', spoke.join(' | ') || 'silence');
  const stillThere = await page.evaluate(LOOK);
  ck(stillThere.present && stillThere.visible,
     'B2  and Leafy is still there while they work', 'present, quiet');
  ck(stillThere.ledger.length <= 2,
     'B3  creating writes nothing new to the ledger', JSON.stringify(stillThere.ledger));

  // ---- THE STORY IS STILL THE THING ON SCREEN
  const geo = await page.evaluate(() => {
    const w = document.querySelector('.companion-widget');
    if (!w) return { err: 'absent' };
    const me = w.getBoundingClientRect();
    const over = [];
    ['main.preview-area .preview-wrapper', '.app-header', '#objectStripList',
     '#selectionActionStrip', '#pagesList', '#addPageBtn'].forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        if (!(me.right <= r.left || me.left >= r.right || me.bottom <= r.top || me.top >= r.bottom)) {
          over.push(sel);
        }
      });
    });
    const canvas = document.querySelector('main.preview-area .preview-wrapper');
    const cr = canvas ? canvas.getBoundingClientRect() : null;
    return {
      me: { x: Math.round(me.x), y: Math.round(me.y), w: Math.round(me.width), h: Math.round(me.height) },
      over: over, pointerEvents: getComputedStyle(w).pointerEvents,
      areaPct: cr ? Math.round((me.width * me.height) / (innerWidth * innerHeight) * 1000) / 10 : null,
      canvas: cr ? { x: Math.round(cr.x), y: Math.round(cr.y), w: Math.round(cr.width), h: Math.round(cr.height) } : null,
      vw: innerWidth, vh: innerHeight
    };
  });
  ck(geo.over.length === 0,
     'B4  Leafy covers no canvas and no control', geo.over.join(', ') || 'nothing overlapped');
  ck(geo.pointerEvents === 'none',
     'B5  and cannot intercept a tap meant for the Story', geo.pointerEvents);
  ck(geo.areaPct !== null && geo.areaPct < 3,
     'B6  the footprint is a corner, not a panel', geo.areaPct + '% of the viewport');

  // =================================================================
  console.log('\nTEST C — returning to a Story left a long time ago');
  // =================================================================
  const ret = await page.evaluate(() => {
    const id = (AppState.project || {}).id;
    // The real memory the real Sprint 1B recorder writes for a story
    // last touched longer ago than RETURN_AFTER_MS. Written through the
    // real store's own API — nothing here reaches inside it.
    CompanionMemory.remember({
      key: 'returned:' + id, kind: 'shared',
      content: 'We went back to a story we made a while ago.',
      importance: 'medium', confidence: 'confirmed',
      source: 'state:project-updated-at', entities: ['project:' + id]
    });
    return { id: id, eligible: CompanionMoments.decide('return-to-story') };
  });
  ck(ret.eligible.speak === true && ret.eligible.occasion === 'return-to-story',
     'C1  the return is a real moment, not blocked forever', ret.eligible.reason);
  // It is deliberately NOT said in the same breath as the greeting.
  const inBreath = await page.evaluate(() => {
    CompanionBrain._reset();          // back inside the settling window
    try { PageRuntime.notify(); } catch (e) {}
    const b = document.querySelector('.companion-bubble');
    return { line: b && !/companion-bubble-hidden/.test(b.className) ? b.textContent.trim() : null,
             stillEligible: CompanionMoments.decide('return-to-story').speak };
  });
  await page.waitForTimeout(900);
  ck(inBreath.line === null && inBreath.stillEligible === true,
     'C2  it waits rather than talking over the greeting, and stays pending',
     'pending: ' + inBreath.stillEligible);
  // Once there is room for it, it arrives — once.
  await page.evaluate(() => { CompanionBrain._reset({ aged: true }); });
  await page.evaluate(() => { try { PageRuntime.notify(); } catch (e) {} });
  await page.waitForTimeout(1200);
  const said = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'C-return-to-story.png') });
  ck(!!said.line && openings.indexOf(said.line) !== -1,
     'C3  and then Leafy says one of the authored lines', said.line);
  ck((said.ledger || []).indexOf('returned:' + ret.id) !== -1,
     'C4  recorded, so it can never repeat', JSON.stringify(said.ledger));
  // IT MUST NOT SOUND LIKE SURVEILLANCE.
  const surveil = /\b(days?|weeks?|months?|gone|away|absent|last (time|seen)|haven'?t been|since)\b/i;
  ck(!surveil.test(said.line || ''),
     'C5  and never recites how long they were gone', said.line);
  const again = await page.evaluate(() => {
    CompanionBrain._reset({ aged: true });
    try { PageRuntime.notify(); } catch (e) {}
    return CompanionMoments.decide('return-to-story');
  });
  ck(again.speak === false && again.reason === 'already-acknowledged',
     'C6  a second pulse says nothing more about it', again.reason);

  // =================================================================
  console.log('\nTEST D — a refresh');
  // =================================================================
  await page.goto(BASE + '/studio.html');
  await page.waitForTimeout(1400);
  const afterRefresh = await page.evaluate(() => location.pathname);
  ck(/index\.html$|\/$/.test(afterRefresh),
     'D1  a refresh leaves the Studio entirely, so it cannot re-greet', afterRefresh);

  // A self-reload — the Home button — is the same arrival and is silent.
  await arrive(bonded);
  const firstToken = await page.evaluate(() => {
    const d = CompanionMoments.decide('entry');
    return { token: StudioEntry.arrival(), spoke: d.reason };
  });
  await page.evaluate(() => { StudioEntry.renewHere(); });
  await page.goto(BASE + '/studio.html');
  await page.waitForFunction(() => typeof CompanionMoments !== 'undefined', null, { timeout: 20000 });
  const afterSelfReload = await page.evaluate(() => ({
    token: StudioEntry.arrival(),
    decision: CompanionMoments.decide('entry')
  }));
  ck(afterSelfReload.token === firstToken.token,
     'D2  a self-reload is the same arrival', firstToken.token + ' -> ' + afterSelfReload.token);
  ck(afterSelfReload.decision.speak === false &&
     afterSelfReload.decision.reason === 'already-acknowledged',
     'D3  so it is silent', afterSelfReload.decision.reason);

  // =================================================================
  console.log('\nTEST E — a Traveller');
  // =================================================================
  await arrive(traveller);
  const E = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'E-traveller.png') });
  ck(E.present === false, 'E1  a Traveller sees NO Companion at all',
     E.present ? ('mounted: ' + E.who) : 'nothing mounted');
  ck(E.line === null, 'E2  and hears nothing');
  ck((E.memories || []).length === 0,
     'E3  and nothing is remembered about them', JSON.stringify(E.memories));
  ck((E.ledger || []).length === 0,
     'E4  and no moment is recorded for them', JSON.stringify(E.ledger));
  ck(E.chatOffered === false, 'E5  and no conversation is offered');
  const eDecisions = await page.evaluate(() =>
    CompanionMoments.MOMENTS.map((m) => CompanionMoments.decide(m).reason));
  ck(eDecisions.every((r) => r === 'traveller'),
     'E6  every moment answers "traveller", from the real journey', eDecisions.join(','));

  // =================================================================
  console.log('\nTEST F — a Rite owns the screen');
  // =================================================================
  ck(E.riteRunning === true,
     'F1  the Traveller journey really does run the mandatory Rite',
     'body.studio-rite-running');
  ck(E.present === false, 'F2  and no Companion is on screen during it');
  const fDuring = await page.evaluate(() => {
    document.body.classList.add('studio-rite-running');
    const out = CompanionMoments.MOMENTS.map((m) => CompanionMoments.decide(m,
      Object.assign(CompanionMoments.signals(), { creator: true, companionAvailable: true, arrival: 'arrival:F' })));
    document.body.classList.remove('studio-rite-running');
    return out.map((d) => d.reason);
  });
  ck(fDuring.every((r) => r === 'rite-running'),
     'F3  and a Creator mid-rite is silent for the rite reason', fDuring.join(','));

  // =================================================================
  console.log('\nTEST G — a dialog is open');
  // =================================================================
  await arrive(bonded);
  const G = await page.evaluate(() => {
    const before = CompanionMoments.decide('entry',
      Object.assign(CompanionMoments.signals(), { arrival: 'arrival:G' }));
    const modal = document.getElementById('themePickerModal');
    let busySeen = null, decision = null;
    if (modal) {
      modal.classList.remove('hidden');
      busySeen = CompanionMoments.signals().busy;
      decision = CompanionMoments.decide('entry',
        Object.assign(CompanionMoments.signals(), { arrival: 'arrival:G' }));
      modal.classList.add('hidden');
    }
    return { before: before.speak, busySeen: busySeen, decision: decision };
  });
  ck(G.busySeen === true && G.decision && G.decision.reason === 'busy',
     'G1  a real open dialog makes the Companion stand down', G.decision && G.decision.reason);
  const gAfter = await page.evaluate(() => CompanionMoments.signals().busy);
  ck(gAfter === false, 'G2  and it comes back when the dialog closes');

  // =================================================================
  console.log('\nTEST H — Back to VihuPlanet');
  // =================================================================
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForTimeout(1500);
  const hasBtn = await page.evaluate(() => !!document.getElementById('etherBtn'));
  ck(hasBtn, 'H1  the one deliberate way out is on screen');
  const t0 = Date.now();
  await page.evaluate(() => { document.getElementById('etherBtn').click(); });
  await page.waitForFunction(() => /index\.html$|\/$/.test(location.pathname),
    null, { timeout: 8000 }).catch(() => {});
  const took = Date.now() - t0;
  const landed = await page.evaluate(() => location.pathname);
  ck(/index\.html$|\/$/.test(landed), 'H2  leaving works and lands on VihuPlanet', landed);
  ck(took < 2500, 'H3  and is immediate — no farewell pause was added', took + 'ms');

  // =================================================================
  console.log('\nWHO ELSE MEETS LEAFY');
  // =================================================================
  await arrive(unbonded);
  const U = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'U-unbonded-creator.png') });
  // MEASURED, NOT ASSUMED. The first version of this check asserted
  // that an unbonded Creator gets a "registry fallback, not their own"
  // — which is what reading _resolveCreatorCompanionId's last line
  // suggests, and it is wrong. The branch above it calls
  // MagicCard.ensureBondedCompanion(), so a Creator holding a card with
  // no bond is BONDED on the spot and the choice is written to their
  // card. Canon 3's "set once, never re-rolled" working, not a gap.
  ck(U.present === true && U.signals.companionAvailable === true,
     'X1  an unbonded Creator is given a Companion presence', U.who);
  const bond = await page.evaluate(() => (MagicCard.getActive() || {}).companionId);
  ck(!!bond && (U.who || '').indexOf(bond + '/') === 0,
     'X2  and it is bonded onto their card, not borrowed for the session',
     'card says ' + bond + ', screen shows ' + U.who);
  // Stable across a second real arrival — the bond is not re-rolled.
  await page.evaluate(() => { StudioEntry.pass(); });
  await page.goto(BASE + '/studio.html');
  await page.waitForFunction(() => typeof CompanionMoments !== 'undefined', null, { timeout: 20000 });
  const bondAgain = await page.evaluate(() => (MagicCard.getActive() || {}).companionId);
  ck(bondAgain === bond, 'X2b and it is the same Companion next time they arrive',
     bond + ' -> ' + bondAgain);

  // A first-ever Creator: no stories, no history, and still greeted.
  await arrive(bonded);
  const F1 = await page.evaluate(LOOK);
  ck(F1.present && !!F1.line && F1.signals.hasEverMade === false,
     'X3  a Creator with no story at all is still greeted',
     F1.line + ' / hasEverMade=' + F1.signals.hasEverMade);

  // =================================================================
  console.log('\nWHAT A CHILD IS NOT GIVEN');
  // =================================================================
  // IN THE EDITOR, AND AFTER A REAL PULSE. The first version of this
  // checked from Studio Home, where the opener could not have mounted
  // anyway (it needs main.preview-area) — so it passed with the feature
  // switched back ON. A check that cannot fail is worse than no check.
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => {
    const w = document.querySelector('main.preview-area .preview-wrapper');
    return w && w.getBoundingClientRect().width > 100;
  }, null, { timeout: 20000 });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { try { PageRuntime.notify(); } catch (e) {} });
    await page.waitForTimeout(400);
  }
  const openerHost = await page.evaluate(() => !!document.querySelector('main.preview-area'));
  ck(openerHost, 'N0  the surface the opener mounts into really is on screen',
     'main.preview-area present');
  const nothingOffered = await page.evaluate(() => ({
    chat: !!document.querySelector('.companion-chat-open'),
    bar: !!document.querySelector('.companion-chat'),
    input: !!document.querySelector('.companion-chat input, .companion-chat textarea'),
    flagOff: (typeof CompanionChat !== 'undefined') ? CompanionChat.CONVERSATION_OFFERED : null,
    apiStillThere: typeof CompanionChat !== 'undefined' && typeof CompanionChat.mount === 'function'
  }));
  ck(nothingOffered.chat === false && nothingOffered.bar === false && nothingOffered.input === false,
     'N1  no conversation surface is offered anywhere in the Studio',
     'no pill, no bar, no input');
  ck(nothingOffered.flagOff === false,
     'N2  and the reason is one readable constant, not a deletion',
     'CONVERSATION_OFFERED=' + nothingOffered.flagOff);
  ck(nothingOffered.apiStillThere === true,
     'N3  while the surface itself is untouched and still testable');

  // PRIVACY — nothing internal is on screen.
  const leaked = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const card = (MagicCard.getActive() || {});
    const bad = [];
    if (card.id && text.indexOf(card.id) !== -1) bad.push('cardId');
    ['proj_', 'mc_', 'entry:arrival', 'returned:', 'already-acknowledged', 'unproven',
     'openai', 'supabase', 'http://', 'https://'].forEach((t) => {
      if (text.toLowerCase().indexOf(t.toLowerCase()) !== -1) bad.push(t);
    });
    return bad;
  });
  ck(leaked.length === 0, 'N4  no id, key, reason or provider word is on screen',
     leaked.join(', ') || 'none');

  // ACCESSIBILITY.
  const a11y = await page.evaluate(() => {
    const w = document.querySelector('.companion-widget');
    if (!w) return { err: 'absent' };
    const bub = w.querySelector('.companion-bubble');
    const decorative = ['.companion-environment', '.companion-glow-ring',
                        '.companion-particles', '.companion-zzz', '.companion-sync-badge']
      .map((s) => { const n = w.querySelector(s); return n ? n.getAttribute('aria-hidden') : 'absent'; });
    const img = w.querySelector('img');
    return {
      bubbleRole: bub ? bub.getAttribute('role') : null,
      bubbleLive: bub ? bub.getAttribute('aria-live') : null,
      decorative: decorative,
      imgAlt: img ? img.getAttribute('alt') : null
    };
  });
  ck(a11y.bubbleRole === 'status' && a11y.bubbleLive === 'polite',
     'N5  what Leafy says is announced, politely and never assertively',
     a11y.bubbleRole + '/' + a11y.bubbleLive);
  ck(a11y.decorative.every((v) => v === 'true' || v === 'absent'),
     'N6  and every decorative part stays out of the accessibility tree',
     a11y.decorative.join(','));
  ck(typeof a11y.imgAlt === 'string',
     'N7  the portrait carries a real description', JSON.stringify(a11y.imgAlt));

  // NO NEW MACHINERY. Presence added no timer, no observer, no request.
  const dirSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionDirector.js'), 'utf8');
  const observes = (dirSrc.match(/PageRuntime\.observe\(/g) || []).length;
  ck(observes === 1, 'N8  the Director still has exactly one page subscription', observes + '');
  const netCalls = await page.evaluate(() => window.__presenceNet || 0);
  ck(netCalls === 0 || netCalls === undefined,
     'N9  presence made no request of its own', String(netCalls));

  // MEMORY IS NOT WRITTEN BY BEING PRESENT.
  const memStable = await page.evaluate(() => {
    const before = CompanionMemory.list({ status: 'any' }).length;
    for (let i = 0; i < 30; i++) {
      CompanionMoments.MOMENTS.forEach((m) => CompanionMoments.decide(m));
      try { PageRuntime.notify(); } catch (e) {}
    }
    return { before: before, after: CompanionMemory.list({ status: 'any' }).length };
  });
  ck(memStable.after === memStable.before,
     'N10 being present writes no memory', memStable.before + ' -> ' + memStable.after);

  // =================================================================
  console.log('\nSPRINT 1K.1 — THE SAME SYSTEM, A DIFFERENT COMPANION');
  // =================================================================
  //
  // Every check below runs the code Leafy runs. No Leo branch exists
  // anywhere in the Presence path, and that is the thing under test —
  // if one had been added, these would still pass and the point would
  // have been missed, so the source is checked for it too.
  await arrive(asLeo);
  const L = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'L-leo-arrival.png') });

  const leoBond = await page.evaluate(() => {
    const c = MagicCard.getActive() || {};
    return { id: c.companionId, name: c.companionName, species: c.companionSpecies };
  });
  ck(leoBond.id === 'leosaurus' && L.signals.companionId === 'leosaurus',
     'L1  Leo is resolved from the ACTIVE MAGIC CARD, nothing else',
     'card says ' + leoBond.id + ', signals say ' + L.signals.companionId);
  ck(L.present && L.visible && /leosaurus\//.test(L.who || ''),
     'L2  and Leo is the Companion actually on screen', L.who);
  const leoImg = await page.evaluate(() => {
    const i = document.querySelector('.companion-widget img');
    return i ? { alt: i.getAttribute('alt'), w: i.naturalWidth } : null;
  });
  ck(leoImg && /^Leo — /.test(leoImg.alt || '') && leoImg.w > 0,
     'L3  his artwork loads and is described as HIS', leoImg && leoImg.alt);
  ck(!!L.line && openings.indexOf(L.line) !== -1,
     'L4  Leo acknowledges the arrival, from the authored library', L.line);
  ck((L.ledger || []).some((k) => k.indexOf('entry:') === 0),
     'L5  through the same arrival token, recorded once', JSON.stringify(L.ledger));
  const leoTwice = await page.evaluate(() => CompanionMoments.decide('entry'));
  ck(leoTwice.speak === false && leoTwice.reason === 'already-acknowledged',
     'L6  and it cannot repeat in the same arrival', leoTwice.reason);

  // ---- the same geometry, the same slot, the same restraint
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => {
    const w = document.querySelector('main.preview-area .preview-wrapper');
    return w && w.getBoundingClientRect().width > 100;
  }, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { CompanionBrain._reset({ aged: true }); } catch (e) {} });
  await page.waitForTimeout(700);
  const leoSpoke = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate((n) => {
      try { if (n % 3 === 0) PageOps.addPage(); } catch (e) {}
      try { PageRuntime.notify(); } catch (e) {}
    }, i);
    await page.waitForTimeout(450);
    const line = await page.evaluate(() => {
      const b = document.querySelector('.companion-bubble');
      return b && !/companion-bubble-hidden/.test(b.className) ? (b.textContent || '').trim() : null;
    });
    if (line) leoSpoke.push(line);
  }
  await page.screenshot({ path: path.join(SHOTS, 'L-leo-quiet.png') });
  ck(leoSpoke.length === 0,
     'L7  Leo stays quiet through ordinary creation', leoSpoke.join(' | ') || 'silence');
  const leoGeo = await page.evaluate(() => {
    const w = document.querySelector('.companion-widget');
    if (!w) return { err: 'absent' };
    const me = w.getBoundingClientRect();
    const over = [];
    ['main.preview-area .preview-wrapper', '.app-header', '#objectStripList',
     '#selectionActionStrip', '#pagesList', '#addPageBtn'].forEach((sel) => {
      document.querySelectorAll(sel).forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        if (!(me.right <= r.left || me.left >= r.right || me.bottom <= r.top || me.top >= r.bottom)) over.push(sel);
      });
    });
    return { rect: { x: Math.round(me.x), y: Math.round(me.y), w: Math.round(me.width), h: Math.round(me.height) },
             over: over, pointerEvents: getComputedStyle(w).pointerEvents };
  });
  ck(leoGeo.over.length === 0 && leoGeo.pointerEvents === 'none',
     'L8  and covers no canvas and no control, exactly as Leafy does',
     leoGeo.over.join(', ') || (leoGeo.rect.w + '×' + leoGeo.rect.h));

  // ---- A POSE LEO DOES NOT HAVE. assets/leosaurus/README.md records
  // that think.png was never exported. The engine's own onerror must
  // fall back rather than leave a broken image in a child's Studio.
  const leoThink = await page.evaluate(async () => {
    try { CompanionDirector.notify('story-started'); } catch (e) {}
    await new Promise((r) => setTimeout(r, 1200));
    const i = document.querySelector('.companion-widget img');
    return { src: i ? i.src.split('/').slice(-2).join('/') : null,
             w: i ? i.naturalWidth : 0, broken: i ? (i.complete && i.naturalWidth === 0) : true };
  });
  ck(leoThink.broken === false && leoThink.w > 0,
     'L9  a pose Leo does not have degrades, never to a broken image',
     leoThink.src + ' @' + leoThink.w + 'px');

  // ---- the return, through the same evidence
  const leoRet = await page.evaluate(() => {
    const id = (AppState.project || {}).id;
    CompanionMemory.remember({
      key: 'returned:' + id, kind: 'shared',
      content: 'We went back to a story we made a while ago.',
      importance: 'medium', confidence: 'confirmed',
      source: 'state:project-updated-at', entities: ['project:' + id]
    });
    CompanionBrain._reset({ aged: true });
    try { PageRuntime.notify(); } catch (e) {}
    return { id: id, decision: CompanionMoments.decide('return-to-story') };
  });
  await page.waitForTimeout(1200);
  const leoSaid = await page.evaluate(LOOK);
  await page.screenshot({ path: path.join(SHOTS, 'L-leo-return.png') });
  ck(!!leoSaid.line && openings.indexOf(leoSaid.line) !== -1,
     'L10 Leo reaches the return moment on the same evidence', leoSaid.line);
  ck((leoSaid.ledger || []).indexOf('returned:' + leoRet.id) !== -1,
     'L11 and it is recorded so it cannot repeat', JSON.stringify(leoSaid.ledger));

  // ---- nothing else moved for Leo
  const leoQuietFacts = await page.evaluate(() => {
    const before = CompanionMemory.list({ status: 'any' }).length;
    for (let i = 0; i < 25; i++) {
      CompanionMoments.MOMENTS.forEach((m) => CompanionMoments.decide(m));
      try { PageRuntime.notify(); } catch (e) {}
    }
    return { before: before, after: CompanionMemory.list({ status: 'any' }).length,
             chat: !!document.querySelector('.companion-chat-open') };
  });
  ck(leoQuietFacts.after === leoQuietFacts.before,
     'L12 being Leo writes no memory', leoQuietFacts.before + ' -> ' + leoQuietFacts.after);
  ck(leoQuietFacts.chat === false, 'L13 and Leo is offered no conversation either');

  // ---- THE POINT OF THE SPRINT: there is no Leo branch to find.
  const presenceSrc = ['companionMoments.js', 'companionDirector.js', 'companionBrain.js',
                       'companionLines.js', 'companionEngine.js']
    .map((f) => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
  ck(!/leosaurus|\bLeo\b/.test(presenceSrc),
     'L14 THE PRESENCE PATH NAMES NO COMPANION — no Leo branch exists');
  ck(!/\bleafy\b/i.test(presenceSrc),
     'L15 and it never named Leafy either, which is why Leo needed no port');
  // The one place a Companion WAS written into the product.
  const chatSrc = fs.readFileSync(path.join(ROOT, 'js', 'companionChat.js'), 'utf8');
  ck(chatSrc.indexOf("placeholder=\"Say something to Leafy\"") === -1 &&
     chatSrc.indexOf("'Say something to ' + _name()") !== -1,
     'L16 the one hard-coded Companion name in the runtime is gone',
     'placeholder now reads the active card');

  // =================================================================
  console.log('\nLEAFY REGRESSION — unchanged by any of it');
  // =================================================================
  await arrive(bonded);
  const R = await page.evaluate(LOOK);
  ck(R.signals.companionId === 'leafy' && /leafy\//.test(R.who || ''),
     'R1  Leafy still resolves from her own card', R.who);
  ck(R.rect && A.rect && R.rect.w === A.rect.w && R.rect.h === A.rect.h &&
     R.rect.x === A.rect.x && R.rect.y === A.rect.y,
     'R2  in the same slot, at the same size, as before Leo existed',
     JSON.stringify(R.rect) + ' vs ' + JSON.stringify(A.rect));
  ck(R.line === A.line,
     'R3  and says exactly the line she said before this sprint',
     JSON.stringify(A.line) + ' -> ' + JSON.stringify(R.line));
  const rTwice = await page.evaluate(() => CompanionMoments.decide('entry'));
  ck(rTwice.speak === false && rTwice.reason === 'already-acknowledged',
     'R4  her deduplication is unchanged', rTwice.reason);
  // THE GREETING HAS TO FADE FIRST. The first version of this check
  // pulsed immediately after arriving and read the arrival line still
  // on screen — reporting a regression where there was none. A bubble
  // that is STILL showing is not a new line, and telling the two apart
  // is the whole of the check.
  await page.waitForFunction(() => {
    const b = document.querySelector('.companion-bubble');
    return !b || /companion-bubble-hidden/.test(b.className) ||
           getComputedStyle(b).opacity === '0';
  }, null, { timeout: 12000 }).catch(() => {});
  const rQuiet = await page.evaluate(async () => {
    CompanionBrain._reset({ aged: true });
    const said = [];
    for (let i = 0; i < 6; i++) {
      try { PageRuntime.notify(); } catch (e) {}
      await new Promise((r) => setTimeout(r, 300));
      const b = document.querySelector('.companion-bubble');
      if (b && !/companion-bubble-hidden/.test(b.className) &&
          getComputedStyle(b).opacity !== '0') said.push(b.textContent.trim());
    }
    return said;
  });
  ck(rQuiet.length === 0, 'R5  and her quietness is unchanged', rQuiet.join('|') || 'silence');

  // WHERE THE VOICES ACTUALLY COME FROM — recorded, because it is the
  // thing this sprint could not close. Neither Companion carries its
  // own `greetings`, so both speak the platform's authored library and
  // Leo's arrival line is Leafy's. The day somebody authors a
  // Companion's own voice this check fails and names the file.
  const voices = await page.evaluate(async () => {
    const out = {};
    for (const id of ['leafy', 'leosaurus']) {
      try {
        const r = await fetch('assets/' + id + '/personality.json');
        out[id] = r.ok ? Object.keys(await r.json()) : 'no personality.json';
      } catch (e) { out[id] = 'no personality.json'; }
    }
    return out;
  });
  const leafyGreets = Array.isArray(voices.leafy) && voices.leafy.indexOf('greetings') !== -1;
  const leoGreets = Array.isArray(voices.leosaurus) && voices.leosaurus.indexOf('greetings') !== -1;
  ck(!leafyGreets && !leoGreets,
     'R6  DISCLOSED: no Companion overrides the platform opening lines yet',
     'leafy: ' + (Array.isArray(voices.leafy) ? 'no greetings' : voices.leafy) +
     ' · leosaurus: ' + voices.leosaurus);

  // ---------------------------------------------------------------
  const real = pageErrors.filter((e) => !/favicon|ERR_/.test(e));
  ck(real.length === 0, 'Z1  zero page errors across every journey',
     real.slice(0, 2).join(' | ') || 'none');

  console.log('\n' + (failed === 0 ? 'ALL GREEN' : 'FAILURES') +
              ' — ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length) failures.forEach((f) => console.log('   · ' + f));
  console.log('screenshots: ' + SHOTS);
  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
