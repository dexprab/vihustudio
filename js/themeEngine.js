// Sprint 9.2 — Theme Library Foundation. ThemeEngine no longer owns
// theme storage: every built-in theme lives in ThemeRegistry
// (js/themeRegistry.js, loaded before this file) alongside whatever
// a child has imported. ThemeEngine only ever asks for a theme by id
// — it doesn't know, and doesn't need to know, whether the answer
// came from the bundled Official set or an imported .vtheme. Every
// public method below keeps its exact pre-9.2 signature and
// behaviour; only the storage underneath changed.
const ThemeEngine=(function(){
  const DEFAULT_THEME_ID='storybook-classic';

  // Cross-theme catalogs.
  const PANEL_STYLES=[
    {id:'classic',name:'Classic'},
    {id:'rounded',name:'Rounded'},
    {id:'cloud',name:'Cloud'},
    {id:'scroll',name:'Scroll'}
  ];
  const FOOTER_STYLES=[
    {id:'classic',name:'Classic'},
    {id:'modern',name:'Modern'},
    {id:'minimal',name:'Minimal'},
    {id:'hidden',name:'Hidden'}
  ];
  const PAGE_NUMBER_STYLES=[
    {id:'bottom-right',name:'Bottom Right'},
    {id:'bottom-center',name:'Bottom Center'},
    {id:'hidden',name:'Hidden'}
  ];
  const VISIBILITY=[
    {id:'show',name:'Show'},
    {id:'hide',name:'Hide'}
  ];
  const BOOK_TITLE_POSITIONS=[
    {id:'bottom-left',name:'Bottom Left'},
    {id:'bottom-center',name:'Bottom Center'},
    {id:'bottom-right',name:'Bottom Right'}
  ];
  const HANDLE_POSITIONS=[
    {id:'top-left',name:'Top Left'},
    {id:'top-right',name:'Top Right'},
    {id:'bottom-left',name:'Bottom Left'},
    {id:'bottom-right',name:'Bottom Right'}
  ];

  // registerTheme() pre-9.2 behaviour was an unconditional overwrite
  // by id (registry[theme.id]=theme) — preserved exactly by routing
  // through ThemeRegistry.importPackage with onDuplicate:'replace'.
  // No caller in this codebase currently uses this method (Theme
  // Creator, the only future feature that would, is out of scope for
  // this sprint) but the signature stays for API compatibility.
  function registerTheme(theme){
    if(!theme||!theme.id) return false;
    const pkg={
      manifest:{
        id:theme.id, name:theme.name||theme.id, version:'1.0.0', author:'Vihu',
        description:theme.description||'', category:'Imported', tags:[],
        thumbnail:'', createdDate:'', updatedDate:'',
        minStudioVersion:ThemeRegistry.THEME_SYSTEM_VERSION
      },
      theme:theme
    };
    const result=ThemeRegistry.importPackage(pkg,{onDuplicate:'replace'});
    return !!(result&&result.ok);
  }
  function getTheme(id){
    if(id){ const t=ThemeRegistry.get(id); if(t) return t; }
    return ThemeRegistry.get(DEFAULT_THEME_ID);
  }
  function getAllThemes(){ return ThemeRegistry.list(); }
  function getPanelStyles(){ return PANEL_STYLES.slice(); }
  function getFooterStyles(){ return FOOTER_STYLES.slice(); }
  function getPageNumberStyles(){ return PAGE_NUMBER_STYLES.slice(); }
  function getVisibility(){ return VISIBILITY.slice(); }
  function getBookTitlePositions(){ return BOOK_TITLE_POSITIONS.slice(); }
  function getHandlePositions(){ return HANDLE_POSITIONS.slice(); }

  function getActiveThemeId(){
    if(typeof AppState!=='undefined' && AppState.project && AppState.project.theme && ThemeRegistry.hasTheme(AppState.project.theme)){
      return AppState.project.theme;
    }
    return DEFAULT_THEME_ID;
  }
  function getActiveTheme(){ return getTheme(getActiveThemeId()); }

  // Sprint 9.3 — Artwork Themes are opt-in, unlike Story Themes: there
  // is no DEFAULT_ARTWORK_THEME_ID. `project.artworkTheme` is additive
  // (absent on every pre-9.3 project), so an unset/unknown/cleared id
  // resolves to null rather than falling back to some theme — "if no
  // Artwork Theme exists, render exactly as today" is enforced right
  // here, not by the renderer having to guess.
  function getActiveArtworkThemeId(){
    if(typeof AppState!=='undefined' && AppState.project && AppState.project.artworkTheme && ThemeRegistry.hasTheme(AppState.project.artworkTheme)){
      return AppState.project.artworkTheme;
    }
    return null;
  }
  function getActiveArtworkTheme(){
    const id=getActiveArtworkThemeId();
    return id ? ThemeRegistry.get(id) : null;
  }

  // Sprint 8.4.2 — Theme Designer Completion. Typography / Colours /
  // Picture Holder Defaults / Page Layout all ride on themeOptions
  // sub-objects. Empty sub-objects mean "use the active theme defaults"
  // — no project format change for legacy projects (the keys simply
  // don't exist there).
  const FONT_CHOICES=[
    {value:'',label:'Theme default'},
    {value:'Georgia, serif',label:'Storybook (Georgia)'},
    {value:'"Trebuchet MS", sans-serif',label:'Trebuchet'},
    {value:'"Comic Sans MS", "Chalkboard SE", cursive',label:'Comic'},
    {value:'"Helvetica Neue", Helvetica, Arial, sans-serif',label:'Helvetica'},
    {value:'"Times New Roman", Times, serif',label:'Times'},
    {value:'Arial, Helvetica, sans-serif',label:'Arial'},
    {value:'"Courier New", Courier, monospace',label:'Courier'}
  ];

  // Sprint 9.5 — Theme Language v2. A Story Theme may now carry an
  // optional `slide` block and/or an optional `holder` block —
  // `{presentation:'<id>', ...overrides}` — that seed these system
  // defaults through ThemePresets (Presentation Preset -> Theme
  // Overrides -> System Defaults, see js/themePresets.js). `holder` is
  // the sprint's "Frame" scope (Picture Holder look — cornerRadius/
  // padding/shadow/fill) named to match the schema
  // themeOptions.holder/getHolderDefaults() already use; it is NOT the
  // pre-existing `theme.frame` field (the book's outer frame COLOR,
  // read by _frameColor — an unrelated, Slide-level concept despite
  // the name). A theme with neither `slide` nor `holder` (every theme
  // before this sprint) falls straight through to the hardcoded values
  // below exactly as always. Storybook Classic's own `slide`/`holder`
  // presets are deliberately identical to these hardcoded values (see
  // themeRegistry.js) so the app's default theme — and every project
  // that has never touched Theme Designer — never sees a pixel of
  // difference from this change.
  function _defaultOptionsFor(theme){
    const base={
      variant:(theme.variants&&theme.variants[0])?theme.variants[0].id:'classic',
      panelStyle:'classic',
      footerStyle:'classic',
      decorations:[],
      pageNumber:'bottom-right',
      bookTitleVisibility:'show',
      bookTitlePosition:'bottom-left',
      handleVisibility:'show',
      handlePosition:'top-right',
      // Sprint 8.4.2 — new sub-objects. Empty == "follow the theme".
      typography:{},
      colours:{},
      holder:{},
      layout:{}
    };
    if(theme.slide && typeof ThemePresets!=='undefined'){
      const slideDefaults=ThemePresets.resolveSlide(theme.slide.presentation,theme.slide);
      delete slideDefaults.presentation;
      Object.assign(base,slideDefaults);
    }
    if(theme.holder && typeof ThemePresets!=='undefined'){
      const holderDefaults=ThemePresets.resolveFrame(theme.holder.presentation,theme.holder);
      delete holderDefaults.presentation;
      base.holder=Object.assign({},base.holder,holderDefaults);
    }
    return base;
  }
  function getFontChoices(){ return FONT_CHOICES.slice(); }

  function getOptions(){
    const t=getActiveTheme();
    const base=_defaultOptionsFor(t);
    const stored=(AppState&&AppState.project&&AppState.project.themeOptions)||{};
    const merged=Object.assign({},base,stored);
    if(!Array.isArray(merged.decorations)) merged.decorations=[];
    // Sprint 8.4.2 — guarantee sub-objects so callers can read keys
    // without a defensive lookup. Legacy projects whose themeOptions
    // pre-date these sub-objects converge here on first read.
    merged.typography=merged.typography||{};
    merged.colours=merged.colours||{};
    merged.holder=merged.holder||{};
    merged.layout=merged.layout||{};
    return merged;
  }

  // Sprint 8.4.2 — resolve the effective theme by layering themeOptions
  // typography / colours on top of the active theme. The renderer reads
  // this so an override at the Theme Designer level applies everywhere
  // the active theme would be read, without changing the theme record.
  function resolveTheme(){
    const base=getActiveTheme();
    const opts=getOptions();
    const ty=opts.typography||{};
    const co=opts.colours||{};
    const scale=(typeof ty.sizeScale==='number') ? ty.sizeScale : 1;
    function _scaledFont(spec){
      return {
        font:ty.fontFamily || spec.font,
        size:Math.round((spec.size||16) * scale),
        color:ty.color || spec.color
      };
    }
    return {
      id:base.id,
      name:base.name,
      description:base.description,
      suitableFor:base.suitableFor,
      frame:{ color: co.frame || base.frame.color },
      panel:{ color: co.panel || base.panel.color },
      storyText:_scaledFont(base.storyText),
      footerText:_scaledFont(base.footerText),
      watermark:_scaledFont(base.watermark),
      variants:base.variants,
      decorations:base.decorations
    };
  }
  // Sprint 8.4.2 — Picture Holder defaults read by the renderer / Card
  // Designer when no per-card border override is present.
  function getHolderDefaults(){
    return Object.assign({}, getOptions().holder||{});
  }
  function getPageLayout(){
    return Object.assign({margin:60,showSafeArea:false}, getOptions().layout||{});
  }

  function _writeOptions(opts){
    if(!AppState.project) return;
    AppState.project.themeOptions=opts;
  }

  function _reconcileOptionsForTheme(theme){
    if(!AppState.project) return;
    const cur=Object.assign({},_defaultOptionsFor(theme),AppState.project.themeOptions||{});
    if(!theme.variants || !theme.variants.find(function(v){ return v.id===cur.variant; })){
      cur.variant=(theme.variants&&theme.variants[0])?theme.variants[0].id:'classic';
    }
    const allowedDecos=new Set((theme.decorations||[]).map(function(d){ return d.id; }));
    cur.decorations=(cur.decorations||[]).filter(function(d){ return allowedDecos.has(d); });
    _writeOptions(cur);
  }

  function setOption(key,value,opts){
    if(!AppState.project) return;
    const cur=getOptions();
    cur[key]=value;
    _writeOptions(cur);
    _invalidateThumbnails();
    _syncControls(getActiveThemeId());
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
  }
  // Sprint 8.4.2 — sub-option setter. `group` ∈ {typography,colours,
  // holder,layout}; passing value === undefined removes the key. The
  // group sub-object is pruned (deleted) when it goes empty so saved
  // projects round-trip cleanly.
  function setSubOption(group,key,value,opts){
    if(!AppState.project) return;
    const cur=getOptions();
    const sub=Object.assign({},cur[group]||{});
    if(value===undefined || value===null || value===''){ delete sub[key]; }
    else { sub[key]=value; }
    cur[group]=sub;
    _writeOptions(cur);
    _invalidateThumbnails();
    _syncControls(getActiveThemeId());
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
  }
  function resetSubGroup(group,opts){
    if(!AppState.project) return;
    const cur=getOptions();
    cur[group]={};
    _writeOptions(cur);
    _invalidateThumbnails();
    _syncControls(getActiveThemeId());
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
  }

  function toggleDecoration(decoId,opts){
    const cur=getOptions();
    const set=new Set(cur.decorations||[]);
    if(set.has(decoId)) set.delete(decoId); else set.add(decoId);
    setOption('decorations',Array.from(set),opts);
  }

  function resolveFrameColor(theme,variantId){
    if(!theme||!theme.variants) return theme&&theme.frame?theme.frame.color:'#1D3457';
    const v=theme.variants.find(function(v){ return v.id===variantId; });
    return v?v.frameColor:theme.frame.color;
  }

  function _invalidateThumbnails(){
    // Sprint 9.1.3 — every slide's cached thumbnail must go, not just
    // slides with a bound image. Theme changes affect background /
    // typography / border / margins on every page (including cover +
    // hook + end pages that render without an uploaded image), so
    // keeping their stale thumbnails made the sidebar look like the
    // theme change wasn't global.
    if(typeof AppState==='undefined' || !AppState.slides) return;
    AppState.slides.forEach(function(s){ delete s.thumbnail; });
  }

  function _refreshUI(){
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
    try{
      if(AppState&&AppState.slides&&AppState.slides[AppState.currentSlide] && typeof window.showSlide==='function'){
        window.showSlide(AppState.currentSlide);
      }
    }catch(e){}
    // Sprint 9.4 — Dynamic Theme Workspace. A theme change can add/
    // remove/reorder Frame, Holder, and Slide controls, so the right
    // panel needs to rebuild immediately here too, not just the canvas.
    try{ if(typeof CardDesigner!=='undefined') CardDesigner.refresh(); }catch(e){}
    try{ if(typeof PageDesigner!=='undefined') PageDesigner.rebuildWorkspace(); }catch(e){}
  }

  function _renderCurrentThemeName(themeId){
    const t=getTheme(themeId);
    const el=document.getElementById('currentThemeName');
    if(el) el.textContent=t.name;
  }

  function _renderLeftCard(themeId){
    const container=document.getElementById('leftThemeCard');
    if(!container) return;
    const t=getTheme(themeId);
    container.innerHTML='';
    const preview=document.createElement('div');
    preview.className='left-theme-card-preview';
    preview.style.background=t.frame.color;
    const inner=document.createElement('div');
    inner.className='left-theme-card-panel';
    inner.style.background=t.panel.color;
    preview.appendChild(inner);
    container.appendChild(preview);
    const info=document.createElement('div');
    info.className='left-theme-card-info';
    const name=document.createElement('div');
    name.className='left-theme-card-name';
    name.textContent=t.name;
    info.appendChild(name);
    const desc=document.createElement('div');
    desc.className='left-theme-card-desc';
    desc.textContent=t.description;
    info.appendChild(desc);
    container.appendChild(info);
  }

  function _syncControls(themeId){
    _renderLeftCard(themeId);
    _renderCurrentThemeName(themeId);
    _renderVariants();
    _markActiveOptions();
    _renderDecorations();
    _syncExtended();
  }

  // Sprint 8.4.2 — sync Typography / Colours / Picture Holder Defaults
  // / Page Layout controls with the current themeOptions sub-objects.
  function _syncExtended(){
    const opts=getOptions();
    const theme=getActiveTheme();
    const ty=opts.typography||{};
    const co=opts.colours||{};
    const hd=opts.holder||{};
    const ly=opts.layout||{};

    function _val(el, value){ if(el) el.value=value; }
    function _txt(id, text){ const el=document.getElementById(id); if(el) el.textContent=text; }
    function _check(el, on){ if(el) el.checked=!!on; }

    const fontSelect=document.getElementById('themeStoryFont');
    if(fontSelect) fontSelect.value=ty.fontFamily||'';

    const scaleSlider=document.getElementById('themeTextScale');
    const scale=(typeof ty.sizeScale==='number')?ty.sizeScale:1;
    _val(scaleSlider,String(scale));
    _txt('themeTextScaleValue',Math.round(scale*100)+'%');

    const textColor=document.getElementById('themeTextColor');
    if(textColor) textColor.value=_safeColor(ty.color || (theme.storyText && theme.storyText.color) || '#FFFFFF');

    const pageColor=document.getElementById('themePageColor');
    if(pageColor) pageColor.value=_safeColor(co.frame || (theme.frame && theme.frame.color) || '#1D3457');

    const panelColor=document.getElementById('themePanelColor');
    if(panelColor) panelColor.value=_safeColor(co.panel || (theme.panel && theme.panel.color) || '#FFFFFF');

    const holderRadius=document.getElementById('themeHolderRadius');
    const hr=(typeof hd.cornerRadius==='number')?hd.cornerRadius:0;
    _val(holderRadius,String(hr));
    _txt('themeHolderRadiusValue',hr+'px');

    const holderPadding=document.getElementById('themeHolderPadding');
    const hp=(typeof hd.padding==='number')?hd.padding:0;
    _val(holderPadding,String(hp));
    _txt('themeHolderPaddingValue',hp+'px');

    _check(document.getElementById('themeHolderShadow'), hd.shadow);

    const margin=(typeof ly.margin==='number')?ly.margin:60;
    _val(document.getElementById('themePageMargin'),String(margin));
    _txt('themePageMarginValue',margin+'px');
    _check(document.getElementById('themeSafeArea'), ly.showSafeArea);
  }

  function _safeColor(c){
    if(typeof c!=='string') return '#ffffff';
    const m=c.match(/^#?[0-9a-f]{6}/i);
    return m ? ('#'+m[0].replace('#','').toLowerCase()) : '#ffffff';
  }

  function _renderVariants(){
    const container=document.getElementById('themeVariants');
    if(!container) return;
    const t=getActiveTheme();
    const opts=getOptions();
    const panelColor=(t.panel&&t.panel.color)||'#FFFFFF';
    container.innerHTML='';
    (t.variants||[]).forEach(function(v){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='variant-card';
      btn.setAttribute('data-variant-id',v.id);
      const preview=document.createElement('span');
      preview.className='variant-preview';
      preview.style.background=v.frameColor;
      const inner=document.createElement('span');
      inner.className='variant-preview-panel';
      inner.style.background=panelColor;
      preview.appendChild(inner);
      btn.appendChild(preview);
      const label=document.createElement('span');
      label.className='variant-label';
      label.textContent=v.name;
      btn.appendChild(label);
      if(v.id===opts.variant) btn.classList.add('active');
      btn.addEventListener('click',function(){ setOption('variant',v.id); });
      container.appendChild(btn);
    });
  }

  function _markActiveOptions(){
    const opts=getOptions();
    [
      ['panelStyles','panelStyle'],
      ['footerStyles','footerStyle'],
      ['pageNumberStyles','pageNumber'],
      ['bookTitleVisibility','bookTitleVisibility'],
      ['bookTitlePosition','bookTitlePosition'],
      ['handleVisibility','handleVisibility'],
      ['handlePosition','handlePosition']
    ].forEach(function(pair){
      const containerId=pair[0], key=pair[1];
      const container=document.getElementById(containerId);
      if(!container) return;
      container.querySelectorAll('.icon-card').forEach(function(p){
        p.classList.toggle('active', p.getAttribute('data-value')===opts[key]);
      });
    });
  }

  const DECO_GLYPH={ stars:'★', clouds:'☁', birds:'✦', trees:'▲', flowers:'✿' };

  // Sprint 9.4 — generalized to accept any container so the Slide panel
  // (Page Designer's Story tab) can mount the exact same decorations
  // picker the Theme Designer tab already has, reusing this render/
  // toggle logic verbatim rather than duplicating it. Theme Designer's
  // own call (below) keeps passing #decorationsList so nothing there
  // changes.
  function _renderDecorations(container){
    container=container||document.getElementById('decorationsList');
    if(!container) return;
    const t=getActiveTheme();
    const opts=getOptions();
    const allowed=t.decorations||[];
    container.innerHTML='';
    if(allowed.length===0){
      const note=document.createElement('p');
      note.className='placeholder';
      note.textContent='This theme has no decorations.';
      container.appendChild(note);
      return;
    }
    const enabled=new Set(opts.decorations||[]);
    allowed.forEach(function(d){
      const card=_makeIconCard(d.id,d.name,function(preview){
        const sym=document.createElement('div');
        sym.className='icon-deco';
        sym.textContent=DECO_GLYPH[d.id]||'•';
        preview.appendChild(sym);
      });
      if(enabled.has(d.id)) card.classList.add('active');
      card.addEventListener('click',function(){ toggleDecoration(d.id); });
      container.appendChild(card);
    });
  }

  function _makeIconCard(value,label,decorator){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='icon-card';
    btn.setAttribute('data-value',value);
    const preview=document.createElement('span');
    preview.className='icon-preview';
    if(decorator) decorator(preview);
    btn.appendChild(preview);
    const lbl=document.createElement('span');
    lbl.className='icon-label';
    lbl.textContent=label;
    btn.appendChild(lbl);
    return btn;
  }

  function _decorPanel(id){
    return function(preview){
      const inner=document.createElement('span');
      inner.className='icon-panel icon-panel-'+id;
      preview.appendChild(inner);
    };
  }

  function _decorFooter(id){
    return function(preview){
      if(id==='hidden') return;
      const line=document.createElement('span');
      line.className='icon-footer-line icon-footer-'+id;
      preview.appendChild(line);
    };
  }

  function _decorPosition(id){
    return function(preview){
      if(id==='hidden'){
        const cross=document.createElement('span');
        cross.className='icon-cross';
        preview.appendChild(cross);
        return;
      }
      const dot=document.createElement('span');
      dot.className='icon-dot icon-dot-'+id;
      preview.appendChild(dot);
    };
  }

  function _decorVisibility(id){
    return function(preview){
      const glyph=document.createElement('span');
      glyph.className='icon-vis icon-vis-'+id;
      glyph.textContent=id==='show'?'●':'○';
      preview.appendChild(glyph);
    };
  }

  function _buildIconRow(containerId,items,optionKey,decoratorFor){
    const container=document.getElementById(containerId);
    if(!container) return;
    container.innerHTML='';
    items.forEach(function(it){
      const card=_makeIconCard(it.id,it.name,decoratorFor(it.id));
      card.addEventListener('click',function(){ setOption(optionKey,it.id); });
      container.appendChild(card);
    });
  }


  function applyTheme(themeId,opts){
    const t=getTheme(themeId);
    const resolvedId=t.id;
    if(typeof AppState!=='undefined' && AppState.project){
      AppState.project.theme=resolvedId;
    }
    _reconcileOptionsForTheme(t);
    _syncControls(resolvedId);
    _invalidateThumbnails();
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
    return t;
  }

  // Sprint 9.3 — applies/clears the Artwork Theme. `themeId===null`
  // clears it back to "no artwork theme" (see the "None" card in
  // buildPickerCards). Reuses the exact same refresh path as
  // applyTheme (_invalidateThumbnails + _refreshUI) — "Live Preview:
  // Selecting an Artwork Theme updates artwork presentation
  // immediately, no page reload" falls straight out of that, the same
  // way a Story Theme change already refreshes every page instantly.
  function applyArtworkTheme(themeId,opts){
    const resolvedId=themeId ? (ThemeRegistry.hasTheme(themeId) ? themeId : null) : null;
    if(typeof AppState!=='undefined' && AppState.project){
      AppState.project.artworkTheme=resolvedId;
    }
    _invalidateThumbnails();
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
    return resolvedId ? ThemeRegistry.get(resolvedId) : null;
  }

  function buildLeftPaneCard(){
    _renderLeftCard(getActiveThemeId());
  }

  // Sprint 9.3 — a Story Theme card previews frame/panel colour, same
  // as always. An Artwork Theme has no frame/panel object (its
  // `frame` is a preset name, not a colour) — its card previews the
  // background preset instead, using the same swatch markup so no new
  // CSS is needed. See renderer/slideRenderer.js's ARTWORK_BACKGROUND_
  // FILL for the canvas-side equivalent of this map; kept separate
  // (CSS swatch vs. canvas fill) rather than shared, since forcing one
  // constant across a CSS module and a Canvas module buys nothing.
  const ARTWORK_BACKGROUND_PREVIEW={
    white:'#FFFFFF', cream:'#F7F1E3', 'kraft-paper':'#C9A66B',
    'watercolor-paper':'#F0EAE0', 'notebook-paper':'#F4F6FA',
    black:'#1A1A1A', transparent:'#FFFFFF', 'bulletin-board':'#C9A876'
  };

  // Sprint 9.2 — one card renderer shared by every Theme Library
  // section. Sprint 9.3 — `type` picks which fields the preview reads
  // and which apply function a click calls; markup is identical
  // either way.
  function _renderThemeCard(t,activeId,type){
    const card=document.createElement('button');
    card.type='button';
    card.className='theme-card';
    card.setAttribute('data-theme-id',t.id);
    if(t.id===activeId) card.classList.add('active');
    const preview=document.createElement('div');
    preview.className='theme-card-preview';
    const panel=document.createElement('div');
    panel.className='theme-card-panel';
    if(type==='artwork'){
      preview.style.background=ARTWORK_BACKGROUND_PREVIEW[t.background]||'#EFEFEF';
      panel.style.background='#8FA6C9';
    }else{
      preview.style.background=t.frame.color;
      panel.style.background=t.panel.color;
    }
    preview.appendChild(panel);
    card.appendChild(preview);
    const name=document.createElement('div');
    name.className='theme-card-name';
    name.textContent=t.name;
    card.appendChild(name);
    const desc=document.createElement('div');
    desc.className='theme-card-desc';
    desc.textContent=t.description;
    card.appendChild(desc);
    card.addEventListener('click',function(){
      if(type==='artwork') applyArtworkTheme(t.id);
      else applyTheme(t.id);
      closeThemePicker();
    });
    return card;
  }

  // Sprint 9.3 — Artwork Themes are opt-in (no default), so the
  // Artwork Themes section always leads with an explicit "None" tile
  // that clears the selection back to today's plain presentation.
  function _renderNoneArtworkCard(activeId){
    const card=document.createElement('button');
    card.type='button';
    card.className='theme-card';
    card.setAttribute('data-theme-id','');
    if(!activeId) card.classList.add('active');
    const preview=document.createElement('div');
    preview.className='theme-card-preview';
    preview.style.background='#EFEFEF';
    const panel=document.createElement('div');
    panel.className='theme-card-panel';
    panel.style.background='#FFFFFF';
    preview.appendChild(panel);
    card.appendChild(preview);
    const name=document.createElement('div');
    name.className='theme-card-name';
    name.textContent='None';
    card.appendChild(name);
    const desc=document.createElement('div');
    desc.className='theme-card-desc';
    desc.textContent='Pictures render exactly as they do today.';
    card.appendChild(desc);
    card.addEventListener('click',function(){
      applyArtworkTheme(null);
      closeThemePicker();
    });
    return card;
  }

  // Sprint 9.2 — Theme Library, extended by Sprint 9.3 to show Story
  // Themes and Artwork Themes as two type sections, each still split
  // into Official / Imported. Renders from ThemeRegistry.getCatalog()
  // so an imported theme of either type appears the moment it's
  // registered — no other change to how a theme is picked or applied.
  function _fillThemeSection(containerId,themes,activeId,type,emptyText){
    const el=document.getElementById(containerId);
    if(!el) return;
    el.innerHTML='';
    if(themes.length===0 && emptyText){
      const note=document.createElement('p');
      note.className='placeholder';
      note.textContent=emptyText;
      el.appendChild(note);
      return;
    }
    themes.forEach(function(t){ el.appendChild(_renderThemeCard(t,activeId,type)); });
  }
  function buildPickerCards(){
    const el=document.getElementById('themePickerCards');
    if(!el) return;
    const catalog=ThemeRegistry.getCatalog();

    const storyActiveId=getActiveThemeId();
    _fillThemeSection('themeLibraryStoryOfficial',catalog.story.official,storyActiveId,'story',null);
    _fillThemeSection('themeLibraryStoryImported',catalog.story.imported,storyActiveId,'story','No imported themes yet.');

    const artworkActiveId=getActiveArtworkThemeId();
    const artworkOfficialEl=document.getElementById('themeLibraryArtworkOfficial');
    if(artworkOfficialEl){
      artworkOfficialEl.innerHTML='';
      artworkOfficialEl.appendChild(_renderNoneArtworkCard(artworkActiveId));
      catalog.artwork.official.forEach(function(t){ artworkOfficialEl.appendChild(_renderThemeCard(t,artworkActiveId,'artwork')); });
    }
    _fillThemeSection('themeLibraryArtworkImported',catalog.artwork.imported,artworkActiveId,'artwork','No imported themes yet.');

    _wireImportButton();
  }

  // ---------- Theme Import (Sprint 9.2) ----------
  // Click Import -> choose .vtheme -> validate -> register -> refresh
  // Theme Library -> theme is immediately available. Mirrors
  // ProjectManager.openProject(file)'s FileReader + try/catch shape,
  // and alert()s a friendly message on failure the same way app.js
  // does for a failed project open — never throws past this function.
  function _wireImportButton(){
    const btn=document.getElementById('importThemeBtn');
    const input=document.getElementById('importThemeInput');
    if(!btn || !input) return;
    if(!btn.__themeWired){
      btn.addEventListener('click',function(){ input.click(); });
      btn.__themeWired=true;
    }
    if(!input.__themeWired){
      input.addEventListener('change',function(e){
        const file=e.target.files && e.target.files[0];
        e.target.value='';
        if(file) importThemeFile(file);
      });
      input.__themeWired=true;
    }
  }

  function _readFileAsText(file){
    return new Promise(function(resolve,reject){
      const reader=new FileReader();
      reader.onload=function(){ resolve(reader.result); };
      reader.onerror=function(){ reject(new Error('Could not read file')); };
      reader.readAsText(file);
    });
  }

  function importThemeFile(file){
    return _readFileAsText(file).then(function(text){
      let pkg;
      try{ pkg=JSON.parse(text); }
      catch(e){ alert('Could not import theme: this file is not valid JSON.'); return; }

      const result=ThemeRegistry.importPackage(pkg);
      if(result.ok){ buildPickerCards(); return; }
      if(result.problems && result.problems.length){
        alert('Could not import theme:\n'+result.problems.join('\n'));
        return;
      }
      if(result.duplicate){
        _showImportConflict(pkg);
        return;
      }
      // result.cancelled or any other non-ok outcome — nothing to do.
    }).catch(function(err){
      alert('Could not import theme: '+(err&&err.message?err.message:'unknown error'));
    });
  }

  // Replace Existing Theme / Keep Both / Cancel — same modal shape as
  // app.js's restore-session prompt, kept local to ThemeEngine since
  // it's purely an implementation detail of the import flow.
  function _showImportConflict(pkg){
    const modal=document.getElementById('themeImportConflictModal');
    const body=document.getElementById('themeImportConflictBody');
    const cancelBtn=document.getElementById('themeImportConflictCancel');
    const copyBtn=document.getElementById('themeImportConflictCopy');
    const replaceBtn=document.getElementById('themeImportConflictReplace');
    if(!modal || !cancelBtn || !copyBtn || !replaceBtn){
      // No conflict UI available — default to the safe, non-destructive
      // choice rather than silently failing the import.
      const result=ThemeRegistry.importPackage(pkg,{onDuplicate:'copy'});
      if(result.ok) buildPickerCards();
      return;
    }
    const existing=ThemeRegistry.get(pkg.manifest.id);
    if(body) body.textContent='"'+(pkg.manifest.name||pkg.manifest.id)+'" uses the same ID as an existing theme'+(existing&&existing.name?(' ("'+existing.name+'")'):'')+'. What would you like to do?';
    function _finish(mode){
      modal.classList.add('hidden');
      cancelBtn.onclick=null; copyBtn.onclick=null; replaceBtn.onclick=null;
      if(mode==='cancel') return;
      const result=ThemeRegistry.importPackage(pkg,{onDuplicate:mode});
      if(result.ok) buildPickerCards();
      else if(result.problems && result.problems.length) alert('Could not import theme:\n'+result.problems.join('\n'));
    }
    cancelBtn.onclick=function(){ _finish('cancel'); };
    copyBtn.onclick=function(){ _finish('copy'); };
    replaceBtn.onclick=function(){ _finish('replace'); };
    // Property assignment (not addEventListener) so each call rebinds
    // to *this* pkg's _finish instead of accumulating stale closures
    // from a previous import's conflict prompt.
    modal.onclick=function(e){ if(e.target===modal) _finish('cancel'); };
    modal.classList.remove('hidden');
  }

  function openThemePicker(){
    const modal=document.getElementById('themePickerModal');
    if(!modal) return;
    buildPickerCards();
    modal.classList.remove('hidden');
  }
  function closeThemePicker(){
    const modal=document.getElementById('themePickerModal');
    if(modal) modal.classList.add('hidden');
  }

  function buildDesigner(){
    _buildIconRow('panelStyles',PANEL_STYLES,'panelStyle',_decorPanel);
    _buildIconRow('footerStyles',FOOTER_STYLES,'footerStyle',_decorFooter);
    _buildIconRow('pageNumberStyles',PAGE_NUMBER_STYLES,'pageNumber',_decorPosition);
    _buildIconRow('bookTitleVisibility',VISIBILITY,'bookTitleVisibility',_decorVisibility);
    _buildIconRow('bookTitlePosition',BOOK_TITLE_POSITIONS,'bookTitlePosition',_decorPosition);
    _buildIconRow('handleVisibility',VISIBILITY,'handleVisibility',_decorVisibility);
    _buildIconRow('handlePosition',HANDLE_POSITIONS,'handlePosition',_decorPosition);
    _wireExtendedControls();
    _syncControls(getActiveThemeId());
  }

  // Sprint 8.4.2 — wire the Typography / Colours / Picture Holder
  // Defaults / Page Layout control rows. Idempotent: if an input has
  // already been wired in a previous mount, the marker guards a
  // double-attach.
  function _wireExtendedControls(){
    const fontSelect=document.getElementById('themeStoryFont');
    if(fontSelect && !fontSelect.__themeWired){
      fontSelect.innerHTML='';
      FONT_CHOICES.forEach(function(c){
        const opt=document.createElement('option');
        opt.value=c.value; opt.textContent=c.label;
        fontSelect.appendChild(opt);
      });
      fontSelect.addEventListener('change',function(){
        setSubOption('typography','fontFamily',fontSelect.value||undefined);
      });
      fontSelect.__themeWired=true;
    }
    function _wireSlider(id,group,key,format,defaultVal){
      const el=document.getElementById(id);
      if(!el || el.__themeWired) return;
      el.addEventListener('input',function(){
        const n=parseFloat(el.value);
        const out=document.getElementById(id+'Value');
        if(out) out.textContent=format(n);
        if(n===defaultVal) setSubOption(group,key,undefined);
        else setSubOption(group,key,n);
      });
      el.__themeWired=true;
    }
    _wireSlider('themeTextScale','typography','sizeScale',function(v){ return Math.round(v*100)+'%'; },1);
    _wireSlider('themeHolderRadius','holder','cornerRadius',function(v){ return Math.round(v)+'px'; },0);
    _wireSlider('themeHolderPadding','holder','padding',function(v){ return Math.round(v)+'px'; },0);
    _wireSlider('themePageMargin','layout','margin',function(v){ return Math.round(v)+'px'; },60);

    function _wireColor(id,group,key){
      const el=document.getElementById(id);
      if(!el || el.__themeWired) return;
      el.addEventListener('input',function(){
        setSubOption(group,key,el.value);
      });
      el.__themeWired=true;
    }
    _wireColor('themeTextColor','typography','color');
    _wireColor('themePageColor','colours','frame');
    _wireColor('themePanelColor','colours','panel');

    function _wireToggle(id,group,key){
      const el=document.getElementById(id);
      if(!el || el.__themeWired) return;
      el.addEventListener('change',function(){
        if(el.checked) setSubOption(group,key,true);
        else setSubOption(group,key,undefined);
      });
      el.__themeWired=true;
    }
    _wireToggle('themeHolderShadow','holder','shadow');
    _wireToggle('themeSafeArea','layout','showSafeArea');

    function _wireReset(id,group){
      const el=document.getElementById(id);
      if(!el || el.__themeWired) return;
      el.addEventListener('click',function(){ resetSubGroup(group); });
      el.__themeWired=true;
    }
    _wireReset('themeTypographyReset','typography');
    _wireReset('themeColoursReset','colours');
    _wireReset('themeHolderReset','holder');
    _wireReset('themeLayoutReset','layout');
  }

  const api={
    DEFAULT_THEME_ID:DEFAULT_THEME_ID,
    getTheme:getTheme,
    getAllThemes:getAllThemes,
    getActiveTheme:getActiveTheme,
    getActiveThemeId:getActiveThemeId,
    getActiveArtworkTheme:getActiveArtworkTheme,
    getActiveArtworkThemeId:getActiveArtworkThemeId,
    applyArtworkTheme:applyArtworkTheme,
    getPanelStyles:getPanelStyles,
    getFooterStyles:getFooterStyles,
    getPageNumberStyles:getPageNumberStyles,
    getVisibility:getVisibility,
    getBookTitlePositions:getBookTitlePositions,
    getHandlePositions:getHandlePositions,
    getFontChoices:getFontChoices,
    getOptions:getOptions,
    setOption:setOption,
    setSubOption:setSubOption,
    resetSubGroup:resetSubGroup,
    toggleDecoration:toggleDecoration,
    resolveFrameColor:resolveFrameColor,
    resolveTheme:resolveTheme,
    getHolderDefaults:getHolderDefaults,
    getPageLayout:getPageLayout,
    applyTheme:applyTheme,
    registerTheme:registerTheme,
    buildLeftPaneCard:buildLeftPaneCard,
    buildDesigner:buildDesigner,
    openThemePicker:openThemePicker,
    closeThemePicker:closeThemePicker,
    importThemeFile:importThemeFile,
    renderDecorationsInto:_renderDecorations
  };
  try{ window.ThemeEngine=api; }catch(e){}
  return api;
})();
