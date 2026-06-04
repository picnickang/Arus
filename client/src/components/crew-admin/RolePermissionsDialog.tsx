import { useMemo, useState } from "react";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RolePermissionsDialog({
  roleId,
  roleDisplayName,
  open,
  onOpenChange,
}: RolePermissionsDialogProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, boolean>>({});

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

  const changedCount = useMemo(() => {
    let n = 0;
    for (const key of Object.keys(draft)) {
      if (draft[key] !== original.has(key)) n += 1;
    }
    return n;
  }, [draft, original]);

  const save = useMutation({
    mutationFn: async () => {
      if (!roleId) return;
      const changes = Object.keys(draft)
        .filter((key) => draft[key] !== original.has(key))
        .map((key) => {
          const [resourceCode, actionCode] = key.split(":");
          return { resourceCode, actionCode, isGranted: draft[key] };
        });
      if (changes.length === 0) return;
      await apiRequest("PUT", `/api/permissions/roles/${roleId}/grants`, { grants: changes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/roles", roleId, "grants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/audit"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      setDraft({});
      onOpenChange(false);
      toast({ title: "Access permissions saved" });
    },
    onError: (error: unknown) =>
      toast({
        title: "Could not save permissions",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      }),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) setDraft({});
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

        <DialogFooter className="items-center gap-2">
          <span className="text-xs text-muted-foreground mr-auto" data-testid="text-perm-changes">
            {changedCount === 0 ? "No changes" : `${changedCount} change(s) pending`}
          </span>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-cancel-permissions">
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || changedCount === 0}
            data-testid="button-save-permissions"
          >
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
