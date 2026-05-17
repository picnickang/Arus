/**
 * LP Optimizer - Main Optimizer Class
 */

const solver: any = require("javascript-lp-solver");
import type { OptimizationConstraints, OptimizationResult } from "./types.js";
import { getPendingMaintenanceJobs, getPartsAvailability } from "./job-loader.js";
import { formulateLinearProgram, relaxConstraints, processSolution } from "./lp-formulation.js";
import { createEmptyResult } from "./estimation-helpers.js";
import { recordOptimizationMetrics, recordEmptyRun, recordErrorRun } from "./metrics-recorder.js";
import { persistOptimizationResults, getOptimizationResults as getResults } from "./persistence.js";
import { optimizerRelaxations } from "../observability/optimizer-metrics.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("LpOptimizer:Optimizer");

export class LinearProgrammingOptimizer {
  private orgId: string;

  constructor(orgId: string) {
    this.orgId = orgId;
  }

  async optimizeMaintenanceSchedule(
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      logger.info(`[LP Optimizer] Starting optimization for org ${this.orgId}`);

      const jobs = await getPendingMaintenanceJobs(this.orgId);
      const crewData = constraints.crewAvailability;
      const partsData = await getPartsAvailability(this.orgId);

      if (jobs.length === 0) {
        logger.info(`[LP Optimizer] No pending maintenance jobs found`);
        const emptyResult = createEmptyResult(Date.now() - startTime);
        recordEmptyRun(this.orgId, Date.now() - startTime);
        return emptyResult;
      }

      const lpProblem = formulateLinearProgram(jobs, constraints, partsData);

      logger.info(`[LP Optimizer] Formulated LP problem with ${jobs.length} jobs and ${crewData.length} crew members`);

      const solution = solver.solve(lpProblem);

      if (!solution.feasible) {
        logger.info(`[LP Optimizer] Problem infeasible - relaxing constraints`);
        optimizerRelaxations.inc({ org_id: this.orgId });

        const relaxedProblem = relaxConstraints(lpProblem);
        const relaxedSolution = solver.solve(relaxedProblem);
        const result = processSolution(
          relaxedSolution,
          jobs,
          constraints,
          Date.now() - startTime,
          true
        );

        recordOptimizationMetrics(this.orgId, result, jobs);
        return result;
      }

      const result = processSolution(solution, jobs, constraints, Date.now() - startTime, false);

      recordOptimizationMetrics(this.orgId, result, jobs);

      if (result.success) {
        await persistOptimizationResults(this.orgId, result, constraints);
      }

      return result;
    } catch (error: any) {
      logger.error(`[LP Optimizer] Error during optimization:`, undefined, error);

      const duration = Date.now() - startTime;
      recordErrorRun(this.orgId, duration);

      const errorResult: OptimizationResult = {
        success: false,
        objectiveValue: 0,
        schedule: [],
        resourceUtilization: {
          crewUtilization: [],
          dailyWorkload: [],
          totalCost: 0,
          partsUsedBudget: 0,
        },
        constraints: {
          feasible: false,
          violations: [`Optimization error: ${error.message}`],
        },
        optimizationTime: duration,
        optimizationId: `error-${Date.now()}`,
      };

      await persistOptimizationResults(this.orgId, errorResult, constraints);
      return errorResult;
    }
  }

  async getOptimizationResults(resultId: string): Promise<any> {
    return getResults(resultId);
  }
}
