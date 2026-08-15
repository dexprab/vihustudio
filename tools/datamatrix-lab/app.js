// app.js — the lab's controls, scanner and counters.
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var state = {
    attempts: 0, ok: 0, fail: 0, times: [],
    byStrategy: {},          // strategy -> {ok, fail, times}
    last: null
  };

  // ---------------------------------------------------------------
  // DECODING — @zxing/library, hinted to Data Matrix only.
  //
  // Hinting matters for both speed and honesty: an unhinted reader can
  // return a QR or a barcode it happened to find in the room, and this
  // experiment must never count that as a success.
  var hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.DATA_MATRIX]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  var reader = new ZXing.MultiFormatReader();
  reader.setHints(hints);

  function decodeCanvas(cv) {
    var t0 = performance.now();
    try {
      var lum = new ZXing.HTMLCanvasElementLuminanceSource(cv);
      var bin = new ZXing.HybridBinarizer(lum);
      var bmp = new ZXing.BinaryBitmap(bin);
      var res = reader.decode(bmp);
      return { ok: true, text: res.getText(), ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, ms: Math.round(performance.now() - t0) };
    } finally {
      reader.reset();
    }
  }

  // ---------------------------------------------------------------
  // Controls
  function opts(extra) {
    var o = {
      id: $('#cid').value.trim() || 'TEST-0001',
      family: $('#family').value,
      strategy: $('#strategy').value,
      matrixOpacity: +$('#op').value,
      matrixContrast: +$('#con').value,
      starSize: +$('#sz').value,
      starBright: +$('#sb').value,
      skyBright: +$('#sk').value,
      showMatrix: $('#tMatrix').checked,
      showStars: $('#tStars').checked,
      showSky: $('#tSky').checked,
      showLines: $('#tLines').checked
    };
    // Star count trims the family's own shape, so the constellation
    // stays a real constellation rather than becoming random dots.
    var full = Lab.place(o.id, o.family);
    o.stars = full.slice(0, Math.max(3, Math.min(+$('#sc').value, full.length)));
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }

  function render() {
    ['#vOp','#op','#vCon','#con','#vSz','#sz','#vSb','#sb','#vSk','#sk','#vSc','#sc'];
    $('#vOp').textContent = (+$('#op').value).toFixed(2);
    $('#vCon').textContent = (+$('#con').value).toFixed(2);
    $('#vSz').textContent = (+$('#sz').value).toFixed(2);
    $('#vSb').textContent = (+$('#sb').value).toFixed(2);
    $('#vSk').textContent = (+$('#sk').value).toFixed(2);
    $('#vSc').textContent = $('#sc').value;

    // The child never sees a layer toggle — their card is always all
    // three layers, whatever the technical view is showing.
    var childOpts = opts({ showMatrix: true, showStars: true, showSky: true });
    var info = Lab.draw($('#cardChild'), childOpts);
    var t = Lab.draw($('#cardTech'), opts());

    $('#techInfo').innerHTML =
      row('Creator ID (test)', info.id) +
      row('Family', info.family) +
      row('Star cells', info.stars.map(function (p) { return p[0] + ',' + p[1]; }).join('  ')) +
      row('Matrix modules', t.modules ? (t.modules + ' × ' + t.modules) : 'off') +
      row('Strategy', $('#strategy').value);
  }

  function row(k, v) { return '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; }

  // ---------------------------------------------------------------
  // Self-test: decode the card we just drew, at print-ish resolution.
  function selfTest() {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 1000;
    Lab.draw(cv, opts({ quiet: true }));
    var r = decodeCanvas(cv);
    record(r, $('#strategy').value, r.ok && r.text === opts().id);
    alert(r.ok
      ? 'DECODED "' + r.text + '" in ' + r.ms + ' ms'
      : 'COULD NOT READ at these settings (' + r.ms + ' ms)');
  }

  function record(r, strategy, correct) {
    state.attempts++;
    var slot = state.byStrategy[strategy] || (state.byStrategy[strategy] = { ok: 0, fail: 0, times: [] });
    if (r.ok && correct) {
      state.ok++; slot.ok++; state.times.push(r.ms); slot.times.push(r.ms);
      state.last = { text: r.text, ms: r.ms, strategy: strategy, at: new Date().toLocaleTimeString() };
    } else {
      state.fail++; slot.fail++;
    }
    paintCounters();
  }

  function avg(a) { return a.length ? Math.round(a.reduce(function (s, x) { return s + x; }, 0) / a.length) : 0; }

  function paintCounters() {
    var rate = state.attempts ? Math.round(state.ok / state.attempts * 100) : 0;
    $('#rate').textContent = state.attempts ? rate + '% success' : '—';
    $('#counters').innerHTML =
      row('Attempts', state.attempts) + row('Successful', state.ok) +
      row('Failed', state.fail) + row('Avg decode', avg(state.times) + ' ms');
    $('#lastDecode').innerHTML = state.last
      ? row('Value', '<code>' + state.last.text + '</code>') +
        row('Decode time', state.last.ms + ' ms') +
        row('Strategy', state.last.strategy) + row('At', state.last.at)
      : row('—', 'nothing decoded yet');
    var html = '';
    Object.keys(state.byStrategy).sort().forEach(function (k) {
      var s = state.byStrategy[k], n = s.ok + s.fail;
      html += row(k, s.ok + '/' + n + '  ·  ' + (n ? Math.round(s.ok / n * 100) : 0) + '%  ·  ' + avg(s.times) + ' ms');
    });
    $('#byStrategy').innerHTML = html || row('—', 'no attempts yet');
  }

  // ---------------------------------------------------------------
  // Camera
  var stream = null, loop = null, work = document.createElement('canvas');

  function setState(cls, text) {
    var el = $('#scanState');
    el.className = 'state ' + cls;
    el.textContent = text;
  }

  function startCam() {
    if (stream) return;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false
    }).then(function (s) {
      stream = s;
      var v = $('#cam');
      v.srcObject = s; v.play();
      setState('s-searching', 'searching');
      // A MODEST CADENCE, deliberately. Decoding every frame would
      // stutter the preview and tells us nothing extra: a child holds a
      // card still for far longer than 400ms.
      loop = setInterval(tick, 400);
    }).catch(function () {
      setState('s-fail', 'no camera');
    });
  }

  function stopCam() {
    if (loop) { clearInterval(loop); loop = null; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    $('#cam').srcObject = null;
    setState('s-idle', 'idle');
  }

  function tick() {
    var v = $('#cam');
    if (!v.videoWidth) return;
    var W = 800;
    work.width = W;
    work.height = Math.round(W * v.videoHeight / v.videoWidth);
    work.getContext('2d').drawImage(v, 0, 0, work.width, work.height);
    var r = decodeCanvas(work);
    if (r.ok) {
      setState('s-found', 'decoded — ' + r.text);
      record(r, $('#strategy').value, true);
    } else {
      setState('s-searching', 'searching');
    }
  }

  // ---------------------------------------------------------------
  // 20 identities
  function sheetIds() { return Lab.ids(20); }

  function gen20() {
    var host = $('#sheet');
    host.innerHTML = '';
    sheetIds().forEach(function (id) {
      var fig = document.createElement('figure');
      var cv = document.createElement('canvas');
      cv.width = cv.height = 420;
      Lab.draw(cv, opts({ id: id, family: Lab.familyFor(id), stars: null, quiet: true }));
      var cap = document.createElement('figcaption');
      cap.textContent = id + ' · ' + Lab.familyFor(id).replace('_', ' ');
      fig.appendChild(cv); fig.appendChild(cap); host.appendChild(fig);
    });
    $('#sheetResult').textContent = '20 identities generated.';
  }

  function verify20() {
    var ids = sheetIds(), seen = {}, bad = [], times = [];
    ids.forEach(function (id) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 1000;
      Lab.draw(cv, opts({ id: id, family: Lab.familyFor(id), stars: null, quiet: true }));
      var r = decodeCanvas(cv);
      if (!r.ok) { bad.push(id + ' → could not read'); return; }
      times.push(r.ms);
      if (r.text !== id) bad.push(id + ' → decoded as ' + r.text);
      if (seen[r.text]) bad.push(id + ' collides with ' + seen[r.text]);
      seen[r.text] = id;
    });
    $('#sheetResult').innerHTML = bad.length
      ? '<b style="color:#f88">' + bad.length + ' problem(s):</b> ' + bad.join(' · ')
      : '<b style="color:#9fd">All 20 decoded, each to its own ID.</b> avg ' + avg(times) + ' ms';
  }

  function download(cv, name) {
    var a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = name;
    a.click();
  }

  // ---------------------------------------------------------------
  // Wiring
  Lab.FAMILIES.forEach(function (f) {
    var o = document.createElement('option');
    o.value = f; o.textContent = f.replace('_', ' ');
    $('#family').appendChild(o);
  });
  $('#family').value = 'LYRA';

  ['#cid','#family','#strategy','#op','#con','#sz','#sb','#sk','#sc',
   '#tMatrix','#tStars','#tSky','#tLines'].forEach(function (s) {
    $(s).addEventListener('input', render);
    $(s).addEventListener('change', render);
  });

  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      ['child','tech','scan','sheet'].forEach(function (t) {
        $('#tab-' + t).classList.toggle('hide', t !== b.dataset.tab);
      });
      if (b.dataset.tab !== 'scan') stopCam();
    });
  });

  $('#dl').addEventListener('click', function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 1000;
    Lab.draw(cv, opts());
    download(cv, opts().id + '-card.png');
  });
  // The clean version: no frame, no family name, nothing but the card
  // itself — what actually gets printed and held up.
  $('#dlClean').addEventListener('click', function () {
    var cv = document.createElement('canvas'); cv.width = cv.height = 1000;
    Lab.draw(cv, opts({ quiet: true }));
    download(cv, opts().id + '-clean.png');
  });
  $('#dlSheet').addEventListener('click', function () {
    var ids = sheetIds(), cols = 4, size = 500, pad = 20;
    var rows = Math.ceil(ids.length / cols);
    var cv = document.createElement('canvas');
    cv.width = cols * size + pad * (cols + 1);
    cv.height = rows * size + pad * (rows + 1);
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ids.forEach(function (id, i) {
      var one = document.createElement('canvas'); one.width = one.height = size;
      Lab.draw(one, opts({ id: id, family: Lab.familyFor(id), stars: null, quiet: true }));
      var x = pad + (i % cols) * (size + pad), y = pad + Math.floor(i / cols) * (size + pad);
      ctx.drawImage(one, x, y);
    });
    download(cv, 'datamatrix-lab-20-cards.png');
  });

  $('#selfTest').addEventListener('click', selfTest);
  $('#camStart').addEventListener('click', startCam);
  $('#camStop').addEventListener('click', stopCam);
  $('#reset').addEventListener('click', function () {
    state = { attempts: 0, ok: 0, fail: 0, times: [], byStrategy: {}, last: null };
    paintCounters();
  });
  $('#gen20').addEventListener('click', gen20);
  $('#verify20').addEventListener('click', verify20);

  $('#libs').innerHTML = 'encoder <code>bwip-js 4.5.1</code> · decoder <code>@zxing/library 0.21.3</code> · both MIT, vendored, no CDN';

  render();
  paintCounters();

  window.Lab_test = { decodeCanvas: decodeCanvas, opts: opts, record: record, state: function () { return state; } };
})();
