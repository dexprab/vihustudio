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
  // SOCIAL 2 — configured once by the page that owns the Studio door
  // (js/vihuplanetHome.js): how a make-for journey actually leaves
  // for the Studio. This panel never navigates by itself.
  let _makeFor=null,_openSocial=null;
  function configure(opts){
    if(opts&&typeof opts.makeFor==='function') _makeFor=opts.makeFor;
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

  // ---------- the Creator's shelf ----------
  function open(username,opts){
    _build();
    _meet=(opts&&opts.meet)||null;
    const creations=_list(username);
    _title.textContent=_handle(username);
    _sub.textContent='✨ Their creations';
    _clear();

    if(!creations.length){
      _sub.textContent='';
      _body.appendChild(_el('p','creator-presence-note',
        'Nothing of theirs is drifting in the Ether just now.'));
      _body.appendChild(_button('Back','creator-presence-quiet',close));
      _overlay.hidden=false;
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

  // ---------- 🌌 Orbit · ✨ Circle · 🎨 make something -------------
  // SOCIAL 2, and every rule is Decision 54's:
  //  * Orbit is ONE tap and ONE-WAY — the other Creator is not told,
  //    nothing asks them anything, no request exists.
  //  * Circle is never a button: it appears only because both chose,
  //    and it reads as a fact ("You're in each other's Circle"), not
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
        slot.appendChild(_button('🌌 Add to My Orbit','creator-presence-orbit-add',function(){
          CreatorOrbit.add(username).then(function(){ draw(); });
          draw(); // the choice lands instantly; mutuality refines it
        }));
        return;
      }
      slot.appendChild(_el('p','creator-presence-orbit-state',
        circle?'✨ You’re in each other’s Circle':'In My Orbit ✓'));
      if(_makeFor){
        slot.appendChild(_button('🎨 Make something for them','creator-presence-makefor',function(){
          close();
          _makeFor(_normName(username));
        }));
      }
      slot.appendChild(_button('Leave My Orbit','creator-presence-orbit-leave',function(){
        CreatorOrbit.remove(username).then(function(){ draw(); });
        draw();
      }));
    }
    draw();
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
      if(!creations.length){
        note.textContent='No Creator by that name is in the Ether yet.';
        return;
      }
      open(name,{meet:_meet});
    });
    btns.appendChild(go);
    btns.appendChild(_button('Back','creator-presence-quiet',close));
    _body.appendChild(btns);
    _body.appendChild(note);
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); go.click(); }
    });

    // 🌌 MY ORBIT — the Creators this child chose, one tap from their
    // shelves. Their OWN list (never a directory of anybody else), so
    // it can stand here without contradicting "an empty field offers
    // no directory". Absent rather than empty; a ✨ chip is a Circle.
    // No count is shown and none may be added (Decision 54).
    try{
      if(_myCard()&&typeof CreatorOrbit!=='undefined'){
        const orbit=CreatorOrbit.list();
        if(orbit.length){
          _body.appendChild(_el('p','creator-presence-orbit-head','🌌 My Orbit'));
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
