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
      handlePosition:'top-right',
      // Sprint 8.4.2 — new sub-objects. Empty == "follow the theme".
      typography:{},
      colours:{},
      holder:{},
      layout:{}
    };
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
    closeThemePicker:closeThemePicker
  };
  try{ window.ThemeEngine=api; }catch(e){}
  return api;
})();
