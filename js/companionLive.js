// js/companionLive.js — WHAT IS HAPPENING RIGHT NOW.
//
// Step 3E. The Companion knew what a child was MAKING and had no idea
// where they were STANDING, so it could tell a child on Studio Home to
// tap something that only exists in the Story Editor. This is the
// smallest reliable answer to "where am I, what am I working on, and
// what is the date".
//
// ---------------------------------------------------------------
// IT IS LIVE CONTEXT, AND LIVE CONTEXT IS NOT MEMORY.
//
// Nothing here is stored, synced or remembered. It is read fresh on
// every turn, so walking Studio Home → Story Editor → Studio Home
// changes the answer three times and leaves nothing behind. A screen a
// child was on ten minutes ago is not a fact about them.
//
// ---------------------------------------------------------------
// A WHITELIST, NOT A SNAPSHOT.
//
// Six fields, each written out by hand and each read from a named
// source. `AppState` is not passed through, no DOM is passed through,
// and a field added to a project tomorrow cannot arrive here by being
// adjacent to one that is already allowed. What travels to a model is
// decided again by js/companionPrivacyGate.js afterwards.
const CompanionLive = (function () {
  'use strict';

  /**
   * WHICH SCREEN OWNS THE WORKSPACE RIGHT NOW.
   *
   * Asked of the document rather than inferred from what was said: the
   * application already knows, and guessing from a child's sentence is
   * exactly the thing §15 forbids.
   */
  function surface() {
    try {
      // The Ether is a different document entirely.
      if (!document.getElementById('previewCanvas')) return 'ether';
      const flow = document.getElementById('creationFlowOverlay');
      const up = flow && !flow.hidden &&
        (getComputedStyle(flow).display !== 'none');
      if (up) return 'studio-home';
      return 'story-editor';
    } catch (e) { return null; }
  }

  /**
   * THE STORY A CHILD IS WORKING ON — even on Studio Home.
   *
   * THE OBSERVED GAP (§14). `AppState.project.id` is only set once a
   * story is OPEN, so on Studio Home the Companion was asked "what am I
   * making?" with nothing to answer from. But Studio Home already knows:
   * it renders "You were making something" from the session slot. So the
   * slot is the fallback, which adds no state and no new store — it is
   * the same thing the screen the child is looking at is reading.
   *
   * @returns {{id:string|null, name:string|null, pageCount:number|null,
   *            open:boolean}|null}
   */
  function story() {
    let id = null, name = null, pages = null, open = false;
    try {
      if (typeof AppState !== 'undefined' && AppState.project && AppState.project.id) {
        id = AppState.project.id;
        name = AppState.project.bookTitle || AppState.project.title || null;
        pages = Array.isArray(AppState.slides) ? AppState.slides.length : null;
        open = true;
      }
    } catch (e) {}
    if (!id) {
      try {
        if (typeof ProjectManager !== 'undefined' && ProjectManager.getSessionStatus) {
          const info = ProjectManager.getSessionStatus();
          if (info && info.state === 'valid') {
            const p = info.data && info.data.project;
            id = (p && p.id) || null;
            name = (p && (p.bookTitle || p.title)) || info.title || null;
            pages = (typeof info.pageCount === 'number') ? info.pageCount : null;
          }
        }
      } catch (e) {}
    }
    if (!id && !name) return null;
    // 'Untitled' is the store's own placeholder, not something a child
    // called their story. Saying it back to them would be a small lie.
    if (name === 'Untitled') name = null;
    return { id: id, name: name, pageCount: pages, open: open };
  }

  /** Which page, when one is open. Zero-based, as the store counts. */
  function page() {
    try {
      if (typeof AppState === 'undefined') return null;
      if (typeof AppState.currentSlide !== 'number') return null;
      if (!AppState.project || !AppState.project.id) return null;
      return AppState.currentSlide;
    } catch (e) { return null; }
  }

  /**
   * HOW FAR THIS BROWSER IS FROM UTC, in minutes.
   *
   * THE ONLY THING SENT ABOUT WHERE A CHILD IS, and it is sent so the
   * SERVER can work out what day it is for them rather than being told.
   * A date is live context (§16) and must be trusted, so the clock is
   * the server's; the offset is the one thing the server cannot know.
   *
   * It is a coarse band of longitude at best — not a location, not an
   * identifier, and nothing that could name anybody. Without it a child
   * in New Zealand would be told yesterday's date for most of their day.
   */
  function utcOffsetMinutes() {
    try {
      const n = new Date().getTimezoneOffset();
      return (typeof n === 'number' && isFinite(n)) ? -n : null;
    } catch (e) { return null; }
  }

  /**
   * The whole of it, for a caller to send as LOCATORS. Every field is
   * something the server either cannot know or would have to be told;
   * nothing here is a fact the server can read for itself.
   */
  function locators() {
    const s = story();
    return {
      surface: surface(),
      storyId: s ? s.id : null,
      pageId: page(),
      utcOffsetMinutes: utcOffsetMinutes(),
    };
  }

  const api = {
    surface: surface,
    story: story,
    page: page,
    utcOffsetMinutes: utcOffsetMinutes,
    locators: locators,
  };
  try { window.CompanionLive = api; } catch (e) {}
  return api;
})();
