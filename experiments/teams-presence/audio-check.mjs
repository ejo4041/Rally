// Local pinned MMS -> private virtual microphone; no remote call or paid API.
import { privateAudio, voiceFeatures } from "./audio.mjs";
import { configuredSpeech } from "../../apps/rally-api/src/speech.ts";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
const audio = await privateAudio();
const engine = configuredSpeech();
if (!engine) throw Error("Enable local MMS for this explicit audio check");
let output, input, player;
try {
  await engine.start();
  const result = await engine.synthesize(
    "Let us return to launch scope and confirm the next action.",
    { signal: new AbortController().signal },
  );
  const file = join(audio.dir, "voice.wav");
  await writeFile(file, result.wav, { mode: 0o600 });
  output = audio.source("rally_teams_out.monitor");
  input = audio.source("rally_teams_in.monitor");
  const feature = voiceFeatures();
  let max = 0,
    inputMax = 0,
    latest = 0,
    frames = 0;
  output.stdout.on("data", (chunk) => {
    latest = feature.sample(chunk).level;
    max = Math.max(max, latest);
    frames++;
  });
  input.stdout.on("data", (chunk) => {
    inputMax = Math.max(inputMax, feature.sample(chunk).level);
  });
  await new Promise((r) => setTimeout(r, 300));
  player = spawn("paplay", ["--latency-msec=40", "--device=rally_teams_out", file], {
    env: audio.env,
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 1200));
  player.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(max > 0.03, "outgoing monitor contains actual MMS speech");
  assert.ok(inputMax < 0.001, "own speech does not enter participant input");
  assert.ok(latest < 0.001, "Stop drains to silence");
  const report = {
    at: new Date().toISOString(),
    model: result.model,
    revision: result.revision,
    seconds: result.seconds,
    maxOutgoingLevel: max,
    maxIncomingLevel: inputMax,
    levelAfterStop: latest,
    featureFrames: frames,
    paidCalls: 0,
    passed: true,
  };
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/presence-audio.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  player?.kill("SIGTERM");
  output?.kill("SIGTERM");
  input?.kill("SIGTERM");
  engine.close();
  await audio.close();
}
