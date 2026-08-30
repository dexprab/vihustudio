// =============================================================
// VihuStudio — Look What I Made (Sprint LOOK WHAT I MADE, Phase B)
// -------------------------------------------------------------
// The one simple action a creation grows once it exists. Opening
// it shows the child THEIR CREATION first, then exactly four
// doors:
//
//   💌 Share with Parent   — send it to my parent
//   📄 Print Foldable      — make a little story I can fold
//   🃏 Print Story Card    — make a card for my story
//   🎬 Watch               — watch how I made it
//
// Nothing here speaks the adult machinery's language. No email
// vocabulary outside the one "Who should I send it to?" ask (the
// same form the Share Ceremony's sky protection already uses), no
// URLs, no document formats, no code words, no printer settings —
// the browser's own print dialog is the adult's, not part of this
// surface.
//
// The child never says what KIND of thing they made. Phase A
// infers moment / sequence / story from the pages themselves and
// the presentation adapts: a story's foldable holds its pages, a
// moment's foldable holds its MAKING; the hub's own line reads
// "Look what I made" / "Look what happened" / "Read my story".
//
// PREVIEW BEFORE PRINT, ALWAYS. The foldable and the card render
// the exact bitmaps that will print, show them, and only then
// offer the print button — "this is what your story will look
// like when you fold it", never "generate document".
//
// Entry points (Decision 12's celebration is deliberately NOT
// one of them — its two equal choices stay exactly as they are):
//   * the ✨ Look What I Made story action in the header, beside
//     Play My Story and Finish Story, asleep and waking on the
//     same pulse they do
//   * a quiet per-project action on My Projects cards
//
// The snapshot (pages + watch frames) is built once per opening,
// in the background, through Phase A — so the first door a child
// opens may say "getting it ready…" for a breath, and the second
// one is instant.
// =============================================================

const LookWhatIMade=(function(){
  'use strict';

  let _overlay=null,_card=null,_body=null;
  let _ctx=null;           // { record, slides, type, title, name }
  let _payloadPromise=null;
  let _watchTimer=null;

  // ---------- context ----------
  function _activeRecord(){
    try{
      // AppState is a top-level const, so it is the bare identifier
      // or nothing — window.AppState does not exist (the same trap
      // Decision 40 records for EtherFeed).
      const id=(typeof AppState!=='undefined')&&AppState.project&&AppState.project.id;
      if(id&&typeof CreatorProjectStore!=='undefined'){
        const rec=CreatorProjectStore.get(id);
        if(rec) return rec;
      }
      // A project young enough to have never autosaved still has a
      // creation on screen; a lightweight stand-in keeps the hub
      // honest without inventing a store record.
      const titleEl=document.getElementById('bookTitle');
      let name='';
      try{ name=(MagicCard.getActive()||{}).nickname||''; }catch(e){}
      return {
        id:id||null,
        name:(titleEl&&titleEl.value)||'',
        creatorName:name,
        publishedAt:null,
        data:{pages:[]}
      };
    }catch(e){ return null; }
  }

  function _slides(){
    try{ return ((typeof AppState!=='undefined')&&AppState.slides)||[]; }catch(e){ return []; }
  }

  function _buildCtx(){
    const record=_activeRecord();
    if(!record) return null;
    const slides=_slides();
    const type=CreationShare.typeOf(slides);
    const contract=CreationShare.fromRecord(record)||{};
    return {
      record:record,
      slides:slides,
      type:type,
      title:contract.title||'',
      name:contract.creatorName||'',
      publishedAt:record.publishedAt||null
    };
  }

  function _displayTitle(){
    return CreationShare.displayTitle({title:_ctx.title,creationType:_ctx.type});
  }

  // The shareable payload, built once per opening.
  function _payload(){
    if(_payloadPromise) return _payloadPromise;
    _payloadPromise=CreationShare.snapshot(_ctx.record,_ctx.slides)
      .catch(function(){ return null; });
    return _payloadPromise;
  }

  // ---------- DOM ----------
  function _el(tag,cls,text){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    if(text!=null) e.textContent=text;
    return e;
  }

  function _build(){
    if(_overlay) return;
    _overlay=_el('div','lwim-overlay hidden');
    _card=_el('div','lwim-card');
    _card.setAttribute('role','dialog');
    _card.setAttribute('aria-label','Look What I Made');
    const close=_el('button','lwim-close','✕');
    close.type='button';
    close.setAttribute('aria-label','Close');
    close.addEventListener('click',closeHub);
    _body=_el('div','lwim-body');
    _card.appendChild(close);
    _card.appendChild(_body);
    _overlay.appendChild(_card);
    document.body.appendChild(_overlay);
    document.addEventListener('keydown',function(ev){
      if(ev.key==='Escape'&&isOpen()) closeHub();
    });
  }

  function _clearBody(){
    _stopWatch();
    while(_body.firstChild) _body.removeChild(_body.firstChild);
  }

  function _coverImage(){
    const s=_ctx.slides.filter(function(sl){
      const m=sl&&sl.metadata||{};
      return (Array.isArray(m.stickers)&&m.stickers.length)||(m.cardOverrides&&m.cardOverrides.background)||sl.image;
    })[0];
    if(!s) return null;
    if(s.readImage) return s.readImage;
    if(s.thumbnail) return s.thumbnail;
    // A page young enough to have no thumbnail yet still has its own
    // artwork; only an embedded image will do (a vihu-asset: ref is
    // not drawable here).
    if(typeof s.image==='string'&&s.image.indexOf('data:')===0) return s.image;
    return null;
  }

  function _button(label,cls,onClick){
    const b=_el('button','lwim-btn'+(cls?' '+cls:''),label);
    b.type='button';
    b.addEventListener('click',onClick);
    return b;
  }

  function _backRow(){
    const row=_el('div','lwim-back-row');
    row.appendChild(_button('← Back','lwim-btn-quiet',function(){ _showHome(); }));
    return row;
  }

  function _note(text){ return _el('p','lwim-note',text); }

  // ---------- home ----------
  function _showHome(){
    _clearBody();
    const head=_el('div','lwim-head');
    head.appendChild(_el('div','lwim-spark','✨'));
    head.appendChild(_el('h2','lwim-say',CreationShare.says(_ctx.type)));
    const t=_displayTitle();
    if(t) head.appendChild(_el('p','lwim-title',t));
    _body.appendChild(head);

    const preview=_el('div','lwim-preview');
    const cover=_coverImage();
    if(cover){
      const img=_el('img','lwim-preview-img');
      img.src=cover; img.alt=t||'My creation';
      preview.appendChild(img);
    }else{
      preview.appendChild(_el('div','lwim-preview-empty','✦'));
    }
    _body.appendChild(preview);

    const actions=_el('div','lwim-actions');
    actions.appendChild(_button('💌 Share with Parent','',_showShare));
    actions.appendChild(_button('📄 Print Foldable','',_showFoldable));
    actions.appendChild(_button('🃏 Print Story Card','',_showCardView));
    if(typeof MagicReveal!=='undefined'&&MagicReveal.revealStages){
      actions.appendChild(_button('🎬 Watch','',_showWatch));
    }
    _body.appendChild(actions);
  }

  // ---------- share with parent ----------
  function _showShare(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','💌 Share with Parent'));

    const preview=_el('div','lwim-preview lwim-preview-small');
    const cover=_coverImage();
    if(cover){ const img=_el('img','lwim-preview-img'); img.src=cover; img.alt=''; preview.appendChild(img); }
    _body.appendChild(preview);
    _body.appendChild(_el('p','lwim-line','Send this to my parent'));

    const note=_note('');
    const send=_button('Send 💌','lwim-btn-warm',function(){ _doSend(send,note,null); });
    _body.appendChild(send);
    _body.appendChild(note);
  }

  function _doSend(sendBtn,note,email){
    if(sendBtn.disabled) return;
    sendBtn.disabled=true;
    note.textContent='✨ Getting it ready…';
    _payload().then(function(payload){
      if(!payload||!payload.pages.length||!_ctx.record.id){
        sendBtn.disabled=false;
        note.textContent='I couldn’t get it ready just now. Let’s try again in a moment.';
        return;
      }
      note.textContent='Sending it…';
      CreationShareClient.send(_ctx.record.id,payload,email).then(function(res){
        sendBtn.disabled=false;
        if(res&&res.ok){
          note.textContent='';
          _showSent();
          return;
        }
        if(res&&res.reason==='no-recipient'){
          _askWho();
          return;
        }
        // Every other failure is one gentle sentence. Never a
        // status, never a system word, never blame.
        note.textContent='I couldn’t send it right now. Your creation is safe — let’s try again later.';
      });
    });
  }

  function _askWho(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','Who should I send it to?'));

    // The same ask, in the same words, the Share Ceremony already
    // uses for Sky Protection — the one moment the product speaks
    // to a child about an address, reused rather than reinvented.
    const field=_el('div','lwim-field');
    const input=document.createElement('input');
    input.type='email';
    input.className='lwim-input';
    input.placeholder='A grown-up’s email address';
    input.setAttribute('aria-label','A grown-up’s email address');
    input.autocomplete='email';
    field.appendChild(input);
    _body.appendChild(field);

    const note=_note('');
    const send=_button('Send 💌','lwim-btn-warm',function(){
      const value=String(input.value||'').trim();
      const looks=(typeof SkyProtection!=='undefined'&&SkyProtection.looksLikeEmail)
        ? SkyProtection.looksLikeEmail(value)
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
      if(!looks){
        note.textContent='That does not look like an email address yet.';
        input.focus();
        return;
      }
      _doSend(send,note,value);
    });
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); send.click(); }
    });
    _body.appendChild(send);
    _body.appendChild(note);
    input.focus();
  }

  function _showSent(){
    _clearBody();
    _body.appendChild(_el('div','lwim-spark lwim-spark-big','💌'));
    _body.appendChild(_el('h3','lwim-view-title','It’s on its way!'));
    _body.appendChild(_el('p','lwim-line','Your parent will find it soon.'));
    _body.appendChild(_button('✨ Lovely','lwim-btn-warm',function(){ _showHome(); }));
  }

  // ---------- watch ----------
  function _stopWatch(){
    if(_watchTimer){ clearTimeout(_watchTimer); _watchTimer=null; }
  }

  function _showWatch(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','🎬 Watch how I made it'));
    const stage=_el('div','lwim-watch-stage');
    const img=_el('img','lwim-watch-img');
    stage.appendChild(img);
    _body.appendChild(stage);
    const note=_note('✨ Getting it ready…');
    _body.appendChild(note);

    _payload().then(function(payload){
      if(!isOpen()) return;
      const frames=(payload&&payload.watch&&payload.watch.length)
        ? payload.watch
        : (payload&&payload.pages||[]).map(function(p){ return {image:p.image,holdMs:1400}; });
      if(!frames.length){
        note.textContent='There is nothing to watch just yet.';
        return;
      }
      note.textContent='';
      let i=0;
      function step(){
        if(!isOpen()) return;
        const f=frames[i];
        img.src=f.image;
        img.classList.remove('lwim-watch-arrive');
        void img.offsetWidth; // restart the little arrival
        img.classList.add('lwim-watch-arrive');
        i++;
        if(i<frames.length){
          _watchTimer=setTimeout(step,Math.max(350,Math.min(3200,f.holdMs||900)));
        }else{
          _watchTimer=null;
          const again=_button('▶ Watch again','lwim-btn-quiet',function(){
            again.remove(); i=0; step();
          });
          note.appendChild(again);
        }
      }
      step();
    });
  }

  // ---------- print plumbing ----------
  function _print(images,kind){
    const sheet=_el('div','lwim-print-sheet lwim-print-'+kind);
    images.forEach(function(src){
      const img=document.createElement('img');
      img.src=src;
      sheet.appendChild(img);
    });
    // The page's orientation belongs to the thing being printed —
    // injected for this one print and removed after, so the Magic
    // Card's own portrait printing is never re-oriented.
    const style=document.createElement('style');
    style.textContent=(kind==='foldable')
      ? '@media print{ @page{ size: landscape; margin: 0.25in; } }'
      : '@media print{ @page{ size: portrait; margin: 0.5in; } }';
    document.body.appendChild(style);
    document.body.appendChild(sheet);
    function cleanup(){
      try{ sheet.remove(); }catch(e){}
      try{ style.remove(); }catch(e){}
      window.removeEventListener('afterprint',cleanup);
    }
    window.addEventListener('afterprint',cleanup);
    // img.decode() before print — the Magic Card's own measured
    // race ("two blank placeholder rectangles"), not repeated here.
    function ready(img){
      if(typeof img.decode==='function') return img.decode().catch(function(){});
      return new Promise(function(resolve){
        if(img.complete) resolve();
        else img.addEventListener('load',resolve,{once:true});
      });
    }
    return Promise.all(Array.prototype.map.call(sheet.querySelectorAll('img'),ready)).then(function(){
      window.print();
      setTimeout(cleanup,5000);
    });
  }

  // ---------- foldable ----------
  function _showFoldable(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','📄 Make a Foldable'));
    const note=_note('✨ Getting it ready…');
    _body.appendChild(note);

    _payload().then(function(payload){
      if(!isOpen()) return;
      if(!payload||!payload.pages.length){
        note.textContent='I couldn’t get it ready just now. Let’s try again in a moment.';
        return;
      }
      FoldableComposer.compose(payload).then(function(made){
        if(!isOpen()) return;
        note.textContent='';
        const preview=_el('div','lwim-sheet-preview');
        const img=_el('img','lwim-sheet-img');
        img.src=made.sheet;
        img.alt='Your foldable';
        preview.appendChild(img);
        _body.appendChild(preview);
        _body.appendChild(_el('p','lwim-line','This is what your story will look like. Cut the little ✂ line, fold it, and it becomes a tiny book.'));
        if(made.note) _body.appendChild(_note(made.note));
        _body.appendChild(_button('Print My Foldable 📄','lwim-btn-warm',function(){
          _print([made.sheet],'foldable');
        }));
      });
    });
  }

  // ---------- story card ----------
  function _showCardView(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','🃏 Make a Story Card'));
    const note=_note('✨ Getting it ready…');
    _body.appendChild(note);

    _payload().then(function(payload){
      if(!isOpen()) return;
      if(!payload||!payload.pages.length||!_ctx.record.id){
        note.textContent='I couldn’t get it ready just now. Let’s try again in a moment.';
        return;
      }
      // The card's door is the creation's own stable share — minted
      // (or refreshed) before the back can be drawn, because a card
      // whose door goes nowhere must never be printed.
      CreationShareClient.mint(_ctx.record.id,payload).then(function(res){
        if(!isOpen()) return;
        if(!res||!res.ok||!res.url){
          note.textContent='I couldn’t make the card’s magic door right now. Let’s try again later.';
          return;
        }
        StoryCardComposer.compose(payload,res.url).then(function(made){
          if(!isOpen()) return;
          if(!made||!made.ok){
            note.textContent='I couldn’t make the card’s magic door right now. Let’s try again later.';
            return;
          }
          note.textContent='';
          const pair=_el('div','lwim-card-pair');
          const front=_el('img','lwim-card-img'); front.src=made.front; front.alt='The front of your card';
          const back=_el('img','lwim-card-img');  back.src=made.back;   back.alt='The back of your card';
          pair.appendChild(front); pair.appendChild(back);
          _body.appendChild(pair);
          _body.appendChild(_el('p','lwim-line','Give it to someone. When they point a phone at the little square of stars, your creation opens for them in VihuPlanet.'));
          _body.appendChild(_button('Print My Card 🃏','lwim-btn-warm',function(){
            _print([made.front,made.back],'card');
          }));
        });
      });
    });
  }

  // ---------- open / close ----------
  function openHub(){
    const ctx=_buildCtx();
    if(!ctx) return false;
    _ctx=ctx;
    _payloadPromise=null;
    _build();
    _showHome();
    _overlay.classList.remove('hidden');
    // Warm the snapshot while the child reads the home view, so
    // the first door they open is nearly ready.
    try{ _payload(); }catch(e){}
    return true;
  }

  function closeHub(){
    _stopWatch();
    if(_overlay) _overlay.classList.add('hidden');
    _payloadPromise=null;
    _ctx=null;
  }

  function isOpen(){
    return !!(_overlay&&!_overlay.classList.contains('hidden'));
  }

  const api={ open:openHub, close:closeHub, isOpen:isOpen };
  try{ window.LookWhatIMade=api; }catch(e){}
  return api;
})();
