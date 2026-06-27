// Theme management
const ThemeManager=(function(){
  const STORAGE_KEY='vihustudio-theme';
  const THEMES={light:'light-theme',dark:'dark-theme'};

  function init(){
    const saved=localStorage.getItem(STORAGE_KEY)||'light';
    applyTheme(saved);
  }

  function applyTheme(theme){
    const body=document.body;
    body.classList.remove(THEMES.light,THEMES.dark);
    if(theme==='dark'){
      body.classList.add(THEMES.dark);
    }else{
      body.classList.add(THEMES.light);
    }
    localStorage.setItem(STORAGE_KEY,theme);
    updateToggleButton(theme);
  }

  function updateToggleButton(theme){
    const btn=document.getElementById('themeToggle');
    if(btn){
      btn.textContent=theme==='dark'?'☀':'🌙';
    }
  }

  function toggle(){
    const current=localStorage.getItem(STORAGE_KEY)||'light';
    const next=current==='dark'?'light':'dark';
    applyTheme(next);
  }

  return {init,toggle,applyTheme};
})();

window.addEventListener('DOMContentLoaded',()=>{
  ThemeManager.init();
  const themeToggle=document.getElementById('themeToggle');
  if(themeToggle){
    themeToggle.onclick=()=>ThemeManager.toggle();
  }
});
