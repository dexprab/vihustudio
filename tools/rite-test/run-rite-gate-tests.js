/* THE RITE GATE — who is sent through the Studio Rite, and who is not.
 *
 * The Rite is the one mandatory thing in the product (Decision 8), so
 * being wrong in either direction is expensive: a child who has never
 * created anything let straight into the Studio, or a Creator made to
 * sit through it again.
 *
 * The bug this suite was written for: the grandfather clause asked
 * `MagicCard.list().length > 0` — "does anybody on this laptop hold a
 * card" — which is a fact about the DEVICE. A sibling's card sent a
 * brand-new child straight past the Rite. Same bug class as Decision 19.
 *
 * Run:
 *   node tools/bring-it-alive/test/serve.js 8781 &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/rite-test/run-rite-gate-tests.js
 */
'use strict';
const { chromium } = require('playwright');

const PORT = Number(process.env.RITE_PORT || 8781);
const BASE = 'http://127.0.0.1:' + PORT;
let passed = 0, failed = 0;
function check(cond, name, note) {
  if (cond) { passed++; console.log('  ok  ' + name + (note ? '  (' + note + ')' : '')); }
  else { failed++; console.log('  FAIL ' + name + (note ? '  (' + note + ')' : '')); }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() =>
    typeof MagicCard !== 'undefined' && typeof StudioRite !== 'undefined',
    null, { timeout: 20000 });

  console.log('\nTHE RITE GATE\n');

  // A brand-new child on a clean machine must be sent through it.
  const clean = await page.evaluate(() => {
    localStorage.clear();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete() };
  });
  check(clean.complete === false, 'G1 a first-time child is sent through the Rite',
    JSON.stringify(clean));

  // A recognised Creator is grandfathered — Decision 8, unchanged.
  const creator = await page.evaluate(() => {
    const c = MagicCard.claim('Recognised');
    MagicCard.setActive(c.id);
    return { active: !!MagicCard.getActive(), complete: StudioRite.isComplete() };
  });
  check(creator.complete === true, 'G2 a recognised Creator is not made to repeat it',
    JSON.stringify(creator));

  // THE REGRESSION. A second child, not recognised, on a machine that
  // holds somebody else's card. The card exists; it is not theirs.
  const sibling = await page.evaluate(() => {
    localStorage.removeItem('vihu-magic-card-active-id');
    return {
      cardsOnDevice: MagicCard.list().length,
      active: MagicCard.getActive() ? 'yes' : 'no',
      complete: StudioRite.isComplete()
    };
  });
  check(sibling.cardsOnDevice > 0 && sibling.active === 'no',
    'G3 the shared-device case is genuinely set up', JSON.stringify(sibling));
  check(sibling.complete === false,
    "G4 a sibling's card does NOT grandfather a new child", JSON.stringify(sibling));

  // A pointer to a card that no longer exists grandfathers nobody.
  const stale = await page.evaluate(() => {
    localStorage.setItem('vihu-magic-card-active-id', 'card-that-never-existed');
    return { active: MagicCard.getActive() ? 'yes' : 'no', complete: StudioRite.isComplete() };
  });
  check(stale.complete === false, 'G5 a stale card pointer grandfathers nobody',
    JSON.stringify(stale));

  // The flag still works for the child who earned it — including a
  // Traveller who completed the Rite and declined to share.
  const flagged = await page.evaluate(() => {
    localStorage.clear();
    StudioRite.markComplete();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete() };
  });
  check(flagged.cards === 0 && flagged.complete === true,
    'G6 a Traveller who finished the Rite keeps the Studio', JSON.stringify(flagged));

  // ---------------------------------------------------------------
  // R — THE REDUCTION SHOWS ONLY WHAT THE RITE TEACHES.
  //
  // Reported by the product owner, looking at Rite I running: "for a
  // traveller why do we have garden and add creation button?" Both were
  // real and they were different faults. My Garden was never named in
  // the reduction — it was written before the tile existed under this
  // id — so the one control nobody thought to list stayed on screen
  // through a story that never asks for it. And the Garden's developer
  // trigger is Author Mode only, which a real Traveller never has, but
  // Author Mode is remembered per browser: anyone who ever switched it
  // on walks every later Rite with a dev control in the middle of a
  // child's first story.
  //
  // The class IS the condition — every rule is scoped to
  // `body.studio-rite-running` — so setting it is the real test, and it
  // does not depend on where a rite's choreography happens to be.
  console.log('-- R: the Rite shows only what it teaches');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  for (let i = 0; i < 6; i++) {
    const gone = await page.evaluate(() => {
      const o = document.getElementById('gatewayOverlay');
      if (!o || o.hidden || !o.offsetParent) return true;
      o.click(); return false;
    });
    if (gone) break;
    await page.waitForTimeout(700);
  }
  await page.evaluate(() => { const o = document.getElementById('gatewayOverlay'); if (o) o.style.display = 'none'; });
  await page.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await page.waitForFunction(() => document.querySelector('main.preview-area .preview-wrapper'), null, { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const t = document.querySelector('.context-add-trigger');
    if (t && !document.querySelector('.context-add-grid')) t.click();
  });
  await page.waitForTimeout(600);
  const tiles = () => page.evaluate(() => Array.from(document.querySelectorAll('.context-add-card'))
    .filter((c) => c.offsetParent !== null).map((c) => c.dataset.addId));

  const openStudio = await tiles();
  check(openStudio.indexOf('library') >= 0,
    'R1 the open Studio offers My Garden — the reduction is what hides it, never its absence',
    JSON.stringify(openStudio));

  await page.evaluate(() => document.body.classList.add('studio-rite-running'));
  await page.waitForTimeout(300);
  const inRite = await tiles();
  const devHidden = await page.evaluate(() => {
    const e = document.querySelector('#gardenDevAdd');
    return { exists: !!e, visible: !!(e && e.offsetParent !== null) };
  });
  check(inRite.indexOf('library') === -1,
    'R2 a rite that reveals nothing does not offer My Garden', JSON.stringify(inRite));
  check(!devHidden.visible,
    'R3 and the Garden dev trigger is not in a child\'s first story, Author Mode or not',
    JSON.stringify(devHidden));

  await page.evaluate(() => document.body.classList.add('studio-rite-shows-garden'));
  await page.waitForTimeout(300);
  const revealed = await tiles();
  check(revealed.indexOf('library') >= 0,
    'R4 a rite that DOES reveal it gets it back, by naming it and changing no CSS',
    JSON.stringify(revealed));

  // ---------------------------------------------------------------
  // N — THE ORDER LIVES IN THE REGISTRY.
  //
  // The product owner: "lets assign my garden to level 2 and current
  // level 2 becomes level 3." Decision 22 says in as many words that
  // the registry, not an ordinal, is the design — so this is a line
  // moving in an array, and everything downstream follows it.
  //
  // My Garden's story is not written. An entry with no screens is a
  // PLACE IN THE ORDER, not a door: it refuses to start, the Studio
  // Home offer skips it, and it contributes nothing to what a later
  // rite may show — because a rite nobody can walk has taught nobody
  // anything, and showing its tile in the rite after it would be the
  // same leak R2 exists to catch.
  console.log('-- N: the order lives in the registry');
  const reg = await page.evaluate(() => ({
    order: StudioRite.rites().map((r) => r.id),
    runnable: StudioRite.rites().map((r) => r.id + ':' + (r.runnable ? 'yes' : 'no')),
    unwrittenStarts: StudioRite.start('my-garden'),
    // A rite with no story must refuse to start and must never be the
    // door Studio Home offers. That is the invariant — not that every
    // entry is walkable.
    worldToolsStart: StudioRite.start('the-world-tools'),
    nextDoor: StudioRite.nextOptIn()
  }));
  check(reg.order.join(' > ') === 'the-night-a-star-came-down > my-garden > my-little-house > the-world-tools',
    'N1 the order is My Garden, My Little House, then the world tools', reg.order.join(' > '));
  check(reg.unwrittenStarts === true,
    'N2 My Garden has its story now, so it starts — the same call refused while it had none');
  // N3 USED TO ASSERT EVERY RITE WAS WALKABLE, which was true only
  // because every entry happened to have a story at the time. Decision
  // 22 is explicit that "a rite with no screens is a place in the order,
  // not a door", so the real invariant is that an unwritten one refuses
  // and is never offered — which is what stops a child being pointed at
  // a door that will not open.
  check(reg.worldToolsStart === false,
    'N3 a rite with no story refuses to start', String(reg.worldToolsStart));
  check(reg.nextDoor !== 'the-world-tools',
    'N3b …and is never the door Studio Home offers', String(reg.nextDoor));

  // EVERY RUNNABLE RITE TEACHES WHAT IT HANDS OVER.
  //
  // "they were not part of rite 1" was the complaint, and moving a
  // capability to a different rite does not answer it — it moves it. A
  // rite that reveals a control its own story never asks for is the
  // same bug one rite along. So: for every capability a runnable rite
  // reveals, some beat of that rite must gate on it.
  //
  // The map is the one place this suite knows which gate proves which
  // capability; anything revealed with no entry here fails, which is
  // what stops a capability being added to a rite without a beat.
  const GATE_FOR = {
    garden: ['drawing-kept', 'drawing-placed', 'letter-kept', 'letters-placed'],
    voice: ['voice-added'],
    shapes: ['shape-added'],
    doodle: ['doodle-added'],
    photo: ['photo-added'],
    'blank-page': ['blank-page-added'],
    'page-shape': ['page-shaped']
  };
  const untaught = await page.evaluate((map) => {
    const bad = [];
    StudioRite.rites().forEach(function (r) {
      if (!r.runnable) return;
      const gates = (StudioRite._gates(r.id) || []).filter(Boolean);
      (r.teaches || []).forEach(function (cap) {
        const proofs = map[cap];
        if (!proofs) return;                     // not a gateable control
        if (!proofs.some((g) => gates.indexOf(g) >= 0)) bad.push(r.id + '/' + cap);
      });
    });
    return bad;
  }, GATE_FOR);
  check(untaught.length === 0,
    'N6 every runnable rite has a beat for each control it hands over',
    untaught.join(', ') || 'all taught');

  /* ---- V: the control a beat points at is actually ON THE SCREEN -----
   *
   * N6 proves a beat exists. It cannot prove the child can see what the
   * beat is talking about, and that gap shipped: walking Rite II, beat 2
   * says "your letters live on the right, with the things you can add"
   * and My Garden was not there. Two independent causes, both invisible
   * to every check in this repo:
   *
   *   1. `studio-gated` survived into the running rite. Both families of
   *      classes were on <body> at once — `studio-rite-shows-garden`
   *      saying show it, `studio-gated` with no `studio-taught-garden`
   *      saying hide it — and both are display:none !important, so the
   *      gate won. Rite II was unwalkable for exactly the population it
   *      is for: a child who finished Rite I and therefore HAS a record.
   *   2. Voice and Page Shape were hidden UNCONDITIONALLY in every rite,
   *      on a comment written before build 0646 moved them into Rites II
   *      and III.
   *
   * So this walks each runnable rite for real, as a gated child, and
   * checks that every capability the rite reveals resolves to a control
   * that is not display:none. The capability -> selector map is READ OUT
   * OF THE STYLESHEET rather than written here, so it cannot drift from
   * the rules it is checking: every `:not(.studio-rite-shows-X) SEL`
   * pair in css/style.css is one entry.
   */
  console.log('\n-- V: what a rite reveals is what a child can see');

  // THE MAP IS EXPLICIT, AND THAT IS THE POINT. A first version of this
  // check read the capability -> selector pairs out of the stylesheet's
  // own `:not(.studio-rite-shows-X) SEL` rules, which is elegant and
  // blind in exactly the direction that shipped: a control hidden
  // UNCONDITIONALLY has no such pair, so it fell out of the map and was
  // never checked — the voice bug would have passed. A check that reads
  // its expectations from the thing it is checking proves nothing.
  //
  // So this map is written down. A capability a runnable rite reveals
  // with no entry here FAILS, the same discipline N6 already uses, and
  // the stylesheet is then cross-checked against it rather than trusted.
  const CONTROL_FOR = {
    garden: ".context-add-card[data-add-id='library']",
    voice: ".context-add-card[data-add-id='voice']",
    shapes: ".context-add-card[data-add-id='shapes']",
    doodle: ".context-add-card[data-add-id='doodle']",
    photo: ".context-add-card[data-add-id='photo']",
    'blank-page': '#addPageBtn',
    'page-shape': ".context-set-tile[data-set-id='pageShape']",
    world: ".context-add-card[data-add-id='fromWorld']",
    // Handwriting is a ROOM inside My Garden, not a control of its own —
    // there is no tile to look for, and its beats reach it through the
    // garden tile. Null is the entry, so it is declared rather than
    // silently missing.
    handwriting: null
  };

  const gateRules = await (async () => {
    const cp = await browser.newPage();
    await cp.goto(BASE + '/css/style.css');
    const text = await cp.evaluate(() => document.body.innerText);
    await cp.close();
    const map = {};
    text.split('}').forEach((chunk) => {
      const head = chunk.split('{')[0];
      if (head.indexOf('studio-rite-running') < 0) return;
      head.split(',').forEach((sel) => {
        const m = sel.match(/studio-rite-shows-([a-z-]+)\)\s*(.*)$/);
        if (!m || !m[2].trim()) return;
        (map[m[1]] = map[m[1]] || []).push(m[2].trim());
      });
    });
    return map;
  })();

  // Every capability with a control must be gated on its OWN reveal
  // class in the stylesheet. An unconditional hide is what broke Voice
  // and Page Shape when build 0646 moved them between rites, and it is
  // invisible to a live check that only looks at the rites in play.
  const ungated = Object.keys(CONTROL_FOR).filter((cap) => {
    const sel = CONTROL_FOR[cap];
    if (!sel) return false;
    return !(gateRules[cap] || []).some((s) => s === sel);
  });
  check(ungated.length === 0,
    'V0 every gateable control is hidden by its OWN reveal class, never unconditionally',
    ungated.join(', ') || Object.keys(gateRules).join(', '));

    const runnableIds = await page.evaluate(() =>
    StudioRite.rites().filter((r) => r.runnable).map((r) => r.id));

  for (const riteId of runnableIds) {
    const rp = await browser.newPage({ viewport: { width: 1359, height: 800 } });
    const rErrors = [];
    rp.on('pageerror', (e) => rErrors.push(String(e)));
    await rp.goto(BASE + '/studio.html?author=on');
    await rp.waitForFunction(() =>
      typeof StudioRite !== 'undefined' && typeof MagicCard !== 'undefined' &&
      typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
    // A GATED child, which is the case that was broken: a Magic Card,
    // and a taught record holding exactly what the rites before this one
    // hand over. A grandfathered child (no record) was never affected,
    // which is why nothing caught this.
    await rp.evaluate((id) => {
      localStorage.clear();
      MagicCard.claim('Vihu');
      const caps = [];
      for (const r of StudioRite.rites()) {
        if (r.id === id) break;
        (r.teaches || []).forEach((c) => caps.push(c));
        (r.reveals || []).forEach((c) => caps.push(c));
      }
      MagicCard.setTaught(caps);
      try { localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify(caps)); } catch (e) {}
      StudioRite.applyTaught();
      const gw = document.getElementById('gatewayOverlay');
      if (gw) gw.style.display = 'none';
      document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
    }, riteId);
    await rp.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
    await rp.waitForTimeout(1200);
    const wasGated = await rp.evaluate(() => document.body.classList.contains('studio-gated'));
    await rp.evaluate((id) => { try { StudioRite.start(id); } catch (e) {} }, riteId);
    await rp.waitForTimeout(3000);
    const seen = await rp.evaluate((map) => {
      const shows = Array.from(document.body.classList)
        .filter((c) => c.indexOf('studio-rite-shows-') === 0)
        .map((c) => c.replace('studio-rite-shows-', ''));
      const hidden = [], absent = [], unmapped = [];
      shows.forEach((cap) => {
        if (!(cap in map)) { unmapped.push(cap); return; }
        const sel = map[cap];
        if (!sel) return;                       // declared as having no control
        const el = document.querySelector(sel);
        // A section that only renders when its own panel is open is
        // absent rather than hidden — reported, never failed.
        if (!el) { absent.push(cap + ' ' + sel); return; }
        if (getComputedStyle(el).display === 'none') hidden.push(cap + ' ' + sel);
      });
      return {
        running: StudioRite.isRunning(),
        gated: document.body.classList.contains('studio-gated'),
        taughtClasses: Array.from(document.body.classList)
          .filter((c) => c.indexOf('studio-taught-') === 0).length,
        shows: shows, hidden: hidden, absent: absent, unmapped: unmapped
      };
    }, CONTROL_FOR);
    check(seen.running === true, 'V1 ' + riteId + ' actually runs', JSON.stringify(seen.running));
    check(wasGated === true || riteId === runnableIds[0],
      'V2 ' + riteId + ' was reached by a child the Studio really was gating',
      String(wasGated));
    check(seen.gated === false && seen.taughtClasses === 0,
      'V3 ' + riteId + ' takes the Studio\'s shape — no gate class survives into it',
      JSON.stringify({ gated: seen.gated, taught: seen.taughtClasses }));
    check(seen.unmapped.length === 0,
      'V4 ' + riteId + ' — nothing it reveals is unknown to this suite',
      seen.unmapped.join(', ') || 'all mapped');
    check(seen.hidden.length === 0,
      'V5 ' + riteId + ' — every control it reveals is on the screen',
      seen.hidden.join(' | ') || (seen.absent.length ? 'not rendered: ' + seen.absent.join(' | ') : 'all shown'));
    check(rErrors.length === 0, 'V6 ' + riteId + ' — zero page errors', rErrors.slice(0, 2).join(' | '));
    await rp.close();
  }

  /* ---- W: My Garden has two rooms, and the story is in one of them --
   *
   * "second beat is about letters. but the highlighted part is
   * drawings." The child taps My Garden because Lumo just said their
   * letters live there, and lands in whichever room the picker happened
   * to open on last. The picker's own rule — land where your new thing
   * is — already covered this; it simply had no way to know.
   *
   * This walks Rite II for real to the letter beat and opens My Garden
   * the way a child does: Add Something, then the tile.
   */
  console.log('\n-- W: the story opens the room it is about');

  const wp = await browser.newPage({ viewport: { width: 1359, height: 800 } });
  const wErrors = [];
  wp.on('pageerror', (e) => wErrors.push(String(e)));
  await wp.goto(BASE + '/studio.html?author=on');
  await wp.waitForFunction(() =>
    typeof StudioRite !== 'undefined' && typeof MagicCard !== 'undefined' &&
    typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  await wp.evaluate(() => {
    localStorage.clear();
    MagicCard.claim('Vihu');
    const r1 = StudioRite.rites().find((r) => r.mandatory);
    const caps = (r1.teaches || []).concat(r1.reveals || []);
    MagicCard.setTaught(caps);
    try { localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify(caps)); } catch (e) {}
    const gw = document.getElementById('gatewayOverlay');
    if (gw) gw.style.display = 'none';
    document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
  });
  await wp.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await wp.waitForTimeout(1200);

  const outsideRite = await wp.evaluate(() => StudioRite.wantsRoom());
  check(outsideRite === null,
    'W1 outside a rite the Studio is asked nothing — My Garden opens where it always did',
    String(outsideRite));

  await wp.evaluate(() => { try { StudioRite.start('my-garden'); } catch (e) {} });
  await wp.waitForTimeout(2500);

  // Beat 1 awaits bg-set. Satisfy it, then take the beat's own "I did
  // it!" — the escape that exists so a child is never stranded.
  for (let i = 0; i < 25; i++) {
    if (await wp.evaluate(() => StudioRite.wantsRoom())) break;
    await wp.evaluate(() => {
      try {
        const pg = PageRuntime.getActivePage();
        if (pg) {
          pg.metadata = pg.metadata || {};
          pg.metadata.cardOverrides = pg.metadata.cardOverrides || {};
          pg.metadata.cardOverrides.background = '#2E7D32';
        }
      } catch (e) {}
      const b = Array.from(document.querySelectorAll('.studio-rite-controls button'))
        .find((x) => /I did it/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await wp.waitForTimeout(700);
  }

  const atLetters = await wp.evaluate(() => ({
    wants: StudioRite.wantsRoom(),
    beat: (document.querySelector('.studio-rite-line .gateway-greeting-title') || {}).textContent || ''
  }));
  check(atLetters.wants === 'letters',
    'W2 the letter beat says the story is in the letters room', JSON.stringify(atLetters));

  // Opened the way a child opens it, with no room asked for.
  await wp.evaluate(() => {
    const t = document.querySelector('.context-add-trigger');
    if (t && !document.querySelector('.context-add-grid')) t.click();
  });
  await wp.waitForTimeout(500);
  await wp.evaluate(() => {
    const tile = document.querySelector(".context-add-card[data-add-id='library']");
    if (tile) tile.click();
  });
  await wp.waitForTimeout(800);
  const landed = await wp.evaluate(() => {
    const active = document.querySelector('.context-hw-tab-active');
    return {
      active: active ? active.getAttribute('data-room') : null,
      rooms: Array.from(document.querySelectorAll('.context-hw-tab')).map((t) => t.getAttribute('data-room')),
      clickable: Array.from(document.querySelectorAll('.context-hw-tab'))
        .every((t) => getComputedStyle(t).display !== 'none' && !t.disabled)
    };
  });
  check(landed.active === 'letters',
    'W3 …and My Garden opens in it, with no room asked for', JSON.stringify(landed));
  check(landed.rooms.join(',') === 'drawings,letters',
    'W4 both rooms are named, so a nudge points at one without matching its words',
    landed.rooms.join(','));
  check(landed.clickable === true,
    'W5 neither room is locked — a rite never takes a door away', String(landed.clickable));

  // Standing in the wrong room, the nudge points at the right one rather
  // than at the tile the child has already tapped.
  const wrongRoom = await wp.evaluate(() => {
    const other = document.querySelector(".context-hw-tab[data-room='drawings']");
    if (other) other.click();
    return null;
  });
  await wp.waitForTimeout(600);
  const points = await wp.evaluate(() => {
    const t = StudioRite._nudgeTarget ? StudioRite._nudgeTarget('letter-kept') : null;
    return {
      active: (document.querySelector('.context-hw-tab-active') || {}).getAttribute
        ? document.querySelector('.context-hw-tab-active').getAttribute('data-room') : null,
      target: t ? (t.getAttribute('data-room') || t.getAttribute('data-add-id') || t.className) : null
    };
  });
  check(points.active === 'drawings' && points.target === 'letters',
    'W6 in the wrong room, the nudge points at the right one — never at the tile already tapped',
    JSON.stringify(points));
  check(wErrors.length === 0, 'W7 zero page errors', wErrors.slice(0, 2).join(' | '));

  /* ---- and the Rite stands behind the catcher ------------------------
   * The band was sitting straight over the letter catcher, covering the
   * camera and its buttons — `.hw-studio-modal` opens at z-index 1000
   * and the Rite's dock sits at 1400, the identical stacking the yield
   * watcher was written for when Publish hit it. Worse here: the beat
   * says "hold your letter up so I can see it" while Lumo covers the
   * camera it is asking them to hold it up to.
   */
  await wp.evaluate(() => {
    const t = document.querySelector(".context-hw-tab[data-room='letters']");
    if (t) t.click();
  });
  await wp.waitForTimeout(500);
  await wp.evaluate(() => {
    const t = document.querySelector('.context-hw-tile');
    if (t) t.click();
  });
  await wp.waitForTimeout(1600);
  const covered = await wp.evaluate(() => {
    const ov = document.querySelector('.studio-rite-overlay');
    return {
      catcher: !!document.querySelector('.hw-studio-modal'),
      band: ov ? getComputedStyle(ov).display : null,
      yielded: ov ? ov.classList.contains('studio-rite-yield') : null
    };
  });
  check(covered.catcher === true && covered.band === 'none',
    'W8 the Rite stands behind the letter catcher — never over the camera it asked for',
    JSON.stringify(covered));
  await wp.evaluate(() => {
    const x = document.querySelector('.hw-studio-close');
    if (x) x.click();
  });
  await wp.waitForTimeout(900);
  const back = await wp.evaluate(() => {
    const ov = document.querySelector('.studio-rite-overlay');
    return { catcher: !!document.querySelector('.hw-studio-modal'),
             band: ov ? getComputedStyle(ov).display : null };
  });
  check(back.catcher === false && back.band === 'block',
    'W9 …and comes back the moment it closes', JSON.stringify(back));
  await wp.close();

  /* ---- X: a name arrives one letter at a time -----------------------
   *
   * "if we write all the letters on single paper it will not work. the
   * beat should be fill the garden with your name letters one at a
   * time. once done click i did it." The line read *Write the rest of
   * your name*, which describes something the catcher cannot do — it is
   * armed for ONE letter, reads that letter, and reopens the letters
   * room so the next tile is one tap away.
   *
   * Only the child knows when their name is finished, so the beat ends
   * on their word rather than on a count: the gate passes on one more
   * letter and the Rite's own "I did it!" then waits for them.
   */
  console.log('\n-- X: a name arrives one letter at a time');

  const xp = await browser.newPage({ viewport: { width: 1359, height: 800 } });
  const xErrors = [];
  xp.on('pageerror', (e) => xErrors.push(String(e)));
  await xp.goto(BASE + '/studio.html?author=on');
  await xp.waitForFunction(() =>
    typeof StudioRite !== 'undefined' && typeof MagicCard !== 'undefined' &&
    typeof CreationFlow !== 'undefined' && typeof HandwritingStore !== 'undefined',
    null, { timeout: 20000 });
  await xp.evaluate(() => {
    localStorage.clear();
    MagicCard.claim('Vihu');
    const r1 = StudioRite.rites().find((r) => r.mandatory);
    const caps = (r1.teaches || []).concat(r1.reveals || []);
    MagicCard.setTaught(caps);
    try { localStorage.setItem(StudioRite.TAUGHT_KEY, JSON.stringify(caps)); } catch (e) {}
    const gw = document.getElementById('gatewayOverlay');
    if (gw) gw.style.display = 'none';
    document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
  });
  await xp.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await xp.waitForTimeout(1200);
  await xp.evaluate(() => { try { StudioRite.start('my-garden'); } catch (e) {} });
  await xp.waitForTimeout(2500);

  const xBeat = () => xp.evaluate(() => ({
    sub: (document.querySelector('.studio-rite-line .gateway-greeting-subtitle') || {}).textContent || '',
    done: !!document.querySelector('.studio-rite-done'),
    doneText: (document.querySelector('.studio-rite-done') || {}).textContent || '',
    letters: (function () { try { return HandwritingStore.list().length; } catch (e) { return -1; } })()
  }));

  // Walk to the naming beat, keeping one letter wherever the story asks
  // for one, and taking the beat's own confirmation each time.
  for (let i = 0; i < 30; i++) {
    const b = await xBeat();
    if (/One letter at a time/.test(b.sub)) break;
    await xp.evaluate(() => {
      try {
        const pg = PageRuntime.getActivePage();
        if (pg) {
          pg.metadata = pg.metadata || {};
          pg.metadata.cardOverrides = pg.metadata.cardOverrides || {};
          pg.metadata.cardOverrides.background = '#2E7D32';
        }
      } catch (e) {}
      try {
        if (StudioRite.wantsRoom() === 'letters') {
          const n = HandwritingStore.list().length;
          HandwritingStore.save({ ch: String.fromCharCode(97 + n),
            png: 'data:image/png;base64,iVBORw0KGgo=', w: 40, h: 40 });
        }
      } catch (e) {}
      const d = document.querySelector('.studio-rite-done');
      if (d) d.click();
    });
    await xp.waitForTimeout(700);
  }

  const naming = await xBeat();
  check(/One letter at a time/.test(naming.sub) && /Tell me when it is all there/.test(naming.sub),
    'X1 the naming beat asks for one letter at a time, and for the child to say when',
    naming.sub);
  check(!/rest of your name/i.test(naming.sub),
    'X2 …and no longer asks for a whole name on one paper — the catcher reads ONE letter',
    naming.sub);
  check(naming.done === false,
    'X3 nothing to press yet — a name with no more letters in it is not finished',
    JSON.stringify({ done: naming.done, letters: naming.letters }));

  await xp.evaluate(() => {
    try {
      const n = HandwritingStore.list().length;
      HandwritingStore.save({ ch: String.fromCharCode(97 + n),
        png: 'data:image/png;base64,iVBORw0KGgo=', w: 40, h: 40 });
    } catch (e) {}
  });
  // The confirmation waits on a short stillness AND on the beat's own
  // poll, so it is offered within a beat or two rather than instantly.
  // Polled rather than slept on: a fixed wait either flakes or is slow.
  let afterLetter = null;
  for (let i = 0; i < 20; i++) {
    await xp.waitForTimeout(400);
    afterLetter = await xBeat();
    if (afterLetter.done) break;
  }
  check(afterLetter.done === true && afterLetter.doneText === 'I did it!',
    'X4 one more letter, and the beat waits on the child\'s own word', JSON.stringify(afterLetter));
  check(afterLetter.letters === naming.letters + 1,
    'X5 …on ONE letter, never on a count of them', JSON.stringify({
      before: naming.letters, after: afterLetter.letters }));
  check(xErrors.length === 0, 'X6 zero page errors', xErrors.slice(0, 2).join(' | '));

  await xp.close();

  /* ---- Y: on a garden beat Lumo stands in the left pane -------------
   * "lumo screen is still there. you can collapse it and just keep i
   * did it button, or move lumo and idid it button to left pane as
   * there is only single page there." The 2.2s step-aside a capture
   * triggers is right for the growth itself and does nothing for the
   * rest of the beat, which is where a child spends most of it.
   *
   * Beside-the-page is the product owner's OWN earlier preference and
   * stays the default; this overrides it only where the two collide —
   * beats whose whole subject is a garden growing in the gutter Lumo is
   * standing in.
   */
  console.log('\n-- Y: on a garden beat, Lumo stands in the left pane');

  const yp = await browser.newPage({ viewport: { width: 1359, height: 800 } });
  const yErrors = [];
  yp.on('pageerror', (e) => yErrors.push(String(e)));
  await yp.goto(BASE + '/studio.html?author=on');
  await yp.waitForFunction(() =>
    typeof StudioRite !== 'undefined' && typeof MagicCard !== 'undefined' &&
    typeof CreationFlow !== 'undefined', null, { timeout: 20000 });
  await yp.evaluate(() => {
    localStorage.clear();
    MagicCard.claim('Vihu');
    const r1 = StudioRite.rites().find((r) => r.mandatory);
    MagicCard.setTaught((r1.teaches || []).concat(r1.reveals || []));
    const gw = document.getElementById('gatewayOverlay');
    if (gw) gw.style.display = 'none';
    document.querySelectorAll('.studio-rite-overlay').forEach((n) => n.remove());
  });
  await yp.evaluate(() => { try { CreationFlow.startBlank(); } catch (e) {} });
  await yp.waitForTimeout(1200);
  await yp.evaluate(() => { try { StudioRite.start('my-garden'); } catch (e) {} });
  await yp.waitForTimeout(3000);

  const dock = () => yp.evaluate(() => {
    const pan = document.querySelector('.studio-rite-overlay .studio-rite-panel');
    const b = pan.getBoundingClientRect();
    const w = document.querySelector('.preview-wrapper').getBoundingClientRect();
    return {
      wants: StudioRite.wantsRoom(),
      beside: document.body.classList.contains('studio-rite-beside'),
      clearsWorkspace: b.right <= w.x + 1,
      x: Math.round(b.x), width: Math.round(b.width)
    };
  });

  const bgBeat = await dock();
  check(bgBeat.wants === null && bgBeat.beside === true,
    'Y1 a beat that is not about the garden keeps beside-the-page — his own earlier preference',
    JSON.stringify(bgBeat));

  /* Beside the page is where a capture CAN still catch him in the way —
   * My Garden is revealed for the whole rite, so a child may wander in
   * and keep something on any beat. There he leans out of the way for
   * as long as the growth answers, and comes back.
   *
   * One measurement worth keeping: the class went on and off correctly
   * and NOTHING MOVED. The docked band's own entry animation holds
   * opacity and transform at its end state, and an animation outranks a
   * plain declaration however specific — so asserting the class is
   * present proves nothing about whether a child can see past him. */
  const aside = await yp.evaluate(() => new Promise((done) => {
    const ov = document.querySelector('.studio-rite-overlay');
    const pan = document.querySelector('.studio-rite-overlay .studio-rite-panel');
    const read = () => ({
      aside: ov.classList.contains('studio-rite-aside'),
      opacity: Number(getComputedStyle(pan).opacity).toFixed(2),
      shown: getComputedStyle(ov).display
    });
    const before = read();
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'suite-1' } }));
    setTimeout(() => {
      const during = read();
      setTimeout(() => done({ before: before, during: during, after: read() }), 2400);
    }, 700);
  }));
  check(aside.before.aside === false && aside.during.aside === true,
    'Y1a beside the page, a capture steps him aside so the garden can be watched',
    JSON.stringify(aside));
  check(Number(aside.during.opacity) < 0.5,
    'Y1b …and he really recedes — the class alone proves nothing, an animation was pinning it',
    JSON.stringify({ idle: aside.before.opacity, growing: aside.during.opacity }));
  check(aside.during.shown !== 'none' && aside.after.aside === false &&
        Number(aside.after.opacity) > 0.9,
    'Y1c he leans out of the way and comes back — never vanishes, which reads as a glitch',
    JSON.stringify(aside.after));

  for (let i = 0; i < 20; i++) {
    if (await yp.evaluate(() => StudioRite.wantsRoom())) break;
    await yp.evaluate(() => {
      try {
        const pg = PageRuntime.getActivePage();
        if (pg) {
          pg.metadata = pg.metadata || {};
          pg.metadata.cardOverrides = pg.metadata.cardOverrides || {};
          pg.metadata.cardOverrides.background = '#2E7D32';
        }
      } catch (e) {}
      const d = document.querySelector('.studio-rite-done');
      if (d) d.click();
    });
    await yp.waitForTimeout(600);
  }
  await yp.waitForTimeout(700);
  const gardenBeat = await dock();
  check(gardenBeat.wants !== null && gardenBeat.beside === false,
    'Y2 a garden beat moves him to the left pane', JSON.stringify(gardenBeat));
  check(gardenBeat.clearsWorkspace === true,
    'Y3 …and the whole workspace is clear, growth bands included',
    JSON.stringify(gardenBeat));

  // The confirmation goes with him — a button left behind in the old
  // place would be the one control this beat ends on, stranded.
  await yp.evaluate(() => {
    try { HandwritingStore.save({ ch: 'h', png: 'data:image/png;base64,iVBORw0KGgo=', w: 40, h: 40 }); } catch (e) {}
  });
  let doneBtn = null;
  for (let i = 0; i < 20; i++) {
    await yp.waitForTimeout(400);
    doneBtn = await yp.evaluate(() => {
      const b = document.querySelector('.studio-rite-done');
      if (!b) return null;
      const br = b.getBoundingClientRect();
      const pr = document.querySelector('.studio-rite-overlay .studio-rite-panel').getBoundingClientRect();
      const w = document.querySelector('.preview-wrapper').getBoundingClientRect();
      return {
        text: b.textContent,
        insidePanel: br.left >= pr.left - 1 && br.right <= pr.right + 1,
        onScreen: br.bottom <= window.innerHeight + 1 && br.top >= 0,
        clearsWorkspace: br.right <= w.x + 1
      };
    });
    if (doneBtn) break;
  }
  check(!!doneBtn && doneBtn.text === 'I did it!' && doneBtn.insidePanel &&
        doneBtn.onScreen && doneBtn.clearsWorkspace,
    'Y4 the confirmation travels with him and fits the pane', JSON.stringify(doneBtn));

  // And the capture step-aside stands down there: fading a guide who is
  // already out of the way is a guide vanishing for no visible reason.
  const noAside = await yp.evaluate(() => new Promise((done) => {
    const ov = document.querySelector('.studio-rite-overlay');
    document.dispatchEvent(new CustomEvent('vihu:creation-captured', { detail: { id: 'suite-2' } }));
    setTimeout(() => done({ aside: ov.classList.contains('studio-rite-aside') }), 700);
  }));
  check(noAside.aside === false,
    'Y5 the capture step-aside stands down in the pane — nothing to step aside from',
    JSON.stringify(noAside));
  check(yErrors.length === 0, 'Y6 zero page errors', yErrors.slice(0, 2).join(' | '));
  await yp.close();

  // The offer on Studio Home must skip the unwritten one and land on the
  // next real door — never on a rite nobody has authored.
  const offered = await page.evaluate(() => {
    const list = StudioRite.rites() || [];
    for (let i = 0; i < list.length; i++) {
      if (!list[i].mandatory && list[i].runnable) return list[i].id;
    }
    return null;
  });
  check(offered === 'my-garden',
    'N4 the next door is the first opt-in rite in registry ORDER, not a hard-coded id', String(offered));

  // A rite must never take away what an earlier rite taught. My Garden
  // is now runnable, so it contributes: the third rite shows its tile
  // without either entry naming the other, and while My Garden had no
  // story it contributed nothing — which is what kept the tile out of
  // Rite III in front of a child who had never been taught it.
  // A FRESH PAGE, because N2 started a rite to prove it starts and
  // `start()` refuses while one is running — the first version of this
  // check read an empty class list and looked like a broken feature.
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined', null, { timeout: 20000 });
  const cumulative = await page.evaluate(() => {
    StudioRite.start('my-little-house');
    const shows = Array.prototype.slice.call(document.body.classList)
      .filter((c) => c.indexOf('studio-rite-shows-') === 0).sort();
    return shows;
  });
  check(cumulative.indexOf('studio-rite-shows-garden') >= 0,
    'N5 the third rite inherits My Garden from the second, with neither naming the other',
    cumulative.join(' '));

  // ---------------------------------------------------------------
  // C — BECOMING A CREATOR IS FINISHING THE FIRST STORY.
  //
  // The product owner, having asked why sharing was the mandate, chose
  // to move it: Rite I's completion awakens the Magic Card, and sharing
  // keeps its own weight afterwards. The case this exists for is the
  // child who finishes the Rite and DECLINES to share — before this
  // they held no card, which meant no backup and no recognition on
  // another device, because the only thing protecting their work was
  // gated behind a public act.
  //
  // The seam is asserted rather than the ceremony's pixels: what must
  // be true is that the rite offers the awakening when one is still
  // available, and never when a card already exists.
  console.log('-- C: the card comes from finishing, not from sharing');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined'
    && typeof MagicCard !== 'undefined', null, { timeout: 20000 });

  const offer = await page.evaluate(() => {
    localStorage.clear();
    const before = MagicCard.shouldOfferAwakening();
    // a child who has finished the Rite and shared nothing
    StudioRite.markComplete();
    return { cards: MagicCard.list().length, complete: StudioRite.isComplete(), offerable: before };
  });
  check(offer.offerable === true,
    'C1 a Traveller who has never shared is still owed a Ceremony', JSON.stringify(offer));
  check(offer.complete === true && offer.cards === 0,
    'C2 finishing the Rite is recorded without a card existing yet', JSON.stringify(offer));

  // …and once a card exists the offer is spent, so a child who shared on
  // the rite's last beat meets nothing extra when the rite ends.
  const spent = await page.evaluate(() => {
    MagicCard.claim('Test');
    return { cards: MagicCard.list().length, offerable: MagicCard.shouldOfferAwakening() };
  });
  check(spent.cards === 1 && spent.offerable === false,
    'C3 and once a card exists the Ceremony is spent — a child who shared meets nothing twice',
    JSON.stringify(spent));

  // C4-C6 — the two populations the amendment created, and the dead end
  // it exposed. `_finishAwakening()` marks the ceremony offered whatever
  // the outcome, and the header badge is hidden with no active card, so
  // a child who said "Maybe Later" had no badge, no second offer and no
  // route to a card at all.
  console.log('-- C: nobody is left without a way to a card');
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof StudioRite !== 'undefined'
    && typeof MagicCard !== 'undefined' && typeof MagicCardUI !== 'undefined',
    null, { timeout: 20000 });

  // A child who finished the Rite BEFORE the card came from finishing.
  const legacy = await page.evaluate(() => {
    localStorage.clear();
    StudioRite.markComplete();
    return { complete: StudioRite.isComplete(), cards: MagicCard.list().length,
             owed: MagicCard.shouldOfferAwakening() };
  });
  check(legacy.complete && legacy.cards === 0 && legacy.owed === true,
    'C4 a child who finished the Rite before this rule existed is still owed a Ceremony',
    JSON.stringify(legacy));

  // And a child who was offered one and said Maybe Later.
  const declined = await page.evaluate(() => {
    MagicCard.markAwakeningOffered();
    // The badge is hidden BY the refresh, not inherently — the first
    // version of this check read the untouched DOM and reported a badge
    // that was simply never updated. Ask the real function.
    MagicCardUI.refreshHeaderBadge();
    const badge = document.getElementById('magicCardBadge');
    return { owed: MagicCard.shouldOfferAwakening(), cards: MagicCard.list().length,
             badgeVisible: !!(badge && !badge.classList.contains('hidden')) };
  });
  check(declined.owed === false && declined.cards === 0 && !declined.badgeVisible,
    'C5 a child who declined has no card, no further offer and no badge — the dead end',
    JSON.stringify(declined));

  // The notice is their route, and it opens the ceremony rather than
  // pressing Finish Story, which would grant them nothing.
  const route = await page.evaluate(() => {
    let opened = false;
    const real = MagicCardUI.showAwakening;
    MagicCardUI.showAwakening = function(){ opened = true; };
    try {
      TravellerSaveNotice.refresh();
      const btn = document.querySelector('.traveller-save-notice-publish');
      const label = btn ? btn.textContent.trim() : null;
      if (btn) btn.click();
      return { label: label, opened: opened };
    } finally { MagicCardUI.showAwakening = real; }
  });
  check(route.opened === true && !/Finish/i.test(route.label || ''),
    'C6 and the Traveller notice is that route — it opens the Ceremony, not Finish Story',
    JSON.stringify(route));

  check(pageErrors.length === 0, 'H1 zero page errors',
    pageErrors.slice(0, 2).join(' | '));

  console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
