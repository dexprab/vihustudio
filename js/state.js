const AppState={
 project:{
   title:'My Adventure',
   author:'',
   bookTitle:'My Adventure',
   theme:'storybook-classic',
   themeOptions:{
     variant:'classic',
     panelStyle:'classic',
     footerStyle:'classic',
     decorations:[],
     // Off by default per explicit product direction -- see the matching
     // comment on js/themeEngine.js's _defaultOptionsFor(). Reversible:
     // flip back to 'bottom-right' / 'show' to restore the old default.
     pageNumber:'hidden',
     bookTitleVisibility:'hide',
     bookTitlePosition:'bottom-left',
     handleVisibility:'show',
     handlePosition:'top-right'
   },
   createdDate:'',
   modifiedDate:''
 },
 slides:[],
 currentSlide:0
};
