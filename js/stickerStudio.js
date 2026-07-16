// StickerStudio — Sprint 6.6.
//
// Right-pane studio for browsing and inserting stickers. The studio is
// the magical sticker book; the renderer paints; SceneEngine owns the
// data. Children: click a sticker, see it appear, drag it around. Done.
//
// Host contract (set by app.js bootstrap):
//   {
//     getCurrentSlide(): slide
//     redraw(): void                  — repaint canvas
//     markDirty(): void               — persistence trigger
//     setSelectedSticker(id|null,type): void — paints selection chrome
//                                      + auto-tabs the right pane to
//                                      Card Designer
//     refreshThumbnails(): void       — slide-list / timeline refresh
//   }
const StickerStudio=(function(){
  const FAVORITES_KEY='vihu.stickerStudio.favorites.v1';
  const RECENTS_KEY='vihu.stickerStudio.recents.v1';
  const MAX_RECENTS=20;
  // Inserted stickers land at the canvas center at a comfortable size.
  // 1080 × 1350 page; 260 fills nicely without overwhelming. Children
  // can resize from there.
  const INSERT_W=260;
  const INSERT_H=260;
  const INSERT_X=540;  // canvas center X
  const INSERT_Y=675;  // canvas center Y

  let mountedContainer=null;
  let host=null;
  let activeCategoryId='characters';
  let searchQuery='';
  let _root=null;
  let _gridEl=null;
  let _searchEl=null;
  let _categoriesEl=null;
  let _emptyEl=null;

  // ---- Favorites + Recents persistence (localStorage) ----
  function _readSet(key){
    try{
      const raw=localStorage.getItem(key);
      if(!raw) return [];
      const arr=JSON.parse(raw);
      return Array.isArray(arr)?arr:[];
    }catch(e){ return []; }
  }
  function _writeSet(key,arr){
    try{ localStorage.setItem(key,JSON.stringify(arr)); }catch(e){}
  }
  function _getFavorites(){ return _readSet(FAVORITES_KEY); }
  function _getRecents(){ return _readSet(RECENTS_KEY); }
  function _isFavorite(id){ return _getFavorites().indexOf(id)!==-1; }
  function _toggleFavorite(id){
    const list=_getFavorites();
    const idx=list.indexOf(id);
    if(idx===-1) list.unshift(id); else list.splice(idx,1);
    _writeSet(FAVORITES_KEY,list);
  }
  function _pushRecent(id){
    let list=_getRecents();
    list=list.filter(function(x){ return x!==id; });
    list.unshift(id);
    if(list.length>MAX_RECENTS) list=list.slice(0,MAX_RECENTS);
    _writeSet(RECENTS_KEY,list);
  }

  // ---- DOM build ----
  function mount(container){
    if(!container) return null;
    mountedContainer=container;
    container.innerHTML='';
    _root=document.createElement('div');
    _root.className='sticker-studio';

    // Header — title + search.
    const header=document.createElement('div');
    header.className='sticker-studio-header';
    const title=document.createElement('div');
    title.className='sticker-studio-title';
    title.textContent='Sticker Studio';
    header.appendChild(title);

    const searchWrap=document.createElement('div');
    searchWrap.className='sticker-studio-search-wrap';
    const searchIcon=document.createElement('span');
    searchIcon.className='sticker-studio-search-icon';
    searchIcon.textContent='🔍';
    searchWrap.appendChild(searchIcon);
    _searchEl=document.createElement('input');
    _searchEl.type='text';
    _searchEl.className='sticker-studio-search';
    _searchEl.placeholder='Search Stickers...';
    _searchEl.addEventListener('input',function(){
      searchQuery=_searchEl.value||'';
      _renderGrid();
    });
    searchWrap.appendChild(_searchEl);
    header.appendChild(searchWrap);
    _root.appendChild(header);

    // Categories — horizontally-wrapping chip row so the grid below
    // gets most of the panel real estate.
    _categoriesEl=document.createElement('div');
    _categoriesEl.className='sticker-studio-categories';
    _buildCategories();
    _root.appendChild(_categoriesEl);

    // Grid host.
    const gridShell=document.createElement('div');
    gridShell.className='sticker-studio-grid-shell';
    _gridEl=document.createElement('div');
    _gridEl.className='sticker-studio-grid';
    gridShell.appendChild(_gridEl);
    _emptyEl=document.createElement('div');
    _emptyEl.className='sticker-studio-empty hidden';
    gridShell.appendChild(_emptyEl);
    _root.appendChild(gridShell);

    container.appendChild(_root);
    _renderGrid();
    return _root;
  }

  function _buildCategories(){
    if(!_categoriesEl || typeof StickerLibrary==='undefined') return;
    _categoriesEl.innerHTML='';
    const cats=StickerLibrary.getCategories();
    cats.forEach(function(c){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='sticker-studio-category';
      btn.setAttribute('data-category',c.id);
      btn.title=c.label;
      const e=document.createElement('span');
      e.className='sticker-studio-category-emoji';
      e.textContent=c.emoji;
      btn.appendChild(e);
      const n=document.createElement('span');
      n.className='sticker-studio-category-name';
      n.textContent=c.label;
      btn.appendChild(n);
      btn.addEventListener('click',function(){
        activeCategoryId=c.id;
        _refreshCategoryActive();
        _renderGrid();
      });
      _categoriesEl.appendChild(btn);
    });
    _refreshCategoryActive();
  }

  function _refreshCategoryActive(){
    if(!_categoriesEl) return;
    _categoriesEl.querySelectorAll('.sticker-studio-category').forEach(function(b){
      b.classList.toggle('active',b.getAttribute('data-category')===activeCategoryId);
    });
  }

  // Decides which stickers to show: search wins, otherwise current
  // category (with virtual categories resolved against localStorage).
  function _resolveStickers(){
    if(typeof StickerLibrary==='undefined') return [];
    if(searchQuery && searchQuery.trim().length>0){
      return StickerLibrary.search(searchQuery);
    }
    if(activeCategoryId==='favorites'){
      const ids=_getFavorites();
      const list=[];
      ids.forEach(function(id){
        const st=StickerLibrary.getById(id);
        if(st) list.push(st);
      });
      return list;
    }
    if(activeCategoryId==='recents'){
      const ids=_getRecents();
      const list=[];
      ids.forEach(function(id){
        const st=StickerLibrary.getById(id);
        if(st) list.push(st);
      });
      return list;
    }
    return StickerLibrary.getByCategory(activeCategoryId);
  }

  function _renderGrid(){
    if(!_gridEl) return;
    _gridEl.innerHTML='';
    const list=_resolveStickers();
    if(!list || list.length===0){
      _showEmpty();
      return;
    }
    _hideEmpty();
    list.forEach(function(st){
      _gridEl.appendChild(_buildStickerCard(st));
    });
  }

  function _showEmpty(){
    if(!_emptyEl || !_gridEl) return;
    _gridEl.classList.add('hidden');
    _emptyEl.classList.remove('hidden');
    _emptyEl.innerHTML='';
    const art=document.createElement('div');
    art.className='sticker-studio-empty-art';
    // Friendly illustration via emoji — no clipart browser feel.
    art.textContent='🪄';
    _emptyEl.appendChild(art);
    const msg=document.createElement('div');
    msg.className='sticker-studio-empty-msg';
    if(searchQuery && searchQuery.trim().length>0){
      msg.textContent='No stickers match "'+searchQuery+'".';
    }else if(activeCategoryId==='favorites'){
      msg.textContent='No favorites yet. Tap the ❤ on any sticker to save it.';
    }else if(activeCategoryId==='recents'){
      msg.textContent='No recent stickers yet. Pick one to get started!';
    }else{
      msg.textContent='No stickers here yet.';
    }
    _emptyEl.appendChild(msg);
  }
  function _hideEmpty(){
    if(_emptyEl) _emptyEl.classList.add('hidden');
    if(_gridEl) _gridEl.classList.remove('hidden');
  }

  function _buildStickerCard(st){
    const card=document.createElement('button');
    card.type='button';
    card.className='sticker-card';
    card.setAttribute('data-sticker-id',st.id);
    card.title=st.name;

    // Preview — uses the SVG data URL so the same artwork the canvas
    // draws is what the child sees in the grid (no skew).
    const pv=document.createElement('div');
    pv.className='sticker-card-preview';
    const img=document.createElement('img');
    img.alt=st.name;
    img.loading='lazy';
    img.src=StickerLibrary.getDataURL(st.id);
    pv.appendChild(img);
    card.appendChild(pv);

    const name=document.createElement('div');
    name.className='sticker-card-name';
    name.textContent=st.name;
    card.appendChild(name);

    // Favorite toggle — a heart that lights up. Tapping the heart never
    // triggers an insert.
    const fav=document.createElement('span');
    fav.className='sticker-card-fav';
    fav.setAttribute('role','button');
    fav.setAttribute('aria-label','Favorite');
    fav.textContent=_isFavorite(st.id)?'❤':'♡';
    fav.classList.toggle('is-fav',_isFavorite(st.id));
    fav.addEventListener('click',function(e){
      e.stopPropagation();
      _toggleFavorite(st.id);
      fav.textContent=_isFavorite(st.id)?'❤':'♡';
      fav.classList.toggle('is-fav',_isFavorite(st.id));
      // If we're showing Favorites the grid needs to re-render so the
      // removed card disappears immediately.
      if(activeCategoryId==='favorites' && !searchQuery) _renderGrid();
    });
    card.appendChild(fav);

    card.addEventListener('click',function(){
      _insertSticker(st);
    });
    return card;
  }

  // ---- Insert ----
  // Sprint 6.6.1 — explicit ordering. We insert + persist + repaint
  // FIRST, then hand off selection LAST so the Card Designer's auto
  // tab-switch + refresh are the last DOM mutations of this user
  // gesture. Nothing that fires later can race the right pane back to
  // a different tab.
  // Honour World-Owned Object Commitments sprint — Decoration Slot's
  // "+ Add your own decoration here" opens this exact Studio, but the
  // very next sticker placed should land near the reserved slot's own
  // position instead of dead-center. A one-shot seed (consumed and
  // cleared by the very next insert) rather than a persistent mode,
  // since only that one placement should be affected — every other
  // Add-a-Sticker flow keeps its ordinary centered default untouched.
  let _nextPlacementSeed=null;
  function setNextPlacementSeed(centerX,centerY){
    _nextPlacementSeed=(typeof centerX==='number' && typeof centerY==='number') ? {x:centerX,y:centerY} : null;
  }

  function _insertSticker(st){
    if(!host || typeof host.getCurrentSlide!=='function') return;
    const slide=host.getCurrentSlide();
    if(!slide) return;
    if(typeof SceneEngine==='undefined') return;
    const seed=_nextPlacementSeed;
    _nextPlacementSeed=null;
    const inst=SceneEngine.addSticker(slide,{
      stickerId:st.id,
      x:seed?seed.x:INSERT_X, y:seed?seed.y:INSERT_Y,
      w:INSERT_W, h:INSERT_H
    });
    if(!inst) return;
    _pushRecent(st.id);

    // Persist + redraw + thumbnails first so the canvas paints the
    // sticker before the selection chrome lands on top.
    if(typeof host.redraw==='function'){ try{ host.redraw(); }catch(e){} }
    if(typeof host.markDirty==='function'){ try{ host.markDirty(); }catch(e){} }
    if(typeof host.refreshThumbnails==='function'){ try{ host.refreshThumbnails(); }catch(e){} }

    // Selection LAST. This is what activates the Card Designer tab and
    // surfaces the Sticker controls — by putting it at the end we make
    // sure no follow-up refresh can undo the routing.
    if(typeof host.setSelectedSticker==='function'){
      try{ host.setSelectedSticker(inst.id,'sticker'); }catch(e){}
    }
  }

  function configure(cfg){ host=cfg||null; }
  function refresh(){
    // External nudge to repaint the grid (e.g. when favorites change
    // elsewhere).
    _renderGrid();
  }
  function unmount(container){
    if(!container) return;
    container.innerHTML='';
    if(mountedContainer===container){
      mountedContainer=null;
      _root=null; _gridEl=null; _searchEl=null; _categoriesEl=null; _emptyEl=null;
    }
  }

  const api={
    mount:mount,
    unmount:unmount,
    configure:configure,
    refresh:refresh,
    setNextPlacementSeed:setNextPlacementSeed
  };
  try{ window.StickerStudio=api; }catch(e){}
  return api;
})();
