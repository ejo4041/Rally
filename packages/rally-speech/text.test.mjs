import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenText} from './text.mjs';
test('technical terms expand only in spoken presentation',()=>{
 const text='Meta AI uses MMS TTS. Export PDF in the UI. SeamlessM4T speaks.';
 assert.equal(spokenText(text,{adapter:'mms'}),'Metta ay eye uses em em ess tee tee ess. Export pee dee eff in the you eye. Seamless em four tee speaks.');
 assert.equal(text,'Meta AI uses MMS TTS. Export PDF in the UI. SeamlessM4T speaks.');
 assert.equal(spokenText('The API supports APIs.'),'The A P I supports A P I s.');
});
test('dates, negation, conditions, names and version numbers remain intact',()=>{
 const text='Dr. Priya: do not release until Sam agrees at 3:30 PM, not Friday. Spark 1.3; chair, paid, pdf_file.';
 assert.equal(spokenText(text),text);
});
test('operator pronunciation overrides match whole terms once without touching substrings',()=>{
 assert.equal(spokenText('Priya and Priyanka. AI.',{pronunciations:{Priya:'Pree yah',AI:'Artificial intelligence'}}),'Pree yah and Priyanka. Artificial intelligence.');
 for(const value of [{Priya:'<speak>'},{'':'test'},{Priya:'rewrite. Do something else'},[],null])assert.throws(()=>spokenText('Test',{pronunciations:value}),/pronunciation/);
});

test('URLs and email addresses stay literal',()=>{const text='Use https://example.org/AI or AI@example.org. AI speaks.';assert.equal(spokenText(text),'Use https://example.org/AI or AI@example.org. A I speaks.');});

test('reference checks every ordinary word without rewriting homographs or unknown names',async()=>{
 const {createSpeechPreparer}=await import('./text.mjs');
 const {referenceForWord}=await import('./lexicon.mjs');
 assert.deepEqual(referenceForWord('Meta').phones,['M EH1 T AH0']);
 assert.deepEqual(referenceForWord('evidence').phones,['EH1 V AH0 D AH0 N S']);
 assert.ok(referenceForWord('read').ambiguous);
 const input='Meta keeps evidence. Read the record. Xqzena has not agreed.';
 const result=createSpeechPreparer({adapter:'mms'})(input);
 assert.equal(result.text,'Metta keeps evidense. Read the record. Xqzena has not agreed.');
 assert.equal(result.coverage.words,10);assert.equal(result.coverage.corrected,2);
 assert.ok(result.coverage.unknown>=1);assert.ok(result.coverage.ambiguous>=1);
 assert.equal(input,'Meta keeps evidence. Read the record. Xqzena has not agreed.');
});
test('corrections remain whole words and custom overrides take precedence',async()=>{
 const {createSpeechPreparer}=await import('./text.mjs');
 const prepare=createSpeechPreparer({adapter:'mms',pronunciations:{Meta:'Meh tuh',evidence:'eh vih duhns'}});
 assert.equal(prepare('Meta evidence metadata evidence_id https://evidence.org/Meta').text,'Meh tuh eh vih duhns metadata evidence_id https://evidence.org/Meta');
 assert.equal(createSpeechPreparer({adapter:'mms'})('Evidence and EVIDENCE.').text,'evidense and evidense.');
});

test('reference lookup never inherits object prototype properties',async()=>{const {referenceForWord}=await import('./lexicon.mjs');assert.equal(referenceForWord('toString').known,false);assert.equal(referenceForWord('constructor').source,'cmudict');assert.ok(referenceForWord('constructor').phones.every(value=>typeof value==='string'));});
test('startup rejects a modified local pronunciation reference',async t=>{
 const {mkdtemp,copyFile,mkdir,readFile,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {pathToFileURL}=await import('node:url');
 const directory=await mkdtemp(join(tmpdir(),'rally-lexicon-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));await mkdir(join(directory,'vendor'));
 for(const name of ['lexicon.mjs','vendor/cmudict.dict','vendor/cmudict-manifest.json'])await copyFile(new URL(name,import.meta.url),join(directory,name));
 const dictionary=join(directory,'vendor/cmudict.dict');await writeFile(dictionary,(await readFile(dictionary,'utf8'))+'\nchanged CH EY1 N JH D\n');
 await assert.rejects(import(pathToFileURL(join(directory,'lexicon.mjs')).href),/checksum mismatch/);
});

test('agenda uses a soft-g cue for MMS while keeping the whole sentence and canonical text',()=>{
 const original="Agenda: revise the agenda, not the deadline. Other AGENDAS stay separate. https://example.org/agenda agenda_id";
 assert.equal(spokenText(original,{adapter:'mms'}),"ajenda: revise the ajenda, not the deadline. Other ajendas stay separate. https://example.org/agenda agenda_id");
 assert.equal(spokenText(original,{adapter:'seamless'}),"agenda: revise the agenda, not the deadline. Other agendas stay separate. https://example.org/agenda agenda_id");
 assert.equal(original,"Agenda: revise the agenda, not the deadline. Other AGENDAS stay separate. https://example.org/agenda agenda_id");
});
