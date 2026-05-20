import { db } from "../../../db";
import { workOrders, costSavings, failurePredictions } from "@shared/schema-runtime";
import { IS_POSTGRES } from "@shared/schema-runtime";
import { failureHistory as failureHistoryPg, type InsertFailureHistory } from "@shared/schema/ml-analytics-core";
import { eq, and, sql, ne } from "drizzle-orm";
import { processWorkOrderCompletion } from "../../../cost-savings-engine/persistence";
import type {
  IWorkOrderWorkflowRepository,
  ICostSavingsPort,
  IPredictionFeedbackPort,
  ILegacyCompletionPort,
  IWorkOrderEventPort,
  IFailureHistoryPort,
  FailureHistoryRecordInput,
  WorkOrderWithWorkflowContext,
  LegacyCompletionData,
} from "../domain/workflow-ports";
import type {
  QuickWorkOrderInput,
  QuickWorkOrderResult,
  CompletionPredictionFeedback,
} from "../domain/workflow-types";
import { projectFailureHistory } from "../../../graph/projector";
import { createLogger } from "../../../lib/structured-logger";

const failureHistoryLogger = createLogger("Domains:WorkOrders:Infrastructure:FailureHistoryAdapter");

export class WorkOrderWorkflowRepositoryAdapter implements IWorkOrderWorkflowRepository {
  async createQuick(orgId: string, input: QuickWorkOrderInput): Promise<QuickWorkOrderResult> {
    const woNumber = await this.nextWorkOrderNumber(orgId);

    const [row] = await db
      .insert(workOrders)
      .values({
        orgId,
        equipmentId: input.equipmentId,
        vesselId: input.vesselId || null,
        description: input.description,
        reason: input.description,
        priority: input.priority === "high" ? 1 : input.priority === "medium" ? 2 : 3,
        status: "open",
        maintenanceType: "corrective",
        woNumber,
      } as any)
      .returning({
        id: workOrders.id,
      });

    return {
      id: row.id,
      workOrderNumber: woNumber,
      status: "open",
      createdVia: "quick_mobile",
      queuedOffline: false,
    };
  }

  async findById(id: string, orgId: string): Promise<WorkOrderWithWorkflowContext | null> {
    const [row] = await db
      .select({
        id: workOrders.id,
        workOrderNumber: workOrders.woNumber,
        equipmentId: workOrders.equipmentId,
        vesselId: workOrders.vesselId,
        status: workOrders.status,
        maintenanceType: workOrders.maintenanceType,
        costJustification: workOrders.costJustification,
        totalCost: workOrders.totalCost,
        totalLaborCost: workOrders.totalLaborCost,
        totalPartsCost: workOrders.totalPartsCost,
      })
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      workOrderNumber: row.workOrderNumber || "",
      equipmentId: row.equipmentId,
      vesselId: row.vesselId || null,
      status: row.status,
      maintenanceType: row.maintenanceType || null,
      predictionId: null,
      costJustification: row.costJustification || null,
      estimatedRepairCost: null,
      estimatedFailureCost: null,
      totalCost: row.totalCost || null,
      totalLaborCost: row.totalLaborCost || null,
      totalPartsCost: row.totalPartsCost || null,
    };
  }

  async updateStatus(
    id: string,
    orgId: string,
    newStatus: string,
    _updatedBy?: string
  ): Promise<boolean> {
    const result = await db
      .update(workOrders)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === "completed" ? { completedAt: new Date() } : {}),
      } as any)
      .where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)))
      .returning({ id: workOrders.id });

    return result.length > 0;
  }

  async nextWorkOrderNumber(orgId: string): Promise<string> {
    const [result] = await db
      .execute(
        sql`
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(wo_number FROM 'WO-([0-9]+)') AS INTEGER)),
        0
      ) + 1 AS next_num
      FROM work_orders
      WHERE org_id = ${orgId}
    `
      )
      .then((r: any) => r.rows || r);

    return `WO-${String(result?.next_num || 1).padStart(5, "0")}`;
  }

  async isPredictive(id: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ maintenanceType: workOrders.maintenanceType })
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.orgId, orgId)))
      .limit(1);

    if (row?.maintenanceType === "predictive") {
      return true;
    }

    const [pred] = await db
      .select({ id: failurePredictions.id })
      .from(failurePredictions)
      .where(eq(failurePredictions.resolvedByWorkOrderId, id))
      .limit(1);

    return !!pred;
  }
}

export class CostSavingsWorkflowAdapter implements ICostSavingsPort {
  async processCompletion(
    workOrderId: string,
    orgId: string
  ): Promise<{ saved: boolean; savingsId?: string }> {
    const result = await processWorkOrderCompletion(workOrderId, orgId);
    return { saved: result.saved };
  }

  async voidForWorkOrder(
    workOrderId: string,
    orgId: string,
    reason: string,
    changedBy?: string
  ): Promise<number> {
    const result = await db
      .update(costSavings)
      .set({
        validationStatus: "voided",
        validationReason: reason,
        validationChangedBy: changedBy ?? "system",
        validationChangedAt: new Date(),
      })
      .where(
        and(
          eq(costSavings.workOrderId, workOrderId),
          eq(costSavings.orgId, orgId),
          ne(costSavings.validationStatus, "voided")
        )
      )
      .returning({ id: costSavings.id });

    return result.length;
  }

  async updateValidation(
    workOrderId: string,
    orgId: string,
    status: "valid" | "disputed" | "voided",
    reason: string,
    changedBy: string
  ): Promise<boolean> {
    const result = await db
      .update(costSavings)
      .set({
        validationStatus: status,
        validationReason: reason,
        validationChangedBy: changedBy,
        validationChangedAt: new Date(),
      })
      .where(and(eq(costSavings.workOrderId, workOrderId), eq(costSavings.orgId, orgId)))
      .returning({ id: costSavings.id });

    return result.length > 0;
  }
}

export class LegacyCompletionAdapter implements ILegacyCompletionPort {
  async completeWorkOrder(
    workOrderId: string,
    completionData: LegacyCompletionData,
    orgId: string,
    userId?: string
  ): Promise<void> {
    const { workOrderService } = await import("../../../services/domains/work-order-service");
    const completionRecord = {
      workOrderId,
      orgId,
      equipmentId: completionData.equipmentId || "unknown",
      vesselId: completionData.vesselId || null,
      completedAt: completionData.completedAt || new Date(),
      completedBy: userId || completionData.completedBy || null,
      actualDowntimeHours: completionData.actualDowntimeHours || 0,
      completionNotes: completionData.completionNotes || null,
      notes: completionData.notes || completionData.completionNotes || null,
      partsUsed: completionData.partsUsed || undefined,
      partsCount: completionData.partsCount || 0,
      qualityCheckPassed: completionData.qualityCheckPassed,
      actualDurationHours: completionData.actualDurationHours,
    };
    await workOrderService.completeWorkOrder(workOrderId, completionRecord);
  }

  async aggregateProcurementCosts(workOrderId: string, orgId: string): Promise<void> {
    const { aggregateProcurementCostsToWorkOrder } = await import("../../../cost-savings-engine");
    await aggregateProcurementCostsToWorkOrder(workOrderId, orgId);
  }
}

export class WorkOrderEventAdapter implements IWorkOrderEventPort {
  async emitCompleted(
    workOrderId: string,
    orgId: string,
    completedBy: string,
    actualHours?: number,
    completionNotes?: string
  ): Promise<void> {
    const { workOrderEventPublisher } = await import("./event-publisher-adapter");
    await workOrderEventPublisher.publish({
      type: "WORK_ORDER_COMPLETED",
      workOrderId,
      orgId,
      completedBy,
      actualHours,
      completionNotes,
      timestamp: new Date(),
    });
  }

  async emitStatusChanged(
    workOrderId: string,
    orgId: string,
    previousStatus: string,
    newStatus: string,
    changedBy?: string
  ): Promise<void> {
    const { workOrderEventPublisher } = await import("./event-publisher-adapter");
    await workOrderEventPublisher.publish({
      type: "WORK_ORDER_STATUS_CHANGED",
      workOrderId,
      orgId,
      previousStatus,
      newStatus,
      changedBy,
      timestamp: new Date(),
    });
  }
}

export class PredictionFeedbackWorkflowAdapter implements IPredictionFeedbackPort {
  async recordFeedback(
    feedback: CompletionPredictionFeedback,
    orgId: string,
    userId: string
  ): Promise<void> {
    if (feedback.predictionId) {
      try {
        await db.execute(sql`
          INSERT INTO prediction_feedback (
            org_id, prediction_id, equipment_id, user_id,
            feedback_type, is_accurate, comments, created_at
          )
          SELECT
            ${orgId},
            ${Number(feedback.predictionId)},
            wo.equipment_id,
            ${userId},
            ${feedback.outcome},
            ${feedback.outcome !== "false_alarm"},
            ${feedback.notes || `WO completion feedback: ${feedback.outcome}`},
            NOW()
          FROM work_orders wo
          WHERE wo.id = ${feedback.workOrderId}
          ON CONFLICT DO NOTHING
        `);
      } catch {
        const feedbackNote = `\n[Prediction feedback: ${feedback.outcome}]`;
        await db
          .update(workOrders)
          .set({
            description: sql`COALESCE(description, '') || ${feedbackNote}`,
          } as any)
          .where(eq(workOrders.id, feedback.workOrderId));
      }
    }
  }
}

/**
 * Failure-history adapter — inserts a failure_history row when a work
 * order is completed with a closeout cause, then fires the graph
 * projector post-commit so the knowledge graph stays in lockstep with
 * relational truth (Task #80).
 *
 * Contract: best-effort. A failure here must NEVER break the work-order
 * completion flow that already succeeded.
 */
export class FailureHistoryAdapter implements IFailureHistoryPort {
  async recordFailure(input: FailureHistoryRecordInput): Promise<void> {
    // SQLite (local/vessel) mode uses a DIFFERENT `failure_history`
    // schema (failureDate/failureType/severity, text PK) that the
    // Push-A1 PdM aggregation does not consume. Cross-vessel pattern
    // queries only run against the cloud Postgres deployment, so
    // gate the insert + projection on the Postgres runtime to avoid
    // corrupting the SQLite table with PG-shaped column writes.
    if (!IS_POSTGRES) {
      return;
    }
    try {
      const failureTimestamp = input.recordedAt ?? new Date();
      const failureMode = input.cause.trim().slice(0, 255) || "unknown";
      const failureSeverity = (input.severity ?? "medium").toLowerCase();
      const insertValues: InsertFailureHistory = {
        orgId: input.orgId,
        equipmentId: input.equipmentId,
        failureTimestamp,
        failureMode,
        failureSeverity,
        rootCause: input.cause,
        workOrderId: input.workOrderId,
        verifiedBy: input.recordedBy,
        verifiedAt: input.recordedAt ?? new Date(),
        status: "resolved",
        resolvedAt: input.recordedAt ?? new Date(),
        lessonsLearned: input.notes,
      };
      const [row] = await db
        .insert(failureHistoryPg)
        .values(insertValues)
        .returning({ id: failureHistoryPg.id });

      if (row?.id !== undefined && row?.id !== null) {
        // Post-commit graph projection — best-effort by contract.
        await projectFailureHistory(input.orgId, {
          failureHistoryId: row.id,
          equipmentId: input.equipmentId,
          failureMode,
          technicianId: input.recordedBy ?? null,
          workOrderId: input.workOrderId,
        });
      }
    } catch (err) {
      failureHistoryLogger.warn(
        `[FailureHistoryAdapter] recordFailure failed for WO ${input.workOrderId} (non-fatal)`,
        { details: err instanceof Error ? err.message : String(err) }
      );
    }
  }
}
