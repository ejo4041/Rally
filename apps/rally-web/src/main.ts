import {
  api,
  APIError,
  type User,
  type Summary,
  type RecordView,
  type Meeting,
  type Plan,
  type Connection,
} from "./api.ts";
import { setupFollowUp } from "./follow-up.ts";
import { createSpeechPlayer } from "./speech.ts";
import { setupAudioCheck } from "./audio-check.ts";
import { setupTeams } from "./teams.ts";
import { MeetingSession } from "./session.ts";
import { MeetingMedia, acquireAudio, type AudioInput } from "./media.ts";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);
const dialog = (id: string) => $<HTMLDialogElement>(id);
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const label = (v: string) =>
  v.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
const state = {
  user: null as User | null,
  history: [] as Summary[],
  session: null as MeetingSession | null,
  media: null as MeetingMedia | null,
  capture: null as AudioInput | null,
  selecting: null as AbortController | null,
  busy: false,
  muted: false,
  status: "",
  generation: 0,
  authMode: "login",
  speakerId: "",
  pendingRefresh: false,
  pollBusy: false,
  ending: false,
};
const speech = createSpeechPlayer({
  current: (prompt) => {
    const s = state.session;
    return (
      !!s &&
      input("spoken-prompts").checked &&
      !!state.capture &&
      !s.meeting.paused &&
      s.meeting.phase === "live" &&
      s.meeting.epoch === prompt.epoch &&
      s.intervention?.id === prompt.id
    );
  },
  status: (message, shielded) => {
    state.media?.setShielded(shielded);
    $("speech-status").textContent = message;
    button("stop-speaking").hidden = !speech.isActive();
    if (shielded)
      $("capture-label").textContent = "Audio shielded while Rally speaks";
  },
});
const audioCheck = setupAudioCheck();
const followUp = setupFollowUp(() => state.session?.meeting);
const teams = setupTeams((id) => {
  void loadHistory().catch(fail);
  location.hash = `meeting/${id}`;
}, fail);
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 7000);
}
function fail(error: unknown) {
  if (error instanceof APIError && error.status === 401) {
    void signOutLocal();
    $("auth-error").textContent = "Your session expired. Sign in again.";
    return;
  }
  toast(
    error instanceof Error
      ? error.message
      : "Something went wrong. Refresh the record before retrying.",
  );
}
function canNavigate() {
  if (state.capture || state.selecting || state.busy) {
    toast("End or disconnect the current audio session before leaving.");
    return false;
  }
  return true;
}
function showAuth() {
  $("auth-screen").hidden = false;
  $("workspace").hidden = true;
}
async function signOutLocal() {
  speech.cancel();
  followUp.clear();
  input("spoken-prompts").checked = false;
  audioCheck.stop();
  teams.reset();
  showAuth();
  $("meeting").hidden = true;
  $("home").hidden = false;
  state.user = null;
  state.generation++;
  state.selecting?.abort();
  state.selecting = null;
  state.capture?.close();
  state.capture = null;
  const media = state.media;
  state.media = null;
  state.user = null;
  state.session = null;
  state.history = [];
  $("transcript").replaceChildren();
  $("report-body").replaceChildren();
  $("recent").replaceChildren();
  $("history").replaceChildren();
  for (const id of [
    "meeting-title",
    "meeting-meta",
    "guidance",
    "progress",
    "assessment-note",
    "plan",
    "revisions",
    "speakers",
    "participant-names",
    "plan-editor",
    "current-user",
  ])
    $(id).replaceChildren();
  for (const id of [
    "create-form",
    "plan-form",
    "speaker-form",
    "correction-form",
  ])
    $<HTMLFormElement>(id).reset();
  for (const d of document.querySelectorAll("dialog")) d.close();
  showAuth();
  await media?.close();
}
async function signedIn(user: User) {
  state.authMode = "login";
  $("auth-title").textContent = "Welcome back";
  button("auth-submit").textContent = "Sign in";
  button("auth-toggle").textContent = "Create an account";
  input("password").autocomplete = "current-password";
  state.user = user;
  $("auth-screen").hidden = true;
  $("workspace").hidden = false;
  $("current-user").textContent = user.username;
  input("password").value = "";
  await loadHistory();
  await teams.refresh();
  await route();
}
async function loadHistory() {
  const userId = state.user?.id,
    rows = await api<Summary[]>("/meetings");
  if (state.user?.id !== userId) return;
  state.history = rows;
  const row = (m: Summary) =>
    `<button class="history-row" data-meeting="${escape(m.id)}"><span><strong>${escape(m.title)}</strong><small>${escape(new Date(m.createdAt).toLocaleString())} · Report ${escape(m.reportStatus)}</small></span><span class="pill">${escape(label(m.phase))}</span></button>`;
  $("history").innerHTML = rows.length
    ? rows.map(row).join("")
    : '<div class="empty">Your next good meeting starts here.<br>Create a meeting to prepare your agenda.</div>';
  $("recent").innerHTML = rows
    .slice(0, 8)
    .map(
      (m) =>
        `<button data-meeting="${escape(m.id)}">${escape(m.title)}</button>`,
    )
    .join("");
}
function home() {
  speech.cancel();
  audioCheck.stop();
  const media = state.media;
  state.media = null;
  void media?.close();
  state.session = null;
  state.generation++;
  $("home").hidden = false;
  $("meeting").hidden = true;
  $("breadcrumb").textContent = "Workspace / Meetings";
}
async function route() {
  if (!state.user) return;
  const match = location.hash.match(/^#meeting\/([\w-]+)$/);
  if (!match) {
    if (!canNavigate() && state.session) {
      location.hash = `meeting/${state.session.meeting.id}`;
      return;
    }
    home();
    return;
  }
  const id = match[1];
  if (state.session?.meeting.id === id) return;
  if (!canNavigate()) {
    if (state.session) location.hash = `meeting/${state.session.meeting.id}`;
    return;
  }
  speech.cancel();
  followUp.clear();
  input("spoken-prompts").checked = false;
  audioCheck.stop();
  const generation = ++state.generation;
  const media = state.media;
  state.media = null;
  await media?.close();
  if (generation !== state.generation) return;
  const meeting = await api<RecordView>(`/meetings/${id}`);
  if (generation !== state.generation) return;
  state.session = new MeetingSession(meeting);
  for (const d of document.querySelectorAll("dialog")) d.close();
  state.ending = false;
  input("restart-session").checked = false;
  state.status =
    meeting.phase === "live"
      ? "This meeting is active on the server. Audio is off here; reconnect explicitly."
      : "";
  state.muted = false;
  input("consent").checked = false;
  $("home").hidden = true;
  $("meeting").hidden = false;
  $("breadcrumb").textContent = "Workspace / Meeting";
  render();
}
function mergeMeeting(meeting: Meeting) {
  const session = state.session;
  if (session?.meeting.id === meeting.id)
    session.replace({ ...meeting, turns: session.meeting.turns });
}
async function refresh() {
  const session = state.session;
  if (!session || state.pollBusy) return;
  state.pollBusy = true;
  try {
    const meeting = await api<RecordView>(`/meetings/${session.meeting.id}`);
    if (state.session !== session) return;
    session.replace(meeting);
    if (meeting.phase !== "live") stopCapture();
    if (
      meeting.phase === "ended" &&
      meeting.reportStatus !== "processing" &&
      state.media
    ) {
      const media = state.media;
      state.media = null;
      await media.close();
      state.status = "";
    }
    render();
  } catch (error) {
    fail(error);
  } finally {
    state.pollBusy = false;
    if (state.pendingRefresh) {
      state.pendingRefresh = false;
      void refresh();
    }
  }
}
function scheduleRefresh() {
  if (state.pendingRefresh) return;
  state.pendingRefresh = true;
  setTimeout(() => {
    if (!state.pollBusy) {
      state.pendingRefresh = false;
      void refresh();
    }
  }, 80);
}
function topicHTML(plan: Plan | null) {
  if (!plan)
    return '<p class="empty-note">Agenda preparation has not completed. Retry or enter a plan.</p>';
  return (
    `<div class="topic"><p>${escape(plan.objective)}</p></div>` +
    plan.topics
      .map(
        (t) =>
          `<div class="topic ${escape(t.status)}"><span class="topic-minutes">${escape(t.minutes)} min · ${escape(label(t.status))}</span><h3>${escape(t.title)}</h3><p>${escape(t.outcome)}</p></div>`,
      )
      .join("") +
    `<div class="topic"><p>Wrap-up ${escape(plan.wrapMinutes)} min · Total ${escape(plan.durationMinutes)} min</p></div>`
  );
}
function speakerName(id: string | null) {
  if (!id) return "Unknown speaker";
  const sessions = [
    ...new Set(state.session?.meeting.turns.map((t) => t.sessionId) || []),
  ];
  const session = sessions.indexOf(id.slice(0, id.lastIndexOf(":"))) + 1;
  return (
    state.session?.meeting.speakerNames[id] ||
    `Speaker ${id.slice(id.lastIndexOf(":") + 1)} · session ${session || "?"}`
  );
}
function evidence(ids: string[]) {
  return `<div class="evidence">${ids.map((id, i) => `<button data-evidence="${escape(id)}">Source ${i + 1} ↗</button>`).join("")}</div>`;
}
function render() {
  speech.validate();
  followUp.validate();
  const session = state.session;
  for (const id of [
    "back",
    "home-nav",
    "new-nav",
    "mobile-home",
    "logout",
    "mobile-logout",
  ])
    button(id).disabled = state.busy;
  if (!session) return;
  const m = session.meeting,
    live = m.phase === "live",
    pre =
      ["draft", "ready", "interrupted"].includes(m.phase) ||
      (live && !state.capture && !state.media);
  $("meeting-title").textContent = m.title;
  $("meeting-meta").textContent =
    `${m.durationMinutes} minutes planned · ${m.participants.length} roster names${m.paused ? " · Moderator paused" : ""}`;
  $("phase").textContent = label(m.phase);
  const error = m.error || session.notice;
  $("record-error").hidden = !error;
  $("record-error").textContent = error || "";
  $("connection-status").hidden = !state.status;
  $("connection-status").textContent = state.status;
  $("restart-session-label").hidden = !(live && !state.capture);
  $("start-panel").hidden = !pre;
  button("test-voice").disabled =
    state.busy || !!state.capture || m.phase === "live";
  button("check-audio").disabled = state.busy || !!state.capture;
  button("start").disabled = state.busy || !m.plan || !input("consent").checked;
  button("start").textContent = state.selecting
    ? "Selecting audio…"
    : live
      ? "Reconnect audio"
      : m.phase === "interrupted"
        ? "Restart interrupted capture"
        : "Start meeting";
  button("cancel-start").hidden = !state.selecting;
  button("prepare").hidden = !["draft", "ready"].includes(m.phase);
  button("prepare").disabled = state.busy;
  button("edit-plan").disabled =
    state.busy ||
    m.reportStatus === "processing" ||
    !["draft", "ready", "live"].includes(m.phase);
  button("delete").disabled =
    state.busy || !!state.media || m.reportStatus === "processing" || live;
  $("plan").innerHTML = topicHTML(m.plan);
  $("revisions").innerHTML =
    `<h3>Original plan</h3>${topicHTML(m.originalPlan)}${m.revisions.map((r) => `<div class="revision"><strong>${escape(new Date(r.at).toLocaleTimeString())}</strong><p>${escape(r.reason)}</p>${topicHTML(r.plan)}</div>`).join("")}`;
  $("health").textContent =
    m.assessment?.health == null
      ? "Unscored"
      : `Health ${m.assessment.health}/5`;
  $("guidance").textContent =
    session.intervention?.text ||
    (m.phase === "ended"
      ? "The conversation ends. Your record stays."
      : m.paused
        ? "Rally is paused. Transcription continues."
        : "You lead the meeting. Rally helps it move forward.");
  $("progress").textContent = m.progress || "";
  if(m.speechTransport==='livekit')input("spoken-prompts").checked=m.speechEnabled!==false;
  if(m.speechStatus) $("speech-status").textContent=`Voice: ${m.speechStatus.state} · ${m.speechStatus.destination === 'teams' ? 'Teams call only' : 'browser speakers'}${m.speechStatus.error ? ' · '+m.speechStatus.error : ''}`;
  button("stop-speaking").hidden = !(speech.isActive() || ["preparing","playing"].includes(m.speechStatus?.state || ""));
  $("assessment-note").textContent = m.assessment
    ? `${m.assessmentAt ? "Assessed " + Math.floor((Date.now()-m.assessmentAt)/1000) + "s ago · " : ""}${m.assessment.reason}${m.assessment.issues.length ? " · " + m.assessment.issues.map(label).join(", ") : ""}`
    : "";
  renderTranscript();
  $("partial").textContent = session.partial;
  const speakerIds = [
    ...new Set(m.turns.flatMap((t) => (t.speaker ? [t.speaker] : []))),
  ];
  $("speakers").innerHTML = speakerIds.length
    ? speakerIds
        .map(
          (id) =>
            `<button data-speaker="${escape(id)}">${escape(speakerName(id))} · edit name</button>`,
        )
        .join("")
    : '<p class="small muted">No attributable voices yet.</p>';
  $("controls").hidden = !(live || state.capture);
  $("capture-label").textContent = state.capture
    ? speech.isPlaying()
      ? "Audio shielded while Rally speaks"
      : state.muted
        ? "Audio muted"
        : "Listening · Muse transcription"
    : "Audio off here";
  button("mute").disabled = !state.capture || state.busy;
  button("mute").textContent = state.muted ? "Unmute audio" : "Mute audio";
  button("pause").textContent = m.paused ? "Resume Rally" : "Pause Rally";
  for (const name of ["pause", "request-guidance", "dismiss", "end"])
    button(name).disabled = state.busy;
  button("request-guidance").disabled = state.busy || m.paused;
  renderReport();
}
let transcriptKey = "";
function renderTranscript() {
  const session = state.session!;
  const m = session.meeting;
  const key =
    m.id +
    JSON.stringify(m.speakerNames) +
    m.turns.map((t) => `${t.id}@${t.revision}`).join("|");
  if (key === transcriptKey) return;
  transcriptKey = key;
  const box = $("transcript"),
    atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = m.turns.length
    ? m.turns
        .map(
          (t) =>
            `<article class="turn" id="turn-${escape(encodeURIComponent(t.id))}"><div class="turn-meta"><strong>${escape(speakerName(t.speaker))}</strong>${t.speaker ? `<button class="text" data-speaker="${escape(t.speaker)}">correct</button>` : ""}<time>${t.startMs == null ? "Time unknown" : `${Math.floor(t.startMs / 60000)}:${String(Math.floor(t.startMs / 1000) % 60).padStart(2, "0")}`}</time></div><p>${escape(t.text)}</p></article>`,
        )
        .join("")
    : '<p class="empty-note">Finalized speech will appear here. Unknown identities stay unknown.</p>';
  if (atBottom) box.scrollTop = box.scrollHeight;
}
function renderReport() {
  const m = state.session!.meeting,
    r = m.report;
  const current = r && m.reportStatus === "ready";
  button("draft-follow-up").hidden = !current || m.phase === "live";
  $("report-status").textContent =
    label(m.reportStatus) +
    (current && m.reportStale ? " · needs refresh" : "");
  button("retry-report").hidden = !(
    ["ended", "interrupted"].includes(m.phase) &&
    (m.reportStatus === "failed" ||
      m.reportStatus === "none" ||
      (m.reportStatus === "ready" && !!m.reportStale))
  );
  button("retry-report").disabled = state.busy;
  button("retry-report").textContent = m.reportStale
    ? "Reanalyze · uses Muse"
    : m.reportStatus === "none"
      ? "Analyze · uses Muse"
      : "Retry analysis · uses Muse";
  $("correction-form").hidden = !current;
  if (!current) {
    $("report-body").innerHTML =
      `<p class="muted">${m.reportStatus === "processing" ? "Analyzing the complete transcript. You can return to your meetings; this report continues in the background." : m.reportStatus === "failed" ? "Analysis failed. Check usage and retry explicitly when ready." : ["ended", "interrupted"].includes(m.phase) ? "No full analysis yet. Review usage, then explicitly analyze the saved transcript when ready." : "End the meeting to prepare the full report."}</p>`;
    return;
  }
  const items = (title: string, rows: typeof r.actions) =>
    `<h3>${title}</h3>${rows.length ? rows.map((o) => `<div class="report-item"><p><strong>${escape(o.text)}</strong></p><span class="pill">${escape(label(o.status))}</span><p class="muted small">Owner: ${escape(o.owner || "Unresolved")} · Due: ${escape(o.dueDate || "Unresolved")}</p>${evidence(o.evidence)}${o.followup !== "none" ? `<p class="small">Draft ${escape(o.followup)}: ${escape(o.followupPrompt || "No draft text")}</p>` : ""}</div>`).join("") : '<p class="muted small">None identified.</p>'}`;
  $("report-body").innerHTML =
    `<p class="small muted">AI interpretations grounded in the transcript. Reported agreement is expressed in speech; it is not host confirmation. Follow-ups are drafts.</p><p class="summary">${escape(r.summary)}</p><h3>Overall ${r.overall == null ? "Unscored" : `${r.overall}/5`} · ${r.coverage}/5 categories assessed</h3><div class="score-list">${r.scores.map((s) => `<div class="score"><span>${escape(label(s.category))}</span><strong>${s.score == null ? "Unknown" : `${s.score}/5`}</strong><p>${escape(s.reason)}</p>${evidence(s.evidence)}</div>`).join("")}</div>${items("Decisions", r.decisions)}${items("Due-outs", r.actions)}<h3>Still unresolved</h3>${r.unresolved.length ? `<ul>${r.unresolved.map((v) => `<li>${escape(v)}</li>`).join("")}</ul>` : '<p class="muted small">None identified.</p>'}<h3>Speaker suggestions</h3>${r.speakerTips.length ? r.speakerTips.map((s) => `<div class="report-item"><strong>${escape(speakerName(s.speakerId))}</strong>${s.tips.map((t) => `<p>${escape(t.text)}</p>${evidence(t.evidence)}`).join("")}</div>`).join("") : '<p class="muted small">No attributable suggestions.</p>'}<details><summary>Approximate focus time</summary><p>On topic: ${r.focusTime.onTopicSeconds ?? "Unknown"} seconds · Off topic: ${r.focusTime.offTopicSeconds ?? "Unknown"} seconds · Unknown: ${r.focusTime.unknownSeconds ?? "Unknown"} seconds</p><p>${escape(r.focusTime.note)}</p></details>`;
  if (m.audioExclusions?.length)
    $("report-body").insertAdjacentHTML(
      "afterbegin",
      '<p class="notice" role="status">Input was shielded for Rally’s voice playback. Participant speech during those intervals may be missing, so focus and participation estimates are approximate.</p>',
    );
  if (m.reportStale)
    $("report-body").insertAdjacentHTML(
      "afterbegin",
      m.phase === "live"
        ? '<p class="notice" role="status">This report covers an earlier transcript. Capture has resumed; end the meeting to analyze the complete conversation. Existing conclusions may be outdated.</p>'
        : '<p class="notice" role="status">The meeting changed after this report was generated. Transcript labels are current; names in existing conclusions may be outdated, and newer speech may be missing. Reanalyze explicitly to update conclusions. This uses Muse processing.</p>',
    );
}
async function perform(task: () => Promise<void>) {
  if (state.busy) return;
  state.busy = true;
  render();
  try {
    await task();
  } catch (error) {
    fail(error);
  } finally {
    state.busy = false;
    render();
  }
}
function stopCapture() {
  speech.cancel();
  if (state.session) state.session.partial = "";
  state.selecting?.abort();
  state.selecting = null;
  state.capture?.close();
  state.capture = null;
  state.media?.stopCapture();
  state.muted = false;
}
async function start() {
  audioCheck.stop();
  if (!state.session || !input("consent").checked || state.busy) return;
  const session = state.session,
    id = session.meeting.id;
  const controller = new AbortController();
  state.ending = false;
  state.selecting = controller;
  await perform(async () => {
    let attempted = false;
    try {
      const callMode=input("audio-mode").value==='teams' || (session.meeting.captureSource==='teams' && session.meeting.phase==='live');
      const capture = callMode ? null : await acquireAudio(
        input("audio-mode").value,
        input("include-mic").checked,
        controller.signal,
        () => {
          stopCapture();
          state.status = "Audio sharing ended. Capture is off.";
          render();
          if (!state.busy) void end();
        },
      );
      state.capture = capture;
      if (controller.signal.aborted)
        throw new Error("Audio selection canceled.");
      attempted = true;
      if(callMode && session.meeting.phase!=='live') {
        await api(`/meetings/${id}/teams/connect`,'POST',{meetingUrl:input('live-teams-link').value,consented:true});
        while(true) {
          if(controller.signal.aborted){await api(`/meetings/${id}/teams/leave`,'POST',{});throw new Error('Teams join canceled');}
          const call=await api<{state:string}>(`/meetings/${id}/teams/status`);
          state.status=`Teams: ${call.state}. Admit Rally from the lobby.`;render();
          if(call.state==='connected'){await refresh();break;}
          if(['failed','left'].includes(call.state))throw new Error('Teams did not connect. Check the invitation and retry explicitly.');
          await new Promise(r=>setTimeout(r,500));
        }
      }
      const phase = session.meeting.phase;
      let connection: Connection;
      if (phase === "live" && (callMode || !input("restart-session").checked))
        connection = await api<Connection>(
          `/meetings/${id}/connection`,
          "POST",
          {},
        );
      else {
        const result = await api<{ meeting: Meeting; connection: Connection }>(
          `/meetings/${id}/${phase === "interrupted" || phase === "live" ? "reconnect" : "start"}`,
          "POST",
          { consented: true },
        );
        mergeMeeting(result.meeting);
        connection = result.connection;
      }
      if (controller.signal.aborted)
        throw new Error(
          "Audio sharing ended during setup. Review the server record before reconnecting.",
        );
      const media = new MeetingMedia(
        id,
        (event) => {
          if (state.session !== session) return;
          if (session.isStaleControl(event)) return;
          if (
            event.type === "capture.gap" &&
            !state.ending &&
            session.meeting.phase === "live"
          ) {
            stopCapture();
            const old = state.media;
            state.media = null;
            void old?.close();
            input("consent").checked = false;
            input("restart-session").checked = true;
            state.status =
              "Capture interrupted. Audio is off; review the gap and reconnect explicitly.";
          }
          if (event.type === "plan.updated")
            toast(
              "Plan updated: " +
                String(
                  (event.data as { reason?: string })?.reason ||
                    "Review the revised plan.",
                ),
            );
          if (
            event.type === "speech.cancel" ||
            event.type === "transcription.gap" ||
            event.type === "moderator.control" ||
            event.type === "plan.updated" ||
            event.type === "meeting.ended" ||
            event.type === "capture.gap"
          ) {
            speech.cancel();
            state.media?.stopSpeech();
          }
          if (session.apply(event)) scheduleRefresh();
          if (
            event.type === "intervention" &&
            input("spoken-prompts").checked
          ) {
            const prompt = event.data as {
              id: string;
              text: string;
              epoch: number;
              streaming?: boolean;
            };
            if (
              session.meeting.captureSource!=="teams" &&
              !prompt.streaming &&
              typeof prompt.epoch === "number" &&
              session.intervention?.id === prompt.id
            )
              void speech.speak(id, prompt);
          }
          render();
        },
        (status) => {
          if (state.session !== session) return;
          state.status = status;
          if (status.includes("disconnected")) {
            stopCapture();
            const old = state.media;
            state.media = null;
            void old?.close();
            scheduleRefresh();
          }
          render();
        },
        () => scheduleRefresh(),
      );
      state.media = media;
      await media.connect(connection, capture);
      session.notice = "";
      await refresh();
    } catch (error) {
      stopCapture();
      const media = state.media;
      state.media = null;
      await media?.close();
      state.status = attempted
        ? "Audio is off. The server may have started processing; refresh the record before reconnecting."
        : "No model session was started because audio selection did not complete.";
      if (attempted) await refresh();
      throw error;
    } finally {
      state.selecting = null;
    }
  });
}
async function end() {
  if (!state.session) return;
  const id = state.session.meeting.id;
  state.ending = true;
  stopCapture();
  await perform(async () => {
    state.session!.intervention = null;
    await api(`/meetings/${id}/end`, "POST", {});
    state.status = "Audio stopped. Preparing the saved report.";
    await refresh();
    await loadHistory();
  });
}
async function command(type: string) {
  speech.cancel();
  state.media?.stopSpeech(undefined,type!=='request_guidance');
  if (!state.session) return;
  state.session.intervention = null;
  await perform(async () => {
    const m = await api<Meeting>(
      `/meetings/${state.session!.meeting.id}/commands`,
      "POST",
      { type },
    );
    mergeMeeting(m);
  });
}
function openCreate() {
  if (canNavigate()) {
    $("create-error").textContent = "";
    dialog("create-dialog").showModal();
  }
}
function editorRow(
  id: string,
  title = "",
  outcome = "",
  minutes = 1,
  status = "pending",
) {
  return `<div class="topic-editor" data-topic="${escape(id)}"><label>Topic<input name="title" value="${escape(title)}" maxlength="2000" required></label><label>Intended outcome<input name="outcome" value="${escape(outcome)}" maxlength="2000" required></label><div class="form-row"><label>Minutes<input name="minutes" type="number" min="0.5" max="240" step="0.5" value="${minutes}" required></label><label>Status<select name="status">${["pending", "active", "done", "parked"].map((s) => `<option ${s === status ? "selected" : ""}>${s}</option>`).join("")}</select></label></div><button type="button" class="text" data-remove-topic>Remove topic</button></div>`;
}
button("edit-plan").onclick = () => {
  const m = state.session!.meeting,
    p = m.plan;
  input("plan-objective").value = p?.objective || m.agenda;
  input("plan-duration").value = String(
    p?.durationMinutes || m.durationMinutes,
  );
  input("plan-wrap").value = String(
    p?.wrapMinutes ?? Math.min(5, m.durationMinutes / 5),
  );
  $("plan-editor").innerHTML = p
    ? p.topics
        .map((t) => editorRow(t.id, t.title, t.outcome, t.minutes, t.status))
        .join("")
    : editorRow(
        crypto.randomUUID(),
        "Discussion",
        m.agenda,
        m.durationMinutes - Number(input("plan-wrap").value),
      );
  $("plan-error").textContent = "";
  dialog("plan-dialog").showModal();
};
button("add-topic").onclick = () => {
  if ($("plan-editor").children.length < 20)
    $("plan-editor").insertAdjacentHTML(
      "beforeend",
      editorRow(crypto.randomUUID()),
    );
};
$("plan-form").onsubmit = async (event) => {
  event.preventDefault();
  if (state.busy) return;
  const topics = [
    ...$("plan-editor").querySelectorAll<HTMLElement>("[data-topic]"),
  ].map((row) => ({
    id: row.dataset.topic!,
    title: row.querySelector<HTMLInputElement>("[name=title]")!.value,
    outcome: row.querySelector<HTMLInputElement>("[name=outcome]")!.value,
    minutes: Number(
      row.querySelector<HTMLInputElement>("[name=minutes]")!.value,
    ),
    status: row.querySelector<HTMLSelectElement>("[name=status]")!.value,
  }));
  const plan = {
    objective: input("plan-objective").value,
    topics,
    durationMinutes: Number(input("plan-duration").value),
    wrapMinutes: Number(input("plan-wrap").value),
  };
  if (
    !topics.length ||
    Math.abs(
      topics
        .filter((t) => t.status !== "parked")
        .reduce((n, t) => n + t.minutes, 0) +
        plan.wrapMinutes -
        plan.durationMinutes,
    ) > 0.05
  ) {
    $("plan-error").textContent =
      "Topic budgets plus wrap-up must equal the total duration, with at least one topic.";
    return;
  }
  await perform(async () => {
    try {
      mergeMeeting(
        await api<Meeting>(
          `/meetings/${state.session!.meeting.id}/plan`,
          "PATCH",
          plan,
        ),
      );
      dialog("plan-dialog").close();
      toast("Plan saved.");
    } catch (error) {
      $("plan-error").textContent =
        error instanceof Error ? error.message : "Plan could not be saved.";
    }
  });
};
$("speaker-form").onsubmit = async (event) => {
  event.preventDefault();
  await perform(async () => {
    try {
      mergeMeeting(
        await api<Meeting>(
          `/meetings/${state.session!.meeting.id}/speakers`,
          "PATCH",
          {
            speakerId: state.speakerId,
            name: input("speaker-name").value.trim() || null,
          },
        ),
      );
      dialog("speaker-dialog").close();
    } catch (error) {
      $("speaker-error").textContent =
        error instanceof Error ? error.message : "Name could not be saved.";
    }
  });
};
$("create-form").onsubmit = async (event) => {
  event.preventDefault();
  if (state.busy) return;
  button("create-submit").disabled = true;
  state.busy = true;
  const data = new FormData(event.target as HTMLFormElement);
  try {
    const m = await api<Meeting>("/meetings", "POST", {
      title: data.get("title"),
      agenda: data.get("agenda"),
      durationMinutes: Number(data.get("durationMinutes")),
      participants: String(data.get("participants") || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    });
    dialog("create-dialog").close();
    state.busy = false;
    location.hash = `meeting/${m.id}`;
    await loadHistory();
  } catch (error) {
    $("create-error").textContent =
      error instanceof Error ? error.message : "Meeting could not be prepared.";
  } finally {
    state.busy = false;
    button("create-submit").disabled = false;
  }
};
$("auth-form").onsubmit = async (event) => {
  event.preventDefault();
  button("auth-submit").disabled = true;
  $("auth-error").textContent = "";
  try {
    await signedIn(
      await api<User>(`/auth/${state.authMode}`, "POST", {
        username: input("username").value,
        password: input("password").value,
      }),
    );
  } catch (error) {
    $("auth-error").textContent =
      error instanceof Error ? error.message : "Sign-in failed.";
  } finally {
    button("auth-submit").disabled = false;
  }
};
button("auth-toggle").onclick = () => {
  state.authMode = state.authMode === "login" ? "signup" : "login";
  $("auth-title").textContent =
    state.authMode === "login" ? "Welcome back" : "Create your workspace";
  button("auth-submit").textContent =
    state.authMode === "login" ? "Sign in" : "Create account";
  button("auth-toggle").textContent =
    state.authMode === "login"
      ? "Create an account"
      : "Already have an account? Sign in";
  input("password").autocomplete =
    state.authMode === "login" ? "current-password" : "new-password";
};
button("mobile-logout").onclick = () => button("logout").click();
button("logout").onclick = () =>
  void perform(async () => {
    await api("/auth/logout", "POST", {});
    await signOutLocal();
    location.hash = "";
  });
button("start").onclick = () => void start();
button("cancel-start").onclick = () => state.selecting?.abort();
input("consent").onchange = render;
input("audio-mode").onchange = () => {
  const tab = input("audio-mode").value === "tab";
  $("live-teams-link-label").hidden=input("audio-mode").value!=="teams";
  $("include-mic-label").hidden = !tab;
  $("tab-help").hidden = !tab;
};
button("prepare").onclick = () =>
  void perform(async () => {
    mergeMeeting(
      await api<Meeting>(
        `/meetings/${state.session!.meeting.id}/prepare`,
        "POST",
        {},
      ),
    );
  });
button("mute").onclick = () => {
  state.muted = !state.muted;
  state.media?.setMuted(state.muted);
  render();
};
button("pause").onclick = () =>
  void command(state.session?.meeting.paused ? "resume" : "pause");
button("request-guidance").onclick = () => void command("request_guidance");
button("dismiss").onclick = () => void command("dismiss");
button("end").onclick = () => void end();
button("retry-report").onclick = () =>
  void perform(async () => {
    await api(
      `/meetings/${state.session!.meeting.id}/report/retry`,
      "POST",
      {},
    );
    await refresh();
  });
$("correction-form").onsubmit = (event) => {
  event.preventDefault();
  void perform(async () => {
    await api(`/meetings/${state.session!.meeting.id}/report`, "PATCH", {
      note: input("correction-note").value,
    });
    input("correction-note").value = "";
    await refresh();
  });
};
button("delete").onclick = () => dialog("delete-dialog").showModal();
button("confirm-delete").onclick = () =>
  void perform(async () => {
    await api(`/meetings/${state.session!.meeting.id}`, "DELETE");
    dialog("delete-dialog").close();
    state.busy = false;
    location.hash = "";
    home();
    await loadHistory();
  });
button("export").onclick = () => {
  if (state.session)
    location.href = `/api/meetings/${state.session.meeting.id}/export`;
};
button("usage-button").onclick = () =>
  void (async () => {
    try {
      const rows = await api<
        {
          cost: number | null;
          reserved: number;
          status: string;
          model?: string;
        }[]
      >("/usage");
      const total = rows.reduce((n, r) => n + (r.cost ?? 0), 0),
        unknown = rows.filter((r) => r.cost == null).length;
      $("usage").innerHTML =
        `<h3>$${total.toFixed(6)} recorded · ${unknown} pending or unknown</h3>${rows.map((r) => `<div class="usage-row">${escape(r.model || "Model request")} · ${escape(r.status)}<strong>${r.cost == null ? "Unknown / reserved" : `$${r.cost.toFixed(6)}`}</strong></div>`).join("")}`;
      dialog("usage-dialog").showModal();
    } catch (error) {
      fail(error);
    }
  })();
for (const name of ["home-nav", "back", "mobile-home"])
  button(name).onclick = () => {
    if (canNavigate()) {
      location.hash = "";
      home();
      void loadHistory().catch(fail);
    }
  };
$("brand").onclick = (event) => {
  event.preventDefault();
  button("home-nav").click();
};
for (const name of ["new-nav", "new-meeting"])
  button(name).onclick = openCreate;
button("refresh-history").onclick = () => void loadHistory().catch(fail);
document.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>("button");
  if (!target) return;
  if (target.dataset.close) dialog(target.dataset.close).close();
  if (target.dataset.meeting && canNavigate())
    location.hash = `meeting/${target.dataset.meeting}`;
  if (target.hasAttribute("data-remove-topic"))
    target.closest(".topic-editor")?.remove();
  if (target.dataset.speaker && state.session) {
    state.speakerId = target.dataset.speaker;
    $("speaker-label").textContent = `Session label: ${state.speakerId}`;
    input("speaker-name").value =
      state.session.meeting.speakerNames[state.speakerId] || "";
    $("participant-names").innerHTML = state.session.meeting.participants
      .map((v) => `<option value="${escape(v)}">`)
      .join("");
    $("speaker-error").textContent = "";
    dialog("speaker-dialog").showModal();
  }
  if (target.dataset.evidence) {
    const turn = document.getElementById(
      "turn-" + encodeURIComponent(target.dataset.evidence),
    );
    if (turn) {
      turn.scrollIntoView({ behavior: "smooth", block: "center" });
      turn.classList.add("highlight");
      setTimeout(() => turn.classList.remove("highlight"), 3000);
    }
  }
});
window.addEventListener("rally:session-expired", () => {
  void signOutLocal();
  $("auth-error").textContent = "Your session expired. Sign in again.";
});
window.addEventListener("hashchange", () => void route().catch(fail));
window.addEventListener("beforeunload", (event) => {
  if (state.capture || state.selecting) {
    event.preventDefault();
    event.returnValue = "";
  }
});
setInterval(() => {
  const m = state.session?.meeting;
  if (
    m &&
    (m.phase === "live" ||
      m.phase === "interrupted" ||
      m.reportStatus === "processing")
  )
    void refresh();
}, 3000);
void api<User>("/auth/me")
  .then(signedIn)
  .catch((error) => {
    showAuth();
    if (!(error instanceof APIError && error.status === 401))
      $("auth-error").textContent =
        "Rally API is unavailable. Start the API and refresh.";
  });

button("create-browser-meeting").onclick = () => {
  openCreate();
  input("audio-mode").value = "tab";
  input("audio-mode").dispatchEvent(new Event("change"));
};
setInterval(() => teams.poll(), 3000);

button("check-audio").onclick = () => {
  if (!input("consent").checked) {
    toast("Confirm participant consent before checking audio.");
    input("consent").focus();
    return;
  }
  if (!state.busy && !state.capture)
    void audioCheck.start(
      input("audio-mode").value,
      input("include-mic").checked,
    );
};

input("spoken-prompts").onchange = () => {
  if(state.session?.meeting.speechTransport==='livekit') {
    if(!input('spoken-prompts').checked)state.media?.stopSpeech(undefined,true);
    void command(input('spoken-prompts').checked?'voice_on':'voice_off');return;
  }
  if (!input("spoken-prompts").checked) speech.cancel();
  else
    void api<{ enabled: boolean; ready: boolean }>("/speech/status")
      .then((status) => {
        if (!status.enabled || !status.ready) {
          input("spoken-prompts").checked = false;
          toast(
            "Meta MMS voice is unavailable or warming. Prompts stay visible.",
          );
        }
      })
      .catch(fail);
};
button("stop-speaking").onclick = () => {
  state.media?.stopSpeech(undefined,true);

  speech.cancel();
  if (state.session?.meeting.phase === "live") void command("dismiss");
};

button("test-voice").onclick = () => void speech.test();
