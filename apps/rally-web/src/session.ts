import type { LiveEvent } from "../../rally-api/src/contracts.ts";
import type { RecordView, Turn } from "./api.ts";
// Events are transient notifications; an HTTP snapshot replaces canonical state.
// Partial text never becomes a turn, and old revisions cannot overwrite new ones.
export class MeetingSession {
  meeting: RecordView;
  partial = "";
  private partialTurn: string | null = null;
  private clearPartial() {
    this.partial = "";
    this.partialTurn = null;
  }
  intervention: { id: string; text: string; kind: string } | null = null;
  notice = "";
  private seen = new Set<string>();
  constructor(meeting: RecordView) {
    this.meeting = meeting;
  }
  isStaleControl(event: LiveEvent) {
    if (!["intervention", "moderator.control"].includes(event.type))
      return false;
    const epoch = (event.data as { epoch?: unknown } | null)?.epoch;
    return (
      typeof epoch === "number" &&
      Number.isInteger(epoch) &&
      epoch < this.meeting.epoch
    );
  }
  replace(meeting: RecordView) {
    if (meeting.id !== this.meeting.id)
      throw new Error("Wrong meeting snapshot");
    if (meeting.epoch < this.meeting.epoch) return;
    // A snapshot requested before a final event may arrive after it. Keep newer
    // revisions until the next authoritative read includes them.
    const turns = new Map(meeting.turns.map((turn) => [turn.id, turn]));
    for (const turn of this.meeting.turns) {
      const snapshotTurn = turns.get(turn.id);
      if (!snapshotTurn || snapshotTurn.revision < turn.revision)
        turns.set(turn.id, turn);
    }
    meeting = { ...meeting, turns: [...turns.values()] };
    if (
      meeting.epoch !== this.meeting.epoch ||
      meeting.paused ||
      meeting.phase !== "live"
    )
      this.intervention = null;
    this.meeting = meeting;
    if (
      meeting.phase !== "live" ||
      (this.partialTurn && meeting.turns.some((t) => t.id === this.partialTurn))
    )
      this.clearPartial();
  }
  apply(event: LiveEvent): boolean {
    if (
      event.version !== 1 ||
      event.meetingId !== this.meeting.id ||
      typeof event.id !== "string" ||
      this.seen.has(event.id) ||
      this.isStaleControl(event)
    )
      return false;
    this.seen.add(event.id);
    if (this.seen.size > 2000)
      this.seen.delete(this.seen.values().next().value!);
    const m = this.meeting,
      data = event.data as any;
    switch (event.type) {
      case "transcript.partial":
        if (m.phase === "live" && typeof data?.text === "string") {
          const key =
            typeof data.sessionId === "string" &&
            Number.isInteger(data.turnId)
              ? `${data.sessionId}:${data.turnId}`
              : null;
          // Partial captions travel unreliably and can arrive after their final.
          if (key && m.turns.some((turn) => turn.id === key)) return false;
          this.partial = data.text;
          this.partialTurn = key;
        }
        return false;
      case "transcript.final": {
        if (
          !data ||
          typeof data.id !== "string" ||
          typeof data.text !== "string" ||
          !Number.isInteger(data.revision)
        )
          return true;
        const turn = data as Turn,
          index = m.turns.findIndex((t) => t.id === turn.id);
        if (index < 0) m.turns.push(turn);
        else if (turn.revision > m.turns[index].revision) m.turns[index] = turn;
        // Asynchronous completion of an older turn must not erase newer speech.
        if (this.partialTurn === null || this.partialTurn === turn.id)
          this.clearPartial();
        return true; // Fetch the authoritative ordering too.
      }
      case "intervention":
        if (!m.paused && m.phase === "live" && typeof data?.text === "string")
          this.intervention = data;
        return false;
      case "moderator.control":
        this.intervention = null;
        if (Number.isInteger(data?.epoch))
          m.epoch = Math.max(m.epoch, data.epoch);
        if (data?.type === "pause") m.paused = true;
        if (data?.type === "resume") m.paused = false;
        return true;
      case "assessment":
        return true; // The embedded recommendation is not an approved intervention.
      case "transcription.gap":
        this.clearPartial();
        this.intervention = null;
        this.notice = String(
          data?.reason ||
            "Transcription restarted; check continuity around this point.",
        );
        return true;
      case "capture.gap":
        this.clearPartial();
        this.notice = String(
          data?.reason ||
            "Audio was interrupted. Check the record and reconnect explicitly.",
        );
        return true;
      case "processing.error":
        this.notice = String(
          data?.error ||
            "Processing failed. Your saved transcript remains available.",
        );
        return true;
      case "meeting.ended":
        this.clearPartial();
        this.intervention = null;
        return true;
      case "speaker.updated":
      case "plan.updated":
      case "state.changed":
      case "report.ready":
      case "report.failed":
        return true;
      default:
        return false;
    }
  }
}
