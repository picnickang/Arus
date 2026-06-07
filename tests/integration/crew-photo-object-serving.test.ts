/**
 * Task #345 — regression pins for the crew-photo serving bug (Task #341).
 *
 * Two server-side causes that a UI smoke test would miss:
 *   (1) GET /objects/:objectPath(*) was missing `requireAuthentication`, so
 *       every image fetch returned 401 (or worse, served unauthenticated).
 *   (2) the legacy object-storage client init had a cold-start concurrency
 *       race (covered separately in object-storage-client-concurrency.test.ts).
 *
 * This file mounts the REAL `registerStorageConfigRoutes` together with the
 * REAL `requireAuthentication` + `requireOrgId` middleware, and asserts:
 *   - unauthenticated GET /objects/* → 401
 *   - authenticated same-org GET /objects/* → 200 with image bytes + the
 *     correct image content-type
 *   - authenticated cross-org GET /objects/* → 403
 *
 * Only the GCS-touching `../../server/objectStorage` module and the
 * db-backed `../../server/repositories` are mocked (importing the real
 * repositories pulls db-config and crashes under jest ESM — see
 * .agents/memory/integration-test-jest-esm-mocking.md). The auth + route
 * wiring under test is the real production code, so a future middleware
 * reorder or a dropped `requireAuthentication` fails this suite loudly.
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from "@jest/globals";
import type { Express } from "express";
import request from "supertest";

const ORG = "test-org-crew-photo";
const OTHER_ORG = "test-org-other";

// A minimal valid JPEG head (magic bytes) so the assertion checks real image
// bytes rather than an arbitrary string.
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

// --- repositories mock (consumed by the real requireAuthentication) ---------
const getAdminSessionByToken = jest.fn<(hash: string) => Promise<unknown>>();
const updateAdminSessionActivity = jest.fn<(id: string) => Promise<void>>(
  async () => {},
);
const getUser = jest.fn<(id: string) => Promise<unknown>>();

jest.unstable_mockModule("../../server/repositories", () => ({
  __esModule: true,
  dbSystemAdminStorage: {
    getAdminSessionByToken,
    updateAdminSessionActivity,
  },
  dbUserStorage: {
    getUser,
    getUserByEmail: jest.fn(async () => null),
    createUser: jest.fn(async () => null),
  },
}));

// --- objectStorage mock (no real GCS in tests) ------------------------------
const getObjectEntityFile = jest.fn<(path: string) => Promise<unknown>>();
const assertObjectOwnedByOrg =
  jest.fn<
    (file: unknown, callerOrgId: string) => {
      allowed: boolean;
      ownerOrgId: string | null;
      legacy: boolean;
    }
  >();

class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

class ObjectStorageService {
  getObjectEntityFile(path: string) {
    return getObjectEntityFile(path);
  }
  assertObjectOwnedByOrg(file: unknown, callerOrgId: string) {
    return assertObjectOwnedByOrg(file, callerOrgId);
  }
  // Mirrors the real signature; writes image bytes + content-type so the
  // happy-path test can assert on a real served image.
  downloadObject(
    _file: unknown,
    res: import("express").Response,
  ) {
    res.set({
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
    });
    res.status(200).end(JPEG_BYTES);
  }
}

jest.unstable_mockModule("../../server/objectStorage", () => ({
  __esModule: true,
  ObjectStorageService,
  ObjectNotFoundError,
}));

let app: Express;
let mountError: string | undefined;

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const OBJECT_PATH = `/objects/uploads/orgs/${ORG}/photo-123`;

beforeAll(async () => {
  // Ensure the dev-auth no-login bypass is OFF so the unauthenticated case is
  // really exercised (it only applies when NODE_ENV === "development").
  process.env["NODE_ENV"] = "test";
  delete process.env["DEV_AUTH_BYPASS"];

  const express = (await import("express")).default;
  app = express();
  app.use(express.json());

  try {
    const { registerStorageConfigRoutes } = await import(
      "../../server/domains/storage-config/routes"
    );
    registerStorageConfigRoutes(app, {});
  } catch (err) {
    mountError = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  }
});

beforeEach(() => {
  getAdminSessionByToken.mockReset();
  getUser.mockReset();
  getObjectEntityFile.mockReset();
  assertObjectOwnedByOrg.mockReset();
  updateAdminSessionActivity.mockClear();

  // Default happy-path stubs; individual tests override as needed.
  getObjectEntityFile.mockResolvedValue({ name: `uploads/orgs/${ORG}/photo-123` });
  assertObjectOwnedByOrg.mockReturnValue({
    allowed: true,
    ownerOrgId: ORG,
    legacy: false,
  });
});

/** Wire a Bearer token to a valid session for a user in `orgId`. */
function authAsOrg(orgId: string) {
  getAdminSessionByToken.mockResolvedValue({
    id: "session-1",
    userId: "user-1",
    expiresAt: FUTURE,
    adminEmail: "user@test.local",
  });
  getUser.mockResolvedValue({
    id: "user-1",
    email: "user@test.local",
    role: "deck_officer",
    isActive: true,
    orgId,
  });
}

describe("Task #345 — /objects/* crew-photo serving", () => {
  it("storage-config routes mounted successfully", () => {
    expect(mountError).toBeUndefined();
  });

  it("GET /objects/* returns 401 when unauthenticated", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app).get(OBJECT_PATH);
    expect(res.status).toBe(401);
    // requireAuthentication is the gate that must be present.
    expect(res.body?.code).toBe("MISSING_AUTH_HEADER");
    expect(getObjectEntityFile).not.toHaveBeenCalled();
  });

  it("GET /objects/* returns 401 for a malformed authorization header", async () => {
    if (mountError) {throw new Error(mountError);}
    const res = await request(app)
      .get(OBJECT_PATH)
      .set("Authorization", "Token abc");
    expect(res.status).toBe(401);
    expect(res.body?.code).toBe("INVALID_AUTH_FORMAT");
  });

  it("GET /objects/* returns 200 with image bytes for an authenticated same-org request", async () => {
    if (mountError) {throw new Error(mountError);}
    authAsOrg(ORG);

    const res = await request(app)
      .get(OBJECT_PATH)
      .set("Authorization", "Bearer valid-token")
      .buffer(true)
      .parse((response, cb) => {
        const chunks: Buffer[] = [];
        response.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
        response.on("end", () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/jpeg");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).equals(JPEG_BYTES)).toBe(true);
    expect(getObjectEntityFile).toHaveBeenCalled();
  });

  it("GET /objects/* returns 403 for an authenticated cross-org request", async () => {
    if (mountError) {throw new Error(mountError);}
    authAsOrg(ORG);
    // The object belongs to a different org.
    assertObjectOwnedByOrg.mockReturnValue({
      allowed: false,
      ownerOrgId: OTHER_ORG,
      legacy: false,
    });

    const res = await request(app)
      .get(OBJECT_PATH)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
    expect(res.body?.code).toBe("OBJECT_CROSS_ORG_FORBIDDEN");
  });

  it("GET /objects/* returns 404 when the object does not exist", async () => {
    if (mountError) {throw new Error(mountError);}
    authAsOrg(ORG);
    getObjectEntityFile.mockRejectedValue(new ObjectNotFoundError());

    const res = await request(app)
      .get(OBJECT_PATH)
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(404);
  });
});
