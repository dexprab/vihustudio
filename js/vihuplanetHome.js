// vihuplanetHome.js — VihuPlanet Home. The one entrance.
//
// Every child lands here: a first-time Traveller, a Returning
// Traveller, a first-time Creator and a Returning Creator, all on
// exactly this screen. Nobody bypasses it and nobody gets a different
// one. VihuPlanet is Home; the Studio is the Hall of Creation, and it
// is reached only through intent.
//
// THE TWO ACTIONS NEVER CHANGE. Not per child, not as a child grows.
// A tap is handed to js/journeyResolver.js, which is the only thing
// that decides what it means — so the home screen can stay still while
// everything behind it evolves. If a future milestone needs the home
// to behave differently, it teaches the resolver, not this file, and
// it never adds a third button.
//
// It also mounts the Ether and owns the things the runtime correctly
// knows nothing about:
//
//   STARS     Mark Your Stars — how VihuPlanet recognises a Creator.
//             Not a login: a child draws the constellation from their
//             Magic Card and the universe either knows that sky or
//             does not. js/creatorRecognition.js answers; this file
//             only asks and shows.
//   PREVIEW   what a met Spirit says about itself, and what can be
//             done with it (Stage 4)
//   PORTAL    stepping into a Story and coming back (Stage 5)
//   LINKS     every Story has a URL
//
// Stages 1 to 3 — discovery, approach, meet — are entirely the
// runtime's, and nothing here participates in them. This page listens
// for `focus:opened` and takes over from there.
//
// ---------------------------------------------------------------
// THE UNIVERSE IS NEVER TORN DOWN
//
// Reading a Story does not navigate anywhere and does not reload
// anything. The portal is an overlay; underneath it the same universe
// object stays alive with every Spirit exactly where it was. Its clock
// is stopped while the child reads — which costs nothing and freezes
// the state perfectly — and started again on the way out.
//
// So "the Traveller returns to the exact same position in the Ether"
// needs no restore step. There is nothing to restore, because nothing
// was ever lost. `universe.viewpoint()` exists as belt and braces and
// is not needed in the normal path.
// ---------------------------------------------------------------

(function () {
  'use strict';

  var PARAM = 'story';
  var BORN = 'born';

  // ---------------------------------------------------------------
  // Deep links.  .../vihuplanet/ether/?story=proj_m8x2k1_a7f3
  //
  // The project id, not the entity id — it is the stable identifier
  // the Story has everywhere else in VihuStudio, so a shared link
  // survives anything the runtime chooses to rename internally.
  //
  // What a shared link can and cannot do today, stated plainly: it
  // resolves for anyone whose Ether contains that Story. Today that is
  // the creator, including on another device once their Magic Card has
  // synced. It does NOT resolve for a stranger, because there is no
  // public VihuPlanet to read from — `creator_projects` is a private,
  // card-gated backup. This page handles the gap by saying so.
  // ---------------------------------------------------------------
  function linkedProjectId() {
    try { return new URLSearchParams(window.location.search).get(PARAM); }
    catch (e) { return null; }
  }

  // ---------------------------------------------------------------
  // A Story that has just been shared.  index.html?born=proj_m8x2k1
  //
  // Written by the Share ceremony as it hands the child over from the
  // Studio (js/publishStudio.js's _completeShare). It means one thing:
  // this Story joined the Ether seconds ago, so do NOT seed it with
  // the rest — hold it back and let the runtime's Story Birth bring it
  // in, so the child watches it ARRIVE instead of finding it already
  // sitting there among the others.
  //
  // Nothing downstream cares whether a Story arrived this way. It is a
  // presentation decision made once, at the door.
  // ---------------------------------------------------------------
  function bornProjectId() {
    try { return new URLSearchParams(window.location.search).get(BORN); }
    catch (e) { return null; }
  }

  function clearBorn() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete(BORN);
      // Consumed. A refresh should show the Ether as it now is, not
      // replay a birth that already happened.
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function setLink(projectId) {
    try {
      var url = new URL(window.location.href);
      if (projectId) url.searchParams.set(PARAM, projectId);
      else url.searchParams.delete(PARAM);
      // replaceState, not pushState: turning through the Ether and
      // meeting Spirits is browsing, not navigating. Every glance
      // should not become a back-button step to unwind.
      window.history.replaceState(null, '', url.toString());
    } catch (e) {}
  }

  function projectIdOf(entity) {
    return (entity && entity.source && entity.source.projectId) || null;
  }

  // A Canon Story: made by the VihuPlanet team, owned by nobody, and
  // shipped with the application. A child never learns the distinction
  // exists — this page only asks so it can avoid saying something
  // untrue about one.
  function isCanon(entity) {
    return !!(entity && entity.source && entity.source.origin === 'canon');
  }

  // ---------- cheers ----------
  //
  // A Cheer is a small act of magic from one Creator that gives
  // another Creator's story a little energy, and the story grows for
  // it. Everything real about it — the count, the one-per-Creator
  // rule, the growth threshold — lives in js/cheer.js; this is only
  // the button.
  //
  // The old local-only version stayed exactly true while there was
  // nobody else in VihuPlanet to send starlight to. There is now.
  function hasCheered(id) {
    try { return (typeof Cheer !== 'undefined') ? Cheer.mine(id) : false; }
    catch (e) { return false; }
  }
  // What the button says, and it says NO NUMBER.
  //
  // It carried a small `✨ 3` — the sprint allowed a quiet count and I
  // put it here. The product owner has taken it off, and the screen is
  // better for it: a figure on a button is a score however small it is
  // set, and it invites a child to compare their story against another
  // one rather than to look at either.
  //
  // Nothing is lost that a child can use. The count is still kept, and
  // it is what decides growth — but growth is the thing they SEE, and
  // starlight around a story says everything the number was saying
  // without asking anybody to read.
  function cheerLabel(id) {
    return hasCheered(id) ? 'Cheered' : 'Cheer';
  }

  function whenShared(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    } catch (e) { return ''; }
  }

  // ---------------------------------------------------------------
  function boot() {
    var mount = document.querySelector('[data-universe]');
    if (!mount || !window.VihuPlanet) return;

    var universe = VihuPlanet.Universe.create({ mount: mount });
    if (!universe) return;

    // The universe starts before the Stories arrive, always. It is
    // alive on its own, so there is nothing to wait for and no loading
    // state to show.
    universe.start();
    window.vihuPlanetUniverse = universe;

    var el = {
      quiet:    document.querySelector('[data-quiet]'),
      quietLine:document.querySelector('[data-quiet-line]'),
      preview:  document.querySelector('[data-preview]'),
      title:    document.querySelector('[data-preview-title]'),
      creator:  document.querySelector('[data-preview-creator]'),
      meta:     document.querySelector('[data-preview-meta]'),
      read:     document.querySelector('[data-act="read"]'),
      cheer:    document.querySelector('[data-act="cheer"]'),
      back:     document.querySelector('[data-act="back"]'),
      portal:   document.querySelector('[data-portal]'),
      page:     document.querySelector('[data-portal-page]'),
      pageNo:   document.querySelector('[data-portal-count]'),
      prev:     document.querySelector('[data-portal-prev]'),
      next:     document.querySelector('[data-portal-next]'),
      close:    document.querySelector('[data-portal-close]'),
      portalTitle: document.querySelector('[data-portal-title]'),
      portalCreator: document.querySelector('[data-portal-creator]')
    };

    var met = null;      // the entity currently being met
    var pages = [];
    var audio = [];   // narration, one slot per page, aligned with `pages`
    var audioOwner = null;  // who recorded it, for a Story shared by somebody else
    var pageIndex = 0;

    // ---------- the threshold ----------
    //
    // One tap before the universe is handed over. It is not a loading
    // screen — the Ether is already alive behind it, and has been since
    // the moment the page opened — it is the moment of arriving
    // somewhere, which is a different thing and worth one tap.
    var thresholdEl = document.querySelector('[data-threshold]');
    var actionsEl = document.querySelector('[data-actions]');

    // Whether the child is actually looking at the universe yet, and
    // what is waiting for the moment they are. A Story Birth held until
    // the threshold is crossed is the only thing that uses it today.
    var thresholdCrossed = false;
    var onThreshold = null;

    function crossThreshold() {
      if (!thresholdEl || thresholdEl.classList.contains('is-gone')) return;

      // The music starts HERE, and this is the one place it can.
      //
      // Browsers block every un-muted audio.play() until a genuine user
      // gesture in this document, so ambience has to begin inside a
      // real handler — synchronously, before any await or timeout, or
      // the gesture is spent and the play() is blocked anyway. That is
      // exactly what the Traveller Gateway's own "Tap to Begin" did
      // before VihuPlanet took over the threshold; the tap moved, so
      // the music moved with it.
      //
      // The Studio is a separate document and cannot inherit this — its
      // own audio still starts on the child's first touch there (see
      // beginNow() in js/gatewaySequence.js). This makes VihuPlanet
      // itself sound like somewhere, which is where a child now spends
      // their time.
      try {
        if (typeof AudioManager !== 'undefined') {
          AudioManager.init();
          AudioManager.playFoundation();
        }
      } catch (e) {}

      thresholdEl.classList.add('is-gone');
      window.setTimeout(function () { thresholdEl.hidden = true; }, 900);

      // CROSSING THE THRESHOLD IS A THING THAT HAPPENS TO THE UNIVERSE.
      //
      // Two answers, and both use seams the runtime already exposes —
      // nothing in vihuplanet/runtime/ is touched, which is Decision 9's
      // whole test for a system plugging in rather than modifying.
      enterTheEther();
      if (actionsEl) {
        actionsEl.hidden = false;
        // Two frames so the browser has laid them out before they
        // start arriving.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { actionsEl.classList.add('is-in'); });
        });
      }

      thresholdCrossed = true;
      if (onThreshold) {
        var run = onThreshold;
        onThreshold = null;
        run();
      }
    }

    var beginBtn = document.querySelector('[data-begin]');
    if (beginBtn) beginBtn.addEventListener('click', crossThreshold);
    if (thresholdEl) {
      thresholdEl.addEventListener('click', crossThreshold);
      thresholdEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') crossThreshold();
      });
    }

    // ---------- crossing in ----------
    //
    // A starlight goes into the Ether, and the Ether turns.
    //
    // The turn is the teaching, and it is why it is a turn rather than
    // a flourish. Nothing on this screen says the universe can be
    // looked around — Decision 9 puts the Traveller at the centre with
    // the universe rotating about them, which is only discoverable by
    // discovering it. So the first thing a child sees the universe do
    // is the exact thing they can do to it, once, gently, and never
    // again. It is a demonstration disguised as an arrival.
    //
    // MEASURED IN TURNS, NOT RADIANS.
    //
    // camera.js: `offset.x = (yaw / 2π) * ether.width`, so one full turn
    // of yaw is exactly one field width — which is Decision 9's own
    // definition of the universe closing on itself. Saying "a quarter of
    // a turn" therefore says something true about the universe, where a
    // raw radian figure would just be a number that happened to look
    // right on one screen.
    //
    // A quarter turn moves the whole sky by roughly a third of a screen
    // at the story layer: stories visibly travel, new sky arrives behind
    // them, and every parallax layer moves at its own rate — which is
    // the thing that cannot be mistaken for an animation on top of a
    // still picture. A first attempt at a twentieth of a turn moved 75px
    // and read as nothing at all.
    //
    // Still not a spin. Three and a half seconds of easeOut is a slow
    // sweep that settles, and "calm before spectacle" survives it: the
    // universe is doing one deliberate thing, not performing.
    // NEVER THE SAME TWICE.
    //
    // A fixed turn is an intro: watch it three times and it is a title
    // sequence, something the product plays AT a child. A turn that
    // differs every arrival — a little further, the other way round, a
    // touch more lift — is the universe doing something, which is the
    // whole difference between an animation and a place.
    //
    // Math.random, deliberately, and not the runtime's seeded Rng. The
    // seeded generator exists so every viewer sees the SAME Ether;
    // this is one visitor's own arrival and has no business being
    // shared or reproducible.
    var TWIRL_MIN_TURNS = 0.18;
    var TWIRL_MAX_TURNS = 0.34;
    // The PACE is what is held steady, not the distance — so a longer
    // turn takes proportionally longer rather than moving faster, and
    // every arrival is the same unhurried speed whatever it decides to
    // do. Bounded at both ends so a short one is still slow and a long
    // one never outstays the moment.
    var TWIRL_TURNS_PER_SEC = 0.052;
    var TWIRL_MIN_MS = 4200;
    var TWIRL_MAX_MS = 6500;

    function _rand(lo, hi) { return lo + Math.random() * (hi - lo); }
    function _coin() { return Math.random() < 0.5 ? -1 : 1; }

    // ---------- the invitation ----------
    //
    // "A subtle, curious way of saying move around and explore."
    //
    // Wordless, on purpose. There is not one instruction anywhere in
    // VihuPlanet and this would be the first; it would also have to be
    // READ, which rules out a good share of the children it is for.
    //
    // So it is a GLANCE. If the universe has not been turned for a
    // while, it leans a little one way and comes back — the movement a
    // person makes when something catches their eye, which is the one
    // gesture that means "look over there" without saying it. The
    // Traveller is still at the centre and nothing has actually moved
    // in the field; it is the viewpoint being curious.
    //
    // Three rules keep it an invitation rather than a nag:
    //   · it waits, so a child already exploring is never interrupted;
    //   · it STOPS FOREVER the moment they turn the universe
    //     themselves — the question has been answered;
    //   · it gives up after a few tries, because a place that keeps
    //     asking is a place that is nagging.
    var GLANCE_AFTER_S = 11;     // stillness before the first one
    var GLANCE_SPACING_S = 14;   // and between the ones after it
    var GLANCE_TRIES = 3;
    var GLANCE_TURNS = 0.055;    // a fifth of the arrival turn
    var GLANCE_OUT_MS = 1100;
    var GLANCE_BACK_MS = 1700;

    var glanceTimer = null;
    var glancesGiven = 0;
    var glanceLastStill = 0;

    function watchForStillness() {
      if (glanceTimer) return;
      glanceTimer = window.setInterval(function () {
        var u = universe;
        if (!u || !u.traveller || !u.traveller.stillSeconds) return stopWatching();
        var still = u.traveller.stillSeconds();

        // They turned it. That is the whole answer — never ask again.
        if (still < glanceLastStill - 0.4) return stopWatching();
        glanceLastStill = still;

        // A Spirit being met holds the universe still on purpose
        // (traveller is disabled), and leaning during that would pull
        // the story out from under them.
        if (u.focus && u.focus.isOpen && u.focus.isOpen()) return;

        var due = GLANCE_AFTER_S + glancesGiven * GLANCE_SPACING_S;
        if (still < due) return;

        glancesGiven++;
        glance();
        if (glancesGiven >= GLANCE_TRIES) stopWatching();
      }, 700);
    }

    function stopWatching() {
      if (glanceTimer) { window.clearInterval(glanceTimer); glanceTimer = null; }
    }

    // Out, then back. The return is slower than the departure, which is
    // what makes it read as a look rather than a wobble.
    function glance() {
      var u = universe;
      if (!u || !u.camera || !u.camera.look) return;
      var yaw = Math.PI * 2 * GLANCE_TURNS * _coin();
      sweep(yaw, GLANCE_OUT_MS, function () {
        sweep(-yaw, GLANCE_BACK_MS);
      });
    }

    // One eased movement of `total` radians over `ms`, differenced per
    // frame so the sum is exact however the frames land.
    function sweep(total, ms, done) {
      var u = universe;
      var started = null, lastT = 0;
      (function step(now) {
        if (started === null) started = now;
        var t = Math.min(1, (now - started) / ms);
        var eased = 1 - Math.pow(1 - t, 3);
        u.camera.look((eased - lastT) * total, 0);
        lastT = eased;
        if (t < 1) window.requestAnimationFrame(step);
        else if (done) done();
      })(performance.now());
    }

    function enterTheEther() {
      var u = universe;
      if (!u) return;

      // The starlight. `shootNow()` is the Ambient System's own shooting
      // star, already exposed for exactly this — a light crossing the
      // Ether, in the universe's own visual language rather than a new
      // effect invented for one moment.
      try {
        if (u.ambient && u.ambient.shootNow) {
          window.setTimeout(function () { u.ambient.shootNow(); }, 220);
        }
      } catch (e) {}

      // The turn. camera.look() adds to the target and the camera eases
      // toward it on its own, so handing it the whole angle in small
      // pieces produces one smooth movement that decelerates into
      // stillness — no keyframes, and it composes with the involuntary
      // drift instead of fighting it.
      try {
        if (!u.camera || !u.camera.look) return;
        var reduced = false;
        try {
          reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {}
        // A child who has asked for less motion is told the same thing
        // by the story lights alone: no arrival turn, and no glances
        // either — both are camera movement they did not ask for.
        if (reduced) return;

        // Decided once, here, for this arrival only.
        var turns = _rand(TWIRL_MIN_TURNS, TWIRL_MAX_TURNS) * _coin();
        // The lift takes its own coin, so the universe is not always
        // turning down-and-left or up-and-right like a hinge.
        var pitchTurns = _rand(0.015, 0.045) * _coin();
        var yawTotal = Math.PI * 2 * turns;
        var pitchTotal = Math.PI * 2 * pitchTurns;
        var ms = Math.max(TWIRL_MIN_MS,
                 Math.min(TWIRL_MAX_MS, Math.abs(turns) / TWIRL_TURNS_PER_SEC * 1000));

        var started = null;
        var lastT = 0;
        (function step(now) {
          if (started === null) started = now;
          var t = Math.min(1, (now - started) / ms);
          // easeOutCubic on the TOTAL, differenced each frame, so the
          // sum is exactly yawTotal however the frames land.
          var eased = 1 - Math.pow(1 - t, 3);
          u.camera.look((eased - lastT) * yawTotal, (eased - lastT) * pitchTotal);
          lastT = eased;
          if (t < 1) window.requestAnimationFrame(step);
          else {
            // The arrival has said its piece. From here the universe
            // waits, and only asks again if nobody has answered.
            glanceLastStill = 0;
            watchForStillness();
          }
        })(performance.now());
      } catch (e) {}
    }

    // ---------- the two permanent actions ----------
    // THE ONE DOOR INTO THE STUDIO, and therefore the one place the
    // screen is ever asked about.
    //
    // All four ways in come through here — the two permanent actions,
    // the camera's confirmed recognition, and the drawing board's — so
    // a phone is turned back once, in one place, rather than by four
    // checks that could disagree.
    //
    // Deliberately AFTER recognition rather than before it. A child on
    // a phone is still recognised, still committed, still known; what
    // they cannot do is open the Studio. Checking first would refuse to
    // look at their stars at all, which is a different and much colder
    // product.
    function goStudio(decision) {
      if (typeof DeviceGate !== 'undefined' && !DeviceGate.canOpenStudio()) {
        openBigger(decision && decision.journey === JourneyResolver.CREATOR);
        return;
      }
      window.location.href = (decision && decision.destination) || JourneyResolver.STUDIO;
    }

    // ---------- a bigger screen ----------
    var biggerEl = document.querySelector('[data-bigger]');
    function openBigger(recognised) {
      if (!biggerEl) {
        // Nothing to show is not a reason to send a phone somewhere it
        // cannot work — it is a reason to do nothing at all.
        return;
      }
      // Whatever asked the question is finished with. Left open, the
      // board and its buttons sit behind this panel still offering
      // Continue and "I Don't Have One Yet" — two answers to a question
      // that has already been answered.
      try { closeStars(); } catch (e) {}
      try { closeCardScan({ keepUniverseStill: true }); } catch (e) {}

      var known = biggerEl.querySelector('[data-bigger-known]');
      if (known) known.hidden = !recognised;
      biggerEl.hidden = false;
      // Next frame, so the transition has a closed state to run from.
      window.requestAnimationFrame(function () { biggerEl.classList.add('is-open'); });
    }
    function closeBigger() {
      if (!biggerEl) return;
      biggerEl.classList.remove('is-open');
      window.setTimeout(function () { biggerEl.hidden = true; }, 260);
    }
    if (biggerEl) {
      biggerEl.addEventListener('click', function (ev) {
        // The veil closes it too: the universe is still running behind
        // this and leaving costs nothing.
        if (ev.target.closest('[data-bigger-act="away"]') ||
            ev.target.hasAttribute('data-bigger-veil')) closeBigger();
      });
    }

    if (actionsEl) {
      actionsEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-act]');
        if (!btn) return;

        // The buttons ask what a tap means and do as they are told.
        // Neither of them knows what a Magic Card is.
        var decision = (btn.getAttribute('data-act') === 'stars')
          ? JourneyResolver.showMeYourStars()
          : JourneyResolver.createStory();

        if (decision.action === 'stars') { openCardScan(); return; }
        goStudio(decision);
      });
    }

    // ---------------------------------------------------------------
    // Mark Your Stars — recognition.
    //
    // Everyone who asks gets this screen: no Creator check in front of
    // it, no Lumo, no dialogue, no account, no login. A Creator
    // returning on a new device is indistinguishable from a first-time
    // Traveller by anything this browser can see, so the only honest
    // thing to ask is the one thing that CAN tell them apart — and to
    // ask it of everybody, the same way.
    //
    // It is an overlay, exactly as the portal is. The universe is never
    // torn down; it keeps drifting behind the sky the child is drawing
    // on, which is what makes this feel like being recognised by
    // somewhere rather than logged into something. Turning is suspended
    // while it is open, because the arrow keys belong to the board.
    // ---------------------------------------------------------------
    var starsEl = document.querySelector('[data-stars]');
    var starsSky = document.querySelector('[data-stars-sky]');
    var starsStatus = document.querySelector('[data-stars-status]');
    var starsActions = document.querySelector('[data-stars-actions]');
    var starsRetry = document.querySelector('[data-stars-actions-retry]');
    var starsVeil = document.querySelector('[data-stars-veil]');

    // Three, matching the Studio's own sky challenge. Few enough that
    // nobody grinds at it, many enough that a slip is never the end.
    var TRIES = 3;
    var board = null;
    var lostForm = null;      // the recover-by-grown-up field, when open
    var againRow = null;      // "it didn't arrive", after a send
    var attempts = 0;
    var asking = false;

    function say(line, tone) {
      if (!starsStatus) return;
      starsStatus.textContent = line || '';
      starsStatus.className = 'vp-stars-status' + (tone ? ' is-' + tone : '');
    }

    function freshAsk() {
      if (starsActions) starsActions.hidden = false;
      if (starsRetry) starsRetry.hidden = true;
      if (lostForm) { lostForm.remove(); lostForm = null; }
      if (againRow) { againRow.remove(); againRow = null; }
      var lostBtn = starsEl && starsEl.querySelector('[data-stars-act="lost"]');
      if (lostBtn) lostBtn.hidden = false;
      attempts = 0;
      say('');
      if (board) board.clear();
    }

    function openStars(seen) {
      if (!starsEl || !window.ConstellationBoard) return;

      if (!board) {
        board = ConstellationBoard.create({
          mount: starsSky,
          // The recovery email names every star as "row 3, column 5".
          // This is the screen those words are read against, so it is
          // the one board that shows them.
          labels: true,
          // Any change to the sky clears whatever was last said about
          // it. A child who has started drawing again should not still
          // be reading the answer to the sky before this one — and
          // "send it again" answers that same line, so it goes with it
          // rather than being left pointing at nothing.
          onChange: function () {
            if (asking) return;
            say('');
            if (againRow) { againRow.remove(); againRow = null; }
          }
        });
      }
      freshAsk();

      starsEl.hidden = false;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          starsEl.classList.add('is-open');
          // The lines are drawn from measured pixel positions, so the
          // board has to be laid out before it can draw any.
          if (board) board.reflow();
        });
      });
      universe.traveller.setEnabled(false);
      document.querySelector('.vp-home').classList.add('is-marking');

      // WHAT THE CAMERA SAW, ALREADY MARKED.
      //
      // The camera stops trying to be right and starts being useful.
      // Every failure of the last several days was the reader being
      // APPROXIMATELY right and being refused for it — and
      // approximately right is worth a great deal once a child can look
      // at it. A star a cell out costs one tap instead of a dead end.
      //
      // It also removes the last difference between a familiar machine
      // and a new one: there is only one recognition path left, the
      // exact match that has always worked everywhere, and the camera
      // is an input helper rather than an authority.
      // Offered only to a child who arrived from the camera: they still
      // have the card in their hand, and another look at it is the
      // shortest way to a better reading.
      var cameraBtn = starsEl.querySelector('[data-stars-act="camera"]');
      if (cameraBtn) cameraBtn.hidden = !(seen && seen.length);
      if (seen && seen.length && board.set) {
        // DRAWN IN THE ORDER THE SKY IS TRACED IN.
        //
        // The board joins its stars in the order it is handed them, and
        // the camera hands them over in whatever order the blob
        // detector found them. So a card read perfectly — every cell
        // right — came out as a zig-zag where the card itself draws a
        // clean cross, and a child comparing the two sees the wrong
        // constellation. "Quite near to what it should be but still not
        // what it should be" was exactly this, and it was never a
        // reading error at all.
        //
        // Any real card's cells are one of five known shapes under a
        // rotation, an optional mirror and a translation, so the sky
        // can be identified from the cells alone and traced the way it
        // is meant to be. A sky that matches nothing is passed through
        // untouched: a child's own drawing is whatever they drew.
        // TRACED LIKE THE CONSTELLATION, NOT LIKE THE SEARCH.
        //
        // The board joins stars in the order it is handed them, and the
        // camera hands them over in the order the blob detector found
        // them — which is not an order anybody chose or saw. Drawing it
        // produced a correct set of stars joined into a zig-zag, and
        // "the lines between stars are wrong" is exactly right.
        //
        // This changes nothing that is stored. The card's own pattern
        // is its identity and is never touched; the Studio's card still
        // draws it exactly as stored. This is the BOARD, working out how
        // to draw a sky whose order was never observed.
        //
        // The card's own order wins whenever this device holds the card,
        // because then the answer is known rather than derived — which
        // also settles the symmetric case, where a derived order is a
        // genuine guess (CYGNUS's cross maps onto its own cells under
        // all eight transforms).
        var marked = seen, sure = false;
        try {
          var setKey = function (list) {
            return (list || []).map(function (p) { return p[0] + ',' + p[1]; })
              .sort().join(' ');
          };
          var want = setKey(seen), own = null;
          var held = (typeof MagicCard !== 'undefined' && MagicCard.list)
            ? MagicCard.list() : [];
          for (var ci = 0; ci < held.length; ci++) {
            if (held[ci] && held[ci].pattern && setKey(held[ci].pattern) === want) {
              own = held[ci].pattern; break;
            }
          }
          if (own) { marked = own; sure = true; }
          else if (typeof MagicCard !== 'undefined' && MagicCard.orderLikeAnySky) {
            marked = MagicCard.orderLikeAnySky(seen) || seen;
            // Derived — which is a fact for most skies and a coin toss
            // for a few. MagicCard compares the SEGMENTS every possible
            // placement would draw, so this is "would the line differ",
            // not "is the shape symmetric".
            sure = !!(MagicCard.traceIsCertain && MagicCard.traceIsCertain(seen));
          }
        } catch (e) { marked = seen; }
        // NO LINE RATHER THAN THE WRONG ONE.
        //
        // CYGNUS is the case that forced this: a perfect cross whose
        // card traces Bottom-Centre-Right-Top-Left while the derived
        // order traces Top-Centre-Left-Bottom-Right. Same five stars,
        // same cross, one hundred and eighty degrees apart — and a real
        // card reported it as "came inverse", which it was.
        //
        // Every star is still lit and still checkable against the card.
        // What is withheld is only the part a photograph cannot answer,
        // and only for the skies where it genuinely cannot: CASSIOPEIA
        // also fits two placements and both draw the same segments, so
        // its line is certain and is drawn. The child's first tap makes
        // the order theirs and the line returns.
        try { board.set(marked, { noLine: !sure }); } catch (e) {}
        say('Are these your stars?');
      }
    }

    // ---------------------------------------------------------------
    // ⭐ SHOW ME YOUR STARS — taken literally.
    //
    // A child tapped this and held their Magic Card up to the camera.
    // Nobody taught them that; it is simply what the words mean. So the
    // camera opens first, and drawing the sky by hand becomes the way
    // in when the card cannot be shown — never a lesser one.
    //
    // Nothing here is a new identity system. The pattern the camera
    // reads goes to CreatorRecognition.recognise(), the same call the
    // drawing board makes, and success runs the same three lines the
    // board's own success runs. That is what makes a brand-new machine
    // work: the card is the bridge, not the browser.
    // ---------------------------------------------------------------
    var scanEl = document.querySelector('[data-scan]');
    var scanVideo = scanEl && scanEl.querySelector('[data-scan-video]');
    var scanWindow = scanEl && scanEl.querySelector('.vp-scan-window');
    var scanLine = scanEl && scanEl.querySelector('[data-scan-line]');
    var scanActions = scanEl && scanEl.querySelector('[data-scan-actions]');
    var scanStream = null;
    var scanner = null;
    var scanBusy = false;
    var scanState = null;
    var steadyFor = 0;
    var counting = null;
    var capturing = false;
    var scanPatienceSaid = false;
    var nudge = 0;
    // Long enough for the portal to finish opening; the class is only
    // dropped so the next arrival can play it again.
    var PORTAL_MS = 900;
    var portalTimer = null;

    function scanSay(text) { if (scanLine) scanLine.textContent = text; }

    // ---------------------------------------------------------------
    // READ ONLY WHAT THE CHILD CAN SEE.
    //
    // The first photograph from a real camera in a real room said this
    // outright, and no simulated scene ever would have. The reader had
    // found fourteen marks and kept ten of them as stars — on a bicycle
    // helmet, a shelf and a window frame. The card was a small bright
    // thing off to one side, and the registration quad had latched onto
    // furniture. Every fix before this was aimed at telling a star from
    // a numeral, when the actual problem was that half the room was in
    // the picture at all.
    //
    // And the child never saw that room. The camera window is the
    // card's own shape, portrait, and the stream is landscape, and the
    // video is object-fit: cover — so roughly the middle 40% of the
    // camera's width is displayed and the rest is cropped away on
    // screen ONLY. The child aims the card at what they can see; the
    // reader was searching a frame two and a half times wider, full of
    // things nobody chose to photograph.
    //
    // So the analysis is cropped to exactly what the window shows, and
    // then to the guide inside it. Three things follow, all of them
    // wanted: the clutter is gone, the card is a far larger share of
    // the pixels that remain, and the dashed guide finally MEANS
    // something — it is now the boundary of what is read, rather than
    // decoration over a reader that ignored it.
    //
    // The inset matches .vp-scan-hold's own 7%, so the promise the
    // interface makes and the region the reader uses cannot drift.
    var HOLD_INSET = 0.07;

    function holdCrop(source) {
      var sw = source.videoWidth || source.naturalWidth || source.width;
      var sh = source.videoHeight || source.naturalHeight || source.height;
      if (!sw || !sh) return source;

      // What object-fit: cover is showing. Scale to fill, then only the
      // middle of the longer axis survives.
      var box = scanWindow ? scanWindow.getBoundingClientRect() : null;
      var tw = (box && box.width) || sw;
      var th = (box && box.height) || sh;
      if (!tw || !th) return source;
      var scale = Math.max(tw / sw, th / sh);
      var visW = Math.min(sw, tw / scale);
      var visH = Math.min(sh, th / scale);

      var cw = visW * (1 - HOLD_INSET * 2);
      var ch = visH * (1 - HOLD_INSET * 2);
      var cx = (sw - cw) / 2;
      var cy = (sh - ch) / 2;
      if (!(cw > 16 && ch > 16)) return source;

      var c = document.createElement('canvas');
      c.width = Math.round(cw);
      c.height = Math.round(ch);
      try {
        c.getContext('2d').drawImage(source, cx, cy, cw, ch, 0, 0, c.width, c.height);
      } catch (e) { return source; }
      return c;
    }

    // ---------------------------------------------------------------
    // RECOGNISED. The camera goes off, and the sky comes up.
    //
    // Two things were wrong with simply navigating. The camera stayed
    // ON through the hand-off — the light was still lit, still
    // reading, for a card that had already been seen — and there is
    // nothing left to look at through a lens once it has. And the
    // moment itself was skipped: the brief calls for the stars to
    // awaken before the Studio opens, so a child sees THEIR OWN
    // constellation and knows it was theirs that was recognised, not
    // merely that something happened.
    //
    // So: stop looking, put the card's sky where the camera was, and
    // only then move on.
    // ---------------------------------------------------------------
    function skyRecognised(card) {
      // The camera first, before anything is drawn. Nothing about this
      // moment needs it, and a child holding a card should see the
      // light go out.
      if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
      if (typeof MagicCardVision !== 'undefined') {
        try { MagicCardVision.closeCamera(scanStream); } catch (e) {}
      }
      scanStream = null;
      try { if (scanVideo) { scanVideo.pause(); scanVideo.srcObject = null; } } catch (e) {}
      if (scanWaitTimer) { window.clearTimeout(scanWaitTimer); scanWaitTimer = null; }
      if (scanActions) scanActions.hidden = true;
      if (scanWindow) scanWindow.classList.remove('is-seeing');

      scanSay('There you are.');
      drawTheSky(card && card.pattern);
      confirmSky(card);
    }

    // ---------------------------------------------------------------
    // SHOWN, NOT ASSUMED.
    //
    // The product owner's decision, and it amends Decision 11's
    // "recognition is instant and silent — no confirmation screen".
    // The reasoning is the child's rather than the system's: being told
    // who you are is not the same as agreeing, and a Magic Card opens
    // somebody's whole creative life. Ten seconds with your own
    // constellation drawn back to you, and a way to say no, costs a
    // returning Creator almost nothing and gives them the last word.
    //
    // IT IS A COUNTDOWN, NOT A QUESTION. Nothing has to be pressed to
    // continue — the door is already opening, and the child is simply
    // able to stop it. A prompt that required an answer would turn
    // every arrival into a form.
    //
    // NOTHING IS COMMITTED UNTIL IT ELAPSES. setActive() and
    // markRecognised() used to run the instant a match was found;
    // choosing "that's not me" afterwards would have left this browser
    // believing it, and the Studio's own Gateway would have skipped its
    // question on the strength of a recognition the child rejected.
    var confirmTimer = null, confirmCard = null;
    var CONFIRM_SECONDS = 10;

    function confirmSky(card) {
      confirmCard = card;
      var box = scanEl && scanEl.querySelector('[data-scan-confirm]');
      var line = scanEl && scanEl.querySelector('[data-scan-confirm-line]');
      var who = (card && card.nickname) ? String(card.nickname).trim() : '';

      if (!box || !line) { enterStudio(); return; }
      box.hidden = false;
      var left = CONFIRM_SECONDS;

      function say(n) {
        line.textContent = who
          ? 'Welcome back, ' + who + '. Opening your Studio in ' + n + '…'
          : 'This is your sky. Opening your Studio in ' + n + '…';
      }
      say(left);

      confirmTimer = window.setInterval(function () {
        left--;
        if (left > 0) { say(left); return; }
        window.clearInterval(confirmTimer); confirmTimer = null;
        enterStudio();
      }, 1000);
    }

    function enterStudio() {
      var card = confirmCard;
      if (confirmTimer) { window.clearInterval(confirmTimer); confirmTimer = null; }
      // Committed only now.
      try { if (card && card.id) MagicCard.setActive(card.id); } catch (e) {}
      try { CreatorRecognition.markRecognised(card && card.id); } catch (e) {}
      closeCardScan({ keepUniverseStill: true });
      goStudio(JourneyResolver.recognised());
    }

    // "That's not me." Nothing is committed, nothing is blamed, and the
    // camera simply comes back — the child is where they were before
    // anybody claimed to know them.
    function notMe() {
      if (confirmTimer) { window.clearInterval(confirmTimer); confirmTimer = null; }
      confirmCard = null;
      var box = scanEl && scanEl.querySelector('[data-scan-confirm]');
      if (box) box.hidden = true;
      closeCardScan();
      openCardScan();
    }

    // The child's own constellation, drawn as the Ether draws stars:
    // light first, joined by a thread, on the dark. Deliberately not a
    // picture of the card — the card has been put down.
    function drawTheSky(pattern) {
      var canvas = scanEl && scanEl.querySelector('[data-scan-sky]');
      if (!canvas) return;
      canvas.hidden = false;
      if (scanVideo) scanVideo.style.visibility = 'hidden';
      var hold = scanEl.querySelector('[data-scan-hold]');
      if (hold) hold.style.display = 'none';
      if (!pattern || !pattern.length) return;

      var box = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
      var x = canvas.getContext('2d');
      x.scale(dpr, dpr);

      var pad = Math.min(box.width, box.height) * 0.16;
      var side = Math.min(box.width, box.height) - pad * 2;
      var cell = side / 10;
      var ox = (box.width - side) / 2, oy = (box.height - side) / 2;
      var pts = pattern.map(function (p) {
        return { x: ox + (p[1] + 0.5) * cell, y: oy + (p[0] + 0.5) * cell };
      });

      // The thread between them. Faint when this was only a flourish
      // on the way through; the child is now being ASKED whether this
      // is their sky, so it has to be legible enough to answer.
      if (pts.length > 1) {
        x.strokeStyle = 'rgba(255, 226, 160, 0.5)';
        x.lineWidth = 2;
        x.beginPath();
        pts.forEach(function (p, i) { if (i === 0) x.moveTo(p.x, p.y); else x.lineTo(p.x, p.y); });
        x.stroke();
      }
      pts.forEach(function (p) {
        x.save();
        x.shadowColor = 'rgba(255, 214, 128, 0.95)';
        x.shadowBlur = 22;
        x.fillStyle = '#FFF6E2';
        x.beginPath();
        x.arc(p.x, p.y, Math.max(3.5, cell * 0.2), 0, Math.PI * 2);
        x.fill();
        x.restore();
      });
    }

    function closeCardScan(opts) {
      if (!scanEl || scanEl.hidden) return;
      stopCountdown(false);
      capturing = false;
      if (scanWaitTimer) { window.clearTimeout(scanWaitTimer); scanWaitTimer = null; }
      if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
      if (typeof MagicCardVision !== 'undefined') {
        try { MagicCardVision.closeCamera(scanStream); } catch (e) {}
      }
      scanStream = null;
      scanBusy = false;
      scanEl.hidden = true;
      scanEl.classList.remove('is-opening');
      if (portalTimer) { window.clearTimeout(portalTimer); portalTimer = null; }
      if (scanWindow) {
        scanWindow.classList.remove('is-seeing');
        scanWindow.classList.remove('is-live');
      }
      if (!(opts && opts.keepUniverseStill)) universe.traveller.setEnabled(true);
    }

    // IT KEEPS LOOKING. ALWAYS.
    //
    // "We are building for kids. We need to be patient and fail and
    // recover gracefully." So a reading that belongs to nobody does not
    // end anything: the camera stays on, the child keeps holding their
    // card, and it tries again by itself. There is no limit on tries,
    // no lockout, and nothing a child must press to be allowed another
    // go — the buttons are there for the child who WANTS a different
    // way, never as a toll for failing.
    //
    // `fatal` is the one exception, and it is not a failure to read: no
    // camera, or permission refused. There is nothing to keep looking
    // WITH, so that one stops and offers the two ways on.
    function scanFailed(line, fatal) {
      if (scanWaitTimer) { window.clearTimeout(scanWaitTimer); scanWaitTimer = null; }
      scanBusy = false;
      if (scanWindow) scanWindow.classList.remove('is-seeing');
      if (scanAgainBtn) scanAgainBtn.hidden = false;
      // Never "failed", "invalid", "not found" or "verification". A
      // child's stars are never wrong; they are only, sometimes, not
      // yet seen.
      scanSay(line);
      if (scanActions) scanActions.hidden = false;

      if (fatal) {
        if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
        return;
      }
      // A short breath before looking again, so it does not spend the
      // next second re-reading the same unlucky frame, and so the line
      // above is actually readable.
      scanState = null;
      window.setTimeout(function () {
        if (!scanEl || scanEl.hidden || !scanner) return;
        try { scanner.resume(); } catch (e) {}
      }, 1400);
    }

    var scanAgainBtn = scanEl && scanEl.querySelector('[data-scan-act="again"]');
    var scanWaitTimer = null;

    // How long the camera looks before offering a way on. A child
    // holding a card up gets a few seconds of nothing happening; a
    // child with no card gets a dead end unless something breaks the
    // silence.
    var SCAN_PATIENCE_MS = 11000;

    // ---------------------------------------------------------------
    // ?cardcheck=1 — what the camera actually sees, live.
    //
    // Five rounds of this have been fixed against simulated rooms and
    // have then failed on a real card in a real hand, which is a method
    // that is guessing. This stops the guessing: it puts the detector's
    // own numbers on screen while the card is held up, so the next fix
    // is aimed at a measurement instead of at an idea of one.
    //
    // Off unless asked for, out of the way, and it changes nothing
    // about how recognition behaves.
    var checking = false;
    try { checking = new URLSearchParams(window.location.search).get('cardcheck') === '1'; }
    catch (e) {}
    var checkEl = null;

    function showCheck() {
      if (!checking || !MagicCardVision.look) return;
      if (!checkEl) {
        checkEl = document.createElement('div');
        checkEl.style.cssText = 'position:fixed;right:8px;top:8px;z-index:2147483000;' +
          'font:11px/1.5 ui-monospace,Menlo,monospace;color:#9fd;background:rgba(6,9,20,.85);' +
          'padding:8px 10px;border-radius:8px;white-space:pre;pointer-events:none';
        document.body.appendChild(checkEl);
      }
      var r = MagicCardVision.look(holdCrop(scanVideo));
      if (!r) return;
      var cards = [];
      try { cards = MagicCard.list ? MagicCard.list() : []; } catch (e) {}
      var hit = null;
      try { hit = MagicCardVision.identify(holdCrop(scanVideo), cards); } catch (e) {}
      // Whether the CDN build arrived, in the panel that is already
      // open while the card is being held up — so confirming it costs
      // nobody a console.
      var cvState = 'no loader';
      try {
        if (typeof OpenCv !== 'undefined') {
          cvState = OpenCv.state ? OpenCv.state()
            : (OpenCv.ready() ? 'READY' : 'not here');
        }
      } catch (e) {}

      checkEl.textContent =
        'opencv     ' + cvState + '\n' +
        'frame      ' + r.size + '\n' +
        'CHART      ' + r.frame + '   inside ' + r.inside + '\n' +
        'brightness ' + r.frameMean + ' avg / ' + r.frameMax + ' max\n' +
        'MARKS      ' + r.marks + '\n' +
        'sizes      ' + JSON.stringify(r.sizes) + '\n' +
        'cards here ' + cards.length +
          (cards.length ? ' (' + cards.map(function (c) {
            return (c.pattern || []).length + ' stars'; }).join(', ') + ')' : '') + '\n' +
        'match      ' + (hit ? (hit.card.nickname + '  cost ' + hit.cost.toFixed(3)) : 'none');
    }

    function openCardScan() {
      if (!scanEl || typeof MagicCardVision === 'undefined') { openStars(); return; }
      scanEl.hidden = false;
      // The portal opens. Retriggered on every arrival, including the
      // one after "That's not me", so coming back is the same moment
      // rather than a screen that was already there.
      scanEl.classList.remove('is-opening');
      if (scanWindow) scanWindow.classList.remove('is-live');
      void scanEl.offsetWidth;              // let the animation restart
      scanEl.classList.add('is-opening');
      if (portalTimer) window.clearTimeout(portalTimer);
      portalTimer = window.setTimeout(function () {
        if (scanEl) scanEl.classList.remove('is-opening');
      }, PORTAL_MS);
      var confirmBox = scanEl.querySelector('[data-scan-confirm]');
      if (confirmBox) confirmBox.hidden = true;
      if (confirmTimer) { window.clearInterval(confirmTimer); confirmTimer = null; }
      // DRAW YOUR STARS IS THERE FROM THE FIRST SECOND.
      //
      // It used to appear only after a failure, which left a child
      // looking at a live camera with their own face in it and nothing
      // to press — the exact dead end this was meant to avoid. It is
      // not an error state and never was: it is how a child without
      // their card in reach, or who would simply rather draw, gets in.
      if (scanActions) scanActions.hidden = false;
      if (scanAgainBtn) scanAgainBtn.hidden = true;
      scanState = null;
      scanPatienceSaid = false;
      steadyFor = 0;
      capturing = false;
      stopCountdown(false);
      // Whatever the last recognition left on screen is cleared, or a
      // second look would open onto the previous child's stars.
      var sky = scanEl.querySelector('[data-scan-sky]');
      if (sky) sky.hidden = true;
      if (scanVideo) scanVideo.style.visibility = '';
      var hold0 = scanEl.querySelector('[data-scan-hold]');
      if (hold0) hold0.style.display = '';
      scanSay('✨ Show me your Magic Card ✨');
      universe.traveller.setEnabled(false);

      // Nothing seen for a while is not a failure and is not silence
      // either. One gentle line, and the retry appears beside the way
      // out that was already there.
      if (scanWaitTimer) window.clearTimeout(scanWaitTimer);
      scanWaitTimer = window.setTimeout(function () {
        if (!scanEl || scanEl.hidden || scanBusy) return;
        scanSay('I couldn’t see your stars yet. Ready when you are.');
        scanPatienceSaid = true;
        if (scanAgainBtn) scanAgainBtn.hidden = false;
      }, SCAN_PATIENCE_MS);

      // OPENCV IS NOT FETCHED YET, ON PURPOSE.
      //
      // It was, from the moment the camera opened — and it made the
      // page unresponsive and left the preview black. Ten megabytes of
      // WebAssembly compiles on the main thread, so while it lands
      // nothing else runs: not the video, not a tap, not the universe
      // underneath.
      //
      // And it bought nothing, because NOTHING USES IT YET. The reader
      // that will is still to be written (docs/MAGIC_CARD_VISION_PLAN.md).
      // Paying a freeze for a dependency no code calls is the worst
      // possible order to do this in, so the call moves to the reader
      // that needs it — where it can also be deferred, chunked, or put
      // behind a worker, none of which is decidable until there is
      // something to defer.
      //
      // js/openCv.js stays exactly as it is: loader, timeout, fallback
      // and diagnosis are all proven, and it is one call away from
      // being used.

      MagicCardVision.openCamera(scanVideo).then(function (stream) {
        scanStream = stream;
        // The room appears inside the portal rather than the portal
        // being a window that was black until permission came back.
        if (scanWindow) scanWindow.classList.add('is-live');
        scanner = MagicCardVision.scan(scanVideo, {
          // Every frame the loop reads is cropped to the window, the
          // same as every other read — see holdCrop.
          frame: holdCrop,
          // THE CAMERA HAS TO LOOK ALIVE.
          //
          // Holding a card up used to look exactly like holding up
          // nothing: the only signal was the window brightening, and
          // that happened only once a whole sky had been read. Anything
          // short of success — a card too far away, a card at an angle,
          // a card the light is not reaching — was a still picture and
          // silence, and the honest reading of that screen is that it
          // has frozen.
          //
          // So it now says what it is doing, in three short states and
          // never a number: nothing yet, something in view, stars it
          // can read.
          onState: function (state) {
            if (scanWindow) scanWindow.classList.toggle('is-seeing', state === 'stars');
            if (scanBusy) return;
            if (state === scanState) return;   // only when it changes
            scanState = state;
            if (state === 'stars') scanSay('I can see your stars…');
            // DISTANCE IS THE BIGGEST LEVER THERE IS, and the first real
            // photograph showed a card held at arm's length taking up a
            // quarter of the window. Every pixel the grid does not cover
            // is detail no later stage invents, so the ask alternates:
            // steadier, then closer. Two hints, never a lecture, and
            // both are things a child can simply do.
            else if (state === 'something') {
              nudge = (nudge + 1) % 2;
              scanSay(nudge ? 'Bring it a little closer…' : 'Hold it a little steadier…');
            }
            // Once it has said it is ready when they are, it does not
            // go back to asking. Seeing something is still worth
            // saying; seeing nothing again is not, and would wipe the
            // one line offering a way on a frame after it appeared.
            else if (!scanPatienceSaid) scanSay('✨ Show me your Magic Card ✨');
          },
          // ---------------------------------------------------------
          // HOLD IT STILL, AND IT TAKES A PHOTOGRAPH.
          //
          // Reading the live stream was never going to work, and the
          // reason was never the algorithm: a live frame is read at
          // 320 pixels wide because it runs many times a second, and at
          // that size a star on a held-up card is two or three pixels.
          // No cleverness recovers detail thrown away before it ran.
          //
          // A still has no frame budget. Measured against the same
          // scene, the same card that gives eight marks live gives
          // fourteen in a still, and the EXACT read — the one a new
          // machine needs — goes from working only on a flat card to
          // working on a tilted one.
          //
          // So the camera waits for the child to hold their card still,
          // counts down where they can see it, and takes the picture.
          // No tap: a countdown is the one instruction a child does not
          // need explained.
          // ---------------------------------------------------------
          onSteady: function (movement, marks) {
            if (scanBusy || capturing) return;
            var holding = marks >= 4;
            var still = movement < 0.045;
            if (holding && still) { steadyFor++; } else { steadyFor = 0; }

            if (steadyFor >= 8 && !counting) { startCountdown(); return; }
            // Moved during the count — start again rather than take a
            // photograph of a moving card.
            if (counting && !(holding && still)) { stopCountdown(true); }
          },
          // Shape recognition needs no complete reading — it compares
          // what the camera can see against the cards this device
          // already holds. Tried on every frame that has stars in it,
          // so a returning Creator is recognised the moment their card
          // is in view rather than after a reading is assembled.
          onMarks: function () { tryByShape(); },
          onFrame: function () { showCheck(); }
        });
      }).catch(function () {
        // Permission refused, or no camera at all. Both are ordinary
        // and neither is a dead end.
        scanFailed('I can’t see your Magic Card.', true);
      });
    }

    // Every sky the frame could be showing, asked about in turn.
    //
    // The reader resolves where the card's grid begins along one axis
    // and not the other, so it offers a handful of readings rather than
    // one it cannot stand behind. Only a REAL card's exact pattern
    // belongs to a Creator, so a wrong reading matches nobody — which
    // is also why this cannot let a Traveller into somebody else's sky.
    // THE DEVICE'S OWN CARDS, MATCHED BY SHAPE.
    //
    // The straightforward answer for the common case, and the one the
    // grid-reading path kept getting wrong: a returning Creator's card
    // is already on this device, with its pattern, so the question is
    // only which of a few known skies the camera is looking at. That
    // needs no grid, no cell size and no absolute offset — the three
    // things a photograph is worst at giving.
    function tryByShape() {
      if (scanBusy) return;
      if (!MagicCardVision.identify) return;
      var cards = [];
      try { cards = (typeof MagicCard !== 'undefined' && MagicCard.list) ? MagicCard.list() : []; }
      catch (e) { cards = []; }
      if (!cards.length) return;
      var hit = null;
      try { hit = MagicCardVision.identify(holdCrop(scanVideo), cards); } catch (e) {}
      if (!hit || !hit.card) return;
      scanBusy = true;
      // Committed in confirmSky(), not here.
      skyRecognised(hit.card);
    }

    function stopCountdown(sayAgain) {
      if (counting) { window.clearInterval(counting); counting = null; }
      steadyFor = 0;
      if (sayAgain) { scanState = null; scanSay('Hold it a little steadier…'); }
    }

    function startCountdown() {
      var n = 5;
      scanSay(String(n));
      counting = window.setInterval(function () {
        n--;
        if (n > 0) { scanSay(String(n)); return; }
        stopCountdown(false);
        takeTheShot();
      }, 700);
    }

    // The photograph itself.
    //
    // A REAL PHOTOGRAPH, NOT THE PREVIEW FRAME. This copied the <video>
    // element, which is the live preview — capped at whatever the stream
    // was negotiated to and the very resolution the still path exists to
    // escape. Calling it a photograph did not make it one, and it is the
    // likeliest reason a real card still read badly after the countdown
    // shipped: the countdown was new, the picture underneath it was not.
    //
    // ImageCapture.takePhoto() asks the camera for a still at its PHOTO
    // resolution, which on a phone is several times the preview and is
    // usually the full sensor. Where it does not exist (Safari, Firefox)
    // or the device refuses, the preview frame is still taken — worse,
    // but never nothing.
    function takeTheShot() {
      if (capturing || scanBusy) return;
      capturing = true;
      scanSay('✨');

      function fromPreview() {
        var shot = document.createElement('canvas');
        var w = scanVideo.videoWidth || 1280;
        var h = scanVideo.videoHeight || 720;
        shot.width = w; shot.height = h;
        try { shot.getContext('2d').drawImage(scanVideo, 0, 0, w, h); }
        catch (e) { capturing = false; return null; }
        return shot;
      }

      function read(shot) {
        if (!shot) { capturing = false; return; }
        // Cropped to the window before anything reads it, so the
        // photograph and the preview are the same picture. A full-sensor
        // photo makes this matter MORE, not less: the extra pixels are
        // extra room, and the card's share of them is unchanged.
        var framed = shot;
        try { framed = holdCrop(shot); } catch (e) {}
        // A moment on the still, so the picture is not analysed in the
        // same frame it was taken and the flash has time to be seen.
        window.setTimeout(function () { readTheShot(framed); }, 260);
      }

      var track = null;
      try { track = scanStream && scanStream.getVideoTracks ? scanStream.getVideoTracks()[0] : null; }
      catch (e) {}

      if (!track || typeof window.ImageCapture !== 'function') { read(fromPreview()); return; }

      var settled = false;
      // takePhoto() can hang on some drivers, and a countdown that ends
      // in nothing is worse than a smaller picture.
      var giveUp = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        read(fromPreview());
      }, 2500);

      try {
        new window.ImageCapture(track).takePhoto()
          .then(function (blob) { return createImageBitmap(blob); })
          .then(function (bitmap) {
            if (settled) return;
            settled = true;
            window.clearTimeout(giveUp);
            var shot = document.createElement('canvas');
            shot.width = bitmap.width; shot.height = bitmap.height;
            shot.getContext('2d').drawImage(bitmap, 0, 0);
            read(shot);
          })
          .catch(function () {
            if (settled) return;
            settled = true;
            window.clearTimeout(giveUp);
            read(fromPreview());
          });
      } catch (e) {
        if (!settled) {
          settled = true;
          window.clearTimeout(giveUp);
          read(fromPreview());
        }
      }
    }

    // ---------------------------------------------------------------
    // WHAT THE CAMERA ACTUALLY GOT, WITH THE READING DRAWN ON IT.
    //
    // The live panel reports numbers, and numbers cannot tell "the card
    // was out of focus" from "the frame was found around the wrong
    // thing" from "the child was holding the picture side". Every one of
    // those reads as a bad pattern, and they need completely different
    // fixes — which is how five rounds went to fixing the wrong one.
    //
    // So the still is kept and shown: the photograph at the size it was
    // taken, the chart's frame in green, every mark in red, and the ones
    // the reader kept as stars in white. One glance separates all three.
    // Only under ?cardcheck=1, and it never touches recognition.
    function showShot(shot, d) {
      if (!checking) return;
      var box = document.querySelector('[data-shot-check]');
      if (!box) {
        box = document.createElement('div');
        box.setAttribute('data-shot-check', '');
        box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483000;' +
          'background:rgba(6,9,20,.9);padding:6px;border-radius:8px;' +
          'font:10px/1.4 ui-monospace,Menlo,monospace;color:#9fd;text-align:left';
        document.body.appendChild(box);
      }
      box.textContent = '';
      var view = document.createElement('canvas');
      var scale = Math.min(1, 420 / shot.width);
      view.width = Math.round(shot.width * scale);
      view.height = Math.round(shot.height * scale);
      var g = view.getContext('2d');
      g.drawImage(shot, 0, 0, view.width, view.height);

      // diagnose() works at its own analysis width, so its coordinates
      // are in that space, not the shot's. This is the ratio between.
      var k = d && d.size ? (view.width / d.size[0]) : 1;
      if (d && d.frame) {
        g.strokeStyle = '#4ef08a'; g.lineWidth = 2;
        g.beginPath();
        d.frame.forEach(function (pt, i) {
          var x = pt[0] * k, y = pt[1] * k;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        });
        g.closePath(); g.stroke();
      }
      (d && d.marksAt ? d.marksAt : []).forEach(function (m) {
        g.strokeStyle = m.star ? '#ffffff' : '#ff5a5a';
        g.lineWidth = m.star ? 2 : 1;
        g.beginPath(); g.arc(m.x * k, m.y * k, m.star ? 7 : 4, 0, 7); g.stroke();
      });
      box.appendChild(view);
      var note = document.createElement('div');
      note.style.cssText = 'margin-top:4px;white-space:pre';
      note.textContent =
        'shot   ' + shot.width + 'x' + shot.height +
          (window.ImageCapture ? '' : '  (preview only)') + '\n' +
        'read at' + (d && d.size ? ' ' + d.size.join('x') : ' —') + '\n' +
        'frame  ' + (d && d.frame ? ('found via ' + (d.via || '?')) : 'NOT FOUND') +
          '   marks ' + (d ? d.marks : '?') +
          '   stars ' + (d ? d.starLike : '?') + '\n' +
        'cells  ' + (d && d.byFrame
          ? d.byFrame.map(function (rc) { return rc.join(','); }).join(' ')
          : 'not solved') + '\n' +
        // THE SIZES ARE THE ANSWER TO "WHY NOT THE GUIDE STARS".
        //
        // The card draws its four corner stars at 1.9x the radius of a
        // pattern star, so in this list they should be four numbers far
        // larger than the rest. If they are there and it still says
        // "via chart", the size test is too strict; if they are not
        // there at all, they merged with something or the card predates
        // them. Those need opposite fixes and nothing else on this
        // panel tells them apart.
        'sizes  ' + (d && d.marksAt
          ? d.marksAt.map(function (m) { return m.n; })
              .sort(function (a, b) { return b - a; }).slice(0, 12).join(' ')
          : '—');
      box.appendChild(note);

      // KEEP THE PHOTOGRAPH.
      //
      // Every simulated room now passes and the real one still fails,
      // which means the simulations stopped measuring anything. The way
      // out is not another invented scene — it is this exact picture,
      // saved, so the reader can be run against what a camera really
      // produces instead of against what I imagine it produces.
      var save = document.createElement('button');
      save.type = 'button';
      save.textContent = '⬇ save this photo';
      save.style.cssText = 'margin-top:5px;font:10px ui-monospace,Menlo,monospace;' +
        'color:#0f1220;background:#9fd;border:0;border-radius:5px;padding:4px 7px;cursor:pointer';
      save.addEventListener('click', function () {
        try {
          var a = document.createElement('a');
          a.href = shot.toDataURL('image/png');
          a.download = 'magiccard-' + shot.width + 'x' + shot.height + '.png';
          a.click();
        } catch (e) {}
      });
      box.appendChild(save);
    }

    function readTheShot(shot) {
      if (checking && MagicCardVision.diagnose) {
        var d = null;
        try { d = MagicCardVision.diagnose(shot); } catch (e) {}
        try { showShot(shot, d); } catch (e) {}
      }
      var cards = [];
      try { cards = (typeof MagicCard !== 'undefined' && MagicCard.list) ? MagicCard.list() : []; }
      catch (e) { cards = []; }

      // This device's own cards first, on the full-resolution still.
      if (cards.length && MagicCardVision.identifyStill) {
        var hit = null;
        try { hit = MagicCardVision.identifyStill(shot, cards); } catch (e) {}
        if (hit && hit.card) {
          capturing = false;
          scanBusy = true;
          // NOT setActive yet — see confirmSky(). Nothing is committed
          // until the child has had their ten seconds.
          skyRecognised(hit.card);
          return;
        }
      }

      // ASK VIHUPLANET BEFORE ASKING THE CHILD.
      //
      // The card is not on this device — which is exactly the case of a
      // Creator standing at somebody else's computer, and until now the
      // one arrival that got the LONGEST path. It filled the drawing
      // board, asked them to check their own stars and to press
      // Continue, and only then asked the platform. The device that
      // already knew them let them walk in; the strange one made them
      // work for it.
      //
      // recogniseAny() was written for precisely this and was called
      // from nowhere. It asks about every candidate reading in one
      // parallel round, because the platform matches an exact set and
      // the true reading is somewhere in that list rather than reliably
      // first.
      //
      // The board is still there, and is now reached only when nobody
      // recognises the sky at all — which is the only time it has a
      // real question to ask.
      var read = null;
      try { read = MagicCardVision.readStill(shot); } catch (e) {}
      var list = (read && read.patterns) || [];
      capturing = false;
      if (!list.length) { scanFailed('I couldn’t see your stars yet.'); return; }
      scanBusy = true;

      var toBoard = function () {
        scanSay('There they are.');
        window.setTimeout(function () {
          closeCardScan({ keepUniverseStill: true });
          openStars(list[0]);
        }, 700);
      };

      if (!CreatorRecognition.recogniseAny) { toBoard(); return; }
      scanSay('Looking for your sky…');

      // Bounded and timed. A slow network must never hold a child in
      // front of a dead camera, so the board is the answer if this does
      // not come back promptly — the same answer as being offline.
      var settled = false;
      var giveUp = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        toBoard();
      }, 6000);

      CreatorRecognition.recogniseAny(list.slice(0, 8)).then(function (res) {
        if (settled) return;
        settled = true;
        window.clearTimeout(giveUp);
        if (res && res.outcome === CreatorRecognition.KNOWN && res.card) {
          skyRecognised(res.card);
          return;
        }
        toBoard();
      }).catch(function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(giveUp);
        toBoard();
      });
      return;
    }

    // The camera has seen a sky. Whose it is, is now somebody else's
    // question — the board's, and the child's.
    function tryTheSkies() {
      if (scanBusy) return;
      scanBusy = true;
      var list = [];
      try { list = MagicCardVision.readCandidates(holdCrop(scanVideo), null) || []; } catch (e) {}
      if (!list.length) { scanFailed('I couldn’t see your stars yet.'); return; }

      // Straight in, when this device already knows the card and the
      // shapes agree — a returning Creator on their own machine should
      // not be asked to confirm what the universe already recognises.
      // tryByShape() handles that on every frame; reaching here means
      // it did not, so the reading goes to the child instead of to a
      // guess.
      scanSay('There they are.');
      var seen = list[0];
      window.setTimeout(function () {
        closeCardScan({ keepUniverseStill: true });
        openStars(seen);
      }, 700);
    }

    if (scanEl) {
      scanEl.addEventListener('click', function (ev) {
        var act = ev.target && ev.target.getAttribute
          ? ev.target.getAttribute('data-scan-act') : null;
        if (act === 'notme') { notMe(); return; }
        if (act === 'again') { closeCardScan(); openCardScan(); return; }
        if (act === 'draw') { closeCardScan(); openStars(); return; }
        if (act === 'close') { closeCardScan(); return; }
      });
    }

    function closeStars() {
      if (!starsEl || starsEl.hidden) return;
      starsEl.classList.remove('is-open');
      window.setTimeout(function () { starsEl.hidden = true; }, 420);
      universe.traveller.setEnabled(true);
      document.querySelector('.vp-home').classList.remove('is-marking');
      var back = document.querySelector('[data-act="stars"]');
      if (back) back.focus();
    }

    // ---------------------------------------------------------------
    // "I don't have my Magic Card."
    //
    // The honest end of the recognition screen: a child who cannot
    // answer at all. There is no support request and no manual
    // recovery, because there is no account to recover — the card was
    // posted to a grown-up, and the answer is to ask them.
    //
    // Two shapes, depending on what this browser knows:
    //   · It remembers a parent's address → send it again, silently,
    //     and say who to ask. No typing.
    //   · It knows nothing (a new device) → the one thing a child can
    //     offer is that address, and the only thing that happens is an
    //     email to it. Nothing ever comes back to this browser.
    // ---------------------------------------------------------------
    function lostMyCard() {
      if (typeof SkyProtection === 'undefined') return;
      if (starsActions) starsActions.hidden = true;
      if (starsRetry) starsRetry.hidden = true;
      var lostBtn = starsEl.querySelector('[data-stars-act="lost"]');
      if (lostBtn) lostBtn.hidden = true;
      if (board) board.clear();

      if (SkyProtection.hasProtection()) {
        say('Ask your parent to check your Magic Card. I have sent it to them again.', 'quiet');
        try { SkyProtection.resend(); } catch (e) {}
        showLostActions();
        offerAnotherSend(function () { return SkyProtection.resend(); });
        return;
      }
      askForGrownUp();
    }

    function showLostActions() {
      if (lostForm) { lostForm.remove(); lostForm = null; }
      if (againRow) { againRow.remove(); againRow = null; }
      if (starsActions) starsActions.hidden = false;
      var lostBtn = starsEl.querySelector('[data-stars-act="lost"]');
      if (lostBtn) lostBtn.hidden = false;
    }

    // ---------------------------------------------------------------
    // "It never came."
    //
    // "On its way" and "arrived" are not the same sentence. Mail is
    // slow, mail is filtered, and a grown-up who never sees it leaves a
    // child on this screen with the right words in front of them and
    // nothing to press. So every send leaves exactly one way to try
    // once more — aimed at the same address, with nothing to retype and
    // nothing to remember.
    //
    // It is not a third permanent button and must never become one: it
    // exists only in the moments after a send, and the next thing the
    // child does takes it away again.
    // ---------------------------------------------------------------
    function offerAnotherSend(send) {
      if (againRow) { againRow.remove(); againRow = null; }
      var panel = starsEl.querySelector('.vp-stars-panel');
      if (!panel) return;

      againRow = document.createElement('button');
      againRow.type = 'button';
      againRow.className = 'vp-stars-again';
      againRow.textContent = 'It didn’t arrive — send it again';
      // Beside the line it answers, rather than at the bottom of the
      // screen under everything else.
      panel.insertBefore(againRow, starsActions || null);

      againRow.addEventListener('click', function () {
        againRow.disabled = true;
        say('Sending it again…');
        var going;
        try { going = send(); } catch (e) { going = null; }
        Promise.resolve(going || { ok: false }).then(function (res) {
          if (againRow) againRow.disabled = false;
          say(res && res.ok
            ? 'Sent again. It can take a few minutes to arrive — it is worth looking in the spam folder too.'
            : 'I could not reach them just now. You can try again in a moment.', 'quiet');
        });
      });
    }

    // Asking for the address is not asking a child to log in. Nothing
    // is verified, nothing is stored against them, and nothing is
    // revealed here — an email is sent, or it is not.
    function askForGrownUp() {
      say('A grown-up may be keeping your Magic Card safe. What is their email?', 'quiet');
      if (lostForm) lostForm.remove();
      lostForm = document.createElement('div');
      lostForm.className = 'vp-stars-lost-form';

      var input = document.createElement('input');
      input.type = 'email';
      input.className = 'vp-stars-input';
      input.placeholder = 'A grown-up’s email address';
      input.setAttribute('aria-label', 'A grown-up’s email address');
      input.autocomplete = 'email';
      lostForm.appendChild(input);

      var row = document.createElement('div');
      row.className = 'vp-stars-actions';
      var send = document.createElement('button');
      send.type = 'button';
      send.className = 'is-primary';
      send.textContent = 'Send My Sky';
      var back = document.createElement('button');
      back.type = 'button';
      back.textContent = 'Back';
      row.appendChild(send);
      row.appendChild(back);
      lostForm.appendChild(row);
      starsEl.querySelector('.vp-stars-panel').appendChild(lostForm);

      function go() {
        if (!SkyProtection.looksLikeEmail(input.value)) {
          say('That does not look like an email address yet.', 'quiet');
          input.focus();
          return;
        }
        send.disabled = true;
        say('Looking…');
        // Two different questions wearing the same field.
        //
        // If this device HOLDS a Magic Card, the child is not trying to
        // find one — they are worried about losing the one they have,
        // and the honest thing is to put it in a grown-up's hands right
        // now. That is protect, not recover. It also closes the gap for
        // every Creator who claimed a card before Sky Protection
        // existed: they were never asked for an address, so there is
        // nothing for a search to find, and searching would have
        // reported "on its way" while sending nothing at all.
        //
        // With no card here, it really is a search: a new device, and
        // the only thing the child can offer is the address.
        var holdsACard = false;
        try {
          holdsACard = typeof CreatorRecognition !== 'undefined' &&
                       CreatorRecognition.isRecognised();
        } catch (e) {}

        // Kept so "send it again" needs no retyping — including after a
        // failure, where nothing was remembered anywhere else.
        var typed = String(input.value).trim();
        var again = holdsACard ? function () { return SkyProtection.protect(typed); }
                               : function () { return SkyProtection.recoverByEmail(typed); };

        var ask = again();
        ask.then(function (res) {
          send.disabled = false;
          if (lostForm) { lostForm.remove(); lostForm = null; }
          if (res && res.ok) {
            // The same words whether or not that address protects
            // anything. Saying "no skies here" would make this an
            // oracle for which addresses are in the product, and the
            // child does not need to know either — a grown-up either
            // receives an email or does not.
            say(holdsACard
              ? 'Your sky is on its way to them now. It will always be safe there.'
              : 'If a grown-up is keeping your sky, it is on its way to them now.', 'quiet');
          } else {
            say('I could not reach them just now. You can try again in a moment.', 'quiet');
          }
          showLostActions();
          offerAnotherSend(again);
        });
      }
      send.addEventListener('click', go);
      back.addEventListener('click', function () { freshAsk(); showLostActions(); });
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); go(); }
      });
      input.focus();
    }

    function recoverBySky() { askForGrownUp(); }

    function exhausted() {
      if (starsActions) starsActions.hidden = true;
      if (starsRetry) starsRetry.hidden = false;
      say('I couldn’t recognise those stars.', 'quiet');
      if (board) board.clear();
    }

    function askTheUniverse() {
      if (asking || !board) return;
      if (board.count() < 2) {
        say('Mark a few stars first.', 'quiet');
        return;
      }
      asking = true;
      say('Looking for your sky…');

      CreatorRecognition.recognise(board.pattern()).then(function (result) {
        asking = false;

        if (result.outcome === CreatorRecognition.KNOWN) {
          // No confirmation screen, no success dialog, no "welcome
          // back" to dismiss. Being recognised is not an event to
          // acknowledge — it is the door opening, and the child is
          // already through it.
          say('There you are.', 'known');
          // Recognition happens ONCE per arrival, and it happened here.
          // The Studio's Gateway asks for itself otherwise, and a child
          // who has just drawn their stars should not be asked to find
          // them again in the next breath.
          CreatorRecognition.markRecognised(result.card && result.card.id);
          window.setTimeout(function () {
            goStudio(JourneyResolver.recognised());
          }, 620);
          return;
        }

        // Honest about which of the two things happened, because they
        // are not the same and a child deserves to know when it was
        // not them. An unreachable sky does not count against their
        // tries either — spending an attempt on the network's behalf
        // would be blaming them for it twice.
        if (result.outcome === CreatorRecognition.UNREACHABLE) {
          say('I can’t see the whole sky from here right now.', 'quiet');
          return;
        }

        attempts++;
        if (attempts >= TRIES) { exhausted(); return; }
        say('I don’t know those stars yet. Try once more?', 'quiet');
        board.clear();
      });
    }

    if (starsEl) {
      starsEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-stars-act]');
        if (!btn) return;
        var act = btn.getAttribute('data-stars-act');

        if (act === 'continue') { askTheUniverse(); return; }
        // Straight back to the camera, with the board left behind. The
        // child still has the card in their hand; this is the shortest
        // distance between them and another attempt.
        if (act === 'camera') { closeStars(); openCardScan(); return; }
        if (act === 'retry') { freshAsk(); return; }
        if (act === 'lost') { lostMyCard(); return; }
        // Leaving without answering. The universe was never torn down,
        // so this returns the child to exactly where they were.
        if (act === 'away') { closeStars(); return; }
        if (act === 'recover') { recoverBySky(); return; }

        // "I don't have one yet" and "Create Story" are the same door,
        // and the resolver says so: the Starter Story Rite is the path
        // to becoming a Creator, and it runs on the way into the
        // Studio. No registration, no profile, nothing else asked.
        goStudio(act === 'no-card'
          ? JourneyResolver.noCardYet()
          : JourneyResolver.createStory());
      });

      // A way out that is not a third button. The sprint asks for
      // exactly two, and a child who opened this by accident still has
      // to be able to leave — so the sky itself dismisses it, which is
      // the gesture the Ether already uses to send a met Spirit back.
      if (starsVeil) starsVeil.addEventListener('click', closeStars);
      document.addEventListener('keydown', function (ev) {
        if (starsEl.hidden || ev.key !== 'Escape') return;
        closeStars();
        ev.preventDefault();
        ev.stopPropagation();
      }, true);

      window.addEventListener('resize', function () {
        if (!starsEl.hidden && board) board.reflow();
      });
    }

    function quiet(message) {
      if (!el.quiet) return;
      if (!message) { el.quiet.hidden = true; return; }
      el.quietLine.textContent = message;
      el.quiet.hidden = false;
    }

    // ---------- Stage 4 · Preview ----------
    universe.on('focus:opened', function (payload) {
      met = payload.entity;
      var pid = projectIdOf(met);
      setLink(pid);

      el.title.textContent = met.title || 'A story';
      el.creator.textContent = met.creator ? 'by ' + met.creator : '';

      // The pages come first, because the count shown below is the
      // number actually readable — not a number from the record that
      // might disagree with what the portal can open. The Story Entity
      // contract deliberately carries no page count: pages are a
      // surface concern and the runtime has no business knowing about
      // them.
      pages = (pid && window.EtherFeed) ? EtherFeed.pagesOf(pid) : [];
      audio = (pid && window.EtherFeed && EtherFeed.audioOf) ? EtherFeed.audioOf(pid) : [];
      // Whoever recorded it, when the Story came from somebody else —
      // see playVoice(). Null for this device's own Stories, where the
      // recording is already in this browser.
      audioOwner = (pid && window.EtherFeed && EtherFeed.ownerOf) ? EtherFeed.ownerOf(pid) : null;

      // Everything said here is something the Story actually knows
      // about itself. No invented blurb, no fabricated popularity.
      var bits = [];
      if (pages.length) bits.push(pages.length + (pages.length === 1 ? ' page' : ' pages'));
      // "shared <date>" is a true thing to say about a Story a child
      // chose to send, and a false one about a Canon Story, which
      // nobody shared and which has simply always been here. A Canon
      // Story says only what it honestly knows: how long it is.
      var when = isCanon(met) ? '' : whenShared(met.publishedAt);
      if (when) bits.push('shared ' + when);
      el.meta.textContent = bits.join(' · ');
      el.read.disabled = !pages.length;
      el.read.textContent = pages.length ? 'Read story' : 'Story is elsewhere';

      el.cheer.textContent = cheerLabel(pid);
      el.cheer.disabled = hasCheered(pid);

      el.preview.hidden = false;
      // The permanent actions stand down while a Spirit is met: the
      // child is looking at one story, not at the whole universe.
      document.querySelector('.vp-home').classList.add('is-met');
    });

    universe.on('focus:closed', function () {
      met = null;
      el.preview.hidden = true;
      document.querySelector('.vp-home').classList.remove('is-met');
      setLink(null);
    });

    el.back.addEventListener('click', function () { universe.focus.close(); });

    el.cheer.addEventListener('click', function () {
      if (!met) return;
      var pid = projectIdOf(met);
      if (!pid || hasCheered(pid)) return;

      // The Spirit answers first, before anything is stored or sent.
      // A child taps and starlight travels to the story — the network
      // is not allowed to be part of that moment, and on a device with
      // no platform at all it never was.
      var entity = met;
      entity.cheer = 1;

      Cheer.give(pid).then(function (res) {
        // Whatever the platform knew that this device did not.
        entity.cheers = res.cheers || entity.cheers || 0;
        var nowGrown = Cheer.grown(pid);
        // Growth belongs to THIS story. Set on the one entity that was
        // cheered, and to nothing else — not the creator, not their
        // other stories, not the Ether.
        entity.grown = nowGrown;
        entity.growth = Cheer.growth ? Cheer.growth(pid) : entity.growth;
        if (met === entity) {
          el.cheer.textContent = cheerLabel(pid);
          el.cheer.disabled = true;
        }
      });

      // Said immediately, not when the promise lands.
      el.cheer.textContent = cheerLabel(pid);
      el.cheer.disabled = true;
    });

    // ---------- Stage 5 · the Portal ----------
    //
    // The Spirit opens, and the Traveller steps in. No navigation, no
    // reload, and the universe underneath is never touched — only
    // paused, which is what makes coming back exact.
    function openPortal() {
      if (!met || !pages.length) return;
      var node = universe.layer.nodeFor(met.id);
      var origin = node ? node.el.getBoundingClientRect() : null;
      var host = universe.root.getBoundingClientRect();

      // The portal grows from where the Spirit actually is.
      if (origin) {
        el.portal.style.setProperty('--vp-portal-x',
          (origin.left - host.left) + 'px');
        el.portal.style.setProperty('--vp-portal-y',
          (origin.top - host.top) + 'px');
      }

      pageIndex = 0;
      showPage();
      el.portalTitle.textContent = met.title || 'A story';

      // Whose story this is, while it is being read.
      //
      // Hidden rather than blank when there is nobody to name: a Canon
      // Story belongs to nobody by design, and a story shared before
      // its maker travelled with it has no honest answer. An empty line
      // under the title would read as a missing thing; no line reads as
      // a story that simply is.
      if (el.portalCreator) {
        var maker = met.creator || '';
        el.portalCreator.textContent = maker ? ('by ' + maker) : '';
        el.portalCreator.hidden = !maker;
      }
      el.portal.hidden = false;
      // Two frames, so the browser has laid the overlay out before the
      // opening class starts it animating — without this the transition
      // has nothing to transition from.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.portal.classList.add('is-open'); });
      });

      // Stop the clock once the Spirit has finished opening. The
      // universe keeps every Spirit exactly where it is; it simply
      // stops costing anything while nobody can see it.
      window.setTimeout(function () {
        if (!el.portal.hidden) universe.stop();
      }, 900);
      el.close.focus();
    }

    function closePortal() {
      // A voice must never outlive the page it belongs to.
      stopVoice();
      // Running again before the portal has finished closing, so the
      // universe is alive underneath as it is revealed rather than
      // starting up once it is exposed.
      universe.start();
      el.portal.classList.remove('is-open');
      window.setTimeout(function () { el.portal.hidden = true; }, 620);
      var node = met && universe.layer.nodeFor(met.id);
      if (node) node.el.focus();
    }

    // ---------- a page's own voice ----------
    //
    // A Story read in the Ether now plays whatever narration its pages
    // carry, which is what makes a Canon Story with audio worth
    // publishing at all: the recording is embedded in the canon file, so
    // it plays for a child who has never met whoever made it.
    //
    // Deliberately quieter than the Studio's own Story Player. That one
    // is a performance — it turns the page when the narration ends. This
    // is a child reading at their own pace, so the voice accompanies the
    // page and the page never moves on by itself. Turning away, turning
    // the page, or closing the portal all stop it immediately: a voice
    // still talking about a page nobody is looking at is the one thing
    // this must not do.
    var voice = null;
    function stopVoice() {
      if (!voice) return;
      try { voice.pause(); voice.src = ''; } catch (e) {}
      voice = null;
    }

    function playVoice() {
      stopVoice();
      var ref = audio[pageIndex];
      if (!ref) return;
      var at = pageIndex;
      var start = function (src) {
        // The child may have turned the page while this resolved.
        if (!src || at !== pageIndex || el.portal.hidden) return;
        try {
          voice = new Audio(src);
          var p = voice.play();
          // Autoplay may be refused until the child has touched
          // something. That is not an error and there is nothing to
          // say about it — the page simply stays silent.
          if (p && p.catch) p.catch(function () { stopVoice(); });
        } catch (e) { stopVoice(); }
      };
      // A Canon Story carries its narration inline, so this is already
      // a data: URI; a child's own Story carries a reference that only
      // resolves on the device that recorded it. AssetStore passes a
      // data: URI straight through, so one path serves both.
      // AssetStore is what turns a `vihu-asset:` reference back into
      // something playable, and this page did not load it at all — so
      // this fell through to handing new Audio() the raw reference,
      // which is not a URL, and every shared Story with a voice read in
      // silence. It is loaded now (index.html); the fallback stays for
      // the Canon case, whose narration is already a data: URI.
      //
      // The owner matters for a Story somebody ELSE shared: the
      // recording is not in this browser, and the Storage path it lives
      // at is built from whoever recorded it.
      if (typeof AssetStore !== 'undefined' && AssetStore.resolve) {
        AssetStore.resolve(ref, audioOwner ? {ownerId: audioOwner} : undefined)
          .then(start).catch(function () {});
      } else {
        start(ref);
      }
    }

    function showPage() {
      el.page.src = pages[pageIndex] || '';
      el.pageNo.textContent = (pageIndex + 1) + ' / ' + pages.length;
      el.prev.disabled = pageIndex === 0;
      el.next.disabled = pageIndex >= pages.length - 1;
      playVoice();
    }

    // The page turns, and the new one is swapped in at the halfway
    // point — while the paper is edge-on and there is nothing to see.
    // Swapping at either end would show the picture change instead of
    // the page move, which is the difference between turning a page and
    // cross-fading two of them.
    var PAGE_TURN_MS = 460;
    var turning = false;

    function reducedMotion() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
      catch (e) { return false; }
    }

    function turn(by) {
      // A second press mid-turn would swap the picture under a running
      // animation and leave the count disagreeing with the page.
      if (turning) return;
      var next = pageIndex + by;
      if (next < 0 || next >= pages.length) return;

      if (reducedMotion()) { pageIndex = next; showPage(); return; }

      turning = true;
      var cls = by > 0 ? 'is-turning-next' : 'is-turning-prev';
      el.page.classList.add(cls);
      window.setTimeout(function () {
        pageIndex = next;
        // Also where the new page's narration begins, which is right:
        // the voice belongs to the page now arriving, not the one
        // leaving.
        showPage();
      }, PAGE_TURN_MS / 2);
      window.setTimeout(function () {
        el.page.classList.remove(cls);
        turning = false;
      }, PAGE_TURN_MS);
    }

    el.read.addEventListener('click', openPortal);
    el.close.addEventListener('click', closePortal);
    el.prev.addEventListener('click', function () { turn(-1); });
    el.next.addEventListener('click', function () { turn(1); });

    document.addEventListener('keydown', function (ev) {
      if (el.portal.hidden) return;
      // Inside the portal the arrow keys turn pages, not the universe —
      // and the universe is stopped anyway.
      if (ev.key === 'ArrowRight') { turn(1); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { turn(-1); ev.preventDefault(); }
      else if (ev.key === 'Escape') { closePortal(); ev.preventDefault(); ev.stopPropagation(); }
    }, true);

    // ---------- the Stories ----------
    if (typeof EtherFeed === 'undefined') {
      quiet('This Ether cannot reach your stories right now.');
      return;
    }

    // ---------- a Story that has just been shared ----------
    //
    // Held out of the seed above and brought in here instead, so it is
    // seen to ARRIVE. The birth waits for the threshold: playing it
    // behind the veil would spend the one moment this whole path exists
    // to produce, on a child who cannot see it yet.
    var born = bornProjectId();

    function bringItIn() {
      if (!born) return;
      var id = born;
      born = null;
      clearBorn();
      // A beat first, so the child is looking at the universe before
      // anything moves in it.
      window.setTimeout(function () {
        var spirit = null;
        try { spirit = EtherFeed.publishInto(universe, id); } catch (e) {}
        // A STORY MUST NEVER SIMPLY VANISH.
        //
        // This Story was deliberately held OUT of the opening seed so
        // the child could watch it arrive — which means if the birth
        // does not happen, it is not merely un-dramatic, it is absent
        // from the universe altogether until the next reload.
        // publishInto() returns null whenever the record cannot be read
        // (it looks only in the local store, so a Story that lives only
        // in the cloud on this device finds nothing), and that was
        // swallowed silently.
        //
        // Falling back to the ordinary path costs the arrival animation
        // and keeps the Story, which is the right way round.
        if (!spirit) {
          try {
            EtherFeed.attach(universe, { exclude: [] }).catch(function () {});
          } catch (e) {}
        }
      }, 700);

      // Deliberately NOT followed by focus.open() on the new Spirit.
      //
      // The reward is watching a Story become part of the universe, and
      // Story Birth already aims a published Story into the view for
      // exactly that reason — it is visible the moment it arrives. Then
      // opening it would put a preview panel over the universe at the
      // one second the universe is the thing worth looking at, and turn
      // a story joining a place into a dialog about a file. The child
      // meets it when they choose to, like any other Spirit.
    }

    EtherFeed.attach(universe, { exclude: born ? [born] : [] }).then(function (stories) {
      var wanted = linkedProjectId();

      // A birth outranks a deep link: the child was just handed here by
      // their own share, and that is what they are here to see.
      if (born) {
        quiet(null);
        if (thresholdCrossed) bringItIn();
        else onThreshold = bringItIn;
        return;
      }

      if (!stories.length) {
        // Only a deep link that cannot resolve says anything here. An
        // Ether with nothing in it yet is not a state that needs
        // narrating on arrival — the two actions already say what a
        // child can do, and the invitation appears if they ask for
        // stories they have not made.
        if (wanted) quiet('That story is not in your Ether yet.');
        return;
      }

      quiet(null);
      if (!wanted) return;

      var match = null;
      for (var i = 0; i < stories.length; i++) {
        if (stories[i].source && stories[i].source.projectId === wanted) {
          match = stories[i];
          break;
        }
      }
      if (!match) { quiet('That story is not in your Ether yet.'); return; }

      // One beat, so the child sees the universe before it moves. A
      // link that snaps straight to a Spirit never shows them where the
      // story lives.
      window.setTimeout(function () { universe.focus.open(match.id); }, 900);
    }).catch(function () {
      quiet('This Ether cannot reach your stories right now.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
