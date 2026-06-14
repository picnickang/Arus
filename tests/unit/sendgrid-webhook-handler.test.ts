/**
 * Unit tests for the SendGrid webhook route handler (`handleSendGridWebhook`).
 *
 * The handler is thin glue over the pure verifier/mappers (covered in
 * sendgrid-event-webhook.test.ts). Here we pin the glue: fail-closed 403 on a
 * bad/absent signature, mapping verified events to alert_email_log status
 * updates, accepting verified-but-malformed bodies, and surviving a writer
 * error. The verifier and DB writer are injected so no real ECDSA / DB runs.
 *
 * The settings repository is module-mocked so importing the route does not pull
 * in the database layer (the real writer is never used — `updateStatus` is
 * injected in every case).
 */
import { jest } from "@jest/globals";
import type {
  SendGridWebhookRequest,
  SendGridWebhookResponse,
} from "../../server/domains/alerts/webhooks/routes";

jest.unstable_mockModule("../../server/domains/alerts/settings-repository", () => ({
  alertSettingsRepository: {
    updateEmailLogStatusByMessageId: async () => 0,
  },
}));

const { handleSendGridWebhook } = await import("../../server/domains/alerts/webhooks/routes");
const { SENDGRID_SIGNATURE_HEADER, SENDGRID_TIMESTAMP_HEADER } = await import(
  "../../server/domains/alerts/webhooks/sendgrid-event-webhook"
);

interface CapturedResponse extends SendGridWebhookResponse {
  statusCode: number | null;
  body: unknown;
}

function createResponse(): CapturedResponse {
  const res: CapturedResponse = {
    statusCode: null,
    body: undefined,
    status(code: number): SendGridWebhookResponse {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown): void {
      res.body = payload;
    },
  };
  return res;
}

function createRequest(overrides: Partial<SendGridWebhookRequest> = {}): SendGridWebhookRequest {
  return {
    rawBody: Buffer.from("[]"),
    headers: {
      [SENDGRID_SIGNATURE_HEADER]: "sig",
      [SENDGRID_TIMESTAMP_HEADER]: "123",
    },
    body: [],
    ...overrides,
  };
}

describe("handleSendGridWebhook", () => {
  it("rejects with 403 when the signature does not verify (fail-closed)", async () => {
    const res = createResponse();
    let updateCalls = 0;
    const updateStatus = async (): Promise<number> => {
      updateCalls++;
      return 0;
    };

    await handleSendGridWebhook(createRequest(), res, { verify: () => false, updateStatus });

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Invalid signature" });
    expect(updateCalls).toBe(0);
  });

  it("rejects with 403 when rawBody is missing (cannot verify, never calls verify)", async () => {
    const res = createResponse();
    let verifyCalls = 0;
    const verify = (): boolean => {
      verifyCalls++;
      return true;
    };

    await handleSendGridWebhook(createRequest({ rawBody: undefined }), res, { verify });

    expect(res.statusCode).toBe(403);
    expect(verifyCalls).toBe(0);
  });

  it("maps delivery events to alert_email_log status updates and returns 200", async () => {
    const res = createResponse();
    const calls: Array<[string, string, string | null]> = [];
    const updateStatus = async (
      messageId: string,
      status: string,
      reason?: string | null
    ): Promise<number> => {
      calls.push([messageId, status, reason ?? null]);
      return 1;
    };

    const req = createRequest({
      body: [
        { event: "delivered", sg_message_id: "msg-1.filter0001" },
        { event: "bounce", sg_message_id: "msg-2.filter0002", reason: "550 No such user" },
        { event: "open", sg_message_id: "msg-3.filter0003" }, // engagement → ignored
        { event: "dropped" }, // no message id → skipped
      ],
    });

    await handleSendGridWebhook(req, res, { verify: () => true, updateStatus });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, updated: 2 });
    expect(calls).toEqual([
      ["msg-1", "delivered", null],
      ["msg-2", "bounced", "550 No such user"],
    ]);
  });

  it("accepts a verified-but-malformed (non-array) body without updating anything", async () => {
    const res = createResponse();
    let updateCalls = 0;
    const updateStatus = async (): Promise<number> => {
      updateCalls++;
      return 0;
    };

    await handleSendGridWebhook(createRequest({ body: { not: "an array" } }), res, {
      verify: () => true,
      updateStatus,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, updated: 0 });
    expect(updateCalls).toBe(0);
  });

  it("logs and skips a row when the status writer throws, still returning 200", async () => {
    const res = createResponse();
    const updateStatus = async (): Promise<number> => {
      throw new Error("db down");
    };

    const req = createRequest({ body: [{ event: "delivered", sg_message_id: "msg-1.x" }] });

    await handleSendGridWebhook(req, res, { verify: () => true, updateStatus });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, updated: 0 });
  });
});
