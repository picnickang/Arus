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
import { getLandingRouteForRole } from "@/application/navigation/role-navigation-policy";
import { isSuperAdminRole } from "@shared/role-dashboard";
import {
  clearNavOverride,
  clearUserRole,
  writeUserRole,
} from "@/infrastructure/navigation/nav-storage";
import {
  Shield,
  User,
  ArrowLeft,
  LogIn,
  ShipWheel,
  UserRound,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

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
  role: string;
  badge: string;
  icon: typeof Shield;
  iconWrap: string;
  testId: string;
};

const PORTALS: PortalChoice[] = [
  {
    roleHint: "system_admin",
    mode: "admin",
    title: "Admin Login",
    role: "Authorized Personnel",
    badge: "Role-gated access",
    icon: ShipWheel,
    iconWrap: "bg-sky-500/10 text-sky-400 ring-1 ring-inset ring-sky-500/20",
    testId: "card-portal-admin",
  },
  {
    roleHint: "deck_officer",
    mode: "user",
    title: "User Login",
    role: "Personal Workflows",
    badge: "Personal access",
    icon: UserRound,
    iconWrap: "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
    testId: "card-portal-user",
  },
];

function rememberRoleHint(roleHint: string) {
  writeUserRole(roleHint);
  clearNavOverride();
}

export default function PortalLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { unlockAdminFromUserSession } = useAdminAccess();

  const [view, setView] = useState<"choose" | "user" | "admin">("choose");

  // User login state
  const [stage, setStage] = useState<"login" | "change">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Admin login error. Admin sign-in reuses the shared username/password
  // fields below — there is no separate shared-password field anymore.
  const [adminError, setAdminError] = useState<string | null>(null);

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

  const adminLogin = useMutation<LoginResponse>({
    mutationFn: () =>
      apiRequest("POST", "/api/portal/login", {
        username: username.trim(),
        password,
      }),
    onSuccess: (data) => {
      // The Admin Portal is gated to admin-capable accounts. A valid non-admin
      // credential authenticates against the same endpoint, so reject it here
      // and drop the freshly-minted session rather than granting admin access.
      if (!isSuperAdminRole(data.user.role)) {
        setApiSessionToken(null);
        queryClient.clear();
        setAdminError("This account does not have admin access.");
        return;
      }
      setApiSessionToken(data.sessionToken);
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      if (data.mustChangePassword) {
        setCurrentPassword(password);
        setStage("change");
        toast({
          title: "Password change required",
          description: "Please set a new password to continue.",
        });
        return;
      }
      unlockAdminFromUserSession(data.sessionToken, data.expiresIn);
      rememberRoleHint(data.user.role);
      toast({ title: "Admin portal unlocked" });
      navigate(getLandingRouteForRole(data.user.role));
    },
    onError: () =>
      setAdminError(
        "Check your username and password, or your account may be disabled.",
      ),
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
      clearUserRole();
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

  function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);
    adminLogin.mutate();
  }

  function enterPortal(mode: "admin" | "user") {
    setUsername("");
    setPassword("");
    setAdminError(null);
    setStage("login");
    setView(mode);
  }

  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  function backToChooser() {
    setView("choose");
    setStage("login");
    setUsername("");
    setPassword("");
    setAdminError(null);
  }

  /* ---------------------------- Chooser ---------------------------- */

  if (view === "choose") {
    return (
      <div
        className="relative min-h-screen overflow-hidden bg-[#070b14]"
        data-testid="page-portal-login"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,rgba(56,120,200,0.18),transparent_60%)]" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-16">
          <div className="mb-10">
            <h1
              className="text-4xl font-bold tracking-tight text-white"
              data-testid="text-brand"
            >
              ARUS
            </h1>
            <p className="mt-2 text-sm text-slate-400">Operational access for ARUS</p>
          </div>

          <div className="mb-7">
            <h2 className="text-4xl font-bold tracking-tight text-white">Welcome</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-400">
              Choose the right login path to continue to your operational portal.
            </p>
          </div>

          <div className="space-y-4">
            {PORTALS.map((portal) => {
              const Icon = portal.icon;
              return (
                <div key={portal.roleHint} data-testid={portal.testId}>
                  <button
                    type="button"
                    onClick={() => enterPortal(portal.mode)}
                    className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
                    data-testid={`button-${portal.testId}`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${portal.iconWrap}`}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-white">
                          {portal.title}
                        </span>
                        <span className="block text-sm text-slate-400">{portal.role}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
                    </div>
                    <span className="mt-4 flex w-full items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-400">
                      {portal.badge}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-auto pt-10">
            <div className="border-t border-white/10" />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Secure. Role-based. Always.
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------ Login form shell ----------------------- */

  const isAdmin = view === "admin";
  const Icon = isAdmin ? Shield : User;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-[#0c1424] to-[#070b14]"
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
              {stage === "change"
                ? "Set a new password"
                : isAdmin
                  ? "Admin Portal"
                  : "User Portal"}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {stage === "change"
                ? "Choose a new password to finish signing in."
                : isAdmin
                  ? "Sign in with your admin username and password."
                  : "Use the credentials provided by your administrator."}
            </p>
          </div>

          {isAdmin && stage === "login" ? (
            <form className="space-y-4" onSubmit={handleAdminLogin}>
              <div>
                <Label htmlFor="admin-username" className="text-slate-700">
                  Username
                </Label>
                <Input
                  id="admin-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  data-testid="input-admin-username"
                />
              </div>
              <div>
                <Label htmlFor="admin-password" className="text-slate-700">
                  Password
                </Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  data-testid="input-admin-password"
                />
              </div>
              {adminError && (
                <p className="text-sm text-destructive" role="alert" data-testid="text-admin-error">
                  {adminError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={adminLogin.isPending || !username.trim() || !password}
                data-testid="button-admin-login"
              >
                <LogIn className="h-4 w-4 mr-1" />
                {adminLogin.isPending ? "Signing in..." : "Admin Login"}
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
                if (passwordsMismatch) {return;}
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
