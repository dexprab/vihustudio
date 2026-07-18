// magicCard.js — Magic Card Identity Evolution, Phase 1 (local-only).
//
// Implements the data/state layer behind docs/artifact "VihuStudio —
// Magic Card Identity Evolution" (Product Architecture & UX Design).
// This is Phase 1 exactly as that document's own Product Recommendations
// section scoped it: "the awakening moment on first Publish, with
// claiming initially just meaning 'this device recognizes you' — no
// cross-device recall yet." Everything here is 100% local (localStorage
// only) — no Supabase, no schema change, no card_type='creator' RPC
// mechanism. Cross-device recall (Phase 2) can be layered on top of
// this exact local shape later without a redesign.
//
// The central design decision from that document: a claimed Magic
// Card's constellation pattern is minted ONCE, at claim time, and never
// changes — it is both the "sky" a child sees as their identity AND
// (in a future phase) the tap gesture that recalls their card
// elsewhere. Everything described as "the sky growing" is presentation
// layered on top of this fixed pattern, computed live from real usage
// signals (see growthSignals()) — never a second stored, mutable copy
// of the pattern itself.
//
// A genuinely new claimed Magic Card is NOT the same concept as a Vihu
// Card (js/cardPlatform.js) — that module mints a *shareable* card
// pointing at a World, redeemed by someone else. This module mints a
// *personal* card representing "this device recognizes you" — no
// sharing, no redemption by a third party. The constellation placement
// math (_placeConstellation) is intentionally duplicated rather than
// reused directly from cardPlatform.js: it's a handful of small, pure,
// stable functions with zero Supabase dependency, and cardPlatform.js's
// own version is entangled with the Vihu Card `pattern`/`code`
// generate() flow this module has no reason to depend on.
const MagicCard=(function(){
  'use strict';

  const CARDS_KEY='vihu-magic-cards';
  const ACTIVE_KEY='vihu-magic-card-active-id';
  const FLAGS_KEY='vihu-magic-card-flags';

  // Same curated shapes/grid as js/cardPlatform.js's own CONSTELLATIONS
  // — not astronomically precise, recognizable and pleasant to trace.
  const CONSTELLATIONS={
    ORION:[[1,2],[1,7],[4,4],[4,5],[4,6],[8,2],[8,7]],
    CASSIOPEIA:[[2,1],[4,3],[2,5],[4,7],[2,9]],
    URSA_MAJOR:[[1,1],[1,4],[3,4],[3,2],[4,5],[6,7],[8,8]],
    CYGNUS:[[1,5],[4,5],[7,5],[4,2],[4,8]],
    LYRA:[[2,5],[5,3],[5,7],[7,3],[7,7]]
  };
  const GRID_SIZE=10;

  function _minOf(points,idx){ return points.reduce(function(m,p){ return Math.min(m,p[idx]); },Infinity); }
  function _maxOf(points,idx){ return points.reduce(function(m,p){ return Math.max(m,p[idx]); },-Infinity); }
  function _shiftToOrigin(points){
    const minR=_minOf(points,0), minC=_minOf(points,1);
    return points.map(function(p){ return [p[0]-minR,p[1]-minC]; });
  }
  function _rotate(points,turns){
    let pts=points;
    for(let i=0;i<turns;i++){
      const maxR=_maxOf(pts,0);
      pts=pts.map(function(p){ return [p[1],maxR-p[0]]; });
    }
    return pts;
  }
  function _mirrorHorizontal(points){
    const maxC=_maxOf(points,1);
    return points.map(function(p){ return [p[0],maxC-p[1]]; });
  }
  function _placeConstellation(name){
    const base=CONSTELLATIONS[name];
    if(!base) return null;
    for(let attempt=0;attempt<20;attempt++){
      let pts=_shiftToOrigin(base);
      pts=_rotate(pts,Math.floor(Math.random()*4));
      if(Math.random()<0.5) pts=_mirrorHorizontal(pts);
      pts=_shiftToOrigin(pts);
      const maxR=_maxOf(pts,0), maxC=_maxOf(pts,1);
      if(maxR>=GRID_SIZE||maxC>=GRID_SIZE) continue;
      const offR=Math.floor(Math.random()*(GRID_SIZE-maxR));
      const offC=Math.floor(Math.random()*(GRID_SIZE-maxC));
      return {constellation:name,pattern:pts.map(function(p){ return [p[0]+offR,p[1]+offC]; })};
    }
    return {constellation:name,pattern:_shiftToOrigin(base)};
  }
  function _pickConstellationName(){
    const names=Object.keys(CONSTELLATIONS);
    return names[Math.floor(Math.random()*names.length)];
  }

  function _newId(){
    return 'mc_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }

  function _readCards(){
    try{
      const raw=localStorage.getItem(CARDS_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(e){ return []; }
  }
  function _writeCards(list){
    try{ localStorage.setItem(CARDS_KEY,JSON.stringify(list)); return true; }
    catch(e){ return false; }
  }

  function _readFlags(){
    try{
      const raw=localStorage.getItem(FLAGS_KEY);
      return raw?JSON.parse(raw):{};
    }catch(e){ return {}; }
  }
  function _writeFlags(flags){
    try{ localStorage.setItem(FLAGS_KEY,JSON.stringify(flags)); }catch(e){}
  }
  function getFlags(){ return _readFlags(); }
  function setFlags(patch){
    const flags=_readFlags();
    Object.keys(patch).forEach(function(k){ flags[k]=patch[k]; });
    _writeFlags(flags);
    return flags;
  }

  // Newest-claimed-first — matches every other "list" convention already
  // established in this codebase (CreatorProjectStore, World Builder's
  // ProjectStore).
  function list(){
    return _readCards().sort(function(a,b){ return new Date(b.claimedAt)-new Date(a.claimedAt); });
  }
  function get(id){
    return _readCards().find(function(c){ return c.id===id; })||null;
  }
  function count(){ return _readCards().length; }

  function getActiveId(){
    try{ return localStorage.getItem(ACTIVE_KEY)||null; }catch(e){ return null; }
  }
  function setActive(id){
    try{ localStorage.setItem(ACTIVE_KEY,id||''); }catch(e){}
    touch(id);
  }
  function getActive(){
    const id=getActiveId();
    if(!id) return null;
    const card=get(id);
    // A stale pointer (the card it named no longer exists) resolves to
    // null rather than throwing — the caller falls back to "no active
    // identity" exactly as if none had ever been set.
    return card;
  }

  function touch(id){
    if(!id) return;
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1) return;
    cards[idx].lastActiveAt=new Date().toISOString();
    _writeCards(cards);
  }

  // Generates a pattern WITHOUT persisting anything — used by the
  // Awakening ceremony (magicCardUI.js) to show the child the exact sky
  // they'll actually get if they claim it. Nothing is "locked in" until
  // claim() below is called with this same value, so "Maybe Later"
  // leaves no half-created card behind.
  function generatePattern(){
    return _placeConstellation(_pickConstellationName());
  }

  // Mints a brand-new claimed Magic Card. `precomputed`, when supplied
  // (the Awakening ceremony's own generatePattern() result), is used
  // verbatim rather than generating a second, different pattern — this
  // is what guarantees the sky the child watched form during the
  // ceremony is the SAME sky their claimed card actually has
  // afterward (Constellation Philosophy — "one constellation, two
  // faces"). Never regenerated for a given card afterward; the pattern
  // is permanent for the card's whole life.
  function claim(nickname,precomputed){
    const placed=precomputed||_placeConstellation(_pickConstellationName());
    const now=new Date().toISOString();
    const card={
      id:_newId(),
      nickname:(nickname||'').trim(),
      constellation:placed.constellation,
      pattern:placed.pattern,
      claimedAt:now,
      lastActiveAt:now
    };
    const cards=_readCards();
    cards.push(card);
    _writeCards(cards);
    setActive(card.id);
    return card;
  }

  function rename(id,nickname){
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1) return false;
    cards[idx].nickname=(nickname||'').trim();
    return _writeCards(cards);
  }

  // Real, already-available signals a "growing sky" presentation layer
  // can draw from without inventing a second gamification subsystem —
  // see the design document's own Section 16 (Technical Architecture)
  // and Section 10 (Constellation Lifecycle)'s "no counters, no
  // levels" constraint: these numbers exist to DERIVE a soft visual
  // (how many small companion stars to draw, how bright the glow is),
  // never to be shown to the child as a number.
  function growthSignals(){
    let projectCount=0;
    try{
      if(typeof CreatorProjectStore!=='undefined') projectCount=CreatorProjectStore.list().length;
    }catch(e){}
    const flags=_readFlags();
    return {
      projectCount:projectCount,
      daysSinceClaim:(function(){
        const active=getActive();
        if(!active) return 0;
        const ms=Date.now()-new Date(active.claimedAt).getTime();
        return Math.max(0,Math.floor(ms/86400000));
      })(),
      hasEverPublished:!!flags.hasEverPublished
    };
  }

  // Whether the first-Publish Awakening ceremony should run right now —
  // true exactly once per browser: no claimed card exists yet, and the
  // ceremony has never been offered before (whether the earlier offer
  // was claimed, deferred, or declined — offering it is a one-time
  // event per this design's own "never nagged again automatically"
  // decision; a permanent, quiet "claim later" affordance lives
  // elsewhere for a child who said not-yet).
  function shouldOfferAwakening(){
    return list().length===0 && !_readFlags().awakeningOffered;
  }
  function markAwakeningOffered(){ setFlags({awakeningOffered:true}); }
  function markEverPublished(){ setFlags({hasEverPublished:true}); }

  const api={
    list:list,
    get:get,
    count:count,
    getActiveId:getActiveId,
    getActive:getActive,
    setActive:setActive,
    touch:touch,
    generatePattern:generatePattern,
    claim:claim,
    rename:rename,
    growthSignals:growthSignals,
    shouldOfferAwakening:shouldOfferAwakening,
    markAwakeningOffered:markAwakeningOffered,
    markEverPublished:markEverPublished,
    getFlags:getFlags,
    setFlags:setFlags
  };
  try{ window.MagicCard=api; }catch(e){}
  return api;
})();
