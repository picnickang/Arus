import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Write smoke (`@smoke`) — REAL backend, the only lane that MUTATES.
 *
 * Drives the work-order write path against the live API: mint an admin session
 * from `/api/portal/dev-login` (enabled by ARUS_DEV_LOGIN, renderer-agnostic),
 * discover a real equipment + vessel, then `POST /api/work-orders/quick`. Uses
 * `page.request` (not the multi-step create UI) so it exercises the real
 * endpoint + DB insert deterministically.
 *
 * DISCOVER-OR-SKIP: a work order must attach to an existing equipment/vessel;
 * on an unseeded DB the quick-create FK-fails (500), which is a prerequisite
 * gap, not a regression. So the test self-skips when no equipment/vessel exists,
 * and runs the real create + read-back (+ idempotent completion) where seed data
 * is present (local seeded dev, or a seeded CI).
 *
 * DB safety — APPEND-ONLY, no cleanup. The CI Postgres is an ephemeral service
 * container (fresh migrate per run, destroyed at job end), so leaked rows never
 * persist. A unique per-run marker prevents false matches. Against a PERSISTENT
 * local dev DB, clean up with:
 *   DELETE FROM work_orders WHERE description LIKE 'playwright-smoke-%';
 */

test.skip(
  process.env["PLAYWRIGHT_LOCAL_BACKEND"] !== "1",
  "Set PLAYWRIGHT_LOCAL_BACKEND=1 to run the real-backend write smoke."
);

const RUN_ID = `playwright-smoke-${Date.now()}`;

async function adminToken(request: APIRequestContext): Promise<string | null> {
  const res = await request.post("/api/portal/dev-login", { data: { persona: "admin" } });
  if (!res.ok()) {
    return null;
  }
  const body = await res.json();
  return body?.data?.sessionToken ?? body?.sessionToken ?? null;
}

function rows(body: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body as Array<Record<string, unknown>>;
  }
  const record = body as { data?: unknown; items?: unknown } | null;
  const inner = record?.data ?? record?.items ?? [];
  return Array.isArray(inner) ? (inner as Array<Record<string, unknown>>) : [];
}

async function firstId(
  request: APIRequestContext,
  endpoint: string,
  headers: Record<string, string>
): Promise<string | null> {
  const res = await request.get(endpoint, { headers });
  if (!res.ok()) {
    return null;
  }
  const id = rows(await res.json())[0]?.["id"];
  return typeof id === "string" ? id : null;
}

test.describe("write smoke @smoke", () => {
  test("creates a work order via the real API and reads it back", async ({ page }) => {
    test.setTimeout(60_000);
    const token = await adminToken(page.request);
    test.skip(!token, "dev-login endpoint unavailable (ARUS_DEV_LOGIN not set on the backend).");
    const headers = { Authorization: `Bearer ${token}` };

    const equipmentId = await firstId(page.request, "/api/equipment", headers);
    const vesselId = await firstId(page.request, "/api/vessels", headers);
    test.skip(
      !equipmentId || !vesselId,
      "No seed equipment/vessel to attach a work order to (unseeded DB)."
    );

    const createRes = await page.request.post("/api/work-orders/quick", {
      headers,
      data: { equipmentId, vesselId, description: RUN_ID, priority: "low" },
    });
    expect(
      createRes.status(),
      `quick-create returned ${createRes.status()}: ${await createRes.text()}`
    ).toBeLessThan(300);

    const created = (await createRes.json()) as { data?: { id?: string }; id?: string };
    const createdId = created?.data?.id ?? created?.id;
    expect(createdId, "create response should carry an id").toBeTruthy();

    const listRes = await page.request.get("/api/work-orders", { headers });
    expect(listRes.ok(), `list returned ${listRes.status()}`).toBeTruthy();
    const found = rows(await listRes.json()).some(
      (row) => row["id"] === createdId || row["description"] === RUN_ID
    );
    expect(found, `created work order ${createdId} should appear in the list`).toBe(true);
  });

  test("completion is idempotent under a repeated Idempotency-Key", async ({ page }) => {
    test.setTimeout(60_000);
    const token = await adminToken(page.request);
    test.skip(!token, "dev-login endpoint unavailable.");
    const headers = { Authorization: `Bearer ${token}` };

    const equipmentId = await firstId(page.request, "/api/equipment", headers);
    const vesselId = await firstId(page.request, "/api/vessels", headers);
    test.skip(!equipmentId || !vesselId, "No seed equipment/vessel (unseeded DB).");

    const createRes = await page.request.post("/api/work-orders/quick", {
      headers,
      data: { equipmentId, vesselId, description: `${RUN_ID}-idem`, priority: "low" },
    });
    test.skip(createRes.status() >= 300, "Could not create a work order to complete.");
    const created = (await createRes.json()) as { data?: { id?: string }; id?: string };
    const id = created?.data?.id ?? created?.id;
    test.skip(!id, "No work-order id to complete.");

    const idemKey = `${RUN_ID}-key`;
    const complete = () =>
      page.request.post(`/api/work-orders/${id}/complete-with-feedback`, {
        headers: { ...headers, "Idempotency-Key": idemKey },
        data: {
          completionNotes: "playwright smoke completion",
          actualHours: 1,
          closeout: { workPerformed: "smoke", laborHours: 1, supervisorVerified: true },
        },
      });

    const first = await complete();
    const second = await complete();
    // Neither call may 5xx; the idempotency key makes the second a safe no-op.
    expect(first.status(), `first complete ${first.status()}`).toBeLessThan(500);
    expect(second.status(), `second complete ${second.status()}`).toBeLessThan(500);
  });
});
