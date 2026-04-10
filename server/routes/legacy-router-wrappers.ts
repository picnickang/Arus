import type { Express } from "express";

type RouterDeps = Record<string, any>;

function wrapRouter(
  importPath: string,
  exportName: string,
  mountPath: string,
  middlewareKeys: string[]
) {
  return async function register(app: Express, deps: RouterDeps) {
    const mod = await import(importPath);
    const router = mod[exportName];
    const middleware = middlewareKeys.map(k => deps[k]).filter(Boolean);
    app.use(mountPath, ...middleware, router);
  };
}

export const registerBeastRoutes = wrapRouter("../beast/index.js", "beastModeRouter", "/api/beast", ["generalApiRateLimit"]);
export const registerGovernanceRoutes = wrapRouter("../governance/routes.js", "default", "/api/governance", ["generalApiRateLimit"]);
export const registerComplianceLegacyRoutes = wrapRouter("../compliance/routes.js", "default", "/api/compliance", ["requireOrgId", "generalApiRateLimit"]);
export const registerSensorBundlesRoutes = wrapRouter("../routes/sensorBundles.js", "default", "/api/sensor-bundles", ["generalApiRateLimit"]);
export const registerSensorTemplatesRoutes = wrapRouter("../routes/sensorTemplates.js", "default", "/api/sensor-templates", ["generalApiRateLimit"]);
export const registerSuppliersRoutes = wrapRouter("../suppliers/index.js", "suppliersRouter", "/api", ["requireOrgId", "generalApiRateLimit"]);
export const registerPurchasingRoutes = wrapRouter("../purchasing/index.js", "purchasingRouter", "/api", ["requireOrgId", "generalApiRateLimit"]);
export const registerServiceOrdersRoutes = wrapRouter("../service-orders/index.js", "serviceOrderRoutes", "/api/service-orders", ["requireOrgId", "generalApiRateLimit"]);
export const registerDiagnosticsRoutes = wrapRouter("../routes/diagnostics.js", "default", "/api/diagnostics", ["generalApiRateLimit"]);
export const registerMlAiStudioRoutes = wrapRouter("../ml-routes.js", "mlRouter", "/api", ["requireOrgId", "generalApiRateLimit"]);
export const registerAgentLegacyRoutes = wrapRouter("../routes/agent-routes.js", "default", "/api", []);
export const registerPdmDashboardRoutes = wrapRouter("../pdm/routes.js", "pdmRouter", "/api/pdm", ["requireOrgId", "generalApiRateLimit"]);
export const registerPdmFeatureStoreRoutes = wrapRouter("../domains/pdm-platform/feature-store/routes.js", "featureStoreRouter", "/api/pdm/features", ["requireOrgId", "generalApiRateLimit"]);
export const registerPdmFleetAnalyticsRoutes = wrapRouter("../domains/pdm-platform/fleet-analytics/routes.js", "fleetAnalyticsRouter", "/api/pdm/fleet", ["requireOrgId", "generalApiRateLimit"]);
export const registerPdmModelRegistryRoutes = wrapRouter("../domains/pdm-platform/model-registry/routes.js", "modelRegistryRouter", "/api/pdm/models", ["requireOrgId", "generalApiRateLimit"]);
export const registerPdmInferenceRoutes = wrapRouter("../domains/pdm-platform/inference/routes.js", "inferenceRouter", "/api/pdm/infer", ["requireOrgId", "generalApiRateLimit"]);
export const registerPdmMonitoringRoutes = wrapRouter("../domains/pdm-platform/monitoring/routes.js", "monitoringRouter", "/api/pdm/drift", ["requireOrgId", "generalApiRateLimit"]);
export const registerTwinDefinitionRoutes = wrapRouter("../domains/pdm-platform/digital-twin/twin-definition/routes.js", "twinDefinitionRouter", "/api/pdm/twin/def", ["requireOrgId", "generalApiRateLimit"]);
export const registerTwinStateRoutes = wrapRouter("../domains/pdm-platform/digital-twin/twin-state/routes.js", "twinStateRouter", "/api/pdm/twin/state", ["requireOrgId", "generalApiRateLimit"]);
export const registerResidualAnalysisRoutes = wrapRouter("../domains/pdm-platform/digital-twin/residual-analysis/routes.js", "residualAnalysisRouter", "/api/pdm/twin/residuals", ["requireOrgId", "generalApiRateLimit"]);
export const registerScenarioSimRoutes = wrapRouter("../domains/pdm-platform/digital-twin/scenario-sim/routes.js", "scenarioSimRouter", "/api/pdm/twin/scenarios", ["requireOrgId", "generalApiRateLimit"]);
export const registerReplayRoutes = wrapRouter("../domains/pdm-platform/digital-twin/replay/routes.js", "replayRouter", "/api/pdm/twin/replay", ["requireOrgId", "generalApiRateLimit"]);
export const registerTwinUpdatesRoutes = wrapRouter("../domains/pdm-platform/twin-updates/routes.js", "twinUpdatesRouter", "/api/pdm/twin/updates", ["requireOrgId", "generalApiRateLimit"]);
export const registerTrainingPipelineRoutes = wrapRouter("../domains/pdm-platform/training-pipeline/routes.js", "trainingPipelineRouter", "/api/pdm/training", ["requireOrgId", "generalApiRateLimit"]);
export const registerEquipmentIntelligenceRoutes = wrapRouter("../domains/equipment-intelligence/interfaces/routes.js", "default", "/api/equipment-intelligence", ["requireOrgId", "generalApiRateLimit"]);
export const registerPredictionGovernanceRoutes = wrapRouter("../domains/pdm-platform/prediction-governance/routes.js", "predictionGovernanceRouter", "/api/pdm/governance", ["requireOrgId", "generalApiRateLimit"]);
export const registerAmosImportRoutes = wrapRouter("../import-adapters/amos/index.js", "amosImportRouter", "/", ["generalApiRateLimit"]);
export const registerShipmateImportRoutes = wrapRouter("../import-adapters/shipmate/index.js", "shipmateImportRouter", "/api/import/shipmate", []);
