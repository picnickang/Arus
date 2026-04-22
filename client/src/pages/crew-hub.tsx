import { Suspense, lazy } from "react";
import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Users, CalendarCheck, Clock, Shield } from "lucide-react";

const SchedulePlanner = lazy(() => import("./schedule-planner"));
const ComplianceDashboard = lazy(() => import("@/components/crew/CrewComplianceDashboard"));

const crewItems: GridItem[] = [
  {
    id: "roster",
    label: "Roster",
    icon: Users,
    description: "Manage crew",
    load: () => import("./crew-management"),
    loaderVariant: "table",
    legacyRoutes: ["/crew-management"],
  },
  {
    id: "schedule",
    label: "Scheduling",
    icon: CalendarCheck,
    description: "Plan assignments",
    component: (
      <Suspense fallback={<div className="p-6 text-muted-foreground">Loading scheduler...</div>}>
        <SchedulePlanner />
      </Suspense>
    ),
    legacyRoutes: ["/crew-scheduler", "/schedule-planner"],
  },
  {
    id: "hours-of-rest",
    label: "Hours of Rest",
    icon: Clock,
    description: "Rest compliance",
    load: () => import("./hours-of-rest"),
    loaderVariant: "table",
    legacyRoutes: ["/hours-of-rest"],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: Shield,
    description: "STCW/MLC status",
    component: (
      <Suspense
        fallback={<div className="p-6 text-muted-foreground">Loading compliance data...</div>}
      >
        <ComplianceDashboard />
      </Suspense>
    ),
  },
];

export default function CrewHub() {
  return (
    <IconGridLayout
      title="Crew & Compliance"
      description="Crew management, scheduling, hours of rest, and STCW/MLC compliance"
      items={crewItems}
      defaultItemId="roster"
      baseRoute="/crew"
    />
  );
}
