// =============================================================
// VihuPlanet — Creator Orbit (Sprint SOCIAL 2)
// -------------------------------------------------------------
// 🌌 MY ORBIT — Creators I choose to see. One-way on purpose: I
// add somebody and THEY ARE NOT TOLD. No request, no acceptance,
// no obligation — a quiet choice about my own attention.
//
// ✨ MY CIRCLE — Creators who chose me too. Not another button and
// not another store: a Circle IS two orbits facing each other,
// derived by the platform (creator_orbit_list's `circle` bit is
// the ONLY thing ever revealed about the other direction). Nobody
// can ask "who orbits me" or "how many" — there is no count, no
// list of admirers, no way to feel watched.
//
// LOCAL FIRST, the Cheer discipline: a tap lands instantly and
// survives a reload on this device; the platform is told
// afterwards, and its answer (including mutuality) replaces the
// local guess when it arrives. The record is scoped to the MAGIC
// CARD (Decision 19's pattern), so two Creators on one machine
// keep separate orbits, and the platform copy is what follows a
// Creator to a new device.
//
// THE ACTIVITY LINES ARE DERIVED, NEVER LOGGED (the CreatorSocial
// pattern): no event store, no notification system. The public
// feed already says what everybody shared and when; these lines
// exist only where something is NEWER than what this card last
// saw. Never a number, never a ranking.
// =============================================================

const CreatorOrbit=(function(){
  'use strict';

  const KEY='vihu.orbit.';
  const SEEN_KEY='vihu.orbitSeen.';

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
    try{ return JSON.parse(localStorage.getItem(KEY+cardId)||'{}')||{}; }
    catch(e){ return {}; }
  }
  function _write(cardId,map){
    try{ localStorage.setItem(KEY+cardId,JSON.stringify(map)); }catch(e){}
  }

  // ---------- what this card chose ----------
  function list(){
    const card=_card();
    if(!card) return [];
    const map=_read(card.id);
    return Object.keys(map).sort().map(function(name){
      return { username:name, circle:!!(map[name]&&map[name].circle) };
    });
  }
  function has(username){
    const card=_card();
    if(!card) return false;
    return !!_read(card.id)[_norm(username)];
  }
  function circleWith(username){
    const card=_card();
    if(!card) return false;
    const e=_read(card.id)[_norm(username)];
    return !!(e&&e.circle);
  }

  // ---------- choosing, and un-choosing ----------
  // Optimistic: the choice lands locally at once; the platform's
  // answer refines it (mutuality) or quietly stands it down for a
  // name the platform does not know.
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

  function add(username){
    const card=_card();
    const name=_norm(username);
    if(!card||!name) return Promise.resolve({ok:false,reason:'no_card'});
    // A Creator cannot orbit themselves — kindly, locally, instantly.
    if(card.username&&_norm(card.username)===name){
      return Promise.resolve({ok:false,reason:'own'});
    }
    const map=_read(card.id);
    map[name]=map[name]||{circle:false};
    _write(card.id,map);
    return _rpc('creator_orbit_set',{p_identity_id:card.id,p_username:name,p_on:true})
      .then(function(out){
        if(out&&out.ok){
          const m=_read(card.id);
          m[name]={circle:!!out.circle};
          _write(card.id,m);
          return {ok:true,circle:!!out.circle};
        }
        if(out&&out.ok===false&&(out.reason==='unknown'||out.reason==='own')){
          const m=_read(card.id); delete m[name]; _write(card.id,m);
          return {ok:false,reason:out.reason};
        }
        // No platform is still a kept local choice.
        return {ok:true,circle:circleWith(name)};
      }).catch(function(){ return {ok:true,circle:circleWith(name)}; });
  }

  function remove(username){
    const card=_card();
    const name=_norm(username);
    if(!card||!name) return Promise.resolve({ok:false,reason:'no_card'});
    const map=_read(card.id);
    delete map[name];
    _write(card.id,map);
    // If the choice was mutual, the Circle simply ends — the other
    // Creator is never told (Decision 54: no drama).
    return _rpc('creator_orbit_set',{p_identity_id:card.id,p_username:name,p_on:false})
      .then(function(){ return {ok:true}; })
      .catch(function(){ return {ok:true}; });
  }

  // ---------- the platform's copy, once per load ----------
  // Replaces the local guess wholesale: the orbit follows the CARD,
  // so a Creator on a new device inherits their choices — and the
  // circle bits are only ever the platform's to say.
  let _refreshed=false;
  function refresh(){
    const card=_card();
    if(!card) return Promise.resolve(false);
    if(_refreshed) return Promise.resolve(false);
    return _rpc('creator_orbit_list',{p_identity_id:card.id}).then(function(out){
      if(!out||!out.ok||!Array.isArray(out.orbit)) return false;
      _refreshed=true;
      const map={};
      out.orbit.forEach(function(e){
        if(e&&e.username) map[_norm(e.username)]={circle:!!e.circle};
      });
      _write(card.id,map);
      return true;
    }).catch(function(){ return false; });
  }

  // ---------- what is happening, derived ----------
  function _readSeen(cardId){
    try{ return JSON.parse(localStorage.getItem(SEEN_KEY+cardId)||'{}')||{}; }
    catch(e){ return {}; }
  }
  function _writeSeen(cardId,map){
    try{ localStorage.setItem(SEEN_KEY+cardId,JSON.stringify(map)); }catch(e){}
  }

  // Lines about THINGS HAPPENING BETWEEN CREATORS, never content
  // scrolling past (Decision 54):
  //   "✨ @moonmaker made something new"      — an orbited Creator's
  //     newest public creation is newer than this card last saw
  //   "🎨 @sam made something for you"        — a public creation
  //     stamped for THIS card's own name (whoever made it)
  // Resolves { lines, markSeen } — the surface that SHOWED them
  // spends them, the CreatorSocial contract exactly.
  // The public creations this device can see, in ONE shape wherever
  // we are standing: the Ether hands over its already-loaded feed;
  // Studio Home (which does not run the universe) asks the shared
  // feed directly, BOUNDED (Decision 49) so a slow platform costs a
  // quiet moment, never a hung screen.
  function _publicCreations(){
    try{
      if(typeof EtherFeed!=='undefined'&&EtherFeed.lastLoaded){
        const cached=EtherFeed.lastLoaded();
        if(cached&&cached.length) return Promise.resolve(cached);
      }
    }catch(e){}
    // The device's OWN shared records first — a story shared from this
    // machine is public whether or not the platform round trip has
    // happened yet — then the platform's copy of everybody's.
    let local=[];
    try{
      if(typeof CreatorProjectStore!=='undefined'&&CreatorProjectStore.listAll){
        local=(CreatorProjectStore.listAll()||[]).filter(function(r){
          return r&&r.publishedAt;
        }).map(function(r){
          // readingPagesOf carries the portal's own fallback (baked
          // reading image, else the page's small thumbnail, either
          // payload spelling) — R3.6, so a story shared before reading
          // images still has something to peek.
          const pages=CreatorProjectStore.readingPagesOf?CreatorProjectStore.readingPagesOf(r):[];
          return { id:r.id, title:r.name||'A story',
                   cover:r.thumbnail||pages[0]||null,
                   pages:pages,
                   creatorUsername:r.creatorUsername||null,
                   forUsername:r.forUsername||null,
                   publishedAt:r.publishedAt||null,
                   source:{projectId:r.id} };
        });
      }
    }catch(e){}
    try{
      if(typeof CreatorProjectSync==='undefined'||!CreatorProjectSync.listShared){
        return Promise.resolve(local);
      }
      let bell=null;
      const capped=new Promise(function(resolve){
        bell=setTimeout(function(){ resolve([]); },4000);
      });
      const real=CreatorProjectSync.listShared().then(function(rows){
        return (rows||[]).map(function(row){
          const d=row&&row.data;
          if(!d) return null;
          const pages=(typeof CreatorProjectStore!=='undefined'&&CreatorProjectStore.readingPagesOf)
            ?CreatorProjectStore.readingPagesOf(d):[];
          return { id:d.id, title:d.name||'A story',
                   cover:d.thumbnail||pages[0]||null,
                   pages:pages,
                   creatorUsername:d.creatorUsername||null,
                   forUsername:d.forUsername||null,
                   publishedAt:d.publishedAt||null,
                   source:{projectId:d.id} };
        }).filter(Boolean);
      }).catch(function(){ return []; });
      return Promise.race([real,capped]).then(function(v){
        clearTimeout(bell);
        const seen={};
        const out=[];
        local.concat(v||[]).forEach(function(s){
          if(!s||seen[s.id]) return;
          seen[s.id]=true;
          out.push(s);
        });
        return out;
      });
    }catch(e){ return Promise.resolve(local); }
  }

  function activityLines(){
    const card=_card();
    if(!card) return Promise.resolve({lines:[],markSeen:function(){}});
    const mine=card.username?_norm(card.username):null;
    const orbit=list();
    if(!orbit.length&&!mine) return Promise.resolve({lines:[],markSeen:function(){}});
    return _publicCreations().then(function(loaded){
    const seen=_readSeen(card.id);
    const next={};
    const lines=[];

    orbit.forEach(function(e){
      let newest=null;
      loaded.forEach(function(s){
        if(!s||!s.creatorUsername) return;
        if(_norm(s.creatorUsername)!==e.username) return;
        if(!s.publishedAt) return;
        if(!newest||s.publishedAt>newest) newest=s.publishedAt;
      });
      if(!newest) return;
      next['new:'+e.username]=newest;
      const before=seen['new:'+e.username]||'';
      if(newest>before){
        lines.push((e.circle?'✨':'🌌')+' @'+e.username+' made something new');
      }
    });

    if(mine){
      loaded.forEach(function(s){
        if(!s||!s.forUsername||_norm(s.forUsername)!==mine) return;
        const maker=s.creatorUsername?_norm(s.creatorUsername):null;
        if(maker&&maker===mine) return; // my own gift is not news to me
        const key='for:'+((s.source&&s.source.projectId)||s.id);
        next[key]='seen';
        if(!seen[key]){
          lines.push('🎨 '+(maker?'@'+maker:'Somebody')+' made something for you');
        }
      });
    }

    return {
      lines:lines,
      markSeen:function(){
        const merged=_readSeen(card.id);
        Object.keys(next).forEach(function(k){ merged[k]=next[k]; });
        _writeSeen(card.id,merged);
      }
    };
    });
  }

  // ---------- 🎨 make something for them — RETIRED ENTRY ----------
  // Social Sky R1 (§6 of the frozen canon) retired this direction:
  // the correct flow is creation-first — an existing creation → SHOW
  // → choose a Creator (js/creationShow.js). Nothing calls
  // noteMakeFor any more, so no new dedication can start here; the
  // plumbing stays because dedications already made are historical
  // facts (`forUsername` on their records keeps rendering wherever
  // those stories are met — every action is a unit), and the store's
  // consumer keeps honouring a note that no longer gets written.
  const FOR_NOTE='vihu.makeFor.note';
  function noteMakeFor(username){
    const name=_norm(username);
    if(!name) return false;
    try{ sessionStorage.setItem(FOR_NOTE,name); return true; }catch(e){ return false; }
  }
  function pendingFor(){
    try{ return sessionStorage.getItem(FOR_NOTE)||null; }catch(e){ return null; }
  }
  function clearMakeFor(){
    try{ sessionStorage.removeItem(FOR_NOTE); }catch(e){}
  }

  const api={
    list:list,
    has:has,
    circleWith:circleWith,
    add:add,
    remove:remove,
    refresh:refresh,
    activityLines:activityLines,
    noteMakeFor:noteMakeFor,
    pendingFor:pendingFor,
    clearMakeFor:clearMakeFor,
    FOR_NOTE:FOR_NOTE,
    // The public creations this surface can see, one shape everywhere
    // — Studio Home's personal area lists a Creator's work from it.
    publicCreations:_publicCreations,
    // SOCIAL 2.1 — the one-shot doorway note: the Ether asks Studio
    // Home to open the personal social area on arrival. Intent
    // crosses; state does not (Decision 23).
    SOCIAL_NOTE:'vihu.openSocial.note',
    noteOpenSocial:function(){ try{ sessionStorage.setItem('vihu.openSocial.note','1'); }catch(e){} },
    consumeOpenSocial:function(){
      try{
        const v=sessionStorage.getItem('vihu.openSocial.note');
        sessionStorage.removeItem('vihu.openSocial.note');
        return !!v;
      }catch(e){ return false; }
    }
  };
  try{ window.CreatorOrbit=api; }catch(e){}
  return api;
})();
