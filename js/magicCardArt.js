// js/magicCardArt.js — Magic Card two-sided card art (front/back
// canvas render, Download, Print).
//
// Magic Card Identity Evolution, Phase 2. Gives the Magic Card the
// same real "card-ness" the platform's other card system (Vihu Cards,
// tools/world-builder-v2/js/worldBuilderApp.js's own
// _drawCardFront/_drawCardBack/_printCardArt/_downloadDataURL) already
// has — but with new, identity-appropriate content, not literal reuse
// of Vihu Card's fields: a Magic Card has no rarity/tries/duration/
// target-World, so there is no rarity bar, no "unlock" language, no
// World hero-image background. Reuses the SAME print-DPI canvas
// dimensions and the same generic helpers (rounded-rect path, shrink-
// to-fit text, download-via-temporary-anchor, print-via-temporary-
// off-screen-sheet) — all fully card-type-agnostic — but is otherwise
// a fresh design, since Magic Cards don't exist in World Builder at
// all and there is no cross-tool sharing need here (unlike the
// originally-proposed, never-built shared js/cardArt.js).
//
// Reuses .magic-card-overlay's own established night-sky palette
// (css/style.css's --mc-gold/--mc-ink/--mc-panel tokens, mirrored here
// as plain hex since a <canvas> can't read CSS custom properties) so
// the printed/downloaded card and the in-app ceremony/Home read as the
// same object, not two different visual languages.
const MagicCardArt=(function(){
  'use strict';

  const CARD_ART_W=700, CARD_ART_H=980;

  function _roundRectPath(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  // Shrinks the font size until a single line fits maxWidth, then
  // draws it — simpler and more robust than multi-line wrapping for a
  // nickname, which is short by design (24 chars max, magicCardUI.js).
  function _fitText(ctx,text,x,y,maxWidth,startPx,minPx,weightAndFamily){
    let px=startPx;
    while(px>minPx){
      ctx.font=weightAndFamily.replace('__PX__',px);
      if(ctx.measureText(text).width<=maxWidth) break;
      px-=2;
    }
    ctx.font=weightAndFamily.replace('__PX__',px);
    ctx.fillText(text,x,y);
  }

  function _formatDate(iso){
    try{
      return new Date(iso).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    }catch(e){ return ''; }
  }

  // ---------- Front: identity, not a redemption token ----------
  function drawFront(canvas,card){
    canvas.width=CARD_ART_W; canvas.height=CARD_ART_H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,CARD_ART_W,CARD_ART_H);
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    ctx.save();
    ctx.clip();

    // Same night-sky radial gradient as .magic-card-overlay itself.
    const grad=ctx.createRadialGradient(CARD_ART_W*0.32,CARD_ART_H*0.22,30,CARD_ART_W*0.5,CARD_ART_H*0.5,CARD_ART_H*0.95);
    grad.addColorStop(0,'#232d5c');
    grad.addColorStop(0.55,'#141a38');
    grad.addColorStop(1,'#080a16');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,CARD_ART_W,CARD_ART_H);

    // A soft, purely atmospheric glow — the front carries no real
    // pattern (that stays exclusive to the back), so this is what
    // fills the card's own generous middle third instead of leaving it
    // a visually empty void.
    const glow=ctx.createRadialGradient(CARD_ART_W*0.66,CARD_ART_H*0.38,10,CARD_ART_W*0.66,CARD_ART_H*0.38,280);
    glow.addColorStop(0,'rgba(255,203,69,0.16)');
    glow.addColorStop(0.5,'rgba(120,140,255,0.08)');
    glow.addColorStop(1,'rgba(120,140,255,0)');
    ctx.fillStyle=glow;
    ctx.fillRect(0,0,CARD_ART_W,CARD_ART_H);

    // A dense, varied decorative starfield — quiet texture, not the
    // real tappable pattern (that lives on the back only). Deterministic
    // (a fixed seed sequence, not Math.random()) so a re-download of
    // the same card always looks the same.
    let seed=17;
    function nextRand(){ seed=(seed*9301+49297)%233280; return seed/233280; }
    for(let i=0;i<46;i++){
      const sx=nextRand()*CARD_ART_W, sy=nextRand()*CARD_ART_H*0.86;
      const r=0.6+nextRand()*1.6;
      ctx.beginPath();
      ctx.arc(sx,sy,r,0,Math.PI*2);
      ctx.fillStyle='rgba(238,241,255,'+(0.25+nextRand()*0.4).toFixed(2)+')';
      ctx.fill();
    }
    // A handful of larger, gently glowing twinkle stars for real focal
    // points among the fine texture above.
    const bigStars=[[0.14,0.42],[0.78,0.2],[0.58,0.5],[0.28,0.66],[0.86,0.58]];
    bigStars.forEach(function(p,i){
      ctx.save();
      ctx.shadowColor='rgba(255,203,69,0.85)';
      ctx.shadowBlur=10;
      ctx.fillStyle=i%2===0?'#FFCB45':'#eef1ff';
      ctx.beginPath();
      ctx.arc(p[0]*CARD_ART_W,p[1]*CARD_ART_H,2.6,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // Kicker pill — no rarity concept here, this simply names what the
    // object is, matching the ceremony's own "This card wants to
    // remember you" tone rather than anything transactional.
    ctx.textBaseline='middle';
    ctx.font='700 20px -apple-system, Helvetica, Arial, sans-serif';
    const pillText='✨ MAGIC CARD';
    const pillW=ctx.measureText(pillText).width+36;
    ctx.fillStyle='rgba(255,255,255,0.10)';
    _roundRectPath(ctx,28,28,pillW,44,22);
    ctx.fill();
    ctx.fillStyle='#FFCB45';
    ctx.textAlign='left';
    ctx.fillText(pillText,28+18,28+22);

    // Nickname as the title — set closer to vertical middle so the
    // card's own generous height reads as intentional atmosphere above
    // and below it, rather than crowding everything into the bottom
    // fifth of the canvas.
    const titleY=Math.round(CARD_ART_H*0.60);
    ctx.textAlign='left';
    ctx.textBaseline='alphabetic';
    ctx.fillStyle='#eef1ff';
    ctx.shadowColor='rgba(0,0,0,0.55)';
    ctx.shadowBlur=12;
    _fitText(ctx,(card.nickname||'Star Traveler'),34,titleY,CARD_ART_W-68,52,28,'700 __PX__px Georgia, serif');
    ctx.shadowBlur=0;

    ctx.font='400 20px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(238,241,255,0.68)';
    ctx.fillText('Creator since '+_formatDate(card.claimedAt),34,titleY+44);

    // A quiet divider + tagline beneath, giving the lower third its own
    // real content instead of a long empty run down to the code.
    ctx.strokeStyle='rgba(255,255,255,0.18)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(34,titleY+84);
    ctx.lineTo(CARD_ART_W-34,titleY+84);
    ctx.stroke();
    ctx.font='italic 17px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.55)';
    ctx.fillText('Every story adds a star to this sky.',34,titleY+116);

    // Quiet human-typeable fallback code, bottom-right — never the
    // headline of the card, just a small anchor beneath the nickname.
    if(card.id){
      ctx.font='600 16px "SF Mono", Consolas, monospace';
      ctx.fillStyle='rgba(238,241,255,0.5)';
      ctx.textAlign='right';
      ctx.fillText(card.id,CARD_ART_W-34,CARD_ART_H-34);
    }

    ctx.restore();

    _roundRectPath(ctx,3,3,CARD_ART_W-6,CARD_ART_H-6,34);
    ctx.lineWidth=6;
    ctx.strokeStyle='#FFCB45';
    ctx.stroke();
  }

  // ---------- Back: the real, permanent constellation ----------
  function drawBack(canvas,card){
    canvas.width=CARD_ART_W; canvas.height=CARD_ART_H;
    const ctx=canvas.getContext('2d');

    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    const grad=ctx.createRadialGradient(CARD_ART_W*0.35,CARD_ART_H*0.22,30,CARD_ART_W*0.5,CARD_ART_H*0.5,CARD_ART_H*0.9);
    grad.addColorStop(0,'#232d5c');
    grad.addColorStop(1,'#080a16');
    ctx.fillStyle=grad;
    ctx.fill();

    ctx.save();
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    ctx.clip();

    // Gold corner flourishes — same Canvas-primitive technique already
    // established for Vihu Card's own back.
    [[0,0,1,1],[CARD_ART_W,0,-1,1],[0,CARD_ART_H,1,-1],[CARD_ART_W,CARD_ART_H,-1,-1]].forEach(function(c){
      ctx.strokeStyle='rgba(255,203,69,0.5)';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.moveTo(c[0]+c[2]*72,c[1]);
      ctx.lineTo(c[0],c[1]);
      ctx.lineTo(c[0],c[1]+c[3]*72);
      ctx.stroke();
    });

    ctx.textAlign='center';
    ctx.textBaseline='alphabetic';
    ctx.font='30px sans-serif';
    ctx.fillStyle='#FFCB45';
    ctx.fillText('✨',CARD_ART_W/2,92);
    ctx.font='700 30px Georgia, serif';
    ctx.fillStyle='#eef1ff';
    ctx.fillText('Magic Card',CARD_ART_W/2,140);

    const gridTop=200, gridSize=CARD_ART_W-160, cell=gridSize/10;
    const gridLeft=(CARD_ART_W-gridSize)/2;

    if(card.pattern && card.pattern.length){
      const pts=card.pattern.map(function(p){
        return {x:gridLeft+(p[1]+0.5)*cell, y:gridTop+(p[0]+0.5)*cell};
      });

      ctx.strokeStyle='rgba(255,203,69,0.16)';
      ctx.lineWidth=1;
      for(let gi=0;gi<=10;gi++){
        ctx.beginPath();
        ctx.moveTo(gridLeft+gi*cell,gridTop);
        ctx.lineTo(gridLeft+gi*cell,gridTop+gridSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(gridLeft,gridTop+gi*cell);
        ctx.lineTo(gridLeft+gridSize,gridTop+gi*cell);
        ctx.stroke();
      }

      if(pts.length>1){
        ctx.strokeStyle='rgba(255,203,69,0.4)';
        ctx.lineWidth=2;
        ctx.beginPath();
        pts.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.stroke();
      }
      pts.forEach(function(p){
        ctx.shadowColor='#FFCB45';
        ctx.shadowBlur=16;
        ctx.fillStyle='#fff6dd';
        ctx.font='30px sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('★',p.x,p.y);
      });
      ctx.shadowBlur=0;

      ctx.textBaseline='alphabetic';
      ctx.font='italic 700 24px Georgia, serif';
      ctx.fillStyle='#FFCB45';
      ctx.fillText('✦ '+(card.constellation||'')+' ✦',CARD_ART_W/2,gridTop+gridSize+50);
    }else{
      // A typed-code recall never learns the real pattern (the RPC
      // never returns it, by design — see supabase/schema.sql's
      // recall_magic_card) — an honest empty state instead of
      // fabricating stars this device doesn't actually know.
      ctx.font='italic 20px Georgia, serif';
      ctx.fillStyle='rgba(238,241,255,0.75)';
      ctx.fillText('No sky to show yet on this device.',CARD_ART_W/2,gridTop+gridSize/2);
    }

    if(card.id){
      ctx.font='700 26px "SF Mono", Consolas, monospace';
      ctx.fillStyle='#fff6dd';
      ctx.fillText(card.id,CARD_ART_W/2,gridTop+gridSize+92);
    }

    ctx.font='italic 18px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.6)';
    ctx.fillText('Tap the stars to come home.',CARD_ART_W/2,CARD_ART_H-50);

    ctx.restore();

    _roundRectPath(ctx,3,3,CARD_ART_W-6,CARD_ART_H-6,34);
    ctx.lineWidth=5;
    ctx.strokeStyle='#FFCB45';
    ctx.stroke();
  }

  // ---------- Download / Print — ported verbatim, fully generic ----------
  function downloadDataURL(dataURL,filename){
    const link=document.createElement('a');
    link.href=dataURL;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printCard(frontDataURL,backDataURL){
    const sheet=document.createElement('div');
    sheet.className='magic-card-print-sheet';
    const imgFront=document.createElement('img');
    imgFront.src=frontDataURL;
    const imgBack=document.createElement('img');
    imgBack.src=backDataURL;
    sheet.appendChild(imgFront);
    sheet.appendChild(imgBack);
    document.body.appendChild(sheet);
    function cleanup(){
      sheet.remove();
      window.removeEventListener('afterprint',cleanup);
    }
    window.addEventListener('afterprint',cleanup);
    window.print();
    setTimeout(cleanup,5000);
  }

  const api={
    CARD_ART_W:CARD_ART_W,
    CARD_ART_H:CARD_ART_H,
    drawFront:drawFront,
    drawBack:drawBack,
    downloadDataURL:downloadDataURL,
    printCard:printCard
  };
  try{ window.MagicCardArt=api; }catch(e){}
  return api;
})();
