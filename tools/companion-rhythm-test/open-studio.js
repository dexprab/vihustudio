/**
 * ONE JOURNEY, SHARED — the way a child actually reaches the Talk
 * surface: an entry pass, a real load of studio.html, the Gateway tapped
 * the way a child taps it, and only then a conversation.
 *
 * Lifted out of tools/companion-rhythm-test so Sprint 3A.1's own suite
 * uses the identical route. A harness that reaches around the journey
 * cannot see the journey — recorded four times in this repository — and
 * two copies of the route is two ways to start reaching around it.
 */
'use strict';
module.exports = async function openStudio(page, BASE, FN_BASE, opts) {
  const o = Object.assign({ id: 'leosaurus', name: 'Leo', species: 'Lantern Lion',
                            token: 'user.token' }, opts || {});
  await page.route('**/supabase-config.json', (r) => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ url: FN_BASE, anonKey: 'anon.key.value' }) }));
  await page.goto(BASE + '/studio.html?author=on');
  await page.waitForFunction(() => typeof MagicCard !== 'undefined' &&
    typeof StudioEntry !== 'undefined', null, { timeout: 20000 });
  await page.evaluate((c) => {
    localStorage.clear(); sessionStorage.clear();
    const card = MagicCard.claim('Vihaan', null, { companionId: c.id,
      companionName: c.name, companionSpecies: c.species });
    MagicCard.setActive(card.id);
  }, o);
  await page.evaluate(() => {
    try { localStorage.removeItem('vihu-author-mode'); } catch (e) {}
    try { StudioEntry.pass(); } catch (e) {}
  });
  await page.goto(BASE + '/studio.html');
  await page.waitForFunction(() => typeof CompanionChat !== 'undefined', null, { timeout: 20000 });
  await page.evaluate((t) => {
    window.ThemeRepositoryClient = window.ThemeRepositoryClient || {};
    window.ThemeRepositoryClient.getSession = () => Promise.resolve({ access_token: t });
  }, o.token);
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(550);
    const st = await page.evaluate(() => {
      const g = document.getElementById('gatewayOverlay');
      return { showing: !!(g && !g.hidden && getComputedStyle(g).display !== 'none'),
               settled: !!document.querySelector('.companion-widget') ||
                        document.body.classList.contains('creation-flow-active') };
    });
    if (st.settled && !st.showing) break;
    if (st.showing) { try { await page.mouse.click(720, 450); } catch (e) {} }
  }
  await page.waitForFunction(() => !!document.querySelector('.companion-chat-open'),
    null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.evaluate(() => { CompanionChat.open(); });
  await page.waitForTimeout(300);
};
