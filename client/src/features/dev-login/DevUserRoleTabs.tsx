import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearNavOverride, writeUserRole } from "@/infrastructure/navigation/nav-storage";
import { queryClient } from "@/lib/queryClient";
import { setApiSessionToken } from "@/lib/sessionToken";
import { DEV_USER_ROLES, devUserRoleLabel, isDevUserRole, type DevUserRole } from "./roles";
import { requestDevLogin } from "./api";
import { isDevLoginClientEnabled, readDevLoginSession, writeDevLoginSession } from "./session";

interface DevUserRoleTabsProps {
  currentRole: string | null;
  onRoleChanged: (role: string) => void;
}

export function DevUserRoleTabs({ currentRole, onRoleChanged }: DevUserRoleTabsProps) {
  const devSession = readDevLoginSession();
  const activeRole = isDevUserRole(currentRole)
    ? currentRole
    : devSession?.persona === "user"
      ? devSession.role
      : null;

  const switchRole = useMutation({
    mutationFn: (role: DevUserRole) => requestDevLogin({ persona: "user", role }),
    onSuccess: (data) => {
      const nextRole = isDevUserRole(data.user.role) ? data.user.role : "deck_officer";
      setApiSessionToken(data.sessionToken);
      writeDevLoginSession({ persona: "user", role: nextRole });
      writeUserRole(nextRole);
      clearNavOverride();
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/permissions/me"] });
      onRoleChanged(nextRole);
    },
  });

  if (!isDevLoginClientEnabled() || devSession?.persona !== "user") {
    return null;
  }

  return (
    <div
      className="sticky top-0 z-40 border-b border-amber-400/30 bg-amber-950/95 px-3 py-2 text-amber-50 shadow-lg backdrop-blur"
      data-testid="dev-user-role-tabs"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-200">
          Dev role preview
        </span>
        <div className="flex gap-1">
          {DEV_USER_ROLES.map((role) => {
            const isActive = role === activeRole;
            const isLoading = switchRole.isPending && switchRole.variables === role;
            return (
              <Button
                key={role}
                type="button"
                size="sm"
                variant={isActive ? "secondary" : "ghost"}
                disabled={switchRole.isPending}
                onClick={() => switchRole.mutate(role)}
                className={
                  isActive
                    ? "h-8 whitespace-nowrap bg-amber-100 text-amber-950 hover:bg-amber-100"
                    : "h-8 whitespace-nowrap text-amber-100 hover:bg-amber-900 hover:text-white"
                }
                data-testid={`button-dev-role-${role}`}
              >
                {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {devUserRoleLabel(role)}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
