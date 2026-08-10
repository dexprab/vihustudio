// studioRite.js — Studio Rite (docs/COMPANION_CANON.md → Canon 6).
//
// The creator's first chapter inside VihuPlanet: a mandatory experience
// every user completes exactly once, before Studio Home is reachable.
// Lumo guides it; the Story Egg accompanies through animation only and
// never speaks (Canon 1, unchanged). It never reaches Publish, never
// triggers the Creator Ceremony, and never hatches the Egg — the first
// real Publish stays sacred (Canon 4).
//
// The script this realises is docs/STUDIO_RITE_SCRIPT.md; the phase
// plan is docs/STUDIO_RITE_PROPOSAL.md Part III.
//
// This module is deliberately a thin GATE, not a new boot system. It
// owns exactly two things: "has this user completed the Rite?" and, if
// not, running it. js/app.js's own _runBootstrap()/_afterGateway() keep
// owning boot itself — the Rite simply sits between the Gateway handing
// off and _beginBoot() being called.
//
// Phase R1 ships the gate only. run() passes straight through WITHOUT
// marking completion, so nobody who boots an R1 build is permanently
// flagged as having done a Rite that does not exist yet — the flag is
// only ever written by a genuine completion (see markComplete's own
// callers in later phases).
const StudioRite=(function(){
  // Device-scoped. Deliberately NOT cloud-persisted: the only users for
  // whom a device change matters are Creators, and a Creator is already
  // grandfathered by their claimed Magic Card (below), which survives
  // device changes through the existing identity flow. A Traveller who
  // clears storage repeats the Rite — the same thing that already
  // happens to their local projects (js/projectManager.js's own "100%
  // local forever" guarantee).
  const FLAG='vihu.studioRite.v1';

  function _flagSet(){
    try{ return localStorage.getItem(FLAG)==='1'; }catch(e){ return false; }
  }

  // The grandfather clause (Studio Rite Decision 8 — "reuse existing
  // platform mechanisms... avoid introducing migration systems").
  // A claimed Magic Card is proof the user completed a Creator Ceremony,
  // which by definition means they published a real story and were
  // chosen by a Story Companion — they demonstrably hold the vocabulary
  // the Rite exists to teach. Already true for every existing Creator,
  // already false for every Traveller, and already loaded at boot: no
  // backfill, no schema change, no migration.
  function _isCreator(){
    try{
      return typeof MagicCard!=='undefined'
        && typeof MagicCard.list==='function'
        && MagicCard.list().length>0;
    }catch(e){ return false; }
  }

  function isComplete(){ return _flagSet()||_isCreator(); }

  function markComplete(){
    try{ localStorage.setItem(FLAG,'1'); }catch(e){}
  }

  // ---------- The script (docs/STUDIO_RITE_SCRIPT.md) ----------
  // Pure data, deliberately — the same discipline
  // CompanionDirector.getCeremonySequence() already uses for the Creator
  // Ceremony. Adding a beat is editing this array, never writing
  // control flow. `line` matches the Gateway's own {title,subtitle}
  // shape so the two read as one continuous voice.
  //
  // `egg` is always one of the five poses the Rite is allowed
  // (docs/COMPANION_CANON.md → Canon 6): idle · curious · thinking ·
  // excited · sleep. `hatching`/`magic` belong exclusively to the
  // Creator Ceremony and must never appear here — the Rite never
  // hatches the Egg.
  const ACT_I=[
    {lumo:'wave', egg:'idle',
     line:{title:'This is VihuStudio.',
           subtitle:'Every story in VihuPlanet begins in a place like this.'},
     durationMs:4200},
    {lumo:'talk', egg:'curious',
     line:{title:'Stories are how we keep the things we love.',
           subtitle:'A day, a friend, a dragon you invented — a story keeps it real.'},
     durationMs:5200},
    {lumo:'curious', egg:'idle', effect:'glow',
     line:{title:'Someone brought this Egg here for you.',
           subtitle:'It has been waiting.'},
     durationMs:4600}
  ];

  const ASSETS_BASE='assets/';
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;

  function _el(tag,cls){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    return e;
  }

  // Reuses the Gateway's own greeting-bubble vocabulary
  // (.gateway-greeting-bubble/-title/-subtitle/-in) rather than
  // inventing a second one. Studio Rite "extends the existing Gateway"
  // and the transition must feel seamless — the cheapest and most
  // honest way to achieve that is for Lumo's lines to be literally the
  // same element, styled by the same rules. js/gatewaySequence.js is
  // not modified; only its stylesheet vocabulary is shared.
  function _buildStage(){
    const overlay=_el('div','studio-rite-overlay');
    const panel=_el('div','studio-rite-panel');
    const cast=_el('div','studio-rite-cast');

    const eggWrap=_el('div','studio-rite-egg');
    const eggImg=document.createElement('img');
    eggImg.className='studio-rite-egg-img'; eggImg.alt='';
    eggWrap.appendChild(eggImg);

    const lumoWrap=_el('div','studio-rite-lumo');
    const particles=_el('div','studio-rite-particles');
    particles.setAttribute('aria-hidden','true');
    const lumoImg=document.createElement('img');
    lumoImg.className='studio-rite-lumo-img'; lumoImg.alt='';
    lumoWrap.appendChild(particles);
    lumoWrap.appendChild(lumoImg);

    cast.appendChild(eggWrap);
    cast.appendChild(lumoWrap);

    const bubble=_el('div','gateway-greeting-bubble');
    panel.appendChild(cast);
    panel.appendChild(bubble);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return {overlay:overlay,panel:panel,bubble:bubble,lumoImg:lumoImg,eggImg:eggImg,particles:particles};
  }

  function _fetchJSON(url){
    return fetch(url).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  }

  // Resolves a registry ROLE to its package, never a hardcoded id —
  // the same rule js/companionDirector.js and js/magicCardUI.js already
  // follow, so a registry edit keeps working with no code change.
  function _loadPack(regList,role){
    const entry=(regList||[]).find(function(e){ return e.role===role; });
    if(!entry) return Promise.resolve(null);
    const basePath=ASSETS_BASE+entry.path;
    return _fetchJSON(basePath+'companion.json').then(function(pkg){
      return pkg?{basePath:basePath,pkg:pkg}:null;
    });
  }

  // A pose DECLARED in companion.json is not a guarantee the file
  // exists — the Story Egg ships 6 of 8 poses, disclosed. Missing art
  // degrades to "leave the previous frame up" rather than a broken
  // image, exactly as CompanionEngine already does for the widget.
  function _setPose(imgEl,pack,pose){
    if(!imgEl||!pack||!pack.pkg||!pack.pkg.states) return;
    const file=pack.pkg.states[pose]||pack.pkg.states[pack.pkg.defaultState];
    if(!file) return;
    const src=pack.basePath+file;
    if(imgEl.getAttribute('src')===src) return;
    imgEl.setAttribute('src',src);
  }

  function _showLine(bubble,line){
    if(!bubble) return;
    bubble.classList.remove('gateway-greeting-in');
    bubble.textContent='';
    if(!line) return;
    const title=_el('div','gateway-greeting-title');
    title.textContent=line.title;
    bubble.appendChild(title);
    if(line.subtitle){
      const sub=_el('div','gateway-greeting-subtitle');
      sub.textContent=line.subtitle;
      bubble.appendChild(sub);
    }
    // One frame later so the transition actually runs.
    requestAnimationFrame(function(){ bubble.classList.add('gateway-greeting-in'); });
  }

  function _reducedMotion(){
    try{ return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  // Plays one beat and resolves when it is done. A beat with
  // `awaitAction` (phase R3) will resolve on the child's own action
  // instead of a timer; today every beat is timed.
  function _playBeat(beat){
    return new Promise(function(resolve){
      _setPose(_els.lumoImg,_packs.guardian,beat.lumo);
      _setPose(_els.eggImg,_packs.traveller,beat.egg);
      _els.overlay.setAttribute('data-rite-effect',beat.effect||'');
      _showLine(_els.bubble,beat.line);
      const ms=_reducedMotion()?900:(beat.durationMs||3000);
      _timer=setTimeout(resolve,ms);
    });
  }

  function _playBeats(beats){
    return beats.reduce(function(chain,beat){
      return chain.then(function(){ return _playBeat(beat); });
    },Promise.resolve());
  }

  function _teardown(){
    if(_timer){ clearTimeout(_timer); _timer=null; }
    // Canon 2 — Lumo appears only at a threshold and is torn down when
    // it ends. He must never persist into the Studio widget, which
    // js/app.js's own CompanionDirector.init() mounts moments later
    // with the correct Traveller entity.
    try{ if(_els&&_els.overlay&&_els.overlay.parentNode) _els.overlay.parentNode.removeChild(_els.overlay); }catch(e){}
    _els=null; _packs={};
  }

  // Phase R2: Act I only — "Where am I?". Acts II–IV (the creation
  // beats) land in R3/R4; until then the Rite plays its opening and
  // hands off WITHOUT marking completion, so an in-progress build never
  // permanently flags a child as having done a Rite they haven't.
  function run(next){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      next(); return;
    }
    let finished=false;
    const finish=function(){
      if(finished) return;
      finished=true;
      _teardown();
      next();
    };
    try{
      _els=_buildStage();
      requestAnimationFrame(function(){ if(_els) _els.overlay.classList.add('studio-rite-in'); });
      window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(regList){
        return Promise.all([_loadPack(regList,'guardian'),_loadPack(regList,'traveller')]);
      }).then(function(packs){
        _packs={guardian:packs[0],traveller:packs[1]};
        // No Lumo package at all means no guide — the Rite cannot be
        // performed, so hand straight off rather than showing a child
        // an empty stage.
        if(!_packs.guardian){ finish(); return; }
        return _playBeats(ACT_I).then(finish);
      }).catch(finish);
    }catch(e){ finish(); }
  }

  // The one entry point js/app.js calls. Never throws, never leaves the
  // user stranded: any failure anywhere falls through to `next` so a
  // broken Rite can never lock a child out of the Studio it gates.
  function gate(next){
    let handed=false;
    const done=function(){
      if(handed) return;
      handed=true;
      try{ next(); }catch(e){}
    };
    try{
      if(isComplete()){ done(); return; }
      run(done);
    }catch(e){ done(); }
  }

  return {
    isComplete:isComplete,
    markComplete:markComplete,
    gate:gate
  };
})();
try{ window.StudioRite=StudioRite; }catch(e){}
