// Family Album go/no-go test driver. Plain script, no dependencies.
// Answers, against a REAL shared album in a REAL browser:
//   A. Edge Function reachable + scrape returns a photo list?
//   B. Thumbnails render at all (plain <img>, no crossOrigin)?
//   C. Direct lh3 load with crossOrigin='anonymous' → canvas getImageData
//      succeeds? (i.e. no canvas tainting — the ideal path)
//   D. If C fails: does the Edge Function's ?img= byte-proxy path work?
// Verdict: GO (direct) / GO (proxy fallback needed) / NO-GO.
(function () {
  'use strict';

  var logEl = document.getElementById('log');
  var gridEl = document.getElementById('grid');
  var verdictEl = document.getElementById('verdict');
  var albumInput = document.getElementById('album');
  var runBtn = document.getElementById('run');

  // Remember the last-used link for convenience across reruns.
  try { albumInput.value = localStorage.getItem('vihu-family-album-test-url') || ''; } catch (e) {}

  var lines = [];
  function log(cls, msg) {
    lines.push('<span class="' + cls + '">' + msg + '</span>');
    logEl.innerHTML = lines.join('\n');
  }
  function reset() {
    lines = [];
    logEl.textContent = '';
    gridEl.innerHTML = '';
    verdictEl.className = '';
    verdictEl.style.display = 'none';
  }
  function verdict(cls, text) {
    verdictEl.className = cls;
    verdictEl.textContent = text;
  }

  function loadConfig() {
    // Same root config file Studio's own themeRepositoryClient reads.
    return fetch('../../supabase-config.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('supabase-config.json not found at site root'); return r.json(); })
      .then(function (cfg) {
        if (!cfg || !cfg.url || !cfg.anonKey) throw new Error('supabase-config.json is missing url/anonKey');
        return cfg;
      });
  }

  function fnBase(cfg) {
    return cfg.url.replace(/\/+$/, '') + '/functions/v1/family-album';
  }
  function authHeaders(cfg) {
    return { 'Authorization': 'Bearer ' + cfg.anonKey, 'apikey': cfg.anonKey };
  }

  // C: direct CORS-mode load + canvas pixel read.
  function testDirectCors(baseUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve({ ok: false, why: 'timeout loading image in CORS mode' }); } }, 15000);
      img.onload = function () {
        if (done) return; done = true; clearTimeout(timer);
        try {
          var cv = document.createElement('canvas');
          cv.width = 8; cv.height = 8;
          var ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0, 8, 8);
          ctx.getImageData(0, 0, 1, 1); // throws if tainted
          resolve({ ok: true });
        } catch (e) {
          resolve({ ok: false, why: 'canvas tainted: ' + e.message });
        }
      };
      img.onerror = function () {
        if (done) return; done = true; clearTimeout(timer);
        resolve({ ok: false, why: 'image failed to load in CORS mode (no CORS headers from lh3)' });
      };
      img.src = baseUrl + '=w512-h512';
    });
  }

  // D: proxy the bytes through the Edge Function, then canvas-read.
  function testProxy(cfg, baseUrl) {
    var proxied = fnBase(cfg) + '?img=' + encodeURIComponent(baseUrl + '=w512-h512');
    return fetch(proxied, { headers: authHeaders(cfg) })
      .then(function (r) {
        if (!r.ok) throw new Error('proxy HTTP ' + r.status);
        var ct = r.headers.get('Content-Type') || '';
        if (ct.indexOf('application/json') !== -1) {
          return r.json().then(function (j) { throw new Error('proxy error: ' + (j.error || 'unknown')); });
        }
        return r.blob();
      })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(blob);
          var img = new Image();
          img.onload = function () {
            try {
              var cv = document.createElement('canvas');
              cv.width = 8; cv.height = 8;
              var ctx = cv.getContext('2d');
              ctx.drawImage(img, 0, 0, 8, 8);
              ctx.getImageData(0, 0, 1, 1);
              URL.revokeObjectURL(url);
              resolve({ ok: true, bytes: blob.size });
            } catch (e) { reject(new Error('proxied image still tainted?! ' + e.message)); }
          };
          img.onerror = function () { reject(new Error('proxied bytes did not decode as an image')); };
          img.src = url;
        });
      })
      .catch(function (e) { return { ok: false, why: e.message }; });
  }

  function run() {
    reset();
    var albumUrl = (albumInput.value || '').trim();
    if (!albumUrl) { log('bad', '❌ Paste a shared album link first.'); return; }
    try { localStorage.setItem('vihu-family-album-test-url', albumUrl); } catch (e) {}
    runBtn.disabled = true;

    var cfg = null;
    var photos = null;

    loadConfig()
      .then(function (c) {
        cfg = c;
        log('ok', '✅ Loaded supabase-config.json (' + cfg.url + ')');
        log('warn', '→ Calling Edge Function (album list)…');
        return fetch(fnBase(cfg) + '?url=' + encodeURIComponent(albumUrl), { headers: authHeaders(cfg) });
      })
      .then(function (r) {
        log(r.ok ? 'ok' : 'bad', (r.ok ? '✅' : '❌') + ' Edge Function HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j.ok) throw new Error('scrape failed: ' + (j.error || 'unknown') + (j.status ? ' (upstream HTTP ' + j.status + ')' : ''));
        photos = j.photos || [];
        log('ok', '✅ Scrape OK — ' + j.count + ' photo(s) found');
        if (!photos.length) throw new Error('album is empty — add a few photos to it and rerun');
        var sample = photos[0];
        log('ok', '   first: ' + sample.width + '×' + sample.height + ' — ' + sample.url.slice(0, 72) + '…');
        // B: plain thumbnail render (no crossOrigin) — up to 12
        photos.slice(0, 12).forEach(function (p) {
          var img = document.createElement('img');
          img.src = p.url + '=w300-h300';
          gridEl.appendChild(img);
        });
        log('warn', '→ Testing direct lh3 load in CORS mode (canvas-taint check)…');
        return testDirectCors(sample.url);
      })
      .then(function (direct) {
        if (direct.ok) {
          log('ok', '✅ Direct CORS load works — canvas pixel read succeeded. No proxy needed.');
          verdict('go', '🟢 GO — scrape works, images are canvas-safe directly. Build on the direct path.');
          return null;
        }
        log('warn', '⚠️ Direct CORS load failed (' + direct.why + ')');
        log('warn', '→ Testing Edge Function ?img= byte-proxy fallback…');
        return testProxy(cfg, photos[0].url).then(function (proxy) {
          if (proxy.ok) {
            log('ok', '✅ Proxy fallback works (' + proxy.bytes + ' bytes) — canvas-safe via proxy.');
            verdict('goproxy', '🟡 GO (proxy) — scrape works; picks will route image bytes through the Edge Function.');
          } else {
            log('bad', '❌ Proxy fallback also failed: ' + proxy.why);
            verdict('nogo', '🔴 NO-GO — scrape works but images are unreachable both ways. Screenshot this report.');
          }
        });
      })
      .catch(function (e) {
        log('bad', '❌ ' + e.message);
        verdict('nogo', '🔴 NO-GO — ' + e.message + ' (screenshot this report)');
      })
      .then(function () { runBtn.disabled = false; });
  }

  runBtn.addEventListener('click', run);
})();
