import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ROLE_STORAGE_KEY } from "@/config/roles";
import { Ship, LogIn } from "lucide-react";

interface LoginResponse {
  sessionToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: { id: string; name: string | null; role: string };
}

export default function PortalLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [stage, setStage] = useState<"login" | "change">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const login = useMutation<LoginResponse>({
    mutationFn: () =>
      apiRequest("POST", "/api/portal/login", {
        username: username.trim(),
        password,
      }),
    onSuccess: (data) => {
      setApiSessionToken(data.sessionToken);
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      if (data.mustChangePassword) {
        setCurrentPassword(password);
        setStage("change");
        toast({
          title: "Password change required",
          description: "Please set a new password to continue.",
        });
      } else {
        // Drive the User page from the DB-assigned role returned by the
        // authenticated login, not a manually-picked persona. Home reads
        // this key on mount; without it the user would bounce straight back
        // to the login screen.
        try {
          localStorage.setItem(ROLE_STORAGE_KEY, data.user.role);
        } catch {
          /* storage unavailable — home falls back to the role selector */
        }
        toast({ title: "Welcome back" });
        navigate("/");
      }
    },
    onError: () =>
      toast({
        title: "Login failed",
        description: "Check your username and password, or your account may be disabled.",
        variant: "destructive",
      }),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/me/change-password", {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      // Changing the password invalidates ALL of the user's sessions on the
      // server — including the token we are holding right now. Navigating into
      // an authenticated route would immediately 401, so clear local auth
      // state and send the user back to a fresh sign-in.
      setApiSessionToken(null);
      try {
        localStorage.removeItem(ROLE_STORAGE_KEY);
      } catch {
        /* storage unavailable — nothing to clear */
      }
      queryClient.clear();
      setStage("login");
      setPassword("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "Please sign in with your new password.",
      });
    },
    onError: () =>
      toast({
        title: "Could not update password",
        description: "Check your current password and that the new one meets requirements.",
        variant: "destructive",
      }),
  });

  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Ship className="h-6 w-6 text-primary" />
          </div>
          <CardTitle data-testid="text-login-title">
            {stage === "login" ? "Sign in to ARUS" : "Set a new password"}
          </CardTitle>
          <CardDescription>
            {stage === "login"
              ? "Use the credentials provided by your administrator."
              : "Choose a new password to finish signing in."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "login" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
            >
              <div>
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  data-testid="input-login-username"
                />
              </div>
              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="input-login-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={login.isPending || !username.trim() || !password}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-1" /> Sign in
              </Button>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordsMismatch) return;
                changePassword.mutate();
              }}
            >
              <div>
                <Label htmlFor="change-current">Current password</Label>
                <Input
                  id="change-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="input-change-current"
                />
              </div>
              <div>
                <Label htmlFor="change-new">New password</Label>
                <Input
                  id="change-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-change-new"
                />
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="change-confirm">Confirm new password</Label>
                <Input
                  id="change-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-change-confirm"
                />
                {passwordsMismatch && (
                  <p className="text-xs text-destructive mt-1" data-testid="text-password-mismatch">
                    Passwords do not match.
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={
                  changePassword.isPending ||
                  newPassword.length < 8 ||
                  passwordsMismatch ||
                  !currentPassword
                }
                data-testid="button-change-password"
              >
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
