/**
 * PdM Platform — Domain Layer (aggregated)
 *
 * pdm-platform is a meta-domain whose hexagonal layers are distributed across
 * its sub-contexts. This barrel re-exports each sub-context's domain ports/types
 * under a namespace, giving the meta-domain a single domain-layer surface
 * without flattening the sub-contexts. Namespacing avoids symbol collisions
 * across the (independently authored) sub-contexts.
 */

export * as featureStore from "../feature-store/ports.js";
export * as featureStoreTelemetry from "../feature-store/telemetry-port.js";
export * as fleetAnalytics from "../fleet-analytics/ports.js";
export * as modelRegistry from "../model-registry/ports.js";
export * as inference from "../inference/ports.js";
export * as decisionSupport from "../decision-support/domain/ports.js";
export * as decisionSupportTypes from "../decision-support/domain/types.js";
export * as monitoring from "../monitoring/ports.js";
export * as predictionGovernance from "../prediction-governance/ports.js";
export * as trainingPipeline from "../training-pipeline/ports.js";
export * as twinUpdates from "../twin-updates/ports.js";
export * as twinDefinition from "../digital-twin/twin-definition/ports.js";
export * as twinState from "../digital-twin/twin-state/ports.js";
export * as residualAnalysis from "../digital-twin/residual-analysis/ports.js";
export * as scenarioSim from "../digital-twin/scenario-sim/ports.js";
export * as replay from "../digital-twin/replay/ports.js";
