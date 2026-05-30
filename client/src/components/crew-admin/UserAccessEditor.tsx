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
import { useToast } from "@/hooks/use-toast";
import { KeyRound } from "lucide-react";

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
}

export interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}

export interface VesselLite {
  id: string;
  name: string;
}

interface UserAccessEditorProps {
  user: CrewUser;
  roles: RoleSummary[];
  vessels: VesselLite[];
  /** Other users available as supervisors (the editor filters out `user`). */
  allUsers: CrewUser[];
  /** Called after a successful save so parents can refresh their own queries. */
  onSaved?: () => void;
}

export function previewLine(
  u: CrewUser,
  roles: RoleSummary[],
  vessels: VesselLite[],
): string {
  const roleLabel = roles.find((r) => r.name === u.role)?.displayName ?? u.role;
  const extras = (u.assignedRoleNames ?? []).filter((n) => n !== u.role);
  const extraLabel =
    extras.length > 0 ? ` +${extras.length} role${extras.length > 1 ? "s" : ""}` : "";
  const vessel = u.assignments.find((a) => a.vesselId);
  const scope = vessel
    ? vessels.find((v) => v.id === vessel.vesselId)?.name ?? "Vessel"
    : "Fleet-wide";
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

  useEffect(() => {
    setRole(user.role);
    setExtraRoles((user.assignedRoleNames ?? []).filter((name) => name !== user.role));
    setUsername(user.username ?? "");
    setLoginEnabled(user.loginEnabled);
    setTempPassword("");
    const firstVessel = user.assignments.find((a) => a.vesselId)?.vesselId;
    setVesselId(firstVessel ?? "__fleet__");
    setSupervisorUserId(user.supervisorUserId ?? "__none__");
  }, [user]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] });

  const save = useMutation({
    mutationFn: async () => {
      if (role && role !== user.role) {
        await apiRequest("PATCH", `/api/admin/crew/users/${user.id}/role`, { role });
      }
      const extraRoleIds = roles
        .filter((r) => extraRoles.includes(r.name) && r.name !== role)
        .map((r) => r.id);
      await apiRequest("PUT", `/api/admin/crew/users/${user.id}/roles`, {
        roleIds: extraRoleIds,
      });
      await apiRequest("PUT", `/api/admin/crew/users/${user.id}/assignments`, {
        assignments: vesselId === "__fleet__" ? [{ vesselId: null }] : [{ vesselId }],
      });
      const nextSupervisor = supervisorUserId === "__none__" ? null : supervisorUserId;
      if (nextSupervisor !== (user.supervisorUserId ?? null)) {
        await apiRequest("PATCH", `/api/admin/crew/users/${user.id}/supervisor`, {
          supervisorUserId: nextSupervisor,
        });
      }
      const credPayload: Record<string, unknown> = {};
      if (username.trim() && username.trim() !== (user.username ?? "")) {
        credPayload['username'] = username.trim();
      }
      if (tempPassword.trim()) {
        credPayload['password'] = tempPassword.trim();
      }
      credPayload['loginEnabled'] = loginEnabled;
      await apiRequest("POST", `/api/admin/crew/users/${user.id}/credentials`, credPayload);
    },
    onSuccess: () => {
      invalidate();
      onSaved?.();
      toast({ title: "User updated" });
    },
    onError,
  });

  const resetPassword = useMutation({
    mutationFn: (password: string) =>
      apiRequest("POST", `/api/admin/crew/users/${user.id}/reset-password`, { password }),
    onSuccess: () => {
      invalidate();
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
          Extra roles are additive — this user sees the combined dashboard of every assigned
          role.
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
                        : prev.filter((n) => n !== r.name),
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
            <SelectItem value="__fleet__">Fleet-wide</SelectItem>
            {vessels.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      <Dialog open={resetOpen} onOpenChange={(o) => !o && setResetOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Enter a temporary password (min 8 characters). The user must change it on next
              login.
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
