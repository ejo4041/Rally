import {
  defaultEmotion, silentBotVoice, HISTORY_CHANNELS, HISTORY_SAMPLES, HISTORY_SECONDS,
  type BotVoiceFrame, type EmotionInput, type HarmonicFrame, type PoseChannels, type VoiceBands,
} from './contracts';

const unit = (v: number) => Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
const emotionKeys = Object.keys(defaultEmotion) as (keyof EmotionInput)[];
type Spring = {value: number; velocity: number};
function spring(state: Spring, target: number, frequency: number, dt: number) {
  const w = frequency * Math.PI * 2;
  const displacement = state.value - target;
  const impulse = state.velocity + w * displacement;
  const decay = Math.exp(-w * dt);
  state.value = target + (displacement + impulse * dt) * decay;
  state.velocity = (state.velocity - w * impulse * dt) * decay;
  return state.value;
}
const makeSpring = (value = 0): Spring => ({value, velocity: 0});

export class HarmonicDriver {
  readonly frame: HarmonicFrame;
  private targetEmotion: EmotionInput;
  private trajectory: ((timestampSeconds: number) => EmotionInput) | null = null;
  setTrajectory(source: ((timestampSeconds: number) => EmotionInput) | null) { this.trajectory = source; }
  private targetVoice = silentBotVoice();
  private emotions: Record<keyof EmotionInput, Spring>;
  private voice = Array.from({length: HISTORY_CHANNELS}, () => makeSpring());
  private lastTime: number | null = null;
  private epochChangedAt = -1;
  private epochStart = new Float32Array(HISTORY_CHANNELS);
  private historyClock = 0;
  private ring = new Float32Array((HISTORY_SAMPLES + 1) * HISTORY_CHANNELS);
  private ringHead = 0;
  private interventionStart = -100;

  constructor(initial: Partial<EmotionInput> = {}) {
    this.targetEmotion = {...defaultEmotion, ...initial};
    for (const key of emotionKeys) this.targetEmotion[key] = unit(this.targetEmotion[key]);
    this.emotions = Object.fromEntries(emotionKeys.map(key => [key, makeSpring(this.targetEmotion[key])])) as typeof this.emotions;
    this.frame = {
      time: 0, phase: 0, emotion: {...this.targetEmotion}, voice: silentBotVoice(),
      pose: {} as PoseChannels, history: new Float32Array(HISTORY_SAMPLES * HISTORY_CHANNELS),
    };
    this.updatePose();
  }

  setEmotion(values: Partial<EmotionInput>) {
    for (const key of emotionKeys) if (values[key] !== undefined) this.targetEmotion[key] = unit(values[key]);
  }

  setVoice(value: BotVoiceFrame) {
    if (value.sourceEpoch !== this.targetVoice.sourceEpoch) {
      this.epochChangedAt = this.frame.time;
      this.voice.forEach((state, i) => {this.epochStart[i] = state.value;});
    }
    this.targetVoice = {
      level: unit(value.level), phrase: unit(value.phrase), bands: value.bands.map(unit) as VoiceBands,
      timestamp: Number.isFinite(value.timestamp) ? value.timestamp : 0, sourceEpoch: value.sourceEpoch,
    };
  }

  intervene() { this.interventionStart = this.frame.time; }

  advance(timestampSeconds: number): HarmonicFrame {
    if (!Number.isFinite(timestampSeconds)) return this.frame;
    if (this.lastTime === null) {this.lastTime = timestampSeconds; return this.frame;}
    const elapsed = Math.max(0, Math.min(.25, timestampSeconds - this.lastTime));
    this.lastTime = Math.max(this.lastTime, timestampSeconds);
    const steps = Math.max(1, Math.ceil(elapsed / (1 / 120)));
    const dt = elapsed / steps;
    for (let step = 0; step < steps; step++) this.step(dt, timestampSeconds - elapsed + dt * (step + 1));
    return this.frame;
  }

  private step(dt: number, timestamp: number) {
    const frame = this.frame;
    frame.time += dt;
    const trajectory = this.trajectory?.(timestamp);
    for (const key of emotionKeys) {
      if (trajectory) {
        frame.emotion[key] = unit(trajectory[key]);
        this.emotions[key] = {value: frame.emotion[key], velocity: 0};
        this.targetEmotion[key] = frame.emotion[key];
      } else frame.emotion[key] = unit(spring(this.emotions[key], this.targetEmotion[key], 1.45, dt));
    }
    const e = frame.emotion;
    frame.phase += dt * (.36 + e.energy * .82 + e.irritation * .1 - e.sadness * .13);
    const age = Math.max(0, timestamp - this.targetVoice.timestamp);
    const fresh = age <= .15 ? 1 : Math.exp(-(age - .15) / .14);
    const crossfade = unit((frame.time - this.epochChangedAt) / .2);
    const blend = crossfade * crossfade * (3 - 2 * crossfade);
    const targets = [this.targetVoice.level, this.targetVoice.phrase, ...this.targetVoice.bands];
    const previousVoice = this.voice.map(state => state.value);
    for (let i = 0; i < HISTORY_CHANNELS; i++) {
      const target = this.epochStart[i] * (1 - blend) + targets[i] * fresh * blend;
      spring(this.voice[i], target, 6, dt);
    }
    frame.voice.level = unit(this.voice[0].value);
    frame.voice.phrase = unit(this.voice[1].value);
    for (let i = 0; i < 5; i++) frame.voice.bands[i] = unit(this.voice[i + 2].value);
    frame.voice.timestamp = timestamp;
    frame.voice.sourceEpoch = this.targetVoice.sourceEpoch;
    this.historyClock += dt;
    const samplePeriod = HISTORY_SECONDS / (HISTORY_SAMPLES - 1);
    while (this.historyClock >= samplePeriod) {
      this.historyClock -= samplePeriod;
      this.ringHead = (this.ringHead + 1) % (HISTORY_SAMPLES + 1);
      for (let ch = 0; ch < HISTORY_CHANNELS; ch++) {
        const fractionAtSample = dt > 0 ? unit((dt - this.historyClock) / dt) : 1;
        this.ring[this.ringHead * HISTORY_CHANNELS + ch] = previousVoice[ch] + (this.voice[ch].value - previousVoice[ch]) * fractionAtSample;
      }
    }
    const fraction = this.historyClock / samplePeriod;
    for (let i = 0; i < HISTORY_SAMPLES; i++) {
      const a = (this.ringHead + i + 2) % (HISTORY_SAMPLES + 1);
      const b = (a + 1) % (HISTORY_SAMPLES + 1);
      for (let ch = 0; ch < HISTORY_CHANNELS; ch++) {
        const older = this.ring[a * HISTORY_CHANNELS + ch];
        const newer = i === HISTORY_SAMPLES - 1 ? this.voice[ch].value : this.ring[b * HISTORY_CHANNELS + ch];
        frame.history[i * HISTORY_CHANNELS + ch] = i === HISTORY_SAMPLES - 1 ? this.voice[ch].value : older + (newer - older) * fraction;
      }
    }
    this.updatePose();
  }

  private updatePose() {
    const {emotion: e, pose: p, phase} = this.frame;
    const x = e.expressiveness;
    const lean = .5 + .5 * Math.sin(phase * .57);
    const inspect = .5 + .5 * Math.sin(phase * .83 + .7);
    const pressureHold = .5 + .5 * Math.tanh(Math.sin(phase * .69 - .4) * 2.4);
    const elapsed = this.frame.time - this.interventionStart;
    const onset = unit(elapsed / .65);
    const release = unit((elapsed - 1.6) / 2.1);
    const intervention = elapsed < 0 ? 0 : onset * onset * (3 - 2 * onset) * (1 - release * release * (3 - 2 * release));
    p.openness = unit(.44 + x * (.52 * e.joy + .19 * e.confidence - .29 * e.worry - .22 * e.sadness));
    p.support = unit(.54 + x * (.39 * e.confidence + .15 * e.joy - .47 * e.sadness));
    p.tension = unit(x * (.62 * e.worry + .8 * e.irritation));
    p.reach = unit(x * e.curiosity * (.58 + .42 * inspect));
    p.withdrawal = unit(x * e.worry * (.58 + .42 * (1 - inspect)));
    p.pressure = unit(x * e.irritation * (.6 + .4 * pressureHold));
    p.coherence = unit(.62 + .3 * e.confidence - .22 * e.worry);
    p.asymmetry = unit(x * (.43 * e.curiosity + e.sass * (.56 + .32 * lean)));
    p.timing = unit(.25 + .52 * e.sass + .18 * e.energy);
    p.recovery = unit(.42 + .4 * e.confidence + .16 * e.energy - .29 * e.sadness);
    p.separation = unit(.24 + x * (.42 * e.joy + .2 * e.curiosity - .18 * e.worry));
    p.attachment = unit(.88 - .14 * e.joy + .1 * e.worry);
    p.intervention = unit(intervention);
  }
}
