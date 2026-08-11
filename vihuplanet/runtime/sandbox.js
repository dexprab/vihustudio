// sandbox.js — the development harness for the VihuPlanet Runtime.
//
// Not part of the runtime. This file exists to do the two things a
// runtime cannot do for itself: put stories into a universe, and show
// what the universe currently costs.
//
// It is also the reference for how anything outside the runtime talks
// to it. The entire integration is four calls:
//
//     var universe = VihuPlanet.Universe.create({ mount: el });
//     universe.seed(stories);                    already in the Ether
//     universe.publish(story, { from: point });   joining, visibly
//     universe.start();
//
// When VihuStudio's Publish Studio finishes a publish, that is the one
// line it adds — `universe.publish(...)`. Nothing in the runtime needs
// to learn what publishing is.

(function () {
  'use strict';

  var TITLES = [
    'The dragon finally learned to fly', 'A star who wanted to sit down',
    'The fox who painted the sky', 'My grandmother’s blue umbrella',
    'The penguin who found her song', 'Nobody told the moon',
    'The bear who kept every leaf', 'A door at the bottom of the garden',
    'The whale who was afraid of water', 'Seven ways to catch a cloud',
    'The lantern that walked home', 'My brother turned into a bird',
    'The library under the sea', 'A very slow race',
    'The girl who could hear colours', 'Where the wind sleeps',
    'The last day of the rain', 'A house made of letters',
    'The cat who counted stars', 'My friend the mountain'
  ];

  var CREATORS = ['Vihaan', 'Aarav', 'Meera', 'Emma', 'Noor', 'Kai', 'Ishaan', 'Leila'];

  // Procedural covers, generated as SVG data URIs. Real published
  // stories will arrive with real cover images; this exists so the
  // harness exercises the covered path as well as the blank-card path
  // without adding a single binary asset to the repository.
  function cover(i) {
    var hues = [
      ['#8E7CB0', '#4C6E76'], ['#7EB1CE', '#1E2842'],
      ['#E8B871', '#8E7CB0'], ['#7C9C6F', '#1E2842'],
      ['#E4A455', '#4C6E76']
    ];
    var pair = hues[i % hues.length];
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">' +
      '<stop offset="0" stop-color="' + pair[0] + '"/>' +
      '<stop offset="1" stop-color="' + pair[1] + '"/>' +
      '</linearGradient></defs>' +
      '<rect width="120" height="160" fill="url(#g)"/>' +
      '<circle cx="' + (30 + (i * 17) % 60) + '" cy="' + (34 + (i * 11) % 40) + '" r="' +
        (10 + (i % 5) * 3) + '" fill="#F1EAD0" opacity="0.30"/>' +
      '<path d="M0 ' + (108 + (i % 4) * 8) + ' Q30 ' + (86 + (i % 6) * 6) +
        ' 60 ' + (104 + (i % 3) * 7) + ' T120 ' + (98 + (i % 5) * 6) +
        ' V160 H0 Z" fill="#1E2842" opacity="0.42"/>' +
      '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  var seq = 0;
  function makeStory() {
    var i = seq++;
    return {
      id: 'demo-' + i,
      title: TITLES[i % TITLES.length],
      creator: CREATORS[i % CREATORS.length],
      // Roughly two in three carry cover art, so both paths are always
      // on screen at once.
      cover: (i % 3 === 2) ? null : cover(i),
      publishedAt: null,
      source: { demo: true }
    };
  }

  function makeStories(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(makeStory());
    return out;
  }

  function boot() {
    var mount = document.querySelector('[data-universe]');
    if (!mount || !window.VihuPlanet) return;

    var universe = VihuPlanet.Universe.create({ mount: mount });
    if (!universe) return;

    // The universe was already here before anyone opened the page —
    // seeded stories do not play an arrival, because they did not
    // arrive.
    universe.seed(makeStories(24));
    universe.start();

    // Exposed for console poking and for the Playwright verification
    // pass. The runtime itself puts nothing on window except the
    // VihuPlanet namespace.
    window.sandboxUniverse = universe;

    var statsEl = document.querySelector('[data-stats]');
    function paintStats() {
      if (!statsEl) return;
      var s = universe.stats();
      statsEl.textContent =
        'stories    ' + s.stories + '\n' +
        'dom nodes  ' + s.nodes + '  (drawn ' + s.drawn + ')\n' +
        'stars      ' + s.stars + '\n' +
        'particles  ' + s.particles + '\n' +
        'arriving   ' + s.arriving + '\n' +
        'field      ' + s.field.width + '×' + s.field.height +
        (s.reducedMotion ? '\nreduced motion — universe is still' : '');
    }
    paintStats();
    window.setInterval(paintStats, 500);

    document.querySelector('.sandbox-actions').addEventListener('click', function (ev) {
      var action = ev.target && ev.target.getAttribute('data-action');
      if (!action) return;

      if (action === 'publish') {
        // `from` is where the story leaves from, in field coordinates
        // — the control the child actually pressed. In the Studio this
        // will be the Share button's own position.
        var rect = ev.target.getBoundingClientRect();
        var host = universe.root.getBoundingClientRect();
        universe.publish(makeStory(), {
          from: { x: rect.left - host.left + rect.width / 2, y: rect.top - host.top }
        });
      } else if (action === 'seed-50') {
        universe.seed(makeStories(50));
      } else if (action === 'shoot') {
        universe.ambient.shootNow();
      } else if (action === 'clear') {
        universe.stories.clear();
      }
      paintStats();
    });

    // The runtime announces; the harness listens. Nothing here reaches
    // back into the universe to make any of it happen.
    universe.on('story:born', function (p) {
      if (window.console) console.log('[sandbox] joined the Ether:', p.entity.title);
    });
    universe.on('focus:opened', function (p) {
      if (window.console) console.log('[sandbox] opened:', p.entity.title);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
