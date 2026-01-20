import client from "prom-client";

// ===== EQUIPMENT AND FLEET HEALTH METRICS =====
export const equipmentHealthStatus = new client.Gauge({
  name: "arus_equipment_health_status",
  help: "Equipment health status distribution",
  labelNames: ["status", "vessel_id"],
});

export const fleetHealthScore = new client.Gauge({
  name: "arus_fleet_health_score",
  help: "Overall fleet health score percentage",
});

export const pdmScoresTotal = new client.Histogram({
  name: "arus_pdm_scores",
  help: "Distribution of predictive maintenance scores",
  labelNames: ["equipment_id", "vessel_id"],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

// ===== MAINTENANCE METRICS =====
export const maintenanceSchedulesTotal = new client.Counter({
  name: "arus_maintenance_schedules_total",
  help: "Total maintenance schedules created/updated",
  labelNames: ["type", "vessel_id"],
});

export const vesselOperationsTotal = new client.Counter({
  name: "arus_vessel_operations_total",
  help: "Total vessel-related operations",
  labelNames: ["operation", "vessel_id"],
});

// ===== WORK ORDER METRICS =====
export const workOrdersTotal = new client.Counter({
  name: "arus_work_orders_total",
  help: "Total work orders created/updated",
  labelNames: ["status", "priority", "vessel_id"],
});

// Helper functions
export function recordEquipmentHealth(vesselId: string, status: string, count: number) {
  equipmentHealthStatus.set({ status, vessel_id: vesselId }, count);
}

export function recordFleetHealth(score: number) {
  fleetHealthScore.set(score);
}

export function recordPdmScore(equipmentId: string, vesselId: string, score: number) {
  pdmScoresTotal.observe({ equipment_id: equipmentId, vessel_id: vesselId }, score);
}

export function recordMaintenanceSchedule(type: string, vesselId: string) {
  maintenanceSchedulesTotal.inc({ type, vessel_id: vesselId });
}

export function recordVesselOperation(operation: string, vesselId: string) {
  vesselOperationsTotal.inc({ operation, vessel_id: vesselId });
}

export function recordWorkOrder(status: string, priority: string, vesselId: string) {
  workOrdersTotal.inc({ status, priority, vessel_id: vesselId });
}

// Backward-compatible aliases
export function updateEquipmentHealthStatus(status: string, count: number, vesselId?: string) {
  equipmentHealthStatus.set({ status, vessel_id: vesselId || "unknown" }, count);
}

export function updateFleetHealthScore(score: number) {
  fleetHealthScore.set(score);
}

export function incrementWorkOrder(status: string, priority: string, vesselId?: string) {
  workOrdersTotal.inc({ status, priority, vessel_id: vesselId || "unknown" });
}

export function incrementMaintenanceSchedule(type: string, vesselId?: string) {
  maintenanceSchedulesTotal.inc({ type, vessel_id: vesselId || "unknown" });
}

export function incrementVesselOperation(operation: string, vesselId?: string) {
  vesselOperationsTotal.inc({ operation, vessel_id: vesselId || "unknown" });
}
