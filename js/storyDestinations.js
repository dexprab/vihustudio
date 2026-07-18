// storyDestinations — Sprint 9.0.3 + 9.0.4.
//
// The publishing pipeline used to be: press Publish → render every page
// as JPEG → wrap them in a PDF → hand the child the PDF. That works but
// tells the child software terms ("PDF", "export"). Sprint 9.0 replaces
// that step with a **destination picker**: children choose HOW they
// want to enjoy their story (Story Book / Story Carousel / Story Reel),
// each destination has one or more child-friendly formats, and this
// module owns the mapping from a chosen destination + format → a
// renderer that produces a Blob.
//
// ===========================================================
// The Story Destination interface (Sprint 9.0.4)
// ===========================================================
// Every destination object must expose:
//
//   id            String — stable identifier used by the state
//                          machine. Never shown to the child.
//   label         String — child-friendly name shown on the card.
//   glyph         String — one emoji shown on the card.
//   tagline       String — one-line description under the label.
//   comingSoon    Bool   — optional. `true` disables Continue for
//                          this destination.
//   formats       Array  — 1+ Format objects (see below).
//
// Each Format object must expose:
//
//   id            String — stable identifier.
//   label         String — child-friendly name.
//   description   String — one-line explanation shown under the label.
//   ...           any additional fields the renderer needs (canvas
//                 dimensions, JPEG quality, etc).
//
// The destination must implement the render pipeline hooks:
//
//   createCanvas(format) → HTMLCanvasElement
//       Create a canvas sized for the destination's native render
//       resolution. PublishStudio will hand this canvas to
//       renderPage(); the destination owns its lifecycle.
//
//   renderPage(canvas, slide, ctx)
//       Draw the slide into the canvas via
//       SlideRenderer.buildPayload → SlideRenderer.render. `ctx`
//       carries {index, total, format}.
//
//   encodePage(canvas, format, ctx) → payload
//       Turn the drawn canvas into a payload the destination's
//       finish() step can concatenate. The shape is opaque to
//       PublishStudio; the destination reads it back in finish().
//       Return null to skip a page (e.g. encode failure).
//
//   finish(payloads, format) → { blob, mime, filename,
//                                celebrateLabel, celebrateGlyph }
//       Concatenate the payloads into the final output blob and
//       tell PublishStudio how to celebrate. Return null on
//       failure — PublishStudio treats a null result as "no file
//       emitted" and lands the child on Celebration with a
//       disabled download button.
//
// Adding a future destination (EPUB, Kindle, VihuPlanet, Print
// Order, or the eventual Story Reel MP4 renderer) means either:
//
//   • Adding one entry to REGISTRY inside this file, or
//   • Calling StoryDestinations.register(destination) from a
//     plugin script loaded before PublishStudio.open().
//
// Either way PublishStudio needs no changes — the Publishing loop
// is fully driven through the interface above.
// ===========================================================
const StoryDestinations=(function(){

  // ---------- Destination helpers (shared) ----------
  function _bookTitle(){
    try{
      if(typeof AppState!=='undefined' && AppState.project){
        return AppState.project.bookTitle || AppState.project.title || 'my-story';
      }
    }catch(e){}
    return 'my-story';
  }
  function _sanitise(name){
    return String(name).replace(/[^a-z0-9_\-]+/gi,'_').replace(/^_+|_+$/g,'') || 'my-story';
  }
  // Rule 5 (Publish Fidelity) follow-up — "the visible scene needs to
  // be Creator-honoured; we can add a transparent piece around the
  // image to honour the publishing platform guidelines." A destination
  // that supports real alpha (PNG — Story Carousel) pads a non-matching
  // Scene with genuine transparency instead of a filled letterbox bar,
  // so the platform's own required file shape (Instagram Portrait/
  // Square) is still satisfied while the visible content stays exactly
  // the Scene's own true proportions with nothing added around it. A
  // destination with no alpha channel (JPEG — Story Book) still needs
  // an opaque backing (a transparent canvas pixel composites to BLACK
  // in a JPEG encode, not white) — `opts.transparent` lets each
  // destination choose which is correct for its own output format.
  function _fitCompositeInto(destCanvas, srcCanvas, opts){
    const dctx=destCanvas.getContext('2d');
    const dw=destCanvas.width, dh=destCanvas.height;
    const sw=srcCanvas.width, sh=srcCanvas.height;
    if(!(opts && opts.transparent)){
      // The Slide's own top-left corner pixel is a natural background-
      // colour proxy — reliably background (wall tone / page fill),
      // never content, since every real panel/Frame carries its own
      // margin.
      let bg='#ffffff';
      try{
        const sctx=srcCanvas.getContext('2d');
        const px=sctx.getImageData(2,2,1,1).data;
        bg='rgb('+px[0]+','+px[1]+','+px[2]+')';
      }catch(e){}
      dctx.fillStyle=bg;
      dctx.fillRect(0,0,dw,dh);
    }
    const scale=Math.min(dw/sw, dh/sh);
    const rw=sw*scale, rh=sh*scale;
    const rx=(dw-rw)/2, ry=(dh-rh)/2;
    try{ dctx.imageSmoothingEnabled=true; dctx.imageSmoothingQuality='high'; }catch(e){}
    dctx.drawImage(srcCanvas,0,0,sw,sh,rx,ry,rw,rh);
  }

  // Bakes real rounded-corner transparency into an exported bitmap's
  // own pixels, matching what the editor's canvas element already
  // shows cosmetically via CSS `border-radius:var(--card-radius)`
  // (16px) — a CSS effect that, unlike a downloaded PNG file, was
  // never going to appear in the exported bytes on its own. Radius is
  // scaled from that same 16px, but against the editor's own
  // documented ~720 CSS px on-screen display width (see #previewCanvas
  // in css/style.css) rather than applied as a flat 16px against the
  // export's much higher 1080px backing resolution, so the exported
  // image's corners read at the same visual proportion the editor
  // shows, not a barely-visible sliver.
  const EXPORT_CORNER_RADIUS_RATIO=16/720;
  function _applyRoundedCorners(canvas){
    const w=canvas.width, h=canvas.height;
    const r=Math.min(Math.round(w*EXPORT_CORNER_RADIUS_RATIO), w/2, h/2);
    if(r<=0) return;
    const ctx=canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation='destination-in';
    ctx.beginPath();
    ctx.moveTo(r,0);
    ctx.arcTo(w,0,w,h,r);
    ctx.arcTo(w,h,0,h,r);
    ctx.arcTo(0,h,0,0,r);
    ctx.arcTo(0,0,w,0,r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function _renderSlideInto(canvas, slide, idx, total, opts){
    const editorCanvas=(typeof document!=='undefined') ? document.getElementById('previewCanvas') : null;
    try{
      // Rule 5 — render the Slide at its OWN real Aspect Ratio first
      // (adaptiveViewport:true, matching the editor exactly) on a
      // throwaway intermediate canvas, then fit/composite that
      // correctly-shaped render into this destination's own fixed
      // render coordinate space (1080×1350, unchanged since Sprint
      // 9.0) — never resize `canvas` itself, since every downstream
      // encodePage/finish step still assumes that fixed space; a PDF
      // page size or "Instagram Portrait/Square" is a separate,
      // deliberate destination-format decision this doesn't override.
      // The overwhelming common case (a portrait Scene, or any Scene
      // authored before the Scene Viewport feature existed) hits the
      // fast, byte-identical path below with zero extra compositing.
      const mid=document.createElement('canvas');
      // Force dpr:1 for every destination — the output is a flat
      // bitmap (PNG / JPEG). DPR scaling would just balloon file
      // sizes without adding usable resolution beyond 1080×1350.
      SlideRenderer.init(mid,{dpr:1,adaptiveViewport:true});
      const titleEl=(typeof document!=='undefined') ? document.getElementById('bookTitle') : null;
      const payload=SlideRenderer.buildPayload(slide,{
        page: idx+1,
        totalPages: total,
        defaultBookTitle: titleEl ? titleEl.value : ''
      });
      SlideRenderer.render(payload);
      if(mid.width===canvas.width && mid.height===canvas.height){
        canvas.getContext('2d').drawImage(mid,0,0);
      }else{
        _fitCompositeInto(canvas, mid, opts);
      }
    }catch(e){}
    // Immediately hand the editor canvas back so the editor stays
    // live if the user cancels partway through.
    try{ if(editorCanvas) SlideRenderer.init(editorCanvas); }catch(e){}
  }

  // ---------- Story Book (existing PDF path, wrapped as a destination) ----------
  // Two formats:
  //   • Digital PDF   — 144 DPI, screen-sized JPEG per page. Small file.
  //   • Print-ready PDF — 216 DPI, higher-fidelity JPEG per page.
  // Both formats use the same PdfWriter; the only difference is the
  // render canvas size + JPEG quality.
  const BOOK_FORMATS=[
    {id:'digital',   label:'Digital PDF',   description:'Small file · great on screen', renderW:1080, renderH:1350, jpegQuality:0.92, pageWpt:540, pageHpt:675},
    {id:'print',     label:'Print-ready PDF', description:'Higher detail · ready to print', renderW:1620, renderH:2025, jpegQuality:0.95, pageWpt:540, pageHpt:675}
  ];
  const BOOK={
    id:'book',
    label:'Story Adventure',
    glyph:'📖',
    tagline:'Read, save or print your story.',
    formats:BOOK_FORMATS,
    // ----- Render pipeline hooks -----
    createCanvas:function(format){
      const c=document.createElement('canvas');
      c.width=format.renderW;
      c.height=format.renderH;
      return c;
    },
    renderPage:function(canvas, slide, ctx){
      _renderSlideInto(canvas, slide, ctx.index, ctx.total);
    },
    encodePage:function(canvas, format){
      let url=null;
      try{ url=canvas.toDataURL('image/jpeg', format.jpegQuality); }catch(e){}
      if(!url) return null;
      return {
        jpegBytes: PdfWriter.dataURLToBytes(url),
        srcW: canvas.width,
        srcH: canvas.height
      };
    },
    finish:function(payloads, format){
      const pages=payloads.filter(function(p){ return p; });
      if(pages.length===0) return null;
      const blob=PdfWriter.build(pages, format.pageWpt, format.pageHpt);
      const suffix=(format.id==='print') ? '_print' : '';
      return {
        blob: blob,
        mime: 'application/pdf',
        filename: _sanitise(_bookTitle())+suffix+'.pdf',
        celebrateLabel: 'Get My Adventure',
        celebrateGlyph: '📥'
      };
    }
  };

  // ---------- Story Carousel (PNG per page, ZIP if multi-page) ----------
  // Two formats:
  //   • Instagram Portrait — 1080 × 1350 (the editor's native size).
  //   • Instagram Square   — 1080 × 1080 (centre-cropped from portrait).
  //
  // Portrait is a no-op recomposite of the native render. Square is a
  // centre-crop of the same 1080×1350 canvas onto a 1080×1080 target
  // — losing the top + bottom bands. Alternative approaches (letterbox
  // padding) were rejected because carousels prefer full-bleed pages.
  const CAROUSEL_FORMATS=[
    {id:'portrait', label:'Instagram Portrait', description:'1080 × 1350 · Feed post', outW:1080, outH:1350, mode:'contain'},
    {id:'square',   label:'Instagram Square',   description:'1080 × 1080 · Classic feed', outW:1080, outH:1080, mode:'centre-crop'}
  ];
  const CAROUSEL={
    id:'carousel',
    label:'Story Carousel',
    glyph:'📱',
    tagline:'Perfect for Instagram and sharing.',
    formats:CAROUSEL_FORMATS,
    createCanvas:function(){
      // Every render happens in the 1080 × 1350 renderer coord space.
      // The format's outW × outH is applied at the encode step.
      const c=document.createElement('canvas');
      c.width=1080;
      c.height=1350;
      return c;
    },
    renderPage:function(canvas, slide, ctx){
      // Real transparency, not a filled bar — PNG is the one output
      // format here that can actually carry alpha, so a non-matching
      // Scene's padding stays honestly empty instead of a fabricated
      // background colour (see _fitCompositeInto's own comment).
      _renderSlideInto(canvas, slide, ctx.index, ctx.total, {transparent:true});
    },
    encodePage:function(canvas, format, ctx){
      // Compose the shipped bitmap at format.outW × format.outH.
      const out=document.createElement('canvas');
      out.width=format.outW;
      out.height=format.outH;
      const octx=out.getContext('2d');
      try{ octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality='high'; }catch(e){}
      if(format.mode==='centre-crop'){
        // Centre-crop 1080×1350 onto 1080×1080 — drop 135 px from top
        // and bottom. That preserves the panel band (see PANEL_Y=185,
        // PANEL_H=930 in the renderer) so the story text sits in the
        // square with room to breathe.
        const cropY=Math.round((canvas.height-format.outH)/2);
        octx.drawImage(canvas, 0, cropY, canvas.width, format.outH, 0, 0, format.outW, format.outH);
      }else{
        // Portrait — same size, straight copy.
        octx.drawImage(canvas, 0, 0, format.outW, format.outH);
      }
      // Bake the editor's own rounded-corner look into the exported
      // pixels themselves — a real PNG file has no CSS to do this for
      // it the way the in-app preview canvases do.
      _applyRoundedCorners(out);
      let url=null;
      try{ url=out.toDataURL('image/png'); }catch(e){}
      if(!url) return null;
      const bytes=ZipWriter.dataURLToBytes(url);
      const name='page-'+String(ctx.index+1).padStart(2,'0')+'.png';
      return { name:name, bytes:bytes };
    },
    finish:function(payloads, format){
      const entries=payloads.filter(function(p){ return p; });
      if(entries.length===0) return null;
      const base=_sanitise(_bookTitle())+'_carousel_'+format.id;
      if(entries.length===1){
        // Single-page carousel — hand the child a plain PNG.
        return {
          blob: new Blob([entries[0].bytes],{type:'image/png'}),
          mime: 'image/png',
          filename: base+'.png',
          celebrateLabel: 'Download Image',
          celebrateGlyph: '🖼️'
        };
      }
      // Multi-page carousel — a ZIP so browsers can download every
      // page as one file. Each page keeps its 1-based zero-padded
      // name so the archive extracts in reading order.
      const zip=ZipWriter.build(entries);
      return {
        blob: zip,
        mime: 'application/zip',
        filename: base+'.zip',
        celebrateLabel: 'Download Images',
        celebrateGlyph: '📥'
      };
    }
  };

  // ---------- Story Reel (architecture placeholder) ----------
  // Reel rendering is a Sprint 9.1+ feature: MP4 encoding in the
  // browser needs either MediaRecorder or WebCodecs plus a frame
  // scheduler. Sprint 9.0.4 leaves the destination *interface* in
  // place so a future sprint plugs it in without redesigning
  // PublishStudio. Selecting Reel today shows a friendly "Coming
  // Soon" state; no renderer runs, no partial file is emitted.
  const REEL_FORMATS=[
    {id:'square-reel', label:'Instagram Reel', description:'1080 × 1920 · Vertical video', outW:1080, outH:1920, mode:'coming-soon'}
  ];
  const REEL={
    id:'reel',
    label:'Story Reel',
    glyph:'🎬',
    tagline:'Watch your story come alive.',
    comingSoon:true,
    formats:REEL_FORMATS,
    createCanvas:function(){ return null; },
    renderPage:function(){ /* no-op */ },
    encodePage:function(){ return null; },
    finish:function(){ return null; }
  };

  const REGISTRY=[BOOK, CAROUSEL, REEL];
  function list(){ return REGISTRY.slice(); }
  function find(id){
    for(let i=0;i<REGISTRY.length;i++){
      if(REGISTRY[i].id===id) return REGISTRY[i];
    }
    return null;
  }
  function findFormat(destinationId, formatId){
    const d=find(destinationId);
    if(!d) return null;
    for(let i=0;i<d.formats.length;i++){
      if(d.formats[i].id===formatId) return d.formats[i];
    }
    return null;
  }

  // Sprint 9.0.4 — register API. A future plugin (VihuPlanet, EPUB,
  // Kindle, Print Order, MP4 Reel renderer) can push a destination
  // into the registry without editing this file. `validate` returns
  // an array of missing / malformed fields; if it comes back
  // non-empty, register refuses the entry and returns false so the
  // developer sees the problem instead of silently shipping a
  // broken destination.
  const REQUIRED_DESTINATION_FIELDS=['id','label','glyph','tagline','formats'];
  const REQUIRED_HOOKS=['createCanvas','renderPage','encodePage','finish'];
  const REQUIRED_FORMAT_FIELDS=['id','label','description'];

  function validate(dest){
    const problems=[];
    if(!dest || typeof dest!=='object'){ problems.push('destination is not an object'); return problems; }
    REQUIRED_DESTINATION_FIELDS.forEach(function(k){
      if(typeof dest[k]==='undefined') problems.push('missing field: '+k);
    });
    // Coming-Soon destinations may skip render hooks — their
    // interface is intentionally inert. Everyone else must
    // implement the full four-step pipeline.
    if(!dest.comingSoon){
      REQUIRED_HOOKS.forEach(function(h){
        if(typeof dest[h]!=='function') problems.push('missing hook: '+h);
      });
    }
    if(Array.isArray(dest.formats)){
      if(dest.formats.length===0) problems.push('formats array is empty');
      dest.formats.forEach(function(fmt,i){
        REQUIRED_FORMAT_FIELDS.forEach(function(f){
          if(typeof fmt[f]==='undefined') problems.push('formats['+i+'] missing '+f);
        });
      });
    }else{
      problems.push('formats is not an array');
    }
    // ids in the registry must be unique.
    if(dest.id && REGISTRY.some(function(d){ return d.id===dest.id; })){
      problems.push('duplicate destination id: '+dest.id);
    }
    return problems;
  }
  function register(dest){
    const problems=validate(dest);
    if(problems.length>0){
      try{ console.warn('StoryDestinations.register rejected: '+problems.join('; ')); }catch(e){}
      return false;
    }
    REGISTRY.push(dest);
    return true;
  }

  const api={list:list,find:find,findFormat:findFormat,register:register,validate:validate};
  try{ window.StoryDestinations=api; }catch(e){}
  return api;
})();
