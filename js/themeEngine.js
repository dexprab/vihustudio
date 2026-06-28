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

  const BUILTIN_THEMES=[
    {
      id:'storybook-classic',
      name:'Storybook Classic',
      description:'Warm, rounded, friendly — traditional children’s book.',
      suitableFor:'Bedtime stories, fairy tales, soft narratives',
      frame:{ color:'#1D3457' },
      panel:{ color:'#FFFFFF' },
      storyText:{ font:'Georgia, serif', size:56, color:'#FFFFFF' },
      footerText:{ font:'Georgia, serif', size:24, color:'#FFFFFF' },
      watermark:{ font:'Georgia, serif', size:24, color:'#FFFFFF' },
      variants:[
        {id:'classic',name:'Classic',frameColor:'#1D3457'},
        {id:'vintage',name:'Vintage',frameColor:'#6B4423'},
        {id:'watercolor',name:'Watercolor',frameColor:'#7B9AC8'}
      ],
      decorations:[
        {id:'stars',name:'Stars'},
        {id:'clouds',name:'Clouds'},
        {id:'flowers',name:'Flowers'}
      ]
    },
    {
      id:'adventure',
      name:'Adventure',
      description:'Explorer, bold, nature inspired.',
      suitableFor:'Outdoor stories, journeys, discovery tales',
      frame:{ color:'#2D5016' },
      panel:{ color:'#F5E6D3' },
      storyText:{ font:'“Trebuchet MS”, sans-serif', size:58, color:'#F5E6D3' },
      footerText:{ font:'“Trebuchet MS”, sans-serif', size:24, color:'#F5E6D3' },
      watermark:{ font:'“Trebuchet MS”, sans-serif', size:24, color:'#F5E6D3' },
      variants:[
        {id:'jungle',name:'Jungle',frameColor:'#2D5016'},
        {id:'mountains',name:'Mountains',frameColor:'#5C6B7A'},
        {id:'ocean',name:'Ocean',frameColor:'#1B5F8C'},
        {id:'desert',name:'Desert',frameColor:'#C18E54'}
      ],
      decorations:[
        {id:'trees',name:'Trees'},
        {id:'birds',name:'Birds'},
        {id:'stars',name:'Stars'}
      ]
    },
    {
      id:'fun-comic',
      name:'Comic',
      description:'Clean, high contrast, speech-bubble inspired.',
      suitableFor:'Playful adventures, jokes, energetic plots',
      frame:{ color:'#FFD700' },
      panel:{ color:'#FFFFFF' },
      storyText:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:58, color:'#111111' },
      footerText:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:24, color:'#111111' },
      watermark:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:24, color:'#111111' },
      variants:[
        {id:'bold',name:'Bold',frameColor:'#FFD700'},
        {id:'action',name:'Action',frameColor:'#E63946'},
        {id:'newspaper',name:'Newspaper',frameColor:'#F5F0E8'}
      ],
      decorations:[
        {id:'stars',name:'Stars'},
        {id:'clouds',name:'Clouds'}
      ]
    },
    {
      id:'minimal-elegant',
      name:'Minimal',
      description:'Simple, modern, focus on the artwork.',
      suitableFor:'Quiet stories, art-forward books, gallery style',
      frame:{ color:'#EFEFEF' },
      panel:{ color:'#FFFFFF' },
      storyText:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:54, color:'#222222' },
      footerText:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:22, color:'#444444' },
      watermark:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:22, color:'#888888' },
      variants:[
        {id:'white',name:'White',frameColor:'#FFFFFF'},
        {id:'soft-grey',name:'Soft Grey',frameColor:'#EFEFEF'},
        {id:'linen',name:'Linen',frameColor:'#F4EFE6'}
      ],
      decorations:[]
    }
  ];

  const registry={};
  BUILTIN_THEMES.forEach(function(t){ registry[t.id]=t; });

  function registerTheme(theme){
    if(!theme||!theme.id) return false;
    registry[theme.id]=theme;
    return true;
  }
  function getTheme(id){
    if(id && registry[id]) return registry[id];
    return registry[DEFAULT_THEME_ID];
  }
  function getAllThemes(){ return BUILTIN_THEMES.slice(); }
  function getPanelStyles(){ return PANEL_STYLES.slice(); }
  function getFooterStyles(){ return FOOTER_STYLES.slice(); }
  function getPageNumberStyles(){ return PAGE_NUMBER_STYLES.slice(); }
  function getVisibility(){ return VISIBILITY.slice(); }
  function getBookTitlePositions(){ return BOOK_TITLE_POSITIONS.slice(); }
  function getHandlePositions(){ return HANDLE_POSITIONS.slice(); }

  function getActiveThemeId(){
    if(typeof AppState!=='undefined' && AppState.project && AppState.project.theme && registry[AppState.project.theme]){
      return AppState.project.theme;
    }
    return DEFAULT_THEME_ID;
  }
  function getActiveTheme(){ return getTheme(getActiveThemeId()); }

  function _defaultOptionsFor(theme){
    return {
      variant:(theme.variants&&theme.variants[0])?theme.variants[0].id:'classic',
      panelStyle:'classic',
      footerStyle:'classic',
      decorations:[],
      pageNumber:'bottom-right',
      bookTitleVisibility:'show',
      bookTitlePosition:'bottom-left',
      handleVisibility:'show',
      handlePosition:'top-right'
    };
  }

  function getOptions(){
    const t=getActiveTheme();
    const base=_defaultOptionsFor(t);
    const stored=(AppState&&AppState.project&&AppState.project.themeOptions)||{};
    const merged=Object.assign({},base,stored);
    if(!Array.isArray(merged.decorations)) merged.decorations=[];
    return merged;
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
    if(typeof AppState==='undefined' || !AppState.slides) return;
    AppState.slides.forEach(function(s){ if(s.image){ delete s.thumbnail; } });
  }

  function _refreshUI(){
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
    try{
      if(AppState&&AppState.slides&&AppState.slides[AppState.currentSlide] && typeof window.showSlide==='function'){
        window.showSlide(AppState.currentSlide);
      }
    }catch(e){}
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
  }

  function _renderVariants(){
    const container=document.getElementById('themeVariants');
    if(!container) return;
    const t=getActiveTheme();
    const opts=getOptions();
    container.innerHTML='';
    (t.variants||[]).forEach(function(v){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='variant-card';
      btn.setAttribute('data-variant-id',v.id);
      const swatch=document.createElement('span');
      swatch.className='variant-swatch';
      swatch.style.background=v.frameColor;
      btn.appendChild(swatch);
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

  function _renderDecorations(){
    const container=document.getElementById('decorationsList');
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

  function buildLeftPaneCard(){
    _renderLeftCard(getActiveThemeId());
  }

  function buildPickerCards(){
    const el=document.getElementById('themePickerCards');
    if(!el) return;
    el.innerHTML='';
    const activeId=getActiveThemeId();
    BUILTIN_THEMES.forEach(function(t){
      const card=document.createElement('button');
      card.type='button';
      card.className='theme-card';
      card.setAttribute('data-theme-id',t.id);
      if(t.id===activeId) card.classList.add('active');
      const preview=document.createElement('div');
      preview.className='theme-card-preview';
      preview.style.background=t.frame.color;
      const panel=document.createElement('div');
      panel.className='theme-card-panel';
      panel.style.background=t.panel.color;
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
        applyTheme(t.id);
        closeThemePicker();
      });
      el.appendChild(card);
    });
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
    _syncControls(getActiveThemeId());
  }

  const api={
    DEFAULT_THEME_ID:DEFAULT_THEME_ID,
    getTheme:getTheme,
    getAllThemes:getAllThemes,
    getActiveTheme:getActiveTheme,
    getActiveThemeId:getActiveThemeId,
    getPanelStyles:getPanelStyles,
    getFooterStyles:getFooterStyles,
    getPageNumberStyles:getPageNumberStyles,
    getVisibility:getVisibility,
    getBookTitlePositions:getBookTitlePositions,
    getHandlePositions:getHandlePositions,
    getOptions:getOptions,
    setOption:setOption,
    toggleDecoration:toggleDecoration,
    resolveFrameColor:resolveFrameColor,
    applyTheme:applyTheme,
    registerTheme:registerTheme,
    buildLeftPaneCard:buildLeftPaneCard,
    buildDesigner:buildDesigner,
    openThemePicker:openThemePicker,
    closeThemePicker:closeThemePicker
  };
  try{ window.ThemeEngine=api; }catch(e){}
  return api;
})();
