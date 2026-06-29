// SceneEngine — Sprint 6.1
// A Scene is a *blueprint*: a small declarative list of elements that the
// renderer can draw on top of the existing frame/panel/text pipeline.
// Selecting a Scene immediately produces a designed page; Card Overrides
// (stored at slide.metadata.elementOverrides[id]) then layer per-page
// personalization on top of the blueprint. The Scene itself is never
// mutated — overrides only carry the deltas.
//
// Resolution order (matches Sprint 6.1 architecture):
//   Theme → Page Role → Scene Blueprint → Element Overrides → Renderer
//
// The renderer doesn't know what scenes exist — it just iterates the
// elements it's given. Scenes describe *what exists on a page*, not how
// the renderer works.
const SceneEngine=(function(){
  // ---------- Tiny element constructors ----------
  function _bg(color){
    return {id:'background',label:'Background',type:'background',color:color,zIndex:0};
  }
  function _deco(id,label,glyph,pos,size,opts){
    return Object.assign({id:id,label:label,type:'decoration',glyph:glyph,position:pos,size:size||{w:64,h:64},zIndex:2},opts||{});
  }
  function _text(id,label,source,placeholder,pos,fontSize,color,opts){
    return Object.assign({id:id,label:label,type:'text',source:source,placeholder:placeholder,position:pos,size:{w:900,h:fontSize+12},fontSize:fontSize,color:color,alignment:'center',zIndex:10},opts||{});
  }

  // Shorthand for common positions, in 1080 × 1350 canvas coords.
  const C = 540;       // horizontal center
  const TITLE_Y = 360;
  const SUBTITLE_Y = 480;
  const AUTHOR_Y = 1240;
  const STORY_TITLE_Y = 220;
  const HOOK_HEADING_Y = 950;
  const HOOK_MESSAGE_Y = 1080;
  const HANDLE_BOTTOM_Y = 1300;
  const END_TITLE_Y = 920;
  const END_MESSAGE_Y = 1080;

  // ---------- COVER scenes ----------
  function _coverText(){
    return [
      _text('title','Title','cover.title','Your Title',{x:C,y:TITLE_Y},96,'#FFFFFF',{fontWeight:'bold'}),
      _text('subtitle','Subtitle','cover.subtitle','Subtitle',{x:C,y:SUBTITLE_Y},48,'#FFFFFF'),
      _text('author','Author','cover.author','by Vihu',{x:C,y:AUTHOR_Y},36,'#FFFFFF')
    ];
  }
  const COVER={
    'adventure':{label:'Adventure', elements:[
      _bg('#3F6F3A'),
      _deco('mountain','Mountain','⛰️',{x:180,y:1020},{w:280,h:280}),
      _deco('tree-1','Tree','🌲',{x:900,y:1080},{w:140,h:140}),
      _deco('campfire','Campfire','🔥',{x:540,y:1140},{w:90,h:90})
    ].concat(_coverText())},
    'space':{label:'Space', elements:[
      _bg('#0B0C30'),
      _deco('star-1','Star 1','⭐',{x:160,y:200},{w:60,h:60}),
      _deco('star-2','Star 2','⭐',{x:900,y:280},{w:48,h:48}),
      _deco('star-3','Star 3','⭐',{x:240,y:1080},{w:40,h:40}),
      _deco('planet','Planet','🪐',{x:840,y:980},{w:160,h:160}),
      _deco('rocket','Rocket','🚀',{x:200,y:780},{w:120,h:120})
    ].concat(_coverText())},
    'jungle':{label:'Jungle', elements:[
      _bg('#2D5016'),
      _deco('palm-1','Palm','🌴',{x:160,y:1080},{w:180,h:180}),
      _deco('palm-2','Palm','🌴',{x:920,y:1080},{w:180,h:180}),
      _deco('monkey','Monkey','🐒',{x:540,y:1140},{w:120,h:120}),
      _deco('parrot','Parrot','🦜',{x:880,y:340},{w:90,h:90})
    ].concat(_coverText())},
    'ocean':{label:'Ocean', elements:[
      _bg('#1B5F8C'),
      _deco('wave-1','Wave','🌊',{x:200,y:1100},{w:140,h:140}),
      _deco('wave-2','Wave','🌊',{x:880,y:1100},{w:140,h:140}),
      _deco('fish-1','Fish','🐠',{x:300,y:900},{w:90,h:90}),
      _deco('whale','Whale','🐳',{x:780,y:840},{w:140,h:140})
    ].concat(_coverText())},
    'fairy-tale':{label:'Fairy Tale', elements:[
      _bg('#9C5A8A'),
      _deco('castle','Castle','🏰',{x:540,y:1100},{w:200,h:200}),
      _deco('sparkle-1','Sparkle','✨',{x:200,y:240},{w:64,h:64}),
      _deco('sparkle-2','Sparkle','✨',{x:880,y:300},{w:64,h:64}),
      _deco('unicorn','Unicorn','🦄',{x:240,y:1080},{w:120,h:120})
    ].concat(_coverText())},
    'birthday':{label:'Birthday', elements:[
      _bg('#E8A33A'),
      _deco('cake','Cake','🎂',{x:540,y:1100},{w:170,h:170}),
      _deco('balloon-1','Balloon','🎈',{x:180,y:280},{w:110,h:110}),
      _deco('balloon-2','Balloon','🎈',{x:900,y:240},{w:110,h:110}),
      _deco('gift','Gift','🎁',{x:880,y:1080},{w:110,h:110}),
      _deco('confetti','Confetti','🎉',{x:200,y:1080},{w:110,h:110})
    ].concat(_coverText())},
    'classic-storybook':{label:'Classic Storybook', elements:[
      _bg('#3B2B1E'),
      _deco('book','Open book','📖',{x:540,y:1100},{w:200,h:200}),
      _deco('quill','Quill','🪶',{x:200,y:240},{w:80,h:80}),
      _deco('lantern','Lantern','🏮',{x:880,y:240},{w:90,h:90})
    ].concat(_coverText())}
  };

  // ---------- HOOK scenes ----------
  function _hookText(){
    return [
      _text('storyTitle','Story Title','storyTitle','Your Story',{x:C,y:STORY_TITLE_Y},56,'#FFFFFF',{fontWeight:'bold'}),
      _text('heading','Heading','hook.heading','Big idea here',{x:C,y:HOOK_HEADING_Y},80,'#FFCB45',{fontWeight:'bold'}),
      _text('message','Message','hook.message','Tell readers what comes next.',{x:C,y:HOOK_MESSAGE_Y},38,'#FFFFFF'),
      _text('handle','Handle','handle','@vihuplanet',{x:C,y:HANDLE_BOTTOM_Y},32,'#FFFFFF')
    ];
  }
  const HOOK={
    'stars':{label:'Stars', elements:[
      _bg('#0B0C30'),
      _deco('star-1','Star','⭐',{x:200,y:340},{w:64,h:64}),
      _deco('star-2','Star','⭐',{x:880,y:380},{w:64,h:64}),
      _deco('star-3','Star','⭐',{x:540,y:680},{w:64,h:64})
    ].concat(_hookText())},
    'balloons':{label:'Balloons', elements:[
      _bg('#3A7BD5'),
      _deco('balloon-1','Balloon','🎈',{x:180,y:380},{w:120,h:120}),
      _deco('balloon-2','Balloon','🎈',{x:900,y:340},{w:120,h:120}),
      _deco('balloon-3','Balloon','🎈',{x:540,y:540},{w:120,h:120})
    ].concat(_hookText())},
    'space':{label:'Space', elements:[
      _bg('#11163F'),
      _deco('planet','Planet','🪐',{x:200,y:680},{w:140,h:140}),
      _deco('rocket','Rocket','🚀',{x:880,y:520},{w:120,h:120}),
      _deco('comet','Comet','☄️',{x:540,y:380},{w:120,h:120})
    ].concat(_hookText())},
    'celebration':{label:'Celebration', elements:[
      _bg('#E8A33A'),
      _deco('party-1','Party','🎉',{x:180,y:340},{w:120,h:120}),
      _deco('party-2','Party','🎉',{x:900,y:380},{w:120,h:120}),
      _deco('cake','Cake','🎂',{x:540,y:560},{w:140,h:140})
    ].concat(_hookText())},
    'thank-you':{label:'Thank You', elements:[
      _bg('#8E2E5A'),
      _deco('heart-1','Heart','❤️',{x:200,y:360},{w:120,h:120}),
      _deco('heart-2','Heart','❤️',{x:880,y:380},{w:100,h:100}),
      _deco('heart-3','Heart','❤️',{x:540,y:580},{w:140,h:140})
    ].concat(_hookText())},
    'read-more':{label:'Read More', elements:[
      _bg('#3B2B1E'),
      _deco('book-1','Book','📚',{x:200,y:380},{w:130,h:130}),
      _deco('book-2','Book','📖',{x:880,y:380},{w:130,h:130}),
      _deco('pencil','Pencil','✏️',{x:540,y:580},{w:120,h:120})
    ].concat(_hookText())}
  };

  // ---------- END scenes ----------
  function _endText(){
    return [
      _text('storyTitle','Story Title','storyTitle','Your Story',{x:C,y:STORY_TITLE_Y},56,'#FFFFFF',{fontWeight:'bold'}),
      _text('endingTitle','Ending Title','end.endingTitle','The End',{x:C,y:END_TITLE_Y},96,'#FFCB45',{fontWeight:'bold'}),
      _text('message','Message','end.message','Thanks for reading.',{x:C,y:END_MESSAGE_Y},40,'#FFFFFF'),
      _text('handle','Handle','handle','@vihuplanet',{x:C,y:HANDLE_BOTTOM_Y},32,'#FFFFFF')
    ];
  }
  const END={
    'good-night':{label:'Good Night', elements:[
      _bg('#10183A'),
      _deco('moon','Moon','🌙',{x:200,y:340},{w:140,h:140}),
      _deco('star-1','Star','⭐',{x:880,y:300},{w:60,h:60}),
      _deco('star-2','Star','⭐',{x:780,y:540},{w:50,h:50}),
      _deco('sleep','Sleep','😴',{x:540,y:600},{w:140,h:140})
    ].concat(_endText())},
    'thank-you':{label:'Thank You', elements:[
      _bg('#8E2E5A'),
      _deco('heart-1','Heart','❤️',{x:200,y:340},{w:120,h:120}),
      _deco('heart-2','Heart','❤️',{x:880,y:360},{w:120,h:120}),
      _deco('hug','Hug','🤗',{x:540,y:580},{w:140,h:140})
    ].concat(_endText())},
    'rainbow':{label:'Rainbow', elements:[
      _bg('#3A7BD5'),
      _deco('rainbow','Rainbow','🌈',{x:540,y:340},{w:200,h:200}),
      _deco('cloud-1','Cloud','☁️',{x:200,y:360},{w:120,h:120}),
      _deco('cloud-2','Cloud','☁️',{x:880,y:360},{w:120,h:120})
    ].concat(_endText())},
    'next-adventure':{label:'Next Adventure', elements:[
      _bg('#1E5BAA'),
      _deco('rocket','Rocket','🚀',{x:540,y:520},{w:160,h:160}),
      _deco('compass','Compass','🧭',{x:200,y:340},{w:110,h:110}),
      _deco('map','Map','🗺️',{x:880,y:340},{w:110,h:110})
    ].concat(_endText())},
    'celebration':{label:'Celebration', elements:[
      _bg('#E8A33A'),
      _deco('party-1','Party','🎉',{x:200,y:340},{w:120,h:120}),
      _deco('party-2','Party','🎉',{x:880,y:340},{w:120,h:120}),
      _deco('balloon','Balloon','🎈',{x:540,y:540},{w:130,h:130})
    ].concat(_endText())},
    'the-end':{label:'The End', elements:[
      _bg('#3B2B1E'),
      _deco('book','Book','📖',{x:540,y:540},{w:200,h:200}),
      _deco('star-1','Star','⭐',{x:200,y:340},{w:80,h:80}),
      _deco('star-2','Star','⭐',{x:880,y:340},{w:80,h:80})
    ].concat(_endText())}
  };

  const BLUEPRINTS={cover:COVER,hook:HOOK,end:END};

  function getBlueprint(role,sceneId){
    if(!role||!sceneId) return null;
    const set=BLUEPRINTS[role];
    return set ? (set[sceneId]||null) : null;
  }

  // Deep-merge overrides into a blueprint element. Only known fields are
  // accepted to keep stored overrides small and predictable.
  function _applyOverride(el,ov){
    if(!ov) return Object.assign({visible:true},el);
    const out=Object.assign({visible:true},el);
    if(typeof ov.visible==='boolean') out.visible=ov.visible;
    if(ov.position){
      out.position=Object.assign({},el.position||{},ov.position);
    }
    if(ov.size){
      out.size=Object.assign({},el.size||{},ov.size);
    }
    if(typeof ov.rotation==='number') out.rotation=ov.rotation;
    if(typeof ov.opacity==='number') out.opacity=ov.opacity;
    if(typeof ov.zIndex==='number') out.zIndex=ov.zIndex;
    return out;
  }

  // Public: returns the array of resolved elements to draw, or null if
  // the slide has no scene (e.g., Story role pages).
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

  // Public: returns a UI-friendly list of {id,label,type,visible} for the
  // Page Designer's element checklist. No need to call the renderer.
  function listElements(slide){
    const data=getRenderData(slide);
    if(!data) return [];
    return data.elements.map(function(el){
      return {id:el.id,label:el.label||el.id,type:el.type,visible:el.visible!==false};
    });
  }

  // Public mutators — write overrides without touching the blueprint.
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
    const entry=_ensureEntry(slide,id);
    if(visible===true) delete entry.visible; else entry.visible=false;
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
  function clearOverride(slide,id){
    if(!slide.metadata||!slide.metadata.elementOverrides) return;
    delete slide.metadata.elementOverrides[id];
    if(Object.keys(slide.metadata.elementOverrides).length===0) delete slide.metadata.elementOverrides;
  }

  // Resolve a `source` like "cover.title", "hook.message", "storyTitle"
  // or "handle" against the slide's stored content. Returns '' if absent.
  function resolveTextSource(slide,source){
    if(!source||!slide) return '';
    if(source==='storyTitle'){
      return (slide.metadata && typeof slide.metadata.storyTitle==='string') ? slide.metadata.storyTitle : '';
    }
    if(source==='handle'){
      return (slide.metadata && typeof slide.metadata.handle==='string' && slide.metadata.handle.length>0)
        ? slide.metadata.handle : '@vihuplanet';
    }
    const dot=source.indexOf('.');
    if(dot===-1) return '';
    const bucket=source.slice(0,dot), key=source.slice(dot+1);
    const data=(slide.metadata && slide.metadata[bucket]) || {};
    return (typeof data[key]==='string') ? data[key] : '';
  }

  const api={
    BLUEPRINTS:BLUEPRINTS,
    getBlueprint:getBlueprint,
    getRenderData:getRenderData,
    listElements:listElements,
    setVisibility:setVisibility,
    setPosition:setPosition,
    setSize:setSize,
    clearOverride:clearOverride,
    resolveTextSource:resolveTextSource
  };
  try{ window.SceneEngine=api; }catch(e){}
  return api;
})();
