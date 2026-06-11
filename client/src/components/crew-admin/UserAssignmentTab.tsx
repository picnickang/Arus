import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Link2, Pencil, Search } from "lucide-react";
import type { RoleDashboardConfig } from "@shared/role-dashboard";
import {
  UserAccessEditor,
  previewLine,
  type CrewUser,
  type CrewAdminRoleSummary,
  type VesselLite,
} from "./UserAccessEditor";

interface CrewLite {
  id: string;
  name: string;
  userId: string | null;
}

interface RoleDashboardConfigView {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  config: RoleDashboardConfig;
  isCustomized: boolean;
}

type GroupMode = "primary" | "including_secondary";

const ROLE_HIERARCHY_ORDER = [
  "super_admin",
  "system_admin",
  "company_admin",
  "admin",
  "fleet_manager",
  "vessel_master",
  "captain",
  "chief_engineer",
  "supervisor",
  "safety_officer",
  "logistics_user",
  "technician",
  "crew_member",
  "viewer",
] as const;

const roleOrder = new Map<string, number>(ROLE_HIERARCHY_ORDER.map((name, index) => [name, index]));

function displayNameForUser(user: CrewUser): string {
  return user.name ?? user.linkedCrewName ?? user.email ?? "Unnamed user";
}

function formatLastLogin(value: string | null): string {
  if (!value) {
    return "Never";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function roleLabel(roleName: string, rolesByName: Map<string, CrewAdminRoleSummary>): string {
  return rolesByName.get(roleName)?.displayName ?? humanize(roleName);
}

function humanize(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function activeAssignments(user: CrewUser) {
  return user.assignments.filter((assignment) => assignment.isActive);
}

function vesselScope(user: CrewUser, vessels: VesselLite[]): string {
  const assignments = activeAssignments(user);
  if (assignments.length === 0) {
    return "No vessel access";
  }
  if (assignments.some((assignment) => assignment.vesselId === null)) {
    return "Fleet-wide";
  }
  return assignments
    .map((assignment) =>
      assignment.vesselId
        ? (vessels.find((vessel) => vessel.id === assignment.vesselId)?.name ?? assignment.vesselId)
        : "Fleet-wide"
    )
    .join(", ");
}

function departmentsForUser(user: CrewUser, role: CrewAdminRoleSummary | undefined): string {
  const departments = activeAssignments(user)
    .map((assignment) => assignment.department)
    .filter((department): department is string => Boolean(department));
  if (departments.length > 0) {
    return [...new Set(departments)].join(", ");
  }
  return role?.department ?? "Unassigned";
}

function dashboardStatus(
  roleName: string,
  configsByRole: Map<string, RoleDashboardConfigView>
): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  const config = configsByRole.get(roleName);
  if (!config) {
    return { label: "Missing config", variant: "destructive" };
  }
  if (config.config.widgets.length === 0) {
    return { label: "No widgets", variant: "destructive" };
  }
  return {
    label: `${config.isCustomized ? "Custom" : "Default"} (${config.config.widgets.length})`,
    variant: config.isCustomized ? "default" : "secondary",
  };
}

function userMatchesSearch(
  user: CrewUser,
  term: string,
  rolesByName: Map<string, CrewAdminRoleSummary>,
  vessels: VesselLite[]
): boolean {
  if (!term) {
    return true;
  }
  const values = [
    user.name,
    user.email,
    user.username,
    user.linkedCrewName,
    user.role,
    roleLabel(user.role, rolesByName),
    ...user.assignedRoleNames.map((roleName) => roleLabel(roleName, rolesByName)),
    vesselScope(user, vessels),
  ];
  return values
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(term));
}

function attentionWarnings(
  user: CrewUser,
  primaryRole: CrewAdminRoleSummary | undefined,
  configsByRole: Map<string, RoleDashboardConfigView>
): string[] {
  const warnings: string[] = [];
  if (!primaryRole) {
    warnings.push("No assignable role record");
  }
  if (activeAssignments(user).length === 0) {
    warnings.push("No vessel scope");
  }
  if (!user.loginEnabled) {
    warnings.push("Login disabled");
  }
  if (user.loginEnabled && !user.hasPassword) {
    warnings.push("No password");
  }
  const dashboard = dashboardStatus(user.role, configsByRole);
  if (dashboard.variant === "destructive") {
    warnings.push(dashboard.label);
  }
  return warnings;
}

export function UserAssignmentTab() {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [linkCrewId, setLinkCrewId] = useState("");
  const [search, setSearch] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("primary");
  const [showEmptyRoles, setShowEmptyRoles] = useState(false);

  const { data: users = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/admin/crew/users"],
  });
  const { data: roles = [] } = useQuery<CrewAdminRoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: dashboardConfigs = [] } = useQuery<RoleDashboardConfigView[]>({
    queryKey: ["/api/admin/role-dashboards"],
  });
  const { data: vessels = [] } = useQuery<VesselLite[]>({ queryKey: ["/api/vessels"] });
  const { data: crew = [] } = useQuery<CrewLite[]>({ queryKey: ["/api/crew"] });

  const rolesByName = useMemo(() => new Map(roles.map((role) => [role.name, role])), [roles]);
  const configsByRole = useMemo(
    () => new Map(dashboardConfigs.map((config) => [config.roleName, config])),
    [dashboardConfigs]
  );
  const term = search.trim().toLowerCase();

  const roleGroups = useMemo(() => {
    const unknownRoleNames = [
      ...new Set(users.map((user) => user.role).filter((roleName) => !rolesByName.has(roleName))),
    ];
    const unknownRoles: CrewAdminRoleSummary[] = unknownRoleNames.map((name) => ({
      id: `unknown-${name}`,
      name,
      displayName: humanize(name),
      description: "User primary role is not present in the assignable role table.",
      department: null,
      hierarchyLevel: 999,
      isSystemRole: false,
      isProtected: false,
      isActive: false,
      assignedUserCount: users.filter((user) => user.role === name).length,
    }));
    const allRoles = [...roles, ...unknownRoles].sort((a, b) => {
      const rankA = roleOrder.get(a.name);
      const rankB = roleOrder.get(b.name);
      if (rankA !== undefined || rankB !== undefined) {
        return (rankA ?? 1000) - (rankB ?? 1000);
      }
      if ((a.hierarchyLevel ?? 999) !== (b.hierarchyLevel ?? 999)) {
        return (a.hierarchyLevel ?? 999) - (b.hierarchyLevel ?? 999);
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return allRoles
      .map((role) => {
        const rows = users
          .filter((user) => userMatchesSearch(user, term, rolesByName, vessels))
          .filter((user) =>
            groupMode === "primary"
              ? user.role === role.name
              : user.role === role.name || user.assignedRoleNames.includes(role.name)
          )
          .sort((a, b) => displayNameForUser(a).localeCompare(displayNameForUser(b)));
        const active = rows.filter((user) => user.isActive).length;
        return {
          role,
          rows,
          counts: {
            total: rows.length,
            active,
            inactive: rows.length - active,
          },
        };
      })
      .filter((group) => showEmptyRoles || group.rows.length > 0);
  }, [groupMode, roles, rolesByName, search, showEmptyRoles, term, users, vessels]);

  const visibleUserCount = roleGroups.reduce((sum, group) => sum + group.rows.length, 0);
  const editing = users.find((user) => user.id === editUserId) ?? null;
  const unlinkedCrew = crew.filter((member) => !member.userId);

  const link = useMutation({
    mutationFn: async () => {
      if (!linkUserId || !linkCrewId) {
        return;
      }
      await apiRequest("POST", `/api/admin/crew/members/${linkCrewId}/link`, {
        userId: linkUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/access-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
      setLinkUserId(null);
      setLinkCrewId("");
      toast({ title: "Account linked to crew member" });
    },
    onError,
  });

  return (
    <div className="space-y-4" data-testid="tab-content-assignment">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Access by Role</CardTitle>
          <CardDescription>
            Crew and admin logins grouped by primary role. Secondary roles show as badges in each
            row; switch modes to review everyone who holds a role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, login, role or vessel"
                className="pl-8"
                data-testid="input-search-accounts"
              />
            </div>
            <div>
              <Label className="text-xs">Grouping</Label>
              <Select value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
                <SelectTrigger data-testid="select-role-group-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary role only</SelectItem>
                  <SelectItem value="including_secondary">Include secondary roles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label
              className="flex items-center gap-2 text-sm"
              data-testid="toggle-show-empty-roles"
            >
              <Switch checked={showEmptyRoles} onCheckedChange={setShowEmptyRoles} />
              Show empty roles
            </label>
          </div>

          <div className="text-xs text-muted-foreground" data-testid="text-role-roster-count">
            Showing {visibleUserCount} row{visibleUserCount === 1 ? "" : "s"} across{" "}
            {roleGroups.length} role group{roleGroups.length === 1 ? "" : "s"}.
          </div>

          <div className="space-y-4">
            {roleGroups.map(({ role, rows, counts }) => (
              <div
                key={role.id}
                className="rounded-md border"
                data-testid={`role-group-${role.name}`}
              >
                <div className="flex flex-col gap-2 border-b bg-muted/30 px-3 py-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{role.displayName}</h3>
                      {role.isProtected && (
                        <Badge variant="secondary" className="text-[10px]">
                          Protected
                        </Badge>
                      )}
                      {!role.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          Inactive role
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.description ?? "No role description set."}
                      {role.department ? ` Department: ${role.department}.` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Total {counts.total}</Badge>
                    <Badge variant="secondary">Active {counts.active}</Badge>
                    <Badge variant="outline">Inactive {counts.inactive}</Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[220px]">Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Primary Role</TableHead>
                        <TableHead className="min-w-[180px]">Secondary Roles</TableHead>
                        <TableHead className="min-w-[160px]">Vessels</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Supervisor</TableHead>
                        <TableHead>Login Enabled</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead className="min-w-[150px]">Last Login</TableHead>
                        <TableHead>Password Change Required</TableHead>
                        <TableHead>Dashboard Profile</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((user) => {
                        const primaryRole = rolesByName.get(user.role);
                        const secondaryRoles = user.assignedRoleNames.filter(
                          (roleName) => roleName !== user.role
                        );
                        const supervisor = users.find(
                          (candidate) => candidate.id === user.supervisorUserId
                        );
                        const dashboard = dashboardStatus(user.role, configsByRole);
                        const warnings = attentionWarnings(user, primaryRole, configsByRole);

                        return (
                          <TableRow
                            key={`${role.name}-${user.id}`}
                            data-testid={`row-user-${user.id}`}
                          >
                            <TableCell>
                              <div className="font-medium">{displayNameForUser(user)}</div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                                {user.linkedCrewName ? ` · Crew: ${user.linkedCrewName}` : ""}
                              </div>
                              {warnings.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {warnings.map((warning) => (
                                    <Badge
                                      key={warning}
                                      variant={
                                        warning === "Login disabled" ? "outline" : "destructive"
                                      }
                                      className="text-[10px]"
                                    >
                                      <AlertTriangle className="mr-1 h-3 w-3" />
                                      {warning}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{user.username ?? "No username"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {roleLabel(user.role, rolesByName)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {secondaryRoles.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {secondaryRoles.map((roleName) => (
                                    <Badge
                                      key={roleName}
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      {roleLabel(roleName, rolesByName)}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>{vesselScope(user, vessels)}</TableCell>
                            <TableCell>{departmentsForUser(user, primaryRole)}</TableCell>
                            <TableCell>
                              {supervisor ? displayNameForUser(supervisor) : "No supervisor"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={user.loginEnabled ? "secondary" : "outline"}
                                className="text-[10px]"
                              >
                                {user.loginEnabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={user.isActive ? "secondary" : "outline"}
                                className="text-[10px]"
                              >
                                {user.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatLastLogin(user.lastLoginAt)}</TableCell>
                            <TableCell>
                              {user.mustChangePassword ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Required
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={dashboard.variant} className="text-[10px]">
                                {dashboard.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {!user.linkedCrewId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setLinkUserId(user.id);
                                      setLinkCrewId("");
                                    }}
                                    data-testid={`button-link-user-${user.id}`}
                                  >
                                    <Link2 className="mr-1 h-4 w-4" /> Link
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditUserId(user.id)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Pencil className="mr-1 h-4 w-4" /> Edit
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-muted-foreground">
                            No users in this role group.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          {roleGroups.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No users match your search. Clear the search or enable empty roles.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editUserId !== null} onOpenChange={(o) => !o && setEditUserId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name ?? editing?.email ?? "Edit User"}</DialogTitle>
            <DialogDescription>
              {editing ? previewLine(editing, roles, vessels) : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <UserAccessEditor
              user={editing}
              roles={roles}
              vessels={vessels}
              allUsers={users}
              onSaved={() => setEditUserId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={linkUserId !== null} onOpenChange={(o) => !o && setLinkUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link account to crew member</DialogTitle>
            <DialogDescription>
              Attach this login to a crew member who does not yet have one.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Crew member</Label>
            <Select value={linkCrewId} onValueChange={setLinkCrewId}>
              <SelectTrigger data-testid="select-link-crew">
                <SelectValue placeholder="Select a crew member" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedCrew.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {unlinkedCrew.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Every crew member already has a login account.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkUserId(null)}
              data-testid="button-cancel-link"
            >
              Cancel
            </Button>
            <Button
              onClick={() => link.mutate()}
              disabled={!linkCrewId || link.isPending}
              data-testid="button-confirm-link"
            >
              Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
