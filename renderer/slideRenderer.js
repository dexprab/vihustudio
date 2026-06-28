const SlideRenderer=(()=>{
  let c,x;
  const W=1080,H=1350;

  // Embedded fallback so the renderer remains usable even if ThemeEngine
  // is not loaded. Matches Storybook Classic.
  const FALLBACK_THEME={
    frame:{color:'#1D3457'},
    panel:{color:'#FFFFFF'},
    storyText:{font:'Arial',size:56,color:'#FFFFFF'},
    footerText:{font:'Arial',size:24,color:'#FFFFFF'},
    watermark:{font:'Arial',size:24,color:'#FFFFFF'}
  };

  function _theme(s){
    if(s && s.theme) return s.theme;
    if(typeof ThemeEngine!=='undefined'){
      try{ return ThemeEngine.getActiveTheme(); }catch(e){}
    }
    return FALLBACK_THEME;
  }

  function init(cv){ c=cv; c.width=W; c.height=H; x=c.getContext('2d'); }

  function render(s){
    if(!x) return;
    const t=_theme(s);
    x.fillStyle=t.frame.color;
    x.fillRect(0,0,W,H);
    x.fillStyle=t.panel.color;
    x.fillRect(70,185,940,930);
    x.fillStyle=t.storyText.color;
    x.font=t.storyText.size+'px '+t.storyText.font;
    x.fillText(s.storyBeat||'',60,100);
    x.fillStyle=t.watermark.color;
    x.font=t.watermark.size+'px '+t.watermark.font;
    x.fillText('@vihuplanet',850,60);
    if(s.image && s.image.width){
      const sc=Math.min(900/s.image.width,890/s.image.height);
      const w=s.image.width*sc, h=s.image.height*sc;
      x.drawImage(s.image,70+(940-w)/2,185+(930-h)/2,w,h);
    }
    x.fillStyle=t.footerText.color;
    x.font=t.footerText.size+'px '+t.footerText.font;
    x.fillText(s.bookTitle||'',320,1285);
    x.fillText((s.page||1)+' / '+(s.totalPages||1),900,1285);
  }

  const api={init,render};
  try{ window.SlideRenderer=api; }catch(e){}
  return api;
})();
