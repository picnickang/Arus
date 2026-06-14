/**
 * Unit tests for the EmailSender orchestrator (Stack B).
 *
 * After the stack unification, EmailSender no longer talks to SendGrid directly
 * for the main send path — it resolves the org's provider via alertSettingsService
 * and delegates to the multi-provider emailProviderService, falling back to a
 * global env SendGrid config and finally dev-mode. Both collaborators are mocked
 * (no network, no DB). The env-key state is read in the constructor, so each test
 * sets env first and constructs a fresh EmailSender.
 *
 * sendWithAttachment still uses the env SendGrid path directly (emailProviderService
 * has no attachment support), so those cases mock global.fetch.
 */
import { jest } from "@jest/globals";

type ProviderResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  retriable?: boolean;
  provider?: string;
};
type ProviderConfig = { provider: string; sendgridApiKey?: string; fromEmail: string };

const providerSendMock =
  jest.fn<(config: ProviderConfig, payload: unknown) => Promise<ProviderResult>>();
jest.unstable_mockModule("../../server/services/email-provider-service.js", () => ({
  emailProviderService: { sendEmail: providerSendMock },
}));

const resolveOrgConfigMock = jest.fn<(orgId: string) => Promise<ProviderConfig | null>>();
jest.unstable_mockModule("../../server/domains/alerts/settings-service.js", () => ({
  alertSettingsService: { resolveOrgEmailConfig: resolveOrgConfigMock },
}));

const { EmailSender } = await import("../../server/services/email-notification/email-sender.js");

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get: (k: string) => string | null };
};
let fetchMock: jest.Mock<(...args: unknown[]) => Promise<FetchResponse>>;

const ORIGINAL_SENDGRID = process.env["SENDGRID_API_KEY"];
const ORIGINAL_FROM = process.env["EMAIL_FROM"];

beforeEach(() => {
  fetchMock = jest.fn<(...args: unknown[]) => Promise<FetchResponse>>();
  global.fetch = fetchMock as unknown as typeof fetch;
  providerSendMock.mockReset().mockResolvedValue({ success: true, messageId: "prov-1" });
  resolveOrgConfigMock.mockReset().mockResolvedValue(null);
  delete process.env["SENDGRID_API_KEY"];
  process.env["EMAIL_FROM"] = "from@arus.test";
});

afterEach(() => {
  if (ORIGINAL_SENDGRID === undefined) {
    delete process.env["SENDGRID_API_KEY"];
  } else {
    process.env["SENDGRID_API_KEY"] = ORIGINAL_SENDGRID;
  }
  if (ORIGINAL_FROM === undefined) {
    delete process.env["EMAIL_FROM"];
  } else {
    process.env["EMAIL_FROM"] = ORIGINAL_FROM;
  }
});

describe("sendEmail resolution order", () => {
  it("dev-mode: no env key and no orgId — no provider call, dev messageId", async () => {
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-/);
    expect(providerSendMock).not.toHaveBeenCalled();
    expect(resolveOrgConfigMock).not.toHaveBeenCalled();
  });

  it("dev-mode: orgId with no configured provider and no env key falls through to dev", async () => {
    resolveOrgConfigMock.mockResolvedValue(null);
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" }, "org-1");

    expect(resolveOrgConfigMock).toHaveBeenCalledWith("org-1");
    expect(providerSendMock).not.toHaveBeenCalled();
    expect(result.messageId).toMatch(/^dev-/);
  });

  it("env SendGrid: delegates to emailProviderService with an env-built config", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" });

    expect(providerSendMock).toHaveBeenCalledTimes(1);
    const [config, payload] = providerSendMock.mock.calls[0]!;
    expect(config).toMatchObject({
      provider: "sendgrid",
      sendgridApiKey: "env-key",
      fromEmail: "from@arus.test",
    });
    expect(payload).toMatchObject({ to: ["a@x.test"], subject: "S", text: "T" });
    expect(result).toEqual({ success: true, messageId: "prov-1" });
  });

  it("per-org provider takes precedence over the env key", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    resolveOrgConfigMock.mockResolvedValue({
      provider: "smtp",
      fromEmail: "ops@org.test",
    });
    providerSendMock.mockResolvedValue({ success: true, messageId: "smtp-1", provider: "smtp" });
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" }, "org-1");

    expect(providerSendMock).toHaveBeenCalledTimes(1);
    expect(providerSendMock.mock.calls[0]![0]).toMatchObject({ provider: "smtp" });
    expect(result.messageId).toBe("smtp-1");
  });

  it("falls back to env SendGrid when the org has no configured provider", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    resolveOrgConfigMock.mockResolvedValue(null);
    const sender = new EmailSender();

    await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" }, "org-1");

    expect(providerSendMock).toHaveBeenCalledTimes(1);
    expect(providerSendMock.mock.calls[0]![0]).toMatchObject({ provider: "sendgrid" });
  });

  it("falls back gracefully when org config resolution throws", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    resolveOrgConfigMock.mockRejectedValue(new Error("db down"));
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" }, "org-1");

    expect(providerSendMock).toHaveBeenCalledTimes(1);
    expect(providerSendMock.mock.calls[0]![0]).toMatchObject({ provider: "sendgrid" });
    expect(result.success).toBe(true);
  });
});

describe("status", () => {
  it("reflects the env SendGrid key", () => {
    const devSender = new EmailSender();
    expect(devSender.isEnabled()).toBe(false);
    expect(devSender.getStatus()).toEqual({ enabled: false, provider: "development" });

    process.env["SENDGRID_API_KEY"] = "env-key";
    const enabledSender = new EmailSender();
    expect(enabledSender.isEnabled()).toBe(true);
    expect(enabledSender.getStatus()).toEqual({ enabled: true, provider: "sendgrid" });
  });
});

describe("getStatusForOrg", () => {
  it("reports the org's configured provider when available", async () => {
    resolveOrgConfigMock.mockResolvedValue({ provider: "smtp", fromEmail: "ops@org.test" });
    const sender = new EmailSender();
    expect(await sender.getStatusForOrg("org-1")).toEqual({ enabled: true, provider: "smtp" });
  });

  it("falls back to env SendGrid when the org has no configured provider", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    resolveOrgConfigMock.mockResolvedValue(null);
    const sender = new EmailSender();
    expect(await sender.getStatusForOrg("org-1")).toEqual({ enabled: true, provider: "sendgrid" });
  });

  it("reports development when neither org provider nor env key is set", async () => {
    resolveOrgConfigMock.mockResolvedValue(null);
    const sender = new EmailSender();
    expect(await sender.getStatusForOrg("org-1")).toEqual({
      enabled: false,
      provider: "development",
    });
  });

  it("falls back to env/dev status when org resolution throws", async () => {
    resolveOrgConfigMock.mockRejectedValue(new Error("settings unavailable"));
    const sender = new EmailSender();
    expect(await sender.getStatusForOrg("org-1")).toEqual({
      enabled: false,
      provider: "development",
    });
  });
});

describe("sendWithAttachment", () => {
  it("logs (no fetch) in dev mode", async () => {
    const sender = new EmailSender();
    const result = await sender.sendWithAttachment("a@x.test", "S", "T", "<p>T</p>", {
      filename: "f.pdf",
      content: Buffer.from("hello"),
      contentType: "application/pdf",
    });
    expect(result.messageId).toMatch(/^dev-/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a base64 attachment to SendGrid when the env key is set", async () => {
    process.env["SENDGRID_API_KEY"] = "env-key";
    fetchMock.mockResolvedValue({ ok: true, status: 200, headers: { get: () => "att-1" } });
    const sender = new EmailSender();

    const result = await sender.sendWithAttachment("a@x.test", "S", "T", "<p>T</p>", {
      filename: "report.pdf",
      content: Buffer.from("PDFDATA"),
      contentType: "application/pdf",
    });

    expect(result).toEqual({ success: true, messageId: "att-1" });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.attachments[0].content).toBe(Buffer.from("PDFDATA").toString("base64"));
    expect(providerSendMock).not.toHaveBeenCalled(); // attachment path bypasses the provider
  });
});
