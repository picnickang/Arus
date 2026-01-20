import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Settings, Activity, Shield, Building, Bell, CloudSun } from "lucide-react";

const ConfigurationHub = lazy(() => import("./configuration-hub"));
const SensorsHub = lazy(() => import("./sensors-hub"));
const SystemAdministration = lazy(() => import("./system-administration"));
const OrganizationManagement = lazy(() => import("./organization-management"));
const NotificationsHub = lazy(() => import("./notifications-hub"));
const StormGeoSettings = lazy(() => import("./stormgeo-settings"));

const systemItems: GridItem[] = [
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    description: "System admin",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <SystemAdministration />
      </Suspense>
    ),
    legacyRoutes: ["/system-administration"],
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    description: "System settings",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <ConfigurationHub embedded />
      </Suspense>
    ),
    legacyRoutes: ["/configuration"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Alerts, preferences & templates",
    component: (
      <Suspense fallback={<PageLoader variant="form" />}>
        <NotificationsHub />
      </Suspense>
    ),
    legacyRoutes: ["/notifications", "/notification-settings", "/email-alerts-settings", "/email-templates"],
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: Building,
    description: "Org management",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <OrganizationManagement />
      </Suspense>
    ),
    legacyRoutes: ["/organization-management"],
  },
  {
    id: "sensors",
    label: "Sensors",
    icon: Activity,
    description: "Sensors & templates",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <SensorsHub />
      </Suspense>
    ),
    legacyRoutes: ["/sensors", "/sensor-templates"],
  },
  {
    id: "stormgeo",
    label: "StormGeo",
    icon: CloudSun,
    description: "Weather integration",
    component: (
      <Suspense fallback={<PageLoader variant="form" />}>
        <StormGeoSettings />
      </Suspense>
    ),
    legacyRoutes: ["/stormgeo-settings"],
  },
];

export default function SystemHub() {
  return (
    <IconGridLayout
      title="System"
      description="Configuration, sensors, administration, and integrations"
      items={systemItems}
      defaultItemId="configuration"
      baseRoute="/system"
    />
  );
}
