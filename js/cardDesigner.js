// CardDesigner — reusable foundation shared by Story / Cover / CTA Designers.
// Sprint 4.1: structure, public API, mount/unmount only. No control behavior yet.
// Future sub-tasks will hang real controls under each section's body container.
const CardDesigner=(function(){
  const SECTIONS=[
    {
      id:'image',
      title:'Image',
      summary:'Image scale, position, and fit mode controls. Reserved for Sprint 4.x.'
    },
    {
      id:'card',
      title:'Card',
      summary:'Card styling with theme defaults and per-card overrides. Reserved for Sprint 4.x.'
    },
    {
      id:'text',
      title:'Text',
      summary:'Typography controls — font, size, alignment. Reserved for Sprint 4.x.'
    }
  ];

  function getSections(){ return SECTIONS.slice(); }

  function _buildSection(s){
    const section=document.createElement('section');
    section.className='designer-group';
    section.setAttribute('data-card-section',s.id);

    const header=document.createElement('button');
    header.type='button';
    header.className='designer-group-title';
    header.setAttribute('aria-expanded','true');
    header.setAttribute('data-collapsible-toggle','');

    const text=document.createElement('span');
    text.className='designer-group-title-text';
    text.textContent=s.title;
    header.appendChild(text);

    const chev=document.createElement('span');
    chev.className='designer-group-chevron';
    chev.setAttribute('aria-hidden','true');
    chev.textContent='▾';
    header.appendChild(chev);

    section.appendChild(header);

    const body=document.createElement('div');
    body.className='designer-group-body';
    // Section body container — referenced by future control implementations
    // via `[data-card-section="..."] .card-section-body`.
    const sub=document.createElement('div');
    sub.className='card-section-body';
    sub.setAttribute('data-card-section-body',s.id);

    const note=document.createElement('p');
    note.className='placeholder';
    note.textContent=s.summary;
    sub.appendChild(note);

    body.appendChild(sub);
    section.appendChild(body);
    return section;
  }

  // Mount the Card Designer foundation into a container element.
  // Returns the mounted root element (or null if the container is missing).
  function mount(container){
    if(!container) return null;
    if(container.__cardDesignerRoot){ return container.__cardDesignerRoot; }
    container.innerHTML='';
    const root=document.createElement('div');
    root.className='card-designer';
    SECTIONS.forEach(function(s){ root.appendChild(_buildSection(s)); });
    container.appendChild(root);
    container.__cardDesignerRoot=root;

    // Wire collapsible behavior on the headers we just rendered. The Theme
    // Designer in app.js also delegates [data-collapsible-toggle] clicks, but
    // CardDesigner manages its own lifecycle so it works regardless of mount
    // order or whether it shares a host page with the Theme Designer.
    root.querySelectorAll('[data-collapsible-toggle]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const group=btn.closest('.designer-group');
        if(!group) return;
        const collapsed=group.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded',collapsed?'false':'true');
      });
    });

    return root;
  }

  // Returns the section body container for a given section id within a
  // mounted root — the documented attachment point for future controls.
  function getSectionBody(container,sectionId){
    if(!container||!sectionId) return null;
    return container.querySelector('[data-card-section-body="'+sectionId+'"]');
  }

  function unmount(container){
    if(!container) return;
    container.innerHTML='';
    delete container.__cardDesignerRoot;
  }

  const api={
    SECTIONS:SECTIONS,
    getSections:getSections,
    mount:mount,
    unmount:unmount,
    getSectionBody:getSectionBody
  };
  try{ window.CardDesigner=api; }catch(e){}
  return api;
})();
