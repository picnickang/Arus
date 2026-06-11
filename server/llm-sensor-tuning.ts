/**
 * Legacy LLM sensor tuning shim.
 */

export interface SensorRecommendation {
  equipmentId: string;
  sensorType: string;
  recommendation: string;
  confidence: number;
}

export interface SensorComparison {
  equipmentId: string;
  sensorType: string;
  current: Record<string, unknown>;
  recommended: Record<string, unknown>;
  delta: Record<string, unknown>;
}

export const llmSensorTuningService = {
  async getRecommendations(equipmentId: string, _orgId: string): Promise<SensorRecommendation[]> {
    return [
      {
        equipmentId,
        sensorType: "unknown",
        recommendation: "LLM sensor tuning service is not configured.",
        confidence: 0,
      },
    ];
  },

  async getSensorRecommendation(
    equipmentId: string,
    sensorType: string,
    _orgId: string
  ): Promise<SensorRecommendation> {
    return {
      equipmentId,
      sensorType,
      recommendation: "LLM sensor tuning service is not configured.",
      confidence: 0,
    };
  },

  async compareConfiguration(
    equipmentId: string,
    sensorType: string,
    _current: Record<string, unknown>,
    _orgId: string
  ): Promise<SensorComparison> {
    return {
      equipmentId,
      sensorType,
      current: {},
      recommended: {},
      delta: {},
    };
  },
};
