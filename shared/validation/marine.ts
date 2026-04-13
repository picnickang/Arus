import { z } from "zod";
import { utcDateSchema } from "./datetime";

export const horDaySchema = z.object({
  date: utcDateSchema,
  h0: z.number().int().min(0).max(1),
  h1: z.number().int().min(0).max(1),
  h2: z.number().int().min(0).max(1),
  h3: z.number().int().min(0).max(1),
  h4: z.number().int().min(0).max(1),
  h5: z.number().int().min(0).max(1),
  h6: z.number().int().min(0).max(1),
  h7: z.number().int().min(0).max(1),
  h8: z.number().int().min(0).max(1),
  h9: z.number().int().min(0).max(1),
  h10: z.number().int().min(0).max(1),
  h11: z.number().int().min(0).max(1),
  h12: z.number().int().min(0).max(1),
  h13: z.number().int().min(0).max(1),
  h14: z.number().int().min(0).max(1),
  h15: z.number().int().min(0).max(1),
  h16: z.number().int().min(0).max(1),
  h17: z.number().int().min(0).max(1),
  h18: z.number().int().min(0).max(1),
  h19: z.number().int().min(0).max(1),
  h20: z.number().int().min(0).max(1),
  h21: z.number().int().min(0).max(1),
  h22: z.number().int().min(0).max(1),
  h23: z.number().int().min(0).max(1),
});

export const horSheetMetaSchema = z.object({
  vessel_id: z.string().min(1, "Vessel ID is required"),
  crew_id: z.string().min(1, "Crew ID is required"),
  crew_name: z.string().min(1, "Crew name is required"),
  rank: z.string().min(1, "Rank is required"),
  month: z.enum([
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ]),
  year: z.number().int().min(2020).max(2030),
});

export const horImportSchema = z.object({
  sheet: horSheetMetaSchema,
  rows: z
    .array(horDaySchema)
    .min(1, "At least one rest day required")
    .max(31, "Maximum 31 days per month"),
});

export type HorDay = z.infer<typeof horDaySchema>;
export type HorSheetMeta = z.infer<typeof horSheetMetaSchema>;
export type HorImport = z.infer<typeof horImportSchema>;
