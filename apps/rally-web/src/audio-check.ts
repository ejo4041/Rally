import { acquireAudio } from "./media.ts";
// Meter the same source acquisition used by LiveKit; no connection or provider
// is opened. Separate meters are taken before the mono transport mix.
export function setupAudioCheck() {
  const el = (id: string) => document.getElementById(id)!;
  const dialog = el("audio-check-dialog") as HTMLDialogElement;
  let current: AbortController | null = null;
  const stop = () => {
    current?.abort();
    current = null;
  };
  dialog.addEventListener("close", stop);
  el("stop-audio-check").onclick = () => current?.abort();
  async function start(mode: string, includeMic: boolean) {
    stop();
    const controller = new AbortController();
    current = controller;
    let input: Awaited<ReturnType<typeof acquireAudio>> | undefined,
      context: AudioContext | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      frame: number | undefined,
      finished = false;
    const finish = (reason: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
      input?.close();
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
      if (current === controller) {
        el("audio-check-status").textContent = reason;
        (el("stop-audio-check") as HTMLButtonElement).disabled = true;
      }
    };
    controller.signal.addEventListener(
      "abort",
      () => finish("Audio check stopped. Capture is off."),
      { once: true },
    );
    for (const kind of ["tab", "microphone"]) {
      (el("check-" + kind + "-level") as HTMLMeterElement).value = 0;
      el("check-" + kind + "-result").textContent = "No signal detected yet.";
      el("check-" + kind + "-row").hidden =
        kind === "tab" ? mode !== "tab" : mode === "tab" && !includeMic;
    }
    el("audio-check-status").textContent =
      "Choose the audio source when prompted.";
    (el("stop-audio-check") as HTMLButtonElement).disabled = false;
    dialog.showModal();
    try {
      input = await acquireAudio(mode, includeMic, controller.signal, () =>
        finish("Sharing ended. Capture is off."),
      );
      if (finished || controller.signal.aborted) {
        input.close();
        return;
      }
      context = new AudioContext();
      await context.resume();
      if (finished || controller.signal.aborted) return;
      const meters = input.sources.map((source) => {
        const analyser = context!.createAnalyser();
        analyser.fftSize = 1024;
        context!
          .createMediaStreamSource(
            new MediaStream(source.stream.getAudioTracks()),
          )
          .connect(analyser);
        return {
          kind: source.kind,
          analyser,
          samples: new Float32Array(analyser.fftSize),
          peak: 0,
        };
      });
      el("audio-check-status").textContent =
        "Checking locally for 15 seconds. No audio is sent or recorded.";
      const update = () => {
        if (finished) return;
        for (const meter of meters) {
          meter.analyser.getFloatTimeDomainData(meter.samples);
          const rms = Math.sqrt(
            meter.samples.reduce((sum, value) => sum + value * value, 0) /
              meter.samples.length,
          );
          meter.peak = Math.max(meter.peak, rms);
          (el("check-" + meter.kind + "-level") as HTMLMeterElement).value =
            Math.min(1, rms * 5);
          el("check-" + meter.kind + "-result").textContent =
            meter.peak >= 0.005
              ? "Audio signal detected."
              : "No signal detected yet. Ask the relevant speaker to speak.";
        }
        frame = requestAnimationFrame(update);
      };
      timer = setTimeout(
        () => finish("Check complete. Capture is off."),
        15000,
      );
      update();
    } catch (error) {
      if (!finished)
        finish(
          error instanceof Error ? error.message : "Audio check unavailable.",
        );
    }
  }
  return { start, stop };
}
