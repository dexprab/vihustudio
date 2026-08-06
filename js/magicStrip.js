/* MagicStrip — the still-image half of Magic Publish (roadmap M5).
 *
 * A single picture of how a page was made: Blank → World → Artwork →
 * Decorations → Words → Finished, laid out as a film strip. It exists
 * because a still image is the thing that survives being forwarded,
 * printed, and stuck on a fridge — a video is not.
 *
 * This module is a COMPOSITOR, not a renderer. It never draws a Scene
 * and never touches SlideRenderer: the caller hands it bitmaps that
 * were already produced through the one shared render path (Rule 5 —
 * Publish Fidelity), and this file only arranges them and draws the
 * chrome around them. That split is what lets M6's publish bundle call
 * it directly without inheriting any render plumbing.
 *
 * Frame selection (§6 of docs/MAGIC_PUBLISH_ARCHITECTURE.md): "the
 * frame selection IS the stage list, so there is no separate selection
 * algorithm to write." That was written before M4 expanded the Words
 * beat into up to eight word steps, so it needs one small refinement
 * rather than a rewrite: the strip takes ONE frame per beat — the LAST
 * stage of each kind — so Words contributes its finished sentence
 * rather than "Once". Because revealStages always ends on the caller's
 * own slide, the last selected frame IS the finished page; showing it
 * again under a second caption would be padding, which §6 explicitly
 * rules out ("rather than padding with duplicates").
 */
const MagicStrip=(function(){
  'use strict';

  // Warm dark film body rather than pure black — this sits beside a
  // child's artwork, and #000 reads as a technical export.
  const FILM_BG='#1E1A17';
  const FILM_EDGE='#141110';
  const SPROCKET='#0C0A09';
  const CAPTION_FG='#F3ECE0';
  const CAPTION_DIM='#B7A894';
  const FOOTER_FG='#F3ECE0';
  const BRAND_FG='#FFCB45';

  // One place for every measurement, so a layout change is arithmetic
  // rather than a hunt through drawing code. All values are in output
  // pixels at the default frame height; a caller asking for a taller
  // frame scales everything proportionally via `_scaleChrome`.
  const BASE={
    frameH:540,        // a cell's picture height; width follows the page's own aspect
    gutter:22,         // between cells
    pad:26,            // film body inset around the whole block of cells
    sprocket:38,       // the perforated band along each long edge
    caption:52,        // the numeral + beat name beneath each cell
    footer:96,         // title + brand bar
    holeW:26, holeH:34, holeGap:34, holeRadius:7
  };

  const LAYOUTS={
    strip:{id:'strip', label:'Strip', cols:null, sprocketEdges:'horizontal'},
    grid: {id:'grid',  label:'Grid',  cols:2,    sprocketEdges:'vertical'}
  };

  function _scaleChrome(frameH){
    const k=(typeof frameH==='number'&&frameH>0) ? frameH/BASE.frameH : 1;
    const out={};
    Object.keys(BASE).forEach(function(key){
      out[key]=(key==='frameH') ? Math.round(frameH||BASE.frameH) : Math.max(1,Math.round(BASE[key]*k));
    });
    return out;
  }

  /* One frame per beat, in beat order, last-of-each-kind.
   *
   * Deduping by `kind` rather than by label matters: M4 gives the
   * finished stage the LAST beat's kind (because the finished frame IS
   * that beat arriving), so a page whose last beat is Words yields
   * exactly one Words cell showing the complete sentence — not one
   * "Your Words" cell plus a near-identical "Finished" one. */
  function selectFrames(stages){
    if(!Array.isArray(stages)) return [];
    const order=[];
    const byKind={};
    for(let i=0;i<stages.length;i++){
      const st=stages[i];
      if(!st||!st.slide) continue;
      const kind=st.kind||('stage-'+i);
      if(!byKind[kind]) order.push(kind);
      byKind[kind]=st;                     // last wins
    }
    return order.map(function(k){ return byKind[k]; });
  }

  // Rows for a given cell count. Strip is always one row. Grid is two
  // columns with a short final row CENTRED rather than padded — §6:
  // "drops to a 1 × 3 or 1 × 4 strip rather than padding with
  // duplicates." A two-cell grid degenerates to a single row, which is
  // the honest answer: there is nothing to fold.
  function planRows(count, layout){
    const n=Math.max(0,count|0);
    if(n===0) return [];
    const cols=(layout&&layout.cols)|0;
    if(!cols||n<=cols) return [n];
    const rows=[];
    let left=n;
    while(left>0){ const take=Math.min(cols,left); rows.push(take); left-=take; }
    return rows;
  }

  function _roundRect(g,x,y,w,h,r){
    const rr=Math.max(0,Math.min(r,Math.min(w,h)/2));
    g.beginPath();
    g.moveTo(x+rr,y);
    g.arcTo(x+w,y,x+w,y+h,rr);
    g.arcTo(x+w,y+h,x,y+h,rr);
    g.arcTo(x,y+h,x,y,rr);
    g.arcTo(x,y,x+w,y,rr);
    g.closePath();
  }

  // Perforations. Drawn along whichever pair of edges is the LONG one
  // for this layout, which is what makes both layouts read as film:
  // a wide strip is perforated top and bottom, a portrait sheet left
  // and right.
  function _drawSprockets(g,W,H,C,edges){
    g.fillStyle=SPROCKET;
    if(edges==='vertical'){
      const step=C.holeH+C.holeGap;
      const inset=Math.round((C.sprocket-C.holeW)/2);
      for(let y=C.holeGap; y+C.holeH<=H; y+=step){
        _roundRect(g,inset,y,C.holeW,C.holeH,C.holeRadius); g.fill();
        _roundRect(g,W-inset-C.holeW,y,C.holeW,C.holeH,C.holeRadius); g.fill();
      }
    }else{
      const step=C.holeW+C.holeGap;
      const inset=Math.round((C.sprocket-C.holeH)/2);
      for(let x=C.holeGap; x+C.holeW<=W; x+=step){
        _roundRect(g,x,inset,C.holeW,C.holeH,C.holeRadius); g.fill();
        _roundRect(g,x,H-inset-C.holeH,C.holeW,C.holeH,C.holeRadius); g.fill();
      }
    }
  }

  function _font(px,weight){ return (weight||600)+' '+px+'px "Nunito", "Segoe UI", system-ui, sans-serif'; }

  function _fitText(g,text,maxW,startPx,weight){
    let px=startPx;
    g.font=_font(px,weight);
    while(px>10 && g.measureText(text).width>maxW){ px-=1; g.font=_font(px,weight); }
    return px;
  }

  /* compose(cells, opts) → HTMLCanvasElement | null
   *
   * cells: [{bitmap, label}] — bitmap is anything drawImage accepts.
   * opts:  {layout:'strip'|'grid', frameH, title, brand, cellW, cellH}
   *
   * cellW/cellH describe the PAGE's own aspect (the caller knows it via
   * SlideRenderer.getCanvasSize); the picture is drawn to fill its cell
   * exactly, so a landscape Scene produces landscape cells and nothing
   * is ever cropped or letterboxed (Rule 1 — Fidelity). */
  function compose(cells, opts){
    const list=(cells||[]).filter(function(c){ return c&&c.bitmap; });
    if(list.length===0) return null;
    const o=opts||{};
    const layout=LAYOUTS[o.layout]||LAYOUTS.strip;
    const C=_scaleChrome(o.frameH);

    // Cell picture box, at the page's own aspect.
    const srcW=(typeof o.cellW==='number'&&o.cellW>0)?o.cellW:1080;
    const srcH=(typeof o.cellH==='number'&&o.cellH>0)?o.cellH:1350;
    const picH=C.frameH;
    const picW=Math.max(1,Math.round(picH*(srcW/srcH)));
    const cellH=picH+C.caption;

    const rows=planRows(list.length,layout);
    const widest=rows.reduce(function(m,n){ return Math.max(m,n); },0);

    const blockW=widest*picW+(widest-1)*C.gutter;
    const blockH=rows.length*cellH+(rows.length-1)*C.gutter;

    const sideBand=(layout.sprocketEdges==='vertical')?C.sprocket:0;
    const edgeBand=(layout.sprocketEdges==='vertical')?0:C.sprocket;

    const W=blockW+C.pad*2+sideBand*2;
    const H=blockH+C.pad*2+edgeBand*2+C.footer;

    const canvas=document.createElement('canvas');
    canvas.width=W; canvas.height=H;
    const g=canvas.getContext('2d');
    if(!g) return null;
    try{ g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high'; }catch(e){}

    // Film body.
    g.fillStyle=FILM_BG;
    g.fillRect(0,0,W,H);
    _drawSprockets(g,W,H-C.footer,C,layout.sprocketEdges);

    // Cells, row by row, short rows centred.
    const originX=sideBand+C.pad;
    const originY=edgeBand+C.pad;
    let idx=0;
    for(let r=0;r<rows.length;r++){
      const n=rows[r];
      const rowW=n*picW+(n-1)*C.gutter;
      const rowX=originX+Math.round((blockW-rowW)/2);
      const rowY=originY+r*(cellH+C.gutter);
      for(let c=0;c<n;c++){
        const cell=list[idx];
        const x=rowX+c*(picW+C.gutter);
        // A hairline round the picture so a pale page still reads as a
        // separate frame against the film body.
        g.fillStyle=FILM_EDGE;
        g.fillRect(x-2,rowY-2,picW+4,picH+4);
        try{ g.drawImage(cell.bitmap,x,rowY,picW,picH); }catch(e){}
        // Caption: numeral + beat name, inside the film's own chrome
        // and never on the artwork.
        const capY=rowY+picH;
        const numeral=String(idx+1);
        g.textBaseline='middle';
        g.fillStyle=CAPTION_DIM;
        g.textAlign='left';
        const numPx=Math.round(C.caption*0.44);
        g.font=_font(numPx,700);
        g.fillText(numeral,x+4,capY+C.caption/2);
        const numW=g.measureText(numeral).width;
        if(cell.label){
          g.fillStyle=CAPTION_FG;
          const labPx=_fitText(g,cell.label,picW-numW-16,Math.round(C.caption*0.42),600);
          g.font=_font(labPx,600);
          g.fillText(cell.label,x+numW+12,capY+C.caption/2);
        }
        idx++;
      }
    }

    // Footer bar: the story's own name on the left, the brand on the
    // right. Inside the strip's chrome, per §6.
    const footY=H-C.footer;
    g.fillStyle=FILM_EDGE;
    g.fillRect(0,footY,W,C.footer);
    g.textBaseline='middle';
    const midY=footY+C.footer/2;
    const brand=o.brand||'Made in VihuPlanet';
    g.textAlign='right';
    g.fillStyle=BRAND_FG;
    const brandPx=_fitText(g,brand,Math.round(W*0.45),Math.round(C.footer*0.34),700);
    g.font=_font(brandPx,700);
    g.fillText(brand,W-C.pad,midY);
    const brandW=g.measureText(brand).width;
    const title=(o.title||'').trim();
    if(title){
      g.textAlign='left';
      g.fillStyle=FOOTER_FG;
      const titlePx=_fitText(g,title,W-C.pad*2-brandW-24,Math.round(C.footer*0.36),600);
      g.font=_font(titlePx,600);
      g.fillText(title,C.pad,midY);
    }
    g.textAlign='left';
    return canvas;
  }

  const api={ compose, selectFrames, planRows, LAYOUTS, BASE };
  if(typeof window!=='undefined') window.MagicStrip=api;
  return api;
})();
