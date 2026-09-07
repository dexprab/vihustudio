// CREATE FROM CREATURE — the VISUAL REFERENCE layer of the Shape Lab.
// LAB ONLY. Never loaded by a child-facing page, never by the preview.
//
// WHAT IT IS. A second canvas laid UNDER the editor's own "Complete —
// as drawn" canvas, on which the blueprint's rough sketch, its feature
// labels and its suggested points are drawn faintly — so a person can
// place the Ether's lights OVER a picture of what they are building.
// The lights, the joins and the gaps stay the author's own, on the
// editor's own canvas, in the editor's own state.
//
// WHAT IT IS NOT.
//   - It is not the creature. Nothing drawn here reaches a fixture, a
//     candidate, the preview or the Ether: this file writes to no
//     storage, builds no candidate, and the editor's serialize() has no
//     field for a sketch. `ShapeLab.state()` is the proof.
//   - It is not a hidden image. The sketch is a handful of ellipses,
//     polygons and lines in unit space — vector primitives from a
//     validated blueprint — never a bitmap, never a URL, never markup.
//   - It is not a control. The underlay carries `pointer-events: none`
//     and is aria-hidden; every tap goes to the editor canvas above it.
//   - It is not a judge. It computes no score and asks nothing about
//     whether the author's figure is any good.
//   - It knows no creature. There is no creature list and no branch on
//     a subject anywhere in it; a subject is a string a person typed,
//     shown back to them and sent — alone — to the assistant.
//
// SUGGESTIONS ARE SUGGESTIONS. A faint mark where a point COULD go —
// the anchor of a feature the blueprint names for this budget. Adding a
// light close to one snaps to it, and from that instant it is an
// ordinary light: movable, deletable, the author's. A mark near an
// existing light is not drawn, so a suggestion never nags about a place
// already taken. Off by one checkbox; gone with the reference.
//
// ON / OFF. Off, the underlay is hidden and the editor paints its own
// opaque sky — byte for byte the render the Shape Lab always had. That
// is the judging state: only the Ether figure.
(function (global) {
  'use strict';

  var doc = global.document;
  var NEAR = 0.12;                         // unit distance: "close enough to snap"
  var SKETCH_STROKE = 'rgba(126,156,214,.34)';
  var SKETCH_FILL = 'rgba(126,156,214,.07)';
  var LABEL = 'rgba(170,190,236,.78)';
  var SUGGEST = 'rgba(206,222,255,';

  var state = {
    current: null,     // the validated blueprint in use
    meta: null,        // { subject, source, model } for the status line only
    previous: null,    // the reference before the last "another interpretation"
    previousMeta: null,
    visible: true,     // REFERENCE ON / OFF
    labels: true,      // feature annotations
    suggestOn: true,   // suggested points
    dismissed: {},     // feature names whose annotation was closed
    busy: false
  };

  var canvas = null;

  function el(sel) { return doc && doc.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------
  function isShowing() { return !!(state.current && state.visible); }

  function set(bp, meta) {
    if (!bp) return { ok: false, reason: 'no-blueprint' };
    if (state.current) { state.previous = state.current; state.previousMeta = state.meta; }
    state.current = bp;
    state.meta = meta || null;
    state.dismissed = {};
    state.visible = true;
    sync();
    return { ok: true };
  }

  // "Try another interpretation" keeps the one before it, until it is
  // replaced in turn. One step back, never a history.
  function restorePrevious() {
    if (!state.previous) return { ok: false, reason: 'no-previous' };
    var cur = state.current, curMeta = state.meta;
    state.current = state.previous; state.meta = state.previousMeta;
    state.previous = cur; state.previousMeta = curMeta;
    state.dismissed = {};
    sync();
    return { ok: true };
  }

  function discard() {
    state.current = null; state.meta = null;
    state.previous = null; state.previousMeta = null;
    state.dismissed = {};
    sync();
    return { ok: true };
  }

  function show(v) { state.visible = !!v; sync(); return isShowing(); }
  function showLabels(v) { state.labels = !!v; sync(); }
  function showSuggestions(v) { state.suggestOn = !!v; sync(); }
  function dismiss(name) { state.dismissed[String(name)] = true; sync(); }

  // ---------------------------------------------------------------
  // SUGGESTIONS — the blueprint's anchors for THIS budget, minus any
  // place a light already stands.
  // ---------------------------------------------------------------
  function occupied(x, y) {
    var S = global.ShapeLab;
    if (!S) return false;
    var fig = S.figure();
    return fig.points.some(function (p) { return Math.hypot(p[0] - x, p[1] - y) < NEAR; });
  }

  function suggestions() {
    var S = global.ShapeLab, B = global.LabBlueprint;
    if (!S || !B || !state.current || !state.suggestOn) return [];
    var budget = S.state().budget;
    return B.suggestions(state.current, budget).filter(function (s) { return !occupied(s.x, s.y); });
  }

  // Add mode asks this with the unit point under the pointer; a
  // suggestion within reach answers with its own place, otherwise null
  // and the light lands exactly where the author pressed.
  function snap(u) {
    if (!isShowing()) return null;
    var best = null, bd = NEAR;
    suggestions().forEach(function (s) {
      var d = Math.hypot(s.x - u[0], s.y - u[1]);
      if (d < bd) { bd = d; best = [s.x, s.y]; }
    });
    return best;
  }

  // ---------------------------------------------------------------
  // THE UNDERLAY
  // ---------------------------------------------------------------
  function mount() {
    var editor = el('[data-canvas-complete]');
    if (!editor || canvas) return;
    canvas = doc.createElement('canvas');
    canvas.setAttribute('data-reference', '');
    canvas.className = 'reference-layer';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    editor.parentNode.insertBefore(canvas, editor);
  }

  function place() {
    var editor = el('[data-canvas-complete]');
    if (!editor || !canvas) return null;
    var w = editor.clientWidth, h = editor.clientHeight;
    canvas.style.left = editor.offsetLeft + 'px';
    canvas.style.top = editor.offsetTop + 'px';
    canvas.style.width = editor.offsetWidth + 'px';
    canvas.style.height = editor.offsetHeight + 'px';
    return { w: w, h: h, ox: editor.clientLeft, oy: editor.clientTop };
  }

  function drawSketch(g, bp, S, w, h) {
    g.lineWidth = Math.max(1.4, Math.min(w, h) / 300);
    g.strokeStyle = SKETCH_STROKE; g.fillStyle = SKETCH_FILL;
    g.lineJoin = 'round'; g.lineCap = 'round';
    bp.sketch.forEach(function (p) {
      if (p.kind === 'ellipse') {
        var c = S.project(p.c, w, h);
        var k = S.scaleFor(w, h);
        g.beginPath();
        g.ellipse(c[0], c[1], p.r[0] * k, p.r[1] * k, p.rot || 0, 0, Math.PI * 2);
        g.fill(); g.stroke();
      } else {
        g.beginPath();
        p.points.forEach(function (q, i) {
          var s = S.project(q, w, h);
          if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]);
        });
        if (p.closed) { g.closePath(); g.fill(); }
        g.stroke();
      }
    });
  }

  function drawLabels(g, bp, S, w, h) {
    var fs = Math.max(10, Math.min(w, h) / 40);
    g.font = '600 ' + fs + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    bp.features.forEach(function (f) {
      if (state.dismissed[f.name]) return;
      var s = S.project(f.anchor, w, h);
      g.strokeStyle = LABEL; g.lineWidth = 1;
      g.beginPath(); g.arc(s[0], s[1], fs * 0.55, 0, Math.PI * 2); g.stroke();
      g.fillStyle = LABEL;
      g.fillText(f.name, s[0] + fs * 0.75, s[1]);
    });
  }

  function drawSuggestions(g, S, w, h) {
    var r = Math.max(5, Math.min(w, h) / 70);
    suggestions().forEach(function (s) {
      var q = S.project([s.x, s.y], w, h);
      g.setLineDash([3, 4]);
      g.strokeStyle = SUGGEST + '.55)'; g.lineWidth = 1;
      g.beginPath(); g.arc(q[0], q[1], r, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.fillStyle = SUGGEST + '.35)';
      g.beginPath(); g.arc(q[0], q[1], Math.max(1.6, r / 3), 0, Math.PI * 2); g.fill();
    });
  }

  function render() {
    if (!canvas) return;
    var S = global.ShapeLab;
    var showing = isShowing() && !!S;
    canvas.hidden = !showing;
    if (!showing) return;
    var geo = place();
    if (!geo) return;
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr)) canvas.width = Math.round(W * dpr);
    if (canvas.height !== Math.round(H * dpr)) canvas.height = Math.round(H * dpr);
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // The editor's own sky, painted here because the editor goes
    // transparent while a reference is showing.
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#161C33'); grad.addColorStop(1, '#1E2440');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    g.save();
    g.translate(geo.ox, geo.oy);
    drawSketch(g, state.current, S, geo.w, geo.h);
    if (state.labels) drawLabels(g, state.current, S, geo.w, geo.h);
    drawSuggestions(g, S, geo.w, geo.h);
    g.restore();
  }

  // ---------------------------------------------------------------
  // THE PANEL — the blueprint, read back to the author. The text is
  // the assistant's; the marks on the canvas are its anchors; nothing
  // here is a score.
  // ---------------------------------------------------------------
  function stars(n) { return '●'.repeat(n) + '○'.repeat(3 - n); }

  function renderPanel() {
    var box = el('[data-ref-panel]');
    if (!box) return;
    var bp = state.current;
    if (!bp) {
      box.innerHTML = '<div class="note">No reference yet. Enter a creature above and press Generate reference — or draw without one, exactly as before.</div>';
      return;
    }
    var S = global.ShapeLab;
    var budget = S ? S.state().budget : 8;
    var html = '<div class="bp-subject">' + esc(bp.subject) + '</div>' +
      '<div class="bp-sil">' + esc(bp.silhouette) + '</div>' +
      '<div class="bp-h">Features — most diagnostic first</div>' +
      bp.features.map(function (f) {
        var off = !!state.dismissed[f.name];
        return '<div class="bp-f' + (off ? ' off' : '') + '">' +
          '<span class="bp-imp" title="importance ' + f.importance + ' of 3">' + stars(f.importance) + '</span>' +
          '<span class="bp-name">' + esc(f.name) + '</span>' +
          '<span class="bp-why">' + esc(f.why) + '</span>' +
          (off ? '' : '<button class="bp-x quiet" data-ref-dismiss="' + esc(f.name) + '" title="hide this label on the reference">×</button>') +
        '</div>';
      }).join('') +
      '<div class="bp-h">Where to spend each budget</div>' +
      global.LabBlueprint.BUDGETS.map(function (b) {
        var list = bp.budgets[String(b)] || [];
        return '<div class="bp-b' + (b === budget ? ' now' : '') + '"><span class="bp-bn">' + b + '</span> ' +
          (list.length ? esc(list.join(' · ')) : '<span class="note">—</span>') + '</div>';
      }).join('');
    box.innerHTML = html;
    box.querySelectorAll('[data-ref-dismiss]').forEach(function (b) {
      b.addEventListener('click', function () { dismiss(b.getAttribute('data-ref-dismiss')); });
    });
  }

  function status(msg, kind) {
    var n = el('[data-ref-status]');
    if (!n) return;
    n.textContent = msg || '';
    n.className = 'say ref-status' + (kind ? ' ' + kind : '');
  }

  function paintControls() {
    var has = !!state.current;
    var t = el('[data-ref-toggle]');
    if (t) {
      t.disabled = !has;
      t.textContent = has ? (state.visible ? 'REFERENCE ON' : 'REFERENCE OFF') : 'REFERENCE — none';
      t.classList.toggle('on', has && state.visible);
    }
    var an = el('[data-ref-another]'); if (an) an.disabled = !has || state.busy;
    var rp = el('[data-ref-restore]'); if (rp) rp.disabled = !state.previous || state.busy;
    var dc = el('[data-ref-discard]'); if (dc) dc.disabled = !has;
    var lb = el('[data-ref-labels]'); if (lb) { lb.checked = state.labels; lb.disabled = !has; }
    var sg = el('[data-ref-suggest]'); if (sg) { sg.checked = state.suggestOn; sg.disabled = !has; }
    var gen = el('[data-ref-generate]'); if (gen) gen.disabled = state.busy;
    var src = el('[data-ref-source]');
    if (src) {
      src.textContent = !state.meta ? '' :
        (state.meta.source === 'fixture'
          ? 'FIXTURE — a generic body plan standing in for "' + state.meta.subject + '"; the pipeline, not the creature.'
          : 'Generated for "' + state.meta.subject + '"' + (state.meta.model ? ' (' + state.meta.model + ')' : '') + ' — a reference to draw over, never the creature itself.');
    }
  }

  function sync() {
    paintControls();
    renderPanel();
    // The editor repaints first (transparent or opaque, as the toggle now
    // says), then the underlay — a render is not an edit, so nothing emits.
    if (global.ShapeLab && global.ShapeLab.render) global.ShapeLab.render();
    render();
  }

  // ---------------------------------------------------------------
  // GENERATION — one subject in; the transport is LabConnection's
  // (fixture / endpoint / direct — the same three the Mystery Lab has,
  // and a key never lives in this file). The reply is TEXT until the
  // blueprint validator says otherwise; a refused reply changes nothing.
  // ---------------------------------------------------------------
  function generate(subject) {
    var B = global.LabBlueprint, Conn = global.LabConnection, S = global.ShapeLab;
    if (!B || !Conn) { status('The blueprint or connection module is not loaded.', 'warn'); return Promise.resolve({ ok: false, reason: 'not-loaded' }); }
    var m = B.messagesFor(subject);
    if (!m.ok) {
      status('Give a subject to work from — letters, numbers, spaces, up to 40 characters.', 'warn');
      return Promise.resolve({ ok: false, reason: m.reason });
    }
    state.busy = true; paintControls();
    status('Asking for a reference for "' + m.subject + '"…');
    return Conn.generate({
      messages: m.messages,
      fixture: function () { return JSON.stringify(B.fixture(m.subject).blueprint); }
    }).then(function (r) {
      state.busy = false;
      if (!r || !r.ok) {
        status('Could not get a reference (' + ((r && r.reason) || 'unavailable') + '). ' + (state.current ? 'The reference you had is still here.' : 'Nothing changed.'), 'warn');
        paintControls();
        return { ok: false, reason: (r && r.reason) || 'unavailable' };
      }
      var v = B.parse(r.text);
      if (!v.ok) {
        status('The reply was not a usable blueprint — ' + v.reasons.slice(0, 3).join(', ') + (v.reasons.length > 3 ? '…' : '') + '. ' + (state.current ? 'The reference you had is still here.' : 'Nothing changed.'), 'warn');
        paintControls();
        return { ok: false, reason: 'invalid-blueprint', reasons: v.reasons };
      }
      set(v.blueprint, { subject: m.subject, source: r.source, model: r.model || null });
      if (S && S.setAuthoring) S.setAuthoring({ subject: m.subject, referenceUsed: true, source: r.source });
      // The researcher-metadata name is filled from the typed subject only
      // while it is empty — a name already given is never overwritten.
      if (S && S.setName && !S.state().name) S.setName(m.subject);
      status(r.source === 'fixture'
        ? 'Fixture reference in place — a generic body plan, not "' + m.subject + '". Connect a real assistant for a real one.'
        : 'Reference in place for "' + m.subject + '". Place your lights over it; the lights are yours.', 'ok');
      return { ok: true, source: r.source };
    }).catch(function (e) {
      state.busy = false; paintControls();
      status('Could not get a reference. ' + (state.current ? 'The reference you had is still here.' : 'Nothing changed.'), 'warn');
      return { ok: false, reason: 'error' };
    });
  }

  // ---------------------------------------------------------------
  // THE PAGE — the compact connection controls (reusing LabConnection
  // exactly as the Mystery Lab's panel does) and the reference controls.
  // ---------------------------------------------------------------
  function paintConn() {
    var Conn = global.LabConnection;
    var n = el('[data-conn-status]');
    if (!n || !Conn) return;
    var st = Conn.status();
    n.textContent = st.line;
    n.className = 'note conn-status ' + (/CONNECTED/.test(st.line) ? 'good' : (/UNAVAILABLE/.test(st.line) ? 'warn' : 'mid'));
  }

  function wireConn() {
    var Conn = global.LabConnection;
    if (!Conn) return;
    function v(sel) { var n = el(sel); return n ? n.value : ''; }
    function syncFields() {
      var mode = Conn.status().mode;
      var ep = el('[data-conn-endpoint-fields]'), dr = el('[data-conn-direct-fields]');
      if (ep) ep.hidden = mode !== 'endpoint';
      if (dr) dr.hidden = mode !== 'direct';
      paintConn();
    }
    doc.querySelectorAll('[data-conn-mode]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) { Conn.setMode(r.getAttribute('data-conn-mode')); syncFields(); } });
    });
    var url = el('[data-conn-url]'), tok = el('[data-conn-token]');
    if (url) url.addEventListener('input', function () { Conn.setEndpoint(v('[data-conn-url]'), v('[data-conn-token]')); paintConn(); });
    if (tok) tok.addEventListener('input', function () { Conn.setEndpoint(v('[data-conn-url]'), v('[data-conn-token]')); paintConn(); });
    var key = el('[data-conn-key]');
    if (key) key.addEventListener('input', function () { Conn.setDirectKey(key.value); paintConn(); });
    var mdl = el('[data-conn-model]');
    if (mdl) mdl.addEventListener('input', function () { Conn.setDirectModel(mdl.value); });
    var test = el('[data-conn-test]');
    if (test) test.addEventListener('click', function () {
      test.disabled = true;
      Conn.probe().then(function () { test.disabled = false; paintConn(); });
    });
    var clr = el('[data-conn-clear]');
    if (clr) clr.addEventListener('click', function () {
      Conn.disconnect();
      if (key) key.value = ''; if (tok) tok.value = ''; if (url) url.value = '';
      var fx = el('[data-conn-mode="fixture"]'); if (fx) fx.checked = true;
      syncFields();
    });
    syncFields();
  }

  function wire() {
    mount();
    var S = global.ShapeLab;
    if (S && S.observe) S.observe(render);      // every editor repaint repaints the underlay after it
    wireConn();
    var subj = el('[data-ref-subject]');
    var gen = el('[data-ref-generate]');
    if (gen) gen.addEventListener('click', function () { generate(subj ? subj.value : ''); });
    if (subj) subj.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); generate(subj.value); } });
    var an = el('[data-ref-another]');
    if (an) an.addEventListener('click', function () { generate(state.meta ? state.meta.subject : (subj ? subj.value : '')); });
    var rp = el('[data-ref-restore]');
    if (rp) rp.addEventListener('click', function () { var r = restorePrevious(); status(r.ok ? 'The previous reference is back; the other one is one press away.' : ''); });
    var dc = el('[data-ref-discard]');
    if (dc) dc.addEventListener('click', function () { discard(); status('Reference discarded. Your lights and joins are exactly where they were.'); });
    var t = el('[data-ref-toggle]');
    if (t) t.addEventListener('click', function () { show(!state.visible); });
    var lb = el('[data-ref-labels]');
    if (lb) lb.addEventListener('change', function () { showLabels(lb.checked); });
    var sg = el('[data-ref-suggest]');
    if (sg) sg.addEventListener('change', function () { showSuggestions(sg.checked); });
    global.addEventListener('resize', render);
    sync();
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }

  global.LabReference = {
    NEAR: NEAR,
    set: set, restorePrevious: restorePrevious, discard: discard,
    show: show, showLabels: showLabels, showSuggestions: showSuggestions, dismiss: dismiss,
    isShowing: isShowing, snap: snap, suggestions: suggestions, generate: generate,
    current: function () { return state.current ? JSON.parse(JSON.stringify(state.current)) : null; },
    previous: function () { return state.previous ? JSON.parse(JSON.stringify(state.previous)) : null; },
    meta: function () { return state.meta ? JSON.parse(JSON.stringify(state.meta)) : null; },
    labels: function () { return state.labels; },
    dismissed: function () { return Object.keys(state.dismissed); },
    render: render,
    canvas: function () { return canvas; }
  };
})(typeof window !== 'undefined' ? window : this);
