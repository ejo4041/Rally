import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/** Both legacy and presence services must hold this before polling or launching. */
export async function acquireTeamsLock(
  onLost = () => process.kill(process.pid, "SIGTERM"),
) {
  const path =
    process.env.RALLY_TEAMS_LOCK ||
    (existsSync("/srv/hackathon/rally-deployed/state")
      ? "/srv/hackathon/rally-deployed/state/teams.lock"
      : join(
          existsSync(`/run/user/${process.getuid?.()}`)
            ? `/run/user/${process.getuid?.()}`
            : tmpdir(),
          `rally-teams-${process.getuid?.() ?? "service"}.lock`,
        ));
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
  let released = false;
  const release = () => {
    released = true;
    process.removeListener("exit", release);
    child.stdin.end();
  };
  child.once("exit", () => {
    if (!released) onLost();
  });
  process.once("exit", release);
  return release;
}
