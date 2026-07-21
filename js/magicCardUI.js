// magicCardUI.js — Magic Card Identity Evolution, Phase 1 UI.
//
// The presentation layer over js/magicCard.js's local data model,
// implementing the specific screens the design document scoped for
// Phase 1: Screen 2 (Returning Creator) / Screen 9 (Shared Device) as
// one combined "Identity Gate" shown at boot only once a claimed card
// exists; Screen 5-7 (the Awakening -> Claim -> First Claimed Moment
// ceremony) triggered once from Publish Studio's first-ever Publish;
// Screen 11 (Magic Card Home) reachable from a small header glyph.
//
// Screen 1 (Welcome) and Screen 3 (Traveller Entry) are deliberately NOT
// built here — the design document itself says Screen 1 is skipped
// entirely when zero Magic Cards are known on a device, landing
// straight on Screen 3, which is byte-for-byte identical to Creator's
// existing Creation Flow Screen 1 ("What shall we create today?").
// Building a second, parallel Screen 1/3 would duplicate real, already-
// shipped UI for a state (zero claimed cards) that is the common case
// until a family's first claim — so the zero-card path is simply left
// as today's unmodified boot sequence.
//
// Phase 1 disclosed scope, stated plainly rather than silently implied:
// this is 100% local (no Supabase, no cross-device recall). The Screen
// 9 shared-device picker is presentational/recognition only — picking
// a profile does not yet partition which local projects are visible,
// since My Projects (js/creatorProjectStore.js) has no per-identity
// data separation today. Real per-child data separation is named,
// explicitly, as later work in the design document's own Section 15
// (Edge Cases / Multiple Children) and Section 3 (Design Synthesis) —
// not glossed over here.
//
// Traveller Gateway Rework V1.1: checkIdentityGate() (this file's own
// standalone Welcome/Picker screens) is no longer js/app.js's primary
// boot-time identity check — every launch now runs the Traveller Gateway
// first (js/gatewaySequence.js), whose own Scene 3 resolves identity via
// the leaner beginCreatorSignature(card, onResult) below instead (the
// SAME tap-grid pattern challenge, reused rather than reimplemented, but
// skipping straight to the challenge — no Welcome/Picker screens, no
// second "recognize me" moment). checkIdentityGate() itself is untouched
// and still fully functional — it survives as js/app.js's own
// _afterGateway() fallback for the one case where the Gateway can't be
// reached at all.
const MagicCardUI=(function(){
  'use strict';

  let overlay=null, content=null;
  let _headerBadge=null;

  function _ensureDom(){
    if(overlay) return;
    overlay=document.getElementById('magicCardOverlay');
    content=document.getElementById('magicCardContent');
    // A purely decorative, ambient starfield behind every screen this
    // overlay shows (Welcome/Picker/Challenge/Home/Awakening alike) —
    // "make the entire page feel like a night sky." Inserted once,
    // first in DOM order (so #magicCardContent, added later, naturally
    // paints above it with no z-index needed), a real background-image
    // layer rather than per-star DOM nodes so it can never re-trigger
    // the transform-driven scrollable-overflow bug this file's own
    // tap-grid glow already had to work around once.
    if(!overlay.querySelector('.magic-card-starfield')){
      const sf=document.createElement('div');
      sf.className='magic-card-starfield';
      sf.setAttribute('aria-hidden','true');
      overlay.insertBefore(sf,overlay.firstChild);
    }
  }
  function _clear(){ content.innerHTML=''; }
  function _show(){ overlay.classList.remove('hidden'); }
  function _hide(){ overlay.classList.add('hidden'); }

  function _el(tag,className,text){
    const e=document.createElement(tag);
    if(className) e.className=className;
    if(text!==undefined) e.textContent=text;
    return e;
  }

  // ---------- Shared: constellation SVG (decorative — no tap
  // interaction in Phase 1, since there is no cross-device recall yet
  // for a tap gesture to serve) ----------
  function _renderConstellation(pattern,opts){
    opts=opts||{};
    const size=opts.size||220;
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox','0 0 10 10');
    svg.setAttribute('width',size);
    svg.setAttribute('height',size);
    svg.setAttribute('class','magic-card-constellation-svg'+(opts.className?(' '+opts.className):''));
    const pts=(pattern||[]).map(function(p){ return {x:p[1]+0.5,y:p[0]+0.5}; });
    // Companion (decorative-only, growth-derived) faint stars, drawn
    // first so they sit visually behind the real, fixed core pattern.
    const companions=opts.companionCount||0;
    for(let i=0;i<companions;i++){
      const cx=(i*2.7+1.3)%9+0.5, cy=(i*1.9+2.1)%9+0.5;
      const c=document.createElementNS(svgNS,'circle');
      c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r',0.09);
      c.setAttribute('class','magic-card-star magic-card-star-companion');
      c.style.animationDelay=(0.05*i)+'s';
      svg.appendChild(c);
    }
    // Connecting lines, in pattern order — the permanent, fixed core.
    for(let i=0;i<pts.length-1;i++){
      const line=document.createElementNS(svgNS,'line');
      line.setAttribute('x1',pts[i].x); line.setAttribute('y1',pts[i].y);
      line.setAttribute('x2',pts[i+1].x); line.setAttribute('y2',pts[i+1].y);
      line.setAttribute('class','magic-card-star-line');
      if(opts.animate) line.style.animationDelay=(pts.length*0.22+i*0.15)+'s';
      svg.appendChild(line);
    }
    pts.forEach(function(p,i){
      const c=document.createElementNS(svgNS,'circle');
      c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',0.22);
      c.setAttribute('class','magic-card-star magic-card-star-core');
      if(opts.animate) c.style.animationDelay=(i*0.22)+'s';
      svg.appendChild(c);
    });
    return svg;
  }

  // ---------- Shared: two-sided card art view (front/back canvases +
  // Download/Print) — used both in the Awakening ceremony's First
  // Claimed Moment and as Magic Card Home's own primary content, so
  // the two surfaces can never visually disagree.
  //
  // opts.gateBack (Home only — the ceremony call site never sets this,
  // since that's the one legitimate "save it now" moment, same as a
  // 2FA app showing backup codes once at generation time): the Back
  // face — the real recall pattern — renders blurred behind a "Tap to
  // Reveal" overlay, with Download Back/Print disabled until revealed.
  // A device left unlocked on Magic Card Home can no longer silently
  // hand over another child's recall credential with a single glance
  // or one accidental tap. ----------
  function _buildCardArtView(card,opts){
    opts=opts||{};
    const gateBack=!!opts.gateBack;
    const wrap=_el('div','magic-card-art-view');
    if(typeof MagicCardArt==='undefined') return wrap;

    const row=_el('div','magic-card-art-row');
    const frontWrap=_el('div','magic-card-art-col');
    frontWrap.appendChild(_el('div','magic-card-art-label','Front'));
    const frontCanvas=document.createElement('canvas');
    frontCanvas.className='magic-card-art-canvas';
    frontWrap.appendChild(frontCanvas);
    row.appendChild(frontWrap);

    const backWrap=_el('div','magic-card-art-col');
    backWrap.appendChild(_el('div','magic-card-art-label','Back'));
    const backStage=_el('div','magic-card-art-back-stage');
    const backCanvas=document.createElement('canvas');
    backCanvas.className='magic-card-art-canvas';
    backStage.appendChild(backCanvas);
    let revealBtn=null;
    if(gateBack){
      backCanvas.classList.add('magic-card-art-canvas-secret');
      revealBtn=_el('button','magic-card-art-reveal-btn');
      revealBtn.type='button';
      revealBtn.appendChild(_el('span','magic-card-art-reveal-glyph','🔒'));
      revealBtn.appendChild(_el('span','magic-card-art-reveal-label','Tap to Reveal'));
      backStage.appendChild(revealBtn);
    }
    backWrap.appendChild(backStage);
    row.appendChild(backWrap);
    wrap.appendChild(row);

    // Companion Canon V2 — "Stories Created"/"Worlds Created," derived
    // live from MagicCard.growthSignals() (never a second stored
    // counter — see that function's own comment) and handed to
    // drawFront() as plain data; this module never reads
    // CreatorProjectStore itself.
    const counts={stories:0,worlds:0};
    try{
      if(typeof MagicCard!=='undefined' && MagicCard.growthSignals){
        const g=MagicCard.growthSignals();
        counts.stories=g.projectCount||0;
        counts.worlds=g.worldCount||0;
      }
    }catch(e){}

    MagicCardArt.drawFront(frontCanvas,card,{counts:counts});
    MagicCardArt.drawBack(backCanvas,card);

    // The bonded companion's own portrait is a real, async image fetch
    // — draw the Front immediately without it (progressive, never
    // blocking), then redraw once it resolves. A companion whose art
    // hasn't been uploaded yet (Nimbus/Quill's own disclosed gap)
    // simply never resolves — the Front keeps its placeholder glyph,
    // exactly the same graceful degradation CompanionEngine itself
    // already relies on for a missing state image.
    let companionPortrait=null, guardianPortrait=null;
    function _redrawWithPortraits(){
      MagicCardArt.drawFront(frontCanvas,card,{counts:counts,companionPortrait:companionPortrait,guardianPortrait:guardianPortrait});
      MagicCardArt.drawBack(backCanvas,card,{guardianPortrait:guardianPortrait});
    }
    if(card.companionId && typeof MagicCardArt.resolveCompanionPortrait==='function'){
      MagicCardArt.resolveCompanionPortrait(card.companionId).then(function(portrait){
        if(!portrait) return;
        companionPortrait=portrait;
        _redrawWithPortraits();
      });
    }
    // Lumo's Guardian panel appears on both faces regardless of
    // hasCompanion — resolved the identical way, with the fixed id
    // 'lumo' (real, already-uploaded art), never card.companionId.
    if(typeof MagicCardArt.resolveCompanionPortrait==='function'){
      MagicCardArt.resolveCompanionPortrait('lumo').then(function(portrait){
        if(!portrait) return;
        guardianPortrait=portrait;
        _redrawWithPortraits();
      });
    }

    if(gateBack){
      wrap.appendChild(_el('p','magic-card-art-reveal-note',
        '🔒 The back is your secret key — anyone who sees it can become you on another device. Tap Reveal before saving or printing it.'));
    }

    const actions=_el('div','magic-card-art-actions');
    const dlFront=_el('button','magic-card-art-btn','⬇ Front');
    dlFront.type='button';
    dlFront.addEventListener('click',function(){
      MagicCardArt.downloadDataURL(frontCanvas.toDataURL('image/png'),(card.id||'magic-card')+'-front.png');
    });
    const dlBack=_el('button','magic-card-art-btn','⬇ Back');
    dlBack.type='button';
    dlBack.addEventListener('click',function(){
      if(dlBack.disabled) return;
      MagicCardArt.downloadDataURL(backCanvas.toDataURL('image/png'),(card.id||'magic-card')+'-back.png');
    });
    const printBtn=_el('button','magic-card-art-btn','🖨 Print');
    printBtn.type='button';
    printBtn.addEventListener('click',function(){
      if(printBtn.disabled) return;
      MagicCardArt.printCard(frontCanvas.toDataURL('image/png'),backCanvas.toDataURL('image/png'));
    });

    if(gateBack){
      dlBack.disabled=true;
      printBtn.disabled=true;
      revealBtn.addEventListener('click',function(){
        backCanvas.classList.remove('magic-card-art-canvas-secret');
        revealBtn.remove();
        dlBack.disabled=false;
        printBtn.disabled=false;
      });
    }

    actions.appendChild(dlFront);
    actions.appendChild(dlBack);
    actions.appendChild(printBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  // ---------- Header glyph ----------
  function refreshHeaderBadge(){
    // Every call site that already refreshes the header badge is
    // exactly the same moment a Traveller may have just become a
    // Creator (claim/rename/rehydrate/boot) — TravellerSaveNotice's own
    // "no active Magic Card" gate needs to know the instant that
    // happens too, rather than waiting for the next unrelated page
    // notify() to catch up.
    if(typeof TravellerSaveNotice!=='undefined'){ try{ TravellerSaveNotice.refresh(); }catch(e){} }
    if(!_headerBadge) _headerBadge=document.getElementById('magicCardBadge');
    if(!_headerBadge) return;
    const active=(typeof MagicCard!=='undefined')?MagicCard.getActive():null;
    if(!active){ _headerBadge.classList.add('hidden'); return; }
    _headerBadge.classList.remove('hidden');
    _headerBadge.innerHTML='';
    // Ambient/passive display — never the real recall pattern (see
    // MagicCard.decorativeSkyFor's own comment). The header badge is
    // permanently on-screen the whole time a card is active, the
    // single worst possible surface to leak a tappable credential from.
    _headerBadge.appendChild(_renderConstellation(MagicCard.decorativeSkyFor(active).pattern,{size:26}));
    _headerBadge.onclick=function(){ openHome(); };
  }

  // ---------- Screen 11 — Magic Card Home ----------
  function openHome(){
    const active=MagicCard.getActive();
    if(!active) return;
    MagicCard.touch(active.id);
    _ensureDom();
    _clear();
    overlay.classList.add('magic-card-mode-home');
    _show();

    const panel=_el('div','magic-card-home-panel');
    const back=_el('button','magic-card-back','← Studio');
    back.type='button';
    back.addEventListener('click',function(){ overlay.classList.remove('magic-card-mode-home'); _hide(); });
    panel.appendChild(back);

    // The two-sided identity card itself leads Home, rather than a
    // separate ambient "sky" rendered above it. Those used to be two
    // different-looking constellations shown on one screen at once —
    // decorativeSkyFor()'s safe stand-in up top, the real pattern down
    // below on the reveal-gated card — which read as a genuine bug
    // ("my card is showing 2 constellations"), not a feature. Leading
    // with the real card (Back still reveal-gated, so nothing secret is
    // exposed by default) means there is only ever one thing on this
    // screen that looks like "the constellation."
    panel.appendChild(_buildCardArtView(active,{gateBack:true}));

    panel.appendChild(_el('div','magic-card-home-name',(active.nickname||'Star Traveler')));
    const since=new Date(active.claimedAt);
    const sinceText='Creator since '+since.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
    panel.appendChild(_el('div','magic-card-home-since',sinceText));

    const storiesLabel=_el('div','magic-card-home-stories-label','A few of your stories live in this sky:');
    panel.appendChild(storiesLabel);
    const grid=_el('div','magic-card-home-stories-grid');
    let projects=[];
    try{ if(typeof CreatorProjectStore!=='undefined') projects=CreatorProjectStore.list().slice(0,8); }catch(e){}
    if(!projects.length){
      grid.appendChild(_el('div','magic-card-home-stories-empty','Nothing yet — your next story will show up here.'));
    }else{
      projects.forEach(function(p){
        const card=_el('div','magic-card-home-story-thumb');
        if(p.thumbnail){
          const img=document.createElement('img');
          img.src=p.thumbnail;
          card.appendChild(img);
        }else{
          card.appendChild(_el('span','magic-card-home-story-glyph','📖'));
        }
        grid.appendChild(card);
      });
    }
    panel.appendChild(grid);

    content.appendChild(panel);
  }

  // ---------- Identity glyph (never the constellation pattern) ----------
  // The Identity Gate ("Welcome back") and the multi-card picker are
  // both boot-time, unprompted surfaces shown to anyone who opens the
  // app on this device. An earlier fix already swapped the REAL recall
  // pattern for decorativeSkyFor()'s safe stand-in here — but a
  // connect-the-dots constellation graphic looks identical either way,
  // real or decorative, and reads as "my secret code is on screen"
  // regardless of which one is actually drawn. This screen shows no
  // constellation of any kind, full stop — the Creator's own bonded
  // Story Companion portrait instead (a face, not a code), falling
  // back to a plain glyph while the portrait loads or when none is
  // available yet (Nimbus/Quill's disclosed pending-art gap, or a
  // legacy card that hasn't been retroactively bonded yet).
  function _buildGateIdentityGlyph(card,size){
    const wrap=_el('div','magic-card-gate-glyph');
    wrap.style.width=size+'px';
    wrap.style.height=size+'px';
    wrap.appendChild(_el('span','magic-card-gate-glyph-fallback','✨'));
    if(card.companionId && typeof window.MagicCardArt!=='undefined' && typeof MagicCardArt.resolveCompanionPortrait==='function'){
      MagicCardArt.resolveCompanionPortrait(card.companionId).then(function(portrait){
        if(!portrait) return;
        wrap.innerHTML='';
        const img=document.createElement('img');
        img.src=portrait.src;
        wrap.appendChild(img);
      });
    }
    return wrap;
  }

  // ---------- Screen 2 / 9 — Identity Gate (boot time) ----------
  // Shown only when at least one claimed Magic Card is known on this
  // device — otherwise this function is never even called (see
  // js/app.js's bootstrapSession) and today's existing boot sequence is
  // completely unmodified.
  //
  // "on first screen when i select recall a different card or continue
  // i should give my constellation pattern to gain access" — and,
  // critically, "it should be shown on same screen without entering
  // into the home screen." Continuing as a known card (either the
  // single-card "Return to My Adventure" or a picker tile tap) and
  // recalling an unknown one both now route through an inline
  // pattern-tap challenge rendered directly inside this SAME panel —
  // proceed(cardId) is only ever called after a real match, never on a
  // bare tap/click. "Begin Exploring" is deliberately left ungated —
  // it grants no identity at all, so there is nothing to prove.
  function checkIdentityGate(onContinue){
    _ensureDom();
    const cards=MagicCard.list();
    if(!cards.length){ onContinue(); return; }
    _clear();
    overlay.classList.remove('magic-card-mode-home');
    overlay.classList.add('magic-card-mode-gate');
    _show();

    function proceed(cardId){
      // Companion Canon Freeze fix: previously only ever CALLED
      // setActive() when a real id was picked, so "Begin Exploring" on
      // a shared device left the PREVIOUS card's id sitting in
      // ACTIVE_KEY untouched -- MagicCard.getActive() would keep
      // reporting a Creator even though the person explicitly chose to
      // continue as a Traveller this time. setActive(null) already
      // correctly clears the pointer (see js/magicCard.js); this was
      // only ever a missing call, not a missing capability. (Recall's
      // own MagicCard.recall() already calls setActive() internally via
      // adopt() — calling it again here with the same id is harmless.)
      MagicCard.setActive(cardId||null);
      overlay.classList.remove('magic-card-mode-gate');
      _hide();
      refreshHeaderBadge();
      onContinue();
    }

    const panel=_el('div','magic-card-gate-panel');
    content.appendChild(panel);

    function toWelcome(){ _renderGateWelcome(panel,cards,proceed,toPicker); }
    function toPicker(){ _renderGatePicker(panel,cards,proceed,toWelcome); }

    if(cards.length===1) toWelcome(); else toPicker();
  }

  // Traveller Gateway V1.1 — the Gateway's own Scene 3 (Identity,
  // Returning Creator branch) entry point. Unlike checkIdentityGate()
  // above (the standalone Identity Gate, reached directly from boot
  // before this rework), this is called FROM WITHIN an already-playing
  // Gateway sequence (js/gatewaySequence.js) that has already recognized
  // the device and already said its own "Welcome home... show me your
  // stars" line — so this mounts the tap-grid challenge DIRECTLY,
  // skipping the Welcome/Picker screens and the challenge's own
  // redundant second speech line (skipSpeech:true), reusing the exact
  // same _renderPatternChallenge machinery (grid, star colours, board-fit
  // sizing) with zero duplication. `onResult(ok, cardId)`
  // fires on success (the challenge verified this card's real pattern),
  // or once the Traveller explicitly chooses "Continue as a Traveller"
  // from the choice screen below (never on the FIRST "← Back" tap by
  // itself — see showChoice).
  //
  // "retry or continue as traveller. options" — a wrong tap already
  // lets someone retry indefinitely in place (the challenge itself just
  // clears the board and says "try again"); what "← Back" used to do
  // was skip straight past that and silently give up on their behalf.
  // Now "← Back" opens one small, explicit choice instead: try the
  // stars again, or genuinely continue as a Traveller.
  function beginCreatorSignature(card,onResult){
    _ensureDom();
    _clear();
    overlay.classList.remove('magic-card-mode-home');
    overlay.classList.add('magic-card-mode-gate');
    _show();
    const panel=_el('div','magic-card-gate-panel');
    content.appendChild(panel);
    function showChallenge(){
      _renderSkyChallenge(panel,{
        card:card,
        onSuccess:function(){
          MagicCard.setActive(card.id);
          _hide();
          refreshHeaderBadge();
          onResult(true,card.id);
        },
        onBack:showChoice
      });
    }
    function showChoice(){
      panel.innerHTML='';
      panel.classList.remove('magic-card-gate-panel--challenge');
      panel.appendChild(_el('div','magic-card-gate-welcome',"Not able to show your stars right now?"));
      const retryBtn=_el('button','magic-card-gate-continue','🔁 Try Again');
      retryBtn.type='button';
      retryBtn.addEventListener('click',showChallenge);
      panel.appendChild(retryBtn);
      const travellerBtn=_el('button','magic-card-gate-notyou','🌱 Continue as a Traveller');
      travellerBtn.type='button';
      travellerBtn.addEventListener('click',function(){
        _hide();
        onResult(false,null);
      });
      panel.appendChild(travellerBtn);
    }
    showChallenge();
  }

  function _renderGateWelcome(panel,cards,proceed,toPicker){
    panel.innerHTML='';
    panel.classList.remove('magic-card-gate-panel--challenge');
    const card=cards[0];
    // Never the constellation, real or decorative — see
    // _buildGateIdentityGlyph's own comment above.
    panel.appendChild(_buildGateIdentityGlyph(card,140));
    panel.appendChild(_el('div','magic-card-gate-welcome','Welcome back, '+(card.nickname||'Star Traveler')));
    // "continue is wrong word use vihustudio vocabulary" — VihuStudio's
    // own established term for a Creator's ongoing work is "Adventure"
    // (js/publishStudio.js's "Publish My Adventure"/"Get My Adventure"),
    // never the generic "Continue".
    const btn=_el('button','magic-card-gate-continue','Return to My Adventure');
    btn.type='button';
    btn.addEventListener('click',function(){
      _renderSkyChallenge(panel,{
        card:card,
        onSuccess:function(){ proceed(card.id); },
        onBack:function(){ _renderGateWelcome(panel,cards,proceed,toPicker); }
      });
    });
    panel.appendChild(btn);
    const notYou=_el('button','magic-card-gate-notyou','Not you?');
    notYou.type='button';
    notYou.addEventListener('click',toPicker);
    panel.appendChild(notYou);
  }

  // Small shared builder so the two "action" tiles (Begin Exploring,
  // Recall a different card) carry the same visual weight as a real
  // card tile — an icon circle roughly matching the constellation
  // tile's own footprint, plus a stacked label — rather than a bare
  // emoji+text line that reads as a lesser, half-finished sibling next
  // to the richer card tiles.
  function _buildGateActionTile(icon,label,onClick){
    const btn=_el('button','magic-card-gate-explore');
    btn.type='button';
    btn.appendChild(_el('span','magic-card-gate-explore-icon',icon));
    btn.appendChild(_el('span','magic-card-gate-explore-label',label));
    btn.addEventListener('click',onClick);
    return btn;
  }

  function _renderGatePicker(panel,cards,proceed,toWelcome){
    panel.innerHTML='';
    panel.classList.remove('magic-card-gate-panel--challenge');
    panel.appendChild(_el('div','magic-card-gate-title','Whose adventure is this?'));

    const grid=_el('div','magic-card-gate-grid');
    cards.forEach(function(card){
      const tile=_el('button','magic-card-gate-tile');
      tile.type='button';
      tile.appendChild(_buildGateIdentityGlyph(card,56));
      tile.appendChild(_el('span','magic-card-gate-tile-name',card.nickname||'Star Traveler'));
      tile.addEventListener('click',function(){
        _renderSkyChallenge(panel,{
          card:card,
          onSuccess:function(){ proceed(card.id); },
          onBack:function(){ _renderGatePicker(panel,cards,proceed,toWelcome); }
        });
      });
      grid.appendChild(tile);
    });
    grid.appendChild(_buildGateActionTile('🌱','Begin Exploring',function(){ proceed(null); }));

    // "Recall a different card" — a card NOT already known on this
    // device. This used to set a one-shot flag and bounce all the way
    // to Creator's own Screen 1 to show its tap grid there; it now
    // renders the identical challenge inline, right here, backed by the
    // real cross-device MagicCard.recall() RPC instead of a local
    // pattern comparison (see _renderPatternChallenge's verify/
    // verifyTyped split below).
    grid.appendChild(_buildGateActionTile('✨','Recall a different card',function(){
      _renderPatternChallenge(panel,{
        subtitle:'Tap the stars shown on your Magic Card.',
        allowTyped:true,
        verify:function(pattern){ return MagicCard.recall({pattern:pattern}); },
        verifyTyped:function(val){ return MagicCard.recall({typed:val}); },
        onSuccess:function(result){ proceed(result&&result.card?result.card.id:null); },
        onBack:function(){ _renderGatePicker(panel,cards,proceed,toWelcome); }
      });
    }));
    panel.appendChild(grid);
  }

  // ---------- Inline pattern-verification challenge ----------
  // (The order-independent local pattern-match helper that used to live
  // here, _patternsMatch(), was only ever called by the "known card, same
  // device" verification paths — Continue/tile-tap/beginCreatorSignature —
  // all three of which now use _renderSkyChallenge below instead. It has
  // no remaining callers and was removed rather than left as dead code;
  // the cross-device Recall flow below never used it — it always went
  // through the real recall_magic_card() RPC, whose own canonicalization,
  // _card_platform_sort_pattern(), is untouched.)
  const GATE_TAPGRID_SIZE=10;
  // Each tapped star gets its OWN colour, in tap order, cycling through
  // this palette — recomputed fresh from the current `selected` array on
  // every change (never persisted per-cell), so removing a star in the
  // middle of a sequence correctly re-colours everything after it rather
  // than leaving a stale gap.
  const STAR_PALETTE=['#FFCB45','#B388FF','#5CE1E6','#FF6FA5','#5CFFB0','#FF8B5C','#7C9CFF','#FFD166'];
  function _applyStarColors(board,selected){
    selected.forEach(function(k,i){
      const parts=k.split(',');
      const cell=board.querySelector('[data-row="'+parts[0]+'"][data-col="'+parts[1]+'"]');
      if(cell) cell.style.setProperty('--star-color',STAR_PALETTE[i%STAR_PALETTE.length]);
    });
  }
  function _gateBoardKey(r,c){ return r+','+c; }
  function _gateCenterOfCell(boardEl,r,c){
    const el=boardEl.querySelector('[data-row="'+r+'"][data-col="'+c+'"]');
    if(!el) return {x:0,y:0};
    return {x:el.offsetLeft+el.offsetWidth/2, y:el.offsetTop+el.offsetHeight/2};
  }
  // A self-contained equivalent of js/creationFlow.js's own
  // _cardBuildGrid — that module's tap-grid helpers are module-private
  // and cannot be reused directly from here, so this is a deliberate,
  // structurally-similar-but-separate implementation in this file's own
  // --mc-* visual language (.magic-card-tapgrid-* in css/style.css),
  // matching this codebase's established "kept in lockstep by hand"
  // precedent for this exact situation.
  //
  // No row/column numbers — the coordinate system is never shown, so
  // nothing about the board's own look hints at the secret. Every cell
  // carries a "★" glyph, and — a real, user-reported legibility fix,
  // "very difficult to show the stars" — EVERY cell now shows the same
  // dim "unlit star" at rest (see .magic-card-tapgrid-cell in
  // css/style.css), not just a sparse ~22% subset with the rest fully
  // invisible: a kid on a touch device (no :hover at all before the tap
  // itself) previously had no visual cue where ~78% of the 100 tappable
  // positions even were. This is a strict improvement on the original
  // "camouflage" property too, not a trade-off against it — with every
  // cell now identical at rest, there is no visible subset to
  // distinguish from "real" positions at all, so a shoulder-surfer
  // watching someone tap their real pattern still can't tell a genuine
  // tap from the rest of the (now uniformly dim) starfield around it.
  function _gateBuildGrid(boardEl,size,onClick){
    boardEl.innerHTML='';
    // A little delight, not just a legibility fix — "they need fun not
    // a test": each cell's own gentle twinkle (css/style.css's
    // magicCardStarTwinkle keyframe) gets a randomized delay/duration
    // here so the whole board twinkles out of sync, like a real sky,
    // rather than one flat uniform pulse. Harmless to set even under
    // reduced motion — the media query there disables the animation
    // outright regardless of these inline values.
    for(let rr=0;rr<size;rr++){
      for(let cc=0;cc<size;cc++){
        const cell=document.createElement('button');
        cell.type='button';
        cell.className='magic-card-tapgrid-cell';
        cell.textContent='★';
        cell.dataset.row=rr; cell.dataset.col=cc;
        cell.style.gridRow=String(rr+1); cell.style.gridColumn=String(cc+1);
        cell.style.animationDelay=(Math.random()*2.4).toFixed(2)+'s';
        cell.style.animationDuration=(1.8+Math.random()*1.6).toFixed(2)+'s';
        cell.setAttribute('aria-label','Row '+(rr+1)+', Column '+(cc+1));
        cell.addEventListener('click',function(){ onClick(rr,cc,cell); });
        boardEl.appendChild(cell);
      }
    }
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','magic-card-tapgrid-lines');
    boardEl.appendChild(svg);
    return svg;
  }
  function _gateRedrawLiveLines(board,svg,selected){
    svg.innerHTML='';
    if(selected.length<2) return;
    const centers=selected.map(function(k){
      const parts=k.split(',');
      return _gateCenterOfCell(board,parseInt(parts[0],10),parseInt(parts[1],10));
    });
    for(let i=0;i<centers.length-1;i++){
      const a=centers[i], b=centers[i+1];
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
      line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
      line.setAttribute('class','magic-card-tapgrid-line');
      // A segment is tinted by the star it leads INTO, so the whole
      // constellation reads as a genuine multi-coloured trail rather
      // than one flat gold line.
      const color=STAR_PALETTE[(i+1)%STAR_PALETTE.length];
      line.style.stroke=color;
      line.style.filter='drop-shadow(0 0 4px '+color+')';
      svg.appendChild(line);
    }
  }

  // Reveals `text` into `el` one character at a time, like Lumo is
  // actually speaking the line rather than it simply appearing — "let
  // the line reveal as a lumo speaking it to the kid." Skips straight to
  // the full text under prefers-reduced-motion, matching every other
  // animated flourish in this codebase's own established convention.
  // Safe to call on a freshly-built, still-detached element; if the
  // whole challenge is torn down mid-reveal (a real but harmless race —
  // Back/Confirm before the line finishes typing), the interval simply
  // keeps writing into an orphaned node for the remaining ~1s and then
  // clears itself, with no visible or functional effect.
  //
  // A real, previously-latent race found while building _renderSkyChallenge
  // (the first caller to ever invoke this on the SAME element more than
  // once in a row, as Lumo's mood/line changes across several states):
  // calling this a second time before the first reveal finished used to
  // leave both setInterval timers writing into el.textContent
  // concurrently — nothing tracked or cleared the previous one. Fixed by
  // stashing the timer handle on the element itself and clearing it, if
  // present, before starting a new one.
  function _typewriterReveal(el,text){
    if(el.__typewriterTimer){ clearInterval(el.__typewriterTimer); el.__typewriterTimer=null; }
    const reduced=(typeof window.matchMedia==='function')&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduced){ el.textContent=text; return; }
    el.textContent='';
    el.classList.add('magic-card-gatekeeper-line--typing');
    let i=0;
    el.__typewriterTimer=setInterval(function(){
      i++;
      el.textContent=text.slice(0,i);
      if(i>=text.length){
        clearInterval(el.__typewriterTimer);
        el.__typewriterTimer=null;
        el.classList.remove('magic-card-gatekeeper-line--typing');
      }
    },30);
  }

  // A companion portrait presiding over the tap challenge itself —
  // "bring companion as gatekeeper." Lumo (the Guardian, per Companion
  // Canon V2's own "keeper of Creator Ceremonies" framing) stands watch
  // uniformly across every verification path (Continue/tile-tap/Recall)
  // rather than resolving each card's own bonded companion — simpler,
  // and thematically a Guardian/gatekeeper is a fixed figure at the
  // gate, not a different face per traveller. Resolved the identical way
  // every other Lumo portrait in this file already is. `name` is the
  // known card's own nickname (Continue/tile-tap) or undefined (Recall,
  // where no identity is known yet) — folded into the greeting line
  // itself, per "add the kids name there."
  // `skipSpeech` (Traveller Gateway V1.1 — the Gateway's own Scene 3
  // already says "Welcome home... show me your stars" via its own
  // sequential greeting bubble before ever mounting this challenge, so
  // repeating a second, differently-worded speech line here would read
  // as redundant) omits the bubble entirely, keeping only the portrait/
  // ring/name — every existing caller (the standalone Identity Gate)
  // passes nothing for this and is completely unaffected.
  function _buildGatekeeperHeader(name,skipSpeech){
    const wrap=_el('div','magic-card-gatekeeper');
    const portraitWrap=_el('div','magic-card-gatekeeper-portrait-wrap');
    portraitWrap.appendChild(_el('div','magic-card-gatekeeper-ring'));
    const portrait=_el('div','magic-card-gatekeeper-portrait');
    portrait.appendChild(_el('span','magic-card-gatekeeper-fallback','🛡️'));
    portraitWrap.appendChild(portrait);
    wrap.appendChild(portraitWrap);
    wrap.appendChild(_el('div','magic-card-gatekeeper-shadow'));
    wrap.appendChild(_el('div','magic-card-gatekeeper-name','Lumo, the Gatekeeper'));
    if(!skipSpeech){
      const bubble=_el('div','magic-card-gatekeeper-bubble');
      const line=_el('div','magic-card-gatekeeper-line');
      bubble.appendChild(line);
      wrap.appendChild(bubble);
      // One unified line regardless of whether a nickname is known
      // (Continue/tile-tap) or not (Recall) — no nickname/fallback split
      // needed once the greeting itself doesn't address anyone by name.
      _typewriterReveal(line,'My friend, show me your stars, and you may pass.');
      // Real recorded Lumo voice line, staged as it becomes available
      // (see js/lumoVoice.js) — fires alongside the typewriter reveal,
      // from inside this same user-gesture-originated call chain, so
      // browser autoplay policy is satisfied. A no-op until/unless this
      // id has a real file wired in.
      if(typeof window.LumoVoice!=='undefined') LumoVoice.play('tapgrid');
    }
    if(typeof window.MagicCardArt!=='undefined' && typeof MagicCardArt.resolveCompanionPortrait==='function'){
      MagicCardArt.resolveCompanionPortrait('lumo').then(function(img){
        if(!img) return;
        portrait.innerHTML='';
        const el=document.createElement('img');
        el.src=img.src;
        portrait.appendChild(el);
      });
    }
    return wrap;
  }

  // Robustly fits the tap board to whatever vertical room the panel
  // genuinely has left, MEASURED directly rather than approximated via
  // a vh-percentage guess — the guess-based approach broke twice: once
  // at narrow+tall viewports, then again for real users on ordinary
  // wide desktop windows, where flexbox silently squished the board's
  // own HEIGHT without preserving its width (aspect-ratio quietly lost
  // through flex-shrink), clipping rows off the bottom of the grid.
  // Idempotent — always resets to the natural CSS-driven size before
  // re-measuring — so it's safe to call repeatedly (on first build,
  // after the typed-code fallback expands, from a ResizeObserver on
  // any later layout change) with no risk of oscillating.
  function _fitBoardToAvailableSpace(panel,boardWrap){
    boardWrap.style.width='';
    boardWrap.style.height='';
    const available=panel.clientHeight;
    const needed=panel.scrollHeight;
    if(needed<=available+1) return; // already fits at its natural size
    const naturalSize=boardWrap.getBoundingClientRect().width;
    const deficit=needed-available;
    const fitted=Math.max(140,naturalSize-deficit);
    boardWrap.style.width=fitted+'px';
    boardWrap.style.height=fitted+'px';
  }

  // Renders the tap-grid challenge directly into `panel` (replacing
  // whatever was there — Welcome or Picker), never opening a second
  // screen/modal/overlay. `opts.verify(pattern)` and the optional
  // `opts.verifyTyped(code)` each return a Promise<{ok,...}> — a plain
  // local match for the "continue as a known card" case, or the real
  // MagicCard.recall() RPC for the "recall an unknown card" case — so
  // this one function serves both without knowing which kind of check
  // it's running. `opts.onSuccess(result)` receives whatever `verify`/
  // `verifyTyped` resolved with; `opts.onBack()` returns to whichever
  // screen (Welcome or Picker) opened this challenge.
  function _renderPatternChallenge(panel,opts){
    panel.innerHTML='';
    // "let the page own the authentication visually" — this specific
    // screen (the actual proof-of-identity moment) sheds the panel's
    // own boxed card chrome so it reads as part of the night sky itself
    // rather than a modal floating on top of it; Welcome/Picker keep
    // their ordinary boxed look unchanged (see _renderGateWelcome/
    // _renderGatePicker, which remove this class again on their own
    // panel.innerHTML='' reset).
    panel.classList.add('magic-card-gate-panel--challenge');
    // No separate title line — "we can remove this line, we have ample
    // space" — Lumo's own speech bubble (built with the kid's name
    // folded in) now carries the whole "prove it's you" framing itself.
    panel.appendChild(_buildGatekeeperHeader(opts.name,opts.skipSpeech));
    if(opts.subtitle) panel.appendChild(_el('div','magic-card-tapgrid-subtitle',opts.subtitle));

    // The wrap is the SIZED, overflow:hidden element; the board fills
    // it at 100%/100%. Its padding exists purely to give a selected
    // cell's transform:scale()+glow bloom somewhere to bleed into
    // without ever registering as real scrollable overflow on
    // .magic-card-gate-panel above it — see css/style.css's own comment
    // on .magic-card-tapgrid-boardwrap for the full root-cause story
    // (a genuine Chromium quirk: transformed/glowing descendants count
    // toward an ancestor's scrollable overflow even though they never
    // affect layout).
    const boardWrap=_el('div','magic-card-tapgrid-boardwrap');
    const board=_el('div','magic-card-tapgrid-board');
    boardWrap.appendChild(board);
    panel.appendChild(boardWrap);
    const counter=_el('div','magic-card-tapgrid-counter','0 stars selected');
    panel.appendChild(counter);
    const status=_el('p','magic-card-tapgrid-status');
    panel.appendChild(status);

    let selected=[];
    // Every cell already carries its own "★" glyph (set once in
    // _gateBuildGrid) — selection is purely a CSS class + colour
    // toggle now, never a textContent rewrite, so a deselected cell
    // correctly reverts to its own dim "unlit" look instead of going
    // fully blank.
    const svg=_gateBuildGrid(board,GATE_TAPGRID_SIZE,function(r,c,cell){
      const k=_gateBoardKey(r,c);
      const idx=selected.indexOf(k);
      if(idx===-1){
        selected.push(k);
        cell.classList.add('selected');
      }else{
        selected.splice(idx,1);
        cell.classList.remove('selected');
        cell.style.removeProperty('--star-color');
      }
      counter.textContent=selected.length+' star'+(selected.length===1?'':'s')+' selected';
      _applyStarColors(board,selected);
      _gateRedrawLiveLines(board,svg,selected);
    });

    function clearBoard(){
      board.querySelectorAll('.magic-card-tapgrid-cell').forEach(function(el){
        el.classList.remove('selected');
        el.style.removeProperty('--star-color');
      });
      svg.innerHTML='';
      selected=[];
      counter.textContent='0 stars selected';
    }

    // "they need fun not a test" — softened every status/button line on
    // this screen away from clinical pass/fail wording (no more ✗ marks
    // reading as a wrong-answer buzzer), and renamed the button to match
    // this screen's own established "sky" language (see e.g. Magic Card
    // Home's "your sky is alive").
    const confirmBtn=_el('button','magic-card-tapgrid-confirm','✨ That’s My Sky!');
    confirmBtn.type='button';
    confirmBtn.addEventListener('click',function(){
      if(selected.length<2){
        status.textContent='Tap a couple of stars first! ✨';
        status.className='magic-card-tapgrid-status err';
        return;
      }
      confirmBtn.disabled=true;
      status.textContent='✨ Looking for your sky…';
      status.className='magic-card-tapgrid-status';
      const pattern=selected.map(function(k){
        const parts=k.split(',');
        return [parseInt(parts[0],10),parseInt(parts[1],10)];
      });
      opts.verify(pattern).then(function(result){
        confirmBtn.disabled=false;
        if(result&&result.ok){
          status.textContent='✨ Found it! Welcome back!';
          status.className='magic-card-tapgrid-status ok';
          setTimeout(function(){ opts.onSuccess(result); },350);
        }else{
          status.textContent='Not quite — let’s try again! 🌟';
          status.className='magic-card-tapgrid-status err';
          clearBoard();
        }
      });
    });
    panel.appendChild(confirmBtn);

    if(opts.allowTyped){
      const codeToggle=_el('button','magic-card-tapgrid-code-toggle','Prefer to type your code instead? ⌄');
      codeToggle.type='button';
      const codeFallback=_el('div','magic-card-tapgrid-code-fallback hidden');
      const codeInput=document.createElement('input');
      codeInput.type='text';
      codeInput.className='magic-card-tapgrid-code-input';
      codeInput.placeholder='e.g. CYGNUS00042';
      const codeSubmit=_el('button','magic-card-tapgrid-code-submit','Come home with code');
      codeSubmit.type='button';
      codeFallback.appendChild(codeInput);
      codeFallback.appendChild(codeSubmit);
      panel.appendChild(codeToggle);
      panel.appendChild(codeFallback);
      codeToggle.addEventListener('click',function(){
        const opening=codeFallback.classList.contains('hidden');
        codeFallback.classList.toggle('hidden',!opening);
        codeToggle.textContent='Prefer to type your code instead? '+(opening?'⌃':'⌄');
        // Expanding the fallback adds real height — re-fit immediately
        // rather than waiting on the ResizeObserver's own next frame.
        _fitBoardToAvailableSpace(panel,boardWrap);
      });
      function submitCode(){
        const val=codeInput.value.trim();
        if(!val){
          status.textContent='Type your code first! ✨';
          status.className='magic-card-tapgrid-status err';
          return;
        }
        codeSubmit.disabled=true;
        status.textContent='✨ Looking for your sky…';
        status.className='magic-card-tapgrid-status';
        opts.verifyTyped(val).then(function(result){
          codeSubmit.disabled=false;
          if(result&&result.ok){
            status.textContent='✨ Found it! Welcome back!';
            status.className='magic-card-tapgrid-status ok';
            setTimeout(function(){ opts.onSuccess(result); },350);
          }else{
            status.textContent='Not quite — check the code and try again! 🌟';
            status.className='magic-card-tapgrid-status err';
          }
        });
      }
      codeSubmit.addEventListener('click',submitCode);
      codeInput.addEventListener('keydown',function(e){ if(e.key==='Enter') submitCode(); });
    }

    const back=_el('button','magic-card-gate-notyou','← Back');
    back.type='button';
    back.addEventListener('click',opts.onBack);
    panel.appendChild(back);

    // Fit the board once, synchronously, right now — every child is
    // appended, so this measurement reflects the true total. A
    // ResizeObserver keeps it correct afterward (window resize, a
    // future layout change) without ever needing a fixed vh guess
    // again; it disconnects itself the moment this screen is replaced.
    _fitBoardToAvailableSpace(panel,boardWrap);
    if(typeof ResizeObserver!=='undefined'){
      const ro=new ResizeObserver(function(){
        if(!document.contains(panel)){ ro.disconnect(); return; }
        _fitBoardToAvailableSpace(panel,boardWrap);
      });
      ro.observe(panel);
    }
  }

  // ---------- "Which Sky Is Yours?" — Creator Signature recognition
  // challenge, replacing the star-tap-grid RECALL mechanic above for
  // the "this device already knows which card it is, just confirm it's
  // really them" case (Continue/tile-tap/beginCreatorSignature) —
  // recognition, not recall. Recalling an abstract secret tap order is
  // genuinely harder for a young child than recognizing something
  // already familiar; and unlike the real secret pattern, the "correct"
  // sky shown here (MagicCard.decorativeSkyFor(card), the same safe,
  // id-derived shape already used for the header badge) was never a
  // secret to begin with, so nothing is weakened by making it easier.
  //
  // The cross-device Recall flow (an unknown card, verified against the
  // real secret pattern via the recall_magic_card() RPC) is untouched
  // and still uses _renderPatternChallenge above — there is no local
  // card yet for a "decorative sky" to be derived from in that case.
  //
  // "1 real 3 fakes at every wrong attempt all cards reorganise and 2
  // fakes regenerate": 4 cards total; a wrong tap always reshuffles
  // every position AND swaps 2 of the 3 mystery skies for brand-new
  // shapes from the fixed pool below — the 3rd mystery sky carries over
  // unchanged, so the board is never a total reset, just fresh enough
  // that nothing can be memorized by position. 3 tries; exhausting them
  // calls onBack() automatically, same as the manual "← Back" button.
  const SKY_TOTAL_TRIES=3;
  // A small, fixed pool of decoy shapes — never derived from any real
  // card (this one's or anyone else's), matching the same "decoys must
  // never be tied to a real user" principle already established for the
  // World Card platform's own redeem-challenge decoys.
  const SKY_DECOY_PATTERNS=[
    [[1,1],[3,4],[1,7],[6,6],[8,2]],
    [[2,2],[2,7],[7,7],[7,2]],
    [[1,4],[4,1],[4,7],[7,4],[4,4]],
    [[1,1],[1,8],[8,8],[8,1],[4,4]],
    [[2,5],[5,2],[5,8],[8,5]],
    [[0,5],[3,2],[3,8],[6,5],[9,5]]
  ];
  function _skyPickIndices(count,pool,exclude){
    exclude=exclude||[];
    const avail=[];
    for(let i=0;i<pool.length;i++){ if(exclude.indexOf(i)===-1) avail.push(i); }
    const picked=[];
    for(let i=0;i<count&&avail.length;i++){
      const j=Math.floor(Math.random()*avail.length);
      picked.push(avail.splice(j,1)[0]);
    }
    return picked;
  }
  function _skyShuffle(arr){
    const a=arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  // A Lumo presence that can change mood live across several states —
  // reuses the exact .magic-card-gatekeeper-* ring/float/landing-shadow/
  // bubble presentation _buildGatekeeperHeader already establishes
  // above, but resolves Lumo's FULL package once (not just the 'hero'
  // pose resolveCompanionPortrait fetches) so setMood() can swap in
  // curious/think/wave/celebrate as the moment changes — "instead of
  // lumo being a sigil, we have different poses of him."
  function _buildSkyGatekeeperHeader(){
    const wrap=_el('div','magic-card-gatekeeper');
    const portraitWrap=_el('div','magic-card-gatekeeper-portrait-wrap');
    portraitWrap.appendChild(_el('div','magic-card-gatekeeper-ring'));
    const portrait=_el('div','magic-card-gatekeeper-portrait');
    portrait.appendChild(_el('span','magic-card-gatekeeper-fallback','🐉'));
    portraitWrap.appendChild(portrait);
    wrap.appendChild(portraitWrap);
    wrap.appendChild(_el('div','magic-card-gatekeeper-shadow'));
    const bubble=_el('div','magic-card-gatekeeper-bubble');
    const line=_el('div','magic-card-gatekeeper-line');
    bubble.appendChild(line);
    wrap.appendChild(bubble);

    let lumoInfo=null, currentPose='curious';
    function paintPose(){
      if(!lumoInfo) return;
      const file=lumoInfo.pkg.states[currentPose]||lumoInfo.pkg.states[lumoInfo.pkg.defaultState];
      if(!file) return;
      let img=portrait.querySelector('img');
      if(!img){
        portrait.innerHTML='';
        img=document.createElement('img');
        portrait.appendChild(img);
      }
      img.src=lumoInfo.basePath+file;
    }
    if(typeof window.CompanionEngine!=='undefined'){
      CompanionEngine.loadRegistry(CEREMONY_ASSETS_BASE).then(function(regList){
        return _ceremonyResolveEntity(regList,{role:'guardian'});
      }).then(function(info){ if(info){ lumoInfo=info; paintPose(); } });
    }
    // moodClass toggles the bubble's own win/oops tint (matching the
    // tap-grid's identical convention); speechText undefined leaves
    // whatever line is already showing untouched, '' clears it, any
    // other string types it in via _typewriterReveal.
    //
    // "no scroll please, there is so much vertical space use that" — a
    // real, screenshotted bug: an empty bubble (skipSpeech's own initial
    // '' text, the Gateway's own case) still rendered its full padded box
    // with nothing in it, wasting real vertical room and contributing to
    // the panel needing to scroll. The bubble is now hidden outright
    // whenever there's no line to show, and un-hidden the moment a real
    // message arrives (every later beat — oops/fresh board/success —
    // always has one).
    function setMood(pose,speechText,moodClass){
      currentPose=pose;
      paintPose();
      bubble.classList.remove('win','oops');
      if(moodClass) bubble.classList.add(moodClass);
      if(speechText===undefined) return;
      if(!speechText){
        line.textContent='';
        bubble.classList.add('magic-card-gatekeeper-bubble-empty');
        return;
      }
      bubble.classList.remove('magic-card-gatekeeper-bubble-empty');
      _typewriterReveal(line,speechText);
    }
    return {el:wrap,setMood:setMood};
  }

  // Robustly fits the sky-recognition challenge to whatever vertical room
  // the panel genuinely has left, MEASURED directly rather than relying on
  // clamp()'s own vh-based guesses alone -- mirroring
  // _fitBoardToAvailableSpace's identical discipline above. A real
  // screenshotted report ("the widget still has scroll") confirmed the
  // clamp() values alone weren't enough: at real, ordinary desktop window
  // heights they only avoid overflow above a certain point, with nothing
  // actively shrinking further down below it. Runs in up to three steps,
  // each only taken if the previous one still isn't enough:
  //   1. shrink Lumo's own portrait (the --gk-size custom property) --
  //      the single largest element on the screen;
  //   2. shrink the sky-card grid itself;
  //   3. compress every remaining fixed margin/padding on this screen too,
  //      via the --sky-density custom property css/style.css's own
  //      calc() expressions reference (js/magicCardUI.js never touches
  //      those rules directly) -- a genuinely short viewport needs more
  //      than the two big elements alone can give back.
  // Idempotent (always resets to the natural CSS size first) so it's safe
  // to call on every paint and from a ResizeObserver with no oscillation
  // risk.
  function _fitSkyChallengeToAvailableSpace(panel,gatekeeperEl,gridEl){
    gatekeeperEl.style.removeProperty('--gk-size');
    gridEl.style.removeProperty('max-width');
    panel.style.removeProperty('--sky-density');
    gridEl.querySelectorAll('svg').forEach(function(svg){ svg.style.removeProperty('max-width'); });
    const available=panel.clientHeight;
    let needed=panel.scrollHeight;
    if(needed<=available+1) return;

    let deficit=needed-available;
    const naturalGk=parseFloat(getComputedStyle(gatekeeperEl).getPropertyValue('--gk-size'))||120;
    gatekeeperEl.style.setProperty('--gk-size',Math.max(56,naturalGk-deficit)+'px');
    needed=panel.scrollHeight;
    if(needed<=available+1) return;

    deficit=needed-available;
    const naturalGrid=gridEl.getBoundingClientRect().width;
    const fittedGrid=Math.max(168,naturalGrid-deficit*2.2);
    gridEl.style.maxWidth=fittedGrid+'px';
    const fittedSvg=Math.max(52,Math.floor(fittedGrid/2-26));
    gridEl.querySelectorAll('svg').forEach(function(svg){ svg.style.maxWidth=fittedSvg+'px'; });
    needed=panel.scrollHeight;
    if(needed<=available+1) return;

    // Solve for the density directly rather than guessing discrete steps:
    // scrollHeight(d) = fixed + d*scalable is linear in d (every affected
    // rule is a plain `calc(var(--sky-density) * Npx)`), so one extra
    // measurement at d=0.5 is enough to derive both constants and land on
    // the exact density that closes the remaining gap in a single try.
    const needed1=needed;
    panel.style.setProperty('--sky-density','0.5');
    const neededHalf=panel.scrollHeight;
    const scalable=Math.max(0,2*(needed1-neededHalf));
    const fixed=needed1-scalable;
    let density=scalable>0?(available-fixed)/scalable:1;
    density=Math.max(0.3,Math.min(1,density));
    panel.style.setProperty('--sky-density',density.toFixed(3));
  }

  // Renders the recognition challenge directly into `panel` (replacing
  // whatever was there), mirroring _renderPatternChallenge's own
  // "replace in place, never a second screen" convention.
  // `opts.card` is the already-known local Magic Card being confirmed.
  // `opts.onSuccess()` fires once the real sky is correctly tapped;
  // `opts.onBack()` fires on the manual "← Back" tap OR automatically
  // once all 3 tries are spent.
  //
  // The initial "find your stars" line always shows, on every call site
  // (Continue/tile-tap/beginCreatorSignature alike) — an earlier draft
  // suppressed it for beginCreatorSignature specifically, reasoning the
  // Gateway's own preceding greeting already covered it, but "we still
  // need a text line asking creator to find his stars" corrected that:
  // this screen's own prompt is what actually tells the child what to
  // do here, regardless of whatever led them to it.
  function _renderSkyChallenge(panel,opts){
    panel.innerHTML='';
    panel.classList.add('magic-card-gate-panel--challenge');

    const gatekeeper=_buildSkyGatekeeperHeader();
    panel.appendChild(gatekeeper.el);

    const triesRow=_el('div','magic-card-sky-tries');
    const triesLabel=_el('div','magic-card-sky-tries-label');
    panel.appendChild(triesRow);
    panel.appendChild(triesLabel);

    const grid=_el('div','magic-card-sky-grid');
    panel.appendChild(grid);

    const back=_el('button','magic-card-gate-notyou','← Back');
    back.type='button';
    back.addEventListener('click',function(){ opts.onBack(); });
    panel.appendChild(back);

    const realPattern=MagicCard.decorativeSkyFor(opts.card).pattern;
    let triesLeft=SKY_TOTAL_TRIES;
    let decoyIdx=_skyPickIndices(3,SKY_DECOY_PATTERNS,[]);
    let busy=false;

    function paintTries(){
      triesRow.innerHTML='';
      for(let i=0;i<SKY_TOTAL_TRIES;i++){
        triesRow.appendChild(_el('span',i<triesLeft?'':'spent'));
      }
      triesLabel.textContent=triesLeft+' tr'+(triesLeft===1?'y':'ies')+' left';
    }

    // Every card renders through the IDENTICAL _renderConstellation()
    // styling regardless of real/decoy — deliberately: if a decoy ever
    // looked visually different from the real sky, the whole
    // recognition test would be defeated by "just pick the one that
    // looks different," with no actual recognition required.
    function paintCards(){
      grid.innerHTML='';
      const cards=_skyShuffle(
        [{real:true,pattern:realPattern}].concat(
          decoyIdx.map(function(i){ return {real:false,pattern:SKY_DECOY_PATTERNS[i]}; })
        )
      );
      cards.forEach(function(c){
        const cardEl=_el('div','magic-card-sky-card');
        cardEl.appendChild(_renderConstellation(c.pattern,{size:96}));
        cardEl.addEventListener('click',function(){ onCardTap(c.real,cardEl,grid); });
        grid.appendChild(cardEl);
      });
    }

    function onCardTap(isReal,cardEl,gridEl){
      if(busy) return;
      busy=true;
      if(isReal){
        Array.prototype.slice.call(gridEl.children).forEach(function(el){
          el.classList.add(el===cardEl?'correct':'fade');
        });
        gatekeeper.setMood('celebrate','✨ There it is! Welcome back. ✨','win');
        setTimeout(function(){ opts.onSuccess(); },900);
        return;
      }
      cardEl.classList.add('tapped-wrong');
      triesLeft--;
      paintTries();
      gatekeeper.setMood('think','Not quite — let’s look again! 🌟','oops');
      setTimeout(function(){
        if(triesLeft<=0){ opts.onBack(); return; }
        // "not just reorder, regenerate the fakes also" — 2 of the 3
        // mystery skies swap for brand-new shapes; the 3rd carries over
        // unchanged, and all 4 positions reshuffle either way.
        const keep=decoyIdx[Math.floor(Math.random()*decoyIdx.length)];
        const fresh=_skyPickIndices(2,SKY_DECOY_PATTERNS,decoyIdx);
        decoyIdx=[keep].concat(fresh);
        paintCards();
        gatekeeper.setMood('wave','Here’s a new look — some mystery friends are new.',null);
        _fitSkyChallengeToAvailableSpace(panel,gatekeeper.el,grid);
        busy=false;
      },1100);
    }

    paintTries();
    paintCards();
    gatekeeper.setMood('curious','One of these skies is yours. Can you find it?',null);

    // Fit once, synchronously, right now — every child is appended, so
    // this measurement reflects the true total, exactly matching
    // _fitBoardToAvailableSpace's own established convention. A
    // ResizeObserver keeps it correct afterward (window resize) without
    // ever needing a fixed vh guess again; it disconnects itself the
    // moment this screen is replaced.
    _fitSkyChallengeToAvailableSpace(panel,gatekeeper.el,grid);
    if(typeof ResizeObserver!=='undefined'){
      const ro=new ResizeObserver(function(){
        if(!document.contains(panel)){ ro.disconnect(); return; }
        _fitSkyChallengeToAvailableSpace(panel,gatekeeper.el,grid);
      });
      ro.observe(panel);
    }
  }

  // ---------- Screens 5-7 — The Awakening ceremony ----------
  function showAwakening(onDone){
    _ensureDom();
    _clear();
    overlay.classList.remove('magic-card-mode-gate','magic-card-mode-home');
    overlay.classList.add('magic-card-mode-awaken');
    _show();

    const stage=_el('div','magic-card-awaken-stage');
    content.appendChild(stage);

    // Generated once, here, and threaded through every remaining step
    // of the ceremony (reveal -> claim panel -> nickname prompt ->
    // first claimed moment) — the same `placed` value is what
    // MagicCard.claim() persists verbatim, so the sky the child
    // watches form is guaranteed to be the exact sky their card
    // actually has afterward. Nothing is persisted yet at this point.
    const placed=MagicCard.generatePattern();
    _runReveal(stage,placed,function(){
      _runClaimPanel(stage,placed,onDone);
    });
  }

  function _runReveal(stage,placed,onNext){
    stage.innerHTML='';
    const msg=_el('div','magic-card-awaken-msg','A Magic Card is waking up…');
    stage.appendChild(msg);
    const skyWrap=_el('div','magic-card-awaken-sky');
    skyWrap.appendChild(_renderConstellation(placed.pattern,{size:240,animate:true}));
    stage.appendChild(skyWrap);

    const totalStars=placed.pattern.length;
    const revealMs=totalStars*220+totalStars*150+900;
    setTimeout(function(){
      msg.textContent="It's yours, if you'd like it.";
      msg.classList.add('magic-card-awaken-msg-settled');
      const tap=_el('button','magic-card-awaken-tap','Tap to continue');
      tap.type='button';
      tap.addEventListener('click',onNext);
      stage.appendChild(tap);
    },revealMs);
  }

  function _runClaimPanel(stage,placed,onDone){
    stage.innerHTML='';
    stage.appendChild(_renderConstellation(placed.pattern,{size:200}));
    stage.appendChild(_el('div','magic-card-claim-prompt','This card wants to remember you.'));

    const claimBtn=_el('button','magic-card-claim-btn','✨ Claim It ✨');
    claimBtn.type='button';
    claimBtn.addEventListener('click',function(){ _runNicknamePrompt(stage,placed,onDone); });
    stage.appendChild(claimBtn);

    const secondary=_el('div','magic-card-claim-secondary');
    const later=_el('button','magic-card-claim-later','Maybe Later');
    later.type='button';
    later.addEventListener('click',function(){ _finishAwakening(onDone); });
    secondary.appendChild(later);
    const explore=_el('button','magic-card-claim-later','Just Exploring for Now');
    explore.type='button';
    explore.addEventListener('click',function(){ _finishAwakening(onDone); });
    secondary.appendChild(explore);
    stage.appendChild(secondary);
  }

  function _runNicknamePrompt(stage,placed,onDone){
    stage.innerHTML='';
    stage.appendChild(_el('div','magic-card-claimed-title','What should we call you?'));
    const input=document.createElement('input');
    input.type='text';
    input.maxLength=24;
    input.placeholder='Star Traveler';
    input.className='magic-card-nickname-input';
    stage.appendChild(input);
    stage.appendChild(_el('div','magic-card-claimed-hint',
      'Remember this sky — it\'s how your card finds its way back to you, anywhere.'));
    const cont=_el('button','magic-card-claim-btn','Continue');
    cont.type='button';
    cont.addEventListener('click',function(){
      const nickname=input.value;
      cont.disabled=true; // the ceremony plays out over several seconds -- one claim, not several
      // Companion Canon V2: the nickname is captured first (so the
      // final claimed card already knows what to call the Creator),
      // then the big centered Creator Ceremony plays -- Story Egg ->
      // Glow -> Cracks -> Lumo arrives -> Blessing -> the randomly-
      // bonded Story Companion's own Hatching -> Hero pose -- and only
      // AT ITS END is the Magic Card actually claimed, with whichever
      // companion the ceremony just showed bonded onto it. "Maybe
      // Later"/"Just Exploring" never reach this function at all (see
      // _runClaimPanel), so nothing here needs to handle a decline.
      _runCreatorCeremony(stage,placed,function(companionFields){
        const card=MagicCard.claim(nickname,placed,companionFields);
        MagicCard.markAwakeningOffered();
        refreshHeaderBadge();
        _showFirstClaimedMoment(stage,card,function(){ _finishAwakening(onDone); });
      });
    });
    stage.appendChild(cont);
    setTimeout(function(){ try{ input.focus(); }catch(e){} },50);
  }

  // ---------- Companion Canon V2 — the Creator Ceremony ----------
  // "New big centered stage visual" (product decision, this sprint) —
  // a dedicated, larger-than-the-corner-widget presentation, entirely
  // separate from js/companionEngine.js's own small widget instance
  // (never touched by this sprint — verified via a plain `git diff`).
  // Resolves each beat's asset path independently, exactly the way
  // js/magicCardArt.js already resolves a companion portrait for the
  // card itself — reusing CompanionEngine.loadRegistry() (the one
  // static, generic lookup every module in this codebase already
  // shares) but never depending on any *loaded* CompanionEngine
  // instance's own private package cache.
  const CEREMONY_ASSETS_BASE='assets/';

  function _ceremonyFetchJSON(url){
    return fetch(url).then(function(res){ return res.ok?res.json():null; }).catch(function(){ return null; });
  }

  // Resolves {id, name, basePath, pkg} for either a registry ROLE
  // ('traveller' -> the Story Egg, 'guardian' -> Lumo) or an explicit id
  // (the Creator's own randomly-bonded Story Companion) — a beat names
  // exactly one of the two (see _entityLookupFor below), never both.
  function _ceremonyResolveEntity(regList,lookup){
    let entry=null;
    if(lookup.role) entry=(regList||[]).find(function(e){ return e.role===lookup.role; });
    else entry=(regList||[]).find(function(e){ return e.id===lookup.id; });
    if(!entry) return Promise.resolve(null);
    const basePath=CEREMONY_ASSETS_BASE+entry.path;
    return _ceremonyFetchJSON(basePath+'companion.json').then(function(pkg){
      return pkg ? {id:entry.id,name:entry.name,basePath:basePath,pkg:pkg} : null;
    });
  }

  function _entityLookupFor(beatEntity,companionId){
    if(beatEntity==='egg') return {role:'traveller'};
    if(beatEntity==='guardian') return {role:'guardian'};
    return {id:companionId};
  }

  // A small, real reuse of companionEngine.js's own sparkle vocabulary
  // (the identical .companion-sparkle/.companion-sparkle-burst classes
  // + companion-sparkle-burst keyframe css/style.css already declares
  // for the corner widget's own click reaction) rather than a second,
  // parallel particle system — just spawned at the ceremony's own
  // larger scale instead of the widget's small portrait.
  function _ceremonySparkleBurst(container,count){
    for(let i=0;i<count;i++){
      const span=document.createElement('span');
      span.className='companion-sparkle companion-sparkle-burst';
      span.style.setProperty('--sx',((Math.random()*2-1)*70).toFixed(1)+'px');
      span.style.setProperty('--sy',((Math.random()*2-1)*40).toFixed(1)+'px');
      span.style.setProperty('--srot',((Math.random()*2-1)*40).toFixed(0)+'deg');
      container.appendChild(span);
      span.addEventListener('animationend',function(){ if(span.parentNode) span.parentNode.removeChild(span); });
      setTimeout(function(){ if(span.parentNode) span.parentNode.removeChild(span); },1600);
    }
  }

  function _playCeremonyBeats(els,regList,beats,index,companionId){
    if(index>=beats.length) return Promise.resolve();
    const beat=beats[index];
    return _ceremonyResolveEntity(regList,_entityLookupFor(beat.entity,companionId)).then(function(info){
      els.stage.className='magic-card-ceremony-stage'+(beat.effect?(' magic-card-ceremony-effect-'+beat.effect):'');
      if(info && info.pkg){
        const file=info.pkg.states[beat.pose]||info.pkg.states[info.pkg.defaultState];
        if(file){
          els.img.src=info.basePath+file;
          els.img.alt=(info.name||info.id)+' — '+beat.pose;
        }
      }
      if(beat.effect==='blessing') _ceremonySparkleBurst(els.particles,3);
      els.msg.textContent=beat.speech||'';
      els.msg.classList.toggle('magic-card-ceremony-msg-hidden',!beat.speech);
      // Real recorded Lumo voice for the two Guardian beats (see
      // getCeremonySequence's own voiceId field) -- a no-op for any beat
      // that doesn't declare one (the Story Egg's silent beats, and the
      // newly-bonded Story Companion's own "Hello!" line, which has no
      // recording of its own yet -- it isn't Lumo).
      if(beat.voiceId && typeof window.LumoVoice!=='undefined') LumoVoice.play(beat.voiceId);
      return new Promise(function(resolve){ setTimeout(resolve,beat.durationMs||1500); });
    }).then(function(){
      return _playCeremonyBeats(els,regList,beats,index+1,companionId);
    });
  }

  // Plays the whole Creator Ceremony (Story Egg -> Glow -> Cracks ->
  // Lumo -> Blessing -> Companion Hatching -> Companion Hero) inside
  // `stage`, then calls onComplete(companionFields) with whichever
  // Story Companion was just randomly bonded — companionFields may be
  // null (Companion Runtime unavailable, or a registry with no
  // role:'companion' entries yet), a real, honest degrade state
  // MagicCard.claim() already handles gracefully.
  function _runCreatorCeremony(stage,placed,onComplete){
    stage.innerHTML='';
    const ceremonyStage=_el('div','magic-card-ceremony-stage');
    const imgWrap=_el('div','magic-card-ceremony-img-wrap');
    const particles=_el('div','magic-card-ceremony-particles');
    particles.setAttribute('aria-hidden','true');
    imgWrap.appendChild(particles);
    const img=document.createElement('img');
    img.className='magic-card-ceremony-img';
    img.alt='';
    imgWrap.appendChild(img);
    ceremonyStage.appendChild(imgWrap);
    const msg=_el('div','magic-card-ceremony-msg magic-card-ceremony-msg-hidden');
    ceremonyStage.appendChild(msg);
    stage.appendChild(ceremonyStage);

    if(typeof window.CompanionEngine==='undefined' || typeof CompanionDirector==='undefined' || typeof MagicCard==='undefined'){
      // No Companion Runtime available at all -- skip straight to a
      // companion-less claim rather than leaving the ceremony (and the
      // child) waiting on nothing.
      onComplete(null);
      return;
    }

    const els={stage:ceremonyStage,img:img,msg:msg,particles:particles};
    window.CompanionEngine.loadRegistry(CEREMONY_ASSETS_BASE).then(function(regList){
      return MagicCard.assignBondedCompanion().then(function(companionFields){
        const beats=CompanionDirector.getCeremonySequence
          ? CompanionDirector.getCeremonySequence(
              companionFields&&companionFields.companionId,
              companionFields&&companionFields.companionName,
              companionFields&&companionFields.companionSpecies)
          : [];
        return _playCeremonyBeats(els,regList,beats,0,companionFields&&companionFields.companionId)
          .then(function(){ onComplete(companionFields); });
      });
    }).catch(function(){ onComplete(null); });
  }

  function _showFirstClaimedMoment(stage,card,onNext){
    stage.innerHTML='';
    stage.appendChild(_el('div','magic-card-claimed-title',(card.nickname||'Star Traveler')+', your sky is alive.'));
    // The card shown here has two real sides, not just a bare
    // constellation — downloadable and printable right now, matching
    // the moment it's actually made, not deferred to a separate later
    // screen.
    stage.appendChild(_buildCardArtView(card));
    const cont=_el('button','magic-card-claim-btn','Continue');
    cont.type='button';
    cont.addEventListener('click',onNext);
    stage.appendChild(cont);
  }

  function _finishAwakening(onDone){
    MagicCard.markAwakeningOffered();
    overlay.classList.remove('magic-card-mode-awaken');
    _hide();
    refreshHeaderBadge();
    // Companion Canon Freeze -- the ceremony's one true exit point,
    // regardless of outcome (Claimed / Maybe Later / Just Exploring).
    // A Creator born during this ceremony was already handled by
    // MagicCard.claim()'s own 'creator-born' hook; this covers the
    // still-Traveller case (settling a Story Egg left mid-"hatching").
    try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('ceremony-closed'); }catch(e){}
    try{ onDone(); }catch(e){}
  }

  const api={
    checkIdentityGate:checkIdentityGate,
    showAwakening:showAwakening,
    openHome:openHome,
    refreshHeaderBadge:refreshHeaderBadge,
    beginCreatorSignature:beginCreatorSignature
  };
  try{ window.MagicCardUI=api; }catch(e){}
  return api;
})();
