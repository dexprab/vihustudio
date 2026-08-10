// studioRite.js — Studio Rite (docs/COMPANION_CANON.md → Canon 6).
//
// The creator's first chapter inside VihuPlanet: a mandatory experience
// every user completes exactly once, before Studio Home is reachable.
// Lumo guides it; the Story Egg accompanies through animation only and
// never speaks (Canon 1, unchanged). Under the rewritten Decision 7 it
// ends by asking whether the child would like their first story to
// become part of VihuPlanet; saying yes is what opens the Creator
// Ceremony (Canon 4). The child-facing word "Publish" never appears
// here — internally the existing Publish path is used, unchanged
// (Canon 7). NOTE: the sharing beat is designed, not yet built; the
// current COMPLETION screen still ends the Rite without it.
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
// The Rite hands off to the Studio PART WAY through — at the moment the
// child says yes — because Acts III and IV happen in the real editor,
// not a tutorial copy of one. Everything after that plays as a quiet
// band along the bottom of the live Studio.
//
// Completion is written in exactly one place: the end of a genuine full
// run, after the child has actually made and named a story. No partial,
// abandoned or failed Rite ever unlocks the Studio.
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

  // True from the moment the Rite starts until it has fully finished.
  // js/app.js's _beginBoot() reads this so it never throws the
  // restore-session modal or the normal creation flow over the top of a
  // chapter still in progress — the Rite owns the screen until it ends.
  function isRunning(){ return _running; }

  function markComplete(){
    try{ localStorage.setItem(FLAG,'1'); }catch(e){}
  }

  // ---------- The script (docs/STUDIO_RITE_SCRIPT.md) ----------
  // Pure data, deliberately — the same discipline
  // CompanionDirector.getCeremonySequence() already uses for the Creator
  // Ceremony. `line` matches the Gateway's own {title,subtitle} shape so
  // the two read as one continuous voice.
  //
  // A SCREEN is a group of lines that appear together, one after
  // another, on their own. The child never clicks to hear the next
  // line — they click (or make something) only to leave the screen.
  // That was direct product feedback: the accumulating conversation
  // should be automatic, and "Move ahead" should appear only after the
  // last line of a screen and take you to the next one.
  //
  // Each screen's lines are cleared when it ends, so the conversation
  // never grows without bound and the stage never reflows.
  //
  // `egg` is always one of the five poses the Rite is allowed
  // (docs/COMPANION_CANON.md -> Canon 6): idle | curious | thinking |
  // excited | sleep. `hatching`/`magic` belong exclusively to the
  // Creator Ceremony and must never appear here.
  const SCREENS=[
    // ---- Act I — Where am I? (full-screen stage)
    // The glow lands on the line about the Egg itself — Canon 1 allows
    // the Egg pose, glow and magical effects, and nothing else.
    {lines:[
      {lumo:'wave', egg:'idle',
       line:{title:'Welcome to VihuStudio.',
             subtitle:'Every story in VihuPlanet begins here.'}},
      {lumo:'talk', egg:'curious', effect:'glow',
       line:{title:'This Story Egg has been entrusted to you.',
             subtitle:'Every story you create helps it grow a little stronger.'}},
      {lumo:'curious', egg:'idle',
       line:{title:'One day it will be ready.',
             subtitle:'Until then, it will quietly travel beside you on every adventure.'}}
     ], end:{move:"Let's Begin"}},

    // ---- Act II — Who am I? Ends on the one unmissable way forward.
    {lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Everyone who arrives here is a Traveller.',
             subtitle:'Today, your journey begins.'}},
      {lumo:'curious', egg:'curious',
       line:{title:'Travellers create stories.',
             subtitle:'Every story you create nurtures your Egg and helps it grow.'}},
      {lumo:'wave', egg:'excited',
       line:{title:'When the time is right...',
             subtitle:'Your Egg will become a lifelong Companion, and every story after that will help your Companion learn, grow and mature with you.'}}
     ], end:{choice:'Start My First Story'}, opensStudio:true},

    // ---- Act III — What do I do here? (band, over the live editor)
    // Each screen pairs Lumo's reaction to what the child just did with
    // the next thing he wonders about, and ends on the child's own
    // making rather than a button.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'There. Your first page.',
             subtitle:"It's empty on purpose. Empty is where everything starts."}},
      {lumo:'talk', egg:'thinking',
       line:{title:'A story needs someone in it.',
             subtitle:"Choose whoever you like. It's your story."}}
     ], end:{await:'sticker-added'}},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Oh — hello.', subtitle:"They're yours now."}},
      {lumo:'talk', egg:'curious',
       line:{title:"They don't have to stay there.",
             subtitle:'Put them wherever the story needs them.'}}
     ], end:{await:'sticker-moved'}},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:"That's it. Nothing here is stuck."}},
      {lumo:'talk', egg:'thinking',
       line:{title:'Big things feel close. Small things feel far away.',
             subtitle:'How close is this one?'}}
     ], end:{await:'sticker-resized'}},

    // ---- Act IV — Why do stories matter?
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:"You're deciding how it feels.",
             subtitle:"That's the whole job."}},
      {lumo:'talk', egg:'curious',
       line:{title:'Every story has a name.',
             subtitle:'What is this one called?'}}
     ], end:{await:'story-named'}},

    {band:true, lines:[
      {lumo:'curious', egg:'excited', effect:'glow',
       line:{title:'You made that.',
             subtitle:"It didn't exist, and now it does."}},
      {lumo:'talk', egg:'idle',
       line:{title:"That's why we keep stories.",
             subtitle:'Because someone made them, and then they were real.'}}
     ], end:{move:'Move ahead'}},

    // ---- Completion. The Egg is NOT hatched here and never will be by
    // the Rite: that belongs to the Creator Ceremony (Canon 4), named
    // aloud precisely so the child knows it is still coming.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:"You're not a Traveller any more.",
             subtitle:'You made something. That makes you a Creator.'}},
      {lumo:'talk', egg:'idle',
       line:{title:'One day this Egg will hatch, and someone will choose you.',
             subtitle:'Not today. Today you just made your first story.'}},
      {lumo:'wave', egg:'idle',
       line:{title:'The Studio is yours now.',
             subtitle:'Go and see what else is in it.'}}
     ], end:{move:'Into the Studio'}}
  ];

  const ASSETS_BASE='assets/';
  const IDLE_DRIFT_MS=20000;  // the Egg drifts to sleep, and wakes on activity
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;
  let _unobserve=null;
  let _running=false;

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

    // A conversation, not a teleprompter. Lines ACCUMULATE — nothing
    // Lumo says is ever taken away — so a child who reads slowly, or is
    // being read to, can look back at what was said instead of racing a
    // timer. Advancing is always the child's own click.
    const convo=_el('div','studio-rite-convo');
    const controls=_el('div','studio-rite-controls');
    panel.appendChild(cast);
    panel.appendChild(convo);
    panel.appendChild(controls);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return {overlay:overlay,panel:panel,convo:convo,controls:controls,
            lumoImg:lumoImg,eggImg:eggImg,particles:particles};
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

  // Appends one line to the running conversation. Earlier lines stay,
  // dimmed, so the newest is obviously the newest without the others
  // being lost. Reuses the Gateway's own title/subtitle typography so
  // Lumo sounds and looks like the same character throughout.
  function _appendLine(line){
    if(!_els||!_els.convo||!line) return;
    const prev=_els.convo.querySelectorAll('.studio-rite-line');
    for(let i=0;i<prev.length;i++) prev[i].classList.add('studio-rite-line-past');
    const row=_el('div','studio-rite-line');
    const title=_el('div','gateway-greeting-title');
    title.textContent=line.title;
    row.appendChild(title);
    if(line.subtitle){
      const sub=_el('div','gateway-greeting-subtitle');
      sub.textContent=line.subtitle;
      row.appendChild(sub);
    }
    _els.convo.appendChild(row);
    requestAnimationFrame(function(){
      row.classList.add('studio-rite-line-in');
      try{ _els.convo.scrollTop=_els.convo.scrollHeight; }catch(e){}
    });
  }

  // The one control that moves the Rite forward. Every narrative beat
  // waits on it, so nothing is ever taken off screen before the child
  // has said they are ready.
  function _awaitClick(label,cls){
    return new Promise(function(resolve){
      if(!_els){ resolve(); return; }
      const btn=_el('button','studio-rite-choice'+(cls?(' '+cls):''));
      btn.type='button';
      btn.textContent=label;
      btn.addEventListener('click',function(){
        try{ if(btn.parentNode) btn.parentNode.removeChild(btn); }catch(e){}
        resolve();
      },{once:true});
      _els.controls.appendChild(btn);
      try{ btn.focus({preventScroll:true}); }catch(e){}
    });
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
    // The child naming their story. Reads the same
    // AppState.project.bookTitle that #bookTitle's own input handler
    // writes (js/app.js), so the Rite sees exactly what the project
    // sees — no second source of truth, no separate Rite-only field.
    // A project is BORN with a name — js/state.js seeds
    // bookTitle:'My Adventure', and #bookTitle ships that as its value
    // attribute. So "the story has a name" is true before the child
    // touches anything, and testing for non-empty would skip Act IV's
    // ask entirely — silently deleting the emotional peak of the whole
    // Rite. The real condition is that the child CHANGED it from
    // whatever it said when the beat began, and left something behind.
    if(kind==='story-named'){
      const now=_titleNow();
      return now.length>0 && now!==(baseline&&baseline.__title);
    }
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

  // Reads the live field first and AppState second — #bookTitle's own
  // handler mirrors one into the other while it is being typed, and
  // serialize() already prefers the DOM, so this matches what the
  // project itself considers the name.
  function _titleNow(){
    try{
      const el=document.getElementById('bookTitle');
      if(el && typeof el.value==='string') return el.value.trim();
    }catch(e){}
    try{ return String((AppState&&AppState.project&&AppState.project.bookTitle)||'').trim(); }
    catch(e){ return ''; }
  }

  function _baseline(){
    const map={};
    _stickers().forEach(function(s){ map[s.id]={x:s.x,y:s.y,w:s.w,h:s.h}; });
    map.__title=_titleNow();
    return map;
  }

  // Plays one beat and resolves when it is done. A beat with `await`
  // resolves on the child's own action instead of a timer, and waits
  // indefinitely — the Rite is mandatory, so it must never be possible
  // to be rushed through it OR to get stuck in it.
  // How long before the NEXT line of the same screen appears. Derived
  // from how much there is to read rather than a flat constant — the
  // first version used fixed 3-5s durations, which gave a 23-word line
  // and a 6-word line nearly the same time and read far too fast.
  // Lines stay on screen once shown, so this only sets the rhythm.
  function _lineGapMs(line){
    if(!line) return 2600;
    const words=((line.title||'')+' '+(line.subtitle||''))
      .trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2600,Math.min(9000,900+words*430));
  }

  function _showLine(entry){
    if(!_els) return;
    _setPose(_els.lumoImg,_packs.guardian,entry.lumo);
    _setPose(_els.eggImg,_packs.traveller,entry.egg);
    _els.overlay.setAttribute('data-rite-effect',entry.effect||'');
    _appendLine(entry.line);
  }

  // Every line of a screen appears on its own, one after another. The
  // child is never asked to click to hear the next thing Lumo says.
  function _playLines(lines){
    return lines.reduce(function(chain,entry,i){
      return chain.then(function(){
        _showLine(entry);
        if(i===lines.length-1) return;   // last line: the screen's end takes over
        return new Promise(function(r){ _timer=setTimeout(r,_lineGapMs(entry.line)); });
      });
    },Promise.resolve());
  }

  // A screen ends in exactly one of three ways: a button, the one
  // "Yes", or something the child makes.
  function _playEnd(end){
    if(end.move) return _awaitClick(end.move);
    if(end.choice) return _awaitClick(end.choice,'studio-rite-choice-primary');
    if(end.await) return _awaitAction(end.await);
    return Promise.resolve();
  }

  // A beat the child completes by making something. Waits indefinitely.
  function _awaitAction(kind){
    return new Promise(function(resolve){
      const baseline=_baseline();
      let idleTimer=null, onInput=null, poll=null;
      const rearmIdle=function(){
        if(idleTimer) clearTimeout(idleTimer);
        idleTimer=setTimeout(function(){
          // Canon 1 — pose only. The Egg gets sleepy; it never nags,
          // and Lumo never repeats himself.
          _setPose(_els&&_els.eggImg,_packs.traveller,'sleep');
        },IDLE_DRIFT_MS);
      };
      const cleanup=function(){
        if(idleTimer){ clearTimeout(idleTimer); idleTimer=null; }
        if(poll){ clearInterval(poll); poll=null; }
        if(onInput){ try{ document.removeEventListener('input',onInput,true); }catch(e){} onInput=null; }
        if(_unobserve){ try{ _unobserve(); }catch(e){} _unobserve=null; }
      };
      const check=function(){
        if(!_conditionMet(kind,baseline)){ rearmIdle(); return; }
        cleanup();
        resolve();
      };
      rearmIdle();
      try{
        if(typeof PageRuntime!=='undefined' && PageRuntime.observe){
          _unobserve=PageRuntime.observe(check);
        }
        // Typing the story's name never routes through
        // PageRuntime.notify() — #bookTitle's handler only writes
        // AppState and marks the project dirty. A delegated
        // capture-phase 'input' listener (the same shape
        // js/companionDirector.js already uses for typing) is the
        // second signal.
        onInput=function(){ check(); };
        document.addEventListener('input',onInput,true);
        // Last-resort safety net: a beat must never be able to trap a
        // child in a mandatory Rite because a signal was missed.
        poll=setInterval(check,1200);
      }catch(e){ cleanup(); resolve(); }
      check();
    });
  }

  function _clearConvo(){
    if(_els&&_els.convo) _els.convo.innerHTML='';
  }

  function _playScreen(screen){
    if(screen.band) _toBandMode();
    _clearConvo();
    return _playLines(screen.lines).then(function(){
      return _playEnd(screen.end);
    });
  }

  function _teardown(){
    _running=false;
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

  // The whole Rite: Act I (Where am I?) - Act II (Who am I?) -
  // Act III (What do I do here?) - Act IV (Why do stories matter?) -
  // Completion. Marks completion only on a genuine full run.
  function run(next){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      next(); return;
    }
    _running=true;
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
        return SCREENS.reduce(function(chain,screen){
          return chain.then(function(){
            return _playScreen(screen).then(function(){
              // The screen the child says "Yes" on is the one that opens
              // the Studio: boot it underneath, then open a blank page
              // directly — no type screen, no World picker, and no Theme
              // Repository dependency (the Rite is mandatory and must
              // work on a first launch with no network).
              if(!screen.opensStudio) return;
              handOff();
              try{
                if(typeof CreationFlow!=='undefined' && CreationFlow.startBlank) CreationFlow.startBlank();
              }catch(e){}
            });
          });
        },Promise.resolve()).then(function(){
          // The one place the flag is ever written: a genuine, complete
          // run. Reached only after the child has actually made and
          // named a story, so no partial or abandoned Rite can unlock
          // the Studio.
          markComplete();
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
    isRunning:isRunning,
    markComplete:markComplete,
    gate:gate
  };
})();
try{ window.StudioRite=StudioRite; }catch(e){}
