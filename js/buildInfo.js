(function(){
  function setFooterText(text){
    try{
      var el=document.getElementById('devFooter');
      if(!el) return;
      el.textContent=text;
    }catch(e){}
  }

  var fallback='VihuStudio \u2022 Development';

  // Only version/build/commit/environment ever render in the on-screen
  // corner badge \u2014 `sprint`/`task` are this project's own long-form
  // changelog prose (see CLAUDE.md's own entries), never meant for a
  // small fixed-position footer; they used to be concatenated in
  // wholesale, producing a 1000+ character, multi-line banner that
  // covered a large part of the screen. The full build-info.json
  // (including sprint/task) is still fetched here and still a real
  // file anyone can open directly for that detail.
  function summarize(j){
    var v=j.version||'';
    var b=j.build||'';
    var c=j.commit||'';
    var e=j.environment||'';
    var parts=[];
    parts.push(v ? 'VihuStudio '+v : 'VihuStudio');
    if(b) parts.push('Build '+b);
    if(c) parts.push(c);
    if(e) parts.push(e);
    return parts.join(' \u2022 ');
  }

  if(window.fetch){
    fetch('build-info.json', {cache: 'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('no-build-info'); return r.json(); })
      .then(function(j){
         try{ setFooterText(summarize(j)); }
         catch(err){ setFooterText(fallback); }
      })
      .catch(function(){ setFooterText(fallback); });
  }else{
    try{
      var xhr=new XMLHttpRequest();
      xhr.open('GET','build-info.json',true);
      xhr.onreadystatechange=function(){
        if(xhr.readyState!==4) return;
        if(xhr.status>=200 && xhr.status<300){
          try{ setFooterText(summarize(JSON.parse(xhr.responseText))); }
          catch(e){ setFooterText(fallback); }
        }else{
          setFooterText(fallback);
        }
      };
      xhr.send();
    }catch(e){ setFooterText(fallback); }
  }
})();
