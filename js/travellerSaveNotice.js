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
// Copy note, REWRITTEN. It used to say the only way to become a Creator
// was the ceremony offered automatically on a first Publish, so the
// notice named exactly one action: Publish. Both halves are now wrong.
//
// Becoming a Creator is FINISHING the first story (Canon 4, amended):
// completing Rite I awakens the card, and js/studioRite.js offers it on
// any Studio entry where the rite is complete and no card exists. So a
// child who is going to get a card has one before this notice could
// ever show, and pressing Finish Story would grant them nothing.
//
// WHICH LEAVES EXACTLY ONE AUDIENCE, and it is a real one:
// `_finishAwakening()` marks the ceremony offered whatever the outcome —
// Claimed, Maybe Later or Just Exploring — so a child who said Maybe
// Later is never offered again. And the header badge is hidden while no
// card is active. No badge, no second offer, no route: a dead end.
//
// So this notice is now that route. Its button opens the ceremony
// directly rather than clicking Finish Story — deliberately bypassing
// `shouldOfferAwakening()`, because that guard exists to stop the
// product ASKING twice, and this is the child asking.
//
// Placement note: originally a position:fixed floating toast anchored to
// the viewport — moved into normal document flow, mounted inside
// .right-sidebar as a sibling of #contextPanelRoot (see _ensureDom()),
// after a real screenshot showed the floating toast visually colliding
// with the Object Strip's cards/scroll-arrows at the bottom of the
// canvas column. .right-sidebar already has overflow-y:auto (a safe,
// scrollable container for new in-flow content) and is never wiped by
// ContextPanel.refresh()'s own panelRoot.innerHTML='' calls, since this
// element is inserted as ContextPanel's SIBLING, never its child — a
// thin host-binding module (configure({...})), matching the
// js/objectStrip.js / js/contextPanel.js / js/pageRuntime.js pattern —
// no new architecture, just one more small panel reading the same
// AppState/MagicCard state everything else already reads.
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
      '<div class="traveller-save-notice-row">'+
        '<span class="traveller-save-notice-icon" aria-hidden="true">🌱</span>'+
        '<span class="traveller-save-notice-text">You’re creating as a Traveller. Your stories live only on this computer for now.</span>'+
        '<button type="button" class="traveller-save-notice-dismiss" title="Dismiss for now" aria-label="Dismiss">✕</button>'+
      '</div>'+
      '<button type="button" class="traveller-save-notice-publish">✨ Make My Magic Card</button>';

    // Mount as a normal, in-flow FIRST child of .right-sidebar — never
    // document.body/position:fixed (see the Placement note above for
    // why that collided with the Object Strip). Deliberately always
    // .right-sidebar's very first child (before .tabs, before
    // #contextPanelRoot) rather than "right after .tabs" — .tabs is
    // itself always display:none (a permanent base rule, unrelated to
    // this notice), and inserting relative to it turned out to be
    // boot-order-dependent: if this ran before ContextPanel.init() had
    // created #contextPanelRoot, a later ContextPanel.init() call would
    // insert its own root using that same "right after .tabs" logic and
    // push this notice below the whole Context Panel instead of above
    // it. Being unconditionally first sidesteps that race entirely and
    // is completely unaffected by ContextPanel.refresh()'s frequent
    // panelRoot.innerHTML='' calls, since this element lives outside
    // #contextPanelRoot entirely.
    const rightSidebar=document.querySelector('.right-sidebar');
    if(rightSidebar){
      rightSidebar.insertBefore(_el,rightSidebar.firstChild);
    }else{
      // Defensive fallback only — should not happen in production,
      // .right-sidebar is always present once the app has booted.
      document.body.appendChild(_el);
    }

    const publishBtn=_el.querySelector('.traveller-save-notice-publish');
    if(publishBtn){
      publishBtn.addEventListener('click',function(){
        // The ceremony itself, not Finish Story. Finishing another story
        // grants this child nothing — the card comes from the first one,
        // and theirs has already been finished and declined.
        try{
          if(typeof MagicCardUI!=='undefined' && MagicCardUI.showAwakening){
            MagicCardUI.showAwakening(function(){ refresh(); });
            return;
          }
        }catch(e){}
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
