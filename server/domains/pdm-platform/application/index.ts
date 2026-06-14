/**
 * PdM Platform — Application Layer (aggregated)
 *
 * Re-exports each sub-context's application service so the meta-domain exposes a
 * single application-layer surface. Sub-contexts remain independently wired
 * (each routes.ts constructs its own service from its adapters); this barrel is
 * the aggregated public entry point for those services.
 */

export { PredictionEngineService } from "../inference/prediction-engine.service.js";
export { PredictionGovernanceService } from "../prediction-governance/prediction-governance.service.js";
export { TrainingPipelineService } from "../training-pipeline/training-pipeline.service.js";
export { TwinUpdateService } from "../twin-updates/twin-update.service.js";
export * as decisionSupport from "../decision-support/application/decision-support.service.js";
export * as twinState from "../digital-twin/twin-state/twin-state.service.js";
export * as residualAnalysis from "../digital-twin/residual-analysis/residual-analysis.service.js";
export * as scenarioSim from "../digital-twin/scenario-sim/scenario-sim.service.js";
