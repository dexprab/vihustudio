// =============================================================
// VihuStudio — Story Card Composer (Sprint LOOK WHAT I MADE)
// -------------------------------------------------------------
// A creation as a card a child can hand to somebody. Front: the
// creation, its name, the maker. Back: whose it is, and the door
// back into VihuPlanet — a QR code carrying the creation's own
// share link.
//
// THE QR CODE IS NOT THE PRODUCT. The child's experience is "my
// card comes alive": someone points a phone at it and the exact
// creation opens. So nothing child-facing here says QR, scan,
// code or link — the back says "Come see it in VihuPlanet", and
// the square of stars simply works. The code encodes the OPAQUE
// share token URL (look.html?t=…), never a project id: the same
// stable token the letter carries, so a card printed in March
// still opens in June.
//
// The encoder is vendored bwip-js (js/vendor/ — MIT), loaded
// LAZILY the first time a card is composed: it is ~1 MB and only
// this screen needs it. Without it (file missing, load refused)
// compose() answers { ok:false } and the hub says, gently, that
// the card can't be made right now — never a broken half-card,
// and never a card whose door goes nowhere.
//
// Card size matches the Magic Card's own printed card: 2.5in ×
// 3.5in, composed at 300dpi. The preview and the printed sheet
// are the SAME bitmaps, so what the child sees is what the
// printer makes.
// =============================================================

const StoryCardComposer=(function(){
  'use strict';

  const CARD_W=750, CARD_H=1050; // 2.5in × 3.5in @ 300dpi
  const VENDOR='js/vendor/bwip-js-min.js';

  let _bwipPromise=null;

  function _ensureBwip(){
    if(typeof bwipjs!=='undefined') return Promise.resolve(true);
    if(_bwipPromise) return _bwipPromise;
    _bwipPromise=new Promise(function(resolve){
      try{
        const el=document.createElement('script');
        // Resolved from the page root — both studio.html and
        // index.html live there, the same reasoning
        // supabase-config.json's own loaders use.
        el.src=VENDOR;
        el.onload=function(){ resolve(typeof bwipjs!=='undefined'); };
        el.onerror=function(){ _bwipPromise=null; resolve(false); };
        document.head.appendChild(el);
      }catch(e){ _bwipPromise=null; resolve(false); }
    });
    return _bwipPromise;
  }

  function _blank(w,h){
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    return c;
  }

  function _loadImage(src){
    return new Promise(function(resolve){
      if(!src) return resolve(null);
      const img=new Image();
      img.onload=function(){ resolve(img); };
      img.onerror=function(){ resolve(null); };
      img.src=src;
    });
  }

  const NIGHT_TOP='#141a33', NIGHT_BOTTOM='#232c54';
  const GOLD='#e8c476';
  const CREAM='#f4efe2';

  function _night(ctx,w,h){
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,NIGHT_TOP); g.addColorStop(1,NIGHT_BOTTOM);
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // A calm scatter of small stars — seeded by position, so the
    // same card composes identically every time (a reprint is the
    // same card, not a variant).
    ctx.fillStyle='rgba(238,241,255,0.55)';
    for(let i=0;i<46;i++){
      const x=((i*97)%w), y=((i*211)%h), r=(i%3===0)?2.4:1.4;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }

  function _frame(ctx,w,h){
    ctx.strokeStyle='rgba(232,196,118,0.85)';
    ctx.lineWidth=5;
    ctx.strokeRect(22,22,w-44,h-44);
  }

  function _wrap(ctx,text,x,y,maxW,lineH){
    const words=String(text||'').split(/\s+/);
    let line='';
    words.forEach(function(word){
      const probe=line?line+' '+word:word;
      if(ctx.measureText(probe).width>maxW&&line){
        ctx.fillText(line,x,y); y+=lineH; line=word;
      }else line=probe;
    });
    if(line) ctx.fillText(line,x,y);
    return y;
  }

  function _title(share){
    return (typeof CreationShare!=='undefined'&&CreationShare.displayTitle)
      ? CreationShare.displayTitle({title:share.title,creationType:share.type})
      : (share.title||'Something I Made');
  }

  function _drawFront(share,img){
    const c=_blank(CARD_W,CARD_H);
    const ctx=c.getContext('2d');
    _night(ctx,CARD_W,CARD_H);

    if(img){
      const boxX=75,boxY=110,boxW=CARD_W-150,boxH=520;
      const s=Math.min(boxW/img.width,boxH/img.height);
      const w=img.width*s,h=img.height*s;
      const x=boxX+(boxW-w)/2,y=boxY+(boxH-h)/2;
      ctx.save();
      ctx.fillStyle=CREAM;
      ctx.fillRect(x-10,y-10,w+20,h+20);
      ctx.drawImage(img,x,y,w,h);
      ctx.restore();
    }else{
      ctx.fillStyle='rgba(238,241,255,0.8)';
      ctx.font='120px serif';
      ctx.textAlign='center';
      ctx.fillText('✨',CARD_W/2,420);
    }

    ctx.fillStyle=CREAM;
    ctx.textAlign='center';
    ctx.font='700 58px Georgia, serif';
    const after=_wrap(ctx,_title(share).toUpperCase(),CARD_W/2,760,CARD_W-160,68);
    if(share.creatorName){
      ctx.fillStyle=GOLD;
      ctx.font='italic 44px Georgia, serif';
      ctx.fillText('— '+share.creatorName,CARD_W/2,Math.min(CARD_H-140,after+90));
    }
    _frame(ctx,CARD_W,CARD_H);
    return c;
  }

  function _drawBack(share,url,qrOk){
    const c=_blank(CARD_W,CARD_H);
    const ctx=c.getContext('2d');
    _night(ctx,CARD_W,CARD_H);

    ctx.fillStyle=CREAM;
    ctx.textAlign='center';
    ctx.font='46px Georgia, serif';
    const who=share.creatorName||'Somebody';
    _wrap(ctx,who+' made this',CARD_W/2,150,CARD_W-160,56);
    _wrap(ctx,'in VihuPlanet.',CARD_W/2,210,CARD_W-160,56);

    if(qrOk){
      // The door. Quiet-zone white behind the code — a QR drawn
      // straight onto the night sky never decodes, which is the
      // Data Matrix lab's own first measured rule.
      const qr=_blank(420,420);
      try{
        bwipjs.toCanvas(qr,{
          bcid:'qrcode',
          text:url,
          scale:4,
          eclevel:'M'
        });
      }catch(e){ return null; }
      const pad=26;
      const x=(CARD_W-420)/2;
      const y=330;
      ctx.fillStyle='#ffffff';
      ctx.fillRect(x-pad,y-pad,420+pad*2,420+pad*2);
      ctx.drawImage(qr,x,y,420,420);
    }

    ctx.fillStyle=GOLD;
    ctx.font='italic 42px Georgia, serif';
    ctx.fillText('Come see it',CARD_W/2,880);
    ctx.fillText('in VihuPlanet',CARD_W/2,932);
    _frame(ctx,CARD_W,CARD_H);
    return c;
  }

  // The ONE drawing of the card, as canvases. Two consumers share
  // it — the standalone Story Card print and the foldable sheet's
  // tear-off strip (Sprint 1.1 §8: one creation moment, never two
  // interpretations of the card).
  // share — the payload-like object (type, title, creatorName,
  //         pages) the hub already holds.
  // url   — the creation's own share URL (from the minted token).
  function cells(share,url){
    const s=share||{};
    const cover=(s.pages&&s.pages[0])?s.pages[0].image:null;
    return Promise.all([_ensureBwip(),_loadImage(cover)]).then(function(got){
      const bwipOk=got[0], img=got[1];
      if(!bwipOk||!url) return {ok:false,reason:'no-door'};
      const front=_drawFront(s,img);
      const back=_drawBack(s,url,true);
      if(!back) return {ok:false,reason:'no-door'};
      return { ok:true, front:front, back:back };
    });
  }

  function compose(share,url){
    return cells(share,url).then(function(c){
      if(!c.ok) return c;
      return {
        ok:true,
        front:c.front.toDataURL('image/png'),
        back:c.back.toDataURL('image/png'),
        w:CARD_W,h:CARD_H
      };
    });
  }

  const api={ compose:compose, cells:cells, CARD_W:CARD_W, CARD_H:CARD_H };
  try{ window.StoryCardComposer=api; }catch(e){}
  return api;
})();
