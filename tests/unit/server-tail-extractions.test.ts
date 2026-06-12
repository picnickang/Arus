import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  matchFailureSignature,
  normalizeSensorType,
} from "../../server/services/anomaly-correlation/anomaly-signatures";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("server tail extractions", () => {
  it("keeps anomaly signature matching behavior in a pure helper", () => {
    expect(normalizeSensorType("main_vibration_sensor")).toBe("vibration");
    expect(normalizeSensorType("fuel-consumption")).toBe("fuel_consumption");

    const match = matchFailureSignature(["vibration", "temperature", "oil_analysis"]);

    expect(match).toMatchObject({
      diagnosis: "Bearing degradation detected",
      rootCause: "Bearing wear, misalignment, or lubrication failure",
      severity: "high",
      confidence: 0.85,
    });
  });

  it("keeps prediction outcome tracker data shapes in a sibling type module", () => {
    const tracker = read("server/services/ml/prediction-outcome-tracker.ts");
    const types = read("server/services/ml/prediction-outcome-tracker-types.ts");

    expect(tracker).toContain('from "./prediction-outcome-tracker-types"');
    expect(tracker).toContain("export class PredictionOutcomeTracker");
    expect(types).toContain("export const DEFAULT_CONFIG");
    expect(types).toContain("export interface OutcomeEvaluationReport");
    expect(types).toContain("export interface EligiblePrediction");
  });

  it("keeps equipment graph side effects in a storage helper", () => {
    const storage = read("server/db/equipment/db-equipment.ts");
    const graphSync = read("server/db/equipment/equipment-graph-sync.ts");

    expect(storage).toContain('from "./equipment-graph-sync.js"');
    expect(storage).toContain("await projectCreatedEquipment(newEquipment)");
    expect(storage).toContain("await syncUpdatedEquipment(updated, priorVesselId)");
    expect(graphSync).toContain("export async function projectCreatedEquipment");
    expect(graphSync).toContain("export async function syncAssociatedEquipment");
    expect(graphSync).toContain("export async function retractDisassociatedEquipment");
  });

  it("keeps migration critical-object metadata in a script helper", () => {
    const migrate = read("server/scripts/migrate.ts");
    const criticalObjects = read("server/scripts/migration-critical-objects.ts");
    const schemaReadme = read("shared/schema/README.md");

    expect(migrate).toContain('from "./migration-critical-objects"');
    expect(migrate).toContain("await assertCriticalObjects(pool)");
    expect(criticalObjects).toContain("export const REQUIRED_INDEXES");
    expect(criticalObjects).toContain("export const REQUIRED_FKS");
    expect(criticalObjects).toContain("export const REQUIRED_COLUMNS");
    expect(schemaReadme).toContain("server/scripts/migration-critical-objects.ts");
  });

  it("keeps prediction calibration math in a sibling helper", () => {
    const service = read("server/services/ml/prediction-calibration.ts");
    const math = read("server/services/ml/prediction-calibration-math.ts");

    expect(service).toContain('from "./prediction-calibration-math"');
    expect(service).toContain("export class PredictionCalibrator");
    expect(math).toContain("export function fitPlattScaling");
    expect(math).toContain("export function fitIsotonicRegression");
    expect(math).toContain("export interface CalibrationReport");
  });

  it("keeps knowledge-base upload middleware behind the route module", () => {
    const routes = read("server/routes/kb-routes.ts");
    const middleware = read("server/routes/kb-upload-middleware.ts");

    expect(routes).toContain('from "./kb-upload-middleware"');
    expect(routes).toContain("export async function registerKnowledgeBaseRoutes");
    expect(routes).toContain('app.use("/api/kb", router)');
    expect(middleware).toContain("export const asyncUpload");
    expect(middleware).toContain("export const syncUpload");
    expect(middleware).toContain("export function handleSingleFileUpload");
    expect(middleware).toContain("Invalid file type. Only PDF, PNG, and JPEG are allowed.");
  });
});
