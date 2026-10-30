import { spawn } from "node:child_process";
import { chromium } from "playwright";
export const chrome =
  process.env.RALLY_CHROMIUM ||
  "/home/hack/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
export async function display(width, height, signal) {
  signal?.throwIfAborted();
  const child = spawn(
    "Xvfb",
    [
      "-displayfd",
      "3",
      "-screen",
      "0",
      `${width}x${height}x24`,
      "-nolisten",
      "tcp",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe"] },
  );
  const cancel = () => child.kill("SIGTERM");
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const name = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Display startup timed out")),
        10000,
      );
      let output = "";
      child.stdio[3].on("data", (b) => {
        output += b;
        if (output.includes("\n")) {
          clearTimeout(timer);
          resolve(":" + output.trim());
        }
      });
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Display exited"));
      });
    });
    return {
      name,
      close() {
        signal?.removeEventListener("abort", cancel);
        child.kill("SIGTERM");
      },
    };
  } catch (e) {
    child.kill("SIGTERM");
    throw e;
  }
}
export async function createCamera({
  origin,
  scene,
  device = process.env.RALLY_VIDEO_DEVICE || "/dev/video42",
  onFailure = () => {},
  signal,
}) {
  // Pinned Chromium on bare Xvfb leaves one pixel outside its fullscreen window.
  // Oversize the display by one; verify exact content geometry before capture.
  const screen = await display(1921, 1081, signal);
  let browser,
    producer,
    closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    producer?.kill("SIGTERM");
    await browser?.close().catch(() => {});
    screen.close();
  };
  signal?.addEventListener(
    "abort",
    () => {
      void close();
    },
    { once: true },
  );
  try {
    signal?.throwIfAborted();
    browser = await chromium.launch({
      headless: false,
      executablePath: chrome,
      env: { ...process.env, DISPLAY: screen.name },
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=gl",
        "--ignore-gpu-blocklist",
        "--disable-gpu-sandbox",
        "--autoplay-policy=no-user-gesture-required",
        "--kiosk",
        "--force-device-scale-factor=1",
        "--window-size=1921,1081",
        "--window-position=0,0",
      ],
    });
    if (signal?.aborted) {
      await browser.close();
      throw new Error("Renderer canceled");
    }
    browser.on("disconnected", () => {
      if (!closed) onFailure("Renderer exited");
    });
    const page = await browser.newPage({
      viewport: null,
    });
    await page.goto(new URL("/renderer.html", origin).href, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => !!window.rallyRenderer);
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send("Browser.getWindowForTarget");
    await session.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "fullscreen" },
    });
    await page.evaluate(() => document.documentElement.requestFullscreen());
    await session.detach();
    await page.waitForFunction(
      () =>
        innerWidth === 1920 &&
        innerHeight === 1080 &&
        outerWidth === innerWidth &&
        outerHeight === innerHeight &&
        screenX === 0 &&
        screenY === 0,
      undefined,
      { timeout: 5000 },
    );
    await page.evaluate((scene) => window.rallyRenderer.preview(scene), scene);
    if (
      !(await page.evaluate(
        () => !!document.querySelector(".rally-silk canvas"),
      ))
    )
      throw new Error("WebGL2 renderer unavailable");
    // Full display capture includes the silk's CSS backdrop and all topic/caption DOM.
    signal?.throwIfAborted();
    producer = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "x11grab",
        "-draw_mouse",
        "0",
        "-framerate",
        "30",
        "-video_size",
        "1920x1080",
        "-i",
        screen.name + ".0",
        "-an",
        "-vf",
        "format=yuv420p",
        "-f",
        "v4l2",
        device,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let failure = "";
    producer.stderr.on("data", (b) => {
      failure = (failure + String(b)).slice(-1000);
    });
    producer.on("error", () => onFailure("Camera producer failed"));
    producer.on("exit", () => {
      if (!closed) onFailure("Camera producer exited");
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1000);
      producer.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Camera producer failed: " + failure));
      });
    });
    return {
      page,
      close,
      connect: (token) =>
        page.evaluate((token) => window.rallyRenderer.connect(token), token),
      voice: (frame) =>
        page.evaluate((frame) => window.rallyRenderer.voice(frame), frame),
    };
  } catch (e) {
    await close();
    throw e;
  }
}
