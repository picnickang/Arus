import { z } from "zod";

export const mlTrainConfigSchema = z.object({
  modelType: z.enum(["lstm", "gru", "tft", "rf", "gnn", "hybrid"]),
  epochs: z.number().int().positive().max(1000).optional().default(100),
  batchSize: z.number().int().positive().max(512).optional().default(32),
  learningRate: z.number().positive().max(1).optional().default(0.001),
  validationSplit: z.number().min(0).max(0.5).optional().default(0.2),
  earlyStoppingPatience: z.number().int().positive().optional().default(10),
  features: z.array(z.string()).optional(),
  targetColumn: z.string().optional(),
  windowSize: z.number().int().positive().optional(),
  horizonDays: z.number().int().positive().optional(),
});

export const mlModelStatusUpdateSchema = z.object({
  status: z.enum(["training", "ready", "failed", "deprecated"]),
  errorMessage: z.string().optional(),
  metrics: z.record(z.number()).optional(),
});

export const mlAcousticDataSchema = z.object({
  sampleRate: z.number().positive(),
  duration: z.number().positive(),
  channels: z.number().int().positive().optional().default(1),
  data: z.array(z.number().finite()).max(10_000_000),
  metadata: z.record(z.string().max(128), z.unknown()).optional(),
});

export const updateMlModelSchema = z.object({
  status: z.enum(["draft", "training", "ready", "deployed", "deprecated"]).optional(),
  accuracy: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string().max(128), z.unknown()).optional(),
});
