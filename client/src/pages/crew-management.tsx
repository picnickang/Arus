import { UnifiedCrewManagement } from "@/components/UnifiedCrewManagement";
import { PermissionGate, PagePermissionDenied } from "@/components/PermissionGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoleNames } from "@/hooks/useRoleNames";
import { UserAssignmentTab } from "@/components/crew-admin/UserAssignmentTab";
import { RolesDashboardsTab } from "@/components/crew-admin/RolesDashboardsTab";
import { SafetyTab } from "@/components/crew-admin/SafetyTab";
import { Users, UserCog, LayoutDashboard, ShieldAlert } from "lucide-react";

// Must mirror the server-side crew-admin gate (`requireCrewAdminRole` →
// CREW_ADMIN_ROLES in server/domains/crew-admin/interfaces/routes.ts). Roles
// outside this set get 403 from every /api/admin/crew/* endpoint, so showing
// them the admin tabs would only surface failing requests.
const ADMIN_ROLES = ["system_admin", "company_admin", "admin"];

export default function CrewManagementPage() {
  const { hasAnyRole } = useRoleNames();
  const isAdmin = hasAnyRole(...ADMIN_ROLES);

  return (
    <PermissionGate resource="crew_members" action="view" fallback={<PagePermissionDenied />}>
      <div className="min-h-screen">
        <div className="p-4 md:p-6">
          {isAdmin ? (
            <Tabs defaultValue="roster" className="space-y-4">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="roster" data-testid="tab-crew-roster">
                  <Users className="h-4 w-4 mr-2" /> Crew Roster
                </TabsTrigger>
                <TabsTrigger value="assignment" data-testid="tab-user-assignment">
                  <UserCog className="h-4 w-4 mr-2" /> User Accounts
                </TabsTrigger>
                <TabsTrigger value="roles" data-testid="tab-roles-dashboards">
                  <LayoutDashboard className="h-4 w-4 mr-2" /> Roles & Dashboards
                </TabsTrigger>
                <TabsTrigger value="safety" data-testid="tab-safety">
                  <ShieldAlert className="h-4 w-4 mr-2" /> Safety
                </TabsTrigger>
              </TabsList>
              <TabsContent value="roster">
                <UnifiedCrewManagement />
              </TabsContent>
              <TabsContent value="assignment">
                <UserAssignmentTab />
              </TabsContent>
              <TabsContent value="roles">
                <RolesDashboardsTab />
              </TabsContent>
              <TabsContent value="safety">
                <SafetyTab />
              </TabsContent>
            </Tabs>
          ) : (
            <UnifiedCrewManagement />
          )}
        </div>
      </div>
    </PermissionGate>
  );
}
