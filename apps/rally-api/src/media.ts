import { AccessToken } from "livekit-server-sdk";
import {
  Room,
  RoomEvent,
  AudioStream,
  TrackKind,
  TrackSource,
  AudioSource,
  AudioFrame,
  LocalAudioTrack,
  TrackPublishOptions,
} from "@livekit/rtc-node";
import type { Media, Meeting, MediaSession, LiveEvent } from "./contracts.ts";
import type { Configuration } from "./config.ts";

export class LiveKitMedia implements Media {
  config: Configuration;
  constructor(config: Configuration) {
    this.config = config;
  }
  async open(
    meeting: Meeting,
    onAudio: (bytes: Uint8Array) => void,
    onGap: (reason: string) => void,
  ): Promise<MediaSession> {
    const room = new Room(),
      roomName = `rally-${meeting.id}`,
      host = `host-${meeting.id}`;
    let stopped = false,
      reader: ReadableStreamDefaultReader<AudioFrame> | undefined,
      trackId: string | undefined;
    const token = async (identity: string, backend: boolean) => {
      const access = new AccessToken(
        this.config.livekitKey,
        this.config.livekitSecret,
        { identity, ttl: "10m" },
      );
      access.addGrant({
        room: roomName,
        roomJoin: true,
        canSubscribe: true,
        canPublish: !backend,
        canPublishData: backend,
        canPublishSources: backend ? [] : [2],
      });
      return access.toJwt();
    };
    room.on(RoomEvent.TrackPublished, (publication, participant) => {
      if (
        participant.identity === host &&
        publication.kind === TrackKind.KIND_AUDIO &&
        publication.source === TrackSource.SOURCE_MICROPHONE &&
        !trackId
      ) {
        trackId = publication.sid;
        publication.setSubscribed(true);
      }
    });
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant.identity !== host || publication.sid !== trackId) return;
      void (async () => {
        const current = new AudioStream(track, {
          sampleRate: 16000,
          numChannels: 1,
          frameSizeMs: 20,
        }).getReader();
        reader = current;
        let last = performance.now();
        try {
          while (!stopped) {
            const { value, done } = await current.read();
            if (done) break;
            const now = performance.now();
            if (now - last > 1000) {
              onGap(
                "Audio consumer stalled; resubscribe to discard stale buffered audio.",
              );
              break;
            }
            last = now;
            onAudio(
              new Uint8Array(
                value.data.buffer,
                value.data.byteOffset,
                value.data.byteLength,
              ),
            );
          }
        } catch {
          if (!stopped)
            onGap("Microphone stream interrupted; reconnect audio.");
        } finally {
          await current.cancel().catch(() => {});
          if (reader === current) reader = undefined;
          publication.setSubscribed(false);
          trackId = undefined;
        }
      })();
    });
    room.on(RoomEvent.TrackUnpublished, (publication) => {
      if (publication.sid === trackId) {
        void reader?.cancel();
        trackId = undefined;
        onGap("Microphone track stopped.");
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (p) => {
      if (p.identity === host && !stopped)
        onGap("Browser disconnected; recording contains a gap.");
    });
    room.on(RoomEvent.Reconnecting, () =>
      onGap("Media reconnecting; recording may contain a gap."),
    );
    room.on(RoomEvent.Disconnected, () => {
      if (!stopped) onGap("Media connection closed; reconnect explicitly.");
    });
    try {
      await room.connect(
        this.config.livekitUrl,
        await token(`backend-${meeting.id}`, true),
        { autoSubscribe: false, dynacast: false },
      );
    } catch (error) {
      await room.disconnect();
      throw error;
    }
    return {
      connection: async () => ({
        url: this.config.livekitUrl,
        token: await token(host, false),
        room: roomName,
      }),
      async send(event: LiveEvent) {
        if (stopped || !room.localParticipant) return;
        let encoded = new TextEncoder().encode(JSON.stringify(event));
        if (encoded.byteLength > 14000)
          encoded = new TextEncoder().encode(
            JSON.stringify({
              ...event,
              type: "state.changed",
              data: { refresh: true },
            }),
          );
        await room.localParticipant.publishData(encoded, {
          reliable: event.type !== "transcript.partial",
          topic: "rally",
          destination_identities: [host],
        });
      },
      async close() {
        if (stopped) return;
        stopped = true;
        await reader?.cancel().catch(() => {});
        await room.disconnect();
      },
    };
  }
}

// Future speech adapters provide PCM here; no synthesis provider is selected by transport.
export async function publishPCM(
  room: Room,
  pcm: Int16Array,
  signal?: AbortSignal,
) {
  const source = new AudioSource(16000, 1, 200);
  const track = LocalAudioTrack.createAudioTrack("rally-speech", source);
  const cancel = () => source.clearQueue();
  signal?.addEventListener("abort", cancel, { once: true });
  const publication = await room.localParticipant!.publishTrack(
    track,
    new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }),
  );
  try {
    for (let offset = 0; offset < pcm.length; offset += 320) {
      if (signal?.aborted) break;
      const samples = new Int16Array(320);
      samples.set(pcm.subarray(offset, offset + 320));
      await source.captureFrame(new AudioFrame(samples, 16000, 1, 320));
    }
    if (!signal?.aborted) await source.waitForPlayout();
  } finally {
    signal?.removeEventListener("abort", cancel);
    source.clearQueue();
    await source.close();
    if (publication?.sid)
      await room.localParticipant!.unpublishTrack(publication.sid);
  }
}
