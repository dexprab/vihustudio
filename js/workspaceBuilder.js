// workspaceBuilder.js — Sprint 9.4 Dynamic Theme Workspace.
//
// WorkspaceBuilder reads the active theme's optional `editor` block and
// turns it into a concrete, ordered list of control ids per panel. It is
// the only module that knows how to resolve "which controls does this
// panel show, in what order" — CardDesigner and PageDesigner never
// branch on a theme's name or id, they just call layout(container,
// panelId, ctx) and render whatever comes back.
//
// Panels: 'slide' (Page Designer's Story tab), 'frame' (Card Designer's
// Frame Look + Frame Style groups, inside the Picture section),
// 'holder.image' / 'holder.text' / 'holder.sticker' (Card Designer's
// Picture / Text / Sticker sections' presentational controls).
//
// Active workspace theme resolution (single-theme model, no merging):
// if an Artwork Theme is selected, it is the active workspace theme for
// ALL THREE panel scopes; otherwise the Story Theme is. This does not
// change rendering — Story Theme and Artwork Theme keep rendering as two
// independent layers exactly as before (see ThemeEngine.resolveTheme /
// getActiveArtworkTheme) — it only decides whose `editor` block drives
// the designer.
//
// Backward compatibility: a theme with no `editor` block (every theme
// before this sprint, and any .vtheme imported before this sprint)
// falls back to DEFAULT_CONFIG below, which encodes today's fixed
// control set/order exactly — no visual change for those themes.
//
// Contract with callers:
//   - Existing, already-functional controls (e.g. Frame Style's Border
//     Color) are built by CardDesigner/PageDesigner exactly as before,
//     just wrapped in a `<div data-control="id">` that is a DIRECT CHILD
//     of the container passed to layout(). WorkspaceBuilder only shows/
//     hides/reorders these — it never touches their internal wiring.
//   - Brand-new controls (Paper, Mat, Presentation, Frame preset,
//     Lighting, Caption, Sticker Shadow) have no existing UI or state
//     path; CONTROL_CATALOG builds them on first use into the same
//     `data-control` convention, writing to a new, inert
//     `slide.metadata.cardOverrides.artwork` bag. Per the sprint's
//     explicit scope ("this sprint changes the editor only"), the
//     renderer does not read this bag yet — same "stored but not yet
//     consumed" precedent as Artwork Theme's own `enhancement` field.
const WorkspaceBuilder=(function(){
  'use strict';

  // ---------- Default (backward-compatible) control sets ----------
  // Exactly today's fixed order for a theme with no `editor` block.
  const DEFAULT_CONFIG={
    slide:['background','decorations','title'],
    frame:['frameStyle','fill','border','radius','shadow'],
    'holder.image':[],
    'holder.text':['typography','alignment'],
    'holder.sticker':[]
  };

  function _normalizeEntry(e){
    if(typeof e==='string') return {id:e};
    if(e && typeof e==='object' && e.id) return e;
    return null;
  }

  // ---------- Active workspace theme resolution ----------
  function getActiveWorkspaceTheme(){
    if(typeof ThemeEngine==='undefined') return null;
    try{
      const artworkId=ThemeEngine.getActiveArtworkThemeId && ThemeEngine.getActiveArtworkThemeId();
      if(artworkId) return ThemeEngine.getActiveArtworkTheme();
    }catch(e){}
    try{ return ThemeEngine.getActiveTheme(); }catch(e){ return null; }
  }

  function _editorSectionFor(panelId){
    const theme=getActiveWorkspaceTheme();
    const editor=theme && theme.editor;
    if(!editor) return null;
    if(panelId==='slide') return editor.slide && editor.slide.sections;
    if(panelId==='frame') return editor.frame && editor.frame.sections;
    if(panelId.indexOf('holder.')===0){
      const holderType=panelId.slice('holder.'.length);
      return editor.holder && editor.holder[holderType];
    }
    return null;
  }

  // Returns {ids:[...], metaById:{id:{default,min,max,options,label}}}
  function _resolve(panelId){
    const raw=_editorSectionFor(panelId);
    const list=Array.isArray(raw) ? raw : (DEFAULT_CONFIG[panelId]||[]);
    const ids=[]; const metaById={};
    list.forEach(function(entry){
      const n=_normalizeEntry(entry);
      if(!n) return;
      ids.push(n.id);
      metaById[n.id]=n;
    });
    return {ids:ids, metaById:metaById};
  }

  function getControlIds(panelId){ return _resolve(panelId).ids; }
  function getControlMeta(panelId,id){ return _resolve(panelId).metaById[id]||{}; }

  // ---------- New-control state (inert this sprint — see file header) ----------
  function _ensureArtwork(slide){
    if(!slide) return null;
    if(!slide.metadata) slide.metadata={};
    if(!slide.metadata.cardOverrides) slide.metadata.cardOverrides={};
    if(!slide.metadata.cardOverrides.artwork) slide.metadata.cardOverrides.artwork={};
    return slide.metadata.cardOverrides.artwork;
  }
  function _readArtwork(slide){
    return (slide && slide.metadata && slide.metadata.cardOverrides && slide.metadata.cardOverrides.artwork) || {};
  }

  function _buildSelectRow(container,id,label,key,options,ctx,meta){
    const wrap=document.createElement('div');
    wrap.className='designer-row';
    wrap.setAttribute('data-control',id);
    const lbl=document.createElement('div');
    lbl.className='designer-row-label';
    lbl.textContent=label;
    wrap.appendChild(lbl);
    const sel=document.createElement('select');
    sel.className='workspace-select';
    const optionList=(meta&&Array.isArray(meta.options)) ? meta.options.map(function(o){ return [o,o]; }) : options;
    const defaultLabel='Theme default'+((meta&&meta.default)?(' ('+meta.default+')'):'');
    sel.appendChild(new Option(defaultLabel,''));
    optionList.forEach(function(o){ sel.appendChild(new Option(o[1],o[0])); });
    sel.addEventListener('change',function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const art=_ensureArtwork(slide);
      if(!art) return;
      if(sel.value==='') delete art[key]; else art[key]=sel.value;
      if(ctx.onChange) ctx.onChange();
    });
    wrap.appendChild(sel);
    container.appendChild(wrap);
    wrap.__sync=function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const art=_readArtwork(slide);
      sel.value=(art[key]!==undefined)?art[key]:'';
    };
    return wrap;
  }

  function _buildToggleRow(container,id,label,key,ctx){
    const wrap=document.createElement('div');
    wrap.className='designer-row';
    wrap.setAttribute('data-control',id);
    const lbl=document.createElement('div');
    lbl.className='designer-row-label';
    lbl.textContent=label;
    wrap.appendChild(lbl);
    const toggle=document.createElement('label');
    toggle.className='border-toggle';
    const input=document.createElement('input');
    input.type='checkbox';
    toggle.appendChild(input);
    const swText=document.createElement('span');
    swText.className='border-toggle-text';
    swText.textContent='On';
    toggle.appendChild(swText);
    wrap.appendChild(toggle);
    container.appendChild(wrap);
    input.addEventListener('change',function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const art=_ensureArtwork(slide);
      if(!art) return;
      if(input.checked) art[key]=true; else delete art[key];
      if(ctx.onChange) ctx.onChange();
    });
    wrap.__sync=function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const art=_readArtwork(slide);
      input.checked=art[key]===true;
    };
    return wrap;
  }

  // id -> build(container, ctx, meta) -> element (tagged data-control=id, __sync attached)
  const CONTROL_CATALOG={
    paper:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'paper','Paper','paper',
        [['smooth','Smooth'],['watercolor','Watercolor'],['notebook','Notebook'],['handmade','Handmade'],['kraft','Kraft Paper']],ctx,meta); }
    },
    mat:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'mat','Mat','composition',
        [['center','Center'],['margin','Margin'],['floating','Floating']],ctx,meta); }
    },
    presentation:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'presentation','Presentation','presentation',
        [['gallery','Gallery'],['sketchbook','Sketchbook'],['portfolio','Portfolio'],['classroom','Classroom'],['scrapbook','Scrapbook']],ctx,meta); }
    },
    artworkFrame:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'artworkFrame','Frame','frame',
        [['none','None'],['white-mat','White Mat'],['tape','Tape'],['floating','Floating']],ctx,meta); }
    },
    lighting:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'lighting','Lighting','lighting',
        [['none','None'],['soft','Soft'],['gallery','Gallery'],['window','Window']],ctx,meta); }
    },
    caption:{
      build:function(c,ctx,meta){ return _buildSelectRow(c,'caption','Caption','caption',
        [['none','None'],['museum','Museum'],['handwritten','Handwritten'],['minimal','Minimal'],['student','Student']],ctx,meta); }
    },
    stickerShadow:{
      build:function(c,ctx,meta){ return _buildToggleRow(c,'stickerShadow','Shadow','stickerShadow',ctx); }
    }
  };

  // ---------- Show / hide / reorder ----------
  // Never removes a node from the DOM (preserves listeners/state) — hides
  // via a CSS class and reorders via appendChild (which moves, not
  // clones). Untagged (core) children are left exactly where authored.
  function applyLayout(container,ids){
    if(!container) return;
    const idSet=new Set(ids||[]);
    const tagged=Array.prototype.slice.call(container.querySelectorAll(':scope > [data-control]'));
    tagged.forEach(function(el){
      const id=el.getAttribute('data-control');
      el.classList.toggle('wb-hidden',!idSet.has(id));
    });
    (ids||[]).forEach(function(id){
      const el=container.querySelector(':scope > [data-control="'+id+'"]');
      if(el) container.appendChild(el);
    });
  }

  // One-call convenience: resolve ids for panelId, build any missing
  // catalog-only controls, sync every control's displayed value, then
  // show/hide/reorder. `ctx` = {getSlide(), onChange()}. `hideWhenEmptyEl`
  // — e.g. an entire subgroup wrapper that exists only to host this
  // panel's controls — is hidden when the resolved id list is empty, so
  // a theme that defines nothing for this panel never leaves a visibly
  // empty section ("No Empty Sections").
  function layout(container,panelId,ctx,hideWhenEmptyEl){
    if(!container) return [];
    const resolved=_resolve(panelId);
    resolved.ids.forEach(function(id){
      let el=container.querySelector(':scope > [data-control="'+id+'"]');
      const entry=CONTROL_CATALOG[id];
      if(!el && entry){ el=entry.build(container,ctx,resolved.metaById[id]); }
      if(el && el.__sync){ try{ el.__sync(); }catch(e){} }
    });
    applyLayout(container,resolved.ids);
    if(hideWhenEmptyEl) hideWhenEmptyEl.classList.toggle('wb-hidden',resolved.ids.length===0);
    return resolved.ids;
  }

  return {
    getActiveWorkspaceTheme:getActiveWorkspaceTheme,
    getControlIds:getControlIds,
    getControlMeta:getControlMeta,
    CONTROL_CATALOG:CONTROL_CATALOG,
    applyLayout:applyLayout,
    layout:layout
  };
})();
try{ window.WorkspaceBuilder=WorkspaceBuilder; }catch(e){}
