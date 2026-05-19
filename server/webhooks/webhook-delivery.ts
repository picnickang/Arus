/**
 * Wave 6.7 — Outbound webhook delivery framework.
 *
 * Sends signed JSON payloads to customer-configured URLs with retry +
 * exponential backoff. Persistence rides on the existing pg-boss queue
 * (`background-jobs.ts`) so retries survive process restarts and a
 * dead-letter drop hits the same observability surface as every other
 * background job.
 *
 * Payload signing: HMAC-SHA256 with the per-subscription secret. The
 * signature is sent in `X-Arus-Signature` as `sha256=<hex>`; receivers
 * verify by computing HMAC over the raw request body. We also send
 * `X-Arus-Timestamp` and `X-Arus-Event-Id`. Receivers must reject
 * deliveries with a timestamp drift > 5 minutes to prevent replay.
 *
 * The framework is delivery-only; subscription CRUD belongs in the
 * `webhook_subscriptions` repository (out of scope for this wave —
 * register subscriptions programmatically until that lands).
 */

import crypto from "node:crypto";
import { createLogger } from "../lib/structured-logger";

const logger = createLogger("Webhooks:Delivery");

export interface WebhookSubscription {
  id: string;
  orgId: string;
  url: string;
  /** Per-subscription HMAC secret. Must be ≥32 bytes of entropy. */
  secret: string;
  /** Event types this subscription listens to. */
  events: readonly string[];
  /** Maximum delivery attempts before dead-lettering. */
  maxAttempts?: number;
  enabled?: boolean;
}

export interface WebhookEvent<T = unknown> {
  id: string;
  type: string;
  orgId: string;
  occurredAt: string;
  data: T;
}

export interface WebhookDeliveryAttempt {
  subscriptionId: string;
  eventId: string;
  attempt: number;
  url: string;
  /** HTTP status; undefined when the request never completed. */
  statusCode?: number;
  /** Latency in ms. */
  latencyMs: number;
  ok: boolean;
  errorMessage?: string;
}

export interface DeliveryResult {
  attempts: WebhookDeliveryAttempt[];
  succeeded: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;
const DEFAULT_TIMEOUT_MS = 10_000;

export function signPayload(secret: string, body: string, timestamp: string): string {
  // Sign `timestamp.body` (Stripe-style) so a replay attacker cannot
  // swap the timestamp without breaking the signature.
  const mac = crypto.createHmac("sha256", secret);
  mac.update(timestamp);
  mac.update(".");
  mac.update(body);
  return `sha256=${mac.digest("hex")}`;
}

export function verifySignature(secret: string, body: string, timestamp: string, signature: string): boolean {
  const expected = signPayload(secret, body, timestamp);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function backoffFor(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * Math.min(1_000, exp));
  return exp + jitter;
}

export interface DeliveryDeps {
  fetchImpl?: typeof fetch;
  /** Optional callback into pg-boss to schedule the next retry. */
  scheduleRetry?: (subscriptionId: string, event: WebhookEvent, attempt: number, delayMs: number) => Promise<void>;
  /** Optional dead-letter sink. */
  deadLetter?: (subscriptionId: string, event: WebhookEvent, lastAttempt: WebhookDeliveryAttempt) => Promise<void>;
}

export class WebhookDeliveryService {
  constructor(private readonly deps: DeliveryDeps = {}) {}

  /**
   * Deliver a single attempt. Returns the attempt record. The caller is
   * responsible for re-queuing on failure (via `scheduleRetry`), so
   * this method never throws on a transport error.
   */
  async deliverOnce(
    sub: WebhookSubscription,
    event: WebhookEvent,
    attempt: number
  ): Promise<WebhookDeliveryAttempt> {
    const fetcher = this.deps.fetchImpl ?? fetch;
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(sub.secret, body, timestamp);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-arus-signature": signature,
      "x-arus-timestamp": timestamp,
      "x-arus-event-id": event.id,
      "x-arus-event-type": event.type,
      "x-arus-attempt": String(attempt),
      "user-agent": "ARUS-Webhooks/1.0",
    };

    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetcher(sub.url, {
        method: "POST",
        body,
        headers,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;
      const ok = response.status >= 200 && response.status < 300;
      return {
        subscriptionId: sub.id,
        eventId: event.id,
        attempt,
        url: sub.url,
        statusCode: response.status,
        latencyMs,
        ok,
        errorMessage: ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        subscriptionId: sub.id,
        eventId: event.id,
        attempt,
        url: sub.url,
        latencyMs,
        ok: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Inline retry loop — useful for tests and for callers that don't want
   * to plumb pg-boss. Production callers should invoke `deliverOnce`
   * inside a pg-boss processor and use `scheduleRetry` for backoff.
   */
  async deliver(sub: WebhookSubscription, event: WebhookEvent): Promise<DeliveryResult> {
    if (sub.enabled === false) {
      return { attempts: [], succeeded: false };
    }
    if (!sub.events.includes(event.type) && !sub.events.includes("*")) {
      return { attempts: [], succeeded: false };
    }

    const maxAttempts = sub.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const attempts: WebhookDeliveryAttempt[] = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.deliverOnce(sub, event, attempt);
      attempts.push(result);
      logger.info(
        `Webhook delivery attempt ${attempt}/${maxAttempts} ${result.ok ? "ok" : "failed"}`,
        {
          subscriptionId: sub.id,
          eventId: event.id,
          statusCode: result.statusCode,
          latencyMs: result.latencyMs,
        }
      );
      if (result.ok) return { attempts, succeeded: true };
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, backoffFor(attempt)));
      }
    }

    if (this.deps.deadLetter) {
      try {
        await this.deps.deadLetter(sub.id, event, attempts[attempts.length - 1]);
      } catch (err) {
        logger.warn("deadLetter sink threw — swallowing", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { attempts, succeeded: false };
  }
}

export const webhookDeliveryService = new WebhookDeliveryService();
