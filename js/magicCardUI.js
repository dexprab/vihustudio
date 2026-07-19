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
// Screen 1 (Welcome) and Screen 3 (Visitor Entry) are deliberately NOT
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
const MagicCardUI=(function(){
  'use strict';

  let overlay=null, content=null;
  let _headerBadge=null;

  function _ensureDom(){
    if(overlay) return;
    overlay=document.getElementById('magicCardOverlay');
    content=document.getElementById('magicCardContent');
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
      // continue as a Visitor this time. setActive(null) already
      // correctly clears the pointer (see js/magicCard.js); this was
      // only ever a missing call, not a missing capability.
      MagicCard.setActive(cardId||null);
      overlay.classList.remove('magic-card-mode-gate');
      _hide();
      refreshHeaderBadge();
      onContinue();
    }

    const panel=_el('div','magic-card-gate-panel');
    if(cards.length===1){
      const card=cards[0];
      // Never the constellation, real or decorative — see
      // _buildGateIdentityGlyph's own comment above.
      panel.appendChild(_buildGateIdentityGlyph(card,140));
      panel.appendChild(_el('div','magic-card-gate-welcome','Welcome back, '+(card.nickname||'Star Traveler')));
      const btn=_el('button','magic-card-gate-continue','Continue My Journey');
      btn.type='button';
      btn.addEventListener('click',function(){ proceed(card.id); });
      panel.appendChild(btn);
      const notYou=_el('button','magic-card-gate-notyou','Not you?');
      notYou.type='button';
      notYou.addEventListener('click',function(){ _renderPicker(panel,cards,proceed); });
      panel.appendChild(notYou);
    }else{
      panel.appendChild(_el('div','magic-card-gate-title','Continue Your Journey'));
      _renderPicker(panel,cards,proceed);
    }
    content.appendChild(panel);
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

  function _renderPicker(panel,cards,proceed){
    const existingGrid=panel.querySelector('.magic-card-gate-grid');
    if(existingGrid) existingGrid.remove();
    const existingWelcome=panel.querySelector('.magic-card-gate-welcome');
    if(existingWelcome) existingWelcome.remove();
    const existingContinue=panel.querySelector('.magic-card-gate-continue');
    if(existingContinue) existingContinue.remove();
    // The single-card "Welcome back" view's own standalone identity
    // glyph (a direct child of panel, not inside .magic-card-gate-grid
    // — the grid's own per-tile glyphs are removed for free along with
    // existingGrid above) has no place in the picker's own grid layout.
    const existingGlyph=panel.querySelector('.magic-card-gate-glyph');
    if(existingGlyph) existingGlyph.remove();
    // The single-card "Welcome back" view's own "Not you?" link has no
    // remaining purpose once the picker is showing every option — left
    // in place it reads as a stray, unstyled heading floating above the
    // grid (the exact artifact a real screenshot surfaced).
    const existingNotYou=panel.querySelector('.magic-card-gate-notyou');
    if(existingNotYou) existingNotYou.remove();
    if(!panel.querySelector('.magic-card-gate-title')){
      panel.insertBefore(_el('div','magic-card-gate-title','Whose adventure is this?'),panel.firstChild);
    }

    const grid=_el('div','magic-card-gate-grid');
    cards.forEach(function(card){
      const tile=_el('button','magic-card-gate-tile');
      tile.type='button';
      tile.appendChild(_buildGateIdentityGlyph(card,56));
      tile.appendChild(_el('span','magic-card-gate-tile-name',card.nickname||'Star Traveler'));
      tile.addEventListener('click',function(){ proceed(card.id); });
      grid.appendChild(tile);
    });
    grid.appendChild(_buildGateActionTile('🌱','Begin Exploring',function(){ proceed(null); }));

    // A quiet second option for the "some cards already local on this
    // device, but I want to pull a DIFFERENT one too" case — sets a
    // one-shot flag js/creationFlow.js's Screen 1 checks for and
    // consumes on its very next render (this module has no direct path
    // of its own into that other module's DOM).
    grid.appendChild(_buildGateActionTile('✨','Recall a different card',function(){
      try{ window.__magicCardAutoOpenRecall=true; }catch(e){}
      proceed(null);
    }));
    panel.appendChild(grid);
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
  // ('visitor' -> the Story Egg, 'guardian' -> Lumo) or an explicit id
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
    if(beatEntity==='egg') return {role:'visitor'};
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
    // still-Visitor case (settling a Story Egg left mid-"hatching").
    try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('ceremony-closed'); }catch(e){}
    try{ onDone(); }catch(e){}
  }

  const api={
    checkIdentityGate:checkIdentityGate,
    showAwakening:showAwakening,
    openHome:openHome,
    refreshHeaderBadge:refreshHeaderBadge
  };
  try{ window.MagicCardUI=api; }catch(e){}
  return api;
})();
