// scene.js — VihuPlanet M0.1 scene orchestrator.
//
// The world is almost entirely CSS + asset SVGs. This tiny script:
//
//   1. Asks WorldObject.mount() to fetch every registered SVG and
//      inject it into the correct layer (.sky / .ground /
//      .foreground). Each descriptor carries placement + motion
//      metadata, so mounting also stamps the CSS custom properties.
//
//   2. Attaches the motion-name class from animations/motion.css to
//      each mounted object. The registry declares e.g.
//      `motion: { category: 'Living', name: 'twinkle' }`; scene.js
//      adds `.twinkle` to the wrapper.
//
//   3. Reveals the hero prompt after ~2.3 s so the world exists for
//      a moment first, then the question appears as if written onto
//      the page.
//
// No libraries. No frameworks. Vanilla DOM only.

(function () {
  'use strict';

  function armMotion() {
    document.querySelectorAll('.world-object').forEach(function (wrap) {
      var motionName = wrap.dataset.motionName;
      if (motionName) wrap.classList.add(motionName);
      var motionCategory = wrap.dataset.motionCategory;
      if (motionCategory) wrap.classList.add('motion-category-' + motionCategory.toLowerCase());
    });
  }

  // Reveal the hero prompt after the world has settled. The
  // `.drawn-in` class in animations/motion.css owns the fade + rise.
  // The decorative underline follows shortly after so the whole
  // moment reads like the question is being written onto the page.
  function revealHeroPrompt(delayMs) {
    var prompt = document.querySelector('[data-hero-prompt]');
    var underline = document.querySelector('[data-hero-underline]');
    if (!prompt) return;
    window.setTimeout(function () {
      prompt.hidden = false;
      // requestAnimationFrame so the browser sees the layout change
      // (from display:none to visible) before the animation class
      // is applied — otherwise Chromium skips the initial keyframe.
      window.requestAnimationFrame(function () {
        prompt.classList.add('drawn-in');
        if (underline) underline.classList.add('is-revealed');
      });
    }, delayMs);
  }

  function boot() {
    var world = document.querySelector('.world');
    if (!world) return;

    if (typeof WorldObject === 'undefined') {
      // Registry didn't load; nothing to mount. Hero prompt still
      // reveals so the page isn't blank.
      revealHeroPrompt(2300);
      return;
    }

    WorldObject.mount(world).then(function () {
      armMotion();
      revealHeroPrompt(2300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
