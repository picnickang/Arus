import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import {
  HUB_IDS,
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  normalizeHubAccess,
} from "@shared/role-dashboard";
import { getCategoryById } from "@/config/navigationConfig";

function hubLabel(id: string): string {
  return getCategoryById(id)?.name ?? id;
}

function sameHubAccess(a: string[] | null, b: string[] | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (a.length !== b.length) {
    return false;
  }
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

export interface VesselAssignment {
  id: string;
  vesselId: string | null;
  department: string | null;
  isActive: boolean;
}

export interface CrewUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  loginEnabled: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
  supervisorUserId: string | null;
  assignments: VesselAssignment[];
  assignedRoleNames: string[];
  linkedCrewId: string | null;
  linkedCrewName: string | null;
  hubAdmin: boolean;
  hubAccess: string[] | null;
}

export interface CrewAdminRoleSummary {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  department?: string | null;
  hierarchyLevel?: number;
  isSystemRole?: boolean;
  isProtected?: boolean;
  isActive: boolean;
  assignedUserCount?: number;
}

export interface VesselLite {
  id: string;
  name: string;
}

interface UserAccessEditorProps {
  user: CrewUser;
  roles: CrewAdminRoleSummary[];
  vessels: VesselLite[];
  /** Other users available as supervisors (the editor filters out `user`). */
  allUsers: CrewUser[];
  /** Called after a successful save so parents can refresh their own queries. */
  onSaved?: () => void;
}

export function previewLine(
  u: CrewUser,
  roles: CrewAdminRoleSummary[],
  vessels: VesselLite[]
): string {
  const roleLabel = roles.find((r) => r.name === u.role)?.displayName ?? u.role;
  const extras = (u.assignedRoleNames ?? []).filter((n) => n !== u.role);
  const extraLabel =
    extras.length > 0 ? ` +${extras.length} role${extras.length > 1 ? "s" : ""}` : "";
  const vessel = u.assignments.find((a) => a.vesselId);
  const hasFleetScope = u.assignments.some((a) => a.vesselId === null);
  const scope = vessel
    ? (vessels.find((v) => v.id === vessel.vesselId)?.name ?? "Vessel")
    : hasFleetScope
      ? "Fleet-wide"
      : "No vessel access";
  return `This user will see: ${roleLabel}${extraLabel} Dashboard — ${scope}`;
}

export function UserAccessEditor({
  user,
  roles,
  vessels,
  allUsers,
  onSaved,
}: UserAccessEditorProps) {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const [role, setRole] = useState(user.role);
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [vesselId, setVesselId] = useState("__fleet__");
  const [supervisorUserId, setSupervisorUserId] = useState("__none__");
  const [username, setUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loginEnabled, setLoginEnabled] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [hubAdmin, setHubAdmin] = useState(false);
  // Selected hub ids. An empty set OR the full set both mean "all hubs"
  // (stored as null on the server). We keep the explicit selection in
  // state and normalise on save.
  const [selectedHubs, setSelectedHubs] = useState<string[]>([]);
  const [confirmGrantOpen, setConfirmGrantOpen] = useState(false);
  const [saveResult, setSaveResult] = useState<
    Array<{ label: string; ok: boolean; error?: string }>
  >([]);

  useEffect(() => {
    setRole(user.role);
    setExtraRoles((user.assignedRoleNames ?? []).filter((name) => name !== user.role));
    setUsername(user.username ?? "");
    setLoginEnabled(user.loginEnabled);
    setTempPassword("");
    const hasFleetScope = user.assignments.some((a) => a.vesselId === null);
    const firstVessel = user.assignments.find((a) => a.vesselId)?.vesselId;
    setVesselId(hasFleetScope ? "__fleet__" : (firstVessel ?? "__none__"));
    setSupervisorUserId(user.supervisorUserId ?? "__none__");
    setHubAdmin(user.hubAdmin);
    // null allow-list = all hubs → show every hub ticked.
    setSelectedHubs(user.hubAccess === null ? [...HUB_IDS] : user.hubAccess);
    setSaveResult([]);
  }, [user]);

  const isSuper = isSuperAdminRole(role);
  const isGrantEligible = isAdminGrantEligibleRole(role);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/access-readiness"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/former-access-risks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/crew"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/crew/users"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/crew/access-readiness"] }),
    ]);

  const save = useMutation({
    mutationFn: async () => {
      setSaveResult([]);
      const results: Array<{ label: string; ok: boolean; error?: string }> = [];
      const runStep = async (label: string, action: () => Promise<unknown>) => {
        try {
          await action();
          results.push({ label, ok: true });
        } catch (error) {
          results.push({
            label,
            ok: false,
            error: error instanceof Error ? error.message : "Failed",
          });
        }
      };

      await runStep("role saved", async () => {
        if (role && role !== user.role) {
          await apiRequest("PATCH", `/api/admin/crew/users/${user.id}/role`, { role });
        }
        const extraRoleIds = roles
          .filter((r) => extraRoles.includes(r.name) && r.name !== role)
          .map((r) => r.id);
        await apiRequest("PUT", `/api/admin/crew/users/${user.id}/roles`, {
          roleIds: extraRoleIds,
        });
      });
      await runStep("vessel scope saved", () =>
        apiRequest("PUT", `/api/admin/crew/users/${user.id}/assignments`, {
          assignments:
            vesselId === "__none__"
              ? []
              : vesselId === "__fleet__"
                ? [{ vesselId: null }]
                : [{ vesselId }],
        })
      );
      const nextSupervisor = supervisorUserId === "__none__" ? null : supervisorUserId;
      if (nextSupervisor !== (user.supervisorUserId ?? null)) {
        await runStep("supervisor saved", () =>
          apiRequest("PATCH", `/api/admin/crew/users/${user.id}/supervisor`, {
            supervisorUserId: nextSupervisor,
          })
        );
      }
      const credPayload: Record<string, unknown> = {};
      if (username.trim() && username.trim() !== (user.username ?? "")) {
        credPayload["username"] = username.trim();
      }
      if (tempPassword.trim()) {
        credPayload["password"] = tempPassword.trim();
      }
      credPayload["loginEnabled"] = loginEnabled;
      await runStep("login saved", () =>
        apiRequest("POST", `/api/admin/crew/users/${user.id}/credentials`, credPayload)
      );

      // Hub access — super-admins are always full hub admins (not
      // editable), so we never PATCH for them. Only send when the
      // (effective) grant actually changed.
      if (!isSuper && isGrantEligible) {
        const nextHubAccess = hubAdmin ? normalizeHubAccess(selectedHubs) : null;
        const changed = hubAdmin !== user.hubAdmin || !sameHubAccess(nextHubAccess, user.hubAccess);
        if (changed) {
          await runStep("hub/admin access saved", () =>
            apiRequest("PATCH", `/api/admin/crew/users/${user.id}/hub-access`, {
              hubAdmin,
              hubAccess: nextHubAccess,
            })
          );
        }
      }
      setSaveResult(results);
      const failed = results.filter((result) => !result.ok);
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} access setting${failed.length > 1 ? "s" : ""} failed to save`
        );
      }
    },
    onSuccess: async () => {
      await invalidate();
      onSaved?.();
      toast({ title: "User updated" });
    },
    onError: async (error) => {
      await invalidate();
      // Keep the editor open so partial-save results remain visible and fixable.
      onError(error);
    },
  });

  const resetPassword = useMutation({
    mutationFn: (password: string) =>
      apiRequest("POST", `/api/admin/crew/users/${user.id}/reset-password`, { password }),
    onSuccess: async () => {
      await invalidate();
      onSaved?.();
      setResetOpen(false);
      setResetPw("");
      toast({ title: "Password reset", description: "User must change it on next login." });
    },
    onError,
  });

  return (
    <div className="space-y-4">
      <div>
        <Label>Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles
              .filter((r) => r.isActive || r.name === user.role)
              .map((r) => (
                <SelectItem key={r.id} value={r.name}>
                  {r.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Additional roles</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Extra roles are additive — this user sees the combined dashboard of every assigned role.
        </p>
        <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
          {roles
            .filter((r) => r.isActive && r.name !== role)
            .map((r) => (
              <label
                key={r.id}
                className="flex items-center gap-2 text-sm"
                data-testid={`checkbox-extra-role-${r.name}`}
              >
                <Checkbox
                  checked={extraRoles.includes(r.name)}
                  onCheckedChange={(checked) =>
                    setExtraRoles((prev) =>
                      checked === true
                        ? [...new Set([...prev, r.name])]
                        : prev.filter((n) => n !== r.name)
                    )
                  }
                />
                {r.displayName}
              </label>
            ))}
          {roles.filter((r) => r.isActive && r.name !== role).length === 0 && (
            <p className="text-xs text-muted-foreground">No other roles available.</p>
          )}
        </div>
      </div>
      <div>
        <Label>Vessel scope</Label>
        <Select value={vesselId} onValueChange={setVesselId}>
          <SelectTrigger data-testid="select-user-vessel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No vessel access</SelectItem>
            <SelectItem value="__fleet__">Fleet-wide access (explicit)</SelectItem>
            {vessels.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vesselId === "__fleet__" && (
          <p className="text-xs text-muted-foreground mt-1">
            Fleet-wide access is broader than a vessel assignment. Use only when this user must work
            across the fleet.
          </p>
        )}
      </div>
      <div>
        <Label>Supervisor</Label>
        <Select value={supervisorUserId} onValueChange={setSupervisorUserId}>
          <SelectTrigger data-testid="select-user-supervisor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No supervisor</SelectItem>
            {allUsers
              .filter((u) => u.id !== user.id)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4" /> Admin / Hub access
        </div>
        {isSuper ? (
          <p className="text-xs text-muted-foreground" data-testid="text-hub-super-admin">
            This is a system administrator role — it always has full access to every hub and cannot
            be restricted here.
          </p>
        ) : !isGrantEligible ? (
          <p className="text-xs text-muted-foreground" data-testid="text-hub-not-eligible">
            Hub access can only be granted to manager-level roles or above. Change this user's role
            to grant admin-hub access.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm" data-testid="checkbox-hub-admin">
              <Checkbox
                checked={hubAdmin}
                onCheckedChange={(checked) => {
                  if (checked === true) {
                    setConfirmGrantOpen(true);
                  } else {
                    setHubAdmin(false);
                  }
                }}
              />
              Grant admin-hub access
            </label>
            <p className="text-xs text-muted-foreground">
              Hub admins can open the admin portal and the hubs ticked below. Untick a hub to hide
              it from this user.
            </p>
            {hubAdmin && (
              <div className="space-y-2 rounded-md border p-2">
                {HUB_IDS.map((id) => (
                  <label
                    key={id}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`checkbox-hub-${id}`}
                  >
                    <Checkbox
                      checked={selectedHubs.includes(id)}
                      onCheckedChange={(checked) =>
                        setSelectedHubs((prev) =>
                          checked === true
                            ? [...new Set([...prev, id])]
                            : prev.filter((h) => h !== id)
                        )
                      }
                    />
                    {hubLabel(id)}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4" /> Credentials
        </div>
        <div>
          <Label htmlFor="user-username">Username</Label>
          <Input
            id="user-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="login username"
            data-testid="input-user-username"
          />
        </div>
        <div>
          <Label htmlFor="user-temp-password">Temporary password</Label>
          <Input
            id="user-temp-password"
            type="password"
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="leave blank to keep current"
            data-testid="input-user-temp-password"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Setting a password requires the user to change it on next login.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="user-login-enabled">Login enabled</Label>
          <Switch
            id="user-login-enabled"
            checked={loginEnabled}
            onCheckedChange={setLoginEnabled}
            data-testid="switch-user-login-enabled"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {user.hasPassword ? "A password is set (never shown)." : "No password set yet."}
          {user.hasPassword && user.mustChangePassword
            ? user.lastLoginAt
              ? " Password change is still required by the user."
              : " Temporary password has been issued; user must change it on first login."
            : ""}
          {user.passwordUpdatedAt
            ? ` Password last changed ${new Date(user.passwordUpdatedAt).toLocaleDateString()}.`
            : ""}
          {user.lastLoginAt
            ? ` Last login ${new Date(user.lastLoginAt).toLocaleString()}.`
            : " Never logged in."}
        </p>
        {user.hasPassword && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setResetPw("");
              setResetOpen(true);
            }}
            data-testid="button-reset-password"
          >
            Reset password
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid="button-save-user"
        >
          Save Changes
        </Button>
      </div>
      {saveResult.length > 0 && (
        <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="access-save-result">
          {saveResult.map((result) => (
            <div key={result.label} className="flex items-start gap-2">
              {result.ok ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              )}
              <div>
                <p className="font-medium">{result.label}</p>
                {!result.ok && result.error && (
                  <p className="text-xs text-destructive">{result.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={confirmGrantOpen} onOpenChange={setConfirmGrantOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant admin-hub access?</AlertDialogTitle>
            <AlertDialogDescription>
              This gives the user access to the admin portal and the management hubs you select.
              They will be able to view and act on fleet-wide operational data. Only grant this to
              trusted manager-level staff. You can revoke it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-grant-hub">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => setHubAdmin(true)}
              data-testid="button-confirm-grant-hub"
            >
              Grant access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetOpen} onOpenChange={(o) => !o && setResetOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Enter a temporary password (min 8 characters). The user must change it on next login.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reset-password-input">New temporary password</Label>
            <Input
              id="reset-password-input"
              type="password"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              data-testid="input-reset-password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              data-testid="button-cancel-reset"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resetPw.length < 8) {
                  toast({
                    title: "Too short",
                    description: "Password must be at least 8 characters.",
                    variant: "destructive",
                  });
                  return;
                }
                resetPassword.mutate(resetPw);
              }}
              disabled={resetPassword.isPending}
              data-testid="button-confirm-reset"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
