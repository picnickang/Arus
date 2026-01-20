/**
 * Report Context Types
 * 
 * Type definitions for report context building.
 */

import type { SelectVessel, WorkOrder, EquipmentTelemetry } from "@shared/schema-runtime";
import type { MLPredictionResult } from "../ml-prediction/index";

export interface ReportContext {
  type: "health" | "fleet_summary" | "maintenance" | "compliance" | "custom";
  scope: {
    vesselId?: string;
    equipmentId?: string;
    timeframe: { start: Date; end: Date };
    organizationId: string;
  };
  data: {
    vessels?: SelectVessel[];
    equipment?: any[];
    workOrders?: WorkOrder[];
    telemetry?: EquipmentTelemetry[];
    maintenanceSchedules?: any[];
    alerts?: any[];
    crew?: any[];
    compliance?: any[];
  };
  metadata: {
    generatedAt: Date;
    requestedBy?: string;
    audience: "executive" | "technical" | "maintenance" | "compliance";
    priority: "low" | "medium" | "high" | "critical";
  };
  intelligence?: {
    vesselLearnings?: any;
    historicalContext?: any;
    historicalContexts?: any[];
    patterns?: any[];
    predictions?: Array<{
      equipmentId: string;
      equipmentName: string;
      equipmentType: string;
      mlPrediction: MLPredictionResult;
    }>;
  };
  knowledge?: {
    documents: Array<{
      docId: string;
      name: string;
      equipmentId?: string | null;
      text?: string;
      relevance: number;
    }>;
    semanticMatches: Array<{
      docId: string;
      text: string;
      score: number;
    }>;
  };
  citations?: {
    sourceType: string;
    sourceId: string;
    title: string;
    relevance: number;
  }[];
}

export interface ContextBuilderOptions {
  includeIntelligence?: boolean;
  includePredictions?: boolean;
  includeHistoricalData?: boolean;
  includeKnowledge?: boolean;
  timeframeDays?: number;
  audience?: "executive" | "technical" | "maintenance" | "compliance";
}
