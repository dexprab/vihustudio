// =============================================================
// VihuStudio — Magic Reveal (Magic Publish, Sprint M2)
// -------------------------------------------------------------
// Peels a finished page apart into the stages that make up its
// own Magic Creation. A pure function of the FINAL saved state —
// no history, no timeline, no snapshots, nothing hooked into
// autosave or AppState. See docs/MAGIC_PUBLISH_ARCHITECTURE.md §0:
// the reveal is a choreographed decomposition of the finished
// page by layer, not a record of what a child actually did.
//
// That distinction is the whole design. A truthful history replay
// would show forty nudges, a colour changed six times, and a
// sticker deleted twice — honest, and boring. A layer reveal is
// always a clean story, on every page, for every child, including
// the child who made the page in ninety seconds.
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
// A stage's `slide` may be the caller's own object (the final
// stage always is) or a clone. This module NEVER mutates the slide
// it is handed — that guarantee is what lets it run during Publish
// with zero risk to the page the child is looking at.
//
// SPRINT STATUS — M2 (Layer Decomposition) implements the real
// stages. M3 (Frame Rendering) draws each stage's slide to a
// bitmap; until then js/storyDestinations.js still encodes only
// the final stage, so Magic Publish's own output is unchanged.
// =============================================================

const MagicReveal=(function(){
  'use strict';

  // How long the finished page rests on screen before the story
  // moves on. Deliberately generous — the finished page is the
  // point of the whole reveal, so it is the one stage that should
  // never feel hurried.
  const FINISHED_HOLD_MS=2200;

  // Every other beat. Short enough that a four-page story stays
  // around 20-25 seconds total (architecture doc §5) — the reveal
  // should be rewatched, not endured. M4 owns the real animation
  // curve; this is the hold the frame rests at once it has
  // arrived.
  const STAGE_HOLD_MS=750;

  // The reveal, back to front. Each group is a beat that only
  // happens when the finished page actually has something for it,
  // so a page with no decorations never shows a beat where
  // nothing arrives.
  //
  //   blank        the World's own empty page — paper, wall, frame,
  //                mat. Not a group: it is always the first stage.
  //   world        the World's own furniture (captions, seals,
  //                spotlights) — everything the Theme Author placed
  //                that the child never touched.
  //   artwork      the child's picture, in its Place.
  //   decorations  everything the child placed on top — stickers,
  //                shapes, doodles, pictures, voice badges.
  //   text         the child's words.
  //
  // A story-owned picture STICKER counts as a decoration, not as
  // artwork: the Artwork beat is the Place's own picture, and
  // anything placed on top of the page is something the child
  // added afterwards. Keeping that line simple is what keeps the
  // reveal legible on an unusual page.
  const GROUP_ORDER=['world','artwork','decorations','text'];
  const GROUP_LABELS={
    world:'The World',
    artwork:'Your Picture',
    decorations:'Decorations',
    text:'Your Words'
  };
  const BLANK_LABEL='Blank Page';
  const FINISHED_LABEL='Finished';

  // Scene blueprint element types (Cover / Hook / End pages), mapped
  // onto the beat that brings each one in. A `frame` element is the
  // page's own furniture and is never hidden — it belongs to Blank.
  const SCENE_TYPE_GROUP={
    'image-holder':'artwork',
    'decoration':'decorations',
    'sticker':'decorations',
    'text-holder':'text',
    'text':'text'
  };

  // ---------- read helpers (never mutate) ----------

  function _sceneElements(slide){
    try{
      if(typeof SceneEngine!=='undefined' && typeof SceneEngine.listElements==='function'){
        return SceneEngine.listElements(slide)||[];
      }
    }catch(e){}
    return [];
  }

  function _stickers(slide){
    const m=slide && slide.metadata;
    return (m && Array.isArray(m.stickers)) ? m.stickers : [];
  }

  // A story-owned sticker's own beat. Only a text sticker waits for
  // the Words beat; everything else (glyph, shape, doodle, picture,
  // voice badge) arrives with the Decorations.
  function _stickerGroup(st){
    return (st && st.kind==='text') ? 'text' : 'decorations';
  }

  function _hasArtwork(slide){
    if(slide.image && slide.image.width) return true;
    const pi=slide._placeImages;
    if(pi){ for(const k in pi){ if(pi[k]) return true; } }
    return false;
  }

  // Does the active World actually place any furniture on THIS page?
  // Mirrors renderer/slideRenderer.js's own _activeLayerPack scope
  // filter, so the beat only appears when something would genuinely
  // arrive during it.
  function _hasWorldFurniture(slide){
    let theme=null;
    try{
      if(typeof ThemeEngine!=='undefined'){
        if(typeof ThemeEngine.getActiveArtworkTheme==='function') theme=ThemeEngine.getActiveArtworkTheme();
        if(!theme && typeof ThemeEngine.getActiveTheme==='function') theme=ThemeEngine.getActiveTheme();
      }
    }catch(e){}
    const pack=(theme && Array.isArray(theme.layerPack)) ? theme.layerPack : null;
    if(!pack || !pack.length) return false;
    const layoutId=(slide.metadata && slide.metadata.layout) || null;
    return pack.some(function(l){
      return l && l.visible!==false && (!l.scope || l.scope===layoutId);
    });
  }

  // Which beats this page actually has something for, in order.
  function _activeGroups(slide){
    const els=_sceneElements(slide);
    const sts=_stickers(slide);
    const has={};

    if(_hasWorldFurniture(slide)) has.world=true;
    if(_hasArtwork(slide)) has.artwork=true;
    if(typeof slide.storyBeat==='string' && slide.storyBeat.length) has.text=true;

    els.forEach(function(el){
      if(!el || el.visible===false) return;
      const g=SCENE_TYPE_GROUP[el.type];
      if(g) has[g]=true;
    });
    sts.forEach(function(st){ has[_stickerGroup(st)]=true; });

    return GROUP_ORDER.filter(function(g){ return !!has[g]; });
  }

  // ---------- clone helpers ----------

  // A stage clone shares the caller's own Image objects (an
  // HTMLImageElement can't be deep-copied, and doesn't need to be —
  // a stage either shows a picture or hides it, never edits one) but
  // owns its own copies of the two bags a stage actually rewrites.
  function _cloneMeta(m){
    if(!m || typeof m!=='object') return {};
    const out=Object.assign({},m);
    out.elementOverrides={};
    const eo=m.elementOverrides||{};
    Object.keys(eo).forEach(function(k){ out.elementOverrides[k]=Object.assign({},eo[k]); });
    if(Array.isArray(m.stickers)) out.stickers=m.stickers.slice();
    return out;
  }

  function _cloneSlide(slide){
    const c=Object.assign({},slide);
    c.metadata=_cloneMeta(slide.metadata);
    return c;
  }

  function _hideSceneGroup(clone,group){
    const els=_sceneElements(clone);
    if(!els.length) return;
    els.forEach(function(el){
      if(!el || el.visible===false) return;
      if(SCENE_TYPE_GROUP[el.type]!==group) return;
      try{ SceneEngine.setVisibility(clone,el.id,false); }catch(e){}
    });
  }

  // Build the page as it looks once `on` (a set of group ids) have
  // arrived and nothing else has.
  function _stageSlide(slide,on){
    const clone=_cloneSlide(slide);

    if(!on.world){
      // The World's own Layer Pack furniture. Set as a marker rather
      // than by filtering the theme: the resolved theme is shared
      // module state inside ThemeEngine, and a Magic stage must never
      // reach into it. renderer/slideRenderer.js's _activeLayerPack
      // honours this on the payload and is a no-op without it.
      clone._magicHideLayerPack=true;
    }

    if(!on.artwork){
      clone.image=null;
      clone._imageDataURL=null;
      clone._placeImages=null;
      // Stripping the picture is precisely what makes the renderer
      // fall through to its "Tap to add your artwork" dashed
      // placeholder — real authoring chrome, and the one thing a
      // Magic Creation must never show (product acceptance test 3).
      clone._magicSuppressPlaceholders=true;
      _hideSceneGroup(clone,'artwork');
    }

    if(!on.decorations) _hideSceneGroup(clone,'decorations');

    if(!on.text){
      clone.storyBeat='';
      _hideSceneGroup(clone,'text');
    }

    const sts=_stickers(slide);
    if(sts.length){
      clone.metadata.stickers=sts.filter(function(st){ return !!on[_stickerGroup(st)]; });
    }

    return clone;
  }

  // ---------- the contract ----------

  // revealStages(slide) → [{slide, label, holdMs}, …]
  //
  // `label` is a short, kid-facing name for the stage. It is not
  // drawn anywhere today; it exists so the Magic Strip (M5) can
  // caption its frames from the same list that drives the video,
  // rather than deriving captions a second time.
  //
  // The last entry's `slide` is ALWAYS the caller's own object, so
  // the finished frame is the real page and not a reconstruction of
  // it. The last arriving group never gets a stage of its own —
  // that frame IS the finished page, and showing it twice under two
  // labels would be a beat where nothing happens.
  function revealStages(slide){
    if(!slide) return [];

    const groups=_activeGroups(slide);
    if(groups.length===0){
      return [{slide:slide,label:FINISHED_LABEL,holdMs:FINISHED_HOLD_MS}];
    }

    const stages=[{slide:_stageSlide(slide,{}),label:BLANK_LABEL,holdMs:STAGE_HOLD_MS}];
    for(let i=0;i<groups.length;i++){
      if(i===groups.length-1){
        stages.push({slide:slide,label:FINISHED_LABEL,holdMs:FINISHED_HOLD_MS});
      }else{
        const on={};
        for(let j=0;j<=i;j++) on[groups[j]]=true;
        stages.push({slide:_stageSlide(slide,on),label:GROUP_LABELS[groups[i]],holdMs:STAGE_HOLD_MS});
      }
    }
    return stages;
  }

  const api={
    revealStages:revealStages,
    FINISHED_HOLD_MS:FINISHED_HOLD_MS,
    STAGE_HOLD_MS:STAGE_HOLD_MS,
    // Exposed for verification only — the reveal's own beat list for
    // a page, without building any clones.
    _activeGroups:_activeGroups
  };
  try{ window.MagicReveal=api; }catch(e){}
  return api;
})();
