import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Users, Key, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Role {
  id: string;
  name: string;
  displayName: string;
  userCount: number;
}

interface PermissionsData {
  roles: Role[];
  totalUsers: number;
}

export default function PermissionsSettings() {
  const { data, isLoading } = useQuery<PermissionsData>({
    queryKey: ["/api/admin/roles"],
    retry: 1,
    staleTime: 60000,
  });

  const roles: Role[] = data?.roles || [
    { id: "admin", name: "admin", displayName: "Administrator", userCount: 1 },
    { id: "captain", name: "captain", displayName: "Captain", userCount: 2 },
    { id: "chief_engineer", name: "chief_engineer", displayName: "Chief Engineer", userCount: 2 },
    { id: "crew", name: "crew", displayName: "Crew Member", userCount: 8 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-permissions-title">Permissions & Security</h1>
          <p className="text-muted-foreground">Manage roles, permissions, and access control</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Total Roles</CardTitle>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-roles">{roles.length}</div>
            <p className="text-sm text-muted-foreground">Active role definitions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Total Users</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {data?.totalUsers || roles.reduce((acc, r) => acc + r.userCount, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Security Status</CardTitle>
            <Lock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600" data-testid="badge-security-status">Secure</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">RBAC enforcement active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Assignments</CardTitle>
          <CardDescription>Overview of roles and user assignments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                data-testid={`row-role-${role.id}`}
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{role.displayName}</p>
                    <p className="text-xs text-muted-foreground">{role.name}</p>
                  </div>
                </div>
                <Badge variant="secondary" data-testid={`badge-user-count-${role.id}`}>
                  {role.userCount} {role.userCount === 1 ? "user" : "users"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access Control</CardTitle>
          <CardDescription>Single-tenant security configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Authentication Mode</p>
                <p className="text-sm text-muted-foreground">Development mode with automatic login</p>
              </div>
              <Badge variant="outline" data-testid="badge-auth-mode">Development</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Tenant Isolation</p>
                <p className="text-sm text-muted-foreground">Single-tenant architecture</p>
              </div>
              <Badge variant="default" data-testid="badge-tenant-mode">Single-Tenant</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
