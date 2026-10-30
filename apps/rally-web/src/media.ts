import { presenceScene, presenceVoice, presenceSpeech } from "./presence.ts";
import { Room, RoomEvent, LocalAudioTrack, Track } from "livekit-client";
import type { LiveEvent } from "../../rally-api/src/contracts.ts";
import { api, APIError, type Connection } from "./api.ts";
export type AudioInput = {
  stream: MediaStream;
  sources: { kind: "tab" | "microphone"; stream: MediaStream }[];
  close: () => void;
};
export async function acquireAudio(
  mode: string,
  includeMic: boolean,
  signal: AbortSignal,
  onEnded: () => void,
): Promise<AudioInput> {
  const sources: MediaStream[] = [];
  let context: AudioContext | undefined,
    closed = false;
  const close = () => {
    closed = true;
    for (const s of sources)
      for (const t of s.getTracks()) {
        t.onended = null;
        t.stop();
      }
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
  };
  const guard = () => {
    if (closed || signal.aborted)
      throw new DOMException("Audio selection canceled.", "AbortError");
  };
  signal.addEventListener("abort", close, { once: true });
  try {
    guard();
    if (mode === "tab") {
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error(
          "Meeting-tab capture needs a desktop browser with tab-audio sharing.",
        );
      const tab = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        selfBrowserSurface: "exclude",
        systemAudio: "exclude",
      } as DisplayMediaStreamOptions);
      sources.push(tab);
      guard();
      if (tab.getVideoTracks()[0]?.getSettings().displaySurface !== "browser")
        throw new Error(
          "Choose the meeting browser tab, rather than a screen or window.",
        );
      if (!tab.getAudioTracks().some((t) => t.readyState === "live"))
        throw new Error(
          "No tab audio was shared. Choose the call tab and enable Share tab audio.",
        );
    }
    if (mode !== "tab" || includeMic) {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      sources.push(mic);
      guard();
    }
    if (sources.some((s) => s.getTracks().some((t) => t.readyState !== "live")))
      throw new Error("Audio sharing ended during setup.");
    for (const s of sources)
      for (const t of s.getTracks())
        t.onended = () => {
          if (!closed) {
            close();
            onEnded();
          }
        };
    let stream: MediaStream;
    if (sources.length === 1)
      stream = new MediaStream(sources[0].getAudioTracks());
    else {
      context = new AudioContext();
      await context.resume();
      guard();
      const destination = context.createMediaStreamDestination();
      for (const s of sources) {
        const gain = context.createGain();
        gain.gain.value = 1 / sources.length;
        context
          .createMediaStreamSource(new MediaStream(s.getAudioTracks()))
          .connect(gain)
          .connect(destination);
      }
      stream = destination.stream;
      sources.push(stream);
    }
    return {
      sources: sources
        .slice(0, mode === "tab" && includeMic ? 2 : 1)
        .map((stream, index) => ({
          kind:
            mode === "tab" && index === 0
              ? ("tab" as const)
              : ("microphone" as const),
          stream,
        })),
      stream,
      close: () => {
        signal.removeEventListener("abort", close);
        close();
      },
    };
  } catch (error) {
    signal.removeEventListener("abort", close);
    close();
    throw error;
  }
}
export class MeetingMedia {
  room: Room | null = null;
  private track: LocalAudioTrack | null = null;
  private audio: AudioInput | null = null;
  private leaseTimer?: ReturnType<typeof setInterval>;
  private muted = false;
  private mediaConnected = false;
  private shielded = false;
  private elements = new Set<HTMLMediaElement>();
  private playbackClocks = new Map<
    HTMLMediaElement,
    { timer: ReturnType<typeof setInterval>; id: string; origin: number | null }
  >();
  private revokedSpeech = new Set<string>();
  private activeSpeech: string | null = null;
  private eligibleSpeech: string | null = null;
  private speechEpoch = 0;
  private minimumEpoch = 0;
  private subscribeSpeech() {
    for (const participant of this.room?.remoteParticipants.values() || []) {
      if (participant.identity !== `backend-${this.meetingId}`) continue;
      for (const publication of participant.trackPublications.values()) {
        const parts = publication.trackName.split(":");
        if (parts[0] === "rally-speech")
          publication.setSubscribed(
            parts[1] === "browser" &&
              parts[2] === this.eligibleSpeech &&
              Number(parts[3]) >= this.minimumEpoch &&
              !this.revokedSpeech.has(parts[2]),
          );
      }
    }
  }
  constructor(
    private meetingId: string,
    private onEvent: (event: LiveEvent) => void,
    private onStatus: (status: string) => void,
    private onRecovered: () => void,
    private onPlayback: (
      id: string,
      playedMs: number,
      running: boolean,
    ) => void = () => {},
  ) {}
  async connect(connection: Connection, audio: AudioInput | null) {
    this.audio = audio;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;
    room.on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
      if (
        topic !== "rally" ||
        participant?.identity !== `backend-${this.meetingId}`
      )
        return;
      try {
        const event = JSON.parse(new TextDecoder().decode(bytes));
        if (event.type === "presence.scene") presenceScene(event.data);
        if (event.type === "presence.voice") presenceVoice(event.data);
        if (event.type === "speech.status") {
          const state = event.data;
          if (
            state?.state === "preparing" &&
            state.epoch >= this.minimumEpoch &&
            !this.revokedSpeech.has(state.id)
          ) {
            this.eligibleSpeech = state.id;
            this.speechEpoch = state.epoch;
            this.subscribeSpeech();
          }
          if (["canceled", "failed"].includes(state?.state))
            this.stopSpeech(state.id);
          if (state?.state === "completed") {
            this.revokedSpeech.add(state.id);
            if (this.eligibleSpeech === state.id) this.eligibleSpeech = null;
          }
          if (
            state?.state === "playing" &&
            state.id === this.eligibleSpeech &&
            state.epoch >= this.minimumEpoch
          )
            this.setShielded(true);
          if (["completed", "canceled", "failed"].includes(state?.state))
            this.setShielded(false);
        }
        if (
          event.type === "moderator.control" &&
          Number.isInteger(event.data?.epoch)
        ) {
          this.minimumEpoch = Math.max(this.minimumEpoch, event.data.epoch);
          this.speechEpoch = Math.max(this.speechEpoch, event.data.epoch);
          this.stopSpeech();
        }
        this.onEvent(event);
      } catch {
        this.onStatus(
          "A live update could not be read. Refresh the meeting record.",
        );
      }
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.mediaConnected = false;
      for (const clock of this.playbackClocks.values())
        this.onPlayback(clock.id, 0, false);
      this.onStatus("Reconnecting media. Live updates may be delayed.");
    });
    room.on(RoomEvent.Reconnected, () => {
      this.mediaConnected = true;
      this.onStatus("Connected");
      this.onRecovered();
    });
    room.on(RoomEvent.Disconnected, () => {
      this.mediaConnected = false;
      if (this.room !== room) return;
      this.stopCapture();
      this.onStatus(
        "Audio disconnected. Refresh the record, then reconnect explicitly.",
      );
    });
    room.on(RoomEvent.TrackPublished, () => this.subscribeSpeech());
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity === `backend-${this.meetingId}`
      ) {
        const parts = publication.trackName.split(":");
        if (parts[0] === "rally-speech" && parts.length > 1) {
          if (
            parts[1] !== "browser" ||
            parts[2] !== this.eligibleSpeech ||
            Number(parts[3]) < this.minimumEpoch ||
            this.revokedSpeech.has(parts[2])
          ) {
            publication.setSubscribed(false);
            return;
          }
          this.activeSpeech = parts[2];
        }
        const element = track.attach();
        element.hidden = true;
        document.body.append(element);
        this.elements.add(element);
        element.addEventListener("playing", () =>
          presenceSpeech(element, null),
        );
        element.addEventListener("ended", () => presenceSpeech(null, null));
        const speechId = parts[0] === "rally-speech" ? parts[2] : null;
        if (speechId) {
          const clock = {
            id: speechId,
            origin: null as number | null,
            timer: undefined as unknown as ReturnType<typeof setInterval>,
          };
          let stalled = true,
            lastTime = element.currentTime,
            playedMs = 0,
            wasRunning = false;
          const progress = () => {
            const running =
              this.mediaConnected &&
              !stalled &&
              !element.paused &&
              !element.ended &&
              element.readyState >= 2;
            const now = element.currentTime;
            if (running && wasRunning)
              playedMs += Math.max(0, (now - lastTime) * 1000);
            if (running && clock.origin === null) clock.origin = now;
            lastTime = now;
            wasRunning = running;
            this.onPlayback(speechId, playedMs, running);
          };
          element.addEventListener("playing", () => {
            stalled = false;
            progress();
          });
          for (const event of [
            "waiting",
            "stalled",
            "pause",
            "ended",
            "emptied",
          ])
            element.addEventListener(event, () => {
              stalled = true;
              progress();
            });
          clock.timer = setInterval(progress, 100);
          this.playbackClocks.set(element, clock);
        }
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      for (const element of track.detach()) {
        const clock = this.playbackClocks.get(element);
        if (clock) {
          clearInterval(clock.timer);
          this.onPlayback(clock.id, 0, false);
          this.playbackClocks.delete(element);
        }
        element.remove();
        this.elements.delete(element);
      }
    });
    try {
      await room.connect(connection.url, connection.token, {
        autoSubscribe: false,
      });
      if (
        this.room !== room ||
        (audio !== null &&
          !audio.stream.getAudioTracks().some((t) => t.readyState === "live"))
      )
        throw new Error("Audio sharing ended during connection.");
      if (audio) {
        this.track = new LocalAudioTrack(
          audio.stream.getAudioTracks()[0],
          undefined,
          false,
        );
        await room.localParticipant.publishTrack(this.track, {
          source: Track.Source.Microphone,
        });
        if (
          this.room !== room ||
          this.track.mediaStreamTrack.readyState !== "live"
        )
          throw new Error("Audio sharing ended during publication.");
      }
      this.mediaConnected = true;
      await room.startAudio();
      this.onStatus("Connected");
      if (audio && connection.captureToken) {
        let renewing = false;
        const renew = async () => {
          if (renewing || !this.track) return;
          renewing = true;
          try {
            await api(
              `/meetings/${this.meetingId}/heartbeat`,
              "POST",
              { captureToken: connection.captureToken },
              AbortSignal.timeout(5000),
            );
          } catch (error) {
            if (
              error instanceof APIError &&
              [401, 409].includes(error.status)
            ) {
              this.stopCapture();
              this.onStatus("Audio disconnected; reconnect explicitly.");
            }
          } finally {
            renewing = false;
          }
        };
        void renew();
        this.leaseTimer = setInterval(() => void renew(), 20000);
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  stopSpeech(
    id = this.eligibleSpeech || this.activeSpeech,
    invalidateEpoch = false,
  ) {
    if (invalidateEpoch)
      this.minimumEpoch = Math.max(this.minimumEpoch, this.speechEpoch + 1);
    if (id === this.eligibleSpeech) this.eligibleSpeech = null;
    this.subscribeSpeech();
    if (id) this.revokedSpeech.add(id);
    if (id && id !== this.activeSpeech) return;
    for (const element of this.elements) {
      element.pause();
      element.srcObject = null;
    }
    this.activeSpeech = null;
    this.setShielded(false);
    if (this.revokedSpeech.size > 1000)
      this.revokedSpeech.delete(this.revokedSpeech.values().next().value!);
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.updateGate();
  }
  setShielded(value: boolean) {
    this.shielded = value;
    this.updateGate();
  }
  private updateGate() {
    if (this.track?.mediaStreamTrack)
      this.track.mediaStreamTrack.enabled = !(this.muted || this.shielded);
  }
  stopCapture() {
    clearInterval(this.leaseTimer);
    this.leaseTimer = undefined;
    this.audio?.close();
    this.audio = null;
    this.track?.stop();
    if (this.track && this.room)
      void this.room.localParticipant
        .unpublishTrack(this.track)
        .catch(() => {});
    this.track = null;
  }
  async close() {
    this.mediaConnected = false;
    this.stopCapture();
    const room = this.room;
    this.room = null;
    await room?.disconnect();
    for (const [element, clock] of this.playbackClocks) {
      clearInterval(clock.timer);
      this.onPlayback(clock.id, 0, false);
      element.pause();
    }
    this.playbackClocks.clear();
    for (const element of this.elements) element.remove();
    this.elements.clear();
  }
}
