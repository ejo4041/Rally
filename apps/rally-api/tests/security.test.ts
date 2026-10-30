import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TOTP, Secret } from "otpauth";
import { createApplication } from "../src/app.ts";
import { Store } from "../src/store.ts";
import { createUser } from "../src/auth.ts";
const key = "34".repeat(32),
  password = "fixture-password-123";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const code = (secret: string) =>
  new TOTP({
    secret: Secret.fromBase32(secret),
    digits: 6,
    period: 30,
    algorithm: "SHA1",
  }).generate();
async function fixture(
  t: any,
  options: Parameters<typeof createApplication>[0] = {},
) {
  const folder = mkdtempSync(join(tmpdir(), "rally-security-")),
    path = join(folder, "db");
  const app = createApplication({
    dbPath: path,
    mfaKey: key,
    providers: {
      prepare: async () => ({
        objective: "Synthetic",
        topics: [
          {
            id: "one",
            title: "One",
            outcome: "Decide",
            minutes: 4,
            status: "pending",
          },
        ],
        durationMinutes: 5,
        wrapMinutes: 1,
      }),
    },
    ...options,
  });
  const db = new Store(path),
    admin = await createUser(db, "admin", password),
    user = await createUser(db, "judge", password);
  db.db
    .prepare("UPDATE user_security SET role='admin' WHERE user_id=?")
    .run(admin.id);
  const server = app.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  t.after(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    await app.close();
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  const req = async (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = "",
  ) =>
    fetch(base + path, {
      method,
      headers: { cookie, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const cookie = (r: Response, name: string) =>
    r.headers
      .getSetCookie()
      .find((s) => s.startsWith(name + "="))!
      .split(";")[0];
  async function enroll(username: string) {
    const login = await req("/auth/login", "POST", { username, password });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).step, "enroll");
    const c = cookie(login, "rally_challenge");
    assert.equal((await req("/meetings", "GET", undefined, c)).status, 401);
    assert.equal((await req("/teams/status", "GET", undefined, c)).status, 401);
    const data = await (await req("/auth/enroll", "GET", undefined, c)).json();
    assert.ok(data.qr.startsWith("data:image/png;base64,"));
    const enrolled = await req(
      "/auth/enroll",
      "POST",
      { code: code(data.secret) },
      c,
    );
    assert.equal(enrolled.status, 200);
    const result = await enrolled.json();
    assert.equal(result.recoveryCodes.length, 8);
    return {
      cookie: cookie(enrolled, "rally_session"),
      secret: data.secret,
      codes: result.recoveryCodes,
    };
  }
  return { app, db, admin, user, req, cookie, enroll };
}
test("closed signup, mandatory enrollment, encrypted secret, recovery hashes, MFA-only sessions and replay rejection", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.req("/auth/signup", "POST", { username: "intruder", password }))
      .status,
    403,
  );
  const judge = await f.enroll("judge");
  const me = await (
    await f.req("/auth/me", "GET", undefined, judge.cookie)
  ).json();
  assert.equal(me.username, "judge");
  assert.equal(me.role, "user");
  assert.equal(me.password, undefined);
  const stored = f.db.db
    .prepare("SELECT secret FROM user_security WHERE user_id=?")
    .get(f.user.id)!;
  assert.notEqual(stored.secret, judge.secret);
  assert.equal(
    f.db.db
      .prepare("SELECT hash FROM recovery_codes WHERE hash=?")
      .get(judge.codes[0]),
    undefined,
  );
  const login = await f.req("/auth/login", "POST", {
      username: "judge",
      password,
    }),
    c = f.cookie(login, "rally_challenge");
  assert.equal((await login.json()).step, "verify");
  assert.equal((await f.req("/auth/enroll", "GET", undefined, c)).status, 401);
  assert.equal(
    (await f.req("/auth/verify", "POST", { code: code(judge.secret) }, c))
      .status,
    401,
  ); // used at enrollment
  f.db.db
    .prepare("UPDATE user_security SET last_step=-1 WHERE user_id=?")
    .run(f.user.id);
  const verified = await f.req(
    "/auth/verify",
    "POST",
    { code: code(judge.secret) },
    c,
  );
  assert.equal(verified.status, 200);
  assert.equal(
    (await f.req("/auth/verify", "POST", { code: code(judge.secret) }, c))
      .status,
    401,
  ); // consumed challenge
  assert.equal(
    (await f.req("/admin/users", "GET", undefined, judge.cookie)).status,
    403,
  );
});
test("single-use recovery revokes sessions and requires fresh enrollment", async (t) => {
  const f = await fixture(t),
    judge = await f.enroll("judge");
  const login = await f.req("/auth/login", "POST", {
      username: "judge",
      password,
    }),
    c = f.cookie(login, "rally_challenge");
  const recovered = await f.req(
    "/auth/recover",
    "POST",
    { code: judge.codes[0] },
    c,
  );
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).step, "enroll");
  const competing = await f.req("/auth/login", "POST", {
    username: "judge",
    password,
  });
  assert.equal((await competing.json()).step, "verify");
  // Issue a fresh recovery challenge after the competing login invalidates the old pending challenge.
  const retry = await f.req(
    "/auth/recover",
    "POST",
    { code: judge.codes[1] },
    f.cookie(competing, "rally_challenge"),
  );
  assert.equal(retry.status, 200);
  assert.equal(
    (await f.req("/auth/me", "GET", undefined, judge.cookie)).status,
    401,
  );
  assert.equal(
    f.db.db
      .prepare("SELECT hash FROM recovery_codes WHERE hash=?")
      .get(digest(judge.codes[0])),
    undefined,
  );
  const next = f.cookie(retry, "rally_challenge");
  assert.equal((await f.req("/meetings", "GET", undefined, next)).status, 401);
  const setup = await (
    await f.req("/auth/enroll", "GET", undefined, next)
  ).json();
  assert.notEqual(setup.secret, judge.secret);
  assert.equal(
    (await f.req("/auth/enroll", "POST", { code: code(setup.secret) }, next))
      .status,
    200,
  );
});
test("admin invitation, identity-verified reset, role protection and disable revoke sessions", async (t) => {
  const f = await fixture(t),
    admin = await f.enroll("admin"),
    judge = await f.enroll("judge");
  const invited = await f.req(
    "/admin/users",
    "POST",
    { username: "newjudge", role: "user" },
    admin.cookie,
  );
  assert.equal(invited.status, 201);
  const invitation = await invited.json();
  assert.equal(
    (await f.req("/auth/login", "POST", { username: "newjudge", password }))
      .status,
    401,
  );
  const activation = await f.req("/auth/activate", "POST", {
    username: "newjudge",
    password,
    token: invitation.activationCode,
  });
  assert.equal(activation.status, 200);
  assert.equal(
    (await f.req("/auth/login", "POST", { username: "newjudge", password }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.req("/auth/activate", "POST", {
        username: "newjudge",
        password,
        token: invitation.activationCode,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.req(
        `/admin/users/${f.admin.id}`,
        "PATCH",
        { disabled: true },
        admin.cookie,
      )
    ).status,
    409,
  );
  const reset = await f.req(
    `/admin/users/${f.user.id}/reset-mfa`,
    "POST",
    { reason: "Verified judge identity in trusted channel" },
    admin.cookie,
  );
  assert.equal(reset.status, 200);
  const resetData = await reset.json();
  assert.equal(
    (await f.req("/auth/me", "GET", undefined, judge.cookie)).status,
    401,
  );
  assert.equal(
    (await f.req("/auth/login", "POST", { username: "judge", password }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.req("/auth/activate", "POST", {
        username: "judge",
        password,
        token: resetData.activationCode,
      })
    ).status,
    200,
  );
  f.db.db.prepare("UPDATE sessions SET verified_at=0").run();
  assert.equal(
    (await f.req("/admin/users", "POST", { username: "denied" }, admin.cookie))
      .status,
    403,
  );
  f.db.db
    .prepare("UPDATE user_security SET last_step=-1 WHERE user_id=?")
    .run(f.admin.id);
  assert.equal(
    (
      await f.req(
        "/admin/reauth",
        "POST",
        { password, code: code(admin.secret) },
        admin.cookie,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await f.req(
        `/admin/users/${f.user.id}`,
        "PATCH",
        { disabled: true },
        admin.cookie,
      )
    ).status,
    204,
  );
  assert.equal(
    (await f.req("/auth/login", "POST", { username: "judge", password }))
      .status,
    401,
  );
});
test("usage is available to admins; transcript sharing is explicit, owner-only, withdrawable and content access audited", async (t) => {
  const f = await fixture(t),
    admin = await f.enroll("admin"),
    judge = await f.enroll("judge");
  const created = await f.req(
    "/meetings",
    "POST",
    {
      title: "Private synthetic title",
      agenda: "Private synthetic agenda",
      durationMinutes: 5,
    },
    judge.cookie,
  );
  assert.equal(created.status, 201);
  const meeting = await created.json();
  const path = `/admin/meetings/${meeting.id}/transcript`;
  assert.equal((await f.req(path, "GET", undefined, admin.cookie)).status, 404);
  const activity = await (
    await f.req("/admin/activity", "GET", undefined, admin.cookie)
  ).json();
  assert.equal(activity.meetings.length, 1);
  assert.equal(JSON.stringify(activity).includes("Private synthetic"), false);
  assert.equal(
    (
      await f.req(
        `/meetings/${meeting.id}/sharing`,
        "PATCH",
        { enabled: true },
        admin.cookie,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await f.req(
        `/meetings/${meeting.id}/sharing`,
        "PATCH",
        { enabled: true },
        judge.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await f.req(path, "GET", undefined, judge.cookie)).status, 403);
  assert.equal((await f.req(path, "GET", undefined, admin.cookie)).status, 200);
  assert.equal(
    Number(
      f.db.db
        .prepare(
          "SELECT count(*) AS n FROM audit WHERE event='admin.transcript_viewed'",
        )
        .get()!.n,
    ),
    1,
  );
  assert.equal(
    (
      await f.req(
        `/meetings/${meeting.id}/sharing`,
        "PATCH",
        { enabled: false },
        judge.cookie,
      )
    ).status,
    200,
  );
  assert.equal((await f.req(path, "GET", undefined, admin.cookie)).status, 404);
  await f.req(
    `/meetings/${meeting.id}/sharing`,
    "PATCH",
    { enabled: true },
    judge.cookie,
  );
  assert.equal(
    (await f.req(`/meetings/${meeting.id}`, "DELETE", undefined, judge.cookie))
      .status,
    204,
  );
  assert.equal((await f.req(path, "GET", undefined, admin.cookie)).status, 404);
});
test("persistent account throttles block password and MFA guessing and expired challenges cannot authenticate", async (t) => {
  const f = await fixture(t);
  for (let n = 0; n < 12; n++)
    assert.equal(
      (
        await f.req("/auth/login", "POST", {
          username: "judge",
          password: "wrong-password",
        })
      ).status,
      401,
    );
  assert.equal(
    (await f.req("/auth/login", "POST", { username: "judge", password }))
      .status,
    429,
  );
  f.db.db.exec("DELETE FROM auth_limits");
  const judge = await f.enroll("judge");
  const login = await f.req("/auth/login", "POST", {
      username: "judge",
      password,
    }),
    c = f.cookie(login, "rally_challenge");
  for (let n = 0; n < 10; n++)
    assert.equal(
      (await f.req("/auth/verify", "POST", { code: "bad-code" }, c)).status,
      401,
    );
  assert.equal(
    (await f.req("/auth/verify", "POST", { code: code(judge.secret) }, c))
      .status,
    401,
  );
  const login2 = await f.req("/auth/login", "POST", {
      username: "judge",
      password,
    }),
    c2 = f.cookie(login2, "rally_challenge");
  f.db.db.exec("UPDATE auth_challenges SET expires=0");
  assert.equal(
    (await f.req("/auth/verify", "POST", { code: code(judge.secret) }, c2))
      .status,
    401,
  );
});

test("admin MFA reset cancels a pending browser startup and its late media grant", async (t) => {
  let release!: (value: any) => void,
    opened = false,
    closed = 0;
  const f = await fixture(t, {
    media: {
      open: async () => {
        opened = true;
        return new Promise((r) => (release = r));
      },
    },
  });
  const admin = await f.enroll("admin"),
    judge = await f.enroll("judge");
  const created = await f.req(
    "/meetings",
    "POST",
    { agenda: "Synthetic pending startup", durationMinutes: 5 },
    judge.cookie,
  );
  const m = await created.json();
  const start = f.req(
    `/meetings/${m.id}/start`,
    "POST",
    { consented: true },
    judge.cookie,
  );
  for (let n = 0; n < 100 && !opened; n++)
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(opened, true);
  const reset = await f.req(
    `/admin/users/${f.user.id}/reset-mfa`,
    "POST",
    { reason: "Verified identity" },
    admin.cookie,
  );
  assert.equal(reset.status, 200);
  release({
    connection: async () => ({
      url: "ws://synthetic",
      token: "must-not-be-issued",
      room: "synthetic",
    }),
    send: async () => {},
    close: async () => {
      closed++;
    },
  });
  const result = await start;
  assert.equal(result.status, 401);
  assert.equal(closed, 1);
  assert.equal(
    (await f.req("/auth/me", "GET", undefined, judge.cookie)).status,
    401,
  );
});

test('legacy password-only sessions are removed once without deleting existing users',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const folder=mkdtempSync(join(tmpdir(),'rally-legacy-')),path=join(folder,'db');
 try {
  const old=new DatabaseSync(path);
  old.exec("CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL); CREATE TABLE sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL); INSERT INTO users VALUES('legacy-id','legacy','test-only'); INSERT INTO sessions VALUES('old-token','legacy-id',9999999999999);");old.close();
  const migrated=new Store(path);
  assert.equal(Number(migrated.db.prepare('SELECT count(*) AS n FROM sessions').get()!.n),0);
  assert.equal(migrated.db.prepare('SELECT username FROM users WHERE id=?').get('legacy-id')!.username,'legacy');
  assert.equal(migrated.db.prepare('SELECT role FROM user_security WHERE user_id=?').get('legacy-id')!.role,'user');
  migrated.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('new-token','legacy-id',Date.now()+60000,1,Date.now());migrated.close();
  const reopened=new Store(path);assert.equal(Number(reopened.db.prepare('SELECT count(*) AS n FROM sessions').get()!.n),1);reopened.close();
 }finally{rmSync(folder,{recursive:true,force:true});}
});
