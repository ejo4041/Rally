declare global{interface Window{rallyTheme:{getMode():string;setMode(mode:string):void}}}
export function setupTheme(){
 const controls=Array.from(document.querySelectorAll<HTMLSelectElement>('[data-theme-selector]'));
 const sync=()=>{for(const control of controls)control.value=window.rallyTheme.getMode();};
 for(const control of controls)control.onchange=()=>window.rallyTheme.setMode(control.value);
 window.addEventListener('rally:theme-change',sync);sync();
}
