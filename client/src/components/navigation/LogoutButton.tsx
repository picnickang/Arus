/**
 * Logout — real sign-out affordance.
 *
 * Unlike SwitchPortalButton (which only clears the role hint and returns to
 * the login screen WITHOUT touching auth), this revokes the server session and
 * tears down all local auth state via AdminAccessContext.logout(), then sends
 * the user to /portal-login. Works for both regular users and admins, since
 * both authenticate through `/api/portal/login`.
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminAccess } from "@/contexts/AdminAccessContext";

interface LogoutButtonProps {
  /** Optional override label — defaults to "Log out". */
  label?: string;
  /** Visual variant — small ghost chip (default) or outline. */
  variant?: "ghost" | "outline";
  className?: string;
}

export function LogoutButton({
  label = "Log out",
  variant = "ghost",
  className,
}: LogoutButtonProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAdminAccess();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      // logout() is best-effort on the network and always clears local state.
      await logout();
    } finally {
      setLocation("/portal-login");
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleLogout}
      disabled={pending}
      className={className}
      data-testid="button-logout"
    >
      <LogOut className="h-3.5 w-3.5" />
      {pending ? "Signing out…" : label}
    </Button>
  );
}
