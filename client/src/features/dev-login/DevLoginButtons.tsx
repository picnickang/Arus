import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAdminAccess } from "@/contexts/AdminAccessContext";
import { getLandingRouteForRole } from "@/application/navigation/role-navigation-policy";
import { rememberRoleHint } from "@/application/navigation/role-hint";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import {
  isDevLoginClientEnabled,
  isDevUserRole,
  requestDevLogin,
  writeDevLoginSession,
  type DevLoginRequest,
  type DevLoginResponse,
} from ".";

export function DevLoginButtons() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { unlockAdminFromUserSession } = useAdminAccess();

  const devLogin = useMutation<DevLoginResponse, Error, DevLoginRequest>({
    mutationFn: requestDevLogin,
    onSuccess: (data, variables) => {
      setApiSessionToken(data.sessionToken);
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });

      if (variables.persona === "admin") {
        writeDevLoginSession({ persona: "admin" });
        unlockAdminFromUserSession(data.sessionToken, data.expiresIn);
        rememberRoleHint(data.user.role);
        toast({ title: "Development admin session started" });
        navigate(getLandingRouteForRole(data.user.role));
        return;
      }

      const role = isDevUserRole(data.user.role) ? data.user.role : variables.role;
      writeDevLoginSession({ persona: "user", role });
      rememberRoleHint(role);
      toast({ title: `Development user preview: ${role.replace(/_/g, " ")}` });
      navigate("/");
    },
    onError: () =>
      toast({
        title: "Development login unavailable",
        description: "Enable ARUS_DEV_LOGIN=1 outside production to use temporary preview login.",
        variant: "destructive",
      }),
  });

  if (!isDevLoginClientEnabled()) {
    return null;
  }

  return (
    <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-300">
        Temporary development access
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="border-amber-300/30 bg-transparent text-amber-100 hover:bg-amber-300/10"
          disabled={devLogin.isPending}
          onClick={() => devLogin.mutate({ persona: "admin" })}
          data-testid="button-dev-login-admin"
        >
          Dev Admin Login
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-emerald-300/30 bg-transparent text-emerald-100 hover:bg-emerald-300/10"
          disabled={devLogin.isPending}
          onClick={() => devLogin.mutate({ persona: "user", role: "deck_officer" })}
          data-testid="button-dev-login-user"
        >
          Dev User Login
        </Button>
      </div>
    </div>
  );
}
