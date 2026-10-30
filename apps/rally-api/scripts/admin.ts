// Offline OS-administrator recovery/bootstrap. Never expose as an HTTP route.
import { randomBytes, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { loadEnvironment, environmentConfig } from "../src/config.ts";
import { Store } from "../src/store.ts";
import { createUser } from "../src/auth.ts";
import { audit } from "../src/security.ts";
loadEnvironment();
const [action, username] = process.argv.slice(2),
  file = process.env.RALLY_ACTIVATION_FILE;
if (
  !["invite-admin", "reset-admin"].includes(action) ||
  !username ||
  !/^[a-z0-9_-]{3,40}$/.test(username) ||
  !file
)
  throw new Error(
    "Usage: RALLY_ACTIVATION_FILE=/private/new-file node scripts/admin.ts invite-admin|reset-admin username. Stop API before reset-admin.",
  );
if (action === "reset-admin" && process.env.RALLY_API_STOPPED !== "1")
  throw new Error(
    "Stop API first and set RALLY_API_STOPPED=1 before offline administrator reset.",
  );
const store = new Store(environmentConfig().dbPath);
try {
  let user = store.db
    .prepare("SELECT id,username FROM users WHERE username=?")
    .get(username) as { id: string; username: string } | undefined;
  if (action === "invite-admin") {
    if (user)
      throw new Error("Account already exists; refusing to replace it.");
    user = await createUser(store, username, randomBytes(32).toString("hex"));
  } else if (!user) throw new Error("Account not found");
  const id = user!.id,
    value = randomBytes(32).toString("hex");
  // Save before mutation; wx prevents accidentally replacing an earlier secret.
  writeFileSync(
    file,
    `Rally ${action === "invite-admin" ? "administrator invitation" : "administrator MFA reset"}\nUsername: ${username}\nActivation code: ${value}\nExpires in 24 hours. Open Rally and choose “Activate or reset account”. ${action === "invite-admin" ? "Choose a new password." : "Use your existing password."} Enroll your authenticator and save recovery codes.\nDelete this file after activation. Never commit it.\n`,
    { mode: 0o600, flag: "wx" },
  );
  store.db.exec("BEGIN IMMEDIATE");
  try {
    store.db
      .prepare(
        "UPDATE user_security SET role='admin',disabled=0,secret=NULL,last_step=-1,reset_required=1 WHERE user_id=?",
      )
      .run(id);
    for (const table of [
      "sessions",
      "auth_challenges",
      "recovery_codes",
      "account_tokens",
    ])
      store.db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(id);
    store.db
      .prepare("INSERT INTO account_tokens VALUES(?,?,?,?)")
      .run(
        createHash("sha256").update(value).digest("hex"),
        id,
        action === "invite-admin" ? "invite" : "reset",
        Date.now() + 24 * 3600000,
      );
    audit(store, null, "offline." + action, id);
    store.db.exec("COMMIT");
  } catch (e) {
    store.db.exec("ROLLBACK");
    throw e;
  }
  console.log(
    `Prepared ${username}; private activation instructions saved to ${file}.`,
  );
} finally {
  store.close();
}
