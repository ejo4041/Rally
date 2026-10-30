import * as THREE from 'three';
import type {HarmonicFrame,HarmonicTuning} from './contracts';
import {silkDeformGLSL,silkMaterialGLSL} from './livingSilkShader';
type SurfaceUniforms=Record<string,THREE.IUniform>;
const shaderPreamble = /* glsl */ `
uniform float uTime, uPhase, uExpressiveness;
uniform vec4 uEmotionA, uEmotionB, uPoseC, uTuning;
uniform vec2 uVoice, uViewport;
uniform float uHistory[224];
const float PI = 3.14159265359;
float historyAt(float delay, int channel) {
  float position = clamp(1. - delay / .6, 0., 1.) * 31.;
  int index = int(floor(position));
  int nextIndex = min(index + 1, 31);
  return mix(uHistory[index * 7 + channel], uHistory[nextIndex * 7 + channel], fract(position));
}
float bounded(float value, float limit) { return value / sqrt(1. + value * value / (limit * limit)); }
${silkDeformGLSL}
`;

export const surfaceGLSL = /* glsl */ `
${shaderPreamble}
vec3 finishSurface(vec3 p) {
  p.y = bounded(p.y, 1.35);
  p.z = bounded(p.z, .90);
  p.y += .025 * sin(uTime * .42);
  return p;
}
vec3 harmonicSurface(vec2 coordinate) {
  float u = clamp(coordinate.x, .00001, .99999);
  float s = coordinate.y * 2. - 1.;
  float x = (u - .5) * 3.7;
  float envelope = pow(max(sin(u * PI), 0.), .62);
  float joy = uEmotionA.x * uExpressiveness;
  float curiosity = uEmotionA.y * uExpressiveness;
  float worry = uEmotionA.z * uExpressiveness;
  float irritation = uEmotionA.w * uExpressiveness;
  float sadness = uEmotionB.x * uExpressiveness;
  float confidence = uEmotionB.y * uExpressiveness;
  float energy = uEmotionB.z;
  float sass = uEmotionB.w * uExpressiveness;
  float movement = uPhase;
  float happyWeight = (.25 + joy) / (1. + joy + irritation * 1.5 + worry * .5);
  float annoyedWeight = irritation / (.4 + irritation + joy);
  float flourish = sin(movement * .82);
  float hold = smoothstep(-.5, .55, sin(movement * .58));
  float counterturn = sin(movement * .58 - .8) * (.35 + hold * .65);
  float happySass = sass * happyWeight;
  float annoyedSass = sass * annoyedWeight;
  float cautious = sin(movement * .7) * (.35 + .65 * smoothstep(-.4, .8, sin(movement * .37)));
  float openness = 1. + joy * .35 + confidence * .11 - worry * .26 - sadness * .20 - irritation * .12;
  openness += happySass * .23 * flourish - annoyedSass * .12 * hold;
  float width = (.12 + .74 * envelope) * openness;
  float twist = x * (.98 + curiosity * .21) + .38 * sin(x * 1.5 - movement * .35);
  twist += curiosity * .60 * sin(movement * .38 + x * .65);
  twist += worry * .34 * sin(x * 1.9) + irritation * .23 * sin(x * 2.6 - movement * .62);
  twist += happySass * .55 * sin(movement * .82 - .3) + annoyedSass * .32 * counterturn;
  float arch = (.14 + joy * .41 - sadness * .47) * envelope;
  arch += sin(x * 1.4 - movement * .28) * (.11 + energy * .09);
  arch += worry * .27 * (cos(x * 2.4) - .35) * envelope;
  arch += irritation * .25 * x + curiosity * .33 * x * (.65 + .35 * sin(movement * .43));
  arch += worry * .11 * cautious * x;
  arch += happySass * (.27 * flourish + .22 * x * sin(movement * .82 - .5));
  arch += annoyedSass * (.27 * x * hold - .16 * counterturn);
  arch -= sadness * .15 * (1. - envelope);
  arch += uPoseC.z * .23 * sin(x * 1.5 + movement * .3);
  float delay = (.5 - .5 * sin(x * 1.15 + .35)) * .43;
  float level = historyAt(delay, 0);
  float phrase = historyAt(delay * .65, 1);
  float low = historyAt(delay, 2);
  float lowMid = historyAt(delay * .78, 3);
  float mid = historyAt(delay * .65, 4);
  float highMid = historyAt(delay * .48, 5);
  float high = historyAt(delay * .38, 6);
  float articulation = uTuning.w;
  float broadVoice = (level * .22 + phrase * .17 + low * .13) * sin(x * 2.35 - uTime * 3.1 + s * .35);
  float middleVoice = lowMid * .13 * sin(x * 4.6 - uTime * 4.8 + .7) + mid * .085 * sin(x * 7.4 - uTime * 6.3 - s * .4);
  float tightVoice = highMid * .045 * sin(x * 11.3 - uTime * 8.1 + s) + high * .017 * sin(x * 16.4 - uTime * 9.3 + s * 1.3);
  float speech = (broadVoice + middleVoice + tightVoice) * articulation;
  speech *= .20;
  width *= 1. + (uVoice.y * .11 + low * .08) * articulation;
  float fold = s * width;
  vec3 p = vec3(x, arch + fold * cos(twist), fold * sin(twist));
  p.y += speech * envelope;
  p.y += sin(s * PI * 1.35 + x * .85 - movement * .28) * sin(s * PI) * (.20 + curiosity * .13) * envelope;
  p.z += sin(s * PI) * (.32 + curiosity * .14) * envelope;
  p.z += sin(s * PI * 1.7 + x * 1.15 - movement * .32) * .14 * envelope;
  p.z += speech * .22;
  p.x *= 1. - worry * .12 - irritation * .055;
  p.x += curiosity * .10 * envelope * sin(movement * .38) + s * sin(twist) * .055 * envelope;
  p = silkDeform(coordinate, p, arch);
  return finishSurface(p);
}
`;

export const vertexShader = /* glsl */ `
${surfaceGLSL}
varying vec2 vUv;
varying vec3 vView, vNormal;
void main() {
  vUv = uv;
  vec3 p = harmonicSurface(uv);
  float stepU = uv.x > .999 ? -.0007 : .0007;
  float stepV = uv.y > .999 ? -.0007 : .0007;
  vec3 tangent = (harmonicSurface(uv + vec2(stepU, 0.)) - p) / stepU;
  vec3 bitangent = (harmonicSurface(uv + vec2(0., stepV)) - p) / stepV;
  vNormal = normalize(normalMatrix * normalize(cross(tangent, bitangent)));
  vec4 viewPosition = modelViewMatrix * vec4(p, 1.);
  vView = viewPosition.xyz;
  gl_Position = projectionMatrix * viewPosition;
}
`;

export const fragmentShader = /* glsl */ `
${shaderPreamble}
varying vec2 vUv;
varying vec3 vView, vNormal;
float stripeIntegral(float x, float duty) { return floor(x) * duty + min(fract(x), duty); }
float fiberCoverage(float phase, float duty) {
  float footprint = max(fwidth(phase), .0001);
  float coverage = (stripeIntegral(phase + footprint * .5, duty) - stripeIntegral(phase - footprint * .5, duty)) / footprint;
  return mix(coverage, duty, smoothstep(.5, 1.5, footprint));
}
${silkMaterialGLSL}
void main() {
  gl_FragColor = silkMaterial(vUv, vec4(0.));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <premultiplied_alpha_fragment>
}
`;

export function createSurfaceUniforms(_variant: 'silk' = 'silk'): SurfaceUniforms {
  return {
    uTime: { value: 0 }, uPhase: { value: 0 }, uExpressiveness: { value: 1 },
    uEmotionA: { value: new THREE.Vector4() }, uEmotionB: { value: new THREE.Vector4() },
    uPoseC: { value: new THREE.Vector4() },
    uVoice: { value: new THREE.Vector2() }, uHistory: { value: new Float32Array(224) },
    uTuning: { value: new THREE.Vector4(1, .5, 1, 1) }, uViewport: { value: new THREE.Vector2(320, 180) },
  };
}

export function updateSurfaceUniforms(uniforms: SurfaceUniforms, frame: HarmonicFrame, tuning: Partial<HarmonicTuning> = {}) {
  const e = frame.emotion, p = frame.pose;
  uniforms.uTime.value = frame.time;
  uniforms.uPhase.value = frame.phase;
  uniforms.uExpressiveness.value = e.expressiveness;
  uniforms.uEmotionA.value.set(e.joy, e.curiosity, e.worry, e.irritation);
  uniforms.uEmotionB.value.set(e.sadness, e.confidence, e.energy, e.sass);
  uniforms.uPoseC.value.set(p.timing, p.recovery, p.intervention, p.separation);
  uniforms.uVoice.value.set(frame.voice.level, frame.voice.phrase);
  uniforms.uHistory.value = frame.history;
  uniforms.uTuning.value.set(tuning.strands ?? 1, tuning.grouping ?? .5, tuning.attachment ?? 1, tuning.articulation ?? 1);
}

