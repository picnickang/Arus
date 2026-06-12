import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
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
import { HUB_IDS } from "@shared/role-dashboard";
import { getCategoryById } from "@/config/navigationConfig";
import type { CrewUser } from "./UserAccessEditorModel";

export interface SaveResultItem {
  label: string;
  ok: boolean;
  error?: string;
}

interface HubAccessSectionProps {
  isSuper: boolean;
  isGrantEligible: boolean;
  hubAdmin: boolean;
  selectedHubs: string[];
  onRequestGrant: () => void;
  onHubAdminChange: (enabled: boolean) => void;
  onSelectedHubsChange: (updater: (prev: string[]) => string[]) => void;
}

interface CredentialsSectionProps {
  user: CrewUser;
  username: string;
  tempPassword: string;
  loginEnabled: boolean;
  onUsernameChange: (value: string) => void;
  onTempPasswordChange: (value: string) => void;
  onLoginEnabledChange: (value: boolean) => void;
  onOpenResetPassword: () => void;
}

interface GrantHubAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

interface ResetPasswordDialogProps {
  open: boolean;
  password: string;
  isPending: boolean;
  onClose: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
}

function hubLabel(id: string): string {
  return getCategoryById(id)?.name ?? id;
}

export function HubAccessSection({
  isSuper,
  isGrantEligible,
  hubAdmin,
  selectedHubs,
  onRequestGrant,
  onHubAdminChange,
  onSelectedHubsChange,
}: HubAccessSectionProps) {
  return (
    <>
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
                    onRequestGrant();
                  } else {
                    onHubAdminChange(false);
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
                        onSelectedHubsChange((prev) =>
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
    </>
  );
}

export function CredentialsSection({
  user,
  username,
  tempPassword,
  loginEnabled,
  onUsernameChange,
  onTempPasswordChange,
  onLoginEnabledChange,
  onOpenResetPassword,
}: CredentialsSectionProps) {
  return (
    <>
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
            onChange={(e) => onUsernameChange(e.target.value)}
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
            onChange={(e) => onTempPasswordChange(e.target.value)}
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
            onCheckedChange={onLoginEnabledChange}
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
            onClick={onOpenResetPassword}
            data-testid="button-reset-password"
          >
            Reset password
          </Button>
        )}
      </div>
    </>
  );
}

export function SaveResultList({ results }: { results: SaveResultItem[] }) {
  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-md border p-3 text-sm" data-testid="access-save-result">
      {results.map((result) => (
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
  );
}

export function GrantHubAccessDialog({
  open,
  onOpenChange,
  onConfirm,
}: GrantHubAccessDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Grant admin-hub access?</AlertDialogTitle>
          <AlertDialogDescription>
            This gives the user access to the admin portal and the management hubs you select. They
            will be able to view and act on fleet-wide operational data. Only grant this to trusted
            manager-level staff. You can revoke it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-grant-hub">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid="button-confirm-grant-hub">
            Grant access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResetPasswordDialog({
  open,
  password,
  isPending,
  onClose,
  onPasswordChange,
  onSubmit,
}: ResetPasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
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
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            data-testid="input-reset-password"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-reset">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isPending}
            data-testid="button-confirm-reset"
          >
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
