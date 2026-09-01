// =============================================================
// VihuPlanet — Show & Gifts (Sprint SOCIAL SKY R1)
// -------------------------------------------------------------
// SHOW — "I made this. I want you to see it."
//
// The flow is CREATION-FIRST, by canon: an existing creation →
// Show → choose a Creator. Never "choose a creator, then make
// something for them" — that older direction is retired. Anything
// the child created can be shown: a story, a garden drawing, a
// kept letter. IF I CREATED IT → I CAN SHOW IT.
//
// A Show:
//   * copies a SNAPSHOT to the platform (creation_show_send), so
//     the gift survives anything that later happens to the
//     original or the relationship — every action is a unit
//   * never publishes anything to the Ether
//   * never transfers ownership
//   * never changes relationship state
//   * is possible toward Creators I have CHOSEN (my own sky);
//     somebody choosing me grants nothing in either direction
//
// GIFTS — every Show becomes a received creative item in the
// recipient's world. 🎁 Gifts on Studio Home is where they live:
// unseen → viewed → (optionally) KEPT. Keep makes a COPY in the
// recipient's own VihuPlanet, at the place corresponding to where
// the original lived — a story into My Projects, a drawing into
// My Garden, a letter into its own slot. The original remains the
// sender's; this is copy, never transfer.
//
// Gifts are creations, not messages: there is no reply box, no
// thread, no chain, and a sender can never ask whether a gift was
// seen or kept.
//
// A TRAVELLER can neither Show nor receive: everything here
// refuses without an active Magic Card, and nothing is faked from
// browser state.
// =============================================================

const CreationShow=(function(){
  'use strict';

  const KEY='vihu.gifts.'; // the recipient's gift list, per card

  function _card(){
    try{
      return (typeof MagicCard!=='undefined'&&MagicCard.getActive)?MagicCard.getActive():null;
    }catch(e){ return null; }
  }
  function _norm(name){
    return (typeof CreatorHandle!=='undefined')
      ? CreatorHandle.normalize(name)
      : String(name||'').trim().replace(/^@+/,'').toLowerCase();
  }
  function _read(cardId){
    try{ return JSON.parse(localStorage.getItem(KEY+cardId)||'[]')||[]; }
    catch(e){ return []; }
  }
  function _write(cardId,list){
    try{ localStorage.setItem(KEY+cardId,JSON.stringify(list)); }catch(e){}
  }
  function _rpc(name,args){
    try{
      if(typeof ThemeRepositoryClient==='undefined') return Promise.resolve(null);
      return ThemeRepositoryClient.isConfigured().then(function(ok){
        if(!ok) return null;
        return ThemeRepositoryClient.getClient().then(function(client){
          return client.rpc(name,args).then(function(res){
            if(res.error) throw res.error;
            return res.data;
          });
        });
      });
    }catch(e){ return Promise.resolve(null); }
  }
  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!=null) e.textContent=text;
    return e;
  }

  // ---------- the carrier ----------
  // THE CORE WORLD RULE: a Creator never crosses their world boundary,
  // and neither does their original creation. ONLY THE COMPANION
  // TRAVELS. A Show is my Companion carrying something I made to
  // another Creator's world so they can see it; a Gift is a Companion
  // arriving with something to reveal; Keep is my own Companion
  // bringing a copy into my world. The helpers below are how every
  // surface in this file says and draws that.
  function _myCompanion(){
    const card=_card();
    return {
      id:(card&&card.companionId)||null,
      name:(card&&card.companionName)||'Your Companion'
    };
  }
  // The sender's Companion on a gift — the platform sends it with the
  // gift row; an older cached row falls back to the sky's own copy of
  // that Creator's Companion (the sender necessarily stands in my sky:
  // they chose me, or we chose each other).
  function _carrierOf(gift){
    if(gift&&gift.companion) return gift.companion;
    try{
      if(typeof SocialSky!=='undefined'&&SocialSky.layers&&gift&&gift.from){
        const l=SocialSky.layers();
        if(l){
          const name=_norm(gift.from);
          const all=[].concat(l.mutual,l.chosen,l.choseMe);
          for(let i=0;i<all.length;i++){
            if(all[i]&&_norm(all[i].username)===name) return all[i].companion||null;
          }
        }
      }
    }catch(e){}
    return null;
  }
  function _companionFig(companionId,cls){
    const fig=_el('span',cls||'creation-gift-carrier-figure');
    if(companionId){
      const img=document.createElement('img');
      img.alt='';
      img.src='assets/'+encodeURIComponent(companionId)+'/idle.png';
      img.addEventListener('error',function(){
        img.remove();
        fig.appendChild(_el('span','creation-gift-carrier-plain','✦'));
      });
      fig.appendChild(img);
    }else{
      fig.appendChild(_el('span','creation-gift-carrier-plain','✦'));
    }
    return fig;
  }

  // ---------- what I can show ----------
  // My own creations, grouped — each item carries the place its copy
  // would belong in a recipient's world, and a lazy payload() so
  // nothing heavy is built until a send actually happens.
  function myShowables(){
    const card=_card();
    if(!card) return {stories:[],drawings:[],letters:[]};
    const out={stories:[],drawings:[],letters:[]};
    try{
      if(typeof CreatorProjectStore!=='undefined'){
        (CreatorProjectStore.list()||[]).forEach(function(r){
          if(!r) return;
          out.stories.push({
            kind:'story', id:r.id, name:r.name||'A story',
            image:r.thumbnail||null,
            place:{store:'projects'},
            payload:function(){
              return {name:r.name||'A story',thumbnail:r.thumbnail||null,data:r.data};
            }
          });
        });
      }
    }catch(e){}
    try{
      if(typeof CreatorLibrary!=='undefined'&&CreatorLibrary.list){
        (CreatorLibrary.list()||[]).forEach(function(r){
          if(!r||!r.png) return;
          out.drawings.push({
            kind:'drawing', id:r.id, name:r.name||'A drawing',
            image:r.thumbnail||r.png,
            place:{store:'garden',room:'drawings'},
            payload:function(){
              return {name:r.name||'A drawing',png:r.png,thumbnail:r.thumbnail||null};
            }
          });
        });
      }
    }catch(e){}
    try{
      if(typeof HandwritingStore!=='undefined'&&HandwritingStore.list){
        (HandwritingStore.list()||[]).forEach(function(r){
          // A letter's ink lives under glyph — {png, w, h} — which is
          // the store's own record shape, read rather than assumed
          // (the first draft read r.png and offered no letters at all;
          // the suite caught it).
          const g=r&&r.glyph;
          if(!r||!g||!g.png||!r.ch) return;
          out.letters.push({
            kind:'letter', id:r.id, name:'My letter '+r.ch,
            image:g.png,
            place:{store:'letters',ch:r.ch},
            payload:function(){
              return {ch:r.ch,png:g.png,w:g.w||null,h:g.h||null};
            }
          });
        });
      }
    }catch(e){}
    return out;
  }

  // The Creators a Show can go to: the ones I chose (my own sky).
  function recipients(){
    try{
      return (typeof CreatorOrbit!=='undefined'&&CreatorOrbit.list)
        ? CreatorOrbit.list() : [];
    }catch(e){ return []; }
  }

  // ---------- sending ----------
  function send(item,username){
    const card=_card();
    const name=_norm(username);
    if(!card) return Promise.resolve({ok:false,reason:'no_card'});
    if(!item||!name) return Promise.resolve({ok:false,reason:'nothing'});
    let payload=null;
    try{ payload=item.payload(); }catch(e){}
    if(!payload) return Promise.resolve({ok:false,reason:'nothing'});
    return _rpc('creation_show_send',{
      p_identity_id:card.id,
      p_username:name,
      p_kind:item.kind,
      p_name:item.name||'',
      p_place:item.place||{},
      p_payload:payload
    }).then(function(out){
      if(out&&out.ok) return {ok:true,id:out.id};
      if(out&&out.ok===false) return out;
      // No platform: a Show needs the other child's world to arrive
      // in, so this is one thing that cannot land locally.
      return {ok:false,reason:'later'};
    }).catch(function(){ return {ok:false,reason:'later'}; });
  }

  // ---------- my gifts ----------
  let _refreshed=false;
  function refresh(){
    const card=_card();
    if(!card) return Promise.resolve(false);
    if(_refreshed) return Promise.resolve(false);
    return _rpc('creation_show_list',{p_identity_id:card.id}).then(function(out){
      if(!out||!out.ok||!Array.isArray(out.gifts)) return false;
      _refreshed=true;
      _write(card.id,out.gifts);
      return true;
    }).catch(function(){ return false; });
  }
  function gifts(){
    const card=_card();
    if(!card) return [];
    return _read(card.id);
  }
  function unseen(){
    return gifts().filter(function(g){ return g&&!g.seen; });
  }
  // For the sky's quiet 🎁 indicator: which senders have something
  // unseen for me. "Aarav has something to show me" — never a feed.
  function unseenBySender(){
    const map={};
    unseen().forEach(function(g){
      if(g&&g.from) map[_norm(g.from)]=true;
    });
    return map;
  }

  function _mark(id,what){
    const card=_card();
    if(!card) return Promise.resolve(false);
    const list=_read(card.id);
    list.forEach(function(g){
      if(g&&g.id===id){
        if(what==='seen'||what==='kept') g.seen=true;
        if(what==='kept') g.kept=true;
      }
    });
    _write(card.id,list);
    return _rpc('creation_show_mark',{p_identity_id:card.id,p_id:id,p_what:what})
      .then(function(){ return true; }).catch(function(){ return true; });
  }

  // ---------- keeping ----------
  // A COPY in the recipient's own world, at the corresponding place.
  // The original is the sender's and is never touched; the copy is an
  // ordinary record of the keeper's own (their card, their stores) —
  // and it is NEVER published: a kept story starts as private as any
  // new project, whatever the original's state was.
  function keep(gift){
    const card=_card();
    if(!card||!gift) return Promise.resolve({ok:false,reason:'nothing'});
    const payload=gift.payload||{};
    const place=gift.place||{};
    if(gift.kind==='story'||place.store==='projects'){
      try{
        if(typeof CreatorProjectStore==='undefined') return Promise.resolve({ok:false,reason:'later'});
        const id=CreatorProjectStore.newId();
        // A fresh record: no publishedAt, no dedication, the keeper's
        // own card — a copy, not the original wearing a new owner.
        CreatorProjectStore.upsert(id,{
          name:payload.name||gift.name||'A story',
          thumbnail:payload.thumbnail||null
        },payload.data);
        return _mark(gift.id,'kept').then(function(){ return {ok:true,where:'projects'}; });
      }catch(e){ return Promise.resolve({ok:false,reason:'later'}); }
    }
    if(gift.kind==='drawing'){
      if(typeof CreatorLibrary==='undefined') return Promise.resolve({ok:false,reason:'later'});
      return CreatorLibrary.save({
        name:payload.name||gift.name||'A drawing',
        png:payload.png,
        thumbnail:payload.thumbnail||null
      }).then(function(res){
        if(!res||!res.ok) return {ok:false,reason:'later'};
        return _mark(gift.id,'kept').then(function(){ return {ok:true,where:'garden'}; });
      });
    }
    if(gift.kind==='letter'){
      if(typeof HandwritingStore==='undefined') return Promise.resolve({ok:false,reason:'later'});
      // A letter's corresponding place is its own slot — and the
      // keeper's own letter is never overwritten by somebody else's.
      const existing=HandwritingStore.get(payload.ch);
      if(existing) return Promise.resolve({ok:false,reason:'have_own'});
      return HandwritingStore.save({
        ch:payload.ch,png:payload.png,w:payload.w||undefined,h:payload.h||undefined
      }).then(function(res){
        if(!res||!res.ok) return {ok:false,reason:'later'};
        return _mark(gift.id,'kept').then(function(){ return {ok:true,where:'letters'}; });
      });
    }
    return Promise.resolve({ok:false,reason:'nothing'});
  }

  // ---------- the Show dialog ----------
  // Opened FROM a creation (My Projects' 🎁 Show) with the item in
  // hand, or from Studio Home with none — then the child picks one of
  // their own creations first. Either way the order is the canon's:
  // the creation exists, then a Creator is chosen for it.
  function openShowDialog(item){
    const card=_card();
    if(!card) return false;
    const who=recipients();

    const overlay=_el('div','creation-show-overlay');
    const panel=_el('div','creation-show-panel');
    overlay.appendChild(panel);
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });
    document.body.appendChild(overlay);

    function renderPick(){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      panel.appendChild(_el('h3','creation-show-title','🎁 Show something you made'));
      const mine=myShowables();
      const any=mine.stories.length+mine.drawings.length+mine.letters.length;
      if(!any){
        panel.appendChild(_el('p','creation-show-note','Nothing here yet — make something first, then show it to somebody.'));
      }
      function group(label,items){
        if(!items.length) return;
        panel.appendChild(_el('p','creation-show-group',label));
        const row=_el('div','creation-show-things');
        items.forEach(function(it){
          const b=_el('button','creation-show-thing');
          b.type='button';
          if(it.image){
            const img=document.createElement('img');
            img.alt=''; img.src=it.image;
            b.appendChild(img);
          }else{
            b.appendChild(_el('span','creation-show-thing-glyph','📖'));
          }
          b.appendChild(_el('span','creation-show-thing-name',it.name));
          b.addEventListener('click',function(){ item=it; renderWho(); });
          row.appendChild(b);
        });
        panel.appendChild(row);
      }
      group('My stories & cards',mine.stories);
      group('From my Garden',mine.drawings);
      group('My letters',mine.letters);
      const back=_el('button','creation-show-quiet','Back');
      back.type='button';
      back.addEventListener('click',done);
      panel.appendChild(back);
    }

    function renderWho(){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      panel.appendChild(_el('h3','creation-show-title','Show it to…'));
      if(item&&item.name) panel.appendChild(_el('p','creation-show-sub',item.name));
      if(!who.length){
        panel.appendChild(_el('p','creation-show-note',
          'Nobody in your sky yet — when you meet a Creator in the Ether whose things you love, choose them first.'));
      }
      const row=_el('div','creation-show-who');
      who.forEach(function(e){
        const b=_el('button','creation-show-who-btn',(e.circle?'✨ ':'')+'@'+e.username);
        b.type='button';
        b.addEventListener('click',function(){
          b.disabled=true;
          send(item,e.username).then(function(res){
            while(panel.firstChild) panel.removeChild(panel.firstChild);
            if(res&&res.ok){
              // The creation has not gone anywhere — it stays in this
              // child's world. What crosses is the Companion.
              const mine=_myCompanion();
              panel.appendChild(_el('h3','creation-show-title','✨ '+mine.name+' is carrying it'));
              const crossing=_el('div','creation-show-crossing');
              crossing.appendChild(_companionFig(mine.id));
              panel.appendChild(crossing);
              panel.appendChild(_el('p','creation-show-note',
                'Across the sky to @'+e.username+'’s world, so they can see what you made. Your creation stays right here with you.'));
            }else{
              panel.appendChild(_el('h3','creation-show-title','Not just now'));
              panel.appendChild(_el('p','creation-show-note',
                res&&res.reason==='not_chosen'
                  ? 'Choose them in the Ether first — then you can show them what you make.'
                  : 'It can’t travel right now. Your creation is safe — try again later.'));
            }
            const back=_el('button','creation-show-quiet','Back');
            back.type='button';
            back.addEventListener('click',done);
            panel.appendChild(back);
          });
        });
        row.appendChild(b);
      });
      panel.appendChild(row);
      const back=_el('button','creation-show-quiet','Back');
      back.type='button';
      back.addEventListener('click',function(){ renderPick(); });
      panel.appendChild(back);
    }

    if(item) renderWho(); else renderPick();
    return true;
  }

  // ---------- 🎁 Gifts ----------
  function _viewGift(panel,gift,rerenderList,onBack){
    while(panel.firstChild) panel.removeChild(panel.firstChild);
    panel.appendChild(_el('h3','creation-show-title',gift.name||'A gift'));
    // The Companion that carried it stands beside what it brought —
    // a Gift is "a Companion came carrying something for me", never
    // a message that arrived.
    const carrier=_el('div','creation-gift-carrier');
    carrier.appendChild(_companionFig(_carrierOf(gift)));
    carrier.appendChild(_el('span','creation-gift-carrier-line',
      '@'+gift.from+'’s Companion carried this across to show you'));
    panel.appendChild(carrier);
    const stage=_el('div','creation-gift-stage');
    panel.appendChild(stage);
    const note=_el('p','creation-show-note','');
    panel.appendChild(note);

    const card=_card();
    _rpc('creation_show_get',{p_identity_id:card?card.id:null,p_id:gift.id}).then(function(out){
      const full=(out&&out.ok&&out.gift)?out.gift:null;
      if(!full){
        note.textContent='It can’t open right now. It will still be here later.';
        return;
      }
      _mark(gift.id,'seen');
      if(typeof rerenderList==='function') rerenderList();
      if(full.companion&&!gift.companion){
        const fig=panel.querySelector('.creation-gift-carrier-figure');
        if(fig&&!fig.querySelector('img')){
          const fresh=_companionFig(full.companion);
          fig.replaceWith(fresh);
        }
      }
      const payload=full.payload||{};
      if(full.kind==='story'){
        // The pages the story can show of itself: baked reading
        // images where the sender's story had them, else its cover.
        const pages=[];
        try{
          ((payload.data&&payload.data.pages)||[]).forEach(function(s){
            if(s&&s.readImage) pages.push(s.readImage);
          });
        }catch(e){}
        if(pages.length){
          let at=0;
          const img=document.createElement('img');
          img.className='creation-gift-page';
          img.alt='';
          img.src=pages[0];
          stage.appendChild(img);
          if(pages.length>1){
            const nav=_el('div','creation-gift-nav');
            const prev=_el('button','creation-gift-arrow','‹');
            const next=_el('button','creation-gift-arrow','›');
            prev.type='button'; next.type='button';
            prev.addEventListener('click',function(){ at=(at+pages.length-1)%pages.length; img.src=pages[at]; });
            next.addEventListener('click',function(){ at=(at+1)%pages.length; img.src=pages[at]; });
            nav.appendChild(prev); nav.appendChild(next);
            stage.appendChild(nav);
          }
        }else if(payload.thumbnail){
          const img=document.createElement('img');
          img.className='creation-gift-page';
          img.alt='';
          img.src=payload.thumbnail;
          stage.appendChild(img);
          note.textContent='A story still being made — here is how it looks so far.';
        }else{
          note.textContent='A story still being made.';
        }
      }else if(payload.png){
        const img=document.createElement('img');
        img.className='creation-gift-page';
        img.alt='';
        img.src=payload.png;
        stage.appendChild(img);
      }

      const btns=_el('div','creation-show-btns');
      if(!full.kept){
        const keepBtn=_el('button','creation-gift-keep','🌟 Keep it');
        keepBtn.type='button';
        keepBtn.addEventListener('click',function(){
          keepBtn.disabled=true;
          keep(full).then(function(res){
            if(res&&res.ok){
              keepBtn.textContent='Kept ✓';
              const mine=_myCompanion();
              note.textContent=full.kind==='story'
                ? mine.name+' carried a copy into My Projects for you.'
                : (full.kind==='letter'
                    ? mine.name+' carried a copy to your letters.'
                    : mine.name+' carried a copy into your garden.');
              if(typeof rerenderList==='function') rerenderList();
            }else if(res&&res.reason==='have_own'){
              keepBtn.disabled=false;
              note.textContent='You already have your own letter '+(payload.ch||'')+' — and it stays yours.';
            }else{
              keepBtn.disabled=false;
              note.textContent='It can’t be kept right now. It will still be here later.';
            }
          });
        });
        btns.appendChild(keepBtn);
      }else{
        btns.appendChild(_el('span','creation-gift-kept','Kept ✓'));
      }
      panel.appendChild(btns);
      if(typeof onBack==='function'){
        const back=_el('button','creation-show-quiet','Back');
        back.type='button';
        back.addEventListener('click',onBack);
        panel.appendChild(back);
      }
    });
  }

  // opts.from — the sky's 🎁 leads straight to that Creator's gift:
  // the newest unseen one from them opens at once, no intermediate
  // screen, with the list one Back away.
  function openGifts(opts){
    const card=_card();
    if(!card) return false;
    const overlay=_el('div','creation-show-overlay');
    const panel=_el('div','creation-show-panel');
    overlay.appendChild(panel);
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });
    document.body.appendChild(overlay);
    const fromWho=(opts&&opts.from)?_norm(opts.from):null;

    function renderList(){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      panel.appendChild(_el('h3','creation-show-title','🎁 Gifts'));
      panel.appendChild(_el('p','creation-show-sub','Companions have carried these here for you.'));
      const list=gifts();
      if(!list.length){
        panel.appendChild(_el('p','creation-show-note','Nothing here yet.'));
      }
      list.forEach(function(g){
        const row=_el('button','creation-gift-row'+(g.seen?'':' is-unseen'));
        row.type='button';
        row.appendChild(_el('span','creation-gift-name',(g.seen?'':'✨ ')+(g.name||'A gift')));
        row.appendChild(_el('span','creation-gift-from','from @'+g.from+(g.kept?' · kept ✓':'')));
        row.addEventListener('click',function(){
          _viewGift(panel,g,function(){ /* status refreshed on next open */ },renderList);
        });
        panel.appendChild(row);
      });
      const showBtn=_el('button','creation-show-quiet','🎁 Show something of mine');
      showBtn.type='button';
      showBtn.addEventListener('click',function(){ done(); openShowDialog(null); });
      panel.appendChild(showBtn);
      const back=_el('button','creation-show-quiet','Back');
      back.type='button';
      back.addEventListener('click',done);
      panel.appendChild(back);
    }

    renderList();
    if(fromWho){
      const theirs=gifts().filter(function(g){
        return g&&_norm(g.from)===fromWho&&!g.seen;
      })[0]||gifts().filter(function(g){ return g&&_norm(g.from)===fromWho; })[0];
      if(theirs) _viewGift(panel,theirs,function(){},renderList);
    }
    refresh().then(function(changed){
      if(changed&&overlay.isConnected&&!fromWho) renderList();
    });
    return true;
  }

  const api={
    myShowables:myShowables,
    recipients:recipients,
    send:send,
    refresh:refresh,
    gifts:gifts,
    unseen:unseen,
    unseenBySender:unseenBySender,
    keep:keep,
    openShowDialog:openShowDialog,
    openGifts:openGifts
  };
  try{ window.CreationShow=api; }catch(e){}
  return api;
})();
