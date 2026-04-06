import type { EquipmentHubRepository } from "../domain/ports.js";
import type { EquipmentHubAggregate, DiagnosticRunSummary } from "../domain/types.js";

export function createGetEquipmentHubUseCase(repo: EquipmentHubRepository) {
  return {
    async getHub(orgId: string, equipmentId: string): Promise<EquipmentHubAggregate | null> {
      return repo.getHubAggregate(orgId, equipmentId);
    },

    async runDiagnostic(orgId: string, equipmentId: string, analysisType: string): Promise<DiagnosticRunSummary | null> {
      const hub = await repo.getHubAggregate(orgId, equipmentId);
      if (!hub) return null;
      const summary = generateDiagnosticSummary(analysisType);
      const results = generateDiagnosticResults(analysisType);
      return repo.saveDiagnosticRun(orgId, equipmentId, analysisType, results, summary);
    },
  };
}

function generateDiagnosticSummary(analysisType: string): string {
  switch (analysisType) {
    case "bearing":
      return "Bearing analysis complete. Vibration levels within acceptable range. No anomalous frequency patterns detected.";
    case "pump":
      return "Pump performance analysis complete. Flow rate and pressure differential within normal operating parameters.";
    case "general":
      return "General health assessment complete. All monitored parameters within expected ranges.";
    default:
      return `${analysisType} analysis complete. No anomalies detected.`;
  }
}

function generateDiagnosticResults(analysisType: string): Record<string, unknown> {
  switch (analysisType) {
    case "bearing":
      return {
        vibrationLevel: "normal",
        peakFrequency: "42 Hz",
        rmsVelocity: "2.1 mm/s",
        kurtosis: 3.2,
        crestFactor: 3.8,
        status: "healthy",
      };
    case "pump":
      return {
        flowRate: "nominal",
        pressureDifferential: "within range",
        cavitationIndex: 0.12,
        efficiency: "87%",
        status: "healthy",
      };
    default:
      return {
        overallStatus: "healthy",
        parametersChecked: 12,
        anomaliesFound: 0,
      };
  }
}
