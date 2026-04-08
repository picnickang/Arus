import { UnifiedCrewManagement } from "@/components/UnifiedCrewManagement";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";

export default function CrewManagementPage() {
  return (
    <PermissionGate resource="crew_members" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <div className="p-4 md:p-6">
          <UnifiedCrewManagement />
        </div>
      </div>
    </PermissionGate>
  );
}
