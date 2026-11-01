export function pronunciationMap(value?: unknown): Record<string,string>;
export function spokenText(text: string, options?: {adapter?: 'seamless'|'mms';pronunciations?:Record<string,string>}): string;
