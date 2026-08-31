// =============================================================
// VihuStudio — Creation Share Client (Sprint LOOK WHAT I MADE)
// -------------------------------------------------------------
// The browser's one way of talking to the creation-share Edge
// Function. The child's interface never sees any of this — it
// says "Send this to my parent" and this module carries the
// adult machinery: the verified session, the payload, and the
// answer.
//
// Same conventions as js/skyProtection.js:
//   * config from supabase-config.json, resolved relative to this
//     script so it works from any page depth
//   * the session token from ThemeRepositoryClient (a LIVE
//     session — that module refreshes it, Decision 51's lesson)
//   * every failure is an answered { ok:false, reason }, never a
//     throw — an unconfigured platform degrades to "not right
//     now", never to a broken hub
//   * every network promise on a path a child waits on carries a
//     bound (Decision 49) — a share that hangs must hand the hub
//     back, not hold SEND busy for ever
// =============================================================

const CreationShareClient=(function(){
  'use strict';

  const FN_NAME='creation-share';
  const CALL_TIMEOUT_MS=20000; // a payload of pages is real upload work

  let _cfgPromise=null;

  function _configUrl(){
    try{
      const el=document.currentScript;
      if(el&&el.src) return new URL('../supabase-config.json',el.src).href;
    }catch(e){}
    return 'supabase-config.json';
  }
  const CONFIG_URL=_configUrl();

  function _config(){
    if(_cfgPromise) return _cfgPromise;
    _cfgPromise=fetch(CONFIG_URL,{cache:'no-store'})
      .then(function(r){ return r.ok?r.json():null; })
      .then(function(cfg){
        if(cfg&&cfg.url&&cfg.anonKey) return cfg;
        _cfgPromise=null; // a failure is not remembered
        return null;
      })
      .catch(function(){ _cfgPromise=null; return null; });
    return _cfgPromise;
  }

  function _token(){
    try{
      if(typeof ThemeRepositoryClient==='undefined') return Promise.resolve(null);
      return Promise.resolve(ThemeRepositoryClient.getSession())
        .then(function(s){ return (s&&s.access_token)||null; })
        .catch(function(){ return null; });
    }catch(e){ return Promise.resolve(null); }
  }

  function _bounded(promise,ms){
    let bell=null;
    const capped=new Promise(function(resolve){
      bell=setTimeout(function(){ resolve({ok:false,reason:'unreachable'}); },ms);
    });
    return Promise.race([promise,capped]).then(function(v){
      clearTimeout(bell); return v;
    });
  }

  function _call(payload){
    return _config().then(function(cfg){
      if(!cfg) return {ok:false,reason:'not_configured'};
      return _token().then(function(token){
        if(!token) return {ok:false,reason:'not_configured'};
        const url=cfg.url.replace(/\/+$/,'')+'/functions/v1/'+FN_NAME;
        let ctl=null;
        try{ ctl=new AbortController(); }catch(e){}
        const req=fetch(url,Object.assign({
          method:'POST',
          headers:{
            Authorization:'Bearer '+token,
            apikey:cfg.anonKey,
            'Content-Type':'application/json'
          },
          body:JSON.stringify(payload)
        },ctl?{signal:ctl.signal}:null))
          .then(function(r){ return r.json().catch(function(){ return {ok:false,reason:'unreachable'}; }); })
          .catch(function(){ return {ok:false,reason:'unreachable'}; });
        return _bounded(req,CALL_TIMEOUT_MS).then(function(answer){
          if(answer&&answer.ok===false&&answer.reason==='unreachable'&&ctl){
            try{ ctl.abort(); }catch(e){}
          }
          return answer||{ok:false,reason:'unreachable'};
        });
      });
    });
  }

  function _identityId(){
    try{
      const card=(typeof MagicCard!=='undefined'&&MagicCard.getActive)?MagicCard.getActive():null;
      return (card&&(card.identityId||card.id))||null;
    }catch(e){ return null; }
  }

  // A function deployed before the sweep learned `pagesPlain`
  // refuses the whole payload by that key's name — which is the
  // sweep doing its job, and must never cost a child their share
  // during the deploy window. One retry, without the one optional
  // key the server named; nothing else is ever stripped.
  // The optional keys a NEWER client sends that an OLDER deployed
  // sweep may refuse by name. Nothing else is ever stripped: a
  // refusal naming a required key is a real refusal.
  const OPTIONAL_KEYS=['pagesPlain','creatorUsername'];
  function _callWithPlainFallback(body,depth){
    return _call(body).then(function(answer){
      if(answer&&answer.ok===false&&answer.reason==='not-shareable'
         &&OPTIONAL_KEYS.indexOf(answer.key)!==-1
         &&body.payload&&body.payload[answer.key]!=null
         &&(depth||0)<OPTIONAL_KEYS.length){
        const slim=Object.assign({},body,{
          payload:(function(){
            const p=Object.assign({},body.payload);
            delete p[answer.key];
            return p;
          })()
        });
        return _callWithPlainFallback(slim,(depth||0)+1);
      }
      return answer;
    });
  }

  // Mint (or refresh) the creation's one stable share. Used by the
  // Story Card for its QR, and by send() underneath.
  function mint(projectId,payload){
    const body={action:'mint',projectId:projectId,payload:payload};
    const id=_identityId();
    if(id) body.identityId=id;
    return _callWithPlainFallback(body);
  }

  // Send the creation to the child's grown-up. `email` is either
  // the answer to "Who should I send it to?" (kept on the card as a
  // first address) or, with opts.once, a one-time "Send this to…"
  // destination that is used for THIS share and stored nowhere.
  function send(projectId,payload,email,opts){
    const body={action:'send',projectId:projectId,payload:payload};
    const id=_identityId();
    if(id) body.identityId=id;
    if(email) body.email=String(email).trim();
    if(opts&&opts.once) body.once=true;
    return _callWithPlainFallback(body);
  }

  const api={ mint:mint, send:send };
  try{ window.CreationShareClient=api; }catch(e){}
  return api;
})();
