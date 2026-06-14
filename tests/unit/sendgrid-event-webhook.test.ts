/**
 * Unit tests for the SendGrid event-webhook helpers (signature verification is
 * fail-closed; event→status mapping; message-id normalization). The real ECDSA
 * verify path is exercised by @sendgrid/eventwebhook in production; here we pin
 * the fail-closed guarantees and the pure mappers (no network, no DB).
 */
import { describe, it, expect } from "@jest/globals";
import {
  verifySendGridWebhook,
  sendGridEventToStatus,
  normalizeSendGridMessageId,
} from "../../server/domains/alerts/webhooks/sendgrid-event-webhook";

describe("verifySendGridWebhook (fail-closed)", () => {
  it("returns false when the verification key is unset", () => {
    expect(verifySendGridWebhook("{}", "sig", "123", undefined)).toBe(false);
  });

  it("returns false when the signature or timestamp header is missing", () => {
    expect(verifySendGridWebhook("{}", undefined, "123", "key")).toBe(false);
    expect(verifySendGridWebhook("{}", "sig", undefined, "key")).toBe(false);
  });

  it("returns false (never throws) on a malformed key/signature", () => {
    expect(verifySendGridWebhook("{}", "not-base64!!", "123", "not-a-real-key")).toBe(false);
  });
});

describe("sendGridEventToStatus", () => {
  it("maps delivery-state events", () => {
    expect(sendGridEventToStatus("delivered")).toBe("delivered");
    expect(sendGridEventToStatus("bounce")).toBe("bounced");
    expect(sendGridEventToStatus("dropped")).toBe("dropped");
    expect(sendGridEventToStatus("deferred")).toBe("deferred");
    expect(sendGridEventToStatus("spamreport")).toBe("spam");
  });

  it("ignores engagement events", () => {
    expect(sendGridEventToStatus("open")).toBeNull();
    expect(sendGridEventToStatus("click")).toBeNull();
    expect(sendGridEventToStatus("processed")).toBeNull();
  });
});

describe("normalizeSendGridMessageId", () => {
  it("strips the per-recipient suffix after the first dot", () => {
    expect(normalizeSendGridMessageId("abc123.recvfilter-1")).toBe("abc123");
    expect(normalizeSendGridMessageId("abc123")).toBe("abc123");
  });

  it("returns null for empty/undefined input", () => {
    expect(normalizeSendGridMessageId(undefined)).toBeNull();
    expect(normalizeSendGridMessageId("")).toBeNull();
  });
});
