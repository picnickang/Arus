/**
 * LR-3.5 / AUD-1 (Task #208) — compliance findings soft-archive
 *
 * Sibling unit test `tests/unit/lr35-aud-cluster-task208.test.ts`
 * covers AUD-2 (audit-hash version dispatch + orgId binding).
 *
 * Exercises the API end-to-end: POST a finding, DELETE it, and
 * assert (a) GET list excludes it by default; (b) GET list with
 * `includeArchived=true` surfaces it; (c) the underlying row is
 * still present with `status='archived'`, `archived_at` set, and
 * `archived_by` recorded.
 */
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";

const TEST_ORG = "lr35-aud-task208-org";
const TEST_USER_ID = "tester-user-id";

describe("LR-3.5 / AUD-1 (Task #208) — compliance findings soft-archive", () => {
  let app: Express;

  beforeAll(async () => {
    const { createTestApp } = await import("../../server/app.js");
    app = await createTestApp();
  }, 60000);

  afterAll(async () => {
    // Best-effort cleanup via raw SQL — the test org is unique, so
    // we can hard-delete the fixture rows.
    try {
      const { db } = await import("../../server/db-config.js");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM compliance_findings WHERE org_id = ${TEST_ORG}`);
    } catch {
      // ignore — fixture cleanup is best-effort
    }
  });

  it("DELETE soft-archives a finding: row persists archived, default list hides it, includeArchived=true reveals it", async () => {
    // 1. Create a finding via the API.
    const create = await request(app)
      .post("/api/compliance/findings")
      .set("x-org-id", TEST_ORG)
      .set("x-user-id", TEST_USER_ID)
      .send({
        sourceType: "lr35_test",
        ruleCode: "AUD-1",
        ruleName: "soft-archive",
        category: "test",
        severity: "warning",
        message: "fixture",
        status: "open",
      });
    expect([200, 201]).toContain(create.status);
    const id: string | undefined = create.body?.id;
    expect(id).toBeTruthy();

    // 2. Sanity: it appears in the default list.
    const listBefore = await request(app)
      .get("/api/compliance/findings")
      .set("x-org-id", TEST_ORG)
      .expect(200);
    expect(
      (listBefore.body as Array<{ id: string }>).some((r) => r.id === id),
    ).toBe(true);

    // 3. DELETE it — must soft-archive, not hard-delete.
    const del = await request(app)
      .delete(`/api/compliance/findings/${id}`)
      .set("x-org-id", TEST_ORG)
      .set("x-user-id", TEST_USER_ID);
    expect([200, 204]).toContain(del.status);

    // 4. Default list MUST exclude it.
    const listAfter = await request(app)
      .get("/api/compliance/findings")
      .set("x-org-id", TEST_ORG)
      .expect(200);
    expect(
      (listAfter.body as Array<{ id: string }>).some((r) => r.id === id),
    ).toBe(false);

    // 5. includeArchived=true MUST reveal it, and the archived
    //    columns must be populated.
    const listIncluded = await request(app)
      .get("/api/compliance/findings?includeArchived=true")
      .set("x-org-id", TEST_ORG)
      .expect(200);
    const archived = (listIncluded.body as Array<{
      id: string;
      status: string;
      archived_at?: string | null;
      archivedAt?: string | null;
      archived_by?: string | null;
      archivedBy?: string | null;
    }>).find((r) => r.id === id);
    expect(archived).toBeDefined();
    expect(archived!.status).toBe("archived");
    const archivedAt = archived!.archived_at ?? archived!.archivedAt ?? null;
    const archivedBy = archived!.archived_by ?? archived!.archivedBy ?? null;
    expect(archivedAt).not.toBeNull();
    expect(archivedBy).toBe(TEST_USER_ID);

    // 6. By-id read mirrors the same default-exclude / opt-in
    //    semantics.
    const byIdDefault = await request(app)
      .get(`/api/compliance/findings/${id}`)
      .set("x-org-id", TEST_ORG);
    expect(byIdDefault.status).toBe(404);

    const byIdIncluded = await request(app)
      .get(`/api/compliance/findings/${id}?includeArchived=true`)
      .set("x-org-id", TEST_ORG)
      .expect(200);
    expect((byIdIncluded.body as { id: string }).id).toBe(id);
  });
});
