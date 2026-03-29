import { HoursOfRestGrid } from "@/components/HoursOfRestGrid";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";
import { PageHeader } from "@/components/navigation";

export default function HoursOfRestPage() {
  return (
    <PermissionGate resource="rest_hours" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <PageHeader title="Hours of Rest" />
        <div className="p-6">
          <HoursOfRestGrid />
        </div>
      </div>
    </PermissionGate>
  );
}
