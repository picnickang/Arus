import { z } from "zod";

/**
 * Canonical API response envelope.
 *
 * Success: `{ success: true, data, meta? }`
 * Error:   `{ success: false, error: { code, message, details?, correlationId? }, message }`
 *
 * The top-level `message` mirror on errors keeps clients that read
 * `body.message || body.error` rendering correct text during the migration;
 * it is scheduled for removal with the unversioned-API sunset (2026-11-18,
 * see server/middleware/api-versioning.ts).
 *
 * Server-side wrapping is driven by server/lib/envelope-manifest.ts; the
 * client unwraps in apiRequest/getQueryFn. Device/edge-facing routes are
 * permanently excluded — see server/lib/envelope-manifest.ts.
 */

export const apiErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  correlationId: z.string().optional(),
});

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: apiErrorDetailSchema,
  message: z.string(),
});

export const successEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  meta: z.record(z.unknown()).optional(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/** Builds a typed success-envelope schema for response contracts (X3/X4). */
export function successEnvelopeOf<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
    meta: z.record(z.unknown()).optional(),
  });
}

export function wrapSuccess<T>(data: T, meta?: Record<string, unknown>): SuccessEnvelope<T> {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSuccessEnvelope(body: unknown): body is SuccessEnvelope<unknown> {
  return isRecord(body) && body["success"] === true && "data" in body;
}

export function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return isRecord(body) && body["success"] === false && isRecord(body["error"]);
}

export function isEnvelope(body: unknown): boolean {
  return isSuccessEnvelope(body) || isErrorEnvelope(body);
}
