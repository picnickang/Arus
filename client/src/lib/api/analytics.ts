import { apiRequest } from "../queryClient";
import {
  anomalyDetectionListResponseSchema,
  type AnomalyDetectionListResponse,
  failurePredictionListResponseSchema,
  type FailurePredictionListResponse,
  modelPerformanceListResponseSchema,
  type ModelPerformanceListResponse,
  modelPerformanceSummaryResponseSchema,
  type ModelPerformanceSummaryResponse,
  reconciliationStatusSchema,
  reconciliationReportSchema,
  type ReconciliationStatus,
  type ReconciliationReport,
} from "@shared/analytics-types";

export async function fetchAnomalyDetections(params?: {
  equipmentId?: string;
  severity?: string;
  page?: number;
  limit?: number;
}): Promise<AnomalyDetectionListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.equipmentId) {
    queryParams.append("equipmentId", params.equipmentId);
  }
  if (params?.severity) {
    queryParams.append("severity", params.severity);
  }
  if (params?.page) {
    queryParams.append("page", params.page.toString());
  }
  if (params?.limit) {
    queryParams.append("limit", params.limit.toString());
  }
  const url = `/api/analytics/anomalies${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiRequest("GET", url);
  const result = anomalyDetectionListResponseSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Anomaly detections response validation failed:", result.error);
    throw new Error(`Invalid anomaly detections response: ${result.error.message}`);
  }
  return result.data;
}

export async function fetchFailurePredictions(params?: {
  equipmentId?: string;
  riskLevel?: string;
  page?: number;
  limit?: number;
}): Promise<FailurePredictionListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.equipmentId) {
    queryParams.append("equipmentId", params.equipmentId);
  }
  if (params?.riskLevel) {
    queryParams.append("riskLevel", params.riskLevel);
  }
  if (params?.page) {
    queryParams.append("page", params.page.toString());
  }
  if (params?.limit) {
    queryParams.append("limit", params.limit.toString());
  }
  const url = `/api/analytics/predictions${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiRequest("GET", url);
  const result = failurePredictionListResponseSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Failure predictions response validation failed:", result.error);
    throw new Error(`Invalid failure predictions response: ${result.error.message}`);
  }
  return result.data;
}

export async function fetchModelPerformance(params?: {
  modelType?: string;
  page?: number;
  limit?: number;
}): Promise<ModelPerformanceListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.modelType) {
    queryParams.append("modelType", params.modelType);
  }
  if (params?.page) {
    queryParams.append("page", params.page.toString());
  }
  if (params?.limit) {
    queryParams.append("limit", params.limit.toString());
  }
  const url = `/api/analytics/ml/performance${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiRequest("GET", url);
  const result = modelPerformanceListResponseSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Model performance response validation failed:", result.error);
    throw new Error(`Invalid model performance response: ${result.error.message}`);
  }
  return result.data;
}

export async function fetchModelPerformanceSummary(params?: {
  modelId?: string;
}): Promise<ModelPerformanceSummaryResponse> {
  const queryParams = new URLSearchParams();
  if (params?.modelId) {
    queryParams.append("modelId", params.modelId);
  }
  const url = `/api/analytics/model-performance/summary${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiRequest("GET", url);
  const result = modelPerformanceSummaryResponseSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Model performance summary response validation failed:", result.error);
    throw new Error(`Invalid model performance summary response: ${result.error.message}`);
  }
  return result.data;
}

export async function fetchReconciliationStatus(): Promise<ReconciliationStatus> {
  const url = `/api/analytics/reconciliation/status`;
  const response = await apiRequest("GET", url);
  const result = reconciliationStatusSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Reconciliation status response validation failed:", result.error);
    throw new Error(`Invalid reconciliation status response: ${result.error.message}`);
  }
  return result.data;
}

export async function fetchReconciliationReport(): Promise<ReconciliationReport> {
  const url = `/api/analytics/reconciliation/latest-report`;
  const response = await apiRequest("GET", url);
  const result = reconciliationReportSchema.safeParse(response);
  if (!result.success) {
    console.error("[API] Reconciliation report response validation failed:", result.error);
    throw new Error(`Invalid reconciliation report response: ${result.error.message}`);
  }
  return result.data;
}
