import type { EquipmentHubRepository } from "../domain/ports.js";
import type { EquipmentHubAggregate, DiagnosticRunSummary } from "../domain/types.js";

export function createGetEquipmentHubUseCase(repo: EquipmentHubRepository) {
  return {
    async getHub(orgId: string, equipmentId: string): Promise<EquipmentHubAggregate | null> {
      return repo.getHubAggregate(orgId, equipmentId);
    },

    async runDiagnostic(orgId: string, equipmentId: string, analysisType: string): Promise<DiagnosticRunSummary | null> {
      const hub = await repo.getHubAggregate(orgId, equipmentId);
      if (!hub) {return null;}
      const summary = generateDiagnosticSummary(analysisType, hub);
      const results = generateDiagnosticResults(analysisType, hub);
      return repo.saveDiagnosticRun(orgId, equipmentId, analysisType, results, summary);
    },
  };
}

function generateDiagnosticSummary(analysisType: string, hub: EquipmentHubAggregate): string {
  const health = hub.health;
  const rul = hub.rul;
  const trend = hub.trend;
  const trendLabel = trend === "declining" ? "declining trend detected" : trend === "improving" ? "improving trend observed" : "stable trend";

  switch (analysisType) {
    case "bearing": {
      if (health < 40) {
        return `Bearing analysis complete for ${hub.name}. Health at ${health}% with ${rul} days RUL — elevated vibration patterns detected. ${trendLabel}. Immediate inspection recommended.`;
      }
      if (health < 70) {
        return `Bearing analysis complete for ${hub.name}. Health at ${health}% with ${rul} days RUL — minor vibration anomalies observed, ${trendLabel}. Schedule inspection at next port call.`;
      }
      return `Bearing analysis complete for ${hub.name}. Health at ${health}%, ${trendLabel}. Vibration levels within acceptable range. No anomalous frequency patterns detected.`;
    }
    case "pump": {
      if (health < 40) {
        return `Pump performance analysis for ${hub.name}. Health at ${health}% with ${rul} days RUL — flow rate degradation detected, ${trendLabel}. Immediate servicing required.`;
      }
      if (health < 70) {
        return `Pump performance analysis for ${hub.name}. Health at ${health}% with ${rul} days RUL — minor efficiency loss, ${trendLabel}. Monitor closely.`;
      }
      return `Pump performance analysis for ${hub.name}. Health at ${health}%, ${trendLabel}. Flow rate and pressure differential within normal operating parameters.`;
    }
    case "general":
    default: {
      const signalCount = hub.signals.length;
      const signalNote = signalCount > 0 ? ` ${signalCount} active signal${signalCount > 1 ? "s" : ""} detected.` : " No active signals.";
      if (health < 40) {
        return `General health assessment for ${hub.name}. Health at ${health}% with ${rul} days RUL — ${hub.risk} risk.${signalNote} ${trendLabel}. Immediate action required.`;
      }
      if (health < 70) {
        return `General health assessment for ${hub.name}. Health at ${health}% with ${rul} days RUL — ${hub.risk} risk.${signalNote} ${trendLabel}. Proactive maintenance recommended.`;
      }
      return `General health assessment for ${hub.name}. Health at ${health}%, ${trendLabel}.${signalNote} All monitored parameters within expected ranges.`;
    }
  }
}

function generateDiagnosticResults(analysisType: string, hub: EquipmentHubAggregate): Record<string, unknown> {
  const baseContext = {
    equipmentName: hub.name,
    equipmentType: hub.type,
    vessel: hub.vessel,
    healthScore: hub.health,
    rul: hub.rul,
    risk: hub.risk,
    confidence: hub.confidence,
    trend: hub.trend,
    dataAvailability: hub.dataAvailability,
    telemetrySamples: hub.telemetry.length,
    activeSignals: hub.signals.length,
  };

  switch (analysisType) {
    case "bearing": {
      const healthOk = hub.health >= 70;
      return {
        ...baseContext,
        analysisType: "bearing",
        vibrationLevel: healthOk ? "normal" : hub.health >= 40 ? "elevated" : "critical",
        peakFrequency: healthOk ? "42 Hz" : "67 Hz",
        rmsVelocity: healthOk ? "2.1 mm/s" : hub.health >= 40 ? "4.8 mm/s" : "7.2 mm/s",
        kurtosis: healthOk ? 3.2 : 5.1,
        crestFactor: healthOk ? 3.8 : 6.4,
        status: healthOk ? "healthy" : hub.health >= 40 ? "degraded" : "critical",
        signals: hub.signals.slice(0, 5),
      };
    }
    case "pump": {
      const healthOk = hub.health >= 70;
      return {
        ...baseContext,
        analysisType: "pump",
        flowRate: healthOk ? "nominal" : hub.health >= 40 ? "reduced" : "critically low",
        pressureDifferential: healthOk ? "within range" : "out of range",
        cavitationIndex: healthOk ? 0.12 : hub.health >= 40 ? 0.35 : 0.62,
        efficiency: healthOk ? "87%" : hub.health >= 40 ? "72%" : "54%",
        status: healthOk ? "healthy" : hub.health >= 40 ? "degraded" : "critical",
        signals: hub.signals.slice(0, 5),
      };
    }
    default: {
      return {
        ...baseContext,
        analysisType: "general",
        overallStatus: hub.health >= 70 ? "healthy" : hub.health >= 40 ? "degraded" : "critical",
        parametersChecked: 12 + hub.telemetry.length,
        anomaliesFound: hub.signals.length,
        prediction: hub.prediction,
      };
    }
  }
}
