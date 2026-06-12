import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

describe("client tail component extractions", () => {
  it("keeps engine logbook row-components as the public import path", () => {
    const barrel = read("client/src/components/engine-logbook/row-components.tsx");
    const secondary = read("client/src/components/engine-logbook/row-secondary-components.tsx");

    expect(barrel).toContain('export { EngineEventItem, EngineWatchCard }');
    expect(barrel).toContain('export type { WatchData }');
    expect(secondary).toContain("export function EngineEventItem");
    expect(secondary).toContain("export function EngineWatchCard");
    expect(secondary).toContain('data-testid={`event-${event.id}`}');
    expect(secondary).toContain('data-testid={`input-watch-${period}-chief`}');
  });
  it("keeps logs compliance logbook status rendering in a page part", () => {
    const page = read("client/src/pages/logs-compliance-hub.tsx");
    const parts = read("client/src/pages/logs-compliance-hub-parts.tsx");

    expect(page).toContain('from "./logs-compliance-hub-parts"');
    expect(page).toContain("<LogbookStatusTab />");
    expect(page).toContain('data-testid="tab-logbooks"');
    expect(parts).toContain("export function LogbookStatusTab");
    expect(parts).toContain('href="/stormgeo-settings"');
    expect(parts).toContain("Notification Settings");
  });

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

  it("keeps service request dialog controls behind the service requests page", () => {
    const page = read("client/src/features/serviceRequests/pages/ServiceRequestsPage.tsx");
    const dialogs = read(
      "client/src/features/serviceRequests/pages/ServiceRequestsPageDialogs.tsx"
    );

    expect(page).toContain('from "./ServiceRequestsPageDialogs"');
    expect(page).toContain("<ConvertToSODialog");
    expect(page).toContain("<RejectDialog");
    expect(dialogs).toContain("export function ConvertToSODialog");
    expect(dialogs).toContain("export function RejectDialog");
    expect(dialogs).toContain('data-testid="btn-submit-convert"');
    expect(dialogs).toContain('data-testid="btn-submit-reject"');
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

  it("keeps PDM equipment detail tail tabs in a sibling tab module", () => {
    const page = read("client/src/pages/pdm-equipment-detail.tsx");
    const tabs = read("client/src/pages/pdm-equipment-detail-tabs.tsx");

    expect(page).toContain('from "./pdm-equipment-detail-tabs"');
    expect(page).toContain("<AnomaliesTab equipmentId={equipmentId} />");
    expect(page).toContain("<MaintenanceHistoryTab equipmentId={equipmentId} />");
    expect(tabs).toContain("export function AnomaliesTab");
    expect(tabs).toContain("export function MaintenanceHistoryTab");
    expect(tabs).toContain("No anomalies detected for this equipment.");
    expect(tabs).toContain("No maintenance history for this equipment.");
  });

  it("keeps scheduler qualification helpers behind crew scheduler cards", () => {
    const cards = read("client/src/components/scheduling/crew-scheduler-cards.tsx");
    const qualification = read(
      "client/src/components/scheduling/crew-scheduler-qualification.tsx"
    );

    expect(cards).toContain('from "./crew-scheduler-qualification"');
    expect(cards).toContain("export type { CrewCert, SchedulerCrew }");
    expect(cards).toContain("export function SchedulingConfigCard");
    expect(qualification).toContain("export function QualificationBridge");
    expect(qualification).toContain("export const CREW_CERTIFICATION_TYPES");
    expect(qualification).toContain('data-testid="qualification-bridge"');
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

  it("keeps crew role default fields in a sibling module", () => {
    const manager = read(
      "client/src/components/UnifiedCrewManagement/CrewRoleManager.tsx"
    );
    const defaults = read(
      "client/src/components/UnifiedCrewManagement/CrewRoleManagerDefaults.tsx"
    );

    expect(manager).toContain('from "./CrewRoleManagerDefaults"');
    expect(manager).toContain("<RoleDefaultsFields");
    expect(manager).toContain("export function CrewRoleManager");
    expect(defaults).toContain("export function RoleDefaultsFields");
    expect(defaults).toContain("export function defaultsFromRole");
    expect(defaults).toContain('data-testid={`select-${idPrefix}-department`}');
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
});
