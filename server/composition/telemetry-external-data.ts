/**
 * Composition - Telemetry External Reads Provider
 *
 * The telemetry sensor-health and config routes read sensor configurations
 * (sensor-management), device heartbeats (devices), and open alert
 * notifications (alerts) — all cross-domain. This adapter lives in the
 * composition layer (outside server/domains/) so the telemetry domain stays
 * free of those storages; it is injected into the telemetry routes via the
 * domain-router registry. (`listUnacknowledgedAlertNotifications` is itself the
 * pre-existing alerts composition seam.)
 */

import type { ITelemetryExternalReads } from "../domains/telemetry/domain/ports";
import { dbSensorsStorage, dbDevicesStorage } from "../repositories";
import { listUnacknowledgedAlertNotifications } from "./telemetry-alerts.js";

export const telemetryExternalProvider: ITelemetryExternalReads = {
  getSensorConfigurations: (orgId, equipmentId, sensorType) =>
    dbSensorsStorage.getSensorConfigurations(orgId, equipmentId, sensorType),
  getHeartbeatsByOrg: (orgId) => dbDevicesStorage.getHeartbeatsByOrg(orgId),
  listUnacknowledgedAlertNotifications: (orgId) => listUnacknowledgedAlertNotifications(orgId),
};
