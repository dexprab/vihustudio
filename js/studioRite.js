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
      {lumo:'wave', egg:'idle', voiceId:'riteS1L1',
       line:{title:'Welcome to VihuStudio.',
             subtitle:'Every story in VihuPlanet begins here.'}},
      {lumo:'talk', egg:'curious', effect:'glow', voiceId:'riteS1L2',
       line:{title:'This Story Egg has been entrusted to you.',
             subtitle:'It has been waiting a long time for a story of its own.'}},
      {lumo:'curious', egg:'idle', voiceId:'riteS1L3',
       line:{title:'It will stay beside you while you make one.',
             subtitle:'Story Eggs know when something is about to happen.'}}
     ], end:{move:"Let's Begin"}},

    // ---- Act II — Who am I? Ends on the one unmissable way forward.
    {lines:[
      {lumo:'talk', egg:'curious', voiceId:'riteS2L1',
       line:{title:'Everyone who arrives here is a Traveller.',
             subtitle:'Today, your journey begins.'}},
      {lumo:'curious', egg:'curious', voiceId:'riteS2L2',
       line:{title:'Travellers create stories.',
             subtitle:'Every story you create nurtures your Egg and helps it grow.'}},
      {lumo:'wave', egg:'excited', voiceId:'riteS2L3',
       line:{title:'Nobody knows what is inside a Story Egg.',
             subtitle:'Not even Lumo. It depends entirely on the story you make.'}}
     ], end:{choice:'Start My First Story'}, opensStudio:true},

    // ---- The Starter Story: "The Night a Star Came Down"
    // (docs/STUDIO_RITE_STARTER_STORY.md). Three pages, 24 lines, 17
    // makings. Every screen ends on something the CHILD does, never a
    // button, except the very last. Replaces the one-page placeholder
    // that stood here while the story was being designed.
    //
    // Page 1 — The Falling · discover. Every control met for the first
    // time, so the nudge glows immediately (nudgeDelay 0).

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Every story starts somewhere. This one starts with something falling.',
             subtitle:'Put it up there.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:"You can't see a star in the daytime.",
             subtitle:'What colour is the sky when the stars come out?'}}
     ], end:{await:'bg-set'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'There it is.',
             subtitle:'Is it close to us, or very far away?'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Falling things turn as they fall.',
             subtitle:'Show me how it tumbles.'}}
     ], end:{await:'sticker-rotated'}, nudgeDelay:0},

    // Page 2 — The Finding · apply. Same controls, new purpose. The
    // nudge now waits a beat before offering itself.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Down it comes.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'It has to land somewhere.',
             subtitle:"Let's make the place where it lands."}}
     ], end:{await:'page-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'This is the ground now, not the sky.',
             subtitle:'What colour is it down here?'}}
     ], end:{await:'bg-set'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'Somewhere to land, and something to land under.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Trees are tall. Is that one tall enough?'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Now the star is here, and it is very small, and it is alone.',
             subtitle:'Somebody is about to find it. Who?'}}
     ], end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Oh — them. Good. I like them already.',
             subtitle:'Bring them over. Nobody helps from far away.'}}
     ], end:{await:'sticker-moved'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'They found it. They are the first thing this star has ever met.',
             subtitle:'What do they say to it?'}}
     ], end:{await:'text-added'}, nudgeDelay:4000},

    // Page 3 — The Going Home · own. Lumo stops offering; every beat is
    // something the child has already done, asked for in one line. The
    // nudge holds back longest here — the child leads, the net remains.
    {band:true, lines:[
      {lumo:'curious', egg:'excited',
       line:{title:'Nobody told them to be kind. They just were.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'They stayed all night.',
             subtitle:'Make it morning.'}}
     ], end:{await:'morning'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'The star is stronger now. Take it home.'}}
     ], end:{await:'sticker-moved'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'excited',
       line:{title:"Further. It's a long way up."}}
     ], end:{await:'sticker-resized'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'Far away again. Where it belongs.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'How does your friend feel, watching it go?'}}
     ], end:{await:'sticker-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Every story needs somebody telling it, too.',
             subtitle:'Tell us how it ends.'}}
     ], end:{await:'text-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'You made something small, and you looked after it, and then you let it go.',
             subtitle:'Every story does that.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Stories need names, the way stars do.',
             subtitle:'What is this one called?'}}
     ], end:{await:'story-named'}, nudgeDelay:12000},

    // The close. Confidence, not completion — Lumo removes himself and
    // points the child at their own next story. The sharing beat
    // (Decision 7) will be inserted after this, and is not built yet.
    {band:true, lines:[
      {lumo:'curious', egg:'excited', effect:'glow',
       line:{title:'You made that.',
             subtitle:"It didn't exist, and now it does."}},
      {lumo:'talk', egg:'idle',
       line:{title:'And you did all of it. I only asked questions.'}},
      {lumo:'wave', egg:'idle',
       line:{title:'Whatever you want to make next — you already know how to start.'}}
     ], end:{move:'Into the Studio'}}
  ];

  const ASSETS_BASE='assets/';
  const IDLE_DRIFT_MS=20000;  // the Egg drifts to sleep, and wakes on activity
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;
  let _unobserve=null;
  let _running=false;
  let _voiceId=null;   // the clip currently speaking, so it can be silenced

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

  // ---------- The Nudge (docs/STUDIO_RITE_PROPOSAL.md → Part IV) ----------
  // "The Rite may show a child WHERE a control is. It may never explain
  // WHAT it does." (Canon 6). Lumo never names a control; the real one
  // lights up, and the child learns its behaviour by using it.
  //
  // The delay lengthens screen by screen (the `nudgeDelay` on each
  // SCREEN), so the child takes over by degrees and a confident one
  // never sees a hint at all.

  // Resolve by VISIBLE LABEL rather than position wherever possible — a
  // positional selector silently points at the wrong control the moment
  // a row is reordered, and a nudge aimed at the wrong thing is worse
  // than no nudge.
  // Prefers a label that STARTS with the term ("Size260px" -> "size")
  // over one that merely contains it ("Font Size"), so a new unrelated
  // row cannot quietly steal the nudge.
  function _byLabel(labelSel,text,liftSel){
    const want=String(text).toLowerCase();
    const lift=function(el){ return liftSel ? el.closest(liftSel) : el; };
    try{
      const all=document.querySelectorAll(labelSel);
      let contains=null;
      for(let i=0;i<all.length;i++){
        const t=(all[i].textContent||'').trim().toLowerCase();
        if(t.indexOf(want)===0) return lift(all[i]);
        if(!contains && t.indexOf(want)!==-1) contains=all[i];
      }
      if(contains) return lift(contains);
    }catch(e){}
    return null;
  }

  function _hasSelection(){
    try{
      return !!(PageRuntime.getSelection().sceneId) && PageRuntime.selectionIsValid();
    }catch(e){ return false; }
  }

  // capability -> {find(), hint}. `find` may return null at any moment
  // (the control genuinely isn't on screen yet); the nudge then simply
  // waits and tries again rather than pointing at nothing.
  const NUDGE={
    'sticker-added':{
      // Two steps, resolved by what is actually on screen: while the
      // accordion is shut, point at the way in; once it is open, point
      // at the Emojis card itself. Never at the whole accordion — it is
      // 381px tall and cannot fit above the band, so the visibility
      // contract would (correctly) refuse to point at all.
      find:function(){
        const card=_byLabel('.context-add-card-label','emoji');
        if(card) return card.parentElement||card;
        return document.querySelector('.context-add-trigger');
      },
      hint:"It's over on the right."
    },
    // Two steps: the object has to be chosen before its controls exist
    // at all. The Object Strip is the DOM way in — the page is a canvas,
    // so a sticker has no element of its own to ring. The Strip sits at
    // the very bottom and often cannot clear the band, in which case the
    // words below carry it instead; that is the contract working, not
    // failing.
    'sticker-moved':{
      find:function(){
        return _hasSelection()
          ? _byLabel('.designer-row-label','move left','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        return _hasSelection()
          ? 'Drag them where you want, or nudge them from the right.'
          : "Tap them first — they're in the row under your page.";
      }
    },
    'sticker-resized':{
      find:function(){
        return _hasSelection()
          ? _byLabel('.designer-row-label','size','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        return _hasSelection()
          ? "It's over on the right, under their name."
          : "Tap them first — they're in the row under your page.";
      }
    },
    'story-named':{
      find:function(){ return document.getElementById('bookTitle'); },
      hint:"It's up at the very top."
    },
    // The page's own colour. Two steps again: the tile, then whatever it
    // opens.
    'bg-set':{
      find:function(){ return _byLabel('.context-set-trigger-label','🎨 background','.context-set-tile')
                           || _byLabel('.context-set-trigger-label','background','.context-set-tile'); },
      hint:"The page's own colour lives on the right."
    },
    'page-added':{
      find:function(){ return document.getElementById('addPageBtn'); },
      hint:'A new page waits on the left.'
    },
    'morning':{
      // Two actions, so point at whichever is still outstanding.
      find:function(){
        const bg=document.getElementById('addPageBtn');
        try{
          if(_pageCount()>0 && document.querySelector('.studio-rite-overlay')){ /* no-op */ }
        }catch(e){}
        return bg;
      },
      hint:'A new page first — then give it a morning colour.'
    },
    'text-added':{
      find:function(){
        const card=_byLabel('.context-add-card-label','text');
        if(card) return card.parentElement||card;
        return document.querySelector('.context-add-trigger');
      },
      hint:'Words live with the other things you can add.'
    },
    'sticker-rotated':{
      find:function(){
        return _hasSelection()
          ? _byLabel('.designer-row-label','spin','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        return _hasSelection()
          ? 'There is a spin control on the right.'
          : "Tap it first — it's in the row under your page.";
      }
    }
  };

  let _nudgeEl=null, _nudgeTimers=[];

  // The safe area is the viewport minus the Rite's OWN band, read live
  // rather than hardcoded. Measured at 1343x800 the band occupies
  // 542-800 — a third of the screen — and the Background tile the story
  // asks for sits at 680-734, entirely behind it.
  function _safeBottom(){
    try{
      if(_els && _els.overlay.classList.contains('studio-rite-band')){
        const r=_els.panel.getBoundingClientRect();
        if(r.height>0) return Math.max(0,r.top);
      }
    }catch(e){}
    return window.innerHeight;
  }

  // A control taller than the safe area can still be perfectly usable —
  // its top edge is what a child taps. Requiring the WHOLE element to
  // fit made the nudge refuse to point at anything tall, which is how
  // the first version silently pointed at nothing.
  function _isVisible(el){
    try{
      const r=el.getBoundingClientRect();
      if(r.width<=0||r.height<=0) return false;
      if(r.top<0) return false;
      const need=Math.min(r.height,72);
      return (r.top+need)<=_safeBottom();
    }catch(e){ return false; }
  }

  // Scroll it into the safe area; if that is not enough, shrink the
  // band; if it STILL cannot be seen, refuse to point (the caller falls
  // through to words). A nudge aimed off-screen is worse than none.
  function _ensureVisible(el){
    if(_isVisible(el)) return true;
    try{ el.scrollIntoView({block:'center',inline:'nearest'}); }catch(e){}
    if(_isVisible(el)) return true;
    try{ if(_els) _els.overlay.classList.add('studio-rite-band-compact'); }catch(e){}
    return _isVisible(el);
  }

  function _clearNudge(){
    _nudgeTimers.forEach(function(t){ clearTimeout(t); });
    _nudgeTimers=[];
    if(_nudgeEl){
      try{ _nudgeEl.classList.remove('studio-rite-nudge','studio-rite-nudge-strong'); }catch(e){}
      _nudgeEl=null;
    }
    try{ if(_els) _els.overlay.classList.remove('studio-rite-band-compact'); }catch(e){}
  }

  function _paintNudge(kind){
    const spec=NUDGE[kind];
    if(!spec) return false;
    const el=spec.find();
    if(!el) return false;
    if(el===_nudgeEl) return true;
    if(!_ensureVisible(el)) return false;
    if(_nudgeEl){ try{ _nudgeEl.classList.remove('studio-rite-nudge','studio-rite-nudge-strong'); }catch(e){} }
    _nudgeEl=el;
    try{ el.classList.add('studio-rite-nudge'); }catch(e){}
    return true;
  }

  // Escalation: glow -> stronger pulse -> one spoken hint. The hint is
  // NOT merely a late fallback: if no target can be shown at all (the
  // Object Strip, for instance, sits at the very bottom of the screen
  // and structurally cannot clear the band), words arrive quickly
  // instead, because a child staring at nothing is the failure this
  // whole layer exists to prevent.
  //
  // The tick keeps running after a successful paint, because the right
  // target changes as the child works — selecting their object replaces
  // "tap it in the row below" with the spatial controls themselves.
  //
  // ("Lumo looks", stage 3 of the Part IV design, is not built.)
  function _startNudge(kind,delay){
    _clearNudge();
    const spec=NUDGE[kind];
    if(!spec) return;
    let painted=false, spoke=false, misses=0, shownAt=0;
    const speak=function(){
      if(spoke||!_els) return;
      spoke=true;
      _appendLine({title:(typeof spec.hint==='function')?spec.hint():spec.hint});
    };
    const tick=function(){
      if(!_els) return;
      if(_paintNudge(kind)){
        if(!painted){ painted=true; shownAt=misses; }
        misses=0;
        if(_nudgeEl && !_nudgeEl.classList.contains('studio-rite-nudge-strong')){
          _nudgeTimers.push(setTimeout(function(){
            if(_nudgeEl) try{ _nudgeEl.classList.add('studio-rite-nudge-strong'); }catch(e){}
          },7000));
        }
      }else{
        misses++;
        // ~3.5s of being unable to show anything: use words instead of
        // leaving the child with no guidance at all.
        if(misses>=5) speak();
      }
      _nudgeTimers.push(setTimeout(tick,700));
    };
    _nudgeTimers.push(setTimeout(tick,Math.max(0,delay||0)));
    // Even when the glow is showing, a long silence earns one line.
    _nudgeTimers.push(setTimeout(speak,Math.max(0,delay||0)+18000));
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
    // A new page resets the page's own object count, so "add something"
    // is always measured against what was there when the beat started —
    // never against zero, which would let an object made on page 1
    // satisfy a page-2 beat.
    if(kind==='page-added') return _pageCount()>(baseline&&baseline.__pages||0);
    if(kind==='bg-set'){
      const bg=_bgNow();
      return !!bg && bg!==(baseline&&baseline.__bg);
    }
    // "They stayed all night. Make it morning." is one instruction that
    // takes two actions, exactly as the script writes it: a new page AND
    // a colour on it. Checking the colour alone would pass instantly,
    // because a fresh page starts with no background at all.
    if(kind==='morning'){
      return _pageCount()>(baseline&&baseline.__pages||0) && !!_bgNow();
    }
    if(kind==='text-added') return _textCount()>(baseline&&baseline.__texts||0);
    const list=_stickers();
    if(kind==='sticker-added') return list.length>(baseline&&baseline.__count||0);
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
    if(kind==='sticker-rotated'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && ((s.rotation||0)!==b.rotation);
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

  function _bgNow(){
    try{
      const p=PageRuntime.getActivePage();
      return (p&&p.metadata&&p.metadata.cardOverrides&&p.metadata.cardOverrides.background)||'';
    }catch(e){ return ''; }
  }
  function _pageCount(){
    try{ return (AppState&&AppState.slides&&AppState.slides.length)||0; }catch(e){ return 0; }
  }
  function _textCount(){
    return _stickers().filter(function(s){ return s.kind==='text'; }).length;
  }

  // Everything a beat might be waiting on, sampled at the moment the
  // beat begins. Counts are per-PAGE, so adding a page resets them —
  // which is what makes "add something" work again on page 2 and 3.
  function _baseline(){
    const map={};
    _stickers().forEach(function(s){
      map[s.id]={x:s.x,y:s.y,w:s.w,h:s.h,rotation:s.rotation||0};
    });
    map.__title=_titleNow();
    map.__bg=_bgNow();
    map.__pages=_pageCount();
    map.__count=_stickers().length;
    map.__texts=_textCount();
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
    _speak(entry.voiceId);
  }

  // Lumo's own recorded voice, where one exists. Guarded the same way
  // every other optional module is: a missing LumoVoice, or a line with
  // no recording yet, simply plays nothing.
  //
  // Stopping the previous clip first is a real bug fix, not tidiness. A
  // screen's last line has no gap timer (the screen's end takes over),
  // so a child who taps the button while Lumo is still speaking used to
  // carry that clip into the next screen and hear TWO Lumos at once.
  // Caught in a real run: Screen 2's first line played over Screen 1's
  // third.
  function _speak(voiceId){
    try{
      if(typeof LumoVoice==='undefined' || !LumoVoice.play) return;
      if(_voiceId && _voiceId!==voiceId){ try{ LumoVoice.stop(_voiceId); }catch(e){} }
      _voiceId=voiceId||null;
      if(voiceId) LumoVoice.play(voiceId);
    }catch(e){}
  }

  function _hush(){
    try{
      if(_voiceId && typeof LumoVoice!=='undefined' && LumoVoice.stop) LumoVoice.stop(_voiceId);
    }catch(e){}
    _voiceId=null;
  }

  // A spoken line stays up until Lumo has finished saying it; an unvoiced
  // one falls back to the reading-speed estimate. This is why the gap is
  // read per line rather than being one constant.
  function _gapFor(entry){
    try{
      if(entry.voiceId && typeof LumoVoice!=='undefined' && LumoVoice.durationMs){
        const ms=LumoVoice.durationMs(entry.voiceId);
        if(ms>0) return ms+450;   // a short breath after the line lands
      }
    }catch(e){}
    return _lineGapMs(entry.line);
  }

  // Every line of a screen appears on its own, one after another. The
  // child is never asked to click to hear the next thing Lumo says.
  function _playLines(lines){
    return lines.reduce(function(chain,entry,i){
      return chain.then(function(){
        _showLine(entry);
        if(i===lines.length-1) return;   // last line: the screen's end takes over
        return new Promise(function(r){ _timer=setTimeout(r,_gapFor(entry)); });
      });
    },Promise.resolve());
  }

  // A screen ends in exactly one of three ways: a button, the one
  // "Yes", or something the child makes.
  function _playEnd(end,nudgeDelay){
    if(end.move) return _awaitClick(end.move);
    if(end.choice) return _awaitClick(end.choice,'studio-rite-choice-primary');
    if(end.await) return _awaitAction(end.await,nudgeDelay);
    return Promise.resolve();
  }

  // A beat the child completes by making something. Waits indefinitely.
  function _awaitAction(kind,nudgeDelay){
    return new Promise(function(resolve){
      const baseline=_baseline();
      _startNudge(kind,nudgeDelay);
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
        _clearNudge();
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
    _hush();          // never let the previous screen's voice bleed in
    _clearConvo();
    return _playLines(screen.lines).then(function(){
      return _playEnd(screen.end,screen.nudgeDelay);
    });
  }

  function _teardown(){
    _running=false;
    _clearNudge();
    _hush();
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
