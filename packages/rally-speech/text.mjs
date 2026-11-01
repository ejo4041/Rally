import {readFileSync} from 'node:fs';
import {referenceForWord} from './lexicon.mjs';
const correctionData=JSON.parse(readFileSync(new URL('./corrections.json',import.meta.url),'utf8'));
const terms = {
 AI: ['A I', 'ay eye'], API: ['A P I', 'ay pee eye'], APIs: ['A P I s', 'ay pee eyes'],
 MMS: ['M M S', 'em em ess'], TTS: ['T T S', 'tee tee ess'],
 PDF: ['P D F', 'pee dee eff'], UI: ['U I', 'you eye'],
};
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function pronunciationMap(value = {}) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 50) throw Error('Invalid pronunciation dictionary');
 for (const [word, spoken] of Object.entries(value)) {
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{0,59}$/u.test(word) || typeof spoken !== 'string' || !/^[\p{L}][\p{L} '-]{0,99}$/u.test(spoken)) throw Error('Invalid pronunciation entry');
 }
 return {...value};
}
// One compiled preparer per adapter/configuration; no audio/text cache or network lookup.
export function createSpeechPreparer({adapter='seamless',pronunciations={}}={}) {
 if(!['seamless','mms'].includes(adapter))throw Error('Unknown speech adapter');
 const custom=pronunciationMap(pronunciations);
 const replacements=new Map(Object.entries(custom));
 for(const [key,values]of Object.entries(terms))if(!replacements.has(key))replacements.set(key,values[adapter==='mms'?1:0]);
 for(const [key,value]of [['SeamlessM4T',adapter==='mms'?'Seamless em four tee':'Seamless M four T'],['SeamlessM4T-v2-large',(adapter==='mms'?'Seamless em four tee':'Seamless M four T')+' version two large']])if(!replacements.has(key))replacements.set(key,value);
 for(const item of correctionData.entries){
  for(const word of item.match==='brand-case'?[item.word,item.word.toUpperCase()]:[item.word,item.word[0].toUpperCase()+item.word.slice(1),item.word.toUpperCase()])if(!replacements.has(word))replacements.set(word,item[adapter]);
 }
 const keys=[...replacements.keys()].sort((a,b)=>b.length-a.length);
 const pattern=new RegExp(`(?<![\\p{L}\\p{N}_])(${keys.map(escape).join('|')})(?![\\p{L}\\p{N}_])`,'gu');
 return text=>{
  if(typeof text!=='string')throw Error('Invalid speech text');
  const coverage={words:0,referenced:0,ambiguous:0,unknown:0,corrected:0};
  const pieces=text.split(/(https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g);
  const rendered=pieces.map((part,index)=>{
   if(index%2)return part;
   // Every ordinary word is checked against the preloaded reference. Ambiguous
   // and unknown words retain their spelling; do not guess names or homographs.
   for(const token of part.matchAll(/(?<![\p{L}\p{N}_])[\p{L}][\p{L}\p{N}]*(?:['’][\p{L}]+)*(?![\p{L}\p{N}_])/gu)){
    const ref=referenceForWord(token[0]);coverage.words++;if(ref.known)coverage.referenced++;else coverage.unknown++;if(ref.ambiguous)coverage.ambiguous++;
   }
   return part.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(pattern,word=>{const spoken=replacements.get(word);if(spoken!==word)coverage.corrected++;return spoken;});
  }).join('').trim();
  return {text:rendered,coverage};
 };
}
// Convenience for offline callers. Production adapters compile once themselves.
const defaultPreparers=new Map();
export function spokenText(text,options={}) {
 const pronunciations=pronunciationMap(options.pronunciations);
 if(Object.keys(pronunciations).length)return createSpeechPreparer({...options,pronunciations})(text).text;
 const adapter=options.adapter??'seamless';
 let prepare=defaultPreparers.get(adapter);if(!prepare){prepare=createSpeechPreparer(options);defaultPreparers.set(adapter,prepare);}
 return prepare(text).text;
}
