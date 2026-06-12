import type { Request } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import type { RagSecuredRequest } from "../services/rag/security/middleware";
import { DEFAULT_ORG_ID } from "@shared/config/tenant";

export interface RagRouteRateLimiters {
  generalApiRateLimit: RateLimitRequestHandler;
  reportGenerationRateLimit: RateLimitRequestHandler;
}

export function getOrgContext(req: Request) {
  const securedReq = req as RagSecuredRequest;
  return {
    orgId: securedReq.ragContext?.orgId || DEFAULT_ORG_ID,
    userId: securedReq.ragContext?.userId || (req.headers["x-user-id"] as string) || undefined,
    userRoles: req.headers["x-user-roles"]
      ? (req.headers["x-user-roles"] as string).split(",")
      : undefined,
  };
}

export function getConversationIdentity(req: Request): { orgId: string; userId: string } {
  const securedReq = req as RagSecuredRequest;
  return {
    orgId: securedReq.ragContext?.orgId ?? DEFAULT_ORG_ID,
    userId: securedReq.ragContext?.userId ?? "anonymous",
  };
}

export function toExportDate(value: unknown): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0) : value;
  }

  if (typeof value === "number") {
    const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    const date =
      trimmed !== "" && Number.isFinite(numeric)
        ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
        : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  return new Date(0);
}
