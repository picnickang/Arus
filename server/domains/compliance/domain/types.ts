/**
 * Compliance Domain - Types
 *
 * The compliance storage returns raw query rows (not typed entities) and uses
 * db-local param types, so this slice models the read rows structurally and
 * exposes a computed summary shape. Entity aliases are provided for consumers.
 */

export interface VesselFindingsSummary {
  vesselId: string;
  totalOpenFindings: number;
  bySeverity: { critical: number; warning: number; info: number };
  bySource: {
    logbook_deck: number;
    logbook_engine: number;
    crew: number;
    maintenance: number;
    telemetry: number;
  };
  byCategory: {
    operational: number;
    safety: number;
    data_integrity: number;
    regulatory: number;
  };
  recentFindings: unknown[];
}
