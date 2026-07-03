// themeRegistry.js — Sprint 9.2 Theme Library Foundation.
//
// ThemeRegistry is the single abstraction layer between theme
// storage and ThemeEngine. ThemeEngine no longer owns a hardcoded
// BUILTIN_THEMES array or reads/writes localStorage for themes — it
// asks ThemeRegistry for a theme by id, or for the merged catalog,
// and never knows (or needs to know) whether the answer came from
// the themes bundled with the app or one a child imported.
//
//   ThemeEngine
//        |
//   ThemeRegistry
//        |
//   Official Themes    Imported Themes
//        |                   |
//        +-- Merged Theme Catalog --+
//
// This mirrors the same registry shape storyDestinations.js already
// established for publishing destinations (list / find / register /
// validate) — same mental model, applied to themes.
//
// ===========================================================
// Theme record shape (internal)
// ===========================================================
// Every registered theme is stored as:
//   { manifest: {...}, theme: {...}, source: 'official'|'imported' }
//
// `theme` is always the flat object shape ThemeEngine and the
// renderer have consumed since before this sprint — id, name,
// description, suitableFor, frame, panel, storyText, footerText,
// watermark, variants, decorations. Nothing downstream (renderer,
// Card Designer, Theme Designer) needs to change or even know
// manifests exist.
//
// ===========================================================
// Theme Package format (.vtheme — plain, human-readable JSON)
// ===========================================================
//   {
//     "manifest": { id, name, version, author, description, category,
//                   tags, thumbnail, createdDate, updatedDate,
//                   minStudioVersion },
//     "theme": { ...same shape as above... },
//     "assets": {}
//   }
//
// Not zipped, not compressed — a plain .vtheme is just JSON with a
// distinct extension so it can evolve into a packaged (asset-bundled)
// format later without changing this module's public API.
//
// ===========================================================
// Scope (Sprint 9.2)
// ===========================================================
// Registry + Library + Official registration + Import + Validation +
// Metadata only. Theme Creator, Theme Editor, Theme Export, Duplicate
// Theme, Community Themes and the Theme Marketplace are explicitly
// out of scope — this module's job is to make their eventual arrival
// additive (new sources feeding the same registry), not another
// architecture change.
const ThemeRegistry=(function(){
  'use strict';

  // Theme system compatibility version. Deliberately independent of
  // the app build shown in the dev footer (build-info.json is
  // release/CI metadata, fetched async, unrelated to theme-package
  // shape) — this is what a .vtheme's minStudioVersion is checked
  // against. Bump only when the theme object shape changes in a way
  // that could break older packages.
  const THEME_SYSTEM_VERSION='9.2.0';

  const IMPORTED_STORAGE_KEY='vihu.themeRegistry.imported.v1';

  const REQUIRED_MANIFEST_FIELDS=[
    'id','name','version','author','description','category',
    'tags','thumbnail','createdDate','updatedDate','minStudioVersion'
  ];
  const REQUIRED_THEME_FIELDS=['frame','panel','storyText','footerText','watermark'];

  // ---------- Official Themes ----------
  // Moved here verbatim from themeEngine.js (Sprint 9.2) — same ids,
  // same field values, same variants/decorations. ThemeEngine no
  // longer owns this array; it asks ThemeRegistry for a theme by id
  // exactly like it would for an imported one. No existing project
  // or story changes as a result — see registerOfficial() below,
  // which wraps each entry in an auto-derived manifest but never
  // touches the theme object's own fields.
  const OFFICIAL_THEMES=[
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

  // id -> {manifest, theme, source}. Single map so resolution
  // (get/list) is always O(1) and "last write wins" the same way the
  // pre-Sprint-9.2 registry already worked (registerTheme(theme)
  // simply did registry[theme.id]=theme).
  const _registry={};
  // Preserves registration order per source for stable catalog/UI
  // ordering — the map above doesn't guarantee iteration order once
  // entries are replaced.
  let _officialOrder=[];
  let _importedOrder=[];

  function _cmpVersions(a,b){
    const pa=String(a||'0').split('.').map(function(n){ return parseInt(n,10)||0; });
    const pb=String(b||'0').split('.').map(function(n){ return parseInt(n,10)||0; });
    for(let i=0;i<Math.max(pa.length,pb.length);i++){
      const x=pa[i]||0, y=pb[i]||0;
      if(x!==y) return x<y?-1:1;
    }
    return 0;
  }
  // A package is compatible if its minStudioVersion is <= what this
  // build of the Theme Registry supports.
  function isCompatible(minStudioVersion){
    return _cmpVersions(minStudioVersion, THEME_SYSTEM_VERSION)<=0;
  }

  function hasTheme(id){ return !!(id && _registry[id]); }
  function getRecord(id){ return (id && _registry[id]) || null; }
  function get(id){
    const rec=getRecord(id);
    return rec ? rec.theme : null;
  }
  function list(){
    return _officialOrder.concat(_importedOrder)
      .map(function(id){ return _registry[id]; })
      .filter(function(rec){ return !!rec; })
      .map(function(rec){ return rec.theme; });
  }
  // The Theme Library's two sections. Filters the *current* source of
  // each live id rather than a frozen snapshot, so a replaced/shadowed
  // theme shows under the section that actually governs it.
  function getCatalog(){
    return {
      official:_officialOrder.filter(function(id){ return _registry[id]&&_registry[id].source==='official'; })
        .map(function(id){ return _registry[id].theme; }),
      imported:_importedOrder.filter(function(id){ return _registry[id]&&_registry[id].source==='imported'; })
        .map(function(id){ return _registry[id].theme; })
    };
  }

  // ---------- validation ----------
  // Returns an array of human-readable problem strings; empty = valid.
  // Never throws. Duplicate-id handling is intentionally NOT a
  // validation failure — it's a separate, recoverable decision
  // (Replace / Keep Both / Cancel) handled by importPackage below.
  function validatePackage(pkg){
    const problems=[];
    if(!pkg || typeof pkg!=='object' || Array.isArray(pkg)){
      problems.push('This file is not a valid theme package.');
      return problems;
    }
    const manifest=pkg.manifest;
    if(!manifest || typeof manifest!=='object'){
      problems.push('Missing "manifest" section.');
    }else{
      REQUIRED_MANIFEST_FIELDS.forEach(function(f){
        if(manifest[f]===undefined || manifest[f]===null){ problems.push('Manifest is missing "'+f+'".'); }
      });
      if(manifest.id!==undefined && !/^[a-z0-9][a-z0-9-]*$/i.test(String(manifest.id))){
        problems.push('Theme id may only contain letters, numbers and hyphens.');
      }
      if(manifest.minStudioVersion!==undefined && !isCompatible(manifest.minStudioVersion)){
        problems.push('This theme needs a newer version of VihuStudio (requires '+manifest.minStudioVersion+').');
      }
    }
    if(!pkg.theme || typeof pkg.theme!=='object'){
      problems.push('Missing "theme" section.');
    }else{
      REQUIRED_THEME_FIELDS.forEach(function(f){
        if(!pkg.theme[f]){ problems.push('Theme is missing "'+f+'".'); }
      });
    }
    return problems;
  }

  // ---------- registration ----------
  // Official themes are the existing BUILTIN_THEMES-shaped objects —
  // no manifest of their own on disk. Wraps each in an auto-derived
  // manifest so they flow through the exact same {manifest,theme}
  // record shape as an imported .vtheme. Idempotent: calling this
  // again (e.g. a hot reload) never duplicates an id.
  function registerOfficial(themes){
    (themes||[]).forEach(function(t){
      if(!t || !t.id || _registry[t.id]) return;
      _registry[t.id]={
        manifest:{
          id:t.id, name:t.name, version:'1.0.0', author:'Vihu',
          description:t.description||'', category:'Official', tags:[],
          thumbnail:'', createdDate:'', updatedDate:'',
          minStudioVersion:THEME_SYSTEM_VERSION
        },
        theme:t,
        source:'official'
      };
      _officialOrder.push(t.id);
    });
  }

  function _setImported(manifest,theme){
    const id=manifest.id;
    if(!_registry[id]){
      // Brand-new id — track it in imported order. If it previously
      // only existed as official, _officialOrder still lists it, but
      // getCatalog() filters by *current* source, so it silently
      // stops appearing under Official once it's imported here.
      _importedOrder.push(id);
    }else if(_registry[id].source==='official' && _importedOrder.indexOf(id)===-1){
      _importedOrder.push(id);
    }
    _registry[id]={ manifest:manifest, theme:theme, source:'imported' };
  }

  // Registers a validated package, resolving an id collision per
  // opts.onDuplicate ('replace' | 'copy' | 'cancel' | undefined).
  // With no onDuplicate and a real collision, returns
  // {ok:false, duplicate:true} so the caller can ask the child what
  // to do and call importPackage again with a decision — the file
  // itself never needs to be re-picked.
  function importPackage(pkg,opts){
    opts=opts||{};
    const problems=validatePackage(pkg);
    if(problems.length>0) return {ok:false,problems:problems};

    const manifest=Object.assign({},pkg.manifest);
    const theme=Object.assign({},pkg.theme);
    theme.id=manifest.id; // registry identity is always manifest.id

    if(hasTheme(manifest.id)){
      const mode=opts.onDuplicate;
      if(!mode) return {ok:false,duplicate:true};
      if(mode==='cancel') return {ok:false,cancelled:true};
      if(mode==='copy'){
        let newId=manifest.id+'-copy', n=2;
        while(hasTheme(newId)){ newId=manifest.id+'-copy-'+n; n++; }
        manifest.id=newId;
        theme.id=newId;
      }
      // mode==='replace' falls through and overwrites in place.
    }

    _setImported(manifest,theme);
    _persistImported();
    return {ok:true,theme:theme,manifest:manifest};
  }

  // ---------- persistence (imported themes only — official themes
  // ship with the app and are never written to storage) ----------
  function _persistImported(){
    try{
      const packages=_importedOrder
        .map(function(id){ return _registry[id]; })
        .filter(function(rec){ return rec && rec.source==='imported'; })
        .map(function(rec){ return {manifest:rec.manifest,theme:rec.theme}; });
      localStorage.setItem(IMPORTED_STORAGE_KEY,JSON.stringify(packages));
    }catch(e){}
  }
  function _loadImported(){
    let packages=[];
    try{
      const raw=localStorage.getItem(IMPORTED_STORAGE_KEY);
      if(raw){ const parsed=JSON.parse(raw); if(Array.isArray(parsed)) packages=parsed; }
    }catch(e){ packages=[]; }
    packages.forEach(function(pkg){
      if(validatePackage(pkg).length>0) return; // silently skip corrupt entries, never crash boot
      _setImported(pkg.manifest,pkg.theme);
    });
  }

  // Self-initializing, same convention as storyDestinations.js's
  // REGISTRY — no separate init step required by ThemeEngine or
  // anything else that loads after this script.
  registerOfficial(OFFICIAL_THEMES);
  _loadImported();

  const api={
    THEME_SYSTEM_VERSION:THEME_SYSTEM_VERSION,
    isCompatible:isCompatible,
    hasTheme:hasTheme,
    get:get,
    getRecord:getRecord,
    list:list,
    getCatalog:getCatalog,
    validatePackage:validatePackage,
    registerOfficial:registerOfficial,
    importPackage:importPackage
  };
  try{ window.ThemeRegistry=api; }catch(e){}
  return api;
})();
