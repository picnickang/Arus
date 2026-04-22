/**
 * Insight Snapshot Normalizer
 */

import type { InsightSnapshot } from "@shared/schema";
import { expandAnomalyType, clampToRange } from "./helpers";

export function normalizeInsightSnapshot(snapshot: InsightSnapshot): InsightSnapshot {
  return {
    ...snapshot,
    createdAt: snapshot.createdAt || new Date(),
    kpi: snapshot.kpi || {
      fleet: { vessels: 0, signalsMapped: 0, signalsDiscovered: 0, dq7d: 0, latestGapVessels: [] },
      perVessel: {},
    },
    risks: snapshot.risks || { critical: [], warnings: [] },
    recommendations: snapshot.recommendations ?? [],
    anomalies: (snapshot.anomalies ?? []).map((anomaly) => ({
      vesselId: anomaly.vesselId || "",
      src: anomaly.src || "unknown",
      sig: anomaly.sig || "unknown",
      kind: expandAnomalyType(anomaly.kind) || "unknown",
      severity: anomaly.severity || "medium",
      tStart: anomaly.tStart || new Date().toISOString(),
      tEnd: anomaly.tEnd || new Date().toISOString(),
      detectionTimestamp: anomaly.tStart || new Date().toISOString(),
      anomalyScore: clampToRange((anomaly as any).anomalyScore ?? 0.5, 0, 1),
      fullAnomalyType: expandAnomalyType(anomaly.kind),
    })),
    compliance: snapshot.compliance || { horViolations7d: 0, notes: [] },
  };
}

export function normalizeInsightSnapshots(snapshots: InsightSnapshot[]): InsightSnapshot[] {
  return snapshots.map(normalizeInsightSnapshot);
}
