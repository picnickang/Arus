import type {
  EquipmentContext,
  EquipmentFeatureSnapshot,
  OperationalContextInput,
  NormalizedOperationalContext,
  SafetyReview,
  SyntheticTelemetryResult,
  SyntheticTelemetryScenario,
  PdmCalibrationSnapshot,
} from "./types";

export interface PdmContextPort {
  getEquipmentContext(orgId: string, equipmentId: string): Promise<EquipmentContext | null>;
  getRecentFeatureSnapshots(
    orgId: string,
    equipmentId: string,
    limit: number
  ): Promise<EquipmentFeatureSnapshot[]>;
}

export interface PdmCalibrationPort {
  getCalibrationSnapshot(input: {
    orgId: string;
    equipmentId: string;
    equipmentType?: string | null;
  }): Promise<PdmCalibrationSnapshot | null>;
}

export interface OperationalContextPort {
  normalize(
    equipment: EquipmentContext | null,
    override?: OperationalContextInput
  ): NormalizedOperationalContext;
}

export interface RecommendationSafetyPort {
  reviewRecommendation(input: {
    recommendation: string;
    riskLevel: string;
    equipmentId?: string;
  }): SafetyReview;
}

export interface SyntheticTelemetryPort {
  generate(input: {
    equipmentId: string;
    scenario: SyntheticTelemetryScenario;
    hours: number;
    intervalMinutes: number;
    loadFactor?: number;
    weatherSeverity?: number;
    seed?: string;
  }): SyntheticTelemetryResult;
}

