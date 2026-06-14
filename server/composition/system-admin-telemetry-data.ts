/**
 * Composition - System Admin Telemetry Writer
 *
 * The system-admin telemetry-simulation routes write simulated readings into the
 * telemetry domain's storage. That cross-domain adapter lives here in the
 * composition layer (outside server/domains/) so the system-admin domain stays
 * free of the telemetry storage; the writer port is imported by the simulation
 * interface (mirrors the equipment→sensor and ml-analytics seams).
 */

import { dbTelemetryStorage } from "../repositories.js";

export interface ISystemAdminTelemetryWriter {
  createTelemetryReading: typeof dbTelemetryStorage.createTelemetryReading;
}

export const systemAdminTelemetryWriter: ISystemAdminTelemetryWriter = {
  createTelemetryReading: dbTelemetryStorage.createTelemetryReading.bind(dbTelemetryStorage),
};
