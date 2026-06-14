/**
 * Unit tests for crew expiry/compliance email notifications (Stack B).
 *
 * The crew + alerts domains and the SendGrid sender are mocked, so these run
 * with no DB and no network. Covers the enable/skip gating, recipient
 * resolution (override + admin CC), and that orgId is threaded to the sender.
 */
import { jest } from "@jest/globals";
import type { Crew } from "@shared/schema";
import { makeCrew, makeCrewCertification, makeCrewDocument } from "../fixtures/crew-email-fixtures";

const getCrewByIdMock = jest.fn<(crewId: string, orgId: string) => Promise<Crew | null>>();
const getCrewNotificationSettingsMock =
  jest.fn<(crewId: string, orgId: string) => Promise<Record<string, unknown> | null>>();
jest.unstable_mockModule("../../server/domains/crew/application/index.js", () => ({
  crewAppService: {
    getCrewById: getCrewByIdMock,
    getCrewNotificationSettings: getCrewNotificationSettingsMock,
  },
}));

const getCrewAlertSettingsMock =
  jest.fn<(orgId: string) => Promise<Record<string, unknown> | null>>();
const getSettingsMock = jest.fn<(orgId: string) => Promise<Record<string, unknown> | null>>();
jest.unstable_mockModule("../../server/domains/alerts/settings-service.js", () => ({
  alertSettingsService: {
    getCrewAlertSettings: getCrewAlertSettingsMock,
    getSettings: getSettingsMock,
  },
}));

const sendEmailMock =
  jest.fn<(payload: { to: string[] }, orgId?: string) => Promise<{ success: boolean }>>();
jest.unstable_mockModule("../../server/services/email-notification/email-sender.js", () => ({
  emailSender: { sendEmail: sendEmailMock },
}));

const {
  sendCertificationExpiryNotification,
  sendDocumentExpiryNotification,
  sendCrewComplianceNotification,
} = await import("../../server/services/email-notification/crew-notifications.js");

const payloadOf = (i = 0) => sendEmailMock.mock.calls[i]![0];
const orgIdOf = (i = 0) => sendEmailMock.mock.calls[i]![1];

beforeEach(() => {
  getCrewByIdMock.mockReset().mockResolvedValue(makeCrew());
  // null settings -> enabled with crew.email (the early-return branch)
  getCrewNotificationSettingsMock.mockReset().mockResolvedValue(null);
  getCrewAlertSettingsMock.mockReset().mockResolvedValue(null);
  getSettingsMock.mockReset().mockResolvedValue(null);
  sendEmailMock.mockReset().mockResolvedValue({ success: true });
});

describe("sendCertificationExpiryNotification", () => {
  it("sends to the crew email and threads orgId when enabled", async () => {
    const ok = await sendCertificationExpiryNotification(
      makeCrew(),
      makeCrewCertification(),
      20,
      "org-1"
    );

    expect(ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(payloadOf().to).toEqual(["jane@vessel.test"]);
    expect(orgIdOf()).toBe("org-1");
  });

  it("skips when crew email alerts are disabled", async () => {
    getCrewNotificationSettingsMock.mockResolvedValue({ emailAlertsEnabled: false });

    const ok = await sendCertificationExpiryNotification(
      makeCrew(),
      makeCrewCertification(),
      20,
      "org-1"
    );

    expect(ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("skips when the crew member has no email address", async () => {
    getCrewByIdMock.mockResolvedValue(makeCrew({ email: null }));

    const ok = await sendCertificationExpiryNotification(
      makeCrew({ email: null }),
      makeCrewCertification(),
      20,
      "org-1"
    );

    expect(ok).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("CCs the org admin email when enabled", async () => {
    getCrewAlertSettingsMock.mockResolvedValue({ sendToAdminEmail: true });
    getSettingsMock.mockResolvedValue({ defaultToEmail: "dpa@org.test" });

    await sendCertificationExpiryNotification(makeCrew(), makeCrewCertification(), 20, "org-1");

    expect(payloadOf().to).toEqual(["jane@vessel.test", "dpa@org.test"]);
  });
});

describe("sendDocumentExpiryNotification", () => {
  it("sends a document expiry notice when enabled", async () => {
    const ok = await sendDocumentExpiryNotification(makeCrew(), makeCrewDocument(), 15, "org-1");

    expect(ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(orgIdOf()).toBe("org-1");
  });
});

describe("sendCrewComplianceNotification", () => {
  it("sends a compliance alert when enabled", async () => {
    const ok = await sendCrewComplianceNotification(
      makeCrew(),
      "Hours of Rest",
      "Rest hours breach detected",
      "warning",
      "org-1"
    );

    expect(ok).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(orgIdOf()).toBe("org-1");
  });
});
