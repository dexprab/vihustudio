// PublishStudio — Sprint 8.1.
//
// The final chapter of creating a story. Publish Studio is a temporary
// full-screen modal (same lazy lifecycle as Picture Studio). It owns
// four stages — Read → Almost Ready → Publishing → Celebration — and
// always returns control to the editor exactly as the child left it.
//
// Product principles (locked):
//   * Children publish books. Software exports files. Every visible
//     label avoids technical jargon.
//   * The editor is the live preview; Publish Studio NEVER paints into
//     the editor canvas, NEVER persists studio-only state to the
//     project, and NEVER mounts a permanent tab.
//   * WYSIWYE is non-negotiable. Every page rendered inside the studio
//     flows through `SlideRenderer.buildPayload → SlideRenderer.render`
//     — the same path the editor + PageOps export already use.
//
// Sprint 8.1.1 ships the shell: modal scaffold, stage state machine,
// keyboard + ✕ close, and a Publish button in the editor header. Stage
// bodies are placeholders that subsequent milestones (8.1.2 Read,
// 8.1.3 Almost Ready, 8.1.4 Publishing, 8.1.5 Celebration) light up.
const PublishStudio=(function(){
  const STAGES={
    READ:'read',
    ALMOST_READY:'almost-ready',
    PUBLISHING:'publishing',
    CELEBRATION:'celebration'
  };

  let _modal=null;
  let _root=null;
  let _bodies={};   // { read, 'almost-ready', publishing, celebration }
  let _state={ stage:STAGES.READ };
  let _opened=false;

  // -------- DOM build (lazy; reuses the same modal across opens) ----
  function _ensureModal(){
    if(_modal) return _modal;
    _modal=document.createElement('div');
    _modal.className='publish-studio-modal hidden';
    // Full-screen modal has no visible backdrop area — children close
    // via the ✕ in the header or by pressing Escape.

    _root=document.createElement('div');
    _root.className='publish-studio';

    // Header — just the studio title and a close affordance. Stage
    // chrome (back-to-reading, etc.) lives inside each stage body so
    // every stage controls its own framing.
    const header=document.createElement('div');
    header.className='publish-studio-header';
    const brand=document.createElement('div');
    brand.className='publish-studio-brand';
    brand.textContent='📖 Publish Studio';
    header.appendChild(brand);
    const close=document.createElement('button');
    close.type='button';
    close.className='publish-studio-close';
    close.setAttribute('aria-label','Close');
    close.textContent='✕';
    close.addEventListener('click',function(){ _close(); });
    header.appendChild(close);
    _root.appendChild(header);

    // Stage host. Each stage gets its own pre-built body that the
    // shell shows / hides; building once avoids tearing down expensive
    // chrome (canvases, confetti, etc.) between stage transitions.
    const stage=document.createElement('div');
    stage.className='publish-studio-stage';
    _bodies[STAGES.READ]=_buildReadBody();
    _bodies[STAGES.ALMOST_READY]=_buildAlmostReadyBody();
    _bodies[STAGES.PUBLISHING]=_buildPublishingBody();
    _bodies[STAGES.CELEBRATION]=_buildCelebrationBody();
    Object.keys(_bodies).forEach(function(k){ stage.appendChild(_bodies[k]); });
    _root.appendChild(stage);

    _modal.appendChild(_root);
    document.body.appendChild(_modal);
    return _modal;
  }

  // Placeholder bodies — Sprint 8.1.1 just establishes the slots so
  // future milestones can light them up without touching the shell.
  function _placeholderBody(klass,label){
    const el=document.createElement('section');
    el.className='publish-studio-body '+klass+' hidden';
    const inner=document.createElement('div');
    inner.className='publish-studio-placeholder';
    inner.textContent=label;
    el.appendChild(inner);
    return el;
  }
  function _buildReadBody(){
    return _placeholderBody('publish-studio-body-read','📖 Read My Story · coming next');
  }
  function _buildAlmostReadyBody(){
    return _placeholderBody('publish-studio-body-almost','✨ Almost Ready · coming next');
  }
  function _buildPublishingBody(){
    return _placeholderBody('publish-studio-body-publishing','📕 Painting your book · coming next');
  }
  function _buildCelebrationBody(){
    return _placeholderBody('publish-studio-body-celebration','🎉 Celebration · coming next');
  }

  // -------- Stage state machine -------------------------------------
  function _setStage(next){
    if(!_modal) return;
    _state.stage=next;
    Object.keys(_bodies).forEach(function(k){
      _bodies[k].classList.toggle('hidden', k!==next);
    });
  }

  // -------- Lifecycle ------------------------------------------------
  function open(){
    _ensureModal();
    if(!_hasSlides()){
      // Nothing to publish yet. Nudge inside the editor — Sprint 8.1.1
      // keeps the studio's empty-state simple while the rest of the
      // stages light up. A future milestone can swap this for a
      // friendlier in-studio empty state.
      try{ alert('Add a page to your story before you publish.'); }catch(e){}
      return;
    }
    _state={ stage:STAGES.READ };
    _setStage(STAGES.READ);
    _modal.classList.remove('hidden');
    _opened=true;
    document.addEventListener('keydown',_onKeyDown);
  }

  function close(){ _close(); }

  function _close(){
    if(!_modal) return;
    _modal.classList.add('hidden');
    _opened=false;
    document.removeEventListener('keydown',_onKeyDown);
  }

  function _onKeyDown(e){
    if(!_opened) return;
    if(e.key==='Escape'){ e.preventDefault(); _close(); }
  }

  function _hasSlides(){
    return typeof AppState!=='undefined'
      && Array.isArray(AppState.slides)
      && AppState.slides.length>0;
  }

  function isOpen(){ return _opened; }
  function getStage(){ return _state.stage; }

  const api={
    STAGES:STAGES,
    open:open,
    close:close,
    isOpen:isOpen,
    getStage:getStage,
    // Internal — exposed for the test harness only.
    _setStage:_setStage
  };
  try{ window.PublishStudio=api; }catch(e){}
  return api;
})();
