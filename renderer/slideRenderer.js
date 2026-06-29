const SlideRenderer=(()=>{
  let c,x;
  const W=1080,H=1350;
  const PANEL_X=70, PANEL_Y=185, PANEL_W=940, PANEL_H=930;
  // Cached after each render() so canvas hit-testing can match clicks to
  // the actual rendered bboxes — including override-driven size shifts.
  let _lastTextElements=[];
  // Sprint 6.1 — scene element bboxes from the most recent render(), used
  // by the canvas drag handler to hit-test scene elements.
  let _lastSceneElements=[];

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

  function init(cv){
    c=cv; c.width=W; c.height=H;
    x=c.getContext('2d');
    // Sprint 6.3 — Chromium defaults imageSmoothingQuality to 'low' which
    // smudges fine pencil strokes when the renderer downscales scans
    // into the image-holder. Set to 'high' so the single resampling step
    // uses better-than-bilinear interpolation.
    try{ x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; }catch(e){}
  }

  // Sprint 6.5 — Picture Border. Resolved from
  // slide.metadata.cardOverrides.border (passed in via payload.overrides.border).
  // Returns null when no override is present so the legacy rendering path
  // stays byte-identical for projects that haven't touched the border.
  function _resolveBorder(s){
    const ov=(s && s.overrides) || null;
    const b=ov && ov.border;
    if(!b) return null;
    const line=b.line||{};
    const shadow=b.shadow||{};
    return {
      padding:(typeof b.padding==='number')?b.padding:20,
      fill:b.fill||'page',
      cornerRadius:(typeof b.cornerRadius==='number')?b.cornerRadius:0,
      lineEnabled:!!line.enabled,
      lineWidth:(typeof line.width==='number')?line.width:2,
      lineColor:line.color||'#000000',
      shadowEnabled:!!shadow.enabled,
      shadowIntensity:(typeof shadow.intensity==='number')?shadow.intensity:0.4
    };
  }

  function _resolveBorderFillColor(border,theme){
    switch(border.fill){
      case 'none': return null;
      case 'white': return '#FFFFFF';
      case 'black': return '#000000';
      case 'page': return (theme && theme.panel) ? theme.panel.color : '#FFFFFF';
      default:
        if(typeof border.fill==='string' && border.fill.charAt(0)==='#') return border.fill;
        return (theme && theme.panel) ? theme.panel.color : '#FFFFFF';
    }
  }

  function _picturePath(rx,ry,rw,rh,radius){
    const r=Math.max(0,Math.min(radius||0,rw/2,rh/2));
    if(r===0){
      x.beginPath();
      x.rect(rx,ry,rw,rh);
      return;
    }
    x.beginPath();
    x.moveTo(rx+r,ry);
    x.arcTo(rx+rw,ry,rx+rw,ry+rh,r);
    x.arcTo(rx+rw,ry+rh,rx,ry+rh,r);
    x.arcTo(rx,ry+rh,rx,ry,r);
    x.arcTo(rx,ry,rx+rw,ry,r);
    x.closePath();
  }

  // Picture-frame fill (with optional drop shadow). Drawn under the image.
  function _drawPictureFrameFill(rect,border,theme){
    const fillColor=_resolveBorderFillColor(border,theme);
    if(!fillColor && !border.shadowEnabled) return;
    x.save();
    if(border.shadowEnabled){
      x.shadowBlur=16+border.shadowIntensity*36;
      x.shadowOffsetY=6+border.shadowIntensity*10;
      x.shadowColor='rgba(0,0,0,'+(0.20+border.shadowIntensity*0.5).toFixed(3)+')';
    }
    if(fillColor){
      _picturePath(rect.x,rect.y,rect.w,rect.h,border.cornerRadius);
      x.fillStyle=fillColor;
      x.fill();
    }
    x.restore();
  }

  // Picture-frame stroke. Drawn over the image so it always reads as a
  // crisp border, even when fill is "None".
  function _drawPictureFrameStroke(rect,border){
    if(!border.lineEnabled || !border.lineWidth) return;
    x.save();
    _picturePath(rect.x,rect.y,rect.w,rect.h,border.cornerRadius);
    x.lineWidth=border.lineWidth;
    x.strokeStyle=border.lineColor;
    x.stroke();
    x.restore();
  }

  function render(s){
    if(!x) return;
    const t=_theme(s);
    const opts=_options(s);
    const overrides=(s && s.overrides && s.overrides.textElements) || {};
    _lastTextElements=[];

    // Frame
    x.fillStyle=_frameColor(t,opts);
    x.fillRect(0,0,W,H);

    // Sprint 6.5 — when the user has customised the Picture Border, draw
    // a styled frame in place of the legacy panel. Otherwise fall through
    // to the existing panel style so untouched projects stay pixel-identical.
    const _border=_resolveBorder(s);
    const _panelRect={x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H};
    if(_border){
      _drawPictureFrameFill(_panelRect,_border,t);
    }else{
      _drawPanel(t.panel.color,opts.panelStyle);
    }

    // Sprint 6.2 — when a scene is active, the scene blueprint owns the
    // page composition. Skip the legacy Story-style pipeline so text /
    // image / decorations don't double-render. Story-role pages stay
    // byte-identical because SceneEngine.getRenderData returns null for
    // them.
    const _hasScene=(typeof SceneEngine!=='undefined') && (SceneEngine.getRenderData(s)!==null);
    if(!_hasScene){
      // Top story text
      const storyBbox=_drawStoryText(s,t,overrides);
      if(storyBbox) _lastTextElements.push(storyBbox);

      // Handle / branding watermark — Sprint 5.0 reads handle text from payload.
      const handleBbox=_drawHandle(t,opts,overrides,s.handle);
      if(handleBbox) _lastTextElements.push(handleBbox);

      // Image inside panel — presentation-only transforms; original image untouched.
      // s.imageView (optional): { scale, offsetX, offsetY, fit:'fit'|'fill' }
      if(s.image && s.image.width){
        _drawImage(s,_border);
      }
      // Sprint 6.5 — Picture Border stroke sits above the image so it
      // always reads as a crisp frame edge.
      if(_border){
        _drawPictureFrameStroke(_panelRect,_border);
      }

      // Decorations on the frame
      _drawDecorations(opts.decorations,t,opts);

      // Footer (book title)
      const footerBbox=_drawFooter(t,opts,s.bookTitle||'',overrides);
      if(footerBbox) _lastTextElements.push(footerBbox);

      // Page number
      const pageBbox=_drawPageNumber(t,opts,s.page||1,s.totalPages||1,overrides);
      if(pageBbox) _lastTextElements.push(pageBbox);
    }

    // Sprint 6.1 — Scene Layer. Story role pages return null from
    // SceneEngine, so this pass is a no-op for them.
    _lastSceneElements=[];
    if(typeof SceneEngine!=='undefined'){
      const data=SceneEngine.getRenderData(s);
      if(data && data.elements && data.elements.length){
        const sorted=data.elements.slice().sort(function(a,b){ return (a.zIndex||0)-(b.zIndex||0); });
        sorted.forEach(function(el){
          if(el.visible===false) return;
          if(el.type==='background') _drawSceneBackground(el);
          else if(el.type==='decoration') _drawSceneDecoration(el);
          else if(el.type==='image-holder') _drawSceneImageHolder(s,el);
          else if(el.type==='text-holder') _drawSceneTextHolder(s,el);
          // Legacy fallback for projects authored against Sprint 6.1.
          else if(el.type==='text') _drawSceneText(s,el);
          _lastSceneElements.push(_sceneBbox(el));
        });
      }
    }

    // Drag guides (Sprint 4.4) — drawn under the selection outline so the
    // outline stays on top of the canvas center crosshair.
    if(s && s.dragActiveId){
      const dragSel=_lastTextElements.find(function(e){ return e.id===s.dragActiveId; });
      if(dragSel) _drawDragGuides(dragSel);
    }

    // Sprint 6.1 selection outline for scene elements + Sprint 6.5
    // (Object Designer) resize handles for elements that support resize
    // (Frame / decoration).
    if(s && s.selectedSceneElement){
      const sel=_lastSceneElements.find(function(e){ return e.id===s.selectedSceneElement; });
      if(sel){
        _drawSelectionOutline(sel);
        if(_supportsResize(sel)) _drawResizeHandles(sel);
      }
    }

    // Selection outline — last, so it sits above everything.
    if(s && s.selectedTextElement){
      const sel=_lastTextElements.find(function(e){ return e.id===s.selectedTextElement; });
      if(sel) _drawSelectionOutline(sel);
    }
  }

  // Sprint 6.1 — scene element drawing helpers.
  function _drawSceneBackground(el){
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    x.fillStyle=el.color||'#000000';
    x.fillRect(0,0,W,H);
    x.restore();
  }
  function _drawSceneDecoration(el){
    const pos=el.position||{x:W/2,y:H/2};
    const size=el.size||{w:64,h:64};
    if(!el.glyph) return;
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    if(el.rotation){
      x.translate(pos.x,pos.y);
      x.rotate(el.rotation*Math.PI/180);
      x.translate(-pos.x,-pos.y);
    }
    x.font=Math.round(size.h||64)+'px "Apple Color Emoji","Segoe UI Emoji",Arial,sans-serif';
    x.textAlign='center';
    x.textBaseline='middle';
    x.fillText(el.glyph,pos.x,pos.y);
    x.restore();
  }
  function _drawSceneText(s,el){
    const text=SceneEngine.resolveTextSource(s,el.source) || el.placeholder || '';
    if(!text) return;
    const pos=el.position||{x:W/2,y:H/2};
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    const stylePart=el.fontStyle && el.fontStyle!=='normal' ? el.fontStyle+' ' : '';
    const weightPart=el.fontWeight && el.fontWeight!=='normal' ? el.fontWeight+' ' : '';
    x.font=stylePart+weightPart+(el.fontSize||56)+'px '+(el.fontFamily||'Georgia, serif');
    x.fillStyle=el.color||'#FFFFFF';
    x.textAlign=el.alignment||'center';
    x.textBaseline='alphabetic';
    x.fillText(text,pos.x,pos.y);
    x.restore();
  }

  // Sprint 6.2 — Text Holder. Same render contract as text, but draws a
  // soft placeholder when the page hasn't filled the slot yet so the
  // user always sees where the content will appear.
  function _drawSceneTextHolder(s,el){
    let text=SceneEngine.resolveTextSource(s,el.source);
    const isPlaceholder=!text;
    if(isPlaceholder) text=el.placeholder||'';
    if(!text) return;
    const pos=el.position||{x:W/2,y:H/2};
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    if(isPlaceholder) x.globalAlpha=(x.globalAlpha||1)*0.5;
    const stylePart=el.fontStyle && el.fontStyle!=='normal' ? el.fontStyle+' ' : '';
    const weightPart=el.fontWeight && el.fontWeight!=='normal' ? el.fontWeight+' ' : '';
    x.font=stylePart+weightPart+(el.fontSize||56)+'px '+(el.fontFamily||'Georgia, serif');
    x.fillStyle=el.color||'#FFFFFF';
    x.textAlign=el.alignment||'center';
    x.textBaseline='alphabetic';
    x.fillText(text,pos.x,pos.y);
    x.restore();
  }

  // Sprint 6.2 — Image Holder. Sprint 6.3.1: routed through ImageViewEngine
  // so Cover / Hook / End use the SAME view model (mode / zoom / panX / panY)
  // as Story. When the page has no image, paints a dashed placeholder so
  // the user sees the slot. The blueprint's `fit` ('cover' / 'contain')
  // seeds the default view mode but the user's `s.imageView.mode` wins.
  function _drawSceneImageHolder(s,el){
    const pos=el.position||{x:W/2,y:H/2};
    const size=el.size||{w:600,h:600};
    const rx=pos.x-size.w/2, ry=pos.y-size.h/2;
    const img=s.image;
    x.save();
    if(typeof el.opacity==='number') x.globalAlpha=el.opacity;
    if(!img || !img.width){
      x.fillStyle='rgba(255,255,255,0.06)';
      x.fillRect(rx,ry,size.w,size.h);
      x.strokeStyle='rgba(255,255,255,0.40)';
      x.lineWidth=3;
      x.setLineDash([12,8]);
      x.strokeRect(rx,ry,size.w,size.h);
      x.setLineDash([]);
      x.fillStyle='rgba(255,255,255,0.70)';
      x.font='bold 28px sans-serif';
      x.textAlign='center';
      x.textBaseline='middle';
      x.fillText('Add an image',pos.x,pos.y);
      x.restore();
      return;
    }
    // Sprint 6.5 — Picture Border applies to scene image holders too, so
    // the same UI controls Story / Cover / Hook / End.
    const border=_resolveBorder(s);
    const outerRect={x:rx,y:ry,w:size.w,h:size.h};
    const pad=border ? border.padding : 0;
    const innerRect={
      x:rx+pad, y:ry+pad,
      w:Math.max(1,size.w-pad*2), h:Math.max(1,size.h-pad*2)
    };
    if(border){
      _drawPictureFrameFill(outerRect,border,_theme(s));
    }
    // Resolve the view: user's s.imageView wins; blueprint `fit` seeds
    // the default mode ('cover' → 'fill', 'contain' → 'fit').
    const seedMode=el.fit==='contain' ? 'fit' : 'fill';
    const raw=s.imageView ? Object.assign({mode:seedMode},s.imageView) : {mode:seedMode};
    if(typeof ImageViewEngine!=='undefined'){
      if(border){
        // Apply a concentric round-rect clip so the image follows the
        // frame's curves, then hand off to the View Engine for the actual
        // image draw.
        const innerRadius=Math.max(0,(border.cornerRadius||0)-pad);
        x.save();
        if(innerRadius>0){
          _picturePath(innerRect.x,innerRect.y,innerRect.w,innerRect.h,innerRadius);
        }else{
          x.beginPath();
          x.rect(innerRect.x,innerRect.y,innerRect.w,innerRect.h);
        }
        x.clip();
        ImageViewEngine.drawInto(x,img,innerRect,raw);
        x.restore();
      }else{
        ImageViewEngine.drawInto(x,img,outerRect,raw);
      }
    }else{
      // Defensive fallback — should never run because the script is loaded first.
      const iw=img.width, ih=img.height;
      const targetRect=border?innerRect:outerRect;
      const base=seedMode==='fit' ? Math.min(targetRect.w/iw,targetRect.h/ih) : Math.max(targetRect.w/iw,targetRect.h/ih);
      const dw=iw*base, dh=ih*base;
      const dx=targetRect.x+targetRect.w/2-dw/2, dy=targetRect.y+targetRect.h/2-dh/2;
      x.beginPath(); x.rect(targetRect.x,targetRect.y,targetRect.w,targetRect.h); x.clip();
      x.drawImage(img,dx,dy,dw,dh);
    }
    if(border){
      _drawPictureFrameStroke(outerRect,border);
    }
    x.restore();
  }
  function _sceneBbox(el){
    const pos=el.position||{x:W/2,y:H/2};
    if(el.type==='background'){
      return {id:el.id,type:el.type,label:el.label||el.id,bx:0,by:0,bw:W,bh:H,visible:el.visible!==false};
    }
    if(el.type==='decoration'){
      const size=el.size||{w:64,h:64};
      return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x-size.w/2,by:pos.y-size.h/2,bw:size.w,bh:size.h,visible:el.visible!==false};
    }
    if(el.type==='text' || el.type==='text-holder'){
      const w=(el.size && el.size.w) || 700;
      const h=(el.fontSize||56)+12;
      let bx=pos.x-w/2;
      if(el.alignment==='left') bx=pos.x;
      else if(el.alignment==='right') bx=pos.x-w;
      return {id:el.id,type:el.type,label:el.label||el.id,bx:bx,by:pos.y-(el.fontSize||56),bw:w,bh:h,visible:el.visible!==false};
    }
    if(el.type==='image-holder'){
      const size=el.size||{w:600,h:600};
      return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x-size.w/2,by:pos.y-size.h/2,bw:size.w,bh:size.h,visible:el.visible!==false};
    }
    return {id:el.id,type:el.type,label:el.label||el.id,bx:pos.x,by:pos.y,bw:0,bh:0,visible:el.visible!==false};
  }

  // Sprint 6.1 — exposed for canvas drag hit-testing.
  function getSceneElements(){ return _lastSceneElements.slice(); }

  // Returns the most recent text-element bboxes (canvas-pixel coords) so the
  // host can hit-test mouse clicks against them. Each entry:
  //   {id, label, bx, by, bw, bh}
  function getTextElements(){ return _lastTextElements.slice(); }

  function _drawSelectionOutline(e){
    x.save();
    x.strokeStyle='#FFCB45';
    x.lineWidth=4;
    x.setLineDash([12,6]);
    x.strokeRect(e.bx-8, e.by-6, e.bw+16, e.bh+12);
    x.restore();
  }

  // Sprint 6.5 (Object Designer) — resize handles. Eight handles total
  // (four corners + four side midpoints) on the selected scene element's
  // bbox. App.js hit-tests against the same positions to drive resize
  // drag.
  const HANDLE_RADIUS=12;
  function _supportsResize(el){
    if(!el || !el.type) return false;
    // Resize is meaningful for the image-holder and for decorations;
    // text-holder / background stay un-resizable so the child can't
    // accidentally distort body text or break the page background.
    return el.type==='image-holder' || el.type==='decoration';
  }
  function _drawResizeHandles(el){
    const cx1=el.bx, cy1=el.by;
    const cx2=el.bx+el.bw, cy2=el.by+el.bh;
    const mx=el.bx+el.bw/2, my=el.by+el.bh/2;
    const positions=[
      [cx1,cy1],[cx2,cy1],[cx1,cy2],[cx2,cy2],
      [mx,cy1],[mx,cy2],[cx1,my],[cx2,my]
    ];
    x.save();
    x.fillStyle='#FFCB45';
    x.strokeStyle='#1D3457';
    x.lineWidth=2;
    positions.forEach(function(p){
      x.beginPath();
      x.arc(p[0],p[1],HANDLE_RADIUS,0,Math.PI*2);
      x.fill();
      x.stroke();
    });
    x.restore();
  }
  // Exposed for canvas hit-testing — returns the 8 handle positions for
  // the currently-selected scene element, or [] when nothing is selected.
  function getResizeHandlesFor(elementId){
    const el=_lastSceneElements.find(function(e){ return e.id===elementId; });
    if(!el || !_supportsResize(el)) return [];
    const cx1=el.bx, cy1=el.by;
    const cx2=el.bx+el.bw, cy2=el.by+el.bh;
    const mx=el.bx+el.bw/2, my=el.by+el.bh/2;
    return [
      {pos:'nw', x:cx1, y:cy1},
      {pos:'ne', x:cx2, y:cy1},
      {pos:'sw', x:cx1, y:cy2},
      {pos:'se', x:cx2, y:cy2},
      {pos:'n',  x:mx,  y:cy1},
      {pos:'s',  x:mx,  y:cy2},
      {pos:'w',  x:cx1, y:my},
      {pos:'e',  x:cx2, y:my}
    ];
  }
  function getHandleRadius(){ return HANDLE_RADIUS; }

  const SNAP_DIST=18;
  function _drawDragGuides(el){
    const cx=el.bx+el.bw/2;
    const cy=el.by+el.bh/2;
    x.save();
    x.strokeStyle='#7B9AC8';
    x.lineWidth=1.5;
    x.setLineDash([8,6]);
    x.globalAlpha=Math.abs(cx-W/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(W/2,0); x.lineTo(W/2,H); x.stroke();
    x.globalAlpha=Math.abs(cy-H/2)<SNAP_DIST?1:0.35;
    x.beginPath(); x.moveTo(0,H/2); x.lineTo(W,H/2); x.stroke();
    x.restore();
  }

  function _bboxForAnchored(text,anchorX,baselineY,align,size){
    const w=x.measureText(text).width;
    let bx=anchorX;
    if(align==='center') bx=anchorX-w/2;
    else if(align==='right') bx=anchorX-w;
    return { bx:bx, by:baselineY-size, bw:w, bh:size+8 };
  }

  // Resolve effective text style: Card Override → Theme → System Default.
  // Returns the final values used by both drawing and bbox math.
  function _resolveTextStyle(ov,defSize,defFont,defColor,defAlign){
    const pos=ov.position||{};
    return {
      fontSize:(typeof ov.fontSize==='number'&&ov.fontSize>0)?ov.fontSize:defSize,
      fontFamily:ov.fontFamily||defFont,
      fontWeight:ov.fontWeight||'normal',
      fontStyle:ov.fontStyle||'normal',
      color:ov.color||defColor,
      opacity:(typeof ov.opacity==='number'&&isFinite(ov.opacity))?Math.max(0,Math.min(1,ov.opacity)):1,
      letterSpacing:(typeof ov.letterSpacing==='number'&&isFinite(ov.letterSpacing))?ov.letterSpacing:0,
      lineHeight:(typeof ov.lineHeight==='number'&&isFinite(ov.lineHeight)&&ov.lineHeight>0)?ov.lineHeight:1.2,
      alignment:ov.alignment||defAlign,
      offsetX:(typeof pos.offsetX==='number'&&isFinite(pos.offsetX))?pos.offsetX:0,
      offsetY:(typeof pos.offsetY==='number'&&isFinite(pos.offsetY))?pos.offsetY:0
    };
  }

  function _applyTextStyle(st){
    x.fillStyle=st.color;
    const stylePart=st.fontStyle&&st.fontStyle!=='normal'?st.fontStyle+' ':'';
    const weightPart=st.fontWeight&&st.fontWeight!=='normal'?st.fontWeight+' ':'';
    x.font=stylePart+weightPart+st.fontSize+'px '+st.fontFamily;
    try{ x.letterSpacing=st.letterSpacing+'px'; }catch(e){}
    x.textAlign=st.alignment;
    x.globalAlpha=st.opacity;
  }

  // Sprint 5.1 — exposed to Story Designer as the source of truth for
  // overflow detection. Width budget = canvas minus left/right margins
  // (60 each side). Multi-line input also flags overflow because the
  // current renderer draws only the first line.
  const STORY_MAX_WIDTH=W-120;

  function _drawStoryText(s,theme,overrides){
    if(!s.storyBeat) return null;
    const ov=overrides['story-text']||{};
    const st=_resolveTextStyle(ov,theme.storyText.size,theme.storyText.font,theme.storyText.color,'left');
    x.save();
    _applyTextStyle(st);
    let drawX=60;
    if(st.alignment==='center') drawX=W/2;
    else if(st.alignment==='right') drawX=W-60;
    drawX+=st.offsetX;
    const drawY=100+st.offsetY;
    x.fillText(s.storyBeat,drawX,drawY);
    const w=x.measureText(s.storyBeat).width;
    x.restore();
    let bx=drawX;
    if(st.alignment==='center') bx=drawX-w/2;
    else if(st.alignment==='right') bx=drawX-w;
    const overflow=(w>STORY_MAX_WIDTH) || (s.storyBeat.indexOf('\n')!==-1);
    return {id:'story-text',label:'Story Text',bx:bx,by:drawY-st.fontSize,bw:w,bh:st.fontSize+8,overflow:overflow,maxWidth:STORY_MAX_WIDTH};
  }

  // Inner image area inside the panel. Sprint 6.5 — padding is normally
  // 20px (the legacy default) but the Picture Border slider can override
  // it; the renderer adapts so the image always fits inside the styled frame.
  const DEFAULT_IMG_PAD=20;

  function _drawImage(s,border){
    const pad=border ? border.padding : DEFAULT_IMG_PAD;
    const IMG_X=PANEL_X+pad, IMG_Y=PANEL_Y+pad;
    const IMG_W=Math.max(1,PANEL_W-pad*2), IMG_H=Math.max(1,PANEL_H-pad*2);
    const v=s.imageView||{};
    // Sprint 4.5 — crop / straighten / focal point / image adjustments.
    const focalX=typeof v.focalX==='number' && isFinite(v.focalX) ? Math.max(0,Math.min(1,v.focalX)) : 0.5;
    const focalY=typeof v.focalY==='number' && isFinite(v.focalY) ? Math.max(0,Math.min(1,v.focalY)) : 0.5;
    const crop=v.crop||{};
    const cTop=crop.top||0, cRight=crop.right||0, cBottom=crop.bottom||0, cLeft=crop.left||0;
    const straighten=typeof v.straighten==='number' && isFinite(v.straighten) ? v.straighten : 0;
    // Light / Color / Detail
    const brightness=typeof v.brightness==='number'?v.brightness:0;
    const contrast=typeof v.contrast==='number'?v.contrast:0;
    const highlights=typeof v.highlights==='number'?v.highlights:0;
    const shadows=typeof v.shadows==='number'?v.shadows:0;
    const warmth=typeof v.warmth==='number'?v.warmth:0;
    const saturation=typeof v.saturation==='number'?v.saturation:0;
    const sharpness=typeof v.sharpness==='number'?v.sharpness:0;
    const vignette=typeof v.vignette==='number'?v.vignette:0;

    const iw=s.image.width, ih=s.image.height;
    // Cropped source rect (in original image coords) — never modifies the
    // Image; just narrows the slice that gets drawn.
    const srcX=cLeft*iw, srcY=cTop*ih;
    const srcW=Math.max(1, iw - srcX - cRight*iw);
    const srcH=Math.max(1, ih - srcY - cBottom*ih);

    // Sprint 6.3.1 — geometry routed through ImageViewEngine so the Story
    // path uses the SAME uniform-scale guarantee as Cover / Hook / End.
    // The View Engine returns dw / dh via a single scale factor applied
    // to both axes, so the original aspect ratio is preserved by
    // construction. Backward-compatible: View Engine normalize() accepts
    // both new (mode/zoom/panX/panY) and legacy (fit/scale/offsetX/offsetY)
    // keys, so existing projects keep working.
    let dw, dh, panX, panY;
    if(typeof ImageViewEngine!=='undefined'){
      const c=ImageViewEngine.compute(srcW,srcH,IMG_W,IMG_H,v);
      dw=c.dw; dh=c.dh; panX=c.panX; panY=c.panY;
    }else{
      const fit=v.fit==='fill'?'fill':'fit';
      const userScale=typeof v.scale==='number' && isFinite(v.scale) && v.scale>0 ? v.scale : 1;
      const base=fit==='fill' ? Math.max(IMG_W/srcW, IMG_H/srcH) : Math.min(IMG_W/srcW, IMG_H/srcH);
      const sc=base*userScale;
      dw=srcW*sc; dh=srcH*sc;
      panX=typeof v.offsetX==='number' && isFinite(v.offsetX) ? v.offsetX : 0;
      panY=typeof v.offsetY==='number' && isFinite(v.offsetY) ? v.offsetY : 0;
    }
    // Place the focal point of the cropped src at the panel center, plus
    // any user pan offset.
    const dx=IMG_X+IMG_W/2 - focalX*dw + panX;
    const dy=IMG_Y+IMG_H/2 - focalY*dh + panY;

    // Build canvas filter string (Light + Color + Detail). Highlights /
    // Shadows / Sharpness are approximated as light brightness/contrast
    // perturbations — subtle, non-destructive, matches "beautify originals".
    const filterParts=[];
    const bF = 1 + brightness*0.5 + highlights*0.18 + shadows*-0.18;
    if(Math.abs(bF-1)>0.001) filterParts.push('brightness('+bF.toFixed(4)+')');
    const cF = 1 + contrast*0.5 + sharpness*0.25;
    if(Math.abs(cF-1)>0.001) filterParts.push('contrast('+cF.toFixed(4)+')');
    const satF = 1 + saturation;
    if(Math.abs(satF-1)>0.001) filterParts.push('saturate('+satF.toFixed(4)+')');
    if(Math.abs(warmth)>0.001) filterParts.push('hue-rotate('+(warmth*-15).toFixed(2)+'deg)');

    x.save();
    // Sprint 6.5 — when a picture-border radius is set, the inner image
    // gets a concentric round-rect clip so the image's corners follow
    // the frame's corners. Inner radius = max(0, R - padding).
    const innerRadius=border ? Math.max(0,(border.cornerRadius||0)-pad) : 0;
    if(innerRadius>0){
      _picturePath(IMG_X,IMG_Y,IMG_W,IMG_H,innerRadius);
    }else{
      x.beginPath();
      x.rect(IMG_X,IMG_Y,IMG_W,IMG_H);
    }
    x.clip();
    // Straighten: rotate around the panel center so the user sees a level horizon.
    if(Math.abs(straighten)>0.001){
      const cx0=IMG_X+IMG_W/2, cy0=IMG_Y+IMG_H/2;
      x.translate(cx0,cy0);
      x.rotate(straighten*Math.PI/180);
      x.translate(-cx0,-cy0);
    }
    if(filterParts.length>0) x.filter=filterParts.join(' ');
    x.drawImage(s.image, srcX, srcY, srcW, srcH, dx, dy, dw, dh);
    if(filterParts.length>0) x.filter='none';
    // Sprint 6.3.1 — runtime tripwire. The source we just drew is the
    // cropped slice (srcW × srcH); the rendered slice is (dw × dh). If
    // these ratios ever drift the engine has been bypassed somewhere
    // upstream — surface it loudly without breaking production.
    if(typeof ImageViewEngine!=='undefined'){
      ImageViewEngine.verifyAspectRatio(srcW,srcH,dw,dh);
    }
    // Vignette: a radial dim drawn on top of the panel area only.
    if(vignette>0.001){
      const grad=x.createRadialGradient(
        IMG_X+IMG_W/2, IMG_Y+IMG_H/2, Math.min(IMG_W,IMG_H)*0.30,
        IMG_X+IMG_W/2, IMG_Y+IMG_H/2, Math.max(IMG_W,IMG_H)*0.72
      );
      grad.addColorStop(0,'rgba(0,0,0,0)');
      grad.addColorStop(1,'rgba(0,0,0,'+(Math.min(1,vignette)*0.7).toFixed(4)+')');
      x.fillStyle=grad;
      x.fillRect(IMG_X,IMG_Y,IMG_W,IMG_H);
    }
    x.restore();
  }

  // Public: panel rect in canvas coordinates — consumed by canvas pan handler.
  function getPanelRect(){ return {x:PANEL_X,y:PANEL_Y,w:PANEL_W,h:PANEL_H}; }

  function _drawHandle(theme,opts,overrides,handleText){
    if(opts.handleVisibility==='hide') return null;
    const text=(typeof handleText==='string' && handleText.length>0) ? handleText : '@vihuplanet';
    const ov=(overrides && overrides['handle'])||{};
    const pos=opts.handlePosition||'top-right';
    let hx, hy, defaultAlign;
    if(pos==='top-left'){ hx=60; hy=60; defaultAlign='left'; }
    else if(pos==='bottom-left'){ hx=60; hy=H-30; defaultAlign='left'; }
    else if(pos==='bottom-right'){ hx=W-60; hy=H-30; defaultAlign='right'; }
    else { hx=W-60; hy=60; defaultAlign='right'; }
    const st=_resolveTextStyle(ov,theme.watermark.size,theme.watermark.font,theme.watermark.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    hx+=st.offsetX;
    hy+=st.offsetY;
    x.fillText(text,hx,hy);
    const w=x.measureText(text).width;
    x.restore();
    let bx=hx;
    if(st.alignment==='center') bx=hx-w/2;
    else if(st.alignment==='right') bx=hx-w;
    return {id:'handle',label:'Handle',bx:bx,by:hy-st.fontSize,bw:w,bh:st.fontSize+8};
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
  function _drawFooter(theme,opts,bookTitle,overrides){
    if(opts.bookTitleVisibility==='hide') return null;
    if(opts.footerStyle==='hidden' || !bookTitle) return null;
    const ov=(overrides && overrides['footer'])||{};
    let defaultSize=theme.footerText.size;
    if(opts.footerStyle==='modern') defaultSize=Math.round(defaultSize*1.1);
    else if(opts.footerStyle==='minimal') defaultSize=Math.round(defaultSize*0.75);
    const pos=opts.bookTitlePosition||'bottom-left';
    let anchorX, defaultAlign;
    if(pos==='bottom-center'){ anchorX=W/2; defaultAlign='center'; }
    else if(pos==='bottom-right'){ anchorX=W-60; defaultAlign='right'; }
    else { anchorX=320; defaultAlign='left'; }
    const st=_resolveTextStyle(ov,defaultSize,theme.footerText.font,theme.footerText.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    anchorX+=st.offsetX;
    const anchorY=1285+st.offsetY;
    x.fillText(bookTitle,anchorX,anchorY);
    const w=x.measureText(bookTitle).width;
    x.restore();
    let bx=anchorX;
    if(st.alignment==='center') bx=anchorX-w/2;
    else if(st.alignment==='right') bx=anchorX-w;
    return {id:'footer',label:'Footer',bx:bx,by:anchorY-st.fontSize,bw:w,bh:st.fontSize+8};
  }

  // --- Page number ---
  function _drawPageNumber(theme,opts,page,total,overrides){
    if(opts.pageNumber==='hidden') return null;
    const ov=(overrides && overrides['page-number'])||{};
    const label=page+' / '+total;
    let anchorX, anchorY, defaultAlign;
    if(opts.pageNumber==='bottom-center'){
      anchorX=W/2; anchorY=opts.footerStyle==='hidden'?1285:1325; defaultAlign='center';
    }else{
      anchorX=900; anchorY=1285; defaultAlign='left';
    }
    const st=_resolveTextStyle(ov,theme.footerText.size,theme.footerText.font,theme.footerText.color,defaultAlign);
    x.save();
    _applyTextStyle(st);
    anchorX+=st.offsetX;
    anchorY+=st.offsetY;
    x.fillText(label,anchorX,anchorY);
    const w=x.measureText(label).width;
    x.restore();
    let bx=anchorX;
    if(st.alignment==='center') bx=anchorX-w/2;
    else if(st.alignment==='right') bx=anchorX-w;
    return {id:'page-number',label:'Page Number',bx:bx,by:anchorY-st.fontSize,bw:w,bh:st.fontSize+8};
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

  // Sprint 6.4 — WYSIWYE. Single source of truth for resolving a slide
  // into a render payload. Preview (app.js), Thumbnail (thumbnails.js),
  // and Export (pageOps.js) all funnel through this helper so the
  // exported PNG is pixel-identical to what's on the canvas. Adding new
  // resolution layers in the future means changing one place.
  //
  // opts: { page, totalPages, defaultBookTitle, defaultHandle } — all
  // optional. The defaults are the editor-chrome fallbacks (the hidden
  // #bookTitle input value); slide.metadata always wins when set.
  function buildPayload(slide, opts){
    opts = opts || {};
    const theme = (typeof ThemeEngine !== 'undefined') ? ThemeEngine.getActiveTheme() : null;
    const themeOptions = (typeof ThemeEngine !== 'undefined') ? ThemeEngine.getOptions() : null;
    const m = slide.metadata || {};
    const cardOverrides = m.cardOverrides || null;
    // Sprint 4.5: image view lives under cardOverrides.image; fall back
    // to the legacy slide.metadata.imageView path so old projects render.
    const imageView = (cardOverrides && cardOverrides.image)
      || m.imageView
      || null;
    // Sprint 5.0: per-slide footer / handle overrides resolved here.
    const bookTitle = (typeof m.footerText === 'string')
      ? m.footerText
      : (opts.defaultBookTitle || '');
    const handle = (typeof m.handle === 'string' && m.handle.length > 0)
      ? m.handle
      : (opts.defaultHandle || '@vihuplanet');
    return {
      image: slide.image,
      storyBeat: slide.storyBeat || '',
      bookTitle: bookTitle,
      handle: handle,
      page: (opts.page != null) ? opts.page : (slide.page || 1),
      totalPages: (opts.totalPages != null) ? opts.totalPages : (slide.totalPages || 0),
      theme: theme,
      themeOptions: themeOptions,
      imageView: imageView,
      overrides: cardOverrides,
      pageType: slide.pageType,
      metadata: slide.metadata
    };
  }

  const api={init,render,buildPayload,getPanelRect,getTextElements,getSceneElements,getResizeHandlesFor,getHandleRadius};
  try{ window.SlideRenderer=api; }catch(e){}
  return api;
})();
