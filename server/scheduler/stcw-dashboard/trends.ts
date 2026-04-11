/**
 * STCW Dashboard Trends - Historical compliance trend analysis
 */

import { vesselService } from '../../repositories';
import { checkMonthCompliance, calculateFatigueRisk } from '../../stcw-compliance';
import type { STCWTrends, TrendDataPoint } from './types';
import { getCacheKey, getFromCache, setCache } from './cache';
import { getCrewRestDataForVessel } from './data-fetcher';

interface TrendMetrics {
  totalCrew: number;
  compliantCrew: number;
  violations: number;
  warnings: number;
  highFatigueCrew: number;
  totalRest24h: number;
  crewWithData: number;
}

function processSingleCrew(
  crewId: string,
  crewName: string,
  days: any[],
  startStr: string,
  dateStr: string,
  metrics: TrendMetrics
): void {
  metrics.totalCrew++;

  const filteredDays = days.filter((d) => d.date >= startStr && d.date <= dateStr);
  if (filteredDays.length === 0) {return;}

  metrics.crewWithData++;
  const compliance = checkMonthCompliance(filteredDays);
  const fatigue = calculateFatigueRisk(crewId, filteredDays, crewName);

  if (compliance.ok) {metrics.compliantCrew++;}
  metrics.violations += compliance.days.filter((d) => !d.day_ok).length;
  metrics.warnings += compliance.days.filter((d) => !d.split_ok && d.day_ok).length;

  if (fatigue.riskLevel === 'high' || fatigue.riskLevel === 'critical') {
    metrics.highFatigueCrew++;
  }
  metrics.totalRest24h += fatigue.metrics.avgRestPer24h;
}

function collectMetricsForDate(
  allVesselData: Array<{ crewData: Map<string, { crewName: string; days: any[] }> }>,
  startStr: string,
  dateStr: string
): TrendMetrics {
  const metrics: TrendMetrics = {
    totalCrew: 0,
    compliantCrew: 0,
    violations: 0,
    warnings: 0,
    highFatigueCrew: 0,
    totalRest24h: 0,
    crewWithData: 0,
  };

  for (const { crewData } of allVesselData) {
    for (const [crewId, { crewName, days }] of crewData) {
      processSingleCrew(crewId, crewName, days, startStr, dateStr, metrics);
    }
  }

  return metrics;
}

function buildTrendDataPoint(dateStr: string, metrics: TrendMetrics): TrendDataPoint {
  return {
    date: dateStr,
    complianceRate: metrics.totalCrew > 0 ? (metrics.compliantCrew / metrics.totalCrew) * 100 : 100,
    violationCount: metrics.violations,
    warningCount: metrics.warnings,
    highFatigueRate: metrics.totalCrew > 0 ? (metrics.highFatigueCrew / metrics.totalCrew) * 100 : 0,
    avgRest24h: metrics.crewWithData > 0 ? metrics.totalRest24h / metrics.crewWithData : 0,
  };
}

function determineTrendDirection(
  avgSecond: number,
  avgFirst: number
): 'increasing' | 'stable' | 'decreasing' {
  if (avgSecond > avgFirst * 1.1) {return 'increasing';}
  if (avgSecond < avgFirst * 0.9) {return 'decreasing';}
  return 'stable';
}

function computeTrendSummary(trends: TrendDataPoint[]): {
  complianceRateChange: number;
  violationTrend: 'increasing' | 'stable' | 'decreasing';
  fatigueRiskTrend: 'increasing' | 'stable' | 'decreasing';
} {
  const firstHalf = trends.slice(0, Math.floor(trends.length / 2));
  const secondHalf = trends.slice(Math.floor(trends.length / 2));

  const avgViolationsFirst =
    firstHalf.length > 0 ? firstHalf.reduce((sum, t) => sum + t.violationCount, 0) / firstHalf.length : 0;
  const avgViolationsSecond =
    secondHalf.length > 0 ? secondHalf.reduce((sum, t) => sum + t.violationCount, 0) / secondHalf.length : 0;
  const avgFatigueFirst =
    firstHalf.length > 0 ? firstHalf.reduce((sum, t) => sum + t.highFatigueRate, 0) / firstHalf.length : 0;
  const avgFatigueSecond =
    secondHalf.length > 0 ? secondHalf.reduce((sum, t) => sum + t.highFatigueRate, 0) / secondHalf.length : 0;

  return {
    complianceRateChange:
      trends.length > 1 ? trends[trends.length - 1].complianceRate - trends[0].complianceRate : 0,
    violationTrend: determineTrendDirection(avgViolationsSecond, avgViolationsFirst),
    fatigueRiskTrend: determineTrendDirection(avgFatigueSecond, avgFatigueFirst),
  };
}

export async function getSTCWComplianceTrends(
  orgId: string,
  lookbackDays: number = 30,
  vesselId?: string
): Promise<STCWTrends> {
  const cacheKey = getCacheKey('stcw-trends', orgId, `${lookbackDays}:${vesselId || 'all'}`);
  const cached = getFromCache<STCWTrends>(cacheKey);
  if (cached) {return cached;}

  const startTime = Date.now();
  const trends: TrendDataPoint[] = [];
  const endDate = new Date();

  const dataPointCount = Math.min(lookbackDays, 30);
  const intervalDays = Math.max(1, Math.floor(lookbackDays / dataPointCount));

  const vessels = vesselId
    ? ([await vesselService.getVessel(orgId, vesselId)].filter(Boolean) as any[])
    : await vesselService.getVessels(orgId);

  const fullRangeStart = new Date(endDate);
  fullRangeStart.setDate(fullRangeStart.getDate() - lookbackDays - 7);
  const fullStartStr = fullRangeStart.toISOString().split('T')[0];
  const fullEndStr = endDate.toISOString().split('T')[0];

  const vesselDataPromises = vessels.map((vessel) =>
    getCrewRestDataForVessel(orgId, vessel.id, fullStartStr, fullEndStr).then((crewData) => ({
      vessel,
      crewData,
    }))
  );
  const allVesselData = await Promise.all(vesselDataPromises);

  for (let i = dataPointCount - 1; i >= 0; i--) {
    const pointDate = new Date(endDate);
    pointDate.setDate(pointDate.getDate() - i * intervalDays);
    const dateStr = pointDate.toISOString().split('T')[0];

    const weekStartDate = new Date(pointDate);
    weekStartDate.setDate(weekStartDate.getDate() - 7);
    const startStr = weekStartDate.toISOString().split('T')[0];

    const metrics = collectMetricsForDate(allVesselData, startStr, dateStr);
    trends.push(buildTrendDataPoint(dateStr, metrics));
  }

  const summary = computeTrendSummary(trends);

  const result: STCWTrends = {
    orgId,
    vesselId,
    lookbackDays,
    calculatedAt: new Date().toISOString(),
    trends,
    summary,
  };

  setCache(cacheKey, result);

  const duration = Date.now() - startTime;
  if (duration > 500) {
    console.log(
      `[STCW Trends] Computed in ${duration}ms (${vessels.length} vessels, ${dataPointCount} data points)`
    );
  }

  return result;
}
