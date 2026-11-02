export const MODEL:string;
export const REVISION:string;
export class PhonemeSpeech {
 constructor(options:{python:string;modelDirectory:string;worker?:string;phoneOverrides?:Record<string,string>;startTimeoutMs?:number;synthesisTimeoutMs?:number});
 readonly identity:{model:string;revision:string;sampleRate:16000};
 start():Promise<unknown>;
 isReady():boolean;
 synthesize(text:string,options?:{signal?:AbortSignal}):Promise<{pcm:Buffer;wav:Buffer;sampleRate:number;seconds:number;model:string;revision:string;synthesisMs:number}>;
 close():void;
}
