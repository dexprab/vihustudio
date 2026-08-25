// magicCard.js — Magic Card Identity Evolution.
//
// Implements the data/state layer behind docs/artifact "VihuStudio —
// Magic Card Identity Evolution" (Product Architecture & UX Design).
// Phase 1 (shipped first) was exactly that document's own Product
// Recommendations §1 scope: "the awakening moment on first Publish,
// with claiming initially just meaning 'this device recognizes you' —
// no cross-device recall yet," 100% local (localStorage only).
//
// This file now also implements Phase 2 — Cloud Identity + Recall:
// once a card is claimed, its identity is mirrored to Supabase
// (magic_card_identities, supabase/schema.sql) continuously in the
// background, and a NEW device can recall it by tapping the same
// pattern (recall_magic_card RPC). Local stays authoritative for
// everything the child actually interacts with — every cloud call
// below is fire-and-forget, never on the hot path of claim/rename/
// touch, and a Traveller (no claimed card) never triggers a single
// network call, unchanged from Phase 1.
//
// The central design decision from the design document: a claimed
// Magic Card's constellation pattern is minted ONCE, at claim time,
// and never changes — it is both the "sky" a child sees as their
// identity AND the tap gesture that recalls their card elsewhere.
// Everything described as "the sky growing" is presentation layered on
// top of this fixed pattern, computed live from real usage signals
// (see growthSignals()) — never a second stored, mutable copy of the
// pattern itself.
//
// A genuinely new claimed Magic Card is NOT the same concept as a World
// Card (js/cardPlatform.js) — that module mints a *shareable* card
// pointing at a World, redeemed by someone else. This module mints a
// *personal* card representing "this device recognizes you" — no
// sharing, no redemption by a third party; that is also why it has its
// own Supabase tables (magic_card_identities/magic_card_recalls) rather
// than reusing the reserved-but-unused card_type='creator' enum value
// in `cards` — investigation confirmed that value was never actually
// scoped to mean this. The constellation placement math
// (_placeConstellation) is intentionally duplicated rather than reused
// directly from cardPlatform.js: it's a handful of small, pure, stable
// functions with zero Supabase dependency of their own, and
// cardPlatform.js's own version is entangled with the World Card
// `pattern`/`code` generate() flow this module has no reason to depend
// on. The cloud calls below instead reuse
// ThemeRepositoryClient.getClient()/.getSession() directly — the same
// reuse convention cardPlatform.js already established for its own
// Supabase access.
//
// Companion Canon V2 (docs/COMPANION_CANON.md) makes this module also
// own the Creator-Companion Bond: assignBondedCompanion()/
// ensureBondedCompanion() below implement "the Companion chooses the
// Creator" — a real, deliberately isolated random pick from every
// registry entry with role:'companion' (js/companionEngine.js's
// loadRegistry, unchanged), never a role match (that's how Lumo, the
// never-bonding Guardian, and the Story Egg, the never-bonded Traveller
// entity, both already resolve — see js/companionDirector.js). A card's
// bonded companion is set exactly once, at claim() (or inherited
// verbatim from the identity's own row on a cross-device adopt()), and
// is never re-rolled afterward.
const MagicCard=(function(){
  'use strict';

  const CARDS_KEY='vihu-magic-cards';
  const ACTIVE_KEY='vihu-magic-card-active-id';
  const FLAGS_KEY='vihu-magic-card-flags';
  const CLOUD_SYNC_DEBOUNCE_MS=2000;

  // ---------------------------------------------------------------
  // THE CANON CONSTELLATION LIBRARY.
  //
  // Seventeen real constellations, each reduced to the few prominent
  // stars a child needs to recognise it. The goal is recognition and
  // mythology, not astronomical precision — no attempt is made to plot
  // every star, and the grid is 10x10, so these are the shapes as they
  // are DRAWN in a star atlas rather than as they are measured.
  //
  // A FAMILY IS NOT AN IDENTITY. Two Creators can both be given Lyra;
  // they are different Creators because their exact cells differ, and
  // the exact canonical cell set is the only thing recognition ever
  // compares (canonical() below, _card_platform_sort_pattern in
  // supabase/schema.sql). Nothing anywhere uses the family name, or
  // family-plus-rotation, as a Creator id.
  //
  // Each entry's ARRAY ORDER is the connecting line — the order a child
  // would trace it — and is what drawBack() and the drawing board join.
  // The order is chosen to draw the constellation as an atlas draws it,
  // and never to cross itself.
  //
  // js/cardPlatform.js has its own CONSTELLATIONS for World Cards. Those
  // two tables used to be kept in lockstep; they are now deliberately
  // different, because a World Card is a shareable pointer to a World
  // and a Magic Card is a child's identity, and only the latter needed
  // a real library. Neither reads the other.
  const CONSTELLATIONS={
    // ---- the five that already existed, UNCHANGED ----
    // Every card ever minted carries cells from these, and altering a
    // base shape would strand those cards' tracing (their cells would
    // match no placement of the new shape). Left exactly as they were.
    ORION:[[1,2],[1,7],[4,4],[4,5],[4,6],[8,2],[8,7]],
    CASSIOPEIA:[[2,1],[4,3],[2,5],[4,7],[2,9]],
    URSA_MAJOR:[[1,1],[1,4],[3,4],[3,2],[4,5],[6,7],[8,8]],
    CYGNUS:[[1,5],[4,5],[4,2],[7,5],[4,8]],
    LYRA:[[2,5],[5,3],[5,7],[7,3],[7,7]],

    // ---- the twelve added by this sprint ----
    // Traced top of the kite, down the long axis, then the crossbar —
    // the Southern Cross as the "kite" it is often called.
    CRUX:[[0,3],[3,0],[6,2],[3,5]],
    // The fish hook: head, down the body, round the curve, the sting.
    SCORPIUS:[[0,0],[1,1],[3,1],[5,1],[6,2],[7,4],[6,5]],
    // The Sickle first (backwards question mark), then the body back to
    // Denebola at the tail.
    LEO:[[0,3],[0,4],[1,5],[2,5],[3,4],[3,1],[4,0]],
    // The Hyades V — the bull's face, traced down one horn and up the
    // other.
    TAURUS:[[0,0],[1,1],[2,2],[3,3],[2,4],[1,5],[0,6]],
    // Two figures joined at the feet, which is how the twins are drawn.
    GEMINI:[[0,0],[1,1],[2,1],[3,0],[3,4],[2,4],[1,3],[0,3]],
    // Sirius at the head, then the dog's shoulders, foreleg and hind.
    CANIS_MAJOR:[[0,2],[2,3],[2,1],[3,0],[4,2],[5,3]],
    // The water jar as a small diamond, then the stream falling away.
    AQUARIUS:[[0,1],[1,0],[1,2],[2,1],[4,0],[5,2],[6,1]],
    // The Great Square, walked round three sides, then the neck.
    PEGASUS:[[4,0],[0,0],[0,4],[4,4],[5,5],[6,6]],
    // The ram's horn: a short bent line.
    ARIES:[[2,0],[2,1],[1,3],[0,4]],
    // Three stars and nothing else — the smallest sky in the library.
    TRIANGULUM:[[0,2],[2,0],[2,3]],
    // Job's Coffin, the little diamond, with its tail.
    DELPHINUS:[[0,1],[1,0],[2,1],[1,2],[4,2]],
    // The arrow: a shaft and its fletching.
    SAGITTA:[[1,0],[1,2],[0,3],[2,3]],
    // The northern crown, an arc that does not quite close.
    CORONA_BOREALIS:[[3,0],[1,1],[0,2],[0,4],[1,5],[2,6]]
  };

  // What each family IS, for anything that wants to say so. Nothing in
  // recognition reads this; it is description, not identity.
  //
  // `mintable:false` means the family still draws and still traces —
  // every card already carrying it keeps working — but no NEW card is
  // given it. Ursa Major is the only one: it is a real constellation
  // and real cards carry it, and it is not in the seventeen this sprint
  // was asked for, so it is kept rather than deleted.
  const CONSTELLATION_META={
    ORION:{id:'orion',name:'Orion',family:'Orion',stars:7,hemisphere:'both',
      about:'The Hunter. Two shoulders, the three stars of Orion’s Belt, and two feet.',mintable:true},
    CASSIOPEIA:{id:'cassiopeia',name:'Cassiopeia',family:'Perseus',stars:5,hemisphere:'north',
      about:'The Queen. Five stars in the shape of a W.',mintable:true},
    URSA_MAJOR:{id:'ursa_major',name:'Ursa Major',family:'Ursa Major',stars:7,hemisphere:'north',
      about:'The Great Bear, whose brightest stars make the Plough.',mintable:false},
    CYGNUS:{id:'cygnus',name:'Cygnus',family:'Hercules',stars:5,hemisphere:'north',
      about:'The Swan, flying along the Milky Way. Also called the Northern Cross.',mintable:true},
    LYRA:{id:'lyra',name:'Lyra',family:'Hercules',stars:5,hemisphere:'north',
      about:'The Lyre of Orpheus, hung in the sky beside bright Vega.',mintable:true},
    CRUX:{id:'crux',name:'Crux',family:'Hercules',stars:4,hemisphere:'south',
      about:'The Southern Cross, the smallest constellation and a signpost to the south.',mintable:true},
    SCORPIUS:{id:'scorpius',name:'Scorpius',family:'Zodiac',stars:7,hemisphere:'south',
      about:'The Scorpion, curling to a sting, with red Antares at its heart.',mintable:true},
    LEO:{id:'leo',name:'Leo',family:'Zodiac',stars:7,hemisphere:'both',
      about:'The Lion. The Sickle makes his mane, and Denebola his tail.',mintable:true},
    TAURUS:{id:'taurus',name:'Taurus',family:'Zodiac',stars:7,hemisphere:'both',
      about:'The Bull. The V of the Hyades makes his face, with Aldebaran as his eye.',mintable:true},
    GEMINI:{id:'gemini',name:'Gemini',family:'Zodiac',stars:8,hemisphere:'north',
      about:'The Twins, Castor and Pollux, standing side by side.',mintable:true},
    CANIS_MAJOR:{id:'canis_major',name:'Canis Major',family:'Orion',stars:6,hemisphere:'south',
      about:'The Great Dog, following Orion, led by Sirius — the brightest star in the sky.',mintable:true},
    AQUARIUS:{id:'aquarius',name:'Aquarius',family:'Zodiac',stars:7,hemisphere:'both',
      about:'The Water Bearer, pouring a stream of stars from a jar.',mintable:true},
    PEGASUS:{id:'pegasus',name:'Pegasus',family:'Perseus',stars:6,hemisphere:'north',
      about:'The Winged Horse. Four stars make the Great Square.',mintable:true},
    ARIES:{id:'aries',name:'Aries',family:'Zodiac',stars:4,hemisphere:'north',
      about:'The Ram, a short bent line making his curling horn.',mintable:true},
    TRIANGULUM:{id:'triangulum',name:'Triangulum',family:'Perseus',stars:3,hemisphere:'north',
      about:'The Triangle. Three stars, and that is all it needs.',mintable:true},
    DELPHINUS:{id:'delphinus',name:'Delphinus',family:'Heavenly Waters',stars:5,hemisphere:'north',
      about:'The Dolphin, leaping. Its diamond is called Job’s Coffin.',mintable:true},
    SAGITTA:{id:'sagitta',name:'Sagitta',family:'Hercules',stars:4,hemisphere:'north',
      about:'The Arrow, small and sharp, flying between the Swan and the Eagle.',mintable:true},
    CORONA_BOREALIS:{id:'corona_borealis',name:'Corona Borealis',family:'Ursa Major',stars:6,hemisphere:'north',
      about:'The Northern Crown, an arc of stars that never quite closes.',mintable:true}
  };

  const GRID_SIZE=10;

  function _minOf(points,idx){ return points.reduce(function(m,p){ return Math.min(m,p[idx]); },Infinity); }
  function _maxOf(points,idx){ return points.reduce(function(m,p){ return Math.max(m,p[idx]); },-Infinity); }
  function _shiftToOrigin(points){
    const minR=_minOf(points,0), minC=_minOf(points,1);
    return points.map(function(p){ return [p[0]-minR,p[1]-minC]; });
  }
  function _rotate(points,turns){
    let pts=points;
    for(let i=0;i<turns;i++){
      const maxR=_maxOf(pts,0);
      pts=pts.map(function(p){ return [p[1],maxR-p[0]]; });
    }
    return pts;
  }
  function _mirrorHorizontal(points){
    const maxC=_maxOf(points,1);
    return points.map(function(p){ return [p[0],maxC-p[1]]; });
  }
  // `rand` defaults to Math.random (every existing caller — generatePattern()/
  // claim()'s own fallback — is unaffected) but accepts any 0..1 generator,
  // which is what makes decorativeSkyFor() below possible without a second
  // copy of this placement algorithm.
  function _placeConstellation(name,rand){
    rand=rand||Math.random;
    const base=CONSTELLATIONS[name];
    if(!base) return null;
    for(let attempt=0;attempt<20;attempt++){
      let pts=_shiftToOrigin(base);
      pts=_rotate(pts,Math.floor(rand()*4));
      if(rand()<0.5) pts=_mirrorHorizontal(pts);
      pts=_shiftToOrigin(pts);
      const maxR=_maxOf(pts,0), maxC=_maxOf(pts,1);
      if(maxR>=GRID_SIZE||maxC>=GRID_SIZE) continue;
      const offR=Math.floor(rand()*(GRID_SIZE-maxR));
      const offC=Math.floor(rand()*(GRID_SIZE-maxC));
      return {constellation:name,pattern:pts.map(function(p){ return [p[0]+offR,p[1]+offC]; })};
    }
    return {constellation:name,pattern:_shiftToOrigin(base)};
  }
  // ONLY FROM THE LIBRARY THIS SPRINT DEFINED.
  //
  // A family marked mintable:false still draws and still traces, so
  // every card already carrying it is untouched — it is simply never
  // handed to a new Creator. Falls back to the whole table if that ever
  // empties, because minting no card at all is worse than minting a
  // legacy one.
  function _mintableNames(){
    const all=Object.keys(CONSTELLATIONS);
    const ok=all.filter(function(n){
      return !CONSTELLATION_META[n] || CONSTELLATION_META[n].mintable!==false;
    });
    return ok.length?ok:all;
  }

  function _pickConstellationName(rand){
    rand=rand||Math.random;
    const names=_mintableNames();
    return names[Math.floor(rand()*names.length)];
  }

  // A small, deterministic string-seeded generator (splitmix32-style) —
  // NOT for anything security-sensitive, only for decorativeSkyFor()
  // below, where "the same input always produces the same output" is
  // exactly the point (a card's ambient sky should look the same every
  // time it's shown), not a defect.
  function _seededRand(seedStr){
    let h=1779033703^seedStr.length;
    for(let i=0;i<seedStr.length;i++){
      h=Math.imul(h^seedStr.charCodeAt(i),3432918353);
      h=(h<<13)|(h>>>19);
    }
    return function(){
      h=Math.imul(h^(h>>>16),2246822507);
      h=Math.imul(h^(h>>>13),3266489909);
      h^=h>>>16;
      return (h>>>0)/4294967296;
    };
  }

  // The whole point of this function: a card's REAL `pattern` is its
  // recall credential — the exact tap sequence recall_magic_card()
  // checks. It must never be displayed passively/ambiently (a header
  // badge, a boot-time greeting, a picker tile) since any one of those
  // moments would hand a bystander everything they need to become that
  // child on another device. decorativeSkyFor() derives a SEPARATE,
  // visually distinct constellation from the card's own already-public
  // id (printed on the card anyway) — every ambient "this is your sky"
  // surface uses this instead, so it still looks personal and
  // consistent for a given card without ever leaking the real secret.
  // Deterministic and unpersisted by design: recomputed fresh on every
  // call from `card.id` alone, needing no storage/migration for cards
  // claimed before this existed.
  function decorativeSkyFor(card){
    if(!card||!card.id) return {constellation:'CYGNUS',pattern:[]};
    const rand=_seededRand('decorative-sky:'+card.id);
    return _placeConstellation(_pickConstellationName(rand),rand);
  }

  function _newId(){
    return 'mc_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }

  // The CONSTELLATIONS.CYGNUS reorder above (Top/Center/Bottom/Left/
  // Right -> Top/Center/Left/Bottom/Right) only fixes NEW claims --
  // claim() stores a card's real pattern permanently at claim time
  // (never re-derived from CONSTELLATIONS on later renders), so an
  // already-claimed CYGNUS card's stored pattern still carries the old,
  // self-crossing order until this migration runs once. _rotate/
  // _mirrorHorizontal/_shiftToOrigin are all plain .map() calls that
  // never reorder the array -- index 0 is always the transformed "Top"
  // point, index 1 always "Center", etc, for every card regardless of
  // which random rotation/mirror it got -- so swapping stored indices 2
  // and 3 (the exact same permutation the base array's own reorder
  // applied) repairs any already-placed CYGNUS pattern correctly, no
  // matter its orientation. Same stars, same position, only the
  // connect-the-dots order changes -- recall_magic_card() matches a
  // tapped pattern order-independently, so this can never affect
  // whether a real device can still recall the card. Gated by a
  // one-time flag (mirrors this file's own _ensureUniversalContentDefaults
  // -style read-time reconciliation elsewhere in this codebase) so it
  // runs exactly once per card and never re-touches an already-correct
  // pattern from a fresh claim() made after this fix shipped.
  function _readCards(){
    try{
      const raw=localStorage.getItem(CARDS_KEY);
      const parsed=raw?JSON.parse(raw):[];
      const cards=Array.isArray(parsed)?parsed:[];
      // NOTHING IS WRITTEN ON A READ. The product owner's instruction,
      // and the right one: "fix the stars of magic card and dont over
      // write them."
      //
      // A repair used to run here, rewriting any pattern whose order was
      // not a legal placement. It was well-meant — it undid damage an
      // older migration had caused — but it made reading a card a
      // MUTATING operation, and a card's stars are the child's identity.
      // Anything that can rewrite them can get it wrong, and the last
      // two rounds are both proof: the first version rewrote correct
      // mirrored cards, and even the corrected one still means a card
      // can change while nobody asked it to.
      //
      // _readCards() now returns exactly what is stored. The migration
      // that caused the original damage is gone, so nothing new is being
      // corrupted; a card damaged before that removal keeps its order
      // until somebody deliberately repairs it, which is a decision for
      // its owner rather than a side effect of looking at it.
      return cards;
    }catch(e){ return []; }
  }
  function _writeCards(list){
    try{ localStorage.setItem(CARDS_KEY,JSON.stringify(list)); return true; }
    catch(e){ return false; }
  }

  function _readFlags(){
    try{
      const raw=localStorage.getItem(FLAGS_KEY);
      return raw?JSON.parse(raw):{};
    }catch(e){ return {}; }
  }
  function _writeFlags(flags){
    try{ localStorage.setItem(FLAGS_KEY,JSON.stringify(flags)); }catch(e){}
  }
  function getFlags(){ return _readFlags(); }
  function setFlags(patch){
    const flags=_readFlags();
    Object.keys(patch).forEach(function(k){ flags[k]=patch[k]; });
    _writeFlags(flags);
    return flags;
  }

  // Newest-claimed-first — matches every other "list" convention already
  // established in this codebase (CreatorProjectStore, World Builder's
  // ProjectStore).
  function list(){
    return _readCards().sort(function(a,b){ return new Date(b.claimedAt)-new Date(a.claimedAt); });
  }
  function get(id){
    return _readCards().find(function(c){ return c.id===id; })||null;
  }
  function count(){ return _readCards().length; }

  function getActiveId(){
    try{ return localStorage.getItem(ACTIVE_KEY)||null; }catch(e){ return null; }
  }
  function setActive(id){
    try{ localStorage.setItem(ACTIVE_KEY,id||''); }catch(e){}
    touch(id);
  }
  function getActive(){
    const id=getActiveId();
    if(!id) return null;
    const card=get(id);
    // A stale pointer (the card it named no longer exists) resolves to
    // null rather than throwing — the caller falls back to "no active
    // identity" exactly as if none had ever been set.
    return card;
  }

  // ---------- What this Creator has been taught ----------
  //
  // Decision 22: the record of which CAPABILITIES a child has been
  // taught "travels on the Magic Card, and is never shown". A
  // browser-local flag would drop a Creator to Level I on a
  // grandparent's laptop with their own Level III stories in front of
  // them — the failure Decision 19 already had to fix for projects.
  //
  // `undefined` and `[]` mean different things and must stay different.
  // A card claimed before this existed has no property at all, and
  // js/studioRite.js reads that absence as "grandfathered — never take
  // a control away". A card claimed since always carries an array, even
  // an empty one. So this returns null for absent and an array for
  // present, and never invents one.
  //
  // NEVER A LEVEL, RANK OR SCORE, and nothing new on the card's face
  // (js/magicCard.js -> growthSignals()'s stated "no counters, no
  // levels"). A set of things learned is not a rank: a child's larger
  // Studio is the only thing they ever see.
  function taught(){
    const card=getActive();
    if(!card) return null;
    return Array.isArray(card.taught) ? card.taught.slice() : null;
  }
  function setTaught(list){
    const id=getActiveId();
    if(!id || !Array.isArray(list)) return false;
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1) return false;
    cards[idx].taught=list.slice();
    _writeCards(cards);
    _scheduleIdentitySync(id);
    return true;
  }

  function touch(id){
    if(!id) return;
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1) return;
    cards[idx].lastActiveAt=new Date().toISOString();
    _writeCards(cards);
    _scheduleIdentitySync(id);
  }

  // ---------- Phase 2: Cloud Identity + Recall ----------
  // Every function below is fire-and-forget from its caller's own
  // perspective -- local mutation (above) has already completed and
  // returned before any of this runs, and every promise here resolves
  // rather than rejects on failure, matching cardPlatform.js's own
  // "never block, never throw" convention throughout. A Traveller (no
  // claimed card, so none of the local functions above ever call these)
  // never triggers a single network call -- unchanged from Phase 1.
  const _cloudSyncTimers={};

  // Upserts the FULL current local card as one Supabase row, keyed by
  // the card's own local id (magic_card_identities.id is client-
  // supplied text for exactly this reason -- see supabase/schema.sql's
  // own comment on that column) -- one shared function serves claim()
  // (immediate), touch()/rename() (debounced), so there is only ever
  // one write shape to reason about.
  //
  // Also captures the server's own serial_no back onto the local
  // record (see _captureRecallCode below) -- the ONE piece of this
  // whole mechanism that can never be produced client-side, since it
  // exists purely to disambiguate two people who both happened to get
  // "CYGNUS" as their constellation. Because every one of claim()/
  // touch()/rename() funnels through this same function, a card
  // claimed offline (or whose very first push simply failed) still
  // self-heals the moment any later push succeeds -- no migration,
  // no separate backfill job.
  // Returns the write's own promise so a caller that must not act
  // until the row EXISTS can wait for it. Sky Protection is the reason:
  // it posts a Magic Card by id, and asking the platform to mail a card
  // it has not been told about yet fails with `no_such_card`. Every
  // existing caller ignores the return value and is unaffected.
  // ---------------------------------------------------------------
  // RESERVING A PATTERN — THE DATABASE DECIDES, NOT THIS FILE.
  //
  // A canonical star pattern belongs to exactly one Creator, and the
  // only place that can be enforced is the database: magic_card_
  // identities is owner-only SELECT by design, so this client cannot
  // even see whether a pattern is free, and two devices minting at the
  // same instant could not agree if it could. So it does not ask — it
  // attempts, and a unique index on the canonical form arbitrates.
  //
  // On `pattern_taken` a NEW pattern is generated IN THE SAME
  // CONSTELLATION FAMILY and the attempt repeated. The family is kept
  // deliberately: the ceremony has already named the child's sky, and
  // changing Lyra to Aries underneath them would be a visible lie,
  // where a different Lyra is simply the sky they were always getting.
  //
  // Nothing here is ever shown to the child. A collision is a fact
  // about the universe, not a mistake they made.
  var MINT_ATTEMPTS=6;

  function _reserveIdentity(card, attempt){
    attempt=attempt||0;
    if(!card || typeof ThemeRepositoryClient==='undefined') return Promise.resolve(false);
    return ThemeRepositoryClient.isConfigured().then(function(ok){
      if(!ok) return false;
      return ThemeRepositoryClient.getClient().then(function(client){
        return ThemeRepositoryClient.getSession().then(function(){
          return client.rpc('mint_magic_card',{
            p_id:card.id,
            p_nickname:card.nickname||'',
            p_constellation:card.constellation,
            p_pattern:card.pattern,
            p_claimed_at:card.claimedAt,
            p_companion_id:card.companionId||null,
            p_companion_name:card.companionName||null,
            p_companion_species:card.companionSpecies||null
          }).then(function(res){
            // An RPC that is not deployed yet is not a failure: the old
            // upsert path still works, and a database without the unique
            // index is exactly the state this migration is for.
            if(res && res.error) return _pushIdentitySnapshot(card);
            const out=res && res.data;
            if(out && out.ok){
              if(out.serial_no!=null){
                _captureRecallCode(card.id, out.constellation||card.constellation, out.serial_no);
              }
              return true;
            }
            if(out && out.reason==='pattern_taken' && attempt<MINT_ATTEMPTS){
              // Another Creator already holds this exact sky. Draw a
              // different one from the same family and try again.
              const fresh=_placeConstellation(card.constellation);
              if(fresh && fresh.pattern && fresh.pattern.length){
                const cards=_readCards();
                const idx=cards.findIndex(function(c){ return c.id===card.id; });
                if(idx!==-1){
                  cards[idx].pattern=fresh.pattern;
                  _writeCards(cards);
                  card.pattern=fresh.pattern;
                }
                return _reserveIdentity(card, attempt+1);
              }
            }
            return false;
          });
        });
      });
    }).catch(function(){ return false; });
  }

  function _pushIdentitySnapshot(card){
    if(!card || typeof ThemeRepositoryClient==='undefined') return Promise.resolve(false);
    return ThemeRepositoryClient.isConfigured().then(function(ok){
      if(!ok) return;
      return ThemeRepositoryClient.getClient().then(function(client){
        return ThemeRepositoryClient.getSession().then(function(session){
          return client.from('magic_card_identities').upsert({
            id:card.id,
            owner_id:session.user.id,
            nickname:card.nickname,
            constellation:card.constellation,
            pattern:card.pattern,
            claimed_at:card.claimedAt,
            last_active_at:card.lastActiveAt,
            // Companion Canon V2 — the Creator-Companion Bond, mirrored
            // to the cloud alongside the rest of the identity so a
            // cross-device recall (adopt(), below) inherits the SAME
            // bonded companion rather than being assigned a second,
            // different one. Nullable columns (supabase/schema.sql) —
            // a card claimed before this sprint simply has none until
            // ensureBondedCompanion() retroactively bonds it.
            companion_id:card.companionId||null,
            companion_name:card.companionName||null,
            companion_species:card.companionSpecies||null,
            // Nullable, and null is meaningful: a card that predates the
            // taught record has none, and recall must return that
            // absence rather than an empty array (see adopt()).
            taught:Array.isArray(card.taught) ? card.taught : null
          },{onConflict:'id'}).select('serial_no,constellation').then(function(res){
            const row=res&&!res.error&&res.data&&res.data[0];
            if(row&&row.serial_no!=null){
              _captureRecallCode(card.id,row.constellation||card.constellation,row.serial_no);
            }
          });
        });
      });
    }).catch(function(){});
  }

  // The human-typeable fallback code (e.g. "CYGNUS00042") must match
  // EXACTLY what recall_magic_card()'s own typed-code branch checks
  // against (supabase/schema.sql: upper(constellation ||
  // lpad(serial_no::text,5,'0'))) -- constellation+serial, nothing
  // else, since the RPC's own normalization already strips any
  // dashes/spaces/case the display adds for readability. Persisted
  // onto the local card record (a new, additive `recallCode` field)
  // so magicCardArt.js has something real to print; a card whose
  // first push hasn't landed yet simply has no recallCode until one
  // does -- js/magicCardArt.js discloses that honestly rather than
  // printing something that would fail if typed back in.
  function _captureRecallCode(id,constellation,serialNo){
    const code=(constellation||'').toUpperCase()+String(serialNo).padStart(5,'0');
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1||cards[idx].recallCode===code) return;
    cards[idx].recallCode=code;
    _writeCards(cards);
  }

  // Debounced (2s, its own timer per card id) background push --
  // touch() fires on every setActive() call, so this needs coalescing
  // to avoid spamming Supabase on rapid navigation, mirroring
  // worldBuilderApp.js's own _scheduleCloudSync timing exactly. Always
  // re-reads the card fresh at fire time rather than closing over a
  // possibly-stale snapshot, the same "don't push data another edit
  // has already superseded" discipline _scheduleCloudSync's own
  // staleness guard exists for.
  function _scheduleIdentitySync(id){
    if(!id) return;
    if(_cloudSyncTimers[id]) clearTimeout(_cloudSyncTimers[id]);
    _cloudSyncTimers[id]=setTimeout(function(){
      delete _cloudSyncTimers[id];
      // Deliberately the plain push, NOT _reserveIdentity.
      //
      // Re-rolling a pattern is only ever safe at claim time, when the
      // card is seconds old and nobody has seen it. By the time a card
      // is being touched or renamed it is established — printed,
      // perhaps, and certainly the thing its Creator draws to be
      // recognised — so changing its stars to resolve a collision would
      // destroy the identity it was trying to protect.
      //
      // If such a card cannot sync because its pattern is held by
      // somebody else, it stays local and silent. That is the right
      // failure: it can only happen to a card minted before the unique
      // index existed, and the audit that installed the index proved
      // there were none.
      _pushIdentitySnapshot(get(id));
    },CLOUD_SYNC_DEBOUNCE_MS);
  }

  // Generates a pattern WITHOUT persisting anything — used by the
  // Awakening ceremony (magicCardUI.js) to show the child the exact sky
  // they'll actually get if they claim it. Nothing is "locked in" until
  // claim() below is called with this same value, so "Maybe Later"
  // leaves no half-created card behind.
  // `name` is honoured when given, and a random mintable family is
  // chosen when it is not.
  //
  // It USED to take no argument at all and silently ignore one. That is
  // a quiet footgun — a caller writing generatePattern('LYRA') gets a
  // random family and no complaint — and it misled this project's own
  // testing: a check reported "200 distinct LYRA cards" while actually
  // comparing two random cards two hundred times, which of course
  // differed, and which said nothing whatever about Lyra. Honouring the
  // argument costs one line and removes the trap.
  function generatePattern(name){
    if(name && CONSTELLATIONS[name]) return _placeConstellation(name);
    return _placeConstellation(_pickConstellationName());
  }

  // ---------- Companion Canon V2: the Creator-Companion Bond ----------
  // "The Story Companion chooses the Creator. The Creator never
  // manually selects a companion." A real, isolated random pick from
  // the registry's own role:'companion' entries -- isolated in one
  // small function so a future smarter policy (avoid repeats across
  // siblings, seasonal weighting, generations) can replace the picking
  // logic without touching either caller below. Resolves null (never
  // rejects) if the Companion Runtime isn't loaded or the registry has
  // no companion-role entries yet -- a claim/adopt with no companion
  // bonded is a real, honest degrade state, not a crash.
  function assignBondedCompanion(){
    if(typeof CompanionEngine==='undefined' || !CompanionEngine.loadRegistry){
      return Promise.resolve(null);
    }
    return CompanionEngine.loadRegistry('assets/').then(function(list){
      const pool=(list||[]).filter(function(e){ return e.role==='companion'; });
      if(!pool.length) return null;
      const picked=pool[Math.floor(Math.random()*pool.length)];
      return {companionId:picked.id,companionName:picked.name||picked.id,companionSpecies:picked.species||''};
    }).catch(function(){ return null; });
  }

  // Retroactively bonds a companion onto an ALREADY-claimed card that
  // has none (a legacy card claimed before this sprint) -- the one
  // real migration path Companion Canon V2 needs, called by
  // js/companionDirector.js the first time such a card's own creator-
  // mode entity is resolved. A card that already has a real
  // companionId resolves instantly with no re-roll -- the bond is
  // permanent once assigned, whether at claim() time or here.
  function ensureBondedCompanion(cardId){
    const card=get(cardId);
    if(!card) return Promise.resolve(null);
    if(card.companionId){
      return Promise.resolve({companionId:card.companionId,companionName:card.companionName,companionSpecies:card.companionSpecies});
    }
    return assignBondedCompanion().then(function(fields){
      if(!fields) return null;
      const cards=_readCards();
      const idx=cards.findIndex(function(c){ return c.id===cardId; });
      if(idx!==-1){
        cards[idx].companionId=fields.companionId;
        cards[idx].companionName=fields.companionName;
        cards[idx].companionSpecies=fields.companionSpecies;
        _writeCards(cards);
        _scheduleIdentitySync(cardId);
      }
      return fields;
    });
  }

  // Mints a brand-new claimed Magic Card. `precomputed`, when supplied
  // (the Awakening ceremony's own generatePattern() result), is used
  // verbatim rather than generating a second, different pattern — this
  // is what guarantees the sky the child watched form during the
  // ceremony is the SAME sky their claimed card actually has
  // afterward (Constellation Philosophy — "one constellation, two
  // faces"). Never regenerated for a given card afterward; the pattern
  // is permanent for the card's whole life. `companionFields` (when
  // supplied — the Creator Ceremony's own assignBondedCompanion()
  // result, already resolved by the time claim() is called) bonds the
  // Creator-Companion pair permanently onto the card at the same
  // moment; a companion-less claim (companionFields omitted/null) is a
  // real, honest degrade state, not an error.
  // The Traveller's own taught record, kept by js/studioRite.js on the
  // device for the window in which a child has finished a rite and has
  // no card yet. Read here rather than owned here: StudioRite decides
  // what a capability is, this only carries it across.
  function _sweepTaught(){
    try{
      const key=(typeof StudioRite!=='undefined' && StudioRite.TAUGHT_KEY) || 'vihu-rite-taught';
      const raw=localStorage.getItem(key);
      if(!raw) return [];
      const v=JSON.parse(raw);
      if(!Array.isArray(v)) return [];
      // A CARD MINTED RIGHT NOW CANNOT PREDATE THE RECORD, so it can
      // never be grandfathered — whatever the device record happens to
      // say. It can legitimately say `legacy-studio`: a child finishing
      // a rite while an older card is still active has that written to
      // the device on the way past (js/studioRite.js -> _grant), and
      // without this the brand-new card the Ceremony mints a moment
      // later would inherit somebody else's legacy and open the whole
      // Studio. Reported as "am seeing tiles for next rites already
      // activated".
      return v.filter(function(c){ return c!=='legacy-studio'; });
    }catch(e){ return []; }
  }

  function claim(nickname,precomputed,companionFields){
    const placed=precomputed||_placeConstellation(_pickConstellationName());
    const now=new Date().toISOString();
    const card={
      id:_newId(),
      nickname:(nickname||'').trim(),
      constellation:placed.constellation,
      pattern:placed.pattern,
      claimedAt:now,
      lastActiveAt:now,
      companionId:(companionFields&&companionFields.companionId)||null,
      companionName:(companionFields&&companionFields.companionName)||'',
      companionSpecies:(companionFields&&companionFields.companionSpecies)||'',
      // ALREADY CORRECT, SO SAY SO.
      //
      // _migrateCygnusOrder() repairs CYGNUS cards minted before that
      // order was fixed, and it decides who needs repairing by the
      // absence of this flag. A card minted HERE comes from the current
      // CONSTELLATIONS table, which is the fixed order — so leaving the
      // flag off told the migration to "repair" a card that was already
      // right, swapping it straight back into the self-crossing order
      // the fix existed to remove.
      //
      // It ran on the next _readCards(), which is to say immediately and
      // invisibly, on every new CYGNUS card since that fix shipped.
      constellationOrderFixed:true,
      // ALWAYS AN ARRAY, EVEN AN EMPTY ONE — the absence of this
      // property is what tells js/studioRite.js a card predates the
      // taught record and must never lose a control (isGrandfathered).
      // A card minted here is by definition new, so it is stamped, and
      // whatever the child has already learned as a Traveller is swept
      // onto it in the same breath. Rite I completes BEFORE the Creator
      // Ceremony mints this card (Decision 8's amendment), so the
      // Studio-shaped half of their first story is always waiting in
      // that device record when this runs.
      taught:_sweepTaught()
    };
    const cards=_readCards();
    cards.push(card);
    _writeCards(cards);
    setActive(card.id);
    // THE WORK THIS CHILD ALREADY DID IS THEIRS.
    //
    // Projects are scoped to the card that owns them (see
    // CreatorProjectStore.list). The Rite has a child make a Story
    // BEFORE they have a card, so at this exact moment their Story is
    // sitting in the store owned by nobody — and without this it would
    // disappear from My Projects the instant they were handed the card
    // that is meant to keep it. Only unowned records are taken; another
    // Creator's Story on a shared machine is never swept up by somebody
    // else claiming a card.
    try{
      if(typeof CreatorProjectStore!=='undefined' && CreatorProjectStore.claimUnowned){
        CreatorProjectStore.claimUnowned(card.id);
      }
    }catch(e){}
    // AN INVITATION IS ACCEPTED HERE, and nowhere else. The product
    // owner's own definition: an invite is accepted when the invited
    // child becomes a Creator, and a Creator is someone holding a
    // claimed Magic Card (Decision 10). This is the moment that
    // becomes true, so it is the only honest place to record it.
    // Nothing about the card is sent — only that the invitation's own
    // token reached its last stage.
    try{
      if(typeof window!=='undefined' && window.Invite) window.Invite.reached('creator');
    }catch(e){}
    // …and so are the characters they saved to My Library before they
    // had a card — the exact sibling sweep, for the exact reason above
    // (js/creatorLibrary.js's claimUnowned only ever takes unowned
    // records, never another Creator's).
    try{
      if(typeof CreatorLibrary!=='undefined' && CreatorLibrary.claimUnowned){
        CreatorLibrary.claimUnowned(card.id);
      }
    }catch(e){}
    // A one-time event, not a rapid-succession edit stream -- pushed
    // immediately rather than debounced, unlike touch()/rename() below.
    // THE MOMENT A WAITING SKY CAN FINALLY BE POSTED.
    //
    // A child gives a grown-up's address during their FIRST share, and
    // at that moment they have no Magic Card yet -- Canon 6 puts the
    // Creator Ceremony after sharing, so that is the normal order, not
    // an edge case. SkyProtection.protect() correctly remembers the
    // address and reports `pending`, and the card is meant to be posted
    // "the moment there is one". This is that moment, and nothing was
    // calling it: the only catchUp() was fired by the share ceremony
    // itself, synchronously, BEFORE the interactive Ceremony that mints
    // the card had even begun -- so _activeCardId() was still null, it
    // returned `nothing_to_do`, and the card was never sent at all.
    // A grown-up who was promised a Magic Card never received one.
    //
    // Chained onto the snapshot rather than fired beside it, because
    // Sky Protection asks the platform to mail a card BY ID and the row
    // has to exist there first, or the send fails with `no_such_card`.
    // Reserved rather than merely pushed: the database is the authority
    // on whether this exact sky is free, and hands back a different one
    // of the same family if it is not.
    var pushed=_reserveIdentity(card);
    try{
      if(pushed && typeof pushed.then==='function'){
        pushed.then(function(){
          try{ if(typeof SkyProtection!=='undefined' && SkyProtection.catchUp) SkyProtection.catchUp(); }catch(e){}
        }).catch(function(){});
      }
    }catch(e){}
    // Companion Canon V2 -- this is the literal "Story Egg hatches -> A
    // Story Companion is born -> Magic Card is permanently bonded ->
    // Creator Journey begins" moment. Single defensive hook, matching
    // every other module's own integration with CompanionDirector
    // throughout this codebase.
    try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('creator-born'); }catch(e){}
    return card;
  }

  function rename(id,nickname){
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===id; });
    if(idx===-1) return false;
    cards[idx].nickname=(nickname||'').trim();
    const result=_writeCards(cards);
    _scheduleIdentitySync(id);
    return result;
  }

  // Redeems a tapped `{pattern:[[row,col],...]}` or typed
  // `{typed:'ORION-00125'}` against the cloud via the recall_magic_card
  // RPC (supabase/schema.sql) -- structurally a mirror of
  // cardPlatform.js's own redeem(), reusing the exact same
  // ThemeRepositoryClient reuse convention. On success, adopts the
  // recalled identity as a real local card (see adopt() below) and
  // kicks off pulling its projects onto this device.
  function recall(input){
    input=input||{};
    if(typeof ThemeRepositoryClient==='undefined'){
      return Promise.resolve({ok:false,reason:'repository_client_unavailable'});
    }
    return ThemeRepositoryClient.getClient().then(function(client){
      return ThemeRepositoryClient.getSession().then(function(){
        return client.rpc('recall_magic_card',{
          p_pattern:input.pattern||null,
          p_typed_code:input.typed||null
        }).then(function(res){
          if(res.error) throw res.error;
          const result=res.data;
          if(!result||!result.ok){
            return {ok:false,reason:(result&&result.reason)||'unknown'};
          }
          const card=adopt(result,input.pattern||null);
          return {ok:true,card:card};
        });
      });
    }).catch(function(error){
      return {ok:false,error:error};
    });
  }

  // Parallel to claim(), but for a RECALLED identity rather than a
  // freshly minted one -- never mints a new pattern (a real one
  // already exists, from the recall itself). The RPC never returns the
  // pattern on any branch (see recall_magic_card in
  // supabase/schema.sql, same discipline as redeem_card) -- the
  // recalling client already has it whenever the tap path was used
  // (it's exactly what was just submitted to recall() above), so it's
  // threaded back in here rather than re-derived. A typed-code recall
  // has no such pattern to fold back in -- `pattern` stays null in
  // that honest, disclosed case, and MagicCardArt's drawBack() shows a
  // "no sky to show yet on this device" state rather than fabricating
  // one; still fully usable (nickname/code/Home all work), just
  // without a printable back until the constellation is known some
  // other way (e.g. seeing the original device's own printed card).
  // A CARD ALREADY HERE KEEPS ITS OWN SKY.
  //
  // Reported after a successful camera recognition: the right Creator
  // came in, and the constellation on their Magic Card had changed.
  // This is where. adopt() built a whole new record and REPLACED the
  // existing one, storing whatever pattern the caller had submitted —
  // and after a camera read, that is the order the blobs happened to be
  // found in, not the order the card was minted with.
  //
  // The stars themselves were never wrong: recognition matches as a SET
  // (canonical() here, _card_platform_sort_pattern server-side), so a
  // match proves the same five or seven cells. But drawBack() joins the
  // pattern with a line IN ARRAY ORDER, so the same sky re-ordered
  // draws a different constellation. The child sees their card change,
  // which for something whose whole job is being their permanent
  // identity is about as bad as a cosmetic bug gets.
  //
  // So an existing local pattern is authoritative and is never
  // overwritten by a submitted one. It came from claim(), where the
  // platform minted it; a recall has nothing better to offer, since the
  // RPC deliberately never returns a pattern on any branch.
  // ---------------------------------------------------------------
  // HOW A SKY IS TRACED, for DRAWING only.
  //
  // Nothing here writes anything. A card's stored pattern is its
  // identity and is never touched — the Studio's card draws it exactly
  // as stored, and that is deliberate, because what is stored is the
  // truth about the card.
  //
  // The board is a different question. A sky marked from a photograph
  // has stars but no order: the camera found them in whatever order it
  // found them, so joining them in that order draws a zig-zag rather
  // than a constellation. That is not "what was seen" in any useful
  // sense — the ORDER was never seen at all — so drawing it asserts
  // something arbitrary rather than something honest.
  //
  // Every real card's cells are one of five known shapes under one of
  // four rotations, an optional mirror and a translation, so the shape
  // can be identified from the cells and traced the way it is drawn.
  // Cells that match nothing are returned untouched, because a
  // hand-drawn sky is whatever its child drew.
  function _placementsFor(name,cells){
    if(!Array.isArray(cells)||!cells.length) return [];
    const base=CONSTELLATIONS[name];
    if(!base||base.length!==cells.length) return [];
    const key=function(list){
      return list.map(function(p){ return p[0]+','+p[1]; }).sort().join(' ');
    };
    const want=key(cells);
    const minR=_minOf(cells,0), minC=_minOf(cells,1);
    const out=[];
    for(let turns=0;turns<4;turns++){
      for(let mirror=0;mirror<2;mirror++){
        let pts=_shiftToOrigin(base);
        pts=_rotate(pts,turns);
        if(mirror) pts=_mirrorHorizontal(pts);
        pts=_shiftToOrigin(pts);
        const placed=pts.map(function(p){ return [p[0]+minR,p[1]+minC]; });
        if(key(placed)===want) out.push(placed);
      }
    }
    return out;
  }

  // CAN THE LINE BE KNOWN, OR ONLY GUESSED?
  //
  // Not the same question as "is this sky symmetric". CASSIOPEIA's cells
  // are unchanged by a top-to-bottom flip, so two placements fit — and
  // both draw the SAME SEGMENTS, just traversed from opposite ends, so
  // the line is identical and there is nothing to get wrong. CYGNUS's
  // cross also fits more than one placement, and those draw DIFFERENT
  // segments: one traces Top-Centre-Left-Bottom-Right, another
  // Bottom-Centre-Right-Top-Left, and the two are 180 degrees apart.
  // Reported from a real card as exactly that: "cygnus came inverse".
  //
  // So the test is about the LINE, not the shape. Every placement that
  // fits these cells is drawn out as a set of unordered segments; if
  // they all agree, the line is a fact and can be drawn. If they differ,
  // the photograph genuinely does not say which one the card uses, and a
  // caller about to draw it should be told so rather than shown a coin
  // toss.
  function _segments(order){
    const out=[];
    for(let i=0;i<order.length-1;i++){
      const a=order[i][0]+','+order[i][1], b=order[i+1][0]+','+order[i+1][1];
      out.push(a<b?a+'|'+b:b+'|'+a);
    }
    return out.sort().join('  ');
  }

  function traceIsCertain(cells){
    if(!Array.isArray(cells)||cells.length<2) return false;
    const names=Object.keys(CONSTELLATIONS);
    for(let i=0;i<names.length;i++){
      const ways=_placementsFor(names[i],cells);
      if(!ways.length) continue;
      const first=_segments(ways[0]);
      for(let k=1;k<ways.length;k++){
        if(_segments(ways[k])!==first) return false;
      }
      return true;
    }
    return false;                       // not a known sky: nothing to know
  }

  function orderLikeAnySky(cells){
    if(!Array.isArray(cells)||!cells.length) return cells;
    const names=Object.keys(CONSTELLATIONS);
    for(let i=0;i<names.length;i++){
      const ways=_placementsFor(names[i],cells);
      if(ways.length) return ways[0];
    }
    return cells;
  }

  // The same SET comparison recognition itself uses — canonical() on
  // this device, _card_platform_sort_pattern() on the platform — so
  // two orders of one sky read as the same sky, and any other pair
  // does not.
  function _canon(cells){
    if(!Array.isArray(cells)) return null;
    const flat=cells.filter(function(p){ return Array.isArray(p)&&p.length>=2; })
      .map(function(p){ return [Number(p[0]),Number(p[1])]; });
    if(!flat.length) return null;
    return flat.sort(function(a,b){ return (a[0]-b[0])||(a[1]-b[1]); })
      .map(function(p){ return p[0]+','+p[1]; }).join(' ');
  }

  function _sameSky(a,b){
    const ca=_canon(a), cb=_canon(b);
    return !!(ca && cb && ca===cb);
  }

  function adopt(remoteResult,pattern){
    const now=new Date().toISOString();
    const cardsBefore=_readCards();
    const existing=cardsBefore.find(function(c){ return c && c.id===remoteResult.identity_id; });
    // WHICH ORDER THE CARD IS DRAWN IN, on a device seeing this
    // identity for the first time.
    //
    // Three candidates, in order of how much they know:
    //
    //  1. A card already on THIS device. _readCards() has already
    //     migrated it, the child has already seen it, and nothing
    //     about a recall makes it less true.
    //  2. The order stored WITH the identity, returned by
    //     recall_magic_card() on the pattern branch only
    //     (supabase/migrations_recall_returns_pattern.sql). This is
    //     the order the original card was drawn in — the picture in
    //     the child's pocket.
    //  3. The order the caller submitted. On the camera path that is
    //     whatever order the reader happened to walk the marks in,
    //     which draws the right stars joined the wrong way.
    //
    // (2) is only trusted when it is the SAME SET the caller proved.
    // It always should be — it is the row that matched — but adopting
    // a pattern that is not the one just shown is precisely the thing
    // an identity system must never do, so it is checked rather than
    // assumed.
    const submitted=(Array.isArray(pattern)&&pattern.length)?pattern:null;
    const returned=_sameSky(remoteResult.pattern,submitted)?remoteResult.pattern:null;
    const keptPattern=(existing && Array.isArray(existing.pattern) && existing.pattern.length)
      ? existing.pattern
      : (returned || submitted);
    const card={
      id:remoteResult.identity_id,
      nickname:remoteResult.nickname||'',
      constellation:remoteResult.constellation,
      pattern:keptPattern,
      claimedAt:remoteResult.claimed_at||now,
      lastActiveAt:now,
      // Companion Canon V2 -- the bond travels with the identity, not
      // the device: recall_magic_card() (supabase/schema.sql) returns
      // the SAME companion this identity was originally bonded to,
      // never a fresh re-roll (assignBondedCompanion() is only ever
      // called by claim()/ensureBondedCompanion(), never here).
      companionId:remoteResult.companion_id||null,
      companionName:remoteResult.companion_name||'',
      companionSpecies:remoteResult.companion_species||'',
      // Same rule as claim(), the other way round: absent stays absent.
      // A deployment whose migration has not been run returns nothing
      // here, the property is never written, and js/studioRite.js reads
      // that as grandfathered — so a Creator recalled onto a strange
      // device gets their whole Studio rather than being quietly
      // stripped of controls by a missing column. Fail-open, in the one
      // direction that can never cost a child something they had.
      // Same reasoning as claim(). Either this pattern was kept from a
      // card already on this device — which _readCards() has therefore
      // already migrated — or it was rebuilt just now from the current
      // CONSTELLATIONS table. Both are the fixed order, and neither
      // wants repairing.
      constellationOrderFixed:true
    };
    if(Array.isArray(remoteResult.taught)) card.taught=remoteResult.taught.slice();
    const cards=cardsBefore;
    const idx=cards.findIndex(function(c){ return c.id===card.id; });
    if(idx===-1) cards.push(card); else cards[idx]=card;
    _writeCards(cards);
    setActive(card.id);
    _pullRecalledProjects(remoteResult.owner_id,card.id);
    // Companion Canon Freeze -- recalling an identity on a new device
    // is the other real "Traveller becomes Creator" path (alongside
    // claim() above) -- this device now recognizes a Creator too.
    try{ if(typeof CompanionDirector!=='undefined') CompanionDirector.notify('creator-born'); }catch(e){}
    return card;
  }

  // Fire-and-forget -- pulls every project the ORIGINAL device backed
  // up under the recalled identity's own owner_id (creator_projects'
  // own cross-owner SELECT policy, supabase/schema.sql, is what
  // actually makes this legal) and materializes each as a brand-new
  // local CreatorProjectStore record with a FRESH id, never the
  // original -- the same "adopt as a new copy" reasoning already
  // established for World Builder's own Repository-Only Card cloning
  // work: RLS would silently block a cross-owner write back to the
  // original row anyway, and two devices staying genuinely independent
  // working copies is the explicit, disclosed design (never live/
  // simultaneous multi-device editing of the same project).
  function _pullRecalledProjects(ownerId,cardId){
    if(typeof CreatorProjectSync==='undefined' || typeof CreatorProjectStore==='undefined' || !ownerId) return;
    CreatorProjectSync.listByOwner(ownerId).then(function(rows){
      rows.forEach(function(row){
        const record=row.data;
        if(!record) return;
        const newId=CreatorProjectStore.newId();
        const data=record.data;
        if(data && data.project){
          data.project.id=newId;
          // Draft Asset Architecture, Phase E -- a real, previously-
          // undiscovered gap found while verifying recall: this payload
          // may still carry `vihu-asset:` references authored on the
          // ORIGINAL device, under that device's own anonymous session --
          // not this one. Stamping the original owner id here is what
          // lets ProjectManager.deserialize()/AssetStore.resolve() fall
          // back to it (only ever as a SECOND attempt, after the current
          // session's own owner id fails, so a brand-new upload made on
          // THIS device after recall is never misrouted) instead of
          // silently failing to resolve the recalled Story's own
          // pictures. See AssetStore.resolve()'s own header comment for
          // the full mechanism.
          data.project.recallOwnerId=ownerId;
        }
        // Stamped with the card being recalled, NOT the card that
        // happens to be active on this machine. These Stories are the
        // recalled Creator's own, materialised here; attributing them
        // to whoever last used this browser is the very bug the
        // scoping exists to stop.
        CreatorProjectStore.upsert(newId,
          {name:record.name,thumbnail:record.thumbnail,
           creatorName:record.creatorName,cardId:cardId||undefined},data);
      });
    }).catch(function(){});
  }

  // Real, already-available signals a "growing sky" presentation layer
  // can draw from without inventing a second gamification subsystem —
  // see the design document's own Section 16 (Technical Architecture)
  // and Section 10 (Constellation Lifecycle)'s "no counters, no
  // levels" constraint: these numbers exist to DERIVE a soft visual
  // (how many small companion stars to draw, how bright the glow is),
  // never to be shown to the child as a number.
  function growthSignals(){
    let projectCount=0;
    let worldCount=0;
    try{
      if(typeof CreatorProjectStore!=='undefined'){
        const projects=CreatorProjectStore.list();
        projectCount=projects.length;
        // Magic Card Canon's "Worlds Created" -- derived from the
        // distinct Worlds/Themes actually used across a Creator's own
        // stories (js/projectManager.js's serialize()'s own
        // project.theme field), never a second stored counter, per
        // this same design's "no counters, no levels" discipline.
        // Falls back to the story count itself if a project's own
        // theme field can't be read for any reason -- never throws,
        // never blocks the card from rendering.
        const themeIds={};
        projects.forEach(function(p){
          try{
            const t=p.data && p.data.project && p.data.project.theme;
            if(t) themeIds[t]=true;
          }catch(e){}
        });
        const distinct=Object.keys(themeIds).length;
        worldCount=distinct||projectCount;
      }
    }catch(e){}
    const flags=_readFlags();
    return {
      projectCount:projectCount,
      worldCount:worldCount,
      daysSinceClaim:(function(){
        const active=getActive();
        if(!active) return 0;
        const ms=Date.now()-new Date(active.claimedAt).getTime();
        return Math.max(0,Math.floor(ms/86400000));
      })(),
      hasEverPublished:!!flags.hasEverPublished
    };
  }

  // Whether the first-Publish Awakening ceremony should run right now.
  // "start as traveller, become creator, reload the page on the
  // challenge screen, go back and choose to move forward as a
  // traveller" -- checking list().length===0 here meant that once ANY
  // card had ever been claimed on this device, the ceremony could never
  // be offered again to ANY later Traveller session on it, even one
  // that just explicitly declared "I'm not that recognized Creator,
  // treat me as fresh" (js/gatewaySequence.js's own "Continue as a
  // Traveller" decline, which already clears the active-card pointer
  // for exactly this reason). The real question is "is nobody currently
  // recognized," not "has this device ever seen a card" -- a shared
  // device may legitimately carry a sibling's own card in list() while
  // THIS session is a genuine, unrecognized Traveller. getActive() is
  // that per-session signal; list().length is not. awakeningOffered
  // still gates the "never nagged again automatically" rule -- once
  // set, it's reset only at the exact same decline point that clears
  // the active pointer (see gatewaySequence.js), never here.
  function shouldOfferAwakening(){
    return !getActive() && !_readFlags().awakeningOffered;
  }
  function markAwakeningOffered(){ setFlags({awakeningOffered:true}); }
  function markEverPublished(){ setFlags({hasEverPublished:true}); }

  const api={
    list:list,
    get:get,
    count:count,
    getActiveId:getActiveId,
    getActive:getActive,
    // Decision 22 — the taught record. Read and written only by
    // js/studioRite.js, which owns what a capability means.
    taught:taught,
    setTaught:setTaught,
    setActive:setActive,
    touch:touch,
    generatePattern:generatePattern,
    decorativeSkyFor:decorativeSkyFor,
    assignBondedCompanion:assignBondedCompanion,
    ensureBondedCompanion:ensureBondedCompanion,
    claim:claim,
    rename:rename,
    recall:recall,
    adopt:adopt,
    orderLikeAnySky:orderLikeAnySky,
    // The library, for anything that wants to describe a sky. Copies
    // out, so a caller cannot reach in and edit the catalogue.
    library:function(){
      return Object.keys(CONSTELLATIONS).map(function(n){
        const m=CONSTELLATION_META[n]||{};
        return {
          key:n, id:m.id||n.toLowerCase(), name:m.name||n, family:m.family||'',
          stars:CONSTELLATIONS[n].length, about:m.about||'',
          hemisphere:m.hemisphere||'', mintable:m.mintable!==false,
          pattern:CONSTELLATIONS[n].map(function(p){ return [p[0],p[1]]; })
        };
      });
    },
    traceIsCertain:traceIsCertain,
    growthSignals:growthSignals,
    shouldOfferAwakening:shouldOfferAwakening,
    markAwakeningOffered:markAwakeningOffered,
    markEverPublished:markEverPublished,
    getFlags:getFlags,
    setFlags:setFlags
  };
  try{ window.MagicCard=api; }catch(e){}
  return api;
})();
