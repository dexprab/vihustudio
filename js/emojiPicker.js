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
  function wrap(el){
    const box=document.createElement('div');
    box.className='emoji-picker-field';
    box.appendChild(el);

    const toggle=document.createElement('button');
    toggle.type='button';
    toggle.className='emoji-picker-toggle';
    toggle.textContent='😊';
    toggle.setAttribute('aria-label','Insert emoji');
    box.appendChild(toggle);

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
    box.appendChild(panel);

    toggle.addEventListener('click',function(ev){
      ev.stopPropagation();
      if(_openPanel===panel){ _closeOpenPanel(); return; }
      _closeOpenPanel();
      panel.classList.remove('hidden');
      _openPanel=panel;
    });

    return box;
  }

  const api={EMOJI:EMOJI,wrap:wrap};
  try{ window.EmojiPicker=api; }catch(e){}
  return api;
})();
