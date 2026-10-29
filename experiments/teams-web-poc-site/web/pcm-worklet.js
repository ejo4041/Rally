/* Stateful low-pass FIR + fractional resampling, mono PCM16 at 16 kHz. */
class RallyPCM extends AudioWorkletProcessor {
  constructor(){
    super();this.target=16000;this.step=sampleRate/this.target;this.frame=new Int16Array(1280);this.used=0;this.count=0;this.next=0;this.last=0;this.gate=false;
    this.n=63;this.history=new Float32Array(this.n);this.pos=0;this.taps=new Float32Array(this.n);
    const fc=Math.min(.45,7000/sampleRate);let sum=0;
    for(let i=0;i<this.n;i++){const x=i-(this.n-1)/2;const sinc=x===0?2*fc:Math.sin(2*Math.PI*fc*x)/(Math.PI*x);const win=.5-.5*Math.cos(2*Math.PI*i/(this.n-1));this.taps[i]=sinc*win;sum+=this.taps[i];}
    for(let i=0;i<this.n;i++)this.taps[i]/=sum;
    this.port.onmessage=e=>{if(e.data?.type==='gate')this.gate=!!e.data.value;};
  }
  process(inputs){
    const channels=inputs[0];if(!channels?.length)return true;
    const frames=channels[0].length;let power=0;
    for(let i=0;i<frames;i++){
      let v=0;for(const c of channels)v+=c[i]||0;v/=channels.length;power+=v*v;
      this.history[this.pos]=v;let filtered=0;
      if(sampleRate>this.target){for(let j=0;j<this.n;j++)filtered+=this.taps[j]*this.history[(this.pos-j+this.n)%this.n];}else filtered=v;
      this.pos=(this.pos+1)%this.n;
      while(this.next<=this.count){
        const fraction=Math.max(0,Math.min(1,this.next-(this.count-1)));
        const s=this.gate?0:this.last+(filtered-this.last)*fraction;
        this.frame[this.used++]=Math.round(Math.max(-1,Math.min(1,s))*(s<0?32768:32767));
        if(this.used===this.frame.length){const out=this.frame;this.port.postMessage({type:'pcm',buffer:out.buffer},[out.buffer]);this.frame=new Int16Array(1280);this.used=0;}
        this.next+=this.step;
      }
      this.last=filtered;this.count++;
    }
    if(this.count%(Math.max(1,Math.round(sampleRate/frames/8))*frames)<frames)this.port.postMessage({type:'level',value:Math.sqrt(power/frames)});
    return true;
  }
}
registerProcessor('rally-pcm',RallyPCM);
