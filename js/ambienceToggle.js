// js/ambienceToggle.js — one small way to turn the sound off.
//
// "add a universal non intrusive button to turn on/off ambience."
//
// ---------------------------------------------------------------
// UNIVERSAL, SO IT MOUNTS ITSELF
//
// It takes no configuration, has no caller and is not wired into
// anything: a page that loads this script has the button, and a page
// that does not, does not. That is what makes it universal rather than
// two buttons that have to be kept in step — VihuPlanet and the Studio
// are separate documents with separate stylesheets, and any design where
// each page mounts its own copy is a design where they drift.
//
// Its style is injected here for the same reason. Splitting it across
// css/style.css and css/vihuplanet-home.css would mean two rules that
// must agree forever, and the first divergence would be invisible until
// somebody noticed the button looked different in one place.
//
// ---------------------------------------------------------------
// NOTHING NEW IS BEING BUILT UNDERNEATH IT
//
// AudioManager already had setMuted/isMuted, and already persisted the
// answer to localStorage under its own key. Because both pages are one
// origin, the preference was ALREADY shared between them — it simply had
// no way to be set. So this is a control for a setting that existed, not
// a new setting.
//
// ---------------------------------------------------------------
// WHAT IT DOES NOT SILENCE, DELIBERATELY
//
// Lumo's voice and the Companions' — those play through LumoVoice and
// VihuVoice, which own their own audio elements and are not AudioManager's
// to mute. That is the right split for a control that says AMBIENCE: a
// child who wants the music off in the Studio Rite still wants to hear
// what Lumo is telling them. A single mute for everything would be a
// different control with a different name.
//
// ---------------------------------------------------------------
// ON THE HOME SCREEN
//
// CLAUDE.md -> Decision 10 fixes VihuPlanet's home at exactly two
// permanent ACTIONS and forbids a third appearing. This is not one of
// them and is built so it cannot be mistaken for one: it never joins
// that row, carries no label, sits in a corner at low contrast, and is
// there identically on a first visit and on the thousandth. The clause
// it has to answer to is "no new button may appear as a child
// progresses" — nothing here appears, and nothing here is about the
// journey. It is the volume knob on the radio, not a third place to go.
(function () {
  'use strict';

  var MOUNTED = 'vihu-ambience-toggle';

  // Mirrors AudioManager's own MUTE_KEY. Duplicated rather than read,
  // because it is that module's private constant and there is no getter
  // for it — but it is only used to FILTER storage events, so if the two
  // ever drift the cost is that cross-tab sync stops, not that anything
  // breaks. Every other path here goes through the public API.
  var MUTE_KEY = 'vihu-audio-muted';

  // Above every overlay in either document — measured, not guessed: the
  // Studio's highest is the modal layer at 2000 and VihuPlanet's is 8000.
  // A control for turning sound off is worth little if a screen can cover
  // it, and it is small and cornered enough to sit over anything.
  var Z = 9000;

  var CSS =
    // ABOVE THE BOTTOM BAND, not in the corner itself. Measured on both
    // pages: js/buildStamp.js mounts a fixed strip at left:8 bottom:6,
    // 228x20, and the Studio adds .dev-footer at right:8 bottom:8,
    // 404x18. The very corner is spoken for on both sides and on both
    // pages, so 12px put this button straight on top of the build stamp
    // — visible in a screenshot, and missed by an elementFromPoint check
    // because this button is simply the one on top.
    //
    // 34px clears the stamp's 26px band with a gap. The safe-area inset
    // is added rather than max()'d, so on a phone it clears the home
    // indicator AND the stamp.
    '.vihu-ambience{position:fixed;left:max(12px,env(safe-area-inset-left,0px));' +
    'bottom:calc(34px + env(safe-area-inset-bottom,0px));z-index:' + Z + ';' +
    // !important ON THE GEOMETRY, and it is not defensive noise.
    //
    // Measured, after the two pages disagreed: css/style.css carries
    //   button:not(.tab-btn):not(.theme-toggle):not(.export-btn)
    //         :not(#openBtn):not(#saveBtn):not(.creation-flow-myprojects-btn)
    //         { width:100%; margin-bottom:12px; }
    // which is specificity (2,4,1) — two ids and four classes. A plain
    // class cannot reach it, so in the Studio this button was 1280px
    // wide and sat 12px too high, while on VihuPlanet it was correct.
    // Exactly the drift a self-mounting widget exists to prevent.
    //
    // The alternative — adding .vihu-ambience to that :not() list — would
    // couple this widget to one page's stylesheet and still leave it
    // exposed on the next page with its own button rules. This is also
    // the codebase's own established answer: two other rules in
    // style.css carry the comment "escape the global button{width:100%}
    // cascade" and do the same thing.
    'width:34px!important;height:34px!important;padding:0!important;margin:0!important;' +
    'line-height:1;box-shadow:none;' +
    'display:flex;align-items:center;justify-content:center;' +
    'border:0;border-radius:50%;cursor:pointer;-webkit-appearance:none;appearance:none;' +
    'background:rgba(12,16,28,.42);color:#e7eaf3;opacity:.32;' +
    'transition:opacity .25s ease,background-color .25s ease;' +
    '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}' +
    // Quiet at rest and answers when reached for. Never announces itself,
    // never pulses, never asks to be pressed.
    '.vihu-ambience:hover,.vihu-ambience:focus-visible{opacity:.92;background:rgba(12,16,28,.66);}' +
    '.vihu-ambience:focus{outline:none;}' +
    '.vihu-ambience:focus-visible{outline:2px solid rgba(223,177,105,.85);outline-offset:2px;}' +
    '.vihu-ambience svg{width:18px;height:18px;display:block;}' +
    // Off is dimmer still: the state a child chose should not sit there
    // looking like something is wrong.
    '.vihu-ambience[data-off="1"]{opacity:.24;}' +
    '.vihu-ambience[data-off="1"]:hover,.vihu-ambience[data-off="1"]:focus-visible{opacity:.8;}' +
    '@media (prefers-reduced-motion:reduce){.vihu-ambience{transition:none;}}' +
    // Printing a story should not print a button.
    '@media print{.vihu-ambience{display:none;}}';

  // Two glyphs, drawn rather than typed: an emoji speaker renders as a
  // different picture on every platform and several are full colour,
  // which is louder than this control should ever be.
  var SPEAKER =
    '<path d="M4 6.5h2.6L10 3.6v10.8L6.6 11.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z" ' +
    'fill="currentColor"/>';
  var WAVES =
    '<path d="M12.4 6.2a4 4 0 0 1 0 5.6M14.6 4a7 7 0 0 1 0 10" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
  var SLASH =
    '<path d="M12.4 6.6l4.2 4.2M16.6 6.6l-4.2 4.2" fill="none" stroke="currentColor" ' +
    'stroke-width="1.4" stroke-linecap="round"/>';

  function _svg(off) {
    return '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">' +
      SPEAKER + (off ? SLASH : WAVES) + '</svg>';
  }

  function _muted() {
    try { return !!(window.AudioManager && window.AudioManager.isMuted()); }
    catch (e) { return false; }
  }

  function _paint(btn) {
    var off = _muted();
    btn.dataset.off = off ? '1' : '0';
    btn.innerHTML = _svg(off);
    // The label says what pressing it DOES, which is what a screen reader
    // announces — not what the current state is, which is what the icon
    // already shows.
    btn.setAttribute('aria-label', off ? 'Turn the sound on' : 'Turn the sound off');
    btn.setAttribute('title', off ? 'Sound off' : 'Sound on');
    btn.setAttribute('aria-pressed', off ? 'true' : 'false');
  }

  function mount() {
    // AudioManager is what this controls. Without it there is nothing to
    // turn off, and a button that does nothing is worse than no button.
    if (!window.AudioManager || typeof window.AudioManager.setMuted !== 'function') return null;
    if (document.getElementById(MOUNTED)) return document.getElementById(MOUNTED);

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.id = MOUNTED;
    btn.type = 'button';           // never submits a form it happens to land in
    btn.className = 'vihu-ambience';
    _paint(btn);

    btn.addEventListener('click', function () {
      try { window.AudioManager.setMuted(!_muted()); } catch (e) {}
      _paint(btn);
    });

    document.body.appendChild(btn);

    // A SECOND TAB IS THE SAME CHILD. AudioManager persists the choice to
    // localStorage, and the storage event fires in every OTHER document on
    // this origin — so a Studio tab left open goes quiet the moment the
    // sound is turned off on VihuPlanet, without either page knowing the
    // other exists. Two tabs both playing ambience is exactly the case
    // worth fixing.
    //
    // It has to APPLY the change, not merely redraw. The stored value is
    // AudioManager's copy of state it also holds in memory, and a storage
    // event does not update that memory — so repainting alone would draw
    // the new state over an unchanged sound.
    //
    // Guarded on difference because setMuted() writes unconditionally:
    // without the guard, applying here would write, which fires storage
    // in the tab that started it, which applies and writes again. The
    // guard stops it dead on the first pass rather than relying on the
    // values happening to converge.
    try {
      window.addEventListener('storage', function (e) {
        if (!e || e.key !== MUTE_KEY) return;
        var want = e.newValue === '1';
        if (want === _muted()) return;
        try { window.AudioManager.setMuted(want); } catch (err) {}
        _paint(btn);
      });
    } catch (e) {}

    return btn;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  try { window.AmbienceToggle = { mount: mount }; } catch (e) {}
})();
