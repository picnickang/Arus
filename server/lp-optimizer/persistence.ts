/**
 * LP Optimizer - Database Persistence
 */

import { db } from "../db.js";
import { eq } from "drizzle-orm";
import { optimizationResults, scheduleOptimizations } from "../../shared/schema.js";
import type { OptimizationResult, OptimizationConstraints } from "./types.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("LpOptimizer:Persistence");

export async function persistOptimizationResults(
  orgId: string,
  result: OptimizationResult,
  constraints: OptimizationConstraints
): Promise<string> {
  try {
    const optimizationRecord = await db
      .insert(optimizationResults)
      .values({
        orgId,
        configurationId: "lp-optimizer-config",
        runStatus: result.success ? "completed" : "failed",
        startTime: new Date(Date.now() - result.optimizationTime),
        endTime: new Date(),
        executionTimeMs: result.optimizationTime,
        equipmentScope: JSON.stringify([]),
        timeHorizon: constraints.timeHorizonDays,
        totalSchedules: result.schedule.length,
        totalCostEstimate: result.resourceUtilization.totalCost,
        costSavings: 0,
        resourceUtilization: JSON.stringify(result.resourceUtilization),
        conflictsResolved: 0,
        optimizationScore: result.success ? 85 : 0,
        algorithmMetrics: JSON.stringify({
          feasible: result.constraints.feasible,
          violations: result.constraints.violations,
          objectiveValue: result.objectiveValue,
        }),
        recommendations: JSON.stringify(
          result.schedule.map((s) => ({
            equipmentId: s.equipmentId,
            assignedCrew: s.assignedCrew,
            scheduledDate: s.scheduledDate,
            estimatedCost: s.estimatedCost,
          }))
        ),
        appliedToProduction: false,
      })
      .returning({ id: optimizationResults.id });

    const resultId = optimizationRecord[0].id;
    logger.info(`[LP Optimizer] Persisted optimization result ${resultId}`);

    for (const scheduleItem of result.schedule) {
      await db.insert(scheduleOptimizations).values({
        orgId,
        optimizationResultId: resultId,
        equipmentId: scheduleItem.equipmentId,
        recommendedScheduleDate: scheduleItem.scheduledDate,
        recommendedMaintenanceType: "predictive",
        recommendedPriority: scheduleItem.priority,
        estimatedDuration: scheduleItem.duration,
        estimatedCost: scheduleItem.estimatedCost,
        assignedTechnicianId: scheduleItem.assignedCrew,
        requiredParts: JSON.stringify([]),
        optimizationReason: `LP optimization assigned to ${scheduleItem.assignedCrew} at ${scheduleItem.startTime}`,
        conflictsWith: JSON.stringify([]),
        priority: scheduleItem.priority * 25,
        status: "pending",
      });
    }

    logger.info(`[LP Optimizer] Persisted ${result.schedule.length} schedule optimizations`);
    return resultId;
  } catch (error) {
    logger.error(`[LP Optimizer] Error persisting results:`, undefined, error);
    return `error-${Date.now()}`;
  }
}

export async function getOptimizationResults(resultId: string): Promise<any> {
  try {
    const optimizationRecord = await db
      .select()
      .from(optimizationResults)
      .where(eq(optimizationResults.id, resultId))
      .limit(1);

    if (optimizationRecord.length === 0) {
      throw new Error(`Optimization result ${resultId} not found`);
    }

    const result = optimizationRecord[0];

    const scheduleRecords = await db
      .select()
      .from(scheduleOptimizations)
      .where(eq(scheduleOptimizations.optimizationResultId, resultId));

    return {
      success: result.runStatus === "completed",
      optimizationId: result.id,
      executionTime: result.executionTimeMs,
      totalCost: result.totalCostEstimate,
      totalSchedules: result.totalSchedules,
      optimizationScore: result.optimizationScore,
      resourceUtilization: JSON.parse(result.resourceUtilization || "{}"),
      algorithmMetrics: JSON.parse(result.algorithmMetrics || "{}"),
      recommendations: JSON.parse(result.recommendations || "[]"),
      schedules: scheduleRecords.map((schedule) => ({
        equipmentId: schedule.equipmentId,
        scheduledDate: schedule.recommendedScheduleDate,
        maintenanceType: schedule.recommendedMaintenanceType,
        priority: schedule.recommendedPriority,
        duration: schedule.estimatedDuration,
        cost: schedule.estimatedCost,
        assignedTechnician: schedule.assignedTechnicianId,
        reason: schedule.optimizationReason,
        status: schedule.status,
      })),
      createdAt: result.createdAt,
      appliedToProduction: result.appliedToProduction,
    };
  } catch (error) {
    logger.error(`[LP Optimizer] Error retrieving results ${resultId}:`, undefined, error);
    throw error;
  }
}
