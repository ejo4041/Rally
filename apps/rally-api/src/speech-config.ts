import { z } from "zod";

export const defaultSpeech = {
  adapter: "mms-local" as const,
  model: "facebook/mms-tts-eng",
  revision: "c71de0fe7204c83f1c10820a7d696d0b450048ba",
  sampleRate: 16000 as const,
};

// Configuration selects a compatible offline MMS checkpoint, not an arbitrary
// remote service. A different runtime or audio format requires another adapter.
export const speechSettingsSchema = z
  .object({
    adapter: z.literal("mms-local").default(defaultSpeech.adapter),
    model: z
      .string()
      .regex(/^facebook\/mms-tts-[a-z0-9-]+$/)
      .default(defaultSpeech.model),
    revision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .default(defaultSpeech.revision),
    sampleRate: z.literal(16000).default(defaultSpeech.sampleRate),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.model !== defaultSpeech.model &&
      value.revision === defaultSpeech.revision
    )
      ctx.addIssue({
        code: "custom",
        message: "Changed speech models require their own pinned revision.",
      });
  });
export type SpeechIdentity = Pick<
  z.infer<typeof speechSettingsSchema>,
  "model" | "revision" | "sampleRate"
>;
