// Presentation-only expansion. Never write spoken spellings into canonical evidence.
const terms = {
 AI: ['A I', 'ay eye'], API: ['A P I', 'ay pee eye'], APIs: ['A P I s', 'ay pee eyes'],
 MMS: ['M M S', 'em em ess'], TTS: ['T T S', 'tee tee ess'],
 PDF: ['P D F', 'pee dee eff'], UI: ['U I', 'you eye'],
};
export function pronunciationMap(value = {}) {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 50) throw Error('Invalid pronunciation dictionary');
 for (const [word, spoken] of Object.entries(value)) {
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{0,59}$/u.test(word) || typeof spoken !== 'string' || !/^[\p{L}][\p{L} '-]{0,99}$/u.test(spoken)) throw Error('Invalid pronunciation entry');
 }
 return {...value};
}
export function spokenText(text, {adapter = 'seamless', pronunciations = {}} = {}) {
 if (typeof text !== 'string') throw Error('Invalid speech text');
 const map = pronunciationMap(pronunciations);
 // Match original tokens once: custom spellings are not recursively expanded.
 const keys = [...Object.keys(map), ...Object.keys(terms), 'SeamlessM4T', 'SeamlessM4T-v2-large'].sort((a,b)=>b.length-a.length);
 const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${keys.map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
 const protectedSpans=[...text.matchAll(/https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)].map(m=>[m.index,m.index+m[0].length]);
 return text.replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(pattern, (word,_group,offset) =>
  protectedSpans.some(([start,end])=>offset>=start&&offset<end)?word:
  map[word] ?? (word.startsWith('SeamlessM4T') ? (adapter === 'mms' ? 'Seamless em four tee' : 'Seamless M four T') + (word.endsWith('-v2-large') ? ' version two large' : '') : terms[word][adapter === 'mms' ? 1 : 0])
 ).trim();
}
