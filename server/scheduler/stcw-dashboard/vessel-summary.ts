/**
 * STCW Dashboard Vessel Summary - Single vessel STCW compliance details
 */

import { vesselService } from '../../repositories';
import { checkMonthCompliance, calculateFatigueRisk } from '../../stcw-compliance';
import type { VesselDetailedSummary } from './types';
import { getDateRange, getCrewRestDataForVessel } from './data-fetcher';

export async function getVesselSTCWSummary(
  orgId: string,
  vesselId: string,
  lookbackDays: number = 30
): Promise<VesselDetailedSummary> {
  const { startDate, endDate } = getDateRange(lookbackDays);
  const vessel = await vesselService.getVessel(vesselId);

  if (!vessel) {
    throw new Error(`Vessel ${vesselId} not found`);
  }

  const crewData = await getCrewRestDataForVessel(orgId, vesselId, startDate, endDate);
  const crewDetails: VesselDetailedSummary['crewDetails'] = [];

  let compliantCrew = 0;
  let totalViolations = 0;
  let totalWarnings = 0;
  let highFatigue = 0;
  let criticalFatigue = 0;
  let totalRest24h = 0;
  let totalRest7d = 0;
  let crewWithData = 0;

  for (const [crewId, { crewName, days }] of crewData) {
    if (days.length === 0) {
      crewDetails.push({
        crewId,
        crewName,
        isCompliant: true,
        violationCount: 0,
        warningCount: 0,
        fatigueLevel: 'low',
        fatigueScore: 0,
        avgRestPer24h: 0,
        recentIssues: [],
      });
      continue;
    }

    crewWithData++;
    const compliance = checkMonthCompliance(days);
    const fatigue = calculateFatigueRisk(crewId, days, crewName);

    const dayViolations = compliance.days.filter((d) => !d.day_ok).length;
    const rollingViolations = compliance.rolling7d.filter((r) => !r.ok).length;
    const crewViolations = dayViolations + rollingViolations;
    const crewWarnings = compliance.days.filter((d) => !d.split_ok && d.day_ok).length;

    if (compliance.ok) {
      compliantCrew++;
    }
    totalViolations += crewViolations;
    totalWarnings += crewWarnings;
    totalRest24h += fatigue.metrics.avgRestPer24h;
    totalRest7d += fatigue.metrics.avgRestPer7d;

    if (fatigue.riskLevel === 'high') {
      highFatigue++;
    }

    if (fatigue.riskLevel === 'critical') {
      criticalFatigue++;
    }

    const recentIssues = compliance.days
      .filter((d) => !d.day_ok)
      .slice(-5)
      .map((d) => ({
        date: d.date,
        rule: d.min_rest_24 < 10 ? '10h/24h' : 'split_rest',
        description:
          d.min_rest_24 < 10
            ? `Only ${d.min_rest_24}h rest (min 10h required)`
            : 'Rest period split rule violated',
      }));

    crewDetails.push({
      crewId,
      crewName,
      isCompliant: compliance.ok,
      violationCount: crewViolations,
      warningCount: crewWarnings,
      fatigueLevel: fatigue.riskLevel,
      fatigueScore: fatigue.score,
      avgRestPer24h: fatigue.metrics.avgRestPer24h,
      recentIssues,
    });
  }

  crewDetails.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (a.fatigueLevel !== b.fatigueLevel) {
      return severityOrder[a.fatigueLevel] - severityOrder[b.fatigueLevel];
    }
    return b.violationCount - a.violationCount;
  });

  return {
    vesselId,
    vesselName: vessel.name,
    totalCrew: crewData.size,
    compliantCrew,
    complianceRate: crewData.size > 0 ? (compliantCrew / crewData.size) * 100 : 100,
    violationCount: totalViolations,
    warningCount: totalWarnings,
    highFatigueCount: highFatigue,
    criticalFatigueCount: criticalFatigue,
    avgRestPer24h: crewWithData > 0 ? totalRest24h / crewWithData : 0,
    avgRestPer7d: crewWithData > 0 ? totalRest7d / crewWithData : 0,
    crewDetails,
  };
}
