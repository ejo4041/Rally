// Long browser-to-LiveKit-to-Node capture check with synthetic audio and injected
// ASR/reasoning/speech. No provider key, live meeting or paid inference is used.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const minutes = Number(process.env.RALLY_ENDURANCE_MINUTES || 65),
  rotationMs = Number(process.env.RALLY_TEST_ASR_ROTATION_MS || 55 * 60000);
const reportName =
  process.env.RALLY_ENDURANCE_REPORT_NAME || "capture-endurance.json";
if (
  !Number.isFinite(minutes) ||
  minutes < 1 ||
  minutes > 180 ||
  !Number.isFinite(rotationMs) ||
  rotationMs < 1000 ||
  rotationMs > 55 * 60000 ||
  !/^[a-z0-9-]{1,70}\.json$/i.test(reportName)
)
  throw Error("Invalid bounded endurance settings");
const port = Number(process.env.RALLY_WEB_PORT || 5198),
  apiPort = Number(process.env.RALLY_TEST_API_PORT || 3198),
  mediaPort = Number(process.env.RALLY_TEST_MEDIA_PORT || 18998),
  base = `http://127.0.0.1:${port}`;
const children = [],
  errors = [];
let browser,
  stopping = false,
  wake;
let sourceRevision = null,
  sourceDirty = null;
try {
  sourceRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  sourceDirty = !!execFileSync("git", ["status", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
const report = {
  startedAt: new Date().toISOString(),
  sourceRevision,
  sourceDirty,
  durationMinutes: minutes,
  rotationMs,
  state: "starting",
  syntheticAudio: true,
  providers: "injected deterministic fixtures; no Muse adapter/network calls",
  speech: "synthetic WAV fixture",
  paidModelCalls: 0,
  realMeeting: false,
  rawAudioSaved: false,
  samples: [],
};
await mkdir(resolve(root, "test-results"), { recursive: true });
const destination = resolve(root, "test-results", reportName);
async function save() {
  await writeFile(destination + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(destination + ".tmp", destination);
}
function run(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: {
      ...process.env,
      MODEL_API_KEY: "",
      RALLY_ENV_FILE: "/dev/null",
      RALLY_PAID_ENABLED: "0",
      RALLY_MMS_ENABLED: "0",
      RALLY_TEST_REAL_MMS: "0",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let tail = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (b) => (tail = (tail + b).slice(-1800)));
  child.diagnostics = () => tail;
  return child;
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(child.diagnostics());
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Fixture readiness timed out: " + child.diagnostics());
}
async function rss(pid) {
  const status = await readFile(`/proc/${pid}/status`, "utf8").catch(
    () => null,
  );
  const kb = status?.match(/^VmRSS:\s+(\d+) kB$/m)?.[1];
  return kb ? Math.round(Number(kb) / 1024) : null;
}
const stop = () => {
  stopping = true;
  wake?.();
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  const media = run(
    process.env.RALLY_TEST_LIVEKIT_BINARY ||
      resolve(root, "../rally-api/.data/bin/livekit-server"),
    [
      "--dev",
      "--node-ip",
      "127.0.0.1",
      "--config-body",
      `port: ${mediaPort}\nbind_addresses: [127.0.0.1]\nrtc:\n  tcp_port: ${mediaPort + 1}\n  port_range_start: ${mediaPort + 2}\n  port_range_end: ${mediaPort + 12}\n  use_external_ip: false\n`,
    ],
  );
  await ready(`http://127.0.0.1:${mediaPort}`, media);
  const api = run(process.execPath, ["tests/fixture.ts"], {
    RALLY_WEB_PORT: String(port),
    RALLY_TEST_API_PORT: String(apiPort),
    RALLY_TEST_MEDIA_PORT: String(mediaPort),
    RALLY_TEST_ASR_ROTATION_MS: String(rotationMs),
    RALLY_TEST_ASSESSMENT_MS: "1000",
  });
  await ready(`http://127.0.0.1:${apiPort}/api/health`, api);
  const web = run(process.execPath, ["scripts/dev.mjs"], {
    RALLY_WEB_PORT: String(port),
    RALLY_API_URL: `http://127.0.0.1:${apiPort}`,
  });
  await ready(base, web);
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    }),
    page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.enduranceStreams = [];
    window.enduranceContexts = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const c = new AudioContext(),
        o = c.createOscillator(),
        g = c.createGain(),
        out = c.createMediaStreamDestination();
      o.frequency.value = 440;
      g.gain.value = 0.15;
      o.connect(g).connect(out);
      o.start();
      await c.resume();
      enduranceContexts.push(c);
      enduranceStreams.push(out.stream);
      return out.stream;
    };
  });
  await page.goto(base);
  await page.locator("#auth-toggle").click();
  await page.locator("#username").fill("capture_endurance");
  await page.locator("#password").fill("synthetic-fixture-password");
  await page.locator("#auth-submit").click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  await page.locator("#new-meeting").click();
  await page.locator("[name=title]").fill("Synthetic capture endurance");
  await page
    .locator("[name=agenda]")
    .fill("Verify continuous synthetic capture and source handoff.");
  await page
    .locator("[name=durationMinutes]")
    .fill(String(Math.min(240, Math.ceil(minutes) + 5)));
  await page.locator("#create-submit").click();
  await page.waitForFunction(
    () => document.querySelector("#phase").textContent === "Ready",
  );
  const id = await page.evaluate(() => location.hash.split("/")[1]);
  await page.locator("#consent").check();
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#capture-label").textContent.includes("Listening"),
  );
  const started = performance.now(),
    deadline = started + minutes * 60000;
  let previous = { at: started, bytes: 0, energy: 0 };
  report.state = "running";
  const cdp = await context.newCDPSession(page);
  while (!stopping) {
    for (const child of children)
      if (child.exitCode !== null)
        throw Error("Owned fixture stopped: " + child.diagnostics());
    const state = await (
        await page.request.get(base + "/api/test/state")
      ).json(),
      m = await (await page.request.get(base + `/api/meetings/${id}`)).json();
    const capture = await page.evaluate(() => ({
      listening: document
        .querySelector("#capture-label")
        .textContent.includes("Listening"),
      tracks: enduranceStreams
        .flatMap((s) => s.getAudioTracks())
        .map((t) => ({ enabled: t.enabled, state: t.readyState })),
      notice: document.querySelector("#record-error").textContent,
    }));
    assert.equal(m.phase, "live");
    assert.equal(capture.listening, true);
    assert.ok(
      capture.tracks.length === 1 &&
        capture.tracks.every((t) => t.enabled && t.state === "live"),
    );
    assert.deepEqual(errors, []);
    const now = performance.now(),
      deltaSeconds = (now - previous.at) / 1000,
      deltaBytes = state.totalBytes - previous.bytes;
    if (deltaSeconds > 5)
      assert.ok(
        deltaBytes / deltaSeconds > 16000,
        "Sustained input fell below half the expected PCM rate",
      );
    if (deltaSeconds > 5)
      assert.ok(
        Number.isFinite(state.energy) && state.energy > previous.energy,
        "Synthetic microphone signal disappeared",
      );
    const heap = await cdp.send("Runtime.getHeapUsage");
    report.samples.push({
      at: new Date().toISOString(),
      elapsedMinutes: Math.round((now - started) / 6000) / 10,
      totalPCMBytes: state.totalBytes,
      pcmBytesPerSecond:
        deltaSeconds > 1 ? Math.round(deltaBytes / deltaSeconds) : null,
      asrSessions: state.speechSessions,
      finalTurns: m.turns.length,
      gaps: m.gaps.length,
      apiRssMB: await rss(api.pid),
      livekitRssMB: await rss(media.pid),
      signalEnergy: state.energy,
      browserHeapMB: Math.round(heap.usedSize / 1048576),
      microphoneLive: true,
    });
    await save();
    console.log(JSON.stringify(report.samples.at(-1)));
    previous = { at: now, bytes: state.totalBytes, energy: state.energy };
    if (now >= deadline) break;
    await new Promise((r) => {
      const timer = setTimeout(
        r,
        Math.min(15000, deadline - performance.now()),
      );
      wake = () => {
        clearTimeout(timer);
        r();
      };
    });
  }
  if (!stopping) {
    const last = report.samples.at(-1);
    assert.ok(last.totalPCMBytes / (minutes * 60) > 24000);
    if (minutes * 60000 > rotationMs + 3000)
      assert.ok(last.asrSessions >= 2, "No source handoff observed");
    await page.locator("#end").click();
    await page.waitForFunction(() =>
      ["Ready", "Failed"].includes(
        document.querySelector("#report-status").textContent,
      ),
    );
    if ((await page.locator("#report-status").textContent()) === "Failed") {
      await page.locator("#retry-report").click();
      await page.waitForFunction(
        () => document.querySelector("#report-status").textContent === "Ready",
      );
    }
    assert.equal(
      await page.evaluate(() =>
        enduranceStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
      true,
    );
    const exported = await (
      await page.request.get(base + `/api/meetings/${id}/export`)
    ).json();
    assert.equal(exported.phase, "ended");
    const sourceIds = new Set(exported.turns.map((turn) => turn.sessionId));
    for (const sourceId of sourceIds)
      assert.ok(
        exported.turns.some(
          (turn) => turn.sessionId === sourceId && turn.turnId === 1,
        ),
        "Final drain missing for a captured source",
      );
    assert.equal(
      (await (await page.request.get(base + "/api/usage")).json()).length,
      0,
    );
    report.cleanEnd = true;
    report.finalTurns = exported.turns.length;
    report.finalAsrSessions = new Set(
      exported.turns.map((turn) => turn.sessionId),
    ).size;
    report.continuityGaps = exported.gaps.length;
    report.state = "passed";
  } else report.state = "stopped";
} catch (error) {
  report.state = stopping ? "stopped" : "failed";
  if (!stopping) {
    report.error =
      error instanceof Error ? error.message : "Synthetic capture failure";
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  }
  report.endedAt = new Date().toISOString();
  await save();
  console.log(
    JSON.stringify({
      state: report.state,
      samples: report.samples.length,
      paidModelCalls: 0,
      error: report.error,
    }),
  );
}
