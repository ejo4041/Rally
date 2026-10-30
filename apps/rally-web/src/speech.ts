import { api } from "./api.ts";
type Job = {
  id: string;
  interventionId: string;
  epoch: number;
  state: string;
  seconds: number | null;
};
type Prompt = { id: string; text: string; epoch: number };
export function createSpeechPlayer(options: {
  current: (prompt: Prompt) => boolean;
  status: (message: string, shielded: boolean) => void;
}) {
  let generation = 0,
    active: {
      abort: AbortController;
      audio: HTMLAudioElement;
      url?: string;
      job?: Job;
      meetingId: string;
      prompt: Prompt;
      finished: boolean;
      path: string;
      diagnostic: boolean;
    } | null = null;
  const seen = new Set<string>();
  let shielded = false,
    lastMessage = "";
  const status = (message: string, value: boolean) => {
    shielded = value;
    lastMessage = message;
    options.status(message, value);
  };
  function cancel() {
    generation++;
    const previous = active;
    active = null;
    if (!previous) return;
    previous.finished = true;
    previous.abort.abort();
    previous.audio.pause();
    previous.audio.removeAttribute("src");
    previous.audio.load();
    if (previous.url) URL.revokeObjectURL(previous.url);
    status("", false);
    if (previous.job)
      void api(`${previous.path}/${previous.job.id}/playback`, "POST", {
        state: "canceled",
      }).catch(() => {});
  }
  async function speak(meetingId: string, prompt: Prompt, diagnostic = false) {
    const path = diagnostic ? "/speech/test" : `/meetings/${meetingId}/speech`;
    if (!diagnostic && !options.current(prompt)) return;
    if (seen.has(prompt.id)) return;
    seen.add(prompt.id);
    if (seen.size > 1000) seen.delete(seen.values().next().value!);
    cancel();
    const mine = generation,
      job = {
        abort: new AbortController(),
        audio: new Audio(),
        meetingId,
        prompt,
        finished: false,
        path,
        diagnostic,
      } as NonNullable<typeof active>;
    active = job;
    const valid = () =>
      active === job &&
      generation === mine &&
      !job.abort.signal.aborted &&
      (diagnostic || options.current(prompt));
    const finish = (message: string) => {
      if (active !== job) return;
      cancel();
      if (message) status(message, false);
    };
    const timeout = setTimeout(
      () => finish("Voice timed out. The prompt remains visible."),
      65000,
    );
    try {
      status("Preparing Meta MMS voice. Listening continues.", false);
      const created = await api<Job>(
        path,
        "POST",
        diagnostic ? {} : { interventionId: prompt.id, epoch: prompt.epoch },
        job.abort.signal,
      );
      job.job = created;
      if (!valid()) {
        void api(`${path}/${created.id}/playback`, "POST", {
          state: "canceled",
        }).catch(() => {});
        return;
      }
      let latest = created;
      while (latest.state === "preparing") {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            job.abort.signal.removeEventListener("abort", abort);
            resolve();
          }, 250);
          const abort = () => {
            clearTimeout(timer);
            reject(new Error("Canceled"));
          };
          job.abort.signal.addEventListener("abort", abort, { once: true });
          if (job.abort.signal.aborted) abort();
        });
        if (!valid()) return;
        latest = await api<Job>(
          `${path}/${created.id}`,
          "GET",
          undefined,
          job.abort.signal,
        );
      }
      if (!valid()) return;
      if (latest.state !== "ready")
        throw new Error("Voice unavailable. The prompt remains visible.");
      const response = await fetch(`/api${path}/${created.id}/audio`, {
        credentials: "include",
        signal: job.abort.signal,
      });
      if (!response.ok) throw new Error("Voice is no longer available.");
      const blob = await response.blob();
      if (!valid()) return;
      job.url = URL.createObjectURL(blob);
      job.audio.src = job.url;
      // Establish server input shielding before playback starts. It has a bounded
      // deadline even when this browser disappears without an ended callback.
      await api(
        `${path}/${created.id}/playback`,
        "POST",
        { state: "playing" },
        job.abort.signal,
      );
      if (!valid()) return;
      status(
        "Rally is speaking. Incoming audio is shielded; Stop speaking to return the floor.",
        true,
      );
      await new Promise<void>((resolve, reject) => {
        job.audio.onended = () => resolve();
        job.audio.onerror = () => reject(new Error("Voice playback failed."));
        const abort = () => {
          job.audio.pause();
          resolve();
        };
        job.abort.signal.addEventListener("abort", abort, { once: true });
        void job.audio.play().catch(reject);
      });
      if (!valid()) return;
      await api(
        `${path}/${created.id}/playback`,
        "POST",
        { state: "completed" },
        job.abort.signal,
      );
      job.finished = true;
    } catch (error) {
      if (valid())
        status(
          error instanceof Error
            ? error.message
            : "Voice unavailable. The prompt remains visible.",
          false,
        );
    } finally {
      clearTimeout(timeout);
      if (active === job) {
        const completed = job.finished;
        active = null;
        job.audio.pause();
        job.audio.removeAttribute("src");
        job.audio.load();
        if (job.url) URL.revokeObjectURL(job.url);
        if (job.job && !completed)
          void api(`${path}/${job.job.id}/playback`, "POST", {
            state: "canceled",
          }).catch(() => {});
        status(completed ? "" : lastMessage, false);
      }
    }
  }
  return {
    cancel,
    speak,
    test: () =>
      speak("", { id: crypto.randomUUID(), text: "", epoch: 0 }, true),
    isActive: () => !!active,
    isPlaying: () => shielded,
    validate() {
      if (active && !active.diagnostic && !options.current(active.prompt))
        cancel();
    },
  };
}
