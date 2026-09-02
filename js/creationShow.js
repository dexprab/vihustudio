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
    // THE CHILD'S OWN NAME FOR THEIR COMPANION WINS (a Creator may
    // rename their Companion — CompanionName, Decision 47). Leo called
    // Aslan is spoken of as Aslan everywhere this child can see; the
    // canonical identity stays underneath on the card.
    let given=null;
    try{
      if(typeof CompanionName!=='undefined'&&CompanionName.get) given=CompanionName.get();
    }catch(e){}
    return {
      id:(card&&card.companionId)||null,
      name:given||(card&&card.companionName)||'Your Companion'
    };
  }
  // Speak in the Companion's own voice — the existing voice
  // architecture (js/vihuVoice.js), where silence is a correct answer:
  // no voice configured, no platform, no network all end with the line
  // unspoken and the words still on screen.
  function _speak(companionId,text){
    try{
      if(typeof VihuVoice!=='undefined'&&VihuVoice.speak&&companionId&&text){
        VihuVoice.speak({characterId:companionId,text:text});
      }
    }catch(e){}
  }
  function _reduced(){
    try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }
  // The recipient's Companion, from the sky already loaded — the
  // chooser shows a Creator primarily through their Companion.
  function _companionOf(username){
    try{
      if(typeof SocialSky!=='undefined'&&SocialSky.layers){
        const l=SocialSky.layers();
        if(l){
          const name=_norm(username);
          const all=[].concat(l.mutual||[],l.chosen||[],l.choseMe||[]);
          for(let i=0;i<all.length;i++){
            if(all[i]&&_norm(all[i].username)===name) return all[i].companion||null;
          }
        }
      }
    }catch(e){}
    return null;
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
  // ONE ITEM SHAPE FOR EVERY DOOR. Show is reachable from Studio Home,
  // My Projects, and the Garden's own object actions — and every one
  // of those hands its record HERE, so there is exactly one place that
  // knows what a showable story, drawing or letter looks like. A new
  // creation surface offers Show by calling itemFor + openShowDialog,
  // never by building its own item.
  function itemFor(kind,r){
    if(!r) return null;
    if(kind==='story'){
      return {
        kind:'story', id:r.id, name:r.name||'A story',
        image:r.thumbnail||null,
        place:{store:'projects'},
        payload:function(){
          return {name:r.name||'A story',thumbnail:r.thumbnail||null,data:r.data};
        }
      };
    }
    if(kind==='drawing'){
      if(!r.png) return null;
      return {
        kind:'drawing', id:r.id, name:r.name||'A drawing',
        image:r.thumbnail||r.png,
        place:{store:'garden',room:'drawings'},
        payload:function(){
          return {name:r.name||'A drawing',png:r.png,thumbnail:r.thumbnail||null};
        }
      };
    }
    if(kind==='letter'){
      const g=r.glyph;
      if(!g||!g.png||!r.ch) return null;
      return {
        kind:'letter', id:r.id, name:'My letter '+r.ch,
        image:g.png,
        place:{store:'letters',ch:r.ch},
        payload:function(){
          return {ch:r.ch,png:g.png,w:g.w||null,h:g.h||null};
        }
      };
    }
    return null;
  }
  // May a Show be offered here at all? The same answer for every
  // surface: an active card, and somebody this child has chosen.
  function canShow(){
    return !!_card()&&recipients().length>0;
  }

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
          const it=itemFor('story',r);
          if(it) out.stories.push(it);
        });
      }
    }catch(e){}
    try{
      if(typeof CreatorLibrary!=='undefined'&&CreatorLibrary.list){
        (CreatorLibrary.list()||[]).forEach(function(r){
          const it=itemFor('drawing',r);
          if(it) out.drawings.push(it);
        });
      }
    }catch(e){}
    try{
      if(typeof HandwritingStore!=='undefined'&&HandwritingStore.list){
        // A letter's ink lives under glyph — {png, w, h} — the store's
        // own record shape, read rather than assumed (the first draft
        // read r.png and offered no letters at all; the suite caught
        // it). itemFor is where that knowledge lives now.
        (HandwritingStore.list()||[]).forEach(function(r){
          const it=itemFor('letter',r);
          if(it) out.letters.push(it);
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
  // `note` is the Creator's own optional words, carried VERBATIM —
  // never rewritten, embellished or summarized by anything. The
  // sender's given Companion name travels with the show too, so the
  // Companion can introduce itself in the other world by the name its
  // Creator gave it.
  function send(item,username,note){
    const card=_card();
    const name=_norm(username);
    if(!card) return Promise.resolve({ok:false,reason:'no_card'});
    if(!item||!name) return Promise.resolve({ok:false,reason:'nothing'});
    let payload=null;
    try{ payload=item.payload(); }catch(e){}
    if(!payload) return Promise.resolve({ok:false,reason:'nothing'});
    const base={
      p_identity_id:card.id,
      p_username:name,
      p_kind:item.kind,
      p_name:item.name||'',
      p_place:item.place||{},
      p_payload:payload
    };
    function handle(out){
      if(out&&out.ok) return {ok:true,id:out.id};
      if(out&&out.ok===false) return out;
      // No platform: a Show needs the other child's world to arrive
      // in, so this is one thing that cannot land locally.
      return {ok:false,reason:'later'};
    }
    return _rpc('creation_show_send',Object.assign({},base,{
      p_note:String(note||'').trim().slice(0,200),
      p_companion_name:_myCompanion().name||''
    })).then(handle).catch(function(){
      // Deploy window: a function older than the note has never heard
      // of these two arguments and refuses the whole call — so the
      // show is retried once WITHOUT them, and travels as it always
      // did rather than failing because a deploy is behind.
      return _rpc('creation_show_send',base).then(handle)
        .catch(function(){ return {ok:false,reason:'later'}; });
    });
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
  // opts.to — a preset recipient (the Creator's space says "show THEM
  // something"): the child still picks the creation, and the chooser
  // is skipped because the answer is already given. Eligibility is
  // unchanged — the server still checks the choice live.
  function openShowDialog(item,opts){
    const card=_card();
    if(!card) return false;
    const who=recipients();
    const preset=(opts&&opts.to)?_norm(opts.to):null;

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
          b.addEventListener('click',function(){
            item=it;
            if(preset){
              renderNote({username:preset,
                circle:!!(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.circleWith&&CreatorOrbit.circleWith(preset))});
            }else renderWho();
          });
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
      // R3 — choosing a recipient is choosing someone FROM MY SKY, so
      // the chooser looks like one: a small night field with the
      // Companions standing in it, never a contact list.
      panel.appendChild(_el('h3','creation-show-title','✨ My Sky ✨'));
      panel.appendChild(_el('p','creation-show-sub','Who would you like to show?'));
      if(!who.length){
        panel.appendChild(_el('p','creation-show-note',
          'Nobody in your sky yet — when you meet a Creator in the Ether whose things you love, choose them first.'));
      }
      // A Creator is shown primarily through their COMPANION — the
      // being that will actually meet yours — with the @name beside
      // it. No relationship words anywhere.
      const row=_el('div','creation-show-who show-sky-choose');
      who.forEach(function(e){
        const b=_el('button','creation-show-who-btn');
        b.type='button';
        b.appendChild(_companionFig(_companionOf(e.username),'creation-show-who-fig'));
        b.appendChild(_el('span','creation-show-who-name',(e.circle?'✨ ':'')+'@'+e.username));
        b.addEventListener('click',function(){ renderNote(e); });
        row.appendChild(b);
      });
      panel.appendChild(row);
      const back=_el('button','creation-show-quiet','Back');
      back.type='button';
      back.addEventListener('click',function(){ renderPick(); });
      panel.appendChild(back);
    }

    // The optional note — the Creator's OWN words, carried verbatim.
    // The Companion will say exactly what was typed; nothing rewrites,
    // embellishes or summarizes it.
    function renderNote(e){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      panel.appendChild(_el('h3','creation-show-title','Add a little note'));
      panel.appendChild(_el('p','creation-show-sub','For @'+e.username+' — or leave it empty.'));
      // R3 — the note is something the Creator places BESIDE their
      // creation, so the two share one card: the creation above, the
      // child's words beneath it. Never a chat composer.
      const card2=_el('div','show-note-card');
      if(item&&item.image){
        const img=document.createElement('img');
        img.className='show-note-thumb';
        img.alt=''; img.src=item.image;
        card2.appendChild(img);
      }else{
        card2.appendChild(_el('span','show-note-thumb-glyph','📖'));
      }
      const field=document.createElement('input');
      field.type='text';
      field.className='creation-show-notefield';
      field.maxLength=120;
      field.placeholder='Look what I made!';
      card2.appendChild(field);
      panel.appendChild(card2);
      const btns=_el('div','creation-show-btns');
      const go=_el('button','creation-gift-keep','✨ Show it');
      go.type='button';
      go.addEventListener('click',function(){
        go.disabled=true;
        send(item,e.username,field.value).then(function(res){
          if(res&&res.ok){ _departure(e,item,res.id); }
          else{
            while(panel.firstChild) panel.removeChild(panel.firstChild);
            panel.appendChild(_el('h3','creation-show-title','Not just now'));
            panel.appendChild(_el('p','creation-show-note',
              res&&res.reason==='not_chosen'
                ? 'Choose them in the Ether first — then you can show them what you make.'
                : 'It can’t travel right now. Your creation is safe — try again later.'));
            const back=_el('button','creation-show-quiet','Back');
            back.type='button';
            back.addEventListener('click',done);
            panel.appendChild(back);
          }
        });
      });
      btns.appendChild(go);
      panel.appendChild(btns);
      const back=_el('button','creation-show-quiet','Back');
      back.type='button';
      back.addEventListener('click',function(){ renderWho(); });
      panel.appendChild(back);
    }

    // THE DEPARTURE — the portal is not an animation added to Show, it
    // is how Show works: the Creator stays, the original stays, and
    // ONLY THE COMPANION crosses, carrying what it was given. Portal
    // opens in this world, the Companion walks it, the portal closes —
    // never a spinner, never a transition, never left standing.
    // R3 — the departure is a little SCENE, not a diagram: the
    // creation stands in this world; the Companion walks to it and
    // visibly takes responsibility (a shimmer copy lifts into its
    // arms — the ORIGINAL never moves, which is the world rule drawn
    // rather than asserted); the space itself reacts, starlight
    // gathers, the portal forms and opens, the Companion crosses
    // carrying what it was given, and the portal closes behind it.
    // Only then does the Garden answer.
    function _departure(e,it,showId){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      const mine=_myCompanion();
      panel.appendChild(_el('h3','creation-show-title','✨ '+mine.name+' is taking it'));
      const stage=_el('div','show-journey-stage show-journey-depart');
      // THE ORIGINAL — in this world from first frame to last.
      const original=_el('div','show-journey-original');
      if(it&&it.image){
        const img=document.createElement('img');
        img.alt=''; img.src=it.image;
        original.appendChild(img);
      }else{
        original.appendChild(_el('span','show-journey-held-glyph','📖'));
      }
      // Gathering starlight — the space noticing what is about to
      // happen. Decorative only.
      const sparks=_el('div','show-journey-sparks');
      sparks.setAttribute('aria-hidden','true');
      for(let i=0;i<5;i++) sparks.appendChild(_el('span','show-journey-spark','✦'));
      const portal=_el('div','show-portal');
      // The traveller: the Companion, and — once it has picked it up —
      // the carried shimmer of the creation, one figure from then on.
      const trav=_el('div','show-journey-traveller');
      trav.appendChild(_companionFig(mine.id,'show-journey-companion'));
      const carried=_el('div','show-journey-carried');
      if(it&&it.image){
        const img=document.createElement('img');
        img.alt=''; img.src=it.image;
        carried.appendChild(img);
      }else{
        carried.appendChild(_el('span','show-journey-held-glyph','📖'));
      }
      trav.appendChild(carried);
      stage.appendChild(original);
      stage.appendChild(sparks);
      stage.appendChild(portal);
      stage.appendChild(trav);
      panel.appendChild(stage);
      const line=_el('p','show-journey-line','');
      panel.appendChild(line);

      function settle(){
        stage.classList.add('is-after');
        line.textContent='Your creation stays right here with you.';
        // EVERY SUCCESSFUL SHOW GROWS THE SENDER'S GARDEN — after the
        // portal closes, so the causality reads "I shared something I
        // made → my Garden became more alive". One event, a capture
        // id, deliberately no type (Decision 27): the Garden learns
        // nothing about shows, and the recent-ids guard makes one
        // show one growth. Never dependent on the recipient doing
        // anything at all.
        try{
          document.dispatchEvent(new CustomEvent('vihu:creation-captured',
            {detail:{id:'show:'+(showId||('local-'+Date.now()))}}));
        }catch(e2){}
        const ok=_el('button','creation-show-quiet','Done');
        ok.type='button';
        ok.addEventListener('click',done);
        panel.appendChild(ok);
      }
      if(_reduced()){
        // No portal theatre under reduced motion — the words carry the
        // same truth, and the garden still grows.
        line.textContent=mine.name+' is taking this to @'+e.username+'.';
        _speak(mine.id,'I’m taking this to '+e.username+'.');
        settle();
        return;
      }
      // The scene, beat by beat.
      requestAnimationFrame(function(){ stage.classList.add('is-approach'); });
      setTimeout(function(){
        // The pickup: the shimmer copy lifts into the Companion's
        // arms; the original dims a breath while its light is away.
        stage.classList.add('is-picked');
        line.textContent=mine.name+' is taking this to @'+e.username+'.';
        // Spoken first person, in the Companion's own voice — no
        // introduction on this side: the child already knows their
        // own Companion.
        _speak(mine.id,'I’m taking this to '+e.username+'.');
      },1300);
      setTimeout(function(){ stage.classList.add('is-reacting'); },2600);
      setTimeout(function(){ portal.classList.add('is-forming'); },3300);
      setTimeout(function(){ portal.classList.add('is-open'); },3900);
      setTimeout(function(){ stage.classList.add('is-crossing'); },4700);
      setTimeout(function(){
        portal.classList.remove('is-open');
        portal.classList.add('is-closed');
        stage.classList.remove('is-reacting');
      },6300);
      setTimeout(settle,7000);
    }

    if(item&&preset){
      renderNote({username:preset,
        circle:!!(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.circleWith&&CreatorOrbit.circleWith(preset))});
    }
    else if(item) renderWho();
    else renderPick();
    return true;
  }

  // ---------- 🎁 Gifts ----------
  // THE ARRIVAL — the other half of the portal. In the recipient's
  // world a portal opens, the sender's Companion steps out of it
  // carrying what it was given, INTRODUCES itself (this child may
  // never have met it — by the name its own Creator gave it, when one
  // travelled), reveals the creation, says the Creator's note in the
  // Creator's exact words, and the portal closes behind it. The full
  // arrival plays for a gift's FIRST viewing; a gift already seen
  // opens straight to what it brought — a re-run journey every time
  // would turn the payoff into a toll.
  function _viewGift(panel,gift,rerenderList,onBack){
    while(panel.firstChild) panel.removeChild(panel.firstChild);
    const wasUnseen=!gift.seen;
    panel.appendChild(_el('h3','creation-show-title',gift.name||'A gift'));
    const stageWrap=_el('div','show-journey-stage show-journey-arrival');
    const sparksA=_el('div','show-journey-sparks');
    sparksA.setAttribute('aria-hidden','true');
    for(let i=0;i<5;i++) sparksA.appendChild(_el('span','show-journey-spark','✦'));
    const portal=_el('div','show-portal');
    const trav=_el('div','show-journey-traveller');
    stageWrap.appendChild(sparksA);
    stageWrap.appendChild(portal);
    stageWrap.appendChild(trav);
    panel.appendChild(stageWrap);
    const line=_el('p','show-journey-line','');
    panel.appendChild(line);
    const stage=_el('div','creation-gift-stage');
    panel.appendChild(stage);
    const note=_el('p','creation-show-note','');
    panel.appendChild(note);

    const card=_card();
    _rpc('creation_show_get',{p_identity_id:card?card.id:null,p_id:gift.id}).then(function(out){
      const full=(out&&out.ok&&out.gift)?out.gift:null;
      if(!full){
        note.textContent='It can’t open right now. It will still be here later.';
        if(typeof onBack==='function'){
          const back=_el('button','creation-show-quiet','Back');
          back.type='button';
          back.addEventListener('click',onBack);
          panel.appendChild(back);
        }
        return;
      }
      _mark(gift.id,'seen');
      if(typeof rerenderList==='function') rerenderList();

      const carrierId=full.companion||_carrierOf(gift);
      trav.appendChild(_companionFig(carrierId,'show-journey-companion'));
      // What it carried, still wrapped in its own light — the reveal
      // is the payoff and comes AFTER the introduction, never before.
      const payloadPeek=(full.payload&&(full.payload.png||full.payload.thumbnail))||null;
      const bundle=_el('div','show-journey-carried is-veiled');
      if(payloadPeek){
        const img=document.createElement('img');
        img.alt=''; img.src=payloadPeek;
        bundle.appendChild(img);
      }else{
        bundle.appendChild(_el('span','show-journey-held-glyph','✨'));
      }
      trav.appendChild(bundle);
      const from=gift.from||full.from||'';
      const given=String(full.companionName||'').trim();
      const introShown='Hi! I’m '+(given?given+', ':'')+'@'+from+'’s Companion. @'+from+' wanted me to show you something.';
      const introSpoken='Hi! I’m '+(given?given+', ':'')+from+'’s Companion. '+from+' wanted me to show you something.';
      function sayNote(spoken){
        if(!full.note) return;
        // The Creator's ACTUAL words, verbatim — quoted, never
        // rewritten, never paraphrased.
        note.textContent='@'+from+' says: “'+full.note+'”';
        if(spoken) _speak(carrierId,from+' says: '+full.note);
      }
      const payload=full.payload||{};
      function buildContent(){
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
          if(!full.note) note.textContent='A story still being made — here is how it looks so far.';
        }else{
          if(!full.note) note.textContent='A story still being made.';
        }
      }else if(payload.png){
        const img=document.createElement('img');
        img.className='creation-gift-page';
        img.alt='';
        img.src=payload.png;
        stage.appendChild(img);
      }

      }

      function buildActions(){
      const btns=_el('div','creation-show-btns show-breathe');
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
        const back=_el('button','creation-show-quiet show-breathe','Back');
        back.type='button';
        back.addEventListener('click',onBack);
        panel.appendChild(back);
      }
      }

      // The arrival plays once — for the gift's first viewing, with
      // motion allowed. A gift already seen (or reduced motion) opens
      // straight to what the Companion brought, with the carrier
      // standing quietly beside it and the note still in the
      // Creator's exact words — just not re-performed every time.
      if(!wasUnseen||_reduced()){
        stageWrap.classList.add('is-still');
        line.textContent=(given||('@'+from+'’s Companion'))+' carried this across to show you';
        buildContent();
        buildActions();
        stage.classList.add('is-revealed');
        panel.classList.add('is-settled');
        sayNote(false);
        return;
      }
      // First viewing: the world notices, a doorway forms, somebody
      // steps out of it, settles, says who they are — and only then
      // is the creation revealed, the note said, the portal closed,
      // and the quiet actions allowed to appear. Let it breathe.
      requestAnimationFrame(function(){ stageWrap.classList.add('is-reacting'); });
      setTimeout(function(){ portal.classList.add('is-forming'); },500);
      setTimeout(function(){ portal.classList.add('is-open'); },1100);
      setTimeout(function(){ stageWrap.classList.add('is-arrived'); },1700);
      setTimeout(function(){ line.textContent=introShown; _speak(carrierId,introSpoken); },2800);
      setTimeout(function(){
        trav.classList.add('is-revealing');
        buildContent();
        stage.classList.add('is-revealed');
      },5300);
      setTimeout(function(){ sayNote(true); },6200);
      setTimeout(function(){
        portal.classList.remove('is-open');
        portal.classList.add('is-closed');
        stageWrap.classList.remove('is-reacting');
      },7400);
      setTimeout(function(){ buildActions(); panel.classList.add('is-settled'); },8100);
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
    itemFor:itemFor,
    canShow:canShow,
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
