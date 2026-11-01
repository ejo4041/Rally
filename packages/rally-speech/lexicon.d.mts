export const pronunciationReference: Readonly<{name:string;revision:string;wordCount:number;sha256:string}>;
export function referenceForWord(word:string): {known:boolean;phones:string[];ambiguous:boolean;source:string};
