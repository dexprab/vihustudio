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

  // Sprint 1.1 — the Story Card is PART of the foldable. The sheet
  // gives its right edge to a tear-off strip carrying the card's
  // front and back at their exact printed size (750×1050 = 2.5in ×
  // 3.5in at 300dpi, the Magic Card's own card size): one straight
  // cut takes the card off, the rest folds into the little book.
  // The zine's own geometry (COLS/ROWS/SLIT_COLS/IMPOSITION) is
  // untouched — it simply lives in a narrower area when the strip
  // is present, and in the whole sheet when it is not (no door to
  // put on a card means no strip, never a dead card).
  const CARD_STRIP_W=810; // 750 card + breathing room for cut guides

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

  function _drawBack(ctx,w,h,share){
    const s=share||{};
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
    // SOCIAL 1.1 — the maker's public VihuPlanet name on the little
    // book's own back cover, asked for by the product owner.
    // Attribution only: the book's door stays the printed address and
    // the Story Card's own code. Absent while no name is chosen.
    if(s.creatorUsername&&/^[a-z0-9_]{3,20}$/.test(String(s.creatorUsername))){
      ctx.font='italic 700 '+Math.round(w*0.05)+'px Georgia, serif';
      ctx.fillText('by @'+s.creatorUsername,w/2,h*0.74);
    }
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

  // ---------- how to fold it ----------
  // ONE set of drawings for both surfaces: the hub's on-screen guide
  // renders these as inline SVG, and the printed guide page rasters
  // the SAME strings — so the screen and the paper can never teach
  // two different folds. Asked for from real use: the printed sheet
  // travels without the screen, and whoever folds it (often not the
  // child who pressed Print) needs the how on paper too.
  // REWRITTEN (1.2.2) after the product owner tried to follow them and
  // could not — "the instructions are not explicit. i myself am not
  // able to follow them how can i think a kid be able to follow them",
  // with a reference zine tutorial attached. The old second step was
  // the fatal one: "cut the little line in the middle" of a FLAT
  // sheet, which scissors cannot do. The real sequence — the one
  // every zine tutorial teaches — is FOLD IN HALF FIRST, then cut in
  // from the folded edge, and every step below shows the sheet in the
  // state the folder is actually holding.
  function FOLD_STEPS(cardPresent){
    const S='stroke="#8d867b" stroke-width="2" fill="none"';
    const D='stroke="#c9c2b4" stroke-width="1.5" stroke-dasharray="4 3" fill="none"';
    const K='stroke="#4a4540" stroke-width="2.6" fill="none"';
    const steps=[];
    if(cardPresent){
      steps.push({
        svg:'<rect x="8" y="14" width="74" height="38" rx="2" '+S+'/>'+
            '<line x1="64" y1="14" x2="64" y2="52" '+K+'/>'+
            '<text x="64" y="11" font-size="9" text-anchor="middle">✂</text>',
        words:'Cut your Story Card off the edge. The big part is your book sheet.'
      });
    }
    steps.push({
      svg:'<rect x="8" y="14" width="74" height="38" rx="2" '+S+'/>'+
          '<line x1="26.5" y1="14" x2="26.5" y2="52" '+D+'/>'+
          '<line x1="45" y1="14" x2="45" y2="52" '+D+'/>'+
          '<line x1="63.5" y1="14" x2="63.5" y2="52" '+D+'/>'+
          '<line x1="8" y1="33" x2="26.5" y2="33" '+D+'/>'+
          '<line x1="63.5" y1="33" x2="82" y2="33" '+D+'/>'+
          '<line x1="26.5" y1="33" x2="63.5" y2="33" '+K+'/>',
      words:'Lay the sheet flat. Dotted lines are folds. The one dark line is for scissors — but not yet.'
    });
    steps.push({
      svg:'<rect x="8" y="14" width="74" height="38" rx="2" '+S+'/>'+
          '<line x1="45" y1="14" x2="45" y2="52" '+D+'/>'+
          '<path d="M80 12 C 66 0, 50 2, 46 12" '+S+'/>'+
          '<path d="M46 12 l -1 -7 m 1 7 l 7 -2" '+S+'/>',
      // Anchored to the PRINTED lines, not to "short edges" — with
      // the card strip cut off the book sheet is nearly square, and
      // "short edges" stops meaning anything on a square.
      words:'Fold it in half along the middle dotted line, pictures facing OUT — so you can still see the dark line.'
    });
    steps.push({
      svg:'<rect x="26" y="14" width="38" height="38" rx="2" '+S+'/>'+
          '<line x1="26" y1="14" x2="26" y2="52" stroke="#8d867b" stroke-width="4"/>'+
          '<text x="20" y="60" font-size="7" text-anchor="middle">fold</text>'+
          '<line x1="26" y1="33" x2="45" y2="33" '+K+'/>'+
          '<text x="19" y="30" font-size="9" text-anchor="middle">✂</text>',
      words:'Cut on the dark line — start AT the folded edge, stop halfway across. Then open the sheet flat again.'
    });
    steps.push({
      svg:'<path d="M8 50 L24 26 L86 26 L70 50 Z" '+S+'/>'+
          '<path d="M70 50 L86 26 L86 42 Z" '+S+'/>'+
          '<line x1="43" y1="26" x2="67" y2="26" '+K+'/>',
      words:'Now fold it in half along the line the cut is in, so it stands like a tent — the cut along the top.'
    });
    steps.push({
      svg:'<rect x="10" y="24" width="70" height="18" rx="2" '+S+'/>'+
          '<path d="M45 24 L37 33 L45 42 L53 33 Z" '+D+'/>'+
          '<path d="M4 33 l 8 0 m -3 -3 l 3 3 l -3 3" '+S+'/>'+
          '<path d="M86 33 l -8 0 m 3 -3 l -3 3 l 3 3" '+S+'/>',
      words:'Hold both ends and push them towards each other — the cut opens in the middle.'
    });
    steps.push({
      svg:'<path d="M38 8 L52 8 L52 26 L70 26 L70 40 L52 40 L52 58 L38 58 L38 40 L20 40 L20 26 L38 26 Z" '+S+'/>'+
          '<path d="M74 12 C 84 20, 84 32, 74 40" '+S+'/>'+
          '<path d="M74 40 l 1 -7 m -1 7 l -7 -2" '+S+'/>',
      words:'Keep pushing until it looks like a star, then fold all the pages around one way.'
    });
    steps.push({
      svg:'<rect x="28" y="12" width="34" height="42" rx="3" '+S+'/>'+
          '<line x1="31" y1="14" x2="31" y2="52" stroke="#c9c2b4" stroke-width="1.5"/>'+
          '<text x="45" y="38" font-size="12" text-anchor="middle">⭐</text>',
      words:'Press it flat. A little book — ⭐ cover in front.'
    });
    return steps;
  }

  function _stepImage(svg){
    return new Promise(function(resolve){
      const img=new Image();
      img.onload=function(){ resolve(img); };
      img.onerror=function(){ resolve(null); };
      img.src='data:image/svg+xml;utf8,'+encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 64" width="90" height="64">'+svg+'</svg>');
    });
  }

  // The companion page that prints WITH the sheet: the goal (this
  // flat sheet becomes this little book), then the steps, large.
  function _composeGuide(cardPresent){
    const steps=FOLD_STEPS(cardPresent);
    return Promise.all(steps.map(function(s){ return _stepImage(s.svg); })).then(function(imgs){
      const c=_blank(SHEET_W,SHEET_H);
      const ctx=c.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,SHEET_W,SHEET_H);

      ctx.fillStyle=INK;
      ctx.textAlign='center';
      ctx.font='700 110px Georgia, serif';
      ctx.fillText('How to fold your little book',SHEET_W/2,210);

      // The goal, before any step: sheet → book.
      const gy=330;
      ctx.strokeStyle='#8d867b'; ctx.lineWidth=8;
      ctx.strokeRect(SHEET_W/2-500,gy,360,200);
      ctx.beginPath();
      ctx.moveTo(SHEET_W/2-80,gy+100); ctx.lineTo(SHEET_W/2+70,gy+100);
      ctx.moveTo(SHEET_W/2+70,gy+100); ctx.lineTo(SHEET_W/2+30,gy+70);
      ctx.moveTo(SHEET_W/2+70,gy+100); ctx.lineTo(SHEET_W/2+30,gy+130);
      ctx.stroke();
      ctx.strokeRect(SHEET_W/2+180,gy-20,170,240);
      ctx.font='80px serif';
      ctx.fillText('⭐',SHEET_W/2+265,gy+110);

      // The steps, numbered, in rows of four (1.2.2 — the sequence
      // grew to what a person can actually follow, and seven cramped
      // cells in one row is not that). The last row centres itself.
      const n=steps.length;
      const perRow=Math.min(4,n);
      const cellW=Math.min(660,(SHEET_W-240)/perRow);
      const picH=(cellW-80)*64/90;
      const rowH=picH+430;
      steps.forEach(function(step,i){
        const row=Math.floor(i/perRow);
        const inRow=Math.min(perRow,n-row*perRow);
        const rowX=(SHEET_W-cellW*inRow)/2;
        const x=rowX+(i-row*perRow)*cellW;
        const y=700+row*rowH;
        if(imgs[i]) ctx.drawImage(imgs[i],x+40,y,cellW-80,picH);
        ctx.fillStyle=INK;
        ctx.font='700 68px Georgia, serif';
        ctx.textAlign='center';
        ctx.fillText(String(i+1)+'.',x+cellW/2,y-36);
        ctx.font='48px Georgia, serif';
        ctx.fillStyle=SOFT;
        _wrapText(ctx,step.words,x+cellW/2,y+picH+80,cellW-70,58);
      });

      ctx.fillStyle=SOFT;
      ctx.textAlign='center';
      ctx.font='italic 52px Georgia, serif';
      ctx.fillText('Take your time — the paper knows the way.',SHEET_W/2,SHEET_H-120);

      return c.toDataURL('image/jpeg',0.9);
    });
  }

  // ---------- the card strip ----------
  // Drawn from StoryCardComposer's OWN cells — one drawing of the
  // card, shared by the standalone print and this strip, so the
  // card in the foldable can never drift from the card on its own.
  function _cardCells(share,cardUrl,plain){
    if(!cardUrl) return Promise.resolve(null);
    if(typeof StoryCardComposer==='undefined'||!StoryCardComposer.cells) return Promise.resolve(null);
    return StoryCardComposer.cells(share,cardUrl,{plain:!!plain}).then(function(c){
      return (c&&c.ok)?c:null;
    }).catch(function(){ return null; });
  }

  function _drawCardStrip(ctx,zineW,cellsGot){
    const stripX=zineW;
    const cardW=750,cardH=1050;
    const cx=stripX+(CARD_STRIP_W-cardW)/2;
    const gap=(SHEET_H-cardH*2)/3;
    const rects=[
      {x:cx,y:gap,w:cardW,h:cardH,canvas:cellsGot.front},
      {x:cx,y:gap*2+cardH,w:cardW,h:cardH,canvas:cellsGot.back}
    ];
    // The one straight tear-off cut, sheet-tall.
    ctx.strokeStyle='#a09a8e';
    ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(stripX,0); ctx.lineTo(stripX,SHEET_H); ctx.stroke();
    ctx.fillStyle='#a09a8e';
    ctx.font='60px serif';
    ctx.textAlign='center';
    ctx.fillText('✂',stripX,70);
    rects.forEach(function(r){
      ctx.drawImage(r.canvas,r.x,r.y,r.w,r.h);
      ctx.strokeStyle='#d8d2c6';
      ctx.lineWidth=3;
      ctx.setLineDash([14,14]);
      ctx.strokeRect(r.x-8,r.y-8,r.w+16,r.h+16);
      ctx.setLineDash([]);
    });
    return { front:{x:rects[0].x,y:rects[0].y,w:cardW,h:cardH},
             back:{x:rects[1].x,y:rects[1].y,w:cardW,h:cardH} };
  }

  // ---------- the sheet ----------
  // opts.cardUrl — the creation's own share URL. When present (and
  // the card can actually be drawn), the sheet carries the tear-off
  // Story Card strip; when not, the zine takes the whole sheet.
  // opts.plain  — the card strip follows the paper choice (the
  // PAGES are already plain via the payload handed in).
  function compose(share,opts){
    const o=opts||{};
    const book=bookPages(share||{});
    const coverImage=(share&&share.pages&&share.pages[0])?share.pages[0].image:null;

    const sources=[coverImage].concat(book.inner.map(function(p){ return p.image; }));
    return Promise.all([Promise.all(sources.map(_loadImage)),_cardCells(share,o.cardUrl,o.plain)])
      .then(function(got){
      const imgs=got[0];
      const cardCells=got[1];
      const coverImg=imgs[0];
      const innerImgs=imgs.slice(1);

      const zineW=cardCells?(SHEET_W-CARD_STRIP_W):SHEET_W;

      const sheet=_blank(SHEET_W,SHEET_H);
      const ctx=sheet.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,SHEET_W,SHEET_H);

      const cellW=zineW/COLS, cellH=SHEET_H/ROWS;

      // The upright panel bitmaps, kept in READING order — they are
      // what the folded-book preview flips through, so the child
      // sees exactly the pages the paper will show.
      const uprightPanels=[];

      IMPOSITION.forEach(function(slot){
        const panel=_blank(Math.round(cellW),Math.round(cellH));
        const pctx=panel.getContext('2d');
        if(slot.panel===1) _drawCover(pctx,panel.width,panel.height,share||{},coverImg);
        else if(slot.panel===8) _drawBack(pctx,panel.width,panel.height,share||{});
        else _drawPage(pctx,panel.width,panel.height,innerImgs[slot.panel-2]||null);

        uprightPanels[slot.panel-1]={ n:slot.panel, image:panel.toDataURL('image/jpeg',0.85) };

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
      ctx.beginPath(); ctx.moveTo((SLIT_COLS[1]+1)*cellW,cellH); ctx.lineTo(zineW,cellH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle='#a09a8e';
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.moveTo(SLIT_COLS[0]*cellW,cellH); ctx.lineTo((SLIT_COLS[1]+1)*cellW,cellH); ctx.stroke();
      ctx.fillStyle='#a09a8e';
      ctx.font='60px serif';
      ctx.textAlign='center';
      ctx.fillText('✂',SLIT_COLS[0]*cellW+40,cellH-16);

      // THE PAPER SPEAKS FOR ITSELF (1.1.3, from real use: "do u
      // think these instructions are clear enough?" — they were
      // not). The screen's guide does not travel with the sheet,
      // and whoever folds it is often not the child who pressed
      // Print — so the cuts and folds are NAMED, in the guides' own
      // quiet gray. Adult-facing paper, like the letter; the
      // no-explaining rule is about Lumo and a child's screens.
      ctx.fillStyle='#a09a8e';
      ctx.font='34px Georgia, serif';
      ctx.textAlign='right';
      // Named WITH its order (1.2.2) — "cut this little line" read as
      // an instruction to cut the flat sheet, which scissors cannot
      // do. The fold comes first, and the label says so.
      ctx.fillText('fold in half first, then cut this line',(SLIT_COLS[1]+1)*cellW-24,cellH-18);
      ctx.textAlign='center';
      for(let c=1;c<COLS;c++){ ctx.fillText('fold',c*cellW,42); }
      ctx.fillText('fold',SLIT_COLS[0]*cellW/2,cellH-18);

      let cardRects=null;
      if(cardCells){
        cardRects=_drawCardStrip(ctx,zineW,cardCells);
        ctx.fillStyle='#a09a8e';
        ctx.font='34px Georgia, serif';
        ctx.textAlign='center';
        ctx.save();
        ctx.translate(zineW-14,SHEET_H/2);
        ctx.rotate(-Math.PI/2);
        ctx.fillText('cut the Story Card off this edge',0,0);
        ctx.restore();
      }

      return _composeGuide(!!cardCells).then(function(guide){
        return {
          sheet: sheet.toDataURL('image/jpeg',0.92),
          guide: guide,
          w: SHEET_W,
          h: SHEET_H,
          pageCount: book.inner.length,
          note: book.note,
          panels: uprightPanels,
          card: !!cardCells,
          cardCells: cardRects,
          cardFront: cardCells?cardCells.front.toDataURL('image/png'):null,
          cardBack: cardCells?cardCells.back.toDataURL('image/png'):null,
          zineW: zineW
        };
      });
    });
  }

  const api={
    compose:compose,
    bookPages:bookPages,
    FOLD_STEPS:FOLD_STEPS,
    IMPOSITION:IMPOSITION,
    SLIT_COLS:SLIT_COLS,
    COLS:COLS,
    ROWS:ROWS,
    INNER_PAGES:INNER_PAGES,
    CARD_STRIP_W:CARD_STRIP_W,
    SHEET_W:SHEET_W,
    SHEET_H:SHEET_H
  };
  try{ window.FoldableComposer=api; }catch(e){}
  return api;
})();
