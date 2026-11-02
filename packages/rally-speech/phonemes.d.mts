export function phoneSequence(value:string):string[];
export function createPhonemePlanner(options?:{overrides?:Record<string,string>}):(text:string)=>{
 version:number;canonicalText:string;inputKind:string;reference:unknown;supported:boolean;phones:string[];sentences:{text:string;phones:string[];pauseMs:number}[];tokens:unknown[];issues:{reason:string;surface?:string;start?:number;end?:number}[];policy:string;
};
