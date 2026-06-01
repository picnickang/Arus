import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Unlink } from "lucide-react";
import {
  UserAccessEditor,
  type CrewUser,
  type RoleSummary,
  type VesselLite,
} from "./UserAccessEditor";

interface CrewAccessTabProps {
  crewId: string;
  crewName: string;
  crewEmail?: string | null;
  crewVesselId?: string | null;
}

export function CrewAccessTab({
  crewId,
  crewName,
  crewEmail,
  crewVesselId,
}: CrewAccessTabProps) {
  const { toast } = useToast();
  const onError = (error: unknown) =>
    toast({
      title: "Action failed",
      description: error instanceof Error ? error.message : "Please try again.",
      variant: "destructive",
    });

  const accountKey = ["/api/admin/crew/members", crewId, "account"];
  const { data: account, isLoading } = useQuery<CrewUser | null>({
    queryKey: accountKey,
    queryFn: async () => {
      const json = await apiRequest<{ account: CrewUser | null }>(
        "GET",
        `/api/admin/crew/members/${crewId}/account`,
      );
      return json.account;
    },
  });
  const { data: roles = [] } = useQuery<RoleSummary[]>({
    queryKey: ["/api/admin/crew/roles"],
  });
  const { data: vessels = [] } = useQuery<VesselLite[]>({ queryKey: ["/api/vessels"] });
  const { data: users = [] } = useQuery<CrewUser[]>({
    queryKey: ["/api/admin/crew/users"],
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [email, setEmail] = useState(crewEmail ?? "");
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [vesselScope, setVesselScope] = useState(crewVesselId ?? "__none__");
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const crewVesselInList = crewVesselId
    ? vessels.some((vessel) => vessel.id === crewVesselId)
    : false;

  useEffect(() => {
    setEmail(crewEmail ?? "");
    setVesselScope(crewVesselId ?? "__none__");
  }, [crewEmail, crewId, crewVesselId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: accountKey });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/crew/access-readiness"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        username: username.trim(),
        password,
        role,
        loginEnabled,
      };
      if (email.trim()) payload['email'] = email.trim();
      if (vesselScope === "__fleet__") {
        payload['vesselId'] = null;
      } else if (vesselScope === "__none__") {
        payload['skipVesselAssignment'] = true;
      } else {
        payload['vesselId'] = vesselScope;
      }
      await apiRequest("POST", `/api/admin/crew/members/${crewId}/account`, payload);
    },
    onSuccess: () => {
      invalidate();
      setUsername("");
      setPassword("");
      toast({
        title: "Login created",
        description: "The crew member must change their password on first login.",
      });
    },
    onError,
  });

  const unlink = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/crew/members/${crewId}/account`),
    onSuccess: () => {
      invalidate();
      setUnlinkOpen(false);
      toast({ title: "Login detached", description: "The account itself was kept." });
    },
    onError,
  });

  if (isLoading) {
    return <div className="py-4 text-center text-muted-foreground">Loading access…</div>;
  }

  if (account) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-linked-username">
              {account.username ?? account.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {account.loginEnabled ? "Login enabled" : "Login disabled"}
              {account.lastLoginAt
                ? ` · Last login ${new Date(account.lastLoginAt).toLocaleString()}`
                : " · Never logged in"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnlinkOpen(true)}
            data-testid="button-unlink-account"
          >
            <Unlink className="h-4 w-4 mr-1" /> Detach
          </Button>
        </div>

        <UserAccessEditor
          user={account}
          roles={roles}
          vessels={vessels}
          allUsers={users}
          onSaved={invalidate}
        />

        <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Detach this login?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the link between {crewName} and the login account. The account is
                kept and can be re-linked later from User Accounts.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-unlink">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unlink.mutate()}
                data-testid="button-confirm-unlink"
              >
                Detach
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">No login account</Badge>
        <p className="text-sm text-muted-foreground">
          Create a login so {crewName} can sign in.
        </p>
      </div>
      <div className="space-y-3 rounded-md border p-3">
        <div>
          <Label htmlFor="create-username">Username</Label>
          <Input
            id="create-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="login username"
            data-testid="input-create-username"
          />
        </div>
        <div>
          <Label htmlFor="create-email">Email</Label>
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email for the account"
            data-testid="input-create-email"
          />
        </div>
        <div>
          <Label htmlFor="create-password">Temporary password</Label>
          <Input
            id="create-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 characters"
            data-testid="input-create-password"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The crew member must change this on first login.
          </p>
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger data-testid="select-create-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles
                .filter((r) => r.isActive)
                .map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Vessel scope</Label>
          <Select value={vesselScope} onValueChange={setVesselScope}>
            <SelectTrigger data-testid="select-create-vessel-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No scope yet</SelectItem>
              <SelectItem value="__fleet__">Fleet-wide access (explicit)</SelectItem>
              {crewVesselId && !crewVesselInList ? (
                <SelectItem value={crewVesselId}>Assigned vessel (crew vessel)</SelectItem>
              ) : null}
              {vessels.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.id === crewVesselId ? " (crew vessel)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {crewVesselId
              ? "The login starts with the crew member's vessel when one is assigned."
              : "Choose a vessel or fleet scope now, or leave access scoping for later."}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="create-login-enabled">Login enabled</Label>
          <Switch
            id="create-login-enabled"
            checked={loginEnabled}
            onCheckedChange={setLoginEnabled}
            data-testid="switch-create-login-enabled"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (username.trim().length < 3) {
                toast({
                  title: "Username too short",
                  description: "Use at least 3 characters.",
                  variant: "destructive",
                });
                return;
              }
              if (password.length < 8) {
                toast({
                  title: "Password too short",
                  description: "Use at least 8 characters.",
                  variant: "destructive",
                });
                return;
              }
              create.mutate();
            }}
            disabled={create.isPending}
            data-testid="button-create-login"
          >
            Create login
          </Button>
        </div>
      </div>
    </div>
  );
}
