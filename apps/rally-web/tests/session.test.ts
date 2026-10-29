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
