import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  DASHBOARD_WIDGETS,
  IMPLEMENTED_TASK_SOURCES,
  VISIBILITY_SCOPES,
  WIDGET_LABELS,
  WIDGET_HIGH_IMPACT_QUESTIONS,
  TASK_SOURCE_LABELS,
  type RoleDashboardConfig,
  type WidgetKey,
  type TaskSourceKey,
  type VisibilityScope,
} from "@shared/role-dashboard";
import {
  Plus,
  Settings2,
  Trash2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Shield,
  Users,
  Lock,
} from "lucide-react";
import { RolePermissionsDialog } from "./RolePermissionsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  department: string | null;
  hierarchyLevel: number;
  isProtected: boolean;
  isActive: boolean;
  assignedUserCount: number;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}

interface RoleDashboardConfigView {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  config: RoleDashboardConfig;
  isCustomized: boolean;
}

interface PermissionAuditEntry {
  id?: string | number;
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  createdAt?: string | null;
}

export function RolesDashboardsTab() {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const slugifyRoleKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50);

  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", displayName: "", department: "" });
  const [keyTouched, setKeyTouched] = useState(false);
  const [editConfigRole, setEditConfigRole] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<RoleDashboardConfig | null>(null);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editRoleForm, setEditRoleForm] = useState({ displayName: "", department: "" });
  const [resetRoleId, setResetRoleId] = useState<string | null>(null);
  const [permRoleId, setPermRoleId] = useState<string | null>(null);

  const { data: roles = [] } = useQuery<RoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: configs = [] } = useQuery<RoleDashboardConfigView[]>({
    queryKey: ["/api/admin/role-dashboards"],
  });
  const { data: auditLog = [] } = useQuery<PermissionAuditEntry[]>({
    queryKey: ["/api/permissions/audit"],
  });

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/roles"] });
  const invalidateConfigs = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/role-dashboards"] });
  const invalidateAccessReadiness = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/access-readiness"] });

  const createRole = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/crew/roles", {
        name: newRole.name.trim(),
        displayName: newRole.displayName.trim(),
        department: newRole.department.trim() || undefined,
      }),
    onSuccess: () => {
      invalidateRoles();
      invalidateConfigs();
      invalidateAccessReadiness();
      setCreateOpen(false);
      setNewRole({ name: "", displayName: "", department: "" });
      setKeyTouched(false);
      toast({ title: "Role created" });
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (r: RoleSummary) =>
      apiRequest("PATCH", `/api/admin/crew/roles/${r.id}`, { isActive: !r.isActive }),
    onSuccess: () => {
      invalidateRoles();
      invalidateAccessReadiness();
    },
    onError,
  });

  const editRole = useMutation({
    mutationFn: (vars: { id: string; displayName: string; department: string }) =>
      apiRequest("PATCH", `/api/admin/crew/roles/${vars.id}`, {
        displayName: vars.displayName.trim(),
        department: vars.department.trim() || null,
      }),
    onSuccess: () => {
      invalidateRoles();
      invalidateAccessReadiness();
      setEditRoleId(null);
      toast({ title: "Role updated" });
    },
    onError,
  });

  const resetDashboard = useMutation({
    mutationFn: (roleId: string) =>
      apiRequest("POST", `/api/admin/role-dashboards/${roleId}/reset`, {}),
    onSuccess: () => {
      invalidateConfigs();
      invalidateAccessReadiness();
      setResetRoleId(null);
      toast({ title: "Dashboard reset to default" });
    },
    onError,
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/crew/roles/${id}`),
    onSuccess: () => {
      invalidateRoles();
      invalidateAccessReadiness();
      toast({ title: "Role deleted" });
    },
    onError,
  });

  const saveConfig = useMutation({
    mutationFn: (vars: { roleId: string; config: RoleDashboardConfig }) =>
      apiRequest("PUT", `/api/admin/role-dashboards/${vars.roleId}`, vars.config),
    onSuccess: () => {
      invalidateConfigs();
      invalidateAccessReadiness();
      setEditConfigRole(null);
      setDraftConfig(null);
      toast({ title: "Dashboard config saved" });
    },
    onError,
  });

  function openConfigEditor(roleId: string) {
    const existing = configs.find((c) => c.roleId === roleId);
    setEditConfigRole(roleId);
    setDraftConfig(
      existing
        ? { ...existing.config, highImpactQuestions: { ...existing.config.highImpactQuestions } }
        : {
            widgets: [],
            taskSources: [],
            visibilityScope: "vessel",
            quickActions: [],
            filters: {},
            highImpactQuestions: {},
          }
    );
  }

  function toggleWidget(widget: WidgetKey) {
    if (!draftConfig) {
      return;
    }
    const has = draftConfig.widgets.includes(widget);
    setDraftConfig({
      ...draftConfig,
      widgets: has
        ? draftConfig.widgets.filter((w) => w !== widget)
        : [...draftConfig.widgets, widget],
    });
  }

  function toggleSource(source: TaskSourceKey) {
    if (!draftConfig) {
      return;
    }
    const has = draftConfig.taskSources.includes(source);
    setDraftConfig({
      ...draftConfig,
      taskSources: has
        ? draftConfig.taskSources.filter((s) => s !== source)
        : [...draftConfig.taskSources, source],
    });
  }

  const editingRole = roles.find((r) => r.id === editConfigRole);

  const totalUsersAssigned = roles.reduce((acc, r) => acc + r.assignedUserCount, 0);
  const adminHubRoleCount = roles.filter((r) => r.hubAdmin).length;

  return (
    <div className="space-y-6" data-testid="tab-content-roles">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Total Roles</CardTitle>
            <Shield className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-roles">
              {roles.length}
            </div>
            <p className="text-sm text-muted-foreground">Active role definitions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Users Assigned</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-users">
              {totalUsersAssigned}
            </div>
            <p className="text-sm text-muted-foreground">Across all roles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Admin Hub Access</CardTitle>
            <Lock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-admin-hub-roles">
              {adminHubRoleCount}
            </div>
            <p className="text-sm text-muted-foreground">Roles with admin landing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Roles</CardTitle>
            <CardDescription>
              Manage role definitions and the dashboard each role sees.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-add-role">
            <Plus className="h-4 w-4 mr-1" /> Add Role
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              data-testid={`row-role-${r.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground">{r.name}</span>
                  {r.isProtected && (
                    <Badge variant="secondary" className="text-[10px]">
                      Protected
                    </Badge>
                  )}
                  {!r.isActive && (
                    <Badge variant="outline" className="text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.assignedUserCount} user(s) assigned
                  {r.department ? ` · ${r.department}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditRoleId(r.id);
                    setEditRoleForm({
                      displayName: r.displayName,
                      department: r.department ?? "",
                    });
                  }}
                  data-testid={`button-edit-role-${r.id}`}
                >
                  <Pencil className="h-4 w-4 mr-1" /> Rename
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPermRoleId(r.id)}
                  data-testid={`button-permissions-role-${r.id}`}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Permissions
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openConfigEditor(r.id)}
                  data-testid={`button-config-role-${r.id}`}
                >
                  <Settings2 className="h-4 w-4 mr-1" /> Dashboard
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setResetRoleId(r.id)}
                  data-testid={`button-reset-dashboard-${r.id}`}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Switch
                  checked={r.isActive}
                  onCheckedChange={() => toggleActive.mutate(r)}
                  data-testid={`switch-role-active-${r.id}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={r.isProtected || r.assignedUserCount > 0}
                  onClick={() => deleteRole.mutate(r.id)}
                  data-testid={`button-delete-role-${r.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No roles defined.</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-permission-audit">
        <CardHeader>
          <CardTitle className="text-base">Access &amp; Permission Activity</CardTitle>
          <CardDescription>
            Recent changes to roles, hub access, and permission grants across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-audit-empty">
              No recent permission activity.
            </p>
          ) : (
            <ul className="space-y-2">
              {auditLog.slice(0, 10).map((entry, index) => (
                <li
                  key={String(entry.id ?? index)}
                  className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0"
                  data-testid={`row-audit-${entry.id ?? index}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.action}</p>
                    {(entry.targetType || entry.targetId) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[entry.targetType, entry.targetId].filter(Boolean).join(": ")}
                      </p>
                    )}
                  </div>
                  {entry.createdAt && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewRole({ name: "", displayName: "", department: "" });
            setKeyTouched(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
            <DialogDescription>
              Enter a display name. The key is generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="role-name">Display name</Label>
              <Input
                id="role-name"
                value={newRole.displayName}
                onChange={(e) => {
                  const displayName = e.target.value;
                  setNewRole((prev) => ({
                    ...prev,
                    displayName,
                    name: keyTouched ? prev.name : slugifyRoleKey(displayName),
                  }));
                }}
                placeholder="Deck Officer"
                data-testid="input-role-name"
              />
            </div>
            <div>
              <Label htmlFor="role-key">Key</Label>
              <Input
                id="role-key"
                value={newRole.name}
                onChange={(e) => {
                  const key = slugifyRoleKey(e.target.value);
                  setKeyTouched(key.length > 0);
                  setNewRole({ ...newRole, name: key });
                }}
                placeholder="deck_officer"
                data-testid="input-role-key"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers and underscores only.
              </p>
            </div>
            <div>
              <Label htmlFor="role-dept">Department (optional)</Label>
              <Input
                id="role-dept"
                value={newRole.department}
                onChange={(e) => setNewRole({ ...newRole, department: e.target.value })}
                data-testid="input-role-dept"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createRole.mutate()}
              disabled={
                createRole.isPending ||
                newRole.name.trim().length < 2 ||
                !newRole.displayName.trim()
              }
              data-testid="button-save-role"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleId !== null} onOpenChange={(o) => !o && setEditRoleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the display name and department. The internal key cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-role-name">Display name</Label>
              <Input
                id="edit-role-name"
                value={editRoleForm.displayName}
                onChange={(e) => setEditRoleForm({ ...editRoleForm, displayName: e.target.value })}
                data-testid="input-edit-role-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-role-dept">Department</Label>
              <Input
                id="edit-role-dept"
                value={editRoleForm.department}
                onChange={(e) => setEditRoleForm({ ...editRoleForm, department: e.target.value })}
                placeholder="Leave blank for none"
                data-testid="input-edit-role-dept"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => editRoleId && editRole.mutate({ id: editRoleId, ...editRoleForm })}
              disabled={editRole.isPending || editRoleForm.displayName.trim().length < 2}
              data-testid="button-save-edit-role"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetRoleId !== null} onOpenChange={(o) => !o && setResetRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset dashboard to default?</AlertDialogTitle>
            <AlertDialogDescription>
              This discards all custom widgets, task sources and visibility settings for this role
              and restores the built-in default dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reset-dashboard">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetRoleId && resetDashboard.mutate(resetRoleId)}
              data-testid="button-confirm-reset-dashboard"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editConfigRole !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEditConfigRole(null);
            setDraftConfig(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dashboard — {editingRole?.displayName ?? "Role"}</DialogTitle>
            <DialogDescription>
              Choose the widgets, task sources and visibility this role's User page shows.
            </DialogDescription>
          </DialogHeader>
          {draftConfig && (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold">Widgets</Label>
                <div className="grid gap-2 mt-2 sm:grid-cols-2">
                  {DASHBOARD_WIDGETS.map((w) => (
                    <label
                      key={w}
                      className="flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={draftConfig.widgets.includes(w)}
                        onCheckedChange={() => toggleWidget(w)}
                        data-testid={`checkbox-widget-${w}`}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{WIDGET_LABELS[w]}</span>
                        <span className="block text-xs text-muted-foreground">
                          {draftConfig.highImpactQuestions?.[w] ?? WIDGET_HIGH_IMPACT_QUESTIONS[w]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Task sources</Label>
                <div className="grid gap-2 mt-2 sm:grid-cols-2">
                  {IMPLEMENTED_TASK_SOURCES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={draftConfig.taskSources.includes(s)}
                        onCheckedChange={() => toggleSource(s)}
                        data-testid={`checkbox-source-${s}`}
                      />
                      {TASK_SOURCE_LABELS[s]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Visibility scope</Label>
                <Select
                  value={draftConfig.visibilityScope}
                  onValueChange={(v) =>
                    setDraftConfig({
                      ...draftConfig,
                      visibilityScope: v as VisibilityScope,
                    })
                  }
                >
                  <SelectTrigger className="mt-2" data-testid="select-visibility-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIBILITY_SCOPES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() =>
                editConfigRole &&
                draftConfig &&
                saveConfig.mutate({ roleId: editConfigRole, config: draftConfig })
              }
              disabled={saveConfig.isPending}
              data-testid="button-save-config"
            >
              Save Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RolePermissionsDialog
        roleId={permRoleId}
        roleDisplayName={roles.find((r) => r.id === permRoleId)?.displayName ?? "Role"}
        roleName={roles.find((r) => r.id === permRoleId)?.name ?? ""}
        roleHubAdmin={roles.find((r) => r.id === permRoleId)?.hubAdmin ?? false}
        roleHubAccess={roles.find((r) => r.id === permRoleId)?.hubAccess ?? null}
        open={permRoleId !== null}
        onOpenChange={(o) => !o && setPermRoleId(null)}
      />
    </div>
  );
}
