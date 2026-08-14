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
  var CHEER_KEY = 'vp-ether-cheers';

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
  // A cheer is real and it is local. There is no public VihuPlanet, so
  // there is nobody to send it to and no honest count to show — a
  // number of cheers from strangers would be a fiction. What it does
  // instead is true: the Spirit shines brighter, and it remembers that
  // this Traveller cheered it.
  function cheers() {
    try { return JSON.parse(localStorage.getItem(CHEER_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function hasCheered(id) { return !!cheers()[id]; }
  function saveCheer(id) {
    try {
      var all = cheers();
      all[id] = new Date().toISOString();
      localStorage.setItem(CHEER_KEY, JSON.stringify(all));
    } catch (e) {}
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
      cont:     document.querySelector('[data-act="continue"]'),
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

    // ---------- the two permanent actions ----------
    function goStudio(decision) {
      window.location.href = (decision && decision.destination) || JourneyResolver.STUDIO;
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

    function openStars() {
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
      var first = starsEl.querySelector('.vp-stars-cell');
      if (first) first.focus();
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
    var scanPatienceSaid = false;

    function scanSay(text) { if (scanLine) scanLine.textContent = text; }

    function closeCardScan(opts) {
      if (!scanEl || scanEl.hidden) return;
      if (scanWaitTimer) { window.clearTimeout(scanWaitTimer); scanWaitTimer = null; }
      if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
      if (typeof MagicCardVision !== 'undefined') {
        try { MagicCardVision.closeCamera(scanStream); } catch (e) {}
      }
      scanStream = null;
      scanBusy = false;
      scanEl.hidden = true;
      if (scanWindow) scanWindow.classList.remove('is-seeing');
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

    function openCardScan() {
      if (!scanEl || typeof MagicCardVision === 'undefined') { openStars(); return; }
      scanEl.hidden = false;
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

      MagicCardVision.openCamera(scanVideo).then(function (stream) {
        scanStream = stream;
        scanner = MagicCardVision.scan(scanVideo, {
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
            else if (state === 'something') scanSay('Hold it a little steadier…');
            // Once it has said it is ready when they are, it does not
            // go back to asking. Seeing something is still worth
            // saying; seeing nothing again is not, and would wipe the
            // one line offering a way on a frame after it appeared.
            else if (!scanPatienceSaid) scanSay('✨ Show me your Magic Card ✨');
          },
          onPattern: function () { tryTheSkies(); }
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
    function tryTheSkies() {
      if (scanBusy) return;
      scanBusy = true;
      var list = [];
      try { list = MagicCardVision.readCandidates(scanVideo, null) || []; } catch (e) {}
      if (!list.length) { scanFailed('I couldn’t see your stars yet.'); return; }

      if (scanWaitTimer) { window.clearTimeout(scanWaitTimer); scanWaitTimer = null; }
      scanSay('Looking for your sky…');
      var i = 0;
      var anyUnreachable = false;
      function next() {
        if (i >= list.length) {
          // Only once EVERY reading has been asked about. An unreachable
          // sky is not the child's doing, so it is worth saying — but
          // only when it is the whole story, never because one wrong
          // reading happened to be the one the network dropped.
          scanFailed(anyUnreachable
            ? 'I can’t see the whole sky from here right now.'
            : 'I couldn’t see your stars yet.');
          return;
        }
        var pattern = list[i++];
        CreatorRecognition.recognise(pattern).then(function (result) {
          if (result.outcome === CreatorRecognition.KNOWN) {
            scanSay('There you are.');
            // The same three lines the drawing board runs. Being
            // recognised is not an event to acknowledge — it is the
            // door opening.
            CreatorRecognition.markRecognised(result.card && result.card.id);
            window.setTimeout(function () {
              closeCardScan({ keepUniverseStill: true });
              goStudio(JourneyResolver.recognised());
            }, 620);
            return;
          }
          // KEEP GOING on an unreachable one.
          //
          // A reading that is not this child's sky is answered by the
          // platform, and with no platform in reach that answer is
          // "unreachable" — for every wrong reading, not just the real
          // one. Stopping there ended the search on the FIRST candidate
          // and never reached the true sky sitting behind it, which is
          // exactly how a Creator holding their own card was told the
          // sky was out of reach.
          if (result.outcome === CreatorRecognition.UNREACHABLE) anyUnreachable = true;
          next();
        }).catch(function () { next(); });
      }
      next();
    }

    if (scanEl) {
      scanEl.addEventListener('click', function (ev) {
        var act = ev.target && ev.target.getAttribute
          ? ev.target.getAttribute('data-scan-act') : null;
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
        if (act === 'retry') { freshAsk(); return; }
        if (act === 'lost') { lostMyCard(); return; }
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

      // Continue means "open this in the Studio and keep working on
      // it", which is only ever true of a Story this child made. A
      // Canon Story is a product asset that belongs to nobody and is
      // not in anybody's project store, so the button would open the
      // Studio onto a project id that does not exist — and it is not
      // theirs to change in any case. It is not there.
      //
      // When a public cross-creator feed exists, this is the one line
      // that learns to ask the same question about somebody else's
      // Story.
      el.cont.hidden = isCanon(met);
      el.cheer.textContent = hasCheered(pid) ? 'Cheered' : 'Cheer';

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
      saveCheer(pid);
      el.cheer.textContent = 'Cheered';
      // The Spirit answers. storySpirit.js decays this back to nothing
      // over a couple of seconds, so a cheer is a moment of light
      // rather than a permanent decoration.
      met.cheer = 1;
    });

    el.cont.addEventListener('click', function () {
      if (!met) return;
      // Continuing a Story is editing it, which is the Studio's job and
      // a different place to be. This is the one control on this page
      // that deliberately does leave.
      window.location.href = JourneyResolver.STUDIO + '?project=' +
        encodeURIComponent(projectIdOf(met) || '');
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
      if (typeof AssetStore !== 'undefined' && AssetStore.resolve) {
        AssetStore.resolve(ref).then(start).catch(function () {});
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
