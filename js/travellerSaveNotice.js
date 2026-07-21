// travellerSaveNotice.js — "for a traveller who once start creating we
// need to tell if they do not publish their creation might get lost.
// this will help us in keeping data clean."
//
// A real, already-shipped risk this module simply makes visible instead
// of leaving it a silent surprise: the Traveller Privacy sprint
// (js/gatewaySequence.js) wipes an unclaimed Traveller's own "My
// Projects" list (js/creatorProjectStore.js) the next time a genuinely
// NEW browser session starts as a Traveller again. A Creator (someone
// who has claimed a Magic Card) never has this risk — their projects
// are backed up via Magic Card Cloud Identity + js/creatorProjectSync.js
// — so this notice is scoped to exactly the population that actually
// needs the warning.
//
// Shown only when ALL of:
//   - no Magic Card is active (MagicCard.getActive() falsy — a
//     Traveller, not a Creator).
//   - the active project has at least one real page ("once start
//     creating" — AppState.slides.length>0, read via host.getSlides()).
//   - it hasn't already been published this browser tab session
//     (markPublished() below — no point nagging someone who just did
//     the exact thing being suggested).
//   - it wasn't dismissed this tab session (sessionStorage, so it
//     reappears on a genuinely new session — matching the exact
//     "reappears next session" convention the Traveller Privacy sprint's
//     own clearAll() already established, rather than a permanent,
//     one-time-forever dismiss).
//
// A thin host-binding module (configure({...})), matching the
// js/objectStrip.js / js/contextPanel.js / js/pageRuntime.js pattern —
// no new architecture, just one more small panel reading the same
// AppState/MagicCard state everything else already reads. Deliberately
// a floating notice (position:fixed, no layout height reserved) rather
// than a permanent banner slotted into .workspace's own fixed
// calc(100vh - 64px) grid — this codebase has hit that exact class of
// height-overflow bug (a fixed-height ancestor silently clipping a new
// sibling) more than once, and a toast avoids it entirely.
const TravellerSaveNotice=(function(){
  'use strict';

  const DISMISS_KEY='vihu-traveller-save-notice-dismissed';
  let host={ getSlides:function(){ return []; } };
  let _publishedThisSession=false;
  let _el=null;

  function configure(bindings){ host=Object.assign({},host,bindings||{}); }

  function _dismissedThisSession(){
    try{ return sessionStorage.getItem(DISMISS_KEY)==='1'; }
    catch(e){ return false; }
  }
  function _dismiss(){
    try{ sessionStorage.setItem(DISMISS_KEY,'1'); }catch(e){}
    refresh();
  }

  // Called once Publish actually succeeds this session — see
  // js/publishStudio.js's _finalizePublish(). Hides the notice for the
  // rest of the tab session; a fresh session (a real reload) re-checks
  // from scratch, so a later, still-unpublished edit on the SAME
  // project would show it again only after that reload, matching how
  // every other Traveller-session-scoped state in this codebase works.
  function markPublished(){
    _publishedThisSession=true;
    refresh();
  }

  function _isTraveller(){
    try{ return !(typeof MagicCard!=='undefined' && MagicCard.getActive()); }
    catch(e){ return true; }
  }

  function _ensureDom(){
    if(_el) return _el;
    _el=document.createElement('div');
    _el.className='traveller-save-notice hidden';
    _el.innerHTML=
      '<span class="traveller-save-notice-icon" aria-hidden="true">🌱</span>'+
      '<span class="traveller-save-notice-text">You’re creating as a Traveller — publish your adventure (or claim your Magic Card) to make sure it’s kept safe.</span>'+
      '<button type="button" class="traveller-save-notice-publish">📖 Publish Now</button>'+
      '<button type="button" class="traveller-save-notice-dismiss" title="Dismiss for now" aria-label="Dismiss">✕</button>';
    document.body.appendChild(_el);
    const publishBtn=_el.querySelector('.traveller-save-notice-publish');
    if(publishBtn){
      publishBtn.addEventListener('click',function(){
        const realBtn=document.getElementById('publishBtn');
        if(realBtn) realBtn.click();
      });
    }
    const dismissBtn=_el.querySelector('.traveller-save-notice-dismiss');
    if(dismissBtn) dismissBtn.addEventListener('click',_dismiss);
    return _el;
  }

  function _shouldShow(){
    if(!_isTraveller()) return false;
    if(_publishedThisSession) return false;
    if(_dismissedThisSession()) return false;
    let slides=[];
    try{ slides=host.getSlides()||[]; }catch(e){}
    return Array.isArray(slides) && slides.length>0;
  }

  function refresh(){
    const el=_ensureDom();
    el.classList.toggle('hidden',!_shouldShow());
  }

  return {
    configure:configure,
    refresh:refresh,
    markPublished:markPublished
  };
})();
try{ window.TravellerSaveNotice=TravellerSaveNotice; }catch(e){}
