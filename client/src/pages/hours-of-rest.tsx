import { HoursOfRestGrid } from "@/components/HoursOfRestGrid";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function HoursOfRestPage() {
  return (
    <PermissionGate resource="rest_hours" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <div className="p-6">
          <HoursOfRestGrid />
        </div>
      </div>
    </PermissionGate>
  );
}
