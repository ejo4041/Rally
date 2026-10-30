import type { Meeting } from './api.ts';
const $=(id:string)=>document.getElementById(id)!;
export function setupMeetingLayout() {
 const restore=new Map<string,()=>void>();
 const planHome=$('agenda-panel').parentNode!,planNext=$('agenda-panel').nextSibling;
 let current:Meeting|null=null;
 function positionPlan(){if(!current||restore.has('plan-sheet'))return;const panel=$('agenda-panel');if(matchMedia('(max-width:760px)').matches&&!['live','ended'].includes(current.phase))$('meeting').insertBefore(panel,$('start-panel'));else if(panel.parentNode!==planHome)planHome.insertBefore(panel,planNext?.parentNode===planHome?planNext:null);}
 addEventListener('resize',positionPlan);
 function open(dialogId:string,slotId:string,ids:string[]) {
  const dialog=$(dialogId) as HTMLDialogElement;
  const slots=ids.map(id=>{const node=$(id),parent=node.parentNode!,next=node.nextSibling;$(slotId).append(node);return ()=>parent.insertBefore(node,next?.parentNode===parent?next:null);});
  restore.set(dialogId,()=>{for(const putBack of slots)putBack();});dialog.showModal();
 }
 for(const id of ['plan-sheet','conversation-sheet','meeting-settings'])$(id).addEventListener('close',()=>{restore.get(id)?.();restore.delete(id);positionPlan();});
 $('open-plan').onclick=()=>open('plan-sheet','plan-sheet-content',['agenda-panel']);
 $('open-conversation').onclick=()=>open('conversation-sheet','conversation-sheet-content',['conversation-panel']);
 $('open-settings').onclick=()=>open('meeting-settings','meeting-settings-content',['moderation-control','voice-toggle-label','test-voice','mute','dismiss']);
 return {
  render(m:Meeting){current=m;positionPlan();$('meeting').dataset.view=m.phase==='live'?'live':m.phase==='ended'?'review':'setup';$('meeting-navigation').hidden=!['live','ended'].includes(m.phase);},
  clear(){current=null;for(const id of restore.keys())($(id) as HTMLDialogElement).close();delete $('meeting').dataset.view;}
 };
}
