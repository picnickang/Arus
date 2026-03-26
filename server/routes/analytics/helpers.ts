/**
 * Analytics Routes - Shared Helpers
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";

const FAILURE_PREDICTION_NAMESPACE = "f8e7d6c5-b4a3-4a2b-8c1d-0e9f8a7b6c5d";

export function toFailurePredictionUuid(id: number): string {
  const hash = createHash("sha256").update(`${FAILURE_PREDICTION_NAMESPACE}:${id}`).digest("hex");
  return [hash.substring(0, 8), hash.substring(8, 12), `4${  hash.substring(13, 16)}`, ((Number.parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hash.substring(18, 20), hash.substring(20, 32)].join("-");
}

export function getOrgId(req: Request, res: Response): string | null {
  const orgId = req.headers["x-org-id"] as string;
  if (orgId && typeof orgId === "string" && orgId.trim() !== "") {
    return orgId.trim();
  }
  res.status(401).json({
    error: { code: "MISSING_ORG_ID", message: "Organization ID is required (x-org-id header)" },
    metadata: { timestamp: new Date(), version: "1.0" },
  });
  return null;
}

export function sendValidatedResponse<T>(res: Response, data: unknown, schema: z.ZodSchema<T>): boolean {
  try {
    const validated = schema.parse(data);
    res.json(validated);
    return true;
  } catch (error) {
    console.error("[Analytics API] Response validation failed:", error);
    res.status(500).json({ error: { code: "RESPONSE_VALIDATION_ERROR", message: "Response failed DTO validation", details: process.env.NODE_ENV === "development" ? error : undefined }, metadata: { timestamp: new Date(), version: "1.0" } });
    return false;
  }
}

export function handleError(res: Response, error: unknown, operation: string) {
  console.error(`[Analytics API] ${operation} error:`, error);
  if (error instanceof Error && error.message.includes("not found")) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: error.message }, metadata: { timestamp: new Date(), version: "1.0" } });
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An unexpected error occurred", details: process.env.NODE_ENV === "development" ? error : undefined }, metadata: { timestamp: new Date(), version: "1.0" } });
}
