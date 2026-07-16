// objectStrip.js — Creator UI Convergence Sprint. A child-friendly
// horizontal readout of every object currently on the page, living
// beneath the canvas (see .object-strip in css/style.css).
//
// This is deliberately NOT a Layer Panel and NOT Builder's Scene Stack:
// objects render in the page's own render order with no drag handle, no
// reorder control, and no technical vocabulary anywhere in the strip.
// The words Layer / Holder / Decoration / Experience / Representation /
// Selection never appear — see FRIENDLY_TYPE below for the one small,
// closed vocabulary translation table.
//
// Creator Reconciliation Sprint — Object Strip is now a pure reader of
// the render tree (renderer/slideRenderer.js's Scene Object list,
// SlideRenderer.getSceneElements()), not a blend of directly-queried
// SceneEngine data plus a separately-patched-in Layer Pack list. If an
// object rendered, it appears here exactly once, in render order, with
// no manually-maintained de-dup bookkeeping — because there is now only
// one source. Every Scene Object already carries a uniform shape
// (id/type/label/bounds/owner/moveable/editable) regardless of whether
// it started life as a Cover/Hook/End blueprint element, a Story-Author-
// placed sticker, or a theme-authored Layer Pack entry — Object Strip
// never branches on origin, only on the object's own `owner`/`editable`
// fields. Also reuses SlideRenderer.getTextElements() (Story-role text
// furniture — Story Text/Handle/Footer/Page Number, a small fixed set,
// unrelated to Builder-authored Scene Objects) and the exact same
// window.setSelectedSceneElement/setSelectedTextElement entry points the
// canvas's own click handlers already use (js/app.js) — tapping a card
// here is indistinguishable from tapping the object on the canvas
// itself, so selection stays perfectly bidirectional with no second
// selection model.
const ObjectStrip=(function(){
  let listRoot=null;
  let cfg={
    getCurrentSlide:function(){ return null; },
    getSelectedTextElement:function(){ return null; },
    getSelectedSceneElement:function(){ return null; },
    getSelectedSceneElementType:function(){ return null; }
  };

  function configure(opts){ cfg=Object.assign({},cfg,opts||{}); }

  function init(){
    listRoot=document.getElementById('objectStripList');
    if(!listRoot) return;
    refresh();
  }

  // ---------- Friendly vocabulary — the one closed translation table.
  // A SceneEngine element's own `type` (image-holder/text-holder/text/
  // sticker/decoration) is an internal containership concept; here it
  // only ever becomes a plain, child-facing icon+name.
  const FRIENDLY_TYPE={
    'image-holder':{icon:'🖼️',name:'Picture'},
    'text-holder':{icon:'📝',name:'Text'},
    'text':{icon:'✏️',name:'Text'},
    'sticker':{icon:'✨',name:'Sticker'},
    'decoration':{icon:'🎀',name:'Decoration'}
  };
  const FRIENDLY_TEXT_ID={
    'story-text':{icon:'✏️',name:'Story Text',editable:true},
    'handle':{icon:'🔖',name:'Handle',editable:false},
    'footer':{icon:'📖',name:'Footer',editable:false},
    'page-number':{icon:'#️⃣',name:'Page Number',editable:false}
  };

  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!==undefined) e.textContent=text;
    return e;
  }

  // Honour World-Owned Object Commitments sprint — renders whatever a
  // World object's own `visual` descriptor (renderer/slideRenderer.js's
  // `_layerVisual`) actually is, instead of one generic icon per type:
  // a colour swatch for a fill, the real uploaded image for an image,
  // the real drawn shape for a shape, the real glyph for a glyph-
  // decoration/sticker, or a short content snippet for text. Falls
  // through to the existing icon/imgSrc path when there's no `visual`
  // (every non-World-owned card, and any theme predating this sprint).
  function _renderThumb(thumb,opts){
    const v=opts.visual;
    if(v && v.kind==='color'){
      thumb.style.background=v.color;
      return;
    }
    if(v && v.kind==='image' && v.src){
      const img=document.createElement('img');
      img.src=v.src;
      thumb.appendChild(img);
      return;
    }
    if(v && v.kind==='shape' && typeof SlideRenderer!=='undefined' && typeof SlideRenderer.drawObjectThumbnail==='function'){
      const size=44;
      const canvas=document.createElement('canvas');
      canvas.width=size; canvas.height=size;
      canvas.className='object-card-thumb-canvas';
      SlideRenderer.drawObjectThumbnail(canvas.getContext('2d'),v,size);
      thumb.appendChild(canvas);
      return;
    }
    if(v && v.kind==='glyph'){
      thumb.textContent=v.glyph;
      return;
    }
    if(v && v.kind==='text'){
      thumb.classList.add('object-card-thumb-text');
      thumb.textContent=v.snippet;
      return;
    }
    if(opts.imgSrc){
      const img=document.createElement('img');
      img.src=opts.imgSrc;
      thumb.appendChild(img);
      return;
    }
    thumb.textContent=opts.icon||'❔';
  }

  function _card(opts){
    // opts: {icon, imgSrc, name, editable, owner, selected, onClick, visual, id, draggable}
    const card=_el('button','object-card'+(opts.selected?' selected':''));
    card.type='button';
    const thumb=_el('div','object-card-thumb');
    _renderThumb(thumb,opts);
    if(opts.editable) thumb.appendChild(_el('span','object-card-edit-badge','✏️'));
    // A real object (has its own id) that isn't in the current
    // reorderable set gets a lock badge — direct product feedback:
    // "for an object which cannot be reordered, put a lock or some kind
    // of information show" — so a card that silently ignores a drag
    // always has a visible reason why, distinct from the edit-pencil
    // badge above (an object can be editable but still not reorderable,
    // or vice versa). Never shown on the two synthetic Background/
    // Artwork cards, which have no id and aren't real reorderable
    // objects to begin with.
    if(opts.id && !opts.draggable) thumb.appendChild(_el('span','object-card-lock-badge','🔒'));
    card.appendChild(thumb);
    card.appendChild(_el('div','object-card-name',opts.name));
    // Ownership-aware badge: an object a child locked themselves reads
    // differently from something that was never theirs to begin with —
    // both used to share the same "Part of the world" text.
    const badgeText=opts.editable ? '🟢 You can edit' : (opts.owner==='world' ? '🌍 Part of the World' : '🔒 Locked');
    card.appendChild(_el('div','object-card-badge',badgeText));
    if(opts.id && !opts.draggable) card.title="Can't be reordered";
    if(typeof opts.onClick==='function') card.addEventListener('click',opts.onClick);
    // Unified Layer Ordering — a card whose object is in the current
    // reorderable set gets real drag-to-reorder; a locked/non-moveable
    // object (or a synthetic Background/Artwork card, neither of which
    // is a real render-tree object) has no drag handle at all, matching
    // that it's shown here but can't be reordered.
    if(opts.draggable && opts.id) _wireReorderDrag(card,opts.id);
    return card;
  }

  // ---------- Unified Layer Ordering — drag-to-reorder ----------
  // Dragging a card changes the object's real paint/hit-test order
  // (SlideRenderer.getReorderableIds()/SceneEngine.setLayerOrder() — the
  // same mechanism Card Designer's Sticker/Frame/Decoration "Order"
  // buttons now use), not just the card's own display position — this
  // IS the answer to "can the Object Strip be the layering control."
  let _dragId=null;
  function _clearDropIndicators(){
    if(!listRoot) return;
    const marked=listRoot.querySelectorAll('.object-card-drop-before,.object-card-drop-after');
    for(let i=0;i<marked.length;i++) marked[i].classList.remove('object-card-drop-before','object-card-drop-after');
  }
  function _wireReorderDrag(card,id){
    card.draggable=true;
    card.classList.add('object-card-draggable');
    card.addEventListener('dragstart',function(e){
      _dragId=id;
      try{ e.dataTransfer.setData('text/plain',id); e.dataTransfer.effectAllowed='move'; }catch(err){}
      card.classList.add('dragging');
    });
    card.addEventListener('dragend',function(){
      card.classList.remove('dragging');
      _dragId=null;
      _clearDropIndicators();
    });
    card.addEventListener('dragover',function(e){
      if(!_dragId || _dragId===id) return;
      if(!_sameReorderBucket(_dragId,id)) return; // different bucket -- see _sameReorderBucket
      e.preventDefault();
      try{ e.dataTransfer.dropEffect='move'; }catch(err){}
      const rect=card.getBoundingClientRect();
      const before=(e.clientX-rect.left)<rect.width/2;
      _clearDropIndicators();
      card.classList.add(before?'object-card-drop-before':'object-card-drop-after');
    });
    card.addEventListener('drop',function(e){
      e.preventDefault();
      const draggedId=_dragId;
      _dragId=null;
      _clearDropIndicators();
      if(!draggedId || draggedId===id) return;
      if(!_sameReorderBucket(draggedId,id)) return;
      const rect=card.getBoundingClientRect();
      const before=(e.clientX-rect.left)<rect.width/2;
      _performReorder(draggedId,id,before);
    });
  }
  // Unified Layer Ordering follow-up — moveable World-owned objects now
  // also join a reorderable group (see renderer/slideRenderer.js's
  // getReorderBucket), but strictly WITHIN their own draw bucket (Scene
  // elements + Stickers together; non-overlay World objects together;
  // overlay-scoped World objects together) — crossing a bucket boundary
  // still needs deferred/two-pass drawing this pass didn't attempt. This
  // check keeps a drag from ever suggesting a cross-bucket move that
  // wouldn't actually change anything on the canvas: no drop-indicator
  // line, no drop, when the dragged card and the hovered card aren't in
  // the same bucket.
  function _sameReorderBucket(idA,idB){
    const slide=cfg.getCurrentSlide();
    if(!slide || typeof SlideRenderer==='undefined' || typeof SlideRenderer.getReorderBucket!=='function') return true;
    const a=SlideRenderer.getReorderBucket(slide,idA), b=SlideRenderer.getReorderBucket(slide,idB);
    return !!a && a===b;
  }
  function _performReorder(draggedId,targetId,before){
    const slide=cfg.getCurrentSlide();
    if(!slide || typeof SlideRenderer==='undefined' || typeof SceneEngine==='undefined') return;
    const ids=SlideRenderer.getReorderableIds(slide);
    const from=ids.indexOf(draggedId);
    if(from===-1 || ids.indexOf(targetId)===-1) return;
    ids.splice(from,1);
    let to=ids.indexOf(targetId);
    if(to===-1) return;
    if(!before) to+=1;
    ids.splice(to,0,draggedId);
    SceneEngine.setLayerOrder(slide,ids);
    delete slide.thumbnail;
    try{ if(typeof window.redrawPreview==='function') window.redrawPreview(); }catch(e){}
    try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    refresh();
  }

  // Creator Runtime Pass Sprint — Object Strip mutates selection through
  // Page Runtime's own named entry points rather than reaching into
  // js/app.js's window globals directly. Falls back to the raw globals
  // only if PageRuntime somehow isn't loaded.
  function _clearSelection(){
    if(typeof PageRuntime!=='undefined'){ PageRuntime.clearSelection(); return; }
    if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement(null,null);
    if(typeof window.setSelectedTextElement==='function') window.setSelectedTextElement(null);
  }
  function _selectScene(id,type){
    if(typeof PageRuntime!=='undefined'){ PageRuntime.selectSceneObject(id,type); return; }
    if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement(id,type);
  }
  function _selectText(id){
    if(typeof PageRuntime!=='undefined'){ PageRuntime.selectTextObject(id); return; }
    if(typeof window.setSelectedTextElement==='function') window.setSelectedTextElement(id);
  }

  function refresh(){
    if(!listRoot) return;
    listRoot.innerHTML='';
    const slide=cfg.getCurrentSlide();
    if(!slide){
      listRoot.appendChild(_el('div','object-strip-empty','Nothing on this page yet.'));
      return;
    }

    const selText=cfg.getSelectedTextElement();
    const selScene=cfg.getSelectedSceneElement();
    const cards=[];

    // Unified Layer Ordering — the set of ids a card can actually be
    // dragged for. Computed once per refresh (not per-card) since it's
    // the same current-order snapshot every card in this pass checks
    // against.
    const reorderableIds=(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getReorderableIds==='function')
      ? SlideRenderer.getReorderableIds(slide)
      : [];

    // Background — always present, every role. Not a Scene Object: it's
    // the page canvas itself, with no independent render-tree bbox.
    cards.push(_card({
      icon:'🎨',
      name:'Background',
      editable:true,
      selected:!selText && !selScene,
      onClick:_clearSelection
    }));

    // Artwork — a page with no SceneEngine scene blueprint (Story role,
    // and — a real bug found while verifying this sprint — a freshly
    // Creation-Flow-created page, whose pageType stays 'blank' forever
    // since nothing ever promotes it to 'story') has no scene element
    // for the picture (see js/app.js's own comment at the image-pan
    // click handler), so 'image-holder' here is the same synthetic id
    // that handler already uses purely for Context Panel routing. Like
    // Background, this is a page-level concept with no render-tree bbox
    // of its own today, so it stays a second disclosed synthetic entry.
    // Matching renderer/slideRenderer.js's own `_hasScene` gate (rather
    // than a hardcoded pageType string) means this correctly covers
    // 'story' AND 'blank' alike, and stays correct for any future
    // non-scene pageType too.
    // Creator Acceptance Sprint — always present when there's no scene
    // blueprint, not gated on slide.image: the World already authored a
    // Place for the child's artwork (the Frame/mat/wall chrome now
    // renders before any picture exists, matching Builder's own Runtime
    // Preview), so "Tap Artwork Place -> Replace Artwork" must be
    // reachable before an image is uploaded, not only after.
    const hasScene=(typeof SceneEngine!=='undefined' && typeof SceneEngine.getRenderData==='function')
      && SceneEngine.getRenderData(slide)!==null;
    // A Builder-authored Layout can explicitly declare zero Places
    // (Sprint 9.6's reserved `holders` field, finally populated by the
    // Builder Convergence Sprint's Scene->Layout conversion) — if the
    // World never built a Place here, Creator must not fabricate one.
    // Absent the field (every Layout that predates this), the count is
    // null/undefined and this stays exactly as it was.
    const noHolderAuthored=(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.activeLayoutHolderCount==='function')
      && SlideRenderer.activeLayoutHolderCount(slide)===0;
    if(!hasScene && !noHolderAuthored){
      cards.push(_card({
        imgSrc:slide.thumbnail||null,
        icon:'🖼️',
        name:slide.image?'Artwork':'Artwork Place',
        editable:true,
        selected:selScene==='image-holder',
        onClick:function(){ _selectScene('image-holder','image-holder'); }
      }));
    }

    // Every other object on the page — Cover/Hook/End blueprint elements,
    // Story-Author-placed stickers, and theme-authored Layer Pack objects
    // (Museum Caption, Wax Seal, Gallery Spotlight, …) — comes from
    // exactly one place: Page Runtime's render tree (the same
    // SlideRenderer.render() output it already exposes). No separate
    // SceneEngine query, no de-dup bookkeeping: if it rendered, it's in
    // this one list, exactly once, in render order.
    const rendered=(typeof PageRuntime!=='undefined')
      ? PageRuntime.getRenderedObjects()
      : {
          scene:(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getSceneElements==='function') ? SlideRenderer.getSceneElements() : [],
          text:(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getTextElements==='function') ? SlideRenderer.getTextElements() : []
        };
    rendered.scene.forEach(function(el){
      if(el.id==='background') return; // already shown above as the synthetic Background card
      if(el.visible===false) return;
      const friendly=FRIENDLY_TYPE[el.type]||{icon:'❔',name:el.label||'Object'};
      let name=el.label||friendly.name;
      let icon=friendly.icon;
      // A Story-Author-placed sticker's own bbox (renderer's
      // _stickerBbox) carries the real catalog id directly — no second
      // lookup needed, and nothing to look up for a Layer Pack
      // glyph-sticker or a blueprint element, which never set it.
      if(el.type==='sticker' && el.stickerId && typeof StickerLibrary!=='undefined'){
        const def=StickerLibrary.getById(el.stickerId);
        if(def){ name=def.name; icon=def.glyph; }
      }
      cards.push(_card({
        icon:icon,
        name:name,
        editable:!!el.editable,
        owner:el.owner,
        visual:el.visual,
        selected:selScene===el.id,
        onClick:function(){ _selectScene(el.id,el.type); },
        id:el.id,
        draggable:reorderableIds.indexOf(el.id)!==-1
      }));
    });

    // Story-role text objects (Story Text the child writes, plus the
    // Theme's own Handle/Footer/Page Number chrome).
    rendered.text.forEach(function(t){
      const friendly=FRIENDLY_TEXT_ID[t.id];
      if(!friendly) return; // unknown ids are skipped, never shown raw
      cards.push(_card({
        icon:friendly.icon,
        name:friendly.name,
        editable:friendly.editable,
        selected:selText===t.id,
        onClick:function(){ _selectText(t.id); }
      }));
    });

    if(!cards.length){
      listRoot.appendChild(_el('div','object-strip-empty','Nothing on this page yet.'));
      return;
    }
    cards.forEach(function(c){ listRoot.appendChild(c); });
  }

  return { configure:configure, init:init, refresh:refresh };
})();
try{ window.ObjectStrip=ObjectStrip; }catch(e){}
