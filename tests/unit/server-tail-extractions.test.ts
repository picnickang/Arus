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

  it("keeps crew-extension persistence helpers behind the storage module", () => {
    const storage = read("server/db/crew-extensions/db-crew-extensions.ts");
    const notifications = read(
      "server/db/crew-extensions/db-crew-extension-notifications.ts"
    );
    const scheduling = read("server/db/crew-extensions/db-crew-extension-scheduling.ts");

    expect(storage).toContain('from "./db-crew-extension-notifications.js"');
    expect(storage).toContain('from "./db-crew-extension-scheduling.js"');
    expect(storage).toContain("export class DbCrewExtensionsStorage");
    expect(notifications).toContain("export async function upsertCrewNotificationSettings");
    expect(notifications).toContain("export async function acknowledgeCrewAlert");
    expect(scheduling).toContain("export async function getPortCalls");
    expect(scheduling).toContain("export async function getDrydockWindows");
  });

  it("keeps data anonymization field classification in a pure helper", () => {
    const service = read("server/compliance/data-anonymization/service.ts");
    const helper = read("server/compliance/data-anonymization/field-classification.ts");

    expect(service).toContain('from "./field-classification.js"');
    expect(service).toContain("export class DataAnonymizationService");
    expect(helper).toContain("export function isPotentialPiiField");
    expect(helper).toContain("export function isSensitiveFieldName");
    expect(helper).toContain("export function isLikelyPiiString");
  });

  it("keeps patch-applicator backup lifecycle in a sibling helper", () => {
    const applicator = read("server/services/patch-applicator.ts");
    const backups = read("server/services/patch-applicator-backups.ts");

    expect(applicator).toContain('from "./patch-applicator-backups"');
    expect(applicator).toContain("export class PatchApplicator");
    expect(backups).toContain("export async function createPatchBackup");
    expect(backups).toContain("export async function rollbackPatchBackup");
    expect(backups).toContain("export function listPatchBackups");
    expect(backups).toContain("export function cleanOldPatchBackups");
  });

  it("keeps crew application port contracts beside the service shell", () => {
    const service = read("server/domains/crew/application/crew-service.ts");
    const ports = read("server/domains/crew/application/crew-service-ports.ts");

    expect(service).toContain('from "./crew-service-ports.js"');
    expect(service).toContain("export class CrewApplicationService");
    expect(service).toContain("CrewStoragePort");
    expect(service).toContain("PermissionRolesPort");
    expect(ports).toContain("export interface CrewServiceDependencies");
    expect(ports).toContain("export interface CrewExtensionsStoragePort");
  });

  it("keeps vessel-diagram in-memory record helpers beside the store", () => {
    const store = read(
      "server/domains/vessel-diagram-registry/infrastructure/in-memory-store.ts"
    );
    const helpers = read(
      "server/domains/vessel-diagram-registry/infrastructure/in-memory-store-helpers.ts"
    );

    expect(store).toContain('from "./in-memory-store-helpers.js"');
    expect(store).toContain("export class InMemoryVesselDiagramRegistryStore");
    expect(helpers).toContain("export function buildSectionMap");
    expect(helpers).toContain("export function applySectionMapUpdate");
    expect(helpers).toContain("export function buildEquipmentAssignment");
  });

  it("keeps PDM Postgres presentation mappers beside the repository", () => {
    const repository = read("server/pdm/adapters/pdm-postgres.repository.ts");
    const mappers = read("server/pdm/adapters/pdm-postgres-mappers.ts");

    expect(repository).toContain('from "./pdm-postgres-mappers"');
    expect(repository).toContain("export class PdmPostgresRepository");
    expect(mappers).toContain("export function mapRiskQueueRows");
    expect(mappers).toContain("export function generateEvidenceChips");
    expect(mappers).toContain("export function formatTimeAgo");
  });

  it("keeps equipment-intelligence Postgres helpers beside the repository", () => {
    const repository = read(
      "server/domains/equipment-intelligence/infrastructure/postgres-repository.ts"
    );
    const helpers = read(
      "server/domains/equipment-intelligence/infrastructure/postgres-repository-helpers.ts"
    );

    expect(repository).toContain('from "./postgres-repository-helpers.js"');
    expect(repository).toContain("export class PostgresEquipmentIntelligenceRepository");
    expect(helpers).toContain("export function computeRisk");
    expect(helpers).toContain("export function mapWorkOrderSummaryRow");
    expect(helpers).toContain("export function recommendedActionText");
  });

  it("keeps equipment hub summary and timeline helpers beside the repository", () => {
    const repository = read(
      "server/domains/equipment-intelligence/infrastructure/hub-repository.ts"
    );
    const helpers = read(
      "server/domains/equipment-intelligence/infrastructure/hub-repository-helpers.ts"
    );
    const timeline = read(
      "server/domains/equipment-intelligence/infrastructure/hub-repository-timeline.ts"
    );

    expect(repository).toContain('from "./hub-repository-helpers.js"');
    expect(repository).toContain('from "./hub-repository-timeline.js"');
    expect(repository).toContain("export class PostgresEquipmentHubRepository");
    expect(repository).toContain("return getActivityTimelineForEquipment");
    expect(helpers).toContain("export function computeRisk");
    expect(helpers).toContain("export function collectInsightSignals");
    expect(helpers).toContain("export async function fetchWorkOrders");
    expect(timeline).toContain("export async function getActivityTimelineForEquipment");
    expect(timeline).toContain('type: "telemetry_anomaly"');
  });

  it("keeps WO-SO bridge operations behind the route compatibility module", () => {
    const routes = read("server/routes/wo-so-bridge-routes.ts");
    const operations = read("server/routes/wo-so-bridge-operations.ts");

    expect(routes).toContain('from "./wo-so-bridge-operations"');
    expect(routes).toContain("export function registerWoSoBridgeRoutes");
    expect(routes).toContain("export type { CreatedServiceOrderRow, CreateSOParams }");
    expect(operations).toContain("export async function createServiceOrderFromWorkOrder");
    expect(operations).toContain("export async function syncWorkOrderFromServiceOrders");
    expect(operations).toContain("export interface CreateSOParams");
  });

  it("keeps service request route groups behind the route facade", () => {
    const routes = read("server/routes/service-request-routes.ts");
    const readRoutes = read("server/routes/service-request-read-routes.ts");
    const editRoutes = read("server/routes/service-request-edit-routes.ts");
    const reviewRoutes = read("server/routes/service-request-review-routes.ts");
    const utils = read("server/routes/service-request-route-utils.ts");

    expect(routes).toContain("export function registerServiceRequestRoutes");
    expect(routes).toContain("registerServiceRequestReadRoutes(app");
    expect(routes).toContain("registerServiceRequestEditRoutes(app");
    expect(routes).toContain("registerServiceRequestReviewRoutes(app");
    expect(readRoutes).toContain('"/api/service-requests"');
    expect(readRoutes).toContain('"/api/work-orders/:id/service-requests"');
    expect(editRoutes).toContain('"/api/service-requests/:id"');
    expect(editRoutes).toContain('"/api/work-orders/:id/service-requests"');
    expect(reviewRoutes).toContain('"/api/service-requests/:id/review"');
    expect(reviewRoutes).toContain('"/api/service-requests/:id/convert"');
    expect(utils).toContain("export function getOrgId");
    expect(utils).toContain("export interface ServiceRequestRow");
  });

  it("keeps agent suggestion support helpers beside the engine shell", () => {
    const engine = read("server/domains/agent/application/suggestion-engine.ts");
    const support = read("server/domains/agent/application/suggestion-engine-support.ts");

    expect(engine).toContain('from "./suggestion-engine-support"');
    expect(engine).toContain("export class SuggestionEngine");
    expect(engine).toContain("await summarizeSuggestionsWithAi(this.repo, newSuggestions)");
    expect(support).toContain("export const DEFAULT_PREFERENCES");
    expect(support).toContain("export function meetsMinSeverity");
    expect(support).toContain("export function buildPredictionCostLine");
    expect(support).toContain("export async function queueSuggestionNotifications");
  });

  it("keeps agent orchestrator loop and context behind the facade", () => {
    const orchestrator = read("server/domains/agent/application/orchestrator.ts");
    const context = read(
      "server/domains/agent/application/orchestrator-helpers/context.ts"
    );
    const iterationLoop = read(
      "server/domains/agent/application/orchestrator-helpers/iteration-loop.ts"
    );
    const types = read("server/domains/agent/application/orchestrator-types.ts");

    expect(orchestrator).toContain('from "./orchestrator-helpers/context"');
    expect(orchestrator).toContain('from "./orchestrator-helpers/iteration-loop"');
    expect(orchestrator).toContain("export class AgentOrchestrator");
    expect(orchestrator).toContain("executeAgentLoop(");
    expect(context).toContain("export async function buildAgentMessages");
    expect(context).toContain("export async function appendAgentFileContext");
    expect(iterationLoop).toContain("export async function executeAgentLoop");
    expect(iterationLoop).toContain("getToolOpenAIDefinitions");
    expect(types).toContain("export interface RunContext");
    expect(types).toContain("export interface LoopResult");
  });

  it("keeps equipment lifecycle route groups behind the route module", () => {
    const routes = read("server/domains/equipment/routes.ts");
    const lifecycleRoutes = read("server/domains/equipment/lifecycle-routes.ts");

    expect(routes).toContain('from "./lifecycle-routes"');
    expect(routes).toContain("export function registerEquipmentRoutes");
    expect(routes).toContain("registerEquipmentLifecycleRoutes(app");
    expect(lifecycleRoutes).toContain("export function registerEquipmentLifecycleRoutes");
    expect(lifecycleRoutes).toContain('"/api/equipment/:id/decommission"');
    expect(lifecycleRoutes).toContain('"/api/equipment/:equipmentId/compatible-parts"');
  });

  it("keeps scheduling settings routes behind the scheduling route module", () => {
    const routes = read("server/domains/scheduling/routes.ts");
    const settingsRoutes = read("server/domains/scheduling/scheduling-settings-routes.ts");

    expect(routes).toContain('from "./scheduling-settings-routes"');
    expect(routes).toContain("export function registerSchedulingRoutes");
    expect(routes).toContain("registerSchedulingSettingsRoutes(app");
    expect(settingsRoutes).toContain("export function registerSchedulingSettingsRoutes");
    expect(settingsRoutes).toContain('"/api/scheduling-settings"');
    expect(settingsRoutes).toContain('"/api/scheduling-settings/rotation-templates"');
  });

  it("keeps me-portal task feed assembly beside the service shell", () => {
    const service = read("server/domains/me-portal/me-portal-service.ts");
    const taskFeed = read("server/domains/me-portal/me-portal-task-feed.ts");

    expect(service).toContain('from "./me-portal-task-feed"');
    expect(service).toContain("export class MePortalService");
    expect(service).toContain("return buildMePortalTasks(user");
    expect(taskFeed).toContain("export async function buildMePortalTasks");
    expect(taskFeed).toContain("scopeForSource(configs, \"work_orders\")");
    expect(taskFeed).toContain("link: `/crew-management?taskId=${task.id}`");
  });

  it("keeps purchase-order fulfillment routes behind the PO router", () => {
    const routes = read("server/purchasing/po-routes.ts");
    const fulfillmentRoutes = read("server/purchasing/po-fulfillment-routes.ts");

    expect(routes).toContain('from "./po-fulfillment-routes"');
    expect(routes).toContain("registerPurchaseOrderFulfillmentRoutes(router");
    expect(routes).toContain("export default router");
    expect(fulfillmentRoutes).toContain("export function registerPurchaseOrderFulfillmentRoutes");
    expect(fulfillmentRoutes).toContain('"/:id/fulfill-pr"');
    expect(fulfillmentRoutes).toContain('"/:id/events"');
    expect(fulfillmentRoutes).toContain("await fulfillItem");
  });

  it("keeps ML promotion routes behind the model route shell", () => {
    const routes = read("server/ml-routes/model-routes.ts");
    const promotionRoutes = read("server/ml-routes/model-promotion-routes.ts");

    expect(routes).toContain('from "./model-promotion-routes.js"');
    expect(routes).toContain("registerModelPromotionRoutes(router)");
    expect(routes).toContain("export const modelRoutes = router");
    expect(promotionRoutes).toContain("export function registerModelPromotionRoutes");
    expect(promotionRoutes).toContain('"/ml/models/:id/promote/request"');
    expect(promotionRoutes).toContain('"/ml/models/:id/promote"');
    expect(promotionRoutes).toContain('"/ml/models/:id/rollback"');
    expect(promotionRoutes).toContain("PROMOTION_SELF_APPROVAL_FORBIDDEN");
  });

  it("keeps data privacy DSAR routes behind the data privacy route shell", () => {
    const routes = read("server/compliance/routes/data-privacy-routes.ts");
    const dsarRoutes = read("server/compliance/routes/data-privacy-dsar-routes.ts");

    expect(routes).toContain('from "./data-privacy-dsar-routes"');
    expect(routes).toContain("registerDataPrivacyDsarRoutes(router)");
    expect(routes).toContain("export { router as complianceDataPrivacyRouter }");
    expect(dsarRoutes).toContain("export function registerDataPrivacyDsarRoutes");
    expect(dsarRoutes).toContain('"/dsar/:id/execute-erasure"');
    expect(dsarRoutes).toContain('"/dsar/statistics"');
    expect(dsarRoutes).toContain("dbGdprStorage.collectUserDataForDsar");
  });

  it("keeps ML analytics cloud helpers behind the storage shell", () => {
    const storage = read("server/db/ml-analytics/db-ml-analytics.ts");
    const cloud = read("server/db/ml-analytics/db-ml-analytics-cloud.ts");

    expect(storage).toContain('from "./db-ml-analytics-cloud.js"');
    expect(storage).toContain("export class DatabaseMlAnalyticsStorage");
    expect(storage).toContain("return getFeatureImportancesByPrediction");
    expect(storage).toContain("return expireEngineerOverride");
    expect(storage).toContain("return createRulModel(model)");
    expect(cloud).toContain("export async function getCalibrationCurves");
    expect(cloud).toContain("export async function createEngineerOverride");
    expect(cloud).toContain("export async function getRulModels");
  });

  it("keeps analytics finance and history helpers behind the storage shell", () => {
    const storage = read("server/db/analytics/db-analytics.ts");
    const finance = read("server/db/analytics/db-analytics-finance-inventory.ts");
    const history = read("server/db/analytics/db-analytics-history.ts");

    expect(storage).toContain('from "./db-analytics-finance-inventory.js"');
    expect(storage).toContain('from "./db-analytics-history.js"');
    expect(storage).toContain("export class DatabaseAnalyticsStorage");
    expect(storage).toContain("return updatePartCost(partId, updateData, orgId)");
    expect(storage).toContain("return getMetricsHistory(orgId, days)");
    expect(finance).toContain("export async function updatePartStockQuantities");
    expect(finance).toContain("export async function updateExpenseStatus");
    expect(history).toContain("export async function recordMetricsHistory");
    expect(history).toContain("export async function getLatestInsightSnapshot");
  });

  it("keeps object storage client, content-type, and signing helpers behind the service shell", () => {
    const storage = read("server/objectStorage.ts");
    const client = read("server/objectStorage-client.ts");
    const contentType = read("server/objectStorage-content-type.ts");
    const paths = read("server/objectStorage-paths.ts");

    expect(storage).toContain('from "./objectStorage-client"');
    expect(storage).toContain('from "./objectStorage-content-type"');
    expect(storage).toContain('from "./objectStorage-paths"');
    expect(storage).toContain("export class ObjectStorageService");
    expect(storage).toContain("export { getObjectStorageClient }");
    expect(storage).toContain("export { pickSafeContentType, sniffMimeFamily }");
    expect(client).toContain("export async function getObjectStorageClient");
    expect(contentType).toContain("export function sniffMimeFamily");
    expect(contentType).toContain("export function pickSafeContentType");
    expect(paths).toContain("export function parseObjectPath");
    expect(paths).toContain("export async function signObjectURL");
  });

  it("keeps enhanced report artifacts and formatting behind the tool registration shell", () => {
    const tools = read("server/domains/agent/tools/enhanced-report-tools.ts");
    const artifacts = read("server/domains/agent/tools/enhanced-report-artifacts.ts");
    const formatters = read("server/domains/agent/tools/enhanced-report-formatters.ts");

    expect(tools).toContain('from "./enhanced-report-artifacts"');
    expect(tools).toContain('from "./enhanced-report-formatters"');
    expect(tools).toContain('name: "generateReport"');
    expect(tools).toContain('name: "shareReport"');
    expect(tools).toContain("export { getReportArtifact }");
    expect(artifacts).toContain("export function getReportArtifact");
    expect(artifacts).toContain("export async function storeReportArtifact");
    expect(formatters).toContain("export function resolveAudience");
    expect(formatters).toContain("export async function generatePdfBuffer");
  });

  it("keeps checklist workflow and work-order records behind the checklist storage shell", () => {
    const storage = read("server/db/checklists/db-checklists.ts");
    const workflow = read("server/db/checklists/db-checklists-template-workflow.ts");
    const workOrders = read("server/db/checklists/db-checklists-work-order-records.ts");

    expect(storage).toContain('from "./db-checklists-work-order-records.js"');
    expect(storage).toContain("export class DatabaseChecklistsStorage");
    expect(storage).toContain("extends DatabaseChecklistWorkOrderRecordsStorage");
    expect(workflow).toContain("export class DatabaseChecklistTemplateWorkflowStorage");
    expect(workflow).toContain("async cloneMaintenanceTemplate");
    expect(workflow).toContain("async initializeChecklistFromTemplate");
    expect(workOrders).toContain("extends DatabaseChecklistTemplateWorkflowStorage");
    expect(workOrders).toContain("async getWorkOrderTasks");
    expect(workOrders).toContain("async calculateWorklogCosts");
  });

  it("keeps scheduler simulation and run actions behind the controller facade", () => {
    const controller = read("server/scheduler/scheduler-controller.ts");
    const inputs = read("server/scheduler/scheduler-controller-inputs.ts");
    const simulation = read("server/scheduler/scheduler-controller-simulation.ts");
    const runs = read("server/scheduler/scheduler-controller-runs.ts");

    expect(controller).toContain('from "./scheduler-controller-inputs.js"');
    expect(controller).toContain('from "./scheduler-controller-simulation.js"');
    expect(controller).toContain('from "./scheduler-controller-runs.js"');
    expect(controller).toContain("export async function planAndMaybeExecute");
    expect(controller).toContain("export type { SimulatedAssignment, SimulationResult }");
    expect(inputs).toContain("export async function loadShiftTemplates");
    expect(inputs).toContain("export function aggregateReasons");
    expect(simulation).toContain("export async function simulateSchedule");
    expect(simulation).toContain("export async function applySimulatedSchedule");
    expect(runs).toContain("export async function cancelScheduleRun");
    expect(runs).toContain("export async function clearSchedulerRunHistory");
  });
});
