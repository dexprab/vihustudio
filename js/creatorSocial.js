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

  const api={
    inviteNeeded:inviteNeeded,
    username:username,
    openNameDialog:openNameDialog,
    activityLines:activityLines
  };
  try{ window.CreatorSocial=api; }catch(e){}
  return api;
})();
