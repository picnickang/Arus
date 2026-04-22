import { z } from "zod";

export const utcDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");
export const utcTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be in HH:MM or HH:MM:SS format");
export const utcTimestampSchema = z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
  message: "Timestamp must be a valid ISO 8601 date string",
});
