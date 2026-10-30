import { api } from "./api.ts";
type Job = {
  id: string;
  state: string;
  message: string;
  transcriptionState?: string;
  transcript?: { id: string; text: string; speaker: string | null }[];
  partial?: string;
};
type Status = {
  enabled: boolean;
  online: boolean;
  transcriptionReady?: boolean;
  busy: boolean;
  uncertain: boolean;
  job: Job | null;
};
const active = new Set(["queued", "joining", "lobby", "connected", "leaving"]);
export function setupTeams(
  onSaved: (id: string) => void,
  onError: (error: unknown) => void,
) {
  const el = (id: string) => document.getElementById(id)!;
  const button = (id: string) => el(id) as HTMLButtonElement;
  let status: Status | null = null,
    busy = false,
    polling = false,
    generation = 0;
  function render() {
    const job = status?.job,
      ownActive = !!job && active.has(job.state);
    el("teams-runner-status").textContent = !status
      ? "Checking runner…"
      : !status.enabled
        ? "For live moderation, prepare a meeting and choose Rally joins Teams as its audio source."
        : status.online
          ? "Teams runner online"
          : "Teams runner offline. No join will be attempted.";
    button("teams-join").disabled =
      busy || !status?.online || !!status?.busy || !!status?.uncertain;
    const checkbox = el("teams-transcribe") as HTMLInputElement;
    checkbox.disabled = busy || !status?.transcriptionReady;
    button("teams-leave").hidden = !ownActive;
    button("teams-leave").disabled = busy;
    button("teams-save").hidden =
      !job ||
      !["left", "failed"].includes(job.state) ||
      !["stopped", "failed"].includes(job.transcriptionState || "") ||
      !job.transcript?.length;
    button("teams-save").disabled = busy;
    el("teams-message").textContent = status?.uncertain
      ? "Invitation result is uncertain. Check the Teams roster; do not retry automatically."
      : job
        ? `${job.state}: ${job.message}`
        : status?.busy
          ? "The shared runner is busy with another connection."
          : "Ready for a Teams invite.";
    el("teams-transcript").replaceChildren(
      ...(job?.transcript || []).map((t) => {
        const p = document.createElement("p");
        p.textContent =
          (t.speaker ? `Speaker ${t.speaker}: ` : "Unknown speaker: ") + t.text;
        return p;
      }),
    );
    el("teams-partial").textContent = job?.partial || "";
  }
  async function refresh() {
    if (polling) return;
    const current = generation;
    polling = true;
    try {
      const result = await api<Status>("/teams/status");
      if (current !== generation) return;
      status = result;
      el("teams-error").textContent = "";
      render();
    } catch (error) {
      if (current !== generation) return;
      el("teams-error").textContent =
        error instanceof Error ? error.message : "Teams status unavailable.";
      onError(error);
    } finally {
      polling = false;
    }
  }
  async function action(task: () => Promise<void>) {
    if (busy) return;
    const current = generation;
    busy = true;
    el("teams-error").textContent = "";
    render();
    try {
      await task();
      if (current !== generation) return;
      await refresh();
    } catch (error) {
      if (current !== generation) return;
      el("teams-error").textContent =
        error instanceof Error
          ? error.message
          : "Teams operation failed. Check status before retrying.";
      onError(error);
    } finally {
      if (current !== generation) return;
      busy = false;
      render();
    }
  }
  el("teams-join-form").onsubmit = (event) => {
    event.preventDefault();
    return action(async () => {
      const transcribe = (el("teams-transcribe") as HTMLInputElement).checked;
      await api("/teams/join", "POST", {
        meetingUrl: (el("teams-url") as HTMLInputElement).value,
        consented: (el("teams-consent") as HTMLInputElement).checked,
        transcribe,
        transcriptionConsented: transcribe,
      });
      (el("teams-url") as HTMLInputElement).value = "";
    });
  };
  button("teams-leave").onclick = () =>
    action(async () => {
      if (status?.job) await api("/teams/leave", "POST", { id: status.job.id });
    });
  button("teams-save").onclick = () =>
    action(async () => {
      if (status?.job) {
        const current = generation;
        const saved = await api<{ meetingId: string }>("/teams/save", "POST", {
          id: status.job.id,
        });
        if (current === generation) onSaved(saved.meetingId);
      }
    });
  button("teams-refresh").onclick = () => refresh();
  return {
    refresh,
    reset() {
      generation++;
      status = null;
      busy = false;
      el("teams-transcript").replaceChildren();
      el("teams-partial").textContent = "";
      el("teams-message").textContent = "";
      el("teams-error").textContent = "";
      (el("teams-join-form") as HTMLFormElement).reset();
    },
    poll() {
      if (
        !document.getElementById("workspace")!.hidden &&
        !document.getElementById("home")!.hidden
      )
        void refresh();
    },
  };
}
