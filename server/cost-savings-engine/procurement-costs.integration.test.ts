import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";
const TEST_ORG_ID = "default-org-id";

async function api(method: string, path: string, body?: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-org-id": TEST_ORG_ID,
      "x-user-role": "admin",
      "x-user-id": "test-user-1",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

let testWoId: string;
let testSoId: string;
let testEquipmentId: string;
let testSupplierId: string;

describe("Procurement Cost → Work Order Integration", () => {
  beforeAll(async () => {
    const equipRes = await api("GET", "/api/equipment");
    expect(equipRes.status).toBe(200);
    testEquipmentId = equipRes.data[0].id;

    const suppRes = await api("GET", "/api/suppliers");
    expect(suppRes.status).toBe(200);
    testSupplierId = suppRes.data[0].id;

    const woRes = await api("POST", "/api/work-orders", {
      equipmentId: testEquipmentId,
      reason: "Procurement cost integration test",
      priority: 2,
      maintenanceType: "corrective",
      status: "in_progress",
    });
    expect(woRes.status).toBe(201);
    testWoId = woRes.data.id;

    const soRes = await api("POST", "/api/service-orders", {
      orgId: TEST_ORG_ID,
      workOrderId: testWoId,
      serviceProviderId: testSupplierId,
      soNumber: "SO-INTEGRATION-TEST",
      quotedAmount: 5000,
      description: "Test service for procurement integration",
    });
    expect(soRes.status).toBe(201);
    testSoId = soRes.data.id;
  });

  afterAll(async () => {
    if (testSoId) await api("DELETE", `/api/service-orders/${testSoId}`);
    if (testWoId) await api("DELETE", `/api/work-orders/${testWoId}`);
  });

  it("should return zero serviceOrderCosts for draft SOs", async () => {
    const res = await api("GET", `/api/work-orders/${testWoId}/procurement-costs`);
    expect(res.status).toBe(200);
    expect(res.data.serviceOrderCosts).toBe(0);
    expect(res.data.serviceOrderDetails.length).toBeGreaterThanOrEqual(1);
    expect(res.data.resolvedDowntimeCostPerHour).toBeGreaterThan(0);
  });

  it("should include actualAmount after SO completion in aggregation", async () => {
    const sendRes = await api("POST", `/api/service-orders/${testSoId}/send`);
    expect(sendRes.status).toBe(200);

    const confirmRes = await api("POST", `/api/service-orders/${testSoId}/confirm`);
    expect(confirmRes.status).toBe(200);

    const startRes = await api("POST", `/api/service-orders/${testSoId}/start`);
    expect(startRes.status).toBe(200);

    const completeRes = await api("POST", `/api/service-orders/${testSoId}/complete`, {
      actualAmount: 4200,
      actualDurationHours: 8,
    });
    expect(completeRes.status).toBe(200);

    const costsRes = await api("GET", `/api/work-orders/${testWoId}/procurement-costs`);
    expect(costsRes.status).toBe(200);
    expect(costsRes.data.serviceOrderCosts).toBe(4200);
    expect(costsRes.data.totalProcurementCost).toBe(4200);
  });

  it("should aggregate procurement costs into WO totalPartsCost on completion trigger", async () => {
    const woRes = await api("GET", `/api/work-orders/${testWoId}`);
    expect(woRes.status).toBe(200);
    expect(woRes.data.totalPartsCost).toBe(4200);
  });

  it("should recalculate via manual aggregation endpoint", async () => {
    const aggRes = await api("POST", `/api/work-orders/${testWoId}/aggregate-procurement-costs`);
    expect(aggRes.status).toBe(200);
    expect(aggRes.data.totalPartsCost).toBe(4200);
    expect(aggRes.data.totalProcurementCost).toBe(4200);
  });
});
