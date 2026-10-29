import test from 'node:test';
import assert from 'node:assert/strict';
import {moderate} from '../src/muse.js';
import {createMeeting,addFinal} from '../src/core.js';
test('a lost paid-reasoning usage write propagates a persistent-accounting warning',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({usage:{prompt_tokens:30,completion_tokens:30},choices:[{finish_reason:'stop',message:{content:JSON.stringify({intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[]})}}]}),{status:200});};
  try{
    const m=createMeeting({agenda:['Decide'],minutes:30,wrapMinutes:5});addFinal(m,{sessionId:'s',turnId:1,transcript:'We are discussing the decision.'});
    await assert.rejects(moderate({MODEL_API_KEY:'not-a-real-key'},m,{costs:async()=>({total:0,unknown:0}),usage:async()=>{throw new Error('write failure');}}),e=>e.accountingFailure===true);
    assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
