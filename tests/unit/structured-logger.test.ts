/**
 * Structured Logger — Unit Tests
 *
 * Covers correlation-ID enrichment behavior:
 *   - Outside a request context: no correlation fields are added.
 *   - Inside a request context: correlationId is added (and tagged in the prefix).
 *   - orgId/userId/requestId surface when they differ from correlationId.
 *   - try/catch isolation: logger never throws if context lookup fails.
 *
 * Note on testability:
 *   The structured logger reads the active request context via an injectable
 *   `correlationProvider` (default: `getRequestContext` from
 *   `server/utils/correlation-context`). Tests swap the provider directly so
 *   they don't depend on AsyncLocalStorage propagation across module
 *   boundaries (which is unreliable under Jest+SWC ESM).
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { createLogger, type CorrelationProvider } from "../../server/lib/structured-logger";

type ConsoleCall = {
  fn: "log" | "warn" | "error";
  args: unknown[];
};

let captured: ConsoleCall[];
let originalLog: typeof console.log;
let originalWarn: typeof console.warn;
let originalError: typeof console.error;
let originalLogLevel: string | undefined;

beforeEach(() => {
  captured = [];
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;
  originalLogLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = "debug";
  console.log = (...args: unknown[]) => {
    captured.push({ fn: "log", args });
  };
  console.warn = (...args: unknown[]) => {
    captured.push({ fn: "warn", args });
  };
  console.error = (...args: unknown[]) => {
    captured.push({ fn: "error", args });
  };
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

const provider = (
  ctx: ReturnType<CorrelationProvider> | undefined
): CorrelationProvider => () => ctx;

describe("structured-logger correlation enrichment", () => {
  it("emits no correlation fields when provider returns undefined (boot/scheduler scenario)", () => {
    const logger = createLogger("BootTest", provider(undefined));
    logger.info("startup complete");

    expect(captured).toHaveLength(1);
    const [call] = captured;
    expect(call.fn).toBe("log");
    expect(call.args).toHaveLength(1);
    const message = call.args[0] as string;
    expect(message).toContain("[BootTest]");
    expect(message).toContain("startup complete");
    expect(message).not.toMatch(/\[BootTest\] \[[0-9a-f]{8}\]/);
  });

  it("attaches correlationId from active request context", () => {
    const logger = createLogger(
      "RequestTest",
      provider({
        correlationId: "11111111-2222-3333-4444-555555555555",
        requestId: "11111111-2222-3333-4444-555555555555",
      })
    );
    logger.info("handled request");

    expect(captured).toHaveLength(1);
    const [call] = captured;
    expect(call.args).toHaveLength(2);
    const [message, meta] = call.args as [string, Record<string, unknown>];
    expect(message).toContain("[RequestTest] [11111111]");
    expect(meta).toMatchObject({
      correlationId: "11111111-2222-3333-4444-555555555555",
    });
    // requestId equals correlationId, so it should NOT be duplicated
    expect(meta.requestId).toBeUndefined();
  });

  it("surfaces orgId and userId when present in context", () => {
    const logger = createLogger(
      "AuthTest",
      provider({
        correlationId: "aaaa1111-2222-3333-4444-555555555555",
        orgId: "org-test",
        userId: "user-test",
      })
    );
    logger.warn("permission denied", { resource: "wo:42" });

    expect(captured).toHaveLength(1);
    const [call] = captured;
    expect(call.fn).toBe("warn");
    const [, meta] = call.args as [string, Record<string, unknown>];
    expect(meta).toMatchObject({
      correlationId: "aaaa1111-2222-3333-4444-555555555555",
      orgId: "org-test",
      userId: "user-test",
      resource: "wo:42",
    });
  });

  it("surfaces a distinct requestId alongside correlationId", () => {
    const logger = createLogger(
      "Distinct",
      provider({
        correlationId: "corr-aaaa-1111",
        requestId: "req-bbbb-2222",
      })
    );
    logger.info("sync chunk");

    const [, meta] = captured[0].args as [string, Record<string, unknown>];
    expect(meta.correlationId).toBe("corr-aaaa-1111");
    expect(meta.requestId).toBe("req-bbbb-2222");
  });

  it("includes error object when provided to error()", () => {
    const logger = createLogger(
      "ErrPath",
      provider({ correlationId: "cccc1111-2222-3333-4444-555555555555" })
    );
    logger.error("boom", { stage: "commit" }, new Error("kaboom"));

    const [call] = captured;
    expect(call.fn).toBe("error");
    const [, meta] = call.args as [string, Record<string, unknown>];
    expect(meta).toMatchObject({
      correlationId: "cccc1111-2222-3333-4444-555555555555",
      stage: "commit",
    });
    expect(meta.error).toMatchObject({
      name: "Error",
      message: "kaboom",
    });
  });

  it("never throws if the correlation provider blows up", () => {
    const logger = createLogger("Resilient", () => {
      throw new Error("storage corrupt");
    });
    expect(() => logger.info("still works")).not.toThrow();
    expect(captured).toHaveLength(1);
    // No correlation fields, but the message itself was emitted
    const message = captured[0].args[0] as string;
    expect(message).toContain("still works");
  });

  it("authoritative correlation fields cannot be spoofed by user-provided context", () => {
    // A caller passes correlationId in context (accidentally or otherwise).
    // The real correlation fields from the provider must win — otherwise
    // an attacker (or a buggy refactor) could forge log lineage.
    const logger = createLogger(
      "AntiSpoof",
      provider({
        correlationId: "real-corr-id-aaaa",
        orgId: "real-org",
        userId: "real-user",
      })
    );
    logger.info("event", {
      correlationId: "spoofed-id-bbbb",
      orgId: "spoofed-org",
      userId: "spoofed-user",
      extraField: "preserved",
    });

    const [, meta] = captured[0].args as [string, Record<string, unknown>];
    expect(meta.correlationId).toBe("real-corr-id-aaaa");
    expect(meta.orgId).toBe("real-org");
    expect(meta.userId).toBe("real-user");
    // Non-conflicting context still flows through
    expect(meta.extraField).toBe("preserved");
  });

  it("child logger inherits correlation fields and merges its own context", () => {
    const parent = createLogger("Parent", provider({ correlationId: "child-1234-abcd" }));
    const child = parent.child({ jobId: "j-99" });
    child.info("processed", { batch: 7 });

    expect(captured).toHaveLength(1);
    const [, meta] = captured[0].args as [string, Record<string, unknown>];
    expect(meta).toMatchObject({
      correlationId: "child-1234-abcd",
      jobId: "j-99",
      batch: 7,
    });
  });
});
