// js/buildInfo.js — World Builder dev build indicator.
//
// Mirrors the root VihuStudio app's build-info.json + js/buildInfo.js
// pattern (and vihuplanet's own copy): a small, live readout of which
// commit/build is actually running, populated at runtime from a hand-
// updated build-info.json so a stale deploy or browser cache is obvious
// at a glance rather than a guessing game. Same fetch-with-fallback
// shape as the root app's copy, targeting this tool's own footer.

(function () {
    var WB_NAME = 'World Builder';

    function setBuildFooterText(text) {
        try {
            var el = document.getElementById('buildInfoFooter');
            if (!el) return;
            el.textContent = text;
        } catch (e) {}
    }

    var fallback = WB_NAME + ' • Development';

    function render(j) {
        try {
            var v = j.version || '';
            // Engine V2 implementation phase — phase/milestone/slice
            // (falling back to the older sprint/task naming so a
            // pre-existing build-info.json never breaks the footer).
            var phase = j.phase || j.sprint || '';
            var milestone = j.milestone || j.task || '';
            var slice = j.slice || '';
            var b = j.build || '';
            var c = j.commit || '';
            var e = j.environment || '';
            var pm = phase && milestone ? (phase + ' — ' + milestone) : (phase || milestone);
            var parts = [];
            parts.push(v ? (WB_NAME + ' ' + v) : WB_NAME);
            if (pm) parts.push(pm);
            if (slice) parts.push('Slice: ' + slice);
            if (b) parts.push('Build ' + b);
            if (c) parts.push(c);
            if (e) parts.push(e);
            setBuildFooterText(parts.join(' | '));
        } catch (err) {
            setBuildFooterText(fallback);
        }
    }

    if (window.fetch) {
        fetch('build-info.json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('no-build-info'); return r.json(); })
            .then(render)
            .catch(function () { setBuildFooterText(fallback); });
    } else {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'build-info.json', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { render(JSON.parse(xhr.responseText)); }
                    catch (e) { setBuildFooterText(fallback); }
                } else {
                    setBuildFooterText(fallback);
                }
            };
            xhr.send();
        } catch (e) { setBuildFooterText(fallback); }
    }
})();
