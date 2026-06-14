/**
 * Unit tests for the SendGrid EmailSender (Stack B transport).
 *
 * The sender reads SENDGRID_API_KEY / EMAIL_FROM once in its constructor, so
 * every test sets env first and constructs a FRESH `new EmailSender()` rather
 * than relying on the module-level singleton. No network: `global.fetch` is
 * mocked. No real key is ever set, except the synthetic ones below.
 */
import { jest } from "@jest/globals";

const { EmailSender } = await import("../../server/services/email-notification/email-sender.js");

type FetchResponse = {
  ok: boolean;
  status: number;
  headers: { get: (k: string) => string | null };
  text: () => Promise<string>;
};

const ORIGINAL_SENDGRID = process.env["SENDGRID_API_KEY"];
const ORIGINAL_FROM = process.env["EMAIL_FROM"];

let fetchMock: jest.Mock<(...args: unknown[]) => Promise<FetchResponse>>;

function okResponse(messageId: string | null = "msg-1"): FetchResponse {
  return { ok: true, status: 200, headers: { get: () => messageId }, text: async () => "" };
}
function errResponse(status: number): FetchResponse {
  return { ok: false, status, headers: { get: () => null }, text: async () => "boom" };
}

beforeEach(() => {
  fetchMock = jest.fn<(...args: unknown[]) => Promise<FetchResponse>>();
  global.fetch = fetchMock as unknown as typeof fetch;
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

describe("EmailSender (dev mode)", () => {
  it("does not call fetch and returns a dev messageId when no API key is set", async () => {
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sender.isEnabled()).toBe(false);
    expect(sender.getStatus()).toEqual({ enabled: false, provider: "development" });
  });

  it("logs (no fetch) for attachment sends in dev mode", async () => {
    const sender = new EmailSender();

    const result = await sender.sendWithAttachment("a@x.test", "S", "T", "<p>T</p>", {
      filename: "f.pdf",
      content: Buffer.from("hello"),
      contentType: "application/pdf",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("EmailSender (enabled)", () => {
  beforeEach(() => {
    process.env["SENDGRID_API_KEY"] = "sg-key-123";
  });

  it("POSTs to SendGrid with bearer auth and the configured from address", async () => {
    fetchMock.mockResolvedValue(okResponse("sg-message"));
    const sender = new EmailSender();
    expect(sender.isEnabled()).toBe(true);
    expect(sender.getStatus().provider).toBe("sendgrid");

    const result = await sender.sendEmail({
      to: ["a@x.test", "b@y.test"],
      subject: "Hello",
      text: "Body",
      html: "<p>Body</p>",
    });

    expect(result).toEqual({ success: true, messageId: "sg-message" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer sg-key-123");
    const body = JSON.parse(init.body as string);
    expect(body.from.email).toBe("from@arus.test");
    expect(body.personalizations[0].to).toEqual([{ email: "a@x.test" }, { email: "b@y.test" }]);
    expect(body.content).toHaveLength(2); // text + html
  });

  it("falls back to an sg- messageId when the response header is missing", async () => {
    fetchMock.mockResolvedValue(okResponse(null));
    const sender = new EmailSender();

    const result = await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^sg-/);
  });

  it("omits the html content block when no html is provided", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const sender = new EmailSender();

    await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.content).toHaveLength(1);
    expect(body.content[0].type).toBe("text/plain");
  });

  it("classifies retriable vs non-retriable failures", async () => {
    const sender = new EmailSender();

    fetchMock.mockResolvedValueOnce(errResponse(503));
    expect(await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" })).toMatchObject({
      success: false,
      retriable: true,
    });

    fetchMock.mockResolvedValueOnce(errResponse(400));
    expect(await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" })).toMatchObject({
      success: false,
      retriable: false,
    });

    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED 1.2.3.4"));
    expect(await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" })).toMatchObject({
      success: false,
      retriable: true,
    });

    fetchMock.mockRejectedValueOnce(new Error("totally unexpected"));
    expect(await sender.sendEmail({ to: ["a@x.test"], subject: "S", text: "T" })).toMatchObject({
      success: false,
      retriable: false,
    });
  });

  it("includes a base64 attachment and marks failures non-retriable", async () => {
    fetchMock.mockResolvedValueOnce(okResponse("att-1"));
    const sender = new EmailSender();

    const ok = await sender.sendWithAttachment("a@x.test", "S", "T", "<p>T</p>", {
      filename: "report.pdf",
      content: Buffer.from("PDFDATA"),
      contentType: "application/pdf",
    });
    expect(ok).toEqual({ success: true, messageId: "att-1" });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.attachments[0].filename).toBe("report.pdf");
    expect(body.attachments[0].content).toBe(Buffer.from("PDFDATA").toString("base64"));

    fetchMock.mockResolvedValueOnce(errResponse(503));
    const failed = await sender.sendWithAttachment("a@x.test", "S", "T", "<p>T</p>", {
      filename: "report.pdf",
      content: Buffer.from("x"),
      contentType: "application/pdf",
    });
    // sendWithAttachment hard-codes retriable:false even on a 503 (documents the
    // asymmetry vs sendEmail, which would treat 503 as retriable).
    expect(failed).toMatchObject({ success: false, retriable: false });
  });
});
