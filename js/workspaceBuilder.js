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

  // Sprint 9.5 — a theme that names a Holder presentation (e.g.
  // Classroom Display's `presentation:'classroom'`) but authors no
  // `editor` block of its own still gets a meaningful, non-empty
  // control list, sourced from that preset's `editorControls`
  // metadata (js/themePresets.js) instead of DEFAULT_CONFIG's empty
  // array. A theme with its own explicit `editor` block always wins —
  // this only fills the gap _editorSectionFor leaves null.
  function _presetEditorFallback(panelId){
    if(panelId.indexOf('holder.')!==0 || typeof ThemePresets==='undefined') return null;
    const holderType=panelId.slice('holder.'.length);
    const theme=getActiveWorkspaceTheme();
    const presentation=theme && theme.presentation;
    if(!presentation) return null;
    const table=ThemePresets.HOLDER_PRESETS[holderType];
    const preset=table && table[presentation];
    return (preset && Array.isArray(preset.editorControls)) ? preset.editorControls : null;
  }

  // Returns {ids:[...], metaById:{id:{default,min,max,options,label}}}
  function _resolve(panelId){
    const raw=_editorSectionFor(panelId) || _presetEditorFallback(panelId);
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

  // Sprint 9.6 — `store` optionally overrides where this control reads/
  // writes, for a control whose data doesn't belong in the artwork bag
  // (Layout is a Slide-scope choice, stored at slide.metadata.layout,
  // not slide.metadata.cardOverrides.artwork). Every existing caller
  // omits it and keeps today's artwork-bag behaviour exactly.
  function _buildSelectRow(container,id,label,key,options,ctx,meta,store){
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
    const _get=(store&&store.get) || function(slide){ return _readArtwork(slide)[key]; };
    const _set=(store&&store.set) || function(slide,value){
      const art=_ensureArtwork(slide);
      if(!art) return;
      if(value===undefined) delete art[key]; else art[key]=value;
    };
    sel.addEventListener('change',function(){
      const slide=ctx.getSlide && ctx.getSlide();
      if(!slide) return;
      _set(slide, sel.value===''?undefined:sel.value);
      if(ctx.onChange) ctx.onChange();
    });
    wrap.appendChild(sel);
    container.appendChild(wrap);
    wrap.__sync=function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const value=_get(slide);
      sel.value=(value!==undefined)?value:'';
    };
    return wrap;
  }

  // Frame Variations render as a row of colour swatch tiles (matching the
  // wireframe's "FRAME SELECTED" panel), reusing the exact .icon-row/
  // .icon-card/.icon-preview/.icon-label classes Frame Look's preset row
  // already established — same visual language, no new CSS. Each tile
  // shows the variation's own borderColor as a small circle swatch; a
  // theme with no frameVariations still renders one "Default" tile so the
  // section is never empty.
  function _buildSwatchRow(container,id,label,key,swatches,ctx,meta,store){
    const wrap=document.createElement('div');
    wrap.className='designer-row';
    wrap.setAttribute('data-control',id);
    const lbl=document.createElement('div');
    lbl.className='designer-row-label';
    lbl.textContent=label;
    wrap.appendChild(lbl);
    const row=document.createElement('div');
    row.className='icon-row';
    const _get=(store&&store.get) || function(slide){ return _readArtwork(slide)[key]; };
    const _set=(store&&store.set) || function(slide,value){
      const art=_ensureArtwork(slide);
      if(!art) return;
      if(value===undefined) delete art[key]; else art[key]=value;
    };
    const allTiles=[{id:'',label:'Default',color:null}].concat(swatches);
    const btns=allTiles.map(function(sw){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='icon-card swatch-card';
      const pv=document.createElement('span');
      pv.className='icon-preview swatch-preview';
      if(sw.color){
        const dot=document.createElement('span');
        dot.className='swatch-dot';
        dot.style.background=sw.color;
        pv.appendChild(dot);
      }else{
        pv.textContent='↺';
      }
      btn.appendChild(pv);
      const txt=document.createElement('span');
      txt.className='icon-label';
      txt.textContent=sw.label;
      btn.appendChild(txt);
      btn.addEventListener('click',function(){
        const slide=ctx.getSlide && ctx.getSlide();
        if(!slide) return;
        _set(slide, sw.id===''?undefined:sw.id);
        if(ctx.onChange) ctx.onChange();
      });
      row.appendChild(btn);
      return {id:sw.id,el:btn};
    });
    wrap.appendChild(row);
    container.appendChild(wrap);
    wrap.__sync=function(){
      const slide=ctx.getSlide && ctx.getSlide();
      const value=_get(slide)||'';
      btns.forEach(function(b){ b.el.classList.toggle('active', b.id===value); });
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
    // Sprint 9.5 — the option list comes from ThemePresets' Holder
    // Image preset catalog (id + meta.displayName) rather than a
    // hardcoded array, so a new official or imported preset appears
    // here automatically — "No theme-specific UI should be
    // hardcoded" per the sprint spec.
    presentation:{
      build:function(c,ctx,meta){
        const options=(typeof ThemePresets!=='undefined')
          ? ThemePresets.listHolderPresets('image').map(function(p){ return [p.id,(p.meta&&p.meta.displayName)||p.id]; })
          : [];
        return _buildSelectRow(c,'presentation','Presentation','presentation',options,ctx,meta);
      }
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
    },
    // Sprint 9.6 — Museum Gallery Theme Support. Options come from the
    // active theme's own `frameVariations` (a named bundle of artwork
    // fields — "Classic White Mat", "Gold Accent", …), never a
    // hardcoded list, since a variation only makes sense for the theme
    // that authored it. A theme with no `frameVariations` renders this
    // control with an empty (theme-default-only) option list rather
    // than hiding it — the same graceful-empty convention _buildSelectRow
    // already uses everywhere else.
    frameVariation:{
      build:function(c,ctx,meta){
        const theme=getActiveWorkspaceTheme();
        const swatches=(theme && Array.isArray(theme.frameVariations))
          ? theme.frameVariations.map(function(v){
              return {id:v.id,label:v.name||v.id,color:(v.fields&&v.fields.borderColor)||null};
            })
          : [];
        return _buildSwatchRow(c,'frameVariation','Frame Variations','frameVariation',swatches,ctx,meta);
      }
    },
    // Sprint 9.6 — Slide-scope Layout preset (see renderer/
    // slideRenderer.js _resolveLayout). Options come from the active
    // theme's own `layouts`; stored at slide.metadata.layout (a Slide-
    // level choice, not a Holder/Frame artwork override) via the
    // custom `store` _buildSelectRow now accepts.
    layout:{
      build:function(c,ctx,meta){
        const theme=getActiveWorkspaceTheme();
        const options=(theme && Array.isArray(theme.layouts))
          ? theme.layouts.map(function(l){ return [l.id,l.name||l.id]; })
          : [];
        return _buildSelectRow(c,'layout','Layout','layout',options,ctx,meta,{
          get:function(slide){ return slide && slide.metadata && slide.metadata.layout; },
          set:function(slide,value){
            if(!slide) return;
            if(!slide.metadata) slide.metadata={};
            if(value===undefined) delete slide.metadata.layout; else slide.metadata.layout=value;
          }
        });
      }
    },
    // Sprint 9.7 — Museum Gallery Fidelity: Title/Artist/Age/Date, the
    // real fields js/layerEngine.js's 'museumCaption' text-layer source
    // composes into the Design Board's two-line museum label (see
    // renderer/slideRenderer.js _drawMuseumCaption). Stored directly on
    // slide.metadata (per-slide content, not a Holder presentation
    // override) — same reasoning as the 'layout' control above. Each
    // field gets the same emoji-insertion affordance as every other
    // Text Element in the app.
    museumCaption:{
      build:function(c,ctx,meta){
        const wrap=document.createElement('div');
        wrap.setAttribute('data-control','museumCaption');
        const fields=[
          {key:'artworkTitle', label:'Title', placeholder:'e.g. The Big Tree'},
          {key:'artist', label:'Artist', placeholder:'e.g. Vihaan'},
          {key:'age', label:'Age', placeholder:'e.g. 7'},
          {key:'date', label:'Date', placeholder:'e.g. May 2025'}
        ];
        const inputs={};
        fields.forEach(function(f){
          const row=document.createElement('div');
          row.className='designer-row';
          const lbl=document.createElement('div');
          lbl.className='designer-row-label';
          lbl.textContent=f.label;
          row.appendChild(lbl);
          const input=document.createElement('input');
          input.type='text';
          input.className='input-field workspace-text-input';
          input.placeholder=f.placeholder;
          input.addEventListener('input',function(){
            const slide=ctx.getSlide && ctx.getSlide();
            if(!slide) return;
            if(!slide.metadata) slide.metadata={};
            if(input.value) slide.metadata[f.key]=input.value; else delete slide.metadata[f.key];
            if(ctx.onChange) ctx.onChange();
          });
          inputs[f.key]=input;
          row.appendChild((typeof EmojiPicker!=='undefined') ? EmojiPicker.wrap(input) : input);
          wrap.appendChild(row);
        });
        c.appendChild(wrap);
        wrap.__sync=function(){
          const slide=ctx.getSlide && ctx.getSlide();
          const m=(slide && slide.metadata) || {};
          fields.forEach(function(f){ inputs[f.key].value=(m[f.key]!==undefined)?m[f.key]:''; });
        };
        return wrap;
      }
    },
    // Sprint 9.7 — Museum Gallery Fidelity: the Quote layout's content
    // (renderer/slideRenderer.js _drawQuoteText). Slide-scope, like
    // Layout, since a Quote page has no Frame/Holder to attach it to.
    quoteText:{
      build:function(c,ctx,meta){
        const wrap=document.createElement('div');
        wrap.setAttribute('data-control','quoteText');
        const fields=[
          {key:'quoteText', label:'Quote', placeholder:'e.g. Every child is an artist…', multiline:true},
          {key:'quoteAttribution', label:'Attribution', placeholder:'e.g. Pablo Picasso'}
        ];
        const inputs={};
        fields.forEach(function(f){
          const row=document.createElement('div');
          row.className='designer-row';
          const lbl=document.createElement('div');
          lbl.className='designer-row-label';
          lbl.textContent=f.label;
          row.appendChild(lbl);
          const input=document.createElement(f.multiline?'textarea':'input');
          if(!f.multiline) input.type='text';
          else input.rows=3;
          input.className='input-field workspace-text-input';
          input.placeholder=f.placeholder;
          input.addEventListener('input',function(){
            const slide=ctx.getSlide && ctx.getSlide();
            if(!slide) return;
            if(!slide.metadata) slide.metadata={};
            if(input.value) slide.metadata[f.key]=input.value; else delete slide.metadata[f.key];
            if(ctx.onChange) ctx.onChange();
          });
          inputs[f.key]=input;
          row.appendChild((typeof EmojiPicker!=='undefined') ? EmojiPicker.wrap(input) : input);
          wrap.appendChild(row);
        });
        c.appendChild(wrap);
        wrap.__sync=function(){
          const slide=ctx.getSlide && ctx.getSlide();
          const m=(slide && slide.metadata) || {};
          fields.forEach(function(f){ inputs[f.key].value=(m[f.key]!==undefined)?m[f.key]:''; });
        };
        return wrap;
      }
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
