import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenText} from './text.mjs';
test('technical terms expand only in spoken presentation',()=>{
 const text='Meta AI uses MMS TTS. Export PDF in the UI. SeamlessM4T speaks.';
 assert.equal(spokenText(text,{adapter:'mms'}),'Meta ay eye uses em em ess tee tee ess. Export pee dee eff in the you eye. Seamless em four tee speaks.');
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
