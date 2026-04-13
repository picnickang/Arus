import { z } from "zod";

export const j1939SpnRuleSchema = z.object({
  spn: z.number().int().positive(),
  scale: z.number().optional().default(1),
  offset: z.number().optional().default(0),
  unit: z.string().optional(),
  label: z.string().optional(),
});

export const j1939PgnRuleSchema = z.object({
  pgn: z.number().int().positive(),
  priority: z.number().int().min(0).max(7).optional(),
  spns: z.array(j1939SpnRuleSchema),
});

export const j1939MappingSchema = z.object({
  deviceId: z.string().min(1),
  rules: z.array(j1939PgnRuleSchema),
});
