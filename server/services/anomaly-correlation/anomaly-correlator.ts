/**
 * Anomaly Correlation Service
 *
 * GAP FILL #3: Groups related anomalies across sensors into equipment-level diagnoses.
 *
 * Problem: A failing pump generates 50 separate alerts (temperature, pressure, vibration,
 * oil quality). The operator sees 50 notifications instead of "Pump #3 is failing."
 *
 * Solution: Temporal + equipment clustering of anomalies into correlated groups,
 * with a diagnosis synthesizer that suggests root causes.
 *
 * Usage:
 *   const correlator = new AnomalyCorrelator(storage);
 *   const groups = await correlator.correlateAnomalies(orgId);
 *   // Returns: [{ equipmentId, equipmentName, diagnosis, anomalies: [...], confidence, severity }]
 */

import { logger } from "../../utils/logger";
import { matchFailureSignature, normalizeSensorType } from "./anomaly-signatures";

const LOG_CTX = "AnomalyCorrelator";

// ============================================================================
// Types
// ============================================================================

interface RawAnomaly {
  id: number;
  equipmentId: string;
  sensorType: string;
  severity: string;
  anomalyType: string;
  value?: number | undefined;
  threshold?: number | undefined;
  detectionTimestamp: Date;
  acknowledgedAt?: Date | null | undefined;
  description?: string | undefined;
}

export interface CorrelatedAnomalyGroup {
  groupId: string;
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  vesselId: string | null;
  vesselName: string | null;
  diagnosis: string;
  rootCauseSuggestion: string;
  recommendedAction: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  anomalyCount: number;
  sensorTypes: string[];
  firstDetected: Date;
  lastDetected: Date;
  anomalies: RawAnomaly[];
  isAcknowledged: boolean;
}

export interface CorrelationReport {
  orgId: string;
  generatedAt: Date;
  totalAnomalies: number;
  totalGroups: number;
  ungroupedAnomalies: number;
  criticalGroups: number;
  groups: CorrelatedAnomalyGroup[];
}

// ============================================================================
// Main Service
// ============================================================================

interface AnomalyStorage {
  getAnomalyDetections: (
    orgId: string,
    equipmentId?: string,
    severity?: string
  ) => Promise<Array<Record<string, unknown>>>;
  getEquipment?: (
    orgId: string,
    equipmentId: string
  ) => Promise<{ name?: string; type?: string; vesselId?: string | null } | null>;
  getVessel?: (vesselId: string, orgId: string) => Promise<{ name?: string } | null>;
}

export class AnomalyCorrelator {
  private storage: AnomalyStorage;
  private correlationWindowMs: number;

  /**
   * @param storage - Storage adapter
   * @param correlationWindowMinutes - Time window for grouping related anomalies (default 30 minutes)
   */
  constructor(storage: AnomalyStorage, correlationWindowMinutes = 30) {
    this.storage = storage;
    this.correlationWindowMs = correlationWindowMinutes * 60 * 1000;
  }

  /**
   * Correlate unacknowledged anomalies into equipment-level diagnosis groups.
   */
  async correlateAnomalies(
    orgId: string,
    options?: {
      includeAcknowledged?: boolean;
      maxAnomalies?: number;
      equipmentId?: string;
    }
  ): Promise<CorrelationReport> {
    const startTime = Date.now();

    // 1. Fetch recent anomalies
    const rawAnomalies = await this.storage.getAnomalyDetections(
      orgId,
      options?.equipmentId,
      undefined // all severities
    );

    let anomalies: RawAnomaly[] = rawAnomalies
      .slice(0, options?.maxAnomalies ?? 1000)
      .map((raw: Record<string, unknown>) => {
        const a = raw as {
          id: number;
          equipmentId: string;
          sensorType?: string;
          anomalyType?: string;
          severity?: string;
          value?: number;
          threshold?: number;
          detectionTimestamp?: string | Date;
          createdAt?: string | Date;
          acknowledgedAt?: string | Date | null;
          description?: string;
        };
        return {
          id: a.id,
          equipmentId: a.equipmentId,
          sensorType: a.sensorType || a.anomalyType || "unknown",
          severity: a.severity || "medium",
          anomalyType: a.anomalyType || "unknown",
          value: a.value,
          threshold: a.threshold,
          detectionTimestamp: new Date(a.detectionTimestamp || a.createdAt || Date.now()),
          acknowledgedAt: a.acknowledgedAt ? new Date(a.acknowledgedAt) : null,
          description: a.description,
        };
      });

    if (!options?.includeAcknowledged) {
      anomalies = anomalies.filter((a) => !a.acknowledgedAt);
    }

    // 2. Group by equipment
    const byEquipment = new Map<string, RawAnomaly[]>();
    for (const anomaly of anomalies) {
      if (!byEquipment.has(anomaly.equipmentId)) {
        byEquipment.set(anomaly.equipmentId, []);
      }
      byEquipment.get(anomaly.equipmentId)!.push(anomaly);
    }

    // 3. Within each equipment, cluster by temporal proximity
    const groups: CorrelatedAnomalyGroup[] = [];
    let ungrouped = 0;

    for (const [equipmentId, eqAnomalies] of byEquipment) {
      // Sort by time
      eqAnomalies.sort((a, b) => a.detectionTimestamp.getTime() - b.detectionTimestamp.getTime());

      // Temporal clustering
      const clusters = this.temporalCluster(eqAnomalies);

      // Fetch equipment info
      let equipmentName = "Unknown Equipment";
      let equipmentType = "unknown";
      let vesselId: string | null = null;
      let vesselName: string | null = null;

      try {
        const equipment = await this.storage.getEquipment?.(orgId, equipmentId);
        if (equipment) {
          equipmentName = equipment.name || equipmentName;
          equipmentType = equipment.type || equipmentType;
          vesselId = equipment.vesselId || null;
          if (vesselId) {
            try {
              const vessel = await this.storage.getVessel?.(vesselId, orgId);
              vesselName = vessel?.name || null;
            } catch {
              /* vessel lookup failed */
            }
          }
        }
      } catch {
        /* equipment lookup failed */
      }

      for (const cluster of clusters) {
        if (cluster.length === 1) {
          ungrouped++;
          // Single anomalies still get a group, just with lower confidence
        }

        const sensorTypes = [...new Set(cluster.map((a) => normalizeSensorType(a.sensorType)))];
        const severities = cluster.map((a) => a.severity);
        const groupSeverity = this.computeGroupSeverity(severities);

        // Match against known failure signatures
        const signatureMatch = matchFailureSignature(sensorTypes);

        const firstDetected = new Date(
          Math.min(...cluster.map((a) => a.detectionTimestamp.getTime()))
        );
        const lastDetected = new Date(
          Math.max(...cluster.map((a) => a.detectionTimestamp.getTime()))
        );

        const group: CorrelatedAnomalyGroup = {
          groupId: `${equipmentId}-${firstDetected.getTime()}`,
          equipmentId,
          equipmentName,
          equipmentType,
          vesselId,
          vesselName,
          diagnosis:
            signatureMatch?.diagnosis ?? this.generateGenericDiagnosis(sensorTypes, equipmentType),
          rootCauseSuggestion:
            signatureMatch?.rootCause ??
            "Multiple sensor anomalies detected. Manual investigation recommended.",
          recommendedAction:
            signatureMatch?.action ??
            `Inspect ${equipmentName}. Review ${sensorTypes.join(", ")} sensor readings.`,
          severity: signatureMatch ? signatureMatch.severity : groupSeverity,
          confidence:
            signatureMatch?.confidence ??
            this.computeConfidence(cluster.length, sensorTypes.length),
          anomalyCount: cluster.length,
          sensorTypes,
          firstDetected,
          lastDetected,
          anomalies: cluster,
          isAcknowledged: cluster.every((a) => !!a.acknowledgedAt),
        };

        groups.push(group);
      }
    }

    // Sort by severity then by anomaly count
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    groups.sort((a, b) => {
      const sevDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (sevDiff !== 0) {
        return sevDiff;
      }
      return b.anomalyCount - a.anomalyCount;
    });

    const report: CorrelationReport = {
      orgId,
      generatedAt: new Date(),
      totalAnomalies: anomalies.length,
      totalGroups: groups.length,
      ungroupedAnomalies: ungrouped,
      criticalGroups: groups.filter((g) => g.severity === "critical").length,
      groups,
    };

    logger.info(
      LOG_CTX,
      `Correlated ${anomalies.length} anomalies into ${groups.length} groups (${report.criticalGroups} critical) in ${Date.now() - startTime}ms`,
      { orgId }
    );

    return report;
  }

  // ===========================================================================
  // Private: Clustering
  // ===========================================================================

  /**
   * Cluster anomalies by temporal proximity.
   * Anomalies within correlationWindowMs of each other are grouped together.
   */
  private temporalCluster(sorted: RawAnomaly[]): RawAnomaly[][] {
    const first = sorted[0];
    if (!first) {
      return [];
    }

    const clusters: RawAnomaly[][] = [[first]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const lastCluster = clusters[clusters.length - 1];
      if (!current || !lastCluster) {
        continue;
      }
      const lastInCluster = lastCluster[lastCluster.length - 1];
      if (!lastInCluster) {
        continue;
      }

      const timeDiff =
        current.detectionTimestamp.getTime() - lastInCluster.detectionTimestamp.getTime();

      if (timeDiff <= this.correlationWindowMs) {
        lastCluster.push(current);
      } else {
        clusters.push([current]);
      }
    }

    return clusters;
  }

  // ===========================================================================
  // Private: Severity and confidence computation
  // ===========================================================================

  private computeGroupSeverity(severities: string[]): "critical" | "high" | "medium" | "low" {
    if (severities.includes("critical")) {
      return "critical";
    }
    if (severities.includes("high")) {
      return "high";
    }
    if (severities.filter((s) => s === "medium").length >= 3) {
      return "high";
    } // 3+ medium = high
    if (severities.includes("medium")) {
      return "medium";
    }
    return "low";
  }

  private computeConfidence(anomalyCount: number, sensorTypeCount: number): number {
    // More anomalies and more sensor types = higher confidence
    const countFactor = Math.min(0.3, anomalyCount * 0.05);
    const sensorFactor = Math.min(0.3, sensorTypeCount * 0.1);
    return Math.round((0.4 + countFactor + sensorFactor) * 100) / 100;
  }

  private generateGenericDiagnosis(sensorTypes: string[], equipmentType: string): string {
    if (sensorTypes.length === 1) {
      return `Anomalous ${sensorTypes[0]} readings detected on ${equipmentType}`;
    }
    return `Correlated anomalies across ${sensorTypes.length} sensor types (${sensorTypes.slice(0, 3).join(", ")}${sensorTypes.length > 3 ? "..." : ""}) on ${equipmentType}`;
  }
}

export default AnomalyCorrelator;
