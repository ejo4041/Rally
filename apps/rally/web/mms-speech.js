// A small playback boundary: server-approved text, bounded polling, immediate
// local cancel, and generation checks before any delayed audio can start.
globalThis.RallyMMS={
 create({request,audioFactory=url=>new Audio(url),sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
  let serial=0,current=null;
  function cancel(){
   serial++;const previous=current;current=null;
   if(previous){previous.audio?.pause();if(previous.audio){previous.audio.removeAttribute('src');previous.audio.load();}previous.finish?.('canceled');if(previous.id)request('cancel',{id:previous.id}).catch(()=>{});}
  }
  async function speak(input,notify=()=>{}){
   cancel();const generation=serial,job={};current=job;
   const stale=()=>current!==job||generation!==serial;
   try{
    const result=await request('create',input);job.id=result.job.id;
    if(stale()){await request('cancel',{id:job.id}).catch(()=>{});return 'canceled';}
    for(let count=0;count<100;count++){
     const status=await request(`jobs/${job.id}`);
     if(stale())return 'canceled';
     if(status.job.state==='ready'){
      job.audio=audioFactory(`/api/speech/audio/${job.id}`);
      return await new Promise(resolve=>{
       let finished=false;job.finish=state=>{if(finished)return;finished=true;if(!stale())notify(state);if(current===job)current=null;request('cancel',{id:job.id}).catch(()=>{});resolve(state);};
       job.audio.onended=()=>job.finish('completed');job.audio.onerror=()=>job.finish('failed');
       job.audio.onplaying=()=>{if(stale()){job.audio.pause();job.finish('canceled');}else notify('speaking');};
       Promise.resolve(job.audio.play()).catch(()=>job.finish('failed'));
      });
     }
     if(!['queued','generating'].includes(status.job.state))throw new Error('Voice request ended.');
     await sleep(250);
    }
    throw new Error('Voice generation timed out.');
   }catch{
    if(stale())return 'canceled';current=null;if(job.id)request('cancel',{id:job.id}).catch(()=>{});notify('failed');return 'failed';
   }
  }
  return{speak,cancel};
 }
};
