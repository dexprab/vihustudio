// =============================================================
// VihuPlanet — the Social Sky (Sprint SOCIAL SKY R1)
// -------------------------------------------------------------
// The child's visual representation of their social world. Not
// followers, not following, not a contact list: a sky, at home
// (Studio Home), populated by Creators through their COMPANIONS.
//
// THREE RELATIONSHIP STATES, exactly, and the sky is how a child
// meets them without ever meeting the words for them:
//   * we chose each other — nearest, brightest (strongest)
//   * I chose them        — the middle of the sky (medium)
//   * they chose me       — further, fainter (weakest)
//
// WHO CHOSE ME IS OWNER-ONLY. The platform's creator_sky_list is
// verified against the caller's own card (the amendment Decision 56
// records): a new star appears in MY sky when somebody chooses me,
// its identity is discoverable HERE, and nowhere else — no count,
// no public list, and the other Creator is never told what I know.
//
// GLOWS ARE TEMPORARY. A new star glows until the child has had an
// opportunity to see it (the sky was opened); a new mutual pair
// glows its own distinct way, once. What settles is the glow — the
// star stays. No permanent badge, no number, no pressure.
//
// GRAVITY LIVES HERE TOO — the data half. tierOf() answers which
// relationship layer a creation's maker is in, and experienced()
// remembers which stories this card has already stepped into (the
// portal stamps it). js/etherFeed.js reads both to decide what
// naturally comes forward; nothing here is a score and nothing here
// is ever shown as one.
//
// A TRAVELLER HAS NO SKY. Every read refuses without an active
// Magic Card, and nothing is faked from browser state — no card,
// no layer, absent rather than empty (Decision 55's rule).
// =============================================================

const SocialSky=(function(){
  'use strict';

  const KEY='vihu.sky.';          // platform copy of the sky, per card
  const SEEN_KEY='vihu.skySeen.'; // which stars/mutuals were seen, per card
  const EXP_KEY='vihu.etherSeen.';// which stories were experienced, per card

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
  function _read(key,cardId){
    try{ return JSON.parse(localStorage.getItem(key+cardId)||'{}')||{}; }
    catch(e){ return {}; }
  }
  function _write(key,cardId,map){
    try{ localStorage.setItem(key+cardId,JSON.stringify(map)); }catch(e){}
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

  // ---------- the platform's copy, once per load ----------
  let _refreshed=false;
  function refresh(){
    const card=_card();
    if(!card) return Promise.resolve(false);
    if(_refreshed) return Promise.resolve(false);
    return _rpc('creator_sky_list',{p_identity_id:card.id}).then(function(out){
      if(!out||!out.ok) return false;
      _refreshed=true;
      _write(KEY,card.id,{
        sky:Array.isArray(out.sky)?out.sky:[],
        choseMe:Array.isArray(out.choseMe)?out.choseMe:[]
      });
      return true;
    }).catch(function(){ return false; });
  }

  // ---------- the three layers, derived ----------
  // The platform's copy when it has been heard; the local orbit as
  // the fallback (it knows nothing about incoming stars or
  // companions, which is honest — those are only ever the
  // platform's to say).
  function layers(){
    const card=_card();
    if(!card) return null;
    const cached=_read(KEY,card.id);
    let sky=Array.isArray(cached.sky)?cached.sky:null;
    const choseMe=Array.isArray(cached.choseMe)?cached.choseMe:[];
    if(!sky){
      sky=(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.list)
        ? CreatorOrbit.list().map(function(e){
            return {username:e.username,companion:null,circle:!!e.circle};
          })
        : [];
    }
    const mutual=[],chosen=[];
    sky.forEach(function(e){
      if(!e||!e.username) return;
      (e.circle?mutual:chosen).push(e);
    });
    return { mutual:mutual, chosen:chosen, choseMe:choseMe };
  }

  // ---------- what is NEW, and marking it seen ----------
  function _unseen(){
    const card=_card();
    if(!card) return {stars:[],mutuals:[]};
    const l=layers();
    if(!l) return {stars:[],mutuals:[]};
    const seen=_read(SEEN_KEY,card.id);
    return {
      stars:l.choseMe.filter(function(e){ return !seen['star:'+_norm(e.username)]; }),
      mutuals:l.mutual.filter(function(e){ return !seen['mutual:'+_norm(e.username)]; })
    };
  }
  function markSeen(){
    const card=_card();
    if(!card) return;
    const l=layers();
    if(!l) return;
    const seen=_read(SEEN_KEY,card.id);
    l.choseMe.forEach(function(e){ seen['star:'+_norm(e.username)]='1'; });
    l.mutual.forEach(function(e){ seen['mutual:'+_norm(e.username)]='1'; });
    _write(SEEN_KEY,card.id,seen);
  }

  // R3.2 — THE SKY ANSWERS A CHOICE IMMEDIATELY. CreatorOrbit.add()
  // lands in the ORBIT store, but layers() prefers the platform's
  // CACHED copy of the sky (KEY) — which only a round trip rewrites,
  // and refresh() runs once per load. So a Creator chosen from their
  // own space stayed missing from the field until the next page load
  // ("until refreshed"). The local echo is the orbit's own local-first
  // discipline: the tap lands NOW, and the platform's copy replaces
  // the guess when it is next heard (_refreshed is cleared so it will
  // be). Mutuality is still only ever the platform's to say — except
  // where its own cached copy already says they chose me, in which
  // case my choice visibly completes the circle right here.
  function noteChoice(username,companion,chosen){
    const card=_card();
    const name=_norm(username);
    if(!card||!name) return;
    const cached=_read(KEY,card.id);
    if(Array.isArray(cached.sky)){
      const kept=cached.sky.filter(function(e){
        return e&&e.username&&_norm(e.username)!==name;
      });
      if(chosen){
        const cm=(Array.isArray(cached.choseMe)?cached.choseMe:[]).find(function(e){
          return e&&_norm(e.username)===name;
        });
        kept.push({
          username:name,
          companion:companion||(cm&&cm.companion)||null,
          circle:!!cm
        });
      }
      cached.sky=kept;
      _write(KEY,card.id,cached);
    }
    _refreshed=false;
  }

  // Creative events for Studio Home — never a follower notification,
  // never a name in the new-star line (the identity is discovered in
  // the sky, not announced at the door), never a count.
  function eventLines(){
    const u=_unseen();
    const lines=[];
    if(u.stars.length) lines.push('✨ New stars are interested in your creations');
    u.mutuals.forEach(function(e){
      lines.push('✨ You and @'+e.username+' found each other');
    });
    return lines;
  }

  // ---------- gravity: the data the Ether reads ----------
  // 1 = we chose each other · 2 = I chose them · 3 = they chose me ·
  // 0 = everyone else (normal shared-world discovery). Synchronous,
  // from the caches above — the feed must never wait on a network to
  // seed a universe.
  function tierOf(username){
    const name=_norm(username);
    if(!name) return 0;
    const l=layers();
    if(!l) return 0;
    function hit(list){
      return list.some(function(e){ return _norm(e.username)===name; });
    }
    if(hit(l.mutual)) return 1;
    if(hit(l.chosen)) return 2;
    if(hit(l.choseMe)) return 3;
    return 0;
  }

  // A story this card has already stepped into (the portal opened).
  // Experienced creations stop coming forward — the system moves the
  // child toward new things. Never shown, never a score.
  function experienced(projectId){
    const card=_card();
    if(!card||!projectId) return false;
    return !!_read(EXP_KEY,card.id)[projectId];
  }
  function markExperienced(projectId){
    const card=_card();
    if(!card||!projectId) return;
    const map=_read(EXP_KEY,card.id);
    if(map[projectId]) return;
    map[projectId]=new Date().toISOString();
    _write(EXP_KEY,card.id,map);
  }

  // ---------- mutual visibility ----------
  // The one R1 capability beyond mutuality itself: a mutual Creator
  // can see the other's work that has NOT been pushed to Ether. The
  // platform checks BOTH directions live at call time — ending the
  // mutuality ends this, while anything already Shown or Kept stays
  // (the historical rule). A non-mutual Creator, an unknown name and
  // a Traveller all resolve to an empty list here.
  function mutualProjects(username){
    const card=_card();
    const name=_norm(username);
    if(!card||!name) return Promise.resolve([]);
    return _rpc('creator_mutual_projects',{p_identity_id:card.id,p_username:name})
      .then(function(out){
        if(!out||!out.ok||!Array.isArray(out.projects)) return [];
        return out.projects.filter(Boolean);
      }).catch(function(){ return []; });
  }

  // ---------- the sky itself ----------
  let _openCreator=null;
  function configure(opts){
    if(opts&&typeof opts.openCreator==='function') _openCreator=opts.openCreator;
  }
  function _goCreator(name){
    if(_openCreator){ _openCreator(name); return; }
    // The Creator's shelf lives in the Ether; leaving the Studio
    // always lands on VihuPlanet (Decision 23) and the existing
    // ?creator= intent opens the shelf once the child is looking.
    window.location.href='index.html?creator='+encodeURIComponent(name);
  }

  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!=null) e.textContent=text;
    return e;
  }

  // A small stable jitter per name so the sky reads as a sky rather
  // than a grid — the same star sits in the same place every time.
  function _jitter(name,span){
    let h=0;
    for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
    return (h%1000)/1000*span-span/2;
  }

  // A companion figure — the primary visual identity everywhere in the
  // sky. The name is a small, dim, contextual label underneath, never
  // the thing the eye reads first.
  function _figure(companionId){
    const fig=_el('span','social-sky-figure');
    if(companionId){
      const img=document.createElement('img');
      img.className='social-sky-companion';
      img.alt='';
      img.src='assets/'+encodeURIComponent(companionId)+'/idle.png';
      img.addEventListener('error',function(){
        img.remove();
        fig.appendChild(_el('span','social-sky-plain','✦'));
      });
      fig.appendChild(img);
    }else{
      fig.appendChild(_el('span','social-sky-plain','✦'));
    }
    return fig;
  }

  // One star in the spatial sky. A role=button div rather than a
  // <button>, because the 🎁 indicator inside it is its own real
  // control (a button may not legally contain one) — the same pattern
  // My Projects' cards already use for their nested actions.
  function _star(entry,opts){
    const b=_el('div','social-sky-star '+opts.cls+(opts.glow?' is-new':''));
    b.setAttribute('role','button');
    b.setAttribute('tabindex','0');
    b.style.left=opts.x.toFixed(2)+'%';
    b.style.top=opts.y.toFixed(2)+'%';
    const fig=_figure(entry.companion);
    // R4 — the relationship mark, from the owner's mockup: one small
    // state mark on the figure's rim (💛 we chose each other · ⭐ I
    // chose them · 🌿 they chose me). It names a RELATIONSHIP the
    // legend explains — never an achievement, never a count — and the
    // spatial hierarchy still carries the same truth without it.
    if(opts.mark){
      const bd=_el('span','social-sky-mark',opts.mark);
      bd.setAttribute('aria-hidden','true');
      fig.appendChild(bd);
    }
    b.appendChild(fig);
    b.appendChild(_el('span','social-sky-name','@'+entry.username));
    if(opts.gift){
      // "Somebody has something to show me." Tapping the little gift
      // goes straight to it; tapping the companion meets the Creator.
      const g=_el('button','social-sky-gift','🎁');
      g.type='button';
      g.setAttribute('aria-label','They have something to show you');
      g.addEventListener('click',function(ev){
        ev.stopPropagation();
        try{
          if(typeof CreationShow!=='undefined'&&CreationShow.openGifts){
            // R3.2 — hosted in the same overlay where one exists
            // (openGift), so the gift is a view of the sky rather
            // than a popup replacing it; the module fallback keeps
            // the old overlay for a caller with no panel.
            if(opts.openGift){ opts.openGift(entry.username); return; }
            if(opts.onGift) opts.onGift();
            CreationShow.openGifts({from:entry.username});
          }
        }catch(e){}
      });
      b.appendChild(g);
    }
    // R3 — a star opens the CREATOR, never the map again. The sky's
    // own render hands in onOpen (the in-overlay Creator space); the
    // module-level fallback survives for any caller with no overlay.
    function go(){
      if(opts.onOpen){ opts.onOpen(entry.username,entry.companion||null); return; }
      _goCreator(entry.username);
    }
    b.addEventListener('click',go);
    b.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); go(); }
    });
    return b;
  }

  // WHERE A STAR STANDS — THE THREE-CIRCLE MODEL, and it is the agreed
  // geometry (restated by the product owner after R4 drifted toward a
  // generic constellation map): three relationship ZONES around the
  // child's own Companion — the inner circle for we-chose-each-other,
  // the middle circle for I-chose-them, the outer circle for
  // they-chose-me. Distance from the centre IS relationship gravity.
  // The zones are never labelled on the stars and never become a list;
  // an empty zone simply isn't there.
  //
  // ONE set of zone radii, consumed by the placement AND by the drawn
  // orbit rings, so the two can never disagree about where a circle is.
  const ZONES={
    mutual:{rx:15,ry:20,turn:0},
    chosen:{rx:28,ry:33,turn:Math.PI/5},
    far:{rx:40,ry:43,turn:Math.PI/3}
  };

  // Positions are deterministic: within a zone the stars share the
  // circle evenly (sorted by name, starting at the top), with a small
  // per-name jitter so three companions never look like a diagram —
  // and each zone's ring is turned a little so zones interleave
  // instead of stacking into columns. The same sky draws the same way
  // every time. A CROWDED zone breathes rather than becoming a
  // contact list: past six stars, every other one steps a little off
  // the circle (outward on the inner ring — away from the child's own
  // Companion — inward on the others), so neighbours stop shouldering
  // each other while everyone stays plainly in their zone.
  function _placed(list,zone,drift){
    const sorted=list.slice().sort(function(a,b){
      return _norm(a.username)<_norm(b.username)?-1:1;
    });
    const n=sorted.length;
    return sorted.map(function(e,i){
      const name=_norm(e.username);
      const a=-Math.PI/2+zone.turn+(2*Math.PI*i)/Math.max(n,1)
        +(_jitter(name,1000)/1000)*(Math.PI/Math.max(n*3,6));
      const s=(n>6&&i%2===1)?drift:0;
      return {
        entry:e,
        x:50+Math.cos(a)*(zone.rx+s)+(_jitter(name+'x',4)),
        y:50+Math.sin(a)*(zone.ry+s)+(_jitter(name+'y',4))
      };
    });
  }

  function open(opts){
    const card=_card();
    if(!card) return false;

    const overlay=_el('div','social-sky-overlay');
    const panel=_el('div','social-sky-panel');
    overlay.appendChild(panel);
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });

    // ----------------------------------------------------------------
    // R4 — MY SKY IS A PLACE WITH ROOMS, AND THE SIDEBAR IS THE MAP OF
    // THEM. Redesigned from the product owner's own mockup ("my sky.
    // ignore dog, cottage and green patch, gear icon and bell icon"):
    // a quiet rail on the left — the child's own Companion and @name,
    // then the doors: My Sky · What I've Shown · Gifts · My Creations
    // · Find a Creator · Go to Ether. The doors are VIEWS of this one
    // panel (the R3.2 one-overlay rule) — the sidebar never re-renders,
    // so no round trip can repaint it out from under a child. The Gifts
    // door carries a MARK when something unseen waits — ✨, never a
    // number (Decision 20's discipline holds here too; the mockup's
    // numeric badge was deliberately not taken).
    // ----------------------------------------------------------------
    const side=_el('aside','social-sky-side');
    const body=_el('div','social-sky-body');
    panel.appendChild(side);
    panel.appendChild(body);
    // R4.2 — ONE UNIVERSAL BACK for the whole of My Sky. Moving
    // between the Sky, Gifts, What I've Shown, a Creator's space and
    // Find stays INSIDE the flow (the sidebar's doors are the way
    // around), so no section carries a Back of its own; the one Back,
    // always in the same corner, leaves My Sky for Studio Home.
    const uback=_el('button','social-sky-quiet','Back');
    uback.type='button';
    uback.addEventListener('click',done);
    panel.appendChild(uback);
    function _clear(){ while(body.firstChild) body.removeChild(body.firstChild); }

    const navBtns={};
    function _setActive(id){
      Object.keys(navBtns).forEach(function(k){
        navBtns[k].classList.toggle('is-active',k===id);
      });
    }
    let giftMark=null;
    function _updateGiftMark(){
      try{
        const un=(typeof CreationShow!=='undefined'&&CreationShow.unseenBySender)
          ? CreationShow.unseenBySender() : {};
        const want=Object.keys(un).length>0;
        if(want&&!giftMark&&navBtns.gifts){
          giftMark=_el('span','social-sky-nav-mark','✨');
          giftMark.setAttribute('aria-hidden','true');
          navBtns.gifts.appendChild(giftMark);
        }else if(!want&&giftMark){
          giftMark.remove(); giftMark=null;
        }
      }catch(e){}
    }
    (function _buildSide(){
      const prof=_el('div','social-sky-profile');
      prof.appendChild(_figure(card.companionId||null));
      prof.appendChild(_el('span','social-sky-profile-name',
        card.username?('@'+card.username):(card.nickname||'you')));
      side.appendChild(prof);
      const nav=_el('nav','social-sky-nav');
      side.appendChild(nav);
      function navBtn(id,label,fn){
        const b=_el('button','social-sky-nav-btn',label);
        b.type='button';
        b.addEventListener('click',fn);
        nav.appendChild(b);
        navBtns[id]=b;
        return b;
      }
      navBtn('sky','🌌 My Sky',function(){ render(); });
      navBtn('shown','✦ What I’ve Shown',function(){ renderShown(); });
      navBtn('gifts','🎁 Gifts',function(){
        _setActive('gifts');
        try{
          if(typeof CreationShow!=='undefined'&&CreationShow.openGifts){
            CreationShow.openGifts({host:{mount:body,done:function(){ render(); }}});
          }
        }catch(e){}
      });
      navBtn('mine','🎨 My Creations',function(){ renderMine(); });
      navBtn('find','＋ Find a Creator',function(){ renderFind(); });
      _updateGiftMark();
      // Leaving for the Ether is a DELIBERATE exit, so it surrenders
      // the tab's Studio authority on the way out (Decision 23) — the
      // same handover js/app.js's Back to the Ether and creationFlow's
      // own door already make.
      const eb=_el('button','social-sky-ether','🌌 Go to Ether');
      eb.type='button';
      eb.addEventListener('click',function(){
        try{ sessionStorage.removeItem('vihu.studioEntry.inside'); }catch(e){}
        window.location.href='index.html';
      });
      side.appendChild(eb);
    })();

    function giftsFrom(){
      try{
        return (typeof CreationShow!=='undefined'&&CreationShow.unseenBySender)
          ? CreationShow.unseenBySender() : {};
      }catch(e){ return {}; }
    }

    // Shared by the space and the What I've Shown room — one drawing
    // of "a thing I showed them" (cover or glyph, name, kept, when).
    function _ago(iso){
      try{
        const d=new Date(iso);
        if(isNaN(d.getTime())) return '';
        const days=Math.floor((Date.now()-d.getTime())/86400000);
        if(days<=0) return 'today';
        if(days===1) return 'yesterday';
        return days+' days ago';
      }catch(e){ return ''; }
    }
    function _sentRow(e2){
      const it=_el('div','social-sky-sent-item');
      if(e2.cover){
        const img=document.createElement('img');
        img.alt=''; img.src=e2.cover;
        it.appendChild(img);
      }else{
        it.appendChild(_el('span','social-sky-sent-glyph',
          e2.kind==='story'?'📖':(e2.kind==='letter'?'✍️':'🎨')));
      }
      it.appendChild(_el('span','social-sky-sent-name',e2.name||'A creation'));
      const meta=_el('span','social-sky-sent-meta');
      if(e2.kept) meta.appendChild(_el('span','social-sky-sent-kept','Kept ✓'));
      const when=_ago(e2.at);
      if(when) meta.appendChild(_el('span','social-sky-sent-when',when));
      it.appendChild(meta);
      return it;
    }
    function _panelCard(cls,title){
      const p2=_el('div','social-sky-card'+(cls?' '+cls:''));
      p2.appendChild(_el('p','social-sky-space-head',title));
      const body2=_el('div','social-sky-card-scroll');
      p2.appendChild(body2);
      return {card:p2,body:body2};
    }

    // ----------------------------------------------------------------
    // THE CREATOR'S SPACE (R3) — what a star opens. The sky is the map
    // of who is connected; a Creator is somebody to EXPLORE, so
    // tapping their Companion moves the child INTO their presence:
    // their Companion large, the relationship (in the sky's own words,
    // changeable right here), anything they have waiting to show, and
    // their creations — public ones opening in the Ether where reading
    // lives, and, for a mutual pair, the not-yet-shared shelf mutuality
    // unlocks. Back returns to the sky: same overlay, no second route,
    // no navigation that dumps a child at VihuPlanet's threshold (which
    // is what the old index.html?creator= hand-off did from here).
    // ----------------------------------------------------------------
    function renderSpace(username,companionHint){
      _clear();
      _setActive(null);
      const name=_norm(username);
      const l=layers()||{mutual:[],chosen:[],choseMe:[]};
      const known=[].concat(l.mutual,l.chosen,l.choseMe).find(function(e){
        return e&&_norm(e.username)===name;
      })||null;
      const companion=(known&&known.companion)||companionHint||null;

      const space=_el('div','social-sky-space');
      body.appendChild(space);
      const hero=_el('div','social-sky-space-hero');
      hero.appendChild(_figure(companion));
      space.appendChild(hero);
      space.appendChild(_el('h3','social-sky-space-name','@'+name));

      const rel=_el('div','social-sky-space-rel');
      space.appendChild(rel);
      function drawRel(){
        while(rel.firstChild) rel.removeChild(rel.firstChild);
        const chosenNow=(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.has)?CreatorOrbit.has(name):false;
        const circleNow=(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.circleWith)?CreatorOrbit.circleWith(name):false;
        if(circleNow){
          rel.appendChild(_el('p','social-sky-space-mutual','✨ You chose each other'));
        }else if(chosenNow){
          rel.appendChild(_el('p','social-sky-space-inline','In your Sky ✓'));
        }
        if(chosenNow){
          // The first social act beyond Cheer is a CREATION (Decision
          // 54) — offered here because this is where the child is
          // already thinking about this Creator. Hosted IN the sky
          // panel (R3.2): a view of the same overlay, never a second
          // popup, and Back lands where the child was standing.
          try{
            if(typeof CreationShow!=='undefined'&&CreationShow.canShow&&CreationShow.canShow()){
              const showBtn=_el('button','social-sky-space-show','🎁 Show them something you made');
              showBtn.type='button';
              showBtn.addEventListener('click',function(){
                CreationShow.openShowDialog(null,{to:name,
                  host:{mount:body,done:function(){ renderSpace(name,companion); }}});
              });
              rel.appendChild(showBtn);
            }
          }catch(e){}
          const out=_el('button','social-sky-quiet','Take out of my Sky');
          out.type='button';
          out.addEventListener('click',function(){
            try{ CreatorOrbit.remove(name).then(drawRel); }catch(e){}
            noteChoice(name,companion,false);
            drawRel();
          });
          rel.appendChild(out);
        }else{
          const add=_el('button','social-sky-space-add','⭐ Put them in my Sky');
          add.type='button';
          add.addEventListener('click',function(){
            try{ CreatorOrbit.add(name).then(drawRel); }catch(e){}
            // The field shows the new star the moment the child walks
            // back to it — no page load in between (R3.2).
            noteChoice(name,companion,true);
            drawRel();
          });
          rel.appendChild(add);
        }
      }
      drawRel();

      // R3.9 — A SPACE THAT GROWS. Redesigned on the product owner's
      // instruction ("redesign this screen so that it can grow when
      // show and creations increase"), toward his reference picture:
      // the space is a small night dashboard of PANELS — what I've
      // shown them · their creations · gifts from them · the mutual
      // shelf — each a card that scrolls INSIDE itself, so a hundred
      // shows cost the screen nothing and nothing ever pushes Back
      // off the bottom. Absent rather than empty, every panel. And
      // deliberately NOT the reference's "Viewed" chips: kept travels
      // (the owner's amendment), seen never does.
      const cols=_el('div','social-sky-space-cols');
      space.appendChild(cols);

      // 🎁 what I have shown them (R3.8) — the sender's own history,
      // newest first, every row; the panel scrolls, so the whole of
      // it stands here however long it grows. The kept mark is the
      // owner's amendment to the read-receipt line — SEEN is still
      // never shown to anybody.
      try{
        if(typeof CreationShow!=='undefined'&&CreationShow.sentTo){
          CreationShow.sentTo(name).then(function(sent){
            if(!overlay.isConnected||!space.isConnected||!sent||!sent.length) return;
            const pc=_panelCard('social-sky-sent','🎁 You’ve shown them');
            sent.forEach(function(e2){ pc.body.appendChild(_sentRow(e2)); });
            cols.insertBefore(pc.card,cols.firstChild);
          }).catch(function(){});
        }
      }catch(e){}

      // ✨ their creations — the Ether panel
      const theirs=_panelCard('','✨ Their creations');
      cols.appendChild(theirs.card);
      const grid=_el('div','social-sky-space-grid');
      theirs.body.appendChild(grid);
      const note=_el('p','social-sky-space-note','Looking…');
      theirs.body.appendChild(note);

      // 🎁 gifts from them — everything their Companion has carried
      // here, each row opening the hosted gift view in this same
      // overlay. The old single shortcut button grew into this panel.
      try{
        const fromThem=(typeof CreationShow!=='undefined'&&CreationShow.gifts)
          ?CreationShow.gifts().filter(function(g){ return g&&_norm(g.from)===name; }):[];
        if(fromThem.length){
          const pg2=_panelCard('social-sky-giftpanel','🎁 Gifts from them');
          fromThem.forEach(function(g){
            const b=_el('button','social-sky-space-gift');
            b.type='button';
            b.appendChild(_el('span','social-sky-sent-glyph',
              g.kind==='story'?'📖':(g.kind==='letter'?'✍️':'🎨')));
            b.appendChild(_el('span','social-sky-sent-name',(g.seen?'':'✨ ')+(g.name||'A gift')));
            if(g.kept) b.appendChild(_el('span','social-sky-sent-kept','Kept ✓'));
            b.addEventListener('click',function(){
              try{
                CreationShow.openGifts({from:name,
                  host:{mount:body,done:function(){ renderSpace(name,companion); }}});
              }catch(e2){}
            });
            pg2.body.appendChild(b);
          });
          cols.appendChild(pg2.card);
        }
      }catch(e){}
      try{
        CreatorOrbit.publicCreations().then(function(list){
          if(!overlay.isConnected) return;
          const mine=(list||[]).filter(function(sr){
            return sr&&sr.creatorUsername&&_norm(sr.creatorUsername)===name;
          });
          if(!mine.length){
            note.textContent='Nothing in the Ether yet — but they’re here, making.';
            return;
          }
          note.textContent='';
          mine.forEach(function(sr){
            const b=_el('button','social-sky-space-thing');
            b.type='button';
            if(sr.cover){
              const img=document.createElement('img');
              img.alt=''; img.src=sr.cover;
              b.appendChild(img);
            }else{
              b.appendChild(_el('span','social-sky-space-thing-glyph','✦'));
            }
            b.appendChild(_el('span','social-sky-space-thing-name',sr.title||'A story'));
            // R3.5 — corrected by the product owner: "clicking on any
            // creation is still taking back to ether it should not.
            // the creation should load on studio home itself." A tap
            // opens the story RIGHT HERE, as the same quiet pager the
            // mutual shelf already reads with — same overlay, Back to
            // this Creator's space, no navigation and no lost Studio.
            b.addEventListener('click',function(){
              renderPeek({name:sr.title||'A story',thumbnail:sr.cover||null},
                Array.isArray(sr.pages)?sr.pages:[],
                function(){ renderSpace(name,companion); });
            });
            grid.appendChild(b);
          });
        });
      }catch(e){ note.textContent=''; }

      // Mutuality's one unlock: the not-yet-shared shelf — its own
      // panel in the same dashboard (R3.9).
      try{
        if(typeof CreatorOrbit!=='undefined'&&CreatorOrbit.circleWith&&CreatorOrbit.circleWith(name)){
          mutualProjects(name).then(function(rows){
            if(!overlay.isConnected||!space.isConnected||!rows.length) return;
            const pm=_panelCard('','✨ Not in the Ether yet — because you chose each other');
            const mg=_el('div','social-sky-space-grid');
            pm.body.appendChild(mg);
            cols.appendChild(pm.card);
            rows.forEach(function(row){
              const rec=row&&row.record;
              if(!rec) return;
              // The portal's own fallback (R3.6): baked reading image,
              // else the page's small thumbnail, either payload
              // spelling — a draft's pages are exactly the ones with
              // no reading images baked yet.
              const pages=(typeof CreatorProjectStore!=='undefined'&&CreatorProjectStore.readingPagesOf)
                ?CreatorProjectStore.readingPagesOf(rec):[];
              const b=_el('button','social-sky-space-thing');
              b.type='button';
              const cover=rec.thumbnail||pages[0]||null;
              if(cover){
                const img=document.createElement('img');
                img.alt=''; img.src=cover;
                b.appendChild(img);
              }else{
                b.appendChild(_el('span','social-sky-space-thing-glyph','✦'));
              }
              b.appendChild(_el('span','social-sky-space-thing-name',rec.name||'Still being made ✨'));
              b.addEventListener('click',function(){ renderPeek(rec,pages,function(){ renderSpace(name,companion); }); });
              mg.appendChild(b);
            });
          });
        }
      }catch(e){}

    }

    // A mutual friend's unshared story, paged through quietly.
    function renderPeek(rec,pages,onBack){
      _clear();
      const space=_el('div','social-sky-space');
      body.appendChild(space);
      space.appendChild(_el('h3','social-sky-space-name',rec.name||'Still being made ✨'));
      const stage=_el('div','social-sky-peek');
      space.appendChild(stage);
      if(pages.length){
        let at=0;
        const img=document.createElement('img');
        img.alt=''; img.src=pages[0];
        stage.appendChild(img);
        if(pages.length>1){
          const nav=_el('div','social-sky-peek-nav');
          const prev=_el('button','social-sky-quiet','‹');
          const next=_el('button','social-sky-quiet','›');
          prev.type='button'; next.type='button';
          prev.addEventListener('click',function(){ at=(at+pages.length-1)%pages.length; img.src=pages[at]; });
          next.addEventListener('click',function(){ at=(at+1)%pages.length; img.src=pages[at]; });
          nav.appendChild(prev); nav.appendChild(next);
          stage.appendChild(nav);
        }
      }else if(rec.thumbnail){
        const img=document.createElement('img');
        img.alt=''; img.src=rec.thumbnail;
        stage.appendChild(img);
        space.appendChild(_el('p','social-sky-space-note','Still being made ✨'));
      }else{
        space.appendChild(_el('p','social-sky-space-note','Still being made ✨'));
      }
      const back=_el('button','social-sky-quiet','← Back');
      back.type='button';
      back.addEventListener('click',function(){ onBack(); });
      space.appendChild(back);
    }

    // ----------------------------------------------------------------
    // FIND A CREATOR (R3) — discovery lives IN the sky, as part of the
    // world: the same exact-name lookup and prefix suggestions the
    // Ether's Find already uses (creator_find / creator_suggest —
    // public facts only, nothing enumerable), introducing whoever is
    // found through their Companion. Finding creates nothing;
    // CHOOSING them on their space is the same one-way choice it has
    // always been, and mutuality still needs the other child's own
    // independent choice.
    // ----------------------------------------------------------------
    function renderFind(){
      _clear();
      _setActive('find');
      const space=_el('div','social-sky-space');
      body.appendChild(space);
      space.appendChild(_el('h3','social-sky-space-name','Find a Creator'));
      space.appendChild(_el('p','social-sky-space-note','Type their @name.'));
      const row=_el('div','social-sky-find-row');
      const at=_el('span','social-sky-find-at','@');
      const input=document.createElement('input');
      input.className='social-sky-find-input';
      input.type='text';
      input.maxLength=24;
      input.autocomplete='off';
      input.spellcheck=false;
      row.appendChild(at); row.appendChild(input);
      space.appendChild(row);
      const sug=_el('div','social-sky-find-sug');
      space.appendChild(sug);
      const note=_el('p','social-sky-space-note','');
      let seq=0,timer=null;
      function redraw(names){
        while(sug.firstChild) sug.removeChild(sug.firstChild);
        (names||[]).forEach(function(n2){
          const b=_el('button','social-sky-find-chip','@'+n2);
          b.type='button';
          b.addEventListener('click',function(){ found(n2); });
          sug.appendChild(b);
        });
      }
      input.addEventListener('input',function(){
        const mySeq=++seq;
        const want=_norm(input.value);
        note.textContent='';
        if(want.length<3){ redraw([]); return; }
        if(timer) clearTimeout(timer);
        timer=setTimeout(function(){
          _rpc('creator_suggest',{p_prefix:want}).then(function(out){
            if(mySeq!==seq) return;
            redraw((out&&out.ok&&Array.isArray(out.names))?out.names.slice(0,8):[]);
          }).catch(function(){});
        },250);
      });
      function found(n2){
        note.textContent='Looking across VihuPlanet…';
        _rpc('creator_find',{p_username:_norm(n2)}).then(function(out){
          if(!overlay.isConnected) return;
          if(out&&out.ok){ renderSpace(out.username,out.companion||null); return; }
          note.textContent='No Creator by that name is in VihuPlanet yet.';
        }).catch(function(){
          note.textContent='I can’t see the whole sky from here right now.';
        });
      }
      const go=_el('button','social-sky-space-add','Find ✨');
      go.type='button';
      go.addEventListener('click',function(){
        const want=_norm(input.value);
        if(!want){ note.textContent='Type a name first.'; return; }
        found(want);
      });
      input.addEventListener('keydown',function(ev){
        if(ev.key==='Enter'){ ev.preventDefault(); go.click(); }
      });
      space.appendChild(go);
      space.appendChild(note);
      input.focus();
    }

    // ----------------------------------------------------------------
    // ✦ WHAT I'VE SHOWN (R4) — the sender's whole history in one room,
    // grouped by the Creator it was carried to: the R3.8 per-creator
    // panels, gathered. Kept travels (the owner's amendment); SEEN is
    // still never shown to anybody. Only people I chose can ever have
    // been shown anything (send requires the choice), so the room asks
    // about exactly those names.
    // ----------------------------------------------------------------
    function renderShown(){
      _clear();
      _setActive('shown');
      const space=_el('div','social-sky-space');
      body.appendChild(space);
      space.appendChild(_el('h3','social-sky-space-name','✦ What I’ve Shown'));
      const cols=_el('div','social-sky-space-cols');
      space.appendChild(cols);
      const note=_el('p','social-sky-space-note','Looking…');
      space.appendChild(note);
      const l=layers()||{mutual:[],chosen:[],choseMe:[]};
      const names=[].concat(l.mutual,l.chosen)
        .map(function(e){ return e&&_norm(e.username); })
        .filter(function(n2,i,arr){ return n2&&arr.indexOf(n2)===i; })
        .sort();
      function nothing(){
        note.textContent='When you show somebody something you made, it will be remembered here.';
      }
      if(!names.length||typeof CreationShow==='undefined'||!CreationShow.sentTo){
        nothing();
      }else{
        Promise.all(names.map(function(n2){
          return CreationShow.sentTo(n2).then(function(rows){
            return {name:n2,rows:rows||[]};
          }).catch(function(){ return {name:n2,rows:[]}; });
        })).then(function(groups){
          if(!overlay.isConnected||!space.isConnected) return;
          note.textContent='';
          let any=false;
          groups.forEach(function(g){
            if(!g.rows.length) return;
            any=true;
            const pc=_panelCard('social-sky-sent','@'+g.name);
            g.rows.forEach(function(e2){ pc.body.appendChild(_sentRow(e2)); });
            cols.appendChild(pc.card);
          });
          if(!any) nothing();
        }).catch(function(){ if(space.isConnected) nothing(); });
      }
    }

    // ----------------------------------------------------------------
    // 🎨 MY CREATIONS (R4) — the child's own things, seen from the
    // social world: covers and names, a quiet 🌌 mark on the ones
    // already living in the Ether (a fact about a story, never a
    // count), each opening as the same in-place peek everything else
    // reads with. Making and managing still belong to Studio Home and
    // My Projects — this room is about knowing what you have to show.
    // ----------------------------------------------------------------
    function renderMine(){
      _clear();
      _setActive('mine');
      const space=_el('div','social-sky-space');
      body.appendChild(space);
      space.appendChild(_el('h3','social-sky-space-name','🎨 My Creations'));
      const grid=_el('div','social-sky-space-grid');
      space.appendChild(grid);
      const note=_el('p','social-sky-space-note','Looking…');
      space.appendChild(note);
      try{
        if(typeof CreatorProjectStore==='undefined'||!CreatorProjectStore.list) throw new Error('no store');
        // list() is synchronous (the store hydrates at boot) — the
        // same read My Projects itself makes, card-scoped by it.
        (function(rows){
          const mine=(rows||[]).filter(Boolean);
          if(!mine.length){
            note.textContent='Nothing here yet — go make something ✨';
            return;
          }
          note.textContent='';
          mine.forEach(function(rec){
            const pages=(CreatorProjectStore.readingPagesOf)
              ? CreatorProjectStore.readingPagesOf(rec) : [];
            const b=_el('button','social-sky-space-thing');
            b.type='button';
            const cover=rec.thumbnail||pages[0]||null;
            if(cover){
              const img=document.createElement('img');
              img.alt=''; img.src=cover;
              b.appendChild(img);
            }else{
              b.appendChild(_el('span','social-sky-space-thing-glyph','✦'));
            }
            b.appendChild(_el('span','social-sky-space-thing-name',rec.name||'Still being made ✨'));
            const shared=!!(rec.publishedAt||(rec.data&&rec.data.publishedAt));
            if(shared) b.appendChild(_el('span','social-sky-space-thing-ether','🌌 In the Ether'));
            b.addEventListener('click',function(){ renderPeek(rec,pages,renderMine); });
            grid.appendChild(b);
          });
        })(CreatorProjectStore.list());
      }catch(e){ note.textContent='Nothing here yet — go make something ✨'; }
    }

    function render(){
      _clear();
      _setActive('sky');
      const l=layers()||{mutual:[],chosen:[],choseMe:[]};
      const u=_unseen();
      const gifts=giftsFrom();
      const newStar={},newMutual={};
      u.stars.forEach(function(e){ newStar[_norm(e.username)]=true; });
      u.mutuals.forEach(function(e){ newMutual[_norm(e.username)]=true; });

      const field=_el('div','social-sky-field');
      body.appendChild(field);

      // The title floats quietly in a corner OF the sky — the sky is
      // the screen, not a box the screen contains.
      field.appendChild(_el('h3','social-sky-title','🌌 My Sky'));

      const mutual=_placed(l.mutual,ZONES.mutual,3);
      const chosen=_placed(l.chosen,ZONES.chosen,-3);
      const far=_placed(l.choseMe,ZONES.far,-3);

      // THE ORBITS, AS STRINGS OF STARS (R4.1 drew them, R4.2 gave
      // them their voice — the owner's rule: "connection lines must
      // follow the three-circle/orbit structure", and "think
      // ✦ · ✦ · ✦, not ─────"). Each POPULATED zone lays a trail of
      // tiny stars along its own circle, from the same ZONES the
      // placement reads, wobbling gently off the true ellipse so the
      // trail curves organically instead of tracing a diagram. The
      // tint is the zone's own mark — gold inner, violet middle,
      // leaf-green outer — and the inner trail is the densest and
      // brightest, so the trail itself carries relationship
      // strength. Deterministic (no Math.random): the same sky
      // shimmers the same way every visit. An empty zone lays no
      // trail: no ladder on screen to fill.
      if(mutual.length||chosen.length||far.length){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('class','social-sky-lines');
        svg.setAttribute('viewBox','0 0 100 100');
        svg.setAttribute('preserveAspectRatio','none');
        svg.setAttribute('aria-hidden','true');
        function trail(zone,cls,count){
          const g=document.createElementNS('http://www.w3.org/2000/svg','g');
          g.setAttribute('class',cls);
          for(let i=0;i<count;i++){
            const a=(2*Math.PI*i)/count;
            const w=Math.sin(a*3+zone.rx)*1.1+(((i*7919)%13)-6)/9;
            const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
            c.setAttribute('cx',(50+Math.cos(a)*(zone.rx+w)).toFixed(2));
            c.setAttribute('cy',(50+Math.sin(a)*(zone.ry+w)).toFixed(2));
            c.setAttribute('r',((((i*31)%3)*0.09)+0.16).toFixed(2));
            g.appendChild(c);
          }
          svg.appendChild(g);
        }
        if(far.length) trail(ZONES.far,'is-far',44);
        if(chosen.length) trail(ZONES.chosen,'is-chosen',36);
        if(mutual.length) trail(ZONES.mutual,'is-mutual',30);
        field.appendChild(svg);
      }

      function put(list,cls,glowMap,mark){
        list.forEach(function(p){
          const name=_norm(p.entry.username);
          field.appendChild(_star(p.entry,{
            cls:cls, x:p.x, y:p.y, mark:mark,
            glow:!!(glowMap&&glowMap[name]),
            gift:!!gifts[name],
            openGift:function(u){
              CreationShow.openGifts({from:u,host:{mount:body,done:render}});
            },
            onOpen:function(u,c){ renderSpace(u,c); }
          }));
        });
      }
      put(far,'is-far',newStar,'🌿');
      put(chosen,'is-chosen',null,'⭐');
      put(mutual,'is-mutual',newMutual,'💛');

      // The child themselves — their Companion is the centre of their
      // own creative universe.
      const me=_el('div','social-sky-me');
      me.appendChild(_figure(card.companionId||null));
      me.appendChild(_el('span','social-sky-name',card.username?('@'+card.username):(card.nickname||'you')));
      field.appendChild(me);

      // A mostly-empty sky is allowed to be mostly empty — one gentle
      // line low in the field, never an empty section per layer.
      if(!l.mutual.length&&!l.chosen.length&&!l.choseMe.length){
        field.appendChild(_el('p','social-sky-empty',
          'Your sky is waiting. When you meet a Creator in the Ether whose things you love, choose them — and they appear here.'));
      }

      // THE LEGEND (R4, worded by the owner in R4.1) — the one place
      // the three states are put into words, small and unobtrusive,
      // and the words are the sky's own: chose, never follow. It
      // appears only once there is a star to read it against — an
      // empty sky keeps its one kind sentence and no key to a map
      // with nothing on it.
      if(l.mutual.length||l.chosen.length||l.choseMe.length){
        const legend=_el('div','social-sky-legend');
        [['is-mutual','💛','We chose each other'],
         ['is-chosen','⭐','I chose them'],
         ['is-far','🌿','They chose me']].forEach(function(row){
          const it=_el('span','social-sky-legend-item');
          const g=_el('span','social-sky-legend-glyph '+row[0],row[1]);
          g.setAttribute('aria-hidden','true');
          it.appendChild(g);
          it.appendChild(_el('span','social-sky-legend-text',row[2]));
          legend.appendChild(it);
        });
        field.appendChild(legend);
      }

      // ＋ FIND A CREATOR — part of the sky itself, a soft star low in
      // the field, never a settings button. Discovery belongs where
      // the Creators already live.
      const find=_el('button','social-sky-find-star');
      find.type='button';
      find.appendChild(_el('span','social-sky-find-plus','＋'));
      find.appendChild(_el('span','social-sky-name','Find a Creator'));
      find.addEventListener('click',function(){ renderFind(); });
      field.appendChild(find);

    }

    if(opts&&opts.creator){ renderSpace(_norm(opts.creator),opts.companion||null); }
    else if(opts&&opts.find){ renderFind(); }
    else render();
    document.body.appendChild(overlay);

    // The platform's copy (incoming stars and mutuality are only ever
    // its to say), then the gifts' quiet indicators — both bounded
    // upstream, both re-rendered only if the sky is still open.
    refresh().then(function(){
      const g=(typeof CreationShow!=='undefined'&&CreationShow.refresh)
        ? CreationShow.refresh() : Promise.resolve(false);
      return Promise.resolve(g);
    }).then(function(){
      // Re-render only while the SKY view is up — a child already
      // inside a Creator's space (or typing a name) is not repainted
      // back to the map by a slow round trip.
      if(overlay.isConnected&&panel.querySelector('.social-sky-field')) render();
      _updateGiftMark();
      // Seen once shown: the glow settles after this look, the stars
      // stay. Marked AFTER the render that showed the glow.
      markSeen();
    }).catch(function(){ markSeen(); });
    return true;
  }

  const api={
    refresh:refresh,
    layers:layers,
    eventLines:eventLines,
    markSeen:markSeen,
    tierOf:tierOf,
    mutualProjects:mutualProjects,
    experienced:experienced,
    markExperienced:markExperienced,
    noteChoice:noteChoice,
    configure:configure,
    open:open
  };
  try{ window.SocialSky=api; }catch(e){}
  return api;
})();
