/**
 * Unit tests for the notification digest scheduler (Fix #2).
 *
 * Fake timers drive the interval; the email-notification-service shim is mocked
 * so no DB/network is touched. Note tests/setup.ts sets DISABLE_EMAIL_WORKER=true
 * globally, so the "enabled" case explicitly clears the kill-switches.
 */
import { jest } from "@jest/globals";

const processDigestMock = jest.fn(async () => 0);
const processPendingMock = jest.fn(async () => 0);
jest.unstable_mockModule("../../server/services/email-notification-service.js", () => ({
  emailNotificationService: {
    processDigestQueue: processDigestMock,
    processPendingNotifications: processPendingMock,
  },
}));

const { setupEmailDigestSchedule } = await import("../../server/bootstrap/schedulers");

const ORIGINAL = {
  worker: process.env["DISABLE_EMAIL_WORKER"],
  digest: process.env["DISABLE_EMAIL_DIGEST_SCHEDULER"],
  interval: process.env["EMAIL_DIGEST_INTERVAL_MS"],
};

function restoreEnv(): void {
  for (const [key, value] of [
    ["DISABLE_EMAIL_WORKER", ORIGINAL.worker],
    ["DISABLE_EMAIL_DIGEST_SCHEDULER", ORIGINAL.digest],
    ["EMAIL_DIGEST_INTERVAL_MS", ORIGINAL.interval],
  ] as const) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  processDigestMock.mockClear().mockResolvedValue(0);
  processPendingMock.mockClear().mockResolvedValue(0);
  process.env["EMAIL_DIGEST_INTERVAL_MS"] = "1000";
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  restoreEnv();
});

it("runs processDigestQueue on each interval when enabled", async () => {
  delete process.env["DISABLE_EMAIL_WORKER"];
  delete process.env["DISABLE_EMAIL_DIGEST_SCHEDULER"];

  setupEmailDigestSchedule();

  await jest.advanceTimersByTimeAsync(1000);
  expect(processPendingMock).toHaveBeenCalledTimes(1);
  expect(processDigestMock).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(1000);
  expect(processDigestMock).toHaveBeenCalledTimes(2);
});

it("does nothing when DISABLE_EMAIL_WORKER is set", async () => {
  process.env["DISABLE_EMAIL_WORKER"] = "true";
  delete process.env["DISABLE_EMAIL_DIGEST_SCHEDULER"];

  setupEmailDigestSchedule();

  await jest.advanceTimersByTimeAsync(5000);
  expect(processDigestMock).not.toHaveBeenCalled();
});

it("does nothing when DISABLE_EMAIL_DIGEST_SCHEDULER is set", async () => {
  delete process.env["DISABLE_EMAIL_WORKER"];
  process.env["DISABLE_EMAIL_DIGEST_SCHEDULER"] = "true";

  setupEmailDigestSchedule();

  await jest.advanceTimersByTimeAsync(5000);
  expect(processDigestMock).not.toHaveBeenCalled();
});
