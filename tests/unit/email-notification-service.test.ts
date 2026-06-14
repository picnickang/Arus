/**
 * Unit tests for EmailNotificationService (Stack B orchestration).
 *
 * Uses an in-memory fake `dbNotificationsStorage` (Map-backed) plus a mocked
 * `email-sender`, so the REAL service + queue-processor run end-to-end with no
 * DB and no network. `crew-notifications` is mocked because it imports the crew
 * and alerts domains (heavy DB-bound chains) that are irrelevant here.
 *
 * The headline assertion is the Fix #1 regression: sendTestNotification must
 * queue AND deliver the row (pending -> sent), which the old test endpoint
 * never did.
 */
import { jest } from "@jest/globals";
import type { ComplianceFinding, OrgNotificationSettings } from "@shared/schema";

type Row = Record<string, unknown> & { id: string; status?: string };

class FakeNotificationsStorage {
  settings: OrgNotificationSettings[] = [];
  queue = new Map<string, Row>();
  calls: string[] = [];
  private seq = 0;

  reset(): void {
    this.settings = [];
    this.queue.clear();
    this.calls = [];
    this.seq = 0;
  }

  async getNotificationSettings(_orgId: string): Promise<OrgNotificationSettings[]> {
    this.calls.push("getNotificationSettings");
    return this.settings;
  }

  async createNotificationQueueItem(item: Record<string, unknown>): Promise<Row> {
    this.calls.push("createNotificationQueueItem");
    const id = `q-${++this.seq}`;
    const row: Row = { id, attemptCount: 0, status: "pending", ...item };
    this.queue.set(id, row);
    return row;
  }

  async updateNotificationQueueItem(
    id: string,
    updates: Record<string, unknown>,
    _orgId?: string
  ): Promise<Row> {
    this.calls.push("updateNotificationQueueItem");
    const row: Row = { ...(this.queue.get(id) as Row), ...updates };
    this.queue.set(id, row);
    return row;
  }

  async getNotificationQueue(status?: string): Promise<Row[]> {
    const all = [...this.queue.values()];
    return status ? all.filter((r) => r.status === status) : all;
  }

  rows(): Row[] {
    return [...this.queue.values()];
  }
}

const fakeStorage = new FakeNotificationsStorage();
jest.unstable_mockModule("../../server/repositories.js", () => ({
  dbNotificationsStorage: fakeStorage,
}));

const sendEmailMock =
  jest.fn<(payload: unknown) => Promise<{ success: boolean; messageId?: string }>>();
const getStatusMock = jest.fn(() => ({ enabled: false, provider: "development" }));
const isEnabledMock = jest.fn(() => false);
jest.unstable_mockModule("../../server/services/email-notification/email-sender.js", () => ({
  emailSender: {
    sendEmail: sendEmailMock,
    getRetryConfig: () => ({ maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }),
    getStatus: getStatusMock,
    isEnabled: isEnabledMock,
  },
}));

jest.unstable_mockModule("../../server/services/email-notification/crew-notifications.js", () => ({
  sendCertificationExpiryNotification: jest.fn(),
  sendDocumentExpiryNotification: jest.fn(),
  sendCrewComplianceNotification: jest.fn(),
}));

const claimAlertSlotMock = jest.fn<
  (...args: unknown[]) => Promise<{
    claimed: boolean;
    cooldownId?: string;
    snapshot?: unknown;
    reason?: string;
  }>
>();
const getSettingsMock = jest.fn<(orgId: string) => Promise<{ alertCooldownMinutes: number }>>();
const recordAlertEmailSentMock = jest.fn<(id: string) => Promise<void>>();
const revertAlertSlotMock = jest.fn<(id: string, snapshot: unknown) => Promise<boolean>>();
jest.unstable_mockModule("../../server/domains/alerts/settings-service.js", () => ({
  alertSettingsService: {
    getSettings: getSettingsMock,
    claimAlertSlot: claimAlertSlotMock,
    recordAlertEmailSent: recordAlertEmailSentMock,
    revertAlertSlot: revertAlertSlotMock,
  },
}));

const { emailNotificationService } = await import(
  "../../server/services/email-notification/service.js"
);

const setting = (o: Partial<OrgNotificationSettings> = {}): OrgNotificationSettings =>
  ({
    id: `s-${Math.random().toString(36).slice(2)}`,
    orgId: "org-1",
    vesselId: null,
    notificationType: "compliance",
    enabled: true,
    minSeverity: "warning",
    recipientEmails: ["a@x.test"],
    digestMode: false,
    digestSchedule: null,
    ...o,
  }) as OrgNotificationSettings;

const finding = (o: Partial<ComplianceFinding> = {}): ComplianceFinding =>
  ({
    id: "f-1",
    vesselId: "v-1",
    severity: "warning",
    ruleName: "Missing watch entry",
    ruleCode: "WATCH-001",
    category: "logbook",
    logDate: "2026-06-01",
    message: "A required watch entry is missing.",
    sourceType: "engine_log",
    status: "open",
    ...o,
  }) as ComplianceFinding;

beforeEach(() => {
  fakeStorage.reset();
  sendEmailMock.mockReset().mockResolvedValue({ success: true, messageId: "m" });
  getSettingsMock.mockReset().mockResolvedValue({ alertCooldownMinutes: 30 });
  claimAlertSlotMock
    .mockReset()
    .mockResolvedValue({ claimed: true, cooldownId: "cd-1", snapshot: {} });
  recordAlertEmailSentMock.mockReset().mockResolvedValue(undefined);
  revertAlertSlotMock.mockReset().mockResolvedValue(true);
});

describe("sendComplianceNotification", () => {
  it("queues and immediately delivers (pending -> sent) in non-digest mode", async () => {
    fakeStorage.settings = [setting({ recipientEmails: ["a@x.test"], digestMode: false })];

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const rows = fakeStorage.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ notificationType: "compliance", status: "sent" });
  });

  it("defers digest-mode notifications: queued with a scheduledFor, not sent", async () => {
    fakeStorage.settings = [setting({ recipientEmails: ["a@x.test"], digestMode: true })];

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(sendEmailMock).not.toHaveBeenCalled();
    const rows = fakeStorage.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0]["scheduledFor"]).toBeInstanceOf(Date);
  });

  it("skips findings below the configured severity threshold", async () => {
    fakeStorage.settings = [setting({ minSeverity: "warning" })];

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "info" }),
      "Vessel A",
      "org-1"
    );

    expect(fakeStorage.rows()).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("de-duplicates recipient emails", async () => {
    fakeStorage.settings = [
      setting({ recipientEmails: ["a@x.test", "a@x.test", "b@y.test"], digestMode: false }),
    ];

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(fakeStorage.rows()[0]!["recipients"]).toEqual(["a@x.test", "b@y.test"]);
  });

  it("suppresses an immediate alert when the cooldown claim is denied", async () => {
    fakeStorage.settings = [setting({ digestMode: false })];
    claimAlertSlotMock.mockResolvedValue({ claimed: false, reason: "Cooldown active" });

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(claimAlertSlotMock).toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(fakeStorage.rows()).toHaveLength(0);
  });

  it("commits the cooldown after a successful send", async () => {
    fakeStorage.settings = [setting({ digestMode: false })];

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(recordAlertEmailSentMock).toHaveBeenCalledWith("cd-1");
    expect(revertAlertSlotMock).not.toHaveBeenCalled();
  });

  it("reverts the cooldown claim when the send fails", async () => {
    fakeStorage.settings = [setting({ digestMode: false })];
    sendEmailMock.mockResolvedValue({ success: false });

    await emailNotificationService.sendComplianceNotification(
      finding({ severity: "critical" }),
      "Vessel A",
      "org-1"
    );

    expect(revertAlertSlotMock).toHaveBeenCalledWith("cd-1", {});
    expect(recordAlertEmailSentMock).not.toHaveBeenCalled();
  });
});

describe("sendLogbookReminderNotification", () => {
  it("queues and delivers a logbook reminder", async () => {
    fakeStorage.settings = [setting({ notificationType: "logbook" })];

    await emailNotificationService.sendLogbookReminderNotification(
      "engine",
      "v-1",
      "Vessel A",
      "2026-06-01",
      "org-1"
    );

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(fakeStorage.rows()[0]).toMatchObject({ notificationType: "logbook", status: "sent" });
  });
});

describe("sendTestNotification (Fix #1 regression)", () => {
  it("queues a test row AND processes it through to sent", async () => {
    const result = await emailNotificationService.sendTestNotification({
      orgId: "org-1",
      email: "tester@x.test",
      subject: "Custom subject",
    });

    expect(result.queued).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const rows = fakeStorage.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      notificationType: "test",
      subject: "Custom subject",
      recipients: ["tester@x.test"],
      // The bug was that this stayed "pending" forever; the fix delivers it.
      status: "sent",
    });
    expect(rows[0].status).not.toBe("pending");
  });
});

describe("status delegation", () => {
  it("delegates getStatus/isEnabled to the underlying sender", () => {
    expect(emailNotificationService.getStatus()).toEqual({
      enabled: false,
      provider: "development",
    });
    expect(emailNotificationService.isEnabled()).toBe(false);
    expect(getStatusMock).toHaveBeenCalled();
    expect(isEnabledMock).toHaveBeenCalled();
  });
});
