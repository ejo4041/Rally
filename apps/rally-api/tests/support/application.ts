// Test-only account/session fixture for meeting lifecycle tests. Production
// never imports this file. Actual MFA endpoints are exercised in security.test.ts.
import { createApplication as realApplication } from "../../src/app.ts";
import { Store } from "../../src/store.ts";
import { createUser, authenticate, issueSession } from "../../src/auth.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export function createApplication(
  options: Parameters<typeof realApplication>[0] = {},
) {
  const folder =
    options.dbPath === ":memory:"
      ? mkdtempSync(join(tmpdir(), "rally-fixture-"))
      : null;
  const config = {
    ...options,
    dbPath: folder ? join(folder, "db.sqlite") : options.dbPath,
    mfaKey: "11".repeat(32),
  };
  const app = realApplication(config),
    store = new Store(config.dbPath!);
  app.app.post("/api/fixture/signup", async (req, res) => {
    const user = await createUser(store, req.body.username, req.body.password);
    store.db
      .prepare("UPDATE user_security SET secret=? WHERE user_id=?")
      .run("test-only-not-a-real-enrollment", user.id);
    issueSession(store, res, user, false, true);
    res.status(201).json(user);
  });
  app.app.post("/api/fixture/login", async (req, res) => {
    const user = await authenticate(
      store,
      req.body.username,
      req.body.password,
    );
    issueSession(store, res, user, false, true);
    res.json(user);
  });
  const close = app.close;
  return {
    ...app,
    async close() {
      await close();
      store.close();
      if (folder) rmSync(folder, { recursive: true, force: true });
    },
  };
}
