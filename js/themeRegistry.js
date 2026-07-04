// themeRegistry.js — Sprint 9.2 Theme Library Foundation,
// extended by Sprint 9.3 Artwork Themes.
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
// Theme types (Sprint 9.3)
// ===========================================================
// Every theme is one of two types, carried on manifest.type:
//   'story'   — the original Sprint 9.2 shape (frame/panel/storyText/
//               footerText/watermark/variants/decorations). Governs
//               the whole book. Unchanged by this sprint.
//   'artwork' — presentation-only: how a child's own picture is
//               framed/matted/captioned inside its holder. NEVER
//               touches the picture's pixels — see
//               renderer/slideRenderer.js's "Sprint 9.3" section for
//               how it's layered into the existing Picture Border
//               rendering. A project with no artwork theme selected
//               renders exactly as it did before this sprint existed.
// This is still ONE registry, ONE Theme Library, ONE import pipeline
// — type is just a field the catalog groups and validation branches
// on, not a parallel architecture (see Scope below).
//
// ===========================================================
// Theme record shape (internal)
// ===========================================================
// Every registered theme is stored as:
//   { manifest: {..., type:'story'|'artwork'}, theme: {...}, source: 'official'|'imported' }
//
// `theme` is the flat object shape ThemeEngine and the renderer
// consume — for a story theme, id/name/description/suitableFor/
// frame/panel/storyText/footerText/watermark/variants/decorations
// (unchanged since Sprint 9.2); for an artwork theme, id/name/
// description plus the optional presentation/background/frame/paper/
// caption/shadow/lighting/composition/enhancement fields. Nothing
// downstream needs to know manifests exist.
//
// ===========================================================
// Theme Package format (.vtheme — plain, human-readable JSON)
// ===========================================================
//   {
//     "manifest": { id, name, version, author, description, category,
//                   tags, thumbnail, createdDate, updatedDate,
//                   minStudioVersion, type },
//     "theme": { ...story or artwork shape, see above... },
//     "assets": {}
//   }
//
// Not zipped, not compressed — a plain .vtheme is just JSON with a
// distinct extension so it can evolve into a packaged (asset-bundled)
// format later without changing this module's public API. A package
// with no "type" (every .vtheme written before this sprint) is
// treated as 'story' — see _normalizeManifest.
//
// ===========================================================
// theme.editor (Sprint 9.4 — Dynamic Theme Workspace)
// ===========================================================
// Optional. Drives which controls js/workspaceBuilder.js shows in the
// right-side designer, in what order, for THIS theme — never the
// renderer (see renderer/slideRenderer.js, untouched by this sprint).
//   editor: {
//     slide:  { sections: ['background','decorations','title'] },
//     frame:  { sections: ['frameStyle','fill','border','radius','shadow','paper','mat'] },
//     holder: {
//       image:   ['presentation','artworkFrame','lighting','caption'],
//       text:    ['typography','alignment'],
//       sticker: ['stickerShadow']
//     }
//   }
// Each list entry is either a plain control-id string (uses
// WorkspaceBuilder's built-in default/options) or an object
// {id, default, min, max, options, label} to override those per-theme.
// Absent entirely, or missing a given panel, WorkspaceBuilder falls
// back to today's fixed control set for that panel — no migration
// required, same convention as a missing "type" (_normalizeManifest
// below) or Artwork Theme's optional presentation fields.
//
// ===========================================================
// Scope (Sprint 9.2, extended 9.3, extended 9.4)
// ===========================================================
// Registry + Library + Official registration + Import + Validation +
// Metadata, for both theme types. Theme Creator, Theme Editor, Theme
// Export, Duplicate Theme, Community Themes and the Theme Marketplace
// are explicitly out of scope — this module's job is to make their
// eventual arrival additive (new sources/types feeding the same
// registry), not another architecture change.
const ThemeRegistry=(function(){
  'use strict';

  // Theme system compatibility version. Deliberately independent of
  // the app build shown in the dev footer (build-info.json is
  // release/CI metadata, fetched async, unrelated to theme-package
  // shape) — this is what a .vtheme's minStudioVersion is checked
  // against. Bump only when the theme object shape changes in a way
  // that could break older packages. 9.3.0 — additive only (a package
  // with no "type" is treated as 'story', see _normalizePackage below)
  // so 9.2-era imported themes keep loading with zero migration.
  const THEME_SYSTEM_VERSION='9.3.0';

  const IMPORTED_STORAGE_KEY='vihu.themeRegistry.imported.v1';

  const REQUIRED_MANIFEST_FIELDS=[
    'id','name','version','author','description','category',
    'tags','thumbnail','createdDate','updatedDate','minStudioVersion'
  ];
  // Sprint 9.3 — Artwork Themes. "type" is deliberately NOT in
  // REQUIRED_MANIFEST_FIELDS: a 9.2-era package (or one already sitting
  // in a child's localStorage from before this sprint) has no "type"
  // field at all, and requiring it would silently drop those themes on
  // upgrade. _normalizePackage defaults a missing/invalid type to
  // 'story' instead — every pre-9.3 theme was a story theme, so this is
  // exactly what "no migration required" means in practice.
  const THEME_TYPES=['story','artwork'];
  const DEFAULT_THEME_TYPE='story';
  const REQUIRED_THEME_FIELDS=['frame','panel','storyText','footerText','watermark'];
  // Artwork Themes have no hard-required presentation fields — every
  // section (background/frame/paper/caption/shadow/lighting/
  // composition/enhancement) is explicitly optional per the sprint
  // spec ("Support the following optional sections"). Only enough to
  // identify and display the theme in the Library is required.
  const REQUIRED_ARTWORK_THEME_FIELDS=['name'];

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
      ],
      // Sprint 9.4 — the baseline editor config: today's default control
      // set, spelled out explicitly so this theme (the app's default)
      // documents the workspace contract by example.
      editor:{
        slide:{sections:['background','decorations','title']},
        frame:{sections:['frameStyle','fill','border','radius','shadow']},
        holder:{image:[],text:['typography','alignment'],sticker:[]}
      }
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
      ],
      // Sprint 9.4 — Comic keeps the frame bold and simple (no radius
      // finesse) and gives stickers their own Shadow control for
      // speech-bubble-style pop.
      editor:{
        slide:{sections:['title','decorations']},
        frame:{sections:['fill','border']},
        holder:{image:[],text:['typography','alignment'],sticker:['stickerShadow']}
      }
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

  // ---------- Official Artwork Themes ----------
  // Sprint 9.3 — Artwork Themes control ONLY how a child's artwork is
  // presented (background / frame / paper / caption / shadow /
  // lighting / composition) — never its pixels. See
  // renderer/slideRenderer.js's "Sprint 9.3 — Artwork Themes" section
  // for exactly how each field maps onto the existing Picture Border
  // rendering (background -> border.fill, frame -> border.design /
  // cornerRadius, shadow -> border.shadow*, composition -> padding),
  // reusing that system rather than drawing a parallel one.
  //
  // `presentation` and `enhancement` are stored for completeness and
  // future use (see the Theme Registry canon comment at the top of
  // this file) but don't independently drive rendering this sprint —
  // none of the five themes below specify an `enhancement`, and
  // nothing in this sprint automatically adjusts a pixel of the
  // child's photo (rotate/crop/exposure/etc. stay Picture Studio's
  // explicit, child-initiated actions, untouched by this sprint).
  const OFFICIAL_ARTWORK_THEMES=[
    {
      id:'museum-gallery',
      name:'Museum Gallery',
      description:'A quiet gallery wall — white mat, soft light, centered.',
      presentation:'gallery',
      background:'white',
      frame:'white-mat',
      paper:'smooth',
      caption:'museum',
      shadow:'gallery',
      lighting:'gallery',
      composition:'center',
      enhancement:[],
      // Sprint 9.4 — a gallery wall is about the picture, not the page:
      // no background/decorations control, Frame panel limited to Fill +
      // Shadow + Paper, and the full Presentation/Lighting/Caption set
      // exposed on the Image holder.
      editor:{
        slide:{sections:['title']},
        frame:{sections:['fill','shadow','paper']},
        holder:{image:['presentation','lighting','caption'],text:['typography'],sticker:[]}
      }
    },
    {
      id:'sketchbook',
      name:'Sketchbook',
      description:'Notebook paper and tape corners, like a page from a sketchbook.',
      presentation:'sketchbook',
      background:'notebook-paper',
      frame:'tape',
      paper:'notebook',
      caption:'handwritten',
      shadow:'none',
      lighting:'none',
      composition:'margin',
      enhancement:[],
      // Sprint 9.4 — a notebook page: tape/paper on the Frame, and the
      // Image holder trades Lighting for a Tape/Floating frame preset
      // plus a handwritten Caption.
      editor:{
        slide:{sections:['background','title']},
        frame:{sections:['border','paper']},
        holder:{image:['presentation','artworkFrame','caption'],text:['typography','alignment'],sticker:[]}
      }
    },
    {
      id:'watercolor-portfolio',
      name:'Watercolor Portfolio',
      description:'Watercolor paper and a floating frame with generous margins.',
      presentation:'portfolio',
      background:'watercolor-paper',
      frame:'floating',
      paper:'watercolor',
      caption:'minimal',
      shadow:'gallery',
      lighting:'soft',
      composition:'margin',
      enhancement:[],
      // Sprint 9.4 — generous margins call for a Mat control alongside
      // Fill/Shadow/Paper; the Image holder keeps Presentation + Lighting.
      editor:{
        slide:{sections:['background','decorations','title']},
        frame:{sections:['fill','shadow','mat','paper']},
        holder:{image:['presentation','lighting'],text:['typography'],sticker:[]}
      }
    },
    {
      id:'classroom-display',
      name:'Classroom Display',
      description:'Pinned to the bulletin board, ready for parents’ night.',
      presentation:'classroom',
      background:'bulletin-board',
      frame:'none',
      paper:'smooth',
      caption:'student',
      shadow:'soft',
      lighting:'none',
      composition:'center',
      enhancement:[]
    },
    {
      id:'scrapbook',
      name:'Scrapbook',
      description:'Kraft paper and tape, layered like a page from a keepsake scrapbook.',
      presentation:'scrapbook',
      background:'kraft-paper',
      frame:'tape',
      paper:'handmade',
      caption:'handwritten',
      shadow:'soft',
      lighting:'none',
      composition:'floating',
      enhancement:[]
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
  //
  // Sprint 9.3 — nested one level deeper by theme type so the Theme
  // Library can show Story Themes / Artwork Themes as its primary
  // grouping, Official/Imported as before within each. Reads
  // `getRecord(id).manifest.type` (normalized, so this is always
  // 'story' or 'artwork', never missing) rather than trusting
  // whatever a caller stashed on the flat theme object.
  function _typeOf(id){
    const rec=_registry[id];
    return (rec && rec.manifest && rec.manifest.type) || DEFAULT_THEME_TYPE;
  }
  function getCatalog(){
    function _section(order,source,type){
      return order.filter(function(id){
        return _registry[id] && _registry[id].source===source && _typeOf(id)===type;
      }).map(function(id){ return _registry[id].theme; });
    }
    const catalog={};
    THEME_TYPES.forEach(function(type){
      catalog[type]={
        official:_section(_officialOrder,'official',type),
        imported:_section(_importedOrder,'imported',type)
      };
    });
    return catalog;
  }

  // ---------- validation ----------
  // Fills in defaults a caller may have omitted rather than rejecting
  // the package outright — specifically "type", so a 9.2-era package
  // (or one sitting in localStorage from before Sprint 9.3) is treated
  // as a story theme without the child ever seeing an error. Mutates
  // nothing on the input; returns a shallow-normalized copy of just
  // the manifest so callers can validate/store the normalized form.
  function _normalizeManifest(manifest){
    const m=Object.assign({},manifest);
    if(THEME_TYPES.indexOf(m.type)===-1) m.type=DEFAULT_THEME_TYPE;
    return m;
  }

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
    const manifest=pkg.manifest ? _normalizeManifest(pkg.manifest) : null;
    if(!manifest){
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
      // Sprint 9.3 — Artwork Themes carry none of the story fields
      // (frame/panel/storyText/...); every presentation section is
      // optional, so only enough to identify + display the theme in
      // the Library is required.
      const requiredFields=(manifest && manifest.type==='artwork')
        ? REQUIRED_ARTWORK_THEME_FIELDS
        : REQUIRED_THEME_FIELDS;
      requiredFields.forEach(function(f){
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
  // again (e.g. a hot reload) never duplicates an id. `type` is a
  // single param (not read per-theme) because every call registers
  // one homogeneous set — OFFICIAL_THEMES are all 'story',
  // OFFICIAL_ARTWORK_THEMES are all 'artwork' — so the flat theme
  // objects themselves never need their own "type" field.
  function registerOfficial(themes,type){
    const t2=(THEME_TYPES.indexOf(type)!==-1) ? type : DEFAULT_THEME_TYPE;
    (themes||[]).forEach(function(t){
      if(!t || !t.id || _registry[t.id]) return;
      _registry[t.id]={
        manifest:{
          id:t.id, name:t.name, version:'1.0.0', author:'Vihu',
          description:t.description||'', category:'Official', tags:[],
          thumbnail:'', createdDate:'', updatedDate:'',
          minStudioVersion:THEME_SYSTEM_VERSION, type:t2
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

    const manifest=_normalizeManifest(pkg.manifest);
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
      _setImported(_normalizeManifest(pkg.manifest),pkg.theme);
    });
  }

  // Self-initializing, same convention as storyDestinations.js's
  // REGISTRY — no separate init step required by ThemeEngine or
  // anything else that loads after this script.
  registerOfficial(OFFICIAL_THEMES,'story');
  registerOfficial(OFFICIAL_ARTWORK_THEMES,'artwork');
  _loadImported();

  const api={
    THEME_SYSTEM_VERSION:THEME_SYSTEM_VERSION,
    THEME_TYPES:THEME_TYPES,
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
