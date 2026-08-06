// =============================================================
// VihuStudio — Magic Reveal (Magic Publish, Sprint M1)
// -------------------------------------------------------------
// Peels a finished page apart into the stages that make up its
// own Magic Creation. A pure function of the FINAL saved state —
// no history, no timeline, no snapshots, nothing hooked into
// autosave or AppState. See docs/MAGIC_PUBLISH_ARCHITECTURE.md §0:
// the reveal is a choreographed decomposition of the finished
// page by layer, not a record of what a child actually did.
//
// Contract (stable across the whole M1-M9 roadmap):
//
//   revealStages(slide) → [{slide, label, holdMs}, …]
//
// Every entry carries a slide the renderer can draw as-is, so the
// caller never needs to know how a stage was built. The list is
// ordered, always ends on the finished page, and is never empty
// for a real slide.
//
// A stage's `slide` may be the caller's own object (when nothing
// was stripped) or a clone. This module NEVER mutates the slide it
// is handed — that guarantee is what lets it run during Publish
// with zero risk to the page the child is looking at.
//
// SPRINT STATUS — M1 (foundation) ships the contract and the
// plumbing only: revealStages() returns the single Finished stage,
// so Magic Publish produces a real, working, deliberately
// non-magical video end to end. M2 (Layer Decomposition) fills in
// the real Blank → World → Artwork → Decorations → Text → Finished
// stages behind this same signature, with no plumbing changes
// anywhere downstream.
// =============================================================

const MagicReveal=(function(){
  'use strict';

  // How long the finished page rests on screen before the story
  // moves on. Deliberately generous — the finished page is the
  // point of the whole reveal, so it is the one stage that should
  // never feel hurried.
  const FINISHED_HOLD_MS=2200;

  // revealStages(slide) → [{slide, label, holdMs}, …]
  //
  // `label` is a short, kid-facing name for the stage. It is not
  // drawn anywhere today; it exists so the Magic Strip (M5) can
  // caption its frames from the same list that drives the video,
  // rather than deriving captions a second time.
  function revealStages(slide){
    if(!slide) return [];
    return [
      { slide:slide, label:'Finished', holdMs:FINISHED_HOLD_MS }
    ];
  }

  const api={
    revealStages:revealStages,
    FINISHED_HOLD_MS:FINISHED_HOLD_MS
  };
  try{ window.MagicReveal=api; }catch(e){}
  return api;
})();
