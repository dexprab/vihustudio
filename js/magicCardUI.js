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

  // ---------- Header glyph ----------
  function refreshHeaderBadge(){
    if(!_headerBadge) _headerBadge=document.getElementById('magicCardBadge');
    if(!_headerBadge) return;
    const active=(typeof MagicCard!=='undefined')?MagicCard.getActive():null;
    if(!active){ _headerBadge.classList.add('hidden'); return; }
    _headerBadge.classList.remove('hidden');
    _headerBadge.innerHTML='';
    _headerBadge.appendChild(_renderConstellation(active.pattern,{size:26}));
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

    const skyWrap=_el('div','magic-card-home-sky');
    const signals=MagicCard.growthSignals();
    // Growth is derived, presented, never counted onscreen — a soft cap
    // so a very active child's sky still reads as "rich," not cluttered.
    const companionCount=Math.min(6,Math.floor(signals.projectCount/2)+Math.floor(signals.daysSinceClaim/14));
    skyWrap.appendChild(_renderConstellation(active.pattern,{size:260,companionCount:companionCount}));
    panel.appendChild(skyWrap);

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
      if(cardId) MagicCard.setActive(cardId);
      overlay.classList.remove('magic-card-mode-gate');
      _hide();
      refreshHeaderBadge();
      onContinue();
    }

    const panel=_el('div','magic-card-gate-panel');
    if(cards.length===1){
      const card=cards[0];
      panel.appendChild(_renderConstellation(card.pattern,{size:180}));
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

  function _renderPicker(panel,cards,proceed){
    const existingGrid=panel.querySelector('.magic-card-gate-grid');
    if(existingGrid) existingGrid.remove();
    const existingWelcome=panel.querySelector('.magic-card-gate-welcome');
    if(existingWelcome) existingWelcome.remove();
    const existingContinue=panel.querySelector('.magic-card-gate-continue');
    if(existingContinue) existingContinue.remove();
    const existingSvg=panel.querySelector('svg.magic-card-constellation-svg');
    if(existingSvg) existingSvg.remove();

    const grid=_el('div','magic-card-gate-grid');
    cards.forEach(function(card){
      const tile=_el('button','magic-card-gate-tile');
      tile.type='button';
      tile.appendChild(_renderConstellation(card.pattern,{size:70}));
      tile.appendChild(_el('span','magic-card-gate-tile-name',card.nickname||'Star Traveler'));
      tile.addEventListener('click',function(){ proceed(card.id); });
      grid.appendChild(tile);
    });
    const explore=_el('button','magic-card-gate-explore','🌱 Begin Exploring');
    explore.type='button';
    explore.addEventListener('click',function(){ proceed(null); });
    grid.appendChild(explore);
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
      const card=MagicCard.claim(input.value,placed);
      MagicCard.markAwakeningOffered();
      refreshHeaderBadge();
      _showFirstClaimedMoment(stage,card,function(){ _finishAwakening(onDone); });
    });
    stage.appendChild(cont);
    setTimeout(function(){ try{ input.focus(); }catch(e){} },50);
  }

  function _showFirstClaimedMoment(stage,card,onNext){
    stage.innerHTML='';
    const skyWrap=_el('div','magic-card-awaken-sky magic-card-claimed-glow');
    skyWrap.appendChild(_renderConstellation(card.pattern,{size:220}));
    stage.appendChild(skyWrap);
    stage.appendChild(_el('div','magic-card-claimed-title',(card.nickname||'Star Traveler')+', your sky is alive.'));
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
