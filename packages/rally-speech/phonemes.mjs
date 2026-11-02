import {referenceForWord,pronunciationReference} from './lexicon.mjs';
import {readFileSync} from 'node:fs';
const reviewedVariants=new Set(JSON.parse(readFileSync(new URL('./pronunciation-variants.json',import.meta.url),'utf8')).words);

// These words have meaning-dependent pronunciations. Do not select a dictionary
// entry silently. The caller must supply an explicitly reviewed phone override.
const contextual=new Set(['read','reads','reading','record','records','project','projects','live','lives','lead','leads','wind','winds','close','closes','minute','minutes','present','presents','object','objects','produce','use','uses','tear','tears','bow','bows','bass','does','resume','resumes']);
const consonants=new Set('B CH D DH F G HH JH K L M N NG P R S SH T TH V W Y Z ZH'.split(' '));
const vowels=new Set('AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW'.split(' '));
export function phoneSequence(value) {
 if(typeof value!=='string'||!value.trim()||value.length>250)throw Error('Invalid ARPABET pronunciation');
 const phones=value.trim().split(/\s+/);
 if(phones.some(phone=>!consonants.has(phone)&&!(vowels.has(phone.slice(0,-1))&&/^[A-Z]{2}[012]$/.test(phone))))throw Error('Invalid ARPABET phone or vowel stress');
 return phones;
}

// A deterministic dictionary-based grapheme-to-phoneme front end. It does not
// invent unknown-name pronunciation or send phones to grapheme-trained models.
export function createPhonemePlanner({overrides={}}={}) {
 if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>50)throw Error('Invalid phoneme overrides');
 const explicit=new Map();
 for(const [word,value]of Object.entries(overrides)) {
  if(!/^[\p{L}][\p{L}'’]{0,59}$/u.test(word))throw Error('Invalid phoneme override word');
  explicit.set(word,phoneSequence(value));
 }
 return text=>{
  if(typeof text!=='string'||!text.trim()||text.length>650||/[\x00-\x1f\x7f]/.test(text))throw Error('Use 1–650 characters of speech text without control characters');
  const tokens=[],issues=[],phones=[];
  // Every input character belongs to a token; unsupported characters are never
  // silently dropped, which would be dangerous for times, amounts or conditions.
  const pattern=/[\p{L}]+(?:['’][\p{L}]+)*|\s+|[^\s\p{L}]/gu;
  for(const match of text.matchAll(pattern)) {
   const surface=match[0],base={surface,start:match.index,end:match.index+surface.length};
   if(/^\s+$/.test(surface)){tokens.push({...base,kind:'space'});continue;}
   if(/^[\p{L}]/u.test(surface)) {
    const ref=referenceForWord(surface),override=explicit.get(surface);
    let selected,source;
    if(override){selected=[...override];source='explicit-phones';}
    else if(/^[A-Z]{2,}$/.test(surface)&&!ref.source.startsWith('Rally ')){issues.push({...base,reason:'unresolved-capitalized-initialism'});source='unresolved';}
    else if(ref.ambiguous&&(contextual.has(surface.toLowerCase())||!reviewedVariants.has(surface.toLowerCase()))){issues.push({...base,reason:'context-dependent-pronunciation'});source='unresolved';}
    else if(ref.known){selected=phoneSequence(ref.phones[0]);source=ref.source;}
    else {issues.push({...base,reason:'unknown-word'});source='unresolved';}
    tokens.push({...base,kind:'word',phones:selected??[],source,variants:ref.phones,variantPolicy:override?'explicit':ref.ambiguous?'first-dictionary-variant':'single'});
    if(selected)phones.push(...selected);
   } else if(/^[,;:]$/.test(surface)){
    const pause=phones.at(-1)==='sp'?[]:['sp'];
    tokens.push({...base,kind:'punctuation',phones:pause});phones.push(...pause);
   } else if(/^[.!?()"“”'‘’]$/.test(surface))tokens.push({...base,kind:'punctuation',phones:[]});
   else {tokens.push({...base,kind:'unsupported'});issues.push({...base,reason:'unsupported-text-normalization'});}
  }
  if(!phones.some(phone=>phone!=='sp'))issues.push({reason:'no-pronounceable-words'});
  if(phones.length>300)issues.push({reason:'phone-limit'});
  if(/https?:\/\/|[\w.+-]+@[\w.-]+/.test(text))issues.push({reason:'unsupported-address'});
  if(/[\p{L}]\.[\p{L}]/u.test(text))issues.push({reason:'unsupported-dotted-text'});
  const sentences=[];let pending=[],start=0;
  for(const token of tokens){
   if(token.phones)pending.push(...token.phones);
   const prefix=text.slice(start,token.start);
   const abbreviation=/\b(?:Dr|Mr|Mrs|Ms|Prof|[A-Z])$/u.test(prefix);
   if(/[.!?]/.test(token.surface)&&token.kind==='punctuation'&&!abbreviation&&pending.length){
    sentences.push({text:text.slice(start,token.end).trim(),phones:pending,pauseMs:300});pending=[];start=token.end;
   }
  }
  if(pending.length)sentences.push({text:text.slice(start).trim(),phones:pending,pauseMs:0});
  if(sentences.length)sentences.at(-1).pauseMs=0;
  if(sentences.length>32)issues.push({reason:'sentence-limit'});
  return {version:1,canonicalText:text,inputKind:'arpabet',reference:pronunciationReference,supported:issues.length===0,phones:issues.length?[]:phones,sentences:issues.length?[]:sentences,tokens,issues,policy:'dictionary-first with explicit ambiguity and unknown-word rejection; no neural G2P fallback'};
 };
}
