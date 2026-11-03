import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

export function loadEnvironment() {
  let shared = process.env.RALLY_ENV_FILE;
  if (!shared) {
    try {
      const common = execFileSync(
        "git",
        ["rev-parse", "--path-format=absolute", "--git-common-dir"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      shared = resolve(dirname(common), ".env.local");
    } catch {
      /* Standalone distribution can use the explicit path or environment. */
    }
  }
  if (shared && existsSync(shared)) {
    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(shared, "utf8")),
    ))
      process.env[key] ??= value;
  }
}

export const defaults = {
  dbPath: ".data/rally.sqlite",
  origins: ["http://localhost:5173", "http://127.0.0.1:5173"],
  secureCookies: false,
  mfaKey: "",
  realtimeEnabled: false,
  reportReserve: 0.25,
  teamsDuplexEnabled: false,
  assessmentMs: 10000,
  cooldownMs: 45000,
  asrRotationMs: 55 * 60000,
  captureLeaseMs: 90000,
  capacity: 5,
  meetingBudget: 2,
  buildBudget: 5,
  paidEnabled: false,
  allowUnknownCostEstimates: false,
  livekitUrl: "ws://127.0.0.1:7880",
  livekitPublicUrl: "",
  livekitKey: "devkey",
  livekitSecret: "secret",
};
export type Configuration = typeof defaults;
export function environmentConfig(): Configuration {
  const number = (key: string, fallback: number) => {
    const value =
      process.env[key] === undefined ? fallback : Number(process.env[key]);
    if (!Number.isFinite(value) || value <= 0)
      throw new Error(`Invalid ${key}`);
    return value;
  };
  return {
    ...defaults,
    dbPath: process.env.RALLY_DB_PATH || defaults.dbPath,
    origins:
      process.env.RALLY_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ||
      defaults.origins,
    secureCookies: process.env.RALLY_SECURE_COOKIES === "1",
    mfaKey: process.env.RALLY_MFA_KEY || "",
    paidEnabled: process.env.RALLY_PAID_ENABLED === "1",
    allowUnknownCostEstimates: process.env.RALLY_ALLOW_UNKNOWN_COST_ESTIMATES === "1",
    teamsDuplexEnabled: process.env.RALLY_TEAMS_DUPLEX_ENABLED === "1",
    reportReserve: number("RALLY_REPORT_RESERVE", 0.25),
    realtimeEnabled: process.env.RALLY_REALTIME_ENABLED === "1",
    assessmentMs: number("RALLY_ASSESSMENT_MS", 10000),
    cooldownMs: number("RALLY_COOLDOWN_MS", 45000),
    asrRotationMs: number("RALLY_ASR_ROTATION_MS", 55 * 60000),
    captureLeaseMs: number("RALLY_CAPTURE_LEASE_MS", 90000),
    capacity: number("RALLY_CAPACITY", 5),
    meetingBudget: number("RALLY_MEETING_BUDGET", 2),
    buildBudget: number("RALLY_BUILD_BUDGET", 5),
    livekitUrl: process.env.LIVEKIT_URL || defaults.livekitUrl,
    livekitPublicUrl: process.env.LIVEKIT_PUBLIC_URL || "",
    livekitKey: process.env.LIVEKIT_API_KEY || defaults.livekitKey,
    livekitSecret: process.env.LIVEKIT_API_SECRET || defaults.livekitSecret,
  };
}
