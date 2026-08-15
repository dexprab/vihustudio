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

  // Real Trading Card Game (TCG) print standard -- the industry-
  // standard "poker size" trim (2.5in x 3.5in, matching Magic: The
  // Gathering / Pokemon / Yu-Gi-Oh) every real card-printing vendor
  // (MakePlayingCards, DriveThruCards, etc.) builds to, their commonly-
  // cited minimum accepted print resolution (300 DPI -- "true print
  // quality," matching this codebase's own established Publish Quality
  // precedent for exactly this threshold), and the standard 1/8in
  // (0.125in) die-cut corner radius real card-cutting equipment uses.
  // CARD_ART_W/CARD_ART_H stay the original design/logical drawing
  // coordinate space (5:7 ratio, unchanged) every draw call below is
  // already hand-tuned against; only the real <canvas> pixel buffer
  // (CARD_PIXEL_W/CARD_PIXEL_H) and one uniform ctx.scale()
  // (CARD_RENDER_SCALE) change, so the whole design renders identically,
  // just at true 300 DPI native resolution instead of a lower-DPI image
  // blurrily upscaled after the fact -- the same intrinsic canvas
  // pixels are what both the on-screen preview (scaled down via CSS)
  // and the downloaded/printed PNG use, so "what you see is what
  // prints." Kept in lockstep by hand with the sibling World Card
  // implementation (tools/world-builder-v2/js/worldBuilderApp.js's own
  // identical constants), per this codebase's own established
  // "no cross-tool sharing, mirror instead" discipline for card art --
  // a future card type follows this identical pattern.
  const CARD_ART_W=700, CARD_ART_H=980;

  // WHERE THE CONSTELLATION SITS ON THE BACK OF THE CARD.
  //
  // One definition, used by the art that DRAWS the card and by the
  // camera that READS it (js/magicCardVision.js). Two copies of this
  // would drift the first time the card's layout was touched, and the
  // failure would be silent: a card that still looks right and stops
  // being recognisable.
  //
  // `subtitleBottom` is where the wrapped subtitle ended, which only
  // drawBack knows. The default has to produce the SAME geometry, since
  // a caller that has not drawn anything — the camera — gets no better
  // information.
  //
  // IT DID NOT. The default was 150, which drove gridTop to 190, while
  // the subtitle actually fits on one line and ends at 106, putting the
  // drawn grid at 150. Forty card pixels apart, three quarters of a
  // cell, and vertical — which is exactly the shape of the complaint it
  // caused: "all seven stars recognised but the pattern is off", off by
  // a row. The old comment asserted the two agreed; measuring them was
  // what showed they never had.
  //
  // The measured value goes in, so the no-argument case lands on the
  // same 150 the art draws. Note the floor is doing the work here: at
  // this font and width the subtitle is one line and 106+40 is under
  // 150, so both paths take the floor and agree exactly. If that text
  // or its size ever changes enough to wrap to two lines, drawBack will
  // move the grid and this default must move with it.
  function _backGridGeometry(subtitleBottom){
    const gridSize=CARD_ART_W-160;
    const bottom=(typeof subtitleBottom==='number')?subtitleBottom:106;
    return {
      cardW:CARD_ART_W,
      cardH:CARD_ART_H,
      gridSize:gridSize,
      gridLeft:(CARD_ART_W-gridSize)/2,
      gridTop:Math.max(150,bottom+40),
      cell:gridSize/10,
      cells:10
    };
  }
  const CARD_PRINT_DPI=300;
  const CARD_TRIM_IN_W=2.5, CARD_TRIM_IN_H=3.5;
  const CARD_PIXEL_W=Math.round(CARD_TRIM_IN_W*CARD_PRINT_DPI);
  const CARD_PIXEL_H=Math.round(CARD_TRIM_IN_H*CARD_PRINT_DPI);
  const CARD_RENDER_SCALE=CARD_PIXEL_W/CARD_ART_W;
  // The real, standard TCG die-cut corner radius (1/8in), expressed in
  // the original design coordinate space so every existing draw call's
  // own literal numbers keep working unchanged.
  const CARD_CORNER_RADIUS=Math.round((0.125/CARD_TRIM_IN_W)*CARD_ART_W);
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
    canvas.width=CARD_PIXEL_W; canvas.height=CARD_PIXEL_H;
    const ctx=canvas.getContext('2d');
    ctx.scale(CARD_RENDER_SCALE,CARD_RENDER_SCALE);
    ctx.clearRect(0,0,CARD_ART_W,CARD_ART_H);
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,CARD_CORNER_RADIUS);
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
    canvas.width=CARD_PIXEL_W; canvas.height=CARD_PIXEL_H;
    const ctx=canvas.getContext('2d');
    ctx.scale(CARD_RENDER_SCALE,CARD_RENDER_SCALE);

    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,CARD_CORNER_RADIUS);
    const grad=ctx.createRadialGradient(CARD_ART_W*0.35,CARD_ART_H*0.2,30,CARD_ART_W*0.5,CARD_ART_H*0.5,CARD_ART_H*0.9);
    grad.addColorStop(0,'#232d5c');
    grad.addColorStop(1,'#080a16');
    ctx.fillStyle=grad;
    ctx.fill();

    ctx.save();
    _roundRectPath(ctx,0,0,CARD_ART_W,CARD_ART_H,CARD_CORNER_RADIUS);
    ctx.clip();

    ctx.textAlign='center';
    ctx.textBaseline='alphabetic';
    ctx.font='700 26px Georgia, serif';
    ctx.fillStyle=GOLD;
    ctx.fillText('✦ YOUR CREATOR SIGNATURE ✦',CARD_ART_W/2,76);
    ctx.font='italic 15px Georgia, serif';
    ctx.fillStyle='rgba(238,241,255,0.7)';
    const subtitleBottom=_wrapCentered(ctx,'This constellation is your secret code. It connects you to VihuPlanet.',CARD_ART_W/2,106,CARD_ART_W-160,22,2);

    const _geo=_backGridGeometry(subtitleBottom);
    const gridTop=_geo.gridTop, gridSize=_geo.gridSize, cell=_geo.cell;
    const gridLeft=_geo.gridLeft;

    if(card.pattern && card.pattern.length){
      // THE TRACE IS DERIVED FOR DRAWING, NEVER READ FROM STORAGE.
      //
      // A card's stars are its identity and are stored; the ORDER they
      // are joined in is a rendering decision, and this used to take it
      // straight from the stored array. That made the card's appearance
      // depend on a mutable field's ordering — so when an old migration
      // reordered patterns in place, every card silently redrew itself
      // with a different line, and a card printed before that no longer
      // matched the one on screen. Reported as the constellation looking
      // upside down, with the stars themselves provably identical.
      //
      // Deriving it here ends that whole class of drift: the same cells
      // always draw the same constellation, whatever order they happen
      // to be stored in, so the printed card and the screen cannot come
      // apart again. Nothing is written — this reorders a local copy for
      // the length of one draw.
      //
      // Guarded because magicCardArt must keep working with MagicCard
      // absent (the camera test harnesses draw cards with neither), and
      // an unrecognised sky is drawn exactly as given: a hand-drawn
      // pattern is whatever its owner drew.
      let ordered=card.pattern;
      try{
        if(typeof MagicCard!=='undefined' && MagicCard.orderLikeAnySky){
          ordered=MagicCard.orderLikeAnySky(card.pattern)||card.pattern;
        }
      }catch(e){ ordered=card.pattern; }
      const pts=ordered.map(function(p){
        return {x:gridLeft+(p[1]+0.5)*cell, y:gridTop+(p[0]+0.5)*cell};
      });

      // THE CHART SITS ON ITS OWN FIELD OF SKY.
      //
      // Photographed, this card was 0.39 average brightness and the
      // ruled frame was simply not there — "CHART NOT FOUND" from a
      // picture in which a person could read the stars perfectly well.
      // A thin stroke on near-black gives a local threshold nothing to
      // work with once a lens and an auto-exposure have had their way
      // with it.
      //
      // So the chart's square is filled, a shade lighter than the card
      // around it. It reads as the patch of sky the constellation lives
      // in — which is what it is — and for the camera it turns the
      // frame from "a faint line on black" into "the boundary between
      // two clearly different regions", which is the thing edge
      // detection is actually good at.
      ctx.save();
      const field=ctx.createLinearGradient(0,gridTop,0,gridTop+gridSize);
      field.addColorStop(0,'rgba(96,116,178,0.30)');
      field.addColorStop(1,'rgba(58,72,124,0.30)');
      ctx.fillStyle=field;
      ctx.fillRect(gridLeft,gridTop,gridSize,gridSize);
      ctx.restore();

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

      // ---------------------------------------------------------------
      // A CARD A CAMERA CAN READ.
      //
      // The back of this card was drawn to be looked at by a child, and
      // it is now also looked at by a camera (js/magicCardVision.js).
      // Photographed in a real room it defeated five rounds of reader:
      // the stars were small ★ glyphs in cream on near-black, at a
      // contrast that survives neither a phone's exposure nor the
      // downscale a live camera pass needs, and the joining line ran
      // straight THROUGH every one of them, so the seven stars merged
      // into a single shape.
      //
      // Three changes, none of which alters what the card means:
      //
      //   - the stars are solid white discs, and larger. A disc has a
      //     middle that survives blur, where a glyph's thin arms do
      //     not, and white against this navy is the strongest contrast
      //     the card can offer.
      //   - the joining line is thinner and fainter, and is drawn
      //     UNDER the stars rather than across them, so it still reads
      //     as a constellation to a child without welding the stars
      //     into one blob for the camera.
      //   - four corner marks bound the grid. They are what makes a
      //     reading EXACT: a pattern sits at a random offset on the
      //     grid, so without knowing where the grid begins a lattice
      //     shifted by one cell fits just as well as the true one, and
      //     the reader has to offer dozens of guesses. With the corners
      //     visible there is nothing left to guess.
      // ---------------------------------------------------------------
      if(pts.length>1){
        ctx.strokeStyle='rgba(255,203,69,0.22)';
        ctx.lineWidth=1.2;
        ctx.beginPath();
        pts.forEach(function(p,i){ if(i===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
        ctx.stroke();
      }

      // A STAR CHART'S FRAME, not four squares stuck on.
      //
      // The corner marks worked for the camera and looked like what
      // they were — hardware bolted to a keepsake. This does the same
      // job and belongs on the card: a clean ruled frame around the
      // grid, the way a real star chart is bordered, with the rows and
      // columns numbered along it.
      //
      // For the reader it is BETTER than the squares were. Four
      // separate marks had to be found among the card's other bright
      // furniture and then matched up; a frame is one continuous shape
      // enclosing everything else, so its corners are simply the
      // corners of the largest hollow thing on the card. Those four
      // points give the exact transform (js/magicCardVision.js).
      // THE FRAME OPENS AT THE CORNERS, and that is not decoration.
      //
      // The guide stars sit exactly ON the grid's corners, which is what
      // makes them exact — and a continuous strokeRect runs straight
      // through all four. Measured on a clean, flat, full-size render:
      // fourteen marks, of which the four biggest were 613 down to 527
      // and were the SEVEN pattern stars. The guide stars were not in
      // the list at all, because each had been swallowed by the frame it
      // touched and the whole thing was one connected shape.
      //
      // So each side stops short of the corner. The gap clears the
      // guide star's own points with room to spare, which keeps the four
      // of them separate blobs — and a ruled chart with open corners,
      // each held by a bright star, is the older and better looking of
      // the two drawings anyway.
      const guideR=Math.max(11,cell*0.34)*1.9;
      const openGap=guideR+10;
      ctx.save();
      ctx.strokeStyle='rgba(255,246,221,0.92)';
      ctx.lineWidth=3;
      ctx.lineCap='round';
      [[gridLeft+openGap,gridTop,gridLeft+gridSize-openGap,gridTop],
       [gridLeft+gridSize,gridTop+openGap,gridLeft+gridSize,gridTop+gridSize-openGap],
       [gridLeft+gridSize-openGap,gridTop+gridSize,gridLeft+openGap,gridTop+gridSize],
       [gridLeft,gridTop+gridSize-openGap,gridLeft,gridTop+openGap]]
      .forEach(function(seg){
        ctx.beginPath();
        ctx.moveTo(seg[0],seg[1]);
        ctx.lineTo(seg[2],seg[3]);
        ctx.stroke();
      });
      ctx.restore();

      // Rows down the side, columns along the top — the same numbering
      // the drawing board shows, so a child reading their card and a
      // child marking their stars are looking at the same thing.
      ctx.save();
      // Faint on purpose. The numbering is for a child's eye at
      // reading distance, and it is the one thing on this card that
      // must NOT look like a star to the camera — reported from a real
      // lens, fourteen marks on a seven-star card, because gold at two
      // thirds opacity blurs into something as bright as white. At a
      // third it stays legible in the hand and stops competing.
      ctx.fillStyle='rgba(255,203,69,0.34)';
      ctx.font='500 15px Georgia, serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      for(let gi=0;gi<10;gi++){
        const mid=(gi+0.5)*cell;
        // Clear of the corner guide stars, which are large by
        // necessity and sat on top of the "1" of each run.
        ctx.fillText(String(gi+1), gridLeft+mid, gridTop-30);
        ctx.fillText(String(gi+1), gridLeft-30, gridTop+mid);
      }
      ctx.restore();

      // REAL STARS, drawn thick enough to be seen.
      //
      // The original ★ glyph was the right shape and the wrong weight:
      // small, and with arms thin enough that a camera lost them
      // entirely — that is what defeated the first five readers. A
      // circle survived the camera and was not a star, which is not a
      // trade worth making on a child's keepsake.
      //
      // So: a real five-pointed star, drawn as a filled polygon at a
      // size that leaves a solid middle. The inner radius is half the
      // outer, which is a full-bodied star rather than a spindly one,
      // and the middle is what survives blur and distance.
      function starPath(cxp,cyp,outer){
        const inner=outer*0.5;
        ctx.beginPath();
        for(let sp=0;sp<10;sp++){
          const r=(sp%2===0)?outer:inner;
          const a=-Math.PI/2 + sp*Math.PI/5;
          const px=cxp+Math.cos(a)*r, py=cyp+Math.sin(a)*r;
          if(sp===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath();
      }
      // ---------------------------------------------------------------
      // THE FOUR GUIDE STARS.
      //
      // Approved by the product owner as an amendment to Decisions 11
      // and 16, which until now said the Magic Card is not redesigned.
      // The reason is measured rather than aesthetic: a pattern sits at
      // a RANDOM OFFSET on the grid, so the absolute cells are part of
      // the identity, and without knowing exactly where the grid begins
      // a lattice shifted by one cell fits precisely as well as the true
      // one. Every version of this reader has had to infer that origin
      // from the stars themselves and has sometimes inferred it wrong —
      // which is what "all seven stars found, pattern still off" is.
      //
      // Four stars at the four corners of the chart end the inference.
      // They are at known coordinates by construction, so they give the
      // projective transform outright, and everything after that is
      // arithmetic rather than search.
      //
      // WHY THEY ARE NOT THE OLD CORNER MARKS. The card carried four
      // white squares once and they were removed for looking like
      // hardware bolted to a keepsake — the product owner's words were
      // "ugly squares". These are stars, drawn with the same five-point
      // path as every other star on the card, because the corners of a
      // star chart being marked by brighter stars is what a star chart
      // looks like. A child sees four bright stars holding the corners
      // of their sky. Nothing about the card announces a machine.
      //
      // THEY MUST NOT BE MISTAKEN FOR THE CONSTELLATION. They are drawn
      // at 1.9x the radius of a pattern star, which is a wide, reliable
      // gap for the size filter — the earlier failure was corner marks
      // the SAME size as stars, so a five-star sky arrived as nine marks
      // and matched nothing. Sitting exactly on the grid's corners, they
      // are also outside every cell centre, so even if one were treated
      // as a star it could not land on a cell.
      const guide=guideR;
      [[gridLeft,gridTop],[gridLeft+gridSize,gridTop],
       [gridLeft+gridSize,gridTop+gridSize],[gridLeft,gridTop+gridSize]]
      .forEach(function(g){
        ctx.save();
        ctx.shadowColor='rgba(255,232,178,0.95)';
        ctx.shadowBlur=16;
        ctx.fillStyle='#FFFDF4';
        starPath(g[0],g[1],guide);
        ctx.fill();
        ctx.restore();
      });
      ctx.shadowBlur=0;

      pts.forEach(function(p){
        ctx.save();
        ctx.shadowColor='rgba(255,214,128,0.9)';
        ctx.shadowBlur=10;
        ctx.fillStyle='#FFFFFF';
        starPath(p.x,p.y,Math.max(11,cell*0.34));
        ctx.fill();
        ctx.restore();
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
    // "print for magic card not working" -- a real, confirmed race:
    // window.print() used to fire on the very next line after setting
    // img.src, with no wait for the browser to actually decode the
    // data: URI into pixels first. A data: URI still needs real decode
    // work (it isn't instant just because there's no network fetch),
    // and print rendering could capture the sheet before either image
    // finished — the exact "two blank placeholder rectangles" the print
    // preview showed. img.decode() is a real Promise the browser only
    // resolves once fully decoded; a plain onload-based wait is the
    // fallback for a browser without decode() support.
    function ready(img){
      if(typeof img.decode==='function') return img.decode().catch(function(){});
      return new Promise(function(resolve){
        if(img.complete) resolve();
        else img.addEventListener('load',resolve,{once:true});
      });
    }
    Promise.all([ready(imgFront),ready(imgBack)]).then(function(){
      window.print();
      setTimeout(cleanup,5000);
    });
  }

  const api={
    CARD_ART_W:CARD_ART_W,
    CARD_ART_H:CARD_ART_H,
    resolveCompanionPortrait:resolveCompanionPortrait,
    drawFront:drawFront,
    drawBack:drawBack,
    // Shared with the camera that reads a printed card — see the
    // function's own comment.
    backGridGeometry:_backGridGeometry,
    downloadDataURL:downloadDataURL,
    printCard:printCard
  };
  try{ window.MagicCardArt=api; }catch(e){}
  return api;
})();
