import {VoiceSequence} from "../../../packages/rally-presence/voice.ts";
import { Room, RoomEvent } from "livekit-client";
import { mountPresence } from "./presence.ts";
import type { Scene } from "../../../packages/rally-presence/scene.ts";
import type { BotVoiceFrame } from "living-silk";
const surface = mountPresence(document.body, true);
let room: Room | null = null,
  connected = false;
const sequence = new VoiceSequence();
const api = {
  preview(scene: Scene) {
    surface.update(scene);
  },
  voice(frame: BotVoiceFrame & { sequence?: number; captureEpoch?: number }) {
    if (!sequence.accept(frame)) return;
    surface.silk?.setVoice({ ...frame, timestamp: performance.now() / 1000 });
  },
  healthy() { return connected && !!surface.silk; },
  metrics() {
    return surface.silk?.getMetrics() ?? null;
  },
  async connect(token: string) {
    if (room) throw new Error("Renderer already connected");
    const response = await fetch("/api/presence/bootstrap", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error("Renderer access expired");
    const { scene, connection } = await response.json();
    surface.update(scene);
    room = new Room();
    room.on(RoomEvent.Disconnected,()=>{connected=false;});
    room.on(RoomEvent.Reconnecting,()=>{connected=false;});
    room.on(RoomEvent.Reconnected,()=>{connected=true;});
    room.on(RoomEvent.DataReceived, (bytes, participant, _kind, topic) => {
      try {
        if (
          topic === "rally" &&
          participant?.identity === `backend-${scene.meetingId}`
        ) {
          const event = JSON.parse(new TextDecoder().decode(bytes));
          if (
            event.type === "presence.scene" &&
            event.meetingId === scene.meetingId
          )
            surface.update(event.data);
        }
        if (
          topic === "rally.voice" &&
          participant?.identity === `capture-${scene.meetingId}`
        )
          api.voice(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        /* Invalid transient media frame. */
      }
    });
    await room.connect(connection.url, connection.token, {
      autoSubscribe: false,
    });
    connected=true;
  },
  async close() {
    await room?.disconnect();
    surface.dispose();
  },
};
Object.assign(window, { rallyRenderer: api });
