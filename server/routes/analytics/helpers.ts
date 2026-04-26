/**
 * Analytics Routes - Shared Helpers
 */
import type { Request, Response } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createLogger } from "../../lib/structured-logger";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";
const logger = createLogger("Routes:Analytics:Helpers");

const FAILURE_PREDICTION_NAMESPACE = "f8e7d6c5-b4a3-4a2b-8c1d-0e9f8a7b6c5d";

export function toFailurePredictionUuid(id: number): string {
  const hash = createHash("sha256").update(`${FAILURE_PREDICTION_NAMESPACE}:${id}`).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    `4${hash.substring(13, 16)}`,
    ((Number.parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") +
      hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
}

export function getOrgId(_req: Request, _res: Response): string {
  return DEFAULT_ORG_ID;
}

export function sendValidatedResponse<T>(
  res: Response,
  data: unknown,
  schema: z.ZodSchema<T>
): boolean {
  try {
    const validated = schema.parse(data);
    res.json(validated);
    return true;
  } catch (error) {
    logger.error("[Analytics API] Response validation failed:", undefined, error);
    res
      .status(500)
      .json({
        error: {
          code: "RESPONSE_VALIDATION_ERROR",
          message: "Response failed DTO validation",
          details: process.env.NODE_ENV === "development" ? error : undefined,
        },
        metadata: { timestamp: new Date(), version: "1.0" },
      });
    return false;
  }
}

export function handleError(res: Response, error: unknown, operation: string) {
  logger.error(`[Analytics API] ${operation} error:`, undefined, error);
  if (error instanceof Error && error.message.includes("not found")) {
    res
      .status(404)
      .json({
        error: { code: "NOT_FOUND", message: error.message },
        metadata: { timestamp: new Date(), version: "1.0" },
      });
    return;
  }
  res
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        details: process.env.NODE_ENV === "development" ? error : undefined,
      },
      metadata: { timestamp: new Date(), version: "1.0" },
    });
}
