// Authored synthetic single-voice fixture generated offline with existing Meta MMS.
// Test data, not a backend TTS feature or a human diarization evaluation.
import {
  MMSSpeech,
  MODEL,
  REVISION,
} from "../../../experiments/meta-mms/speech.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const dir = resolve("test-results/meeting-audio");
mkdirSync(dir, { recursive: true });
const lines = [
  "Let's review Heimdall. Our goal is to decide whether we are ready for the pilot and capture the remaining work.",
  "The core integration is complete, but the error dashboard is missing. We should not launch until the rollback test passes.",
  "My name is Alice. I will implement the error dashboard by Thursday. I own that action and will send the team the link.",
  "Someone also needs to review the data retention requirements. We have not agreed an owner or a due date for that work yet.",
  "We are getting sidetracked talking about coffee machines. Let's park the coffee discussion and finish the pilot decision.",
  "Our decision is to run the pilot on Monday only if the rollback test passes. Alice owns the dashboard by Thursday. The retention review still needs an owner. If rollback fails, we need a follow up meeting.",
];
const speech = new MMSSpeech({
  python:
    process.env.RALLY_MMS_PYTHON || "/srv/hackathon/tools/mms-venv/bin/python",
  modelDirectory:
    process.env.RALLY_MMS_MODEL_DIR || "/srv/hackathon/models/mms-tts-eng",
});
const chunks = [],
  segments = [];
try {
  for (const text of lines) {
    const audio = await speech.synthesize(text);
    segments.push({ text, seconds: audio.seconds });
    chunks.push(audio.pcm, Buffer.alloc(32000));
  }
} finally {
  speech.close();
}
const pcm = Buffer.concat(chunks);
writeFileSync(resolve(dir, "meeting.pcm"), pcm);
writeFileSync(
  resolve(dir, "manifest.json"),
  JSON.stringify(
    {
      model: MODEL,
      revision: REVISION,
      license: "CC BY-NC 4.0",
      scope: "Original authored single-voice synthetic meeting, no human audio",
      seconds: pcm.length / 32000,
      segments,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    fixture: resolve(dir, "meeting.pcm"),
    seconds: pcm.length / 32000,
  }),
);
