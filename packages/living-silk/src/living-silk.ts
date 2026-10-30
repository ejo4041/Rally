import * as THREE from 'three';
import {HarmonicDriver} from './driver';
import {AdaptiveQualityController,deriveQuality,type QualityTier} from './quality';
import {defaultEmotion,defaultTuning,type EmotionInput,type HarmonicTuning,type BotVoiceFrame} from './contracts';
import {createSurfaceUniforms,updateSurfaceUniforms,surfaceGLSL,vertexShader,fragmentShader} from './surface';
import {createSilkMotes,silkMotesVertexShader,silkMotesFragmentShader} from './silkMotesShader';
import {BotAudioInput} from './bot-audio';
export type QualityMode='auto'|QualityTier;
export type SilkTuning=Pick<HarmonicTuning,'strands'|'particles'|'attachment'|'articulation'>;
export interface SilkMetrics {fps:number;cpuSubmissionMs:number;drawCalls:number;triangles:number;motes:number;pixelRatio:number;quality:QualityTier;width:number;height:number}
export interface LivingSilkOptions {
 antialias?:boolean;pixelRatioCap?:number;initialQuality?:QualityTier;
 emotion?:Partial<EmotionInput>;tuning?:Partial<SilkTuning>;quality?:QualityMode;sensitivity?:number;
 background?:'atmosphere'|'transparent';visibility?:'auto'|'always';onMetrics?:(metrics:Readonly<SilkMetrics>)=>void;onError?:(error:Error)=>void;
}
function unit(value:number,max=1){return Number.isFinite(value)?Math.max(0,Math.min(max,value)):0}
const qualities:QualityMode[]=['auto','full','balanced','economy'];
export class LivingSilk extends EventTarget {
 readonly canvas:HTMLCanvasElement;
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(45,1,.1,100);
 private group=new THREE.Group();
 private surface:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
 private motes:THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;
 private driver:HarmonicDriver;
 private adaptive=new AdaptiveQualityController();
 private audio=new BotAudioInput();
 private emotion:EmotionInput;
 private tuning:HarmonicTuning;
 private qualityMode:QualityMode;
 private sensitivity:number;
 private resizeObserver:ResizeObserver;
 private intersectionObserver:IntersectionObserver;
 private intersecting=true;private paused=false;private disposed=false;private contextLost=false;
 private raf=0;private last=0;private width=0;private height=0;private geometryKey='';private dpr=0;
 private metricFrames=0;private metricSeconds=0;private metricCpu=0;private metrics:SilkMetrics|null=null;
 private lastBackground=0;
 private visibility=()=>this.synchronize();
 private lost=(event:Event)=>{event.preventDefault();this.contextLost=true;this.synchronize();this.options.onError?.(Error('Living Silk graphics context was lost'))};
 private restored=()=>{this.contextLost=false;this.dpr=0;this.adaptive.reset(performance.now());this.synchronize()};
 constructor(private host:HTMLElement,private options:LivingSilkOptions={}){
  super();
  if(!host||host.ownerDocument!==document)throw TypeError('Expected a container in the current document');
  this.emotion={...defaultEmotion,joy:.45,curiosity:.2,confidence:.65,...options.emotion};
  for(const key of Object.keys(this.emotion) as (keyof EmotionInput)[])this.emotion[key]=unit(this.emotion[key]);
  this.tuning={...defaultTuning};this.applyTuning(options.tuning??{});
  this.qualityMode=options.quality??'auto';if(!qualities.includes(this.qualityMode))throw TypeError('Unknown rendering quality');
  this.sensitivity=options.sensitivity??2;
  this.driver=new HarmonicDriver(this.emotion);
  this.adaptive=new AdaptiveQualityController(options.initialQuality);
  this.canvas=document.createElement('canvas');this.canvas.className='living-silk-canvas';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label','Animated meeting presence');
  this.canvas.style.cssText='display:block;width:100%;height:100%;';
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,alpha:true,antialias:options.antialias??true,depth:false,stencil:false,powerPreference:'default'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
  this.camera.position.set(0,0,6);
  this.group.rotation.set(.06,-.12,-.04);this.scene.add(this.group);
  const material=new THREE.ShaderMaterial({uniforms:createSurfaceUniforms(),vertexShader,fragmentShader,transparent:true,premultipliedAlpha:true,forceSinglePass:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  this.surface=new THREE.Mesh(new THREE.PlaneGeometry(1,1,128,24),material);this.surface.frustumCulled=false;this.surface.renderOrder=2;
  const moteMaterial=new THREE.ShaderMaterial({uniforms:{...createSurfaceUniforms(),uMoteAmount:{value:1}},vertexShader:silkMotesVertexShader(surfaceGLSL),fragmentShader:silkMotesFragmentShader,transparent:true,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false});
  this.motes=new THREE.Points(createSilkMotes(),moteMaterial);this.motes.frustumCulled=false;this.motes.renderOrder=3;
  this.group.add(this.surface,this.motes);host.append(this.canvas);
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
  this.intersectionObserver=new IntersectionObserver(([entry])=>{this.intersecting=entry?.isIntersecting??false;this.synchronize()});this.intersectionObserver.observe(host);
  document.addEventListener('visibilitychange',this.visibility);this.canvas.addEventListener('webglcontextlost',this.lost);this.canvas.addEventListener('webglcontextrestored',this.restored);
  this.resize();
 }
 private alive(){if(this.disposed)throw Error('Living Silk is disposed')}
 private applyTuning(values:Partial<SilkTuning>){for(const key of ['strands','particles','attachment','articulation'] as const)if(values[key]!==undefined)this.tuning[key]=unit(values[key],2)}
 setEmotion(values:Partial<EmotionInput>){this.alive();for(const key of Object.keys(defaultEmotion) as (keyof EmotionInput)[])if(values[key]!==undefined)this.emotion[key]=unit(values[key]);this.driver.setEmotion(this.emotion);this.dispatchEvent(new Event('change'))}
 setTrajectory(source: ((timestampSeconds:number)=>EmotionInput)|null){this.alive();this.driver.setTrajectory(source)}
 getEmotion():Readonly<EmotionInput>{return {...this.emotion}}
 setTuning(values:Partial<SilkTuning>){this.alive();this.applyTuning(values);this.dispatchEvent(new Event('change'))}
 getTuning():Readonly<SilkTuning>{const {strands,particles,attachment,articulation}=this.tuning;return {strands,particles,attachment,articulation}}
 setQuality(mode:QualityMode){this.alive();if(!qualities.includes(mode))throw TypeError('Unknown rendering quality');this.qualityMode=mode;this.adaptive.reset(performance.now());this.dispatchEvent(new Event('change'))}
 getQuality(){return this.qualityMode}
 setSensitivity(value:number){this.alive();if(!Number.isFinite(value)||value<=0)throw TypeError('Sensitivity must be positive');this.sensitivity=value}
 /** External feature timestamps use performance.now()/1000, not wall-clock time. */
 setVoice(frame:BotVoiceFrame){this.alive();this.audio.disconnect();this.driver.setVoice(frame)}
 enableAudio(){this.alive();return this.audio.enable()}
 async connectBotTrack(track:MediaStreamTrack){this.alive();this.driver.setVoice(this.audio.disconnect());await this.audio.connect(track)}
 disconnectBotAudio(){this.alive();this.driver.setVoice(this.audio.disconnect())}
 intervene(){this.alive();this.driver.intervene()}
 pause(){this.alive();this.paused=true;this.synchronize()}
 resume(){this.alive();this.paused=false;this.synchronize()}
 getMetrics():Readonly<SilkMetrics>|null{return this.metrics?{...this.metrics}:null}
 private resize(){if(this.disposed)return;this.width=this.host.clientWidth;this.height=this.host.clientHeight;this.camera.aspect=this.width/Math.max(1,this.height);this.camera.updateProjectionMatrix();this.dpr=0;this.adaptive.reset(performance.now());this.synchronize()}
 private synchronize(){cancelAnimationFrame(this.raf);this.raf=0;this.last=0;if(!this.disposed&&!this.paused&&!this.contextLost&&(this.options.visibility==='always'||(this.intersecting&&document.visibilityState==='visible'))&&this.width>0&&this.height>0){this.adaptive.reset(performance.now());this.raf=requestAnimationFrame(this.render)}}
 private render=(now:number)=>{
  if(this.disposed)return;
  try{
   const dt=this.last?Math.max(0,(now-this.last)/1000):1/60;this.last=now;
   if(this.audio.connected)this.driver.setVoice(this.audio.sample(now/1000,this.sensitivity));
   this.driver.advance(now/1000);
   const quality=deriveQuality(this.qualityMode==='auto'?this.adaptive.tier:this.qualityMode,this.height,window.devicePixelRatio||1);
   quality.dpr=Math.min(quality.dpr,Math.max(.5,this.options.pixelRatioCap??2));
   const key=`${quality.segmentsX}:${quality.segmentsY}`;
   if(key!==this.geometryKey){const old=this.surface.geometry;this.surface.geometry=new THREE.PlaneGeometry(1,1,quality.segmentsX,quality.segmentsY);old.dispose();this.geometryKey=key}
   if(this.dpr!==quality.dpr){this.renderer.setPixelRatio(quality.dpr);this.renderer.setSize(this.width,this.height,false);this.dpr=quality.dpr}
   this.group.scale.setScalar(1.65*Math.min(1,this.width/this.height/(16/9)));
   for(const material of [this.surface.material,this.motes.material]){updateSurfaceUniforms(material.uniforms,this.driver.frame,this.tuning);material.uniforms.uViewport!.value.set(this.canvas.width,this.canvas.height)}
   this.motes.geometry.setDrawRange(0,this.height<120?80:this.height<240?140:160);this.motes.material.uniforms.uMoteAmount!.value=this.tuning.particles;
   if(now-this.lastBackground>100){this.background();this.lastBackground=now}
   const start=performance.now();this.renderer.render(this.scene,this.camera);const submit=performance.now()-start;
   if(this.qualityMode==='auto')this.adaptive.sample({now,frameMs:dt*1000,renderMs:submit});
   if(dt<.25){this.metricFrames++;this.metricSeconds+=dt;this.metricCpu+=submit}
   if(this.metricSeconds>=1){this.metrics={fps:Math.round(this.metricFrames/this.metricSeconds),cpuSubmissionMs:this.metricCpu/this.metricFrames,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,motes:this.renderer.info.render.points,pixelRatio:quality.dpr,quality:quality.tier,width:this.canvas.width,height:this.canvas.height};this.metricFrames=0;this.metricSeconds=0;this.metricCpu=0;this.options.onMetrics?.({...this.metrics})}
   if(!this.disposed&&!this.paused)this.raf=requestAnimationFrame(this.render);
  }catch(error){if(!this.disposed)this.pause();this.options.onError?.(error instanceof Error?error:Error(String(error)))}
 };
 private background(){if(this.options.background==='transparent')return;const e=this.driver.frame.emotion;let rgb=[24,56,45];const mix=(target:number[],weight:number)=>{rgb=rgb.map((v,i)=>v+(target[i]!-v)*weight*e.expressiveness)};mix([15,45,63],e.curiosity*.75);mix([32,26,54],e.sadness*.8);mix([68,44,17],e.worry*.85);mix([67,22,30],e.irritation*.9);this.canvas.style.background=`radial-gradient(ellipse at center,rgb(${rgb.map(Math.round).join(',')}),#10171b 85%)`}
 async dispose(){if(this.disposed)return;this.disposed=true;this.dispatchEvent(new Event('dispose'));cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.intersectionObserver.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.canvas.removeEventListener('webglcontextlost',this.lost);this.canvas.removeEventListener('webglcontextrestored',this.restored);this.surface.geometry.dispose();this.surface.material.dispose();this.motes.geometry.dispose();this.motes.material.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove();await this.audio.dispose()}
}
export function createLivingSilk(host:HTMLElement,options?:LivingSilkOptions){return new LivingSilk(host,options)}
