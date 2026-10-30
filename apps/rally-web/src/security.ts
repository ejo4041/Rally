import {formatMoney} from "./format.ts";
import { api, type User } from "./api.ts";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const val = (id: string) => $<HTMLInputElement>(id).value;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function setupSecurity(
  signedIn: (user: User) => Promise<void>,
  canOpen: () => boolean,
) {
  let step = "login",
    pendingUser: User | null = null;
  let userGeneration=0,currentUser:User|null=null;
  async function adminApi<T=unknown>(path:string,method="GET",body?:unknown):Promise<T> {
    const generation=userGeneration;
    const value=await api<T>(path,method,body);
    if(!currentUser || currentUser.role!=="admin" || generation!==userGeneration)throw new Error("Account changed. Reopen administration.");
    return value;
  }
  const error = (e: unknown) => {
    $("auth-error").textContent =
      e instanceof Error ? e.message : "Sign-in failed";
  };
  async function advance(next: string) {
    step = next;
    $("auth-form").hidden = next !== "login";
    $("activate-form").hidden = next !== "activate";
    $("mfa-form").hidden = !["enroll", "verify", "recover"].includes(next);
    $("recovery-panel").hidden = next !== "codes";
    $("auth-error").textContent = "";
    $("enrollment").hidden = next !== "enroll";
    $("use-recovery").hidden = next !== "verify";
    const code=$<HTMLInputElement>('mfa-code');code.inputMode=next==='recover'?'text':'numeric';code.autocomplete=next==='recover'?'off':'one-time-code';code.setAttribute('aria-label',next==='recover'?'Recovery code':'Verification code');code.name=next==='recover'?'recovery-code':'totp';code.maxLength=next==='recover'?80:6;code.pattern=next==='recover'?'.{6,80}':'[0-9]{6}';code.placeholder=next==='recover'?'Recovery code':'6-digit verification code';
    $("mfa-title").textContent =
      next === "enroll"
        ? "Set up your authenticator"
        : next === "recover"
          ? "Use a recovery code"
          : "Verify your sign-in";
    $("enrollment-secret").textContent = "";
    $<HTMLImageElement>("enrollment-qr").removeAttribute("src");
    $<HTMLInputElement>("mfa-code").value = "";
    if (next === "enroll") {
      const data = await api<{ secret: string; qr: string }>("/auth/enroll");
      $("enrollment-secret").textContent = data.secret;
      $<HTMLImageElement>("enrollment-qr").src = data.qr;
    }
  }
  $("auth-form").onsubmit = async (e) => {
    e.preventDefault();
    $<HTMLButtonElement>("auth-submit").disabled = true;
    try {
      const result = await api<{ step: string }>("/auth/login", "POST", {
        username: val("username"),
        password: val("password"),
      });
      $<HTMLInputElement>("password").value = "";
      await advance(result.step);
    } catch (e) {
      error(e);
    } finally {
      $<HTMLButtonElement>("auth-submit").disabled = false;
    }
  };
  $("activate-open").onclick = () => void advance("activate");
  $("activate-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = $<HTMLButtonElement>("activate-submit");
    b.disabled = true;
    try {
      const result = await api<{ step: string }>("/auth/activate", "POST", {
        username: val("activate-username"),
        password: val("activate-password"),
        token: val("activate-code").trim(),
      });
      $<HTMLFormElement>("activate-form").reset();
      await advance(result.step);
    } catch (e) {
      error(e);
    } finally {
      b.disabled = false;
    }
  };
  $("auth-restart").onclick = () => void advance("login");
  $("use-recovery").onclick = () => void advance("recover");
  $("mfa-form").onsubmit = async (e) => {
    e.preventDefault();
    const b = $<HTMLButtonElement>("mfa-submit");
    b.disabled = true;
    try {
      const result = await api<{
        user?: User;
        recoveryCodes?: string[];
        step?: string;
      }>(`/auth/${step === "recover" ? "recover" : step}`, "POST", {
        code: val("mfa-code").trim(),
      });
      if (result.step) {
        await advance(result.step);
        return;
      }
      if (result.recoveryCodes) {
        pendingUser = result.user!;
        await advance("codes");
        $("recovery-codes").textContent = result.recoveryCodes.join("\n");
        return;
      }
      await advance("login");
      await signedIn(result.user!);
    } catch (e) {
      error(e);
    } finally {
      b.disabled = false;
    }
  };
  $("recovery-continue").onclick = () => {
    const user = pendingUser;
    pendingUser = null;
    $("recovery-codes").textContent = "";
    return advance("login")
      .then(() => user && signedIn(user))
      .catch(error);
  };
  // Admin views never reuse the owner meeting view or its write actions.
  const run = (fn: () => Promise<void>) =>
    fn().catch((e) => {
      $("admin-status").textContent =
        e instanceof Error ? e.message : "Request failed";
    });
  async function refreshAdmin() {
    const [users, data] = await Promise.all([
      adminApi<any[]>("/admin/users"),
      adminApi<any>("/admin/activity"),
    ]);
    $("admin-users").innerHTML = users
      .map(
        (u) =>
          `<div class="history-row"><span><strong>${esc(u.username)}</strong> · ${esc(u.role)} · ${u.disabled ? "disabled" : u.enrolled ? "MFA enrolled" : u.reset_required ? "activation required" : "enrollment required"}</span><span><button data-reset="${esc(u.id)}">Reset MFA</button> <button data-disable="${esc(u.id)}" data-disabled="${u.disabled ? 1 : 0}">${u.disabled ? "Enable" : "Disable"}</button> <button data-role="${esc(u.id)}" data-current="${esc(u.role)}">${u.role === "admin" ? "Make user" : "Make admin"}</button></span></div>`,
      )
      .join("");
    $("admin-activity").innerHTML =
      data.meetings
        .map(
          (m: any) =>
            `<div class="history-row"><span>${esc(m.username)} · ${esc(new Date(m.createdAt).toLocaleString())}<br>${esc(m.captureMode)} · ${esc(m.phase)} · ${Math.round(m.durationSeconds)} seconds · ${m.turnCount} transcript turns · report ${esc(m.reportStatus)}${m.error ? " · processing error" : ""}</span>${m.shared ? `<button data-transcript="${esc(m.id)}">View shared transcript/report</button>` : "<span>Transcript private</span>"}</div>`,
        )
        .join("") || "No meetings yet.";
    $('admin-usage').innerHTML=`<h4>Muse usage</h4><div class="table-scroll"><table><thead><tr><th>User</th><th>Status</th><th>Calls</th><th>Recorded cost</th><th>Estimate</th></tr></thead><tbody>${data.usage.map((row:any)=>`<tr><td>${esc(row.username)}</td><td>${esc(row.status)}</td><td>${esc(row.calls)}</td><td>${esc(formatMoney(row.cost))}</td><td>${esc(formatMoney(row.estimate))}</td></tr>`).join('')}</tbody></table></div><h4>Speech usage</h4><div class="table-scroll"><table><thead><tr><th>User</th><th>Status</th><th>Calls</th><th>Audio seconds</th><th>Cost</th></tr></thead><tbody>${(data.speechUsage??[]).map((row:any)=>`<tr><td>${esc(row.username)}</td><td>${esc(row.status)}</td><td>${esc(row.calls)}</td><td>${row.seconds==null?'Unknown':Math.round(row.seconds)}</td><td>${row.unknownCostCalls?'Unknown':'See provider billing'}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Recorded usage and estimates, not a verified billing balance. Small nonzero charges are shown as &lt;$0.01.</p>`;
    $("admin-events").textContent = data.events
      .map(
        (e: any) =>
          `${new Date(e.at).toLocaleString()} · ${e.actor || "unknown account"} · ${e.event}${e.target ? " · " + e.target : ""}${e.detail && e.detail !== "{}" ? " · " + e.detail : ""}`,
      )
      .join("\n");
  }
  $("admin-open").onclick = () =>
    run(async () => {
      if (!canOpen()) return;
      $<HTMLDialogElement>("admin-dialog").showModal();
      await refreshAdmin();
    });
  $("admin-refresh").onclick = () => run(refreshAdmin);
  $("admin-close").onclick = () => {
    $("admin-content").textContent = "";
    $("admin-secret").textContent = "";
    $<HTMLDialogElement>("admin-dialog").close();
  };
  $("admin-reauth").onsubmit = (e) => {
    e.preventDefault();
    return run(async () => {
      await adminApi("/admin/reauth", "POST", {
        password: val("admin-password"),
        code: val("admin-code"),
      });
      $<HTMLFormElement>("admin-reauth").reset();
      $("admin-status").textContent =
        "Admin security confirmed for five minutes.";
    });
  };
  $("admin-create").onsubmit = (e) => {
    e.preventDefault();
    return run(async () => {
      const data = await adminApi<any>("/admin/users", "POST", {
        username: val("admin-new-username"),
        role: val("admin-new-role"),
      });
      $("admin-secret").textContent =
        `Invitation for ${data.username} (expires in 24 hours):\n${data.activationCode}\nDeliver privately. User chooses “Activate or reset account” and sets their own password.`;
      $<HTMLFormElement>("admin-create").reset();
      await refreshAdmin();
    });
  };
  $("admin-dialog").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.reset)
      return run(async () => {
        const reason = prompt(
          "Verify the user’s identity first. Enter a reason for this MFA reset:",
        );
        if (!reason) return;
        const data = await adminApi<any>(
          `/admin/users/${b.dataset.reset}/reset-mfa`,
          "POST",
          { reason },
        );
        $("admin-secret").textContent =
          `MFA reset code (expires in 24 hours):\n${data.activationCode}\n${data.notice}\nUser selects “Activate or reset account” with their existing password.`;
        await refreshAdmin();
      });
    if (b.dataset.disable)
      return run(async () => {
        if (!confirm("Change this account’s access and revoke its sessions?"))
          return;
        await adminApi(`/admin/users/${b.dataset.disable}`, "PATCH", {
          disabled: b.dataset.disabled !== "1",
        });
        await refreshAdmin();
      });
    if (b.dataset.role)
      return run(async () => {
        if (
          !confirm(
            "Change this account’s administrator role and revoke its sessions?",
          )
        )
          return;
        await adminApi(`/admin/users/${b.dataset.role}`, "PATCH", {
          role: b.dataset.current === "admin" ? "user" : "admin",
        });
        await refreshAdmin();
      });
    if (b.dataset.transcript)
      return run(async () => {
        const data = await adminApi<any>(
          `/admin/meetings/${b.dataset.transcript}/transcript`,
        );
        $("admin-content").textContent = JSON.stringify(data, null, 2);
        await refreshAdmin();
      });
  });
  $('admin-dialog').addEventListener('close',()=>{
    $('admin-content').textContent='';$('admin-secret').textContent='';
    $<HTMLFormElement>('admin-reauth').reset();
  });
  return {
    async resume() {
      try {
        const data = await api<{ step: string }>("/auth/pending");
        await advance(data.step);
      } catch {}
    },
    setUser(user: User | null) {
      userGeneration++;currentUser=user;
      $("admin-open").hidden = user?.role !== "admin";
      if (!user) {
        pendingUser = null;
        void advance("login");
        for (const id of [
          "admin-content",
          "admin-secret",
          "admin-events",
          "admin-activity",
          "admin-users",
          "admin-usage",
          "recovery-codes",
        ])
          $(id).textContent = "";
        $<HTMLFormElement>("admin-reauth").reset();
      }
    },
    async sharing(id: string) {
      const field = $<HTMLInputElement>("share-feedback");
      field.disabled = true;
      field.checked = false;
      const data = await api<{ enabled: boolean }>(`/meetings/${id}/sharing`);
      if (field.dataset.meeting === id) {
        field.checked = data.enabled;
        field.disabled = false;
      }
    },
  };
}
