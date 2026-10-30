import {mountPresence} from './presence.ts';
// The same renderer and idle state as meetings, without meeting text or audio.
export function setupMascot(){
 let surface:ReturnType<typeof mountPresence>|null=null,frame=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),slot=document.getElementById('rally-mascot')!;
 function motion(){
  cancelAnimationFrame(frame);if(!surface?.silk)return;
  const current=surface;current.host.dataset.motion=reduced.matches?'reduced':'animated';current.silk!.resume();
  // Paint a still image, then stop rendering for reduced-motion users.
  if(reduced.matches)frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{if(surface===current)current.silk?.pause();});});
 }
 const resize=new ResizeObserver(()=>{if(reduced.matches)motion();});
 reduced.addEventListener('change',motion);
 const api={
  show(){if(surface)return;surface=mountPresence(slot,false,{mascot:true});resize.observe(slot);motion();},
  hide(){cancelAnimationFrame(frame);resize.disconnect();surface?.dispose();surface=null;},
 };
 window.addEventListener('pagehide',api.hide);
 window.addEventListener('pageshow',()=>{if(!document.getElementById('workspace')!.hidden&&!document.getElementById('home')!.hidden)api.show();});
 return api;
}
