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
  private muted = false;
  private shielded = false;
  private elements = new Set<HTMLMediaElement>();
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private heartbeatAbort?: AbortController;
  constructor(
    private meetingId: string,
    private onEvent: (event: LiveEvent) => void,
    private onStatus: (status: string) => void,
    private onRecovered: () => void,
  ) {}
  async connect(connection: Connection, audio: AudioInput) {
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
        this.onEvent(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        this.onStatus(
          "A live update could not be read. Refresh the meeting record.",
        );
      }
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.onStatus("Reconnecting media. Live updates may be delayed.");
    });
    room.on(RoomEvent.Reconnected, () => {
      this.onStatus("Connected");
      this.onRecovered();
    });
    room.on(RoomEvent.Disconnected, () => {
      if (this.room !== room) return;
      this.stopCapture();
      this.onStatus(
        "Audio disconnected. Refresh the record, then reconnect explicitly.",
      );
    });
    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity === `backend-${this.meetingId}`
      ) {
        const element = track.attach();
        element.hidden = true;
        document.body.append(element);
        this.elements.add(element);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      for (const element of track.detach()) {
        element.remove();
        this.elements.delete(element);
      }
    });
    try {
      await room.connect(connection.url, connection.token);
      if (
        this.room !== room ||
        !audio.stream.getAudioTracks().some((t) => t.readyState === "live")
      )
        throw new Error("Audio sharing ended during connection.");
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
      await room.startAudio();
      this.onStatus("Connected");
      this.startHeartbeat(connection);
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.updateGate();
  }
  private startHeartbeat(connection: Connection) {
    const renew = async () => {
      if (!this.track || this.track.mediaStreamTrack.readyState !== "live" || this.heartbeatAbort)
        return;
      const controller = new AbortController();
      this.heartbeatAbort = controller;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await api(`/meetings/${this.meetingId}/heartbeat`, "POST", {
          captureToken: connection.captureToken,
        }, controller.signal);
      } catch (error) {
        if (!this.track || controller.signal.aborted) return;
        if (error instanceof APIError && [401, 409].includes(error.status)) {
          this.stopCapture();
          this.onStatus("Audio disconnected. Refresh the record, then reconnect explicitly.");
        } else {
          this.onStatus("Connection check unavailable. Audio will stop if the connection cannot be restored.");
        }
      } finally {
        clearTimeout(timeout);
        if (this.heartbeatAbort === controller) this.heartbeatAbort = undefined;
      }
    };
    void renew();
    this.heartbeatTimer = setInterval(() => void renew(), 20000);
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
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    this.heartbeatAbort?.abort();
    this.heartbeatAbort = undefined;
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
    this.stopCapture();
    const room = this.room;
    this.room = null;
    await room?.disconnect();
    for (const element of this.elements) element.remove();
    this.elements.clear();
  }
}
