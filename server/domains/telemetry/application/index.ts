/**
 * Telemetry Application Layer
 *
 * The TelemetryService is constructed at route registration (in interfaces/),
 * because its cross-domain external-reads dependency is injected through the
 * domain-router registry. The telemetry repository (infrastructure) is the
 * static singleton supplied there.
 */
export { TelemetryService } from "./telemetry-service";
