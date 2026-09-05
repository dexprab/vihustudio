// tools/ether-mystery-lab/labUi.js — the Lab page's wiring.
//
// SPRINT — Ether Mystery Lab (Decision 58). Pixels and presses only:
// every rule lives in labKit.js / labConnection.js / the 0766 modules,
// and this file decides nothing about privacy, validity or quality.
//
// LOADING THE PAGE DOES NOTHING BUT DRAW IT. The only requests made at
// load are two same-origin STATIC TEXT fetches (js/magicCard.js and
// js/etherLife.js, read as text so the Lab can project the project's
// own constellation and creature vocabulary without executing either
// file — executing magicCard.js would touch device state, which a Lab
// load must never do). No LLM call, no POST, no Ether initialization,
// no Composer, no Traveller state, no storage writes.

(function () {
  'use strict';

  var Kit = window.EtherMysteryLabKit;
  var Conn = window.LabConnection;
  var Grammar = window.EtherGrammar;
  var Support = window.LabPreviewSupport;
  var Research = window.LabResearch;
  var PreviewHost = window.LabPreviewHost;

  // What the preview demonstrated, per candidate. Page memory only:
  // it is never written into the session, never exported, and goes
  // when the tab does.
  var demonstrated = {};
  // The preview seed. One per Lab session so a reviewer replaying the
  // same candidate gets the same sky, and different candidates do not
  // all land in identical places.
  var previewSeed = 'lab-' + Date.now();

  var $ = function (id) { return document.getElementById(id); };

  // ---------------- session state (page memory only) ----------------
  var session = Kit.createSession({ pool: window.EtherExperiencePool });
  var figures = [];          // loaded constellation projections
  var creatures = [];        // extracted {id, response}
  var pastedEntity = null;
  var armedPreset = null;
  var lastDiagnostic = null;
  var genSeq = 0;   // a cancelled generation's late resolution is ignored

  // The fixture creation corpus — already in the Lens's own output
  // shape, labelled for what it is.
  var FIXTURE_CREATIONS = [
    { label: 'a five-page story with a cover (fixture)', structure: { kind: 'story', pages: 5, hasCover: true } },
    { label: 'a one-page moment with a cover (fixture)', structure: { kind: 'story', pages: 1, hasCover: true } },
    { label: 'a twelve-page long story with a cover (fixture)', structure: { kind: 'story', pages: 12, hasCover: true } }
  ];

  // Named from the shipped Ether behaviours (Decision 58's own
  // clauses) — descriptive vocabulary, not new capability.
  var PHENOMENA = [
    'a ripple answering a touch',
    'a beckon at the edge of the view',
    'a wonder blooming where a trail ends',
    'a trail of guide-motes',
    'a residue mark left behind',
    'the arrival turn of the whole sky'
  ];

  // ---------------- connection panel ----------------
  function paintStatus() {
    var s = Conn.status();
    var el = $('labStatus');
    el.textContent = s.line;
    el.className = s.line.indexOf('FIXTURE') === 0 ? 'fixture'
      : s.line.indexOf('LLM CONNECTED') === 0 ? 'connected' : 'unavailable';
  }

  function wireConnection() {
    $('modeFixture').addEventListener('change', function () { Conn.setMode('fixture'); syncModeFields(); });
    $('modeEndpoint').addEventListener('change', function () { Conn.setMode('endpoint'); syncModeFields(); });
    $('modeDirect').addEventListener('change', function () { Conn.setMode('direct'); syncModeFields(); });
    $('endpointUrl').addEventListener('input', function () {
      Conn.setEndpoint($('endpointUrl').value, $('endpointToken').value); paintStatus();
    });
    $('endpointToken').addEventListener('input', function () {
      Conn.setEndpoint($('endpointUrl').value, $('endpointToken').value); paintStatus();
    });
    $('directKey').addEventListener('input', function () {
      // Memory only — LabConnection holds it in a closure. Nothing
      // here or there ever writes it to storage or into an export.
      Conn.setDirectKey($('directKey').value); paintStatus();
    });
    $('directModel').addEventListener('input', function () { Conn.setDirectModel($('directModel').value); });
    $('testBtn').addEventListener('click', function () {
      $('testBtn').disabled = true;
      Conn.probe().then(function () { $('testBtn').disabled = false; paintStatus(); });
    });
    $('disconnectBtn').addEventListener('click', function () {
      Conn.disconnect();
      $('directKey').value = '';
      $('endpointToken').value = '';
      $('endpointUrl').value = '';
      $('modeFixture').checked = true;
      syncModeFields();
    });
    syncModeFields();
  }

  function syncModeFields() {
    var m = Conn.status().mode;
    $('endpointFields').hidden = m !== 'endpoint';
    $('directFields').hidden = m !== 'direct';
    paintStatus();
  }

  // ---------------- ingredients ----------------
  function chip(container, label, value, extraClass) {
    var l = document.createElement('label');
    if (extraClass) l.className = extraClass;
    var c = document.createElement('input');
    c.type = 'checkbox'; c.value = value;
    c.addEventListener('change', function () { l.classList.toggle('on', c.checked); });
    l.appendChild(c);
    l.appendChild(document.createTextNode(label));
    container.appendChild(l);
    return c;
  }

  function selectedValues(containerId) {
    return Array.prototype.slice.call(
      document.querySelectorAll('#' + containerId + ' input:checked')
    ).map(function (c) { return c.value; });
  }

  function wireIngredients() {
    var sel = $('creationSelect');
    var none = document.createElement('option');
    none.value = ''; none.textContent = '(no creation)';
    sel.appendChild(none);
    FIXTURE_CREATIONS.forEach(function (f, i) {
      var o = document.createElement('option');
      o.value = 'fixture-' + i; o.textContent = f.label;
      sel.appendChild(o);
    });

    $('creationPasteBtn').addEventListener('click', function () {
      var raw = $('creationPaste').value.trim();
      if (!raw) { pastedEntity = null; $('pasteState').textContent = ''; return; }
      try {
        pastedEntity = JSON.parse(raw);
        $('pasteState').textContent = 'entity accepted — it will pass through the Creation Lens (and the Stars boundary) at build time';
      } catch (e) {
        pastedEntity = null;
        $('pasteState').textContent = 'not valid JSON';
      }
    });

    // The project's REAL constellation families, extracted from
    // js/magicCard.js's own source — never a fake list, never cells.
    window.LabConstellations.load().then(function (res) {
      figures = res.families;
      $('figureCount').textContent = res.ok
        ? (res.sourceCount + ' families exist in this project — the brief\'s "88" does not; see the report')
        : 'unavailable — nothing invented in its place';
      res.families.forEach(function (f) {
        chip($('figureChips'), f.name + ' · ' + f.starCount + '★ · ' + f.looksLike, f.figure);
      });
    });

    // The creature vocabulary, from js/etherLife.js's own registry —
    // extracted as text, never executed (executing it is mounting the
    // Ether, which a Lab load must never do).
    fetch('../../js/etherLife.js').then(function (r) { return r.ok ? r.text() : null; })
      .catch(function () { return null; })
      .then(function (src) {
        if (!src) { $('creatureChips').textContent = 'unavailable — nothing invented in its place'; return; }
        var block = src.split('var CREATURES')[1] || '';
        block = block.split('var WONDERS')[0] || '';
        var re = /id:\s*'([a-z-]+)'[\s\S]*?response:\s*'([a-z-]+)'/g;
        var m;
        creatures = [];
        while ((m = re.exec(block))) creatures.push({ id: m[1], response: m[2] });
        creatures.forEach(function (c) {
          chip($('creatureChips'), c.id + ' (' + c.response + ')', c.id);
        });
      });

    PHENOMENA.forEach(function (p) { chip($('phenomenaChips'), p, p); });
  }

  // ---------------- generation ----------------
  function wireGeneration() {
    var gsel = $('grammarSelect');
    var opt = document.createElement('option');
    opt.value = 'compose'; opt.textContent = 'Composer choose (the model varies them)';
    gsel.appendChild(opt);
    Object.keys(Grammar.GRAMMARS).forEach(function (g) {
      var o = document.createElement('option');
      o.value = g; o.textContent = g.toUpperCase() + ' — ' + Grammar.GRAMMARS[g].poses;
      gsel.appendChild(o);
    });

    Object.keys(Kit.EXPERIMENTS).forEach(function (id) {
      var e = Kit.EXPERIMENTS[id];
      var b = document.createElement('button');
      b.className = 'lab-preset';
      b.setAttribute('data-preset', id);
      b.textContent = e.title;
      b.title = e.brief;
      b.addEventListener('click', function () { armPreset(id); });
      $('presetRow').appendChild(b);
    });

    $('generateBtn').addEventListener('click', generateNow);
    $('cancelBtn').addEventListener('click', function () {
      genSeq++;          // whatever resolves late belongs to nobody now
      Conn.cancel();
      $('genState').textContent = 'cancelled';
      $('cancelBtn').disabled = true;
      $('generateBtn').disabled = false;
    });
    $('exportBtn').addEventListener('click', exportNow);
    $('researchBtn').addEventListener('click', exportResearchNow);
  }

  function armPreset(id) {
    armedPreset = (armedPreset === id) ? null : id;
    var e = armedPreset ? Kit.EXPERIMENTS[armedPreset] : null;
    document.querySelectorAll('.lab-preset').forEach(function (b) {
      b.style.borderColor = b.getAttribute('data-preset') === armedPreset ? 'var(--gold)' : '';
    });
    $('presetNote').textContent = e
      ? (e.title + ': ' + e.brief + (e.needsCreation ? ' (needs a creation selected)' : ''))
      : '';
    if (e && e.count) $('countSelect').value = String(e.count);
    // A preset may name its own grammar and complexity — Phase 6's
    // runs are defined by their exact parameters, so arming one has to
    // set them rather than leaving a reviewer to match them by hand.
    if (e && e.complexity) $('complexitySelect').value = e.complexity;
    if (e && e.grammar && !e.grammars) $('grammarSelect').value = e.grammar;
  }

  function gatherBuildOpts(refine) {
    var preset = armedPreset ? Kit.EXPERIMENTS[armedPreset] : null;
    var structures = [];
    var entities = [];
    var cv = $('creationSelect').value;
    if (cv && cv.indexOf('fixture-') === 0) {
      structures.push(FIXTURE_CREATIONS[Number(cv.slice(8))].structure);
    }
    if (pastedEntity) entities.push(pastedEntity);

    var chosenFigureIds = selectedValues('figureChips');
    var chosen = figures.filter(function (f) { return chosenFigureIds.indexOf(f.figure) !== -1; });
    if (preset && preset.constellations === 'all' && !chosen.length) chosen = figures;
    else if (preset && Array.isArray(preset.constellations) && !chosen.length) {
      chosen = figures.filter(function (f) {
        return preset.constellations.indexOf(f.figure) !== -1;
      });
    }

    var chosenCreatures = creatures.filter(function (c) {
      return selectedValues('creatureChips').indexOf(c.id) !== -1;
    });

    return {
      entities: entities,
      structures: structures,
      constellations: chosen,
      creatures: chosenCreatures,
      phenomena: selectedValues('phenomenaChips'),
      grammar: (preset && preset.grammars) ? 'compose' : $('grammarSelect').value,
      grammars: preset && preset.grammars,
      count: Number($('countSelect').value),
      complexity: $('complexitySelect').value,
      emphasis: preset ? preset.emphasis : '',
      refine: refine || null,
      pool: window.EtherExperiencePool
    };
  }

  // refine: { original, intent, refusedBecause, ofLabId } — §6. It goes
  // through the SAME buildInput → connection → parse → validate path a
  // plain generation takes; nothing about a refinement is a second
  // pipeline, and the result is a NEW candidate linked to the original.
  function generateNow(refine) {
    var opts = gatherBuildOpts(refine);
    var built = Kit.buildInput(opts);
    if (!built.ok) {
      // REFUSED WHOLE, and the diagnostic says why. Nothing was sent.
      $('diagnostic').textContent = 'REFUSED — nothing was sent to any generator.\n\n' +
        built.reasons.join('\n');
      lastDiagnostic = null;
      return;
    }
    lastDiagnostic = built.diagnostic;
    $('diagnostic').textContent = built.diagnostic;

    $('generateBtn').disabled = true;
    $('cancelBtn').disabled = false;
    $('genState').textContent = 'generating… (' + Conn.status().line + ')';

    var params = {
      count: opts.count,
      grammar: opts.grammar,
      grammars: opts.grammars,
      complexity: opts.complexity,
      experiment: armedPreset || null
    };

    var mySeq = ++genSeq;
    Conn.generate({ messages: built.messages, params: params }).then(function (res) {
      if (mySeq !== genSeq) return;   // cancelled — the developer said so
      $('generateBtn').disabled = false;
      $('cancelBtn').disabled = true;
      if (!res.ok) {
        // A failed real generation FAILS — it never quietly becomes a
        // fixture batch (§21).
        $('genState').textContent = 'failed: ' + (res.reason || 'unavailable') +
          ' — nothing substituted; switch to Fixture mode yourself if you want fixtures';
        return;
      }
      var parsed = Kit.parseCandidates(res.text);
      if (!parsed.ok) {
        $('genState').textContent = 'rejected: ' + parsed.reason + ' (malformed output is refused, not repaired)';
        return;
      }
      parsed.candidates.forEach(function (c) {
        var item = session.add(c, {
          source: res.source, model: res.model,
          params: params, generatedAt: new Date().toISOString(),
          refinementOf: refine ? refine.ofLabId : null,
          refinementBrief: refine ? {
            intent: refine.intent, refusedBecause: refine.refusedBecause
          } : null
        });
        session.validate(item);
        session.quality(item);
        session.study(item);
      });
      $('genState').textContent = 'received ' + parsed.candidates.length + ' candidate(s)' +
        (parsed.dropped ? ' (' + parsed.dropped + ' malformed dropped)' : '') +
        ' — source: ' + res.source;
      renderCandidates();
      renderStats();
    });
  }

  // ---------------- candidate review (§12) ----------------
  function facet(label, text) {
    return '<div class="facet"><b>' + label + '</b>' + esc(text) + '</div>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function describe(c) {
    var g = Grammar.GRAMMARS[c.grammar];
    var eng = (c.engage || []).map(function (e) {
      return e.action + (e.on ? ' the ' + e.on : '') + (e.seconds ? ' (~' + e.seconds + 's, gently)' : '');
    }).join(' · ');
    var out = c.outcome || {};
    var poss = (out.possible || []).join(' / ');
    return {
      mystery: (c.title || '(untitled)') + (g ? ' — ' + g.poses : ''),
      challenge: eng && (c.engage || []).some(function (e) { return e.action !== 'wait'; })
        ? eng : '(none — observation only)',
      action: eng || '(none)',
      discovery: out.discovery ? out.discovery + ' (possible: ' + poss + ')' : '(possible: ' + poss + ')',
      next: out.residue ? 'residue: a ' + out.residue.show + ' remains (' + (out.residue.when || 'either') + ')' : '(none)'
    };
  }

  function renderCandidates() {
    var host = $('candidates');
    host.innerHTML = '';
    var items = session.items();
    if (!items.length) { host.innerHTML = '<p class="note">No candidates yet.</p>'; return; }

    var rr = Kit.reskinReport(items.map(function (i) { return i.candidate; }));
    $('reskinReport').textContent = rr.materiallyDifferent
      ? 'Batch distinctness: ' + rr.distinct + '/' + rr.of + ' — materially different.'
      : 'Batch distinctness: ' + rr.distinct + '/' + rr.of + ' — RESKINS PRESENT (' +
        rr.reskinGroups.map(function (g) { return g.ids.join(' = '); }).join('; ') +
        ') — a generator quality problem, record it.';

    items.forEach(function (item) {
      var c = item.candidate;
      var d = describe(c);
      var card = document.createElement('div');
      card.className = 'cand';
      card.setAttribute('data-lab-id', item.labId);
      card.setAttribute('data-state', item.state);

      var badges = '<span class="badge ' + (item.validation && item.validation.ok ? 'valid">VALID' : 'invalid">INVALID') + '</span>' +
        '<span class="badge ' + esc(item.lab.source) + '">' + esc(item.lab.source.toUpperCase()) + '</span>' +
        (item.state === 'approved' ? '<span class="badge approved">APPROVED</span>' : '') +
        '<span class="note">' + esc(item.state) + '</span>';

      var qual = '';
      if (item.quality) {
        qual = '<div class="qgrid">' + Object.keys(item.quality.scores).map(function (k) {
          var s = item.quality.scores[k];
          return '<span>' + esc(k) + '<span class="qbar"><i style="width:' + (s.score / 3 * 100) + '%"></i></span></span>';
        }).join('') + '</div><div class="hint">heuristic screening ' +
          item.quality.total + '/' + item.quality.outOf + ' — never a judgement, never a gate</div>';
      }

      var invalidNote = (item.validation && !item.validation.ok)
        ? '<div class="facet"><b>refused</b>' + esc(item.validation.reasons.join(' · ')) + '</div>' : '';

      // §1/§5/§7 — INVALID DOES NOT MEAN INVISIBLE. A refused candidate
      // keeps its card, and gains a research view a person can read
      // without knowing a schema: what the model was trying to make,
      // why it is not production-ready, and whether the Ether can show
      // the idea at all. The technical reasons stay, folded away below.
      var study = item.research || session.study(item);
      var research = '';
      if (study && !study.valid) {
        var repaired = !!(study.projection && study.projection.applied.length);
        var can = study['case'] === 'try-idea'
          ? (repaired
              ? 'Yes — as an experiment. Some of how it was written had to be ' +
                'repaired first, and it is not production-valid.'
              : 'Yes — as an experiment, exactly as it was written. It is ' +
                'still not production-valid.')
          : study['case'] === 'unsupported'
            ? 'No — it needs something the Ether does not have yet.'
            : 'No — there is not enough here to show honestly.';
        research =
          '<div class="research">' +
          '<div class="research-title">🧪 RESEARCH IDEA</div>' +
          facet('what the model was trying to do',
            (study.intent && study.intent.sentence) ||
            'Nothing in this record says what it was for.') +
          facet('why it is not production-ready', study.plainReasons.join('; and ')) +
          facet('can the Ether show this?', can +
            (study.missing && study.missing.length
              ? ' (' + study.missing.join('; and ') + ')' : '')) +
          ((study.projection && study.projection.applied.length)
            ? facet('what was repaired for the experiment',
                study.projection.applied.map(function (a) { return a.plain; }).join('; and '))
            : '') +
          ((study.projection && study.projection.waived.length)
            ? facet('stood over for research',
                'The Ether would refuse this in production for a design ' +
                'reason rather than because it cannot draw it, so the ' +
                'experiment shows the idea as written.')
            : '') +
          '</div>';
      }
      var lineage = (item.lab && item.lab.refinementOf)
        ? '<div class="lineage">Refinement of ' + esc(item.lab.refinementOf) + '</div>' : '';

      // THE CREATIVE SURFACE COMES FIRST. A reviewer judging whether a
      // Mystery is any good should not have to read a schema to do it,
      // so the card leads with plain language and the way into the
      // Ether, and every technical facet is folded away underneath.
      var plain = Support ? Support.plain(c) : null;
      var sup = (Support && item.validation && item.validation.ok)
        ? Support.support(c) : null;

      card.innerHTML =
        '<h3>MYSTERY <span class="note">· ' + esc(c.id || '(no id)') + ' · ' +
        esc(item.labId) + '</span></h3>' +
        '<div class="meta">' + badges + '</div>' +
        lineage +
        (plain ? '<div class="plain">' + esc(plain.mystery) + '</div>' : '') +
        research +
        '<div class="play-row"></div>' +
        '<div class="demo"></div>' +
        '<div class="review"></div>' +
        '<details class="tech"><summary>technical details</summary>' +
        facet('grammar', (c.grammar || '?') + ' · ' + (c.complexity || '')) +
        facet('challenge', d.challenge) +
        facet('child action', d.action) +
        facet('discovery', d.discovery) +
        facet('next mystery', d.next) +
        facet('ingredients', JSON.stringify(c.ingredients || {})) +
        invalidNote + qual +
        '<pre>' + esc(JSON.stringify(c, null, 2)) + '</pre></details>';

      card.querySelector('.play-row').appendChild(playControl(item, sup, study));
      card.querySelector('.review').appendChild(reviewControls(item, sup, study));
      renderDemonstration(card, item);
      host.appendChild(card);
    });
  }

  // ▶ PLAY IN ETHER · 🧪 TRY IDEA · ⚠ Cannot preview this idea yet.
  //
  // THREE DIFFERENT ANSWERS, NEVER ONE WEARING THREE NAMES. A valid,
  // performable candidate gets PLAY IN ETHER and is the sky exactly as
  // it would be. An INVALID one whose idea the existing Ether can still
  // show gets TRY IDEA — visibly and semantically a different thing,
  // never called Play. Everything else says so plainly, and a
  // capability that does not exist is never faked to make a card
  // playable.
  function playControl(item, sup, study) {
    var wrap = document.createElement('div');
    if (!PreviewHost || !Support) {
      wrap.innerHTML = '<span class="note">Preview unavailable — the preview is not loaded.</span>';
      return wrap;
    }

    // ---- valid ----
    if (item.validation && item.validation.ok) {
      if (sup && !sup.ok) {
        wrap.innerHTML = '<span class="unavail">Preview unavailable — unsupported runtime capability</span>' +
          '<div class="hint">' + esc(Support.whyUnavailable(sup.reasons).join('; and ')) + '</div>';
        wrap.setAttribute('data-preview', 'unavailable');
        return wrap;
      }
      wrap.appendChild(previewButton(item, item.candidate, 'play',
        '▶ PLAY IN ETHER', 'primary play'));
      if (sup && sup.notes.length) {
        var n = document.createElement('div');
        n.className = 'hint';
        n.textContent = sup.notes.join(' ');
        wrap.appendChild(n);
      }
      return wrap;
    }

    // ---- invalid ----
    if (!study) {
      wrap.innerHTML = '<span class="unavail">Preview unavailable — the sky refuses this one at the door.</span>';
      wrap.setAttribute('data-preview', 'unavailable');
      return wrap;
    }
    if (study['case'] === 'try-idea' && study.previewCandidate) {
      wrap.appendChild(previewButton(item, study.previewCandidate, 'try',
        // The label says RESEARCH ONLY on its face. A research preview
        // must always be visibly labelled as one — it can never enter
        // production approval, never export to the pool, never touch
        // the production Ether and never be represented as a valid
        // candidate, and the button is the first place that is said.
        '🧪 TRY IDEA — RESEARCH ONLY', 'try'));
      var t = document.createElement('div');
      t.className = 'hint';
      t.textContent = 'Not production-valid. This shows whether the idea ' +
        'underneath it can be experienced in the Ether as it exists today.';
      wrap.appendChild(t);
      wrap.setAttribute('data-preview', 'try-idea');
      return wrap;
    }
    var why = (study.missing && study.missing.length)
      ? study.missing.join('; and ')
      : study.plainReasons.join('; and ');
    if (study['case'] === 'unsupported') {
      wrap.innerHTML = '<span class="unavail">⚠ Cannot preview this idea yet</span>' +
        '<div class="hint">This idea needs a capability Ether does not currently have: ' +
        esc(why) + '.</div>';
      wrap.setAttribute('data-preview', 'unsupported');
      return wrap;
    }
    wrap.innerHTML = '<span class="unavail">⚠ Cannot preview this idea yet</span>' +
      '<div class="hint">There is not enough here to show honestly: ' + esc(why) + '.</div>';
    wrap.setAttribute('data-preview', 'uninterpretable');
    return wrap;
  }

  // The preview opens in a TAB OF ITS OWN — the sky and nothing else,
  // on whichever screen the reviewer wants it, with the Lab left
  // exactly where it was so the review does not lose its place. The
  // press is what opens it, synchronously, or no browser would allow
  // it at all; a browser that refuses anyway is answered with a plain
  // sentence rather than with a preview that silently did not happen.
  function previewButton(item, candidate, mode, label, cls) {
    var b = document.createElement('button');
    b.className = cls;
    b.textContent = label;
    b.setAttribute(mode === 'try' ? 'data-try' : 'data-play', item.labId);
    b.addEventListener('click', function () {
      var blocked = b.parentNode && b.parentNode.querySelector('[data-popup-blocked]');
      if (blocked) blocked.parentNode.removeChild(blocked);
      var opened = PreviewHost.open(candidate, previewSeed, function (report) {
        if (report) demonstrated[item.labId] = report;
        renderCandidates();
      }, mode);
      if (opened && opened.ok === false && b.parentNode) {
        var n = document.createElement('div');
        n.className = 'hint';
        n.setAttribute('data-popup-blocked', '1');
        n.textContent = 'Your browser blocked the preview tab. Allow pop-ups ' +
          'for this page and press again.';
        b.parentNode.appendChild(n);
      }
    });
    return b;
  }

  // Secondary, and only after the reviewer has been there: what the
  // preview actually did, in the same plain language.
  function renderDemonstration(card, item) {
    var rep = demonstrated[item.labId];
    var host = card.querySelector('.demo');
    if (!rep || !host) return;
    var h = rep.happened || {};
    var ending = h.ending === 'discovery'
      ? 'Something was found' + (h.discovery ? ' — ' + h.discovery.replace(/-/g, ' ') : '') + '.'
      : h.ending ? 'It stayed a question.' : 'It was still open when you left.';
    host.innerHTML =
      '<div class="demo-title">What the preview demonstrated</div>' +
      facet('mystery', rep.mystery) +
      facet('child action', rep.action) +
      facet('discovery', rep.discovery) +
      facet('next mystery', rep.next) +
      facet('what happened', ending);
  }

  // §13 — HUMAN REVIEW, on INVALID candidates too. The four judgements
  // are the same four; what they MEAN on a refused candidate is stated
  // on the card, because "Good" there says the IDEA is promising and
  // never that the candidate is production-ready. Nothing here can move
  // an invalid candidate into the production export: session.approve()
  // refuses on `not-valid`, and only an approved item is exported.
  function reviewControls(item, sup, study) {
    var wrap = document.createElement('div');
    var invalid = !(item.validation && item.validation.ok);
    if (invalid) {
      var head = document.createElement('div');
      head.className = 'research-judgement';
      head.textContent = 'Research judgement — “Good” here means the IDEA is ' +
        'creatively promising, not that this candidate is production-ready. ' +
        'An invalid candidate can never be approved or exported to the pool.';
      wrap.appendChild(head);
    }
    if (item.review) {
      var summary = document.createElement('div');
      summary.className = 'note';
      summary.textContent = 'reviewed: ' + item.review.classification +
        (item.review.reasons.length ? ' — ' + item.review.reasons.join(', ') : '') +
        (item.review.notes ? ' — "' + item.review.notes + '"' : '') +
        (invalid ? ' (research only)' : '');
      wrap.appendChild(summary);
    }
    var row = document.createElement('div');
    row.className = 'row';
    [['exceptional', '🌟 Exceptional'], ['good', '✨ Good'],
     ['valid-but-boring', '🟡 Valid but boring'], ['reject', '🔴 Reject']]
      .forEach(function (pair) {
        var b = document.createElement('button');
        b.textContent = pair[1];
        b.setAttribute('data-classify', pair[0]);
        // Kept out of the creative approval path: a VALID candidate
        // nobody can SEE must not be approved on the strength of its
        // JSON. An invalid one is never approvable anyway, so its
        // judgement stays open — that is the research result.
        if (!invalid && sup && !sup.ok &&
            (pair[0] === 'exceptional' || pair[0] === 'good')) {
          b.disabled = true;
          b.title = 'Preview unavailable — unsupported runtime capability';
        }
        b.addEventListener('click', function () {
          var reasons = Array.prototype.slice.call(wrap.querySelectorAll('input[data-reason]:checked'))
            .map(function (c) { return c.getAttribute('data-reason'); });
          var notes = wrap.querySelector('textarea') ? wrap.querySelector('textarea').value : '';
          session.review(item.labId, pair[0], reasons, notes);
          if (pair[0] === 'exceptional' || pair[0] === 'good') session.approve(item.labId);
          renderCandidates();
          renderStats();
        });
        row.appendChild(b);
      });

    // §6 — ↻ Regenerate. It sends the candidate's OWN intent and its
    // OWN refusals back through the same generation contract, and the
    // answer becomes a NEW candidate linked to this one. The original
    // is never mutated and never loses its reasons.
    var regen = document.createElement('button');
    regen.textContent = '↻ Regenerate';
    regen.title = invalid
      ? 'Ask again for this same idea, expressed with what the Ether can do'
      : 'Ask for one more candidate with this grammar';
    regen.setAttribute('data-regenerate', item.labId);
    regen.addEventListener('click', function () {
      var brief = session.refinementBrief(item.labId);
      $('countSelect').value = '1';
      generateNow(brief);
    });
    row.appendChild(regen);
    wrap.appendChild(row);

    var reasons = document.createElement('div');
    reasons.className = 'chips';
    Kit.REJECTION_REASONS.forEach(function (r) {
      var l = document.createElement('label');
      var c = document.createElement('input');
      c.type = 'checkbox';
      c.setAttribute('data-reason', r);
      l.appendChild(c);
      l.appendChild(document.createTextNode(r));
      reasons.appendChild(l);
    });
    wrap.appendChild(reasons);

    var notes = document.createElement('textarea');
    notes.placeholder = 'reviewer notes (kept with the candidate, preserved in stats)';
    wrap.appendChild(notes);
    return wrap;
  }

  // ---------------- stats + export ----------------
  function renderStats() {
    $('stats').textContent = JSON.stringify(session.stats(), null, 2);
  }

  function exportNow() {
    var ex = session.exportApproved();
    if (!ex.ok) {
      $('exportState').textContent = ex.refused
        ? 'export refused: ' + ex.reasons.join(', ')
        : 'nothing approved yet';
      return;
    }
    if (!ex.count) { $('exportState').textContent = 'nothing approved yet'; return; }
    var blob = new Blob([JSON.stringify(ex.artifact, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ether-mystery-lab-export-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    $('exportState').textContent = ex.count + ' approved candidate(s) exported — review the file, then commit entries into assets/ether/experience-pool.js';
    window.__lastLabExport = ex.artifact; // for the suite's own reading
  }

  // §8's real answer: the Lab used to throw away exactly the material a
  // research instrument exists to study. The research log carries EVERY
  // candidate — valid and invalid — with its refusals, its derived
  // intent, whether it could be previewed and what a person made of it.
  // It is deliberately NOT the pool artifact and says so in its own
  // format name, its note and a `productionReady:false` flag.
  function exportResearchNow() {
    var ex = session.exportResearch();
    if (!ex.ok) {
      $('researchState').textContent = ex.refused
        ? 'research export refused: ' + ex.reasons.join(', ')
        : 'nothing to export yet';
      return;
    }
    if (!ex.count) { $('researchState').textContent = 'nothing generated yet'; return; }
    var blob = new Blob([JSON.stringify(ex.artifact, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ether-mystery-lab-research-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    $('researchState').textContent = ex.count + ' candidate(s) in the research log — ' +
      'RESEARCH ONLY, never committed into the experience pool';
    window.__lastLabResearchExport = ex.artifact; // for the suite's own reading
  }

  // ---------------- boot (draws; asks nothing of any model) --------
  wireConnection();
  wireIngredients();
  wireGeneration();
  renderStats();
  paintStatus();
})();
