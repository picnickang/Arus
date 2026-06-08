/**
 * LR-2 — Knowledge Base upload reliability suite.
 *
 * Pins four boundary contracts on the KB upload endpoints:
 *
 *   1. **MIME allowlist** — anything outside {pdf, png, jpeg} is
 *      rejected by multer's `fileFilter` BEFORE the handler runs.
 *   2. **Size cap** — files larger than 10 MB are rejected by multer's
 *      `limits.fileSize` BEFORE the handler runs.
 *   3. **Magic-byte verification** — a PDF-suffixed payload whose
 *      bytes are NOT a PDF is rejected with HTTP 415 by the handler's
 *      `validateMagicBytesFromBuffer` check. This is the second line
 *      of defence: even if a client lies about Content-Type, we
 *      refuse to ingest the file.
 *   4. **Malware scanner is wired as a stub by default** — the
 *      security config exposes `enableMalwareScan: false` out of the
 *      box, with the toggle reachable via the admin route. We assert
 *      the default so a future "enabled by accident in prod" PR has
 *      to update this test and earn a review.
 *
 * Tests skip themselves with a clear log line if `createTestApp`
 * cannot construct the app (e.g. no DB in the test env) — they are NOT
 * silent green; jest surfaces the skip in the report.
 */

import { describe, it, expect, beforeAll, jest } from "@jest/globals";
import request from "supertest";
import type { Express, NextFunction, Request, Response } from "express";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_A_PDF = Buffer.from("This is plain text, not a PDF document.\n");

jest.unstable_mockModule("../../server/job-queue-service", () => ({
  __esModule: true,
  jobQueueService: {
    enqueueDocumentIngestion: async () => "kb-upload-test-job",
    getJobStatus: async () => null,
  },
}));

jest.unstable_mockModule("../../server/vite", () => ({
  __esModule: true,
  log: () => {},
  setupVite: async () => {},
  serveStatic: () => {},
}));

describe("KB upload reliability", () => {
  let app: Express | null = null;
  let bootError: unknown = null;

  beforeAll(async () => {
    try {
      const express = (await import("express")).default;
      const { registerKnowledgeBaseRoutes } = await import("../../server/routes/kb-routes.js");
      const passThrough = (_req: Request, _res: Response, next: NextFunction) => next();
      app = express();
      app.use(express.json());
      app.use((req: Request, _res: Response, next: NextFunction) => {
        const headerOrgId = Array.isArray(req.headers["x-org-id"])
          ? req.headers["x-org-id"][0]
          : req.headers["x-org-id"];
        req.user = {
          id: "kb-upload-test-user",
          email: "kb-upload-test-user@integration.test",
          role: "admin",
          isActive: true,
          orgId: headerOrgId ?? "kb-test-org",
        };
        next();
      });
      await registerKnowledgeBaseRoutes(app, {
        generalApiRateLimit: passThrough,
        writeOperationRateLimit: passThrough,
      });
    } catch (err) {
      bootError = err;
    }
  }, 60_000);

  function requireApp(): Express {
    if (!app) {
      throw new Error(
        `Test app unavailable (cannot exercise HTTP boundary): ${
          bootError instanceof Error ? bootError.message : String(bootError)
        }`
      );
    }
    return app;
  }

  it("rejects a disallowed MIME type (text/plain) at the multer filter", async () => {
    const a = requireApp();
    const response = await request(a)
      .post("/api/kb/upload")
      .set("x-org-id", "kb-test-org")
      .attach("file", Buffer.from("hello"), {
        filename: "not-allowed.txt",
        contentType: "text/plain",
      });

    // Multer's fileFilter rejects with HTTP 400/415; either is a valid
    // "we refused to accept this" signal. The important contract is
    // "NOT 2xx".
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("rejects a file larger than the 10MB cap", async () => {
    const a = requireApp();
    // 11MB of zeros prefixed with the PNG magic so it would otherwise
    // pass the magic-byte check — proving the size cap fires FIRST.
    const oversize = Buffer.concat([PNG_MAGIC, Buffer.alloc(11 * 1024 * 1024)]);
    const response = await request(a)
      .post("/api/kb/upload")
      .set("x-org-id", "kb-test-org")
      .attach("file", oversize, {
        filename: "oversize.png",
        contentType: "image/png",
      });

    // Multer's LIMIT_FILE_SIZE surfaces as 413 in most setups; some
    // express error-handlers normalize to 400. Accept both.
    expect([400, 413]).toContain(response.status);
  });

  it("rejects a PDF Content-Type whose bytes are not a PDF (magic-byte check)", async () => {
    const a = requireApp();
    const response = await request(a)
      .post("/api/kb/upload")
      .set("x-org-id", "kb-test-org")
      .attach("file", NOT_A_PDF, {
        filename: "fake.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(415);
    expect(response.body?.error).toMatch(/content does not match/i);
  });

  it("ships with the malware scanner stubbed (enableMalwareScan=false default)", async () => {
    // No HTTP call here — we want to pin the default in source. If a
    // future change flips the default to `true` without wiring a real
    // scanner, this test fails and the reviewer has to make a
    // conscious decision.
    const { DEFAULT_RAG_SECURITY_CONFIG } = await import(
      "../../server/services/rag/security/types.js"
    );
    expect(DEFAULT_RAG_SECURITY_CONFIG.ingestion.enableMalwareScan).toBe(false);
  });
});
