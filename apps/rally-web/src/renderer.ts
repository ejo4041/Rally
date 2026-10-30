import { VoiceSequence } from "../../../packages/rally-presence/voice.ts";
import { mountPresence } from "./presence.ts";
import type { Scene } from "../../../packages/rally-presence/scene.ts";
import type { BotVoiceFrame } from "living-silk";
const surface = mountPresence(document.body, true);
const sequence = new VoiceSequence();
const api = {
  preview(scene: Scene) {
    surface.update(scene);
  },
  voice(frame: BotVoiceFrame & { sequence?: number; captureEpoch?: number }) {
    if (!sequence.accept(frame)) return;
    surface.silk?.setVoice({ ...frame, timestamp: performance.now() / 1000 });
  },
  healthy() {
    return !!surface.silk;
  },
  metrics() {
    return surface.silk?.getMetrics() ?? null;
  },
  async close() {
    surface.dispose();
  },
};
Object.assign(window, { rallyRenderer: api });
