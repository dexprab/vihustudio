// travellerReset.js — a Traveller is stateless.
//
// "i would prefer them to walk all 23 beats again. i would like to keep
// travellers stateless. once they are out of vihuplanet once the
// vihuplanet is reloaded, anything not attached with a card lets remove
// that." — the product owner, overruling the narrower rule this file
// shipped with at build 0633, which kept the Rite's completion record on
// the grounds that it was a gate rather than the child's work.
//
// So the rule now has no exceptions worth the name: IF IT IS NOT
// ATTACHED TO A MAGIC CARD, IT DOES NOT SURVIVE. Stories, drawings,
// letters, the garden, the record that the Rite was completed and the
// record of what it taught. A Traveller who does not claim a card
// arrives new every time, and walks the whole first chapter again.
//
// ---------------------------------------------------------------
// WHY VIHUPLANET IS THE BOUNDARY
//
// It is the one entrance and everybody uses it (Decision 10), and it is
// never resumed — always entered (Decision 23). So arriving there is
// already the product's own definition of a fresh start, and hanging the
// reset on it needs no marker, no timer and no guess about what counts
// as a new session. Reload VihuPlanet and you are new; that is what the
// screen already meant.
//
// The Studio sweeps too, for the stores that only exist there
// (My Garden's drawings and letters, the garden itself). Every Studio
// arrival is preceded by a VihuPlanet load — Decision 23 enforces it
// with a one-shot pass — so this is not a second boundary, it is the
// same one finishing its work where those modules are loaded.
// ---------------------------------------------------------------
//
// THE ONE THING KEPT, AND IT IS NOT A STATE QUESTION: the Story a child
// is making RIGHT NOW. In the Studio, `preserveSession` holds whatever
// the session slot names, so an in-Studio reload — the Home button,
// Publish's clean slate, the build stamp's refetch — does not delete the
// page under the child's hands. At VihuPlanet nothing is preserved,
// because there is nothing in progress there: they have left.
//
// NEVER a delete of anything OWNED. Work belonging to any card — the
// active one, a sibling's, a stranger's — is untouchable, which is
// Decision 19's own rule and the reason this can run for everybody
// instead of only for a session that happens to hold nothing.
const TravellerReset = (function () {
  'use strict';

  // js/studioRite.js owns both of these and exports them; the literals
  // are the fallback for VihuPlanet, which does not load that file at
  // all. Documented at both ends.
  function _riteFlagKey() {
    try { if (typeof StudioRite !== 'undefined' && StudioRite.FLAG_KEY) return StudioRite.FLAG_KEY; } catch (e) {}
    return 'vihu.studioRite.v1';
  }
  function _taughtKey() {
    try { if (typeof StudioRite !== 'undefined' && StudioRite.TAUGHT_KEY) return StudioRite.TAUGHT_KEY; } catch (e) {}
    return 'vihu-rite-taught';
  }

  function _hasCard() {
    try {
      return !!(typeof MagicCard !== 'undefined' && MagicCard.getActive && MagicCard.getActive());
    } catch (e) { return false; }
  }

  // THE STORY THIS PAGE WAS OPENED TO SHOW.
  //
  // `?born=` plays a Story's arrival in the Ether and `?story=` is a
  // deep link to one (Decision 23 — intent may cross, state may not).
  // Deleting the very thing the navigation is about would not be
  // statelessness, it would be incoherence, so both are held for the
  // one load that names them. Nothing is remembered: the next load
  // carries no parameter and the Story goes like anything else unowned.
  function _intentProjectIds() {
    var out = [];
    try {
      var q = new URLSearchParams(window.location.search);
      ['born', 'story'].forEach(function (k) {
        var v = q.get(k);
        if (v) out.push(v);
      });
    } catch (e) {}
    return out;
  }

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

  // opts.preserveSession — hold the Story the session slot names. True
  // inside the Studio, false at VihuPlanet. See the header.
  //
  // Returns a Promise, because two of the four stores live in IndexedDB
  // and hydrate asynchronously at boot: a synchronous sweep would read
  // an empty map, find nothing unowned and report a clean success. The
  // caller does not have to wait — nothing downstream depends on the
  // answer — but the work has to.
  //
  // EVERYTHING THAT CAN BE DONE SYNCHRONOUSLY IS, and the rite records
  // are deliberately among them: they decide whether a child is sent
  // through the first chapter again, and that question is asked early.
  function run(opts) {
    var preserve = !(opts && opts.preserveSession === false);
    var out = { projects: 0, drawings: 0, letters: 0, garden: false, memory: false, rite: false };

    // THE RITE ITSELF.
    //
    // Both records are per-DEVICE, so neither is attached to a card and
    // both go. A CREATOR LOSES NOTHING BY IT, which is what makes this
    // safe rather than merely obedient: StudioRite.isComplete() is
    // `_flagSet() || _isCreator()`, and the taught record is read from
    // the active card before the device ever gets a look in. So for
    // anybody holding a card these two keys are already dead weight, and
    // for a Traveller they are the whole of what "stateless" means.
    //
    // The Magic Card FLAGS (awakeningOffered, hasEverPublished) go with
    // them, but only when no card is active — with one in hand they
    // belong to that Creator, and `awakeningOffered` is the record that
    // stops the Ceremony being offered to somebody who already answered.
    // A Traveller who declined a card is meant to meet that offer again
    // as a new person, which is exactly what clearing it does.
    try {
      localStorage.removeItem(_riteFlagKey());
      localStorage.removeItem(_taughtKey());
      out.rite = true;
      if (!_hasCard() && typeof MagicCard !== 'undefined' && MagicCard.setFlags) {
        MagicCard.setFlags({ awakeningOffered: false, hasEverPublished: false });
      }
    } catch (e) {}

    // The garden is a single localStorage record, so it needs nothing.
    try {
      if (typeof LivingGarden !== 'undefined' && LivingGarden.forgetTraveller) {
        out.garden = !!(LivingGarden.forgetTraveller() || {}).ok;
      }
    } catch (e) {}

    // And what a Companion remembers. The same single-record shape, and
    // in practice there is never anything here to take: js/companionMemory.js
    // refuses to write without an active card, so a Traveller has no
    // memories rather than having some that are later swept. It is swept
    // anyway, for the reason this whole file exists — a record that
    // predates a card must never outlive the session that made it, and
    // that must be true of any store, not only the ones we remember to
    // list. Memories belonging to a card are untouchable.
    try {
      if (typeof CompanionMemory !== 'undefined' && CompanionMemory.forgetTraveller) {
        out.memory = !!(CompanionMemory.forgetTraveller() || {}).ok;
      }
    } catch (e) {}

    // AND WHAT A CHILD CALLS THEIR COMPANION — same reasoning again, one
    // store along. js/companionName.js is keyed on a card and refuses to
    // write without one, so a Traveller cannot have chosen a name; it is
    // asked anyway so that a future change making that store writeable
    // without a card has somewhere obvious to be wrong.
    try {
      if (typeof CompanionName !== 'undefined' && CompanionName.forgetTraveller) {
        out.companionName = !!CompanionName.forgetTraveller();
      }
    } catch (e) {}

    function _ready(mod, fn) {
      try {
        if (typeof mod === 'undefined' || !mod || typeof mod[fn] !== 'function') return Promise.resolve();
        var p = mod[fn]();
        return (p && typeof p.then === 'function') ? p.catch(function () {}) : Promise.resolve();
      } catch (e) { return Promise.resolve(); }
    }

    var projects = _ready(typeof CreatorProjectCache !== 'undefined' ? CreatorProjectCache : null, 'hydrate')
      .then(function () {
        // Placement first, removal second. CreatorProjectStore's
        // _claimLegacy is the one-shot migration that gives an owner to
        // work predating ownership (Decision 19, by recorded evidence
        // rather than a guess). Sweeping before it ran would delete
        // exactly what it was about to place; once it has run, nothing
        // unowned is legacy any more.
        try { if (typeof CreatorProjectStore !== 'undefined') CreatorProjectStore.list(); } catch (e) {}
        try {
          if (typeof CreatorProjectStore !== 'undefined' && CreatorProjectStore.removeUnowned) {
            var keep = _intentProjectIds();
            var sess = preserve ? _sessionProjectId() : null;
            if (sess && keep.indexOf(sess) < 0) keep.push(sess);
            var r = CreatorProjectStore.removeUnowned(keep.length ? { preserveIds: keep } : undefined);
            out.projects = (r && r.removed) || 0;
          }
        } catch (e) {}
      });

    var drawings = _ready(typeof CreatorLibrary !== 'undefined' ? CreatorLibrary : null, 'whenReady')
      .then(function () {
        try {
          if (typeof CreatorLibrary !== 'undefined' && CreatorLibrary.removeUnowned) {
            out.drawings = (CreatorLibrary.removeUnowned() || {}).removed || 0;
          }
        } catch (e) {}
      });

    var letters = _ready(typeof HandwritingStore !== 'undefined' ? HandwritingStore : null, 'whenReady')
      .then(function () {
        try {
          if (typeof HandwritingStore !== 'undefined' && HandwritingStore.removeUnowned) {
            out.letters = (HandwritingStore.removeUnowned() || {}).removed || 0;
          }
        } catch (e) {}
      });

    return Promise.all([projects, drawings, letters]).then(function () { return out; });
  }

  return { run: run };
})();
try { window.TravellerReset = TravellerReset; } catch (e) {}
