export interface AnalyticsDashboard {
  equipmentHealth: EquipmentHealthSummary[];
  alertSummary: AlertSummary;
  maintenanceSummary: MaintenanceSummary;
  costSummary: CostSummary;
  trendData: TrendDataPoint[];
}

export interface EquipmentHealthSummary {
  equipmentId: string;
  equipmentName: string;
  vesselName: string;
  healthScore: number;
  status: string;
  trend: "improving" | "stable" | "declining";
  lastUpdated: Date;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

export interface MaintenanceSummary {
  overdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
  completedThisMonth: number;
  complianceRate: number;
}

export interface CostSummary {
  totalMtd: number;
  totalYtd: number;
  laborCost: number;
  partsCost: number;
  externalCost: number;
  savingsFromPdm: number;
}

export interface TrendDataPoint {
  date: string;
  healthScore: number;
  alertCount: number;
  maintenanceCount: number;
  cost: number;
}

export interface FailurePrediction {
  id: string;
  equipmentId: string;
  equipmentName: string;
  predictedFailureDate: Date;
  confidence: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  failureMode?: string;
  recommendedAction?: string;
  remainingUsefulLife?: number;
  createdAt: Date;
}

export interface AnomalyDetection {
  id: string;
  equipmentId: string;
  sensorType: string;
  detectedAt: Date;
  severity: "low" | "medium" | "high";
  description: string;
  value: number;
  expectedRange: { min: number; max: number };
  isAcknowledged: boolean;
}

export interface ThresholdOptimization {
  id: string;
  equipmentId: string;
  sensorType: string;
  currentThreshold: number;
  recommendedThreshold: number;
  reason: string;
  confidence: number;
  status: "pending" | "applied" | "rejected";
}

export const TREND_PERIODS = ["7d", "30d", "90d", "1y"] as const;
export type TrendPeriod = typeof TREND_PERIODS[number];

export interface MlModel {
  id: string;
  orgId: string;
  name: string;
  version: string;
  modelType: string;
  targetEquipmentType?: string;
  status: string;
  deployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalTwin {
  id: string;
  vesselId: string;
  twinType: string;
  name?: string;
  specifications?: Record<string, unknown>;
  currentState?: Record<string, unknown>;
  lastUpdate: string;
  validationStatus?: string;
  accuracy?: number;
  metadata?: Record<string, unknown>;
  lastUpdateTimestamp?: string;
}

export interface InsightSnapshot {
  id: string;
  orgId: string;
  scope: string;
  createdAt?: string;
  kpi?: {
    fleet?: {
      vessels: number;
      signalsMapped: number;
      signalsDiscovered: number;
      dq7d: number;
      latestGapVessels: string[];
    };
    perVessel?: Record<string, unknown>;
  };
  risks?: Record<string, unknown>;
  insights?: Record<string, unknown>;
  timestamp?: string;
}

export interface AnomalyDetectionRecord {
  id: number;
  orgId: string;
  equipmentId: string;
  sensorType: string;
  severity: string;
  detectionTimestamp: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  anomalyScore?: number;
  anomalyType?: string;
  detectedValue?: number;
  expectedValue?: number;
  deviation?: number;
  contributingFactors?: string[];
  recommendedActions?: string[];
  metadata?: Record<string, unknown>;
}

export interface FailurePredictionRecord {
  id: number;
  orgId: string;
  equipmentId: string;
  riskLevel: string;
  probability: number;
  estimatedTimeToFailure?: number;
  predictionTimestamp: string;
}

export interface ThresholdOptimizationRecord {
  id: number;
  orgId: string;
  equipmentId: string;
  sensorType: string;
  optimizationTimestamp: string;
  appliedAt?: string;
  optimizationMethod?: string;
}
