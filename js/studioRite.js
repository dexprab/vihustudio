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

  // False for the whole story, true from the finale onward. js/app.js
  // reads it to decide whether the header's two story buttons are
  // asleep — the Rite holds them shut whatever the project looks like,
  // because the story is not finished until Lumo says it is.
  function actionsUnlocked(){ return _actionsUnlocked; }

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
    // ---- Act I — Where am I?
    {lines:[
      {lumo:'wave', egg:'idle',
       line:{title:'Welcome to VihuStudio.',
             subtitle:'This is where you make stories.'}},
      {lumo:'talk', egg:'curious', effect:'glow',
       line:{title:'This is your Story Egg.',
             subtitle:'It is yours to look after.'}},
      {lumo:'curious', egg:'idle',
       line:{title:'It will stay with you while you make your story.'}}
     ], bg:true, audio:{id:'riteScreen1',cues:[0,3.14,6.14]}, end:{move:"Let's Begin"}},

    // ---- Act II — Who am I?
    {lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Everyone who comes here is called a Traveller.',
             subtitle:'That is you.'}},
      {lumo:'curious', egg:'curious',
       line:{title:'Travellers make stories.',
             subtitle:'You are going to make one now.'}},
      {lumo:'wave', egg:'excited',
       line:{title:'Nobody knows what is inside a Story Egg.',
             subtitle:'Not even me.'}}
     ], bg:true, audio:{id:'riteScreen2',cues:[0,8.78,14.20]}, end:{choice:'Start My First Story'}, opensStudio:true},

    // ---- The Starter Story: "The Night a Star Came Down"
    // Page 1 — The Falling. Every line: one instruction, one new idea,
    // and the child knows what to do the moment it ends.
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'We are going to make a story about a star that falls out of the sky.',
             subtitle:'Add a star to your page.'}}
     ], audio:{id:'riteScreen3',cues:[0]}, end:{await:'sticker-added'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Stars are hard to see in the daytime.',
             subtitle:'Make the sky dark.'}}
     ], audio:{id:'riteScreen4',cues:[0]}, end:{await:'bg-set'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'Your star is far away up in the sky.',
             subtitle:'Make your star smaller.'}}
     ], audio:{id:'riteScreen5',cues:[0]}, end:{await:'sticker-resized'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Now the star starts to fall.',
             subtitle:'Turn your star a little.'}}
     ], audio:{id:'riteScreen6',cues:[0]}, end:{await:'sticker-rotated'}, nudgeDelay:0},

    // Page 2 — The Finding.
    //
    // The child COPIES the page rather than adding a blank one, and this
    // is a story requirement before it is a teaching one. "+ Add Page"
    // makes an empty page: the star the whole story is about would not
    // be on it, so "Someone comes to find the star" would ask a child to
    // find something that is not there, and page 3's "Move your star up
    // high" would have no star to move at all — an unpassable beat in a
    // mandatory Rite. Copying carries the scene forward, which is also
    // simply how picture books work.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'The star falls down and down.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Your page can make a copy of itself.',
             subtitle:'Copy this page.'}}
     ], audio:{id:'riteScreen7',cues:[0,5.24]}, end:{await:'page-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'This new page is the ground.',
             subtitle:'Choose a colour for the ground.'}}
     ], end:{await:'bg-set'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'A tree grows here.',
             subtitle:'Add a tree.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Make your tree bigger.'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Someone comes to find the star.',
             subtitle:'Add a person or an animal.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Good choice.',
             subtitle:'Move them next to the star.'}}
     ], end:{await:'sticker-moved'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'They want to say something to the star.',
             subtitle:'Add some words.'}}
     ], end:{await:'text-added'}, nudgeDelay:4000},

    // Page 3 — The Going Home. "Make it morning" used to ask for a new
    // page AND a colour in one line; split in two, one instruction each.
    {band:true, lines:[
      {lumo:'curious', egg:'excited',
       line:{title:'They stayed with the star all night.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Now it is morning.',
             subtitle:'Copy this page again.'}}
     ], end:{await:'page-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Make this sky light.'}}
     ], end:{await:'bg-set'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'The star is strong again.',
             subtitle:'Move your star up high.'}}
     ], end:{await:'sticker-moved'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'excited',
       line:{title:'The star is going home.',
             subtitle:'Make your star very small.'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'Your star is home now.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Your friend is happy.',
             subtitle:'Add a heart or a smiley face.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Now tell us how the story ends.',
             subtitle:'Add some words.'}}
     ], end:{await:'text-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Every story needs a name.',
             subtitle:'Give your story a name.'}}
     ], end:{await:'story-named'}, nudgeDelay:12000},

    // Story Play. The child watches their own three pages turn, before
    // any decision about sharing. Not a demonstration of the canonical
    // story — that would make them copy, and would make the closing
    // line ("you did all of it yourself") untrue. This is theirs.
    //
    // `unlock` wakes Play My Story and Share with VihuPlanet, which have
    // been dormant in the header since the Rite began. The Rite no
    // longer turns the pages itself: the child presses the button, and
    // so learns the control they will use for every story after this
    // one. A chapter that teaches through creation should not perform a
    // control on a child's behalf when it can hand it over.
    {band:true, unlock:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Your story is finished.',
             subtitle:'Watch it from the beginning.'}}
     ], end:{await:'story-played'}, nudgeDelay:2000},

    // The sharing beat (Decision 7). Declining is a real choice: the
    // story stays theirs, the Studio still unlocks, and the Creator
    // Ceremony waits for whichever story they do share. Nothing here
    // claims anyone else can see it — sharing makes the story into
    // something they can keep, which is exactly what Publish does.
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Right now your story only lives on this screen.'}},
      {lumo:'curious', egg:'excited',
       line:{title:'Sharing makes it into something you can keep.',
             subtitle:'Tap Share with VihuPlanet.'}}
     ], end:{await:'story-shared', decline:'Not now'}, nudgeDelay:3000},

    // The close.
    {band:true, lines:[
      {lumo:'curious', egg:'excited', effect:'glow',
       line:{title:'You made this story.',
             subtitle:'It was not here before today.'}},
      {lumo:'talk', egg:'idle',
       line:{title:'You did all of it yourself.',
             subtitle:'I only asked the questions.'}},
      {lumo:'wave', egg:'idle',
       line:{title:'Now you know how to make a story.'}}
     ], end:{move:'Into the Studio'}}
  ];

  // The mission, held on screen for the whole story so a child never
  // loses the thread of what they are making. Deliberately a reference,
  // not an instruction — it never competes with the line Lumo is
  // speaking, and it never changes.
  // How long the child has to be still before a beat counts as finished.
  // Long enough to cover the gap between two colour taps or two words of
  // a title; short enough that a child who really has stopped is not
  // left waiting on Lumo.
  const SETTLE_MS=1800;
  // Beats with nothing to settle — they happen once, in an instant.
  const DISCRETE={'page-added':1,'story-played':1,'story-shared':1};

  const MISSION='Our story: a star falls from the sky, and someone helps it home.';

  // The stage artwork behind screens 1 and 2. Three extensions are tried
  // in order rather than one canonical name, because the file arrives by
  // upload and "I added it and nothing happened" is a worse failure than
  // two extra HEAD-shaped image loads that miss.
  //
  // Resolution is entirely optional: if none of them load, the overlay
  // keeps its original gradient. That is not a nicety — the Rite is a
  // mandatory gate on a child's first run, so a missing or slow asset
  // must never be able to show them an empty screen.
  const STAGE_BG_CANDIDATES=['assets/rite/stage.webp','assets/rite/stage.jpg','assets/rite/stage.png',
                             // Where the artwork first arrived, kept so an
                             // upload to the old path still works.
                             'assets/rites/screne1-2.webp'];
  let _stageBg=null;      // resolved url, or null once every candidate has failed

  function _resolveStageBg(){
    return new Promise(function(resolve){
      let i=0;
      const tryNext=function(){
        if(i>=STAGE_BG_CANDIDATES.length){ resolve(null); return; }
        const url=STAGE_BG_CANDIDATES[i++];
        const img=new Image();
        // Resolve with the image's OWN absolute src, not the relative
        // path. A relative url() inside a custom property is resolved
        // against the STYLESHEET, so 'assets/rite/stage.png' became
        // 'css/assets/rite/stage.png' and 404'd — while this very
        // Image(), resolved against the document, had loaded it fine.
        img.onload=function(){ resolve(img.src||url); };
        img.onerror=tryNext;
        img.src=url;
      };
      tryNext();
    });
  }

  // Applied per screen, so band mode never inherits it — the dock plays
  // over the live Studio and has no background of its own.
  function _applyStageBg(on){
    if(!_els) return;
    try{
      if(on && _stageBg){
        _els.overlay.style.setProperty('--rite-stage-bg','url("'+_stageBg+'")');
        _els.overlay.classList.add('studio-rite-hasbg');
      }else{
        _els.overlay.classList.remove('studio-rite-hasbg');
      }
    }catch(e){}
  }

  const ASSETS_BASE='assets/';
  const IDLE_DRIFT_MS=20000;  // the Egg drifts to sleep, and wakes on activity
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;
  let _unobserve=null;
  let _paperGuard=null;       // unsubscribe for the plain-paper observer
  let _bandRO=null;           // ResizeObserver keeping --rite-band-h honest
  // Play My Story and Share with VihuPlanet stay asleep in the header
  // for the whole story and wake at the finale. js/app.js reads this.
  let _actionsUnlocked=false;
  let _yieldTimer=null;       // watches for a modal the Rite must stand behind
  let _cueTimers=[];          // line reveals scheduled against a recording
  let _dockWatch=null;        // resize handler that re-places the dock
  let _dockUnobserve=null;    // page-list observer that re-places the dock
  let _running=false;
  let _voiceId=null;   // the clip currently speaking, so it can be silenced
  let _bgTouched=false; // the child actually used the background control

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
    const mission=_el('div','studio-rite-mission');
    mission.textContent=MISSION;
    const convo=_el('div','studio-rite-convo');
    const controls=_el('div','studio-rite-controls');
    panel.appendChild(cast);
    panel.appendChild(mission);
    panel.appendChild(convo);
    panel.appendChild(controls);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return {overlay:overlay,panel:panel,convo:convo,controls:controls,
            mission:mission,lumoImg:lumoImg,eggImg:eggImg,particles:particles};
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
  // On the artwork screens the conversation is capped at the newest two
  // lines. It has to be: the panel's rows are sized to their content so
  // the cast can reach the horizon, which means a third line grows the
  // conversation and pushes Lumo and the Egg back up off the hill. The
  // pairing is also how the script reads — what was just said, and what
  // is being said now.
  //
  // Only the artwork screens are capped. In band mode the dock scrolls,
  // and on a plain gradient there is no horizon to stand on, so neither
  // has a reason to lose a line.
  const STAGE_VISIBLE_LINES=2;

  function _trimConvo(){
    try{
      if(!_els||!_els.convo) return;
      const ov=_els.overlay;
      if(!ov.classList.contains('studio-rite-hasbg')) return;
      if(ov.classList.contains('studio-rite-band')) return;
      const rows=_els.convo.querySelectorAll('.studio-rite-line');
      for(let i=0;i<rows.length-STAGE_VISIBLE_LINES;i++){
        if(rows[i].parentNode) rows[i].parentNode.removeChild(rows[i]);
      }
    }catch(e){}
  }

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
    _trimConvo();
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

  // The ⋮ on the page the child is actually on — the way into the page
  // menu. Falls back to the first thumbnail so the nudge still has
  // somewhere to point if the index cannot be read.
  function _thumbMenuBtn(){
    try{
      const i=(AppState&&AppState.currentSlide)||0;
      return document.querySelector('#slideList .thumb[data-index="'+i+'"] .thumb-menu-btn')
          || document.querySelector('#slideList .thumb-menu-btn');
    }catch(e){ return null; }
  }

  // Duplicate Page, but only while the menu is genuinely open — a hidden
  // menu item is not something a child can tap, and ringing it would
  // point at nothing.
  function _pageMenuItem(){
    try{
      const menu=document.getElementById('contextMenu');
      if(!menu||menu.classList.contains('hidden')) return null;
      return menu.querySelector('[data-action="duplicate"]');
    }catch(e){ return null; }
  }

  // The way in to adding anything. Shared by the add beats and by the
  // empty-page recovery below.
  function _addWayIn(){
    const card=_byLabel('.context-add-card-label','emoji');
    if(card) return card.parentElement||card;
    return document.querySelector('.context-add-trigger');
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
      find:_addWayIn,
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
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','move left','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
        return _hasSelection()
          ? 'Drag them where you want, or nudge them from the right.'
          : "Tap them first — they're in the row under your page.";
      }
    },
    'sticker-resized':{
      find:function(){
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','size','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
        return _hasSelection()
          ? "It's over on the right, under their name."
          : "Tap them first — they're in the row under your page.";
      }
    },
    'story-played':{
      find:function(){ return document.getElementById('playStoryBtn'); },
      hint:'It is up at the top, and it just woke up.'
    },
    'story-shared':{
      find:function(){ return document.getElementById('shareBtn'); },
      hint:'It is up at the top, next to Play My Story.'
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
    // Copying a page is two steps, and neither of them is a button
    // sitting in the open: the ⋮ on the page's own thumbnail opens the
    // page menu, and Duplicate Page lives inside it. So the nudge walks
    // the child there — the ⋮ first, then the menu item the moment the
    // menu is up. This is the same "the target changes as they work"
    // shape the sticker beats already use.
    'page-added':{
      find:function(){
        const item=_pageMenuItem();
        if(item) return item;
        return _thumbMenuBtn();
      },
      hint:function(){
        return _pageMenuItem()
          ? 'Tap "Duplicate Page".'
          : 'Your pages are down the left side.';
      }
    },
    'text-added':{
      find:function(){
        const card=_byLabel('.context-add-card-label','text');
        if(card) return card.parentElement||card;
        return document.querySelector('.context-add-trigger');
      },
      hint:'Words live with the other things you can add.'
    },
    // A page the child has emptied — by deleting what they made, which
    // exploring children do — used to leave these three beats with
    // nothing to point at and no way to pass, on a Rite there is no way
    // out of. Now the guidance simply becomes "put something back", and
    // the beat completes properly once there is something to move.
    'sticker-rotated':{
      find:function(){
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','spin','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
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
      if(_els && _els.overlay.classList.contains('studio-rite-band')
             && !_els.overlay.classList.contains('studio-rite-rail')){
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
    try{
      if(_els && !_els.overlay.classList.contains('studio-rite-rail'))
        _els.overlay.classList.add('studio-rite-band-compact');
    }catch(e){}
    return _isVisible(el);
  }

  // The one quiet row under the conversation. Both the escalation hint
  // and the redirect below write here, so a child never has two pieces
  // of guidance on screen at once. A redirect answers something the
  // child has just this moment done, so for a few seconds it outranks
  // the general "here is where that lives".
  let _hintAt=0;
  function _sayHint(txt,priority){
    if(!_els||!txt) return;
    if(!priority && _hintAt && (Date.now()-_hintAt)<6000) return;
    try{
      let row=_els.panel.querySelector('.studio-rite-hint');
      if(!row){
        row=_el('div','studio-rite-hint');
        _els.convo.parentNode.insertBefore(row,_els.controls);
      }
      if(row.textContent!==txt) row.textContent=txt;
      if(priority) _hintAt=Date.now();
    }catch(e){}
  }

  function _clearNudge(){
    _nudgeTimers.forEach(function(t){ clearTimeout(t); });
    _nudgeTimers=[];
    _hintAt=0;
    try{
      const row=_els&&_els.panel.querySelector('.studio-rite-hint');
      if(row&&row.parentNode) row.parentNode.removeChild(row);
    }catch(e){}
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
    // The hint is NOT a conversation line. Appending it dimmed the real
    // instruction to "past" and made the hint the brightest thing on
    // screen — backwards. It gets its own quiet row instead, under the
    // conversation, and the instruction stays the brightest thing.
    const speak=function(){
      if(spoke||!_els) return;
      spoke=true;
      try{ _sayHint((typeof spec.hint==='function')?spec.hint():spec.hint,false); }
      catch(e){}
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
    // A duplicated page arrives carrying the previous page's colour, and
    // a child may simply re-pick the colour they already had. Requiring
    // the VALUE to change would strand them on a beat they cannot pass,
    // so a real touch of the background control counts too — recorded by
    // the same delegated input listener the beat already runs.
    if(kind==='bg-set'){
      const bg=_bgNow();
      if(!bg) return false;
      return bg!==(baseline&&baseline.__bg) || _bgTouched;
    }
    // The child pressed Play My Story. Watched rather than told: the
    // player counts its own readings, so the button stays the only
    // thing a child touches and nothing has to report back here.
    if(kind==='story-played'){
      try{ return StoryPlayer.playCount()>(baseline&&baseline.__plays||0); }
      catch(e){ return false; }
    }
    // The child shared. Read from MagicCard's own hasEverPublished flag,
    // which js/publishStudio.js already sets on a completed publish —
    // the same signal the Creator Ceremony itself is gated on, so this
    // can never disagree with whether a publish really happened.
    if(kind==='story-shared'){
      try{ return !!MagicCard.growthSignals().hasEverPublished && !(baseline&&baseline.__published); }
      catch(e){ return false; }
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
    try{ map.__plays=StoryPlayer.playCount(); }catch(e){ map.__plays=0; }
    try{ map.__published=!!MagicCard.growthSignals().hasEverPublished; }catch(e){ map.__published=false; }
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
  // A screen with its own recording plays the take from end to end and
  // reveals each line at a measured cue. `holdForAudio` is true only for
  // screens that end in a BUTTON: there the screen waits for the
  // recording to finish, so a child cannot click Lumo off mid-sentence.
  // A screen that ends by waiting for the child resolves as soon as the
  // last line is up — its baseline is captured at that moment, and a
  // child who acts while Lumo is still talking must have that action
  // counted, not swallowed.
  function _playRecorded(lines,audio,holdForAudio){
    return new Promise(function(resolve){
      let total=0;
      try{ total=LumoVoice.durationMs(audio.id)||0; }catch(e){}
      _speak(audio.id);
      const last=audio.cues.length-1;
      lines.forEach(function(entry,i){
        const at=Math.max(0,Math.round((audio.cues[i]||0)*1000));
        const t=setTimeout(function(){ _showLine(entry); },at);
        _cueTimers.push(t);
      });
      const lastAt=Math.round((audio.cues[last]||0)*1000);
      const endAt=holdForAudio ? Math.max(lastAt+400,total) : lastAt+400;
      _cueTimers.push(setTimeout(resolve,endAt));
    });
  }

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
  function _playEnd(end,nudgeDelay,instruction){
    if(end.move) return _awaitClick(end.move);
    if(end.choice) return _awaitClick(end.choice,'studio-rite-choice-primary');
    if(end.await) return _awaitAction(end.await,nudgeDelay,instruction,end.decline);
    return Promise.resolve();
  }

  // What the child was actually asked to do: the last thing Lumo said on
  // this screen, preferring the subtitle, which is where the instruction
  // lives when a screen has both.
  function _instructionOf(screen){
    try{
      const last=screen.lines[screen.lines.length-1];
      return (last&&last.line&&(last.line.subtitle||last.line.title))||'';
    }catch(e){ return ''; }
  }

  // Everything the child has made on this page, in one comparable
  // string. Used only to notice that they DID something — never to
  // judge what.
  function _workSignature(){
    try{
      return _pageCount()+'|'+_bgNow()+'|'+_titleNow()+'|'+_textCount()+'|'+
        _stickers().map(function(s){
          return s.id+':'+s.x+','+s.y+':'+s.w+'x'+s.h+':'+(s.rotation||0);
        }).join('~');
    }catch(e){ return ''; }
  }

  // "Nice. Now make the sky dark." The beat's own instruction, said
  // again. Every awaited beat's last line is already an imperative, so
  // this needs no new copy — which is the point: the child hears the
  // same sentence, not a correction and not a different idea.
  function _redirectText(instruction){
    if(!instruction) return '';
    const s=String(instruction).trim();
    if(!s) return '';
    return 'Nice. Now '+s.charAt(0).toLowerCase()+s.slice(1);
  }

  // A beat the child completes by making something. Waits indefinitely.
  //
  // A child who taps something other than what Lumo asked for is never
  // stopped, told they were wrong, or told which button they should have
  // pressed. Everything reachable in the Studio during the Rite is a
  // real, safe, undoable creative act, and the Rite's whole premise is
  // that it teaches through creation — the first thing the Studio ever
  // says to a child must not be "no". So exploring is simply allowed,
  // and the only response to it is the same instruction, offered again
  // once, warmly: they stay on the path without ever being held to it.
  // Beats that act on the PAGE rather than on a selected object. After
  // adding a star the star is selected, and the right panel is showing
  // that star's own controls — so the next beat ("make the sky dark")
  // asks for something the child cannot see without first finding their
  // way back. Clearing the selection returns the panel to Personalize,
  // which is where Background lives, and where the nudge points.
  //
  // Never done for the spatial beats: move, resize and spin need the
  // selection they are about to use.
  const PAGE_LEVEL={'bg-set':1,'page-added':1,'story-named':1,
                    'sticker-added':1,'text-added':1};

  function _showPageControls(){
    try{
      if(typeof PageRuntime==='undefined' || !PageRuntime.clearSelection) return;
      PageRuntime.clearSelection();
      // clearSelection only writes the host's selection fields; the five
      // panel refreshes hang off notify(), so without this the panel
      // keeps showing the object the child has finished with.
      PageRuntime.notify();
    }catch(e){}
  }

  // `declineLabel`, when given, puts a quiet second way out beside the
  // beat — used only by the sharing beat, where saying no is a real
  // answer rather than a failure to comply. It resolves the beat exactly
  // as completing it would: the Rite carries on and the Studio unlocks.
  function _awaitAction(kind,nudgeDelay,instruction,declineLabel){
    return new Promise(function(resolve){
      if(PAGE_LEVEL[kind]) _showPageControls();
      const baseline=_baseline();
      _bgTouched=false;
      _startNudge(kind,nudgeDelay);
      const redirect=_redirectText(instruction);
      const startedAt=Date.now();
      let lastWork=_workSignature();
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
        if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
        _clearNudge();
        if(idleTimer){ clearTimeout(idleTimer); idleTimer=null; }
        if(poll){ clearInterval(poll); poll=null; }
        if(onInput){ try{ document.removeEventListener('input',onInput,true); }catch(e){} onInput=null; }
        if(_unobserve){ try{ _unobserve(); }catch(e){} _unobserve=null; }
      };
      // A beat used to end on the FIRST qualifying change, which is not
      // the same thing as the child being finished. "Make your star
      // smaller" is satisfied by the first pixel of a drag, so Lumo
      // moved on while a child was still resizing; naming a story ended
      // on the first keystroke. The condition now only ARMS the beat,
      // and the beat ends once the child has actually stopped — any
      // further change restarts the wait. A child who keeps working
      // simply keeps Lumo waiting, which is right rather than costly:
      // the Rite is theirs to pace.
      //
      // Discrete beats are exempt. Copying a page, pressing Play and
      // sharing all happen in an instant and have no "still working"
      // state, so waiting there would just be dead air.
      const settles=!DISCRETE[kind];
      let settleTimer=null, settleSig=null;
      const finish=function(){
        if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
        cleanup();
        try{ if(_els) _els.controls.innerHTML=''; }catch(e){}
        resolve();
      };
      const armSettle=function(){
        if(settleTimer) clearTimeout(settleTimer);
        settleSig=_workSignature();
        settleTimer=setTimeout(finish,SETTLE_MS);
      };

      const check=function(){
        if(!_conditionMet(kind,baseline)){
          if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
          rearmIdle();
          // They changed something, and it was not the thing being
          // waited on. Say the instruction again — at most once every
          // six seconds, and never in the first three, so a child mid-
          // action is not talked over.
          const now=_workSignature();
          if(now!==lastWork){
            lastWork=now;
            if(redirect && (Date.now()-startedAt)>3000) _sayHint(redirect,true);
          }
          return;
        }
        if(!settles){ finish(); return; }
        // Armed. Now wait for the child to actually stop.
        if(!settleTimer){ armSettle(); return; }
        const sig=_workSignature();
        if(sig!==settleSig) armSettle();   // still working — wait again
      };
      if(declineLabel && _els){
        try{
          const btn=_el('button','studio-rite-choice studio-rite-decline',declineLabel);
          btn.type='button';
          btn.addEventListener('click',function(){ cleanup(); try{ _els.controls.innerHTML=''; }catch(e){} resolve(); });
          _els.controls.innerHTML='';
          _els.controls.appendChild(btn);
        }catch(e){}
      }
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
        onInput=function(ev){
          try{
            const t=ev&&ev.target;
            if(t&&t.closest&&t.closest('.context-set-tile')) _bgTouched=true;
          }catch(e){}
          check();
        };
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

  function _clearCues(){
    _cueTimers.forEach(function(t){ clearTimeout(t); });
    _cueTimers=[];
  }

  function _playScreen(screen){
    _clearCues();
    _applyStageBg(!!screen.bg && !screen.band);
    if(screen.band) _toBandMode();
    if(screen.unlock && !_actionsUnlocked){
      _actionsUnlocked=true;
      try{ if(typeof window.refreshStoryActions==='function') window.refreshStoryActions(); }catch(e){}
    }
    _hush();          // never let the previous screen's voice bleed in
    _clearConvo();
    const rec=screen.audio && screen.audio.cues
              && screen.audio.cues.length===screen.lines.length
              && typeof LumoVoice!=='undefined' && LumoVoice.play;
    const holdForAudio=!!(screen.end && (screen.end.move||screen.end.choice));
    return (rec?_playRecorded(screen.lines,screen.audio,holdForAudio)
               :_playLines(screen.lines)).then(function(){
      return _playEnd(screen.end,screen.nudgeDelay,_instructionOf(screen));
    });
  }

  // The Rite's pages are sheets of paper, not picture cards. A page
  // normally carries an empty Artwork Place — a large white rectangle
  // over most of it — and the child's Background colour paints only the
  // paper AROUND that, so "make the sky dark" left the biggest thing on
  // the page white.
  //
  // Applied to EVERY page while the Rite runs, not just the first.
  // Duplicating carries the mark, but a page made any other way would
  // not, and one page in three with a white box through it is worse
  // than none — so this is enforced rather than assumed.
  // Re-entrancy: this runs as a PageRuntime observer AND asks
  // PageRuntime to redraw, so without the latch the redraw would call it
  // straight back. The second pass finds nothing to touch and stops on
  // its own, but a latch says so outright instead of relying on that.
  let _inPaper=false;
  function _plainPaper(){
    if(_inPaper) return;
    _inPaper=true;
    try{
      const slides=(AppState&&AppState.slides)||[];
      let touched=false;
      slides.forEach(function(s){
        if(!s) return;
        if(!s.metadata) s.metadata={};
        if(!s.metadata.noPlace){ s.metadata.noPlace=true; touched=true; }
      });
      if(touched) PageRuntime.notify();
    }catch(e){}
    _inPaper=false;
  }

  function _teardown(){
    _running=false;
    _clearCues();
    // The Studio's own content rules own the buttons from here.
    try{ if(typeof window.refreshStoryActions==='function') window.refreshStoryActions(); }catch(e){}
    if(_paperGuard){ try{ _paperGuard(); }catch(e){} _paperGuard=null; }
    if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
    if(_yieldTimer){ clearInterval(_yieldTimer); _yieldTimer=null; }
    if(_dockWatch){ try{ window.removeEventListener('resize',_dockWatch); }catch(e){} _dockWatch=null; }
    if(_dockUnobserve){ try{ _dockUnobserve(); }catch(e){} _dockUnobserve=null; }
    try{ document.body.classList.remove('studio-rite-beside'); }catch(e){}
    try{ document.body.style.removeProperty('--rite-list-max'); }catch(e){}
    try{ document.body.style.removeProperty('--rite-band-h'); }catch(e){}
    try{ document.body.classList.remove('studio-rite-running'); }catch(e){}
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
    _els.overlay.classList.add('studio-rite-has-mission');
    _placeDock();
    _watchForModal();
    if(!_dockWatch){
      _dockWatch=function(){ _placeDock(); };
      try{ window.addEventListener('resize',_dockWatch); }catch(e){}
      // The page list grows as the child copies pages, which pushes the
      // top of the dock down. PageRuntime is the one thing that knows.
      try{
        if(typeof PageRuntime!=='undefined' && PageRuntime.observe)
          _dockUnobserve=PageRuntime.observe(_dockWatch);
      }catch(e){}
    }
  }

  // Measures the left rail and decides where the Rite speaks from.
  //
  // The dock is the product owner's call, and the measurements back it:
  // the column under the page thumbnails is the one part of the editor
  // nothing else ever claims, and moving the conversation there gives
  // the child's page back the whole 100px the bottom band was taking —
  // 265px to 363px at 1360x596, a 37% larger canvas.
  //
  // Everything is read live rather than hardcoded: the sidebar's width
  // changes at five breakpoints, and the thumbnails the dock sits under
  // grow with the story. Below 768px the workspace collapses to a single
  // column and the sidebar becomes a strip across the top — there is no
  // rail to dock into, so the bottom band stays as the fallback rather
  // than the conversation being crammed somewhere it cannot be read.
  // Publish Studio opens at z-index 300; the Rite's dock sits at 1400,
  // so without this the dock would render straight over the top of it —
  // the same "two guides at once" defect as two Lumos. The sharing beat
  // is exactly when this happens, so the Rite stands down for as long as
  // the modal is up and comes back when it closes.
  //
  // A poll rather than :has() or a MutationObserver: nothing else in
  // this stylesheet depends on :has() yet and a silent failure here
  // would be invisible, while an observer over the whole body is a lot
  // of machinery for one boolean.
  function _watchForModal(){
    if(_yieldTimer) return;
    _yieldTimer=setInterval(function(){
      if(!_els){ return; }
      let covered=false;
      try{
        const m=document.querySelector('.publish-studio-modal');
        covered=!!(m && !m.classList.contains('hidden'));
      }catch(e){}
      try{ _els.overlay.classList.toggle('studio-rite-yield',covered); }catch(e){}
    },350);
  }

  function _placeDock(){
    if(!_els) return;
    const ov=_els.overlay;
    let mode='band';
    try{
      const area=document.querySelector('.preview-area');
      const canvas=document.getElementById('previewCanvas');
      const sidebar=document.querySelector('.sidebar:not(.right-sidebar)');
      const list=document.getElementById('slideList');

      // 1. BESIDE THE PAGE — the product owner's preference, and the
      //    closest Lumo can stand to the thing he is talking about.
      //
      //    The page is normally centred in its stage, which splits the
      //    free space into two gutters too narrow to read in: 133px each
      //    at 1343x800, measured. So while the Rite runs the page is
      //    pushed to the RIGHT of the stage instead, which hands both
      //    gutters to Lumo as one column — 249px at 800, 430px at 596 —
      //    and costs the page nothing: it keeps its full height either
      //    way. The Selection Action Strip still has its own room on the
      //    far side (it needs 160px past the canvas; there are 332).
      if(area&&canvas){
        const ar=area.getBoundingClientRect();
        const cr=canvas.getBoundingClientRect();
        const gutter=Math.round(ar.width-cr.width-32);
        if(gutter>=210 && ar.height>=260){
          const width=Math.min(320,gutter-24);
          // Sit against the page, not against the far wall — "beside the
          // page" is the whole point. The page's post-push left edge is
          // computed rather than measured, because on the first pass the
          // page has not been pushed yet and its current position would
          // put Lumo in the wrong place for one frame.
          const pageLeft=ar.right-16-cr.width;
          const left=Math.max(Math.round(ar.left+8),Math.round(pageLeft-24-width));
          ov.style.setProperty('--rite-dock-left',left+'px');
          ov.style.setProperty('--rite-dock-top',Math.round(ar.top+16)+'px');
          ov.style.setProperty('--rite-dock-width',width+'px');
          ov.style.setProperty('--rite-dock-height',Math.round(ar.height-32)+'px');
          mode='beside';
        }
      }

      // 2. THE LEFT RAIL — when the page is wide enough to leave no
      //    usable gutter. The page list is capped so the column below it
      //    can never be squeezed out: at three pages the thumbnails grow
      //    from 78px to 254px, which on a 596px window left the dock
      //    202px and dropped the whole Rite back to a strip along the
      //    bottom. The list scrolls instead, and the nudge already
      //    scrolls a page's own menu button into view when it points.
      if(mode==='band' && sidebar && list){
        const sr=sidebar.getBoundingClientRect();
        const lr=list.getBoundingClientRect();
        const ar2=area?area.getBoundingClientRect():null;
        const cs=getComputedStyle(sidebar);
        const padL=parseFloat(cs.paddingLeft)||0;
        const padR=parseFloat(cs.paddingRight)||0;
        const width=Math.round(sr.width-padL-padR);
        // Measuring the sidebar's SIZE cannot tell a left column from a
        // collapsed strip across the top — at a 700px viewport the
        // collapsed sidebar is 668px wide, past any threshold, and
        // docking there put the conversation over the page. Its right
        // edge clearing the stage's left edge is the real test.
        const isLeftColumn=!ar2 || (sr.right<=ar2.left+2);
        const bottomLimit=window.innerHeight-16;
        const DOCK_MIN=300;
        const listMax=Math.max(110,Math.round(bottomLimit-DOCK_MIN-14-lr.top));
        const listH=Math.min(Math.round(lr.height),listMax);
        const top=Math.round(Math.max(lr.top+listH+14,sr.top+14));
        const height=Math.round(bottomLimit-top);
        if(isLeftColumn && width>=180 && height>=220){
          document.body.style.setProperty('--rite-list-max',listMax+'px');
          ov.style.setProperty('--rite-dock-left',Math.round(sr.left+padL)+'px');
          ov.style.setProperty('--rite-dock-top',top+'px');
          ov.style.setProperty('--rite-dock-width',width+'px');
          ov.style.setProperty('--rite-dock-height',height+'px');
          mode='rail';
        }
      }
    }catch(e){}

    try{
      ov.classList.toggle('studio-rite-rail',mode!=='band');
      ov.classList.toggle('studio-rite-beside',mode==='beside');
      document.body.classList.toggle('studio-rite-beside',mode==='beside');
      if(mode!=='rail') document.body.style.removeProperty('--rite-list-max');
    }catch(e){}

    if(mode!=='band'){
      // A docked Rite covers nothing, so the preview column keeps every
      // pixel of its height — release the reservation the band needed.
      if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
      try{ document.body.style.removeProperty('--rite-band-h'); }catch(e){}
    }else{
      _liftBandClearOfStrip();
    }
  }


  // The Object Strip sits at the very bottom of the editor and is the
  // only DOM affordance a child has for selecting an object on a canvas
  // page — the nudge points at it. The band also wants the bottom of the
  // screen. Both cannot have it, so the band is lifted to sit directly
  // above the Strip, measured live rather than hardcoded.
  // Keeps `--rite-band-h` on <body> in step with the band's real
  // height. The preview column reads it and gives up exactly that much
  // room, so the child's page is never underneath the band. Falls back
  // to a single measurement where ResizeObserver is unavailable, which
  // is still right for the common case (the band's height is set by its
  // two rows, and both are laid out by then).
  function _watchBandHeight(){
    const write=function(){
      try{
        const p=_els&&_els.panel;
        const h=p?Math.round(p.getBoundingClientRect().height):0;
        document.body.style.setProperty('--rite-band-h',(h>0?h:0)+'px');
      }catch(e){}
    };
    if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
    try{
      if(typeof ResizeObserver!=='undefined' && _els && _els.panel){
        _bandRO=new ResizeObserver(write);
        _bandRO.observe(_els.panel);
      }
    }catch(e){}
    requestAnimationFrame(write);
  }

  function _liftBandClearOfStrip(){
    try{
      const strip=document.querySelector('.object-strip');
      let lift=0;
      if(strip){
        const r=strip.getBoundingClientRect();
        // Lift by exactly enough for the band's bottom edge to land on
        // the Strip's top edge. Keyed off where the Strip actually is,
        // not its height — it does not sit flush to the viewport bottom.
        if(r.height>0 && r.bottom>window.innerHeight*0.6){
          lift=Math.max(0,Math.round(window.innerHeight-r.top));
        }
      }
      _els.overlay.style.setProperty('--rite-band-lift',lift+'px');
      // Keep the band out of the right panel entirely. It spans the full
      // width otherwise, dimming the very controls the nudge points at.
      let inset=0;
      try{
        const panel=document.querySelector('.context-zone-personalize')
                 || document.querySelector('.context-panel-root');
        if(panel){
          const pr=panel.getBoundingClientRect();
          if(pr.width>0 && pr.right>window.innerWidth*0.6){
            inset=Math.max(0,Math.round(window.innerWidth-pr.left+8));
          }
        }
      }catch(e){}
      _els.overlay.style.setProperty('--rite-band-inset',inset+'px');
      // The band used to simply float over the editor, and on a short
      // viewport it covered the bottom of the child's own page — 83px
      // of it, measured at 1359x581. Publishing the band's real height
      // onto <body> lets the preview column give up exactly that much,
      // so the page shrinks to fit above the band instead of hiding
      // behind it. No circularity: the band's height is set by its own
      // text, and the column reacting to it never changes that.
      //
      // Measured continuously, not once: the band grows and shrinks as
      // lines accumulate and screens change, and a height read a single
      // time at the start would be wrong for most of the Rite.
      _watchBandHeight();
    }catch(e){}
  }

  // The whole Rite: Act I (Where am I?) - Act II (Who am I?) -
  // Act III (What do I do here?) - Act IV (Why do stories matter?) -
  // Completion. Marks completion only on a genuine full run.
  function run(next){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      next(); return;
    }
    _running=true;
    _actionsUnlocked=false;
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
      try{ document.body.classList.add('studio-rite-running'); }catch(e){}
      _els=_buildStage();

      requestAnimationFrame(function(){ if(_els) _els.overlay.classList.add('studio-rite-in'); });
      window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(regList){
        // The artwork resolves ALONGSIDE the companion packs rather than
        // racing screen 1. It used to land part way through the first
        // screen, and because the grounded layout only applies once the
        // artwork is really there, Lumo jumped the moment it arrived.
        // Joined here it is still parallel — it simply cannot be late.
        return Promise.all([_loadPack(regList,'guardian'),_loadPack(regList,'traveller'),
                            _resolveStageBg()]);
      }).then(function(packs){
        _packs={guardian:packs[0],traveller:packs[1]};
        _stageBg=packs[2];
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
              _plainPaper();
              try{
                if(typeof PageRuntime!=='undefined' && PageRuntime.observe)
                  _paperGuard=PageRuntime.observe(_plainPaper);
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
    actionsUnlocked:actionsUnlocked,
    markComplete:markComplete,
    gate:gate
  };
})();
try{ window.StudioRite=StudioRite; }catch(e){}
