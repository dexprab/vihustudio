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
  //
  // A destination whose own frame is a very different shape from the
  // Scene — Story Reel's 9:16 video frame around a 4:5 authored page —
  // would otherwise show flat, empty letterbox bars, the "blank spaces
  // on top and bottom" a real reel export made obvious. `opts.backdrop
  // === 'blur'` fills the whole frame with a scaled-up, softened copy of
  // the page itself and draws the sharp, correctly-proportioned render
  // on top of it: every authored pixel stays visible and undistorted
  // (Rule 1 — the Scene is never re-laid-out, stretched, or cropped to
  // fit a platform's own frame shape), while the frame reads as
  // deliberately composed rather than padded. This is the same treatment
  // Reels/Shorts themselves apply to a non-9:16 upload.
  const BACKDROP_TINY_W=64;         // pre-shrink width — the smear itself
  const BACKDROP_BLUR_PX=36;        // extra softening where ctx.filter exists
  const BACKDROP_OVERSCAN=1.14;     // push the blur's own soft edge off-frame
  const BACKDROP_DIM='rgba(0,0,0,0.18)';
  function _drawBlurredBackdrop(dctx, srcCanvas, dw, dh){
    const sw=srcCanvas.width, sh=srcCanvas.height;
    if(!sw || !sh) return;
    // Pre-shrink onto a tiny canvas first: the browser's own smoothing
    // does the pixel averaging, so the backdrop is genuinely soft even
    // in an engine where `ctx.filter` isn't available at all.
    const tw=Math.max(2, BACKDROP_TINY_W);
    const th=Math.max(2, Math.round(BACKDROP_TINY_W*(sh/sw)));
    const tiny=document.createElement('canvas');
    tiny.width=tw; tiny.height=th;
    const tctx=tiny.getContext('2d');
    try{ tctx.imageSmoothingEnabled=true; tctx.imageSmoothingQuality='high'; }catch(e){}
    tctx.drawImage(srcCanvas,0,0,sw,sh,0,0,tw,th);
    const cover=Math.max(dw/tw, dh/th)*BACKDROP_OVERSCAN;
    const bw=tw*cover, bh=th*cover;
    dctx.save();
    try{ dctx.imageSmoothingEnabled=true; dctx.imageSmoothingQuality='high'; }catch(e){}
    try{ dctx.filter='blur('+BACKDROP_BLUR_PX+'px)'; }catch(e){}
    dctx.drawImage(tiny,0,0,tw,th,(dw-bw)/2,(dh-bh)/2,bw,bh);
    dctx.restore();
    // A light scrim so the sharp page reads as the focal point rather
    // than competing with its own blurred copy behind it.
    dctx.fillStyle=BACKDROP_DIM;
    dctx.fillRect(0,0,dw,dh);
  }
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
      if(opts && opts.backdrop==='blur') _drawBlurredBackdrop(dctx, srcCanvas, dw, dh);
    }
    const scale=Math.min(dw/sw, dh/sh);
    const rw=sw*scale, rh=sh*scale;
    const rx=(dw-rw)/2, ry=(dh-rh)/2;
    try{ dctx.imageSmoothingEnabled=true; dctx.imageSmoothingQuality='high'; }catch(e){}
    if(opts && opts.backdrop==='blur'){
      // A soft drop shadow so the sharp page reads as sitting ON the
      // blurred bed behind it, rather than as a flat colour band butted
      // against it. Scoped to backdrop mode — every other destination's
      // composite is byte-identical to before.
      dctx.save();
      dctx.shadowColor='rgba(0,0,0,0.35)';
      dctx.shadowBlur=Math.round(Math.min(dw,dh)*0.035);
      dctx.shadowOffsetY=Math.round(Math.min(dw,dh)*0.008);
      dctx.drawImage(srcCanvas,0,0,sw,sh,rx,ry,rw,rh);
      dctx.restore();
      return;
    }
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
    // Publish Quality — real resolution, not just a bigger destination
    // canvas. `opts.scale` is the dpr SlideRenderer draws the
    // intermediate render at (default 1, unchanged for any destination/
    // format that doesn't ask for more). Handing it straight to
    // SlideRenderer.init's own `dpr` option means the SAME logical
    // viewport draws into a genuinely higher-density backing store —
    // every glyph, vector shape, and Frame ornament renders natively
    // sharper, never a blurred upscale of a lower-resolution raster.
    // Before this fix, forcing dpr:1 here meant a destination whose own
    // createCanvas size didn't match the logical viewport (e.g. the old,
    // *mislabeled* "Print-ready PDF" that once claimed 216 DPI at
    // 1620×2025 pixels) was only ever a 1080×1350-quality render
    // stretched up by the fit-composite step below, never a genuinely
    // sharper one — see BOOK_FORMATS' own comment for the corrected
    // 300 DPI print value. (Digital PDF's own, later, unrelated bump to
    // a genuine 216 DPI happens to land on that identical 1620×2025
    // pixel count — a coincidence of the math, not a reuse of the old
    // bug's numbers on purpose.) A raster Story image the child uploaded
    // is still bounded by whatever resolution it was actually uploaded
    // at — scale only benefits the app's own rendered content (text,
    // Frames, decorations, Museum-style captions, etc.).
    const scale=(opts && typeof opts.scale==='number' && opts.scale>0) ? opts.scale : 1;
    try{
      // Rule 5 — render the Slide at its OWN real Aspect Ratio first
      // (adaptiveViewport:true, matching the editor exactly) on a
      // throwaway intermediate canvas, then fit/composite that
      // correctly-shaped render into this destination's own fixed
      // render coordinate space (unchanged since Sprint 9.0) — never
      // resize `canvas` itself, since every downstream encodePage/
      // finish step still assumes that fixed space; a PDF page size or
      // "Instagram Portrait/Square" is a separate, deliberate
      // destination-format decision this doesn't override. The
      // overwhelming common case (a portrait Scene, or any Scene
      // authored before the Scene Viewport feature existed) hits the
      // fast, byte-identical path below with zero extra compositing —
      // now genuinely at `scale`'s own resolution, not a downstream
      // upscale of a flat 1x render.
      const mid=document.createElement('canvas');
      SlideRenderer.init(mid,{dpr:scale,adaptiveViewport:true});
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
  //   • Digital PDF     — 216 DPI, bumped up from the original 144 DPI
  //     per a direct follow-up ("Digital PDF too... bump it up as well,
  //     e.g. matching Print-ready's 300 DPI or a middle ground") —
  //     deliberately a middle ground, NOT matching Print-ready's 300 DPI
  //     outright: collapsing the two down to nearly the same resolution
  //     would erase the real distinction this format exists for (a
  //     smaller, screen-optimized file vs. a true print-quality one),
  //     leaving only a JPEG-quality difference between them.
  //   • Print-ready PDF — 300 DPI, the print-industry standard (was 216
  //     DPI — a real, disclosed Publish Quality fix, not just bigger
  //     numbers: see `renderScale`/`_renderSlideInto` below).
  // Both formats use the same PdfWriter; the only difference is the
  // render canvas size + JPEG quality. `renderScale` is the field that
  // actually matters: it's the dpr SlideRenderer draws the page at (see
  // `_renderSlideInto`), not merely a bigger destination canvas — at
  // scale 1 the render happens natively at the logical 1080×1350
  // viewport (144 DPI given a 540×675pt page); at scale (216/144) or
  // (300/144) the SAME content renders into a genuinely higher-density
  // backing store (1620×2025 / 2250×2813), so text/vector shapes/Frame
  // ornaments come out crisp, not a blurred upscale of a lower-resolution
  // raster.
  const BOOK_FORMATS=[
    {id:'digital',   label:'Digital PDF',   description:'216 DPI · sharp on screen, smaller file', renderScale:216/144, renderW:1620, renderH:2025, jpegQuality:0.92, pageWpt:540, pageHpt:675},
    {id:'print',     label:'Print-ready PDF', description:'300 DPI · true print quality', renderScale:300/144, renderW:2250, renderH:2813, jpegQuality:0.95, pageWpt:540, pageHpt:675}
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
      _renderSlideInto(canvas, slide, ctx.index, ctx.total, {scale:(ctx.format && ctx.format.renderScale) || 1});
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
  // Two formats, both rendered at CAROUSEL_RENDER_SCALE (3x — genuine
  // higher-density pixels via SlideRenderer's own dpr, not an upscaled
  // raster; see the Publish Quality note on _renderSlideInto). Bumped
  // from 2x to 3x per a direct follow-up request to further increase
  // Instagram Carousel/Feed export resolution, on top of the earlier
  // Publish Quality pass that first introduced the 2x scale:
  //   • Instagram Portrait — 3240 × 4050 (3× the editor's native
  //     1080 × 1350). Instagram itself only ever asks for a 1080px-wide
  //     upload — this is real headroom for saving/sharing the image
  //     outside Instagram, viewing it zoomed in, printing it, or a
  //     future higher-resolution upload path, not something IG
  //     requires — but a higher-resolution source also survives
  //     Instagram's own upload-time re-compression more cleanly than a
  //     lower one, so "more headroom than IG needs" still buys a
  //     genuinely crisper result once Instagram's own pipeline touches
  //     it.
  //   • Instagram Square   — 3240 × 3240 (centre-cropped from portrait).
  //
  // Portrait is a no-op recomposite of the native render. Square is a
  // centre-crop of the same 3240×4050 canvas onto a 3240×3240 target
  // — losing the top + bottom bands. Alternative approaches (letterbox
  // padding) were rejected because carousels prefer full-bleed pages.
  const CAROUSEL_RENDER_SCALE=3;
  const CAROUSEL_FORMATS=[
    {id:'portrait', label:'Instagram Portrait', description:'3240 × 4050 · Feed post (HD)', outW:1080*CAROUSEL_RENDER_SCALE, outH:1350*CAROUSEL_RENDER_SCALE, mode:'contain'},
    {id:'square',   label:'Instagram Square',   description:'3240 × 3240 · Classic feed (HD)', outW:1080*CAROUSEL_RENDER_SCALE, outH:1080*CAROUSEL_RENDER_SCALE, mode:'centre-crop'}
  ];
  const CAROUSEL={
    id:'carousel',
    label:'Story Carousel',
    glyph:'📱',
    tagline:'Perfect for Instagram and sharing.',
    formats:CAROUSEL_FORMATS,
    createCanvas:function(){
      // Every render happens in the 1080 × 1350 renderer coord space,
      // scaled CAROUSEL_RENDER_SCALE× for genuine HD output. The
      // format's outW × outH is applied at the encode step.
      const c=document.createElement('canvas');
      c.width=1080*CAROUSEL_RENDER_SCALE;
      c.height=1350*CAROUSEL_RENDER_SCALE;
      return c;
    },
    renderPage:function(canvas, slide, ctx){
      // Real transparency, not a filled bar — PNG is the one output
      // format here that can actually carry alpha, so a non-matching
      // Scene's padding stays honestly empty instead of a fabricated
      // background colour (see _fitCompositeInto's own comment).
      _renderSlideInto(canvas, slide, ctx.index, ctx.total, {transparent:true, scale:CAROUSEL_RENDER_SCALE});
    },
    encodePage:function(canvas, format, ctx){
      // Compose the shipped bitmap at format.outW × format.outH.
      const out=document.createElement('canvas');
      out.width=format.outW;
      out.height=format.outH;
      const octx=out.getContext('2d');
      try{ octx.imageSmoothingEnabled=true; octx.imageSmoothingQuality='high'; }catch(e){}
      if(format.mode==='centre-crop'){
        // Centre-crop 3240×4050 onto 3240×3240 — drop 405 px from top
        // and bottom (the same 135-logical-px trim as before, scale-
        // invariant since it's always (1350-1080)/2*scale). That
        // preserves the panel band (see PANEL_Y=185, PANEL_H=930 in the
        // renderer, logical units) so the story text sits in the square
        // with room to breathe.
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

  // ---------- Story Reel (Voice MVP Ship 3 — real, no longer a stub) ----------
  // A narrated slideshow video: every page renders through the SAME
  // SlideRenderer pipeline the editor / Book / Carousel already use
  // (Rule 5 — Publish Fidelity), holds on screen for its own
  // narration's real length (or a default beat when silent), and the
  // narrations are stitched in as the audio track. Composition is
  // fully client-side — canvas.captureStream + WebAudio +
  // MediaRecorder via js/reelComposer.js — and records in REAL TIME,
  // so PublishStudio shows this destination's own finishingMessage
  // while finish() runs. finish() and encodePage() both return
  // thenables — the first async hooks in the registry; PublishStudio
  // awaits thenable hook results since this ship (BOOK/CAROUSEL stay
  // synchronous, byte-identical).
  const REEL_FPS=30;
  const REEL_SILENT_HOLD_MS=3000;   // a page with no narration still gets a beat
  const REEL_NARRATION_TAIL_MS=450; // breathing room after a clip ends
  const REEL_MIN_HOLD_MS=1500;      // a narrated page never flashes by
  const REEL_FORMATS=[
    // `transition` is declarative so the motion between pages can be
    // changed (or switched off, with 'none') without touching the
    // composer — ReelComposer reads it straight off compose()'s opts.
    {id:'square-reel', label:'Instagram Reel', description:'1080 × 1920 · Vertical video', outW:1080, outH:1920, mode:'contain', transition:'page-turn'}
  ];
  const REEL={
    id:'reel',
    label:'Story Reel',
    glyph:'🎬',
    tagline:'Watch your story come alive.',
    formats:REEL_FORMATS,
    // Optional per-destination presentation fields PublishStudio reads
    // when present — additive contract, BOOK/CAROUSEL don't carry them.
    publishMessages:[
      'Painting your scenes…',
      'Warming up the camera…',
      'Filming your story…',
      'Adding movie magic…',
      'Almost ready…'
    ],
    finishingMessage:'Filming your story… this takes a minute 🎥',
    progressNoun:'Scene',
    createCanvas:function(format){
      const c=document.createElement('canvas');
      c.width=format.outW;
      c.height=format.outH;
      return c;
    },
    renderPage:function(canvas, slide, ctx){
      // No transparency — video has no meaningful alpha. A 4:5 page
      // contains into this 9:16 frame by width, which would otherwise
      // leave ~285px of flat, empty bar above and below it; `backdrop:
      // 'blur'` fills that with a softened copy of the page itself
      // instead, so the frame is full without the authored Scene being
      // cropped or stretched to reach the edges (Rule 1). Scale 1: the
      // contained render is already 1:1 pixels at this width.
      _renderSlideInto(canvas, slide, ctx.index, ctx.total, {scale:1, backdrop:'blur'});
    },
    encodePage:function(canvas, format, ctx){
      // Returns a thenable payload when the page has narration —
      // bytes resolve via AssetStore (a durable vihu-asset: ref,
      // with the recalled-project owner fallback), then decode to a
      // real AudioBuffer. The decoded buffer's own duration drives
      // the page hold (narration.durationMs can legitimately be 0
      // for an imported clip whose metadata probe failed), so the
      // hold always fits the audio. The canvas itself IS the page
      // bitmap — createCanvas mints a fresh one per page, so no copy
      // is needed.
      const slide=ctx?ctx.slide:null;
      const narration=slide&&slide.metadata&&slide.metadata.narration;
      const silent={ bitmap:canvas, narrationBuffer:null, holdMs:REEL_SILENT_HOLD_MS };
      if(!narration||!narration.ref) return silent;
      if(typeof AssetStore==='undefined'||typeof ReelComposer==='undefined') return silent;
      const resolveOpts=slide.recallOwnerId?{ownerId:slide.recallOwnerId}:undefined;
      return AssetStore.resolve(narration.ref, resolveOpts)
        .then(function(url){ return url?fetch(url):null; })
        .then(function(r){ return (r&&r.ok)?r.arrayBuffer():null; })
        .then(function(buf){ return buf?ReelComposer.decodeAudio(buf):null; })
        .then(function(audioBuffer){
          if(!audioBuffer) return silent;
          const holdMs=Math.max(REEL_MIN_HOLD_MS, Math.round(audioBuffer.duration*1000)+REEL_NARRATION_TAIL_MS);
          return { bitmap:canvas, narrationBuffer:audioBuffer, holdMs:holdMs };
        })
        .catch(function(){ return silent; });
    },
    finish:function(payloads, format){
      const pages=payloads.filter(function(p){ return p&&p.bitmap; });
      if(pages.length===0) return null;
      if(typeof ReelComposer==='undefined'||!ReelComposer.isSupported()) return null;
      return ReelComposer.compose(pages,{
          width:format.outW, height:format.outH, fps:REEL_FPS,
          transition:format.transition||'page-turn'
        })
        .then(function(out){
          if(!out||!out.blob||out.blob.size===0) return null;
          const ext=(out.mime&&out.mime.indexOf('mp4')>=0)?'.mp4':'.webm';
          return {
            blob: out.blob,
            mime: out.mime||'video/webm',
            filename: _sanitise(_bookTitle())+'_reel'+ext,
            celebrateLabel: 'Download My Reel',
            celebrateGlyph: '🎬'
          };
        })
        .catch(function(){ return null; });
    }
  };

  // ---------- Magic Creation (Magic Publish, Sprint M1) ----------
  // A story that assembles itself: every page arrives layer by
  // layer — paper, world, picture, decorations, words — rather than
  // cutting in whole. The stages come from js/magicReveal.js, which
  // derives them from the FINAL saved page (no history, no
  // timeline); every frame renders through the SAME SlideRenderer
  // pipeline the editor / Book / Carousel / Reel already use
  // (Rule 5 — Publish Fidelity), so the reveal can never show
  // authoring chrome: the editor is not involved at any point.
  //
  // The one place this destination departs from its siblings: the
  // pipeline calls createCanvas / renderPage / encodePage once per
  // PAGE, but a reveal is many FRAMES per page. renderPage honours
  // the contract (it draws the finished page into the supplied
  // canvas); encodePage returns {frames:[…]} instead of one bitmap,
  // and finish() flattens every page's frames into one list for
  // ReelComposer. Nothing in PublishStudio needed changing for that
  // — it treats a payload as opaque and hands the array straight to
  // finish().
  //
  // SPRINT STATUS — M1 shipped the plumbing, M2 the real stages, and
  // M3 (here) renders each stage off-screen so every one of them has
  // its own bitmap. The reveal now genuinely builds up on screen.
  // M4 animates the arrivals (crossfade, rise, settle); the payload
  // shape does not change again.
  //
  // Audio is deliberately absent until M7 (narration → ambient →
  // silence). ReelComposer feeds its own silent track for the whole
  // recording, so a soundless reveal composes correctly today.
  const MAGIC_FPS=30;
  // `transition:'none'` deliberately, and only until M4. ReelComposer
  // turns between every consecutive entry in the list it is handed —
  // which was right in M1, when a page contributed exactly one frame,
  // and is wrong the moment a page contributes several: a page-turn
  // between "Blank" and "The World" of the SAME page reads as flipping
  // to a new page when the page is actually assembling in front of
  // you. M4 ("New transition mode") is where the reveal gets its real
  // language — crossfade and rise within a page, a turn between pages.
  // Until then a hard cut is the honest cut.
  const MAGIC_FORMATS=[
    {id:'vertical', label:'Magic Video', description:'1080 × 1920 · Vertical video', outW:1080, outH:1920, mode:'contain', transition:'none'}
  ];
  const MAGIC={
    id:'magic',
    label:'Magic Creation',
    glyph:'✨',
    tagline:'Watch your story come together.',
    formats:MAGIC_FORMATS,
    publishMessages:[
      'Turning to a blank page…',
      'Bringing in your world…',
      'Adding your picture…',
      'Sprinkling the magic…',
      'Almost ready…'
    ],
    finishingMessage:'Making the magic… this takes a minute ✨',
    progressNoun:'Scene',
    createCanvas:function(format){
      const c=document.createElement('canvas');
      c.width=format.outW;
      c.height=format.outH;
      return c;
    },
    renderPage:function(canvas, slide, ctx){
      // Same treatment as the Reel: no transparency (video has no
      // meaningful alpha), and `backdrop:'blur'` fills the bars a
      // 4:5 page leaves in a 9:16 frame with a softened copy of the
      // page rather than cropping or stretching the authored Scene
      // to reach the edges (Rule 1).
      _renderSlideInto(canvas, slide, ctx.index, ctx.total, {scale:1, backdrop:'blur'});
    },
    encodePage:function(canvas, format, ctx){
      // One payload per page carrying that page's own reveal frames.
      // Every stage gets a real bitmap of its own, drawn through the
      // SAME _renderSlideInto the finished page just used — one
      // renderer, never a second one (roadmap M3: "Reuse existing
      // rendering. Do not build a second renderer.").
      //
      // Only the finished stage skips that work: renderPage has
      // already drawn it into the canvas the pipeline handed us, and
      // that canvas is freshly minted per page by createCanvas, so
      // holding a reference to it can't collide with another page.
      const slide=ctx?ctx.slide:null;
      if(!slide) return null;
      const stages=(typeof MagicReveal!=='undefined')
        ? MagicReveal.revealStages(slide)
        : [{slide:slide, label:'Finished', holdMs:2200}];
      if(!stages||stages.length===0) return null;
      const frames=[];
      for(let i=0;i<stages.length;i++){
        const st=stages[i];
        if(!st||!st.slide) continue;
        const isFinished=(i===stages.length-1);
        let bitmap;
        if(isFinished){
          bitmap=canvas;
        }else{
          const off=document.createElement('canvas');
          off.width=canvas.width;
          off.height=canvas.height;
          // Same treatment as the finished page — including the
          // blurred backdrop, so an earlier stage and the finished
          // frame share one frame composition and the bars never
          // pop between them.
          _renderSlideInto(off, st.slide, ctx.index, ctx.total, {scale:1, backdrop:'blur'});
          // Tagged so finish() knows which canvases are OURS to
          // release. The finished frame's canvas belongs to the
          // pipeline (PublishStudio minted it via createCanvas and
          // may still want it), so it is deliberately never tagged.
          off.__magicOwned=true;
          bitmap=off;
        }
        frames.push({ bitmap:bitmap, holdMs:st.holdMs });
      }
      if(frames.length===0) return null;
      return { frames:frames };
    },
    finish:function(payloads, format){
      // Flatten every page's frames into the one ordered list
      // ReelComposer takes. narrationBuffer stays null across the
      // board until M7 wires audio in.
      const pages=[];
      for(let i=0;i<payloads.length;i++){
        const p=payloads[i];
        if(!p||!p.frames) continue;
        for(let j=0;j<p.frames.length;j++){
          const f=p.frames[j];
          if(!f||!f.bitmap) continue;
          pages.push({ bitmap:f.bitmap, narrationBuffer:null, holdMs:f.holdMs });
        }
      }
      if(pages.length===0) return null;
      if(typeof ReelComposer==='undefined'||!ReelComposer.isSupported()) return null;
      // Memory cleanup (roadmap M3). A reveal holds every stage of
      // every page in memory at once, and at 1080 × 1920 each canvas
      // is ~8 MB of backing store — a four-page story with five
      // stages each retains ~160 MB until GC happens to notice.
      // Setting width/height releases the backing store immediately
      // and deterministically, which is the one reliable way to hand
      // canvas memory back in a browser. Only OUR canvases are
      // released; the pipeline's own per-page canvas is left alone.
      // This runs on both the success and the failure path, because
      // a compose that throws still leaves every frame allocated.
      const release=function(){
        for(let i=0;i<pages.length;i++){
          const b=pages[i].bitmap;
          if(b&&b.__magicOwned){ b.width=0; b.height=0; }
        }
      };
      return ReelComposer.compose(pages,{
          width:format.outW, height:format.outH, fps:MAGIC_FPS,
          transition:format.transition||'page-turn'
        })
        .then(function(out){
          release();
          if(!out||!out.blob||out.blob.size===0) return null;
          const ext=(out.mime&&out.mime.indexOf('mp4')>=0)?'.mp4':'.webm';
          return {
            blob: out.blob,
            mime: out.mime||'video/webm',
            filename: _sanitise(_bookTitle())+'_magic'+ext,
            celebrateLabel: 'Watch The Magic',
            celebrateGlyph: '✨'
          };
        })
        .catch(function(){ release(); return null; });
    }
  };

  const REGISTRY=[BOOK, CAROUSEL, REEL, MAGIC];
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
