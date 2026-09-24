// tools/ether-mystery-lab/labConnection.js — how the Lab reaches (or
// honestly does not reach) a real model.
//
// SPRINT — Ether Mystery Lab (Decision 58).
//
// THREE MODES, AND THE STATUS NEVER LIES (§21):
//
//   fixture   — no network at all. labKit's deterministic fixture
//               generator walks the identical pipeline, every
//               candidate labelled source:'fixture', and the status
//               line says FIXTURE MODE. Never silently substituted
//               for a real model: a failed real generation FAILS,
//               with its reason on screen, and the developer chooses
//               fixture mode themselves.
//
//   endpoint  — the deployed supabase/functions/lab-generate relay:
//               the provider key lives in that function's own
//               environment and nowhere else (Decision 25). The Lab
//               sends the labKit-built messages and a session token;
//               the function is administrators-only, rate-limited,
//               and answers 200-with-reason on every failure.
//
//   direct    — DEVELOPMENT ONLY. The developer types their own
//               provider key at runtime. It lives in a closure
//               variable for the life of the page: never localStorage,
//               never sessionStorage, never a cookie, never an export,
//               never logged. `disconnect()` clears it, and the page
//               warns in red before the field.
//
// COST / RATE CONTROL (§20): nothing is called on load, nothing is
// called except by the explicit Generate/Test actions, every request
// is bounded (Decision 49 — abort AND race), there is no retry loop
// anywhere, and a running generation can be cancelled.

(function (global) {
  'use strict';

  var DIRECT_URL = 'https://api.openai.com/v1/chat/completions';
  var DIRECT_MODELS_URL = 'https://api.openai.com/v1/models';
  // IMAGES (the creature pipeline, Decision 58 — AI does the authoring).
  // One request per candidate, in parallel: a partial set still arrives
  // when one request fails, and no single request has to carry three
  // pictures inside a relay's own time limit. Fast quality, JPEG, one
  // size — a source image for a figure of lights, not a poster.
  var DIRECT_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
  var IMAGE_MODEL = 'gpt-image-2';
  var IMAGE_SIZE = '1024x1024';
  var IMAGE_QUALITY = 'low';
  var DEFAULT_DIRECT_MODEL = 'gpt-4.1-mini';
  var REQUEST_MS = 120000;
  var IMAGE_MS = 150000;
  var PROBE_MS = 15000;

  var state = {
    mode: 'fixture',              // 'fixture' | 'endpoint' | 'direct'
    directKey: null,              // memory only — see the header
    directModel: DEFAULT_DIRECT_MODEL,
    endpointUrl: '',
    endpointToken: null,          // memory only, same rule as the key
    probed: null,                 // null | 'connected' | 'unavailable'
    lastReason: null
  };

  var inflight = null;            // AbortController of the running call
  var inflightAll = [];           // every running call — the creature pipeline runs three at once

  function setMode(m) {
    if (m === 'fixture' || m === 'endpoint' || m === 'direct') {
      state.mode = m;
      state.probed = null;
      state.lastReason = null;
    }
    return status();
  }
  function setDirectKey(k) { state.directKey = (k && String(k)) || null; state.probed = null; return status(); }
  function setDirectModel(m) { if (m) state.directModel = String(m); }
  function setEndpoint(url, token) {
    state.endpointUrl = (url && String(url).replace(/\/+$/, '')) || '';
    state.endpointToken = (token && String(token)) || null;
    state.probed = null;
    return status();
  }
  function disconnect() {
    state.directKey = null;
    state.endpointToken = null;
    state.endpointUrl = '';
    state.mode = 'fixture';
    state.probed = null;
    state.lastReason = null;
    return status();
  }

  // The one honest sentence (§21). A configured-but-untested
  // connection says so — "connected" is only ever claimed after a
  // probe actually answered.
  function status() {
    if (state.mode === 'fixture') return { mode: 'fixture', line: 'FIXTURE MODE — REAL LLM NOT CONNECTED' };
    var configured = state.mode === 'direct' ? !!state.directKey : !!state.endpointUrl;
    if (!configured) return { mode: state.mode, line: 'LLM UNAVAILABLE — not configured' };
    if (state.probed === 'connected') return { mode: state.mode, line: 'LLM CONNECTED (' + state.mode + ')' };
    if (state.probed === 'unavailable') {
      return { mode: state.mode, line: 'LLM UNAVAILABLE' + (state.lastReason ? ' — ' + state.lastReason : '') };
    }
    return { mode: state.mode, line: 'LLM CONFIGURED — NOT TESTED (' + state.mode + ')' };
  }

  // Bounded fetch — abort AND race (Decision 49). One attempt, never a
  // retry: a failed request is a sentence on screen and a developer's
  // own decision to try again.
  function bounded(url, init, ms) {
    var ctl = new AbortController();
    inflight = ctl;
    inflightAll.push(ctl);
    var bell = null;
    var timed = new Promise(function (resolve) {
      bell = setTimeout(function () {
        try { ctl.abort(); } catch (e) { /* held */ }
        resolve(null);
      }, ms);
    });
    init = Object.assign({}, init, { signal: ctl.signal });
    return Promise.race([
      fetch(url, init).catch(function () { return null; }),
      timed
    ]).then(function (res) {
      clearTimeout(bell);
      if (inflight === ctl) inflight = null;
      var at = inflightAll.indexOf(ctl); if (at !== -1) inflightAll.splice(at, 1);
      return res;
    });
  }

  function cancel() {
    if (inflight) { try { inflight.abort(); } catch (e) { /* held */ } inflight = null; return true; }
    return false;
  }
  // Every running call at once — a new creature session must leave no
  // request alive that could answer into it later.
  function cancelAll() {
    var n = inflightAll.length;
    inflightAll.slice().forEach(function (c) { try { c.abort(); } catch (e) { /* held */ } });
    inflightAll = []; inflight = null;
    return n;
  }

  // Explicit, button-driven — never on load.
  function probe() {
    if (state.mode === 'fixture') {
      return Promise.resolve({ ok: true, line: status().line });
    }
    if (state.mode === 'direct') {
      if (!state.directKey) { state.probed = 'unavailable'; state.lastReason = 'no key'; return Promise.resolve({ ok: false, line: status().line }); }
      return bounded(DIRECT_MODELS_URL, {
        headers: { 'Authorization': 'Bearer ' + state.directKey }
      }, PROBE_MS).then(function (res) {
        state.probed = (res && res.ok) ? 'connected' : 'unavailable';
        state.lastReason = res ? (res.ok ? null : ('provider answered ' + res.status)) : 'unreachable';
        return { ok: state.probed === 'connected', line: status().line };
      });
    }
    // endpoint
    if (!state.endpointUrl) { state.probed = 'unavailable'; state.lastReason = 'no endpoint'; return Promise.resolve({ ok: false, line: status().line }); }
    return bounded(state.endpointUrl, {
      method: 'POST',
      headers: headersForEndpoint(),
      body: JSON.stringify({ action: 'ping' })
    }, PROBE_MS).then(function (res) {
      if (!res) { state.probed = 'unavailable'; state.lastReason = 'unreachable'; return { ok: false, line: status().line }; }
      return res.json().catch(function () { return null; }).then(function (body) {
        var okPing = !!(body && body.ok);
        var hasKey = okPing && body.provider === 'configured';
        state.probed = (okPing && hasKey) ? 'connected' : 'unavailable';
        state.lastReason = !okPing ? ('endpoint answered ' + res.status)
          : (hasKey ? null : 'endpoint reachable, no provider key configured');
        return { ok: state.probed === 'connected', line: status().line, build: body && body.build };
      });
    });
  }

  function headersForEndpoint() {
    var h = { 'Content-Type': 'application/json' };
    if (state.endpointToken) h['Authorization'] = 'Bearer ' + state.endpointToken;
    return h;
  }

  // generate({messages, params}) → Promise<{ok, text, model, source} |
  // {ok:false, reason}>. The messages are labKit's — ONE prompt owner
  // whatever the transport — and `source` is the honest label every
  // candidate will carry: 'fixture' or 'generated', never mislabelled.
  function generate(opts) {
    opts = opts || {};
    if (state.mode === 'fixture') {
      // A caller may bring its own fixture producer (the Shape Lab's
      // blueprint does); the Mystery Lab's candidates stay the default.
      if (typeof opts.fixture === 'function') {
        return Promise.resolve({ ok: true, text: String(opts.fixture()), model: null, source: 'fixture' });
      }
      var kit = global.EtherMysteryLabKit;
      var fx = kit.fixtureGenerate(opts.params || {});
      return Promise.resolve({ ok: true, text: fx.text, model: null, source: 'fixture' });
    }
    if (state.mode === 'direct') {
      if (!state.directKey) return Promise.resolve({ ok: false, reason: 'not-configured' });
      return bounded(DIRECT_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + state.directKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // a caller may name the model for THIS request (the creature
          // pipeline reads an image, which the default text model cannot)
          model: (opts.params && opts.params.model) || state.directModel,
          messages: opts.messages || [],
          response_format: { type: 'json_object' },
          temperature: (opts.params && typeof opts.params.temperature === 'number') ? opts.params.temperature : 0.9
        })
      }, REQUEST_MS).then(function (res) {
        if (!res) return { ok: false, reason: 'unavailable' };
        if (!res.ok) {
          if (res.status === 429) return { ok: false, reason: 'provider-busy' };
          // A refusal must say enough to be acted on. The provider's
          // structured error CODE is a fixed vocabulary that names the
          // fault — model_not_found, insufficient_permissions — and a
          // bare status number is what turned a ten-second fix into a
          // debugging session. Its free-text `message` is deliberately
          // NOT shown: it is prose rather than a diagnosis, and it
          // carries organisation and project identifiers, which have no
          // business on a screen. Direct mode is the developer's own
          // browser and own key, so the whole response is theirs to read
          // in the network panel; this is the part worth putting in front
          // of them. The endpoint's own posture is untouched — a failure
          // there is still one word and never provider text (suite S6).
          return res.json().catch(function () { return null; }).then(function (body) {
            var err = body && body.error;
            var code = err && (err.code || err.type);
            code = code ? String(code).slice(0, 60) : '';
            return { ok: false, reason: 'provider answered ' + res.status + (code ? ' (' + code + ')' : '') };
          });
        }
        return res.json().catch(function () { return null; }).then(function (body) {
          var text = body && body.choices && body.choices[0] &&
            body.choices[0].message && body.choices[0].message.content;
          if (!text) return { ok: false, reason: 'malformed' };
          return { ok: true, text: text, model: (opts.params && opts.params.model) || state.directModel, source: 'generated' };
        });
      });
    }
    // endpoint
    if (!state.endpointUrl) return Promise.resolve({ ok: false, reason: 'not-configured' });
    return bounded(state.endpointUrl, {
      method: 'POST',
      headers: headersForEndpoint(),
      body: JSON.stringify({
        action: 'generate',
        messages: opts.messages || [],
        model: (opts.params && opts.params.model) || undefined,
        temperature: (opts.params && typeof opts.params.temperature === 'number') ? opts.params.temperature : undefined
      })
    }, REQUEST_MS).then(function (res) {
      if (!res) return { ok: false, reason: 'unavailable' };
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!body) return { ok: false, reason: 'malformed' };
        if (!body.ok) return { ok: false, reason: body.reason || ('endpoint answered ' + res.status) };
        if (typeof body.text !== 'string' || !body.text) return { ok: false, reason: 'malformed' };
        return { ok: true, text: body.text, model: body.model || null, source: 'generated' };
      });
    });
  }

  // images({prompt, n, fixture}) → Promise<{ok, images:[{dataUrl, source,
  // model}], failed} | {ok:false, reason}>. Three bounded requests in
  // parallel; the honest label rides every image exactly as it rides
  // every candidate. Fixture mode asks the caller's own producer (an SVG
  // that says FIXTURE) and reaches no network.
  function images(opts) {
    opts = opts || {};
    var n = Math.max(1, Math.min(3, Number(opts.n) || 3));
    if (state.mode === 'fixture') {
      var list = typeof opts.fixture === 'function' ? opts.fixture() : [];
      return Promise.resolve({ ok: true, images: (list || []).slice(0, n).map(function (u) { return { dataUrl: u, source: 'fixture', model: null }; }), failed: 0 });
    }
    var prompt = String(opts.prompt || '');
    if (!prompt) return Promise.resolve({ ok: false, reason: 'bad-prompt' });
    var one;
    if (state.mode === 'direct') {
      if (!state.directKey) return Promise.resolve({ ok: false, reason: 'not-configured' });
      one = function () {
        return bounded(DIRECT_IMAGES_URL, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + state.directKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: IMAGE_MODEL, prompt: prompt, n: 1, size: IMAGE_SIZE, quality: IMAGE_QUALITY, output_format: 'jpeg', output_compression: 75 })
        }, IMAGE_MS).then(function (res) {
          if (!res) return { ok: false, reason: 'unavailable' };
          if (!res.ok) return { ok: false, reason: res.status === 429 ? 'provider-busy' : ('provider answered ' + res.status) };
          return res.json().catch(function () { return null; }).then(function (body) {
            var b64 = body && body.data && body.data[0] && body.data[0].b64_json;
            if (!b64) return { ok: false, reason: 'malformed' };
            return { ok: true, dataUrl: 'data:image/jpeg;base64,' + b64, model: IMAGE_MODEL };
          });
        });
      };
    } else {
      if (!state.endpointUrl) return Promise.resolve({ ok: false, reason: 'not-configured' });
      one = function () {
        return bounded(state.endpointUrl, {
          method: 'POST', headers: headersForEndpoint(),
          body: JSON.stringify({ action: 'image', prompt: prompt })
        }, IMAGE_MS).then(function (res) {
          if (!res) return { ok: false, reason: 'unavailable' };
          return res.json().catch(function () { return null; }).then(function (body) {
            if (!body) return { ok: false, reason: 'malformed' };
            if (!body.ok) return { ok: false, reason: body.reason || ('endpoint answered ' + res.status) };
            if (typeof body.image !== 'string' || !/^[A-Za-z0-9+\/=]+$/.test(body.image)) return { ok: false, reason: 'malformed' };
            return { ok: true, dataUrl: 'data:image/' + (body.format === 'png' ? 'png' : 'jpeg') + ';base64,' + body.image, model: body.model || IMAGE_MODEL };
          });
        });
      };
    }
    var calls = [];
    for (var i = 0; i < n; i++) calls.push(one());
    return Promise.all(calls).then(function (rs) {
      var got = rs.filter(function (r) { return r && r.ok; });
      if (!got.length) return { ok: false, reason: (rs[0] && rs[0].reason) || 'unavailable' };
      return { ok: true, images: got.map(function (r) { return { dataUrl: r.dataUrl, source: 'generated', model: r.model }; }), failed: rs.length - got.length };
    });
  }

  var api = {
    IMAGE_MODEL: IMAGE_MODEL,
    setMode: setMode,
    setDirectKey: setDirectKey,
    setDirectModel: setDirectModel,
    setEndpoint: setEndpoint,
    disconnect: disconnect,
    status: status,
    probe: probe,
    generate: generate,
    images: images,
    cancel: cancel,
    cancelAll: cancelAll,
    // For the suite only: proves the key sits in a closure and nowhere
    // else — it can ask WHETHER one is held, never what it is.
    _holdsDirectKey: function () { return !!state.directKey; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LabConnection = api;
  else global.LabConnection = api;
})(typeof window !== 'undefined' ? window : this);
