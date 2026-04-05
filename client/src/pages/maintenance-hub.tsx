import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Wrench, Calendar, FileSpreadsheet, Brain } from "lucide-react";

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
    id: "equipment-intelligence",
    label: "Equipment Intelligence",
    icon: Brain,
    description: "AI health, predictions & recommendations",
    load: () => import("./equipment-intelligence"),
    loaderVariant: "cards",
    legacyRoutes: ["/equipment-intelligence"],
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
