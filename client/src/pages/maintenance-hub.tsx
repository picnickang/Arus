import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Wrench, Calendar, FileSpreadsheet, Target, Zap, TrendingUp } from "lucide-react";

const maintenanceItems: GridItem[] = [
  {
    id: "work-orders",
    label: "Work Orders",
    icon: Wrench,
    description: "Active work orders",
    load: () => import("./work-orders"),
    loaderVariant: "table",
    legacyRoutes: ["/work-orders"],
  },
  {
    id: "schedules",
    label: "Schedules",
    icon: Calendar,
    description: "Maintenance schedule",
    load: () => import("./maintenance-schedules"),
    loaderVariant: "table",
    legacyRoutes: ["/maintenance"],
  },
  {
    id: "templates",
    label: "Templates",
    icon: FileSpreadsheet,
    description: "Task templates",
    load: () => import("./MaintenanceTemplatesPage"),
    loaderVariant: "table",
    legacyRoutes: ["/maintenance-templates"],
  },
  {
    id: "optimization",
    label: "Optimization",
    icon: Target,
    description: "Optimize planning",
    load: () => import("./optimization-tools"),
    loaderVariant: "cards",
    legacyRoutes: ["/optimization-tools"],
  },
  {
    id: "pdm-pack",
    label: "PdM Pack",
    icon: Zap,
    description: "Predictive maintenance tools",
    load: () => import("./pdm-pack"),
    loaderVariant: "cards",
    legacyRoutes: ["/pdm-pack"],
  },
  {
    id: "pdm-dashboard",
    label: "PdM Dashboard",
    icon: TrendingUp,
    description: "Risk queue & fleet health",
    load: () => import("./pdm-dashboard"),
    loaderVariant: "cards",
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
