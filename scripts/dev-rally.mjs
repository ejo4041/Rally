// Starts the separate Node backend/media and the integrated frontend locally.
// Paid processing is explicitly off unless enabled in the calling environment.
import { loadEnvironment } from "../apps/rally-api/src/config.ts";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.RALLY_ENV_FILE ||= fileURLToPath(new URL("../.env.local", import.meta.url));
loadEnvironment();
const root = new URL("../", import.meta.url),
  children = [];
const apiPort = process.env.PORT || "3001",
  webPort = process.env.RALLY_WEB_PORT || "5173";
const env = {
  ...process.env,
  RALLY_PAID_ENABLED: process.env.RALLY_PAID_ENABLED || "0",
  RALLY_ALLOWED_ORIGINS:
    process.env.RALLY_ALLOWED_ORIGINS ||
    `http://127.0.0.1:${webPort},http://localhost:${webPort}`,
};
let stopping = false;
function start(path, script, extra = {}) {
  const child = spawn(process.execPath, [script], {
    cwd: fileURLToPath(new URL(path, root)),
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill("SIGTERM");
  const deadline = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
  }, 12000);
  deadline.unref();
}
start("apps/rally-api/", "scripts/dev.ts", { PORT: apiPort });
start("apps/rally-web/", "scripts/dev.mjs", {
  RALLY_WEB_PORT: webPort,
  RALLY_API_URL: process.env.RALLY_API_URL || `http://127.0.0.1:${apiPort}`,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
console.log(
  `Rally workspace: http://127.0.0.1:${webPort} · paid models ${env.RALLY_PAID_ENABLED === "1" ? "enabled" : "disabled"}`,
);
