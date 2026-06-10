/**
 * Task #299 Journey: Equipment Hub — Acknowledge + Assign actions.
 *
 * Frontend/e2e coverage for the two action-bar mutations on
 * `/equipment/:equipmentId` (the Equipment Hub page). Like
 * `offline-outbox.spec.ts`, this journey needs NO backend seed — every
 * API the page reads or writes is stubbed with `page.route`, so the
 * assertions are deterministic and CI-safe:
 *
 *   1. Acknowledge is DISABLED when the equipment has no active anomaly
 *      (and when the anomaly is already acknowledged), and ENABLED when
 *      an unacknowledged anomaly is present.
 *   2. Clicking Acknowledge fires the acknowledge POST and surfaces the
 *      success toast on settle; a failing POST surfaces the error toast.
 *   3. Assign lists the crew returned by `/api/crew`, and selecting a
 *      member PUTs `{ assignedCrewId, status: "in_progress" }` to the
 *      assignable work order (the persisted contract from
 *      `useEquipmentHub`).
 *
 * The admin portal login is used because `/equipment/:id` is registered
 * under the maintenance hub group and is hub-gated in `App.tsx`.
 */

import {
  test,
  expect,
  type Page,
  type Route,
  type Request as PlaywrightRequest,
} from "@playwright/test";

const EQUIP_ID = "EQUIP-T299";
const WORK_ORDER_ID = "WO-T299";
const CREW = [
  { id: "crew-1", name: "Ada Helm", rank: "Chief Engineer", vesselId: "V1" },
  { id: "crew-2", name: "Bo Mast", rank: "2nd Engineer", vesselId: "V1" },
];

type AnomalyState = "none" | "unacknowledged" | "acknowledged";

/** Minimal but schema-faithful EquipmentHubData for the page to render. */
function hubPayload(opts: { anomaly: AnomalyState; withWorkOrder: boolean }) {
  const activeAnomaly =
    opts.anomaly === "none"
      ? null
      : {
          id: 501,
          anomalyType: "bearing_temp",
          sensorType: "temperature",
          severity: "high",
          detectedAt: "2026-06-01T10:00:00.000Z",
          acknowledged: opts.anomaly === "acknowledged",
          acknowledgedBy: opts.anomaly === "acknowledged" ? "Prior User" : null,
          acknowledgedAt: opts.anomaly === "acknowledged" ? "2026-06-01T11:00:00.000Z" : null,
        };

  return {
    id: EQUIP_ID,
    name: "Main Engine #1",
    vessel: "MV Test",
    vesselId: "V1",
    type: "Diesel Engine",
    health: 62,
    rul: 45,
    risk: "warning",
    confidence: 80,
    prediction: "Bearing wear progressing",
    trend: "declining",
    signals: ["Vibration above baseline"],
    telemetry: [60, 61, 62, 61, 62],
    lastService: "2026-04-01",
    nextDue: "2026-07-01",
    dataAvailability: "ok",
    assessment: "Elevated bearing temperature trend.",
    recommendedAction: "Inspect bearing assembly.",
    operationalContext: {
      vesselStatus: "At sea",
      nextPort: "Rotterdam",
      nextPortEta: "2026-06-10",
      partsAvailability: "in_stock",
      maintenanceWindow: "2026-06-11",
    },
    needsAction: [],
    activeAnomaly,
    workOrders: opts.withWorkOrder
      ? [
          {
            id: WORK_ORDER_ID,
            title: "Bearing inspection",
            status: "open",
            createdAt: "2026-06-01",
            completedAt: null,
          },
        ]
      : [],
    serviceOrders: [],
    diagnosticRuns: [],
    activityTimeline: [],
  };
}

/**
 * Wire the page's read endpoints. `acknowledge`/`assign` writes are
 * registered per-test so each can assert its own captured request.
 */
async function stubReads(
  page: Page,
  opts: { anomaly: AnomalyState; withWorkOrder: boolean; crew?: typeof CREW }
) {
  await page.route("**/api/equipment-intelligence/hub/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(hubPayload(opts)),
    });
  });
  await page.route("**/api/crew", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(opts.crew ?? CREW),
    });
  });
}

async function loginAdmin(page: Page) {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.waitForLoadState("domcontentloaded");
}

async function openHub(page: Page) {
  await page.goto(`/equipment/${EQUIP_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("equipment-hub-page")).toBeVisible();
}

test.describe("Equipment Hub — Acknowledge + Assign", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* private mode — fine */
      }
    });
  });

  test("Acknowledge is disabled when there is no active anomaly", async ({ page }) => {
    await stubReads(page, { anomaly: "none", withWorkOrder: true });
    await loginAdmin(page);
    await openHub(page);

    await expect(page.getByTestId("button-acknowledge")).toBeDisabled();
  });

  test("Acknowledge is disabled when the anomaly is already acknowledged", async ({ page }) => {
    await stubReads(page, { anomaly: "acknowledged", withWorkOrder: true });
    await loginAdmin(page);
    await openHub(page);

    const btn = page.getByTestId("button-acknowledge");
    await expect(btn).toBeDisabled();
    await expect(btn).toContainText(/Acknowledged/i);
  });

  test("Acknowledge fires the POST and shows the success toast on settle", async ({ page }) => {
    await stubReads(page, { anomaly: "unacknowledged", withWorkOrder: true });

    const ackHits: PlaywrightRequest[] = [];
    await page.route(
      "**/api/equipment-intelligence/anomalies/**/acknowledge",
      async (route: Route) => {
        ackHits.push(route.request());
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: 501,
            anomalyType: "bearing_temp",
            sensorType: "temperature",
            severity: "high",
            detectedAt: "2026-06-01T10:00:00.000Z",
            acknowledged: true,
            acknowledgedBy: "Admin",
            acknowledgedAt: "2026-06-02T08:00:00.000Z",
          }),
        });
      }
    );

    await loginAdmin(page);
    await openHub(page);

    const btn = page.getByTestId("button-acknowledge");
    await expect(btn).toBeEnabled();
    await btn.click();

    await expect(page.getByText("Anomaly acknowledged")).toBeVisible();
    expect(ackHits.length).toBeGreaterThanOrEqual(1);
    expect(ackHits[0]!.method()).toBe("POST");
    expect(ackHits[0]!.url()).toContain(`/anomalies/${EQUIP_ID}/acknowledge`);
  });

  test("Acknowledge shows the error toast when the POST fails", async ({ page }) => {
    await stubReads(page, { anomaly: "unacknowledged", withWorkOrder: true });
    await page.route(
      "**/api/equipment-intelligence/anomalies/**/acknowledge",
      async (route: Route) => {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ error: "No active anomaly to acknowledge" }),
        });
      }
    );

    await loginAdmin(page);
    await openHub(page);

    await page.getByTestId("button-acknowledge").click();

    await expect(page.getByText("Failed to acknowledge")).toBeVisible();
  });

  test("Assign lists crew and persists assignedCrewId + in_progress status", async ({ page }) => {
    await stubReads(page, { anomaly: "none", withWorkOrder: true });

    let putBody: Record<string, unknown> | null = null;
    let putUrl = "";
    await page.route("**/api/work-orders/**", async (route: Route) => {
      const req = route.request();
      if (req.method() === "PUT") {
        putUrl = req.url();
        putBody = req.postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: WORK_ORDER_ID, status: "in_progress" }),
        });
        return;
      }
      await route.continue();
    });

    await loginAdmin(page);
    await openHub(page);

    await page.getByTestId("button-assign").click();

    // Crew returned by /api/crew must be listed as selectable items.
    const member = page.getByTestId(`assign-crew-${CREW[0]!.id}`);
    await expect(member).toBeVisible();
    await expect(member).toContainText(CREW[0]!.name);

    await member.click();

    await expect(page.getByText("Work assigned")).toBeVisible();
    expect(putUrl).toContain(`/api/work-orders/${WORK_ORDER_ID}`);
    expect(putBody).toMatchObject({
      assignedCrewId: CREW[0]!.id,
      status: "in_progress",
    });
  });

  test("Quick Work Order sheet posts to /api/work-orders/quick with the prefilled equipment", async ({
    page,
  }) => {
    await stubReads(page, { anomaly: "none", withWorkOrder: false });
    // Equipment list for the sheet's selector. RegExp (not glob) so it
    // cannot shadow the /api/equipment-intelligence/hub stub.
    await page.route(/\/api\/equipment(\?|$)/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: EQUIP_ID, name: "Main Engine #1", equipmentType: "Diesel Engine" },
        ]),
      });
    });

    let quickBody: Record<string, unknown> | null = null;
    await page.route("**/api/work-orders/quick", async (route: Route) => {
      quickBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ workOrderNumber: "WO-QUICK-1" }),
      });
    });

    await loginAdmin(page);
    await openHub(page);

    await page.getByTestId("button-quick-work-order").click();
    await expect(page.getByTestId("quick-wo-sheet")).toBeVisible();

    await page.getByTestId("quick-wo-description").fill("Knocking noise near cyl. 4");
    await page.getByTestId("quick-wo-submit").click();

    await expect(page.getByText("Work order created")).toBeVisible();
    expect(quickBody).toMatchObject({
      equipmentId: EQUIP_ID,
      description: "Knocking noise near cyl. 4",
    });
  });

  test("tabs reveal work orders and operational context without losing the action bar", async ({
    page,
  }) => {
    await stubReads(page, { anomaly: "none", withWorkOrder: true });
    await loginAdmin(page);
    await openHub(page);

    // Action bar is above the tabs — visible on load and after switching.
    await expect(page.getByTestId("action-bar")).toBeVisible();

    await page.getByTestId("tab-work-parts").click();
    await expect(page.getByTestId(`work-order-${WORK_ORDER_ID}`)).toBeVisible();

    await page.getByTestId("tab-context").click();
    await expect(page.getByTestId("operational-context")).toBeVisible();
    await expect(page.getByTestId("action-bar")).toBeVisible();
  });
});
