import { eq, and } from "drizzle-orm";
import { db } from "../../../../db";
import { assetTwins, assetTwinTemplates } from "@shared/schema";
import type { ScenarioSimPort, ScenarioParameters, ScenarioResult } from "./ports";
import type { TwinStatePort } from "../twin-state/ports";
import { logger } from "../../../../utils/logger";

export class ScenarioSimService {
  constructor(
    private scenarioAdapter: ScenarioSimPort,
    private stateAdapter: TwinStatePort
  ) {}

  async runScenario(
    orgId: string,
    twinId: string,
    name: string,
    parameters: ScenarioParameters
  ): Promise<{ scenario: any; results: ScenarioResult }> {
    const [twin] = await db
      .select()
      .from(assetTwins)
      .where(and(eq(assetTwins.orgId, orgId), eq(assetTwins.id, twinId)));

    if (!twin) {
      throw new Error(`Twin ${twinId} not found`);
    }

    const [template] = await db
      .select()
      .from(assetTwinTemplates)
      .where(and(eq(assetTwinTemplates.orgId, orgId), eq(assetTwinTemplates.id, twin.templateId)));

    if (!template) {
      throw new Error(`Template ${twin.templateId} not found`);
    }

    const latestState = await this.stateAdapter.getLatestState(orgId, twinId);

    const baseline = {
      healthScore: latestState?.healthScore ?? 85,
      efficiencyScore: latestState?.efficiencyScore ?? 90,
      rulHours: latestState?.remainingUsefulLifeHours ?? 5000,
    };

    const envelope = template.operatingEnvelope as
      | { min?: Record<string, number>; max?: Record<string, number> }
      | null;
    const projected = this.computeProjectedValues(baseline, parameters, envelope);

    const healthDelta = projected.healthScore - baseline.healthScore;
    const efficiencyDelta = projected.efficiencyScore - baseline.efficiencyScore;
    const rulDeltaHours = projected.rulHours - baseline.rulHours;

    const riskLevel = this.assessRisk(projected.healthScore, projected.rulHours);
    const summary = this.generateSummary(
      parameters,
      healthDelta,
      efficiencyDelta,
      rulDeltaHours,
      riskLevel
    );

    const results: ScenarioResult = {
      projectedHealthScore: projected.healthScore,
      projectedEfficiencyScore: projected.efficiencyScore,
      projectedRulHours: projected.rulHours,
      baselineHealthScore: baseline.healthScore,
      baselineEfficiencyScore: baseline.efficiencyScore,
      baselineRulHours: baseline.rulHours,
      impact: {
        healthDelta,
        efficiencyDelta,
        rulDeltaHours,
        riskLevel,
        summary,
      },
    };

    const scenario = await this.scenarioAdapter.saveScenario({
      orgId,
      twinId,
      name,
      parameters,
      results,
    } as Parameters<typeof this.scenarioAdapter.saveScenario>[0]);

    logger.info("[ScenarioSim]", "Scenario completed", {
      orgId,
      twinId,
      scenarioId: scenario.id,
      riskLevel,
    });

    return { scenario, results };
  }

  private computeProjectedValues(
    baseline: { healthScore: number; efficiencyScore: number; rulHours: number },
    params: ScenarioParameters,
    envelope: { min?: Record<string, number>; max?: Record<string, number> } | null
  ) {
    let healthScore = baseline.healthScore;
    let efficiencyScore = baseline.efficiencyScore;
    let rulHours = baseline.rulHours;

    if (params.loadPercent !== undefined) {
      const loadFactor = params.loadPercent / 100;
      const loadImpact = loadFactor > 0.85 ? (loadFactor - 0.85) * 40 : 0;
      healthScore -= loadImpact;

      const efficiencyPeak = 0.75;
      const deviation = Math.abs(loadFactor - efficiencyPeak);
      efficiencyScore -= deviation * 15;

      if (loadFactor > 0.9) {
        rulHours *= 1 - (loadFactor - 0.9) * 3;
      }
    }

    if (params.temperatureOffset !== undefined) {
      const tempImpact = Math.abs(params.temperatureOffset) * 0.8;
      healthScore -= tempImpact;
      efficiencyScore -= Math.abs(params.temperatureOffset) * 0.5;

      if (params.temperatureOffset > 10) {
        rulHours *= 0.85;
      } else if (params.temperatureOffset > 5) {
        rulHours *= 0.93;
      }
    }

    if (params.maintenanceDelayDays !== undefined && params.maintenanceDelayDays > 0) {
      const degradation = Math.min(params.maintenanceDelayDays * 0.3, 25);
      healthScore -= degradation;
      efficiencyScore -= degradation * 0.6;
      rulHours -= params.maintenanceDelayDays * 24;
    }

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore * 100) / 100));
    efficiencyScore = Math.max(0, Math.min(100, Math.round(efficiencyScore * 100) / 100));
    rulHours = Math.max(0, Math.round(rulHours));

    return { healthScore, efficiencyScore, rulHours };
  }

  private assessRisk(healthScore: number, rulHours: number): string {
    if (healthScore < 30 || rulHours < 168) {
      return "critical";
    }
    if (healthScore < 50 || rulHours < 720) {
      return "high";
    }
    if (healthScore < 70 || rulHours < 2160) {
      return "medium";
    }
    return "low";
  }

  private generateSummary(
    params: ScenarioParameters,
    healthDelta: number,
    efficiencyDelta: number,
    rulDeltaHours: number,
    riskLevel: string
  ): string {
    const parts: string[] = [];

    if (params.loadPercent !== undefined) {
      parts.push(`Load at ${params.loadPercent}%`);
    }
    if (params.temperatureOffset !== undefined) {
      const sign = params.temperatureOffset >= 0 ? "+" : "";
      parts.push(`temperature ${sign}${params.temperatureOffset}°C`);
    }
    if (params.maintenanceDelayDays !== undefined) {
      parts.push(`maintenance delayed ${params.maintenanceDelayDays} days`);
    }

    const context = parts.length > 0 ? parts.join(", ") : "No parameter changes";

    const healthDir = healthDelta >= 0 ? "increase" : "decrease";
    const rulDays = Math.round(Math.abs(rulDeltaHours) / 24);

    return `${context}: health ${healthDir} of ${Math.abs(Math.round(healthDelta))} points, RUL change of ${rulDays} days. Risk level: ${riskLevel}.`;
  }
}
