import { ArrowDown } from "lucide-react";
import { normalizeMobileRole } from "./mobile-readiness-model";
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

export function MobileCommandCenterPage({ role }: { role?: string }) {
  const screens = useScreens(role);
  return (
    <MobilePageShell>
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
          <span className="text-sm font-semibold text-primary">
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
    </MobilePageShell>
  );
}

export function MobileReadinessRoute({ screen }: { screen: ScreenKind }) {
  switch (screen) {
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

export function isMobileReadinessReplacementPath(path: string): boolean {
  const currentPath = (path.split("?")[0] ?? path).split("#")[0] ?? path;
  return (
    currentPath === "/" ||
    currentPath === "/fleet" ||
    currentPath.startsWith("/fleet/") ||
    currentPath === "/vessel-intelligence" ||
    currentPath.startsWith("/vessel-intelligence/") ||
    currentPath === "/maint" ||
    currentPath === "/work-orders" ||
    currentPath.startsWith("/work-orders/") ||
    currentPath === "/pdm-platform" ||
    currentPath.startsWith("/pdm/equipment/") ||
    currentPath === "/logs" ||
    currentPath.startsWith("/logs/") ||
    currentPath === "/crew-management" ||
    currentPath === "/logistics" ||
    currentPath === "/system"
  );
}
