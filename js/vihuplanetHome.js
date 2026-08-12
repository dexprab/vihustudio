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
      portalTitle: document.querySelector('[data-portal-title]')
    };

    var met = null;      // the entity currently being met
    var pages = [];
    var pageIndex = 0;

    // ---------- the threshold ----------
    //
    // One tap before the universe is handed over. It is not a loading
    // screen — the Ether is already alive behind it, and has been since
    // the moment the page opened — it is the moment of arriving
    // somewhere, which is a different thing and worth one tap.
    var thresholdEl = document.querySelector('[data-threshold]');
    var actionsEl = document.querySelector('[data-actions]');
    var messageEl = document.querySelector('[data-message]');
    var messageLine = document.querySelector('[data-message-line]');

    function crossThreshold() {
      if (!thresholdEl || thresholdEl.classList.contains('is-gone')) return;
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
    function goStudio() {
      window.location.href = JourneyResolver.STUDIO;
    }

    // The invitation says what is true and then points at the control
    // that changes it — the Create Story button that is already on
    // screen and always will be. Never a second copy of it: two
    // identical buttons a finger apart would teach that the interface
    // grows new controls when something is missing, and the whole
    // point of this home screen is that it does not.
    var createBtn = document.querySelector('[data-act="create"]');

    function invite(line) {
      if (!messageEl) return;
      messageLine.textContent = line;
      messageEl.hidden = false;
      messageEl.classList.add('is-in');
      if (createBtn) createBtn.classList.add('is-calling');
    }

    function dismissInvite() {
      if (!messageEl) return;
      messageEl.classList.remove('is-in');
      messageEl.hidden = true;
      if (createBtn) createBtn.classList.remove('is-calling');
    }

    if (actionsEl) {
      actionsEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-act]');
        if (!btn) return;
        dismissInvite();

        // The buttons ask what a tap means and do as they are told.
        // Neither of them knows what a Magic Card is.
        var decision = (btn.getAttribute('data-act') === 'my-stories')
          ? JourneyResolver.myStories()
          : JourneyResolver.createStory();

        if (decision.action === 'studio') { goStudio(); return; }

        // No empty state, no dead end, no software language — what is
        // true, and the one action that changes it.
        invite('You haven\u2019t shared a story with VihuPlanet yet. ' +
               'Every story you create will always have a place here.');
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

      // Everything said here is something the Story actually knows
      // about itself. No invented blurb, no fabricated popularity.
      var bits = [];
      if (pages.length) bits.push(pages.length + (pages.length === 1 ? ' page' : ' pages'));
      var when = whenShared(met.publishedAt);
      if (when) bits.push('shared ' + when);
      el.meta.textContent = bits.join(' · ');
      el.read.disabled = !pages.length;
      el.read.textContent = pages.length ? 'Read story' : 'Story is elsewhere';

      // Every Story in this Ether is this creator's own, so Continue
      // is always theirs to press. When a public feed exists, this is
      // the one line that learns to ask.
      el.cont.hidden = false;
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
      // Running again before the portal has finished closing, so the
      // universe is alive underneath as it is revealed rather than
      // starting up once it is exposed.
      universe.start();
      el.portal.classList.remove('is-open');
      window.setTimeout(function () { el.portal.hidden = true; }, 620);
      var node = met && universe.layer.nodeFor(met.id);
      if (node) node.el.focus();
    }

    function showPage() {
      el.page.src = pages[pageIndex] || '';
      el.pageNo.textContent = (pageIndex + 1) + ' / ' + pages.length;
      el.prev.disabled = pageIndex === 0;
      el.next.disabled = pageIndex >= pages.length - 1;
    }

    function turn(by) {
      var next = pageIndex + by;
      if (next < 0 || next >= pages.length) return;
      pageIndex = next;
      showPage();
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

    EtherFeed.attach(universe).then(function (stories) {
      var wanted = linkedProjectId();

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
