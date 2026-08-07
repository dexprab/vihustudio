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
//   revealStages(slide) → [{slide, label, holdMs, kind, arrivalId}, …]
//
// Every entry carries a slide the renderer can draw as-is, so the
// caller never needs to know how a stage was built. The list is
// ordered, always ends on the finished page, and is never empty
// for a real slide.
//
// `kind` names WHAT arrives in that frame ('blank' | 'world' |
// 'artwork' | 'decorations' | 'text'), so the caller can choose an
// animation for it without re-deriving the beat. It is the only
// thing M4 needed from this module beyond the stages themselves.
//
// `arrivalId` names WHICH object arrived, when exactly one did. It
// is the id that object carries in SlideRenderer's own render tree,
// so the caller can look up where it landed and animate that region
// alone rather than crossfading the whole frame. `null` means the
// frame is not about a single object (the blank page, a grouped
// remainder, a layer with no id of its own), and the caller falls
// back to the whole-frame crossfade — which is the honest reading.
//
// A stage's `slide` may be the caller's own object (the final
// stage always is) or a clone. This module NEVER mutates the slide
// it is handed — that guarantee is what lets it run during Publish
// with zero risk to the page the child is looking at.
//
// SPRINT STATUS — M2 (Layer Decomposition) implements the real
// stages. M3 (Frame Rendering) draws each stage's slide to a
// bitmap. M4 (Magic Animation) adds `kind` and splits the Words
// beat into word-by-word steps, which is the one part of the
// roadmap's animation language that cannot live in the composer:
// a crossfade between "no text" and "all the text" has no way to
// produce the words in between, so the frames have to exist.
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

  // One step of the Words beat. Deliberately brief — words should
  // look written, not presented one slide at a time.
  const WORD_HOLD_MS=140;

  // How many steps the Words beat is allowed to take. A cap rather
  // than a word-per-frame rate, because every step is a real
  // full-size canvas: M3 owns a genuine memory budget (~8 MB per
  // frame at 1080×1920), so a wordy page must not be allowed to
  // mint forty of them. Eight already reads as writing.
  const MAX_WORD_STEPS=8;

  // How many steps a beat may take bringing its objects in one at a
  // time. Two pictures should arrive as two moments, not one — that
  // is the whole point of per-object staging — but a page with twenty
  // stickers must not mint twenty full-size canvases (M3's own memory
  // budget). Four already reads as "these were placed one by one";
  // anything past it arrives together in the beat's last step, and
  // M8's frame budget can thin the result further on a long book.
  //
  // A beat therefore takes exactly min(objectCount, 4) steps, and
  // never a step where nothing new arrives.
  const MAX_ARRIVALS_PER_GROUP=4;

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

  // A story-owned sticker's identity for staging. Every sticker
  // SceneEngine creates carries an id; the index fallback only ever
  // matters for a hand-built object, and keeping the two enumerations
  // (arrival list and stage filter) on one function is what stops
  // them drifting apart.
  function _stickerKey(st,i){
    return (st && st.id) ? st.id : ('#'+i);
  }

  // Place selection ids are index-based ('image-holder' for Place 1,
  // then 'image-place-N'), so sort by that trailing number to bring
  // the pictures in the order the Theme Author laid the Places out.
  function _placeIndex(id){
    const m=/(\d+)$/.exec(String(id||''));
    return m ? parseInt(m[1],10) : 0;
  }

  // Every picture this page's Artwork beat brings in, in the order it
  // should arrive, keyed by the id each one carries in SlideRenderer's
  // own render tree.
  //
  // A Scene blueprint page (Cover / Hook / End) is enumerated by its
  // image-holder ELEMENTS: on those pages the picture IS the holder,
  // so hiding the element hides the picture, and counting Places as
  // well would double-count the same thing.
  function _artworkArrivals(slide){
    const holders=_sceneElements(slide).filter(function(el){
      return el && el.visible!==false && el.type==='image-holder';
    });
    if(holders.length){
      return holders.map(function(el){ return {id:el.id,scene:true}; });
    }
    const out=[];
    if(slide.image && slide.image.width) out.push({id:'image-holder'});
    const pi=slide._placeImages;
    if(pi){
      Object.keys(pi).filter(function(k){ return !!pi[k]; }).sort(function(a,b){
        return _placeIndex(a)-_placeIndex(b);
      }).forEach(function(k){ out.push({id:k}); });
    }
    return out;
  }

  // Everything the Decorations beat brings in, in paint order: the
  // page's own blueprint decorations first, then the stickers the
  // child placed on top.
  function _decorationArrivals(slide){
    const out=[];
    _sceneElements(slide).forEach(function(el){
      if(!el || el.visible===false) return;
      if(SCENE_TYPE_GROUP[el.type]!=='decorations') return;
      out.push({id:el.id,scene:true});
    });
    _stickers(slide).forEach(function(st,i){
      if(_stickerGroup(st)!=='decorations') return;
      out.push({id:_stickerKey(st,i)});
    });
    return out;
  }

  function _hasArtwork(slide){
    if(slide.image && slide.image.width) return true;
    const pi=slide._placeImages;
    if(pi){ for(const k in pi){ if(pi[k]) return true; } }
    return false;
  }

  // The active World's own Layer Pack for THIS page, scope-filtered
  // exactly the way renderer/slideRenderer.js's _activeLayerPack
  // builds it — same source, same filter, same order. Keeping the two
  // in step matters because a partial World stage identifies its
  // layers by their INDEX into this array (see _worldArrivals).
  function _worldLayers(slide){
    let theme=null;
    try{
      if(typeof ThemeEngine!=='undefined'){
        if(typeof ThemeEngine.getActiveArtworkTheme==='function') theme=ThemeEngine.getActiveArtworkTheme();
        if(!theme && typeof ThemeEngine.getActiveTheme==='function') theme=ThemeEngine.getActiveTheme();
      }
    }catch(e){}
    const pack=(theme && Array.isArray(theme.layerPack)) ? theme.layerPack : null;
    if(!pack || !pack.length) return [];
    const layoutId=(slide.metadata && slide.metadata.layout) || null;
    return pack.filter(function(l){ return !l || !l.scope || l.scope===layoutId; });
  }

  // Everything the World beat brings in, in the pack's own order —
  // which IS paint order, so a full-bleed background arrives first
  // and the furniture standing on it follows.
  //
  // Each arrival carries BOTH keys it needs, because they are not the
  // same thing: `id` is what the layer carries in SlideRenderer's own
  // render tree (so the caller can find where it landed), and `index`
  // is its position in the scope-filtered pack (so a partial stage can
  // name it without this module and the renderer having to agree on a
  // keying scheme). An entry with no id of its own still stages
  // correctly by index; it simply never gets the arrival motion,
  // exactly as a keyless sticker already doesn't.
  //
  // An invisible layer is skipped: it would be a step where nothing
  // arrives, which this module never produces.
  function _worldArrivals(slide){
    const out=[];
    _worldLayers(slide).forEach(function(l,i){
      if(!l || l.visible===false) return;
      out.push({id:(l.id||('#'+i)), index:i});
    });
    return out;
  }

  // Does the active World actually place any furniture on THIS page?
  // One enumeration, so the beat can never appear without arrivals to
  // fill it, or vice versa.
  function _hasWorldFurniture(slide){
    return _worldArrivals(slide).length>0;
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

  // Hide every picture on the page except the ones whose arrival ids
  // are in `shownSet`. `null` means the whole beat has arrived.
  function _applyArtwork(clone,slide,shownSet){
    if(shownSet===null) return;

    if(shownSet.size===0){
      clone.image=null;
      clone._imageDataURL=null;
      clone._placeImages=null;
      // Stripping the picture is precisely what makes the renderer
      // fall through to its "Tap to add your artwork" dashed
      // placeholder — real authoring chrome, and the one thing a
      // Magic Creation must never show (product acceptance test 3).
      clone._magicSuppressPlaceholders=true;
      _hideSceneGroup(clone,'artwork');
      return;
    }

    const arrivals=_artworkArrivals(slide);
    const missing=arrivals.filter(function(a){ return !shownSet.has(a.id); });
    if(!missing.length) return;

    // Some Places are still waiting, so the placeholder guard applies
    // to a partial stage exactly as it does to an empty one.
    clone._magicSuppressPlaceholders=true;
    let placeMap=null;
    missing.forEach(function(a){
      if(a.scene){ try{ SceneEngine.setVisibility(clone,a.id,false); }catch(e){} return; }
      if(a.id==='image-holder'){ clone.image=null; clone._imageDataURL=null; return; }
      // _cloneSlide is a shallow copy, so clone._placeImages is still
      // the CALLER's own object — deleting a key from it would mutate
      // their slide. Build a fresh one instead.
      if(placeMap===null) placeMap=Object.assign({},slide._placeImages||{});
      delete placeMap[a.id];
    });
    if(placeMap!==null) clone._placeImages=placeMap;
  }

  // The same, for the page's blueprint decorations. Stickers are
  // filtered separately (they live in an array the stage rewrites
  // wholesale), using the same shown set.
  function _applyDecorations(clone,slide,shownSet){
    if(shownSet===null) return;
    if(shownSet.size===0){ _hideSceneGroup(clone,'decorations'); return; }
    _decorationArrivals(slide).forEach(function(a){
      if(shownSet.has(a.id) || !a.scene) return;
      try{ SceneEngine.setVisibility(clone,a.id,false); }catch(e){}
    });
  }

  // Build the page as it looks once `on` (a set of group ids) have
  // arrived and nothing else has.
  //
  // `shown` optionally narrows a beat that is only PART way through:
  // shown[group] is the set of arrival ids visible so far. A group
  // absent from `shown` behaves as before — wholly there or wholly
  // gone, according to `on`.
  function _stageSlide(slide,on,shown){
    const clone=_cloneSlide(slide);
    shown=shown||{};

    function setFor(group){
      if(!on[group]) return new Set();
      return (shown[group]!==undefined) ? shown[group] : null;
    }
    const artSet=setFor('artwork');
    const decSet=setFor('decorations');
    const worldSet=setFor('world');

    // The World's own Layer Pack furniture. Set as markers rather than
    // by filtering the theme: the resolved theme is shared module state
    // inside ThemeEngine, and a Magic stage must never reach into it.
    // renderer/slideRenderer.js's _activeLayerPack honours both and is
    // a no-op without them.
    //
    // A partial stage names its layers by INDEX into the scope-filtered
    // pack rather than by id, so this module and the renderer never
    // have to agree on a keying scheme — see _worldArrivals.
    if(worldSet && worldSet.size===0){
      clone._magicHideLayerPack=true;
    }else if(worldSet){
      clone._magicLayerPackShown=_worldArrivals(slide)
        .filter(function(a){ return worldSet.has(a.id); })
        .map(function(a){ return a.index; });
    }

    _applyArtwork(clone,slide,artSet);
    _applyDecorations(clone,slide,decSet);

    if(!on.text){
      clone.storyBeat='';
      _hideSceneGroup(clone,'text');
    }

    const sts=_stickers(slide);
    if(sts.length){
      clone.metadata.stickers=sts.filter(function(st,i){
        const g=_stickerGroup(st);
        if(!on[g]) return false;
        if(g==='decorations' && decSet && !decSet.has(_stickerKey(st,i))) return false;
        return true;
      });
    }

    return clone;
  }

  // ---------- the Words beat, word by word ----------

  function _words(s){
    if(typeof s!=='string') return [];
    const t=s.trim();
    return t ? t.split(/\s+/) : [];
  }

  // Everything on this page that the Words beat writes out: the
  // story beat, plus every story-owned text sticker.
  //
  // Scene blueprint text-holders (Cover / Hook / End pages) are
  // NOT truncated — their content is resolved through SceneEngine's
  // own text sources rather than sitting on the element, so they
  // arrive whole with the first word step. A disclosed limitation
  // rather than an oversight: those pages carry a title, not prose,
  // and a title appearing at once is the right reading anyway.
  function _textSources(slide){
    const out=[];
    const beat=_words(slide.storyBeat);
    if(beat.length) out.push({key:'beat',words:beat});
    _stickers(slide).forEach(function(st,i){
      if(!st || st.kind!=='text') return;
      const w=_words(st.text);
      if(w.length) out.push({key:'sticker',index:i,words:w});
    });
    return out;
  }

  // The page with every text source filled in to `frac` of its own
  // words. Sources fill together rather than one after another: on
  // the common single-block page the two are identical, and on a
  // page with several blocks "the words are appearing" reads better
  // than one block finishing before the next starts.
  function _wordStageSlide(slide,on,srcs,frac){
    const clone=_stageSlide(slide,on);
    const originals=_stickers(slide);
    srcs.forEach(function(src){
      const n=Math.max(1,Math.ceil(src.words.length*frac));
      const shown=src.words.slice(0,n).join(' ');
      if(src.key==='beat'){ clone.storyBeat=shown; return; }
      const sts=clone.metadata.stickers;
      if(!Array.isArray(sts)) return;
      // The stage clone's sticker array is a FILTERED copy of the
      // caller's, so positions don't line up — find by identity.
      const orig=originals[src.index];
      const at=sts.indexOf(orig);
      if(at<0) return;
      sts[at]=Object.assign({},orig,{text:shown});
    });
    return clone;
  }

  // ---------- per-object staging ----------

  // Split a beat's objects into the steps it should take. Each step
  // carries the full set of arrival ids visible by the END of it, and
  // the single id that arrived DURING it (null when several did).
  //
  // A beat takes min(objectCount, MAX_ARRIVALS_PER_GROUP) steps and
  // never a step where nothing new arrives: past the cap, everything
  // still waiting comes in together in the last one.
  function _arrivalSteps(arrivals){
    const n=arrivals.length;
    if(!n) return [];
    const ids=arrivals.map(function(a){ return a.id; });
    if(n===1) return [{ids:ids,arrivalId:ids[0]}];

    const steps=[];
    const cap=Math.min(n,MAX_ARRIVALS_PER_GROUP);
    for(let i=0;i<cap-1;i++){
      steps.push({ids:ids.slice(0,i+1),arrivalId:ids[i]});
    }
    // The last step brings in whatever is left. When that is a single
    // object it keeps its own arrival motion; when several land at
    // once the caller falls back to the whole-frame crossfade.
    const remaining=n-(cap-1);
    steps.push({ids:ids,arrivalId:(remaining===1)?ids[n-1]:null});
    return steps;
  }

  // ---------- the contract ----------

  // revealStages(slide) → [{slide, label, holdMs, kind, arrivalId}, …]
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
  //
  // The Words beat is the one exception: it arrives over several
  // frames rather than one, and the last of those is the finished
  // page. Because GROUP_ORDER puts text last, those word steps are
  // always the tail of the reveal.
  //
  // The World, Artwork and Decorations beats all stage PER OBJECT:
  // two pictures are two moments, not one, which is what makes the
  // reveal read as a page being built rather than a page fading in.
  // The World's own furniture stages the same way — the wall arrives,
  // then the frame that hangs on it — because the page a child sees
  // was assembled that way too, and a backdrop that snaps in whole
  // reads as a slide template rather than as a place.
  function revealStages(slide){
    if(!slide) return [];

    const groups=_activeGroups(slide);
    if(groups.length===0){
      return [{slide:slide,label:FINISHED_LABEL,holdMs:FINISHED_HOLD_MS,kind:'blank',arrivalId:null}];
    }

    const stages=[{slide:_stageSlide(slide,{}),label:BLANK_LABEL,holdMs:STAGE_HOLD_MS,kind:'blank',arrivalId:null}];
    for(let i=0;i<groups.length;i++){
      const g=groups[i];
      const isLast=(i===groups.length-1);
      const on={};
      for(let j=0;j<=i;j++) on[groups[j]]=true;

      if(g==='text'){
        const srcs=_textSources(slide);
        const most=srcs.reduce(function(n,s){ return Math.max(n,s.words.length); },0);
        const steps=Math.max(1,Math.min(MAX_WORD_STEPS,most));
        for(let k=1;k<=steps;k++){
          const done=(k===steps);
          stages.push({
            slide:(done&&isLast)?slide:_wordStageSlide(slide,on,srcs,k/steps),
            label:(done&&isLast)?FINISHED_LABEL:GROUP_LABELS.text,
            holdMs:(done&&isLast)?FINISHED_HOLD_MS:WORD_HOLD_MS,
            kind:'text',
            arrivalId:null
          });
        }
        continue;
      }

      const arrivals=(g==='artwork') ? _artworkArrivals(slide)
                   : (g==='decorations') ? _decorationArrivals(slide)
                   : (g==='world') ? _worldArrivals(slide)
                   : [];
      const steps=_arrivalSteps(arrivals);

      if(!steps.length){
        // A beat whose objects this module cannot name individually —
        // one stage, exactly as before.
        stages.push(isLast
          ? {slide:slide,label:FINISHED_LABEL,holdMs:FINISHED_HOLD_MS,kind:g,arrivalId:null}
          : {slide:_stageSlide(slide,on),label:GROUP_LABELS[g],holdMs:STAGE_HOLD_MS,kind:g,arrivalId:null});
        continue;
      }

      steps.forEach(function(step,k){
        const done=(k===steps.length-1);
        const shown={};
        shown[g]=new Set(step.ids);
        stages.push({
          slide:(done&&isLast)?slide:_stageSlide(slide,on,shown),
          label:(done&&isLast)?FINISHED_LABEL:GROUP_LABELS[g],
          holdMs:(done&&isLast)?FINISHED_HOLD_MS:STAGE_HOLD_MS,
          kind:g,
          arrivalId:step.arrivalId
        });
      });
    }
    return stages;
  }

  // Trim a reveal down to a frame budget (M8).
  //
  // Every stage is a real full-size canvas, and the publish pipeline
  // holds ALL of a story's frames at once, so a long book's reveal has
  // to be allowed to get simpler — otherwise a 12-page story mints 144
  // canvases (~1.1 GB, measured) and films for 74 seconds, which is
  // both a memory ceiling and, per the architecture's own pacing note,
  // a reveal that is endured rather than rewatched.
  //
  // The first stage (the blank page) and the last (the finished page)
  // are ALWAYS kept — they are the two frames the reveal is actually
  // about — and the middle is sampled evenly, so a trimmed reveal is
  // a brisker version of the same story rather than a truncated one.
  // A page is never dropped: this only ever thins one page's stages.
  function fitToBudget(stages,maxFrames){
    if(!stages||!stages.length) return [];
    const n=stages.length;
    const max=Math.floor(maxFrames);
    if(!(max>0)) return [stages[n-1]];
    if(max>=n) return stages;
    if(max===1) return [stages[n-1]];
    const out=[];
    let prev=-1;
    for(let i=0;i<max;i++){
      const idx=Math.round(i*(n-1)/(max-1));
      const st=stages[idx];
      // Dropping a stage widens the gap the NEXT kept frame has to
      // cover, so that frame no longer brings one object — it brings
      // everything the dropped stages would have. `arrivalId` names a
      // single arrival, so it stops being true the moment that
      // happens, and the caller falls back to the whole-frame
      // crossfade, which is the honest reading of "several things
      // appeared at once". Copied rather than edited in place: these
      // are the caller's own stage objects.
      if(prev>=0 && idx-prev>1 && st && st.arrivalId){
        out.push(Object.assign({},st,{arrivalId:null}));
      }else{
        out.push(st);
      }
      prev=idx;
    }
    return out;
  }

  const api={
    revealStages:revealStages,
    fitToBudget:fitToBudget,
    FINISHED_HOLD_MS:FINISHED_HOLD_MS,
    STAGE_HOLD_MS:STAGE_HOLD_MS,
    WORD_HOLD_MS:WORD_HOLD_MS,
    MAX_WORD_STEPS:MAX_WORD_STEPS,
    MAX_ARRIVALS_PER_GROUP:MAX_ARRIVALS_PER_GROUP,
    // Exposed for verification only — the reveal's own beat list for
    // a page, and the objects each staged beat brings in, without
    // building any clones.
    _activeGroups:_activeGroups,
    _artworkArrivals:_artworkArrivals,
    _decorationArrivals:_decorationArrivals,
    _worldArrivals:_worldArrivals
  };
  try{ window.MagicReveal=api; }catch(e){}
  return api;
})();
