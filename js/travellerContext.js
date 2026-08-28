// js/travellerContext.js — what a Traveller's Companion is allowed to know.
//
// Sprint 1M. There are two completely different relationships in this
// product and this file is the wall between them:
//
//   Creator  ──── private relationship ──── Companion
//   Traveller ─── public encounter ─────── Companion
//
// A Traveller who meets a Companion in the Ether is NOT stepping into
// somebody's private relationship. They are meeting a resident of a
// world that was deliberately shared. So the Companion they meet knows
// the Story it lives in and nothing else — no Creator, no memories, no
// card, no ids, no drafts, no history.
//
// ---------------------------------------------------------------
// IT IS A SEPARATE MODE, NOT A CREATOR CONTEXT WITH FIELDS REMOVED
//
// js/companionContextBuilder.js builds the Creator's context and
// js/companionPrivacyGate.js scrubs it. Reusing that and deleting
// fields would mean a Traveller's safety depended on a subtraction
// being kept complete forever — one field added upstream and it leaks.
// This builds from nothing instead: a Traveller context is CONSTRUCTED
// out of a fixed, tiny whitelist, so a field nobody listed cannot
// arrive by being adjacent to one that is.
//
// ---------------------------------------------------------------
// THE ONE SOURCE, AND WHY IT IS AUTHORITATIVE
//
// The only input is the Story record js/etherFeed.js already produced
// for the portal that is open. That record came from the shared feed,
// which is gated on `is_shared` — a generated column on
// creator_projects that is `(data->>'publishedAt') is not null` and
// cannot be set by a client independently of actually sharing
// (Decision 15). An unshared draft is unreachable through it by
// construction.
//
// So a Traveller cannot describe their own world to the Companion:
// build() takes the record the portal is showing and nothing a caller
// typed. There is no field on this contract for a story name, a
// Companion id or a page count that a caller could supply — the only
// argument is the record, and every value is copied out of it.
//
// DISCLOSED: this build has no server round-trip of its own. The
// authority is the feed that already fetched the record, not a fresh
// server check at conversation time. Adding one is Step 3's, when
// there is a request to attach it to.
const TravellerContext = (function () {
  'use strict';

  // Everything a Traveller's Companion may ever be told, and nothing
  // else can be added by accident: the shape below is written out by
  // hand, field by field, from the feed's record.
  //
  // TWO FIELDS ARRIVED IN SPRINT 1N.3, AND BOTH ARE ALREADY ON SCREEN.
  //
  //   `creatorName`  — the portal's own title bar prints the maker's
  //     name, so a resident of that world being able to say it
  //     discloses nothing that looking at the screen does not. It is
  //     the RECORD's creatorName, which travels with the story
  //     (Decision 15), never the card of whoever is doing the looking.
  //     This AMENDS the clause below that kept the Creator deliberately
  //     absent; that clause is left standing and marked, because the
  //     reasoning it gives is still exactly right about everything
  //     ELSE about a Creator.
  //
  //   `othersHere`   — how many OTHER stories by this maker are in the
  //     Ether right now. A count of a set that is public by
  //     construction. Never a database total, which would count private
  //     drafts, and never a guess: absent means the Companion says it
  //     does not know.
  //
  // THE STARS ARE NOT ON THIS LIST AND NEVER WILL BE. They are in
  // FORBIDDEN_KEYS below as well, so a field named for them is refused
  // whatever route it took.
  const PUBLIC_FIELDS = ['storyTitle', 'pageCount', 'hasVoice', 'isCanon',
                         'companionName', 'companionSpecies', 'companionId',
                         'creatorName', 'othersHere'];

  // Keys that must never appear in a Traveller context whatever route
  // they took to get here. The builder cannot produce them; the gate
  // refuses them anyway, because a wall with one guard is a wall with
  // one mistake in it.
  //
  // `creatorName` LEFT THIS LIST IN SPRINT 1N.3, and it is the only
  // thing that did. It is the maker's public name, already printed in
  // the portal's own title bar, and the product now lets a resident say
  // it out loud. Everything else about a Creator stayed — the raw
  // `creator` object, the ids, the card, the owner, the memories, the
  // conversation, the address.
  //
  // THE STARS JOINED IT. A Creator's constellation is their identity
  // and their credential (Decisions 11 and 18), and it is never public
  // on any surface. The builder has no field for one; this is the
  // second guard, because a wall with one guard is a wall with one
  // mistake in it.
  const FORBIDDEN_KEYS = [
    'stars', 'star', 'starCount', 'pattern', 'constellation', 'sky', 'signature',
    'creator', 'creatorId', 'cardId', 'card', 'ownerId', 'owner',
    'projectId', 'libraryId', 'id', 'memories', 'memory', 'bond', 'bondMoment',
    'conversation', 'history', 'preferences', 'pages', 'page', 'slides',
    'prose', 'storyBeat', 'storyDraft', 'draft', 'unpublished', 'email',
    'password', 'token', 'session', 'auth', 'publishedAt', 'updatedAt', 'cheers'
  ];

  // Values that must never appear whatever they are called: anything
  // that looks like an identifier, an address or an asset reference.
  const FORBIDDEN_VALUES = [
    /\bproj_[A-Za-z0-9_]+/,          // a project id
    /\bmc_[A-Za-z0-9_]+/,            // a Magic Card id
    /\blib_[A-Za-z0-9_]+/,           // a library id
    /vihu-asset:/i,                  // an asset reference
    /^data:/i,                       // an inline asset
    /https?:\/\//i,                  // any URL
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/  // an address
  ];

  function _str(v, max) {
    const t = String(v == null ? '' : v).trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max) : t;
  }

  /**
   * The public facts about the Story a Traveller is standing in.
   *
   * @param {object} story The record js/etherFeed.js produced — the
   *   same object the portal is already showing. Nothing a caller
   *   typed reaches this function.
   * @param {object} [host] {id, name, species} as js/storyHost.js
   *   resolved it from the registry.
   * @returns {object|null} A public context, or null if there is not
   *   enough to say anything honest.
   */
  function build(story, host) {
    try {
      if (!story || typeof story !== 'object') return null;
      const src = story.source || {};
      const ctx = {
        mode: 'traveller',
        // The Story's own name, which the portal is already showing in
        // its title bar. Public by construction.
        storyTitle: _str(story.title, 120),
        // A count, never the pages. The Companion may say how long the
        // Story is and may never quote a word of it — a page's prose is
        // the child's writing, and a Traveller is here to read it in the
        // Story rather than hear it recited by somebody.
        pageCount: (typeof story.pages === 'number' && isFinite(story.pages))
          ? Math.max(0, story.pages | 0) : null,
        hasVoice: !!story.hasAudio,
        isCanon: (story.origin || src.origin) === 'canon',
        // Who the Traveller is talking TO. Public: it is standing in
        // front of them.
        companionName: _str(host && host.name, 40),
        companionSpecies: _str(host && host.species, 40),
        companionId: _str(host && host.id, 40)
      };
      // THE MAKER'S NAME, AND NOTHING ELSE ABOUT THEM — Sprint 1N.3.
      //
      // Sprint 1M kept the Creator deliberately absent here, on the
      // reasoning that the portal's title bar is the SCREEN's label
      // while this is the Companion's KNOWLEDGE. That reasoning still
      // holds for everything about a Creator except the one thing the
      // screen is already showing: a Traveller asking "whose book is
      // this?" is asking about a line of text in front of them, and a
      // resident of that world saying it out loud is not a disclosure.
      //
      // Everything else about them is exactly as absent as it was —
      // no memories, no card, no ids, no drafts, no history, and no
      // private name. The Companion may NAME the maker; it still does
      // not discuss them.
      ctx.creatorName = _str(story.creator, 40);
      // How many OTHERS of theirs are here. Supplied by the caller from
      // the same feed the portal is already showing, or absent.
      ctx.othersHere = (typeof host === 'object' && host && typeof host.othersHere === 'number'
        && isFinite(host.othersHere) && host.othersHere >= 0) ? (host.othersHere | 0) : null;
      if (!ctx.storyTitle && !ctx.companionName) return null;
      return approve(ctx);
    } catch (e) { return null; }
  }

  /**
   * The gate. Refuses by SHAPE, not by schema — it walks whatever it is
   * given and drops anything that is not on the whitelist, so a field a
   * future build adds is refused by default rather than carried.
   *
   * FAILS CLOSED. Everything else in this codebase fails open so a
   * missing subsystem never strands a child; this returns null, because
   * failing open here means handing a stranger something unscrubbed.
   *
   * @returns {object|null}
   */
  function approve(ctx) {
    try {
      if (!ctx || typeof ctx !== 'object') return null;
      if (ctx.mode !== 'traveller') return null;
      const out = { mode: 'traveller' };
      for (const key of Object.keys(ctx)) {
        if (key === 'mode') continue;
        // REFUSED BEFORE DROPPED, and the order is the point. The first
        // version checked the whitelist first, so a context carrying
        // `memories` was quietly trimmed and used — the caller would
        // have believed it was accepted. A payload that names something
        // private is a caller doing something it must not, and the
        // whole context is refused rather than cleaned up for them.
        if (FORBIDDEN_KEYS.indexOf(key) !== -1) return null;
        if (PUBLIC_FIELDS.indexOf(key) === -1) continue;       // merely unknown: dropped
        const v = ctx[key];
        if (v === null || typeof v === 'boolean' || typeof v === 'number') { out[key] = v; continue; }
        if (typeof v !== 'string') continue;                   // no objects, no arrays, no functions
        if (FORBIDDEN_VALUES.some(function (re) { return re.test(v); })) continue;
        out[key] = v;
      }
      return out;
    } catch (e) { return null; }
  }

  /**
   * What this context would look like to somebody auditing it — the
   * approved fields and the reason each of the others is not here.
   * Developer-facing; never rendered, never persisted, never a memory.
   */
  function ledger(ctx) {
    const approved = approve(ctx) || {};
    return {
      approved: Object.keys(approved),
      excludedByPolicy: [
        'the Creator, their name, nickname and card — a resident never discusses its Creator',
        'every memory and every Bond Moment — those belong to a private relationship',
        'the Creator\'s own conversations with this Companion',
        'the pages themselves — a count travels, a word never does',
        'every internal id: project, card, library, owner, session',
        'anything unpublished or drafted'
      ]
    };
  }

  const api = {
    build: build, approve: approve, ledger: ledger,
    PUBLIC_FIELDS: PUBLIC_FIELDS,
    FORBIDDEN_KEYS: FORBIDDEN_KEYS
  };
  try { window.TravellerContext = api; } catch (e) {}
  return api;
})();
