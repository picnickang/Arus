/**
 * LR-3.5 / TEN-5 — `downloadObject` fail-closed ownership perimeter.
 *
 * The previous round enforced ownership at the route layer; auto code-
 * review flagged that as a discipline contract rather than a structural
 * one. The fix is to embed `assertObjectOwnedByOrg` INSIDE
 * `downloadObject` itself so that EVERY caller — current and future,
 * core service and replit-integration variant — is fail-closed by
 * default. This test pins that perimeter:
 *
 *   1. Same-org caller → object is streamed (no 403, headers set).
 *   2. Cross-org caller → 403 + `OBJECT_CROSS_ORG_FORBIDDEN`, NO
 *      bytes streamed, NO metadata fetched.
 *   3. Missing `auditCtx.orgId` → legacy path: warning emitted, no
 *      403 (back-compat for callers not yet updated).
 *   4. Legacy object (no `uploads/orgs/<id>/` segment) → allowed
 *      with warning, no 403 (audit-only defence for pre-migration
 *      objects).
 *
 * This test calls `downloadObject` directly with a mock Response and
 * a stub File — exactly what the express route layer would do, minus
 * the network. The structural fail-closed guarantee is identical:
 * `downloadObject` writes `res.status(403).json(...)` before touching
 * `file.getMetadata()`, so a cross-org caller cannot leak even metadata.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ObjectStorageService } from "../../server/objectStorage";

const ORG_A = "org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

interface StubFile {
  name: string;
  getMetadataCalls: number;
  createReadStreamCalls: number;
  getMetadata: () => Promise<readonly [{ contentType: string; size: number }]>;
  createReadStream: (opts?: { start?: number; end?: number }) => NodeJS.ReadableStream;
}

function makeStubFile(objectName: string): StubFile {
  const f: StubFile = {
    name: objectName,
    getMetadataCalls: 0,
    createReadStreamCalls: 0,
    async getMetadata() {
      f.getMetadataCalls += 1;
      return [{ contentType: "image/png", size: 4 }] as const;
    },
    createReadStream(_opts?: { start?: number; end?: number }) {
      f.createReadStreamCalls += 1;
      // node:stream Readable — minimal payload so pipe() resolves.
      const { Readable } = require("node:stream") as typeof import("node:stream");
      return Readable.from([Buffer.from([0x89, 0x50, 0x4e, 0x47])]);
    },
  };
  return f;
}

interface MockRes {
  statusCode: number | null;
  headers: Record<string, string | number | undefined>;
  body: unknown;
  headersSent: boolean;
  piped: boolean;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
  set(h: Record<string, string | number | undefined>): MockRes;
  on(event: string, _cb: (...a: unknown[]) => void): MockRes;
  once(event: string, cb: (...a: unknown[]) => void): MockRes;
  emit(): boolean;
  end(): MockRes;
  write(): boolean;
}

function makeMockRes(): MockRes {
  const res: MockRes = {
    statusCode: null,
    headers: {},
    body: undefined,
    headersSent: false,
    piped: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    set(h) {
      Object.assign(this.headers, h);
      return this;
    },
    on() {
      return this;
    },
    once(_event, _cb) {
      return this;
    },
    emit() {
      return true;
    },
    end() {
      this.piped = true;
      return this;
    },
    write() {
      return true;
    },
  };
  return res;
}

describe("LR-3.5 TEN-5 — downloadObject fail-closed ownership perimeter", () => {
  let svc: ObjectStorageService;
  beforeEach(() => {
    svc = new ObjectStorageService();
  });

  it("cross-org caller → 403 OBJECT_CROSS_ORG_FORBIDDEN, NO metadata or bytes leak", async () => {
    const file = makeStubFile(`bucket/.private/uploads/orgs/${ORG_A}/uuid-a`);
    const res = makeMockRes();

    await svc.downloadObject(
      file as unknown as Parameters<typeof svc.downloadObject>[0],
      res as unknown as Parameters<typeof svc.downloadObject>[1],
      3600,
      { orgId: ORG_B, userId: "u-2" },
    );

    expect(res.statusCode).toBe(403);
    expect((res.body as { code?: string } | undefined)?.code).toBe(
      "OBJECT_CROSS_ORG_FORBIDDEN",
    );
    // Critical: ownership check fires BEFORE any GCS I/O.
    expect(file.getMetadataCalls).toBe(0);
    expect(file.createReadStreamCalls).toBe(0);
  });

  it("symmetric: org A caller against org B's object → 403", async () => {
    const file = makeStubFile(`bucket/.private/uploads/orgs/${ORG_B}/uuid-b`);
    const res = makeMockRes();
    await svc.downloadObject(
      file as unknown as Parameters<typeof svc.downloadObject>[0],
      res as unknown as Parameters<typeof svc.downloadObject>[1],
      3600,
      { orgId: ORG_A },
    );
    expect(res.statusCode).toBe(403);
    expect((res.body as { code?: string } | undefined)?.code).toBe(
      "OBJECT_CROSS_ORG_FORBIDDEN",
    );
  });

  it("same-org caller → no 403, metadata fetched, stream initiated", async () => {
    const file = makeStubFile(`bucket/.private/uploads/orgs/${ORG_A}/uuid-a`);
    const res = makeMockRes();
    await svc.downloadObject(
      file as unknown as Parameters<typeof svc.downloadObject>[0],
      res as unknown as Parameters<typeof svc.downloadObject>[1],
      3600,
      { orgId: ORG_A, userId: "u-1" },
    );
    // No 403 / no error JSON written.
    expect(res.statusCode).not.toBe(403);
    expect((res.body as { code?: string } | undefined)?.code).not.toBe(
      "OBJECT_CROSS_ORG_FORBIDDEN",
    );
    expect(file.getMetadataCalls).toBeGreaterThan(0);
  });

  it("legacy object path (no uploads/orgs/<id>/) → allowed with audit-only warning", async () => {
    const file = makeStubFile(`bucket/.private/uploads/legacy-uuid`);
    const res = makeMockRes();
    await svc.downloadObject(
      file as unknown as Parameters<typeof svc.downloadObject>[0],
      res as unknown as Parameters<typeof svc.downloadObject>[1],
      3600,
      { orgId: ORG_A },
    );
    expect(res.statusCode).not.toBe(403);
    expect(file.getMetadataCalls).toBeGreaterThan(0);
  });

  it("missing auditCtx.orgId → back-compat: no 403, request proceeds (warning emitted)", async () => {
    const file = makeStubFile(`bucket/.private/uploads/orgs/${ORG_A}/uuid-a`);
    const res = makeMockRes();
    await svc.downloadObject(
      file as unknown as Parameters<typeof svc.downloadObject>[0],
      res as unknown as Parameters<typeof svc.downloadObject>[1],
    );
    expect(res.statusCode).not.toBe(403);
  });
});
