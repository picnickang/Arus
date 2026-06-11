import type { Request, Response, NextFunction } from "express";
import {
  isEnvelope,
  type ErrorEnvelope,
} from "@shared/api-envelope";
import { isEnvelopedPath } from "../lib/envelope-manifest";
import { getCorrelationId } from "../logging";

/**
 * Wraps JSON responses in the canonical envelope for migrated path prefixes
 * (server/lib/envelope-manifest.ts):
 *
 * - 2xx non-enveloped bodies become `{ success: true, data: body }`
 * - >=400 bodies are normalized into the error envelope, mapping the legacy
 *   `{message}` / `{error}` / Zod `{errors}` fields into `error.code/message/
 *   details` and always mirroring `message` at the top level (legacy clients
 *   read `body.message || body.error`; mirror sunsets 2026-11-18 with the
 *   unversioned API).
 * - already-enveloped bodies pass through (idempotent under double mounts)
 * - 204/205 and non-`res.json` output (SSE, streams, sendFile) are untouched
 *
 * Only `res.json` is patched, and the patch composes with the bootstrap
 * logging patch and the idempotency middleware's response capture (each
 * delegates outward). The idempotency cache stores the WRAPPED body because
 * its mount runs after this one patches — replays return identical bytes.
 */

const ENVELOPE_APPLIED: unique symbol = Symbol("envelopeApplied");

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  408: "TIMEOUT",
  409: "CONFLICT",
  412: "PRECONDITION_FAILED",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

function codeForStatus(status: number): string {
  return STATUS_CODES[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeErrorBody(status: number, body: unknown): ErrorEnvelope {
  const record = isRecord(body) ? body : undefined;

  const nested = record && isRecord(record["error"]) ? record["error"] : undefined;
  const message =
    (nested && typeof nested["message"] === "string" && nested["message"]) ||
    (record && typeof record["message"] === "string" && record["message"]) ||
    (record && typeof record["error"] === "string" && record["error"]) ||
    (typeof body === "string" && body) ||
    "Request failed";
  const code =
    (nested && typeof nested["code"] === "string" && nested["code"]) ||
    (record && typeof record["code"] === "string" && record["code"]) ||
    codeForStatus(status);
  const details =
    (nested && nested["details"]) ??
    record?.["details"] ??
    record?.["errors"] ??
    record?.["issues"];
  const correlationId =
    (nested && typeof nested["correlationId"] === "string" && nested["correlationId"]) ||
    (record && typeof record["correlationId"] === "string" && record["correlationId"]) ||
    getCorrelationId();

  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(correlationId ? { correlationId } : {}),
    },
    message,
    code,
  };
}

export function envelopeJson() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const marked = req as Request & { [ENVELOPE_APPLIED]?: boolean };
    if (marked[ENVELOPE_APPLIED] || !isEnvelopedPath(req.originalUrl)) {
      return next();
    }
    marked[ENVELOPE_APPLIED] = true;

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      if (res.statusCode === 204 || res.statusCode === 205) {
        return originalJson(body);
      }
      // Downloads are documents, not API payloads — wrapping a JSON export
      // served via res.json + Content-Disposition would corrupt the file.
      const disposition = res.getHeader("content-disposition");
      if (typeof disposition === "string" && disposition.toLowerCase().includes("attachment")) {
        return originalJson(body);
      }
      if (isEnvelope(body)) {
        return originalJson(body);
      }
      if (res.statusCode >= 400) {
        return originalJson(normalizeErrorBody(res.statusCode, body));
      }
      return originalJson({ success: true, data: body ?? null });
    };

    next();
  };
}
