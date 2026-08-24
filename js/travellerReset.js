// travellerReset.js — nothing an unclaimed Traveller leaves behind
// survives into a new browser session.
//
// "this browser or session persistance is killing us. we cannot have
// anything persisting from unclaimed sessions" — the product owner,
// looking at six leftover test stories filling My Projects.
//
// ---------------------------------------------------------------
// WHY THE WIPE THAT ALREADY EXISTED NEVER FIRED
//
// js/gatewaySequence.js has cleared My Projects since "traveller should
// not see projects of previous creators" — but only for a session it
// identified as a first-time TRAVELLER (`!isReturning`). The moment a
// child holds a Magic Card every leftover on that device becomes
// permanent, because the one thing that cleaned them up stops running.
// That is exactly the reported case, and Decision 8's amendment made it
// universal: a card is now minted the moment Rite I completes, so
// almost every real session is a "returning" one within a day.
//
// It also wiped the WHOLE list — which is why it could only ever be
// allowed to run for somebody who owned nothing. Ownership exists now
// (Decision 19), so the honest sweep is possible: take what nobody owns
// and never touch what anybody does.
// ---------------------------------------------------------------
//
// WHAT THIS DOES NOT TOUCH, DELIBERATELY:
//
//   · Anything owned by any Magic Card. Not the active one's, not a
//     sibling's, not a stranger's. Decision 19 is explicit that
//     scoping is a FILTER and never a delete, and that still holds for
//     everything with an owner — a second child cannot destroy the
//     first one's work by walking in.
//   · The Story the session slot currently names. A child mid-story who
//     opens a second tab must not lose the thing they are making; the
//     same safeguard the Gateway's own wipe already carried.
//   · A Story that has been SHARED. It was given to VihuPlanet on
//     purpose (Decision 15) and taking it back is not this rule's to
//     make.
//   · The record that the Rite has been completed. That is a gate the
//     product imposed, not the child's work, and Decision 8 says the
//     Rite is completed exactly once. Wiping it would make a child who
//     declined a card walk the whole first chapter again every time
//     they open a new tab, which is a wall rather than a clean slate.
//     What this rule is for is that no child ever meets another
//     child's leftovers — and that is content.
//
// Runs ONCE per browser session, from js/app.js's bootstrap, before
// anything reads the stores. sessionStorage starts empty in a new tab
// and survives an in-page reload within one, which is exactly the
// signal wanted — and Decision 23's own "a refresh goes home" path
// stays inside one session, so a refresh mid-story never triggers it.
const TravellerReset = (function () {
  'use strict';

  var MARK = 'vihu.travellerReset.done';

  function _sessionProjectId() {
    try {
      if (typeof ProjectManager === 'undefined' || !ProjectManager.getSessionStatus) return null;
      var info = ProjectManager.getSessionStatus();
      if (info && info.state === 'valid' && info.data && info.data.project && info.data.project.id) {
        return info.data.project.id;
      }
    } catch (e) {}
    return null;
  }

  function run(opts) {
    var force = !!(opts && opts.force);
    var out = { ran: false, projects: 0, drawings: 0, letters: 0, garden: false };
    try {
      if (!force && sessionStorage.getItem(MARK)) return out;
      sessionStorage.setItem(MARK, '1');
    } catch (e) { /* an unreadable browser simply does not sweep */ }
    out.ran = true;

    // Placement first, removal second. CreatorProjectStore._claimLegacy
    // runs lazily from list() and is what gives an owner to work that
    // predates ownership (Decision 19 — by recorded evidence, never by
    // guessing). Sweeping before it ran would delete exactly the
    // records it was about to place.
    try { if (typeof CreatorProjectStore !== 'undefined') CreatorProjectStore.list(); } catch (e) {}

    try {
      if (typeof CreatorProjectStore !== 'undefined' && CreatorProjectStore.removeUnowned) {
        var keep = _sessionProjectId();
        var r = CreatorProjectStore.removeUnowned(keep ? { preserveIds: [keep] } : undefined);
        out.projects = (r && r.removed) || 0;
      }
    } catch (e) {}

    try {
      if (typeof CreatorLibrary !== 'undefined' && CreatorLibrary.removeUnowned) {
        out.drawings = (CreatorLibrary.removeUnowned() || {}).removed || 0;
      }
    } catch (e) {}

    try {
      if (typeof HandwritingStore !== 'undefined' && HandwritingStore.removeUnowned) {
        out.letters = (HandwritingStore.removeUnowned() || {}).removed || 0;
      }
    } catch (e) {}

    try {
      if (typeof LivingGarden !== 'undefined' && LivingGarden.forgetTraveller) {
        out.garden = !!(LivingGarden.forgetTraveller() || {}).ok;
      }
    } catch (e) {}

    // The taught record's own device fallback (js/studioRite.js) exists
    // only for the seconds between Rite I finishing and the Ceremony
    // minting a card. Once a card holds it the device copy is noise, and
    // for a child who never claimed one it is a Studio shaped by work
    // that no longer exists. Left alone while it is still the only copy.
    try {
      var hasCard = typeof MagicCard !== 'undefined' && MagicCard.getActive && MagicCard.getActive();
      if (hasCard && typeof StudioRite !== 'undefined' && StudioRite.TAUGHT_KEY) {
        localStorage.removeItem(StudioRite.TAUGHT_KEY);
      }
    } catch (e) {}

    return out;
  }

  return { run: run, MARK: MARK };
})();
try { window.TravellerReset = TravellerReset; } catch (e) {}
