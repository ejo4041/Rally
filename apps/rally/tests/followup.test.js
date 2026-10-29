import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeeting,addFinal,applyDecision,confirmOutcome} from '../src/core.js';
import {confirmedFollowup} from '../src/followup.js';
function fixture(){
 const m=createMeeting({title:'Release',agenda:['Release'],participants:['Priya'],minutes:3,wrapMinutes:.5,captureMode:'meeting-tab',platform:'whatsapp',includeMicrophone:true});addFinal(m,{sessionId:'s',turnId:1,transcript:'Priya will check rollback by Thursday.'});
 applyDecision(m,{intervene:false,kind:'none',spoken_text:'',evidence_turn_ids:[],outcomes:[{type:'action',text:'Check rollback.',owner:'Priya',due_date:'Thursday',evidence_turn_ids:['s:1']}]});return m;
}
test('platform capture settings are validated and preserve room defaults',()=>{
 assert.equal(fixture().capture.platform,'whatsapp');assert.equal(fixture().capture.includeMicrophone,true);
 const base={agenda:['Release'],minutes:3,wrapMinutes:.5};assert.equal(createMeeting(base).capture.mode,'microphone');
 for(const platform of['zoom','meet','jitsi','whatsapp','other'])assert.equal(createMeeting({...base,captureMode:'meeting-tab',platform}).capture.platform,platform);
 assert.throws(()=>createMeeting({...base,captureMode:'system-audio'}),/audio source/);assert.throws(()=>createMeeting({...base,captureMode:'meeting-tab',platform:'untrusted'}),/audio source/);
});
test('follow-up drafts include only explicit confirmed current evidence and omit the transcript',()=>{
 const m=fixture();assert.throws(()=>confirmedFollowup(m),/End the meeting/);m.phase='ended';assert.throws(()=>confirmedFollowup(m),/Confirm at least/);
 confirmOutcome(m,m.outcomes[0].id);const draft=confirmedFollowup(m);assert.equal(draft.confirmedCount,1);assert.match(draft.text,/Priya, due Thursday/);assert.ok(!draft.text.includes('Priya will check rollback by Thursday.'));
 m.outcomes.push({...m.outcomes[0],id:'proposed',status:'proposed',text:'Unconfirmed secret'});assert.ok(!confirmedFollowup(m).text.includes('Unconfirmed secret'));
 m.turns[0].echoRisk=true;assert.throws(()=>confirmedFollowup(m),/Confirm at least/);
});
test('scripted walkthroughs remain labeled and tab settings do not create platform bots',()=>{
 const m=createMeeting({agenda:['Release'],minutes:3,wrapMinutes:.5,kind:'walkthrough',captureMode:'meeting-tab',platform:'zoom'});assert.equal(m.kind,'walkthrough');assert.equal(m.capture.mode,'microphone');assert.equal(m.capture.platform,'room');
});
