import type {LivingSilk,QualityMode,SilkTuning} from './living-silk';
import {defaultEmotion,type EmotionInput} from './contracts';
export interface ControlsOptions {emotion?:boolean;material?:boolean;quality?:boolean;intervention?:boolean}
/** Optional native controls. No audio permissions or playback UI. */
export function mountLivingSilkControls(host:HTMLElement,silk:LivingSilk,options:ControlsOptions={}){
 const root=document.createElement('div');root.className='living-silk-controls';
 const inputs=new Map<string,{input:HTMLInputElement;output:HTMLOutputElement;kind:'emotion'|'material'}>();
 const cleanup:Array<()=>void>=[];
 function sliders(title:string,keys:string[],kind:'emotion'|'material',max:number){
  const group=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=title;group.append(legend);
  for(const key of keys){const label=document.createElement('label');const name=document.createElement('span');name.textContent=key;const output=document.createElement('output');const input=document.createElement('input');input.type='range';input.min='0';input.max=String(max);input.step='.01';input.setAttribute('aria-label',key);name.append(output);label.append(name,input);group.append(label);inputs.set(key,{input,output,kind});const change=()=>{if(kind==='emotion')silk.setEmotion({[key]:Number(input.value)});else silk.setTuning({[key]:Number(input.value)})};input.addEventListener('input',change);cleanup.push(()=>input.removeEventListener('input',change))}root.append(group);
 }
 if(options.emotion!==false)sliders('Feeling',Object.keys(defaultEmotion),'emotion',1);
 if(options.material!==false)sliders('Material & articulation',['strands','particles','attachment','articulation'],'material',2);
 let select:HTMLSelectElement|undefined;
 if(options.quality!==false){const label=document.createElement('label');const text=document.createElement('span');text.textContent='Rendering quality';select=document.createElement('select');select.setAttribute('aria-label','Rendering quality');for(const [value,title] of [['auto','Auto'],['full','Full quality'],['balanced','Balanced'],['economy','Economy']]){const option=document.createElement('option');option.value=value!;option.textContent=title!;select.append(option)}const change=()=>silk.setQuality(select!.value as QualityMode);select.addEventListener('change',change);cleanup.push(()=>select!.removeEventListener('change',change));label.append(text,select);root.append(label)}
 if(options.intervention!==false){const button=document.createElement('button');button.type='button';button.textContent='Intervene';const click=()=>silk.intervene();button.addEventListener('click',click);cleanup.push(()=>button.removeEventListener('click',click));root.append(button)}
 function refresh(){const emotion=silk.getEmotion(),tuning=silk.getTuning();for(const [key,{input,output,kind}] of inputs){const value=kind==='emotion'?emotion[key as keyof EmotionInput]:tuning[key as keyof SilkTuning];input.value=String(value);output.value=kind==='emotion'?String(Math.round(value*100)):value.toFixed(2)}if(select)select.value=silk.getQuality()}
 let disposed=false;function dispose(){if(disposed)return;disposed=true;silk.removeEventListener('change',refresh);silk.removeEventListener('dispose',dispose);cleanup.forEach(fn=>fn());root.remove()}
 silk.addEventListener('change',refresh);silk.addEventListener('dispose',dispose);host.append(root);refresh();return {element:root,refresh,dispose};
}
