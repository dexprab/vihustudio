// emojiPicker.js — Sprint 9.6 (Museum Gallery Theme Support): Global
// Emoji Pack. One small, reusable "insert emoji" affordance wired onto
// every Text Element's content field — Title, Story Beat, Footer,
// Handle, and any future Text Element — rather than a bespoke picker
// per field. Available regardless of theme, same as the Social/Shape
// sticker packs.
const EmojiPicker=(function(){
  'use strict';

  const EMOJI=[
    '😀','😊','😍','🥳','😎','🤔','😢','😴','🤗','😉',
    '❤️','⭐','✨','🌈','☀️','🌙','☁️','🔥','💧','🌸',
    '🍎','🎉','🎈','🎁','🐶','🐱','🦄','⚽','🚀','📖',
    '🎵','👍','🙌','💡','🏆','🌟','🍭','🦋','🌻','🐝'
  ];

  // Only one panel open at a time; a click anywhere else closes it.
  let _openPanel=null;
  function _closeOpenPanel(){
    if(_openPanel){ _openPanel.classList.add('hidden'); _openPanel=null; }
  }
  document.addEventListener('click',function(e){
    if(_openPanel && !_openPanel.contains(e.target) && e.target.className!=='emoji-picker-toggle'){
      _closeOpenPanel();
    }
  });

  function _insertAt(el,emoji){
    const hasSelection=typeof el.selectionStart==='number';
    const start=hasSelection?el.selectionStart:el.value.length;
    const end=hasSelection?el.selectionEnd:el.value.length;
    const val=el.value||'';
    el.value=val.slice(0,start)+emoji+val.slice(end);
    if(hasSelection){
      try{ el.selectionStart=el.selectionEnd=start+emoji.length; }catch(e2){}
    }
    // The caller's own 'input' listener (already wired when it built
    // `el`) is what actually persists this — dispatching here means
    // EmojiPicker never needs to know the field's save path.
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.focus();
  }

  // Wraps an already-built <input>/<textarea> with a toggle button + a
  // small emoji grid. `el` stays a direct child of the returned
  // wrapper, still reachable by every existing `querySelector('.foo')`
  // lookup keyed on el's own class — callers don't need to change how
  // they find/sync/focus the field afterward.
  // The toggle and its panel, appended to a host the CALLER already
  // owns. Split out of wrap() so a field that cannot be wrapped can
  // still have the affordance: the Studio header's project name lives
  // in a compact pill beside its own pencil, and wrap()'s full-width
  // row would take that pill apart.
  //
  // Returns the toggle, so a caller can place it precisely among
  // whatever else it keeps in there.
  function attach(el,host,opts){
    opts=opts||{};
    // PORTAL MODE — for a host inside a clipping ancestor.
    //
    // The Studio header is `overflow: hidden`, so a panel absolutely
    // positioned inside it is cut off at the header's own bottom edge:
    // the field gets its toggle, and opening it shows one row of a
    // panel that is really six. Positioning cannot fix that from
    // inside — the fix is to not be inside it.
    //
    // So the panel is appended to <body> and positioned as `fixed`,
    // against the toggle's own on-screen box, each time it opens (the
    // header can move — the window resizes, the field grows with the
    // name in it — so its place is computed at open time, never cached).
    var portal=opts.portal===true;
    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='emoji-picker-toggle'+(opts.toggleClass?(' '+opts.toggleClass):'');
    toggle.textContent='😊';
    toggle.setAttribute('aria-label','Insert emoji');
    host.appendChild(toggle);

    const panel=document.createElement('div');
    panel.className='emoji-picker-panel hidden';
    EMOJI.forEach(function(em){
      const b=document.createElement('button');
      b.type='button';
      b.className='emoji-picker-option';
      b.textContent=em;
      b.addEventListener('click',function(ev){
        ev.stopPropagation();
        _insertAt(el,em);
        _closeOpenPanel();
      });
      panel.appendChild(b);
    });
    if(portal){
      panel.classList.add('is-portal');
      try{ document.body.appendChild(panel); }catch(e){ host.appendChild(panel); }
    }else{
      host.appendChild(panel);
    }

    function place(){
      if(!portal) return;
      try{
        var r=toggle.getBoundingClientRect();
        panel.style.top=(r.bottom+6)+'px';
        // Kept on screen: a panel opening near the right edge is
        // pulled back rather than sliding off it.
        var w=panel.offsetWidth||216;
        var left=Math.min(r.right-w, window.innerWidth-w-8);
        panel.style.left=Math.max(8,left)+'px';
      }catch(e){}
    }

    toggle.addEventListener('click',function(ev){
      ev.stopPropagation();
      if(_openPanel===panel){ _closeOpenPanel(); return; }
      _closeOpenPanel();
      panel.classList.remove('hidden');
      place();
      _openPanel=panel;
    });

    return toggle;
  }

  // Wraps an already-built <input>/<textarea> with a toggle button + a
  // small emoji grid. `el` stays a direct child of the returned
  // wrapper, still reachable by every existing `querySelector('.foo')`
  // lookup keyed on el's own class — callers don't need to change how
  // they find/sync/focus the field afterward.
  function wrap(el){
    const box=document.createElement('div');
    box.className='emoji-picker-field';
    box.appendChild(el);
    attach(el,box);
    return box;
  }

  const api={EMOJI:EMOJI,wrap:wrap,attach:attach};
  try{ window.EmojiPicker=api; }catch(e){}
  return api;
})();
