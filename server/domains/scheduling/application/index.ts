/**
 * Scheduling Application Layer
 *
 * The SchedulingService is constructed at route registration (in interfaces/),
 * because its cross-domain maintenance dependency is injected through the
 * domain-router registry. The optimizer adapter (infrastructure) and the
 * optimization directory (composition) are static singletons supplied there.
 */
export { SchedulingService } from "./scheduling-service";
