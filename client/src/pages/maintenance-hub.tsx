import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Wrench, Calendar, FileSpreadsheet, Target, Zap, TrendingUp } from "lucide-react";

const WorkOrders = lazy(() => import("./work-orders"));
const MaintenanceSchedules = lazy(() => import("./maintenance-schedules"));
const MaintenanceTemplates = lazy(() => import("./MaintenanceTemplatesPage"));
const OptimizationTools = lazy(() => import("./optimization-tools"));
const PdmPack = lazy(() => import("./pdm-pack"));
const PdmDashboard = lazy(() => import("./pdm-dashboard"));

const maintenanceItems: GridItem[] = [
  {
    id: "work-orders",
    label: "Work Orders",
    icon: Wrench,
    description: "Active work orders",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <WorkOrders />
      </Suspense>
    ),
    legacyRoutes: ["/work-orders"],
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: Calendar,
    description: "Maintenance schedule",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <MaintenanceSchedules />
      </Suspense>
    ),
    legacyRoutes: ["/maintenance"],
  },
  {
    id: "templates",
    label: "Templates",
    icon: FileSpreadsheet,
    description: "Task templates",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <MaintenanceTemplates />
      </Suspense>
    ),
    legacyRoutes: ["/maintenance-templates"],
  },
  {
    id: "optimization",
    label: "Optimization",
    icon: Target,
    description: "Optimize planning",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <OptimizationTools />
      </Suspense>
    ),
    legacyRoutes: ["/optimization-tools"],
  },
  {
    id: "pdm-pack",
    label: "PdM Pack",
    icon: Zap,
    description: "Predictive maintenance tools",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <PdmPack />
      </Suspense>
    ),
    legacyRoutes: ["/pdm-pack"],
  },
  {
    id: "pdm-dashboard",
    label: "PdM Dashboard",
    icon: TrendingUp,
    description: "Risk queue & fleet health",
    component: (
      <Suspense fallback={<PageLoader variant="cards" />}>
        <PdmDashboard />
      </Suspense>
    ),
    legacyRoutes: ["/pdm-dashboard"],
  },
];

export default function MaintenanceHub() {
  return (
    <IconGridLayout
      title="Maintenance"
      description="Work orders, schedules, templates, and optimization tools"
      items={maintenanceItems}
      defaultItemId="work-orders"
      baseRoute="/maint"
    />
  );
}
