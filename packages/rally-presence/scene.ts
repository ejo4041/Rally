import type { Meeting } from "../../apps/rally-api/src/contracts.ts";
import { initialPresence, trajectory, type Presence } from "./state.ts";
export type Scene = {
  meetingId: string;
  finishing?: boolean;
  revision: number;
  epoch: number;
  captureEpoch: number;
  speechOwner: "browser" | "teams";
  serverTime: number;
  phase: Meeting["phase"];
  paused: boolean;
  presence: Presence;
  startedAt: number | null;
  endedAt: number | null;
  durationMinutes: number;
  current: string;
  next: string;
  detour: string | null;
  adjustment: string | null;
  topics: { title: string; minutes: number; status: string }[];
  speech: Meeting["playback"] | null;
};
export function sceneFor(m: Meeting, now = Date.now()): Scene {
  const topics = m.plan?.topics ?? [];
  const focus =
    m.presenceFocus !== undefined
      ? m.presenceFocus
      : (m.monitor?.decision?.focus ?? m.assessment?.focus);
  const intended =
    topics.find((t) => t.id === focus?.intendedTopicId) ??
    topics.find((t) => t.status === "active") ??
    topics.find((t) => t.status === "pending");
  const detour = focus?.detour ?? null;
  const next = topics.find(
    (t) => t.status === "pending" && t.id !== intended?.id,
  );
  return {
    meetingId: m.id,
    finishing:m.wrapUp?.state==="processing",
    revision: m.sceneRevision ?? 0,
    epoch: m.epoch,
    captureEpoch: m.captureEpoch ?? 0,
    speechOwner: m.captureSource ?? m.captureMode ?? "browser",
    serverTime: now,
    phase: m.phase,
    paused: m.paused,
    presence: trajectory(m.presence ?? initialPresence(now)),
    startedAt: m.startedAt,
    endedAt: m.endedAt,
    durationMinutes: m.durationMinutes,
    current: intended?.title.slice(0, 180) ?? "Wrap up",
    next:
      detour && intended
        ? `Return to ${intended.title.slice(0, 180)}`
        : (next?.title.slice(0, 180) ?? "Wrap up"),
    detour,
    adjustment: m.revisions.at(-1)?.reason.slice(0, 180) ?? null,
    topics: topics.map(({ title, minutes, status }) => ({
      title: title.slice(0, 120),
      minutes,
      status,
    })),
    speech:
      m.phase === "live" && !m.paused
        ? m.speechStatus
          ? {
              id: m.speechStatus.id,
              interventionId: m.speechStatus.interventionId,
              text: m.speechStatus.text ?? "",
              state: m.speechStatus.state,
              at: m.speechStatus.at,
              until: (m.speechStatus.startedAt ?? m.speechStatus.at) + 42000,
            }
          : (m.playback ?? null)
        : null,
  };
}
