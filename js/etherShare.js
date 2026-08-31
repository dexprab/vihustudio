// =============================================================
// VihuPlanet — Ether Share (Sprint LOOK WHAT I MADE 1.2)
// -------------------------------------------------------------
// A story met in the Ether can be sent onwards and printed —
// asked for by the product owner: "can you add these share
// options on ether stories also. email, print foldable and
// print story card."
//
// THE SAME SYSTEM, NOT A SECOND ONE. The letter goes through the
// existing creation-share Edge Function; the prints go through
// the SAME FoldableComposer / StoryCardComposer the Studio hub
// and the landing already use. What differs is only where the
// pages come from (the shared feed's own baked images — a story
// in the Ether is public by construction, Decision 15) and which
// door the paper carries:
//
//   * A child's OWN creation shares an opaque token, never a
//     project id (Decision 52) — that rule protects an UNSHARED
//     creation. A story in the Ether already has a public deep
//     link, `?story=<projectId>`, which Decision 9 made THE
//     shareable address years of builds ago. So the printed QR
//     here encodes that door: the paper opens the story living
//     in the universe, as a Spirit, for anyone. No mint, no
//     upload, no network needed to print.
//
//   * The LETTER does need the platform (something has to post
//     it), so the send door mints a share under the viewer's own
//     session from the same public material and mails the
//     existing letter. Always `once:true` and never an
//     identity write — sharing somebody's story onwards must
//     never store anything on anybody's card.
//
// It is an overlay on the living Ether (the Decision 21 shape):
// the universe carries on behind it, and closing costs nothing.
// The overlay never says email, URL, QR, token or link — the one
// exception is the established "Who should I send it to?" ask.
// =============================================================

const EtherShare=(function(){
  'use strict';

  // The canonical public door (Decision 28: canonical URLs say
  // vihuplanet.com — the printed paper outlives any test server).
  const ETHER_DOOR='https://vihuplanet.com/?story=';
  const IMAGE_RE=/^data:image\/(?:jpeg|png);base64,/;
  const MAX_PAGES=24, MAX_IMAGE=900000;

  let _overlay=null,_body=null,_sub=null;
  let _ctx=null;          // { pid, payload }
  let _plain=false;       // ☀️ paper choice, per opening
  let _seq=0;             // stale composes never paint

  // ---------- payload ----------
  // Assembled from what the Ether already shows: the feed's page
  // images, the story's name, its maker. Nothing else exists here
  // to leak — no card, no memory, no session material — and the
  // server's sweep refuses anything unexpected anyway.
  function _validImage(src){
    return typeof src==='string'&&IMAGE_RE.test(src)&&src.length<=MAX_IMAGE;
  }
  function _assemble(pid,meta){
    const pages=[],plain=[];
    (meta.pages||[]).forEach(function(src,i){
      if(pages.length>=MAX_PAGES||!_validImage(src)) return;
      pages.push({image:src});
      // The ☀️ plain render of the SAME page (1.2.1), stamped by the
      // share ceremony. Kept aligned by index, so a filtered page
      // can never shift somebody else's plain render under this one.
      const p=(meta.pagesPlain||[])[i];
      plain.push(_validImage(p)?{image:p}:null);
    });
    if(!pages.length) return null;
    const payload={
      v:1,
      type:pages.length>1?'story':'moment',
      title:String(meta.title||'').slice(0,120),
      creatorName:String(meta.creator||'').slice(0,60),
      pages:pages,
      madeIn:'vihuplanet',
      ether:pid
    };
    // All or nothing: a book that is plain on some pages and night
    // on others is neither thing. Carried in the letter's payload
    // too, so the landing's kind printing gets the full plain sheet.
    if(plain.length&&plain.every(function(p){ return !!p; })){
      payload.pagesPlain=plain;
    }
    return payload;
  }

  function available(meta){
    return !!_assemble('x',meta||{});
  }

  // ---------- DOM ----------
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
    _overlay=_el('div','ether-share');
    _overlay.hidden=true;
    const veil=_el('div','ether-share-veil');
    veil.addEventListener('click',close);
    const panel=_el('div','ether-share-panel');
    panel.appendChild(_el('h3','ether-share-title','Share this story'));
    _sub=_el('p','ether-share-sub','');
    panel.appendChild(_sub);
    _body=_el('div','ether-share-body');
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
  function _note(text){ return _el('p','ether-share-note',text); }

  // ---------- home: the three doors ----------
  function _home(){
    _clear();
    _body.appendChild(_button('💌 Send it to someone','ether-share-door',_send));
    _body.appendChild(_button('📄 Print a little book','ether-share-door',function(){ _print('foldable'); }));
    _body.appendChild(_button('🃏 Print a little card','ether-share-door',function(){ _print('card'); }));
    _body.appendChild(_button('Back','ether-share-quiet',close));
  }

  // ---------- 💌 send ----------
  function _send(){
    _clear();
    _body.appendChild(_el('p','ether-share-ask','Who should I send it to?'));
    const input=_el('input','ether-share-input');
    input.type='email';
    input.placeholder='A grown-up’s email address';
    _body.appendChild(input);
    const note=_note('');
    const row=_el('div','ether-share-row');
    const sendBtn=_button('Send ✨','ether-share-go',function(){
      const addr=String(input.value||'').trim();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)){
        note.textContent='That address doesn’t look finished yet.';
        return;
      }
      sendBtn.disabled=true;
      note.textContent='✨ Sending it on its way…';
      if(typeof CreationShareClient==='undefined'||!CreationShareClient.send){
        sendBtn.disabled=false;
        note.textContent='It couldn’t fly just now. The story is right here, though.';
        return;
      }
      // once:true always — sharing a story onwards is a destination
      // choice, and it must never store an address on anybody's card.
      CreationShareClient.send(_ctx.pid,_ctx.payload,addr,{once:true}).then(function(res){
        if(res&&res.ok){
          _clear();
          _body.appendChild(_el('p','ether-share-ask','It’s on its way! ✨'));
          _body.appendChild(_button('Back','ether-share-quiet',_home));
        }else{
          sendBtn.disabled=false;
          note.textContent='It couldn’t fly just now. The story is right here, though.';
        }
      });
    });
    row.appendChild(sendBtn);
    row.appendChild(_button('Back','ether-share-quiet',_home));
    _body.appendChild(row);
    _body.appendChild(note);
    input.focus();
  }

  // ---------- 📄 🃏 print ----------
  // Preview before print, always — and ☀️ Plain paper beside the
  // print button ("kind printing should be everywhere where there
  // is print option"). Where the record carries the share ceremony's
  // own plain renders (readImagePlain → payload.pagesPlain, 1.2.1)
  // the plain print is the FULL plain print — plain pages, plain
  // chrome. An older story without them still gets the composers'
  // paper palette: everything the paper itself draws goes to ink,
  // and the pages print as the universe holds them.
  function _shareForPrint(){
    if(_plain&&_ctx.payload.pagesPlain){
      return Object.assign({},_ctx.payload,{pages:_ctx.payload.pagesPlain});
    }
    return _ctx.payload;
  }
  function _print(kind){
    _clear();
    _body.appendChild(_el('p','ether-share-ask',
      kind==='foldable'?'A foldable little book':'A little card to give away'));
    const imgs=_el('div','ether-share-imgs');
    _body.appendChild(imgs);
    const note=_note('✨ Getting it ready…');
    _body.appendChild(note);
    const row=_el('div','ether-share-row');
    const go=_button('🖨 Print','ether-share-go',function(){});
    go.disabled=true;
    row.appendChild(go);
    row.appendChild(_button(
      _plain?'🌈 Bring the colours back':'☀️ Plain paper — kind to the printer',
      'ether-share-quiet',
      function(){ _plain=!_plain; _print(kind); }));
    row.appendChild(_button('Back','ether-share-quiet',_home));
    _body.appendChild(row);

    const door=ETHER_DOOR+encodeURIComponent(_ctx.pid);
    const share=_shareForPrint();
    const seq=++_seq;
    const work=(kind==='foldable')
      ? ((typeof FoldableComposer!=='undefined'&&FoldableComposer.compose)
          ? FoldableComposer.compose(share,{cardUrl:door,plain:_plain})
          : Promise.resolve(null))
      : ((typeof StoryCardComposer!=='undefined'&&StoryCardComposer.compose)
          ? StoryCardComposer.compose(share,door,{plain:_plain})
          : Promise.resolve(null));
    work.then(function(made){
      if(seq!==_seq) return;
      let sheets;
      if(kind==='foldable'){
        sheets=(made&&made.sheet)?(made.guide?[made.sheet,made.guide]:[made.sheet]):null;
      }else{
        sheets=(made&&made.ok)?[made.front,made.back]:null;
      }
      if(!sheets){
        note.textContent='This can’t be made just now — the story is right here, though.';
        return;
      }
      sheets.forEach(function(src){
        const im=document.createElement('img'); im.src=src;
        imgs.appendChild(im);
      });
      note.textContent=(kind==='foldable')
        ? 'One sheet, printed the wide way — the how-to-fold page prints with it.'
        : 'Front and back. Give it to someone — pointing a phone at the little square of stars opens the story.';
      go.disabled=false;
      go.addEventListener('click',function(){ _printSheets(sheets,kind); });
    }).catch(function(){
      if(seq!==_seq) return;
      note.textContent='This can’t be made just now — the story is right here, though.';
    });
  }

  // The landing's own print plumbing, one surface along: the sheet
  // carries the full-resolution bitmaps just previewed, decoded
  // before print, and the page orientation belongs to the thing
  // being printed.
  function _printSheets(images,kind){
    const sheet=_el('div','ether-print-sheet');
    images.forEach(function(src){
      const im=document.createElement('img'); im.src=src;
      sheet.appendChild(im);
    });
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
    Promise.all(Array.prototype.map.call(sheet.querySelectorAll('img'),function(img){
      if(typeof img.decode==='function') return img.decode().catch(function(){});
      return new Promise(function(res){
        if(img.complete) res();
        else img.addEventListener('load',res,{once:true});
      });
    })).then(function(){
      window.print();
      setTimeout(cleanup,5000);
    });
  }

  // ---------- open / close ----------
  function open(pid,meta){
    const payload=_assemble(pid,meta||{});
    if(!payload) return false;
    _build();
    _ctx={ pid:pid, payload:payload };
    _plain=false;
    _sub.textContent=payload.title?('“'+payload.title+'”'):'';
    _home();
    _overlay.hidden=false;
    return true;
  }

  function close(){
    if(_overlay) _overlay.hidden=true;
    _ctx=null;
    _seq++;
  }

  const api={ open:open, close:close, available:available };
  try{ window.EtherShare=api; }catch(e){}
  return api;
})();
