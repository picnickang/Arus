/**
 * Report Context Types
 *
 * Type definitions for report context building.
 */

import type { Vessel as SelectVessel, WorkOrder, EquipmentTelemetry } from "@shared/schema";
import type { MLPredictionResult } from "../ml-prediction/index";

export interface ReportContext {
  type: "health" | "fleet_summary" | "maintenance" | "compliance" | "custom";
  scope: {
    vesselId?: string | undefined;
    equipmentId?: string | undefined;
    timeframe: { start: Date; end: Date };
    organizationId: string;
  };
  data: {
    vessels?: SelectVessel[] | undefined;
    equipment?: unknown[] | undefined;
    workOrders?: WorkOrder[] | undefined;
    telemetry?: EquipmentTelemetry[] | undefined;
    maintenanceSchedules?: unknown[] | undefined;
    alerts?: unknown[] | undefined;
    crew?: unknown[] | undefined;
    compliance?: unknown[] | undefined;
  };
  metadata: {
    generatedAt: Date;
    requestedBy?: string | undefined;
    audience: "executive" | "technical" | "maintenance" | "compliance";
    priority: "low" | "medium" | "high" | "critical";
  };
  intelligence?: {
    vesselLearnings?: unknown;
    historicalContext?: unknown;
    historicalContexts?: unknown[];
    patterns?: unknown[];
    predictions?: Array<{
      equipmentId: string;
      equipmentName: string;
      equipmentType: string;
      mlPrediction: MLPredictionResult;
    }>;
    knowledgeBase?: string[];
  } | undefined;
  knowledge?: {
    documents: Array<{
      docId: string;
      name: string;
      equipmentId?: string | null | undefined;
      text?: string | undefined;
      relevance: number;
    }>;
    semanticMatches: Array<{
      docId: string;
      text: string;
      score: number;
    }>;
  } | undefined;
  citations?: {
    sourceType: string;
    sourceId: string;
    title: string;
    relevance: number;
  }[] | undefined;
}

export interface ContextBuilderOptions {
  includeIntelligence?: boolean;
  includePredictions?: boolean;
  includeHistoricalData?: boolean;
  includeKnowledge?: boolean;
  timeframeDays?: number;
  audience?: "executive" | "technical" | "maintenance" | "compliance";
}
