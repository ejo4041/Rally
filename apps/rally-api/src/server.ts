import { loadEnvironment, environmentConfig } from "./config.ts";
import { createApplication } from "./app.ts";
loadEnvironment();
const api = createApplication(environmentConfig());
const host = process.env.RALLY_HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3001);
const server = api.app.listen(port, host, () =>
  console.log(`Rally API listening on http://${host}:${port}`),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close();
  await api.close();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
