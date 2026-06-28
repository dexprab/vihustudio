const ThemeEngine=(function(){
  const DEFAULT_THEME_ID='storybook-classic';

  // Built-in themes. Each theme is a complete visual identity used by SlideRenderer.
  // Adding fields here is non-breaking; the renderer reads only what it needs.
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
      watermark:{ font:'Georgia, serif', size:24, color:'#FFFFFF' }
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
      watermark:{ font:'“Trebuchet MS”, sans-serif', size:24, color:'#F5E6D3' }
    },
    {
      id:'fun-comic',
      name:'Fun Comic',
      description:'Clean, high contrast, speech-bubble inspired.',
      suitableFor:'Playful adventures, jokes, energetic plots',
      frame:{ color:'#FFD700' },
      panel:{ color:'#FFFFFF' },
      storyText:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:58, color:'#111111' },
      footerText:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:24, color:'#111111' },
      watermark:{ font:'“Comic Sans MS”, “Chalkboard SE”, cursive', size:24, color:'#111111' }
    },
    {
      id:'minimal-elegant',
      name:'Minimal Elegant',
      description:'Simple, modern, focus on the artwork.',
      suitableFor:'Quiet stories, art-forward books, gallery style',
      frame:{ color:'#EFEFEF' },
      panel:{ color:'#FFFFFF' },
      storyText:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:54, color:'#222222' },
      footerText:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:22, color:'#444444' },
      watermark:{ font:'“Helvetica Neue”, Helvetica, Arial, sans-serif', size:22, color:'#888888' }
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

  function getAllThemes(){
    return BUILTIN_THEMES.slice();
  }

  function getActiveThemeId(){
    if(typeof AppState!=='undefined' && AppState.project && AppState.project.theme && registry[AppState.project.theme]){
      return AppState.project.theme;
    }
    return DEFAULT_THEME_ID;
  }

  function getActiveTheme(){
    return getTheme(getActiveThemeId());
  }

  function _invalidateThumbnails(){
    if(typeof AppState==='undefined' || !AppState.slides) return;
    AppState.slides.forEach(function(s){
      if(s.image){ delete s.thumbnail; }
    });
  }

  function _refreshUI(){
    try{ if(typeof window.renderList==='function') window.renderList(); }catch(e){}
    try{ if(typeof window.renderTimeline==='function') window.renderTimeline(); }catch(e){}
    try{
      const cur=(AppState&&AppState.slides)?AppState.slides[AppState.currentSlide]:null;
      if(cur && typeof window.showSlide==='function') window.showSlide(AppState.currentSlide);
    }catch(e){}
  }

  function _syncControls(themeId){
    const sel=document.getElementById('themeSelect');
    if(sel && sel.value!==themeId){ sel.value=themeId; }
    const cards=document.querySelectorAll('.theme-card');
    cards.forEach(function(card){
      card.classList.toggle('active', card.getAttribute('data-theme-id')===themeId);
    });
    _renderThemeInfo(themeId);
  }

  function _renderThemeInfo(themeId){
    const t=getTheme(themeId);
    const nameEl=document.getElementById('themeInfoName');
    const descEl=document.getElementById('themeInfoDescription');
    const suitEl=document.getElementById('themeInfoSuitable');
    if(nameEl) nameEl.textContent=t.name;
    if(descEl) descEl.textContent=t.description;
    if(suitEl) suitEl.textContent=t.suitableFor;
  }

  function applyTheme(themeId,opts){
    const t=getTheme(themeId);
    const resolvedId=t.id;
    if(typeof AppState!=='undefined' && AppState.project){
      AppState.project.theme=resolvedId;
    }
    _syncControls(resolvedId);
    _invalidateThumbnails();
    _refreshUI();
    if(!(opts&&opts.silent)){
      try{ if(typeof ProjectManager!=='undefined') ProjectManager.markDirty(); }catch(e){}
    }
    return t;
  }

  function populateSelector(selectEl){
    const el=selectEl||document.getElementById('themeSelect');
    if(!el) return;
    el.innerHTML='';
    BUILTIN_THEMES.forEach(function(t){
      const opt=document.createElement('option');
      opt.value=t.id;
      opt.textContent=t.name;
      el.appendChild(opt);
    });
    el.value=getActiveThemeId();
  }

  function buildCards(container){
    const el=container||document.getElementById('themeCards');
    if(!el) return;
    el.innerHTML='';
    BUILTIN_THEMES.forEach(function(t){
      const card=document.createElement('button');
      card.type='button';
      card.className='theme-card';
      card.setAttribute('data-theme-id',t.id);

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

      card.addEventListener('click',function(){ applyTheme(t.id); });
      el.appendChild(card);
    });
    _syncControls(getActiveThemeId());
  }

  const api={
    DEFAULT_THEME_ID:DEFAULT_THEME_ID,
    getTheme:getTheme,
    getAllThemes:getAllThemes,
    getActiveTheme:getActiveTheme,
    getActiveThemeId:getActiveThemeId,
    applyTheme:applyTheme,
    registerTheme:registerTheme,
    populateSelector:populateSelector,
    buildCards:buildCards
  };
  try{ window.ThemeEngine=api; }catch(e){}
  return api;
})();
