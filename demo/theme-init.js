// Runs before the stylesheet to avoid a light flash on a dark preference.
(()=>{
 const key='rally:appearance',media=matchMedia('(prefers-color-scheme: dark)');
 const valid=value=>['light','dark','system'].includes(value)?value:'system';
 let mode='system';try{mode=valid(localStorage.getItem(key));}catch{}
 const apply=()=>{const resolved=mode==='system'?(media.matches?'dark':'light'):mode;document.documentElement.dataset.theme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#0c131d':'#f5f6f2');window.dispatchEvent(new CustomEvent('rally:theme-change',{detail:mode}));};
 window.rallyTheme={getMode:()=>mode,setMode:value=>{mode=valid(value);try{localStorage.setItem(key,mode);}catch{}apply();}};
 media.addEventListener('change',()=>{if(mode==='system')apply();});
 window.addEventListener('storage',event=>{if(event.key===key){mode=valid(event.newValue);apply();}});
 apply();
})();
