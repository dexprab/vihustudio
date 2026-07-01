// scene.js — VihuPlanet scene bootstrap.
//
// Chapter 1 responsibilities:
//   1. WorldObject.mount(): fetch every registered SVG and inject it
//      into the correct layer (.sky / .ground / .foreground). Each
//      descriptor carries placement + motion metadata; mounting
//      stamps the CSS custom properties.
//   2. armMotion(): attach the motion-name class from
//      animations/motion.css onto each mounted object.
//   3. revealHeroPrompt(): reveal "Who's creating today?" after
//      ~2.3 s via the Greeting `drawn-in` motion.
//
// Chapter 2 addition:
//   4. mountStorytellers(): StorytellerManager paints the row of
//      storyteller cards into .foreground once the hero prompt is
//      revealed, so the choreography reads as "world → question →
//      choose".

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

  function revealHeroPrompt(delayMs) {
    var prompt = document.querySelector('[data-hero-prompt]');
    var underline = document.querySelector('[data-hero-underline]');
    if (!prompt) return;
    window.setTimeout(function () {
      prompt.hidden = false;
      window.requestAnimationFrame(function () {
        prompt.classList.add('drawn-in');
        if (underline) underline.classList.add('is-revealed');
      });
    }, delayMs);
  }

  function mountStorytellers(delayMs) {
    var host = document.querySelector('[data-storyteller-host]');
    if (!host) return;
    if (typeof StorytellerManager === 'undefined') return;
    window.setTimeout(function () {
      StorytellerManager.mount(host);
    }, delayMs);
  }

  function boot() {
    var world = document.querySelector('.world');
    if (!world) return;

    if (typeof WorldObject === 'undefined') {
      revealHeroPrompt(2300);
      mountStorytellers(3600);
      return;
    }

    WorldObject.mount(world).then(function () {
      armMotion();
      revealHeroPrompt(2300);
      // Storytellers arrive 1.3 s after the hero prompt starts
      // drawing in, which lets the question breathe first.
      mountStorytellers(3600);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
