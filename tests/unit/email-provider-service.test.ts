/**
 * Unit tests for the multi-provider EmailProviderService (Stack A).
 *
 * This service is now a pure transport over PLAINTEXT credentials (decryption
 * moved to the callers that own encrypted-at-rest storage), so there is no
 * crypto-service mock here — credentials in the config are used verbatim.
 * `nodemailer` is mocked and `global.fetch` is stubbed (no network).
 *
 * Only the `emailProviderService` singleton is exported, so the shared SMTP
 * transporter cache persists across tests — each SMTP case therefore uses a
 * UNIQUE host so cache keys never collide between tests.
 */
import { jest } from "@jest/globals";

const sendMailMock = jest.fn<(opts: unknown) => Promise<{ messageId: string }>>();
const verifyMock = jest.fn<() => Promise<boolean>>();
const createTransportMock = jest.fn<
  (opts: unknown) => { sendMail: typeof sendMailMock; verify: typeof verifyMock }
>(() => ({ sendMail: sendMailMock, verify: verifyMock }));
jest.unstable_mockModule("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: createTransportMock },
  createTransport: createTransportMock,
}));

const { emailProviderService } = await import("../../server/services/email-provider-service");
type EmailConfig = Parameters<typeof emailProviderService.sendEmail>[0];

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get: (k: string) => string | null };
  text: () => Promise<string>;
};
let fetchMock: jest.Mock<(...args: unknown[]) => Promise<FetchResponse>>;

function sgOk(messageId: string | null = "sg-1"): FetchResponse {
  return { ok: true, status: 200, headers: { get: () => messageId }, text: async () => "" };
}
function sgErr(status: number): FetchResponse {
  return { ok: false, status, headers: { get: () => null }, text: async () => "err-body" };
}
function cfg(overrides: Partial<EmailConfig> & Pick<EmailConfig, "provider">): EmailConfig {
  return { fromEmail: "noreply@arus.test", ...overrides } as EmailConfig;
}

beforeEach(() => {
  fetchMock = jest.fn<(...args: unknown[]) => Promise<FetchResponse>>();
  global.fetch = fetchMock as unknown as typeof fetch;
  sendMailMock.mockReset();
  verifyMock.mockReset();
  createTransportMock.mockClear();
});

describe("sendEmail via SendGrid", () => {
  it("sends with the (plaintext) bearer key and maps the payload", async () => {
    fetchMock.mockResolvedValue(sgOk("sg-xyz"));

    const result = await emailProviderService.sendEmail(
      cfg({ provider: "sendgrid", sendgridApiKey: "secret-key", fromName: "ARUS Ops" }),
      { to: ["a@x.test"], subject: "Hi", text: "Body", html: "<p>Body</p>" }
    );

    expect(result).toEqual({ success: true, messageId: "sg-xyz", provider: "sendgrid" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer secret-key");
    const body = JSON.parse(init.body as string);
    expect(body.from).toEqual({ email: "noreply@arus.test", name: "ARUS Ops" });
    expect(body.personalizations[0].to).toEqual([{ email: "a@x.test" }]);
  });

  it("maps cc/bcc/replyTo when present and omits them when absent", async () => {
    fetchMock.mockResolvedValue(sgOk());
    await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
      to: ["a@x.test"],
      cc: ["c@x.test"],
      bcc: ["b@x.test"],
      replyTo: "reply@x.test",
      subject: "S",
      text: "T",
    });
    let body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.personalizations[0].cc).toEqual([{ email: "c@x.test" }]);
    expect(body.personalizations[0].bcc).toEqual([{ email: "b@x.test" }]);
    expect(body.reply_to).toEqual({ email: "reply@x.test" });
    expect(body.from.name).toBe("ARUS Marine"); // default when fromName omitted

    fetchMock.mockClear();
    await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
      to: ["a@x.test"],
      subject: "S",
      text: "T",
    });
    body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.personalizations[0].cc).toBeUndefined();
    expect(body.personalizations[0].bcc).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
  });

  it("falls back to an sg- messageId when the header is missing", async () => {
    fetchMock.mockResolvedValue(sgOk(null));
    const r = await emailProviderService.sendEmail(
      cfg({ provider: "sendgrid", sendgridApiKey: "k" }),
      { to: ["a@x.test"], subject: "S", text: "T" }
    );
    expect(r.success).toBe(true);
    expect(r.messageId).toMatch(/^sg-/);
  });

  it("classifies retriable status codes (503, 429) and non-retriable (400)", async () => {
    fetchMock.mockResolvedValueOnce(sgErr(503));
    expect(
      await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
        to: ["a@x.test"],
        subject: "S",
        text: "T",
      })
    ).toMatchObject({ success: false, retriable: true, provider: "sendgrid" });

    fetchMock.mockResolvedValueOnce(sgErr(429));
    expect(
      await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
        to: ["a@x.test"],
        subject: "S",
        text: "T",
      })
    ).toMatchObject({ success: false, retriable: true });

    fetchMock.mockResolvedValueOnce(sgErr(400));
    expect(
      await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
        to: ["a@x.test"],
        subject: "S",
        text: "T",
      })
    ).toMatchObject({ success: false, retriable: false });
  });

  it("classifies network exceptions as retriable only when fetch/network", async () => {
    fetchMock.mockRejectedValueOnce(new Error("fetch failed"));
    expect(
      await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
        to: ["a@x.test"],
        subject: "S",
        text: "T",
      })
    ).toMatchObject({ success: false, retriable: true });

    fetchMock.mockRejectedValueOnce(new Error("nope"));
    expect(
      await emailProviderService.sendEmail(cfg({ provider: "sendgrid", sendgridApiKey: "k" }), {
        to: ["a@x.test"],
        subject: "S",
        text: "T",
      })
    ).toMatchObject({ success: false, retriable: false });
  });

  it("errors without calling fetch when the API key is missing", async () => {
    const r = await emailProviderService.sendEmail(cfg({ provider: "sendgrid" }), {
      to: ["a@x.test"],
      subject: "S",
      text: "T",
    });
    expect(r).toEqual({ success: false, error: "SendGrid API key not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendEmail via SMTP", () => {
  it("creates a transporter, formats addresses, and reports success", async () => {
    sendMailMock.mockResolvedValue({ messageId: "smtp-1" });

    const result = await emailProviderService.sendEmail(
      cfg({
        provider: "smtp",
        smtpHost: "smtp.success.test",
        smtpPort: 587,
        smtpUser: "user",
        smtpPassword: "pw",
        fromName: "ARUS Ops",
      }),
      { to: ["a@x.test", "b@x.test"], cc: ["c@x.test"], subject: "S", text: "T", html: "<p>T</p>" }
    );

    expect(result).toEqual({ success: true, messageId: "smtp-1", provider: "smtp" });
    const transportCfg = createTransportMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(transportCfg).toMatchObject({ host: "smtp.success.test", port: 587, secure: false });
    expect((transportCfg["auth"] as Record<string, string>)["pass"]).toBe("pw");
    expect((transportCfg["tls"] as Record<string, boolean>)["rejectUnauthorized"]).toBe(true);
    const mail = sendMailMock.mock.calls[0]![0] as { from: string; to: string; cc?: string };
    expect(mail.from).toBe('"ARUS Ops" <noreply@arus.test>');
    expect(mail.to).toBe("a@x.test, b@x.test");
    expect(mail.cc).toBe("c@x.test");
  });

  it("caches the transporter for repeated sends with the same key", async () => {
    sendMailMock.mockResolvedValue({ messageId: "m" });
    const c = cfg({ provider: "smtp", smtpHost: "smtp.cache.test", smtpPort: 587, smtpUser: "u" });

    await emailProviderService.sendEmail(c, { to: ["a@x.test"], subject: "S", text: "T" });
    await emailProviderService.sendEmail(c, { to: ["a@x.test"], subject: "S", text: "T" });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it("evicts the cached transporter after a send error and rebuilds it", async () => {
    const c = cfg({ provider: "smtp", smtpHost: "smtp.evict.test", smtpPort: 587, smtpUser: "u" });

    sendMailMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const failed = await emailProviderService.sendEmail(c, {
      to: ["a@x.test"],
      subject: "S",
      text: "T",
    });
    expect(failed).toMatchObject({ success: false, retriable: true, provider: "smtp" });

    sendMailMock.mockResolvedValueOnce({ messageId: "ok" });
    await emailProviderService.sendEmail(c, { to: ["a@x.test"], subject: "S", text: "T" });

    // first call built it, error evicted it, second call rebuilt it
    expect(createTransportMock).toHaveBeenCalledTimes(2);
  });

  it("errors when no SMTP host is configured", async () => {
    const r = await emailProviderService.sendEmail(cfg({ provider: "smtp" }), {
      to: ["a@x.test"],
      subject: "S",
      text: "T",
    });
    expect(r).toEqual({ success: false, error: "SMTP host not configured" });
    expect(createTransportMock).not.toHaveBeenCalled();
  });
});

describe("sendEmail via SES", () => {
  it("builds a fresh STARTTLS transporter on every send with the given keys", async () => {
    sendMailMock.mockResolvedValue({ messageId: "ses-1" });
    const c = cfg({
      provider: "ses",
      sesAccessKeyId: "akid",
      sesSecretAccessKey: "secret",
      sesRegion: "ap-southeast-1",
    });

    await emailProviderService.sendEmail(c, { to: ["a@x.test"], subject: "S", text: "T" });
    await emailProviderService.sendEmail(c, { to: ["a@x.test"], subject: "S", text: "T" });

    expect(createTransportMock).toHaveBeenCalledTimes(2); // never cached
    const transportCfg = createTransportMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(transportCfg).toMatchObject({
      host: "email-smtp.ap-southeast-1.amazonaws.com",
      port: 587,
      secure: false,
      requireTLS: true,
    });
    expect(transportCfg["auth"] as Record<string, string>).toEqual({
      user: "akid",
      pass: "secret",
    });
  });

  it("classifies ETIMEDOUT as retriable and missing creds as a hard error", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    const retriable = await emailProviderService.sendEmail(
      cfg({ provider: "ses", sesAccessKeyId: "a", sesSecretAccessKey: "b" }),
      { to: ["a@x.test"], subject: "S", text: "T" }
    );
    expect(retriable).toMatchObject({ success: false, retriable: true, provider: "ses" });

    const missing = await emailProviderService.sendEmail(cfg({ provider: "ses" }), {
      to: ["a@x.test"],
      subject: "S",
      text: "T",
    });
    expect(missing).toEqual({ success: false, error: "AWS SES credentials not configured" });
  });
});

describe("sendEmail with an unsupported provider", () => {
  it("returns a clear error", async () => {
    const r = await emailProviderService.sendEmail(
      cfg({ provider: "mailgun" as unknown as EmailConfig["provider"] }),
      { to: ["a@x.test"], subject: "S", text: "T" }
    );
    expect(r).toEqual({ success: false, error: "Unsupported provider: mailgun" });
  });
});

describe("testConnection", () => {
  it("SendGrid: ok, non-ok, and thrown", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true } as FetchResponse);
    expect(
      await emailProviderService.testConnection(cfg({ provider: "sendgrid", sendgridApiKey: "k" }))
    ).toEqual({ success: true });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 } as FetchResponse);
    expect(
      await emailProviderService.testConnection(cfg({ provider: "sendgrid", sendgridApiKey: "k" }))
    ).toMatchObject({ success: false });

    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(
      await emailProviderService.testConnection(cfg({ provider: "sendgrid", sendgridApiKey: "k" }))
    ).toMatchObject({ success: false, error: "down" });

    expect(await emailProviderService.testConnection(cfg({ provider: "sendgrid" }))).toEqual({
      success: false,
      error: "SendGrid API key not configured",
    });
  });

  it("SMTP: verify resolves and rejects", async () => {
    verifyMock.mockResolvedValueOnce(true);
    expect(
      await emailProviderService.testConnection(
        cfg({ provider: "smtp", smtpHost: "smtp.verify.test", smtpPort: 587 })
      )
    ).toEqual({ success: true });

    verifyMock.mockRejectedValueOnce(new Error("auth failed"));
    expect(
      await emailProviderService.testConnection(
        cfg({ provider: "smtp", smtpHost: "smtp.verify2.test", smtpPort: 587 })
      )
    ).toMatchObject({ success: false, error: "auth failed" });

    expect(await emailProviderService.testConnection(cfg({ provider: "smtp" }))).toEqual({
      success: false,
      error: "SMTP host not configured",
    });
  });

  it("SES: verify resolves, rejects, and missing creds", async () => {
    verifyMock.mockResolvedValueOnce(true);
    expect(
      await emailProviderService.testConnection(
        cfg({ provider: "ses", sesAccessKeyId: "a", sesSecretAccessKey: "b" })
      )
    ).toEqual({ success: true });

    verifyMock.mockRejectedValueOnce(new Error("bad keys"));
    expect(
      await emailProviderService.testConnection(
        cfg({ provider: "ses", sesAccessKeyId: "a", sesSecretAccessKey: "b" })
      )
    ).toMatchObject({ success: false, error: "bad keys" });

    expect(await emailProviderService.testConnection(cfg({ provider: "ses" }))).toEqual({
      success: false,
      error: "AWS SES credentials not configured",
    });
  });
});
