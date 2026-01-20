/**
 * STCW Dashboard Fleet Summary - Fleet-wide STCW compliance aggregation
 */

import { storage } from '../../storage';
import { checkMonthCompliance, calculateFatigueRisk } from '../../stcw-compliance';
import type { FleetSTCWSummary, VesselComplianceSummary } from './types';
import { getCacheKey, getFromCache, setCache } from './cache';
import { getDateRange, getCrewRestDataForVessel } from './data-fetcher';

interface VesselMetrics {
  compliantCrew: number;
  violations: number;
  warnings: number;
  highFatigue: number;
  criticalFatigue: number;
  totalRest24h: number;
  totalRest7d: number;
  crewWithData: number;
}

interface FleetMetrics {
  totalCrew: number;
  compliantCrew: number;
  totalViolations: number;
  totalWarnings: number;
  highFatigue: number;
  criticalFatigue: number;
  totalRest24h: number;
  totalRest7d: number;
  crewWithRestData: number;
}

function processCrewFatigueIssues(
  crewId: string,
  crewName: string,
  vesselId: string,
  fatigue: any,
  vesselMetrics: VesselMetrics,
  topIssues: FleetSTCWSummary['topIssues']
): void {
  if (fatigue.riskLevel === 'high') {
    vesselMetrics.highFatigue++;
    topIssues.push({
      crewId, crewName, vesselId,
      issueType: 'high_fatigue',
      description: `High fatigue risk (score: ${fatigue.score})`,
      severity: 'warning',
    });
  } else if (fatigue.riskLevel === 'critical') {
    vesselMetrics.criticalFatigue++;
    topIssues.push({
      crewId, crewName, vesselId,
      issueType: 'critical_fatigue',
      description: `Critical fatigue risk (score: ${fatigue.score})`,
      severity: 'critical',
    });
  }
}

function processCrewViolations(
  crewId: string,
  crewName: string,
  vesselId: string,
  compliance: any,
  topIssues: FleetSTCWSummary['topIssues']
): void {
  const violationDays = compliance.days.filter((d: any) => !d.day_ok);
  for (const v of violationDays.slice(0, 2)) {
    topIssues.push({
      crewId, crewName, vesselId,
      issueType: 'violation',
      description: `${v.min_rest_24}h rest on ${v.date} (min 10h required)`,
      severity: 'critical',
    });
  }
}

function processVesselCrew(
  vessel: any,
  crewData: Map<string, { crewName: string; days: any[] }>,
  vesselMetrics: VesselMetrics,
  topIssues: FleetSTCWSummary['topIssues']
): void {
  for (const [crewId, { crewName, days }] of crewData) {
    if (days.length === 0) {continue;}

    vesselMetrics.crewWithData++;

    const compliance = checkMonthCompliance(days);
    const fatigue = calculateFatigueRisk(crewId, days, crewName);

    const dayViolations = compliance.days.filter((d) => !d.day_ok).length;
    const rollingViolations = compliance.rolling7d.filter((r) => !r.ok).length;
    const totalCrewViolations = dayViolations + rollingViolations;
    const totalCrewWarnings = compliance.days.filter((d) => !d.split_ok && d.day_ok).length;

    if (compliance.ok) {vesselMetrics.compliantCrew++;}
    vesselMetrics.violations += totalCrewViolations;
    vesselMetrics.warnings += totalCrewWarnings;

    processCrewFatigueIssues(crewId, crewName, vessel.id, fatigue, vesselMetrics, topIssues);

    if (totalCrewViolations > 0) {
      processCrewViolations(crewId, crewName, vessel.id, compliance, topIssues);
    }

    vesselMetrics.totalRest24h += fatigue.metrics.avgRestPer24h;
    vesselMetrics.totalRest7d += fatigue.metrics.avgRestPer7d;
  }
}

function buildVesselSummary(vessel: any, crewData: Map<string, any>, vesselMetrics: VesselMetrics): VesselComplianceSummary {
  const vesselCrewCount = crewData.size;
  return {
    vesselId: vessel.id,
    vesselName: vessel.name,
    totalCrew: vesselCrewCount,
    compliantCrew: vesselMetrics.compliantCrew,
    complianceRate: vesselCrewCount > 0 ? (vesselMetrics.compliantCrew / vesselCrewCount) * 100 : 100,
    violationCount: vesselMetrics.violations,
    warningCount: vesselMetrics.warnings,
    highFatigueCount: vesselMetrics.highFatigue,
    criticalFatigueCount: vesselMetrics.criticalFatigue,
    avgRestPer24h: vesselMetrics.crewWithData > 0 ? vesselMetrics.totalRest24h / vesselMetrics.crewWithData : 0,
    avgRestPer7d: vesselMetrics.crewWithData > 0 ? vesselMetrics.totalRest7d / vesselMetrics.crewWithData : 0,
  };
}

function sortTopIssues(topIssues: FleetSTCWSummary['topIssues']): void {
  topIssues.sort((a, b) => {
    if (a.severity !== b.severity) {return a.severity === 'critical' ? -1 : 1;}
    return a.issueType === 'critical_fatigue' ? -1 : 1;
  });
}

export async function getFleetSTCWSummary(
  orgId: string,
  lookbackDays: number = 30
): Promise<FleetSTCWSummary> {
  const cacheKey = getCacheKey('fleet-stcw', orgId, String(lookbackDays));
  const cached = getFromCache<FleetSTCWSummary>(cacheKey);
  if (cached) {return cached;}

  const { startDate, endDate } = getDateRange(lookbackDays);
  const vessels = await storage.getVessels(orgId);

  const vesselDataPromises = vessels.map((vessel) =>
    getCrewRestDataForVessel(orgId, vessel.id, startDate, endDate).then((crewData) => ({ vessel, crewData }))
  );
  const vesselDataResults = await Promise.all(vesselDataPromises);

  const vesselSummaries: VesselComplianceSummary[] = [];
  const topIssues: FleetSTCWSummary['topIssues'] = [];
  const fleetMetrics: FleetMetrics = {
    totalCrew: 0, compliantCrew: 0, totalViolations: 0, totalWarnings: 0,
    highFatigue: 0, criticalFatigue: 0, totalRest24h: 0, totalRest7d: 0, crewWithRestData: 0,
  };

  for (const { vessel, crewData } of vesselDataResults) {
    const vesselMetrics: VesselMetrics = {
      compliantCrew: 0, violations: 0, warnings: 0, highFatigue: 0,
      criticalFatigue: 0, totalRest24h: 0, totalRest7d: 0, crewWithData: 0,
    };

    processVesselCrew(vessel, crewData, vesselMetrics, topIssues);

    fleetMetrics.totalCrew += crewData.size;
    fleetMetrics.compliantCrew += vesselMetrics.compliantCrew;
    fleetMetrics.totalViolations += vesselMetrics.violations;
    fleetMetrics.totalWarnings += vesselMetrics.warnings;
    fleetMetrics.highFatigue += vesselMetrics.highFatigue;
    fleetMetrics.criticalFatigue += vesselMetrics.criticalFatigue;
    fleetMetrics.totalRest24h += vesselMetrics.totalRest24h;
    fleetMetrics.totalRest7d += vesselMetrics.totalRest7d;
    fleetMetrics.crewWithRestData += vesselMetrics.crewWithData;

    vesselSummaries.push(buildVesselSummary(vessel, crewData, vesselMetrics));
  }

  sortTopIssues(topIssues);

  const result: FleetSTCWSummary = {
    orgId,
    lookbackDays,
    calculatedAt: new Date().toISOString(),
    fleet: {
      totalVessels: vessels.length,
      totalCrew: fleetMetrics.totalCrew,
      compliantCrew: fleetMetrics.compliantCrew,
      overallComplianceRate: fleetMetrics.totalCrew > 0 ? (fleetMetrics.compliantCrew / fleetMetrics.totalCrew) * 100 : 100,
      totalViolations: fleetMetrics.totalViolations,
      totalWarnings: fleetMetrics.totalWarnings,
      highFatigueCount: fleetMetrics.highFatigue,
      criticalFatigueCount: fleetMetrics.criticalFatigue,
      avgRestPer24h: fleetMetrics.crewWithRestData > 0 ? fleetMetrics.totalRest24h / fleetMetrics.crewWithRestData : 0,
      avgRestPer7d: fleetMetrics.crewWithRestData > 0 ? fleetMetrics.totalRest7d / fleetMetrics.crewWithRestData : 0,
    },
    vessels: vesselSummaries,
    topIssues: topIssues.slice(0, 10),
  };

  setCache(cacheKey, result);
  return result;
}
