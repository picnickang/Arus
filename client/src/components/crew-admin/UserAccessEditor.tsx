import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HUB_IDS,
  isSuperAdminRole,
  isAdminGrantEligibleRole,
  normalizeHubAccess,
} from "@shared/role-dashboard";
import { useToast } from "@/hooks/use-toast";
import {
  CredentialsSection,
  GrantHubAccessDialog,
  HubAccessSection,
  ResetPasswordDialog,
  SaveResultList,
  type SaveResultItem,
} from "./UserAccessEditorParts";
import {
  sameHubAccess,
  type CrewAdminRoleSummary,
  type CrewUser,
  type VesselLite,
} from "./UserAccessEditorModel";

export { previewLine } from "./UserAccessEditorModel";
export type {
  CrewUser,
  CrewAdminRoleSummary,
  VesselAssignment,
  VesselLite,
} from "./UserAccessEditorModel";

interface UserAccessEditorProps {
  user: CrewUser;
  roles: CrewAdminRoleSummary[];
  vessels: VesselLite[];
  /** Other users available as supervisors (the editor filters out `user`). */
  allUsers: CrewUser[];
  /** Called after a successful save so parents can refresh their own queries. */
  onSaved?: () => void;
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
  const [saveResult, setSaveResult] = useState<SaveResultItem[]>([]);

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
      const results: SaveResultItem[] = [];
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

      <HubAccessSection
        isSuper={isSuper}
        isGrantEligible={isGrantEligible}
        hubAdmin={hubAdmin}
        selectedHubs={selectedHubs}
        onRequestGrant={() => setConfirmGrantOpen(true)}
        onHubAdminChange={setHubAdmin}
        onSelectedHubsChange={setSelectedHubs}
      />

      <CredentialsSection
        user={user}
        username={username}
        tempPassword={tempPassword}
        loginEnabled={loginEnabled}
        onUsernameChange={setUsername}
        onTempPasswordChange={setTempPassword}
        onLoginEnabledChange={setLoginEnabled}
        onOpenResetPassword={() => {
          setResetPw("");
          setResetOpen(true);
        }}
      />

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid="button-save-user"
        >
          Save Changes
        </Button>
      </div>
      <SaveResultList results={saveResult} />

      <GrantHubAccessDialog
        open={confirmGrantOpen}
        onOpenChange={setConfirmGrantOpen}
        onConfirm={() => setHubAdmin(true)}
      />

      <ResetPasswordDialog
        open={resetOpen}
        password={resetPw}
        isPending={resetPassword.isPending}
        onClose={() => setResetOpen(false)}
        onPasswordChange={setResetPw}
        onSubmit={() => {
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
      />
    </div>
  );
}
