// js/buildInfo.js — VihuPlanet dev-only build indicator (Sprint 2).
//
// A small, low-opacity readout in the bottom-left corner showing
// which commit + build is actually live, so a stale GitHub Pages
// deploy or a stale browser cache is obvious at a glance instead of
// a guessing game. Mirrors the root VihuStudio app's build-info.json
// + js/buildInfo.js pattern (this is a static site with no build
// step, so the JSON is hand-updated per deploy, same as there).
//
// Gated behind DEV_BUILD_INFO below — flip to false (or remove the
// <script> tag in index.html) before a production-facing release.

(function () {
  'use strict';

  var DEV_BUILD_INFO = true;
  if (!DEV_BUILD_INFO) return;

  function render(info) {
    var el = document.createElement('div');
    el.id = 'devBuildInfo';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed',
      'left:10px',
      'bottom:8px',
      'z-index:9999',
      'pointer-events:none',
      'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'font-size:10px',
      'line-height:1.35',
      'color:#1E2842',
      'opacity:0.32',
      'white-space:pre',
      'user-select:none'
    ].join(';');

    var lines = ['Build'];
    if (info.commit)         lines.push(info.commit);
    if (info.buildTimestamp) lines.push(info.buildTimestamp);
    if (info.environment)    lines.push(info.environment);
    el.textContent = lines.join('\n');

    document.body.appendChild(el);
  }

  function boot() {
    fetch('build-info.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) { if (info) render(info); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
