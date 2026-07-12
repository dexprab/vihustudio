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
// Reuses, never duplicates: SceneEngine.listElements() (Cover/Hook/End
// role objects), SceneEngine.getStickers(), SlideRenderer.getTextElements()
// (Story-role text objects, including the Story Text a child writes),
// SlideRenderer.getSceneElements() (also picks up theme-authored Layer
// Pack objects — Museum Caption, Wax Seal, etc. — so a Builder-authored
// World's own content is visible and selectable here, not just drawn on
// the canvas), and the exact same window.setSelectedSceneElement/setSelectedTextElement
// entry points the canvas's own click handlers already use (js/app.js) —
// tapping a card here is indistinguishable from tapping the object on
// the canvas itself, so selection stays perfectly bidirectional with no
// second selection model.
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
    // opts: {icon, imgSrc, name, editable, selected, onClick}
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
    card.appendChild(_el('div','object-card-badge',opts.editable?'🟢 You can edit':'🔒 Part of the world'));
    if(typeof opts.onClick==='function') card.addEventListener('click',opts.onClick);
    return card;
  }

  function _clearSelection(){
    if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement(null,null);
    if(typeof window.setSelectedTextElement==='function') window.setSelectedTextElement(null);
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
    // Every scene-element id already represented by a card below, so the
    // new Layer Pack loop (further down) never lists the same object
    // twice — see that loop's own comment for why it needs this at all.
    const shownSceneIds={};

    // Background — always present, every role.
    shownSceneIds.background=true;
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
    // handler already uses purely for Context Panel routing.
    if(slide.pageType==='story' && slide.image){
      shownSceneIds['image-holder']=true;
      cards.push(_card({
        imgSrc:slide.thumbnail||null,
        icon:'🖼️',
        name:'Artwork',
        editable:true,
        selected:selScene==='image-holder',
        onClick:function(){
          if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement('image-holder','image-holder');
        }
      }));
    }

    // Cover/Hook/End role objects (Frame, Title, Stickers, Decorations…)
    if(typeof SceneEngine!=='undefined' && typeof SceneEngine.listElements==='function'){
      const elements=SceneEngine.listElements(slide)||[];
      elements.forEach(function(el){
        shownSceneIds[el.id]=true;
        if(el.id==='background') return; // already shown above
        const friendly=FRIENDLY_TYPE[el.type]||{icon:'❔',name:el.label};
        let name=el.label||friendly.name;
        let icon=friendly.icon;
        if(el.type==='sticker' && typeof SceneEngine.findSticker==='function'){
          const st=SceneEngine.findSticker(slide,el.id);
          if(st && typeof StickerLibrary!=='undefined'){
            const def=StickerLibrary.getById(st.stickerId);
            if(def){ name=def.name; icon=def.glyph; }
          }
        }
        cards.push(_card({
          icon:icon,
          name:name,
          editable:!el.locked,
          selected:selScene===el.id,
          onClick:function(){
            if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement(el.id,el.type);
          }
        }));
      });
    }

    // User-placed stickers (Sticker Studio) — a separate SceneEngine list
    // from the blueprint elements above; tracked here purely so the new
    // Layer Pack loop below can't collide with one of their ids.
    if(typeof SceneEngine!=='undefined' && typeof SceneEngine.getStickers==='function'){
      (SceneEngine.getStickers(slide)||[]).forEach(function(st){ shownSceneIds[st.id]=true; });
    }

    // Layer Pack objects — theme-authored decorations/text declared in
    // World Builder (Museum Caption, Wax Seal, Gallery Spotlight, and
    // similar). These already render on the canvas via SlideRenderer's
    // own Layer Pack pipeline, but until now had no Object Strip entry:
    // there's no SceneEngine list for them, since they belong to the
    // active World, not the page's own blueprint. SlideRenderer.getSceneElements()
    // is the same bbox list canvas hit-testing/selection already reads
    // (renderer/slideRenderer.js's _renderLayers), so this is the one
    // real source of truth for "what did the theme actually draw" —
    // showing them here is what makes a Builder-authored World's content
    // visible and selectable in Creator, not just visually present.
    // Always shown as 🔒 Part of the world: a Layer Pack object is
    // theme-owned, not something a creator repositions or retypes.
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getSceneElements==='function'){
      SlideRenderer.getSceneElements().forEach(function(el){
        if(shownSceneIds[el.id]) return;
        if(el.visible===false) return;
        const friendly=FRIENDLY_TYPE[el.type]||{icon:'❔',name:el.label||'Object'};
        cards.push(_card({
          icon:friendly.icon,
          name:el.label||friendly.name,
          editable:false,
          selected:selScene===el.id,
          onClick:function(){
            if(typeof window.setSelectedSceneElement==='function') window.setSelectedSceneElement(el.id,el.type);
          }
        }));
      });
    }

    // Story-role text objects (Story Text the child writes, plus the
    // Theme's own Handle/Footer/Page Number chrome).
    if(typeof SlideRenderer!=='undefined' && typeof SlideRenderer.getTextElements==='function'){
      SlideRenderer.getTextElements().forEach(function(t){
        const friendly=FRIENDLY_TEXT_ID[t.id];
        if(!friendly) return; // unknown ids are skipped, never shown raw
        cards.push(_card({
          icon:friendly.icon,
          name:friendly.name,
          editable:friendly.editable,
          selected:selText===t.id,
          onClick:function(){
            if(typeof window.setSelectedTextElement==='function') window.setSelectedTextElement(t.id);
          }
        }));
      });
    }

    if(!cards.length){
      listRoot.appendChild(_el('div','object-strip-empty','Nothing on this page yet.'));
      return;
    }
    cards.forEach(function(c){ listRoot.appendChild(c); });
  }

  return { configure:configure, init:init, refresh:refresh };
})();
try{ window.ObjectStrip=ObjectStrip; }catch(e){}
