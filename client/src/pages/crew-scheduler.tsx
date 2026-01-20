import { CrewScheduler } from "@/components/CrewScheduler";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function CrewSchedulerPage() {
  return (
    <PermissionGate resource="crew_schedules" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <div className="p-6">
          <CrewScheduler />
        </div>
      </div>
    </PermissionGate>
  );
}
