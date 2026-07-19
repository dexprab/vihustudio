// js/magicCardArt.js — Magic Card two-sided card art (front/back
// canvas render, Download, Print).
//
// Magic Card Identity Evolution, Phase 2. Gives the Magic Card the
// same real "card-ness" the platform's other card system (World Cards,
// tools/world-builder-v2/js/worldBuilderApp.js's own
// _drawCardFront/_drawCardBack/_printCardArt/_downloadDataURL) already
// has — but with new, identity-appropriate content, not literal reuse
// of World Card's fields: a Magic Card has no rarity/tries/duration/
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
//
// VihuPlanet Magic Card redesign (user-supplied reference mockup):
// the front's hero is now the bonded Story Companion (portrait, name,
// species) — "the Magic Card is the permanent record of the Creator
// Bond," per Companion Canon V2's own framing, so the Companion is the
// card's headline, not a small corner badge — with the Creator's own
// identity, a Guardian (Lumo) panel, and the real recallCode arranged
// beneath it. A companion-less legacy card falls back to the Creator's
// own nickname as the headline (see hasCompanion below).
//
// Disclosed, explicit product decision (confirmed with the user):
// "Lv." and the coin count shown in the Creator Info panel are STATIC
// PLACEHOLDERS — there is no Level/XP or Coin economy anywhere in this
// platform yet. They are rendered as fixed, honest-looking defaults
// (Lv. 1 / 0 coins) rather than fabricated progress numbers, and never
// read from any real data source. Building a real economy behind them
// is explicitly out of scope for this pass.
const MagicCardArt=(function(){
  'use strict';

  const CARD_ART_W=700, CARD_ART_H=980;
  const GOLD='#FFCB45', CREAM='#fff6dd', INK='#eef1ff';

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
    return px;
  }

  // Plain greedy word-wrap, capped at 2 lines (this module's own copy
  // is always short, deliberate flavour text — a 3rd line is simply
  // dropped rather than adding scroll/ellipsis machinery nothing here
  // needs). Returns the y just below the last line drawn.
  function _wrapCentered(ctx,text,cx,y,maxWidth,lineHeight,maxLines){
    const words=text.split(' ');
    const lines=[];
    let cur='';
    words.forEach(function(w){
      const test=cur?cur+' '+w:w;
      if(ctx.measureText(test).width>maxWidth && cur){
        lines.push(cur);
        cur=w;
      }else{
        cur=test;
      }
    });
    if(cur) lines.push(cur);
    const capped=lines.slice(0,maxLines||2);
    capped.forEach(function(line,i){ ctx.fillText(line,cx,y+i*lineHeight); });
    return y+(capped.length-1)*lineHeight;
  }

  function _formatDate(iso){
    try{
      return new Date(iso).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    }catch(e){ return ''; }
  }

  // Companion Canon V2 — "the Magic Card becomes the permanent record
  // of the Creator Bond." Resolves any registered entity's own
  // hero.png (independently of any *loaded* CompanionEngine widget
  // instance, exactly the way this module already resolves everything
  // else about a card — a fresh, small fetch, not a shared cache) —
  // used both for the bonded Story Companion's own portrait AND, with
  // the fixed id 'lumo', the Guardian panel's mini portrait (Lumo's
  // real, already-uploaded art — see the Companion Canon Freeze / Asset
  // Path Correction sprint). Resolves null — never rejects — for a
  // companion-less card, a companion whose art hasn't been uploaded yet
  // (Nimbus/Quill's own disclosed gap; the <img> simply never loads),
  // or an id that no longer resolves in the registry — every caller's
  // own fallback glyph covers each of those the same, honest way.
  function resolveCompanionPortrait(companionId){
    if(!companionId) return Promise.resolve(null);
    const base='assets/'+companionId+'/';
    return fetch(base+'companion.json').then(function(res){
      return res.ok ? res.json() : null;
    }).then(function(pkg){
      if(!pkg || !pkg.states) return null;
      const file=pkg.states.hero||pkg.states[pkg.defaultState];
      if(!file) return null;
      return new Promise(function(resolve){
        const img=new Image();
        img.onload=function(){ resolve(img); };
        img.onerror=function(){ resolve(null); };
        img.src=base+file;
      });
    }).catch(function(){ return null; });
  }

  // ---------- Shared ornate frame — front and back both use this, so
  // the two faces read as one physical object, not two designs ----------
  function _drawCardFrame(ctx){
    _roundRectPath(ctx,10,10,CARD_ART_W-20,CARD_ART_H-20,30);
    ctx.lineWidth=5;
    ctx.strokeStyle=GOLD;
    ctx.stroke();
    _roundRectPath(ctx,22,22,CARD_ART_W-44,CARD_ART_H-44,24);
    ctx.lineWidth=1.5;
    ctx.strokeStyle='rgba(255,203,69,0.35)';
    ctx.stroke();
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.font='16px sans-serif';
    ctx.fillStyle='rgba(255,203,69,0.7)';
    [[34,34],[CARD_ART_W-34,34],[34,CARD_ART_H-34],[CARD_ART_W-34,CARD_ART_H-34]].forEach(function(p){
      ctx.fillText('✦',p[0],p[1]);
    });
  }

  // A small, reusable "info panel" background — the Creator Info panel
  // and the Guardian panel on both faces all share this same quiet
  // rounded-rect chrome so the card reads as one consistent system of
  // panels, not several one-off boxes.
  function _panel(ctx,x,y,w,h,r){
    _roundRectPath(ctx,x,y,w,h,r);
    ctx.fillStyle='rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.lineWidth=1;
    ctx.strokeStyle='rgba(255,203,69,0.28)';
    ctx.stroke();
  }

  // A small circular portrait — shared by the Companion hero window
  // (front, large) and the Guardian mini-portrait (front + back,
  // small): fills a soft ring background, clips to a circle, draws
  // either the resolved Image or a fallback glyph, then strokes a gold
  // ring on top. Fully generic on which entity's portrait it's given.
  function _portraitCircle(ctx,cx,cy,r,img,fallbackGlyph,ringWidth){
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.closePath();
    ctx.fillStyle='rgba(255,255,255,0.10)';
    ctx.fill();
    ctx.clip();
    if(img){
      ctx.drawImage(img,cx-r,cy-r,r*2,r*2);
    }else{
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font=Math.round(r*0.7)+'px sans-serif';
      ctx.fillStyle=GOLD;
      ctx.fillText(fallbackGlyph||'✨',cx,cy+1);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,203,69,0.6)';
    ctx.lineWidth=ringWidth||3;
    ctx.stroke();
  }

  // ---------- Front: the bonded Story Companion is the headline ----------
  // `opts.companionPortrait` / `opts.guardianPortrait` (already-loaded
  // Images, or null/omitted — see resolveCompanionPortrait above) and
  // `opts.counts` ({stories, worlds}, matching MagicCard.growthSignals()'s
  // own {projectCount,worldCount} shape) are all optional so every
  // existing caller/test that draws a companion-less or count-less card
  // keeps working unchanged — Lumo is never card.companionId's source
  // (nothing anywhere resolves it to a guardian-role registry entry,
  // see js/companionDirector.js's own _resolveCreatorCompanionId), only
  // ever opts.guardianPortrait's own fixed 'lumo' fetch.
  function drawFront(canvas,card,opts){
    opts=opts||{};
    canvas.width=CARD_ART_W; canvas.height=CARD_ART_H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,CARD_ART_W,CARD_ART_H);
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    ctx.save();
    ctx.clip();

    // Same night-sky radial gradient as .magic-card-overlay itself.
    const grad=ctx.createRadialGradient(CARD_ART_W*0.32,CARD_ART_H*0.2,30,CARD_ART_W*0.5,CARD_ART_H*0.5,CARD_ART_H*0.95);
    grad.addColorStop(0,'#232d5c');
    grad.addColorStop(0.55,'#141a38');
    grad.addColorStop(1,'#080a16');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,CARD_ART_W,CARD_ART_H);

    // A dense, varied decorative starfield — quiet texture. Deterministic
    // (a fixed seed sequence, not Math.random()) so a re-download of
    // the same card always looks the same.
    let seed=17;
    function nextRand(){ seed=(seed*9301+49297)%233280; return seed/233280; }
    for(let i=0;i<40;i++){
      const sx=nextRand()*CARD_ART_W, sy=nextRand()*CARD_ART_H;
      const r=0.6+nextRand()*1.5;
      ctx.beginPath();
      ctx.arc(sx,sy,r,0,Math.PI*2);
      ctx.fillStyle='rgba(238,241,255,'+(0.2+nextRand()*0.35).toFixed(2)+')';
      ctx.fill();
    }

    const hasCompanion=!!(card.companionName||opts.companionPortrait);

    // ---- Header ----
    ctx.textAlign='center';
    ctx.textBaseline='alphabetic';
    ctx.font='700 11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(255,203,69,0.6)';
    ctx.fillText('V I H U P L A N E T',CARD_ART_W/2,52);
    ctx.font='800 28px Georgia, serif';
    ctx.fillStyle=GOLD;
    ctx.fillText('✨ MAGIC CARD',CARD_ART_W/2,90);
    ctx.strokeStyle='rgba(255,255,255,0.16)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(70,108);
    ctx.lineTo(CARD_ART_W-70,108);
    ctx.stroke();

    // ---- Hero portrait: the bonded Companion, or a placeholder for a
    // companion-less card — a soft "world" glow sits behind it so the
    // window reads as a place, not a flat sticker. ----
    const heroCx=CARD_ART_W/2, heroCy=232, heroR=92;
    const worldGlow=ctx.createRadialGradient(heroCx,heroCy,10,heroCx,heroCy,heroR+70);
    worldGlow.addColorStop(0,'rgba(255,203,69,0.22)');
    worldGlow.addColorStop(0.55,'rgba(120,170,255,0.14)');
    worldGlow.addColorStop(1,'rgba(120,170,255,0)');
    ctx.fillStyle=worldGlow;
    ctx.fillRect(0,0,CARD_ART_W,CARD_ART_H);
    _portraitCircle(ctx,heroCx,heroCy,heroR,opts.companionPortrait||null,'✨',5);
    // A faint inner accent ring, echoing the frame's own double-line
    // treatment on the one circle that matters most.
    ctx.beginPath();
    ctx.arc(heroCx,heroCy,heroR-8,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.22)';
    ctx.lineWidth=1.5;
    ctx.stroke();

    let y=heroCy+heroR+56;
    ctx.fillStyle=CREAM;
    ctx.shadowColor='rgba(0,0,0,0.55)';
    ctx.shadowBlur=10;
    _fitText(ctx,hasCompanion?card.companionName:(card.nickname||'Star Traveler'),CARD_ART_W/2,y,CARD_ART_W-90,42,24,'800 __PX__px Georgia, serif');
    ctx.shadowBlur=0;

    y+=30;
    ctx.font='italic 400 17px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.68)';
    ctx.fillText(hasCompanion?(card.companionSpecies||'Your Story Companion'):'Awaiting a Story Companion',CARD_ART_W/2,y);

    // ---- Creator Info panel — only when there's a Companion to be
    // the OWNER of, mirroring the reference's "hero portrait above,
    // owner info below" hierarchy. A companion-less card has no such
    // distinction to draw, so it's skipped entirely there rather than
    // shown redundantly (the nickname is already the headline above). ----
    y+=30;
    if(hasCompanion){
      const px=48, pw=CARD_ART_W-96, ph=104;
      _panel(ctx,px,y,pw,ph,18);
      ctx.textAlign='left';
      ctx.textBaseline='alphabetic';
      ctx.font='700 18px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle=INK;
      ctx.fillText(card.nickname||'Star Traveler',px+22,y+32);
      ctx.font='600 12px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle='rgba(238,241,255,0.55)';
      ctx.fillText('YOUNG CREATOR',px+22,y+50);

      // Disclosed static placeholder — see this file's header comment.
      ctx.textAlign='right';
      ctx.font='700 16px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle=GOLD;
      ctx.fillText('⭐ Lv. 1',px+pw-22,y+34);

      ctx.textAlign='left';
      ctx.font='500 13px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle='rgba(238,241,255,0.55)';
      ctx.fillText('MEMBER SINCE '+_formatDate(card.claimedAt).toUpperCase(),px+22,y+78);

      // Disclosed static placeholder — see this file's header comment.
      ctx.textAlign='right';
      ctx.font='700 15px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle=GOLD;
      ctx.fillText('🪙 0',px+pw-22,y+79);

      y+=ph+30;
    }else{
      ctx.textAlign='center';
      ctx.font='400 15px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle='rgba(238,241,255,0.6)';
      ctx.fillText('Creator since '+_formatDate(card.claimedAt),CARD_ART_W/2,y+6);
      y+=34;
    }

    // Real, derived Stories/Worlds counts (MagicCard.growthSignals()'s
    // own {projectCount,worldCount}, passed in by the caller as
    // opts.counts — this module never reads CreatorProjectStore itself).
    if(opts.counts){
      ctx.textAlign='center';
      ctx.font='600 14px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle='rgba(238,241,255,0.6)';
      const stories=opts.counts.stories||0, worlds=opts.counts.worlds||0;
      ctx.fillText('📖 '+stories+' '+(stories===1?'Story':'Stories')+'  ·  🌍 '+worlds+' '+(worlds===1?'World':'Worlds'),CARD_ART_W/2,y+6);
      y+=32;
    }

    ctx.strokeStyle='rgba(255,255,255,0.16)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(60,y+8);
    ctx.lineTo(CARD_ART_W-60,y+8);
    ctx.stroke();
    ctx.font='italic 15px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.55)';
    ctx.fillText('Together, we’re brave, kind, and creative!',CARD_ART_W/2,y+32);
    y+=54;

    // ---- Guardian panel — Lumo greets every Creator during the
    // Creator Ceremony but bonds with none of them (Companion Canon V2),
    // so this panel is always present regardless of hasCompanion. ----
    const gpx=48, gpw=CARD_ART_W-96, gph=112;
    _panel(ctx,gpx,y,gpw,gph,18);
    const gcx=gpx+58, gcy=y+40, gr=32;
    _portraitCircle(ctx,gcx,gcy,gr,opts.guardianPortrait||null,'🐉',2.5);
    ctx.textAlign='left';
    ctx.font='700 16px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle=GOLD;
    ctx.fillText('LUMO',gcx+gr+18,gcy-3);
    ctx.font='500 12px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(238,241,255,0.6)';
    ctx.fillText('Guardian of Story Companions',gcx+gr+18,gcy+15);
    ctx.textAlign='center';
    ctx.font='italic 13px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.55)';
    ctx.fillText('Guard this signature. It is the key to your imagination.',CARD_ART_W/2,y+gph-16);

    y+=gph+22;

    // Quiet human-typeable fallback code — never the headline of the
    // card. recallCode (constellation+serial, e.g. "CYGNUS00042") is
    // the ONLY thing recall_magic_card()'s own typed-code branch
    // actually checks against — card.id (an internal random string)
    // would silently fail if typed back in, so it's never shown here.
    // recallCode is captured asynchronously after the card's first
    // successful cloud sync (js/magicCard.js's _captureRecallCode) —
    // omitted entirely, rather than shown wrong, until then.
    if(card.recallCode){
      ctx.textAlign='center';
      ctx.font='600 15px "SF Mono", Consolas, monospace';
      ctx.fillStyle='rgba(238,241,255,0.5)';
      ctx.fillText(card.recallCode,CARD_ART_W/2,Math.min(y,CARD_ART_H-34));
    }

    ctx.restore();
    _drawCardFrame(ctx);
  }

  // ---------- Back: the real, permanent constellation ----------
  function drawBack(canvas,card,opts){
    opts=opts||{};
    canvas.width=CARD_ART_W; canvas.height=CARD_ART_H;
    const ctx=canvas.getContext('2d');

    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    const grad=ctx.createRadialGradient(CARD_ART_W*0.35,CARD_ART_H*0.2,30,CARD_ART_W*0.5,CARD_ART_H*0.5,CARD_ART_H*0.9);
    grad.addColorStop(0,'#232d5c');
    grad.addColorStop(1,'#080a16');
    ctx.fillStyle=grad;
    ctx.fill();

    ctx.save();
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,36);
    ctx.clip();

    ctx.textAlign='center';
    ctx.textBaseline='alphabetic';
    ctx.font='700 26px Georgia, serif';
    ctx.fillStyle=GOLD;
    ctx.fillText('✦ YOUR CREATOR SIGNATURE ✦',CARD_ART_W/2,76);
    ctx.font='italic 15px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.7)';
    const subtitleBottom=_wrapCentered(ctx,'This constellation is your secret code. It connects you to VihuPlanet.',CARD_ART_W/2,106,CARD_ART_W-160,22,2);

    const gridTop=Math.max(150,subtitleBottom+40), gridSize=CARD_ART_W-160, cell=gridSize/10;
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
        ctx.shadowColor=GOLD;
        ctx.shadowBlur=16;
        ctx.fillStyle=CREAM;
        ctx.font='30px sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('★',p.x,p.y);
      });
      ctx.shadowBlur=0;

      ctx.textBaseline='alphabetic';
      ctx.font='italic 700 22px Georgia, serif';
      ctx.fillStyle=GOLD;
      ctx.fillText('✦ '+(card.constellation||'')+' ✦',CARD_ART_W/2,gridTop+gridSize+44);
    }else{
      // A typed-code recall never learns the real pattern (the RPC
      // never returns it, by design — see supabase/schema.sql's
      // recall_magic_card) — an honest empty state instead of
      // fabricating stars this device doesn't actually know.
      ctx.font='italic 20px Georgia, serif';
      ctx.fillStyle='rgba(238,241,255,0.75)';
      ctx.fillText('No sky to show yet on this device.',CARD_ART_W/2,gridTop+gridSize/2);
    }

    // ---- SERIAL# / Guardian panel row — mirrors the reference's own
    // two-panel layout beneath the grid. "SERIAL#" is the real,
    // already-correct recallCode (constellation+serial), never a
    // separate register mechanic — nothing in this platform lets a
    // physical card be "registered," so the copy stays honest about
    // what tapping/typing it actually does (recall, not register). ----
    const rowY=gridTop+gridSize+70, rowH=100, gap=16;
    const rowX=48, rowW=CARD_ART_W-96, halfW=(rowW-gap)/2;

    _panel(ctx,rowX,rowY,halfW,rowH,16);
    ctx.textAlign='left';
    ctx.font='700 11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(255,203,69,0.65)';
    ctx.fillText('SERIAL#',rowX+18,rowY+26);
    ctx.textAlign='center';
    if(card.recallCode){
      ctx.font='700 18px "SF Mono", Consolas, monospace';
      ctx.fillStyle=CREAM;
      ctx.fillText(card.recallCode,rowX+halfW/2,rowY+56);
    }else{
      ctx.font='italic 14px Georgia, serif';
      ctx.fillStyle='rgba(238,241,255,0.55)';
      ctx.fillText('Code syncing…',rowX+halfW/2,rowY+56);
    }
    ctx.font='400 11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(238,241,255,0.5)';
    ctx.fillText('Type this to come home',rowX+halfW/2,rowY+80);

    const gpx=rowX+halfW+gap;
    _panel(ctx,gpx,rowY,halfW,rowH,16);
    const gcx=gpx+40, gcy=rowY+rowH/2, gr=26;
    _portraitCircle(ctx,gcx,gcy,gr,opts.guardianPortrait||null,'🐉',2);
    ctx.textAlign='left';
    ctx.font='700 14px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle=GOLD;
    ctx.fillText('LUMO',gcx+gr+14,gcy-4);
    ctx.font='500 11px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle='rgba(238,241,255,0.6)';
    ctx.textAlign='left';
    ctx.fillText('Guardian of',gcx+gr+14,gcy+12);
    ctx.fillText('Creators',gcx+gr+14,gcy+26);

    ctx.textAlign='center';
    ctx.font='italic 15px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.6)';
    ctx.fillText('Guard this signature. It is the key to your imagination.',CARD_ART_W/2,rowY+rowH+40);

    ctx.restore();
    _drawCardFrame(ctx);
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
    resolveCompanionPortrait:resolveCompanionPortrait,
    drawFront:drawFront,
    drawBack:drawBack,
    downloadDataURL:downloadDataURL,
    printCard:printCard
  };
  try{ window.MagicCardArt=api; }catch(e){}
  return api;
})();
