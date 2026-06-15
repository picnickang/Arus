/**
 * SendGrid Signed Event Webhook — signature verification + event mapping.
 *
 * Pure helpers (no Express/DB coupling) so they are unit-testable and reusable
 * by the webhook route handler. Verification is FAIL-CLOSED: if the verification
 * key is unset, the signature/timestamp headers are missing, or verification
 * throws, it returns false and the request must be rejected.
 */
import sendgridEventWebhook from "@sendgrid/eventwebhook";

const { EventWebhook } = sendgridEventWebhook;

export const SENDGRID_SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
export const SENDGRID_TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

export interface SendGridEvent {
  email?: string;
  event: string;
  sg_message_id?: string;
  timestamp?: number;
  reason?: string;
}

/**
 * Verify a SendGrid event-webhook request against the configured ECDSA
 * verification key. Fail-closed on any missing input or error.
 */
export function verifySendGridWebhook(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
  verificationKey: string | undefined = process.env["SENDGRID_WEBHOOK_VERIFICATION_KEY"]
): boolean {
  if (!verificationKey || !signature || !timestamp) {
    return false;
  }
  try {
    const ew = new EventWebhook();
    const ecdsaKey = ew.convertPublicKeyToECDSA(verificationKey);
    return ew.verifySignature(ecdsaKey, rawBody, signature, timestamp);
  } catch {
    return false;
  }
}

/**
 * Map a SendGrid event type to an alert_email_log delivery status, or null for
 * engagement events (open/click/…) that don't change delivery state.
 */
export function sendGridEventToStatus(event: string): string | null {
  switch (event) {
    case "delivered":
      return "delivered";
    case "bounce":
      return "bounced";
    case "dropped":
      return "dropped";
    case "deferred":
      return "deferred";
    case "spamreport":
      return "spam";
    default:
      return null;
  }
}

/** The SendGrid message id without the per-recipient suffix (after the first "."). */
export function normalizeSendGridMessageId(sgMessageId: string | undefined): string | null {
  if (!sgMessageId) {
    return null;
  }
  const base = sgMessageId.split(".")[0];
  return base && base.length > 0 ? base : null;
}

/**
 * Coerce an already-parsed webhook body into the SendGrid events we understand,
 * dropping anything that is not an object carrying a string `event` field.
 * Returns [] for a non-array body (a verified-but-malformed payload), so the
 * caller can treat "nothing to record" uniformly.
 */
export function parseSendGridEvents(body: unknown): SendGridEvent[] {
  if (!Array.isArray(body)) {
    return [];
  }
  return body.filter(
    (item): item is SendGridEvent =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { event?: unknown }).event === "string"
  );
}
