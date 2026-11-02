import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhonemePlanner,phoneSequence} from './phonemes.mjs';

test('actual phones for Meta, evidence and agenda preserve original canonical text and spans',()=>{
 const text='Meta, evidence and agenda.';const plan=createPhonemePlanner()(text);
 assert.equal(plan.supported,true);assert.deepEqual(plan.phones.slice(0,5),['M','EH1','T','AH0','sp']);
 for(const target of ['EH1 V AH0 D AH0 N S','AH0 JH EH1 N D AH0'])assert.ok(plan.phones.join(' ').includes(target));
 assert.equal(plan.canonicalText,text);assert.equal(plan.tokens.map(token=>token.surface).join(''),text);
 for(const token of plan.tokens)assert.equal(text.slice(token.start,token.end),token.surface);
 assert.ok(!plan.phones.includes('Metta')&&!plan.phones.includes('evidense'));
});
test('unresolved names, homographs, digits and addresses never become incomplete spoken claims',()=>{
 for(const text of ['Xqzena agrees.','Read the record.','We meet at 3:30.','Pay $20.','https://example.org','Yes ✅']){
  const plan=createPhonemePlanner()(text);assert.equal(plan.supported,false,text);assert.deepEqual(plan.phones,[]);
 }
 const plan=createPhonemePlanner({overrides:{Read:'R IY1 D',record:'R EH1 K ER0 D',Xqzena:'Z IY1 N AH0'}})('Read the record. Xqzena agrees.');
 assert.equal(plan.supported,true);assert.ok(plan.tokens.some(token=>token.source==='explicit-phones'));
});
test('negation and conditions stay in phone sequence; punctuation remains auditable',()=>{
 const text='Do not ship; only after verification passes.';const plan=createPhonemePlanner()(text);
 assert.equal(plan.supported,true);assert.ok(plan.phones.includes('sp'));
 assert.deepEqual(plan.tokens.filter(token=>token.kind==='word').map(token=>token.surface),['Do','not','ship','only','after','verification','passes']);
});
test('malformed phonemes and unbounded inputs fail rather than reaching a model',()=>{
 for(const value of ['EH','IPA ə','EH9','sp','M <unk>'])assert.throws(()=>phoneSequence(value));
 for(const overrides of [null,[],{Meta:'M EH9 T AH0'},{'bad token':'M'}])assert.throws(()=>createPhonemePlanner({overrides}));
 const plan=createPhonemePlanner();for(const input of ['','x'.repeat(651),'hidden\0'])assert.throws(()=>plan(input));
});
test('initialisms, unresolved contextual dictionary variants and symbolic text fail explicitly',()=>{
 const plan=createPhonemePlanner();
 for(const text of ['US policy.','IT approval.','Please contract the scope.','Polish the content.','example.com','Pay five - two.','five-two']){
  const result=plan(text);assert.equal(result.supported,false,text);assert.deepEqual(result.phones,[]);
 }
 assert.equal(plan('Meta AI supports this meeting.').supported,true);
 assert.equal(createPhonemePlanner({overrides:{US:'Y UW1 EH1 S'}})('US policy.').supported,true);
});
test('sentence plans preserve phone order and explicit pauses without splitting a title',()=>{
 const result=createPhonemePlanner({overrides:{Dr:'D AA1 K T ER0'}})('Dr. Sam agrees. Meta follows the agenda.');
 assert.equal(result.supported,true);assert.equal(result.sentences.length,2);
 assert.equal(result.sentences[0].text,'Dr. Sam agrees.');assert.equal(result.sentences[0].pauseMs,300);assert.equal(result.sentences[1].pauseMs,0);
 assert.deepEqual(result.sentences.flatMap(sentence=>sentence.phones),result.phones);
});
test('repeated pause punctuation has one consistent token, sentence and utterance phone stream',()=>{
 const planner=createPhonemePlanner();
 for(const text of ['Meta,, agenda.','Meta;: agenda.','Meta, , agenda. Meta; agenda.']){
  const result=planner(text);assert.equal(result.supported,true,text);
  assert.deepEqual(result.tokens.flatMap(token=>token.phones??[]),result.phones);
  assert.deepEqual(result.sentences.flatMap(sentence=>sentence.phones),result.phones);
  assert.equal(result.phones.some((phone,index)=>phone==='sp'&&result.phones[index-1]==='sp'),false);
  assert.equal(result.tokens.map(token=>token.surface).join(''),text);
 }
});
test('sentence count matches the worker boundary and refuses the entire overlong plan',()=>{
 const planner=createPhonemePlanner(),accepted=planner('Hi. '.repeat(32).trim());
 assert.equal(accepted.supported,true);assert.equal(accepted.sentences.length,32);
 assert.equal(accepted.sentences.at(-1).pauseMs,0);
 const rejected=planner('Hi. '.repeat(33).trim());
 assert.equal(rejected.supported,false);assert.ok(rejected.issues.some(issue=>issue.reason==='sentence-limit'));
 assert.deepEqual(rejected.phones,[]);assert.deepEqual(rejected.sentences,[]);
});
test('worker-incompatible control whitespace and semantic dashes never reach synthesis',()=>{
 const planner=createPhonemePlanner();
 for(const control of ['\t','\n','\r','\x7f'])assert.throws(()=>planner(`Meta${control}agenda.`),/control characters/);
 assert.equal(planner('Meta  agenda.').supported,true);
 for(const text of ['Monday–Friday.','Pay five – two.','Meta — agenda.','five‐two','five‑two','five−two']){
  const result=planner(text);assert.equal(result.supported,false,text);
  assert.ok(result.issues.some(issue=>issue.reason==='unsupported-text-normalization'));
  assert.deepEqual(result.phones,[]);assert.deepEqual(result.sentences,[]);
 }
});
