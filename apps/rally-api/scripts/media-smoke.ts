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
const port = Number(process.env.RALLY_TEST_MEDIA_PORT || 17880);
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
  let bytes = 0,
    energy = 0;
  session = await new LiveKitMedia({
    ...defaults,
    livekitUrl: `ws://127.0.0.1:${port}`,
  }).open(
    { id: "transport-smoke" } as Meeting,
    (data) => {
      bytes += data.byteLength;
      const pcm = new Int16Array(
        data.buffer,
        data.byteOffset,
        data.byteLength / 2,
      );
      for (const sample of pcm) energy += sample * sample;
    },
    () => {},
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
    await w.room.localParticipant.publishTrack(
      dest.stream.getAudioTracks()[0],
      { source: lk.Track.Source.Microphone },
    );
  }, connection);
  await new Promise((r) => setTimeout(r, 1800));
  assert.ok(bytes > 16000, "browser audio reaches Node");
  assert.ok(energy > 0, "incoming PCM has signal");
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
    incomingSignal: energy > 0,
    ...result,
    scope:
      "Synthetic browser media; no physical microphone, Muse or TTS provider calls",
  };
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/media-smoke.json",
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser?.close();
  await publisher.disconnect();
  await session?.close();
  await dispose();
  server.close();
  mediaProcess.kill("SIGTERM");
}
