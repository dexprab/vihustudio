// shareCeremony.js — Share with VihuPlanet.
//
// Finishing a story and sharing a story are two different acts, and
// this file is the second one. A child always finishes; a child always
// keeps every artifact their story produced. Whether that story then
// goes and lives in the Ether is a separate choice, made here.
//
// ---------------------------------------------------------------
// THE QUESTION IS NEVER "IS THIS GOOD ENOUGH"
//
// It is "is this ready to meet another Traveller?" — which is a
// question about the STORY and its journey, never about the child. So
// this is a ceremony, not a validation dialog:
//
//   1. Lumo welcomes the story.
//   2. The story is asked, one question at a time, whether it is ready.
//   3. The child answers. Every answer is a real choice, and "Not yet"
//      is not a failure — it is a story that is still being written.
//   4. If it is ready, the Story Spirit is born and joins the Ether.
//
// There is no checklist, no score, no percentage and no progress bar,
// because all four are ways of saying "here is how much of a story you
// have failed to make." One question fills the screen at a time.
//
// The ONLY thing that can block sharing is technical — a story with no
// pages in it has nothing to send. That is an implementation fact, not
// a judgement, and it is worded as one.
// ---------------------------------------------------------------
//
// Lumo is mentoring the story. Never judging the Creator. Every line
// in SCRIPT below was written against that sentence; if a new line
// would still make sense with "you" swapped for "your story", it is
// probably wrong.

const ShareCeremony=(function(){
  'use strict';

  const ASSETS_BASE='assets/';

  // ---------- the script ----------
  //
  // Four questions, in the order the sprint locks them. Each one is a
  // beat: what Lumo says, and what the child can answer. `yes` moves
  // on; `notYet` ends the ceremony warmly and hands the child back to
  // their story.
  //
  // Question 1 is deliberately NOT asked when the answer is already
  // visible. A story that has a name does not need to be asked whether
  // it has one — Lumo says the name back instead, which is the same
  // beat doing its job without pretending not to know. Only a nameless
  // story is asked, and its answer is a door back to the Studio rather
  // than a yes/no it cannot honestly give.
  const SCRIPT=[
    {id:'welcome',
     lines:['Stories that join VihuPlanet drift there, waiting to be found.',
            'Let us see if yours is ready for the journey.'],
     yes:'Ask my story'},

    {id:'name',
     // Resolved at runtime — see _beatFor().
     dynamic:true},

    {id:'finished',
     lines:['Does your story feel finished to you?'],
     yes:'It is finished',
     notYet:'Not yet',
     notYetLine:'Then it is not finished, and that is the right answer. Go and finish it.'},

    {id:'understood',
     lines:['Another Traveller may find this one day, and I will not be there to explain it.',
            'Would they understand your story?'],
     yes:'They would',
     notYet:'Not yet',
     notYetLine:'Then tell them a little more first. Your story will wait.'},

    {id:'happy',
     lines:['Would you be happy if another Traveller discovered this story?'],
     yes:'I would',
     notYet:'Not yet',
     notYetLine:'Then it stays yours. Nothing is going anywhere you did not send it.'},

    {id:'send',
     lines:['Then let it go, and let it find them.'],
     yes:'🌌 Share with VihuPlanet'}
  ];

  function _beatFor(step, ctx){
    const beat=SCRIPT[step];
    if(!beat || !beat.dynamic) return beat;
    if(beat.id==='name'){
      if(ctx.title){
        return {id:'name',
                lines:['Your story is called “'+ctx.title+'”.',
                       'A story with a name can be found again.'],
                yes:'Go on'};
      }
      return {id:'name',
              lines:['I wonder if your story would like a name before it begins its journey.'],
              yes:null,
              notYet:'Name My Story',
              notYetLine:'Give it a name, and bring it back to me.'};
    }
    return beat;
  }

  // ---------- technical validation ----------
  //
  // The one and only thing allowed to stop a share, and it is not a
  // creative judgement in any form: a story with nothing in it has
  // nothing to send. Worded as the implementation fact it is.
  function _technicalProblem(slides){
    if(!Array.isArray(slides) || slides.length===0){
      return 'This story has no pages in it yet, so there is nothing to send.';
    }
    const real=slides.filter(function(s){ return !!s; });
    if(real.length===0){
      return 'This story has no pages in it yet, so there is nothing to send.';
    }
    return null;
  }

  // ---------- DOM ----------
  let _els=null;
  let _pack=null;
  let _step=0;
  let _ctx=null;
  let _done=null;       // called with {shared:true} or {shared:false}
  let _busy=false;

  function _el(tag,cls,text){
    const d=document.createElement(tag);
    if(cls) d.className=cls;
    if(text) d.textContent=text;
    return d;
  }

  function _fetchJSON(url){
    return fetch(url).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  }

  // Same rule js/studioRite.js, js/companionDirector.js and
  // js/magicCardUI.js already follow: resolve the ROLE from the
  // registry, never a hardcoded companion id, so a registry edit keeps
  // working with no code change here.
  function _loadGuardian(){
    if(_pack) return Promise.resolve(_pack);
    try{
      if(typeof CompanionEngine==='undefined' || !CompanionEngine.loadRegistry){
        return Promise.resolve(null);
      }
      return CompanionEngine.loadRegistry(ASSETS_BASE).then(function(regList){
        const entry=(regList||[]).find(function(e){ return e.role==='guardian'; });
        if(!entry) return null;
        const basePath=ASSETS_BASE+entry.path;
        return _fetchJSON(basePath+'companion.json').then(function(pkg){
          _pack=pkg?{basePath:basePath,pkg:pkg}:null;
          return _pack;
        });
      }).catch(function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  // A declared pose is not a guarantee the file exists — missing art
  // leaves the previous frame up rather than showing a broken image,
  // exactly as CompanionEngine and the Rite already do.
  function _pose(name){
    if(!_els||!_pack||!_pack.pkg||!_pack.pkg.states) return;
    const file=_pack.pkg.states[name]||_pack.pkg.states[_pack.pkg.defaultState];
    if(!file) return;
    const src=_pack.basePath+file;
    if(_els.lumo.getAttribute('src')===src) return;
    _els.lumo.setAttribute('src',src);
  }

  function _build(){
    const overlay=_el('div','share-ceremony');
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Share with VihuPlanet');

    const sky=_el('div','share-ceremony-sky');
    overlay.appendChild(sky);

    const panel=_el('div','share-ceremony-panel');

    const lumoWrap=_el('div','share-ceremony-lumo');
    const lumo=document.createElement('img');
    lumo.className='share-ceremony-lumo-img';
    lumo.alt='';
    lumoWrap.appendChild(lumo);
    panel.appendChild(lumoWrap);

    // ONE question on screen at a time. Lines within a beat stack,
    // because they are one thought; beats replace each other, because
    // a list of everything asked so far is a checklist wearing a
    // disguise.
    const say=_el('div','share-ceremony-say');
    say.setAttribute('aria-live','polite');
    panel.appendChild(say);

    const actions=_el('div','share-ceremony-actions');
    panel.appendChild(actions);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    return {overlay:overlay, panel:panel, lumo:lumo, say:say, actions:actions};
  }

  function _speak(lines){
    _els.say.innerHTML='';
    (lines||[]).forEach(function(text,i){
      const row=_el('p','share-ceremony-line',text);
      row.style.animationDelay=(i*0.42)+'s';
      _els.say.appendChild(row);
    });
  }

  function _button(label,kind,onClick){
    const b=document.createElement('button');
    b.type='button';
    b.className='share-ceremony-btn'+(kind?' is-'+kind:'');
    b.textContent=label;
    b.addEventListener('click',onClick);
    _els.actions.appendChild(b);
    return b;
  }

  // ---------- the beats ----------
  function _render(){
    const beat=_beatFor(_step,_ctx);
    if(!beat){ _share(); return; }

    _pose(beat.id==='send' ? 'celebrate' : (beat.id==='welcome' ? 'wave' : 'curious'));
    _speak(beat.lines);
    _els.actions.innerHTML='';

    if(beat.yes){
      _button(beat.yes,'yes',function(){ _step++; _render(); });
    }
    if(beat.notYet){
      _button(beat.notYet,'notyet',function(){ _notYet(beat); });
    }
  }

  // "Not yet" is a real answer and it is never a failure. Lumo says
  // something true about the story, and the child goes back to it —
  // with every artifact they already have, and the ceremony waiting
  // whenever they want it again.
  function _notYet(beat){
    _pose('talk');
    _speak([beat.notYetLine, 'Your story is still yours. Come back when it is ready.']);
    _els.actions.innerHTML='';
    _button('Back to my story','yes',function(){ _finish(false); });
  }

  function _share(){
    if(_busy) return;
    _busy=true;

    const problem=_technicalProblem(_ctx.slides);
    if(problem){
      _pose('talk');
      _speak([problem]);
      _els.actions.innerHTML='';
      _button('Back to my story','yes',function(){ _finish(false); });
      _busy=false;
      return;
    }

    _pose('celebrate');
    _speak(['Off it goes.']);
    _els.actions.innerHTML='';

    // The moment a Story joins the Ether, and the only place it can
    // happen. `publishedAt` on the Story's own record IS the Ether's
    // definition of membership (CLAUDE.md, Decision 9) — which is
    // exactly why it moved here out of Publish Studio's completion:
    // finishing a story must not put it in front of anybody.
    let ok=false;
    try{
      if(typeof CreatorProjectStore!=='undefined' && _ctx.projectId){
        CreatorProjectStore.markPublished(_ctx.projectId);
        ok=true;
      }
    }catch(e){}

    // "hasEverPublished" records THAT a child has shared, and it is
    // what the Studio Rite's own sharing beat waits on and what opens
    // the Creator Ceremony. Canon 6 is explicit that the Ceremony is
    // the consequence of sharing a story, never a reward for finishing
    // one, so it is set here rather than on finishing.
    try{ if(typeof MagicCard!=='undefined') MagicCard.markEverPublished(); }catch(e){}
    try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('published'); }catch(e){}

    window.setTimeout(function(){ _finish(ok); },900);
  }

  function _finish(shared){
    const cb=_done;
    _done=null;
    _busy=false;
    if(_els){
      _els.overlay.classList.remove('is-in');
      const dead=_els;
      window.setTimeout(function(){
        if(dead.overlay.parentNode) dead.overlay.parentNode.removeChild(dead.overlay);
      },420);
      _els=null;
    }
    try{ if(cb) cb({shared:!!shared, projectId:_ctx?_ctx.projectId:null}); }catch(e){}
  }

  // ---------- entry ----------
  //
  // opts: { slides, title, projectId, onDone }
  //
  // Never throws and never strands a child: if Lumo cannot be reached
  // at all there is no ceremony to perform, so it hands straight back
  // with shared:false rather than showing an empty stage — the same
  // discipline the Rite's own gate() uses.
  function open(opts){
    opts=opts||{};
    if(_els) return;

    _ctx={
      slides:opts.slides||[],
      title:(opts.title||'').trim(),
      projectId:opts.projectId||null
    };
    _done=typeof opts.onDone==='function'?opts.onDone:null;
    _step=0;
    _busy=false;

    _els=_build();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ if(_els) _els.overlay.classList.add('is-in'); });
    });

    _loadGuardian().then(function(pack){
      if(!_els) return;
      if(!pack){
        // No guide, no ceremony. Handing back is honest; a silent
        // share behind the child's back would not be.
        _finish(false);
        return;
      }
      _render();
    });
  }

  function isOpen(){ return !!_els; }

  const api={ open:open, isOpen:isOpen };
  try{ window.ShareCeremony=api; }catch(e){}
  return api;
})();
