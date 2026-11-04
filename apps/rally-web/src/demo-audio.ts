export type DemoClip={file:string;duration:number;text:string};
export type AudioProgress={fraction:number;done:boolean;audible:boolean;failed:boolean;playedMs:number};
// Exactly one media element; its clock drives the simulated transcript. Never
// captures audio, fetches an API, or constructs a URL from user-entered text.
export class DemoAudio {
 private notify:(text:string)=>void;private element:HTMLAudioElement;private clock:()=>number;private generation=0;private paused=false;private notified=false;private allowed=true;
 private positions=new Map<string,number>();private active:{key:string;clip:DemoClip;fraction:number;last:number;began:number;failed:boolean;done:boolean}|null=null;
 constructor(notify:(text:string)=>void=()=>{},element?:HTMLAudioElement,clock=()=>performance.now()){
  this.notify=notify;this.element=element??new Audio();this.element.preload='auto';this.clock=clock;
 }
 get enabled(){return this.allowed;}
 unlock(){
  if(this.active){this.active.failed=false;if(!this.paused&&this.allowed)this.play(this.generation);return;}
  const generation=++this.generation;this.element.src='demo-audio/silence.wav';void this.element.play().then(()=>{if(generation===this.generation&&!this.active)this.element.pause();}).catch(()=>{});
 }
 private play(generation:number){void this.element.play().catch(()=>{if(generation!==this.generation||!this.active||this.paused||!this.allowed)return;this.fail();});}
 private fail(){if(!this.active||this.active.failed)return;this.active.failed=true;this.element.pause();if(!this.notified)this.notify('Demo audio is unavailable or blocked by your browser. The sample continues as text. Enable Demo audio in Settings to try again.');this.notified=true;}
 progress(key:string,clip:DemoClip,from=0):AudioProgress{
  if(this.active?.key!==key){
   this.save();this.element.pause();const generation=++this.generation;
   const fraction=Math.max(0,Math.min(.999,Math.max(from,this.positions.get(key)||0)));
   this.active={key,clip,fraction,last:this.clock(),began:this.clock(),failed:false,done:false};
   this.element.onloadedmetadata=()=>{if(generation===this.generation&&this.active){this.element.currentTime=this.active.fraction*(Number.isFinite(this.element.duration)?this.element.duration:clip.duration);}};
   this.element.onended=()=>{if(generation===this.generation&&this.active){this.active.fraction=1;this.active.done=true;}};
   this.element.onerror=()=>{if(generation===this.generation)this.fail();};
   this.element.src='demo-audio/'+clip.file;this.element.load();if(this.allowed&&!this.paused)this.play(generation);
  }
  const a=this.active!,now=this.clock(),elapsed=Math.max(0,now-a.last);a.last=now;
  if(!this.paused){
   if(!this.allowed||a.failed)a.fraction=Math.min(1,a.fraction+elapsed/(clip.duration*1000));
   else if(this.element.currentTime>0)a.fraction=Math.max(a.fraction,Math.min(1,this.element.currentTime/(Number.isFinite(this.element.duration)&&this.element.duration>0?this.element.duration:clip.duration)));
   if(this.allowed&&!a.failed&&this.element.currentTime===0&&now-a.began>8000)this.fail();
  }
  a.done=a.done||a.fraction>=1;
  return {fraction:a.fraction,done:a.done,audible:this.allowed&&!this.paused&&!a.failed&&!this.element.paused&&!a.done,failed:a.failed,playedMs:a.fraction*clip.duration*1000};
 }
 private save(){if(this.active){if(this.allowed&&!this.active.failed&&this.element.currentTime>0)this.active.fraction=Math.max(this.active.fraction,Math.min(1,this.element.currentTime/(Number.isFinite(this.element.duration)&&this.element.duration>0?this.element.duration:this.active.clip.duration)));this.positions.set(this.active.key,this.active.fraction);}}
 pause(){this.paused=true;this.element.pause();if(this.active)this.active.last=this.clock();}
 resume(){if(!this.paused)return;this.paused=false;if(this.active){this.active.last=this.clock();this.active.began=this.clock();if(this.allowed&&!this.active.failed&&!this.active.done)this.play(this.generation);}}
 setEnabled(enabled:boolean){this.allowed=enabled;if(this.active){this.active.last=this.clock();if(enabled){const retry=this.active.failed;this.active.failed=false;this.active.began=this.clock();this.notified=false;if(retry)this.element.load();try{this.element.currentTime=this.active.fraction*this.active.clip.duration;}catch{}if(!this.paused)this.play(this.generation);}else this.element.pause();}}
 stop(){this.save();this.generation++;this.active=null;this.element.onended=null;this.element.onerror=null;this.element.onloadedmetadata=null;this.element.pause();this.element.removeAttribute('src');this.element.load();}
 dispose(){this.stop();this.positions.clear();}
}
