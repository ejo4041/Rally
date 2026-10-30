import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const { TOTP, Secret } = createRequire(
  new URL("../../rally-api/package.json", import.meta.url),
)("otpauth");
const base = "http://127.0.0.1:3457",
  password = "test-password-123";
const fixture = spawn(process.execPath, ["tests/security-fixture.ts"], {
  stdio: ["ignore", "pipe", "pipe"],
});
let tail = "";
for (const s of [fixture.stdout, fixture.stderr])
  s.on("data", (d) => (tail = (tail + d).slice(-2000)));
let browser;
const errors = [];
async function enroll(page) {
  await page.locator("#enrollment-secret").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => document.querySelector("#enrollment-secret").textContent.length > 0,
  );
  const secret = await page.locator("#enrollment-secret").textContent();
  await page
    .locator("#mfa-code")
    .fill(
      new TOTP({
        secret: Secret.fromBase32(secret),
        digits: 6,
        period: 30,
        algorithm: "SHA1",
      }).generate(),
    );
  await page.locator("#mfa-submit").click();
  await page.locator("#recovery-panel").waitFor({ state: "visible" });
  assert.equal(
    (await page.locator("#recovery-codes").textContent()).trim().split("\n")
      .length,
    8,
  );
  await page.locator("#recovery-continue").click();
  await page.locator("#workspace").waitFor({ state: "visible" });
  return secret;
}
try {
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {}
    if (fixture.exitCode !== null) throw Error(tail);
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext(),
    page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  assert.equal(await page.locator("#auth-toggle").isVisible(), false);
  await page.locator("#username").fill("admin_test");
  await page.locator("#password").fill(password);
  await page.locator("#auth-submit").click();
  await page.locator("#mfa-form").waitFor({ state: "visible" });
  assert.equal((await page.request.get(base + "/api/meetings")).status(), 401);
  await enroll(page);
  assert.equal(await page.locator("#recovery-codes").textContent(), "");
  await page.locator("#admin-open").click();
  await page.locator("#admin-new-username").fill("judge_test");
  await page.locator("#admin-create button[type=submit]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#admin-secret")
      .textContent.includes("Invitation for judge_test"),
  );
  const invitation = (await page.locator("#admin-secret").textContent()).match(
    /[a-f0-9]{64}/,
  )[0];
  const judgeCtx = await browser.newContext(),
    judge = await judgeCtx.newPage();
  judge.on("pageerror", (e) => errors.push(e.message));
  await judge.goto(base);
  await judge.locator("#activate-open").click();
  await judge.locator("#activate-username").fill("judge_test");
  await judge.locator("#activate-password").fill(password);
  await judge.locator("#activate-code").fill(invitation);
  await judge.locator("#activate-submit").click();
  await enroll(judge);
  assert.equal(await judge.locator("#admin-open").isVisible(), false);
  const meeting = await (
    await judge.request.post(base + "/api/meetings", {
      data: {
        agenda: "Synthetic feedback only",
        title: "Synthetic judge record",
        durationMinutes: 5,
      },
    })
  ).json();
  await judge.goto(base + "/#meeting/" + meeting.id);
  await judge.locator("#share-feedback").waitFor({ state: "visible" });
  await judge.waitForFunction(
    () => !document.querySelector("#share-feedback").disabled,
  );
  assert.equal(await judge.locator("#share-feedback").isChecked(), false);
  await page.locator("#admin-refresh").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#admin-activity")
      .textContent.includes("judge_test"),
  );
  assert.equal(await page.locator("[data-transcript]").count(), 0);
  await judge.locator("#share-feedback").check();
  await judge.waitForFunction(
    () => !document.querySelector("#share-feedback").disabled,
  );
  await page.locator("#admin-refresh").click();
  await page.locator("[data-transcript]").waitFor();
  await page.locator("[data-transcript]").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#admin-content")
      .textContent.includes("Synthetic judge record"),
  );
  await judge.locator("#share-feedback").uncheck();
  await judge.waitForFunction(
    () => !document.querySelector("#share-feedback").disabled,
  );
  assert.equal(
    (
      await page.request.get(
        base + `/api/admin/meetings/${meeting.id}/transcript`,
      )
    ).status(),
    404,
  );
  const data = await (await page.request.get(base + "/api/admin/users")).json(),
    target = data.find((u) => u.username === "judge_test").id;
  page.once("dialog", (d) => d.accept("Verified synthetic judge identity"));
  await page.locator(`[data-reset="${target}"]`).click();
  await page.waitForFunction(() =>
    document
      .querySelector("#admin-secret")
      .textContent.includes("MFA reset code"),
  );
  const resetCode = (await page.locator("#admin-secret").textContent()).match(
    /[a-f0-9]{64}/,
  )[0];
  assert.equal((await judge.request.get(base + "/api/auth/me")).status(), 401);
  await judge.reload();
  await judge.locator("#auth-screen").waitFor({ state: "visible" });
  await judge.locator("#activate-open").click();
  await judge.locator("#activate-username").fill("judge_test");
  await judge.locator("#activate-password").fill(password);
  await judge.locator("#activate-code").fill(resetCode);
  await judge.locator("#activate-submit").click();
  await enroll(judge);
  await page.locator("#admin-close").click();
  assert.equal(await page.locator("#admin-secret").textContent(), "");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#admin-open").click();
  await page.locator("#admin-close").waitFor({ state: "visible" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/security-browser.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "closed signup UI",
          "MFA enrollment before app access",
          "one-time recovery display cleanup",
          "admin invitation",
          "judge activation",
          "owner-only default-off transcript sharing",
          "audited content view",
          "sharing withdrawal",
          "admin MFA reset and session revocation",
          "mandatory re-enrollment",
          "mobile admin access",
        ],
        paidCalls: 0,
        audioRecorded: false,
      },
      null,
      2,
    ),
  );
  console.log(
    "Security browser checks passed (synthetic data, zero paid calls).",
  );
} finally {
  await browser?.close();
  fixture.kill("SIGTERM");
}
