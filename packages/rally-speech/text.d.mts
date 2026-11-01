export type SpeechOptions={adapter?:'seamless'|'mms';pronunciations?:Record<string,string>};
export type SpeechPreparation={text:string;coverage:{words:number;referenced:number;ambiguous:number;unknown:number;corrected:number}};
export function pronunciationMap(value?:unknown):Record<string,string>;
export function createSpeechPreparer(options?:SpeechOptions):(text:string)=>SpeechPreparation;
export function spokenText(text:string,options?:SpeechOptions):string;
