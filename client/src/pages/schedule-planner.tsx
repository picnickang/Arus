import { SchedulePlanner } from "@/components/scheduling/SchedulePlanner";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function SchedulePlannerPage() {
  return (
    <PermissionGate resource="crew_schedules" action="view" fallback={<PagePermissionDenied />}>
      <div className="flex flex-col h-screen">
        <div className="flex-1 overflow-hidden">
          <SchedulePlanner />
        </div>
      </div>
    </PermissionGate>
  );
}
