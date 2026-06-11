import { z } from "zod";

export const editServiceRequestSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string(),
  urgency: z.string(),
  estimatedCost: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? null : Number(val)),
    z.number().nullable()
  ),
  serviceDetails: z.string(),
  specialRequirements: z.string(),
});

export type EditServiceRequestFormData = z.infer<typeof editServiceRequestSchema>;

/**
 * PATCH payload for a service request edit.
 * NOTE: use null (not undefined) for cleared optional fields so the
 * backend PATCH actually clears them instead of leaving the prior value.
 */
export function toUpdatePayload(data: EditServiceRequestFormData): {
  title: string;
  description: string | null;
  urgency: string;
  estimatedCost: number | null;
  serviceDetails: string | null;
  specialRequirements: string | null;
} {
  return {
    title: data.title,
    description: data.description || null,
    urgency: data.urgency,
    estimatedCost: data.estimatedCost,
    serviceDetails: data.serviceDetails || null,
    specialRequirements: data.specialRequirements || null,
  };
}
