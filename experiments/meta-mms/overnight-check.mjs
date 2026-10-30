// Long-running local model check. Explicit synthetic phrases only; no platform,
// provider API, waveform file or production meeting record is used.
import { MMSSpeech, MODEL, REVISION } from "./speech.mjs";
import { writeFile, mkdir, readFile } from "node:fs/promises";
const durationMinutes = Number(process.env.RALLY_SPEECH_SOAK_MINUTES || 480),
  intervalMinutes = Number(process.env.RALLY_SPEECH_SOAK_INTERVAL || 30);
if (
  !Number.isFinite(durationMinutes) ||
  durationMinutes < 1 ||
  durationMinutes > 480 ||
  !Number.isFinite(intervalMinutes) ||
  intervalMinutes < 1 ||
  intervalMinutes > 60
)
  throw Error("Invalid bounded duration/interval");
const engine = new MMSSpeech({
  python:
    process.env.RALLY_MMS_PYTHON || "/srv/hackathon/tools/mms-venv/bin/python",
  modelDirectory:
    process.env.RALLY_MMS_MODEL_DIR || "/srv/hackathon/models/mms-tts-eng",
});
const dir = new URL("./test-results/", import.meta.url);
const reportName =
  process.env.RALLY_SPEECH_SOAK_REPORT_NAME || "overnight-check.json";
if (!/^[a-z0-9-]{1,70}\.json$/i.test(reportName))
  throw Error("Use a JSON report basename.");
await mkdir(dir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  model: MODEL,
  revision: REVISION,
  durationMinutes,
  intervalMinutes,
  state: "running",
  checks: [],
  paidModelCalls: 0,
  realMeeting: false,
  rawAudioSaved: false,
};
let stopping = false,
  wake;
const stop = () => {
  stopping = true;
  wake?.();
  engine.close();
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
const save = () =>
  writeFile(new URL(reportName, dir), JSON.stringify(report, null, 2) + "\n");
try {
  const started = performance.now(),
    deadline = started + durationMinutes * 60000;
  while (!stopping) {
    const before = performance.now(),
      audio = await engine.synthesize(
        "Could we return to the release decision?",
      );
    let sum = 0;
    for (let i = 0; i < audio.pcm.length; i += 2)
      sum += (audio.pcm.readInt16LE(i) / 32768) ** 2;
    const rms = Math.sqrt(sum / (audio.pcm.length / 2));
    if (
      audio.model !== MODEL ||
      audio.revision !== REVISION ||
      audio.sampleRate !== 16000 ||
      rms < 0.005 ||
      audio.seconds <= 0 ||
      audio.seconds > 30
    )
      throw Error("Invalid local speech waveform");
    const workerPid = engine.child?.pid;
    const workerStatus = workerPid
      ? await readFile(`/proc/${workerPid}/status`, "utf8").catch(() => null)
      : null;
    const workerKb = workerStatus?.match(/^VmRSS:\s+(\d+) kB$/m)?.[1];
    report.checks.push({
      at: new Date().toISOString(),
      elapsedMinutes: Math.round((performance.now() - started) / 6000) / 10,
      requestMs: Math.round(performance.now() - before),
      seconds: audio.seconds,
      rms,
      workerPid: workerPid ?? null,
      workerRssMB: workerKb ? Math.round(Number(workerKb) / 1024) : null,
      controllerRssMB: Math.round(process.memoryUsage().rss / 1048576),
    });
    await save();
    console.log(JSON.stringify(report.checks.at(-1)));
    if (performance.now() >= deadline) break;
    await new Promise((resolve) => {
      const timer = setTimeout(
        resolve,
        Math.min(intervalMinutes * 60000, deadline - performance.now()),
      );
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    // Periodically exercise a cold reload, as cancellation terminates inference.
    if (report.checks.length % 4 === 0) engine.close();
  }
  report.state = stopping ? "stopped" : "passed";
} catch (error) {
  report.state = stopping ? "stopped" : "failed";
  if (!stopping) {
    report.error =
      error instanceof Error ? error.message : "Local speech failure";
    process.exitCode = 1;
  }
} finally {
  engine.close();
  report.endedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      state: report.state,
      checks: report.checks.length,
      paidModelCalls: 0,
    }),
  );
}
