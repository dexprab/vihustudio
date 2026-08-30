// =============================================================
// VihuStudio — Foldable Composer (Sprint LOOK WHAT I MADE)
// -------------------------------------------------------------
// Turns a creation into ONE printable sheet that folds into a
// little book. The child sees the physical object first — the
// preview IS this composed sheet — and the printed page is the
// same bitmap, so "printed result matches preview" holds by
// construction rather than by care.
//
// THE FOLD is the classic one-sheet eight-panel zine: a landscape
// sheet ruled into 4 × 2 panels, a slit cut along the middle of
// the horizontal centreline, folded long-ways and pushed closed
// into an eight-page book. Geometrically the slit turns the grid
// into a CYCLE of eight panels:
//
//     B4 → T4 → T3 → T2 → T1 → B1 → B2 → B3 → (B4)
//
// (T = top row, B = bottom row, columns numbered left to right.)
// Reading order follows that cycle, and every top-row panel
// prints upside-down because the fold hangs it head-first. That
// gives the imposition below — and the test suite re-derives the
// cycle from the grid's own adjacency (edges minus the slit) and
// checks this table walks it in order, so the table cannot
// quietly disagree with the paper.
//
//     top row, left→right:    P5̄  P4̄  P3̄  P2̄   (all rotated)
//     bottom row, left→right: P6  P7  P8  P1   (upright)
//
// P1 is the cover (bottom-right), P8 the back.
//
// WHAT GOES ON THE PAGES adapts to the creation — the child never
// chooses a type (Phase A infers it):
//
//   story     the story's own pages, in order.
//   moment /  the MAKING — watch frames tell "look what
//   sequence  happened", with the finished creation as the last
//             page. A one-drawing foldable of six blank pages
//             would be a book about nothing.
//
// A little book holds six inner pages. A longer story keeps its
// first six and the hub SAYS so (compose() returns `note`) —
// visible, never silent.
// =============================================================

const FoldableComposer=(function(){
  'use strict';

  // 300dpi US Letter, landscape. The print CSS scales to the paper
  // it meets (A4 differs by millimetres, absorbed by the margin),
  // so this is resolution, not a paper-size commitment.
  const SHEET_W=3300, SHEET_H=2550;
  const COLS=4, ROWS=2;
  const INNER_PAGES=6;

  // panel = reading position 1..8 (1 = cover, 8 = back);
  // col 0..3 left→right; row 0 = top (printed rotated 180°).
  const IMPOSITION=[
    {panel:5,col:0,row:0},{panel:4,col:1,row:0},{panel:3,col:2,row:0},{panel:2,col:3,row:0},
    {panel:6,col:0,row:1},{panel:7,col:1,row:1},{panel:8,col:2,row:1},{panel:1,col:3,row:1}
  ];

  // The slit severs the top/bottom connection for the two MIDDLE
  // columns only (cut from the 1st to the 3rd vertical crease).
  const SLIT_COLS=[1,2];

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

  function _fitRect(imgW,imgH,boxW,boxH){
    const s=Math.min(boxW/imgW,boxH/imgH);
    const w=imgW*s,h=imgH*s;
    return {w:w,h:h,x:(boxW-w)/2,y:(boxH-h)/2};
  }

  // ---------- which pages the little book holds ----------
  function bookPages(share){
    const s=share||{};
    const pages=Array.isArray(s.pages)?s.pages:[];
    const watch=Array.isArray(s.watch)?s.watch:[];
    let inner=[]; let note='';

    if(s.type==='story'){
      inner=pages.slice(0,INNER_PAGES).map(function(p){ return {image:p.image}; });
      if(pages.length>INNER_PAGES){
        note='A little book holds six pages — your story’s first six are inside. The whole story lives in VihuPlanet.';
      }
    }else{
      // The making, then the made thing. Watch frames are already
      // ordered blank → finished; sample evenly, keep the finished
      // creation as the last page.
      const finished=pages[0]?{image:pages[0].image}:null;
      const room=finished?INNER_PAGES-1:INNER_PAGES;
      const picks=[];
      if(watch.length&&room>0){
        // Skip the final frame (it is the finished page again) and
        // sample what is left evenly.
        const usable=watch.slice(0,Math.max(0,watch.length-1));
        const n=Math.min(room,usable.length);
        for(let i=0;i<n;i++){
          const idx=Math.round(i*(usable.length-1)/Math.max(1,n-1));
          picks.push({image:usable[idx].image});
        }
      }
      inner=picks;
      if(finished) inner.push(finished);
    }
    return {inner:inner,note:note};
  }

  // ---------- drawing one panel ----------
  const PAPER='#fffdf6';
  const INK='#3a3630';
  const SOFT='#8d867b';

  function _drawCover(ctx,w,h,share,img){
    ctx.fillStyle=PAPER; ctx.fillRect(0,0,w,h);
    const title=(typeof CreationShare!=='undefined'&&CreationShare.displayTitle)
      ? CreationShare.displayTitle({title:share.title,creationType:share.type})
      : (share.title||'Something I Made');
    const pad=w*0.1;
    ctx.fillStyle=INK;
    ctx.textAlign='center';
    ctx.font='700 '+Math.round(w*0.085)+'px Georgia, serif';
    _wrapText(ctx,title,w/2,h*0.16,w-pad*2,Math.round(w*0.1));
    if(img){
      const box={x:pad,y:h*0.28,w:w-pad*2,h:h*0.5};
      const fit=_fitRect(img.width,img.height,box.w,box.h);
      ctx.drawImage(img,box.x+fit.x,box.y+fit.y,fit.w,fit.h);
    }
    if(share.creatorName){
      ctx.fillStyle=SOFT;
      ctx.font='italic '+Math.round(w*0.055)+'px Georgia, serif';
      ctx.fillText('— '+share.creatorName,w/2,h*0.88);
    }
    ctx.font=Math.round(w*0.06)+'px serif';
    ctx.fillText('⭐',w/2,h*0.06+Math.round(w*0.03));
  }

  function _drawPage(ctx,w,h,img){
    ctx.fillStyle=PAPER; ctx.fillRect(0,0,w,h);
    if(img){
      const pad=w*0.06;
      const fit=_fitRect(img.width,img.height,w-pad*2,h-pad*2);
      ctx.drawImage(img,pad+fit.x,pad+fit.y,fit.w,fit.h);
    }else{
      // An empty page of a short book stays gentle, never broken.
      ctx.fillStyle=SOFT;
      ctx.textAlign='center';
      ctx.font=Math.round(w*0.08)+'px serif';
      ctx.fillText('✦',w/2,h/2);
    }
  }

  function _drawBack(ctx,w,h){
    ctx.fillStyle=PAPER; ctx.fillRect(0,0,w,h);
    ctx.fillStyle=INK;
    ctx.textAlign='center';
    ctx.font='700 '+Math.round(w*0.06)+'px Georgia, serif';
    ctx.fillText('Made in VihuPlanet',w/2,h*0.46);
    ctx.font=Math.round(w*0.07)+'px serif';
    ctx.fillText('✨',w/2,h*0.55);
    ctx.fillStyle=SOFT;
    ctx.font=Math.round(w*0.045)+'px Georgia, serif';
    ctx.fillText('vihuplanet.com',w/2,h*0.64);
  }

  function _wrapText(ctx,text,x,y,maxW,lineH){
    const words=String(text||'').split(/\s+/);
    let line='';
    words.forEach(function(word){
      const probe=line?line+' '+word:word;
      if(ctx.measureText(probe).width>maxW&&line){
        ctx.fillText(line,x,y); y+=lineH; line=word;
      }else line=probe;
    });
    if(line) ctx.fillText(line,x,y);
  }

  // ---------- the sheet ----------
  function compose(share){
    const book=bookPages(share||{});
    const coverImage=(share&&share.pages&&share.pages[0])?share.pages[0].image:null;

    const sources=[coverImage].concat(book.inner.map(function(p){ return p.image; }));
    return Promise.all(sources.map(_loadImage)).then(function(imgs){
      const coverImg=imgs[0];
      const innerImgs=imgs.slice(1);

      const sheet=_blank(SHEET_W,SHEET_H);
      const ctx=sheet.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,SHEET_W,SHEET_H);

      const cellW=SHEET_W/COLS, cellH=SHEET_H/ROWS;

      IMPOSITION.forEach(function(slot){
        const panel=_blank(Math.round(cellW),Math.round(cellH));
        const pctx=panel.getContext('2d');
        if(slot.panel===1) _drawCover(pctx,panel.width,panel.height,share||{},coverImg);
        else if(slot.panel===8) _drawBack(pctx,panel.width,panel.height);
        else _drawPage(pctx,panel.width,panel.height,innerImgs[slot.panel-2]||null);

        ctx.save();
        ctx.translate(slot.col*cellW,slot.row*cellH);
        if(slot.row===0){
          // The fold hangs the top row head-first, so it prints
          // upside-down and reads upright in the folded book.
          ctx.translate(cellW/2,cellH/2);
          ctx.rotate(Math.PI);
          ctx.translate(-cellW/2,-cellH/2);
        }
        ctx.drawImage(panel,0,0,cellW,cellH);
        ctx.restore();
      });

      // Guides: light dashed fold lines, and a solid line with a
      // scissors mark where the one cut goes. They print — folding
      // a plain sheet with no guides is the harder craft project.
      ctx.strokeStyle='#d8d2c6';
      ctx.lineWidth=3;
      ctx.setLineDash([18,18]);
      for(let c=1;c<COLS;c++){
        ctx.beginPath(); ctx.moveTo(c*cellW,0); ctx.lineTo(c*cellW,SHEET_H); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0,cellH); ctx.lineTo(SLIT_COLS[0]*cellW,cellH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((SLIT_COLS[1]+1)*cellW,cellH); ctx.lineTo(SHEET_W,cellH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle='#a09a8e';
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(SLIT_COLS[0]*cellW,cellH); ctx.lineTo((SLIT_COLS[1]+1)*cellW,cellH); ctx.stroke();
      ctx.fillStyle='#a09a8e';
      ctx.font='60px serif';
      ctx.textAlign='center';
      ctx.fillText('✂',SLIT_COLS[0]*cellW+40,cellH-16);

      return {
        sheet: sheet.toDataURL('image/jpeg',0.92),
        w: SHEET_W,
        h: SHEET_H,
        pageCount: book.inner.length,
        note: book.note
      };
    });
  }

  const api={
    compose:compose,
    bookPages:bookPages,
    IMPOSITION:IMPOSITION,
    SLIT_COLS:SLIT_COLS,
    COLS:COLS,
    ROWS:ROWS,
    INNER_PAGES:INNER_PAGES
  };
  try{ window.FoldableComposer=api; }catch(e){}
  return api;
})();
