import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useRoleNames } from "@/hooks/useRoleNames";
import { AlertTriangle } from "lucide-react";
import {
  HUB_IDS,
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  isPermissionEditorRole,
} from "@shared/role-dashboard";

const HUB_LABELS: Record<string, string> = {
  operations: "Operations",
  fleet: "Fleet",
  maintenance: "Maintenance",
  crew: "Crew",
  logistics: "Logistics",
  records: "Records",
  analytics: "Analytics",
  system: "System",
};

interface ResourceDef {
  code: string;
  name: string;
  description: string;
  category: string;
  actions: string[];
  sortOrder: number;
}

interface ActionDef {
  code: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  sortOrder: number;
}

interface CategoryDef {
  code: string;
  name: string;
  icon: string;
}

interface RegistryResponse {
  resources: ResourceDef[];
  actions: ActionDef[];
  categories: CategoryDef[];
}

interface Grant {
  roleId: string;
  resourceCode?: string;
  actionCode?: string;
  isGranted?: boolean;
}

const RISK_VARIANT: Record<ActionDef["riskLevel"], "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

function grantKey(resourceCode: string, actionCode: string) {
  return `${resourceCode}:${actionCode}`;
}

interface RolePermissionsDialogProps {
  roleId: string | null;
  roleDisplayName: string;
  roleName: string;
  roleHubAdmin: boolean;
  roleHubAccess: string[] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RolePermissionsDialog({
  roleId,
  roleDisplayName,
  roleName,
  roleHubAdmin,
  roleHubAccess,
  open,
  onOpenChange,
}: RolePermissionsDialogProps) {
  const { toast } = useToast();
  const { roleNames } = useRoleNames();
  // ONLY the super-admin tier (the signed-in user) may change access
  // permissions. Mirrors the backend gate (isPermissionEditorRole →
  // requireSuperAdminForPermissions / requireSuperAdminRole) so system_admin and
  // company_admin are not falsely locked into read-only. Everyone else gets a
  // read-only view.
  const canEditPermissions = roleNames.some((r) => isPermissionEditorRole(r));
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hub-access draft. A super-admin role is always-on (every hub) and cannot be
  // edited here; a role that is not "manager or above" cannot be made an admin.
  const isSuperAdmin = isSuperAdminRole(roleName);
  const canBeHubAdmin = isAdminGrantEligibleRole(roleName);
  const [hubAdminDraft, setHubAdminDraft] = useState(roleHubAdmin);
  // Hub allow-list semantics: a `null` roleHubAccess on an admin role means
  // "all hubs" (represented as every box ticked); an explicit `[]` means "no
  // hubs" (every box unticked) — these are distinct and both must round-trip.
  const [hubDraft, setHubDraft] = useState<Set<string>>(new Set());

  // The set the editor should show for the current stored value: null → all
  // hubs ticked; an explicit list (including []) → exactly those ticked.
  const currentHubSet = useMemo(
    () =>
      roleHubAccess == null
        ? [...HUB_IDS]
        : roleHubAccess.filter((h) => (HUB_IDS as readonly string[]).includes(h)),
    [roleHubAccess],
  );

  useEffect(() => {
    if (!open) return;
    setHubAdminDraft(isSuperAdmin || roleHubAdmin);
    setHubDraft(new Set(currentHubSet));
    setSaveError(null);
  }, [open, roleId, roleHubAdmin, isSuperAdmin, currentHubSet]);

  const hubsChanged = useMemo(() => {
    if (isSuperAdmin) return false;
    if (hubAdminDraft !== roleHubAdmin) return true;
    if (!hubAdminDraft) return false;
    const current = new Set(currentHubSet);
    if (current.size !== hubDraft.size) return true;
    for (const h of hubDraft) if (!current.has(h)) return true;
    return false;
  }, [isSuperAdmin, hubAdminDraft, roleHubAdmin, hubDraft, currentHubSet]);

  const toggleHub = (id: string) => {
    setHubDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: registry } = useQuery<RegistryResponse>({
    queryKey: ["/api/permissions/registry"],
    enabled: open,
  });

  const { data: grants = [], isLoading: grantsLoading } = useQuery<Grant[]>({
    queryKey: ["/api/permissions/roles", roleId, "grants"],
    enabled: open && !!roleId,
  });

  const original = useMemo(() => {
    const set = new Set<string>();
    for (const g of grants) {
      if (g.resourceCode && g.actionCode && g.isGranted !== false) {
        set.add(grantKey(g.resourceCode, g.actionCode));
      }
    }
    return set;
  }, [grants]);

  const isChecked = (key: string) => (key in draft ? draft[key] : original.has(key));

  const toggle = (key: string) => {
    setDraft((prev) => ({ ...prev, [key]: !isChecked(key) }));
  };

  const actionLabels = useMemo(() => {
    const map: Record<string, ActionDef> = {};
    for (const a of registry?.actions ?? []) map[a.code] = a;
    return map;
  }, [registry]);

  const categories = registry?.categories ?? [];
  const resources = registry?.resources ?? [];

  const grantChangeCount = useMemo(() => {
    let n = 0;
    for (const key of Object.keys(draft)) {
      if (draft[key] !== original.has(key)) n += 1;
    }
    return n;
  }, [draft, original]);

  const changedCount = grantChangeCount + (hubsChanged ? 1 : 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!roleId) return;
      // 1) Permission grants (only the diff).
      const changes = Object.keys(draft)
        .filter((key) => draft[key] !== original.has(key))
        .map((key) => {
          const [resourceCode, actionCode] = key.split(":");
          return { resourceCode, actionCode, isGranted: draft[key] };
        });
      if (changes.length > 0) {
        await apiRequest("PUT", `/api/permissions/roles/${roleId}/grants`, { grants: changes });
      }
      // 2) Admin-hub access (only when changed). A non-admin role clears its
      // access (null). For an admin role: every hub ticked sends null (= all
      // hubs), zero ticked sends [] (admin with no accessible hubs — distinct
      // from "all"), and a partial selection sends that explicit list.
      if (hubsChanged) {
        const ticked = [...hubDraft];
        const hubAccess = !hubAdminDraft
          ? null
          : ticked.length === HUB_IDS.length
            ? null
            : ticked;
        await apiRequest("PATCH", `/api/admin/crew/roles/${roleId}/hub-access`, {
          hubAdmin: hubAdminDraft,
          hubAccess,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/roles", roleId, "grants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/roles"] });
      setDraft({});
      setSaveError(null);
      onOpenChange(false);
      toast({ title: "Role access saved" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Please try again.";
      setSaveError(message);
      toast({
        title: "Could not save role access",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDraft({});
      setSaveError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="dialog-role-permissions">
        <DialogHeader>
          <DialogTitle>Access permissions — {roleDisplayName}</DialogTitle>
          <DialogDescription>
            Choose what people with this role can see and do. Each tick grants one action on one
            area of the app.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border p-4 space-y-3" data-testid="hub-access-section">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">Admin hub access</h4>
              <p className="text-xs text-muted-foreground">
                Turn this on to give the role the admin landing page and pick which hubs it
                can open. Off means the role only sees its own work area.
              </p>
            </div>
            <Checkbox
              checked={hubAdminDraft}
              disabled={isSuperAdmin || !canBeHubAdmin || !canEditPermissions}
              onCheckedChange={(v) => setHubAdminDraft(v === true)}
              data-testid="checkbox-hub-admin"
            />
          </div>

          {isSuperAdmin && (
            <p className="text-xs text-muted-foreground">
              Super-admin roles always have access to every hub. This can't be changed here.
            </p>
          )}
          {!isSuperAdmin && !canBeHubAdmin && (
            <p className="text-xs text-muted-foreground">
              Only manager-level roles and above can be given admin hub access.
            </p>
          )}

          {hubAdminDraft && !isSuperAdmin && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {HUB_IDS.map((hub) => (
                <label
                  key={hub}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`label-hub-${hub}`}
                >
                  <Checkbox
                    checked={hubDraft.has(hub)}
                    disabled={!canEditPermissions}
                    onCheckedChange={() => toggleHub(hub)}
                    data-testid={`checkbox-hub-${hub}`}
                  />
                  {HUB_LABELS[hub] ?? hub}
                </label>
              ))}
            </div>
          )}
        </div>

        {saveError && (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="text-save-error"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {grantsLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading permissions…</p>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const catResources = resources
                .filter((r) => r.category === cat.code)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              if (catResources.length === 0) return null;
              return (
                <div key={cat.code} data-testid={`perm-category-${cat.code}`}>
                  <h4 className="text-sm font-semibold mb-2">{cat.name}</h4>
                  <div className="space-y-2">
                    {catResources.map((resource) => (
                      <div
                        key={resource.code}
                        className="rounded-md border px-3 py-2"
                        data-testid={`perm-resource-${resource.code}`}
                      >
                        <div className="mb-2">
                          <span className="text-sm font-medium">{resource.name}</span>
                          <p className="text-xs text-muted-foreground">{resource.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {resource.actions
                            .slice()
                            .sort(
                              (a, b) =>
                                (actionLabels[a]?.sortOrder ?? 0) - (actionLabels[b]?.sortOrder ?? 0),
                            )
                            .map((actionCode) => {
                              const key = grantKey(resource.code, actionCode);
                              const action = actionLabels[actionCode];
                              return (
                                <label
                                  key={actionCode}
                                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                                >
                                  <Checkbox
                                    checked={isChecked(key)}
                                    disabled={!canEditPermissions}
                                    onCheckedChange={() => toggle(key)}
                                    data-testid={`checkbox-grant-${resource.code}-${actionCode}`}
                                  />
                                  <span>{action?.name ?? actionCode}</span>
                                  {action && action.riskLevel !== "low" && (
                                    <Badge
                                      variant={RISK_VARIANT[action.riskLevel]}
                                      className="text-[10px] px-1 py-0"
                                    >
                                      {action.riskLevel}
                                    </Badge>
                                  )}
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!canEditPermissions && (
          <div
            className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground"
            data-testid="text-readonly-permissions"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Only a Super Admin can change access permissions. This is a read-only view.</span>
          </div>
        )}

        <DialogFooter className="items-center gap-2">
          <span className="text-xs text-muted-foreground mr-auto" data-testid="text-perm-changes">
            {changedCount === 0 ? "No changes" : `${changedCount} change(s) pending`}
          </span>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-permissions">
            {canEditPermissions ? "Cancel" : "Close"}
          </Button>
          {canEditPermissions && (
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || changedCount === 0}
              data-testid="button-save-permissions"
            >
              Save Access
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
