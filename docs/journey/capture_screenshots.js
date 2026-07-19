// Captures a full, real, screen-by-screen walkthrough of Creator --
// first boot through Publish -- for BOTH roles (Visitor: never claims
// a Magic Card; Creator: claims one) -- as real PNG screenshots saved
// into docs/journey/ for docs/KID_JOURNEY.md to reference.
const path = require('path');
const { launch, seedDemoThemes } = require('./harness.js');

const OUT = '/home/user/vihustudio/docs/journey';
let shotIndex = 0;
async function shot(page, name, opts) {
  shotIndex += 1;
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, ...(opts || {}) });
  console.log('shot -> ' + name);
}

async function pickCreationType(page, text) {
  const card = page.locator('.creation-flow-card:has-text("' + text + '")').first();
  await card.click();
  await page.waitForTimeout(500);
}

async function backToScreen1(page) {
  const back = page.locator('.creation-flow-back-btn, button:has-text("← Back")').first();
  if (await back.count()) { await back.click(); await page.waitForTimeout(400); }
}

async function startCreatingFromScreen2(page) {
  const worldCard = page.locator('.creation-flow-world-card').first();
  if (await worldCard.count()) { await worldCard.click(); await page.waitForTimeout(400); }
  const startBtn = page.locator('.creation-flow-start-btn').first();
  if (await startBtn.count()) { await startBtn.click(); await page.waitForTimeout(900); }
}

async function selectFirstObjectStripCard(page, preferText) {
  let card;
  if (preferText) {
    card = page.locator('.object-card:has-text("' + preferText + '")').first();
    if (!(await card.count())) card = null;
  }
  if (!card) card = page.locator('.object-card').first();
  if (await card.count()) { await card.click(); await page.waitForTimeout(400); return true; }
  return false;
}

async function driveToAwakeningChoice(page) {
  // Publish -> Read My Story
  await page.click('.header-publish-btn, #publishBtn, button:has-text("Publish")');
  await page.waitForTimeout(600);
  await shot(page, '07-publish-read-my-story.png');

  const nextBtn = page.locator('button:has-text("Publish My Adventure")').first();
  if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(600); }
  await shot(page, '08-publish-almost-ready.png');

  const chooseBtn = page.locator('.publish-primary-btn:has-text("Choose Story Destination")').first();
  if (await chooseBtn.count()) { await chooseBtn.click(); await page.waitForTimeout(500); }
  await shot(page, '09-publish-choose-destination.png');

  const destCard = page.locator('.publish-destination-card').first();
  await destCard.click();
  await page.waitForTimeout(300);
  const fmtBtn = destCard.locator('.publish-destination-format').first();
  await fmtBtn.click();
  await page.waitForTimeout(300);
  await shot(page, '10-publish-destination-format-picked.png');
  await page.click('.publish-destination-continue');
  await page.waitForTimeout(1200);
  await shot(page, '11-publish-publishing-progress.png');
  await page.waitForTimeout(2000);

  await page.waitForSelector('.magic-card-awaken-sky', { timeout: 8000 }).catch(() => {});
  await shot(page, '12-awakening-reveal.png');

  await page.waitForSelector('.magic-card-awaken-tap', { timeout: 8000 });
  await page.click('.magic-card-awaken-tap');
  await page.waitForTimeout(400);
  await shot(page, '13-awakening-claim-choice.png');
}

(async () => {
  // =========================================================
  // PART A -- shared journey, captured once (identical for
  // Visitor and Creator up through the Awakening choice screen).
  // =========================================================
  {
    const { browser, page, server } = await launch();
    await seedDemoThemes(page);
    await shot(page, '01-screen1-choose-what-to-create.png');

    // Peek at Screen 2 for the richer Artwork World (representation
    // carousel) before going back to build the real working project
    // with the simpler Story World.
    await pickCreationType(page, 'Showcase My Artwork');
    await page.waitForTimeout(500);
    await shot(page, '02-screen2-artwork-world-carousel.png');
    await backToScreen1(page);

    await pickCreationType(page, 'Tell a Story');
    await page.waitForTimeout(500);
    await shot(page, '03-screen2-story-world-selected.png');
    await startCreatingFromScreen2(page);

    await shot(page, '04-workspace-default-personalize.png');

    // Open Personalize's "+ Add Something" accordion and add a real
    // sticker -- this both demonstrates Personalize (Rule 4: adding a
    // new personal layer) and, since inserting a sticker selects it
    // immediately, lands on a real Refine panel (Rule 3) with genuine
    // per-object controls -- a far more representative shot than the
    // synthetic Background card, which only ever clears selection.
    await page.click('.context-add-trigger');
    await page.waitForTimeout(300);
    await shot(page, '05-workspace-add-something-open.png');
    await page.click('.context-add-card:has-text("Emojis")');
    await page.waitForTimeout(500);
    const firstSticker = page.locator('.sticker-card').first();
    if (await firstSticker.count()) { await firstSticker.click(); await page.waitForTimeout(500); }
    await shot(page, '06-workspace-object-selected-refine.png');

    // Deselect back to the default view before Publish, matching a
    // real child's most likely path (tap empty space, then Publish).
    await page.mouse.click(760, 60);
    await page.waitForTimeout(300);

    await driveToAwakeningChoice(page);

    // ---- Branch: CREATOR -- claims the card ----
    await page.click('.magic-card-claim-btn:has-text("Claim It")');
    await page.waitForTimeout(500);
    await shot(page, '14-awakening-nickname-prompt.png');
    await page.fill('.magic-card-nickname-input', 'Rosie');
    await page.click('.magic-card-claim-btn:has-text("Continue")');
    await page.waitForTimeout(900);
    await shot(page, '15-awakening-first-claimed-moment.png');
    await page.click('.magic-card-claim-btn:has-text("Continue")');
    await page.waitForTimeout(600);
    await shot(page, '16-publish-celebration-creator.png');

    // Close Publish Studio back to the Workspace to show the header
    // badge in its natural habitat.
    const closeBtn = page.locator('.publish-studio-close, button[aria-label="Close"]').first();
    if (await closeBtn.count()) { await closeBtn.click(); await page.waitForTimeout(500); }
    await shot(page, '17-workspace-header-badge.png', { clip: { x: 0, y: 0, width: 1500, height: 90 } }).catch(async () => { await shot(page, '17-workspace-header-badge.png'); });

    await page.click('#magicCardBadge');
    await page.waitForTimeout(500);
    await shot(page, '18-magic-card-home-leading-card.png');
    const revealBtn = page.locator('.magic-card-art-reveal-btn').first();
    if (await revealBtn.count()) { await revealBtn.click(); await page.waitForTimeout(300); }
    await shot(page, '19-magic-card-home-revealed.png');
    await page.click('.magic-card-back');
    await page.waitForTimeout(300);

    // Screen 1's My Projects entry + grid (now that a real project exists).
    await page.evaluate(() => { if (typeof CreationFlow !== 'undefined' && CreationFlow.start) CreationFlow.start(); });
    await page.waitForTimeout(600);
    await shot(page, '20-screen1-my-projects-entry.png');
    const myProjBtn = page.locator('.creation-flow-myprojects-btn').first();
    if (await myProjBtn.count()) { await myProjBtn.click(); await page.waitForTimeout(400); }
    await shot(page, '21-screen1-my-projects-grid.png');
    // Close Creation Flow back into the app.
    const cfBack = page.locator('.creation-flow-back-btn, button:has-text("← Back")').first();
    if (await cfBack.count()) { await cfBack.click(); await page.waitForTimeout(300); }

    // Reboot as a returning Creator -- the Identity Gate.
    await page.reload();
    await page.waitForTimeout(1200);
    await shot(page, '22-identity-gate-welcome-back.png');

    // Simulate a second claimed card on this device to show the
    // Shared Device picker (a real product state -- siblings sharing
    // one browser -- not otherwise reachable without a second real
    // Awakening).
    await page.evaluate(() => {
      const raw = localStorage.getItem('vihu-magic-cards');
      const cards = raw ? JSON.parse(raw) : [];
      cards.push({
        id: 'mc_demo_sibling', nickname: 'Kabir', constellation: 'ORION',
        pattern: [[1,2],[3,4],[5,1],[7,6]],
        claimedAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(),
      });
      localStorage.setItem('vihu-magic-cards', JSON.stringify(cards));
    });
    await page.reload();
    await page.waitForTimeout(1200);
    await shot(page, '23-identity-gate-shared-device-picker.png');

    await browser.close();
    server.close();
  }

  // =========================================================
  // PART B -- the Visitor path diverges only at the Awakening
  // choice screen (declines) and at the next reboot (no gate, no
  // badge). Re-run the shared prefix fresh, fast, no extra shots.
  // =========================================================
  {
    const { browser, page, server } = await launch();
    await seedDemoThemes(page);
    await pickCreationType(page, 'Tell a Story');
    await page.waitForTimeout(400);
    await startCreatingFromScreen2(page);
    await page.waitForTimeout(400);

    await page.click('.header-publish-btn, #publishBtn, button:has-text("Publish")');
    await page.waitForTimeout(600);
    const nextBtn = page.locator('button:has-text("Publish My Adventure")').first();
    if (await nextBtn.count()) { await nextBtn.click(); await page.waitForTimeout(600); }
    const chooseBtn = page.locator('.publish-primary-btn:has-text("Choose Story Destination")').first();
    if (await chooseBtn.count()) { await chooseBtn.click(); await page.waitForTimeout(500); }
    const destCard = page.locator('.publish-destination-card').first();
    await destCard.click();
    await page.waitForTimeout(300);
    const fmtBtn = destCard.locator('.publish-destination-format').first();
    await fmtBtn.click();
    await page.waitForTimeout(300);
    await page.click('.publish-destination-continue');
    await page.waitForTimeout(3200);

    await page.waitForSelector('.magic-card-awaken-tap', { timeout: 8000 });
    await page.click('.magic-card-awaken-tap');
    await page.waitForTimeout(400);

    // ---- Branch: VISITOR -- declines ----
    await page.click('.magic-card-claim-later:has-text("Just Exploring for Now")');
    await page.waitForTimeout(600);
    await shot(page, '24-publish-celebration-visitor.png');

    const closeBtn = page.locator('.publish-studio-close, button[aria-label="Close"]').first();
    if (await closeBtn.count()) { await closeBtn.click(); await page.waitForTimeout(500); }

    // Reboot as a Visitor -- no Identity Gate, no header badge, lands
    // straight back on the ordinary boot path (restore modal or
    // Creation Flow, exactly as it always has for a Visitor).
    await page.reload();
    await page.waitForTimeout(1200);
    await shot(page, '25-visitor-reboot-no-gate-no-badge.png');

    await browser.close();
    server.close();
  }

  console.log('\nDone. ' + shotIndex + ' screenshots captured to ' + OUT);
})();
