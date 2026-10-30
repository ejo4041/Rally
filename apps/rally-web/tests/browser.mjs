import { createRequire } from 'node:module';
const {TOTP,Secret}=createRequire(new URL('../../rally-api/package.json',import.meta.url))('otpauth');
// Real HTTP/session/database/LiveKit integration; synthetic audio and injected
// model providers only. Does not load shared credentials or contact Meta.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { once } from "node:events";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.RALLY_WEB_PORT || 5174),
  apiPort = Number(process.env.RALLY_TEST_API_PORT || 3101),
  mediaPort = Number(process.env.RALLY_TEST_MEDIA_PORT || 18890),
  base = `http://127.0.0.1:${port}`;
const children = [];
let browser;
let debugPage;
const errors = [];
function run(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let tail = "";
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (b) => (tail = (tail + b).slice(-3000)));
  child.once("error", () => {});
  child.diagnostics = () => tail;
  return child;
}
async function ready(url, child) {
  for (let n = 0; n < 80; n++) {
    if (child.exitCode !== null) throw new Error(child.diagnostics());
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Fixture did not start: " + child.diagnostics());
}
const recoveryByUser=new Map();
async function loginWithMFA(page,username,password) {
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#auth-submit').click();
  await page.locator('#mfa-form').waitFor({state:'visible'});
  if(recoveryByUser.has(username)) {
    await page.locator('#use-recovery').click();
    await page.locator('#mfa-code').fill(recoveryByUser.get(username)[0]);
    await page.locator('#mfa-submit').click();
  }
  await page.locator('#enrollment-secret').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#enrollment-secret').textContent.length>0);
  const secret=await page.locator('#enrollment-secret').textContent();
  const code=new TOTP({secret:Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30}).generate();
  await page.locator('#mfa-code').fill(code);
  await page.locator('#mfa-submit').click();
  await page.locator('#recovery-panel').waitFor({state:'visible'});
  recoveryByUser.set(username,(await page.locator('#recovery-codes').textContent()).trim().split('\n'));
  await page.locator('#recovery-continue').click();
  await page.locator('#workspace').waitFor({state:'visible'});
}
try {
  const media = run(
    process.env.RALLY_TEST_LIVEKIT_BINARY ||
      resolve(root, "../rally-api/.data/bin/livekit-server"),
    [
      "--dev",
      "--bind",
      "127.0.0.1",
      "--port",
      String(mediaPort),
      "--node-ip",
      "127.0.0.1",
    ],
  );
  await ready(`http://127.0.0.1:${mediaPort}`, media);
  const server = run(process.execPath, ["tests/fixture.ts"], {
    RALLY_WEB_PORT: String(port),
    RALLY_TEST_API_PORT: String(apiPort),
    RALLY_TEST_MEDIA_PORT: String(mediaPort),
  });
  await ready(`http://127.0.0.1:${apiPort}/api/health`, server);
  const frontend = run(process.execPath, ["scripts/dev.mjs"], {
    RALLY_WEB_PORT: String(port),
    RALLY_API_URL: `http://127.0.0.1:${apiPort}`,
  });
  await ready(base, frontend);
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    }),
    page = await context.newPage();
  debugPage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.fixturePlayback = [];
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (window.fixtureBlockPlayback)
        return Promise.reject(
          new DOMException("Fixture blocked playback", "NotAllowedError"),
        );
      fixturePlayback.push(this);
      return nativePlay.call(this);
    };
    window.fixtureAudio = {
      streams: [],
      contexts: [],
      displayMode: "no-audio",
    };
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        const c = new AudioContext();
        fixtureAudio.contexts.push(c);
        const o = c.createOscillator(),
          g = c.createGain(),
          d = c.createMediaStreamDestination();
        o.frequency.value = 440;
        g.gain.value = 0.2;
        o.connect(g).connect(d);
        o.start();
        await c.resume();
        fixtureAudio.streams.push(d.stream);
        return d.stream;
      },
    });
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      value: async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        canvas.getContext("2d").fillRect(0, 0, 16, 16);
        const stream = canvas.captureStream(2),
          video = stream.getVideoTracks()[0];
        Object.defineProperty(video, "getSettings", {
          value: () => ({
            displaySurface:
              fixtureAudio.displayMode === "screen" ? "monitor" : "browser",
          }),
        });
        if (fixtureAudio.displayMode !== "no-audio")
          for (const track of (
            await navigator.mediaDevices.getUserMedia({ audio: true })
          ).getAudioTracks())
            stream.addTrack(track);
        fixtureAudio.streams.push(stream);
        if (fixtureAudio.displayMode === "pending")
          return new Promise(
            (resolve) => (fixtureAudio.resolveDisplay = () => resolve(stream)),
          );
        return stream;
      },
    });
  });
  await page.goto(base);
  await loginWithMFA(page,"frontend_test","fixture-password-only");
  await page.locator("#logout").click();
  await page.locator("#auth-screen").waitFor({ state: "visible" });
  await loginWithMFA(page,"frontend_test","fixture-password-only");
  assert.equal(await page.locator("#logout").isEnabled(), true);
  await page.locator("#teams-invite summary").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#teams-runner-status").textContent ===
      "Teams runner online",
  );
  await page.locator("#teams-url").fill("https://evil.example/meet/fixture");
  await page.locator("#teams-consent").check();
  await page.locator("#teams-join").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#teams-error")
      .textContent.includes("work/school Teams"),
  );
  await page
    .locator("#teams-url")
    .fill("https://teams.microsoft.com/meet/fixture");
  await page.locator("#teams-transcribe").check();
  await page.locator("#teams-join").click();
  await page.waitForFunction(() =>
    document.querySelector("#teams-message").textContent.includes("lobby"),
  );
  assert.equal(await page.locator("#teams-join").isDisabled(), true);
  await mkdir(resolve(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: resolve(root, "test-results/teams-invite-desktop.png"),
    fullPage: true,
  });
  await page.locator("#teams-leave").click();
  await page.locator("#teams-save").waitFor({ state: "visible" });
  assert.match(
    await page.locator("#teams-transcript").textContent(),
    /Teams fixture finalized text/,
  );
  await page.locator("#teams-save").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#meeting-title").textContent ===
      "Teams transcript",
  );
  assert.equal(await page.locator(".turn").count(), 1);
  assert.equal(await page.locator("#report-status").textContent(), "None");
  assert.equal(await page.locator("#retry-report").isVisible(), true);
  assert.match(
    await page.locator("#retry-report").textContent(),
    /Analyze · uses Muse/,
  );
  assert.ok(
    !(await page.locator("#transcript").textContent()).includes(
      "Do not save partial",
    ),
  );
  await page.locator("#delete").click();
  await page.locator("#confirm-delete").click();
  await page.waitForFunction(() => !document.querySelector("#home").hidden);
  await page.locator("#new-meeting").click();
  await page.locator("[name=title]").fill("Release readiness");
  await page
    .locator("[name=agenda]")
    .fill("Decide release readiness and rollback ownership.");
  await page.locator("[name=durationMinutes]").fill("10");
  await page.locator("[name=participants]").fill("Priya, Alex");
  await page.locator("#create-submit").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#meeting-title").textContent ===
      "Release readiness",
  );
  const id = await page.evaluate(() => location.hash.split("/")[1]);
  assert.equal(await page.locator("#phase").textContent(), "Ready");
  assert.equal(await page.locator("#start").isDisabled(), true);
  await page.locator("#edit-plan").click();
  await page
    .locator("#plan-objective")
    .fill("Choose release scope and confirm rollback ownership");
  await page.locator("#plan-form [type=submit]").click();
  await page.locator("#plan-dialog").waitFor({ state: "hidden" });
  assert.match(
    await page.locator("#plan").textContent(),
    /Choose release scope/,
  );
  for (let i = 0; i < 100; i++) {
    if (
      (await (await page.request.get(base + "/api/speech/status")).json()).ready
    )
      break;
    await page.waitForTimeout(250);
  }
  await page.locator("#test-voice").click();
  await page.waitForFunction(() =>
    fixturePlayback.some((audio) => !audio.paused),
  );
  await page.locator("#stop-speaking").click();
  await page.waitForFunction(() =>
    fixturePlayback.every((audio) => audio.paused),
  );
  const diagnosticGenerations = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).speechGenerations;
  assert.equal(
    diagnosticGenerations,
    1,
    "free test voice synthesizes exactly once",
  );
  // Local preflight must leave meeting lifecycle and ASR untouched.
  await page.locator("#check-audio").click();
  assert.equal(await page.locator("#audio-check-dialog").isVisible(), false);
  await page.locator("#consent").check();
  await page.locator("#audio-mode").selectOption("tab");
  await page.evaluate(() => {
    fixtureAudio.displayMode = "tab";
    fixtureAudio.streams = [];
  });
  const preflightSessions = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).speechSessions;
  await page.locator("#check-audio").click();
  await page.waitForFunction(() =>
    ["tab", "microphone"].every(
      (k) =>
        document.querySelector("#check-" + k + "-result").textContent ===
        "Audio signal detected.",
    ),
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    preflightSessions,
  );
  assert.equal(await page.locator("#phase").textContent(), "Ready");
  await page.locator("#stop-audio-check").click();
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  await page.locator("[data-close=audio-check-dialog]").click();
  await page.locator("#check-audio").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#audio-check-status").textContent ===
      "Check complete. Capture is off.",
    undefined,
    { timeout: 18000 },
  );
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  await page.locator("[data-close=audio-check-dialog]").click();
  await page.evaluate(() => {
    fixtureAudio.displayMode = "pending";
    fixtureAudio.streams = [];
  });
  await page.locator("#check-audio").click();
  await page.waitForFunction(
    () => typeof fixtureAudio.resolveDisplay === "function",
  );
  await page.locator("[data-close=audio-check-dialog]").click();
  await page.evaluate(() => fixtureAudio.resolveDisplay());
  await page.waitForFunction(() =>
    fixtureAudio.streams.every((s) =>
      s.getTracks().every((t) => t.readyState === "ended"),
    ),
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    preflightSessions,
  );
  await page.locator("#audio-mode").selectOption("microphone");
  await page.evaluate(() => (fixtureAudio.streams = []));
  await page.locator("#consent").check();
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#capture-label").textContent.includes("Listening"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".turn").length === 1,
  );
  const transport = await (
    await page.request.get(base + "/api/test/state")
  ).json();
  assert.ok(transport.totalBytes >= 16000);
  assert.ok(transport.energy > 1000000);
  assert.match(await page.locator("#transcript").textContent(), /Speaker A/);
  assert.equal(await page.locator("#partial").textContent(), "");
  await page.locator("#speakers [data-speaker]").first().click();
  await page.locator("#speaker-name").fill("Priya");
  await page.locator("#speaker-form [type=submit]").click();
  await page.locator("#speaker-dialog").waitFor({ state: "hidden" });
  assert.match(
    await page.locator(".turn-meta strong").first().textContent(),
    /Priya/,
  );
  await page.locator("#speakers [data-speaker]").first().click();
  await page.locator("#speaker-name").fill("");
  await page.locator("#speaker-form [type=submit]").click();
  await page.locator("#speaker-dialog").waitFor({ state: "hidden" });
  assert.match(
    await page.locator(".turn-meta strong").first().textContent(),
    /Speaker A · session 1/,
  );
  await page.locator("#speakers [data-speaker]").first().click();
  await page.locator("#speaker-name").fill("Priya");
  await page.locator("#speaker-form [type=submit]").click();
  await page.locator("#speaker-dialog").waitFor({ state: "hidden" });
  const snapshot = await (
    await page.request.get(base + `/api/meetings/${id}`)
  ).json();
  const sessionId = snapshot.turns[0].sessionId;
  await page.request.post(base + "/api/test/revision", {
    data: { meetingId: id, sessionId },
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#transcript")
      .textContent.includes("Friday at noon"),
  );
  assert.equal(await page.locator(".turn").count(), 1);
  const emit = async (type, data) =>
    page.request.post(base + "/api/test/event", {
      data: { meetingId: id, type, data },
    });
  await emit("assessment", {
    intervention: { text: "Unapproved recommendation" },
  });
  await page.waitForTimeout(200);
  assert.ok(
    !(await page.locator("#guidance").textContent()).includes("Unapproved"),
  );
  await page.locator("#request-guidance").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#guidance").textContent ===
      "Who owns the accessibility check?",
  );
  await page.locator("#dismiss").click();
  await page.waitForFunction(
    () => !document.querySelector("#guidance").textContent.includes("Who owns"),
  );
  await page.locator("#pause").click();
  await page.waitForFunction(
    () => document.querySelector("#pause").textContent === "Resume Rally",
  );
  await emit("intervention", {
    id: "late",
    text: "A late prompt while paused",
    kind: "redirect",
  });
  await page.waitForTimeout(100);
  assert.ok(
    !(await page.locator("#guidance").textContent()).includes("late prompt"),
  );
  await page.locator("#pause").click();
  await page.locator("#mute").click();
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    false,
  );
  await page.locator("#mute").click();
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    true,
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechGenerations,
    diagnosticGenerations,
    "meeting voice must be opt-in",
  );
  await page.locator("#spoken-prompts").check();
  await page.waitForTimeout(100);
  await page.locator("#request-guidance").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#speech-status")
      .textContent.includes("Rally is speaking"),
  );
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    false,
    "input shield applies before actual playback",
  );
  await page.waitForFunction(() =>
    fixturePlayback.some((audio) => !audio.paused),
  );
  await page.locator("#stop-speaking").click();
  await page.waitForFunction(() =>
    fixturePlayback.every((audio) => audio.paused),
  );
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    true,
    "cancel restores unmuted input",
  );
  await page.locator("#request-guidance").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#speech-status")
      .textContent.includes("Rally is speaking"),
  );
  await page.locator("#pause").click();
  await page.waitForFunction(() =>
    fixturePlayback.every((audio) => audio.paused),
  );
  await page.waitForFunction(
    () => document.querySelector("#pause").textContent === "Resume Rally",
  );
  await page.locator("#pause").click();
  await page.locator("#request-guidance").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#speech-status")
      .textContent.includes("Rally is speaking"),
  );
  await page.waitForFunction(
    () => document.querySelector("#stop-speaking").hidden,
    undefined,
    { timeout: 8000 },
  );
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    true,
  );
  await page.evaluate(() => (window.fixtureBlockPlayback = true));
  await page.locator("#request-guidance").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#speech-status")
      .textContent.includes("Fixture blocked playback"),
  );
  assert.equal(
    await page.evaluate(
      () => fixtureAudio.streams[0].getAudioTracks()[0].enabled,
    ),
    true,
  );
  assert.equal(await page.locator("#stop-speaking").isVisible(), false);
  await page.evaluate(() => (window.fixtureBlockPlayback = false));
  await page.locator("#spoken-prompts").uncheck();
  await mkdir(resolve(root, "test-results"), { recursive: true });
  await page.screenshot({
    path: resolve(root, "test-results/live-desktop.png"),
    fullPage: true,
  });
  // Reload releases local tracks; attaching to the existing room must not start another ASR session.
  const sessionsBeforeReload = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).speechSessions;
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#phase").textContent === "Live",
  );
  assert.equal(await page.locator("#start").textContent(), "Reconnect audio");
  await page.locator("#consent").check();
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#capture-label").textContent.includes("Listening"),
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    sessionsBeforeReload,
  );
  await page.locator("#end").click();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Processing",
  );
  await page.locator("#back").click();
  await page.waitForFunction(() => !document.querySelector("#home").hidden);
  await page.locator(`#history [data-meeting="${id}"]`).click();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Failed",
  );
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .reportAttempts,
    1,
  );
  await page.locator("#retry-report").click();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Ready",
  );
  assert.match(
    await page.locator("#report-body").textContent(),
    /4\/5 categories assessed/,
  );
  assert.match(await page.locator("#report-body").textContent(), /Unknown/);
  assert.match(
    await page.locator("#report-body").textContent(),
    /Input was shielded for Rally’s voice playback/,
  );
  assert.match(
    await page.locator("#report-body").textContent(),
    /Reported agreement/,
  );
  assert.ok(
    !(await page.locator("#report-body").textContent()).includes(
      "Confirmed by host",
    ),
  );
  await page.locator("#report-body [data-evidence]").first().click();
  assert.match(await page.locator(".turn.highlight").textContent(), /Friday/);
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .reportedTurns,
    2,
    "final drain must reach full report",
  );
  await page
    .locator("#correction-note")
    .fill("Host verified the final deadline is Friday at noon.");
  await page.locator("#correction-form [type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#report-body")
      .textContent.includes("Host correction:"),
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Ready",
  );
  assert.equal(await page.locator(".turn").count(), 2);
  assert.match(await page.locator("#transcript").textContent(), /Priya/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: resolve(root, "test-results/report-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: resolve(root, "test-results/report-desktop.png"),
    fullPage: true,
  });
  const exported = await (
    await page.request.get(base + `/api/meetings/${id}/export`)
  ).json();
  assert.equal(exported.turns.length, 2);
  assert.ok(exported.report.summary.includes("Host correction:"));
  const reportsBeforeCorrection = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).reportAttempts;
  await page.locator("#speakers [data-speaker]").first().click();
  await page.locator("#speaker-name").fill("");
  await page.locator("#speaker-form [type=submit]").click();
  await page.locator("#speaker-dialog").waitFor({ state: "hidden" });
  await page.waitForFunction(() =>
    document
      .querySelector("#report-status")
      .textContent.includes("needs refresh"),
  );
  assert.match(
    await page.locator("#report-body").textContent(),
    /names in existing conclusions may be outdated/,
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .reportAttempts,
    reportsBeforeCorrection,
  );
  await page.reload();
  await page.locator("#retry-report").waitFor({ state: "visible" });
  assert.match(await page.locator("#retry-report").textContent(), /uses Muse/);
  assert.match(
    await page.locator(".turn-meta strong").first().textContent(),
    /Speaker A · session 1/,
  );
  assert.equal(
    (await (await page.request.get(base + `/api/meetings/${id}/export`)).json())
      .reportStale,
    true,
  );
  await page.locator("#retry-report").click();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Ready",
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .reportAttempts,
    reportsBeforeCorrection + 1,
  );
  assert.match(
    await page.locator("#report-body").textContent(),
    /Host correction: Host verified the final deadline is Friday at noon/,
  );
  const modelCountsBeforeDraft = await (
    await page.request.get(base + "/api/test/state")
  ).json();
  await page.locator("#draft-follow-up").click();
  await page.locator("#follow-up-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#follow-up-text").inputValue(), "");
  assert.equal(
    await page.locator("#follow-up-whatsapp").getAttribute("href"),
    null,
  );
  await page.locator("#follow-up-choices input").first().check();
  assert.match(
    await page.locator("#follow-up-text").inputValue(),
    /Reported agreement/,
  );
  const manualDraft =
    "Reviewed follow-up ✓\nPriya: rollback Thursday at three.";
  await page.locator("#follow-up-text").fill(manualDraft);
  const waLink = new URL(
    await page.locator("#follow-up-whatsapp").getAttribute("href"),
  );
  assert.equal(waLink.origin, "https://wa.me");
  assert.equal(waLink.searchParams.get("text"), manualDraft);
  assert.equal(
    await page.locator("#follow-up-whatsapp").getAttribute("rel"),
    "noopener noreferrer",
  );
  await page.locator("#follow-up-text").fill("x".repeat(1501));
  assert.equal(
    await page.locator("#follow-up-whatsapp").getAttribute("href"),
    null,
  );
  await page.locator('[data-close="follow-up-dialog"]').click();
  await page.waitForFunction(
    () => document.querySelector("#follow-up-text").value === "",
  );
  const modelCountsAfterDraft = await (
    await page.request.get(base + "/api/test/state")
  ).json();
  assert.equal(
    modelCountsAfterDraft.reportAttempts,
    modelCountsBeforeDraft.reportAttempts,
  );
  assert.equal(
    modelCountsAfterDraft.speechSessions,
    modelCountsBeforeDraft.speechSessions,
  );
  // A different real cookie session cannot retrieve this meeting.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(base);
  await loginWithMFA(otherPage,"other_host","other-fixture-password");
  assert.equal(
    (await otherPage.request.get(base + `/api/meetings/${id}`)).status(),
    404,
  );
  await other.close();
  await page.locator("#delete").click();
  await page.locator("#confirm-delete").click();
  await page.waitForFunction(() => !document.querySelector("#home").hidden);
  assert.equal(
    (await page.request.get(base + `/api/meetings/${id}`)).status(),
    404,
  );
  // Preparation failure is a persisted draft; the UI never fabricates a plan.
  await page.request.post(base + "/api/test/prepare-failure", {
    data: { enabled: true },
  });
  await page.locator("#new-meeting").click();
  await page.locator("[name=title]").fill("Failed preparation");
  await page.locator("[name=agenda]").fill("Preparation failure check");
  await page.locator("#create-submit").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#meeting-title").textContent ===
      "Failed preparation",
  );
  assert.equal(await page.locator("#phase").textContent(), "Draft");
  assert.equal(await page.locator("#start").isDisabled(), true);
  assert.match(
    await page.locator("#record-error").textContent(),
    /Fixture agenda failure/,
  );
  await page.request.post(base + "/api/test/prepare-failure", {
    data: { enabled: false },
  });
  await page.locator("#prepare").click();
  await page.waitForFunction(
    () => document.querySelector("#phase").textContent === "Ready",
  );
  // Invalid/canceled browser selections must not open a new ASR session.
  await page.locator("#audio-mode").selectOption("tab");
  await page.locator("#consent").check();
  const beforeTab = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).speechSessions;
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("No tab audio"),
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    beforeTab,
  );
  await page.evaluate(() => (fixtureAudio.displayMode = "screen"));
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#toast")
      .textContent.includes("rather than a screen"),
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    beforeTab,
  );
  await page.evaluate(() => (fixtureAudio.displayMode = "pending"));
  await page.locator("#start").click();
  await page.waitForFunction(
    () => typeof fixtureAudio.resolveDisplay === "function",
  );
  await page.locator("#cancel-start").click();
  await page.evaluate(() => fixtureAudio.resolveDisplay());
  await page.waitForFunction(
    () => document.querySelector("#cancel-start").hidden,
  );
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    beforeTab,
  );
  await page.evaluate(() => {
    fixtureAudio.displayMode = "tab";
    fixtureAudio.streams = [];
  });
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#capture-label").textContent.includes("Listening"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".turn").length === 1,
  );
  const tabId = await page.evaluate(() => location.hash.split("/")[1]);
  await page.request.post(base + "/api/test/event", {
    data: {
      meetingId: tabId,
      type: "capture.gap",
      data: { reason: "Fixture upstream transcription failure" },
    },
  });
  await page.waitForFunction(
    () => !document.querySelector("#start-panel").hidden,
  );
  assert.equal(await page.locator("#restart-session").isChecked(), true);
  assert.equal(await page.locator("#consent").isChecked(), false);
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  const beforeRestart = (
    await (await page.request.get(base + "/api/test/state")).json()
  ).speechSessions;
  await page.locator("#logout").click();
  await page.locator("#auth-screen").waitFor({ state: "visible" });
  await loginWithMFA(page,"frontend_test","fixture-password-only");
  await page.goto(base + "/#meeting/" + tabId);
  await page.locator("#retry-report").waitFor({ state: "visible" });
  await page.locator("#retry-report").click();
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Ready",
  );
  await page.locator("#audio-mode").selectOption("tab");
  await page.evaluate(() => {
    fixtureAudio.displayMode = "tab";
    fixtureAudio.streams = [];
  });
  await page.locator("#consent").check();
  await page.locator("#start").click();
  await page.waitForFunction(() =>
    document.querySelector("#capture-label").textContent.includes("Listening"),
  );
  await page.waitForFunction(
    () => document.querySelectorAll(".turn").length === 3,
  );
  assert.equal(
    (await (await page.request.get(base + "/api/test/state")).json())
      .speechSessions,
    beforeRestart + 1,
  );
  assert.match(
    await page.locator("#report-status").textContent(),
    /needs refresh/,
  );
  assert.match(
    await page.locator("#report-body").textContent(),
    /earlier transcript/,
  );
  assert.equal(await page.locator("#retry-report").isVisible(), false);
  assert.equal(await page.locator("#draft-follow-up").isVisible(), false);

  assert.match(await page.locator("#speakers").textContent(), /Speaker A/);
  assert.equal(
    await page.locator("#speakers [data-speaker]").count(),
    2,
    "A labels remain distinct across ASR sessions",
  );
  await page.evaluate(() => {
    for (const stream of fixtureAudio.streams) {
      const video = stream.getVideoTracks()[0];
      if (video && video.readyState === "live") {
        video.dispatchEvent(new Event("ended"));
        break;
      }
    }
  });
  await page.waitForFunction(
    () => document.querySelector("#phase").textContent === "Ended",
  );
  assert.equal(
    await page.evaluate(() =>
      fixtureAudio.streams.every((s) =>
        s.getTracks().every((t) => t.readyState === "ended"),
      ),
    ),
    true,
  );
  await page.waitForFunction(
    () => document.querySelector("#report-status").textContent === "Ready",
  );
  await context.clearCookies();
  await page.evaluate(() => document.querySelector("#usage-button").click());
  await page.locator("#auth-screen").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#meeting-title").textContent === "",
  );
  assert.equal(await page.locator("#transcript").textContent(), "");
  assert.equal(await page.locator("#report-body").textContent(), "");
  await loginWithMFA(page,"frontend_test","fixture-password-only");
  await page.waitForFunction(
    () => document.querySelector("#phase").textContent === "Ended",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#mobile-logout").click();
  await page.locator("#auth-screen").waitFor({ state: "visible" });
  await page.reload();
  await page.locator("#auth-screen").waitFor({ state: "visible" });
  assert.equal((await page.request.get(base + "/api/auth/me")).status(), 401);
  assert.deepEqual(errors, []);
  const report = {
    testedAt: new Date().toISOString(),
    passed: true,
    backend: "real Express/cookie auth/SQLite and LiveKit",
    modelProviders: "injected deterministic fixtures for reasoning and ASR",
    speechEngine:
      process.env.RALLY_TEST_REAL_MMS === "1"
        ? "real pinned local Meta MMS"
        : "synthetic tone fixture",
    syntheticAudio: true,
    paidModelCalls: 0,
    checks: [
      "mandatory MFA enrollment/recovery, login/logout, cookie expiry and private UI cleanup",
      "agenda edit and failed preparation retry",
      "actual browser audio reaches backend",
      "reload reconnects without duplicating ASR sessions",
      "canonical final revisions, reversible session-scoped names, stale-report disclosure and explicit reanalysis",
      "approved intervention only, pause/dismiss and mute",
      "end stops tracks and drains final turn into complete report",
      "visible report failure and explicit retry",
      "leave and reopen a processing report",
      "nullable scores and assessed coverage",
      "evidence links, host correction, reload and export",
      "cross-owner denial and deletion",
      "mobile layout",
      "host-selected WhatsApp draft, uncertainty preserved, editable encoded text, length guard and private close cleanup without model requests",
      "opt-in browser WAV playback, Stop speaking, Pause and completion restore shielded input",
      "free preflight detects separate sources, rejects missing consent, stops manually/after 15s and closes late grants without ASR",
      "Teams invite validation, lobby, leave and finalized transcript import via injected bridge",
      "tab rejection/cancellation stops tracks before ASR",
      "capture gap stops audio; explicit restart uses new speaker session",
      "reviewing an interrupted capture then resuming marks the prior report stale and withholds follow-up/reanalysis until capture ends",
      "stopping tab sharing ends capture and finalizes the meeting",
    ],
  };
  await writeFile(
    resolve(
      root,
      process.env.RALLY_TEST_REAL_MMS === "1"
        ? "test-results/real-mms-browser-check.json"
        : "test-results/browser-check.json",
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.log(
    JSON.stringify(
      await debugPage?.evaluate(() => ({
        error: document.querySelector("#record-error")?.textContent,
        status: document.querySelector("#connection-status")?.textContent,
        toast: document.querySelector("#toast")?.textContent,
        phase: document.querySelector("#phase")?.textContent,
        speech: document.querySelector("#speech-status")?.textContent,
      })),
      null,
      2,
    ),
  );
  throw error;
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
}
