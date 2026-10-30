import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Both legacy and presence services must hold this before polling or launching. */
export async function acquireTeamsLock() {
  const path =
    process.env.RALLY_TEAMS_LOCK ||
    join(tmpdir(), `rally-teams-${process.getuid?.() ?? "service"}.lock`);
  const child = spawn(
    "flock",
    ["--nonblock", path, "sh", "-c", "echo acquired; cat >/dev/null"],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("Teams lock timed out"));
      }
    }, 3000);
    child.stdout.once("data", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("Another Teams runner owns this host"));
      }
    });
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });
  });
  child.once("exit", () => process.kill(process.pid, "SIGTERM"));
  process.once("exit", () => child.stdin.end());
  return () => child.stdin.end();
}
