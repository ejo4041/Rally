export const silkDeformGLSL = /* glsl */ `
float silkGaussian(float offset) { return exp(-offset * offset); }
float silkStrandCenter(float i, float u) {
  float center = .069 + i * .108 + .012 * sin(i * 4.17);
  float belly = sin(PI * u);
  center += belly * (.013 * sin(u * 4.8 + i * 1.43 + uPhase * .085));
  float tension = uExpressiveness * (.7 * uEmotionA.z + uEmotionA.w);
  center += belly * tension * .010 * sin(u * 17. + i * .8 - uPhase * 1.4);
  return center;
}
float silkStrandPresence(float i) {
  float sparse = uExpressiveness * max(uEmotionA.x * .65, uEmotionB.x * .8);
  return (i > 1.5 && i < 2.5) || (i > 5.5 && i < 6.5) ? 1. - sparse : 1.;
}
float silkStrandTaper(float i, float u) {
  float start = .03 + .13 * (.5 + .5 * sin(i * 2.31));
  float end = .83 + .14 * (.5 + .5 * cos(i * 3.17));
  return smoothstep(start, start + .16, u) * (1. - smoothstep(end - .18, end, u));
}
float silkStrandWidth(float i, float u) {
  float swell = .75 + .25 * sin(u * 7.2 + i * 2.13);
  float body = 1. + uExpressiveness * (.60 * uEmotionA.x + .15 * uEmotionB.y - .40 * uEmotionA.z - .15 * uEmotionA.w);
  return (.014 + .005 * sin(i * 2.37)) * swell * silkStrandTaper(i, u) * body;
}
vec3 silkDeform(vec2 uv, vec3 p, float arch) {
  float u = uv.x, s = uv.y * 2. - 1.;
  float x = (u - .5) * 3.7;
  float e = pow(max(sin(PI * u), 0.), .72);
  float joy = uEmotionA.x * uExpressiveness;
  float curiosity = uEmotionA.y * uExpressiveness;
  float worry = uEmotionA.z * uExpressiveness;
  float irritation = uEmotionA.w * uExpressiveness;
  float sadness = uEmotionB.x * uExpressiveness;
  float confidence = uEmotionB.y * uExpressiveness;
  float sass = uEmotionB.w * uExpressiveness;
  float happy = sass * (.18 + joy) / (.7 + joy + irritation * 1.6 + worry);
  float annoyed = sass * irritation / (.4 + irritation + joy);
  float cadence = uPhase * .57;
  float hold = smoothstep(-.52, .44, sin(cadence));
  float flourish = sin(uPhase * .82);
  float trailing = sin(uPhase * .82 - u * .72);

  float delay = (.5 - .5 * sin(x * 1.15 + .35)) * .43;
  float level = historyAt(delay, 0);
  float phrase = historyAt(delay, 1);
  float low = historyAt(delay, 2);
  float lowMid = historyAt(delay, 3);
  float mid = historyAt(delay, 4);
  float highMid = historyAt(delay, 5);
  float high = historyAt(delay, 6);
  float broadPhase = x * 3.25 - uPhase * .32;
  float middlePhase = broadPhase * 2. + .35;
  float tightPhase = broadPhase * 4. + .65;
  float broadTurn = (level * .24 + phrase * .16 + low * .25) * sin(broadPhase);
  float middleTurn = (lowMid * .18 + mid * .12) * sin(middlePhase);
  float voiceTurn = bounded(broadTurn + middleTurn, .65) * uTuning.w;
  float beat = sin(uPhase * 1.1);
  float snap = beat / sqrt(.025 + beat * beat);
  float recoilBeat = sin(uPhase * 1.1 - .42);
  float recoil = recoilBeat / sqrt(.065 + recoilBeat * recoilBeat);
  float inspect = smoothstep(-.30, .55, sin(uPhase * .68));
  float check = sin(uPhase * .72) * (.22 + .78 * smoothstep(-.2, .7, sin(uPhase * .41)));
  float focus = silkGaussian((u - .68) * 5.2);
  float restingTurn = .88 * (1. - .55 * irritation) * sin(x * 3.25 - uPhase * .32);
  restingTurn += .23 * (1. - .65 * joy - .40 * confidence) * sin(x * 5.8 + uPhase * .18);
  restingTurn *= (1. - .65 * sadness) * (1. - .20 * worry);
  restingTurn += irritation * (.60 * sin(x * 7.9 - uPhase * 2.1) + .75 * snap - .28 * recoil);
  restingTurn += curiosity * focus * (.65 * inspect + .30 * sin(x * 10. - uPhase * 1.9));
  restingTurn += worry * .42 * check * sin(x * 4.4);
  float turn = bounded(restingTurn + voiceTurn, 2.15) * e;
  float opening = level * .10 + phrase * .08 + low * .10 * (.5 + .5 * cos(broadPhase));
  float mediumFold = (lowMid * .05 + mid * .04) * sin(middlePhase);
  float localWidth = 1. + bounded((opening + mediumFold) * uTuning.w, .30);
  localWidth *= 1. + .20 * joy - .22 * worry - .08 * irritation + .05 * confidence;
  float spineZ = .14 * sin(x * 1.15 - uPhase * .32) * pow(max(sin(PI * u), 0.), .62);
  vec2 crossSection = vec2(p.y - arch, p.z - spineZ) * localWidth;
  // Speech turns opposing edges around the spine instead of lifting the sheet.
  p.y = arch + crossSection.x * cos(turn) - crossSection.y * sin(turn);
  p.z = spineZ + crossSection.x * sin(turn) + crossSection.y * cos(turn);
  p.y += mediumFold * s * e * uTuning.w;
  p.z += (highMid * .018 + high * .008) * sin(tightPhase + s * .4) * sin(s * PI) * e * uTuning.w;

  // The return fold keeps the membrane full when its outer edge turns away.
  float returnFold = sin(s * PI * .85 + u * 3.1 - uPhase * .16);
  p.y += e * .12 * returnFold * (1. - s * s);
  p.z += e * (.24 * cos(s * PI * .93 + u * 2.3 - uPhase * .14) + .12 * sin(u * 5.2 - .6));
  p.y += .10 * e * s * sin(u * 5.8 - uPhase * .21);

  float ridges = 0.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float d = (uv.y - silkStrandCenter(fi, u)) / .045;
    ridges += exp(-d * d) * silkStrandTaper(fi, u) * silkStrandPresence(fi) * (.016 + .009 * sin(fi * 2.37));
  }
  p.z += ridges * e;

  float shoulder = silkGaussian((u - .68) * 4.8);
  float tail = silkGaussian((u - .22) * 5.2);
  p.y += happy * e * (.40 * shoulder * flourish - .25 * tail * trailing);
  p.z += happy * e * .20 * s * trailing;
  p.y += annoyed * e * (.18 * (u - .45) * hold - .13 * sin(cadence - .95) * shoulder);
  p.z += annoyed * e * .20 * s * sin(cadence - .95) * (.35 + .65 * hold);
  p.y += curiosity * e * .25 * shoulder * (1. - .45 * s * s);
  p.z += curiosity * e * .19 * shoulder * s;
  p.x += curiosity * .16 * (smoothstep(.28, .9, u) - .5);
  p.y -= worry * e * .10 * shoulder + sadness * e * .10 * tail;
  p.x *= 1. - .11 * worry + .04 * confidence;
  p.x += curiosity * .30 * (shoulder - .30 * tail) * inspect;
  p.x -= worry * .17 * shoulder * check;
  p.y += irritation * e * (.20 * x * snap - .09 * x * recoil);
  p.y += irritation * e * .070 * s * sin(x * 16. - uTime * 17.);
  p.y += worry * e * .045 * sin(x * 13. + uTime * 9.) * (.25 + .75 * shoulder);
  p.x += e * .045 * s * sin(u * 4.2 + uPhase * .12);
  float waist = 1. - .14 * silkGaussian((u - .56 - .025 * sin(uPhase * .19)) * 6.2);
  p.y *= waist;
  p.z *= waist;
  float freedom = (1. - .45 * irritation - .20 * worry) * (1. - .65 * sadness);
  p.y -= e * (.10 + joy * .22);
  p.y += e * freedom * (.23 * sin(x * 1.32 - uPhase * .28) + (.12 + uEmotionB.z * .06) * sin(x * 3.25 - uPhase * .72));
  p.y += e * .11 * sin(s * PI * 2. + x * .8 - uPhase * .32) * sin(s * PI);
  p.y -= sadness * e * (.20 + .12 * shoulder);
  p.y += irritation * .62 * (u - .5) * e;
  p.y += worry * .14 * e * cos((u - .5) * 7.5);
  p.z += e * .16 * sin(u * PI * 2. + .8);
  float tip = smoothstep(0., .11, u) * smoothstep(0., .11, 1. - u);
  p.yz *= max(tip, .001);
  p.y += p.x * (.19 * irritation + .12 * curiosity * (.65 + .35 * sin(uPhase * .43)));
  p.y += annoyed * .12 * p.x * hold;
  p.y -= sadness * .13 * (1. - e);
  p.x *= .94;
  p.y *= 1.14;
  return p;
}
`;
export const silkMaterialGLSL = /* glsl */ `
float silkBandCoverage(float v, float center, float width) {
  float distance = abs(v - center) - width;
  float footprint = max(fwidth(v - center) + fwidth(width), .0003);
  return 1. - smoothstep(-footprint, footprint, distance);
}
vec4 silkMaterial(vec2 uv, vec4 rgba) {
  float u = uv.x, v = uv.y;
  float principal = 0., shoulder = 0.;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float center = silkStrandCenter(fi, u);
    float width = silkStrandWidth(fi, u);
    float taper = silkStrandTaper(fi, u) * silkStrandPresence(fi);
    principal += silkBandCoverage(v, center, width) * taper;
    float d = (v - center) / (.024 + width);
    shoulder += exp(-d * d * 1.4) * taper;
  }
  principal = min(principal, 1.);
  shoulder = min(shoulder, 1.);
  float tension = min(1., uExpressiveness * (.75 * uEmotionA.z + uEmotionA.w));
  float sadness = uEmotionB.x * uExpressiveness;
  float density = 58. + tension * 38. - sadness * 14.;
  float phase = v * density + sin(u * 5.7 + v * 4.3 + uPhase * .085) * .72;
  phase += tension * .22 * sin(u * 20. - uPhase * 1.4);
  float duty = .17 + .055 * tension - .035 * sadness;
  float fine = fiberCoverage(phase, duty);
  float detail = smoothstep(100., 380., uViewport.y);
  float thread = mix(duty, fine, .30 + .70 * detail);
  vec3 n = normalize(vNormal);
  vec3 viewDirection = normalize(-vView);
  if (dot(n, viewDirection) < 0.) n = -n;
  vec3 lightDirection = normalize(vec3(-.52, .85, 1.15));
  vec3 halfDirection = normalize(lightDirection + viewDirection);
  float facing = max(dot(n, viewDirection), 0.);
  float diffuse = .17 + .83 * max(dot(n, lightDirection), 0.);
  vec3 tangent = dFdx(vView) * dFdy(vUv.y) - dFdy(vView) * dFdx(vUv.y);
  tangent /= max(length(tangent), .00001);
  float aligned = dot(tangent, halfDirection);
  float silkSheen = pow(max(1. - aligned * aligned, 0.), 9.) * pow(max(dot(n, halfDirection), 0.), 2.);
  float broadSheen = mix(pow(max(dot(n, halfDirection), 0.), 7.5), silkSheen, .38);
  float reflected = pow(max(dot(n, normalize(vec3(.72, -.4, .72))), 0.), 3.);
  float joy = uEmotionA.x, curiosity = uEmotionA.y, worry = uEmotionA.z, irritation = uEmotionA.w;
  vec3 base = mix(vec3(.035, .30, .19), vec3(.065, .39, .17), joy * .55);
  base = mix(base, vec3(.025, .31, .51), curiosity * .78);
  base = mix(base, vec3(.12, .085, .25), uEmotionB.x * .78);
  base = mix(base, vec3(.49, .19, .025), worry * .82);
  base = mix(base, vec3(.52, .025, .04), irritation * .88);
  vec3 pearl = mix(base * 1.8, vec3(.43, .62, .54), .38);
  vec3 color = base * (.30 + 1.12 * diffuse + .11 * reflected);
  color += pearl * (broadSheen * (.39 + shoulder * .20) + principal * (.13 + tension * .08 - sadness * .04) * uTuning.x);
  color += base * thread * .18;
  float tipFade = smoothstep(0., .045, u) * smoothstep(0., .045, 1. - u);
  float edgeFade = smoothstep(0., .034, v) * smoothstep(0., .034, 1. - v);
  float alpha = .34 + .10 * facing + .10 * shoulder + tension * .06 - sadness * .07;
  alpha += principal * (.40 + tension * .10 - sadness * .10) * uTuning.x + thread * (.14 + .06 * detail);
  alpha *= tipFade * edgeFade;
  return vec4(color, clamp(alpha, 0., .92));
}
`;
