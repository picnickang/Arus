/**
 * Unit tests for alertSettingsService email-config resolution.
 *
 * After the stack unification, emailProviderService is a plaintext transport and
 * decryption happens here, in buildEmailConfig. resolveOrgEmailConfig is what the
 * notification sender calls to honour the org's configured provider. The
 * repository and crypto-service are mocked (no DB, no real crypto): decryptSecret
 * is stubbed to prefix "decrypted:" so we can assert it was applied.
 */
import { jest } from "@jest/globals";

const getOrgSettingsMock = jest.fn<(orgId: string) => Promise<Record<string, unknown> | null>>();
jest.unstable_mockModule("../../server/domains/alerts/settings-repository", () => ({
  alertSettingsRepository: { getOrgSettings: getOrgSettingsMock },
}));

const decryptMock = jest.fn((s: string) => `decrypted:${s}`);
jest.unstable_mockModule("../../server/lib/crypto-service", () => ({
  decryptSecret: decryptMock,
  encryptSecret: (s: string) => `enc:${s}`,
}));

const { alertSettingsService } = await import("../../server/domains/alerts/settings-service");

const settings = (o: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "s1",
  orgId: "org-1",
  emailEnabled: false,
  provider: "sendgrid",
  apiKeyEncrypted: null,
  smtpHost: null,
  smtpPort: 587,
  smtpUser: null,
  smtpEncryptedPassword: null,
  smtpUseTls: true,
  fromEmail: "noreply@arus-marine.com",
  fromName: "ARUS Marine",
  ...o,
});

beforeEach(() => {
  getOrgSettingsMock.mockReset();
  decryptMock.mockClear();
});

describe("resolveOrgEmailConfig", () => {
  it("returns null when the org has no settings row", async () => {
    getOrgSettingsMock.mockResolvedValue(null);
    expect(await alertSettingsService.resolveOrgEmailConfig("org-1")).toBeNull();
  });

  it("returns null when email is disabled", async () => {
    getOrgSettingsMock.mockResolvedValue(settings({ emailEnabled: false, apiKeyEncrypted: "ENC" }));
    expect(await alertSettingsService.resolveOrgEmailConfig("org-1")).toBeNull();
  });

  it("returns a decrypted SendGrid config", async () => {
    getOrgSettingsMock.mockResolvedValue(
      settings({
        emailEnabled: true,
        provider: "sendgrid",
        apiKeyEncrypted: "ENC",
        fromEmail: "f@x.test",
      })
    );

    const config = await alertSettingsService.resolveOrgEmailConfig("org-1");

    expect(config).toMatchObject({
      provider: "sendgrid",
      sendgridApiKey: "decrypted:ENC",
      fromEmail: "f@x.test",
    });
    expect(decryptMock).toHaveBeenCalledWith("ENC");
  });

  it("returns a decrypted SMTP config", async () => {
    getOrgSettingsMock.mockResolvedValue(
      settings({
        emailEnabled: true,
        provider: "smtp",
        smtpHost: "smtp.x.test",
        smtpUser: "u",
        smtpEncryptedPassword: "ENCPW",
      })
    );

    const config = await alertSettingsService.resolveOrgEmailConfig("org-1");

    expect(config).toMatchObject({
      provider: "smtp",
      smtpHost: "smtp.x.test",
      smtpPassword: "decrypted:ENCPW",
    });
    expect(decryptMock).toHaveBeenCalledWith("ENCPW");
  });

  it("returns null when the chosen provider has no usable credentials", async () => {
    getOrgSettingsMock.mockResolvedValue(
      settings({ emailEnabled: true, provider: "sendgrid", apiKeyEncrypted: null })
    );
    expect(await alertSettingsService.resolveOrgEmailConfig("org-1")).toBeNull();
  });
});
