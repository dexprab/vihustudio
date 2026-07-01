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
// The publishing architecture keeps a single loop:
//
//     Story ─┐
//            ▶  Destination.plan(pages) → per-page renderable size
//     Every page:
//            ▶  Destination.renderPage(canvas, slide, opts)
//            ▶  Destination.encodePage(canvas) → payloadBytes
//     Finalise:
//            ▶  Destination.finish(payloads) → Blob + filename
//
// Adding a future destination (EPUB, Kindle, VihuPlanet, Print Order,
// or the eventual Story Reel MP4 renderer) means dropping in one more
// entry — no PublishStudio redesign, no shell changes, no new stage.
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
  function _renderSlideInto(canvas, slide, idx, total){
    const editorCanvas=(typeof document!=='undefined') ? document.getElementById('previewCanvas') : null;
    try{
      // Force dpr:1 for every destination — the output is a flat
      // bitmap (PNG / JPEG). DPR scaling would just balloon file
      // sizes without adding usable resolution beyond 1080×1350.
      SlideRenderer.init(canvas,{dpr:1});
      const titleEl=(typeof document!=='undefined') ? document.getElementById('bookTitle') : null;
      const payload=SlideRenderer.buildPayload(slide,{
        page: idx+1,
        totalPages: total,
        defaultBookTitle: titleEl ? titleEl.value : ''
      });
      SlideRenderer.render(payload);
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
    label:'Story Book',
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
        celebrateLabel: 'Get My Book',
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
      _renderSlideInto(canvas, slide, ctx.index, ctx.total);
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

  const api={list:list,find:find,findFormat:findFormat};
  try{ window.StoryDestinations=api; }catch(e){}
  return api;
})();
