// Actual local virtual-camera and WebRTC probe; no meeting join or paid model call.
import { chromium } from "playwright";
import { createCamera, display, chrome } from "./camera.mjs";
import { initialPresence } from "../../packages/rally-presence/state.ts";
import { writeFile, mkdir } from "node:fs/promises";
const origin =
  process.env.RALLY_PRESENCE_TEST_ORIGIN || "http://127.0.0.1:5197";
let camera, screen, browser;
try {
  const now = Date.now();
  camera = await createCamera({
    origin,
    scene: {
      meetingId: "local-video-check",
      revision: 1,
      epoch: 1,
      serverTime: now,
      phase: "live",
      paused: false,
      presence: initialPresence(now),
      startedAt: now - 450000,
      endedAt: null,
      durationMinutes: 30,
      current: "Agree on launch scope",
      next: "Confirm owners and deadlines",
      detour: null,
      adjustment: null,
      topics: [
        { title: "Scope", minutes: 15, status: "active" },
        { title: "Owners", minutes: 10, status: "pending" },
      ],
      speech: null,
    },
  });
  screen = await display(1440, 900);
  browser = await chromium.launch({
    headless: false,
    executablePath: chrome,
    env: { ...process.env, DISPLAY: screen.name },
    args: [
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["camera"],
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const device = devices.find(
      (d) => d.kind === "videoinput" && d.label.includes("Rally"),
    );
    if (!device) throw Error("Rally virtual camera not found");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: device.deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    });
    const send = new RTCPeerConnection(),
      receive = new RTCPeerConnection();
    send.onicecandidate = (e) => {
      if (e.candidate) void receive.addIceCandidate(e.candidate);
    };
    receive.onicecandidate = (e) => {
      if (e.candidate) void send.addIceCandidate(e.candidate);
    };
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    document.body.replaceChildren(video);
    receive.ontrack = (e) => {
      video.srcObject = new MediaStream([e.track]);
      void video.play();
    };
    stream.getVideoTracks()[0].contentHint = "detail";
    const sender = send.addTrack(stream.getVideoTracks()[0], stream);
    await send.setLocalDescription(await send.createOffer());
    await receive.setRemoteDescription(send.localDescription);
    await receive.setLocalDescription(await receive.createAnswer());
    await send.setRemoteDescription(receive.localDescription);
    const parameters = sender.getParameters();
    parameters.degradationPreference = "maintain-resolution";
    parameters.encodings[0].maxBitrate = 6000000;
    parameters.encodings[0].maxFramerate = 30;
    parameters.encodings[0].scaleResolutionDownBy = 1;
    await sender.setParameters(parameters);
    await new Promise((r) => setTimeout(r, 5000));
    const before = [...(await receive.getStats()).values()].find(
      (s) => s.type === "inbound-rtp" && s.kind === "video",
    );
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let frames = 0,
      unique = 0,
      last = "",
      running = true;
    const sample = () => {
      if (!running) return;
      frames++;
      ctx.drawImage(video, 0, 0, 32, 18);
      const hash = Array.from(ctx.getImageData(0, 0, 32, 18).data)
        .filter((_, i) => i % 4 !== 3)
        .map((v) => Math.round(v / 8))
        .join(",");
      if (hash !== last) unique++;
      last = hash;
      video.requestVideoFrameCallback(sample);
    };
    video.requestVideoFrameCallback(sample);
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 10000));
    const seconds = (performance.now() - start) / 1000;
    running = false;
    const after = [...(await receive.getStats()).values()].find(
      (s) => s.type === "inbound-rtp" && s.kind === "video",
    );
    const result = {
      settings: stream.getVideoTracks()[0].getSettings(),
      seconds,
      presentedFrames: frames,
      uniqueFrames: unique,
      uniqueFPS: unique / seconds,
      decodedFPS: (after.framesDecoded - before.framesDecoded) / seconds,
      width: after.frameWidth,
      height: after.frameHeight,
      dropped: after.framesDropped - before.framesDropped,
    };
    stream.getTracks().forEach((t) => t.stop());
    send.close();
    receive.close();
    return result;
  });
  const metrics = await camera.page.evaluate(() =>
    window.rallyRenderer.metrics(),
  );
  await mkdir("test-results", { recursive: true });
  await camera.page.screenshot({ path: "test-results/presence-camera.png" });
  const report = {
    at: new Date().toISOString(),
    scope: "Local virtual camera through real WebRTC; not remote Teams",
    ...result,
    renderer: metrics,
    passed:
      result.width === 1920 && result.height === 1080 && result.uniqueFPS >= 27,
  };
  await writeFile(
    "test-results/presence-video.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally {
  await browser?.close();
  screen?.close();
  await camera?.close();
}
