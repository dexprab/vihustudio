// SceneEngine — Sprint 6.1 + 6.2.
//
// Sprint 6.2: Scenes are now full *page blueprints* built from holders.
// The renderer never places text or images directly — everything flows
// through Image Holders and Text Holders. Pages provide the content; the
// blueprint provides the composition; Card Overrides personalize the
// composition.
//
// Resolution chain:
//   Theme → Page Role → Scene Blueprint → Generated Holders →
//     Page Content → Card Overrides → Renderer
//
// Element types in a blueprint:
//   - 'background'    : full-canvas solid colour
//   - 'decoration'    : emoji glyph at a position (visual identity)
//   - 'image-holder'  : layout container for the page image
//   - 'text-holder'   : layout container for one role-specific text slot
//
// Story role pages never have a scene → SceneEngine.getRenderData returns
// null and the renderer falls back to its existing Story pipeline.
const SceneEngine=(function(){
  // ---------- Element constructors ----------
  function _bg(color){
    return {id:'background',label:'Background',type:'background',color:color,zIndex:0};
  }
  function _deco(id,label,glyph,pos,size,opts){
    return Object.assign({id:id,label:label,type:'decoration',glyph:glyph,position:pos,size:size||{w:64,h:64},zIndex:2},opts||{});
  }
  // Image Holder — the renderer draws slide.image inside the rect with
  // fit='cover' (default) or fit='contain'. When the page has no image
  // the holder draws a dashed placeholder so the user sees where the
  // image will land.
  function _imgHolder(id,label,pos,size,opts){
    return Object.assign({id:id,label:label,type:'image-holder',position:pos,size:size||{w:700,h:700},fit:'cover',zIndex:5},opts||{});
  }
  // Text Holder — a content slot. `source` resolves to a metadata path
  // via SceneEngine.resolveTextSource(); `placeholder` shows when the
  // page hasn't filled the slot yet.
  function _textHolder(id,label,source,placeholder,pos,fontSize,color,opts){
    return Object.assign({
      id:id,label:label,type:'text-holder',
      source:source,placeholder:placeholder,
      position:pos,size:{w:900,h:fontSize+16},
      fontSize:fontSize,color:color,alignment:'center',zIndex:10
    },opts||{});
  }

  // Shared canvas coordinates (1080 × 1350).
  const C = 540;

  // ---------- COVER scenes ----------
  function _coverHolders(imageRect){
    return [
      _imgHolder('image-holder','Image Holder',{x:imageRect.x,y:imageRect.y},{w:imageRect.w,h:imageRect.h}),
      _textHolder('title-holder','Title Holder','cover.title','Your Title',{x:C,y:200},88,'#FFFFFF',{fontWeight:'bold'}),
      _textHolder('subtitle-holder','Subtitle Holder','cover.subtitle','Subtitle',{x:C,y:300},44,'#FFFFFF'),
      _textHolder('author-holder','Author Holder','cover.author','by You',{x:C,y:1260},32,'#FFFFFF')
    ];
  }
  const COVER={
    'adventure':{label:'Adventure',elements:[
      _bg('#3F6F3A'),
      _deco('mountain','Mountain','⛰️',{x:180,y:1080},{w:240,h:240}),
      _deco('tree-1','Tree','🌲',{x:910,y:1090},{w:160,h:160}),
      _deco('campfire','Campfire','🔥',{x:540,y:1180},{w:96,h:96})
    ].concat(_coverHolders({x:C,y:720,w:660,h:520}))},
    'space':{label:'Space',elements:[
      _bg('#0B0C30'),
      _deco('star-1','Star 1','⭐',{x:120,y:180},{w:60,h:60}),
      _deco('star-2','Star 2','⭐',{x:960,y:230},{w:48,h:48}),
      _deco('star-3','Star 3','⭐',{x:160,y:1120},{w:36,h:36}),
      _deco('planet','Planet','🪐',{x:940,y:1100},{w:160,h:160}),
      _deco('rocket','Rocket','🚀',{x:140,y:880},{w:130,h:130})
    ].concat(_coverHolders({x:C,y:760,w:620,h:500}))},
    'jungle':{label:'Jungle',elements:[
      _bg('#1F4D1F'),
      _deco('palm-1','Palm Left','🌴',{x:130,y:1110},{w:200,h:200}),
      _deco('palm-2','Palm Right','🌴',{x:950,y:1110},{w:200,h:200}),
      _deco('monkey','Monkey','🐒',{x:200,y:340},{w:120,h:120}),
      _deco('parrot','Parrot','🦜',{x:880,y:340},{w:120,h:120})
    ].concat(_coverHolders({x:C,y:740,w:640,h:520}))},
    'ocean':{label:'Ocean',elements:[
      _bg('#0E5077'),
      _deco('wave-left','Wave','🌊',{x:160,y:1140},{w:170,h:170}),
      _deco('wave-right','Wave','🌊',{x:920,y:1140},{w:170,h:170}),
      _deco('fish','Fish','🐠',{x:200,y:380},{w:110,h:110}),
      _deco('whale','Whale','🐳',{x:880,y:380},{w:140,h:140})
    ].concat(_coverHolders({x:C,y:760,w:640,h:520}))},
    'fairy-tale':{label:'Fairy Tale',elements:[
      _bg('#7B3F88'),
      _deco('castle','Castle','🏰',{x:540,y:1180},{w:220,h:220}),
      _deco('sparkle-1','Sparkle','✨',{x:170,y:200},{w:72,h:72}),
      _deco('sparkle-2','Sparkle','✨',{x:910,y:200},{w:72,h:72}),
      _deco('unicorn','Unicorn','🦄',{x:170,y:1130},{w:140,h:140}),
      _deco('fairy','Fairy','🧚',{x:910,y:1130},{w:140,h:140})
    ].concat(_coverHolders({x:C,y:760,w:620,h:480}))},
    'birthday':{label:'Birthday',elements:[
      _bg('#C97840'),
      _deco('cake','Cake','🎂',{x:540,y:1180},{w:200,h:200}),
      _deco('balloon-1','Balloon','🎈',{x:160,y:300},{w:130,h:130}),
      _deco('balloon-2','Balloon','🎈',{x:920,y:300},{w:130,h:130}),
      _deco('gift','Gift','🎁',{x:160,y:1130},{w:130,h:130}),
      _deco('confetti','Confetti','🎉',{x:920,y:1130},{w:130,h:130})
    ].concat(_coverHolders({x:C,y:750,w:620,h:500}))},
    'classic-storybook':{label:'Classic Storybook',elements:[
      _bg('#3B2B1E'),
      _deco('book','Open book','📖',{x:540,y:1180},{w:220,h:220}),
      _deco('quill','Quill','🪶',{x:170,y:230},{w:100,h:100}),
      _deco('lantern','Lantern','🏮',{x:910,y:230},{w:110,h:110}),
      _deco('scroll','Scroll','📜',{x:170,y:1140},{w:120,h:120})
    ].concat(_coverHolders({x:C,y:760,w:600,h:480}))}
  };

  // ---------- HOOK scenes ----------
  function _hookHolders(imageRect){
    return [
      _imgHolder('image-holder','Image Holder',{x:imageRect.x,y:imageRect.y},{w:imageRect.w,h:imageRect.h},{visible:false}),
      _textHolder('heading-holder','Heading Holder','hook.heading','Follow along',{x:C,y:380},78,'#FFCB45',{fontWeight:'bold'}),
      _textHolder('message-holder','Message Holder','hook.message','Tell readers what comes next.',{x:C,y:520},40,'#FFFFFF'),
      _textHolder('handle-holder','Handle Holder','handle','',{x:C,y:1280},32,'#FFFFFF')
    ];
  }
  const HOOK={
    'stars':{label:'Stars',elements:[
      _bg('#0B0C30'),
      _deco('star-tl','Star','⭐',{x:180,y:200},{w:70,h:70}),
      _deco('star-tr','Star','⭐',{x:900,y:240},{w:60,h:60}),
      _deco('star-l','Star','⭐',{x:160,y:760},{w:54,h:54}),
      _deco('star-r','Star','⭐',{x:920,y:780},{w:64,h:64}),
      _deco('star-bottom','Star','⭐',{x:540,y:1080},{w:80,h:80})
    ].concat(_hookHolders({x:C,y:840,w:520,h:380}))},
    'balloons':{label:'Balloons',elements:[
      _bg('#3A7BD5'),
      _deco('balloon-1','Balloon','🎈',{x:160,y:200},{w:120,h:120}),
      _deco('balloon-2','Balloon','🎈',{x:340,y:160},{w:110,h:110}),
      _deco('balloon-3','Balloon','🎈',{x:740,y:170},{w:110,h:110}),
      _deco('balloon-4','Balloon','🎈',{x:920,y:200},{w:120,h:120}),
      _deco('balloon-5','Balloon','🎈',{x:540,y:1080},{w:160,h:160})
    ].concat(_hookHolders({x:C,y:830,w:520,h:380}))},
    'space':{label:'Space',elements:[
      _bg('#10153D'),
      _deco('planet','Planet','🪐',{x:200,y:780},{w:160,h:160}),
      _deco('rocket','Rocket','🚀',{x:880,y:540},{w:140,h:140}),
      _deco('comet','Comet','☄️',{x:540,y:240},{w:120,h:120}),
      _deco('moon','Moon','🌙',{x:880,y:1080},{w:120,h:120})
    ].concat(_hookHolders({x:C,y:840,w:520,h:380}))},
    'celebration':{label:'Celebration',elements:[
      _bg('#D9912F'),
      _deco('party-l','Party','🎉',{x:140,y:220},{w:130,h:130}),
      _deco('party-r','Party','🎉',{x:940,y:240},{w:130,h:130}),
      _deco('cake','Cake','🎂',{x:540,y:1080},{w:160,h:160}),
      _deco('clap','Clap','👏',{x:160,y:1080},{w:120,h:120}),
      _deco('star','Star','🌟',{x:920,y:1080},{w:120,h:120})
    ].concat(_hookHolders({x:C,y:850,w:520,h:360}))},
    'thank-you':{label:'Thank You',elements:[
      _bg('#8E2E5A'),
      _deco('heart-1','Heart','❤️',{x:200,y:220},{w:130,h:130}),
      _deco('heart-2','Heart','💖',{x:880,y:240},{w:130,h:130}),
      _deco('heart-3','Heart','💝',{x:540,y:1080},{w:160,h:160}),
      _deco('hug','Hug','🤗',{x:180,y:1080},{w:120,h:120}),
      _deco('flower','Flower','🌸',{x:920,y:1080},{w:120,h:120})
    ].concat(_hookHolders({x:C,y:840,w:520,h:380}))},
    'read-more':{label:'Read More',elements:[
      _bg('#2F3E2A'),
      _deco('book-1','Book','📚',{x:180,y:230},{w:140,h:140}),
      _deco('book-2','Book','📖',{x:900,y:240},{w:140,h:140}),
      _deco('pencil','Pencil','✏️',{x:180,y:1080},{w:130,h:130}),
      _deco('bulb','Idea','💡',{x:900,y:1080},{w:130,h:130})
    ].concat(_hookHolders({x:C,y:830,w:520,h:380}))}
  };

  // ---------- END scenes ----------
  function _endHolders(imageRect){
    return [
      _imgHolder('image-holder','Image Holder',{x:imageRect.x,y:imageRect.y},{w:imageRect.w,h:imageRect.h},{visible:false}),
      _textHolder('story-title-holder','Story Title Holder','storyTitle','Your Story',{x:C,y:230},48,'#FFFFFF'),
      _textHolder('ending-title-holder','Ending Title Holder','end.endingTitle','The End',{x:C,y:340},96,'#FFCB45',{fontWeight:'bold'}),
      _textHolder('message-holder','Message Holder','end.message','Thanks for reading.',{x:C,y:470},40,'#FFFFFF'),
      _textHolder('handle-holder','Handle Holder','handle','',{x:C,y:1280},32,'#FFFFFF')
    ];
  }
  const END={
    'good-night':{label:'Good Night',elements:[
      _bg('#101B40'),
      _deco('moon','Moon','🌙',{x:200,y:260},{w:160,h:160}),
      _deco('star-1','Star','⭐',{x:900,y:230},{w:60,h:60}),
      _deco('star-2','Star','⭐',{x:780,y:480},{w:50,h:50}),
      _deco('star-3','Star','⭐',{x:280,y:520},{w:54,h:54}),
      _deco('sleep','Sleep','😴',{x:540,y:1090},{w:160,h:160})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))},
    'thank-you':{label:'Thank You',elements:[
      _bg('#8E2E5A'),
      _deco('heart-1','Heart','❤️',{x:170,y:240},{w:130,h:130}),
      _deco('heart-2','Heart','💖',{x:890,y:240},{w:130,h:130}),
      _deco('hug','Hug','🤗',{x:540,y:1090},{w:170,h:170}),
      _deco('sparkle-1','Sparkle','✨',{x:160,y:1080},{w:100,h:100}),
      _deco('sparkle-2','Sparkle','✨',{x:920,y:1080},{w:100,h:100})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))},
    'rainbow':{label:'Rainbow',elements:[
      _bg('#4A8EE0'),
      _deco('rainbow','Rainbow','🌈',{x:540,y:240},{w:240,h:240}),
      _deco('cloud-l','Cloud','☁️',{x:160,y:300},{w:130,h:130}),
      _deco('cloud-r','Cloud','☁️',{x:920,y:300},{w:130,h:130}),
      _deco('sun','Sun','☀️',{x:160,y:1100},{w:130,h:130}),
      _deco('star','Star','🌟',{x:920,y:1100},{w:130,h:130})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))},
    'next-adventure':{label:'Next Adventure',elements:[
      _bg('#1B5BAA'),
      _deco('rocket','Rocket','🚀',{x:200,y:240},{w:160,h:160}),
      _deco('compass','Compass','🧭',{x:880,y:240},{w:140,h:140}),
      _deco('map','Map','🗺️',{x:180,y:1090},{w:140,h:140}),
      _deco('plane','Plane','✈️',{x:900,y:1090},{w:160,h:160})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))},
    'celebration':{label:'Celebration',elements:[
      _bg('#D9912F'),
      _deco('party-l','Party','🎉',{x:180,y:240},{w:140,h:140}),
      _deco('party-r','Party','🎉',{x:900,y:240},{w:140,h:140}),
      _deco('balloon','Balloon','🎈',{x:200,y:1090},{w:150,h:150}),
      _deco('cake','Cake','🎂',{x:880,y:1090},{w:160,h:160}),
      _deco('sparkle','Sparkle','✨',{x:540,y:1100},{w:120,h:120})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))},
    'the-end':{label:'The End',elements:[
      _bg('#3B2B1E'),
      _deco('book','Book','📖',{x:540,y:1110},{w:220,h:220}),
      _deco('star-l','Star','⭐',{x:200,y:240},{w:90,h:90}),
      _deco('star-r','Star','⭐',{x:880,y:240},{w:90,h:90}),
      _deco('candle','Candle','🕯️',{x:200,y:1100},{w:130,h:130}),
      _deco('rose','Rose','🌹',{x:900,y:1100},{w:130,h:130})
    ].concat(_endHolders({x:C,y:820,w:540,h:380}))}
  };

  const BLUEPRINTS={cover:COVER,hook:HOOK,end:END};

  function getBlueprint(role,sceneId){
    if(!role||!sceneId) return null;
    const set=BLUEPRINTS[role];
    return set ? (set[sceneId]||null) : null;
  }

  // Deep-merge overrides into a blueprint element.
  function _applyOverride(el,ov){
    if(!ov) return Object.assign({visible:el.visible!==false},el);
    const out=Object.assign({visible:el.visible!==false},el);
    if(typeof ov.visible==='boolean') out.visible=ov.visible;
    if(ov.position) out.position=Object.assign({},el.position||{},ov.position);
    if(ov.size) out.size=Object.assign({},el.size||{},ov.size);
    if(typeof ov.rotation==='number') out.rotation=ov.rotation;
    if(typeof ov.opacity==='number') out.opacity=ov.opacity;
    if(typeof ov.zIndex==='number') out.zIndex=ov.zIndex;
    // Sprint 8.3 — propagate the locked flag (Frame Holder completion /
    // Universal Object Consistency). Renderer + canvas hit-tests read
    // el.locked through the resolved element.
    if(ov.locked===true) out.locked=true;
    return out;
  }

  // Returns the resolved elements to draw, or null if the slide has no
  // active scene (e.g., Story role).
  function getRenderData(slide){
    if(!slide||!slide.metadata) return null;
    const role=slide.pageType;
    const sceneId=slide.metadata.scene;
    const bp=getBlueprint(role,sceneId);
    if(!bp) return null;
    const overrides=(slide.metadata.elementOverrides)||{};
    const elements=bp.elements.map(function(el){ return _applyOverride(el,overrides[el.id]); });
    return {role:role,sceneId:sceneId,elements:elements};
  }

  function listElements(slide){
    const data=getRenderData(slide);
    if(!data) return [];
    return data.elements.map(function(el){
      return {
        id:el.id,
        label:el.label||el.id,
        type:el.type,
        visible:el.visible!==false,
        // Sprint 8.3 — Universal Object Consistency. Surface the lock
        // state so the Page Designer's Element checklist can offer a
        // Lock toggle alongside the visibility checkbox.
        locked:!!el.locked
      };
    });
  }

  // ---------- Override mutators ----------
  function _ensureOverridesMap(slide){
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.elementOverrides) slide.metadata.elementOverrides={};
    return slide.metadata.elementOverrides;
  }
  function _ensureEntry(slide,id){
    const map=_ensureOverridesMap(slide);
    if(!map[id]) map[id]={};
    return map[id];
  }
  function _maybePrune(slide,id){
    if(!slide.metadata||!slide.metadata.elementOverrides) return;
    const e=slide.metadata.elementOverrides[id];
    if(e && Object.keys(e).length===0) delete slide.metadata.elementOverrides[id];
    if(Object.keys(slide.metadata.elementOverrides).length===0) delete slide.metadata.elementOverrides;
  }

  function setVisibility(slide,id,visible){
    // Look up the blueprint default so we only persist *changes*.
    const bp=getBlueprint(slide.pageType,(slide.metadata||{}).scene);
    const defEl=bp ? (bp.elements.find(function(e){ return e.id===id; })) : null;
    const def=defEl ? (defEl.visible!==false) : true;
    const entry=_ensureEntry(slide,id);
    if(visible===def) delete entry.visible; else entry.visible=visible;
    _maybePrune(slide,id);
  }
  function setPosition(slide,id,position){
    const entry=_ensureEntry(slide,id);
    if(!position) delete entry.position;
    else entry.position=Object.assign({},entry.position||{},position);
    _maybePrune(slide,id);
  }
  function setSize(slide,id,size){
    const entry=_ensureEntry(slide,id);
    if(!size) delete entry.size;
    else entry.size=Object.assign({},entry.size||{},size);
    _maybePrune(slide,id);
  }
  // Sprint 6.6.1 — Frame Designer enhancement. Rotation + z-index
  // overrides ride on the existing elementOverrides bag so the
  // persistence path is unchanged.
  function setRotation(slide,id,rotation){
    const entry=_ensureEntry(slide,id);
    if(typeof rotation!=='number' || rotation===0) delete entry.rotation;
    else entry.rotation=rotation;
    _maybePrune(slide,id);
  }
  // Sprint 8.3 — Frame Holder completion + Universal Object
  // Consistency. Every scene element can now be locked (preventing
  // drag + resize without removing the picture). Lock state rides on
  // the existing elementOverrides bag — no project format change.
  function setLocked(slide,id,locked){
    const entry=_ensureEntry(slide,id);
    if(locked) entry.locked=true; else delete entry.locked;
    _maybePrune(slide,id);
  }
  function adjustZIndex(slide,id,delta){
    // delta = +1 brings forward, -1 sends backward. The override is
    // additive on top of the blueprint's z; the renderer's sort honours
    // the resolved value.
    const bp=getBlueprint(slide.pageType,(slide.metadata||{}).scene);
    const defEl=bp ? (bp.elements.find(function(e){ return e.id===id; })) : null;
    const baseZ=defEl ? (typeof defEl.zIndex==='number'?defEl.zIndex:0) : 0;
    const entry=_ensureEntry(slide,id);
    const cur=typeof entry.zIndex==='number'?entry.zIndex:baseZ;
    const next=cur+delta;
    if(next===baseZ) delete entry.zIndex;
    else entry.zIndex=next;
    _maybePrune(slide,id);
  }
  function clearOverride(slide,id){
    if(!slide.metadata||!slide.metadata.elementOverrides) return;
    delete slide.metadata.elementOverrides[id];
    if(Object.keys(slide.metadata.elementOverrides).length===0) delete slide.metadata.elementOverrides;
  }

  // ---------- Stickers (Sprint 6.6) ----------
  //
  // Stickers are story objects, not scene blueprint elements. They live
  // at `slide.metadata.stickers` as an ordered array (back-to-front), so
  // every page — Story, Cover, Hook, End — can carry stickers without
  // any blueprint coupling. Each entry:
  //
  //   {
  //     id:        unique instance id ('sticker-<timestamp>-<rand>')
  //     stickerId: catalog id from StickerLibrary (e.g. 'animals.cat')
  //     x, y:      center position (canvas pixels, 1080×1350)
  //     w, h:      size (canvas pixels)
  //     rotation:  degrees clockwise (0 default)
  //     flipX, flipY: bool
  //     opacity:   0..1
  //     locked:    bool
  //   }
  //
  // Helpers below are the single mutation surface so the persistence path
  // (`slide.metadata` rides through the existing ProjectManager serialiser
  // unchanged) and the renderer have one source of truth.

  const STICKER_DEFAULTS={w:260,h:260,rotation:0,flipX:false,flipY:false,opacity:1,locked:false};

  function _ensureStickersArray(slide){
    if(!slide.metadata) slide.metadata={};
    if(!Array.isArray(slide.metadata.stickers)) slide.metadata.stickers=[];
    return slide.metadata.stickers;
  }

  function _newStickerInstanceId(){
    return 'sticker-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6).toString(36);
  }

  function getStickers(slide){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return [];
    return slide.metadata.stickers.slice();
  }

  function findSticker(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return null;
    return slide.metadata.stickers.find(function(st){ return st.id===stickerInstanceId; })||null;
  }

  function addSticker(slide,init){
    if(!slide||!init||!init.stickerId) return null;
    const list=_ensureStickersArray(slide);
    const inst=Object.assign({},STICKER_DEFAULTS,{
      id:_newStickerInstanceId(),
      stickerId:init.stickerId,
      x:typeof init.x==='number' ? init.x : 540,
      y:typeof init.y==='number' ? init.y : 675
    },init);
    // Stamp the catalog id on the instance again so a spread doesn't
    // accidentally drop it.
    inst.stickerId=init.stickerId;
    list.push(inst);
    return inst;
  }

  function updateSticker(slide,stickerInstanceId,changes){
    const st=findSticker(slide,stickerInstanceId);
    if(!st||!changes) return null;
    Object.keys(changes).forEach(function(k){ st[k]=changes[k]; });
    return st;
  }

  function removeSticker(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return false;
    const idx=slide.metadata.stickers.findIndex(function(st){ return st.id===stickerInstanceId; });
    if(idx===-1) return false;
    slide.metadata.stickers.splice(idx,1);
    if(slide.metadata.stickers.length===0) delete slide.metadata.stickers;
    return true;
  }

  function duplicateSticker(slide,stickerInstanceId){
    const orig=findSticker(slide,stickerInstanceId);
    if(!orig) return null;
    const list=_ensureStickersArray(slide);
    const copy=Object.assign({},orig,{
      id:_newStickerInstanceId(),
      x:(orig.x||540)+30,
      y:(orig.y||675)+30
    });
    list.push(copy);
    return copy;
  }

  // Bring forward / send backward swap with the neighbour in the array.
  // Front of array = back of canvas. Last = top of stack.
  function bringStickerForward(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return false;
    const arr=slide.metadata.stickers;
    const i=arr.findIndex(function(st){ return st.id===stickerInstanceId; });
    if(i===-1 || i===arr.length-1) return false;
    const tmp=arr[i]; arr[i]=arr[i+1]; arr[i+1]=tmp;
    return true;
  }
  function sendStickerBackward(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return false;
    const arr=slide.metadata.stickers;
    const i=arr.findIndex(function(st){ return st.id===stickerInstanceId; });
    if(i<=0) return false;
    const tmp=arr[i]; arr[i]=arr[i-1]; arr[i-1]=tmp;
    return true;
  }
  function bringStickerToFront(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return false;
    const arr=slide.metadata.stickers;
    const i=arr.findIndex(function(st){ return st.id===stickerInstanceId; });
    if(i===-1 || i===arr.length-1) return false;
    const it=arr.splice(i,1)[0];
    arr.push(it);
    return true;
  }
  function sendStickerToBack(slide,stickerInstanceId){
    if(!slide||!slide.metadata||!Array.isArray(slide.metadata.stickers)) return false;
    const arr=slide.metadata.stickers;
    const i=arr.findIndex(function(st){ return st.id===stickerInstanceId; });
    if(i<=0) return false;
    const it=arr.splice(i,1)[0];
    arr.unshift(it);
    return true;
  }

  // Resolve a `source` like "cover.title", "hook.message", "storyTitle"
  // or "handle" against the slide's stored content. Returns '' if absent.
  function resolveTextSource(slide,source){
    if(!source||!slide) return '';
    if(source==='storyTitle'){
      return (slide.metadata && typeof slide.metadata.storyTitle==='string') ? slide.metadata.storyTitle : '';
    }
    if(source==='handle'){
      return (slide.metadata && typeof slide.metadata.handle==='string') ? slide.metadata.handle : '';
    }
    const dot=source.indexOf('.');
    if(dot===-1) return '';
    const bucket=source.slice(0,dot), key=source.slice(dot+1);
    const data=(slide.metadata && slide.metadata[bucket]) || {};
    return (typeof data[key]==='string') ? data[key] : '';
  }

  const api={
    BLUEPRINTS:BLUEPRINTS,
    STICKER_DEFAULTS:STICKER_DEFAULTS,
    getBlueprint:getBlueprint,
    getRenderData:getRenderData,
    listElements:listElements,
    setVisibility:setVisibility,
    setPosition:setPosition,
    setSize:setSize,
    setRotation:setRotation,
    setLocked:setLocked,
    adjustZIndex:adjustZIndex,
    clearOverride:clearOverride,
    resolveTextSource:resolveTextSource,
    // Stickers
    getStickers:getStickers,
    findSticker:findSticker,
    addSticker:addSticker,
    updateSticker:updateSticker,
    removeSticker:removeSticker,
    duplicateSticker:duplicateSticker,
    bringStickerForward:bringStickerForward,
    sendStickerBackward:sendStickerBackward,
    bringStickerToFront:bringStickerToFront,
    sendStickerToBack:sendStickerToBack
  };
  try{ window.SceneEngine=api; }catch(e){}
  return api;
})();
