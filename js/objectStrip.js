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

  function _card(opts){
    // opts: {icon, imgSrc, name, editable, owner, selected, onClick}
    const card=_el('button','object-card'+(opts.selected?' selected':''));
    card.type='button';
    const thumb=_el('div','object-card-thumb');
    if(opts.imgSrc){
      const img=document.createElement('img');
      img.src=opts.imgSrc;
      thumb.appendChild(img);
    }else{
      thumb.textContent=opts.icon||'❔';
    }
    if(opts.editable) thumb.appendChild(_el('span','object-card-edit-badge','✏️'));
    card.appendChild(thumb);
    card.appendChild(_el('div','object-card-name',opts.name));
    // Ownership-aware badge: an object a child locked themselves reads
    // differently from something that was never theirs to begin with —
    // both used to share the same "Part of the world" text.
    const badgeText=opts.editable ? '🟢 You can edit' : (opts.owner==='world' ? '🔒 Part of the world' : '🔒 Locked');
    card.appendChild(_el('div','object-card-badge',badgeText));
    if(typeof opts.onClick==='function') card.addEventListener('click',opts.onClick);
    return card;
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

    // Background — always present, every role. Not a Scene Object: it's
    // the page canvas itself, with no independent render-tree bbox.
    cards.push(_card({
      icon:'🎨',
      name:'Background',
      editable:true,
      selected:!selText && !selScene,
      onClick:_clearSelection
    }));

    // Artwork — Story-role pages have no SceneEngine scene element for
    // the picture (see js/app.js's own comment at the image-pan click
    // handler), so 'image-holder' here is the same synthetic id that
    // handler already uses purely for Context Panel routing. Like
    // Background, this is a page-level concept with no render-tree bbox
    // of its own today, so it stays a second disclosed synthetic entry.
    if(slide.pageType==='story' && slide.image){
      cards.push(_card({
        imgSrc:slide.thumbnail||null,
        icon:'🖼️',
        name:'Artwork',
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
        selected:selScene===el.id,
        onClick:function(){ _selectScene(el.id,el.type); }
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
