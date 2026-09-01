// =============================================================
// VihuStudio — Creator Social (Sprint SOCIAL 1)
// -------------------------------------------------------------
// The Studio side of Creator identity: choosing a public
// VihuPlanet name, and the quiet line that tells a Creator what
// is happening to the things they made.
//
// CREATION-FIRST, NOT PEOPLE-FIRST. The name exists so somebody
// who loved a story can find the maker's OTHER stories — so the
// invitation to choose one appears only once there is something
// public to find (a card in hand, at least one shared story, no
// name yet), and it is a card on a shelf, never a prompt: no
// decline, no dismiss, absent rather than empty (the door's own
// discipline, Decision 22).
//
// THE ACTIVITY LINE IS DERIVED, NEVER LOGGED. There is no event
// store and no notification system: the platform already keeps
// each story's cheer count (Decision 20 — the count IS the rows),
// and this module compares today's counts with the counts this
// card last saw. New starlight → one line: "✨ Your Moon Dragon
// is getting cheers!" Never a number (Decision 20's own rule),
// never who cheered (story_cheers keeps no social graph to ask),
// never a ranking. The child should feel "people are enjoying
// what I made" — nothing else.
// =============================================================

const CreatorSocial=(function(){
  'use strict';

  const SEEN_KEY='vihu.cheerSeen.';

  function _card(){
    try{
      return (typeof MagicCard!=='undefined'&&MagicCard.getActive)?MagicCard.getActive():null;
    }catch(e){ return null; }
  }

  function _ownShared(){
    try{
      if(typeof CreatorProjectStore==='undefined') return [];
      const card=_card();
      if(!card) return [];
      return (CreatorProjectStore.listAll()||[]).filter(function(r){
        return r && r.publishedAt && r.cardId===card.id;
      });
    }catch(e){ return []; }
  }

  // ---------- the invitation ----------
  function inviteNeeded(){
    const card=_card();
    if(!card||card.username) return false;
    return _ownShared().length>0;
  }

  function username(){
    const card=_card();
    return (card&&card.username)||null;
  }

  // ---------- the dialog ----------
  // One question, in the child's words. Wrong answers are kind and
  // name what to do next; nothing is ever generated for them — the
  // child chooses (never moonmaker8472).
  function openNameDialog(onDone){
    const overlay=document.createElement('div');
    overlay.className='creator-name-overlay';
    const panel=document.createElement('div');
    panel.className='creator-name-panel';

    const h=document.createElement('h3');
    h.textContent='Choose your VihuPlanet name';
    const p=document.createElement('p');
    p.className='creator-name-line';
    p.textContent='This is the name people can use to find the things you make.';

    const row=document.createElement('div');
    row.className='creator-name-row';
    const at=document.createElement('span');
    at.className='creator-name-at';
    at.textContent='@';
    const input=document.createElement('input');
    input.className='creator-name-input';
    input.type='text';
    input.maxLength=24;
    input.placeholder='moonmaker';
    input.autocomplete='off';
    input.spellcheck=false;
    row.appendChild(at); row.appendChild(input);

    const note=document.createElement('p');
    note.className='creator-name-note';

    const btns=document.createElement('div');
    btns.className='creator-name-btns';
    const go=document.createElement('button');
    go.type='button';
    go.className='creator-name-go';
    go.textContent='That’s my name ✨';
    const close=document.createElement('button');
    close.type='button';
    close.className='creator-name-quiet';
    close.textContent='Not now';
    btns.appendChild(go); btns.appendChild(close);

    panel.appendChild(h); panel.appendChild(p); panel.appendChild(row);
    panel.appendChild(note); panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    input.focus();

    function done(name){
      try{ overlay.remove(); }catch(e){}
      if(typeof onDone==='function') onDone(name||null);
    }
    close.addEventListener('click',function(){ done(null); });

    function say(text){ note.textContent=text; }

    go.addEventListener('click',function(){
      const raw=input.value;
      const checked=(typeof CreatorHandle!=='undefined')?CreatorHandle.validate(raw):{ok:true,username:raw};
      if(!checked.ok){
        say(checked.reason==='reserved'
          ? 'That name belongs to VihuPlanet. Try another one.'
          : 'Names use 3 to 20 letters, numbers or _ — no spaces.');
        return;
      }
      go.disabled=true;
      say('✨ Asking the stars…');
      MagicCard.claimUsername(checked.username).then(function(res){
        if(res&&res.ok){
          say('You are @'+res.username+' ✨');
          // The sweep stamps the new name onto already-shared
          // stories on the next store read; ask for one now so it
          // happens while the child is still here.
          try{ CreatorProjectStore.list(); }catch(e){}
          window.setTimeout(function(){ done(res.username); },900);
          return;
        }
        go.disabled=false;
        const reason=res&&res.reason;
        if(reason==='taken'){
          say('That name is already being used. Try another one.');
        }else if(reason==='reserved'){
          say('That name belongs to VihuPlanet. Try another one.');
        }else if(reason==='invalid'){
          say('Names use 3 to 20 letters, numbers or _ — no spaces.');
        }else if(reason==='already_named'&&res.username){
          say('You already have a name — you are @'+res.username+' ✨');
          window.setTimeout(function(){ done(res.username); },1200);
        }else{
          say('Names can’t be chosen just now. Your stories are safe — try again later.');
        }
      });
    });
  }

  // ---------- the activity line ----------
  function _seenKey(cardId){ return SEEN_KEY+cardId; }
  function _readSeen(cardId){
    try{ return JSON.parse(localStorage.getItem(_seenKey(cardId))||'{}')||{}; }
    catch(e){ return {}; }
  }
  function _writeSeen(cardId,map){
    try{ localStorage.setItem(_seenKey(cardId),JSON.stringify(map)); }catch(e){}
  }

  // Resolves { lines:[string], markSeen() }. Lines exist only where a
  // story's count has RISEN since this card last looked — new
  // starlight, said once. markSeen() is called by the surface that
  // actually SHOWED the line, so an unseen line is not spent.
  function activityLines(){
    const card=_card();
    if(!card) return Promise.resolve({lines:[],markSeen:function(){}});
    const own=_ownShared();
    if(!own.length) return Promise.resolve({lines:[],markSeen:function(){}});
    const ids=own.map(function(r){ return r.id; });

    const refreshed=(typeof Cheer!=='undefined'&&Cheer.refresh)
      ? Cheer.refresh(ids).catch(function(){})
      : Promise.resolve();

    return Promise.resolve(refreshed).then(function(){
      const seen=_readSeen(card.id);
      const lines=[];
      const next={};
      own.forEach(function(r){
        let n=0;
        try{ n=(typeof Cheer!=='undefined'&&Cheer.count)?(Cheer.count(r.id)||0):0; }catch(e){}
        next[r.id]=n;
        const before=Number(seen[r.id]||0);
        if(n>before){
          lines.push('✨ Your '+(r.name||'story')+' is getting cheers!');
        }
      });
      return {
        lines:lines,
        markSeen:function(){ _writeSeen(card.id,next); }
      };
    });
  }

  // ---------- 🌌 My Orbit · ✨ My Circle (SOCIAL 2.1) ----------
  // Studio Home is where a child SEES and MANAGES their social world
  // (the Ether is where they act in context). One overlay, two areas:
  // Orbit as a creation-oriented list — @name and what they MAKE,
  // never follower-style statistics — and Circle above it, more
  // intimate: chips, because "these are my creative connections" is
  // not another giant list. Circle stays DERIVED (two orbits facing
  // each other); nothing here creates a second relationship record.
  // Entries lead to the Creator's public shelf in the Ether through
  // the existing ?creator= door. Leave is quiet; nobody is told.
  function openSocialPanel(){
    const card=(typeof MagicCard!=='undefined'&&MagicCard.getActive)?MagicCard.getActive():null;
    if(!card||typeof CreatorOrbit==='undefined') return false;

    // SOCIAL SKY R1 — the child's social world is a SKY now, not a
    // list: Creators appear through their Companions, in three
    // distinguishable layers, with the new-star and mutual glows.
    // This function stays the one seam every door calls (the Studio
    // Home row, the Ether's doorway note), so the presentation could
    // change without a caller changing; the list below survives only
    // as the fallback for a surface that did not load the Sky.
    if(typeof SocialSky!=='undefined'&&SocialSky.open){
      return SocialSky.open();
    }

    const overlay=document.createElement('div');
    overlay.className='creator-social-overlay';
    const panel=document.createElement('div');
    panel.className='creator-social-panel';
    overlay.appendChild(panel);

    function el(tag,cls,text){
      const e=document.createElement(tag);
      if(cls) e.className=cls;
      if(text!=null) e.textContent=text;
      return e;
    }
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });

    function render(creations){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      const orbit=CreatorOrbit.list();
      const circle=orbit.filter(function(e){ return e.circle; });
      const plain=orbit.filter(function(e){ return !e.circle; });

      function worksOf(name){
        return creations.filter(function(s){
          return s&&s.creatorUsername&&String(s.creatorUsername).toLowerCase()===name;
        }).map(function(s){ return s.title||s.name||'A story'; }).slice(0,3);
      }
      function shelfLink(name){
        // The Creator's public shelf lives in the Ether; leaving the
        // Studio always lands on VihuPlanet (Decision 23), and the
        // existing ?creator= intent opens the shelf once the child is
        // looking.
        window.location.href='index.html?creator='+encodeURIComponent(name);
      }

      if(circle.length){
        panel.appendChild(el('h3','creator-social-head','✨ My Circle'));
        panel.appendChild(el('p','creator-social-sub','Creators who choose you too.'));
        const chips=el('div','creator-social-circle');
        circle.forEach(function(e){
          const chip=el('button','creator-social-circle-chip');
          chip.type='button';
          chip.appendChild(el('span','creator-social-circle-name','@'+e.username));
          const first=worksOf(e.username)[0];
          if(first) chip.appendChild(el('span','creator-social-circle-work',first));
          chip.addEventListener('click',function(){ shelfLink(e.username); });
          chips.appendChild(chip);
        });
        panel.appendChild(chips);
      }

      panel.appendChild(el('h3','creator-social-head','🌌 My Orbit'));
      panel.appendChild(el('p','creator-social-sub','Creators you choose to see.'));
      if(!orbit.length){
        panel.appendChild(el('p','creator-social-note',
          'Nobody yet — when you meet a Creator in the Ether whose things you love, add them to your Orbit.'));
      }
      orbit.forEach(function(e){
        const row=el('div','creator-social-row');
        const main=el('button','creator-social-who');
        main.type='button';
        main.appendChild(el('span','creator-social-name',(e.circle?'✨ ':'')+'@'+e.username));
        const works=worksOf(e.username);
        if(works.length) main.appendChild(el('span','creator-social-works',works.join(' · ')));
        main.addEventListener('click',function(){ shelfLink(e.username); });
        row.appendChild(main);
        const leave=el('button','creator-social-leave','Leave My Orbit');
        leave.type='button';
        leave.addEventListener('click',function(){
          CreatorOrbit.remove(e.username).then(function(){ render(creations); });
          render(creations);
        });
        row.appendChild(leave);
        panel.appendChild(row);
      });

      const back=el('button','creator-social-quiet','Back');
      back.type='button';
      back.addEventListener('click',done);
      panel.appendChild(back);
    }

    render([]);
    document.body.appendChild(overlay);
    // The platform's copy first (mutuality is only ever its to say),
    // then what everybody makes — both quiet, both bounded upstream.
    CreatorOrbit.refresh().then(function(){
      return CreatorOrbit.publicCreations();
    }).then(function(creations){
      if(overlay.isConnected) render(creations||[]);
    }).catch(function(){});
    return true;
  }

  const api={
    inviteNeeded:inviteNeeded,
    username:username,
    openNameDialog:openNameDialog,
    activityLines:activityLines,
    openSocialPanel:openSocialPanel
  };
  try{ window.CreatorSocial=api; }catch(e){}
  return api;
})();
