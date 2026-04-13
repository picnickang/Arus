import { z } from "zod";

export const ingestSignalSchema = z.object({
  src: z.string().min(1, "Signal source is required"),
  sig: z.string().min(1, "Signal name is required"),
  value: z.number().optional(),
  unit: z.string().optional(),
});

export const ingestPayloadSchema = z.object({
  vessel: z.string().min(1, "Vessel identifier is required"),
  ts: z.number().int().positive("Timestamp must be positive epoch seconds"),
  signals: z.array(ingestSignalSchema).min(1, "At least one signal required"),
});

export type IngestSignal = z.infer<typeof ingestSignalSchema>;
export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
