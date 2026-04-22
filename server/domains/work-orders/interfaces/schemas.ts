/**
 * Work Orders Validation Schemas
 *
 * Zod schemas for work order API request validation.
 */

import { z } from "zod";

export const createTaskSchema = z.object({
  description: z.string().min(1, "Task description is required"),
  isCompleted: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const updateTaskSchema = z.object({
  description: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  completedBy: z.string().optional(),
  completedByName: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export const isoDateString = z.string().refine(
  (val) => {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const isoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
    return isoDate.test(val) || isoDateTime.test(val);
  },
  { message: "Date must be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)" }
);

export const cloneWorkOrderSchema = z
  .object({
    plannedStartDate: isoDateString.optional().nullable(),
    plannedEndDate: isoDateString.optional().nullable(),
    includeTasks: z.boolean().optional(),
    includeParts: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.plannedStartDate && data.plannedEndDate) {
        return new Date(data.plannedEndDate) >= new Date(data.plannedStartDate);
      }
      return true;
    },
    { message: "End date must be after start date", path: ["plannedEndDate"] }
  );
