// js/stageSky.js — the stage's own sky.
//
// A purely decorative layer of stars and clouds behind the child's page,
// added because the workspace was a flat sheet of one colour and every
// other visual change made the Studio tidier without making it feel like
// anywhere. Stars twinkle on staggered delays, clouds drift, and nothing
// here is ever interactive.
//
// ONE HARD RULE, and it is the whole reason this is a separate module
// rather than something drawn by the renderer: the sky belongs to the
// STAGE — the area around the page — and must never touch the page
// itself. The page is drawn by renderer/slideRenderer.js and is exactly
// what Publish reproduces (Creator Rule 5), so a cloud painted there
// would end up inside a child's finished story. This module mounts a
// sibling of .preview-wrapper, sits at z-index 0 behind everything, and
// is pointer-events:none, so it cannot reach the page, the canvas, or
// any control.
//
// Mounted once at boot and then left alone. Nothing reads it, nothing
// depends on it, and removing the script tag removes the feature with no
// other consequence.
const StageSky=(function(){
  'use strict';

  // Fixed rather than random: a decorative layer that reshuffles itself
  // on every load reads as noise, and a child returning to the Studio
  // should find the same sky they left. Positions are percentages of the
  // stage so they hold at every viewport.
  //
  // The right-hand side is deliberately sparse — that is where the page
  // sits, and behind it a star is just wasted paint.
  // Placed for the ordinary Studio, where the page sits centred and the
  // open space is the gutter down each side. Both gutters are used, so
  // the sky is balanced rather than pooling on one edge.
  //
  // During the Rite some of it IS covered — Lumo's dock takes the left
  // gutter and the page shifts right into the other. That is accepted
  // rather than designed around: the Rite happens once, the Studio is
  // forever, and a sky arranged around a one-time layout would look
  // wrong every day after it.
  const STARS=[
    {x:5,  y:9,  size:26, fill:'#F5C542', delay:0},
    {x:88, y:7,  size:14, fill:'#6EA8F0', delay:2.4},
    {x:3,  y:57, size:15, fill:'#DCC6F7', delay:.9},
    {x:91, y:49, size:20, fill:'#F9A8C8', delay:1.3},
    {x:9,  y:86, size:12, fill:'#F5C542', delay:1.7}
  ];
  const SPARKS=[
    {x:20, y:24, size:5, fill:'#F5C542', delay:.5},
    {x:81, y:73, size:4, fill:'#F9A8C8', delay:1.9},
    {x:6,  y:38, size:3, fill:'#6EA8F0', delay:1.1}
  ];
  const CLOUDS=[
    {x:76, y:64, w:132, delay:0},
    {x:1,  y:28, w:104, delay:3}
  ];

  const NS='http://www.w3.org/2000/svg';
  const STAR_D='M12 1.6l2.9 6.4 7 .8-5.2 4.7 1.4 6.9L12 16.9 5.9 20.4l1.4-6.9L2.1 8.8l7-.8z';

  let _root=null;

  function _star(spec){
    const el=document.createElement('span');
    el.className='stage-sky-star';
    el.style.left=spec.x+'%';
    el.style.top=spec.y+'%';
    el.style.animationDelay=spec.delay+'s';
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('width',spec.size);
    svg.setAttribute('height',spec.size);
    svg.setAttribute('viewBox','0 0 24 24');
    const path=document.createElementNS(NS,'path');
    path.setAttribute('d',STAR_D);
    path.setAttribute('fill',spec.fill);
    svg.appendChild(path);
    el.appendChild(svg);
    return el;
  }

  function _spark(spec){
    const el=document.createElement('span');
    el.className='stage-sky-spark';
    el.style.left=spec.x+'%';
    el.style.top=spec.y+'%';
    el.style.width=spec.size+'px';
    el.style.height=spec.size+'px';
    el.style.background=spec.fill;
    el.style.animationDelay=spec.delay+'s';
    return el;
  }

  function _cloud(spec){
    const el=document.createElement('span');
    el.className='stage-sky-cloud';
    el.style.left=spec.x+'%';
    el.style.top=spec.y+'%';
    el.style.animationDelay=spec.delay+'s';
    const h=Math.round(spec.w*0.42);
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('width',spec.w);
    svg.setAttribute('height',h);
    svg.setAttribute('viewBox','0 0 104 44');
    const g=document.createElementNS(NS,'g');
    g.setAttribute('fill','#FFFFFF');
    [[52,31,44,12],[38,22,19,14],[64,20,22,15]].forEach(function(e){
      const el2=document.createElementNS(NS,'ellipse');
      el2.setAttribute('cx',e[0]); el2.setAttribute('cy',e[1]);
      el2.setAttribute('rx',e[2]); el2.setAttribute('ry',e[3]);
      g.appendChild(el2);
    });
    svg.appendChild(g);
    el.appendChild(svg);
    return el;
  }

  // Mounts into .preview-wrapper — the page's OWN region — rather than
  // the whole centre column. The column also contains the Object Strip,
  // and a cloud drifting behind a child's object cards is clutter, not
  // atmosphere. The wrapper is exactly "the space around the page", it
  // grows and shrinks with the page, and it cannot reach the Strip.
  // Idempotent: calling it twice replaces the layer rather than stacking.
  function mount(){
    try{
      const area=document.querySelector('.preview-wrapper');
      if(!area) return false;
      if(_root && _root.parentNode) _root.parentNode.removeChild(_root);
      _root=document.createElement('div');
      _root.className='stage-sky';
      _root.setAttribute('aria-hidden','true');
      STARS.forEach(function(s){ _root.appendChild(_star(s)); });
      SPARKS.forEach(function(s){ _root.appendChild(_spark(s)); });
      CLOUDS.forEach(function(c){ _root.appendChild(_cloud(c)); });
      area.insertBefore(_root,area.firstChild);
      return true;
    }catch(e){ return false; }
  }

  function unmount(){
    try{ if(_root && _root.parentNode) _root.parentNode.removeChild(_root); }catch(e){}
    _root=null;
  }

  // Self-mounting, deliberately: .preview-area is in the static markup,
  // nothing else needs to know this exists, and the header's promise
  // that deleting the script tag deletes the feature is only true if no
  // other module has to call it.
  function _boot(){ mount(); }
  try{
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',_boot);
    else _boot();
  }catch(e){}

  return { mount:mount, unmount:unmount };
})();
try{ window.StageSky=StageSky; }catch(e){}
