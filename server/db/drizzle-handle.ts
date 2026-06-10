/**
 * Re-export of the drizzle `db` handle for composition seams that wire it into
 * port-injected helpers — e.g. the telemetry warehouse-export job, whose
 * exporter functions receive `db` as a parameter (dependency injection) rather
 * than importing it. Routing the acquisition through the storage layer keeps
 * the service off the raw `server/db` root (hexagonal storage boundary) while
 * preserving the injectable design.
 */
export { db } from "./index";
