import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ROLE_STORAGE_KEY, BOTTOM_NAV_OVERRIDE_STORAGE_KEY } from "@/config/roles";
import { getLandingRouteForRole } from "@/application/navigation/role-navigation-policy";
import { Shield, User, ArrowRight, Anchor, ArrowLeft, LogIn } from "lucide-react";

interface LoginResponse {
  sessionToken: string;
  expiresIn: number;
  mustChangePassword: boolean;
  user: { id: string; name: string | null; role: string };
}

type PortalChoice = {
  roleHint: "system_admin" | "deck_officer";
  mode: "admin" | "user";
  title: string;
  subtitle: string;
  cta: string;
  icon: typeof Shield;
  accent: string;
  testId: string;
};

const PORTALS: PortalChoice[] = [
  {
    roleHint: "system_admin",
    mode: "admin",
    title: "Admin Portal",
    subtitle: "System administration, fleet management, and advanced tools.",
    cta: "Admin Login",
    icon: Shield,
    accent: "bg-primary text-primary-foreground hover:bg-primary/90",
    testId: "card-portal-admin",
  },
  {
    roleHint: "deck_officer",
    mode: "user",
    title: "User Portal",
    subtitle: "Operational dashboard, tasks, and feedback.",
    cta: "User Login",
    icon: User,
    accent: "bg-teal-600 text-white hover:bg-teal-700",
    testId: "card-portal-user",
  },
];

function rememberRoleHint(roleHint: string) {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, roleHint);
    // Clear any prior bottom-nav override so the new role's policy
    // takes effect on next render.
    localStorage.removeItem(BOTTOM_NAV_OVERRIDE_STORAGE_KEY);
  } catch {
    // localStorage may be unavailable (private mode). The policy will
    // fall back to its default branch.
  }
}

export default function PortalLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { unlockAdmin, isUnlocking, unlockError } = useAdminAccess();

  const [view, setView] = useState<"choose" | "user" | "admin">("choose");

  // User login state
  const [stage, setStage] = useState<"login" | "change">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Admin login state
  const [adminPassword, setAdminPassword] = useState("");

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
        rememberRoleHint(data.user.role);
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

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      await unlockAdmin(adminPassword);
      // Unlock succeeded — mark the admin portal as the active persona so the
      // nav policy surfaces admin hubs, then route into the portal.
      rememberRoleHint("system_admin");
      setAdminPassword("");
      toast({ title: "Admin portal unlocked" });
      navigate(getLandingRouteForRole("system_admin"));
    } catch {
      // unlockAdmin surfaces the failure via unlockError; nothing else to do.
    }
  }

  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  function backToChooser() {
    setView("choose");
    setStage("login");
  }

  /* ---------------------------- Chooser ---------------------------- */

  if (view === "choose") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        data-testid="page-portal-login"
      >
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10 text-white">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur">
              <Anchor className="h-7 w-7" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Welcome to ARUS</h1>
            <p className="mt-2 text-sm text-white/70">
              Advanced Reliability &amp; Unified Systems
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PORTALS.map((portal) => {
              const Icon = portal.icon;
              return (
                <Card
                  key={portal.roleHint}
                  className="overflow-hidden border-white/10 bg-white/95 backdrop-blur transition hover:shadow-xl"
                  data-testid={portal.testId}
                >
                  <CardContent className="flex flex-col items-center text-center gap-4 p-8">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                      <Icon className="h-7 w-7 text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-slate-900">{portal.title}</h2>
                      <p className="text-sm text-slate-600">{portal.subtitle}</p>
                    </div>
                    <Button
                      className={`w-full ${portal.accent}`}
                      onClick={() => setView(portal.mode)}
                      data-testid={`button-${portal.testId}`}
                    >
                      {portal.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <p className="mt-8 text-center text-xs text-white/50">
            Secure. Reliable. Maritime.
          </p>
        </div>
      </div>
    );
  }

  /* ------------------------ Login form shell ----------------------- */

  const isAdmin = view === "admin";
  const Icon = isAdmin ? Shield : User;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      data-testid="page-portal-login"
    >
      <Card className="w-full max-w-sm border-white/10 bg-white/95 backdrop-blur">
        <CardContent className="p-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 text-slate-600 hover:text-slate-900"
            onClick={backToChooser}
            data-testid="button-back-to-portals"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>

          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Icon className="h-6 w-6 text-slate-700" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900" data-testid="text-login-title">
              {isAdmin
                ? "Admin Portal"
                : stage === "login"
                  ? "User Portal"
                  : "Set a new password"}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {isAdmin
                ? "Enter the vessel admin password to start an authenticated session."
                : stage === "login"
                  ? "Use the credentials provided by your administrator."
                  : "Choose a new password to finish signing in."}
            </p>
          </div>

          {isAdmin ? (
            <form className="space-y-4" onSubmit={handleAdminLogin}>
              <div>
                <Label htmlFor="admin-password" className="text-slate-700">
                  Admin password
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  data-testid="input-admin-password"
                />
              </div>
              {unlockError && (
                <p className="text-sm text-destructive" role="alert" data-testid="text-admin-error">
                  {unlockError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isUnlocking || !adminPassword.trim()}
                data-testid="button-admin-login"
              >
                <LogIn className="h-4 w-4 mr-1" />
                {isUnlocking ? "Unlocking..." : "Admin Login"}
              </Button>
            </form>
          ) : stage === "login" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate();
              }}
            >
              <div>
                <Label htmlFor="login-username" className="text-slate-700">
                  Username
                </Label>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  data-testid="input-login-username"
                />
              </div>
              <div>
                <Label htmlFor="login-password" className="text-slate-700">
                  Password
                </Label>
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
                className="w-full bg-teal-600 text-white hover:bg-teal-700"
                disabled={login.isPending || !username.trim() || !password}
                data-testid="button-login"
              >
                <LogIn className="h-4 w-4 mr-1" /> User Login
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
                <Label htmlFor="change-current" className="text-slate-700">
                  Current password
                </Label>
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
                <Label htmlFor="change-new" className="text-slate-700">
                  New password
                </Label>
                <Input
                  id="change-new"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  data-testid="input-change-new"
                />
                <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
              </div>
              <div>
                <Label htmlFor="change-confirm" className="text-slate-700">
                  Confirm new password
                </Label>
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
                className="w-full bg-teal-600 text-white hover:bg-teal-700"
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
