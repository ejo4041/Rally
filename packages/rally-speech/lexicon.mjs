import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Loaded and verified once at process startup; never fetched during a meeting.
const directory=new URL('./vendor/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('cmudict-manifest.json',directory),'utf8'));
const source=readFileSync(new URL('cmudict.dict',directory));
if(createHash('sha256').update(source).digest('hex')!==manifest.files.find(row=>row.file==='cmudict.dict')?.sha256)throw Error('Pronunciation reference checksum mismatch');
const dictionary=new Map();
for(const line of source.toString('utf8').split('\n')){
 const match=/^([^\s]+)\s+([^#]+?)(?:\s*#.*)?$/.exec(line);
 if(!match)continue;
 const word=match[1].replace(/\(\d+\)$/,'').toLowerCase(), phones=match[2].trim();
 const variants=dictionary.get(word)??[];if(!variants.includes(phones))variants.push(phones);dictionary.set(word,variants);
}
const brand={meta:['M EH1 T AH0']};
const technical={AI:'EY1 AY1',API:'EY1 P IY1 AY1',APIs:'EY1 P IY1 AY1 Z',MMS:'EH1 M EH1 M EH1 S',TTS:'T IY1 T IY1 EH1 S',PDF:'P IY1 D IY1 EH1 F',UI:'Y UW1 AY1',SeamlessM4T:'S IY1 M L AH0 S EH1 M F AO1 R T IY1'};
export const pronunciationReference=Object.freeze({name:'CMU Pronouncing Dictionary',revision:manifest.revision,wordCount:dictionary.size,sha256:manifest.files.find(row=>row.file==='cmudict.dict').sha256});
export function referenceForWord(word) {
 if(typeof word!=='string')throw Error('Expected a word');
 // Meta brand overrides the dictionary's unrelated M IY1 T AH0 entry.
 if(Object.hasOwn(technical,word))return {known:true,phones:[technical[word]],ambiguous:false,source:'Rally technical-term pronunciation'};
 const isBrand=/^(Meta|META)$/.test(word);
 const variants=isBrand?brand.meta:dictionary.get(word.replace(/’/g,"'").toLowerCase());
 return {known:!!variants,phones:variants?[...variants]:[],ambiguous:(variants?.length??0)>1,source:isBrand?'Rally brand pronunciation':variants?'cmudict':'unknown'};
}
