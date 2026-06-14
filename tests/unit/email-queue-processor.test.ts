/**
 * Unit tests for the notification_queue state machine (Stack B).
 *
 * The repository (`server/repositories`) and the SendGrid sender are mocked, so
 * these run with no DB and no network. We assert the exact status transitions
 * (sent / pending+backoff / failed), the digest batching-by-recipient logic,
 * and the failed-only / attempt-bounded retry filter.
 */
import { jest } from "@jest/globals";

type SendResultLike = { success: boolean; retriable?: boolean; error?: string; messageId?: string };

const updateMock =
  jest.fn<(id: string, updates: Record<string, unknown>, orgId?: string) => Promise<unknown>>();
const createMock = jest.fn<(item: Record<string, unknown>) => Promise<Record<string, unknown>>>();
const getQueueMock = jest.fn<(status?: string) => Promise<Record<string, unknown>[]>>();
jest.unstable_mockModule("../../server/repositories.js", () => ({
  dbNotificationsStorage: {
    createNotificationQueueItem: createMock,
    updateNotificationQueueItem: updateMock,
    getNotificationQueue: getQueueMock,
  },
}));

const sendEmailMock = jest.fn<(payload: unknown) => Promise<SendResultLike>>();
jest.unstable_mockModule("../../server/services/email-notification/email-sender.js", () => ({
  emailSender: {
    sendEmail: sendEmailMock,
    getRetryConfig: () => ({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }),
  },
}));

const { processQueueItem, processDigestQueue, retryFailedNotifications } = await import(
  "../../server/services/email-notification/queue-processor.js"
);

type QRow = {
  id: string;
  orgId: string;
  recipients: string[];
  subject: string;
  body: string;
  bodyHtml?: string | null;
  attemptCount?: number;
  status?: string;
  scheduledFor?: Date | null;
};
const qItem = (o: Partial<QRow> & { id: string }): QRow => ({
  orgId: "org-1",
  recipients: ["a@x.test"],
  subject: "S",
  body: "B",
  attemptCount: 0,
  status: "pending",
  ...o,
});
const run = (item: QRow) =>
  processQueueItem(item as unknown as Parameters<typeof processQueueItem>[0]);

type Updates = {
  status?: string;
  scheduledFor?: Date;
  lastError?: string | null;
  attemptCount?: number;
  sentAt?: Date;
};
const callOf = (i: number) => updateMock.mock.calls[i] as [string, Updates, string?];
const idOf = (i: number) => callOf(i)[0];
const updatesOf = (i: number) => callOf(i)[1];

beforeEach(() => {
  updateMock.mockReset().mockResolvedValue({});
  createMock
    .mockReset()
    .mockImplementation(async (item) => ({ id: "new-id", ...(item as Record<string, unknown>) }));
  getQueueMock.mockReset().mockResolvedValue([]);
  sendEmailMock.mockReset();
});

describe("processQueueItem", () => {
  it("marks the row sent on success", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "m" });

    await run(qItem({ id: "q1" }));

    expect(idOf(0)).toBe("q1");
    expect(callOf(0)[2]).toBe("org-1");
    expect(updatesOf(0)).toMatchObject({ status: "sent", attemptCount: 1, lastError: null });
    expect(updatesOf(0).sentAt).toBeInstanceOf(Date);
  });

  it("reschedules a retriable failure as pending with a future scheduledFor", async () => {
    sendEmailMock.mockResolvedValue({ success: false, retriable: true, error: "503" });
    const before = Date.now();

    await run(qItem({ id: "q2", attemptCount: 0 }));

    const updates = updatesOf(0);
    expect(updates).toMatchObject({ status: "pending", attemptCount: 1, lastError: "503" });
    expect(updates.scheduledFor).toBeInstanceOf(Date);
    expect((updates.scheduledFor as Date).getTime()).toBeGreaterThan(before);
  });

  it("marks failed when retries are exhausted", async () => {
    const original = process.env["EMAIL_MAX_RETRIES"];
    process.env["EMAIL_MAX_RETRIES"] = "0"; // maxAttempts = 1
    try {
      sendEmailMock.mockResolvedValue({ success: false, retriable: true, error: "503" });
      await run(qItem({ id: "q3", attemptCount: 0 }));
      expect(updatesOf(0)).toMatchObject({ status: "failed", attemptCount: 1, lastError: "503" });
    } finally {
      if (original === undefined) {
        delete process.env["EMAIL_MAX_RETRIES"];
      } else {
        process.env["EMAIL_MAX_RETRIES"] = original;
      }
    }
  });

  it("marks failed immediately for a non-retriable failure", async () => {
    sendEmailMock.mockResolvedValue({ success: false, retriable: false, error: "400" });
    await run(qItem({ id: "q4", attemptCount: 0 }));
    expect(updatesOf(0).status).toBe("failed");
  });
});

describe("processDigestQueue", () => {
  it("only processes pending items whose scheduledFor has elapsed", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "m" });
    getQueueMock.mockResolvedValue([
      qItem({ id: "past", scheduledFor: new Date(Date.now() - 1000) }),
      qItem({ id: "future", scheduledFor: new Date(Date.now() + 3_600_000) }),
      qItem({ id: "noschedule", scheduledFor: null }),
    ]);

    const count = await processDigestQueue();

    expect(getQueueMock).toHaveBeenCalledWith("pending");
    expect(count).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(idOf(0)).toBe("past");
  });

  it("batches items with the same recipients into a single digest email", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "m" });
    getQueueMock.mockResolvedValue([
      qItem({
        id: "d1",
        recipients: ["a@x.test", "b@x.test"],
        scheduledFor: new Date(Date.now() - 1000),
      }),
      // same recipient set, different order -> same group key (sorted join)
      qItem({
        id: "d2",
        recipients: ["b@x.test", "a@x.test"],
        scheduledFor: new Date(Date.now() - 1000),
      }),
    ]);

    const count = await processDigestQueue();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const sentPayload = sendEmailMock.mock.calls[0]![0] as { subject: string };
    expect(sentPayload.subject).toMatch(/Daily Compliance Digest/);
    expect(count).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(2);
    for (const call of updateMock.mock.calls) {
      expect((call as [string, Updates])[1].status).toBe("sent");
    }
  });

  it("marks every item in a failed digest group as failed", async () => {
    sendEmailMock.mockResolvedValue({ success: false, error: "smtp down" });
    getQueueMock.mockResolvedValue([
      qItem({ id: "d1", recipients: ["a@x.test"], scheduledFor: new Date(Date.now() - 1000) }),
      qItem({ id: "d2", recipients: ["a@x.test"], scheduledFor: new Date(Date.now() - 1000) }),
    ]);

    await processDigestQueue();

    expect(updateMock).toHaveBeenCalledTimes(2);
    for (const call of updateMock.mock.calls) {
      expect((call as [string, Updates])[1]).toMatchObject({
        status: "failed",
        lastError: "smtp down",
      });
    }
  });
});

describe("retryFailedNotifications", () => {
  it("retries only failed rows under the attempt ceiling", async () => {
    sendEmailMock.mockResolvedValue({ success: true, messageId: "m" });
    getQueueMock.mockResolvedValue([
      qItem({ id: "f1", status: "failed", attemptCount: 0 }),
      qItem({ id: "f2", status: "failed", attemptCount: 5 }), // over the ceiling
    ]);

    const count = await retryFailedNotifications(3);

    expect(getQueueMock).toHaveBeenCalledWith("failed");
    expect(count).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(idOf(0)).toBe("f1");
  });
});
