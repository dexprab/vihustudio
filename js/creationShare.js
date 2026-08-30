// =============================================================
// VihuStudio — Creation Share (Sprint LOOK WHAT I MADE, Phase A)
// -------------------------------------------------------------
// ONE internal representation for a shareable creation. A child
// never says what kind of thing they made — the system already
// knows — and every way a creation leaves VihuPlanet (a parent's
// letter, a foldable, a story card, a watch replay) starts from
// this one object rather than from four private readings of the
// project record.
//
// Three kinds, inferred and never asked:
//
//   moment    — one page, one making.   "Look how I drew this."
//   sequence  — one page, many makings. "Look what happened."
//   story     — many pages.             "Read my story."
//
// Two layers, deliberately separate:
//
//   fromRecord(record)          — the cheap, synchronous contract:
//                                 identity, type, title, maker.
//                                 Safe anywhere the record is.
//
//   snapshot(record, slides)    — the SHAREABLE payload: page
//                                 images at reading size plus a
//                                 bounded set of "watch" frames
//                                 (the making, from MagicReveal).
//                                 Studio-only, because rendering
//                                 needs the live SlideRenderer —
//                                 there is no headless renderer
//                                 in this product (recorded in
//                                 the publish sprint), and the
//                                 share is made where the child
//                                 is standing anyway.
//
// The snapshot is a WHITELIST, never "the record minus secrets".
// A subtraction has to stay complete for ever (Decision 33's own
// reasoning); a construction cannot leak a field nobody wrote
// out. Nothing in a snapshot names a card, a session, a project
// id, a memory, a constellation or a conversation. The ONE
// deliberate exception is `ether`: the project id of a creation
// that is ALREADY public in the shared feed — Decision 9 made
// that id the public deep link for published stories, so for a
// published creation it reveals nothing new, and for an
// unpublished one it is never set (and resolves to nothing if
// forged, because the Ether only opens shared records).
//
// The WATCH frames are not a stored video. The Magic Creation
// video is ephemeral by design (revoked when the celebration
// closes), but MagicReveal is a pure function of the final saved
// page — so the making can be re-derived at share time, rendered
// small, and REPLAYED anywhere the snapshot travels. The parent
// sees child → imagination → making → creation without a video
// file ever existing.
// =============================================================

const CreationShare=(function(){
  'use strict';

  // Reading-size page images travel at the same width the Ether's
  // own portal reads (js/thumbnails.js READ_W); watch frames are
  // deliberately smaller — they are moments in motion, on screen
  // for a second each, and a share should not weigh megabytes.
  const PAGE_W=1024;
  const WATCH_W=640;

  // The whole share carries at most this many watch frames,
  // however long the story is. MagicReveal.fitToBudget thins each
  // page's reveal evenly, so a long story gets a brisker making,
  // never a truncated one.
  const WATCH_BUDGET=28;
  const WATCH_MIN_PER_PAGE=4;
  const WATCH_MAX_PER_PAGE=12;

  // ---------- what counts as content ----------
  // The same reading js/app.js's story actions use: a page with a
  // sticker, an authored background, or its own artwork is real.
  function _pageHasContent(p){
    if(!p) return false;
    const m=p.metadata||{};
    if(Array.isArray(m.stickers)&&m.stickers.length) return true;
    if(m.cardOverrides&&m.cardOverrides.background) return true;
    if(p.image) return true;
    return false;
  }

  // How many authored things one page carries. This is what tells
  // a moment from a sequence: one making is a moment, several
  // makings on one page are something that HAPPENED.
  function _authoredMarks(p){
    if(!p) return 0;
    const m=p.metadata||{};
    let n=0;
    if(Array.isArray(m.stickers)) n+=m.stickers.length;
    if(p.image) n+=1;
    if(m.placeContent){
      try{ n+=Object.keys(m.placeContent).length; }catch(e){}
    }
    const words=String(p.storyBeat||p.storyDraft||'').trim();
    if(words) n+=1;
    return n;
  }

  // ---------- type inference ----------
  // Works on serialized pages and runtime slides alike — both
  // carry {image, metadata, storyBeat, storyDraft}.
  function typeOf(pages){
    const real=(pages||[]).filter(_pageHasContent);
    if(real.length>1) return 'story';
    if(real.length===1 && _authoredMarks(real[0])>=2) return 'sequence';
    return 'moment';
  }

  // The child-facing sentence for each kind. The presentation
  // adapts; the child never selects.
  const SAYS={
    moment:   'Look what I made',
    sequence: 'Look what happened',
    story:    'Read my story'
  };
  function says(type){ return SAYS[type]||SAYS.moment; }

  function _titleOf(record){
    const raw=String((record&&record.name)||'').trim();
    // 'Untitled' is the store's own placeholder, not a name a
    // child chose (the same reading js/companionLive.js already
    // gives it) — a share should never present it as one.
    if(!raw||raw.toLowerCase()==='untitled') return '';
    return raw;
  }

  // A creation with no chosen name is still presentable — the
  // fallback is warm and type-shaped, never "Untitled".
  function displayTitle(share){
    if(share&&share.title) return share.title;
    const t=share&&share.creationType;
    if(t==='story') return 'A Little Story';
    if(t==='sequence') return 'Something That Happened';
    return 'Something I Made';
  }

  // ---------- the contract ----------
  function fromRecord(record){
    if(!record) return null;
    const data=record.data||{};
    const pages=Array.isArray(data.pages)?data.pages:[];
    return {
      creationId: record.id||null,
      creationType: typeOf(pages),
      title: _titleOf(record),
      creatorName: String(record.creatorName||'').trim(),
      pages: pages,
      publishedAt: record.publishedAt||null,
      // Resolves back to the EXACT creation. For the share token
      // that resolution is minted server-side; what the contract
      // itself can promise is the Ether deep link, and only for a
      // creation that is already public there.
      vihuplanetEntry: record.publishedAt ? { etherStoryId: record.id } : null
    };
  }

  // ---------- rendering one page ----------
  // A serialized page may already carry a readImage (rendered by
  // the share ceremony); a runtime slide is rendered fresh. Never
  // both, never re-rendered when the record already holds one.
  function _renderPage(slide,width){
    if(slide&&slide.readImage&&width>=PAGE_W) return Promise.resolve(slide.readImage);
    if(typeof ThumbnailEngine==='undefined'||!ThumbnailEngine.generateRead){
      return Promise.resolve(slide&&(slide.readImage||slide.thumbnail)||null);
    }
    return ThumbnailEngine.generateRead(slide,width).then(function(url){
      return url||(slide&&(slide.readImage||slide.thumbnail))||null;
    });
  }

  // ---------- the making, as frames ----------
  function _watchFramesFor(slides){
    if(typeof MagicReveal==='undefined'||!MagicReveal.revealStages) return Promise.resolve([]);
    const real=(slides||[]).filter(_pageHasContent);
    if(!real.length) return Promise.resolve([]);
    const perPage=Math.max(WATCH_MIN_PER_PAGE,
                  Math.min(WATCH_MAX_PER_PAGE,Math.floor(WATCH_BUDGET/real.length)));
    let chain=Promise.resolve([]);
    real.forEach(function(slide){
      chain=chain.then(function(frames){
        let stages=[];
        try{ stages=MagicReveal.fitToBudget(MagicReveal.revealStages(slide),perPage); }catch(e){}
        let inner=Promise.resolve(frames);
        stages.forEach(function(st){
          inner=inner.then(function(list){
            return _renderPage(st.slide,WATCH_W).then(function(url){
              if(url) list.push({ image:url, holdMs: st.holdMs||900 });
              return list;
            });
          });
        });
        return inner;
      });
    });
    return chain;
  }

  // ---------- the shareable payload ----------
  // record — the store record (identity, name, maker, publishedAt)
  // slides — the RUNTIME slides of that project, open in the
  //          Studio (AppState.slides). The hub guarantees the
  //          project it shares is the project that is open.
  function snapshot(record,slides,opts){
    const o=opts||{};
    const share=fromRecord(record)||{};
    const real=(slides||[]).filter(_pageHasContent);
    let chain=Promise.resolve([]);
    real.forEach(function(slide){
      chain=chain.then(function(pages){
        return _renderPage(slide,PAGE_W).then(function(url){
          if(url) pages.push({ image:url });
          return pages;
        });
      });
    });
    return chain.then(function(pages){
      const withWatch=(o.watch===false)?Promise.resolve([]):_watchFramesFor(slides);
      return withWatch.then(function(watch){
        const payload={
          v:1,
          type: share.creationType||'moment',
          title: share.title||'',
          creatorName: share.creatorName||'',
          pages: pages,
          watch: watch,
          madeIn:'vihuplanet'
        };
        // Public-only, by construction — see the header.
        if(record&&record.publishedAt&&record.id) payload.ether=record.id;
        return payload;
      });
    });
  }

  const api={
    typeOf:typeOf,
    says:says,
    displayTitle:displayTitle,
    fromRecord:fromRecord,
    snapshot:snapshot,
    PAGE_W:PAGE_W,
    WATCH_W:WATCH_W,
    WATCH_BUDGET:WATCH_BUDGET
  };
  try{ window.CreationShare=api; }catch(e){}
  return api;
})();
