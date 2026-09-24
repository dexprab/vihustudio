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
  var DIRECT_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
  var DEFAULT_DIRECT_MODEL = 'gpt-4.1';
  var DEFAULT_DIRECT_IMAGE_MODEL = 'gpt-image-2';
  var IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
  // IMAGES (the creature pipeline, Decision 58 — AI does the authoring).
  // One request per candidate, in parallel: a partial set still arrives
  // when one request fails, and no single request has to carry three
  // pictures inside a relay's own time limit. Fast quality, JPEG, one
  // size — a source image for a figure of lights, not a poster. The
  // model is the Image model field's (`imagine` reads the same one).
  var IMAGE_MODEL = DEFAULT_DIRECT_IMAGE_MODEL;
  var IMAGE_SIZE = '1024x1024';
  var IMAGE_QUALITY = 'low';
  var REQUEST_MS = 120000;
  var IMAGE_MS = 150000;
  var PROBE_MS = 15000;

  var state = {
    mode: 'fixture',              // 'fixture' | 'endpoint' | 'direct'
    directKey: null,              // memory only — see the header
    directModel: DEFAULT_DIRECT_MODEL,
    directImageModel: DEFAULT_DIRECT_IMAGE_MODEL,
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
  // TWO MODELS, TWO FIELDS. The understanding model answers chat
  // completions (image understanding, the plan, the blueprint) and the
  // image model draws pictures. A picture model on the chat path is the
  // one mistake the page used to allow — its only field fed the chat
  // model, so typing gpt-image-2 there sent gpt-image-2 to
  // /chat/completions, which the provider answers with a bare 500
  // (measured). Each path now refuses a name that plainly belongs to the
  // other, with a sentence of its own, before anything leaves.
  function setDirectModel(m) { if (m) state.directModel = String(m); }
  function setDirectImageModel(m) { if (m) state.directImageModel = String(m); }
  function models() { return { model: state.directModel, imageModel: state.directImageModel, defaults: { model: DEFAULT_DIRECT_MODEL, imageModel: DEFAULT_DIRECT_IMAGE_MODEL } }; }
  function looksLikeImageModel(m) { return /^(gpt-image|dall-e)/i.test(String(m || '')); }
  function chatModelRefusal() { return looksLikeImageModel(state.directModel) ? { ok: false, reason: 'image-model-on-chat-path' } : null; }
  // A refusal the Lab itself made is said in a sentence, never as a code.
  function explain(reason) {
    if (reason === 'image-model-on-chat-path') return 'the Understanding model field holds an image model (' + state.directModel + '); understanding needs a chat model such as ' + DEFAULT_DIRECT_MODEL;
    if (reason === 'chat-model-on-image-path') return 'the Image model field holds a chat model (' + state.directImageModel + '); drawing needs an image model such as ' + DEFAULT_DIRECT_IMAGE_MODEL;
    return reason;
  }
  function imageModelRefusal() { return state.directImageModel && !looksLikeImageModel(state.directImageModel) ? { ok: false, reason: 'chat-model-on-image-path' } : null; }
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

  // A provider refusal on the Direct path, as a fixed vocabulary. The
  // provider's structured error CODE names the fault; its free-text
  // message is never shown (it carries organisation and project ids).
  // `model_not_found` and an image model name the provider says does not
  // exist both become 'no-image-model' — the one refusal the Lab has a
  // sentence for, because it is a property of the ACCOUNT, not a fault.
  function directRefusal(res, imageCall) {
    if (res.status === 429) return Promise.resolve({ ok: false, reason: 'provider-busy' });
    return res.json().catch(function () { return null; }).then(function (body) {
      var err = body && body.error;
      var code = err && (err.code || err.type);
      code = code ? String(code).slice(0, 60) : '';
      if (imageCall && (code === 'model_not_found' || code === 'invalid_value' || code === 'image_generation_user_error')) return { ok: false, reason: 'no-image-model' };
      return { ok: false, reason: 'provider answered ' + res.status + (code ? ' (' + code + ')' : '') };
    });
  }

  // ---------------------------------------------------------------
  // ARTISTIC IMAGE GENERATION — imagine({prompt, n, fixture}) →
  // Promise<{ok, images:[{mime, b64}], model, source} | {ok:false, reason}>.
  //
  // The provider abstraction the Shape Lab's CREATE stage stands on. The
  // three transports are the same three; what differs is the call: an
  // image model rather than a chat model. A fixture producer is the
  // caller's (the Lab's artwork set — existing pictures, never
  // generated), labelled source:'fixture'. A real generation is labelled
  // 'generated'. An account with no image model answers
  // {ok:false, reason:'no-image-model'} — the transport's own answer,
  // never a flag hard-coded here — so the day the account has one,
  // nothing in this file changes.
  // ---------------------------------------------------------------
  function imagine(opts) {
    opts = opts || {};
    var n = Math.max(1, Math.min(4, (opts.n | 0) || 3));
    if (state.mode === 'fixture') {
      var pics = typeof opts.fixture === 'function' ? (opts.fixture() || []) : [];
      return Promise.resolve({ ok: true, images: pics, model: null, source: 'fixture' });
    }
    if (typeof opts.prompt !== 'string' || !opts.prompt.trim()) return Promise.resolve({ ok: false, reason: 'bad-prompt' });
    if (state.mode === 'direct') {
      if (!state.directKey) return Promise.resolve({ ok: false, reason: 'not-configured' });
      if (imageModelRefusal()) return Promise.resolve(imageModelRefusal());
      return bounded(DIRECT_IMAGE_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.directKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: state.directImageModel, prompt: opts.prompt, n: n, size: '1024x1024' })
      }, REQUEST_MS).then(function (res) {
        if (!res) return { ok: false, reason: 'unavailable' };
        if (!res.ok) return directRefusal(res, true);
        return res.json().catch(function () { return null; }).then(function (body) {
          var data = body && Array.isArray(body.data) ? body.data : [];
          var images = data.filter(function (d) { return d && typeof d.b64_json === 'string' && d.b64_json; }).map(function (d) { return { mime: 'image/png', b64: d.b64_json }; });
          if (!images.length) return { ok: false, reason: 'malformed' };
          return { ok: true, images: images, model: state.directImageModel, source: 'generated' };
        });
      });
    }
    if (!state.endpointUrl) return Promise.resolve({ ok: false, reason: 'not-configured' });
    return bounded(state.endpointUrl, {
      method: 'POST', headers: headersForEndpoint(),
      body: JSON.stringify({ action: 'imagine', prompt: opts.prompt, n: n })
    }, REQUEST_MS).then(function (res) {
      if (!res) return { ok: false, reason: 'unavailable' };
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!body) return { ok: false, reason: 'malformed' };
        if (!body.ok) return { ok: false, reason: body.reason || ('endpoint answered ' + res.status) };
        var images = Array.isArray(body.images) ? body.images.filter(function (b) { return typeof b === 'string' && b; }).map(function (b) { return { mime: 'image/png', b64: b }; }) : [];
        if (!images.length) return { ok: false, reason: 'malformed' };
        return { ok: true, images: images, model: body.model || null, source: 'generated' };
      });
    });
  }

  // ---------------------------------------------------------------
  // IMAGE UNDERSTANDING — understand({messages, image:{mime,b64}, fixture})
  // → Promise<{ok, text, model, source} | {ok:false, reason}>. The
  // caller's messages are text; THIS is where the picture is attached,
  // as an image part on the last user message, so the caller never
  // builds a provider request shape. The reply is TEXT — the caller's
  // validator decides what it is.
  // ---------------------------------------------------------------
  // how much room the answer may take — a description needs 1400, an
  // extraction of twenty points with reasons more; bounded either way
  function maxTokens(opts) { var n = Number(opts && opts.maxTokens); return Number.isInteger(n) && n >= 200 ? Math.min(n, 4000) : 1400; }
  function understand(opts) {
    opts = opts || {};
    if (state.mode === 'fixture') {
      if (typeof opts.fixture !== 'function') return Promise.resolve({ ok: false, reason: 'no-fixture' });
      return Promise.resolve({ ok: true, text: String(opts.fixture()), model: null, source: 'fixture' });
    }
    var img = opts.image;
    if (!img || IMAGE_MIMES.indexOf(img.mime) === -1 || typeof img.b64 !== 'string' || img.b64.length < 64) return Promise.resolve({ ok: false, reason: 'bad-image' });
    var msgs = Array.isArray(opts.messages) ? opts.messages : [];
    if (state.mode === 'direct') {
      if (!state.directKey) return Promise.resolve({ ok: false, reason: 'not-configured' });
      if (chatModelRefusal()) return Promise.resolve(chatModelRefusal());
      var content = msgs.map(function (m, i) {
        if (i !== msgs.length - 1 || m.role !== 'user') return m;
        return { role: 'user', content: [
          { type: 'text', text: String(m.content) },
          { type: 'image_url', image_url: { url: 'data:' + img.mime + ';base64,' + img.b64, detail: 'high' } }
        ] };
      });
      return bounded(DIRECT_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.directKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: state.directModel, messages: content, response_format: { type: 'json_object' }, temperature: 0.2, max_tokens: maxTokens(opts) })
      }, REQUEST_MS).then(function (res) {
        if (!res) return { ok: false, reason: 'unavailable' };
        if (!res.ok) return directRefusal(res, false);
        return res.json().catch(function () { return null; }).then(function (body) {
          var text = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
          if (!text) return { ok: false, reason: 'malformed' };
          return { ok: true, text: text, model: state.directModel, source: 'generated' };
        });
      });
    }
    if (!state.endpointUrl) return Promise.resolve({ ok: false, reason: 'not-configured' });
    return bounded(state.endpointUrl, {
      method: 'POST', headers: headersForEndpoint(),
      body: JSON.stringify(opts.maxTokens ? { action: 'understand', messages: msgs, image: { mime: img.mime, b64: img.b64 }, maxTokens: maxTokens(opts) } : { action: 'understand', messages: msgs, image: { mime: img.mime, b64: img.b64 } })
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
      if (chatModelRefusal()) return Promise.resolve(chatModelRefusal());
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
        if (!res.ok) return directRefusal(res, false);
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
    var imageModel = state.directImageModel || IMAGE_MODEL;
    if (state.mode === 'direct') {
      if (!state.directKey) return Promise.resolve({ ok: false, reason: 'not-configured' });
      var refusal = imageModelRefusal();
      if (refusal) return Promise.resolve(refusal);
      one = function () {
        return bounded(DIRECT_IMAGE_URL, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + state.directKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: imageModel, prompt: prompt, n: 1, size: IMAGE_SIZE, quality: IMAGE_QUALITY, output_format: 'jpeg', output_compression: 75 })
        }, IMAGE_MS).then(function (res) {
          if (!res) return { ok: false, reason: 'unavailable' };
          if (!res.ok) return { ok: false, reason: res.status === 429 ? 'provider-busy' : ('provider answered ' + res.status) };
          return res.json().catch(function () { return null; }).then(function (body) {
            var b64 = body && body.data && body.data[0] && body.data[0].b64_json;
            if (!b64) return { ok: false, reason: 'malformed' };
            return { ok: true, dataUrl: 'data:image/jpeg;base64,' + b64, model: imageModel };
          });
        });
      };
    } else {
      if (!state.endpointUrl) return Promise.resolve({ ok: false, reason: 'not-configured' });
      // The endpoint's one image route (`imagine`), asked for ONE
      // candidate at source quality — the same request the direct path
      // makes, relayed by the function that holds the key.
      one = function () {
        return bounded(state.endpointUrl, {
          method: 'POST', headers: headersForEndpoint(),
          body: JSON.stringify({ action: 'imagine', prompt: prompt, n: 1, quality: IMAGE_QUALITY, format: 'jpeg' })
        }, IMAGE_MS).then(function (res) {
          if (!res) return { ok: false, reason: 'unavailable' };
          return res.json().catch(function () { return null; }).then(function (body) {
            if (!body) return { ok: false, reason: 'malformed' };
            if (!body.ok) return { ok: false, reason: body.reason || ('endpoint answered ' + res.status) };
            var b64 = Array.isArray(body.images) ? body.images[0] : null;
            if (typeof b64 !== 'string' || !/^[A-Za-z0-9+\/=]+$/.test(b64)) return { ok: false, reason: 'malformed' };
            return { ok: true, dataUrl: 'data:image/' + (body.format === 'png' ? 'png' : 'jpeg') + ';base64,' + b64, model: body.model || imageModel };
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
    setDirectImageModel: setDirectImageModel,
    models: models,
    explain: explain,
    setEndpoint: setEndpoint,
    disconnect: disconnect,
    status: status,
    probe: probe,
    generate: generate,
    images: images,
    imagine: imagine,
    understand: understand,
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
