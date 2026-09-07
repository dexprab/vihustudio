// CREATURE CANDIDATE GALLERY — a Lab research instrument. LAB ONLY.
//
// Phase 1 of the Creature Mystery research: WHAT CAN THE ETHER FIGURE
// LANGUAGE REPRESENT? The gallery shows authored, COMPLETED candidate
// figures for a creature at 8 · 12 · 16 · 20 points, side by side, so a
// person can look and judge. It draws no image, traces no silhouette,
// asks no model, scores nothing and ranks nothing. Every figure is a
// literal entry in labGalleryData.js; this file only lays them out.
//
// Rules this file keeps:
//   - The creature name is researcher metadata. It appears in the
//     surrounding research UI and NEVER on a canvas, never in a
//     candidate, never in a fixture's figure data.
//   - Blind mode hides the name, the candidate id and the point budget
//     so a figure can be judged without suggestion.
//   - Nothing is written until the researcher judges, names or saves.
//   - Play in Ether is present and DISABLED with the reason written
//     beside it: a complete figure has no missing join (Phase 2), and
//     above 8 the production validator refuses it — this tool does not
//     change that.
//   - "Open in Shape Lab" hands the EXACT geometry to the existing
//     editor through a one-shot note; the editor is never duplicated.
(function (global) {
  'use strict';
  var doc = global.document;
  var STORE_KEY = 'vihu.lab.gallery';          // judgements + researcher names
  var HANDOFF_KEY = 'vihu.lab.shape.handoff';  // one-shot, consumed by labShape.js
  var PRODUCTION_BUDGET = 8;
  var VERDICTS = ['unmistakable', 'recognisable', 'looks like a related animal', 'abstract', 'fails'];

  function data() { return global.EtherLabGalleryData || { creatures: [], budgets: [8, 12, 16, 20], candidates: [] }; }
  function slug(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function idOf(c) { return slug(c.creature) + '-' + c.budget + '-' + c.n; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }

  // ---------------------------------------------------------------
  // STATE — the view is in the URL hash so the editor's Back returns
  // to the same place; the judgements are in one storage key.
  // ---------------------------------------------------------------
  var state = { creature: 'butterfly', budget: 'all', view: 'creature', blind: false, judging: {} };

  function readHash() {
    var h = (global.location.hash || '').replace(/^#/, '');
    h.split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] === 'creature') state.creature = decodeURIComponent(p[1] || '') || state.creature;
      if (p[0] === 'budget') state.budget = (p[1] === 'all' || !p[1]) ? 'all' : Number(p[1]);
      if (p[0] === 'view') state.view = p[1] === 'budget' ? 'budget' : 'creature';
      if (p[0] === 'blind') state.blind = p[1] === '1';
    });
  }
  function writeHash() {
    var h = 'creature=' + encodeURIComponent(state.creature) + '&budget=' + state.budget +
            '&view=' + state.view + (state.blind ? '&blind=1' : '');
    try { global.history.replaceState(null, '', '#' + h); } catch (e) {}
  }

  function readStore() {
    try { var raw = global.localStorage.getItem(STORE_KEY); var o = raw ? JSON.parse(raw) : {}; return o && typeof o === 'object' ? o : {}; }
    catch (e) { return {}; }
  }
  function writeStore(o) { try { global.localStorage.setItem(STORE_KEY, JSON.stringify(o)); return true; } catch (e) { return false; } }
  function judgementOf(id) { var s = readStore(); return (s.judgements && s.judgements[id]) || null; }
  function setJudgement(id, patch) {
    var s = readStore(); s.judgements = s.judgements || {};
    var j = s.judgements[id] || {};
    Object.keys(patch).forEach(function (k) { j[k] = patch[k]; });
    j.updatedAt = new Date().toISOString();
    s.judgements[id] = j;
    writeStore(s);
    return j;
  }

  // ---------------------------------------------------------------
  // CANDIDATES — read, never computed. A creature name that matches
  // nothing authored yields an empty list; nothing is invented for it.
  // ---------------------------------------------------------------
  function candidatesFor(creature, budget) {
    var want = slug(creature);
    return data().candidates.filter(function (c) {
      return slug(c.creature) === want && (budget === 'all' || c.budget === budget);
    });
  }
  function figureOf(c) {
    return { points: c.points.map(function (p) { return [p[0], p[1]]; }), joins: c.joins.slice(), gaps: [] };
  }
  // The real validator's verdict on this geometry, asked exactly as the
  // Shape Lab asks it: as a Lab candidate with ONE join marked missing
  // (a complete figure is not a mystery, so the question has to be
  // "would this be playable once a gap is chosen"). The answer is a fact
  // about production, reported as such; nothing here changes it.
  function validatorVerdict(c) {
    var G = global.EtherGrammar, Kit = global.EtherMysteryLabKit;
    if (!G || !G.validate || !Kit || !Kit.creatureCandidate) return { ok: false, reasons: ['no-validator'] };
    var fig = figureOf(c); fig.gaps = [0];
    var v = G.validate(Kit.creatureCandidate({ id: 'lab-gallery-probe', nodes: fig.points.length, title: 'probe', figure: fig }));
    return { ok: !!v.ok, reasons: v.reasons || [] };
  }

  // ---------------------------------------------------------------
  // DRAWING — the Shape Lab's own draw(), complete state, no numbers,
  // no text. There is deliberately no second renderer here.
  // ---------------------------------------------------------------
  function drawCard(canvas, c) {
    var S = global.ShapeLab;
    if (!S || !S.draw) return;
    var s = { budget: c.budget, points: c.points, joins: c.joins.map(function (j) {
      var ab = String(j).split('-').map(Number); return { a: ab[0], b: ab[1], gap: false };
    }) };
    S.draw(canvas, s, {});
  }

  // ---------------------------------------------------------------
  // HAND-OFF to the editor: the exact geometry, once, and the name as
  // metadata beside it. labShape.js consumes and deletes the note.
  // ---------------------------------------------------------------
  function openInShapeLab(c) {
    var note = {
      budget: c ? c.budget : (state.budget === 'all' ? PRODUCTION_BUDGET : state.budget),
      points: c ? c.points.map(function (p) { return [p[0], p[1]]; }) : [],
      joins: c ? c.joins.slice() : [],
      missing: [],
      name: c ? c.creature : state.creature,
      hint: '',
      notes: c ? ('From the Candidate Gallery — ' + idOf(c)) : ''
    };
    try { global.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(note)); } catch (e) { return { ok: false, reason: 'no-storage' }; }
    global.location.href = 'shape.html';
    return { ok: true };
  }

  // Save as a Shape Lab fixture: through the editor's own store, so
  // there is exactly one fixture implementation.
  function saveAsFixture(c) {
    var S = global.ShapeLab;
    if (!S || !S.importJSON) return { ok: false, reason: 'no-shape-lab' };
    var j = judgementOf(idOf(c)) || {};
    var rec = {
      name: c.creature, budget: c.budget,
      points: c.points.map(function (p) { return [p[0], p[1]]; }),
      joins: c.joins.slice(), missing: [], hint: '',
      notes: 'From the Candidate Gallery — ' + idOf(c) + (j.researcher ? ' · ' + j.researcher : ''),
      judgement: (j.verdict || j.see) ? { complete: j.verdict || '', see: j.see || '' } : null,
      tease: false
    };
    var r = S.importJSON(JSON.stringify([rec]));
    return { ok: !!(r && r.ok && r.added === 1), reason: r && r.reason };
  }

  // ---------------------------------------------------------------
  // THE PAGE
  // ---------------------------------------------------------------
  function el(sel) { return doc.querySelector(sel); }
  function say(msg) { var n = el('[data-gsay]'); if (!n) return; n.textContent = msg || ''; n.hidden = !msg; }

  function cardHtml(c) {
    var id = idOf(c), j = judgementOf(id) || {}, v = validatorVerdict(c);
    var blind = state.blind;
    var why = c.budget > PRODUCTION_BUDGET
      ? 'Play in Ether unavailable: the production validator refuses ' + c.budget + ' lights (' + v.reasons.join(', ') + '). The limit is ' + PRODUCTION_BUDGET + ' and this tool does not change it.'
      : 'Play in Ether unavailable here: this is the COMPLETE figure — no join is missing. Open it in the Shape Lab and mark a gap to make it a mystery (Phase 2).' + (v.ok ? ' The production validator passes it once a gap is chosen.' : ' Validator: ' + v.reasons.join(', ') + '.');
    return '<div class="gcard' + (blind ? ' blind' : '') + '" data-card="' + esc(id) + '">' +
      '<canvas class="gfig" data-gfig="' + esc(id) + '"></canvas>' +
      '<div class="gmeta">' +
        (blind ? '<span class="gdim">judge the figure — details hidden</span>'
               : '<span class="gid">' + esc(c.budget) + ' points · candidate ' + c.n + '</span>' +
                 '<span class="gdim">' + c.points.length + ' points · ' + c.joins.length + ' joins · <code>' + esc(id) + '</code></span>') +
        '<input type="text" class="gname" data-gresearcher="' + esc(id) + '" placeholder="researcher name (optional)" value="' + esc(j.researcher || '') + '" autocomplete="off">' +
      '</div>' +
      '<div class="gjudge" data-gjudge="' + esc(id) + '"' + (state.judging[id] ? '' : ' hidden') + '>' +
        VERDICTS.map(function (o) {
          return '<label><input type="radio" name="v-' + esc(id) + '" value="' + esc(o) + '"' + (j.verdict === o ? ' checked' : '') + '> ' + esc(o.toUpperCase()) + '</label>';
        }).join('') +
        '<label class="gsee">What do I see?<textarea data-gsee="' + esc(id) + '">' + esc(j.see || '') + '</textarea></label>' +
      '</div>' +
      (j.verdict && !state.judging[id] ? '<div class="gverdict">' + esc(j.verdict.toUpperCase()) + '</div>' : '') +
      '<div class="gactions">' +
        '<button data-gopen="' + esc(id) + '">Open in Shape Lab</button>' +
        '<button data-gjudgebtn="' + esc(id) + '"' + (state.judging[id] ? ' class="on"' : '') + '>Judge</button>' +
        '<button data-gsave="' + esc(id) + '">Save as Fixture</button>' +
        '<button disabled title="' + esc(why) + '">▶ Play in Ether</button>' +
      '</div>' +
      '<div class="gwhy">' + esc(why) + '</div>' +
    '</div>';
  }

  function renderChips() {
    var box = el('[data-gcreatures]'); if (!box) return;
    box.innerHTML = data().creatures.map(function (n) {
      return '<button data-gcreature="' + esc(n) + '"' + (slug(n) === slug(state.creature) ? ' class="on"' : '') + '>' + esc(n) + '</button>';
    }).join('');
    box.querySelectorAll('[data-gcreature]').forEach(function (b) {
      b.addEventListener('click', function () { state.creature = b.getAttribute('data-gcreature'); state.view = 'creature'; render(); });
    });
    var inp = el('[data-gcreature-input]'); if (inp && inp.value !== state.creature) inp.value = state.creature;
  }

  function renderGrid() {
    var box = el('[data-ggrid]'); if (!box) return;
    var budgets = data().budgets;
    var html = '';
    if (state.view === 'creature') {
      var cols = state.budget === 'all' ? budgets : [state.budget];
      var lists = cols.map(function (b) { return candidatesFor(state.creature, b); });
      var rows = Math.max.apply(null, lists.map(function (l) { return l.length; }).concat([0]));
      if (!rows) {
        html = '<div class="gempty"><p>No authored candidates for <b>' + esc(state.creature) + '</b>' +
          (state.budget === 'all' ? '' : ' at ' + state.budget + ' points') + ' yet.</p>' +
          '<p class="note">The ten starting creatures are only a starting set. Draw this one yourself:</p>' +
          '<button data-gdraw class="primary">✏️ Draw “' + esc(state.creature) + '” in the Shape Lab</button></div>';
      } else {
        var headFor = function (b) { return state.blind ? '&nbsp;' : b + ' POINTS' + (b === PRODUCTION_BUDGET ? ' · production' : ' · research'); };
        if (cols.length === 1) {
          // ONE budget: its several candidates side by side in one row.
          html = '<div class="ghead' + (state.blind ? ' blind' : '') + '" style="grid-template-columns:1fr"><div>' + headFor(cols[0]) + '</div></div>' +
            '<div class="grow" style="grid-template-columns:repeat(' + lists[0].length + ',minmax(0,1fr))">' +
            lists[0].map(cardHtml).join('') + '</div>';
        } else {
          // FOUR budgets: columns per budget, so a row reads 8 → 12 → 16 → 20.
          html = '<div class="ghead' + (state.blind ? ' blind' : '') + '">' + cols.map(function (b) { return '<div>' + headFor(b) + '</div>'; }).join('') + '</div>';
          for (var r = 0; r < rows; r++) {
            html += '<div class="grow" style="grid-template-columns:repeat(' + cols.length + ',minmax(0,1fr))">';
            for (var k = 0; k < cols.length; k++) {
              var c = lists[k][r];
              html += c ? cardHtml(c) : '<div class="gcard gnone"></div>';
            }
            html += '</div>';
          }
        }
      }
    } else {
      var b = state.budget === 'all' ? PRODUCTION_BUDGET : state.budget;
      var names = data().creatures.slice();
      if (names.map(slug).indexOf(slug(state.creature)) === -1 && candidatesFor(state.creature, b).length) names.push(state.creature);
      html = names.map(function (n) {
        var list = candidatesFor(n, b);
        if (!list.length) return '';
        return '<div class="gcreature-row"><div class="gcreature-name">' + (state.blind ? '&nbsp;' : esc(n)) + '</div>' +
          '<div class="grow" style="grid-template-columns:repeat(' + list.length + ',minmax(0,1fr))">' +
          list.map(cardHtml).join('') + '</div></div>';
      }).join('');
      if (!html) html = '<div class="gempty"><p>Nothing authored at ' + b + ' points.</p></div>';
    }
    box.innerHTML = html;

    // draw every figure through the Shape Lab's own renderer
    var byId = {};
    data().candidates.forEach(function (c) { byId[idOf(c)] = c; });
    box.querySelectorAll('canvas[data-gfig]').forEach(function (cv) {
      var c = byId[cv.getAttribute('data-gfig')];
      if (c) drawCard(cv, c);
    });
    // wire the cards
    box.querySelectorAll('[data-gopen]').forEach(function (b) {
      b.addEventListener('click', function () { openInShapeLab(byId[b.getAttribute('data-gopen')]); });
    });
    box.querySelectorAll('[data-gdraw]').forEach(function (b) {
      b.addEventListener('click', function () { openInShapeLab(null); });
    });
    box.querySelectorAll('[data-gjudgebtn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-gjudgebtn');
        state.judging[id] = !state.judging[id];
        render();
      });
    });
    box.querySelectorAll('[data-gsave]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-gsave');
        var r = saveAsFixture(byId[id]);
        say(r.ok ? 'Saved ' + id + ' as a Shape Lab fixture — open the Shape Lab to see it under its creature name.' : 'Not saved: ' + (r.reason || 'unknown') + '.');
      });
    });
    box.querySelectorAll('input[type=radio]').forEach(function (r) {
      r.addEventListener('change', function () {
        var id = r.name.replace(/^v-/, '');
        setJudgement(id, { verdict: r.value });
      });
    });
    box.querySelectorAll('[data-gsee]').forEach(function (t) {
      t.addEventListener('input', function () { setJudgement(t.getAttribute('data-gsee'), { see: t.value }); });
    });
    box.querySelectorAll('[data-gresearcher]').forEach(function (t) {
      t.addEventListener('input', function () { setJudgement(t.getAttribute('data-gresearcher'), { researcher: t.value }); });
    });
  }

  function render() {
    writeHash();
    renderChips();
    doc.querySelectorAll('[data-gbudget]').forEach(function (b) {
      var v = b.getAttribute('data-gbudget');
      b.classList.toggle('on', String(state.budget) === v);
    });
    doc.querySelectorAll('[data-gview]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-gview') === state.view);
    });
    var bl = el('[data-gblind]'); if (bl) bl.checked = state.blind;
    var t = el('[data-gtitle]');
    if (t) t.textContent = state.view === 'creature'
      ? (state.blind ? 'BLIND — ' : '') + String(state.creature).toUpperCase() + (state.budget === 'all' ? ' · 8 / 12 / 16 / 20' : ' · ' + state.budget + ' POINTS')
      : (state.blind ? 'BLIND — ' : '') + 'ALL CREATURES · ' + (state.budget === 'all' ? PRODUCTION_BUDGET : state.budget) + ' POINTS';
    renderGrid();
  }

  function wire() {
    readHash();
    var inp = el('[data-gcreature-input]');
    if (inp) {
      inp.addEventListener('change', function () { if (inp.value.trim()) { state.creature = inp.value.trim(); state.view = 'creature'; render(); } });
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    }
    doc.querySelectorAll('[data-gbudget]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-gbudget');
        state.budget = v === 'all' ? 'all' : Number(v);
        render();
      });
    });
    doc.querySelectorAll('[data-gview]').forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.getAttribute('data-gview'); render(); });
    });
    var bl = el('[data-gblind]');
    if (bl) bl.addEventListener('change', function () { state.blind = bl.checked; render(); });
    var ex = el('[data-gexport]');
    if (ex) ex.addEventListener('click', function () {
      var out = el('[data-gexport-out]');
      if (out) { out.value = JSON.stringify({ kind: 'vihu-shape-gallery-judgements', exportedAt: new Date().toISOString(), judgements: readStore().judgements || {} }, null, 2); out.hidden = false; out.select(); }
    });
    // The view lives in the hash, so the back button and a typed hash
    // both land on the same place.
    global.addEventListener('hashchange', function () { readHash(); render(); });
    global.addEventListener('resize', function () {
      doc.querySelectorAll('canvas[data-gfig]').forEach(function (cv) {
        var id = cv.getAttribute('data-gfig');
        var c = data().candidates.filter(function (x) { return idOf(x) === id; })[0];
        if (c) drawCard(cv, c);
      });
    });
    render();
  }

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', wire);
    else wire();
  }

  global.CreatureGallery = {
    STORE_KEY: STORE_KEY,
    HANDOFF_KEY: HANDOFF_KEY,
    PRODUCTION_BUDGET: PRODUCTION_BUDGET,
    VERDICTS: VERDICTS.slice(),
    idOf: idOf,
    candidatesFor: candidatesFor,
    figureOf: figureOf,
    validatorVerdict: validatorVerdict,
    judgementOf: judgementOf,
    setJudgement: setJudgement,
    saveAsFixture: saveAsFixture,
    handoffNote: function (c) {
      return {
        budget: c.budget,
        points: c.points.map(function (p) { return [p[0], p[1]]; }),
        joins: c.joins.slice(),
        missing: [],
        name: c.creature,        // metadata, beside the figure — never inside it
        hint: '',
        notes: 'From the Candidate Gallery — ' + idOf(c)
      };
    },
    state: function () { return { creature: state.creature, budget: state.budget, view: state.view, blind: state.blind }; },
    set: function (patch) { Object.keys(patch || {}).forEach(function (k) { state[k] = patch[k]; }); render(); },
    render: render
  };
})(typeof window !== 'undefined' ? window : this);
