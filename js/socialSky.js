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
    b.appendChild(_figure(entry.companion));
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
            if(opts.onGift) opts.onGift();
            CreationShow.openGifts({from:entry.username});
          }
        }catch(e){}
      });
      b.appendChild(g);
    }
    function go(){ _goCreator(entry.username); }
    b.addEventListener('click',go);
    b.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); go(); }
    });
    return b;
  }

  // WHERE A STAR STANDS — the whole relationship model, said spatially
  // and never as a list: mutual choices closest around the child's own
  // Companion, the Creators they chose further out, and the Creators
  // who chose them further and fainter still. No rings are drawn, no
  // layer is labelled, and an empty layer simply isn't there — the
  // hierarchy is felt, not explained.
  //
  // Positions are deterministic: within a layer the stars share the
  // circle evenly (sorted by name, starting at the top), with a small
  // per-name jitter so three companions never look like a diagram —
  // and each layer's ring is turned a little so layers interleave
  // instead of stacking into columns. The same sky draws the same way
  // every time.
  function _placed(list,rx,ry,turn){
    const sorted=list.slice().sort(function(a,b){
      return _norm(a.username)<_norm(b.username)?-1:1;
    });
    const n=sorted.length;
    return sorted.map(function(e,i){
      const name=_norm(e.username);
      const a=-Math.PI/2+turn+(2*Math.PI*i)/Math.max(n,1)
        +(_jitter(name,1000)/1000)*(Math.PI/Math.max(n*3,6));
      return {
        entry:e,
        x:50+Math.cos(a)*rx+(_jitter(name+'x',4)),
        y:50+Math.sin(a)*ry+(_jitter(name+'y',4))
      };
    });
  }

  function open(){
    const card=_card();
    if(!card) return false;

    const overlay=_el('div','social-sky-overlay');
    const panel=_el('div','social-sky-panel');
    overlay.appendChild(panel);
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });

    function giftsFrom(){
      try{
        return (typeof CreationShow!=='undefined'&&CreationShow.unseenBySender)
          ? CreationShow.unseenBySender() : {};
      }catch(e){ return {}; }
    }

    function render(){
      while(panel.firstChild) panel.removeChild(panel.firstChild);
      const l=layers()||{mutual:[],chosen:[],choseMe:[]};
      const u=_unseen();
      const gifts=giftsFrom();
      const newStar={},newMutual={};
      u.stars.forEach(function(e){ newStar[_norm(e.username)]=true; });
      u.mutuals.forEach(function(e){ newMutual[_norm(e.username)]=true; });

      const field=_el('div','social-sky-field');
      panel.appendChild(field);

      // The title floats quietly in a corner OF the sky — the sky is
      // the screen, not a box the screen contains.
      field.appendChild(_el('h3','social-sky-title','🌌 My Sky'));

      const mutual=_placed(l.mutual,15,20,0);
      const chosen=_placed(l.chosen,28,33,Math.PI/5);
      const far=_placed(l.choseMe,40,43,Math.PI/3);

      // Constellation lines — the mutual pairs are DRAWN as connected
      // to the child's own Companion, which is what "we chose each
      // other" looks like without a word of it.
      if(mutual.length){
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('class','social-sky-lines');
        svg.setAttribute('viewBox','0 0 100 100');
        svg.setAttribute('preserveAspectRatio','none');
        svg.setAttribute('aria-hidden','true');
        mutual.forEach(function(p){
          const line=document.createElementNS('http://www.w3.org/2000/svg','line');
          line.setAttribute('x1','50'); line.setAttribute('y1','50');
          line.setAttribute('x2',p.x.toFixed(2)); line.setAttribute('y2',p.y.toFixed(2));
          svg.appendChild(line);
        });
        field.appendChild(svg);
      }

      function put(list,cls,glowMap){
        list.forEach(function(p){
          const name=_norm(p.entry.username);
          field.appendChild(_star(p.entry,{
            cls:cls, x:p.x, y:p.y,
            glow:!!(glowMap&&glowMap[name]),
            gift:!!gifts[name],
            onGift:done
          }));
        });
      }
      put(far,'is-far',newStar);
      put(chosen,'is-chosen',null);
      put(mutual,'is-mutual',newMutual);

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

      const back=_el('button','social-sky-quiet','Back');
      back.type='button';
      back.addEventListener('click',done);
      field.appendChild(back);
    }

    render();
    document.body.appendChild(overlay);

    // The platform's copy (incoming stars and mutuality are only ever
    // its to say), then the gifts' quiet indicators — both bounded
    // upstream, both re-rendered only if the sky is still open.
    refresh().then(function(){
      const g=(typeof CreationShow!=='undefined'&&CreationShow.refresh)
        ? CreationShow.refresh() : Promise.resolve(false);
      return Promise.resolve(g);
    }).then(function(){
      if(overlay.isConnected) render();
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
    configure:configure,
    open:open
  };
  try{ window.SocialSky=api; }catch(e){}
  return api;
})();
