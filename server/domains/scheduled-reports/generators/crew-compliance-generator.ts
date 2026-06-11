/**
 * Crew Compliance Report Generator
 * Generates crew certification and compliance report
 */

import type { ICrewComplianceGenerator } from "../domain/ports.js";
import type {
  CrewComplianceData,
  CertificationAlert,
  HoRViolation,
  CrewChange,
} from "../domain/types.js";
import { logger } from "../../../utils/logger.js";
import { recordUserVisibleStub } from "../../../observability/security-metrics.js";

const LOG_CTX = "CrewComplianceGenerator";

/**
 * LR-3.5 PERF cluster: narrow port the generator uses to fetch the
 * single-join compliance projection. Defined as a structural type so
 * tests can inject a fake without pulling the full `dbCrewStorage`
 * (which transitively loads the DB driver) into scope.
 */
export interface CrewComplianceRowsPort {
  getCrewComplianceRows(
    orgId: string,
    vesselIds: string[] | null,
    expiresBefore: Date
  ): Promise<
    Array<{
      crewId: string;
      crewName: string;
      vesselName: string;
      cert: string;
      expiresAt: Date;
    }>
  >;
}

export class CrewComplianceGenerator implements ICrewComplianceGenerator {
  readonly reportType = "crew_compliance" as const;

  private resolvedStorage: CrewComplianceRowsPort | null;

  // The default storage is resolved lazily via dynamic import so tests
  // can construct the generator with an injected `CrewComplianceRowsPort`
  // without pulling the full `server/repositories` barrel (and its
  // top-level-await DB driver init) into scope.
  constructor(crewStorage?: CrewComplianceRowsPort) {
    this.resolvedStorage = crewStorage ?? null;
  }

  private async getStorage(): Promise<CrewComplianceRowsPort> {
    if (!this.resolvedStorage) {
      const mod = await import("../../../repositories");
      this.resolvedStorage = mod.dbCrewStorage;
    }
    return this.resolvedStorage;
  }

  async generate(orgId: string, vesselIds: string[] | null): Promise<CrewComplianceData> {
    logger.info(LOG_CTX, `Generating crew compliance report for org ${orgId}`);

    try {
      const expiringCertifications = await this.getExpiringCertifications(orgId, vesselIds);
      const hoursOfRestViolations = await this.getHoRViolations(orgId, vesselIds);
      const upcomingCrewChanges = await this.getUpcomingCrewChanges(orgId, vesselIds);
      const complianceScore = this.calculateComplianceScore(
        expiringCertifications.length,
        hoursOfRestViolations.length
      );

      return {
        expiringCertifications,
        hoursOfRestViolations,
        upcomingCrewChanges,
        complianceScore,
      };
    } catch (error) {
      logger.error(LOG_CTX, "Failed to generate crew compliance report", String(error));
      return {
        expiringCertifications: [],
        hoursOfRestViolations: [],
        upcomingCrewChanges: [],
        complianceScore: 100,
      };
    }
  }

  private async getExpiringCertifications(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<CertificationAlert[]> {
    try {
      // LR-3.5 PERF cluster: was a vessels-by-crew-by-certifications
      // pipeline that fanned out one `getCrew(orgId, vesselId)` query
      // per vessel plus an org-wide `getCrewCertifications` pull.
      // Now a single SQL statement joins vessels ⨝ crew ⨝ crew_cert
      // with the expiry window pushed into the WHERE clause — one
      // round-trip regardless of crew size. The in-memory shape
      // (filter > 90-day window, sort by daysUntilExpiry) is
      // preserved so the projection is byte-equivalent.
      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Filter-semantics defence: `vesselIds === []` means "explicit
      // empty selection" — the legacy in-memory pipeline returned
      // zero alerts in that case. We short-circuit here AND in the
      // storage method (defence in depth) so the empty-array case
      // never broadens to "all vessels in org".
      if (vesselIds !== null && vesselIds.length === 0) {
        return [];
      }

      const storage = await this.getStorage();
      const rows = await storage.getCrewComplianceRows(orgId, vesselIds, ninetyDaysFromNow);

      const alerts: CertificationAlert[] = rows.map((row) => {
        const expiryDate = row.expiresAt;
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        return {
          crewId: row.crewId,
          crewName: row.crewName,
          vesselName: row.vesselName,
          certificationName: row.cert,
          expiryDate,
          daysUntilExpiry,
        };
      });

      return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get expiring certifications", String(error));
      return [];
    }
  }

  private async getHoRViolations(
    _orgId: string,
    _vesselIds: string[] | null
  ): Promise<HoRViolation[]> {
    // TODO(arus-pdm): Wire to hours-of-rest tracking domain once it exposes a query.
    // P2 #31 — empty array is observable by report consumers (compliance
    // score skews to 100). Emit a counter so the always-zero state is
    // visible until the HoR domain exposes a query port.
    recordUserVisibleStub("crew_compliance_report", "hours_of_rest_unwired");
    return [];
  }

  private async getUpcomingCrewChanges(
    _orgId: string,
    _vesselIds: string[] | null
  ): Promise<CrewChange[]> {
    // TODO(arus-pdm): Wire to crew rotation domain once it exposes a query.
    // P2 #31 — same visibility counter for the crew-rotation stub.
    recordUserVisibleStub("crew_compliance_report", "crew_rotation_unwired");
    return [];
  }

  private calculateComplianceScore(expiringCerts: number, horViolations: number): number {
    let score = 100;
    score -= expiringCerts * 2;
    score -= horViolations * 5;
    return Math.max(0, Math.min(100, score));
  }
}
