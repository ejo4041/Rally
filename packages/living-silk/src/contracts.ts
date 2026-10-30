export const BAND_RANGES = [[80, 250], [250, 600], [600, 1500], [1500, 3500], [3500, 8000]] as const;
export type VoiceBands = [number, number, number, number, number];
export type EmotionInput = {
  joy: number; curiosity: number; worry: number; irritation: number; sadness: number;
  confidence: number; energy: number; sass: number; expressiveness: number;
};
export const defaultEmotion: EmotionInput = {
  joy: .3, curiosity: .2, worry: 0, irritation: 0, sadness: 0,
  confidence: .55, energy: .4, sass: 0, expressiveness: 1,
};
export type BotVoiceFrame = {
  level: number; phrase: number; bands: VoiceBands; timestamp: number; sourceEpoch: number;
};
export const silentBotVoice = (sourceEpoch = 0, timestamp = 0): BotVoiceFrame => ({
  level: 0, phrase: 0, bands: [0, 0, 0, 0, 0], timestamp, sourceEpoch,
});
export type PoseChannels = {
  openness: number; support: number; tension: number; reach: number; withdrawal: number;
  pressure: number; coherence: number; asymmetry: number; timing: number; recovery: number;
  separation: number; attachment: number; intervention: number;
};
export const HISTORY_SAMPLES = 32;
export const HISTORY_CHANNELS = 7;
export const HISTORY_SECONDS = .6;
export type HarmonicFrame = {
  time: number; phase: number; emotion: EmotionInput; voice: BotVoiceFrame;
  pose: PoseChannels; history: Float32Array;
};
export type MotionFrame = HarmonicFrame;
export type HarmonicTuning = {
  strands: number; grouping: number; particles: number; attachment: number; articulation: number;
};
export const defaultTuning: HarmonicTuning = {strands: 1, grouping: .5, particles: 1, attachment: 1, articulation: 1};
