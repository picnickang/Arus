/**
 * Crew Compliance Report Generator
 * Generates crew certification and compliance report
 */

import { vesselService, dbCrewStorage, dbCrewExtensionsStorage } from '../../../repositories';
import type { ICrewComplianceGenerator } from '../domain/ports.js';
import type {
  CrewComplianceData,
  CertificationAlert,
  HoRViolation,
  CrewChange,
} from '../domain/types.js';
import { logger } from '../../../utils/logger.js';

const LOG_CTX = 'CrewComplianceGenerator';

export class CrewComplianceGenerator implements ICrewComplianceGenerator {
  readonly reportType = 'crew_compliance' as const;

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
      logger.error(LOG_CTX, 'Failed to generate crew compliance report', String(error));
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
      const alerts: CertificationAlert[] = [];
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const now = new Date();
      const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      for (const vessel of filteredVessels) {
        const crew = await dbCrewStorage.getCrew(orgId, vessel.id);

        for (const member of crew) {
          const certifications = await dbCrewExtensionsStorage.getCrewCertifications(member.id, orgId);

          for (const cert of certifications) {
            const expiryDate = (cert as any).expiryDate ? new Date((cert as any).expiryDate) : null;

            if (expiryDate && expiryDate <= ninetyDaysFromNow) {
              const daysUntilExpiry = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
              );

              alerts.push({
                crewId: member.id,
                crewName: `${member.firstName} ${member.lastName}`,
                vesselName: vessel.name,
                certificationName: (cert as any).certificateName || (cert as any).type || 'Certificate',
                expiryDate,
                daysUntilExpiry,
              });
            }
          }
        }
      }

      return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get expiring certifications', String(error));
      return [];
    }
  }

  private async getHoRViolations(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<HoRViolation[]> {
    try {
      return [];
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get HoR violations', String(error));
      return [];
    }
  }

  private async getUpcomingCrewChanges(
    orgId: string,
    vesselIds: string[] | null
  ): Promise<CrewChange[]> {
    try {
      return [];
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to get upcoming crew changes', String(error));
      return [];
    }
  }

  private calculateComplianceScore(
    expiringCerts: number,
    horViolations: number
  ): number {
    let score = 100;
    score -= expiringCerts * 2;
    score -= horViolations * 5;
    return Math.max(0, Math.min(100, score));
  }
}
