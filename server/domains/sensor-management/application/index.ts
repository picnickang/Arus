/**
 * Sensor Management Application Layer
 *
 * The SensorManagementService is constructed at route registration (in
 * interfaces/), because its cross-domain ports (equipment, ML optimization,
 * telemetry history) are injected through the domain-router registry. The sensor
 * repository (infrastructure) is the static singleton supplied there.
 */
export { SensorManagementService, EquipmentNotFoundError } from "./sensor-management-service";
