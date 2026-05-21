/**
 * Cost Summary Report Generator
 * Generates maintenance cost analysis report
 */

import { vesselService, workOrderService } from "../../../repositories";
import type { ICostSummaryGenerator } from "../domain/ports.js";
import type { CostSummaryData, VesselCostSummary, CategoryCost } from "../domain/types.js";
import { logger } from "../../../utils/logger.js";

const LOG_CTX = "CostSummaryGenerator";

export class CostSummaryGenerator implements ICostSummaryGenerator {
  readonly reportType = "cost_summary" as const;

  async generate(orgId: string, vesselIds: string[] | null): Promise<CostSummaryData> {
    logger.info(LOG_CTX, `Generating cost summary report for org ${orgId}`);

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const costByVessel = await this.getVesselCosts(orgId, vesselIds, thirtyDaysAgo, now);
      const costByCategory = await this.getCategoryCosts(orgId, vesselIds, thirtyDaysAgo, now);
      const totalMaintenanceCost = costByVessel.reduce((sum, v) => sum + v.actualCost, 0);
      const savingsFromPredictive = this.estimatePredictiveSavings(totalMaintenanceCost);

      return {
        totalMaintenanceCost,
        costByVessel,
        costByCategory,
        savingsFromPredictive,
        period: { start: thirtyDaysAgo, end: now },
      };
    } catch (error) {
      logger.error(LOG_CTX, "Failed to generate cost summary report", String(error));
      return {
        totalMaintenanceCost: 0,
        costByVessel: [],
        costByCategory: [],
        savingsFromPredictive: 0,
        period: { start: new Date(), end: new Date() },
      };
    }
  }

  private async getVesselCosts(
    orgId: string,
    vesselIds: string[] | null,
    startDate: Date,
    endDate: Date
  ): Promise<VesselCostSummary[]> {
    try {
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const summaries: VesselCostSummary[] = [];

      for (const vessel of filteredVessels) {
        const workOrders = await workOrderService.getWorkOrdersWithDetails(undefined, orgId, {
          vesselId: vessel.id,
          status: "completed",
        });

        let plannedCost = 0;
        let actualCost = 0;

        for (const wo of workOrders) {
          const w = wo as object as Record<string, unknown>;
          const completedDate = w.actualEndDate ? new Date(w.actualEndDate as string | Date) : null;
          if (completedDate && completedDate >= startDate && completedDate <= endDate) {
            const plannedRate = Number(w.estimatedCostPerHour ?? 0) || 0;
            const actualRate = Number(w.actualCostPerHour ?? plannedRate) || 0;
            const plannedHours = Number(w.estimatedHours ?? 0) || 0;
            const actualHours = Number(w.actualHours ?? plannedHours) || 0;
            plannedCost += plannedRate * plannedHours;
            actualCost += actualRate * actualHours;
          }
        }

        summaries.push({
          vesselId: vessel.id,
          vesselName: vessel.name,
          plannedCost,
          actualCost,
          variance: actualCost - plannedCost,
        });
      }

      return summaries.sort((a, b) => b.actualCost - a.actualCost);
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get vessel costs", String(error));
      return [];
    }
  }

  private async getCategoryCosts(
    orgId: string,
    vesselIds: string[] | null,
    startDate: Date,
    endDate: Date
  ): Promise<CategoryCost[]> {
    try {
      const categoryTotals: Record<string, number> = {};
      const allVessels = await vesselService.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      for (const vessel of filteredVessels) {
        const workOrders = await workOrderService.getWorkOrdersWithDetails(undefined, orgId, {
          vesselId: vessel.id,
          status: "completed",
        });

        for (const wo of workOrders) {
          const w = wo as object as Record<string, unknown>;
          const completedDate = w.actualEndDate ? new Date(w.actualEndDate as string | Date) : null;
          if (completedDate && completedDate >= startDate && completedDate <= endDate) {
            const category = (w.workOrderType as string) || "Other";
            const rate = Number(w.actualCostPerHour ?? w.estimatedCostPerHour ?? 0) || 0;
            const hours = Number(w.actualHours ?? w.estimatedHours ?? 0) || 0;
            const cost = rate * hours;
            categoryTotals[category] = (categoryTotals[category] || 0) + cost;
          }
        }
      }

      const total = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

      return Object.entries(categoryTotals)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
    } catch (error) {
      logger.error(LOG_CTX, "Failed to get category costs", String(error));
      return [];
    }
  }

  private estimatePredictiveSavings(totalCost: number): number {
    return Math.round(totalCost * 0.15);
  }
}
