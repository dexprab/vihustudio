// Audio Mixer — a temporary developer utility wiring the DOM controls in
// tools/audio-mixer/index.html up to js/audioManager.js's own additive
// "Temporary mixing-console API" (getFoundationLayers/setLayerVolume/
// setWorldFadeMs/setMuteFadeMs). This page never modifies audioManager.js
// itself -- the "Copy as Code" panel is the deliberate hand-off point for
// baking a chosen mix into the real, shipped defaults.
(function(){
  'use strict';

  function friendlyName(file){
    var base=file.replace(/\.[^.]+$/,'');
    return base.charAt(0).toUpperCase()+base.slice(1);
  }

  function init(){
    if(typeof AudioManager==='undefined'){
      document.getElementById('am-root').innerHTML='<p style="padding:40px;color:#a33;">AudioManager failed to load — check that js/audioManager.js is reachable at ../../js/audioManager.js.</p>';
      return;
    }

    AudioManager.init();

    var startBtn=document.getElementById('am-start-btn');
    var muteBtn=document.getElementById('am-mute-btn');
    var masterSlider=document.getElementById('am-master-volume');
    var masterVal=document.getElementById('am-master-volume-val');
    var layersHost=document.getElementById('am-layers');
    var worldFadeSlider=document.getElementById('am-world-fade');
    var worldFadeVal=document.getElementById('am-world-fade-val');
    var muteFadeSlider=document.getElementById('am-mute-fade');
    var muteFadeVal=document.getElementById('am-mute-fade-val');
    var worldFileInput=document.getElementById('am-world-file');
    var worldPlayBtn=document.getElementById('am-world-play');
    var worldStopBtn=document.getElementById('am-world-stop');
    var codeOut=document.getElementById('am-code-out');
    var copyBtn=document.getElementById('am-copy-btn');
    var resetBtn=document.getElementById('am-reset-btn');
    var copyStatus=document.getElementById('am-copy-status');

    var DEFAULT_LAYERS=[
      {file:'air.mp3',volume:0.5},
      {file:'harmony.mp3',volume:0.03},
      {file:'magic.mp3',volume:0},
      {file:'forest.mp3',volume:0.28},
      {file:'wind.mp3',volume:0.07}
    ];
    var DEFAULT_MASTER=0.4;
    var DEFAULT_WORLD_FADE=2700;
    var DEFAULT_MUTE_FADE=300;

    function pct(n){ return Math.round(n*100); }

    function buildLayerRows(){
      layersHost.innerHTML='';
      var layers=AudioManager.getFoundationLayers();
      layers.forEach(function(layer){
        var row=document.createElement('div');
        row.className='am-row am-layer-row';
        var label=document.createElement('label');
        label.textContent=friendlyName(layer.file);
        var slider=document.createElement('input');
        slider.type='range';
        slider.min='0'; slider.max='100'; slider.value=String(pct(layer.volume));
        slider.dataset.file=layer.file;
        var val=document.createElement('span');
        val.className='am-value';
        val.textContent=pct(layer.volume)+'%';
        slider.addEventListener('input',function(){
          var v=parseInt(slider.value,10)/100;
          AudioManager.setLayerVolume(layer.file,v);
          val.textContent=slider.value+'%';
          refreshCode();
        });
        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(val);
        layersHost.appendChild(row);
      });
    }

    function refreshCode(){
      var layers=AudioManager.getFoundationLayers();
      var lines=layers.map(function(l){
        return "    {file:'"+l.file+"',volume:"+(Math.round(l.volume*100)/100)+"}";
      });
      var code=
        "const FOUNDATION_LAYERS=[\n"+lines.join(',\n')+"\n  ];\n\n"+
        "const DEFAULT_WORLD_FADE_MS="+AudioManager.getWorldFadeMs()+";\n"+
        "const DEFAULT_MUTE_FADE_MS="+AudioManager.getMuteFadeMs()+";\n\n"+
        "// Master volume default (js/audioManager.js's own DEFAULT_VOLUME):\n"+
        "const DEFAULT_VOLUME="+(Math.round(AudioManager.getVolume()*100)/100)+";";
      codeOut.textContent=code;
    }

    startBtn.addEventListener('click',function(){
      AudioManager.playFoundation();
    });

    muteBtn.addEventListener('click',function(){
      var next=!AudioManager.isMuted();
      AudioManager.setMuted(next);
      muteBtn.textContent=next ? '🔊 Unmute' : '🔇 Mute';
      muteBtn.classList.toggle('am-active',next);
    });

    masterSlider.addEventListener('input',function(){
      var v=parseInt(masterSlider.value,10)/100;
      AudioManager.setVolume(v);
      masterVal.textContent=masterSlider.value+'%';
      refreshCode();
    });

    worldFadeSlider.addEventListener('input',function(){
      var ms=parseInt(worldFadeSlider.value,10);
      AudioManager.setWorldFadeMs(ms);
      worldFadeVal.textContent=ms+'ms';
      refreshCode();
    });

    muteFadeSlider.addEventListener('input',function(){
      var ms=parseInt(muteFadeSlider.value,10);
      AudioManager.setMuteFadeMs(ms);
      muteFadeVal.textContent=ms+'ms';
      refreshCode();
    });

    worldPlayBtn.addEventListener('click',function(){
      var name=(worldFileInput.value||'').trim();
      if(!name) return;
      AudioManager.playWorld([name]);
    });
    worldStopBtn.addEventListener('click',function(){
      AudioManager.stopWorld();
    });

    copyBtn.addEventListener('click',function(){
      var text=codeOut.textContent;
      var done=function(){
        copyStatus.textContent='Copied — paste into js/audioManager.js.';
        setTimeout(function(){ copyStatus.textContent=''; },2500);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done).catch(function(){
          copyStatus.textContent='Could not copy automatically — select the text above manually.';
        });
      }else{
        copyStatus.textContent='Clipboard API unavailable — select the text above manually.';
      }
    });

    // Sync the sliders/mute button to whatever AudioManager actually has
    // right now (e.g. a volume/mute preference already persisted to
    // localStorage from a real Studio session in this same browser) instead
    // of assuming the HTML's own hardcoded starting values.
    function syncControlsFromLiveState(){
      var mv=AudioManager.getVolume();
      masterSlider.value=String(pct(mv));
      masterVal.textContent=pct(mv)+'%';
      var muted=AudioManager.isMuted();
      muteBtn.textContent=muted ? '🔊 Unmute' : '🔇 Mute';
      muteBtn.classList.toggle('am-active',muted);
      var wf=AudioManager.getWorldFadeMs();
      worldFadeSlider.value=String(wf);
      worldFadeVal.textContent=wf+'ms';
      var mf=AudioManager.getMuteFadeMs();
      muteFadeSlider.value=String(mf);
      muteFadeVal.textContent=mf+'ms';
    }

    resetBtn.addEventListener('click',function(){
      DEFAULT_LAYERS.forEach(function(l){ AudioManager.setLayerVolume(l.file,l.volume); });
      AudioManager.setVolume(DEFAULT_MASTER);
      AudioManager.setWorldFadeMs(DEFAULT_WORLD_FADE);
      AudioManager.setMuteFadeMs(DEFAULT_MUTE_FADE);
      masterSlider.value=String(pct(DEFAULT_MASTER));
      masterVal.textContent=pct(DEFAULT_MASTER)+'%';
      worldFadeSlider.value=String(DEFAULT_WORLD_FADE);
      worldFadeVal.textContent=DEFAULT_WORLD_FADE+'ms';
      muteFadeSlider.value=String(DEFAULT_MUTE_FADE);
      muteFadeVal.textContent=DEFAULT_MUTE_FADE+'ms';
      buildLayerRows();
      refreshCode();
    });

    syncControlsFromLiveState();
    buildLayerRows();
    refreshCode();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  }else{
    init();
  }
})();
