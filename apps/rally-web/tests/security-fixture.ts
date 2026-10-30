// Local synthetic-data-only fixture; binds loopback, never loads deployment secrets.
import { createApplication } from "../../rally-api/src/app.ts";
import { Store } from "../../rally-api/src/store.ts";
import { createUser } from "../../rally-api/src/auth.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const express = createRequire(
  new URL("../../rally-api/package.json", import.meta.url),
)("express");
const folder = mkdtempSync(join(tmpdir(), "rally-security-web-")),
  dbPath = join(folder, "db");
const api = createApplication({
  dbPath,
  mfaKey: "98".repeat(32),
  origins: ["http://127.0.0.1:3457"],
  providers: {
    prepare: async () => ({
      objective: "Synthetic judge test",
      durationMinutes: 5,
      wrapMinutes: 1,
      topics: [
        {
          id: "one",
          title: "Synthetic",
          outcome: "Review",
          minutes: 4,
          status: "pending",
        },
      ],
    }),
  },
});
const store = new Store(dbPath);
const admin = await createUser(store, "admin_test", "test-password-123");
store.db
  .prepare("UPDATE user_security SET role='admin' WHERE user_id=?")
  .run(admin.id);
store.close();
api.app.use(express.static(new URL("../dist", import.meta.url).pathname));
const server = api.app.listen(3457, "127.0.0.1", () =>
  console.log("Security fixture ready"),
);
process.on("SIGTERM", () => {
  server.close();
  void api.close().then(() => {
    rmSync(folder, { recursive: true, force: true });
    process.exit(0);
  });
});
