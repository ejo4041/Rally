import { randomUUID } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
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
  type RemoteParticipant,
  type RemoteTrackPublication,
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
      roomName = `rally-${meeting.id}-${randomUUID()}`,
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
        canPublish: backend || meeting.captureSource!=="teams",
        canPublishData: backend,
        canPublishSources: backend || meeting.captureSource!=="teams" ? [2] : [],
      });
      return access.toJwt();
    };
    const subscribe = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (
        meeting.captureSource!=="teams" &&
        participant.identity === host &&
        publication.kind === TrackKind.KIND_AUDIO &&
        publication.source === TrackSource.SOURCE_MICROPHONE &&
        !trackId
      ) {
        trackId = publication.sid;
        publication.setSubscribed(true);
      }
    };
    room.on(RoomEvent.TrackPublished, subscribe);
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
      if (meeting.captureSource!=="teams" && p.identity === host && !stopped)
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
    // Existing publications are populated during connect without TrackPublished events.
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values())
        subscribe(publication, participant);
    }
    const admin = new RoomServiceClient(this.config.livekitUrl.replace(/^ws/, "http"),this.config.livekitKey,this.config.livekitSecret);
    return {
      connection: async () => ({
        url: this.config.livekitPublicUrl || this.config.livekitUrl,
        token: await token(host, false),
        room: roomName,
      }),
      play: (job,chunks,signal,beforeAudio) => publishStream(room, job, chunks, signal, beforeAudio),
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
        try { await admin.deleteRoom(roomName); } finally { await room.disconnect(); }
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

export async function publishStream(room: Room, job: import("./live-speech.ts").SpeechState, chunks: AsyncIterable<Buffer>, signal: AbortSignal, beforeAudio: () => void) {
  signal.throwIfAborted();
  const source = new AudioSource(16000, 1, 200);
  const track = LocalAudioTrack.createAudioTrack(`rally-speech:${job.destination}:${job.id}:${job.epoch}`, source);
  const cancel = () => source.clearQueue();
  signal.addEventListener('abort', cancel, {once:true});
  let publication: Awaited<ReturnType<NonNullable<Room['localParticipant']>['publishTrack']>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortWait: (()=>void) | undefined;
  try {
    publication = await room.localParticipant!.publishTrack(track, new TrackPublishOptions({source:TrackSource.SOURCE_MICROPHONE}));
    if (!publication) throw new Error('Speech publication failed');
    await Promise.race([
      publication.waitForSubscription(),
      new Promise<never>((_,reject)=>{
        timer=setTimeout(()=>reject(new Error('No speech listener')),5000);
        abortWait=()=>reject(new Error('Speech canceled'));
        signal.addEventListener('abort',abortWait,{once:true});
        if(signal.aborted)abortWait();
      }),
    ]);
    clearTimeout(timer);
    let pending=Buffer.alloc(0), started=false;
    const push=async(bytes:Buffer)=>{
      signal.throwIfAborted();
      if(!started){beforeAudio();started=true;}
      const samples=new Int16Array(bytes.length/2);
      for(let i=0;i<samples.length;i++)samples[i]=bytes.readInt16LE(i*2);
      await source.captureFrame(new AudioFrame(samples,16000,1,samples.length));
    };
    for await(const chunk of chunks) {
      signal.throwIfAborted();
      pending=Buffer.concat([pending,chunk]);
      while(pending.length>=640){await push(pending.subarray(0,640));pending=pending.subarray(640);}
    }
    if(pending.length%2)throw new Error('Incomplete PCM sample');
    if(pending.length)await push(pending);
    signal.throwIfAborted();
    await source.waitForPlayout();
  } finally {
    clearTimeout(timer);if(abortWait)signal.removeEventListener('abort',abortWait);
    signal.removeEventListener('abort',cancel);source.clearQueue();
    if(publication?.sid)await room.localParticipant?.unpublishTrack(publication.sid);
    await source.close();
  }
}
