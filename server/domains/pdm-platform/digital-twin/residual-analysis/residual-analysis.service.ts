import { createLogger } from "../../../../lib/structured-logger";
const logger = createLogger("Domains:PdmPlatform:DigitalTwin:ResidualAnalysis:ResidualAnalysis.service");
import { db } from "../../../../db";
import { eq, and, desc } from "drizzle-orm";
import {
  assetTwins,
  assetTwinTemplates,
  assetTwinState,
  fleetBaselines,
  type TwinResidual,
  type InsertTwinResidual,
} from "@shared/schema";
import { ResidualAnalysisAdapter } from "./adapter";

const LOG_MODULE = "[ResidualAnalysis]";

const Z_SCORE_WARNING = 2;
const Z_SCORE_CRITICAL = 3;

function severityFromZScore(z: number): "normal" | "warning" | "critical" {
  const abs = Math.abs(z);
  if (abs >= Z_SCORE_CRITICAL) {
    return "critical";
  }
  if (abs >= Z_SCORE_WARNING) {
    return "warning";
  }
  return "normal";
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function allowPdmDemoFallbacks(): boolean {
  return process.env['NODE_ENV'] !== "production" || process.env['ALLOW_PDM_DEMO_FALLBACKS'] === "true";
}

export class ResidualAnalysisService {
  private adapter = new ResidualAnalysisAdapter();

  async computeResiduals(orgId: string, twinId: string): Promise<TwinResidual[]> {
    const [twin] = await db
      .select()
      .from(assetTwins)
      .where(and(eq(assetTwins.orgId, orgId), eq(assetTwins.id, twinId)));
    if (!twin) {
      throw new Error("Twin not found");
    }

    const [template] = await db
      .select()
      .from(assetTwinTemplates)
      .where(and(eq(assetTwinTemplates.orgId, orgId), eq(assetTwinTemplates.id, twin.templateId)));
    if (!template) {
      throw new Error("Twin template not found");
    }

    const [latestState] = await db
      .select()
      .from(assetTwinState)
      .where(and(eq(assetTwinState.orgId, orgId), eq(assetTwinState.twinId, twinId)))
      .orderBy(desc(assetTwinState.timestamp))
      .limit(1);

    const observed: Record<string, number> = latestState
      ? (latestState.observedValues as Record<string, number>)
      : {};
    const expected: Record<string, number> = latestState
      ? (latestState.expectedValues as Record<string, number>)
      : {};

    if (Object.keys(observed).length === 0) {
      if (!allowPdmDemoFallbacks()) {
        throw new Error("No twin state data available for residual analysis; demo fallback disabled in production.");
      }
      logger.warn(String(LOG_MODULE), { details: ["No state data for twin, generating demo fallback residuals", {
        orgId,
        twinId,
      }] });
      return this.generateStubResiduals(orgId, twinId, template.equipmentType);
    }

    const baselines = await db
      .select()
      .from(fleetBaselines)
      .where(
        and(
          eq(fleetBaselines.orgId, orgId),
          eq(fleetBaselines.equipmentType, template.equipmentType)
        )
      );

    const baselineMap: Record<string, { mean: number; stddev: number }> = {};
    for (const b of baselines) {
      baselineMap[b.featureName] = {
        mean: b.mean ?? 0,
        stddev: b.stddev ?? 1,
      };
    }

    const sensorTypes = Array.from(new Set([...Object.keys(observed), ...Object.keys(expected)]));

    const now = new Date();
    const records: InsertTwinResidual[] = [];

    for (const sensorType of sensorTypes) {
      const obs = observed[sensorType];
      const exp = expected[sensorType];
      if (obs == null || exp == null) {
        continue;
      }

      const residual = round(obs - exp);

      const baseline = baselineMap[sensorType] ?? baselineMap[`mean${capitalize(sensorType)}`];
      const stddev = baseline ? baseline.stddev : Math.abs(exp) * 0.1 || 1;
      const zScore = round(stddev > 0 ? residual / stddev : 0);
      const severity = severityFromZScore(zScore);

      records.push({
        orgId,
        twinId,
        timestamp: now,
        sensorType,
        observed: obs,
        expected: exp,
        residual,
        zScore,
        severity,
      });
    }

    const stored = await this.adapter.storeResiduals(records);
    logger.info(String(LOG_MODULE), { details: ["Computed residuals", {
      orgId,
      twinId,
      count: stored.length,
    }] });
    return stored;
  }

  private async generateStubResiduals(
    orgId: string,
    twinId: string,
    equipmentType: string
  ): Promise<TwinResidual[]> {
    const sensorTypes = ["temperature", "vibration", "pressure"];
    const now = new Date();
    const records: InsertTwinResidual[] = sensorTypes.map((sensorType) => {
      const obs = deterministicValue(twinId, `${sensorType}_obs`, 30, 100);
      const exp = deterministicValue(twinId, `${sensorType}_exp`, 30, 100);
      const residual = round(obs - exp);
      const stddev = Math.abs(exp) * 0.1 || 1;
      const zScore = round(residual / stddev);
      return {
        orgId,
        twinId,
        timestamp: now,
        sensorType,
        observed: obs,
        expected: exp,
        residual,
        zScore,
        severity: severityFromZScore(zScore),
      };
    });

    return this.adapter.storeResiduals(records);
  }

  async getResidualsByTwin(orgId: string, twinId: string, limit?: number): Promise<TwinResidual[]> {
    return this.adapter.getResidualsByTwin(orgId, twinId, limit);
  }

  async getResidualRankings(orgId: string) {
    return this.adapter.getResidualRankings(orgId);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function deterministicValue(id: string, seed: string, min: number, max: number): number {
  let hash = 0;
  const str = id + seed;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const normalized = (Math.abs(hash) % 10000) / 10000;
  return round(min + normalized * (max - min));
}

