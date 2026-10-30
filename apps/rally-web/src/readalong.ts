// Word timing is an approximation driven by playback, never by downloaded bytes.
export class ReadAlong {
 private id:string|null=null;
 private text='';
 private words=0;
 private elapsed=0;
 private eligible=false;
 private terminal=false;
 private measured=false;
 prepare(id:string,text:string) {
  if(id===this.id)return;
  this.id=id;this.text=text;this.words=0;this.elapsed=0;
  this.eligible=true;this.terminal=false;this.measured=false;
 }
 restore(id:string,text:string) {
  if(id===this.id)return;
  this.prepare(id,text);this.eligible=false;
 }
 clock(id:string,playedMs:number,running:boolean) {
  if(id!==this.id||!this.eligible||this.terminal||!running||!Number.isFinite(playedMs)||playedMs<0)return;
  this.measured=true;this.elapsed=Math.max(this.elapsed,playedMs);
  const count=this.text.trim().split(/\s+/).length;
  this.words=Math.min(count,Math.floor(this.elapsed/400));
 }
 finish(id:string,state:string) {
  if(id!==this.id)return;
  this.terminal=true;
  if(state==='completed')this.words=this.text.trim().split(/\s+/).length;
 }
 clear(){this.id=null;this.text='';this.words=0;this.eligible=false;this.terminal=false;this.measured=false;}
 view(){return {id:this.id,text:this.text,spokenWords:this.words,animated:this.eligible&&this.measured,terminal:this.terminal};}
}
