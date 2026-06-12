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
    expect(parts).toContain('data-testid={`activity-row-${item.id}`}');
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
    expect(types).toContain("export interface CrewCertification");
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
    const actions = read("client/src/components/work-orders/WorkOrderDetailDrawerActions.tsx");

    expect(drawer).toContain('from "./WorkOrderDetailDrawerParts"');
    expect(drawer).toContain('from "./WorkOrderDetailDrawerActions"');
    expect(drawer).toContain("export function WorkOrderDetailDrawer");
    expect(parts).toContain("export function WorkOrderDetailTabs");
    expect(parts).toContain('data-testid="tab-wo-details"');
    expect(parts).toContain('data-testid="cost-grand-total"');
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
    expect(fields).toContain('data-testid={`input-${testIdPrefix}service-life-hours`}');
  });

  it("keeps mobile readiness screen clusters behind the route shell", () => {
    const route = read("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const shared = read("client/src/features/mobile-readiness/MobileReadinessShared.tsx");
    const fleet = read("client/src/features/mobile-readiness/MobileReadinessFleetScreens.tsx");
    const pdm = read("client/src/features/mobile-readiness/MobileReadinessPdmScreens.tsx");
    const workLogs = read("client/src/features/mobile-readiness/MobileReadinessWorkLogsScreens.tsx");
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
    expect(rotation).toContain('data-testid={`button-set-default-${template.id}`}');
    expect(rotation).toContain('data-testid={`button-delete-template-${template.id}`}');
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

});
