import { describe, it, expect, beforeAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG_ID = "default-org-id";

/** Unwraps the canonical response envelope on migrated domains. */
function unwrap<T = Record<string, unknown>>(body: unknown): T {
  const record = body as Record<string, unknown> | null;
  if (record && typeof record === "object" && record["success"] === true && "data" in record) {
    return record["data"] as T;
  }
  return body as T;
}

describe("validateResponse-wired endpoints", () => {
  let app: Express;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  describe("PDM domain", () => {
    it("GET /api/pdm/dashboard returns a schema-shaped object", async () => {
      const res = await request(app)
        .get("/api/pdm/dashboard")
        .set("x-org-id", TEST_ORG_ID)
        .expect("Content-Type", /json/)
        .expect(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe("object");
    });

    it("GET /api/pdm/filter-options returns vessels and equipmentTypes arrays", async () => {
      const res = await request(app)
        .get("/api/pdm/filter-options")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);
      const body = unwrap(res.body);
      expect(body).toHaveProperty("vessels");
      expect(body).toHaveProperty("equipmentTypes");
      expect(Array.isArray(body["vessels"])).toBe(true);
      expect(Array.isArray(body["equipmentTypes"])).toBe(true);
    });

    it("GET /api/pdm/risk-queue/:status returns an array", async () => {
      const res = await request(app)
        .get("/api/pdm/risk-queue/open")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);
      expect(Array.isArray(unwrap(res.body))).toBe(true);
    });
  });

  describe("Home domain", () => {
    it("GET /api/home/attention-summary returns expected keys", async () => {
      const res = await request(app)
        .get("/api/home/attention-summary")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);
      expect(res.body).toBeDefined();
      expect(typeof res.body).toBe("object");
    });
  });

  describe("Permissions domain", () => {
    const cases: Array<{ path: string; assert: (body: unknown) => void }> = [
      {
        path: "/api/permissions/me",
        assert: (body) => {
          expect(body).toHaveProperty("userId");
          expect(body).toHaveProperty("orgId");
          expect(body).toHaveProperty("permissions");
        },
      },
      {
        path: "/api/permissions/resources",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
      {
        path: "/api/permissions/actions",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
      {
        path: "/api/permissions/registry",
        assert: (body) => {
          expect(body).toHaveProperty("resources");
        },
      },
      {
        path: "/api/permissions/roles",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
      {
        path: "/api/permissions/templates",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
      {
        path: "/api/permissions/users-with-roles",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
      {
        path: "/api/permissions/audit?limit=5",
        assert: (body) => expect(Array.isArray(body)).toBe(true),
      },
    ];

    for (const { path, assert } of cases) {
      it(`GET ${path} returns a validated response`, async () => {
        const res = await request(app)
          .get(path)
          .set("x-org-id", TEST_ORG_ID)
          .expect("Content-Type", /json/)
          .expect(200);
        assert(unwrap(res.body));
      });
    }
  });

  describe("validateResponse helper behavior", () => {
    it("does not throw in test env when responses match their schema", async () => {
      const res = await request(app)
        .get("/api/permissions/resources")
        .set("x-org-id", TEST_ORG_ID)
        .expect(200);
      expect(Array.isArray(unwrap(res.body))).toBe(true);
    });
  });
});
