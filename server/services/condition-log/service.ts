/**
 * Condition Log Service - Main Service Class
 */

import type { ConditionLogResult } from "./types.js";
import { getHealthGrade, getConditionRating, calculateDegradationRate, estimateRUL } from "./health-utils.js";
import { aggregateVibrationData, aggregateConditionData, getMonitoredEquipment } from "./aggregators.js";
import { getPreviousHealthIndex, createConditionLogEntry } from "./entry-creator.js";
import { getConditionLogHistory, getVesselConditionSummary } from "./queries.js";

export class ConditionLogService {
  private getHealthGrade = getHealthGrade;
  private getConditionRating = getConditionRating;
  private calculateDegradationRate = calculateDegradationRate;
  private estimateRUL = estimateRUL;

  async aggregateVibrationData(orgId: string, equipmentId: string, periodStart: Date, periodEnd: Date) {
    return aggregateVibrationData(orgId, equipmentId, periodStart, periodEnd);
  }

  async aggregateConditionData(orgId: string, equipmentId: string, periodStart: Date, periodEnd: Date) {
    return aggregateConditionData(orgId, equipmentId, periodStart, periodEnd);
  }

  async getPreviousHealthIndex(orgId: string, equipmentId: string, currentPeriodStart: Date) {
    return getPreviousHealthIndex(orgId, equipmentId, currentPeriodStart);
  }

  async createConditionLogEntry(orgId: string, vesselId: string, equipmentId: string, periodStart: Date, periodEnd: Date, periodType: 'hourly' | 'daily' = 'hourly') {
    return createConditionLogEntry(orgId, vesselId, equipmentId, periodStart, periodEnd, periodType);
  }

  async autoFillConditionLogs(orgId: string, vesselId: string, startDate: Date, endDate: Date, periodType: 'hourly' | 'daily' = 'hourly'): Promise<ConditionLogResult> {
    const result: ConditionLogResult = { success: true, recordsCreated: 0, errors: [] };

    try {
      const monitoredEquipment = await getMonitoredEquipment(vesselId);
      const periodMs = periodType === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      for (const equip of monitoredEquipment) {
        let currentStart = new Date(startDate);
        while (currentStart < endDate) {
          const currentEnd = new Date(currentStart.getTime() + periodMs);
          try {
            const logId = await createConditionLogEntry(orgId, vesselId, equip.id, currentStart, currentEnd > endDate ? endDate : currentEnd, periodType);
            if (logId) { result.recordsCreated++; }
          } catch (error) {
            result.errors.push(`Equipment ${equip.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
          currentStart = currentEnd;
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  async getConditionLogHistory(orgId: string, equipmentId: string, startDate: Date, endDate: Date, limit?: number) {
    return getConditionLogHistory(orgId, equipmentId, startDate, endDate, limit);
  }

  async getVesselConditionSummary(orgId: string, vesselId: string, startDate: Date, endDate: Date) {
    return getVesselConditionSummary(orgId, vesselId, startDate, endDate);
  }
}

export const conditionLogService = new ConditionLogService();
