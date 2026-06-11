/**
 * Sync Jobs - Main Orchestrator
 * Runs all data integrity checks
 */

import type { DataIssue, ReconciliationResult } from "./types.js";
import { checkPartsStockAlignment } from "./parts-stock.js";
import { checkReservationOverflow } from "./reservations.js";
import { checkWorkOrdersPendingOnPO } from "./purchase-orders.js";
import { checkCrewCertificationExpiry } from "./certifications.js";
import { checkSensorThresholdConflicts } from "./thresholds.js";
import { getReconciliationSummary as getSummary } from "./metrics.js";
import { createLogger } from "../lib/structured-logger";
const logger = createLogger("SyncJobs:Index");

export type { DataIssue, ReconciliationResult, SyncJobCheckResult } from "./types.js";
export { checkPartsStockAlignment } from "./parts-stock.js";
export { checkReservationOverflow } from "./reservations.js";
export { checkWorkOrdersPendingOnPO } from "./purchase-orders.js";
export { checkCrewCertificationExpiry } from "./certifications.js";
export { checkSensorThresholdConflicts } from "./thresholds.js";
export { rollupDailyMetric } from "./metrics.js";

/**
 * Main reconciliation function that runs all data integrity checks
 */
export async function reconcileAll(orgId: string): Promise<ReconciliationResult> {
  const startTime = Date.now();
  const issues: DataIssue[] = [];
  let checkedEntities = 0;

  try {
    try {
      const partsStockIssues = await checkPartsStockAlignment(orgId);
      issues.push(...partsStockIssues.issues);
      checkedEntities += partsStockIssues.entitiesChecked;
    } catch (error: unknown) {
      logger.warn("[Reconciliation] Parts-stock alignment check failed:", { details: (error instanceof Error ? error.message : String(error)) });
      issues.push({
        code: "PARTS_STOCK_CHECK_UNAVAILABLE",
        message: `Parts-stock alignment check temporarily unavailable: ${(error instanceof Error ? error.message : String(error))}`,
        severity: "low",
      });
    }

    try {
      const reservationIssues = await checkReservationOverflow(orgId);
      issues.push(...reservationIssues.issues);
      checkedEntities += reservationIssues.entitiesChecked;
    } catch (error: unknown) {
      logger.warn("[Reconciliation] Reservation overflow check failed:", { details: (error instanceof Error ? error.message : String(error)) });
      issues.push({
        code: "RESERVATION_CHECK_UNAVAILABLE",
        message: `Reservation overflow check temporarily unavailable: ${(error instanceof Error ? error.message : String(error))}`,
        severity: "low",
      });
    }

    try {
      const purchaseOrderIssues = await checkWorkOrdersPendingOnPO(orgId);
      issues.push(...purchaseOrderIssues.issues);
      checkedEntities += purchaseOrderIssues.entitiesChecked;
    } catch (error: unknown) {
      logger.warn("[Reconciliation] Purchase order dependency check failed:", { details: (error instanceof Error ? error.message : String(error)) });
      issues.push({
        code: "PO_DEPENDENCY_CHECK_UNAVAILABLE",
        message: `Purchase order dependency check temporarily unavailable: ${(error instanceof Error ? error.message : String(error))}`,
        severity: "low",
      });
    }

    try {
      const certificationIssues = await checkCrewCertificationExpiry(orgId);
      issues.push(...certificationIssues.issues);
      checkedEntities += certificationIssues.entitiesChecked;
    } catch (error: unknown) {
      logger.warn("[Reconciliation] Crew certification check failed:", { details: (error instanceof Error ? error.message : String(error)) });
      issues.push({
        code: "CERTIFICATION_CHECK_UNAVAILABLE",
        message: `Crew certification expiry check temporarily unavailable: ${(error instanceof Error ? error.message : String(error))}`,
        severity: "low",
      });
    }

    try {
      const thresholdIssues = await checkSensorThresholdConflicts(orgId);
      issues.push(...thresholdIssues.issues);
      checkedEntities += thresholdIssues.entitiesChecked;
    } catch (error: unknown) {
      logger.warn("[Reconciliation] Sensor threshold conflict check failed:", { details: (error instanceof Error ? error.message : String(error)) });
      issues.push({
        code: "THRESHOLD_CHECK_UNAVAILABLE",
        message: `Sensor threshold conflict check temporarily unavailable: ${(error instanceof Error ? error.message : String(error))}`,
        severity: "low",
      });
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      success: true,
      issues,
      stats: {
        totalIssues: issues.length,
        criticalIssues: issues.filter((i) => i.severity === "critical").length,
        checkedEntities,
        executionTimeMs,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error("Reconciliation failed:", undefined, error);
    return {
      success: false,
      issues: [
        {
          code: "RECONCILIATION_ERROR",
          message: `Reconciliation process failed: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : "Unknown error"}`,
          severity: "critical",
        },
      ],
      stats: {
        totalIssues: 1,
        criticalIssues: 1,
        checkedEntities,
        executionTimeMs: Date.now() - startTime,
      },
      timestamp: new Date(),
    };
  }
}

/**
 * Get recent reconciliation summary for dashboard
 */
export async function getReconciliationSummary(orgId: string): Promise<{
  lastRun: Date | null;
  totalIssues: number;
  criticalIssues: number;
  recentActivity: string[];
}> {
  return getSummary(orgId, reconcileAll);
}
