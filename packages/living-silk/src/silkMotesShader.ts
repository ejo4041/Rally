import * as THREE from 'three';

export function createSilkMotes() {
  const positions = new Float32Array(160 * 3);
  const identities = new Float32Array(160 * 4);
  let state = 71093;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + .5) / 4294967296;
  };
  for (let i = 0; i < 160; i++) identities.set([random(), random(), random(), random()], i * 4);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('identity', new THREE.BufferAttribute(identities, 4));
  return geometry;
}

export function silkMotesVertexShader(surface: string) {
  return /* glsl */ `
${surface}
uniform float uMoteAmount;
attribute vec4 identity;
varying vec3 vMoteColor;
varying float vMoteAlpha, vCoreRadius;
void main() {
  float joy = uEmotionA.x * uExpressiveness;
  float curiosity = uEmotionA.y * uExpressiveness;
  float worry = uEmotionA.z * uExpressiveness;
  float irritation = uEmotionA.w * uExpressiveness;
  float sadness = uEmotionB.x * uExpressiveness;
  float sass = uEmotionB.w * uExpressiveness;
  float cohort = floor(identity.z * 5.) * 1.27;
  float phase = uPhase * .41 + cohort;
  float checking = smoothstep(.18, .85, sin(uPhase * .72 + cohort * .25));
  float gaze = smoothstep(-.3, .55, sin(uPhase * .68));
  float u = .04 + identity.x * .92;
  float v = .045 + identity.y * .91;
  u += sin(phase + u * 4.) * .013 * (1. - worry * .65);
  v += cos(phase * .79 + u * 3.) * .027 * (1. - worry * .55);
  u = mix(u, .5 + (u - .5) * .78, worry * (.6 + .4 * checking));
  v = mix(v, .5 + (v - .5) * .76, worry * .6);
  u = mix(u, .68 + (u - .5) * .68, curiosity * (.25 + gaze * .35));
  vec2 coordinate = vec2(clamp(u, .025, .975), clamp(v, .025, .975));
  vec3 p = harmonicSurface(coordinate);
  vec3 tangent = normalize(harmonicSurface(coordinate + vec2(.001, 0.)) - harmonicSurface(coordinate - vec2(.001, 0.)));
  vec3 across = normalize(harmonicSurface(coordinate + vec2(0., .001)) - harmonicSurface(coordinate - vec2(0., .001)));
  vec3 normal = normalize(cross(tangent, across));
  float floating = step(.66, identity.w);
  float attachment = exp((1. - clamp(uTuning.z, 0., 2.)) * .45);
  float radius = mix(.018 + .025 * identity.z, .075 + .09 * identity.z, floating) * attachment;
  radius *= 1. + joy * .65 - worry * .48 - irritation * .30;
  float orbit = phase + identity.w * 6.2831853;
  float lag = .18 + u * .42;
  float calm = 1. - sadness * .72 - irritation * .55;
  float swirl = sin(orbit - lag) * calm;
  swirl += joy * .65 * sin(uPhase * .82 + cohort * .65 - lag);
  swirl += curiosity * .55 * sin(uPhase * .68 + cohort * .45 - lag);
  float sassTail = sass * .8 * sin(uPhase * .82 - u * .72 - .6);
  p += normal * radius * (swirl + sassTail);
  p += across * radius * .65 * (cos(orbit * .83 - lag) * calm + joy * .6 * cos(uPhase * .82 + cohort * .65 - lag));
  p.y += joy * .045 * floating * (.5 + .5 * sin(uPhase * .56 + cohort));
  p.y -= sadness * (.025 + floating * .075) * (.6 + .4 * sin(uPhase * .22 + cohort));
  float snapPhase = uPhase * 1.1 - lag - .42;
  float beat = sin(snapPhase);
  float recoil = beat / sqrt(.025 + beat * beat);
  float agitation = sin(uTime * 9. + (u - .5) * 3.7 * 13. - lag);
  p += tangent * irritation * (.028 * recoil + .012 * agitation);
  p += normal * irritation * .014 * cos(uTime * 9. + (u - .5) * 3.7 * 13. - lag);
  p += tangent * worry * checking * (.024 * sin(uPhase * .72 - lag) + .009 * agitation);
  vec4 view = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * view;
  float worldSize = (.005 + .003 * identity.z) * length(modelViewMatrix[0].xyz);
  float projectedSize = worldSize * uViewport.y * projectionMatrix[1][1] / max(-view.z, .1);
  float core = clamp(projectedSize, .7, 2.5);
  gl_PointSize = core + 1.;
  vCoreRadius = core / (core + 1.);
  float breath = sin(uTime * (.29 + identity.z * .12) + identity.w * 6.2831853);
  float visibility = smoothstep(-.95, -.50, breath);
  float population = clamp(.50 + joy * .18 + curiosity * .22 + worry * .10 + irritation * .50 - sadness * .33 + sass * .08, .10, 1.);
  float rank = fract(identity.x * 17.13 + identity.y * 31.7);
  visibility *= 1. - smoothstep(population - .06, population + .06, rank);
  float tipFade = smoothstep(.025, .10, coordinate.x) * (1. - smoothstep(.90, .975, coordinate.x));
  vMoteAlpha = visibility * tipFade * (.48 + identity.z * .32) * uMoteAmount;
  vMoteAlpha *= 1. - sadness * .15;
  vec3 color = mix(vec3(.055, .48, .27), vec3(.10, .45, .18), joy * .45);
  color = mix(color, vec3(.035, .37, .60), curiosity * .75);
  color = mix(color, vec3(.17, .12, .35), sadness * .72);
  color = mix(color, vec3(.66, .25, .028), worry * .78);
  color = mix(color, vec3(.67, .035, .055), irritation * .85);
  vMoteColor = mix(color * 1.6, vec3(.56, .71, .64), .24);
}
`;
}

export const silkMotesFragmentShader = /* glsl */ `
varying vec3 vMoteColor;
varying float vMoteAlpha, vCoreRadius;
void main() {
  float distance = length((gl_PointCoord - .5) * 2.);
  float pixel = max(fwidth(distance), .001);
  float coverage = 1. - smoothstep(max(0., vCoreRadius - pixel * .5), vCoreRadius + pixel * .5, distance);
  gl_FragColor = vec4(vMoteColor, min(vMoteAlpha, .9) * coverage);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
