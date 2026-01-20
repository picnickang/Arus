import { Suspense, lazy } from "react";
import { IconGridLayout, PageLoader, type GridItem } from "@/components/layouts";
import { Users, CalendarCheck, Clock, Shield } from "lucide-react";
import { featureFlags } from "@/lib/feature-flags";

const CrewManagement = lazy(() => import("./crew-management"));
const CrewScheduler = lazy(() => import("./crew-scheduler"));
const SchedulePlanner = lazy(() => import("./schedule-planner"));
const HoursOfRest = lazy(() => import("./hours-of-rest"));

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
    description: "Team members",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <CrewManagement />
      </Suspense>
    ),
    legacyRoutes: ["/crew-management"],
  },
  {
    id: "schedule",
    label: "Schedule Planner",
    icon: CalendarCheck,
    description: "SmartPAL scheduling",
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
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
    component: (
      <Suspense fallback={<PageLoader variant="table" />}>
        <HoursOfRest />
      </Suspense>
    ),
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
