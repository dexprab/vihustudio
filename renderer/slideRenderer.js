const SlideRenderer=(()=>{
  let c,x;
  const W=1080,H=1350;
  const PANEL_X=70, PANEL_Y=185, PANEL_W=940, PANEL_H=930;

  const FALLBACK_THEME={
    frame:{ color:'#1D3457' },
    panel:{ color:'#FFFFFF' },
    storyText:{ font:'Arial', size:56, color:'#FFFFFF' },
    footerText:{ font:'Arial', size:24, color:'#FFFFFF' },
    watermark:{ font:'Arial', size:24, color:'#FFFFFF' }
  };
  const FALLBACK_OPTIONS={
    variant:'classic',
    panelStyle:'classic',
    footerStyle:'classic',
    decorations:[],
    pageNumber:'bottom-right',
    bookTitleVisibility:'show',
    bookTitlePosition:'bottom-left',
    handleVisibility:'show',
    handlePosition:'top-right'
  };

  function _theme(s){
    if(s && s.theme) return s.theme;
    if(typeof ThemeEngine!=='undefined'){
      try{ return ThemeEngine.getActiveTheme(); }catch(e){}
    }
    return FALLBACK_THEME;
  }

  function _options(s){
    if(s && s.themeOptions) return s.themeOptions;
    if(typeof ThemeEngine!=='undefined'){
      try{ return ThemeEngine.getOptions(); }catch(e){}
    }
    return FALLBACK_OPTIONS;
  }

  function _frameColor(theme,opts){
    if(typeof ThemeEngine!=='undefined' && theme && theme.variants){
      try{ return ThemeEngine.resolveFrameColor(theme,opts.variant); }catch(e){}
    }
    return theme.frame.color;
  }

  function init(cv){ c=cv; c.width=W; c.height=H; x=c.getContext('2d'); }

  function render(s){
    if(!x) return;
    const t=_theme(s);
    const opts=_options(s);

    // Frame
    x.fillStyle=_frameColor(t,opts);
    x.fillRect(0,0,W,H);

    // Panel (style-driven)
    _drawPanel(t.panel.color,opts.panelStyle);

    // Top story text
    if(s.storyBeat){
      x.fillStyle=t.storyText.color;
      x.font=t.storyText.size+'px '+t.storyText.font;
      x.textAlign='left';
      x.fillText(s.storyBeat,60,100);
    }

    // Handle / branding watermark
    _drawHandle(t,opts);

    // Image inside panel
    if(s.image && s.image.width){
      const sc=Math.min(900/s.image.width,890/s.image.height);
      const w=s.image.width*sc, h=s.image.height*sc;
      x.drawImage(s.image,70+(940-w)/2,185+(930-h)/2,w,h);
    }

    // Decorations on the frame
    _drawDecorations(opts.decorations,t,opts);

    // Footer (book title)
    _drawFooter(t,opts,s.bookTitle||'');

    // Page number
    _drawPageNumber(t,opts,s.page||1,s.totalPages||1);
  }

  function _drawHandle(theme,opts){
    if(opts.handleVisibility==='hide') return;
    const pos=opts.handlePosition||'top-right';
    let hx, hy, align;
    if(pos==='top-left'){ hx=60; hy=60; align='left'; }
    else if(pos==='bottom-left'){ hx=60; hy=H-30; align='left'; }
    else if(pos==='bottom-right'){ hx=W-60; hy=H-30; align='right'; }
    else { hx=W-60; hy=60; align='right'; }
    x.fillStyle=theme.watermark.color;
    x.font=theme.watermark.size+'px '+theme.watermark.font;
    x.textAlign=align;
    x.fillText('@vihuplanet',hx,hy);
  }

  // --- Panel styles ---
  function _drawPanel(color,style){
    x.fillStyle=color;
    if(style==='rounded'){
      _roundedRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H,40);
      x.fill();
    }else if(style==='cloud'){
      _cloudShape(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
      x.fill();
    }else if(style==='scroll'){
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
      x.save();
      x.fillStyle='rgba(0,0,0,0.10)';
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,22);
      x.fillRect(PANEL_X,PANEL_Y+PANEL_H-22,PANEL_W,22);
      x.fillStyle='rgba(0,0,0,0.05)';
      x.fillRect(PANEL_X,PANEL_Y+22,PANEL_W,8);
      x.fillRect(PANEL_X,PANEL_Y+PANEL_H-30,PANEL_W,8);
      x.restore();
    }else{
      x.fillRect(PANEL_X,PANEL_Y,PANEL_W,PANEL_H);
    }
  }

  function _roundedRect(rx,ry,rw,rh,r){
    x.beginPath();
    x.moveTo(rx+r,ry);
    x.arcTo(rx+rw,ry,rx+rw,ry+rh,r);
    x.arcTo(rx+rw,ry+rh,rx,ry+rh,r);
    x.arcTo(rx,ry+rh,rx,ry,r);
    x.arcTo(rx,ry,rx+rw,ry,r);
    x.closePath();
  }

  function _cloudShape(rx,ry,rw,rh){
    const cx=rx+rw/2, cy=ry+rh/2;
    x.beginPath();
    x.ellipse(cx,cy,rw/2-10,rh/2-10,0,0,Math.PI*2);
    x.closePath();
  }

  // --- Footer (book title) ---
  function _drawFooter(theme,opts,bookTitle){
    if(opts.bookTitleVisibility==='hide') return;
    if(opts.footerStyle==='hidden' || !bookTitle) return;
    let size=theme.footerText.size;
    if(opts.footerStyle==='modern') size=Math.round(size*1.1);
    else if(opts.footerStyle==='minimal') size=Math.round(size*0.75);
    x.fillStyle=theme.footerText.color;
    x.font=size+'px '+theme.footerText.font;
    const pos=opts.bookTitlePosition||'bottom-left';
    let bx, align;
    if(pos==='bottom-center'){ bx=W/2; align='center'; }
    else if(pos==='bottom-right'){ bx=W-60; align='right'; }
    else { bx=320; align='left'; }
    x.textAlign=align;
    x.fillText(bookTitle,bx,1285);
  }

  // --- Page number ---
  function _drawPageNumber(theme,opts,page,total){
    if(opts.pageNumber==='hidden') return;
    x.fillStyle=theme.footerText.color;
    x.font=theme.footerText.size+'px '+theme.footerText.font;
    const label=page+' / '+total;
    if(opts.pageNumber==='bottom-center'){
      x.textAlign='center';
      x.fillText(label,W/2,opts.footerStyle==='hidden'?1285:1325);
    }else{
      x.textAlign='left';
      x.fillText(label,900,1285);
    }
  }

  // --- Decorations ---
  function _drawDecorations(decorations,theme,opts){
    if(!decorations||decorations.length===0) return;
    const color=theme.watermark.color;
    decorations.forEach(function(d){
      if(d==='stars') _drawStars(color);
      else if(d==='clouds') _drawClouds(color);
      else if(d==='birds') _drawBirds(color);
      else if(d==='trees') _drawTrees(color);
      else if(d==='flowers') _drawFlowers(color);
    });
  }

  function _drawStar(cx,cy,r){
    x.beginPath();
    for(let i=0;i<5;i++){
      const a1=(i*2*Math.PI/5)-Math.PI/2;
      const a2=a1+Math.PI/5;
      const x1=cx+r*Math.cos(a1), y1=cy+r*Math.sin(a1);
      const x2=cx+(r/2)*Math.cos(a2), y2=cy+(r/2)*Math.sin(a2);
      if(i===0) x.moveTo(x1,y1); else x.lineTo(x1,y1);
      x.lineTo(x2,y2);
    }
    x.closePath();
    x.fill();
  }

  function _drawStars(color){
    x.save();
    x.fillStyle=color;
    const positions=[[40,40],[1020,140],[40,1200],[1010,1295],[200,1230],[860,1235],[35,700],[1030,700]];
    positions.forEach(function(p){ _drawStar(p[0],p[1],11); });
    x.restore();
  }

  function _drawCloud(cx,cy,scale){
    const r=20*scale;
    x.beginPath();
    x.arc(cx-r*1.4,cy,r,0,Math.PI*2);
    x.arc(cx,cy-r*0.6,r*1.3,0,Math.PI*2);
    x.arc(cx+r*1.4,cy,r,0,Math.PI*2);
    x.arc(cx,cy+r*0.3,r*1.1,0,Math.PI*2);
    x.fill();
  }

  function _drawClouds(color){
    x.save();
    x.globalAlpha=0.85;
    x.fillStyle=color;
    _drawCloud(160,80,1.0);
    _drawCloud(950,80,1.2);
    _drawCloud(40,1250,0.9);
    _drawCloud(1020,1240,1.0);
    x.restore();
  }

  function _drawBird(cx,cy,scale){
    x.beginPath();
    const w=18*scale;
    x.moveTo(cx-w,cy);
    x.quadraticCurveTo(cx-w/2,cy-w*0.6,cx,cy);
    x.quadraticCurveTo(cx+w/2,cy-w*0.6,cx+w,cy);
    x.lineWidth=3*scale;
    x.stroke();
  }

  function _drawBirds(color){
    x.save();
    x.strokeStyle=color;
    x.fillStyle=color;
    [[140,90,1.0],[300,55,1.2],[920,70,1.0],[1010,110,1.3],[60,1240,1.0],[1010,1255,1.1]].forEach(function(p){
      _drawBird(p[0],p[1],p[2]);
    });
    x.restore();
  }

  function _drawTree(cx,cy,scale){
    const w=28*scale, h=44*scale;
    x.beginPath();
    x.moveTo(cx,cy-h);
    x.lineTo(cx-w,cy);
    x.lineTo(cx+w,cy);
    x.closePath();
    x.fill();
    x.fillRect(cx-4*scale,cy,8*scale,12*scale);
  }

  function _drawTrees(color){
    x.save();
    x.fillStyle=color;
    [[35,1320,1.0],[120,1320,0.9],[960,1320,1.1],[1045,1320,0.9],[35,80,0.8],[1045,80,0.8]].forEach(function(p){
      _drawTree(p[0],p[1],p[2]);
    });
    x.restore();
  }

  function _drawFlower(cx,cy,scale){
    const r=10*scale;
    const offsets=[[0,-r*1.4],[r*1.3,-r*0.4],[r*0.8,r*1.2],[-r*0.8,r*1.2],[-r*1.3,-r*0.4]];
    offsets.forEach(function(o){
      x.beginPath(); x.arc(cx+o[0],cy+o[1],r,0,Math.PI*2); x.fill();
    });
    x.beginPath(); x.fillStyle='#FFD27A'; x.arc(cx,cy,r*0.55,0,Math.PI*2); x.fill();
  }

  function _drawFlowers(color){
    x.save();
    x.fillStyle=color;
    [[55,1255,1.0],[1020,1260,1.1],[45,90,0.9],[1025,95,1.0],[140,1310,0.8]].forEach(function(p){
      _drawFlower(p[0],p[1],p[2]);
    });
    x.restore();
  }

  const api={init,render};
  try{ window.SlideRenderer=api; }catch(e){}
  return api;
})();
