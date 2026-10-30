import { Room, RoomEvent } from "livekit-client";
import { presenceScene, presenceVoice } from "./presence.ts";
import { api } from "./api.ts";
import type { Meeting } from "./api.ts";
export function setupTeamsPresence(
  current: () => Meeting | undefined,
  refresh: () => void,
  fail: (error: unknown) => void,
) {
  const status = document.getElementById("teams-presence-status")!;
  const join = document.getElementById(
    "teams-presence-join",
  ) as HTMLButtonElement;
  const leave = document.getElementById(
    "teams-presence-leave",
  ) as HTMLButtonElement;
  let observer: Room | null = null,
    observing = "";
  let busy = false,
    polling = false,
    lastId = "",
    active = false;
  async function poll() {
    const m = current();
    if (observing && (!m || m.id !== observing || m.phase !== "live")) {
      void observer?.disconnect();
      observer = null;
      observing = "";
    }
    if (!m || polling) return;
    polling = true;
    try {
      const result = await api<{
        online: boolean;
        job: { state: string; message: string } | null;
      }>(`/meetings/${m.id}/teams-presence`);
      if (current()?.id !== m.id) return;
      active =
        !!result.job &&
        ["queued", "joining", "connected"].includes(result.job.state);
      status.textContent =
        result.job?.message ??
        (result.online
          ? "Rally is ready to join with voice and video."
          : "Teams presence runner is offline.");
      join.disabled =
        busy ||
        active ||
        !result.online ||
        !m.plan ||
        !["ready", "interrupted"].includes(m.phase);
      leave.hidden = !active;
      leave.disabled = busy;
      if (m.captureMode === "teams" && m.phase === "live" && !observer) {
        const connection = await api<{ url: string; token: string }>(
          `/meetings/${m.id}/observer`,
          "POST",
          {},
        );
        if (current()?.id !== m.id) return;
        const room = new Room();
        observer = room;
        observing = m.id;
        room.on(RoomEvent.Disconnected,()=>{if(observer===room){observer=null;observing="";}});
        room.on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
          if (current()?.id !== m.id) return;
          try {
            const data = JSON.parse(new TextDecoder().decode(bytes));
            if (
              topic === "rally" &&
              participant?.identity === `backend-${m.id}`
            ) {
              if (data.type === "presence.scene") presenceScene(data.data);
              else refresh();
            }
            if (
              topic === "rally.voice" &&
              participant?.identity === `capture-${m.id}`
            )
              presenceVoice(data);
          } catch {}
        });
        try {
          await room.connect(connection.url, connection.token, {
            autoSubscribe: false,
          });
        } catch {
          await room.disconnect();
          if (observer === room) {
            observer = null;
            observing = "";
          }
        }
      }
      if (active || m.captureMode === "teams") refresh();
    } catch (error) {
      if (lastId === m.id)
        status.textContent = "Teams presence status unavailable.";
    } finally {
      polling = false;
    }
  }
  join.onclick = async () => {
    const m = current();
    if (!m || busy) return;
    if (
      !(document.getElementById("teams-presence-consent") as HTMLInputElement)
        .checked
    ) {
      fail(
        new Error(
          "Confirm that participants consent to Rally joining, processing audio, and speaking.",
        ),
      );
      return;
    }
    busy = true;
    join.disabled = true;
    try {
      await api(`/meetings/${m.id}/teams-presence`, "POST", {
        url: (document.getElementById("teams-presence-url") as HTMLInputElement)
          .value,
        consented: true,
      });
      await poll();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      void poll();
    }
  };
  leave.onclick = async () => {
    const m = current();
    if (!m || busy) return;
    busy = true;
    try {
      await api(`/meetings/${m.id}/teams-presence/leave`, "POST", {});
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      busy = false;
      void poll();
    }
  };
  const timer = setInterval(() => void poll(), 2500);
  window.addEventListener("pagehide", () => clearInterval(timer), {
    once: true,
  });
  return {
    update() {
      const m = current();
      if (m?.id !== lastId) {
        lastId = m?.id ?? "";
        active = false;
        status.textContent = "Checking Teams presence…";
        void poll();
      }
    },
  };
}
