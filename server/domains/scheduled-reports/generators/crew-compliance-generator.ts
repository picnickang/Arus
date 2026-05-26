/**
 * Crew Compliance Report Generator
 * Generates crew certification and compliance report
 */

import { vesselService, dbCrewStorage } from "../../../repositories";
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

export class CrewComplianceGenerator implements ICrewComplianceGenerator {
  readonly reportType = "crew_compliance" as const;

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
      // LR-3.5 / PERF-1: was a vessels-by-crew-by-certifications
      // triple-nested loop issuing one `getCrewCertifications` query
      // per crew member (`(vessels × members)` round-trips). On a
      // mid-size fleet (~20 vessels × ~15 crew) that's 300+ serial
      // queries — the scheduled-reports worker timed out and held
      // its DB connection long enough to starve the rest of the
      // pool. The rewrite issues exactly three queries: all
      // vessels, all crew across the filtered vessels (in parallel
      // per vessel — `dbCrewStorage.getCrew` is the only port we
      // have today), and all certifications for the org. The
      // org-wide cert pull is then grouped by `crewId` in-memory,
      // and the per-member projection is O(certs) instead of
      // O(vessels × members) round-trips.
      const alerts: CertificationAlert[] = [];
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      if (filteredVessels.length === 0) {
        return alerts;
      }

      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // Two parallel batches: per-vessel crew lists (the only
      // signature we have) and a single org-wide cert pull.
      const [crewByVessel, allCerts] = await Promise.all([
        Promise.all(
          filteredVessels.map((vessel) => dbCrewStorage.getCrew(orgId, vessel.id))
        ),
        // `dbCrewStorage` exposes the org-scoped 2-arg overload; the
        // `dbCrewExtensionsStorage` binding is only the crew-only
        // overload.
        dbCrewStorage.getCrewCertifications(undefined, orgId),
      ]);

      const certsByCrew = new Map<string, typeof allCerts>();
      for (const cert of allCerts) {
        const existing = certsByCrew.get(cert.crewId);
        if (existing) {
          existing.push(cert);
        } else {
          certsByCrew.set(cert.crewId, [cert]);
        }
      }

      for (let i = 0; i < filteredVessels.length; i++) {
        const vessel = filteredVessels[i];
        const crew = crewByVessel[i];
        if (!vessel || !crew) continue;

        for (const member of crew) {
          const certifications = certsByCrew.get(member.id) ?? [];
          for (const cert of certifications) {
            const expiryDate = cert.expiresAt ? new Date(cert.expiresAt) : null;
            if (expiryDate && expiryDate <= ninetyDaysFromNow) {
              const daysUntilExpiry = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
              );
              alerts.push({
                crewId: member.id,
                crewName: member.name,
                vesselName: vessel.name,
                certificationName: cert.cert,
                expiryDate,
                daysUntilExpiry,
              });
            }
          }
        }
      }

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
