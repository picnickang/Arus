import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  TASK_SOURCES,
  VISIBILITY_SCOPES,
  WIDGET_LABELS,
  WIDGET_HIGH_IMPACT_QUESTIONS,
  TASK_SOURCE_LABELS,
  type RoleDashboardConfig,
  type WidgetKey,
  type TaskSourceKey,
  type VisibilityScope,
} from "@shared/role-dashboard";
import { Plus, Settings2, Trash2 } from "lucide-react";

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
}

interface RoleDashboardConfigView {
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  config: RoleDashboardConfig;
  isCustomized: boolean;
}

export function RolesDashboardsTab() {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const [createOpen, setCreateOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", displayName: "", department: "" });
  const [editConfigRole, setEditConfigRole] = useState<string | null>(null);
  const [draftConfig, setDraftConfig] = useState<RoleDashboardConfig | null>(null);

  const { data: roles = [] } = useQuery<RoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: configs = [] } = useQuery<RoleDashboardConfigView[]>({
    queryKey: ["/api/admin/role-dashboards"],
  });

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/roles"] });
  const invalidateConfigs = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/role-dashboards"] });

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
      setCreateOpen(false);
      setNewRole({ name: "", displayName: "", department: "" });
      toast({ title: "Role created" });
    },
    onError,
  });

  const toggleActive = useMutation({
    mutationFn: (r: RoleSummary) =>
      apiRequest("PATCH", `/api/admin/crew/roles/${r.id}`, { isActive: !r.isActive }),
    onSuccess: invalidateRoles,
    onError,
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/crew/roles/${id}`),
    onSuccess: () => {
      invalidateRoles();
      toast({ title: "Role deleted" });
    },
    onError,
  });

  const saveConfig = useMutation({
    mutationFn: (vars: { roleId: string; config: RoleDashboardConfig }) =>
      apiRequest("PUT", `/api/admin/role-dashboards/${vars.roleId}`, vars.config),
    onSuccess: () => {
      invalidateConfigs();
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
          },
    );
  }

  function toggleWidget(widget: WidgetKey) {
    if (!draftConfig) return;
    const has = draftConfig.widgets.includes(widget);
    setDraftConfig({
      ...draftConfig,
      widgets: has
        ? draftConfig.widgets.filter((w) => w !== widget)
        : [...draftConfig.widgets, widget],
    });
  }

  function toggleSource(source: TaskSourceKey) {
    if (!draftConfig) return;
    const has = draftConfig.taskSources.includes(source);
    setDraftConfig({
      ...draftConfig,
      taskSources: has
        ? draftConfig.taskSources.filter((s) => s !== source)
        : [...draftConfig.taskSources, source],
    });
  }

  const editingRole = roles.find((r) => r.id === editConfigRole);

  return (
    <div className="space-y-6" data-testid="tab-content-roles">
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
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openConfigEditor(r.id)}
                  data-testid={`button-config-role-${r.id}`}
                >
                  <Settings2 className="h-4 w-4 mr-1" /> Dashboard
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Role</DialogTitle>
            <DialogDescription>Key must be lowercase with underscores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="role-key">Key</Label>
              <Input
                id="role-key"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="deck_officer"
                data-testid="input-role-key"
              />
            </div>
            <div>
              <Label htmlFor="role-name">Display name</Label>
              <Input
                id="role-name"
                value={newRole.displayName}
                onChange={(e) => setNewRole({ ...newRole, displayName: e.target.value })}
                data-testid="input-role-name"
              />
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
                !newRole.name.trim() ||
                !newRole.displayName.trim()
              }
              data-testid="button-save-role"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>
              Dashboard — {editingRole?.displayName ?? "Role"}
            </DialogTitle>
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
                          {draftConfig.highImpactQuestions?.[w] ??
                            WIDGET_HIGH_IMPACT_QUESTIONS[w]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Task sources</Label>
                <div className="grid gap-2 mt-2 sm:grid-cols-2">
                  {TASK_SOURCES.map((s) => (
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
    </div>
  );
}
