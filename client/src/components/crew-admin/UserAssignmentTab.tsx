import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { Pencil, KeyRound } from "lucide-react";

interface VesselAssignment {
  id: string;
  vesselId: string | null;
  department: string | null;
  isActive: boolean;
}

interface CrewUser {
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
}

interface RoleSummary {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
}

interface VesselLite {
  id: string;
  name: string;
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
  const [role, setRole] = useState("");
  const [extraRoles, setExtraRoles] = useState<string[]>([]);
  const [vesselId, setVesselId] = useState("__fleet__");
  const [supervisorUserId, setSupervisorUserId] = useState("__none__");
  const [username, setUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [loginEnabled, setLoginEnabled] = useState(false);

  const { data: users = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/admin/crew/users"],
  });
  const { data: roles = [] } = useQuery<RoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: vessels = [] } = useQuery<VesselLite[]>({ queryKey: ["/api/vessels"] });

  const editing = users.find((u) => u.id === editUserId) ?? null;

  useEffect(() => {
    if (editing) {
      setRole(editing.role);
      setExtraRoles(
        (editing.assignedRoleNames ?? []).filter((name) => name !== editing.role),
      );
      setUsername(editing.username ?? "");
      setLoginEnabled(editing.loginEnabled);
      setTempPassword("");
      const firstVessel = editing.assignments.find((a) => a.vesselId)?.vesselId;
      setVesselId(firstVessel ?? "__fleet__");
      setSupervisorUserId(editing.supervisorUserId ?? "__none__");
    }
  }, [editUserId, editing]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (role && role !== editing.role) {
        await apiRequest("PATCH", `/api/admin/crew/users/${editing.id}/role`, { role });
      }
      const extraRoleIds = roles
        .filter((r) => extraRoles.includes(r.name) && r.name !== role)
        .map((r) => r.id);
      await apiRequest("PUT", `/api/admin/crew/users/${editing.id}/roles`, {
        roleIds: extraRoleIds,
      });
      await apiRequest("PUT", `/api/admin/crew/users/${editing.id}/assignments`, {
        assignments:
          vesselId === "__fleet__" ? [{ vesselId: null }] : [{ vesselId }],
      });
      const nextSupervisor =
        supervisorUserId === "__none__" ? null : supervisorUserId;
      if (nextSupervisor !== (editing.supervisorUserId ?? null)) {
        await apiRequest("PATCH", `/api/admin/crew/users/${editing.id}/supervisor`, {
          supervisorUserId: nextSupervisor,
        });
      }
      const credPayload: Record<string, unknown> = {};
      if (username.trim() && username.trim() !== (editing.username ?? "")) {
        credPayload['username'] = username.trim();
      }
      if (tempPassword.trim()) {
        credPayload['password'] = tempPassword.trim();
      }
      credPayload['loginEnabled'] = loginEnabled;
      await apiRequest(
        "POST",
        `/api/admin/crew/users/${editing.id}/credentials`,
        credPayload,
      );
    },
    onSuccess: () => {
      invalidate();
      setEditUserId(null);
      toast({ title: "User updated" });
    },
    onError,
  });

  const resetPassword = useMutation({
    mutationFn: (vars: { id: string; password: string }) =>
      apiRequest("POST", `/api/admin/crew/users/${vars.id}/reset-password`, {
        password: vars.password,
      }),
    onSuccess: () => {
      invalidate();
      toast({
        title: "Password reset",
        description: "User must change it on next login.",
      });
    },
    onError,
  });

  function previewLine(u: CrewUser): string {
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

  return (
    <div className="space-y-4" data-testid="tab-content-assignment">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Assignment & Credentials</CardTitle>
          <CardDescription>
            Assign role and vessel scope, and manage each user's login credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              data-testid={`row-user-${u.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{u.name ?? u.email}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {roles.find((r) => r.name === u.role)?.displayName ?? u.role}
                  </Badge>
                  {(u.assignedRoleNames ?? []).filter((n) => n !== u.role).length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                      data-testid={`badge-extra-roles-${u.id}`}
                    >
                      +{(u.assignedRoleNames ?? []).filter((n) => n !== u.role).length} role
                    </Badge>
                  )}
                  {u.loginEnabled ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Login on
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Login off
                    </Badge>
                  )}
                  {u.mustChangePassword && (
                    <Badge variant="outline" className="text-[10px]">
                      Must change pw
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{previewLine(u)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditUserId(u.id)}
                data-testid={`button-edit-user-${u.id}`}
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editUserId !== null}
        onOpenChange={(o) => !o && setEditUserId(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.name ?? editing?.email ?? "Edit User"}</DialogTitle>
            <DialogDescription>{editing ? previewLine(editing) : ""}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((r) => r.isActive || r.name === editing.role)
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
                  Extra roles are additive — this user sees the combined dashboard of
                  every assigned role.
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
                    <p className="text-xs text-muted-foreground">
                      No other roles available.
                    </p>
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
                    {users
                      .filter((u) => u.id !== editing.id)
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
                  {editing.hasPassword
                    ? "A password is set (never shown)."
                    : "No password set yet."}
                  {editing.passwordUpdatedAt
                    ? ` Password last changed ${new Date(editing.passwordUpdatedAt).toLocaleDateString()}.`
                    : ""}
                  {editing.lastLoginAt
                    ? ` Last login ${new Date(editing.lastLoginAt).toLocaleString()}.`
                    : " Never logged in."}
                </p>
                {editing.hasPassword && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pw = window.prompt("Enter a temporary password (min 8 chars)");
                      if (pw && pw.length >= 8) {
                        resetPassword.mutate({ id: editing.id, password: pw });
                      } else if (pw) {
                        toast({
                          title: "Too short",
                          description: "Password must be at least 8 characters.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-reset-password"
                  >
                    Reset password
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              data-testid="button-save-user"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
