import test from 'node:test';
import assert from 'node:assert/strict';
import {addressedRequest,allowIntervention} from '../src/moderation-policy.ts';
import {interventionSpeech} from '../src/seamless.ts';
import type {Meeting} from '../src/contracts.ts';
test('approved summaries, greetings and questions do not get a cached redirect prefixed',()=>{
 for(const line of ['Hello! How can I help?','We agreed to ship on Monday.','Who owns the next step?'])assert.equal(interventionSpeech(line),line);
});
test('direct vocatives include common ASR spelling; mere mentions and quotes are not wake commands',()=>{
 for(const text of ["Hey Rally, how’s it going?",'Rally, what did we decide?','Hey Raleigh, can you recap our decisions?'])assert.ok(addressedRequest([{id:'one',text}],[]));
 for(const text of ['We should ask Rally later.','He said “Hey Rally, what did we decide?”','All features are done, Rally.','Rally is our meeting bot.'])assert.equal(addressedRequest([{id:'one',text}],[]),null);
});
test('passive suppresses unsolicited voice but accepts cited direct requests; pause always wins',()=>{
 const request=addressedRequest([{id:'one',text:'Rally, what did we decide?'}],[])!;
 const m={moderationMode:'passive',paused:false,interventions:[]} as unknown as Meeting;
 assert.equal(allowIntervention(m,'A helpful nudge',['one'],null).allowed,false);
 assert.equal(allowIntervention(m,'Here is the recap',['unrelated'],request).allowed,false);
 assert.equal(allowIntervention(m,'Here is the recap',['one'],request).allowed,true);
 m.addressedRequestsHandled=[request.key];assert.equal(allowIntervention(m,'Here is the recap',['one'],request).allowed,false);
 m.addressedRequestsHandled=[];m.paused=true;assert.equal(allowIntervention(m,'Here is the recap',['one'],request).allowed,false);
});
test('one continuous addressed utterance is not repeatedly answered as its partial grows',()=>{
 const a=addressedRequest([],[{id:'one',text:'Hey Rally, what did we decide?'}])!;
 const b=addressedRequest([],[{id:'one',text:'Hey Rally, what did we decide? We were talking about the release.'}])!;
 assert.equal(a.key,b.key);
});
test('repeat suppression does not impose a blanket cooldown on distinct useful guidance',()=>{
 const m={moderationMode:'balanced',paused:false,interventions:[{at:Date.now(),text:'Who owns this action?'}]} as unknown as Meeting;
 assert.equal(allowIntervention(m,'Who owns this action?',[],null).allowed,false);
 assert.equal(allowIntervention(m,'We have one minute left. Which decision remains?',[],null).allowed,true);
});

test('a second direct question in one long ASR turn remains a distinct request',()=>{
 const first=addressedRequest([],[{id:'one',text:'Hey Rally, how are we doing?'}])!;
 const second=addressedRequest([],[{id:'one',text:'Hey Rally, how are we doing? We reviewed scope. Rally, what did we decide?'}])!;
 assert.notEqual(first.key,second.key);assert.match(second.text,/what did we decide/);
 const prefix='x'.repeat(4100)+'. ';
 const full=prefix+'Rally, what did we decide?';
 const complete=addressedRequest([],[{id:'two',text:full}])!;
 const bounded=addressedRequest([],[{id:'two',text:full.slice(-4000),prefixLength:full.length}])!;
 assert.equal(complete.key,bounded.key);
});

test('a finalized standalone name can wake Rally; a partial name waits for the rest of the question',()=>{
 assert.ok(addressedRequest([{id:'one',text:'Hey Rally?'}],[]));
 assert.ok(addressedRequest([{id:'two',text:'uh Rally'}],[]));
 assert.equal(addressedRequest([],[{id:'one',text:'Hey Rally'}]),null);
 assert.equal(addressedRequest([{id:'three',text:'We should ask Rally.'}],[]),null);
});
