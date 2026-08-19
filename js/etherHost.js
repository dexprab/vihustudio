// etherHost.js — the Story's host, standing in the portal.
//
// Sprint 1, Companion as World Host. When a Traveller opens a Story,
// the Companion of whoever made it is there — quiet, alive, and
// entirely optional to notice.
//
//   The story owns the attention. The Companion enriches the
//   experience.
//
// The test this file is held to: a Traveller must be able to read the
// whole Story start to finish while ignoring the Companion completely.
// Nothing here is a control, nothing waits for a tap, and nothing
// blocks a page. If it is noticed at all it should read as "there is
// someone living in this world", never as "an assistant appeared".
//
// ---------------------------------------------------------------
// WHY THIS IS NOT THE COMPANION WIDGET
//
// js/companionEngine.js's own mounted widget is the Studio's
// companion: it appends itself to document.body, it is draggable, it
// remembers where it was dragged to, it reacts to clicks and hovers
// with sparkle bursts, and it carries a speech bubble, a little grass-
// and-flowers "home" and a cloud charm. Every one of those is right in
// the Studio and wrong over a story somebody is reading — a draggable
// portrait that remembers its position is a Companion a child can park
// on top of the page, which is the one thing the attention hierarchy
// forbids.
//
// So this uses the SAME Companion Engine seams the three existing
// in-place companion surfaces already use — CompanionEngine.
// loadRegistry() for who exists, and the package's own
// companion.json states map for the art (js/studioRite.js,
// js/shareCeremony.js and js/magicCardUI.js all do exactly this, and
// each says so in a comment). No second companion system, no redrawn
// art, no change to any Companion's visual identity, and zero lines
// changed in js/companionEngine.js.
//
// ---------------------------------------------------------------
// THE ATTENTION HIERARCHY, MADE STRUCTURAL
//
// story -> story content -> interactive elements -> Companion -> UI.
//
// A z-index and a bit of care would have satisfied that by eye and
// broken the first time a Story had an unusually shaped page. Instead
// the host lives in its own reserved band at the foot of the portal
// (.ether-portal-foot, css/vihuplanet-home.css), so it CANNOT overlap
// the page, the arrows, the close control, the title or the count —
// there is no geometry in which those rectangles intersect, because
// they are in different rows of the same flex column. The band only
// reserves its height when a host is actually standing in it, so a
// Story with no host gets the layout it always had, to the pixel.
//
// It is also pointer-events:none. Not a click target, not a dismiss
// control, not a panel — there is nothing to interact with, so there
// is nothing to explain.
//
// ---------------------------------------------------------------
// FOUR BEHAVIOURS, AND ONLY FOUR
//
//   welcome    a small wave as the Story opens, settling to idle
//   presence   idle, with the gentlest float
//   reaction   one quiet pose when a page turns, rate-limited
//   celebrate  a brief flourish on the last page, once per reading
//
// There is no look/observe, no react-to-story-events and no scene
// transition, and that is not an omission. This runtime has no event
// model to hook and no scenes at all — EtherFeed.pagesOf() returns a
// flat list of page images. Inventing events to react to would be
// inventing a story model that does not exist.
//
// The page-turn reaction deliberately fires AFTER the turn animation
// has finished. A Companion moving while the paper is moving is two
// things competing for the same glance, and the page has to win.
const EtherHost = (function () {
  'use strict';

  // Poses as PREFERENCES, never requirements. The Companion packs have
  // genuinely uneven art — measured, not assumed: leafy is complete;
  // nimbus and leosaurus have no `think`; quill has no `celebrate`, no
  // `happy`, no `surprised` and no `sleep`. Every one of those is a
  // real child's real bonded Companion, so a behaviour has to degrade
  // to whatever that pack actually ships rather than showing a broken
  // image or, worse, someone else's art.
  //
  // Each chain ends somewhere every pack has (`idle` is a package's
  // declared defaultState by contract), so the worst case is "the host
  // simply does not change pose" — which reads as a calm presence, not
  // as a fault.
  const POSES = {
    welcome:   ['wave', 'happy', 'hero', 'idle'],
    presence:  ['idle'],
    reaction:  ['curious', 'think', 'surprised', 'idle'],
    celebrate: ['celebrate', 'happy', 'hero', 'idle'],
    // Worn while a line is being said. Lumo's package declares `talk`;
    // the Companions do not, so theirs degrades to the liveliest face
    // they have — which is right, because the point of this pose is
    // only that the figure does not stand in idle while its own voice
    // is heard.
    speaking:  ['talk', 'happy', 'curious', 'idle']
  };

  // ---------------------------------------------------------------
  // THE HOST SPEAKS TWICE, AND ONLY TWICE
  //
  // Once as the Traveller arrives, once as the Story ends. Nothing in
  // between — the Companion's job for the whole middle of a Story is to
  // be present and to be ignorable.
  //
  // This is a deliberate change to CLAUDE.md → Decision 25, which said
  // the World Host does not speak at all and that giving it a voice
  // would be a canon change rather than a feature. It was, and it was
  // made: "Sprint 1.1 — World Host Vocal Welcome & Farewell". Decision
  // 24's test still binds every line of this — a Traveller must be able
  // to experience the complete Story without paying the Companion any
  // attention — which is why there are two moments rather than a
  // presence that talks.
  //
  // NOT A NARRATOR. These lines never describe the Story, never explain
  // it, never refer to what is on the page, and never claim to have met
  // this Traveller before. The Ether knows nobody: it has a Story, its
  // owner, and that owner's Companion, and nothing else. "Welcome back"
  // is unwriteable here because it would be a lie.
  const OPENING = [
    { text: 'Hey… you\'re here.',                       emotion: 'happy'     },
    { text: 'Oh! Ready to see what\'s here?',           emotion: 'curious'   },
    { text: 'Come on… let\'s explore.',                 emotion: 'warm'      },
    { text: 'I wonder what we\'ll find.',               emotion: 'curious'   },
    { text: 'Ooh… this looks interesting.',             emotion: 'curious'   },
    { text: 'Something magical is waiting.',            emotion: 'warm'      },
    { text: 'Come along… the story\'s about to begin.', emotion: 'gentle'    },
    { text: 'Oh! I think we\'re going to like this.',   emotion: 'happy'     },
    { text: 'Shhh… look around.',                       emotion: 'whisper'   },
    { text: 'Ready? Let\'s go.',                        emotion: 'happy'     }
  ];

  const FAREWELL = [
    { text: 'That was a lovely story.',                 emotion: 'warm'      },
    { text: 'Wow… what an adventure!',                  emotion: 'celebrate' },
    { text: 'And that\'s where our story ends.',        emotion: 'gentle'    },
    { text: 'What a wonderful little adventure.',       emotion: 'warm'      },
    { text: 'I wonder what happens next…',              emotion: 'curious'   },
    { text: 'That was fun!',                            emotion: 'happy'     },
    { text: 'Thanks for coming along.',                 emotion: 'warm'      },
    { text: 'And so… the story comes to an end.',       emotion: 'gentle'    },
    { text: 'The story\'s resting now.',                emotion: 'gentle'    },
    { text: 'See you in the next story.',               emotion: 'warm'      }
  ];

  // The canonical fallbacks, named by the brief. Index 0 of each library
  // is that line, so "the default" and "the first entry" cannot drift
  // apart.
  const DEFAULT_OPENING  = OPENING[0];
  const DEFAULT_FAREWELL = FAREWELL[0];

  // How long the host is willing to WAIT for the Story to stop talking
  // before giving up on its own line. Story narration always wins
  // (§11, §15): a Companion talking over a page's own recorded voice is
  // two people speaking at once, which is worse than a Companion that
  // said nothing.
  const YIELD_POLL_MS   = 250;
  // The opening's patience, and why it SHRANK from six seconds to two
  // and a half. Six meant that whether a child was greeted at all
  // depended on how long the first page's recording happened to run —
  // a 5-second page got a welcome, a 7-second one got silence, and
  // nobody chose that. The product owner's ruling: the welcome comes
  // FIRST (the portal holds the arrival page's narration until the
  // greeting has landed — see openingDone below), and this short wait
  // is only the FALLBACK for a page already talking when the host
  // wants to speak, e.g. a child who turned pages before the welcome
  // fired. §11's "delay slightly, or suppress": 2.5s is slightly;
  // six was not.
  const OPENING_WAIT_MS = 2500;
  const FAREWELL_WAIT_MS = 12000; // an ending can afford to wait longer

  // Ambience sits UNDER the Companion (§11). Ducked rather than
  // silenced — the world should still be there behind the voice.
  const DUCK_LEVEL = 0.35;

  const WELCOME_DELAY_MS   = 760;   // after the portal has finished opening
  const WELCOME_HOLD_MS    = 1900;
  const SPEAK_AFTER_WAVE_MS = 420;  // the wave lands, then the line begins
  const FAREWELL_PAUSE_MS  = 900;   // the flourish, a breath, then goodbye
  const REACTION_HOLD_MS   = 1300;
  const REACTION_QUIET_MS  = 2600;  // never react more often than this
  const CELEBRATE_HOLD_MS  = 2400;

  let root = null;      // [data-portal-host]
  let img  = null;      // [data-portal-host-img]
  let foot = null;      // the reserved band

  let pack = null;      // {basePath, pkg}
  let poses = null;     // resolved pose name -> real src (or null)
  let timers = [];
  let lastReactionAt = 0;
  let celebrated = false;
  let who = null;         // the companion id currently hosting, for its voice
  let isBusy = null;      // the caller's "is the Story itself talking?" predicate
  let spokeOpening = false;
  let spokeFarewell = false;
  let lastLine = { open: -1, bye: -1 };   // never the same line twice running

  // THE OPENING REPORTS WHEN IT IS OVER — spoken, suppressed, or
  // impossible — so the portal can hold the arrival page's own narration
  // exactly that long and not a moment longer. Settled EXACTLY ONCE on
  // every path out of the opening: no host, no art, no voice, spoken to
  // the end, given up, cut by a page turn, or the portal closing. A
  // path that forgot to settle would leave a story silent behind the
  // caller's own safety cap, which is why the settle is a single latch
  // rather than eight remembered call sites being careful.
  let openingDone = null;
  let openingSettled = false;

  function _settleOpening() {
    if (openingSettled) return;
    openingSettled = true;
    const cb = openingDone;
    openingDone = null;
    if (!cb) return;
    try { cb(); } catch (e) {}
  }

  // One token per open(). Everything asynchronous checks it before
  // touching the DOM, so a Story closed while its Companion was still
  // resolving can never arrive late over the next one. This is also
  // what makes "no duplicate Companion across page turns and reopens"
  // true by construction rather than by tidying up afterwards.
  let token = 0;

  function _els() {
    if (root) return true;
    root = document.querySelector('[data-portal-host]');
    img  = document.querySelector('[data-portal-host-img]');
    foot = root ? root.closest('.ether-portal-foot') : null;
    return !!(root && img);
  }

  function _later(fn, ms) {
    const mine = token;
    const id = window.setTimeout(function () {
      if (mine !== token) return;
      fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function _clearTimers() {
    timers.forEach(function (id) { window.clearTimeout(id); });
    timers = [];
  }

  // ---------- what art actually exists ----------
  //
  // A pose DECLARED in companion.json is not a guarantee the file has
  // been uploaded — a disclosed gap across several packs, and the
  // reason js/studioRite.js, js/shareCeremony.js and js/magicCardUI.js
  // each carry their own version of this note. Here the check is done
  // ONCE per Story, up front, so a behaviour knows whether it can
  // happen before its moment arrives rather than discovering a 404
  // mid-flourish.
  const _probe = {};
  function _exists(src) {
    if (_probe[src]) return _probe[src];
    _probe[src] = new Promise(function (resolve) {
      const probe = new Image();
      probe.onload  = function () { resolve(probe.naturalWidth > 0); };
      probe.onerror = function () { resolve(false); };
      probe.src = src;
    });
    return _probe[src];
  }

  function _srcFor(name) {
    const states = pack && pack.pkg && pack.pkg.states;
    return (states && states[name]) ? (pack.basePath + states[name]) : null;
  }

  function _firstReal(chain, i) {
    i = i || 0;
    if (i >= chain.length) return Promise.resolve(null);
    const src = _srcFor(chain[i]);
    if (!src) return _firstReal(chain, i + 1);
    return _exists(src).then(function (ok) {
      return ok ? src : _firstReal(chain, i + 1);
    });
  }

  function _resolvePoses() {
    const kinds = Object.keys(POSES);
    return Promise.all(kinds.map(function (k) { return _firstReal(POSES[k]); }))
      .then(function (found) {
        const out = {};
        kinds.forEach(function (k, i) { out[k] = found[i]; });
        return out;
      });
  }

  function _pose(kind) {
    if (!img || !poses) return;
    const src = poses[kind] || poses.presence;
    if (!src) return;
    if (img.getAttribute('src') === src) return;
    img.setAttribute('src', src);
  }

  // ---------- the presence itself ----------

  function _mount(record) {
    if (!_els()) return;
    // Decorative by intention as well as by CSS: a Traveller using a
    // screen reader is reading a story, and a Companion announcing
    // itself into that would be the loudest thing in the portal.
    img.setAttribute('alt', '');
    root.hidden = false;
    if (foot) foot.classList.add('has-host');
    _pose('presence');
    // Two frames, matching how the portal itself opens: the browser
    // has to have laid the element out before the arriving class has
    // anything to transition from.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (root) root.classList.add('is-here');
      });
    });
  }

  /**
   * A Story has been opened. Resolves its host, and shows it only if
   * there really is one — a Story shared before the Companion
   * travelled with it shows nobody at all, never a substitute.
   *
   * @param {object} story the Story Entity the portal is showing
   */
  // ---------------------------------------------------------------
  // speaking

  // Lightweight random, per the brief — with the one rule that keeps it
  // from reading as a script: never the line that played last. A child
  // who opens two Stories in a row and hears the same greeting twice
  // learns immediately that it is a recording.
  function _pick(list, slot) {
    if (list.length < 2) return list[0];
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (i === lastLine[slot]);
    lastLine[slot] = i;
    return list[i];
  }

  function _storyTalking() {
    try { return !!(isBusy && isBusy()); } catch (e) { return false; }
  }

  // Wait for the Story to stop talking, then run `go`. Gives up after
  // `budget` — which is a real outcome, not a failure: the Companion
  // simply did not get a word in, and the Story was more important.
  // `gaveUp` (optional) is told when that happens, because the opening
  // needs to settle its promise on that path too.
  function _whenStoryQuiet(go, budget, gaveUp) {
    const mine = token;
    let waited = 0;
    (function tick() {
      if (mine !== token) return;
      if (!_storyTalking()) { go(); return; }
      waited += YIELD_POLL_MS;
      if (waited >= budget) {                // suppressed, silently
        if (gaveUp) { try { gaveUp(); } catch (e) {} }
        return;
      }
      _later(tick, YIELD_POLL_MS);
    })();
  }

  /**
   * Say one line, in the host Companion's own voice, with the ambience
   * held down under it. Everything about it is optional: no voice, no
   * platform, no network, a browser refusing audio — each ends with the
   * line unspoken and the Story exactly as it was (§16).
   */
  // True exactly while a line is being said. The pose timers elsewhere
  // consult it so that a scheduled return-to-presence (the welcome's,
  // the celebrate's) cannot put the figure back in idle in the middle
  // of its own sentence — which is precisely what made the voice read
  // as coming from nowhere.
  let talking = false;

  function _say(line) {
    if (!line || !who) return Promise.resolve(false);
    if (typeof VihuVoice === 'undefined' || !VihuVoice.speak) return Promise.resolve(false);
    try { if (window.AudioManager) AudioManager.duckFor(DUCK_LEVEL); } catch (e) {}

    // THE FIGURE VISIBLY SPEAKS (reported: "its not getting registered
    // that this is the voice of companion or that image on right spoke
    // this"). A speaking pose plus the is-speaking glow, worn for
    // exactly the duration of the words — the synchrony IS the
    // attribution, the way a moving mouth is. Still not UI: no bubble,
    // no text, nothing to tap (AC7).
    talking = true;
    _pose('speaking');
    if (root) root.classList.add('is-speaking');

    const release = function () {
      talking = false;
      if (root) root.classList.remove('is-speaking');
      if (poses) _pose('presence');
      try { if (window.AudioManager) AudioManager.releaseDuck(); } catch (e) {}
    };
    // Resolves when the words have actually finished (or could not be
    // said) — which is what lets the opening tell the portal "now the
    // page may speak". VihuVoice.speak() resolves on the audio's own
    // `ended`, so this is the real end of the line, not an estimate.
    return new Promise(function (resolve) {
      let done = false;
      const settle = function (heard) {
        if (done) return;
        done = true;
        release();
        resolve(!!heard);
      };
      // A belt-and-braces release: if speak() somehow never settles, the
      // world must not stay quiet for the rest of the reading.
      _later(function () { settle(false); }, 15000);
      try {
        VihuVoice.speak({ characterId: who, text: line.text, emotion: line.emotion })
          .then(settle, function () { settle(false); });
      } catch (e) { settle(false); }
      // A Story closed mid-sentence takes the voice with it — see close().
    });
  }

  function open(story, opts) {
    close();
    const mine = ++token;
    isBusy = (opts && typeof opts.isBusy === 'function') ? opts.isBusy : null;
    openingDone = (opts && typeof opts.openingDone === 'function') ? opts.openingDone : null;
    openingSettled = false;
    if (typeof StoryHost === 'undefined') { _settleOpening(); return; }

    StoryHost.resolve(story).then(function (record) {
      if (mine !== token || !record) { _settleOpening(); return null; }
      return StoryHost.packOf(record).then(function (found) {
        if (mine !== token || !found) { _settleOpening(); return null; }
        pack = found;
        return _resolvePoses().then(function (resolved) {
          if (mine !== token) { _settleOpening(); return null; }
          // Not one real image in the whole package. Showing an empty
          // frame would be worse than showing nothing.
          if (!resolved.presence) { _settleOpening(); return null; }
          poses = resolved;
          who = record.id || null;
          _mount(record);
          // The welcome waits for the portal to have finished opening.
          // Arriving in the middle of that is one movement too many at
          // the exact moment the child is looking at the first page.
          _later(function () {
            _pose('welcome');
            _later(function () { if (!talking) _pose('presence'); }, WELCOME_HOLD_MS);
            // The wave first, then the words — the Companion notices the
            // Traveller before it says anything to them. Roughly 1.2s
            // into the portal, which sits inside the brief's 3-5s
            // arrival without being timed to a frame.
            //
            // THE WELCOME COMES FIRST (product owner: "go with A and B
            // as fallback"). On the arrival page the portal is holding
            // the page's own narration until _settleOpening() fires, so
            // _whenStoryQuiet is normally already quiet — it is the B
            // fallback, for a child who turned pages before the welcome
            // fired, where a page's voice IS playing and the host waits
            // briefly then yields. Either way the settle runs exactly
            // once: after the line ends, or on giving up.
            _later(function () {
              if (spokeOpening) { _settleOpening(); return; }
              _whenStoryQuiet(function () {
                if (spokeOpening) { _settleOpening(); return; }
                spokeOpening = true;
                _say(_pick(OPENING, 'open')).then(_settleOpening, _settleOpening);
              }, OPENING_WAIT_MS, _settleOpening);
            }, SPEAK_AFTER_WAVE_MS);
          }, WELCOME_DELAY_MS);
          return null;
        });
      });
    }).catch(function () {
      /* a quieter portal, never a broken one */
      _settleOpening();
    });
  }

  /**
   * A page has turned. Called once the turn has finished, so the
   * Companion never moves while the paper is moving.
   *
   * @param {number} index the page now showing, zero-based
   * @param {number} total how many pages the Story has
   */
  function pageTurned(index, total) {
    if (!poses || !root || root.hidden) return;

    // A CHILD WHO TURNS THE PAGE HAS ANSWERED THE WELCOME. If the
    // opening has not happened yet — still waiting on its delay, or
    // mid-sentence — it is cut, not queued: a greeting delivered two
    // pages in is no longer a greeting, and the story always wins over
    // the Companion (§15). Marking spokeOpening stops the pending timer
    // path from firing it late; the settle releases the arrival page's
    // narration hold, which no longer matters but must not dangle.
    if (!openingSettled) {
      spokeOpening = true;
      try { if (typeof VihuVoice !== 'undefined' && VihuVoice.stop) VihuVoice.stop(); } catch (e) {}
      try { if (window.AudioManager) AudioManager.releaseDuck(); } catch (e) {}
      _settleOpening();
    }

    // The last page. A brief flourish, once per reading — a Companion
    // that celebrated again every time a child flicked back and forth
    // over the end would stop meaning anything.
    //
    // A one-page Story never reaches here (there is no turn to make),
    // which is right: the welcome already happened seconds ago, and
    // there was no journey to have finished.
    if (total > 1 && index >= total - 1 && !celebrated) {
      celebrated = true;
      _pose('celebrate');
      _later(function () { if (!talking) _pose('presence'); }, CELEBRATE_HOLD_MS);
      // THE GOODBYE. React, breathe, then speak — a farewell that lands
      // on top of its own flourish is a notification, and this is meant
      // to be somebody seeing a visitor out.
      //
      // Once per reading, like the flourish it follows: a child flicking
      // back and forth over the last page is not arriving at the end
      // again. The wait is longer than the opening's because an ending
      // page is the most likely one to carry narration, and there is no
      // hurry — nothing follows it.
      _later(function () {
        if (spokeFarewell) return;
        _whenStoryQuiet(function () {
          if (spokeFarewell) return;
          spokeFarewell = true;
          _say(_pick(FAREWELL, 'bye'));
        }, FAREWELL_WAIT_MS);
      }, FAREWELL_PAUSE_MS);
      return;
    }

    // One quiet reaction. Rate-limited so that a child turning pages
    // quickly gets a companion that is reading along, not one
    // flickering between poses.
    const now = Date.now();
    if (now - lastReactionAt < REACTION_QUIET_MS) return;
    lastReactionAt = now;
    _pose('reaction');
    _later(function () { if (!talking) _pose('presence'); }, REACTION_HOLD_MS);
  }

  /** The portal is closing. The host leaves with it. */
  function close() {
    token++;
    _clearTimers();
    // A VOICE MUST NOT OUTLIVE THE STORY IT BELONGED TO. Closing the
    // portal while the host is mid-sentence would leave a Companion
    // talking about a world the child has already left — the same rule
    // the page's own narration follows (stopVoice on close).
    try { if (typeof VihuVoice !== 'undefined' && VihuVoice.stop) VihuVoice.stop(); } catch (e) {}
    try { if (window.AudioManager) AudioManager.releaseDuck(); } catch (e) {}
    // A pending openingDone must not dangle into the next Story — the
    // caller's hold has its own safety cap, but a settle here is exact.
    _settleOpening();
    pack = null;
    poses = null;
    who = null;
    isBusy = null;
    spokeOpening = false;
    spokeFarewell = false;
    celebrated = false;
    lastReactionAt = 0;
    if (!root && !_els()) return;
    talking = false;
    if (root) {
      root.classList.remove('is-here');
      root.classList.remove('is-speaking');
      root.hidden = true;
    }
    if (foot) foot.classList.remove('has-host');
    if (img) img.removeAttribute('src');
  }

  const api = { open: open, close: close, pageTurned: pageTurned };
  try { window.EtherHost = api; } catch (e) {}
  return api;
})();
