// themePresets.js — Sprint 9.5 Theme Language v2.
//
// ThemePresets is the new layer this sprint adds between a theme's own
// fields and the hardcoded system defaults ThemeEngine / SlideRenderer
// already fall back to. It does not replace ThemeRegistry, ThemeEngine
// or WorkspaceBuilder — none of those are redesigned — it just gives a
// theme a third, optional way to describe itself:
//
//   Presentation Preset  ->  Theme Overrides  ->  System Defaults
//
// A theme opts in by naming a preset id on the scope it wants to
// describe with intent instead of properties:
//   theme.slide  = { presentation:'comic' }   // Story Theme, page furniture
//   theme.holder = { presentation:'comic' }   // Story Theme, picture holder look
//                                              // (the sprint's "Frame" scope — named
//                                              // `holder` to match themeOptions.holder,
//                                              // NOT the pre-existing theme.frame field,
//                                              // which is the book's outer frame COLOR)
//   art.presentation = 'sketchbook'            // Artwork Theme (Sprint 9.3 field, reused)
// Any field the theme also spells out explicitly next to `presentation`
// is an override and wins over the preset's value for that field only
// — "If necessary, support only the override changes" (sprint spec).
//
// A theme with no `presentation` value (every theme before this sprint,
// and any theme that still prefers to spell out every field) resolves
// exactly as it always has: resolve() with an unknown/absent presetId
// just returns the overrides object unchanged, so callers' existing
// System Default fallbacks (e.g. SlideRenderer's ARTWORK_FRAME_PRESET
// lookups, or ThemeEngine's hardcoded _defaultOptionsFor values) are
// the only thing that ever runs for them — zero behaviour change.
//
// Scope: this module holds preset TABLES + a merge helper. It does not
// touch rendering itself (SlideRenderer) or storage (ThemeRegistry) or
// panel layout (WorkspaceBuilder) — each of those calls in to resolve()
// a value it already knows how to consume.
const ThemePresets=(function(){
  'use strict';

  // ---------- Slide presentation presets ----------
  // Fill the same keys ThemeEngine._defaultOptionsFor() has always
  // hardcoded per-theme identically (panelStyle/footerStyle/pageNumber/
  // bookTitle*/handle*/decorations). 'storybook' reproduces today's
  // hardcoded values field-for-field — it is a documentation preset for
  // the app's default theme, not a behaviour change (see CLAUDE.md:
  // Storybook Classic must keep rendering exactly as today for every
  // project that has never touched Theme Designer).
  const SLIDE_PRESETS={
    storybook:{
      meta:{displayName:'Storybook',description:'Warm, traditional page furniture.'},
      panelStyle:'classic', footerStyle:'classic', pageNumber:'bottom-right',
      bookTitleVisibility:'show', bookTitlePosition:'bottom-left',
      handleVisibility:'show', handlePosition:'top-right',
      decorations:[]
    },
    comic:{
      meta:{displayName:'Comic',description:'Bold, centered, high-energy page furniture.'},
      panelStyle:'rounded', footerStyle:'minimal', pageNumber:'bottom-center',
      bookTitleVisibility:'show', bookTitlePosition:'bottom-center',
      handleVisibility:'show', handlePosition:'top-right',
      decorations:[]
    }
  };

  // ---------- Frame presentation presets ----------
  // Fill ThemeEngine's Picture Holder Defaults (themeOptions.holder —
  // cornerRadius/padding/shadow), the same schema SlideRenderer's
  // _resolveBorder already reads. 'storybook' is `{}` — today's system
  // default for every theme — again a documentation no-op, not a
  // behaviour change.
  const FRAME_PRESETS={
    storybook:{
      meta:{displayName:'Storybook',description:'No border — the page speaks for itself.'}
    },
    comic:{
      meta:{displayName:'Comic',description:'Square panel, plain white ground, no shadow.'},
      cornerRadius:0, padding:8, shadow:false, fill:'white'
    }
  };

  // ---------- Holder presentation presets ----------
  // One table per holder type. `image` is the Sprint 9.3 Artwork Theme
  // field set (background/frame/paper/caption/shadow/lighting/
  // composition) — see renderer/slideRenderer.js _artworkBorder for
  // where these resolve into the render. `text` / `sticker` / `button`
  // are additive, empty slots: "Future holder types should
  // automatically inherit the same architecture" without this module
  // changing shape when they get real presets.
  //
  // `editorControls` is metadata WorkspaceBuilder reads as a fallback
  // control list for a theme that names a presentation but authors no
  // `editor` block of its own (Classroom Display, Scrapbook) — see
  // js/workspaceBuilder.js _presetEditorFallback. A theme with its own
  // explicit `editor` block (Museum Gallery, Sketchbook, Watercolor
  // Portfolio) ignores this entirely; it is never a second source of
  // truth for a panel that already has one.
  const HOLDER_PRESETS={
    image:{
      gallery:{
        meta:{displayName:'Museum Gallery',description:'A quiet gallery wall — white mat, soft light, centered.'},
        background:'white', frame:'white-mat', paper:'smooth', caption:'museum',
        shadow:'gallery', lighting:'gallery', composition:'center',
        editorControls:['presentation','lighting','caption']
      },
      sketchbook:{
        meta:{displayName:'Sketchbook',description:'Notebook paper and tape corners.'},
        background:'notebook-paper', frame:'tape', paper:'notebook', caption:'handwritten',
        shadow:'none', lighting:'none', composition:'margin',
        editorControls:['presentation','paper','artworkFrame','caption']
      },
      portfolio:{
        meta:{displayName:'Portfolio',description:'Watercolor paper, floating frame, generous margins.'},
        background:'watercolor-paper', frame:'floating', paper:'watercolor', caption:'minimal',
        shadow:'gallery', lighting:'soft', composition:'margin',
        editorControls:['presentation','lighting','caption']
      },
      classroom:{
        meta:{displayName:'Classroom',description:'Pinned to the bulletin board.'},
        background:'bulletin-board', frame:'none', paper:'smooth', caption:'student',
        shadow:'soft', lighting:'none', composition:'center',
        editorControls:['presentation','caption']
      },
      scrapbook:{
        meta:{displayName:'Scrapbook',description:'Kraft paper and tape, layered like a keepsake.'},
        background:'kraft-paper', frame:'tape', paper:'handmade', caption:'handwritten',
        shadow:'soft', lighting:'none', composition:'floating',
        editorControls:['presentation','artworkFrame','caption']
      }
    },
    text:{},
    sticker:{},
    button:{}
  };

  // Presentation Preset -> Theme Overrides. System Defaults are always
  // the next caller's own fallback (an "id or null" lookup table, a
  // hardcoded object literal, etc.) — never duplicated here.
  function resolve(table,presetId,overrides){
    const preset=(presetId && table && table[presetId]) || null;
    const out=Object.assign({}, preset||{});
    delete out.meta;
    delete out.editorControls;
    Object.assign(out, overrides||{});
    return out;
  }
  function resolveSlide(presentation,overrides){ return resolve(SLIDE_PRESETS,presentation,overrides); }
  function resolveFrame(presentation,overrides){ return resolve(FRAME_PRESETS,presentation,overrides); }
  function resolveHolder(holderType,presentation,overrides){
    return resolve(HOLDER_PRESETS[holderType]||{},presentation,overrides);
  }
  // {id, meta} for every preset in a holder table — WorkspaceBuilder's
  // Presentation control builds its option list from this instead of a
  // hardcoded array, per the sprint's "no theme-specific UI hardcoded".
  function listHolderPresets(holderType){
    const table=HOLDER_PRESETS[holderType]||{};
    return Object.keys(table).map(function(id){ return {id:id, meta:table[id].meta||{}}; });
  }

  const api={
    SLIDE_PRESETS:SLIDE_PRESETS,
    FRAME_PRESETS:FRAME_PRESETS,
    HOLDER_PRESETS:HOLDER_PRESETS,
    resolve:resolve,
    resolveSlide:resolveSlide,
    resolveFrame:resolveFrame,
    resolveHolder:resolveHolder,
    listHolderPresets:listHolderPresets
  };
  try{ window.ThemePresets=api; }catch(e){}
  return api;
})();
