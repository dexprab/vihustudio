// scene.js — VihuPlanet scene bootstrap.
//
// Chapter 1 responsibilities:
//   1. WorldObject.mount(): fetch every registered SVG and inject it
//      into the correct layer (.sky / .ground / .foreground).
//   2. armMotion(): attach the motion-name class from
//      animations/motion.css onto each mounted object.
//   3. revealHeroPrompt(): reveal "Who's creating today?" after
//      ~2.3 s via the Greeting `drawn-in` motion.
//
// Chapter 2 additions:
//   4. mountStorytellerPlanets(): PlanetsManager paints the four
//      floating storyteller planets into .foreground.
//   5. mountDreamingPlanet(): DreamingPlanetManager paints the
//      Dreaming Planet + dialogue + choice buttons.

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

  function mountStorytellerPlanets(delayMs) {
    var host = document.querySelector('[data-planets-host]');
    if (!host || typeof PlanetsManager === 'undefined') return;
    window.setTimeout(function () { PlanetsManager.mount(host); }, delayMs);
  }

  function mountDreamingPlanet(delayMs) {
    var host = document.querySelector('[data-dreaming-planet-host]');
    if (!host || typeof DreamingPlanetManager === 'undefined') return;
    window.setTimeout(function () { DreamingPlanetManager.mount(host); }, delayMs);
  }

  function boot() {
    var world = document.querySelector('.world');
    if (!world) return;

    if (typeof WorldObject === 'undefined') {
      revealHeroPrompt(2300);
      mountStorytellerPlanets(3400);
      mountDreamingPlanet(3800);
      return;
    }

    WorldObject.mount(world).then(function () {
      armMotion();
      revealHeroPrompt(2300);
      // Planets settle in ~1.1s after the hero prompt starts drawing,
      // then the Dreaming Planet arrives ~0.4s after them so the
      // eye naturally travels: question → familiar planets → the
      // mystery.
      mountStorytellerPlanets(3400);
      mountDreamingPlanet(3800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
