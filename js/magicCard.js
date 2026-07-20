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

  // Same curated shapes/grid as js/cardPlatform.js's own CONSTELLATIONS
  // — not astronomically precise, recognizable and pleasant to trace.
  const CONSTELLATIONS={
    ORION:[[1,2],[1,7],[4,4],[4,5],[4,6],[8,2],[8,7]],
    CASSIOPEIA:[[2,1],[4,3],[2,5],[4,7],[2,9]],
    URSA_MAJOR:[[1,1],[1,4],[3,4],[3,2],[4,5],[6,7],[8,8]],
    CYGNUS:[[1,5],[4,5],[7,5],[4,2],[4,8]],
    LYRA:[[2,5],[5,3],[5,7],[7,3],[7,7]]
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
  function _pickConstellationName(rand){
    rand=rand||Math.random;
    const names=Object.keys(CONSTELLATIONS);
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

  function _readCards(){
    try{
      const raw=localStorage.getItem(CARDS_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
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
  function _pushIdentitySnapshot(card){
    if(!card || typeof ThemeRepositoryClient==='undefined') return;
    ThemeRepositoryClient.isConfigured().then(function(ok){
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
            companion_species:card.companionSpecies||null
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
      _pushIdentitySnapshot(get(id));
    },CLOUD_SYNC_DEBOUNCE_MS);
  }

  // Generates a pattern WITHOUT persisting anything — used by the
  // Awakening ceremony (magicCardUI.js) to show the child the exact sky
  // they'll actually get if they claim it. Nothing is "locked in" until
  // claim() below is called with this same value, so "Maybe Later"
  // leaves no half-created card behind.
  function generatePattern(){
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
      companionSpecies:(companionFields&&companionFields.companionSpecies)||''
    };
    const cards=_readCards();
    cards.push(card);
    _writeCards(cards);
    setActive(card.id);
    // A one-time event, not a rapid-succession edit stream -- pushed
    // immediately rather than debounced, unlike touch()/rename() below.
    _pushIdentitySnapshot(card);
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
  function adopt(remoteResult,pattern){
    const now=new Date().toISOString();
    const card={
      id:remoteResult.identity_id,
      nickname:remoteResult.nickname||'',
      constellation:remoteResult.constellation,
      pattern:pattern||null,
      claimedAt:remoteResult.claimed_at||now,
      lastActiveAt:now,
      // Companion Canon V2 -- the bond travels with the identity, not
      // the device: recall_magic_card() (supabase/schema.sql) returns
      // the SAME companion this identity was originally bonded to,
      // never a fresh re-roll (assignBondedCompanion() is only ever
      // called by claim()/ensureBondedCompanion(), never here).
      companionId:remoteResult.companion_id||null,
      companionName:remoteResult.companion_name||'',
      companionSpecies:remoteResult.companion_species||''
    };
    const cards=_readCards();
    const idx=cards.findIndex(function(c){ return c.id===card.id; });
    if(idx===-1) cards.push(card); else cards[idx]=card;
    _writeCards(cards);
    setActive(card.id);
    _pullRecalledProjects(remoteResult.owner_id);
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
  function _pullRecalledProjects(ownerId){
    if(typeof CreatorProjectSync==='undefined' || typeof CreatorProjectStore==='undefined' || !ownerId) return;
    CreatorProjectSync.listByOwner(ownerId).then(function(rows){
      rows.forEach(function(row){
        const record=row.data;
        if(!record) return;
        const newId=CreatorProjectStore.newId();
        const data=record.data;
        if(data && data.project) data.project.id=newId;
        CreatorProjectStore.upsert(newId,{name:record.name,thumbnail:record.thumbnail},data);
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

  // Whether the first-Publish Awakening ceremony should run right now —
  // true exactly once per browser: no claimed card exists yet, and the
  // ceremony has never been offered before (whether the earlier offer
  // was claimed, deferred, or declined — offering it is a one-time
  // event per this design's own "never nagged again automatically"
  // decision; a permanent, quiet "claim later" affordance lives
  // elsewhere for a child who said not-yet).
  function shouldOfferAwakening(){
    return list().length===0 && !_readFlags().awakeningOffered;
  }
  function markAwakeningOffered(){ setFlags({awakeningOffered:true}); }
  function markEverPublished(){ setFlags({hasEverPublished:true}); }

  const api={
    list:list,
    get:get,
    count:count,
    getActiveId:getActiveId,
    getActive:getActive,
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
