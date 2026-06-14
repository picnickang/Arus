/**
 * Email notifications API (server lane, embedded/dev-mode).
 *
 * This lane runs against embedded SQLite in VESSEL mode with no SENDGRID_API_KEY,
 * so the SendGrid sender is in dev-mode (no network). It locks in the DB-free
 * HTTP contract that must hold even in the offline vessel deployment: the status
 * endpoint and the test-email request-validation guard.
 *
 * Out of scope for this lane (cloud-only / pre-existing embedded schema gaps):
 *   - notification_queue is a cloud-only table, so the full pending->sent test
 *     flow is pinned in the unit lane (email-notification-service.test.ts).
 *   - the alert-settings (Stack A) endpoints query alert_settings, which is not
 *     provisioned in embedded SQLite; that send/connection logic is covered by
 *     email-provider-service.test.ts and the cloud smoke-test runbook.
 *
 * References TEST_BASE_URL / http://localhost:5000 so the integration harness
 * boots the self-started server. Registered in the SERVER lane in
 * scripts/run-integration-lane.mjs.
 */
import { describe, it, expect } from "@jest/globals";

const BASE_URL = process.env["TEST_BASE_URL"] || "http://localhost:5000";
const TEST_ORG_ID = "default-org-id";

async function api(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "email-integration-test",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

describe("Email notifications API (dev-mode)", () => {
  it("GET /api/notifications/email/status reports development mode", async () => {
    const { status, data } = await api("GET", "/api/notifications/email/status");
    expect(status).toBe(200);
    expect(data).toEqual({ enabled: false, provider: "development" });
  });

  it("POST /api/notifications/email/test validates the email before queueing", async () => {
    const { status, data } = await api("POST", "/api/notifications/email/test", {
      subject: "missing recipient",
    });
    expect(status).toBe(400);
    expect(data.error).toBe("Email address required");
  });

  it("POST /api/notifications/email/test rejects a malformed email address", async () => {
    const { status } = await api("POST", "/api/notifications/email/test", {
      email: "not-an-email",
    });
    expect(status).toBe(400);
  });
});
