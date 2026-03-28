import { Suspense, lazy } from "react";
import { IconGridLayout, type GridItem } from "@/components/layouts";
import { Users, CalendarCheck, Clock, Shield } from "lucide-react";
import { featureFlags } from "@/lib/feature-flags";

const CrewScheduler = lazy(() => import("./crew-scheduler"));
const SchedulePlanner = lazy(() => import("./schedule-planner"));

function ComplianceOverview() {
  return (
    <div className="p-6">
      <div className="text-center text-muted-foreground py-12">
        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium mb-2">Compliance Overview</h3>
        <p className="text-sm">
          View STCW/MLC compliance status, certification expiries, and crew qualification alerts.
        </p>
        <p className="text-sm mt-2">Coming soon - use Hours of Rest tab for STCW compliance tracking.</p>
      </div>
    </div>
  );
}

const crewItems: GridItem[] = [
  {
    id: "roster",
    label: "Crew Roster",
    icon: Users,
    description: "Manage crew",
    load: () => import("./crew-management"),
    loaderVariant: "table",
    legacyRoutes: ["/crew-management"],
  },
  {
    id: "schedule",
    label: "Schedule Planner",
    icon: CalendarCheck,
    description: "SmartPAL scheduling",
    component: (
      <Suspense fallback={<div className="p-6 text-muted-foreground">Loading scheduler...</div>}>
        {featureFlags.newSchedulerEnabled ? <SchedulePlanner /> : <CrewScheduler />}
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
    component: <ComplianceOverview />,
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
