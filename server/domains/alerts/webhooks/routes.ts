/**
 * SendGrid Signed Event Webhook — route handler.
 *
 * Public, unauthenticated endpoint (SendGrid posts server-to-server with no
 * session / orgId). It is listed in `server/bootstrap/public-api-paths.ts` and
 * pinned by `tests/unit/lr35-public-api-paths-audit.test.ts`. Security is NOT
 * the auth chain — it is FAIL-CLOSED ECDSA signature verification against
 * SENDGRID_WEBHOOK_VERIFICATION_KEY: any unsigned, forged, or stale request is
 * rejected with 403 before any DB work. The handler only updates
 * alert_email_log delivery status by messageId; it never trusts request-supplied
 * org context.
 *
 * Delivery-status updates are best-effort and idempotent (a status set keyed on
 * messageId), so a single bad row is logged and skipped rather than failing the
 * whole batch, and a verified-but-malformed body is accepted (200) rather than
 * triggering pointless SendGrid retries.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { createLogger } from "../../../lib/structured-logger";
import { authenticatedRequest } from "../../../middleware/auth";
import type { RateLimit } from "../../../lib/rate-limit-factory";
import { alertSettingsRepository } from "../settings-repository.js";
import {
  verifySendGridWebhook,
  sendGridEventToStatus,
  normalizeSendGridMessageId,
  parseSendGridEvents,
  SENDGRID_SIGNATURE_HEADER,
  SENDGRID_TIMESTAMP_HEADER,
} from "./sendgrid-event-webhook.js";

const logger = createLogger("Domains:Alerts:SendGridWebhook");

/**
 * The slice of the Express request the handler reads. Keeping it explicit
 * decouples the core logic from the full Express type so it is unit-testable
 * with a plain object (no `as unknown as Request` casts).
 */
export interface SendGridWebhookRequest {
  rawBody?: Buffer | undefined;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

/** The slice of the Express response the handler writes (Express `Response` satisfies it). */
export interface SendGridWebhookResponse {
  status(code: number): SendGridWebhookResponse;
  json(payload: unknown): void;
}

/** Injectable seams so the thin glue is unit-testable without real ECDSA/DB. */
export interface SendGridWebhookDeps {
  verify?: typeof verifySendGridWebhook;
  updateStatus?: (messageId: string, status: string, reason?: string | null) => Promise<number>;
}

function headerValue(headers: SendGridWebhookRequest["headers"], name: string): string | undefined {
  const raw = headers[name];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Handle a SendGrid event-webhook POST. Exported (separately from registration)
 * so it can be exercised directly in unit tests with a stubbed verifier + a
 * spied delivery-status writer.
 */
export async function handleSendGridWebhook(
  req: SendGridWebhookRequest,
  res: SendGridWebhookResponse,
  deps: SendGridWebhookDeps = {}
): Promise<void> {
  const verify = deps.verify ?? verifySendGridWebhook;
  const updateStatus: NonNullable<SendGridWebhookDeps["updateStatus"]> =
    deps.updateStatus ??
    ((messageId, status, reason) =>
      alertSettingsRepository.updateEmailLogStatusByMessageId(messageId, status, reason));

  // rawBody is the exact bytes SendGrid signed (captured by the global
  // express.json `verify` hook). Without it verification is impossible — fail closed.
  const rawBody = req.rawBody?.toString("utf8");
  const signature = headerValue(req.headers, SENDGRID_SIGNATURE_HEADER);
  const timestamp = headerValue(req.headers, SENDGRID_TIMESTAMP_HEADER);

  if (!rawBody || !verify(rawBody, signature, timestamp)) {
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  const events = parseSendGridEvents(req.body);
  let updated = 0;
  for (const event of events) {
    const status = sendGridEventToStatus(event.event);
    const messageId = normalizeSendGridMessageId(event.sg_message_id);
    if (!status || !messageId) {
      continue;
    }
    try {
      updated += await updateStatus(messageId, status, event.reason ?? null);
    } catch (error) {
      logger.error("Failed to update alert_email_log from SendGrid event", undefined, error);
    }
  }

  res.status(200).json({ received: true, updated });
}

export function registerSendGridWebhookRoutes(
  app: Express,
  deps: { generalApiRateLimit: RateLimit }
): void {
  app.post(
    "/api/webhooks/sendgrid/events",
    deps.generalApiRateLimit,
    (req: Request, res: Response, next: NextFunction) => {
      handleSendGridWebhook(
        {
          rawBody: authenticatedRequest(req).rawBody,
          headers: req.headers,
          body: req.body,
        },
        res
      ).catch(next);
    }
  );
}
