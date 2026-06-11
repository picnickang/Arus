/**
 * Profile — user-portal account page (Phase 2 navigation).
 *
 * Shows the signed-in user's identity (from `/api/permissions/me` via
 * PermissionsContext), a real self-service change-password form
 * (`POST /api/me/change-password`), and a real sign-out
 * (`POST /api/me/logout`, via AdminAccessContext.logout). Non-hub-gated
 * so any authenticated user can reach it. No placeholder data — every
 * control performs a real action and reports real success/failure.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCircle, Loader2, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SwitchPortalButton } from "@/components/navigation/SwitchPortalButton";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { apiRequest } from "@/lib/queryClient";
import {
  passwordChangeSchema,
  PASSWORD_CHANGE_DEFAULTS,
  type PasswordChangeData,
} from "@/lib/password-change";

type ChangeState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export default function ProfilePage() {
  const { permissions } = usePermissions();
  const { logout } = useAdminAccess();

  const [state, setState] = useState<ChangeState>({ kind: "idle" });
  const [loggingOut, setLoggingOut] = useState(false);

  const form = useForm<PasswordChangeData, unknown, PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: PASSWORD_CHANGE_DEFAULTS,
    mode: "onChange",
  });

  const roleLabel = permissions.roleNames.length > 0 ? permissions.roleNames.join(", ") : "—";

  async function onSubmit(data: PasswordChangeData) {
    setState({ kind: "saving" });
    try {
      await apiRequest("POST", "/api/me/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setState({ kind: "success" });
      form.reset(PASSWORD_CHANGE_DEFAULTS);
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof Error ? err.message : "Could not change password. Please try again.",
      });
    }
  }

  async function onLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6" data-testid="page-profile">
      <div className="flex justify-end">
        <SwitchPortalButton />
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm font-medium capitalize" data-testid="text-profile-role">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Organization</span>
            <span className="text-sm font-medium" data-testid="text-profile-org">
              {permissions.orgId || "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
          <CardDescription>Update the password you use to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === "success" && (
            <div
              className="mb-4 flex items-start gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-600"
              role="status"
              data-testid="banner-profile-success"
            >
              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Password updated.</span>
            </div>
          )}
          {state.kind === "error" && (
            <div
              className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="error-profile-password"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Current password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        disabled={state.kind === "saving"}
                        data-testid="input-current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>New password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        disabled={state.kind === "saving"}
                        data-testid="input-new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Confirm new password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        disabled={state.kind === "saving"}
                        data-testid="input-confirm-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={state.kind === "saving"}
                data-testid="button-change-password"
              >
                {state.kind === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={onLogout}
        disabled={loggingOut}
        data-testid="button-logout"
      >
        {loggingOut ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing out…
          </>
        ) : (
          <>
            <LogOut className="h-4 w-4" />
            Sign Out
          </>
        )}
      </Button>
    </div>
  );
}
