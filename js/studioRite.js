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

  // Act II opens on the same full-screen stage as Act I, and ends on
  // the one tap that takes the child into the Studio — "a single,
  // unmissable way forward. No choice of type, no World to pick, no
  // settings."
  const ACT_II_STAGE=[
    {lumo:'talk', egg:'curious',
     line:{title:'Everyone who finds their way here is a Traveller.',
           subtitle:'You are a Traveller. You just arrived.'},
     durationMs:4600},
    {lumo:'curious', egg:'curious',
     line:{title:'Travellers who make something become Creators.',
           subtitle:"That's the only difference. Making something."},
     durationMs:4800},
    {lumo:'wave', egg:'excited',
     line:{title:'Would you like to make something?'},
     choice:'Yes'}
  ];

  // Everything from here plays as a quiet band over the LIVE Studio —
  // the child is in the real editor, not a tutorial copy of one
  // (Decision 3: "Reuse the existing editor. Do not build tutorial-only
  // editors."). `await` beats wait on the child's own action,
  // indefinitely: no timeout, no skip, no auto-advance.
  const ACT_II_BAND=[
    {lumo:'celebrate', egg:'excited',
     line:{title:'There. Your first page.',
           subtitle:"It's empty on purpose. Empty is where everything starts."},
     durationMs:4400}
  ];

  const ACT_III=[
    {lumo:'talk', egg:'thinking',
     line:{title:'A story needs someone in it.',
           subtitle:"Choose whoever you like. It's your story."},
     await:'sticker-added'},
    {lumo:'celebrate', egg:'excited',
     line:{title:'Oh — hello.', subtitle:"They're yours now."},
     durationMs:3400},

    {lumo:'talk', egg:'curious',
     line:{title:"They don't have to stay there.",
           subtitle:'Put them wherever the story needs them.'},
     await:'sticker-moved'},
    {lumo:'curious', egg:'curious',
     line:{title:"That's it. Nothing here is stuck."},
     durationMs:3000},

    {lumo:'talk', egg:'thinking',
     line:{title:'Big things feel close. Small things feel far away.',
           subtitle:'How close is this one?'},
     await:'sticker-resized'},
    {lumo:'celebrate', egg:'excited',
     line:{title:"You're deciding how it feels.",
           subtitle:"That's the whole job."},
     durationMs:3600}
  ];

  const ASSETS_BASE='assets/';
  const IDLE_DRIFT_MS=20000;  // the Egg drifts to sleep, and wakes on activity
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;
  let _unobserve=null;

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

  // ---------- Watching the child's own work ----------
  // Reads the live page rather than tracking our own copy of it, so the
  // Rite can never disagree with what the editor actually did.
  function _stickers(){
    try{
      const page=PageRuntime.getActivePage();
      return (page&&page.metadata&&page.metadata.stickers)||[];
    }catch(e){ return []; }
  }

  function _stickerSnapshot(){
    return _stickers().map(function(s){
      return s.id+':'+s.x+','+s.y+':'+s.w+'x'+s.h;
    }).join('|');
  }

  function _conditionMet(kind,baseline){
    const list=_stickers();
    if(kind==='sticker-added') return list.length>0;
    if(!list.length) return false;
    if(kind==='sticker-moved'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && (s.x!==b.x || s.y!==b.y);
      });
    }
    if(kind==='sticker-resized'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && (s.w!==b.w || s.h!==b.h);
      });
    }
    return true;
  }

  function _baseline(){
    const map={};
    _stickers().forEach(function(s){ map[s.id]={x:s.x,y:s.y,w:s.w,h:s.h}; });
    return map;
  }

  // Plays one beat and resolves when it is done. A beat with `await`
  // resolves on the child's own action instead of a timer, and waits
  // indefinitely — the Rite is mandatory, so it must never be possible
  // to be rushed through it OR to get stuck in it.
  function _playBeat(beat){
    return new Promise(function(resolve){
      if(!_els){ resolve(); return; }
      _setPose(_els.lumoImg,_packs.guardian,beat.lumo);
      _setPose(_els.eggImg,_packs.traveller,beat.egg);
      _els.overlay.setAttribute('data-rite-effect',beat.effect||'');
      _showLine(_els.bubble,beat.line);

      // A beat the child completes by tapping (Act II's one way forward).
      if(beat.choice){
        const btn=_el('button','studio-rite-choice');
        btn.type='button';
        btn.textContent=beat.choice;
        btn.addEventListener('click',function(){
          try{ if(btn.parentNode) btn.parentNode.removeChild(btn); }catch(e){}
          resolve();
        },{once:true});
        _els.panel.appendChild(btn);
        return;
      }

      // A beat the child completes by making something.
      if(beat.await){
        const baseline=_baseline();
        let idleTimer=null;
        const rearmIdle=function(){
          if(idleTimer) clearTimeout(idleTimer);
          idleTimer=setTimeout(function(){
            // Canon 1 — pose only. The Egg gets sleepy; it never nags,
            // and Lumo never repeats himself.
            _setPose(_els&&_els.eggImg,_packs.traveller,'sleep');
          },IDLE_DRIFT_MS);
        };
        const check=function(){
          _setPose(_els&&_els.eggImg,_packs.traveller,beat.egg); // woken by activity
          rearmIdle();
          if(!_conditionMet(beat.await,baseline)) return;
          if(idleTimer) clearTimeout(idleTimer);
          if(_unobserve){ _unobserve(); _unobserve=null; }
          resolve();
        };
        rearmIdle();
        try{
          if(typeof PageRuntime!=='undefined' && PageRuntime.observe){
            _unobserve=PageRuntime.observe(check);
          }else{
            // No observer seam at all — the Rite must still be
            // completable, so fall back to a slow poll rather than
            // trapping the child on a beat that can never resolve.
            const poll=setInterval(function(){
              if(_conditionMet(beat.await,baseline)){ clearInterval(poll); resolve(); }
            },600);
          }
        }catch(e){ resolve(); }
        check();
        return;
      }

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
    if(_unobserve){ try{ _unobserve(); }catch(e){} _unobserve=null; }
    // Canon 2 — Lumo appears only at a threshold and is torn down when
    // it ends. He must never persist into the Studio widget, which
    // js/app.js's own CompanionDirector.init() mounts with the correct
    // Traveller entity.
    try{ if(_els&&_els.overlay&&_els.overlay.parentNode) _els.overlay.parentNode.removeChild(_els.overlay); }catch(e){}
    _els=null; _packs={};
  }

  // The Rite's second half plays over the LIVE Studio, so the
  // full-screen stage becomes a quiet band along the bottom. Same DOM,
  // same Lumo, same bubble — only the styling changes, so the child
  // never experiences a scene cut between "being told" and "making".
  function _toBandMode(){
    if(!_els) return;
    _els.overlay.classList.add('studio-rite-band');
  }

  // Phase R3: Acts I–III. Act IV, completion and the unlock land in R4,
  // so this still hands off WITHOUT marking completion — an
  // in-progress build never permanently flags a child as having done a
  // Rite they haven't.
  function run(next){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      next(); return;
    }
    // next() boots the Studio. It happens PART WAY through the Rite —
    // at the moment the child says yes — because Acts III onward need
    // the real editor underneath. Guarded so it fires exactly once no
    // matter which path gets there, including every failure path.
    let handedOff=false;
    const handOff=function(){
      if(handedOff) return;
      handedOff=true;
      try{ next(); }catch(e){}
    };
    // Any failure after hand-off must still clear the Rite's own UI,
    // never leave a child looking at a half-played chapter.
    const abandon=function(){ _teardown(); handOff(); };

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
        if(!_packs.guardian){ abandon(); return null; }
        return _playBeats(ACT_I.concat(ACT_II_STAGE)).then(function(){
          // The child said yes. Boot the Studio underneath, then open a
          // blank page directly — no type screen, no World picker, and
          // no Theme Repository dependency (the Rite is mandatory and
          // must work on a first launch with no network).
          handOff();
          try{
            if(typeof CreationFlow!=='undefined' && CreationFlow.startBlank) CreationFlow.startBlank();
          }catch(e){}
          _toBandMode();
          return _playBeats(ACT_II_BAND.concat(ACT_III));
        }).then(function(){
          _teardown();
        });
      }).catch(abandon);
    }catch(e){ abandon(); }
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
