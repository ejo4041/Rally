import type { Snapshot } from "./contracts.ts";
// Deliberate allowlist: live hypotheses and diagnostic history are not report evidence.
export function reportContext(snapshot: Snapshot): Snapshot {
  const m = snapshot.meeting;
  return {
    turns: snapshot.turns,
    elapsedSeconds: snapshot.elapsedSeconds,
    meeting: {
      id: m.id,
      userId: m.userId,
      title: m.title,
      participants: m.participants,
      agenda: m.agenda,
      durationMinutes: m.durationMinutes,
      createdAt: m.createdAt,
      phase: m.phase,
      plan: m.plan,
      originalPlan: m.originalPlan,
      revisions: m.revisions,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      paused: m.paused,
      epoch: m.epoch,
      speakerNames: m.speakerNames,
      gaps: m.gaps,
      audioExclusions: m.audioExclusions,
      interventions: m.interventions,
      progress: "",
      assessment: null,
      report: null,
      reportStatus: m.reportStatus,
      error: null,
    },
  };
}
