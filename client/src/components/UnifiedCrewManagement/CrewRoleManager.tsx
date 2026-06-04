import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings2, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CrewRole } from "@/features/crew";

const ROLES_KEY = ["/api/crew-roles"] as const;

interface CrewRoleManagerProps {
  canManage: boolean;
}

/**
 * Self-contained manager for the org's crew roles (positions). Lets authorized
 * users add, rename, recategorize, reorder, and delete the labelled positions
 * that back `crew.rank`. Deleting a role that crew are still assigned to is
 * blocked by the server (409) and surfaced as a toast.
 */
export function CrewRoleManager({ canManage }: CrewRoleManagerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const { data: roles = [], isLoading } = useQuery<CrewRole[]>({
    queryKey: ROLES_KEY,
    enabled: open,
  });

  const categories = Array.from(new Set(roles.map((r) => r.category))).sort();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ROLES_KEY });
    void queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: { name: string; category: string }) =>
      apiRequest("POST", "/api/crew-roles", data),
    onSuccess: () => {
      setNewName("");
      setNewCategory("");
      invalidate();
      toast({ title: "Role added" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not add role", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; category?: string }) =>
      apiRequest("PATCH", `/api/crew-roles/${id}`, data),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update role", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiRequest("PATCH", "/api/crew-roles/reorder", { orderedIds }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast({ title: "Could not reorder roles", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/crew-roles/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete role", description: err.message, variant: "destructive" });
    },
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= roles.length) {
      return;
    }
    const ordered = roles.map((r) => r.id);
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved!);
    reorderMutation.mutate(ordered);
  };

  const startEdit = (role: CrewRole) => {
    setEditingId(role.id);
    setEditName(role.name);
    setEditCategory(role.category);
  };

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) {
      return;
    }
    createMutation.mutate({ name, category: newCategory.trim() || "Other" });
  };

  const submitEdit = () => {
    if (!editingId) {
      return;
    }
    const name = editName.trim();
    if (!name) {
      return;
    }
    updateMutation.mutate({ id: editingId, name, category: editCategory.trim() || "Other" });
  };

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    reorderMutation.isPending ||
    deleteMutation.isPending;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Manage Crew Roles"
      description="Add, rename, reorder, and remove the positions used across your crew. Roles in use cannot be deleted until their crew are reassigned."
      trigger={
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]"
          data-testid="button-manage-roles"
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Roles
        </Button>
      }
      className="max-w-lg"
    >
      <datalist id="crew-role-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {canManage && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="flex-1 min-w-[8rem]">
            <label className="mb-1 block text-xs text-slate-400">New role name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Deck Cadet"
              data-testid="input-new-role-name"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCreate();
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label className="mb-1 block text-xs text-slate-400">Group</label>
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Deck Crew"
              list="crew-role-categories"
              data-testid="input-new-role-category"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCreate();
                }
              }}
            />
          </div>
          <Button
            size="sm"
            className="h-9"
            onClick={submitCreate}
            disabled={!newName.trim() || busy}
            data-testid="button-add-role"
          >
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      )}

      <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading roles…</p>
        ) : roles.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No roles yet.</p>
        ) : (
          roles.map((role, index) => {
            const isEditing = editingId === role.id;
            return (
              <div
                key={role.id}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5"
                data-testid={`row-role-${role.id}`}
              >
                {canManage && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      className="text-slate-500 hover:text-white disabled:opacity-30"
                      onClick={() => move(index, -1)}
                      disabled={index === 0 || busy}
                      aria-label="Move up"
                      data-testid={`button-role-up-${role.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="text-slate-500 hover:text-white disabled:opacity-30"
                      onClick={() => move(index, 1)}
                      disabled={index === roles.length - 1 || busy}
                      aria-label="Move down"
                      data-testid={`button-role-down-${role.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {isEditing ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 flex-1"
                      data-testid={`input-edit-role-name-${role.id}`}
                    />
                    <Input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      list="crew-role-categories"
                      className="h-8 w-32"
                      data-testid={`input-edit-role-category-${role.id}`}
                    />
                    <button
                      type="button"
                      className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
                      onClick={submitEdit}
                      disabled={!editName.trim() || busy}
                      aria-label="Save"
                      data-testid={`button-role-save-${role.id}`}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel"
                      data-testid={`button-role-cancel-${role.id}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-100" data-testid={`text-role-name-${role.id}`}>
                      {role.name}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-slate-400">
                      {role.category}
                    </span>
                    {canManage && (
                      <>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-white"
                          onClick={() => startEdit(role)}
                          aria-label="Edit role"
                          data-testid={`button-role-edit-${role.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-rose-400 hover:text-rose-300 disabled:opacity-30"
                          onClick={() => deleteMutation.mutate(role.id)}
                          disabled={busy}
                          aria-label="Delete role"
                          data-testid={`button-role-delete-${role.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </ResponsiveDialog>
  );
}
