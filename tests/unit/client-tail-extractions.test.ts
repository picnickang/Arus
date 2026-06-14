import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("client tail component extractions", () => {
  it("keeps agent activity route rendering split behind the page", () => {
    const page = read("client/src/pages/agent-activity.tsx");
    const parts = read("client/src/pages/agent-activity-parts.tsx");

    expect(page).toContain('from "./agent-activity-parts"');
    expect(page).toContain("<SummaryMetrics summary={summary} />");
    expect(page).toContain("<ActivityRow key={item.id} item={item} />");
    expect(parts).toContain("export function SummaryMetrics");
    expect(parts).toContain("export function ActivityRow");
    expect(parts).toContain("data-testid={`activity-row-${item.id}`}");
  });

  it("keeps schedule planner vessel queries in a read-model helper", () => {
    const readModel = read(
      "server/domains/crew-extensions/infrastructure/schedule-planner-read-model.ts"
    );
    const vesselQueries = read(
      "server/domains/crew-extensions/infrastructure/schedule-planner-vessel-queries.ts"
    );

    expect(readModel).toContain('from "./schedule-planner-vessel-queries.js"');
    expect(readModel).toContain("fetchVessels(filter.orgId, filter.vesselIds)");
    expect(vesselQueries).toContain("export async function fetchVessels");
    expect(vesselQueries).toContain("export async function fetchCurrentCrewPerVessel");
    expect(vesselQueries).toContain("export async function fetchRequiredCrewPerVessel");
  });

  it("keeps shift-planning data shapes in a hook type module", () => {
    const hook = read("client/src/features/crew/hooks/useShiftPlanning.ts");
    const types = read("client/src/features/crew/hooks/useShiftPlanningTypes.ts");

    expect(hook).toContain('from "./useShiftPlanningTypes"');
    expect(hook).toContain("export function useShiftPlanning");
    expect(types).toContain("export interface SchedulePlanPayload");
    expect(types).toContain("export interface EnhancedSchedulePayload");
    expect(types).toContain("export interface ShiftPlanningCrewCertification");
  });

  it("keeps analytics hub presentation pieces in a page part", () => {
    const page = read("client/src/pages/analytics-hub.tsx");
    const parts = read("client/src/pages/analytics-hub-parts.tsx");

    expect(page).toContain('from "./analytics-hub-parts"');
    expect(page).toContain("<PredictiveInsightsCard />");
    expect(page).toContain("<KeyFindings");
    expect(parts).toContain("export function PredictiveInsightsCard");
    expect(parts).toContain("export function DomainStrip");
    expect(parts).toContain('data-testid="predictive-insights"');
  });

  it("keeps system settings OpenAI key controls in a sibling card", () => {
    const tab = read("client/src/components/admin/SystemSettingsTab.tsx");
    const card = read("client/src/components/admin/SystemSettingsOpenAIKeyCard.tsx");

    expect(tab).toContain('from "./SystemSettingsOpenAIKeyCard"');
    expect(tab).toContain("<OpenAIKeyCard />");
    expect(tab).toContain("export const SystemSettingsTab");
    expect(card).toContain("export function OpenAIKeyCard");
    expect(card).toContain('data-testid="card-openai-settings"');
    expect(card).toContain('data-testid="button-save-key"');
  });

  it("keeps knowledge-base upload and search widgets in page parts", () => {
    const page = read("client/src/pages/knowledge-base.tsx");
    const parts = read("client/src/pages/knowledge-base-parts.tsx");

    expect(page).toContain('from "./knowledge-base-parts"');
    expect(page).toContain("<UploadDropZone");
    expect(page).toContain("<SemanticSearchResults");
    expect(parts).toContain("export function UploadDropZone");
    expect(parts).toContain("export function DocumentFilterBar");
    expect(parts).toContain("export function SemanticSearchResults");
    expect(parts).toContain('data-testid="upload-dropzone"');
  });

  it("keeps desktop setup backend controls in a sibling steps module", () => {
    const page = read("client/src/pages/desktop-setup.tsx");
    const steps = read("client/src/pages/desktop-setup-steps.tsx");

    expect(page).toContain('from "./desktop-setup-steps"');
    expect(page).toContain("<BackendStep");
    expect(page).toContain("function SignInStep");
    expect(page).toContain("/api/portal/login");
    expect(steps).toContain("export function BackendStep");
    expect(steps).toContain("export function StepIndicator");
    expect(steps).toContain("testBackendConnection");
    expect(steps).toContain('data-testid="step-indicator"');
  });

  it("keeps route resource mapping behind navigation config", () => {
    const config = read("client/src/config/navigationConfig.ts");
    const resources = read("client/src/config/navigationResources.ts");

    expect(config).toContain('export { routeResourceMap } from "./navigationResources"');
    expect(config).toContain("export const navigationCategories");
    expect(config).toContain("export const ADMIN_ONLY_ROUTES");
    expect(resources).toContain("export const routeResourceMap");
    expect(resources).toContain('"/system-administration": "system_settings"');
  });

  it("keeps query request helpers behind the queryClient public module", () => {
    const queryClient = read("client/src/lib/queryClient.ts");
    const request = read("client/src/lib/queryClient-request.ts");

    expect(queryClient).toContain('from "@/lib/queryClient-request"');
    expect(queryClient).toContain("export const queryClient");
    expect(queryClient).toContain("export function replayQueuedApiRequests");
    expect(queryClient).toContain("apiRequest");
    expect(queryClient).toContain("apiFormDataRequest");
    expect(queryClient).toContain("createHeaders");
    expect(request).toContain("export async function apiRequest");
    expect(request).toContain("export async function apiFormDataRequest");
    expect(request).toContain("export function getQueryFn");
    expect(request).toContain("export class TenantQuotaExceededError");
    expect(request).toContain("queueOfflineApiRequest");
  });

  it("keeps work-order detail drawer presentation behind sibling modules", () => {
    const drawer = read("client/src/components/work-orders/WorkOrderDetailDrawer.tsx");
    const parts = read("client/src/components/work-orders/WorkOrderDetailDrawerParts.tsx");
    const costTime = read("client/src/components/work-orders/WorkOrderDetailCostTime.tsx");
    const actions = read("client/src/components/work-orders/WorkOrderDetailDrawerActions.tsx");

    expect(drawer).toContain('from "./WorkOrderDetailDrawerParts"');
    expect(drawer).toContain('from "./WorkOrderDetailDrawerActions"');
    expect(drawer).toContain("export function WorkOrderDetailDrawer");
    expect(parts).toContain("export function WorkOrderDetailTabs");
    expect(parts).toContain('data-testid="tab-wo-details"');
    expect(parts).toContain('from "./WorkOrderDetailCostTime"');
    expect(costTime).toContain("export function CostBreakdown");
    expect(costTime).toContain('data-testid="cost-grand-total"');
    expect(actions).toContain("export function WorkOrderDrawerActions");
    expect(actions).toContain('data-testid="button-complete-wo-drawer"');
    expect(actions).toContain('data-testid="button-delete-wo-drawer"');
  });

  it("keeps equipment form fields behind the public dialog component", () => {
    const dialog = read("client/src/components/equipment/EquipmentFormDialog.tsx");
    const fields = read("client/src/components/equipment/EquipmentFormFields.tsx");

    expect(dialog).toContain('from "./EquipmentFormFields"');
    expect(dialog).toContain("export function EquipmentFormDialog");
    expect(dialog).toContain("export function EquipmentCreateDialog");
    expect(dialog).toContain("export function EquipmentEditDialog");
    expect(fields).toContain("export function EquipmentFormFields");
    expect(fields).toContain('data-testid={`form-${isCreate ? "create" : "edit"}-equipment`}');
    expect(fields).toContain('data-testid={`button-submit-${isCreate ? "create" : "edit"}`}');
    expect(fields).toContain("data-testid={`input-${testIdPrefix}service-life-hours`}");
  });

  it("keeps equipment decommission sections behind the public dialog component", () => {
    const dialog = read("client/src/components/equipment/EquipmentDecommissionDialog.tsx");
    const model = read("client/src/components/equipment/EquipmentDecommissionDialogModel.ts");
    const sections = read(
      "client/src/components/equipment/EquipmentDecommissionDialogSections.tsx"
    );
    const optionalSections = read(
      "client/src/components/equipment/EquipmentDecommissionDialogOptionalSections.tsx"
    );

    expect(dialog).toContain('from "./EquipmentDecommissionDialogModel"');
    expect(dialog).toContain('from "./EquipmentDecommissionDialogSections"');
    expect(dialog).toContain('from "./EquipmentDecommissionDialogOptionalSections"');
    expect(dialog).toContain("<DecommissionReasonFields");
    expect(dialog).toContain("<DecommissionFinancialSummary");
    expect(dialog).toContain("export function EquipmentDecommissionDialog");
    expect(model).toContain("export const decommissionFormSchema");
    expect(model).toContain("export function calculateDepreciation");
    expect(sections).toContain("export function DecommissionReasonFields");
    expect(sections).toContain("export function DecommissionFinancialSummary");
    expect(sections).toContain('data-testid="select-decommission-reason"');
    expect(sections).toContain('data-testid="button-submit-decommission"');
    expect(optionalSections).toContain("export function DecommissionSaleDetails");
    expect(optionalSections).toContain("export function DecommissionDisposalDetails");
    expect(optionalSections).toContain('data-testid="collapsible-sale-details"');
    expect(optionalSections).toContain('data-testid="collapsible-disposal-details"');
  });

  it("keeps mobile readiness screen clusters behind the route shell", () => {
    const route = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const shared = read("client/src/features/mobile-readiness/MobileReadinessShared.tsx");
    const fleet = read("client/src/features/mobile-readiness/MobileReadinessFleetScreens.tsx");
    const pdm = read("client/src/features/mobile-readiness/MobileReadinessPdmScreens.tsx");
    const workLogs = read(
      "client/src/features/mobile-readiness/MobileReadinessWorkLogsScreens.tsx"
    );
    const admin = read("client/src/features/mobile-readiness/MobileReadinessAdminScreens.tsx");

    expect(route).toContain('from "./MobileReadinessFleetScreens"');
    expect(route).toContain('from "./MobileReadinessPdmScreens"');
    expect(route).toContain('from "./MobileReadinessWorkLogsScreens"');
    expect(route).toContain('from "./MobileReadinessAdminScreens"');
    expect(route).toContain("export function MobileReadinessRoute");
    expect(shared).toContain("export function MobilePageShell");
    expect(shared).toContain("export function MobileReadinessBottomNav");
    expect(fleet).toContain("export function MobileFleetPage");
    expect(fleet).toContain("export function MobileVesselDetailPage");
    expect(pdm).toContain("export function MobilePdmPage");
    expect(pdm).toContain("Telemetry Evidence");
    expect(workLogs).toContain("export function MobileWorkOrdersPage");
    expect(workLogs).toContain("export function MobileLogsPage");
    expect(workLogs).toContain("function MobileWorkExecutionPage");
    expect(admin).toContain("export function MobileCrewPage");
    expect(admin).toContain("export function MobileInventoryPage");
    expect(admin).toContain("export function MobileSettingsPage");
  });

  it("keeps scheduling rotation templates behind the settings tab shell", () => {
    const tab = read("client/src/components/admin/SchedulingSettingsTab.tsx");
    const rotation = read("client/src/components/admin/SchedulingSettingsRotationSection.tsx");

    expect(tab).toContain('from "./SchedulingSettingsRotationSection"');
    expect(tab).toContain("<RotationTemplatesSection />");
    expect(tab).toContain("export function SchedulingSettingsTab");
    expect(rotation).toContain("export function RotationTemplatesSection");
    expect(rotation).toContain("data-testid={`button-set-default-${template.id}`}");
    expect(rotation).toContain("data-testid={`button-delete-template-${template.id}`}");
    expect(rotation).toContain('data-testid="button-add-template"');
  });

  it("keeps scheduled report creation controls behind the route shell", () => {
    const page = read("client/src/pages/scheduled-reports.tsx");
    const dialog = read("client/src/pages/scheduled-reports-create-dialog.tsx");
    const form = read("client/src/pages/scheduled-reports-form.ts");

    expect(page).toContain('from "./scheduled-reports-create-dialog"');
    expect(page).toContain('from "./scheduled-reports-form"');
    expect(page).toContain("<CreateScheduleDialog");
    expect(dialog).toContain("export function CreateScheduleDialog");
    expect(dialog).toContain('data-testid="button-create-schedule"');
    expect(dialog).toContain('data-testid="input-schedule-name"');
    expect(dialog).toContain('data-testid="button-submit-schedule"');
    expect(form).toContain("export const createScheduleFormSchema");
    expect(form).toContain("export type CreateScheduleForm");
  });

  it("keeps operations telemetry streams behind the mode shell", () => {
    const mode = read("client/src/components/analytics/OperationsMode.tsx");
    const telemetry = read("client/src/components/analytics/OperationsModeTelemetryStreams.tsx");

    expect(mode).toContain('from "./OperationsModeTelemetryStreams"');
    expect(mode).toContain("<OperationsModeTelemetryStreams />");
    expect(mode).toContain("export function OperationsMode");
    expect(telemetry).toContain("export function OperationsModeTelemetryStreams");
    expect(telemetry).toContain('data-testid="select-vessel"');
    expect(telemetry).toContain('data-testid="select-equipment"');
    expect(telemetry).toContain('data-testid="button-refresh-streams"');
  });

  it("keeps work-order form fields behind the public dialog shell", () => {
    const dialog = read("client/src/components/work-orders/WorkOrderFormDialog.tsx");
    const fields = read("client/src/components/work-orders/WorkOrderFormFields.tsx");

    expect(dialog).toContain('from "./WorkOrderFormFields"');
    expect(dialog).toContain("<WorkOrderFormFields");
    expect(dialog).toContain("export function WorkOrderFormDialog");
    expect(fields).toContain("export function WorkOrderFormFields");
    expect(fields).toContain('data-testid="select-maintenance-type"');
    expect(fields).toContain('data-testid="input-planned-start-date"');
    expect(fields).toContain('data-testid="checkbox-affects-downtime"');
    expect(fields).toContain('data-testid="button-submit"');
  });

  it("keeps equipment dependency editor surfaces behind the admin route shell", () => {
    const page = read("client/src/pages/admin/equipment-dependencies.tsx");
    const model = read("client/src/pages/admin/equipment-dependencies-model.ts");
    const state = read("client/src/pages/admin/equipment-dependencies-state.ts");
    const parts = read("client/src/pages/admin/equipment-dependencies-parts.tsx");

    expect(page).toContain('from "./equipment-dependencies-state"');
    expect(page).toContain('from "./equipment-dependencies-parts"');
    expect(page).toContain("useEquipmentDependenciesPageState");
    expect(page).toContain("<DependencyGraphTab");
    expect(page).toContain("<DependencyBulkTab");
    expect(page).toContain("<EdgeNotesDialog");
    expect(model).toContain("export function parseCsv");
    expect(model).toContain("export function circularLayout");
    expect(state).toContain('from "./equipment-dependencies-model"');
    expect(state).toContain("export function useEquipmentDependenciesPageState");
    expect(parts).toContain("export function DependencyGraphTab");
    expect(parts).toContain("export function DependencyBulkTab");
    expect(parts).toContain("export function EdgeNotesDialog");
    expect(parts).toContain('data-testid="graph-canvas"');
    expect(parts).toContain('data-testid="button-import-csv"');
    expect(parts).toContain('data-testid="dialog-edge-notes"');
  });

  it("keeps ML training route surfaces behind sibling page modules", () => {
    const page = read("client/src/pages/ml-training.tsx");
    const tabs = read("client/src/pages/ml-training-tabs.tsx");
    const trainingTabs = read("client/src/pages/ml-training-training-tabs.tsx");
    const modelsTab = read("client/src/pages/ml-training-models-tab.tsx");
    const resetTab = read("client/src/pages/ml-training-reset-tab.tsx");
    const exportCard = read("client/src/pages/ml-training-export-card.tsx");

    expect(page).toContain('from "./ml-training-tabs"');
    expect(page).toContain('from "./ml-training-export-card"');
    expect(page).toContain("<MLTrainingTabs");
    expect(page).toContain("<MLTrainingExportCard");
    expect(tabs).toContain("export function MLTrainingTabs");
    expect(tabs).toContain("<LstmTrainingTab");
    expect(tabs).toContain("<ResetDataTab");
    expect(trainingTabs).toContain("export function LstmTrainingTab");
    expect(trainingTabs).toContain("export function RandomForestTrainingTab");
    expect(trainingTabs).toContain("export function AcousticAnalysisTab");
    expect(modelsTab).toContain("export function TrainedModelsTab");
    expect(resetTab).toContain("export function ResetDataTab");
    expect(exportCard).toContain("export function MLTrainingExportCard");
    expect(exportCard).toContain('data-testid="button-export-complete-json"');
  });

  it("keeps AI health training tab surfaces behind sibling modules", () => {
    const tab = read("client/src/components/ai-health/TrainingTab.tsx");
    const shell = read("client/src/components/ai-health/TrainingTabShell.tsx");
    const trainingSections = read(
      "client/src/components/ai-health/TrainingTabTrainingSections.tsx"
    );
    const managementSections = read(
      "client/src/components/ai-health/TrainingTabManagementSections.tsx"
    );

    expect(tab).toContain('from "./TrainingTabShell"');
    expect(tab).toContain("<TrainingTabShell");
    expect(shell).toContain("export function TrainingTabShell");
    expect(shell).toContain("<LstmTrainingSection");
    expect(shell).toContain("<ResetTrainingDataSection");
    expect(trainingSections).toContain("export function LstmTrainingSection");
    expect(trainingSections).toContain("export function RandomForestTrainingSection");
    expect(trainingSections).toContain("export function AcousticAnalysisSection");
    expect(managementSections).toContain("export function TrainedModelsSection");
    expect(managementSections).toContain("export function DataExportSection");
    expect(managementSections).toContain("export function ResetTrainingDataSection");
    expect(managementSections).toContain('data-testid="button-reset-ml-data-keep-models"');
  });

  it("keeps admin 3D model management behind route shell modules", () => {
    const page = read("client/src/pages/admin/3d-models.tsx");
    const model = read("client/src/pages/admin/3d-models-model.ts");
    const card = read("client/src/pages/admin/3d-models-card.tsx");
    const history = read("client/src/pages/admin/3d-models-history-panel.tsx");
    const pins = read("client/src/pages/admin/3d-models-pin-editor.tsx");

    expect(page).toContain('from "./3d-models-card"');
    expect(page).toContain('from "./3d-models-model"');
    expect(page).toContain("<VesselModelCard");
    expect(model).toContain("export function formatBytes");
    expect(model).toContain("export interface ModelMetadata");
    expect(card).toContain("export function VesselModelCard");
    expect(card).toContain("<PinEditor");
    expect(card).toContain("<HistoryPanel");
    expect(history).toContain("export function HistoryPanel");
    expect(pins).toContain("export function PinEditor");
    expect(pins).toContain("data-testid={`pin-editor-${vesselId}`}");
    expect(pins).toContain("data-testid={`viewer-3d-${vesselId}`}");
  });

  it("keeps Copilot admin configuration behind sibling modules", () => {
    const page = read("client/src/pages/copilot-admin.tsx");
    const types = read("client/src/pages/copilot-admin-types.ts");
    const dialog = read("client/src/pages/copilot-admin-config-dialog.tsx");

    expect(page).toContain('from "./copilot-admin-config-dialog"');
    expect(page).toContain('from "./copilot-admin-types"');
    expect(page).toContain("<ConfigDialog");
    expect(types).toContain("export interface AgentConfig");
    expect(types).toContain("export interface CopilotUsageStats");
    expect(types).toContain("export interface CopilotEffectivenessSummary");
    expect(dialog).toContain("export function ConfigDialog");
    expect(dialog).toContain('data-testid="button-save-config"');
    expect(dialog).toContain('data-testid="select-permission-tier"');
  });

  it("keeps system administration tabs behind the route shell", () => {
    const page = read("client/src/pages/system-administration.tsx");
    const config = read("client/src/pages/system-administration-configuration-tab.tsx");
    const software = read("client/src/pages/system-administration-software-updates-tab.tsx");
    const github = read("client/src/pages/system-administration-github-settings-tab.tsx");

    expect(page).toContain('from "./system-administration-configuration-tab"');
    expect(page).toContain('from "./system-administration-software-updates-tab"');
    expect(page).toContain("<ConfigurationTab />");
    expect(page).toContain("<SoftwareUpdatesTab />");
    expect(config).toContain("export function ConfigurationTab");
    expect(config).toContain('data-testid="input-current-password"');
    expect(config).toContain('data-testid="button-submit-password-change"');
    expect(software).toContain("export function SoftwareUpdatesTab");
    expect(software).toContain("<GitHubSettingsTab />");
    expect(software).toContain('data-testid="button-check-updates"');
    expect(github).toContain("export function GitHubSettingsTab");
    expect(github).toContain("data-testid={`button-select-repo-${repo.name}`}");
  });

  it("keeps findings page presentation controls behind the route shell", () => {
    const page = read("client/src/pages/findings.tsx");
    const parts = read("client/src/pages/findings-page-parts.tsx");

    expect(page).toContain('from "./findings-page-parts"');
    expect(page).toContain("<FindingsPageHeader");
    expect(page).toContain("<SummaryStrip");
    expect(page).toContain("<FilterBar");
    expect(parts).toContain("export function FindingsPageHeader");
    expect(parts).toContain("export function RunOutputDialog");
    expect(parts).toContain("export function OutcomeDialog");
    expect(parts).toContain("export function SummaryStrip");
    expect(parts).toContain("export function FilterBar");
    expect(parts).toContain('data-testid="dialog-run-output"');
    expect(parts).toContain('data-testid="filter-source"');
  });

  it("keeps finance mode KPI and savings-claim surfaces behind the mode shell", () => {
    const mode = read("client/src/components/analytics/FinanceMode.tsx");
    const kpis = read("client/src/components/analytics/FinanceModeKpiCards.tsx");
    const savings = read("client/src/components/analytics/FinanceModeSavingsClaims.tsx");

    expect(mode).toContain('from "./FinanceModeKpiCards"');
    expect(mode).toContain('from "./FinanceModeSavingsClaims"');
    expect(mode).toContain("<FinanceModeKpiCards");
    expect(mode).toContain("<SavingsClaimsSection");
    expect(kpis).toContain("export function FinanceModeKpiCards");
    expect(kpis).toContain('data-testid="card-total-savings"');
    expect(kpis).toContain('data-testid="card-savings-integrity"');
    expect(savings).toContain("export function SavingsClaimsSection");
    expect(savings).toContain("export interface SavingsRecord");
    expect(savings).toContain('data-testid="savings-claims-list"');
    expect(savings).toContain("data-testid={`button-dispute-${savingsId}`}");
  });

  it("keeps crew management utility groups behind compatibility exports", () => {
    const utils = read("client/src/features/crew/lib/crewManagementUtils.ts");
    const roles = read("client/src/features/crew/lib/crewManagementRoles.ts");
    const vessels = read("client/src/features/crew/lib/crewManagementVesselGroups.ts");
    const offboarding = read("client/src/features/crew/lib/crewManagementOffboarding.ts");

    expect(utils).toContain('export * from "./crewManagementRoles"');
    expect(utils).toContain('export * from "./crewManagementVesselGroups"');
    expect(utils).toContain('export * from "./crewManagementOffboarding"');
    expect(roles).toContain("export function formatRank");
    expect(roles).toContain("export function groupCrewByRole");
    expect(roles).toContain("export function buildRoleLookup");
    expect(vessels).toContain("export function groupCrewByVessel");
    expect(vessels).toContain('export const RELIEF_POOL_ID = "__relief_pool__"');
    expect(offboarding).toContain("export function deriveRehireStatus");
    expect(offboarding).toContain("export function composeOffboardingNote");
  });

  it("keeps hours-of-rest hook actions and types behind the public hook path", () => {
    const hook = read("client/src/features/crew/hooks/useHoursOfRestData.ts");
    const actions = read("client/src/features/crew/hooks/useHoursOfRestActions.ts");
    const types = read("client/src/features/crew/hooks/useHoursOfRestDataTypes.ts");

    expect(hook).toContain('from "./useHoursOfRestActions"');
    expect(hook).toContain('from "./useHoursOfRestDataTypes"');
    expect(hook).toContain("useHoursOfRestActions");
    expect(actions).toContain("export function useHoursOfRestActions");
    expect(actions).toContain("copyMonthToYear");
    expect(actions).toContain("loadFromProposedPlan");
    expect(types).toContain("export interface ComplianceResult");
    expect(types).toContain("export interface HoursOfRestMeta");
    expect(types).toContain("export interface UseHoursOfRestDataReturn");
  });

  it("keeps maintenance schedules surfaces behind the route shell", () => {
    const page = read("client/src/pages/maintenance-schedules.tsx");
    const sections = read("client/src/pages/maintenance-schedules-sections.tsx");
    const calendar = read("client/src/pages/maintenance-schedules-calendar.tsx");
    const dialogs = read("client/src/pages/maintenance-schedules-dialogs.tsx");

    expect(page).toContain('from "./maintenance-schedules-sections"');
    expect(page).toContain('from "./maintenance-schedules-dialogs"');
    expect(page).toContain("<MaintenanceScheduleSections");
    expect(page).toContain("<MaintenanceScheduleDialogs");
    expect(sections).toContain('from "./maintenance-schedules-calendar"');
    expect(sections).toContain("export function MaintenanceScheduleSections");
    expect(sections).toContain('data-testid="input-search-schedules"');
    expect(sections).toContain("data-testid={`button-view-schedule-${schedule.id}`}");
    expect(calendar).toContain("export function CalendarView");
    expect(calendar).toContain('data-testid="button-current-week"');
    expect(dialogs).toContain("export function MaintenanceScheduleDialogs");
    expect(dialogs).toContain('data-testid="create-schedule-modal"');
    expect(dialogs).toContain('data-testid="edit-schedule-modal"');
  });

  it("keeps organization management lists and dialogs behind the route shell", () => {
    const page = read("client/src/pages/organization-management.tsx");
    const sections = read("client/src/pages/organization-management-sections.tsx");
    const dialogs = read("client/src/pages/organization-management-dialogs.tsx");

    expect(page).toContain('from "./organization-management-sections"');
    expect(page).toContain('from "./organization-management-dialogs"');
    expect(page).toContain("<OrganizationManagementSections");
    expect(page).toContain("<OrganizationManagementDialogs");
    expect(sections).toContain("export function OrganizationManagementSections");
    expect(sections).toContain("function getRoleIcon");
    expect(sections).toContain('data-testid="input-search"');
    expect(sections).toContain("data-testid={`row-organization-${org.id}`}");
    expect(sections).toContain("data-testid={`button-password-user-mobile-${user.id}`}");
    expect(dialogs).toContain("export function OrganizationManagementDialogs");
    expect(dialogs).toContain('data-testid="dialog-organization"');
    expect(dialogs).toContain('data-testid="dialog-user"');
    expect(dialogs).toContain('data-testid="dialog-password"');
  });

  it("keeps maintenance template cards and dialogs behind the route shell", () => {
    const page = read("client/src/pages/MaintenanceTemplatesPage.tsx");
    const cards = read("client/src/pages/MaintenanceTemplatesPageCards.tsx");
    const dialogs = read("client/src/pages/MaintenanceTemplatesPageDialogs.tsx");

    expect(page).toContain('from "./MaintenanceTemplatesPageCards"');
    expect(page).toContain('from "./MaintenanceTemplatesPageDialogs"');
    expect(page).toContain("<TemplateCard");
    expect(page).toContain("<MaintenanceTemplateDialogs");
    expect(cards).toContain("export function TemplateCard");
    expect(cards).toContain("export function ChecklistSection");
    expect(cards).toContain("export function ViewTemplateContent");
    expect(cards).toContain("data-testid={`template-card-${template.id}`}");
    expect(cards).toContain('data-testid="button-add-item"');
    expect(dialogs).toContain("export function MaintenanceTemplateDialogs");
    expect(dialogs).toContain('data-testid="dialog-title"');
    expect(dialogs).toContain('data-testid="view-dialog-title"');
    expect(dialogs).toContain('data-testid="button-confirm-delete"');
  });

  it("keeps AI health performance tab sections behind the tab shell", () => {
    const tab = read("client/src/components/ai-health/PerformanceTab.tsx");
    const summary = read("client/src/components/ai-health/PerformanceTabSummary.tsx");
    const sections = read("client/src/components/ai-health/PerformanceTabSections.tsx");
    const explainability = read("client/src/components/ai-health/PerformanceTabExplainability.tsx");

    expect(tab).toContain('from "./PerformanceTabSummary"');
    expect(tab).toContain('from "./PerformanceTabSections"');
    expect(tab).toContain('from "./PerformanceTabExplainability"');
    expect(tab).toContain("<PerformanceStatsCards");
    expect(tab).toContain("<PerformanceDiagnosticSections");
    expect(tab).toContain("<PerformanceExplainabilitySection");
    expect(summary).toContain("export function AccuracyBadge");
    expect(summary).toContain("export function PerformanceStatsCards");
    expect(summary).toContain("export function ModelSummaryCard");
    expect(summary).toContain('data-testid="stat-active-models"');
    expect(sections).toContain("export function PerformanceDiagnosticSections");
    expect(sections).toContain("export function MarineAndValidationSections");
    expect(sections).toContain("data-testid={`drift-alert-${idx}`}");
    expect(sections).toContain("data-testid={`row-validation-${index}`}");
    expect(explainability).toContain("export function PerformanceExplainabilitySection");
    expect(explainability).toContain('data-testid="select-filter-equipment"');
  });

  it("keeps AI health vessel intelligence behind the insights tab shell", () => {
    const tab = read("client/src/components/ai-health/InsightsTab.tsx");
    const vessel = read("client/src/components/ai-health/InsightsTabVesselIntelligence.tsx");

    expect(tab).toContain('from "./InsightsTabVesselIntelligence"');
    expect(tab).toContain("<VesselIntelligenceSection />");
    expect(tab).toContain("export default function InsightsTab");
    expect(vessel).toContain("export function VesselIntelligenceSection");
    expect(vessel).toContain('data-testid="select-vessel-intelligence"');
    expect(vessel).toContain('data-testid="button-load-intelligence"');
  });

  it("keeps vessel management actions, table, and dialogs behind the route shell", () => {
    const page = read("client/src/pages/vessel-management/index.tsx");
    const table = read("client/src/pages/vessel-management/VesselManagementFleetTable.tsx");
    const dialogs = read("client/src/pages/vessel-management/VesselManagementDialogs.tsx");
    const types = read("client/src/pages/vessel-management/VesselManagementTypes.ts");

    expect(page).toContain('from "./VesselManagementFleetTable"');
    expect(page).toContain('from "./VesselManagementDialogs"');
    expect(page).toContain("<VesselManagementActions");
    expect(page).toContain("<VesselFleetOverview");
    expect(page).toContain("<VesselManagementDialogs");
    expect(page).toContain("export default function VesselManagement");
    expect(table).toContain("export function VesselFleetOverview");
    expect(table).toContain("data-testid={`button-view-${vessel.id}`}");
    expect(dialogs).toContain("export function VesselManagementActions");
    expect(dialogs).toContain("export function VesselManagementDialogs");
    expect(dialogs).toContain('data-testid="input-vessel-name"');
    expect(dialogs).toContain('data-testid="button-update-vessel"');
    expect(dialogs).toContain('data-testid="button-confirm-delete"');
    expect(types).toContain("export type VesselManagementModel");
  });

  it("keeps diagnostics health panels behind the dashboard route shell", () => {
    const page = read("client/src/pages/DiagnosticsDashboard.tsx");
    const health = read("client/src/pages/DiagnosticsDashboardHealthTab.tsx");
    const types = read("client/src/pages/DiagnosticsDashboardTypes.ts");

    expect(page).toContain('from "./DiagnosticsDashboardHealthTab"');
    expect(page).toContain("<DiagnosticsHealthTab");
    expect(page).toContain("<DiagnosticsStatusIcon");
    expect(page).toContain("export default function DiagnosticsDashboard");
    expect(health).toContain("export function DiagnosticsHealthTab");
    expect(health).toContain("export function DiagnosticsStatusIcon");
    expect(health).toContain('data-testid="card-overall-status"');
    expect(health).toContain('data-testid="card-database-check"');
    expect(health).toContain('data-testid="card-services"');
    expect(types).toContain("export type DiagnosticsDashboardModel");
  });

  it("keeps sensor setup bundle selection behind the wizard shell", () => {
    const wizard = read("client/src/components/sensors/SensorSetupWizard.tsx");
    const bundle = read("client/src/components/sensors/SensorSetupWizardBundleStep.tsx");

    expect(wizard).toContain('from "./SensorSetupWizardBundleStep"');
    expect(wizard).toContain("<BundleStep");
    expect(wizard).toContain("export function SensorSetupWizard");
    expect(bundle).toContain("export function BundleStep");
    expect(bundle).toContain('data-testid="bundle-option-custom"');
    expect(bundle).toContain("data-testid={`checkbox-template-${template.kind}`}");
    expect(bundle).toContain('data-testid="button-next-step"');
  });

  it("keeps equipment page stats, tabs, and dialogs behind the route shell", () => {
    const page = read("client/src/pages/equipment/index.tsx");
    const stats = read("client/src/pages/equipment/EquipmentPageStats.tsx");
    const tabs = read("client/src/pages/equipment/EquipmentPageTabs.tsx");
    const dialogs = read("client/src/pages/equipment/EquipmentPageDialogs.tsx");

    expect(page).toContain('from "./EquipmentPageStats"');
    expect(page).toContain('from "./EquipmentPageTabs"');
    expect(page).toContain('from "./EquipmentPageDialogs"');
    expect(page).toContain("<EquipmentPageStats");
    expect(page).toContain("<EquipmentRegistryTabs");
    expect(page).toContain("<EquipmentPageDialogs");
    expect(stats).toContain("export function EquipmentPageStats");
    expect(stats).toContain('data-testid="button-add-equipment"');
    expect(tabs).toContain("export function EquipmentRegistryTabs");
    expect(tabs).toContain('data-testid="tab-active-equipment"');
    expect(tabs).toContain("data-testid={`button-sensors-mobile-${item.id}`}");
    expect(dialogs).toContain("export function EquipmentPageDialogs");
    expect(dialogs).toContain("<SensorSetupWizard");
    expect(dialogs).toContain("<EquipmentDecommissionDialog");
  });

  it("keeps linked service order cards and request dialog behind the public panel", () => {
    const panel = read("client/src/components/work-orders/LinkedServiceOrdersPanel.tsx");
    const cards = read("client/src/components/work-orders/LinkedServiceOrdersPanelCards.tsx");
    const dialog = read("client/src/components/work-orders/LinkedServiceRequestDialog.tsx");

    expect(panel).toContain('from "./LinkedServiceOrdersPanelCards"');
    expect(panel).toContain('from "./LinkedServiceRequestDialog"');
    expect(panel).toContain("<ServiceRequestCard");
    expect(panel).toContain("<ServiceOrderCard");
    expect(panel).toContain("<CreateServiceRequestDialog");
    expect(panel).toContain('data-testid="linked-service-orders-panel"');
    expect(cards).toContain("export function ServiceOrderCard");
    expect(cards).toContain("export function ServiceRequestCard");
    expect(cards).toContain("data-testid={`linked-so-${so.id}`}");
    expect(cards).toContain("data-testid={`timeline-${so.id}`}");
    expect(dialog).toContain("export function CreateServiceRequestDialog");
    expect(dialog).toContain('data-testid="button-submit-service-request"');
  });

  it("keeps findings cards and tasks behind the public findings card barrel", () => {
    const barrel = read("client/src/pages/findings-cards.tsx");
    const types = read("client/src/pages/findings-card-types.ts");
    const cards = read("client/src/pages/findings-card-renderers.tsx");
    const tasks = read("client/src/pages/findings-task-cards.tsx");

    expect(barrel).toContain('from "./findings-card-types"');
    expect(barrel).toContain('from "./findings-card-renderers"');
    expect(barrel).toContain('from "./findings-task-cards"');
    expect(barrel).toContain("export type {");
    expect(barrel).toContain("export { FindingCard, EntityLink, timeAgo }");
    expect(barrel).toContain("export { TaskCard, TasksSection }");
    expect(types).toContain("export interface UnifiedFindingItem");
    expect(types).toContain("export interface AgentTask");
    expect(types).toContain("export const OUTCOME_CATEGORIES");
    expect(cards).toContain("export function FindingCard");
    expect(cards).toContain("export function EntityLink");
    expect(cards).toContain("data-testid={`finding-card-${item.id}`}");
    expect(cards).toContain("data-testid={`button-assistant-${item.id}`}");
    expect(tasks).toContain("export function TaskCard");
    expect(tasks).toContain("export function TasksSection");
    expect(tasks).toContain("data-testid={`task-card-${task.id}`}");
    expect(tasks).toContain('data-testid="tasks-section"');
  });

  it("keeps agent chat panel shell and input hooks behind the public panel", () => {
    const panel = read("client/src/components/agent/AgentChatPanel/index.tsx");
    const shell = read("client/src/components/agent/AgentChatPanel/AgentChatPanelShell.tsx");
    const attachments = read(
      "client/src/components/agent/AgentChatPanel/useAgentChatAttachments.ts"
    );
    const voice = read("client/src/components/agent/AgentChatPanel/useAgentChatVoice.ts");

    expect(panel).toContain('from "./AgentChatPanelShell"');
    expect(panel).toContain('from "./useAgentChatAttachments"');
    expect(panel).toContain('from "./useAgentChatVoice"');
    expect(panel).toContain("<AgentChatPanelShell");
    expect(panel).toContain("export function AgentChatPanel");
    expect(shell).toContain("export function AgentChatPanelShell");
    expect(shell).toContain('data-testid="card-agent-chat-panel"');
    expect(shell).toContain('data-testid="button-show-history"');
    expect(shell).toContain("<MessageInputBar");
    expect(attachments).toContain("export function useAgentChatAttachments");
    expect(attachments).toContain("handleFileSelect");
    expect(attachments).toContain("handleDrop");
    expect(voice).toContain("export function useAgentChatVoice");
    expect(voice).toContain("SpeechRecognition");
    expect(voice).toContain("toggleVoiceInput");
  });

  it("keeps schedule planner types, filters, and sync helpers behind the public hook", () => {
    const hook = read("client/src/features/crew/hooks/useSchedulePlannerData.ts");
    const types = read("client/src/features/crew/hooks/useSchedulePlannerDataTypes.ts");
    const filters = read("client/src/features/crew/hooks/useSchedulePlannerFilters.ts");
    const sync = read("client/src/features/crew/hooks/useSchedulePlannerSync.ts");

    expect(hook).toContain('from "./useSchedulePlannerDataTypes"');
    expect(hook).toContain('from "./useSchedulePlannerFilters"');
    expect(hook).toContain('from "./useSchedulePlannerSync"');
    expect(hook).toContain("useSchedulePlannerSync()");
    expect(hook).toContain("export function useSchedulePlannerData");
    expect(hook).toContain("export type {");
    expect(types).toContain("export interface ScheduleAssignment");
    expect(types).toContain("export interface PlannerCrewMember");
    expect(types).toContain("export interface SchedulePlannerPendingOperation");
    expect(filters).toContain("export function getDateRangeFromPreset");
    expect(filters).toContain("export function loadPersistedFilters");
    expect(filters).toContain("export function persistFilters");
    expect(sync).toContain("export function useSchedulePlannerSync");
    expect(sync).toContain("flushPendingOperations");
    expect(sync).toContain('"/api/crew-extensions/assignments"');
  });

  it("keeps StormGeo settings form and imports behind the public panel", () => {
    const panel = read("client/src/components/stormgeo-settings.tsx");
    const form = read("client/src/components/stormgeo-settings-form.tsx");
    const imports = read("client/src/components/stormgeo-import-history.tsx");
    const types = read("client/src/components/stormgeo-settings-types.ts");

    expect(panel).toContain('from "./stormgeo-settings-form"');
    expect(panel).toContain('from "./stormgeo-import-history"');
    expect(panel).toContain("<StormGeoSettingsForm");
    expect(panel).toContain("<StormGeoImportHistory");
    expect(panel).toContain("export function StormGeoSettingsPanel");
    expect(form).toContain("export function StormGeoSettingsForm");
    expect(form).toContain('data-testid="select-stormgeo-vessel"');
    expect(form).toContain('data-testid="button-save-stormgeo-settings"');
    expect(imports).toContain("export function StormGeoImportHistory");
    expect(imports).toContain('data-testid="button-import-stormgeo"');
    expect(imports).toContain('data-testid="input-stormgeo-file"');
    expect(types).toContain("export type StormGeoSettingsModel");
  });
});
