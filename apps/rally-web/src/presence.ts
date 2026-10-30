import { VoiceSequence } from "../../../packages/rally-presence/voice.ts";
import { serverNow } from "./clock.ts";
import { createLivingSilk, type LivingSilk } from "living-silk";
import type { Meeting } from "./api.ts";
import { values } from "../../../packages/rally-presence/state.ts";
import {
  sceneFor,
  type Scene,
} from "../../../packages/rally-presence/scene.ts";

/** A renderer owns its canvas only; it never owns the audio source or meeting. */
export function mountPresence(parent: HTMLElement, camera = false) {
  const host = document.createElement("section");
  host.className = `rally-presence${camera ? " camera-presence" : ""}`;
  host.innerHTML =
    '<div class="rally-silk"></div><div class="presence-copy"><p class="presence-tag"></p><p class="presence-words" aria-live="polite"></p><p class="presence-next"></p><div class="presence-timeline"><progress max="1" value="0"></progress><div class="presence-markers"></div></div><small class="presence-time"></small></div>';
  parent.prepend(host);
  let silk: LivingSilk | null = null,
    scene: Scene | null = null;
  let clock = { server: Date.now(), local: performance.now() },
    disposed = false;
  let localSpeech: string | null | undefined = undefined,
    audioEpoch = 0;
  const now = () => clock.server + performance.now() - clock.local;
  const fallback = () => {
    host.dataset.graphics = "unavailable";
    host.querySelector(".rally-silk")!.textContent = "Rally · meeting guide";
  };
  try {
    silk = createLivingSilk(host.querySelector<HTMLElement>(".rally-silk")!, {
      emotion: {
        joy: 0.3,
        curiosity: 0.2,
        worry: 0,
        irritation: 0,
        sadness: 0,
        confidence: 0.55,
        energy: 0.4,
        sass: 0,
        expressiveness: 1,
      },
      quality: "auto",
      initialQuality: camera ? "economy" : undefined,
      antialias: camera ? false : undefined,
      pixelRatioCap: camera ? 2 / 3 : undefined,
      visibility: camera ? "always" : undefined,
      onError: fallback,
    });
    silk.setTrajectory(() =>
      scene
        ? { ...values(scene.presence, now()), expressiveness: 1 }
        : {
            joy: 0.3,
            curiosity: 0.2,
            worry: 0,
            irritation: 0,
            sadness: 0,
            confidence: 0.55,
            energy: 0.4,
            sass: 0,
            expressiveness: 1,
          },
    );
  } catch {
    fallback();
  }
  function drawText() {
    if (!scene) return;
    const time = now();
    host.dataset.finishing=String(!!scene.finishing);
    if(scene.finishing){
      host.querySelector('.presence-words')!.textContent='Preparing meeting notes…';
      host.querySelector('.presence-next')!.textContent='Sharing the summary link, then leaving';
      host.querySelector('.presence-tag')!.textContent='Wrapping up';
      host.querySelector('.presence-time')!.textContent='Your meeting can continue';
      return;
    }
    const speaking =
      localSpeech !== undefined
        ? localSpeech
        : scene.speech?.state === "playing" && scene.speech.until > time
          ? scene.speech.text
          : null;
    host.querySelector(".presence-words")!.textContent =
      speaking ?? scene.current;
    host.querySelector(".presence-next")!.textContent = speaking
      ? ""
      : `Next: ${scene.next}`;
    host.querySelector(".presence-tag")!.textContent = speaking
      ? "Rally"
      : scene.paused
        ? "Paused"
        : scene.detour
          ? `Detour · ${scene.detour}`
          : scene.adjustment
            ? `Agenda adjusted · ${scene.adjustment}`
            : "";
    const elapsed =
      scene.startedAt === null
        ? 0
        : Math.max(0, ((scene.endedAt ?? time) - scene.startedAt) / 1000);
    const total = scene.durationMinutes * 60;
    host.querySelector("progress")!.value = Math.min(1, elapsed / total);
    host.querySelector(".presence-time")!.textContent =
      elapsed > total
        ? `${Math.floor((elapsed - total) / 60)}m ${Math.floor((elapsed - total) % 60)}s overtime`
        : `${Math.floor(elapsed / 60)} / ${scene.durationMinutes} min`;
  }
  const timer = setInterval(drawText, 250);
  return {
    host,
    get silk() {
      return silk;
    },
    update(next: Scene) {
      if (
        disposed ||
        (scene &&
          next.meetingId === scene.meetingId &&
          (next.epoch < scene.epoch ||
            (next.epoch === scene.epoch && next.revision < scene.revision)))
      )
        return;
      if (next.speechOwner === "teams") localSpeech = undefined;
      scene = next;
      clock = { server: next.serverTime, local: performance.now() };
      const markers = host.querySelector(".presence-markers")!;
      markers.replaceChildren();
      let minutes = 0;
      for (const topic of next.topics) {
        if (topic.status === "parked") continue;
        minutes += topic.minutes;
        const marker = document.createElement("span");
        marker.title = `${topic.title} · ${topic.status}`;
        marker.style.left = `${Math.min(100, (minutes / next.durationMinutes) * 100)}%`;
        marker.dataset.status = topic.status;
        markers.append(marker);
      }
      drawText();
    },
    async speech(audio: HTMLAudioElement | null, text: string | null) {
      const epoch = ++audioEpoch;
      localSpeech = text ?? undefined;
      drawText();
      silk?.disconnectBotAudio();
      if (!audio || !silk) return;
      const stream = (
        audio as HTMLAudioElement & { captureStream?: () => MediaStream }
      ).captureStream?.();
      const track = stream?.getAudioTracks()[0];
      if (track) {
        await silk.enableAudio().catch(() => {});
        if (!disposed && epoch === audioEpoch)
          await silk.connectBotTrack(track).catch(() => {});
      }
    },
    dispose() {
      disposed = true;
      audioEpoch++;
      clearInterval(timer);
      void silk?.dispose();
      silk = null;
      host.remove();
    },
  };
}
let surface: ReturnType<typeof mountPresence> | null = null,
  meetingId = "",
  voiceSequence = new VoiceSequence();
export function disposePresence() {
  surface?.dispose();
  surface = null;
  meetingId = "";
  voiceSequence = new VoiceSequence();
}
export function updatePresence(m: Meeting) {
  if (meetingId !== m.id) disposePresence();
  meetingId = m.id;
  surface ??= mountPresence(
    document.getElementById("guidance")!.parentElement!,
  );
  surface.update(sceneFor(m, serverNow()));
}
export function presenceSpeech(
  audio: HTMLAudioElement | null,
  text: string | null,
) {
  void surface?.speech(audio, text);
}

export function unlockPresenceAudio() {
  void surface?.silk?.enableAudio().catch(() => {});
}

export function presenceScene(scene: Scene) {
  surface?.update(scene);
}
export function presenceVoice(
  frame: import("living-silk").BotVoiceFrame & {
    sequence?: number;
    captureEpoch?: number;
  },
) {
  if (!voiceSequence.accept(frame)) return;
  surface?.silk?.setVoice({ ...frame, timestamp: performance.now() / 1000 });
}
