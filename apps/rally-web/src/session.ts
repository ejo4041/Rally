import type { LiveEvent } from "../../rally-api/src/contracts.ts";
import type { RecordView, Turn } from "./api.ts";
function newerExtension(incoming: RecordView['extension'], current: RecordView['extension']) {
  if(!current)return true;
  if(!incoming)return false;
  if(incoming.id!==current.id)return incoming.at>=current.at;
  const oldAt=current.confirmation?.at??current.at,newAt=incoming.confirmation?.at??incoming.at;
  if(newAt!==oldAt)return newAt>oldAt;
  if(current.state==='disputed'&&incoming.state==='confirmed')return false;
  if(current.state!=='pending'&&incoming.state==='pending')return false;
  return true;
}
function newerSpeech(incoming: RecordView['speechStatus'], current: RecordView['speechStatus']) {
  if(!incoming)return false;
  if(!current)return true;
  if(incoming.epoch!==current.epoch)return incoming.epoch>current.epoch;
  if(incoming.at<current.at)return false;
  if(incoming.id!==current.id)return incoming.at>=current.at;
  if(['completed','canceled','failed'].includes(current.state)&&['preparing','playing'].includes(incoming.state))return false;
  return incoming.at>current.at||(incoming.playedMs??0)>=(current.playedMs??0);
}
function newerCheck(incoming: RecordView['monitor'], current: RecordView['monitor']) {
  if(!incoming)return false;
  if(!current)return true;
  if(incoming.sequence!==current.sequence)return incoming.sequence>current.sequence;
  if(current.status!=='checking'&&incoming.status==='checking')return false;
  return (incoming.completedAt??incoming.capturedAt)>=(current.completedAt??current.capturedAt);
}
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
    // Approved responses are persisted independently of participant turns. An
    // older HTTP snapshot must not erase an already-observed response event.
    const replies=new Map((meeting.interventions??[]).map(item=>[item.id,item]));
    for(const item of this.meeting.interventions??[])if(!replies.has(item.id))replies.set(item.id,item);
    meeting={...meeting,interventions:[...replies.values()].sort((a,b)=>a.at-b.at)};

    if (
      meeting.epoch !== this.meeting.epoch ||
      meeting.paused ||
      meeting.phase !== "live"
    )
      this.intervention = null;
    if(!newerCheck(meeting.monitor,this.meeting.monitor)) {
      meeting={...meeting,monitor:this.meeting.monitor};
    }
    if((meeting.revisions?.length??0)<(this.meeting.revisions?.length??0)) {
      meeting={...meeting,plan:this.meeting.plan,revisions:this.meeting.revisions};
    }
    if(!newerExtension(meeting.extension,this.meeting.extension))meeting={...meeting,extension:this.meeting.extension};
    const oldSpeech=this.meeting.speechStatus,incomingSpeech=meeting.speechStatus;
    if(oldSpeech && !newerSpeech(incomingSpeech,oldSpeech))meeting={...meeting,speechStatus:oldSpeech};
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
        if (!m.paused && m.phase === "live" && typeof data?.text === "string") {
          this.intervention = data;
          if(typeof data.id==='string'&&Number.isFinite(data.at)&&typeof data.kind==='string') {
            const items=m.interventions??=[];
            if(!items.some(item=>item.id===data.id))items.push({id:data.id,at:data.at,text:data.text,kind:data.kind});
          }
        }
        return false;
      case "moderator.control":
        this.intervention = null;
        if (Number.isInteger(data?.epoch))
          m.epoch = Math.max(m.epoch, data.epoch);
        if (data?.type === "pause") m.paused = true;
        if (data?.type === "resume") m.paused = false;
        return true;
      case "meeting.check":
        if(data?.epoch===m.epoch && Number.isSafeInteger(data?.sequence) && newerCheck(data,m.monitor))m.monitor=data;
        return false;
      case "speech.status":
        if(data?.epoch >= m.epoch && newerSpeech(data,m.speechStatus))m.speechStatus=data;
        return false;
      case "meeting.status":
        if(data?.epoch < m.epoch)return false;
        m.liveStatus={at:data.at,assessmentState:data.assessmentState,destination:data.destination,callState:data.callState};
        if(data?.assessmentAt && (!m.assessmentAt || data.assessmentAt>m.assessmentAt))return true;
        return false;
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
