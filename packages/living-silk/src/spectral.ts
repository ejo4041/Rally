export function spectralBandPower(spectrum:Float32Array, sampleRate:number, fftSize:number, low:number, high:number) {
  const hzPerBin = sampleRate / fftSize;
  const upper = Math.min(high, sampleRate / 2);
  let power = 0;
  for (let i = Math.max(1, Math.ceil(low / hzPerBin - .5)); i < Math.min(spectrum.length, Math.floor(upper / hzPerBin + .5) + 1); i++) {
    const overlap = Math.max(0, Math.min(upper, (i + .5) * hzPerBin) - Math.max(low, (i - .5) * hzPerBin)) / hzPerBin;
    const db = spectrum[i];
    if (Number.isFinite(db)) power += Math.pow(10, db / 10) * overlap;
  }
  return power;
}

