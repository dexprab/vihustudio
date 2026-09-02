// =============================================================
// VihuPlanet — Creator Presence (Sprint SOCIAL 1)
// -------------------------------------------------------------
// "Who made this?" and "what else have they made?" — answered in
// the Ether, on top of the living universe (the Decision 21
// overlay shape: the universe carries on behind the veil, and
// leaving costs nothing).
//
// CREATION-FIRST, NOT PEOPLE-FIRST. A child meets 🐉 The Moon
// Dragon before they ever meet @moonmaker, and this panel is a
// shelf of that Creator's PUBLIC creations — never a profile. It
// is built ENTIRELY from the already-loaded shared feed
// (EtherFeed.byUsername): Canon plus everything anybody shared is
// what the Ether already shows, so nothing here can reveal what
// the universe could not. A private Studio project never entered
// the feed, so it cannot appear — not discoverable, by
// construction rather than by filtering.
//
// FIND A CREATOR is the same shelf reached by typing the name:
// exact match only, against public names on public creations.
// There is no server search endpoint at all — nothing to
// rate-limit, nothing to enumerate, no query that could reach
// email, account ids or anybody who never shared. A Creator with
// no public creation is not findable anywhere, which is the
// product principle enforced by the architecture.
//
// NO CONTACT. Nothing in this panel messages, chats, befriends or
// follows — SOCIAL 1 stops at discovery, and the later Circle
// arrives as its own decision, not as a button here.
// =============================================================

const CreatorPresence=(function(){
  'use strict';

  let _overlay=null,_body=null,_title=null,_sub=null;
  let _meet=null;
  // SOCIAL 2.1 — configured once by the page that owns the Studio
  // door (js/vihuplanetHome.js): the quiet doorway to the child's own
  // Sky at home. This panel never navigates by itself.
  //
  // The 🎨 Make-something-for-them entry that used to be configured
  // here is RETIRED (Social Sky R1, §6 of the frozen canon): the
  // correct direction is creation-first — an existing creation →
  // Show → choose a Creator — and Show lives in the Studio beside the
  // creations themselves. Dedications already made keep rendering
  // wherever they are met; only the way to start a new one moved.
  let _openSocial=null;
  function configure(opts){
    if(opts&&typeof opts.openSocial==='function') _openSocial=opts.openSocial;
  }

  function _myCard(){
    try{
      return (typeof MagicCard!=='undefined'&&MagicCard.getActive)?MagicCard.getActive():null;
    }catch(e){ return null; }
  }

  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!=null) e.textContent=text;
    return e;
  }
  function _button(label,cls,onClick){
    const b=_el('button',cls,label);
    b.type='button';
    b.addEventListener('click',onClick);
    return b;
  }

  function _build(){
    if(_overlay) return;
    _overlay=_el('div','creator-presence');
    _overlay.hidden=true;
    const veil=_el('div','creator-presence-veil');
    veil.addEventListener('click',close);
    const panel=_el('div','creator-presence-panel');
    _title=_el('h3','creator-presence-title','');
    _sub=_el('p','creator-presence-sub','');
    _body=_el('div','creator-presence-body');
    panel.appendChild(_title);
    panel.appendChild(_sub);
    panel.appendChild(_body);
    _overlay.appendChild(veil);
    _overlay.appendChild(panel);
    document.body.appendChild(_overlay);
    document.addEventListener('keydown',function(ev){
      if(_overlay.hidden||ev.key!=='Escape') return;
      close();
      ev.preventDefault();
      ev.stopPropagation();
    },true);
  }

  function _clear(){ while(_body.firstChild) _body.removeChild(_body.firstChild); }

  function _handle(name){
    return (typeof CreatorHandle!=='undefined')?CreatorHandle.display(name):('@'+name);
  }

  function _list(username){
    try{
      return (typeof EtherFeed!=='undefined'&&EtherFeed.byUsername)
        ? EtherFeed.byUsername(username) : [];
    }catch(e){ return []; }
  }

  // ---------- finding a Creator the Ether has not met ----------
  // R2.1, decided by the product owner: a Creator is findable by
  // their exact @name whether or not anything of theirs is in the
  // Ether. The device is asked first (a card standing right here IS
  // that Creator), then the platform's creator_find — an exact-match
  // lookup that answers only public facts (@name and Companion), so
  // there is still nothing to browse and nothing to enumerate.
  // Bounded (Decision 49): a hung platform costs six quiet seconds,
  // never a Find that spins forever.
  function _findCreator(username){
    const want=_normName(username);
    if(!want) return Promise.resolve(null);
    try{
      if(typeof MagicCard!=='undefined'&&MagicCard.list){
        const local=MagicCard.list().find(function(c){
          return c&&c.username&&_normName(c.username)===want;
        });
        if(local) return Promise.resolve({
          username:local.username, companion:local.companionId||null
        });
      }
    }catch(e){}
    const ask=new Promise(function(resolve){
      try{
        if(typeof ThemeRepositoryClient==='undefined') return resolve(null);
        ThemeRepositoryClient.isConfigured().then(function(ok){
          if(!ok) return resolve(null);
          return ThemeRepositoryClient.getClient().then(function(client){
            return client.rpc('creator_find',{p_username:want}).then(function(res){
              const out=res&&res.data;
              resolve((out&&out.ok)?{username:out.username,companion:out.companion||null}:null);
            });
          });
        }).catch(function(){ resolve(null); });
      }catch(e){ resolve(null); }
    });
    return Promise.race([ask,new Promise(function(r){ setTimeout(function(){ r(null); },6000); })]);
  }
  function _companionFig(companionId){
    const fig=_el('span','creator-presence-comp');
    if(companionId){
      const img=document.createElement('img');
      img.alt='';
      img.src='assets/'+encodeURIComponent(companionId)+'/idle.png';
      img.addEventListener('error',function(){
        img.remove();
        fig.appendChild(_el('span','creator-presence-comp-plain','✦'));
      });
      fig.appendChild(img);
    }else{
      fig.appendChild(_el('span','creator-presence-comp-plain','✦'));
    }
    return fig;
  }

  // ---------- the Creator's shelf ----------
  function open(username,opts){
    _build();
    _meet=(opts&&opts.meet)||null;
    const creations=_list(username);
    _title.textContent=_handle(username);
    _sub.textContent='✨ Their creations';
    _clear();

    if(!creations.length){
      // R2.1 — an empty shelf is no longer the end of the road: the
      // Creator may simply not have shared anything yet. The device
      // and the platform are asked whether the @name is real, and a
      // known Creator is shown through their COMPANION, with the same
      // ⭐ choose that a full shelf offers — so a child can put
      // somebody in their Sky before their first shared story.
      _sub.textContent='';
      const note=_el('p','creator-presence-note','Looking across VihuPlanet…');
      _body.appendChild(note);
      const back=_button('Back','creator-presence-quiet',close);
      _body.appendChild(back);
      _overlay.hidden=false;
      const wantTitle=_title.textContent;
      _findCreator(username).then(function(found){
        if(_overlay.hidden||_title.textContent!==wantTitle) return;
        if(!found){
          note.textContent='Nothing of theirs is drifting in the Ether just now.';
          return;
        }
        const figWrap=_el('div','creator-presence-compwrap');
        figWrap.appendChild(_companionFig(found.companion));
        _body.insertBefore(figWrap,note);
        note.textContent='Nothing in the Ether yet — but they’re here, making.';
        _renderRelationship(username);
        _body.appendChild(back); // keep Back last
      });
      return true;
    }

    creations.forEach(function(c){
      const row=_button('','creator-presence-row',function(){
        close();
        if(_meet&&c.projectId) _meet(c.projectId);
      });
      if(c.cover){
        const img=document.createElement('img');
        img.className='creator-presence-cover';
        img.alt='';
        img.src=c.cover;
        row.appendChild(img);
      }else{
        row.appendChild(_el('span','creator-presence-cover creator-presence-cover-empty','✦'));
      }
      row.appendChild(_el('span','creator-presence-name',c.title));
      _body.appendChild(row);
    });
    _renderRelationship(username);
    _body.appendChild(_button('Back','creator-presence-quiet',close));
    _overlay.hidden=false;
    return true;
  }

  // ---------- the choosing, in Sky language (Social Sky R1) --------
  // Every rule is Decision 54's, with Decision 56's words on top —
  // the child meets STAR · SKY, never orbit/circle/follow:
  //  * Choosing is ONE tap and ONE-WAY — the other Creator is not
  //    told, nothing asks them anything, no request exists.
  //  * Mutuality is never a button: it appears only because both
  //    chose, and it reads as a fact ("You chose each other"), not
  //    an achievement.
  //  * Leaving is as quiet as joining. No notification either way.
  //  * A Traveller holding no card sees none of this — a
  //    relationship needs somebody to belong to. Absent, not locked.
  //  * And never a number anywhere.
  function _renderRelationship(username){
    const card=_myCard();
    if(!card) return;
    if(typeof CreatorOrbit==='undefined') return;
    const me=card.username&&_normName(card.username)===_normName(username);
    if(me) return; // your own shelf needs no relationship to yourself

    const slot=_el('div','creator-presence-orbit');
    _body.appendChild(slot);

    function draw(){
      while(slot.firstChild) slot.removeChild(slot.firstChild);
      const inOrbit=CreatorOrbit.has(username);
      const circle=CreatorOrbit.circleWith(username);
      if(!inOrbit){
        slot.appendChild(_button('⭐ Put them in my Sky','creator-presence-orbit-add',function(){
          CreatorOrbit.add(username).then(function(){ draw(); });
          draw(); // the choice lands instantly; mutuality refines it
        }));
        return;
      }
      slot.appendChild(_el('p','creator-presence-orbit-state',
        circle?'✨ You chose each other':'In your Sky ✓'));
      slot.appendChild(_button('Take out of my Sky','creator-presence-orbit-leave',function(){
        CreatorOrbit.remove(username).then(function(){ draw(); });
        draw();
      }));
    }
    draw();
    _renderMutualShelf(username);
  }

  // ---------- ✨ what a mutual Creator may see (Social Sky R1) -----
  // The one capability mutuality adds in R1: the other Creator's work
  // that has NOT been pushed to Ether. Server-verified live (both
  // choices must stand right now), so this section simply never
  // renders for anybody else — absent, not locked. Opening one is a
  // quiet peek at its baked pages where the story has them; a story
  // still being made shows its cover and says so. Nothing here
  // publishes anything or touches the other Creator's records.
  function _renderMutualShelf(username){
    if(typeof SocialSky==='undefined'||!SocialSky.mutualProjects) return;
    if(typeof CreatorOrbit==='undefined'||!CreatorOrbit.circleWith(username)) return;
    const slot=_el('div','creator-presence-mutual');
    _body.appendChild(slot);
    SocialSky.mutualProjects(username).then(function(list){
      if(!slot.isConnected||!list.length) return;
      slot.appendChild(_el('p','creator-presence-orbit-head','✨ Not in the Ether yet'));
      slot.appendChild(_el('p','creator-presence-note',
        'Because you chose each other, you can see what they are making.'));
      list.slice(0,8).forEach(function(p){
        const rec=p.record||{};
        const row=_button('','creator-presence-row',function(){
          _peek(rec);
        });
        if(rec.thumbnail){
          const img=document.createElement('img');
          img.className='creator-presence-cover';
          img.alt='';
          img.src=rec.thumbnail;
          row.appendChild(img);
        }else{
          row.appendChild(_el('span','creator-presence-cover creator-presence-cover-empty','✦'));
        }
        row.appendChild(_el('span','creator-presence-name',rec.name||'A story'));
        slot.appendChild(row);
      });
    }).catch(function(){});
  }

  // A small page-through of the baked reading images a record carries
  // — never the Studio, never an editor, never the portal machinery
  // (which belongs to Spirits actually in the universe).
  function _peek(rec){
    const pages=[];
    try{
      ((rec.data&&rec.data.pages)||[]).forEach(function(s){
        if(s&&s.readImage) pages.push(s.readImage);
      });
    }catch(e){}
    const overlay=_el('div','creator-presence-peek');
    const panel=_el('div','creator-presence-peek-panel');
    overlay.appendChild(panel);
    function done(){ try{ overlay.remove(); }catch(e){} }
    overlay.addEventListener('click',function(ev){ if(ev.target===overlay) done(); });
    panel.appendChild(_el('h3','creator-presence-title',rec.name||'A story'));
    if(pages.length){
      let at=0;
      const img=document.createElement('img');
      img.className='creator-presence-peek-page';
      img.alt='';
      img.src=pages[0];
      panel.appendChild(img);
      if(pages.length>1){
        const nav=_el('div','creator-presence-peek-nav');
        nav.appendChild(_button('‹','creator-presence-peek-arrow',function(){
          at=(at+pages.length-1)%pages.length; img.src=pages[at];
        }));
        nav.appendChild(_button('›','creator-presence-peek-arrow',function(){
          at=(at+1)%pages.length; img.src=pages[at];
        }));
        panel.appendChild(nav);
      }
    }else{
      if(rec.thumbnail){
        const img=document.createElement('img');
        img.className='creator-presence-peek-page';
        img.alt='';
        img.src=rec.thumbnail;
        panel.appendChild(img);
      }
      panel.appendChild(_el('p','creator-presence-note','Still being made ✨'));
    }
    panel.appendChild(_button('Back','creator-presence-quiet',done));
    document.body.appendChild(overlay);
  }

  function _normName(name){
    return (typeof CreatorHandle!=='undefined')
      ? CreatorHandle.normalize(name)
      : String(name||'').trim().replace(/^@+/,'').toLowerCase();
  }

  // ---------- 🔎 Find a Creator ----------
  function find(opts){
    _build();
    _meet=(opts&&opts.meet)||null;
    _title.textContent='🔎 Find a Creator';
    _sub.textContent='Type their VihuPlanet name.';
    _clear();

    const row=_el('div','creator-presence-findrow');
    const at=_el('span','creator-presence-at','@');
    const input=document.createElement('input');
    input.className='creator-presence-input';
    input.type='text';
    input.maxLength=24;
    input.placeholder='moonmaker';
    input.autocomplete='off';
    input.spellcheck=false;
    row.appendChild(at);
    row.appendChild(input);
    _body.appendChild(row);

    // Suggestions after a few typed characters (product owner's ask).
    // Drawn ONLY from EtherFeed.suggestUsernames — names already on
    // public shared stories in the loaded feed, so nothing is offered
    // that the universe is not already showing. Tapping one opens
    // that Creator's shelf; typing on simply redraws.
    const suggest=_el('div','creator-presence-suggest');
    _body.appendChild(suggest);
    function _redrawSuggestions(){
      while(suggest.firstChild) suggest.removeChild(suggest.firstChild);
      let names=[];
      try{
        names=(typeof EtherFeed!=='undefined'&&EtherFeed.suggestUsernames)
          ? EtherFeed.suggestUsernames(input.value) : [];
      }catch(e){}
      names.forEach(function(name){
        suggest.appendChild(_button(_handle(name),'creator-presence-suggest-btn',function(){
          open(name,{meet:_meet});
        }));
      });
    }
    input.addEventListener('input',_redrawSuggestions);

    const note=_el('p','creator-presence-note','');
    const btns=_el('div','creator-presence-btns');
    const go=_button('Find ✨','creator-presence-go',function(){
      const name=(typeof CreatorHandle!=='undefined')
        ? CreatorHandle.normalize(input.value)
        : String(input.value||'').trim().replace(/^@+/,'').toLowerCase();
      if(!name){ note.textContent='Type a name first.'; return; }
      const creations=_list(name);
      if(creations.length){ open(name,{meet:_meet}); return; }
      // R2.1 — nothing of theirs in the Ether does not mean they are
      // not real: the exact name is looked up (device, then platform)
      // and a known Creator's shelf opens, Companion and ⭐ and all. A
      // name nobody holds stays here, gently, ready to retype.
      note.textContent='Looking across VihuPlanet…';
      go.disabled=true;
      _findCreator(name).then(function(found){
        go.disabled=false;
        if(found){ note.textContent=''; open(name,{meet:_meet}); return; }
        note.textContent='No Creator by that name is in VihuPlanet yet.';
      });
    });
    btns.appendChild(go);
    btns.appendChild(_button('Back','creator-presence-quiet',close));
    _body.appendChild(btns);
    _body.appendChild(note);
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); go.click(); }
    });

    // 🌌 MY SKY — the Creators this child chose, one tap from their
    // shelves. Their OWN list (never a directory of anybody else), so
    // it can stand here without contradicting "an empty field offers
    // no directory". Absent rather than empty; a ✨ chip is a mutual
    // choice. No count is shown and none may be added (Decision 54).
    try{
      if(_myCard()&&typeof CreatorOrbit!=='undefined'){
        const orbit=CreatorOrbit.list();
        if(orbit.length){
          _body.appendChild(_el('p','creator-presence-orbit-head','🌌 My Sky'));
          const chips=_el('div','creator-presence-suggest');
          orbit.forEach(function(e){
            chips.appendChild(_button((e.circle?'✨ ':'')+_handle(e.username),
              'creator-presence-suggest-btn',function(){
                open(e.username,{meet:_meet});
              }));
          });
          _body.appendChild(chips);
          // SOCIAL 2.1 — the quiet doorway: the Ether lets a child ACT
          // socially in context; understanding and managing their
          // social world lives on Studio Home. One line, only under
          // their own orbit, only for a card-holder.
          if(_openSocial){
            _body.appendChild(_button('Open in your Studio','creator-presence-social-door',function(){
              close();
              _openSocial();
            }));
          }
        }
      }
    }catch(e){}

    _overlay.hidden=false;
    input.focus();
  }

  function close(){
    if(_overlay) _overlay.hidden=true;
  }

  const api={ open:open, find:find, close:close, configure:configure };
  try{ window.CreatorPresence=api; }catch(e){}
  return api;
})();
