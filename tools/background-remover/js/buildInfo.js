// js/buildInfo.js — Background Remover dev build indicator.
//
// Mirrors the root VihuStudio app's build-info.json + js/buildInfo.js
// pattern (also used by tools/world-builder and tools/world-builder-v2):
// a small, live readout of which commit/build is actually running,
// populated at runtime from a hand-updated build-info.json so a stale
// deploy or browser cache is obvious at a glance rather than a
// guessing game.
//
// Loaded as a plain classic script (not a module) so it works even if
// this page is ever opened directly via file:// — no import.meta, no
// module-loading requirements.

(function () {
  var TOOL_NAME = 'Background Remover';

  function setFooterText(text) {
    try {
      var el = document.getElementById('buildInfoFooter');
      if (!el) return;
      el.textContent = text;
    } catch (e) {}
  }

  var fallback = TOOL_NAME + ' • Development';

  // Only version/build/commit/environment ever render in the on-screen
  // footer -- `sprint`/`task` are this tool's own long-form changelog
  // prose (see build-info.json itself), not meant for a small
  // fixed-position badge. The full file is still fetched and still a
  // real file anyone can open directly for that detail.
  function summarize(j) {
    var v = j.version || '';
    var b = j.build || '';
    var c = j.commit || '';
    var e = j.environment || '';
    var parts = [];
    parts.push(v ? TOOL_NAME + ' ' + v : TOOL_NAME);
    if (b) parts.push('Build ' + b);
    if (c) parts.push(c);
    if (e) parts.push(e);
    return parts.join(' • ');
  }

  if (window.fetch) {
    fetch('build-info.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('no-build-info'); return r.json(); })
      .then(function (j) {
        try { setFooterText(summarize(j)); }
        catch (err) { setFooterText(fallback); }
      })
      .catch(function () { setFooterText(fallback); });
  } else {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'build-info.json', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try { setFooterText(summarize(JSON.parse(xhr.responseText))); }
          catch (e) { setFooterText(fallback); }
        } else {
          setFooterText(fallback);
        }
      };
      xhr.send();
    } catch (e) { setFooterText(fallback); }
  }
})();
