(function(){
  // Small, defensive loader for build-info.json
  function setFooterText(text){
    try{
      var el=document.getElementById('devFooter');
      if(!el) return;
      el.textContent=text;
    }catch(e){/* swallow any errors to avoid affecting app */}
  }

  var fallback='VihuStudio • Development';

  // Try fetch API first
  if(window.fetch){
    fetch('build-info.json', {cache: 'no-store'})
      .then(function(r){ if(!r.ok) throw new Error('no-build-info'); return r.json(); })
      .then(function(j){
         try{
           var v=j.version||'';
           var d=j.buildDate||'';
           var c=j.commit||'';
           var e=j.environment||'';
           var parts=[];
           if(v) parts.push('VihuStudio '+v); else parts.push('VihuStudio');
           if(d) parts.push('Build: '+d);
           if(c) parts.push('Commit: '+c);
           if(e) parts.push(e);
           setFooterText(parts.join(' • '));
         }catch(err){ setFooterText(fallback); }
      })
      .catch(function(){ setFooterText(fallback); });
  }else{
    // Older browsers - attempt XHR
    try{
      var xhr=new XMLHttpRequest();
      xhr.open('GET','build-info.json',true);
      xhr.onreadystatechange=function(){
        if(xhr.readyState!==4) return;
        if(xhr.status>=200 && xhr.status<300){
          try{
            var j=JSON.parse(xhr.responseText);
            var v=j.version||'';
            var d=j.buildDate||'';
            var c=j.commit||'';
            var e=j.environment||'';
            var parts=[];
            if(v) parts.push('VihuStudio '+v); else parts.push('VihuStudio');
            if(d) parts.push('Build: '+d);
            if(c) parts.push('Commit: '+c);
            if(e) parts.push(e);
            setFooterText(parts.join(' • '));
          }catch(e){ setFooterText(fallback); }
        }else{
          setFooterText(fallback);
        }
      };
      xhr.send();
    }catch(e){ setFooterText(fallback); }
  }
})();
