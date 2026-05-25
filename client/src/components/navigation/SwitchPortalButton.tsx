/**
 * Switch Portal — explicit affordance to clear the current role hint
 * and return to /portal-login.
 *
 * Surfaced on portal-aware pages (HomePage for both portals, Feedback
 * page in the user portal) so the user is never trapped in a single
 * portal without a clear escape — previously the only way out was the
 * back arrow in PageHeader, which is implicit and easy to miss.
 *
 * Pure UI: this component only mutates the role-hint storage that the
 * navigation policy already reads. It does NOT touch auth state.
 */

import { useLocation } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_STORAGE_KEY } from "@/config/roles";

interface SwitchPortalButtonProps {
  /** Optional override label — defaults to "Switch portal". */
  label?: string;
  /** Visual variant — small ghost chip (default) or outline. */
  variant?: "ghost" | "outline";
  className?: string;
}

export function SwitchPortalButton({
  label = "Switch portal",
  variant = "ghost",
  className,
}: SwitchPortalButtonProps) {
  const [, setLocation] = useLocation();

  function handleSwitch() {
    try {
      localStorage.removeItem(ROLE_STORAGE_KEY);
      // Drop any per-user bottom-nav override so the next portal's
      // default policy renders on first paint.
      localStorage.removeItem("arus-bottom-nav-items");
    } catch {
      // Storage unavailable — the navigation still resets because the
      // portal-login page is the next destination.
    }
    setLocation("/portal-login");
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleSwitch}
      className={className}
      data-testid="button-switch-portal"
    >
      <LogOut className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
