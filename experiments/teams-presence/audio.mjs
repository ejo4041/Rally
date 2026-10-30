import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
export async function privateAudio(signal) {
  signal?.throwIfAborted();
  const dir = join(tmpdir(), "rally-presence-" + randomUUID());
  await mkdir(dir, { mode: 0o700 });
  const socket = join(dir, "pulse");
  const config = join(dir, "pulse.pa");
  await writeFile(
    config,
    `load-module module-native-protocol-unix socket=${socket} auth-anonymous=0\nload-module module-null-sink sink_name=rally_teams_in rate=48000 channels=1 channel_map=mono\nload-module module-null-sink sink_name=rally_teams_out rate=48000 channels=1 channel_map=mono\nload-module module-remap-source master=rally_teams_out.monitor source_name=rally_teams_mic channels=1 master_channel_map=mono channel_map=mono\nset-default-sink rally_teams_in\nset-default-source rally_teams_mic\n`,
    { mode: 0o600 },
  );
  const pulse = spawn(
    "pulseaudio",
    [
      "-n",
      `--file=${config}`,
      "--daemonize=no",
      "--exit-idle-time=-1",
      "--use-pid-file=no",
    ],
    { stdio: "ignore" },
  );
  const cancel = () => pulse.kill("SIGTERM");
  signal?.addEventListener("abort", cancel, { once: true });
  const env = {
    ...process.env,
    PULSE_SERVER: "unix:" + socket,
    PULSE_SINK: "rally_teams_in",
    PULSE_SOURCE: "rally_teams_mic",
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1500);
      pulse.once("error", reject);
      pulse.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Private audio exited"));
      });
    });
  } catch (error) {
    pulse.kill("SIGTERM");
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  if (signal?.aborted) {
    pulse.kill("SIGTERM");
    await rm(dir, { recursive: true, force: true });
    throw new Error("Audio canceled");
  }
  return {
    env,
    dir,
    source(name) {
      return spawn(
        "parec",
        [
          "--raw",
          "--format=s16le",
          "--rate=16000",
          "--channels=1",
          "--latency-msec=20",
          "--device=" + name,
        ],
        { env, stdio: ["ignore", "pipe", "ignore"] },
      );
    },
    async close() {
      signal?.removeEventListener("abort", cancel);
      pulse.kill("SIGTERM");
      await rm(dir, { recursive: true, force: true });
    },
  };
}
/** Five spectral bands from the actual outgoing monitor, never participant audio. */
export function voiceFeatures() {
  const cuts = [250, 600, 1500, 3500],
    low = [0, 0, 0, 0];
  let epoch = 1;
  return {
    reset() {
      epoch++;
      low.fill(0);
    },
    sample(pcm) {
      const sums = [0, 0, 0, 0, 0];
      let total = 0;
      for (let i = 0; i + 1 < pcm.length; i += 2) {
        const x = pcm.readInt16LE(i) / 32768;
        total += x * x;
        let previous = 0;
        for (let b = 0; b < 4; b++) {
          const alpha = 1 - Math.exp((-2 * Math.PI * cuts[b]) / 16000);
          low[b] += alpha * (x - low[b]);
          const band = low[b] - previous;
          sums[b] += band * band;
          previous = low[b];
        }
        sums[4] += (x - previous) ** 2;
      }
      const count = Math.max(1, pcm.length / 2),
        level = Math.min(1, Math.sqrt(total / count) * 4);
      return {
        level,
        phrase: level,
        bands: sums.map((v) => Math.min(1, Math.sqrt(v / count) * 6)),
        sourceEpoch: epoch,
        timestamp: 0,
      };
    },
  };
}
