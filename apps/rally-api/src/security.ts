import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  createHash,
} from "node:crypto";
import { TOTP, Secret } from "otpauth";
import QRCode from "qrcode";
import { z } from "zod";
import type { Express, Request, Response } from "express";
import type { Store } from "./store.ts";
import {
  authenticate,
  createUser,
  setPassword,
  issueSession,
  sessionToken,
  userForRequest,
  HttpError,
} from "./auth.ts";
import type { Meetings } from "./meetings.ts";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("hex");
const credentials = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,40}$/),
  password: z.string().min(10).max(200),
});
const verification = z.object({ code: z.string().trim().min(6).max(80) });
type SecurityRow = {
  user_id: string;
  role: string;
  disabled: number;
  secret: string | null;
  last_step: number;
  reset_required: number;
};
export function audit(
  store: Store,
  actor: string | null,
  event: string,
  target: string | null = null,
  detail: Record<string, unknown> = {},
) {
  store.db
    .prepare("DELETE FROM audit WHERE at<?")
    .run(Date.now() - 30 * 86400000);
  store.db
    .prepare("INSERT INTO audit VALUES(?,?,?,?,?,?)")
    .run(
      randomUUID(),
      Date.now(),
      actor,
      event,
      target,
      JSON.stringify(detail),
    );
}
export function installSecurity(
  app: Express,
  store: Store,
  meetings: Meetings,
  options: {
    secure: boolean;
    key: string;
    disconnect: (id: string) => Promise<void>;
  },
) {
  store.db
    .prepare("DELETE FROM audit WHERE at<?")
    .run(Date.now() - 30 * 86400000);
  store.db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  store.db
    .prepare("DELETE FROM account_tokens WHERE expires<?")
    .run(Date.now());
  const key = Buffer.from(options.key, "hex");
  if (key.length !== 32 || !/^[a-f0-9]{64}$/i.test(options.key))
    throw new Error(
      "RALLY_MFA_KEY must be a persistent random 32-byte hex key",
    );
  const seal = (value: string) => {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", key, iv);
    const out = Buffer.concat([c.update(value, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), out]).toString("base64");
  };
  const unseal = (value: string) => {
    const b = Buffer.from(value, "base64"),
      c = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    c.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString(
      "utf8",
    );
  };
  const security = (id: string) =>
    store.db
      .prepare("SELECT * FROM user_security WHERE user_id=?")
      .get(id) as SecurityRow;
  const totp = (secret: string, username: string) =>
    new TOTP({
      issuer: "Rally",
      label: username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
  function checkCode(row: SecurityRow, username: string, code: string) {
    if (!row.secret || !/^\d{6}$/.test(code)) return false;
    const delta = totp(unseal(row.secret), username).validate({
      token: code,
      window: 1,
    });
    const step = Math.floor(Date.now() / 30000) + (delta ?? 0);
    if (delta === null || step <= row.last_step) return false;
    store.db
      .prepare("UPDATE user_security SET last_step=? WHERE user_id=?")
      .run(step, row.user_id);
    return true;
  }
  function rate(
    scope: string,
    value: string,
    max: number,
    period = 15 * 60000,
  ) {
    const id = hash(scope + ":" + value),
      now = Date.now();
    store.db.prepare("DELETE FROM auth_limits WHERE until<?").run(now);
    store.db
      .prepare(
        "INSERT INTO auth_limits VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1",
      )
      .run(id, now + period);
    const row = store.db
      .prepare("SELECT attempts FROM auth_limits WHERE id=?")
      .get(id)!;
    if (Number(row.attempts) > max)
      throw new HttpError("Too many attempts. Try again later.", 429);
  }
  function throttle(req: Request, scope: string, account: string, max = 12) {
    rate(scope + ":ip", req.ip || "unknown", 200);
    rate(scope + ":account", account, max);
  }
  const challengeCookie = (res: Response, value: string) =>
    res.cookie("rally_challenge", value, {
      httpOnly: true,
      secure: options.secure,
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 10 * 60000,
    });
  const readChallenge = (req: Request) =>
    decodeURIComponent(
      (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("rally_challenge="))
        ?.slice(16) || "",
    );
  function challenge(res: Response, id: string, kind: string) {
    store.db
      .prepare("DELETE FROM auth_challenges WHERE expires<? OR user_id=?")
      .run(Date.now(), id);
    const value = token(),
      secret = kind === "enroll" ? seal(new Secret({ size: 20 }).base32) : null;
    store.db
      .prepare("INSERT INTO auth_challenges VALUES(?,?,?,?,?,0)")
      .run(hash(value), id, kind, secret, Date.now() + 10 * 60000);
    challengeCookie(res, value);
    return { step: kind };
  }
  function pending(req: Request, kind?: string) {
    const row = store.db
      .prepare(
        "SELECT c.*,u.username FROM auth_challenges c JOIN users u ON u.id=c.user_id JOIN user_security s ON s.user_id=u.id WHERE c.hash=? AND c.expires>? AND s.disabled=0",
      )
      .get(hash(readChallenge(req)), Date.now()) as
      | {
          hash: string;
          user_id: string;
          kind: string;
          secret: string;
          username: string;
          attempts: number;
        }
      | undefined;
    if (!row || (kind && row.kind !== kind) || row.attempts >= 10)
      throw new HttpError("Sign in again to continue.", 401);
    return row;
  }
  function attempt(row: { hash: string }) {
    store.db
      .prepare("UPDATE auth_challenges SET attempts=attempts+1 WHERE hash=?")
      .run(row.hash);
  }
  function completed(req: Request, res: Response, id: string) {
    store.db.prepare("DELETE FROM auth_challenges WHERE user_id=?").run(id);
    res.clearCookie("rally_challenge", {
      path: "/api/auth",
      httpOnly: true,
      secure: options.secure,
      sameSite: "strict",
    });
    const user = store.db
      .prepare("SELECT id,username FROM users WHERE id=?")
      .get(id) as { id: string; username: string };
    issueSession(store, res, user, options.secure, true);
    audit(store, id, "login.success");
    return { ...user, role: security(id).role };
  }
  const admin = (req: Request, recent = false) => {
    const user = userForRequest(store, req);
    if (security(user.id).role !== "admin")
      throw new HttpError("Administrator access required", 403);
    if (recent) {
      const row = store.db
        .prepare("SELECT verified_at FROM sessions WHERE hash=?")
        .get(hash(sessionToken(req) || ""));
      if (!row || Number(row.verified_at) < Date.now() - 5 * 60000)
        throw new HttpError(
          "Confirm your password and MFA code in Admin security first.",
          403,
        );
    }
    return user;
  };
  function activation(id: string, kind: string) {
    store.db.prepare("DELETE FROM account_tokens WHERE user_id=?").run(id);
    const value = token();
    store.db
      .prepare("INSERT INTO account_tokens VALUES(?,?,?,?)")
      .run(hash(value), id, kind, Date.now() + 24 * 3600000);
    return value;
  }
  function revoke(id: string) {
    store.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
    store.db.prepare("DELETE FROM auth_challenges WHERE user_id=?").run(id);
  }
  app.post("/api/auth/signup", (_req, res) =>
    res
      .status(403)
      .json({
        error:
          "Registration is closed. Ask the administrator for an invitation.",
      }),
  );
  app.post("/api/auth/login", async (req, res) => {
    const input = credentials.parse(req.body);
    throttle(req, "login", input.username);
    let user;
    try {
      user = await authenticate(store, input.username, input.password);
    } catch (e) {
      audit(store, null, "login.failed");
      throw e;
    }
    const s = security(user.id);
    if (s.disabled || s.reset_required === 1) {
      audit(store, user.id, "login.blocked");
      throw new HttpError(
        "Account unavailable. Contact the administrator or use your activation code.",
        401,
      );
    }
    res.json(
      challenge(
        res,
        user.id,
        s.secret || s.reset_required === 2 ? "verify" : "enroll",
      ),
    );
  });
  app.post("/api/auth/activate", async (req, res) => {
    const data = credentials
      .extend({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body);
    throttle(req, "activate", data.username);
    const row = store.db
      .prepare(
        "SELECT t.*,u.username FROM account_tokens t JOIN users u ON u.id=t.user_id JOIN user_security s ON s.user_id=u.id WHERE t.hash=? AND t.expires>? AND s.disabled=0",
      )
      .get(hash(data.token), Date.now()) as
      { user_id: string; username: string; kind: string } | undefined;
    if (!row || row.username !== data.username)
      throw new HttpError("Invalid or expired activation code.", 401);
    if (row.kind !== "invite")
      await authenticate(store, data.username, data.password);
    // Consume once, only after the password operation succeeds.
    if (
      store.db
        .prepare("DELETE FROM account_tokens WHERE hash=?")
        .run(hash(data.token)).changes !== 1
    )
      throw new HttpError("Activation code already used.", 401);
    if (row.kind === "invite")
      await setPassword(store, row.user_id, data.password);
    audit(store, row.user_id, "activation.used");
    res.json(challenge(res, row.user_id, "enroll"));
  });
  app.get("/api/auth/pending", (req, res) =>
    res.json({ step: pending(req).kind }),
  );
  app.get("/api/auth/enroll", async (req, res) => {
    const c = pending(req, "enroll"),
      secret = unseal(c.secret),
      uri = totp(secret, c.username).toString();
    res.json({
      secret,
      qr: await QRCode.toDataURL(uri, { width: 240, margin: 2 }),
      username: c.username,
    });
  });
  app.post("/api/auth/enroll", (req, res) => {
    const c = pending(req, "enroll");
    throttle(req, "enroll", c.user_id);
    attempt(c);
    const { code } = verification.parse(req.body),
      t = totp(unseal(c.secret), c.username),
      delta = t.validate({ token: code, window: 1 });
    if (delta === null) throw new HttpError("Invalid authenticator code.", 401);
    const recovery = Array.from({ length: 8 }, () =>
      randomBytes(10).toString("hex"),
    );
    store.db.exec("BEGIN IMMEDIATE");
    try {
      store.db
        .prepare(
          "UPDATE user_security SET secret=?,last_step=?,reset_required=0 WHERE user_id=?",
        )
        .run(c.secret, Math.floor(Date.now() / 30000) + delta, c.user_id);
      store.db
        .prepare("DELETE FROM recovery_codes WHERE user_id=?")
        .run(c.user_id);
      const insert = store.db.prepare("INSERT INTO recovery_codes VALUES(?,?)");
      for (const value of recovery) insert.run(c.user_id, hash(value));
      revoke(c.user_id);
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
    audit(store, c.user_id, "mfa.enrolled");
    res.json({ user: completed(req, res, c.user_id), recoveryCodes: recovery });
  });
  app.post("/api/auth/verify", (req, res) => {
    const c = pending(req, "verify");
    throttle(req, "mfa", c.user_id);
    attempt(c);
    if (
      !checkCode(
        security(c.user_id),
        c.username,
        verification.parse(req.body).code,
      )
    ) {
      audit(store, c.user_id, "mfa.failed");
      throw new HttpError("Invalid or already used authenticator code.", 401);
    }
    res.json({ user: completed(req, res, c.user_id) });
  });
  app.post("/api/auth/recover", async (req, res) => {
    const c = pending(req, "verify");
    throttle(req, "recovery", c.user_id, 6);
    attempt(c);
    const { code } = verification.parse(req.body);
    if (
      store.db
        .prepare("DELETE FROM recovery_codes WHERE user_id=? AND hash=?")
        .run(c.user_id, hash(code)).changes !== 1
    )
      throw new HttpError("Invalid recovery code.", 401);
    revoke(c.user_id);
    store.db
      .prepare(
        "UPDATE user_security SET secret=NULL,last_step=-1,reset_required=2 WHERE user_id=?",
      )
      .run(c.user_id);
    await options.disconnect(c.user_id);
    audit(store, c.user_id, "mfa.recovery_used");
    res.json(challenge(res, c.user_id, "enroll"));
  });
  app.post("/api/admin/reauth", async (req, res) => {
    const user = admin(req);
    throttle(req, "reauth", user.id);
    const data = z
      .object({
        password: z.string().min(1).max(200),
        code: z.string().trim().length(6),
      })
      .parse(req.body);
    await authenticate(store, user.username, data.password);
    if (!checkCode(security(user.id), user.username, data.code))
      throw new HttpError("Invalid or already used authenticator code.", 401);
    store.db
      .prepare("UPDATE sessions SET verified_at=? WHERE hash=?")
      .run(Date.now(), hash(sessionToken(req) || ""));
    audit(store, user.id, "admin.reauthenticated");
    res.sendStatus(204);
  });
  app.get("/api/admin/users", (req, res) => {
    admin(req);
    res.json(
      store.db
        .prepare(
          "SELECT u.id,u.username,s.role,s.disabled,s.secret IS NOT NULL AS enrolled,s.reset_required FROM users u JOIN user_security s ON s.user_id=u.id ORDER BY u.username",
        )
        .all(),
    );
  });
  app.post("/api/admin/users", async (req, res) => {
    const actor = admin(req, true),
      data = z
        .object({
          username: credentials.shape.username,
          role: z.enum(["user", "admin"]).default("user"),
        })
        .parse(req.body);
    const user = await createUser(store, data.username, token());
    store.db
      .prepare(
        "UPDATE user_security SET role=?,reset_required=1 WHERE user_id=?",
      )
      .run(data.role, user.id);
    const value = activation(user.id, "invite");
    audit(store, actor.id, "admin.user_invited", user.id, { role: data.role });
    res
      .status(201)
      .json({
        username: user.username,
        activationCode: value,
        expiresInHours: 24,
      });
  });
  app.post("/api/admin/users/:id/reset-mfa", async (req, res) => {
    const actor = admin(req, true),
      id = z.string().uuid().parse(req.params.id),
      reason = z.string().trim().min(3).max(500).parse(req.body?.reason);
    if (!store.db.prepare("SELECT id FROM users WHERE id=?").get(id))
      throw new HttpError("User not found", 404);
    if (id === actor.id)
      throw new HttpError(
        "Use a recovery code or offline administrator recovery for your own account.",
        409,
      );
    revoke(id);
    store.db.prepare("DELETE FROM recovery_codes WHERE user_id=?").run(id);
    store.db
      .prepare(
        "UPDATE user_security SET secret=NULL,last_step=-1,reset_required=1 WHERE user_id=?",
      )
      .run(id);
    const value = activation(id, "reset");
    audit(store, actor.id, "admin.mfa_reset", id, { reason });
    await options.disconnect(id);
    res.json({
      activationCode: value,
      expiresInHours: 24,
      notice:
        "Verify the user identity and deliver this code privately. Tell them their sessions were revoked and MFA must be enrolled again.",
    });
  });
  app.patch("/api/admin/users/:id", async (req, res) => {
    const actor = admin(req, true),
      id = z.string().uuid().parse(req.params.id),
      s = security(id);
    if (!s) throw new HttpError("User not found", 404);
    const data = z
      .object({
        disabled: z.boolean().optional(),
        role: z.enum(["admin", "user"]).optional(),
      })
      .parse(req.body);
    if (id === actor.id)
      throw new HttpError(
        "You cannot disable or change your own administrator role.",
        409,
      );
    if (
      s.role === "admin" &&
      !s.disabled &&
      (data.disabled || data.role === "user") &&
      Number(
        store.db
          .prepare(
            "SELECT count(*) AS n FROM user_security WHERE role='admin' AND disabled=0",
          )
          .get()!.n,
      ) <= 1
    )
      throw new HttpError("Keep at least one enabled administrator.", 409);
    store.db
      .prepare("UPDATE user_security SET disabled=?,role=? WHERE user_id=?")
      .run(
        data.disabled === undefined ? s.disabled : Number(data.disabled),
        data.role ?? s.role,
        id,
      );
    revoke(id);
    audit(store, actor.id, "admin.user_updated", id, data);
    await options.disconnect(id);
    res.sendStatus(204);
  });
  app.get("/api/admin/activity", (req, res) => {
    admin(req);
    const rows = store.db
      .prepare(
        "SELECT m.id,m.user_id,m.body,u.username FROM meetings m JOIN users u ON u.id=m.user_id ORDER BY m.rowid DESC LIMIT 200",
      )
      .all();
    const activity = rows.map((row) => {
      const m = JSON.parse(String(row.body));
      const share = store.db
        .prepare("SELECT enabled FROM transcript_shares WHERE meeting_id=?")
        .get(String(row.id));
      return {
        id: row.id,
        username: row.username,
        createdAt: m.createdAt,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
        durationSeconds: m.startedAt
          ? Math.max(0, ((m.endedAt || Date.now()) - m.startedAt) / 1000)
          : 0,
        captureMode: m.captureSource || "browser",
        phase: m.phase,
        reportStatus: m.reportStatus,
        error: !!m.error,
        shared: !!share?.enabled,
        turnCount: Number(
          store.db
            .prepare("SELECT count(*) AS n FROM turns WHERE meeting_id=?")
            .get(String(row.id))!.n,
        ),
      };
    });
    const usage = store.db
      .prepare(
        "SELECT u.username,x.status,sum(x.cost) AS cost,sum(x.estimate) AS estimate,count(*) AS calls FROM usage x JOIN users u ON u.id=x.user_id GROUP BY x.user_id,x.status",
      )
      .all();
    const events = store.db
      .prepare(
        "SELECT a.at,u.username AS actor,a.event,a.target,a.detail FROM audit a LEFT JOIN users u ON u.id=a.actor ORDER BY a.rowid DESC LIMIT 300",
      )
      .all();
    const speechUsage=store.db.prepare("SELECT u.username,json_extract(s.body,'$.state') AS status,count(*) AS calls,sum(json_extract(s.body,'$.seconds')) AS seconds,sum(CASE WHEN json_extract(s.body,'$.cost') IS NULL THEN 1 ELSE 0 END) AS unknownCostCalls FROM speech_usage s JOIN users u ON u.id=s.user_id GROUP BY s.user_id,json_extract(s.body,'$.state')").all();
    res.json({ meetings: activity, usage, speechUsage, events });
  });
  app.get("/api/meetings/:id/sharing", (req, res) => {
    const user = userForRequest(store, req),
      m = meetings.get(String(req.params.id), user.id);
    res.json({
      enabled: !!store.db
        .prepare("SELECT enabled FROM transcript_shares WHERE meeting_id=?")
        .get(m.id)?.enabled,
    });
  });
  app.patch("/api/meetings/:id/sharing", (req, res) => {
    const user = userForRequest(store, req),
      m = meetings.get(String(req.params.id), user.id),
      { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    store.db
      .prepare(
        "INSERT INTO transcript_shares VALUES(?,?,?) ON CONFLICT(meeting_id) DO UPDATE SET enabled=excluded.enabled,at=excluded.at",
      )
      .run(m.id, Number(enabled), Date.now());
    audit(
      store,
      user.id,
      enabled ? "transcript.shared" : "transcript.unshared",
      m.id,
    );
    res.json({ enabled });
  });
  app.get("/api/admin/meetings/:id/transcript", (req, res) => {
    const actor = admin(req),
      id = String(req.params.id);
    if (
      !store.db
        .prepare(
          "SELECT meeting_id FROM transcript_shares WHERE meeting_id=? AND enabled=1",
        )
        .get(id)
    )
      throw new HttpError("Transcript is not shared with the developer.", 404);
    const m = meetings.get(id);
    audit(store, actor.id, "admin.transcript_viewed", id);
    // Deliberate read-only projection; no join links or credentials.
    res.json({
      id: m.id,
      title: m.title,
      turns: meetings.turns(id),
      report: m.report,
      reportStatus: m.reportStatus,
      reportStale: !!m.reportStale,
      reportNotes: m.reportNotes || [],
      speakerNames:m.speakerNames,
    });
  });
}
