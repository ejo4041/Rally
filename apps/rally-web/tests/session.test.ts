import test from "node:test";
import assert from "node:assert/strict";
import { MeetingSession } from "../src/session.ts";
import type { RecordView } from "../src/api.ts";
import type { LiveEvent } from "../../rally-api/src/contracts.ts";
function fixture() {
  return {
    id: "one",
    phase: "live",
    epoch: 1,
    paused: false,
    turns: [],
    speakerNames: {},
  } as unknown as RecordView;
}
function event(
  type: string,
  data: unknown,
  id = crypto.randomUUID(),
): LiveEvent {
  return { version: 1, meetingId: "one", id, type, data };
}
test("partial captions remain transient; repeated and stale finals cannot replace canonical evidence", () => {
  const session = new MeetingSession(fixture());
  session.apply(event("transcript.partial", { text: "A partial" }));
  assert.equal(session.meeting.turns.length, 0);
  const turn = {
    id: "session:1",
    revision: 2,
    text: "Thursday",
    sessionId: "session",
    turnId: 1,
    speaker: "session:A",
    startMs: null,
    endMs: null,
  };
  const final = event("transcript.final", turn);
  session.apply(final);
  session.apply(final);
  session.apply(
    event("transcript.final", { ...turn, revision: 1, text: "Friday" }),
  );
  assert.equal(session.meeting.turns.length, 1);
  assert.equal(session.meeting.turns[0].text, "Thursday");
  assert.equal(session.partial, "");
});
test("recommendations are never interventions; controls, snapshots and unrelated events cannot resurrect a prompt", () => {
  const session = new MeetingSession(fixture());
  session.apply(
    event("assessment", { intervention: { text: "Not approved" } }),
  );
  assert.equal(session.intervention, null);
  session.apply(
    event("intervention", {
      id: "i",
      text: "Back to the agenda",
      kind: "redirect",
    }),
  );
  assert.deepEqual(session.intervention, {
    id: "i",
    text: "Back to the agenda",
    kind: "redirect",
  });
  session.apply(event("moderator.control", { type: "pause", epoch: 2 }));
  assert.equal(session.intervention, null);
  session.apply(event("intervention", { text: "Late" }));
  assert.equal(session.intervention, null);
  const other = event("intervention", { text: "Other meeting" });
  other.meetingId = "two";
  session.apply(other);
  assert.equal(session.intervention, null);
  session.replace({ ...fixture(), epoch: 3, phase: "ended" });
  assert.equal(session.intervention, null);
});
test("speaker mappings remain session scoped across authoritative refreshes", () => {
  const m = fixture();
  m.speakerNames = { "session-1:A": "Priya" };
  const session = new MeetingSession(m);
  session.replace({
    ...m,
    speakerNames: { ...m.speakerNames, "session-2:A": "Alex" },
  });
  assert.equal(session.meeting.speakerNames["session-1:A"], "Priya");
  assert.equal(session.meeting.speakerNames["session-2:A"], "Alex");
});

test("late prompts and controls from an older epoch cannot undo resume or dismiss the current prompt", () => {
  const session = new MeetingSession(fixture());
  session.apply(event("moderator.control", { type: "pause", epoch: 2 }));
  session.apply(event("moderator.control", { type: "resume", epoch: 3 }));
  session.apply(
    event("intervention", {
      id: "current",
      text: "Current approved prompt",
      kind: "clarify",
      epoch: 3,
    }),
  );
  for (const data of [
    { type: "pause", epoch: 2 },
    { type: "dismiss", epoch: 1 },
  ]) {
    const late = event("moderator.control", data);
    assert.equal(session.isStaleControl(late), true);
    session.apply(late);
  }
  session.apply(
    event("intervention", {
      id: "old",
      text: "Old prompt",
      kind: "clarify",
      epoch: 1,
    }),
  );
  assert.equal(session.meeting.paused, false);
  assert.equal(session.meeting.epoch, 3);
  assert.equal(session.intervention?.id, "current");
});

test("a late HTTP snapshot cannot regress a finalized revision or a host control", () => {
  const session = new MeetingSession(fixture());
  const turn = {
    id: "s:0",
    sessionId: "s",
    turnId: 0,
    text: "Friday",
    speaker: "s:A",
    revision: 2,
    startMs: null,
    endMs: null,
  };
  session.apply(event("transcript.final", turn));
  session.replace({
    ...fixture(),
    turns: [{ ...turn, revision: 1, text: "Thursday" }],
  });
  assert.equal(session.meeting.turns[0].text, "Friday");
  session.apply(event("moderator.control", { type: "pause", epoch: 2 }));
  session.replace(fixture());
  assert.equal(session.meeting.paused, true);
  assert.equal(session.meeting.epoch, 2);
});

test("a continuity notice clears transient output without ending capture or changing pause state", () => {
  const session = new MeetingSession(fixture());
  session.partial = "Transient words";
  session.intervention = { id: "i", text: "Old prompt", kind: "clarify" };
  assert.equal(
    session.apply(
      event("transcription.gap", {
        reason: "Source restarted; check continuity",
      }),
    ),
    true,
  );
  assert.equal(session.partial, "");
  assert.equal(session.intervention, null);
  assert.equal(session.meeting.phase, "live");
  assert.equal(session.meeting.paused, false);
  assert.match(session.notice, /Source restarted/);
});

test("delayed finals preserve a newer scoped caption and late partials cannot resurrect finalized text", () => {
  const session = new MeetingSession(fixture());
  const turn = (sessionId: string, turnId: number) => ({
    id: `${sessionId}:${turnId}`,
    sessionId,
    turnId,
    revision: 1,
    text: "Final words",
    speaker: null,
    startMs: null,
    endMs: null,
  });
  session.apply(event("transcript.partial", {
    sessionId: "new",
    turnId: -3,
    text: "Newer live words",
  }));
  session.apply(event("transcript.final", turn("new", 90)));
  assert.equal(session.partial, "Newer live words");
  // Turn numbers repeat across sessions; a different source cannot clear it.
  session.apply(event("transcript.final", turn("old", -3)));
  assert.equal(session.partial, "Newer live words");
  session.apply(event("transcript.partial", {
    sessionId: "new",
    turnId: 90,
    text: "Late old words",
  }));
  assert.equal(session.partial, "Newer live words");
  session.apply(event("transcript.final", turn("new", -3)));
  assert.equal(session.partial, "");
  session.apply(event("transcript.partial", {
    sessionId: "new",
    turnId: -3,
    text: "Late duplicate",
  }));
  assert.equal(session.partial, "");
  session.apply(event("transcript.partial", {
    sessionId: "third",
    turnId: -3,
    text: "Next session",
  }));
  session.replace({
    ...session.meeting,
    turns: [...session.meeting.turns, turn("third", -3)],
  });
  assert.equal(session.partial, "");
  session.apply(event("transcript.partial", {
    sessionId: "third",
    turnId: 4,
    text: "Interrupted",
  }));
  session.apply(event("capture.gap", { reason: "Audio disconnected" }));
  assert.equal(session.partial, "");
});

test('older snapshots and check events cannot replace a newer live observation or agenda',()=>{
 const session=new MeetingSession(fixture());
 const check={id:'c2',sequence:2,capturedAt:2000,completedAt:2200,status:'accepted',epoch:1,planRevision:1,decision:{health:4,feeling:'curious' as const,observation:'Useful exploration',progress:'',concern:'',evidence:[],intervention:null,agendaChange:null,extension:null,extensionConsent:null}};
 session.apply(event('meeting.check',check));
 session.replace({...fixture(),monitor:{...check,id:'c1',sequence:1,capturedAt:1000}} as RecordView);
 assert.equal(session.meeting.monitor?.id,'c2');
 session.apply(event('meeting.check',{...check,status:'checking',completedAt:undefined,decision:undefined}));
 assert.equal(session.meeting.monitor?.status,'accepted');
 session.apply(event('meeting.check',{...check,id:'c0',sequence:0}));
 assert.equal(session.meeting.monitor?.id,'c2');
});

test('late playback events and snapshots never resurrect completed speech',()=>{
 const session=new MeetingSession(fixture());
 const completed={id:'new',interventionId:'i',epoch:1,at:5000,state:'completed',destination:'browser',playedMs:2000};
 session.apply(event('speech.status',completed));
 session.apply(event('speech.status',{...completed,state:'playing'}));
 assert.equal(session.meeting.speechStatus?.state,'completed');
 session.apply(event('speech.status',{...completed,id:'old',at:4000,state:'playing'}));
 assert.equal(session.meeting.speechStatus?.id,'new');
 session.replace({...fixture(),speechStatus:{...completed,state:'playing'}} as RecordView);
 assert.equal(session.meeting.speechStatus?.state,'completed');
});
