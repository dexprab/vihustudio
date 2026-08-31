// =============================================================
// VihuPlanet — Creator Handle (Sprint SOCIAL 1)
// -------------------------------------------------------------
// The rules for a public VihuPlanet name (@moonmaker), in ONE
// client-side place: what a name may look like, which names the
// platform keeps for itself, and how one is shown.
//
// The SERVER is the authority — creator_username_claim() in
// supabase/migrations_social_identity.sql enforces the same rules
// beside the unique index that makes them matter, so a client
// that skips this module changes nothing. This copy exists so the
// choose-your-name dialog can answer instantly and kindly, and
// the social-identity suite cross-checks the two rule sets so
// they cannot drift.
//
// A username is a PUBLIC ALIAS, never the account: it is stored
// on the Magic Card identity (Decision 11 — the card IS the
// Creator), travels with recall like the companion bond does, and
// is stamped onto shared stories the way creatorName always has
// been. It is never derived from anything private and never
// appears beside an account id.
// =============================================================

const CreatorHandle=(function(){
  'use strict';

  const MIN=3, MAX=20;
  const SHAPE=/^[a-z0-9_]+$/;

  // Platform names and routes. Kept in step with the SQL claim
  // function's own list; the suite fails if the two disagree.
  const RESERVED=[
    'admin','support','vihuplanet','vihustudio','studio','ether','system',
    'official','vihu','lumo','leafy','quill','nimbus','leo','leosaurus',
    'canon','traveller','creator','moderator','mod','help','about','root',
    'api','www','magic','magiccard','staff','team','planet','home'
  ];

  function normalize(raw){
    return String(raw||'').trim().replace(/^@+/,'').toLowerCase();
  }

  // { ok:true, username } or { ok:false, reason:'invalid'|'reserved' }.
  // 'taken' can only come from the platform — uniqueness is global.
  function validate(raw){
    const name=normalize(raw);
    if(name.length<MIN||name.length>MAX||!SHAPE.test(name)||!/[a-z]/.test(name)){
      return { ok:false, reason:'invalid' };
    }
    if(RESERVED.indexOf(name)!==-1) return { ok:false, reason:'reserved' };
    return { ok:true, username:name };
  }

  function display(name){
    const n=normalize(name);
    return n?('@'+n):'';
  }

  // Two names are the same name whatever case they arrived in.
  function same(a,b){
    const x=normalize(a), y=normalize(b);
    return !!x && x===y;
  }

  const api={ normalize:normalize, validate:validate, display:display,
              same:same, RESERVED:RESERVED.slice(), MIN:MIN, MAX:MAX };
  try{ window.CreatorHandle=api; }catch(e){}
  return api;
})();
