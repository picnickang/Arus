/**
 * Visual + behavioural journey for the live PdM equipment detail page.
 *
 * The /pdm/equipment/:id and /pdm/equipment/:id/telemetry routes used to render
 * a static Figma-fidelity board with hardcoded readings. They now render the
 * data-driven PdmEquipmentDetail (Overview / Sensors / Anomalies / Maintenance).
 *
 * Auth uses the dev-login admin card (like equipment-hub-actions.spec.ts) so the
 * hub-gated route resolves with real permissions; only the equipment-specific
 * data endpoints are stubbed, which keeps the screenshots deterministic without
 * fighting the auth/permission stack. Screenshots are written under
 * test-results/pdm-visual and attached to the report.
 */

import { test, expect, type Page, type Route, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const EQUIP_ID = "EQUIP-VIS";
const OUT_DIR = path.resolve(process.cwd(), "test-results/pdm-visual");

/** Recognizable per-sensor values so the screenshots prove live data. */
const SENSOR_VALUES: Record<string, { value: number; unit: string }> = {
  temperature: { value: 87.3, unit: "°C" },
  pressure: { value: 4.2, unit: "bar" },
  vibration: { value: 7.8, unit: "mm/s" },
  flow_rate: { value: 120.5, unit: "L/min" },
  oil_quality: { value: 95.1, unit: "%" },
};

// Captured `?hours=` query strings hitting the telemetry-history endpoint, so a
// test can assert the time-window picker actually re-queries with a new window.
const historyHits: string[] = [];

function jsonRoute(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function healthPayload(lastUpdatedIso: string, status = "warning") {
  return {
    equipmentId: EQUIP_ID,
    healthScore: 72,
    rul: 45,
    rulUncertainty: 9,
    status,
    pFail30d: 0.18,
    aiSummary: "Bearing temperature trending above the expected envelope.",
    lastUpdated: lastUpdatedIso,
    confidence: "high",
  };
}

function telemetryRows(sensorType: string) {
  const spec = SENSOR_VALUES[sensorType];
  if (!spec) {
    return [];
  }
  const now = Date.now();
  return [
    {
      id: `${sensorType}-1`,
      ts: new Date(now - 3_600_000).toISOString(),
      sensorType,
      value: spec.value - 0.6,
      unit: spec.unit,
    },
    {
      id: `${sensorType}-2`,
      ts: new Date(now - 600_000).toISOString(),
      sensorType,
      value: spec.value,
      unit: spec.unit,
    },
  ];
}

/** Stub only the equipment-specific reads; everything else hits the dev backend. */
async function stubData(
  page: Page,
  opts: { lastUpdated: string; healthStatus?: string }
): Promise<void> {
  await page.route(`**/api/equipment/${EQUIP_ID}`, (route) =>
    jsonRoute(route, {
      id: EQUIP_ID,
      name: "MV Atlas — Port Generator",
      type: "Diesel Generator",
      vesselName: "MV Atlas",
      status: "active",
      isActive: true,
      location: "Engine Room",
    })
  );

  await page.route(`**/api/pdm/health/${EQUIP_ID}`, (route) =>
    jsonRoute(route, healthPayload(opts.lastUpdated, opts.healthStatus))
  );

  await page.route(`**/api/telemetry/history/${EQUIP_ID}/**`, (route) => {
    const url = new URL(route.request().url());
    historyHits.push(url.search);
    const sensorType = url.pathname.split("/").pop() ?? "";
    return jsonRoute(route, telemetryRows(sensorType));
  });

  await page.route(`**/api/telemetry/baseline/${EQUIP_ID}**`, (route) =>
    jsonRoute(route, {
      baselines: Object.entries(SENSOR_VALUES).map(([sensorType, spec]) => ({
        sensorType,
        p50: spec.value,
        avg: spec.value,
        stddev: 1,
        min: spec.value - 2,
        max: spec.value + 2,
        sampleCount: 100,
        bandLow: spec.value - 2,
        bandHigh: spec.value + 2,
      })),
    })
  );

  await page.route("**/api/sensor-config?*", (route) =>
    jsonRoute(route, [
      {
        id: "sc-1",
        equipmentId: EQUIP_ID,
        sensorType: "temperature",
        targetUnit: "°C",
        enabled: true,
      },
      {
        id: "sc-2",
        equipmentId: EQUIP_ID,
        sensorType: "vibration",
        targetUnit: "mm/s",
        enabled: false,
      },
    ])
  );

  await page.route("**/api/analytics/anomaly-detections?*", (route) =>
    jsonRoute(route, [
      {
        id: "an-1",
        sensorKind: "temperature",
        severity: "high",
        description: "Bearing temp above 2σ envelope",
      },
    ])
  );

  await page.route("**/api/work-orders?*", (route) =>
    jsonRoute(route, [
      {
        id: "wo-1",
        reason: "Bearing inspection",
        description: "Inspect generator DE bearing",
        status: "open",
        maintenanceType: "corrective",
      },
    ])
  );
}

async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.waitForLoadState("domcontentloaded");
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

const FRESH = () => new Date(Date.now() - 3 * 3_600_000).toISOString();
const STALE = () => new Date(Date.now() - 30 * 3_600_000).toISOString();

test.describe("PdM equipment detail — live data journey", () => {
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

  test("Overview renders live multi-sensor telemetry, not the static board", async ({
    page,
  }, testInfo) => {
    historyHits.length = 0;
    await stubData(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/pdm/equipment/${EQUIP_ID}/telemetry`, { waitUntil: "domcontentloaded" });

    // Continuity: the mobile-readiness marker is preserved on the new screen.
    await expect(page.getByTestId("mobile-readiness-screen-pdm-telemetry")).toBeVisible();
    await expect(page.getByTestId("pdm-equipment-detail")).toBeVisible();
    await expect(page.getByTestId("pdm-health-header")).toBeVisible();

    // Live values from the stub, not the old hardcoded board.
    await expect(page.getByTestId("sensor-latest-temperature")).toContainText("87.3");
    await expect(page.getByText("Vibration DE (RMS) mm/s")).toHaveCount(0);

    await capture(page, testInfo, "pdm-overview-live");
  });

  test("time-window picker re-queries history with a wider window", async ({ page }, testInfo) => {
    historyHits.length = 0;
    await stubData(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await page.goto(`/pdm/equipment/${EQUIP_ID}/telemetry`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("multi-sensor-chart")).toBeVisible();
    await capture(page, testInfo, "pdm-timewindow-24h");
    // Default window is 24h.
    expect(historyHits.some((search) => search.includes("hours=24"))).toBe(true);

    historyHits.length = 0;
    await page.getByTestId("time-window-7d").click();
    await expect.poll(() => historyHits.some((search) => search.includes("hours=168"))).toBe(true);
    await capture(page, testInfo, "pdm-timewindow-7d");
  });

  test("health header surfaces a freshness signal", async ({ page }, testInfo) => {
    await stubData(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await page.goto(`/pdm/equipment/${EQUIP_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("health-freshness")).toContainText("computed");
    await expect(page.getByTestId("health-stale-warning")).toHaveCount(0);
    await capture(page, testInfo, "pdm-health-freshness");
  });

  test("health header flags a stale (>24h) score", async ({ page }, testInfo) => {
    await stubData(page, { lastUpdated: STALE() });
    await loginAdmin(page);
    await page.goto(`/pdm/equipment/${EQUIP_ID}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("health-stale-warning")).toBeVisible();
    await capture(page, testInfo, "pdm-health-stale");
  });

  test("tabs reveal sensors, anomalies, and maintenance", async ({ page }, testInfo) => {
    await stubData(page, { lastUpdated: FRESH() });
    await loginAdmin(page);
    await page.goto(`/pdm/equipment/${EQUIP_ID}`, { waitUntil: "domcontentloaded" });

    await page.getByTestId("tab-anomalies").click();
    await expect(page.getByTestId("anomalies-table")).toBeVisible();
    await expect(page.getByText("Bearing temp above 2σ envelope")).toBeVisible();
    await capture(page, testInfo, "pdm-tabs-anomalies");

    await page.getByTestId("tab-maintenance").click();
    await expect(page.getByTestId("maintenance-table")).toBeVisible();

    await page.getByTestId("tab-sensors").click();
    await expect(page.getByTestId("sensors-table")).toBeVisible();
  });
});
