/**
 * Deterministic fixtures for the DEEP_ROUTES (vessel-intelligence, pdm, work
 * order detail, logs). Keyed by exact `/api` pathname; passed to
 * `installRoleFixtures({ fixtures: DEEP_ROUTE_FIXTURES })` so deep routes render
 * representative content instead of empty states. Shared by the deep-route
 * visual spec and (as a reference for IDs) the deep-route real smoke.
 *
 * All values are FIXED (no Date.now/random) for pixel stability. If real seed
 * data changes, update here — this is the single source of truth for the
 * canonical test IDs (mv-atlas, port-generator, so-4481).
 *
 * Endpoints not listed here fall through to the `[]` default — still
 * deterministic, just an empty state.
 */

const NOW = "2026-06-12T00:00:00.000Z";

const VESSEL = {
  id: "mv-atlas",
  name: "MV Atlas",
  imo: "9876543",
  status: "operational",
  healthScore: 82,
  flag: "Panama",
  type: "OSV",
  orgId: "default-org-id",
};

const WORK_ORDER = {
  id: "so-4481",
  woNumber: "WO-4481",
  vesselId: "mv-atlas",
  equipmentId: "port-generator",
  status: "open",
  priority: "high",
  maintenanceType: "corrective",
  description: "Port generator bearing inspection",
  plannedStartDate: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const PDM_ASSET = {
  id: "port-generator",
  equipmentId: "port-generator",
  name: "Port Generator",
  riskScore: 0.72,
  severity: "high",
  status: "active",
  vesselId: "mv-atlas",
  failureProbability: 0.72,
  predictedFailureDate: NOW,
  orgId: "default-org-id",
};

const TELEMETRY_SERIES = Array.from({ length: 24 }, (_, i) => ({
  timestamp: `2026-06-12T${String(i).padStart(2, "0")}:00:00.000Z`,
  value: 40 + (i % 6),
  sensorType: "vibration",
}));

export const DEEP_ROUTE_FIXTURES: Record<string, unknown> = {
  // Vessel intelligence
  "/api/vessels/mv-atlas": VESSEL,
  "/api/vessels": [VESSEL],
  "/api/vessel-intelligence/mv-atlas": { vessel: VESSEL, sections: [], equipment: [] },
  // PDM
  "/api/pdm/equipment/port-generator": PDM_ASSET,
  "/api/pdm/asset/port-generator": PDM_ASSET,
  "/api/pdm/dashboard": { riskQueue: { new: [PDM_ASSET], active: [], resolved: [] } },
  "/api/pdm/risk-queue/new": [PDM_ASSET],
  "/api/pdm/risk-queue/active": [],
  "/api/telemetry/history/port-generator/vibration": TELEMETRY_SERIES,
  // Work order detail
  "/api/work-orders/so-4481": WORK_ORDER,
  "/api/work-orders": [WORK_ORDER],
  // Logs
  "/api/logbook/deck/daily": [{ id: "deck-1", date: NOW, vesselId: "mv-atlas" }],
  "/api/logbook/engine/daily": [{ id: "engine-1", date: NOW, vesselId: "mv-atlas" }],
};
