// journeyResolver.js — who is arriving, and what their intent means.
//
// VihuPlanet's home screen shows exactly two actions, forever:
//
//     ⭐ Show Me Your Stars        ✨ Create Story
//
// They never change. Not for a first-time Traveller, not for a
// Returning Creator, not as a child grows. What changes is what
// happens behind them — and this file is the only place that decides.
//
// ---------------------------------------------------------------
// WHY THIS EXISTS AS A SERVICE
//
// The alternative is an `isCreator` check at every call site, and that
// is how home screens rot: one button learns about Magic Cards, another
// learns about the Rite, a third learns about publishing, and within
// two sprints the home screen has four buttons because each check grew
// its own special case. Every future milestone — the Companion, Story
// Worlds, the Telescope — then has to be threaded through all of them.
//
// One resolver instead. The buttons ask what a tap means and do as they
// are told. Adding a journey later is a change in this file only.
// ---------------------------------------------------------------
//
// The three journeys:
//
//   TRAVELLER  has arrived, and nothing more. No card, no stories, no
//              Rite behind them. Everything is ahead.
//   EXPLORER   has been here before — started the Rite, kept a project,
//              maybe published — but has not yet become a Creator.
//   CREATOR    holds a claimed Magic Card. The card IS the definition,
//              which is not this file's invention: js/studioRite.js has
//              always tested exactly this, and CLAUDE.md's Studio Rite
//              decision grandfathers existing Creators by their claimed
//              card specifically. One definition, in one place, reused.

const JourneyResolver = (function () {
  'use strict';

  var TRAVELLER = 'traveller';
  var EXPLORER = 'explorer';
  var CREATOR = 'creator';

  // The Hall of Creation. Named once so that moving it is one edit,
  // and named as a destination rather than a file so the call sites
  // read as intent.
  var STUDIO = 'studio.html';

  function _isCreator() {
    try {
      return typeof MagicCard !== 'undefined' &&
             typeof MagicCard.list === 'function' &&
             MagicCard.list().length > 0;
    } catch (e) { return false; }
  }

  function _riteComplete() {
    try {
      return typeof StudioRite !== 'undefined' && StudioRite.isComplete();
    } catch (e) { return false; }
  }

  function _hasPublished() {
    try {
      return typeof MagicCard !== 'undefined' &&
             !!MagicCard.growthSignals().hasEverPublished;
    } catch (e) { return false; }
  }

  function _projectCount() {
    try {
      return typeof CreatorProjectStore !== 'undefined'
        ? CreatorProjectStore.list().length : 0;
    } catch (e) { return 0; }
  }

  function _publishedCount() {
    try {
      return typeof CreatorProjectStore !== 'undefined' &&
             typeof CreatorProjectStore.listPublished === 'function'
        ? CreatorProjectStore.listPublished().length : 0;
    } catch (e) { return 0; }
  }

  // Everything a surface could reasonably want to know, resolved once.
  function resolve() {
    var creator = _isCreator();
    var projects = _projectCount();
    var published = _publishedCount();
    var beenHere = _riteComplete() || _hasPublished() || projects > 0;

    return {
      journey: creator ? CREATOR : (beenHere ? EXPLORER : TRAVELLER),
      isCreator: creator,
      riteComplete: _riteComplete(),
      hasPublished: _hasPublished(),
      projects: projects,
      published: published,
      // Whether anything of theirs is drifting in the Ether right now.
      // Not the same question as "are they a Creator": a Creator with
      // no published Stories has an empty Ether and is still a Creator.
      hasStoriesInEther: published > 0
    };
  }

  // ---------- what the two buttons mean ----------
  //
  // Both return a DECISION, never a navigation. The resolver decides
  // what a tap means; the surface decides how that looks. Keeping the
  // two apart is what lets the same decision drive the home screen
  // today and, say, a Companion prompt later, without either of them
  // learning what a Magic Card is.

  // "Show me your stars."
  //
  // This asks the child to show the universe who they are, and it means
  // the same thing for everybody: open the sky and let them draw.
  //
  // No Creator check happens here, and that is the point rather than an
  // omission. Checking first would produce three different screens for
  // three kinds of arrival, and it would ask the software to decide who
  // somebody is before they have said. A Creator returning on a new
  // device is indistinguishable from a first-time Traveller by anything
  // this device can see — the only thing that can tell them apart is
  // the child's own sky, so that is what gets asked for, first, of
  // everyone. Recognition then belongs to js/creatorRecognition.js.
  //
  // A first-time Traveller is not stranded by this: they say "I don't
  // have one yet" and the Rite begins, which is the same door
  // `createStory()` opens below.
  function showMeYourStars() {
    return { action: 'stars' };
  }

  // What the drawn sky turned out to mean. Recognition itself is not
  // this file's job — it is asked and answered elsewhere — but where a
  // recognised Creator GOES is a journey decision and belongs here.
  //
  // Studio Home, never a story directly. Studio Home already owns story
  // management, and reopening their last story would be deciding on
  // their behalf what they came back for.
  function recognised() {
    return { action: 'studio', destination: STUDIO, journey: CREATOR };
  }

  // "I don't have one yet." The Rite is the path to becoming a Creator,
  // not a Studio tutorial, so this is the same decision as asking to
  // create — StudioRite.gate() runs it on the way in.
  function noCardYet(state) {
    return createStory(state);
  }

  // "I want to create a story."
  function createStory(state) {
    var s = state || resolve();
    // Both journeys arrive at the same place. The difference is that
    // the Studio runs the Starter Story Rite on the way in when it has
    // not been completed — StudioRite.gate() already decides that for
    // itself, and always has. Nothing here needs to launch the Rite;
    // it needs to know the Rite is what will happen, so a surface can
    // say something true before it does.
    return {
      action: 'studio',
      destination: STUDIO,
      rite: !s.isCreator && !s.riteComplete,
      journey: s.journey
    };
  }

  var api = {
    TRAVELLER: TRAVELLER,
    EXPLORER: EXPLORER,
    CREATOR: CREATOR,
    STUDIO: STUDIO,
    resolve: resolve,
    showMeYourStars: showMeYourStars,
    recognised: recognised,
    noCardYet: noCardYet,
    createStory: createStory
  };
  try { window.JourneyResolver = api; } catch (e) {}
  return api;
})();
