import { ArrowDown } from "lucide-react";
import { normalizeMobileRole } from "./mobile-readiness-model";
import {
  getMobileReadinessExpectedScreen,
  type MobileReadinessScreenMarker,
} from "./mobile-readiness-route-contract";
import {
  AppHeader,
  Content,
  MobilePageShell,
  QueueCard,
  SectionCard,
  readRoleHint,
  useScreens,
} from "./MobileReadinessShared";
import { MobileFleetPage } from "./MobileReadinessFleetScreens";
import { MobilePdmPage } from "./MobileReadinessPdmScreens";
import { MobileLogsPage, MobileWorkOrdersPage } from "./MobileReadinessWorkLogsScreens";
import {
  MobileCrewPage,
  MobileInventoryPage,
  MobileSettingsPage,
} from "./MobileReadinessAdminScreens";

export { isMobileReadinessReplacementPath } from "./mobile-readiness-route-contract";
export { MobileReadinessBottomNav } from "./MobileReadinessShared";
export { MobileFleetPage, MobileVesselDetailPage } from "./MobileReadinessFleetScreens";
export { MobilePdmPage } from "./MobileReadinessPdmScreens";
export { MobileLogsPage, MobileWorkOrdersPage } from "./MobileReadinessWorkLogsScreens";
export {
  MobileCrewPage,
  MobileInventoryPage,
  MobileSettingsPage,
} from "./MobileReadinessAdminScreens";

type ScreenKind = "today" | "fleet" | "pdm" | "work" | "logs" | "crew" | "inventory" | "settings";

/** Map a fine-grained route screen marker to the bottom-nav ScreenKind. */
function markerToScreenKind(marker: MobileReadinessScreenMarker | null): ScreenKind {
  switch (marker) {
    case "fleet":
    case "vessel-detail":
    case "vessel-diagram":
      return "fleet";
    case "pdm-queue":
    case "pdm-asset-case":
    case "pdm-telemetry":
      return "pdm";
    case "work-queue":
    case "work-execution":
      return "work";
    case "logs":
      return "logs";
    case "crew":
      return "crew";
    case "inventory":
      return "inventory";
    case "settings":
      return "settings";
    case "command":
    default:
      return "today";
  }
}

/** Resolve the bottom-nav ScreenKind for an app path. */
export function pathToScreenKind(path: string): ScreenKind {
  return markerToScreenKind(getMobileReadinessExpectedScreen(path));
}

export function MobileCommandCenterPage({ role }: { role?: string }) {
  const screens = useScreens(role);
  return (
    <MobilePageShell>
      <div data-testid="mobile-readiness-screen-command">
        <AppHeader
          title="ARUS"
          subtitle={screens.today.queueLabel}
          vesselName={screens.today.vesselName}
          roleLabel={screens.today.roleLabel}
        />
        <Content className="max-w-md md:max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-950">Today</h1>
              <p className="text-sm text-slate-500">{screens.today.queueLabel}</p>
            </div>
            <span className="text-sm font-semibold text-brand">
              {screens.today.itemCount} items
            </span>
          </div>
          <SectionCard>
            {screens.today.items.map((item) => (
              <QueueCard key={item.id} item={item} testId={`today-card-${item.id}`} />
            ))}
          </SectionCard>
          <button
            type="button"
            className="mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            Pull to refresh
          </button>
        </Content>
      </div>
    </MobilePageShell>
  );
}

export function MobileReadinessRoute({
  screen,
  currentPath,
}: {
  screen?: ScreenKind;
  currentPath?: string;
}) {
  const resolved: ScreenKind = screen ?? pathToScreenKind(currentPath ?? "/");
  switch (resolved) {
    case "fleet":
      return <MobileFleetPage />;
    case "pdm":
      return <MobilePdmPage />;
    case "work":
      return <MobileWorkOrdersPage />;
    case "logs":
      return <MobileLogsPage />;
    case "crew":
      return <MobileCrewPage />;
    case "inventory":
      return <MobileInventoryPage />;
    case "settings":
      return <MobileSettingsPage />;
    case "today":
    default:
      return <MobileCommandCenterPage role={normalizeMobileRole(readRoleHint())} />;
  }
}

export function MobileReadinessCopilotSuppressionMarker() {
  return null;
}

// Phase 1 (#57) consolidation: surface the unified mobile shell from the
// canonical screens barrel so callers have a single import site.
export { MobileShell } from "./MobileShell";
