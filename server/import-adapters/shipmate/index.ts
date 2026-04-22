/**
 * SHIPMATE Import Adapter — Barrel Export
 *
 * Integration layer between SBN SHIPMATE ERP and ARUS AI/Analytics platform.
 *
 * ARUS does NOT replace SHIPMATE. SHIPMATE remains the system of record for:
 *   - Planned Maintenance System (PMS) — class-certified by Bureau Veritas
 *   - Stores & Procurement (SPS)
 *   - Crew Management & Payroll (CMS)
 *   - Quality & Safety (HSEQ)
 *
 * ARUS adds value on top of SHIPMATE by providing:
 *   - Predictive maintenance from sensor telemetry + SHIPMATE maintenance history
 *   - AI-powered equipment health scoring and failure prediction
 *   - RAG knowledge base (ask "what was the last turbocharger failure?" and get
 *     answers from years of SHIPMATE job records)
 *   - Real-time digital twins fed by telemetry
 *   - CII/emissions analytics
 *   - Fleet-level dashboards and trend analysis
 *
 * Usage:
 *   import { shipmateImportRouter } from "./import-adapters/shipmate";
 *   app.use("/api/import/shipmate", shipmateImportRouter);
 */

export { shipmateImportRouter } from "./routes";
export {
  shipmateImport,
  type ShipmateImportOptions,
  type ShipmateImportResult,
} from "./import-service";
export {
  getShipmateMapping,
  normalizeShipmateHeaders,
  SHIPMATE_EQUIPMENT_MAP,
  SHIPMATE_JOB_MAP,
  SHIPMATE_STORES_MAP,
  SHIPMATE_CREW_CERT_MAP,
  SHIPMATE_REST_HOURS_MAP,
  type ShipmateModuleType,
} from "./field-mapping";
