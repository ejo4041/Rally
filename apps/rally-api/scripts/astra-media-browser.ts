import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { Room, dispose } from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { LiveKitMedia, publishPCM } from "../src/media.ts";
import { defaults } from "../src/config.ts";
import type { Meeting } from "../src/contracts.ts";
import assert from "node:assert/strict";
const port = Number(process.env.RALLY_TEST_MEDIA_PORT || 17890);
const mediaProcess = spawn(
  resolve(".data/bin/livekit-server"),
  [
    "--dev",
    "--bind",
    "127.0.0.1",
    "--port",
    String(port),
    "--node-ip",
    "127.0.0.1",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let mediaErrors = "";
mediaProcess.stderr.on("data", (b) => {
  mediaErrors = (mediaErrors + b).slice(-4000);
});
const server = createServer((req, res) => {
  if (req.url === "/sdk.js") {
    res.setHeader("Content-Type", "application/javascript");
    res.end(
      readFileSync("node_modules/livekit-client/dist/livekit-client.umd.js"),
    );
  } else
    res.end(
      '<html><script src="/sdk.js"></script><body>Audio transport test</body></html>',
    );
});
server.listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined,
  session: Awaited<ReturnType<LiveKitMedia["open"]>> | undefined;
const publisher = new Room();
try {
  for (let n = 0; n < 50; n++) {
    try {
      await fetch(`http://127.0.0.1:${port}`);
      break;
    } catch {
      if (n === 49) throw new Error(mediaErrors);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const gaps: string[] = [];
  let bytes = 0,
    energy = 0;
  const consumeAudio = (data: Uint8Array) => {
    bytes += data.byteLength;
    const pcm = new Int16Array(
      data.buffer,
      data.byteOffset,
      data.byteLength / 2,
    );
    for (const sample of pcm) energy += sample * sample;
  };
  session = await new LiveKitMedia({
    ...defaults,
    livekitUrl: `ws://127.0.0.1:${port}`,
  }).open({ id: "transport-smoke" } as Meeting, consumeAudio, (reason) =>
    gaps.push(reason),
  );
  const connection = await session.connection();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM ||
      "/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
    env: {
      ...process.env,
      LD_LIBRARY_PATH:
        process.env.LD_LIBRARY_PATH || "/srv/hackathon/tools/browser-libs",
    },
  });
  const page = await browser.newPage();
  await page.goto(
    `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  );
  await page.evaluate(async (connection) => {
    const w = window as any;
    const lk = w.LivekitClient;
    w.room = new lk.Room();
    w.received = 0;
    w.events = [];
    w.room.on(lk.RoomEvent.DataReceived, (bytes: Uint8Array) =>
      w.events.push(JSON.parse(new TextDecoder().decode(bytes))),
    );
    w.room.on(lk.RoomEvent.TrackSubscribed, (track: any) => {
      if (track.kind !== "audio") return;
      const el = track.attach();
      document.body.appendChild(el);
      el.play();
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack]),
      );
      const analyser = ctx.createAnalyser();
      src.connect(analyser);
      w.meter = setInterval(() => {
        const a = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(a);
        w.received = Math.max(
          w.received,
          Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length),
        );
      }, 20);
    });
    await w.room.connect(connection.url, connection.token);
    const ctx = new AudioContext();
    await ctx.resume();
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = 440;
    const dest = ctx.createMediaStreamDestination();
    oscillator.connect(dest);
    oscillator.start();
    w.oscillator = oscillator;
    w.micPublication = await w.room.localParticipant.publishTrack(
      dest.stream.getAudioTracks()[0],
      { source: lk.Track.Source.Microphone },
    );
  }, connection);
  await new Promise((r) => setTimeout(r, 1800));
  assert.ok(bytes > 16000, "browser audio reaches Node");
  assert.ok(energy > 0, "incoming PCM has signal");
  const initialBytes = bytes;
  await page.evaluate(async () => {
    await (window as any).micPublication.track.mute();
  });
  await new Promise((r) => setTimeout(r, 1800));
  const mutedBytes = bytes,
    mutedEnergy = energy;
  await page.evaluate(async () => {
    await (window as any).micPublication.track.unmute();
  });
  await new Promise((r) => setTimeout(r, 1800));
  const afterUnmuteBytes = bytes,
    afterUnmuteEnergy = energy;
  console.log(
    JSON.stringify({
      stage: "mute",
      initialBytes,
      mutedBytes,
      afterUnmuteBytes,
      gaps,
    }),
  );
  await page.evaluate(async () => {
    await (window as any).room.disconnect();
  });
  const beforeReconnectBytes = bytes,
    beforeReconnectEnergy = energy;
  await page.evaluate(async (connection) => {
    const w = window as any;
    await w.room.connect(connection.url, connection.token);
    const ctx = new AudioContext();
    await ctx.resume();
    const oscillator = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    oscillator.connect(dest);
    oscillator.start();
    await w.room.localParticipant.publishTrack(
      dest.stream.getAudioTracks()[0],
      { source: w.LivekitClient.Track.Source.Microphone },
    );
  }, connection);
  await new Promise((r) => setTimeout(r, 1800));
  const afterReconnectBytes = bytes,
    afterReconnectEnergy = energy;
  console.log(
    JSON.stringify({
      stage: "reconnect",
      beforeReconnectBytes,
      afterReconnectBytes,
      gaps,
    }),
  );
  await session.close();
  const beforeBackendRestartBytes = bytes,
    beforeBackendRestartEnergy = energy;
  session = await new LiveKitMedia({
    ...defaults,
    livekitUrl: `ws://127.0.0.1:${port}`,
  }).open({ id: "transport-smoke" } as Meeting, consumeAudio, (reason) =>
    gaps.push(reason),
  );
  await new Promise((r) => setTimeout(r, 1800));
  const afterBackendRestartBytes = bytes,
    afterBackendRestartEnergy = energy;
  console.log(
    JSON.stringify({
      stage: "backend-reconnect-existing-publication",
      beforeBackendRestartBytes,
      afterBackendRestartBytes,
      gaps,
    }),
  );
  await session.send({
    version: 1,
    id: "smoke",
    meetingId: "transport-smoke",
    type: "status",
    data: { ok: true },
  });
  const token = new AccessToken("devkey", "secret", {
    identity: "speech-test",
  });
  token.addGrant({
    room: connection.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,
  });
  await publisher.connect(connection.url, await token.toJwt(), {
    autoSubscribe: false,
    dynacast: false,
  });
  const pcm = Int16Array.from(
    { length: 32000 },
    (_, i) => Math.sin((i * 2 * Math.PI * 880) / 16000) * 8000,
  );
  await publishPCM(publisher, pcm);
  await new Promise((r) => setTimeout(r, 300));
  const result = await page.evaluate(() => ({
    outgoingRms: (window as any).received,
    eventCount: (window as any).events.length,
  }));
  assert.ok(result.outgoingRms > 0.001, "Node audio reaches browser");
  assert.ok(result.eventCount > 0, "JSON events reach browser");
  const evidence = {
    at: new Date().toISOString(),
    incomingBytes: bytes,
    backendReconnectRecovered:
      afterBackendRestartBytes - beforeBackendRestartBytes > 16000 &&
      afterBackendRestartEnergy > beforeBackendRestartEnergy,
    muteRecovered:
      afterUnmuteBytes - mutedBytes > 16000 && afterUnmuteEnergy > mutedEnergy,
    reconnectRecovered:
      afterReconnectBytes - beforeReconnectBytes > 16000 &&
      afterReconnectEnergy > beforeReconnectEnergy,
    gaps,
    incomingSignal: energy > 0,
    ...result,
    scope:
      "Synthetic browser media; no physical microphone, Muse or TTS provider calls",
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/astra-media-browser.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
  assert.ok(evidence.muteRecovered, "muted microphone resumes capture");
  assert.ok(evidence.reconnectRecovered, "browser reconnect resumes capture");
  assert.ok(
    evidence.backendReconnectRecovered,
    "backend reconnect subscribes to the existing microphone publication",
  );
} finally {
  await browser?.close();
  await publisher.disconnect();
  await session?.close();
  await dispose();
  server.closeAllConnections();
  server.close();
  mediaProcess.kill("SIGTERM");
}
