import { acquireTeamsLock } from "../teams-common/lock.mjs";
import { chromium } from "playwright";
import {
  Room,
  RoomEvent,
  AudioSource,
  AudioFrame,
  LocalAudioTrack,
  TrackPublishOptions,
  TrackSource,
} from "@livekit/rtc-node";
import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createCamera, display, chrome } from "./camera.mjs";
import { privateAudio, voiceFeatures } from "./audio.mjs";
const origin = new URL(
  process.env.RALLY_PRESENCE_ORIGIN || "http://127.0.0.1:6772",
);
if (
  !(
    origin.protocol === "https:" ||
    (origin.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(origin.hostname))
  )
)
  throw new Error("Use the private HTTPS or loopback Rally origin");
const secret = process.env.RALLY_PRESENCE_RUNNER_SECRET;
if (!secret || secret.length < 32)
  throw new Error("Configure the private runner credential");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(action, body = {}, raw = false) {
  const response = await fetch(
    new URL("/api/presence/runner/" + action, origin),
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer " + secret,
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok)
    throw new Error("Runner request failed: " + response.status);
  return raw ? Buffer.from(await response.arrayBuffer()) : response.json();
}
let stopping = false,
  abortCurrent = () => {};
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    stopping = true;
    abortCurrent();
  });
async function run(job) {
  const abort = new AbortController();
  abortCurrent = () => abort.abort();
  const resources = [];
  let heartbeat,
    deadline,
    speaking = null,
    failed = false,
    room,
    source,
    speechGeneration = 0,
    activeSpeechId = null;
  const own = async (resource) => {
    let closing;
    const close = resource.close.bind(resource);
    resource.close = () => closing ??= Promise.resolve().then(close);
    resources.push(resource);
    if (abort.signal.aborted) {
      await resource.close();
      throw new Error("Call canceled");
    }
    return resource;
  };
  const check = () => {
    if (abort.signal.aborted || Date.now() >= job.deadline)
      throw new Error("Call deadline or lease ended");
  };
  const stop = () => {
    abort.abort();
    speaking?.kill("SIGTERM");
  };
  deadline = setTimeout(stop, Math.max(1, job.deadline - Date.now()));
  // Cancellation closes owned resources immediately, including during browser/lobby startup.
  abort.signal.addEventListener(
    "abort",
    () => {
      for (const resource of resources)
        void Promise.resolve()
          .then(() => resource.close())
          .catch(() => {});
    },
    { once: true },
  );
  const base = { claim: job.claim };
  let polling = false,
    leaseAt = Date.now();
  heartbeat = setInterval(async () => {
    if (Date.now() - leaseAt > 12000) {
      stop();
      return;
    }
    if (polling) return;
    polling = true;
    try {
      const state = await api("poll", base);
      if (state.job?.claim !== job.claim) {
        stop();
        return;
      }
      leaseAt = Date.now();
    } catch {
      stop();
    } finally {
      polling = false;
    }
  }, 2000);
  try {
    const audio = await own(await privateAudio(abort.signal));
    check();
    // Until admission, a neutral scene is rendered and no paid ASR is opened.
    const preview = {
      meetingId: job.meetingId,
      revision: 0,
      epoch: 0,
      serverTime: Date.now(),
      phase: "ready",
      paused: false,
      presence: {
        revision: 0,
        evidenceKey: "",
        channels: Object.fromEntries(
          [
            "joy",
            "curiosity",
            "worry",
            "irritation",
            "sadness",
            "confidence",
            "energy",
            "sass",
          ].map((a, i) => [
            a,
            {
              value: [30, 20, 0, 0, 0, 55, 40, 0][i],
              velocity: 0,
              anchor: 0,
              target: [30, 20, 0, 0, 0, 55, 40, 0][i],
              force: 0,
              at: Date.now(),
              expires: Date.now(),
              omega: 1,
            },
          ]),
        ),
      },
      startedAt: null,
      endedAt: null,
      durationMinutes: 1,
      current: "Ready to guide",
      next: "Waiting for admission",
      detour: null,
      adjustment: null,
      topics: [],
      speech: null,
    };
    const camera = await own(
      await createCamera({
        origin,
        scene: preview,
        onFailure: stop,
        signal: abort.signal,
      }),
    );
    check();
    const screen = await own(await display(1440, 900, abort.signal));
    check();
    const browser = await chromium.launch({
      headless: false,
      executablePath: chrome,
      env: { ...audio.env, DISPLAY: screen.name },
      args: [
        "--no-sandbox",
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-ui-for-media-stream",
        "--disable-dev-shm-usage",
      ],
    });
    await own({ close: () => browser.close().catch(() => {}) });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      permissions: ["microphone", "camera"],
    });
    await context.addInitScript(() => {
      const acquire = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = (constraints) =>
        acquire({
          ...constraints,
          video: constraints.video
            ? {
                ...(typeof constraints.video === "object"
                  ? constraints.video
                  : {}),
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30, max: 30 },
              }
            : false,
        });
      window.__rallyPeers = [];
      const Original = window.RTCPeerConnection;
      window.RTCPeerConnection = class extends Original {
        constructor(...args) {
          super(...args);
          window.__rallyPeers.push(this);
        }
      };
    });
    const page = await context.newPage();
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    check();
    await page
      .getByPlaceholder("Type your name", { exact: true })
      .waitFor({ timeout: 45000 });
    check();
    const warning = page.getByRole("button", {
      name: "Continue without audio or video",
      exact: true,
    });
    if (await warning.isVisible().catch(() => false)) await warning.click();
    await page
      .getByPlaceholder("Type your name", { exact: true })
      .fill("Rally · meeting guide");
    await page
      .getByRole("radio", { name: "Computer audio", exact: true })
      .check();
    await page.locator('[data-tid="toggle-mute"]').check();
    await page.locator('[data-tid="toggle-video"]').check();
    check();
    await page
      .getByRole("button", { name: /^Join (now|meeting)$/i })
      .first()
      .click({ timeout: 10000 });
    const lobbyDeadline = Math.min(job.deadline, Date.now() + 180000);
    while (true) {
      check();
      if (Date.now() > lobbyDeadline) throw new Error("Admission timed out");
      const connected = await page.evaluate(
        () =>
          (window.__rallyPeers || []).some(
            (p) => p.connectionState === "connected",
          ) &&
          [...document.querySelectorAll("button")].some((b) =>
            /^(Leave|Hang up)(\b|$)/i.test(
              b.getAttribute("aria-label") || b.textContent,
            ),
          ),
      );
      if (connected) break;
      await sleep(500);
    }
    const started = await api("connected", base);
    check();
    await camera.connect(started.bootstrap);
    check();
    room = new Room();
    await own({ close: () => room.disconnect().catch(() => {}) });
    room.on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
      if (
        topic !== "rally" ||
        participant?.identity !== `backend-${job.meetingId}`
      )
        return;
      try {
        const event = JSON.parse(new TextDecoder().decode(bytes));
        if (
          [
            "speech.cancel",
            "moderator.control",
            "meeting.ended",
            "capture.gap",
            "transcription.gap",
            "plan.updated",
          ].includes(event.type) ||
          (event.type === "presence.scene" &&
            (event.data.paused ||
              (activeSpeechId &&
                event.data.speech?.id === activeSpeechId &&
                event.data.speech?.state === "canceled")))
        ) {
          speechGeneration++;
          speaking?.kill("SIGTERM");
        }
      } catch {}
    });
    room.on(RoomEvent.Disconnected, stop);
    room.on(RoomEvent.Reconnecting, stop);
    await room.connect(started.connection.url, started.connection.token, {
      autoSubscribe: false,
    });
    check();
    source = new AudioSource(16000, 1, 100);
    await own({ close: () => source.close() });
    await room.localParticipant.publishTrack(
      LocalAudioTrack.createAudioTrack("teams-incoming", source),
      new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
    );
    const incoming = audio.source("rally_teams_in.monitor");
    await own({
      close() {
        incoming.kill("SIGTERM");
      },
    });
    let pending = Buffer.alloc(0),
      draining = false;
    incoming.on("error", stop);
    incoming.on("exit", () => {
      if (!abort.signal.aborted) stop();
    });
    incoming.stdout.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      if (pending.length > 16000) {
        failed = true;
        stop();
        return;
      }
      if (draining) return;
      draining = true;
      void (async () => {
        try {
          while (pending.length >= 640 && !abort.signal.aborted) {
            const frame = pending.subarray(0, 640);
            pending = pending.subarray(640);
            const samples = new Int16Array(320);
            for (let i = 0; i < 320; i++) samples[i] = frame.readInt16LE(i * 2);
            await source.captureFrame(new AudioFrame(samples, 16000, 1, 320));
          }
        } catch {
          failed = true;
          stop();
        } finally {
          draining = false;
        }
      })();
    });
    const outgoing = audio.source("rally_teams_out.monitor");
    await own({
      close() {
        outgoing.kill("SIGTERM");
      },
    });
    const features = voiceFeatures();
    let lastFeature = 0,
      featureBusy = false,
      actualStart = null,
      featureSequence = 0;
    outgoing.on("error", stop);
    outgoing.on("exit", () => {
      if (!abort.signal.aborted) stop();
    });
    outgoing.stdout.on("data", (chunk) => {
      const frame = { ...features.sample(chunk), sequence: ++featureSequence, captureEpoch: started.meeting.captureEpoch };
      if (frame.level > 0.01 && actualStart) {
        const callback = actualStart;
        actualStart = null;
        void callback();
      }
      if (Date.now() - lastFeature < 33 || featureBusy) return;
      lastFeature = Date.now();
      featureBusy = true;
      void room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(frame)), {
          reliable: false,
          topic: "rally.voice",
          destination_identities: [
            `host-${job.meetingId}`,
            `renderer-${job.meetingId}`,
          ],
        })
        .catch(stop)
        .finally(() => {
          featureBusy = false;
        });
    });
    const seen = new Set();
    let speechTask = Promise.resolve(),
      speechEpoch = null;
    async function speak(offer) {
      let speechJob,
        played = false,
        file,
        startedAcknowledgement = Promise.resolve();
      const generation = speechGeneration;
      const eligible = () => {
        check();
        if (generation !== speechGeneration) throw new Error("Speech canceled");
      };
      try {
        speechJob = await api("speech", {
          ...base,
          interventionId: offer.id,
          epoch: offer.epoch,
        });
        activeSpeechId = speechJob.id;
        while (speechJob.state === "preparing") {
          await sleep(200);
          eligible();
          speechJob = await api("speech/" + speechJob.id, base);
        }
        if (speechJob.state !== "ready") return;
        const wav = await api("speech/" + speechJob.id + "/audio", base, true);
        eligible();
        if (speechEpoch !== offer.epoch) return;
        file = join(audio.dir, speechJob.id + ".wav");
        await writeFile(file, wav, { mode: 0o600 });
        await api("speech/" + speechJob.id, { ...base, state: "armed" });
        eligible();
        actualStart = () => {
          played = true;
          startedAcknowledgement = api("speech/" + speechJob.id, {
            ...base,
            state: "playing",
          }).catch(() => {
            speaking?.kill("SIGTERM");
          });
        };
        speaking = spawn("paplay", ["--latency-msec=40", "--device=rally_teams_out", file], {
          env: audio.env,
          stdio: "ignore",
        });
        await new Promise((resolve, reject) => {
          speaking.once("exit", resolve);
          speaking.once("error", reject);
        });
        actualStart = null;
        speaking = null;
        await startedAcknowledgement;
        await api("speech/" + speechJob.id, {
          ...base,
          state: played ? "completed" : "canceled",
        });
      } catch {
        if (speechJob)
          await api("speech/" + speechJob.id, {
            ...base,
            state: "canceled",
          }).catch(() => {});
      } finally {
        actualStart = null;
        speaking = null;
        activeSpeechId = null;
        features.reset();
        if (file) await rm(file, { force: true });
      }
    }
    while (!abort.signal.aborted) {
      const connected = await page.evaluate(
        () =>
          (window.__rallyPeers || []).some(
            (p) => p.connectionState === "connected",
          ) &&
          [...document.querySelectorAll("button")].some((b) =>
            /^(Leave|Hang up)(\b|$)/i.test(
              b.getAttribute("aria-label") || b.textContent,
            ),
          ),
      );
      if (!connected) {
        stop();
        break;
      }
      if (!await camera.page.evaluate(()=>window.rallyRenderer.healthy())) {stop();break;}
      const state = await api("heartbeat", {
        ...base,
        captureToken: started.connection.captureToken,
      });
      check();
      const scene = state.scene;
      if (scene.phase !== "live") {
        stop();
        break;
      }
      if (
        scene.paused ||
        (activeSpeechId &&
          scene.speech?.id === activeSpeechId &&
          scene.speech?.state === "canceled") ||
        (speechEpoch !== null && speechEpoch !== scene.epoch)
      ) {
        speechGeneration++;
        speaking?.kill("SIGTERM");
        actualStart = null;
      }
      speechEpoch = scene.epoch;
      if (!scene.paused && state.offer && !seen.has(state.offer.id)) {
        seen.add(state.offer.id);
        speechTask = speechTask.then(() => speak(state.offer));
      }
      await sleep(1000);
    }
  } catch (error) {
    failed = !stopping;
    console.error(
      "Presence call stopped:",
      String(error.message).replace(/https?:\/\/\S+/g, "[URL omitted]"),
    );
  } finally {
    clearInterval(heartbeat);
    clearTimeout(deadline);
    stop();
    for (const resource of resources.reverse())
      await Promise.resolve(resource.close()).catch(() => {});
    await api("finish", { ...base, failed }).catch(() => {});
    abortCurrent = () => {};
  }
}
const releaseLock = await acquireTeamsLock();
try {
console.log(
  "Rally Teams presence runner ready; joins require explicit host consent.",
);
while (!stopping) {
  try {
    const { job } = await api("poll");
    if (job) await run(job);
  } catch {
    console.error("Presence queue unavailable; no join attempted.");
  }
  if (!stopping) await sleep(2000);
}

} finally { releaseLock(); }
