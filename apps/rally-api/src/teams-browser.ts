import {postTeamsSummary} from "./teams-summary.ts";
import { PlayoutClock } from "./playout-clock.ts";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import type { TeamsConnector } from "./teams-live.ts";
import type { Scene } from "../../../packages/rally-presence/scene.ts";
type VisualHooks = { scene(): Scene; voice(frame: unknown): void };

// Transport only: all model calls and accounting remain in the meeting engine.
export const connectTeamsBrowser = async (
  url: string,
  signal: AbortSignal,
  onState: (state: string) => void,
  meeting?: import("./contracts.ts").Meeting,
  visual?: VisualHooks,
): ReturnType<TeamsConnector> => {
  const { chromium } = await import("playwright");
  const state = await mkdtemp(join(tmpdir(), "rally-teams-"));
  let child: ChildProcess | undefined,
    browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  let receiver: ChildProcess | undefined, player: ChildProcess | undefined;
  let renew: ReturnType<typeof setInterval> | undefined,
    inspect: ReturnType<typeof setInterval> | undefined;
  let closed = false,
    connected = false,
    checking = false,
    lastInputAt = 0,
    lastOutputAt = 0;
  let camera: any,
    cameraTimer: ReturnType<typeof setInterval> | undefined,
    releaseLock: (() => void) | undefined;
  let outputMonitor: ChildProcess | undefined;
  const audioEnv: NodeJS.ProcessEnv = { ...process.env };
  const kill = async (proc: ChildProcess | undefined) => {
    if (
      !proc ||
      !proc.pid ||
      proc.exitCode !== null ||
      proc.signalCode !== null
    )
      return;
    proc.kill("SIGTERM");
    const timer = setTimeout(() => proc.kill("SIGKILL"), 2000);
    await once(proc, "exit").catch(() => {});
    clearTimeout(timer);
  };
  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      closed = true;
      connected = false;
      clearInterval(renew);
      clearInterval(inspect);
      clearInterval(cameraTimer);
      signal.removeEventListener("abort", abort);
      await Promise.allSettled([
        kill(receiver),
        kill(player),
        kill(outputMonitor),
      ]);
      await browser?.close().catch(() => {});
      if (child?.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {}
      }
      await kill(child);
      await camera?.close();
      releaseLock?.();
      await rm(state, { recursive: true, force: true });
    })();
    return closePromise;
  };
  const abort = () => {
    void close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const lockModule = new URL(
      "../../../experiments/teams-common/lock.mjs",
      import.meta.url,
    ).href;
    const { acquireTeamsLock } = await import(lockModule);
    signal.throwIfAborted();
    if (closed) throw new Error("Teams canceled");
    const acquiredLock = await acquireTeamsLock(() => {
      connected = false;
      void close();
    });
    if (closed || signal.aborted) {
      acquiredLock();
      throw new Error("Teams canceled");
    }
    releaseLock = acquiredLock;
    if (visual && process.env.RALLY_PRESENCE_VIDEO_ENABLED === "1") {
      const cameraModule = new URL(
        "../../../experiments/teams-presence/camera.mjs",
        import.meta.url,
      ).href;
      const { createCamera } = await import(cameraModule);
      camera = await createCamera({
        origin: process.env.RALLY_PRESENCE_ORIGIN || "http://127.0.0.1:6772",
        scene: visual.scene(),
        signal,
        onFailure: () => {
          connected = false;
          void close();
        },
      });
      let updating = false;
      cameraTimer = setInterval(() => {
        if (updating || closed) return;
        updating = true;
        void camera.page
          .evaluate((scene: Scene) => {
            const renderer = (window as any).rallyRenderer;
            if (!renderer?.healthy()) throw new Error("Renderer unavailable");
            renderer.preview(scene);
          }, visual.scene())
          .catch(() => {
            connected = false;
            void close();
          })
          .finally(() => {
            updating = false;
          });
      }, 250);
    }
    await writeFile(join(state, "meeting.url"), url, { mode: 0o600 });
    signal.throwIfAborted();
    if (closed) throw new Error("Teams closed");
    child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL(
            "../../../experiments/teams-web-client/session.mjs",
            import.meta.url,
          ),
        ),
      ],
      {
        env: {
          ...process.env,
          RALLY_TEAMS_STATE: state,
          RALLY_TEAMS_DEBUG_PORT: "9227",
          RALLY_PLAYWRIGHT_MODULE: new URL(
            "../node_modules/playwright/index.mjs",
            import.meta.url,
          ).href,
        },
        stdio: "ignore",
        detached: true,
      },
    );
    child.on("error", () => {
      connected = false;
    });
    child.on("exit", () => {
      connected = false;
    });
    const deadline = Date.now() + 60000;
    while (!browser && Date.now() < deadline) {
      signal.throwIfAborted();
      if (closed) throw new Error("Teams closed");
      try {
        browser = await chromium.connectOverCDP("http://127.0.0.1:9227", {
          timeout: 1000,
        });
      } catch {
        await delay(250, undefined, { signal });
      }
    }
    if (!browser) throw new Error("Teams browser startup timed out");
    if (closed) {
      await browser.close();
      throw new Error("Teams canceled");
    }
    Object.assign(
      audioEnv,
      JSON.parse(await readFile(join(state, "audio-env.json"), "utf8")),
    );
    const heartbeat = () =>
      writeFile(
        join(state, "join-deadline.json"),
        JSON.stringify({ deadline: Date.now() + 90000 }),
        { mode: 0o600 },
      );
    await heartbeat();
    renew = setInterval(() => {
      void heartbeat().catch(() => {
        connected = false;
        void close();
      });
    }, 20000);
    renew.unref();
    const page = browser.contexts()[0].pages()[0];
    await page
      .getByPlaceholder("Type your name", { exact: true })
      .waitFor({ timeout: 45000 });
    signal.throwIfAborted();
    const warning = page.getByRole("button", {
      name: "Continue without audio or video",
      exact: true,
    });
    if (await warning.isVisible().catch(() => false)) await warning.click();
    await page
      .getByPlaceholder("Type your name", { exact: true })
      .fill("Rally");
    const video = page.locator('[data-tid="toggle-video"]');
    if (camera) await video.check({ timeout: 5000 });
    else await video.uncheck({ timeout: 3000 }).catch(() => {});
    await page
      .getByRole("radio", { name: "Computer audio", exact: true })
      .check();
    const mic = page.locator('[data-tid="toggle-mute"]');
    if (!(await mic.isChecked())) await mic.check();
    signal.throwIfAborted();
    await page
      .getByRole("button", { name: /^Join (now|meeting)$/i })
      .first()
      .click({ timeout: 10000 });
    onState("lobby");
    const isConnected = () =>
      page.evaluate(
        () =>
          ((window as any).__rallyPeers || []).some(
            (p: any) => p.connectionState === "connected",
          ) &&
          [...document.querySelectorAll("button")].some((b) =>
            /^(Leave|Hang up)(\b|$)/i.test(
              b.getAttribute("aria-label") || b.textContent || "",
            ),
          ),
      );
    const admissionDeadline = Date.now() + 300000;
    while (!connected && Date.now() < admissionDeadline) {
      signal.throwIfAborted();
      if (closed) throw new Error("Teams closed");
      connected = await isConnected();
      if (!connected) await delay(500, undefined, { signal });
    }
    if (!connected) throw new Error("Teams admission timed out");
    if (camera && visual) {
      const audioModule = new URL(
        "../../../experiments/teams-presence/audio.mjs",
        import.meta.url,
      ).href;
      const { voiceFeatures } = await import(audioModule);
      let sequence = 0,
        busy = false,
        pending = Buffer.alloc(0);
      const features = voiceFeatures();
      lastOutputAt = performance.now();
      outputMonitor = spawn(
        "parec",
        [
          "--device=rally_teams_out.monitor",
          "--raw",
          "--format=s16le",
          "--rate=16000",
          "--channels=1",
          "--latency-msec=20",
        ],
        { env: audioEnv, stdio: ["ignore", "pipe", "ignore"] },
      );
      outputMonitor.on("error", () => {
        connected = false;
        void close();
      });
      outputMonitor.on("exit", () => {
        if (!closed) {
          connected = false;
          void close();
        }
      });
      outputMonitor.stdout!.on("data", (bytes: Buffer) => {
        lastOutputAt = performance.now();
        pending = Buffer.concat([pending, bytes]);
        if (pending.length < 1600) return;
        const samples = pending.subarray(-1600);
        pending = Buffer.alloc(0);
        const frame = {
          ...features.sample(samples),
          sequence: ++sequence,
          captureEpoch: visual.scene().captureEpoch,
        };
        visual.voice(frame);
        if (!busy && !closed) {
          busy = true;
          void camera
            .voice(frame)
            .catch(() => {
              connected = false;
              void close();
            })
            .finally(() => {
              busy = false;
            });
        }
      });
    }
    inspect = setInterval(() => {
      if (outputMonitor && performance.now() - lastOutputAt > 2000) {
        connected = false;
        void close();
        return;
      }
      if (receiver && lastInputAt && performance.now() - lastInputAt > 2000) {
        connected = false;
        void close();
        return;
      }
      if (checking || closed) return;
      checking = true;
      const timer = setTimeout(() => {
        connected = false;
      }, 5000);
      void isConnected()
        .then((value) => {
          connected = value;
        })
        .catch(() => {
          connected = false;
        })
        .finally(() => {
          clearTimeout(timer);
          checking = false;
        });
    }, 2000);
    inspect.unref();
    return {
      alive: () => !closed && connected,
      receive(audio, gap) {
        receiver = spawn(
          "parec",
          [
            "--device=rally_teams_in.monitor",
            "--raw",
            "--format=s16le",
            "--rate=16000",
            "--channels=1",
            "--latency-msec=20",
          ],
          { env: audioEnv, stdio: ["ignore", "pipe", "ignore"] },
        );
        let pending = Buffer.alloc(0),
          last = performance.now();
        lastInputAt = last;
        receiver.stdout!.on("data", (bytes: Buffer) => {
          const now = performance.now();
          if (now - last > 1000) {
            pending = Buffer.alloc(0);
            connected = false;
            gap("Teams audio stalled");
            return;
          }
          last = now;
          lastInputAt = now;
          pending = Buffer.concat([pending, bytes]);
          if (pending.length > 32000) {
            pending = Buffer.alloc(0);
            connected = false;
            gap("Teams audio backlog discarded");
            return;
          }
          while (pending.length >= 640) {
            audio(pending.subarray(0, 640));
            pending = pending.subarray(640);
          }
        });
        receiver.on("error", () => {
          connected = false;
          gap("Teams audio capture failed");
        });
        receiver.on("exit", () => {
          if (!closed) {
            connected = false;
            gap("Teams audio capture stopped");
          }
        });
        return () => {
          void kill(receiver);
        };
      },
      async play(chunks, playSignal, beforeAudio, onProgress) {
        if (closed || !connected) throw new Error("Teams disconnected");
        const clock = new PlayoutClock();
        let measured = 0,
          lastProgress = 0,
          written = 0;
        const monitor = onProgress
          ? spawn(
              "parec",
              [
                "--device=rally_teams_out.monitor",
                "--raw",
                "--format=s16le",
                "--rate=16000",
                "--channels=1",
                "--latency-msec=20",
              ],
              { env: audioEnv, stdio: ["ignore", "pipe", "ignore"] },
            )
          : undefined;
        monitor?.on("error", () => {});
        monitor?.stdout!.on("data", (data: Buffer) => {
          const value = clock.observe(data, written);
          if (value === undefined || playSignal.aborted) return;
          measured = Math.min(value, written / 32);
          if (performance.now() - lastProgress >= 200) {
            lastProgress = performance.now();
            onProgress?.(measured);
          }
        });
        const proc = spawn(
          "paplay",
          [
            "--device=rally_teams_out",
            "--raw",
            "--format=s16le",
            "--rate=16000",
            "--channels=1",
            "--latency-msec=20",
          ],
          { env: audioEnv, stdio: ["pipe", "ignore", "ignore"] },
        );
        player = proc;
        let failed: Error | undefined;
        proc.on("error", (e) => (failed = e));
        proc.stdin!.on("error", (e) => (failed = e));
        const completion = once(proc, "exit");
        void completion.catch(() => {});
        const stop = () => {
          proc.kill("SIGTERM");
        };
        playSignal.addEventListener("abort", stop, { once: true });
        try {
          let started = false;
          for await (const part of chunks) {
            playSignal.throwIfAborted();
            if (!connected || closed || failed)
              throw failed || new Error("Teams disconnected");
            if (!started) {
              beforeAudio();
              started = true;
            }
            written += part.length;
            if (!proc.stdin!.write(part))
              await once(proc.stdin!, "drain", { signal: playSignal });
          }
          proc.stdin!.end();
          const [code] = await completion;
          if (measured > 0) onProgress?.(measured);
          if (code !== 0 || failed)
            throw failed || new Error("Teams playback failed");
        } finally {
          playSignal.removeEventListener("abort", stop);
          await kill(proc);
          await kill(monitor);
          if (player === proc) player = undefined;
        }
      },
      async finish(summaryUrl) {
        clearInterval(inspect);
        const started=Date.now();
        const chat=await postTeamsSummary(page,summaryUrl);
        // Keep the camera rendering long enough to make the transition visible.
        await delay(Math.max(0,3000-(Date.now()-started)),undefined,{signal});
        onState('leaving');
        const leave=page.getByRole('button',{name:/^(Leave|Hang up)(\b|$)/i}).first();
        await leave.click({timeout:1500}).catch(()=>{});
        return chat;
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
};
