import client from "prom-client";

// ===== DEVICE REGISTRY METRICS =====
export const deviceRegistryOperationsTotal = new client.Counter({
  name: "arus_device_registry_operations_total",
  help: "Total device registry operations",
  labelNames: ["operation"],
});

export const deviceRegistryActiveDevices = new client.Gauge({
  name: "arus_device_registry_active_devices",
  help: "Number of devices registered in device registry",
});

// ===== SHEET LOCKING METRICS =====
export const sheetLockOperationsTotal = new client.Counter({
  name: "arus_sheet_lock_operations_total",
  help: "Total sheet lock operations",
  labelNames: ["operation", "crew_id"],
});

export const sheetLocksActive = new client.Gauge({
  name: "arus_sheet_locks_active",
  help: "Number of active sheet locks",
});

// ===== SHEET VERSIONING METRICS =====
export const sheetVersionOperationsTotal = new client.Counter({
  name: "arus_sheet_version_operations_total",
  help: "Total sheet version operations",
  labelNames: ["operation", "crew_id"],
});

export const sheetVersionsTotal = new client.Gauge({
  name: "arus_sheet_versions_total",
  help: "Total number of sheet versions tracked",
});

// ===== REPLAY HELPER METRICS =====
export const replayOperationsTotal = new client.Counter({
  name: "arus_replay_operations_total",
  help: "Total replay operations",
  labelNames: ["device_id", "endpoint"],
});

export const replayDuplicatesTotal = new client.Counter({
  name: "arus_replay_duplicates_total",
  help: "Total duplicate replay requests detected",
  labelNames: ["device_id", "endpoint"],
});

// Helper functions
export function recordDeviceRegistryOperation(operation: "create" | "update" | "list") {
  deviceRegistryOperationsTotal.inc({ operation });
}

export function setActiveDeviceCount(count: number) {
  deviceRegistryActiveDevices.set(count);
}

export function recordSheetLockOperation(operation: "acquire" | "release" | "check", crewId: string) {
  sheetLockOperationsTotal.inc({ operation, crew_id: crewId });
}

export function setActiveSheetLocks(count: number) {
  sheetLocksActive.set(count);
}

export function recordSheetVersionOperation(operation: "increment" | "check", crewId: string) {
  sheetVersionOperationsTotal.inc({ operation, crew_id: crewId });
}

export function setSheetVersionsCount(count: number) {
  sheetVersionsTotal.set(count);
}

export function recordReplayOperation(deviceId: string, endpoint: string) {
  replayOperationsTotal.inc({ device_id: deviceId, endpoint });
}

export function recordReplayDuplicate(deviceId: string, endpoint: string) {
  replayDuplicatesTotal.inc({ device_id: deviceId, endpoint });
}
