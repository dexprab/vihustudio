// studioRite.js — Studio Rite (docs/COMPANION_CANON.md → Canon 6).
//
// The creator's first chapter inside VihuPlanet: a mandatory experience
// every user completes exactly once, before Studio Home is reachable.
// Lumo guides it; the Story Egg accompanies through animation only and
// never speaks (Canon 1, unchanged). Under the rewritten Decision 7 it
// ends by asking whether the child would like their first story to
// become part of VihuPlanet; saying yes is what opens the Creator
// Ceremony (Canon 4). The child-facing word "Publish" never appears
// here — internally the existing Publish path is used, unchanged
// (Canon 7). NOTE: the sharing beat is designed, not yet built; the
// current COMPLETION screen still ends the Rite without it.
//
// The script this realises is docs/STUDIO_RITE_SCRIPT.md; the phase
// plan is docs/STUDIO_RITE_PROPOSAL.md Part III.
//
// This module is deliberately a thin GATE, not a new boot system. It
// owns exactly two things: "has this user completed the Rite?" and, if
// not, running it. js/app.js's own _runBootstrap()/_afterGateway() keep
// owning boot itself — the Rite simply sits between the Gateway handing
// off and _beginBoot() being called.
//
// The Rite hands off to the Studio PART WAY through — at the moment the
// child says yes — because Acts III and IV happen in the real editor,
// not a tutorial copy of one. Everything after that plays as a quiet
// band along the bottom of the live Studio.
//
// Completion is written in exactly one place: the end of a genuine full
// run, after the child has actually made and named a story. No partial,
// abandoned or failed Rite ever unlocks the Studio.
const StudioRite=(function(){
  // Device-scoped. Deliberately NOT cloud-persisted: the only users for
  // whom a device change matters are Creators, and a Creator is already
  // grandfathered by their claimed Magic Card (below), which survives
  // device changes through the existing identity flow. A Traveller who
  // clears storage repeats the Rite — the same thing that already
  // happens to their local projects (js/projectManager.js's own "100%
  // local forever" guarantee).
  // Owned by this module and read raw in exactly one other place —
  // js/travellerReset.js, which has to be able to clear it on a page
  // that does not load this file at all (VihuPlanet). Exported as
  // FLAG_KEY below so that duplication is a reference rather than a
  // second literal; the fallback string there is the safety net, and
  // both ends say so. Same shape as js/studioEntry.js's own documented
  // duplication with the inline gate in studio.html.
  const FLAG='vihu.studioRite.v1';

  function _flagSet(){
    try{ return localStorage.getItem(FLAG)==='1'; }catch(e){ return false; }
  }

  // The grandfather clause (Studio Rite Decision 8 — "reuse existing
  // platform mechanisms... avoid introducing migration systems").
  // A claimed Magic Card is proof the user completed a Creator Ceremony,
  // which by definition means they published a real story and were
  // chosen by a Story Companion — they demonstrably hold the vocabulary
  // the Rite exists to teach. Already true for every existing Creator,
  // already false for every Traveller, and already loaded at boot: no
  // backfill, no schema change, no migration.
  //
  // THE ACTIVE CARD, NOT EVERY CARD ON THE DEVICE. This asked
  // `MagicCard.list().length>0` — "does anybody here hold a card" — and
  // that is a fact about the LAPTOP, not about the child in front of
  // it. On a shared machine an older sibling's card grandfathered a
  // brand-new child straight past the Rite: measured, with no card
  // active and the Rite never taken, isComplete() answered true.
  //
  // The Ether does not protect against it, which is the part worth
  // remembering: VihuPlanet decides who is ACTIVE, and never changes
  // what is stored, so a child can be correctly unrecognised at the
  // door and still be treated here as somebody else.
  //
  // Same bug class as Decision 19 ("the store was never Creator-scoped
  // ... it is per-DEVICE"), and the same fix: ask about the child.
  // getActive() resolves a stale pointer to null on its own, so a card
  // that no longer exists cannot grandfather anybody either.
  function _isCreator(){
    try{
      return typeof MagicCard!=='undefined'
        && typeof MagicCard.getActive==='function'
        && !!MagicCard.getActive();
    }catch(e){ return false; }
  }

  // DISCLOSED, because it is the half that cannot be fixed here. The
  // flag is per-DEVICE, and it has to be: it is written before the
  // child has any identity to scope it to — the whole point of the Rite
  // is that they do not have a Magic Card yet. So on a shared machine,
  // a second child arriving after the first has COMPLETED the Rite
  // still inherits an unlocked Studio. Closing that needs the taught-
  // capability record on the card (docs/STUDIO_RITE_LEVELS.md), not a
  // cleverer read of localStorage.
  function isComplete(){ return _flagSet()||_isCreator(); }

  // True from the moment the Rite starts until it has fully finished.
  // js/app.js's _beginBoot() reads this so it never throws the
  // restore-session modal or the normal creation flow over the top of a
  // chapter still in progress — the Rite owns the screen until it ends.
  function isRunning(){ return _running; }
  // The gate the story is standing on right now, or null between beats.
  // Read by wantsRoom() below; see its comment.
  var _awaiting=null;
  // The story this run of the rite is attached to, held out of My
  // Projects until the rite finishes. Null for the mandatory rite,
  // which is never held — see _holdStory().
  var _riteProjectId=null;

  // False for the whole story, true from the finale onward. js/app.js
  // reads it to decide whether the header's two story buttons are
  // asleep — the Rite holds them shut whatever the project looks like,
  // because the story is not finished until Lumo says it is.
  function actionsUnlocked(){ return _actionsUnlocked; }

  function markComplete(){
    try{ localStorage.setItem(FLAG,'1'); }catch(e){}
  }

  // ================================================================
  // WHAT THIS CHILD HAS BEEN TAUGHT
  // ================================================================
  //
  // "the right pane is wrong. it should not have options from rites
  // which are yet to come" — the product owner, looking at the Studio
  // he met the moment Rite I ended. It offered all nine Add tiles,
  // which is Decision 22's opening sentence exactly: *the Rite's
  // reduction outlives the Rite.* A child made their first story in a
  // Studio of five controls and was handed one of forty at the moment
  // they were least equipped to read it. The reduction was right; its
  // lifetime was wrong.
  //
  // WHAT IS STORED IS CAPABILITIES, NEVER A RITE INDEX (Decision 22).
  // Rites will be added, split and reordered over the product's life,
  // so a rite index is a moving reference while a capability is stable.
  // It also settles what happens to a rite abandoned half way: nothing
  // is granted, the rite is still the next one offered, and the child
  // simply takes it again — so there is no partly-finished rite to
  // model, which is what that decision asks for.
  //
  // A grant is `teaches` ∪ `reveals`. Two vocabularies, deliberately
  // both: `teaches` is what the story taught, `reveals` is which
  // controls stand down, and a future rite may well teach something
  // whose control is named differently or not gated at all.
  //
  // IT TRAVELS ON THE MAGIC CARD. A browser-local flag would drop a
  // Creator to Level I on a grandparent's laptop with their own Level
  // III stories in front of them — the failure Decision 19 already had
  // to fix for projects. The device key below is a FALLBACK for the
  // window in which a child has finished a rite and has no card yet,
  // and MagicCard.claim() sweeps it onto the card exactly as it already
  // sweeps their projects and their library.
  var TAUGHT_KEY='vihu-rite-taught';

  function _deviceTaught(){
    try{
      var raw=localStorage.getItem(TAUGHT_KEY);
      if(!raw) return null;
      var v=JSON.parse(raw);
      return Array.isArray(v) ? v : null;
    }catch(e){ return null; }
  }
  function _writeDeviceTaught(list){
    try{ localStorage.setItem(TAUGHT_KEY,JSON.stringify(list||[])); }catch(e){}
  }

  // The card first, the device second. Null — from EITHER — means "no
  // record at all", which is not the same as "taught nothing"; see
  // taught() below.
  function _storedTaught(){
    try{
      if(typeof MagicCard!=='undefined' && typeof MagicCard.getActive==='function'
         && MagicCard.getActive() && typeof MagicCard.taught==='function'){
        var t=MagicCard.taught();
        if(Array.isArray(t)) return t;
        return null;
      }
    }catch(e){}
    return _deviceTaught();
  }

  // GRANDFATHERED BY THE ABSENCE OF A RECORD, not by holding a card.
  //
  // Decision 22 says existing Creators are grandfathered "by their
  // claimed Magic Card", and that test DIED when Decision 8 was amended:
  // a card is now minted the moment Rite I completes, so "holds a card"
  // is true of every brand-new child and would grandfather the entire
  // population this feature is for. The honest signal is the record
  // itself. After this ships, finishing any rite writes one — so a
  // Studio that has been used, with no record anywhere, is by
  // construction somebody who was here before it existed. They keep
  // every control they have had for weeks, which is what that clause
  // was protecting.
  //
  // Fail-open in the same direction everywhere else: an unreadable
  // browser, a platform that never returned the column, a card recalled
  // onto a device whose deployment predates the migration — all read as
  // "no record", and nobody is ever quietly stripped of a control.
  //
  // LEGACY IS A CAPABILITY, and it has to be, because it must survive
  // the child taking a rite. The first version of this widened taught()
  // for anyone with no record — which is right for CONTROLS and wrong
  // for DOORS, and the two are different questions that were being
  // answered by one value:
  //
  //   controls — an existing Creator keeps everything they have had for
  //              weeks (Decision 22), so a missing record must widen.
  //   doors    — that same Creator has never TAKEN Rite II, so the next
  //              door is still waiting for them. Widening here hid the
  //              whole progression from everybody who used the product
  //              before today, which the creation-home suite caught.
  //
  // So `legacy-studio` is recorded alongside the real capabilities the
  // first time a pre-existing Creator finishes any rite. taught() reads
  // it and hands back everything; nextOptIn() ignores it entirely and
  // sees only the rites actually walked. It rides in the same list
  // through the card, the sweep, adopt() and the column with no extra
  // plumbing anywhere — which is the point of putting it there rather
  // than adding a second field to four places that could disagree.
  var LEGACY='legacy-studio';

  function _allCapabilities(){
    var all=[];
    RITES.forEach(function(r){
      (r.teaches||[]).concat(r.reveals||[]).forEach(function(c){
        if(all.indexOf(c)<0) all.push(c);
      });
    });
    return all;
  }

  function isGrandfathered(){
    var t=_storedTaught();
    if(t===null) return true;
    return t.indexOf(LEGACY)>=0;
  }

  // Everything this child can reach. A grandfathered Creator gets the
  // whole vocabulary rather than a flag anybody downstream has to know
  // about, so there is exactly one shape of answer.
  function taught(){
    var t=_storedTaught();
    if(t===null) return _allCapabilities();
    if(t.indexOf(LEGACY)<0) return t.slice();
    var out=t.slice();
    _allCapabilities().forEach(function(c){ if(out.indexOf(c)<0) out.push(c); });
    return out;
  }

  // WAS THIS STUDIO IN USE BEFORE THE RECORD EXISTED?
  //
  // It asked isComplete(), and that was the dead test wearing a
  // different hat. `isComplete()` is `_flagSet() || _isCreator()`, and
  // build 0634 wipes the flag on every arrival — so at the moment
  // _grant runs it means, precisely, "is a Magic Card in hand", which
  // Decision 22 already records as the test that died when the Creator
  // Ceremony moved to Rite I completion.
  //
  // Reported by the product owner: "my studio post rite 1. same issue.
  // am seeing tiles for next rites already activated." A card left
  // active from an earlier run made him a pre-existing Creator by that
  // test, so his brand-new record was stamped `legacy-studio` and
  // taught() handed back the whole vocabulary.
  //
  // The honest signal is the one Decision 22 states: the ABSENCE of a
  // record. Since MagicCard.claim() always stamps an array — even an
  // empty one — a card with no `taught` at all cannot have been minted
  // since this shipped, so it genuinely predates it.
  function _cardPredatesTheRecord(){
    try{
      if(typeof MagicCard==='undefined' || !MagicCard.getActive) return false;
      var card=MagicCard.getActive();
      return !!card && !Array.isArray(card.taught);
    }catch(e){ return false; }
  }

  function _grant(rite){
    if(!rite) return;
    var have=_storedTaught();
    var next;
    if(have!==null){
      next=have.slice();
    }else if(_cardPredatesTheRecord()){
      // No record anywhere, and there is a Magic Card in hand that has
      // none either — so this is somebody who was here before the
      // record existed. Their legacy is written down so it survives
      // this grant, and only their legacy: what they have actually
      // WALKED is this rite and nothing else, which is what decides
      // the next door.
      next=[LEGACY];
    }else{
      // A brand-new child finishing their first story. `_grant` runs
      // before markComplete(), so an empty record here is exactly what
      // it looks like: nothing taught yet.
      next=[];
    }
    (rite.teaches||[]).concat(rite.reveals||[]).forEach(function(c){
      if(next.indexOf(c)<0) next.push(c);
    });
    var onCard=false;
    try{
      if(typeof MagicCard!=='undefined' && typeof MagicCard.getActive==='function'
         && MagicCard.getActive() && typeof MagicCard.setTaught==='function'){
        MagicCard.setTaught(next); onCard=true;
      }
    }catch(e){}
    // Written to the device as well as the card, never instead of it.
    // The card is the record; this is what MagicCard.claim() sweeps for
    // a child who finishes Rite I before the Ceremony hands them one,
    // and it is harmless once a card exists.
    _writeDeviceTaught(next);
    if(!onCard){ /* the sweep on claim() will carry it */ }
    applyTaught();
  }

  // Has this child already been taught everything a rite offers? Used
  // to decide which door Studio Home shows next, so a rite already
  // taken stops being offered without anybody storing a rite id.
  // Deliberately _storedTaught(), never taught(): a door is about which
  // stories this child has WALKED, and `legacy-studio` says nothing
  // about that. No record at all means no rite taken, so the first door
  // is offered — which is the behaviour every existing Creator already
  // has and must keep.
  function _taughtAllOf(rite){
    var have=_storedTaught();
    if(have===null) return false;
    var want=(rite.teaches||[]).concat(rite.reveals||[]);
    for(var i=0;i<want.length;i++){ if(have.indexOf(want[i])<0) return false; }
    return want.length>0;
  }

  // The next opt-in door: the first runnable one whose story this child
  // has not been through. By id and by capability, never by ordinal.
  // Is the next door one the child has already stepped through and not
  // come back out of? The offer reads differently then — a door left
  // open rather than a new one — and nothing else about it changes: one
  // slot, no decline, no dismiss, absent rather than empty.
  //
  // Answered here rather than at the two call sites so "which story
  // belongs to which rite" stays one question with one answer.
  function hasHeldStory(riteId){
    try{
      if(!riteId || typeof CreatorProjectStore==='undefined') return false;
      return !!(CreatorProjectStore.riteStory && CreatorProjectStore.riteStory(riteId));
    }catch(e){ return false; }
  }

  function nextOptIn(){
    for(var i=0;i<RITES.length;i++){
      var r=RITES[i];
      if(r.unlocksStudio || !_runnable(r)) continue;
      if(_taughtAllOf(r)) continue;
      return r.id;
    }
    return null;
  }

  // THE REDUCTION, OUTSIDE THE RITE.
  //
  // Deliberately a SECOND family of classes rather than reusing
  // `studio-rite-shows-*`. During a rite the visible set is the rite's
  // own (accumulated in registry order), and that behaviour is shipped,
  // verified and unchanged by any of this — `studio-gated` is only ever
  // on while no rite is running, so not one in-rite rule is touched.
  //
  // And only capabilities some RUNNABLE rite can hand over are gated.
  // From This World, Voice, Page Style and Page Shape belong to a rite
  // nobody has written, so there is no door to them — hiding them would
  // be the wall Decision 22 forbids rather than the shelf it asks for.
  // They have no `:not(.studio-taught-…)` rule, so they simply stay.
  // The commit that writes that rite and names them in `reveals` closes
  // the tiles and opens the door in the same breath, which is the whole
  // point of the registry being the design.
  // The capabilities the mandatory rite hands over. The one place that
  // answers "what does a card with no record deserve", so the backfill
  // below and any later caller cannot drift apart.
  function _mandatoryCaps(){
    var r=_mandatoryRite();
    if(!r) return [];
    var out=[];
    (r.teaches||[]).concat(r.reveals||[]).forEach(function(c){
      if(out.indexOf(c)<0) out.push(c);
    });
    return out;
  }

  // A card claimed before the record existed has none, and absence means
  // grandfathered — which left the product owner's own identity on the
  // full Studio for good. His decision, on his own fact that no card has
  // started Rite II: stamp what Rite I teaches onto every card standing
  // here now, which is the Studio those cards have actually earned.
  //
  // ONE-SHOT PER DEVICE inside MagicCard, so absence-grandfathering
  // stays the live rule for everything that arrives afterwards — a card
  // recalled onto a deployment with no column still keeps every control.
  //
  // StudioRite says WHAT, MagicCard says WHERE. It is called from
  // applyTaught() because that already runs at the top of the Studio's
  // bootstrap, before anything asks a card what it knows.
  function _backfillCards(){
    try{
      if(typeof MagicCard==='undefined' || !MagicCard.stampMissingTaught) return;
      MagicCard.stampMissingTaught(_mandatoryCaps());
    }catch(e){}
  }

  function applyTaught(){
    _backfillCards();
    try{
      var cl=document.body.classList;
      Array.prototype.slice.call(cl).forEach(function(c){
        if(c.indexOf('studio-taught-')===0) cl.remove(c);
      });
      cl.remove('studio-gated');
      if(_running) return;               // the rite owns the Studio's shape
      if(isGrandfathered()) return;      // nothing is ever taken away
      cl.add('studio-gated');
      taught().forEach(function(c){ cl.add('studio-taught-'+c); });
    }catch(e){}
  }

  // ---------- The script (docs/STUDIO_RITE_SCRIPT.md) ----------
  // Pure data, deliberately — the same discipline
  // CompanionDirector.getCeremonySequence() already uses for the Creator
  // Ceremony. `line` matches the Gateway's own {title,subtitle} shape so
  // the two read as one continuous voice.
  //
  // A SCREEN is a group of lines that appear together, one after
  // another, on their own. The child never clicks to hear the next
  // line — they click (or make something) only to leave the screen.
  // That was direct product feedback: the accumulating conversation
  // should be automatic, and "Move ahead" should appear only after the
  // last line of a screen and take you to the next one.
  //
  // Each screen's lines are cleared when it ends, so the conversation
  // never grows without bound and the stage never reflows.
  //
  // `egg` is always one of the five poses the Rite is allowed
  // (docs/COMPANION_CANON.md -> Canon 6): idle | curious | thinking |
  // excited | sleep. `hatching`/`magic` belong exclusively to the
  // Creator Ceremony and must never appear here.
  const SCREENS=[
    // ---- Act I — Where am I?
    {lines:[
      {lumo:'wave', egg:'idle',
       line:{title:'Welcome to VihuStudio.',
             subtitle:'This is where you make stories.'}},
      {lumo:'talk', egg:'curious', effect:'glow',
       line:{title:'This is your Story Egg.',
             subtitle:'It is yours to look after.'}},
      {lumo:'curious', egg:'idle',
       line:{title:'It will stay with you while you make your story.'}}
     ], bg:true, audio:{id:'riteScreen1',cues:[0,3.14,6.14]}, end:{move:"Let's Begin"}},

    // ---- Act II — Who am I?
    {lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Everyone who comes here is called a Traveller.',
             subtitle:'That is you.'}},
      {lumo:'curious', egg:'curious',
       line:{title:'Travellers make stories.',
             subtitle:'You are going to make one now.'}},
      {lumo:'wave', egg:'excited',
       line:{title:'Nobody knows what is inside a Story Egg.',
             subtitle:'Not even me.'}}
     ], bg:true, audio:{id:'riteScreen2',cues:[0,8.78,14.20]}, end:{choice:'Start My First Story'}, opensStudio:true},

    // ---- The Starter Story: "The Night a Star Came Down"
    // Page 1 — The Falling. Every line: one instruction, one new idea,
    // and the child knows what to do the moment it ends.
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'We are going to make a story about a star that falls out of the sky.',
             subtitle:'Add a star to your page.'}}
     ], audio:{id:'riteScreen3',cues:[0]}, end:{await:'sticker-added'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Stars are hard to see in the daytime.',
             subtitle:'Make the sky dark.'}}
     ], audio:{id:'riteScreen4',cues:[0]}, end:{await:'bg-set'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'Your star is far away up in the sky.',
             subtitle:'Make your star smaller.'}}
     ], audio:{id:'riteScreen5',cues:[0]}, end:{await:'sticker-resized'}, nudgeDelay:0},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Now the star starts to fall.',
             subtitle:'Turn your star a little.'}}
     ], audio:{id:'riteScreen6',cues:[0]}, end:{await:'sticker-rotated'}, nudgeDelay:0},

    // Page 2 — The Finding.
    //
    // The child COPIES the page rather than adding a blank one, and this
    // is a story requirement before it is a teaching one. "+ Add Page"
    // makes an empty page: the star the whole story is about would not
    // be on it, so "Someone comes to find the star" would ask a child to
    // find something that is not there, and page 3's "Move your star up
    // high" would have no star to move at all — an unpassable beat in a
    // mandatory Rite. Copying carries the scene forward, which is also
    // simply how picture books work.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'The star falls down and down.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Your page can make a copy of itself.',
             subtitle:'Copy this page.'}}
     ], audio:{id:'riteScreen7',cues:[0,5.24]}, end:{await:'page-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'This new page is the ground.',
             subtitle:'Choose a colour for the ground.'}}
     ], audio:{id:'riteScreen8',cues:[0]}, end:{await:'bg-set'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'A tree grows here.',
             subtitle:'Add a tree.'}}
     ], audio:{id:'riteScreen9',cues:[0]}, end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Make your tree bigger.'}}
     ], audio:{id:'riteScreen10',cues:[0]}, end:{await:'sticker-resized'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Someone comes to find the star.',
             subtitle:'Add a person or an animal.'}}
     ], audio:{id:'riteScreen11',cues:[0]}, end:{await:'sticker-added'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Good choice.',
             subtitle:'Move them next to the star.'}}
     ], audio:{id:'riteScreen12',cues:[0]}, end:{await:'sticker-moved'}, nudgeDelay:4000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'They want to say something to the star.',
             subtitle:'Add some words.'}}
     ], audio:{id:'riteScreen13',cues:[0]}, end:{await:'text-added'}, nudgeDelay:4000},

    // Page 3 — The Going Home. "Make it morning" used to ask for a new
    // page AND a colour in one line; split in two, one instruction each.
    {band:true, lines:[
      {lumo:'curious', egg:'excited',
       line:{title:'They stayed with the star all night.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Now it is morning.',
             subtitle:'Copy this page again.'}}
     ], audio:{id:'riteScreen14',cues:[0,4.28]}, end:{await:'page-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Make this sky light.'}}
     ], audio:{id:'riteScreen15',cues:[0]}, end:{await:'bg-set'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'The star is strong again.',
             subtitle:'Move your star up high.'}}
     ], audio:{id:'riteScreen16',cues:[0]}, end:{await:'sticker-moved'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'excited',
       line:{title:'The star is going home.',
             subtitle:'Make your star very small.'}}
     ], audio:{id:'riteScreen17',cues:[0]}, end:{await:'sticker-resized'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'Your star is home now.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Your friend is happy.',
             subtitle:'Add a heart or a smiley face.'}}
     ], audio:{id:'riteScreen18',cues:[0,4.66]}, end:{await:'sticker-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Now tell us how the story ends.',
             subtitle:'Add some words.'}}
     ], audio:{id:'riteScreen19',cues:[0]}, end:{await:'text-added'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Every story needs a name.',
             subtitle:'Give your story a name.'}}
     ], audio:{id:'riteScreen20',cues:[0]}, end:{await:'story-named'}, nudgeDelay:12000},

    // Story Play. The child watches their own three pages turn, before
    // any decision about sharing. Not a demonstration of the canonical
    // story — that would make them copy, and would make the closing
    // line ("you did all of it yourself") untrue. This is theirs.
    //
    // `unlock` wakes Play My Story and Share with VihuPlanet, which have
    // been dormant in the header since the Rite began. The Rite no
    // longer turns the pages itself: the child presses the button, and
    // so learns the control they will use for every story after this
    // one. A chapter that teaches through creation should not perform a
    // control on a child's behalf when it can hand it over.
    {band:true, unlock:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Your story is finished.',
             subtitle:'Watch it from the beginning.'}}
     ], audio:{id:'riteScreen21',cues:[0]}, end:{await:'story-played'}, nudgeDelay:2000},

    // The finishing beat. Declining is a real choice: the story stays
    // theirs and the Studio still unlocks.
    //
    // IT WAITED ON SHARING WHILE ITS OWN LINE ASKED FOR FINISHING, and
    // that gap was the whole of "i clicked take my story, its not moving
    // forward towards the magic card part". Sprint VP2 split one act
    // into two and rewrote these lines to say so — Finishing makes a
    // story yours to keep; Sharing sends it to VihuPlanet — but left the
    // gate on `story-shared`. So a child who did exactly what Lumo asked
    // passed nothing: the rite never completed, the Studio never
    // unlocked, and `markComplete()` never ran.
    //
    // That last part is what made it serious. Decision 8's amendment
    // hangs the Magic Card off rite completion precisely so the shy
    // child — the one who finishes and does not share — gets an
    // identity. Builds 0628 and 0629 repaired every link downstream of
    // completion while the gate upstream still demanded a public act, so
    // the child that change exists for was stopped one step earlier than
    // anybody was looking.
    //
    // The control it points at is still the first one the child needs,
    // and it is still only pointed at, never explained (Canon 6).
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Right now your story only lives on this screen.'}},
      {lumo:'curious', egg:'excited',
       line:{title:'Finishing it makes it yours to keep.',
             subtitle:'Tap Finish Story.'}}
     ], audio:{id:'riteScreen22',cues:[0,4.9]}, end:{await:'story-finished', decline:'Not now'}, nudgeDelay:3000},

    // The close.
    {band:true, lines:[
      {lumo:'curious', egg:'excited', effect:'glow',
       line:{title:'You made this story.',
             subtitle:'It was not here before today.'}},
      {lumo:'talk', egg:'idle',
       line:{title:'You did all of it yourself.',
             subtitle:'I only asked the questions.'}},
      {lumo:'wave', egg:'idle',
       line:{title:'Now you know how to make a story.'}}
     ], audio:{id:'riteScreen23',cues:[0,2.5,5.54]}, end:{move:'Into the Studio'}}
  ];

  // The mission, held on screen for the whole story so a child never
  // loses the thread of what they are making. Deliberately a reference,
  // not an instruction — it never competes with the line Lumo is
  // speaking, and it never changes.
  // How long the child has to be still before a beat counts as finished.
  // Long enough to cover the gap between two colour taps or two words of
  // a title; short enough that a child who really has stopped is not
  // left waiting on Lumo.
  // How long a child must be still before the "I did it!" confirmation
  // is OFFERED. Short, because it is not deciding anything -- it only
  // keeps the button from flickering under a hand mid-drag.
  //
  // This replaces a SETTLE_MS of 1800ms that used to ADVANCE the Rite
  // once a child had been still that long. Nothing advances on a timer
  // any more, which is the whole point: a child pausing to think looked
  // exactly like a child who had finished, and Lumo moved on.
  const OFFER_AFTER_MS=500;
  // The child's own voice, like every other button in the Rite
  // ("Let's Begin", "That is my story", "Into the Studio") -- never
  // "Next", which is what a tutorial says.
  const DONE_LABEL='I did it!';
  // The name every project is born with (js/state.js). Read here so a
  // replay can tell "still called what it was called" from "named".
  const DEFAULT_TITLE='My Adventure';
  // Beats with nothing to settle — they happen once, in an instant.
  const DISCRETE={'page-added':1,'story-played':1,'story-shared':1,
                  'blank-page-added':1,'story-finished':1};

  const MISSION='Our story: a star falls from the sky, and someone helps it home.';

  // ---------- "My Little House" (docs/STUDIO_RITE_LEVEL_II_STORY.md) ----------
  // Nineteen beats, taken verbatim from the approved script: the story
  // line is the title, the instruction is the subtitle, exactly as the
  // document lays them out.
  //
  // NO `audio` FIELD ANYWHERE, AND THERE NEVER WILL BE. Stated by the
  // product owner: "for story rite 2 plug the eleven labs lumo voice. we
  // wont be recording it." So these screens fall past _playScreen's
  // `rec` test into _playSpoken(), where Lumo says each line in his own
  // generated voice and the next line follows when he has finished it.
  //
  // Which means there are no cues here, and none are missing. A recorded
  // screen carries a hand-measured offset per line, re-measured whenever
  // a line is re-recorded; a spoken one tells us when it ended. Rewording
  // a line below is therefore a one-line edit with nothing to keep in
  // step — which is the real reason this is a better fit for a rite whose
  // script may still move.
  //
  // Still no placeholder ids, for the original reason: an id naming a
  // file nobody recorded would send LumoVoice hunting on every beat. And
  // if generation is unavailable for any reason, these screens fall back
  // to reading speed exactly as they did before — walkable in silence,
  // as they always were.
  const MISSION_HOUSE='Our story: a little house is built, and someone comes home to it.';

  const SCREENS_HOUSE=[
    // ---- Page one — building the house
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Once upon a time, there was a little patch of land waiting for a story.',
             subtitle:'Choose a colour for the ground.'}}
     ], end:{await:'bg-set'}, nudgeDelay:6000},

    // PAGE SHAPE. Added when the capability moved here (build 0646), for
    // the same reason as My Garden's Voice beat: a rite must teach what
    // it hands over.
    //
    // It sits BEFORE the house rather than after it. This is the rite
    // about building something out of parts, and the first choice any
    // builder makes is how much room there is to build in — a decision
    // that stops being free once there is a house standing on it.
    {band:true, lines:[
      {lumo:'curious', egg:'thinking',
       line:{title:'Some places are tall. Some are wide. This one has not decided yet.',
             subtitle:'Choose the shape of the page.'}}
     ], end:{await:'page-shaped'}, nudgeDelay:8000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Someone was going to live here. But first, they needed a house.',
             subtitle:'Add a square.'}}
     ], end:{await:'shape-added'}, nudgeDelay:6000},

    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'A house needs a roof to keep the rain away.',
             subtitle:'Add a triangle on top.'}}
     ], end:{await:'shape-added'}, nudgeDelay:6000},

    // Unconditional wording — "Roofs are never quite the right size the
    // first time" is about roofs, not about this child's roof. An
    // earlier draft said "that roof looks a little too big", which is
    // Lumo judging work he cannot see.
    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Roofs are never quite the right size the first time.',
             subtitle:'Make it the right size.'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:6000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'The little house was almost ready. But how would anyone get inside?',
             subtitle:'Give it a door.'}}
     ], end:{await:'shape-added'}, nudgeDelay:6000},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'And inside the house, there was no window to look through.',
             subtitle:'Give it a window.'}}
     ], end:{await:'shape-added'}, nudgeDelay:6000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'There was still no way to reach the door.',
             subtitle:'Draw a path to the door.'}}
     ], end:{await:'doodle-added'}, nudgeDelay:6000},

    {band:true, lines:[
      {lumo:'curious', egg:'excited',
       line:{title:'Beside the path, there was a little space waiting for something to grow.',
             subtitle:'Draw something beside the house.'}}
     ], end:{await:'doodle-added'}, nudgeDelay:6000},

    // ---- Page two — who lives there?
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'The little house was ready. But a house is lonely without a story.',
             subtitle:'Give your story a new page.'}}
     ], end:{await:'blank-page-added'}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Morning came, and the new day was waiting outside.',
             subtitle:'Choose a colour for this day.'}}
     ], end:{await:'bg-set'}, nudgeDelay:10000},

    // The two photo beats carry a decline, in the child's own voice.
    // The file browser is a grown-up's interaction, and a beat that
    // stalls until an adult walks past is a beat that strands a child
    // (docs/STUDIO_RITE_LEVEL_II_STORY.md §3). Declining costs the story
    // nothing — the house is no less theirs for having a drawing where a
    // face would go.
    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'And then, someone finally came home. Who could it be?',
             subtitle:'Add a picture of them.'}}
     ], end:{await:'photo-added', decline:"I'll find one later."}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'talk', egg:'excited',
       line:{title:'They had brought their favourite thing with them.',
             subtitle:'Draw it beside them.'}}
     ], end:{await:'doodle-added'}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'curious', egg:'excited',
       line:{title:'Just then, someone came walking up the little path. A visitor!',
             subtitle:'Add a picture of them.'}}
     ], end:{await:'photo-added', decline:"I'll find one later."}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'They reached the door and said something very important.',
             subtitle:'Add some words.'}}
     ], end:{await:'text-added'}, nudgeDelay:10000},

    // ---- Page three — the last day
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'The next morning, something was waiting at the little house.',
             subtitle:'Give your story another page.'}}
     ], end:{await:'blank-page-added'}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'curious', egg:'thinking',
       line:{title:'What do you think happened next?',
             subtitle:'Draw it.'}}
     ], end:{await:'doodle-added'}, nudgeDelay:10000},

    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'Every good story deserves a name. What will you call yours?',
             subtitle:'Give it a name.'}}
     ], end:{await:'story-named'}, nudgeDelay:10000},

    // `unlock` wakes Play My Story and Finish Story, which have been
    // asleep in the header since this story began — the same finale
    // mechanism the first Rite uses, at the same point in the arc.
    {band:true, unlock:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Now let us see what happened at the little house, from the very beginning.',
             subtitle:'Play your story.'}}
     ], end:{await:'story-played'}, nudgeDelay:3000},

    // Finish, NOT share (docs/STUDIO_RITE_LEVEL_II_STORY.md §5). The
    // Creator Ceremony happens once, at the first Rite, as the
    // consequence of a first share; this story ends when the child has
    // their finished story in their hands. Sharing afterwards is theirs
    // to choose, from the celebration, with no ceremony repeated.
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'And just like that, the little house had a story of its own.',
             subtitle:'Finish your story.'}}
     ], end:{await:'story-finished'}, nudgeDelay:3000}
  ];

  // ---------- The rite registry (docs/STUDIO_RITE_LEVELS.md §3) ----------
  // "Build a rite registry, not three levels. Level I/II/III is today's
  // count, not the design." So this is a LIST, and nothing anywhere
  // reads an ordinal out of it: a rite is found by id, the mandatory one
  // is the one that says it unlocks the Studio, and what a rite makes
  // reachable is data on the rite rather than a branch in the code.
  //
  //   id            — stable, never shown to a child.
  //   teaches       — the CAPABILITIES the story teaches, not a level
  //                   number (§4: rites get added, split and reordered;
  //                   a capability is the stable thing). NOTHING PERSISTS
  //                   THIS YET, deliberately — §6 forbids shipping the
  //                   persistence before every rite exists, or a child
  //                   is stranded at the first one with no way forward.
  //   reveals       — what the Studio shows while this rite runs. Each
  //                   entry becomes a `studio-rite-shows-<name>` class on
  //                   <body>, and the reduction's own rules stand down for
  //                   exactly those (css/style.css). The first rite
  //                   reveals nothing, which is precisely the Studio of
  //                   five controls it has always run in.
  //   startsBlank   — this rite opens its own blank story when it begins
  //                   (the first rite does it later, on the screen that
  //                   boots the Studio, and so does not set this).
  //   unlocksStudio — writes the completion flag on a genuine full run.
  //                   Exactly one rite is mandatory; the rest are opt-in
  //                   and store nothing.
  // ---- Rite II: "The Name on the Green" --------------------------------
  //
  // Level II's starter story. The brief it was written from is
  // docs/STUDIO_RITE_LEVEL_II_GARDEN.md; the script and its reasoning
  // are docs/STUDIO_RITE_LEVEL_II_SCRIPT.md.
  //
  // LETTERS FIRST, DRAWING SECOND, by the product owner's decision. The
  // order does more work than it looks: a letter needs a pen and the
  // corner of a page, it comes in one at a time, and it teaches the
  // camera on the smallest possible thing. By the time the story asks
  // for a whole drawing — the errand that really leaves the room — the
  // child has already held paper up to the camera once and watched it
  // work.
  //
  // THE CAMERA IS THE ONLY WAY IN and the Photo tile is never mentioned:
  // it belongs to Level III, and it must not become the escape hatch
  // when a camera is difficult. Both capture flows are camera-only
  // already, so nothing here has to steer around an upload.
  //
  // NO LINE NAMES A CONTROL (Decision 8). And nothing anywhere says that
  // any of this makes the garden in the margins grow (Decision 27) —
  // it will have grown right through this story, and a child noticing
  // that on their own is the whole design.
  const MISSION_GARDEN='Our story: a small green place, a name of your own, and somebody to keep it company.';

  const SCREENS_GARDEN=[
    // ---- Act I — the name
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'At the far end of everywhere there is a small green place.',
             subtitle:'Choose a colour for the ground.'}}
     ], end:{await:'bg-set'}, nudgeDelay:6000},

    // The first letter. The ask is deliberately ONE letter: it is the
    // smallest thing a child can be sent away for, and the camera is
    // learned on it.
    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'Nobody has ever said whose it is.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Things that belong to somebody have their name on them. Written by hand.',
             subtitle:'Write the first letter of your name on paper, and show it to me.'}}
     ], end:{await:'letter-kept'}, nudgeDelay:9000},

    // ONE LETTER AT A TIME, AND THE CHILD SAYS WHEN. Reported by the
    // product owner walking this beat: "if we write all the letters on
    // single paper it will not work." He is right, and it is a fact
    // about the catcher rather than a matter of taste — it is armed for
    // ONE letter (`HandwritingStudio.open({ch})`), reads that letter,
    // and reopens the letters room on its own so the next tile is one
    // tap away. A line asking for "the rest of your name" describes
    // something the tool cannot do.
    //
    // And only the child knows when their name is finished, so this
    // beat cannot count: the gate passes on one more letter and then
    // the Rite's own "I did it!" waits for them, which is exactly the
    // shape asked for. The subtitle invites that press without naming
    // it — the button says what it is, and Lumo does not read out the
    // interface (Decision 8).
    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'That is your letter. Nobody else in the world makes that shape.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'A name needs all of itself.',
             subtitle:'One letter at a time, until your whole name is in your garden. Tell me when it is all there.'}}
     ], end:{await:'letters-grown'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'talk', egg:'happy',
       line:{title:'Now everyone will know.',
             subtitle:'Put your name on the green.'}}
     ], end:{await:'letters-placed'}, nudgeDelay:9000},

    // ---- Act II — somebody to keep it company
    //
    // THE LONG ERRAND. This is the beat where the child leaves the
    // screen, and the wait is written rather than left as dead air —
    // 25 seconds before Lumo says anything at all, because a child who
    // is off finding paper is not stuck and must not be treated as if
    // they were.
    {band:true, lines:[
      {lumo:'curious', egg:'idle',
       line:{title:'It is a lovely green place. It is also very quiet.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Somebody should live here. Somebody nobody has ever seen before.',
             subtitle:'Draw them on paper, and bring them to me. I will wait.'}}
     ], end:{await:'drawing-kept'}, nudgeDelay:25000},

    {band:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'There you are. Nobody has ever made one of those.',
             subtitle:'Let them into the green.'}}
     ], end:{await:'drawing-placed'}, nudgeDelay:9000},

    // Unconditional wording, the same discipline Rite III uses: this is
    // about how big somebody is, never about how big THIS child made
    // them. Lumo does not judge work he cannot see.
    {band:true, lines:[
      {lumo:'talk', egg:'thinking',
       line:{title:'Nobody is ever quite the right size when they first arrive.',
             subtitle:'Make them the size they should be.'}}
     ], end:{await:'sticker-resized'}, nudgeDelay:9000},

    // ---- Act III — and they stayed
    //
    // The page is COPIED rather than added blank, for Rite I's own
    // reason: the green, the name and the new arrival all have to come
    // with it, or the next beat asks a child to move somebody who is
    // not there.
    {band:true, lines:[
      {lumo:'talk', egg:'curious',
       line:{title:'And then it was the next day.'}},
      {lumo:'talk', egg:'curious',
       line:{title:'Your page can make a copy of itself.',
             subtitle:'Copy this page.'}}
     ], end:{await:'page-added'}, nudgeDelay:12000},

    // THE POINT OF THE WHOLE STORY, and it is made without a word about
    // it: the thing the child drew on paper is still here the next day.
    // It stayed. That is what My Garden is, and nothing says so.
    {band:true, lines:[
      {lumo:'happy', egg:'excited',
       line:{title:'They are still here. They live here now.',
             subtitle:'Take them somewhere new.'}}
     ], end:{await:'sticker-moved'}, nudgeDelay:12000},

    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'They found something while you were away.',
             subtitle:'Add whatever they found.'}}
     ], end:{await:'sticker-added'}, nudgeDelay:12000},

    // VOICE. Added when the capability moved here (build 0646), because
    // a rite that hands over a control its own story never mentions is
    // the complaint this whole progression exists to answer.
    //
    // It belongs to THIS story rather than any other: My Garden is about
    // bringing something of the child's own into a page — their letters,
    // their drawing — and their voice is the third thing of theirs a
    // story can carry. It sits here, after the new arrival has been
    // somewhere and found something, because by now there is somebody
    // on the page worth speaking for.
    {band:true, lines:[
      {lumo:'curious', egg:'curious',
       line:{title:'They have not made a single sound since they arrived.'}},
      {lumo:'talk', egg:'excited',
       line:{title:'You know what they sound like. Nobody else does.',
             subtitle:'Say something for them.'}}
     ], end:{await:'voice-added'}, nudgeDelay:15000},

    // ---- Act IV — it is a story now
    {band:true, lines:[
      {lumo:'talk', egg:'happy',
       line:{title:'This is a story about a green place with your name on it.',
             subtitle:'Give your story its name.'}}
     ], end:{await:'story-named'}, nudgeDelay:12000},

    // Ends on PLAYING, never on finishing or sharing. Rite I owns that
    // ending; this rite is opt-in and must not push a child toward
    // giving anything away (Decision 12: finishing and sharing are
    // separate acts, and neither is ever mandatory).
    //
    // `unlock:true` IS THE BEAT, not decoration. The Rite holds Play My
    // Story and Finish Story shut for its whole run — "the story is not
    // finished until Lumo says so" (js/app.js -> refreshStoryActions) —
    // and only a screen carrying this wakes them. Without it this beat
    // asked a child to press a control that was greyed out, which is a
    // rite that cannot be finished. Rite I and Rite III both carry it on
    // their own play beat; this one did not.
    {band:true, unlock:true, lines:[
      {lumo:'celebrate', egg:'excited',
       line:{title:'Let us see it from the beginning.',
             subtitle:'Play your story.'}}
     ], end:{await:'story-played'}, nudgeDelay:6000}
  ];

  const RITES=[
    {id:'the-night-a-star-came-down',
     mission:MISSION,
     screens:SCREENS,
     teaches:['emoji','background','resize','rotate','move','text','copy-page',
              'story-name','play','finish','share'],
     reveals:[],
     unlocksStudio:true},

    // MY GARDEN IS THE SECOND STEP, by the product owner's decision:
    // "lets assign my garden to level 2 and current level 2 becomes
    // level 3." It sits here rather than in a numbered constant because
    // Decision 22 is explicit that the registry, not an ordinal, is the
    // design — moving a rite is moving a line in this array, and
    // everything downstream follows.
    //
    // Its story is written — `SCREENS_GARDEN`, twelve beats, no
    // recordings (docs/STUDIO_RITE_LEVEL_II_SCRIPT.md). It was held here
    // with no screens until then, which made it unrunnable by
    // construction: `_runnable()` below is what every offer and every
    // start goes through, so nothing could point a child at a door that
    // would not open. Writing the story was the only thing that had to
    // change.
    {id:'my-garden',
     mission:MISSION_GARDEN,
     screens:SCREENS_GARDEN,
     // ONE TILE, ONE CAPABILITY. `library` used to be a third id here,
     // for the tile itself, while `garden` and `handwriting` named the
     // two rooms behind it — three entries for what a child sees as one
     // thing. It was also named after a word the product stopped using
     // (Decision 27 renamed My Library to My Garden child-facing and
     // deliberately left every internal id alone). That rule is right
     // for `creatorLibrary.js` and `data-add-id='library'`, which are
     // machinery; it is wrong for a capability id, which is a product
     // design artifact a person reads while deciding what a rite
     // teaches. Collapsed by the product owner's decision.
     //
     // `handwriting` stays: it is a real second room and a later rite
     // may want to hand over letters without drawings, or the reverse.
     // VOICE MOVED HERE from the world tools, by the product owner's
     // decision. It sits well: this is the rite about bringing something
     // of the child's own into a story — their handwriting, their
     // drawing — and their voice is the third thing of theirs a story
     // can carry.
     //
     // DISCLOSED: the script does not teach it yet. `The Name on the
     // Green` is twelve beats about letters and a drawing, and none of
     // them mentions Voice — so a child finishing it gains a tile their
     // story never showed them, which is the same shape of complaint as
     // "they were not part of rite 1", one rite along. Closing that is
     // writing, not code: a beat where the green place gets a sound.
     teaches:['garden','handwriting','voice'],
     reveals:['garden','voice'],
     startsBlank:true,
     unlocksStudio:false},

    {id:'my-little-house',
     mission:MISSION_HOUSE,
     screens:SCREENS_HOUSE,
     // PAGE SHAPE MOVED HERE from the world tools, by the product
     // owner's decision. This is the rite about building something out
     // of parts, so the shape of the thing being built belongs to it.
     //
     // DISCLOSED, same as My Garden's Voice above: `My Little House`
     // has no Page Shape beat, so today it hands over a control its
     // story never mentions.
     teaches:['shapes','doodle','photo','blank-page','page-shape'],
     reveals:['shapes','doodle','photo','blank-page','page-shape'],
     startsBlank:true,
     unlocksStudio:false},

    // THE WORLD TOOLS — PAUSED, and the entry stays exactly because of
    // that. "we will put the world tools on pause. that rite is not
    // needed." — the product owner.
    //
    // Paused is not deleted, and the difference matters. Removing this
    // entry would make `world` a capability NO rite names, and
    // `_allCapabilities()` walks the registry — so a grandfathered
    // Creator would lose the From This World tile they have had all
    // along, and a gated child would have it hidden with nothing
    // anywhere able to hand it back. Keeping the entry with no screens
    // is what holds the tile in the vocabulary while nobody writes its
    // story: `_runnable()` refuses to start it, Studio Home never offers
    // it, and it reveals nothing to any earlier rite.
    //
    // It is also the honest state of the capability. From This World
    // needs a World with collection assets, and every rite deliberately
    // runs on a blank page with none — so there is nothing for a story
    // to teach yet even if somebody wrote one.
    //
    // IT EXISTS NOW BECAUSE ITS CAPABILITIES HAD TO BE NAMED. Reported
    // by the product owner looking at his Studio after the backfill:
    // "remove page shape, from this world, voice from here they were
    // not part of rite 1." They were the last controls left ungated,
    // deliberately — nothing could teach them, so hiding them looked
    // like the wall Decision 22 forbids rather than the shelf it asks
    // for. He read the same screen the other way, and he is right: a
    // Studio that shows a child three controls their story never
    // mentions is not a shelf either.
    //
    // Being in the registry is what keeps this honest. `_allCapabilities`
    // walks EVERY entry, runnable or not, so a grandfathered Creator
    // still keeps all three — without this they would have vanished for
    // the very people that clause protects. And when the story is
    // written, the same line already says which controls it hands over.
    //
    // Page Style rides with the World rather than being named here: it
    // only appears once a World is chosen, and a child at this point has
    // none (Decision 22 — Level I stays on a blank page).
    {id:'the-world-tools',
     mission:null,
     screens:null,
     // Down to one, and it is the one this rite is actually named for:
     // Voice went to My Garden and Page Shape to My Little House, both
     // by the product owner's decision, leaving the World tools holding
     // only the World.
     teaches:['world'],
     reveals:['world'],
     startsBlank:true,
     unlocksStudio:false}
  ];

  // A rite is runnable when somebody has written its story. An entry
  // with no screens is a place in the order, not a thing a child can do.
  function _runnable(r){ return !!(r && r.screens && r.screens.length); }

  function _riteById(id){
    for(let i=0;i<RITES.length;i++){ if(RITES[i].id===id) return RITES[i]; }
    return null;
  }
  // The mandatory one, by what it DOES rather than by its position.
  function _mandatoryRite(){
    for(let i=0;i<RITES.length;i++){ if(RITES[i].unlocksStudio) return RITES[i]; }
    return RITES[0];
  }

  // The stage artwork behind screens 1 and 2. Three extensions are tried
  // in order rather than one canonical name, because the file arrives by
  // upload and "I added it and nothing happened" is a worse failure than
  // two extra HEAD-shaped image loads that miss.
  //
  // Resolution is entirely optional: if none of them load, the overlay
  // keeps its original gradient. That is not a nicety — the Rite is a
  // mandatory gate on a child's first run, so a missing or slow asset
  // must never be able to show them an empty screen.
  // Where the ground actually is in the artwork, measured from the file
  // by sampling its centre column: 1672x941, with the hill crest at
  // 76.62% of the image height (the row where the glowing horizon falls
  // away to dark hillside).
  //
  // This CANNOT be expressed in static CSS. The crest's position ON
  // SCREEN depends on how `cover` crops the image, which depends on the
  // viewport's aspect ratio — at 1160x560 it lands at y=407, and a
  // layout that put the cast at a fixed fraction had them floating 83px
  // above it. So it is computed, and recomputed on resize.
  const STAGE_IMG_W=1672, STAGE_IMG_H=941, STAGE_CREST=0.7662;

  function _horizonY(){
    const vw=window.innerWidth, vh=window.innerHeight;
    const scale=Math.max(vw/STAGE_IMG_W, vh/STAGE_IMG_H);   // background-size:cover
    const sh=STAGE_IMG_H*scale;
    const top=vh-sh;                                        // background-position:… bottom
    return STAGE_CREST*sh+top;
  }

  // Sets the cast's floor to the horizon, then checks whether what has
  // to sit BELOW it — the conversation and the way on — actually fits.
  // On a short window it does not, and Lumo is raised by exactly the
  // shortfall rather than the text being pushed off the bottom of the
  // screen. He ends up a little above the crest there; he is never in
  // the sky, and never standing on top of his own dialogue.
  function _placeHorizon(){
    if(!_els) return;
    try{
      const ov=_els.overlay;
      if(!ov.classList.contains('studio-rite-hasbg')||ov.classList.contains('studio-rite-band')) return;
      const y=Math.round(_horizonY());
      ov.style.setProperty('--rite-horizon',y+'px');
      requestAnimationFrame(function(){
        try{
          if(!_els) return;
          const panel=_els.panel;
          const over=panel.scrollHeight-panel.clientHeight;
          if(over>0) ov.style.setProperty('--rite-horizon',Math.max(120,y-over)+'px');
        }catch(e){}
      });
    }catch(e){}
  }

  const STAGE_BG_CANDIDATES=['assets/rite/stage.webp','assets/rite/stage.jpg','assets/rite/stage.png',
                             // Where the artwork first arrived, kept so an
                             // upload to the old path still works.
                             'assets/rites/screne1-2.webp'];
  let _stageBg=null;      // resolved url, or null once every candidate has failed

  function _resolveStageBg(){
    return new Promise(function(resolve){
      let i=0;
      const tryNext=function(){
        if(i>=STAGE_BG_CANDIDATES.length){ resolve(null); return; }
        const url=STAGE_BG_CANDIDATES[i++];
        const img=new Image();
        // Resolve with the image's OWN absolute src, not the relative
        // path. A relative url() inside a custom property is resolved
        // against the STYLESHEET, so 'assets/rite/stage.png' became
        // 'css/assets/rite/stage.png' and 404'd — while this very
        // Image(), resolved against the document, had loaded it fine.
        img.onload=function(){ resolve(img.src||url); };
        img.onerror=tryNext;
        img.src=url;
      };
      tryNext();
    });
  }

  // Applied per screen, so band mode never inherits it — the dock plays
  // over the live Studio and has no background of its own.
  function _applyStageBg(on){
    if(!_els) return;
    try{
      if(on && _stageBg){
        _els.overlay.style.setProperty('--rite-stage-bg','url("'+_stageBg+'")');
        _els.overlay.classList.add('studio-rite-hasbg');
        _placeHorizon();
        if(!_horizonWatch){
          _horizonWatch=function(){ _placeHorizon(); };
          try{ window.addEventListener('resize',_horizonWatch); }catch(e){}
        }
      }else{
        _els.overlay.classList.remove('studio-rite-hasbg');
      }
    }catch(e){}
  }

  const ASSETS_BASE='assets/';
  const IDLE_DRIFT_MS=20000;  // the Egg drifts to sleep, and wakes on activity
  let _els=null;              // {overlay,bubble,lumoImg,eggImg,particles}
  let _packs={};              // role -> {basePath,pkg}
  let _timer=null;
  let _unobserve=null;
  let _paperGuard=null;       // unsubscribe for the plain-paper observer
  let _bandRO=null;           // ResizeObserver keeping --rite-band-h honest
  // Play My Story and Share with VihuPlanet stay asleep in the header
  // for the whole story and wake at the finale. js/app.js reads this.
  let _actionsUnlocked=false;
  let _horizonWatch=null;     // keeps the cast on the horizon across resizes
  let _yieldTimer=null;       // watches for a modal the Rite must stand behind
  let _growthWatch=null;      // steps the band aside while the Garden grows
  let _cueTimers=[];          // line reveals scheduled against a recording
  let _dockWatch=null;        // resize handler that re-places the dock
  let _dockUnobserve=null;    // page-list observer that re-places the dock
  let _running=false;
  let _voiceId=null;   // the clip currently speaking, so it can be silenced
  let _bgTouched=false; // the child actually used the background control
  let _addPageUsed=false;   // the child actually used the make-a-page control
  let _blankPageSeen=false; // a page arrived with nothing on it (latched)
  let _finishedSeen=false;  // Publish Studio reached its celebration (latched)
  let _rite=null;      // the rite being performed, from RITES below

  function _el(tag,cls){
    const e=document.createElement(tag);
    if(cls) e.className=cls;
    return e;
  }

  // Reuses the Gateway's own greeting-bubble vocabulary
  // (.gateway-greeting-bubble/-title/-subtitle/-in) rather than
  // inventing a second one. Studio Rite "extends the existing Gateway"
  // and the transition must feel seamless — the cheapest and most
  // honest way to achieve that is for Lumo's lines to be literally the
  // same element, styled by the same rules. js/gatewaySequence.js is
  // not modified; only its stylesheet vocabulary is shared.
  function _buildStage(){
    const overlay=_el('div','studio-rite-overlay');
    const panel=_el('div','studio-rite-panel');
    const cast=_el('div','studio-rite-cast');

    const eggWrap=_el('div','studio-rite-egg');
    const eggImg=document.createElement('img');
    eggImg.className='studio-rite-egg-img'; eggImg.alt='';
    eggWrap.appendChild(eggImg);

    const lumoWrap=_el('div','studio-rite-lumo');
    const particles=_el('div','studio-rite-particles');
    particles.setAttribute('aria-hidden','true');
    const lumoImg=document.createElement('img');
    lumoImg.className='studio-rite-lumo-img'; lumoImg.alt='';
    lumoWrap.appendChild(particles);
    lumoWrap.appendChild(lumoImg);

    cast.appendChild(eggWrap);
    cast.appendChild(lumoWrap);

    // A conversation, not a teleprompter. Lines ACCUMULATE — nothing
    // Lumo says is ever taken away — so a child who reads slowly, or is
    // being read to, can look back at what was said instead of racing a
    // timer. Advancing is always the child's own click.
    const mission=_el('div','studio-rite-mission');
    mission.textContent=(_rite&&_rite.mission)||MISSION;
    const convo=_el('div','studio-rite-convo');
    const controls=_el('div','studio-rite-controls');
    panel.appendChild(cast);
    panel.appendChild(mission);
    panel.appendChild(convo);
    panel.appendChild(controls);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return {overlay:overlay,panel:panel,convo:convo,controls:controls,
            mission:mission,lumoImg:lumoImg,eggImg:eggImg,particles:particles};
  }

  function _fetchJSON(url){
    return fetch(url).then(function(r){ return r.ok?r.json():null; }).catch(function(){ return null; });
  }

  // Resolves a registry ROLE to its package, never a hardcoded id —
  // the same rule js/companionDirector.js and js/magicCardUI.js already
  // follow, so a registry edit keeps working with no code change.
  function _loadPack(regList,role){
    const entry=(regList||[]).find(function(e){ return e.role===role; });
    if(!entry) return Promise.resolve(null);
    const basePath=ASSETS_BASE+entry.path;
    return _fetchJSON(basePath+'companion.json').then(function(pkg){
      return pkg?{basePath:basePath,pkg:pkg}:null;
    });
  }

  // A pose DECLARED in companion.json is not a guarantee the file
  // exists — the Story Egg ships 6 of 8 poses, disclosed. Missing art
  // degrades to "leave the previous frame up" rather than a broken
  // image, exactly as CompanionEngine already does for the widget.
  function _setPose(imgEl,pack,pose){
    if(!imgEl||!pack||!pack.pkg||!pack.pkg.states) return;
    const file=pack.pkg.states[pose]||pack.pkg.states[pack.pkg.defaultState];
    if(!file) return;
    const src=pack.basePath+file;
    if(imgEl.getAttribute('src')===src) return;
    imgEl.setAttribute('src',src);
  }

  // Appends one line to the running conversation. Earlier lines stay,
  // dimmed, so the newest is obviously the newest without the others
  // being lost. Reuses the Gateway's own title/subtitle typography so
  // Lumo sounds and looks like the same character throughout.
  // On the artwork screens the conversation is capped at the newest two
  // lines. It has to be: the panel's rows are sized to their content so
  // the cast can reach the horizon, which means a third line grows the
  // conversation and pushes Lumo and the Egg back up off the hill. The
  // pairing is also how the script reads — what was just said, and what
  // is being said now.
  //
  // Only the artwork screens are capped. In band mode the dock scrolls,
  // and on a plain gradient there is no horizon to stand on, so neither
  // has a reason to lose a line.
  const STAGE_VISIBLE_LINES=2;

  function _trimConvo(){
    try{
      if(!_els||!_els.convo) return;
      const ov=_els.overlay;
      if(!ov.classList.contains('studio-rite-hasbg')) return;
      if(ov.classList.contains('studio-rite-band')) return;
      const rows=_els.convo.querySelectorAll('.studio-rite-line');
      for(let i=0;i<rows.length-STAGE_VISIBLE_LINES;i++){
        if(rows[i].parentNode) rows[i].parentNode.removeChild(rows[i]);
      }
    }catch(e){}
  }

  function _appendLine(line){
    if(!_els||!_els.convo||!line) return;
    const prev=_els.convo.querySelectorAll('.studio-rite-line');
    for(let i=0;i<prev.length;i++) prev[i].classList.add('studio-rite-line-past');
    const row=_el('div','studio-rite-line');
    const title=_el('div','gateway-greeting-title');
    title.textContent=line.title;
    row.appendChild(title);
    if(line.subtitle){
      const sub=_el('div','gateway-greeting-subtitle');
      sub.textContent=line.subtitle;
      row.appendChild(sub);
    }
    _els.convo.appendChild(row);
    _trimConvo();
    requestAnimationFrame(function(){
      row.classList.add('studio-rite-line-in');
      try{ _els.convo.scrollTop=_els.convo.scrollHeight; }catch(e){}
    });
  }

  // The one control that moves the Rite forward. Every narrative beat
  // waits on it, so nothing is ever taken off screen before the child
  // has said they are ready.
  function _awaitClick(label,cls){
    return new Promise(function(resolve){
      if(!_els){ resolve(); return; }
      const btn=_el('button','studio-rite-choice'+(cls?(' '+cls):''));
      btn.type='button';
      btn.textContent=label;
      btn.addEventListener('click',function(){
        try{ if(btn.parentNode) btn.parentNode.removeChild(btn); }catch(e){}
        resolve();
      },{once:true});
      _els.controls.appendChild(btn);
      try{ btn.focus({preventScroll:true}); }catch(e){}
    });
  }

  // ---------- The Nudge (docs/STUDIO_RITE_PROPOSAL.md → Part IV) ----------
  // "The Rite may show a child WHERE a control is. It may never explain
  // WHAT it does." (Canon 6). Lumo never names a control; the real one
  // lights up, and the child learns its behaviour by using it.
  //
  // The delay lengthens screen by screen (the `nudgeDelay` on each
  // SCREEN), so the child takes over by degrees and a confident one
  // never sees a hint at all.

  // Resolve by VISIBLE LABEL rather than position wherever possible — a
  // positional selector silently points at the wrong control the moment
  // a row is reordered, and a nudge aimed at the wrong thing is worse
  // than no nudge.
  // Prefers a label that STARTS with the term ("Size260px" -> "size")
  // over one that merely contains it ("Font Size"), so a new unrelated
  // row cannot quietly steal the nudge.
  // Where the share control is RIGHT NOW, and what to say about it.
  //
  // Innermost first: the ceremony's own Yes if Lumo is already asking,
  // then the celebration's choice, then the editor's button. Each hint
  // describes the screen the child is actually looking at.
  function _shareTarget(){
    // 1 — the Share Ceremony is open and has reached its last question.
    const yes=_byLabel('.share-ceremony-btn.is-yes','share with vihuplanet')
           || document.querySelector('.share-ceremony-btn.is-yes');
    if(_visible(yes)) return {el:yes, hint:'It is the one with the little galaxy.'};

    // 2 — the celebration, which is where Finish Story lands them.
    const celeb=_byLabel('.publish-celebration-choice-label','share with vihuplanet',
                         '.publish-celebration-choice');
    if(_visible(celeb)) return {el:celeb, hint:'The one with the little galaxy — Share with VihuPlanet.'};

    // 3 — still in the editor, so Finish Story has not been pressed yet.
    const top=document.getElementById('shareBtn');
    return {el:top, hint:'It is up at the top, next to Play My Story.'};
  }

  // On screen and reachable — not merely present in the document. A
  // control behind a closed modal has a box of zero size.
  function _visible(el){
    if(!el) return false;
    try{
      const r=el.getBoundingClientRect();
      if(r.width<2 || r.height<2) return false;
      return getComputedStyle(el).visibility!=='hidden';
    }catch(e){ return false; }
  }

  function _byLabel(labelSel,text,liftSel){
    const want=String(text).toLowerCase();
    const lift=function(el){ return liftSel ? el.closest(liftSel) : el; };
    try{
      const all=document.querySelectorAll(labelSel);
      let contains=null;
      for(let i=0;i<all.length;i++){
        const t=(all[i].textContent||'').trim().toLowerCase();
        if(t.indexOf(want)===0) return lift(all[i]);
        if(!contains && t.indexOf(want)!==-1) contains=all[i];
      }
      if(contains) return lift(contains);
    }catch(e){}
    return null;
  }

  function _hasSelection(){
    try{
      return !!(PageRuntime.getSelection().sceneId) && PageRuntime.selectionIsValid();
    }catch(e){ return false; }
  }

  // The ⋮ on the page the child is actually on — the way into the page
  // menu. Falls back to the first thumbnail so the nudge still has
  // somewhere to point if the index cannot be read.
  function _thumbMenuBtn(){
    try{
      const i=(AppState&&AppState.currentSlide)||0;
      return document.querySelector('#slideList .thumb[data-index="'+i+'"] .thumb-menu-btn')
          || document.querySelector('#slideList .thumb-menu-btn');
    }catch(e){ return null; }
  }

  // Duplicate Page, but only while the menu is genuinely open — a hidden
  // menu item is not something a child can tap, and ringing it would
  // point at nothing.
  function _pageMenuItem(){
    try{
      const menu=document.getElementById('contextMenu');
      if(!menu||menu.classList.contains('hidden')) return null;
      return menu.querySelector('[data-action="duplicate"]');
    }catch(e){ return null; }
  }

  // The way in to adding anything. Shared by the add beats and by the
  // empty-page recovery below.
  function _addWayIn(){
    const card=_byLabel('.context-add-card-label','emoji');
    if(card) return card.parentElement||card;
    return document.querySelector('.context-add-trigger');
  }

  // One particular tile inside Add Something, once the accordion is
  // open; the way in while it is still shut. Resolved by the tile's own
  // id rather than its label or its position, because the row's
  // contents change with what a World and a family album make available.
  function _addTile(id){
    try{
      const tile=document.querySelector(".context-add-card[data-add-id='"+id+"']");
      if(tile) return tile;
    }catch(e){}
    return document.querySelector('.context-add-trigger');
  }

  // WHICH ROOM OF MY GARDEN THE STORY IS IN.
  //
  // "second beat is about letters. but the highlighted part is
  // drawings." — the product owner, walking Rite II. He tapped My Garden
  // because Lumo said his letters lived there, and My Garden opened on
  // the room it had opened on last, which was the other one.
  //
  // Which gate is about letters and which about drawings is the RITE's
  // knowledge, so it lives here and the picker asks for it
  // (js/contextPanel.js -> _riteWantsRoom). A gate that is about neither
  // answers null, and so does everything outside a rite, so the Studio
  // behaves exactly as it always did.
  const GARDEN_ROOM={
    'letter-kept':'letters',
    'letters-grown':'letters',
    'letters-placed':'letters',
    'drawing-kept':'drawings',
    'drawing-placed':'drawings'
  };
  function wantsRoom(){
    if(!_running) return null;
    return GARDEN_ROOM[_awaiting] || null;
  }

  // The tab for a room, but ONLY when My Garden is open and standing in
  // the other one — pointing at the room a child is already in says
  // nothing. It reads `data-room` rather than the tab's own words,
  // because those are copy and this is not the file that owns them.
  function _gardenRoomTab(room){
    try{
      if(!document.querySelector('.context-hw-tabs')) return null;
      const tab=document.querySelector(".context-hw-tab[data-room='"+room+"']");
      if(!tab || tab.classList.contains('context-hw-tab-active')) return null;
      return tab;
    }catch(e){}
    return null;
  }

  // capability -> {find(), hint}. `find` may return null at any moment
  // (the control genuinely isn't on screen yet); the nudge then simply
  // waits and tries again rather than pointing at nothing.
  const NUDGE={
    'sticker-added':{
      // Two steps, resolved by what is actually on screen: while the
      // accordion is shut, point at the way in; once it is open, point
      // at the Emojis card itself. Never at the whole accordion — it is
      // 381px tall and cannot fit above the band, so the visibility
      // contract would (correctly) refuse to point at all.
      find:_addWayIn,
      hint:"It's over on the right."
    },
    // Two steps: the object has to be chosen before its controls exist
    // at all. The Object Strip is the DOM way in — the page is a canvas,
    // so a sticker has no element of its own to ring. The Strip sits at
    // the very bottom and often cannot clear the band, in which case the
    // words below carry it instead; that is the contract working, not
    // failing.
    'sticker-moved':{
      find:function(){
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','move left','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
        return _hasSelection()
          ? 'Drag them where you want, or nudge them from the right.'
          : "Tap them first — they're in the row under your page.";
      }
    },
    'sticker-resized':{
      find:function(){
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','size','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
        return _hasSelection()
          ? "It's over on the right, under their name."
          : "Tap them first — they're in the row under your page.";
      }
    },
    'story-played':{
      find:function(){ return document.getElementById('playStoryBtn'); },
      hint:'It is up at the top, and it just woke up.'
    },
    // SHARING HAPPENS IN THREE PLACES, AND THE CHILD IS ONLY EVER IN
    // ONE OF THEM.
    //
    // This used to point at #shareBtn and say "up at the top, next to
    // Play My Story" — the editor's own button. But this beat's
    // instruction is "Tap Finish Story", and finishing opens the
    // celebration over the editor, where #shareBtn is behind a modal
    // and the real choice is "Share with VihuPlanet". The nudge could
    // not paint a hidden target, fell back to words after three and a
    // half seconds, and told the child to go somewhere they could not
    // see — which is how a child reached the end of their first story
    // and never became a Creator. Canon 8 is explicit: a nudge must
    // bring its target into view first, or not point at all.
    //
    // So it looks for the child, innermost surface first.
    'story-shared':{
      find:function(){ return _shareTarget().el; },
      hint:function(){ return _shareTarget().hint; }
    },
    'story-named':{
      find:function(){ return document.getElementById('bookTitle'); },
      hint:"It's up at the very top."
    },
    // The page's own colour. Two steps again: the tile, then whatever it
    // opens.
    'bg-set':{
      find:function(){ return _byLabel('.context-set-trigger-label','🎨 background','.context-set-tile')
                           || _byLabel('.context-set-trigger-label','background','.context-set-tile'); },
      hint:"The page's own colour lives on the right."
    },
    // Copying a page is two steps, and neither of them is a button
    // sitting in the open: the ⋮ on the page's own thumbnail opens the
    // page menu, and Duplicate Page lives inside it. So the nudge walks
    // the child there — the ⋮ first, then the menu item the moment the
    // menu is up. This is the same "the target changes as they work"
    // shape the sticker beats already use.
    'page-added':{
      find:function(){
        const item=_pageMenuItem();
        if(item) return item;
        return _thumbMenuBtn();
      },
      hint:function(){
        return _pageMenuItem()
          ? 'Tap "Duplicate Page".'
          : 'Your pages are down the left side.';
      }
    },
    'text-added':{
      find:function(){
        const card=_byLabel('.context-add-card-label','text');
        if(card) return card.parentElement||card;
        return document.querySelector('.context-add-trigger');
      },
      hint:'Words live with the other things you can add.'
    },
    'shape-added':{
      find:function(){ return _addTile('shapes'); },
      hint:"It's over on the right, with the other things you can add."
    },
    // Two steps, the same shape the spatial beats already use: the way
    // in while there is nothing to draw on, and the pad itself once it
    // is open in front of them.
    'doodle-added':{
      find:function(){
        return document.querySelector('.doodle-pad-canvas') || _addTile('doodle');
      },
      hint:function(){
        return document.querySelector('.doodle-pad-canvas')
          ? 'The little square on the right is yours to draw on.'
          : "It's over on the right, with the other things you can add.";
      }
    },
    'photo-added':{
      find:function(){ return _addTile('photo'); },
      hint:'Pictures live with the other things you can add.'
    },
    // Rite II. Every one of these points at the SAME tile — My Garden —
    // because that is where both rooms live. What changes is the help,
    // and the help never names the control: it says where a thing is,
    // which Decision 8 allows, and never what the control does.
    // THREE STEPS, NOT TWO. The way in while My Garden is shut; the
    // ROOM, when it is open and standing in the other one; and the
    // catcher itself once it is up. The middle step is what was
    // missing: a child sent for their letters who lands among their
    // drawings is looking at a dead end, and the tile the old nudge
    // pointed at was the one they had already tapped.
    'letter-kept':{
      find:function(){
        return document.querySelector('.hw-studio-panel')
            || _gardenRoomTab('letters') || _addTile('library');
      },
      hint:function(){
        if(document.querySelector('.hw-studio-panel')) return 'Hold your letter up so I can see it.';
        if(_gardenRoomTab('letters')) return 'Your letters are in the other room.';
        return 'Your letters live on the right, with the things you can add.';
      }
    },
    'letters-grown':{
      find:function(){
        return document.querySelector('.hw-studio-panel')
            || _gardenRoomTab('letters') || _addTile('library');
      },
      hint:function(){
        if(document.querySelector('.hw-studio-panel')) return 'Hold the next one up.';
        if(_gardenRoomTab('letters')) return 'Your letters are in the other room.';
        // Says the shape of the work without counting anything: there
        // is a tile per letter, and a child takes them one at a time.
        return 'There is a place waiting for every letter, one at a time.';
      }
    },
    'letters-placed':{
      find:function(){ return _gardenRoomTab('letters') || _addTile('library'); },
      hint:function(){
        return _gardenRoomTab('letters')
          ? 'Your letters are in the other room.'
          : 'Tap a letter you made, and it will ask where it should go.';
      }
    },
    'drawing-kept':{
      find:function(){
        return document.querySelector('.bia-studio-panel')
            || _gardenRoomTab('drawings') || _addTile('library');
      },
      hint:function(){
        if(document.querySelector('.bia-studio-panel')) return 'Hold your paper up so I can see it.';
        if(_gardenRoomTab('drawings')) return 'Your drawings are in the other room.';
        return 'When your drawing is ready, it comes in on the right.';
      }
    },
    'drawing-placed':{
      find:function(){ return _gardenRoomTab('drawings') || _addTile('library'); },
      hint:function(){
        return _gardenRoomTab('drawings')
          ? 'Your drawings are in the other room.'
          : 'Tap the one you made, and it will ask where it should go.';
      }
    },
    'blank-page-added':{
      find:function(){ return document.getElementById('addPageBtn'); },
      hint:'Your pages are down the left side.'
    },
    'story-finished':{
      find:function(){ return document.getElementById('shareBtn'); },
      hint:'It is up at the top, next to Play My Story.'
    },
    // Where, never what — Decision 8. Both point at a real control and
    // say where it lives; neither says what it does.
    'voice-added':{
      find:function(){ return _addTile('voice'); },
      hint:'It is on the right, with the things you can add.'
    },
    'page-shaped':{
      find:function(){
        return document.querySelector('.context-set-tile[data-set-id="pageShape"]');
      },
      hint:'It is on the right, under the things you can add.'
    },
    // A page the child has emptied — by deleting what they made, which
    // exploring children do — used to leave these three beats with
    // nothing to point at and no way to pass, on a Rite there is no way
    // out of. Now the guidance simply becomes "put something back", and
    // the beat completes properly once there is something to move.
    'sticker-rotated':{
      find:function(){
        if(!_stickers().length) return _addWayIn();
        return _hasSelection()
          ? _byLabel('.designer-row-label','spin','.designer-row')
          : document.getElementById('objectStripList');
      },
      hint:function(){
        if(!_stickers().length) return 'Add something to your page first.';
        return _hasSelection()
          ? 'There is a spin control on the right.'
          : "Tap it first — it's in the row under your page.";
      }
    }
  };

  let _nudgeEl=null, _nudgeTimers=[];

  // The safe area is the viewport minus the Rite's OWN band, read live
  // rather than hardcoded. Measured at 1343x800 the band occupies
  // 542-800 — a third of the screen — and the Background tile the story
  // asks for sits at 680-734, entirely behind it.
  function _safeBottom(){
    try{
      if(_els && _els.overlay.classList.contains('studio-rite-band')
             && !_els.overlay.classList.contains('studio-rite-rail')){
        const r=_els.panel.getBoundingClientRect();
        if(r.height>0) return Math.max(0,r.top);
      }
    }catch(e){}
    return window.innerHeight;
  }

  // A control taller than the safe area can still be perfectly usable —
  // its top edge is what a child taps. Requiring the WHOLE element to
  // fit made the nudge refuse to point at anything tall, which is how
  // the first version silently pointed at nothing.
  function _isVisible(el){
    try{
      const r=el.getBoundingClientRect();
      if(r.width<=0||r.height<=0) return false;
      if(r.top<0) return false;
      const need=Math.min(r.height,72);
      return (r.top+need)<=_safeBottom();
    }catch(e){ return false; }
  }

  // Scroll it into the safe area; if that is not enough, shrink the
  // band; if it STILL cannot be seen, refuse to point (the caller falls
  // through to words). A nudge aimed off-screen is worse than none.
  function _ensureVisible(el){
    if(_isVisible(el)) return true;
    try{ el.scrollIntoView({block:'center',inline:'nearest'}); }catch(e){}
    if(_isVisible(el)) return true;
    try{
      if(_els && !_els.overlay.classList.contains('studio-rite-rail'))
        _els.overlay.classList.add('studio-rite-band-compact');
    }catch(e){}
    return _isVisible(el);
  }

  // The one quiet row under the conversation. Both the escalation hint
  // and the redirect below write here, so a child never has two pieces
  // of guidance on screen at once. A redirect answers something the
  // child has just this moment done, so for a few seconds it outranks
  // the general "here is where that lives".
  let _hintAt=0;
  function _sayHint(txt,priority){
    if(!_els||!txt) return;
    if(!priority && _hintAt && (Date.now()-_hintAt)<6000) return;
    try{
      let row=_els.panel.querySelector('.studio-rite-hint');
      if(!row){
        row=_el('div','studio-rite-hint');
        _els.convo.parentNode.insertBefore(row,_els.controls);
      }
      if(row.textContent!==txt) row.textContent=txt;
      if(priority) _hintAt=Date.now();
    }catch(e){}
  }

  function _clearNudge(){
    _nudgeTimers.forEach(function(t){ clearTimeout(t); });
    _nudgeTimers=[];
    _hintAt=0;
    try{
      const row=_els&&_els.panel.querySelector('.studio-rite-hint');
      if(row&&row.parentNode) row.parentNode.removeChild(row);
    }catch(e){}
    if(_nudgeEl){
      try{ _nudgeEl.classList.remove('studio-rite-nudge','studio-rite-nudge-strong'); }catch(e){}
      _nudgeEl=null;
    }
    try{ if(_els) _els.overlay.classList.remove('studio-rite-band-compact'); }catch(e){}
  }

  function _paintNudge(kind){
    const spec=NUDGE[kind];
    if(!spec) return false;
    const el=spec.find();
    if(!el) return false;
    if(el===_nudgeEl) return true;
    if(!_ensureVisible(el)) return false;
    if(_nudgeEl){ try{ _nudgeEl.classList.remove('studio-rite-nudge','studio-rite-nudge-strong'); }catch(e){} }
    _nudgeEl=el;
    try{ el.classList.add('studio-rite-nudge'); }catch(e){}
    return true;
  }

  // Escalation: glow -> stronger pulse -> one spoken hint. The hint is
  // NOT merely a late fallback: if no target can be shown at all (the
  // Object Strip, for instance, sits at the very bottom of the screen
  // and structurally cannot clear the band), words arrive quickly
  // instead, because a child staring at nothing is the failure this
  // whole layer exists to prevent.
  //
  // The tick keeps running after a successful paint, because the right
  // target changes as the child works — selecting their object replaces
  // "tap it in the row below" with the spatial controls themselves.
  //
  // ("Lumo looks", stage 3 of the Part IV design, is not built.)
  function _startNudge(kind,delay){
    _clearNudge();
    const spec=NUDGE[kind];
    if(!spec) return;
    let painted=false, spoke=false, misses=0, shownAt=0;
    // The hint is NOT a conversation line. Appending it dimmed the real
    // instruction to "past" and made the hint the brightest thing on
    // screen — backwards. It gets its own quiet row instead, under the
    // conversation, and the instruction stays the brightest thing.
    const speak=function(){
      if(spoke||!_els) return;
      spoke=true;
      try{ _sayHint((typeof spec.hint==='function')?spec.hint():spec.hint,false); }
      catch(e){}
    };
    const tick=function(){
      if(!_els) return;
      if(_paintNudge(kind)){
        if(!painted){ painted=true; shownAt=misses; }
        misses=0;
        if(_nudgeEl && !_nudgeEl.classList.contains('studio-rite-nudge-strong')){
          _nudgeTimers.push(setTimeout(function(){
            if(_nudgeEl) try{ _nudgeEl.classList.add('studio-rite-nudge-strong'); }catch(e){}
          },7000));
        }
      }else{
        misses++;
        // ~3.5s of being unable to show anything: use words instead of
        // leaving the child with no guidance at all.
        if(misses>=5) speak();
      }
      _nudgeTimers.push(setTimeout(tick,700));
    };
    _nudgeTimers.push(setTimeout(tick,Math.max(0,delay||0)));
  }

  // ---------- Watching the child's own work ----------
  // Reads the live page rather than tracking our own copy of it, so the
  // Rite can never disagree with what the editor actually did.
  function _stickers(){
    try{
      const page=PageRuntime.getActivePage();
      return (page&&page.metadata&&page.metadata.stickers)||[];
    }catch(e){ return []; }
  }

  function _stickerSnapshot(){
    return _stickers().map(function(s){
      return s.id+':'+s.x+','+s.y+':'+s.w+'x'+s.h;
    }).join('|');
  }

  function _narratedPages(){
    try{
      return (AppState.slides||[]).filter(function(s){
        return !!(s && s.metadata && s.metadata.narration);
      }).length;
    }catch(e){ return 0; }
  }
  function _shapedPages(){
    try{
      return (AppState.slides||[]).filter(function(s){
        return !!(s && s.metadata && s.metadata.aspect);
      }).length;
    }catch(e){ return 0; }
  }

  function _conditionMet(kind,baseline){
    // The child naming their story. Reads the same
    // AppState.project.bookTitle that #bookTitle's own input handler
    // writes (js/app.js), so the Rite sees exactly what the project
    // sees — no second source of truth, no separate Rite-only field.
    // A project is BORN with a name — js/state.js seeds
    // bookTitle:'My Adventure', and #bookTitle ships that as its value
    // attribute. So "the story has a name" is true before the child
    // touches anything, and testing for non-empty would skip Act IV's
    // ask entirely — silently deleting the emotional peak of the whole
    // Rite. The real condition is that the child CHANGED it from
    // whatever it said when the beat began, and left something behind.
    if(kind==='story-named'){
      const now=_titleNow();
      return now.length>0 && now!==(baseline&&baseline.__title);
    }
    // A new page resets the page's own object count, so "add something"
    // is always measured against what was there when the beat started —
    // never against zero, which would let an object made on page 1
    // satisfy a page-2 beat.
    if(kind==='page-added') return _pageCount()>(baseline&&baseline.__pages||0);
    // A duplicated page arrives carrying the previous page's colour, and
    // a child may simply re-pick the colour they already had. Requiring
    // the VALUE to change would strand them on a beat they cannot pass,
    // so a real touch of the background control counts too — recorded by
    // the same delegated input listener the beat already runs.
    if(kind==='bg-set'){
      const bg=_bgNow();
      if(!bg) return false;
      return bg!==(baseline&&baseline.__bg) || _bgTouched;
    }
    // The child pressed Play My Story. Watched rather than told: the
    // player counts its own readings, so the button stays the only
    // thing a child touches and nothing has to report back here.
    if(kind==='story-played'){
      try{ return StoryPlayer.playCount()>(baseline&&baseline.__plays||0); }
      catch(e){ return false; }
    }
    // The child shared. Read from MagicCard's own hasEverPublished
    // flag, which js/shareCeremony.js sets when a Story actually joins
    // the Ether — the same signal the Creator Ceremony itself is gated
    // on, so this can never disagree with whether a share really
    // happened. (It moved there from js/publishStudio.js in Sprint VP2,
    // when finishing and sharing became separate acts. This beat waits
    // on sharing and always did; it is only now that the flag means
    // exactly that and nothing else.)
    if(kind==='story-shared'){
      try{ return !!MagicCard.growthSignals().hasEverPublished && !(baseline&&baseline.__published); }
      catch(e){ return false; }
    }
    if(kind==='text-added') return _textCount()>(baseline&&baseline.__texts||0);
    // Counted by KIND, so a shape never passes a doodle beat and a photo
    // never passes a shape beat — the whole reason these gates exist.
    if(kind==='shape-added') return _kindCount('shape')>(baseline&&baseline.__shapes||0);
    if(kind==='photo-added') return _kindCount('image')>(baseline&&baseline.__images||0);
    if(kind==='doodle-added') return _drawnDoodleCount()>(baseline&&baseline.__doodles||0);
    // A page that arrived EMPTY. `page-added` counts pages and the first
    // Rite teaches copying one, so a copy satisfies that count and this
    // beat would be passed by the skill the child already has.
    //
    // Two signals, either of which is enough, because neither is enough
    // alone. The control that makes an empty page is the exact thing the
    // beat is about, so using it counts outright. And a page that arrives
    // carrying nothing is an empty page however it was made — which
    // covers a child who found another way there. A copy of a page with
    // a house on it satisfies neither. (The one case both miss is a copy
    // of an already-empty page; in this story page one holds a house by
    // the time this beat is reached, so there is no empty page to copy.)
    //
    // Latched: a child who adds a page and immediately puts something on
    // it must not lose the beat between two polls.
    if(kind==='blank-page-added'){
      if(_blankPageSeen) return true;
      if(_pageCount()<=(baseline&&baseline.__pages||0)) return false;
      if(_addPageUsed || _stickers().length===0){ _blankPageSeen=true; return true; }
      return false;
    }
    // The child finished their story: Publish Studio has reached its own
    // celebration — "You finished your story!" — which is the moment
    // every artifact exists and the story is theirs to keep. Read from
    // PublishStudio's own public stage rather than from the DOM, so this
    // can never disagree with what actually happened. Deliberately NOT
    // `story-shared`: sharing is a separate act (CLAUDE.md → Decision 12)
    // and this story ends at finishing.
    // LATCHED, AND HELD UNTIL THE CELEBRATION COMES DOWN.
    //
    // Unlatched, this was true only while the celebration happened to be
    // on screen: a child who closed it between two polls could never
    // pass the beat again, on a rite there is no way out of.
    //
    // And passing the instant the celebration OPENS is just as wrong the
    // other way. The closing chapter would play to a child who is
    // looking at a modal — Lumo speaking over the film, and "Into the
    // Studio" waiting behind it. Every child leaves that screen somehow
    // (✕, Keep Editing, Make Another Story, or the share path, which
    // closes it itself), so the rite simply waits for the screen it is
    // about to speak on to be free.
    if(kind==='story-finished'){
      try{
        if(typeof PublishStudio==='undefined') return false;
        if(PublishStudio.isOpen()
           && PublishStudio.getStage()===PublishStudio.STAGES.CELEBRATION) _finishedSeen=true;
        return _finishedSeen && !PublishStudio.isOpen();
      }catch(e){ return false; }
    }
    // THE CHILD'S OWN VOICE on a page. Per-page narration is stored at
    // slide.metadata.narration (js/contextPanel.js), so this counts
    // pages carrying one — the same shape as every other gate here, and
    // it can never disagree with what a child actually recorded.
    if(kind==='voice-added'){
      try{ return _narratedPages()>(baseline&&baseline.__narrated||0); }
      catch(e){ return false; }
    }
    // The page's own shape, stored at slide.metadata.aspect. Counted
    // rather than compared, because a child who tries two shapes and
    // comes back to the first has still chosen one.
    if(kind==='page-shaped'){
      try{ return _shapedPages()>(baseline&&baseline.__shaped||0); }
      catch(e){ return false; }
    }
    // ---- My Garden's two rooms (Rite II) --------------------------
    // A letter kept is a letter kept, whether it is the first or the
    // fifth: each beat re-baselines, so one condition serves both the
    // discovering beat and the owning one. They stay two KINDS because
    // the nudges differ — "your letters are in there" is not the same
    // help as "there are more letters to write".
    if(kind==='letter-kept' || kind==='letters-grown'){
      try{ return HandwritingStore.list().length>(baseline&&baseline.__letters||0); }
      catch(e){ return false; }
    }
    if(kind==='drawing-kept'){
      try{ return CreatorLibrary.list().length>(baseline&&baseline.__drawings||0); }
      catch(e){ return false; }
    }
    // Anything OUT of My Garden and onto the page arrives as an image
    // object, letters and drawings alike — the same count `photo-added`
    // already watches. Two kinds again, for two different hints.
    if(kind==='letters-placed' || kind==='drawing-placed'){
      return _kindCount('image')>(baseline&&baseline.__images||0);
    }
    const list=_stickers();
    if(kind==='sticker-added') return list.length>(baseline&&baseline.__count||0);
    if(!list.length) return false;
    if(kind==='sticker-moved'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && (s.x!==b.x || s.y!==b.y);
      });
    }
    if(kind==='sticker-resized'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && (s.w!==b.w || s.h!==b.h);
      });
    }
    if(kind==='sticker-rotated'){
      return list.some(function(s){
        const b=baseline[s.id];
        return b && ((s.rotation||0)!==b.rotation);
      });
    }
    return true;
  }

  // WHAT A SAVED STORY CAN STILL TELL YOU.
  //
  // Every gate above is a DELTA: one more letter than before, the
  // background changed since the beat began. That is exactly right
  // while a child is working, and useless on a resume, where there is
  // no "before" — a replay reading those would either stall on beat one
  // or skip the whole story.
  //
  // So a rite being replayed to its position asks this instead: how
  // many of the thing does the story ITSELF already hold. A COUNT, not
  // a yes — because gates repeat. Rite III has four `shape-added` beats
  // and four `doodle-added` ones, and a boolean reading would replay a
  // child who drew one shape past all four, landing them in a story
  // about a house they never built. The replay compares this against
  // how many times the gate has come round, so the fourth shape beat
  // needs a fourth shape.
  //
  // Deliberately a separate table rather than a flag threaded through
  // _conditionMet: the live gates are shipped and verified, and must
  // not change shape because a second caller wanted a different
  // question answered. Only ever consulted while replaying (see the
  // reduce in run()); the moment the child is back in charge,
  // _conditionMet takes over with a real baseline.
  // WHICH POOL A GATE READS, so two gates that watch the same quantity
  // share one counter. `letter-kept` and `letters-grown` both read the
  // letters a child has made; counted separately, one letter satisfies
  // BOTH and the replay walks past a beat the child never reached —
  // measured, it landed them two beats ahead. Same for the three gates
  // that watch images and the two that watch pages.
  const DONE_POOL={
    'story-named':'title',
    'page-added':'pages', 'blank-page-added':'pages',
    'bg-set':'bg',
    'text-added':'texts',
    'shape-added':'shapes',
    'doodle-added':'doodles',
    'voice-added':'narration',
    'page-shaped':'aspect',
    'letter-kept':'letters', 'letters-grown':'letters',
    'drawing-kept':'drawings',
    'photo-added':'images', 'letters-placed':'images', 'drawing-placed':'images',
    'sticker-added':'stickers',
    'sticker-moved':'touched', 'sticker-resized':'touched', 'sticker-rotated':'touched'
  };
  function _donePool(kind){ return DONE_POOL[kind] || ('@'+kind); }

  function _doneCount(kind){
    try{
      switch(kind){
        // A project is BORN with a name, so "has a name" is true before
        // a child touches anything — the same trap _conditionMet's own
        // comment records. Named means CHANGED from the seed.
        case 'story-named':{
          const n=_titleNow();
          return (n.length>0 && n!==DEFAULT_TITLE)?1:0;
        }
        // Pages BEYOND the one every story starts with.
        case 'page-added':
        case 'blank-page-added':  return Math.max(0,_pageCount()-1);
        case 'bg-set':            return _bgPages();
        case 'text-added':        return _textCount();
        case 'shape-added':       return _kindCount('shape');
        case 'photo-added':       return _kindCount('image');
        case 'doodle-added':      return _drawnDoodleCount();
        case 'voice-added':       return _narratedPages();
        case 'page-shaped':       return _shapedPages();
        case 'letter-kept':
        case 'letters-grown':     return HandwritingStore.list().length;
        case 'drawing-kept':      return CreatorLibrary.list().length;
        // Both read "something out of My Garden is on the page", which
        // is also what photo-added reads. No rite carries a photo beat
        // and a garden-placing beat, so they cannot collide today; one
        // that did would need a narrower reading than an image count.
        case 'letters-placed':
        case 'drawing-placed':    return _kindCount('image');
        case 'sticker-added':     return _stickers().length;
        // DISCLOSED, AND THE HONEST CHOICE OF TWO WRONG ONES. A saved
        // story cannot tell you whether the star was ever moved,
        // resized or turned — only where it is now, which is equally
        // consistent with never having been touched. Treated as done
        // when there is anything on the page at all, because the other
        // reading sends a child back to redo work they already did, and
        // being asked to repeat yourself is a worse failure than being
        // let past. Each of these appears at most once per rite, so the
        // count never has to mean anything; a second occurrence would
        // be indistinguishable from the first and would need a real
        // signal recorded at the time.
        case 'sticker-moved':
        case 'sticker-resized':
        case 'sticker-rotated':   return _stickers().length?1:0;
        // The ending. A rite that reached these was finished, so its
        // story is not held and there is nothing to replay past.
        case 'story-played':
        case 'story-finished':
        case 'story-shared':      return 0;
      }
    }catch(e){}
    return 0;
  }

  // Pages carrying a background the child chose. Counted rather than
  // read off the active page, because `bg-set` comes round once per page
  // in the rite that makes a second one.
  function _bgPages(){
    try{
      return ((AppState&&AppState.slides)||[]).filter(function(s){
        return !!(s&&s.metadata&&s.metadata.cardOverrides&&s.metadata.cardOverrides.background);
      }).length;
    }catch(e){ return 0; }
  }

  // Reads the live field first and AppState second — #bookTitle's own
  // handler mirrors one into the other while it is being typed, and
  // serialize() already prefers the DOM, so this matches what the
  // project itself considers the name.
  function _titleNow(){
    try{
      const el=document.getElementById('bookTitle');
      if(el && typeof el.value==='string') return el.value.trim();
    }catch(e){}
    try{ return String((AppState&&AppState.project&&AppState.project.bookTitle)||'').trim(); }
    catch(e){ return ''; }
  }

  function _bgNow(){
    try{
      const p=PageRuntime.getActivePage();
      return (p&&p.metadata&&p.metadata.cardOverrides&&p.metadata.cardOverrides.background)||'';
    }catch(e){ return ''; }
  }
  function _pageCount(){
    try{ return (AppState&&AppState.slides&&AppState.slides.length)||0; }catch(e){ return 0; }
  }
  function _textCount(){
    return _stickers().filter(function(s){ return s.kind==='text'; }).length;
  }

  // Shapes and photos land in the same object list emojis do, so
  // `sticker-added` is already satisfied by every one of them
  // (docs/STUDIO_RITE_LEVEL_II_STORY.md §4). What tells them apart is the
  // object's own `kind`, written by js/contextPanel.js when it is made:
  // 'shape' from the shape picker, 'image' from a picture, 'doodle' from
  // the drawing pad.
  function _kindCount(kind){
    return _stickers().filter(function(s){ return s.kind===kind; }).length;
  }

  // A DRAWN doodle — one with at least one stroke on it — and never
  // merely a doodle object that exists.
  //
  // The pad is created the instant the child taps its way in, empty, and
  // selected. An "a doodle object arrived" gate would therefore be
  // satisfied by the tap itself: Lumo would say "Draw a path to the
  // door", the child would open the pad, and the beat would pass before
  // a single line was drawn — teaching the tap and never the drawing.
  // The beat's own instruction is the condition, so the condition is a
  // stroke.
  function _drawnDoodleCount(){
    return _stickers().filter(function(s){
      return s.kind==='doodle' && s.strokes && s.strokes.length>0;
    }).length;
  }

  // Everything a beat might be waiting on, sampled at the moment the
  // beat begins. Counts are per-PAGE, so adding a page resets them —
  // which is what makes "add something" work again on page 2 and 3.
  function _baseline(){
    const map={};
    _stickers().forEach(function(s){
      map[s.id]={x:s.x,y:s.y,w:s.w,h:s.h,rotation:s.rotation||0};
    });
    map.__title=_titleNow();
    map.__bg=_bgNow();
    map.__pages=_pageCount();
    map.__count=_stickers().length;
    map.__texts=_textCount();
    map.__shapes=_kindCount('shape');
    map.__images=_kindCount('image');
    map.__doodles=_drawnDoodleCount();
    // The two rooms of My Garden. Both stores are synchronous, in-memory
    // maps, so a beat can ask them the same way it asks the page — no
    // await inside a condition, and no second source of truth.
    try{ map.__letters=HandwritingStore.list().length; }catch(e){ map.__letters=0; }
    try{ map.__drawings=CreatorLibrary.list().length; }catch(e){ map.__drawings=0; }
    map.__narrated=_narratedPages();
    map.__shaped=_shapedPages();
    try{ map.__plays=StoryPlayer.playCount(); }catch(e){ map.__plays=0; }
    try{ map.__published=!!MagicCard.growthSignals().hasEverPublished; }catch(e){ map.__published=false; }
    return map;
  }

  // Plays one beat and resolves when it is done. A beat with `await`
  // resolves on the child's own action instead of a timer, and waits
  // indefinitely — the Rite is mandatory, so it must never be possible
  // to be rushed through it OR to get stuck in it.
  // How long before the NEXT line of the same screen appears. Derived
  // from how much there is to read rather than a flat constant — the
  // first version used fixed 3-5s durations, which gave a 23-word line
  // and a 6-word line nearly the same time and read far too fast.
  // Lines stay on screen once shown, so this only sets the rhythm.
  function _lineGapMs(line){
    if(!line) return 2600;
    const words=((line.title||'')+' '+(line.subtitle||''))
      .trim().split(/\s+/).filter(Boolean).length;
    return Math.max(2600,Math.min(9000,900+words*430));
  }

  function _showLine(entry){
    if(!_els) return;
    _setPose(_els.lumoImg,_packs.guardian,entry.lumo);
    _setPose(_els.eggImg,_packs.traveller,entry.egg);
    _els.overlay.setAttribute('data-rite-effect',entry.effect||'');
    _appendLine(entry.line);
    _speak(entry.voiceId);
  }

  // Lumo's own recorded voice, where one exists. Guarded the same way
  // every other optional module is: a missing LumoVoice, or a line with
  // no recording yet, simply plays nothing.
  //
  // Stopping the previous clip first is a real bug fix, not tidiness. A
  // screen's last line has no gap timer (the screen's end takes over),
  // so a child who taps the button while Lumo is still speaking used to
  // carry that clip into the next screen and hear TWO Lumos at once.
  // Caught in a real run: Screen 2's first line played over Screen 1's
  // third.
  function _speak(voiceId){
    try{
      if(typeof LumoVoice==='undefined' || !LumoVoice.play) return;
      if(_voiceId && _voiceId!==voiceId){ try{ LumoVoice.stop(_voiceId); }catch(e){} }
      _voiceId=voiceId||null;
      if(voiceId) LumoVoice.play(voiceId);
    }catch(e){}
  }

  function _hush(){
    try{
      if(_voiceId && typeof LumoVoice!=='undefined' && LumoVoice.stop) LumoVoice.stop(_voiceId);
    }catch(e){}
    _voiceId=null;
    try{ if(typeof VihuVoice!=='undefined' && VihuVoice.stop) VihuVoice.stop(); }catch(e){}
  }

  // ---------------------------------------------------------------
  // LUMO SPEAKS A RITE THAT WAS NEVER RECORDED
  //
  // "for story rite 2 plug the eleven labs lumo voice. we wont be
  // recording it." So Rite II is spoken rather than performed, and this
  // is the path that does it.
  //
  // RECORDINGS STILL WIN, and that is the whole ordering: a screen with
  // an `audio:{id,cues}` takes _playRecorded and never comes here. Rite
  // I has fifty recorded lines and is untouched by this. Rite II has
  // none, which is exactly the gap generation is for.
  //
  // IT NEEDS NO CUES, and that is the real gain. A recording is timed by
  // hand — every cue measured against the take, and re-measured whenever
  // a line is re-recorded. Generated speech tells us when it finished,
  // so each line simply waits for its own voice and the next one
  // follows. Nothing to measure, and nothing to keep in step when a line
  // is reworded.
  //
  // THE FEELING IS THE POSE LUMO IS ALREADY IN. `entry.lumo` is already
  // 'talk', 'curious', 'celebrate' — the same vocabulary VihuVoice takes
  // — so a line is spoken with the face it is shown with, and no rite
  // content had to be annotated for this.
  function _canSpeakLumo(){
    try{
      if(typeof VihuVoice==='undefined' || !VihuVoice.canSpeak) return Promise.resolve(false);
      return VihuVoice.canSpeak('lumo');
    }catch(e){ return Promise.resolve(false); }
  }

  // Generation costs a round trip, and a child watching Lumo's mouth
  // wait for it would feel every one. Priming the whole screen at once
  // means only its first line can ever wait; priming the NEXT screen as
  // this one plays means even that is usually already in hand. Both are
  // fire-and-forget — a failed prime just becomes a normal generation
  // later, or silence, which is a correct answer here as everywhere.
  function _primeScreen(screen){
    try{
      if(!screen || !screen.lines) return;
      if(screen.audio) return;                     // recorded; nothing to generate
      if(typeof VihuVoice==='undefined' || !VihuVoice.prepare) return;
      screen.lines.forEach(function(entry){
        const t=_lineText(entry);
        if(t) VihuVoice.prepare({characterId:'lumo',text:t,emotion:entry.lumo});
      });
    }catch(e){}
  }

  // One string per line, because that is what is spoken. The subtitle is
  // usually the instruction ("Add a square.") and belongs in the speech:
  // the Rite may show where a control is and may never explain what it
  // does (CLAUDE.md -> Decision 8), and "add a square" is the former.
  function _lineText(entry){
    const l=entry && entry.line;
    if(!l) return '';
    return [l.title,l.subtitle].filter(Boolean).join(' ').trim();
  }

  function _playSpoken(lines,holdForAudio){
    return lines.reduce(function(chain,entry,i){
      return chain.then(function(){
        _showLine(entry);
        const text=_lineText(entry);
        const last=(i===lines.length-1);
        // The last line of a screen that ends by WAITING FOR THE CHILD
        // resolves at once, exactly as _playLines does: a child who acts
        // while Lumo is still talking must have that action counted
        // rather than swallowed. A screen ending in a BUTTON holds, so
        // the button cannot be pressed over the top of him.
        if(last && !holdForAudio){
          if(text) VihuVoice.speak({characterId:'lumo',text:text,emotion:entry.lumo});
          return;
        }
        if(!text) return new Promise(function(r){ _timer=setTimeout(r,_gapFor(entry)); });
        return VihuVoice.speak({characterId:'lumo',text:text,emotion:entry.lumo})
          .then(function(heard){
            // Not heard — no voice, no network, the browser refusing
            // audio without a gesture. The line is already on screen, so
            // fall back to the reading-speed rhythm the Rite has always
            // used when silent. A child never learns anything went
            // wrong; the pacing is simply the unvoiced one.
            if(heard) return last ? null : new Promise(function(r){ _timer=setTimeout(r,450); });
            if(last) return null;
            return new Promise(function(r){ _timer=setTimeout(r,_gapFor(entry)); });
          });
      });
    },Promise.resolve());
  }

  // A spoken line stays up until Lumo has finished saying it; an unvoiced
  // one falls back to the reading-speed estimate. This is why the gap is
  // read per line rather than being one constant.
  function _gapFor(entry){
    try{
      if(entry.voiceId && typeof LumoVoice!=='undefined' && LumoVoice.durationMs){
        const ms=LumoVoice.durationMs(entry.voiceId);
        if(ms>0) return ms+450;   // a short breath after the line lands
      }
    }catch(e){}
    return _lineGapMs(entry.line);
  }

  // Every line of a screen appears on its own, one after another. The
  // child is never asked to click to hear the next thing Lumo says.
  // A screen with its own recording plays the take from end to end and
  // reveals each line at a measured cue. `holdForAudio` is true only for
  // screens that end in a BUTTON: there the screen waits for the
  // recording to finish, so a child cannot click Lumo off mid-sentence.
  // A screen that ends by waiting for the child resolves as soon as the
  // last line is up — its baseline is captured at that moment, and a
  // child who acts while Lumo is still talking must have that action
  // counted, not swallowed.
  function _playRecorded(lines,audio,holdForAudio){
    return new Promise(function(resolve){
      let total=0;
      try{ total=LumoVoice.durationMs(audio.id)||0; }catch(e){}
      _speak(audio.id);
      const last=audio.cues.length-1;
      lines.forEach(function(entry,i){
        const at=Math.max(0,Math.round((audio.cues[i]||0)*1000));
        const t=setTimeout(function(){ _showLine(entry); },at);
        _cueTimers.push(t);
      });
      const lastAt=Math.round((audio.cues[last]||0)*1000);
      const endAt=holdForAudio ? Math.max(lastAt+400,total) : lastAt+400;
      _cueTimers.push(setTimeout(resolve,endAt));
    });
  }

  function _playLines(lines){
    return lines.reduce(function(chain,entry,i){
      return chain.then(function(){
        _showLine(entry);
        if(i===lines.length-1) return;   // last line: the screen's end takes over
        return new Promise(function(r){ _timer=setTimeout(r,_gapFor(entry)); });
      });
    },Promise.resolve());
  }

  // A screen ends in exactly one of three ways: a button, the one
  // "Yes", or something the child makes.
  function _playEnd(end,nudgeDelay,instruction){
    if(end.move) return _awaitClick(end.move);
    if(end.choice) return _awaitClick(end.choice,'studio-rite-choice-primary');
    if(end.await) return _awaitAction(end.await,nudgeDelay,instruction,end.decline);
    return Promise.resolve();
  }

  // What the child was actually asked to do: the last thing Lumo said on
  // this screen, preferring the subtitle, which is where the instruction
  // lives when a screen has both.
  function _instructionOf(screen){
    try{
      const last=screen.lines[screen.lines.length-1];
      return (last&&last.line&&(last.line.subtitle||last.line.title))||'';
    }catch(e){ return ''; }
  }

  // Everything the child has made on this page, in one comparable
  // string. Used only to notice that they DID something — never to
  // judge what.
  function _workSignature(){
    try{
      return _pageCount()+'|'+_bgNow()+'|'+_titleNow()+'|'+_textCount()+'|'+
        _stickers().map(function(s){
          // Drawing adds strokes without moving, resizing or turning
          // anything, so a doodle in progress would otherwise look
          // identical to a child who had stopped. Only objects that
          // actually carry strokes contribute the extra term, so every
          // object the first Rite ever makes produces exactly the string
          // it always did.
          return s.id+':'+s.x+','+s.y+':'+s.w+'x'+s.h+':'+(s.rotation||0)
                 +(s.strokes?(':'+s.strokes.length):'');
        }).join('~');
    }catch(e){ return ''; }
  }

  // "Nice. Now make the sky dark." The beat's own instruction, said
  // again. Every awaited beat's last line is already an imperative, so
  // this needs no new copy — which is the point: the child hears the
  // same sentence, not a correction and not a different idea.
  function _redirectText(instruction){
    if(!instruction) return '';
    const s=String(instruction).trim();
    if(!s) return '';
    return 'Nice. Now '+s.charAt(0).toLowerCase()+s.slice(1);
  }

  // A beat the child completes by making something. Waits indefinitely.
  //
  // A child who taps something other than what Lumo asked for is never
  // stopped, told they were wrong, or told which button they should have
  // pressed. Everything reachable in the Studio during the Rite is a
  // real, safe, undoable creative act, and the Rite's whole premise is
  // that it teaches through creation — the first thing the Studio ever
  // says to a child must not be "no". So exploring is simply allowed,
  // and the only response to it is the same instruction, offered again
  // once, warmly: they stay on the path without ever being held to it.
  // Beats that act on the PAGE rather than on a selected object. After
  // adding a star the star is selected, and the right panel is showing
  // that star's own controls — so the next beat ("make the sky dark")
  // asks for something the child cannot see without first finding their
  // way back. Clearing the selection returns the panel to Personalize,
  // which is where Background lives, and where the nudge points.
  //
  // Never done for the spatial beats: move, resize and spin need the
  // selection they are about to use.
  const PAGE_LEVEL={'bg-set':1,'page-added':1,'story-named':1,
                    'sticker-added':1,'text-added':1,
                    // All four arrive from the page's own Add Something
                    // and page list, exactly like the five above: the
                    // panel has to be showing the PAGE rather than the
                    // object the child has just finished with.
                    'shape-added':1,'doodle-added':1,'photo-added':1,
                    'blank-page-added':1,
                    // Rite II's four, for the same reason: every one of
                    // them starts at the page's own Add Something.
                    'letter-kept':1,'letters-grown':1,'letters-placed':1,
                    'drawing-kept':1,'drawing-placed':1,
                    // Voice and Page Shape both live on the page panel —
                    // one in Add Something, one in the Set tiles under
                    // it — so both need the panel showing the PAGE.
                    'voice-added':1,'page-shaped':1};

  function _showPageControls(){
    try{
      if(typeof PageRuntime==='undefined' || !PageRuntime.clearSelection) return;
      PageRuntime.clearSelection();
      // clearSelection only writes the host's selection fields; the five
      // panel refreshes hang off notify(), so without this the panel
      // keeps showing the object the child has finished with.
      PageRuntime.notify();
    }catch(e){}
  }

  // `declineLabel`, when given, puts a quiet second way out beside the
  // beat — used only by the sharing beat, where saying no is a real
  // answer rather than a failure to comply. It resolves the beat exactly
  // as completing it would: the Rite carries on and the Studio unlocks.
  function _awaitAction(kind,nudgeDelay,instruction,declineLabel){
    return new Promise(function(resolve){
      _awaiting=kind;
      // The dock reads the beat (see _prefersRail), so it is re-placed
      // whenever the beat changes rather than only on a resize.
      try{ _placeDock(); }catch(e){}
      if(PAGE_LEVEL[kind]) _showPageControls();
      const baseline=_baseline();
      _bgTouched=false;
      _addPageUsed=false;
      _blankPageSeen=false;
      _finishedSeen=false;
      _startNudge(kind,nudgeDelay);
      const redirect=_redirectText(instruction);
      const startedAt=Date.now();
      let lastWork=_workSignature();
      let idleTimer=null, onInput=null, onClick=null, poll=null;
      const rearmIdle=function(){
        if(idleTimer) clearTimeout(idleTimer);
        idleTimer=setTimeout(function(){
          // Canon 1 — pose only. The Egg gets sleepy; it never nags,
          // and Lumo never repeats himself.
          _setPose(_els&&_els.eggImg,_packs.traveller,'sleep');
        },IDLE_DRIFT_MS);
      };
      const cleanup=function(){
        _awaiting=null;
        if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
        _clearNudge();
        if(idleTimer){ clearTimeout(idleTimer); idleTimer=null; }
        if(poll){ clearInterval(poll); poll=null; }
        if(onInput){ try{ document.removeEventListener('input',onInput,true); }catch(e){} onInput=null; }
        if(onClick){ try{ document.removeEventListener('click',onClick,true); }catch(e){} onClick=null; }
        if(_unobserve){ try{ _unobserve(); }catch(e){} _unobserve=null; }
      };
      // A beat used to end on the FIRST qualifying change, which is not
      // the same thing as the child being finished. "Make your star
      // smaller" is satisfied by the first pixel of a drag, so Lumo
      // moved on while a child was still resizing; naming a story ended
      // on the first keystroke. The condition now only ARMS the beat,
      // and the beat ends once the child has actually stopped — any
      // further change restarts the wait. A child who keeps working
      // simply keeps Lumo waiting, which is right rather than costly:
      // the Rite is theirs to pace.
      //
      // Discrete beats are exempt. Copying a page, pressing Play and
      // sharing all happen in an instant and have no "still working"
      // state, so waiting there would just be dead air.
      // THE CHILD SAYS WHEN THEY ARE DONE.
      //
      // Settling on a pause was still a guess, and it guessed wrong in
      // the one case that matters: a child who has added their star and
      // is looking at it, deciding, is indistinguishable from a child
      // who has finished. Both are simply not touching anything. So
      // Lumo moved on while they were still thinking.
      //
      // No timer can tell those two apart, which is why this is not a
      // longer timer. Once the step is actually done a confirmation
      // appears, and the beat waits for it however long that takes.
      // The Rite is theirs to pace.
      //
      // It appears only when the condition is MET, so it can never be
      // used to skip a step — and it disappears again if they undo the
      // thing, because there is then nothing to confirm.
      const settles=!DISCRETE[kind];
      let settleTimer=null, settleSig=null, confirmBtn=null;
      const finish=function(){
        if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
        cleanup();
        try{ if(_els) _els.controls.innerHTML=''; }catch(e){}
        resolve();
      };
      const dropConfirm=function(){
        if(!confirmBtn) return;
        try{ if(confirmBtn.parentNode) confirmBtn.parentNode.removeChild(confirmBtn); }catch(e){}
        confirmBtn=null;
      };
      const offerConfirm=function(){
        if(confirmBtn || !_els) return;
        try{
          confirmBtn=_el('button','studio-rite-choice studio-rite-done');
          // _el is (tag, cls) -- it takes no text. Passing a third
          // argument silently drops it and leaves a blank gold pill.
          confirmBtn.textContent=DONE_LABEL;
          confirmBtn.type='button';
          confirmBtn.addEventListener('click',finish);
          _els.controls.appendChild(confirmBtn);
        }catch(e){ confirmBtn=null; }
      };
      // A short stillness before OFFERING it — not before advancing. It
      // only stops the button flickering in and out under a child's
      // hand while they drag.
      const armSettle=function(){
        if(settleTimer) clearTimeout(settleTimer);
        settleSig=_workSignature();
        settleTimer=setTimeout(offerConfirm,OFFER_AFTER_MS);
      };

      const check=function(){
        if(!_conditionMet(kind,baseline)){
          if(settleTimer){ clearTimeout(settleTimer); settleTimer=null; }
          dropConfirm();
          rearmIdle();
          // They changed something, and it was not the thing being
          // waited on. Say the instruction again — at most once every
          // six seconds, and never in the first three, so a child mid-
          // action is not talked over.
          const now=_workSignature();
          if(now!==lastWork){
            lastWork=now;
            if(redirect && (Date.now()-startedAt)>3000) _sayHint(redirect,true);
          }
          return;
        }
        if(!settles){ finish(); return; }
        // Armed. Now wait for the child to actually stop.
        if(!settleTimer){ armSettle(); return; }
        const sig=_workSignature();
        if(sig!==settleSig) armSettle();   // still working — wait again
      };
      if(declineLabel && _els){
        try{
          const btn=_el('button','studio-rite-choice studio-rite-decline');
          // Same bug, and older: the Rite's only way to decline sharing
          // has been an unlabelled button. A child who did not want to
          // share had no readable way out of that beat.
          btn.textContent=declineLabel;
          btn.type='button';
          btn.addEventListener('click',function(){ cleanup(); try{ _els.controls.innerHTML=''; }catch(e){} resolve(); });
          // Appended, not assigned: the confirmation may already be
          // sitting here, and clobbering it would take away the only
          // way forward.
          _els.controls.appendChild(btn);
        }catch(e){}
      }
      rearmIdle();
      try{
        if(typeof PageRuntime!=='undefined' && PageRuntime.observe){
          _unobserve=PageRuntime.observe(check);
        }
        // Typing the story's name never routes through
        // PageRuntime.notify() — #bookTitle's handler only writes
        // AppState and marks the project dirty. A delegated
        // capture-phase 'input' listener (the same shape
        // js/companionDirector.js already uses for typing) is the
        // second signal.
        onInput=function(ev){
          try{
            const t=ev&&ev.target;
            if(t&&t.closest&&t.closest('.context-set-tile')) _bgTouched=true;
          }catch(e){}
          check();
        };
        document.addEventListener('input',onInput,true);
        // The one beat that cares WHICH control was used, and only that
        // beat — registered nowhere else, so no other beat's timing can
        // change. Making an empty page and copying a full one are
        // indistinguishable by page count alone (see _conditionMet), and
        // this is the honest half of telling them apart.
        if(kind==='blank-page-added'){
          onClick=function(ev){
            try{
              const t=ev&&ev.target;
              if(t&&t.closest&&t.closest('#addPageBtn')) _addPageUsed=true;
            }catch(e){}
            check();
          };
          document.addEventListener('click',onClick,true);
        }
        // Last-resort safety net: a beat must never be able to trap a
        // child in a mandatory Rite because a signal was missed.
        poll=setInterval(check,1200);
      }catch(e){ cleanup(); resolve(); }
      check();
    });
  }

  function _clearConvo(){
    if(_els&&_els.convo) _els.convo.innerHTML='';
  }

  function _clearCues(){
    _cueTimers.forEach(function(t){ clearTimeout(t); });
    _cueTimers=[];
  }

  // `next` is handed in rather than looked up, because this module has
  // no screen cursor to consult — the walk is a reduce over the rite's
  // own array. Passing it keeps that true.
  // How long a beat the child has already lived through stays on screen
  // while the story is retold back to where they stopped. Short: this is
  // the thread being handed back, not the chapter being performed again.
  // Ten beats at this pace is about five seconds.
  const REPLAY_HOLD_MS=550;

  function _playScreen(screen,next,fast){
    _clearCues();
    _applyStageBg(!!screen.bg && !screen.band);
    if(screen.band) _toBandMode();
    if(screen.unlock && !_actionsUnlocked){
      _actionsUnlocked=true;
      try{ if(typeof window.refreshStoryActions==='function') window.refreshStoryActions(); }catch(e){}
    }
    _hush();          // never let the previous screen's voice bleed in
    _clearConvo();
    // RETOLD, NOT REPLAYED. A beat the child already finished shows its
    // lines at once and moves on — no voice, no cues, and no waiting on
    // a gate they have already satisfied. Speaking it again would take
    // as long as the first sitting did, which is the opposite of picking
    // up where you left off.
    if(fast){
      screen.lines.forEach(_showLine);
      return new Promise(function(r){ _timer=setTimeout(r,REPLAY_HOLD_MS); });
    }
    const rec=screen.audio && screen.audio.cues
              && screen.audio.cues.length===screen.lines.length
              && typeof LumoVoice!=='undefined' && LumoVoice.play;
    const holdForAudio=!!(screen.end && (screen.end.move||screen.end.choice));

    // THE ORDER IS THE POLICY: a recorded performance, then a generated
    // voice, then silence. Rite I is recorded and never reaches the
    // second branch; Rite II has no recordings and never reaches the
    // first. Nothing had to know which rite it is in.
    const play=rec
      ? Promise.resolve().then(function(){ return _playRecorded(screen.lines,screen.audio,holdForAudio); })
      : _canSpeakLumo().then(function(can){
          if(!can) return _playLines(screen.lines);
          _primeScreen(next);        // generate the next screen while this one plays
          return _playSpoken(screen.lines,holdForAudio);
        });

    return play.then(function(){
      return _playEnd(screen.end,screen.nudgeDelay,_instructionOf(screen));
    });
  }

  // The Rite's pages are sheets of paper, not picture cards. A page
  // normally carries an empty Artwork Place — a large white rectangle
  // over most of it — and the child's Background colour paints only the
  // paper AROUND that, so "make the sky dark" left the biggest thing on
  // the page white.
  //
  // Applied to EVERY page while the Rite runs, not just the first.
  // Duplicating carries the mark, but a page made any other way would
  // not, and one page in three with a white box through it is worse
  // than none — so this is enforced rather than assumed.
  // Re-entrancy: this runs as a PageRuntime observer AND asks
  // PageRuntime to redraw, so without the latch the redraw would call it
  // straight back. The second pass finds nothing to touch and stops on
  // its own, but a latch says so outright instead of relying on that.
  let _inPaper=false;
  function _plainPaper(){
    if(_inPaper) return;
    _inPaper=true;
    try{
      const slides=(AppState&&AppState.slides)||[];
      let touched=false;
      slides.forEach(function(s){
        if(!s) return;
        if(!s.metadata) s.metadata={};
        if(!s.metadata.noPlace){ s.metadata.noPlace=true; touched=true; }
      });
      if(touched) PageRuntime.notify();
    }catch(e){}
    _inPaper=false;
  }

  // Open a blank page directly — no type screen, no World picker — and
  // hold every page of the story on plain paper for as long as the rite
  // runs. Shared by both ways a rite can begin: the first rite does it
  // on the screen that boots the Studio, an opt-in one does it the
  // moment it starts, in a Studio that is already open.
  function _blankStart(){
    try{
      if(typeof CreationFlow!=='undefined' && CreationFlow.startBlank) CreationFlow.startBlank();
    }catch(e){}
    _holdStory();
    _plainPaper();
    try{
      if(typeof PageRuntime!=='undefined' && PageRuntime.observe)
        _paperGuard=PageRuntime.observe(_plainPaper);
    }catch(e){}
  }

  // A STORY MADE INSIDE A RITE IS HELD UNTIL THE RITE IS DONE.
  //
  // "why dont we allow resume from studio home for rite 2 & 3 this way
  // it will never enter projects or show in projects till completely
  // done, child does not have any work lost on account of not able to
  // complete in single seating" — the product owner. A rite opens a
  // blank story the moment it starts, so every abandoned attempt used
  // to leave one in My Projects (measured: three abandoned starts,
  // three empty stories). Held rather than deleted, which is the other
  // half of what he asked for.
  //
  // The mandatory rite is deliberately NOT held. It ends in the
  // Ceremony and its story is the child's first — the thing they
  // finish, share and get a Magic Card for (Decision 8) — and a
  // Traveller walking it holds no card and is stateless anyway
  // (Decision 19), so there is nothing to resume onto.
  //
  // The save is forced rather than waited for: startBlank() only marks
  // the project dirty, so without this the record would not exist for
  // another AUTOSAVE_DEBOUNCE_MS and the stamp would land on nothing.
  function _holdStory(){
    if(!_rite || _rite.unlocksStudio) return;
    try{
      if(typeof ProjectManager==='undefined' || typeof CreatorProjectStore==='undefined') return;
      ProjectManager.saveToLocalStorage();
      const id=ProjectManager.ensureProjectId && ProjectManager.ensureProjectId();
      if(!id) return;
      CreatorProjectStore.markRiteInProgress(id,_rite.id);
      _riteProjectId=id;
    }catch(e){}
  }

  // Reopen the story this rite is already holding, if there is one.
  //
  // Resolves false when there is nothing to resume, so the caller makes
  // a blank one exactly as it always did — a first sitting, a rite that
  // was finished, or any deployment where the store is unavailable all
  // take that path unchanged.
  //
  // The plain-paper guard is armed either way: a resumed story was made
  // on paper and must stay that way for the rest of the rite.
  function _openHeld(){
    try{
      if(typeof CreatorProjectStore==='undefined' || typeof ProjectManager==='undefined')
        return Promise.resolve(false);
      if(!_rite || _rite.unlocksStudio) return Promise.resolve(false);
      const held=CreatorProjectStore.riteStory && CreatorProjectStore.riteStory(_rite.id);
      if(!held) return Promise.resolve(false);
      return Promise.resolve(ProjectManager.openProjectRecord(held)).then(function(ok){
        if(!ok) return false;
        _riteProjectId=held.id;
        // Re-stamped: openProjectRecord() saves, and a save rebuilds the
        // record — the field is carried forward, but the id is the one
        // thing this run must be certain of.
        try{ CreatorProjectStore.markRiteInProgress(held.id,_rite.id); }catch(e){}
        _plainPaper();
        try{
          if(typeof PageRuntime!=='undefined' && PageRuntime.observe)
            _paperGuard=PageRuntime.observe(_plainPaper);
        }catch(e){}
        try{
          if(typeof CreationFlow!=='undefined' && CreationFlow.close) CreationFlow.close();
        }catch(e){}
        return true;
      }).catch(function(){ return false; });
    }catch(e){ return Promise.resolve(false); }
  }

  // Finished. The story stops being held and becomes an ordinary one —
  // it appears in My Projects at this moment and never before, which is
  // exactly "till completely done".
  function _releaseStory(){
    try{
      if(typeof CreatorProjectStore==='undefined') return;
      const id=_riteProjectId ||
        (typeof ProjectManager!=='undefined' && ProjectManager.ensureProjectId &&
         ProjectManager.ensureProjectId());
      if(id) CreatorProjectStore.clearRiteInProgress(id);
    }catch(e){}
    _riteProjectId=null;
  }

  // What the Studio shows while THIS rite runs. The reduction in
  // css/style.css hides everything the first story never asks for, and
  // each of these classes tells one of those rules to stand down — so a
  // rite that teaches drawing has a drawing control to point at, and the
  // first rite, which reveals nothing, meets exactly the Studio it
  // always has.
  //
  // AND THEY ACCUMULATE. A rite must never take away something an
  // earlier rite already taught: once My Garden is the second step, the
  // third one has a child who knows it, and hiding the tile there would
  // be the Studio getting SMALLER as they progress. So a rite reveals
  // its own list plus every earlier rite's, read from the registry in
  // order rather than copied into each entry by hand — which is the
  // same reason the order lives in the array at all. Today this changes
  // nothing, because the only rite before My Little House that has any
  // story written reveals nothing at all.
  // ONLY RUNNABLE RITES CONTRIBUTE. An entry whose story is not written
  // has taught nobody anything, so it cannot be the reason a later rite
  // shows a control — otherwise placing My Garden second would put its
  // tile into the third rite today, in front of a child who has never
  // been taught it, which is exactly the leak this reduction exists to
  // prevent. It corrects itself: the moment the story is written the
  // rite becomes runnable and starts contributing, with no edit here.
  function _revealsFor(rite){
    const out=[];
    for(let i=0;i<RITES.length;i++){
      if(RITES[i]===rite || _runnable(RITES[i])){
        (RITES[i].reveals||[]).forEach(function(c){ if(out.indexOf(c)<0) out.push(c); });
      }
      if(RITES[i]===rite) break;
    }
    return out;
  }
  function _applyReveals(rite){
    try{
      _revealsFor(rite).forEach(function(c){
        document.body.classList.add('studio-rite-shows-'+c);
      });
    }catch(e){}
  }

  function _clearReveals(){
    try{
      const cl=document.body.classList;
      Array.prototype.slice.call(cl).forEach(function(c){
        if(c.indexOf('studio-rite-shows-')===0) cl.remove(c);
      });
    }catch(e){}
  }

  function _teardown(){
    _running=false;
    _clearCues();
    // The rite's own reveal classes come off below; the child's own
    // taught set goes on in their place, so the Studio never blinks
    // through a moment of holding everything.
    try{ applyTaught(); }catch(e){}
    // The Studio's own content rules own the buttons from here.
    try{ if(typeof window.refreshStoryActions==='function') window.refreshStoryActions(); }catch(e){}
    if(_paperGuard){ try{ _paperGuard(); }catch(e){} _paperGuard=null; }
    if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
    if(_yieldTimer){ clearInterval(_yieldTimer); _yieldTimer=null; }
    if(_stepTimer){ clearTimeout(_stepTimer); _stepTimer=null; }
    if(_growthWatch){
      try{ document.removeEventListener('vihu:creation-captured',_growthWatch); }catch(e){}
      _growthWatch=null;
    }
    if(_horizonWatch){ try{ window.removeEventListener('resize',_horizonWatch); }catch(e){} _horizonWatch=null; }
    if(_dockWatch){ try{ window.removeEventListener('resize',_dockWatch); }catch(e){} _dockWatch=null; }
    if(_dockUnobserve){ try{ _dockUnobserve(); }catch(e){} _dockUnobserve=null; }
    try{ document.body.classList.remove('studio-rite-beside'); }catch(e){}
    try{ document.body.style.removeProperty('--rite-list-max'); }catch(e){}
    try{ document.body.style.removeProperty('--rite-band-h'); }catch(e){}
    try{ document.body.classList.remove('studio-rite-running'); }catch(e){}
    _clearReveals();
    _clearNudge();
    _hush();
    if(_timer){ clearTimeout(_timer); _timer=null; }
    if(_unobserve){ try{ _unobserve(); }catch(e){} _unobserve=null; }
    // Canon 2 — Lumo appears only at a threshold and is torn down when
    // it ends. He must never persist into the Studio widget, which
    // js/app.js's own CompanionDirector.init() mounts with the correct
    // Traveller entity.
    try{ if(_els&&_els.overlay&&_els.overlay.parentNode) _els.overlay.parentNode.removeChild(_els.overlay); }catch(e){}
    _els=null; _packs={};
  }

  // The Rite's second half plays over the LIVE Studio, so the
  // full-screen stage becomes a quiet band along the bottom. Same DOM,
  // same Lumo, same bubble — only the styling changes, so the child
  // never experiences a scene cut between "being told" and "making".
  function _toBandMode(){
    if(!_els) return;
    _els.overlay.classList.add('studio-rite-band');
    _els.overlay.classList.add('studio-rite-has-mission');
    _placeDock();
    _watchForModal();
    _watchForGrowth();
    if(!_dockWatch){
      _dockWatch=function(){ _placeDock(); };
      try{ window.addEventListener('resize',_dockWatch); }catch(e){}
      // The page list grows as the child copies pages, which pushes the
      // top of the dock down. PageRuntime is the one thing that knows.
      try{
        if(typeof PageRuntime!=='undefined' && PageRuntime.observe)
          _dockUnobserve=PageRuntime.observe(_dockWatch);
      }catch(e){}
    }
  }

  // Measures the left rail and decides where the Rite speaks from.
  //
  // The dock is the product owner's call, and the measurements back it:
  // the column under the page thumbnails is the one part of the editor
  // nothing else ever claims, and moving the conversation there gives
  // the child's page back the whole 100px the bottom band was taking —
  // 265px to 363px at 1360x596, a 37% larger canvas.
  //
  // Everything is read live rather than hardcoded: the sidebar's width
  // changes at five breakpoints, and the thumbnails the dock sits under
  // grow with the story. Below 768px the workspace collapses to a single
  // column and the sidebar becomes a strip across the top — there is no
  // rail to dock into, so the bottom band stays as the fallback rather
  // than the conversation being crammed somewhere it cannot be read.
  // Publish Studio opens at z-index 300; the Rite's dock sits at 1400,
  // so without this the dock would render straight over the top of it —
  // the same "two guides at once" defect as two Lumos. The sharing beat
  // is exactly when this happens, so the Rite stands down for as long as
  // the modal is up and comes back when it closes.
  //
  // A poll rather than :has() or a MutationObserver: nothing else in
  // this stylesheet depends on :has() yet and a silent failure here
  // would be invisible, while an observer over the whole body is a lot
  // of machinery for one boolean.
  //
  // AND THE TWO CATCHERS ARE THE SAME SITUATION. Reported by the product
  // owner mid-Rite II: the band was sitting straight over the letter
  // catcher, covering the camera and its buttons. `.hw-studio-modal`
  // opens at z-index 1000 and the dock sits at 1400 — the identical
  // stacking the Publish note above describes, arriving from a screen
  // nobody had listed. It is worse here than it is for Publish: the beat
  // says *hold your letter up so I can see it* while Lumo covers the
  // very camera it is asking them to hold it up to.
  //
  // The catcher is its own chapter and carries its own instruction
  // ("Show me your k", a camera, Take the picture), so the Rite stands
  // all the way down and comes back the moment it closes — the same
  // "two guides at once" rule, not a new one.
  //
  // The list is the one place this is written down. A future full-screen
  // step in a rite belongs in it, in the commit that adds the step.
  const YIELD_TO=[
    // Publish opens hidden and is toggled, so its own hidden flag decides.
    {sel:'.publish-studio-modal', open:function(m){ return !m.classList.contains('hidden'); }},
    // The catchers are built when they open and removed when they close,
    // so their presence IS the answer.
    {sel:'.hw-studio-modal'},
    {sel:'.bia-studio-modal'}
  ];
  // LUMO STEPS ASIDE WHILE THE GARDEN GROWS.
  //
  // "the lumo should disappear or get to a side so that child can see
  // the garden grow in front of himself" — the product owner, watching
  // Rite II. Measured at 1359x800: `.preview-wrapper` starts at x=296
  // and the band sits at x=296, 231px wide, so it covers the WHOLE of
  // the left growth band Decision 27 puts the garden in. The child is
  // told their letter is being kept in their garden and then cannot see
  // it happen.
  //
  // A moment, never a relocation. Growth answers in about 1.5s, so the
  // band goes quiet for a little longer than that and comes straight
  // back — the alternative, docking Lumo somewhere else for the whole
  // beat, costs his words for the entire beat to fix one second of it.
  //
  // It rides `vihu:creation-captured`, the SAME one event the Garden
  // itself grows on (Decision 27: one event, a capture id, deliberately
  // no type field), so this learns nothing about cameras, letters or
  // drawings and a future capture source gets the behaviour for free.
  //
  // Reduced motion suppresses the growth animation entirely, so there
  // is nothing to step aside FOR — and stepping aside would then just
  // be Lumo vanishing for no reason.
  const STEP_ASIDE_MS=2200;
  let _stepTimer=null;
  function _watchForGrowth(){
    if(_growthWatch) return;
    _growthWatch=function(){
      if(!_els) return;
      try{
        if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      }catch(e){}
      // Only when the band is actually in the way. On a garden beat it
      // is docked in the rail (see _prefersRail) and the workspace is
      // already clear, so fading Lumo there would be a guide vanishing
      // for no reason a child could see. True rail mode is the docked
      // class WITHOUT the beside one.
      try{
        const cl=_els.overlay.classList;
        if(cl.contains('studio-rite-rail') && !cl.contains('studio-rite-beside')) return;
      }catch(e){}
      try{ _els.overlay.classList.add('studio-rite-aside'); }catch(e){}
      if(_stepTimer) clearTimeout(_stepTimer);
      _stepTimer=setTimeout(function(){
        _stepTimer=null;
        try{ if(_els) _els.overlay.classList.remove('studio-rite-aside'); }catch(e){}
      },STEP_ASIDE_MS);
    };
    try{ document.addEventListener('vihu:creation-captured',_growthWatch); }catch(e){}
  }

  function _watchForModal(){
    if(_yieldTimer) return;
    _yieldTimer=setInterval(function(){
      if(!_els){ return; }
      let covered=false;
      for(let i=0;i<YIELD_TO.length && !covered;i++){
        try{
          const spec=YIELD_TO[i];
          const m=document.querySelector(spec.sel);
          covered=!!(m && (!spec.open || spec.open(m)));
        }catch(e){}
      }
      try{ _els.overlay.classList.toggle('studio-rite-yield',covered); }catch(e){}
    },350);
  }

  // THE LEFT RAIL WINS ON A GARDEN BEAT.
  //
  // "lumo screen is still there. you can collapse it and just keep i did
  // it button, or move lumo and idid it button to left pane as there is
  // only single page there." — the product owner, on the naming beat.
  // The 2.2s step-aside a capture triggers is right for the growth
  // itself and does nothing for the rest of the beat, which is where a
  // child spends most of it: going back for the next letter, watching
  // the garden between times.
  //
  // Beside-the-page is his OWN earlier preference and stays the default
  // for every other beat — this only overrides it where the two
  // preferences actually collide, which is the beats whose whole subject
  // is a garden growing in the very gutter Lumo is standing in. The rail
  // is empty on a rite: a rite runs on a blank page with one thumbnail
  // in it, which is exactly the observation he made.
  function _prefersRail(){
    // wantsRoom() is non-null on precisely the garden beats, so this
    // reads the story rather than a list of gate ids kept in step by
    // hand.
    return !!wantsRoom();
  }

  function _placeDock(){
    if(!_els) return;
    const ov=_els.overlay;
    let mode='band';
    try{
      const area=document.querySelector('.preview-area');
      const canvas=document.getElementById('previewCanvas');
      const sidebar=document.querySelector('.sidebar:not(.right-sidebar)');
      const list=document.getElementById('slideList');
      const railFirst=_prefersRail();

      // 1. BESIDE THE PAGE — the product owner's preference, and the
      //    closest Lumo can stand to the thing he is talking about.
      //
      //    The page is normally centred in its stage, which splits the
      //    free space into two gutters too narrow to read in: 133px each
      //    at 1343x800, measured. So while the Rite runs the page is
      //    pushed to the RIGHT of the stage instead, which hands both
      //    gutters to Lumo as one column — 249px at 800, 430px at 596 —
      //    and costs the page nothing: it keeps its full height either
      //    way. The Selection Action Strip still has its own room on the
      //    far side (it needs 160px past the canvas; there are 332).
      if(area&&canvas&&!railFirst){
        const ar=area.getBoundingClientRect();
        const cr=canvas.getBoundingClientRect();
        const gutter=Math.round(ar.width-cr.width-32);
        if(gutter>=210 && ar.height>=260){
          const width=Math.min(320,gutter-24);
          // Sit against the page, not against the far wall — "beside the
          // page" is the whole point. The page's post-push left edge is
          // computed rather than measured, because on the first pass the
          // page has not been pushed yet and its current position would
          // put Lumo in the wrong place for one frame.
          const pageLeft=ar.right-16-cr.width;
          const left=Math.max(Math.round(ar.left+8),Math.round(pageLeft-24-width));
          ov.style.setProperty('--rite-dock-left',left+'px');
          ov.style.setProperty('--rite-dock-top',Math.round(ar.top+16)+'px');
          ov.style.setProperty('--rite-dock-width',width+'px');
          ov.style.setProperty('--rite-dock-height',Math.round(ar.height-32)+'px');
          mode='beside';
        }
      }

      // 2. THE LEFT RAIL — when the page is wide enough to leave no
      //    usable gutter. The page list is capped so the column below it
      //    can never be squeezed out: at three pages the thumbnails grow
      //    from 78px to 254px, which on a 596px window left the dock
      //    202px and dropped the whole Rite back to a strip along the
      //    bottom. The list scrolls instead, and the nudge already
      //    scrolls a page's own menu button into view when it points.
      if(mode==='band' && sidebar && list){
        const sr=sidebar.getBoundingClientRect();
        const lr=list.getBoundingClientRect();
        const ar2=area?area.getBoundingClientRect():null;
        const cs=getComputedStyle(sidebar);
        const padL=parseFloat(cs.paddingLeft)||0;
        const padR=parseFloat(cs.paddingRight)||0;
        const width=Math.round(sr.width-padL-padR);
        // Measuring the sidebar's SIZE cannot tell a left column from a
        // collapsed strip across the top — at a 700px viewport the
        // collapsed sidebar is 668px wide, past any threshold, and
        // docking there put the conversation over the page. Its right
        // edge clearing the stage's left edge is the real test.
        const isLeftColumn=!ar2 || (sr.right<=ar2.left+2);
        const bottomLimit=window.innerHeight-16;
        const DOCK_MIN=300;
        const listMax=Math.max(110,Math.round(bottomLimit-DOCK_MIN-14-lr.top));
        const listH=Math.min(Math.round(lr.height),listMax);
        const top=Math.round(Math.max(lr.top+listH+14,sr.top+14));
        const height=Math.round(bottomLimit-top);
        if(isLeftColumn && width>=180 && height>=220){
          document.body.style.setProperty('--rite-list-max',listMax+'px');
          ov.style.setProperty('--rite-dock-left',Math.round(sr.left+padL)+'px');
          ov.style.setProperty('--rite-dock-top',top+'px');
          ov.style.setProperty('--rite-dock-width',width+'px');
          ov.style.setProperty('--rite-dock-height',height+'px');
          mode='rail';
        }
      }
    }catch(e){}

    try{
      ov.classList.toggle('studio-rite-rail',mode!=='band');
      ov.classList.toggle('studio-rite-beside',mode==='beside');
      document.body.classList.toggle('studio-rite-beside',mode==='beside');
      if(mode!=='rail') document.body.style.removeProperty('--rite-list-max');
    }catch(e){}

    if(mode!=='band'){
      // A docked Rite covers nothing, so the preview column keeps every
      // pixel of its height — release the reservation the band needed.
      if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
      try{ document.body.style.removeProperty('--rite-band-h'); }catch(e){}
    }else{
      _liftBandClearOfStrip();
    }
  }


  // The Object Strip sits at the very bottom of the editor and is the
  // only DOM affordance a child has for selecting an object on a canvas
  // page — the nudge points at it. The band also wants the bottom of the
  // screen. Both cannot have it, so the band is lifted to sit directly
  // above the Strip, measured live rather than hardcoded.
  // Keeps `--rite-band-h` on <body> in step with the band's real
  // height. The preview column reads it and gives up exactly that much
  // room, so the child's page is never underneath the band. Falls back
  // to a single measurement where ResizeObserver is unavailable, which
  // is still right for the common case (the band's height is set by its
  // two rows, and both are laid out by then).
  function _watchBandHeight(){
    const write=function(){
      try{
        const p=_els&&_els.panel;
        const h=p?Math.round(p.getBoundingClientRect().height):0;
        document.body.style.setProperty('--rite-band-h',(h>0?h:0)+'px');
      }catch(e){}
    };
    if(_bandRO){ try{ _bandRO.disconnect(); }catch(e){} _bandRO=null; }
    try{
      if(typeof ResizeObserver!=='undefined' && _els && _els.panel){
        _bandRO=new ResizeObserver(write);
        _bandRO.observe(_els.panel);
      }
    }catch(e){}
    requestAnimationFrame(write);
  }

  function _liftBandClearOfStrip(){
    try{
      const strip=document.querySelector('.object-strip');
      let lift=0;
      if(strip){
        const r=strip.getBoundingClientRect();
        // Lift by exactly enough for the band's bottom edge to land on
        // the Strip's top edge. Keyed off where the Strip actually is,
        // not its height — it does not sit flush to the viewport bottom.
        if(r.height>0 && r.bottom>window.innerHeight*0.6){
          lift=Math.max(0,Math.round(window.innerHeight-r.top));
        }
      }
      _els.overlay.style.setProperty('--rite-band-lift',lift+'px');
      // Keep the band out of the right panel entirely. It spans the full
      // width otherwise, dimming the very controls the nudge points at.
      let inset=0;
      try{
        const panel=document.querySelector('.context-zone-personalize')
                 || document.querySelector('.context-panel-root');
        if(panel){
          const pr=panel.getBoundingClientRect();
          if(pr.width>0 && pr.right>window.innerWidth*0.6){
            inset=Math.max(0,Math.round(window.innerWidth-pr.left+8));
          }
        }
      }catch(e){}
      _els.overlay.style.setProperty('--rite-band-inset',inset+'px');
      // The band used to simply float over the editor, and on a short
      // viewport it covered the bottom of the child's own page — 83px
      // of it, measured at 1359x581. Publishing the band's real height
      // onto <body> lets the preview column give up exactly that much,
      // so the page shrinks to fit above the band instead of hiding
      // behind it. No circularity: the band's height is set by its own
      // text, and the column reacting to it never changes that.
      //
      // Measured continuously, not once: the band grows and shrinks as
      // lines accumulate and screens change, and a height read a single
      // time at the start would be wrong for most of the Rite.
      _watchBandHeight();
    }catch(e){}
  }

  // The whole Rite: Act I (Where am I?) - Act II (Who am I?) -
  // Act III (What do I do here?) - Act IV (Why do stories matter?) -
  // Completion. Marks completion only on a genuine full run.
  // `rite` is optional and defaults to the mandatory one, so the gate
  // below calls this exactly as it always did.
  function run(next,rite){
    if(typeof window.CompanionEngine==='undefined' || !window.CompanionEngine.loadRegistry){
      next(); return;
    }
    _rite=rite||_mandatoryRite();
    _running=true;
    _actionsUnlocked=false;
    // next() boots the Studio. It happens PART WAY through the Rite —
    // at the moment the child says yes — because Acts III onward need
    // the real editor underneath. Guarded so it fires exactly once no
    // matter which path gets there, including every failure path.
    let handedOff=false;
    const handOff=function(){
      if(handedOff) return;
      handedOff=true;
      try{ next(); }catch(e){}
    };
    // Any failure after hand-off must still clear the Rite's own UI,
    // never leave a child looking at a half-played chapter.
    const abandon=function(){ _teardown(); handOff(); };

    try{
      try{ document.body.classList.add('studio-rite-running'); }catch(e){}
      // THE RITE OWNS THE STUDIO'S SHAPE, AND HAS TO TAKE IT.
      //
      // Reported by the product owner walking Rite II: beat 2 says "your
      // letters live on the right, with the things you can add" and My
      // Garden was not there. Measured, the body carried BOTH families
      // of classes at once — `studio-rite-shows-garden` from the rite,
      // and `studio-gated` with no `studio-taught-garden` from the
      // child's own record. Both are `display:none !important` rules on
      // the same tile and neither knows about the other, so the gate
      // simply won and the rite could not hand its own subject over.
      //
      // It is the exact hazard Decision 22 records for these two
      // families, arriving from the direction nobody watched: not a rule
      // that names the wrong capability, but two correct rules left
      // switched on together. Rite II was unwalkable for precisely the
      // population it exists for — a child who has finished Rite I and
      // therefore HAS a record to be gated by.
      //
      // applyTaught() already encodes the right answer (it strips both
      // `studio-gated` and every `studio-taught-*`, then returns early
      // while a rite is running), so calling it here is one source of
      // truth rather than a second rule that could disagree with it.
      try{ applyTaught(); }catch(e){}
      _applyReveals(_rite);
      _els=_buildStage();

      requestAnimationFrame(function(){ if(_els) _els.overlay.classList.add('studio-rite-in'); });
      window.CompanionEngine.loadRegistry(ASSETS_BASE).then(function(regList){
        // The artwork resolves ALONGSIDE the companion packs rather than
        // racing screen 1. It used to land part way through the first
        // screen, and because the grounded layout only applies once the
        // artwork is really there, Lumo jumped the moment it arrived.
        // Joined here it is still parallel — it simply cannot be late.
        return Promise.all([_loadPack(regList,'guardian'),_loadPack(regList,'traveller'),
                            _resolveStageBg()]);
      }).then(function(packs){
        _packs={guardian:packs[0],traveller:packs[1]};
        _stageBg=packs[2];
        // No Lumo package at all means no guide — the Rite cannot be
        // performed, so hand straight off rather than showing a child
        // an empty stage.
        if(!_packs.guardian){ abandon(); return null; }
        // A rite that begins in a Studio that is already open makes its
        // own blank story here, the way the first rite makes one on the
        // screen that boots the Studio. Same call, same plain-paper
        // guard, same reason: these stories run on paper, with no World.
        // An opt-in rite may already be holding a story from a sitting
        // the child did not finish. That one is reopened rather than a
        // second one being made — see _openHeld(). Awaited, because the
        // beats that follow read the page it puts back.
        var opened=Promise.resolve();
        if(_rite.startsBlank){
          handOff();
          opened=_openHeld().then(function(resumed){
            if(!resumed) _blankStart();
            try{ if(typeof window.refreshStoryActions==='function') window.refreshStoryActions(); }catch(e){}
            return resumed;
          });
        }
        return opened.then(function(resumed){
        // WHERE THE CHILD HAD GOT TO IS DERIVED, NEVER STORED.
        //
        // Decision 22's own rule is that rites will be added, split and
        // reordered over the product's life — which is exactly why the
        // product stores CAPABILITIES and not a rite index. A saved beat
        // number would rot on the first reorder, and Rite II has gained
        // or reworded beats twice already. The gates are the truth about
        // what a child has done, so the position is read back off the
        // story itself.
        //
        // `seen` is what makes a repeated gate work: the fourth
        // `shape-added` beat needs a fourth shape, not any shape.
        // Stops at the first beat the story cannot account for — that
        // is where they were — and from there it is an ordinary rite
        // with a real baseline.
        var replaying=!!resumed;
        var seen={};
        _primeScreen(_rite.screens[0]);
        return _rite.screens.reduce(function(chain,screen,i){
          return chain.then(function(){
            var fast=false;
            if(replaying){
              var kind=screen.end && screen.end.await;
              if(kind){
                // Counted per POOL, not per gate — see DONE_POOL.
                var pool=_donePool(kind);
                seen[pool]=(seen[pool]||0)+1;
                fast=_doneCount(kind)>=seen[pool];
              }
              if(!fast) replaying=false;   // this is where they stopped
            }
            return _playScreen(screen,_rite.screens[i+1],fast).then(function(){
              // The screen the child says "Yes" on is the one that opens
              // the Studio: boot it underneath, then open a blank page
              // directly — no type screen, no World picker, and no Theme
              // Repository dependency (the Rite is mandatory and must
              // work on a first launch with no network).
              if(!screen.opensStudio) return;
              handOff();
              _blankStart();
            });
          });
        },Promise.resolve()).then(function(){
          // The one place the flag is ever written: a genuine, complete
          // run of the rite that unlocks the Studio. Reached only after
          // the child has actually made and named a story, so no
          // partial or abandoned Rite can unlock the Studio — and an
          // opt-in rite writes nothing at all, because nothing depends
          // on having taken it (docs/STUDIO_RITE_LEVELS.md §6).
          // The capabilities this story taught are the child's from
          // here on, whichever rite it was — that is the whole of
          // Decision 22's "the Rite's reduction outlives the Rite".
          // Granted BEFORE the teardown so the Studio revealed behind
          // the closing overlay is already the right size, and before
          // the Ceremony so the card minted a moment later is swept the
          // record rather than being handed an empty one.
          _grant(_rite);
          // The story becomes the child's own at the same moment the
          // capabilities do — one event, two consequences.
          _releaseStory();
          if(_rite.unlocksStudio){
            markComplete();
            _teardown();
            _offerCreatorCeremony();
            return;
          }
          _teardown();
        });
        });
      }).catch(abandon);
    }catch(e){ abandon(); }
  }

  // BECOMING A CREATOR IS FINISHING THE FIRST STORY, not sharing it.
  //
  // Decided by the product owner after asking why sharing was the
  // mandate: *"i will also lean towards 3"* — Rite I's completion
  // awakens the Magic Card, and sharing keeps its own weight afterwards.
  //
  // It reverses a stated principle, so the reasoning belongs here.
  // Canon 4 said the Ceremony "is never a reward for finishing
  // onboarding — the child earns it by making something and then giving
  // it to the world", and that reads well until you notice what a Magic
  // Card actually IS. It is not a badge. It is identity, and identity is
  // the only thing that makes a child's work survive: an unclaimed
  // Traveller's projects are wiped the next time a genuinely new session
  // starts (js/travellerSaveNotice.js), and a card is what backs them up
  // and recognises the child on another device (Decision 19).
  //
  // So the single thing protecting a child's work was gated behind a
  // PUBLIC ACT — and it fell hardest on the shy child, the one least
  // likely to give a story away and most likely to want a private
  // studio. Decision 22 had already noticed that case and kept it;
  // this is the same case, decided the other way.
  //
  // WHAT SHARING KEEPS: everything else. It is still the only thing that
  // puts a story in the Ether, still what stamps `publishedAt`, still
  // what plays the Story Birth. Only WHO holds a card changed, never
  // what sharing means.
  //
  // Order matters. The rite's own overlay comes down first, because the
  // Ceremony is a full-screen overlay of its own and would otherwise
  // open underneath one. A short beat after the teardown lets the
  // rite's closing line land rather than being cut off by a ceremony.
  //
  // Idempotent by construction: `shouldOfferAwakening()` is false once a
  // card exists, so a child who DID share on the rite's last beat
  // already had their Ceremony there and meets nothing here. This only
  // ever fires for the child who declined — which is exactly the child
  // the change is for.
  function _offerCreatorCeremony(){
    try{
      if(typeof MagicCard==='undefined' || typeof MagicCardUI==='undefined') return;
      if(!MagicCard.shouldOfferAwakening()) return;
      setTimeout(function(){
        try{
          if(!MagicCard.shouldOfferAwakening()) return;
          MagicCardUI.showAwakening(function(){});
        }catch(e){}
      },900);
    }catch(e){}
  }

  // The one entry point js/app.js calls. Never throws, never leaves the
  // user stranded: any failure anywhere falls through to `next` so a
  // broken Rite can never lock a child out of the Studio it gates.
  function gate(next){
    let handed=false;
    const done=function(){
      if(handed) return;
      handed=true;
      try{ next(); }catch(e){}
    };
    try{
      if(isComplete()){
        // RITE COMPLETE MEANS CREATOR, not "completed just now". Offering
        // only at the moment the rite ends would leave every child who
        // finished it BEFORE that rule existed permanently without a
        // card — the exact population the change was meant to protect.
        // Stated once, as a property of the state rather than of an
        // event, so there is nothing to backfill and no migration.
        // `shouldOfferAwakening()` makes it a no-op for anyone who
        // already holds one or has already been asked.
        _offerCreatorCeremony();
        done();
        return;
      }
      run(done);
    }catch(e){ done(); }
  }

  // Start a named rite over a Studio that is already open. This is the
  // seam the offer on Studio Home will call when it ships — the offer
  // itself is deliberately NOT built here (docs/STUDIO_RITE_LEVELS.md
  // §6: the last piece, and it cannot ship before every rite exists).
  // Refuses rather than stacking a second guide over the first.
  function start(id){
    if(_running) return false;
    const rite=_riteById(id);
    // A rite whose story is not written refuses rather than opening an
    // empty one. It returns false like every other refusal here, so a
    // caller that checks — which the Studio Home offer does — falls back
    // to the screen it always had.
    if(!_runnable(rite)) return false;
    run(function(){},rite);
    return true;
  }

  // The registry itself, read-only: id and the capabilities each rite
  // teaches. No ordinal, no level number, and nothing that has to be
  // counted to be understood.
  function rites(){
    return RITES.map(function(r){
      return {id:r.id, teaches:(r.teaches||[]).slice(),
              // What an EARLIER rite's story hands back on top of what it
              // teaches. Projected here for the same reason `teaches` is:
              // a caller deciding what a child has been through needs the
              // whole set, and reading it off the registry is the only way
              // to do that without hard-coding an ordinal.
              reveals:(r.reveals||[]).slice(),
              mandatory:!!r.unlocksStudio,
              runnable:_runnable(r)};
    });
  }

  return {
    isComplete:isComplete,
    isRunning:isRunning,
    actionsUnlocked:actionsUnlocked,
    markComplete:markComplete,
    gate:gate,
    rites:rites,
    start:start,
    taught:taught,
    isGrandfathered:isGrandfathered,
    nextOptIn:nextOptIn,
    hasHeldStory:hasHeldStory,
    wantsRoom:wantsRoom,
    // Harness only, beside _gates and _gateMet: which element a nudge
    // would actually light for a gate right now. A nudge that points at
    // the control a child has already tapped is the failure this was
    // added to catch, and nothing else could see it.
    // Harness only, beside _gates/_gateMet/_nudgeTarget: which gate the
    // story is standing on right now. A suite that can read this can
    // walk a rite by satisfying exactly the thing being asked for,
    // instead of guessing at every control and fighting the beats it is
    // not on — which is how a driver ends up adding sixty objects to a
    // page and still never passing.
    _awaitingGate:function(){ return _awaiting; },
    _nudgeTarget:function(kind){
      try{ return (NUDGE[kind] && NUDGE[kind].find()) || null; }catch(e){ return null; }
    },
    applyTaught:applyTaught,
    TAUGHT_KEY:TAUGHT_KEY,
    FLAG_KEY:FLAG,
    // Internal — exposed for the test harness only, the same way
    // js/publishStudio.js exposes its stage and its artifacts.
    //
    // The gate a beat waits on is DATA, and it went wrong precisely
    // because nothing could read it: Rite I asked a child to finish
    // while waiting for them to share, and every suite in the product
    // was blind to the difference. `_gates` makes that readable, and
    // `_gateMet` lets a suite ask a live condition what it currently
    // answers — which is the only way to prove a latch.
    _gates:function(riteId){
      const r=riteId ? _riteById(riteId) : _mandatoryRite();
      if(!r || !Array.isArray(r.screens)) return null;
      return r.screens.map(function(sc){
        return (sc.end && sc.end.await) || null;
      });
    },
    // Harness only. The gate each beat waits on AND whether that beat
    // wakes the header's two story actions, in order.
    //
    // The Rite holds Play My Story and Finish Story shut for its whole
    // run, and only a screen carrying `unlock:true` wakes them. Rite
    // II's own play beat did not carry it, so its last beat asked a
    // child to press a control that was greyed out — a rite that could
    // not be finished. Nothing could see that, because nothing could
    // read the two facts together.
    _beats:function(riteId){
      const r=riteId ? _riteById(riteId) : _mandatoryRite();
      if(!r || !Array.isArray(r.screens)) return null;
      return r.screens.map(function(sc){
        return {gate:(sc.end && sc.end.await)||null, unlock:!!sc.unlock};
      });
    },
    _gateMet:function(kind,baseline){ return _conditionMet(kind,baseline||null); }
  };
})();
try{ window.StudioRite=StudioRite; }catch(e){}
