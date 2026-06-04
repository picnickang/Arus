import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAssignmentTab } from "./UserAssignmentTab";
import { RolesDashboardsTab } from "./RolesDashboardsTab";

interface AccessPermissionsViewProps {
  /** Which inner tab to open first (e.g. deep-linked from the old routes). */
  initialTab?: "accounts" | "roles";
}

/**
 * Single consolidated "Access & Permissions" surface. Merges the former
 * standalone "User Accounts" and "Roles & Dashboards" pages into one page with
 * two tabs so admins manage logins, role access levels, and per-role dashboards
 * in one place.
 */
export function AccessPermissionsView({ initialTab = "accounts" }: AccessPermissionsViewProps) {
  const [tab, setTab] = useState<"accounts" | "roles">(initialTab);

  return (
    <div className="space-y-4" data-testid="view-access-permissions">
      <div>
        <h2 className="text-lg font-semibold text-white" data-testid="heading-access-permissions">
          Access &amp; Permissions
        </h2>
        <p className="text-sm text-slate-400">
          Manage user logins, role access levels, and the dashboards each role sees.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "accounts" | "roles")}>
        <TabsList data-testid="tabs-access-permissions">
          <TabsTrigger value="accounts" data-testid="tab-user-accounts">
            User Accounts
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles-dashboards">
            Roles &amp; Dashboards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4">
          <UserAssignmentTab />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesDashboardsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
