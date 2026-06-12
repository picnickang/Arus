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
