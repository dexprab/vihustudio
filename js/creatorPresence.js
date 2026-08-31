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
    _body.appendChild(_button('Back','creator-presence-quiet',close));
    _overlay.hidden=false;
    return true;
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
    _overlay.hidden=false;
    input.focus();
  }

  function close(){
    if(_overlay) _overlay.hidden=true;
  }

  const api={ open:open, find:find, close:close };
  try{ window.CreatorPresence=api; }catch(e){}
  return api;
})();
