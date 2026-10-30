// Clock for PCM observed at the isolated local output sink, not synthesis arrival.
export class PlayoutClock {
 private started=false;
 private bytes=0;
 private carry=Buffer.alloc(0);
 observe(chunk:Buffer):number|undefined {
  const data=Buffer.concat([this.carry,chunk]);
  const aligned=data.length-data.length%2;
  const pcm=data.subarray(0,aligned);this.carry=Buffer.from(data.subarray(aligned));
  if(!this.started){
   for(let i=0;i+1<pcm.length;i+=2)if(Math.abs(pcm.readInt16LE(i))>32){this.started=true;this.bytes=pcm.length-i;break;}
  }else this.bytes+=pcm.length;
  return this.started?this.bytes/32:undefined;
 }
}
