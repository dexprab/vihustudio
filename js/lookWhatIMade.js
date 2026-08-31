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
  let _plainPayloadPromise=null; // the same creation, on white paper
  let _playback=null;      // the CreationPlayback controller, if playing
  let _foldCardUrl=null;   // the foldable's minted door, for recomposes
  let _foldPlain=false;    // ☀️ plain paper, for a printer with no colour
  let _cardPlain=false;    // the Story Card's own paper choice

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
  function _savedParent(){
    try{
      return (typeof SkyProtection!=='undefined'&&SkyProtection.parentEmail&&SkyProtection.parentEmail())||'';
    }catch(e){ return ''; }
  }

  function _looksLikeEmail(value){
    try{
      if(typeof SkyProtection!=='undefined'&&SkyProtection.looksLikeEmail) return SkyProtection.looksLikeEmail(value);
    }catch(e){}
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value||'').trim());
  }

  // The child sees WHERE it is going before anything goes (Sprint
  // 1.1 §6). The saved grown-up address shows automatically; ✏️
  // Edit chooses a destination for THIS SHARE ONLY — it is "Send
  // this to…", never "change parent email": nothing here writes
  // the saved address, and the next share defaults to it again.
  function _showShare(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','💌 Share with Parent'));

    const preview=_el('div','lwim-preview lwim-preview-small');
    const cover=_coverImage();
    if(cover){ const img=_el('img','lwim-preview-img'); img.src=cover; img.alt=''; preview.appendChild(img); }
    _body.appendChild(preview);

    const saved=_savedParent();
    if(!saved){
      // Nobody known on this device: the server may still know the
      // card's own address (another device gave it) — press once
      // and find out, exactly as before.
      _body.appendChild(_el('p','lwim-line','Send this to my parent'));
      const note=_note('');
      const send=_button('Send 💌','lwim-btn-warm',function(){ _doSend(send,note,null); });
      _body.appendChild(send);
      _body.appendChild(note);
      return;
    }

    // The address is a FIELD, not a chip with an Edit beside it —
    // asked for from real use: one less press, and the field itself
    // says it can be changed. Typing a different address is still a
    // one-time destination; the saved address is untouched and is
    // the next share's default.
    _body.appendChild(_el('p','lwim-line','Send this to:'));
    const dest=_el('div','lwim-dest');
    const input=document.createElement('input');
    input.type='email';
    input.className='lwim-input';
    input.value=saved;
    input.setAttribute('aria-label','Send this to');
    input.autocomplete='email';
    dest.appendChild(input);
    _body.appendChild(dest);

    const note=_note('');
    const send=_button('Send 💌','lwim-btn-warm',function(){
      const value=String(input.value||'').trim();
      if(!_looksLikeEmail(value)){
        note.textContent='That does not look like an email address yet.';
        input.focus();
        return;
      }
      // The typed address is this share's destination and nothing
      // more; the saved one, unchanged, is not an override at all.
      const override=(value!==saved)?value:null;
      _doSend(send,note,override,!!override);
    });
    input.addEventListener('keydown',function(ev){
      if(ev.key==='Enter'){ ev.preventDefault(); send.click(); }
    });
    _body.appendChild(send);
    _body.appendChild(note);
  }

  function _doSend(sendBtn,note,email,once){
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
      CreationShareClient.send(_ctx.record.id,payload,email,once?{once:true}:null).then(function(res){
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
  // One continuous magical making, through CreationPlayback: every
  // frame decoded before the first shows, one stable stage for the
  // whole replay, crossfades rather than swaps, and the shared
  // music bed for as long as the experience is open. Leaving the
  // view (or the hub) destroys the controller, which is what stops
  // the music — it never runs underneath anything else.
  function _stopWatch(){
    if(_playback){ try{ _playback.destroy(); }catch(e){} _playback=null; }
  }

  function _showWatch(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','🎬 Watch how I made it'));
    const stage=_el('div','lwim-watch-stage');
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
      if(typeof CreationPlayback==='undefined'){
        // The player missing must never strand the child — the
        // finished creation still shows, plainly.
        const img=_el('img','lwim-watch-img');
        img.src=frames[frames.length-1].image;
        stage.appendChild(img);
        note.textContent='';
        return;
      }
      _playback=CreationPlayback.mount(stage,{
        frames:frames,
        onDone:function(){
          if(!isOpen()) return;
          note.textContent='';
          const again=_button('▶ Watch again','lwim-btn-quiet',function(){
            again.remove();
            note.textContent='';
            if(_playback) _playback.replay();
          });
          note.appendChild(again);
        }
      });
      _playback.play().then(function(ok){
        if(!isOpen()) return;
        if(ok) note.textContent='';
        else note.textContent='There is nothing to watch just yet.';
      });
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
  // Three beats (Sprint 1.1 §3): the OPEN sheet, the FOLD, and the
  // FINISHED little book the child would actually hold — because a
  // printable sheet alone does not answer "what will my story look
  // like when I fold it?". The Story Card rides the same sheet as a
  // tear-off strip whenever its door can be minted (§4), so one
  // print is the whole physical journey: read the little book, cut
  // the card off, give it to someone.
  function _reducedMotion(){
    try{ return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch(e){ return false; }
  }

  // The same creation, rendered on white paper for a printer with
  // no colour — asked for from real use ("if its black and white
  // print can we remove the bg color of slides?"). Built through
  // the identical snapshot pipeline with {plain:true}; never used
  // for SHARING, only for paper.
  function _payloadPlain(){
    if(_plainPayloadPromise) return _plainPayloadPromise;
    _plainPayloadPromise=CreationShare.snapshot(_ctx.record,_ctx.slides,{plain:true})
      .catch(function(){ return null; });
    return _plainPayloadPromise;
  }

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
      // The card's door first — without one the sheet simply has no
      // card strip, never a card that opens onto nothing.
      const mint=_ctx.record.id
        ? CreationShareClient.mint(_ctx.record.id,payload)
        : Promise.resolve(null);
      mint.then(function(res){
        if(!isOpen()) return;
        _foldCardUrl=(res&&res.ok&&res.url)?res.url:null;
        _composeFold();
      });
    });
  }

  // Compose (or recompose, when the paper choice flips) and show the
  // view the child was standing in — the open sheet, or the folded
  // book when the choice was made after folding. The preview is
  // always the exact sheet that prints — preview-before-print holds
  // through the toggle by construction.
  function _composeFold(returnTo){
    const src=_foldPlain?_payloadPlain():_payload();
    src.then(function(payload){
      if(!isOpen()) return;
      if(!payload||!payload.pages.length){
        _foldableHeader();
        _body.appendChild(_note('I couldn’t get it ready just now. Let’s try again in a moment.'));
        return;
      }
      FoldableComposer.compose(payload,{cardUrl:_foldCardUrl,plain:_foldPlain}).then(function(made){
        if(!isOpen()) return;
        if(returnTo==='folded') _foldableFolded(made);
        else _foldableOpenSheet(made);
      });
    });
  }

  // The ☀️ paper choice, offered wherever a print button is — the
  // open sheet AND the folded book (asked for: "add kind printing on
  // the screen post fold it button").
  function _paperToggleBtn(returnTo){
    return _button(
      _foldPlain?'🌈 Bring the colours back':'☀️ Plain paper — kind to the printer',
      'lwim-btn-quiet lwim-paper-toggle',
      function(){
        _foldPlain=!_foldPlain;
        _foldableHeader();
        _body.appendChild(_note('✨ Getting it ready…'));
        _composeFold(returnTo);
      });
  }

  function _foldableHeader(){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','📄 Make a Foldable'));
  }

  function _printFoldableBtn(made,cls){
    return _button('Print My Foldable 📄',cls,function(){
      // The sheet AND its how-to-fold page — the paper has to teach
      // the fold to whoever ends up folding it (1.1.3).
      _print(made.guide?[made.sheet,made.guide]:[made.sheet],'foldable');
    });
  }

  // Step 1 — the open sheet, exactly as it will print.
  function _foldableOpenSheet(made){
    _foldableHeader();
    const preview=_el('div','lwim-sheet-preview');
    const img=_el('img','lwim-sheet-img');
    img.src=made.sheet;
    img.alt='Your foldable, open';
    preview.appendChild(img);
    _body.appendChild(preview);
    _body.appendChild(_el('p','lwim-line',
      made.card
        ? 'This one sheet is your whole story — and your Story Card is on it too.'
        : 'This one sheet is your whole story.'));
    if(made.note) _body.appendChild(_note(made.note));
    _body.appendChild(_button('Fold it ✨','lwim-btn-warm',function(){
      if(_reducedMotion()) _foldableFolded(made);
      else _foldableFolding(made,img,preview);
    }));
    _body.appendChild(_printFoldableBtn(made,'lwim-btn-quiet'));
    // The paper choice, previewed like everything else here: white
    // pages for a printer with no colour in it.
    _body.appendChild(_paperToggleBtn('open'));
  }

  // How the paper becomes the book — small pictures, few words,
  // asked for from real use ("kid might want to see how to fold").
  // The drawings are the COMPOSER'S own (FoldableComposer.FOLD_STEPS)
  // — the same strings the printed guide page rasters, so the screen
  // and the paper can never teach two different folds.
  function _howToFold(made){
    const wrap=_el('div','lwim-howfold');
    wrap.appendChild(_el('h4','lwim-howfold-title','How to fold it'));
    const row=_el('div','lwim-howfold-row');
    const steps=FoldableComposer.FOLD_STEPS(!!made.card);
    steps.forEach(function(step){
      const cell=_el('div','lwim-howfold-step');
      const pic=_el('div','lwim-howfold-pic');
      pic.innerHTML='<svg viewBox="0 0 90 64" width="90" height="64" aria-hidden="true">'+step.svg+'</svg>';
      cell.appendChild(pic);
      cell.appendChild(_el('div','lwim-howfold-words',step.words));
      row.appendChild(cell);
    });
    wrap.appendChild(row);
    return wrap;
  }

  // Step 2 — the same sheet, folding. The animation runs on the
  // exact bitmap the child was just looking at, then hands over to
  // the folded book. Never under reduced motion.
  function _foldableFolding(made,img,preview){
    preview.classList.add('lwim-fold-perspective');
    img.classList.add('lwim-folding');
    let done=false;
    function finish(){
      if(done) return; done=true;
      if(!isOpen()) return;
      _foldableFolded(made);
    }
    img.addEventListener('animationend',finish,{once:true});
    setTimeout(finish,2100); // the animation's own length plus grace
  }

  // Step 3 — the finished little book, as the child would hold it.
  // Tapping it turns its pages, in reading order, upright — the
  // panels are the composer's own upright bitmaps, so what flips
  // here is exactly what the folded paper will show.
  function _foldableFolded(made){
    _foldableHeader();
    const panels=made.panels||[];
    let idx=0;

    const book=_el('div','lwim-book');
    book.setAttribute('role','button');
    book.setAttribute('tabindex','0');
    book.setAttribute('aria-label','Your little book — turn the page');
    const pageImg=_el('img','lwim-book-page');
    if(panels[0]) pageImg.src=panels[0].image;
    pageImg.alt='Your little book';
    book.appendChild(pageImg);
    _body.appendChild(book);

    const caption=_el('p','lwim-line','Your little book! Tap it to turn the pages.');
    _body.appendChild(caption);

    function turn(){
      if(!panels.length) return;
      idx=(idx+1)%panels.length;
      pageImg.src=panels[idx].image;
      pageImg.classList.remove('lwim-book-turn');
      void pageImg.offsetWidth;
      pageImg.classList.add('lwim-book-turn');
    }
    book.addEventListener('click',turn);
    book.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); turn(); }
    });

    if(made.card&&made.cardFront){
      const row=_el('div','lwim-book-card-row');
      const cardImg=_el('img','lwim-book-card');
      cardImg.src=made.cardFront;
      cardImg.alt='Your Story Card';
      row.appendChild(cardImg);
      row.appendChild(_el('p','lwim-line','Your Story Card is on the sheet too — cut it off and give it to someone.'));
      _body.appendChild(row);
    }

    _body.appendChild(_howToFold(made));
    _body.appendChild(_printFoldableBtn(made,'lwim-btn-warm'));
    // The paper choice lives beside BOTH print buttons — a child who
    // folded first should not have to walk back to choose the paper.
    _body.appendChild(_paperToggleBtn('folded'));
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
        _renderCardView(res.url);
      });
    });
  }

  // Rendered (and re-rendered when the ☀️ paper choice flips) with
  // the door already minted. The plain card draws from the plain
  // payload too, so its front carries the white-paper page.
  function _renderCardView(url){
    _clearBody();
    _body.appendChild(_backRow());
    _body.appendChild(_el('h3','lwim-view-title','🃏 Make a Story Card'));
    const note=_note('✨ Getting it ready…');
    _body.appendChild(note);

    const src=_cardPlain?_payloadPlain():_payload();
    src.then(function(payload){
      if(!isOpen()||!payload) return;
      StoryCardComposer.compose(payload,url,{plain:_cardPlain}).then(function(made){
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
        _body.appendChild(_el('p','lwim-line','Give this to someone!'));
        // What the card DOES, shown as three little beats — magic,
        // never mechanism (Sprint 1.1 §5).
        const demo=_el('div','lwim-demo');
        [['🃏','Give it'],['📱','They point a phone at it'],['✨','Your creation opens']]
          .forEach(function(beat,i){
            if(i) demo.appendChild(_el('span','lwim-demo-arrow','→'));
            const step=_el('span','lwim-demo-step');
            step.appendChild(_el('span','lwim-demo-glyph',beat[0]));
            step.appendChild(_el('span','lwim-demo-word',beat[1]));
            demo.appendChild(step);
          });
        _body.appendChild(demo);
        _body.appendChild(_note('It is on your foldable sheet as well, ready to cut off.'));
        _body.appendChild(_button('Print My Card 🃏','lwim-btn-warm',function(){
          _print([made.front,made.back],'card');
        }));
        // The same ☀️ paper choice the foldable offers, previewed
        // the same way: the card just shown is the card that prints.
        _body.appendChild(_button(
          _cardPlain?'🌈 Bring the colours back':'☀️ Plain paper — kind to the printer',
          'lwim-btn-quiet lwim-paper-toggle',
          function(){
            _cardPlain=!_cardPlain;
            _renderCardView(url);
          }));
      });
    });
  }

  // ---------- open / close ----------
  function openHub(){
    const ctx=_buildCtx();
    if(!ctx) return false;
    _ctx=ctx;
    _payloadPromise=null;
    _plainPayloadPromise=null;
    _foldCardUrl=null;
    _foldPlain=false;
    _cardPlain=false;
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
    _plainPayloadPromise=null;
    _foldCardUrl=null;
    _foldPlain=false;
    _cardPlain=false;
    _ctx=null;
  }

  function isOpen(){
    return !!(_overlay&&!_overlay.classList.contains('hidden'));
  }

  const api={ open:openHub, close:closeHub, isOpen:isOpen };
  try{ window.LookWhatIMade=api; }catch(e){}
  return api;
})();
