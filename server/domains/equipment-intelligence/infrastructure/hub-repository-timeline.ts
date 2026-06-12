import { failurePredictions } from "@shared/schema-runtime";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../db-config.js";
import type { ActivityTimelineEvent } from "../domain/types.js";

export async function getActivityTimelineForEquipment(
  orgId: string,
  equipmentId: string
): Promise<ActivityTimelineEvent[]> {
  const events: ActivityTimelineEvent[] = [];

  try {
    const { workOrders } = await import("@shared/schema-runtime");
    const woRows = await db
      .select({
        id: workOrders.id,
        description: workOrders.description,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.equipmentId, equipmentId), eq(workOrders.orgId, orgId)))
      .orderBy(desc(workOrders.createdAt))
      .limit(10);

    for (const wo of woRows) {
      events.push({
        id: `wo-${wo.id}`,
        type: "work_order",
        title: `Work Order: ${wo.description || "Maintenance task"}`,
        description: `Status: ${wo.status}`,
        timestamp: wo.createdAt ? new Date(wo.createdAt).toISOString() : new Date().toISOString(),
        severity: wo.status === "open" ? "warning" : "info",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const predRows = await db
      .select()
      .from(failurePredictions)
      .where(
        and(eq(failurePredictions.equipmentId, equipmentId), eq(failurePredictions.orgId, orgId))
      )
      .orderBy(desc(failurePredictions.predictionTimestamp))
      .limit(5);

    for (const pred of predRows) {
      events.push({
        id: `pred-${pred.id}`,
        type: "prediction",
        title: `Prediction: ${pred.failureMode || "Failure analysis"}`,
        description: pred.remainingUsefulLife ? `RUL: ${pred.remainingUsefulLife} days` : null,
        timestamp: pred.predictionTimestamp
          ? new Date(pred.predictionTimestamp).toISOString()
          : new Date().toISOString(),
        severity:
          (pred.remainingUsefulLife ?? 365) < 14
            ? "critical"
            : (pred.remainingUsefulLife ?? 365) < 30
              ? "warning"
              : "info",
      });
    }
  } catch {
    /* ignore */
  }

  try {
    const { diagnosticRuns } = await import("@shared/schema-runtime");
    if (diagnosticRuns) {
      const diagRows = await db
        .select({
          id: diagnosticRuns.id,
          analysisType: diagnosticRuns.analysisType,
          summary: diagnosticRuns.summary,
          createdAt: diagnosticRuns.createdAt,
        })
        .from(diagnosticRuns)
        .where(and(eq(diagnosticRuns.equipmentId, equipmentId), eq(diagnosticRuns.orgId, orgId)))
        .orderBy(desc(diagnosticRuns.createdAt))
        .limit(5);

      for (const diag of diagRows) {
        events.push({
          id: `diag-${diag.id}`,
          type: "diagnostic",
          title: `Diagnostic: ${diag.analysisType}`,
          description: diag.summary,
          timestamp: diag.createdAt
            ? new Date(diag.createdAt).toISOString()
            : new Date().toISOString(),
          severity: "info",
        });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const { anomalyDetections } = await import("@shared/schema-runtime");
    if (anomalyDetections) {
      const anomalyRows = await db
        .select({
          id: anomalyDetections.id,
          sensorType: anomalyDetections.sensorType,
          anomalyType: anomalyDetections.anomalyType,
          severity: anomalyDetections.severity,
          detectedValue: anomalyDetections.detectedValue,
          expectedValue: anomalyDetections.expectedValue,
          detectionTimestamp: anomalyDetections.detectionTimestamp,
        })
        .from(anomalyDetections)
        .where(
          and(eq(anomalyDetections.equipmentId, equipmentId), eq(anomalyDetections.orgId, orgId))
        )
        .orderBy(desc(anomalyDetections.detectionTimestamp))
        .limit(5);

      for (const anomaly of anomalyRows) {
        const deviation =
          anomaly.detectedValue && anomaly.expectedValue
            ? `Detected: ${anomaly.detectedValue}, Expected: ${anomaly.expectedValue}`
            : null;
        events.push({
          id: `anomaly-${anomaly.id}`,
          type: "telemetry_anomaly",
          title: `Anomaly: ${anomaly.anomalyType || anomaly.sensorType}`,
          description: deviation,
          timestamp: anomaly.detectionTimestamp
            ? new Date(anomaly.detectionTimestamp).toISOString()
            : new Date().toISOString(),
          severity:
            anomaly.severity === "high"
              ? "critical"
              : anomaly.severity === "medium"
                ? "warning"
                : "info",
        });
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const { serviceOrders, workOrders: woTable } = await import("@shared/schema-runtime");
    if (serviceOrders && woTable) {
      const soRows = await db
        .select({
          id: serviceOrders.id,
          soNumber: serviceOrders.soNumber,
          status: serviceOrders.status,
          createdAt: serviceOrders.createdAt,
        })
        .from(serviceOrders)
        .innerJoin(woTable, eq(serviceOrders.workOrderId, woTable.id))
        .where(and(eq(woTable.equipmentId, equipmentId), eq(serviceOrders.orgId, orgId)))
        .orderBy(desc(serviceOrders.createdAt))
        .limit(5);

      for (const so of soRows) {
        events.push({
          id: `so-${so.id}`,
          type: "procurement",
          title: `Service Order: SO ${so.soNumber}`,
          description: `Status: ${so.status}`,
          timestamp: so.createdAt ? new Date(so.createdAt).toISOString() : new Date().toISOString(),
          severity: so.status === "draft" ? "info" : so.status === "sent" ? "warning" : "info",
        });
      }
    }
  } catch {
    /* ignore */
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 20);
}
