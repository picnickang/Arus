/**
 * PdM Platform — Interfaces Layer (aggregated)
 *
 * pdm-platform is a meta-domain: each sub-context (feature-store, inference,
 * digital-twin/*, decision-support, ...) is independently hexagonally layered.
 * This barrel aggregates every sub-context's HTTP router into a single
 * interfaces entry, so the domain root exposes one interfaces surface; the
 * domain-router registry mounts each router from here.
 */

export { featureStoreRouter } from "../feature-store/routes.js";
export { pdmHealthRouter } from "../health/routes.js";
export { fleetAnalyticsRouter } from "../fleet-analytics/routes.js";
export { modelRegistryRouter } from "../model-registry/routes.js";
export { inferenceRouter } from "../inference/routes.js";
export { pdmDecisionSupportRouter } from "../decision-support/interfaces/routes.js";
export { monitoringRouter } from "../monitoring/routes.js";
export { predictionGovernanceRouter } from "../prediction-governance/routes.js";
export { trainingPipelineRouter } from "../training-pipeline/routes.js";
export { twinUpdatesRouter } from "../twin-updates/routes.js";
export { twinDefinitionRouter } from "../digital-twin/twin-definition/routes.js";
export { twinStateRouter } from "../digital-twin/twin-state/routes.js";
export { residualAnalysisRouter } from "../digital-twin/residual-analysis/routes.js";
export { scenarioSimRouter } from "../digital-twin/scenario-sim/routes.js";
export { replayRouter } from "../digital-twin/replay/routes.js";
