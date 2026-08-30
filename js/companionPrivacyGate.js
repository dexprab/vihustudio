// js/companionPrivacyGate.js — the boundary of VihuPlanet.
//
// Sprint 1D, and Decision 30's own words: the gate "is the only thing
// permitted to call the model... Not a rule somebody remembers to
// follow." Nothing calls a model today, so today the gate is the last
// thing that happens: a context it has not approved does not exist.
//
// ---------------------------------------------------------------
// IT DENIES BY SHAPE, NOT BY SCHEMA
//
// The obvious gate is a copier: read the fields you trust, write them
// into a new object, drop the rest. It was refused, because a copier
// only ever knows the schema it was written against — the day somebody
// adds a field to the builder, the copier either drops it silently (and
// the feature mysteriously does not work) or is widened to carry it
// (and the review that should have happened does not).
//
// So this walks the WHOLE object and refuses:
//
//   · any KEY that names an identifier, a credential or an asset
//   · any VALUE shaped like a URL, a data URI, an asset reference, an
//     email address or a token
//   · any MEMBER not named in the context contract
//
// A field a future build adds is refused unless it is added to the
// contract, which is one line and is reviewable. Nothing is dropped
// quietly: every refusal is a row in the ledger and a row in
// `violations`.
//
// ---------------------------------------------------------------
// THE TRAVELLER GATE IS AT THE TOP
//
// Decision 29 established the shape and Decision 24 the reason: what a
// Companion and its Creator remember together is not a visitor's to
// hear. In Traveller mode memory is not filtered at the end — it is
// refused here, whatever the builder produced, so a builder bug cannot
// leak one.
const CompanionPrivacyGate = (function () {
  'use strict';

  // The contract. A member not in this list does not reach a model,
  // whoever put it in the raw context.
  // `now` and `studio` joined in Step 3E. Both are LIVE and both are
  // PRODUCT CONTENT rather than anybody's data — the date from the
  // server's own clock, and the Studio describing its own controls —
  // and both are swept for values exactly like everything else. They
  // are named here because a member not in the contract is REFUSED,
  // which is the property that makes this a contract and not a filter.
  const CONTRACT = ['contextVersion', 'mode', 'authority', 'canon', 'personality',
                    'memories', 'storyContext', 'now', 'studio', 'conversation'];

  // What Traveller mode is allowed. Deliberately a second, smaller list
  // rather than a set of exceptions inside the first: a mode that
  // permits less should be expressed by permitting less.
  const TRAVELLER_CONTRACT = ['contextVersion', 'mode', 'authority', 'canon', 'personality',
                              'storyContext', 'now', 'studio', 'conversation'];

  // ---------------------------------------------------------------
  // KEYS THAT NEVER LEAVE. Matched case-insensitively, whole word
  // against the key itself — `hasImage` is a fact about a page and
  // `image` is a thing that might be one.
  const FORBIDDEN_KEYS = [
    'id', 'ids', 'uid', 'uuid', 'guid',
    'cardid', 'creatorid', 'companionid', 'memoryid', 'projectid', 'libraryid',
    'ownerid', 'owner_id', 'userid', 'user_id', 'sessionid', 'session_id',
    'token', 'accesstoken', 'access_token', 'refreshtoken', 'jwt', 'bearer',
    'auth', 'authorization', 'password', 'secret', 'apikey', 'api_key', 'key',
    'email', 'parentemail', 'parent_email',
    'src', 'url', 'uri', 'href', 'link', 'path', 'storagepath', 'asset', 'assets',
    'png', 'jpg', 'jpeg', 'image', 'images', 'thumbnail', 'photo', 'bytes', 'blob',
    'pattern', 'constellation', 'nickname',
  ];

  // VALUES THAT NEVER LEAVE, whatever key they arrive under — including
  // inside Creator-authored prose. A link in a story is exactly the
  // shape this exists to stop, so it is redacted rather than carried,
  // and the redaction is recorded.
  const FORBIDDEN_VALUES = [
    [/\bhttps?:\/\/\S+/gi, 'an external URL'],
    [/\bwss?:\/\/\S+/gi, 'a socket URL'],
    [/\bdata:[a-z0-9.+-]+\/[a-z0-9.+-]+[;,]\S*/gi, 'inline data'],
    [/\bblob:\S+/gi, 'a blob reference'],
    [/\bvihu-asset:\S+/gi, 'an asset reference'],
    [/\bfile:\/\/\S+/gi, 'a file path'],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g, 'an email address'],
    [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.?[A-Za-z0-9_-]*/g, 'a token'],
    [/\bsk-[A-Za-z0-9_-]{16,}/g, 'a credential'],
    [/\b(?:card|proj|lib|mem)_[A-Za-z0-9]{6,}/g, 'an internal identifier'],
  ];

  const REDACTED = '[removed]';

  function _forbiddenKey(key) {
    const k = String(key).toLowerCase().replace(/[^a-z0-9_]/g, '');
    return FORBIDDEN_KEYS.indexOf(k) !== -1;
  }

  function _scrubString(s, path, out) {
    let v = String(s);
    for (let i = 0; i < FORBIDDEN_VALUES.length; i++) {
      const rule = FORBIDDEN_VALUES[i];
      if (rule[0].test(v)) {
        rule[0].lastIndex = 0;
        v = v.replace(rule[0], REDACTED);
        out.push({ path: path, reason: rule[1] + ' was removed from the text' });
      }
      rule[0].lastIndex = 0;
    }
    return v;
  }

  /**
   * The sweep. Returns a NEW value; the input is never mutated, so a
   * caller still holds whatever it held and nothing in the Studio
   * changes because a context was built.
   *
   * `keys` may be false for a subtree whose KEY names are product
   * structure rather than anything derived from a Creator — see the
   * canon exemption in approve(). Values are swept either way, always.
   */
  function _scrub(value, path, violations, keys) {
    const sweepKeys = (keys !== false);
    if (value === null || value === undefined) return value;
    const t = typeof value;
    if (t === 'string') return _scrubString(value, path, violations);
    if (t === 'number' || t === 'boolean') return value;
    if (Array.isArray(value)) {
      return value.map(function (v, i) { return _scrub(v, path + '[' + i + ']', violations, keys); })
        .filter(function (v) { return v !== undefined; });
    }
    if (t !== 'object') {
      violations.push({ path: path, reason: 'a value of type ' + t + ' is not context data' });
      return undefined;
    }
    const out = {};
    Object.keys(value).forEach(function (k) {
      const p = path ? (path + '.' + k) : k;
      if (sweepKeys && _forbiddenKey(k)) {
        violations.push({ path: p, reason: '`' + k + '` names an identifier, a credential or an asset' });
        return;
      }
      const v = _scrub(value[k], p, violations, keys);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  /**
   * rawContext → approvedContext.
   *
   * @param {object} raw   from CompanionContextBuilder.buildRaw()
   * @param {object} [opts] {mode, ledger}
   * @returns {{approved:object|null, ledger:Array, violations:Array}}
   */
  function approve(raw, opts) {
    const o = opts || {};
    const ledger = [];
    const violations = [];

    if (!raw || typeof raw !== 'object') {
      ledger.push({ source: 'everything', decision: 'EXCLUDED', reason: 'there was no context to approve' });
      return { approved: null, ledger: ledger, violations: [{ path: '', reason: 'no raw context' }] };
    }

    const mode = (o.mode || raw.mode) === 'traveller' ? 'traveller' : 'creator';
    const contract = (mode === 'traveller') ? TRAVELLER_CONTRACT : CONTRACT;

    // ---- 1. THE MODE GATE, AT THE TOP -----------------------------
    if (mode === 'traveller') {
      ledger.push({
        source: 'Creator-private memory',
        decision: 'EXCLUDED',
        reason: 'Traveller mode — a visitor never receives what a Companion and its Creator remember together',
      });
      if (raw.memories && raw.memories.length) {
        // The builder already refuses this; the gate refuses it again
        // because a hard privacy boundary that only one file enforces
        // is one file away from not being enforced.
        violations.push({ path: 'memories', reason: 'memories reached the gate in Traveller mode' });
      }
    }

    // ---- 2. THE CONTRACT ------------------------------------------
    const picked = {};
    Object.keys(raw).forEach(function (k) {
      if (contract.indexOf(k) === -1) {
        // Say WHY, not just that. A ledger that answers every refusal
        // with the same sentence is a ledger nobody reads twice.
        let why;
        if (CONTRACT.indexOf(k) !== -1) why = 'not permitted in ' + mode + ' mode';
        else if (_forbiddenKey(k)) why = '`' + k + '` names an identifier, a credential or an asset';
        else why = 'not in the context contract — nothing is included by being adjacent to something that is';
        ledger.push({ source: k, decision: 'EXCLUDED', reason: why });
        return;
      }
      picked[k] = raw[k];
    });
    picked.mode = mode;

    // ---- 3. THE SWEEP ---------------------------------------------
    //
    // THE CANON IS SWEPT FOR VALUES AND EXEMPT FOR KEYS, and the
    // exemption is narrow, stated and earned. Its sections are keyed
    // `id` and `key` — '01', 'vihuplanet' — which are the canon's own
    // structure and are exactly what makes it readable; a blanket key
    // sweep would strip them and hand a model fifteen anonymous blocks
    // of prose. They are also, unlike anything else in this context,
    // PRODUCT CONTENT: committed to the repository, reviewed in a pull
    // request, identical for every child, and already proved to contain
    // no Creator data and no engineering by the canon suite's own
    // checks. Nothing derived from a Creator gets this exemption, and
    // the value sweep still runs over every word of it.
    const canonPart = Object.prototype.hasOwnProperty.call(picked, 'canon') ? picked.canon : undefined;
    if (canonPart !== undefined) delete picked.canon;
    const approved = _scrub(picked, '', violations);
    if (canonPart !== undefined) {
      approved.canon = _scrub(canonPart, 'canon', violations, false);
      ledger.push({
        source: 'canon structure (section ids and keys)',
        decision: 'INCLUDED',
        reason: 'product content, reviewed in the repository — swept for values, exempt from the key sweep',
      });
    }

    violations.forEach(function (v) {
      ledger.push({
        source: v.path || 'context',
        decision: 'EXCLUDED',
        reason: v.reason,
      });
    });

    ledger.push({
      source: 'approved context',
      decision: 'INCLUDED',
      reason: Object.keys(approved).sort().join(', ')
        + ' — ' + violations.length + ' refusal(s) on the way through',
    });

    return { approved: approved, ledger: ledger, violations: violations };
  }

  /**
   * A second, independent read of the same question: is this object
   * safe? Used by the suite and by the preview so that "the gate says
   * it is clean" is never the only evidence that it is.
   */
  function audit(value, opts) {
    const violations = [];
    _scrub(value, '', violations, !(opts && opts.keys === false));
    return { clean: violations.length === 0, violations: violations };
  }

  const api = {
    approve: approve,
    audit: audit,
    CONTRACT: CONTRACT,
    TRAVELLER_CONTRACT: TRAVELLER_CONTRACT,
    FORBIDDEN_KEYS: FORBIDDEN_KEYS,
    REDACTED: REDACTED,
  };
  try { window.CompanionPrivacyGate = api; } catch (e) {}
  return api;
})();
